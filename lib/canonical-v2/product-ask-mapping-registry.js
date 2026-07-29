const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  navigationDefinitionPayloadDigest,
  validateProductNavigationCatalogueManifest,
} = require('./product-navigation-catalogue');

const PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA =
  'PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST/V1';
const PRODUCT_ASK_MAPPING_RELEASE_ADMISSION_SCHEMA =
  'PRODUCT_ASK_MAPPING_RELEASE_ADMISSION/V1';
const PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID =
  'PRODUCT_ASK_MAPPING_REGISTRY';
const PRODUCT_ASK_MAPPING_REGISTRY_PAYLOAD_DOMAIN =
  'PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_PAYLOAD/V1';
const PRODUCT_ASK_MAPPING_DEFINITION_DOMAIN =
  'PRODUCT_ASK_MAPPING_DEFINITION/V1';
const REQUIRED_INITIAL_DOMAIN_KEYS = Object.freeze([
  'AGREEMENT',
  'PROCESS',
]);
const POSITIVE_PHRASE_CLASSES = Object.freeze([
  'PRACTITIONER_PHRASE',
  'DRAFTING_SYNONYM',
  'ABBREVIATION',
  'ORDINARY_MISSPELLING',
]);
const REQUIRED_PATTERN_PHRASE_CLASSES = Object.freeze([
  'PRACTITIONER_PHRASE',
  'DRAFTING_SYNONYM',
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
const MAX_MAPPING_ENTRIES = 16384;
const MAX_PATTERNS = 8192;
const MAX_PHRASE_UTF8_BYTES = 512;
const MAX_ALTERNATIVES = 32;
const IDENTITY_KEYS = Object.freeze([
  'stable_id',
  'version',
  'payload_digest',
]);
const NAVIGATION_IDENTITY_KEYS = Object.freeze([
  'manifest_id',
  'payload_digest',
]);
const CONCEPT_KEYS = Object.freeze([
  'domain_key',
  'topic_key',
  'pattern_key',
  'predicate_key',
  'predicate_version',
  'label',
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
]);
const DISPOSITION_KEYS = Object.freeze([
  'domain_key',
  'topic_key',
  'pattern_key',
  'predicate_key',
  'predicate_version',
  'decision',
  'mapping_keys',
  'certification_identity',
  'exclusion_reason_code',
  'exclusion_evidence_identity',
]);
const RELEASE_ADMISSION_KEYS = Object.freeze([
  'schema_version',
  'registry_version',
  'approved_pm_data_version_id',
  'candidate_release_manifest_id',
  'candidate_release_manifest_payload_digest',
  'navigation_catalogue_identity',
  'registry_compiler_identity',
  'entries',
  'pattern_dispositions',
  'certification',
  'previous_registry_identity',
]);
const CERTIFICATION_KEYS = Object.freeze([
  'independent_enumeration_identity',
  'mapping_reconciliation_identity',
  'query_goldens_identity',
  'utterance_suite_identity',
]);
const PREVIOUS_REGISTRY_IDENTITY_KEYS = Object.freeze([
  'manifest_id',
  'payload_digest',
  'registry_version',
]);
const MANIFEST_MAPPING_KEYS = Object.freeze([
  ...MAPPING_KEYS,
  'mapping_definition_id',
]);
const BASIS_KEYS = Object.freeze([
  'navigation_catalogue_identity',
  'registry_compiler_identity',
  'certification',
  'previous_registry_identity',
]);
const DIFFERENCE_KEYS = Object.freeze([
  'previous_manifest_id',
  'added_mapping_keys',
  'removed_mapping_keys',
  'changed_mapping_keys',
  'unchanged_mapping_keys',
]);
const COUNTS_KEYS = Object.freeze([
  'navigation_pattern_count',
  'covered_pattern_count',
  'excluded_pattern_count',
  'mapping_count',
  'compiled_mapping_count',
  'boundary_mapping_count',
]);
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

class ProductAskMappingRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductAskMappingRegistryError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductAskMappingRegistryError(code, message, details);
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed schema.`, {
      actual,
      expected: required,
    });
  }
}

function requireText(value, label, code) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireNullableText(value, label, code) {
  if (value !== null) requireText(value, label, code);
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

function requireNullablePositiveInteger(value, label, code) {
  if (value !== null) requirePositiveInteger(value, label, code);
}

function requireNonNegativeInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(code, `${label} must be a non-negative safe integer.`);
  }
  return value;
}

function requireArray(value, label, code, maximum) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  if (maximum !== undefined && value.length > maximum) {
    fail(code, `${label} exceeds the fixed collection bound.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_ASK_MAPPING_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Ask mapping input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireSortedUnique(values, label, identity, code) {
  const identities = values.map(identity);
  if (new Set(identities).size !== identities.length) {
    fail(code, `${label} contains a duplicate.`);
  }
  if (
    canonicalJson([...identities].sort(compareText))
      !== canonicalJson(identities)
  ) {
    fail(code, `${label} must use canonical order.`);
  }
}

function validateIdentity(value, label, code) {
  requireExactKeys(value, IDENTITY_KEYS, label, code);
  requireText(value.stable_id, `${label} stable_id`, code);
  requirePositiveInteger(value.version, `${label} version`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  return value;
}

function normalizeProductAskPhrase(value) {
  requireText(value, 'Ask phrase', 'INVALID_PRODUCT_ASK_MAPPING_INPUT');
  const normalized = value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .replace(/[?.!]+$/u, '')
    .trim();
  if (!normalized) {
    fail(
      'INVALID_PRODUCT_ASK_MAPPING_INPUT',
      'Ask phrase is empty after normalisation.',
    );
  }
  return normalized;
}

function productAskMappingRegistryPayloadDigest(manifest) {
  requireObject(
    manifest,
    'Product Ask mapping registry manifest',
    'INVALID_PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST',
  );
  const body = { ...manifest };
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  return contentId(PRODUCT_ASK_MAPPING_REGISTRY_PAYLOAD_DOMAIN, body);
}

function flattenNavigationPatterns(navigationManifest) {
  validateProductNavigationCatalogueManifest(navigationManifest);
  return navigationManifest.navigation_definition.domains.flatMap((domain) => (
    domain.topics.flatMap((topic) => (
      topic.patterns.map((pattern) => ({
        domain_key: domain.domain_key,
        domain_label: domain.label,
        topic_key: topic.topic_key,
        topic_label: topic.label,
        pattern_key: pattern.pattern_key,
        pattern_label: pattern.label,
        predicate_key: pattern.predicate_key,
        predicate_version: pattern.predicate_version,
      }))
    ))
  ));
}

function patternIdentity(value) {
  return [
    value.domain_key,
    value.topic_key,
    value.pattern_key,
  ].join('\0');
}

function predicateIdentity(value) {
  return [
    value.domain_key,
    value.predicate_key,
    value.predicate_version,
  ].join('\0');
}

function conceptFromPattern(pattern) {
  return {
    domain_key: pattern.domain_key,
    topic_key: pattern.topic_key,
    pattern_key: pattern.pattern_key,
    predicate_key: pattern.predicate_key,
    predicate_version: pattern.predicate_version,
    label: pattern.pattern_label,
  };
}

function validateConcept(value, label, patternByIdentity, code) {
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
  const pattern = patternByIdentity.get(patternIdentity(value));
  if (
    !pattern
    || pattern.predicate_key !== value.predicate_key
    || pattern.predicate_version !== value.predicate_version
    || pattern.pattern_label !== value.label
  ) {
    fail(code, `${label} does not identify an admitted navigation Pattern.`);
  }
  return value;
}

function validateConceptList(values, label, patternByIdentity, code) {
  requireArray(values, label, code, MAX_ALTERNATIVES).forEach(
    (value, index) => validateConcept(
      value,
      `${label} ${index}`,
      patternByIdentity,
      code,
    ),
  );
  requireSortedUnique(
    values,
    label,
    (value) => patternIdentity(value),
    code,
  );
}

function validateMappingEntry(entry, index, patternByIdentity, code) {
  const label = `Ask mapping entry ${index}`;
  requireExactKeys(entry, MAPPING_KEYS, label, code);
  requireText(entry.mapping_key, `${label} mapping_key`, code);
  requireText(entry.phrase, `${label} phrase`, code);
  requireText(entry.normalized_phrase, `${label} normalized_phrase`, code);
  if (
    Buffer.byteLength(entry.phrase, 'utf8') > MAX_PHRASE_UTF8_BYTES
    || Buffer.byteLength(entry.normalized_phrase, 'utf8')
      > MAX_PHRASE_UTF8_BYTES
  ) {
    fail(code, `${label} exceeds the fixed phrase bound.`);
  }
  if (entry.normalized_phrase !== normalizeProductAskPhrase(entry.phrase)) {
    fail(code, `${label} normalized_phrase is not derived by the normaliser.`);
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
  for (const key of [
    'domain_key',
    'topic_key',
    'pattern_key',
    'predicate_key',
    'concept_label',
  ]) {
    requireNullableText(entry[key], `${label} ${key}`, code);
  }
  requireNullablePositiveInteger(
    entry.predicate_version,
    `${label} predicate_version`,
    code,
  );
  validateConceptList(
    entry.choices,
    `${label} choices`,
    patternByIdentity,
    code,
  );
  validateConceptList(
    entry.nearest_supported_concepts,
    `${label} nearest_supported_concepts`,
    patternByIdentity,
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
    const concept = {
      domain_key: entry.domain_key,
      topic_key: entry.topic_key,
      pattern_key: entry.pattern_key,
      predicate_key: entry.predicate_key,
      predicate_version: entry.predicate_version,
      label: entry.concept_label,
    };
    validateConcept(concept, `${label} compiled concept`, patternByIdentity, code);
    if (
      entry.choices.length !== 0
      || entry.nearest_supported_concepts.length !== 0
    ) {
      fail(code, `${label} compiled mapping cannot carry refusal alternatives.`);
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
        fail(code, `${label} refusal cannot carry an executable concept.`);
      }
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
      fail(code, `${label} typed refusal requires a nearby concept.`);
    }
  }
  return entry;
}

function validateMappingEntries(entries, patternByIdentity, code) {
  requireArray(entries, 'Ask mapping entries', code, MAX_MAPPING_ENTRIES);
  if (entries.length === 0) {
    fail(code, 'The Ask mapping registry cannot be empty.');
  }
  entries.forEach((entry, index) => validateMappingEntry(
    entry,
    index,
    patternByIdentity,
    code,
  ));
  requireSortedUnique(
    entries,
    'Ask mapping entries',
    (entry) => entry.mapping_key,
    code,
  );
  const normalizedPhrases = entries.map((entry) => entry.normalized_phrase);
  if (new Set(normalizedPhrases).size !== normalizedPhrases.length) {
    fail(
      code,
      'A normalized Ask phrase has more than one legal meaning.',
    );
  }
  const observedClasses = new Set(entries.map((entry) => entry.phrase_class));
  for (const phraseClass of [
    ...POSITIVE_PHRASE_CLASSES,
    ...BOUNDARY_PHRASE_CLASSES,
  ]) {
    if (!observedClasses.has(phraseClass)) {
      fail(code, `The registry has no ${phraseClass} example.`);
    }
  }
  return entries;
}

function validateCertification(value, label, code) {
  requireExactKeys(value, CERTIFICATION_KEYS, label, code);
  Object.entries(value).forEach(([key, identity]) => validateIdentity(
    identity,
    `${label} ${key}`,
    code,
  ));
  return value;
}

function validateNavigationIdentity(value, navigationManifest, label, code) {
  requireExactKeys(value, NAVIGATION_IDENTITY_KEYS, label, code);
  requireDigest(value.manifest_id, `${label} manifest_id`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  const expected = {
    manifest_id: navigationManifest.manifest_id,
    payload_digest:
      navigationDefinitionPayloadDigest(
        navigationManifest.navigation_definition,
      ),
  };
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the Product navigation catalogue.`);
  }
  return value;
}

function validatePatternDisposition(
  disposition,
  index,
  patternByIdentity,
  mappingByKey,
  code,
) {
  const label = `Ask Pattern disposition ${index}`;
  requireExactKeys(disposition, DISPOSITION_KEYS, label, code);
  for (const key of [
    'domain_key',
    'topic_key',
    'pattern_key',
    'predicate_key',
  ]) {
    requireText(disposition[key], `${label} ${key}`, code);
  }
  requirePositiveInteger(
    disposition.predicate_version,
    `${label} predicate_version`,
    code,
  );
  const pattern = patternByIdentity.get(patternIdentity(disposition));
  if (
    !pattern
    || pattern.predicate_key !== disposition.predicate_key
    || pattern.predicate_version !== disposition.predicate_version
  ) {
    fail(code, `${label} does not identify an admitted navigation Pattern.`);
  }
  if (!['INCLUDE', 'EXCLUDE'].includes(disposition.decision)) {
    fail(code, `${label} decision is not registered.`);
  }
  requireArray(
    disposition.mapping_keys,
    `${label} mapping_keys`,
    code,
    MAX_MAPPING_ENTRIES,
  ).forEach((mappingKey, mappingIndex) => requireText(
    mappingKey,
    `${label} mapping key ${mappingIndex}`,
    code,
  ));
  requireSortedUnique(
    disposition.mapping_keys,
    `${label} mapping_keys`,
    String,
    code,
  );

  if (disposition.decision === 'INCLUDE') {
    validateIdentity(
      disposition.certification_identity,
      `${label} certification_identity`,
      code,
    );
    if (
      disposition.exclusion_reason_code !== null
      || disposition.exclusion_evidence_identity !== null
    ) {
      fail(code, `${label} included Pattern cannot carry exclusion evidence.`);
    }
    if (disposition.mapping_keys.length === 0) {
      fail(code, `${label} included Pattern has no checked phrase.`);
    }
    const mappings = disposition.mapping_keys.map((mappingKey) => {
      const mapping = mappingByKey.get(mappingKey);
      if (
        !mapping
        || mapping.outcome !== 'COMPILED'
        || patternIdentity(mapping) !== patternIdentity(disposition)
        || predicateIdentity(mapping) !== predicateIdentity(disposition)
      ) {
        fail(code, `${label} mapping does not compile to this Pattern.`, {
          mapping_key: mappingKey,
        });
      }
      return mapping;
    });
    const classes = new Set(mappings.map((mapping) => mapping.phrase_class));
    for (const requiredClass of REQUIRED_PATTERN_PHRASE_CLASSES) {
      if (!classes.has(requiredClass)) {
        fail(code, `${label} has no ${requiredClass} coverage.`);
      }
    }
  } else {
    if (disposition.mapping_keys.length !== 0) {
      fail(code, `${label} excluded Pattern cannot carry mappings.`);
    }
    if (disposition.certification_identity !== null) {
      fail(code, `${label} excluded Pattern cannot carry certification.`);
    }
    requireText(
      disposition.exclusion_reason_code,
      `${label} exclusion_reason_code`,
      code,
    );
    validateIdentity(
      disposition.exclusion_evidence_identity,
      `${label} exclusion_evidence_identity`,
      code,
    );
  }
  return disposition;
}

function validatePatternDispositions(
  dispositions,
  patterns,
  mappingByKey,
  code,
) {
  requireArray(dispositions, 'Ask Pattern dispositions', code, MAX_PATTERNS);
  const patternByIdentity = new Map(patterns.map((pattern) => [
    patternIdentity(pattern),
    pattern,
  ]));
  dispositions.forEach((disposition, index) => validatePatternDisposition(
    disposition,
    index,
    patternByIdentity,
    mappingByKey,
    code,
  ));
  requireSortedUnique(
    dispositions,
    'Ask Pattern dispositions',
    patternIdentity,
    code,
  );
  if (dispositions.length !== patterns.length) {
    fail(code, 'Ask Pattern dispositions do not enumerate every Browse Pattern.');
  }
  const dispositionIds = new Set(dispositions.map(patternIdentity));
  for (const pattern of patterns) {
    if (!dispositionIds.has(patternIdentity(pattern))) {
      fail(code, 'A Browse Pattern has no Ask coverage decision.', {
        pattern_identity: patternIdentity(pattern),
      });
    }
  }
  const referencedMappings = dispositions.flatMap(
    (disposition) => disposition.mapping_keys,
  );
  if (new Set(referencedMappings).size !== referencedMappings.length) {
    fail(code, 'One compiled Ask mapping covers more than one Pattern.');
  }
  const compiledKeys = [...mappingByKey.values()]
    .filter((mapping) => mapping.outcome === 'COMPILED')
    .map((mapping) => mapping.mapping_key)
    .sort(compareText);
  if (
    canonicalJson([...referencedMappings].sort(compareText))
      !== canonicalJson(compiledKeys)
  ) {
    fail(
      code,
      'Compiled Ask mappings and Pattern coverage do not reconcile exactly.',
    );
  }
  for (const domainKey of REQUIRED_INITIAL_DOMAIN_KEYS) {
    if (!dispositions.some(
      (disposition) => (
        disposition.domain_key === domainKey
        && disposition.decision === 'INCLUDE'
      ),
    )) {
      fail(code, `The first Ask registry has no covered ${domainKey} Pattern.`);
    }
  }
  return dispositions;
}

function validatePreviousRegistryIdentity(value, label, code) {
  requireExactKeys(value, PREVIOUS_REGISTRY_IDENTITY_KEYS, label, code);
  requireDigest(value.manifest_id, `${label} manifest_id`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  requirePositiveInteger(value.registry_version, `${label} registry_version`, code);
  return value;
}

function validateReleaseAdmission({
  releaseAdmission,
  navigationManifest,
  previousManifest,
}) {
  const code = 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION';
  requireExactKeys(
    releaseAdmission,
    RELEASE_ADMISSION_KEYS,
    'Product Ask mapping release admission',
    code,
  );
  if (
    releaseAdmission.schema_version
      !== PRODUCT_ASK_MAPPING_RELEASE_ADMISSION_SCHEMA
  ) {
    fail(code, 'The Product Ask mapping release admission schema is not supported.');
  }
  requirePositiveInteger(
    releaseAdmission.registry_version,
    'Product Ask mapping release admission registry_version',
    code,
  );
  requireDigest(
    releaseAdmission.approved_pm_data_version_id,
    'Product Ask mapping release admission approved_pm_data_version_id',
    code,
  );
  if (
    releaseAdmission.approved_pm_data_version_id
      !== navigationManifest.approved_pm_data_version_id
  ) {
    fail(code, 'The Ask registry and navigation catalogue use different PM data versions.');
  }
  requireDigest(
    releaseAdmission.candidate_release_manifest_id,
    'Product Ask mapping release admission candidate_release_manifest_id',
    code,
  );
  requireDigest(
    releaseAdmission.candidate_release_manifest_payload_digest,
    'Product Ask mapping release admission candidate release payload digest',
    code,
  );
  if (
    releaseAdmission.candidate_release_manifest_id
      !== navigationManifest.candidate_release_manifest_id
    || releaseAdmission.candidate_release_manifest_payload_digest
      !== navigationManifest.candidate_release_manifest_payload_digest
  ) {
    fail(code, 'The Ask registry and navigation catalogue use different candidate releases.');
  }
  validateNavigationIdentity(
    releaseAdmission.navigation_catalogue_identity,
    navigationManifest,
    'Product Ask mapping release navigation_catalogue_identity',
    code,
  );
  validateIdentity(
    releaseAdmission.registry_compiler_identity,
    'Product Ask mapping release registry_compiler_identity',
    code,
  );
  validateCertification(
    releaseAdmission.certification,
    'Product Ask mapping release certification',
    code,
  );

  const patterns = flattenNavigationPatterns(navigationManifest);
  const patternByIdentity = new Map(patterns.map((pattern) => [
    patternIdentity(pattern),
    pattern,
  ]));
  const entries = validateMappingEntries(
    releaseAdmission.entries,
    patternByIdentity,
    code,
  );
  const mappingByKey = new Map(entries.map((entry) => [
    entry.mapping_key,
    entry,
  ]));
  const dispositions = validatePatternDispositions(
    releaseAdmission.pattern_dispositions,
    patterns,
    mappingByKey,
    code,
  );

  if (previousManifest === null) {
    if (releaseAdmission.previous_registry_identity !== null) {
      fail(code, 'A previous Ask registry identity has no supplied manifest.');
    }
  } else {
    validateManifestIntegrity(previousManifest);
    validatePreviousRegistryIdentity(
      releaseAdmission.previous_registry_identity,
      'Product Ask mapping release previous_registry_identity',
      code,
    );
    const expectedPrevious = {
      manifest_id: previousManifest.manifest_id,
      payload_digest: previousManifest.canonical_payload_digest,
      registry_version: previousManifest.registry_version,
    };
    if (
      canonicalJson(releaseAdmission.previous_registry_identity)
        !== canonicalJson(expectedPrevious)
    ) {
      fail(code, 'The previous Ask registry does not match its release admission.');
    }
    if (
      releaseAdmission.registry_version
        < previousManifest.registry_version
    ) {
      fail(code, 'The Ask registry version cannot decrease.');
    }
    const changed = (
      canonicalJson(releaseAdmission.entries)
        !== canonicalJson(previousManifest.entries.map(
          ({ mapping_definition_id: ignored, ...entry }) => entry,
        ))
      || canonicalJson(releaseAdmission.pattern_dispositions)
        !== canonicalJson([
          ...previousManifest.pattern_coverage,
          ...previousManifest.pattern_exclusions,
        ].sort((left, right) => compareText(
          patternIdentity(left),
          patternIdentity(right),
        )))
      || canonicalJson(releaseAdmission.navigation_catalogue_identity)
        !== canonicalJson(previousManifest.basis.navigation_catalogue_identity)
    );
    if (
      changed
      && releaseAdmission.registry_version
        <= previousManifest.registry_version
    ) {
      fail(
        code,
        'Ask mapping meaning changed without a registry version increase.',
      );
    }
  }

  return {
    entries,
    dispositions,
    patterns,
  };
}

function mappingDefinitionId(entry) {
  return contentId(PRODUCT_ASK_MAPPING_DEFINITION_DOMAIN, entry);
}

function compileManifestEntries(entries) {
  return entries.map((entry) => ({
    ...clone(entry),
    mapping_definition_id: mappingDefinitionId(entry),
  }));
}

function compileDifference(previousManifest, entries) {
  const currentByKey = new Map(entries.map((entry) => [
    entry.mapping_key,
    entry,
  ]));
  const previousEntries = previousManifest?.entries || [];
  const previousByKey = new Map(previousEntries.map((entry) => [
    entry.mapping_key,
    entry,
  ]));
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const entry of entries) {
    const previous = previousByKey.get(entry.mapping_key);
    if (!previous) {
      added.push(entry.mapping_key);
    } else if (previous.mapping_definition_id === entry.mapping_definition_id) {
      unchanged.push(entry.mapping_key);
    } else {
      changed.push(entry.mapping_key);
    }
  }
  for (const entry of previousEntries) {
    if (!currentByKey.has(entry.mapping_key)) {
      removed.push(entry.mapping_key);
    }
  }
  return {
    previous_manifest_id: previousManifest?.manifest_id || null,
    added_mapping_keys: added.sort(compareText),
    removed_mapping_keys: removed.sort(compareText),
    changed_mapping_keys: changed.sort(compareText),
    unchanged_mapping_keys: unchanged.sort(compareText),
  };
}

function compileCounts(patterns, dispositions, entries) {
  const covered = dispositions.filter(
    (disposition) => disposition.decision === 'INCLUDE',
  );
  const excluded = dispositions.filter(
    (disposition) => disposition.decision === 'EXCLUDE',
  );
  const compiled = entries.filter((entry) => entry.outcome === 'COMPILED');
  return {
    navigation_pattern_count: patterns.length,
    covered_pattern_count: covered.length,
    excluded_pattern_count: excluded.length,
    mapping_count: entries.length,
    compiled_mapping_count: compiled.length,
    boundary_mapping_count: entries.length - compiled.length,
  };
}

function validateDifference(value, previousManifest, entries, code) {
  requireExactKeys(value, DIFFERENCE_KEYS, 'Ask registry difference', code);
  if (value.previous_manifest_id === null) {
    if (previousManifest !== null) {
      fail(code, 'Ask registry difference omits the supplied previous manifest.');
    }
  } else {
    requireDigest(
      value.previous_manifest_id,
      'Ask registry difference previous_manifest_id',
      code,
    );
    if (
      previousManifest === null
      || value.previous_manifest_id !== previousManifest.manifest_id
    ) {
      fail(code, 'Ask registry difference identifies the wrong previous manifest.');
    }
  }
  for (const key of DIFFERENCE_KEYS.slice(1)) {
    requireArray(value[key], `Ask registry difference ${key}`, code)
      .forEach((mappingKey, index) => requireText(
        mappingKey,
        `Ask registry difference ${key} ${index}`,
        code,
      ));
    requireSortedUnique(
      value[key],
      `Ask registry difference ${key}`,
      String,
      code,
    );
  }
  const expected = compileDifference(previousManifest, entries);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, 'Ask registry difference does not match the supplied registries.');
  }
}

function validateCounts(value, patterns, dispositions, entries, code) {
  requireExactKeys(value, COUNTS_KEYS, 'Ask registry counts', code);
  for (const key of COUNTS_KEYS) {
    requireNonNegativeInteger(value[key], `Ask registry counts ${key}`, code);
  }
  const expected = compileCounts(patterns, dispositions, entries);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, 'Ask registry counts do not reconcile.');
  }
}

function validateManifestIntegrity(manifest) {
  const code = 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST';
  requireExactKeys(
    manifest,
    MANIFEST_KEYS,
    'Product Ask mapping registry manifest',
    code,
  );
  if (manifest.schema_version !== PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA) {
    fail(code, 'The Product Ask mapping registry schema is not supported.');
  }
  if (manifest.stable_id !== PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID) {
    fail(code, 'The Product Ask mapping registry stable_id is not supported.');
  }
  requirePositiveInteger(
    manifest.registry_version,
    'Product Ask mapping registry registry_version',
    code,
  );
  requireDigest(
    manifest.approved_pm_data_version_id,
    'Product Ask mapping registry approved_pm_data_version_id',
    code,
  );
  requireDigest(
    manifest.candidate_release_manifest_id,
    'Product Ask mapping registry candidate_release_manifest_id',
    code,
  );
  requireDigest(
    manifest.candidate_release_manifest_payload_digest,
    'Product Ask mapping registry candidate release payload digest',
    code,
  );
  requireExactKeys(manifest.basis, BASIS_KEYS, 'Ask registry basis', code);
  requireExactKeys(
    manifest.basis.navigation_catalogue_identity,
    NAVIGATION_IDENTITY_KEYS,
    'Ask registry basis navigation_catalogue_identity',
    code,
  );
  requireDigest(
    manifest.basis.navigation_catalogue_identity.manifest_id,
    'Ask registry basis navigation manifest_id',
    code,
  );
  requireDigest(
    manifest.basis.navigation_catalogue_identity.payload_digest,
    'Ask registry basis navigation payload_digest',
    code,
  );
  validateIdentity(
    manifest.basis.registry_compiler_identity,
    'Ask registry basis registry_compiler_identity',
    code,
  );
  validateCertification(
    manifest.basis.certification,
    'Ask registry basis certification',
    code,
  );
  if (manifest.basis.previous_registry_identity !== null) {
    validatePreviousRegistryIdentity(
      manifest.basis.previous_registry_identity,
      'Ask registry basis previous_registry_identity',
      code,
    );
  }
  requireArray(
    manifest.entries,
    'Product Ask mapping registry entries',
    code,
    MAX_MAPPING_ENTRIES,
  ).forEach((entry, index) => {
    requireExactKeys(entry, MANIFEST_MAPPING_KEYS, `Manifest mapping ${index}`, code);
    requireDigest(
      entry.mapping_definition_id,
      `Manifest mapping ${index} mapping_definition_id`,
      code,
    );
    const { mapping_definition_id: suppliedId, ...definition } = entry;
    const expectedId = mappingDefinitionId(definition);
    if (suppliedId !== expectedId) {
      fail(code, `Manifest mapping ${index} definition id does not match.`);
    }
  });
  requireDigest(manifest.manifest_id, 'Ask registry manifest_id', code);
  requireDigest(
    manifest.canonical_payload_digest,
    'Ask registry canonical_payload_digest',
    code,
  );
  const body = { ...manifest };
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  const expectedManifestId = contentId(
    PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    body,
  );
  if (manifest.manifest_id !== expectedManifestId) {
    fail(code, 'The Ask registry manifest_id does not match its content.');
  }
  const expectedPayloadDigest =
    productAskMappingRegistryPayloadDigest(manifest);
  if (manifest.canonical_payload_digest !== expectedPayloadDigest) {
    fail(code, 'The Ask registry payload digest does not match its content.');
  }
  return manifest;
}

function validateProductAskMappingRegistryManifest(
  manifest,
  {
    navigation_catalogue_manifest: navigationManifest,
    release_admission: releaseAdmission,
    previous_manifest: previousManifest = null,
  },
) {
  const code = 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST';
  validateManifestIntegrity(manifest);
  validateProductNavigationCatalogueManifest(navigationManifest);
  const release = validateReleaseAdmission({
    releaseAdmission,
    navigationManifest,
    previousManifest,
  });
  if (manifest.registry_version !== releaseAdmission.registry_version) {
    fail(code, 'The Ask registry version does not match its release admission.');
  }
  for (const key of [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ]) {
    if (manifest[key] !== releaseAdmission[key]) {
      fail(code, `The Ask registry ${key} does not match its release admission.`);
    }
  }
  const expectedBasis = {
    navigation_catalogue_identity:
      clone(releaseAdmission.navigation_catalogue_identity, code),
    registry_compiler_identity:
      clone(releaseAdmission.registry_compiler_identity, code),
    certification: clone(releaseAdmission.certification, code),
    previous_registry_identity:
      clone(releaseAdmission.previous_registry_identity, code),
  };
  if (canonicalJson(manifest.basis) !== canonicalJson(expectedBasis)) {
    fail(code, 'The Ask registry basis does not match its release admission.');
  }
  const manifestDefinitions = manifest.entries.map(
    ({ mapping_definition_id: ignored, ...entry }) => entry,
  );
  if (
    canonicalJson(manifestDefinitions)
      !== canonicalJson(releaseAdmission.entries)
  ) {
    fail(code, 'The Ask registry entries do not match their checked release admission.');
  }
  const expectedCoverage = release.dispositions.filter(
    (disposition) => disposition.decision === 'INCLUDE',
  );
  const expectedExclusions = release.dispositions.filter(
    (disposition) => disposition.decision === 'EXCLUDE',
  );
  if (
    canonicalJson(manifest.pattern_coverage)
      !== canonicalJson(expectedCoverage)
    || canonicalJson(manifest.pattern_exclusions)
      !== canonicalJson(expectedExclusions)
  ) {
    fail(code, 'Ask Pattern coverage does not match its checked release admission.');
  }
  const patternByIdentity = new Map(release.patterns.map((pattern) => [
    patternIdentity(pattern),
    pattern,
  ]));
  validateMappingEntries(manifestDefinitions, patternByIdentity, code);
  const mappingByKey = new Map(manifestDefinitions.map((entry) => [
    entry.mapping_key,
    entry,
  ]));
  const dispositions = [
    ...manifest.pattern_coverage,
    ...manifest.pattern_exclusions,
  ].sort((left, right) => compareText(
    patternIdentity(left),
    patternIdentity(right),
  ));
  validatePatternDispositions(
    dispositions,
    release.patterns,
    mappingByKey,
    code,
  );
  validateDifference(
    manifest.difference,
    previousManifest,
    manifest.entries,
    code,
  );
  validateCounts(
    manifest.counts,
    release.patterns,
    dispositions,
    manifestDefinitions,
    code,
  );
  return manifest;
}

function buildProductAskMappingRegistryManifest({
  navigation_catalogue_manifest: navigationManifest,
  release_admission: releaseAdmission,
  previous_manifest: previousManifest = null,
}) {
  validateProductNavigationCatalogueManifest(navigationManifest);
  const release = validateReleaseAdmission({
    releaseAdmission,
    navigationManifest,
    previousManifest,
  });
  const entries = compileManifestEntries(release.entries);
  const basis = {
    navigation_catalogue_identity:
      clone(releaseAdmission.navigation_catalogue_identity),
    registry_compiler_identity:
      clone(releaseAdmission.registry_compiler_identity),
    certification: clone(releaseAdmission.certification),
    previous_registry_identity:
      clone(releaseAdmission.previous_registry_identity),
  };
  const patternCoverage = release.dispositions
    .filter((disposition) => disposition.decision === 'INCLUDE')
    .map((disposition) => clone(disposition));
  const patternExclusions = release.dispositions
    .filter((disposition) => disposition.decision === 'EXCLUDE')
    .map((disposition) => clone(disposition));
  const manifestBody = {
    schema_version: PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    stable_id: PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID,
    registry_version: releaseAdmission.registry_version,
    approved_pm_data_version_id:
      releaseAdmission.approved_pm_data_version_id,
    candidate_release_manifest_id:
      releaseAdmission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      releaseAdmission.candidate_release_manifest_payload_digest,
    basis,
    entries,
    pattern_coverage: patternCoverage,
    pattern_exclusions: patternExclusions,
    difference: compileDifference(previousManifest, entries),
    counts: compileCounts(
      release.patterns,
      release.dispositions,
      release.entries,
    ),
  };
  const manifest = {
    ...manifestBody,
    manifest_id: contentId(
      PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      PRODUCT_ASK_MAPPING_REGISTRY_PAYLOAD_DOMAIN,
      manifestBody,
    ),
  };
  validateProductAskMappingRegistryManifest(manifest, {
    navigation_catalogue_manifest: navigationManifest,
    release_admission: releaseAdmission,
    previous_manifest: previousManifest,
  });
  return deepFreeze(clone(manifest));
}

function productAskMappingRegistryAdmission(
  manifest,
  validationContext,
) {
  validateProductAskMappingRegistryManifest(manifest, validationContext);
  return deepFreeze({
    stable_id: PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID,
    registry_version: manifest.registry_version,
    manifest_id: manifest.manifest_id,
    payload_digest: manifest.canonical_payload_digest,
    navigation_catalogue_identity:
      clone(manifest.basis.navigation_catalogue_identity),
  });
}

module.exports = {
  BOUNDARY_PHRASE_CLASSES,
  OUTCOMES,
  POSITIVE_PHRASE_CLASSES,
  PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
  PRODUCT_ASK_MAPPING_REGISTRY_STABLE_ID,
  PRODUCT_ASK_MAPPING_RELEASE_ADMISSION_SCHEMA,
  ProductAskMappingRegistryError,
  buildProductAskMappingRegistryManifest,
  normalizeProductAskPhrase,
  productAskMappingRegistryAdmission,
  productAskMappingRegistryPayloadDigest,
  validateProductAskMappingRegistryManifest,
};
