import {
  pickHook,
  pickCloser,
  pickPriceOpener,
  pickPriceNow,
  audienceToNicheFallback,
} from './copy.js';

const brl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function resolveNiche(opts, offer) {
  return (
    opts.nicheId ??
    offer.nicheId ??
    audienceToNicheFallback(opts.audience ?? offer.audience ?? 'unisex')
  );
}

/**
 * Estilo COMPACTO: foco no benefício, frase curta, fácil de scanear.
 * Imagem da oferta vai como anexo separado no WhatsApp.
 */
function formatCompact(offer, nicheId) {
  const hook = pickHook(offer, nicheId);
  const opener = pickPriceOpener(offer);
  const now = pickPriceNow(offer);
  const closer = pickCloser(offer, nicheId);

  const lines = [];
  lines.push(hook);
  lines.push('');
  lines.push(`*${offer.title}*`);
  lines.push('');
  if (offer.originalPrice && offer.originalPrice > offer.price) {
    lines.push(`${opener} ~${brl(offer.originalPrice)}~ ${now} *${brl(offer.price)}* 💰`);
  } else {
    lines.push(`💰 *${brl(offer.price)}*`);
  }
  if (offer.discountPercent > 0) lines.push(`📉 *${offer.discountPercent}% OFF*`);
  if (offer.freeShipping) lines.push('🚚 Frete grátis');
  if (offer.coupon) lines.push(`🎟️ ${offer.coupon}`);
  if (offer.highlight) lines.push(`✨ ${offer.highlight}`);
  lines.push('');
  lines.push(`🛒 ${offer.affiliateUrl ?? offer.permalink}`);
  lines.push('');
  lines.push(`_${closer}_`);
  lines.push('_⚠️ Preço pode mudar a qualquer momento!_');

  return lines.join('\n');
}

/**
 * Estilo RICH: mais elaborado, com bullets, urgência e social proof.
 */
function formatRich(offer, nicheId) {
  const hook = pickHook(offer, nicheId);
  const closer = pickCloser(offer, nicheId);

  const benefits = [];
  if (offer.freeShipping) benefits.push('🚚 *Frete grátis*');
  if (offer.coupon) benefits.push(`🎟️ *${offer.coupon}*`);
  if (offer.highlight) benefits.push(`✨ ${offer.highlight}`);
  if (offer.soldQuantity > 100) benefits.push(`🔥 *${offer.soldQuantity}+ pessoas já compraram*`);

  const lines = [];
  lines.push(`${hook}`);
  lines.push('');
  lines.push(`*${offer.title}*`);
  lines.push('');

  if (offer.originalPrice && offer.originalPrice > offer.price) {
    lines.push(`💸 ~De ${brl(offer.originalPrice)}~`);
    lines.push(`💰 *Por ${brl(offer.price)}*  ${offer.discountPercent > 0 ? `(${offer.discountPercent}% OFF)` : ''}`);
  } else {
    lines.push(`💰 *${brl(offer.price)}*`);
  }

  if (benefits.length > 0) {
    lines.push('');
    benefits.forEach((b) => lines.push(b));
  }

  lines.push('');
  lines.push(`🛒 ${offer.affiliateUrl ?? offer.permalink}`);
  lines.push('');
  lines.push(`_${closer}_`);
  lines.push('_⚠️ Preço pode mudar a qualquer momento!_');

  return lines.join('\n');
}

export function formatOffer(offer, opts = {}) {
  const style = opts.style ?? offer.adStyle ?? 'compact';
  const nicheId = resolveNiche(opts, offer);
  if (style === 'rich') return formatRich(offer, nicheId);
  return formatCompact(offer, nicheId);
}
