const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  applyApprovedPostScopeClaimCorrection,
  buildCorrectionApprovalAttestation,
  buildPostScopeClaimCorrection,
  claimPayloadDigest,
} = require('../lib/canonical-v2/post-scope-claim-correction');
const {
  rebuildReviewedResultAfterClaimCorrection,
  rebuildReviewedResultCollectionAfterClaimCorrection,
} = require('../lib/canonical-v2/post-scope-result-rebuild');
const {
  buildReviewedNoShopServingRows,
  buildReviewedNoShopSlice,
} = require('../lib/canonical-v2/reviewed-no-shop-slice');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const sourceText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const contractBundle = compileFixtureContract();
const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture');
const id = (value) => contentId('POST_SCOPE_RESULT_REBUILD_TEST/V1', value);

function fixture() {
  const slice = buildReviewedNoShopSlice({ sourceText, contractBundle });
  return {
    slice,
    rows: buildReviewedNoShopServingRows({ slice, contractBundle }),
  };
}

function targetFor(writeSet, claim) {
  return {
    deal_key: writeSet.deal.deal_key,
    deal_admission_id: writeSet.deal.deal_admission_id,
    document_hash: writeSet.deal.document_hash,
    subject_occurrence_id: claim.subject_occurrence_id,
    claim_occurrence_id: claim.claim_occurrence_id,
    expected_claim_revision_id: claim.claim_revision_id,
    expected_claim_payload_digest: claimPayloadDigest(claim),
  };
}

function approve(correction) {
  return buildCorrectionApprovalAttestation({
    correction,
    reviewer_id: 'reviewer:legal-semantic',
    reviewer_eligibility_evidence_digest: id('reviewer-eligibility'),
    authorisation_evidence_digest: id('authorisation'),
    decision: 'PASS',
    reason_digest: id('approved'),
  });
}

function applyCorrection(writeSet, claim, patch) {
  const correction = buildPostScopeClaimCorrection({
    target: targetFor(writeSet, claim),
    patch,
  });
  return applyApprovedPostScopeClaimCorrection({
    writeSet,
    correction,
    approval: approve(correction),
    contractBundle,
  });
}

function noticeCorrection(slice) {
  return applyCorrection(slice.canonicalWriteSet, slice.durationClaims.notice, {
    raw_value: 'within thirty-six (36) hours',
    canonical_value: '1.5',
    normalisation_version: 'reviewed-correction/v1',
    derivation_version: 'reviewed-correction/v1',
  });
}

function cohortRequestFor(row) {
  return {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: row.canonical_result.market_context.metric_key,
    metric_version: row.canonical_result.market_context.metric_version,
    concept_key: row.canonical_result.concept_key,
    party: row.canonical_result.party,
    subject_deal_key: row.governed_deal_key,
    filters: {},
  };
}

