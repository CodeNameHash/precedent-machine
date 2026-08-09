'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'evidence/canonical-v2/stage-2y-0-joint-sweep-config.json');
const OUTPUT_PATH = path.join(ROOT, 'evidence/canonical-v2/stage-2y-0-joint-sweep.json');
const SCRIPT = path.join(ROOT, 'scripts/stage-2y-0-joint-sweep.mjs');
const {
  JOINT_SWEEP_CONFIG_SCHEMA,
  JOINT_SWEEP_RUN_SCHEMA,
  buildJointSweepConfig,
  buildJointSweepPlan,
  runBlockedJointSweep,
} = require('../lib/canonical-v2/stage-2y-joint-sweep');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function defaultConfig(overrides = {}) {
  return buildJointSweepConfig({
    control_rungs: {
      CONTEXT_WINDOW: 0,
      CORROBORATION_STRICTNESS: 0,
      DEFINED_TERMS: 0,
      NUMERALS: 0,
      LEXICAL_NET: 0,
      TOPIC_CLASSIFICATION: 0,
    },
    binary_controls: {
      DUPLICATE_SUPPRESSION: false,
      QUALIFIER_DISPATCH: false,
      OPEN_WORLD_PROMOTION_REGISTRY_ACTIVATION: false,
    },
    selected_joint_rungs: null,
    ...overrides,
  });
}

function selectedConfig() {
  return defaultConfig({
    selected_joint_rungs: {
      CONTEXT_WINDOW: 1,
      CORROBORATION_STRICTNESS: 1,
      DEFINED_TERMS: 1,
      NUMERALS: 1,
      LEXICAL_NET: 1,
      TOPIC_CLASSIFICATION: 1,
    },
  });
}

test('default configuration is sealed and keeps every control inert', () => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  assert.equal(config.schema_version, JOINT_SWEEP_CONFIG_SCHEMA);
  assert.equal(config.selected_joint_rungs, null);
  assert.deepEqual(config.control_rungs, {
    CONTEXT_WINDOW: 0,
    CORROBORATION_STRICTNESS: 0,
    DEFINED_TERMS: 0,
    LEXICAL_NET: 0,
    NUMERALS: 0,
    TOPIC_CLASSIFICATION: 0,
  });
  assert.equal(Object.values(config.binary_controls).every((value) => value === false), true);
  assert.doesNotThrow(() => buildJointSweepConfig(config));
});

test('one-at-a-time schedule changes only one ordinal control at a time', () => {
  const plan = buildJointSweepPlan(defaultConfig());
  assert.equal(plan.one_at_a_time.length, 19);
  for (const run of plan.one_at_a_time) {
    const nonZero = Object.entries(run.control_rungs).filter(([, rung]) => rung !== 0);
    assert.deepEqual(nonZero, [[run.mechanism_id, run.rung]]);
    assert.deepEqual(run.binary_controls, defaultConfig().binary_controls);
  }
  assert.equal(plan.joint_point, null);
  assert.deepEqual(plan.leave_one_out, []);
});

test('a sealed selected configuration has one joint point and six leave-one-out replays', () => {
  const plan = buildJointSweepPlan(selectedConfig());
  assert.deepEqual(plan.joint_point.control_rungs, selectedConfig().selected_joint_rungs);
  assert.equal(plan.leave_one_out.length, 6);
  for (const replay of plan.leave_one_out) {
    assert.equal(replay.control_rungs[replay.omitted_mechanism_id], 0);
    for (const [mechanism, rung] of Object.entries(selectedConfig().selected_joint_rungs)) {
      if (mechanism !== replay.omitted_mechanism_id) assert.equal(replay.control_rungs[mechanism], rung);
    }
  }
});

