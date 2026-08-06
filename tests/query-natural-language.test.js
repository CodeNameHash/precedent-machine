const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_QUERY_LENGTH,
  IntentValidationError,
  buildFieldCatalog,
  buildIntentTool,
  compileIntent,
  interpretDeterministically,
  normaliseQuestion,
  validateReadyPayload,
} = require('../lib/query/natural-language');

const deals = [
  {
    id: 'd1',
    acquirer: 'Buyer One',
    target: 'Target One',
    sector: 'Healthcare',
    announce_date: '2025-01-15',
    value_usd: 1_000_000_000,
    metadata: { headlineConsiderationType: 'CASH' },
  },
  {
    id: 'd2',
    acquirer: 'Buyer Two',
    target: 'Target Two',
    sector: 'Technology',
    announce_date: '2024-02-15',
    value_usd: 2_000_000_000,
    metadata: { headlineConsiderationType: 'STOCK' },
  },
  {
    id: 'd3',
    acquirer: 'Buyer Three',
    target: 'Target Three',
    sector: 'Healthcare',
    announce_date: '2023-03-15',
    value_usd: 3_000_000_000,
    metadata: { headlineConsiderationType: 'MIXED' },
  },
];

const catalog = buildFieldCatalog();

test('bare Consideration asks for a concrete comparable term and never builds a payload', () => {
  const result = interpretDeterministically('consideration', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.kind, undefined);
  assert.equal(result.payload, undefined);
  assert.match(result.clarification, /several distinct comparable terms/i);
  assert.deepEqual(result.suggestions.map((suggestion) => suggestion.label), [
    'Consideration form',
    'Per-share consideration',
    'Exchange ratio',
    'Proration mechanics',
  ]);
});

test('metric-specific Consideration question compiles to its exact field', () => {
  const result = interpretDeterministically('What is the market range for per-share consideration?', { deals, catalog });
  const expectedFieldPath = 'perShareAmount';
  assert.deepEqual(result, {
    status: 'ready',
    kind: 'MARKET_RANGE',
    payload: {
      field_path: expectedFieldPath,
      provision_type: 'CONSIDERATION',
      deal_filter: {},
      chart_kind: 'BAR',
    },
    summary: 'Market range · Per-share consideration',
  });
});

test('numeric market metric compiles to MARKET_RANGE with an observed deal facet', () => {
  const result = interpretDeterministically(
    'What is the market range for the initial matching-rights period across Healthcare deals?',
    { deals, catalog },
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.kind, 'MARKET_RANGE');
  const expectedFieldPath = 'initialMatchPeriodDays';
  assert.deepEqual(result.payload, {
    field_path: expectedFieldPath,
    provision_type: 'COVENANT_NO_SOLICITATION',
    deal_filter: { sector: ['Healthcare'] },
    chart_kind: 'HISTOGRAM',
  });
});

test('termination fee as a percentage of deal value selects the derived numeric metric', () => {
  const result = interpretDeterministically(
    'Market range for termination fees as a percentage of deal value',
    { deals, catalog },
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.kind, 'MARKET_RANGE');
  assert.equal(result.payload.provision_type, 'TERMINATION_FEE');
  assert.equal(result.payload.field_path, 'feePctOfDealValue');
  assert.equal(result.payload.chart_kind, 'HISTOGRAM');
});

test('termination-fee market checks default to comparable deal-size percentages for each fee side', () => {
  const company = interpretDeterministically('What is the market range for company termination fees?', { deals, catalog });
  assert.equal(company.payload.field_path, 'feePctOfDealValue');
  const reverse = interpretDeterministically('What is the market range for reverse termination fees?', { deals, catalog });
  assert.equal(reverse.payload.field_path, 'reverseFeePctOfDealValue');
});

test('termination-fee percentage predicates filter on the relative metric', () => {
  const result = interpretDeterministically('Which deals have company termination fees over 3% of deal value?', { deals, catalog });
  assert.deepEqual(result.payload.filters, [{
    provision_type: 'TERMINATION_FEE', field: 'feePctOfDealValue', op: 'gt', value: 3,
  }]);
});

