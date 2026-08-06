const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isSupportedCanonicalQuery,
  mapLegacyRequestToCanonical,
  refinementOptionsFromView,
} = require('../lib/canonical-v2/legacy-query-mapper');
const { compileCanonicalActiveQueryRequest, queryCanonicalResultPage } = require('../lib/canonical-v2/query-result');
const { compileFixtureContract, compileFixtureContractV4 } = require('../lib/canonical-v2/contract-bundle');
const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { buildQueryCohortSummary } = require('../__fixtures__/canonical-v2/query-cohort-summary');

const EXACT_PAYLOAD = Object.freeze({
  provision_type: 'TERMINATION_FEE',
  field_path: 'feePctOfDealValue',
  deal_filter: {},
  chart_kind: 'HISTOGRAM',
});

const SUPPORTED_OPTS = Object.freeze({ flagEnabled: true, savedQueryId: 'adhoc' });

test('1. exact supported ad hoc request maps to the pinned canonical body', () => {
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', EXACT_PAYLOAD, SUPPORTED_OPTS), true);
  const body = mapLegacyRequestToCanonical(EXACT_PAYLOAD);
  assert.deepEqual(body, {
    intent: 'MARKET_RANGE',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
    filters: {},
    selected_columns: null,
    // Deviation from the spec's literal pinned JSON (documented in the
    // handoff report): `column_filters: null` fails the real, frozen
    // compileCanonicalActiveQueryRequest (normaliseColumnFilters only
    // defaults an OMITTED column_filters, not an explicit null — unlike
    // selected_columns's `== null` handling). `{}` is what the existing
    // query-api-handler/query-result test fixtures already send for this
    // field on this exact contract.
    column_filters: {},
    page_size: 25,
    cursor: null,
  });
  // Exact key set — LOGICAL_REQUEST_KEYS, nothing more, nothing less.
  assert.deepEqual(Object.keys(body).sort(), [
    'column_filters', 'concept_key', 'cursor', 'filters', 'intent',
    'metric_key', 'metric_version', 'page_size', 'party', 'selected_columns',
  ].sort());
  assert.equal(Object.isFrozen(body), true);
  assert.equal(Object.isFrozen(body.filters), true);
  assert.equal(Object.isFrozen(body.party), true);
});

test('1b. chart_kind is accepted and ignored for routing regardless of its value', () => {
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, chart_kind: 'BAR' }, SUPPORTED_OPTS), true);
  const { chart_kind: _dropped, ...noChartKind } = EXACT_PAYLOAD;
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', noChartKind, SUPPORTED_OPTS), true);
});

test('2. reverseFeePctOfDealValue maps to the governed buyer-fee F4 request', () => {
  const payload = { ...EXACT_PAYLOAD, field_path: 'reverseFeePctOfDealValue' };
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', payload, SUPPORTED_OPTS), true);
  const body = mapLegacyRequestToCanonical(payload);
  assert.deepEqual(body, {
    intent: 'MARKET_RANGE',
    metric_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-REVERSE',
    party: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  });
  const compiled = compileCanonicalActiveQueryRequest(body);
  assert.equal(compiled.contract_fingerprint, compileFixtureContractV4().fingerprint);
});

test('2b. ungoverned reverse-fee lookalikes stay legacy', () => {
  for (const field_path of ['reverseTerminationFee', 'reverseFeePercentage', 'buyerTerminationFee']) {
    assert.equal(
      isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, field_path }, SUPPORTED_OPTS),
      false,
    );
  }
});

test('3. other fields, other provision types, and other kinds stay legacy', () => {
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, field_path: 'companyTerminationFee' }, SUPPORTED_OPTS),
    false,
  );
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, provision_type: 'CONSIDERATION' }, SUPPORTED_OPTS),
    false,
  );
  assert.equal(isSupportedCanonicalQuery('PROVISION_CROSS_CUT', EXACT_PAYLOAD, SUPPORTED_OPTS), false);
  assert.equal(isSupportedCanonicalQuery('FILTER_THEN_LIST', EXACT_PAYLOAD, SUPPORTED_OPTS), false);
  assert.equal(isSupportedCanonicalQuery('DEAL_COMPARE', EXACT_PAYLOAD, SUPPORTED_OPTS), false);
});

