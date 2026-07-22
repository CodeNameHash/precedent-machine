const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  SHARED_ROW_VARIANTS,
  prepareSharedRowsForRendering,
  validateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');
const {
  adaptSharedServingRow,
  adaptSharedServingRows,
  SURFACES,
} = require('../lib/canonical-v2/shared-row-adapter');
const { buildCompleteServingFixture } = require('./helpers/canonical-v2-serving-fixture');

let rowMarketContext;
test.before(async () => {
  rowMarketContext = await import('../components/review-v2/rowMarketContext.js');
});

function resign(row) {
  const copy = structuredClone(row);
  delete copy.canonical_payload_digest;
  copy.canonical_payload_digest = contentId('SHARED_SERVING_ROW_PAYLOAD/V1', copy);
  return copy;
}

test('the shared row matrix is closed while certified canonical and source-specific fixtures have producers', () => {
  assert.deepEqual(Object.keys(SHARED_ROW_VARIANTS), [
    'CANONICAL_RESULT',
    'INCOMPLETE_CANONICAL_RESULT',
    'REVIEWED_SOURCE_SPECIFIC',
  ]);
  assert.equal(SHARED_ROW_VARIANTS.CANONICAL_RESULT.producer_status, 'IMPLEMENTED_FIXTURE');
  assert.equal(SHARED_ROW_VARIANTS.INCOMPLETE_CANONICAL_RESULT.producer_status, 'IMPLEMENTED_FIXTURE');
  assert.equal(SHARED_ROW_VARIANTS.REVIEWED_SOURCE_SPECIFIC.producer_status, 'IMPLEMENTED_FIXTURE');
});

test('one complete result produces a release-keyed row with bounded effects and explicit denominators', () => {
  const { row } = buildCompleteServingFixture();

  assert.equal(validateSharedServingRow(row), true);
  assert.equal(row.row_kind, 'CANONICAL_RESULT');
  assert.equal(row.source_actions.length, 0);
  assert.equal(row.canonical_result.source_detail_state.reason_code, 'EXACT_DETAIL_PROJECTION_NOT_BUILT');
  assert.equal(row.canonical_result.components[0].bounded_relationship_effects.length, 1);
  assert.equal(Object.hasOwn(row.canonical_result.components[0].bounded_relationship_effects[0], 'evidence_ids'), false);
  assert.equal(row.canonical_result.market_context.denominators.prevalence.deal_count, 38);
  assert.equal(row.canonical_result.market_context.denominators.distribution.deal_count, 37);
});

test('release changes the row identity while revisions and market counts change only its payload', () => {
  const base = buildCompleteServingFixture().row;
  const otherRelease = buildCompleteServingFixture({ release: 'candidate-b' }).row;
  const otherRevision = buildCompleteServingFixture({ rawValue: 'in all material respects ' }).row;
  const otherCounts = buildCompleteServingFixture({ counts: { eligible_deals: 40 } }).row;

  assert.notEqual(base.row_serving_key, otherRelease.row_serving_key);
  assert.equal(base.row_serving_key, otherRevision.row_serving_key);
  assert.notEqual(base.canonical_payload_digest, otherRevision.canonical_payload_digest);
  assert.equal(base.row_serving_key, otherCounts.row_serving_key);
  assert.notEqual(base.canonical_payload_digest, otherCounts.canonical_payload_digest);
});

test('lineage mismatches, forged relationship sets and forbidden payloads fail closed', () => {
  const { row } = buildCompleteServingFixture();
  const badProvenance = structuredClone(row);
  badProvenance.provenance.owner_revision_id = '0'.repeat(64);
  assert.throws(() => validateSharedServingRow(resign(badProvenance)), /lineage/);

  const badRelationships = structuredClone(row);
  badRelationships.canonical_result.components[0].relationship_set_digest = '0'.repeat(64);
  assert.throws(() => validateSharedServingRow(resign(badRelationships)), /relationship set/);

  const wrongEffectOwner = structuredClone(row);
  wrongEffectOwner.canonical_result.components[0].bounded_relationship_effects[0].relationship_revision_id = '0'.repeat(64);
  assert.throws(() => validateSharedServingRow(resign(wrongEffectOwner)), /do not match/);

  const forbidden = structuredClone(row);
  forbidden.canonical_result.source_detail_state.url = null;
  assert.throws(() => validateSharedServingRow(resign(forbidden)), /fields do not match|forbidden/);

  const leakedDimensions = structuredClone(row);
  leakedDimensions.canonical_result.refinable_dimensions.full_source_document = 'leak';
  assert.throws(() => validateSharedServingRow(resign(leakedDimensions)), /unsupported serving dimension/);

  const leakedRawValue = structuredClone(row);
  leakedRawValue.canonical_result.components[0].raw_value = { source_text: 'leak' };
  assert.throws(() => validateSharedServingRow(resign(leakedRawValue)), /bounded source string/);

  const forgedMetricSlot = structuredClone(row);
  forgedMetricSlot.canonical_result.market_context.subject_observation.metric_slot_key = '0'.repeat(64);
  forgedMetricSlot.provenance.metric_slot_key = '0'.repeat(64);
  assert.throws(() => validateSharedServingRow(resign(forgedMetricSlot)), /metric slot identity/);

  const mismatchedValue = structuredClone(row);
  mismatchedValue.canonical_result.components[0].canonical_value = 'MAT_MAE_QUALIFIED';
  assert.throws(() => validateSharedServingRow(resign(mismatchedValue)), /metric fields/);
});

