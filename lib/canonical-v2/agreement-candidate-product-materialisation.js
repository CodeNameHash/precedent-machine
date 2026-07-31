const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  buildAgreementCandidateEnvelope,
  validateAgreementCandidateEnvelope,
} = require('./agreement-candidate-envelope');
const {
  buildAgreementCandidateDomainResult,
} = require('./agreement-candidate-domain-result-adapter');
const {
  buildReviewedIocCapexSlice,
  buildReviewedIocCapexServingRow,
} = require('./reviewed-ioc-capex-slice');
const {
  GENERAL_ACTION_SLOT_KEY,
  buildFixtureClaimEvidenceDetailPackage,
  validateFixtureExactDetailPackage,
} = require('./exact-detail');
const {
  compilePilotProductAuthorityContext,
  validatePilotProductAuthorityContext,
} = require('./pilot-product-authority-context');
const { compileProductQueryIr } = require('./product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
} = require('./product-citation-share-compiler');
const {
  compileProductQueryResult,
} = require('./product-query-result-compiler');
const {
  compileAgreementComparableResultOrder,
} = require('./agreement-comparable-result-order');
const {
  compileProductQueryResultSet,
} = require('./product-query-result-set-compiler');
const {
  compileProductResultPresentation,
} = require('./product-result-presentation-compiler');
const {
  compileProductResultSurfaceBindings,
} = require('./product-result-surface-bindings');
const {
  validateAuthoredProductQueryInputs,
} = require('./product-query-contract-input-validator');
const contract = require(
  '../../contracts/canonical-v2/successor/product/query/agreement-candidate-product-materialisation.v1.json',
);
const envelopeContract = require(
  '../../contracts/canonical-v2/successor/product/query/agreement-candidate-envelope.v1.json',
);
const productQueryContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-ir.v1.json',
);
const surfaceContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-result-surface-binding.v1.json',
);
const f28EnvelopeContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-candidate-envelope.v1.json',
);

const AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA =
  'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1';
const EVALUATION_EVIDENCE_SCHEMA =
  'AGREEMENT_CANDIDATE_PRODUCT_EVALUATION_EVIDENCE/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

class AgreementCandidateProductMaterialisationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgreementCandidateProductMaterialisationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new AgreementCandidateProductMaterialisationError(code, message, details);
}

function clone(value, code = 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_INPUT') {
  try { return JSON.parse(canonicalJson(value)); } catch (error) {
    fail(code, 'The Agreement Product materialisation input is not canonical JSON.', { cause: error.message });
  }
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail(code, `${label} fields do not match the closed contract.`);
  }
}

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function validateContract() {
  try {
    validateAuthoredProductQueryInputs([
      contract,
      envelopeContract,
      productQueryContract,
      surfaceContract,
      f28EnvelopeContract,
    ].map((value) => ({
      object_kind: value.object_kind,
      canonical_value: value,
    })));
  } catch (error) {
    fail('INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_CONTRACT',
      'The signed Agreement Product materialisation contract changed.', { cause: error.code || error.message });
  }
}

function validateEvidence(value) {
  const code = 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_EVALUATION_EVIDENCE';
  exactKeys(value, [
    'agreement_ordering_facts',
    'coverage_certification',
    'ordered_result_fields',
    'product_query_result_admission_receipt',
    'product_query_result_ordering_receipt',
    'raw_product_query',
    'schema_version',
    'understood_legal_question',
  ], 'Product evaluation evidence', code);
  if (value.schema_version !== EVALUATION_EVIDENCE_SCHEMA
    || !Array.isArray(value.ordered_result_fields)
    || !Array.isArray(value.agreement_ordering_facts)) {
    fail(code, 'The Product evaluation evidence is invalid.');
  }
  return clone(value, code);
}

