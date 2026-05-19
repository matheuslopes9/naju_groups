/**
 * Playwright headless pra gerar shortlinks do portal de afiliados ML.
 *
 * Fluxo:
 *   1. Usuário acessa /api/ml/affiliate-session/connect (abre janela headed
 *      local pra QR login OU usa Chromium headless com login automatizado se
 *      tiver cookies salvos).
 *   2. Cookies são salvos no DB encriptados.
 *   3. Pra cada oferta a aprovar, generateShortlink(productUrl) reusa os
 *      cookies, navega no gerador, captura o /sec/XXXX.
 *
 * ⚠️ ISSO VIOLA OS TERMOS DO ML AFILIADOS (cláusula 1.9 - automação).
 *    Use por sua conta e risco.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';
import { encrypt, decrypt } from '../crypto.js';

const GENERATOR_URL = 'https://www.mercadolivre.com.br/afiliados/linkbuilder';
const STORAGE_DIR = './auth_state/affiliate';
const DEBUG_DIR = './auth_state/affiliate/debug';

// Mutex: só 1 generateShortlink rodando por vez. Evita corridas de Playwright
// (várias instâncias do Chromium tentando logar ao mesmo tempo) que causam
// timeouts mascarados.
let mutexChain = Promise.resolve();
function withMutex(fn) {
  const next = mutexChain.then(fn, fn);
  mutexChain = next.catch(() => {});
  return next;
}

// Localiza o Chromium do sistema (no Docker vamos instalar via apt; em dev
// usamos os browsers do Playwright se existirem; senão tenta path padrão).
function chromiumExecutable() {
  return process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';
}

async function loadCookies() {
  const row = await prisma.affiliateSession.findUnique({ where: { id: 1 } });
  if (!row?.cookiesEnc) return null;
  try {
    const json = decrypt(row.cookiesEnc);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function saveCookies(cookies) {
  const enc = encrypt(JSON.stringify(cookies));
  await prisma.affiliateSession.upsert({
    where: { id: 1 },
    create: { id: 1, cookiesEnc: enc, status: 'connected', lastCheckAt: new Date() },
    update: { cookiesEnc: enc, status: 'connected', lastCheckAt: new Date(), lastError: null },
  });
}

async function setStatus(status, lastError = null) {
  await prisma.affiliateSession.upsert({
    where: { id: 1 },
    create: { id: 1, status, lastError, lastCheckAt: new Date() },
    update: { status, lastError, lastCheckAt: new Date() },
  });
}

let cachedBrowser = null;
async function getBrowser() {
  if (cachedBrowser && cachedBrowser.isConnected?.()) return cachedBrowser;
  cachedBrowser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return cachedBrowser;
}

async function newContext() {
  const browser = await getBrowser();
  const cookies = await loadCookies();
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    viewport: { width: 1280, height: 800 },
  });
  if (cookies) {
    await ctx.addCookies(cookies);
  }
  return ctx;
}

/**
 * Verifica se a sessão atual está válida tentando acessar o portal.
 * Se redirecionar pra /login, marca como disconnected.
 */
