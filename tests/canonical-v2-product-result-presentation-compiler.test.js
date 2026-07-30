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
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProductQueryIr,
} = require('../lib/canonical-v2/product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
  PRODUCT_RESULT_PRESENTATION_SCHEMA,
  PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
  canonicalProductResultPresentationBytes,
  compileProductResultPresentation,
  validateProductResultPresentation,
} = require(
  '../lib/canonical-v2/product-result-presentation-compiler',
);

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const RESULT_DEFINITIONS = Object.freeze([
  'AGREEMENT_COMPARABLE_RESULT',
  'CVR_MILESTONE_RESULT',
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
const DOMAIN_CONFIG = Object.freeze({
  AGREEMENT: Object.freeze({
    predicate_key: 'TRANSACTION_STRUCTURE',
    result_definition: Object.freeze({
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    }),
    detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    evidence: Object.freeze([
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ]),
    filter_field: 'structure',
    filter_value: 'MERGER',
    requested_fields: Object.freeze([
      'buyer',
      'deal',
      'law_firm',
      'merger_form',
      'structure',
      'type',
      'value',
    ]),
    representation_kind: 'STRUCTURED_RESULT',
  }),
  PROCESS: Object.freeze({
    predicate_key: 'EXCLUSIVITY_GRANTED',
    result_definition: Object.freeze({
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }),
    detail_action: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    evidence: Object.freeze([
      'EXACT_PASSAGE',
      'EXACT_SOURCE_CITATION',
    ]),
    filter_field: 'process_phase',
    filter_value: 'PRE_SIGNING',
    requested_fields: Object.freeze([
      'deal',
      'law_firm',
      'process_phase',
      'structure',
      'value',
    ]),
    representation_kind: 'VERBATIM_TEXT',
  }),
});

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
  ].sort((left, right) => compareText(
    `${left.source_stable_id}\0${left.source_schema_version}`,
    `${right.source_stable_id}\0${right.source_schema_version}`,
  ));
  const fields = [
    ...shared.field_definitions.map((field) => (
      sharedSourceField(field, shared)
    )),
    ...process.definition.field_definitions.map((field) => (
      processSourceField(field, process)
    )),
  ].sort((left, right) => compareText(
    `${left.field_key}\0${left.field_version}`,
    `${right.field_key}\0${right.field_version}`,
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
      independent_enumeration_id: digest('field-enumeration'),
      inclusion_exclusion_reconciliation_id:
        digest('field-reconciliation'),
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
    certification_identity:
      identity(`${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`),
  };
}

function productFieldManifest() {
  const registry = sourceRegistry();
  return buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: {
      schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
      approved_pm_data_version_id: registry.approved_pm_data_version_id,
      candidate_release_manifest_id:
        digest('candidate-release-manifest'),
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
      previous_catalogue_identity: null,
    },
  });
}

function predicateAdmission(domain, config) {
  return {
    domain_key: domain,
    predicate_key: config.predicate_key,
    predicate_version: 1,
    admission_id: digest(`admission:${domain}`),
    result_definitions: [clone(config.result_definition)],
    evidence_requirement_ids: [...config.evidence],
  };
}

function queryAdmission(manifest) {
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: manifest.approved_pm_data_version_id,
    candidate_release_manifest_id:
      manifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      manifest.candidate_release_manifest_payload_digest,
    canonical_contract_identity:
      identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue:
      productFieldCatalogueQueryAdmission(manifest),
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-catalogue'),
      payload_digest: digest('navigation-payload'),
    },
    predicate_admissions: Object.entries(DOMAIN_CONFIG)
      .map(([domain, config]) => predicateAdmission(domain, config)),
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
    ],
    coverage_identities: [
      digest('coverage:AGREEMENT'),
      digest('coverage:PROCESS'),
    ],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function fieldReference(fieldKey) {
  return {
    field_key: fieldKey,
    field_version: 1,
  };
}

