import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const COOKIE_NAME = 'naju_session';

/**
 * Suporta dois modos:
 *  1) DASHBOARD_PASSWORD em texto claro (compare === direto)
 *  2) DASHBOARD_PASSWORD_HASH bcrypt (mais seguro, recomendado)
 * Se ambos definidos, hash tem prioridade.
 */
async function verifyPassword(input) {
  const trimmed = (input ?? '').toString();
  const hash = process.env.DASHBOARD_PASSWORD_HASH;
  if (hash) {
    return bcrypt.compare(trimmed, hash);
  }
  const plain = process.env.DASHBOARD_PASSWORD;
  if (!plain) {
    throw new Error('Nem DASHBOARD_PASSWORD nem DASHBOARD_PASSWORD_HASH configurados no .env');
  }
  // timingSafeEqual evita ataque de timing
  const a = Buffer.from(trimmed);
  const b = Buffer.from(plain);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function login(password) {
  const valid = await verifyPassword(password);
  if (!valid) {
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
