'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  PilotReviewPacketError,
  buildPilotReviewPackets,
} = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-review-packet');
const { evaluatePilotQualityGate } = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-quality-gate');
const { validateUnifiedRunManifest } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'),
  'utf8',
));
const EXECUTION_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1';
const WORK_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_WORK_RESULT/V1';
const PROVIDER_RECORDING_SCHEMA = 'NATIVE_UNIFIED_RUN_PROVIDER_RECORDING/V1';
const VALIDATION_EVIDENCE_SCHEMA = 'NATIVE_UNIFIED_RUN_VALIDATION_EVIDENCE/V1';

function recording(item) {
  const providerOutput = {
    provider_id: 'RECORDED_TEST_PROVIDER',
    model_id: 'recorded-test-model',
    raw_response_text: `{"work_item_id":"${item.work_item_id}"}`,
    attempts: 1,
  };
  const body = {
    schema_version: PROVIDER_RECORDING_SCHEMA,
    work_item_id: item.work_item_id,
    provider_output: providerOutput,
  };
  return { ...body, provider_recording_id: contentId(PROVIDER_RECORDING_SCHEMA, body) };
}

function successfulWorkResult(item, {
  compiledCandidateCount = 1,
  openWorldCount = 0,
  reviewQueueCount = 0,
} = {}) {
  const compiledCandidates = Array.from({ length: compiledCandidateCount }, (_, index) => ({
    ok: true,
    candidate_id: `candidate:${item.work_item_id}:${index}`,
  }));
  const openWorld = Array.from({ length: openWorldCount }, (_, index) => ({
    candidate_id: `open-world:${item.work_item_id}:${index}`,
  }));
  const reviewQueue = Array.from({ length: reviewQueueCount }, (_, index) => ({
    candidate_id: `review-queue:${item.work_item_id}:${index}`,
  }));
  const body = {
    schema_version: WORK_RESULT_SCHEMA,
    work_item_id: item.work_item_id,
    source_id: item.source_id,
    family_id: item.family_id,
    profile_id: 'TERRA_MEDIUM',
    status: 'SUCCEEDED',
    failure_code: null,
    failure_stage: null,
    run_receipt: {
      compiled_candidates: compiledCandidates,
      compiled_candidate_count: compiledCandidateCount,
      evidence_residual_count: 0,
      scope_violation_count: 0,
      citation_residual_count: 0,
    },
    resolution: {
      open_world: openWorld,
      review_queue: reviewQueue,
      resolution_receipt: {
        counts: {
          open_world: openWorldCount,
          review_queue: reviewQueueCount,
        },
      },
    },
    provider_recording: recording(item),
  };
  return { ...body, work_result_id: contentId(WORK_RESULT_SCHEMA, body) };
}

function executionResult(optionsForItem = () => ({})) {
  const validation = validateUnifiedRunManifest({ manifest: MANIFEST, root_dir: ROOT });
  const workResults = validation.semantic_manifest.work_items.map((item) => successfulWorkResult(
    item,
    optionsForItem(item),
  ));
  const validationEvidence = {
    schema_version: VALIDATION_EVIDENCE_SCHEMA,
    receipt: validation.receipt,
    semantic_manifest: validation.semantic_manifest,
    execution_plan: validation.execution_plan,
    non_extract_evidence: [],
  };
  const body = {
    schema_version: EXECUTION_RESULT_SCHEMA,
    validation_receipt_id: validation.receipt.validation_receipt_id,
    semantic_manifest_id: validation.semantic_manifest.semantic_manifest_id,
    execution_plan_id: validation.execution_plan.execution_plan_id,
    contract_fingerprint: 'recorded-fixture-contract',
    validation_evidence: validationEvidence,
    work_results: workResults,
    succeeded_count: workResults.length,
    failed_count: 0,
  };
  return { ...body, execution_result_id: contentId(EXECUTION_RESULT_SCHEMA, body) };
}

const EXECUTION_RESULT = executionResult();
const ADAPTER = buildPilotReviewPackets({
  manifest: MANIFEST,
  execution_result: EXECUTION_RESULT,
  root_dir: ROOT,
});

