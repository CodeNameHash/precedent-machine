'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const JOINT_SWEEP_CONFIG_SCHEMA = 'STAGE_2Y_JOINT_SWEEP_CONFIG/V1';
const JOINT_SWEEP_RUN_SCHEMA = 'STAGE_2Y_JOINT_SWEEP_RUN/V1';
const ORDINAL_CONTROLS = Object.freeze([
  Object.freeze({ mechanism_id: 'CONTEXT_WINDOW', max_rung: 4 }),
  Object.freeze({ mechanism_id: 'CORROBORATION_STRICTNESS', max_rung: 4 }),
  Object.freeze({ mechanism_id: 'DEFINED_TERMS', max_rung: 3 }),
  Object.freeze({ mechanism_id: 'NUMERALS', max_rung: 3 }),
  Object.freeze({ mechanism_id: 'LEXICAL_NET', max_rung: 2 }),
  Object.freeze({ mechanism_id: 'TOPIC_CLASSIFICATION', max_rung: 3 }),
]);
const BINARY_CONTROLS = Object.freeze([
  'DUPLICATE_SUPPRESSION',
  'QUALIFIER_DISPATCH',
  'OPEN_WORLD_PROMOTION_REGISTRY_ACTIVATION',
]);

function fail(code, message) {
  throw new Error(`${code}: ${message}`);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.keys(value).sort().map((key) => [key, freeze(value[key])] )));
  }
  return value;
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(code, 'fields do not match the versioned contract');
  }
}

function controlKeys() {
  return ORDINAL_CONTROLS.map((entry) => entry.mechanism_id).sort();
}

function validateControlRungs(value, { require_inert_defaults: requireInertDefaults = false } = {}) {
  exactKeys(value, controlKeys(), 'JOINT_SWEEP_CONFIG_CONTROL_SCHEMA');
  const normalised = {};
  for (const control of ORDINAL_CONTROLS) {
    const rung = value[control.mechanism_id];
    if (!Number.isInteger(rung) || rung < 0 || rung > control.max_rung) {
      fail('JOINT_SWEEP_CONFIG_RUNG_INVALID', `${control.mechanism_id} rung is invalid`);
    }
    if (requireInertDefaults && rung !== 0) fail('JOINT_SWEEP_CONFIG_DEFAULT_NOT_INERT', `${control.mechanism_id} must default to rung 0`);
    normalised[control.mechanism_id] = rung;
  }
  return normalised;
}

function validateBinaryControls(value) {
  exactKeys(value, BINARY_CONTROLS, 'JOINT_SWEEP_CONFIG_BINARY_SCHEMA');
  const normalised = {};
  for (const control of BINARY_CONTROLS) {
    if (value[control] !== false) fail('JOINT_SWEEP_CONFIG_BINARY_CONTROL_ENABLED', `${control} must default to false`);
    normalised[control] = false;
  }
  return normalised;
}

function unsealedBody(value) {
  exactKeys(value, ['binary_controls', 'control_rungs', 'selected_joint_rungs'], 'JOINT_SWEEP_CONFIG_SCHEMA');
  return {
    schema_version: JOINT_SWEEP_CONFIG_SCHEMA,
    control_rungs: validateControlRungs(value.control_rungs, { require_inert_defaults: true }),
    binary_controls: validateBinaryControls(value.binary_controls),
    selected_joint_rungs: value.selected_joint_rungs === null ? null : validateControlRungs(value.selected_joint_rungs),
  };
}

function buildJointSweepConfig(value = {}) {
  const supplied = clone(value);
  const hasIdentity = Object.hasOwn(supplied, 'joint_sweep_config_id');
  let candidate = supplied;
  if (hasIdentity) {
    exactKeys(supplied, ['binary_controls', 'control_rungs', 'joint_sweep_config_id', 'schema_version', 'selected_joint_rungs'], 'JOINT_SWEEP_CONFIG_SCHEMA');
    if (supplied.schema_version !== JOINT_SWEEP_CONFIG_SCHEMA) fail('JOINT_SWEEP_CONFIG_SCHEMA', 'schema version is not recognised');
    candidate = {
      binary_controls: supplied.binary_controls,
      control_rungs: supplied.control_rungs,
      selected_joint_rungs: supplied.selected_joint_rungs,
    };
  } else if (Object.hasOwn(supplied, 'schema_version')) {
    exactKeys(supplied, ['binary_controls', 'control_rungs', 'schema_version', 'selected_joint_rungs'], 'JOINT_SWEEP_CONFIG_SCHEMA');
    if (supplied.schema_version !== JOINT_SWEEP_CONFIG_SCHEMA) fail('JOINT_SWEEP_CONFIG_SCHEMA', 'schema version is not recognised');
    candidate = {
      binary_controls: supplied.binary_controls,
      control_rungs: supplied.control_rungs,
      selected_joint_rungs: supplied.selected_joint_rungs,
    };
  }
  const body = unsealedBody(candidate);
  const sealed = { ...body, joint_sweep_config_id: contentId(JOINT_SWEEP_CONFIG_SCHEMA, body) };
  if (hasIdentity && supplied.joint_sweep_config_id !== sealed.joint_sweep_config_id) {
    fail('JOINT_SWEEP_CONFIG_IDENTITY_MISMATCH', 'configuration identity does not seal its content');
  }
  return freeze(sealed);
}

