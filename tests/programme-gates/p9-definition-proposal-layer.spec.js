'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../../lib/canonical-v2/canonical-bytes');
const layer = require('../../lib/programme-gates/p9-definition-proposal-layer');

const ROOT = path.resolve(__dirname, '../..');

test('builds one exact proposal record for all 23 live P9 leaves', () => {
  const value = layer.buildP9DefinitionProposalLayer({ repository_root: ROOT });
  assert.equal(value.live_p9_gate_ids.length, 23);
  assert.equal(value.complete_p9_gate_ids.length, 23);
  assert.equal(value.records.length, 23);
  assert.equal(value.records.filter((record) => record.partition === 'LIVE_P9_LEAF').length, 22);
  const completion = value.records.at(-1);
  assert.equal(completion.gate_id, 'P9_PROGRAMME_COMPLETION_ATTESTATION');
  assert.equal(completion.partition, 'LIVE_BUNDLE_FROZEN_TERMINAL_LEAF');
  assert.equal(completion.adoption_blocker, layer.ADOPTION_BLOCKER);
  assert.equal(value.records.some((record) => record.gate_id === 'P9_SECURITY_AUTH'), true);
  assert.deepEqual(layer.validateP9DefinitionProposalLayer(value, { repository_root: ROOT }), value);
});

test('binds corrected current scenario IDs, contract anchors, and explicit unknown-threshold blockers', () => {
  const value = layer.buildP9DefinitionProposalLayer({ repository_root: ROOT });
  const databaseSoak = value.records.find((record) => record.gate_id === 'P9_DATABASE_SOAK');
  assert.deepEqual(databaseSoak.required_executable_scenario_ids, ['CAPACITY-LOAD-01', 'QUERY-EXEC-01']);
  assert.equal(databaseSoak.proposed_evidence_object_type, 'DatabaseSoakReport');
  assert.equal(databaseSoak.threshold_state, 'UNKNOWN_OR_UNRATIFIED');
  assert.equal(databaseSoak.contract_anchor.anchor_kind, 'GOVERNING_CONTRACT_PARAGRAPH');
  assert.equal(value.records.every((record) => ['NOT_APPLICABLE_STRUCTURAL_GATE', 'UNKNOWN_OR_UNRATIFIED'].includes(record.threshold_state)), true);
});

test('fails closed on missing record, changed exact keys, stale content identity, predicate authority, or PASS authority', () => {
  const value = layer.buildP9DefinitionProposalLayer({ repository_root: ROOT });
  for (const mutate of [
    (copy) => { copy.records.pop(); },
    (copy) => { copy.records[0].extra = true; },
    (copy) => { copy.records[0].definition_proposal_id = '0'.repeat(64); },
    (copy) => { copy.predicate_authority = 'GRANTED'; },
    (copy) => { copy.pass_authority = 'GRANTED'; },
  ]) {
    const changed = structuredClone(value); mutate(changed);
    assert.throws(() => layer.validateP9DefinitionProposalLayer(changed, { repository_root: ROOT }));
  }
  const record = value.records[0];
  const { definition_proposal_id: ignored, ...body } = record;
  assert.equal(contentId(layer.RECORD_SCHEMA, body), record.definition_proposal_id);
});

test('has no executable predicate, live registration, adoption, or PASS issuance path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/programme-gates/p9-definition-proposal-layer.js'), 'utf8');
  assert.doesNotMatch(source, /ACCEPTANCE_PREDICATES|createProgrammeGateEvidenceValidator|verifySignature|register.*live|issue.*PASS|activate_candidate_release|INSERT\s+INTO|UPDATE\s+|DELETE\s+/i);
});