function queryIr(domain, manifest) {
  const config = DOMAIN_CONFIG[domain];
  const query = {
    domain_key: domain,
    predicate_key: config.predicate_key,
    predicate_version: 1,
    result_definition: clone(config.result_definition),
    evidence_requirement_ids: [...config.evidence],
    cohort: {
      cohort_definition_id: digest(`cohort:${domain}`),
      cohort_definition_payload_digest:
        digest(`cohort-payload:${domain}`),
    },
    filters: [{
      field_key: config.filter_field,
      field_version: 1,
      operator: 'EQ',
      value: config.filter_value,
    }],
    sort: [{
      field_key: 'deal',
      field_version: 1,
      direction: 'ASC',
    }],
    diversity: {
      definition_id: digest(`diversity:${domain}`),
      payload_digest: digest(`diversity-payload:${domain}`),
    },
    requested_columns:
      config.requested_fields.map(fieldReference),
    pagination: {
      page_size: 12,
      cursor: null,
    },
    detail_actions: [config.detail_action],
    coverage: {
      coverage_identity: digest(`coverage:${domain}`),
      coverage_payload_digest:
        digest(`coverage-payload:${domain}`),
      covered_set_identity: digest(`covered:${domain}`),
      exclusions_identity: digest(`exclusions:${domain}`),
    },
  };
  return compileProductQueryIr({
    admission: queryAdmission(manifest),
    query,
  });
}

function understoodQuestion(domain) {
  const config = DOMAIN_CONFIG[domain];
  return {
    domain_key: domain,
    topic_key: domain === 'PROCESS'
      ? 'DEAL_PROTECTION_PROCESS'
      : 'TRANSACTION_FORMS',
    pattern_key: domain === 'PROCESS'
      ? 'EXCLUSIVITY_GRANTED'
      : 'TRANSACTION_STRUCTURE',
    predicate_key: config.predicate_key,
    predicate_version: 1,
    label: domain === 'PROCESS'
      ? 'Exclusivity granted'
      : 'Transaction structure',
  };
}

function resultIdentityInputs(ir, domain, ordinal) {
  const config = DOMAIN_CONFIG[domain];
  return {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: domain,
    domain_result_definition_stable_id:
      config.result_definition.stable_id,
    domain_result_definition_version:
      config.result_definition.version,
    domain_result_identity:
      digest(`domain-result:${domain}:${ordinal}`),
  };
}

function domainValidation(domain, payload) {
  const validatedPayloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const body = {
    validator_stable_id: `${domain}_RESULT_VALIDATOR`,
    validator_version: 1,
    validated_payload_digest: validatedPayloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    validator_stable_id: body.validator_stable_id,
    validator_version: body.validator_version,
    validation_receipt_id: contentId(
      PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      body,
    ),
    validated_payload_digest: body.validated_payload_digest,
    validation_state: body.validation_state,
  };
}

function resultValues(domain, ordinal, overrides = {}) {
  const defaults = domain === 'PROCESS'
    ? {
      deal: ordinal === 1 ? 'Metsera, Inc.' : `Process deal ${ordinal}`,
      law_firm: [{
        firm_name: 'Goodwin Procter LLP',
        represented_party: 'TARGET',
        role: 'LEGAL_COUNSEL',
        source_identity: digest(`law-firm-source:${ordinal}`),
      }],
      process_phase: 'PRE_SIGNING',
      structure: 'MERGER',
      value: {
        amount: 4700000000,
        currency: 'USD',
        basis: 'EQUITY_VALUE',
        source_identity: digest(`press-release:${ordinal}`),
      },
    }
    : {
      buyer: 'Buyer Corp.',
      deal: `Agreement deal ${ordinal}`,
      law_firm: [{
        firm_name: 'Wachtell, Lipton, Rosen & Katz',
        represented_party: 'TARGET',
        role: 'LEGAL_COUNSEL',
        source_identity: digest(`agreement-counsel:${ordinal}`),
      }],
      merger_form: 'FORWARD_MERGER',
      structure: 'MERGER',
      type: 'CASH',
      value: {
        amount: 1000000000,
        currency: 'USD',
        basis: 'EQUITY_VALUE',
        source_identity: digest(`agreement-value:${ordinal}`),
      },
    };
  return {
    ...defaults,
    ...overrides,
  };
}

