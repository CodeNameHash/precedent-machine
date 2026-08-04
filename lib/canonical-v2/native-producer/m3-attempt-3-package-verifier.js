'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { evaluatePilotQualityGate, loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');
const { buildPilotAdjudication } = require('./m3-pilot-adjudication');
const { validateIteration2RerunPlan } = require('./m3-iteration-2-rerun-planner');
const { validateRetainedAdjudicationBindings } = require('./m3-iteration-2-attempt-3-materialiser');
const { validateUnifiedRunManifest } = require('./unified-runner-validate');
const { validateIteration2LiveLaunch } = require('./unified-runner-execute');

const ATTEMPT_3_GATE_ID = '087de488af1767a51b8a9b7ba497a0e775c0042508b4f65a93ebee8c760f120a';
const ATTEMPT_3_RETAIN_WORK_ITEM_IDS = Object.freeze([
  'modiv-consideration-2-1',
  'modiv-termination-fee-7-3',
]);
const ATTEMPT_3_REPLAY_WORK_ITEM_IDS = Object.freeze([
  'skechers-no-other-reps-3-28',
  'topbuild-termination-company-6-3',
]);
const ATTEMPT_3_LIVE_WORK_ITEM_PROFILES = Object.freeze({
  'modiv-antitrust-consents-5-5': 'TERRA_MEDIUM',
  'modiv-closing-conditions-6-1': 'TERRA_MEDIUM',
  'modiv-mae-definition-8-12-g': 'TERRA_MEDIUM',
  'skechers-capitalisation-3-7': 'TERRA_MEDIUM',
  'topbuild-capitalisation-3-1-b': 'TERRA_MEDIUM',
  'topbuild-ioc-company-4-1': 'SOL_HIGH',
  'topbuild-no-shop-company-4-3': 'SOL_HIGH',
  'topbuild-remedies-specific-performance-7-6': 'TERRA_MEDIUM',
});

class Attempt3PackageVerifierError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new Attempt3PackageVerifierError(code, message, details);
}

