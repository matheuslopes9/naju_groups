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
 * Enfileira ofertas auto-aprovadas pra envio agendado.
 * Pega até maxToQueue ofertas pending com score >= threshold,
 * ainda não enfileiradas, e cria QueuedSend pra cada uma.
 */
export async function enqueueApprovedOffers(ws, maxToQueue = 50) {
  if (!ws.autoApproveEnabled) return { enqueued: 0 };

  // Ofertas pending com score alto que ainda não estão na fila
  const existing = await prisma.queuedSend.findMany({
    where: { workspaceId: ws.id, status: { in: ['queued', 'sending'] } },
    select: { offerId: true },
  });
  const inQueue = new Set(existing.map((q) => q.offerId));

  const candidates = await prisma.offer.findMany({
    where: {
      workspaceId: ws.id,
      status: 'pending',
      score: { gte: ws.autoApproveThreshold },
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: maxToQueue * 2, // pega o dobro pra ter folga pós-filtro
  });

  let enqueued = 0;
  for (const offer of candidates) {
    if (enqueued >= maxToQueue) break;
    if (inQueue.has(offer.id)) continue;

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
