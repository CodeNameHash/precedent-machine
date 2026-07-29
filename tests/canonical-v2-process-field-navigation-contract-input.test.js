const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  PROCESS_FIELD_KEYS,
  PROCESS_NAVIGATION_PREDICATE_KEYS,
  validateAuthoredProcessFieldNavigationInputs,
} = require('../lib/canonical-v2/process-field-navigation-contract-input-validator');

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

function fieldNavigationMembers() {
  return [
    loadMember('process/domain/process-domain-registry.v1.json'),
    loadMember('process/fields/process-field-definition-catalogue.v1.json'),
    loadMember(
      'process/navigation/process-navigation-definition-catalogue.v1.json',
    ),
    loadMember(
      'process/predicates/exclusivity-predicate-catalogue.v1.json',
    ),
    loadMember(
      'shared/field-definitions/shared-deal-field-catalogue.v1.json',
    ),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('compiles one additive Process field and navigation contribution', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });
  const processCatalogueMembers = compiled.authored_members.filter(
    (member) => [
      'PROCESS_FIELD_CATALOGUE_INPUT',
      'PROCESS_NAVIGATION_CATALOGUE_INPUT',
    ].includes(member.object_kind),
  );

  assert.equal(compiled.authored_members.length, 125);
  assert.deepEqual(
    processCatalogueMembers.map((member) => [
      member.object_kind,
      member.stable_id,
    ]),
    [
      [
        'PROCESS_FIELD_CATALOGUE_INPUT',
        'PROCESS_FIELD_DEFINITION_CATALOGUE',
      ],
      [
        'PROCESS_NAVIGATION_CATALOGUE_INPUT',
        'PROCESS_NAVIGATION_DEFINITION_CATALOGUE',
      ],
    ],
  );
  assert.equal(compiled.disposition.freeze_eligible, false);
  assert.equal(compiled.disposition.canonical_contract_bundle_authority, 'NONE');
});

test('binds Process fields to the one PM-wide catalogue and typed scopes', () => {
  const members = fieldNavigationMembers();
  assert.doesNotThrow(
    () => validateAuthoredProcessFieldNavigationInputs(members),
  );
  const definition = members.find(
    (member) => member.object_kind === 'PROCESS_FIELD_CATALOGUE_INPUT',
  ).canonical_value.definition;

  assert.equal(
    definition.pm_wide_catalogue_binding.combined_catalogue_stable_id,
    'PRODUCT_FIELD_CATALOGUE',
  );
  assert.equal(
    definition.pm_wide_catalogue_binding.second_product_field_catalogue_permitted,
    false,
  );
  assert.deepEqual(
    definition.field_definitions.map((field) => field.field_key),
    PROCESS_FIELD_KEYS,
  );
  assert.equal(
    definition.field_definitions.find(
      (field) => field.field_key === 'process_participant',
    ).filter_scope,
    'SAME_EVENT_AND_BIDDER_TRACK',
  );
  assert.equal(
    definition.field_definitions.find(
      (field) => field.field_key === 'process_participant_role',
    ).filter_scope,
    'SAME_PARTICIPANT_COMPONENT',
  );
  assert.equal(definition.catalogue_contract.all_operator_is_non_vacuous, true);
  assert.equal(
    definition.catalogue_contract.incomplete_repeatable_collection_returns_unknown,
    true,
  );
});

test('keeps exact drafting displayable but not filterable', () => {
  const members = fieldNavigationMembers();
  const definition = members.find(
    (member) => member.object_kind === 'PROCESS_FIELD_CATALOGUE_INPUT',
  ).canonical_value.definition;
  const actualDrafting = definition.field_definitions.find(
    (field) => field.field_key === 'actual_drafting',
  );

  assert.deepEqual(actualDrafting.capabilities, {
    display: true,
    filter: false,
    sort: false,
    group: false,
  });
  assert.deepEqual(actualDrafting.permitted_operators, []);
  assert.equal(actualDrafting.control_type, 'NONE');
  assert.equal(
    actualDrafting.derivation_requirement,
    'NO_RECONSTRUCTION_OR_SUMMARY_SUBSTITUTION',
  );
});

