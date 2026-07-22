const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosReviewedServingFixture } = require('../__fixtures__/canonical-v2/landos-reviewed-row');
const { buildLandosSourceSpecificServingFixture } = require('../__fixtures__/canonical-v2/landos-source-specific-row');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const { adaptSharedServingRow, adaptSharedServingRows, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');

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
  assert.equal(fixture.validatedSemanticGraph.definition_cues.length, 1);
  assert.equal(fixture.validatedSemanticGraph.definition_cues[0].raw_term, 'Major Supplier');
  assert.deepEqual(fixture.validatedSemanticGraph.definition_use_cues.map((cue) => cue.use_role), [
    'OPERATIVE_REFERENCE',
    'DECLARATION_REFERENCE',
  ]);
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
  assert.equal(adapted.resolution.rowKey, adapted.row_key);
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

test('the authoritative writer commits the complete reviewed open-world graph in one transaction', async () => {
  const fixture = buildLandosSourceSpecificServingFixture();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: fixture.contract });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-source-specific',
    writeSet: fixture.canonicalWriteSet,
  });
  const state = repository.snapshot();

  assert.equal(result.validation.counts.publishable, 17);
  assert.equal(result.validation.counts.residuals, 0);
  assert.equal(repository.transactionCount, 1);
  assert.equal(state.open_world_candidates.length, 1);
  assert.equal(state.open_world_candidate_occurrences.length, 1);
  assert.equal(state.open_world_evidence_references.length, 3);
  assert.equal(state.open_world_candidate_dispositions.length, 1);
  assert.equal(state.open_world_primitives.length, 5);
  assert.equal(state.semantic_impact_closures.length, 1);
  assert.equal(state.validated_semantic_graphs.length, 1);
  assert.equal(
    state.validated_semantic_graphs[0].validated_semantic_graph_id,
    fixture.validatedSemanticGraph.validated_semantic_graph_id,
  );
  assert.equal(state.reviewed_source_specific_rows.length, 1);
  assert.equal(
    state.reviewed_source_specific_rows[0].shared_serving_row.row_serving_key,
    fixture.row.row_serving_key,
  );
});

test('an invalid open-world disposition quarantines only its closure and leaves familiar siblings publishable', async () => {
  const sourceSpecific = buildLandosSourceSpecificServingFixture();
  const familiar = buildLandosReviewedServingFixture();
  const writeSet = structuredClone(familiar.canonicalWriteSet);
  for (const key of [
    'open_world_candidates',
    'open_world_candidate_occurrences',
    'open_world_evidence_references',
    'open_world_candidate_dispositions',
    'open_world_primitives',
    'semantic_impact_closures',
    'reviewed_source_specific_rows',
    'validated_semantic_graphs',
  ]) writeSet[key] = structuredClone(sourceSpecific.canonicalWriteSet[key]);
  writeSet.excerpts.push(...structuredClone(sourceSpecific.canonicalWriteSet.excerpts));
  writeSet.open_world_candidate_dispositions[0].review_state = 'UNRESOLVED';

  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: sourceSpecific.contract });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-source-specific-quarantine',
    writeSet,
  });
  const state = repository.snapshot();

  assert.deepEqual(result.validation.quarantinedClosureIds, [sourceSpecific.closureId]);
  assert.equal(result.validation.residuals[0].reason_code, 'CANONICAL_IDENTITY_MISMATCH');
  assert.equal(state.open_world_candidates.length, 0);
  assert.equal(state.reviewed_source_specific_rows.length, 0);
  assert.equal(state.validated_semantic_graphs.length, 0);
  assert.ok(state.claims.length > 0);
  assert.ok(state.relationships.length > 0);
  assert.ok(state.excerpts.some((row) => row.closure_id !== sourceSpecific.closureId));
});

test('an invalid nested-definition graph quarantines only its source-specific closure', async () => {
  const sourceSpecific = buildLandosSourceSpecificServingFixture();
  const familiar = buildLandosReviewedServingFixture();
  const writeSet = structuredClone(familiar.canonicalWriteSet);
  for (const key of [
    'open_world_candidates',
    'open_world_candidate_occurrences',
    'open_world_evidence_references',
    'open_world_candidate_dispositions',
    'open_world_primitives',
    'semantic_impact_closures',
    'reviewed_source_specific_rows',
    'validated_semantic_graphs',
  ]) writeSet[key] = structuredClone(sourceSpecific.canonicalWriteSet[key]);
  writeSet.excerpts.push(...structuredClone(sourceSpecific.canonicalWriteSet.excerpts));
  writeSet.validated_semantic_graphs[0].definition_use_cues[0].definition_cue_id = contentId(
    'UNKNOWN_DEFINITION_CUE/V1',
    'not-in-graph',
  );

  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: sourceSpecific.contract });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-invalid-definition-graph',
    writeSet,
  });
  const state = repository.snapshot();

  assert.deepEqual(result.validation.quarantinedClosureIds, [sourceSpecific.closureId]);
  assert.equal(state.validated_semantic_graphs.length, 0);
  assert.equal(state.open_world_candidates.length, 0);
  assert.ok(state.claims.length > 0);
  assert.ok(state.relationships.length > 0);
});

test('duplicate or conflicting graph identity cannot enter the canonical collection', async () => {
  const fixture = buildLandosSourceSpecificServingFixture();
  const writeSet = structuredClone(fixture.canonicalWriteSet);
  const conflicting = structuredClone(writeSet.validated_semantic_graphs[0]);
  conflicting.definition_cue_ids = [];
  writeSet.validated_semantic_graphs.push(conflicting);
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle: fixture.contract });
  const result = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-conflicting-definition-graph',
    writeSet,
  });

  assert.deepEqual(result.validation.quarantinedClosureIds, [fixture.closureId]);
  assert.equal(repository.snapshot().validated_semantic_graphs.length, 0);
  assert.ok(result.validation.residuals.every((residual) => (
    residual.reason_code === 'CANONICAL_IDENTITY_MISMATCH'
  )));
});
