'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PILOT_WORK_ITEM_SET_ID,
  PilotQualityGateError,
  evaluatePilotQualityGate,
  loadPilotWorkItems,
} = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-quality-gate');

const ROOT = path.resolve(__dirname, '..');

function passingInput() {
  const workItems = loadPilotWorkItems({ root_dir: ROOT });
  return {
    quality_records: workItems.map((item) => ({
      work_item_id: item.work_item_id,
      source_id: item.source_id,
      family_id: item.family_id,
      status: 'SUCCEEDED',
      attempt_count: 1,
      retained_raw_response: `raw response for ${item.work_item_id}`,
      compiled_output: item.disposition === 'EXTRACT' ? `compiled output for ${item.family_id}` : null,
      provider_evidence_residual_count: 0,
      scope_violation_count: 0,
      citation_residual_count: 0,
      compiled_candidate_count: 1,
      open_world_count: 0,
      review_queue_count: 0,
    })),
    review_findings: workItems.map((item) => ({
      work_item_id: item.work_item_id,
      reviewer_kind: 'INDEPENDENT',
      status: 'PASS',
    })),
  };
}

function finding(result, workItemId) {
  return result.work_item_findings.find((entry) => entry.work_item_id === workItemId);
}

test('the quality gate passes only the exact twelve-item cohort with deterministic and independent review PASS results', () => {
  const result = evaluatePilotQualityGate({ ...passingInput(), root_dir: ROOT });
  assert.equal(result.gate_status, 'PASS');
  assert.equal(result.pilot_work_item_set_id, PILOT_WORK_ITEM_SET_ID);
  assert.equal(result.work_item_findings.length, 12);
  assert.equal(result.selected_present_work_item_ids.length, 12);
  assert.deepEqual(result.rerun_work_item_ids, []);
  assert.deepEqual(result.escalation_work_item_ids, []);
  assert.ok(result.work_item_findings.every((entry) => entry.independent_review_status === 'PASS'
    && entry.deterministic_failure_codes.length === 0));
});

test('deterministic failures return the exact rerun set and never pass silently', () => {
  const input = passingInput();
  const bad = input.quality_records.find((entry) => entry.work_item_id === 'modiv-mae-definition-8-12-g');
  bad.status = 'FAILED';
  bad.attempt_count = 2;
  bad.retained_raw_response = '';
  bad.provider_evidence_residual_count = 1;
  bad.scope_violation_count = 1;
  bad.citation_residual_count = 1;
  const result = evaluatePilotQualityGate({ ...input, root_dir: ROOT });
  assert.equal(result.gate_status, 'FAIL');
  assert.deepEqual(result.rerun_work_item_ids, ['modiv-mae-definition-8-12-g']);
  assert.deepEqual(result.escalation_work_item_ids, []);
  assert.deepEqual(finding(result, 'modiv-mae-definition-8-12-g').deterministic_failure_codes, [
    'WORK_ITEM_NOT_SUCCEEDED',
    'ATTEMPT_COUNT_NOT_ONE',
    'RAW_RESPONSE_NOT_RETAINED',
    'PROVIDER_EVIDENCE_RESIDUALS_PRESENT',
    'SCOPE_VIOLATIONS_PRESENT',
    'CITATION_RESIDUALS_PRESENT',
  ]);
});

test('exact manifest-family provenance and present-family compiled output are required', () => {
  const input = passingInput();
  const provenance = input.quality_records.find((entry) => entry.work_item_id === 'modiv-antitrust-consents-5-5');
  provenance.source_id = 'skechers-full';
  provenance.family_id = 'MAE_DEFINITION';
  provenance.compiled_output = '';
  const result = evaluatePilotQualityGate({ ...input, root_dir: ROOT });
  assert.deepEqual(result.rerun_work_item_ids, ['modiv-antitrust-consents-5-5']);
  assert.deepEqual(finding(result, 'modiv-antitrust-consents-5-5').deterministic_failure_codes, [
    'SOURCE_PROVENANCE_MISMATCH',
    'FAMILY_PROVENANCE_MISMATCH',
    'COMPILED_OUTPUT_EMPTY',
  ]);
});

