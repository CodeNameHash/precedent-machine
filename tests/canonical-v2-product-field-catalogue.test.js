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
  CURRENT_PM_BASELINE_FIELD_KEYS,
  buildProductFieldCatalogueManifest,
  productFieldCatalogueQueryAdmission,
  sourceRegistryPayloadDigest,
  validateProductFieldCatalogueManifest,
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProcessQueryIr,
} = require('../lib/canonical-v2/process-query-ir');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const RESULT_DEFINITIONS = Object.freeze([
  'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
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

function capabilities(source) {
  return {
    display: source.display,
    filter: source.filter,
    sort: source.sort,
    group: source.group,
    export: true,
  };
}

function sharedCompleteness(field) {
  if (field.multiplicity === 'MANY') {
    return 'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE';
  }
  return field.missing_state_behaviour;
}

function sharedSourceField(field, sourceCatalogue) {
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
      source_stable_id: sourceCatalogue.stable_id,
      source_schema_version: sourceCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function processSourceField(field, sourceCatalogue) {
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
      source_stable_id: sourceCatalogue.stable_id,
      source_schema_version: sourceCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function sourceRegistry() {
  const shared = loadJson(
    'shared/field-definitions/shared-deal-field-catalogue.v1.json',
  );
  const process = loadJson(
    'process/fields/process-field-definition-catalogue.v1.json',
  );
  const sourceBindings = [
    {
      source_stable_id: process.stable_id,
      source_schema_version: process.schema_version,
      source_payload_digest: payloadDigest(process),
      source_field_count: process.definition.field_definitions.length,
    },
    {
      source_stable_id: shared.stable_id,
      source_schema_version: shared.schema_version,
      source_payload_digest: payloadDigest(shared),
      source_field_count: shared.field_definitions.length,
    },
  ].sort((left, right) => (
    compareText(
      `${left.source_stable_id}\0${left.source_schema_version}`,
      `${right.source_stable_id}\0${right.source_schema_version}`,
    )
  ));
  const fields = [
    ...shared.field_definitions.map((field) => (
      sharedSourceField(field, shared)
    )),
    ...process.definition.field_definitions.map((field) => (
      processSourceField(field, process)
    )),
  ].sort((left, right) => (
    compareText(
      `${left.field_key}\0${left.field_version}`,
      `${right.field_key}\0${right.field_version}`,
    )
  ));
  const registry = {
    schema_version: 'PRODUCT_FIELD_SOURCE_REGISTRY/V1',
    stable_id: 'PRODUCT_FIELD_SOURCE_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: digest('approved-pm-data-version'),
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
      independent_enumeration_id: digest('independent-field-enumeration'),
      inclusion_exclusion_reconciliation_id:
        digest('field-inclusion-exclusion-reconciliation'),
    },
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest = sourceRegistryPayloadDigest(registry);
  return registry;
}

function sourceRegistryAdmission(registry) {
  return {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    canonical_payload_digest: registry.canonical_payload_digest,
    enumeration_certification: clone(registry.enumeration_certification),
  };
}

function fieldAdmission(field) {
  const permittedResultDefinitions =
    field.source_permitted_result_definitions.length > 0
      ? [...field.source_permitted_result_definitions]
      : [...RESULT_DEFINITIONS];
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    supported_domains: [...field.supported_domains],
    permitted_result_definitions: permittedResultDefinitions.sort(),
    capabilities: clone(field.capabilities),
    permitted_operators: [...field.permitted_operators],
    value_vocabulary: field.value_vocabulary_required
      ? identity(`${field.field_key.toUpperCase()}_VALUE_REGISTRY`)
      : null,
    certification_identity: identity(
      `${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`,
    ),
  };
}

function releaseAdmission(registry, previousManifest = null) {
  return {
    schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
    approved_pm_data_version_id: registry.approved_pm_data_version_id,
    candidate_release_manifest_id: digest('candidate-release-manifest'),
    candidate_release_manifest_payload_digest:
      digest('candidate-release-manifest-payload'),
    source_registry_admission: sourceRegistryAdmission(registry),
    catalogue_generator_identity:
      identity('PRODUCT_FIELD_CATALOGUE_GENERATOR'),
    shared_deal_fact_specification_identity:
      identity('SHARED_DEAL_FACT_SPECIFICATION'),
    process_specification_identity:
      identity('PROCESS_INTELLIGENCE_SPECIFICATION'),
    field_admissions: registry.field_definitions.map(fieldAdmission),
    field_exclusions: [],
    previous_catalogue_identity: previousManifest
      ? {
        manifest_id: previousManifest.manifest_id,
        payload_digest: previousManifest.canonical_payload_digest,
      }
      : null,
  };
}

function resignRegistry(registry) {
  registry.field_definitions.sort((left, right) => (
    compareText(
      `${left.field_key}\0${left.field_version}`,
      `${right.field_key}\0${right.field_version}`,
    )
  ));
  for (const source of registry.source_bindings) {
    source.source_field_count = registry.field_definitions.filter(
      (field) => (
        field.source_binding.source_stable_id === source.source_stable_id
        && field.source_binding.source_schema_version
          === source.source_schema_version
      ),
    ).length + registry.source_exclusions.filter(
      (entry) => (
        entry.source_binding.source_stable_id === source.source_stable_id
        && entry.source_binding.source_schema_version
          === source.source_schema_version
      ),
    ).length;
  }
  registry.canonical_payload_digest = sourceRegistryPayloadDigest(registry);
  return registry;
}

function manifestInputs() {
  const registry = sourceRegistry();
  return {
    source_registry: registry,
    release_admission: releaseAdmission(registry),
  };
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function processQueryAdmission(productFieldCatalogue) {
  return {
    schema_version: PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('approved-pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release-manifest'),
    candidate_release_manifest_payload_digest:
      digest('candidate-release-manifest-payload'),
    canonical_contract_identity:
      identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue: productFieldCatalogue,
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('product-navigation-catalogue'),
      payload_digest: digest('product-navigation-catalogue-payload'),
    },
    predicate_admissions: [{
      domain_key: 'PROCESS',
      predicate_key: 'EXCLUSIVITY_GRANTED',
      predicate_version: 1,
      admission_id: digest('exclusivity-granted-admission'),
      result_definitions: [{
        stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
        version: 1,
      }],
      evidence_requirement_ids: [
        'EXACT_PASSAGE',
        'EXACT_SOURCE_CITATION',
      ],
    }],
    exact_detail_actions: ['PARENT_BOUND_PARAGRAPH_CONTEXT'],
    coverage_identities: [digest('coverage')],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function sectorQuery() {
  return {
    domain_key: 'PROCESS',
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    result_definition: {
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    },
    evidence_requirement_ids: [
      'EXACT_PASSAGE',
      'EXACT_SOURCE_CITATION',
    ],
    cohort: {
      cohort_definition_id: digest('cohort'),
      cohort_definition_payload_digest: digest('cohort-payload'),
    },
    filters: [{
      field_key: 'sector',
      field_version: 1,
      operator: 'IN',
      value: ['Biopharma'],
    }],
    sort: [{
      field_key: 'signed',
      field_version: 1,
      direction: 'DESC',
    }],
    diversity: {
      definition_id: digest('diversity'),
      payload_digest: digest('diversity-payload'),
    },
    requested_columns: [
      {
        field_key: 'deal',
        field_version: 1,
      },
      {
        field_key: 'actual_drafting',
        field_version: 1,
      },
    ],
    pagination: {
      page_size: 25,
      cursor: null,
    },
    detail_actions: ['PARENT_BOUND_PARAGRAPH_CONTEXT'],
    coverage: {
      coverage_identity: digest('coverage'),
      coverage_payload_digest: digest('coverage-payload'),
      covered_set_identity: digest('covered-set'),
      exclusions_identity: digest('coverage-exclusions'),
    },
  };
}

test('builds one deterministic PM-wide manifest from the real 15 plus 12 fields', () => {
  const first = buildProductFieldCatalogueManifest(manifestInputs());
  const second = buildProductFieldCatalogueManifest(manifestInputs());

  assert.equal(first.manifest_id, second.manifest_id);
  assert.equal(
    first.canonical_payload_digest,
    second.canonical_payload_digest,
  );
  assert.equal(first.field_definitions.length, 27);
  assert.deepEqual(
    first.field_definitions
      .filter((field) => CURRENT_PM_BASELINE_FIELD_KEYS.includes(field.field_key))
      .map((field) => field.field_key)
      .sort(),
    [...CURRENT_PM_BASELINE_FIELD_KEYS].sort(),
  );
  assert.equal(first.counts.source_field_count, 27);
  assert.equal(first.counts.admitted_field_count, 27);
  assertDeepFrozen(first);
});

test('emits the exact narrow projection consumed by the shared Query IR', () => {
  const manifest = buildProductFieldCatalogueManifest(manifestInputs());
  const catalogue = productFieldCatalogueQueryAdmission(manifest);
  const query = compileProcessQueryIr({
    admission: processQueryAdmission(catalogue),
    query: sectorQuery(),
  });

  assert.equal(catalogue.stable_id, 'PRODUCT_FIELD_CATALOGUE');
  assert.equal(catalogue.field_definitions.length, 27);
  assert.equal(
    query.filter_contract.clauses[0].field_key,
    'sector',
  );
  assert.equal(
    query.presentation_contract.requested_columns[1].field_key,
    'actual_drafting',
  );
});

test('rejects a changed self-rehashed registry without its checked admission', () => {
  const inputs = manifestInputs();
  inputs.source_registry.field_definitions.find(
    (field) => field.field_key === 'sector',
  ).label = 'Changed sector label';
  resignRegistry(inputs.source_registry);

  assert.throws(
    () => buildProductFieldCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
  );
});

test('rejects a missing current PM field even when counts and digest reconcile', () => {
  const registry = sourceRegistry();
  registry.field_definitions = registry.field_definitions.filter(
    (field) => field.field_key !== 'lawyers_target',
  );
  resignRegistry(registry);

  assert.throws(
    () => buildProductFieldCatalogueManifest({
      source_registry: registry,
      release_admission: releaseAdmission(registry),
    }),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_SOURCE_REGISTRY',
  );
});

test('rejects silent release loss and exclusion of a current PM field', () => {
  const inputs = manifestInputs();
  inputs.release_admission.field_admissions =
    inputs.release_admission.field_admissions.filter(
      (field) => field.field_key !== 'process_phase',
    );
  assert.throws(
    () => buildProductFieldCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
  );

  const baselineInputs = manifestInputs();
  const excluded = baselineInputs.release_admission.field_admissions.find(
    (field) => field.field_key === 'sector',
  );
  baselineInputs.release_admission.field_admissions =
    baselineInputs.release_admission.field_admissions.filter(
      (field) => field.field_key !== 'sector',
    );
  baselineInputs.release_admission.field_exclusions = [{
    field_key: excluded.field_key,
    field_version: excluded.field_version,
    reason_code: 'NOT_CERTIFIED',
    evidence_identity: identity('SECTOR_EXCLUSION_EVIDENCE'),
  }];
  assert.throws(
    () => buildProductFieldCatalogueManifest(baselineInputs),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
  );
});

test('allows an express non-baseline exclusion and records its reason', () => {
  const inputs = manifestInputs();
  const excluded = inputs.release_admission.field_admissions.find(
    (field) => field.field_key === 'process_channel',
  );
  inputs.release_admission.field_admissions =
    inputs.release_admission.field_admissions.filter(
      (field) => field.field_key !== 'process_channel',
    );
  inputs.release_admission.field_exclusions = [{
    field_key: excluded.field_key,
    field_version: excluded.field_version,
    reason_code: 'NO_CERTIFIED_DATA_IN_RELEASE',
    evidence_identity: identity('PROCESS_CHANNEL_EXCLUSION_EVIDENCE'),
  }];

  const manifest = buildProductFieldCatalogueManifest(inputs);
  assert.equal(manifest.field_definitions.length, 26);
  assert.deepEqual(
    manifest.release_exclusions.map((entry) => [
      entry.field_key,
      entry.reason_code,
    ]),
    [['process_channel', 'NO_CERTIFIED_DATA_IN_RELEASE']],
  );
  assert.equal(manifest.counts.source_field_count, 27);
});

test('rejects capability, operator, domain and result-definition expansion', () => {
  const cases = [
    (inputs) => {
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'actual_drafting',
      ).capabilities.filter = true;
    },
    (inputs) => {
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'sector',
      ).permitted_operators.push('RAW_SQL');
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'sector',
      ).permitted_operators.sort();
    },
    (inputs) => {
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'process_phase',
      ).supported_domains.push('CVR');
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'process_phase',
      ).supported_domains.sort();
    },
    (inputs) => {
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'process_phase',
      ).permitted_result_definitions.push('INVENTED_RESULT');
      inputs.release_admission.field_admissions.find(
        (field) => field.field_key === 'process_phase',
      ).permitted_result_definitions.sort();
    },
  ];
  for (const mutate of cases) {
    const inputs = manifestInputs();
    mutate(inputs);
    assert.throws(
      () => buildProductFieldCatalogueManifest(inputs),
      (error) => error.code === 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
    );
  }
});

