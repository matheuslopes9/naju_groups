/**
 * Rotas de sistema — operações que não pertencem a um workspace específico.
 *
 * Use com cuidado. Tudo aqui exige autenticação (registrada com authMiddleware
 * no index.js).
 */
import { Router } from 'express';
import { prisma } from '../db.js';
import { audit } from '../audit.js';
import { SOURCE_CATALOG, buildPageUrl } from '../ml/sources-catalog.js';
import { scrapeUrl } from '../ml/scraper-listing.js';

const router = Router();

/**
 * Valida que cada fonte do catálogo está paginando corretamente.
 * Para cada source: pega pg1, pg2, pg3 → compara productIds.
 * Stream via SSE pra UI mostrar progresso (cada fonte demora ~5-15s).
 *
 * Resultado por fonte:
 *   - status: 'ok' | 'broken' | 'partial' | 'empty' | 'error'
 *   - pg1Count, pg2Count, pg3Count
 *   - overlap_pg2_pg1, overlap_pg3_pg1 (n produtos repetidos)
 */
router.get('/validate-pagination/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (evt) => {
    try { res.write(`data: ${JSON.stringify({ ...evt, _ts: Date.now() })}\n\n`); } catch {}
  };

  send({ stage: 'start', totalSources: SOURCE_CATALOG.length });

  for (let i = 0; i < SOURCE_CATALOG.length; i++) {
    const source = SOURCE_CATALOG[i];
    send({ stage: 'source-start', current: i + 1, total: SOURCE_CATALOG.length, sourceId: source.id, label: source.label, method: source.method });

    const result = { sourceId: source.id, label: source.label, method: source.method };
    try {
      send({ stage: 'fetching', sourceId: source.id, page: 1 });
      const pg1 = await scrapeUrl(buildPageUrl(source, 1), source.method);
      result.pg1Count = pg1.length;
      const ids1 = new Set(pg1.map((o) => o.productId));

      send({ stage: 'fetching', sourceId: source.id, page: 2 });
      const pg2 = await scrapeUrl(buildPageUrl(source, 2), source.method);
      result.pg2Count = pg2.length;
      const ids2 = new Set(pg2.map((o) => o.productId));
      result.overlap_pg2_pg1 = [...ids2].filter((id) => ids1.has(id)).length;

      send({ stage: 'fetching', sourceId: source.id, page: 3 });
      const pg3 = await scrapeUrl(buildPageUrl(source, 3), source.method);
      result.pg3Count = pg3.length;
      const ids3 = new Set(pg3.map((o) => o.productId));
      result.overlap_pg3_pg1 = [...ids3].filter((id) => ids1.has(id)).length;

      // Diagnóstico
      if (pg1.length === 0) result.status = 'empty';
      else if (pg2.length > 0 && result.overlap_pg2_pg1 === pg2.length) result.status = 'broken';
      else if (pg2.length > 0 && result.overlap_pg2_pg1 < pg2.length * 0.3) result.status = 'ok';
      else result.status = 'partial';
    } catch (e) {
      result.status = 'error';
      result.error = e.message;
    }

    send({ stage: 'source-result', current: i + 1, total: SOURCE_CATALOG.length, ...result });
  }

  send({ stage: 'finished' });
  setTimeout(() => { try { res.end(); } catch {} }, 100);
  req.on('close', () => { try { res.end(); } catch {} });
});

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
