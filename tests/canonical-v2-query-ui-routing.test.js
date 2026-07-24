const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  runQueryRoute,
  mapLegacyRequestToCanonical,
  formatPercentOfDealValue,
  mapCanonicalRowForRender,
} = require('../lib/canonical-v2/legacy-query-mapper');

const SUPPORTED_PAYLOAD = Object.freeze({
  provision_type: 'TERMINATION_FEE',
  field_path: 'feePctOfDealValue',
  deal_filter: {},
  chart_kind: 'HISTOGRAM',
});

test('1. supported request + flag on chooses the canonical endpoint exactly once; legacy fetch never called', async () => {
  const canonicalCalls = [];
  const legacyCalls = [];
  const view = Object.freeze({ schema_version: 'CANONICAL_QUERY_RESULT_VIEW/V1', rows: [] });
  const outcome = await runQueryRoute({
    kind: 'MARKET_RANGE',
    payload: SUPPORTED_PAYLOAD,
    savedQueryId: 'adhoc',
    flagEnabled: true,
    fetchCanonical: async (body) => { canonicalCalls.push(body); return { status: 200, json: view }; },
    fetchLegacy: async () => { legacyCalls.push(true); },
  });
  assert.equal(outcome.mode, 'canonical');
  assert.equal(outcome.ok, true);
  assert.equal(outcome.view, view);
  assert.equal(canonicalCalls.length, 1);
  assert.deepEqual(canonicalCalls[0], mapLegacyRequestToCanonical(SUPPORTED_PAYLOAD));
  assert.equal(legacyCalls.length, 0);
});

test('2. flag off routes to legacy; canonical endpoint is never called', async () => {
  const canonicalCalls = [];
  const legacyCalls = [];
  const outcome = await runQueryRoute({
    kind: 'MARKET_RANGE',
    payload: SUPPORTED_PAYLOAD,
    savedQueryId: 'adhoc',
    flagEnabled: false,
    fetchCanonical: async (body) => { canonicalCalls.push(body); return { status: 200, json: {} }; },
    fetchLegacy: async () => { legacyCalls.push(true); return 'legacy-result'; },
  });
  assert.equal(outcome.mode, 'legacy');
  assert.equal(canonicalCalls.length, 0);
  assert.equal(legacyCalls.length, 1);
});

test('3. unsupported request shape + flag on still routes to legacy, canonical never called', async () => {
  const canonicalCalls = [];
  const legacyCalls = [];
  const unsupported = { ...SUPPORTED_PAYLOAD, field_path: 'companyTerminationFee' };
  const outcome = await runQueryRoute({
    kind: 'MARKET_RANGE',
    payload: unsupported,
    savedQueryId: 'adhoc',
    flagEnabled: true,
    fetchCanonical: async (body) => { canonicalCalls.push(body); return { status: 200, json: {} }; },
    fetchLegacy: async () => { legacyCalls.push(true); },
  });
  assert.equal(outcome.mode, 'legacy');
  assert.equal(canonicalCalls.length, 0);
  assert.equal(legacyCalls.length, 1);
});

test('3b. reverse-fee request + flag on chooses canonical exactly once', async () => {
  const reversePayload = { ...SUPPORTED_PAYLOAD, field_path: 'reverseFeePctOfDealValue' };
  const canonicalCalls = [];
  const legacyCalls = [];
  const outcome = await runQueryRoute({
    kind: 'MARKET_RANGE',
    payload: reversePayload,
    savedQueryId: 'adhoc',
    flagEnabled: true,
    fetchCanonical: async (body) => {
      canonicalCalls.push(body);
      return { status: 200, json: { schema_version: 'CANONICAL_QUERY_RESULT_VIEW/V1', rows: [] } };
    },
    fetchLegacy: async () => { legacyCalls.push(true); },
  });
  assert.equal(outcome.mode, 'canonical');
  assert.equal(outcome.ok, true);
  assert.equal(canonicalCalls.length, 1);
  assert.deepEqual(canonicalCalls[0], mapLegacyRequestToCanonical(reversePayload));
  assert.equal(legacyCalls.length, 0);
});

test('3c. the canonical renderer labels the buyer fee as a reverse termination fee percentage', () => {
  const source = fs.readFileSync('components/query/CanonicalMarketRange.jsx', 'utf8');
  assert.match(
    source,
    /BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: 'Buyer \/ reverse termination fee — % of deal value'/,
  );
});

test('4. canonical 503 FEATURE_DISABLED surfaces a governed error, no retry, no legacy fallback', async () => {
  const canonicalCalls = [];
  const legacyCalls = [];
  const outcome = await runQueryRoute({
    kind: 'MARKET_RANGE',
    payload: SUPPORTED_PAYLOAD,
    savedQueryId: 'adhoc',
    flagEnabled: true,
    fetchCanonical: async (body) => {
      canonicalCalls.push(body);
      return { status: 503, json: { error: { code: 'FEATURE_DISABLED', message: 'Canonical Query is disabled.' } } };
    },
    fetchLegacy: async () => { legacyCalls.push(true); },
  });
  assert.equal(outcome.mode, 'canonical');
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.code, 'FEATURE_DISABLED');
  // Neutral, fixed message — never the raw response body/message echoed back.
  assert.notEqual(outcome.error.message, 'Canonical Query is disabled.');
  assert.equal(typeof outcome.error.message, 'string');
  assert.ok(outcome.error.message.length > 0);
  assert.equal(canonicalCalls.length, 1);
  assert.equal(legacyCalls.length, 0);
});