function noticeResult(slice) {
  return slice.results.find((result) => result.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS');
}

function noticeRow(rows) {
  return rows.find((row) => (
    row.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS'
  ));
}

test('one approved Landos notice correction deterministically rebuilds lineage, projection and shared row', () => {
  const { slice, rows } = fixture();
  const originalResult = noticeResult(slice);
  const originalRow = noticeRow(rows);
  const correctionOutput = noticeCorrection(slice);
  const input = {
    result_spec: originalResult,
    correction_output: correctionOutput,
    contract_bundle: contractBundle,
    deal: slice.canonicalWriteSet.deal,
    shared_row: originalRow,
    cohort_request: cohortRequestFor(originalRow),
  };

  const first = rebuildReviewedResultAfterClaimCorrection(input);
  const second = rebuildReviewedResultAfterClaimCorrection(input);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(validateProjectedMetricSlotOutput(first.projection_output), true);
  assert.equal(validateSharedServingRow(first.shared_row), true);

  const next = first.result_spec;
  assert.equal(next.claim.claim_occurrence_id, originalResult.claim.claim_occurrence_id);
  assert.notEqual(next.claim.claim_revision_id, originalResult.claim.claim_revision_id);
  assert.equal(next.claim.canonical_value, '1.5');
  assert.equal(next.result.component_occurrence_id, originalResult.result.component_occurrence_id);
  assert.notEqual(next.result.input_lineage_digest, originalResult.result.input_lineage_digest);
  assert.notEqual(next.result.component_revision_id, originalResult.result.component_revision_id);

  const priorObservation = originalResult.projection.observation;
  const nextObservation = first.projection_output.observation;
  assert.equal(nextObservation.metric_slot_key, priorObservation.metric_slot_key);
  assert.equal(nextObservation.metric_observation_occurrence_id, priorObservation.metric_observation_occurrence_id);
  assert.equal(nextObservation.market_observation_serving_key, priorObservation.market_observation_serving_key);
  assert.notEqual(nextObservation.canonical_payload_digest, priorObservation.canonical_payload_digest);
  assert.equal(nextObservation.canonical_value, '1.5');

  assert.equal(first.shared_row.row_serving_key, originalRow.row_serving_key);
  assert.equal(
    first.shared_row.canonical_result.derived_result_occurrence_id,
    originalRow.canonical_result.derived_result_occurrence_id,
  );
  assert.notEqual(
    first.shared_row.canonical_result.derived_result_revision_id,
    originalRow.canonical_result.derived_result_revision_id,
  );
  assert.notEqual(first.shared_row.canonical_payload_digest, originalRow.canonical_payload_digest);
  assert.equal(
    first.shared_row.canonical_result.market_context.subject_observation.canonical_value,
    '1.5',
  );
});

test('collection rebuild replaces one claim result and leaves every sibling byte-identical', () => {
  const { slice, rows } = fixture();
  const originalResults = slice.results.map(canonicalJson);
  const originalRows = rows.map(canonicalJson);
  const targetResultIndex = slice.results.indexOf(noticeResult(slice));
  const targetRowIndex = rows.indexOf(noticeRow(rows));
  const rebuilt = rebuildReviewedResultCollectionAfterClaimCorrection({
    reviewed_results: slice.results,
    shared_rows: rows,
    correction_output: noticeCorrection(slice),
    contract_bundle: contractBundle,
    deal: slice.canonicalWriteSet.deal,
    cohort_request: cohortRequestFor(rows[targetRowIndex]),
  });

  assert.equal(rebuilt.reviewed_results.length, slice.results.length);
  assert.equal(rebuilt.shared_rows.length, rows.length);
  for (const [index, result] of rebuilt.reviewed_results.entries()) {
    if (index === targetResultIndex) assert.notEqual(canonicalJson(result), originalResults[index]);
    else {
      assert.equal(result, slice.results[index]);
      assert.equal(canonicalJson(result), originalResults[index]);
    }
  }
  for (const [index, row] of rebuilt.shared_rows.entries()) {
    if (index === targetRowIndex) assert.notEqual(canonicalJson(row), originalRows[index]);
    else {
      assert.equal(row, rows[index]);
      assert.equal(canonicalJson(row), originalRows[index]);
    }
  }
});

test('stale result lineage and corrections targeting another result fail closed', () => {
  const { slice, rows } = fixture();
  const originalResult = noticeResult(slice);
  const originalRow = noticeRow(rows);
  const firstCorrection = noticeCorrection(slice);
  const secondCorrection = applyCorrection(
    firstCorrection.corrected_write_set,
    firstCorrection.successor_claim_revision,
    { canonical_value: '2', derivation_version: 'reviewed-correction/v2' },
  );
  const base = {
    result_spec: originalResult,
    contract_bundle: contractBundle,
    deal: slice.canonicalWriteSet.deal,
    shared_row: originalRow,
    cohort_request: cohortRequestFor(originalRow),
  };
  assert.throws(() => rebuildReviewedResultAfterClaimCorrection({
    ...base,
    correction_output: secondCorrection,
  }), (error) => error.code === 'STALE_RESULT_LINEAGE');

  const otherResult = slice.results.find(
    (result) => result.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  const otherRow = rows.find(
    (row) => row.canonical_result.market_context.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  );
  assert.throws(() => rebuildReviewedResultAfterClaimCorrection({
    ...base,
    result_spec: otherResult,
    shared_row: otherRow,
    cohort_request: cohortRequestFor(otherRow),
    correction_output: firstCorrection,
  }), (error) => error.code === 'CORRECTION_TARGET_OUTSIDE_RESULT');
});

test('a quarantined or omitted correction successor cannot enter result or serving projections', () => {
  const { slice, rows } = fixture();
  const originalResult = noticeResult(slice);
  const originalRow = noticeRow(rows);
  const base = {
    result_spec: originalResult,
    contract_bundle: contractBundle,
    deal: slice.canonicalWriteSet.deal,
    shared_row: originalRow,
    cohort_request: cohortRequestFor(originalRow),
  };
  const quarantined = structuredClone(noticeCorrection(slice));
  quarantined.successor_claim_revision.publication_state = 'QUARANTINED';
  assert.throws(() => rebuildReviewedResultAfterClaimCorrection({
    ...base,
    correction_output: quarantined,
  }), (error) => error.code === 'CORRECTED_CLAIM_NOT_PUBLISHABLE');

  const omitted = structuredClone(noticeCorrection(slice));
  omitted.validation.publishableWriteSet.claims = omitted.validation.publishableWriteSet.claims.filter(
    (claim) => claim.claim_revision_id !== omitted.successor_claim_revision.claim_revision_id,
  );
  assert.throws(() => rebuildReviewedResultAfterClaimCorrection({
    ...base,
    correction_output: omitted,
  }), (error) => error.code === 'CORRECTED_CLAIM_NOT_PUBLISHABLE');
});
