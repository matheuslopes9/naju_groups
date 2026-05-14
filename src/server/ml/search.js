/**
 * Cliente da API de busca do Mercado Livre.
 *
 * A API do ML é caprichosa com /sites/MLB/search:
 *  - A doc fala que é endpoint PÚBLICO (sem auth)
 *  - Mas na prática, alguns IPs/condições retornam 403 sem Bearer
 *  - Alguns retornam 403 COM Bearer ("policy via cloudfront")
 *  - O User-Agent influencia (alguns são bloqueados)
 *
 * Estratégia: tentar variantes em ordem e parar na primeira que funciona.
 * Cacheia qual variante funcionou pra evitar tentar todas toda vez.
 */
import { getAccessToken } from './oauth.js';

const ML_API = 'https://api.mercadolibre.com';
const SITE_ID = 'MLB';

// User-Agents na ordem de fallback
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const APP_UA = 'NajuGroups/0.2';

// Cache da última variante que funcionou
let preferredVariant = null;

/**
 * Variantes na ordem de preferência:
 *  1. Bearer + User-Agent de app (jeito "padrão")
 *  2. Bearer + User-Agent de browser
 *  3. Sem Bearer + User-Agent de browser (endpoint público)
 *  4. Sem Bearer + User-Agent de app
 */
async function getVariants() {
  let token = null;
  try { token = await getAccessToken(); } catch { /* sem token, só endpoints públicos */ }

  const variants = [];
  if (token) {
    variants.push({
      name: 'bearer+app',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': APP_UA },
    });
    variants.push({
      name: 'bearer+browser',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': BROWSER_UA },
    });
  }
  variants.push({
    name: 'public+browser',
    headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
  });
  variants.push({
    name: 'public+app',
    headers: { Accept: 'application/json', 'User-Agent': APP_UA },
  });

  return variants;
}

async function fetchWithVariants(url) {
  const variants = await getVariants();

  // Tenta primeiro a que funcionou antes (se houver)
  const ordered = preferredVariant
    ? [
        variants.find((v) => v.name === preferredVariant) ?? variants[0],
        ...variants.filter((v) => v.name !== preferredVariant),
      ]
    : variants;

  const errors = [];
  for (const v of ordered) {
    const res = await fetch(url, { headers: v.headers });
    if (res.ok) {
      if (preferredVariant !== v.name) {
        console.log(`✓ ML search funcionou com variante: ${v.name}`);
        preferredVariant = v.name;
      }
      return res;
    }
    const body = await res.text().catch(() => '');
    errors.push({ variant: v.name, status: res.status, body: body.slice(0, 200) });
    // Se 4xx específico que não vale tentar outra variante, para
    if (res.status === 400 || res.status === 404 || res.status === 422) {
      throw new Error(`ML search HTTP ${res.status} — ${body.slice(0, 300)}`);
    }
  }
  // Esgotou tudo
  const summary = errors.map((e) => `${e.variant}:${e.status}`).join(' | ');
  const detail = errors.map((e) => `${e.variant} → ${e.status} ${e.body}`).join('\n');
  throw new Error(`ML search falhou em todas as variantes (${summary})\n${detail}`);
}

export async function searchOffers(opts = {}) {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.category) params.set('category', opts.category);
  if (opts.freeShipping) params.set('shipping', 'free');
  if (opts.deal) params.set('DEAL', 'true');
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.condition) params.set('condition', opts.condition);
  params.set('limit', String(opts.limit ?? 50));
  params.set('offset', String(opts.offset ?? 0));

  const url = `${ML_API}/sites/${SITE_ID}/search?${params.toString()}`;
  const res = await fetchWithVariants(url);
  const data = await res.json();
  if (!Array.isArray(data.results)) return [];
  return data.results.map(normalizeProduct);
}

/**
 * Diagnóstico: tenta cada variante separadamente e devolve o resultado de
 * cada uma — útil pra o botão "Testar conexão".
 */
export async function diagnoseSearch() {
  const url = `${ML_API}/sites/${SITE_ID}/search?q=fone&limit=1`;
  const variants = await getVariants();
  const out = [];
  for (const v of variants) {
    try {
      const res = await fetch(url, { headers: v.headers });
      const body = await res.text();
      out.push({
        variant: v.name,
        status: res.status,
        ok: res.ok,
        body: body.slice(0, 400),
      });
    } catch (e) {
      out.push({ variant: v.name, error: e.message });
    }
  }
  return out;
}

export async function pingUsersMe() {
  const token = await getAccessToken();
  const res = await fetch(`${ML_API}/users/me`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': APP_UA },
  });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body: body.slice(0, 1000) };
}

export async function pingSearchMinimal() {
  const url = `${ML_API}/sites/${SITE_ID}/search?q=fone&limit=1`;
  try {
    const res = await fetchWithVariants(url);
    const body = await res.text();
    return { status: res.status, ok: res.ok, body: body.slice(0, 1000), variant: preferredVariant };
  } catch (e) {
    return { status: 0, ok: false, body: e.message };
  }
}

function normalizeProduct(p) {
  const original = p.original_price ?? null;
  const discount = original && original > p.price
    ? Math.round(((original - p.price) / original) * 100)
    : 0;
  const image = (p.thumbnail || '').replace('-I.jpg', '-O.jpg');
  return {
    productId: p.id,
    title: p.title,
    price: p.price,
    originalPrice: original,
    discountPercent: discount,
    currency: p.currency_id,
    permalink: p.permalink,
    image,
    condition: p.condition,
    freeShipping: !!p.shipping?.free_shipping,
    soldQuantity: p.sold_quantity ?? 0,
  };
}
