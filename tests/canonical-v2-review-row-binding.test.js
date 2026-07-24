const test = require('node:test');
const assert = require('node:assert/strict');

const {
  F4_REVIEW_ROW_BINDING_RULES,
  ReviewRowBindingError,
  bindPreparedRowsToReviewRows,
  findPreparedReviewBinding,
  preparedMetadata,
} = require('../lib/canonical-v2/review-row-binding');
const { METRIC_DEFINITIONS } = require('../lib/canonical-v2/serving-projection');

const PARTIES = Object.freeze({
  conditionBuyer: Object.freeze({ role: 'CONDITION_BENEFICIARY', value: 'PARENT', capacity: 'ACQUIRER' }),
  targetObligor: Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' }),
  buyerRightHolder: Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' }),
  targetRepMaker: Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' }),
  sellerFeePayer: Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' }),
  buyerFeePayer: Object.freeze({ role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' }),
});

let rowNumber = 0;
function preparedRow({
  concept,
  metric,
  party,
  slot,
  ordinal = 0,
  rowKind = 'CANONICAL_RESULT',
  value = 'VALUE',
} = {}) {
  rowNumber += 1;
  const governedBinding = {
    concept_key: concept,
    concept_version: 1,
    party,
    result_ordinal: ordinal,
    metric_key: metric,
    metric_version: 1,
    component_slot_key: slot,
    governed_ordinal: ordinal,
  };
  return {
    row_key: `row-${rowNumber}`,
    governed_binding: governedBinding,
    resolution: { rowKind, governedBinding },
    value,
  };
}

function reviewRow(section_id, {
  group_id = null,
  row_id = null,
  provision_code = null,
  marker = null,
} = {}) {
  return { section_id, group_id, row_id, provision_code, marker };
}

function exactF4Rows() {
  return [
    preparedRow({
      concept: 'COND-B-REP',
      metric: 'REPRESENTATION_ACCURACY_STANDARD',
      party: PARTIES.conditionBuyer,
      slot: 'CAPITALISATION_LIMBS_I_AND_III',
      value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    }),
    preparedRow({
      concept: 'NOSOL-PROHIBIT',
      metric: 'NO_SHOP_PROHIBITED_ACTION',
      party: PARTIES.targetObligor,
      slot: 'PROHIBITED_ACTION',
      ordinal: 2,
      value: 'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
    }),
    preparedRow({
      concept: 'NOSOL-PROHIBIT',
      metric: 'NO_SHOP_PROHIBITED_ACTION',
      party: PARTIES.targetObligor,
      slot: 'PROHIBITED_ACTION',
      ordinal: 0,
      value: 'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
    }),
    preparedRow({
      concept: 'NOSOL-NOTICE',
      metric: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      party: PARTIES.targetObligor,
      slot: 'NOTICE_PERIOD',
      value: '1',
    }),
    preparedRow({
      concept: 'NOSOL-MATCH',
      metric: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      party: PARTIES.buyerRightHolder,
      slot: 'INITIAL_MATCH_PERIOD',
      value: '4',
    }),
    preparedRow({
      concept: 'NOSOL-REMATCH',
      metric: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
      party: PARTIES.buyerRightHolder,
      slot: 'SUBSEQUENT_MATCH_PERIOD',
      value: '4',
    }),
    preparedRow({
      concept: 'REP-T-CONTRACTS',
      metric: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      party: PARTIES.targetRepMaker,
      slot: 'CASH_FLOW_THRESHOLD',
      rowKind: 'INCOMPLETE_CANONICAL_RESULT',
      value: '0.05882353',
    }),
    preparedRow({
      concept: 'TERMF-TARGET',
      metric: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      party: PARTIES.sellerFeePayer,
      slot: 'FEE_AMOUNT',
      value: '3.52941176',
    }),
    preparedRow({
      concept: 'TERMF-REVERSE',
      metric: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      party: PARTIES.buyerFeePayer,
      slot: 'FEE_AMOUNT',
      value: '3.52941176',
    }),
  ];
}

function exactReviewRows() {
  return [
    reviewRow('representations-qualifiers', { provision_code: 'REP-T-CAP', marker: 'capitalisation' }),
    reviewRow('nosol', {
      group_id: 'nosol-no-shop-core',
      row_id: 'nosol-noshop-prohibit',
      marker: 'prohibited-actions',
    }),
    reviewRow('nosol', {
      group_id: 'nosol-notice',
      row_id: 'nosol-noshop-notice-hours',
      marker: 'notice',
    }),
    reviewRow('nosol', {
      group_id: 'nosol-matching',
      row_id: 'nosol-fiduciary-initial-match',
      marker: 'initial-match',
    }),
    reviewRow('nosol', {
      group_id: 'nosol-matching',
      row_id: 'nosol-fiduciary-subsequent-match',
      marker: 'subsequent-match',
    }),
    reviewRow('material-contracts', {
      row_id: 'material-contracts-AGGREGATE_PAYMENTS-1',
      marker: 'material-contracts-clause-d',
    }),
    reviewRow('termination-fees', {
      row_id: 'termination-fees-COMPANY_TERMINATION_FEE',
      marker: 'seller-fee',
    }),
    reviewRow('termination-fees', {
      row_id: 'termination-fees-REVERSE_TERMINATION_FEE',
      marker: 'buyer-fee',
    }),
  ];
}

test('F4 registry contains only the eight explicit governed Review targets', () => {
  assert.equal(F4_REVIEW_ROW_BINDING_RULES.length, 8);
  assert.deepEqual(
    F4_REVIEW_ROW_BINDING_RULES.map((item) => item.binding_key),
    [
      'F4_CAPITALISATION_ACCURACY',
      'F4_NO_SHOP_PROHIBITED_ACTIONS',
      'F4_NO_SHOP_NOTICE',
      'F4_NO_SHOP_INITIAL_MATCH',
      'F4_NO_SHOP_SUBSEQUENT_MATCH',
      'F4_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD',
      'F4_SELLER_TERMINATION_FEE',
      'F4_BUYER_TERMINATION_FEE',
    ],
  );
  for (const item of F4_REVIEW_ROW_BINDING_RULES) {
    assert.equal(Object.hasOwn(item.review, 'label'), false);
    assert.ok(['ROW_ID', 'PROVISION_CODE'].includes(item.review.identity_kind));
    const metric = METRIC_DEFINITIONS[item.canonical.metric_key];
    assert.equal(metric.metric_version, item.canonical.metric_version);
    assert.equal(metric.concept_key, item.canonical.concept_key);
  }
});

test('all existing F4 row families bind to their exact normal Review identities', () => {
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: exactF4Rows(),
    review_rows: exactReviewRows(),
  });
  assert.equal(result.schema_version, 'CANONICAL_REVIEW_ROW_BINDING_RESULT/V2');
  assert.equal(result.bindings.length, 8);
  assert.equal(result.isolated.length, 0);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(
    result.bindings.map((item) => item.review_row.marker),
    [
      'capitalisation',
      'prohibited-actions',
      'notice',
      'initial-match',
      'subsequent-match',
      'material-contracts-clause-d',
      'seller-fee',
      'buyer-fee',
    ],
  );
});

