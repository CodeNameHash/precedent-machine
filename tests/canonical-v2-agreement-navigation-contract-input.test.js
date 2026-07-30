const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AGREEMENT_NAVIGATION_STABLE_ID,
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PATTERN_KEY,
  validateAuthoredAgreementNavigationInputs,
} = require('../lib/canonical-v2/agreement-navigation-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function wrap(canonicalValue) {
  return {
    object_kind: canonicalValue.object_kind,
    stable_id: canonicalValue.stable_id,
    canonical_value: canonicalValue,
  };
}

function load(relativePath) {
  return wrap(JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  ));
}

function resultMember() {
  return wrap({
    object_kind: 'RESULT_DEFINITION_INPUT',
    stable_id: TARGET_PATTERN_KEY,
    schema_version: 'RESULT_DEFINITION_INPUT/V1',
    authored_definition: {
      result_key: TARGET_PATTERN_KEY,
      result_version: 3,
    },
  });
}

function predicateMember() {
  return wrap({
    object_kind: 'AGREEMENT_PREDICATE_CONTRACT_INPUT',
    stable_id: AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
    schema_version: 'AGREEMENT_PREDICATE_CONTRACT_INPUT/V1',
    definition: {
      domain_key: 'AGREEMENT',
      topic_key: 'REPRESENTATIONS',
      predicate_admissions: [{
        predicate_key: TARGET_PATTERN_KEY,
        predicate_version: 1,
        result_definition_stable_id: TARGET_PATTERN_KEY,
        result_definition_version: 3,
        exact_detail_action_stable_id: TARGET_DETAIL_ACTION_STABLE_ID,
        exact_detail_action_version: 1,
      }],
    },
  });
}

function members() {
  return [
    load(
      'agreement/navigation/'
      + 'qxo-capitalisation-navigation-definition-catalogue.v1.json',
    ),
    resultMember(),
    load(
      'agreement/serving-exact-detail-action-definitions/'
      + 'result-composition-evidence.v1.json',
    ),
    predicateMember(),
  ];
}

function member(values, stableId) {
  return values.find((value) => value.stable_id === stableId);
}

test('accepts one executable QXO Agreement navigation pattern', () => {
  const authored = members();
  assert.doesNotThrow(
    () => validateAuthoredAgreementNavigationInputs(authored),
  );

  const navigation = member(
    authored,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition;
  const domain = navigation.domains[0];
  const topic = domain.topics[0];
  const pattern = topic.patterns[0];

  assert.equal(domain.domain_key, 'AGREEMENT');
  assert.equal(topic.topic_key, 'REPRESENTATIONS');
  assert.deepEqual(pattern, {
    pattern_key: TARGET_PATTERN_KEY,
    label: 'Target capitalisation bring-down',
    predicate_key: TARGET_PATTERN_KEY,
    predicate_version: 1,
    predicate_shape: 'ATOMIC',
  });
});

test('binds Browse and Ask admission to result version 3 and exact detail', () => {
  const definition = member(
    members(),
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition;

  assert.equal(
    definition.admission_contract
      .predicate_admission_must_bind_result_and_detail_action,
    true,
  );
  assert.equal(
    definition.admission_contract
      .target_capitalisation_pattern_requires_result_definition_v3,
    true,
  );
  assert.equal(
    definition.admission_contract
      .target_capitalisation_pattern_requires_result_composition_evidence_v1,
    true,
  );
  assert.equal(definition.hierarchy_contract.display_only_entry_permitted, false);
});

test('rejects a changed complete navigation definition', () => {
  const authored = clone(members());
  member(
    authored,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition.domains[0].topics[0].patterns[0].label =
    'Capitalisation';

  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(authored),
    (error) => error.code === 'INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT',
  );
});

test('rejects a missing predicate catalogue instead of publishing display-only', () => {
  const authored = members().filter(
    (value) => value.stable_id
      !== AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  );

  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(authored),
    (error) => error.code === 'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_MISSING',
  );
});

test('rejects a predicate that does not bind result version 3', () => {
  const authored = clone(members());
  member(
    authored,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0]
    .result_definition_version = 2;

  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(authored),
    (error) => error.code === 'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_INVALID',
  );
});

test('rejects a predicate that substitutes another exact-detail action', () => {
  const authored = clone(members());
  member(
    authored,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0]
    .exact_detail_action_stable_id = 'RESULT_COMPONENT_CLAIM_EVIDENCE';

  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(authored),
    (error) => error.code === 'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_INVALID',
  );
});

test('rejects result or action dependency drift', () => {
  const resultDrift = clone(members());
  member(
    resultDrift,
    TARGET_PATTERN_KEY,
  ).canonical_value.authored_definition.result_version = 2;
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(resultDrift),
    (error) => error.code === 'AGREEMENT_NAVIGATION_RESULT_DEPENDENCY_INVALID',
  );

  const actionDrift = clone(members());
  member(
    actionDrift,
    TARGET_DETAIL_ACTION_STABLE_ID,
  ).canonical_value.whole_document_permission = true;
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(actionDrift),
    (error) => (
      error.code === 'AGREEMENT_NAVIGATION_DETAIL_ACTION_DEPENDENCY_INVALID'
    ),
  );
});

test('rejects any authority grant or duplicate Agreement catalogue', () => {
  const authority = clone(members());
  member(
    authority,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition.authority_contract.creates_query_authority =
    true;
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(authority),
    (error) => error.code === 'INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT',
  );

  const duplicate = members();
  duplicate.push(clone(duplicate[0]));
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(duplicate),
    (error) => error.code === 'AGREEMENT_NAVIGATION_CONTRACT_MEMBERSHIP_MISMATCH',
  );
});
