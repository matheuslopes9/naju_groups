/**
 * Worker: scraping periódico das fontes /ofertas[/sub] configuradas em cada
 * workspace + filtragem por keywords/preço/desconto + score de atratividade
 * + cooldown anti-repetição.
 *
 * Política: nada vai pra grupo sem aprovação manual.
 */
import { prisma } from './db.js';
import { scrapeSource, scoreOffer, matchKeywords } from './ml/scraper.js';
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

/**
 * Roda 1 ciclo de busca pra um workspace.
 * Aceita `onProgress` opcional pra streaming (SSE).
 */
export async function runWorkspace(ws, onProgress) {
  const sources = await prisma.workspaceSource.findMany({
    where: { workspaceId: ws.id, enabled: true },
  });

  if (sources.length === 0) {
    onProgress?.({ stage: 'error', message: 'Nenhuma fonte cadastrada. Adicione em Fontes.' });
    return { saved: 0, scanned: 0 };
  }

  onProgress?.({ stage: 'start', totalSources: sources.length });

  const affTag = await getAffiliateTag();
  const cooldownMs = (ws.cooldownDays ?? 30) * 24 * 60 * 60 * 1000;
  const cooldownDate = new Date(Date.now() - cooldownMs);

  let saved = 0;
  let scanned = 0;
  let i = 0;

  for (const source of sources) {
    i++;
    onProgress?.({ stage: 'source-start', current: i, total: sources.length, source: source.label });

    let candidates = [];
    try {
      candidates = await scrapeSource(
        { slug: source.slug, maxPages: source.maxPages },
        (p) => onProgress?.({ stage: 'page', source: source.label, ...p })
      );
    } catch (e) {
      onProgress?.({ stage: 'source-error', source: source.label, error: e.message });
      continue;
    }
    scanned += candidates.length;

    // Filtragem
    const filtered = candidates.filter((o) => {
      if (o.discountPercent < (ws.minDiscount ?? 0)) return false;
      if (ws.onlyFreeShipping && !o.freeShipping) return false;
      if (ws.onlyDeals && !o.originalPrice) return false;
      if (ws.priceMin != null && o.price < ws.priceMin) return false;
      if (ws.priceMax != null && o.price > ws.priceMax) return false;
      if (!matchKeywords(o, ws.keywords)) return false;
      return true;
    });

    // Ordena por score (mais atrativos primeiro), com ordem secundária aleatória
    const scored = filtered
      .map((o) => ({ ...o, _score: scoreOffer(o, { priceMin: ws.priceMin ?? 30, priceMax: ws.priceMax ?? 300 }) }))
      .sort((a, b) => b._score - a._score + (Math.random() - 0.5) * 0.1);

    // Aplica cooldown: produto que foi visto/postado recente não entra de novo
    const productIds = scored.map((o) => o.productId);
    const recent = await prisma.offer.findMany({
      where: {
        productId: { in: productIds },
        workspaceId: ws.id,
        createdAt: { gte: cooldownDate },
      },
      select: { productId: true },
    });
    const recentSet = new Set(recent.map((r) => r.productId));

    let savedThisSource = 0;
    for (const o of scored) {
      if (recentSet.has(o.productId)) continue;
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
        savedThisSource++;
      } catch {
        // duplicata (productId já existe, mesmo fora do cooldown) — ignora silenciosamente
      }
    }

    onProgress?.({
      stage: 'source-done',
      source: source.label,
      scanned: candidates.length,
      filtered: filtered.length,
      saved: savedThisSource,
    });
  }

  onProgress?.({ stage: 'done', scanned, saved });
  return { saved, scanned };
}
