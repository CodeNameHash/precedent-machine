const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const PROCESS_FILTER_PRESENTATION_REGISTRY_SCHEMA =
  'PROCESS_FILTER_PRESENTATION_REGISTRY/V1';
const PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION_SCHEMA =
  'PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION/V1';
const PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA =
  'PROCESS_FILTER_VALUE_OPTION_SET/V1';
const PROCESS_FILTER_COMPILATION_SCHEMA =
  'PROCESS_FILTER_COMPILATION/V1';
const PROCESS_FILTER_QUERY_CONTEXT_DOMAIN =
  'PROCESS_FILTER_QUERY_CONTEXT/V1';
const PROCESS_FILTER_VALUE_OPTION_DOMAIN =
  'PROCESS_FILTER_VALUE_OPTION/V1';
const PRODUCT_FIELD_CATALOGUE_STABLE_ID = 'PRODUCT_FIELD_CATALOGUE';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_FIELDS = 8192;
const MAX_PRESENTATIONS = 8192;
const MAX_SEARCH_TERMS = 128;
const MAX_OPERATOR_MAPPINGS = 32;
const MAX_APPLICABILITY_ENTRIES = 512;
const MAX_BROWSE_PATHS = 512;
const MAX_FILTERS = 128;
const MAX_OPTIONS = 4096;
const MAX_SEARCH_UTF8_BYTES = 512;
const FIELD_CAPABILITY_KEYS = Object.freeze([
  'display',
  'filter',
  'sort',
  'group',
  'export',
]);
const IDENTITY_KEYS = Object.freeze([
  'stable_id',
  'version',
  'payload_digest',
]);
const FIELD_PRESENTATION_KEYS = Object.freeze([
  'field_key',
  'field_version',
  'field_group_label',
  'search_terms',
  'sentence_label',
  'operator_mappings',
  'query_applicability',
  'scope_presentation',
  'certification_identity',
]);
const FIELD_EXCLUSION_KEYS = Object.freeze([
  'field_key',
  'field_version',
  'reason_code',
  'evidence_identity',
]);
const OPERATOR_MAPPING_KEYS = Object.freeze([
  'practitioner_operator',
  'machine_operator',
  'operand_kind',
]);
const APPLICABILITY_KEYS = Object.freeze([
  'domain_key',
  'predicate_key',
  'predicate_version',
  'result_definition_stable_id',
  'ask_permitted',
  'browse_paths',
]);
const BROWSE_PATH_KEYS = Object.freeze([
  'topic_key',
  'pattern_key',
]);
const SCOPE_PRESENTATION_KEYS = Object.freeze([
  'filter_scope',
  'role_label',
  'correlation_contract',
]);
const FILTER_REQUEST_KEYS = Object.freeze([
  'field_key',
  'field_version',
  'practitioner_operator',
  'operand',
]);
const OPERAND_KEYS = Object.freeze([
  'kind',
  'values',
]);
const LITERAL_KEYS = Object.freeze([
  'canonical_value',
  'display_label',
]);
const VALUE_OPTION_KEYS = Object.freeze([
  'option_id',
  'canonical_value',
  'display_label',
  'occurrence_count',
  'sort_ordinal',
]);
const OPERAND_KINDS = Object.freeze([
  'NO_VALUE',
  'ONE_LITERAL',
  'TWO_LITERALS',
  'ONE_OPTION',
  'ONE_OR_MORE_OPTIONS',
]);
const CORRELATION_CONTRACTS = Object.freeze([
  'FIELD_SCOPE_IS_COMPLETE',
  'COMPOSITE_FILTER_CONTRACT_REQUIRED',
]);

class ProcessFilterCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessFilterCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessFilterCompilerError(code, message, details);
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

