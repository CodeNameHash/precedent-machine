const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProductFieldCatalogueManifest,
  sourceRegistryPayloadDigest,
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  ADDITIONAL_SOURCE_CONTRIBUTION_SCHEMA,
  AGREEMENT_ALIAS_DECISIONS_SCHEMA,
  AGREEMENT_FIELD_DECISIONS_SCHEMA,
  AGREEMENT_INVENTORY_ADMISSION_SCHEMA,
  AGREEMENT_INVENTORY_SOURCE_STABLE_ID,
  SOURCE_CATALOGUE_ADMISSIONS_SCHEMA,
  buildProductFieldSourceRegistry,
  expectedEnumerationCertification,
} = require('../lib/canonical-v2/product-field-source-registry');

const ROOT = path.join(__dirname, '..');
const AGREEMENT_RESULT = 'AGREEMENT_PROVISION_PASSAGE_RESULT';
const PROCESS_RESULTS = Object.freeze([
  'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
]);

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function identity(stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: digest(`${stableId}:${version}`),
  };
}

function fieldMeaning(fieldKey) {
  return contentId('REVIEWED_AGREEMENT_FIELD_MEANING/V1', { field_key: fieldKey });
}

function aliasMappingKey(value) {
  return [
    value.provision_type,
    value.source_request_key,
    String(value.source_registry_index).padStart(12, '0'),
    value.resolved_field_key,
  ].join('\0');
}

function collisionClaimKey(value) {
  return `${value.alias}\0${String(value.claimant_registry_index).padStart(12, '0')}`;
}

function sourceKey(value) {
  return `${value.source_stable_id}\0${value.source_schema_version}`;
}

function agreementProductDefinition(field) {
  const numericOperators = ['BETWEEN', 'EQ', 'GT', 'GTE', 'LT', 'LTE'];
  const shapeByType = {
    string: {
      valueType: 'TEXT',
      controlType: 'TEXT_SEARCH',
      operators: ['CONTAINS', 'EQ', 'EXISTS', 'NONE'],
      vocabulary: false,
    },
    boolean: {
      valueType: 'BOOLEAN',
      controlType: 'BOOLEAN_SELECT',
      operators: ['EQ', 'EXISTS', 'NONE'],
      vocabulary: false,
    },
    enum: {
      valueType: 'ENUM',
      controlType: 'ENUM_MULTISELECT',
      operators: ['EQ', 'EXISTS', 'IN', 'NONE'],
      vocabulary: true,
    },
    percent: {
      valueType: 'PERCENTAGE',
      controlType: 'NUMBER_RANGE',
      operators: numericOperators,
      vocabulary: false,
    },
    percentage: {
      valueType: 'PERCENTAGE',
      controlType: 'NUMBER_RANGE',
      operators: numericOperators,
      vocabulary: false,
    },
    number: {
      valueType: 'NUMBER',
      controlType: 'NUMBER_RANGE',
      operators: numericOperators,
      vocabulary: false,
    },
    usd: {
      valueType: 'MONEY_AMOUNT',
      controlType: 'NUMBER_RANGE',
      operators: numericOperators,
      vocabulary: false,
    },
    date: {
      valueType: 'DATE',
      controlType: 'DATE_RANGE',
      operators: ['AFTER', 'BEFORE', 'BETWEEN', 'EQ'],
      vocabulary: false,
    },
  };
  const shape = shapeByType[field.value_type];
  assert.ok(shape, `test fixture lacks Agreement type ${field.value_type}`);
  return {
    label: field.label,
    field_group: 'AGREEMENT_TERMS',
    value_type: shape.valueType,
    control_type: shape.controlType,
    supported_domains: ['AGREEMENT', 'PROCESS'],
    source_permitted_result_definitions: [AGREEMENT_RESULT],
    capabilities: {
      display: true,
      filter: true,
      sort: field.numeric || field.value_type === 'date',
      group: field.boolean || field.coded,
      export: true,
    },
    permitted_operators: [...shape.operators].sort(),
    filter_scope: 'SAME_AGREEMENT_PROVISION_OCCURRENCE',
    multiplicity: 'ZERO_OR_ONE',
    completeness_semantics:
      'UNKNOWN_IF_NOT_CERTIFIED_FOR_SELECTED_RELEASE',
    source_requirement:
      'EXACT_AGREEMENT_SOURCE_OCCURRENCE_AND_FIELD_LINEAGE_REQUIRED',
    derivation_requirement:
      'NO_LEGACY_TEXT_OR_LABEL_DERIVATION',
    unavailable_reason:
      'FIELD_NOT_CERTIFIED_FOR_SELECTED_APPROVED_PM_DATA_VERSION',
    value_vocabulary_required: shape.vocabulary,
  };
}