test('4. cleanly-mappable deal_filter keys map; signing_year sets year_from == year_to as integers', () => {
  // buildDealFilterPayload's real shape: buyer/sector/merger_form carry
  // single-element string arrays, signing_year an array with the number
  // already coerced — a bare scalar (no array) must also be accepted.
  const arrayShaped = {
    ...EXACT_PAYLOAD,
    deal_filter: {
      buyer: ['AbbVie'], sector: ['Biopharma'], merger_form: ['MERGER'], signing_year: [2024],
    },
  };
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', arrayShaped, SUPPORTED_OPTS), true);
  const arrayBody = mapLegacyRequestToCanonical(arrayShaped);
  assert.deepEqual(arrayBody.filters, {
    buyer: 'AbbVie', sector: 'Biopharma', merger_form: 'MERGER', year_from: 2024, year_to: 2024,
  });
  assert.equal(Number.isInteger(arrayBody.filters.year_from), true);
  assert.equal(Number.isInteger(arrayBody.filters.year_to), true);

  const scalarShaped = { ...EXACT_PAYLOAD, deal_filter: { buyer: 'AbbVie', signing_year: '2024' } };
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', scalarShaped, SUPPORTED_OPTS), true);
  const scalarBody = mapLegacyRequestToCanonical(scalarShaped);
  assert.deepEqual(scalarBody.filters, { buyer: 'AbbVie', year_from: 2024, year_to: 2024 });
});

test('5. unsupported filter keys or multi-select values fall back to legacy', () => {
  for (const key of ['consideration_type', 'search', 'unknown_key']) {
    const payload = { ...EXACT_PAYLOAD, deal_filter: { [key]: key === 'search' ? 'Metsera' : ['some-value'] } };
    assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', payload, SUPPORTED_OPTS), false, `${key} must stay legacy`);
  }
  const multiSelectArray = { ...EXACT_PAYLOAD, deal_filter: { buyer: ['AbbVie', 'QXO'] } };
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', multiSelectArray, SUPPORTED_OPTS), false);
});

test('5c. D2 (Ben sign-off 2026-07-23): law_firm maps to adviser_either, lawyer maps to lawyer_either', () => {
  const payload = {
    ...EXACT_PAYLOAD,
    deal_filter: { law_firm: ['Paul Weiss'], lawyer: ['Scott Barshay'] },
  };
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', payload, SUPPORTED_OPTS), true);
  const body = mapLegacyRequestToCanonical(payload);
  assert.deepEqual(body.filters, { adviser_either: 'Paul Weiss', lawyer_either: 'Scott Barshay' });
  // The mapped body still passes the real, frozen ACTIVE compiler.
  const compiled = compileCanonicalActiveQueryRequest(body);
  assert.equal(compiled.filters.adviser_either, 'Paul Weiss');
  assert.equal(compiled.filters.lawyer_either, 'Scott Barshay');
  // Multi-select still stays legacy — one governed value per filter.
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, deal_filter: { law_firm: ['Paul Weiss', 'Jones Day'] } }, SUPPORTED_OPTS),
    false,
  );
});

test('5b. a non-integer signing_year (hand-crafted payload) stays legacy instead of mapping to NaN filters', () => {
  for (const badYear of ['abc', '2024.5', '', ['20x4']]) {
    const payload = { ...EXACT_PAYLOAD, deal_filter: { signing_year: badYear } };
    const supported = isSupportedCanonicalQuery('MARKET_RANGE', payload, SUPPORTED_OPTS);
    // '' is empty -> ignored -> still supported; every non-integer non-empty
    // value must fall back to legacy.
    if (badYear === '') assert.equal(supported, true);
    else assert.equal(supported, false, `signing_year ${JSON.stringify(badYear)} must stay legacy`);
  }
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, deal_filter: { signing_year: '2024' } }, SUPPORTED_OPTS),
    true,
  );
});

test('6. flag off keeps even the exact request unsupported', () => {
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', EXACT_PAYLOAD, { flagEnabled: false, savedQueryId: 'adhoc' }), false);
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', EXACT_PAYLOAD, { savedQueryId: 'adhoc' }), false);
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', EXACT_PAYLOAD, {}), false);
});

