const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PREDICATE_KEY,
  validateAuthoredAgreementRepresentationPredicateInputs,
} = require(
  '../lib/canonical-v2/'
  + 'agreement-representation-predicate-contract-input-validator'
);

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
    stable_id: TARGET_PREDICATE_KEY,
    schema_version: 'RESULT_DEFINITION_INPUT/V1',
    authored_definition: {
      result_key: TARGET_PREDICATE_KEY,
      result_version: 3,
    },
  });
}

function members() {
  return [
    load(
      'agreement/predicates/'
      + 'qxo-capitalisation-representation-predicate-catalogue.v1.json',
    ),
    resultMember(),
    load(
      'agreement/serving-exact-detail-action-definitions/'
      + 'result-composition-evidence.v1.json',
    ),
  ];
}

function member(values, stableId) {
  return values.find((value) => value.stable_id === stableId);
}

test('admits one target capitalisation predicate and no sibling', () => {
  const authored = members();
  assert.doesNotThrow(
    () => validateAuthoredAgreementRepresentationPredicateInputs(authored),
  );

  const definition = member(
    authored,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition;
  assert.equal(definition.domain_key, 'AGREEMENT');
  assert.equal(definition.topic_key, 'REPRESENTATIONS');
  assert.deepEqual(definition.predicate_admissions, [{
    predicate_key: TARGET_PREDICATE_KEY,
    predicate_version: 1,
    result_definition_stable_id: TARGET_PREDICATE_KEY,
    result_definition_version: 3,
    exact_detail_action_stable_id: TARGET_DETAIL_ACTION_STABLE_ID,
    exact_detail_action_version: 1,
  }]);
});

test('binds the exact result and action without creating a dependency cycle', () => {
  const definition = member(
    members(),
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition;

  assert.equal(
    'navigation_catalogue_stable_id' in definition.admission_contract,
    false,
  );
  assert.equal('navigation_pattern_key' in definition.admission_contract, false);
  assert.equal(
    definition.admission_contract
      .predicate_admission_creates_product_query_admission,
    false,
  );
  assert.equal(
    definition.admission_contract
      .external_checked_evidence_release_and_coverage_admission_required,
    true,
  );
});

test('rejects a changed complete predicate definition', () => {
  const authored = clone(members());
  member(
    authored,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.topic_key = 'DEAL_PROTECTIONS';

  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(authored),
    (error) => (
      error.code === 'INVALID_AGREEMENT_REPRESENTATION_PREDICATE_INPUT'
    ),
  );
});

test('rejects result version drift in the admission or result definition', () => {
  const admissionDrift = clone(members());
  member(
    admissionDrift,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0]
    .result_definition_version = 2;
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(admissionDrift),
    (error) => (
      error.code === 'INVALID_AGREEMENT_REPRESENTATION_PREDICATE_INPUT'
    ),
  );

  const resultDrift = clone(members());
  member(
    resultDrift,
    TARGET_PREDICATE_KEY,
  ).canonical_value.authored_definition.result_version = 2;
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(resultDrift),
    (error) => error.code === 'AGREEMENT_REPRESENTATION_PREDICATE_RESULT_INVALID',
  );
});

test('rejects exact-detail substitution and action-definition drift', () => {
  const admissionDrift = clone(members());
  member(
    admissionDrift,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.predicate_admissions[0]
    .exact_detail_action_stable_id = 'RESULT_COMPONENT_CLAIM_EVIDENCE';
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(admissionDrift),
    (error) => (
      error.code === 'INVALID_AGREEMENT_REPRESENTATION_PREDICATE_INPUT'
    ),
  );

  const actionDrift = clone(members());
  member(
    actionDrift,
    TARGET_DETAIL_ACTION_STABLE_ID,
  ).canonical_value.whole_document_permission = true;
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(actionDrift),
    (error) => (
      error.code
      === 'AGREEMENT_REPRESENTATION_PREDICATE_DETAIL_ACTION_INVALID'
    ),
  );
});

test('rejects missing result or exact-detail dependencies', () => {
  const noResult = members().filter(
    (value) => value.stable_id !== TARGET_PREDICATE_KEY,
  );
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(noResult),
    (error) => error.code === 'AGREEMENT_REPRESENTATION_PREDICATE_RESULT_MISSING',
  );

  const noAction = members().filter(
    (value) => value.stable_id !== TARGET_DETAIL_ACTION_STABLE_ID,
  );
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(noAction),
    (error) => (
      error.code === 'AGREEMENT_REPRESENTATION_PREDICATE_DETAIL_ACTION_MISSING'
    ),
  );
});

test('rejects authority grants and duplicate catalogues', () => {
  const authority = clone(members());
  member(
    authority,
    AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  ).canonical_value.definition.authority_contract.creates_query_authority =
    true;
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(authority),
    (error) => (
      error.code === 'INVALID_AGREEMENT_REPRESENTATION_PREDICATE_INPUT'
    ),
  );

  const duplicate = members();
  duplicate.push(clone(duplicate[0]));
  assert.throws(
    () => validateAuthoredAgreementRepresentationPredicateInputs(duplicate),
    (error) => (
      error.code
      === 'AGREEMENT_REPRESENTATION_PREDICATE_MEMBERSHIP_MISMATCH'
    ),
  );
});
