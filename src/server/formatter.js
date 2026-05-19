const brl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Pick aleatório com seed pseudo-aleatório por productId pra evitar repetição
 * de templates pra mesma oferta (idempotente).
 */
function pickFrom(arr, seed = '') {
  if (!arr || arr.length === 0) return '';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(hash + Math.floor(Math.random() * 100)) % arr.length;
  return arr[idx];
}

/**
 * Frases de conexão (chamadas no início do anúncio).
 * Variam conforme audience pra não soar genérico.
 */
const HOOKS = {
  female: [
    'MAIS UM 💅', 'OLHA QUE LUXO 💖', 'CORRE QUE É IMPERDÍVEL 🏃‍♀️',
    'TÔ DOIDA POR ISSO 😍', 'NÃO DEIXA ESCAPAR 💸', 'PRA VOCÊ SE AMAR MAIS 💕',
    'GASTE COM VOCÊ 💝', 'INVISTA EM VOCÊ ✨', 'PROMOÇÃO IRRESISTÍVEL 🔥',
  ],
  male: [
    'MAIS UM 👊', 'TÔ VENDO QUE TÁ BOM 🤝', 'PEGA ENQUANTO TÁ 🎯',
    'CORRE QUE É IMPERDÍVEL 🏃', 'GASTOU CERTO 💸', 'NÃO PERDE TEMPO ⏱️',
    'PROMOÇÃO RELÂMPAGO ⚡', 'NA REAL VALE A PENA 👀',
  ],
  unisex: [
    'MAIS UM 👇', 'OLHA SÓ ESSA 👀', 'CORRE QUE É IMPERDÍVEL 🏃',
    'PROMOÇÃO RELÂMPAGO ⚡', 'NÃO DEIXA ESCAPAR 💸', 'OFERTA QUENTE 🔥',
    'PEGA ENQUANTO TÁ NESSE PREÇO 🎯', 'BAIXOU MUITO 📉',
  ],
};

/**
 * Variações da linha de preço — adiciona personalidade.
 */
const PRICE_OPENERS = ['De', '~De~', 'Era', 'Saiu de'];
const PRICE_NOW = ['por', 'agora por', 'só', 'apenas', 'sai por'];

/**
 * Closers — frases de chamada à ação ou conexão.
 */
const CLOSERS = {
  female: [
    'Aproveite enquanto tem 💕',
    'Você merece! ✨',
    'Garanta o seu antes que acabe 💖',
    'Promoção tem hora 🕐',
  ],
  male: [
    'Aproveita que tá bom 👌',
    'Foi mal demorar pra avisar 😅',
    'Vai escapar? 👀',
    'Garante logo 🎯',
  ],
  unisex: [
    'Aproveite enquanto dura ⏰',
    'Não fica pra amanhã 🚀',
    'Compra esperta 💡',
    'Garanta antes de subir 📈',
  ],
};

/**
 * Estilo COMPACTO: foco no benefício, frase curta, fácil de scanear.
 * Imagem da oferta vai como anexo separado no WhatsApp.
 */
function formatCompact(offer, audience = 'unisex') {
  const seed = offer.productId ?? offer.title ?? '';
  const hook = pickFrom(HOOKS[audience] ?? HOOKS.unisex, seed);
  const opener = pickFrom(PRICE_OPENERS, seed + 'o');
  const now = pickFrom(PRICE_NOW, seed + 'n');
  const closer = pickFrom(CLOSERS[audience] ?? CLOSERS.unisex, seed + 'c');

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
  lines.push('_#publi · oferta sujeita a alteração_');

  return lines.join('\n');
}

/**
 * Estilo RICH: mais elaborado, com bullets, urgência e social proof.
 */
function formatRich(offer, audience = 'unisex') {
  const seed = offer.productId ?? offer.title ?? '';
  const hook = pickFrom(HOOKS[audience] ?? HOOKS.unisex, seed);
  const closer = pickFrom(CLOSERS[audience] ?? CLOSERS.unisex, seed + 'c');

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
  lines.push('_#publi · preço pode mudar a qualquer momento_');

  return lines.join('\n');
}

export function formatOffer(offer, opts = {}) {
  const style = opts.style ?? offer.adStyle ?? 'compact';
  const audience = opts.audience ?? offer.audience ?? 'unisex';
  if (style === 'rich') return formatRich(offer, audience);
  return formatCompact(offer, audience);
}
