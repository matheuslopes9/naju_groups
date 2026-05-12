import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const workspaceId = req.query.workspaceId;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const logs = await prisma.auditLog.findMany({
    where: workspaceId ? { workspaceId: String(workspaceId) } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(logs);
});

export default router;
