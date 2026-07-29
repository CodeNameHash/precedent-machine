const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  BOUNDARY_PHRASE_CLASSES,
  OUTCOMES,
  POSITIVE_PHRASE_CLASSES,
  PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
  PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID,
  normalizeProductAskPhrase,
  productAskMappingRegistryPayloadDigest,
} = require('./product-ask-mapping-registry');
const {
  compileProductBrowseQuery,
} = require('./product-browse-compiler');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
} = require('./product-query-ir');

const MAX_ASK_UTF8_BYTES = 2048;
const MAX_MAPPING_ENTRIES = 16384;
const MAX_MAPPING_PHRASE_UTF8_BYTES = 512;
const PRODUCT_ASK_MAPPING_DEFINITION_DOMAIN =
  'PRODUCT_ASK_MAPPING_DEFINITION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MANIFEST_KEYS = Object.freeze([
  'schema_version',
  'stable_id',
  'registry_version',
  'approved_pm_data_version_id',
  'candidate_release_manifest_id',
  'candidate_release_manifest_payload_digest',
  'basis',
  'entries',
  'pattern_coverage',
  'pattern_exclusions',
  'difference',
  'counts',
  'manifest_id',
  'canonical_payload_digest',
]);
const MAPPING_KEYS = Object.freeze([
  'mapping_key',
  'phrase',
  'normalized_phrase',
  'phrase_class',
  'outcome',
  'domain_key',
  'topic_key',
  'pattern_key',
  'predicate_key',
  'predicate_version',
  'concept_label',
  'choices',
  'nearest_supported_concepts',
  'mapping_definition_id',
]);
const CONCEPT_KEYS = Object.freeze([
  'domain_key',
  'topic_key',
  'pattern_key',
  'predicate_key',
  'predicate_version',
  'label',
]);
const MAPPING_ADMISSION_KEYS = Object.freeze([
  'stable_id',
  'registry_version',
  'manifest_id',
  'payload_digest',
  'navigation_catalogue_identity',
]);

class ProductAskCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductAskCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductAskCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_ASK_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_ASK_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireText(
  value,
  label,
  code = 'INVALID_PRODUCT_ASK_INPUT',
) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(value, label, code) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireArray(value, label, code) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_ASK_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product Ask input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateConcept(value, label, code) {
  requireExactKeys(value, CONCEPT_KEYS, label, code);
  for (const key of [
    'domain_key',
    'topic_key',
    'pattern_key',
    'predicate_key',
    'label',
  ]) {
    requireText(value[key], `${label} ${key}`, code);
  }
  requirePositiveInteger(
    value.predicate_version,
    `${label} predicate_version`,
    code,
  );
}

function validateMappingEntry(entry, index) {
  const code = 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY';
  const label = `Product Ask mapping ${index}`;
  requireExactKeys(entry, MAPPING_KEYS, label, code);
  requireText(entry.mapping_key, `${label} mapping_key`, code);
  requireText(entry.phrase, `${label} phrase`, code);
  requireText(entry.normalized_phrase, `${label} normalized_phrase`, code);
  if (
    Buffer.byteLength(entry.phrase, 'utf8') > MAX_MAPPING_PHRASE_UTF8_BYTES
    || Buffer.byteLength(entry.normalized_phrase, 'utf8')
      > MAX_MAPPING_PHRASE_UTF8_BYTES
  ) {
    fail(code, `${label} phrase exceeds the fixed mapping bound.`);
  }
  if (entry.normalized_phrase !== normalizeProductAskPhrase(entry.phrase)) {
    fail(code, `${label} normalized_phrase is not canonical.`);
  }
  if (
    ![...POSITIVE_PHRASE_CLASSES, ...BOUNDARY_PHRASE_CLASSES]
      .includes(entry.phrase_class)
  ) {
    fail(code, `${label} phrase_class is not registered.`);
  }
  if (!OUTCOMES.includes(entry.outcome)) {
    fail(code, `${label} outcome is not registered.`);
  }
  const choices = requireArray(entry.choices, `${label} choices`, code);
  const nearest = requireArray(
    entry.nearest_supported_concepts,
    `${label} nearest_supported_concepts`,
    code,
  );
  choices.forEach((concept, conceptIndex) => validateConcept(
    concept,
    `${label} choice ${conceptIndex}`,
    code,
  ));
  nearest.forEach((concept, conceptIndex) => validateConcept(
    concept,
    `${label} nearest concept ${conceptIndex}`,
    code,
  ));
  if (entry.outcome === 'COMPILED') {
    for (const key of [
      'domain_key',
      'topic_key',
      'pattern_key',
      'predicate_key',
      'concept_label',
    ]) {
      requireText(entry[key], `${label} ${key}`, code);
    }
    requirePositiveInteger(
      entry.predicate_version,
      `${label} predicate_version`,
      code,
    );
    if (choices.length !== 0 || nearest.length !== 0) {
      fail(code, `${label} compiled mapping has refusal alternatives.`);
    }
  } else {
    for (const key of [
      'domain_key',
      'topic_key',
      'pattern_key',
      'predicate_key',
      'predicate_version',
      'concept_label',
    ]) {
      if (entry[key] !== null) {
        fail(code, `${label} refusal has an executable concept.`);
      }
    }
    if (
      entry.outcome === 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE'
      && choices.length < 2
    ) {
      fail(code, `${label} ambiguity has fewer than two choices.`);
    }
    if (entry.outcome === 'TYPED_UNSUPPORTED' && nearest.length === 0) {
      fail(code, `${label} refusal has no nearby supported concept.`);
    }
  }
  requireDigest(
    entry.mapping_definition_id,
    `${label} mapping_definition_id`,
    code,
  );
  const {
    mapping_definition_id: suppliedDefinitionId,
    ...definition
  } = entry;
  const expectedDefinitionId = contentId(
    PRODUCT_ASK_MAPPING_DEFINITION_DOMAIN,
    definition,
  );
  if (suppliedDefinitionId !== expectedDefinitionId) {
    fail(code, `${label} definition identity does not match.`);
  }
}

