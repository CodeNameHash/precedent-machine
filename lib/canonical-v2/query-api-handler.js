const {
  CanonicalQueryError,
  queryCanonicalResultPage,
} = require('./query-result');

const MAX_REQUEST_BYTES = 32 * 1024;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

function queryError(code, message) {
  return new CanonicalQueryError(code, message);
}

function errorStatus(error) {
  if (error?.code === 'METHOD_NOT_ALLOWED') return 405;
  if (error?.code === 'INVALID_REQUEST') return 400;
  if (error?.code === 'REQUEST_TOO_LARGE') return 413;
  if (error?.code === 'DEADLINE_EXCEEDED') return 504;
  return 503;
}

function sendError(res, error, retryAfterSeconds = null) {
  const status = errorStatus(error);
  res.setHeader('Cache-Control', 'private, no-store');
  if (status >= 500) res.setHeader('Retry-After', String(retryAfterSeconds || 30));
  return res.status(status).json({
    error: {
      code: error?.code || 'DATA_SOURCE_ERROR',
      message: error?.message || 'Canonical Query is unavailable.',
    },
  });
}

function parseBoundedRequest(body) {
  let encoded;
  if (typeof body === 'string') {
    encoded = body;
  } else {
    try {
      encoded = JSON.stringify(body);
    } catch {
      throw queryError('INVALID_REQUEST', 'The canonical query request must be valid JSON.');
    }
  }
  if (typeof encoded !== 'string') {
    throw queryError('INVALID_REQUEST', 'The canonical query request must be valid JSON.');
  }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_REQUEST_BYTES) {
    throw queryError('REQUEST_TOO_LARGE', `The canonical query request must not exceed ${MAX_REQUEST_BYTES} bytes.`);
  }
  let request;
  try {
    request = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    throw queryError('INVALID_REQUEST', 'The canonical query request must be valid JSON.');
  }
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw queryError('INVALID_REQUEST', 'The canonical query request must be an object.');
  }
  return request;
}

function createCanonicalQueryHandler({
  enabled,
  getClient,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = Date.now,
}) {
  let activeRequests = 0;
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  return async function canonicalQueryHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendError(res, queryError('METHOD_NOT_ALLOWED', 'POST only.'));
    }
    if ((typeof enabled === 'function' ? enabled() : enabled) !== true) {
      return sendError(res, queryError('FEATURE_DISABLED', 'Canonical Query is disabled.'));
    }
    const currentTime = now();
    if (circuitOpenUntil > currentTime) {
      return sendError(
        res,
        queryError('CIRCUIT_OPEN', 'Canonical Query is temporarily unavailable.'),
        Math.ceil((circuitOpenUntil - currentTime) / 1000),
      );
    }
    if (activeRequests >= maxConcurrent) {
      return sendError(res, queryError('AT_CAPACITY', 'Canonical Query is at capacity.'), 5);
    }

    activeRequests += 1;
    try {
      const request = parseBoundedRequest(req.body);
      const client = getClient();
      if (!client) {
        throw queryError('DATA_SOURCE_NOT_CONFIGURED', 'Canonical staging serving is not configured.');
      }
      const queried = await queryCanonicalResultPage({
        client,
        request,
        timeoutMs: 2500,
      });
      consecutiveFailures = 0;
      circuitOpenUntil = 0;
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      res.setHeader('ETag', `"${queried.request.cache_key}"`);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('X-Canonical-Cache', queried.cache);
      return res.status(200).json(queried.result);
    } catch (error) {
      if (!['INVALID_REQUEST', 'REQUEST_TOO_LARGE', 'METHOD_NOT_ALLOWED'].includes(error?.code)) {
        consecutiveFailures = Math.min(failureThreshold, consecutiveFailures + 1);
        if (consecutiveFailures >= failureThreshold) circuitOpenUntil = now() + cooldownMs;
      }
      return sendError(
        res,
        error,
        circuitOpenUntil ? Math.ceil((circuitOpenUntil - now()) / 1000) : null,
      );
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
    }
  };
}

module.exports = {
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_MAX_CONCURRENT,
  MAX_REQUEST_BYTES,
  createCanonicalQueryHandler,
  parseBoundedRequest,
};
