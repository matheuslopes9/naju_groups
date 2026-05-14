/**
 * Cliente da API de busca do Mercado Livre.
 *
 * Endpoint: GET /sites/MLB/search?category=$ID
 * Funciona sem seller_id quando category é passado.
 * Aceita filtros nativos: shipping_cost, sort, condition, price.
 */
import { getAccessToken } from './oauth.js';

const ML_API = 'https://api.mercadolibre.com';
const SITE_ID = 'MLB';
const APP_UA = 'NajuGroups/0.2';

async function mlFetch(path, opts = {}) {
  const token = await getAccessToken();
  const url = `${ML_API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': APP_UA,
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`ML ${path} HTTP ${res.status} — ${body.slice(0, 400)}`);
  }
  try { return JSON.parse(body); }
  catch { return body; }
}

/**
 * Busca anúncios em uma categoria.
 * Doc: GET /sites/MLB/search?category=$ID&shipping_cost=free&sort=price_asc
 */
export async function searchOffersByCategory(categoryId, opts = {}) {
  const params = new URLSearchParams();
  params.set('category', String(categoryId));
  if (opts.freeShipping) params.set('shipping_cost', 'free');
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.condition) params.set('condition', opts.condition);
  if (opts.priceMin) params.set('price', `${opts.priceMin}-${opts.priceMax ?? '*'}`);
  params.set('limit', String(opts.limit ?? 50));
  params.set('offset', String(opts.offset ?? 0));

  const data = await mlFetch(`/sites/${SITE_ID}/search?${params.toString()}`);
  if (!Array.isArray(data.results)) return [];
  return data.results.map(normalizeProduct);
}

export async function pingUsersMe() {
  try {
    const data = await mlFetch('/users/me');
    return { status: 200, ok: true, body: JSON.stringify(data).slice(0, 1000) };
  } catch (e) {
    const m = e.message.match(/HTTP (\d+)/);
    return { status: m ? Number(m[1]) : 0, ok: false, body: e.message.slice(0, 1000) };
  }
}

export async function pingSearchMinimal() {
  // Testa /sites/MLB/search?category=MLB1246 (Beleza, conhecidamente popular)
  try {
    const data = await mlFetch(`/sites/${SITE_ID}/search?category=MLB1246&limit=1`);
    return {
      status: 200,
      ok: true,
      body: `total=${data.paging?.total ?? '?'} categoria MLB1246 (Beleza) → ${data.results?.[0]?.title ?? '—'}`,
    };
  } catch (e) {
    const m = e.message.match(/HTTP (\d+)/);
    return { status: m ? Number(m[1]) : 0, ok: false, body: e.message.slice(0, 1000) };
  }
}

export async function diagnoseSearch() {
  const tests = [
    { name: '/users/me', path: '/users/me' },
    { name: '/sites/MLB', path: `/sites/${SITE_ID}` },
    { name: '/sites/MLB/search?category=MLB1246&limit=1', path: `/sites/${SITE_ID}/search?category=MLB1246&limit=1` },
  ];
  const out = [];
  for (const t of tests) {
    try {
      await mlFetch(t.path);
      out.push({ variant: t.name, status: 200, ok: true });
    } catch (e) {
      const m = e.message.match(/HTTP (\d+)/);
      out.push({ variant: t.name, status: m ? Number(m[1]) : 0, ok: false, body: e.message.slice(0, 300) });
    }
  }
  return out;
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
