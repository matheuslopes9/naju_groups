import { getAccessToken } from './oauth.js';

const ML_API = 'https://api.mercadolibre.com';
const SITE_ID = 'MLB';

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

  const token = await getAccessToken();
  const url = `${ML_API}/sites/${SITE_ID}/search?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'NajuGroups/0.2',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const reqInfo = `URL=${url}`;
    const tokenInfo = `tokenLen=${token?.length ?? 0} tokenPrefix=${token?.slice(0, 8) ?? '—'}…`;
    throw new Error(`ML search HTTP ${res.status} — ${body.slice(0, 400)} | ${reqInfo} | ${tokenInfo}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.results)) return [];
  return data.results.map(normalizeProduct);
}

/**
 * Faz uma chamada simples a /users/me — canonical endpoint que confirma
 * se o token está válido. Útil pra diagnóstico isolando o problema.
 */
export async function pingUsersMe() {
  const token = await getAccessToken();
  const res = await fetch(`${ML_API}/users/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'NajuGroups/0.2',
    },
  });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body: body.slice(0, 1000) };
}

/**
 * Testa busca minimalista — só ?q= e ?limit=, sem deal/shipping/etc.
 * Pra isolar se o problema é com algum parâmetro específico.
 */
export async function pingSearchMinimal() {
  const token = await getAccessToken();
  const url = `${ML_API}/sites/${SITE_ID}/search?q=fone&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'NajuGroups/0.2',
    },
  });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body: body.slice(0, 1000), url };
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
