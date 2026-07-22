const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildFixtureClaimEvidenceDetailPackage,
  buildFixtureResultCompositionDetailPackage,
  validateFixtureExactDetailPackage,
} = require('../lib/canonical-v2/exact-detail');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  buildReviewedCapitalisationServingRow,
  buildReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-capitalisation-slice');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const sourceText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const contractBundle = compileFixtureContract();

function build() {
  return buildReviewedCapitalisationSlice({ sourceText, contractBundle });
}

test('real Landos source becomes one deterministic reviewed capitalisation bring-down result', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.proposalEnvelope.diagnostics.region_coverage_complete, true);
  assert.equal(first.proposalEnvelope.section_proposals.length, 92);
  assert.equal(first.reviewed_mapping.structural_section_proposal_ids.length, 2);
  assert.equal(first.accuracyClaim.canonical_value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.equal(first.exceptionClaim.canonical_value, 'DE_MINIMIS_INACCURACIES');
  assert.deepEqual(first.knowledgeClaims.map((claim) => claim.state), ['ABSENT', 'ABSENT']);
  assert.equal(first.relationship.effect.legal_operation, 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING');
  assert.deepEqual(first.relationship.effect.time_points, [
    'SIGNING',
    'CLOSING',
    'EXPRESS_EARLIER_DATE_IF_APPLICABLE',
  ]);
});

test('the result composes the condition with two non-contiguous representation limbs', () => {
  const slice = build();
  const repA = slice.excerpts.rep_a;
  const repC = slice.excerpts.rep_c_first_sentence;
  assert.ok(repA.absolute_end < repC.absolute_start);
  assert.deepEqual(slice.knowledgeClaims.map((claim) => claim.scope.required_interval_ids), [
    [repA.excerpt_id],
    [repC.excerpt_id],
  ]);
  assert.deepEqual(
    slice.relationship.target_occurrence_ids,
    slice.representationComponents.map((component) => component.provision_component_id),
  );
  assert.deepEqual(
    slice.relationship.scope.target_interval_ids,
    [repA.excerpt_id, repC.excerpt_id].sort(),
  );
  assert.equal(slice.relationship.evidence.length, 3);
  assert.ok(slice.relationship.evidence.some((row) => row.excerpt_id === slice.excerpts.condition_tier.excerpt_id));
});

test('the reviewed mapping fails closed for source drift', () => {
  const changed = sourceText.replace('20,000,000 shares', '20,000,001 shares');
  assert.throws(
    () => buildReviewedCapitalisationSlice({ sourceText: changed, contractBundle }),
    /source hash mismatch/,
  );
});

test('the real legal slice dry-runs and commits through the one authoritative writer without residuals', async () => {
  const slice = build();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const dryRun = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-capitalisation-v1',
    dryRun: true,
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(dryRun.validation.counts.publishable, 14);
  assert.equal(dryRun.validation.counts.residuals, 0);
  assert.equal(repository.transactionCount, 0);

  const committed = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-capitalisation-v1',
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(committed.receipt.status, 'COMMITTED');
  assert.equal(repository.transactionCount, 1);
  assert.equal(repository.snapshot().components.length, 2);
  assert.equal(repository.snapshot().claims.length, 4);
  assert.equal(repository.snapshot().relationships.length, 1);
});

test('the real claim produces a comparable market observation, shared row and exact source detail', () => {
  const slice = build();
  assert.equal(slice.projection.exclusion, null);
  assert.equal(slice.projection.observation.canonical_value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.equal(validateProjectedMetricSlotOutput(slice.projection), true);

  const serving = buildReviewedCapitalisationServingRow({ slice, contractBundle });
  assert.equal(validateSharedServingRow(serving.row), true);
  assert.deepEqual(serving.row.canonical_result.components.map((component) => ({
    slot: component.component_slot_key,
    state: component.component_state,
  })), [
    { slot: 'ACCURACY_TIER_A', state: 'PRESENT' },
    { slot: 'ACCURACY_EXCEPTION', state: 'PRESENT' },
    { slot: 'KNOWLEDGE_QUALIFIER_1', state: 'ABSENT' },
    { slot: 'KNOWLEDGE_QUALIFIER_2', state: 'ABSENT' },
  ]);
  const legalTerms = adaptSharedServingRow(serving.row)
    .data.byRow[serving.row.row_serving_key]
    .metrics.REPRESENTATION_ACCURACY_STANDARD.subject.legalTerms;
  assert.ok(legalTerms.some((term) => term.key === 'exception' && term.value === 'De minimis inaccuracies'));
  assert.deepEqual(legalTerms.filter((term) => term.key.startsWith('knowledge_qualifier_')).map((term) => ({
    label: term.label,
    value: term.value,
  })), [
    { label: 'Capitalization, Section 3.3(a)', value: 'No knowledge qualifier' },
    { label: 'Capitalization, Section 3.3(c), first sentence', value: 'No knowledge qualifier' },
  ]);
  assert.deepEqual(serving.cohortResult.distribution, [{
    canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    subject_count: 1,
    deal_count: 1,
  }]);
  const exactDetail = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contractBundle,
    row: serving.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    excerpt: slice.excerpts.accuracy_standard,
    claim: slice.accuracyClaim,
  });
  assert.equal(
    exactDetail.detail_payloads[0].response_body.excerpt.exact_text,
    'true and correct except for de minimis inaccuracies',
  );
  assert.equal(validateFixtureExactDetailPackage({
    package: exactDetail,
    contract_bundle: contractBundle,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    excerpt: slice.excerpts.accuracy_standard,
    claim: slice.accuracyClaim,
  }), true);
});

