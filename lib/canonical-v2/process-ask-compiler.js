const {
  canonicalJson,
  sha256Hex,
} = require('./canonical-bytes');
const {
  compileProcessQueryTemplate,
} = require('./process-query-ir');

const PROCESS_ASK_MAPPING_REGISTRY_SCHEMA =
  'PROCESS_ASK_MAPPING_REGISTRY/V1';
const MAX_ASK_UTF8_BYTES = 2048;
const MAX_ASK_MAPPING_ENTRIES = 4096;
const MAX_ASK_MAPPING_PHRASE_UTF8_BYTES = 512;
const MAX_ASK_MAPPING_ALTERNATIVES = 32;
const POSITIVE_PHRASE_CLASSES = Object.freeze([
  'PRACTITIONER_PHRASE',
  'DRAFTING_SYNONYM',
  'ABBREVIATION',
  'ORDINARY_MISSPELLING',
]);
const BOUNDARY_PHRASE_CLASSES = Object.freeze([
  'LEGALLY_ADJACENT_NEGATIVE',
  'AMBIGUOUS_LEGAL_PHRASE',
  'UNSUPPORTED_PHRASE',
]);
const OUTCOMES = Object.freeze([
  'COMPILED',
  'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
  'TYPED_UNSUPPORTED',
]);
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProcessAskCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessAskCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessAskCompilerError(code, message, details);
}

function requireObject(value, label, code = 'INVALID_PROCESS_ASK_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_ASK_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireText(value, label, code = 'INVALID_PROCESS_ASK_INPUT') {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(value, label, code = 'INVALID_PROCESS_ASK_INPUT') {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
}

function requirePositiveInteger(
  value,
  label,
  code = 'INVALID_PROCESS_ASK_INPUT',
) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
}

