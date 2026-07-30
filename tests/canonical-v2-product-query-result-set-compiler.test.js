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
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  compileProductQueryIr,
} = require('../lib/canonical-v2/product-query-ir');
const {
  CURRENT_PM_BASELINE_FIELD_KEYS,
  buildProductFieldCatalogueManifest,
  productFieldCatalogueQueryAdmission,
  sourceRegistryPayloadDigest,
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  compileProductQueryResult,
  requestedFieldProjectionIdentity,
} = require('../lib/canonical-v2/product-query-result-compiler');
const {
  PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
  PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
} = require('../lib/canonical-v2/product-result-presentation-compiler');
const {
  buildProcessNarrationOccurrence,
} = require('../lib/canonical-v2/process-narration-occurrence');
const {
  buildProcessPhrasebookResultIdentity,
} = require('../lib/canonical-v2/process-phrasebook-result');
const {
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
  compileProcessPassageOrder,
} = require('../lib/canonical-v2/process-passage-order');
const {
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
  AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
  AGREEMENT_ORDERING_VALIDATOR_VERSION,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
  compileAgreementComparableResultOrder,
} = require('../lib/canonical-v2/agreement-comparable-result-order');
const {
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
  PROCESS_ORDERING_VALIDATOR_STABLE_ID,
  PROCESS_ORDERING_VALIDATOR_VERSION,
  compileProductQueryResultSet,
  compileProductResultSlotFailure,
  validateProductResultSlotFailure,
} = require(
  '../lib/canonical-v2/product-query-result-set-compiler',
);

const CONTRACT_PAIR = 'a'.repeat(64);
const CONTRACT_ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const FIELD_GROUP_LABELS = Object.freeze({
  DEAL_IDENTITY: 'Deal identity',
  CHRONOLOGY: 'Deal and date',
  PARTIES: 'Parties',
  ECONOMICS: 'Consideration and value',
  TRANSACTION_STRUCTURE: 'Transaction structure',
  CLASSIFICATIONS: 'Sector and classifications',
  PROFESSIONALS: 'Law firms, lawyers and advisers',
});
const DOMAINS = Object.freeze({
  AGREEMENT: Object.freeze({
    predicate_key: 'SELLER_TERMINATION_FEE',
    result_definition: Object.freeze({
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    }),
    field_key: 'seller_termination_fee_percent',
    filter_value: 3.5,
    detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
    evidence: Object.freeze([
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ]),
  }),
  CVR: Object.freeze({
    predicate_key: 'CVR_MILESTONE',
    result_definition: Object.freeze({
      stable_id: 'CVR_MILESTONE_RESULT',
      version: 1,
    }),
    field_key: 'cvr_milestone_status',
    filter_value: 'REGULATORY_APPROVAL',
    detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    representation_kind: 'STRUCTURED_RESULT',
    evidence: Object.freeze([
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ]),
  }),
  PROCESS: Object.freeze({
    predicate_key: 'EXCLUSIVITY_GRANTED',
    result_definition: Object.freeze({
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }),
    field_key: 'process_phase',
    filter_value: 'PRE_SIGNING',
    detail_action: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    representation_kind: 'VERBATIM_TEXT',
    evidence: Object.freeze([
      'EXACT_PASSAGE',
      'EXACT_SOURCE_CITATION',
    ]),
  }),
});

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function identity(stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: digest(`${stableId}:${version}`),
  };
}

function loadContract(relativePath) {
  return JSON.parse(fs.readFileSync(
    path.join(CONTRACT_ROOT, relativePath),
    'utf8',
  ));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function sharedCompleteness(field) {
  if (field.multiplicity === 'MANY') {
    return 'NON_VACUOUS_ALL_AND_UNKNOWN_IF_COLLECTION_INCOMPLETE';
  }
  return field.missing_state_behaviour;
}

function sourceField(field, sourceCatalogue) {
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
      source_stable_id: sourceCatalogue.stable_id,
      source_schema_version: sourceCatalogue.schema_version,
      source_field_key: field.field_key,
      source_field_version: field.field_version,
    },
  };
}

function agreementSourceRegistry() {
  const shared = loadContract(
    'shared/field-definitions/shared-deal-field-catalogue.v1.json',
  );
  const fields = shared.field_definitions
    .map((field) => sourceField(field, shared))
    .sort((left, right) => (
      left.field_key < right.field_key ? -1 : 1
    ));
  const registry = {
    schema_version: 'PRODUCT_FIELD_SOURCE_REGISTRY/V1',
    stable_id: 'PRODUCT_FIELD_SOURCE_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: digest('agreement-pm-data-version'),
    source_bindings: [{
      source_stable_id: shared.stable_id,
      source_schema_version: shared.schema_version,
      source_payload_digest: payloadDigest(shared),
      source_field_count: shared.field_definitions.length,
    }],
    field_groups: shared.field_groups.map((fieldGroupKey, index) => ({
      field_group_key: fieldGroupKey,
      label: FIELD_GROUP_LABELS[fieldGroupKey],
      sort_ordinal: index + 1,
    })),
    field_definitions: fields,
    source_exclusions: [],
    current_pm_baseline_field_keys: [...CURRENT_PM_BASELINE_FIELD_KEYS],
    enumeration_certification: {
      independent_enumeration_id:
        digest('agreement-field-enumeration'),
      inclusion_exclusion_reconciliation_id:
        digest('agreement-field-reconciliation'),
    },
    canonical_payload_digest: null,
  };
  registry.canonical_payload_digest =
    sourceRegistryPayloadDigest(registry);
  return registry;
}

