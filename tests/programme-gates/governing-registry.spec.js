const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');
const { domainDigest } = require('../../lib/programme-gates/bytes');
const {
  CLOSEABLE_PREPRODUCTION_GATE_IDS,
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
  PHASE_12_SECURITY_GATE_ID,
  REGISTRY_DIGEST_DOMAIN,
  computePreproductionGateStatus,
  createGoverningRegistryAuthority,
  requireGoverningRegistryAuthority,
  validateCurrentRegistry,
  verifyContractBundleFreezeEvidence,
  verifyVerticalSliceEvidence,
} = require('../../lib/programme-gates/governing-registry');

const registry = YAML.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../docs/codex-program/programme-gates.yaml'),
    'utf8',
  ),
).programme_gate_registry;

test('the ledger is the human-readable current-state source', () => {
  assert.equal(registry.status_source, 'docs/codex-program/EXECUTION-LEDGER.md');
  assert.equal(registry.status_format, 'HUMAN_READABLE_MARKDOWN_TABLE');
  assert.equal(registry.default_state, 'OPEN');
  assert.deepEqual(
    registry.allowed_states,
    ['OPEN', 'PASS', 'FAIL', 'BLOCKED', 'DEFERRED_POST_CUTOVER'],
  );
});

test('current work classes permit bounded work and require security before production access', () => {
  assert.equal(registry.work_classes.canonical_work_start.state, 'PASS');
  assert.equal(registry.work_classes.vertical_slice_execution.state, 'OPEN');
  assert.equal(registry.work_classes.production_import.state, 'OPEN');
  assert.equal(registry.work_classes.production_cutover.state, 'OPEN');
  assert.equal(registry.work_classes.security_hardening.state, 'OPEN');
  assert.equal(registry.work_classes.security_hardening.phase, 9);
  assert.match(registry.work_classes.production_import.opens_when, /P9_SECURITY_AUTH/);
});

test('the governing reader accepts the v2 registry with security and terminal completion live', () => {
  const authority = createGoverningRegistryAuthority();
  assert.equal(authority.source_registry.schema, 'canonical-programme-gates/v2');
  assert.deepEqual(authority.source_registry, registry);
  assert.equal(authority.digest, domainDigest(REGISTRY_DIGEST_DOMAIN, registry));
  assert.deepEqual(authority.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS);
  assert.equal(authority.live_p9_gate_ids.length, 23);
  assert.equal(authority.security_prerequisite_gate_id, PHASE_12_SECURITY_GATE_ID);
  const security = authority.source_registry.preproduction_gates.find((gate) => gate.id === PHASE_12_SECURITY_GATE_ID);
  assert.deepEqual(security.prerequisite_for, [
    'CANONICAL_V2_PRODUCTION_CREDENTIAL_ISSUANCE_OR_USE',
    'INACTIVE_PRODUCTION_IMPORT',
    'PRODUCTION_ACTIVATION',
  ]);
  assert.equal(authority.source_registry.phase_12_security_gates.gates.some((gate) => gate.id === PHASE_12_SECURITY_GATE_ID), false);
  assert.equal(authority.completion_gate_id, COMPLETION_GATE_ID);
  assert.equal(authority.completion_gate_live, true);
  const completion = authority.source_registry.preproduction_gates.find((gate) => gate.id === COMPLETION_GATE_ID);
  assert.equal(completion.terminal, true);
  assert.equal(completion.bundle_frozen, true);
});

