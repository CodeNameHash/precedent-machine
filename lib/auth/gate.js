// lib/auth/gate.js
//
// The single access decision for every request the app serves — pages and
// API routes alike. Imported by middleware.js (Next.js Edge runtime) as the
// one and only enforcement point, so it has to work there: no Node built-ins,
// only the Web-standard globals lib/auth/session.js and lib/auth/cookies.js
// already restrict themselves to.
//
// Defaults to refuse. A route is exempt from the session check only by
// appearing in one of the two lists below — PUBLIC_* (no auth of any kind
// needed) or SELF_GATED_PREFIXES (the route enforces its own, different,
// auth). Anything else — including a route added after this file was
// written, that nobody thought to classify — falls through to "requires a
// valid session" by construction, not by anyone remembering to add it to a
// deny list. See ROADMAP.md step S2: "defaulting to refuse... not public by
// omission."

const { extractSessionCookie } = require('./cookies');
const { verifySessionToken } = require('./session');

// Exact pathnames that never require a session: the auth bootstrap itself
// (you cannot require a session to reach the page/route that establishes
// one) plus the one non-Next-internal static file the app references by a
// plain <link> (pages/admin/agreements.js -> /spa.css). Nothing in this set
// serves deal, corpus, or operational data.
const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/favicon.ico',
  '/spa.css',
]);

// Path PREFIXES that never require a session because everything under them
// is either Next's own build/runtime pipeline or self-hosted static font
// files (styles/mtx-fonts.css -> /fonts/*), needed to render the login page
// itself before any session exists.
//
// Deliberately NOT here: /generated/ — public/generated/home-search-index-v1.json
// is a build-time snapshot of corpus deal names for the home page's
// search-as-you-type. It is corpus-derived content, not a framework asset,
// so it stays behind the session gate like every other corpus surface. A
// logged-in browser's same-origin fetch for it carries the session cookie
// automatically, so this costs nothing for the authenticated app; it only
// closes an unauthenticated read that was previously open. See
// docs/API-ROUTE-CLASSIFICATION.md.
const PUBLIC_PREFIXES = ['/_next/', '/fonts/'];

// Routes that enforce their OWN auth scheme and must not ALSO be asked to
// present a session cookie. Today: the cron route
// (pages/api/cron/edgar-watch.js), gated on CRON_SECRET via its own
// `authorised()` check, invoked by Vercel Cron infrastructure which has no
// browser and cannot obtain a session cookie. This list is deliberately
// tiny — see ROADMAP.md S2 "The cron route already uses a shared secret;
// keep that working." Self-gated is not the same as public: the request
// still has to satisfy CRON_SECRET inside the route handler itself.
const SELF_GATED_PREFIXES = ['/api/cron/'];

// The internal bearer token (lib/product/request-auth.js; Ben, 2026-09-14:
// "Server side route is fine") reaches the product API without a browser
// session. Edge-safe: a plain constant-time comparison, no Node crypto.
// Only /api/product/ routes accept it; the route handler checks the same
// token again and names the actor. A token under 32 characters disables
// the path.
const INTERNAL_TOKEN_PREFIX = '/api/product/';
const MINIMUM_INTERNAL_TOKEN_LENGTH = 32;

function constantTimeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index % a.length) ^ b.charCodeAt(index % b.length));
  }
  return mismatch === 0;
}

function internalTokenAllows({ pathname, authorizationHeader, env }) {
  if (!pathname.startsWith(INTERNAL_TOKEN_PREFIX)) return false;
  if (typeof authorizationHeader !== 'string') return false;
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;
  const configured = env.PRODUCT_INTERNAL_TOKEN;
  if (typeof configured !== 'string' || configured.length < MINIMUM_INTERNAL_TOKEN_LENGTH) return false;
  return constantTimeEqualStrings(match[1], configured);
}

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSelfGated(pathname) {
  return SELF_GATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * @param {Object} input
 * @param {string} input.pathname
 * @param {string|null|undefined} input.cookieHeader - the raw `Cookie` request header
 * @param {Object} [input.env] - injectable for tests; defaults to process.env
 * @param {number} [input.now] - injectable clock (ms epoch); defaults to Date.now()
 * @returns {Promise<{allow: boolean, reason: string, claims?: Object}>}
 *   reason is one of: 'public' | 'self-gated' | 'internal-token' | 'valid-session' |
 *   'missing-session' | 'not-configured' | 'malformed' | 'bad-signature' | 'expired'
 */
async function decideAccess({ pathname, cookieHeader, authorizationHeader = null, env = process.env, now = Date.now() }) {
  if (isPublicPath(pathname)) return { allow: true, reason: 'public' };
  if (isSelfGated(pathname)) return { allow: true, reason: 'self-gated' };
  if (internalTokenAllows({ pathname, authorizationHeader, env })) return { allow: true, reason: 'internal-token' };

  const token = extractSessionCookie(cookieHeader);
  if (!token) return { allow: false, reason: 'missing-session' };

  const secret = env.SESSION_SECRET;
  if (!secret) return { allow: false, reason: 'not-configured' };

  const result = await verifySessionToken(token, { secret, now });
  if (!result.valid) return { allow: false, reason: result.reason };

  return { allow: true, reason: 'valid-session', claims: result.claims };
}

module.exports = {
  INTERNAL_TOKEN_PREFIX,
  internalTokenAllows,
  PUBLIC_PATHS,
  PUBLIC_PREFIXES,
  SELF_GATED_PREFIXES,
  isPublicPath,
  isSelfGated,
  decideAccess,
};