function clone(value, code = 'INVALID_PROCESS_FILTER_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Process filter input is not canonical JSON.', {
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

function validateIdentity(value, label, code) {
  requireExactKeys(value, IDENTITY_KEYS, label, code);
  requireText(value.stable_id, `${label} stable_id`, code);
  requirePositiveInteger(value.version, `${label} version`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  return value;
}

function fieldIdentity(value) {
  return `${value.field_key}\0${value.field_version}`;
}

function applicabilityIdentity(value) {
  return [
    value.domain_key,
    value.predicate_key,
    value.predicate_version,
    value.result_definition_stable_id,
  ].join('\0');
}

function browsePathIdentity(value) {
  return `${value.topic_key}\0${value.pattern_key}`;
}

function normalizeProcessFilterSearch(value) {
  if (typeof value !== 'string') {
    fail(
      'INVALID_PROCESS_FILTER_SEARCH',
      'Filter field search must be text.',
    );
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_SEARCH_UTF8_BYTES) {
    fail(
      'INVALID_PROCESS_FILTER_SEARCH',
      'Filter field search exceeds the fixed byte limit.',
    );
  }
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateTextSet(
  value,
  label,
  code,
  {
    allowEmpty = false,
    maximum = MAX_FIELDS,
    sorted = true,
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
  if (sorted) requireSorted(values, label, String, code);
  return values;
}

function requireFieldProperty(field, key, label, code) {
  if (!Object.hasOwn(field, key)) {
    fail(code, `${label} has no ${key}.`);
  }
}

function validateCatalogueField(field, index) {
  const code = 'INVALID_PROCESS_FILTER_FIELD_CATALOGUE';
  const label = `Product filter field ${index}`;
  requireObject(field, label, code);
  for (const key of [
    'field_key',
    'field_version',
    'label',
    'field_group',
    'value_type',
    'control_type',
    'supported_domains',
    'permitted_result_definitions',
    'capabilities',
    'permitted_operators',
    'filter_scope',
    'multiplicity',
    'completeness_semantics',
    'unavailable_reason',
  ]) {
    requireFieldProperty(field, key, label, code);
  }
  requireText(field.field_key, `${label} field_key`, code);
  requirePositiveInteger(field.field_version, `${label} field_version`, code);
  requireText(field.label, `${label} label`, code);
  requireText(field.field_group, `${label} field_group`, code);
  requireText(field.value_type, `${label} value_type`, code);
  requireText(field.control_type, `${label} control_type`, code);
  validateTextSet(
    field.supported_domains,
    `${label} supported_domains`,
    code,
    { maximum: 64 },
  );
  validateTextSet(
    field.permitted_result_definitions,
    `${label} permitted_result_definitions`,
    code,
    { maximum: 256 },
  );
  requireObject(field.capabilities, `${label} capabilities`, code);
  for (const capability of FIELD_CAPABILITY_KEYS) {
    if (!Object.hasOwn(field.capabilities, capability)) {
      fail(code, `${label} has no ${capability} capability.`);
    }
    requireBoolean(
      field.capabilities[capability],
      `${label} ${capability} capability`,
      code,
    );
  }
  validateTextSet(
    field.permitted_operators,
    `${label} permitted_operators`,
    code,
    {
      allowEmpty: true,
      maximum: MAX_OPERATOR_MAPPINGS,
    },
  );
  if (
    field.capabilities.filter === true
    && field.permitted_operators.length === 0
  ) {
    fail(code, `${label} is filterable but has no machine operator.`);
  }
  if (
    field.capabilities.filter === false
    && field.permitted_operators.length !== 0
  ) {
    fail(code, `${label} has filter operators without filter capability.`);
  }
  requireText(field.filter_scope, `${label} filter_scope`, code);
  requireText(field.multiplicity, `${label} multiplicity`, code);
  requireText(
    field.completeness_semantics,
    `${label} completeness_semantics`,
    code,
  );
  requireText(field.unavailable_reason, `${label} unavailable_reason`, code);
  return field;
}

function validateProductFieldCatalogue(value) {
  const code = 'INVALID_PROCESS_FILTER_FIELD_CATALOGUE';
  requireExactKeys(value, [
    'stable_id',
    'manifest_id',
    'payload_digest',
    'field_definitions',
  ], 'Product field catalogue query admission', code);
  if (value.stable_id !== PRODUCT_FIELD_CATALOGUE_STABLE_ID) {
    fail(code, 'The one PM-wide Product field catalogue is required.');
  }
  requireDigest(value.manifest_id, 'Product field manifest_id', code);
  requireDigest(value.payload_digest, 'Product field payload_digest', code);
  const fields = requireArray(
    value.field_definitions,
    'Product field definitions',
    code,
    MAX_FIELDS,
  );
  if (fields.length === 0) {
    fail(code, 'The Product field catalogue has no field.');
  }
  fields.forEach(validateCatalogueField);
  requireUnique(fields, 'Product field definitions', fieldIdentity, code);
  requireSorted(fields, 'Product field definitions', fieldIdentity, code);
  return {
    fields,
    fieldByIdentity: new Map(fields.map((field) => [
      fieldIdentity(field),
      field,
    ])),
  };
}

function presentationRegistryPayloadDigest(registry) {
  requireObject(
    registry,
    'Process filter presentation registry',
    'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY',
  );
  const body = { ...registry };
  delete body.canonical_payload_digest;
  return sha256Hex(Buffer.from(canonicalJson(body), 'utf8'));
}

function validateBrowsePath(value, label, code) {
  requireExactKeys(value, BROWSE_PATH_KEYS, label, code);
  requireText(value.topic_key, `${label} topic_key`, code);
  requireText(value.pattern_key, `${label} pattern_key`, code);
}

function validateApplicability(value, label, code, field) {
  requireExactKeys(value, APPLICABILITY_KEYS, label, code);
  requireText(value.domain_key, `${label} domain_key`, code);
  requireText(value.predicate_key, `${label} predicate_key`, code);
  requirePositiveInteger(
    value.predicate_version,
    `${label} predicate_version`,
    code,
  );
  requireText(
    value.result_definition_stable_id,
    `${label} result_definition_stable_id`,
    code,
  );
  requireBoolean(value.ask_permitted, `${label} ask_permitted`, code);
  const browsePaths = requireArray(
    value.browse_paths,
    `${label} browse_paths`,
    code,
    MAX_BROWSE_PATHS,
  );
  browsePaths.forEach((path, index) => validateBrowsePath(
    path,
    `${label} Browse path ${index}`,
    code,
  ));
  requireUnique(
    browsePaths,
    `${label} Browse paths`,
    browsePathIdentity,
    code,
  );
  requireSorted(
    browsePaths,
    `${label} Browse paths`,
    browsePathIdentity,
    code,
  );
  if (
    !field.supported_domains.includes(value.domain_key)
    || !field.permitted_result_definitions.includes(
      value.result_definition_stable_id,
    )
  ) {
    fail(code, `${label} expands the Product field catalogue.`);
  }
  if (value.ask_permitted === false && browsePaths.length === 0) {
    fail(code, `${label} creates no usable entry point.`);
  }
}

function validateOperatorMapping(value, label, code, field) {
  requireExactKeys(value, OPERATOR_MAPPING_KEYS, label, code);
  requireText(
    value.practitioner_operator,
    `${label} practitioner_operator`,
    code,
  );
  requireText(value.machine_operator, `${label} machine_operator`, code);
  if (!OPERAND_KINDS.includes(value.operand_kind)) {
    fail(code, `${label} operand_kind is not registered.`);
  }
  if (!field.permitted_operators.includes(value.machine_operator)) {
    fail(code, `${label} names a machine operator not admitted for the field.`);
  }
}

function validateScopePresentation(value, label, code, field) {
  requireExactKeys(value, SCOPE_PRESENTATION_KEYS, label, code);
  if (value.filter_scope !== field.filter_scope) {
    fail(code, `${label} changes the governed field scope.`);
  }
  if (value.role_label !== null) {
    requireText(value.role_label, `${label} role_label`, code);
  }
  if (!CORRELATION_CONTRACTS.includes(value.correlation_contract)) {
    fail(code, `${label} correlation_contract is not registered.`);
  }
}

function validateFieldPresentation(value, index, fieldByIdentity) {
  const code = 'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY';
  const label = `Filter field presentation ${index}`;
  requireExactKeys(value, FIELD_PRESENTATION_KEYS, label, code);
  requireText(value.field_key, `${label} field_key`, code);
  requirePositiveInteger(value.field_version, `${label} field_version`, code);
  const field = fieldByIdentity.get(fieldIdentity(value));
  if (!field || field.capabilities.filter !== true) {
    fail(code, `${label} does not bind a filterable Product field.`);
  }
  requireText(value.field_group_label, `${label} field_group_label`, code);
  const searchTerms = validateTextSet(
    value.search_terms,
    `${label} search_terms`,
    code,
    {
      maximum: MAX_SEARCH_TERMS,
      sorted: false,
    },
  );
  const normalizedTerms = searchTerms.map(normalizeProcessFilterSearch);
  if (normalizedTerms.some((term) => term.length === 0)) {
    fail(code, `${label} has an empty normalised search term.`);
  }
  requireUnique(
    normalizedTerms,
    `${label} normalised search terms`,
    String,
    code,
  );
  if (!normalizedTerms.includes(normalizeProcessFilterSearch(field.label))) {
    fail(code, `${label} search terms omit the admitted field label.`);
  }
  requireText(value.sentence_label, `${label} sentence_label`, code);
  const operatorMappings = requireArray(
    value.operator_mappings,
    `${label} operator_mappings`,
    code,
    MAX_OPERATOR_MAPPINGS,
  );
  if (operatorMappings.length === 0) {
    fail(code, `${label} has no practitioner operator.`);
  }
  operatorMappings.forEach((mapping, mappingIndex) => (
    validateOperatorMapping(
      mapping,
      `${label} operator mapping ${mappingIndex}`,
      code,
      field,
    )
  ));
  requireUnique(
    operatorMappings,
    `${label} practitioner operators`,
    (mapping) => normalizeProcessFilterSearch(
      mapping.practitioner_operator,
    ),
    code,
  );
  const applicability = requireArray(
    value.query_applicability,
    `${label} query_applicability`,
    code,
    MAX_APPLICABILITY_ENTRIES,
  );
  if (applicability.length === 0) {
    fail(code, `${label} has no query applicability.`);
  }
  applicability.forEach((entry, entryIndex) => validateApplicability(
    entry,
    `${label} applicability ${entryIndex}`,
    code,
    field,
  ));
  requireUnique(
    applicability,
    `${label} query applicability`,
    applicabilityIdentity,
    code,
  );
  requireSorted(
    applicability,
    `${label} query applicability`,
    applicabilityIdentity,
    code,
  );
  validateScopePresentation(
    value.scope_presentation,
    `${label} scope presentation`,
    code,
    field,
  );
  validateIdentity(
    value.certification_identity,
    `${label} certification_identity`,
    code,
  );
  return { field, presentation: value, normalizedTerms };
}

function validateFieldExclusion(value, index, fieldByIdentity) {
  const code = 'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY';
  const label = `Filter field exclusion ${index}`;
  requireExactKeys(value, FIELD_EXCLUSION_KEYS, label, code);
  requireText(value.field_key, `${label} field_key`, code);
  requirePositiveInteger(value.field_version, `${label} field_version`, code);
  requireText(value.reason_code, `${label} reason_code`, code);
  validateIdentity(value.evidence_identity, `${label} evidence_identity`, code);
  const field = fieldByIdentity.get(fieldIdentity(value));
  if (!field) {
    fail(code, `${label} does not bind a Product field.`);
  }
  if (field.capabilities.filter === true) {
    fail(code, `${label} removes a released filterable field.`);
  }
  return { field, exclusion: value };
}

function validatePresentationRegistry(
  registry,
  catalogue,
  approvedPmDataVersionId,
) {
  const code = 'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY';
  requireExactKeys(registry, [
    'schema_version',
    'stable_id',
    'registry_version',
    'approved_pm_data_version_id',
    'product_field_catalogue_manifest_id',
    'product_field_catalogue_payload_digest',
    'field_presentations',
    'field_exclusions',
    'enumeration_certification',
    'canonical_payload_digest',
  ], 'Process filter presentation registry', code);
  if (
    registry.schema_version !== PROCESS_FILTER_PRESENTATION_REGISTRY_SCHEMA
    || registry.stable_id !== 'PROCESS_FILTER_PRESENTATION_REGISTRY'
  ) {
    fail(code, 'The Process filter presentation registry identity is not supported.');
  }
  requirePositiveInteger(
    registry.registry_version,
    'Process filter presentation registry_version',
    code,
  );
  requireDigest(
    registry.approved_pm_data_version_id,
    'Process filter approved_pm_data_version_id',
    code,
  );
  if (
    registry.approved_pm_data_version_id !== approvedPmDataVersionId
    || registry.product_field_catalogue_manifest_id
      !== catalogue.value.manifest_id
    || registry.product_field_catalogue_payload_digest
      !== catalogue.value.payload_digest
  ) {
    fail(code, 'The filter registry does not bind the selected field catalogue and data version.');
  }
  requireDigest(
    registry.product_field_catalogue_manifest_id,
    'Filter registry Product field manifest_id',
    code,
  );
  requireDigest(
    registry.product_field_catalogue_payload_digest,
    'Filter registry Product field payload_digest',
    code,
  );
  const presentations = requireArray(
    registry.field_presentations,
    'Filter field presentations',
    code,
    MAX_PRESENTATIONS,
  );
  const validatedPresentations = presentations.map(
    (presentation, index) => validateFieldPresentation(
      presentation,
      index,
      catalogue.fieldByIdentity,
    ),
  );
  requireUnique(
    presentations,
    'Filter field presentations',
    fieldIdentity,
    code,
  );
  requireSorted(
    presentations,
    'Filter field presentations',
    fieldIdentity,
    code,
  );
  const exclusions = requireArray(
    registry.field_exclusions,
    'Filter field exclusions',
    code,
    MAX_FIELDS,
  );
  const validatedExclusions = exclusions.map(
    (exclusion, index) => validateFieldExclusion(
      exclusion,
      index,
      catalogue.fieldByIdentity,
    ),
  );
  requireUnique(exclusions, 'Filter field exclusions', fieldIdentity, code);
  requireSorted(exclusions, 'Filter field exclusions', fieldIdentity, code);
  const dispositions = [
    ...presentations.map(fieldIdentity),
    ...exclusions.map(fieldIdentity),
  ];
  requireUnique(dispositions, 'Filter field dispositions', String, code);
  const expectedFields = catalogue.fields.map(fieldIdentity).sort();
  if (canonicalJson([...dispositions].sort()) !== canonicalJson(expectedFields)) {
    fail(code, 'Every Product field requires one presentation or exclusion.');
  }
  requireExactKeys(registry.enumeration_certification, [
    'independent_field_enumeration_identity',
    'presentation_exclusion_reconciliation_identity',
  ], 'Filter registry enumeration certification', code);
  validateIdentity(
    registry.enumeration_certification
      .independent_field_enumeration_identity,
    'Filter independent field enumeration identity',
    code,
  );
  validateIdentity(
    registry.enumeration_certification
      .presentation_exclusion_reconciliation_identity,
    'Filter presentation-exclusion reconciliation identity',
    code,
  );
  requireDigest(
    registry.canonical_payload_digest,
    'Filter registry canonical_payload_digest',
    code,
  );
  const expectedDigest = presentationRegistryPayloadDigest(registry);
  if (registry.canonical_payload_digest !== expectedDigest) {
    fail(code, 'The filter registry payload digest does not match its contents.');
  }
  return {
    presentations: validatedPresentations,
    presentationByIdentity: new Map(validatedPresentations.map((entry) => [
      fieldIdentity(entry.presentation),
      entry,
    ])),
    exclusions: validatedExclusions,
  };
}

function validateRegistryAdmission(admission, registry, catalogue) {
  const code = 'INVALID_PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION';
  requireExactKeys(admission, [
    'schema_version',
    'stable_id',
    'registry_version',
    'approved_pm_data_version_id',
    'product_field_catalogue_manifest_id',
    'product_field_catalogue_payload_digest',
    'registry_payload_digest',
    'enumeration_certification',
  ], 'Process filter registry admission', code);
  if (
    admission.schema_version
      !== PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION_SCHEMA
    || admission.stable_id !== registry.stable_id
    || admission.registry_version !== registry.registry_version
    || admission.approved_pm_data_version_id
      !== registry.approved_pm_data_version_id
    || admission.product_field_catalogue_manifest_id
      !== catalogue.value.manifest_id
    || admission.product_field_catalogue_payload_digest
      !== catalogue.value.payload_digest
    || admission.registry_payload_digest
      !== registry.canonical_payload_digest
    || canonicalJson(admission.enumeration_certification)
      !== canonicalJson(registry.enumeration_certification)
  ) {
    fail(code, 'The registry admission does not bind the exact filter registry.');
  }
}

function queryContextId(queryContext) {
  return contentId(PROCESS_FILTER_QUERY_CONTEXT_DOMAIN, queryContext);
}

function validateQueryContext(queryContext, catalogue) {
  const code = 'INVALID_PROCESS_FILTER_QUERY_CONTEXT';
  requireExactKeys(queryContext, [
    'approved_pm_data_version_id',
    'product_field_catalogue_manifest_id',
    'domain_key',
    'entry_mode',
    'topic_key',
    'pattern_key',
    'predicate_key',
    'predicate_version',
    'result_definition',
    'understood_legal_question_label',
  ], 'Process filter query context', code);
  requireDigest(
    queryContext.approved_pm_data_version_id,
    'Filter query approved_pm_data_version_id',
    code,
  );
  if (
    queryContext.product_field_catalogue_manifest_id
      !== catalogue.value.manifest_id
  ) {
    fail(code, 'The filter query context uses another Product field catalogue.');
  }
  requireDigest(
    queryContext.product_field_catalogue_manifest_id,
    'Filter query Product field manifest_id',
    code,
  );
  requireText(queryContext.domain_key, 'Filter query domain_key', code);
  if (!['ASK', 'BROWSE'].includes(queryContext.entry_mode)) {
    fail(code, 'The filter query entry_mode is not registered.');
  }
  if (queryContext.entry_mode === 'ASK') {
    if (queryContext.topic_key !== null || queryContext.pattern_key !== null) {
      fail(code, 'Ask filter context cannot invent a Browse path.');
    }
  } else {
    requireText(queryContext.topic_key, 'Filter query topic_key', code);
    requireText(queryContext.pattern_key, 'Filter query pattern_key', code);
  }
  requireText(queryContext.predicate_key, 'Filter query predicate_key', code);
  requirePositiveInteger(
    queryContext.predicate_version,
    'Filter query predicate_version',
    code,
  );
  requireExactKeys(queryContext.result_definition, [
    'stable_id',
    'version',
  ], 'Filter query result definition', code);
  requireText(
    queryContext.result_definition.stable_id,
    'Filter query result stable_id',
    code,
  );
  requirePositiveInteger(
    queryContext.result_definition.version,
    'Filter query result version',
    code,
  );
  requireText(
    queryContext.understood_legal_question_label,
    'Filter query understood legal question label',
    code,
  );
  return {
    value: queryContext,
    query_context_id: queryContextId(queryContext),
  };
}

function applicabilityState(presentation, queryContext) {
  const sameDomain = presentation.query_applicability.filter(
    (entry) => entry.domain_key === queryContext.domain_key,
  );
  if (sameDomain.length === 0) return 'FIELD_NOT_AVAILABLE_FOR_DOMAIN';
  const samePredicate = sameDomain.filter((entry) => (
    entry.predicate_key === queryContext.predicate_key
    && entry.predicate_version === queryContext.predicate_version
  ));
  if (samePredicate.length === 0) {
    return 'FIELD_NOT_AVAILABLE_FOR_LEGAL_QUESTION';
  }
  const sameResult = samePredicate.filter(
    (entry) => (
      entry.result_definition_stable_id
        === queryContext.result_definition.stable_id
    ),
  );
  if (sameResult.length === 0) {
    return 'FIELD_NOT_AVAILABLE_FOR_RESULT';
  }
  const usable = sameResult.some((entry) => {
    if (queryContext.entry_mode === 'ASK') return entry.ask_permitted;
    return entry.browse_paths.some((path) => (
      path.topic_key === queryContext.topic_key
      && path.pattern_key === queryContext.pattern_key
    ));
  });
  if (!usable) return 'FIELD_NOT_AVAILABLE_FOR_ENTRY_PATH';
  if (
    presentation.scope_presentation.correlation_contract
      === 'COMPOSITE_FILTER_CONTRACT_REQUIRED'
  ) {
    return 'COMPOSITE_FILTER_CONTRACT_REQUIRED';
  }
  return 'AVAILABLE';
}

function validateCompilerInputs({
  product_field_catalogue: productFieldCatalogue,
  presentation_registry: presentationRegistry,
  registry_admission: registryAdmission,
  query_context: queryContext,
}) {
  const catalogue = {
    value: productFieldCatalogue,
    ...validateProductFieldCatalogue(productFieldCatalogue),
  };
  const query = validateQueryContext(queryContext, catalogue);
  const registry = validatePresentationRegistry(
    presentationRegistry,
    catalogue,
    queryContext.approved_pm_data_version_id,
  );
  validateRegistryAdmission(
    registryAdmission,
    presentationRegistry,
    catalogue,
  );
  return { catalogue, query, registry };
}

function presentationView(entry) {
  return {
    field_key: entry.field.field_key,
    field_version: entry.field.field_version,
    label: entry.field.label,
    field_group: entry.field.field_group,
    field_group_label: entry.presentation.field_group_label,
    control_type: entry.field.control_type,
    value_type: entry.field.value_type,
    practitioner_operators: entry.presentation.operator_mappings.map(
      (mapping) => mapping.practitioner_operator,
    ),
    filter_scope: entry.field.filter_scope,
    role_label: entry.presentation.scope_presentation.role_label,
  };
}

function listProcessFilterFields({
  product_field_catalogue: productFieldCatalogue,
  presentation_registry: presentationRegistry,
  registry_admission: registryAdmission,
  query_context: queryContext,
  search_text: searchText,
}) {
  const validated = validateCompilerInputs({
    product_field_catalogue: productFieldCatalogue,
    presentation_registry: presentationRegistry,
    registry_admission: registryAdmission,
    query_context: queryContext,
  });
  const normalizedSearch = normalizeProcessFilterSearch(searchText);
  const matches = validated.registry.presentations.filter((entry) => (
    normalizedSearch.length === 0
    || entry.normalizedTerms.some((term) => term.includes(normalizedSearch))
  ));
  const available = [];
  const unavailable = [];
  for (const entry of matches) {
    const state = applicabilityState(entry.presentation, queryContext);
    if (state === 'AVAILABLE') {
      available.push(presentationView(entry));
    } else if (normalizedSearch.length > 0) {
      unavailable.push({
        field_key: entry.field.field_key,
        field_version: entry.field.field_version,
        label: entry.field.label,
        reason: state,
      });
    }
  }
  if (normalizedSearch.length > 0) {
    for (const entry of validated.registry.exclusions) {
      if (
        normalizeProcessFilterSearch(entry.field.label)
          .includes(normalizedSearch)
      ) {
        unavailable.push({
          field_key: entry.field.field_key,
          field_version: entry.field.field_version,
          label: entry.field.label,
          reason: entry.exclusion.reason_code,
        });
      }
    }
  }
  available.sort(compareBy((entry) => (
    `${entry.field_group}\0${entry.label}\0${entry.field_key}`
  )));
  unavailable.sort(compareBy((entry) => (
    `${entry.label}\0${entry.field_key}`
  )));
  return deepFreeze({
    outcome: 'FILTER_FIELD_CATALOGUE',
    query_context_id: validated.query.query_context_id,
    search_text: normalizedSearch,
    available_fields: available,
    unavailable_matches: unavailable,
  });
}

function valueOptionId(fieldKey, fieldVersion, canonicalValue, displayLabel) {
  return contentId(PROCESS_FILTER_VALUE_OPTION_DOMAIN, {
    field_key: fieldKey,
    field_version: fieldVersion,
    canonical_value: canonicalValue,
    display_label: displayLabel,
  });
}

function validateValueOption(option, index, optionSet) {
  const code = 'INVALID_PROCESS_FILTER_VALUE_OPTION_SET';
  const label = `Filter value option ${index}`;
  requireExactKeys(option, VALUE_OPTION_KEYS, label, code);
  requireDigest(option.option_id, `${label} option_id`, code);
  clone(option.canonical_value, code);
  if (option.canonical_value === null) {
    fail(code, `${label} canonical_value cannot be null.`);
  }
  requireText(option.display_label, `${label} display_label`, code);
  requireNonNegativeInteger(
    option.occurrence_count,
    `${label} occurrence_count`,
    code,
  );
  requirePositiveInteger(option.sort_ordinal, `${label} sort_ordinal`, code);
  const expectedId = valueOptionId(
    optionSet.field_key,
    optionSet.field_version,
    option.canonical_value,
    option.display_label,
  );
  if (option.option_id !== expectedId) {
    fail(code, `${label} identity does not match its field and value.`);
  }
}

function validateValueOptionSet(
  optionSet,
  index,
  query,
  catalogue,
) {
  const code = 'INVALID_PROCESS_FILTER_VALUE_OPTION_SET';
  const label = `Filter value option set ${index}`;
  requireExactKeys(optionSet, [
    'schema_version',
    'approved_pm_data_version_id',
    'product_field_catalogue_manifest_id',
    'query_context_id',
    'field_key',
    'field_version',
    'other_filter_set_id',
    'covered_set_identity',
    'options',
    'option_set_id',
  ], label, code);
  if (optionSet.schema_version !== PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA) {
    fail(code, `${label} schema is not supported.`);
  }
  if (
    optionSet.approved_pm_data_version_id
      !== query.value.approved_pm_data_version_id
    || optionSet.product_field_catalogue_manifest_id
      !== catalogue.value.manifest_id
    || optionSet.query_context_id !== query.query_context_id
  ) {
    fail(code, `${label} does not bind the selected query context.`);
  }
  requireDigest(
    optionSet.approved_pm_data_version_id,
    `${label} approved_pm_data_version_id`,
    code,
  );
  requireDigest(
    optionSet.product_field_catalogue_manifest_id,
    `${label} Product field manifest_id`,
    code,
  );
  requireDigest(optionSet.query_context_id, `${label} query_context_id`, code);
  requireText(optionSet.field_key, `${label} field_key`, code);
  requirePositiveInteger(
    optionSet.field_version,
    `${label} field_version`,
    code,
  );
  const field = catalogue.fieldByIdentity.get(fieldIdentity(optionSet));
  if (!field || field.capabilities.filter !== true) {
    fail(code, `${label} does not bind a filterable field.`);
  }
  requireDigest(
    optionSet.other_filter_set_id,
    `${label} other_filter_set_id`,
    code,
  );
  requireDigest(
    optionSet.covered_set_identity,
    `${label} covered_set_identity`,
    code,
  );
  const options = requireArray(
    optionSet.options,
    `${label} options`,
    code,
    MAX_OPTIONS,
  );
  options.forEach((option, optionIndex) => validateValueOption(
    option,
    optionIndex,
    optionSet,
  ));
  requireUnique(options, `${label} options`, (option) => option.option_id, code);
  const ordinals = options.map((option) => option.sort_ordinal);
  if (canonicalJson(ordinals) !== canonicalJson(
    options.map((_, optionIndex) => optionIndex + 1),
  )) {
    fail(code, `${label} option ordinals are not contiguous.`);
  }
  const body = { ...optionSet };
  delete body.option_set_id;
  const expectedId = contentId(PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA, body);
  if (optionSet.option_set_id !== expectedId) {
    fail(code, `${label} identity does not match its contents.`);
  }
  return {
    value: optionSet,
    field,
    optionById: new Map(options.map((option) => [
      option.option_id,
      option,
    ])),
  };
}

function listProcessFilterValueOptions({
  option_set: optionSet,
  selected_option_ids: selectedOptionIds,
  product_field_catalogue: productFieldCatalogue,
  query_context: queryContext,
}) {
  const catalogue = {
    value: productFieldCatalogue,
    ...validateProductFieldCatalogue(productFieldCatalogue),
  };
  const query = validateQueryContext(queryContext, catalogue);
  const validated = validateValueOptionSet(optionSet, 0, query, catalogue);
  const selected = validateTextSet(
    selectedOptionIds,
    'Selected filter option IDs',
    'INVALID_PROCESS_FILTER_VALUE_OPTION_SET',
    {
      allowEmpty: true,
      maximum: MAX_OPTIONS,
    },
  );
  selected.forEach((optionId) => requireDigest(
    optionId,
    'Selected filter option ID',
    'INVALID_PROCESS_FILTER_VALUE_OPTION_SET',
  ));
  const selectedSet = new Set(selected);
  for (const optionId of selectedSet) {
    if (!validated.optionById.has(optionId)) {
      fail(
        'INVALID_PROCESS_FILTER_VALUE_OPTION_SET',
        'A selected option is not in the bound option set.',
      );
    }
  }
  return deepFreeze({
    option_set_id: optionSet.option_set_id,
    field_key: optionSet.field_key,
    field_version: optionSet.field_version,
    options: optionSet.options
      .filter((option) => (
        option.occurrence_count > 0 || selectedSet.has(option.option_id)
      ))
      .map((option) => ({
        option_id: option.option_id,
        display_label: option.display_label,
        occurrence_count: option.occurrence_count,
        selected: selectedSet.has(option.option_id),
        active_choice: option.occurrence_count > 0,
      })),
  });
}

function validateLiteral(value, label, code) {
  requireExactKeys(value, LITERAL_KEYS, label, code);
  if (value.canonical_value === null) {
    fail(code, `${label} canonical_value cannot be null.`);
  }
  clone(value.canonical_value, code);
  requireText(value.display_label, `${label} display_label`, code);
}

function validateOperand(operand, label, code) {
  requireExactKeys(operand, OPERAND_KEYS, label, code);
  if (!OPERAND_KINDS.includes(operand.kind)) {
    fail(code, `${label} kind is not registered.`);
  }
  const values = requireArray(
    operand.values,
    `${label} values`,
    code,
    MAX_OPTIONS,
  );
  if (operand.kind === 'NO_VALUE' && values.length !== 0) {
    fail(code, `${label} NO_VALUE cannot carry a value.`);
  }
  if (
    ['ONE_LITERAL', 'ONE_OPTION'].includes(operand.kind)
    && values.length !== 1
  ) {
    fail(code, `${label} ${operand.kind} requires one value.`);
  }
  if (operand.kind === 'TWO_LITERALS' && values.length !== 2) {
    fail(code, `${label} TWO_LITERALS requires two values.`);
  }
  if (
    operand.kind === 'ONE_OR_MORE_OPTIONS'
    && values.length === 0
  ) {
    fail(code, `${label} ONE_OR_MORE_OPTIONS requires a value.`);
  }
  if (['ONE_LITERAL', 'TWO_LITERALS'].includes(operand.kind)) {
    values.forEach((value, index) => validateLiteral(
      value,
      `${label} literal ${index}`,
      code,
    ));
    requireUnique(
      values,
      `${label} literal values`,
      (value) => canonicalJson(value.canonical_value),
      code,
    );
  } else if (['ONE_OPTION', 'ONE_OR_MORE_OPTIONS'].includes(operand.kind)) {
    values.forEach((value, index) => requireDigest(
      value,
      `${label} option ID ${index}`,
      code,
    ));
    requireUnique(values, `${label} option IDs`, String, code);
  }
}

function findOperatorMapping(presentation, practitionerOperator) {
  const normalized = normalizeProcessFilterSearch(practitionerOperator);
  return presentation.operator_mappings.find((mapping) => (
    normalizeProcessFilterSearch(mapping.practitioner_operator) === normalized
  ));
}

function resolveOperand(
  operand,
  mapping,
  optionSet,
  label,
) {
  const code = 'INVALID_PROCESS_FILTER_REQUEST';
  if (operand.kind !== mapping.operand_kind) {
    fail(code, `${label} operand does not match the practitioner operator.`);
  }
  if (operand.kind === 'NO_VALUE') {
    return {
      machineValue: null,
      selectedValues: [],
      optionSetId: null,
    };
  }
  if (['ONE_LITERAL', 'TWO_LITERALS'].includes(operand.kind)) {
    return {
      machineValue: operand.kind === 'ONE_LITERAL'
        ? clone(operand.values[0].canonical_value)
        : operand.values.map((value) => clone(value.canonical_value)),
      selectedValues: operand.values.map((value) => ({
        canonical_value: clone(value.canonical_value),
        display_label: value.display_label,
      })),
      optionSetId: null,
    };
  }
  if (!optionSet) {
    fail(code, `${label} requires one bound value option set.`);
  }
  const resolved = operand.values.map((optionId) => {
    const option = optionSet.optionById.get(optionId);
    if (!option) {
      fail(code, `${label} selects a value outside its option set.`);
    }
    return option;
  });
  const machineValues = resolved.map((option) => clone(option.canonical_value));
  return {
    machineValue: operand.kind === 'ONE_OPTION'
      ? machineValues[0]
      : machineValues,
    selectedValues: resolved.map((option) => ({
      canonical_value: clone(option.canonical_value),
      display_label: option.display_label,
    })),
    optionSetId: optionSet.value.option_set_id,
  };
}

function compileSentenceClause(presentation, mapping, selectedValues) {
  const valueText = selectedValues.map((value) => value.display_label).join(
    selectedValues.length > 2 ? ', ' : ' and ',
  );
  return valueText
    ? `${presentation.sentence_label} ${mapping.practitioner_operator} ${valueText}`
    : `${presentation.sentence_label} ${mapping.practitioner_operator}`;
}

function validateFilterRequests(
  requests,
  validated,
  optionSets,
) {
  const code = 'INVALID_PROCESS_FILTER_REQUEST';
  const values = requireArray(
    requests,
    'Process filter requests',
    code,
    MAX_FILTERS,
  );
  values.forEach((request, index) => {
    const label = `Process filter request ${index}`;
    requireExactKeys(request, FILTER_REQUEST_KEYS, label, code);
    requireText(request.field_key, `${label} field_key`, code);
    requirePositiveInteger(
      request.field_version,
      `${label} field_version`,
      code,
    );
    requireText(
      request.practitioner_operator,
      `${label} practitioner_operator`,
      code,
    );
    validateOperand(request.operand, `${label} operand`, code);
  });
  requireUnique(values, 'Process filter requests', fieldIdentity, code);
  const compiled = values.map((request, index) => {
    const label = `Process filter request ${index}`;
    const entry = validated.registry.presentationByIdentity.get(
      fieldIdentity(request),
    );
    if (!entry) {
      fail(code, `${label} does not bind a presented filter field.`);
    }
    const state = applicabilityState(entry.presentation, validated.query.value);
    if (state !== 'AVAILABLE') {
      if (state === 'COMPOSITE_FILTER_CONTRACT_REQUIRED') {
        fail(
          'COMPOSITE_FILTER_CONTRACT_REQUIRED',
          'The selected field requires a composite scope contract that this Query IR does not yet carry.',
          { field_key: request.field_key },
        );
      }
      fail(code, `${label} is not available for the selected legal question.`, {
        reason: state,
      });
    }
    const mapping = findOperatorMapping(
      entry.presentation,
      request.practitioner_operator,
    );
    if (!mapping) {
      fail(code, `${label} practitioner operator is not admitted.`);
    }
    if (
      mapping.machine_operator === 'ALL'
      && !entry.field.completeness_semantics.includes('NON_VACUOUS_ALL')
    ) {
      fail(code, `${label} cannot use includes all on an incomplete field contract.`);
    }
    const optionSet = optionSets.get(fieldIdentity(request)) || null;
    const resolved = resolveOperand(
      request.operand,
      mapping,
      optionSet,
      label,
    );
    return {
      field_key: entry.field.field_key,
      field_version: entry.field.field_version,
      machine_operator: mapping.machine_operator,
      machine_value: resolved.machineValue,
      practitioner_operator: mapping.practitioner_operator,
      selected_values: resolved.selectedValues,
      option_set_id: resolved.optionSetId,
      field_scope: entry.field.filter_scope,
      multiplicity: entry.field.multiplicity,
      completeness_semantics: entry.field.completeness_semantics,
      role_label: entry.presentation.scope_presentation.role_label,
      correlation_contract:
        entry.presentation.scope_presentation.correlation_contract,
      sentence_label: entry.presentation.sentence_label,
      sentence_clause: compileSentenceClause(
        entry.presentation,
        mapping,
        resolved.selectedValues,
      ),
    };
  }).sort(compareBy(fieldIdentity));
  const composite = compiled.filter(
    (clause) => (
      clause.correlation_contract
        === 'COMPOSITE_FILTER_CONTRACT_REQUIRED'
    ),
  );
  if (composite.length > 0) {
    fail(
      'COMPOSITE_FILTER_CONTRACT_REQUIRED',
      'A selected filter requires a composite scope contract that this Query IR does not yet carry.',
      {
        field_keys: composite.map((clause) => clause.field_key),
      },
    );
  }
  return compiled;
}

function validateProcessFilterCompilation(compilation) {
  const code = 'INVALID_PROCESS_FILTER_COMPILATION';
  requireExactKeys(compilation, [
    'schema_version',
    'compilation_id',
    'query_context_id',
    'approved_pm_data_version_id',
    'product_field_catalogue_manifest_id',
    'presentation_registry_payload_digest',
    'understood_legal_question_label',
    'clauses',
    'active_filter_sentence',
  ], 'Process filter compilation', code);
  if (compilation.schema_version !== PROCESS_FILTER_COMPILATION_SCHEMA) {
    fail(code, 'The Process filter compilation schema is not supported.');
  }
  for (const key of [
    'compilation_id',
    'query_context_id',
    'approved_pm_data_version_id',
    'product_field_catalogue_manifest_id',
    'presentation_registry_payload_digest',
  ]) {
    requireDigest(compilation[key], `Filter compilation ${key}`, code);
  }
  requireText(
    compilation.understood_legal_question_label,
    'Filter compilation understood legal question label',
    code,
  );
  const clauses = requireArray(
    compilation.clauses,
    'Filter compilation clauses',
    code,
    MAX_FILTERS,
  );
  clauses.forEach((clause, index) => {
    const label = `Filter compilation clause ${index}`;
    requireExactKeys(clause, [
      'field_key',
      'field_version',
      'machine_operator',
      'machine_value',
      'practitioner_operator',
      'selected_values',
      'option_set_id',
      'field_scope',
      'multiplicity',
      'completeness_semantics',
      'role_label',
      'correlation_contract',
      'sentence_label',
      'sentence_clause',
    ], label, code);
    requireText(clause.field_key, `${label} field_key`, code);
    requirePositiveInteger(
      clause.field_version,
      `${label} field_version`,
      code,
    );
    requireText(clause.machine_operator, `${label} machine_operator`, code);
    clone(clause.machine_value, code);
    requireText(
      clause.practitioner_operator,
      `${label} practitioner_operator`,
      code,
    );
    const selectedValues = requireArray(
      clause.selected_values,
      `${label} selected_values`,
      code,
      MAX_OPTIONS,
    );
    selectedValues.forEach((value, valueIndex) => validateLiteral(
      value,
      `${label} selected value ${valueIndex}`,
      code,
    ));
    if (clause.option_set_id !== null) {
      requireDigest(clause.option_set_id, `${label} option_set_id`, code);
    }
    requireText(clause.field_scope, `${label} field_scope`, code);
    requireText(clause.multiplicity, `${label} multiplicity`, code);
    requireText(
      clause.completeness_semantics,
      `${label} completeness_semantics`,
      code,
    );
    if (clause.role_label !== null) {
      requireText(clause.role_label, `${label} role_label`, code);
    }
    if (!CORRELATION_CONTRACTS.includes(clause.correlation_contract)) {
      fail(code, `${label} correlation_contract is not registered.`);
    }
    requireText(clause.sentence_label, `${label} sentence_label`, code);
    requireText(clause.sentence_clause, `${label} sentence_clause`, code);
    const expectedClause = compileSentenceClause(
      { sentence_label: clause.sentence_label },
      { practitioner_operator: clause.practitioner_operator },
      clause.selected_values,
    );
    if (clause.sentence_clause !== expectedClause) {
      fail(code, `${label} sentence does not match its selected values.`);
    }
  });
  requireUnique(clauses, 'Filter compilation clauses', fieldIdentity, code);
  requireSorted(clauses, 'Filter compilation clauses', fieldIdentity, code);
  requireExactKeys(compilation.active_filter_sentence, [
    'text',
    'clause_count',
  ], 'Active filter sentence', code);
  requireText(
    compilation.active_filter_sentence.text,
    'Active filter sentence text',
    code,
  );
  requireNonNegativeInteger(
    compilation.active_filter_sentence.clause_count,
    'Active filter sentence clause_count',
    code,
  );
  if (
    compilation.active_filter_sentence.clause_count !== clauses.length
  ) {
    fail(code, 'The active filter sentence count does not match its clauses.');
  }
  const expectedSentence = `${
    [
      compilation.understood_legal_question_label,
      ...clauses.map((clause) => clause.sentence_clause),
    ].join(', ')
  }.`;
  if (compilation.active_filter_sentence.text !== expectedSentence) {
    fail(code, 'The active filter sentence does not match its clauses.');
  }
  const body = { ...compilation };
  delete body.compilation_id;
  const expectedId = contentId(PROCESS_FILTER_COMPILATION_SCHEMA, body);
  if (compilation.compilation_id !== expectedId) {
    fail(code, 'The Process filter compilation identity does not match its contents.');
  }
  return compilation;
}

function compileProcessFilters({
  product_field_catalogue: productFieldCatalogue,
  presentation_registry: presentationRegistry,
  registry_admission: registryAdmission,
  query_context: queryContext,
  filter_requests: filterRequests,
  value_option_sets: valueOptionSets,
}) {
  const validated = validateCompilerInputs({
    product_field_catalogue: productFieldCatalogue,
    presentation_registry: presentationRegistry,
    registry_admission: registryAdmission,
    query_context: queryContext,
  });
  const optionSets = requireArray(
    valueOptionSets,
    'Process filter value option sets',
    'INVALID_PROCESS_FILTER_VALUE_OPTION_SET',
    MAX_FILTERS,
  ).map((optionSet, index) => validateValueOptionSet(
    optionSet,
    index,
    validated.query,
    validated.catalogue,
  ));
  requireUnique(
    optionSets,
    'Process filter value option sets',
    (entry) => fieldIdentity(entry.value),
    'INVALID_PROCESS_FILTER_VALUE_OPTION_SET',
  );
  const optionSetByField = new Map(optionSets.map((entry) => [
    fieldIdentity(entry.value),
    entry,
  ]));
  const clauses = validateFilterRequests(
    filterRequests,
    validated,
    optionSetByField,
  );
  const sentenceParts = [
    queryContext.understood_legal_question_label,
    ...clauses.map((clause) => clause.sentence_clause),
  ];
  const body = {
    schema_version: PROCESS_FILTER_COMPILATION_SCHEMA,
    query_context_id: validated.query.query_context_id,
    approved_pm_data_version_id: queryContext.approved_pm_data_version_id,
    product_field_catalogue_manifest_id:
      productFieldCatalogue.manifest_id,
    presentation_registry_payload_digest:
      presentationRegistry.canonical_payload_digest,
    understood_legal_question_label:
      queryContext.understood_legal_question_label,
    clauses,
    active_filter_sentence: {
      text: `${sentenceParts.join(', ')}.`,
      clause_count: clauses.length,
    },
  };
  const compilation = {
    ...body,
    compilation_id: contentId(PROCESS_FILTER_COMPILATION_SCHEMA, body),
  };
  validateProcessFilterCompilation(compilation);
  return deepFreeze(clone(compilation));
}

function processFilterQueryClauses(compilation) {
  validateProcessFilterCompilation(compilation);
  return deepFreeze(compilation.clauses.map((clause) => ({
    field_key: clause.field_key,
    field_version: clause.field_version,
    operator: clause.machine_operator,
    value: clone(clause.machine_value),
  })));
}

module.exports = {
  PROCESS_FILTER_COMPILATION_SCHEMA,
  PROCESS_FILTER_PRESENTATION_REGISTRY_ADMISSION_SCHEMA,
  PROCESS_FILTER_PRESENTATION_REGISTRY_SCHEMA,
  PROCESS_FILTER_VALUE_OPTION_SET_SCHEMA,
  ProcessFilterCompilerError,
  compileProcessFilters,
  listProcessFilterFields,
  listProcessFilterValueOptions,
  normalizeProcessFilterSearch,
  presentationRegistryPayloadDigest,
  processFilterQueryClauses,
  queryContextId,
  validateProcessFilterCompilation,
  valueOptionId,
};
