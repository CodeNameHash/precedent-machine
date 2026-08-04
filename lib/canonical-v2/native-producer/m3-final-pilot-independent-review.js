'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { FINAL_REVIEW_PACKET_SCHEMA } = require('./m3-final-pilot-synthesis');

const STRICT_INDEPENDENT_REVIEW_SCHEMA = 'M3_12_CALL_FINAL_PILOT_STRICT_INDEPENDENT_REVIEW_INPUT/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const SOURCE_KINDS = new Set(['ADJUDICATED_FIRST_PASS', 'REPLAY_ONLY', 'PASSED_ITERATION_2', 'REPAIRED_REPLAY']);

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

function buildFinalPilotStrictIndependentReviewInput({ final_review_packet: packet } = {}) {
  validatePacket(packet);
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
      reviewer_requirements: Object.freeze([
        'Confirm every published assertion is supported by the retained source evidence and citation.',
        'Confirm every unresolved or excluded proposition remains open-world or review-queued.',
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

module.exports = {
  STRICT_INDEPENDENT_REVIEW_SCHEMA,
  FinalPilotIndependentReviewError,
  buildFinalPilotStrictIndependentReviewInput,
};
