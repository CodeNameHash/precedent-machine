// lib/auth/credentials.js
//
// Checks a login attempt's username/password against the one configured
// owner credential. There is exactly one user of this product today, so
// this is env vars, not a database table: AUTH_USERNAME (optional, defaults
// to 'ben') and AUTH_PASSWORD (required — no default, same "fail closed if
// unset" posture the codebase already uses for CRON_SECRET).
//
// A second user later does not require rewriting the session mechanism
// (lib/auth/session.js, lib/auth/gate.js, middleware.js) — only this
// function's body changes, e.g. to check against a list or a table. Kept
// separate from session.js for exactly that reason.
//
// Constant-time comparison, adapted from the draft on wp/api-auth-middleware
// (lib/api-auth.js `constantTimeEqual`): both inputs are walked in full
// regardless of where they differ, and length is folded into the comparison
// instead of short-circuited, so response timing does not leak the correct
// credential's length or contents. The draft needed to hand-roll this
// because Edge Middleware lacks Node's crypto.timingSafeEqual; this module
// only ever runs in the Node API route runtime (pages/api/auth/login.js),
// but the property is worth keeping regardless, and it means this file has
// no crypto dependency of its own.

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

const DEFAULT_USERNAME = 'ben';

/**
 * @param {Object} attempt
 * @param {string} attempt.username
 * @param {string} attempt.password
 * @param {Object} [env]
 * @returns {{ ok: boolean, reason?: 'not-configured' | 'invalid', sub?: string }}
 */
function verifyCredentials({ username, password }, env = process.env) {
  const configuredPassword = env.AUTH_PASSWORD;
  if (!configuredPassword) return { ok: false, reason: 'not-configured' };

  const configuredUsername = env.AUTH_USERNAME || DEFAULT_USERNAME;
  const usernameOk = constantTimeEqual(username, configuredUsername);
  const passwordOk = constantTimeEqual(password, configuredPassword);

  if (!usernameOk || !passwordOk) return { ok: false, reason: 'invalid' };
  return { ok: true, sub: configuredUsername };
}

module.exports = {
  DEFAULT_USERNAME,
  constantTimeEqual,
  verifyCredentials,
};
