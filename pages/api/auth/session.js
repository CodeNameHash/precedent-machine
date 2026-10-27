// GET /api/auth/session — { authenticated: boolean, sub?: string }. Always
// 200; this route's entire job is to answer "are you logged in", so a 401
// here would just push the same question one level up. Public by
// construction — used by pages/login.js to skip the form when already
// signed in, and safe to expose since it reveals nothing beyond that.
import { extractSessionCookie } from '../../../lib/auth/cookies';
import { verifySessionToken } from '../../../lib/auth/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  res.setHeader('Cache-Control', 'private, no-store');

  const secret = process.env.SESSION_SECRET;
  const token = extractSessionCookie(req.headers.cookie);
  if (!token || !secret) return res.status(200).json({ authenticated: false });

  const result = await verifySessionToken(token, { secret });
  if (!result.valid) return res.status(200).json({ authenticated: false });

  // The owner is the configured login (AUTH_USERNAME, default 'ben'). Only
  // the owner sees the operations surfaces — the review queue, publishing and
  // release (work package 53, plan finding (290)). With one user today this is
  // always true; the shape is what matters when a second login exists.
  const owner = process.env.AUTH_USERNAME || 'ben';
  return res.status(200).json({ authenticated: true, sub: result.claims.sub, admin: result.claims.sub === owner });
}
