const brl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Monta a mensagem de "cartão de revisão" pro grupo de staging.
 * Inclui aviso ⚠️ #publi conforme CONAR (exigência dos Termos ML Afiliados, 5.1).
 */
export function formatOffer(offer) {
  const lines = [];
  lines.push(`🔥 *${offer.title}*`);
  lines.push('');

  if (offer.originalPrice && offer.originalPrice > offer.price) {
    lines.push(`~${brl(offer.originalPrice)}~`);
  }
  lines.push(`💰 *${brl(offer.price)}*`);

  if (offer.discountPercent > 0) {
    lines.push(`📉 ${offer.discountPercent}% OFF`);
  }
  if (offer.freeShipping) {
    lines.push('🚚 Frete grátis');
  }
  if (offer.soldQuantity > 0) {
    lines.push(`📦 ${offer.soldQuantity} vendidos`);
  }

  lines.push('');
  lines.push(`🛒 ${offer.affiliateUrl ?? offer.permalink}`);
  lines.push('');
  lines.push('_#publi · oferta sujeita a alteração sem aviso prévio_');

  return lines.join('\n');
}

/**
 * Cartão de revisão (staging) — inclui metadados pra você decidir se posta ou não.
 */
export function formatReviewCard(offer) {
  const base = formatOffer(offer);
  const meta = [
    `\n———`,
    `🆔 ${offer.id}`,
    offer.condition ? `📋 ${offer.condition}` : null,
  ].filter(Boolean).join('\n');
  return base + meta;
}