export async function checkSession() {
  let ctx;
  try {
    await setStatus('checking');
    ctx = await newContext();
    const page = await ctx.newPage();
    const res = await page.goto(GENERATOR_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const finalUrl = page.url();
    const loggedIn = !finalUrl.includes('/login') && !finalUrl.includes('/identification');
    await setStatus(loggedIn ? 'connected' : 'disconnected');
    return { ok: loggedIn, url: finalUrl };
  } catch (e) {
    await setStatus('error', e.message);
    return { ok: false, error: e.message };
  } finally {
    if (ctx) await ctx.close();
  }
}

/**
 * Inicia processo de login. Por enquanto exige cookies vindos de fora
 * (ex: extensão Cookie-Editor exportando JSON). Retorna URL pra
 * o usuário fazer login e depois mandar os cookies.
 */
export async function importCookies(cookiesJson) {
  let cookies;
  try {
    cookies = typeof cookiesJson === 'string' ? JSON.parse(cookiesJson) : cookiesJson;
  } catch {
    throw new Error('JSON inválido — cole o array exportado pelo Cookie-Editor');
  }
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error('Array de cookies vazio');
  }
  // Filtra apenas cookies do domínio ML
  const filtered = cookies.filter((c) => {
    const d = (c.domain ?? '').toLowerCase();
    return d.includes('mercadolivre') || d.includes('mercadolibre');
  });
  if (filtered.length === 0) {
    throw new Error('Nenhum cookie de mercadolivre.com.br encontrado');
  }
  // Normaliza para o formato do Playwright.
  // Playwright só aceita sameSite: "Strict" | "Lax" | "None".
  // Cookie-Editor exporta variantes como "no_restriction", "lax", "unspecified",
  // null, "" — precisa normalizar tudo.
  function normalizeSameSite(s) {
    const v = String(s ?? '').toLowerCase();
    if (v === 'strict') return 'Strict';
    if (v === 'lax') return 'Lax';
    if (v === 'none' || v === 'no_restriction') return 'None';
    // unspecified, null, vazio, qualquer outro → Lax (default seguro)
    return 'Lax';
  }
  const normalized = filtered.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain.startsWith('.') ? c.domain : `.${c.domain.replace(/^https?:\/\//, '')}`,
    path: c.path ?? '/',
    expires: c.expirationDate ?? c.expires ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? true,
    sameSite: normalizeSameSite(c.sameSite),
  }));
  await saveCookies(normalized);
  // Verifica de cara
  return await checkSession();
}

/**
 * Gera shortlink oficial colando productUrl no gerador do portal.
 * Retorna a URL encurtada (mercadolivre.com.br/sec/XXXX).
 */
export async function generateShortlink(productUrl) {
  return withMutex(() => _generateShortlinkUnsafe(productUrl));
}

