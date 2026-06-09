import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { authMiddleware, validateSession, SESSION_COOKIE } from './auth.js';
import { waManager } from './whatsapp/manager.js';
import { startCatalogWorker, getCatalogSweepStatus } from './catalog-worker.js';
import { startSender } from './sender.js';
import { createLogger, logError } from './logger.js';

const log = createLogger('app');

// Handlers globais de erro: protege contra crash silencioso ou processo
// travado por uma rejection assíncrona não capturada (foi o que travou o
// sistema por 19 dias em maio/26 — bug P2002 causava promise rejections
// que escapavam pro process).
process.on('unhandledRejection', (reason, promise) => {
  logError('app', 'unhandledRejection (capturado, sistema continua)', reason);
});
process.on('uncaughtException', (err) => {
  logError('app', 'uncaughtException (capturado, sistema continua)', err);
});

import authRouter from './routes/auth.js';
import workspacesRouter from './routes/workspaces.js';
import mlRouter from './routes/ml.js';
import mlPublicRouter from './routes/ml-public.js';
import auditRouter from './routes/audit.js';
import affiliateRouter from './routes/affiliate.js';
import systemRouter from './routes/system.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const BUILD_TAG = 'v3.6-resilience-2026-06-09';

// API pública
// /healthz reporta status REAL — usado por EasyPanel/Docker HEALTHCHECK pra
// detectar processo travado (event loop bloqueado, scheduler quebrado, etc).
// Retorna 503 se varredura não rola há mais de 12h — Docker reinicia o container.
const STALE_SWEEP_MS = 12 * 60 * 60 * 1000; // 12h

app.get('/healthz', (_req, res) => {
  const status = getCatalogSweepStatus();
  const lastSweep = status.lastSweepAt ? new Date(status.lastSweepAt).getTime() : 0;
  const sinceLastSweep = lastSweep ? Date.now() - lastSweep : null;
  const stale = lastSweep > 0 && sinceLastSweep > STALE_SWEEP_MS;

  // "fresh start" (servidor acabou de subir, sem varredura ainda) é considerado
  // healthy — catch-up vai disparar em até 60s
  const healthy = !lastSweep || !stale;

  const body = {
    ok: healthy,
    build: BUILD_TAG,
    lastSweepAt: status.lastSweepAt,
    nextSweepAt: status.nextSweepAt,
    inFlight: status.inFlight,
    sinceLastSweepMin: sinceLastSweep ? Math.round(sinceLastSweep / 60000) : null,
    stale,
  };
  res.status(healthy ? 200 : 503).json(body);
});
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
app.use('/api/system', authMiddleware, systemRouter);

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
  log.info('servidor http iniciado', { port: PORT, build: BUILD_TAG });
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
waManager.restoreAll().catch((e) => log.warn('restoreAll falhou', { error: e.message }));
startCatalogWorker();
startSender();