test('maps each Process navigation pattern to a governed predicate', () => {
  const members = fieldNavigationMembers();
  const definition = members.find(
    (member) => member.object_kind === 'PROCESS_NAVIGATION_CATALOGUE_INPUT',
  ).canonical_value.definition;
  const topic = definition.domains[0].topics[0];

  assert.deepEqual(
    topic.patterns.map((pattern) => pattern.predicate_key),
    PROCESS_NAVIGATION_PREDICATE_KEYS,
  );
  assert.equal(topic.topic_key, 'EXCLUSIVITY');
  assert.equal(
    topic.patterns.find(
      (pattern) => pattern.predicate_key === 'EXCLUSIVITY_RESPONSE_ANY',
    ).predicate_shape,
    'GOVERNED_UNION_PRESERVING_ATOMIC_CONSTITUENT',
  );
  assert.equal(
    topic.patterns.find(
      (pattern) => pattern.predicate_key === 'EXCLUSIVITY_EXPRESS_REFUSAL',
    ).label,
    'Expressly refused',
  );
  assert.equal(
    definition.admission_contract
      .declined_label_can_replace_express_refusal_counterproposal_or_conditional_acceptance,
    false,
  );
});

test('rejects a missing contribution and re-signed semantic drift', () => {
  const missing = fieldNavigationMembers().filter(
    (member) => member.object_kind !== 'PROCESS_NAVIGATION_CATALOGUE_INPUT',
  );
  assert.throws(
    () => validateAuthoredProcessFieldNavigationInputs(missing),
    (error) => error.code
      === 'PROCESS_FIELD_NAVIGATION_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const fieldDrift = clone(fieldNavigationMembers());
  fieldDrift.find(
    (member) => member.object_kind === 'PROCESS_FIELD_CATALOGUE_INPUT',
  ).canonical_value.definition.field_definitions[0].label = 'Event';
  assert.throws(
    () => validateAuthoredProcessFieldNavigationInputs(fieldDrift),
    (error) => error.code === 'INVALID_PROCESS_FIELD_CATALOGUE_INPUT',
  );

  const navigationDrift = clone(fieldNavigationMembers());
  navigationDrift.find(
    (member) => member.object_kind === 'PROCESS_NAVIGATION_CATALOGUE_INPUT',
  ).canonical_value.definition.domains[0].topics[0]
    .patterns[2].label = 'Declined';
  assert.throws(
    () => validateAuthoredProcessFieldNavigationInputs(navigationDrift),
    (error) => error.code === 'INVALID_PROCESS_NAVIGATION_CATALOGUE_INPUT',
  );
});

test('grants no runtime, query, writer, serving, release or freeze authority', () => {
  const members = fieldNavigationMembers();
  for (const member of members.filter(
    (entry) => [
      'PROCESS_FIELD_CATALOGUE_INPUT',
      'PROCESS_NAVIGATION_CATALOGUE_INPUT',
    ].includes(entry.object_kind),
  )) {
    const authority = member.canonical_value.definition.authority_contract;
    const runtimeKey = member.object_kind === 'PROCESS_FIELD_CATALOGUE_INPUT'
      ? 'creates_runtime_field'
      : 'creates_runtime_navigation';
    assert.equal(authority[runtimeKey], false);
    assert.equal(authority.creates_query_authority, false);
    assert.equal(authority.creates_extraction_authority, false);
    assert.equal(authority.creates_writer_authority, false);
    assert.equal(authority.creates_serving_authority, false);
    assert.equal(authority.creates_release_authority, false);
    assert.equal(authority.creates_contract_freeze_authority, false);
  }
});
