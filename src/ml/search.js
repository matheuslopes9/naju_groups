/**
 * Cliente da API de busca do Mercado Livre.
 * GET https://api.mercadolibre.com/sites/MLB/search
 *
 * REQUER access_token (a partir de 2024 o ML aplica PolicyAgent
 * que retorna 403 em chamadas anônimas).
 */
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
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ML search HTTP ${res.status} — ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.results)) return [];
  return data.results.map(normalizeProduct);
}

function normalizeProduct(p) {
  const original = p.original_price ?? null;
  const discount = original && original > p.price
    ? Math.round(((original - p.price) / original) * 100)
    : 0;
  const image = (p.thumbnail || '').replace('-I.jpg', '-O.jpg');

  return {
    id: p.id,
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
    availableQuantity: p.available_quantity ?? null,
  };
}
