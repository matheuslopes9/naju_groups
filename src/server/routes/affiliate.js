/**
 * Endpoints da sessão headless do portal de afiliados ML
 * (login via cookies importados, status, gerar shortlink, desconectar).
 */
import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getSessionStatus, importCookies, checkSession, disconnect, generateShortlink,
} from '../ml/affiliate-browser.js';
import { audit } from '../audit.js';

const router = Router();

// Lista arquivos de debug salvos quando o Playwright falha em gerar shortlink
router.get('/debug', async (_req, res) => {
  const dir = './auth_state/affiliate/debug';
  try {
    const files = await fs.readdir(dir);
    const items = await Promise.all(files.map(async (f) => {
      const stat = await fs.stat(path.join(dir, f));
      return { name: f, size: stat.size, modified: stat.mtime };
    }));
    items.sort((a, b) => b.modified - a.modified);
    res.json(items.slice(0, 20));
  } catch (e) {
    res.json([]);
  }
});

router.get('/debug/:filename', async (req, res) => {
  const f = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = path.join('./auth_state/affiliate/debug', f);
  try {
    const data = await fs.readFile(filePath);
    if (f.endsWith('.png')) res.type('image/png').send(data);
    else if (f.endsWith('.html')) res.type('text/html').send(data);
    else res.send(data);
  } catch {
    res.status(404).send('not found');
  }
});

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