function agreementInventoryAdmission(inventory) {
  const fields = inventory.agreement_query_surface.fields;
  const admission = {
    schema_version: AGREEMENT_INVENTORY_ADMISSION_SCHEMA,
    inventory_schema_version: inventory.schema_version,
    inventory_content_id: inventory.content_identity.content_id,
    inventory_payload_digest:
      inventory.content_identity.canonical_payload_sha256,
    source_baseline_commit: inventory.source_baseline_commit,
    agreement_field_count: fields.length,
    agreement_occurrence_count: fields.reduce(
      (total, field) => total + field.source_occurrences.length,
      0,
    ),
    registry_entry_count: inventory.serving_registry.inputs.length,
    alias_collision_count:
      inventory.serving_registry.alias_collisions.length,
    admission_identity: null,
  };
  admission.admission_identity = {
    stable_id: 'AGREEMENT_FIELD_INVENTORY_ADMISSION',
    version: 1,
    payload_digest: payloadDigest(Object.fromEntries(
      Object.entries(admission).filter(([key]) => key !== 'admission_identity'),
    )),
  };
  return admission;
}

function catalogueAdmission(
  stableId,
  schemaVersion,
  sourcePayloadDigest,
  sourceFieldCount,
) {
  const admission = {
    source_stable_id: stableId,
    source_schema_version: schemaVersion,
    source_payload_digest: sourcePayloadDigest,
    source_field_count: sourceFieldCount,
    admission_identity: null,
  };
  admission.admission_identity = {
    stable_id: `${stableId}_${schemaVersion}_SOURCE_ADMISSION`,
    version: 1,
    payload_digest: payloadDigest(Object.fromEntries(
      Object.entries(admission).filter(([key]) => key !== 'admission_identity'),
    )),
  };
  return admission;
}

function sourceCatalogueAdmissions(inventory, shared, process, additions = []) {
  const admissions = [
    catalogueAdmission(
      AGREEMENT_INVENTORY_SOURCE_STABLE_ID,
      inventory.schema_version,
      inventory.content_identity.canonical_payload_sha256,
      inventory.agreement_query_surface.fields.length,
    ),
    catalogueAdmission(
      process.stable_id,
      process.schema_version,
      payloadDigest(process),
      process.definition.field_definitions.length,
    ),
    catalogueAdmission(
      shared.stable_id,
      shared.schema_version,
      payloadDigest(shared),
      shared.field_definitions.length,
    ),
    ...additions.map((addition) => catalogueAdmission(
      addition.source_stable_id,
      addition.source_schema_version,
      addition.source_payload_digest,
      addition.source_field_count,
    )),
  ].sort((left, right) => compareText(sourceKey(left), sourceKey(right)));
  return {
    schema_version: SOURCE_CATALOGUE_ADMISSIONS_SCHEMA,
    admissions,
  };
}

function agreementFieldDecisions(inventory, exclusions = new Map()) {
  const decisions = inventory.agreement_query_surface.fields.map((field) => {
    const exclusionReason = exclusions.get(field.field_key) || null;
    return {
      field_key: field.field_key,
      field_version: 1,
      semantic_meaning_id: fieldMeaning(field.field_key),
      disposition: exclusionReason ? 'EXCLUDE' : 'INCLUDE',
      product_definition: exclusionReason
        ? null
        : agreementProductDefinition(field),
      certified_data_identity: exclusionReason
        ? null
        : identity(`${field.field_key.toUpperCase()}_CERTIFIED_DATA`),
      exclusion_reason_code: exclusionReason,
      evidence_identity: identity(
        `${field.field_key.toUpperCase()}_FIELD_DECISION_EVIDENCE`,
      ),
    };
  }).sort((left, right) => compareText(left.field_key, right.field_key));
  return {
    schema_version: AGREEMENT_FIELD_DECISIONS_SCHEMA,
    inventory_content_id: inventory.content_identity.content_id,
    decisions,
  };
}

