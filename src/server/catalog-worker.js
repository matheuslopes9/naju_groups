/**
 * Worker que varre o CATÁLOGO completo de fontes a cada 6h.
 * Diferente do worker.js (que roda por workspace), este varre tudo UMA VEZ
 * e usa as ofertas pra alimentar TODOS os workspaces com auto-aprovação ativa.
 *
 * Dedup global: o mesmo productId pode aparecer em várias fontes (relâmpago
 * e celulares, por ex). Mantemos um Map único por varredura.
 *
 * Pra cada workspace com autoApproveEnabled:
 *   1. Filtra ofertas que casam com keywords/preço/desconto do workspace
 *   2. Insere na tabela Offer (workspaceId, productId — unique)
 *   3. Chama enqueueApprovedOffers() pra agendar envios
 */
import { prisma } from './db.js';
import { SOURCE_CATALOG } from './ml/sources-catalog.js';
import { scrapeCatalogSource, scoreOffer, matchKeywords } from './ml/scraper.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { getAffiliateTag } from './ml/oauth.js';
import { detectCategory, commissionPctFor, estimateCommission } from './ml/commission.js';
import { enqueueApprovedOffers } from './queue.js';

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
let lastSweepAt = 0;
let sweepInFlight = false;

export function startCatalogWorker() {
  // Primeira varredura: 60s após o boot (dá tempo dos workers básicos subirem)
  setTimeout(() => runCatalogSweep().catch((e) => console.warn('catalog sweep err:', e.message)), 60_000);
  // Depois a cada 30min checa se já passaram 6h da última
  setInterval(() => {
    const elapsed = Date.now() - lastSweepAt;
    if (elapsed >= SWEEP_INTERVAL_MS && !sweepInFlight) {
      runCatalogSweep().catch((e) => console.warn('catalog sweep err:', e.message));
    }
  }, 30 * 60 * 1000);
  console.log('🌐 Catalog worker iniciado — varredura a cada 6h');
}

/**
 * Roda 1 varredura completa do catálogo + enfileiramento pra workspaces ativos.
 * Pode ser chamada manualmente também (botão "Varrer agora").
 */
