/**
 * Endpoints autenticados de gerenciamento do app ML.
 * Authorize/callback estão em routes/ml-public.js (rotas públicas).
 */
import { Router } from 'express';
import { getMlStatus } from '../ml/oauth.js';
import { pingUsersMe, pingSearchMinimal } from '../ml/search.js';
import { audit } from '../audit.js';
import { encrypt } from '../crypto.js';
import { prisma } from '../db.js';

const router = Router();

router.get('/status', async (_req, res) => {
  try { res.json(await getMlStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * Diagnóstico: testa /users/me (canonical) e /sites/MLB/search (mínimo).
 * Retorna ambos status + body curto, sem mascarar — fica claro qual passa
 * e qual falha pra isolar onde está o problema.
 */
router.get('/test', async (_req, res) => {
  const results = {};
  try { results.usersMe = await pingUsersMe(); }
  catch (e) { results.usersMe = { error: e.message }; }
  try { results.searchMinimal = await pingSearchMinimal(); }
  catch (e) { results.searchMinimal = { error: e.message }; }
  res.json(results);
});

// ---- App config (Client ID / Secret / Redirect URI / Tag) ----

router.get('/app', async (_req, res) => {
  try {
    const row = await prisma.mlAppConfig.findUnique({ where: { id: 1 } });
    if (!row) {
      return res.json({
        source: 'env-fallback',
        configured: !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET && process.env.ML_REDIRECT_URI),
        clientId: process.env.ML_CLIENT_ID ?? '',
        hasSecret: !!process.env.ML_CLIENT_SECRET,
        redirectUri: process.env.ML_REDIRECT_URI ?? '',
        affiliateTag: process.env.ML_AFFILIATE_TAG ?? '',
      });
    }
    res.json({
      source: 'db',
      configured: true,
      clientId: row.clientId,
      hasSecret: !!row.clientSecretEnc,
      redirectUri: row.redirectUri,
      affiliateTag: row.affiliateTag ?? '',
      updatedAt: row.updatedAt,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/app', async (req, res) => {
  const { clientId, clientSecret, redirectUri, affiliateTag } = req.body ?? {};
  if (!clientId || !redirectUri) {
    return res.status(400).json({ error: 'clientId e redirectUri são obrigatórios' });
  }

  try {
    const existing = await prisma.mlAppConfig.findUnique({ where: { id: 1 } });

    let clientSecretEnc;
    if (clientSecret && clientSecret.trim()) {
      clientSecretEnc = encrypt(clientSecret.trim());
    } else if (existing) {
      clientSecretEnc = existing.clientSecretEnc;
    } else {
      return res.status(400).json({ error: 'clientSecret obrigatório no primeiro cadastro' });
    }

    const saved = await prisma.mlAppConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        clientId: clientId.trim(),
        clientSecretEnc,
        redirectUri: redirectUri.trim(),
        affiliateTag: (affiliateTag ?? '').trim() || null,
      },
      update: {
        clientId: clientId.trim(),
        clientSecretEnc,
        redirectUri: redirectUri.trim(),
        affiliateTag: (affiliateTag ?? '').trim() || null,
      },
    });
    audit('ml.config_update', { entity: 'ml', payload: { clientId: saved.clientId } });
    res.json({
      ok: true,
      source: 'db',
      clientId: saved.clientId,
      redirectUri: saved.redirectUri,
      affiliateTag: saved.affiliateTag,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/app', async (_req, res) => {
  try {
    await prisma.mlAppConfig.delete({ where: { id: 1 } }).catch(() => {});
    await prisma.mlToken.delete({ where: { id: 1 } }).catch(() => {});
    audit('ml.config_delete', { entity: 'ml' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