test('requires a field-version change when a released meaning changes', () => {
  const firstInputs = manifestInputs();
  const first = buildProductFieldCatalogueManifest(firstInputs);
  const nextRegistry = sourceRegistry();
  nextRegistry.field_definitions.find(
    (field) => field.field_key === 'sector',
  ).label = 'Sector classification';
  resignRegistry(nextRegistry);

  assert.throws(
    () => buildProductFieldCatalogueManifest({
      source_registry: nextRegistry,
      release_admission: releaseAdmission(nextRegistry, first),
      previous_manifest: first,
    }),
    (error) => error.code === 'PRODUCT_FIELD_VERSION_NOT_BUMPED',
  );
});

test('records an approved version change against the prior manifest', () => {
  const first = buildProductFieldCatalogueManifest(manifestInputs());
  const nextRegistry = sourceRegistry();
  const sector = nextRegistry.field_definitions.find(
    (field) => field.field_key === 'sector',
  );
  sector.label = 'Sector classification';
  sector.field_version = 2;
  sector.source_binding.source_field_version = 2;
  resignRegistry(nextRegistry);

  const next = buildProductFieldCatalogueManifest({
    source_registry: nextRegistry,
    release_admission: releaseAdmission(nextRegistry, first),
    previous_manifest: first,
  });
  assert.deepEqual(
    next.difference.changed_fields.map((field) => field.field_key),
    ['sector'],
  );
  assert.equal(
    next.field_definitions.find((field) => field.field_key === 'sector')
      .field_version,
    2,
  );
});