function sameIds(actual, expected) {
  return Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validateRetainedLedgerBindings({ ledger, plan, retained_adjudication_bindings: bindings } = {}) {
  if (!ledger || ledger.iteration_2_rerun_plan_id !== plan.iteration_2_rerun_plan_id
    || ledger.first_execution_result_id !== plan.first_execution_result_id
    || ledger.quality_gate_id !== plan.quality_gate_id
    || !sameIds((ledger.retained_items || []).map((row) => row && row.work_item_id), ATTEMPT_3_RETAIN_WORK_ITEM_IDS)) {
    fail('ATTEMPT_3_RETAINED_LEDGER_MISMATCH', 'The sealed ledger must cover the exact retained Modiv work-item set and sealed plan bindings.');
  }
  for (const row of ledger.retained_items) {
    const binding = bindings.get(row.work_item_id);
    if (!exactKeys(row, [
      'work_item_id',
      'first_work_result_id',
      'preserved_checkpoint_id',
      'provider_recording_id',
      'review_packet_id',
      'adjudication_id',
    ]) || !binding || row.review_packet_id !== binding.review_packet_id
      || row.adjudication_id !== binding.adjudication_id) {
      fail('ATTEMPT_3_RETAINED_LEDGER_MISMATCH', 'Each retained ledger row must contain the exact sealed review-packet and adjudication IDs.', {
        work_item_id: row.work_item_id,
      });
    }
  }
}

function adjudicationDispositions(packet) {
  return Object.fromEntries([
    ...packet.resolved_output.open_world.map((entry) => [entry.closure_id, 'REVIEWED_OPEN_WORLD']),
    ...packet.resolved_output.review_queue.map((entry) => [entry.closure_id,
      packet.work_item_id === 'modiv-consideration-2-1'
        ? 'DEFINED_TERM_ONLY_NO_NUMERIC_PUBLICATION'
        : 'DEFERRED_TO_GOVERNED_OWNER']),
  ]);
}

function recomputeAttempt3Gate({ review_packet_adapter: adapter, review_findings: findings, root_dir: rootDir = process.cwd() } = {}) {
  if (!adapter || !Array.isArray(adapter.quality_records) || !Array.isArray(adapter.review_packets)
    || !Array.isArray(findings)) {
    fail('INVALID_FIRST_PASS_REVIEW_INPUT', 'The first-pass review adapter and findings must be complete arrays.');
  }
  const packets = adapter.review_packets.filter((packet) => ATTEMPT_3_RETAIN_WORK_ITEM_IDS.includes(packet.work_item_id));
  if (!sameIds(packets.map((packet) => packet.work_item_id), ATTEMPT_3_RETAIN_WORK_ITEM_IDS)) {
    fail('MISSING_MODIV_ADJUDICATION_PACKET', 'The two retained Modiv results require their exact first-pass review packets.');
  }
  const adjudications = packets.map((packet) => buildPilotAdjudication({
    review_packet: packet,
    dispositions_by_closure_id: adjudicationDispositions(packet),
  }));
  let gate;
  try {
    gate = evaluatePilotQualityGate({
      quality_records: adapter.quality_records,
      review_findings: findings,
      review_packets: packets,
      adjudications,
      root_dir: rootDir,
    });
  } catch (error) {
    fail('FIRST_PASS_GATE_RECOMPUTE_FAILED', error.message, { cause: error.code || error.name });
  }
  if (gate.quality_gate_id !== ATTEMPT_3_GATE_ID) {
    fail('ATTEMPT_3_GATE_MISMATCH', 'The first-pass review evidence does not recompute the sealed attempt-3 gate.', {
      expected_quality_gate_id: ATTEMPT_3_GATE_ID,
      actual_quality_gate_id: gate.quality_gate_id,
    });
  }
  return Object.freeze({ gate, adjudications: Object.freeze(adjudications) });
}

function verifyFreshPaths(artifactRoot) {
  if (typeof artifactRoot !== 'string' || !artifactRoot) {
    fail('INVALID_ARTIFACT_ROOT', 'artifact_root must be an existing directory.');
  }
  let root;
  try { root = fs.realpathSync(artifactRoot); } catch { fail('INVALID_ARTIFACT_ROOT', 'artifact_root must be an existing directory.'); }
  const outputPath = path.join(root, 'iteration-2', 'execution-result.json');
  const checkpointPath = path.join(root, 'iteration-2', 'checkpoints');
  if (fs.existsSync(outputPath) || fs.existsSync(checkpointPath)) {
    fail('ITERATION_2_PATH_NOT_FRESH', 'The attempt-3 output and checkpoint paths must be new.', { output_path: outputPath, checkpoint_path: checkpointPath });
  }
  return Object.freeze({ artifact_root: root, output_path: outputPath, checkpoint_path: checkpointPath });
}

function verifyAttempt3Package({
  review_packet_adapter: adapter,
  review_findings: findings,
  plan,
  revised_vector: vector,
  live_manifest: liveManifest,
  controls,
  ledger,
  artifact_root: artifactRoot,
  root_dir: rootDir = process.cwd(),
} = {}) {
  const { gate, adjudications } = recomputeAttempt3Gate({
    review_packet_adapter: adapter,
    review_findings: findings,
    root_dir: rootDir,
  });
  let policy;
  try { policy = validateIteration2RerunPlan({ plan }); } catch (error) {
    fail('INVALID_ATTEMPT_3_PLAN', error.message, { cause: error.code || error.name });
  }
  let retainedAdjudicationBindings;
  try {
    retainedAdjudicationBindings = validateRetainedAdjudicationBindings({
      revised_vector: vector,
      validated_adjudications: adjudications,
    });
  } catch (error) {
    fail('ATTEMPT_3_RETAINED_ADJUDICATION_MISMATCH', error.message, { cause: error.code || error.name });
  }
  if (plan.quality_gate_id !== gate.quality_gate_id
    || plan.controls.first_pass_artifact_mutation !== 'FORBIDDEN'
    || plan.controls.checkpoint_deletion !== 'FORBIDDEN'
    || plan.controls.replay_model_call_count !== 0
    || plan.controls.live_model_call_count !== 8
    || !sameIds(plan.replay_only_work_items.map((item) => item.work_item_id), ATTEMPT_3_REPLAY_WORK_ITEM_IDS)
    || !sameIds(Object.keys(policy.live_work_item_profiles), Object.keys(ATTEMPT_3_LIVE_WORK_ITEM_PROFILES))) {
    fail('ATTEMPT_3_PLAN_ACTION_MISMATCH', 'The plan does not preserve the corrected attempt-3 retain, replay and live action vector.');
  }
  for (const [workItemId, profileId] of Object.entries(ATTEMPT_3_LIVE_WORK_ITEM_PROFILES)) {
    if (policy.live_work_item_profiles[workItemId] !== profileId) {
      fail('ATTEMPT_3_PROFILE_MISMATCH', 'A live work item does not use its required Terra or Sol profile.', { work_item_id: workItemId });
    }
  }
  const pilotIds = loadPilotWorkItems({ root_dir: rootDir }).map((item) => item.work_item_id);
  const retainedIds = pilotIds.filter((id) => !Object.hasOwn(policy.live_work_item_profiles, id)
    && !plan.replay_only_work_items.some((item) => item.work_item_id === id));
  if (!sameIds(retainedIds, ATTEMPT_3_RETAIN_WORK_ITEM_IDS)) {
    fail('ATTEMPT_3_RETAIN_MISMATCH', 'Only the two adjudicated Modiv results may be retained from first pass.');
  }
  validateRetainedLedgerBindings({
    ledger,
    plan,
    retained_adjudication_bindings: retainedAdjudicationBindings,
  });
  let validation;
  try {
    validation = validateUnifiedRunManifest({ manifest: liveManifest, root_dir: rootDir });
    validateIteration2LiveLaunch({
      manifest: liveManifest,
      work_item_controls: controls && controls.work_item_controls,
      ...policy,
    });
  } catch (error) {
    fail('ATTEMPT_3_LIVE_INPUT_MISMATCH', error.message, { cause: error.code || error.name });
  }
  const paths = verifyFreshPaths(artifactRoot);
  return Object.freeze({
    quality_gate_id: gate.quality_gate_id,
    adjudication_ids: Object.freeze(adjudications.map((item) => item.adjudication_id).sort()),
    first_execution_result_id: plan.first_execution_result_id,
    live_work_item_profiles: policy.live_work_item_profiles,
    retained_work_item_ids: Object.freeze([...retainedIds].sort()),
    retained_adjudication_bindings: Object.freeze(Object.fromEntries([...retainedAdjudicationBindings]
      .sort(([left], [right]) => left.localeCompare(right)))),
    replay_only_work_item_ids: Object.freeze([...ATTEMPT_3_REPLAY_WORK_ITEM_IDS]),
    max_model_invocations: policy.max_model_invocations,
    validation_receipt_id: validation.receipt.validation_receipt_id,
    ...paths,
  });
}

module.exports = {
  ATTEMPT_3_GATE_ID,
  ATTEMPT_3_RETAIN_WORK_ITEM_IDS,
  ATTEMPT_3_REPLAY_WORK_ITEM_IDS,
  ATTEMPT_3_LIVE_WORK_ITEM_PROFILES,
  Attempt3PackageVerifierError,
  recomputeAttempt3Gate,
  validateRetainedLedgerBindings,
  verifyAttempt3Package,
};
