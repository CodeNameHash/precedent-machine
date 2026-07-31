const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const AGREEMENT_NAVIGATION_CATALOGUE_INPUT_KIND =
  'AGREEMENT_NAVIGATION_CATALOGUE_INPUT';
const AGREEMENT_NAVIGATION_CATALOGUE_INPUT_SCHEMA =
  'AGREEMENT_NAVIGATION_CATALOGUE_INPUT/V1';
const AGREEMENT_NAVIGATION_STABLE_ID =
  'AGREEMENT_NAVIGATION_DEFINITION_CATALOGUE';
const AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND =
  'AGREEMENT_PREDICATE_CONTRACT_INPUT';
const AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA =
  'AGREEMENT_PREDICATE_CONTRACT_INPUT/V1';
const AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID =
  'AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE';
const AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID =
  'AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE';
const TARGET_PATTERN_KEY = 'TARGET_CAPITALISATION_BRING_DOWN';
const TARGET_CAPEX_PATTERN_KEY = 'TARGET_CAPEX_RESTRICTION';
const TARGET_DETAIL_ACTION_STABLE_ID = 'RESULT_COMPOSITION_EVIDENCE';
const TARGET_DETAIL_ACTION_VERSION = 1;
const DEFINITION_DIGEST =
  '4960f8967de820303cb4a283002b3e8bcf57370d67f8e7733457803dc8893862';

const ADMITTED_TOPICS = Object.freeze([
  Object.freeze({
    topic_key: 'REPRESENTATIONS',
    label: 'Representations',
    predicate_catalogue_stable_id:
      AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
    pattern: Object.freeze({
      pattern_key: TARGET_PATTERN_KEY,
      label: 'Target capitalisation bring-down',
      predicate_key: TARGET_PATTERN_KEY,
      predicate_version: 1,
      predicate_shape: 'ATOMIC',
    }),
    result_definition_version: 3,
  }),
  Object.freeze({
    topic_key: 'INTERIM_OPERATING_COVENANTS',
    label: 'Interim operating covenants',
    predicate_catalogue_stable_id:
      AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
    pattern: Object.freeze({
      pattern_key: TARGET_CAPEX_PATTERN_KEY,
      label: 'Target capex restriction',
      predicate_key: TARGET_CAPEX_PATTERN_KEY,
      predicate_version: 1,
      predicate_shape: 'ATOMIC',
    }),
    result_definition_version: 1,
  }),
]);

class AgreementNavigationContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgreementNavigationContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new AgreementNavigationContractInputError(code, message, details);
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
    fail(code, 'The Agreement navigation contract dependency is not unique.', {
      object_kind: objectKind,
      stable_id: stableId,
      actual_count: matches.length,
    });
  }
  return matches[0].canonical_value;
}

function validateNavigationDefinition(navigation) {
  const code = 'INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT';
  requireExactKeys(navigation, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Agreement navigation authored input', code);
  if (
    navigation.object_kind !== AGREEMENT_NAVIGATION_CATALOGUE_INPUT_KIND
    || navigation.stable_id !== AGREEMENT_NAVIGATION_STABLE_ID
    || navigation.schema_version !== AGREEMENT_NAVIGATION_CATALOGUE_INPUT_SCHEMA
  ) {
    fail(code, 'The Agreement navigation identity does not match the governed contract.');
  }
  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(navigation.definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The Agreement navigation definition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== DEFINITION_DIGEST) {
    fail(code, 'The complete Agreement navigation definition has changed.', {
      expected_definition_digest: DEFINITION_DIGEST,
      actual_definition_digest: actualDigest,
    });
  }
  const topics = navigation.definition.domains?.[0]?.topics;
  const expectedTopics = ADMITTED_TOPICS.map((topic) => ({
    topic_key: topic.topic_key,
    label: topic.label,
    predicate_catalogue_stable_id: topic.predicate_catalogue_stable_id,
    patterns: [topic.pattern],
  }));
  if (canonicalJson(topics) !== canonicalJson(expectedTopics)) {
    fail(code, 'Agreement navigation topics are not the admitted Product paths.');
  }
}

function validateResultDefinition(result, topic) {
  const code = 'AGREEMENT_NAVIGATION_RESULT_DEPENDENCY_INVALID';
  requireExactKeys(result, [
    'authored_definition',
    'object_kind',
    'schema_version',
    'stable_id',
  ], `${topic.label} result definition`, code);
  if (
    result.object_kind !== 'RESULT_DEFINITION_INPUT'
    || result.schema_version !== 'RESULT_DEFINITION_INPUT/V1'
    || result.stable_id !== topic.pattern.predicate_key
    || result.authored_definition?.result_key !== topic.pattern.predicate_key
    || result.authored_definition?.result_version !== topic.result_definition_version
  ) {
    fail(code, 'The Agreement navigation pattern requires its governed result version.');
  }
}

function validateDetailAction(action) {
  const code = 'AGREEMENT_NAVIGATION_DETAIL_ACTION_DEPENDENCY_INVALID';
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
      'Agreement navigation requires the governed result composition action.',
    );
  }
}