function agreementFieldAdmission(field) {
  return {
    field_key: field.field_key,
    field_version: field.field_version,
    supported_domains: [...field.supported_domains],
    permitted_result_definitions: ['AGREEMENT_COMPARABLE_RESULT'],
    capabilities: clone(field.capabilities),
    permitted_operators: [...field.permitted_operators],
    value_vocabulary: field.value_vocabulary_required
      ? identity(`${field.field_key.toUpperCase()}_VALUE_REGISTRY`)
      : null,
    certification_identity:
      identity(`${field.field_key.toUpperCase()}_FIELD_CERTIFICATION`),
  };
}

function agreementFieldCatalogue() {
  const registry = agreementSourceRegistry();
  return buildProductFieldCatalogueManifest({
    source_registry: registry,
    release_admission: {
      schema_version: 'PRODUCT_FIELD_RELEASE_ADMISSION/V1',
      approved_pm_data_version_id: registry.approved_pm_data_version_id,
      candidate_release_manifest_id:
        digest('agreement-candidate-release'),
      candidate_release_manifest_payload_digest:
        digest('agreement-candidate-release-payload'),
      source_registry_admission: {
        stable_id: registry.stable_id,
        registry_version: registry.registry_version,
        approved_pm_data_version_id:
          registry.approved_pm_data_version_id,
        canonical_payload_digest: registry.canonical_payload_digest,
        enumeration_certification:
          clone(registry.enumeration_certification),
      },
      catalogue_generator_identity:
        identity('PRODUCT_FIELD_CATALOGUE_GENERATOR'),
      shared_deal_fact_specification_identity:
        identity('SHARED_DEAL_FACT_SPECIFICATION'),
      process_specification_identity:
        identity('PROCESS_INTELLIGENCE_SPECIFICATION'),
      field_admissions:
        registry.field_definitions.map(agreementFieldAdmission),
      field_exclusions: [],
      previous_catalogue_identity: null,
    },
  });
}

const AGREEMENT_FIELD_CATALOGUE = agreementFieldCatalogue();

function fieldDefinition({
  fieldKey,
  domains,
  resultDefinitions,
}) {
  return {
    field_key: fieldKey,
    field_version: 1,
    permitted_result_definitions:
      resultDefinitions.map((result) => result.stable_id),
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: [...domains],
    permitted_operators: ['EQ'],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function predicateAdmission(domain, config) {
  return {
    domain_key: domain,
    predicate_key: config.predicate_key,
    predicate_version: 1,
    admission_id: digest(`predicate-admission:${domain}`),
    result_definitions: [clone(config.result_definition)],
    evidence_requirement_ids: [...config.evidence],
  };
}

function queryAdmission() {
  const entries = Object.entries(DOMAINS);
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release'),
    candidate_release_manifest_payload_digest:
      digest('candidate-release-payload'),
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: digest('canonical-contract'),
    },
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest('field-catalogue'),
      payload_digest: digest('field-catalogue-payload'),
      field_definitions: [
        fieldDefinition({
          fieldKey: 'sector',
          domains: entries.map(([domain]) => domain),
          resultDefinitions:
            entries.map(([, config]) => config.result_definition),
        }),
        ...entries.map(([domain, config]) => fieldDefinition({
          fieldKey: config.field_key,
          domains: [domain],
          resultDefinitions: [config.result_definition],
        })),
      ].sort((left, right) => (
        left.field_key < right.field_key ? -1 : 1
      )),
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-catalogue'),
      payload_digest: digest('navigation-catalogue-payload'),
    },
    predicate_admissions:
      entries.map(([domain, config]) => (
        predicateAdmission(domain, config)
      )),
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
    ],
    coverage_identities:
      entries.map(([domain]) => digest(`coverage:${domain}`)),
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function queryIr(domain = 'PROCESS') {
  const config = DOMAINS[domain];
  return compileProductQueryIr({
    admission: queryAdmission(),
    query: {
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
        field_key: config.field_key,
        field_version: 1,
        operator: 'EQ',
        value: config.filter_value,
      }],
      sort: [{
        field_key: 'sector',
        field_version: 1,
        direction: 'ASC',
      }],
      diversity: {
        definition_id: digest(`diversity:${domain}`),
        payload_digest: digest(`diversity-payload:${domain}`),
      },
      requested_columns: [
        {
          field_key: 'sector',
          field_version: 1,
        },
        {
          field_key: config.field_key,
          field_version: 1,
        },
      ],
      pagination: {
        page_size: 12,
        cursor: null,
      },
      detail_actions: [config.detail_action],
      coverage: {
        coverage_identity: digest(`coverage:${domain}`),
        coverage_payload_digest:
          digest(`coverage-payload:${domain}`),
        covered_set_identity: digest(`covered-set:${domain}`),
        exclusions_identity: digest(`exclusions:${domain}`),
      },
    },
  });
}

