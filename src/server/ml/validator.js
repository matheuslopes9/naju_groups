/**
 * Validador de ofertas antes do envio.
 *
 * Pega a permalink do produto, busca a página atual e compara com os dados
 * gravados em Offer. Decide se ainda vale enviar.
 *
 * Critérios (acordados com usuário, modo "mais rígido"):
 *   1. Página deve carregar (HTTP 200, sem redirect pra /noindex etc)
 *   2. Não pode indicar "indisponível" / "sem estoque"
 *   3. Preço atual NÃO pode estar > 5% acima do preço gravado
 *      (tolera flutuação pequena, bloqueia subida real)
 *   4. Se a oferta tinha originalPrice (era promo): preço atual ainda precisa
 *      estar < originalPrice (perdeu desconto = não é mais promo)
 *
 * Fail-safe: se a validação em si falha (timeout, HTTP 500, parser quebra),
 * retorna { valid: true, reason: 'validation_error', ... } pra não bloquear
 * o envio. ML/rede instável não deve impedir mensagens válidas.
 *
 * Custo: 1 HTTP fetch + parse cheerio (~300-800ms). Aceitável pra 5min de
 * intervalo entre envios.
 */
import * as cheerio from 'cheerio';
import { createLogger } from '../logger.js';

const log = createLogger('validator');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Tolerância pra flutuação de preço (5%): preço atual <= recorded * 1.05
const PRICE_TOLERANCE = 0.05;

/**
 * Valida uma Offer antes do envio.
 * @param {object} offer - row da tabela Offer (precisa de permalink, price, originalPrice)
 * @returns {Promise<{ valid: boolean, reason: string, currentPrice?: number, currentOriginalPrice?: number }>}
 */
export async function validateOffer(offer) {
  const startedAt = Date.now();
  if (!offer?.permalink) {
    return { valid: false, reason: 'no_permalink' };
  }

  try {
    const res = await fetch(offer.permalink, {
      headers: {
        'User-Agent': pickUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    // 1. HTTP status
    if (res.status === 404 || res.status === 410) {
      log.info('oferta removida (404/410)', { productId: offer.productId, status: res.status });
      return { valid: false, reason: 'http_not_found' };
    }
    if (!res.ok) {
      // Erro genérico — fail-safe (assume válida)
      log.warn('validator: HTTP não-ok, assumindo válida', { productId: offer.productId, status: res.status });
      return { valid: true, reason: 'validation_error', error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 2. Indisponibilidade — ML usa textos específicos
    const lowerHtml = html.toLowerCase();
    if (
      lowerHtml.includes('publicação pausada') ||
      lowerHtml.includes('publicacao pausada') ||
      lowerHtml.includes('item indisponível') ||
      lowerHtml.includes('item indisponivel') ||
      lowerHtml.includes('produto sem estoque') ||
      lowerHtml.includes('sem estoque') ||
      $('.ui-pdp-stock-information--unavailable').length > 0 ||
      $('.andes-message--accent').text().toLowerCase().includes('indisponí')
    ) {
      log.info('oferta indisponível', { productId: offer.productId });
      return { valid: false, reason: 'unavailable' };
    }

    // 3. Preço atual — meta tag é a fonte mais confiável
    const priceText = $('meta[property="product:price:amount"]').attr('content')
                   ?? $('meta[itemprop="price"]').attr('content');
    const currentPrice = priceText ? parseFloat(priceText) : null;

    if (currentPrice == null || isNaN(currentPrice) || currentPrice <= 0) {
      // Parser não pegou preço — pode ter mudado markup. Fail-safe.
      log.warn('validator: preço não extraído, assumindo válida', { productId: offer.productId });
      return { valid: true, reason: 'validation_error', error: 'no_price_extracted' };
    }

    // 4. Preço subiu além da tolerância
    const recordedPrice = offer.price;
    const maxAllowed = recordedPrice * (1 + PRICE_TOLERANCE);
    if (currentPrice > maxAllowed) {
      log.info('preço subiu além da tolerância', {
        productId: offer.productId,
        recorded: recordedPrice,
        current: currentPrice,
        maxAllowed: maxAllowed.toFixed(2),
      });
      return { valid: false, reason: 'price_rose', currentPrice, recordedPrice };
    }

    // 5. Se era promo (tinha originalPrice gravado), preço atual deve estar
    // abaixo desse originalPrice — senão promo acabou.
    if (offer.originalPrice && offer.originalPrice > 0) {
      // Busca preço original atual da página (riscado)
      const origRaw = $('s.andes-money-amount--previous span.andes-money-amount__fraction').first().text();
      const currentOriginalPrice = origRaw ? parseFloat(origRaw.replace(/\./g, '')) : null;

      // Se não tem mais preço riscado E o preço atual >= original gravado → promo acabou
      if (currentOriginalPrice == null && currentPrice >= offer.originalPrice * 0.95) {
        log.info('promoção encerrada (sem mais preço riscado)', {
          productId: offer.productId,
          recordedOriginal: offer.originalPrice,
          current: currentPrice,
        });
        return { valid: false, reason: 'promo_ended', currentPrice };
      }
    }

    log.debug('oferta válida', {
      productId: offer.productId,
      currentPrice,
      ms: Date.now() - startedAt,
    });
    return { valid: true, reason: 'ok', currentPrice };
  } catch (e) {
    // Fail-safe: erro durante validação não bloqueia envio
    log.warn('validator: erro, assumindo válida', {
      productId: offer.productId,
      error: e.message,
      ms: Date.now() - startedAt,
    });
    return { valid: true, reason: 'validation_error', error: e.message };
  }
}