function agreementAliasDecisions(inventory, fieldDecisions) {
  const meaningByField = new Map(fieldDecisions.decisions.map((decision) => [
    decision.field_key,
    decision.semantic_meaning_id,
  ]));
  const mappings = [];
  for (const field of inventory.agreement_query_surface.fields) {
    for (const occurrence of field.source_occurrences) {
      if (occurrence.source_kind !== 'SERVING_REGISTRY_ENTRY') continue;
      mappings.push({
        provision_type: occurrence.provision_type,
        source_request_key: occurrence.source_request_key,
        source_registry_index: occurrence.source_registry_index,
        resolved_field_key: field.field_key,
        semantic_meaning_id: meaningByField.get(field.field_key),
        evidence_identity: identity(
          `ALIAS_${occurrence.provision_type}_${occurrence.source_request_key}_${occurrence.source_registry_index}_${field.field_key}`,
        ),
      });
    }
  }
  mappings.sort((left, right) => compareText(
    aliasMappingKey(left),
    aliasMappingKey(right),
  ));
  const mappedClaims = new Set(mappings.map((mapping) => (
    `${mapping.source_request_key}\0${String(mapping.source_registry_index).padStart(12, '0')}`
  )));
  const rejectedClaims = [];
  for (const collision of inventory.serving_registry.alias_collisions) {
    for (const claimant of collision.claimant_registry_indexes) {
      const key = collisionClaimKey({
        alias: collision.alias,
        claimant_registry_index: claimant,
      });
      if (mappedClaims.has(key)) continue;
      rejectedClaims.push({
        alias: collision.alias,
        claimant_registry_index: claimant,
        reason_code: 'REJECT_UNREVIEWED_OR_SHADOWED_ALIAS_CLAIM',
        evidence_identity: identity(
          `REJECT_ALIAS_${collision.alias}_${claimant}`,
        ),
      });
    }
  }
  rejectedClaims.sort((left, right) => compareText(
    collisionClaimKey(left),
    collisionClaimKey(right),
  ));
  return {
    schema_version: AGREEMENT_ALIAS_DECISIONS_SCHEMA,
    inventory_content_id: inventory.content_identity.content_id,
    review_identity: identity('AGREEMENT_ALIAS_REVIEW'),
    mappings,
    rejected_collision_claims: rejectedClaims,
  };
}

function fixture(overrides = {}) {
  const inventory = overrides.agreement_inventory || loadJson(
    'evidence/process-intelligence/baseline/product-field-source-inventory.json',
  );
  const shared = overrides.shared_catalogue || loadJson(
    'contracts/canonical-v2/successor/shared/field-definitions/shared-deal-field-catalogue.v1.json',
  );
  const process = overrides.process_catalogue || loadJson(
    'contracts/canonical-v2/successor/process/fields/process-field-definition-catalogue.v1.json',
  );
  const additions = overrides.additional_source_contributions || [];
  const inventoryAdmission = overrides.agreement_inventory_admission
    || agreementInventoryAdmission(inventory);
  const admissions = overrides.source_catalogue_admissions
    || sourceCatalogueAdmissions(inventory, shared, process, additions);
  const fieldDecisions = overrides.agreement_field_decisions
    || agreementFieldDecisions(inventory);
  const aliasDecisions = overrides.agreement_alias_decisions
    || agreementAliasDecisions(inventory, fieldDecisions);
  const certification = overrides.enumeration_certification
    || expectedEnumerationCertification({
      agreement_inventory_admission: inventoryAdmission,
      source_catalogue_admissions: admissions,
      agreement_field_decisions: fieldDecisions,
      agreement_alias_decisions: aliasDecisions,
      additional_source_contributions: additions,
    });
  return {
    registry_version: 1,
    approved_pm_data_version_id: digest('approved-pm-data-version'),
    shared_catalogue: shared,
    process_catalogue: process,
    agreement_inventory: inventory,
    agreement_inventory_admission: inventoryAdmission,
    source_catalogue_admissions: admissions,
    agreement_field_decisions: fieldDecisions,
    agreement_alias_decisions: aliasDecisions,
    additional_source_contributions: additions,
    enumeration_certification: certification,
    ...overrides,
  };
}