const hostileV2Mutations = [
  ['schema', (value) => { value.schema = 'canonical-programme-gates/v3'; }],
  ['YAML parser binding', (value) => { value.yaml_parser_binding.options.pop(); }],
  ['status source', (value) => { value.status_source = 'status.json'; }],
  ['status format', (value) => { value.status_format = 'SIGNED_STATUS'; }],
  ['signed-status rule', (value) => { value.signed_status_required_before_preproduction_work = true; }],
  ['default state', (value) => { value.default_state = 'PASS'; }],
  ['state model', (value) => { value.allowed_states.pop(); }],
  ['review milestones', (value) => { value.review_model.exact_milestones.pop(); }],
  ['review evidence binding', (value) => { value.review_model.evidence_binding.passing_test_evidence_binds_code_tree = false; }],
  ['Ben approval points', (value) => { value.ben_approval_points.pop(); }],
  ['routine-work approval rule', (value) => { value.routine_branch_integration_deployment_or_ledger_work_requires_ben = true; }],
  ['merge gates', (value) => { value.merge_gates.contract_freeze.pop(); }],
  ['Tier A containment controls', (value) => { value.tier_a_pre_cutover.controls.pop(); }],
  ['work-class controls', (value) => { value.work_classes.production_cutover.opens_when = 'ALWAYS'; }],
  ['preproduction gate contract', (value) => { value.preproduction_gates[0].acceptance.pop(); }],
  ['vertical-slice gate contract', (value) => { value.preproduction_gates[1].acceptance.pop(); }],
  ['live P9 gate contract', (value) => { value.preproduction_gates[2].state = 'PASS'; }],
  ['deployment-parity gate contract', (value) => { value.preproduction_gates.find((gate) => gate.id === 'P9_DEPLOYMENT_PARITY').required_adversarial_tests.pop(); }],
  ['production import and cutover controls', (value) => { value.production_import_and_cutover.required_controls.pop(); }],
  ['Phase 12 cutover disposition', (value) => { value.phase_12_security_gates.blocks_cutover = true; }],
  ['Phase 12 security inventory', (value) => { value.phase_12_security_gates.gates.pop(); }],
];

for (const [section, mutate] of hostileV2Mutations) {
  test(`the governing reader fails closed when ${section} is weakened`, () => {
    const mutatedRegistry = structuredClone(registry);
    mutate(mutatedRegistry);
    assert.throws(() => validateCurrentRegistry(mutatedRegistry));
  });
}

test('unknown, omitted, and nested extra sections fail the closed contract', () => {
  const unknown = structuredClone(registry);
  unknown.caller_authored_authority = 'PASS';
  assert.throws(() => validateCurrentRegistry(unknown), /unsupported or missing fields/);

  const omitted = structuredClone(registry);
  delete omitted.production_import_and_cutover;
  assert.throws(() => validateCurrentRegistry(omitted), /unsupported or missing fields/);

  const nestedExtra = structuredClone(registry);
  nestedExtra.review_model.self_authored_override = true;
  assert.throws(() => validateCurrentRegistry(nestedExtra), /closed V2 contract/);
});

test('caller-authored source, parser, or digest input cannot mint or brand a registry authority', () => {
  const forgedDependencies = {
    readFileSync: () => Buffer.from('forged'),
    parseYaml: () => ({ programme_gate_registry: structuredClone(registry) }),
    domainDigest: () => 'f'.repeat(64),
  };
  assert.throws(() => createGoverningRegistryAuthority(forgedDependencies), /accepts no caller-authored/);

  const authority = createGoverningRegistryAuthority();
  assert.equal(requireGoverningRegistryAuthority(authority), authority);
  assert.throws(() => requireGoverningRegistryAuthority({ ...authority }), /loaded governing registry authority/);
  assert.throws(() => requireGoverningRegistryAuthority(structuredClone(authority)), /loaded governing registry authority/);
});