test('4b. other governed error codes (AT_CAPACITY, CIRCUIT_OPEN, INVALID_REQUEST) pass through unchanged, still no retry', async () => {
  for (const code of ['AT_CAPACITY', 'CIRCUIT_OPEN', 'INVALID_REQUEST']) {
    const canonicalCalls = [];
    // eslint-disable-next-line no-await-in-loop
    const outcome = await runQueryRoute({
      kind: 'MARKET_RANGE',
      payload: SUPPORTED_PAYLOAD,
      savedQueryId: 'adhoc',
      flagEnabled: true,
      fetchCanonical: async (body) => { canonicalCalls.push(body); return { status: 503, json: { error: { code } } }; },
      fetchLegacy: async () => { throw new Error('legacy must not be called'); },
    });
    assert.equal(outcome.error.code, code);
    assert.equal(canonicalCalls.length, 1);
  }
});

test('4c. a rejecting fetchCanonical (network-level failure) yields the safe error outcome, never an unhandled rejection, never legacy fallback', async () => {
  const outcome = await runQueryRoute({
    kind: 'MARKET_RANGE',
    payload: SUPPORTED_PAYLOAD,
    savedQueryId: 'adhoc',
    flagEnabled: true,
    fetchCanonical: async () => { throw new TypeError('Failed to fetch'); },
    fetchLegacy: async () => { throw new Error('legacy must not be called'); },
  });
  assert.equal(outcome.mode, 'canonical');
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.code, 'DATA_SOURCE_ERROR');
  // Fixed neutral message — the thrown error's message is never echoed.
  assert.notEqual(outcome.error.message, 'Failed to fetch');
});

test('5. percentage cells format to 2dp with a percent suffix, never dividing by 100', () => {
  assert.equal(formatPercentOfDealValue('5.09090909'), '5.09%');
  assert.equal(formatPercentOfDealValue('0'), '0%');
  assert.equal(formatPercentOfDealValue('12.50'), '12.5%');
  assert.equal(formatPercentOfDealValue('100'), '100%');
});

test('6. row isolation: a malformed row does not prevent sibling rows from rendering', () => {
  const columns = [
    { column_key: 'deal' },
    { column_key: 'percent_of_deal_value' },
    { column_key: 'triggers' },
  ];
  const goodRow = {
    row_serving_key: 'a'.repeat(64),
    governed_deal_key: 'deal:good',
    cells: {
      deal: 'deal:good',
      percent_of_deal_value: '5.09090909',
      triggers: [{
        pathway_code: 'TAIL_NO_VOTE',
        pathway_label: 'No-vote tail pathway',
        trigger_label: 'Stockholder approval failure',
        terminating_party_label: 'Either party',
        payment_timing_label: 'Upon the earlier of signing a definitive agreement or consummation',
        condition_expression_text: 'Stockholder approval failure and a qualifying transaction within 12 months',
      }],
    },
  };
  // Malformed: triggers is not an array — formatCellValue must throw for this
  // shape, and mapCanonicalRowForRender must contain that failure to this
  // row alone.
  const malformedRow = {
    row_serving_key: 'b'.repeat(64),
    governed_deal_key: 'deal:bad',
    cells: { deal: 'deal:bad', percent_of_deal_value: '1', triggers: 'not-an-array' },
  };

  const rendered = [goodRow, malformedRow].map((row) => mapCanonicalRowForRender(row, columns));

  assert.equal(rendered[0].error, null);
  assert.equal(rendered[0].row_serving_key, goodRow.row_serving_key);
  const goodPercentCell = rendered[0].cells.find((cell) => cell.column_key === 'percent_of_deal_value');
  assert.equal(goodPercentCell.display, '5.09%');

  assert.ok(rendered[1].error);
  assert.deepEqual(rendered[1].cells, []);
  assert.equal(rendered[1].row_serving_key, malformedRow.row_serving_key);
});

test('7. Query source cells open the shared governed exact-detail renderer by deal key', () => {
  const query = fs.readFileSync('components/query/CanonicalMarketRange.jsx', 'utf8');
  const review = fs.readFileSync('components/review-v2/CanonicalReviewSection.jsx', 'utf8');
  assert.match(query, /CanonicalSourceDetail/);
  assert.match(query, /governedDealKey=\{rawRow\.governed_deal_key\}/);
  assert.match(query, /sourceAction=\{sourceAction\}/);
  assert.match(review, /query\.set\('dealKey', governedDealKey\)/);
  assert.match(review, /SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE\/V2/);
  assert.match(review, /Exact trigger evidence/);
});
