/**
 * OAuth do Mercado Livre — fluxo authorization_code + refresh_token com PKCE.
 *
 * O ML exige PKCE (RFC 7636) na troca do code por token:
 *  - code_verifier: 43-128 chars aleatórios (gerado antes do authorize)
 *  - code_challenge: SHA256(code_verifier), base64url, enviado na authorize
 *  - state: id correlacionando os dois lados (evita CSRF + indexa o verifier)
 *
 * O verifier é mantido em memória (Map keyed pelo state) com TTL de 10 min.
 * Não precisa persistir em DB — o ciclo é authorize → callback em segundos.
 */
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { decrypt } from '../crypto.js';

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';
const PKCE_TTL_MS = 10 * 60 * 1000;

// state → { codeVerifier, expiresAt }
const pkceStore = new Map();

function generateCodeVerifier() {
  // 64 bytes aleatórios → base64url ~86 chars (dentro do limite 43-128)
  return crypto.randomBytes(64).toString('base64url');
}

function codeChallengeFor(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function rememberVerifier(state, codeVerifier) {
  pkceStore.set(state, { codeVerifier, expiresAt: Date.now() + PKCE_TTL_MS });
  // Limpa expirados oportunisticamente
  for (const [k, v] of pkceStore) {
    if (v.expiresAt < Date.now()) pkceStore.delete(k);
  }
}

function takeVerifier(state) {
  const entry = pkceStore.get(state);
  if (!entry) return null;
  pkceStore.delete(state);
  if (entry.expiresAt < Date.now()) return null;
  return entry.codeVerifier;
}

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

/**
 * Gera URL de autorização com PKCE.
 * Retorna a URL + o state (que é usado como chave do verifier).
 * O caller redireciona o browser pra essa URL.
 */
export async function getAuthorizeUrl() {
  const cfg = await getEffectiveConfig();
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeFor(codeVerifier);
  rememberVerifier(state, codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: 'offline_access read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
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

/**
 * Troca o code recebido no callback por access_token.
 * Precisa do state (vem na query string do callback) pra recuperar o code_verifier.
 */
export async function exchangeCodeForToken(code, state) {
  const cfg = await getEffectiveConfig();
  const codeVerifier = state ? takeVerifier(state) : null;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri,
  });
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    const hint = !codeVerifier
      ? ' (DICA: code_verifier não foi recuperado — sessão PKCE expirou ou state ausente. Reinicie a autorização.)'
      : '';
    throw new Error(`exchangeCode failed: ${res.status} ${text}${hint}`);
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

export async function getAffiliateTag() {
  try {
    const cfg = await getEffectiveConfig();
    return cfg.affiliateTag;
  } catch {
    return process.env.ML_AFFILIATE_TAG ?? null;
  }
}