function agreementQueryAdmission() {
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id:
      AGREEMENT_FIELD_CATALOGUE.approved_pm_data_version_id,
    candidate_release_manifest_id:
      AGREEMENT_FIELD_CATALOGUE.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      AGREEMENT_FIELD_CATALOGUE
        .candidate_release_manifest_payload_digest,
    canonical_contract_identity:
      identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue:
      productFieldCatalogueQueryAdmission(AGREEMENT_FIELD_CATALOGUE),
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('agreement-navigation-catalogue'),
      payload_digest: digest('agreement-navigation-payload'),
    },
    predicate_admissions: [{
      domain_key: 'AGREEMENT',
      predicate_key: 'TRANSACTION_STRUCTURE',
      predicate_version: 1,
      admission_id: digest('agreement-predicate-admission'),
      result_definitions: [{
        stable_id: 'AGREEMENT_COMPARABLE_RESULT',
        version: 1,
      }],
      evidence_requirement_ids: [
        'EXACT_CLAIM',
        'EXACT_SOURCE_CITATION',
      ],
    }],
    exact_detail_actions: ['RESULT_COMPONENT_CLAIM_EVIDENCE'],
    coverage_identities: [digest('agreement-coverage')],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function agreementQueryIr(pageSize = 8) {
  return compileProductQueryIr({
    admission: agreementQueryAdmission(),
    query: {
      domain_key: 'AGREEMENT',
      predicate_key: 'TRANSACTION_STRUCTURE',
      predicate_version: 1,
      result_definition: {
        stable_id: 'AGREEMENT_COMPARABLE_RESULT',
        version: 1,
      },
      evidence_requirement_ids: [
        'EXACT_CLAIM',
        'EXACT_SOURCE_CITATION',
      ],
      cohort: {
        cohort_definition_id: digest('agreement-cohort'),
        cohort_definition_payload_digest:
          digest('agreement-cohort-payload'),
      },
      filters: [{
        field_key: 'structure',
        field_version: 1,
        operator: 'EQ',
        value: 'MERGER',
      }],
      sort: [{
        field_key: 'signed',
        field_version: 1,
        direction: 'DESC',
      }],
      diversity: {
        definition_id: digest('agreement-diversity'),
        payload_digest: digest('agreement-diversity-payload'),
      },
      requested_columns: [
        { field_key: 'deal', field_version: 1 },
        { field_key: 'signed', field_version: 1 },
        { field_key: 'structure', field_version: 1 },
      ],
      pagination: {
        page_size: pageSize,
        cursor: null,
      },
      detail_actions: ['RESULT_COMPONENT_CLAIM_EVIDENCE'],
      coverage: {
        coverage_identity: digest('agreement-coverage'),
        coverage_payload_digest:
          digest('agreement-coverage-payload'),
        covered_set_identity: digest('agreement-covered-set'),
        exclusions_identity: digest('agreement-exclusions'),
      },
    },
  });
}

function narration(label, start) {
  return buildProcessNarrationOccurrence({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: digest('metsera-deal'),
    narration_definition_key_and_version: {
      definition_key: 'PROCESS_NARRATION_OCCURRENCE',
      definition_version: 1,
    },
    canonical_source_interval_set: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        admitted_source_occurrence_id:
          digest(`${label}:source-occurrence`),
        document_hash: digest(`${label}:document`),
        document_ordinal: 0,
        absolute_start: start,
        absolute_end: start + 50,
        exact_bytes_digest: digest(`${label}:bytes`),
      }],
    },
    governed_ordinal: start,
  });
}

function orderingFact(ir, ordinal) {
  const label = `metsera-passage-${ordinal}`;
  const selectedNarration = narration(label, ordinal * 100);
  const resultIdentity = buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id:
      selectedNarration.governed_deal_admission_id,
    precomputed_process_narration_occurrence_id:
      selectedNarration.process_narration_occurrence_id,
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: selectedNarration.governed_ordinal,
  });
  const body = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    result_identity: resultIdentity,
    selected_narration_occurrence: selectedNarration,
    bidder_track_id: digest(`metsera-bidder-track-${ordinal % 3}`),
    narration_treatment: 'SOURCE_LOCAL_PRIMARY_NARRATION',
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    external_validation_receipt_id:
      digest(`${label}:validation`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_fact_id: contentId(
      PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
      body,
    ),
    result_identity: body.result_identity,
    selected_narration_occurrence:
      body.selected_narration_occurrence,
    bidder_track_id: body.bidder_track_id,
    narration_treatment: body.narration_treatment,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    external_validation_receipt_id:
      body.external_validation_receipt_id,
    validation_state: body.validation_state,
    authority_state: body.authority_state,
  };
}

function domainResult(ir, fact, ordinal) {
  const payload = ordinal === 1
    ? 'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.'
    : `Metsera exclusivity precedent passage ${ordinal}.`;
  const payloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: 'PROCESS_RESULT_VALIDATOR',
    validator_version: 1,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: 'PROCESS',
    domain_result_definition:
      clone(DOMAINS.PROCESS.result_definition),
    domain_result_identity:
      fact.result_identity.process_phrasebook_passage_result_id,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigest,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validator_stable_id: validationBody.validator_stable_id,
      validator_version: validationBody.validator_version,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
      validated_payload_digest:
        validationBody.validated_payload_digest,
      validation_state: validationBody.validation_state,
    },
    domain_result_source_representation_kind: 'VERBATIM_TEXT',
  };
}

