/**
 * Worker em loop: a cada minuto verifica workspaces com auto_search=true
 * e busca novas ofertas (respeitando intervalMin do workspace).
 *
 * Para cada workspace, itera sobre os SELLERS cadastrados e chama
 * /sites/MLB/search?seller_id=... — o endpoint /sites/MLB/search?q= não
 * funciona (não é documentado oficialmente para esse uso).
 *
 * Política de conformidade: nada vai a grupo automaticamente.
 * Ofertas viram "pending" — usuário aprova/rejeita pelo dashboard.
 */
import { prisma } from './db.js';
import { searchOffersBySeller } from './ml/search.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { getAffiliateTag } from './ml/oauth.js';

const lastRunMap = new Map(); // workspaceId → timestamp

export function startWorker() {
  setInterval(runOnce, 60_000);
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
  const sellers = await prisma.workspaceSeller.findMany({
    where: { workspaceId: ws.id, enabled: true },
  });

  if (sellers.length === 0) {
    console.log(`⚠️  Workspace "${ws.name}" sem sellers cadastrados — pulando`);
    return 0;
  }

  console.log(`🔍 Buscando ofertas para workspace="${ws.name}" (${sellers.length} seller(s))`);
  const affTag = await getAffiliateTag();
  let saved = 0;

  for (const seller of sellers) {
    try {
      const offers = await searchOffersBySeller(seller.sellerId, {
        freeShipping: ws.onlyFreeShipping,
        sort: 'price_asc',
        limit: 50,
      });

      for (const o of offers) {
        if (o.discountPercent < ws.minDiscount) continue;
        // Filtro extra "só promoções": exige que tenha original_price (item em deal)
        if (ws.onlyDeals && !o.originalPrice) continue;

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
    } catch (e) {
      console.warn(`   seller ${seller.nickname ?? seller.sellerId} falhou:`, e.message);
    }
  }

  console.log(`   ${saved} nova(s) oferta(s) salva(s) (${sellers.length} sellers consultados)`);
  return saved;
}
