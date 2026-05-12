import 'dotenv/config';
import { startWhatsApp } from './whatsapp/client.js';
import { searchOffers } from './ml/search.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { formatReviewCard } from './formatter.js';

const {
  WA_STAGING_GROUP_JID,
  ML_AFFILIATE_TAG,
  SEARCH_QUERY = 'fone bluetooth',
  MIN_DISCOUNT_PERCENT = '20',
  ONLY_FREE_SHIPPING = 'true',
  ONLY_DEALS = 'true',
  MAX_POSTS_PER_RUN = '3',
} = process.env;

if (!WA_STAGING_GROUP_JID) {
  console.error('❌ WA_STAGING_GROUP_JID não configurado no .env');
  console.error('   Rode antes: npm run wa:list-groups');
  process.exit(1);
}

console.log('🔍 Buscando ofertas no Mercado Livre...');
console.log(`   query="${SEARCH_QUERY}"  desconto>=${MIN_DISCOUNT_PERCENT}%  freteGrátis=${ONLY_FREE_SHIPPING}  deal=${ONLY_DEALS}\n`);

const rawOffers = await searchOffers({
  q: SEARCH_QUERY || undefined,
  freeShipping: ONLY_FREE_SHIPPING === 'true',
  deal: ONLY_DEALS === 'true',
  sort: 'price_asc',
  limit: 50,
});

const minDiscount = Number(MIN_DISCOUNT_PERCENT);
const filtered = rawOffers
  .filter((o) => o.discountPercent >= minDiscount)
  .slice(0, Number(MAX_POSTS_PER_RUN));

console.log(`   ${rawOffers.length} produtos retornados, ${filtered.length} passaram no filtro.\n`);

if (filtered.length === 0) {
  console.log('⚠️  Nenhuma oferta dentro dos critérios. Tente relaxar MIN_DISCOUNT_PERCENT ou trocar SEARCH_QUERY.');
  process.exit(0);
}

if (!ML_AFFILIATE_TAG) {
  console.warn('⚠️  ML_AFFILIATE_TAG vazia — links serão postados SEM atribuição de comissão.');
  console.warn('   Pegue sua tag em afiliados.mercadolivre.com.br e edite o .env.\n');
}

const offersWithAffiliate = filtered.map((o) => ({
  ...o,
  affiliateUrl: attachAffiliateTag(o.permalink, ML_AFFILIATE_TAG),
}));

await startWhatsApp({
  onReady: async (sock) => {
    // Aguarda store sincronizar
    await new Promise((r) => setTimeout(r, 3000));

    for (const offer of offersWithAffiliate) {
      const text = formatReviewCard(offer);
      console.log(`📤 Enviando: ${offer.title.slice(0, 60)}...`);

      await sock.sendMessage(WA_STAGING_GROUP_JID, {
        image: { url: offer.image },
        caption: text,
      });

      // Pequena pausa entre envios pra não parecer flood
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`\n✅ ${offersWithAffiliate.length} oferta(s) enviada(s) ao grupo de staging.`);
    console.log('   Revise no grupo e copie/cole no grupo de divulgação.\n');
    setTimeout(() => process.exit(0), 2000);
  },
});
