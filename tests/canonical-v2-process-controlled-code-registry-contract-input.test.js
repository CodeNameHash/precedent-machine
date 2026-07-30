const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PROCESS_CONTROLLED_CODE_REGISTRY_INPUT_KIND,
  PROCESS_CONTROLLED_CODE_REGISTRY_INPUT_SCHEMA,
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8',
  ));
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
    loadMember('process/agreements/process-agreement.v1.json'),
    loadMember('process/bidder-tracks/bidder-track.v1.json'),
    loadMember('process/domain/process-domain-registry.v1.json'),
    loadMember('process/events/process-event.v1.json'),
    loadMember('process/fields/process-field-definition-catalogue.v1.json'),
    loadMember('process/narration/process-narration-occurrence.v1.json'),
    loadMember('process/occurrence-slots/process-event.v1.json'),
    loadMember('process/occurrence-slots/process-narration.v1.json'),
    loadMember('process/participants/process-participant.v1.json'),
    loadMember('process/passages/process-passage.v1.json'),
    loadMember('process/phases/process-phase.v1.json'),
    loadMember('process/positions/process-position.v1.json'),
    loadMember('process/predicates/process-predicate-witness.v2.json'),
    loadMember('process/registries/process-controlled-code-registry.v1.json'),
    loadMember('process/relationships/process-relationship.v1.json'),
  ];
}

function controlledRegistry(members = processMembers()) {
  return members.find(
    (member) => member.canonical_value.stable_id
      === 'PROCESS_CONTROLLED_CODE_REGISTRY',
  ).canonical_value;
}

function registryDefinition(registryStableId) {
  return controlledRegistry().definition.process_owned_registries.find(
    (registry) => registry.registry_stable_id === registryStableId,
  );
}

test('admits one closed Process controlled-code registry', () => {
  const members = processMembers();
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members));
  assert.equal(
    PROCESS_CONTROLLED_CODE_REGISTRY_INPUT_KIND,
    'PROCESS_CONTROLLED_CODE_REGISTRY_INPUT',
  );
  assert.equal(
    PROCESS_CONTROLLED_CODE_REGISTRY_INPUT_SCHEMA,
    'PROCESS_CONTROLLED_CODE_REGISTRY_INPUT/V1',
  );
  assert.equal(
    controlledRegistry(members).definition.registry_state,
    'CLOSED',
  );

  const registryIds = controlledRegistry(members).definition
    .process_owned_registries
    .map((registry) => registry.registry_stable_id);
  assert.deepEqual(registryIds, [
    'PROCESS_AGREEMENT_TYPE_REGISTRY',
    'PROCESS_CERTIFICATION_STATE_REGISTRY',
    'PROCESS_CHANNEL_REGISTRY',
    'PROCESS_DOCUMENT_STAGE_REGISTRY',
    'PROCESS_EVENT_ROLE_REGISTRY',
    'PROCESS_EVENT_TYPE_REGISTRY',
    'PROCESS_PASSAGE_ROLE_REGISTRY',
    'PROCESS_PHASE_CODE_REGISTRY',
    'PROCESS_POSITION_CODE_REGISTRY',
    'PROCESS_RELATIONSHIP_TYPE_REGISTRY',
    'PROCESS_SOURCE_ROLE_REGISTRY',
    'PROCESS_TERM_CODE_REGISTRY',
    'PROCESS_TRACK_STATE_REGISTRY',
  ]);
});

test('closes every required Process code family', () => {
  assert.deepEqual(
    registryDefinition('PROCESS_EVENT_TYPE_REGISTRY').codes,
    [
      'EXCLUSIVITY_AMENDMENT',
      'EXCLUSIVITY_CONDITIONAL_ACCEPTANCE',
      'EXCLUSIVITY_COUNTERPROPOSAL',
      'EXCLUSIVITY_END',
      'EXCLUSIVITY_EXPIRY',
      'EXCLUSIVITY_EXPRESS_REFUSAL',
      'EXCLUSIVITY_EXTENSION',
      'EXCLUSIVITY_GRANT',
      'EXCLUSIVITY_REQUEST',
      'EXCLUSIVITY_WAIVER',
    ],
  );
  assert.deepEqual(
    registryDefinition('PROCESS_AGREEMENT_TYPE_REGISTRY').codes,
    [
      'CONFIDENTIALITY',
      'EXCLUSIVITY',
      'OTHER_PROCESS_AGREEMENT',
      'STANDSTILL',
    ],
  );
  assert.deepEqual(
    registryDefinition('PROCESS_RELATIONSHIP_TYPE_REGISTRY').codes,
    [
      'AMENDMENT',
      'CONTINUATION',
      'CROSS_REFERENCE',
      'RESPONSE',
      'RETELLING',
      'SUPERSESSION',
    ],
  );
  assert.deepEqual(
    registryDefinition('PROCESS_PASSAGE_ROLE_REGISTRY').codes,
    ['ACTUAL_DRAFTING', 'PROCESS_NARRATION', 'RELATED_DRAFTING'],
  );
  assert.deepEqual(
    registryDefinition('PROCESS_TERM_CODE_REGISTRY').codes,
    [
      'EXCLUSIVITY_CONDITION',
      'EXCLUSIVITY_DURATION',
      'EXCLUSIVITY_END',
      'EXCLUSIVITY_RATIONALE',
      'EXCLUSIVITY_START',
      'EXCLUSIVITY_SUBJECT',
    ],
  );
});

