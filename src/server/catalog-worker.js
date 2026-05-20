/**
 * Catalog worker: varre as 15 fontes do ML em horários fixos de Brasília:
 *   00h, 06h, 12h, 18h (America/Sao_Paulo, UTC-3 fixo).
 *
 * Arquitetura em 2 etapas:
 *   1. SCRAPE → salva em ScrapedOffer (snapshot global, dedup por productId)
 *   2. DISTRIBUTE → para cada workspace ativo, filtra ScrapedOffer pelas
 *      regras dele e cria/atualiza Offer (workspaceId+productId unique)
 *
 * A separação permite "Reprocessar" sem revarrer o ML: a rota quick-start
 * chama distributeToWorkspace() direto, usando o que já tem em ScrapedOffer.
 *
 * Catch-up: se o servidor sobe num horário entre slots e o último slot
 * (a até 6h atrás) ainda não foi varrido, dispara imediatamente pra
 * recuperar o atraso.
 */
import { EventEmitter } from 'node:events';
import { prisma } from './db.js';
import { SOURCE_CATALOG } from './ml/sources-catalog.js';
import { scrapeCatalogSource, scoreOffer, matchKeywords } from './ml/scraper.js';
import { attachAffiliateTag } from './ml/affiliate.js';
import { getAffiliateTag } from './ml/oauth.js';
import { detectCategory, commissionPctFor, estimateCommission } from './ml/commission.js';
import { enqueueApprovedOffers } from './queue.js';

// Slots de varredura em horário de Brasília (UTC-3 fixo, sem DST desde 2019)
const SLOT_HOURS_BR = [0, 6, 12, 18];
const SP_OFFSET_MIN = -180; // UTC-3

let lastSweepAt = 0;
let sweepInFlight = false;

// EventEmitter pra broadcast de eventos da varredura corrente.
// Múltiplos clientes podem se inscrever via /sweep/stream e receber os
// MESMOS eventos, independente de quem disparou a varredura (cron ou user).
// Buffer guarda eventos da varredura corrente pra clientes que conectam
// no meio receberem o histórico.
export const sweepEmitter = new EventEmitter();
sweepEmitter.setMaxListeners(50); // múltiplos browsers podem conectar
let sweepBuffer = []; // limpa ao iniciar nova varredura
const MAX_BUFFER = 1000;

function emitSweep(evt) {
  // Carimba timestamp do servidor pra que clientes que se anexam no meio
  // (replay do buffer) vejam a ordem cronológica REAL, não o momento em
  // que o batch chega no socket.
  const stamped = { ...evt, _ts: Date.now() };
  if (sweepBuffer.length < MAX_BUFFER) sweepBuffer.push(stamped);
  sweepEmitter.emit('event', stamped);
}

export function getSweepBuffer() {
  return sweepBuffer.slice();
}

/**
 * Converte um Date UTC pra { hour, dayShift } em horário de Brasília.
 * dayShift = -1 se rolar pro dia anterior em SP, 0 mesmo dia, +1 próximo.
 */
function toSP(date) {
  const utcMs = date.getTime();
  const spMs = utcMs + SP_OFFSET_MIN * 60_000;
  return new Date(spMs);
}

/**
 * Retorna o Date UTC do próximo slot a partir do "now" (Date UTC).
 * Ex: now=10:30 BRT → próximo é 12:00 BRT.
 */
function nextSlotAfter(now = new Date()) {
  const sp = toSP(now);
  const spHour = sp.getUTCHours();
  const spMin = sp.getUTCMinutes();
  // Próximo slot estritamente maior que (hora:min) atual em SP
  let nextHour = SLOT_HOURS_BR.find((h) => h > spHour || (h === spHour && 0 > spMin));
  let dayShift = 0;
  if (nextHour == null) {
    nextHour = SLOT_HOURS_BR[0];
    dayShift = 1;
  }
  // Constrói Date UTC: SP é UTC-3 → UTC = SP + 3
  const target = new Date(Date.UTC(
    sp.getUTCFullYear(),
    sp.getUTCMonth(),
    sp.getUTCDate() + dayShift,
    nextHour - SP_OFFSET_MIN / 60, // nextHour - (-3) = nextHour + 3 (UTC)
    0, 0, 0,
  ));
  return target;
}

