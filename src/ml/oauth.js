/**
 * OAuth do Mercado Livre — fluxo authorization_code + refresh_token.
 *
 * Persistência simples em arquivo JSON (./auth_state/ml-token.json).
 * Access token expira em ~6h; refresh_token vale ~6 meses e é rotacionado
 * a cada uso (precisamos SEMPRE salvar o novo refresh recebido).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const TOKEN_PATH = path.resolve('./auth_state/ml-token.json');
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function readToken() {
  try {
    const raw = await fs.readFile(TOKEN_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeToken(token) {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2));
}

/**
 * URL pra o usuário autorizar o app (uma única vez).
 */
export function getAuthorizeUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('ML_CLIENT_ID'),
    redirect_uri: env('ML_REDIRECT_URI'),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Troca o `code` recebido no callback por access+refresh token.
 */
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
  const token = await res.json();
  token.obtained_at = Date.now();
  await writeToken(token);
  return token;
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
  const token = await res.json();
  token.obtained_at = Date.now();
  await writeToken(token);
  return token;
}

/**
 * Retorna um access_token válido. Renova automaticamente se necessário.
 * Lança erro com instrução clara se nunca foi autorizado.
 */
export async function getAccessToken() {
  let token = await readToken();

  if (!token) {
    throw new Error(
      `Sem token salvo. Acesse ${getAuthorizeUrl()} no navegador para autorizar o app.`
    );
  }

  const ageSec = (Date.now() - (token.obtained_at ?? 0)) / 1000;
  const expiresIn = token.expires_in ?? 21600;
  const isExpired = ageSec >= expiresIn - 300;

  if (isExpired) {
    token = await refreshAccessToken(token.refresh_token);
  }

  return token.access_token;
}
