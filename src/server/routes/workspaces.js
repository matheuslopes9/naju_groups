import { Router } from 'express';
import { prisma } from '../db.js';
import { waManager } from '../whatsapp/manager.js';
import { formatOffer } from '../formatter.js';
import { audit } from '../audit.js';
import { fetchItemByUrl, listCatalogSources } from '../ml/scraper.js';
import { attachAffiliateTag } from '../ml/affiliate.js';
import { getAffiliateTag } from '../ml/oauth.js';
import { NICHE_PRESETS, findNiche } from '../ml/niches.js';
import { runCatalogSweep, getCatalogSweepStatus, distributeToWorkspace, applyWorkspaceFilters, sweepEmitter, getSweepBuffer } from '../catalog-worker.js';
import { getQueueStats, listUpcoming, enqueueApprovedOffers, rescheduleQueue } from '../queue.js';
import { createLogger } from '../logger.js';

const log = createLogger('api');

const router = Router();

// Métricas agregadas pra dashboard
router.get('/stats', async (_req, res) => {
  const [workspaces, pendingCount, sentCount, rejectedCount, totalSaved, latestPending, pendingWithShortlink] = await Promise.all([
    prisma.workspace.count(),
    prisma.offer.count({ where: { status: 'pending' } }),
    prisma.offer.count({ where: { status: 'sent' } }),
    prisma.offer.count({ where: { status: 'rejected' } }),
    prisma.offer.aggregate({ _sum: { discountPercent: true } }),
    prisma.offer.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { workspace: { select: { name: true, id: true } } },
    }),
    prisma.offer.count({ where: { status: 'pending', shortlink: { not: null } } }),
  ]);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const byDay = await prisma.offer.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { createdAt: { gte: since } },
  });

  // Pendentes por workspace (top)
  const pendingByWs = await prisma.offer.groupBy({
    by: ['workspaceId'],
    where: { status: 'pending' },
    _count: { _all: true },
    orderBy: { _count: { workspaceId: 'desc' } },
    take: 5,
  });
  const wsMap = await prisma.workspace.findMany({
    where: { id: { in: pendingByWs.map((p) => p.workspaceId) } },
    select: { id: true, name: true },
  });
  const wsName = Object.fromEntries(wsMap.map((w) => [w.id, w.name]));

  res.json({
    workspaces,
    offers: {
      pending: pendingCount,
      pendingWithShortlink,
      pendingReady: pendingWithShortlink, // alias
      pendingNeedShortlink: pendingCount - pendingWithShortlink,
      sent: sentCount,
      rejected: rejectedCount,
      total: pendingCount + sentCount + rejectedCount,
    },
    last7d: Object.fromEntries(byDay.map((b) => [b.status, b._count._all])),
    latestPending: latestPending.map((o) => ({
      id: o.id,
      title: o.title,
      imageUrl: o.imageUrl,
      price: o.price,
      discountPercent: o.discountPercent,
      workspaceId: o.workspaceId,
      workspaceName: o.workspace.name,
      createdAt: o.createdAt,
    })),
    topPendingWorkspaces: pendingByWs.map((p) => ({
      id: p.workspaceId,
      name: wsName[p.workspaceId] ?? '—',
      count: p._count._all,
    })),
  });
});

