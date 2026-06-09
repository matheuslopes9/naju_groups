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

// Janela de envio é interpretada em horário de Brasília (UTC-3 fixo).
// Servidor (EasyPanel/Docker) roda em UTC, então NÃO podemos usar
// date.getHours()/setHours() — esses retornam hora local do servidor (UTC),
// causando defasagem de 3h: "08:00 - 22:00" virava "05:00 BRT - 19:00 BRT".
// BR não tem mais DST desde 2019, então offset é fixo.
const BRT_OFFSET_MIN = -180; // Brasília = UTC - 3h

/**
 * Parse "HH:MM" → minutos do dia (0–1439).
 */
function parseTimeOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Retorna minutos-do-dia (0-1439) em horário de Brasília pra um Date UTC.
 */
function minutesOfDayBRT(date) {
  // Pega UTC time → subtrai 3h → resto da divisão por 24h vira minutos do dia BRT
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  // Adiciona offset (negativo) e normaliza pra 0-1439
  return ((utcMin + BRT_OFFSET_MIN) % 1440 + 1440) % 1440;
}

/**
 * Constrói um Date UTC representando uma hora-do-dia em BRT.
 * fromDate define o "dia base" (em BRT). Se a hora cair no dia anterior/seguinte
 * em UTC, o resultado já reflete isso corretamente.
 *
 * Ex: 08:00 BRT no dia 20/05 → 2026-05-20T11:00:00.000Z
 */
function brtTimeOnDate(fromDate, minutesOfDayBrt) {
  // Pega o "dia BRT" atual (data corrente em BRT)
  const brt = new Date(fromDate.getTime() + BRT_OFFSET_MIN * 60_000);
  // Cria Date em BRT com hh:mm desejado
  const result = new Date(Date.UTC(
    brt.getUTCFullYear(),
    brt.getUTCMonth(),
    brt.getUTCDate(),
    Math.floor(minutesOfDayBrt / 60),
    minutesOfDayBrt % 60,
    0, 0,
  ));
  // Mas isso ficou em UTC tratando os hh:mm como UTC. Pra virar BRT, ADICIONO 3h
  return new Date(result.getTime() - BRT_OFFSET_MIN * 60_000);
}

/**
 * Retorna true se a data fornecida cai dentro da janela [start, end] em BRT.
 */
export function isWithinSendWindow(ws, date = new Date()) {
  const start = parseTimeOfDay(ws.sendWindowStart) ?? 8 * 60;
  const end = parseTimeOfDay(ws.sendWindowEnd) ?? 22 * 60;
  const mins = minutesOfDayBRT(date);
  return mins >= start && mins < end;
}

/**
 * Calcula o próximo slot disponível pra um workspace.
 * - Se agora está fora da janela → empurra pro início da próxima janela
 * - Se está dentro → max(lastScheduled + interval, agora + 1min)
 */
