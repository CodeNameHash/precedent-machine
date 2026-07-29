const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const PRODUCT_FIELD_SOURCE_REGISTRY_SCHEMA =
  'PRODUCT_FIELD_SOURCE_REGISTRY/V1';
const PRODUCT_FIELD_RELEASE_ADMISSION_SCHEMA =
  'PRODUCT_FIELD_RELEASE_ADMISSION/V1';
const PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA =
  'PRODUCT_FIELD_CATALOGUE_MANIFEST/V1';
const PRODUCT_FIELD_CATALOGUE_STABLE_ID = 'PRODUCT_FIELD_CATALOGUE';
const PRODUCT_FIELD_CATALOGUE_PAYLOAD_DOMAIN =
  'PRODUCT_FIELD_CATALOGUE_MANIFEST_PAYLOAD/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_SOURCE_BINDINGS = 64;
const MAX_FIELD_GROUPS = 64;
const MAX_FIELD_DEFINITIONS = 8192;
const MAX_FIELD_OPERATORS = 32;
const MAX_RESULT_DEFINITIONS = 256;
const CURRENT_PM_BASELINE_FIELD_KEYS = Object.freeze([
  'deal',
  'signed',
  'buyer',
  'value',
  'type',
  'structure',
  'buyer_type',
  'sector',
  'law_firm',
  'lawyer',
  'law_firm_buyer',
  'law_firm_target',
  'lawyers_buyer',
  'lawyers_target',
  'merger_form',
]);
const CAPABILITY_KEYS = Object.freeze([
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
const SOURCE_BINDING_KEYS = Object.freeze([
  'source_stable_id',
  'source_schema_version',
  'source_field_key',
  'source_field_version',
]);
const SOURCE_FIELD_KEYS = Object.freeze([
  'field_key',
  'field_version',
  'label',
  'field_group',
  'value_type',
  'control_type',
  'supported_domains',
  'source_permitted_result_definitions',
  'capabilities',
  'permitted_operators',
  'filter_scope',
  'multiplicity',
  'completeness_semantics',
  'source_requirement',
  'derivation_requirement',
  'unavailable_reason',
  'value_vocabulary_required',
  'source_binding',
]);
const MANIFEST_FIELD_KEYS = Object.freeze([
  'field_definition_id',
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
  'value_vocabulary',
  'filter_scope',
  'multiplicity',
  'completeness_semantics',
  'source_requirement',
  'derivation_requirement',
  'unavailable_reason',
  'source_binding',
  'certification_identity',
]);

class ProductFieldCatalogueError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductFieldCatalogueError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductFieldCatalogueError(code, message, details);
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

function clone(value, code = 'INVALID_PRODUCT_FIELD_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The field catalogue input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function identityKey(field) {
  return `${field.field_key}\0${field.field_version}`;
}

function sourceBindingKey(binding) {
  return [
    binding.source_stable_id,
    binding.source_schema_version,
    binding.source_field_key,
    binding.source_field_version,
  ].join('\0');
}

function sourceCatalogueKey(binding) {
  return `${binding.source_stable_id}\0${binding.source_schema_version}`;
}

function compareBy(selector) {
  return (left, right) => {
    const leftKey = selector(left);
    const rightKey = selector(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  };
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
    maximum = MAX_RESULT_DEFINITIONS,
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
  requireSorted(values, label, String, code);
  return values;
}

function validateCapabilities(value, label, code) {
  requireExactKeys(value, CAPABILITY_KEYS, label, code);
  CAPABILITY_KEYS.forEach((key) => requireBoolean(
    value[key],
    `${label} ${key}`,
    code,
  ));
  return value;
}

function validateIdentity(value, label, code) {
  requireExactKeys(value, IDENTITY_KEYS, label, code);
  requireText(value.stable_id, `${label} stable_id`, code);
  requirePositiveInteger(value.version, `${label} version`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  return value;
}

function validateSourceBinding(value, label, code) {
  requireExactKeys(value, SOURCE_BINDING_KEYS, label, code);
  requireText(value.source_stable_id, `${label} source_stable_id`, code);
  requireText(
    value.source_schema_version,
    `${label} source_schema_version`,
    code,
  );
  requireText(value.source_field_key, `${label} source_field_key`, code);
  requirePositiveInteger(
    value.source_field_version,
    `${label} source_field_version`,
    code,
  );
  return value;
}

function sourceRegistryPayloadDigest(sourceRegistry) {
  requireObject(
    sourceRegistry,
    'Product field source registry',
    'INVALID_PRODUCT_FIELD_SOURCE_REGISTRY',
  );
  const body = { ...sourceRegistry };
  delete body.canonical_payload_digest;
  return sha256Hex(Buffer.from(canonicalJson(body), 'utf8'));
}

function validateSourceField(value, index, groupKeys, sourceKeys) {
  const code = 'INVALID_PRODUCT_FIELD_SOURCE_REGISTRY';
  const label = `Source field ${index}`;
  requireExactKeys(value, SOURCE_FIELD_KEYS, label, code);
  requireText(value.field_key, `${label} field_key`, code);
  requirePositiveInteger(value.field_version, `${label} field_version`, code);
  requireText(value.label, `${label} label`, code);
  requireText(value.field_group, `${label} field_group`, code);
  if (!groupKeys.has(value.field_group)) {
    fail(code, `${label} uses an unknown field group.`);
  }
  requireText(value.value_type, `${label} value_type`, code);
  requireText(value.control_type, `${label} control_type`, code);
  validateTextSet(value.supported_domains, `${label} supported_domains`, code, {
    maximum: MAX_FIELD_GROUPS,
  });
  validateTextSet(
    value.source_permitted_result_definitions,
    `${label} source_permitted_result_definitions`,
    code,
    {
      allowEmpty: true,
    },
  );
  validateCapabilities(value.capabilities, `${label} capabilities`, code);
  validateTextSet(
    value.permitted_operators,
    `${label} permitted_operators`,
    code,
    {
      allowEmpty: true,
      maximum: MAX_FIELD_OPERATORS,
    },
  );
  if (
    value.capabilities.filter === true
    && value.permitted_operators.length === 0
  ) {
    fail(code, `${label} is filterable but has no operator.`);
  }
  if (
    value.capabilities.filter === false
    && value.permitted_operators.length !== 0
  ) {
    fail(code, `${label} has filter operators without filter capability.`);
  }
  requireText(value.filter_scope, `${label} filter_scope`, code);
  requireText(value.multiplicity, `${label} multiplicity`, code);
  requireText(
    value.completeness_semantics,
    `${label} completeness_semantics`,
    code,
  );
  requireText(value.source_requirement, `${label} source_requirement`, code);
  requireText(
    value.derivation_requirement,
    `${label} derivation_requirement`,
    code,
  );
  requireText(value.unavailable_reason, `${label} unavailable_reason`, code);
  requireBoolean(
    value.value_vocabulary_required,
    `${label} value_vocabulary_required`,
    code,
  );
  validateSourceBinding(value.source_binding, `${label} source_binding`, code);
  if (
    value.source_binding.source_field_key !== value.field_key
    || value.source_binding.source_field_version !== value.field_version
  ) {
    fail(code, `${label} changes the governed source field identity.`);
  }
  if (!sourceKeys.has(sourceCatalogueKey(value.source_binding))) {
    fail(code, `${label} has no source catalogue binding.`);
  }
  return value;
}

function validateSourceRegistry(sourceRegistry) {
  const code = 'INVALID_PRODUCT_FIELD_SOURCE_REGISTRY';
  requireExactKeys(sourceRegistry, [
    'schema_version',
    'stable_id',
    'registry_version',
    'approved_pm_data_version_id',
    'source_bindings',
    'field_groups',
    'field_definitions',
    'source_exclusions',
    'current_pm_baseline_field_keys',
    'enumeration_certification',
    'canonical_payload_digest',
  ], 'Product field source registry', code);
  if (
    sourceRegistry.schema_version !== PRODUCT_FIELD_SOURCE_REGISTRY_SCHEMA
    || sourceRegistry.stable_id !== 'PRODUCT_FIELD_SOURCE_REGISTRY'
  ) {
    fail(code, 'The Product field source registry identity is not supported.');
  }
  requirePositiveInteger(
    sourceRegistry.registry_version,
    'Product field source registry registry_version',
    code,
  );
  requireDigest(
    sourceRegistry.approved_pm_data_version_id,
    'Product field source registry approved_pm_data_version_id',
    code,
  );

  const sourceBindings = requireArray(
    sourceRegistry.source_bindings,
    'Product field source bindings',
    code,
    MAX_SOURCE_BINDINGS,
  );
  if (sourceBindings.length === 0) {
    fail(code, 'The Product field source registry has no source binding.');
  }
  sourceBindings.forEach((binding, index) => {
    const label = `Product field source binding ${index}`;
    requireExactKeys(binding, [
      'source_stable_id',
      'source_schema_version',
      'source_payload_digest',
      'source_field_count',
    ], label, code);
    requireText(binding.source_stable_id, `${label} source_stable_id`, code);
    requireText(
      binding.source_schema_version,
      `${label} source_schema_version`,
      code,
    );
    requireDigest(
      binding.source_payload_digest,
      `${label} source_payload_digest`,
      code,
    );
    requirePositiveInteger(
      binding.source_field_count,
      `${label} source_field_count`,
      code,
    );
  });
  requireUnique(
    sourceBindings,
    'Product field source bindings',
    sourceCatalogueKey,
    code,
  );
  requireSorted(
    sourceBindings,
    'Product field source bindings',
    sourceCatalogueKey,
    code,
  );
  const sourceKeys = new Set(sourceBindings.map(sourceCatalogueKey));

  const fieldGroups = requireArray(
    sourceRegistry.field_groups,
    'Product field groups',
    code,
    MAX_FIELD_GROUPS,
  );
  if (fieldGroups.length === 0) {
    fail(code, 'The Product field source registry has no field group.');
  }
  fieldGroups.forEach((group, index) => {
    const label = `Product field group ${index}`;
    requireExactKeys(group, [
      'field_group_key',
      'label',
      'sort_ordinal',
    ], label, code);
    requireText(group.field_group_key, `${label} field_group_key`, code);
    requireText(group.label, `${label} label`, code);
    requirePositiveInteger(group.sort_ordinal, `${label} sort_ordinal`, code);
    if (group.sort_ordinal !== index + 1) {
      fail(code, 'Product field group ordinals must be contiguous.');
    }
  });
  requireUnique(
    fieldGroups,
    'Product field groups',
    (group) => group.field_group_key,
    code,
  );
  const groupKeys = new Set(fieldGroups.map((group) => group.field_group_key));

  const fields = requireArray(
    sourceRegistry.field_definitions,
    'Product source field definitions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  if (fields.length === 0) {
    fail(code, 'The Product field source registry has no eligible field.');
  }
  fields.forEach((field, index) => validateSourceField(
    field,
    index,
    groupKeys,
    sourceKeys,
  ));
  requireUnique(fields, 'Product source field definitions', identityKey, code);
  requireUnique(
    fields,
    'Product source field keys',
    (field) => field.field_key,
    code,
  );
  requireUnique(
    fields,
    'Product source field bindings',
    (field) => sourceBindingKey(field.source_binding),
    code,
  );
  requireSorted(fields, 'Product source field definitions', identityKey, code);

  const sourceExclusions = requireArray(
    sourceRegistry.source_exclusions,
    'Product source field exclusions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  sourceExclusions.forEach((exclusion, index) => {
    const label = `Product source field exclusion ${index}`;
    requireExactKeys(exclusion, [
      'source_binding',
      'reason_code',
      'evidence_identity',
    ], label, code);
    validateSourceBinding(exclusion.source_binding, `${label} source_binding`, code);
    requireText(exclusion.reason_code, `${label} reason_code`, code);
    validateIdentity(
      exclusion.evidence_identity,
      `${label} evidence_identity`,
      code,
    );
    if (!sourceKeys.has(sourceCatalogueKey(exclusion.source_binding))) {
      fail(code, `${label} has no source catalogue binding.`);
    }
  });
  requireUnique(
    sourceExclusions,
    'Product source field exclusions',
    (entry) => sourceBindingKey(entry.source_binding),
    code,
  );
  requireSorted(
    sourceExclusions,
    'Product source field exclusions',
    (entry) => sourceBindingKey(entry.source_binding),
    code,
  );
  const activeSourceBindings = new Set(
    fields.map((field) => sourceBindingKey(field.source_binding)),
  );
  for (const exclusion of sourceExclusions) {
    if (activeSourceBindings.has(sourceBindingKey(exclusion.source_binding))) {
      fail(code, 'A source field is both eligible and excluded.');
    }
  }
  for (const source of sourceBindings) {
    const sourceKey = sourceCatalogueKey(source);
    const observedCount = fields.filter(
      (field) => sourceCatalogueKey(field.source_binding) === sourceKey,
    ).length + sourceExclusions.filter(
      (entry) => sourceCatalogueKey(entry.source_binding) === sourceKey,
    ).length;
    if (observedCount !== source.source_field_count) {
      fail(code, 'A source catalogue field count does not reconcile.', {
        source_stable_id: source.source_stable_id,
        expected: source.source_field_count,
        actual: observedCount,
      });
    }
  }

  if (
    canonicalJson(sourceRegistry.current_pm_baseline_field_keys)
      !== canonicalJson(CURRENT_PM_BASELINE_FIELD_KEYS)
  ) {
    fail(code, 'The source registry does not bind all 15 current PM fields.');
  }
  const fieldKeys = new Set(fields.map((field) => field.field_key));
  const missingBaseline = CURRENT_PM_BASELINE_FIELD_KEYS.filter(
    (fieldKey) => !fieldKeys.has(fieldKey),
  );
  if (missingBaseline.length > 0) {
    fail(code, 'A current PM field is absent from the eligible source set.', {
      missing_field_keys: missingBaseline,
    });
  }

  requireExactKeys(sourceRegistry.enumeration_certification, [
    'independent_enumeration_id',
    'inclusion_exclusion_reconciliation_id',
  ], 'Product field enumeration certification', code);
  requireDigest(
    sourceRegistry.enumeration_certification.independent_enumeration_id,
    'Product field independent_enumeration_id',
    code,
  );
  requireDigest(
    sourceRegistry.enumeration_certification
      .inclusion_exclusion_reconciliation_id,
    'Product field inclusion_exclusion_reconciliation_id',
    code,
  );
  requireDigest(
    sourceRegistry.canonical_payload_digest,
    'Product field source registry canonical_payload_digest',
    code,
  );
  const actualDigest = sourceRegistryPayloadDigest(sourceRegistry);
  if (actualDigest !== sourceRegistry.canonical_payload_digest) {
    fail(code, 'The Product field source registry digest does not match.', {
      expected: sourceRegistry.canonical_payload_digest,
      actual: actualDigest,
    });
  }
  return {
    sourceBindings,
    fieldGroups,
    fields,
    sourceExclusions,
  };
}

function validateRegistryAdmission(value, sourceRegistry, code) {
  requireExactKeys(value, [
    'stable_id',
    'registry_version',
    'approved_pm_data_version_id',
    'canonical_payload_digest',
    'enumeration_certification',
  ], 'Product field source registry admission', code);
  requireText(value.stable_id, 'Source registry admission stable_id', code);
  requirePositiveInteger(
    value.registry_version,
    'Source registry admission registry_version',
    code,
  );
  requireDigest(
    value.approved_pm_data_version_id,
    'Source registry admission approved_pm_data_version_id',
    code,
  );
  requireDigest(
    value.canonical_payload_digest,
    'Source registry admission canonical_payload_digest',
    code,
  );
  requireExactKeys(value.enumeration_certification, [
    'independent_enumeration_id',
    'inclusion_exclusion_reconciliation_id',
  ], 'Source registry admission enumeration certification', code);
  Object.entries(value.enumeration_certification).forEach(([key, digest]) => (
    requireDigest(digest, `Source registry admission ${key}`, code)
  ));
  const expected = {
    stable_id: sourceRegistry.stable_id,
    registry_version: sourceRegistry.registry_version,
    approved_pm_data_version_id:
      sourceRegistry.approved_pm_data_version_id,
    canonical_payload_digest: sourceRegistry.canonical_payload_digest,
    enumeration_certification:
      sourceRegistry.enumeration_certification,
  };
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, 'The Product field source registry is not the checked admission.');
  }
}

function validateValueVocabulary(value, label, code) {
  if (value === null) return null;
  return validateIdentity(value, label, code);
}

function isSubset(values, allowed) {
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

function validateFieldAdmission(
  admission,
  index,
  sourceField,
) {
  const code = 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION';
  const label = `Product field release admission ${index}`;
  requireExactKeys(admission, [
    'field_key',
    'field_version',
    'supported_domains',
    'permitted_result_definitions',
    'capabilities',
    'permitted_operators',
    'value_vocabulary',
    'certification_identity',
  ], label, code);
  requireText(admission.field_key, `${label} field_key`, code);
  requirePositiveInteger(admission.field_version, `${label} field_version`, code);
  if (!sourceField) {
    fail(code, `${label} does not resolve to an eligible source field.`);
  }
  validateTextSet(
    admission.supported_domains,
    `${label} supported_domains`,
    code,
    {
      maximum: MAX_FIELD_GROUPS,
    },
  );
  if (!isSubset(admission.supported_domains, sourceField.supported_domains)) {
    fail(code, `${label} expands the source field domain.`);
  }
  validateTextSet(
    admission.permitted_result_definitions,
    `${label} permitted_result_definitions`,
    code,
  );
  if (
    sourceField.source_permitted_result_definitions.length > 0
    && !isSubset(
      admission.permitted_result_definitions,
      sourceField.source_permitted_result_definitions,
    )
  ) {
    fail(code, `${label} expands the source result definition set.`);
  }
  validateCapabilities(admission.capabilities, `${label} capabilities`, code);
  for (const capability of CAPABILITY_KEYS) {
    if (
      admission.capabilities[capability] === true
      && sourceField.capabilities[capability] !== true
    ) {
      fail(code, `${label} adds a capability not present in the source field.`);
    }
  }
  validateTextSet(
    admission.permitted_operators,
    `${label} permitted_operators`,
    code,
    {
      allowEmpty: true,
      maximum: MAX_FIELD_OPERATORS,
    },
  );
  if (!isSubset(
    admission.permitted_operators,
    sourceField.permitted_operators,
  )) {
    fail(code, `${label} adds an operator not present in the source field.`);
  }
  if (
    admission.capabilities.filter === true
    && admission.permitted_operators.length === 0
  ) {
    fail(code, `${label} is filterable but has no admitted operator.`);
  }
  if (
    admission.capabilities.filter === false
    && admission.permitted_operators.length !== 0
  ) {
    fail(code, `${label} admits operators for a non-filterable field.`);
  }
  validateValueVocabulary(
    admission.value_vocabulary,
    `${label} value_vocabulary`,
    code,
  );
  if (
    sourceField.value_vocabulary_required === true
    && admission.value_vocabulary === null
  ) {
    fail(code, `${label} omits its required value vocabulary.`);
  }
  if (
    sourceField.value_vocabulary_required === false
    && admission.value_vocabulary !== null
  ) {
    fail(code, `${label} invents a value vocabulary.`);
  }
  validateIdentity(
    admission.certification_identity,
    `${label} certification_identity`,
    code,
  );
}

function validateReleaseAdmission(releaseAdmission, sourceRegistry, source) {
  const code = 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION';
  requireExactKeys(releaseAdmission, [
    'schema_version',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_registry_admission',
    'catalogue_generator_identity',
    'shared_deal_fact_specification_identity',
    'process_specification_identity',
    'field_admissions',
    'field_exclusions',
    'previous_catalogue_identity',
  ], 'Product field release admission', code);
  if (
    releaseAdmission.schema_version
      !== PRODUCT_FIELD_RELEASE_ADMISSION_SCHEMA
  ) {
    fail(code, 'The Product field release admission schema is not supported.');
  }
  requireDigest(
    releaseAdmission.approved_pm_data_version_id,
    'Product field release approved_pm_data_version_id',
    code,
  );
  if (
    releaseAdmission.approved_pm_data_version_id
      !== sourceRegistry.approved_pm_data_version_id
  ) {
    fail(code, 'The release admission and source registry use different PM data versions.');
  }
  requireDigest(
    releaseAdmission.candidate_release_manifest_id,
    'Product field candidate_release_manifest_id',
    code,
  );
  requireDigest(
    releaseAdmission.candidate_release_manifest_payload_digest,
    'Product field candidate_release_manifest_payload_digest',
    code,
  );
  validateRegistryAdmission(
    releaseAdmission.source_registry_admission,
    sourceRegistry,
    code,
  );
  validateIdentity(
    releaseAdmission.catalogue_generator_identity,
    'Product field catalogue_generator_identity',
    code,
  );
  validateIdentity(
    releaseAdmission.shared_deal_fact_specification_identity,
    'Product field shared_deal_fact_specification_identity',
    code,
  );
  validateIdentity(
    releaseAdmission.process_specification_identity,
    'Product field process_specification_identity',
    code,
  );
  if (releaseAdmission.previous_catalogue_identity !== null) {
    requireExactKeys(releaseAdmission.previous_catalogue_identity, [
      'manifest_id',
      'payload_digest',
    ], 'Previous Product field catalogue identity', code);
    requireDigest(
      releaseAdmission.previous_catalogue_identity.manifest_id,
      'Previous Product field manifest_id',
      code,
    );
    requireDigest(
      releaseAdmission.previous_catalogue_identity.payload_digest,
      'Previous Product field payload_digest',
      code,
    );
  }

  const sourceByIdentity = new Map(source.fields.map((field) => [
    identityKey(field),
    field,
  ]));
  const fieldAdmissions = requireArray(
    releaseAdmission.field_admissions,
    'Product field release admissions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  fieldAdmissions.forEach((admission, index) => {
    requireObject(
      admission,
      `Product field release admission ${index}`,
      code,
    );
    validateFieldAdmission(
      admission,
      index,
      sourceByIdentity.get(identityKey(admission)),
    );
  });
  requireUnique(
    fieldAdmissions,
    'Product field release admissions',
    identityKey,
    code,
  );
  requireSorted(
    fieldAdmissions,
    'Product field release admissions',
    identityKey,
    code,
  );

  const fieldExclusions = requireArray(
    releaseAdmission.field_exclusions,
    'Product field release exclusions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  fieldExclusions.forEach((exclusion, index) => {
    const label = `Product field release exclusion ${index}`;
    requireExactKeys(exclusion, [
      'field_key',
      'field_version',
      'reason_code',
      'evidence_identity',
    ], label, code);
    requireText(exclusion.field_key, `${label} field_key`, code);
    requirePositiveInteger(exclusion.field_version, `${label} field_version`, code);
    requireText(exclusion.reason_code, `${label} reason_code`, code);
    validateIdentity(
      exclusion.evidence_identity,
      `${label} evidence_identity`,
      code,
    );
    if (!sourceByIdentity.has(identityKey(exclusion))) {
      fail(code, `${label} does not resolve to an eligible source field.`);
    }
  });
  requireUnique(
    fieldExclusions,
    'Product field release exclusions',
    identityKey,
    code,
  );
  requireSorted(
    fieldExclusions,
    'Product field release exclusions',
    identityKey,
    code,
  );

  const admittedKeys = new Set(fieldAdmissions.map(identityKey));
  const excludedKeys = new Set(fieldExclusions.map(identityKey));
  const overlap = [...admittedKeys].filter((key) => excludedKeys.has(key));
  if (overlap.length > 0) {
    fail(code, 'A Product field is both admitted and excluded.', {
      field_identities: overlap,
    });
  }
  const unresolved = source.fields
    .map(identityKey)
    .filter((key) => !admittedKeys.has(key) && !excludedKeys.has(key));
  if (unresolved.length > 0) {
    fail(code, 'An eligible source field silently disappeared.', {
      field_identities: unresolved,
    });
  }
  const baselineAdmissions = new Set(fieldAdmissions.map(
    (field) => field.field_key,
  ));
  const missingBaseline = CURRENT_PM_BASELINE_FIELD_KEYS.filter(
    (fieldKey) => !baselineAdmissions.has(fieldKey),
  );
  if (missingBaseline.length > 0) {
    fail(code, 'A current PM field is not admitted to the Product catalogue.', {
      missing_field_keys: missingBaseline,
    });
  }
  return {
    sourceByIdentity,
    fieldAdmissions,
    fieldExclusions,
  };
}

