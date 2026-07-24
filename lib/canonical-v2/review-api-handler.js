const { adaptSharedServingRows } = require('./shared-row-adapter');
const {
  queryActiveReviewContext,
  ReviewContextError,
} = require('./review-context');
const {
  queryServingExactDetail,
  queryServingExactDetailByGovernedDeal,
  ServingExactDetailError,
} = require('./serving-exact-detail');

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

function errorStatus(error) {
  if (error?.code === 'INVALID_REQUEST') return 400;
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
      message: error?.message || 'Canonical Review is unavailable.',
    },
  });
}

function createGuardedHandler({
  enabled,
  getClient,
  operation,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = Date.now,
}) {
  let activeRequests = 0;
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  return async function guardedHandler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendError(res, { code: 'INVALID_REQUEST', message: 'GET only.' });
    }
    if ((typeof enabled === 'function' ? enabled() : enabled) !== true) {
      return sendError(res, { code: 'FEATURE_DISABLED', message: 'Canonical Review is disabled.' });
    }
    const currentTime = now();
    if (circuitOpenUntil > currentTime) {
      return sendError(
        res,
        { code: 'CIRCUIT_OPEN', message: 'Canonical Review is temporarily unavailable.' },
        Math.ceil((circuitOpenUntil - currentTime) / 1000),
      );
    }
    if (activeRequests >= maxConcurrent) {
      return sendError(res, { code: 'AT_CAPACITY', message: 'Canonical Review is at capacity.' }, 5);
    }

    activeRequests += 1;
    try {
      const client = getClient();
      if (!client) throw new ReviewContextError('DATA_SOURCE_NOT_CONFIGURED', 'Canonical staging serving is not configured.');
      const response = await operation(req, client);
      consecutiveFailures = 0;
      circuitOpenUntil = 0;
      return response(res);
    } catch (error) {
      const serverFailure = error instanceof ReviewContextError
        || error instanceof ServingExactDetailError
        || errorStatus(error) >= 500;
      if (serverFailure && error?.code !== 'INVALID_REQUEST') {
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

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function createCanonicalReviewContextHandler(options) {
  return createGuardedHandler({
    ...options,
    operation: async (req, client) => {
      const applicationDealId = firstQueryValue(req.query?.dealId);
      const after = firstQueryValue(req.query?.after) || null;
      const queried = await queryActiveReviewContext({
        client,
        request: {
          application_deal_id: applicationDealId,
          page_size: 100,
          after_row_serving_key: after,
        },
      });
      const { rows, ...envelope } = queried.result;
      const items = adaptSharedServingRows(rows);
      return (res) => {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('ETag', `"${queried.result.pointer_id}:${queried.result.request_digest}"`);
        return res.status(200).json({ ...envelope, items });
      };
    },
  });
}

function createCanonicalExactDetailHandler(options) {
  return createGuardedHandler({
    ...options,
    operation: async (req, client) => {
      const applicationDealId = firstQueryValue(req.query?.dealId);
      const governedDealKey = firstQueryValue(req.query?.dealKey);
      if ((!applicationDealId && !governedDealKey) || (applicationDealId && governedDealKey)) {
        throw new ServingExactDetailError(
          'INVALID_REQUEST',
          'Provide exactly one deal identity for exact source.',
        );
      }
      const common = {
        serving_namespace_id: firstQueryValue(req.query?.namespace),
        corpus_release_id: firstQueryValue(req.query?.release),
        contract_fingerprint: firstQueryValue(req.query?.contract),
        row_serving_key: firstQueryValue(req.query?.row),
        source_detail_reference_id: firstQueryValue(req.query?.source),
      };
      const result = applicationDealId
        ? await queryServingExactDetail({
          client,
          request: { ...common, application_deal_id: applicationDealId },
        })
        : await queryServingExactDetailByGovernedDeal({
          client,
          request: { ...common, governed_deal_key: governedDealKey },
        });
      const reference = result.package.references.find((item) => (
        item.source_detail_reference_id === result.source_detail_reference_id
      ));
      const payload = result.package.detail_payloads.find((item) => (
        item.source_detail_payload_id === reference.source_detail_payload_id
      ));
      return (res) => {
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400, immutable');
        res.setHeader('ETag', `"${result.exact_detail_package_digest}"`);
        return res.status(200).json({
          schema_version: result.schema_version,
          serving_namespace_id: result.serving_namespace_id,
          corpus_release_id: result.corpus_release_id,
          row_serving_key: result.row_serving_key,
          source_detail_reference_id: result.source_detail_reference_id,
          exact_detail_package_digest: result.exact_detail_package_digest,
          detail: payload.response_body,
        });
      };
    },
  });
}

module.exports = {
  createCanonicalExactDetailHandler,
  createCanonicalReviewContextHandler,
  createGuardedHandler,
};