test('one bounded detail action closes over every representation component and the non-contiguous bring-down evidence', () => {
  const slice = build();
  const serving = buildReviewedCapitalisationServingRow({ slice, contractBundle });
  const components = [
    { component: slice.result, claim: slice.accuracyClaim, relationships: [slice.relationship] },
    ...slice.contextComponents,
  ];
  const excerpts = Object.values(slice.excerpts).sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
  const detail = buildFixtureResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: serving.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    components,
    relationship_targets: slice.representationComponents,
    excerpts,
  });
  const payload = detail.detail_payloads[0];
  const body = payload.response_body;
  assert.equal(detail.row.source_actions[0].action_slot_key, 'RESULT_COMPOSITION_EVIDENCE');
  assert.equal(payload.encoded_byte_length <= detail.action_definitions[0].maximum_encoded_bytes, true);
  assert.deepEqual(body.components.map((component) => ({
    slot: component.component_slot_key,
    state: component.claim.state,
    evidence: component.claim.evidence_references.length,
    scope: component.claim.scope_excerpt_ids.length,
  })), [
    { slot: 'ACCURACY_TIER_A', state: 'PRESENT', evidence: 1, scope: 0 },
    { slot: 'ACCURACY_EXCEPTION', state: 'PRESENT', evidence: 1, scope: 0 },
    { slot: 'KNOWLEDGE_QUALIFIER_1', state: 'ABSENT', evidence: 0, scope: 1 },
    { slot: 'KNOWLEDGE_QUALIFIER_2', state: 'ABSENT', evidence: 0, scope: 1 },
  ]);
  assert.equal(body.relationships.length, 1);
  assert.equal(body.relationships[0].relationship_definition_key, 'BRINGS_DOWN');
  assert.deepEqual(
    body.relationships[0].target_occurrence_ids,
    slice.representationComponents.map((component) => component.provision_component_id),
  );
  assert.deepEqual(body.relationships[0].effect, slice.relationship.effect);
  assert.deepEqual(
    body.relationships[0].evidence_references.map((edge) => edge.excerpt_id),
    slice.relationship.evidence.map((edge) => edge.excerpt_id),
  );
  assert.equal(body.excerpts.length, 5);
  assert.ok(body.excerpts.some((excerpt) => excerpt.excerpt_id === slice.excerpts.rep_a.excerpt_id));
  assert.ok(body.excerpts.some((excerpt) => excerpt.excerpt_id === slice.excerpts.rep_c_first_sentence.excerpt_id));
  assert.ok(body.excerpts.some((excerpt) => excerpt.excerpt_id === slice.excerpts.condition_tier.excerpt_id));
  assert.equal(validateFixtureExactDetailPackage({
    package: detail,
    contract_bundle: contractBundle,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    components,
    relationship_targets: slice.representationComponents,
    excerpts,
  }), true);

  assert.throws(() => buildFixtureResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: serving.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    components,
    relationship_targets: [...slice.representationComponents].reverse(),
    excerpts,
  }), /governed order/);
  assert.throws(() => buildFixtureResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: serving.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    components,
    relationship_targets: slice.representationComponents,
    excerpts: excerpts.filter((excerpt) => excerpt.excerpt_id !== slice.excerpts.rep_c_first_sentence.excerpt_id),
  }), /excerpt closure/);
});

test('component order, identities and scoped absence fail closed independently of the market subject', () => {
  const slice = build();
  const { row } = buildReviewedCapitalisationServingRow({ slice, contractBundle });
  const reordered = JSON.parse(JSON.stringify(row));
  [reordered.canonical_result.components[1], reordered.canonical_result.components[2]] = [
    reordered.canonical_result.components[2],
    reordered.canonical_result.components[1],
  ];
  assert.throws(() => validateSharedServingRow(reordered), /unique governed sequence/);

  const unscoped = JSON.parse(JSON.stringify(row));
  unscoped.canonical_result.components[2].claim_scope.coverage_status = 'PARTIAL';
  assert.throws(() => validateSharedServingRow(unscoped), /complete exact scope/);

  const drifted = JSON.parse(JSON.stringify(row));
  drifted.canonical_result.components[3].component_revision_id = '0'.repeat(64);
  assert.throws(() => validateSharedServingRow(drifted), /component revision identity/);
});
