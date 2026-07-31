const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  CURRENT_PM_BASELINE_FIELD_KEYS,
  buildProductFieldCatalogueManifest,
  sourceRegistryPayloadDigest,
} = require('./product-field-catalogue');

const sharedCatalogue = require(
  '../../contracts/canonical-v2/successor/shared/field-definitions/shared-deal-field-catalogue.v1.json',
);
const processCatalogue = require(
  '../../contracts/canonical-v2/successor/process/fields/process-field-definition-catalogue.v1.json',
);

const PILOT_FIELD_CATALOGUE_SCHEMA =
  'PILOT_PRODUCT_FIELD_CATALOGUE_BUILDER/V1';
const RESULT_DEFINITIONS = Object.freeze([
  'AGREEMENT_COMPARABLE_RESULT',
  'CVR_MILESTONE_RESULT',
  'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  'TARGET_CAPEX_RESTRICTION',
  'TARGET_CAPITALISATION_BRING_DOWN',
]);
const GROUP_LABELS = Object.freeze({
  DEAL_IDENTITY: 'Deal identity',
  CHRONOLOGY: 'Deal and date',
  PARTIES: 'Parties',
  TRANSACTION_STRUCTURE: 'Transaction structure',
  ECONOMICS: 'Consideration and value',
  CLASSIFICATIONS: 'Sector and classifications',
  PROFESSIONALS: 'Law firms, lawyers and advisers',
  PROCESS_EVENT: 'Process event',
  PROCESS_PARTIES_AND_TRACKS: 'Parties and bidder tracks',
  PROCESS_TIMING: 'Process timing',
  PROCESS_SOURCE_AND_CERTIFICATION: 'Source and certification',
});
const GROUP_ORDER = Object.freeze(Object.keys(GROUP_LABELS));
const SHA256_RE = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(`Pilot Product field catalogue: ${message}`);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function requireRelease(value) {
  const expected = [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ];
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson(expected.sort())
  ) {
    fail('the release binding fields are invalid');
  }
  Object.entries(value).forEach(([key, digest]) => {
    if (typeof digest !== 'string' || !SHA256_RE.test(digest)) {
      fail(`${key} must be a lower-case SHA-256 digest`);
    }
  });
  return clone(value);
}

function identity(release, stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: contentId(PILOT_FIELD_CATALOGUE_SCHEMA, {
      ...release,
      stable_id: stableId,
      version,
    }),
  };
}

