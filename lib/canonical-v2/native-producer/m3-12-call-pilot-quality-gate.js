'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { contentId } = require('../canonical-bytes');

const QUALITY_GATE_SCHEMA = 'M3_12_CALL_PILOT_QUALITY_GATE/V1';
const PILOT_WORK_ITEM_SET_SCHEMA = 'M3_12_CALL_PILOT_WORK_ITEM_SET/V1';
const PILOT_MANIFEST_PATH = 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json';
const PILOT_WORK_ITEM_SET_ID = '24e025b587fa9af46498f44bddc30500de6dc4c294874ce02582d466390199ef';
const REVIEW_STATUSES = new Set(['PASS', 'FAIL', 'NEEDS_ADJUDICATION']);

class PilotQualityGateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PilotQualityGateError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PilotQualityGateError(code, message, details);
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim() && value.trim() === value;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function resolvePilotManifest(rootDir) {
  const root = path.resolve(rootDir);
  const manifestPath = path.resolve(root, PILOT_MANIFEST_PATH);
  if (manifestPath !== root && !manifestPath.startsWith(`${root}${path.sep}`)) {
    fail('INVALID_ROOT_DIR', 'The pilot manifest path escapes root_dir.');
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail('PILOT_MANIFEST_UNAVAILABLE', 'The pinned pilot manifest is unavailable.', { cause: error.code || error.name });
  }
}

function loadPilotWorkItems({ root_dir: rootDir = process.cwd() } = {}) {
  const manifest = resolvePilotManifest(rootDir);
  if (!manifest || !Array.isArray(manifest.work_items)) {
    fail('INVALID_PILOT_MANIFEST', 'The pinned pilot manifest must contain work_items.');
  }
  const workItems = manifest.work_items.map((item) => ({
    work_item_id: item && item.work_item_id,
    source_id: item && item.source_id,
    family_id: item && item.family_id,
    disposition: item && item.disposition,
  })).sort((left, right) => String(left.work_item_id).localeCompare(String(right.work_item_id)));
  if (workItems.length !== 12 || workItems.some((item) => !nonEmptyText(item.work_item_id)
    || !nonEmptyText(item.source_id) || !nonEmptyText(item.family_id) || !nonEmptyText(item.disposition))
    || new Set(workItems.map((item) => item.work_item_id)).size !== workItems.length) {
    fail('INVALID_PILOT_MANIFEST', 'The pinned pilot manifest must declare twelve unique, complete work items.');
  }
  const setId = contentId(PILOT_WORK_ITEM_SET_SCHEMA, workItems);
  if (setId !== PILOT_WORK_ITEM_SET_ID) {
    fail('PILOT_WORK_ITEM_SET_MISMATCH', 'The pilot work-item set does not match the pinned twelve-call cohort.', {
      expected_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
      actual_work_item_set_id: setId,
    });
  }
  return Object.freeze(workItems.map((item) => Object.freeze(item)));
}

function indexByWorkItem(records, label, workItems) {
  if (!Array.isArray(records)) fail('INVALID_QUALITY_INPUT', `${label} must be an array.`);
  const expected = new Set(workItems.map((item) => item.work_item_id));
  const indexed = new Map();
  const duplicates = new Set();
  records.forEach((record) => {
    const id = record && record.work_item_id;
    if (!nonEmptyText(id) || !expected.has(id)) {
      fail('UNKNOWN_WORK_ITEM', `${label} contains a work item outside the pinned pilot cohort.`, { work_item_id: id || null });
    }
    if (indexed.has(id)) duplicates.add(id);
    else indexed.set(id, record);
  });
  return { indexed, duplicates };
}

function deterministicFailureCodes(record, expected) {
  if (!record) return ['MISSING_QUALITY_RECORD'];
  const codes = [];
  if (record.source_id !== expected.source_id) codes.push('SOURCE_PROVENANCE_MISMATCH');
  if (record.family_id !== expected.family_id) codes.push('FAMILY_PROVENANCE_MISMATCH');
  if (record.status !== 'SUCCEEDED') codes.push('WORK_ITEM_NOT_SUCCEEDED');
  if (record.attempt_count !== 1) codes.push('ATTEMPT_COUNT_NOT_ONE');
  if (!nonEmptyText(record.retained_raw_response)) codes.push('RAW_RESPONSE_NOT_RETAINED');
  if (expected.disposition === 'EXTRACT' && !nonEmptyText(record.compiled_output)) {
    codes.push('COMPILED_OUTPUT_EMPTY');
  }
  if (record.provider_evidence_residual_count !== 0) codes.push('PROVIDER_EVIDENCE_RESIDUALS_PRESENT');
  if (record.scope_violation_count !== 0) codes.push('SCOPE_VIOLATIONS_PRESENT');
  if (record.citation_residual_count !== 0) codes.push('CITATION_RESIDUALS_PRESENT');
  if (!nonNegativeInteger(record.compiled_candidate_count)) {
    codes.push('COMPILED_CANDIDATE_COUNT_INVALID');
  } else if (expected.disposition === 'EXTRACT' && record.compiled_candidate_count === 0) {
    codes.push('KNOWN_PRESENT_CANDIDATE_COUNT_ZERO');
  }
  if (!nonNegativeInteger(record.open_world_count)) codes.push('OPEN_WORLD_COUNT_INVALID');
  if (!nonNegativeInteger(record.review_queue_count)) codes.push('REVIEW_QUEUE_COUNT_INVALID');
  return codes;
}