function fieldDefinitionId(field) {
  return contentId('PRODUCT_FIELD_DEFINITION/V1', field);
}

function compileManifestField(sourceField, admission) {
  const body = {
    field_key: sourceField.field_key,
    field_version: sourceField.field_version,
    label: sourceField.label,
    field_group: sourceField.field_group,
    value_type: sourceField.value_type,
    control_type: sourceField.control_type,
    supported_domains: clone(admission.supported_domains),
    permitted_result_definitions: clone(
      admission.permitted_result_definitions,
    ),
    capabilities: clone(admission.capabilities),
    permitted_operators: clone(admission.permitted_operators),
    value_vocabulary: clone(admission.value_vocabulary),
    filter_scope: sourceField.filter_scope,
    multiplicity: sourceField.multiplicity,
    completeness_semantics: sourceField.completeness_semantics,
    source_requirement: sourceField.source_requirement,
    derivation_requirement: sourceField.derivation_requirement,
    unavailable_reason: sourceField.unavailable_reason,
    source_binding: clone(sourceField.source_binding),
    certification_identity: clone(admission.certification_identity),
  };
  return {
    field_definition_id: fieldDefinitionId(body),
    ...body,
  };
}

function manifestIdentityBody(manifest) {
  const body = { ...manifest };
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  return body;
}

