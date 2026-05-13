/**
 * OAuth do Mercado Livre — agora persistido no Postgres (tabela ml_tokens).
 * Único token global (sua conta de afiliada).
 */
import { prisma } from '../db.js';

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getAuthorizeUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('ML_CLIENT_ID'),
    redirect_uri: env('ML_REDIRECT_URI'),
    // offline_access garante que o ML devolva refresh_token (token vence em 6h sem isso)
    scope: 'offline_access read',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function persistToken(payload) {
  const data = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    obtainedAt: new Date(),
    expiresIn: payload.expires_in ?? 21600,
    userId: payload.user_id ? String(payload.user_id) : null,
  };
  await prisma.mlToken.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env('ML_CLIENT_ID'),
    client_secret: env('ML_CLIENT_SECRET'),
    code,
    redirect_uri: env('ML_REDIRECT_URI'),
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`exchangeCode failed: ${res.status} ${text}`);
  }
  const payload = await res.json();
  await persistToken(payload);
  return payload;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env('ML_CLIENT_ID'),
    client_secret: env('ML_CLIENT_SECRET'),
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`refresh failed: ${res.status} ${text}`);
  }
  const payload = await res.json();
  await persistToken(payload);
  return payload;
}

export async function getMlStatus() {
  const token = await prisma.mlToken.findUnique({ where: { id: 1 } });
  if (!token) return { connected: false };
  const ageSec = (Date.now() - token.obtainedAt.getTime()) / 1000;
  return {
    connected: true,
    userId: token.userId,
    obtainedAt: token.obtainedAt,
    expiresIn: token.expiresIn,
    ageSeconds: Math.floor(ageSec),
  };
}

export async function getAccessToken() {
  const token = await prisma.mlToken.findUnique({ where: { id: 1 } });
  if (!token) {
    throw new Error(`ML não autorizado. Acesse ${getAuthorizeUrl()} para autorizar.`);
  }
  const ageSec = (Date.now() - token.obtainedAt.getTime()) / 1000;
  if (ageSec >= token.expiresIn - 300) {
    const refreshed = await refreshAccessToken(token.refreshToken);
    return refreshed.access_token;
  }
  return token.accessToken;
}