async function _generateShortlinkUnsafe(productUrl) {
  let ctx;
  const startedAt = Date.now();
  try {
    console.log(`   🔗 generateShortlink iniciando para ${productUrl.slice(0, 80)}…`);
    ctx = await newContext();
    const page = await ctx.newPage();

    // ESTRATÉGIA ROBUSTA: intercepta TODAS as responses da rede e procura
    // qualquer URL com /sec/ ou JSON que retorne shortlink. Mais resiliente
    // a mudanças de HTML do portal.
    const shortlinks = new Set();
    const collectShortlink = async (response) => {
      const url = response.url();
      // 1. URL da própria response é um shortlink
      if (url.includes('/sec/')) {
        shortlinks.add(url);
        return;
      }
      // 2. JSON response com shortlink dentro
      const ct = response.headers()['content-type'] ?? '';
      if (ct.includes('json')) {
        try {
          const body = await response.text();
          const m = body.match(/https?:\/\/[^"\s]*\/sec\/[A-Za-z0-9]+/);
          if (m) shortlinks.add(m[0]);
        } catch {}
      }
    };
    page.on('response', collectShortlink);

    await page.goto(GENERATOR_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    if (page.url().includes('/login') || page.url().includes('/identification')) {
      await setStatus('disconnected', 'redirecionado pra login');
      throw new Error('Sessão expirou — refaça login');
    }

    // Tenta achar o textarea/input do gerador (vários seletores possíveis)
    const inputSelectors = [
      'textarea',
      'input[type="url"]',
      'input[type="text"][placeholder*="URL" i]',
      'input[type="text"][placeholder*="url" i]',
      'input[name*="url" i]',
      'input[name*="link" i]',
      'input[placeholder*="produto" i]',
      'input[placeholder*="cole" i]',
    ];
    let filled = false;
    for (const sel of inputSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.fill(productUrl, { timeout: 5000 });
          filled = true;
          console.log(`   ✓ campo preenchido com seletor: ${sel}`);
          break;
        }
      } catch {}
    }
    if (!filled) throw new Error('Não achei campo de URL no gerador (HTML pode ter mudado)');

    // Botão "Gerar" (vários textos possíveis)
    const btnSelectors = [
      'button:has-text("Gerar")',
      'button:has-text("Criar")',
      'button:has-text("Compartilhar")',
      'button[type="submit"]',
      'button:has-text("Gerar link")',
    ];
    let clicked = false;
    for (const sel of btnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0) {
          await btn.click({ timeout: 5000 });
          clicked = true;
          console.log(`   ✓ botão clicado: ${sel}`);
          break;
        }
      } catch {}
    }
    if (!clicked) throw new Error('Não achei botão Gerar');

    // Aguarda link aparecer. Polling manual em paralelo:
    //   - Verifica network intercept (shortlinks Set)
    //   - Procura no DOM (anchor href, input value, regex no texto)
    // Em vez de waitForFunction que lança throw em timeout, fazemos
    // loop manual que retorna null e cai no fluxo de debug.
    const POLL_INTERVAL = 500;
    const TIMEOUT_MS = 25000;
    let link = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < TIMEOUT_MS) {
      // 1. Network intercept (preferido — pode ter chegado antes mesmo de renderizar)
      if (shortlinks.size > 0) {
        link = Array.from(shortlinks)[0];
        break;
      }
      // 2. DOM scan
      try {
        link = await page.evaluate(() => {
          const anchor = document.querySelector('a[href*="/sec/"]');
          if (anchor) return anchor.href;
          const input = document.querySelector('input[value*="/sec/"]');
          if (input) return input.value;
          const txt = document.body?.innerText ?? '';
          const m = txt.match(/https?:\/\/[^\s"]*\/sec\/[A-Za-z0-9]+/);
          if (m) return m[0];
          return null;
        });
        if (link) break;
      } catch { /* page pode estar navegando */ }

      await page.waitForTimeout(POLL_INTERVAL);
    }

    if (!link) {
      // SEMPRE salva debug antes de lançar erro
      const debugInfo = await captureDebug(page, productUrl).catch((e) => {
        console.warn(`   ⚠️  Falha ao capturar debug: ${e.message}`);
        return null;
      });
      const hint = debugInfo
        ? ` (debug: ${debugInfo.htmlPath}, ${debugInfo.pngPath})`
        : '';
      throw new Error(`Não consegui extrair o shortlink em 25s — HTML do portal pode ter mudado${hint}`);
    }
    console.log(`   ✅ shortlink gerado em ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${link}`);
    return link;
  } catch (e) {
    console.warn(`   ❌ generateShortlink falhou em ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${e.message}`);
    throw e;
  } finally {
    if (ctx) await ctx.close();
  }
}

/**
 * Salva HTML + screenshot da página atual em /app/auth_state/affiliate/debug/.
 * Retorna paths salvos pra incluir no erro.
 */
async function captureDebug(page, productUrl) {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const timestamp = Date.now();
  const htmlPath = path.join(DEBUG_DIR, `fail-${timestamp}.html`);
  const pngPath = path.join(DEBUG_DIR, `fail-${timestamp}.png`);
  const metaPath = path.join(DEBUG_DIR, `fail-${timestamp}.json`);

  const html = await page.content().catch(() => '<no-content>');
  await fs.writeFile(htmlPath, html);

  await page.screenshot({ path: pngPath, fullPage: true }).catch((e) => {
    console.warn(`   ⚠️  screenshot falhou: ${e.message}`);
  });

  await fs.writeFile(metaPath, JSON.stringify({
    timestamp,
    productUrl,
    pageUrl: page.url(),
    title: await page.title().catch(() => null),
  }, null, 2));

  console.warn(`   📋 Debug salvo: ${path.basename(htmlPath)}`);
  return { htmlPath, pngPath, metaPath };
}

export async function getSessionStatus() {
  const row = await prisma.affiliateSession.findUnique({ where: { id: 1 } });
  return {
    status: row?.status ?? 'disconnected',
    hasCookies: !!row?.cookiesEnc,
    lastCheckAt: row?.lastCheckAt ?? null,
    lastError: row?.lastError ?? null,
  };
}

export async function disconnect() {
  await prisma.affiliateSession.upsert({
    where: { id: 1 },
    create: { id: 1, cookiesEnc: null, status: 'disconnected' },
    update: { cookiesEnc: null, status: 'disconnected', lastError: null },
  });
}