function productFieldCataloguePayloadDigest(manifest) {
  requireObject(
    manifest,
    'Product field catalogue manifest',
    'INVALID_PRODUCT_FIELD_CATALOGUE_MANIFEST',
  );
  return contentId(
    PRODUCT_FIELD_CATALOGUE_PAYLOAD_DOMAIN,
    manifestIdentityBody(manifest),
  );
}

function compileDifference(previousManifest, fields) {
  const currentByKey = new Map(fields.map((field) => [
    field.field_key,
    field,
  ]));
  const previousFields = previousManifest?.field_definitions || [];
  const previousByKey = new Map(previousFields.map((field) => [
    field.field_key,
    field,
  ]));
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const field of fields) {
    const previous = previousByKey.get(field.field_key);
    if (!previous) {
      added.push(field.field_definition_id);
    } else if (previous.field_version === field.field_version) {
      if (previous.field_definition_id !== field.field_definition_id) {
        fail(
          'PRODUCT_FIELD_VERSION_NOT_BUMPED',
          'A Product field meaning changed without a field-version change.',
          { field_key: field.field_key },
        );
      }
      unchanged.push(field.field_definition_id);
    } else {
      if (field.field_version < previous.field_version) {
        fail(
          'PRODUCT_FIELD_VERSION_NOT_FORWARD',
          'A Product field version moved backwards.',
          {
            field_key: field.field_key,
            previous_version: previous.field_version,
            current_version: field.field_version,
          },
        );
      }
      changed.push({
        field_key: field.field_key,
        from_field_definition_id: previous.field_definition_id,
        to_field_definition_id: field.field_definition_id,
      });
    }
  }
  for (const field of previousFields) {
    if (!currentByKey.has(field.field_key)) {
      removed.push(field.field_definition_id);
    }
  }
  added.sort();
  removed.sort();
  unchanged.sort();
  changed.sort(compareBy((entry) => entry.field_key));
  return {
    previous_manifest_id: previousManifest?.manifest_id || null,
    added_field_definition_ids: added,
    removed_field_definition_ids: removed,
    changed_fields: changed,
    unchanged_field_definition_ids: unchanged,
  };
}

