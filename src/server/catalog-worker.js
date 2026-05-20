/**
 * Catalog worker: varre as 15 fontes do ML a cada 6h.
 *
 * Arquitetura em 2 etapas:
 *   1. SCRAPE → salva em ScrapedOffer (snapshot global, dedup por productId)
 *   2. DISTRIBUTE → para cada workspace ativo, filtra ScrapedOffer pelas
 *      regras dele e cria/atualiza Offer (workspaceId+productId unique)
 *
 * A separação permite "Reprocessar" sem revarrer o ML: a rota quick-start
 * chama distributeToWorkspace() direto, usando o que já tem em ScrapedOffer.
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
  setTimeout(() => runCatalogSweep().catch((e) => console.warn('catalog sweep err:', e.message)), 60_000);
  setInterval(() => {
    const elapsed = Date.now() - lastSweepAt;
    if (elapsed >= SWEEP_INTERVAL_MS && !sweepInFlight) {
      runCatalogSweep().catch((e) => console.warn('catalog sweep err:', e.message));
    }
  }, 30 * 60 * 1000);
  console.log('🌐 Catalog worker iniciado — varredura a cada 6h');
}

/**
 * Salva/atualiza uma oferta scaneada no banco. Dedup por productId.
 * Atualiza preço/desconto/lastSeenAt se já existe.
 */