function resultFields() {
  return [
    {
      field_reference: {
        field_key: 'sector',
        field_version: 1,
      },
      value: 'BIOPHARMA',
    },
    {
      field_reference: {
        field_key: 'process_phase',
        field_version: 1,
      },
      value: 'PRE_SIGNING',
    },
  ];
}

function expectedProductResultIdentity(ir, result) {
  return contentId(PRODUCT_QUERY_RESULT_SCHEMA, {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition_stable_id:
      result.domain_result_definition.stable_id,
    domain_result_definition_version:
      result.domain_result_definition.version,
    domain_result_identity: result.domain_result_identity,
  });
}

function exactCitation(ir, result, ordinal) {
  const productResultIdentity =
    expectedProductResultIdentity(ir, result);
  const sourceDocumentIdentity =
    digest(`metsera-source-document:${ordinal}`);
  const sourceEvidenceIdentity =
    digest(`metsera-source-evidence:${ordinal}`);
  return {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
    source_representation_kind: 'VERBATIM_TEXT',
    source_interval: {
      start_utf8_byte: ordinal * 100,
      end_utf8_byte: (ordinal * 100)
        + Buffer.byteLength(result.domain_result_payload, 'utf8'),
      exact_text_digest: result.domain_result_payload_digest,
    },
    result_component_evidence_identity: null,
    source_accession_or_equivalent_identity:
      `METC-DEFM14A-${ordinal}`,
    source_filing_type: 'DEFM14A',
    source_filing_date: '2025-09-22',
    source_location_label: `Background section ${ordinal}`,
    human_readable_source_label:
      `Metsera proxy, Background section ${ordinal}`,
    citation_target_identity: contentId(
      PRODUCT_EXACT_CITATION_SCHEMA,
      {
        product_query_result_identity: productResultIdentity,
        candidate_release_manifest_id:
          ir.release_contract.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest:
          ir.release_contract
            .candidate_release_manifest_payload_digest,
        source_document_identity: sourceDocumentIdentity,
        source_evidence_identity: sourceEvidenceIdentity,
      },
    ),
  };
}

function admissionReceipt(ir, result, fields) {
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: clone(result.domain_result_definition),
    domain_result_identity: result.domain_result_identity,
    domain_result_payload_digest:
      result.domain_result_payload_digest,
    domain_validator_admission_identity:
      digest('process-validator-admission'),
    domain_validation_receipt_id:
      result.domain_result_validation.validation_receipt_id,
    query_coverage_identity:
      ir.coverage_contract.coverage_identity,
    covered_set_identity:
      ir.coverage_contract.covered_set_identity,
    query_cohort_identity:
      ir.cohort_contract.cohort_definition_id,
    predicate_evaluation_state: 'PASS',
    cohort_evaluation_state: 'PASS',
    filter_evaluation_state: 'PASS',
    covered_set_membership_state: 'PASS',
    requested_field_projection_identity:
      requestedFieldProjectionIdentity({
        queryIr: ir,
        domainResult: result,
        resultFields: fields,
      }),
    admission_state: PRODUCT_QUERY_RESULT_ADMISSION_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    admission_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function productResult(ir, fact, ordinal) {
  const result = domainResult(ir, fact, ordinal);
  const fields = resultFields();
  return compileProductQueryResult({
    product_query_ir: ir,
    domain_result: result,
    result_fields: fields,
    exact_citation: exactCitation(ir, result, ordinal),
    exact_detail_action:
      DOMAINS.PROCESS.detail_action,
    admission_receipt: admissionReceipt(ir, result, fields),
  });
}

function agreementDomainResult(ordinal) {
  const payload = {
    deal_name: `Agreement precedent ${ordinal}`,
    signed_date: `2025-0${ordinal}-15`,
    structure: 'MERGER',
  };
  const resultPayloadDigest = payloadDigest(payload);
  const validationBody = {
    validator_stable_id: 'AGREEMENT_RESULT_VALIDATOR',
    validator_version: 1,
    validated_payload_digest: resultPayloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: 'AGREEMENT',
    domain_result_definition: {
      stable_id: 'AGREEMENT_COMPARABLE_RESULT',
      version: 1,
    },
    domain_result_identity: digest(`agreement-result:${ordinal}`),
    domain_result_payload: payload,
    domain_result_payload_digest: resultPayloadDigest,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validator_stable_id: validationBody.validator_stable_id,
      validator_version: validationBody.validator_version,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
      validated_payload_digest: resultPayloadDigest,
      validation_state: validationBody.validation_state,
    },
    domain_result_source_representation_kind: 'STRUCTURED_RESULT',
  };
}

function agreementResultFields(ordinal) {
  return [
    {
      field_reference: { field_key: 'deal', field_version: 1 },
      value: {
        governed_deal_id: digest(`agreement-deal:${ordinal}`),
      },
    },
    {
      field_reference: { field_key: 'signed', field_version: 1 },
      value: {
        iso_8601_calendar_date: `2025-0${ordinal}-15`,
      },
    },
    {
      field_reference: { field_key: 'structure', field_version: 1 },
      value: {
        ordered_governed_enum_codes: ['MERGER'],
      },
    },
  ];
}