function validateProfileQueryContract(envelope, query) {
  if (envelope.family_profile_id !== 'IOC_CAPEX_RESTRICTION_V1') return;
  const code = 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_INPUT';
  const compilerContract = contract.definition?.compiler_contract;
  const requestedColumns = [{
    field_key: compilerContract?.ioc_requested_fields?.[0],
    field_version: 1,
  }];
  if (
    canonicalJson(compilerContract?.ioc_requested_fields) !== canonicalJson(['deal'])
    || compilerContract.ioc_sort_permitted !== false
  ) {
    fail('INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_CONTRACT',
      'The signed IOC query contract changed.');
  }
  if (
    canonicalJson(query.presentation_contract.requested_columns)
      !== canonicalJson(requestedColumns)
    || query.presentation_contract.sort.length !== 0
  ) {
    fail(code, 'The IOC Product query does not match its governed projection.');
  }
}

function profileSource(envelope, familyInput) {
  if (envelope.family_profile_id === 'CAPITALISATION_BRING_DOWN_V3') {
    exactKeys(familyInput, [
      'contract_bundle', 'parser_source_closure', 'qxo_cross_view_release', 'reviewed_graph', 'source_context',
    ], 'F28 family input', 'INVALID_AGREEMENT_F28_PRODUCT_SOURCE');
    const release = familyInput.qxo_cross_view_release;
    if (canonicalJson(envelope.provision_row) !== canonicalJson(release?.provision_row)) {
      fail('INVALID_AGREEMENT_F28_PRODUCT_SOURCE', 'The F28 envelope row does not match the revalidated release.');
    }
    return { row: release.provision_row, release, ioc: null };
  }
  if (envelope.family_profile_id === 'IOC_CAPEX_RESTRICTION_V1') {
    exactKeys(familyInput, ['agreement_text', 'contract_bundle', 'deal_value_source_text'],
      'IOC family input', 'INVALID_AGREEMENT_IOC_PRODUCT_SOURCE');
    const slice = buildReviewedIocCapexSlice({
      agreementText: familyInput.agreement_text,
      dealValueSourceText: familyInput.deal_value_source_text,
      contractBundle: familyInput.contract_bundle,
    });
    if (envelope.source_projection.source_release.id !== slice.reviewed_mapping.reviewed_mapping_id) {
      fail('INVALID_AGREEMENT_IOC_PRODUCT_SOURCE', 'The IOC envelope does not match the rebuilt reviewed slice.');
    }
    if (
      slice.thresholdClaim.denominator.precision !== 'APPROXIMATE'
      || slice.thresholdClaim.attributes.denominator_precision
        !== 'APPROXIMATE'
    ) {
      fail(
        'INVALID_AGREEMENT_IOC_PRODUCT_SOURCE',
        'The IOC denominator precision does not match the reviewed policy.',
      );
    }
    return { row: envelope.provision_row, release: null, ioc: slice };
  }
  fail('UNKNOWN_AGREEMENT_PRODUCT_PROFILE', 'The Agreement Product profile is not admitted.');
}

