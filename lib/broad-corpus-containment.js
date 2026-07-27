const BROAD_CORPUS_CONTAINED_ROUTES = Object.freeze({
  '/api/admin/candidates': Object.freeze(['GET', 'PATCH']),
  '/api/admin/ingest-runs': Object.freeze(['GET', 'PATCH']),
  '/api/annotations/propagate': 'POST',
  '/api/admin/reprocess-cond': 'POST',
  '/api/admin/store-agreement': 'POST',
  '/api/compare/features': 'GET',
  '/api/compare/rep-materiality': 'GET',
  '/api/comparisons': Object.freeze(['GET', 'POST', 'PATCH']),
  '/api/corrections/submit': 'POST',
  '/api/schema-coverage': 'GET',
  '/api/corpus-stats': 'GET',
  '/api/corpus-stats-batch': 'GET',
  '/api/admin/ingest-batch': 'POST',
  '/api/corpus-version': 'GET',
  '/api/ingest/agreement': 'POST',
  '/api/ingest/classify': 'POST',
  '/api/ingest/extract-section': 'POST',
  '/api/ingest/extract-type': 'POST',
  '/api/ingest/from-url': 'POST',
  '/api/ingest/run-all': 'POST',
  '/api/ingest/segment-v2': 'POST',
  '/api/ingest/segment': 'POST',
  '/api/users': Object.freeze(['GET', 'POST']),
});

const BROAD_CORPUS_CONTAINED_ROUTE_FILES = Object.freeze({
  '/api/admin/candidates': 'pages/api/admin/candidates.js',
  '/api/admin/ingest-runs': 'pages/api/admin/ingest-runs.js',
  '/api/annotations/propagate': 'pages/api/annotations/propagate.js',
  '/api/admin/reprocess-cond': 'pages/api/admin/reprocess-cond.js',
  '/api/admin/store-agreement': 'pages/api/admin/store-agreement.js',
  '/api/compare/features': 'pages/api/compare/features.js',
  '/api/compare/rep-materiality': 'pages/api/compare/rep-materiality.js',
  '/api/comparisons': 'pages/api/comparisons.js',
  '/api/corrections/submit': 'pages/api/corrections/submit.js',
  '/api/schema-coverage': 'pages/api/schema-coverage.js',
  '/api/corpus-stats': 'pages/api/corpus-stats.js',
  '/api/corpus-stats-batch': 'pages/api/corpus-stats-batch.js',
  '/api/admin/ingest-batch': 'pages/api/admin/ingest-batch.js',
  '/api/corpus-version': 'pages/api/corpus-version.js',
  '/api/ingest/agreement': 'pages/api/ingest/agreement.js',
  '/api/ingest/classify': 'pages/api/ingest/classify.js',
  '/api/ingest/extract-section': 'pages/api/ingest/extract-section.js',
  '/api/ingest/extract-type': 'pages/api/ingest/extract-type.js',
  '/api/ingest/from-url': 'pages/api/ingest/from-url.js',
  '/api/ingest/run-all': 'pages/api/ingest/run-all.js',
  '/api/ingest/segment-v2': 'pages/api/ingest/segment-v2.js',
  '/api/ingest/segment': 'pages/api/ingest/segment.js',
  '/api/users': 'pages/api/users.js',
});

const BROAD_CORPUS_ROUTE_CONTAINED_BODY = Object.freeze({
  error: Object.freeze({
    code: 'ROUTE_CONTAINED',
    message: 'This broad corpus operation is temporarily unavailable.',
  }),
});

function sendBroadCorpusRouteContained(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(503).json(BROAD_CORPUS_ROUTE_CONTAINED_BODY);
}

function createBroadCorpusContainedHandler(allowedMethod) {
  const allowedMethods = Object.freeze(
    Array.isArray(allowedMethod) ? [...allowedMethod] : [allowedMethod],
  );
  return function broadCorpusContainedHandler(req, res) {
    if (!allowedMethods.includes(req.method)) {
      res.setHeader('Allow', allowedMethods.join(', '));
      return res.status(405).json({ error: `${allowedMethods.join(' or ')} only` });
    }
    return sendBroadCorpusRouteContained(res);
  };
}

module.exports = {
  BROAD_CORPUS_CONTAINED_ROUTES,
  BROAD_CORPUS_CONTAINED_ROUTE_FILES,
  BROAD_CORPUS_ROUTE_CONTAINED_BODY,
  createBroadCorpusContainedHandler,
  sendBroadCorpusRouteContained,
};