function agreementExactCitation(ir, result, ordinal) {
  const productResultIdentity =
    expectedProductResultIdentity(ir, result);
  const sourceDocumentIdentity =
    digest(`agreement-source-document:${ordinal}`);
  const sourceEvidenceIdentity =
    digest(`agreement-source-evidence:${ordinal}`);
  return {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
    source_representation_kind: 'STRUCTURED_RESULT',
    source_interval: null,
    result_component_evidence_identity:
      digest(`agreement-component-evidence:${ordinal}`),
    source_accession_or_equivalent_identity:
      `AGREEMENT-DEFM14A-${ordinal}`,
    source_filing_type: 'DEFM14A',
    source_filing_date: '2025-09-22',
    source_location_label: `Agreement section ${ordinal}`,
    human_readable_source_label:
      `Agreement proxy, section ${ordinal}`,
    citation_target_identity: contentId(
      PRODUCT_EXACT_CITATION_SCHEMA,
      {
        product_query_result_identity: productResultIdentity,
        candidate_release_manifest_id:
          ir.release_contract.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest:
          ir.release_contract
            .candidate_release_manifest_payload_digest,
        source_document_identity: sourceDocumentIdentity,
        source_evidence_identity: sourceEvidenceIdentity,
      },
    ),
  };
}

function agreementProductResult(ir, ordinal) {
  const result = agreementDomainResult(ordinal);
  const fields = agreementResultFields(ordinal);
  return compileProductQueryResult({
    product_query_ir: ir,
    domain_result: result,
    result_fields: fields,
    exact_citation: agreementExactCitation(ir, result, ordinal),
    exact_detail_action: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    admission_receipt: admissionReceipt(ir, result, fields),
  });
}