test('materialises one deterministic, review-unset packet for every sealed pilot item', () => {
  const result = ADAPTER;
  assert.equal(result.quality_records.length, 12);
  assert.equal(result.review_packets.length, 12);
  assert.ok(result.quality_records.every((record) => record.status === 'SUCCEEDED'
    && record.attempt_count === 1
    && record.provider_evidence_residual_count === 0
    && record.scope_violation_count === 0
    && record.citation_residual_count === 0
    && record.compiled_candidate_count === 1
    && record.open_world_count === 0
    && record.review_queue_count === 0
    && record.compiled_output));
  assert.ok(result.review_packets.every((packet) => packet.independent_review_status === null
    && packet.pinned_section_text.length > 0
    && packet.retained_raw_response.includes(packet.work_item_id)
    && packet.compiled_output.length === 1
    && packet.resolved_output));
  assert.equal(result.review_packets[0].provenance.execution_result_id, result.execution_result_id);
});

test('a true positive packet passes with mandatory independent review', () => {
  const gate = evaluatePilotQualityGate({
    quality_records: ADAPTER.quality_records,
    review_findings: ADAPTER.quality_records.map((record) => ({
      work_item_id: record.work_item_id,
      reviewer_kind: 'INDEPENDENT',
      status: 'PASS',
    })),
    root_dir: ROOT,
  });
  assert.equal(gate.gate_status, 'PASS');
  assert.deepEqual(gate.rerun_work_item_ids, []);
  assert.deepEqual(gate.escalation_work_item_ids, []);
});

test('twelve empty successful outputs rerun through packet-bound candidate counts', () => {
  const execution = executionResult(() => ({ compiledCandidateCount: 0 }));
  const adapter = buildPilotReviewPackets({
    manifest: MANIFEST,
    execution_result: execution,
    root_dir: ROOT,
  });
  const gate = evaluatePilotQualityGate({
    quality_records: adapter.quality_records,
    review_findings: adapter.quality_records.map((record) => ({
      work_item_id: record.work_item_id,
      reviewer_kind: 'INDEPENDENT',
      status: 'PASS',
    })),
    root_dir: ROOT,
  });
  assert.deepEqual(gate.rerun_work_item_ids, MANIFEST.work_items.map((item) => item.work_item_id).sort());
  assert.deepEqual(gate.escalation_work_item_ids, []);
});

test('open-world-only and review-queue packets escalate the exact unresolved items', () => {
  const execution = executionResult((item) => {
    if (item.work_item_id === 'modiv-consideration-2-1') return { openWorldCount: 1 };
    if (item.work_item_id === 'topbuild-no-shop-company-4-3') return { reviewQueueCount: 1 };
    return {};
  });
  const adapter = buildPilotReviewPackets({
    manifest: MANIFEST,
    execution_result: execution,
    root_dir: ROOT,
  });
  const gate = evaluatePilotQualityGate({
    quality_records: adapter.quality_records,
    review_findings: adapter.quality_records.map((record) => ({
      work_item_id: record.work_item_id,
      reviewer_kind: 'INDEPENDENT',
      status: 'PASS',
    })),
    root_dir: ROOT,
  });
  assert.deepEqual(gate.rerun_work_item_ids, []);
  assert.deepEqual(gate.escalation_work_item_ids, [
    'modiv-consideration-2-1',
    'topbuild-no-shop-company-4-3',
  ]);
});

test('quality records cannot supply an independent review PASS result', () => {
  const gate = evaluatePilotQualityGate({
    quality_records: ADAPTER.quality_records,
    review_findings: [],
    root_dir: ROOT,
  });
  assert.equal(gate.gate_status, 'FAIL');
  assert.equal(gate.escalation_work_item_ids.length, 12);
  assert.ok(gate.work_item_findings.every((finding) => finding.independent_review_status === null));
});

test('rejects a manifest outside the sealed pilot cohort before execution materialisation', () => {
  const bad = { ...MANIFEST, work_items: MANIFEST.work_items.slice(1) };
  assert.throws(
    () => buildPilotReviewPackets({ manifest: bad, execution_result: EXECUTION_RESULT, root_dir: ROOT }),
    (error) => error instanceof PilotReviewPacketError && error.code === 'PILOT_WORK_ITEM_SET_MISMATCH',
  );
});

test('has no provider, network, database or execution authority imports', () => {
  const source = fs.readFileSync(path.join(
    ROOT,
    'lib/canonical-v2/native-producer/m3-12-call-pilot-review-packet.js',
  ), 'utf8');
  assert.doesNotMatch(source, /codex-cli-provider|anthropic-provider|provider-interface|unified-runner-execute|node:https|node:http|\bfetch\s*\(|supabase|v1v2/);
});
