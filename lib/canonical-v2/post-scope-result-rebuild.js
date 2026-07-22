const { canonicalJson } = require('./canonical-bytes');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { claimPayloadDigest } = require('./post-scope-claim-correction');
const {
  buildFixtureResultComponent,
  projectMarketMetricSlot,
  validateProjectedMetricSlotOutput,
} = require('./serving-projection');
const {
  buildCanonicalResultServingRow,
  validateSharedServingRow,
} = require('./shared-serving-row');

class PostScopeResultRebuildError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PostScopeResultRebuildError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PostScopeResultRebuildError(code, message, details);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_REBUILD_INPUT', `${label} must be an object.`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function terminalProjectionRow(projection) {
  validateProjectedMetricSlotOutput(projection);
  return projection.observation || projection.exclusion;
}

function canonicalResultInput({ resultSpec, claim, contractBundle, deal }) {
  return {
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: terminalProjectionRow(resultSpec.projection).corpus_release_id,
    deal,
    concept_key: resultSpec.concept_key,
    metric_key: resultSpec.metric_key,
    party: resultSpec.party,
    result: resultSpec.result,
    claim,
    relationships: resultSpec.relationships,
    value_slot_key: resultSpec.value_slot_key,
    ordinal: resultSpec.ordinal,
  };
}

function assertCurrentResultSpec(resultSpec, contractBundle, deal) {
  requireObject(resultSpec, 'result_spec');
  requireObject(resultSpec.claim, 'result_spec.claim');
  requireObject(resultSpec.result, 'result_spec.result');
  requireObject(resultSpec.projection, 'result_spec.projection');
  if (!Array.isArray(resultSpec.relationships)) {
    fail('INVALID_REBUILD_INPUT', 'result_spec.relationships must be an array.');
  }
  let expectedResult;
  let expectedProjection;
  try {
    expectedResult = buildFixtureResultComponent({
      deal_admission_id: deal.deal_admission_id,
      result_key: resultSpec.result_key,
      result_version: resultSpec.result.result_version,
      concept_key: resultSpec.concept_key,
      party: resultSpec.party,
      value_slot_key: resultSpec.value_slot_key,
      ordinal: resultSpec.ordinal,
      claim: resultSpec.claim,
      relationships: resultSpec.relationships,
      composition_scope_closure_id: resultSpec.result.composition_scope_closure_id,
      completeness: resultSpec.result.completeness,
      comparability: resultSpec.result.comparability,
    });
    expectedProjection = projectMarketMetricSlot({
      ...canonicalResultInput({ resultSpec, claim: resultSpec.claim, contractBundle, deal }),
      result: expectedResult,
    });
  } catch (error) {
    fail('STALE_RESULT_LINEAGE', 'The reviewed result cannot be reproduced from its claimed inputs.', {
      cause: error.message,
    });
  }
  if (canonicalJson(resultSpec.result) !== canonicalJson(expectedResult)
    || canonicalJson(resultSpec.projection) !== canonicalJson(expectedProjection)) {
    fail('STALE_RESULT_LINEAGE', 'The reviewed result or projection has stale input lineage.');
  }
}

