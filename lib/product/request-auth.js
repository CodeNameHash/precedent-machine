'use strict';

const { extractSessionCookie } = require('../auth/cookies');
const { verifySessionToken } = require('../auth/session');
const { constantTimeEqual, DEFAULT_USERNAME } = require('../auth/credentials');

class ProductRequestAuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProductRequestAuthError';
    this.code = code;
  }
}

// Ben, 2026-09-14: "Server side route is fine." An internal bearer token
// (PRODUCT_INTERNAL_TOKEN, set on the deployment) lets a script start and
// advance a run without a browser session: the actor is the configured
// login username (the same single user the session would name). The token
// must be at least 32 characters; a shorter or absent configuration
// disables the path entirely, and a mismatched bearer is never treated as
// a session attempt.
const MINIMUM_INTERNAL_TOKEN_LENGTH = 32;

function bearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

function internalBearerActor(req, env = process.env) {
  const presented = bearerToken(req);
  if (!presented) return null;
  const configured = env.PRODUCT_INTERNAL_TOKEN;
  if (typeof configured !== 'string' || configured.length < MINIMUM_INTERNAL_TOKEN_LENGTH) {
    throw new ProductRequestAuthError('UNAUTHENTICATED');
  }
  if (!constantTimeEqual(presented, configured)) throw new ProductRequestAuthError('UNAUTHENTICATED');
  return env.AUTH_USERNAME || DEFAULT_USERNAME;
}

async function getProductActor(req, env = process.env) {
  const internal = internalBearerActor(req, env);
  if (internal) return internal;
  const result = await verifySessionToken(extractSessionCookie(req.headers?.cookie), { secret: env.SESSION_SECRET });
  if (!result.valid) throw new ProductRequestAuthError('UNAUTHENTICATED');
  return result.claims.sub;
}

// A browser mutation carries the same-origin marker; an internal bearer
// request is not a browser and needs no CSRF marker.
function requireSameOriginMutation(req, env = process.env) {
  if (internalBearerActor(req, env)) return;
  if (req.headers?.['x-pm-csrf'] !== 'same-origin') throw new ProductRequestAuthError('CSRF_REQUIRED');
}

module.exports = { MINIMUM_INTERNAL_TOKEN_LENGTH, ProductRequestAuthError, getProductActor, internalBearerActor, requireSameOriginMutation };
