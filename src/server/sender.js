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
import { formatOffer } from './formatter.js';
import { isWithinSendWindow } from './queue.js';
import { createLogger } from './logger.js';

const log = createLogger('sender');
const TICK_MS = 30_000;
const wsCooldown = new Map(); // workspaceId → timestamp until

export function startSender() {
  setInterval(() => tick().catch((e) => log.warn('tick falhou', { error: e.message })), TICK_MS);
  setTimeout(tick, 10_000);
  log.info('sender daemon iniciado', { tickMs: TICK_MS });
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

    // Processa 1 item por workspace por tick (respeita o intervalMin natural)
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

    // Garante shortlink
    let shortlink = offer.shortlink;
    if (!shortlink) {
      const session = await getSessionStatus();
      if (session.status !== 'connected') {
        await markFailed(queueItem.id, `Sessão afiliado: ${session.status}`);
        bumpCooldown(ws.id);
        return;
      }
      shortlink = await generateShortlink(offer.permalink);
      await prisma.offer.update({
        where: { id: offer.id },
        data: { shortlink, shortlinkAddedAt: new Date() },
      });
    }

    const groups = await prisma.group.findMany({
      where: { workspaceId: ws.id, type: 'staging', enabled: true },
    });
    if (groups.length === 0) {
      await markFailed(queueItem.id, 'Nenhum grupo staging cadastrado');
      return;
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

function bumpCooldown(workspaceId) {
  // 30min de cooldown depois de erro — protege contra loops
  wsCooldown.set(workspaceId, Date.now() + 30 * 60 * 1000);
}
