const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { compileCanonicalActiveQueryRequest, queryCanonicalResultPage } = require('../lib/canonical-v2/query-result');
const {
  mapLegacyRequestToCanonical,
  buildRefinedCanonicalRequest,
  refinementOptionsFromView,
  appendCanonicalPage,
  resolveCanonicalQueryPageUpdate,
  runCanonicalRefinementRequest,
} = require('../lib/canonical-v2/legacy-query-mapper');

const EXACT_PAYLOAD = Object.freeze({
  provision_type: 'TERMINATION_FEE',
  field_path: 'feePctOfDealValue',
  deal_filter: {},
  chart_kind: 'HISTOGRAM',
});
const REVERSE_PAYLOAD = Object.freeze({ ...EXACT_PAYLOAD, field_path: 'reverseFeePctOfDealValue' });

function baseBody() {
  return mapLegacyRequestToCanonical(EXACT_PAYLOAD);
}

// Same fixture-driven pattern as tests/canonical-v2-query-result.test.js
// (see its lines 1-100): a real CANONICAL_QUERY_RESULT_VIEW/V1 built through
// the actual buildCanonicalQueryResultView pipeline, not a hand-shaped stub.
function requestFor(row, overrides = {}) {
  const body = row.canonical_result;
  const market = body.market_context;
  return {
    serving_namespace_id: 'a'.repeat(64),
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: row.provenance.contract_fingerprint,
    intent: 'MARKET_RANGE',
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: body.concept_key,
    party: body.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
    ...overrides,
  };
}

function resultFor(params, rows, overrides = {}) {
  return {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V1',
    serving_namespace_id: params.p_serving_namespace_id,
    corpus_release_id: params.p_corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    query_semantics_digest: params.p_query_semantics_digest,
    total_count: rows.length,
    page_count: rows.length,
    rows,
    next_cursor: null,
    ...overrides,
  };
}

async function buildLandosView(overrides = {}) {
  const row = buildLandosTerminationFeeServingFixture().row;
  const request = requestFor(row, overrides);
  const client = {
    rpc(name, params) {
      return Promise.resolve({ data: resultFor(params, [row]), error: null });
    },
  };
  const { result } = await queryCanonicalResultPage({ client, request });
  return result;
}

// ── 1. buildRefinedCanonicalRequest: valid text filters ─────────────────────

test('1. valid text filters produce the exact body; frozen; cursor reset; base body unmutated', () => {
  const base = baseBody();
  const baseSnapshot = JSON.parse(JSON.stringify(base));
  const refined = buildRefinedCanonicalRequest(base, { fee_side: 'SELLER', payer_capacity: 'TARGET' });

  assert.deepEqual(refined, {
    intent: 'MARKET_RANGE',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
    filters: {},
    selected_columns: null,
    column_filters: { fee_side: 'SELLER', payer_capacity: 'TARGET' },
    page_size: 25,
    cursor: null,
  });
  assert.equal(Object.isFrozen(refined), true);
  assert.equal(Object.isFrozen(refined.column_filters), true);
  assert.deepEqual(JSON.parse(JSON.stringify(base)), baseSnapshot);

  // {} when no filters are given.
  const cleared = buildRefinedCanonicalRequest(base, {});
  assert.deepEqual(cleared.column_filters, {});
  assert.equal(cleared.cursor, null);

  // Deal-level filters on a non-empty base body survive a refinement
  // untouched — a refinement never invents or drops the original ad hoc
  // deal_filter mapping.
  const filteredBase = mapLegacyRequestToCanonical({
    ...EXACT_PAYLOAD,
    deal_filter: { buyer: ['AbbVie'], signing_year: [2024] },
  });
  const filteredRefined = buildRefinedCanonicalRequest(filteredBase, { fee_side: 'SELLER' });
  assert.deepEqual(filteredRefined.filters, { buyer: 'AbbVie', year_from: 2024, year_to: 2024 });
});

// ── 2. Percent bounds ────────────────────────────────────────────────────────

test('2. valid decimal strings pass; min > max throws; non-canonical strings throw; base body untouched on throw', () => {
  const base = baseBody();
  const refined = buildRefinedCanonicalRequest(base, {
    min_percent_of_deal_value: '5', max_percent_of_deal_value: '6.5',
  });
  assert.deepEqual(refined.column_filters, {
    min_percent_of_deal_value: '5', max_percent_of_deal_value: '6.5',
  });

  assert.throws(() => buildRefinedCanonicalRequest(base, {
    min_percent_of_deal_value: '10', max_percent_of_deal_value: '5',
  }), /minimum|exceed|max/i);

  for (const bad of ['5.', 'abc', '-1', '05']) {
    assert.throws(
      () => buildRefinedCanonicalRequest(base, { min_percent_of_deal_value: bad }),
      `min_percent_of_deal_value ${JSON.stringify(bad)} must throw`,
    );
    // On every throw, the caller must not have anything to send — proven
    // here by the base body staying exactly as it was (nothing mutated,
    // nothing partially applied).
    assert.equal(Object.isFrozen(base), true);
  }
});

