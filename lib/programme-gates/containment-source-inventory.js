const {
  BROAD_CORPUS_CONTAINED_ROUTES,
  BROAD_CORPUS_CONTAINED_ROUTE_FILES,
} = require('../broad-corpus-containment');
const {
  QUERY_CONTAINED_ROUTES,
  QUERY_CONTAINED_ROUTE_FILES,
} = require('../query-containment');
const { SERVICE_CLIENT_ROUTE_ACTIONS } = require('../service-client-route-actions');
const { domainDigest } = require('./bytes');

const HTTP_METHODS = Object.freeze([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function actionId(method, route) {
  return `${method} ${route}`;
}

function actionMethods(value) {
  return Array.isArray(value) ? value : [value];
}

function sourceContainmentInventory() {
  const actions = new Map();
  function add(route, method, containmentClass, file) {
    const memberId = actionId(method, route);
    const current = actions.get(memberId);
    if (current && current.file !== file) {
      throw new Error(`${memberId} maps to more than one route file`);
    }
    if (!current) {
      actions.set(memberId, {
        member_id: memberId,
        route_id: route,
        method,
        containment_class: containmentClass,
        file,
      });
    }
  }

  for (const route of QUERY_CONTAINED_ROUTES) {
    for (const method of HTTP_METHODS) {
      add(route, method, 'QUERY_ROUTE', QUERY_CONTAINED_ROUTE_FILES[route]);
    }
  }
  for (const [route, methods] of Object.entries(BROAD_CORPUS_CONTAINED_ROUTES)) {
    for (const method of actionMethods(methods)) {
      add(route, method, 'BROAD_CORPUS_ACTION', BROAD_CORPUS_CONTAINED_ROUTE_FILES[route]);
    }
  }
  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    if (descriptor.route === '/api/market-stats') continue;
    for (const routeAction of descriptor.actions) {
      if (routeAction.disposition !== 'HARD_CONTAIN') continue;
      add(
        descriptor.route,
        routeAction.method,
        'PUBLIC_SERVICE_ACTION',
        descriptor.file,
      );
    }
  }
  return Object.freeze([...actions.values()].sort(
    (left, right) => compareText(left.member_id, right.member_id),
  ).map(Object.freeze));
}

const SOURCE_CONTAINMENT_INVENTORY_EXECUTABLE_DIGEST = domainDigest(
  'PROGRAMME_GATE_SOURCE_CONTAINMENT_INVENTORY_EXECUTABLE/V1',
  {
    http_methods: HTTP_METHODS,
    source: sourceContainmentInventory.toString(),
    action_id_source: actionId.toString(),
    action_methods_source: actionMethods.toString(),
  },
);

module.exports = {
  HTTP_METHODS,
  SOURCE_CONTAINMENT_INVENTORY_EXECUTABLE_DIGEST,
  actionId,
  sourceContainmentInventory,
};
