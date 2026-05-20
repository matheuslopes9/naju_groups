/**
 * Rotas de sistema — operações que não pertencem a um workspace específico.
 *
 * Use com cuidado. Tudo aqui exige autenticação (registrada com authMiddleware
 * no index.js).
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { audit } from '../audit.js';

const router = Router();

/**
 * RESET TOTAL — apaga tudo relacionado a busca/envio mas PRESERVA:
 *   - Workspaces e suas configurações
 *   - Grupos WhatsApp cadastrados
 *   - Sessões WhatsApp (não precisa parear de novo)
 *   - MlAppConfig (app ML)
 *   - AffiliateSession (cookies do gerador de shortlinks)
 *   - AuthSession (você não cai do login)
 *
 * Apaga em ordem pra respeitar foreign keys:
 *   QueuedSend → AgentAction → Offer → ScrapedOffer
 *
 * Resposta: { deleted: { queuedSends, agentActions, offers, scrapedOffers } }
 */
router.post('/reset', async (_req, res) => {
  try {
    const counts = { queuedSends: 0, agentActions: 0, offers: 0, scrapedOffers: 0 };

    const q1 = await prisma.queuedSend.deleteMany({});
    counts.queuedSends = q1.count;

    const q2 = await prisma.agentAction.deleteMany({});
    counts.agentActions = q2.count;

    const q3 = await prisma.offer.deleteMany({});
    counts.offers = q3.count;

    const q4 = await prisma.scrapedOffer.deleteMany({});
    counts.scrapedOffers = q4.count;

    audit('system.reset', { entity: 'system', payload: counts });
    console.log(`🧹 Reset total: ${JSON.stringify(counts)}`);
    res.json({ ok: true, deleted: counts });
  } catch (e) {
    console.warn('reset falhou:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
