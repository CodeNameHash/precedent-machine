'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PilotReviewPacketError,
  buildPilotReviewPackets,
} = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-review-packet');
const { evaluatePilotQualityGate } = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-quality-gate');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'),
  'utf8',
));

function qualityRecords({ compiledCandidateCount = 1, openWorldById = new Set(), reviewQueueById = new Set() } = {}) {
  return MANIFEST.work_items.map((item) => Object.freeze({
    work_item_id: item.work_item_id,
    source_id: item.source_id,
    family_id: item.family_id,
    status: 'SUCCEEDED',
    attempt_count: 1,
    retained_raw_response: `{\"work_item_id\":\"${item.work_item_id}\"}`,
    compiled_output: compiledCandidateCount ? '[{\"ok\":true}]' : '[]',
    provider_evidence_residual_count: 0,
    scope_violation_count: 0,
    citation_residual_count: 0,
    compiled_candidate_count: compiledCandidateCount,
    open_world_count: openWorldById.has(item.work_item_id) ? 1 : 0,
    review_queue_count: reviewQueueById.has(item.work_item_id) ? 1 : 0,
  }));
}

function independentPass(records) {
  return records.map((record) => ({
    work_item_id: record.work_item_id,
    reviewer_kind: 'INDEPENDENT',
    status: 'PASS',
  }));
}

test('caller-provided pilot manifests cannot materialise review packets without trusted execution validation', () => {
  assert.throws(
    () => buildPilotReviewPackets({ manifest: MANIFEST, execution_result: {}, root_dir: ROOT }),
    (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('the independent quality gate passes a complete reviewed cohort', () => {
  const records = qualityRecords();
  const gate = evaluatePilotQualityGate({
    quality_records: records,
    review_findings: independentPass(records),
    root_dir: ROOT,
  });
  assert.equal(gate.gate_status, 'PASS');
  assert.deepEqual(gate.rerun_work_item_ids, []);
  assert.deepEqual(gate.escalation_work_item_ids, []);
});

test('empty output reruns while unresolved output escalates only the affected pilot items', () => {
  const empty = qualityRecords({ compiledCandidateCount: 0 });
  const rerun = evaluatePilotQualityGate({
    quality_records: empty,
    review_findings: independentPass(empty),
    root_dir: ROOT,
  });
  assert.deepEqual(rerun.rerun_work_item_ids, MANIFEST.work_items.map((item) => item.work_item_id).sort());
  assert.deepEqual(rerun.escalation_work_item_ids, []);

  const unresolved = qualityRecords({
    openWorldById: new Set(['modiv-consideration-2-1']),
    reviewQueueById: new Set(['topbuild-no-shop-company-4-3']),
  });
  const escalated = evaluatePilotQualityGate({
    quality_records: unresolved,
    review_findings: independentPass(unresolved),
    root_dir: ROOT,
  });
  assert.deepEqual(escalated.rerun_work_item_ids, []);
  assert.deepEqual(escalated.escalation_work_item_ids, [
    'modiv-consideration-2-1',
    'topbuild-no-shop-company-4-3',
  ]);
});

test('quality records cannot supply an independent review PASS result', () => {
  const gate = evaluatePilotQualityGate({ quality_records: qualityRecords(), review_findings: [], root_dir: ROOT });
  assert.equal(gate.gate_status, 'FAIL');
  assert.equal(gate.escalation_work_item_ids.length, 12);
  assert.ok(gate.work_item_findings.every((finding) => finding.independent_review_status === null));
});

test('an out-of-cohort manifest fails before the trusted execution boundary', () => {
  const bad = { ...MANIFEST, work_items: MANIFEST.work_items.slice(1) };
  assert.throws(
    () => buildPilotReviewPackets({ manifest: bad, execution_result: {}, root_dir: ROOT }),
    (error) => error instanceof PilotReviewPacketError && error.code === 'PILOT_WORK_ITEM_SET_MISMATCH',
  );
});

test('the review-packet adapter has no provider, network, database or execution authority imports', () => {
  const source = fs.readFileSync(path.join(
    ROOT,
    'lib/canonical-v2/native-producer/m3-12-call-pilot-review-packet.js',
  ), 'utf8');
  assert.doesNotMatch(source, /codex-cli-provider|anthropic-provider|provider-interface|unified-runner-execute|node:https|node:http|\bfetch\s*\(|supabase|v1v2/);
});
