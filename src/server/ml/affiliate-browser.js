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
import { prisma } from '../db.js';
import { encrypt, decrypt } from '../crypto.js';

const GENERATOR_URL = 'https://www.mercadolivre.com.br/afiliados/linkbuilder';
const STORAGE_DIR = './auth_state/affiliate';

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
    const res = await page.goto(GENERATOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
  let ctx;
  try {
    ctx = await newContext();
    const page = await ctx.newPage();
    await page.goto(GENERATOR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (page.url().includes('/login') || page.url().includes('/identification')) {
      await setStatus('disconnected', 'redirecionado pra login');
      throw new Error('Sessão expirou — refaça login');
    }

    // Tenta achar o textarea de input do gerador
    const textareaSelector = 'textarea, input[type="text"][placeholder*="URL"], input[name*="url"]';
    await page.waitForSelector(textareaSelector, { timeout: 10000 });
    await page.fill(textareaSelector, productUrl);

    // Botão "Gerar"
    const btn = await page.locator('button:has-text("Gerar"), button[type="submit"]').first();
    await btn.click();

    // Aguarda aparecer o link gerado (.../sec/...)
    const shortlinkSelector = 'a[href*="/sec/"], input[value*="/sec/"], [data-testid*="link"]';
    await page.waitForSelector(shortlinkSelector, { timeout: 15000 });

    // Tenta extrair href ou value
    const link = await page.evaluate(() => {
      const anchor = document.querySelector('a[href*="/sec/"]');
      if (anchor) return anchor.href;
      const input = document.querySelector('input[value*="/sec/"]');
      if (input) return input.value;
      return null;
    });

    if (!link) throw new Error('Não consegui extrair o shortlink (HTML mudou?)');
    return link;
  } finally {
    if (ctx) await ctx.close();
  }
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
