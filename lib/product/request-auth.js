'use strict';

const { extractSessionCookie } = require('../auth/cookies');
const { verifySessionToken } = require('../auth/session');

class ProductRequestAuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProductRequestAuthError';
    this.code = code;
  }
}

async function getProductActor(req, env = process.env) {
  const result = await verifySessionToken(extractSessionCookie(req.headers?.cookie), { secret: env.SESSION_SECRET });
  if (!result.valid) throw new ProductRequestAuthError('UNAUTHENTICATED');
  return result.claims.sub;
}

function requireSameOriginMutation(req) {
  if (req.headers?.['x-pm-csrf'] !== 'same-origin') throw new ProductRequestAuthError('CSRF_REQUIRED');
}

module.exports = { ProductRequestAuthError, getProductActor, requireSameOriginMutation };
