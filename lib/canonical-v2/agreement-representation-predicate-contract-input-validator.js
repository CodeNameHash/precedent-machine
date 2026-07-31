const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND =
  'AGREEMENT_PREDICATE_CONTRACT_INPUT';
const AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA =
  'AGREEMENT_PREDICATE_CONTRACT_INPUT/V1';
const AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID =
  'AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE';
const AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID =
  'AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE';
const TARGET_PREDICATE_KEY = 'TARGET_CAPITALISATION_BRING_DOWN';
const TARGET_CAPEX_PREDICATE_KEY = 'TARGET_CAPEX_RESTRICTION';
const TARGET_DETAIL_ACTION_STABLE_ID = 'RESULT_COMPOSITION_EVIDENCE';
const TARGET_DETAIL_ACTION_VERSION = 1;

const CATALOGUES = Object.freeze([
  Object.freeze({
    stable_id: AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
    topic_key: 'REPRESENTATIONS',
    predicate_key: TARGET_PREDICATE_KEY,
    predicate_version: 1,
    result_definition_version: 3,
    definition_digest:
      '0f3f44e5858282b1cb7aff822987ff5c5b87c9a9a4051af73ec7e6aab1bc9dae',
    error_prefix: 'AGREEMENT_REPRESENTATION_PREDICATE',
  }),
  Object.freeze({
    stable_id: AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
    topic_key: 'INTERIM_OPERATING_COVENANTS',
    predicate_key: TARGET_CAPEX_PREDICATE_KEY,
    predicate_version: 1,
    result_definition_version: 1,
    definition_digest:
      'abdbe926a83d0a59e89d3f8037cd182c6d64a140227686d2ae07194c0a168731',
    error_prefix: 'AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE',
  }),
]);

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

function codeFor(catalogue, suffix) {
  if (suffix === 'INPUT_INVALID') {
    return `INVALID_${catalogue.error_prefix}_INPUT`;
  }
  return `${catalogue.error_prefix}_${suffix}`;
}

function validatePredicateDefinition(predicate, catalogue) {
  const code = codeFor(catalogue, 'INPUT_INVALID');
  requireExactKeys(predicate, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Agreement predicate catalogue authored input', code);
  if (
    predicate.object_kind !== AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND
    || predicate.stable_id !== catalogue.stable_id
    || predicate.schema_version !== AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA
  ) {
    fail(code, 'The Agreement predicate catalogue identity is invalid.');
  }
  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(predicate.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Agreement predicate catalogue is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== catalogue.definition_digest) {
    fail(code, 'The complete Agreement predicate catalogue has changed.', {
      expected_definition_digest: catalogue.definition_digest,
      actual_definition_digest: actualDigest,
    });
  }

  const admission = predicate.definition.predicate_admissions?.[0];
  if (
    predicate.definition.domain_key !== 'AGREEMENT'
    || predicate.definition.topic_key !== catalogue.topic_key
    || predicate.definition.predicate_admissions?.length !== 1
    || admission?.predicate_key !== catalogue.predicate_key
    || admission.predicate_version !== catalogue.predicate_version
    || admission.result_definition_stable_id !== catalogue.predicate_key
    || admission.result_definition_version !== catalogue.result_definition_version
    || admission.exact_detail_action_stable_id !== TARGET_DETAIL_ACTION_STABLE_ID
    || admission.exact_detail_action_version !== TARGET_DETAIL_ACTION_VERSION
  ) {
    fail(code, 'The predicate catalogue does not bind the exact result and action.');
  }
}

function validateResultDefinition(result, catalogue) {
  const code = codeFor(catalogue, 'RESULT_INVALID');
  requireExactKeys(result, [
    'authored_definition',
    'object_kind',
    'schema_version',
    'stable_id',
  ], 'Agreement predicate result definition', code);
  if (
    result.object_kind !== 'RESULT_DEFINITION_INPUT'
    || result.schema_version !== 'RESULT_DEFINITION_INPUT/V1'
    || result.stable_id !== catalogue.predicate_key
    || result.authored_definition?.result_key !== catalogue.predicate_key
    || result.authored_definition?.result_version !== catalogue.result_definition_version
  ) {
    fail(code, 'The predicate catalogue requires its governed result version.');
  }
}

function validateDetailAction(action) {
  const code = 'AGREEMENT_PREDICATE_DETAIL_ACTION_INVALID';
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
      'The predicate catalogue requires the governed result composition exact-detail action.',
    );
  }
}

function validateAuthoredAgreementPredicateInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const selected = authoredMembers.filter(
    (member) => member?.object_kind === AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND,
  );
  if (selected.length === 0) return;
  if (selected.length !== CATALOGUES.length) {
    fail(
      'AGREEMENT_PREDICATE_CATALOGUE_MEMBERSHIP_MISMATCH',
      'The Agreement predicate contract requires exactly the governed catalogues.',
      { actual_count: selected.length, expected_count: CATALOGUES.length },
    );
  }

  for (const catalogue of CATALOGUES) {
    const predicate = onlyMember(
      authoredMembers,
      AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND,
      catalogue.stable_id,
      codeFor(catalogue, 'CATALOGUE_MISSING'),
    );
    validatePredicateDefinition(predicate, catalogue);
    validateResultDefinition(onlyMember(
      authoredMembers,
      'RESULT_DEFINITION_INPUT',
      catalogue.predicate_key,
      codeFor(catalogue, 'RESULT_MISSING'),
    ), catalogue);
  }
  validateDetailAction(onlyMember(
    authoredMembers,
    'SERVING_EXACT_DETAIL_ACTION_DEFINITION',
    TARGET_DETAIL_ACTION_STABLE_ID,
    'AGREEMENT_PREDICATE_DETAIL_ACTION_MISSING',
  ));
}

module.exports = {
  AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND,
  AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA,
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  AgreementRepresentationPredicateContractInputError,
  TARGET_CAPEX_PREDICATE_KEY,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PREDICATE_KEY,
  validateAuthoredAgreementPredicateInputs,
  validateAuthoredAgreementRepresentationPredicateInputs:
    validateAuthoredAgreementPredicateInputs,
};
