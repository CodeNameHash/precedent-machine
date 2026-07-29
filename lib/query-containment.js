const QUERY_CONTAINED_ROUTES = Object.freeze([
  '/api/query/run',
  '/api/query/interpret',
  '/api/query/field-options',
  '/api/query/demo-set',
  '/api/query/kinds',
  '/api/saved-queries',
  '/api/canonical-v2/query',
]);

const QUERY_CONTAINED_ROUTE_FILES = Object.freeze({
  '/api/query/run': 'pages/api/query/run.js',
  '/api/query/interpret': 'pages/api/query/interpret.js',
  '/api/query/field-options': 'pages/api/query/field-options.js',
  '/api/query/demo-set': 'pages/api/query/demo-set.js',
  '/api/query/kinds': 'pages/api/query/kinds.js',
  '/api/saved-queries': 'pages/api/saved-queries.js',
  '/api/canonical-v2/query': 'pages/api/canonical-v2/query.js',
});

const QUERY_CONTAINED_ARCHIVE_FILES = Object.freeze({
  '/api/query/run': 'lib/query/contained-routes/run.js',
  '/api/query/interpret': 'lib/query/contained-routes/interpret.js',
  '/api/query/field-options': 'lib/query/contained-routes/field-options.js',
  '/api/query/demo-set': 'lib/query/contained-routes/demo-set.js',
  '/api/query/kinds': 'lib/query/contained-routes/kinds.js',
  '/api/saved-queries': 'lib/query/contained-routes/saved-queries.js',
  '/api/canonical-v2/query': 'lib/query/contained-routes/canonical-v2-query.js',
});

const ROUTE_CONTAINED_BODY = Object.freeze({
  error: Object.freeze({
    code: 'ROUTE_CONTAINED',
    message: 'Query is temporarily unavailable.',
  }),
});

function queryContainedHandler(_req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(503).json(ROUTE_CONTAINED_BODY);
}

module.exports = {
  QUERY_CONTAINED_ROUTES,
  QUERY_CONTAINED_ROUTE_FILES,
  QUERY_CONTAINED_ARCHIVE_FILES,
  ROUTE_CONTAINED_BODY,
  queryContainedHandler,
};
