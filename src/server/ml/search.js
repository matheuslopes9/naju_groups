/**
 * Cliente da API de busca do Mercado Livre.
 *
 * IMPORTANTE: o endpoint /sites/$SITE/search NÃO aceita ?q=palavra na doc oficial.
 * Aceita SOMENTE ?seller_id=... (busca itens de um vendedor) ou ?nickname=...
 *
 * Estratégia desta plataforma:
 *  1. Por workspace, cadastrar sellers (via nickname → lookup → seller_id)
 *  2. Buscar anúncios de cada seller cadastrado com filtros nativos
 *  3. Filtrar por % desconto na nossa camada
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
 * Lookup de seller por nickname.
 * Usa /sites/MLB/search?nickname=X e extrai o seller.id do primeiro resultado.
 *
 * Doc: https://api.mercadolibre.com/sites/MLB/search?nickname=$NICKNAME
 * Retorna { seller_id, nickname, totalListings } ou lança erro se não achar.
 */
export async function lookupSellerByNickname(nickname) {
  const clean = String(nickname).trim().replace(/^@/, '');
  if (!clean) throw new Error('Nickname vazio');
  const data = await mlFetch(`/sites/${SITE_ID}/search?nickname=${encodeURIComponent(clean)}&limit=1`);
  const first = data.results?.[0];
  if (!first?.seller?.id) {
    throw new Error(`Seller "${clean}" não encontrado no Mercado Livre`);
  }
  return {
    sellerId: String(first.seller.id),
    nickname: first.seller.nickname ?? clean,
    totalListings: data.paging?.total ?? 0,
  };
}

/**
 * Busca anúncios de um seller específico.
 * Doc: GET /sites/MLB/search?seller_id=...&sort=price_asc&shipping_cost=free
 */
export async function searchOffersBySeller(sellerId, opts = {}) {
  const params = new URLSearchParams();
  params.set('seller_id', String(sellerId));
  if (opts.category) params.set('category', opts.category);
  if (opts.freeShipping) params.set('shipping_cost', 'free');
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.condition) params.set('condition', opts.condition);
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
  // Testa busca por seller (precisa de um seller real)
  // Como diagnose, usa o nickname do usuário autenticado.
  try {
    const me = await mlFetch('/users/me');
    const sellerId = me.id;
    const data = await mlFetch(`/sites/${SITE_ID}/search?seller_id=${sellerId}&limit=1`);
    return {
      status: 200,
      ok: true,
      body: `total=${data.paging?.total ?? '?'} seller_id=${sellerId} (sua própria conta)`,
    };
  } catch (e) {
    const m = e.message.match(/HTTP (\d+)/);
    return { status: m ? Number(m[1]) : 0, ok: false, body: e.message.slice(0, 1000) };
  }
}

export async function diagnoseSearch() {
  // Lista quais endpoints respondem corretamente
  const tests = [
    { name: '/users/me', path: '/users/me' },
    { name: '/sites/MLB (info)', path: `/sites/${SITE_ID}` },
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