test('a rendered Review row resolves back to its exact prepared binding', () => {
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: exactF4Rows(),
    review_rows: exactReviewRows(),
  });
  const material = findPreparedReviewBinding(result, {
    section_id: 'material-contracts',
    row_id: 'material-contracts-AGGREGATE_PAYMENTS-1',
  });
  assert.equal(material.binding_key, 'F4_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD');
  assert.equal(
    findPreparedReviewBinding(result, {
      section_id: 'material-contracts',
      row_id: 'material-contracts-AGGREGATE_PAYMENTS-4',
    }),
    null,
  );
});

test('prohibited-action rows share one exact Review row and remain ordered by governed ordinal', () => {
  const rows = exactF4Rows().filter(
    (row) => row.governed_binding.metric_key === 'NO_SHOP_PROHIBITED_ACTION',
  );
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: rows,
    review_rows: exactReviewRows(),
  });
  assert.equal(result.bindings.length, 1);
  assert.equal(result.bindings[0].binding_key, 'F4_NO_SHOP_PROHIBITED_ACTIONS');
  assert.deepEqual(
    result.bindings[0].prepared_rows.map((row) => row.governed_binding.governed_ordinal),
    [0, 2],
  );
});

test('concept, metric, party and primary value slot must all match exactly', () => {
  const base = {
    concept: 'NOSOL-NOTICE',
    metric: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    party: PARTIES.targetObligor,
    slot: 'NOTICE_PERIOD',
  };
  const rows = [
    preparedRow({ ...base, concept: 'NOSOL-MATCH' }),
    preparedRow({ ...base, metric: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS' }),
    preparedRow({ ...base, party: PARTIES.buyerRightHolder }),
    preparedRow({ ...base, slot: 'INITIAL_MATCH_PERIOD' }),
  ];
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: rows,
    review_rows: exactReviewRows(),
  });
  assert.equal(result.bindings.length, 0);
  assert.deepEqual(
    result.isolated.map((item) => item.reason_code),
    new Array(4).fill('NO_GOVERNED_REVIEW_BINDING'),
  );
});

