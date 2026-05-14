import { Router } from 'express';
import { prisma } from '../db.js';
import { waManager } from '../whatsapp/manager.js';
import { formatOffer } from '../formatter.js';
import { runWorkspace } from '../worker.js';
import { audit } from '../audit.js';
import { MLB_CATEGORIES, findCategory } from '../ml/categories.js';

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
  const allowed = ['name', 'niche', 'description', 'searchQuery', 'categoryIds', 'minDiscount', 'onlyFreeShipping', 'onlyDeals', 'maxPerRun', 'intervalMin', 'autoSearch'];
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

// ---- Categorias monitoradas pelo workspace ----

// Lista as 30+ categorias top-level disponíveis no MLB
router.get('/ml/categories', async (_req, res) => {
  res.json(MLB_CATEGORIES);
});

router.get('/:id/categories', async (req, res) => {
  const rows = await prisma.workspaceCategory.findMany({
    where: { workspaceId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows);
});

router.post('/:id/categories', async (req, res) => {
  const { categoryId } = req.body ?? {};
  if (!categoryId) return res.status(400).json({ error: 'categoryId obrigatório' });
  const cat = findCategory(categoryId);
  if (!cat) return res.status(400).json({ error: 'Categoria desconhecida' });
  try {
    const saved = await prisma.workspaceCategory.create({
      data: {
        workspaceId: req.params.id,
        categoryId: cat.id,
        name: cat.name,
      },
    });
    audit('category.add', { entity: 'category', entityId: saved.id, workspaceId: req.params.id, payload: { name: cat.name } });
    res.status(201).json(saved);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Categoria já cadastrada' });
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id/categories/:rowId', async (req, res) => {
  const { enabled } = req.body ?? {};
  const data = {};
  if (typeof enabled === 'boolean') data.enabled = enabled;
  const row = await prisma.workspaceCategory.update({
    where: { id: req.params.rowId },
    data,
  });
  res.json(row);
});

router.delete('/:id/categories/:rowId', async (req, res) => {
  await prisma.workspaceCategory.delete({ where: { id: req.params.rowId } });
  audit('category.remove', { entity: 'category', entityId: req.params.rowId, workspaceId: req.params.id });
  res.json({ ok: true });
});

// Buscar ofertas agora (manual)
router.post('/:id/search', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'not found' });
  try {
    const saved = await runWorkspace(ws);
    audit('offer.search', { entity: 'offer', workspaceId: ws.id, payload: { saved } });
    res.json({ ok: true, saved });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