test('keeps shared participant and party roles as exact external references', () => {
  const references = controlledRegistry().definition
    .shared_role_registry_references;
  assert.deepEqual(references, [
    {
      registry_stable_id: 'PROCESS_PARTICIPANT_ROLE_REGISTRY',
      owner_object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
      owner_stable_id: 'DEAL_PARTICIPANT_RELATIONSHIP',
      owner_schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
      exact_value_path: 'definition.type_contract.transaction_roles',
    },
    {
      registry_stable_id: 'PROCESS_PARTY_ROLE_REGISTRY',
      owner_object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
      owner_stable_id: 'DEAL_PARTICIPANT_RELATIONSHIP',
      owner_schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
      exact_value_path: 'definition.type_contract.legal_roles',
    },
  ]);
  assert.equal(
    references.every((reference) => !Object.hasOwn(reference, 'codes')),
    true,
  );
});

test('reconciles every Process field-catalogue registry reference', () => {
  const members = processMembers();
  const catalogue = members.find(
    (member) => member.canonical_value.stable_id
      === 'PROCESS_FIELD_DEFINITION_CATALOGUE',
  ).canonical_value;
  const actualReferences = [...new Set(
    catalogue.definition.field_definitions
      .map((field) => field.required_value_registry),
  )].sort();
  const expectedReferences = controlledRegistry(members).definition
    .field_catalogue_registry_reference_contract
    .required_registry_references;
  assert.deepEqual(actualReferences, expectedReferences);

  catalogue.definition.field_definitions[0].required_value_registry =
    'PROCESS_EVENT_TYPE_LABELS';
  assert.throws(
    () => validateAuthoredProcessInputs(members),
    { code: 'PROCESS_FIELD_CATALOGUE_REGISTRY_REFERENCE_MISMATCH' },
  );
});

test('fails closed for missing, duplicate, unknown and near codes', () => {
  const missing = processMembers().filter(
    (member) => member.canonical_value.stable_id
      !== 'PROCESS_CONTROLLED_CODE_REGISTRY',
  );
  assert.throws(
    () => validateAuthoredProcessInputs(missing),
    { code: 'PROCESS_CONTROLLED_CODE_REGISTRY_CARDINALITY_MISMATCH' },
  );

  const duplicate = processMembers();
  duplicate.push({
    object_kind: PROCESS_CONTROLLED_CODE_REGISTRY_INPUT_KIND,
    canonical_value: clone(controlledRegistry(duplicate)),
  });
  assert.throws(
    () => validateAuthoredProcessInputs(duplicate),
    { code: 'PROCESS_CONTROLLED_CODE_REGISTRY_CARDINALITY_MISMATCH' },
  );

  const changed = processMembers();
  const eventTypes = controlledRegistry(changed).definition
    .process_owned_registries.find(
      (registry) => registry.registry_stable_id
        === 'PROCESS_EVENT_TYPE_REGISTRY',
    );
  eventTypes.codes.push('EXCLUSIVITY_DECLINED');
  assert.throws(
    () => validateAuthoredProcessInputs(changed),
    { code: 'INVALID_PROCESS_CONTROLLED_CODE_REGISTRY_INPUT' },
  );

  assert.deepEqual(
    controlledRegistry().definition.process_code_admission_contract,
    {
      exact_code_membership_required_before_materialisation: true,
      unknown_code_has_runtime_path: false,
      unknown_code_state: 'UNRESOLVED',
      unknown_code_blocks_materialisation: true,
      near_code_mapping_permitted: false,
      source_label_can_create_code: false,
      display_label_can_create_code: false,
      model_output_can_create_code: false,
      case_normalisation_can_create_code: false,
    },
  );
});

test('requires a successor contract for expansion and grants no authority', () => {
  const definition = controlledRegistry().definition;
  assert.deepEqual(definition.evolution_contract, {
    runtime_extension_permitted: false,
    source_observation_can_extend_registry: false,
    successor_contract_required_for_new_process_code: true,
    successor_contract_required_for_changed_meaning: true,
    existing_code_meaning_can_change_in_place: false,
    removed_code_can_silently_map_to_near_code: false,
  });
  assert.equal(
    Object.values(definition.authority_contract)
      .every((value) => value === false),
    true,
  );
});

test('uses one exact four-file canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/'
        + 'wp-process-controlled-code-registry-contract-v1.json',
    ),
    'utf8',
  ));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/'
      + 'wp-process-controlled-code-registry-contract-v1.json',
    'contracts/canonical-v2/successor/process/'
      + 'registries/process-controlled-code-registry.v1.json',
    'lib/canonical-v2/process-contract-input-validator.js',
    'tests/'
      + 'canonical-v2-process-controlled-code-registry-contract-input.test.js',
  ]);
});