/**
 * Retorna o Date UTC do slot ANTERIOR mais recente (≤ now).
 * Usado pra detectar se há slot perdido (catch-up).
 */
function previousSlot(now = new Date()) {
  const sp = toSP(now);
  const spHour = sp.getUTCHours();
  let prevHour = [...SLOT_HOURS_BR].reverse().find((h) => h <= spHour);
  let dayShift = 0;
  if (prevHour == null) {
    prevHour = SLOT_HOURS_BR[SLOT_HOURS_BR.length - 1];
    dayShift = -1;
  }
  return new Date(Date.UTC(
    sp.getUTCFullYear(),
    sp.getUTCMonth(),
    sp.getUTCDate() + dayShift,
    prevHour - SP_OFFSET_MIN / 60,
    0, 0, 0,
  ));
}

export function startCatalogWorker() {
  scheduleNextSlot();
  // Catch-up: se subiu e o último slot ainda não rolou, varre logo
  setTimeout(() => {
    const prev = previousSlot();
    if (lastSweepAt < prev.getTime()) {
      console.log(`🌐 Catch-up: último slot foi ${prev.toISOString()}, varrendo agora`);
      runCatalogSweep().catch((e) => console.warn('catalog sweep err:', e.message));
    }
  }, 60_000);
  console.log('🌐 Catalog worker iniciado — slots fixos: 00h/06h/12h/18h (Brasília)');
}

