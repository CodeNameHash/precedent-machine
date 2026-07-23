// Emergency-containment guard for legacy corpus-context routes
// (2026-07-23, Ben-approved: AUDIT-GATE-REGISTRY-STATUS-2026-07-23.md item
// 2, step 1). Mirrors the process-local pattern already proven on the
// canonical query handler (lib/canonical-v2/query-api-handler.js): a
// concurrent-request cap and a circuit breaker. Process-local only — this
// bounds each serverless instance, it is not fleet-wide admission control;
// the fleet-wide replacement remains the canonical Query surface per
// Phase 0.
//
// Semantics kept deliberately conservative so normal product traffic is
// untouched: the wrapped handler runs exactly as before; only when
// `maxConcurrent` requests are already in flight (or the breaker is open
// after `failureThreshold` consecutive UNEXPECTED throws) does the guard
// answer 503 with Retry-After. Handler-level "expected" errors (the
// route's own 400s) never count toward the breaker.

function createRouteGuard({
  maxConcurrent = 4,
  failureThreshold = 3,
  cooldownMs = 30_000,
  now = Date.now,
} = {}) {
  let active = 0;
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  function unavailable(res, message, retryAfterSeconds) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(503).json({ error: message });
  }

  return function wrap(handler) {
    return async function guardedHandler(req, res) {
      const currentTime = now();
      if (circuitOpenUntil > currentTime) {
        return unavailable(
          res,
          'The query service is recovering — try again shortly.',
          Math.max(1, Math.ceil((circuitOpenUntil - currentTime) / 1000)),
        );
      }
      if (active >= maxConcurrent) {
        return unavailable(res, 'The query service is briefly at capacity — try again in a few seconds.', 5);
      }
      active += 1;
      try {
        const result = await handler(req, res);
        consecutiveFailures = 0;
        return result;
      } catch (err) {
        // The wrapped route catches its own expected errors and responds
        // 400 itself — reaching here means something genuinely unexpected
        // escaped. Count it, maybe open the breaker, and make sure the
        // client still gets a bounded, sanitized response.
        consecutiveFailures = Math.min(failureThreshold, consecutiveFailures + 1);
        if (consecutiveFailures >= failureThreshold) circuitOpenUntil = now() + cooldownMs;
        if (!res.headersSent) {
          res.setHeader('Cache-Control', 'private, no-store');
          res.status(500).json({ error: 'Query failed unexpectedly.' });
        }
        return undefined;
      } finally {
        active -= 1;
      }
    };
  };
}

module.exports = { createRouteGuard };