async function upsertScrapedOffer(o, sourceId) {
  await prisma.scrapedOffer.upsert({
    where: { productId: o.productId },
    create: {
      productId: o.productId,
      title: o.title,
      price: o.price,
      originalPrice: o.originalPrice ?? null,
      discountPercent: o.discountPercent ?? 0,
      currency: o.currency ?? 'BRL',
      permalink: o.permalink,
      imageUrl: o.image ?? '',
      freeShipping: !!o.freeShipping,
      soldQuantity: o.soldQuantity ?? 0,
      coupon: o.coupon ?? null,
      highlight: o.highlight ?? null,
      categoryDetected: o.categoryDetected ?? null,
      commissionPct: o.commissionPct ?? null,
      estimatedCommission: o.estimatedCommission ?? null,
      sourceId,
    },
    update: {
      title: o.title,
      price: o.price,
      originalPrice: o.originalPrice ?? null,
      discountPercent: o.discountPercent ?? 0,
      coupon: o.coupon ?? null,
      highlight: o.highlight ?? null,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Aplica filtros do workspace numa lista de ofertas scaneadas e retorna
 * { passed, stats }. Stats contém o funil pra UI mostrar onde caíram.
 */
export function applyWorkspaceFilters(ws, offers) {
  const stats = {
    total: offers.length,
    passed: 0,
    rejectedByDiscount: 0,
    rejectedByFreeShipping: 0,
    rejectedByDeal: 0,
    rejectedByPriceMin: 0,
    rejectedByPriceMax: 0,
    rejectedByKeywords: 0,
  };
  const passed = [];
  for (const o of offers) {
    if (o.discountPercent < (ws.minDiscount ?? 0)) { stats.rejectedByDiscount++; continue; }
    if (ws.onlyFreeShipping && !o.freeShipping) { stats.rejectedByFreeShipping++; continue; }
    if (ws.onlyDeals && !o.originalPrice) { stats.rejectedByDeal++; continue; }
    if (ws.priceMin != null && o.price < ws.priceMin) { stats.rejectedByPriceMin++; continue; }
    if (ws.priceMax != null && o.price > ws.priceMax) { stats.rejectedByPriceMax++; continue; }
    if (!matchKeywords(o, ws.keywords)) { stats.rejectedByKeywords++; continue; }
    passed.push(o);
  }
  stats.passed = passed.length;
  return { passed, stats };
}

/**
 * Distribui ScrapedOffers pra um workspace específico.
 * Re-aplica filtros atuais, cria/skipa Offers, retorna stats do funil.
 *
 * Usada por:
 *   - runCatalogSweep (depois de salvar todas as ScrapedOffer)
 *   - rota /quick-start (pra "reprocessar histórico" sem revarrer o ML)
 */
export async function distributeToWorkspace(ws, opts = {}) {
  const limit = opts.limit ?? 2000;
  const affTag = await getAffiliateTag();
  const cooldownMs = (ws.cooldownDays ?? 30) * 24 * 60 * 60 * 1000;
  const cooldownDate = new Date(Date.now() - cooldownMs);

  const scraped = await prisma.scrapedOffer.findMany({
    orderBy: { lastSeenAt: 'desc' },
    take: limit,
  });

  // Normaliza pra ter `image` (catalog usa image, scrapedOffer usa imageUrl)
  const normalized = scraped.map((s) => ({
    productId: s.productId,
    title: s.title,
    price: s.price,
    originalPrice: s.originalPrice,
    discountPercent: s.discountPercent,
    currency: s.currency,
    permalink: s.permalink,
    image: s.imageUrl,
    freeShipping: s.freeShipping,
    soldQuantity: s.soldQuantity,
    coupon: s.coupon,
    highlight: s.highlight,
    categoryDetected: s.categoryDetected,
    commissionPct: s.commissionPct,
    estimatedCommission: s.estimatedCommission,
  }));

  const { passed, stats } = applyWorkspaceFilters(ws, normalized);

  // Cooldown: produtos já vistos por esse workspace nos últimos N dias
  const productIds = passed.map((o) => o.productId);
  const recent = productIds.length > 0 ? await prisma.offer.findMany({
    where: {
      productId: { in: productIds },
      workspaceId: ws.id,
      createdAt: { gte: cooldownDate },
    },
    select: { productId: true },
  }) : [];
  const recentSet = new Set(recent.map((r) => r.productId));
  stats.skippedByCooldown = recentSet.size;

  let saved = 0;
  for (const o of passed) {
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
          currency: o.currency ?? 'BRL',
          permalink: o.permalink,
          affiliateUrl,
          imageUrl: o.image ?? '',
          freeShipping: !!o.freeShipping,
          soldQuantity: o.soldQuantity ?? 0,
          coupon: o.coupon,
          highlight: o.highlight,
          categoryDetected: o.categoryDetected,
          commissionPct: o.commissionPct,
          estimatedCommission: o.estimatedCommission,
          score,
          status: 'pending',
        },
      });
      saved++;
    } catch {
      // dup (workspaceId+productId) — pode acontecer em concorrência ou reprocessamento
    }
  }
  stats.saved = saved;
  return stats;
}

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

    let totalScanned = 0;
    let totalUpserted = 0;
    let i = 0;

    // Etapa 1: scrape de cada fonte → upsert em ScrapedOffer
    for (const source of SOURCE_CATALOG) {
      i++;
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

      // Enriquece + persiste em ScrapedOffer
      for (const o of offers) {
        const categoryDetected = detectCategory(o.title);
        const commissionPct = commissionPctFor(categoryDetected);
        const estimatedCommission = estimateCommission(o.price, categoryDetected);
        try {
          await upsertScrapedOffer({ ...o, categoryDetected, commissionPct, estimatedCommission }, source.id);
          totalUpserted++;
        } catch (e) {
          console.warn(`      upsert ${o.productId} falhou:`, e.message);
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

    // Etapa 2: distribui pros workspaces ativos
    const workspaces = await prisma.workspace.findMany({
      where: { autoApproveEnabled: true },
    });
    let totalSavedToOffers = 0;
    let totalEnqueued = 0;
    for (const ws of workspaces) {
      try {
        const stats = await distributeToWorkspace(ws);
        totalSavedToOffers += stats.saved;
        if (stats.saved > 0) console.log(`   → [${ws.name}] +${stats.saved} ofertas salvas (${stats.passed} passaram filtros de ${stats.total})`);

        const r = await enqueueApprovedOffers(ws, 100);
        totalEnqueued += r.enqueued;
        if (r.enqueued > 0) console.log(`   📅 [${ws.name}] ${r.enqueued} enfileiradas`);
      } catch (e) {
        console.warn(`   ❌ [${ws.name}] distribute falhou:`, e.message);
      }
    }

    console.log(`\n✅ Varredura concluída: ${totalScanned} scaneadas, ${totalUpserted} no banco global, ${totalSavedToOffers} novas em workspaces, ${totalEnqueued} enfileiradas\n`);
    onProgress?.({
      stage: 'done',
      totalScanned,
      totalSaved: totalSavedToOffers,
      totalEnqueued,
    });
    return { totalScanned, totalUpserted, totalSaved: totalSavedToOffers, totalEnqueued, workspaces: workspaces.length };
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
