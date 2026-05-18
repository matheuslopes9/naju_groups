/**
 * Worker: scraping periódico das fontes /ofertas[/sub] + filtragem
 * por keywords/preço/desconto + enriquecimento (categoria detectada,
 * comissão estimada, score) + cooldown anti-repetição.
 *
 * Política: nada vai pra grupo sem aprovação manual.
 */
import { prisma } from './db.js';
import { scrapeSource, scoreOffer, matchKeywords } from './ml/scraper.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { getAffiliateTag } from './ml/oauth.js';
import { detectCategory, commissionPctFor, estimateCommission } from './ml/commission.js';
import { runAgentForWorkspace } from './agent.js';

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

export async function runWorkspace(ws, onProgress) {
  const sources = await prisma.workspaceSource.findMany({
    where: { workspaceId: ws.id, enabled: true },
  });

  if (sources.length === 0) {
    onProgress?.({ stage: 'error', message: 'Nenhuma fonte cadastrada. Adicione em Configuração.' });
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
        (p) => onProgress?.({ stage: 'page', source: source.label, current: i, total: sources.length, ...p })
      );
    } catch (e) {
      onProgress?.({ stage: 'source-error', source: source.label, error: e.message });
      continue;
    }
    scanned += candidates.length;

    // Enriquecimento: detecta categoria + calcula comissão estimada + score
    const enriched = candidates.map((o) => {
      const categoryDetected = detectCategory(o.title);
      const commissionPct = commissionPctFor(categoryDetected);
      const estimated = estimateCommission(o.price, categoryDetected);
      const score = scoreOffer(o, {
        estimatedCommission: estimated,
        priceMin: ws.priceMin ?? 30,
        priceMax: ws.priceMax ?? 500,
      });
      return { ...o, categoryDetected, commissionPct, estimatedCommission: estimated, score };
    });

    // Filtragem (após enriquecimento pra UI mostrar estatística mesmo se filtrado)
    const filterStats = { discount: 0, freeShipping: 0, deals: 0, priceMin: 0, priceMax: 0, keywords: 0 };
    const filtered = enriched.filter((o) => {
      if (o.discountPercent < (ws.minDiscount ?? 0)) { filterStats.discount++; return false; }
      if (ws.onlyFreeShipping && !o.freeShipping) { filterStats.freeShipping++; return false; }
      if (ws.onlyDeals && !o.originalPrice) { filterStats.deals++; return false; }
      if (ws.priceMin != null && o.price < ws.priceMin) { filterStats.priceMin++; return false; }
      if (ws.priceMax != null && o.price > ws.priceMax) { filterStats.priceMax++; return false; }
      if (!matchKeywords(o, ws.keywords)) { filterStats.keywords++; return false; }
      return true;
    });
    console.log(`   [${source.label}] descartados:`, Object.entries(filterStats).filter(([_, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(', ') || '(nada descartado)');

    // Ordena por score (rentabilidade alta primeiro), com jitter aleatório pra variar
    const scored = filtered.sort((a, b) => (b.score - a.score) + (Math.random() - 0.5) * 5);

    // Cooldown: produto visto nos últimos N dias não entra de novo
    const productIds = scored.map((o) => o.productId);
    const recent = productIds.length > 0 ? await prisma.offer.findMany({
      where: {
        productId: { in: productIds },
        workspaceId: ws.id,
        createdAt: { gte: cooldownDate },
      },
      select: { productId: true },
    }) : [];
    const recentSet = new Set(recent.map((r) => r.productId));
    if (recent.length > 0) {
      console.log(`   [${source.label}] ${recent.length} produtos no cooldown (já vistos nos últimos ${ws.cooldownDays}d)`);
    }

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
            coupon: o.coupon ?? null,
            highlight: o.highlight ?? null,
            categoryDetected: o.categoryDetected,
            commissionPct: o.commissionPct,
            estimatedCommission: o.estimatedCommission,
            score: o.score,
            status: 'pending',
          },
        });
        saved++;
        savedThisSource++;
      } catch {
        // duplicata (productId+workspaceId)
      }
    }

    onProgress?.({
      stage: 'source-done',
      source: source.label,
      current: i,
      total: sources.length,
      scanned: candidates.length,
      filtered: filtered.length,
      saved: savedThisSource,
    });
  }

  // Após salvar ofertas, dispara o agente IA (se autoApprove ligado)
  let autoApproved = 0;
  if (ws.autoApproveEnabled) {
    try {
      const result = await runAgentForWorkspace(ws);
      autoApproved = result.sent ?? 0;
      onProgress?.({
        stage: 'agent-done',
        sent: autoApproved,
        processed: result.processed ?? 0,
        skipReason: result.skipReason,
      });
    } catch (e) {
      onProgress?.({ stage: 'agent-error', error: e.message });
    }
  }

  onProgress?.({ stage: 'done', scanned, saved, autoApproved });
  return { saved, scanned, autoApproved };
}
