const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildFixtureClaimEvidenceDetailPackage, validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  buildReviewedCapitalisationServingRow,
  buildReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-capitalisation-slice');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
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
  assert.equal(first.knowledgeClaim.state, 'ABSENT');
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
  assert.deepEqual(
    slice.knowledgeClaim.scope.required_interval_ids,
    [repA.excerpt_id, repC.excerpt_id].sort(),
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
  assert.equal(dryRun.validation.counts.publishable, 11);
  assert.equal(dryRun.validation.counts.residuals, 0);
  assert.equal(repository.transactionCount, 0);

  const committed = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-capitalisation-v1',
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(committed.receipt.status, 'COMMITTED');
  assert.equal(repository.transactionCount, 1);
  assert.equal(repository.snapshot().claims.length, 3);
  assert.equal(repository.snapshot().relationships.length, 1);
});

test('the real claim produces a comparable market observation, shared row and exact source detail', () => {
  const slice = build();
  assert.equal(slice.projection.exclusion, null);
  assert.equal(slice.projection.observation.canonical_value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.equal(validateProjectedMetricSlotOutput(slice.projection), true);

  const serving = buildReviewedCapitalisationServingRow({ slice, contractBundle });
  assert.equal(validateSharedServingRow(serving.row), true);
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
