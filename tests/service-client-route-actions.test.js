const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
  ROUTE_ACTION_AUTH,
  ROUTE_ACTION_DISPOSITIONS,
  ROUTE_ACTION_KINDS,
  SERVICE_CLIENT_MODES,
  SERVICE_CLIENT_ROUTE_ACTIONS,
  assertServiceClientRouteActionInventory,
} = require('../lib/service-client-route-actions');

const ROOT = path.join(__dirname, '..');
const API_ROOT = path.join(ROOT, 'pages/api');
const LIB_ROOT = path.join(ROOT, 'lib');
const SOURCE_ROOTS = [API_ROOT, LIB_ROOT];
const SERVICE_CAPABILITY_PATTERN = /\bgetServiceSupabase\b|\bSUPABASE_SERVICE_ROLE_KEY\b|\bcreateClient\b/;
const HTTP_METHOD_PATTERN = /\b(?:DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)\b/g;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function read(relativeFile) {
  return fs.readFileSync(path.join(ROOT, relativeFile), 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function toRelative(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join('/');
}

function isWithin(directory, file) {
  const relative = path.relative(directory, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function resolveImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(path.join(ROOT, importer)), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [
        `${base}.js`,
        `${base}.mjs`,
        `${base}.cjs`,
        path.join(base, 'index.js'),
        path.join(base, 'index.mjs'),
        path.join(base, 'index.cjs'),
      ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved || !SOURCE_ROOTS.some((directory) => isWithin(directory, resolved))) return null;
  return toRelative(resolved);
}

function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function relativeSpecifiers(source) {
  const code = withoutComments(source);
  const specifiers = [];
  for (const match of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  for (const match of code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  for (const match of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  return specifiers.filter((specifier) => specifier.startsWith('.'));
}

function importedSources(file, source) {
  return relativeSpecifiers(source)
    .map((specifier) => resolveImport(file, specifier))
    .filter(Boolean)
    .map((dependency) => read(dependency));
}

function buildRelativeImportGraph() {
  const files = SOURCE_ROOTS
    .flatMap(walk)
    .filter((file) => /\.(?:c|m)?js$/.test(file))
    .map(toRelative)
    .sort(compareText);
  const sources = new Map(files.map((file) => [file, read(file)]));
  const imports = new Map(files.map((file) => [
    file,
    relativeSpecifiers(sources.get(file))
      .map((specifier) => resolveImport(file, specifier))
      .filter(Boolean)
      .sort(compareText),
  ]));
  const capabilityFiles = new Set(
    files.filter((file) => SERVICE_CAPABILITY_PATTERN.test(withoutComments(sources.get(file)))),
  );
  return { sources, imports, capabilityFiles };
}

function reachesCapability(file, graph, visiting = new Set()) {
  if (graph.capabilityFiles.has(file)) return true;
  if (visiting.has(file)) return false;
  visiting.add(file);
  for (const dependency of graph.imports.get(file) || []) {
    if (reachesCapability(dependency, graph, visiting)) {
      visiting.delete(file);
      return true;
    }
  }
  visiting.delete(file);
  return false;
}

function discoverServiceClientModes() {
  const graph = buildRelativeImportGraph();
  const apiFiles = [...graph.sources.keys()].filter((file) => file.startsWith('pages/api/'));
  const modes = new Map();
  for (const file of apiFiles) {
    const mode = graph.capabilityFiles.has(file)
      ? 'DIRECT'
      : reachesCapability(file, graph)
        ? 'TRANSITIVE'
        : 'ZERO_IMPORT';
    modes.set(file, mode);
  }
  return { graph, modes };
}

function parseContainedHandlerMethods(source) {
  const match = source.match(/create(?:BroadCorpusContained|MarketStatsDisabled)Handler\(\s*(\[[^\]]+\]|['"][A-Z]+['"])\s*\)/);
  if (!match) return [];
  return [...new Set(match[1].match(HTTP_METHOD_PATTERN) || [])].sort(compareText);
}

function discoverSupportedMethods(source) {
  const contained = parseContainedHandlerMethods(source);
  if (contained.length) return contained;

  const allowed = new Set();
  for (const match of source.matchAll(/\[\s*((?:['"][A-Z]+['"]\s*,?\s*)+)\]\.includes\(\s*req\.method\s*\)/g)) {
    for (const method of match[1].match(HTTP_METHOD_PATTERN) || []) allowed.add(method);
  }
  for (const match of source.matchAll(/req\.method\s*===\s*['"]([A-Z]+)['"]/g)) allowed.add(match[1]);
  for (const match of source.matchAll(/req\.method\s*!==\s*['"]([A-Z]+)['"]/g)) allowed.add(match[1]);
  return [...allowed].sort(compareText);
}

function firstClientCreation(source) {
  const calls = [
    source.search(/\bgetServiceSupabase\s*\(\s*\)/),
    source.search(/\bgetSupabase\s*\(\s*\)/),
  ].filter((index) => index >= 0);
  return calls.length ? Math.min(...calls) : -1;
}

function handlerRuntimeSource(source) {
  const factoryHandler = source.search(/\breturn\s+(?:async\s+)?function\s+handler\b/);
  if (factoryHandler >= 0) return source.slice(factoryHandler);
  const defaultHandler = source.search(/\bexport\s+default\s+(?:async\s+)?function\s+handler\b/);
  return defaultHandler >= 0 ? source.slice(defaultHandler) : source;
}

function hardContainmentPrecedesClient(source) {
  const handlerSource = handlerRuntimeSource(source);
  const client = firstClientCreation(handlerSource);
  const containment = handlerSource.search(/\breturn\s+sendBroadCorpusRouteContained\s*\(/);
  return containment >= 0 && (client < 0 || containment < client);
}

function responseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function loadEdgarWatchFactory() {
  const file = 'pages/api/cron/edgar-watch.js';
  const source = read(file)
    .replace(/^import\s+.*;$/gm, '')
    .replace(/\bexport\s+const\b/g, 'const')
    .replace(/\bexport\s+function\b/g, 'function')
    .replace(/\bexport\s+default\s+createEdgarWatchHandler\(\s*\)\s*;?/g, '');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    process: { env: {} },
  };
  vm.runInNewContext(
    `${source}\nmodule.exports = { createEdgarWatchHandler };`,
    sandbox,
    { filename: path.join(ROOT, file) },
  );
  return sandbox.module.exports.createEdgarWatchHandler;
}

function loadZeroImportRouteHandler(descriptor) {
  const source = read(descriptor.file)
    .replace(/\bexport\s+default\s+/g, 'module.exports = ');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(specifier) {
      const dependency = resolveImport(descriptor.file, specifier);
      if (!dependency) throw new Error(`unresolved runtime dependency ${specifier}`);
      if (!['lib/broad-corpus-containment.js', 'lib/market-stats-containment.js'].includes(dependency)) {
        throw new Error(`unexpected runtime dependency ${dependency}`);
      }
      return require(path.join(ROOT, dependency));
    },
  };
  vm.runInNewContext(source, sandbox, { filename: path.join(ROOT, descriptor.file) });
  if (typeof sandbox.module.exports !== 'function') {
    throw new Error(`${descriptor.route} does not export a handler`);
  }
  return sandbox.module.exports;
}

function exactHardGuardFailure(descriptor) {
  const hardMethods = descriptor.actions
    .filter(({ disposition }) => disposition === 'HARD_CONTAIN')
    .map(({ method }) => method);
  if (!hardMethods.length || descriptor.service_client_mode === 'ZERO_IMPORT') return null;

  const supportedMethods = descriptor.actions.map(({ method }) => method);
  const allowedMethods = descriptor.actions
    .filter(({ disposition }) => disposition === 'ALLOW')
    .map(({ method }) => method);
  const handler = withoutComments(handlerRuntimeSource(read(descriptor.file)));
  const containmentCall = /\breturn\s+sendBroadCorpusRouteContained\s*\(\s*res\s*\)/;

  if (hardMethods.length === supportedMethods.length) {
    const onlyMethod = supportedMethods.length === 1
      ? new RegExp(
          `if\\s*\\(\\s*req\\.method\\s*!==\\s*['"]${supportedMethods[0]}['"]\\s*\\)[\\s\\S]*?${containmentCall.source}`,
        )
      : null;
    if (onlyMethod && onlyMethod.test(handler)) return null;
    return `${descriptor.route}: all-method containment is not bound to its exact supported-method guard`;
  }

  if (allowedMethods.length === 1 && allowedMethods[0] === 'GET') {
    if (
      hardMethods.length === supportedMethods.length - 1
      && /if\s*\(\s*req\.method\s*!==\s*['"]GET['"]\s*\)\s*return\s+sendBroadCorpusRouteContained\s*\(\s*res\s*\)/.test(handler)
    ) {
      return null;
    }
    if (
      hardMethods.length === 1
      && hardMethods[0] === 'POST'
      && /if\s*\(\s*req\.method\s*===\s*['"]POST['"][^)]*\)[\s\S]*?return\s+sendBroadCorpusRouteContained\s*\(\s*res\s*\)/.test(handler)
    ) {
      return null;
    }
  }

  return `${descriptor.route} ${hardMethods.join(',')}: no exact hard-containment guard`;
}

test('the route-action inventory is closed, sorted and internally fail-closed', () => {
  assert.deepEqual(SERVICE_CLIENT_MODES, ['DIRECT', 'TRANSITIVE', 'ZERO_IMPORT']);
  assert.deepEqual(ROUTE_ACTION_AUTH, ['PUBLIC', 'CRON_SECRET', 'EDITOR_KEY']);
  assert.deepEqual(ROUTE_ACTION_KINDS, ['BOUNDED_READ', 'BROAD_READ', 'MUTATION']);
  assert.deepEqual(ROUTE_ACTION_DISPOSITIONS, ['ALLOW', 'HARD_CONTAIN']);
  assert.equal(assertServiceClientRouteActionInventory(), true);
});

test('recursive import discovery finds no unregistered or misclassified service-client route', () => {
  const inventoryByFile = new Map(SERVICE_CLIENT_ROUTE_ACTIONS.map((entry) => [entry.file, entry]));
  const { modes } = discoverServiceClientModes();
  const discovered = [...modes]
    .filter(([, mode]) => mode !== 'ZERO_IMPORT')
    .map(([file]) => file)
    .sort(compareText);
  const unregistered = discovered.filter((file) => !inventoryByFile.has(file));
  assert.deepEqual(unregistered, []);

  const modeFailures = [];
  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    const actual = modes.get(descriptor.file);
    if (!actual) {
      modeFailures.push(`${descriptor.route}: route module is not discoverable at ${descriptor.file}`);
      continue;
    }
    if (actual !== descriptor.service_client_mode) {
      modeFailures.push(`${descriptor.route}: expected ${descriptor.service_client_mode}, found ${actual}`);
    }
    const routeFromFile = descriptor.file
      .replace(/^pages\/api/, '/api')
      .replace(/\/index\.js$/, '')
      .replace(/\.js$/, '');
    if (routeFromFile !== descriptor.route) {
      modeFailures.push(`${descriptor.route}: file resolves to ${routeFromFile}`);
    }
  }
  assert.deepEqual(modeFailures, []);
});

test('every inventory entry names the route module and its exact supported methods', () => {
  const failures = [];
  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    const absolute = path.join(ROOT, descriptor.file);
    if (!fs.existsSync(absolute)) {
      failures.push(`${descriptor.route}: missing ${descriptor.file}`);
      continue;
    }
    const expected = descriptor.actions.map(({ method }) => method);
    const routeSource = read(descriptor.file);
    const actual = discoverSupportedMethods(routeSource);
    const dependencyMethods = importedSources(descriptor.file, routeSource)
      .flatMap(discoverSupportedMethods);
    const discovered = actual.length
      ? actual
      : [...new Set(dependencyMethods)].sort(compareText);
    if (!discovered.length) {
      failures.push(`${descriptor.route}: supported methods are not mechanically declared`);
    } else if (
      discovered.length !== expected.length
      || discovered.some((method, index) => method !== expected[index])
    ) {
      failures.push(`${descriptor.route}: expected ${expected.join(',')}, found ${discovered.join(',')}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('zero-import routes load only a containment handler and no service dependency', () => {
  const failures = [];
  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    if (descriptor.service_client_mode !== 'ZERO_IMPORT') continue;
    const source = read(descriptor.file);
    const dependencySource = importedSources(descriptor.file, source).join('\n');
    const containmentSource = `${source}\n${dependencySource}`;
    const dependencyCount = (source.match(/\b(?:import\s|require\()/g) || []).length;
    if (!/createBroadCorpusContainedHandler\(|marketStatsContainedHandler/.test(containmentSource)) {
      failures.push(`${descriptor.route}: no zero-import containment handler`);
    }
    if (SERVICE_CAPABILITY_PATTERN.test(withoutComments(containmentSource))) {
      failures.push(`${descriptor.route}: still references a service client`);
    }
    if (dependencyCount !== 1) {
      failures.push(`${descriptor.route}: expected one containment dependency, found ${dependencyCount}`);
    }
    if (/anthropic|process\.env|readFile|fetch\s*\(|\.from\s*\(/i.test(containmentSource)) {
      failures.push(`${descriptor.route}: retains a database, model, environment or corpus dependency`);
    }
  }
  assert.deepEqual(failures, []);
});

test('public broad reads and mutations hard-contain before any direct client creation', () => {
  const failures = [];
  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    if (descriptor.service_client_mode === 'ZERO_IMPORT') continue;
    const hardActions = descriptor.actions.filter(({ disposition }) => disposition === 'HARD_CONTAIN');
    if (!hardActions.length) continue;
    const source = read(descriptor.file);
    if (!hardContainmentPrecedesClient(source)) {
      failures.push(
        `${descriptor.route} ${hardActions.map(({ method }) => method).join(',')}: containment must precede client creation`,
      );
    }
  }
  assert.deepEqual(failures, []);
});

test('non-injectable hard containment is bound to exact method guards and return paths', () => {
  const failures = SERVICE_CLIENT_ROUTE_ACTIONS
    .map(exactHardGuardFailure)
    .filter(Boolean);
  assert.deepEqual(failures, []);
});

test('zero-import hard-contained methods cold-execute through their dependency-free handlers', async () => {
  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    if (descriptor.service_client_mode !== 'ZERO_IMPORT') continue;
    const handler = loadZeroImportRouteHandler(descriptor);
    for (const routeAction of descriptor.actions) {
      const res = responseRecorder();
      await handler({ method: routeAction.method }, res);
      assert.equal(res.statusCode, 503, `${descriptor.route} ${routeAction.method}`);
      assert.equal(res.headers['Retry-After'], undefined, `${descriptor.route} ${routeAction.method}`);
    }
  }
});

test('injectable authenticated factory rejects every unauthorised action before client creation', async () => {
  const createEdgarWatchHandler = loadEdgarWatchFactory();
  let clientCreations = 0;
  let discoveries = 0;
  const handler = createEdgarWatchHandler({
    getSupabase() {
      clientCreations += 1;
      throw new Error('service client must not be created');
    },
    discoverCandidates() {
      discoveries += 1;
      throw new Error('discovery must not run');
    },
    getCronSecret: () => 'expected-secret',
  });

  for (const method of ['GET', 'POST']) {
    const res = responseRecorder();
    await handler({ method, headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 401, method);
  }
  assert.equal(clientCreations, 0);
  assert.equal(discoveries, 0);
});

test('preserved corrections reads are scoped, non-summary and capped before client creation', () => {
  const source = read('pages/api/corrections.js');
  const client = firstClientCreation(source);
  const guard = source.search(
    /req\.method\s*===\s*['"]POST['"]\s*\|\|\s*summary\s*\|\|\s*!\(query\.deal_id\s*\|\|\s*query\.provision_id\)/,
  );
  const containment = source.search(/\breturn\s+sendBroadCorpusRouteContained\s*\(/);

  assert.ok(guard >= 0);
  assert.ok(containment > guard);
  assert.ok(client > containment);
  assert.match(source, /const\s+lim\s*=\s*Math\.min\([^;]+,\s*1000\)/);
  assert.match(source, /\.limit\(\s*lim\s*\)/);
});

test('provision-type reads have explicit row ceilings and every write contains before the client', () => {
  const source = read('pages/api/provision-types.js');
  const client = firstClientCreation(source);
  const containment = source.search(
    /if\s*\(\s*req\.method\s*!==\s*['"]GET['"]\s*\)\s*return\s+sendBroadCorpusRouteContained\s*\(/,
  );

  assert.ok(containment >= 0);
  assert.ok(client > containment);
  assert.match(source, /const\s+MAX_PROVISION_TYPES\s*=\s*1000\s*;/);
  assert.match(source, /const\s+MAX_PROVISION_CATEGORIES\s*=\s*5000\s*;/);
  assert.match(source, /\.limit\(\s*MAX_PROVISION_TYPES\s*\)/);
  assert.match(source, /\.limit\(\s*MAX_PROVISION_CATEGORIES\s*\)/);
});

test('allowed authenticated actions prove authentication before client creation', () => {
  const failures = [];
  const markers = {
    CRON_SECRET: /\bauthorised\(\s*req\b/,
    EDITOR_KEY: /\bresolveEditorKey\(/,
  };

  for (const descriptor of SERVICE_CLIENT_ROUTE_ACTIONS) {
    const authenticated = descriptor.actions.filter(
      ({ auth, disposition }) => auth !== 'PUBLIC' && disposition === 'ALLOW',
    );
    if (!authenticated.length) continue;
    const source = handlerRuntimeSource(read(descriptor.file));
    const client = firstClientCreation(source);
    for (const routeAction of authenticated) {
      const marker = source.search(markers[routeAction.auth]);
      if (marker < 0 || client < 0 || marker > client) {
        failures.push(`${descriptor.route} ${routeAction.method}: ${routeAction.auth} must be resolved before client creation`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
