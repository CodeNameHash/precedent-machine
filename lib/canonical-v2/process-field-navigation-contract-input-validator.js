const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_FIELD_CATALOGUE_INPUT_KIND = 'PROCESS_FIELD_CATALOGUE_INPUT';
const PROCESS_FIELD_CATALOGUE_INPUT_SCHEMA = 'PROCESS_FIELD_CATALOGUE_INPUT/V1';
const PROCESS_NAVIGATION_CATALOGUE_INPUT_KIND = 'PROCESS_NAVIGATION_CATALOGUE_INPUT';
const PROCESS_NAVIGATION_CATALOGUE_INPUT_SCHEMA =
  'PROCESS_NAVIGATION_CATALOGUE_INPUT/V1';

const PROCESS_FIELD_KEYS = Object.freeze([
  'process_event_type',
  'process_event_time',
  'process_phase',
  'process_channel',
  'process_outcome',
  'bidder_track',
  'exclusivity_subject',
  'process_participant',
  'process_participant_role',
  'actual_drafting',
  'source_document_role',
  'certification_state',
]);

const PROCESS_NAVIGATION_PREDICATE_KEYS = Object.freeze([
  'EXCLUSIVITY_REQUESTED',
  'EXCLUSIVITY_RESPONSE_ANY',
  'EXCLUSIVITY_EXPRESS_REFUSAL',
  'EXCLUSIVITY_COUNTERPROPOSAL',
  'EXCLUSIVITY_CONDITIONAL_ACCEPTANCE',
  'EXCLUSIVITY_GRANTED',
  'EXCLUSIVITY_EXTENSION',
  'EXCLUSIVITY_AMENDMENT',
  'EXCLUSIVITY_WAIVER',
  'EXCLUSIVITY_EXPIRY',
  'EXCLUSIVITY_END',
]);

const DEFINITION_LOCKS = Object.freeze({
  PROCESS_FIELD_DEFINITION_CATALOGUE: Object.freeze({
    object_kind: PROCESS_FIELD_CATALOGUE_INPUT_KIND,
    schema_version: PROCESS_FIELD_CATALOGUE_INPUT_SCHEMA,
    definition_digest: 'd602d78214e168eac64964f953fe0c3c7d9fd454fe7efdad0aeb6b7d0d145404',
    error_code: 'INVALID_PROCESS_FIELD_CATALOGUE_INPUT',
  }),
  PROCESS_NAVIGATION_DEFINITION_CATALOGUE: Object.freeze({
    object_kind: PROCESS_NAVIGATION_CATALOGUE_INPUT_KIND,
    schema_version: PROCESS_NAVIGATION_CATALOGUE_INPUT_SCHEMA,
    definition_digest: 'af849545e2850219bb828aacc66cd8657caeac717fb46bb28a7c77a272beffdb',
    error_code: 'INVALID_PROCESS_NAVIGATION_CATALOGUE_INPUT',
  }),
});

class ProcessFieldNavigationContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessFieldNavigationContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessFieldNavigationContractInputError(code, message, details);
}

function requireExactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function validateDefinitionLock(member, stableId) {
  const lock = DEFINITION_LOCKS[stableId];
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], `${stableId} authored input`, lock.error_code);
  if (
    value.object_kind !== lock.object_kind
    || value.stable_id !== stableId
    || value.schema_version !== lock.schema_version
  ) {
    fail(lock.error_code, `${stableId} identity does not match the governed contract.`);
  }
  let actualDigest;
  try {
    actualDigest = sha256Hex(Buffer.from(canonicalJson(value.definition), 'utf8'));
  } catch (error) {
    fail(lock.error_code, `${stableId} is not canonical JSON.`, {
      cause: error.message,
    });
  }
  if (actualDigest !== lock.definition_digest) {
    fail(lock.error_code, `${stableId} does not match its complete governed definition.`, {
      expected_definition_digest: lock.definition_digest,
      actual_definition_digest: actualDigest,
    });
  }
}

