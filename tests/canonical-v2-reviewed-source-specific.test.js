const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosReviewedServingFixture } = require('../__fixtures__/canonical-v2/landos-reviewed-row');
const { buildLandosSourceSpecificServingFixture } = require('../__fixtures__/canonical-v2/landos-source-specific-row');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const { adaptSharedServingRow, adaptSharedServingRows, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

function resign(row) {
  const copy = structuredClone(row);
  delete copy.canonical_payload_digest;
  copy.canonical_payload_digest = contentId('SHARED_SERVING_ROW_PAYLOAD/V1', copy);
  return copy;
}

test('a real unfamiliar proposition preserves non-contiguous evidence and its nested definition without inventing a concept', () => {
  const fixture = buildLandosSourceSpecificServingFixture();
  const body = fixture.row.reviewed_source_specific;

  assert.equal(validateSharedServingRow(fixture.row), true);
  assert.equal(fixture.row.row_kind, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(body.market_comparability, 'REVIEWED_SOURCE_SPECIFIC');
  assert.equal(body.final_disposition.disposition_code, 'REVIEWED_SOURCE_SPECIFIC');
  assert.match(body.non_comparable_reason, /no governed cross-deal concept/i);
  assert.deepEqual(body.observed_party_tokens, ['Company']);
  assert.equal(body.candidate_occurrence.ordered_proposition_evidence_reference_ids.length, 2);
  assert.equal(body.evidence_references.length, 3);
  assert.deepEqual(body.evidence_references.map((row) => row.evidence_role), [
    'OPERATIVE_PROPOSITION',
    'OPERATIVE_PROPOSITION_CONTINUATION',
    'NESTED_DEFINITION_DEPENDENCY',
  ]);
  assert.deepEqual(body.bounded_inline_primitives.map((row) => row.primitive_kind), [
    'PARTY_TOKEN',
    'OPERATIVE_MODALITY',
    'TIME',
    'LEGAL_OBJECT',
    'DEFINITION_DEPENDENCY',
  ]);
  assert.equal(body.bounded_inline_primitives.some((row) => row.primitive_kind === 'KNOWLEDGE_QUALIFIER'), false);
  assert.equal(Object.hasOwn(body, 'concept_key'), false);
  assert.equal(Object.hasOwn(body, 'result_key'), false);
  assert.equal(Object.hasOwn(body, 'metric_key'), false);
  assert.equal(Object.hasOwn(body, 'party'), false);
  assert.equal(Object.hasOwn(body, 'unit'), false);
});

test('open-world source detail closes over the exact two-span proposition and nested Major Supplier definition', () => {
  const fixture = buildLandosSourceSpecificServingFixture();
  const response = fixture.exactDetail.detail_payloads[0].response_body;

  assert.equal(validateFixtureExactDetailPackage({
    package: fixture.exactDetail,
    contract_bundle: fixture.contract,
    source: fixture.source,
    source_admission: fixture.sourceAdmission,
    excerpts: Object.values(fixture.excerpts),
  }), true);
  assert.equal(response.detail_kind, 'OPEN_WORLD_EVIDENCE');
  assert.deepEqual(response.exact_excerpts.map((row) => row.exact_text), [
    'The Company has not, since January 1, 2021, subjected any Major Suppliers to,',
    'any corrective or preventative actions.',
    fixture.excerpts.definition.exact_text,
  ]);
  assert.match(response.exact_excerpts[2].exact_text, /each, a “Major Supplier”/);
  assert.equal(fixture.row.source_actions[0].detail_kind, 'OPEN_WORLD_EVIDENCE');
});

test('all four surfaces render the reviewed proposition as selected-deal context and never create a market cohort', () => {
  const fixture = buildLandosSourceSpecificServingFixture();
  const adapted = adaptSharedServingRow(fixture.row);

  assert.deepEqual(Object.keys(adapted.surface_bindings), SURFACES);
  assert.equal(adapted.resolution.selectedDealContextOnly, true);
  assert.equal(adapted.resolution.marketCohortEligible, false);
  assert.deepEqual(adapted.resolution.metrics, []);
  assert.equal(adapted.data.byRow[fixture.row.row_serving_key].sourceSpecific.state, 'reviewed_source_specific');
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].market_cohort_eligible, false);
  }
  assert.doesNotMatch(JSON.stringify(adapted), /No market data|not examined/i);
  assert.equal(Object.hasOwn(adapted.resolution.sourceSpecific, 'claimState'), false);
});

test('an unresolved unfamiliar candidate fails locally while recognised and reviewed source-specific siblings render', () => {
  const canonical = buildLandosReviewedServingFixture().row;
  const sourceSpecific = buildLandosSourceSpecificServingFixture().row;
  const rows = adaptSharedServingRows([
    canonical,
    { row_kind: 'UNRESOLVED_OPEN_WORLD_CANDIDATE' },
    sourceSpecific,
  ]);

  assert.deepEqual(rows.map((row) => row.render_kind), ['ROW', 'ROW_RENDER_FAILED', 'ROW']);
  assert.equal(rows[2].prepared.resolution.rowKind, 'REVIEWED_SOURCE_SPECIFIC');

  const unresolved = structuredClone(sourceSpecific);
  unresolved.reviewed_source_specific.final_disposition.review_state = 'UNRESOLVED';
  assert.throws(() => validateSharedServingRow(resign(unresolved)), /final disposition/);
});