function compileReleaseExclusions(exclusions, sourceByIdentity) {
  return exclusions.map((exclusion) => {
    const sourceField = sourceByIdentity.get(identityKey(exclusion));
    return {
      field_key: exclusion.field_key,
      field_version: exclusion.field_version,
      label: sourceField.label,
      field_group: sourceField.field_group,
      source_binding: clone(sourceField.source_binding),
      reason_code: exclusion.reason_code,
      evidence_identity: clone(exclusion.evidence_identity),
    };
  });
}

function validateManifestField(field, index, code) {
  const label = `Product catalogue field ${index}`;
  requireExactKeys(field, MANIFEST_FIELD_KEYS, label, code);
  requireDigest(field.field_definition_id, `${label} field_definition_id`, code);
  requireText(field.field_key, `${label} field_key`, code);
  requirePositiveInteger(field.field_version, `${label} field_version`, code);
  requireText(field.label, `${label} label`, code);
  requireText(field.field_group, `${label} field_group`, code);
  requireText(field.value_type, `${label} value_type`, code);
  requireText(field.control_type, `${label} control_type`, code);
  validateTextSet(field.supported_domains, `${label} supported_domains`, code, {
    maximum: MAX_FIELD_GROUPS,
  });
  validateTextSet(
    field.permitted_result_definitions,
    `${label} permitted_result_definitions`,
    code,
  );
  validateCapabilities(field.capabilities, `${label} capabilities`, code);
  validateTextSet(
    field.permitted_operators,
    `${label} permitted_operators`,
    code,
    {
      allowEmpty: true,
      maximum: MAX_FIELD_OPERATORS,
    },
  );
  validateValueVocabulary(field.value_vocabulary, `${label} value_vocabulary`, code);
  if (
    field.capabilities.filter === true
    && field.permitted_operators.length === 0
  ) {
    fail(code, `${label} is filterable but has no operator.`);
  }
  if (
    field.capabilities.filter === false
    && field.permitted_operators.length !== 0
  ) {
    fail(code, `${label} has operators without filter capability.`);
  }
  requireText(field.filter_scope, `${label} filter_scope`, code);
  requireText(field.multiplicity, `${label} multiplicity`, code);
  requireText(
    field.completeness_semantics,
    `${label} completeness_semantics`,
    code,
  );
  requireText(field.source_requirement, `${label} source_requirement`, code);
  requireText(
    field.derivation_requirement,
    `${label} derivation_requirement`,
    code,
  );
  requireText(field.unavailable_reason, `${label} unavailable_reason`, code);
  validateSourceBinding(field.source_binding, `${label} source_binding`, code);
  validateIdentity(
    field.certification_identity,
    `${label} certification_identity`,
    code,
  );
  const body = { ...field };
  delete body.field_definition_id;
  if (fieldDefinitionId(body) !== field.field_definition_id) {
    fail(code, `${label} identity does not match its contents.`);
  }
}

