'use strict';

const { canonicalJson, contentId, sha256Hex } = require('../canonical-bytes');
const { FINAL_REVIEW_PACKET_SCHEMA } = require('./m3-final-pilot-synthesis');

const STRICT_INDEPENDENT_REVIEW_SCHEMA = 'M3_12_CALL_FINAL_PILOT_STRICT_INDEPENDENT_REVIEW_INPUT/V2';
const FINAL_RE_REVIEW_FINDINGS_SCHEMA = 'M3_12_CALL_FINAL_PILOT_RE_REVIEW_FINDINGS/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const SOURCE_KINDS = new Set(['ADJUDICATED_FIRST_PASS', 'REPLAY_ONLY', 'PASSED_ITERATION_2', 'REPAIRED_REPLAY']);
const REVIEW_STATUS = new Set(['PASS', 'FAIL']);
const FINAL_RE_REVIEW_RUBRIC = Object.freeze({
  rubric_version: 'M3_FINAL_RE_REVIEW_RUBRIC/V1',
  governed_extraction_scope: 'section_reference defines the governed extraction scope. A parent section_reference is valid when it is the sealed scope.',
  published_legal_citation: 'source_citation is the published legal citation. Every resolved claim needs a non-empty source_citation.',
  party_chapeau_evidence: 'A claim with a party needs either party_source_span verified against exact source bytes or a non-empty governing_context_quote.',
  required_failures: Object.freeze([
    'MISSING_PUBLISHED_SOURCE_CITATION',
    'MISSING_PARTY_CHAPEAU_EVIDENCE',
    'UNSUPPORTED_VALUE',
    'OMITTED_REVIEW_ROW',
    'WRONG_PARTY',
    'WRONG_OPEN_WORLD_ROUTING',
  ]),
});

class FinalPilotIndependentReviewError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FinalPilotIndependentReviewError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) { throw new FinalPilotIndependentReviewError(code, message, details); }
function digest(value) { return typeof value === 'string' && DIGEST_RE.test(value); }
function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validatePacket(packet) {
  const keys = [
    'schema_version', 'pilot_work_item_ids', 'first_execution_result_id', 'iteration_2_execution_result_id',
    'iteration_2_rerun_plan_id', 'revised_decision_vector_content_hash', 'repair_rerun_vector_content_hash',
    'required_repair_commits', 'present_repair_commits', 'model_call_count', 'legal_disposition',
    'independent_review_state', 'work_items', 'final_review_packet_id',
  ];
  if (!exactKeys(packet, keys) || packet.schema_version !== FINAL_REVIEW_PACKET_SCHEMA
    || !digest(packet.final_review_packet_id) || packet.model_call_count !== 0
    || packet.legal_disposition !== 'NOT_DETERMINED'
    || packet.independent_review_state !== 'PENDING_INDEPENDENT_LEGAL_REVIEW'
    || !Array.isArray(packet.work_items) || packet.work_items.length !== 12) {
    fail('INVALID_FINAL_REVIEW_PACKET', 'The final pilot packet must be sealed, no-model, and pending independent legal review.');
  }
  const body = { ...packet };
  delete body.final_review_packet_id;
  if (contentId(FINAL_REVIEW_PACKET_SCHEMA, body) !== packet.final_review_packet_id) {
    fail('FINAL_REVIEW_PACKET_ID_MISMATCH', 'The final pilot packet does not match its content identity.');
  }
  const ids = packet.work_items.map((item) => item?.work_item_id);
  if (new Set(ids).size !== 12 || canonicalJson(ids) !== canonicalJson([...ids].sort())
    || canonicalJson(ids) !== canonicalJson(packet.pilot_work_item_ids)
    || packet.work_items.some((item) => !SOURCE_KINDS.has(item?.source_kind)
      || item.legal_disposition !== 'NOT_DETERMINED'
      || item.independent_review_state !== 'PENDING_INDEPENDENT_LEGAL_REVIEW')) {
    fail('FINAL_REVIEW_PACKET_COHORT_MISMATCH', 'The final pilot packet must preserve exactly twelve pending review items.');
  }
}