function productResult(
  domain,
  ir,
  ordinal = 1,
  valueOverrides = {},
) {
  const config = DOMAIN_CONFIG[domain];
  const values = resultValues(domain, ordinal, valueOverrides);
  const payload = domain === 'PROCESS'
    ? (
      ordinal === 1
        ? 'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.'
        : `Exact Process precedent passage ${ordinal}.`
    )
    : {
      checked_transaction_structure: values.structure,
      checked_transaction_type: values.type,
    };
  const payloadDigestValue = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const identityInputs = resultIdentityInputs(ir, domain, ordinal);
  const productResultIdentity = contentId(
    PRODUCT_QUERY_RESULT_SCHEMA,
    identityInputs,
  );
  const sourceDocumentIdentity =
    digest(`source-document:${domain}:${ordinal}`);
  const sourceEvidenceIdentity =
    digest(`source-evidence:${domain}:${ordinal}`);
  const citationTargetIdentity = contentId(
    PRODUCT_EXACT_CITATION_SCHEMA,
    {
      product_query_result_identity: productResultIdentity,
      candidate_release_manifest_id:
        identityInputs.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        identityInputs.candidate_release_manifest_payload_digest,
      source_document_identity: sourceDocumentIdentity,
      source_evidence_identity: sourceEvidenceIdentity,
    },
  );
  const resultFields = ir.presentation_contract.requested_columns.map(
    (reference) => ({
      field_reference: clone(reference),
      value: clone(values[reference.field_key]),
    }),
  );
  return {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_result_identity: productResultIdentity,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      identityInputs.approved_pm_data_version_id,
    candidate_release_manifest_id:
      identityInputs.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      identityInputs.candidate_release_manifest_payload_digest,
    domain_key: domain,
    domain_result_definition: clone(config.result_definition),
    domain_result_identity: identityInputs.domain_result_identity,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigestValue,
    domain_result_validation: domainValidation(domain, payload),
    domain_result_source_representation_kind:
      config.representation_kind,
    exact_citation: {
      schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
      source_document_identity: sourceDocumentIdentity,
      source_evidence_identity: sourceEvidenceIdentity,
      source_representation_kind: config.representation_kind,
      source_interval: domain === 'PROCESS'
        ? {
          start_utf8_byte: ordinal * 100,
          end_utf8_byte: (ordinal * 100)
            + Buffer.byteLength(payload, 'utf8'),
          exact_text_digest: payloadDigestValue,
        }
        : null,
      result_component_evidence_identity: domain === 'PROCESS'
        ? null
        : digest(`component-evidence:${ordinal}`),
      source_accession_or_equivalent_identity:
        `ACCESSION-${domain}-${ordinal}`,
      source_filing_type: domain === 'PROCESS' ? 'DEFM14A' : '8-K',
      source_filing_date: '2025-09-22',
      source_location_label: `Section ${ordinal}.01`,
      human_readable_source_label:
        `${domain} source, Section ${ordinal}.01`,
      citation_target_identity: citationTargetIdentity,
    },
    exact_detail_action: config.detail_action,
    query_provenance: {
      filter_contract: clone(ir.filter_contract),
      filter_contract_digest: sha256Hex(Buffer.from(
        canonicalJson(ir.filter_contract),
        'utf8',
      )),
      coverage_contract: clone(ir.coverage_contract),
      coverage_contract_digest: sha256Hex(Buffer.from(
        canonicalJson(ir.coverage_contract),
        'utf8',
      )),
      requested_field_references:
        clone(ir.presentation_contract.requested_columns),
    },
    result_fields: resultFields,
  };
}