test('7. a saved query id present routes to legacy regardless of payload shape', () => {
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', EXACT_PAYLOAD, { flagEnabled: true, savedQueryId: '11111111-1111-1111-1111-111111111111' }),
    false,
  );
});

test('8. mapper output passes the real, frozen canonical ACTIVE query compiler', () => {
  const body = mapLegacyRequestToCanonical(EXACT_PAYLOAD);
  const compiled = compileCanonicalActiveQueryRequest(body);
  assert.equal(compiled.schema_version, 'CANONICAL_ACTIVE_QUERY_SEMANTICS/V1');
  assert.equal(compiled.contract_fingerprint, compileFixtureContract().fingerprint);
  assert.equal(compiled.metric_key, 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE');
  assert.equal(compiled.metric_version, 1);
  assert.equal(compiled.concept_key, 'TERMF-TARGET');
  assert.deepEqual(compiled.party, { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
  assert.equal(compiled.page_size, 25);

  const filtered = mapLegacyRequestToCanonical({
    ...EXACT_PAYLOAD,
    deal_filter: { buyer: ['AbbVie'], signing_year: [2024] },
  });
  const compiledFiltered = compileCanonicalActiveQueryRequest(filtered);
  assert.equal(compiledFiltered.filters.buyer, 'AbbVie');
  assert.equal(compiledFiltered.filters.year_from, 2024);
  assert.equal(compiledFiltered.filters.year_to, 2024);
});

test('9. mapper never emits release-pinned keys', () => {
  const body = mapLegacyRequestToCanonical(EXACT_PAYLOAD);
  for (const forbidden of ['serving_namespace_id', 'corpus_release_id', 'contract_fingerprint', 'release_selector']) {
    assert.equal(Object.hasOwn(body, forbidden), false, `must not emit ${forbidden}`);
  }
});

// ── D3 widening (2026-07-23): second supported request — no-shop initial
// match period. docs/archive/handoffs/SPEC-QUERY-METRICS-WIDENING-2026-07-23.md,
// test groups 3 and 5. ──────────────────────────────────────────────────────

const NO_SHOP_MATCH_PAYLOAD = Object.freeze({
  provision_type: 'COVENANT_NO_SOLICITATION',
  field_path: 'initialMatchPeriodDays',
  deal_filter: {},
});

// Party sourced verbatim from the frozen reviewed no-shop slice's
// canonical_result.party for the NOSOL-MATCH concept — see
// lib/canonical-v2/reviewed-no-shop-slice.js:24 (BUYER_PARTY definition) and
// its NOSOL-MATCH result spec at lines 503-512 (also confirmed against the
// frozen QXO no-shop slice: lib/canonical-v2/reviewed-qxo-no-shop-slice.js:20
// and lines 211-220 — both frozen reviewed slices agree on this tuple).
const NO_SHOP_MATCH_PARTY = Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' });

test('10. both governed field_path spellings for the no-shop match metric route to canonical', () => {
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', NO_SHOP_MATCH_PAYLOAD, SUPPORTED_OPTS), true);
  assert.equal(
    isSupportedCanonicalQuery(
      'MARKET_RANGE',
      { ...NO_SHOP_MATCH_PAYLOAD, field_path: 'matching_rights_days' },
      SUPPORTED_OPTS,
    ),
    true,
  );
  // Any other field_path on this provision_type (or this field_path on any
  // other provision_type) must stay legacy.
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...NO_SHOP_MATCH_PAYLOAD, field_path: 'noticePeriodDays' }, SUPPORTED_OPTS),
    false,
  );
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...NO_SHOP_MATCH_PAYLOAD, provision_type: 'TERMINATION_FEE' }, SUPPORTED_OPTS),
    false,
  );
});

test('11. the no-shop match mapper body carries the frozen metric/concept/party tuple, both spellings alike', () => {
  const expected = {
    intent: 'MARKET_RANGE',
    metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    metric_version: 1,
    concept_key: 'NOSOL-MATCH',
    party: { ...NO_SHOP_MATCH_PARTY },
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  };
  assert.deepEqual(mapLegacyRequestToCanonical(NO_SHOP_MATCH_PAYLOAD), expected);
  assert.deepEqual(
    mapLegacyRequestToCanonical({ ...NO_SHOP_MATCH_PAYLOAD, field_path: 'matching_rights_days' }),
    expected,
  );
  const body = mapLegacyRequestToCanonical(NO_SHOP_MATCH_PAYLOAD);
  assert.equal(Object.isFrozen(body), true);
  assert.equal(Object.isFrozen(body.party), true);
});