function requireArray(value, label, code = 'INVALID_PROCESS_ASK_INPUT') {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail('INVALID_PROCESS_ASK_INPUT', 'The Ask input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizeProcessAskPhrase(value) {
  requireText(value, 'Ask phrase');
  const normalised = value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .replace(/[?.!]+$/u, '')
    .trim();
  if (!normalised) {
    fail('INVALID_PROCESS_ASK_INPUT', 'Ask phrase is empty after normalisation.');
  }
  return normalised;
}

function processAskMappingRegistryPayloadDigest(registry) {
  requireObject(registry, 'Ask mapping registry');
  const body = { ...registry };
  delete body.canonical_payload_digest;
  return sha256Hex(Buffer.from(canonicalJson(body), 'utf8'));
}

function validateConcept(value, label, code) {
  requireExactKeys(value, [
    'predicate_key',
    'predicate_version',
    'label',
  ], label, code);
  requireText(value.predicate_key, `${label} predicate_key`, code);
  requirePositiveInteger(
    value.predicate_version,
    `${label} predicate_version`,
    code,
  );
  requireText(value.label, `${label} label`, code);
}

function requireNoDuplicateConcepts(values, label, code) {
  const identities = values.map(
    (value) => `${value.predicate_key}\0${value.predicate_version}`,
  );
  if (new Set(identities).size !== identities.length) {
    fail(code, `${label} contains a duplicate legal concept.`);
  }
}

function validateMappingEntry(entry, index) {
  const code = 'INVALID_PROCESS_ASK_MAPPING_REGISTRY';
  const label = `Ask mapping entry ${index}`;
  requireExactKeys(entry, [
    'mapping_key',
    'phrase',
    'normalized_phrase',
    'phrase_class',
    'outcome',
    'predicate_key',
    'predicate_version',
    'concept_label',
    'choices',
    'nearest_supported_concepts',
  ], label, code);
  requireText(entry.mapping_key, `${label} mapping_key`, code);
  requireText(entry.phrase, `${label} phrase`, code);
  requireText(entry.normalized_phrase, `${label} normalized_phrase`, code);
  if (
    Buffer.byteLength(entry.phrase, 'utf8')
      > MAX_ASK_MAPPING_PHRASE_UTF8_BYTES
    || Buffer.byteLength(entry.normalized_phrase, 'utf8')
      > MAX_ASK_MAPPING_PHRASE_UTF8_BYTES
  ) {
    fail(code, `${label} phrase exceeds the fixed mapping bound.`);
  }
  if (entry.normalized_phrase !== normalizeProcessAskPhrase(entry.phrase)) {
    fail(code, `${label} normalized_phrase is not derived by the governed normaliser.`);
  }
  if (![...POSITIVE_PHRASE_CLASSES, ...BOUNDARY_PHRASE_CLASSES]
    .includes(entry.phrase_class)) {
    fail(code, `${label} phrase_class is not registered.`);
  }
  if (!OUTCOMES.includes(entry.outcome)) {
    fail(code, `${label} outcome is not registered.`);
  }
  requireArray(entry.choices, `${label} choices`, code)
    .forEach((choice, choiceIndex) => validateConcept(
      choice,
      `${label} choice ${choiceIndex}`,
      code,
    ));
  if (entry.choices.length > MAX_ASK_MAPPING_ALTERNATIVES) {
    fail(code, `${label} has too many legal choices.`);
  }
  requireNoDuplicateConcepts(entry.choices, `${label} choices`, code);
  requireArray(
    entry.nearest_supported_concepts,
    `${label} nearest_supported_concepts`,
    code,
  ).forEach((concept, conceptIndex) => validateConcept(
    concept,
    `${label} nearest supported concept ${conceptIndex}`,
    code,
  ));
  if (
    entry.nearest_supported_concepts.length
      > MAX_ASK_MAPPING_ALTERNATIVES
  ) {
    fail(code, `${label} has too many nearby concepts.`);
  }
  requireNoDuplicateConcepts(
    entry.nearest_supported_concepts,
    `${label} nearest_supported_concepts`,
    code,
  );

  if (POSITIVE_PHRASE_CLASSES.includes(entry.phrase_class)) {
    if (entry.outcome !== 'COMPILED') {
      fail(code, `${label} positive phrase must compile.`);
    }
  } else if (entry.phrase_class === 'AMBIGUOUS_LEGAL_PHRASE') {
    if (entry.outcome !== 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE') {
      fail(code, `${label} ambiguous phrase must require a legal choice.`);
    }
  } else if (entry.outcome !== 'TYPED_UNSUPPORTED') {
    fail(code, `${label} boundary phrase must be typed unsupported.`);
  }

  if (entry.outcome === 'COMPILED') {
    requireText(entry.predicate_key, `${label} predicate_key`, code);
    requirePositiveInteger(
      entry.predicate_version,
      `${label} predicate_version`,
      code,
    );
    requireText(entry.concept_label, `${label} concept_label`, code);
    if (
      entry.choices.length !== 0
      || entry.nearest_supported_concepts.length !== 0
    ) {
      fail(code, `${label} compiled mapping cannot carry refusal alternatives.`);
    }
  } else {
    if (
      entry.predicate_key !== null
      || entry.predicate_version !== null
      || entry.concept_label !== null
    ) {
      fail(code, `${label} refusal cannot carry an executable predicate.`);
    }
    if (
      entry.outcome === 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE'
      && entry.choices.length < 2
    ) {
      fail(code, `${label} ambiguity requires at least two legal choices.`);
    }
    if (
      entry.outcome === 'TYPED_UNSUPPORTED'
      && entry.nearest_supported_concepts.length === 0
    ) {
      fail(code, `${label} checked unsupported mapping requires a nearby concept.`);
    }
  }
}

function validateMappingRegistryAdmission(
  mappingRegistryAdmission,
  admission,
) {
  const code = 'INVALID_PROCESS_ASK_MAPPING_REGISTRY_ADMISSION';
  requireExactKeys(mappingRegistryAdmission, [
    'stable_id',
    'registry_version',
    'approved_pm_data_version_id',
    'predicate_catalogue_stable_id',
    'certification',
    'canonical_payload_digest',
  ], 'Ask mapping registry admission', code);
  requireText(
    mappingRegistryAdmission.stable_id,
    'Ask mapping registry admission stable_id',
    code,
  );
  requirePositiveInteger(
    mappingRegistryAdmission.registry_version,
    'Ask mapping registry admission registry_version',
    code,
  );
  requireDigest(
    mappingRegistryAdmission.approved_pm_data_version_id,
    'Ask mapping registry admission approved_pm_data_version_id',
    code,
  );
  if (
    mappingRegistryAdmission.approved_pm_data_version_id
      !== admission?.approved_pm_data_version_id
  ) {
    fail(
      code,
      'The Ask mapping registry admission is not bound to the admitted PM data version.',
    );
  }
  if (
    mappingRegistryAdmission.predicate_catalogue_stable_id
      !== 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE'
  ) {
    fail(
      code,
      'The Ask mapping registry admission does not bind the Process predicate catalogue.',
    );
  }
  requireExactKeys(mappingRegistryAdmission.certification, [
    'independent_enumeration_id',
    'mapping_reconciliation_id',
    'query_goldens_id',
    'utterance_suite_id',
  ], 'Ask mapping registry admission certification', code);
  for (const [key, value] of Object.entries(
    mappingRegistryAdmission.certification,
  )) {
    requireDigest(
      value,
      `Ask mapping registry admission certification ${key}`,
      code,
    );
  }
  requireDigest(
    mappingRegistryAdmission.canonical_payload_digest,
    'Ask mapping registry admission canonical_payload_digest',
    code,
  );
  return mappingRegistryAdmission;
}

function validateMappingRegistry(
  registry,
  admission,
  mappingRegistryAdmission,
) {
  const code = 'INVALID_PROCESS_ASK_MAPPING_REGISTRY';
  const checkedAdmission = validateMappingRegistryAdmission(
    mappingRegistryAdmission,
    admission,
  );
  requireExactKeys(registry, [
    'schema_version',
    'stable_id',
    'registry_version',
    'approved_pm_data_version_id',
    'predicate_catalogue_stable_id',
    'certification',
    'entries',
    'canonical_payload_digest',
  ], 'Ask mapping registry', code);
  if (registry.schema_version !== PROCESS_ASK_MAPPING_REGISTRY_SCHEMA) {
    fail(code, 'The Ask mapping registry schema is not supported.');
  }
  requireText(registry.stable_id, 'Ask mapping registry stable_id', code);
  requirePositiveInteger(
    registry.registry_version,
    'Ask mapping registry registry_version',
    code,
  );
  requireDigest(
    registry.approved_pm_data_version_id,
    'Ask mapping registry approved_pm_data_version_id',
    code,
  );
  if (
    registry.approved_pm_data_version_id
    !== admission?.approved_pm_data_version_id
  ) {
    fail(code, 'The Ask mapping registry is not bound to the admitted PM data version.');
  }
  if (
    registry.predicate_catalogue_stable_id
    !== 'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE'
  ) {
    fail(code, 'The Ask mapping registry does not bind the Process predicate catalogue.');
  }

  requireExactKeys(registry.certification, [
    'independent_enumeration_id',
    'mapping_reconciliation_id',
    'query_goldens_id',
    'utterance_suite_id',
  ], 'Ask mapping registry certification', code);
  for (const [key, value] of Object.entries(registry.certification)) {
    requireDigest(value, `Ask mapping registry certification ${key}`, code);
  }

  const entries = requireArray(
    registry.entries,
    'Ask mapping registry entries',
    code,
  );
  if (entries.length === 0) {
    fail(code, 'The Ask mapping registry cannot be empty.');
  }
  if (entries.length > MAX_ASK_MAPPING_ENTRIES) {
    fail(code, 'The Ask mapping registry exceeds the fixed entry bound.');
  }
  entries.forEach(validateMappingEntry);
  const mappingKeys = entries.map((entry) => entry.mapping_key);
  const normalisedPhrases = entries.map((entry) => entry.normalized_phrase);
  if (new Set(mappingKeys).size !== mappingKeys.length) {
    fail(code, 'The Ask mapping registry contains a duplicate mapping_key.');
  }
  if (new Set(normalisedPhrases).size !== normalisedPhrases.length) {
    fail(code, 'The Ask mapping registry contains a duplicate normalized_phrase.');
  }
  if (
    canonicalJson([...mappingKeys].sort())
    !== canonicalJson(mappingKeys)
  ) {
    fail(code, 'Ask mapping entries must be ordered by mapping_key.');
  }
  const observedClasses = new Set(entries.map((entry) => entry.phrase_class));
  for (const requiredClass of [
    ...POSITIVE_PHRASE_CLASSES,
    ...BOUNDARY_PHRASE_CLASSES,
  ]) {
    if (!observedClasses.has(requiredClass)) {
      fail(code, `The Ask mapping registry has no ${requiredClass} example.`);
    }
  }
  requireDigest(
    registry.canonical_payload_digest,
    'Ask mapping registry canonical_payload_digest',
    code,
  );
  const actualDigest = processAskMappingRegistryPayloadDigest(registry);
  if (actualDigest !== registry.canonical_payload_digest) {
    fail(code, 'The Ask mapping registry payload digest does not match.', {
      expected: registry.canonical_payload_digest,
      actual: actualDigest,
    });
  }
  const admittedIdentity = {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    predicate_catalogue_stable_id:
      registry.predicate_catalogue_stable_id,
    certification: registry.certification,
    canonical_payload_digest: registry.canonical_payload_digest,
  };
  if (canonicalJson(admittedIdentity) !== canonicalJson(checkedAdmission)) {
    fail(
      code,
      'The Ask mapping registry does not match its checked release admission.',
    );
  }
  return new Map(entries.map((entry) => [
    entry.normalized_phrase,
    entry,
  ]));
}

function unsupportedResult({
  registryId,
  mappingKey = null,
  reason,
  nearestSupportedConcepts,
}) {
  return deepFreeze({
    outcome: 'TYPED_UNSUPPORTED',
    mapping_registry_id: registryId,
    mapping_key: mappingKey,
    reason,
    nearest_supported_concepts: clone(nearestSupportedConcepts),
    query_ir: null,
  });
}

function compileProcessAskQuery({
  question,
  mapping_registry: mappingRegistry,
  mapping_registry_admission: mappingRegistryAdmission,
  admission,
  query_template: queryTemplate,
}) {
  requireText(question, 'Ask question');
  if (Buffer.byteLength(question, 'utf8') > MAX_ASK_UTF8_BYTES) {
    fail('PROCESS_ASK_TOO_LARGE', 'Ask question exceeds the fixed input bound.');
  }
  const mappings = validateMappingRegistry(
    mappingRegistry,
    admission,
    mappingRegistryAdmission,
  );
  const normalizedQuestion = normalizeProcessAskPhrase(question);
  const mapping = mappings.get(normalizedQuestion);

  if (!mapping) {
    return unsupportedResult({
      registryId: mappingRegistry.stable_id,
      reason: 'NO_CHECKED_MAPPING',
      nearestSupportedConcepts: [],
    });
  }
  if (mapping.outcome === 'TYPED_UNSUPPORTED') {
    return unsupportedResult({
      registryId: mappingRegistry.stable_id,
      mappingKey: mapping.mapping_key,
      reason: mapping.phrase_class,
      nearestSupportedConcepts: mapping.nearest_supported_concepts,
    });
  }
  if (mapping.outcome === 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE') {
    return deepFreeze({
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      mapping_registry_id: mappingRegistry.stable_id,
      mapping_key: mapping.mapping_key,
      choices: clone(mapping.choices),
      query_ir: null,
    });
  }

  const queryIr = compileProcessQueryTemplate({
    admission,
    query_template: queryTemplate,
    domain_key: 'PROCESS',
    predicate_key: mapping.predicate_key,
    predicate_version: mapping.predicate_version,
  });
  return deepFreeze({
    outcome: 'COMPILED',
    mapping_registry_id: mappingRegistry.stable_id,
    mapping_key: mapping.mapping_key,
    understood_legal_question: {
      domain_key: 'PROCESS',
      predicate_key: mapping.predicate_key,
      predicate_version: mapping.predicate_version,
      label: mapping.concept_label,
    },
    query_ir: queryIr,
  });
}

module.exports = {
  BOUNDARY_PHRASE_CLASSES,
  MAX_ASK_UTF8_BYTES,
  MAX_ASK_MAPPING_ALTERNATIVES,
  MAX_ASK_MAPPING_ENTRIES,
  MAX_ASK_MAPPING_PHRASE_UTF8_BYTES,
  OUTCOMES,
  POSITIVE_PHRASE_CLASSES,
  PROCESS_ASK_MAPPING_REGISTRY_SCHEMA,
  ProcessAskCompilerError,
  compileProcessAskQuery,
  normalizeProcessAskPhrase,
  processAskMappingRegistryPayloadDigest,
};
