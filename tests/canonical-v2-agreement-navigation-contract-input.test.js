const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  AGREEMENT_NAVIGATION_STABLE_ID,
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  TARGET_CAPEX_PATTERN_KEY,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PATTERN_KEY,
  validateAuthoredAgreementNavigationInputs,
} = require('../lib/canonical-v2/agreement-navigation-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

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

function resultMember(stableId, version) {
  return wrap({
    object_kind: 'RESULT_DEFINITION_INPUT',
    stable_id: stableId,
    schema_version: 'RESULT_DEFINITION_INPUT/V1',
    authored_definition: {
      result_key: stableId,
      result_version: version,
    },
  });
}

function members() {
  return [
    load(
      'agreement/navigation/'
      + 'qxo-capitalisation-navigation-definition-catalogue.v1.json',
    ),
    resultMember(TARGET_PATTERN_KEY, 3),
    resultMember(TARGET_CAPEX_PATTERN_KEY, 1),
    load(
      'agreement/serving-exact-detail-action-definitions/'
      + 'result-composition-evidence.v1.json',
    ),
    load(
      'agreement/predicates/'
      + 'qxo-capitalisation-representation-predicate-catalogue.v1.json',
    ),
    load(
      'agreement/predicates/'
      + 'qxo-capex-restriction-predicate-catalogue.v1.json',
    ),
  ];
}

function member(values, stableId) {
  return values.find((value) => value.stable_id === stableId);
}

test('exposes separate representations and interim-operating-covenants topics', () => {
  const authored = members();
  assert.doesNotThrow(
    () => validateAuthoredAgreementNavigationInputs(authored),
  );

  const topics = member(
    authored,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition.domains[0].topics;
  assert.deepEqual(topics.map((topic) => ({
    topic_key: topic.topic_key,
    predicate_catalogue_stable_id: topic.predicate_catalogue_stable_id,
    pattern_key: topic.patterns[0].pattern_key,
  })), [
    {
      topic_key: 'REPRESENTATIONS',
      predicate_catalogue_stable_id:
        AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
      pattern_key: TARGET_PATTERN_KEY,
    },
    {
      topic_key: 'INTERIM_OPERATING_COVENANTS',
      predicate_catalogue_stable_id:
        AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
      pattern_key: TARGET_CAPEX_PATTERN_KEY,
    },
  ]);
});

test('requires exact result definitions and the composition action for both topics', () => {
  const definition = member(
    members(),
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition;
  assert.equal(
    definition.admission_contract
      .target_capitalisation_pattern_requires_result_definition_v3,
    true,
  );
  assert.equal(
    definition.admission_contract
      .target_capex_pattern_requires_result_definition_v1,
    true,
  );
  assert.equal(
    definition.admission_contract
      .target_capex_pattern_requires_result_composition_evidence_v1,
    true,
  );
  assert.equal(definition.hierarchy_contract.display_only_entry_permitted, false);
});

test('rejects capex as a representation and rejects a near predicate key', () => {
  const wrongTopic = clone(members());
  const topics = member(
    wrongTopic,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition.domains[0].topics;
  topics[1].topic_key = 'REPRESENTATIONS';
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(wrongTopic),
    (error) => error.code === 'INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT',
  );

  const nearPredicate = clone(members());
  member(
    nearPredicate,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition.domains[0].topics[1].patterns[0].predicate_key =
    'TARGET_CAPEX_RESTRICTIONS';
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(nearPredicate),
    (error) => error.code === 'INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT',
  );
});

test('rejects a missing or substituted predicate catalogue', () => {
  const missing = members().filter(
    (value) => value.stable_id
      !== AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  );
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(missing),
    (error) => error.code === 'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_MISSING',
  );

  const substituted = clone(members());
  member(
    substituted,
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.topic_key = 'REPRESENTATIONS';
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(substituted),
    (error) => error.code === 'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_INVALID',
  );
});

test('rejects result, action, authority and duplicate navigation drift', () => {
  const resultDrift = clone(members());
  member(resultDrift, TARGET_CAPEX_PATTERN_KEY)
    .canonical_value.authored_definition.result_version = 2;
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(resultDrift),
    (error) => error.code === 'AGREEMENT_NAVIGATION_RESULT_DEPENDENCY_INVALID',
  );

  const actionDrift = clone(members());
  member(actionDrift, TARGET_DETAIL_ACTION_STABLE_ID)
    .canonical_value.whole_document_permission = true;
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(actionDrift),
    (error) => error.code
      === 'AGREEMENT_NAVIGATION_DETAIL_ACTION_DEPENDENCY_INVALID',
  );

  const authorityDrift = clone(members());
  member(
    authorityDrift,
    AGREEMENT_NAVIGATION_STABLE_ID,
  ).canonical_value.definition.authority_contract.creates_query_authority = true;
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(authorityDrift),
    (error) => error.code === 'INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT',
  );

  const duplicate = members();
  duplicate.push(clone(member(duplicate, AGREEMENT_NAVIGATION_STABLE_ID)));
  assert.throws(
    () => validateAuthoredAgreementNavigationInputs(duplicate),
    (error) => error.code === 'AGREEMENT_NAVIGATION_CONTRACT_MEMBERSHIP_MISMATCH',
  );
});