function validateManifestBasis(basis, code) {
  requireExactKeys(basis, [
    'source_registry',
    'source_bindings',
    'catalogue_generator_identity',
    'shared_deal_fact_specification_identity',
    'process_specification_identity',
    'previous_catalogue_identity',
  ], 'Product field manifest basis', code);
  requireExactKeys(basis.source_registry, [
    'stable_id',
    'registry_version',
    'payload_digest',
    'enumeration_certification',
  ], 'Product field manifest source registry basis', code);
  if (basis.source_registry.stable_id !== 'PRODUCT_FIELD_SOURCE_REGISTRY') {
    fail(code, 'The Product field manifest uses an unknown source registry.');
  }
  requirePositiveInteger(
    basis.source_registry.registry_version,
    'Product field manifest source registry version',
    code,
  );
  requireDigest(
    basis.source_registry.payload_digest,
    'Product field manifest source registry payload_digest',
    code,
  );
  requireExactKeys(basis.source_registry.enumeration_certification, [
    'independent_enumeration_id',
    'inclusion_exclusion_reconciliation_id',
  ], 'Product field manifest enumeration certification', code);
  Object.entries(basis.source_registry.enumeration_certification)
    .forEach(([key, value]) => requireDigest(
      value,
      `Product field manifest ${key}`,
      code,
    ));

  const sourceBindings = requireArray(
    basis.source_bindings,
    'Product field manifest source bindings',
    code,
    MAX_SOURCE_BINDINGS,
  );
  sourceBindings.forEach((binding, index) => {
    const label = `Product field manifest source binding ${index}`;
    requireExactKeys(binding, [
      'source_stable_id',
      'source_schema_version',
      'source_payload_digest',
      'source_field_count',
    ], label, code);
    requireText(binding.source_stable_id, `${label} source_stable_id`, code);
    requireText(
      binding.source_schema_version,
      `${label} source_schema_version`,
      code,
    );
    requireDigest(
      binding.source_payload_digest,
      `${label} source_payload_digest`,
      code,
    );
    requirePositiveInteger(
      binding.source_field_count,
      `${label} source_field_count`,
      code,
    );
  });
  requireUnique(
    sourceBindings,
    'Product field manifest source bindings',
    sourceCatalogueKey,
    code,
  );
  requireSorted(
    sourceBindings,
    'Product field manifest source bindings',
    sourceCatalogueKey,
    code,
  );
  validateIdentity(
    basis.catalogue_generator_identity,
    'Product field manifest catalogue generator identity',
    code,
  );
  validateIdentity(
    basis.shared_deal_fact_specification_identity,
    'Product field manifest shared specification identity',
    code,
  );
  validateIdentity(
    basis.process_specification_identity,
    'Product field manifest Process specification identity',
    code,
  );
  if (basis.previous_catalogue_identity !== null) {
    requireExactKeys(basis.previous_catalogue_identity, [
      'manifest_id',
      'payload_digest',
    ], 'Product field manifest previous catalogue identity', code);
    requireDigest(
      basis.previous_catalogue_identity.manifest_id,
      'Product field manifest previous manifest_id',
      code,
    );
    requireDigest(
      basis.previous_catalogue_identity.payload_digest,
      'Product field manifest previous payload_digest',
      code,
    );
  }
}