export async function runCatalogSweep(onProgress) {
  if (sweepInFlight) {
    console.log('⚠️  Varredura do catálogo já em andamento — ignorando');
    return { skipped: 'already-running' };
  }
  sweepInFlight = true;
  lastSweepAt = Date.now();

  try {
    console.log('\n🌐 Iniciando varredura completa do catálogo (15 fontes)...');
    onProgress?.({ stage: 'start', totalSources: SOURCE_CATALOG.length });

    // Workspaces que vão receber ofertas
    const workspaces = await prisma.workspace.findMany({
      where: { autoApproveEnabled: true },
    });
    if (workspaces.length === 0) {
      console.log('   ⚠️  Nenhum workspace com auto-aprovação ativa — pulando varredura');
      return { totalScanned: 0, workspaces: 0 };
    }

    const affTag = await getAffiliateTag();
    let totalScanned = 0;
    let totalSaved = 0;
    let i = 0;

    // Varre cada fonte UMA vez (sequencialmente, pra não estressar ML)
    for (const source of SOURCE_CATALOG) {
      i++;
      // Por padrão, varre todas as páginas, mas em produção é razoável
      // limitar a primeira chamada (10 páginas) pra acelerar. Override por env.
      const maxPages = Number(process.env.CATALOG_MAX_PAGES ?? source.pages);

      onProgress?.({
        stage: 'source-start',
        current: i,
        total: SOURCE_CATALOG.length,
        sourceId: source.id,
        label: source.label,
        maxPages,
      });

      let offers = [];
      try {
        offers = await scrapeCatalogSource(source.id, maxPages, (p) => {
          onProgress?.({ stage: 'page', sourceId: source.id, current: i, total: SOURCE_CATALOG.length, ...p });
        });
      } catch (e) {
        console.warn(`   ❌ [${source.label}] erro:`, e.message);
        onProgress?.({ stage: 'source-error', sourceId: source.id, error: e.message });
        continue;
      }
      totalScanned += offers.length;
      console.log(`   ✅ [${source.label}] ${offers.length} ofertas únicas`);

      // Enriquecimento
      const enriched = offers.map((o) => {
        const categoryDetected = detectCategory(o.title);
        const commissionPct = commissionPctFor(categoryDetected);
        const estimated = estimateCommission(o.price, categoryDetected);
        return { ...o, categoryDetected, commissionPct, estimatedCommission: estimated };
      });

      // Distribui pra TODOS os workspaces com auto-aprovação ativa.
      // Keywords + categoria detectada do título decidem se a oferta entra
      // (filtro abaixo). Categoria da fonte (cellphones, fashion-f) é só
      // metadata pra debug.
      for (const ws of workspaces) {
        let savedForWs = 0;
        const cooldownMs = (ws.cooldownDays ?? 30) * 24 * 60 * 60 * 1000;
        const cooldownDate = new Date(Date.now() - cooldownMs);

        // Filtra por critérios do workspace
        const filtered = enriched.filter((o) => {
          if (o.discountPercent < (ws.minDiscount ?? 0)) return false;
          if (ws.onlyFreeShipping && !o.freeShipping) return false;
          if (ws.onlyDeals && !o.originalPrice) return false;
          if (ws.priceMin != null && o.price < ws.priceMin) return false;
          if (ws.priceMax != null && o.price > ws.priceMax) return false;
          if (!matchKeywords(o, ws.keywords)) return false;
          return true;
        });

        // Cooldown global por workspace
        const productIds = filtered.map((o) => o.productId);
        const recent = productIds.length > 0 ? await prisma.offer.findMany({
          where: {
            productId: { in: productIds },
            workspaceId: ws.id,
            createdAt: { gte: cooldownDate },
          },
          select: { productId: true },
        }) : [];
        const recentSet = new Set(recent.map((r) => r.productId));

        for (const o of filtered) {
          if (recentSet.has(o.productId)) continue;
          const score = scoreOffer(o, {
            estimatedCommission: o.estimatedCommission,
            priceMin: ws.priceMin ?? 30,
            priceMax: ws.priceMax ?? 500,
          });
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
                score,
                status: 'pending',
              },
            });
            savedForWs++;
            totalSaved++;
          } catch {
            // dup (workspaceId+productId)
          }
        }

        if (savedForWs > 0) {
          console.log(`      → [${ws.name}] +${savedForWs} ofertas salvas`);
        }
      }

      onProgress?.({
        stage: 'source-done',
        sourceId: source.id,
        current: i,
        total: SOURCE_CATALOG.length,
        scanned: offers.length,
      });
    }

    // Após scrape: pra cada workspace ativo, enfileira ofertas pra envio
    let totalEnqueued = 0;
    for (const ws of workspaces) {
      try {
        const r = await enqueueApprovedOffers(ws, 100);
        totalEnqueued += r.enqueued;
        if (r.enqueued > 0) console.log(`   📅 [${ws.name}] ${r.enqueued} novas ofertas enfileiradas`);
      } catch (e) {
        console.warn(`   ❌ [${ws.name}] enqueue falhou:`, e.message);
      }
    }

    console.log(`\n✅ Varredura concluída: ${totalScanned} scaneadas, ${totalSaved} novas salvas, ${totalEnqueued} enfileiradas\n`);
    onProgress?.({ stage: 'done', totalScanned, totalSaved, totalEnqueued });
    return { totalScanned, totalSaved, totalEnqueued, workspaces: workspaces.length };
  } finally {
    sweepInFlight = false;
  }
}

export function getCatalogSweepStatus() {
  return {
    lastSweepAt: lastSweepAt ? new Date(lastSweepAt).toISOString() : null,
    nextSweepAt: lastSweepAt ? new Date(lastSweepAt + SWEEP_INTERVAL_MS).toISOString() : null,
    inFlight: sweepInFlight,
  };
}
