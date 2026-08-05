// POST /api/auth/login — { username, password } -> sets the pm_session
// cookie on success. Public by construction (lib/auth/gate.js PUBLIC_PATHS):
// you cannot require a session to reach the route that creates one.
//
// No rate limiting / lockout: Vercel serverless functions do not share
// memory across invocations, so an in-process counter would not actually
// throttle anything, and there is no external store (Redis/Upstash) wired
// up for this product. Mitigated today by a strong-passphrase expectation
// on AUTH_PASSWORD and constant-time comparison (lib/auth/credentials.js) so
// timing does not leak partial matches. Flagged in the handoff report as the
// one open item on this route.
import { verifyCredentials } from '../../../lib/auth/credentials';
import { createSessionToken, DEFAULT_TTL_SECONDS } from '../../../lib/auth/session';
import { serializeSessionCookie } from '../../../lib/auth/cookies';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    // Loud, not open — same posture as the cron route's own missing-secret
    // handling and the draft middleware's fail-closed-when-unconfigured rule.
    return res.status(500).json({ error: 'Login is not configured (SESSION_SECRET missing)' });
  }

  const { username, password } = req.body || {};
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const result = verifyCredentials({ username: typeof username === 'string' ? username : '', password });
  if (!result.ok) {
    const misconfigured = result.reason === 'not-configured';
    return res.status(misconfigured ? 500 : 401).json({
      error: misconfigured ? 'Login is not configured (AUTH_PASSWORD missing)' : 'Invalid credentials',
    });
  }

  const token = await createSessionToken({ sub: result.sub, secret: sessionSecret });
  res.setHeader('Set-Cookie', serializeSessionCookie(token, { maxAgeSeconds: DEFAULT_TTL_SECONDS }));
  return res.status(200).json({ ok: true, sub: result.sub });
}
