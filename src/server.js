/**
 * Servidor HTTP unificado:
 *   GET /healthz       - health check pro EasyPanel
 *   GET /qr            - exibe o QR code do WhatsApp pra escanear remoto
 *   GET /ml/authorize  - redireciona pra autorização OAuth do ML
 *   GET /ml/callback   - recebe o ?code= e troca por token
 *   GET /              - status simples
 */
import express from 'express';
import { getQrDataUrl, isWhatsAppConnected } from './whatsapp/client.js';
import { getAuthorizeUrl, exchangeCodeForToken } from './ml/oauth.js';

export function createServer() {
  const app = express();

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  app.get('/', (_req, res) => {
    res.type('html').send(`
      <h1>Naju Groups Bot</h1>
      <ul>
        <li>WhatsApp: ${isWhatsAppConnected() ? '✅ conectado' : '⏳ aguardando QR'}</li>
        <li><a href="/qr">/qr</a> — escanear WhatsApp</li>
        <li><a href="/ml/authorize">/ml/authorize</a> — autorizar Mercado Livre</li>
      </ul>
    `);
  });

  app.get('/qr', (_req, res) => {
    if (isWhatsAppConnected()) {
      return res.type('html').send('<h1>✅ WhatsApp já conectado</h1>');
    }
    const qr = getQrDataUrl();
    if (!qr) {
      return res.type('html').send('<h1>Aguardando QR…</h1><p>Recarregue em 5s.</p><script>setTimeout(()=>location.reload(),5000)</script>');
    }
    res.type('html').send(`
      <h1>Escaneie pelo WhatsApp do bot</h1>
      <p>WhatsApp → Aparelhos conectados → Conectar aparelho</p>
      <img src="${qr}" style="max-width:380px"/>
      <p><small>QR expira em ~60s; a página recarrega.</small></p>
      <script>setTimeout(()=>location.reload(),45000)</script>
    `);
  });

  app.get('/ml/authorize', (_req, res) => {
    res.redirect(getAuthorizeUrl());
  });

  app.get('/ml/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Faltou ?code= na URL.');
    try {
      await exchangeCodeForToken(String(code));
      res.type('html').send('<h1>✅ Autorização ML salva.</h1><p>Pode fechar esta aba.</p>');
    } catch (e) {
      res.status(500).type('html').send(`<h1>Falhou</h1><pre>${e.message}</pre>`);
    }
  });

  return app;
}
