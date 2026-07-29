const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  CURRENT_PM_BASELINE_FIELD_KEYS,
  PRODUCT_FIELD_SOURCE_REGISTRY_SCHEMA,
  sourceRegistryPayloadDigest,
} = require('./product-field-catalogue');

const PRODUCT_FIELD_SOURCE_REGISTRY_STABLE_ID =
  'PRODUCT_FIELD_SOURCE_REGISTRY';
const AGREEMENT_INVENTORY_ADMISSION_SCHEMA =
  'PRODUCT_FIELD_AGREEMENT_INVENTORY_ADMISSION/V1';
const AGREEMENT_FIELD_DECISIONS_SCHEMA =
  'PRODUCT_FIELD_AGREEMENT_FIELD_DECISIONS/V1';
const AGREEMENT_ALIAS_DECISIONS_SCHEMA =
  'PRODUCT_FIELD_AGREEMENT_ALIAS_DECISIONS/V1';
const SOURCE_CATALOGUE_ADMISSIONS_SCHEMA =
  'PRODUCT_FIELD_SOURCE_CATALOGUE_ADMISSIONS/V1';
const ADDITIONAL_SOURCE_CONTRIBUTION_SCHEMA =
  'PRODUCT_FIELD_ADDITIONAL_SOURCE_CONTRIBUTION/V1';
const AGREEMENT_INVENTORY_SOURCE_STABLE_ID =
  'CURRENT_AGREEMENT_QUERY_FIELD_INVENTORY';
const AGREEMENT_FIELD_GROUP = 'AGREEMENT_TERMS';
const AGREEMENT_INVENTORY_SCHEMA =
  'ProcessIntelligenceProductFieldSourceInventory/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const MAX_FIELDS = 8192;
const MAX_ALIASES = 65536;
const MAX_SOURCES = 64;
const MAX_GROUPS = 64;
const INCLUDE = 'INCLUDE';
const EXCLUDE = 'EXCLUDE';
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
const PRODUCT_DEFINITION_KEYS = Object.freeze([
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
]);
const SOURCE_FIELD_KEYS = Object.freeze([
  'field_key',
  'field_version',
  ...PRODUCT_DEFINITION_KEYS,
  'source_binding',
]);
const SHARED_GROUP_LABELS = Object.freeze({
  DEAL_IDENTITY: 'Deal identity',
  CHRONOLOGY: 'Deal and date',
  PARTIES: 'Parties',
  ECONOMICS: 'Consideration and value',
  TRANSACTION_STRUCTURE: 'Transaction structure',
  CLASSIFICATIONS: 'Sector and classifications',
  PROFESSIONALS: 'Law firms, lawyers and advisers',
});
const PROCESS_GROUP_LABELS = Object.freeze({
  PROCESS_EVENT: 'Process event',
  PROCESS_TIMING: 'Process timing',
  PROCESS_PARTIES_AND_TRACKS: 'Parties and bidder tracks',
  PROCESS_SOURCE_AND_CERTIFICATION: 'Source and certification',
});

class ProductFieldSourceRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductFieldSourceRegistryError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductFieldSourceRegistryError(code, message, details);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireArray(value, label, code, maximum = MAX_FIELDS) {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(code, `${label} must be an array within its governed limit.`);
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
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(value, label, code) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireCommit(value, label, code) {
  if (!COMMIT_RE.test(value || '')) {
    fail(code, `${label} must be a full lowercase Git commit.`);
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
    fail(code, `${label} must be a boolean.`);
  }
  return value;
}

function requireSortedUnique(values, label, key, code) {
  const seen = new Set();
  let previous = null;
  values.forEach((value, index) => {
    const current = key(value);
    requireText(current, `${label} key ${index}`, code);
    if (seen.has(current)) {
      fail(code, `${label} contains a duplicate.`, { duplicate_key: current });
    }
    if (previous !== null && compareText(previous, current) > 0) {
      fail(code, `${label} is not sorted.`, {
        previous_key: previous,
        current_key: current,
      });
    }
    seen.add(current);
    previous = current;
  });
}

function requireTextSet(value, label, code, { allowEmpty = false } = {}) {
  const values = requireArray(value, label, code, MAX_FIELDS);
  if (!allowEmpty && values.length === 0) {
    fail(code, `${label} must not be empty.`);
  }
  values.forEach((item, index) => requireText(item, `${label} ${index}`, code));
  requireSortedUnique(values, label, (item) => item, code);
  return values;
}

function validateIdentity(value, label, code) {
  requireExactKeys(value, IDENTITY_KEYS, label, code);
  requireText(value.stable_id, `${label} stable_id`, code);
  requirePositiveInteger(value.version, `${label} version`, code);
  requireDigest(value.payload_digest, `${label} payload_digest`, code);
  return value;
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function sourceKey(value) {
  return `${value.source_stable_id}\0${value.source_schema_version}`;
}

function fieldIdentity(value) {
  return `${value.field_key}\0${String(value.field_version).padStart(12, '0')}`;
}

function sourceFieldIdentity(value) {
  return [
    value.source_binding.source_stable_id,
    value.source_binding.source_schema_version,
    value.source_binding.source_field_key,
    String(value.source_binding.source_field_version).padStart(12, '0'),
  ].join('\0');
}

function collisionClaimIdentity(value) {
  return `${value.alias}\0${String(value.claimant_registry_index).padStart(12, '0')}`;
}

function aliasMappingIdentity(value) {
  return [
    value.provision_type,
    value.source_request_key,
    String(value.source_registry_index).padStart(12, '0'),
    value.resolved_field_key,
  ].join('\0');
}

function sourceOccurrenceIdentity(value) {
  return [
    value.provision_type,
    value.source_request_key,
    String(value.source_registry_index).padStart(12, '0'),
    value.field_key,
  ].join('\0');
}

function validateCapabilities(value, label, code) {
  requireExactKeys(value, CAPABILITY_KEYS, label, code);
  CAPABILITY_KEYS.forEach((key) => (
    requireBoolean(value[key], `${label} ${key}`, code)
  ));
  return value;
}

function validateProductDefinition(
  value,
  label,
  code,
  { allowEmptyResultDefinitions = false } = {},
) {
  requireExactKeys(value, PRODUCT_DEFINITION_KEYS, label, code);
  requireText(value.label, `${label} label`, code);
  requireText(value.field_group, `${label} field_group`, code);
  requireText(value.value_type, `${label} value_type`, code);
  requireText(value.control_type, `${label} control_type`, code);
  requireTextSet(value.supported_domains, `${label} supported_domains`, code);
  requireTextSet(
    value.source_permitted_result_definitions,
    `${label} source_permitted_result_definitions`,
    code,
    { allowEmpty: allowEmptyResultDefinitions },
  );
  validateCapabilities(value.capabilities, `${label} capabilities`, code);
  requireTextSet(
    value.permitted_operators,
    `${label} permitted_operators`,
    code,
    { allowEmpty: true },
  );
  if (value.capabilities.filter && value.permitted_operators.length === 0) {
    fail(code, `${label} is filterable but has no operator.`);
  }
  if (!value.capabilities.filter && value.permitted_operators.length > 0) {
    fail(code, `${label} has operators without filter capability.`);
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
  return value;
}

function validateAdmissionIdentity(value, label, code) {
  validateIdentity(value, label, code);
  return value;
}

function inventoryBody(inventory) {
  const body = clone(inventory);
  delete body.content_identity;
  return body;
}

function validateAgreementInventory(inventory, admission) {
  const code = 'INVALID_AGREEMENT_FIELD_INVENTORY';
  requireExactKeys(inventory, [
    'schema_version',
    'authority',
    'canonical_authority_granted',
    'source_baseline_commit',
    'source_files',
    'deals_table',
    'agreement_query_surface',
    'serving_registry',
    'source_limits',
    'successor_requirements',
    'content_identity',
  ], 'Agreement field inventory', code);
  if (
    inventory.schema_version !== AGREEMENT_INVENTORY_SCHEMA
    || inventory.authority !== 'OBSERVATIONAL_BASELINE_ONLY'
    || inventory.canonical_authority_granted !== false
  ) {
    fail(code, 'The Agreement inventory identity or authority is invalid.');
  }
  requireCommit(
    inventory.source_baseline_commit,
    'Agreement inventory source_baseline_commit',
    code,
  );
  requireExactKeys(inventory.content_identity, [
    'scheme',
    'domain',
    'content_id',
    'canonical_payload_sha256',
  ], 'Agreement inventory content identity', code);
  if (inventory.content_identity.scheme !== 'CANONICAL_CONTENT_ID/V1') {
    fail(code, 'The Agreement inventory content identity scheme is invalid.');
  }
  requireText(
    inventory.content_identity.domain,
    'Agreement inventory content identity domain',
    code,
  );
  requireDigest(
    inventory.content_identity.content_id,
    'Agreement inventory content_id',
    code,
  );
  requireDigest(
    inventory.content_identity.canonical_payload_sha256,
    'Agreement inventory canonical_payload_sha256',
    code,
  );
  const body = inventoryBody(inventory);
  const observedPayloadDigest = payloadDigest(body);
  const observedContentId = contentId(inventory.content_identity.domain, body);
  if (
    observedPayloadDigest !== inventory.content_identity.canonical_payload_sha256
    || observedContentId !== inventory.content_identity.content_id
  ) {
    fail(code, 'The Agreement inventory content identity does not match.');
  }

  requireExactKeys(admission, [
    'schema_version',
    'inventory_schema_version',
    'inventory_content_id',
    'inventory_payload_digest',
    'source_baseline_commit',
    'agreement_field_count',
    'agreement_occurrence_count',
    'registry_entry_count',
    'alias_collision_count',
    'admission_identity',
  ], 'Agreement inventory admission', code);
  if (
    admission.schema_version !== AGREEMENT_INVENTORY_ADMISSION_SCHEMA
    || admission.inventory_schema_version !== inventory.schema_version
  ) {
    fail(code, 'The Agreement inventory admission identity is invalid.');
  }
  requireDigest(admission.inventory_content_id, 'Admitted inventory content_id', code);
  requireDigest(
    admission.inventory_payload_digest,
    'Admitted inventory payload_digest',
    code,
  );
  requireCommit(
    admission.source_baseline_commit,
    'Admitted inventory source commit',
    code,
  );
  [
    'agreement_field_count',
    'agreement_occurrence_count',
    'registry_entry_count',
    'alias_collision_count',
  ].forEach((key) => requireNonNegativeInteger(
    admission[key],
    `Agreement inventory admission ${key}`,
    code,
  ));
  validateAdmissionIdentity(
    admission.admission_identity,
    'Agreement inventory admission identity',
    code,
  );
  const admissionBody = clone(admission);
  delete admissionBody.admission_identity;
  if (
    admission.admission_identity.payload_digest
      !== payloadDigest(admissionBody)
  ) {
    fail(code, 'The Agreement inventory admission identity does not bind its fields.');
  }

  const agreement = requireObject(
    inventory.agreement_query_surface,
    'Agreement query surface',
    code,
  );
  const registry = requireObject(
    inventory.serving_registry,
    'Agreement serving registry',
    code,
  );
  const fields = requireArray(
    agreement.fields,
    'Agreement query fields',
    code,
  );
  const collisions = requireArray(
    registry.alias_collisions,
    'Agreement alias collisions',
    code,
    MAX_ALIASES,
  );
  const inputs = requireArray(
    registry.inputs,
    'Agreement serving registry inputs',
    code,
    MAX_ALIASES,
  );
  const expected = {
    inventory_content_id: inventory.content_identity.content_id,
    inventory_payload_digest:
      inventory.content_identity.canonical_payload_sha256,
    source_baseline_commit: inventory.source_baseline_commit,
    agreement_field_count: fields.length,
    agreement_occurrence_count: fields.reduce(
      (total, field) => total + requireArray(
        field.source_occurrences,
        `Agreement field ${field.field_key} source occurrences`,
        code,
      ).length,
      0,
    ),
    registry_entry_count: inputs.length,
    alias_collision_count: collisions.length,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (admission[key] !== value) {
      fail(code, `The Agreement inventory admission ${key} does not match.`, {
        expected: value,
        actual: admission[key],
      });
    }
  }
  if (
    agreement.distinct_user_facing_field_count !== fields.length
    || agreement.field_occurrence_count !== expected.agreement_occurrence_count
    || registry.observed_entry_count !== inputs.length
    || registry.alias_collision_count !== collisions.length
  ) {
    fail(code, 'The Agreement inventory declared counts do not reconcile.');
  }

  const fieldKeys = new Set();
  fields.forEach((field, index) => {
    const label = `Agreement field ${index}`;
    requireText(field.field_key, `${label} field_key`, code);
    requireText(field.label, `${label} label`, code);
    requireText(field.value_type, `${label} value_type`, code);
    if (fieldKeys.has(field.field_key)) {
      fail(code, 'The Agreement inventory contains a duplicate field key.');
    }
    fieldKeys.add(field.field_key);
  });

  const inputIndexes = new Set();
  inputs.forEach((input, index) => {
    requireNonNegativeInteger(input.registry_index, `Registry input ${index} index`, code);
    if (input.registry_index !== index || inputIndexes.has(input.registry_index)) {
      fail(code, 'The Agreement registry input indexes are not exact.');
    }
    inputIndexes.add(input.registry_index);
    requireText(input.disposition, `Registry input ${index} disposition`, code);
  });
  fields.forEach((field, fieldIndex) => {
    const provisionTypes = requireArray(
      field.provision_types,
      `Agreement field ${fieldIndex} provision_types`,
      code,
    );
    if (provisionTypes.length === 0) {
      fail(code, `Agreement field ${fieldIndex} has no provision type.`);
    }
    const provisionTypeSet = new Set();
    provisionTypes.forEach((provisionType, provisionTypeIndex) => {
      requireText(
        provisionType,
        `Agreement field ${fieldIndex} provision type ${provisionTypeIndex}`,
        code,
      );
      if (provisionTypeSet.has(provisionType)) {
        fail(code, `Agreement field ${fieldIndex} has a duplicate provision type.`);
      }
      provisionTypeSet.add(provisionType);
    });
    field.source_occurrences.forEach((occurrence, occurrenceIndex) => {
      const label = `Agreement field ${fieldIndex} source occurrence ${occurrenceIndex}`;
      requireObject(occurrence, label, code);
      requireText(occurrence.provision_type, `${label} provision_type`, code);
      requireText(occurrence.source_kind, `${label} source_kind`, code);
      requireText(
        occurrence.source_request_key,
        `${label} source_request_key`,
        code,
      );
      if (!provisionTypeSet.has(occurrence.provision_type)) {
        fail(code, `${label} uses an undeclared provision type.`);
      }
      if (occurrence.source_kind === 'SERVING_REGISTRY_ENTRY') {
        requireExactKeys(occurrence, [
          'provision_type',
          'source_kind',
          'source_request_key',
          'source_registry_index',
        ], label, code);
        requireNonNegativeInteger(
          occurrence.source_registry_index,
          `${label} source_registry_index`,
          code,
        );
        if (!inputIndexes.has(occurrence.source_registry_index)) {
          fail(code, `${label} refers to an unknown serving-registry row.`);
        }
      } else if (occurrence.source_kind === 'DERIVED_QUERY_FIELD') {
        requireExactKeys(occurrence, [
          'provision_type',
          'source_kind',
          'source_request_key',
          'source_path',
        ], label, code);
        requireText(occurrence.source_path, `${label} source_path`, code);
      } else {
        fail(code, `${label} has an unknown source kind.`);
      }
    });
  });
  collisions.forEach((collision, index) => {
    requireText(collision.alias, `Alias collision ${index} alias`, code);
    const claimants = requireArray(
      collision.claimant_registry_indexes,
      `Alias collision ${index} claimants`,
      code,
      MAX_ALIASES,
    );
    if (claimants.length < 2) {
      fail(code, 'An alias collision has fewer than two claimants.');
    }
    claimants.forEach((claimant) => {
      requireNonNegativeInteger(claimant, 'Alias collision claimant', code);
      if (!inputIndexes.has(claimant)) {
        fail(code, 'An alias collision refers to an unknown registry input.');
      }
    });
  });

  return { fields, collisions, inputs };
}

function validateCatalogueAdmission(admission, label, code) {
  requireExactKeys(admission, [
    'source_stable_id',
    'source_schema_version',
    'source_payload_digest',
    'source_field_count',
    'admission_identity',
  ], label, code);
  requireText(admission.source_stable_id, `${label} source_stable_id`, code);
  requireText(
    admission.source_schema_version,
    `${label} source_schema_version`,
    code,
  );
  requireDigest(
    admission.source_payload_digest,
    `${label} source_payload_digest`,
    code,
  );
  requirePositiveInteger(
    admission.source_field_count,
    `${label} source_field_count`,
    code,
  );
  validateAdmissionIdentity(
    admission.admission_identity,
    `${label} admission_identity`,
    code,
  );
  const admissionBody = clone(admission);
  delete admissionBody.admission_identity;
  if (
    admission.admission_identity.payload_digest
      !== payloadDigest(admissionBody)
  ) {
    fail(code, `${label} admission identity does not bind its fields.`);
  }
  return admission;
}

function validateSourceCatalogueAdmissions(value) {
  const code = 'INVALID_SOURCE_CATALOGUE_ADMISSION';
  requireExactKeys(value, [
    'schema_version',
    'admissions',
  ], 'Source catalogue admissions', code);
  if (value.schema_version !== SOURCE_CATALOGUE_ADMISSIONS_SCHEMA) {
    fail(code, 'The source catalogue admissions schema is invalid.');
  }
  const admissions = requireArray(
    value.admissions,
    'Source catalogue admission entries',
    code,
    MAX_SOURCES,
  );
  admissions.forEach((admission, index) => validateCatalogueAdmission(
    admission,
    `Source catalogue admission ${index}`,
    code,
  ));
  requireSortedUnique(admissions, 'Source catalogue admissions', sourceKey, code);
  return new Map(admissions.map((admission) => [sourceKey(admission), admission]));
}

function requireCatalogueAdmission(
  admissions,
  { source_stable_id: stableId, source_schema_version: schemaVersion },
  digest,
  count,
) {
  const code = 'SOURCE_CATALOGUE_NOT_ADMITTED';
  const key = `${stableId}\0${schemaVersion}`;
  const admission = admissions.get(key);
  if (!admission) {
    fail(code, 'A source catalogue has no separate admission.', {
      source_stable_id: stableId,
      source_schema_version: schemaVersion,
    });
  }
  if (
    admission.source_payload_digest !== digest
    || admission.source_field_count !== count
  ) {
    fail(code, 'A source catalogue does not match its separate admission.', {
      source_stable_id: stableId,
      expected_payload_digest: admission.source_payload_digest,
      actual_payload_digest: digest,
      expected_field_count: admission.source_field_count,
      actual_field_count: count,
    });
  }
  return admission;
}

function sharedCompleteness(field) {
  if (field.multiplicity === 'MANY') {
    return 'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE';
  }
  return field.missing_state_behaviour;
}

function sharedSourceField(field, catalogue) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    label: field.label,
    field_group: field.field_group,
    value_type: field.value_type,
    control_type: field.control_type,
    supported_domains: [...field.permitted_domains].sort(),
    source_permitted_result_definitions: [],
    capabilities: {
      display: field.capabilities.display,
      filter: field.capabilities.filter,
      sort: field.capabilities.sort,
      group: field.capabilities.group,
      export: true,
    },
    permitted_operators: [...field.permitted_operators].sort(),
    filter_scope: field.filter_scope,
    multiplicity: field.multiplicity,
    completeness_semantics: sharedCompleteness(field),
    source_requirement: field.source_detail_action,
    derivation_requirement: 'CANONICAL_SHARED_FACT_PROJECTION_ONLY',
    unavailable_reason: field.unavailable_request_result,
    value_vocabulary_required: field.value_type === 'ENUM',
    source_binding: {
      source_stable_id: catalogue.stable_id,
      source_schema_version: catalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function processSourceField(field, catalogue) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    label: field.label,
    field_group: field.field_group,
    value_type: field.value_type,
    control_type: field.control_type,
    supported_domains: ['PROCESS'],
    source_permitted_result_definitions: [
      ...field.permitted_result_definitions,
    ].sort(),
    capabilities: {
      display: field.capabilities.display,
      filter: field.capabilities.filter,
      sort: field.capabilities.sort,
      group: field.capabilities.group,
      export: true,
    },
    permitted_operators: [...field.permitted_operators].sort(),
    filter_scope: field.filter_scope,
    multiplicity: field.multiplicity,
    completeness_semantics: field.completeness_semantics,
    source_requirement: field.source_requirement,
    derivation_requirement: field.derivation_requirement,
    unavailable_reason: field.unavailable_reason,
    value_vocabulary_required:
      typeof field.required_value_registry === 'string',
    source_binding: {
      source_stable_id: catalogue.stable_id,
      source_schema_version: catalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function validateSharedCatalogue(catalogue, admissions) {
  const code = 'INVALID_SHARED_FIELD_CATALOGUE';
  requireObject(catalogue, 'Shared field catalogue', code);
  if (
    catalogue.stable_id !== 'SHARED_DEAL_FIELD_CATALOGUE'
    || catalogue.schema_version !== 'SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT/V1'
  ) {
    fail(code, 'The Shared field catalogue identity is invalid.');
  }
  const fields = requireArray(
    catalogue.field_definitions,
    'Shared field definitions',
    code,
  );
  requireCatalogueAdmission(admissions, {
    source_stable_id: catalogue.stable_id,
    source_schema_version: catalogue.schema_version,
  }, payloadDigest(catalogue), fields.length);
  if (
    canonicalJson(catalogue.current_pm_baseline_field_keys)
      !== canonicalJson(CURRENT_PM_BASELINE_FIELD_KEYS)
  ) {
    fail(code, 'The Shared catalogue does not contain the exact 15 PM fields.');
  }
  const groups = requireArray(
    catalogue.field_groups,
    'Shared field groups',
    code,
  );
  const seenGroups = new Set();
  groups.forEach((group, index) => {
    requireText(group, `Shared field group ${index}`, code);
    if (seenGroups.has(group)) {
      fail(code, 'The Shared catalogue contains a duplicate field group.');
    }
    seenGroups.add(group);
    if (!SHARED_GROUP_LABELS[group]) {
      fail(code, 'The Shared catalogue uses an unreviewed Product field group.');
    }
  });
  const output = fields.map((field, index) => {
    requireObject(field, `Shared field ${index}`, code);
    const normalised = sharedSourceField(field, catalogue);
    validateProductDefinition(
      Object.fromEntries(PRODUCT_DEFINITION_KEYS.map((key) => [
        key,
        normalised[key],
      ])),
      `Shared field ${index}`,
      code,
      { allowEmptyResultDefinitions: true },
    );
    return {
      field: normalised,
      semantic_meaning_id: contentId('PRODUCT_FIELD_SEMANTIC_MEANING/V1', {
        source_stable_id: catalogue.stable_id,
        source_schema_version: catalogue.schema_version,
        source_field_key: field.field_key,
        source_field_version: field.field_version,
      }),
    };
  });
  return {
    binding: {
      source_stable_id: catalogue.stable_id,
      source_schema_version: catalogue.schema_version,
      source_payload_digest: payloadDigest(catalogue),
      source_field_count: fields.length,
    },
    groups: groups.map((group) => ({
      field_group_key: group,
      label: SHARED_GROUP_LABELS[group],
    })),
    records: output,
  };
}

function validateProcessCatalogue(catalogue, admissions) {
  const code = 'INVALID_PROCESS_FIELD_CATALOGUE';
  requireObject(catalogue, 'Process field catalogue', code);
  if (
    catalogue.stable_id !== 'PROCESS_FIELD_DEFINITION_CATALOGUE'
    || catalogue.schema_version !== 'PROCESS_FIELD_CATALOGUE_INPUT/V1'
  ) {
    fail(code, 'The Process field catalogue identity is invalid.');
  }
  const fields = requireArray(
    catalogue.definition?.field_definitions,
    'Process field definitions',
    code,
  );
  requireCatalogueAdmission(admissions, {
    source_stable_id: catalogue.stable_id,
    source_schema_version: catalogue.schema_version,
  }, payloadDigest(catalogue), fields.length);
  const output = fields.map((field, index) => {
    requireObject(field, `Process field ${index}`, code);
    if (!PROCESS_GROUP_LABELS[field.field_group]) {
      fail(code, 'The Process catalogue uses an unreviewed Product field group.');
    }
    const normalised = processSourceField(field, catalogue);
    validateProductDefinition(
      Object.fromEntries(PRODUCT_DEFINITION_KEYS.map((key) => [
        key,
        normalised[key],
      ])),
      `Process field ${index}`,
      code,
    );
    return {
      field: normalised,
      semantic_meaning_id: contentId('PRODUCT_FIELD_SEMANTIC_MEANING/V1', {
        source_stable_id: catalogue.stable_id,
        source_schema_version: catalogue.schema_version,
        source_field_key: field.field_key,
        source_field_version: field.field_version,
      }),
    };
  });
  const groups = [...new Set(fields.map((field) => field.field_group))].sort();
  return {
    binding: {
      source_stable_id: catalogue.stable_id,
      source_schema_version: catalogue.schema_version,
      source_payload_digest: payloadDigest(catalogue),
      source_field_count: fields.length,
    },
    groups: groups.map((group) => ({
      field_group_key: group,
      label: PROCESS_GROUP_LABELS[group],
    })),
    records: output,
  };
}

function validateAgreementFieldDecisions(value, inventoryState) {
  const code = 'INVALID_AGREEMENT_FIELD_DECISIONS';
  requireExactKeys(value, [
    'schema_version',
    'inventory_content_id',
    'decisions',
  ], 'Agreement field decisions', code);
  if (
    value.schema_version !== AGREEMENT_FIELD_DECISIONS_SCHEMA
    || value.inventory_content_id
      !== inventoryState.inventory.content_identity.content_id
  ) {
    fail(code, 'The Agreement field decisions do not bind the inventory.');
  }
  const decisions = requireArray(
    value.decisions,
    'Agreement field decision entries',
    code,
  );
  requireSortedUnique(decisions, 'Agreement field decisions', (decision) => (
    decision.field_key
  ), code);
  const sourceFields = inventoryState.fields;
  const sourceByKey = new Map(sourceFields.map((field) => [
    field.field_key,
    field,
  ]));
  if (decisions.length !== sourceFields.length) {
    fail(code, 'The Agreement field decisions do not cover every source field.');
  }
  const records = [];
  decisions.forEach((decision, index) => {
    const label = `Agreement field decision ${index}`;
    requireExactKeys(decision, [
      'field_key',
      'field_version',
      'semantic_meaning_id',
      'disposition',
      'product_definition',
      'certified_data_identity',
      'exclusion_reason_code',
      'evidence_identity',
    ], label, code);
    requireText(decision.field_key, `${label} field_key`, code);
    if (!sourceByKey.has(decision.field_key)) {
      fail(code, `${label} refers to an unknown Agreement field.`);
    }
    if (decision.field_version !== 1) {
      fail(code, `${label} must use Agreement field version 1.`);
    }
    requireDigest(
      decision.semantic_meaning_id,
      `${label} semantic_meaning_id`,
      code,
    );
    if (![INCLUDE, EXCLUDE].includes(decision.disposition)) {
      fail(code, `${label} has an invalid disposition.`);
    }
    validateIdentity(decision.evidence_identity, `${label} evidence_identity`, code);
    if (decision.disposition === INCLUDE) {
      validateProductDefinition(
        decision.product_definition,
        `${label} product_definition`,
        code,
      );
      if (decision.product_definition.field_group !== AGREEMENT_FIELD_GROUP) {
        fail(code, `${label} must use the Agreement terms field group.`);
      }
      if (
        decision.product_definition.source_permitted_result_definitions.length
          === 0
      ) {
        fail(code, `${label} has no supported result type.`);
      }
      validateIdentity(
        decision.certified_data_identity,
        `${label} certified_data_identity`,
        code,
      );
      if (decision.exclusion_reason_code !== null) {
        fail(code, `${label} is included but has an exclusion reason.`);
      }
      records.push({
        field: {
          field_key: decision.field_key,
          field_version: decision.field_version,
          ...clone(decision.product_definition),
          source_binding: {
            source_stable_id: AGREEMENT_INVENTORY_SOURCE_STABLE_ID,
            source_schema_version:
              inventoryState.inventory.schema_version,
            source_field_key: decision.field_key,
            source_field_version: decision.field_version,
          },
        },
        semantic_meaning_id: decision.semantic_meaning_id,
        evidence_identity: clone(decision.evidence_identity),
        certified_data_identity: clone(decision.certified_data_identity),
      });
    } else {
      if (decision.product_definition !== null) {
        fail(code, `${label} is excluded but has a Product definition.`);
      }
      if (decision.certified_data_identity !== null) {
        fail(code, `${label} is excluded but has certified-data authority.`);
      }
      requireText(
        decision.exclusion_reason_code,
        `${label} exclusion_reason_code`,
        code,
      );
      records.push({
        exclusion: {
          source_binding: {
            source_stable_id: AGREEMENT_INVENTORY_SOURCE_STABLE_ID,
            source_schema_version:
              inventoryState.inventory.schema_version,
            source_field_key: decision.field_key,
            source_field_version: decision.field_version,
          },
          reason_code: decision.exclusion_reason_code,
          evidence_identity: clone(decision.evidence_identity),
        },
        semantic_meaning_id: decision.semantic_meaning_id,
      });
    }
  });
  return records;
}

function validateAgreementAliasDecisions(value, inventoryState, fieldDecisions) {
  const code = 'INVALID_AGREEMENT_ALIAS_DECISIONS';
  requireExactKeys(value, [
    'schema_version',
    'inventory_content_id',
    'review_identity',
    'mappings',
    'rejected_collision_claims',
  ], 'Agreement alias decisions', code);
  if (
    value.schema_version !== AGREEMENT_ALIAS_DECISIONS_SCHEMA
    || value.inventory_content_id
      !== inventoryState.inventory.content_identity.content_id
  ) {
    fail(code, 'The Agreement alias decisions do not bind the inventory.');
  }
  validateIdentity(value.review_identity, 'Agreement alias review identity', code);
  const mappings = requireArray(
    value.mappings,
    'Agreement alias mappings',
    code,
    MAX_ALIASES,
  );
  const rejections = requireArray(
    value.rejected_collision_claims,
    'Agreement rejected alias claims',
    code,
    MAX_ALIASES,
  );
  mappings.forEach((mapping, index) => {
    const label = `Agreement alias mapping ${index}`;
    requireExactKeys(mapping, [
      'provision_type',
      'source_request_key',
      'source_registry_index',
      'resolved_field_key',
      'semantic_meaning_id',
      'evidence_identity',
    ], label, code);
    requireText(mapping.provision_type, `${label} provision_type`, code);
    requireText(mapping.source_request_key, `${label} source_request_key`, code);
    requireNonNegativeInteger(
      mapping.source_registry_index,
      `${label} source_registry_index`,
      code,
    );
    requireText(mapping.resolved_field_key, `${label} resolved_field_key`, code);
    requireDigest(
      mapping.semantic_meaning_id,
      `${label} semantic_meaning_id`,
      code,
    );
    validateIdentity(mapping.evidence_identity, `${label} evidence_identity`, code);
  });
  rejections.forEach((rejection, index) => {
    const label = `Agreement rejected alias claim ${index}`;
    requireExactKeys(rejection, [
      'alias',
      'claimant_registry_index',
      'reason_code',
      'evidence_identity',
    ], label, code);
    requireText(rejection.alias, `${label} alias`, code);
    requireNonNegativeInteger(
      rejection.claimant_registry_index,
      `${label} claimant_registry_index`,
      code,
    );
    requireText(rejection.reason_code, `${label} reason_code`, code);
    validateIdentity(rejection.evidence_identity, `${label} evidence_identity`, code);
  });
  requireSortedUnique(
    mappings,
    'Agreement alias mappings',
    aliasMappingIdentity,
    code,
  );
  requireSortedUnique(
    rejections,
    'Agreement rejected alias claims',
    collisionClaimIdentity,
    code,
  );

  const expectedOccurrences = [];
  inventoryState.fields.forEach((field) => {
    field.source_occurrences
      .filter((occurrence) => (
        occurrence.source_kind === 'SERVING_REGISTRY_ENTRY'
      ))
      .forEach((occurrence) => expectedOccurrences.push({
        provision_type: occurrence.provision_type,
        source_request_key: occurrence.source_request_key,
        source_registry_index: occurrence.source_registry_index,
        field_key: field.field_key,
      }));
  });
  requireSortedUnique(
    expectedOccurrences.sort((left, right) => compareText(
      sourceOccurrenceIdentity(left),
      sourceOccurrenceIdentity(right),
    )),
    'Agreement source occurrences',
    sourceOccurrenceIdentity,
    code,
  );
  const decisionByKey = new Map(fieldDecisions.map((decision) => [
    decision.field?.field_key || decision.exclusion.source_binding.source_field_key,
    decision,
  ]));
  const mappedOccurrences = mappings.map((mapping) => ({
    provision_type: mapping.provision_type,
    source_request_key: mapping.source_request_key,
    source_registry_index: mapping.source_registry_index,
    field_key: mapping.resolved_field_key,
  }));
  const expectedJson = canonicalJson(expectedOccurrences);
  const actualJson = canonicalJson(mappedOccurrences);
  if (actualJson !== expectedJson) {
    fail(code, 'The reviewed alias mappings do not reproduce every source occurrence.');
  }
  mappings.forEach((mapping) => {
    const decision = decisionByKey.get(mapping.resolved_field_key);
    if (!decision || decision.semantic_meaning_id !== mapping.semantic_meaning_id) {
      fail(code, 'An alias mapping changes the reviewed field meaning.');
    }
  });

  const rejectionKeys = new Set(rejections.map(collisionClaimIdentity));
  const mappedClaimKeys = new Set(mappings.map((mapping) => (
    `${mapping.source_request_key}\0${String(mapping.source_registry_index).padStart(12, '0')}`
  )));
  const expectedClaimKeys = new Set();
  inventoryState.collisions.forEach((collision) => {
    collision.claimant_registry_indexes.forEach((claimant) => (
      expectedClaimKeys.add(collisionClaimIdentity({
        alias: collision.alias,
        claimant_registry_index: claimant,
      }))
    ));
  });
  for (const key of expectedClaimKeys) {
    const outcomes = Number(rejectionKeys.has(key)) + Number(mappedClaimKeys.has(key));
    if (outcomes !== 1) {
      fail(code, 'An alias collision claim lacks one reviewed outcome.', {
        collision_claim: key,
      });
    }
  }
  for (const key of [...rejectionKeys, ...mappedClaimKeys]) {
    if (
      (rejectionKeys.has(key) || expectedClaimKeys.has(key))
      && !expectedClaimKeys.has(key)
    ) {
      fail(code, 'An alias decision refers to a non-collision claim.', {
        collision_claim: key,
      });
    }
  }
  return {
    mappings,
    rejections,
    reviewIdentity: value.review_identity,
  };
}

function validateAdditionalContribution(contribution, admissions, index) {
  const code = 'INVALID_ADDITIONAL_FIELD_SOURCE';
  const label = `Additional source contribution ${index}`;
  requireExactKeys(contribution, [
    'schema_version',
    'source_stable_id',
    'source_schema_version',
    'source_payload_digest',
    'source_field_count',
    'field_groups',
    'field_decisions',
  ], label, code);
  if (contribution.schema_version !== ADDITIONAL_SOURCE_CONTRIBUTION_SCHEMA) {
    fail(code, `${label} has an invalid schema.`);
  }
  requireText(
    contribution.source_stable_id,
    `${label} source_stable_id`,
    code,
  );
  requireText(
    contribution.source_schema_version,
    `${label} source_schema_version`,
    code,
  );
  requireDigest(
    contribution.source_payload_digest,
    `${label} source_payload_digest`,
    code,
  );
  requirePositiveInteger(
    contribution.source_field_count,
    `${label} source_field_count`,
    code,
  );
  requireCatalogueAdmission(admissions, contribution, (
    contribution.source_payload_digest
  ), contribution.source_field_count);
  const groups = requireArray(
    contribution.field_groups,
    `${label} field_groups`,
    code,
    MAX_GROUPS,
  );
  groups.forEach((group, groupIndex) => {
    requireExactKeys(group, [
      'field_group_key',
      'label',
    ], `${label} field group ${groupIndex}`, code);
    requireText(
      group.field_group_key,
      `${label} field group ${groupIndex} key`,
      code,
    );
    requireText(
      group.label,
      `${label} field group ${groupIndex} label`,
      code,
    );
  });
  requireSortedUnique(groups, `${label} field_groups`, (group) => (
    group.field_group_key
  ), code);
  const groupKeys = new Set(groups.map((group) => group.field_group_key));
  const decisions = requireArray(
    contribution.field_decisions,
    `${label} field_decisions`,
    code,
  );
  if (decisions.length !== contribution.source_field_count) {
    fail(code, `${label} does not disposition every source field.`);
  }
  requireSortedUnique(decisions, `${label} field_decisions`, (decision) => (
    fieldIdentity(decision)
  ), code);
  const records = decisions.map((decision, decisionIndex) => {
    const decisionLabel = `${label} field decision ${decisionIndex}`;
    requireExactKeys(decision, [
      'field_key',
      'field_version',
      'semantic_meaning_id',
      'disposition',
      'product_definition',
      'exclusion_reason_code',
      'evidence_identity',
    ], decisionLabel, code);
    requireText(decision.field_key, `${decisionLabel} field_key`, code);
    requirePositiveInteger(
      decision.field_version,
      `${decisionLabel} field_version`,
      code,
    );
    requireDigest(
      decision.semantic_meaning_id,
      `${decisionLabel} semantic_meaning_id`,
      code,
    );
    validateIdentity(
      decision.evidence_identity,
      `${decisionLabel} evidence_identity`,
      code,
    );
    const sourceBinding = {
      source_stable_id: contribution.source_stable_id,
      source_schema_version: contribution.source_schema_version,
      source_field_key: decision.field_key,
      source_field_version: decision.field_version,
    };
    if (decision.disposition === INCLUDE) {
      validateProductDefinition(
        decision.product_definition,
        `${decisionLabel} product_definition`,
        code,
      );
      if (!groupKeys.has(decision.product_definition.field_group)) {
        fail(code, `${decisionLabel} uses an unknown field group.`);
      }
      if (decision.exclusion_reason_code !== null) {
        fail(code, `${decisionLabel} is included but has an exclusion reason.`);
      }
      return {
        field: {
          field_key: decision.field_key,
          field_version: decision.field_version,
          ...clone(decision.product_definition),
          source_binding: sourceBinding,
        },
        semantic_meaning_id: decision.semantic_meaning_id,
      };
    }
    if (decision.disposition !== EXCLUDE) {
      fail(code, `${decisionLabel} has an invalid disposition.`);
    }
    if (decision.product_definition !== null) {
      fail(code, `${decisionLabel} is excluded but has a Product definition.`);
    }
    requireText(
      decision.exclusion_reason_code,
      `${decisionLabel} exclusion_reason_code`,
      code,
    );
    return {
      exclusion: {
        source_binding: sourceBinding,
        reason_code: decision.exclusion_reason_code,
        evidence_identity: clone(decision.evidence_identity),
      },
      semantic_meaning_id: decision.semantic_meaning_id,
    };
  });
  return {
    binding: {
      source_stable_id: contribution.source_stable_id,
      source_schema_version: contribution.source_schema_version,
      source_payload_digest: contribution.source_payload_digest,
      source_field_count: contribution.source_field_count,
    },
    groups: clone(groups),
    records,
  };
}

function validateEnumerationCertification(
  value,
  {
    inventoryAdmission,
    sourceCatalogueAdmissions,
    fieldDecisions,
    aliasDecisions,
    additionalSources,
  },
) {
  const code = 'INVALID_FIELD_ENUMERATION_CERTIFICATION';
  requireExactKeys(value, [
    'independent_enumeration_id',
    'inclusion_exclusion_reconciliation_id',
  ], 'Field enumeration certification', code);
  requireDigest(
    value.independent_enumeration_id,
    'Field independent enumeration identity',
    code,
  );
  requireDigest(
    value.inclusion_exclusion_reconciliation_id,
    'Field inclusion/exclusion reconciliation identity',
    code,
  );
  const expectedEnumeration = contentId(
    'PRODUCT_FIELD_INDEPENDENT_ENUMERATION/V1',
    {
      agreement_inventory_admission: inventoryAdmission,
      source_catalogue_admissions: sourceCatalogueAdmissions,
    },
  );
  const expectedReconciliation = contentId(
    'PRODUCT_FIELD_INCLUSION_EXCLUSION_RECONCILIATION/V1',
    {
      agreement_field_decisions: fieldDecisions,
      agreement_alias_decisions: aliasDecisions,
      additional_source_contributions: additionalSources,
    },
  );
  if (
    value.independent_enumeration_id !== expectedEnumeration
    || value.inclusion_exclusion_reconciliation_id !== expectedReconciliation
  ) {
    fail(code, 'The field enumeration certification does not bind its inputs.', {
      expected_independent_enumeration_id: expectedEnumeration,
      expected_inclusion_exclusion_reconciliation_id: expectedReconciliation,
    });
  }
  return value;
}

function addGroups(groupMap, groups) {
  for (const group of groups) {
    const existing = groupMap.get(group.field_group_key);
    if (existing && existing.label !== group.label) {
      fail(
        'DUPLICATE_FIELD_GROUP_MEANING',
        'Two sources assign different labels to one field group.',
        { field_group_key: group.field_group_key },
      );
    }
    groupMap.set(group.field_group_key, clone(group));
  }
}

function assertUniqueActiveFields(records) {
  const fields = records.filter((record) => record.field);
  requireSortedUnique(
    [...fields].sort((left, right) => compareText(
      fieldIdentity(left.field),
      fieldIdentity(right.field),
    )),
    'Active Product fields',
    (record) => fieldIdentity(record.field),
    'DUPLICATE_ACTIVE_PRODUCT_FIELD',
  );
  requireSortedUnique(
    [...fields].sort((left, right) => compareText(
      left.field.field_key,
      right.field.field_key,
    )),
    'Active Product field keys',
    (record) => record.field.field_key,
    'DUPLICATE_ACTIVE_PRODUCT_FIELD',
  );
  requireSortedUnique(
    [...fields].sort((left, right) => compareText(
      sourceFieldIdentity(left.field),
      sourceFieldIdentity(right.field),
    )),
    'Active Product source bindings',
    (record) => sourceFieldIdentity(record.field),
    'DUPLICATE_ACTIVE_PRODUCT_FIELD',
  );
  const meanings = new Map();
  fields.forEach((record) => {
    const prior = meanings.get(record.semantic_meaning_id);
    if (prior) {
      fail(
        'DUPLICATE_ACTIVE_FIELD_MEANING',
        'Two active fields claim the same reviewed meaning.',
        {
          semantic_meaning_id: record.semantic_meaning_id,
          first_field_key: prior.field.field_key,
          second_field_key: record.field.field_key,
        },
      );
    }
    meanings.set(record.semantic_meaning_id, record);
  });
}

function buildProductFieldSourceRegistry({
  registry_version: registryVersion,
  approved_pm_data_version_id: approvedPmDataVersionId,
  shared_catalogue: sharedCatalogue,
  process_catalogue: processCatalogue,
  agreement_inventory: agreementInventory,
  agreement_inventory_admission: agreementInventoryAdmission,
  source_catalogue_admissions: sourceCatalogueAdmissions,
  agreement_field_decisions: agreementFieldDecisions,
  agreement_alias_decisions: agreementAliasDecisions,
  additional_source_contributions: additionalSourceContributions = [],
  enumeration_certification: enumerationCertification,
}) {
  requirePositiveInteger(
    registryVersion,
    'Product field source registry version',
    'INVALID_PRODUCT_FIELD_SOURCE_REGISTRY_INPUT',
  );
  requireDigest(
    approvedPmDataVersionId,
    'Approved PM data version identity',
    'INVALID_PRODUCT_FIELD_SOURCE_REGISTRY_INPUT',
  );
  const admissions = validateSourceCatalogueAdmissions(
    sourceCatalogueAdmissions,
  );
  const inventoryState = validateAgreementInventory(
    agreementInventory,
    agreementInventoryAdmission,
  );
  inventoryState.inventory = agreementInventory;
  const agreementAdmission = {
    source_stable_id: AGREEMENT_INVENTORY_SOURCE_STABLE_ID,
    source_schema_version: agreementInventory.schema_version,
    source_payload_digest:
      agreementInventory.content_identity.canonical_payload_sha256,
    source_field_count: inventoryState.fields.length,
  };
  requireCatalogueAdmission(
    admissions,
    agreementAdmission,
    agreementAdmission.source_payload_digest,
    agreementAdmission.source_field_count,
  );

  const shared = validateSharedCatalogue(sharedCatalogue, admissions);
  const process = validateProcessCatalogue(processCatalogue, admissions);
  const agreementRecords = validateAgreementFieldDecisions(
    agreementFieldDecisions,
    inventoryState,
  );
  const aliasReview = validateAgreementAliasDecisions(
    agreementAliasDecisions,
    inventoryState,
    agreementRecords,
  );
  const additionalSources = requireArray(
    additionalSourceContributions,
    'Additional source contributions',
    'INVALID_ADDITIONAL_FIELD_SOURCE',
    MAX_SOURCES,
  ).map((contribution, index) => validateAdditionalContribution(
    contribution,
    admissions,
    index,
  ));
  requireSortedUnique(
    additionalSources,
    'Additional source contributions',
    (source) => sourceKey(source.binding),
    'INVALID_ADDITIONAL_FIELD_SOURCE',
  );

  validateEnumerationCertification(enumerationCertification, {
    inventoryAdmission: agreementInventoryAdmission,
    sourceCatalogueAdmissions,
    fieldDecisions: agreementFieldDecisions,
    aliasDecisions: agreementAliasDecisions,
    additionalSources: additionalSourceContributions,
  });

  const sources = [
    shared,
    process,
    {
      binding: agreementAdmission,
      groups: [{
        field_group_key: AGREEMENT_FIELD_GROUP,
        label: 'Agreement terms',
      }],
      records: agreementRecords,
    },
    ...additionalSources,
  ];
  const sourceBindings = sources
    .map((source) => clone(source.binding))
    .sort((left, right) => compareText(sourceKey(left), sourceKey(right)));
  requireSortedUnique(
    sourceBindings,
    'Product field source bindings',
    sourceKey,
    'DUPLICATE_PRODUCT_FIELD_SOURCE',
  );
  if (sourceBindings.length !== admissions.size) {
    fail(
      'UNUSED_SOURCE_CATALOGUE_ADMISSION',
      'One or more source catalogue admissions have no source contribution.',
    );
  }

  const groupMap = new Map();
  sources.forEach((source) => addGroups(groupMap, source.groups));
  const groupKeys = [...groupMap.keys()].sort();
  const records = sources.flatMap((source) => source.records);
  assertUniqueActiveFields(records);
  const fields = records
    .filter((record) => record.field)
    .map((record) => clone(record.field))
    .sort((left, right) => compareText(fieldIdentity(left), fieldIdentity(right)));
  fields.forEach((field, index) => {
    requireExactKeys(
      field,
      SOURCE_FIELD_KEYS,
      `Compiled source field ${index}`,
      'INVALID_COMPILED_PRODUCT_FIELD_SOURCE',
    );
    if (!groupMap.has(field.field_group)) {
      fail(
        'INVALID_COMPILED_PRODUCT_FIELD_SOURCE',
        'A compiled field uses an unknown field group.',
      );
    }
  });
  const exclusions = records
    .filter((record) => record.exclusion)
    .map((record) => clone(record.exclusion))
    .sort((left, right) => compareText(
      sourceFieldIdentity({ source_binding: left.source_binding }),
      sourceFieldIdentity({ source_binding: right.source_binding }),
    ));
  requireSortedUnique(
    exclusions,
    'Product source exclusions',
    (exclusion) => sourceFieldIdentity({ source_binding: exclusion.source_binding }),
    'DUPLICATE_PRODUCT_FIELD_SOURCE_DISPOSITION',
  );

  for (const source of sourceBindings) {
    const key = sourceKey(source);
    const includedCount = fields.filter((field) => (
      sourceKey(field.source_binding) === key
    )).length;
    const excludedCount = exclusions.filter((exclusion) => (
      sourceKey(exclusion.source_binding) === key
    )).length;
    if (includedCount + excludedCount !== source.source_field_count) {
      fail(
        'PRODUCT_FIELD_SOURCE_RECONCILIATION_FAILED',
        'A source field catalogue does not have one outcome per field.',
        {
          source_stable_id: source.source_stable_id,
          expected: source.source_field_count,
          actual: includedCount + excludedCount,
        },
      );
    }
  }
  const activeKeys = new Set(fields.map((field) => field.field_key));
  const missingBaseline = CURRENT_PM_BASELINE_FIELD_KEYS.filter(
    (fieldKey) => !activeKeys.has(fieldKey),
  );
  if (missingBaseline.length > 0) {
    fail(
      'CURRENT_PM_BASELINE_FIELD_MISSING',
      'A current PM field is not active in the source registry.',
      { missing_field_keys: missingBaseline },
    );
  }

  const registry = {
    schema_version: PRODUCT_FIELD_SOURCE_REGISTRY_SCHEMA,
    stable_id: PRODUCT_FIELD_SOURCE_REGISTRY_STABLE_ID,
    registry_version: registryVersion,
    approved_pm_data_version_id: approvedPmDataVersionId,
    source_bindings: sourceBindings,
    field_groups: groupKeys.map((fieldGroupKey, index) => ({
      field_group_key: fieldGroupKey,
      label: groupMap.get(fieldGroupKey).label,
      sort_ordinal: index + 1,
    })),
    field_definitions: fields,
    source_exclusions: exclusions,
    current_pm_baseline_field_keys: [...CURRENT_PM_BASELINE_FIELD_KEYS],
    enumeration_certification: clone(enumerationCertification),
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest = sourceRegistryPayloadDigest(registry);
  return deepFreeze(clone(registry));
}

function expectedEnumerationCertification({
  agreement_inventory_admission: agreementInventoryAdmission,
  source_catalogue_admissions: sourceCatalogueAdmissions,
  agreement_field_decisions: agreementFieldDecisions,
  agreement_alias_decisions: agreementAliasDecisions,
  additional_source_contributions: additionalSourceContributions = [],
}) {
  return Object.freeze({
    independent_enumeration_id: contentId(
      'PRODUCT_FIELD_INDEPENDENT_ENUMERATION/V1',
      {
        agreement_inventory_admission: agreementInventoryAdmission,
        source_catalogue_admissions: sourceCatalogueAdmissions,
      },
    ),
    inclusion_exclusion_reconciliation_id: contentId(
      'PRODUCT_FIELD_INCLUSION_EXCLUSION_RECONCILIATION/V1',
      {
        agreement_field_decisions: agreementFieldDecisions,
        agreement_alias_decisions: agreementAliasDecisions,
        additional_source_contributions: additionalSourceContributions,
      },
    ),
  });
}

module.exports = {
  ADDITIONAL_SOURCE_CONTRIBUTION_SCHEMA,
  AGREEMENT_ALIAS_DECISIONS_SCHEMA,
  AGREEMENT_FIELD_DECISIONS_SCHEMA,
  AGREEMENT_INVENTORY_ADMISSION_SCHEMA,
  AGREEMENT_INVENTORY_SOURCE_STABLE_ID,
  PRODUCT_FIELD_SOURCE_REGISTRY_STABLE_ID,
  SOURCE_CATALOGUE_ADMISSIONS_SCHEMA,
  ProductFieldSourceRegistryError,
  buildProductFieldSourceRegistry,
  expectedEnumerationCertification,
};