test('rejects a field version that moves backwards', () => {
  const newerRegistry = sourceRegistry();
  const newerSector = newerRegistry.field_definitions.find(
    (field) => field.field_key === 'sector',
  );
  newerSector.field_version = 2;
  newerSector.source_binding.source_field_version = 2;
  resignRegistry(newerRegistry);
  const newer = buildProductFieldCatalogueManifest({
    source_registry: newerRegistry,
    release_admission: releaseAdmission(newerRegistry),
  });
  const olderRegistry = sourceRegistry();

  assert.throws(
    () => buildProductFieldCatalogueManifest({
      source_registry: olderRegistry,
      release_admission: releaseAdmission(olderRegistry, newer),
      previous_manifest: newer,
    }),
    (error) => error.code === 'PRODUCT_FIELD_VERSION_NOT_FORWARD',
  );
});

test('admits a future CVR field without a generator code change', () => {
  const registry = sourceRegistry();
  registry.source_bindings.push({
    source_stable_id: 'CVR_FIELD_CATALOGUE',
    source_schema_version: 'DOMAIN_FIELD_CATALOGUE_INPUT/V1',
    source_payload_digest: digest('cvr-field-catalogue'),
    source_field_count: 1,
  });
  registry.source_bindings.sort((left, right) => (
    compareText(
      `${left.source_stable_id}\0${left.source_schema_version}`,
      `${right.source_stable_id}\0${right.source_schema_version}`,
    )
  ));
  registry.field_groups.push({
    field_group_key: 'CVR_TERMS',
    label: 'CVR terms',
    sort_ordinal: registry.field_groups.length + 1,
  });
  registry.field_definitions.push({
    field_key: 'cvr_milestone',
    field_version: 1,
    label: 'CVR milestone',
    field_group: 'CVR_TERMS',
    value_type: 'VERBATIM_TEXT',
    control_type: 'SEARCH_TEXT',
    supported_domains: ['CVR'],
    source_permitted_result_definitions: ['CVR_PHRASEBOOK_PASSAGE_RESULT'],
    capabilities: {
      display: true,
      filter: true,
      sort: false,
      group: false,
      export: true,
    },
    permitted_operators: ['SEARCH'],
    filter_scope: 'SAME_CVR_COMPONENT',
    multiplicity: 'ONE_OR_MORE',
    completeness_semantics: 'UNKNOWN_IF_COLLECTION_INCOMPLETE',
    source_requirement: 'EXACT_CVR_SOURCE_PASSAGE_REQUIRED',
    derivation_requirement: 'NO_NARRATIVE_SUBSTITUTION',
    unavailable_reason: 'CVR_FIELD_NOT_ADMITTED_IN_SELECTED_RELEASE',
    value_vocabulary_required: false,
    source_binding: {
      source_stable_id: 'CVR_FIELD_CATALOGUE',
      source_schema_version: 'DOMAIN_FIELD_CATALOGUE_INPUT/V1',
      source_field_key: 'cvr_milestone',
      source_field_version: 1,
    },
  });
  resignRegistry(registry);

  const manifest = buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: releaseAdmission(registry),
  });
  const cvrField = manifest.field_definitions.find(
    (field) => field.field_key === 'cvr_milestone',
  );
  assert.equal(manifest.field_definitions.length, 28);
  assert.deepEqual(cvrField.supported_domains, ['CVR']);
  assert.equal(cvrField.filter_scope, 'SAME_CVR_COMPONENT');
});

