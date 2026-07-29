const SERVICE_CLIENT_MODES = Object.freeze([
  'DIRECT',
  'TRANSITIVE',
  'ZERO_IMPORT',
]);

const ROUTE_ACTION_AUTH = Object.freeze([
  'PUBLIC',
  'CRON_SECRET',
  'EDITOR_KEY',
]);

const ROUTE_ACTION_KINDS = Object.freeze([
  'BOUNDED_READ',
  'BROAD_READ',
  'MUTATION',
]);

const ROUTE_ACTION_DISPOSITIONS = Object.freeze([
  'ALLOW',
  'HARD_CONTAIN',
]);

const action = (method, auth, kind, disposition) => Object.freeze({
  method,
  auth,
  kind,
  disposition,
});

const route = (routePath, file, serviceClientMode, actions) => Object.freeze({
  route: routePath,
  file,
  service_client_mode: serviceClientMode,
  actions: Object.freeze(actions),
});

const SERVICE_CLIENT_ROUTE_ACTIONS = Object.freeze([
  route('/api/admin/audit/freeze', 'pages/api/admin/audit/freeze.js', 'TRANSITIVE', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/admin/audit/matrix', 'pages/api/admin/audit/matrix.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BROAD_READ', 'HARD_CONTAIN'),
  ]),
  route('/api/admin/candidates', 'pages/api/admin/candidates.js', 'ZERO_IMPORT', [
    action('GET', 'PUBLIC', 'BROAD_READ', 'HARD_CONTAIN'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/admin/check-agreement-duplicate', 'pages/api/admin/check-agreement-duplicate.js', 'DIRECT', [
    action('POST', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/admin/find-deal', 'pages/api/admin/find-deal.js', 'DIRECT', [
    action('POST', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/admin/gaps', 'pages/api/admin/gaps.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/admin/ingest-runs', 'pages/api/admin/ingest-runs.js', 'ZERO_IMPORT', [
    action('GET', 'PUBLIC', 'BROAD_READ', 'HARD_CONTAIN'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/admin/registry/preview', 'pages/api/admin/registry/preview.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/admin/reports', 'pages/api/admin/reports.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/admin/reprocess-cond', 'pages/api/admin/reprocess-cond.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/admin/store-agreement', 'pages/api/admin/store-agreement.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/agreement-source', 'pages/api/agreement-source.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/ai/annotate', 'pages/api/ai/annotate.js', 'DIRECT', [
    action('POST', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/annotations', 'pages/api/annotations.js', 'DIRECT', [
    action('DELETE', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/comments', 'pages/api/comments.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/comparisons', 'pages/api/comparisons.js', 'ZERO_IMPORT', [
    action('GET', 'PUBLIC', 'BROAD_READ', 'HARD_CONTAIN'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/corrections', 'pages/api/corrections.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/corrections/review', 'pages/api/corrections/review.js', 'DIRECT', [
    action('POST', 'EDITOR_KEY', 'MUTATION', 'ALLOW'),
  ]),
  route('/api/corrections/submit', 'pages/api/corrections/submit.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/cron/edgar-watch', 'pages/api/cron/edgar-watch.js', 'DIRECT', [
    action('GET', 'CRON_SECRET', 'MUTATION', 'ALLOW'),
    action('POST', 'CRON_SECRET', 'MUTATION', 'ALLOW'),
  ]),
  route('/api/deals', 'pages/api/deals.js', 'DIRECT', [
    action('DELETE', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/agreement', 'pages/api/ingest/agreement.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/classify', 'pages/api/ingest/classify.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/extract-section', 'pages/api/ingest/extract-section.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/extract-type', 'pages/api/ingest/extract-type.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/from-url', 'pages/api/ingest/from-url.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/run-all', 'pages/api/ingest/run-all.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/segment', 'pages/api/ingest/segment.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/ingest/segment-v2', 'pages/api/ingest/segment-v2.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/market-stats', 'pages/api/market-stats.js', 'ZERO_IMPORT', [
    action('POST', 'PUBLIC', 'BROAD_READ', 'HARD_CONTAIN'),
  ]),
  route('/api/provision-types', 'pages/api/provision-types.js', 'DIRECT', [
    action('DELETE', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/provisions', 'pages/api/provisions.js', 'DIRECT', [
    action('DELETE', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('PATCH', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/review/[id]/cards', 'pages/api/review/[id]/cards.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/signoffs', 'pages/api/signoffs.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
  route('/api/trust/report', 'pages/api/trust/report.js', 'DIRECT', [
    action('GET', 'PUBLIC', 'BOUNDED_READ', 'ALLOW'),
  ]),
  route('/api/users', 'pages/api/users.js', 'ZERO_IMPORT', [
    action('GET', 'PUBLIC', 'BROAD_READ', 'HARD_CONTAIN'),
    action('POST', 'PUBLIC', 'MUTATION', 'HARD_CONTAIN'),
  ]),
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} must have exactly the keys ${wanted.join(', ')}`);
  }
}

function assertServiceClientRouteActionInventory(inventory = SERVICE_CLIENT_ROUTE_ACTIONS) {
  const seenRoutes = new Set();
  let previousRoute = '';

  for (const descriptor of inventory) {
    assertExactKeys(
      descriptor,
      ['route', 'file', 'service_client_mode', 'actions'],
      `route descriptor ${descriptor.route || '<unknown>'}`,
    );
    if (seenRoutes.has(descriptor.route)) throw new Error(`duplicate route ${descriptor.route}`);
    if (previousRoute && compareText(previousRoute, descriptor.route) >= 0) {
      throw new Error(`routes must be sorted: ${previousRoute}, ${descriptor.route}`);
    }
    if (!SERVICE_CLIENT_MODES.includes(descriptor.service_client_mode)) {
      throw new Error(`invalid service client mode for ${descriptor.route}`);
    }
    if (!descriptor.route.startsWith('/api/') || !descriptor.file.startsWith('pages/api/')) {
      throw new Error(`invalid route identity for ${descriptor.route}`);
    }
    if (!descriptor.actions.length) throw new Error(`route has no actions: ${descriptor.route}`);

    let previousMethod = '';
    const seenMethods = new Set();
    for (const routeAction of descriptor.actions) {
      assertExactKeys(
        routeAction,
        ['method', 'auth', 'kind', 'disposition'],
        `route action ${descriptor.route}`,
      );
      if (seenMethods.has(routeAction.method)) {
        throw new Error(`duplicate method ${descriptor.route} ${routeAction.method}`);
      }
      if (previousMethod && compareText(previousMethod, routeAction.method) >= 0) {
        throw new Error(`methods must be sorted for ${descriptor.route}`);
      }
      if (!ROUTE_ACTION_AUTH.includes(routeAction.auth)) {
        throw new Error(`invalid auth for ${descriptor.route} ${routeAction.method}`);
      }
      if (!ROUTE_ACTION_KINDS.includes(routeAction.kind)) {
        throw new Error(`invalid action kind for ${descriptor.route} ${routeAction.method}`);
      }
      if (!ROUTE_ACTION_DISPOSITIONS.includes(routeAction.disposition)) {
        throw new Error(`invalid disposition for ${descriptor.route} ${routeAction.method}`);
      }
      if (
        routeAction.auth === 'PUBLIC'
        && ['BROAD_READ', 'MUTATION'].includes(routeAction.kind)
        && routeAction.disposition !== 'HARD_CONTAIN'
      ) {
        throw new Error(`public ${routeAction.kind} must hard-contain: ${descriptor.route} ${routeAction.method}`);
      }
      if (descriptor.service_client_mode === 'ZERO_IMPORT' && routeAction.disposition !== 'HARD_CONTAIN') {
        throw new Error(`zero-import route must hard-contain: ${descriptor.route} ${routeAction.method}`);
      }
      seenMethods.add(routeAction.method);
      previousMethod = routeAction.method;
    }

    seenRoutes.add(descriptor.route);
    previousRoute = descriptor.route;
  }

  return true;
}

module.exports = {
  ROUTE_ACTION_AUTH,
  ROUTE_ACTION_DISPOSITIONS,
  ROUTE_ACTION_KINDS,
  SERVICE_CLIENT_MODES,
  SERVICE_CLIENT_ROUTE_ACTIONS,
  assertServiceClientRouteActionInventory,
};
