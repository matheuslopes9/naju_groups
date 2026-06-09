/**
 * Sender daemon — processa a fila de envios persistente.
 *
 * Loop a cada 30s:
 *   1. Busca QueuedSend com status='queued', scheduledFor <= now
 *   2. Filtra os que pertencem a workspaces dentro da janela de envio
 *   3. Pra cada um: gera shortlink (se faltar), envia pros grupos staging,
 *      marca 'sent' + offer.status='sent'
 *   4. Erro → marca 'failed' com mensagem; 3 falhas seguidas no mesmo workspace
 *      pausam o sender desse workspace por 30min (proteção anti-loop)
 */
import { prisma } from './db.js';
import { waManager } from './whatsapp/manager.js';
import { generateShortlink, getSessionStatus } from './ml/affiliate-browser.js';
import { validateOffer } from './ml/validator.js';
import { formatOffer } from './formatter.js';
import { isWithinSendWindow } from './queue.js';
import { createLogger } from './logger.js';

// Erros temporarios (WA caido, sem grupos): retry no proximo tick
// em vez de marcar 'failed' (que e' definitivo e perde a oferta).
class RetryableError extends Error {
  constructor(message, retryAfterMs = 5 * 60_000) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

const log = createLogger('sender');
const TICK_MS = 30_000;
const wsCooldown = new Map(); // workspaceId → timestamp until (cooldown após falhas)

export function startSender() {
  setInterval(() => tick().catch((e) => log.warn('tick falhou', { error: e.message })), TICK_MS);
  setTimeout(tick, 10_000);
  log.info('sender daemon iniciado', { tickMs: TICK_MS });
}

/**
 * Retorna timestamp do último envio bem-sucedido pra um workspace.
 * Usado pra respeitar queueIntervalMin entre envios consecutivos.
 *
 * Quando a fila tem itens atrasados (scheduledFor no passado), sem este
 * throttle o sender dispararia 1 a cada tick (30s), ignorando o intervalMin.
 * Sintoma: madrugada com fila vencida → 1 envio/minuto até esgotar.
 */
async function lastSentAt(workspaceId) {
  const row = await prisma.queuedSend.findFirst({
    where: { workspaceId, status: 'sent' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true },
  });
  return row?.sentAt ?? null;
}

async function tick() {
  // Pega itens vencidos da fila
  const due = await prisma.queuedSend.findMany({
    where: {
      status: 'queued',
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 20,
  });

  if (due.length === 0) return;

  // Agrupa por workspace pra checar janela 1× só
  const byWs = new Map();
  for (const q of due) {
    if (!byWs.has(q.workspaceId)) byWs.set(q.workspaceId, []);
    byWs.get(q.workspaceId).push(q);
  }

  for (const [workspaceId, items] of byWs.entries()) {
    const cooldownUntil = wsCooldown.get(workspaceId);
    if (cooldownUntil && Date.now() < cooldownUntil) continue;

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) continue;
    if (!isWithinSendWindow(ws)) continue;

    // Throttle: respeita queueIntervalMin entre envios.
    // Se o último 'sent' foi há menos que o intervalo configurado, espera.
    const intervalMs = (ws.queueIntervalMin ?? 5) * 60_000;
    const last = await lastSentAt(workspaceId);
    if (last) {
      const elapsed = Date.now() - last.getTime();
      if (elapsed < intervalMs) {
        // Ainda não passou o intervalo — pula esse workspace neste tick.
        // Pode aparecer no log debug se LOG_LEVEL=debug.
        log.debug('throttle: aguardando intervalo', {
          ws: ws.name,
          waitMs: intervalMs - elapsed,
          intervalMin: ws.queueIntervalMin,
        });
        continue;
      }
    }

    // Processa 1 item por workspace por tick
    const item = items[0];
    await processOne(ws, item);
  }
}

async function processOne(ws, queueItem) {
  // Marca como 'sending' pra evitar dois ticks pegarem o mesmo item
  try {
    await prisma.queuedSend.update({
      where: { id: queueItem.id },
      data: { status: 'sending' },
    });
  } catch {
    return; // já mudou de status
  }

  try {
    const offer = await prisma.offer.findUnique({ where: { id: queueItem.offerId } });
    if (!offer) {
      await markFailed(queueItem.id, 'Offer não existe mais');
      return;
    }
    if (offer.status === 'sent') {
      // já foi enviada por outro fluxo
      await prisma.queuedSend.update({
        where: { id: queueItem.id },
        data: { status: 'sent', sentAt: new Date() },
      });
      return;
    }

    // PRÉ-CHECKS rápidos antes de gastar Playwright/shortlink:
    // 1) WhatsApp conectado? Se não, retry no próximo tick (sem queimar shortlink)
    const waStatus = waManager.getStatusSync(ws.id);
    if (waStatus.status !== 'connected') {
      throw new RetryableError(`WhatsApp ${waStatus.status} (aguardando reconexão)`, 5 * 60_000);
    }

    // 2) Tem grupo staging? Sem grupo, não tem o que enviar
    const groups = await prisma.group.findMany({
      where: { workspaceId: ws.id, type: 'staging', enabled: true },
    });
    if (groups.length === 0) {
      await markFailed(queueItem.id, 'Nenhum grupo staging cadastrado');
      return;
    }

    // 3) Sessão afiliado conectada? (precisa pra gerar shortlink)
    if (!offer.shortlink) {
      const session = await getSessionStatus();
      if (session.status !== 'connected') {
        throw new RetryableError(`Sessão afiliado ${session.status}`, 10 * 60_000);
      }
    }

    // VALIDAÇÃO PRÉ-ENVIO: confere se oferta ainda está válida
    // (página existe, preço não subiu além de 5%, promoção ainda ativa).
    // Fail-safe: erro na validação assume válida (não bloqueia envio por
    // problemas de rede/ML lento).
    const validation = await validateOffer(offer);
    if (!validation.valid) {
      log.info('oferta expirada, pulando envio', {
        ws: ws.name,
        productId: offer.productId,
        reason: validation.reason,
        currentPrice: validation.currentPrice,
        recordedPrice: offer.price,
      });
      // Marca offer como expired + cancela este envio. Próximo item da fila
      // será pego no próximo tick.
      await prisma.$transaction([
        prisma.offer.update({
          where: { id: offer.id },
          data: { status: 'expired' },
        }),
        prisma.queuedSend.update({
          where: { id: queueItem.id },
          data: {
            status: 'cancelled',
            error: `expired:${validation.reason}`,
          },
        }),
      ]).catch(() => {});
      return;
    }

    // Garante shortlink (só agora — já confirmamos que dá pra enviar)
    let shortlink = offer.shortlink;
    if (!shortlink) {
      shortlink = await generateShortlink(offer.permalink);
      await prisma.offer.update({
        where: { id: offer.id },
        data: { shortlink, shortlinkAddedAt: new Date() },
      });
    }

    const text = formatOffer({
      title: offer.title,
      price: offer.price,
      originalPrice: offer.originalPrice,
      discountPercent: offer.discountPercent,
      freeShipping: offer.freeShipping,
      soldQuantity: offer.soldQuantity,
      affiliateUrl: shortlink,
      coupon: offer.coupon,
      highlight: offer.highlight,
      productId: offer.productId,
    }, {
      style: ws.adStyle ?? 'compact',
      nicheId: ws.nichePreset ?? null,
      audience: ws.audience ?? 'unisex',
    });

    for (const g of groups) {
      await waManager.sendMessage(ws.id, g.jid, {
        image: offer.imageUrl,
        caption: text,
        simulateTyping: ws.typingSimulation ?? true,
      });
    }

    // Sucesso
    await prisma.$transaction([
      prisma.queuedSend.update({
        where: { id: queueItem.id },
        data: { status: 'sent', sentAt: new Date() },
      }),
      prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'sent', sentAt: new Date() },
      }),
    ]);
    // Limpa cooldown depois de um sucesso
    wsCooldown.delete(ws.id);

    await prisma.agentAction.create({
      data: {
        workspaceId: ws.id,
        offerId: offer.id,
        action: 'approve',
        reason: 'fila enviada',
        metadata: { score: offer.score },
      },
    }).catch(() => {});

    log.info('enviado', { ws: ws.name, title: offer.title.slice(0, 60), score: offer.score });
  } catch (e) {
    if (e instanceof RetryableError) {
      // Erro temporário: devolve item pra fila pra próximo tick (com pequeno delay)
      await markRetry(queueItem.id, e.message, e.retryAfterMs);
      // Cooldown leve do workspace pra evitar martelar quando o problema é
      // sistêmico (ex: WA caído pra todos os itens)
      wsCooldown.set(ws.id, Date.now() + Math.min(e.retryAfterMs, 5 * 60_000));
      log.info('retry agendado', { ws: ws.name, reason: e.message, retryInMin: Math.round(e.retryAfterMs / 60_000) });
      return;
    }
    log.warn('envio falhou', { ws: ws.name, error: e.message });
    await markFailed(queueItem.id, e.message);
    bumpCooldown(ws.id);
  }
}

async function markFailed(queueId, error) {
  await prisma.queuedSend.update({
    where: { id: queueId },
    data: { status: 'failed', error: String(error).slice(0, 500) },
  }).catch(() => {});
}

/**
 * Devolve item pra fila pra próximo tick. Move scheduledFor pra now + delayMs
 * e marca status='queued' de novo. Diferente de markFailed (que é definitivo).
 *
 * Usado pra erros transitórios: WA caído, sessão afiliado expirada, etc.
 * Quando o usuário reconecta, o item dispara automaticamente.
 */
async function markRetry(queueId, reason, delayMs) {
  await prisma.queuedSend.update({
    where: { id: queueId },
    data: {
      status: 'queued',
      scheduledFor: new Date(Date.now() + delayMs),
      error: `retry: ${String(reason).slice(0, 200)}`,
    },
  }).catch(() => {});
}

function bumpCooldown(workspaceId) {
  // 30min de cooldown depois de erro — protege contra loops
  wsCooldown.set(workspaceId, Date.now() + 30 * 60 * 1000);
}