test('detects manifest changes and previous-catalogue substitution', () => {
  const first = buildProductFieldCatalogueManifest(manifestInputs());
  const changed = clone(first);
  changed.field_definitions.find(
    (field) => field.field_key === 'sector',
  ).label = 'Changed after compilation';
  assert.throws(
    () => validateProductFieldCatalogueManifest(changed),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_CATALOGUE_MANIFEST',
  );

  const hidden = clone(first);
  hidden.basis.hidden_authority = true;
  const hiddenBody = clone(hidden);
  delete hiddenBody.manifest_id;
  delete hiddenBody.canonical_payload_digest;
  hidden.manifest_id = contentId(
    'PRODUCT_FIELD_CATALOGUE_MANIFEST/V1',
    hiddenBody,
  );
  hidden.canonical_payload_digest = contentId(
    'PRODUCT_FIELD_CATALOGUE_MANIFEST_PAYLOAD/V1',
    hiddenBody,
  );
  assert.throws(
    () => validateProductFieldCatalogueManifest(hidden),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_CATALOGUE_MANIFEST',
  );

  const nextRegistry = sourceRegistry();
  const nextAdmission = releaseAdmission(nextRegistry, first);
  nextAdmission.previous_catalogue_identity.manifest_id =
    digest('wrong-previous-manifest');
  assert.throws(
    () => buildProductFieldCatalogueManifest({
      source_registry: nextRegistry,
      release_admission: nextAdmission,
      previous_manifest: first,
    }),
    (error) => error.code === 'INVALID_PRODUCT_FIELD_RELEASE_ADMISSION',
  );
});
