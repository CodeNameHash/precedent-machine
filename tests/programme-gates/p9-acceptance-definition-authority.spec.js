const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const {
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
  GOVERNING_INVENTORY_CONFLICT,
  RECOVERED_CANDIDATE_P9_GATE_IDS,
  compileP9AcceptanceDefinitionAuthority,
  validateP9AcceptanceDefinitionAuthority,
} = require('../../lib/programme-gates/p9-acceptance-definition-authority');

const registry = YAML.parse(fs.readFileSync(path.resolve(
  __dirname,
  '../../docs/codex-program/programme-gates.yaml',
), 'utf8')).programme_gate_registry;

const p9GateIds = registry.preproduction_gates
  .map((gate) => gate.id)
  .filter((gateId) => gateId.startsWith('P9_'));

test('records the live 21-leaf inventory and the recovered 22-leaf conflict without adopting it', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  assert.deepEqual(authority.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS);
  assert.deepEqual(authority.recovered_candidate_p9_gate_ids, RECOVERED_CANDIDATE_P9_GATE_IDS);
  assert.equal(authority.live_p9_gate_ids.length, 21);
  assert.equal(authority.recovered_candidate_p9_gate_ids.length, 22);
  assert.equal(authority.recovered_candidate_p9_gate_ids.at(-1), COMPLETION_GATE_ID);
  assert.deepEqual(authority.governing_inventory_conflict, GOVERNING_INVENTORY_CONFLICT);
  assert.equal(validateP9AcceptanceDefinitionAuthority(authority, { p9GateIds }), true);
});

test('uses one deterministic scope inventory but cannot issue definitions or PASS', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  assert.equal(
    authority.scope_inventory_rule.inventory_model,
    'ONE_DETERMINISTIC_COMPLETE_CORPUS_SCOPE_INVENTORY',
  );
  assert.deepEqual(authority.scope_inventory_rule.required_validation, [
    'FOCUSED_CORRECTNESS_TESTS',
    'HOSTILE_CORRECTNESS_TESTS',
  ]);
  assert.equal(authority.scope_inventory_rule.dual_independent_rule,
    'GOLDEN_EXTRACTION_COMPARISON_ONLY');
  assert.equal(authority.pass_issuance, 'PROHIBITED');
  assert.ok(authority.leaves.every((leaf) => (
    leaf.definition_state === 'DRAFT_BLOCKED_EXECUTABLE_PREDICATE'
      && leaf.pass_issuance === 'PROHIBITED'
      && leaf.formal_definition_issuance.includes('PROHIBITED')
  )));
});

test('does not invent nine new Ben decisions from the obsolete proposal', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  const decisions = authority.leaves.filter((leaf) => leaf.required_ben_decision !== null);
  assert.deepEqual(decisions.map((leaf) => leaf.gate_id), [COMPLETION_GATE_ID]);
  assert.equal(decisions[0].required_ben_decision,
    'P9_COMPLETION_LEAF_RATIFICATION_REQUIRED');
});

test('hostile drift cannot hide the conflict, add security, restore dual inventory, or issue PASS', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  assert.throws(
    () => compileP9AcceptanceDefinitionAuthority({
      p9GateIds: [...p9GateIds, 'P9_SECURITY_AUTH'],
    }),
    /recorded governing conflict/,
  );
  assert.throws(
    () => validateP9AcceptanceDefinitionAuthority({
      ...authority,
      governing_inventory_conflict: null,
    }, { p9GateIds }),
    /not fail-closed/,
  );
  assert.throws(
    () => validateP9AcceptanceDefinitionAuthority({
      ...authority,
      scope_inventory_rule: {
        ...authority.scope_inventory_rule,
        inventory_model: 'TWO_INDEPENDENT_SCOPE_ENUMERATORS',
      },
    }, { p9GateIds }),
    /not fail-closed/,
  );
  const tamperedLeaves = authority.leaves.map((leaf) => (
    leaf.gate_id === 'P9_SCOPE_EXACT'
      ? { ...leaf, definition_state: 'PASS' }
      : leaf
  ));
  assert.throws(
    () => validateP9AcceptanceDefinitionAuthority({
      ...authority,
      leaves: tamperedLeaves,
    }, { p9GateIds }),
    /not fail-closed/,
  );
});
