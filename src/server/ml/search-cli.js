import 'dotenv/config';
import { searchOffers } from './search.js';
import { attachAffiliateTag } from './affiliate.js';

const query = process.argv.slice(2).join(' ') || 'fone bluetooth';
const minDiscount = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);

console.log(`\n🔍 "${query}" desconto>=${minDiscount}%\n`);

const offers = await searchOffers({
  q: query,
  freeShipping: process.env.ONLY_FREE_SHIPPING !== 'false',
  deal: process.env.ONLY_DEALS !== 'false',
  sort: 'price_asc',
  limit: 50,
});

const filtered = offers.filter((o) => o.discountPercent >= minDiscount);
console.log(`Total: ${offers.length} | passou filtro: ${filtered.length}\n`);

for (const o of filtered.slice(0, 10)) {
  const link = attachAffiliateTag(o.permalink, process.env.ML_AFFILIATE_TAG);
  console.log(`📦 ${o.title.slice(0, 70)}`);
  console.log(`   💰 R$ ${o.price.toFixed(2)}  (-${o.discountPercent}%)  ${o.freeShipping ? '🚚' : ''}`);
  console.log(`   🔗 ${link}\n`);
}
process.exit(0);
