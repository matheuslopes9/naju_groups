/**
 * Agente automático: depois do scraping, processa ofertas pending de cada
 * workspace que tem autoApproveEnabled. Pra cada uma com score >= threshold,
 * tenta gerar shortlink via Playwright e envia pros grupos staging.
 *
 * Limites:
 *   - autoApproveMaxDaily: máximo de aprovações automáticas por dia/workspace
 *   - Sessão headless precisa estar 'connected'
 *   - Em qualquer erro, marca a oferta como pending (fallback humano)
 */
import { prisma } from './db.js';
import { generateShortlink, getSessionStatus } from './ml/affiliate-browser.js';
import { waManager } from './whatsapp/manager.js';
import { formatOffer } from './formatter.js';

async function logAgentAction(action, opts = {}) {
  await prisma.agentAction.create({
    data: {
      action,
      workspaceId: opts.workspaceId ?? null,
      offerId: opts.offerId ?? null,
      reason: opts.reason ?? null,
      metadata: opts.metadata ? opts.metadata : undefined,
    },
  }).catch(() => {});
}

async function countTodayApprovals(workspaceId) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return prisma.agentAction.count({
    where: {
      workspaceId,
      action: 'approve',
      createdAt: { gte: since },
    },
  });
}

async function lastApprovalAt(workspaceId) {
  const row = await prisma.agentAction.findFirst({
    where: { workspaceId, action: 'approve' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/**
 * Processa um workspace: pega ofertas pendentes com score >= threshold,
 * gera shortlink, envia, marca como sent.
 */
export async function runAgentForWorkspace(ws) {
  if (!ws.autoApproveEnabled) return { processed: 0, sent: 0 };

  const sessionStatus = await getSessionStatus();
  if (sessionStatus.status !== 'connected') {
    await logAgentAction('skip', {
      workspaceId: ws.id,
      reason: `Sessão de afiliado: ${sessionStatus.status}`,
    });
    return { processed: 0, sent: 0, skipReason: 'affiliate-session-not-connected' };
  }

  const todayCount = await countTodayApprovals(ws.id);
  const remaining = (ws.autoApproveMaxDaily ?? 10) - todayCount;
  if (remaining <= 0) {
    await logAgentAction('skip', {
      workspaceId: ws.id,
      reason: `Limite diário atingido (${ws.autoApproveMaxDaily})`,
    });
    return { processed: 0, sent: 0, skipReason: 'daily-limit-reached' };
  }

  // Respeita intervalo mínimo entre envios (default 6 min = 10/hora)
  const minIntervalMs = (ws.autoApproveMinIntervalMin ?? 6) * 60 * 1000;
  const lastAt = await lastApprovalAt(ws.id);
  if (lastAt) {
    const elapsed = Date.now() - lastAt.getTime();
    if (elapsed < minIntervalMs) {
      const waitSec = Math.ceil((minIntervalMs - elapsed) / 1000);
      await logAgentAction('skip', {
        workspaceId: ws.id,
        reason: `Throttle: aguardando ${waitSec}s pro próximo envio (mínimo ${ws.autoApproveMinIntervalMin}min)`,
      });
      return { processed: 0, sent: 0, skipReason: 'throttle' };
    }
  }

  const groups = await prisma.group.findMany({
    where: { workspaceId: ws.id, type: 'staging', enabled: true },
  });
  if (groups.length === 0) {
    return { processed: 0, sent: 0, skipReason: 'no-groups' };
  }

  // Pega só UMA oferta por execução do agente (throttle natural).
  // O worker roda a cada 60s e checa o intervalo mínimo na próxima iteração.
  const candidates = await prisma.offer.findMany({
    where: {
      workspaceId: ws.id,
      status: 'pending',
      score: { gte: ws.autoApproveThreshold },
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: 1,
  });

  if (candidates.length === 0) {
    return { processed: 0, sent: 0, skipReason: 'no-candidates' };
  }

  let sent = 0;
  for (const offer of candidates) {
    try {
      let shortlink = offer.shortlink;
      if (!shortlink) {
        shortlink = await generateShortlink(offer.permalink);
        await prisma.offer.update({
          where: { id: offer.id },
          data: { shortlink, shortlinkAddedAt: new Date() },
        });
      }

      // Formata com estilo + audience do workspace
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

      await prisma.offer.update({
        where: { id: offer.id },
        data: { status: 'sent', sentAt: new Date() },
      });

      await logAgentAction('approve', {
        workspaceId: ws.id,
        offerId: offer.id,
        reason: `Score ${offer.score} >= threshold ${ws.autoApproveThreshold}`,
        metadata: { score: offer.score, price: offer.price, commission: offer.estimatedCommission },
      });
      sent++;
    } catch (e) {
      await logAgentAction('error', {
        workspaceId: ws.id,
        offerId: offer.id,
        reason: e.message,
      });
    }
  }

  return { processed: candidates.length, sent };
}

/**
 * Roda agente em TODOS os workspaces com auto-aprovação ativada.
 */
export async function runAgentAll() {
  const workspaces = await prisma.workspace.findMany({
    where: { autoApproveEnabled: true },
  });

  const results = [];
  for (const ws of workspaces) {
    try {
      const r = await runAgentForWorkspace(ws);
      results.push({ workspace: ws.name, ...r });
    } catch (e) {
      results.push({ workspace: ws.name, error: e.message });
    }
  }
  return results;
}