// ── 3. Unknown / non-fee keys ────────────────────────────────────────────────

test('3. unknown keys and non-fee-metric keys throw', () => {
  const base = baseBody();
  assert.throws(() => buildRefinedCanonicalRequest(base, { not_a_real_key: 'x' }), /Unsupported/);
  // Material Contracts / IOC Capex column filter keys are real governed keys
  // elsewhere in the frozen contract, but not for THIS metric's refinement
  // set — they must still throw here, never silently pass through.
  for (const key of ['criterion_code', 'contract_scope_code', 'cash_flow_direction_code', 'measurement_period_code', 'comparison_operator']) {
    assert.throws(() => buildRefinedCanonicalRequest(base, { [key]: 'X' }), `${key} must throw`);
  }
});

// ── 4. Refined body passes the real compiler ────────────────────────────────

test('4. a refined body passes the real, frozen compileCanonicalActiveQueryRequest with no vocabulary drift', () => {
  const base = baseBody();
  const refined = buildRefinedCanonicalRequest(base, {
    fee_side: 'SELLER',
    payer_capacity: 'TARGET',
    payee_capacity: 'BUYER',
    trigger_code: 'ACQUISITION_PROPOSAL_TAIL',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
    trigger_condition: 'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    min_percent_of_deal_value: '1',
    max_percent_of_deal_value: '10',
  });
  const compiled = compileCanonicalActiveQueryRequest(refined);
  assert.equal(compiled.schema_version, 'CANONICAL_ACTIVE_QUERY_SEMANTICS/V1');
  assert.deepEqual(compiled.column_filters, {
    min_percent_of_deal_value: '1',
    max_percent_of_deal_value: '10',
    fee_side: 'SELLER',
    payer_capacity: 'TARGET',
    payee_capacity: 'BUYER',
    trigger_code: 'ACQUISITION_PROPOSAL_TAIL',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
    trigger_condition: 'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    criterion_code: null,
    contract_scope_code: null,
    cash_flow_direction_code: null,
    measurement_period_code: null,
    comparison_operator: null,
  });

  // The base (unrefined) request itself is byte-identical to Slice 1's own
  // mapper output — this diff never touches that contract.
  assert.deepEqual(base, mapLegacyRequestToCanonical(EXACT_PAYLOAD));
});