function validateManifestGroups(groups, code) {
  requireArray(
    groups,
    'Product field manifest groups',
    code,
    MAX_FIELD_GROUPS,
  );
  if (groups.length === 0) {
    fail(code, 'The Product field manifest has no field group.');
  }
  groups.forEach((group, index) => {
    const label = `Product field manifest group ${index}`;
    requireExactKeys(group, [
      'field_group_key',
      'label',
      'sort_ordinal',
    ], label, code);
    requireText(group.field_group_key, `${label} field_group_key`, code);
    requireText(group.label, `${label} label`, code);
    requirePositiveInteger(group.sort_ordinal, `${label} sort_ordinal`, code);
    if (group.sort_ordinal !== index + 1) {
      fail(code, 'Product field manifest group ordinals are not contiguous.');
    }
  });
  requireUnique(
    groups,
    'Product field manifest groups',
    (group) => group.field_group_key,
    code,
  );
}

function validateManifestExclusions(manifest, groupKeys, code) {
  const sourceExclusions = requireArray(
    manifest.source_exclusions,
    'Product field manifest source exclusions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  sourceExclusions.forEach((exclusion, index) => {
    const label = `Product field manifest source exclusion ${index}`;
    requireExactKeys(exclusion, [
      'source_binding',
      'reason_code',
      'evidence_identity',
    ], label, code);
    validateSourceBinding(exclusion.source_binding, `${label} source_binding`, code);
    requireText(exclusion.reason_code, `${label} reason_code`, code);
    validateIdentity(
      exclusion.evidence_identity,
      `${label} evidence_identity`,
      code,
    );
  });
  requireUnique(
    sourceExclusions,
    'Product field manifest source exclusions',
    (entry) => sourceBindingKey(entry.source_binding),
    code,
  );
  requireSorted(
    sourceExclusions,
    'Product field manifest source exclusions',
    (entry) => sourceBindingKey(entry.source_binding),
    code,
  );

  const releaseExclusions = requireArray(
    manifest.release_exclusions,
    'Product field manifest release exclusions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  releaseExclusions.forEach((exclusion, index) => {
    const label = `Product field manifest release exclusion ${index}`;
    requireExactKeys(exclusion, [
      'field_key',
      'field_version',
      'label',
      'field_group',
      'source_binding',
      'reason_code',
      'evidence_identity',
    ], label, code);
    requireText(exclusion.field_key, `${label} field_key`, code);
    requirePositiveInteger(exclusion.field_version, `${label} field_version`, code);
    requireText(exclusion.label, `${label} label`, code);
    requireText(exclusion.field_group, `${label} field_group`, code);
    if (!groupKeys.has(exclusion.field_group)) {
      fail(code, `${label} uses an unknown field group.`);
    }
    validateSourceBinding(exclusion.source_binding, `${label} source_binding`, code);
    if (
      exclusion.source_binding.source_field_key !== exclusion.field_key
      || exclusion.source_binding.source_field_version
        !== exclusion.field_version
    ) {
      fail(code, `${label} changes the source field identity.`);
    }
    requireText(exclusion.reason_code, `${label} reason_code`, code);
    validateIdentity(
      exclusion.evidence_identity,
      `${label} evidence_identity`,
      code,
    );
  });
  requireUnique(
    releaseExclusions,
    'Product field manifest release exclusions',
    identityKey,
    code,
  );
  requireSorted(
    releaseExclusions,
    'Product field manifest release exclusions',
    identityKey,
    code,
  );
}