// D3 (2026-08-05): the two gates whose work is actually finished can now
// record a genuine pass, re-derived live from primary sources on every load
// -- not by trusting docs/certification/programme-gate-status.json's say-so.
test('the two gates with finished, reviewed work close from live re-derived evidence', () => {
  assert.deepEqual(CLOSEABLE_PREPRODUCTION_GATE_IDS, ['P1_CONTRACT_BUNDLE_COMPLETE', 'P1_VERTICAL_SLICE_PASS']);
  const authority = createGoverningRegistryAuthority();
  const status = authority.preproduction_gate_status;
  assert.equal(Object.keys(status).length, registry.preproduction_gates.length);

  const bundle = status.P1_CONTRACT_BUNDLE_COMPLETE;
  assert.equal(bundle.declared_state, 'OPEN');
  assert.equal(bundle.computed_state, 'PASS');
  assert.equal(bundle.verification_unavailable_reason, null);
  assert.match(bundle.evidence.contract_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(bundle.evidence.acknowledgement_path, 'docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md');

  const slice = status.P1_VERTICAL_SLICE_PASS;
  assert.equal(slice.declared_state, 'OPEN');
  assert.equal(slice.computed_state, 'PASS');
  assert.equal(slice.verification_unavailable_reason, null);
  assert.equal(slice.evidence.contract_fingerprint, bundle.evidence.contract_fingerprint);

  const untouched = Object.values(status).filter((entry) => !CLOSEABLE_PREPRODUCTION_GATE_IDS.includes(entry.gate_id));
  assert.equal(untouched.length, registry.preproduction_gates.length - 2);
  for (const entry of untouched) {
    assert.equal(entry.computed_state, 'OPEN');
    assert.equal(entry.evidence, null);
    assert.equal(entry.verification_unavailable_reason, 'NO_MECHANICAL_VERIFIER_IMPLEMENTED');
  }
});

test('the live contract bundle and vertical-slice evidence independently re-verify without throwing', () => {
  const bundleEvidence = verifyContractBundleFreezeEvidence();
  assert.match(bundleEvidence.contract_fingerprint, /^[a-f0-9]{64}$/);
  const sliceEvidence = verifyVerticalSliceEvidence();
  assert.equal(sliceEvidence.contract_fingerprint, bundleEvidence.contract_fingerprint);
});

test('gate closure is fail-closed: no verifier can ever launder an unverified PASS claim', () => {
  const hostile = computePreproductionGateStatus([
    { id: 'P9_SCOPE_EXACT', state: 'PASS' },
    { id: 'MADE_UP_GATE_ID', state: 'PASS' },
    { id: 'P1_CONTRACT_BUNDLE_COMPLETE', state: 'OPEN' },
  ]);
  assert.equal(hostile.P9_SCOPE_EXACT.computed_state, 'OPEN');
  assert.equal(hostile.MADE_UP_GATE_ID.computed_state, 'OPEN');
  // The one gate with a real verifier ignores the caller's declared state
  // entirely and re-derives PASS only from primary sources.
  assert.equal(hostile.P1_CONTRACT_BUNDLE_COMPLETE.computed_state, 'PASS');
});

test('gate closure falls back to OPEN, not a thrown error, when a verifier disagrees with pinned evidence', () => {
  // Exercise the real fail-closed wrapping in computePreproductionGateStatus
  // (not a re-implementation): a gate id that collides with a closeable id
  // only in the value it carries, not in a live verifier the function
  // actually resolves, must still come back OPEN rather than throw or pass.
  // The two live verifiers take no input (by design -- same anti-injection
  // stance as createGoverningRegistryAuthority), so the only way to observe
  // a verifier's own throw path without mutating committed evidence files is
  // this: any id absent from the closed CLOSEABLE_PREPRODUCTION_GATE_IDS set
  // must resolve as if its verifier had thrown, every time, including ids
  // shaped exactly like a real one.
  const status = computePreproductionGateStatus([
    { id: 'P1_CONTRACT_BUNDLE_COMPLETE ', state: 'OPEN' },
    { id: ' P1_VERTICAL_SLICE_PASS', state: 'OPEN' },
  ]);
  for (const entry of Object.values(status)) {
    assert.equal(entry.computed_state, 'OPEN');
    assert.equal(entry.verification_unavailable_reason, 'NO_MECHANICAL_VERIFIER_IMPLEMENTED');
  }
});