router.get('/', async (_req, res) => {
  const items = await prisma.workspace.findMany({
    include: {
      whatsappSession: true,
      _count: { select: { groups: true, offers: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const ids = items.map((w) => w.id);
  // Contagem da fila + envios de hoje, pra mostrar no card do workspace
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [queued, sentToday] = await Promise.all([
    prisma.queuedSend.groupBy({
      by: ['workspaceId'],
      where: { workspaceId: { in: ids }, status: 'queued' },
      _count: { _all: true },
    }),
    prisma.queuedSend.groupBy({
      by: ['workspaceId'],
      where: { workspaceId: { in: ids }, status: 'sent', sentAt: { gte: startOfDay } },
      _count: { _all: true },
    }),
  ]);
  const queueMap = Object.fromEntries(queued.map((q) => [q.workspaceId, q._count._all]));
  const sentMap  = Object.fromEntries(sentToday.map((q) => [q.workspaceId, q._count._all]));
  const enriched = items.map((w) => ({
    ...w,
    wa: waManager.getStatusSync(w.id),
    queueCount: queueMap[w.id] ?? 0,
    sentToday: sentMap[w.id] ?? 0,
  }));
  res.json(enriched);
});

router.post('/', async (req, res) => {
  const b = req.body ?? {};
  if (!b.name) return res.status(400).json({ error: 'name é obrigatório' });
  const ws = await prisma.workspace.create({
    data: {
      name: b.name,
      niche: b.niche ?? null,
      description: b.description ?? null,
      keywords: b.keywords ?? null,
      minDiscount: b.minDiscount ?? 20,
      onlyFreeShipping: b.onlyFreeShipping ?? true,
      onlyDeals: b.onlyDeals ?? true,
      priceMin: b.priceMin ?? null,
      priceMax: b.priceMax ?? null,
      cooldownDays: b.cooldownDays ?? 30,
      sendWindowStart: b.sendWindowStart ?? '08:00',
      sendWindowEnd: b.sendWindowEnd ?? '22:00',
      queueIntervalMin: b.queueIntervalMin ?? 5,
    },
  });
  audit('workspace.create', { entity: 'workspace', entityId: ws.id, workspaceId: ws.id, payload: { name: b.name } });
  res.status(201).json(ws);
});

router.get('/:id', async (req, res) => {
  const ws = await prisma.workspace.findUnique({
    where: { id: req.params.id },
    include: { whatsappSession: true, groups: true },
  });
  if (!ws) return res.status(404).json({ error: 'not found' });
  res.json({ ...ws, wa: waManager.getStatusSync(ws.id) });
});

router.patch('/:id', async (req, res) => {
  const allowed = [
    'name', 'niche', 'description',
    'minDiscount', 'onlyFreeShipping', 'onlyDeals',
    'keywords', 'priceMin', 'priceMax', 'cooldownDays',
    'autoApproveEnabled', 'autoApproveThreshold', 'autoApproveMaxDaily',
    'nichePreset', 'extraNiches', 'audience', 'adStyle', 'typingSimulation',
    'sendWindowStart', 'sendWindowEnd', 'queueIntervalMin',
  ];
  const data = {};
  for (const k of allowed) if (k in (req.body ?? {})) data[k] = req.body[k];

  // Detecta mudança de timing — vai disparar reagendamento da fila depois
  const prev = await prisma.workspace.findUnique({
    where: { id: req.params.id },
    select: { queueIntervalMin: true, sendWindowStart: true, sendWindowEnd: true },
  });
  const timingChanged = prev && (
    ('queueIntervalMin' in data && data.queueIntervalMin !== prev.queueIntervalMin) ||
    ('sendWindowStart' in data && data.sendWindowStart !== prev.sendWindowStart) ||
    ('sendWindowEnd' in data && data.sendWindowEnd !== prev.sendWindowEnd)
  );

  const ws = await prisma.workspace.update({ where: { id: req.params.id }, data });

  let rescheduled = 0;
  if (timingChanged) {
    try {
      const r = await rescheduleQueue(ws);
      rescheduled = r.rescheduled;
    } catch (e) {
      log.warn('reschedule queue falhou', { ws: ws.id, error: e.message });
    }
  }

  res.json({ ...ws, _rescheduled: rescheduled });
});

// Limpa histórico de ofertas do workspace (reset cooldown)
// Aceita ?status=pending|sent|rejected|all (default: all)
router.post('/:id/offers/reset', async (req, res) => {
  const status = (req.query.status ?? 'all').toString();
  const where = { workspaceId: req.params.id };
  if (status !== 'all') where.status = status;
  const result = await prisma.offer.deleteMany({ where });
  audit('offer.reset', {
    entity: 'workspace',
    entityId: req.params.id,
    workspaceId: req.params.id,
    payload: { deleted: result.count, status },
  });
  res.json({ ok: true, deleted: result.count });
});

router.delete('/:id', async (req, res) => {
  await waManager.stop(req.params.id).catch(() => {});
  await prisma.workspace.delete({ where: { id: req.params.id } });
  audit('workspace.delete', { entity: 'workspace', entityId: req.params.id, workspaceId: req.params.id });
  res.json({ ok: true });
});

// WhatsApp ações
router.post('/:id/whatsapp/connect', async (req, res) => {
  await waManager.start(req.params.id);
  audit('wa.connect', { entity: 'wa', workspaceId: req.params.id });
  res.json({ ok: true, status: waManager.getStatusSync(req.params.id) });
});

router.post('/:id/whatsapp/disconnect', async (req, res) => {
  await waManager.stop(req.params.id);
  audit('wa.disconnect', { entity: 'wa', workspaceId: req.params.id });
  res.json({ ok: true });
});

router.post('/:id/whatsapp/pause', async (req, res) => {
  await waManager.pause(req.params.id);
  audit('wa.pause', { entity: 'wa', workspaceId: req.params.id });
  res.json({ ok: true });
});

// Reset completo: para sessão + apaga credenciais + permite gerar QR novo
router.post('/:id/whatsapp/reset', async (req, res) => {
  try {
    await waManager.stop(req.params.id).catch(() => {});
    await waManager.clearCredentials(req.params.id);
    await prisma.whatsappSession.update({
      where: { workspaceId: req.params.id },
      data: { status: 'disconnected', phoneNumber: null },
    }).catch(() => {});
    audit('wa.reset', { entity: 'wa', workspaceId: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/whatsapp/resume', async (req, res) => {
  await waManager.resume(req.params.id);
  audit('wa.resume', { entity: 'wa', workspaceId: req.params.id });
  res.json({ ok: true, status: waManager.getStatusSync(req.params.id) });
});

router.get('/:id/whatsapp/status', async (req, res) => {
  res.json(await waManager.getStatus(req.params.id));
});

router.get('/:id/whatsapp/groups', async (req, res) => {
  try {
    const groups = await waManager.listGroups(req.params.id);
    res.json(groups);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Grupos cadastrados (subset dos do WhatsApp que você marcou como ativos)
router.get('/:id/groups', async (req, res) => {
  const groups = await prisma.group.findMany({ where: { workspaceId: req.params.id } });
  res.json(groups);
});

router.post('/:id/groups', async (req, res) => {
  const { jid, name, type = 'staging' } = req.body ?? {};
  if (!jid || !name) return res.status(400).json({ error: 'jid e name obrigatórios' });
  try {
    const g = await prisma.group.create({
      data: { workspaceId: req.params.id, jid, name, type },
    });
    res.status(201).json(g);
  } catch (e) {
    res.status(400).json({ error: 'já cadastrado ou inválido' });
  }
});

router.delete('/:id/groups/:groupId', async (req, res) => {
  await prisma.group.delete({ where: { id: req.params.groupId } });
  res.json({ ok: true });
});

// ---- Catálogo de fontes (15 URLs do ML — varredura global) ----

router.get('/ml/catalog', async (_req, res) => {
  res.json(listCatalogSources());
});

// Status da varredura: além do lastSweepAt, retorna hasSweptToday
// que o frontend usa pra decidir se mostra o modal de boas-vindas.
router.get('/catalog/sweep/status', async (_req, res) => {
  const status = getCatalogSweepStatus();
  let hasSweptToday = false;
  if (status.lastSweepAt) {
    const last = new Date(status.lastSweepAt);
    const now = new Date();
    hasSweptToday = last.toDateString() === now.toDateString();
  }
  res.json({ ...status, hasSweptToday });
});

// SSE da varredura. Comportamento:
//   - Se nenhuma varredura rolando → dispara nova e stream os eventos
//   - Se já tem uma rolando (cron OU outro user disparou) → anexa,
//     faz replay dos eventos do buffer e segue ouvindo emitter
// Resultado: múltiplos clientes podem ver A MESMA varredura ao vivo.
router.get('/catalog/sweep/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (evt) => {
    try { res.write(`data: ${JSON.stringify(evt)}\n\n`); } catch {}
  };

  const status = getCatalogSweepStatus();
  const listener = (evt) => send(evt);

  if (status.inFlight) {
    // Anexa: replay do buffer + ouve futuros
    send({ stage: 'attached', message: 'Varredura já em andamento, anexando ao stream' });
    for (const evt of getSweepBuffer()) send(evt);
    sweepEmitter.on('event', listener);
  } else {
    // Inicia nova varredura. emitter já cuida do broadcast.
    sweepEmitter.on('event', listener);
    runCatalogSweep().catch((e) => send({ stage: 'error', error: e.message }));
  }

  // Encerra stream quando varredura termina (done|error|finished)
  const cleanup = () => {
    sweepEmitter.off('event', listener);
    try { res.end(); } catch {}
  };
  const finalize = (evt) => {
    if (evt && (evt.stage === 'done' || evt.stage === 'finished' || evt.stage === 'error')) {
      // Pequeno delay pra garantir que o último evento foi flushed
      setTimeout(cleanup, 100);
    }
  };
  sweepEmitter.on('event', finalize);

  req.on('close', () => {
    sweepEmitter.off('event', finalize);
    cleanup();
  });
});

// Lista os nichos pré-cadastrados pra dropdown no workspace
router.get('/ml/niches', async (_req, res) => {
  res.json(NICHE_PRESETS);
});

// Aplica preset de nicho(s) ao workspace.
// Body: { primary: 'beauty-f', extras: ['fashion-f', 'babies'] }
//   - primary: nicho que decide o TOM da copy (hooks/closers)
//   - extras: nichos adicionais cujas keywords são agregadas
// Keywords finais = união (dedup) das keywords do primary + extras.
// Audience é herdada do primary.
//
// Compat com chamadas antigas { nicheId: 'beauty-f' } — trata como primary
// sem extras.
router.post('/:id/apply-niche', async (req, res) => {
  const b = req.body ?? {};
  const primaryId = b.primary ?? b.nicheId;
  const extras = Array.isArray(b.extras) ? b.extras : [];

  const primary = findNiche(primaryId);
  if (!primary) return res.status(400).json({ error: 'nicho principal desconhecido' });

  const extraNiches = extras
    .map((id) => findNiche(id))
    .filter((n) => n && n.id !== primary.id);

  // União de keywords (case-insensitive dedup, mantém ordem do primary primeiro)
  const seen = new Set();
  const kws = [];
  for (const n of [primary, ...extraNiches]) {
    for (const k of (n.keywords ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const low = k.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      kws.push(k);
    }
  }

  const updated = await prisma.workspace.update({
    where: { id: req.params.id },
    data: {
      nichePreset: primary.id,
      extraNiches: extraNiches.length > 0 ? extraNiches.map((n) => n.id).join(',') : null,
      audience: primary.audience,
      keywords: kws.join(', '),
    },
  });
  audit('workspace.niche_applied', {
    entity: 'workspace', entityId: req.params.id, workspaceId: req.params.id,
    payload: { primary: primary.id, extras: extraNiches.map((n) => n.id) },
  });
  res.json(updated);
});

// Adicionar oferta MANUAL via URL colada (escape do bloqueio da API ML)
router.post('/:id/offers/add-by-url', async (req, res) => {
  const { url } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'URL obrigatória' });
  try {
    const o = await fetchItemByUrl(url);
    const affTag = await getAffiliateTag();
    const affiliateUrl = attachAffiliateTag(o.permalink, affTag);
    const offer = await prisma.offer.create({
      data: {
        workspaceId: req.params.id,
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
        status: 'pending',
      },
    });
    audit('offer.add_manual', { entity: 'offer', entityId: offer.id, workspaceId: req.params.id });
    res.status(201).json(offer);
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Esta oferta já foi adicionada (mesmo produto)' });
    }
    res.status(400).json({ error: e.message });
  }
});

// Fila de envio: estatísticas + próximos
router.get('/:id/queue/stats', async (req, res) => {
  const stats = await getQueueStats(req.params.id);
  res.json(stats);
});

router.get('/:id/queue/upcoming', async (req, res) => {
  const items = await listUpcoming(req.params.id, 50);
  // anexa snapshot da oferta
  const offerIds = items.map((i) => i.offerId);
  const offers = await prisma.offer.findMany({ where: { id: { in: offerIds } } });
  const offerMap = Object.fromEntries(offers.map((o) => [o.id, o]));
  res.json(items.map((i) => ({
    id: i.id,
    offerId: i.offerId,
    scheduledFor: i.scheduledFor,
    status: i.status,
    offer: offerMap[i.offerId] ? {
      title: offerMap[i.offerId].title,
      imageUrl: offerMap[i.offerId].imageUrl,
      price: offerMap[i.offerId].price,
      discountPercent: offerMap[i.offerId].discountPercent,
      score: offerMap[i.offerId].score,
    } : null,
  })));
});

router.post('/:id/queue/cancel/:queueId', async (req, res) => {
  await prisma.queuedSend.update({
    where: { id: req.params.queueId },
    data: { status: 'cancelled' },
  });
  res.json({ ok: true });
});

router.post('/:id/queue/reschedule', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'workspace não existe' });
  const r = await rescheduleQueue(ws);
  res.json(r);
});

router.post('/:id/queue/refill', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'workspace não existe' });
  const r = await enqueueApprovedOffers(ws, 500);
  res.json(r);
});

/**
 * QUICK START: pega tudo que já foi scaneado, aplica filtros atuais do
 * workspace, salva Offers + enfileira + ativa autoApprove.
 *
 * Não revarre o ML — usa o que já está em ScrapedOffer (varredura global de 6h).
 * Body opcional: { activate: true } (default true) liga autoApproveEnabled.
 */
router.post('/:id/quick-start', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'workspace não existe' });

  const activate = req.body?.activate !== false;
  let activated = false;
  if (activate && !ws.autoApproveEnabled) {
    await prisma.workspace.update({ where: { id: ws.id }, data: { autoApproveEnabled: true } });
    ws.autoApproveEnabled = true;
    activated = true;
  }

  // 1) reprocessa histórico scaneado com filtros atuais
  const stats = await distributeToWorkspace(ws);

  // 2) enfileira ofertas com score alto
  const queue = await enqueueApprovedOffers(ws, 500);

  audit('workspace.quick_start', {
    entity: 'workspace', entityId: ws.id, workspaceId: ws.id,
    payload: { ...stats, enqueued: queue.enqueued, activated },
  });
  res.json({ ...stats, enqueued: queue.enqueued, activated });
});