test('impossible count hierarchies and mixed-unit exclusion counts fail closed', () => {
  const { row } = buildCompleteServingFixture();
  const impossible = structuredClone(row);
  impossible.canonical_result.market_context.cohort.counts.applicable_deals = 50;
  assert.throws(() => validateSharedServingRow(resign(impossible)), /denominator ordering/);

  const impossibleDistribution = structuredClone(row);
  impossibleDistribution.canonical_result.market_context.cohort.distribution[0].deal_count = 38;
  assert.throws(() => validateSharedServingRow(resign(impossibleDistribution)), /distribution count/);
});

test('one malformed row becomes a local failure and does not suppress valid siblings', () => {
  const { row } = buildCompleteServingFixture();
  const otherRow = buildCompleteServingFixture({ release: 'candidate-b' }).row;
  const bad = structuredClone(row);
  bad.canonical_payload_digest = '0'.repeat(64);
  const prepared = prepareSharedRowsForRendering([row, bad, otherRow], (validRow) => {
    if (validRow === bad) throw new Error('unreachable');
    return adaptSharedServingRow(validRow);
  });

  assert.deepEqual(prepared.map((item) => item.render_kind), ['ROW', 'ROW_RENDER_FAILED', 'ROW']);
  assert.equal(prepared.length, 3);
  assert.equal(prepared[0].key, row.row_serving_key);
  assert.equal(prepared[2].key, otherRow.row_serving_key);
  assert.equal(prepared[2].prepared.row_key, otherRow.row_serving_key);
});

test('a later adapter failure is isolated and duplicate row keys are rejected locally', () => {
  const first = buildCompleteServingFixture().row;
  const second = buildCompleteServingFixture({ release: 'candidate-b' }).row;
  const prepared = prepareSharedRowsForRendering([first, second], (row) => {
    if (row.row_serving_key === first.row_serving_key) throw new Error('fixture adapter failure');
    return adaptSharedServingRow(row);
  });
  assert.deepEqual(prepared.map((item) => item.render_kind), ['ROW_RENDER_FAILED', 'ROW']);

  const duplicates = prepareSharedRowsForRendering([first, first]);
  assert.deepEqual(duplicates.map((item) => item.render_kind), ['ROW', 'ROW_RENDER_FAILED']);
});

test('the shared adapter returns renderable siblings around an unrecognised provision', () => {
  const first = buildCompleteServingFixture().row;
  const second = buildCompleteServingFixture({ release: 'candidate-b' }).row;
  const prepared = adaptSharedServingRows([
    first,
    { row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE' },
    second,
  ]);

  assert.deepEqual(prepared.map((item) => item.render_kind), ['ROW', 'ROW_RENDER_FAILED', 'ROW']);
  assert.equal(prepared[1].reason_code, 'INVALID_SHARED_SERVING_ROW');
  assert.equal(prepared[0].prepared.row_key, first.row_serving_key);
  assert.equal(prepared[2].prepared.row_key, second.row_serving_key);
  assert.equal(Object.hasOwn(prepared[0], 'row'), false);
});

test('adapter failure keys cannot collide with a valid row or another rejected duplicate', () => {
  const row = buildCompleteServingFixture().row;
  const prepared = adaptSharedServingRows([row, row, row]);

  assert.deepEqual(prepared.map((item) => item.render_kind), ['ROW', 'ROW_RENDER_FAILED', 'ROW_RENDER_FAILED']);
  assert.equal(new Set(prepared.map((item) => item.key)).size, 3);
  assert.equal(prepared[0].key, row.row_serving_key);
  assert.notEqual(prepared[1].key, row.row_serving_key);
  assert.notEqual(prepared[2].key, row.row_serving_key);
});

test('Review, Corpus Context, Compare and Query consume one typed row contract', () => {
  const { row } = buildCompleteServingFixture();
  const adapted = adaptSharedServingRow(row);
  const context = rowMarketContext.buildTypedRowMarketContext(adapted.resolution, adapted.data);

  assert.deepEqual(Object.keys(adapted.surface_bindings), SURFACES);
  assert.equal(adapted.resolution.rowKind, 'CANONICAL_RESULT');
  assert.equal(adapted.resolution.selectedDealContextOnly, false);
  assert.equal(adapted.resolution.marketCohortEligible, true);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].row_key, row.row_serving_key);
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.equal(context.marketRowKey, row.row_serving_key);
  assert.equal(context.peerSetSize, 39);
  assert.equal(context.termDealCount, 38);
  assert.equal(context.treatments[0].subjectLabel, 'True in all material respects');
  assert.deepEqual(context.treatments[0].values.map((item) => [item.label, item.count, item.denominator]), [
    ['True in all material respects', 20, 37],
    ['True except where failure would not cause an MAE', 17, 37],
  ]);
  assert.equal(adapted.data.byRow[row.row_serving_key].metrics.REPRESENTATION_ACCURACY_STANDARD.coverage.excludedCount, 2);
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});
