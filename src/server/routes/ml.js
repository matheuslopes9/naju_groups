import { Router } from 'express';
import { getAuthorizeUrl, exchangeCodeForToken, getMlStatus } from '../ml/oauth.js';
import { audit } from '../audit.js';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    res.json(await getMlStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Inicia autorização: redireciona pro ML
router.get('/authorize', (_req, res) => {
  try {
    res.redirect(getAuthorizeUrl());
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Callback do OAuth
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Faltou ?code= na URL.');
  try {
    await exchangeCodeForToken(String(code));
    audit('ml.authorize', { entity: 'ml' });
    res.type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h1>✅ Mercado Livre autorizado</h1>
        <p>Pode fechar esta aba e voltar ao dashboard.</p>
        <a href="/">Voltar</a>
      </body></html>
    `);
  } catch (e) {
    res.status(500).type('html').send(`<pre>${e.message}</pre>`);
  }
});

export default router;
