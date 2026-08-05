const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const { domainDigest } = require('../../lib/programme-gates/bytes');

const {
  AUTHORITY_ID_DOMAIN,
  COMPLETION_GATE_ID,
  COMPLETE_P9_GATE_IDS,
  CURRENT_LIVE_P9_GATE_IDS,
  GOVERNING_INVENTORY_DECISION,
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

test('records the 23 live leaves with security and ratified terminal completion', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  assert.deepEqual(authority.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS);
  assert.deepEqual(authority.complete_p9_gate_ids, COMPLETE_P9_GATE_IDS);
  assert.equal(authority.live_p9_gate_ids.length, 23);
  assert.equal(authority.complete_p9_gate_ids.at(-1), COMPLETION_GATE_ID);
  assert.deepEqual(authority.governing_inventory_decision, GOVERNING_INVENTORY_DECISION);
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

test('records no pending Ben decision after ratification', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  const decisions = authority.leaves.filter((leaf) => leaf.required_ben_decision !== null);
  assert.deepEqual(decisions, []);
  const completion = authority.leaves.at(-1);
  assert.equal(completion.recovery_state, 'LIVE_RATIFIED_BUNDLE_FROZEN_TERMINAL_DEFINITION_NOT_ADOPTED');
});

test('hostile drift cannot remove security or completion, restore dual inventory, or issue PASS', () => {
  const authority = compileP9AcceptanceDefinitionAuthority({ p9GateIds });
  assert.throws(
    () => compileP9AcceptanceDefinitionAuthority({
      p9GateIds: p9GateIds.filter((gateId) => gateId !== 'P9_SECURITY_AUTH'),
    }),
    /recorded governing conflict/,
  );
  assert.throws(
    () => validateP9AcceptanceDefinitionAuthority({
      ...authority,
      governing_inventory_decision: null,
    }, { p9GateIds }),
    /not fail-closed/,
  );
  const rehashedDecisionForgery = structuredClone(authority);
  rehashedDecisionForgery.governing_inventory_decision.authority = 'PRODUCTION_AUTHORITY';
  delete rehashedDecisionForgery.governing_inventory_decision.production_access_prerequisite;
  const payload = {
    schema_version: rehashedDecisionForgery.schema_version,
    live_p9_gate_ids: rehashedDecisionForgery.live_p9_gate_ids,
    complete_p9_gate_ids: rehashedDecisionForgery.complete_p9_gate_ids,
    governing_inventory_decision: rehashedDecisionForgery.governing_inventory_decision,
    scope_inventory_rule: rehashedDecisionForgery.scope_inventory_rule,
    leaves: rehashedDecisionForgery.leaves,
    formal_definition_issuance: rehashedDecisionForgery.formal_definition_issuance,
    pass_issuance: rehashedDecisionForgery.pass_issuance,
  };
  const forgedDigest = domainDigest(AUTHORITY_ID_DOMAIN, payload);
  rehashedDecisionForgery.authority_id = forgedDigest;
  rehashedDecisionForgery.authority_digest = forgedDigest;
  assert.throws(
    () => validateP9AcceptanceDefinitionAuthority(rehashedDecisionForgery, { p9GateIds }),
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