function releaseAdmission(registry) {
  const fieldAdmissions = registry.field_definitions.map((field) => ({
    field_key: field.field_key,
    field_version: field.field_version,
    supported_domains: [...field.supported_domains],
    permitted_result_definitions:
      field.source_permitted_result_definitions.length > 0
        ? [...field.source_permitted_result_definitions]
        : [...PROCESS_RESULTS],
    capabilities: clone(field.capabilities),
    permitted_operators: [...field.permitted_operators],
    value_vocabulary: field.value_vocabulary_required
      ? identity(`${field.field_key.toUpperCase()}_VALUE_REGISTRY`)
      : null,
    certification_identity: identity(
      `${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`,
    ),
  }));
  return {
    schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    candidate_release_manifest_id: digest('candidate-release-manifest'),
    candidate_release_manifest_payload_digest:
      digest('candidate-release-manifest-payload'),
    source_registry_admission: {
      stable_id: registry.stable_id,
      registry_version: registry.registry_version,
      approved_pm_data_version_id: registry.approved_pm_data_version_id,
      canonical_payload_digest: registry.canonical_payload_digest,
      enumeration_certification: clone(registry.enumeration_certification),
    },
    catalogue_generator_identity:
      identity('PRODUCT_FIELD_CATALOGUE_GENERATOR'),
    shared_deal_fact_specification_identity:
      identity('SHARED_DEAL_FACT_SPECIFICATION'),
    process_specification_identity:
      identity('PROCESS_INTELLIGENCE_SPECIFICATION'),
    field_admissions: fieldAdmissions,
    field_exclusions: [],
    previous_catalogue_identity: null,
  };
}

function cvrContribution() {
  const fieldKey = 'cvr_milestone_type';
  return {
    schema_version: ADDITIONAL_SOURCE_CONTRIBUTION_SCHEMA,
    source_stable_id: 'CVR_FIELD_DEFINITION_CATALOGUE',
    source_schema_version: 'CVR_FIELD_CATALOGUE_INPUT/V1',
    source_payload_digest: digest('cvr-field-catalogue'),
    source_field_count: 1,
    field_groups: [{
      field_group_key: 'CVR_TERMS',
      label: 'CVR terms',
    }],
    field_decisions: [{
      field_key: fieldKey,
      field_version: 1,
      semantic_meaning_id: contentId(
        'REVIEWED_CVR_FIELD_MEANING/V1',
        { field_key: fieldKey },
      ),
      disposition: 'INCLUDE',
      product_definition: {
        label: 'CVR milestone type',
        field_group: 'CVR_TERMS',
        value_type: 'ENUM',
        control_type: 'ENUM_MULTISELECT',
        supported_domains: ['CVR'],
        source_permitted_result_definitions: ['CVR_MILESTONE_PASSAGE_RESULT'],
        capabilities: {
          display: true,
          filter: true,
          sort: true,
          group: true,
          export: true,
        },
        permitted_operators: ['EQ', 'IN'],
        filter_scope: 'SAME_CVR_MILESTONE',
        multiplicity: 'ZERO_OR_ONE',
        completeness_semantics: 'UNKNOWN_IF_NOT_CERTIFIED',
        source_requirement: 'EXACT_CVR_SOURCE_AND_LINEAGE_REQUIRED',
        derivation_requirement: 'NO_LABEL_TO_CODE_DERIVATION',
        unavailable_reason: 'CVR_FIELD_NOT_ADMITTED',
        value_vocabulary_required: true,
      },
      exclusion_reason_code: null,
      evidence_identity: identity('CVR_MILESTONE_TYPE_DECISION'),
    }],
  };
}