function validSlot(result) {
  return {
    slot_identity: result.product_query_result_identity,
    slot_state: 'VALID',
    product_query_result: result,
    failure: null,
  };
}

function failure(label = 'invalid-domain-result') {
  const body = {
    schema_version: PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
    disposition: 'INVALID_DOMAIN_RESULT',
    failed_domain_result_identity: digest(label),
  };
  return {
    schema_version: body.schema_version,
    failure_identity: contentId(
      PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
      body,
    ),
    disposition: body.disposition,
    failed_domain_result_identity:
      body.failed_domain_result_identity,
  };
}

function failedSlot(label) {
  const value = failure(label);
  return {
    slot_identity: value.failure_identity,
    slot_state: 'UNAVAILABLE',
    product_query_result: null,
    failure: value,
  };
}

function executionSummary(
  ir,
  {
    valid = 1,
    failed = 0,
    excluded = 0,
    coverage = 'CERTIFIED_COMPLETE',
    operational = 'COMPLETE',
  } = {},
) {
  const body = {
    schema_version: PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    query_coverage_identity: ir.coverage_contract.coverage_identity,
    coverage_certification_state: coverage,
    coverage_certification_identity:
      digest(`coverage-certification:${coverage}`),
    covered_deal_count: 12,
    excluded_deal_count: 2,
    valid_result_count: valid,
    failed_result_count: failed,
    excluded_result_count: excluded,
    total_result_count: valid + failed + excluded,
    operational_state: operational,
  };
  return {
    schema_version: body.schema_version,
    query_execution_summary_id: contentId(
      PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
      body,
    ),
    product_query_definition_id:
      body.product_query_definition_id,
    query_coverage_identity: body.query_coverage_identity,
    coverage_certification_state:
      body.coverage_certification_state,
    coverage_certification_identity:
      body.coverage_certification_identity,
    covered_deal_count: body.covered_deal_count,
    excluded_deal_count: body.excluded_deal_count,
    valid_result_count: body.valid_result_count,
    failed_result_count: body.failed_result_count,
    excluded_result_count: body.excluded_result_count,
    total_result_count: body.total_result_count,
    operational_state: body.operational_state,
  };
}

function compileFixture(
  domain = 'PROCESS',
  {
    slots,
    summary,
    manifest = productFieldManifest(),
  } = {},
) {
  const ir = queryIr(domain, manifest);
  const resultSlots = slots || [validSlot(productResult(domain, ir))];
  return compileProductResultPresentation({
    understood_legal_question: understoodQuestion(domain),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: resultSlots,
    query_execution_summary:
      summary || executionSummary(ir, {
        valid: resultSlots.filter(
          (slot) => slot.slot_state === 'VALID',
        ).length,
        failed: resultSlots.filter(
          (slot) => slot.slot_state === 'UNAVAILABLE',
        ).length,
      }),
  });
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function rehashPresentation(presentation) {
  const identityInputs = clone(presentation.identity_inputs);
  presentation.product_result_presentation_id = contentId(
    PRODUCT_RESULT_PRESENTATION_SCHEMA,
    identityInputs,
  );
  const body = clone(presentation);
  delete body.product_result_presentation_id;
  delete body.canonical_payload_digest;
  presentation.canonical_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(body),
    'utf8',
  ));
  return presentation;
}

test('compiles one immutable answer-first Metsera presentation', () => {
  const first = compileFixture();
  const second = compileFixture();

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(first.schema_version, PRODUCT_RESULT_PRESENTATION_SCHEMA);
  assert.equal(first.view_contract.default_view, 'ANSWER_FIRST_PASSAGES');
  assert.deepEqual(
    first.view_contract.permitted_views,
    ['ANSWER_FIRST_PASSAGES', 'DENSE_TABLE'],
  );
  assert.equal(first.result_slots.length, 1);
  assert.equal(
    first.result_slots[0].exact_content,
    'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.',
  );
  assert.equal(first.result_slots[0].preview.truncated, false);
  assert.equal(first.renderer_contract.generated_narrative_permitted, false);
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(validateProductResultPresentation(first), true);
  assert.equal(
    canonicalProductResultPresentationBytes(first).toString('utf8'),
    canonicalJson(first),
  );
});

