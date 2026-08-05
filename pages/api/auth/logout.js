// POST /api/auth/logout — clears the pm_session cookie. Idempotent: succeeds
// whether or not a session existed. Public by construction (there is no
// harm in letting an unauthenticated caller clear a cookie it already
// controls, and the alternative — requiring a session to log out —
// would strand an expired/tampered session with no way to clear it).
import { serializeExpiredSessionCookie } from '../../../lib/auth/cookies';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  res.setHeader('Set-Cookie', serializeExpiredSessionCookie());
  return res.status(200).json({ ok: true });
}
