/**
 * Endpoints da sessão headless do portal de afiliados ML
 * (login via cookies importados, status, gerar shortlink, desconectar).
 */
import { Router } from 'express';
import {
  getSessionStatus, importCookies, checkSession, disconnect, generateShortlink,
} from '../ml/affiliate-browser.js';
import { audit } from '../audit.js';

const router = Router();

router.get('/session', async (_req, res) => {
  try { res.json(await getSessionStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/session/import', async (req, res) => {
  const { cookies } = req.body ?? {};
  if (!cookies) return res.status(400).json({ error: 'cookies obrigatório (JSON do Cookie-Editor)' });
  try {
    const r = await importCookies(cookies);
    audit('affiliate.session_imported', { entity: 'affiliate' });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/session/check', async (_req, res) => {
  try { res.json(await checkSession()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/session/disconnect', async (_req, res) => {
  await disconnect();
  audit('affiliate.session_disconnected', { entity: 'affiliate' });
  res.json({ ok: true });
});

router.post('/shortlink', async (req, res) => {
  const { productUrl } = req.body ?? {};
  if (!productUrl) return res.status(400).json({ error: 'productUrl obrigatório' });
  try {
    const shortlink = await generateShortlink(productUrl);
    audit('affiliate.shortlink_generated', { entity: 'affiliate', payload: { productUrl } });
    res.json({ shortlink });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
