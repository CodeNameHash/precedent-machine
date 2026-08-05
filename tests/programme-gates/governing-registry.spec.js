const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');
const { domainDigest } = require('../../lib/programme-gates/bytes');
const {
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
  PHASE_12_SECURITY_GATE_ID,
  REGISTRY_DIGEST_DOMAIN,
  createGoverningRegistryAuthority,
  requireGoverningRegistryAuthority,
  validateCurrentRegistry,
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
