const { errorBody, MarketStatsError, asMarketStatsError } = require('./errors');
const { parseMarketStatsRequest } = require('./request');
const { calculateMarketStats } = require('./service');
const { loadMarketDataset } = require('./source');

const DEFAULT_RETRY_AFTER_SECONDS = 30;
const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30_000;

function sendError(res, error) {
  const typed = asMarketStatsError(error);
  res.setHeader('Cache-Control', 'private, no-store');
  if (typed.status === 503 && typed.code !== 'MARKET_STATS_DISABLED') {
    const retryAfter = Number.isFinite(error?.retryAfterSeconds)
      ? Math.max(1, Math.ceil(error.retryAfterSeconds))
      : DEFAULT_RETRY_AFTER_SECONDS;
    res.setHeader('Retry-After', String(retryAfter));
  }
  return res.status(typed.status).json(errorBody(typed));
}

function unavailable(code, message, retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS) {
  const error = new MarketStatsError(code, message);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function createMarketStatsHandler({
  getSupabase,
  validateMetricSpec,
  validateMetricResult,
  loadDataset = loadMarketDataset,
  enabled = false,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  circuitCooldownMs = DEFAULT_CIRCUIT_COOLDOWN_MS,
  now = Date.now,
}) {
  const concurrencyLimit = Number.isInteger(maxConcurrent) && maxConcurrent > 0
    ? maxConcurrent
    : DEFAULT_MAX_CONCURRENT;
  const tripAfter = Number.isInteger(failureThreshold) && failureThreshold > 0
    ? failureThreshold
    : DEFAULT_FAILURE_THRESHOLD;
  const cooldownMs = Number.isFinite(circuitCooldownMs) && circuitCooldownMs > 0
    ? circuitCooldownMs
    : DEFAULT_CIRCUIT_COOLDOWN_MS;
  let activeRequests = 0;
  let consecutiveServerFailures = 0;
  let circuitOpenUntil = 0;

  return async function marketStatsHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendError(res, new MarketStatsError('METHOD_NOT_ALLOWED', 'POST only.'));
    }

    const gateOpen = typeof enabled === 'function' ? enabled() === true : enabled === true;
    if (!gateOpen) {
      return sendError(res, unavailable(
        'MARKET_STATS_DISABLED',
        'Market statistics are temporarily disabled.',
      ));
    }

    const currentTime = now();
    if (circuitOpenUntil && currentTime < circuitOpenUntil) {
      return sendError(res, unavailable(
        'MARKET_STATS_CIRCUIT_OPEN',
        'Market statistics are temporarily unavailable.',
        (circuitOpenUntil - currentTime) / 1000,
      ));
    }
    if (circuitOpenUntil) {
      circuitOpenUntil = 0;
      consecutiveServerFailures = tripAfter - 1;
    }

    if (activeRequests >= concurrencyLimit) {
      return sendError(res, unavailable(
        'MARKET_STATS_BUSY',
        'Market statistics are at capacity. Retry later.',
        5,
      ));
    }

    activeRequests += 1;
    try {
      const request = parseMarketStatsRequest(req.body, validateMetricSpec);
      const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
      if (!supabase) {
        throw new MarketStatsError('DATA_SOURCE_NOT_CONFIGURED', 'The market corpus is not configured.');
      }
      const dataset = await loadDataset(supabase, request.specs);
      const response = calculateMarketStats(request, dataset, validateMetricResult);
      consecutiveServerFailures = 0;
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(response);
    } catch (error) {
      const typed = asMarketStatsError(error);
      if (typed.status >= 500) {
        consecutiveServerFailures = Math.min(tripAfter, consecutiveServerFailures + 1);
        if (consecutiveServerFailures >= tripAfter) {
          circuitOpenUntil = now() + cooldownMs;
          typed.retryAfterSeconds = cooldownMs / 1000;
        }
      }
      return sendError(res, typed);
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
    }
  };
}

module.exports = {
  DEFAULT_CIRCUIT_COOLDOWN_MS,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_MAX_CONCURRENT,
  DEFAULT_RETRY_AFTER_SECONDS,
  createMarketStatsHandler,
  sendError,
};