function validateManifestDifference(difference, fields, basis, code) {
  requireExactKeys(difference, [
    'previous_manifest_id',
    'added_field_definition_ids',
    'removed_field_definition_ids',
    'changed_fields',
    'unchanged_field_definition_ids',
  ], 'Product field manifest difference', code);
  if (difference.previous_manifest_id !== null) {
    requireDigest(
      difference.previous_manifest_id,
      'Product field difference previous_manifest_id',
      code,
    );
  }
  for (const key of [
    'added_field_definition_ids',
    'removed_field_definition_ids',
    'unchanged_field_definition_ids',
  ]) {
    const values = requireArray(
      difference[key],
      `Product field difference ${key}`,
      code,
      MAX_FIELD_DEFINITIONS,
    );
    values.forEach((value, index) => requireDigest(
      value,
      `Product field difference ${key}[${index}]`,
      code,
    ));
    requireUnique(values, `Product field difference ${key}`, String, code);
    requireSorted(values, `Product field difference ${key}`, String, code);
  }
  const changedFields = requireArray(
    difference.changed_fields,
    'Product field difference changed_fields',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  changedFields.forEach((change, index) => {
    const label = `Product field difference change ${index}`;
    requireExactKeys(change, [
      'field_key',
      'from_field_definition_id',
      'to_field_definition_id',
    ], label, code);
    requireText(change.field_key, `${label} field_key`, code);
    requireDigest(
      change.from_field_definition_id,
      `${label} from_field_definition_id`,
      code,
    );
    requireDigest(
      change.to_field_definition_id,
      `${label} to_field_definition_id`,
      code,
    );
  });
  requireUnique(
    changedFields,
    'Product field difference changed_fields',
    (change) => change.field_key,
    code,
  );
  requireSorted(
    changedFields,
    'Product field difference changed_fields',
    (change) => change.field_key,
    code,
  );

  const basisPreviousManifestId = basis.previous_catalogue_identity === null
    ? null
    : basis.previous_catalogue_identity.manifest_id;
  if (difference.previous_manifest_id !== basisPreviousManifestId) {
    fail(code, 'The Product field difference uses the wrong prior catalogue.');
  }
  if (difference.previous_manifest_id === null) {
    if (
      difference.removed_field_definition_ids.length !== 0
      || difference.changed_fields.length !== 0
      || difference.unchanged_field_definition_ids.length !== 0
    ) {
      fail(code, 'A first Product field catalogue contains a false prior difference.');
    }
  }
  const reportedCurrent = [
    ...difference.added_field_definition_ids,
    ...difference.unchanged_field_definition_ids,
    ...difference.changed_fields.map(
      (change) => change.to_field_definition_id,
    ),
  ].sort();
  const actualCurrent = fields.map(
    (field) => field.field_definition_id,
  ).sort();
  if (canonicalJson(reportedCurrent) !== canonicalJson(actualCurrent)) {
    fail(code, 'The Product field difference does not cover every current field.');
  }
  requireUnique(
    reportedCurrent,
    'Product field difference current identities',
    String,
    code,
  );
}

function validateProductFieldCatalogueManifest(manifest) {
  const code = 'INVALID_PRODUCT_FIELD_CATALOGUE_MANIFEST';
  requireExactKeys(manifest, [
    'schema_version',
    'stable_id',
    'manifest_version',
    'manifest_id',
    'canonical_payload_digest',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'basis',
    'field_groups',
    'field_definitions',
    'source_exclusions',
    'release_exclusions',
    'difference',
    'counts',
  ], 'Product field catalogue manifest', code);
  if (
    manifest.schema_version !== PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA
    || manifest.stable_id !== PRODUCT_FIELD_CATALOGUE_STABLE_ID
    || manifest.manifest_version !== 1
  ) {
    fail(code, 'The Product field catalogue manifest identity is not supported.');
  }
  requireDigest(manifest.manifest_id, 'Product field manifest_id', code);
  requireDigest(
    manifest.canonical_payload_digest,
    'Product field canonical_payload_digest',
    code,
  );
  requireDigest(
    manifest.approved_pm_data_version_id,
    'Product field approved_pm_data_version_id',
    code,
  );
  requireDigest(
    manifest.candidate_release_manifest_id,
    'Product field candidate_release_manifest_id',
    code,
  );
  requireDigest(
    manifest.candidate_release_manifest_payload_digest,
    'Product field candidate_release_manifest_payload_digest',
    code,
  );
  validateManifestBasis(manifest.basis, code);
  validateManifestGroups(manifest.field_groups, code);
  const groupKeys = new Set(
    manifest.field_groups.map((group) => group.field_group_key),
  );
  const fields = requireArray(
    manifest.field_definitions,
    'Product field manifest definitions',
    code,
    MAX_FIELD_DEFINITIONS,
  );
  fields.forEach((field, index) => validateManifestField(field, index, code));
  requireUnique(fields, 'Product field manifest definitions', identityKey, code);
  requireUnique(
    fields,
    'Product field manifest keys',
    (field) => field.field_key,
    code,
  );
  requireSorted(fields, 'Product field manifest definitions', identityKey, code);
  for (const field of fields) {
    if (!groupKeys.has(field.field_group)) {
      fail(code, 'A Product field uses an unknown manifest field group.');
    }
  }
  const admittedFieldKeys = new Set(fields.map((field) => field.field_key));
  const missingBaseline = CURRENT_PM_BASELINE_FIELD_KEYS.filter(
    (fieldKey) => !admittedFieldKeys.has(fieldKey),
  );
  if (missingBaseline.length > 0) {
    fail(code, 'The Product field manifest omits a current PM field.', {
      missing_field_keys: missingBaseline,
    });
  }
  validateManifestExclusions(manifest, groupKeys, code);
  validateManifestDifference(manifest.difference, fields, manifest.basis, code);
  requireExactKeys(manifest.counts, [
    'source_field_count',
    'admitted_field_count',
    'source_exclusion_count',
    'release_exclusion_count',
  ], 'Product field manifest counts', code);
  Object.entries(manifest.counts).forEach(([key, value]) => {
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(code, `Product field manifest count ${key} is invalid.`);
    }
  });
  if (
    manifest.counts.admitted_field_count !== fields.length
    || manifest.counts.source_exclusion_count
      !== manifest.source_exclusions.length
    || manifest.counts.release_exclusion_count
      !== manifest.release_exclusions.length
    || manifest.counts.source_field_count
      !== (
        fields.length
        + manifest.release_exclusions.length
        + manifest.source_exclusions.length
      )
  ) {
    fail(code, 'Product field manifest counts do not reconcile.');
  }
  const body = manifestIdentityBody(manifest);
  const expectedManifestId = contentId(
    PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA,
    body,
  );
  const expectedPayloadDigest = contentId(
    PRODUCT_FIELD_CATALOGUE_PAYLOAD_DOMAIN,
    body,
  );
  if (
    manifest.manifest_id !== expectedManifestId
    || manifest.canonical_payload_digest !== expectedPayloadDigest
  ) {
    fail(code, 'The Product field catalogue identity does not match its contents.');
  }
  return manifest;
}

