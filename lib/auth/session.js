// lib/auth/session.js
//
// Signs and verifies the session token carried in the pm_session cookie.
//
// Format: `<base64url(JSON claims)>.<base64url(HMAC-SHA256 signature)>` — two
// parts, not three. There is no algorithm header (unlike a JWT): the
// algorithm is fixed at HMAC-SHA256 in code, so there is nothing for a
// forged token to negotiate down to (no "alg: none" class of bug).
//
// Built entirely on the Web Crypto API (global `crypto.subtle`,
// `TextEncoder`/`TextDecoder`, `btoa`/`atob`) rather than Node's `crypto`
// module. That is a hard requirement, not a style choice: this module is
// imported by both `middleware.js` (Next.js Edge runtime — no Node built-ins)
// and the Node-runtime API routes (login/logout), and it needs to produce
// byte-identical signatures in both places. Web Crypto is the one crypto
// surface both runtimes implement, and Node has had it as a global since
// v19 (this repo's dev/test environment and any reasonably current Vercel
// Node runtime both have it unflagged). If that assumption is ever wrong,
// every request fails loudly (crypto.subtle is undefined) rather than
// silently accepting unsigned sessions — fail closed, not fail open.
//
// Draft precedent (branch wp/api-auth-middleware, lib/api-auth.js): that
// draft hand-rolled a constant-time string comparison specifically because
// Edge lacked Node's crypto.timingSafeEqual. Web Crypto's
// `crypto.subtle.verify` is specified to be a safe, constant-time MAC
// verification, so this module gets that property from the platform instead
// of reimplementing it — see lib/auth/credentials.js for the one place a
// hand-rolled constant-time comparison is still used (a plain string
// compare against an env-var password, which has no HMAC of its own).

const SESSION_ALG = 'HMAC-SHA256';
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // one week — see lib/auth/cookies.js

function getSubtle() {
  if (typeof crypto !== 'undefined' && crypto && crypto.subtle) return crypto.subtle;
  throw new Error(
    'lib/auth/session.js: crypto.subtle is not available in this runtime. ' +
    'Sessions cannot be signed or verified — refusing to run open.',
  );
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(b64url) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(b64url)));
}

async function importHmacKey(secret) {
  return getSubtle().importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Sign a new session token.
 *
 * @param {Object} opts
 * @param {string} opts.sub - subject identifier (the username that logged in)
 * @param {string} opts.secret - SESSION_SECRET
 * @param {number} [opts.ttlSeconds]
 * @param {number} [opts.now] - injectable clock, ms epoch
 * @returns {Promise<string>} the token (does not include cookie attributes)
 */
async function createSessionToken({ sub, secret, ttlSeconds = DEFAULT_TTL_SECONDS, now = Date.now() }) {
  if (!secret) throw new Error('createSessionToken: secret is required');
  if (!sub || typeof sub !== 'string') throw new Error('createSessionToken: sub is required');

  const claims = { sub, alg: SESSION_ALG, iat: now, exp: now + Math.max(1, ttlSeconds) * 1000 };
  const payloadB64 = encodeJson(claims);
  const key = await importHmacKey(secret);
  const sigBytes = new Uint8Array(await getSubtle().sign('HMAC', key, new TextEncoder().encode(payloadB64)));
  return `${payloadB64}.${bytesToBase64Url(sigBytes)}`;
}

/**
 * Verify a session token.
 *
 * @param {string} token
 * @param {Object} opts
 * @param {string} opts.secret - SESSION_SECRET
 * @param {number} [opts.now] - injectable clock, ms epoch
 * @returns {Promise<{valid: boolean, claims?: Object, reason?: string}>}
 *   reason is one of: 'not-configured' | 'missing' | 'malformed' | 'bad-signature' | 'expired'
 */
async function verifySessionToken(token, { secret, now = Date.now() } = {}) {
  if (!secret) return { valid: false, reason: 'not-configured' };
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false, reason: 'malformed' };
  const [payloadB64, sigB64] = parts;

  let sigBytes;
  try {
    sigBytes = base64UrlToBytes(sigB64);
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  const key = await importHmacKey(secret);
  // Verify the signature BEFORE trusting anything decoded from the payload —
  // a tampered payload must fail here regardless of whether it happens to
  // still be valid JSON.
  const signatureValid = await getSubtle().verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(payloadB64),
  );
  if (!signatureValid) return { valid: false, reason: 'bad-signature' };

  let claims;
  try {
    claims = decodeJson(payloadB64);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!claims || typeof claims.sub !== 'string' || typeof claims.exp !== 'number') {
    return { valid: false, reason: 'malformed' };
  }
  if (now >= claims.exp) return { valid: false, reason: 'expired' };

  return { valid: true, claims };
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
};
