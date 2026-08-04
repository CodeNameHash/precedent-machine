'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

const {
  COMPLETION_RATIFICATION,
  PHASE_12_SECURITY_GATE_ID,
  PROPOSAL_STATE,
  compileP9AcceptanceEvidenceInventory,
  validateP9AcceptanceEvidenceInventory,
} = require('../../lib/programme-gates/p9-acceptance-evidence-inventory');
const {
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
  RECOVERED_CANDIDATE_P9_GATE_IDS,
} = require('../../lib/programme-gates/p9-acceptance-definition-authority');

const ROOT = path.resolve(__dirname, '../..');
const registry = YAML.parse(fs.readFileSync(path.join(
  ROOT,
  'docs/codex-program/programme-gates.yaml',
), 'utf8')).programme_gate_registry;
const p9GateIds = registry.preproduction_gates
  .map((gate) => gate.id)
  .filter((gateId) => gateId.startsWith('P9_'));

function inventory() {
  return compileP9AcceptanceEvidenceInventory({ p9GateIds, repositoryRoot: ROOT });
}

test('enumerates the 21 live P9 leaves and only the recovered completion candidate', () => {
  const evidence = inventory();
  assert.deepEqual(evidence.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS);
  assert.deepEqual(evidence.recovered_candidate_p9_gate_ids, RECOVERED_CANDIDATE_P9_GATE_IDS);
  assert.equal(evidence.leaves.length, 22);
  assert.equal(evidence.definition_proposal_binding.live_record_count, 21);
  assert.equal(evidence.definition_proposal_binding.completion_candidate_count, 1);
  assert.equal(evidence.definition_proposal_binding.formal_definition_authority, 'NONE');
  assert.equal(evidence.definition_proposal_binding.predicate_authority, 'NONE');
  assert.equal(evidence.definition_proposal_binding.pass_authority, 'NONE');
  assert.equal(evidence.leaves.at(-1).gate_id, COMPLETION_GATE_ID);
  assert.equal(evidence.leaves.at(-1).required_user_decision, COMPLETION_RATIFICATION);
  assert.equal(validateP9AcceptanceEvidenceInventory(evidence, { p9GateIds, repositoryRoot: ROOT }), true);
});

test('is proposal-only and cites current sources without claiming a built gate mechanism', () => {
  const evidence = inventory();
  for (const leaf of evidence.leaves) {
    assert.equal(leaf.proposal_state, PROPOSAL_STATE);
    assert.equal(leaf.pass_issuance, 'PROHIBITED');
    assert.equal(leaf.buildability, 'NOT_BUILDABLE');
    assert.equal(leaf.governing_contract_paragraph_anchors.length, 2);
    assert.ok(leaf.existing_implementation_citations.length > 0);
    assert.ok(leaf.missing_mechanism.length > 0);
    for (const anchor of leaf.governing_contract_paragraph_anchors) {
      assert.match(anchor.source.source_sha256, /^[a-f0-9]{64}$/);
      assert.match(anchor.source.locator_sha256, /^[a-f0-9]{64}$/);
    }
  }
});

test('references only scenario IDs in the current mandatory adversarial catalogue', () => {
  const catalogue = new Set([...fs.readFileSync(path.join(
    ROOT,
    'docs/codex-program/adversarial-tests.md',
  ), 'utf8').matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]));
  assert.equal(catalogue.size, 289);
  for (const leaf of inventory().leaves) {
    for (const reference of leaf.hostile_test_references) {
      assert.equal(catalogue.has(reference.test_id), true, `${leaf.gate_id} references unknown scenario ${reference.test_id}`);
    }
  }
});

test('rejects a missing leaf, a false user decision, and a claim of buildability without cited code', () => {
  const evidence = inventory();
  assert.throws(
    () => validateP9AcceptanceEvidenceInventory({
      ...evidence,
      leaves: evidence.leaves.slice(0, -1),
    }, { p9GateIds, repositoryRoot: ROOT }),
    /not fail-closed/,
  );
  const falseDecision = structuredClone(evidence);
  falseDecision.leaves[0].required_user_decision = 'BEN_MUST_DECIDE';
  assert.throws(
    () => validateP9AcceptanceEvidenceInventory(falseDecision, { p9GateIds, repositoryRoot: ROOT }),
    /not fail-closed|stale/,
  );
  const falseBuildability = structuredClone(evidence);
  falseBuildability.leaves[0].buildability = 'PARTIALLY_BUILDABLE';
  falseBuildability.leaves[0].existing_implementation_citations = [];
  assert.throws(
    () => validateP9AcceptanceEvidenceInventory(falseBuildability, { p9GateIds, repositoryRoot: ROOT }),
    /not fail-closed|stale/,
  );
});

test('becomes stale when the bound P9 definition proposal set changes', () => {
  const evidence = inventory();
  const changedDefinitionProposal = structuredClone(evidence);
  changedDefinitionProposal.definition_proposal_binding.definition_proposal_layer_id = '0'.repeat(64);
  assert.throws(
    () => validateP9AcceptanceEvidenceInventory(changedDefinitionProposal, { p9GateIds, repositoryRoot: ROOT }),
    /definition proposal binding is stale/i,
  );
});

test('keeps P9_SECURITY_AUTH in Phase 12 only', () => {
  const evidence = inventory();
  assert.equal(evidence.phase_12_security_exclusion.gate_id, PHASE_12_SECURITY_GATE_ID);
  assert.equal(evidence.phase_12_security_exclusion.phase_partition, 'P12_SECURITY_HARDENING_ONLY');
  assert.equal(evidence.phase_12_security_exclusion.blocks_cutover, false);
  const forged = structuredClone(evidence);
  forged.leaves[0].gate_id = PHASE_12_SECURITY_GATE_ID;
  assert.throws(
    () => validateP9AcceptanceEvidenceInventory(forged, { p9GateIds, repositoryRoot: ROOT }),
    /misclassified|not fail-closed|stale/,
  );
});
