/**
 * Scraper estendido: suporta URLs do tipo lista.mercadolivre.com.br/_Container_X
 * (que em fetch puro caem em /gz/account-verification) usando Playwright
 * headless com User-Agent real.
 *
 * Reusa o mesmo parser cheerio do scraper.js — o ML usa o mesmo markup
 * (poly-card) em todas as listagens.
 */
import * as cheerio from 'cheerio';
import { chromium } from 'playwright-core';
import { createLogger } from '../logger.js';

const log = createLogger('listing');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(min, max) {
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

function chromiumExecutable() {
  return process.env.CHROMIUM_PATH ?? '/usr/bin/chromium';
}

// Mutex compartilhado: só 1 navegação Playwright por vez pro listing
// (afiliado tem seu próprio mutex, então paralelizar até 2 Chromiums
// num EasyPanel pequeno seria suicídio de memória).
let listingMutex = Promise.resolve();
function withListingMutex(fn) {
  const next = listingMutex.then(fn, fn);
  listingMutex = next.catch(() => {});
  return next;
}

/**
 * Faz scraping via fetch puro (HTML estático).
 * Funciona pra todas as URLs do tipo mercadolivre.com.br/ofertas?container_id=X
 */
export async function fetchListingHtml(url) {
  const ua = pickUA();
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetch listing (UA: ${ua.slice(0, 50)})`);
  }
  const finalUrl = res.url;
  // Se redirecionou pra account-verification, sinaliza pra usar Playwright
  if (finalUrl.includes('/gz/account-verification') || finalUrl.includes('/gz/login')) {
    throw new Error('REQUIRES_PLAYWRIGHT');
  }
  return await res.text();
}

/**
 * Faz scraping via Playwright headless (Chromium real).
 * Necessário pra URLs lista.mercadolivre.com.br/_Container_X
 * que exigem fingerprint válido (cookies, JS execution).
 */
export async function fetchListingViaPlaywright(url) {
  return withListingMutex(async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: chromiumExecutable(),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
      userAgent: pickUA(),
      viewport: { width: 1280, height: 800 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      // Aguarda os cards renderizarem (até 8s)
      await page.waitForSelector('div.andes-card.poly-card', { timeout: 8_000 }).catch(() => {});
      // Pequena espera pra terminar lazy-loading de imagens
      await delay(800, 1500);
      const html = await page.content();
      return html;
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  });
}

/**
 * Parser unificado — mesma lógica do scraper.js, mas exportada aqui pra reuso.
 * (Idealmente seria movido pra um arquivo só. Por ora dup minimal.)
 */
export function parseListingHtml(html) {
  const $ = cheerio.load(html);
  const offers = [];
  const seen = new Set();
  const cards = $('div.andes-card.poly-card');

  cards.each((_, el) => {
    const $el = $(el);
    let titleAnchor = $el.find('a.poly-component__title').first();
    if (!titleAnchor.length) titleAnchor = $el.find('h3.poly-component__title-wrapper a').first();
    const title = titleAnchor.text().trim();
    let permalink = (titleAnchor.attr('href') ?? '').split('#')[0];
    if (!title || !permalink) return;

    const productId = extractProductId(permalink);
    if (!productId || seen.has(productId)) return;
    seen.add(productId);

    const img = $el.find('img.poly-component__picture').first();
    const image = img.attr('data-src') ?? img.attr('src') ?? '';

    const $current = $el.find('div.poly-price__current').first();
    const curReais = parseInt(($current.find('span.andes-money-amount__fraction').first().text() || '0').replace(/\./g, ''), 10);
    const curCents = parseInt($current.find('span.andes-money-amount__cents').first().text() || '0', 10);
    const price = isNaN(curReais) || curReais === 0 ? null : curReais + (curCents / 100);

    const $orig = $el.find('s.andes-money-amount--previous').first();
    let originalPrice = null;
    if ($orig.length) {
      const origReais = parseInt(($orig.find('span.andes-money-amount__fraction').first().text() || '0').replace(/\./g, ''), 10);
      const origCents = parseInt($orig.find('span.andes-money-amount__cents').first().text() || '0', 10);
      if (!isNaN(origReais) && origReais > 0) originalPrice = origReais + (origCents / 100);
    }
    const discountPercent = originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

    const freeShipping = $el.find('div.poly-component__shipping').text().includes('Frete grátis');
    const highlight = $el.find('span.poly-component__highlight').first().text().trim() || null;
    const coupon = ($el.find('span.poly-coupons__pill, .poly-coupons span').first().text().trim()
                  || $el.text().match(/Cupom[^,\n]{0,30}/i)?.[0]?.trim() || null);

    if (price == null) return;

    offers.push({
      productId, title, price, originalPrice, discountPercent,
      currency: 'BRL',
      permalink,
      image,
      condition: null,
      freeShipping,
      soldQuantity: 0,
      highlight,
      coupon,
    });
  });

  return offers;
}

function extractProductId(url) {
  if (!url) return null;
  let m = url.match(/\/p\/(MLB\d+)/i);
  if (m) return m[1];
  m = url.match(/\/(MLB-?\d+)/i);
  if (m) return m[1].replace('-', '');
  return null;
}

/**
 * Scraping unificado: tenta fetch primeiro, cai pra Playwright se source.method
 * for 'playwright' OU se fetch redirecionar pra account-verification.
 */
export async function scrapeUrl(url, method = 'fetch') {
  let html;
  if (method === 'fetch') {
    try {
      html = await fetchListingHtml(url);
    } catch (e) {
      if (e.message === 'REQUIRES_PLAYWRIGHT') {
        log.debug('fetch caiu em account-verification, tentando Playwright', { url: url.slice(0, 80) });
        html = await fetchListingViaPlaywright(url);
      } else {
        throw e;
      }
    }
  } else {
    html = await fetchListingViaPlaywright(url);
  }
  return parseListingHtml(html);
}
