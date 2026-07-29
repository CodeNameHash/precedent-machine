const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function processMembers() {
  return [
    loadMember('process/domain/process-domain-registry.v1.json'),
    loadMember('process/narration/process-narration-occurrence.v1.json'),
    loadMember('process/occurrence-slots/process-narration.v1.json'),
  ];
}

test('compiles the bounded Process narration contracts deterministically without freeze authority', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });
  const processEntries = first.authored_members.filter(
    (member) => member.relative_path.startsWith('process/'),
  );

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.authored_members.length, 89);
  assert.deepEqual(
    processEntries.map((member) => [member.object_kind, member.stable_id]),
    [
      ['PROCESS_DOMAIN_REGISTRY_INPUT', 'PROCESS'],
      ['PROCESS_LOGICAL_TYPE_INPUT', 'PROCESS_NARRATION_OCCURRENCE'],
      ['PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT', 'PROCESS_NARRATION'],
    ],
  );
  assert.equal(first.authored_universe_assessment.status, 'NOT_ASSESSED');
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(first, 'canonical_contract_bundle'), false);
});

test('binds narration identity to exact source intervals before candidate values', () => {
  const members = processMembers();
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members));

  const narration = members.find(
    (member) => member.object_kind === 'PROCESS_LOGICAL_TYPE_INPUT',
  ).canonical_value.definition;
  const slot = members.find(
    (member) => member.object_kind === 'PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT',
  ).canonical_value.definition;

  assert.deepEqual(
    narration.occurrence_identity.stable_id_inputs,
    slot.identity_inputs,
  );
  assert.equal(narration.source_interval_contract.coordinate_space, 'ADMITTED_SOURCE_UTF8_BYTES');
  assert.equal(narration.source_interval_contract.occurrence_independent, true);
  assert.equal(narration.ordinal_contract.frozen_before_candidate_values, true);
  assert.equal(narration.type_contract.event_composition_required_for_real_world_event, true);
  assert.equal(narration.ownership_contract.event_identity_equivalence_implied, false);
});

test('grants no current writer, serving or release authority', () => {
  const members = processMembers();
  const registry = members.find(
    (member) => member.object_kind === 'PROCESS_DOMAIN_REGISTRY_INPUT',
  ).canonical_value;
  const narration = members.find(
    (member) => member.object_kind === 'PROCESS_LOGICAL_TYPE_INPUT',
  ).canonical_value.definition;
  const slot = members.find(
    (member) => member.object_kind === 'PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT',
  ).canonical_value.definition;

  assert.equal(registry.registry_contract.definitions_create_writer_authority, false);
  assert.equal(registry.registry_contract.definitions_create_serving_authority, false);
  assert.equal(registry.registry_contract.definitions_create_release_authority, false);
  assert.equal(narration.writer_action.current_release_writer_path, false);
  assert.equal(narration.writer_action.definition_grants_execution_authority, false);
  assert.equal(narration.consumer_projection_rule.projection_definition_required_before_serving, true);
  assert.deepEqual(slot.authority_contract, {
    creates_runtime_occurrence: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    current_release_writer_path: false,
  });
});

test('rejects an unknown Process domain and logical type', () => {
  const unknownDomain = processMembers();
  unknownDomain.find(
    (member) => member.object_kind === 'PROCESS_DOMAIN_REGISTRY_INPUT',
  ).canonical_value.domain_key = 'STORYLINES';
  assert.throws(
    () => validateAuthoredProcessInputs(unknownDomain),
    (error) => error.code === 'UNREGISTERED_PROCESS_DOMAIN',
  );

  const unknownType = processMembers();
  unknownType.find(
    (member) => member.object_kind === 'PROCESS_LOGICAL_TYPE_INPUT',
  ).canonical_value.definition.logical_type = 'ProcessParagraph';
  assert.throws(
    () => validateAuthoredProcessInputs(unknownType),
    (error) => error.code === 'UNREGISTERED_PROCESS_LOGICAL_TYPE',
  );
});

test('rejects value-derived narration identity and paragraph-derived occurrence boundaries', () => {
  const valueIdentity = processMembers();
  valueIdentity.find(
    (member) => member.object_kind === 'PROCESS_LOGICAL_TYPE_INPUT',
  ).canonical_value.definition.occurrence_identity.stable_id_inputs[0] = 'model_output';
  assert.throws(
    () => validateAuthoredProcessInputs(valueIdentity),
    (error) => error.code === 'PROCESS_VALUE_DERIVED_OCCURRENCE_ID',
  );

  const paragraphIdentity = processMembers();
  paragraphIdentity.find(
    (member) => member.object_kind === 'PROCESS_LOGICAL_TYPE_INPUT',
  ).canonical_value.definition.source_interval_contract
    .paragraph_boundary_defines_occurrence = true;
  assert.throws(
    () => validateAuthoredProcessInputs(paragraphIdentity),
    (error) => error.code === 'INVALID_PROCESS_LOGICAL_TYPE_INPUT',
  );
});

test('rejects an incomplete base set, an unknown Process kind and extra fields', () => {
  const incomplete = processMembers().filter(
    (member) => member.object_kind !== 'PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT',
  );
  assert.throws(
    () => validateAuthoredProcessInputs(incomplete),
    (error) => error.code === 'PROCESS_BASE_CONTRACT_CARDINALITY_MISMATCH',
  );

  const unknownKind = processMembers();
  unknownKind.push({
    object_kind: 'PROCESS_UNREGISTERED_INPUT',
    canonical_value: {
      object_kind: 'PROCESS_UNREGISTERED_INPUT',
      stable_id: 'UNREGISTERED',
      schema_version: 'PROCESS_UNREGISTERED_INPUT/V1',
    },
  });
  assert.throws(
    () => validateAuthoredProcessInputs(unknownKind),
    (error) => error.code === 'UNREGISTERED_PROCESS_CONTRACT_INPUT_KIND',
  );

  const extraField = clone(processMembers());
  extraField.find(
    (member) => member.object_kind === 'PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT',
  ).canonical_value.definition.unregistered_rule = true;
  assert.throws(
    () => validateAuthoredProcessInputs(extraField),
    (error) => error.code === 'INVALID_PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT',
  );
});
