/**
 * OAuth do Mercado Livre — fluxo authorization_code + refresh_token.
 *
 * Credenciais (Client ID, Secret, Redirect URI, tag) vêm do DB
 * (tabela ml_app_config, gerenciada pelo dashboard).
 * Fallback pra env vars caso o DB ainda não tenha config — útil pra
 * primeiro deploy ou rollback.
 */
import { prisma } from '../db.js';
import { decrypt } from '../crypto.js';

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';

/**
 * Retorna config efetiva: DB tem prioridade, fallback pra env.
 * Lança erro só se nem DB nem env tiverem o necessário.
 */
export async function getEffectiveConfig() {
  const row = await prisma.mlAppConfig.findUnique({ where: { id: 1 } }).catch(() => null);
  if (row) {
    return {
      source: 'db',
      clientId: row.clientId,
      clientSecret: decrypt(row.clientSecretEnc),
      redirectUri: row.redirectUri,
      affiliateTag: row.affiliateTag ?? process.env.ML_AFFILIATE_TAG ?? null,
    };
  }
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  const redirectUri = process.env.ML_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('App do Mercado Livre não configurado. Vá em Configurações no dashboard.');
  }
  return {
    source: 'env',
    clientId,
    clientSecret,
    redirectUri,
    affiliateTag: process.env.ML_AFFILIATE_TAG ?? null,
  };
}

export async function isConfigured() {
  try { await getEffectiveConfig(); return true; }
  catch { return false; }
}

export async function getAuthorizeUrl() {
  const cfg = await getEffectiveConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
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
  const cfg = await getEffectiveConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri,
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
  const cfg = await getEffectiveConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
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
  const configured = await isConfigured();
  const token = await prisma.mlToken.findUnique({ where: { id: 1 } });
  if (!token) return { connected: false, configured };
  const ageSec = (Date.now() - token.obtainedAt.getTime()) / 1000;
  return {
    connected: true,
    configured,
    userId: token.userId,
    obtainedAt: token.obtainedAt,
    expiresIn: token.expiresIn,
    ageSeconds: Math.floor(ageSec),
  };
}

export async function getAccessToken() {
  const token = await prisma.mlToken.findUnique({ where: { id: 1 } });
  if (!token) {
    throw new Error('ML não autorizado. Acesse Configurações no dashboard.');
  }
  const ageSec = (Date.now() - token.obtainedAt.getTime()) / 1000;
  if (ageSec >= token.expiresIn - 300) {
    const refreshed = await refreshAccessToken(token.refreshToken);
    return refreshed.access_token;
  }
  return token.accessToken;
}

/**
 * Retorna a tag de afiliado efetiva (DB tem prioridade, fallback pra env).
 */
export async function getAffiliateTag() {
  try {
    const cfg = await getEffectiveConfig();
    return cfg.affiliateTag;
  } catch {
    return process.env.ML_AFFILIATE_TAG ?? null;
  }
}
