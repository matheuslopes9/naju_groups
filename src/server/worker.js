/**
 * Worker em loop: a cada minuto verifica workspaces com auto_search=true.
 * Para cada workspace, itera sobre as CATEGORIAS cadastradas e chama
 * /sites/MLB/search?category=$ID&shipping_cost=free
 *
 * Política: nada vai a grupo automaticamente. Ofertas viram pending.
 */
import { prisma } from './db.js';
import { searchOffersByCategory } from './ml/search.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { getAffiliateTag } from './ml/oauth.js';

const lastRunMap = new Map();

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
  const categories = await prisma.workspaceCategory.findMany({
    where: { workspaceId: ws.id, enabled: true },
  });

  if (categories.length === 0) {
    console.log(`⚠️  Workspace "${ws.name}" sem categorias cadastradas — pulando`);
    return 0;
  }

  console.log(`🔍 Buscando ofertas para workspace="${ws.name}" (${categories.length} categoria(s))`);
  const affTag = await getAffiliateTag();
  let saved = 0;

  for (const cat of categories) {
    try {
      const offers = await searchOffersByCategory(cat.categoryId, {
        freeShipping: ws.onlyFreeShipping,
        sort: 'price_asc',
        limit: 50,
      });

      for (const o of offers) {
        if (o.discountPercent < ws.minDiscount) continue;
        // "Só promoções": exige original_price (item em deal)
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
          // duplicata
        }
      }
    } catch (e) {
      console.warn(`   categoria ${cat.name} (${cat.categoryId}) falhou:`, e.message);
    }
  }

  console.log(`   ${saved} nova(s) oferta(s) salva(s)`);
  return saved;
}