function validateMappingRegistryAdmission(value) {
  const code = 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY_ADMISSION';
  requireExactKeys(value, MAPPING_ADMISSION_KEYS, 'Ask registry admission', code);
  if (value.stable_id !== PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID) {
    fail(code, 'The Product Ask registry stable identity is not supported.');
  }
  requirePositiveInteger(value.registry_version, 'Registry version', code);
  requireDigest(value.manifest_id, 'Registry manifest_id', code);
  requireDigest(value.payload_digest, 'Registry payload_digest', code);
  requireExactKeys(
    value.navigation_catalogue_identity,
    ['manifest_id', 'payload_digest'],
    'Ask registry navigation identity',
    code,
  );
  requireDigest(
    value.navigation_catalogue_identity.manifest_id,
    'Ask registry navigation manifest_id',
    code,
  );
  requireDigest(
    value.navigation_catalogue_identity.payload_digest,
    'Ask registry navigation payload_digest',
    code,
  );
  return value;
}

function validateMappingRegistry({
  registry,
  mappingRegistryAdmission,
  admission,
}) {
  const code = 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY';
  requireObject(admission, 'Product query admission', code);
  if (admission.schema_version !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA) {
    fail(code, 'The Product query admission schema is not supported.');
  }
  const checkedAdmission =
    validateMappingRegistryAdmission(mappingRegistryAdmission);
  requireExactKeys(registry, MANIFEST_KEYS, 'Product Ask registry', code);
  if (registry.schema_version !== PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA) {
    fail(code, 'The Product Ask registry schema is not supported.');
  }
  if (registry.stable_id !== PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID) {
    fail(code, 'The Product Ask registry stable identity is not supported.');
  }
  requirePositiveInteger(registry.registry_version, 'Registry version', code);
  for (const key of [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'manifest_id',
    'canonical_payload_digest',
  ]) {
    requireDigest(registry[key], `Product Ask registry ${key}`, code);
  }
  const body = { ...registry };
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  const expectedManifestId = contentId(
    PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    body,
  );
  if (registry.manifest_id !== expectedManifestId) {
    fail(code, 'The Product Ask registry manifest identity does not match.');
  }
  if (
    registry.canonical_payload_digest
      !== productAskMappingRegistryPayloadDigest(registry)
  ) {
    fail(code, 'The Product Ask registry payload digest does not match.');
  }
  requireObject(registry.basis, 'Product Ask registry basis', code);
  requireExactKeys(
    registry.basis.navigation_catalogue_identity,
    ['manifest_id', 'payload_digest'],
    'Product Ask registry navigation identity',
    code,
  );
  const registryIdentity = {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    manifest_id: registry.manifest_id,
    payload_digest: registry.canonical_payload_digest,
    navigation_catalogue_identity:
      registry.basis.navigation_catalogue_identity,
  };
  if (canonicalJson(registryIdentity) !== canonicalJson(checkedAdmission)) {
    fail(code, 'The Product Ask registry does not match its checked admission.');
  }
  for (const key of [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ]) {
    if (registry[key] !== admission[key]) {
      fail(code, `The Product Ask registry has a stale ${key}.`);
    }
  }
  requireObject(
    admission.navigation_catalogue,
    'Product query navigation admission',
    code,
  );
  const expectedNavigationIdentity = {
    manifest_id: admission.navigation_catalogue.catalogue_id,
    payload_digest: admission.navigation_catalogue.payload_digest,
  };
  if (
    canonicalJson(registry.basis.navigation_catalogue_identity)
      !== canonicalJson(expectedNavigationIdentity)
  ) {
    fail(code, 'The Product Ask registry has stale Product navigation.');
  }

  const entries = requireArray(registry.entries, 'Product Ask entries', code);
  if (entries.length === 0 || entries.length > MAX_MAPPING_ENTRIES) {
    fail(code, 'The Product Ask registry entry count is outside its bound.');
  }
  entries.forEach(validateMappingEntry);
  const mappingKeys = entries.map((entry) => entry.mapping_key);
  const normalizedPhrases = entries.map((entry) => entry.normalized_phrase);
  if (
    new Set(mappingKeys).size !== mappingKeys.length
    || new Set(normalizedPhrases).size !== normalizedPhrases.length
  ) {
    fail(code, 'The Product Ask registry contains a duplicate mapping.');
  }
  if (
    canonicalJson(mappingKeys)
      !== canonicalJson([...mappingKeys].sort())
  ) {
    fail(code, 'Product Ask mappings are not in canonical key order.');
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

function compileProductAskQuery({
  question,
  mapping_registry: mappingRegistry,
  mapping_registry_admission: mappingRegistryAdmission,
  navigation_definition: navigationDefinition,
  admission,
  query_templates: queryTemplates,
}) {
  if (
    typeof question !== 'string'
    || question.trim().length === 0
  ) {
    fail(
      'INVALID_PRODUCT_ASK_INPUT',
      'Product Ask question must contain text.',
    );
  }
  if (Buffer.byteLength(question, 'utf8') > MAX_ASK_UTF8_BYTES) {
    fail('PRODUCT_ASK_TOO_LARGE', 'The Product Ask question is too large.');
  }
  const mappings = validateMappingRegistry({
    registry: mappingRegistry,
    mappingRegistryAdmission,
    admission,
  });
  const mapping = mappings.get(normalizeProductAskPhrase(question.trim()));
  if (!mapping) {
    return unsupportedResult({
      registryId: mappingRegistry.manifest_id,
      reason: 'NO_CHECKED_MAPPING',
      nearestSupportedConcepts: [],
    });
  }
  if (mapping.outcome === 'TYPED_UNSUPPORTED') {
    return unsupportedResult({
      registryId: mappingRegistry.manifest_id,
      mappingKey: mapping.mapping_key,
      reason: mapping.phrase_class,
      nearestSupportedConcepts: mapping.nearest_supported_concepts,
    });
  }
  if (mapping.outcome === 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE') {
    return deepFreeze({
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      mapping_registry_id: mappingRegistry.manifest_id,
      mapping_key: mapping.mapping_key,
      choices: clone(mapping.choices),
      query_ir: null,
    });
  }

  const browseResult = compileProductBrowseQuery({
    selection: {
      domain_key: mapping.domain_key,
      topic_key: mapping.topic_key,
      pattern_key: mapping.pattern_key,
    },
    navigation_definition: navigationDefinition,
    admission,
    query_templates: queryTemplates,
  });
  if (
    browseResult.outcome !== 'COMPILED'
    || browseResult.understood_legal_question.predicate_key
      !== mapping.predicate_key
    || browseResult.understood_legal_question.predicate_version
      !== mapping.predicate_version
  ) {
    fail(
      'STALE_PRODUCT_ASK_MAPPING',
      'The checked Ask mapping does not match the admitted Browse Pattern.',
      { mapping_key: mapping.mapping_key },
    );
  }
  return deepFreeze({
    outcome: 'COMPILED',
    mapping_registry_id: mappingRegistry.manifest_id,
    mapping_key: mapping.mapping_key,
    understood_legal_question: {
      ...clone(browseResult.understood_legal_question),
      label: mapping.concept_label,
    },
    query_ir: browseResult.query_ir,
  });
}

module.exports = {
  MAX_ASK_UTF8_BYTES,
  ProductAskCompilerError,
  compileProductAskQuery,
};
