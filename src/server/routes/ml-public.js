/**
 * Endpoints públicos do ML — só os que precisam ser acessíveis SEM cookie:
 *  - /ml/authorize — redireciona pro OAuth (qualquer pessoa pode iniciar,
 *    mas só dono da conta ML consegue completar)
 *  - /ml/callback — recebe o code do ML após autorização
 *
 * Os endpoints de gerenciamento (/api/ml/app, /api/ml/status) ficam no
 * routes/ml.js e exigem auth.
 */
import { Router } from 'express';
import { getAuthorizeUrl, exchangeCodeForToken } from '../ml/oauth.js';
import { audit } from '../audit.js';

const router = Router();

router.get('/authorize', async (_req, res) => {
  try {
    const url = await getAuthorizeUrl();
    res.redirect(url);
  } catch (e) {
    res.status(400).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#0b1020;color:#e2e8f0">
        <h1 style="font-size:32px;margin-bottom:12px">⚠️ App ML não configurado</h1>
        <p style="color:#94a3b8;margin-bottom:24px">${e.message}</p>
        <a href="/configuracoes" style="display:inline-block;padding:8px 16px;background:#6366f1;color:white;border-radius:8px;text-decoration:none">Ir para Configurações</a>
      </body></html>
    `);
  }
});

router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Faltou ?code= na URL.');
  try {
    await exchangeCodeForToken(String(code));
    audit('ml.authorize', { entity: 'ml' });
    res.type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#0b1020;color:#e2e8f0">
        <h1 style="font-size:48px;margin-bottom:12px">✅</h1>
        <h2>Mercado Livre autorizado</h2>
        <p style="color:#94a3b8;margin:8px 0 24px">Pode fechar esta aba e voltar ao dashboard.</p>
        <a href="/" style="display:inline-block;padding:8px 16px;background:#6366f1;color:white;border-radius:8px;text-decoration:none">Voltar ao dashboard</a>
      </body></html>
    `);
  } catch (e) {
    res.status(500).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0b1020;color:#e2e8f0">
        <h1>❌ Falha na autorização</h1>
        <pre style="background:#1e293b;padding:12px;border-radius:8px;overflow:auto">${e.message}</pre>
        <a href="/" style="color:#6366f1">Voltar ao dashboard</a>
      </body></html>
    `);
  }
});

export default router;
