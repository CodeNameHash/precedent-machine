const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const V2_PATH =
  'process/predicates/process-predicate-witness.v2.json';
const PREDECESSOR_DEFINITION_DIGEST =
  '5316afe5e83e8b4ecadf427d598dae0c395bc80115aacacab353fa0da597f2f7';
const V2_DEFINITION_DIGEST =
  'd0fdcc4377707dad040945adcdeec9e25a60487e17e628ab70a2f576c1f24266';

function member(relativePath) {
  const canonicalValue = JSON.parse(fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8',
  ));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function members() {
  return [
    member('process/agreements/process-agreement.v1.json'),
    member('process/bidder-tracks/bidder-track.v1.json'),
    member('process/domain/process-domain-registry.v1.json'),
    member('process/events/process-event.v1.json'),
    member('process/narration/process-narration-occurrence.v1.json'),
    member('process/occurrence-slots/process-event.v1.json'),
    member('process/occurrence-slots/process-narration.v1.json'),
    member('process/participants/process-participant.v1.json'),
    member('process/passages/process-passage.v1.json'),
    member('process/phases/process-phase.v1.json'),
    member('process/positions/process-position.v1.json'),
    member(V2_PATH),
    member('process/registries/process-controlled-code-registry.v1.json'),
    member('process/relationships/process-relationship.v1.json'),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function witness(values = members()) {
  return values.find(
    (entry) => entry.canonical_value.stable_id
      === 'PROCESS_PREDICATE_WITNESS',
  ).canonical_value;
}

test('registers ProcessPredicateWitness version 2 as the sole successor', () => {
  const values = members();
  assert.doesNotThrow(() => validateAuthoredProcessInputs(values));
  const contract = witness(values);

  assert.equal(contract.definition.logical_type_version, 2);
  assert.deepEqual(contract.definition.predecessor_contract, {
    stable_id: 'PROCESS_PREDICATE_WITNESS',
    schema_version: 'PROCESS_LOGICAL_TYPE_INPUT/V1',
    logical_type_version: 1,
    definition_digest: PREDECESSOR_DEFINITION_DIGEST,
  });
  assert.equal(
    fs.existsSync(path.join(
      ROOT,
      'process/predicates/process-predicate-witness.v1.json',
    )),
    false,
  );
  assert.equal(fs.existsSync(path.join(ROOT, V2_PATH)), true);
});

test('preserves the stable witness identity and moves only revision identity to V2', () => {
  const definition = witness().definition;
  assert.equal(
    definition.witness_identity.stable_id_domain,
    'PROCESS_PREDICATE_WITNESS/V1',
  );
  assert.deepEqual(definition.witness_identity.stable_id_inputs, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_narration_occurrence_id',
    'predicate_definition_key_and_version',
    'predicate_evidence_role_slot_key',
    'governed_ordinal',
  ]);
  assert.equal(
    definition.revision_identity.revision_id_domain,
    'PREDICATE_WITNESS_REVISION/V2',
  );
  assert.deepEqual(definition.revision_identity.immutable_inputs, [
    'applicability_evidence_edges',
    'atomic_response_predicate_key',
    'atomic_response_predicate_witness_revision_id',
    'bidder_track_revision_id',
    'complete_scope_evidence_edges',
    'complete_scope_identity',
    'dimension_revision_bindings',
    'evidence_edges',
    'failure_detail',
    'predicate_key',
    'predicate_state',
    'process_agreement_revision_ids',
    'process_event_revision_id',
    'process_participant_revision_ids',
    'process_passage_revision_ids',
    'process_position_revision_ids',
    'process_predicate_witness_id',
    'process_relationship_revision_ids',
    'source_semantic_kind',
    'subject_code',
    'temporal_expression_revision_ids',
  ]);
});

test('binds full state, successor machine-rule and atomic response semantics', () => {
  const definition = witness().definition;
  assert.deepEqual(definition.state_rules.value_rule_by_state, {
    PRESENT: 'VALUE_AND_EVIDENCE_REQUIRED',
    ABSENT: 'COMPLETE_SCOPE_AND_EVIDENCE_REQUIRED_NO_VALUE',
    NOT_APPLICABLE: 'APPLICABILITY_EVIDENCE_REQUIRED_NO_VALUE',
    NOT_EXAMINED: 'NO_VALUE',
    FAILED: 'FAILURE_DETAIL_REQUIRED_NO_VALUE',
  });
  assert.equal(
    definition.predicate_contract
      .all_18_successor_machine_rules_consumed,
    true,
  );
  assert.equal(
    definition.dimension_contract
      .successor_unlisted_typed_link_families_forbidden,
    true,
  );
  assert.equal(
    definition.response_union_contract
      .present_union_requires_exactly_one_admitted_atomic_witness,
    true,
  );
  assert.equal(
    definition.response_union_contract
      .constituent_predicate_key_subject_state_typed_links_and_evidence_preserved,
    true,
  );
  assert.equal(
    definition.response_union_contract
      .silence_can_become_express_refusal,
    false,
  );
});

test('locks the complete definition digest and rejects semantic weakening', () => {
  const values = members();
  const definition = witness(values).definition;
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(definition), 'utf8')),
    V2_DEFINITION_DIGEST,
  );

  const weakened = clone(values);
  witness(weakened).definition.response_union_contract
    .silence_can_become_express_refusal = true;
  assert.throws(
    () => validateAuthoredProcessInputs(weakened),
    { code: 'INVALID_PROCESS_PREDICATE_WITNESS_INPUT' },
  );
});

test('grants no extraction, writer, serving, release or production authority', () => {
  assert.deepEqual(witness().definition.authority_contract, {
    creates_runtime_witness: false,
    creates_extraction_authority: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  });
});

test('uses the exact bounded canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-process-predicate-witness-v2.json',
  ), 'utf8'));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-process-predicate-witness-v2.json',
    'contracts/canonical-v2/successor/process/predicates/process-predicate-witness.v1.json',
    'contracts/canonical-v2/successor/process/predicates/process-predicate-witness.v2.json',
    'lib/canonical-v2/process-contract-input-validator.js',
    'lib/canonical-v2/process-exclusivity-pilot.js',
    'lib/canonical-v2/process-phrasebook-result-admission.js',
    'tests/canonical-v2-process-contract-input.test.js',
    'tests/canonical-v2-process-controlled-code-registry-contract-input.test.js',
    'tests/canonical-v2-process-event-participant-contract-input.test.js',
    'tests/canonical-v2-process-event-slot-binding-contract-input.test.js',
    'tests/canonical-v2-process-exclusivity-contract-input.test.js',
    'tests/canonical-v2-process-exclusivity-pilot.test.js',
    'tests/canonical-v2-process-object-contract-input.test.js',
    'tests/canonical-v2-process-phrasebook-result-admission.test.js',
    'tests/canonical-v2-process-phrasebook-shared-row-bridge.test.js',
    'tests/canonical-v2-process-predicate-witness-v2-contract-input.test.js',
    'tests/canonical-v2-process-track-phase-contract-input.test.js',
  ]);
});