test('uses one checked payload for passage and dense-table views', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('PROCESS', manifest);
  const slots = Array.from(
    { length: 8 },
    (_, index) => validSlot(productResult('PROCESS', ir, index + 1)),
  );
  const presentation = compileProductResultPresentation({
    understood_legal_question: understoodQuestion('PROCESS'),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: slots,
    query_execution_summary: executionSummary(ir, { valid: 8 }),
  });

  assert.equal(presentation.result_slots.length, 8);
  assert.deepEqual(
    presentation.ordered_product_result_slot_identities,
    slots.map((slot) => slot.slot_identity),
  );
  assert.deepEqual(
    presentation.columns.map((column) => column.field_reference),
    ir.presentation_contract.requested_columns,
  );
  for (const slot of presentation.result_slots) {
    assert.deepEqual(
      slot.metadata.map((field) => field.field_reference),
      ir.presentation_contract.requested_columns,
    );
  }
  assert.equal(
    presentation.view_contract.second_query_required_for_view_switch,
    false,
  );
});

test('uses one compact editable filter sentence and no pill collection', () => {
  const presentation = compileFixture();
  const sentence = presentation.filter_sentence;

  assert.equal(
    sentence.rendering_mode,
    'ONE_COMPACT_PRACTITIONER_SENTENCE',
  );
  assert.equal(sentence.subject.label, 'Exclusivity granted');
  assert.equal(sentence.subject.editable, true);
  assert.equal(sentence.ordered_filter_segments.length, 1);
  assert.equal(
    sentence.ordered_filter_segments[0].field_label,
    'Process phase',
  );
  assert.equal(
    sentence.ordered_filter_segments[0].practitioner_operator,
    'is',
  );
  assert.equal(sentence.ordered_filter_segments[0].editable, true);
  assert.equal(sentence.ordered_filter_segments[0].clearable, true);
  assert.equal(sentence.decorative_pill_collection, false);
  assert.equal(
    sentence.edit_disposition,
    'REQUIRES_NEW_CHECKED_QUERY',
  );
});

test('retains a typed failed slot and every valid sibling', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('PROCESS', manifest);
  const slots = [
    validSlot(productResult('PROCESS', ir, 1)),
    failedSlot('bad-process-result'),
    validSlot(productResult('PROCESS', ir, 2)),
  ];
  const presentation = compileProductResultPresentation({
    understood_legal_question: understoodQuestion('PROCESS'),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: slots,
    query_execution_summary: executionSummary(ir, {
      valid: 2,
      failed: 1,
    }),
  });

  assert.deepEqual(
    presentation.result_slots.map((slot) => slot.slot_state),
    ['VALID', 'UNAVAILABLE', 'VALID'],
  );
  assert.equal(
    presentation.result_slots[1].failure.disposition,
    'INVALID_DOMAIN_RESULT',
  );
  assert.equal(presentation.counts.valid_result_count, 2);
  assert.equal(presentation.counts.failed_result_count, 1);
  assert.equal(presentation.counts.emitted_result_slot_count, 3);
  assert.equal(presentation.empty_result.disposition, null);
});