function iocDetailBinding(detailPackage) {
  const code = 'INVALID_AGREEMENT_IOC_PRODUCT_EVIDENCE_BINDING';
  const reference = detailPackage?.references?.[0];
  const payload = detailPackage?.detail_payloads?.[0];
  const response = payload?.response_body;
  const claimEvidencePath = reference?.ordered_path?.find(
    (entry) => entry.object_type === 'ClaimEvidence',
  );
  const excerptPath = reference?.ordered_path?.find(
    (entry) => entry.object_type === 'Excerpt',
  );
  const canonicalTextPath = reference?.ordered_path?.find(
    (entry) => entry.object_type === 'CanonicalText',
  );
  const sourceOccurrencePath = reference?.ordered_path?.find(
    (entry) => entry.object_type === 'SourceOccurrence',
  );
  const sourceAdmissionPath = reference?.ordered_path?.find(
    (entry) => entry.object_type === 'SourceAdmissionManifest',
  );
  const sourceContentPath = reference?.ordered_path?.find(
    (entry) => entry.object_type === 'SourceContent',
  );
  if (
    detailPackage?.references?.length !== 1
    || detailPackage?.detail_payloads?.length !== 1
    || reference.action_slot_key !== GENERAL_ACTION_SLOT_KEY
    || payload.detail_kind !== 'CLAIM_EVIDENCE'
    || payload.terminal_object_type !== 'CLAIM_EVIDENCE'
    || reference.source_detail_payload_id !== payload.source_detail_payload_id
    || reference.contextual_use_key !== payload.contextual_use_key
    || claimEvidencePath?.object_id !== payload.terminal_object_id
    || claimEvidencePath?.object_id !== response?.claim_evidence_id
    || excerptPath?.object_id !== response?.excerpt?.excerpt_id
    || canonicalTextPath?.object_id
      !== response?.source_lineage?.canonical_text_id
    || sourceOccurrencePath?.object_id
      !== response?.source_lineage?.source_occurrence_id
    || sourceAdmissionPath?.object_id
      !== response?.source_lineage?.source_admission_manifest_id
    || sourceContentPath?.object_id
      !== response?.source_lineage?.source_content_id
  ) {
    fail(
      code,
      'The IOC claim-evidence reference and payload do not bind the same source evidence.',
    );
  }
  return {
    sourceDocumentIdentity: response.source_lineage.document_hash,
    sourceEvidenceIdentity: response.excerpt.excerpt_id,
    resultComponentEvidenceIdentity: response.claim_evidence_id,
  };
}

function validateIocCitationDetailBinding(citation, detailPackage) {
  const binding = iocDetailBinding(detailPackage);
  if (
    citation.source_document_identity !== binding.sourceDocumentIdentity
    || citation.source_evidence_identity !== binding.sourceEvidenceIdentity
    || citation.result_component_evidence_identity
      !== binding.resultComponentEvidenceIdentity
  ) {
    fail(
      'INVALID_AGREEMENT_IOC_PRODUCT_EVIDENCE_BINDING',
      'The IOC citation does not match its exact claim-evidence detail package.',
    );
  }
  return true;
}

function buildExactCitation(domainResult, query, source, iocDetailPackage) {
  let sourceDocumentIdentity;
  let sourceEvidenceIdentity;
  let resultComponentEvidenceIdentity;
  let sourceLabel;
  if (source.release) {
    const row = source.release.provision_row;
    sourceDocumentIdentity = row.document_hash;
    sourceEvidenceIdentity = contentId('QXO_CAPITALISATION_F28_RESULT_EVIDENCE/V1', {
      provision_row_id: row.provision_row_id,
      subrow_evidence: row.subrows.map((subrow) => ({
        subrow_id: subrow.subrow_id,
        evidence_reference_ids: subrow.source.evidence_reference_ids,
        exact_detail_reference_id: subrow.source.exact_detail.exact_detail_reference_id,
      })),
    });
    resultComponentEvidenceIdentity = sourceEvidenceIdentity;
    sourceLabel = row.label;
  } else {
    const binding = iocDetailBinding(iocDetailPackage);
    sourceDocumentIdentity = binding.sourceDocumentIdentity;
    sourceEvidenceIdentity = binding.sourceEvidenceIdentity;
    resultComponentEvidenceIdentity =
      binding.resultComponentEvidenceIdentity;
    sourceLabel = 'Landos merger agreement, Section 5.2';
  }
  const citationTarget = contentId(PRODUCT_EXACT_CITATION_SCHEMA, {
    product_query_result_identity: contentId('PRODUCT_QUERY_RESULT/V1', {
      schema_version: 'PRODUCT_QUERY_RESULT/V1',
      product_query_definition_id: query.query_definition_id,
      approved_pm_data_version_id: query.release_contract.approved_pm_data_version_id,
      candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest: query.release_contract.candidate_release_manifest_payload_digest,
      domain_key: 'AGREEMENT',
      domain_result_definition_stable_id: domainResult.domain_result_definition.stable_id,
      domain_result_definition_version: domainResult.domain_result_definition.version,
      domain_result_identity: domainResult.domain_result_identity,
    }),
    candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: query.release_contract.candidate_release_manifest_payload_digest,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
  });
  return {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: sourceEvidenceIdentity,
    source_representation_kind: 'STRUCTURED_RESULT',
    source_interval: null,
    result_component_evidence_identity: resultComponentEvidenceIdentity,
    source_accession_or_equivalent_identity: sourceDocumentIdentity,
    source_filing_type: null,
    source_filing_date: null,
    source_location_label: sourceLabel,
    human_readable_source_label: sourceLabel,
    citation_target_identity: citationTarget,
  };
}