function capabilities(value) {
  return {
    display: value.display,
    filter: value.filter,
    sort: value.sort,
    group: value.group,
    export: true,
  };
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sharedCompleteness(field) {
  return field.multiplicity === 'MANY'
    ? 'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE'
    : field.missing_state_behaviour;
}

function sharedSourceField(field) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    label: field.label,
    field_group: field.field_group,
    value_type: field.value_type,
    control_type: field.control_type,
    supported_domains: [...field.permitted_domains].sort(),
    source_permitted_result_definitions: [],
    capabilities: capabilities(field.capabilities),
    permitted_operators: [...field.permitted_operators].sort(),
    filter_scope: field.filter_scope,
    multiplicity: field.multiplicity,
    completeness_semantics: sharedCompleteness(field),
    source_requirement: field.source_detail_action,
    derivation_requirement: 'CANONICAL_SHARED_FACT_PROJECTION_ONLY',
    unavailable_reason: field.unavailable_request_result,
    value_vocabulary_required: field.value_type === 'ENUM',
    source_binding: {
      source_stable_id: sharedCatalogue.stable_id,
      source_schema_version: sharedCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function processSourceField(field) {
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
    capabilities: capabilities(field.capabilities),
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
      source_stable_id: processCatalogue.stable_id,
      source_schema_version: processCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function sourceRegistry(release) {
  const sourceBindings = [
    {
      source_stable_id: processCatalogue.stable_id,
      source_schema_version: processCatalogue.schema_version,
      source_payload_digest: payloadDigest(processCatalogue),
      source_field_count:
        processCatalogue.definition.field_definitions.length,
    },
    {
      source_stable_id: sharedCatalogue.stable_id,
      source_schema_version: sharedCatalogue.schema_version,
      source_payload_digest: payloadDigest(sharedCatalogue),
      source_field_count: sharedCatalogue.field_definitions.length,
    },
  ].sort((left, right) => (
    compareText(
      `${left.source_stable_id}\0${left.source_schema_version}`,
      `${right.source_stable_id}\0${right.source_schema_version}`,
    )
  ));
  const fields = [
    ...sharedCatalogue.field_definitions.map(sharedSourceField),
    ...processCatalogue.definition.field_definitions.map(
      processSourceField,
    ),
  ].sort((left, right) => (
    compareText(
      `${left.field_key}\0${left.field_version}`,
      `${right.field_key}\0${right.field_version}`,
    )
  ));
  const value = {
    schema_version: 'PRODUCT_FIELD_SOURCE_REGISTRY/V1',
    stable_id: 'PRODUCT_FIELD_SOURCE_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: release.approved_pm_data_version_id,
    source_bindings: sourceBindings,
    field_groups: GROUP_ORDER.map((fieldGroupKey, index) => ({
      field_group_key: fieldGroupKey,
      label: GROUP_LABELS[fieldGroupKey],
      sort_ordinal: index + 1,
    })),
    field_definitions: fields,
    source_exclusions: [],
    current_pm_baseline_field_keys: [...CURRENT_PM_BASELINE_FIELD_KEYS],
    enumeration_certification: {
      independent_enumeration_id:
        identity(release, 'PILOT_FIELD_ENUMERATION').payload_digest,
      inclusion_exclusion_reconciliation_id:
        identity(release, 'PILOT_FIELD_RECONCILIATION').payload_digest,
    },
    canonical_payload_digest: null,
  };
  value.canonical_payload_digest = sourceRegistryPayloadDigest(value);
  return value;
}

function fieldAdmission(release, field) {
  const permittedResultDefinitions =
    field.source_permitted_result_definitions.length > 0
      ? [...field.source_permitted_result_definitions]
      : [...RESULT_DEFINITIONS];
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    supported_domains: [...field.supported_domains],
    permitted_result_definitions:
      permittedResultDefinitions.sort(),
    capabilities: clone(field.capabilities),
    permitted_operators: [...field.permitted_operators],
    value_vocabulary: field.value_vocabulary_required
      ? identity(
        release,
        `${field.field_key.toUpperCase()}_VALUE_REGISTRY`,
      )
      : null,
    certification_identity: identity(
      release,
      `${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`,
    ),
  };
}

function buildPilotProductFieldCatalogueManifest(releaseInput) {
  const release = requireRelease(releaseInput);
  const registry = sourceRegistry(release);
  return buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: {
      schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
      ...release,
      source_registry_admission: {
        stable_id: registry.stable_id,
        registry_version: registry.registry_version,
        approved_pm_data_version_id:
          registry.approved_pm_data_version_id,
        canonical_payload_digest:
          registry.canonical_payload_digest,
        enumeration_certification:
          clone(registry.enumeration_certification),
      },
      catalogue_generator_identity:
        identity(release, 'PRODUCT_FIELD_CATALOGUE_GENERATOR'),
      shared_deal_fact_specification_identity:
        identity(release, 'SHARED_DEAL_FACT_SPECIFICATION'),
      process_specification_identity:
        identity(release, 'PROCESS_INTELLIGENCE_SPECIFICATION'),
      field_admissions: registry.field_definitions.map(
        (field) => fieldAdmission(release, field),
      ),
      field_exclusions: [],
      previous_catalogue_identity: null,
    },
  });
}

module.exports = {
  PILOT_FIELD_CATALOGUE_SCHEMA,
  buildPilotProductFieldCatalogueManifest,
};