test('states a bounded zero result only for complete checked coverage', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('PROCESS', manifest);
  const complete = compileProductResultPresentation({
    understood_legal_question: understoodQuestion('PROCESS'),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: [],
    query_execution_summary: executionSummary(ir, {
      valid: 0,
      excluded: 2,
    }),
  });
  const incomplete = compileProductResultPresentation({
    understood_legal_question: understoodQuestion('PROCESS'),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: [],
    query_execution_summary: executionSummary(ir, {
      valid: 0,
      excluded: 2,
      coverage: 'CERTIFIED_INCOMPLETE',
    }),
  });

  assert.equal(
    complete.empty_result.disposition,
    'NO_RESULTS_IN_COVERED_DEALS',
  );
  assert.equal(
    complete.empty_result.user_message,
    'No results in the covered deals',
  );
  assert.equal(complete.empty_result.market_absence_claim, false);
  assert.equal(incomplete.empty_result.disposition, null);
  assert.equal(
    incomplete.coverage.coverage_claim,
    'INCOMPLETE_FOR_CHECKED_COVERED_SET',
  );
});

test('refuses operational failure instead of rendering zero results', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('PROCESS', manifest);
  assert.throws(
    () => compileProductResultPresentation({
      understood_legal_question: understoodQuestion('PROCESS'),
      product_query_ir: ir,
      product_field_catalogue_manifest: manifest,
      ordered_result_slots: [],
      query_execution_summary: executionSummary(ir, {
        valid: 0,
        operational: 'FAILED',
      }),
    }),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );
});

test('preserves exact shared facts, sources, roles and value basis', () => {
  const presentation = compileFixture();
  const metadata = new Map(
    presentation.result_slots[0].metadata.map(
      (field) => [field.field_reference.field_key, field],
    ),
  );

  assert.deepEqual(metadata.get('law_firm').value, [{
    firm_name: 'Goodwin Procter LLP',
    represented_party: 'TARGET',
    role: 'LEGAL_COUNSEL',
    source_identity: digest('law-firm-source:1'),
  }]);
  assert.deepEqual(metadata.get('value').value, {
    amount: 4700000000,
    currency: 'USD',
    basis: 'EQUITY_VALUE',
    source_identity: digest('press-release:1'),
  });
  assert.equal(
    presentation.result_slots[0].action_targets[0].action_kind,
    'OPEN_SOURCE',
  );
  assert.equal(
    presentation.result_slots[0].action_targets.every(
      (action) => (
        action.authority_state === 'NOT_GRANTED'
        && action.accessible_name.length > 0
        && action.action_state === 'AVAILABLE'
      ),
    ),
    true,
  );
});

test('keeps merger-of-equals, reverse merger, RMT and share purchase facts separate', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('AGREEMENT', manifest);
  const structures = [
    {
      buyer: {
        state: 'NOT_APPLICABLE',
        checked_evidence_identity: digest('no-buyer-role'),
      },
      merger_form: 'MERGER_OF_EQUALS',
      structure: 'MERGER_OF_EQUALS',
      type: 'STOCK',
    },
    {
      merger_form: 'REVERSE_MERGER',
      structure: 'REVERSE_MERGER',
      type: 'STOCK',
    },
    {
      merger_form: 'REVERSE_MORRIS_TRUST',
      structure: 'REVERSE_MORRIS_TRUST',
      type: 'STOCK',
    },
    {
      merger_form: 'NOT_APPLICABLE',
      structure: 'SHARE_PURCHASE',
      type: 'SHARE_PURCHASE',
    },
  ];
  const slots = structures.map((values, index) => validSlot(
    productResult('AGREEMENT', ir, index + 1, values),
  ));
  const presentation = compileProductResultPresentation({
    understood_legal_question: understoodQuestion('AGREEMENT'),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: slots,
    query_execution_summary: executionSummary(ir, { valid: 4 }),
  });

  const rows = presentation.result_slots.map((slot) => Object.fromEntries(
    slot.metadata.map(
      (field) => [field.field_reference.field_key, field.value],
    ),
  ));
  assert.equal(rows[0].buyer.state, 'NOT_APPLICABLE');
  assert.equal(rows[0].structure, 'MERGER_OF_EQUALS');
  assert.equal(rows[1].structure, 'REVERSE_MERGER');
  assert.equal(rows[2].structure, 'REVERSE_MORRIS_TRUST');
  assert.equal(rows[3].structure, 'SHARE_PURCHASE');
  assert.equal(rows[3].type, 'SHARE_PURCHASE');
});