function reviewSource(item) {
  if (item.source_kind === 'ADJUDICATED_FIRST_PASS') {
    return {
      source_output_id: item.first_work_result?.work_result_id,
      provider_recording_id: item.first_work_result?.provider_recording?.provider_recording_id,
      source_output: item.first_work_result,
      additional_binding: item.adjudication_binding,
    };
  }
  if (item.source_kind === 'REPLAY_ONLY') {
    return {
      source_output_id: item.replay_result?.replay_result_id,
      provider_recording_id: item.first_provider_recording?.provider_recording_id,
      source_output: item.replay_result,
      additional_binding: { first_provider_recording: item.first_provider_recording },
    };
  }
  if (item.source_kind === 'PASSED_ITERATION_2') {
    return {
      source_output_id: item.iteration_2_work_result?.work_result_id,
      provider_recording_id: item.iteration_2_work_result?.provider_recording?.provider_recording_id,
      source_output: item.iteration_2_work_result,
      additional_binding: null,
    };
  }
  return {
    source_output_id: item.repaired_replay?.repaired_replay_id,
    provider_recording_id: item.repaired_replay?.provider_recording?.provider_recording_id,
    source_output: item.repaired_replay,
    additional_binding: null,
  };
}

function sourceBytesFor(source, bytesByDocumentHash) {
  const documentHash = source.source_output?.run_receipt?.document_hash || null;
  const expectedDigest = source.source_output?.run_receipt?.source_sha256 || null;
  const exactBytes = documentHash ? bytesByDocumentHash[documentHash] : null;
  if (exactBytes == null) return null;
  if (typeof exactBytes !== 'string' || !digest(expectedDigest)
    || sha256Hex(Buffer.from(exactBytes, 'utf8')) !== expectedDigest) {
    fail('EXACT_SOURCE_BYTES_INVALID', 'Exact source bytes must match the sealed source digest.', { document_hash: documentHash });
  }
  return Object.freeze({ document_hash: documentHash, source_sha256: expectedDigest, text: exactBytes });
}

function resolutionFor(item) {
  const source = reviewSource(item).source_output;
  if (!source?.resolution || source.work_item_id !== item.work_item_id) {
    fail('REVIEW_SOURCE_MISSING', 'Every legal-review item must retain its declared final resolution.', { work_item_id: item.work_item_id });
  }
  return source.resolution;
}

function rowsForReview(item, exactSourceBytes) {
  const resolution = resolutionFor(item);
  return Object.freeze({
    resolved_claims: Object.freeze((resolution.resolved || []).map((entry) => Object.freeze({
      claim_revision_id: entry.claim?.claim_revision_id || null,
      section_reference: entry.section_reference || null,
      source_citation: entry.source_citation || null,
      canonical_value: entry.claim?.canonical_value ?? null,
      exact_source_quote: entry.claim?.raw_value || '',
      party: entry.party || null,
      party_source_span: entry.party_source_span || null,
      governing_context_quote: entry.governing_context_quote || null,
      exact_source_bytes: exactSourceBytes,
    }))),
    review_queue: Object.freeze((resolution.review_queue || []).filter((entry) => !entry.has_resolution).map((entry) => Object.freeze({
      row_id: entry.original_claim_occurrence_id || null,
      section_reference: entry.section_reference || null,
      raw_value: entry.raw_value || '',
    }))),
    open_world: Object.freeze((resolution.open_world || []).map((entry) => Object.freeze({
      row_id: entry.closure_id || null,
      section_reference: entry.section_reference || null,
      raw_value: entry.raw_value || '',
    }))),
  });
}

function buildFinalPilotStrictIndependentReviewInput({ final_review_packet: packet, exact_source_bytes_by_document_hash: bytesByDocumentHash = {} } = {}) {
  validatePacket(packet);
  if (!bytesByDocumentHash || typeof bytesByDocumentHash !== 'object' || Array.isArray(bytesByDocumentHash)) {
    fail('EXACT_SOURCE_BYTES_INVALID', 'Exact source bytes must be an object keyed by document hash.');
  }
  const reviewItems = packet.work_items.map((item) => {
    const source = reviewSource(item);
    if (!digest(source.source_output_id) || !digest(source.provider_recording_id) || !source.source_output) {
      fail('REVIEW_SOURCE_MISSING', 'Every legal-review item must retain its exact output and raw provider recording.', { work_item_id: item.work_item_id });
    }
    return Object.freeze({
      work_item_id: item.work_item_id,
      source_kind: item.source_kind,
      source_output_id: source.source_output_id,
      provider_recording_id: source.provider_recording_id,
      source_output: source.source_output,
      additional_binding: source.additional_binding,
      review_rows: rowsForReview(item, sourceBytesFor(source, bytesByDocumentHash)),
      re_review_rubric: FINAL_RE_REVIEW_RUBRIC,
      reviewer_requirements: Object.freeze([
        'Treat section_reference as the governed extraction scope. Do not fail a claim merely because it remains the parent section.',
        'Treat source_citation as the published legal citation. Fail every resolved claim without it.',
        'For each party, require party_source_span plus verified exact source bytes or governing_context_quote.',
        'Fail unsupported values, omitted rows, wrong parties, and wrong open-world routing.',
        'Record an independent legal disposition. No automatic legal PASS is available.',
      ]),
      automatic_legal_disposition: 'NOT_DETERMINED',
      independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    });
  });
  const body = {
    schema_version: STRICT_INDEPENDENT_REVIEW_SCHEMA,
    final_review_packet_id: packet.final_review_packet_id,
    pilot_work_item_ids: packet.pilot_work_item_ids,
    repair_rerun_vector_content_hash: packet.repair_rerun_vector_content_hash,
    model_call_count: 0,
    automatic_legal_passes: 0,
    review_items: Object.freeze(reviewItems),
  };
  return Object.freeze({ ...body, strict_independent_review_input_id: contentId(STRICT_INDEPENDENT_REVIEW_SCHEMA, body) });
}

