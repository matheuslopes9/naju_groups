const brl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatOffer(offer) {
  const lines = [];
  lines.push(`🔥 *${offer.title}*`);
  lines.push('');

  if (offer.originalPrice && offer.originalPrice > offer.price) {
    lines.push(`~${brl(offer.originalPrice)}~`);
  }
  lines.push(`💰 *${brl(offer.price)}*`);

  if (offer.discountPercent > 0) lines.push(`📉 ${offer.discountPercent}% OFF`);
  if (offer.freeShipping) lines.push('🚚 Frete grátis');
  if (offer.coupon) lines.push(`🎟️ ${offer.coupon}`);
  if (offer.highlight) lines.push(`✨ ${offer.highlight}`);
  if (offer.soldQuantity > 0) lines.push(`📦 ${offer.soldQuantity} vendidos`);

  lines.push('');
  lines.push(`🛒 ${offer.affiliateUrl ?? offer.permalink}`);
  lines.push('');
  lines.push('_#publi · oferta sujeita a alteração sem aviso prévio_');
  return lines.join('\n');
}