function unresolvedOutputCodes(record) {
  if (!record) return [];
  const codes = [];
  if (record.open_world_count > 0) codes.push('OPEN_WORLD_OUTPUT_UNRESOLVED');
  if (record.review_queue_count > 0) codes.push('REVIEW_QUEUE_OUTPUT_UNRESOLVED');
  return codes;
}

function addEscalation(escalation, workItemId, codes) {
  escalation.set(workItemId, [...(escalation.get(workItemId) || []), ...codes]);
}

function reviewState(finding) {
  if (!finding) return { status: null, escalation_code: 'MISSING_INDEPENDENT_REVIEW' };
  if (finding.reviewer_kind !== 'INDEPENDENT') {
    return { status: finding.status || null, escalation_code: 'REVIEW_NOT_INDEPENDENT' };
  }
  if (!REVIEW_STATUSES.has(finding.status)) {
    return { status: finding.status || null, escalation_code: 'INVALID_REVIEW_STATUS' };
  }
  return { status: finding.status, escalation_code: null };
}

function evaluatePilotQualityGate({ quality_records: qualityRecords, review_findings: reviewFindings, root_dir: rootDir = process.cwd() } = {}) {
  const workItems = loadPilotWorkItems({ root_dir: rootDir });
  const { indexed: records, duplicates: recordDuplicates } = indexByWorkItem(qualityRecords, 'quality_records', workItems);
  const { indexed: reviews, duplicates: reviewDuplicates } = indexByWorkItem(reviewFindings, 'review_findings', workItems);
  const rerun = new Map();
  const escalation = new Map();
  const findings = workItems.map((expected) => {
    const deterministicCodes = deterministicFailureCodes(records.get(expected.work_item_id), expected);
    if (recordDuplicates.has(expected.work_item_id)) deterministicCodes.push('DUPLICATE_QUALITY_RECORD');
    if (deterministicCodes.length > 0) rerun.set(expected.work_item_id, deterministicCodes);
    const unresolvedCodes = unresolvedOutputCodes(records.get(expected.work_item_id));
    if (unresolvedCodes.length > 0) addEscalation(escalation, expected.work_item_id, unresolvedCodes);
    const review = reviewState(reviews.get(expected.work_item_id));
    if (reviewDuplicates.has(expected.work_item_id)) {
      addEscalation(escalation, expected.work_item_id, ['DUPLICATE_INDEPENDENT_REVIEW']);
    } else if (review.escalation_code) {
      addEscalation(escalation, expected.work_item_id, [review.escalation_code]);
    } else if (review.status === 'FAIL') {
      rerun.set(expected.work_item_id, [...(rerun.get(expected.work_item_id) || []), 'INDEPENDENT_REVIEW_FAIL']);
    } else if (review.status === 'NEEDS_ADJUDICATION') {
      addEscalation(escalation, expected.work_item_id, ['INDEPENDENT_REVIEW_NEEDS_ADJUDICATION']);
    }
    return Object.freeze({
      work_item_id: expected.work_item_id,
      deterministic_failure_codes: Object.freeze(deterministicCodes),
      unresolved_output_codes: Object.freeze(unresolvedCodes),
      independent_review_status: review.status,
    });
  });
  const rerunWorkItemIds = [...rerun.keys()].sort();
  const escalationWorkItemIds = [...escalation.keys()].sort();
  const body = {
    schema_version: QUALITY_GATE_SCHEMA,
    pilot_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
    gate_status: rerunWorkItemIds.length === 0 && escalationWorkItemIds.length === 0 ? 'PASS' : 'FAIL',
    selected_present_work_item_ids: workItems.filter((item) => item.disposition === 'EXTRACT').map((item) => item.work_item_id),
    work_item_findings: findings,
    rerun_work_item_ids: rerunWorkItemIds,
    escalation_work_item_ids: escalationWorkItemIds,
  };
  return Object.freeze({
    ...body,
    quality_gate_id: contentId(QUALITY_GATE_SCHEMA, body),
  });
}

module.exports = {
  QUALITY_GATE_SCHEMA,
  PILOT_WORK_ITEM_SET_ID,
  PilotQualityGateError,
  evaluatePilotQualityGate,
  loadPilotWorkItems,
};
