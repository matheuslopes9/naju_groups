/**
 * Scraper light da página pública mercadolivre.com.br/ofertas.
 *
 * Por que scraping em vez de API:
 *   Desde abril/2025, ML bloqueou /sites/MLB/search publicamente.
 *   A página /ofertas é HTML estático (SSR), sem anti-bot, e fica acessível
 *   pra qualquer requisição com User-Agent de navegador.
 *
 * Cuidados (riscos calculados):
 *   - Volume baixo: 1 página por categoria, 1x por hora máximo
 *   - User-Agent rotativo (lista pequena, suficiente pra não levantar flag)
 *   - Delay aleatório 2-5s entre fetches
 *   - NÃO segue paginação infinita (1 página de 54 cards é suficiente)
 *
 * Limitação: a página /ofertas não filtra por % desconto via URL.
 * Aplica o filtro local (filtro pós-fetch).
 */
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.mercadolivre.com.br';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function delay(min = 2000, max = 5000) {
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Mapeia categoria do nosso sistema → subpath de /ofertas no ML.
 * Quando não há subpath específico, scraping da /ofertas geral.
 */
const CATEGORY_TO_PATH = {
  MLB1246: 'beleza-e-cuidados-pessoais', // Beleza
  MLB1430: 'moda',                        // Calçados, Roupas e Bolsas
  MLB1574: 'casa-decoracao',              // Casa
  MLB1000: 'eletronicos-audio-video',     // Eletrônicos
  MLB1051: 'celulares-telefones',         // Celulares
  MLB1648: 'informatica',                 // Informática
  MLB5726: 'eletrodomesticos',            // Eletrodomésticos
  MLB1132: 'brinquedos-hobbies',          // Brinquedos
  MLB1384: 'bebes',                       // Bebês
  MLB264586: 'saude',                     // Saúde
  MLB1276: 'esportes-fitness',            // Esportes
  MLB1144: 'games',                       // Games
  MLB1403: 'alimentos-bebidas',           // Alimentos
  MLB1071: 'animais',                     // Animais
  MLB263532: 'ferramentas',               // Ferramentas
  MLB1500: 'construcao',                  // Construção
  // demais → /ofertas geral
};

/**
 * Faz scraping de uma única página de ofertas (até 54 produtos).
 */
export async function scrapeOffers(categoryId) {
  const subpath = CATEGORY_TO_PATH[categoryId];
  const url = subpath ? `${BASE_URL}/ofertas/${subpath}` : `${BASE_URL}/ofertas`;

  await delay(1000, 3000); // jitter inicial

  const res = await fetch(url, {
    headers: {
      'User-Agent': pickUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`Scrape /ofertas HTTP ${res.status}`);
  }
  const html = await res.text();
  return parseOffersPage(html);
}

function parseOffersPage(html) {
  const $ = cheerio.load(html);
  const offers = [];

  $('div.andes-card.poly-card.poly-card--grid-card').each((_, el) => {
    const $el = $(el);

    const titleAnchor = $el.find('h3.poly-component__title-wrapper a.poly-component__title').first();
    const title = titleAnchor.text().trim();
    let permalink = titleAnchor.attr('href') ?? '';
    permalink = permalink.split('#')[0]; // remove tracking

    // ID do produto: extrai do permalink (formato .../MLB-XXXXXXX-... ou /p/MLBXXXXX)
    const productId = extractProductId(permalink);
    if (!title || !permalink || !productId) return;

    // Imagem (lazy ou src direto)
    const img = $el.find('img.poly-component__picture').first();
    const image = img.attr('data-src') ?? img.attr('src') ?? '';

    // Preço atual
    const $current = $el.find('div.poly-price__current').first();
    const curReais = parseInt($current.find('span.andes-money-amount__fraction').first().text().replace(/\./g, ''), 10);
    const curCents = parseInt($current.find('span.andes-money-amount__cents').first().text() || '0', 10);
    const price = isNaN(curReais) ? null : curReais + (curCents / 100);

    // Preço original (riscado)
    const $orig = $el.find('s.andes-money-amount--previous').first();
    let originalPrice = null;
    if ($orig.length) {
      const origReais = parseInt($orig.find('span.andes-money-amount__fraction').first().text().replace(/\./g, ''), 10);
      const origCents = parseInt($orig.find('span.andes-money-amount__cents').first().text() || '0', 10);
      if (!isNaN(origReais)) originalPrice = origReais + (origCents / 100);
    }

    const discountPercent = originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

    // Frete grátis
    const shippingText = $el.find('div.poly-component__shipping').text();
    const freeShipping = shippingText.includes('Frete grátis');

    if (price == null) return;

    offers.push({
      productId,
      title,
      price,
      originalPrice,
      discountPercent,
      currency: 'BRL',
      permalink,
      image,
      condition: null,
      freeShipping,
      soldQuantity: 0,
    });
  });

  return offers;
}

/**
 * Extrai o productId (MLB-XXXX) de um permalink.
 * Suporta /p/MLB12345 (PDP) e /MLB-12345 (legado).
 */
export function extractProductId(url) {
  if (!url) return null;
  // /p/MLB12345 (catalog PDP)
  let m = url.match(/\/p\/(MLB\d+)/i);
  if (m) return m[1];
  // /MLB-12345-... (item)
  m = url.match(/\/(MLB-?\d+)/i);
  if (m) return m[1].replace('-', '');
  return null;
}

/**
 * Carrega 1 produto individual via API ML (endpoint /items que continua acessível).
 * Usado pra "colar URL manual" — você cola um link, sistema extrai o item.
 */
export async function fetchItemByUrl(url) {
  const productId = extractProductId(url);
  if (!productId) {
    throw new Error('URL inválida — não consegui extrair o ID do produto');
  }
  // Tenta /items/$ID primeiro (item à venda)
  const res = await fetch(`https://api.mercadolibre.com/items/${productId}`, {
    headers: {
      'User-Agent': pickUA(),
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    // Fallback: faz scraping da própria página do produto pra extrair os mesmos campos
    return await fetchItemByScraping(url);
  }
  const item = await res.json();
  return {
    productId: item.id,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price,
    discountPercent: item.original_price && item.original_price > item.price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0,
    currency: item.currency_id,
    permalink: item.permalink,
    image: (item.thumbnail || '').replace('-I.jpg', '-O.jpg') || item.pictures?.[0]?.url || '',
    condition: item.condition,
    freeShipping: !!item.shipping?.free_shipping,
    soldQuantity: item.sold_quantity ?? 0,
  };
}

async function fetchItemByScraping(url) {
  await delay(1000, 2500);
  const res = await fetch(url, {
    headers: {
      'User-Agent': pickUA(),
      'Accept': 'text/html',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`Scrape produto HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('h1.ui-pdp-title').first().text().trim() ||
                $('meta[property="og:title"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  const priceText = $('meta[property="product:price:amount"]').attr('content');
  const price = priceText ? parseFloat(priceText) : null;
  const originalRaw = $('s.andes-money-amount--previous span.andes-money-amount__fraction').first().text();
  const originalPrice = originalRaw ? parseFloat(originalRaw.replace(/\./g, '')) : null;

  const productId = extractProductId(url);
  if (!title || price == null || !productId) {
    throw new Error('Não consegui extrair dados do produto (HTML mudou?)');
  }
  return {
    productId, title, price, originalPrice,
    discountPercent: originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    currency: 'BRL',
    permalink: url.split('#')[0],
    image,
    condition: null,
    freeShipping: false,
    soldQuantity: 0,
  };
}