test('4b. buyer-fee refinements compile with the governed reverse-fee party tuple', () => {
  const refined = buildRefinedCanonicalRequest(mapLegacyRequestToCanonical(REVERSE_PAYLOAD), {
    fee_side: 'BUYER',
    payer_capacity: 'BUYER',
    payee_capacity: 'TARGET',
    min_percent_of_deal_value: '3',
    max_percent_of_deal_value: '4',
  });
  const compiled = compileCanonicalActiveQueryRequest(refined);
  assert.equal(compiled.metric_key, 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE');
  assert.equal(compiled.concept_key, 'TERMF-REVERSE');
  assert.deepEqual(compiled.party, { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' });
  assert.equal(compiled.column_filters.fee_side, 'BUYER');
  assert.equal(compiled.column_filters.payer_capacity, 'BUYER');
  assert.equal(compiled.column_filters.payee_capacity, 'TARGET');
});

// ── 5. refinementOptionsFromView ─────────────────────────────────────────────

test('5. options come only from the real view\'s rows/metadata; absent codes stay absent; values dedup + sort', async () => {
  const view = await buildLandosView();
  const options = refinementOptionsFromView(view);
  const byKey = Object.fromEntries(options.map((option) => [option.column_key, option]));

  assert.deepEqual(Object.keys(byKey).sort(), [
    'fee_side', 'payee_capacity', 'payer_capacity', 'payment_timing', 'trigger_code', 'trigger_condition',
  ].sort());

  assert.deepEqual(byKey.fee_side.values, ['SELLER']);
  assert.deepEqual(byKey.payer_capacity.values, ['TARGET']);
  assert.deepEqual(byKey.payee_capacity.values, ['BUYER']);
  assert.deepEqual(byKey.trigger_code.values, [
    'ACQUISITION_PROPOSAL_TAIL', 'CHANGE_IN_RECOMMENDATION_TERMINATION', 'SUPERIOR_PROPOSAL_TERMINATION',
  ]);
  assert.deepEqual(byKey.payment_timing.values, [
    'CONCURRENT_WITH_TERMINATION',
    'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
    'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
  ]);
  assert.deepEqual(byKey.trigger_condition.values, [
    'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
    'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    'PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN',
  ]);

  // A code that is not on this row (the reverse/buyer fee side) must never
  // appear just because it's part of the wider governed vocabulary.
  assert.ok(!byKey.fee_side.values.includes('BUYER'));

  // No hardcoded control list: dropping the 'payee' column from the
  // request drops payee_capacity as a control entirely, and dropping
  // 'triggers' drops all three trigger-derived controls — the function
  // reflects whatever the view actually declares, nothing more.
  const noPayeeView = await buildLandosView({
    selected_columns: ['deal', 'buyer', 'percent_of_deal_value', 'raw_value', 'fee_side', 'payer', 'triggers', 'source'],
  });
  const noPayeeOptions = refinementOptionsFromView(noPayeeView);
  assert.ok(!noPayeeOptions.some((option) => option.column_key === 'payee_capacity'));

  const noTriggersView = await buildLandosView({
    selected_columns: ['deal', 'buyer', 'percent_of_deal_value', 'raw_value', 'fee_side', 'payer', 'payee', 'source'],
  });
  const noTriggersOptions = refinementOptionsFromView(noTriggersView);
  assert.deepEqual(
    noTriggersOptions.map((option) => option.column_key).sort(),
    ['fee_side', 'payee_capacity', 'payer_capacity'],
  );
});

// ── 6. appendCanonicalPage ───────────────────────────────────────────────────

function fakeView(overrides) {
  return Object.freeze({
    schema_version: 'CANONICAL_QUERY_RESULT_VIEW/V1',
    release_selector: 'ACTIVE',
    pointer_id: 'pointer-1',
    serving_namespace_id: 'namespace-1',
    corpus_release_id: 'release-1',
    contract_fingerprint: 'fingerprint-1',
    intent: 'MARKET_RANGE',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
    query_semantics_digest: 'semantics-1',
    columns: [{ column_key: 'deal' }],
    refinements: [],
    total_count: 10,
    page_count: 2,
    next_cursor: null,
    rows: [],
    ...overrides,
  });
}

test('6. rows append, duplicate row_serving_key dropped, next_cursor/total_count/page_count from the second view', () => {
  const existing = fakeView({
    page_count: 2,
    next_cursor: { governed_deal_key: 'deal:a', row_serving_key: 'row-2' },
    rows: [{ row_serving_key: 'row-1' }, { row_serving_key: 'row-2' }],
  });
  const next = fakeView({
    page_count: 2,
    total_count: 10,
    next_cursor: { governed_deal_key: 'deal:a', row_serving_key: 'row-4' },
    // row-2 is a duplicate carried over by a naive re-fetch; must be dropped.
    rows: [{ row_serving_key: 'row-2' }, { row_serving_key: 'row-3' }, { row_serving_key: 'row-4' }],
  });
  const appended = appendCanonicalPage(
    existing,
    next,
    { governed_deal_key: 'deal:a', row_serving_key: 'row-2' },
  );
  assert.deepEqual(appended.rows.map((row) => row.row_serving_key), ['row-1', 'row-2', 'row-3', 'row-4']);
  assert.deepEqual(appended.next_cursor, { governed_deal_key: 'deal:a', row_serving_key: 'row-4' });
  assert.equal(appended.total_count, 10);
  assert.equal(appended.page_count, 2);
  assert.equal(Object.isFrozen(appended), true);
  assert.equal(Object.isFrozen(appended.rows), true);
});

test('6b. every governed identity field and cursor continuity are required', () => {
  const cursor = { governed_deal_key: 'deal:a', row_serving_key: 'row-1' };
  const existing = fakeView({
    next_cursor: cursor,
    rows: [{ row_serving_key: 'row-1' }],
  });
  const next = fakeView({ rows: [{ row_serving_key: 'row-2' }] });
  for (const [key, value] of [
    ['pointer_id', 'pointer-2'],
    ['serving_namespace_id', 'namespace-2'],
    ['corpus_release_id', 'release-2'],
    ['contract_fingerprint', 'fingerprint-2'],
    ['query_semantics_digest', 'semantics-2'],
    ['metric_version', 2],
    ['concept_key', 'TERMF-REVERSE'],
  ]) {
    assert.throws(() => appendCanonicalPage(existing, fakeView({
      [key]: value,
      rows: [{ row_serving_key: 'row-2' }],
    }), cursor));
  }
  assert.throws(() => appendCanonicalPage(existing, fakeView({
    party: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
    rows: [{ row_serving_key: 'row-2' }],
  }), cursor));
  assert.throws(() => appendCanonicalPage(existing, next, {
    governed_deal_key: 'deal:z',
    row_serving_key: 'row-z',
  }), /discontinuous cursor/);
});

test('6c. resolveCanonicalQueryPageUpdate: show-more appends, a fresh refinement/Clear replaces', () => {
  const existing = fakeView({
    total_count: 2,
    next_cursor: { governed_deal_key: 'deal:a', row_serving_key: 'row-1' },
    rows: [{ row_serving_key: 'row-1' }],
  });
  const next = fakeView({ total_count: 2, rows: [{ row_serving_key: 'row-2' }] });
  assert.deepEqual(
    resolveCanonicalQueryPageUpdate(
      true,
      existing,
      next,
      { governed_deal_key: 'deal:a', row_serving_key: 'row-1' },
    ).rows.map((row) => row.row_serving_key),
    ['row-1', 'row-2'],
  );
  assert.equal(resolveCanonicalQueryPageUpdate(false, existing, next), next);
});

test('6d. a terminal short page cannot silently truncate the governed result', () => {
  const cursor = { governed_deal_key: 'deal:a', row_serving_key: 'row-25' };
  const existing = fakeView({
    total_count: 26,
    next_cursor: cursor,
    rows: Array.from({ length: 25 }, (_, index) => ({
      row_serving_key: `row-${String(index + 1).padStart(2, '0')}`,
    })),
  });
  const truncated = fakeView({ total_count: 26, next_cursor: null, rows: [] });
  assert.throws(
    () => appendCanonicalPage(existing, truncated, cursor),
    /truncates the governed result/,
  );
});

// ── 7. Single-request discipline at the helper level ────────────────────────

test('7. apply -> exactly one call; a second apply while pending is a no-op; error preserves the prior view object', async () => {
  const calls = [];
  let resolveFirst;
  const fetchCanonical = () => new Promise((resolve) => { resolveFirst = resolve; calls.push(1); });

  // A tiny state harness mirroring the page's own onRequest guard: pending
  // gates every call, exactly as pages/query/[kind]/[id].js does.
  let pending = false;
  let currentView = fakeView({ rows: [{ row_serving_key: 'row-1' }] });
  let currentError = null;
  const onRequest = async (body, isShowMore) => {
    if (pending) return; // explicit no-op — no queueing, no second fetch
    pending = true;
    const outcome = await runCanonicalRefinementRequest({
      fetchCanonical, body, isShowMore, existingView: currentView,
    });
    pending = false;
    if (outcome.ok) { currentView = outcome.view; currentError = null; } else { currentError = outcome.error; }
  };

  const firstCall = onRequest({ cursor: null }, false);
  const secondCall = onRequest({ cursor: null }, false); // fired while the first is still in flight
  assert.equal(pending, true);
  assert.equal(calls.length, 1); // the second apply never reached fetchCanonical

  resolveFirst({ status: 503, json: { error: { code: 'AT_CAPACITY' } } });
  await firstCall;
  await secondCall;

  assert.equal(calls.length, 1);
  assert.equal(currentError.code, 'AT_CAPACITY');
  // The prior view object is untouched (same reference) — an error never
  // clears or replaces the existing rows/controls.
  assert.equal(currentView.rows[0].row_serving_key, 'row-1');
  assert.equal(pending, false);

  // A subsequent apply (now that pending has cleared) is not a no-op, and a
  // success clears the prior error and adopts the new view.
  const secondFetchCalls = [];
  const secondOnRequest = async (body, isShowMore) => {
    if (pending) return;
    pending = true;
    const outcome = await runCanonicalRefinementRequest({
      fetchCanonical: async (b) => { secondFetchCalls.push(b); return { status: 200, json: fakeView({ rows: [{ row_serving_key: 'row-9' }] }) }; },
      body,
      isShowMore,
      existingView: currentView,
    });
    pending = false;
    if (outcome.ok) { currentView = outcome.view; currentError = null; } else { currentError = outcome.error; }
  };
  await secondOnRequest({ cursor: null }, false);
  assert.equal(secondFetchCalls.length, 1);
  assert.equal(currentError, null);
  assert.equal(currentView.rows[0].row_serving_key, 'row-9');
});
