import { Router } from 'express';
import { prisma } from '../db.js';
import { waManager } from '../whatsapp/manager.js';
import { formatOffer } from '../formatter.js';
import { runWorkspace } from '../worker.js';

const router = Router();

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
    wa: waManager.getStatus(w.id),
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
  res.status(201).json(ws);
});

router.get('/:id', async (req, res) => {
  const ws = await prisma.workspace.findUnique({
    where: { id: req.params.id },
    include: { whatsappSession: true, groups: true },
  });
  if (!ws) return res.status(404).json({ error: 'not found' });
  res.json({ ...ws, wa: waManager.getStatus(ws.id) });
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
  res.json({ ok: true });
});

// WhatsApp ações
router.post('/:id/whatsapp/connect', async (req, res) => {
  await waManager.start(req.params.id);
  res.json({ ok: true, status: waManager.getStatus(req.params.id) });
});

router.post('/:id/whatsapp/disconnect', async (req, res) => {
  await waManager.stop(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/whatsapp/status', (req, res) => {
  res.json(waManager.getStatus(req.params.id));
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

// Buscar ofertas agora (manual)
router.post('/:id/search', async (req, res) => {
  const ws = await prisma.workspace.findUnique({ where: { id: req.params.id } });
  if (!ws) return res.status(404).json({ error: 'not found' });
  try {
    const saved = await runWorkspace(ws);
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
  res.json({ ok: true });
});

router.post('/:id/offers/:offerId/reject', async (req, res) => {
  await prisma.offer.update({
    where: { id: req.params.offerId },
    data: { status: 'rejected' },
  });
  res.json({ ok: true });
});

export default router;