function scheduleNextSlot() {
  const next = nextSlotAfter();
  const delay = Math.max(1000, next.getTime() - Date.now());
  console.log(`📅 Próxima varredura agendada: ${next.toISOString()} (em ${Math.round(delay / 60000)} min)`);
  setTimeout(async () => {
    try {
      await runCatalogSweep();
    } catch (e) {
      console.warn('catalog sweep err:', e.message);
    }
    scheduleNextSlot(); // reagenda pro próximo
  }, delay);
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
    passedScore: 0, // quantas das que passaram tambem batem o score threshold
    rejectedByDiscount: 0,
    rejectedByFreeShipping: 0,
    rejectedByDeal: 0,
    rejectedByPriceMin: 0,
    rejectedByPriceMax: 0,
    rejectedByKeywords: 0,
    rejectedByScore: 0, // passou filtros mas score < threshold
  };
  const passed = [];
  const threshold = ws.autoApproveThreshold ?? 50;
  for (const o of offers) {
    if (o.discountPercent < (ws.minDiscount ?? 0)) { stats.rejectedByDiscount++; continue; }
    if (ws.onlyFreeShipping && !o.freeShipping) { stats.rejectedByFreeShipping++; continue; }
    if (ws.onlyDeals && !o.originalPrice) { stats.rejectedByDeal++; continue; }
    if (ws.priceMin != null && o.price < ws.priceMin) { stats.rejectedByPriceMin++; continue; }
    if (ws.priceMax != null && o.price > ws.priceMax) { stats.rejectedByPriceMax++; continue; }
    if (!matchKeywords(o, ws.keywords)) { stats.rejectedByKeywords++; continue; }
    // Passou todos os filtros explicitos. Score decide se chega na fila.
    const score = scoreOffer(o, {
      estimatedCommission: o.estimatedCommission ?? 0,
      priceMin: ws.priceMin ?? 30,
      priceMax: ws.priceMax ?? 500,
    });
    if (score < threshold) {
      stats.rejectedByScore++;
      continue;
    }
    passed.push({ ...o, score });
    stats.passedScore++;
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
    // o.score já vem calculado de applyWorkspaceFilters (única source of truth)
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
          score: o.score,
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
  sweepBuffer = []; // limpa buffer pra esta varredura

  // Emit + chama onProgress legado (clientes diretos)
  const emit = (evt) => { emitSweep(evt); onProgress?.(evt); };

  try {
    console.log('\n🌐 Iniciando varredura completa do catálogo (15 fontes)...');
    emit({ stage: 'start', totalSources: SOURCE_CATALOG.length });

    let totalScanned = 0;
    let totalUpserted = 0;
    let totalSavedToOffers = 0;
    let totalEnqueued = 0;
    let i = 0;

    // Carrega lista de workspaces ativos UMA vez no início.
    // A cada fonte, vai re-distribuir incrementalmente — assim ofertas chegam
    // no inbox/fila durante a varredura, não só no final.
    const workspaces = await prisma.workspace.findMany({
      where: { autoApproveEnabled: true },
    });
    if (workspaces.length > 0) {
      emit({ stage: 'workspaces-loaded', count: workspaces.length, names: workspaces.map((w) => w.name) });
    }

    // Etapa unificada: scrape fonte → upsert em ScrapedOffer → distribui+enfileira
    for (const source of SOURCE_CATALOG) {
      i++;
      const maxPages = Number(process.env.CATALOG_MAX_PAGES ?? source.pages);

      emit({
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
          emit({ stage: 'page', sourceId: source.id, current: i, total: SOURCE_CATALOG.length, ...p });
        });
      } catch (e) {
        console.warn(`   ❌ [${source.label}] erro:`, e.message);
        emit({ stage: 'source-error', sourceId: source.id, error: e.message });
        continue;
      }
      totalScanned += offers.length;
      console.log(`   ✅ [${source.label}] ${offers.length} ofertas únicas`);

      // Enriquece + persiste em ScrapedOffer
      let upsertedThisSource = 0;
      for (const o of offers) {
        const categoryDetected = detectCategory(o.title);
        const commissionPct = commissionPctFor(categoryDetected);
        const estimatedCommission = estimateCommission(o.price, categoryDetected);
        try {
          await upsertScrapedOffer({ ...o, categoryDetected, commissionPct, estimatedCommission }, source.id);
          totalUpserted++;
          upsertedThisSource++;
        } catch (e) {
          console.warn(`      upsert ${o.productId} falhou:`, e.message);
        }
      }

      emit({
        stage: 'source-done',
        sourceId: source.id,
        current: i,
        total: SOURCE_CATALOG.length,
        scanned: offers.length,
        upserted: upsertedThisSource,
      });

      // INCREMENTAL: a cada fonte concluída, distribui pros workspaces ativos.
      // Garante que ofertas chegam no inbox/fila ao longo da varredura, não só
      // no final (que pode demorar 10-15min com Playwright pesado).
      if (workspaces.length > 0 && upsertedThisSource > 0) {
        for (const ws of workspaces) {
          try {
            const stats = await distributeToWorkspace(ws);
            if (stats.saved > 0) {
              totalSavedToOffers += stats.saved;
              console.log(`   → [${ws.name}] +${stats.saved} ofertas salvas (${stats.passed}/${stats.total} passaram)`);
              emit({ stage: 'workspace-distribute', sourceId: source.id, workspace: ws.name, saved: stats.saved, passed: stats.passed, total: stats.total });
            }

            const r = await enqueueApprovedOffers(ws, 500);
            if (r.enqueued > 0) {
              totalEnqueued += r.enqueued;
              console.log(`   📅 [${ws.name}] +${r.enqueued} enfileiradas`);
              emit({ stage: 'workspace-enqueue', sourceId: source.id, workspace: ws.name, enqueued: r.enqueued });
            }
          } catch (e) {
            console.warn(`   ❌ [${ws.name}] distribute incremental falhou:`, e.message);
            emit({ stage: 'workspace-error', sourceId: source.id, workspace: ws.name, error: e.message });
          }
        }
      }
    }

    console.log(`\n✅ Varredura concluída: ${totalScanned} scaneadas, ${totalUpserted} no banco global, ${totalSavedToOffers} novas em workspaces, ${totalEnqueued} enfileiradas\n`);
    const result = { totalScanned, totalUpserted, totalSaved: totalSavedToOffers, totalEnqueued, workspaces: workspaces.length };
    emit({ stage: 'done', ...result });
    return result;
  } finally {
    sweepInFlight = false;
  }
}

export function getCatalogSweepStatus() {
  return {
    lastSweepAt: lastSweepAt ? new Date(lastSweepAt).toISOString() : null,
    nextSweepAt: nextSlotAfter().toISOString(),
    inFlight: sweepInFlight,
    slots: SLOT_HOURS_BR.map((h) => `${String(h).padStart(2, '0')}:00`),
    timezone: 'America/Sao_Paulo',
  };
}
