import { Router } from 'express';
import { prisma } from '../db.js';
import { waManager } from '../whatsapp/manager.js';
import { formatOffer } from '../formatter.js';
import { runWorkspace } from '../worker.js';
import { audit } from '../audit.js';
import { fetchItemByUrl, AVAILABLE_SOURCES } from '../ml/scraper.js';
import { attachAffiliateTag } from '../ml/affiliate.js';
import { getAffiliateTag } from '../ml/oauth.js';

const router = Router();

// Métricas agregadas pra dashboard
router.get('/stats', async (_req, res) => {
  const [workspaces, pendingCount, sentCount, rejectedCount, totalSaved, latestPending] = await Promise.all([
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
  const enriched = items.map((w) => ({
    ...w,
    wa: waManager.getStatusSync(w.id),
  }));
  res.json(enriched);
});

router.post('/', async (req, res) => {
  const { name, niche, description, searchQuery, categoryIds, minDiscount, onlyFreeShipping, onlyDeals, maxPerRun, intervalMin } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const ws = await prisma.workspace.create({
    data: {
      name, niche, description,
      searchQuery: searchQuery ?? null,
      categoryIds: categoryIds ?? null,
      minDiscount: minDiscount ?? 20,
      onlyFreeShipping: onlyFreeShipping ?? true,
      onlyDeals: onlyDeals ?? true,
      maxPerRun: maxPerRun ?? 3,
      intervalMin: intervalMin ?? 60,
    },
  });
  audit('workspace.create', { entity: 'workspace', entityId: ws.id, workspaceId: ws.id, payload: { name } });
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
    'name', 'niche', 'description', 'searchQuery', 'categoryIds',
    'minDiscount', 'onlyFreeShipping', 'onlyDeals', 'maxPerRun', 'intervalMin', 'autoSearch',
    'keywords', 'priceMin', 'priceMax', 'cooldownDays',
  ];
  const data = {};
  for (const k of allowed) if (k in (req.body ?? {})) data[k] = req.body[k];
  const ws = await prisma.workspace.update({ where: { id: req.params.id }, data });
  res.json(ws);
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

// ---- Fontes de scraping (URLs do ML que o bot vai varrer) ----

// Lista as fontes disponíveis (validadas empiricamente)
router.get('/ml/sources', async (_req, res) => {
  res.json(AVAILABLE_SOURCES);
});

router.get('/:id/sources', async (req, res) => {
  const rows = await prisma.workspaceSource.findMany({
    where: { workspaceId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows);
});

router.post('/:id/sources', async (req, res) => {
  const { slug, maxPages } = req.body ?? {};
  if (slug == null) return res.status(400).json({ error: 'slug obrigatório (pode ser string vazia)' });
  const src = AVAILABLE_SOURCES.find((s) => s.slug === slug);
  if (!src) return res.status(400).json({ error: 'Fonte desconhecida' });
  try {
    const saved = await prisma.workspaceSource.create({
      data: {
        workspaceId: req.params.id,
        slug: src.slug,
        label: src.label,
        maxPages: maxPages ?? src.defaultPages,
      },
    });
    audit('source.add', { entity: 'source', entityId: saved.id, workspaceId: req.params.id, payload: { slug: src.slug } });
    res.status(201).json(saved);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Fonte já cadastrada' });
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id/sources/:rowId', async (req, res) => {
  const { enabled, maxPages } = req.body ?? {};
  const data = {};
  if (typeof enabled === 'boolean') data.enabled = enabled;
  if (typeof maxPages === 'number') data.maxPages = Math.max(1, Math.min(10, maxPages));
  const row = await prisma.workspaceSource.update({
    where: { id: req.params.rowId },
    data,
  });
  res.json(row);
});

router.delete('/:id/sources/:rowId', async (req, res) => {
  await prisma.workspaceSource.delete({ where: { id: req.params.rowId } });
  audit('source.remove', { entity: 'source', entityId: req.params.rowId, workspaceId: req.params.id });
  res.json({ ok: true });
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

// Buscar ofertas agora (manual, sem streaming)
router.post('/:id/search', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'not found' });
  try {
    const result = await runWorkspace(ws);
    audit('offer.search', { entity: 'offer', workspaceId: ws.id, payload: result });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buscar com SSE streaming (progress bar real-time)
router.get('/:id/search/stream', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) {
    res.status(404).json({ error: 'not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); }
    catch {}
  };

  send({ stage: 'connected' });

  try {
    const result = await runWorkspace(ws, send);
    audit('offer.search', { entity: 'offer', workspaceId: ws.id, payload: result });
    send({ stage: 'complete', ...result });
  } catch (e) {
    send({ stage: 'fatal', error: e.message });
  }
  res.end();
});

// Ofertas (inbox)
router.get('/:id/offers', async (req, res) => {
  const status = req.query.status ?? 'pending';
  const offers = await prisma.offer.findMany({
    where: { workspaceId: req.params.id, status: String(status) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(offers);
});

router.post('/:id/offers/:offerId/approve', async (req, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.offerId } });
  if (!offer || offer.workspaceId !== req.params.id) return res.status(404).json({ error: 'not found' });

  // Envia pro(s) grupo(s) de STAGING desse workspace
  const groups = await prisma.group.findMany({
    where: { workspaceId: req.params.id, type: 'staging', enabled: true },
  });
  if (groups.length === 0) {
    return res.status(400).json({ error: 'Nenhum grupo de staging cadastrado neste workspace' });
  }

  const text = formatOffer({
    title: offer.title,
    price: offer.price,
    originalPrice: offer.originalPrice,
    discountPercent: offer.discountPercent,
    freeShipping: offer.freeShipping,
    soldQuantity: offer.soldQuantity,
    affiliateUrl: offer.affiliateUrl,
  });

  for (const g of groups) {
    await waManager.sendMessage(req.params.id, g.jid, { image: offer.imageUrl, caption: text });
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
