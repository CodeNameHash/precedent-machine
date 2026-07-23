const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isSupportedCanonicalQuery,
  mapLegacyRequestToCanonical,
} = require('../lib/canonical-v2/legacy-query-mapper');
const { compileCanonicalActiveQueryRequest } = require('../lib/canonical-v2/query-result');

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

test('2. party specificity: reverseFeePctOfDealValue (or any lookalike) stays legacy', () => {
  assert.equal(
    isSupportedCanonicalQuery('MARKET_RANGE', { ...EXACT_PAYLOAD, field_path: 'reverseFeePctOfDealValue' }, SUPPORTED_OPTS),
    false,
  );
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
  for (const key of ['consideration_type', 'search', 'law_firm', 'lawyer', 'unknown_key']) {
    const payload = { ...EXACT_PAYLOAD, deal_filter: { [key]: key === 'search' ? 'Metsera' : ['some-value'] } };
    assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', payload, SUPPORTED_OPTS), false, `${key} must stay legacy`);
  }
  const multiSelectArray = { ...EXACT_PAYLOAD, deal_filter: { buyer: ['AbbVie', 'QXO'] } };
  assert.equal(isSupportedCanonicalQuery('MARKET_RANGE', multiSelectArray, SUPPORTED_OPTS), false);
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