test('compiles the exact current PM sources into one deterministic registry', () => {
  const input = fixture();
  const first = buildProductFieldSourceRegistry(input);
  const second = buildProductFieldSourceRegistry(clone(input));
  const inventory = input.agreement_inventory;

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PRODUCT_FIELD_SOURCE_REGISTRY/V1');
  assert.equal(first.stable_id, 'PRODUCT_FIELD_SOURCE_REGISTRY');
  assert.equal(first.source_bindings.length, 3);
  assert.equal(first.field_definitions.length, 15 + 12 + 334);
  assert.equal(first.source_exclusions.length, 0);
  assert.equal(
    first.canonical_payload_digest,
    sourceRegistryPayloadDigest(first),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.field_definitions), true);
  assert.equal(Object.isFrozen(first.field_definitions[0].source_binding), true);
  assert.equal(
    inventory.agreement_query_surface.distinct_user_facing_field_count,
    334,
  );
  assert.equal(inventory.agreement_query_surface.field_occurrence_count, 492);
  assert.equal(inventory.serving_registry.observed_entry_count, 700);
  assert.equal(inventory.serving_registry.alias_collision_count, 156);
  assert.equal(input.agreement_alias_decisions.mappings.length, 490);
  assert.ok(
    input.agreement_alias_decisions.rejected_collision_claims.length > 0,
  );
  assert.deepEqual(
    first.current_pm_baseline_field_keys,
    input.shared_catalogue.current_pm_baseline_field_keys,
  );
  assert.deepEqual(
    first.field_definitions.map((field) => field.field_key),
    [...first.field_definitions.map((field) => field.field_key)].sort(),
  );
});

test('the compiled registry is accepted by the Product catalogue generator', () => {
  const registry = buildProductFieldSourceRegistry(fixture());
  const admission = releaseAdmission(registry);
  const manifest = buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: admission,
  });

  assert.equal(
    manifest.field_definitions.length,
    registry.field_definitions.length,
  );
  assert.equal(
    manifest.basis.source_registry.payload_digest,
    registry.canonical_payload_digest,
  );
  assert.equal(
    manifest.approved_pm_data_version_id,
    registry.approved_pm_data_version_id,
  );
});

test('records one explicit exclusion without losing source reconciliation', () => {
  const inventory = loadJson(
    'evidence/process-intelligence/baseline/product-field-source-inventory.json',
  );
  const decisions = agreementFieldDecisions(
    inventory,
    new Map([['amount', 'DUPLICATE_ACTIVE_MEANING_NOT_RESOLVED']]),
  );
  const input = fixture({
    agreement_inventory: inventory,
    agreement_field_decisions: decisions,
    agreement_alias_decisions: agreementAliasDecisions(inventory, decisions),
  });
  input.enumeration_certification = expectedEnumerationCertification(input);
  const registry = buildProductFieldSourceRegistry(input);

  assert.equal(registry.field_definitions.length, 15 + 12 + 333);
  assert.equal(registry.source_exclusions.length, 1);
  assert.equal(
    registry.source_exclusions[0].source_binding.source_field_key,
    'amount',
  );
  assert.equal(
    registry.source_exclusions[0].reason_code,
    'DUPLICATE_ACTIVE_MEANING_NOT_RESOLVED',
  );
});

test('rejects silent loss of one Agreement field decision', () => {
  const input = fixture();
  input.agreement_field_decisions.decisions.pop();
  input.enumeration_certification = expectedEnumerationCertification(input);

  assert.throws(
    () => buildProductFieldSourceRegistry(input),
    (error) => error.code === 'INVALID_AGREEMENT_FIELD_DECISIONS',
  );
});

test('rejects a self-rehashed inventory that lacks a new admission', () => {
  const input = fixture();
  const changed = clone(input.agreement_inventory);
  changed.agreement_query_surface.fields.pop();
  changed.agreement_query_surface.distinct_user_facing_field_count -= 1;
  const removedOccurrences = input.agreement_inventory
    .agreement_query_surface.fields.at(-1).source_occurrences.length;
  changed.agreement_query_surface.field_occurrence_count -= removedOccurrences;
  const body = clone(changed);
  delete body.content_identity;
  changed.content_identity.canonical_payload_sha256 = payloadDigest(body);
  changed.content_identity.content_id = contentId(
    changed.content_identity.domain,
    body,
  );
  input.agreement_inventory = changed;

  assert.throws(
    () => buildProductFieldSourceRegistry(input),
    (error) => error.code === 'INVALID_AGREEMENT_FIELD_INVENTORY',
  );
});