test('ambiguous matching-rights plural asks initial versus subsequent', () => {
  const result = interpretDeterministically('Compare matching-rights periods across the corpus', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.match(result.clarification, /initial or subsequent/i);
  assert.deepEqual(result.suggestions.map((suggestion) => suggestion.label), [
    'Initial matching-rights period',
    'Subsequent matching-rights period',
  ]);
});

test('cross-cut compiles multiple named terms to exact columns and known deal IDs', () => {
  const result = interpretDeterministically(
    'Show a cross-cut table of initial match period and subsequent matching period across all deals',
    { deals, catalog },
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.kind, 'PROVISION_CROSS_CUT');
  assert.deepEqual(result.payload.columns, ['initialMatchPeriodDays', 'subsequentMatchingPeriod']);
  assert.deepEqual(result.payload.deal_ids, ['d1', 'd2', 'd3']);
  assert.equal(result.payload.provision_type, 'COVENANT_NO_SOLICITATION');
});

test('boolean natural-language condition compiles to FILTER_THEN_LIST', () => {
  const result = interpretDeterministically('Which deals have a go-shop?', { deals, catalog });
  assert.equal(result.status, 'ready');
  assert.equal(result.kind, 'FILTER_THEN_LIST');
  assert.deepEqual(result.payload.filters, [{
    provision_type: 'COVENANT_NO_SOLICITATION',
    field: 'goShopPresent',
    op: 'eq',
    value: true,
  }]);
});

test('compound boolean conditions keep negation scoped to the matching row', () => {
  const result = interpretDeterministically('Which deals have a go-shop and no force-the-vote?', { deals, catalog });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.payload.filters, [
    { provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', op: 'eq', value: true },
    { provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: false },
  ]);
});

test('compound numeric conditions keep numbers scoped to the matching row', () => {
  const result = interpretDeterministically(
    'Which deals have an initial match period of 5 days and a subsequent match period of 3 days?',
    { deals, catalog },
  );
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.payload.filters, [
    { provision_type: 'COVENANT_NO_SOLICITATION', field: 'initialMatchPeriodDays', op: 'eq', value: 5 },
    { provision_type: 'COVENANT_NO_SOLICITATION', field: 'subsequentMatchingPeriod', op: 'eq', value: 3 },
  ]);
});

test('alternative row predicates clarify because the executor combines filters with AND', () => {
  const result = interpretDeterministically('Which deals have a go-shop or force-the-vote?', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.match(result.clarification, /alternatives/i);
});

test('numeric natural-language condition preserves its operator and value', () => {
  const result = interpretDeterministically('Which deals have an initial match period of at least 4 days?', { deals, catalog });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.payload.filters, [{
    provision_type: 'COVENANT_NO_SOLICITATION',
    field: 'initialMatchPeriodDays',
    op: 'gte',
    value: 4,
  }]);
});

test('tender-offer question compiles to the transaction-structure row', () => {
  const result = interpretDeterministically('Which deals are tender offers?', { deals, catalog });
  assert.equal(result.status, 'ready');
  assert.equal(result.kind, 'FILTER_THEN_LIST');
  assert.deepEqual(result.payload.filters, [{
    provision_type: 'STRUCTURE_MECHANICS',
    field: 'dealStructure',
    op: 'eq',
    value: 'TWO_STEP_TENDER_OFFER',
  }]);
});

test('deal-facet-only questions compile without inventing a provision condition', () => {
  const healthcare = interpretDeterministically('Which are the Healthcare deals?', { deals, catalog });
  assert.equal(healthcare.status, 'ready');
  assert.equal(healthcare.kind, 'FILTER_THEN_LIST');
  assert.deepEqual(healthcare.payload.filters, []);
  assert.deepEqual(healthcare.payload.deal_filter, { sector: ['Healthcare'] });

  const year = interpretDeterministically('Which deals signed in 2025?', { deals, catalog });
  assert.equal(year.status, 'ready');
  assert.deepEqual(year.payload.deal_filter, { signing_year: [2025] });
});

test('one-step question compiles to the transaction-structure row', () => {
  const result = interpretDeterministically('Which deals are one-step?', { deals, catalog });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.payload.filters, [{
    provision_type: 'STRUCTURE_MECHANICS',
    field: 'dealStructure',
    op: 'eq',
    value: 'ONE_STEP_MERGER',
  }]);
});

// DEAL_COMPARE and DEAL_TO_MARKET were retired as query kinds — deal-vs-deal
// and deal-vs-market comparison now live on the review page's own compare
// mode and market columns (see pages/review/[id].js), not through this
// query interface. Phrasing that used to compile to those kinds must now
// decline clearly instead of silently mis-routing or dispatching a kind the
// engine no longer accepts.
test('two named deals no longer compile to a runnable kind — comparison declines clearly', () => {
  const result = interpretDeterministically('Compare Buyer One and Buyer Two', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.kind, undefined);
  assert.equal(result.payload, undefined);
  assert.match(result.clarification, /review page/i);
  assert.match(result.clarification, /compare/i);
});

