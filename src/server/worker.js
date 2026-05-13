/**
 * Worker em loop: a cada minuto verifica workspaces com auto_search=true
 * e busca novas ofertas (respeitando intervalMin do workspace).
 *
 * Política de conformidade: bot NÃO posta no grupo automaticamente.
 * Ofertas vão como "pending" pro inbox — você aprova/rejeita pelo dashboard,
 * a partir daí ele envia ao grupo de STAGING (não ao público).
 */
import { prisma } from './db.js';
import { searchOffers } from './ml/search.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { getAffiliateTag } from './ml/oauth.js';

const lastRunMap = new Map(); // workspaceId → timestamp

export function startWorker() {
  setInterval(runOnce, 60_000);
  // Roda imediatamente também
  setTimeout(runOnce, 5_000);
  console.log('🔄 Worker de busca de ofertas iniciado (tick=60s)');
}

async function runOnce() {
  const workspaces = await prisma.workspace.findMany({ where: { autoSearch: true } });
  for (const ws of workspaces) {
    const last = lastRunMap.get(ws.id) ?? 0;
    const dueAt = last + ws.intervalMin * 60_000;
    if (Date.now() < dueAt) continue;
    lastRunMap.set(ws.id, Date.now());
    runWorkspace(ws).catch((e) => console.warn(`Workspace ${ws.id} search failed:`, e.message));
  }
}

export async function runWorkspace(ws) {
  console.log(`🔍 Buscando ofertas para workspace="${ws.name}"`);
  const offers = await searchOffers({
    q: ws.searchQuery || undefined,
    freeShipping: ws.onlyFreeShipping,
    deal: ws.onlyDeals,
    sort: 'price_asc',
    limit: 50,
  });

  const affTag = await getAffiliateTag();
  let saved = 0;

  for (const o of offers) {
    if (o.discountPercent < ws.minDiscount) continue;
    const affiliateUrl = attachAffiliateTag(o.permalink, affTag);
    try {
      await prisma.offer.create({
        data: {
          workspaceId: ws.id,
          productId: o.productId,
          title: o.title,
          price: o.price,
          originalPrice: o.originalPrice,
          discountPercent: o.discountPercent,
          currency: o.currency,
          permalink: o.permalink,
          affiliateUrl,
          imageUrl: o.image,
          freeShipping: o.freeShipping,
          condition: o.condition,
          soldQuantity: o.soldQuantity,
          status: 'pending',
        },
      });
      saved++;
    } catch {
      // duplicata (unique workspaceId+productId)
    }
  }
  console.log(`   ${saved} nova(s) oferta(s) salva(s) (${offers.length} retornadas)`);
  return saved;
}
