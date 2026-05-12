import crypto from 'node:crypto';
import { prisma } from './db.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const COOKIE_NAME = 'naju_session';

function dashboardPassword() {
  const v = process.env.DASHBOARD_PASSWORD;
  if (!v) throw new Error('DASHBOARD_PASSWORD não configurada');
  return v;
}

export async function login(password) {
  if (password !== dashboardPassword()) {
    throw new Error('Senha inválida');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.authSession.create({ data: { token, expiresAt } });
  return { token, expiresAt };
}

export async function logout(token) {
  if (!token) return;
  await prisma.authSession.delete({ where: { token } }).catch(() => {});
}

export async function validateSession(token) {
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.authSession.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session;
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  validateSession(token).then((session) => {
    if (!session) return res.status(401).json({ error: 'unauthorized' });
    req.authToken = token;
    next();
  }).catch((e) => res.status(500).json({ error: e.message }));
}

export function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export const SESSION_COOKIE = COOKIE_NAME;
