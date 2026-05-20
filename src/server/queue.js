/**
 * Fila persistente de envios.
 *
 * Fluxo:
 *   1. Scheduler 6h chama scrapeAllSources() pra varrer o catálogo, popula Offer
 *      como 'pending' (igual ao worker tradicional).
 *   2. Para workspaces com autoApproveEnabled, chama enqueueApprovedOffers() que
 *      pega as N melhores ofertas pending acima do threshold e cria QueuedSend
 *      com scheduledFor = próximo slot dentro da janela.
 *   3. Sender daemon (a cada 30s) puxa QueuedSend com status='queued',
 *      scheduledFor <= now E hora atual dentro da janela do workspace.
 *      Gera shortlink, envia pros grupos staging, marca 'sent'.
 *
 * Slot scheduling:
 *   - Próximo envio = max(lastScheduled + intervalMin, agora+intervalMin)
 *   - Se cair fora da janela → empurra pro próximo dia 8h
 *   - Cada workspace tem sua própria timeline independente
 */
import { prisma } from './db.js';

/**
 * Parse "HH:MM" → minutos do dia (0–1439).
 */
function parseTimeOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Retorna true se a data fornecida cai dentro da janela [start, end] do workspace
 * em horário local do servidor (assumimos America/Sao_Paulo pelo deploy).
 */
export function isWithinSendWindow(ws, date = new Date()) {
  const start = parseTimeOfDay(ws.sendWindowStart) ?? 8 * 60;
  const end = parseTimeOfDay(ws.sendWindowEnd) ?? 22 * 60;
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= start && mins < end;
}

/**
 * Calcula o próximo slot disponível pra um workspace.
 * - Se agora está fora da janela → empurra pro início da próxima janela
 * - Se está dentro → max(lastScheduled + interval, agora + 1min)
 */
export async function computeNextSlot(ws, fromDate = new Date()) {
  const intervalMs = (ws.queueIntervalMin ?? 10) * 60_000;
  const start = parseTimeOfDay(ws.sendWindowStart) ?? 8 * 60;
  const end = parseTimeOfDay(ws.sendWindowEnd) ?? 22 * 60;

  // Última agendada (não enviada ainda)
  const last = await prisma.queuedSend.findFirst({
    where: { workspaceId: ws.id, status: { in: ['queued', 'sending'] } },
    orderBy: { scheduledFor: 'desc' },
    select: { scheduledFor: true },
  });

  let candidate = new Date(Math.max(
    fromDate.getTime() + 60_000,
    last ? last.scheduledFor.getTime() + intervalMs : 0,
  ));

  // Ajusta pra dentro da janela
  for (let i = 0; i < 3; i++) {
    const mins = candidate.getHours() * 60 + candidate.getMinutes();
    if (mins >= start && mins < end) return candidate;
    if (mins < start) {
      candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
      return candidate;
    }
    // mins >= end → próximo dia
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
  }
  return candidate;
}

/**
 * Round-robin entre buckets — tira 1 de cada bucket em rodízio até esvaziar.
 * Buckets que ficam vazios são removidos do rodízio. Ordem dos buckets é
 * embaralhada a cada nova rodada pra evitar viés sempre na mesma sequência.
 *
 * Ex: { beauty: [a,b,c], tech: [d,e], home: [f] }
 *     → a, d, f, b, e, c
 */
function interleaveByCategory(offers) {
  if (offers.length === 0) return [];
  const buckets = new Map();
  for (const o of offers) {
    const key = o.categoryDetected || 'other';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  }
  // Score desc dentro de cada bucket
  for (const arr of buckets.values()) {
    arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  const result = [];
  while (buckets.size > 0) {
    // Embaralha ordem dos buckets a cada rodada (pra não ser sempre
    // beauty→tech→home repetindo)
    const keys = shuffleInPlace([...buckets.keys()]);
    for (const k of keys) {
      const arr = buckets.get(k);
      const next = arr.shift();
      if (next) result.push(next);
      if (arr.length === 0) buckets.delete(k);
    }
  }
  return result;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Enfileira ofertas auto-aprovadas pra envio agendado.
 *
 * Pega ofertas pending com score >= threshold, intercala por categoria
 * (round-robin com buckets shuffled) pra evitar repetição do mesmo nicho
 * de produto consecutivamente, e cria QueuedSend pra cada uma.
 */
export async function enqueueApprovedOffers(ws, maxToQueue = 50) {
  if (!ws.autoApproveEnabled) return { enqueued: 0 };

  // Ofertas pending com score alto que ainda não estão na fila
  const existing = await prisma.queuedSend.findMany({
    where: { workspaceId: ws.id, status: { in: ['queued', 'sending'] } },
    select: { offerId: true },
  });
  const inQueue = new Set(existing.map((q) => q.offerId));

  // Puxa o dobro do max pra ter folga depois do round-robin
  const candidates = await prisma.offer.findMany({
    where: {
      workspaceId: ws.id,
      status: 'pending',
      score: { gte: ws.autoApproveThreshold },
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: maxToQueue * 3,
  });

  // Filtra os que já estão na fila e intercala por categoria
  const available = candidates.filter((o) => !inQueue.has(o.id));
  const ordered = interleaveByCategory(available);

  // Mantém também histórico recente de categorias enviadas pra evitar
  // que o primeiro item da fila seja da mesma categoria do ÚLTIMO enviado.
  // Isso suaviza a transição entre rebatches.
  const lastSent = await prisma.queuedSend.findFirst({
    where: { workspaceId: ws.id, status: 'sent' },
    orderBy: { sentAt: 'desc' },
    include: {
      // não tem relation pra Offer — busco por offerId depois
    },
  });
  let lastCategory = null;
  if (lastSent) {
    const lastOffer = await prisma.offer.findUnique({
      where: { id: lastSent.offerId },
      select: { categoryDetected: true },
    });
    lastCategory = lastOffer?.categoryDetected ?? null;
  }
  // Se o primeiro item da fila for da mesma categoria do último enviado,
  // troca com algum outro item de categoria diferente das próximas posições
  if (lastCategory && ordered.length > 1 && ordered[0].categoryDetected === lastCategory) {
    const swapIdx = ordered.findIndex((o, i) => i > 0 && o.categoryDetected !== lastCategory);
    if (swapIdx > 0) {
      [ordered[0], ordered[swapIdx]] = [ordered[swapIdx], ordered[0]];
    }
  }

  let enqueued = 0;
  for (const offer of ordered) {
    if (enqueued >= maxToQueue) break;
    const slot = await computeNextSlot(ws);
    try {
      await prisma.queuedSend.create({
        data: {
          workspaceId: ws.id,
          offerId: offer.id,
          scheduledFor: slot,
          status: 'queued',
        },
      });
      enqueued++;
    } catch {
      // unique constraint (workspaceId+offerId) — já enfileirado
    }
  }
  return { enqueued };
}

/**
 * Conta itens da fila por status.
 */
export async function getQueueStats(workspaceId) {
  const rows = await prisma.queuedSend.groupBy({
    by: ['status'],
    where: { workspaceId },
    _count: { _all: true },
  });
  const stats = { queued: 0, sending: 0, sent: 0, failed: 0, cancelled: 0 };
  for (const r of rows) stats[r.status] = r._count._all;
  return stats;
}

/**
 * Lista os próximos N itens enfileirados (pra UI).
 */
export async function listUpcoming(workspaceId, limit = 50) {
  return prisma.queuedSend.findMany({
    where: { workspaceId, status: { in: ['queued', 'sending'] } },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
    include: {
      // pega snapshot da oferta pra UI mostrar
    },
  });
}
