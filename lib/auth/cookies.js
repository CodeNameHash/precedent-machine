// lib/auth/cookies.js
//
// Cookie parsing/serialization for the session mechanism. Pure string
// manipulation — no crypto, no Node built-ins — so it loads identically in
// the Next.js Edge middleware runtime, in Node API routes, and in
// `node --test`.

const SESSION_COOKIE_NAME = 'pm_session';

// One week. A stateless cookie has no server-side revocation short of
// rotating SESSION_SECRET, so this is a deliberate tradeoff for a
// single-owner tool: long enough to not be annoying, short enough that a
// leaked cookie doesn't stay valid indefinitely.
const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const rawValue = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(rawValue);
    } catch {
      out[key] = rawValue;
    }
  }
  return out;
}

function extractSessionCookie(cookieHeader) {
  const cookies = parseCookieHeader(cookieHeader);
  return Object.prototype.hasOwnProperty.call(cookies, SESSION_COOKIE_NAME)
    ? cookies[SESSION_COOKIE_NAME]
    : null;
}

// `secure` defaults true unconditionally (not just in production). Modern
// browsers treat http://localhost as a "potentially trustworthy origin" and
// still set/send Secure cookies over it, so this does not break local dev,
// and it means the cookie is never accidentally non-Secure in production
// because an env check was wrong. See DECISIONS.md item 2 / ROADMAP.md S2.
function serializeSessionCookie(token, { maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS, secure = true } = {}) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

function serializeExpiredSessionCookie({ secure = true } = {}) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

module.exports = {
  SESSION_COOKIE_NAME,
  DEFAULT_MAX_AGE_SECONDS,
  parseCookieHeader,
  extractSessionCookie,
  serializeSessionCookie,
  serializeExpiredSessionCookie,
};