test('rejects an unknown or out-of-range nested source occurrence', () => {
  const unknownKind = fixture();
  unknownKind.agreement_inventory
    .agreement_query_surface.fields[0]
    .source_occurrences[0]
    .source_kind = 'GUESSED_SOURCE';
  const unknownBody = clone(unknownKind.agreement_inventory);
  delete unknownBody.content_identity;
  unknownKind.agreement_inventory.content_identity.canonical_payload_sha256 =
    payloadDigest(unknownBody);
  unknownKind.agreement_inventory.content_identity.content_id = contentId(
    unknownKind.agreement_inventory.content_identity.domain,
    unknownBody,
  );
  unknownKind.agreement_inventory_admission = agreementInventoryAdmission(
    unknownKind.agreement_inventory,
  );
  unknownKind.source_catalogue_admissions = sourceCatalogueAdmissions(
    unknownKind.agreement_inventory,
    unknownKind.shared_catalogue,
    unknownKind.process_catalogue,
  );
  unknownKind.agreement_field_decisions.inventory_content_id =
    unknownKind.agreement_inventory.content_identity.content_id;
  unknownKind.agreement_alias_decisions.inventory_content_id =
    unknownKind.agreement_inventory.content_identity.content_id;
  unknownKind.enumeration_certification =
    expectedEnumerationCertification(unknownKind);
  assert.throws(
    () => buildProductFieldSourceRegistry(unknownKind),
    (error) => error.code === 'INVALID_AGREEMENT_FIELD_INVENTORY',
  );

  const outOfRange = fixture();
  const occurrence = outOfRange.agreement_inventory
    .agreement_query_surface.fields
    .find((field) => field.source_occurrences.some(
      (source) => source.source_kind === 'SERVING_REGISTRY_ENTRY',
    ))
    .source_occurrences
    .find((source) => source.source_kind === 'SERVING_REGISTRY_ENTRY');
  occurrence.source_registry_index = 999999;
  const rangeBody = clone(outOfRange.agreement_inventory);
  delete rangeBody.content_identity;
  outOfRange.agreement_inventory.content_identity.canonical_payload_sha256 =
    payloadDigest(rangeBody);
  outOfRange.agreement_inventory.content_identity.content_id = contentId(
    outOfRange.agreement_inventory.content_identity.domain,
    rangeBody,
  );
  outOfRange.agreement_inventory_admission = agreementInventoryAdmission(
    outOfRange.agreement_inventory,
  );
  outOfRange.source_catalogue_admissions = sourceCatalogueAdmissions(
    outOfRange.agreement_inventory,
    outOfRange.shared_catalogue,
    outOfRange.process_catalogue,
  );
  outOfRange.agreement_field_decisions.inventory_content_id =
    outOfRange.agreement_inventory.content_identity.content_id;
  outOfRange.agreement_alias_decisions.inventory_content_id =
    outOfRange.agreement_inventory.content_identity.content_id;
  outOfRange.enumeration_certification =
    expectedEnumerationCertification(outOfRange);
  assert.throws(
    () => buildProductFieldSourceRegistry(outOfRange),
    (error) => error.code === 'INVALID_AGREEMENT_FIELD_INVENTORY',
  );
});

test('rejects a source catalogue mutation without a separate admission', () => {
  const input = fixture();
  input.shared_catalogue.field_definitions[0].label = 'Changed deal label';

  assert.throws(
    () => buildProductFieldSourceRegistry(input),
    (error) => error.code === 'SOURCE_CATALOGUE_NOT_ADMITTED',
  );
});

test('rejects a missing or redirected Agreement alias mapping', () => {
  const missing = fixture();
  missing.agreement_alias_decisions.mappings.pop();
  missing.enumeration_certification = expectedEnumerationCertification(missing);
  assert.throws(
    () => buildProductFieldSourceRegistry(missing),
    (error) => error.code === 'INVALID_AGREEMENT_ALIAS_DECISIONS',
  );

  const redirected = fixture();
  redirected.agreement_alias_decisions.mappings[0].source_registry_index += 1;
  redirected.enumeration_certification =
    expectedEnumerationCertification(redirected);
  assert.throws(
    () => buildProductFieldSourceRegistry(redirected),
    (error) => error.code === 'INVALID_AGREEMENT_ALIAS_DECISIONS',
  );
});