function assertCorrectionOutput(correctionOutput, resultSpec) {
  requireObject(correctionOutput, 'correction_output');
  const predecessor = requireObject(
    correctionOutput.predecessor_claim_revision,
    'correction_output.predecessor_claim_revision',
  );
  const successor = requireObject(
    correctionOutput.successor_claim_revision,
    'correction_output.successor_claim_revision',
  );
  const lineage = requireObject(correctionOutput.lineage, 'correction_output.lineage');
  const affected = correctionOutput.application?.affected_subject;
  if (!affected || affected.claim_occurrence_id !== predecessor.claim_occurrence_id
    || lineage.predecessor_claim_revision_id !== predecessor.claim_revision_id
    || lineage.successor_claim_revision_id !== successor.claim_revision_id
    || successor.claim_occurrence_id !== predecessor.claim_occurrence_id) {
    fail('INVALID_CORRECTION_OUTPUT', 'Correction output does not close over one stable claim occurrence.');
  }
  if (predecessor.claim_occurrence_id !== resultSpec.claim.claim_occurrence_id) {
    fail('CORRECTION_TARGET_OUTSIDE_RESULT', 'Correction targets a claim outside the reviewed result.');
  }
  if (predecessor.claim_revision_id !== resultSpec.claim.claim_revision_id
    || claimPayloadDigest(predecessor) !== claimPayloadDigest(resultSpec.claim)
    || !resultSpec.result.claim_revision_ids.includes(predecessor.claim_revision_id)) {
    fail('STALE_RESULT_LINEAGE', 'Correction predecessor is not the current reviewed result input.');
  }
  const publishableClaims = correctionOutput.validation?.publishableWriteSet?.claims;
  const correctedClaims = correctionOutput.corrected_write_set?.claims;
  const successorIsPublishable = successor.publication_state === 'VALIDATED'
    && Array.isArray(successor.retained_residuals)
    && successor.retained_residuals.length === 0
    && Array.isArray(publishableClaims)
    && publishableClaims.some((claim) => canonicalJson(claim) === canonicalJson(successor))
    && Array.isArray(correctedClaims)
    && correctedClaims.some((claim) => canonicalJson(claim) === canonicalJson(successor));
  if (!successorIsPublishable) {
    fail('CORRECTED_CLAIM_NOT_PUBLISHABLE', 'Corrected claim is quarantined or absent from the publishable write set.');
  }
  return successor;
}

function cohortResultFromRow(sharedRow, cohortRequest) {
  const compiled = compileMarketCohortRequest(cohortRequest);
  const body = sharedRow.canonical_result;
  const context = body.market_context;
  if (compiled.corpus_release_id !== sharedRow.corpus_release_id
    || compiled.contract_fingerprint !== sharedRow.provenance.contract_fingerprint
    || compiled.metric_key !== context.metric_key
    || compiled.metric_version !== context.metric_version
    || compiled.concept_key !== body.concept_key
    || compiled.subject_deal_key !== sharedRow.governed_deal_key
    || compiled.cohort_digest !== context.cohort.cohort_digest
    || canonicalJson(compiled.party) !== canonicalJson(body.party)) {
    fail('STALE_COHORT_CONTEXT', 'Cohort request does not reproduce the reviewed row cohort.');
  }
  return {
    schema_version: 'MARKET_COHORT_RESULT/V1',
    serving_namespace_id: compiled.serving_namespace_id,
    corpus_release_id: compiled.corpus_release_id,
    contract_fingerprint: compiled.contract_fingerprint,
    cohort_digest: compiled.cohort_digest,
    metric_key: compiled.metric_key,
    metric_version: compiled.metric_version,
    concept_key: compiled.concept_key,
    subject_deal_key: compiled.subject_deal_key,
    counts: clone(context.cohort.counts),
    distribution: clone(context.cohort.distribution),
    exclusions: clone(context.cohort.exclusions),
  };
}

function assertSharedRowMatchesResult(sharedRow, resultSpec) {
  try {
    validateSharedServingRow(sharedRow);
  } catch (error) {
    fail('STALE_SHARED_ROW', 'Existing shared row is invalid.', { cause: error.message });
  }
  const component = sharedRow.canonical_result?.components?.[0];
  const observation = resultSpec.projection.observation;
  if (!component || !observation
    || component.claim_occurrence_id !== resultSpec.claim.claim_occurrence_id
    || component.claim_revision_id !== resultSpec.claim.claim_revision_id
    || component.component_revision_id !== resultSpec.result.component_revision_id
    || sharedRow.provenance.market_observation_serving_key !== observation.market_observation_serving_key
    || sharedRow.provenance.owner_revision_id !== resultSpec.result.component_revision_id) {
    fail('STALE_SHARED_ROW', 'Existing shared row does not close over the reviewed result.');
  }
}

