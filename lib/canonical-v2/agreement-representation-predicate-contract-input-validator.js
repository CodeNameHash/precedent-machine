const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND =
  'AGREEMENT_PREDICATE_CONTRACT_INPUT';
const AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA =
  'AGREEMENT_PREDICATE_CONTRACT_INPUT/V1';
const AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID =
  'AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE';
const AGREEMENT_NAVIGATION_CATALOGUE_STABLE_ID =
  'AGREEMENT_NAVIGATION_DEFINITION_CATALOGUE';
const TARGET_PREDICATE_KEY = 'TARGET_CAPITALISATION_BRING_DOWN';
const TARGET_PREDICATE_VERSION = 1;
const TARGET_RESULT_VERSION = 2;
const TARGET_DETAIL_ACTION_STABLE_ID = 'RESULT_COMPOSITION_EVIDENCE';
const TARGET_DETAIL_ACTION_VERSION = 1;
const DEFINITION_DIGEST =
  '651a49f03f6e614fa61d5b61e8365991685162f212fa5b6465eaa18307467f6b';

class AgreementRepresentationPredicateContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgreementRepresentationPredicateContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new AgreementRepresentationPredicateContractInputError(
    code,
    message,
    details,
  );
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function requireExactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (!same(actual, required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function onlyMember(authoredMembers, objectKind, stableId, code) {
  const matches = authoredMembers.filter(
    (member) => member?.object_kind === objectKind
      && member.canonical_value?.stable_id === stableId,
  );
  if (matches.length !== 1) {
    fail(code, 'The Agreement predicate dependency is not unique.', {
      object_kind: objectKind,
      stable_id: stableId,
      actual_count: matches.length,
    });
  }
  return matches[0].canonical_value;
}

function validatePredicateDefinition(predicate) {
  const code = 'INVALID_AGREEMENT_REPRESENTATION_PREDICATE_INPUT';
  requireExactKeys(predicate, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Agreement representation predicate authored input', code);
  if (
    predicate.object_kind !== AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND
    || predicate.stable_id
      !== AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID
    || predicate.schema_version !== AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA
  ) {
    fail(code, 'The Agreement representation predicate identity is invalid.');
  }
  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(predicate.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Agreement representation predicate is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== DEFINITION_DIGEST) {
    fail(code, 'The complete Agreement representation predicate has changed.', {
      expected_definition_digest: DEFINITION_DIGEST,
      actual_definition_digest: actualDigest,
    });
  }

  const admission = predicate.definition.predicate_admissions[0];
  if (
    predicate.definition.domain_key !== 'AGREEMENT'
    || predicate.definition.topic_key !== 'REPRESENTATIONS'
    || predicate.definition.predicate_admissions.length !== 1
    || admission.predicate_key !== TARGET_PREDICATE_KEY
    || admission.predicate_version !== TARGET_PREDICATE_VERSION
    || admission.result_definition_stable_id !== TARGET_PREDICATE_KEY
    || admission.result_definition_version !== TARGET_RESULT_VERSION
    || admission.exact_detail_action_stable_id
      !== TARGET_DETAIL_ACTION_STABLE_ID
    || admission.exact_detail_action_version !== TARGET_DETAIL_ACTION_VERSION
    || predicate.definition.admission_contract.navigation_catalogue_stable_id
      !== AGREEMENT_NAVIGATION_CATALOGUE_STABLE_ID
    || predicate.definition.admission_contract.navigation_pattern_key
      !== TARGET_PREDICATE_KEY
  ) {
    fail(code, 'The predicate does not bind the exact navigation, result, and action.');
  }
}

function validateResultDefinition(result) {
  const code = 'AGREEMENT_REPRESENTATION_PREDICATE_RESULT_INVALID';
  requireExactKeys(result, [
    'authored_definition',
    'object_kind',
    'schema_version',
    'stable_id',
  ], 'Target capitalisation result definition', code);
  if (
    result.object_kind !== 'RESULT_DEFINITION_INPUT'
    || result.schema_version !== 'RESULT_DEFINITION_INPUT/V1'
    || result.stable_id !== TARGET_PREDICATE_KEY
    || result.authored_definition?.result_key !== TARGET_PREDICATE_KEY
    || result.authored_definition?.result_version !== TARGET_RESULT_VERSION
  ) {
    fail(code, 'The predicate requires target capitalisation result version 2.');
  }
}

function validateDetailAction(action) {
  const code = 'AGREEMENT_REPRESENTATION_PREDICATE_DETAIL_ACTION_INVALID';
  if (
    action.object_kind !== 'SERVING_EXACT_DETAIL_ACTION_DEFINITION'
    || action.schema_version !== 'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1'
    || action.stable_id !== TARGET_DETAIL_ACTION_STABLE_ID
    || action.action_slot_key !== TARGET_DETAIL_ACTION_STABLE_ID
    || action.action_version !== TARGET_DETAIL_ACTION_VERSION
    || action.parent_kind !== 'RESULT_ROW'
    || action.detail_kind !== TARGET_DETAIL_ACTION_STABLE_ID
    || action.object_authorisation_predicate
      !== 'PARENT_SELECTED_RESULT_COMPOSITION_ONLY'
    || action.whole_document_permission !== false
  ) {
    fail(
      code,
      'The predicate requires the governed result composition exact-detail action.',
    );
  }
}

function validateAuthoredAgreementRepresentationPredicateInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const selected = authoredMembers.filter(
    (member) => member?.object_kind === AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND,
  );
  if (selected.length === 0) return;
  if (selected.length !== 1) {
    fail(
      'AGREEMENT_REPRESENTATION_PREDICATE_MEMBERSHIP_MISMATCH',
      'The Agreement representation predicate contract requires one catalogue.',
      { actual_count: selected.length },
    );
  }

  validatePredicateDefinition(selected[0].canonical_value);
  validateResultDefinition(onlyMember(
    authoredMembers,
    'RESULT_DEFINITION_INPUT',
    TARGET_PREDICATE_KEY,
    'AGREEMENT_REPRESENTATION_PREDICATE_RESULT_MISSING',
  ));
  validateDetailAction(onlyMember(
    authoredMembers,
    'SERVING_EXACT_DETAIL_ACTION_DEFINITION',
    TARGET_DETAIL_ACTION_STABLE_ID,
    'AGREEMENT_REPRESENTATION_PREDICATE_DETAIL_ACTION_MISSING',
  ));
}

module.exports = {
  AGREEMENT_NAVIGATION_CATALOGUE_STABLE_ID,
  AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND,
  AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA,
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  AgreementRepresentationPredicateContractInputError,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PREDICATE_KEY,
  validateAuthoredAgreementRepresentationPredicateInputs,
};