/**
 * STATS DE FILTRO: aplica os filtros do workspace em todas as ScrapedOffer
 * SEM persistir nada. Mostra o funil de descarte pra UI exibir
 * "147 scaneadas → 35 aprovadas, descartadas por: …"
 */
router.get('/:id/filter-stats', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'workspace não existe' });

  const scraped = await prisma.scrapedOffer.findMany({
    orderBy: { lastSeenAt: 'desc' },
    take: 2000,
  });
  const normalized = scraped.map((s) => ({
    productId: s.productId,
    title: s.title,
    price: s.price,
    originalPrice: s.originalPrice,
    discountPercent: s.discountPercent,
    permalink: s.permalink,
    freeShipping: s.freeShipping,
    coupon: s.coupon,
    highlight: s.highlight,
    estimatedCommission: s.estimatedCommission,
  }));
  const { stats } = applyWorkspaceFilters(ws, normalized);
  res.json(stats);
});

// Ofertas (inbox) com paginação
// Query: ?status=pending|sent|rejected & ?page=1 & ?pageSize=20
router.get('/:id/offers', async (req, res) => {
  const status = String(req.query.status ?? 'pending');
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
  const where = { workspaceId: req.params.id, status };
  const [total, items] = await Promise.all([
    prisma.offer.count({ where }),
    prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  res.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});

// Salvar shortlink oficial (gerado pelo usuário no portal)
router.patch('/:id/offers/:offerId/shortlink', async (req, res) => {
  const { shortlink } = req.body ?? {};
  if (!shortlink || !String(shortlink).trim()) {
    return res.status(400).json({ error: 'shortlink obrigatório' });
  }
  const trimmed = String(shortlink).trim();
  // Validação leve: aceitar mercadolivre.com.br/sec/... ou variantes do ML
  const isValid = /mercadoli(vre|bre)\./i.test(trimmed) || /\/sec\//i.test(trimmed);
  if (!isValid) {
    return res.status(400).json({ error: 'URL inválida — deve ser um link do Mercado Livre' });
  }
  try {
    const offer = await prisma.offer.update({
      where: { id: req.params.offerId },
      data: {
        shortlink: trimmed,
        shortlinkAddedAt: new Date(),
      },
    });
    if (offer.workspaceId !== req.params.id) {
      return res.status(404).json({ error: 'not found' });
    }
    audit('offer.shortlink_added', {
      entity: 'offer', entityId: offer.id, workspaceId: req.params.id,
    });
    res.json(offer);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/offers/:offerId/approve', async (req, res) => {
  let offer = await prisma.offer.findUnique({ where: { id: req.params.offerId } });
  if (!offer || offer.workspaceId !== req.params.id) return res.status(404).json({ error: 'not found' });

  // Se não tem shortlink, tenta gerar automaticamente (sessão conectada)
  if (!offer.shortlink) {
    try {
      const { getSessionStatus, generateShortlink } = await import('../ml/affiliate-browser.js');
      const session = await getSessionStatus();
      if (session.status === 'connected') {
        const shortlink = await generateShortlink(offer.permalink);
        offer = await prisma.offer.update({
          where: { id: offer.id },
          data: { shortlink, shortlinkAddedAt: new Date() },
        });
      } else {
        return res.status(400).json({
          error: 'Sessão de afiliado desconectada. Conecte em Configurações OU cole o shortlink manualmente antes de aprovar.',
          needsShortlink: true,
        });
      }
    } catch (e) {
      return res.status(500).json({
        error: `Falha ao gerar shortlink: ${e.message}. Tente colar manualmente.`,
        needsShortlink: true,
      });
    }
  }

  // Envia pro(s) grupo(s) de STAGING desse workspace
  const groups = await prisma.group.findMany({
    where: { workspaceId: req.params.id, type: 'staging', enabled: true },
  });
  if (groups.length === 0) {
    return res.status(400).json({ error: 'Nenhum grupo de staging cadastrado neste workspace' });
  }

  // Prioriza shortlink oficial (gerado no portal); fallback pro affiliate_url com ?tag=
  const finalUrl = offer.shortlink || offer.affiliateUrl;

  // Busca config completa do workspace pra usar adStyle / audience / typing
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });

  const text = formatOffer({
    title: offer.title,
    price: offer.price,
    originalPrice: offer.originalPrice,
    discountPercent: offer.discountPercent,
    freeShipping: offer.freeShipping,
    soldQuantity: offer.soldQuantity,
    affiliateUrl: finalUrl,
    coupon: offer.coupon,
    highlight: offer.highlight,
    productId: offer.productId,
  }, {
    style: ws?.adStyle ?? 'compact',
    nicheId: ws?.nichePreset ?? null,
    audience: ws?.audience ?? 'unisex',
  });

  for (const g of groups) {
    await waManager.sendMessage(req.params.id, g.jid, {
      image: offer.imageUrl,
      caption: text,
      simulateTyping: ws?.typingSimulation ?? true,
    });
  }

  await prisma.offer.update({
    where: { id: offer.id },
    data: { status: 'sent', sentAt: new Date() },
  });
  audit('offer.approve', { entity: 'offer', entityId: offer.id, workspaceId: req.params.id, payload: { title: offer.title } });
  res.json({ ok: true });
});

router.post('/:id/offers/:offerId/reject', async (req, res) => {
  await prisma.offer.update({
    where: { id: req.params.offerId },
    data: { status: 'rejected' },
  });
  audit('offer.reject', { entity: 'offer', entityId: req.params.offerId, workspaceId: req.params.id });
  res.json({ ok: true });
});

export default router;