function rebuildReviewedResultAfterClaimCorrection({
  result_spec: resultSpec,
  correction_output: correctionOutput,
  contract_bundle: contractBundle,
  deal,
  shared_row: sharedRow,
  cohort_request: cohortRequest,
} = {}) {
  requireObject(contractBundle, 'contract_bundle');
  requireObject(deal, 'deal');
  requireObject(sharedRow, 'shared_row');
  requireObject(cohortRequest, 'cohort_request');
  assertCurrentResultSpec(resultSpec, contractBundle, deal);
  const successor = assertCorrectionOutput(correctionOutput, resultSpec);
  assertSharedRowMatchesResult(sharedRow, resultSpec);

  const result = buildFixtureResultComponent({
    deal_admission_id: deal.deal_admission_id,
    result_key: resultSpec.result_key,
    result_version: resultSpec.result.result_version,
    concept_key: resultSpec.concept_key,
    party: resultSpec.party,
    value_slot_key: resultSpec.value_slot_key,
    ordinal: resultSpec.ordinal,
    claim: successor,
    relationships: resultSpec.relationships,
    composition_scope_closure_id: resultSpec.result.composition_scope_closure_id,
    completeness: resultSpec.result.completeness,
    comparability: resultSpec.result.comparability,
  });
  const rebuiltSpec = {
    ...resultSpec,
    claim: successor,
    result,
  };
  const projection = projectMarketMetricSlot({
    ...canonicalResultInput({ resultSpec: rebuiltSpec, claim: successor, contractBundle, deal }),
    result,
  });
  if (!projection.observation) {
    fail('CORRECTED_RESULT_NOT_COMPARABLE', 'Corrected claim cannot produce the existing comparable result slot.', {
      exclusion_reason: projection.exclusion?.exclusion_reason,
    });
  }
  rebuiltSpec.projection = projection;

  const cohortResult = cohortResultFromRow(sharedRow, cohortRequest);
  let rebuiltSharedRow;
  try {
    rebuiltSharedRow = buildCanonicalResultServingRow({
      contract_bundle: contractBundle,
      frozen_pair_id: sharedRow.frozen_pair_id,
      projection_output: projection,
      cohort_request: cohortRequest,
      cohort_result: cohortResult,
      result_ordinal: sharedRow.canonical_result.result_ordinal,
    });
  } catch (error) {
    fail('CORRECTED_SHARED_ROW_INVALID', 'Corrected result cannot produce a valid shared row.', {
      cause: error.message,
    });
  }

  return Object.freeze({
    result_spec: Object.freeze(rebuiltSpec),
    projection_output: projection,
    shared_row: rebuiltSharedRow,
  });
}

function rebuildReviewedResultCollectionAfterClaimCorrection({
  reviewed_results: reviewedResults,
  shared_rows: sharedRows,
  correction_output: correctionOutput,
  ...context
} = {}) {
  if (!Array.isArray(reviewedResults) || !Array.isArray(sharedRows)) {
    fail('INVALID_REBUILD_INPUT', 'reviewed_results and shared_rows must be arrays.');
  }
  const targetOccurrenceId = correctionOutput?.application?.affected_subject?.claim_occurrence_id;
  const resultIndexes = reviewedResults
    .map((result, index) => (result?.claim?.claim_occurrence_id === targetOccurrenceId ? index : -1))
    .filter((index) => index !== -1);
  const rowIndexes = sharedRows
    .map((row, index) => (
      row?.canonical_result?.components?.[0]?.claim_occurrence_id === targetOccurrenceId ? index : -1
    ))
    .filter((index) => index !== -1);
  if (resultIndexes.length !== 1 || rowIndexes.length !== 1) {
    fail('CORRECTION_TARGET_OUTSIDE_RESULT', 'Correction target must resolve to exactly one reviewed result and shared row.');
  }
  const resultIndex = resultIndexes[0];
  const rowIndex = rowIndexes[0];
  const rebuilt = rebuildReviewedResultAfterClaimCorrection({
    ...context,
    result_spec: reviewedResults[resultIndex],
    shared_row: sharedRows[rowIndex],
    correction_output: correctionOutput,
  });
  const nextResults = reviewedResults.slice();
  const nextRows = sharedRows.slice();
  nextResults[resultIndex] = rebuilt.result_spec;
  nextRows[rowIndex] = rebuilt.shared_row;
  return Object.freeze({
    reviewed_results: Object.freeze(nextResults),
    shared_rows: Object.freeze(nextRows),
    rebuilt,
  });
}

module.exports = {
  PostScopeResultRebuildError,
  rebuildReviewedResultAfterClaimCorrection,
  rebuildReviewedResultCollectionAfterClaimCorrection,
};
