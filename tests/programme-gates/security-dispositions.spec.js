const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const registry = YAML.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../docs/codex-program/programme-gates.yaml'),
    'utf8',
  ),
).programme_gate_registry;

test('attacker-model security is explicitly deferred to P12 and does not block cutover', () => {
  assert.equal(registry.phase_12_security_gates.phase, 12);
  assert.equal(registry.phase_12_security_gates.state, 'DEFERRED_POST_CUTOVER');
  assert.equal(registry.phase_12_security_gates.blocks_cutover, false);
  assert.ok(registry.phase_12_security_gates.gates.length > 0);
  assert.ok(registry.phase_12_security_gates.gates.every(
    ({ state }) => state === 'DEFERRED_POST_CUTOVER',
  ));
});

test('Tier A still prohibits secrets in evidence, prompts and committed files', () => {
  assert.ok(registry.tier_a_pre_cutover.controls.includes(
    'NO_SECRETS_IN_EVIDENCE_PROMPTS_OR_COMMITTED_FILES',
  ));
});
