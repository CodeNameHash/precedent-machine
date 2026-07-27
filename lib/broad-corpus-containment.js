const BROAD_CORPUS_CONTAINED_ROUTES = Object.freeze({
  '/api/annotations/propagate': 'POST',
  '/api/compare/features': 'GET',
  '/api/compare/rep-materiality': 'GET',
  '/api/schema-coverage': 'GET',
  '/api/corpus-stats': 'GET',
  '/api/corpus-stats-batch': 'GET',
  '/api/admin/ingest-batch': 'POST',
  '/api/corpus-version': 'GET',
});

const BROAD_CORPUS_CONTAINED_ROUTE_FILES = Object.freeze({
  '/api/annotations/propagate': 'pages/api/annotations/propagate.js',
  '/api/compare/features': 'pages/api/compare/features.js',
  '/api/compare/rep-materiality': 'pages/api/compare/rep-materiality.js',
  '/api/schema-coverage': 'pages/api/schema-coverage.js',
  '/api/corpus-stats': 'pages/api/corpus-stats.js',
  '/api/corpus-stats-batch': 'pages/api/corpus-stats-batch.js',
  '/api/admin/ingest-batch': 'pages/api/admin/ingest-batch.js',
  '/api/corpus-version': 'pages/api/corpus-version.js',
});

const BROAD_CORPUS_ROUTE_CONTAINED_BODY = Object.freeze({
  error: Object.freeze({
    code: 'BROAD_CORPUS_ROUTE_CONTAINED',
    message: 'This broad corpus operation is temporarily unavailable.',
  }),
});

function sendBroadCorpusRouteContained(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(503).json(BROAD_CORPUS_ROUTE_CONTAINED_BODY);
}

function createBroadCorpusContainedHandler(allowedMethod) {
  return function broadCorpusContainedHandler(req, res) {
    if (req.method !== allowedMethod) {
      res.setHeader('Allow', allowedMethod);
      return res.status(405).json({ error: `${allowedMethod} only` });
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