test('matching labels never compensate for a wrong row id or provision code', () => {
  const [capitalisation] = exactF4Rows();
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: [capitalisation],
    review_rows: [
      reviewRow('representations-qualifiers', {
        provision_code: 'REP-T-ORGANIZATION',
        marker: 'Capitalization',
      }),
    ],
  });
  assert.equal(result.bindings.length, 0);
  assert.equal(result.isolated[0].reason_code, 'REVIEW_ROW_NOT_FOUND');
});

test('F4 material threshold binds only clause D, not another aggregate-payments row', () => {
  const material = exactF4Rows().find(
    (row) => row.governed_binding.metric_key
      === 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  );
  const wrongAggregateRow = reviewRow('material-contracts', {
    row_id: 'material-contracts-AGGREGATE_PAYMENTS-7',
    marker: 'customer-contract-threshold',
  });
  const missing = bindPreparedRowsToReviewRows({
    prepared_rows: [material],
    review_rows: [wrongAggregateRow],
  });
  assert.equal(missing.bindings.length, 0);
  assert.equal(missing.isolated[0].reason_code, 'REVIEW_ROW_NOT_FOUND');

  const ambiguous = bindPreparedRowsToReviewRows({
    prepared_rows: [material],
    review_rows: [
      ...exactReviewRows(),
      reviewRow('material-contracts', {
        row_id: 'material-contracts-AGGREGATE_PAYMENTS-1',
        marker: 'duplicate-clause-d',
      }),
    ],
  });
  assert.equal(ambiguous.bindings.length, 0);
  assert.equal(ambiguous.isolated[0].reason_code, 'AMBIGUOUS_REVIEW_ROW_BINDING');
});

test('reviewed source-specific, unknown and malformed rows are isolated without blocking siblings', () => {
  const notice = exactF4Rows().find(
    (row) => row.governed_binding.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  const sourceSpecific = {
    row_key: 'source-specific',
    governed_binding: null,
    resolution: { rowKind: 'REVIEWED_SOURCE_SPECIFIC', governedBinding: null },
  };
  const unknown = preparedRow({
    concept: 'MAE-UNKNOWN',
    metric: 'MAE_UNKNOWN_METRIC',
    party: PARTIES.targetObligor,
    slot: 'UNKNOWN_SLOT',
  });
  const malformed = { row_key: 'malformed', resolution: { rowKind: 'CANONICAL_RESULT' } };
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: [sourceSpecific, malformed, unknown, notice],
    review_rows: exactReviewRows(),
  });
  assert.equal(result.bindings.length, 1);
  assert.equal(result.bindings[0].binding_key, 'F4_NO_SHOP_NOTICE');
  assert.deepEqual(
    result.isolated.map((item) => item.reason_code),
    ['REVIEWED_SOURCE_SPECIFIC', 'MISSING_GOVERNED_BINDING', 'NO_GOVERNED_REVIEW_BINDING'],
  );
});

