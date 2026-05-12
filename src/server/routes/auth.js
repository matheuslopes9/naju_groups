import { Router } from 'express';
import { login, logout, validateSession, setSessionCookie, clearSessionCookie, SESSION_COOKIE } from '../auth.js';
import { audit } from '../audit.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { password } = req.body ?? {};
    const { token, expiresAt } = await login(password);
    setSessionCookie(res, token, expiresAt);
    audit('auth.login', { entity: 'auth' });
    res.json({ ok: true });
  } catch (e) {
    audit('auth.login_failed', { entity: 'auth', payload: { reason: e.message } });
    res.status(401).json({ error: e.message });
  }
});

router.post('/logout', async (req, res) => {
  await logout(req.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(res);
  audit('auth.logout', { entity: 'auth' });
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const session = await validateSession(req.cookies?.[SESSION_COOKIE]);
  res.json({ authenticated: !!session });
});

export default router;