test('12. deal_filter mapping for the no-shop match request works exactly like the fee request\'s', () => {
  const filtered = mapLegacyRequestToCanonical({
    ...NO_SHOP_MATCH_PAYLOAD,
    deal_filter: { buyer: ['AbbVie'], signing_year: [2024] },
  });
  assert.deepEqual(filtered.filters, { buyer: 'AbbVie', year_from: 2024, year_to: 2024 });
  assert.equal(filtered.metric_key, 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');
});

test('13. the no-shop match mapper body passes the real, frozen canonical ACTIVE query compiler', () => {
  const body = mapLegacyRequestToCanonical(NO_SHOP_MATCH_PAYLOAD);
  const compiled = compileCanonicalActiveQueryRequest(body);
  assert.equal(compiled.schema_version, 'CANONICAL_ACTIVE_QUERY_SEMANTICS/V1');
  assert.equal(compiled.metric_key, 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');
  assert.equal(compiled.metric_version, 1);
  assert.equal(compiled.concept_key, 'NOSOL-MATCH');
  assert.deepEqual(compiled.party, NO_SHOP_MATCH_PARTY);
  assert.equal(compiled.basis_key, 'DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE');
  assert.equal(compiled.page_size, 25);
});

test('14. seller-fee routing stays byte-identical alongside the new no-shop match route', () => {
  // Same exact assertion as test 1, run again after the widening, plus the
  // two routes proven mutually exclusive on the same base payload shape.
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', EXACT_PAYLOAD, SUPPORTED_OPTS), true);
  assert.deepEqual(mapLegacyRequestToCanonical(EXACT_PAYLOAD), {
    intent: 'MARKET_RANGE',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
  });
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', NO_SHOP_MATCH_PAYLOAD, SUPPORTED_OPTS), true);
  assert.notDeepEqual(
    mapLegacyRequestToCanonical(EXACT_PAYLOAD),
    mapLegacyRequestToCanonical(NO_SHOP_MATCH_PAYLOAD),
  );
});

// ── 15. refinementOptionsFromView offers no fee-specific dropdowns ─────────
// (spec test group 5). refinementOptionsFromView derives its options solely
// from view.refinements (frozen per-request metadata from
// buildCanonicalQueryResultView) — the no-shop match metric's governed
// columns (duration/day_basis/trigger) carry no `refinement` at all
// (lib/canonical-v2/query-result.js COLUMN_DEFINITIONS), so this is proven
// against a REAL compiled view, not a hand-shaped stub.
test('15. refinementOptionsFromView offers no fee-specific (or any) dropdowns for the no-shop match metric', async () => {
  const row = buildLandosNoShopServingFixture().rows.find(
    (candidate) => candidate.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  const body = row.canonical_result;
  const market = body.market_context;
  const request = {
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
  };
  const client = {
    rpc(name, params) {
      return Promise.resolve({
        data: {
          schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
          cache_state: 'MISS',
          serving_namespace_id: params.p_serving_namespace_id,
          corpus_release_id: params.p_corpus_release_id,
          contract_fingerprint: params.p_contract_fingerprint,
          query_semantics_digest: params.p_query_semantics_digest,
          total_count: 1,
          page_count: 1,
          cohort_summary: buildQueryCohortSummary({ params, rows: [row] }),
          rows: [row],
          next_cursor: null,
        },
        error: null,
      });
    },
  };
  const { result: view } = await queryCanonicalResultPage({ client, request });
  assert.deepEqual(refinementOptionsFromView(view), []);
  // No column in this metric's default set has a fee-shaped refinement
  // (fee_side/payer_capacity/payee_capacity/trigger_code/payment_timing/
  // trigger_condition), so none of REFINEMENT_COLUMN_FILTER_KEYS is offered.
  assert.equal(view.refinements.some((item) => item.request_field.startsWith('column_filters.')), false);
});