function validateFieldReferences(fieldMember, authoredMembers) {
  const code = 'INVALID_PROCESS_FIELD_CATALOGUE_INPUT';
  const definition = fieldMember.canonical_value.definition;
  if (
    definition.pm_wide_catalogue_binding.combined_catalogue_stable_id
      !== 'PRODUCT_FIELD_CATALOGUE'
    || definition.pm_wide_catalogue_binding.shared_deal_catalogue_stable_id
      !== 'SHARED_DEAL_FIELD_CATALOGUE'
  ) {
    fail(code, 'The Process field contribution does not bind the one PM-wide catalogue.');
  }
  const fieldKeys = definition.field_definitions.map((field) => field.field_key);
  if (canonicalJson(fieldKeys) !== canonicalJson(PROCESS_FIELD_KEYS)) {
    fail(code, 'The Process field contribution is incomplete, duplicated, or reordered.');
  }
  if (!authoredMembers.some(
    (member) => member.canonical_value?.stable_id === 'SHARED_DEAL_FIELD_CATALOGUE',
  )) {
    fail(code, 'The Process field contribution has no exact shared field catalogue input.');
  }
  const actualDrafting = definition.field_definitions.find(
    (field) => field.field_key === 'actual_drafting',
  );
  if (
    actualDrafting.capabilities.filter !== false
    || actualDrafting.permitted_operators.length !== 0
    || actualDrafting.control_type !== 'NONE'
  ) {
    fail(code, 'Actual drafting can be displayed but cannot become an inferred filter.');
  }
  const repeatableFields = definition.field_definitions.filter(
    (field) => field.capabilities.filter === true
      && ['ONE_OR_MORE', 'MANY'].includes(field.multiplicity),
  );
  if (repeatableFields.some(
    (field) => !field.completeness_semantics.includes('NON_VACUOUS_ALL')
      || !field.completeness_semantics.includes('UNKNOWN_IF_COLLECTION_INCOMPLETE')
      || !field.permitted_operators.includes('ALL'),
  )) {
    fail(
      code,
      'Every repeatable Process filter must use non-vacuous ALL and UNKNOWN for incomplete sets.',
    );
  }
}

function validateNavigationReferences(navigationMember, authoredMembers) {
  const code = 'INVALID_PROCESS_NAVIGATION_CATALOGUE_INPUT';
  const definition = navigationMember.canonical_value.definition;
  const domain = definition.domains[0];
  const topic = domain.topics[0];
  const patternKeys = topic.patterns.map((pattern) => pattern.predicate_key);
  if (canonicalJson(patternKeys) !== canonicalJson(PROCESS_NAVIGATION_PREDICATE_KEYS)) {
    fail(code, 'The Process navigation pattern set is incomplete, duplicated, or reordered.');
  }
  if (
    domain.domain_key !== 'PROCESS'
    || topic.topic_key !== 'EXCLUSIVITY'
    || definition.pm_wide_catalogue_binding.combined_catalogue_stable_id
      !== 'PRODUCT_NAVIGATION_CATALOGUE'
  ) {
    fail(code, 'The Process navigation contribution does not bind the governed hierarchy.');
  }
  if (!authoredMembers.some(
    (member) => member.canonical_value?.stable_id === 'PROCESS',
  )) {
    fail(code, 'The Process navigation contribution has no Process domain registry input.');
  }
  const predicateCatalogue = authoredMembers.find(
    (member) => member.canonical_value?.stable_id
      === 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  )?.canonical_value;
  const admittedPredicates =
    predicateCatalogue?.definition?.ordinary_question_contract?.mandatory_predicate_keys;
  if (
    !Array.isArray(admittedPredicates)
    || patternKeys.some((predicateKey) => !admittedPredicates.includes(predicateKey))
  ) {
    fail(code, 'A Process navigation entry does not name a governed predicate.');
  }
  if (topic.patterns.some((pattern) => /\bdeclin/i.test(pattern.label))) {
    fail(code, 'A generic declined label cannot collapse distinct response states.');
  }
}

function validateAuthoredProcessFieldNavigationInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => [
      PROCESS_FIELD_CATALOGUE_INPUT_KIND,
      PROCESS_NAVIGATION_CATALOGUE_INPUT_KIND,
    ].includes(member?.object_kind),
  );
  if (members.length === 0) return;

  const actualIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  const expectedIds = Object.keys(DEFINITION_LOCKS).sort();
  if (canonicalJson(actualIds) !== canonicalJson(expectedIds)) {
    fail(
      'PROCESS_FIELD_NAVIGATION_CONTRACT_MEMBERSHIP_MISMATCH',
      'The Process field and navigation contract set is incomplete, duplicated, or unregistered.',
      {
        actual_stable_ids: actualIds,
        expected_stable_ids: expectedIds,
      },
    );
  }

  for (const member of members) {
    validateDefinitionLock(member, member.canonical_value.stable_id);
  }
  validateFieldReferences(
    members.find(
      (member) => member.object_kind === PROCESS_FIELD_CATALOGUE_INPUT_KIND,
    ),
    authoredMembers,
  );
  validateNavigationReferences(
    members.find(
      (member) => member.object_kind === PROCESS_NAVIGATION_CATALOGUE_INPUT_KIND,
    ),
    authoredMembers,
  );
}

module.exports = {
  PROCESS_FIELD_CATALOGUE_INPUT_KIND,
  PROCESS_FIELD_CATALOGUE_INPUT_SCHEMA,
  PROCESS_FIELD_KEYS,
  PROCESS_NAVIGATION_CATALOGUE_INPUT_KIND,
  PROCESS_NAVIGATION_CATALOGUE_INPUT_SCHEMA,
  PROCESS_NAVIGATION_PREDICATE_KEYS,
  ProcessFieldNavigationContractInputError,
  validateAuthoredProcessFieldNavigationInputs,
};
