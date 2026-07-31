const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex } = require('../../../lib/canonical-v2/canonical-bytes');
const { compileCanonicalContractInput } = require('../../../lib/canonical-v2/canonical-contract-input-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../../../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  compileCanonicalContractBundle,
} = require('../../../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  buildLandosCandidateReleaseFixture,
} = require('../../../__fixtures__/canonical-v2/landos-candidate-release');
const {
  buildFixtureCandidateRelease,
} = require('../../../lib/canonical-v2/candidate-release');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../../../lib/canonical-v2/serving-projection-contract');
const {
  compilePilotProductAuthorityContext,
} = require('../../../lib/canonical-v2/pilot-product-authority-context');
const {
  buildAgreementCandidateEnvelope,
} = require('../../../lib/canonical-v2/agreement-candidate-envelope');
const {
  buildAgreementCandidateDomainResult,
} = require('../../../lib/canonical-v2/agreement-candidate-domain-result-adapter');
const { compileProductQueryIr } = require('../../../lib/canonical-v2/product-query-ir');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  requestedFieldProjectionIdentity,
} = require('../../../lib/canonical-v2/product-query-result-compiler');
const {
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
  AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
  AGREEMENT_ORDERING_VALIDATOR_VERSION,
  compileAgreementComparableResultOrder,
} = require('../../../lib/canonical-v2/agreement-comparable-result-order');
const {
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
} = require('../../../lib/canonical-v2/product-query-result-set-compiler');
const {
  compileFixtureContractV5,
} = require('../../../lib/canonical-v2/contract-bundle');
const {
  buildF28ProductInputs,
} = require('./qxo-capitalisation-f28-product-inputs');
const {
  EVALUATION_EVIDENCE_SCHEMA,
} = require('../../../lib/canonical-v2/agreement-candidate-product-materialisation');

const ROOT = path.resolve(__dirname, '../../../contracts/canonical-v2/successor');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

let cachedAuthority;
function authority() {
  if (cachedAuthority) return cachedAuthority;
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: ROOT,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
  });
  const compiledContractBundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  });
  const releaseFixture = buildLandosCandidateReleaseFixture();
  const candidateReleaseManifest = buildFixtureCandidateRelease({
    contract_bundle: releaseFixture.contract,
    serving_namespace_id: releaseFixture.servingNamespaceId,
    corpus_release_id: releaseFixture.corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: releaseFixture.members,
    source_specific_members: releaseFixture.sourceSpecificMembers,
    validated_semantic_graphs: releaseFixture.validatedSemanticGraphs,
    correction_authority_selection: releaseFixture.correctionAuthoritySelection,
    deal_directory_entries: releaseFixture.dealDirectoryEntries,
  }).manifest;
  const input = {
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    compiled_contract_bundle: compiledContractBundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
  cachedAuthority = Object.freeze({
    input,
    context: compilePilotProductAuthorityContext(input),
  });
  return cachedAuthority;
}

function familyInput(profile) {
  if (profile === 'CAPITALISATION_BRING_DOWN_V3') {
    const source = buildF28ProductInputs();
    return {
      contract_bundle: source.contract_bundle,
      parser_source_closure: source.parser_source_closure,
      qxo_cross_view_release: source.qxo_cross_view_release,
      reviewed_graph: source.reviewed_graph,
      source_context: source.source_context,
    };
  }
  return {
    agreement_text: fs.readFileSync(
      '__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8',
    ),
    deal_value_source_text: fs.readFileSync(
      '__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8',
    ),
    contract_bundle: compileFixtureContractV5(),
  };
}

function profileDetailAction(profile) {
  return profile === 'CAPITALISATION_BRING_DOWN_V3'
    ? 'RESULT_COMPOSITION_EVIDENCE'
    : 'RESULT_COMPONENT_CLAIM_EVIDENCE';
}

function profilePredicate(profile) {
  return profile === 'CAPITALISATION_BRING_DOWN_V3'
    ? 'TARGET_CAPITALISATION_BRING_DOWN'
    : 'TARGET_CAPEX_RESTRICTION';
}