test('known-present output reruns when no candidate compiled', () => {
  const input = passingInput();
  input.quality_records.forEach((record) => { record.compiled_candidate_count = 0; });
  const result = evaluatePilotQualityGate({ ...input, root_dir: ROOT });
  const expected = input.quality_records.map((record) => record.work_item_id).sort();
  assert.deepEqual(result.rerun_work_item_ids, expected);
  assert.deepEqual(result.escalation_work_item_ids, []);
  assert.ok(result.work_item_findings.every((entry) => entry.deterministic_failure_codes.includes(
    'KNOWN_PRESENT_CANDIDATE_COUNT_ZERO',
  )));
});

test('unresolved open-world and review-queue output escalates the exact item set', () => {
  const input = passingInput();
  input.quality_records.find((record) => record.work_item_id === 'modiv-consideration-2-1').open_world_count = 1;
  input.quality_records.find((record) => record.work_item_id === 'topbuild-no-shop-company-4-3').review_queue_count = 1;
  const result = evaluatePilotQualityGate({ ...input, root_dir: ROOT });
  assert.deepEqual(result.rerun_work_item_ids, []);
  assert.deepEqual(result.escalation_work_item_ids, [
    'modiv-consideration-2-1',
    'topbuild-no-shop-company-4-3',
  ]);
  assert.deepEqual(finding(result, 'modiv-consideration-2-1').unresolved_output_codes, [
    'OPEN_WORLD_OUTPUT_UNRESOLVED',
  ]);
  assert.deepEqual(finding(result, 'topbuild-no-shop-company-4-3').unresolved_output_codes, [
    'REVIEW_QUEUE_OUTPUT_UNRESOLVED',
  ]);
});

test('FAIL and NEEDS_ADJUDICATION produce the exact rerun and escalation sets', () => {
  const input = passingInput();
  input.review_findings.find((entry) => entry.work_item_id === 'skechers-capitalisation-3-7').status = 'FAIL';
  input.review_findings.find((entry) => entry.work_item_id === 'topbuild-no-shop-company-4-3').status = 'NEEDS_ADJUDICATION';
  const result = evaluatePilotQualityGate({ ...input, root_dir: ROOT });
  assert.equal(result.gate_status, 'FAIL');
  assert.deepEqual(result.rerun_work_item_ids, ['skechers-capitalisation-3-7']);
  assert.deepEqual(result.escalation_work_item_ids, ['topbuild-no-shop-company-4-3']);
});

test('missing and non-independent reviews fail closed into the exact escalation set', () => {
  const input = passingInput();
  input.review_findings = input.review_findings.filter((entry) => entry.work_item_id !== 'modiv-consideration-2-1');
  input.review_findings.find((entry) => entry.work_item_id === 'skechers-no-other-reps-3-28').reviewer_kind = 'PROVIDER';
  const result = evaluatePilotQualityGate({ ...input, root_dir: ROOT });
  assert.deepEqual(result.escalation_work_item_ids, [
    'modiv-consideration-2-1',
    'skechers-no-other-reps-3-28',
  ]);
});

test('the gate rejects records outside the immutable cohort and has no live authority imports', () => {
  const input = passingInput();
  input.quality_records.push({ ...input.quality_records[0], work_item_id: 'outside-pilot' });
  assert.throws(
    () => evaluatePilotQualityGate({ ...input, root_dir: ROOT }),
    (error) => error instanceof PilotQualityGateError && error.code === 'UNKNOWN_WORK_ITEM',
  );
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/native-producer/m3-12-call-pilot-quality-gate.js'), 'utf8');
  assert.doesNotMatch(source, /provider-interface|anthropic-provider|codex-cli-provider|node:https|node:http|\bfetch\s*\(|supabase|v1v2/);
});