function exactIds(rows, key, label, workItemId) {
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row[key] !== 'string' || !row[key])) {
    fail('INVALID_RE_REVIEW_FINDINGS', `${label} must have a non-empty ${key}.`, { work_item_id: workItemId });
  }
  const ids = rows.map((row) => row[key]);
  if (new Set(ids).size !== ids.length) fail('INVALID_RE_REVIEW_FINDINGS', `${label} has duplicate rows.`, { work_item_id: workItemId });
  return ids.sort();
}

function equalIds(actual, expected, label, workItemId) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('RE_REVIEW_OMISSION', `${label} does not cover the sealed final rows.`, { work_item_id: workItemId });
  }
}

function hasVerifiedPartyChapeau(row) {
  if (!row.party?.value) return true;
  if (typeof row.governing_context_quote === 'string' && row.governing_context_quote.trim()) return true;
  const span = row.party_source_span;
  const source = row.exact_source_bytes;
  if (!span || !source || typeof source.text !== 'string' || !Number.isInteger(span.absolute_start)
    || !Number.isInteger(span.absolute_end) || span.absolute_start < 0 || span.absolute_end <= span.absolute_start) return false;
  const bytes = Buffer.from(source.text, 'utf8');
  const observed = bytes.subarray(span.absolute_start, span.absolute_end);
  return digest(span.exact_bytes_digest)
    && sha256Hex(observed) === span.exact_bytes_digest
    && observed.toString('utf8').includes(row.party.value);
}

function requirePassOrFail(value, label, workItemId) {
  if (!REVIEW_STATUS.has(value)) fail('INVALID_RE_REVIEW_FINDINGS', `${label} must be PASS or FAIL.`, { work_item_id: workItemId });
}

