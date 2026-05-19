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

// Regex que casa TODOS os formatos de shortlink do ML afiliado:
//   https://meli.la/1CmYUxY           (formato novo curto)
//   https://www.mercadolivre.com.br/sec/2H4qXyZ
//   http://mercadolivre.com/sec/abc
const SHORTLINK_REGEX = /https?:\/\/(?:[\w-]+\.)?(?:meli\.la|mercadoli(?:vre|bre)\.com(?:\.[a-z]{2,3})?\/sec)\/[A-Za-z0-9]+/i;

function isShortlinkUrl(url) {
  return SHORTLINK_REGEX.test(url ?? '');
}

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
/**
 * @param {string} productUrl
 * @param {object} [opts]
 * @param {(evt: {stage: string, message: string, screenshot?: string, htmlSnippet?: string}) => void} [opts.onProgress]
 *   Callback chamado a cada etapa — `screenshot` é nome do arquivo salvo em /api/affiliate/debug/.
 */
export async function generateShortlink(productUrl, opts = {}) {
  return withMutex(() => _generateShortlinkUnsafe(productUrl, opts));
}

async function _generateShortlinkUnsafe(productUrl, { onProgress } = {}) {
  let ctx;
  const startedAt = Date.now();
  // Sessão única de debug pra essa tentativa (todos os screenshots ficam juntos)
  const sessionTag = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let stepCount = 0;

  // Helper pra emitir progresso + salvar screenshot
  const step = async (page, stage, message) => {
    stepCount++;
    const log = `[step ${stepCount}] ${stage}: ${message}`;
    console.log(`   ${log}`);
    let screenshotName = null;
    if (page) {
      try {
        await fs.mkdir(DEBUG_DIR, { recursive: true });
        screenshotName = `step-${sessionTag}-${stepCount}-${stage}.png`;
        await page.screenshot({
          path: path.join(DEBUG_DIR, screenshotName),
          fullPage: false, // viewport só, mais rápido
        });
      } catch (e) {
        console.warn(`   ⚠️  screenshot do step falhou: ${e.message}`);
      }
    }
    onProgress?.({ stage, message, screenshot: screenshotName, step: stepCount });
  };

  try {
    await step(null, 'start', `URL: ${productUrl}`);
    ctx = await newContext();
    const page = await ctx.newPage();

    // ESTRATÉGIA ROBUSTA: intercepta TODAS as responses da rede e procura
    // qualquer URL com /sec/ ou JSON que retorne shortlink. Mais resiliente
    // a mudanças de HTML do portal.
    const shortlinks = new Set();
    const collectShortlink = async (response) => {
      const url = response.url();
      // 1. URL da própria response é um shortlink (vários formatos)
      if (isShortlinkUrl(url)) {
        shortlinks.add(url);
        return;
      }
      // 2. JSON response com shortlink dentro
      const ct = response.headers()['content-type'] ?? '';
      if (ct.includes('json')) {
        try {
          const body = await response.text();
          const m = body.match(SHORTLINK_REGEX);
          if (m) shortlinks.add(m[0]);
        } catch {}
      }
    };
    page.on('response', collectShortlink);

    // Captura console errors + requisições falhadas — pode revelar problemas silenciosos
    const browserLogs = [];
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const text = msg.text();
        browserLogs.push(`[${type}] ${text.slice(0, 200)}`);
      }
    });
    page.on('pageerror', (err) => {
      browserLogs.push(`[pageerror] ${err.message?.slice(0, 200)}`);
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('mercadolivre') || url.includes('mercadolibre')) {
        browserLogs.push(`[requestfailed] ${req.method()} ${url.slice(0, 120)} — ${req.failure()?.errorText}`);
      }
    });

    await step(null, 'goto', `Navegando para ${GENERATOR_URL}`);
    await page.goto(GENERATOR_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await step(page, 'page-loaded', `URL final: ${page.url()}`);

    if (page.url().includes('/login') || page.url().includes('/identification')) {
      await setStatus('disconnected', 'redirecionado pra login');
      throw new Error('Sessão expirou — refaça login');
    }

    // O gerador tem um TEXTAREA específico — usar placeholder "Insira 1 ou mais URLs"
    // (vi no screenshot). Evita pegar a barra de busca do topo da página.
    const textareaSelectors = [
      'textarea[placeholder*="Insira" i]',
      'textarea[placeholder*="URL" i]',
      'textarea[placeholder*="url" i]',
      'main textarea',           // textarea dentro da área principal
      'form textarea',           // textarea dentro de algum form
      'textarea',                // fallback
    ];
    let filledLocator = null;
    let filled = false;
    for (const sel of textareaSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          // Limpa texto residual e preenche
          await el.click({ timeout: 5000 });
          await el.fill('', { timeout: 5000 });   // limpa
          await el.fill(productUrl, { timeout: 5000 });
          filled = true;
          filledLocator = el;
          console.log(`   ✓ campo preenchido com seletor: ${sel}`);
          break;
        }
      } catch {}
    }
    if (!filled) throw new Error('Não achei campo de URL no gerador (HTML pode ter mudado)');
    await step(page, 'filled', `Textarea preenchido`);

    // Confirma que o textarea tem o conteúdo certo (validação anti-bug)
    try {
      const actualValue = await filledLocator.inputValue();
      if (!actualValue.includes('mercadoli')) {
        await step(page, 'textarea-suspect', `Conteúdo inesperado: "${actualValue.slice(0, 60)}"`);
      }
    } catch {}

    // Tira foco do textarea (clica fora) — fecha sugestões da busca + libera botão Gerar
    await page.keyboard.press('Tab').catch(() => {});
    await page.waitForTimeout(500);
    await step(page, 'after-tab', 'Foco removido do textarea (Tab pressionado)');

    // Botão "Gerar" — IMPORTANTE: não usar button[type=submit] pq pega a lupa
    // da barra de busca no topo. Procurar pelo texto literal "Gerar" dentro
    // do conteúdo principal (não no header).
    const btnSelectors = [
      'main button:has-text("Gerar")',
      'form button:has-text("Gerar")',
      'button:has-text("Gerar link")',
      'button:has-text("Gerar"):not([disabled])',
      '[role="button"]:has-text("Gerar")',
    ];
    // Aguarda mais tempo pro botão ficar habilitado depois do Tab
    // (React precisa processar o input e atualizar o disabled)
    await page.waitForTimeout(1500);

    let clickedSel = null;
    for (const sel of btnSelectors) {
      try {
        const btn = page.locator(sel).first();
        const count = await btn.count();
        if (count === 0) continue;
        const disabled = await btn.isDisabled().catch(() => false);
        if (disabled) {
          console.log(`   ⚠️  botão ${sel} está desabilitado — tentando próximo`);
          continue;
        }
        // Estratégia tripla: scrollIntoView + hover + click forçado
        await btn.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await btn.hover({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
        await btn.click({ timeout: 5000, force: false });
        clickedSel = sel;
        console.log(`   ✓ botão clicado: ${sel}`);
        break;
      } catch (e) {
        console.warn(`   ⚠️  click em ${sel} falhou: ${e.message?.slice(0, 100)}`);
      }
    }
    if (!clickedSel) throw new Error('Não achei botão "Gerar" habilitado (pode estar disabled por conteúdo inválido)');
    await step(page, 'clicked', `Botão Gerar clicado: ${clickedSel}, aguardando link…`);

    // Screenshot IMEDIATAMENTE após o click pra ver o estado pós-click
    await page.waitForTimeout(1000);
    await step(page, 'post-click-1s', '1 segundo após click');

    await page.waitForTimeout(3000);
    await step(page, 'post-click-4s', '4 segundos após click');

    // Aguarda link aparecer. Polling manual em paralelo:
    //   - Verifica network intercept (shortlinks Set)
    //   - Procura no DOM (anchor href, input value, regex no texto)
    // Em vez de waitForFunction que lança throw em timeout, fazemos
    // loop manual que retorna null e cai no fluxo de debug.
    const POLL_INTERVAL = 1000;
    const TIMEOUT_MS = 60000; // 60s — portal pode demorar pra responder
    let link = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < TIMEOUT_MS) {
      // 1. Network intercept (preferido — pode ter chegado antes mesmo de renderizar)
      if (shortlinks.size > 0) {
        link = Array.from(shortlinks)[0];
        break;
      }
      // 2. DOM scan — procura nos vários formatos do ML
      // O portal mostra o link gerado em um textarea/input após gerar,
      // ou em um <a>, ou no texto puro. Cobre todos os 3 + tanto
      // /sec/ (legado) quanto meli.la/ (novo formato curto)
      try {
        link = await page.evaluate(() => {
          // Regex inline (mesmo padrão do server) — JS regex literal
          const re = /https?:\/\/(?:[\w-]+\.)?(?:meli\.la|mercadoli(?:vre|bre)\.com(?:\.[a-z]{2,3})?\/sec)\/[A-Za-z0-9]+/i;

          // Procura em <a href>
          for (const a of document.querySelectorAll('a[href]')) {
            const m = a.href.match(re);
            if (m) return m[0];
          }
          // Procura em <input value> e <textarea value>
          for (const el of document.querySelectorAll('input, textarea')) {
            const v = el.value ?? '';
            const m = v.match(re);
            if (m) return m[0];
          }
          // Fallback: regex no texto visível da página inteira
          const txt = document.body?.innerText ?? '';
          const m = txt.match(re);
          if (m) return m[0];
          return null;
        });
        if (link) break;
      } catch { /* page pode estar navegando */ }

      await page.waitForTimeout(POLL_INTERVAL);
    }

    if (!link) {
      const recentLogs = browserLogs.slice(-10).join(' | ');
      await step(page, 'timeout', `Timeout. Browser logs recentes: ${recentLogs || '(nenhum)'}`);
      // SEMPRE salva debug final
      const debugInfo = await captureDebug(page, productUrl, sessionTag, browserLogs).catch(() => null);
      const hint = debugInfo
        ? ` (debug: ${path.basename(debugInfo.htmlPath)})`
        : '';
      throw new Error(`Timeout 60s esperando shortlink${hint}`);
    }
    await step(page, 'success', `Shortlink: ${link}`);
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
async function captureDebug(page, productUrl, sessionTag, browserLogs = []) {
  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const prefix = sessionTag ? `fail-${sessionTag}` : `fail-${Date.now()}`;
  const htmlPath = path.join(DEBUG_DIR, `${prefix}.html`);
  const pngPath = path.join(DEBUG_DIR, `${prefix}.png`);
  const metaPath = path.join(DEBUG_DIR, `${prefix}.json`);

  const html = await page.content().catch(() => '<no-content>');
  await fs.writeFile(htmlPath, html);

  await page.screenshot({ path: pngPath, fullPage: true }).catch((e) => {
    console.warn(`   ⚠️  screenshot falhou: ${e.message}`);
  });

  await fs.writeFile(metaPath, JSON.stringify({
    timestamp: Date.now(),
    sessionTag,
    productUrl,
    pageUrl: page.url(),
    title: await page.title().catch(() => null),
    browserLogs: browserLogs.slice(-30), // últimos 30 eventos do console do browser
  }, null, 2));

  console.warn(`   📋 Debug final salvo: ${path.basename(htmlPath)}`);
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