function runDescriptor({ run_kind: runKind, mechanism_id: mechanismId = null, rung = null, omitted_mechanism_id: omittedMechanismId = null, no_effect_because_selected_rung_zero: noEffectBecauseSelectedRungZero = null, control_rungs: controlRungs, binary_controls: binaryControls }) {
  return freeze({
    run_kind: runKind,
    mechanism_id: mechanismId,
    rung,
    omitted_mechanism_id: omittedMechanismId,
    ...(noEffectBecauseSelectedRungZero === null ? {} : { no_effect_because_selected_rung_zero: noEffectBecauseSelectedRungZero }),
    control_rungs: controlRungs,
    binary_controls: binaryControls,
  });
}

function buildJointSweepPlan(value = {}) {
  const config = buildJointSweepConfig(value);
  const baseline = config.control_rungs;
  const oneAtATime = [];
  for (const control of ORDINAL_CONTROLS) {
    for (let rung = 1; rung <= control.max_rung; rung += 1) {
      oneAtATime.push(runDescriptor({
        run_kind: 'ONE_AT_A_TIME',
        mechanism_id: control.mechanism_id,
        rung,
        control_rungs: { ...baseline, [control.mechanism_id]: rung },
        binary_controls: config.binary_controls,
      }));
    }
  }
  if (config.selected_joint_rungs === null) {
    return freeze({ config, baseline: runDescriptor({ run_kind: 'BASELINE', control_rungs: baseline, binary_controls: config.binary_controls }), one_at_a_time: oneAtATime, joint_point: null, leave_one_out: [] });
  }
  const jointPoint = runDescriptor({
    run_kind: 'JOINT',
    control_rungs: config.selected_joint_rungs,
    binary_controls: config.binary_controls,
  });
  const leaveOneOut = ORDINAL_CONTROLS.map((control) => runDescriptor({
    run_kind: 'LEAVE_ONE_OUT',
    omitted_mechanism_id: control.mechanism_id,
    no_effect_because_selected_rung_zero: config.selected_joint_rungs[control.mechanism_id] === 0,
    control_rungs: { ...config.selected_joint_rungs, [control.mechanism_id]: 0 },
    binary_controls: config.binary_controls,
  }));
  return freeze({ config, baseline: runDescriptor({ run_kind: 'BASELINE', control_rungs: baseline, binary_controls: config.binary_controls }), one_at_a_time: oneAtATime, joint_point: jointPoint, leave_one_out: leaveOneOut });
}

function runBlockedJointSweep({ config, human_anchor_gate: humanAnchorGate, replay_driver: replayDriver = null } = {}) {
  const plan = buildJointSweepPlan(config);
  if (typeof replayDriver !== 'function' && replayDriver !== null) fail('JOINT_SWEEP_REPLAY_DRIVER_INVALID', 'replay driver must be a function or null');
  if (!humanAnchorGate || typeof humanAnchorGate !== 'object' || humanAnchorGate.closed !== true
    || humanAnchorGate.reason !== 'HUMAN_ANCHOR_REVIEW_PENDING'
    || humanAnchorGate.reviewed_cards !== 0 || !Number.isInteger(humanAnchorGate.total_cards)
    || humanAnchorGate.total_cards < 1 || humanAnchorGate.publication_authorisation !== 'NONE') {
    fail('JOINT_SWEEP_HUMAN_ANCHOR_GATE_INVALID', 'a zero-decision human-anchor gate is required before replay');
  }
  return freeze({
    schema_version: JOINT_SWEEP_RUN_SCHEMA,
    status: 'BLOCKED_HUMAN_ANCHOR_UNREVIEWED',
    publication_authorisation: 'NONE',
    replay_driver_calls: 0,
    human_anchor_gate: clone(humanAnchorGate),
    joint_confirmation: null,
    calibration_authority: null,
    per_family_measurements: {
      status: 'NOT_RUN',
      reason: 'HUMAN_ANCHOR_UNREVIEWED',
      measurements: [],
    },
    plan,
  });
}

function sealJointSweepRunEvidence(value) {
  const body = clone(value);
  if (body.schema_version !== JOINT_SWEEP_RUN_SCHEMA || Object.hasOwn(body, 'artifact_id')) {
    fail('JOINT_SWEEP_RUN_SCHEMA', 'run evidence must carry the current schema and no pre-existing artifact id');
  }
  return freeze({ ...body, artifact_id: contentId(JOINT_SWEEP_RUN_SCHEMA, body) });
}

module.exports = Object.freeze({
  JOINT_SWEEP_CONFIG_SCHEMA,
  JOINT_SWEEP_RUN_SCHEMA,
  ORDINAL_CONTROLS,
  BINARY_CONTROLS,
  buildJointSweepConfig,
  buildJointSweepPlan,
  runBlockedJointSweep,
  sealJointSweepRunEvidence,
});
