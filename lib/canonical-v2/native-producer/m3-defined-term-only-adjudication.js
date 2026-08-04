'use strict';

const { contentId } = require('../canonical-bytes');

const ADJUDICATION_SCHEMA = 'M3_DEFINED_TERM_ONLY_ADJUDICATION/V1';
const DEFINED_TERM_ONLY_REASONS = new Set(['NO_MONEY_LITERAL', 'NO_RATIO_LITERAL']);

function fail(message) {
  throw new TypeError(message);
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value) fail(`${name} must be a non-empty string`);
  return value;
}

function buildDefinedTermOnlyAdjudication({
  execution_result_id: executionResultId,
  work_item_id: workItemId,
  run_receipt: runReceipt,
  resolution,
  independent_review_finding: reviewFinding,
} = {}) {
  requireText(executionResultId, 'execution_result_id');
  requireText(workItemId, 'work_item_id');
  if (!runReceipt || !Array.isArray(runReceipt.compiled_candidates)) fail('run_receipt.compiled_candidates must be an array');
  if (!resolution || !Array.isArray(resolution.review_queue)) fail('resolution.review_queue must be an array');
  if (!reviewFinding || reviewFinding.reviewer_kind !== 'INDEPENDENT' || reviewFinding.status !== 'PASS') {
    fail('independent_review_finding must be an independent PASS');
  }

  const candidatesByOccurrenceId = new Map(
    runReceipt.compiled_candidates
      .filter((entry) => entry?.ok === true && entry.candidate?.kind === 'claim')
      .map((entry) => [entry.candidate.claim.claim_occurrence_id, entry.candidate.claim]),
  );
  const queueItems = resolution.review_queue.filter((entry) => entry.has_resolution === false);
  if (!queueItems.length) fail('resolution has no unresolved review items');

  const items = queueItems.map((queueItem) => {
    if (queueItem.generic_claim_key !== 'NATIVE_CONSIDERATION_CANDIDATE'
      || queueItem.reasons.length !== 1
      || !DEFINED_TERM_ONLY_REASONS.has(queueItem.reasons[0])) {
      fail('review queue contains a non-defined-term-only item');
    }
    const claim = candidatesByOccurrenceId.get(queueItem.original_claim_occurrence_id);
    if (!claim || claim.canonical_value !== null) fail('adjudicated claim must have no canonical literal');
    const attrs = claim.attributes || {};
    const namedTerm = queueItem.reasons[0] === 'NO_RATIO_LITERAL'
      ? attrs.ratio_term_ref
      : attrs.consideration_term_ref;
    if (typeof namedTerm !== 'string' || !namedTerm || !claim.raw_value.includes(namedTerm)) {
      fail('adjudicated claim must contain its named term verbatim');
    }
    return Object.freeze({
      original_claim_occurrence_id: claim.claim_occurrence_id,
      closure_id: claim.closure_id,
      reason: queueItem.reasons[0],
      named_term_ref: namedTerm,
      raw_quote: claim.raw_value,
      canonical_value: null,
      publication_disposition: 'NO_NUMERIC_CLAIM_PUBLISHED',
    });
  }).sort((left, right) => left.original_claim_occurrence_id.localeCompare(right.original_claim_occurrence_id));

  const body = {
    schema_version: ADJUDICATION_SCHEMA,
    execution_result_id: executionResultId,
    work_item_id: workItemId,
    resolution_receipt_id: requireText(
      resolution.resolution_receipt?.resolution_receipt_id,
      'resolution.resolution_receipt.resolution_receipt_id',
    ),
    review_packet_id: requireText(reviewFinding.review_packet_id, 'independent_review_finding.review_packet_id'),
    reviewer_kind: reviewFinding.reviewer_kind,
    reviewer_disposition: reviewFinding.status,
    adjudication_outcome: 'PRESERVE_NAMED_TERM_WITHOUT_LITERAL',
    gate_effect: 'REQUIRES_GATE_ADJUDICATION_SUPPORT',
    items: Object.freeze(items),
  };
  return Object.freeze({
    ...body,
    adjudication_id: contentId(ADJUDICATION_SCHEMA, body),
  });
}

module.exports = {
  ADJUDICATION_SCHEMA,
  buildDefinedTermOnlyAdjudication,
};