test('rejects silent missing values, duplicate slots and more than 12 valid results', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('PROCESS', manifest);
  const missing = productResult('PROCESS', ir);
  missing.result_fields[0].value = null;
  assert.throws(
    () => compileProductResultPresentation({
      understood_legal_question: understoodQuestion('PROCESS'),
      product_query_ir: ir,
      product_field_catalogue_manifest: manifest,
      ordered_result_slots: [validSlot(missing)],
      query_execution_summary: executionSummary(ir),
    }),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );

  const one = validSlot(productResult('PROCESS', ir));
  assert.throws(
    () => compileProductResultPresentation({
      understood_legal_question: understoodQuestion('PROCESS'),
      product_query_ir: ir,
      product_field_catalogue_manifest: manifest,
      ordered_result_slots: [one, clone(one)],
      query_execution_summary: executionSummary(ir, { valid: 2 }),
    }),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );

  const thirteen = Array.from(
    { length: 13 },
    (_, index) => validSlot(productResult('PROCESS', ir, index + 1)),
  );
  assert.throws(
    () => compileProductResultPresentation({
      understood_legal_question: understoodQuestion('PROCESS'),
      product_query_ir: ir,
      product_field_catalogue_manifest: manifest,
      ordered_result_slots: thirteen,
      query_execution_summary: executionSummary(ir, { valid: 13 }),
    }),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );
});

test('rejects stale question, query, release, catalogue and result counts', () => {
  const manifest = productFieldManifest();
  const ir = queryIr('PROCESS', manifest);
  const result = productResult('PROCESS', ir);
  const base = {
    understood_legal_question: understoodQuestion('PROCESS'),
    product_query_ir: ir,
    product_field_catalogue_manifest: manifest,
    ordered_result_slots: [validSlot(result)],
    query_execution_summary: executionSummary(ir),
  };

  const staleQuestion = clone(base);
  staleQuestion.understood_legal_question.predicate_key = 'OTHER';
  assert.throws(
    () => compileProductResultPresentation(staleQuestion),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );

  const staleResult = clone(base);
  staleResult.ordered_result_slots[0].product_query_result
    .candidate_release_manifest_id = digest('other-release');
  assert.throws(
    () => compileProductResultPresentation(staleResult),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );

  const staleCatalogue = clone(base);
  staleCatalogue.product_field_catalogue_manifest.manifest_id =
    digest('other-catalogue');
  assert.throws(
    () => compileProductResultPresentation(staleCatalogue),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );

  const badCounts = clone(base);
  badCounts.query_execution_summary.valid_result_count = 2;
  assert.throws(
    () => compileProductResultPresentation(badCounts),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT' },
  );
});

test('rejects payload and identity changes after compilation', () => {
  const presentation = rehashPresentation(clone(compileFixture()));
  presentation.result_slots[0].exact_content = 'Rewritten text.';
  rehashPresentation(presentation);
  assert.throws(
    () => validateProductResultPresentation(presentation),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION' },
  );

  const changedAction = clone(compileFixture());
  changedAction.result_slots[0].action_targets[0].accessible_name =
    'Open a different source';
  rehashPresentation(changedAction);
  assert.throws(
    () => validateProductResultPresentation(changedAction),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION' },
  );

  const changedIdentity = clone(compileFixture());
  changedIdentity.identity_inputs.product_query_definition_id =
    digest('forged-query');
  rehashPresentation(changedIdentity);
  assert.throws(
    () => validateProductResultPresentation(changedIdentity),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION' },
  );
});

test('contains no query, source, model, network or database operation', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-result-presentation-compiler.js',
    ),
    'utf8',
  );
  for (const prohibited of [
    'fetch(',
    'XMLHttpRequest',
    'supabase',
    'openai',
    'anthropic',
    'readFile',
    'writeFile',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});