function validateFinding(finding, reviewItem) {
  const expectedKeys = ['work_item_id', 'status', 'reason_codes', 'claim_reviews', 'review_queue_reviews', 'open_world_reviews'];
  if (!exactKeys(finding, expectedKeys) || finding.work_item_id !== reviewItem.work_item_id) {
    fail('INVALID_RE_REVIEW_FINDINGS', 'A re-review finding has an invalid closed shape.', { work_item_id: reviewItem.work_item_id });
  }
  requirePassOrFail(finding.status, 'finding.status', reviewItem.work_item_id);
  if (!Array.isArray(finding.reason_codes) || finding.reason_codes.some((code) => typeof code !== 'string' || !code)) {
    fail('INVALID_RE_REVIEW_FINDINGS', 'A re-review finding has invalid reason codes.', { work_item_id: reviewItem.work_item_id });
  }
  const expectedClaims = exactIds(reviewItem.review_rows.resolved_claims, 'claim_revision_id', 'sealed claims', reviewItem.work_item_id);
  const observedClaims = exactIds(finding.claim_reviews, 'claim_revision_id', 'claim reviews', reviewItem.work_item_id);
  equalIds(observedClaims, expectedClaims, 'Claim reviews', reviewItem.work_item_id);
  const expectedQueue = exactIds(reviewItem.review_rows.review_queue, 'row_id', 'sealed review queue', reviewItem.work_item_id);
  const observedQueue = exactIds(finding.review_queue_reviews, 'row_id', 'review queue reviews', reviewItem.work_item_id);
  equalIds(observedQueue, expectedQueue, 'Review queue reviews', reviewItem.work_item_id);
  const expectedOpenWorld = exactIds(reviewItem.review_rows.open_world, 'row_id', 'sealed open-world rows', reviewItem.work_item_id);
  const observedOpenWorld = exactIds(finding.open_world_reviews, 'row_id', 'open-world reviews', reviewItem.work_item_id);
  equalIds(observedOpenWorld, expectedOpenWorld, 'Open-world reviews', reviewItem.work_item_id);
  const claimsById = new Map(reviewItem.review_rows.resolved_claims.map((row) => [row.claim_revision_id, row]));
  for (const review of finding.claim_reviews) {
    if (!exactKeys(review, ['claim_revision_id', 'value_status', 'party_status', 'citation_status', 'chapeau_status', 'status'])) {
      fail('INVALID_RE_REVIEW_FINDINGS', 'A claim review has an invalid closed shape.', { work_item_id: reviewItem.work_item_id });
    }
    for (const field of ['value_status', 'party_status', 'citation_status', 'chapeau_status', 'status']) requirePassOrFail(review[field], `claim review ${field}`, reviewItem.work_item_id);
    const row = claimsById.get(review.claim_revision_id);
    const missingCitation = !row.source_citation;
    const unsupportedValue = row.canonical_value == null || !row.exact_source_quote;
    const missingChapeau = !hasVerifiedPartyChapeau(row);
    const hardFailure = missingCitation || unsupportedValue || missingChapeau;
    if ((missingCitation && review.citation_status !== 'FAIL')
      || (unsupportedValue && review.value_status !== 'FAIL')
      || (missingChapeau && review.chapeau_status !== 'FAIL')) {
      fail('RE_REVIEW_RUBRIC_VIOLATION', 'A required citation, value, or party-chapeau failure must be recorded in its review field.', { work_item_id: reviewItem.work_item_id, claim_revision_id: review.claim_revision_id });
    }
    if (hardFailure && review.status !== 'FAIL') {
      fail('RE_REVIEW_RUBRIC_VIOLATION', 'A required citation, value, or party-chapeau failure cannot pass.', { work_item_id: reviewItem.work_item_id, claim_revision_id: review.claim_revision_id });
    }
    if (review.status === 'FAIL' && finding.status !== 'FAIL') {
      fail('RE_REVIEW_RUBRIC_VIOLATION', 'A failed claim cannot receive a PASS finding.', { work_item_id: reviewItem.work_item_id, claim_revision_id: review.claim_revision_id });
    }
  }
  for (const review of [...finding.review_queue_reviews, ...finding.open_world_reviews]) {
    if (!exactKeys(review, ['row_id', 'routing_status']) || !['RETAINED', 'WRONG_ROUTE'].includes(review.routing_status)) {
      fail('INVALID_RE_REVIEW_FINDINGS', 'A routing review has an invalid closed shape.', { work_item_id: reviewItem.work_item_id });
    }
    if (review.routing_status === 'WRONG_ROUTE' && finding.status !== 'FAIL') {
      fail('RE_REVIEW_RUBRIC_VIOLATION', 'Wrong open-world or review-queue routing cannot pass.', { work_item_id: reviewItem.work_item_id });
    }
  }
}

function validateFinalPilotReReviewFindings({ strict_independent_review_input: input, finding_artifacts: artifacts } = {}) {
  if (!input || !Array.isArray(input.review_items) || input.review_items.length !== 12) {
    fail('INVALID_RE_REVIEW_INPUT', 'The sealed re-review input must contain twelve review items.');
  }
  if (!Array.isArray(artifacts) || ![1, 2].includes(artifacts.length)) {
    fail('RE_REVIEW_FINDINGS_COVERAGE', 'Provide one twelve-item findings file or two six-item findings files.');
  }
  const findings = artifacts.flatMap((artifact, index) => {
    if (!artifact || artifact.schema_version !== FINAL_RE_REVIEW_FINDINGS_SCHEMA || !Array.isArray(artifact.findings)
      || (artifacts.length === 1 && artifact.findings.length !== 12)
      || (artifacts.length === 2 && artifact.findings.length !== 6)) {
      fail('RE_REVIEW_FINDINGS_COVERAGE', `Findings artifact ${index + 1} has invalid coverage.`);
    }
    return artifact.findings;
  });
  const reviewItems = new Map(input.review_items.map((item) => [item.work_item_id, item]));
  if (new Set(findings.map((finding) => finding?.work_item_id)).size !== 12) {
    fail('RE_REVIEW_FINDINGS_COVERAGE', 'Re-review findings must contain twelve unique work items.');
  }
  for (const finding of findings) {
    const reviewItem = reviewItems.get(finding?.work_item_id);
    if (!reviewItem) fail('RE_REVIEW_FINDINGS_COVERAGE', 'Re-review findings contain an unknown work item.');
    validateFinding(finding, reviewItem);
  }
  return true;
}

module.exports = {
  STRICT_INDEPENDENT_REVIEW_SCHEMA,
  FINAL_RE_REVIEW_FINDINGS_SCHEMA,
  FINAL_RE_REVIEW_RUBRIC,
  FinalPilotIndependentReviewError,
  buildFinalPilotStrictIndependentReviewInput,
  validateFinalPilotReReviewFindings,
};
