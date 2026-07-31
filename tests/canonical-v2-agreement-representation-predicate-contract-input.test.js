const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  TARGET_CAPEX_PREDICATE_KEY,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PREDICATE_KEY,
  validateAuthoredAgreementPredicateInputs,
} = require(
  '../lib/canonical-v2/'
  + 'agreement-representation-predicate-contract-input-validator',
);

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const TARGET_CAPEX_DETAIL_ACTION_STABLE_ID =
  'RESULT_COMPONENT_CLAIM_EVIDENCE';

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
      'agreement/predicates/'
      + 'qxo-capitalisation-representation-predicate-catalogue.v1.json',
    ),
    load(
      'agreement/predicates/'
      + 'qxo-capex-restriction-predicate-catalogue.v1.json',
    ),
    resultMember(TARGET_PREDICATE_KEY, 3),
    resultMember(TARGET_CAPEX_PREDICATE_KEY, 1),
    load(
      'agreement/serving-exact-detail-action-definitions/'
      + 'result-composition-evidence.v1.json',
    ),
  ];
}

function member(values, stableId) {
  return values.find((value) => value.stable_id === stableId);
}

test('admits separate representation and interim-operating-covenant catalogues', () => {
  const authored = members();
  assert.doesNotThrow(
    () => validateAuthoredAgreementPredicateInputs(authored),
  );

  const representation = member(
    authored,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition;
  const interimOperatingCovenant = member(
    authored,
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition;
  assert.equal(representation.topic_key, 'REPRESENTATIONS');
  assert.equal(interimOperatingCovenant.topic_key, 'INTERIM_OPERATING_COVENANTS');
  assert.equal(
    representation.predicate_admissions[0].predicate_key,
    TARGET_PREDICATE_KEY,
  );
  assert.equal(
    interimOperatingCovenant.predicate_admissions[0].predicate_key,
    TARGET_CAPEX_PREDICATE_KEY,
  );
});

test('binds each predicate to its exact result version and governing action', () => {
  const representation = member(
    members(),
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0];
  const interimOperatingCovenant = member(
    members(),
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0];
  assert.equal(
    representation.exact_detail_action_stable_id,
    TARGET_DETAIL_ACTION_STABLE_ID,
  );
  assert.equal(
    interimOperatingCovenant.exact_detail_action_stable_id,
    TARGET_CAPEX_DETAIL_ACTION_STABLE_ID,
  );
  assert.equal(representation.exact_detail_action_version, 1);
  assert.equal(interimOperatingCovenant.exact_detail_action_version, 1);
  assert.equal(
    member(members(), AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID)
      .canonical_value.definition.predicate_admissions[0].result_definition_version,
    1,
  );
});

test('rejects a capex predicate under representations or a near predicate key', () => {
  const wrongTopic = clone(members());
  member(
    wrongTopic,
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.topic_key = 'REPRESENTATIONS';
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(wrongTopic),
    (error) => error.code
      === 'INVALID_AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_INPUT',
  );

  const nearKey = clone(members());
  member(
    nearKey,
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0].predicate_key =
    'TARGET_CAPEX_RESTRICTIONS';
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(nearKey),
    (error) => error.code
      === 'INVALID_AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_INPUT',
  );
});

test('rejects a missing, duplicate or unknown Agreement predicate catalogue', () => {
  const missing = members().filter(
    (value) => value.stable_id
      !== AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  );
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(missing),
    (error) => error.code === 'AGREEMENT_PREDICATE_CATALOGUE_MEMBERSHIP_MISMATCH',
  );

  const duplicate = members();
  duplicate.push(clone(member(
    duplicate,
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  )));
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(duplicate),
    (error) => error.code === 'AGREEMENT_PREDICATE_CATALOGUE_MEMBERSHIP_MISMATCH',
  );

  const unknown = members();
  unknown.push(wrap({
    object_kind: 'AGREEMENT_PREDICATE_CONTRACT_INPUT',
    stable_id: 'AGREEMENT_NEAREST_PREDICATE_CATALOGUE',
    schema_version: 'AGREEMENT_PREDICATE_CONTRACT_INPUT/V1',
    definition: {},
  }));
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(unknown),
    (error) => error.code === 'AGREEMENT_PREDICATE_CATALOGUE_MEMBERSHIP_MISMATCH',
  );
});

test('rejects result, action and authority drift', () => {
  const resultDrift = clone(members());
  member(resultDrift, TARGET_CAPEX_PREDICATE_KEY)
    .canonical_value.authored_definition.result_version = 2;
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(resultDrift),
    (error) => error.code
      === 'AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_RESULT_INVALID',
  );

  const actionDrift = clone(members());
  member(actionDrift, TARGET_DETAIL_ACTION_STABLE_ID)
    .canonical_value.whole_document_permission = true;
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(actionDrift),
    (error) => error.code === 'AGREEMENT_PREDICATE_DETAIL_ACTION_INVALID',
  );

  const authorityDrift = clone(members());
  member(
    authorityDrift,
    AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.authority_contract.creates_query_authority = true;
  assert.throws(
    () => validateAuthoredAgreementPredicateInputs(authorityDrift),
    (error) => error.code
      === 'INVALID_AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_INPUT',
  );
});