test('a named-deal comparison with a broad provision family also declines clearly', () => {
  const result = interpretDeterministically('Compare Buyer One and Buyer Two on consideration', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.match(result.clarification, /review page/i);
});

test('one named deal against the market no longer compiles to a runnable kind — declines clearly', () => {
  const result = interpretDeterministically('How does Buyer One compare with the market?', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.kind, undefined);
  assert.equal(result.payload, undefined);
  assert.match(result.clarification, /review page/i);
  assert.match(result.clarification, /market/i);
});

test('deal-to-market phrasing narrowed to a broad provision family also declines clearly', () => {
  const result = interpretDeterministically('How does Buyer One compare with the market on consideration?', { deals, catalog });
  assert.equal(result.status, 'needs_clarification');
  assert.match(result.clarification, /review page/i);
});

test('model intent cannot use a field outside the selected provision type', () => {
  assert.throws(() => compileIntent({
    status: 'ready',
    kind: 'MARKET_RANGE',
    field_paths: ['goShopPresent'],
    provision_type: 'CONSIDERATION',
    deal_filter: {},
  }, { deals, catalog }), (error) => {
    assert.ok(error instanceof IntentValidationError);
    assert.match(error.message, /unknown field for consideration/i);
    return true;
  });
});

test('model intent cannot use an unknown deal ID', () => {
  assert.throws(() => compileIntent({
    status: 'ready',
    kind: 'PROVISION_CROSS_CUT',
    provision_type: 'COVENANT_NO_SOLICITATION',
    field_paths: ['goShopPresent'],
    deal_ids: ['invented-deal'],
    deal_filter: {},
  }, { deals, catalog }), /Unknown deal_id: invented-deal/);
});

test('model intent cannot apply a numeric operator to a boolean row', () => {
  assert.throws(() => compileIntent({
    status: 'ready',
    kind: 'FILTER_THEN_LIST',
    filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', op: 'gte', value: true }],
    deal_filter: {},
  }, { deals, catalog }), /gte is not valid for Go-Shop/i);
});

test('model intent canonicalises human categorical values before execution', () => {
  const consideration = compileIntent({
    status: 'ready',
    kind: 'FILTER_THEN_LIST',
    filters: [{ provision_type: 'CONSIDERATION', field: 'considerationType', op: 'eq', value: 'Cash' }],
    deal_filter: {},
  }, { deals, catalog });
  assert.equal(consideration.payload.filters[0].value, 'all-cash');

  const structure = compileIntent({
    status: 'ready',
    kind: 'FILTER_THEN_LIST',
    filters: [{ provision_type: 'STRUCTURE_MECHANICS', field: 'dealStructure', op: 'eq', value: 'Tender offer' }],
    deal_filter: {},
  }, { deals, catalog });
  assert.equal(structure.payload.filters[0].value, 'TWO_STEP_TENDER_OFFER');
});

test('model intent rejects unknown categorical values and text operators', () => {
  const base = {
    status: 'ready',
    kind: 'FILTER_THEN_LIST',
    deal_filter: {},
  };
  assert.throws(() => compileIntent({
    ...base,
    filters: [{ provision_type: 'CONSIDERATION', field: 'considerationType', op: 'eq', value: 'BANANAS' }],
  }, { deals, catalog }), /Unknown Consideration form value: BANANAS/i);
  assert.throws(() => compileIntent({
    ...base,
    filters: [{ provision_type: 'CONSIDERATION', field: 'considerationType', op: 'contains', value: 'cash' }],
  }, { deals, catalog }), /contains is not valid for Consideration form/i);
});

test('all three compiled kinds pass deterministic completeness validation', () => {
  const questions = [
    'What is the market range for the initial match period?',
    'Show a cross-cut table of initial match period across all deals',
    'Which deals have a go-shop?',
  ];
  const kinds = new Set();
  for (const question of questions) {
    const result = interpretDeterministically(question, { deals, catalog });
    assert.equal(result.status, 'ready', question);
    assert.equal(validateReadyPayload(result.kind, result.payload, { deals, catalog }), true);
    kinds.add(result.kind);
  }
  assert.deepEqual(kinds, new Set([
    'MARKET_RANGE', 'PROVISION_CROSS_CUT', 'FILTER_THEN_LIST',
  ]));
});

test('tool schema constrains model-selected kinds, fields and deal IDs', () => {
  const tool = buildIntentTool(catalog, deals);
  assert.equal(tool.name, 'submit_query_intent');
  assert.equal(tool.strict, true);
  assert.deepEqual(tool.input_schema.properties.deal_ids.items.enum, ['d1', 'd2', 'd3']);
  assert.ok(tool.input_schema.properties.field_paths.items.enum.includes('initialMatchPeriodDays'));
  assert.ok(tool.input_schema.properties.field_paths.items.enum.includes('feePctOfDealValue'));
  assert.deepEqual(tool.input_schema.properties.kind.enum.sort(), [
    'FILTER_THEN_LIST', 'MARKET_RANGE', 'PROVISION_CROSS_CUT',
  ]);
});

test('question input is capped before it reaches the model', () => {
  assert.equal(normaliseQuestion('  Which deals have a go-shop?  '), 'Which deals have a go-shop?');
  assert.throws(() => normaliseQuestion('x'.repeat(MAX_QUERY_LENGTH + 1)), /under 600 characters/);
});

test('the live interpret API is contained and its prior model contract remains preserved', () => {
  const liveSource = fs.readFileSync(path.join(__dirname, '..', 'pages/api/query/interpret.js'), 'utf8');
  const preservedSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib/query/contained-routes/interpret.js'),
    'utf8',
  );
  assert.match(liveSource, /queryContainedHandler/);
  assert.doesNotMatch(liveSource, /Anthropic|tools:\s*\[tool\]|compileIntent/);
  assert.match(preservedSource, /tools:\s*\[tool\]/);
  assert.match(preservedSource, /tool_choice:\s*\{\s*type:\s*'tool'/);
  assert.match(preservedSource, /compileIntent\(block\.input/);
  assert.match(preservedSource, /status:\s*'needs_clarification'/);
  assert.match(preservedSource, /fallback\.status === 'needs_clarification' && requiresRowChoice/);
});