function buildProductFieldCatalogueManifest({
  source_registry: sourceRegistry,
  release_admission: releaseAdmission,
  previous_manifest: previousManifest = null,
}) {
  const source = validateSourceRegistry(sourceRegistry);
  const release = validateReleaseAdmission(
    releaseAdmission,
    sourceRegistry,
    source,
  );
  if (previousManifest !== null) {
    validateProductFieldCatalogueManifest(previousManifest);
    const expectedPrevious = {
      manifest_id: previousManifest.manifest_id,
      payload_digest: previousManifest.canonical_payload_digest,
    };
    if (
      canonicalJson(releaseAdmission.previous_catalogue_identity)
        !== canonicalJson(expectedPrevious)
    ) {
      fail(
        'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
        'The previous Product catalogue does not match its release admission.',
      );
    }
  } else if (releaseAdmission.previous_catalogue_identity !== null) {
    fail(
      'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
      'A previous Product catalogue identity has no supplied manifest.',
    );
  }

  const fields = release.fieldAdmissions.map((admission) => (
    compileManifestField(
      release.sourceByIdentity.get(identityKey(admission)),
      admission,
    )
  ));
  const basis = {
    source_registry: {
      stable_id: sourceRegistry.stable_id,
      registry_version: sourceRegistry.registry_version,
      payload_digest: sourceRegistry.canonical_payload_digest,
      enumeration_certification:
        clone(sourceRegistry.enumeration_certification),
    },
    source_bindings: clone(source.sourceBindings),
    catalogue_generator_identity:
      clone(releaseAdmission.catalogue_generator_identity),
    shared_deal_fact_specification_identity:
      clone(releaseAdmission.shared_deal_fact_specification_identity),
    process_specification_identity:
      clone(releaseAdmission.process_specification_identity),
    previous_catalogue_identity:
      clone(releaseAdmission.previous_catalogue_identity),
  };
  const manifestBody = {
    schema_version: PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA,
    stable_id: PRODUCT_FIELD_CATALOGUE_STABLE_ID,
    manifest_version: 1,
    approved_pm_data_version_id:
      releaseAdmission.approved_pm_data_version_id,
    candidate_release_manifest_id:
      releaseAdmission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      releaseAdmission.candidate_release_manifest_payload_digest,
    basis,
    field_groups: clone(source.fieldGroups),
    field_definitions: fields,
    source_exclusions: clone(source.sourceExclusions),
    release_exclusions: compileReleaseExclusions(
      release.fieldExclusions,
      release.sourceByIdentity,
    ),
    difference: compileDifference(previousManifest, fields),
    counts: {
      source_field_count: (
        source.fields.length + source.sourceExclusions.length
      ),
      admitted_field_count: fields.length,
      source_exclusion_count: source.sourceExclusions.length,
      release_exclusion_count: release.fieldExclusions.length,
    },
  };
  const manifest = {
    ...manifestBody,
    manifest_id: contentId(
      PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA,
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      PRODUCT_FIELD_CATALOGUE_PAYLOAD_DOMAIN,
      manifestBody,
    ),
  };
  validateProductFieldCatalogueManifest(manifest);
  return deepFreeze(clone(manifest));
}

function productFieldCatalogueQueryAdmission(manifest) {
  validateProductFieldCatalogueManifest(manifest);
  return deepFreeze({
    stable_id: PRODUCT_FIELD_CATALOGUE_STABLE_ID,
    manifest_id: manifest.manifest_id,
    payload_digest: manifest.canonical_payload_digest,
    field_definitions: clone(manifest.field_definitions),
  });
}

module.exports = {
  CURRENT_PM_BASELINE_FIELD_KEYS,
  PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA,
  PRODUCT_FIELD_CATALOGUE_STABLE_ID,
  PRODUCT_FIELD_RELEASE_ADMISSION_SCHEMA,
  PRODUCT_FIELD_SOURCE_REGISTRY_SCHEMA,
  ProductFieldCatalogueError,
  buildProductFieldCatalogueManifest,
  productFieldCataloguePayloadDigest,
  productFieldCatalogueQueryAdmission,
  sourceRegistryPayloadDigest,
  validateProductFieldCatalogueManifest,
};
