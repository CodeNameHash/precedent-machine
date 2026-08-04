'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  PILOT_ADJUDICATION_SCHEMA,
  buildPilotAdjudication,
} = require('../lib/canonical-v2/native-producer/m3-pilot-adjudication');
const {
  evaluatePilotQualityGate,
  loadPilotWorkItems,
} = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-quality-gate');

const ROOT = path.resolve(__dirname, '..');
const LIVE_ARTIFACT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const ADAPTER_PATH = path.join(LIVE_ARTIFACT_ROOT, 'final-output', 'review-packet-adapter.json');
const REVIEW_PATH = path.join(LIVE_ARTIFACT_ROOT, 'final-output', 'independent-first-six-review-findings.json');

function baseInput() {
  const items = loadPilotWorkItems({ root_dir: ROOT });
  return {
    quality_records: items.map((item) => ({
      work_item_id: item.work_item_id,
      source_id: item.source_id,
      family_id: item.family_id,
      status: 'SUCCEEDED',
      attempt_count: 1,
      retained_raw_response: `raw ${item.work_item_id}`,
      compiled_output: 'compiled',
      provider_evidence_residual_count: 0,
      scope_violation_count: 0,
      citation_residual_count: 0,
      compiled_candidate_count: 1,
      open_world_count: 0,
      review_queue_count: 0,
    })),
    review_findings: items.map((item) => ({
      work_item_id: item.work_item_id,
      reviewer_kind: 'INDEPENDENT',
      status: 'PASS',
    })),
  };
}

function replaceByWorkItem(records, replacement) {
  return records.map((entry) => entry.work_item_id === replacement.work_item_id ? replacement : entry);
}

function dispositionsFor(packet) {
  return Object.fromEntries([
    ...packet.resolved_output.open_world.map((entry) => [entry.closure_id, 'REVIEWED_OPEN_WORLD']),
    ...packet.resolved_output.review_queue.map((entry) => [entry.closure_id,
      packet.work_item_id === 'modiv-consideration-2-1'
        ? 'DEFINED_TERM_ONLY_NO_NUMERIC_PUBLICATION'
        : 'DEFERRED_TO_GOVERNED_OWNER']),
  ]);
}

test('sealed live adjudications clear only the two reviewer-PASS Modiv unresolved-output escalations', {
  skip: !fs.existsSync(ADAPTER_PATH) || !fs.existsSync(REVIEW_PATH),
}, () => {
  const adapter = JSON.parse(fs.readFileSync(ADAPTER_PATH, 'utf8'));
  const findings = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8')).findings;
  const ids = ['modiv-consideration-2-1', 'modiv-termination-fee-7-3'];
  const packets = adapter.review_packets.filter((entry) => ids.includes(entry.work_item_id));
  const adjudications = packets.map((packet) => buildPilotAdjudication({
    review_packet: packet,
    dispositions_by_closure_id: dispositionsFor(packet),
  }));
  const input = baseInput();
  for (const id of ids) {
    input.quality_records = replaceByWorkItem(
      input.quality_records,
      adapter.quality_records.find((entry) => entry.work_item_id === id),
    );
    input.review_findings = replaceByWorkItem(
      input.review_findings,
      findings.find((entry) => entry.work_item_id === id),
    );
  }
  const result = evaluatePilotQualityGate({
    ...input,
    review_packets: packets,
    adjudications,
    root_dir: ROOT,
  });
  assert.equal(result.gate_status, 'PASS');
  assert.deepEqual(result.escalation_work_item_ids, []);
  assert.ok(ids.every((id) => result.work_item_findings.find((entry) => (
    entry.work_item_id === id
  )).adjudication_accepted));

  const tampered = JSON.parse(JSON.stringify(adjudications[0]));
  tampered.unresolved_items.push({
    closure_id: 'not-a-live-closure', output_kind: 'OPEN_WORLD', disposition: 'REVIEWED_OPEN_WORLD',
  });
  const { adjudication_id: _id, ...body } = tampered;
  tampered.adjudication_id = contentId(PILOT_ADJUDICATION_SCHEMA, body);
  const rejected = evaluatePilotQualityGate({
    ...input,
    review_packets: packets,
    adjudications: [tampered, adjudications[1]],
    root_dir: ROOT,
  });
  assert.equal(rejected.gate_status, 'FAIL');
  assert.ok(rejected.escalation_work_item_ids.includes('modiv-consideration-2-1'));

  const failedReview = JSON.parse(JSON.stringify(input));
  failedReview.review_findings.find((entry) => entry.work_item_id === 'modiv-consideration-2-1').status = 'FAIL';
  const reviewFailure = evaluatePilotQualityGate({
    ...failedReview,
    review_packets: packets,
    adjudications,
    root_dir: ROOT,
  });
  assert.ok(reviewFailure.rerun_work_item_ids.includes('modiv-consideration-2-1'));

  const residualInput = JSON.parse(JSON.stringify(input));
  residualInput.quality_records.find((entry) => entry.work_item_id === 'modiv-termination-fee-7-3').citation_residual_count = 1;
  const residualFailure = evaluatePilotQualityGate({
    ...residualInput,
    review_packets: packets,
    adjudications,
    root_dir: ROOT,
  });
  assert.equal(residualFailure.gate_status, 'FAIL');
  assert.ok(residualFailure.rerun_work_item_ids.includes('modiv-termination-fee-7-3'));
});
