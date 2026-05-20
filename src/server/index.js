import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { authMiddleware, validateSession, SESSION_COOKIE } from './auth.js';
import { waManager } from './whatsapp/manager.js';
import { startCatalogWorker } from './catalog-worker.js';
import { startSender } from './sender.js';

import authRouter from './routes/auth.js';
import workspacesRouter from './routes/workspaces.js';
import mlRouter from './routes/ml.js';
import mlPublicRouter from './routes/ml-public.js';
import auditRouter from './routes/audit.js';
import affiliateRouter from './routes/affiliate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const BUILD_TAG = 'v1.5-multi-niche-2026-05-20';

// API pública
app.get('/healthz', (_req, res) => res.json({ ok: true, build: BUILD_TAG }));
app.get('/version', (_req, res) => res.json({ build: BUILD_TAG }));
app.use('/api/auth', authRouter);

// Callback e authorize do ML são públicos (vêm do redirect do ML).
app.use('/ml', mlPublicRouter);

// Endpoints ML protegidos pelo dashboard (status, app config)
app.use('/api/ml', authMiddleware, mlRouter);

// API protegida
app.use('/api/workspaces', authMiddleware, workspacesRouter);
app.use('/api/audit', authMiddleware, auditRouter);
app.use('/api/affiliate', authMiddleware, affiliateRouter);

// Servir frontend build (em produção). Em dev rode `npm run frontend:dev` separado.
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ml/') || req.path === '/healthz') return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(`
      <h1>AdManager (modo dev)</h1>
      <p>Frontend não foi buildado. Acesse <code>/api/auth/me</code> ou rode <code>npm run frontend:dev</code>.</p>
    `);
  });
}

const PORT = Number(process.env.PORT ?? 3000);
const server = app.listen(PORT, () => {
  console.log(`🌐 HTTP em http://localhost:${PORT}`);
  console.log(`📌 AdManager build: ${BUILD_TAG}`);
});

// WebSocket: stream de status WhatsApp → conectado autenticado
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws, req) => {
  // valida cookie de sessão
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  const session = await validateSession(token);
  if (!session) {
    ws.close(1008, 'unauthorized');
    return;
  }

  const send = (evt) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(evt));
  };

  send({ type: 'hello' });

  const onUpdate = (evt) => send({ type: 'wa-update', ...evt });
  waManager.on('update', onUpdate);

  ws.on('close', () => waManager.off('update', onUpdate));
});

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const [k, ...rest] = pair.trim().split('=');
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

// Restaura sessões previamente conectadas e inicia workers
waManager.restoreAll().catch((e) => console.warn('restoreAll:', e.message));
startCatalogWorker();
startSender();
