'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ATTEMPT_3_GATE_ID,
  ATTEMPT_3_REPLAY_WORK_ITEM_IDS,
  ATTEMPT_3_RETAIN_WORK_ITEM_IDS,
  Attempt3PackageVerifierError,
  recomputeAttempt3Gate,
  validateRetainedLedgerBindings,
  verifyAttempt3Package,
} = require('../lib/canonical-v2/native-producer/m3-attempt-3-package-verifier');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const REVIEW_ROOT = path.join(ARTIFACT_ROOT, 'final-output');
const ATTEMPT_2_ROOT = path.join(ARTIFACT_ROOT, 'iteration-2-preparation', 'attempt-2');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function firstPassInputs() {
  return {
    review_packet_adapter: loadJson(path.join(REVIEW_ROOT, 'review-packet-adapter.json')),
    review_findings: [
      ...loadJson(path.join(REVIEW_ROOT, 'independent-first-six-review-findings.json')).findings,
      ...loadJson(path.join(REVIEW_ROOT, 'independent-last-six-review-findings.json')).findings,
    ],
  };
}

const hash = (value) => value.repeat(64).slice(0, 64);

function retainedLedgerFixture() {
  const plan = {
    iteration_2_rerun_plan_id: hash('a'),
    first_execution_result_id: hash('b'),
    quality_gate_id: hash('c'),
  };
  const bindings = new Map([
    ['modiv-consideration-2-1', { review_packet_id: hash('d'), adjudication_id: hash('e') }],
    ['modiv-termination-fee-7-3', { review_packet_id: hash('f'), adjudication_id: hash('0') }],
  ]);
  const ledger = {
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    first_execution_result_id: plan.first_execution_result_id,
    quality_gate_id: plan.quality_gate_id,
    retained_items: [
      {
        work_item_id: 'modiv-consideration-2-1', first_work_result_id: hash('1'),
        preserved_checkpoint_id: hash('2'), provider_recording_id: hash('3'),
        review_packet_id: hash('d'), adjudication_id: hash('e'),
      },
      {
        work_item_id: 'modiv-termination-fee-7-3', first_work_result_id: hash('4'),
        preserved_checkpoint_id: hash('5'), provider_recording_id: hash('6'),
        review_packet_id: hash('f'), adjudication_id: hash('0'),
      },
    ],
  };
  return { plan, bindings, ledger };
}

test('independently recomputes the corrected gate from first-pass packets, findings and Modiv adjudications', {
  skip: !fs.existsSync(path.join(REVIEW_ROOT, 'review-packet-adapter.json')),
}, () => {
  const result = recomputeAttempt3Gate({ ...firstPassInputs(), root_dir: ROOT });
  assert.equal(result.gate.quality_gate_id, ATTEMPT_3_GATE_ID);
  assert.deepEqual(result.gate.rerun_work_item_ids.length, 10);
  assert.deepEqual(result.adjudications.map((item) => item.work_item_id).sort(), ATTEMPT_3_RETAIN_WORK_ITEM_IDS);
});

test('refuses the prior attempt reference before it can be treated as an attempt-3 full plan', {
  skip: !fs.existsSync(path.join(ATTEMPT_2_ROOT, 'sealed-plan.json')),
}, () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'm3-attempt-3-verifier-'));
  try {
    assert.throws(
      () => verifyAttempt3Package({
        ...firstPassInputs(),
        plan: loadJson(path.join(ATTEMPT_2_ROOT, 'sealed-plan.json')),
        live_manifest: { schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1', sources: [], work_items: [] },
        controls: { schema_version: 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1', work_item_controls: [] },
        artifact_root: temporaryRoot,
        root_dir: ROOT,
      }),
      (error) => error instanceof Attempt3PackageVerifierError && error.code === 'INVALID_ATTEMPT_3_PLAN',
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('the corrected action vector fixes exactly two retained and two replay-only items', () => {
  assert.deepEqual(ATTEMPT_3_RETAIN_WORK_ITEM_IDS, [
    'modiv-consideration-2-1',
    'modiv-termination-fee-7-3',
  ]);
  assert.deepEqual(ATTEMPT_3_REPLAY_WORK_ITEM_IDS, [
    'skechers-no-other-reps-3-28',
    'topbuild-termination-company-6-3',
  ]);
});

test('requires each retained ledger row to carry its exact validated review-packet and adjudication IDs', () => {
  const { plan, bindings, ledger } = retainedLedgerFixture();
  assert.doesNotThrow(() => validateRetainedLedgerBindings({
    ledger,
    plan,
    retained_adjudication_bindings: bindings,
  }));
  ledger.retained_items[0].adjudication_id = hash('7');
  assert.throws(
    () => validateRetainedLedgerBindings({
      ledger,
      plan,
      retained_adjudication_bindings: bindings,
    }),
    (error) => error instanceof Attempt3PackageVerifierError && error.code === 'ATTEMPT_3_RETAINED_LEDGER_MISMATCH',
  );
});
