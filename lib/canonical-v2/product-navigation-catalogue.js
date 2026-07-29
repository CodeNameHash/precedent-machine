const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA =
  'PRODUCT_NAVIGATION_CATALOGUE_MANIFEST/V1';
const PRODUCT_NAVIGATION_RELEASE_ADMISSION_SCHEMA =
  'PRODUCT_NAVIGATION_RELEASE_ADMISSION/V1';
const PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID =
  'PRODUCT_NAVIGATION_CATALOGUE';
const PRODUCT_NAVIGATION_CATALOGUE_PAYLOAD_DOMAIN =
  'PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_PAYLOAD/V1';
const PRODUCT_NAVIGATION_PATTERN_DEFINITION_DOMAIN =
  'PRODUCT_NAVIGATION_PATTERN_DEFINITION/V1';
const REQUIRED_INITIAL_DOMAIN_KEYS = Object.freeze([
  'AGREEMENT',
  'PROCESS',
]);
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_SOURCE_CATALOGUES = 64;
const MAX_DOMAINS = 64;
const MAX_TOPICS = 1024;
const MAX_PATTERNS = 8192;
const SOURCE_CATALOGUE_KEYS = Object.freeze([
  'object_kind',
  'stable_id',
  'schema_version',
  'definition',
]);
const SOURCE_DEFINITION_KEYS = Object.freeze([
  'catalogue_version',
  'pm_wide_catalogue_binding',
  'hierarchy_contract',
  'domains',
  'admission_contract',
  'authority_contract',
]);
const HIERARCHY_KEYS = Object.freeze([
  'levels',
  'maximum_depth',
  'selected_topic_controls_pattern_membership',
  'all_is_catalogue_navigation_not_union_query',
  'remaining_distinctions_are_fields_or_predicates',
  'display_only_entry_permitted',
]);
const DOMAIN_KEYS = Object.freeze([
  'domain_key',
  'label',
  'domain_registry_stable_id',
  'topics',
]);
const TOPIC_KEYS = Object.freeze([
  'topic_key',
  'label',
  'predicate_catalogue_stable_id',
  'patterns',
]);
const PATTERN_KEYS = Object.freeze([
  'pattern_key',
  'label',
  'predicate_key',
  'predicate_version',
  'predicate_shape',
]);
const SOURCE_ADMISSION_KEYS = Object.freeze([
  'source_stable_id',
  'source_schema_version',
  'source_catalogue_version',
  'source_payload_digest',
  'source_domain_count',
  'source_topic_count',
  'source_pattern_count',
]);
const PATTERN_DISPOSITION_KEYS = Object.freeze([
  'source_stable_id',
  'domain_key',
  'topic_key',
  'pattern_key',
  'predicate_key',
  'predicate_version',
  'decision',
  'certification_identity',
  'exclusion_reason_code',
  'exclusion_evidence_identity',
]);
const IDENTITY_KEYS = Object.freeze([
  'stable_id',
  'version',
  'payload_digest',
]);
const AUTHORITY_KEYS = Object.freeze([
  'creates_runtime_navigation',
  'creates_query_authority',
  'creates_extraction_authority',
  'creates_writer_authority',
  'creates_serving_authority',
  'creates_release_authority',
  'creates_contract_freeze_authority',
]);
const SOURCE_BINDING_KEYS = Object.freeze([
  'source_stable_id',
  'source_schema_version',
  'source_catalogue_version',
  'source_payload_digest',
  'source_domain_count',
  'source_topic_count',
  'source_pattern_count',
]);
const CERTIFICATION_KEYS = Object.freeze([
  'source_stable_id',
  'domain_key',
  'topic_key',
  'pattern_key',
  'predicate_key',
  'predicate_version',
  'certification_identity',
]);
const EXCLUSION_KEYS = Object.freeze([
  'source_stable_id',
  'domain_key',
  'topic_key',
  'pattern_key',
  'label',
  'predicate_key',
  'predicate_version',
  'reason_code',
  'evidence_identity',
]);
const DIFFERENCE_KEYS = Object.freeze([
  'previous_manifest_id',
  'added_pattern_definition_ids',
  'removed_pattern_definition_ids',
  'changed_patterns',
  'unchanged_pattern_definition_ids',
]);
const MANIFEST_KEYS = Object.freeze([
  'schema_version',
  'stable_id',
  'manifest_version',
  'approved_pm_data_version_id',
  'candidate_release_manifest_id',
  'candidate_release_manifest_payload_digest',
  'basis',
  'navigation_definition',
  'pattern_certifications',
  'source_exclusions',
  'difference',
  'counts',
  'manifest_id',
  'canonical_payload_digest',
]);

class ProductNavigationCatalogueError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductNavigationCatalogueError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductNavigationCatalogueError(code, message, details);
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

function requireNonNegativeInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(code, `${label} must be a non-negative safe integer.`);
  }
  return value;
}