export async function computeNextSlot(ws, fromDate = new Date()) {
  const intervalMs = (ws.queueIntervalMin ?? 5) * 60_000;
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

  return clampToWindow(candidate, start, end);
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
  // Shuffle ponderado por score² dentro de cada bucket — top ofertas vem
  // primeiro mais frequentemente, mas a ordem exata varia entre rebatches.
  for (const [key, arr] of buckets.entries()) {
    buckets.set(key, weightedShuffle(arr));
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
 * Weighted shuffle — embaralha um array dando peso proporcional a score².
 * Itens com score alto têm mais chance de vir nas primeiras posições, mas
 * a ordem exata muda entre execuções.
 *
 * Algoritmo: "weighted reservoir sampling" via key = -log(random())/weight,
 * ordena por key asc. Resultado: itens com weight alto tendem a key baixa
 * (vem primeiro), mas com variação aleatória.
 *
 * Usa score² pra penalizar score baixo mais fortemente — diferença entre
 * score 80 e 60 vira 6400 vs 3600 (1.78×), em vez de 1.33×.
 */
function weightedShuffle(items) {
  return items
    .map((item) => {
      const weight = Math.max(1, (item.score ?? 50) ** 2);
      // -log(u)/w é distribuição exponencial. Menor key = sai primeiro.
      const key = -Math.log(1 - Math.random()) / weight;
      return { item, key };
    })
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item);
}

/**
 * Enfileira ofertas auto-aprovadas pra envio agendado.
 *
 * Pega ofertas pending com score >= threshold, intercala por categoria
 * (round-robin com buckets shuffled) pra evitar repetição do mesmo nicho
 * de produto consecutivamente, e cria QueuedSend pra cada uma.
 */
export async function enqueueApprovedOffers(ws, maxToQueue = 500) {
  if (!ws.autoApproveEnabled) return { enqueued: 0 };

  // Pega TODOS os QueuedSend existentes pra evitar P2002 no create.
  // Unique constraint é (workspaceId, offerId) sem filtrar por status —
  // então mesmo registros 'sent', 'cancelled', 'failed' ocupam o slot.
  // Filtrando antes evita dispar prisma:error no log.
  const existing = await prisma.queuedSend.findMany({
    where: { workspaceId: ws.id },
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

  // ordered já foi filtrado por !inQueue acima → create não dá conflito.
  // Cada item precisa de scheduledFor único calculado em sequência (round-robin
  // de slots), por isso loop em vez de createMany.
  let enqueued = 0;
  for (const offer of ordered) {
    if (enqueued >= maxToQueue) break;
    const slot = await computeNextSlot(ws);
    await prisma.queuedSend.create({
      data: {
        workspaceId: ws.id,
        offerId: offer.id,
        scheduledFor: slot,
        status: 'queued',
      },
    });
    enqueued++;
  }
  return { enqueued };
}

/**
 * Re-agenda TODOS os itens 'queued' do workspace com os filtros/janela
 * atuais. Útil quando o usuário mudou queueIntervalMin/sendWindow*.
 *
 * Ordem dos itens é preservada (orderBy scheduledFor asc). Apenas
 * `scheduledFor` é recalculado em sequência a partir de "agora".
 */
export async function rescheduleQueue(ws) {
  const intervalMs = (ws.queueIntervalMin ?? 5) * 60_000;
  const start = parseTimeOfDay(ws.sendWindowStart) ?? 8 * 60;
  const end = parseTimeOfDay(ws.sendWindowEnd) ?? 22 * 60;

  const items = await prisma.queuedSend.findMany({
    where: { workspaceId: ws.id, status: 'queued' },
    orderBy: { scheduledFor: 'asc' },
    select: { id: true },
  });

  if (items.length === 0) return { rescheduled: 0 };

  // Calcula slot inicial: agora + 1min, ajustado pra dentro da janela
  let cursor = new Date(Date.now() + 60_000);
  cursor = clampToWindow(cursor, start, end);

  let updated = 0;
  for (const item of items) {
    await prisma.queuedSend.update({
      where: { id: item.id },
      data: { scheduledFor: cursor },
    });
    updated++;
    // próximo slot
    cursor = clampToWindow(new Date(cursor.getTime() + intervalMs), start, end);
  }
  return { rescheduled: updated };
}

/**
 * Ajusta uma data pra cair dentro da janela [start, end] de minutos-do-dia BRT.
 * Se já está dentro, retorna. Se está antes, empurra pro início (BRT). Se está
 * depois, empurra pro início do próximo dia (BRT).
 */
function clampToWindow(date, startMin, endMin) {
  for (let i = 0; i < 3; i++) {
    const mins = minutesOfDayBRT(date);
    if (mins >= startMin && mins < endMin) return date;
    if (mins < startMin) {
      // Mesmo dia BRT, hora = start
      return brtTimeOnDate(date, startMin);
    }
    // mins >= endMin → dia seguinte BRT, hora = start
    date = brtTimeOnDate(new Date(date.getTime() + 24 * 60 * 60 * 1000), startMin);
  }
  return date;
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