function buildIocDetailPackage(slice, contractBundle) {
  const row = buildReviewedIocCapexServingRow({
    slice,
    contractBundle,
  });
  const value = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contractBundle,
    row,
    source: slice.agreementSource,
    source_admission: slice.agreementAdmission,
    excerpt: slice.excerpts.threshold,
    claim: slice.thresholdClaim,
    action_slot_key: GENERAL_ACTION_SLOT_KEY,
    evidence_ordinal: 0,
  });
  validateFixtureExactDetailPackage({
    package: value,
    contract_bundle: contractBundle,
    row,
    source: slice.agreementSource,
    source_admission: slice.agreementAdmission,
    excerpt: slice.excerpts.threshold,
    claim: slice.thresholdClaim,
    action_slot_key: GENERAL_ACTION_SLOT_KEY,
    evidence_ordinal: 0,
  });
  return value;
}

function compileAgreementCandidateProductMaterialisation(input = {}) {
  const code = 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_INPUT';
  exactKeys(input, [
    'agreement_candidate_envelope', 'family_input', 'pilot_product_authority_context',
    'pilot_product_authority_context_input', 'product_evaluation_evidence',
  ], 'Agreement Product materialisation input', code);
  validateContract();
  const envelopeInput = {
    family_profile_id: input.agreement_candidate_envelope?.family_profile_id,
    family_input: input.family_input,
  };
  try {
    validateAgreementCandidateEnvelope(input.agreement_candidate_envelope, envelopeInput);
    validatePilotProductAuthorityContext(
      input.pilot_product_authority_context,
      input.pilot_product_authority_context_input,
    );
  } catch (error) {
    fail(code, 'The Agreement envelope or Product authority context is invalid.', { cause: error.code || error.message });
  }
  const envelope = clone(input.agreement_candidate_envelope);
  const profile = envelopeContract.definition.runtime_contract
    .admitted_family_profiles.find((value) => (
      value.profile_id === envelope.family_profile_id
    ));
  const action = profile?.exact_detail_action_stable_id;
  if (!action || profile.exact_detail_action_version !== 1) {
    fail(code, 'The Agreement envelope profile has no governed exact-detail action.');
  }
  const context = clone(input.pilot_product_authority_context);
  const evidence = validateEvidence(input.product_evaluation_evidence);
  const source = profileSource(envelope, input.family_input);
  const query = compileProductQueryIr({
    admission: context.product_query_admission_context,
    query: evidence.raw_product_query,
  });
  validateProfileQueryContract(envelope, query);
  if (
    query.semantic_contract.domain_key !== 'AGREEMENT'
    || query.semantic_contract.result_definition.stable_id
      !== envelope.product_membership.result_definition_stable_id
    || query.semantic_contract.result_definition.version
      !== envelope.product_membership.result_definition_version
  ) fail(code, 'The raw Product query does not match the Agreement envelope profile.');
  const domainResult = buildAgreementCandidateDomainResult({
    agreement_candidate_envelope: envelope,
    agreement_candidate_envelope_input: envelopeInput,
    pilot_product_authority_context: context,
    pilot_product_authority_context_input:
      input.pilot_product_authority_context_input,
  });
  const iocDetailPackage = source.ioc ? buildIocDetailPackage(
    source.ioc,
    input.family_input.contract_bundle,
  ) : null;
  const citation = buildExactCitation(
    domainResult,
    query,
    source,
    iocDetailPackage,
  );
  if (iocDetailPackage) {
    validateIocCitationDetailBinding(citation, iocDetailPackage);
  }
  const productResult = compileProductQueryResult({
    product_query_ir: query,
    domain_result: domainResult,
    result_fields: evidence.ordered_result_fields,
    exact_citation: citation,
    exact_detail_action: action,
    admission_receipt: evidence.product_query_result_admission_receipt,
  });
  const ordering = compileAgreementComparableResultOrder({
    product_query_ir: query,
    product_field_catalogue_manifest: context.product_field_catalogue_manifest,
    ordering_facts: evidence.agreement_ordering_facts,
  });
  const set = compileProductQueryResultSet({
    product_query_ir: query,
    candidate_slots: [{ slot_identity: productResult.product_query_result_identity, slot_state: 'VALID', product_query_result: productResult, failure: null }],
    domain_ordering_projection: ordering,
    ordering_receipt: evidence.product_query_result_ordering_receipt,
    coverage_certification: evidence.coverage_certification,
  });
  const presentation = compileProductResultPresentation({
    understood_legal_question: evidence.understood_legal_question,
    product_query_ir: query,
    product_field_catalogue_manifest: context.product_field_catalogue_manifest,
    ordered_result_slots: set.ordered_result_slots,
    query_execution_summary: set.query_execution_summary,
  });
  const surfaces = compileProductResultSurfaceBindings({
    product_query_ir: query,
    product_query_result: productResult,
    product_result_presentation: presentation,
    candidate_release_binding: {
      approved_pm_data_version_id: query.release_contract.approved_pm_data_version_id,
      candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest: query.release_contract.candidate_release_manifest_payload_digest,
    },
    exact_source_action: { exact_citation: citation, exact_detail_action: action },
  });
  const candidateReleaseBinding = {
    approved_pm_data_version_id:
      query.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      query.release_contract.candidate_release_manifest_payload_digest,
    corpus_release_id:
      context.candidate_release_manifest.corpus_release_id,
    product_query_definition_id: query.query_definition_id,
    release_state: 'CANDIDATE_NOT_ACTIVE',
    authority_state: 'NOT_GRANTED',
  };
  const body = {
    agreement_candidate_envelope_id: envelope.agreement_candidate_envelope_id,
    candidate_release_binding: candidateReleaseBinding,
    product_query_ir: query,
    product_query_result: productResult,
    agreement_ordering_projection: ordering,
    product_result_set: set,
    product_result_presentation: presentation,
    product_result_surfaces: surfaces,
    product_evaluation_evidence: evidence,
    evidence_sidecar: {
      exact_citation: citation,
      source_projection_id: envelope.source_projection_id,
      source_projection_payload_digest: envelope.source_projection_payload_digest,
      exact_detail_package: iocDetailPackage || {
        release_id: source.release.qxo_capitalisation_cross_view_release_f28_id,
        release_payload_digest: source.release.canonical_payload_digest,
        provision_row_id: source.release.provision_row.provision_row_id,
        document_hash: source.release.provision_row.document_hash,
        label: source.release.provision_row.label,
        ordered_subrows: source.release.provision_row.subrows.map((subrow) => ({
          subrow_id: subrow.subrow_id,
          evidence_reference_ids: clone(subrow.source.evidence_reference_ids),
          exact_detail_reference_id: subrow.source.exact_detail.exact_detail_reference_id,
        })),
        exact_detail_action: action,
      },
    },
    materialisation_state: 'VALIDATED_NOT_PERSISTED',
    authority_state: 'NOT_GRANTED',
  };
  return freeze({
    schema_version: AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA,
    agreement_candidate_product_materialisation_id: contentId(
      AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA, body,
    ),
    ...body,
  });
}

module.exports = {
  AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA,
  EVALUATION_EVIDENCE_SCHEMA,
  AgreementCandidateProductMaterialisationError,
  buildIocDetailPackage,
  compileAgreementCandidateProductMaterialisation,
  validateIocCitationDetailBinding,
};