function validatePredicateCatalogue(predicateCatalogue, topic) {
  const code = 'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_INVALID';
  requireExactKeys(predicateCatalogue, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], `${topic.label} predicate catalogue`, code);
  if (
    predicateCatalogue.object_kind !== AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND
    || predicateCatalogue.schema_version
      !== AGREEMENT_PREDICATE_CONTRACT_INPUT_SCHEMA
    || predicateCatalogue.stable_id !== topic.predicate_catalogue_stable_id
    || predicateCatalogue.definition?.domain_key !== 'AGREEMENT'
    || predicateCatalogue.definition?.topic_key !== topic.topic_key
    || !Array.isArray(predicateCatalogue.definition?.predicate_admissions)
  ) {
    fail(code, 'The Agreement predicate catalogue is not governed.');
  }
  const matchingAdmissions = predicateCatalogue.definition.predicate_admissions.filter(
    (admission) => admission?.predicate_key === topic.pattern.predicate_key
      && admission.predicate_version === topic.pattern.predicate_version,
  );
  if (matchingAdmissions.length !== 1) {
    fail(code, 'The Agreement predicate admission is missing or duplicated.');
  }
  const admission = matchingAdmissions[0];
  requireExactKeys(admission, [
    'predicate_key',
    'predicate_version',
    'result_definition_stable_id',
    'result_definition_version',
    'exact_detail_action_stable_id',
    'exact_detail_action_version',
  ], `${topic.label} predicate admission`, code);
  if (
    admission.result_definition_stable_id !== topic.pattern.predicate_key
    || admission.result_definition_version !== topic.result_definition_version
    || admission.exact_detail_action_stable_id !== TARGET_DETAIL_ACTION_STABLE_ID
    || admission.exact_detail_action_version !== TARGET_DETAIL_ACTION_VERSION
  ) {
    fail(code, 'The Agreement predicate does not bind the exact result and action.');
  }
}

function validateAuthoredAgreementNavigationInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const selected = authoredMembers.filter(
    (member) => member?.object_kind === AGREEMENT_NAVIGATION_CATALOGUE_INPUT_KIND,
  );
  if (selected.length === 0) return;
  if (selected.length !== 1) {
    fail(
      'AGREEMENT_NAVIGATION_CONTRACT_MEMBERSHIP_MISMATCH',
      'The Agreement navigation contract requires exactly one catalogue input.',
      { actual_count: selected.length },
    );
  }

  validateNavigationDefinition(selected[0].canonical_value);
  for (const topic of ADMITTED_TOPICS) {
    validateResultDefinition(onlyMember(
      authoredMembers,
      'RESULT_DEFINITION_INPUT',
      topic.pattern.predicate_key,
      'AGREEMENT_NAVIGATION_RESULT_DEPENDENCY_MISSING',
    ), topic);
    validatePredicateCatalogue(onlyMember(
      authoredMembers,
      AGREEMENT_PREDICATE_CONTRACT_INPUT_KIND,
      topic.predicate_catalogue_stable_id,
      'AGREEMENT_NAVIGATION_PREDICATE_DEPENDENCY_MISSING',
    ), topic);
  }
  validateDetailAction(onlyMember(
    authoredMembers,
    'SERVING_EXACT_DETAIL_ACTION_DEFINITION',
    TARGET_DETAIL_ACTION_STABLE_ID,
    'AGREEMENT_NAVIGATION_DETAIL_ACTION_DEPENDENCY_MISSING',
  ));
}

module.exports = {
  ADMITTED_TOPICS,
  AGREEMENT_INTERIM_OPERATING_COVENANT_PREDICATE_CATALOGUE_STABLE_ID,
  AGREEMENT_NAVIGATION_CATALOGUE_INPUT_KIND,
  AGREEMENT_NAVIGATION_CATALOGUE_INPUT_SCHEMA,
  AGREEMENT_NAVIGATION_STABLE_ID,
  AGREEMENT_REPRESENTATION_PREDICATE_CATALOGUE_STABLE_ID,
  AgreementNavigationContractInputError,
  TARGET_CAPEX_PATTERN_KEY,
  TARGET_DETAIL_ACTION_STABLE_ID,
  TARGET_PATTERN_KEY,
  validateAuthoredAgreementNavigationInputs,
};