test('rejects an alias collision claim with no reviewed outcome', () => {
  const input = fixture();
  input.agreement_alias_decisions.rejected_collision_claims.pop();
  input.enumeration_certification = expectedEnumerationCertification(input);

  assert.throws(
    () => buildProductFieldSourceRegistry(input),
    (error) => error.code === 'INVALID_AGREEMENT_ALIAS_DECISIONS',
  );
});

test('rejects two active fields with one reviewed meaning', () => {
  const input = fixture();
  const decisions = input.agreement_field_decisions.decisions;
  decisions[1].semantic_meaning_id = decisions[0].semantic_meaning_id;
  input.agreement_alias_decisions = agreementAliasDecisions(
    input.agreement_inventory,
    input.agreement_field_decisions,
  );
  input.enumeration_certification = expectedEnumerationCertification(input);

  assert.throws(
    () => buildProductFieldSourceRegistry(input),
    (error) => error.code === 'DUPLICATE_ACTIVE_FIELD_MEANING',
  );
});

test('rejects an included Agreement field without result support or certified data', () => {
  const noResult = fixture();
  noResult.agreement_field_decisions.decisions[0]
    .product_definition.source_permitted_result_definitions = [];
  noResult.enumeration_certification = expectedEnumerationCertification(noResult);
  assert.throws(
    () => buildProductFieldSourceRegistry(noResult),
    (error) => error.code === 'INVALID_AGREEMENT_FIELD_DECISIONS',
  );

  const noCertification = fixture();
  noCertification.agreement_field_decisions.decisions[0]
    .certified_data_identity = null;
  noCertification.enumeration_certification =
    expectedEnumerationCertification(noCertification);
  assert.throws(
    () => buildProductFieldSourceRegistry(noCertification),
    (error) => error.code === 'INVALID_AGREEMENT_FIELD_DECISIONS',
  );
});

test('rejects removal of a current PM Deal field', () => {
  const input = fixture();
  input.shared_catalogue.field_definitions.pop();
  input.shared_catalogue.current_pm_baseline_field_keys.pop();
  const sharedAdmission = input.source_catalogue_admissions.admissions.find(
    (entry) => entry.source_stable_id === input.shared_catalogue.stable_id,
  );
  sharedAdmission.source_payload_digest = payloadDigest(input.shared_catalogue);
  sharedAdmission.source_field_count =
    input.shared_catalogue.field_definitions.length;
  sharedAdmission.admission_identity.payload_digest = payloadDigest(
    Object.fromEntries(Object.entries(sharedAdmission).filter(
      ([key]) => key !== 'admission_identity',
    )),
  );
  input.enumeration_certification = expectedEnumerationCertification(input);

  assert.throws(
    () => buildProductFieldSourceRegistry(input),
    (error) => error.code === 'INVALID_SHARED_FIELD_CATALOGUE',
  );
});

test('adds a separately admitted CVR field without compiler changes', () => {
  const cvr = cvrContribution();
  const input = fixture({
    additional_source_contributions: [cvr],
  });
  const registry = buildProductFieldSourceRegistry(input);
  const cvrField = registry.field_definitions.find(
    (field) => field.field_key === 'cvr_milestone_type',
  );

  assert.ok(cvrField);
  assert.deepEqual(cvrField.supported_domains, ['CVR']);
  assert.ok(registry.field_groups.some(
    (group) => group.field_group_key === 'CVR_TERMS',
  ));
  assert.equal(registry.source_bindings.length, 4);
});

test('grants no network, database, extraction, write, serving or activation path', () => {
  const source = fs.readFileSync(
    path.join(
      ROOT,
      'lib/canonical-v2/product-field-source-registry.js',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|axios|supabase|postgres|pg\.|process\.env|\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM|[a-z_]+\s+SET)\b|writeFile|createClient|activate|production_cutover/i,
  );
});