function requireBoolean(value, label, code) {
  if (typeof value !== 'boolean') {
    fail(code, `${label} must be Boolean.`);
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

function clone(value, code = 'INVALID_PRODUCT_NAVIGATION_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The navigation catalogue input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareBy(selector) {
  return (left, right) => compareText(selector(left), selector(right));
}

function requireUnique(values, label, selector, code) {
  const seen = new Set();
  for (const value of values) {
    const key = selector(value);
    if (seen.has(key)) {
      fail(code, `${label} contains a duplicate.`, {
        duplicate_identity: key,
      });
    }
    seen.add(key);
  }
}

function requireSorted(values, label, selector, code) {
  const sorted = [...values].sort(compareBy(selector));
  if (canonicalJson(values) !== canonicalJson(sorted)) {
    fail(code, `${label} is not in canonical order.`);
  }
}

function validateTextSet(
  value,
  label,
  code,
  {
    allowEmpty = false,
    maximum = MAX_PATTERNS,
  } = {},
) {
  const values = requireArray(value, label, code, maximum);
  if (!allowEmpty && values.length === 0) {
    fail(code, `${label} cannot be empty.`);
  }
  values.forEach((entry, index) => requireText(
    entry,
    `${label}[${index}]`,
    code,
  ));
  requireUnique(values, label, String, code);
  return values;
}

function validateIdentity(value, label, code) {
  requireExactKeys(value, IDENTITY_KEYS, label, code);
  requireText(value.stable_id, `${label} stable_id`, code);
  requirePositiveInteger(value.version, `${label} version`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  return value;
}

function sourceCatalogueIdentity(sourceCatalogue) {
  return `${sourceCatalogue.stable_id}\0${sourceCatalogue.schema_version}`;
}

function sourceAdmissionIdentity(admission) {
  return `${admission.source_stable_id}\0${admission.source_schema_version}`;
}

function sourcePatternIdentity(value) {
  return [
    value.source_stable_id,
    value.domain_key,
    value.topic_key,
    value.pattern_key,
  ].join('\0');
}

function productPatternIdentity(value) {
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

function sourceNavigationCataloguePayloadDigest(sourceCatalogue) {
  requireObject(
    sourceCatalogue,
    'Source navigation catalogue',
    'INVALID_PRODUCT_NAVIGATION_SOURCE_CATALOGUE',
  );
  return sha256Hex(Buffer.from(canonicalJson(sourceCatalogue), 'utf8'));
}

function navigationDefinitionPayloadDigest(navigationDefinition) {
  requireObject(
    navigationDefinition,
    'Product navigation definition',
    'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST',
  );
  return sha256Hex(Buffer.from(canonicalJson(navigationDefinition), 'utf8'));
}

function manifestIdentityBody(manifest) {
  const body = { ...manifest };
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  return body;
}

function productNavigationCataloguePayloadDigest(manifest) {
  requireObject(
    manifest,
    'Product navigation catalogue manifest',
    'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST',
  );
  return contentId(
    PRODUCT_NAVIGATION_CATALOGUE_PAYLOAD_DOMAIN,
    manifestIdentityBody(manifest),
  );
}

function validateHierarchyContract(value, label, code) {
  requireExactKeys(value, HIERARCHY_KEYS, label, code);
  if (
    canonicalJson(value.levels) !== canonicalJson([
      'DOMAIN',
      'TOPIC',
      'PATTERN',
    ])
    || value.maximum_depth !== 3
    || value.selected_topic_controls_pattern_membership !== true
    || value.all_is_catalogue_navigation_not_union_query !== true
    || value.remaining_distinctions_are_fields_or_predicates !== true
    || value.display_only_entry_permitted !== false
  ) {
    fail(code, `${label} is not the governed three-level hierarchy.`);
  }
  return value;
}

function validateSourceBinding(value, label, code) {
  requireObject(value, label, code);
  if (
    value.combined_catalogue_stable_id
      !== PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID
    || value.second_product_navigation_catalogue_permitted !== false
  ) {
    fail(code, `${label} does not bind the one PM-wide navigation catalogue.`);
  }
  const additiveKeys = Object.keys(value).filter(
    (key) => key.endsWith('_contribution_is_additive_only'),
  );
  if (
    additiveKeys.length !== 1
    || value[additiveKeys[0]] !== true
  ) {
    fail(code, `${label} does not declare one additive-only contribution.`);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key.endsWith('_stable_id')) {
      requireText(entry, `${label} ${key}`, code);
    } else if (
      key === 'second_product_navigation_catalogue_permitted'
      || key.endsWith('_contribution_is_additive_only')
    ) {
      requireBoolean(entry, `${label} ${key}`, code);
    } else {
      fail(code, `${label} contains an unrecognised binding field.`, {
        field: key,
      });
    }
  }
}

function validateAdmissionContract(value, label, code) {
  requireObject(value, label, code);
  const fixed = {
    domain_topic_and_pattern_compile_to_one_query_ir: true,
    pattern_requires_exact_predicate_admission: true,
    unknown_domain_topic_pattern_or_predicate_has_runtime_path: false,
    failed_predicate_cannot_enter_through_passing_sibling: true,
    cross_domain_boolean_query_permitted_without_composite_contract: false,
    ask_and_browse_byte_equivalence_required: true,
  };
  for (const [key, expected] of Object.entries(fixed)) {
    if (value[key] !== expected) {
      fail(code, `${label} does not contain the required ${key} rule.`);
    }
  }
  for (const [key, entry] of Object.entries(value)) {
    requireBoolean(entry, `${label} ${key}`, code);
  }
}

function validateAuthorityContract(value, label, code) {
  requireExactKeys(value, AUTHORITY_KEYS, label, code);
  for (const key of AUTHORITY_KEYS) {
    if (value[key] !== false) {
      fail(code, `${label} cannot grant ${key}.`);
    }
  }
}

function validatePattern(value, label, code) {
  requireExactKeys(value, PATTERN_KEYS, label, code);
  requireText(value.pattern_key, `${label} pattern_key`, code);
  requireText(value.label, `${label} label`, code);
  requireText(value.predicate_key, `${label} predicate_key`, code);
  requirePositiveInteger(
    value.predicate_version,
    `${label} predicate_version`,
    code,
  );
  requireText(value.predicate_shape, `${label} predicate_shape`, code);
}

function validateTopic(value, label, code, sourceStableId, domainKey) {
  requireExactKeys(value, TOPIC_KEYS, label, code);
  requireText(value.topic_key, `${label} topic_key`, code);
  requireText(value.label, `${label} label`, code);
  requireText(
    value.predicate_catalogue_stable_id,
    `${label} predicate_catalogue_stable_id`,
    code,
  );
  const patterns = requireArray(
    value.patterns,
    `${label} patterns`,
    code,
    MAX_PATTERNS,
  );
  if (patterns.length === 0) {
    fail(code, `${label} cannot be a display-only topic.`);
  }
  patterns.forEach((pattern, patternIndex) => validatePattern(
    pattern,
    `${label} pattern ${patternIndex}`,
    code,
  ));
  requireUnique(
    patterns,
    `${label} patterns`,
    (pattern) => pattern.pattern_key,
    code,
  );
  return patterns.map((pattern) => ({
    source_stable_id: sourceStableId,
    domain_key: domainKey,
    topic_key: value.topic_key,
    pattern_key: pattern.pattern_key,
    label: pattern.label,
    predicate_key: pattern.predicate_key,
    predicate_version: pattern.predicate_version,
    predicate_shape: pattern.predicate_shape,
  }));
}

function validateDomain(value, label, code, sourceStableId) {
  requireExactKeys(value, DOMAIN_KEYS, label, code);
  requireText(value.domain_key, `${label} domain_key`, code);
  requireText(value.label, `${label} label`, code);
  requireText(
    value.domain_registry_stable_id,
    `${label} domain_registry_stable_id`,
    code,
  );
  const topics = requireArray(
    value.topics,
    `${label} topics`,
    code,
    MAX_TOPICS,
  );
  if (topics.length === 0) {
    fail(code, `${label} cannot be a display-only domain.`);
  }
  requireUnique(
    topics,
    `${label} topics`,
    (topic) => topic.topic_key,
    code,
  );
  return topics.flatMap((topic, topicIndex) => validateTopic(
    topic,
    `${label} topic ${topicIndex}`,
    code,
    sourceStableId,
    value.domain_key,
  ));
}

function validateSourceCatalogue(sourceCatalogue, index) {
  const code = 'INVALID_PRODUCT_NAVIGATION_SOURCE_CATALOGUE';
  const label = `Source navigation catalogue ${index}`;
  requireExactKeys(sourceCatalogue, SOURCE_CATALOGUE_KEYS, label, code);
  requireText(sourceCatalogue.object_kind, `${label} object_kind`, code);
  requireText(sourceCatalogue.stable_id, `${label} stable_id`, code);
  requireText(sourceCatalogue.schema_version, `${label} schema_version`, code);
  requireExactKeys(
    sourceCatalogue.definition,
    SOURCE_DEFINITION_KEYS,
    `${label} definition`,
    code,
  );
  requirePositiveInteger(
    sourceCatalogue.definition.catalogue_version,
    `${label} catalogue_version`,
    code,
  );
  validateSourceBinding(
    sourceCatalogue.definition.pm_wide_catalogue_binding,
    `${label} PM-wide catalogue binding`,
    code,
  );
  validateHierarchyContract(
    sourceCatalogue.definition.hierarchy_contract,
    `${label} hierarchy contract`,
    code,
  );
  validateAdmissionContract(
    sourceCatalogue.definition.admission_contract,
    `${label} admission contract`,
    code,
  );
  validateAuthorityContract(
    sourceCatalogue.definition.authority_contract,
    `${label} authority contract`,
    code,
  );
  const domains = requireArray(
    sourceCatalogue.definition.domains,
    `${label} domains`,
    code,
    MAX_DOMAINS,
  );
  if (domains.length === 0) {
    fail(code, `${label} has no domain.`);
  }
  requireUnique(
    domains,
    `${label} domains`,
    (domain) => domain.domain_key,
    code,
  );
  const patterns = domains.flatMap((domain, domainIndex) => validateDomain(
    domain,
    `${label} domain ${domainIndex}`,
    code,
    sourceCatalogue.stable_id,
  ));
  requireUnique(
    patterns,
    `${label} product pattern identities`,
    productPatternIdentity,
    code,
  );
  requireUnique(
    patterns,
    `${label} predicate identities`,
    predicateIdentity,
    code,
  );
  return {
    sourceCatalogue,
    domains,
    patterns,
    counts: {
      domain_count: domains.length,
      topic_count: domains.reduce(
        (total, domain) => total + domain.topics.length,
        0,
      ),
      pattern_count: patterns.length,
    },
    payload_digest:
      sourceNavigationCataloguePayloadDigest(sourceCatalogue),
  };
}

function validateSourceCatalogues(sourceCatalogues) {
  const code = 'INVALID_PRODUCT_NAVIGATION_SOURCE_CATALOGUE';
  const values = requireArray(
    sourceCatalogues,
    'Source navigation catalogues',
    code,
    MAX_SOURCE_CATALOGUES,
  );
  if (values.length === 0) {
    fail(code, 'At least one source navigation catalogue is required.');
  }
  requireUnique(
    values,
    'Source navigation catalogues',
    sourceCatalogueIdentity,
    code,
  );
  requireSorted(
    values,
    'Source navigation catalogues',
    sourceCatalogueIdentity,
    code,
  );
  const sources = values.map(validateSourceCatalogue);
  const domains = sources.flatMap((source) => source.domains.map((domain) => ({
    source_stable_id: source.sourceCatalogue.stable_id,
    domain_key: domain.domain_key,
  })));
  requireUnique(
    domains,
    'PM-wide source domains',
    (domain) => domain.domain_key,
    code,
  );
  const patterns = sources.flatMap((source) => source.patterns);
  requireUnique(
    patterns,
    'PM-wide product pattern identities',
    productPatternIdentity,
    code,
  );
  requireUnique(
    patterns,
    'PM-wide predicate identities',
    predicateIdentity,
    code,
  );
  return sources;
}

function validateSourceAdmission(value, index, sourceByIdentity) {
  const code = 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION';
  const label = `Source navigation admission ${index}`;
  requireExactKeys(value, SOURCE_ADMISSION_KEYS, label, code);
  requireText(value.source_stable_id, `${label} source_stable_id`, code);
  requireText(
    value.source_schema_version,
    `${label} source_schema_version`,
    code,
  );
  requirePositiveInteger(
    value.source_catalogue_version,
    `${label} source_catalogue_version`,
    code,
  );
  requireDigest(
    value.source_payload_digest,
    `${label} source_payload_digest`,
    code,
  );
  requireNonNegativeInteger(
    value.source_domain_count,
    `${label} source_domain_count`,
    code,
  );
  requireNonNegativeInteger(
    value.source_topic_count,
    `${label} source_topic_count`,
    code,
  );
  requireNonNegativeInteger(
    value.source_pattern_count,
    `${label} source_pattern_count`,
    code,
  );
  const source = sourceByIdentity.get(sourceAdmissionIdentity(value));
  if (!source) {
    fail(code, `${label} has no supplied source catalogue.`);
  }
  const expected = {
    source_stable_id: source.sourceCatalogue.stable_id,
    source_schema_version: source.sourceCatalogue.schema_version,
    source_catalogue_version:
      source.sourceCatalogue.definition.catalogue_version,
    source_payload_digest: source.payload_digest,
    source_domain_count: source.counts.domain_count,
    source_topic_count: source.counts.topic_count,
    source_pattern_count: source.counts.pattern_count,
  };
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not bind the exact source catalogue.`, {
      expected,
    });
  }
}

function validatePatternDisposition(value, index, patternByIdentity) {
  const code = 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION';
  const label = `Navigation pattern disposition ${index}`;
  requireExactKeys(value, PATTERN_DISPOSITION_KEYS, label, code);
  for (const key of [
    'source_stable_id',
    'domain_key',
    'topic_key',
    'pattern_key',
    'predicate_key',
  ]) {
    requireText(value[key], `${label} ${key}`, code);
  }
  requirePositiveInteger(
    value.predicate_version,
    `${label} predicate_version`,
    code,
  );
  const sourcePattern = patternByIdentity.get(sourcePatternIdentity(value));
  if (
    !sourcePattern
    || sourcePattern.predicate_key !== value.predicate_key
    || sourcePattern.predicate_version !== value.predicate_version
  ) {
    fail(code, `${label} does not bind an exact source Pattern.`);
  }
  if (!['INCLUDE', 'EXCLUDE'].includes(value.decision)) {
    fail(code, `${label} decision is not registered.`);
  }
  if (value.decision === 'INCLUDE') {
    validateIdentity(
      value.certification_identity,
      `${label} certification_identity`,
      code,
    );
    if (
      value.exclusion_reason_code !== null
      || value.exclusion_evidence_identity !== null
    ) {
      fail(code, `${label} included Pattern cannot carry exclusion evidence.`);
    }
  } else {
    if (value.certification_identity !== null) {
      fail(code, `${label} excluded Pattern cannot carry certification.`);
    }
    requireText(
      value.exclusion_reason_code,
      `${label} exclusion_reason_code`,
      code,
    );
    validateIdentity(
      value.exclusion_evidence_identity,
      `${label} exclusion_evidence_identity`,
      code,
    );
  }
}

function validatePreviousCatalogueIdentity(value, code) {
  if (value === null) return;
  requireExactKeys(value, [
    'manifest_id',
    'payload_digest',
  ], 'Previous Product navigation catalogue identity', code);
  requireDigest(
    value.manifest_id,
    'Previous Product navigation manifest_id',
    code,
  );
  requireDigest(
    value.payload_digest,
    'Previous Product navigation payload_digest',
    code,
  );
}

function validateReleaseAdmission(releaseAdmission, sources) {
  const code = 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION';
  requireExactKeys(releaseAdmission, [
    'schema_version',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'catalogue_generator_identity',
    'source_catalogue_admissions',
    'pattern_dispositions',
    'required_initial_domain_keys',
    'domain_order',
    'enumeration_certification',
    'previous_catalogue_identity',
  ], 'Product navigation release admission', code);
  if (
    releaseAdmission.schema_version
      !== PRODUCT_NAVIGATION_RELEASE_ADMISSION_SCHEMA
  ) {
    fail(code, 'The Product navigation release admission schema is not supported.');
  }
  requireDigest(
    releaseAdmission.approved_pm_data_version_id,
    'Product navigation approved_pm_data_version_id',
    code,
  );
  requireDigest(
    releaseAdmission.candidate_release_manifest_id,
    'Product navigation candidate_release_manifest_id',
    code,
  );
  requireDigest(
    releaseAdmission.candidate_release_manifest_payload_digest,
    'Product navigation candidate_release_manifest_payload_digest',
    code,
  );
  validateIdentity(
    releaseAdmission.catalogue_generator_identity,
    'Product navigation catalogue_generator_identity',
    code,
  );
  const sourceByIdentity = new Map(sources.map((source) => [
    sourceCatalogueIdentity(source.sourceCatalogue),
    source,
  ]));
  const sourceAdmissions = requireArray(
    releaseAdmission.source_catalogue_admissions,
    'Product navigation source catalogue admissions',
    code,
    MAX_SOURCE_CATALOGUES,
  );
  requireUnique(
    sourceAdmissions,
    'Product navigation source catalogue admissions',
    sourceAdmissionIdentity,
    code,
  );
  requireSorted(
    sourceAdmissions,
    'Product navigation source catalogue admissions',
    sourceAdmissionIdentity,
    code,
  );
  if (sourceAdmissions.length !== sources.length) {
    fail(code, 'Every source navigation catalogue requires one exact admission.');
  }
  sourceAdmissions.forEach((admission, index) => validateSourceAdmission(
    admission,
    index,
    sourceByIdentity,
  ));

  const patterns = sources.flatMap((source) => source.patterns);
  const patternByIdentity = new Map(patterns.map((pattern) => [
    sourcePatternIdentity(pattern),
    pattern,
  ]));
  const dispositions = requireArray(
    releaseAdmission.pattern_dispositions,
    'Product navigation pattern dispositions',
    code,
    MAX_PATTERNS,
  );
  requireUnique(
    dispositions,
    'Product navigation pattern dispositions',
    sourcePatternIdentity,
    code,
  );
  requireSorted(
    dispositions,
    'Product navigation pattern dispositions',
    sourcePatternIdentity,
    code,
  );
  if (dispositions.length !== patterns.length) {
    fail(code, 'Every source Pattern requires one include or exclude decision.');
  }
  dispositions.forEach((disposition, index) => validatePatternDisposition(
    disposition,
    index,
    patternByIdentity,
  ));
  const dispositionIdentities = new Set(
    dispositions.map(sourcePatternIdentity),
  );
  for (const pattern of patterns) {
    if (!dispositionIdentities.has(sourcePatternIdentity(pattern))) {
      fail(code, 'A source Pattern has no release disposition.', {
        pattern_identity: sourcePatternIdentity(pattern),
      });
    }
  }

  const requiredDomains = validateTextSet(
    releaseAdmission.required_initial_domain_keys,
    'Required initial navigation domains',
    code,
    { maximum: MAX_DOMAINS },
  );
  if (
    canonicalJson(requiredDomains)
      !== canonicalJson(REQUIRED_INITIAL_DOMAIN_KEYS)
  ) {
    fail(code, 'The first product must require Agreement and Process domains.');
  }
  const domainOrder = validateTextSet(
    releaseAdmission.domain_order,
    'Product navigation domain order',
    code,
    { maximum: MAX_DOMAINS },
  );
  const includedDomainKeys = [...new Set(dispositions
    .filter((disposition) => disposition.decision === 'INCLUDE')
    .map((disposition) => disposition.domain_key))];
  if (
    canonicalJson([...domainOrder].sort())
      !== canonicalJson([...includedDomainKeys].sort())
  ) {
    fail(code, 'The domain order does not enumerate the included domains exactly.');
  }
  for (const requiredDomain of requiredDomains) {
    if (!includedDomainKeys.includes(requiredDomain)) {
      fail(code, 'A required initial domain has no included Pattern.', {
        domain_key: requiredDomain,
      });
    }
  }

  requireExactKeys(
    releaseAdmission.enumeration_certification,
    [
      'independent_source_enumeration_identity',
      'inclusion_exclusion_reconciliation_identity',
    ],
    'Product navigation enumeration certification',
    code,
  );
  validateIdentity(
    releaseAdmission.enumeration_certification
      .independent_source_enumeration_identity,
    'Product navigation independent source enumeration identity',
    code,
  );
  validateIdentity(
    releaseAdmission.enumeration_certification
      .inclusion_exclusion_reconciliation_identity,
    'Product navigation inclusion-exclusion reconciliation identity',
    code,
  );
  validatePreviousCatalogueIdentity(
    releaseAdmission.previous_catalogue_identity,
    code,
  );
  return {
    sources,
    patterns,
    patternByIdentity,
    dispositions,
    dispositionByIdentity: new Map(dispositions.map((disposition) => [
      sourcePatternIdentity(disposition),
      disposition,
    ])),
    domainOrder,
  };
}

function compileNavigationDefinition(release) {
  const sourceByDomain = new Map();
  for (const source of release.sources) {
    for (const domain of source.domains) {
      sourceByDomain.set(domain.domain_key, {
        source,
        domain,
      });
    }
  }
  const domains = release.domainOrder.map((domainKey) => {
    const { source, domain } = sourceByDomain.get(domainKey);
    const topics = domain.topics.map((topic) => {
      const patterns = topic.patterns.filter((pattern) => (
        release.dispositionByIdentity.get(sourcePatternIdentity({
          source_stable_id: source.sourceCatalogue.stable_id,
          domain_key: domain.domain_key,
          topic_key: topic.topic_key,
          pattern_key: pattern.pattern_key,
        }))?.decision === 'INCLUDE'
      )).map((pattern) => clone(pattern));
      if (patterns.length === 0) return null;
      return {
        topic_key: topic.topic_key,
        label: topic.label,
        predicate_catalogue_stable_id:
          topic.predicate_catalogue_stable_id,
        patterns,
      };
    }).filter(Boolean);
    if (topics.length === 0) {
      fail(
        'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
        'An included domain has no included topic.',
        { domain_key: domainKey },
      );
    }
    return {
      domain_key: domain.domain_key,
      label: domain.label,
      domain_registry_stable_id: domain.domain_registry_stable_id,
      topics,
    };
  });
  return {
    pm_wide_catalogue_binding: {
      combined_catalogue_stable_id:
        PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID,
      source_catalogue_stable_ids: release.sources
        .map((source) => source.sourceCatalogue.stable_id),
      second_product_navigation_catalogue_permitted: false,
    },
    hierarchy_contract: {
      levels: ['DOMAIN', 'TOPIC', 'PATTERN'],
      maximum_depth: 3,
      selected_topic_controls_pattern_membership: true,
      all_is_catalogue_navigation_not_union_query: true,
      remaining_distinctions_are_fields_or_predicates: true,
      display_only_entry_permitted: false,
    },
    domains,
    admission_contract: {
      domain_topic_and_pattern_compile_to_one_query_ir: true,
      pattern_requires_exact_predicate_admission: true,
      unknown_domain_topic_pattern_or_predicate_has_runtime_path: false,
      failed_predicate_cannot_enter_through_passing_sibling: true,
      cross_domain_boolean_query_permitted_without_composite_contract: false,
      ask_and_browse_byte_equivalence_required: true,
    },
  };
}

function compilePatternCertifications(release) {
  return release.dispositions
    .filter((disposition) => disposition.decision === 'INCLUDE')
    .map((disposition) => ({
      source_stable_id: disposition.source_stable_id,
      domain_key: disposition.domain_key,
      topic_key: disposition.topic_key,
      pattern_key: disposition.pattern_key,
      predicate_key: disposition.predicate_key,
      predicate_version: disposition.predicate_version,
      certification_identity: clone(disposition.certification_identity),
    }))
    .sort(compareBy(sourcePatternIdentity));
}

function compileSourceExclusions(release) {
  return release.dispositions
    .filter((disposition) => disposition.decision === 'EXCLUDE')
    .map((disposition) => {
      const sourcePattern = release.patternByIdentity.get(
        sourcePatternIdentity(disposition),
      );
      return {
        source_stable_id: disposition.source_stable_id,
        domain_key: disposition.domain_key,
        topic_key: disposition.topic_key,
        pattern_key: disposition.pattern_key,
        label: sourcePattern.label,
        predicate_key: disposition.predicate_key,
        predicate_version: disposition.predicate_version,
        reason_code: disposition.exclusion_reason_code,
        evidence_identity: clone(
          disposition.exclusion_evidence_identity,
        ),
      };
    })
    .sort(compareBy(sourcePatternIdentity));
}

function flattenedManifestPatterns(manifest) {
  return manifest.navigation_definition.domains.flatMap((domain) => (
    domain.topics.flatMap((topic) => topic.patterns.map((pattern) => {
      const body = {
        domain_key: domain.domain_key,
        domain_label: domain.label,
        domain_registry_stable_id: domain.domain_registry_stable_id,
        topic_key: topic.topic_key,
        topic_label: topic.label,
        predicate_catalogue_stable_id:
          topic.predicate_catalogue_stable_id,
        pattern_key: pattern.pattern_key,
        pattern_label: pattern.label,
        predicate_key: pattern.predicate_key,
        predicate_version: pattern.predicate_version,
        predicate_shape: pattern.predicate_shape,
      };
      return {
        ...body,
        pattern_definition_id: contentId(
          PRODUCT_NAVIGATION_PATTERN_DEFINITION_DOMAIN,
          body,
        ),
      };
    }))
  ));
}

function compileDifference(previousManifest, navigationDefinition) {
  const currentShell = {
    navigation_definition: navigationDefinition,
  };
  const currentPatterns = flattenedManifestPatterns(currentShell);
  const previousPatterns = previousManifest
    ? flattenedManifestPatterns(previousManifest)
    : [];
  const currentByKey = new Map(currentPatterns.map((pattern) => [
    productPatternIdentity(pattern),
    pattern,
  ]));
  const previousByKey = new Map(previousPatterns.map((pattern) => [
    productPatternIdentity(pattern),
    pattern,
  ]));
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];
  for (const pattern of currentPatterns) {
    const key = productPatternIdentity(pattern);
    const previous = previousByKey.get(key);
    if (!previous) {
      added.push(pattern.pattern_definition_id);
    } else if (
      previous.pattern_definition_id === pattern.pattern_definition_id
    ) {
      unchanged.push(pattern.pattern_definition_id);
    } else {
      changed.push({
        domain_key: pattern.domain_key,
        topic_key: pattern.topic_key,
        pattern_key: pattern.pattern_key,
        from_pattern_definition_id: previous.pattern_definition_id,
        to_pattern_definition_id: pattern.pattern_definition_id,
      });
    }
  }
  for (const pattern of previousPatterns) {
    if (!currentByKey.has(productPatternIdentity(pattern))) {
      removed.push(pattern.pattern_definition_id);
    }
  }
  return {
    previous_manifest_id: previousManifest?.manifest_id || null,
    added_pattern_definition_ids: added.sort(),
    removed_pattern_definition_ids: removed.sort(),
    changed_patterns: changed.sort(compareBy(productPatternIdentity)),
    unchanged_pattern_definition_ids: unchanged.sort(),
  };
}

function validateManifestNavigationDefinition(value, code) {
  requireExactKeys(value, [
    'pm_wide_catalogue_binding',
    'hierarchy_contract',
    'domains',
    'admission_contract',
  ], 'Product navigation definition', code);
  requireExactKeys(value.pm_wide_catalogue_binding, [
    'combined_catalogue_stable_id',
    'source_catalogue_stable_ids',
    'second_product_navigation_catalogue_permitted',
  ], 'Product navigation PM-wide binding', code);
  if (
    value.pm_wide_catalogue_binding.combined_catalogue_stable_id
      !== PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID
    || value.pm_wide_catalogue_binding
      .second_product_navigation_catalogue_permitted !== false
  ) {
    fail(code, 'The Product navigation definition does not bind one catalogue.');
  }
  const sourceIds = validateTextSet(
    value.pm_wide_catalogue_binding.source_catalogue_stable_ids,
    'Product navigation source catalogue stable IDs',
    code,
    { maximum: MAX_SOURCE_CATALOGUES },
  );
  requireSorted(
    sourceIds,
    'Product navigation source catalogue stable IDs',
    String,
    code,
  );
  validateHierarchyContract(
    value.hierarchy_contract,
    'Product navigation hierarchy contract',
    code,
  );
  validateAdmissionContract(
    value.admission_contract,
    'Product navigation admission contract',
    code,
  );
  const domains = requireArray(
    value.domains,
    'Product navigation domains',
    code,
    MAX_DOMAINS,
  );
  if (domains.length === 0) {
    fail(code, 'The Product navigation definition has no domain.');
  }
  requireUnique(
    domains,
    'Product navigation domains',
    (domain) => domain.domain_key,
    code,
  );
  const patterns = domains.flatMap((domain, domainIndex) => validateDomain(
    domain,
    `Product navigation domain ${domainIndex}`,
    code,
    'PRODUCT_NAVIGATION_CATALOGUE',
  ));
  requireUnique(
    patterns,
    'Product navigation Patterns',
    productPatternIdentity,
    code,
  );
  requireUnique(
    patterns,
    'Product navigation predicate identities',
    predicateIdentity,
    code,
  );
  return { domains, patterns, sourceIds };
}

function validateBasis(value, code) {
  requireExactKeys(value, [
    'source_bindings',
    'catalogue_generator_identity',
    'enumeration_certification',
    'previous_catalogue_identity',
  ], 'Product navigation basis', code);
  const bindings = requireArray(
    value.source_bindings,
    'Product navigation source bindings',
    code,
    MAX_SOURCE_CATALOGUES,
  );
  bindings.forEach((binding, index) => {
    const label = `Product navigation source binding ${index}`;
    requireExactKeys(binding, SOURCE_BINDING_KEYS, label, code);
    requireText(binding.source_stable_id, `${label} source_stable_id`, code);
    requireText(
      binding.source_schema_version,
      `${label} source_schema_version`,
      code,
    );
    requirePositiveInteger(
      binding.source_catalogue_version,
      `${label} source_catalogue_version`,
      code,
    );
    requireDigest(
      binding.source_payload_digest,
      `${label} source_payload_digest`,
      code,
    );
    requireNonNegativeInteger(
      binding.source_domain_count,
      `${label} source_domain_count`,
      code,
    );
    requireNonNegativeInteger(
      binding.source_topic_count,
      `${label} source_topic_count`,
      code,
    );
    requireNonNegativeInteger(
      binding.source_pattern_count,
      `${label} source_pattern_count`,
      code,
    );
  });
  requireUnique(
    bindings,
    'Product navigation source bindings',
    sourceAdmissionIdentity,
    code,
  );
  requireSorted(
    bindings,
    'Product navigation source bindings',
    sourceAdmissionIdentity,
    code,
  );
  validateIdentity(
    value.catalogue_generator_identity,
    'Product navigation catalogue generator identity',
    code,
  );
  requireExactKeys(value.enumeration_certification, [
    'independent_source_enumeration_identity',
    'inclusion_exclusion_reconciliation_identity',
  ], 'Product navigation enumeration certification', code);
  validateIdentity(
    value.enumeration_certification
      .independent_source_enumeration_identity,
    'Product navigation independent enumeration identity',
    code,
  );
  validateIdentity(
    value.enumeration_certification
      .inclusion_exclusion_reconciliation_identity,
    'Product navigation disposition reconciliation identity',
    code,
  );
  validatePreviousCatalogueIdentity(value.previous_catalogue_identity, code);
  return bindings;
}

function validateDifference(value, code) {
  requireExactKeys(value, DIFFERENCE_KEYS, 'Product navigation difference', code);
  if (value.previous_manifest_id !== null) {
    requireDigest(
      value.previous_manifest_id,
      'Product navigation difference previous_manifest_id',
      code,
    );
  }
  for (const key of [
    'added_pattern_definition_ids',
    'removed_pattern_definition_ids',
    'unchanged_pattern_definition_ids',
  ]) {
    const values = requireArray(
      value[key],
      `Product navigation difference ${key}`,
      code,
      MAX_PATTERNS,
    );
    values.forEach((entry, index) => requireDigest(
      entry,
      `Product navigation difference ${key}[${index}]`,
      code,
    ));
    requireUnique(
      values,
      `Product navigation difference ${key}`,
      String,
      code,
    );
    requireSorted(
      values,
      `Product navigation difference ${key}`,
      String,
      code,
    );
  }
  const changed = requireArray(
    value.changed_patterns,
    'Product navigation changed Patterns',
    code,
    MAX_PATTERNS,
  );
  changed.forEach((entry, index) => {
    const label = `Product navigation changed Pattern ${index}`;
    requireExactKeys(entry, [
      'domain_key',
      'topic_key',
      'pattern_key',
      'from_pattern_definition_id',
      'to_pattern_definition_id',
    ], label, code);
    for (const key of ['domain_key', 'topic_key', 'pattern_key']) {
      requireText(entry[key], `${label} ${key}`, code);
    }
    requireDigest(
      entry.from_pattern_definition_id,
      `${label} from_pattern_definition_id`,
      code,
    );
    requireDigest(
      entry.to_pattern_definition_id,
      `${label} to_pattern_definition_id`,
      code,
    );
  });
  requireUnique(
    changed,
    'Product navigation changed Patterns',
    productPatternIdentity,
    code,
  );
  requireSorted(
    changed,
    'Product navigation changed Patterns',
    productPatternIdentity,
    code,
  );
}

function validateProductNavigationCatalogueManifest(manifest) {
  const code = 'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST';
  requireExactKeys(
    manifest,
    MANIFEST_KEYS,
    'Product navigation catalogue manifest',
    code,
  );
  if (
    manifest.schema_version
      !== PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA
    || manifest.stable_id !== PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID
    || manifest.manifest_version !== 1
  ) {
    fail(code, 'The Product navigation catalogue identity is not supported.');
  }
  requireDigest(
    manifest.approved_pm_data_version_id,
    'Product navigation approved_pm_data_version_id',
    code,
  );
  requireDigest(
    manifest.candidate_release_manifest_id,
    'Product navigation candidate_release_manifest_id',
    code,
  );
  requireDigest(
    manifest.candidate_release_manifest_payload_digest,
    'Product navigation candidate_release_manifest_payload_digest',
    code,
  );
  const bindings = validateBasis(manifest.basis, code);
  const navigation = validateManifestNavigationDefinition(
    manifest.navigation_definition,
    code,
  );
  if (
    canonicalJson(bindings.map((binding) => binding.source_stable_id))
      !== canonicalJson(navigation.sourceIds)
  ) {
    fail(code, 'The navigation definition source list does not match its basis.');
  }
  for (const requiredDomain of REQUIRED_INITIAL_DOMAIN_KEYS) {
    if (!navigation.domains.some(
      (domain) => domain.domain_key === requiredDomain,
    )) {
      fail(code, 'The Product navigation catalogue lacks a required domain.', {
        domain_key: requiredDomain,
      });
    }
  }

  const certifications = requireArray(
    manifest.pattern_certifications,
    'Product navigation pattern certifications',
    code,
    MAX_PATTERNS,
  );
  certifications.forEach((certification, index) => {
    const label = `Product navigation Pattern certification ${index}`;
    requireExactKeys(certification, CERTIFICATION_KEYS, label, code);
    for (const key of [
      'source_stable_id',
      'domain_key',
      'topic_key',
      'pattern_key',
      'predicate_key',
    ]) {
      requireText(certification[key], `${label} ${key}`, code);
    }
    requirePositiveInteger(
      certification.predicate_version,
      `${label} predicate_version`,
      code,
    );
    validateIdentity(
      certification.certification_identity,
      `${label} certification_identity`,
      code,
    );
  });
  requireUnique(
    certifications,
    'Product navigation Pattern certifications',
    sourcePatternIdentity,
    code,
  );
  requireUnique(
    certifications,
    'Product navigation certified product Patterns',
    productPatternIdentity,
    code,
  );
  requireSorted(
    certifications,
    'Product navigation Pattern certifications',
    sourcePatternIdentity,
    code,
  );
  if (certifications.length !== navigation.patterns.length) {
    fail(code, 'Every emitted navigation Pattern requires one certification.');
  }
  const productPatternByIdentity = new Map(navigation.patterns.map((pattern) => [
    productPatternIdentity(pattern),
    pattern,
  ]));
  const sourceIdSet = new Set(navigation.sourceIds);
  for (const certification of certifications) {
    const pattern = productPatternByIdentity.get(
      productPatternIdentity(certification),
    );
    if (
      !pattern
      || !sourceIdSet.has(certification.source_stable_id)
      || pattern.predicate_key !== certification.predicate_key
      || pattern.predicate_version !== certification.predicate_version
    ) {
      fail(code, 'A Pattern certification does not bind an emitted Pattern.');
    }
  }

  const exclusions = requireArray(
    manifest.source_exclusions,
    'Product navigation source exclusions',
    code,
    MAX_PATTERNS,
  );
  exclusions.forEach((exclusion, index) => {
    const label = `Product navigation source exclusion ${index}`;
    requireExactKeys(exclusion, EXCLUSION_KEYS, label, code);
    for (const key of [
      'source_stable_id',
      'domain_key',
      'topic_key',
      'pattern_key',
      'label',
      'predicate_key',
      'reason_code',
    ]) {
      requireText(exclusion[key], `${label} ${key}`, code);
    }
    requirePositiveInteger(
      exclusion.predicate_version,
      `${label} predicate_version`,
      code,
    );
    validateIdentity(
      exclusion.evidence_identity,
      `${label} evidence_identity`,
      code,
    );
  });
  requireUnique(
    exclusions,
    'Product navigation source exclusions',
    sourcePatternIdentity,
    code,
  );
  requireSorted(
    exclusions,
    'Product navigation source exclusions',
    sourcePatternIdentity,
    code,
  );
  if (exclusions.some(
    (exclusion) => !sourceIdSet.has(exclusion.source_stable_id),
  )) {
    fail(code, 'A source exclusion names a source outside the manifest basis.');
  }
  validateDifference(manifest.difference, code);
  const manifestPatternDefinitionIds = flattenedManifestPatterns(manifest)
    .map((pattern) => pattern.pattern_definition_id)
    .sort();
  if (manifest.difference.previous_manifest_id === null) {
    if (
      canonicalJson(manifest.difference.added_pattern_definition_ids)
        !== canonicalJson(manifestPatternDefinitionIds)
      || manifest.difference.removed_pattern_definition_ids.length !== 0
      || manifest.difference.changed_patterns.length !== 0
      || manifest.difference.unchanged_pattern_definition_ids.length !== 0
    ) {
      fail(code, 'An initial Product navigation difference does not reconcile.');
    }
  }
  requireExactKeys(manifest.counts, [
    'source_catalogue_count',
    'source_domain_count',
    'source_topic_count',
    'source_pattern_count',
    'admitted_domain_count',
    'admitted_topic_count',
    'admitted_pattern_count',
    'excluded_pattern_count',
  ], 'Product navigation counts', code);
  Object.entries(manifest.counts).forEach(([key, value]) => (
    requireNonNegativeInteger(value, `Product navigation count ${key}`, code)
  ));
  const expectedCounts = {
    source_catalogue_count: bindings.length,
    source_domain_count: bindings.reduce(
      (total, binding) => total + binding.source_domain_count,
      0,
    ),
    source_topic_count: bindings.reduce(
      (total, binding) => total + binding.source_topic_count,
      0,
    ),
    source_pattern_count: bindings.reduce(
      (total, binding) => total + binding.source_pattern_count,
      0,
    ),
    admitted_domain_count: navigation.domains.length,
    admitted_topic_count: navigation.domains.reduce(
      (total, domain) => total + domain.topics.length,
      0,
    ),
    admitted_pattern_count: navigation.patterns.length,
    excluded_pattern_count: exclusions.length,
  };
  if (canonicalJson(manifest.counts) !== canonicalJson(expectedCounts)) {
    fail(code, 'Product navigation counts do not reconcile.');
  }
  if (
    manifest.counts.source_pattern_count
      !== manifest.counts.admitted_pattern_count
        + manifest.counts.excluded_pattern_count
  ) {
    fail(code, 'Product navigation Pattern enumeration is not lossless.');
  }
  if (
    manifest.difference.previous_manifest_id
      !== manifest.basis.previous_catalogue_identity?.manifest_id
      && !(
        manifest.difference.previous_manifest_id === null
        && manifest.basis.previous_catalogue_identity === null
      )
  ) {
    fail(code, 'The Product navigation difference has the wrong prior identity.');
  }
  const expectedManifestId = contentId(
    PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA,
    manifestIdentityBody(manifest),
  );
  const expectedPayloadDigest =
    productNavigationCataloguePayloadDigest(manifest);
  requireDigest(manifest.manifest_id, 'Product navigation manifest_id', code);
  requireDigest(
    manifest.canonical_payload_digest,
    'Product navigation canonical_payload_digest',
    code,
  );
  if (
    manifest.manifest_id !== expectedManifestId
    || manifest.canonical_payload_digest !== expectedPayloadDigest
  ) {
    fail(code, 'The Product navigation catalogue identity does not match its contents.');
  }
  return manifest;
}

function validateSourceSuccessorVersions(previousManifest, sources) {
  if (previousManifest === null) return;
  const code = 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION';
  const previousByIdentity = new Map(
    previousManifest.basis.source_bindings.map((binding) => [
      sourceAdmissionIdentity(binding),
      binding,
    ]),
  );
  for (const source of sources) {
    const current = {
      source_stable_id: source.sourceCatalogue.stable_id,
      source_schema_version: source.sourceCatalogue.schema_version,
      source_catalogue_version:
        source.sourceCatalogue.definition.catalogue_version,
      source_payload_digest: source.payload_digest,
    };
    const previous = previousByIdentity.get(sourceAdmissionIdentity(current));
    if (!previous) continue;
    if (current.source_catalogue_version < previous.source_catalogue_version) {
      fail(code, 'A source navigation catalogue version moved backwards.', {
        source_stable_id: current.source_stable_id,
        previous_version: previous.source_catalogue_version,
        current_version: current.source_catalogue_version,
      });
    }
    if (
      current.source_payload_digest !== previous.source_payload_digest
      && current.source_catalogue_version
        <= previous.source_catalogue_version
    ) {
      fail(
        code,
        'A source navigation catalogue changed without a version increase.',
        {
          source_stable_id: current.source_stable_id,
          source_catalogue_version: current.source_catalogue_version,
        },
      );
    }
  }
}

function buildProductNavigationCatalogueManifest({
  source_catalogues: sourceCatalogues,
  release_admission: releaseAdmission,
  previous_manifest: previousManifest = null,
}) {
  const sources = validateSourceCatalogues(sourceCatalogues);
  const release = validateReleaseAdmission(releaseAdmission, sources);
  if (previousManifest !== null) {
    validateProductNavigationCatalogueManifest(previousManifest);
    const expectedPrevious = {
      manifest_id: previousManifest.manifest_id,
      payload_digest: previousManifest.canonical_payload_digest,
    };
    if (
      canonicalJson(releaseAdmission.previous_catalogue_identity)
        !== canonicalJson(expectedPrevious)
    ) {
      fail(
        'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
        'The previous Product navigation catalogue does not match its admission.',
      );
    }
  } else if (releaseAdmission.previous_catalogue_identity !== null) {
    fail(
      'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
      'A previous Product navigation identity has no supplied manifest.',
    );
  }
  validateSourceSuccessorVersions(previousManifest, sources);

  const navigationDefinition = compileNavigationDefinition(release);
  const basis = {
    source_bindings: clone(releaseAdmission.source_catalogue_admissions),
    catalogue_generator_identity:
      clone(releaseAdmission.catalogue_generator_identity),
    enumeration_certification:
      clone(releaseAdmission.enumeration_certification),
    previous_catalogue_identity:
      clone(releaseAdmission.previous_catalogue_identity),
  };
  const patternCertifications = compilePatternCertifications(release);
  const sourceExclusions = compileSourceExclusions(release);
  const manifestBody = {
    schema_version: PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA,
    stable_id: PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID,
    manifest_version: 1,
    approved_pm_data_version_id:
      releaseAdmission.approved_pm_data_version_id,
    candidate_release_manifest_id:
      releaseAdmission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      releaseAdmission.candidate_release_manifest_payload_digest,
    basis,
    navigation_definition: navigationDefinition,
    pattern_certifications: patternCertifications,
    source_exclusions: sourceExclusions,
    difference: compileDifference(previousManifest, navigationDefinition),
    counts: {
      source_catalogue_count: sources.length,
      source_domain_count: sources.reduce(
        (total, source) => total + source.counts.domain_count,
        0,
      ),
      source_topic_count: sources.reduce(
        (total, source) => total + source.counts.topic_count,
        0,
      ),
      source_pattern_count: release.patterns.length,
      admitted_domain_count: navigationDefinition.domains.length,
      admitted_topic_count: navigationDefinition.domains.reduce(
        (total, domain) => total + domain.topics.length,
        0,
      ),
      admitted_pattern_count: patternCertifications.length,
      excluded_pattern_count: sourceExclusions.length,
    },
  };
  const manifest = {
    ...manifestBody,
    manifest_id: contentId(
      PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA,
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      PRODUCT_NAVIGATION_CATALOGUE_PAYLOAD_DOMAIN,
      manifestBody,
    ),
  };
  validateProductNavigationCatalogueManifest(manifest);
  return deepFreeze(clone(manifest));
}

function productNavigationQueryAdmission(manifest) {
  validateProductNavigationCatalogueManifest(manifest);
  return deepFreeze({
    stable_id: PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID,
    catalogue_id: manifest.manifest_id,
    payload_digest:
      navigationDefinitionPayloadDigest(manifest.navigation_definition),
  });
}

module.exports = {
  PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA,
  PRODUCT_NAVIGATION_CATALOGUE_STABLE_ID,
  PRODUCT_NAVIGATION_RELEASE_ADMISSION_SCHEMA,
  REQUIRED_INITIAL_DOMAIN_KEYS,
  ProductNavigationCatalogueError,
  buildProductNavigationCatalogueManifest,
  navigationDefinitionPayloadDigest,
  productNavigationCataloguePayloadDigest,
  productNavigationQueryAdmission,
  sourceNavigationCataloguePayloadDigest,
  validateProductNavigationCatalogueManifest,
};