function agreementOrderingFact(
  ir,
  result,
  ordinal,
  { unavailable = false } = {},
) {
  const orderingFailureBody = {
    schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
    disposition: 'FIELD_PROJECTION_INVALID',
  };
  const body = {
    schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
    fact_state: unavailable
      ? 'ORDERING_UNAVAILABLE'
      : 'VALIDATED_SORT_PROJECTION',
    product_query_result_identity:
      result.product_query_result_identity,
    agreement_comparable_result_identity:
      result.domain_result_identity,
    governed_deal_admission_id:
      digest(`agreement-deal:${ordinal}`),
    sort_projections: unavailable
      ? []
      : [{
        field_reference: {
          field_key: 'signed',
          field_version: 1,
        },
        value_type: 'DATE',
        value_state: 'COMPARABLE_VALUE',
        value: {
          iso_8601_calendar_date: `2025-0${ordinal}-15`,
        },
      }],
    external_field_projection_validation_receipt_id:
      digest(`agreement-field-validation:${ordinal}`),
    external_candidate_membership_validation_receipt_id:
      digest(`agreement-candidate-membership:${ordinal}`),
    ordering_failure: unavailable
      ? {
        schema_version: orderingFailureBody.schema_version,
        failure_identity: contentId(
          AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
          orderingFailureBody,
        ),
        disposition: orderingFailureBody.disposition,
      }
      : null,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_fact_id: contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
      body,
    ),
    ...body,
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

function failedSlot(domainResultIdentity, ordinal) {
  const failure = compileProductResultSlotFailure({
    disposition: `INVALID_METSERA_RESULT_${ordinal}`,
    failed_domain_result_identity: domainResultIdentity,
  });
  return {
    slot_identity: failure.failure_identity,
    slot_state: 'UNAVAILABLE',
    product_query_result: null,
    failure,
  };
}

function coverageCertification(
  ir,
  state = 'CERTIFIED_COMPLETE',
) {
  return {
    coverage_certification_identity:
      digest(`coverage-certification:${state}`),
    query_coverage_identity:
      ir.coverage_contract.coverage_identity,
    covered_set_identity:
      ir.coverage_contract.covered_set_identity,
    coverage_certification_state: state,
    covered_deal_count: 12,
    excluded_deal_count: 2,
    operational_state: 'COMPLETE',
  };
}

function rehashOrderingReceipt(receipt) {
  const body = clone(receipt);
  delete body.ordering_receipt_id;
  receipt.ordering_receipt_id = contentId(
    PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
    body,
  );
  return receipt;
}

function orderingReceipt(ir, projection, candidates) {
  const byDomainResult = new Map(candidates.map((candidate) => [
    candidate.slot_state === 'VALID'
      ? candidate.product_query_result.domain_result_identity
      : candidate.failure.failed_domain_result_identity,
    candidate.slot_identity,
  ]));
  const projectedSlots = projection.ordered_result_ids.map(
    (identity) => byDomainResult.get(identity),
  );
  const emittedCount = projection.first_page_result_ids.length;
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: 'PROCESS',
    complete_candidate_slot_identities:
      candidates.map((candidate) => candidate.slot_identity).sort(),
    ordered_slot_identities:
      projectedSlots.slice(0, emittedCount),
    excluded_slot_identities:
      projectedSlots.slice(emittedCount),
    ordering_validator_stable_id:
      PROCESS_ORDERING_VALIDATOR_STABLE_ID,
    ordering_validator_version:
      PROCESS_ORDERING_VALIDATOR_VERSION,
    domain_ordering_projection_schema_version:
      PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
    domain_ordering_projection_identity:
      projection.ordering_projection_id,
    domain_ordering_projection_payload_digest:
      projection.canonical_payload_digest,
    external_validation_receipt_id:
      digest('process-ordering-external-validation'),
    validation_state:
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function agreementOrderingReceipt(ir, projection, candidates) {
  const byDomainResult = new Map(candidates.map((candidate) => [
    candidate.product_query_result.domain_result_identity,
    candidate.slot_identity,
  ]));
  const projectedSlots =
    projection.ordered_agreement_result_identities.map(
      (identity) => byDomainResult.get(identity),
    );
  const emittedCount =
    projection.first_page_agreement_result_identities.length;
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
    product_query_definition_id: ir.query_definition_id,
    approved_pm_data_version_id:
      ir.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    domain_key: 'AGREEMENT',
    complete_candidate_slot_identities:
      candidates.map((candidate) => candidate.slot_identity).sort(),
    ordered_slot_identities:
      projectedSlots.slice(0, emittedCount),
    excluded_slot_identities:
      projectedSlots.slice(emittedCount),
    ordering_validator_stable_id:
      AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
    ordering_validator_version:
      AGREEMENT_ORDERING_VALIDATOR_VERSION,
    domain_ordering_projection_schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
    domain_ordering_projection_identity:
      projection.ordering_projection_id,
    domain_ordering_projection_payload_digest:
      projection.canonical_payload_digest,
    external_validation_receipt_id:
      digest('agreement-ordering-external-validation'),
    validation_state:
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function agreementFixture({
  count = 9,
  unavailableOrdinal = null,
} = {}) {
  const ir = agreementQueryIr();
  const results = Array.from({ length: count }, (_, index) => index + 1).map(
    (ordinal) => agreementProductResult(ir, ordinal),
  );
  const slots = results.map(validSlot);
  const facts = results.map(
    (result, index) => agreementOrderingFact(ir, result, index + 1, {
      unavailable: index + 1 === unavailableOrdinal,
    }),
  );
  const projection = compileAgreementComparableResultOrder({
    product_query_ir: ir,
    product_field_catalogue_manifest: AGREEMENT_FIELD_CATALOGUE,
    ordering_facts: [...facts].reverse(),
  });
  return {
    product_query_ir: ir,
    candidate_slots: [...slots].reverse(),
    domain_ordering_projection: projection,
    ordering_receipt:
      agreementOrderingReceipt(ir, projection, slots),
    coverage_certification: coverageCertification(ir),
  };
}

function fixture({
  count = 14,
  failedOrdinal = null,
  coverageState = 'CERTIFIED_COMPLETE',
} = {}) {
  const ir = queryIr();
  const facts = Array.from(
    { length: count },
    (_, index) => orderingFact(ir, index + 1),
  );
  const projection = compileProcessPassageOrder({
    product_query_definition_id: ir.query_definition_id,
    candidate_release_manifest_id:
      ir.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      ir.release_contract.candidate_release_manifest_payload_digest,
    page_size: ir.pagination_contract.page_size,
    ordering_facts: [...facts].reverse(),
  });
  const slots = facts.map((fact, index) => {
    const ordinal = index + 1;
    if (ordinal === failedOrdinal) {
      return failedSlot(
        fact.result_identity.process_phrasebook_passage_result_id,
        ordinal,
      );
    }
    return validSlot(productResult(ir, fact, ordinal));
  });
  return {
    product_query_ir: ir,
    candidate_slots: [...slots].reverse(),
    domain_ordering_projection: projection,
    ordering_receipt: orderingReceipt(ir, projection, slots),
    coverage_certification:
      coverageCertification(ir, coverageState),
  };
}

test('preserves the validated Metsera order and excludes the next page', () => {
  const input = fixture();
  const first = compileProductQueryResultSet(input);
  const second = compileProductQueryResultSet(clone(input));

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(first.ordered_result_slots.length, 12);
  assert.equal(
    first.ordered_result_slots[0].product_query_result
      .domain_result_payload,
    'On September 12, 2025, Metsera agreed to negotiate exclusively with Pfizer.',
  );
  assert.deepEqual(
    first.ordered_result_slots.map(
      (slot) => slot.product_query_result.domain_result_identity,
    ),
    input.domain_ordering_projection.first_page_result_ids,
  );
  assert.equal(
    first.query_execution_summary.schema_version,
    PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
  );
  assert.equal(first.query_execution_summary.valid_result_count, 12);
  assert.equal(first.query_execution_summary.failed_result_count, 0);
  assert.equal(first.query_execution_summary.excluded_result_count, 2);
  assert.equal(first.query_execution_summary.total_result_count, 14);
});

test('preserves one typed failure in its validated order position', () => {
  const output = compileProductQueryResultSet(fixture({
    count: 8,
    failedOrdinal: 3,
  }));

  assert.equal(output.ordered_result_slots.length, 8);
  assert.equal(output.ordered_result_slots[2].slot_state, 'UNAVAILABLE');
  assert.equal(
    output.ordered_result_slots[2].failure.schema_version,
    PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
  );
  assert.equal(output.query_execution_summary.valid_result_count, 7);
  assert.equal(output.query_execution_summary.failed_result_count, 1);
  assert.equal(output.query_execution_summary.total_result_count, 8);
  assert.equal(
    validateProductResultSlotFailure(
      output.ordered_result_slots[2].failure,
    ),
    true,
  );
});

test('constructs a bounded zero only from checked complete coverage', () => {
  const complete = compileProductQueryResultSet(fixture({ count: 0 }));
  const incomplete = compileProductQueryResultSet(fixture({
    count: 0,
    coverageState: 'CERTIFIED_INCOMPLETE',
  }));

  assert.deepEqual(complete.ordered_result_slots, []);
  assert.equal(
    complete.query_execution_summary.coverage_certification_state,
    'CERTIFIED_COMPLETE',
  );
  assert.equal(complete.query_execution_summary.total_result_count, 0);
  assert.equal(
    incomplete.query_execution_summary.coverage_certification_state,
    'CERTIFIED_INCOMPLETE',
  );
});

test('does not mutate any compiler input', () => {
  const input = fixture({ count: 8, failedOrdinal: 4 });
  const before = clone(input);
  compileProductQueryResultSet(input);
  assert.deepEqual(input, before);
});

test('rejects a correctly rehashed changed output order', () => {
  const input = fixture({ count: 8 });
  input.ordering_receipt.ordered_slot_identities.reverse();
  rehashOrderingReceipt(input.ordering_receipt);

  assert.throws(
    () => compileProductQueryResultSet(input),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('rejects missing, duplicate and substituted candidates', () => {
  const missing = fixture({ count: 8 });
  missing.candidate_slots.pop();
  assert.throws(
    () => compileProductQueryResultSet(missing),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );

  const duplicate = fixture({ count: 8 });
  duplicate.candidate_slots[1] =
    clone(duplicate.candidate_slots[0]);
  assert.throws(
    () => compileProductQueryResultSet(duplicate),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );

  const substituted = clone(fixture({ count: 8 }));
  substituted.candidate_slots[0].product_query_result
    .domain_result_identity = digest('substituted-domain-result');
  assert.throws(
    () => compileProductQueryResultSet(substituted),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('rejects a changed Process projection even after self-rehashing', () => {
  const input = clone(fixture({ count: 8 }));
  const projection = input.domain_ordering_projection;
  projection.ordered_result_ids.reverse();
  projection.first_page_result_ids.reverse();
  const body = clone(projection);
  delete body.ordering_projection_id;
  delete body.canonical_payload_digest;
  projection.ordering_projection_id = contentId(
    PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
    body,
  );
  projection.canonical_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(body),
    'utf8',
  ));
  input.ordering_receipt.domain_ordering_projection_identity =
    projection.ordering_projection_id;
  input.ordering_receipt.domain_ordering_projection_payload_digest =
    projection.canonical_payload_digest;
  rehashOrderingReceipt(input.ordering_receipt);

  assert.throws(
    () => compileProductQueryResultSet(input),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('rejects stale query, release, coverage and projection bindings', () => {
  for (const change of [
    (input) => {
      input.ordering_receipt.product_query_definition_id =
        digest('stale-query');
    },
    (input) => {
      input.ordering_receipt.candidate_release_manifest_id =
        digest('stale-release');
    },
    (input) => {
      input.coverage_certification.query_coverage_identity =
        digest('stale-coverage');
    },
    (input) => {
      input.ordering_receipt.domain_ordering_projection_identity =
        digest('stale-projection');
    },
  ]) {
    const input = fixture({ count: 8 });
    change(input);
    rehashOrderingReceipt(input.ordering_receipt);
    assert.throws(
      () => compileProductQueryResultSet(input),
      { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
    );
  }
});

test('rejects an otherwise valid projection with a stale page size', () => {
  const input = fixture({ count: 8 });
  const projection = compileProcessPassageOrder({
    product_query_definition_id:
      input.product_query_ir.query_definition_id,
    candidate_release_manifest_id:
      input.product_query_ir.release_contract
        .candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      input.product_query_ir.release_contract
        .candidate_release_manifest_payload_digest,
    page_size: 8,
    ordering_facts:
      input.domain_ordering_projection.validated_ordering_facts,
  });
  input.domain_ordering_projection = projection;
  input.ordering_receipt = orderingReceipt(
    input.product_query_ir,
    projection,
    input.candidate_slots,
  );

  assert.throws(
    () => compileProductQueryResultSet(input),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('rejects receipt authority, extra fields and free ordering callbacks', () => {
  const authority = fixture({ count: 8 });
  authority.ordering_receipt.authority_state = 'GRANTED';
  rehashOrderingReceipt(authority.ordering_receipt);
  assert.throws(
    () => compileProductQueryResultSet(authority),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );

  const extra = fixture({ count: 8 });
  extra.ordering_receipt.order_is_valid = true;
  rehashOrderingReceipt(extra.ordering_receipt);
  assert.throws(
    () => compileProductQueryResultSet(extra),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );

  const callback = fixture({ count: 8 });
  callback.ordering_receipt.comparator = () => 0;
  assert.throws(
    () => compileProductQueryResultSet(callback),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('rejects a rehashed failure that points to another result', () => {
  const input = clone(fixture({ count: 8, failedOrdinal: 3 }));
  const slot = input.candidate_slots.find(
    (candidate) => candidate.slot_state === 'UNAVAILABLE',
  );
  const originalSlotIdentity = slot.slot_identity;
  slot.failure.failed_domain_result_identity =
    digest('another-domain-result');
  const failureBody = clone(slot.failure);
  delete failureBody.failure_identity;
  slot.failure.failure_identity = contentId(
    PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
    failureBody,
  );
  slot.slot_identity = slot.failure.failure_identity;
  input.ordering_receipt.complete_candidate_slot_identities =
    input.ordering_receipt.complete_candidate_slot_identities
      .map((identity) => (
        identity === originalSlotIdentity
          ? slot.slot_identity
          : identity
      ))
      .sort();
  input.ordering_receipt.ordered_slot_identities =
    input.ordering_receipt.ordered_slot_identities.map(
      (identity) => (
        identity === originalSlotIdentity
          ? slot.slot_identity
          : identity
      ),
    );
  input.ordering_receipt.excluded_slot_identities =
    input.ordering_receipt.excluded_slot_identities.map(
      (identity) => (
        identity === originalSlotIdentity
          ? slot.slot_identity
          : identity
      ),
  );
  rehashOrderingReceipt(input.ordering_receipt);

  assert.throws(
    () => compileProductQueryResultSet(input),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('admits Agreement ordering and preserves its validated first page', () => {
  const input = agreementFixture();
  const output = compileProductQueryResultSet(input);

  assert.deepEqual(
    output.ordered_result_slots.map(
      (slot) => slot.product_query_result.domain_result_identity,
    ),
    input.domain_ordering_projection
      .first_page_agreement_result_identities,
  );
  assert.equal(output.ordered_result_slots.length, 8);
  assert.equal(output.query_execution_summary.valid_result_count, 8);
  assert.equal(output.query_execution_summary.failed_result_count, 0);
  assert.equal(output.query_execution_summary.excluded_result_count, 1);
  assert.equal(output.query_execution_summary.total_result_count, 9);
});

test('retains an Agreement ordering-unavailable result after orderable results', () => {
  const input = agreementFixture({
    count: 3,
    unavailableOrdinal: 2,
  });
  const output = compileProductQueryResultSet(input);

  assert.equal(output.ordered_result_slots.length, 3);
  assert.equal(
    output.ordered_result_slots[2].product_query_result
      .domain_result_identity,
    digest('agreement-result:2'),
  );
  assert.deepEqual(
    input.domain_ordering_projection
      .ordered_failed_agreement_result_identities,
    [digest('agreement-result:2')],
  );
});

test('rejects changed Agreement candidate and receipt bindings', () => {
  const substituted = clone(agreementFixture());
  substituted.candidate_slots[0].product_query_result
    .domain_result_identity = digest('substituted-agreement-result');
  assert.throws(
    () => compileProductQueryResultSet(substituted),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );

  const changedReceipt = clone(agreementFixture());
  changedReceipt.ordering_receipt.ordered_slot_identities.reverse();
  rehashOrderingReceipt(changedReceipt.ordering_receipt);
  assert.throws(
    () => compileProductQueryResultSet(changedReceipt),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('keeps future CVR ordering fail-closed', () => {
  const ir = queryIr('CVR');
  assert.throws(
    () => compileProductQueryResultSet({
      product_query_ir: ir,
      candidate_slots: [],
      domain_ordering_projection: {},
      ordering_receipt: {},
      coverage_certification: coverageCertification(ir),
    }),
    (error) => (
      error.code === 'PRODUCT_ORDERING_VALIDATOR_NOT_ADMITTED'
      && error.details.domain_key === 'CVR'
    ),
  );
});

test('builds deterministic typed failures and rejects null mapping use', () => {
  const first = compileProductResultSlotFailure({
    disposition: 'INVALID_DOMAIN_RESULT',
    failed_domain_result_identity: digest('failed-domain-result'),
  });
  const second = compileProductResultSlotFailure({
    disposition: 'INVALID_DOMAIN_RESULT',
    failed_domain_result_identity: digest('failed-domain-result'),
  });
  assert.deepEqual(first, second);
  assertDeepFrozen(first);

  const input = fixture({ count: 8, failedOrdinal: 3 });
  const slot = input.candidate_slots.find(
    (candidate) => candidate.slot_state === 'UNAVAILABLE',
  );
  const replacement = compileProductResultSlotFailure({
    disposition: 'INVALID_DOMAIN_RESULT',
    failed_domain_result_identity: null,
  });
  slot.slot_identity = replacement.failure_identity;
  slot.failure = replacement;
  assert.throws(
    () => compileProductQueryResultSet(input),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT' },
  );
});

test('contains no query, rank, source, model, network or database operation', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-query-result-set-compiler.js',
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
    '.sort((left, right) => compareFacts',
    'diversifyWithinPriorityTiers',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});

test('uses an exact three-file canonical-work-start allowlist', () => {
  for (const phase of [
    'wp-product-query-result-set-compiler-v1.json',
    'wp-product-query-result-set-agreement-v2.json',
  ]) {
    const allowlist = JSON.parse(fs.readFileSync(
      path.join(
        __dirname,
        `../.github/phase-allowlists/${phase}`,
      ),
      'utf8',
    ));
    assert.equal(allowlist.required_work_class, 'canonical_work_start');
    assert.deepEqual(allowlist.allowed, [
      `.github/phase-allowlists/${phase}`,
      'lib/canonical-v2/product-query-result-set-compiler.js',
      'tests/canonical-v2-product-query-result-set-compiler.test.js',
    ]);
  }
});