test('duplicate canonical rows and duplicate governed slots isolate only their affected binding', () => {
  const notice = preparedRow({
    concept: 'NOSOL-NOTICE',
    metric: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    party: PARTIES.targetObligor,
    slot: 'NOTICE_PERIOD',
  });
  const duplicateRows = bindPreparedRowsToReviewRows({
    prepared_rows: [notice, notice],
    review_rows: exactReviewRows(),
  });
  assert.equal(duplicateRows.bindings.length, 0);
  assert.deepEqual(
    duplicateRows.isolated.map((item) => item.reason_code),
    ['DUPLICATE_PREPARED_ROW', 'DUPLICATE_PREPARED_ROW'],
  );
  assert.deepEqual(duplicateRows.errors.map((item) => item.code), ['DUPLICATE_PREPARED_ROW']);
  const duplicateSlot = {
    ...notice,
    row_key: 'different-row-serving-key',
  };
  const duplicateSlots = bindPreparedRowsToReviewRows({
    prepared_rows: [notice, duplicateSlot],
    review_rows: exactReviewRows(),
  });
  assert.equal(duplicateSlots.bindings.length, 0);
  assert.deepEqual(
    duplicateSlots.isolated.map((item) => item.reason_code),
    ['DUPLICATE_CANONICAL_SLOT', 'DUPLICATE_CANONICAL_SLOT'],
  );
  assert.deepEqual(duplicateSlots.errors.map((item) => item.code), ['DUPLICATE_CANONICAL_SLOT']);
});

test('multiple exact normal Review targets isolate only the ambiguous binding', () => {
  const notice = exactF4Rows().find(
    (row) => row.governed_binding.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  const seller = exactF4Rows().find(
    (row) => row.governed_binding.metric_key === 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  );
  const duplicateReviewRow = reviewRow('nosol', {
    group_id: 'nosol-notice',
    row_id: 'nosol-noshop-notice-hours',
    marker: 'duplicate-notice',
  });
  const result = bindPreparedRowsToReviewRows({
    prepared_rows: [notice, seller],
    review_rows: [...exactReviewRows(), duplicateReviewRow],
  });
  assert.deepEqual(result.bindings.map((item) => item.binding_key), ['F4_SELLER_TERMINATION_FEE']);
  assert.equal(result.isolated[0].reason_code, 'AMBIGUOUS_REVIEW_ROW_BINDING');
  assert.deepEqual(result.errors.map((item) => item.code), ['AMBIGUOUS_REVIEW_ROW_BINDING']);
});

test('duplicate rule selectors or Review targets are rejected before binding', () => {
  const duplicate = {
    ...F4_REVIEW_ROW_BINDING_RULES[0],
    binding_key: 'DUPLICATE_CAPITALISATION',
  };
  assert.throws(
    () => bindPreparedRowsToReviewRows({
      prepared_rows: [],
      review_rows: [],
      rules: [...F4_REVIEW_ROW_BINDING_RULES, duplicate],
    }),
    (error) => error instanceof ReviewRowBindingError && error.code === 'DUPLICATE_BINDING_RULE',
  );
});

test('prepared metadata reads only the governed adapter descriptor', () => {
  const complete = exactF4Rows()[0];
  const incomplete = exactF4Rows().find(
    (row) => row.resolution.rowKind === 'INCOMPLETE_CANONICAL_RESULT',
  );
  assert.deepEqual(preparedMetadata(complete).canonical, {
    concept_key: 'COND-B-REP',
    concept_version: 1,
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    metric_version: 1,
    party: PARTIES.conditionBuyer,
    component_slot_key: 'CAPITALISATION_LIMBS_I_AND_III',
  });
  assert.deepEqual(preparedMetadata(incomplete).canonical, {
    concept_key: 'REP-T-CONTRACTS',
    concept_version: 1,
    metric_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    party: PARTIES.targetRepMaker,
    component_slot_key: 'CASH_FLOW_THRESHOLD',
  });
});
