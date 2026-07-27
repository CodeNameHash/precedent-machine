const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { MarketStatsError } = require('../lib/row-market-stats/errors');
const { createMarketStatsHandler } = require('../lib/row-market-stats/handler');
const { MAX_BATCH_METRICS, parseMarketStatsRequest } = require('../lib/row-market-stats/request');

function metric(metricKey, rowKey = 'row') {
  return {
    contractVersion: 1,
    rowKey,
    metricKey,
    label: metricKey,
    comparison: { status: 'comparable', kind: 'presence' },
    cohort: { scope: 'all_deals', eligibility: 'all_deals' },
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['feature'], missingState: 'absent' },
    },
    denominator: { prevalence: 'eligible_deals', distribution: 'present_deals' },
  };
}

function validateSpec(value) {
  return value && value.contractVersion === 1 && value.rowKey && value.metricKey
    ? { valid: true, errors: [] }
    : { valid: false, errors: [{ path: 'metricKey', message: 'required' }] };
}

function validateResult(value) {
  return value && value.contractVersion === 1 && value.coverage
    ? { valid: true, errors: [] }
    : { valid: false, errors: [{ path: 'coverage', message: 'required' }] };
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

function minimalDataset() {
  return {
    deals: [{ id: 'd1', value_usd: 1e9, metadata: {} }],
    cards: [],
    claims: [],
  };
}

test('market-stats production route is hard-closed in code', () => {
  const route = fs.readFileSync('pages/api/market-stats.js', 'utf8');
  assert.match(route, /require\(['"]\.\.\/\.\.\/lib\/market-stats-containment['"]\)/);
  assert.match(route, /export default marketStatsContainedHandler/);
  assert.doesNotMatch(
    route,
    /supabase|createClient|market-metrics|row-market-stats|process\.env|fetch|readFile|from\(/i,
  );
  assert.equal((route.match(/\brequire\(/g) || []).length, 1);
  assert.equal((route.match(/\bimport\s/g) || []).length, 0);
});

test('default-closed handler rejects before parsing, Supabase initialisation or DB work', async () => {
  let supabaseCalls = 0;
  let loadCalls = 0;
  const handler = createMarketStatsHandler({
    getSupabase: () => { supabaseCalls += 1; return {}; },
    validateMetricSpec: validateSpec,
    validateMetricResult: validateResult,
    loadDataset: async () => { loadCalls += 1; return minimalDataset(); },
  });
  const res = responseRecorder();
  await handler({ method: 'POST', body: { invalid: true } }, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'MARKET_STATS_DISABLED');
  assert.equal(res.headers['Retry-After'], undefined);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(supabaseCalls, 0);
  assert.equal(loadCalls, 0);
});

test('handler rejects excess concurrent work without starting another DB read', async () => {
  let loadCalls = 0;
  let markStarted;
  let releaseLoad;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const blocked = new Promise((resolve) => { releaseLoad = resolve; });
  const handler = createMarketStatsHandler({
    enabled: true,
    maxConcurrent: 1,
    getSupabase: () => ({}),
    validateMetricSpec: validateSpec,
    validateMetricResult: validateResult,
    loadDataset: async () => {
      loadCalls += 1;
      markStarted();
      await blocked;
      return minimalDataset();
    },
  });
  const firstRes = responseRecorder();
  const firstRequest = handler({
    method: 'POST', body: { contractVersion: 1, specs: [metric('first')] },
  }, firstRes);
  await started;

  const secondRes = responseRecorder();
  await handler({
    method: 'POST', body: { contractVersion: 1, specs: [metric('second')] },
  }, secondRes);
  assert.equal(secondRes.statusCode, 503);
  assert.equal(secondRes.body.error.code, 'MARKET_STATS_BUSY');
  assert.equal(secondRes.headers['Retry-After'], '5');
  assert.equal(loadCalls, 1);

  releaseLoad();
  await firstRequest;
  assert.equal(firstRes.statusCode, 200);
});

test('handler opens a bounded circuit after repeated source failures and recovers after cooldown', async () => {
  let clock = 1_000;
  let loadCalls = 0;
  let sourceHealthy = false;
  const handler = createMarketStatsHandler({
    enabled: true,
    failureThreshold: 2,
    circuitCooldownMs: 10_000,
    now: () => clock,
    getSupabase: () => ({}),
    validateMetricSpec: validateSpec,
    validateMetricResult: validateResult,
    loadDataset: async () => {
      loadCalls += 1;
      if (!sourceHealthy) throw new MarketStatsError('DATA_SOURCE_ERROR', 'Unavailable.');
      return minimalDataset();
    },
  });
  const request = { method: 'POST', body: { contractVersion: 1, specs: [metric('row.presence')] } };

  const first = responseRecorder();
  await handler(request, first);
  const second = responseRecorder();
  await handler(request, second);
  const blocked = responseRecorder();
  await handler(request, blocked);

  assert.equal(first.body.error.code, 'DATA_SOURCE_ERROR');
  assert.equal(second.body.error.code, 'DATA_SOURCE_ERROR');
  assert.equal(second.headers['Retry-After'], '10');
  assert.equal(blocked.statusCode, 503);
  assert.equal(blocked.body.error.code, 'MARKET_STATS_CIRCUIT_OPEN');
  assert.equal(blocked.headers['Retry-After'], '10');
  assert.equal(loadCalls, 2);

  clock += 10_000;
  const failedProbe = responseRecorder();
  await handler(request, failedProbe);
  const reblocked = responseRecorder();
  await handler(request, reblocked);
  assert.equal(failedProbe.body.error.code, 'DATA_SOURCE_ERROR');
  assert.equal(reblocked.body.error.code, 'MARKET_STATS_CIRCUIT_OPEN');
  assert.equal(loadCalls, 3);

  clock += 10_000;
  sourceHealthy = true;
  const recovered = responseRecorder();
  await handler(request, recovered);
  assert.equal(recovered.statusCode, 200);
  assert.equal(loadCalls, 4);
});

test('POST /api/market-stats loads one dataset for a batch and groups metrics by row', async () => {
  let loadCalls = 0;
  const specs = [metric('row.presence'), metric('row.second')];
  const handler = createMarketStatsHandler({
    enabled: true,
    getSupabase: () => ({ configured: true }),
    validateMetricSpec: validateSpec,
    validateMetricResult: validateResult,
    loadDataset: async (_supabase, requestedSpecs) => {
      loadCalls += 1;
      assert.equal(requestedSpecs.length, 2);
      return {
        deals: [
          { id: 'd1', value_usd: 1e9, metadata: {} },
          { id: 'd2', value_usd: 2e9, metadata: {} },
        ],
        cards: [],
        claims: [
          { id: 'c1', deal_id: 'd1', attribute: 'feature', canonical: 'YES', provenance: {} },
        ],
      };
    },
  });
  const res = responseRecorder();
  await handler({ method: 'POST', body: { contractVersion: 1, specs } }, res);

  assert.equal(loadCalls, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(Object.keys(res.body.byRow.row.metrics).sort(), ['row.presence', 'row.second']);
  assert.equal(res.body.byRow.row.metrics['row.presence'].coverage.presentCount, 1);
  assert.equal(res.body.byRow.row.metrics['row.presence'].coverage.absentCount, 1);
});

test('request parser accepts rows as a compatibility alias but rejects ambiguous envelopes', () => {
  const parsed = parseMarketStatsRequest({ contractVersion: 1, rows: [metric('row.presence')] }, validateSpec);
  assert.equal(parsed.specs.length, 1);
  assert.throws(
    () => parseMarketStatsRequest({ contractVersion: 1, rows: [metric('a')], specs: [metric('b')] }, validateSpec),
    (error) => error.code === 'INVALID_REQUEST',
  );
});

test('request parser permits exact title-scoped card presence but rejects an unscoped all-deals card query', () => {
  const titleScoped = metric('title-scoped');
  titleScoped.observation.presence = {
    strategy: 'card_exists',
    shortTitleIncludes: 'Board Appointment',
    missingState: 'absent',
  };
  assert.equal(parseMarketStatsRequest({ contractVersion: 1, specs: [titleScoped] }, validateSpec).specs.length, 1);

  const unscoped = metric('unscoped');
  unscoped.observation.presence = { strategy: 'card_exists', missingState: 'absent' };
  assert.throws(
    () => parseMarketStatsRequest({ contractVersion: 1, specs: [unscoped] }, validateSpec),
    (error) => error.code === 'UNSUPPORTED_METRIC_SPEC',
  );
});

test('request parser preserves one-page batching headroom while enforcing a finite ceiling', () => {
  const specs = Array.from({ length: MAX_BATCH_METRICS }, (_, index) => metric(`metric-${index}`, `row-${index}`));
  assert.equal(parseMarketStatsRequest({ contractVersion: 1, specs }, validateSpec).specs.length, MAX_BATCH_METRICS);
  assert.throws(
    () => parseMarketStatsRequest({ contractVersion: 1, specs: [...specs, metric('overflow')] }, validateSpec),
    (error) => error.code === 'INVALID_REQUEST',
  );
});

test('API returns typed validation, method, configuration and source errors', async (t) => {
  await t.test('method', async () => {
    const handler = createMarketStatsHandler({
      enabled: true,
      getSupabase: () => ({}), validateMetricSpec: validateSpec, validateMetricResult: validateResult,
    });
    const res = responseRecorder();
    await handler({ method: 'GET', body: null }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.body.error.code, 'METHOD_NOT_ALLOWED');
    assert.equal(res.headers.Allow, 'POST');
  });

  await t.test('invalid metric', async () => {
    const handler = createMarketStatsHandler({
      enabled: true,
      getSupabase: () => ({}), validateMetricSpec: validateSpec, validateMetricResult: validateResult,
    });
    const res = responseRecorder();
    await handler({ method: 'POST', body: { contractVersion: 1, specs: [{}] } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'INVALID_METRIC_SPEC');
    assert.deepEqual(res.body.error.details.errors, [{ path: 'metricKey', message: 'required' }]);
  });

  await t.test('not configured', async () => {
    const handler = createMarketStatsHandler({
      enabled: true,
      getSupabase: () => null, validateMetricSpec: validateSpec, validateMetricResult: validateResult,
    });
    const res = responseRecorder();
    await handler({ method: 'POST', body: { contractVersion: 1, specs: [metric('row.presence')] } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'DATA_SOURCE_NOT_CONFIGURED');
  });

  await t.test('source failure', async () => {
    const handler = createMarketStatsHandler({
      enabled: true,
      getSupabase: () => ({}),
      validateMetricSpec: validateSpec,
      validateMetricResult: validateResult,
      loadDataset: async () => {
        throw new MarketStatsError('SOURCE_TRUNCATED', 'The market corpus query reached its safety limit.');
      },
    });
    const res = responseRecorder();
    await handler({ method: 'POST', body: { contractVersion: 1, specs: [metric('row.presence')] } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'SOURCE_TRUNCATED');
  });
});

test('duplicate metric keys and missing conditional parents are typed request errors', () => {
  assert.throws(
    () => parseMarketStatsRequest({ contractVersion: 1, specs: [metric('same'), metric('same', 'other-row')] }, validateSpec),
    (error) => error.code === 'DUPLICATE_METRIC',
  );
  const child = metric('child');
  child.denominator.conditionalOn = { metricKey: 'missing-parent', state: 'present' };
  assert.throws(
    () => parseMarketStatsRequest({ contractVersion: 1, specs: [child] }, validateSpec),
    (error) => error.code === 'MISSING_DEPENDENCY',
  );
});

test('request parser rejects object-prototype row and metric keys', () => {
  for (const reserved of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(
      () => parseMarketStatsRequest({ contractVersion: 1, specs: [metric('safe', reserved)] }, validateSpec),
      (error) => error.code === 'INVALID_REQUEST',
    );
    assert.throws(
      () => parseMarketStatsRequest({ contractVersion: 1, specs: [metric(reserved, 'safe')] }, validateSpec),
      (error) => error.code === 'INVALID_REQUEST',
    );
  }
});