function evaluationEvidence({
  envelopeInput,
  authorityInput,
  authorityContext,
  rawProductQueryPatch = {},
}) {
  const envelopeValue = buildAgreementCandidateEnvelope(envelopeInput);
  const isIoc = envelopeInput.family_profile_id === 'IOC_CAPEX_RESTRICTION_V1';
  const action = profileDetailAction(envelopeInput.family_profile_id);
  const admission = authorityContext.product_query_admission_context;
  const predicateAdmission = admission.predicate_admissions.find((entry) => (
    entry.domain_key === 'AGREEMENT'
    && entry.predicate_key === profilePredicate(envelopeInput.family_profile_id)
    && entry.predicate_version === 1
  ));
  const resultDefinition = {
    stable_id: envelopeValue.product_membership.result_definition_stable_id,
    version: envelopeValue.product_membership.result_definition_version,
  };
  const rawProductQuery = {
    domain_key: 'AGREEMENT',
    predicate_key: predicateAdmission.predicate_key,
    predicate_version: predicateAdmission.predicate_version,
    result_definition: resultDefinition,
    evidence_requirement_ids: clone(predicateAdmission.evidence_requirement_ids),
    cohort: {
      cohort_definition_id: digest(`cohort:${envelopeInput.family_profile_id}`),
      cohort_definition_payload_digest: digest(`cohort-payload:${envelopeInput.family_profile_id}`),
    },
    filters: [],
    sort: isIoc ? [] : [{ field_key: 'signed', field_version: 1, direction: 'DESC' }],
    diversity: {
      definition_id: digest(`diversity:${envelopeInput.family_profile_id}`),
      payload_digest: digest(`diversity-payload:${envelopeInput.family_profile_id}`),
    },
    requested_columns: isIoc
      ? [{ field_key: 'deal', field_version: 1 }]
      : [
        { field_key: 'deal', field_version: 1 },
        { field_key: 'signed', field_version: 1 },
      ],
    pagination: { page_size: 12, cursor: null },
    detail_actions: [action],
    coverage: {
      coverage_identity: admission.coverage_identities[0],
      coverage_payload_digest: digest(`coverage-payload:${envelopeInput.family_profile_id}`),
      covered_set_identity: digest(`covered-set:${envelopeInput.family_profile_id}`),
      exclusions_identity: digest(`exclusions:${envelopeInput.family_profile_id}`),
    },
    ...rawProductQueryPatch,
  };
  const query = compileProductQueryIr({ admission, query: rawProductQuery });
  const domainResult = buildAgreementCandidateDomainResult({
    agreement_candidate_envelope: envelopeValue,
    agreement_candidate_envelope_input: envelopeInput,
    pilot_product_authority_context: authorityContext,
    pilot_product_authority_context_input: authorityInput,
  });
  const orderedResultFields = rawProductQuery.requested_columns.map((field) => ({
    field_reference: clone(field),
    value: field.field_key === 'deal'
      ? { governed_deal_id: digest(`deal:${envelopeInput.family_profile_id}`) }
      : { iso_8601_calendar_date: '2026-04-18' },
  }));
  const projectionIdentity = requestedFieldProjectionIdentity({
    queryIr: query,
    domainResult,
    resultFields: orderedResultFields,
  });
  const receiptBody = {
    schema_version: PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
    product_query_definition_id: query.query_definition_id,
    approved_pm_data_version_id: query.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      query.release_contract.candidate_release_manifest_payload_digest,
    domain_key: domainResult.domain_key,
    domain_result_definition: clone(domainResult.domain_result_definition),
    domain_result_identity: domainResult.domain_result_identity,
    domain_result_payload_digest: domainResult.domain_result_payload_digest,
    domain_validator_admission_identity: digest(`domain-admission:${envelopeInput.family_profile_id}`),
    domain_validation_receipt_id: domainResult.domain_result_validation.validation_receipt_id,
    query_coverage_identity: query.coverage_contract.coverage_identity,
    covered_set_identity: query.coverage_contract.covered_set_identity,
    query_cohort_identity: query.cohort_contract.cohort_definition_id,
    predicate_evaluation_state: 'PASS',
    cohort_evaluation_state: 'PASS',
    filter_evaluation_state: 'PASS',
    covered_set_membership_state: 'PASS',
    requested_field_projection_identity: projectionIdentity,
    admission_state: PRODUCT_QUERY_RESULT_ADMISSION_STATE,
    authority_state: 'NOT_GRANTED',
  };
  const productQueryResultAdmissionReceipt = {
    ...receiptBody,
    admission_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA, receiptBody,
    ),
  };
  const productResultIdentity = contentId('PRODUCT_QUERY_RESULT/V1', {
    schema_version: 'PRODUCT_QUERY_RESULT/V1',
    product_query_definition_id: query.query_definition_id,
    approved_pm_data_version_id: query.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      query.release_contract.candidate_release_manifest_payload_digest,
    domain_key: 'AGREEMENT',
    domain_result_definition_stable_id: resultDefinition.stable_id,
    domain_result_definition_version: resultDefinition.version,
    domain_result_identity: domainResult.domain_result_identity,
  });
  const factBody = {
    schema_version: AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
    fact_state: 'VALIDATED_SORT_PROJECTION',
    product_query_result_identity: productResultIdentity,
    agreement_comparable_result_identity: domainResult.domain_result_identity,
    governed_deal_admission_id: digest(`ordering-deal:${envelopeInput.family_profile_id}`),
    sort_projections: rawProductQuery.sort.map((field) => ({
      field_reference: {
        field_key: field.field_key,
        field_version: field.field_version,
      },
      value_type: 'DATE',
      value_state: 'COMPARABLE_VALUE',
      value: { iso_8601_calendar_date: '2026-04-18' },
    })),
    external_field_projection_validation_receipt_id: digest(`field-check:${envelopeInput.family_profile_id}`),
    external_candidate_membership_validation_receipt_id: digest(`membership-check:${envelopeInput.family_profile_id}`),
    ordering_failure: null,
    authority_state: 'NOT_GRANTED',
  };
  const agreementOrderingFacts = [{
    ...factBody,
    ordering_fact_id: contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA, factBody,
    ),
  }];
  const ordering = compileAgreementComparableResultOrder({
    product_query_ir: query,
    product_field_catalogue_manifest: authorityContext.product_field_catalogue_manifest,
    ordering_facts: agreementOrderingFacts,
  });
  const orderingReceiptBody = {
    schema_version: PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
    product_query_definition_id: query.query_definition_id,
    approved_pm_data_version_id: query.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      query.release_contract.candidate_release_manifest_payload_digest,
    domain_key: 'AGREEMENT',
    complete_candidate_slot_identities: [productResultIdentity],
    ordered_slot_identities: [productResultIdentity],
    excluded_slot_identities: [],
    ordering_validator_stable_id: AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
    ordering_validator_version: AGREEMENT_ORDERING_VALIDATOR_VERSION,
    domain_ordering_projection_schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
    domain_ordering_projection_identity: ordering.ordering_projection_id,
    domain_ordering_projection_payload_digest: ordering.canonical_payload_digest,
    external_validation_receipt_id: digest(`ordering-check:${envelopeInput.family_profile_id}`),
    validation_state: PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    envelopeValue,
    product_evaluation_evidence: {
      schema_version: EVALUATION_EVIDENCE_SCHEMA,
      raw_product_query: rawProductQuery,
      ordered_result_fields: orderedResultFields,
      product_query_result_admission_receipt: productQueryResultAdmissionReceipt,
      agreement_ordering_facts: agreementOrderingFacts,
      product_query_result_ordering_receipt: {
        ...orderingReceiptBody,
        ordering_receipt_id: contentId(
          PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA, orderingReceiptBody,
        ),
      },
      coverage_certification: {
        coverage_certification_identity: digest(`coverage-certificate:${envelopeInput.family_profile_id}`),
        query_coverage_identity: query.coverage_contract.coverage_identity,
        covered_set_identity: query.coverage_contract.covered_set_identity,
        coverage_certification_state: 'CERTIFIED_COMPLETE',
        covered_deal_count: 1,
        excluded_deal_count: 0,
        operational_state: 'COMPLETE',
      },
      understood_legal_question: {
        domain_key: 'AGREEMENT',
        topic_key: 'PILOT',
        pattern_key: predicateAdmission.predicate_key,
        predicate_key: predicateAdmission.predicate_key,
        predicate_version: predicateAdmission.predicate_version,
        label: predicateAdmission.predicate_key,
      },
    },
  };
}

module.exports = {
  authority,
  evaluationEvidence,
  familyInput,
  profileDetailAction,
};