test('a selected rung of zero still has a declared no-effect leave-one-out replay', () => {
  const selected = selectedConfig();
  const body = structuredClone(selected);
  body.selected_joint_rungs.DEFINED_TERMS = 0;
  delete body.joint_sweep_config_id;
  const plan = buildJointSweepPlan(body);
  assert.equal(plan.leave_one_out.length, 6);
  const definedTerms = plan.leave_one_out.find((entry) => entry.omitted_mechanism_id === 'DEFINED_TERMS');
  assert.equal(definedTerms.no_effect_because_selected_rung_zero, true);
  assert.equal(definedTerms.control_rungs.DEFINED_TERMS, 0);
});

test('configuration fails closed for a changed default, enabled binary switch, or unsealed content', () => {
  const nonZero = structuredClone(defaultConfig());
  nonZero.control_rungs.NUMERALS = 1;
  assert.throws(() => buildJointSweepConfig(nonZero), /JOINT_SWEEP_CONFIG_DEFAULT_NOT_INERT/);

  const binary = structuredClone(defaultConfig());
  binary.binary_controls.DUPLICATE_SUPPRESSION = true;
  assert.throws(() => buildJointSweepConfig(binary), /JOINT_SWEEP_CONFIG_BINARY_CONTROL_ENABLED/);

  const forged = structuredClone(defaultConfig());
  forged.joint_sweep_config_id = digest('forged');
  assert.throws(() => buildJointSweepConfig(forged), /JOINT_SWEEP_CONFIG_IDENTITY_MISMATCH/);

  const ergonomic = structuredClone(defaultConfig());
  delete ergonomic.joint_sweep_config_id;
  assert.doesNotThrow(() => buildJointSweepConfig(ergonomic));
  ergonomic.schema_version = 'WRONG/V1';
  assert.throws(() => buildJointSweepConfig(ergonomic), /JOINT_SWEEP_CONFIG_SCHEMA/);
});

test('an unreviewed human anchor blocks before any replay and creates no authority', () => {
  let driverCalls = 0;
  const result = runBlockedJointSweep({
    config: defaultConfig(),
    human_anchor_gate: {
      closed: true,
      reason: 'HUMAN_ANCHOR_REVIEW_PENDING',
      reviewed_cards: 0,
      total_cards: 80,
      publication_authorisation: 'NONE',
    },
    replay_driver: () => { driverCalls += 1; },
  });
  assert.equal(driverCalls, 0);
  assert.equal(result.status, 'BLOCKED_HUMAN_ANCHOR_UNREVIEWED');
  assert.equal(result.replay_driver_calls, 0);
  assert.equal(result.joint_confirmation, null);
  assert.equal(result.calibration_authority, null);
  assert.equal(result.publication_authorisation, 'NONE');
  assert.deepEqual(result.per_family_measurements, {
    status: 'NOT_RUN',
    reason: 'HUMAN_ANCHOR_UNREVIEWED',
    measurements: [],
  });
});

test('runner records B/D evidence blockers separately and remains deterministic', () => {
  const run = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  assert.equal(output.status, 'BLOCKED_HUMAN_ANCHOR_UNREVIEWED');
  assert.equal(output.replay_driver_calls, 0);
  assert.equal(output.joint_confirmation, null);
  assert.equal(output.calibration_authority, null);
  assert.deepEqual(output.per_family_measurements, {
    status: 'NOT_RUN',
    reason: 'HUMAN_ANCHOR_UNREVIEWED',
    measurements: [],
  });
  const body = structuredClone(output);
  delete body.artifact_id;
  assert.equal(output.schema_version, JOINT_SWEEP_RUN_SCHEMA);
  assert.equal(output.artifact_id, contentId(JOINT_SWEEP_RUN_SCHEMA, body));
  assert.equal(output.evidence_blockers.b_d.false_no_definition_missing_kdt_evidence.count, 18);
  assert.equal(output.evidence_blockers.b_d.true_agreement_definition_absence.count, 3);
  assert.deepEqual(output.evidence_blockers.b_d.not_assessable, [{
    deal: 'modiv',
    family: 'REPRESENTATIONS',
    reason: 'MISSING_FINAL_CORPUS_DEFINED_TERM_BINDING',
  }]);
});
