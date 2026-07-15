// lib/api-auth.js
//
// Pure decision logic for the /api/** auth gate. Kept separate from
// middleware.js so it can be unit-tested with plain `node --test` (no Next.js
// edge runtime required) and so the middleware stays a thin wrapper.
//
// ---------------------------------------------------------------------------
// MODEL (see docs/API-ROUTE-CLASSIFICATION.md for the full route inventory)
// ---------------------------------------------------------------------------
// 1. Default OFF. Controlled by API_AUTH_ENABLED. Unset or any value other
//    than 'true' (case-insensitive) means the gate is a no-op: every request
//    is allowed through unchanged. This is the safe-to-merge state.
// 2. When enabled, every request under /api/** must present a shared-secret
//    header (`x-pm-api-key` by default, header name is not configurable) that
//    matches PM_API_KEY via constant-time comparison, EXCEPT:
//      a. Paths in PUBLIC_GET_ALLOWLIST, and only for GET/HEAD requests. This
//         is for read-only endpoints that serve no deal/corpus data (today:
//         none of the corpus-serving routes qualify - see the classification
//         doc). The allowlist is intentionally conservative; adding a path
//         is a judgment call, not a mechanical one.
//      b. /api/cron/** — the cron route already enforces its own
//         CRON_SECRET-based check (see pages/api/cron/edgar-watch.js). Double
//         -gating it here would require operators to satisfy both secrets or
//         relax the CRON_SECRET fail-open bug as a side effect of this patch,
//         which is out of scope for an additive, inert-by-default change.
// 3. If PM_API_KEY is unset while API_AUTH_ENABLED is true, the gate fails
//    CLOSED (every request is rejected) rather than silently no-op'ing -
//    an operator turning the flag on with no key configured should get a
//    loud 500, not an accidentally-open API.
// ---------------------------------------------------------------------------

const AUTH_HEADER = 'x-pm-api-key';

// Read-only routes that serve no deal/corpus data and are safe to leave
// public even with the gate enabled. See docs/API-ROUTE-CLASSIFICATION.md -
// "PUBLIC-READ" section for the reasoning behind each entry. Empty today:
// every current GET route under /api/** either reads corpus data directly
// or reads operational/admin state, so none qualify yet. The mechanism is
// here for the day a genuinely static/public route is added.
const PUBLIC_GET_ALLOWLIST = [];

// Routes with their own independent auth scheme; the flag gate steps aside
// entirely rather than stacking a second requirement on top.
const SELF_GATED_PREFIXES = ['/api/cron/'];

function isAuthEnabled(env = process.env) {
  return String(env.API_AUTH_ENABLED || '').toLowerCase() === 'true';
}

function isSelfGated(pathname) {
  return SELF_GATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicAllowlisted(pathname, method) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return PUBLIC_GET_ALLOWLIST.some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`));
}

// Constant-time string comparison. Deliberately hand-rolled instead of
// Node's crypto.timingSafeEqual: this module is required from Next.js
// middleware, which runs on the edge runtime by default and does not expose
// Node's crypto module. Both inputs are walked in full regardless of where
// (or whether) they differ, and length is folded into the comparison instead
// of short-circuited, so response timing does not leak the correct key's
// length or contents.
function constantTimeEqual(a, b) {
  const strA = typeof a === 'string' ? a : '';
  const strB = typeof b === 'string' ? b : '';
  const len = Math.max(strA.length, strB.length, 1);
  let diff = strA.length === strB.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) {
    const codeA = i < strA.length ? strA.charCodeAt(i) : 0;
    const codeB = i < strB.length ? strB.charCodeAt(i) : 0;
    diff |= codeA ^ codeB;
  }
  return diff === 0;
}

/**
 * Decide whether a request to /api/** should be let through.
 *
 * @param {Object} input
 * @param {string} input.pathname - request path, e.g. '/api/deals'
 * @param {string} input.method - HTTP method, upper-cased
 * @param {string|null|undefined} input.apiKeyHeader - value of the x-pm-api-key header, if any
 * @param {Object} [input.env] - injectable for tests; defaults to process.env
 * @returns {{ allow: boolean, status: number, body?: Object }}
 */
function decideApiAuth({ pathname, method, apiKeyHeader, env = process.env }) {
  if (!isAuthEnabled(env)) {
    return { allow: true, status: 200 };
  }

  if (isSelfGated(pathname)) {
    return { allow: true, status: 200 };
  }

  if (isPublicAllowlisted(pathname, method)) {
    return { allow: true, status: 200 };
  }

  const expectedKey = env.PM_API_KEY;
  if (!expectedKey) {
    // Flag on, no key configured: fail closed, not open.
    return {
      allow: false,
      status: 500,
      body: { error: 'API_AUTH_ENABLED is true but PM_API_KEY is not configured' },
    };
  }

  if (!constantTimeEqual(apiKeyHeader, expectedKey)) {
    return { allow: false, status: 401, body: { error: 'Unauthorized' } };
  }

  return { allow: true, status: 200 };
}

module.exports = {
  AUTH_HEADER,
  PUBLIC_GET_ALLOWLIST,
  SELF_GATED_PREFIXES,
  isAuthEnabled,
  isSelfGated,
  isPublicAllowlisted,
  constantTimeEqual,
  decideApiAuth,
};
