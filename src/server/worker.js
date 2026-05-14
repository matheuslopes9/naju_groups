/**
 * Worker em loop: a cada minuto verifica workspaces com auto_search=true.
 *
 * IMPORTANTE: desde abril/2025 o ML bloqueou /sites/MLB/search publicamente.
 * Esta plataforma agora usa SCRAPING da página pública /ofertas pra coletar
 * ofertas em destaque por categoria. Volume baixo (1 fetch por categoria por
 * intervalMin), User-Agent rotativo, delay aleatório — risco calculado.
 *
 * Política: nada vai a grupo automaticamente. Ofertas viram pending.
 */
import { prisma } from './db.js';
import { scrapeOffers } from './ml/scraper.js';
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

  console.log(`🔍 Buscando ofertas para workspace="${ws.name}" (${categories.length} categoria(s)) via scraping`);
  const affTag = await getAffiliateTag();
  let saved = 0;

  for (const cat of categories) {
    try {
      const offers = await scrapeOffers(cat.categoryId);
      console.log(`   ${cat.name}: ${offers.length} ofertas brutas`);

      for (const o of offers) {
        if (o.discountPercent < ws.minDiscount) continue;
        if (ws.onlyFreeShipping && !o.freeShipping) continue;
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
          // duplicata (workspaceId+productId)
        }
      }
    } catch (e) {
      console.warn(`   categoria ${cat.name} (${cat.categoryId}) falhou:`, e.message);
    }
  }

  console.log(`   ${saved} nova(s) oferta(s) salva(s)`);
  return saved;
}
