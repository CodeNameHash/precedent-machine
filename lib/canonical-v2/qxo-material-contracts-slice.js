const { buildAdmittedSourceReference } = require('./admitted-semantic-source');
const {
  buildAdmittedMultiSourceResultCompositionDetailPackage,
} = require('./admitted-composition-exact-detail');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildClaimRevision } = require('./claims-relationships');
const {
  moneyDenominatorPrecisionPolicyForClaim,
  validateContractBundle,
} = require('./contract-bundle');
const { normaliseMoneyRelativeToDealValue } = require('./observation-normalisers');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildIncompleteCanonicalResultServingRow } = require('./shared-serving-row');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_MATERIAL_CONTRACT_CASH_FLOW/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const DEAL_ADMISSION_ID = '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const AGREEMENT_DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const AGREEMENT_CANONICAL_TEXT_ID = 'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH = 414782;
const DEAL_VALUE_DOCUMENT_HASH = '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827';
const DEAL_VALUE_CANONICAL_TEXT_ID = 'd7c3caff402ccb2912ce35e1a0fbfaff722316590686cead385a93e3466141cd';
const DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH = 17900;
const CONTRACTS_INTERVAL = Object.freeze({ start: 115227, end: 122077 });
const CONTRACTS_SHA256 = '247c2a87d37870114b87a5e59284c434badcc082e9a755b89aa61dd7b2ee4fdb';
const CRITERION_INTERVAL = Object.freeze({ start: 116268, end: 116528 });
const CRITERION_SHA256 = 'cded36271a87be73f9f86854ad01a2e77565183ebc80b9fff3ff78922f244cef';
const DEAL_VALUE_INTERVAL = Object.freeze({ start: 533, end: 653 });
const DEAL_VALUE_SHA256 = 'baa64b186700a9360b1d2820eb87f72fc37a12c0165f9a18d0d2ea4b09185eff';
const CRITERION_TEXT = '(D) any Contract that involved expenditures or receipts by the Company or any of its Subsidiaries of more than $10,000,000 in 2025 or by its terms contemplates expenditures or receipts by the Company or any of its Subsidiaries of more than $10,000,000 in 2026;';
const DEAL_VALUE_TEXT = 'entered into a definitive agreement to acquire TopBuild Corp. (NYSE: BLD) (“TopBuild”) for approximately $17 billion';
const ACTUAL_PERIOD_TEXT = 'involved expenditures or receipts by the Company or any of its Subsidiaries of more than $10,000,000 in 2025';
const CONTEMPLATED_PERIOD_TEXT = 'by its terms contemplates expenditures or receipts by the Company or any of its Subsidiaries of more than $10,000,000 in 2026';
const PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });
const RESULT_KEY = 'TARGET_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD';
const METRIC_KEY = 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE';
const GOVERNED_REASON = 'UNMAPPED_MEASUREMENT_PERIOD';
const NON_COMPARABLE_REASON = 'The actual 2025 and contemplated 2026 measurement periods have no governed measurement-period code in this corpus release.';
const DEFAULT_DEAL_DIMENSIONS = Object.freeze({
  sector: 'Industrials',
  buyer: 'QXO',
  merger_form: 'Merger',
  adviser_firms: Object.freeze([]),
  lawyers: Object.freeze([]),
  announce_year: 2026,
  deal_value_usd: '17000000000',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactBytes(source, interval) {
  return Buffer.from(source.canonical_text.text, 'utf8').subarray(interval.start, interval.end);
}

function validateSourceContext(source, {
  label,
  sourceOrdinal,
  documentHash,
  canonicalTextId,
  canonicalTextByteLength,
} = {}) {
  buildAdmittedSourceReference(source);
  if (source.governed_deal_key !== DEAL_KEY
    || source.deal_admission_id !== DEAL_ADMISSION_ID
    || source.source_ordinal !== sourceOrdinal
    || source.document_hash !== documentHash
    || source.canonical_text_id !== canonicalTextId
    || source.canonical_text_byte_length !== canonicalTextByteLength) {
    throw new TypeError(`${label} admitted source lineage has drifted`);
  }
}

function exactSubspan(source, parentInterval, text, label) {
  const parent = exactBytes(source, parentInterval);
  const token = Buffer.from(text, 'utf8');
  const relativeStart = parent.indexOf(token);
  if (relativeStart < 0 || parent.indexOf(token, relativeStart + token.length) >= 0) {
    throw new TypeError(`reviewed ${label} is missing or ambiguous`);
  }
  return buildSemanticSpan(
    source,
    parentInterval.start + relativeStart,
    parentInterval.start + relativeStart + token.length,
  );
}

function claimEvidence(excerpt, evidenceRole, documentOrdinal) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: documentOrdinal,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function openWorldEvidence(excerpt, evidenceRole, governedOrdinal) {
  const body = {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    semantic_span_id: excerpt.ordered_component_assignments[0].semantic_span_id,
    document_hash: excerpt.document_hash,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    exact_bytes_digest: excerpt.exact_bytes_digest,
    governed_ordinal: governedOrdinal,
  };
  return freeze({
    evidence_reference_id: contentId('OPEN_WORLD_EVIDENCE_REFERENCE/V1', body),
    ...body,
  });
}

function buildOpenWorldPeriodGraph({ excerpts, derivedResultOccurrenceId }) {
  const evidenceReferences = freeze([
    openWorldEvidence(excerpts.actual_period, 'UNMAPPED_ATTRIBUTE_OR_QUESTION', 0),
    openWorldEvidence(excerpts.contemplated_period, 'UNMAPPED_ATTRIBUTE_OR_QUESTION', 1),
  ]);
  const observedPartyTokens = freeze(['Company', 'Subsidiaries']);
  const observedPartyTokenDigest = contentId('OBSERVED_PARTY_TOKEN_SET/V1', observedPartyTokens);
  const orderedEvidenceIds = evidenceReferences.map((row) => row.evidence_reference_id);
  const neutralPropositionDigest = contentId('NEUTRAL_LEGAL_PROPOSITION/V1', {
    known_result_key: RESULT_KEY,
    attribute_or_question: 'MATERIAL_CONTRACT_MEASUREMENT_PERIOD',
    raw_periods: [
      { temporal_mode: 'ACTUAL', raw_value: '2025' },
      { temporal_mode: 'CONTEMPLATED', raw_value: '2026' },
    ],
  });
  const candidateBody = {
    schema_version: 'NOVEL_CONCEPT_CANDIDATE/V1',
    candidate_kind: 'ATTRIBUTE_OR_QUESTION',
    document_hash: AGREEMENT_DOCUMENT_HASH,
    ordered_proposition_evidence_reference_ids: orderedEvidenceIds,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  };
  const candidateId = contentId('NOVEL_CONCEPT_CANDIDATE/V1', candidateBody);
  const openWorldCandidate = freeze({ candidate_id: candidateId, ...candidateBody });
  const occurrenceBody = {
    schema_version: 'OPEN_WORLD_CANDIDATE_OCCURRENCE/V1',
    candidate_id: candidateId,
    admission_state: 'ADMITTED_SEMANTIC',
    document_hash: AGREEMENT_DOCUMENT_HASH,
    ordered_proposition_evidence_reference_ids: orderedEvidenceIds,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  };
  const occurrenceId = contentId('OPEN_WORLD_CANDIDATE_OCCURRENCE/V1', occurrenceBody);
  const candidateOccurrence = freeze({
    open_world_candidate_occurrence_id: occurrenceId,
    candidate_id: candidateId,
    candidate_kind: 'ATTRIBUTE_OR_QUESTION',
    admission_state: occurrenceBody.admission_state,
    document_hash: occurrenceBody.document_hash,
    ordered_proposition_evidence_reference_ids: orderedEvidenceIds,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  });
  const dispositionBody = {
    schema_version: 'OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1',
    open_world_candidate_occurrence_id: occurrenceId,
    disposition_code: 'REVIEWED_SOURCE_SPECIFIC',
    review_state: 'FINAL',
    reviewed_display_label: 'Material-contract cash-flow measurement period',
    non_comparable_reason: NON_COMPARABLE_REASON,
  };
  const finalDisposition = freeze({
    final_disposition_id: contentId('OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1', dispositionBody),
    disposition_code: dispositionBody.disposition_code,
    review_state: dispositionBody.review_state,
    reviewed_display_label: dispositionBody.reviewed_display_label,
    non_comparable_reason: dispositionBody.non_comparable_reason,
  });
  const primitiveBody = {
    primitive_kind: 'TIME',
    governed_ordinal: 0,
    raw_value: 'actual expenditures or receipts in 2025; contemplated expenditures or receipts in 2026',
    interpreted_value: 'Actual cash flow is tested for 2025 and contemplated cash flow is tested for 2026; no frozen cross-deal period code is assigned.',
    evidence_reference_ids: orderedEvidenceIds,
  };
  const primitive = freeze({
    primitive_id: contentId('OPEN_WORLD_LEGAL_PRIMITIVE/V1', {
      open_world_candidate_occurrence_id: occurrenceId,
      ...primitiveBody,
    }),
    ...primitiveBody,
  });
  const impactBody = {
    schema_version: 'SEMANTIC_IMPACT_CLOSURE/V1',
    open_world_candidate_occurrence_id: occurrenceId,
    impact_value: 'AFFECTS_CANONICAL_RESULT',
    affected_canonical_result_occurrence_ids: [derivedResultOccurrenceId],
    market_authority: 'NO_MARKET_AUTHORITY',
  };
  const semanticImpactClosure = freeze({
    semantic_impact_closure_id: contentId('SEMANTIC_IMPACT_CLOSURE/V1', impactBody),
    impact_value: impactBody.impact_value,
    affected_canonical_result_occurrence_ids: impactBody.affected_canonical_result_occurrence_ids,
    market_authority: impactBody.market_authority,
  });
  return freeze({
    observedPartyTokens,
    evidenceReferences,
    openWorldCandidate,
    candidateOccurrence,
    finalDisposition,
    primitives: [primitive],
    semanticImpactClosure,
  });
}

function buildQxoMaterialContractsSlice({
  agreementSourceContext,
  agreementSourceAdmission,
  dealValueSourceContext,
  dealValueSourceAdmission,
  contractBundle,
  corpusReleaseId,
  dealDimensions = DEFAULT_DEAL_DIMENSIONS,
} = {}) {
  validateContractBundle(contractBundle);
  if (!/^[a-f0-9]{64}$/.test(corpusReleaseId || '')) throw new TypeError('corpusReleaseId is required');
  validateSourceContext(agreementSourceContext, {
    label: 'agreement',
    sourceOrdinal: 0,
    documentHash: AGREEMENT_DOCUMENT_HASH,
    canonicalTextId: AGREEMENT_CANONICAL_TEXT_ID,
    canonicalTextByteLength: AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  });
  validateSourceContext(dealValueSourceContext, {
    label: 'deal-value',
    sourceOrdinal: 1,
    documentHash: DEAL_VALUE_DOCUMENT_HASH,
    canonicalTextId: DEAL_VALUE_CANONICAL_TEXT_ID,
    canonicalTextByteLength: DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  });
  if (sha256Hex(exactBytes(agreementSourceContext, CONTRACTS_INTERVAL)) !== CONTRACTS_SHA256) {
    throw new TypeError('reviewed QXO Contracts section has drifted');
  }
  if (sha256Hex(exactBytes(agreementSourceContext, CRITERION_INTERVAL)) !== CRITERION_SHA256
    || exactBytes(agreementSourceContext, CRITERION_INTERVAL).toString('utf8') !== CRITERION_TEXT) {
    throw new TypeError('reviewed QXO material-contract criterion has drifted');
  }
  if (sha256Hex(exactBytes(dealValueSourceContext, DEAL_VALUE_INTERVAL)) !== DEAL_VALUE_SHA256
    || exactBytes(dealValueSourceContext, DEAL_VALUE_INTERVAL).toString('utf8') !== DEAL_VALUE_TEXT) {
    throw new TypeError('reviewed QXO deal-value denominator has drifted');
  }

  const spans = freeze({
    contracts: buildSemanticSpan(agreementSourceContext, CONTRACTS_INTERVAL.start, CONTRACTS_INTERVAL.end),
    criterion: buildSemanticSpan(agreementSourceContext, CRITERION_INTERVAL.start, CRITERION_INTERVAL.end),
    actual_period: exactSubspan(agreementSourceContext, CRITERION_INTERVAL, ACTUAL_PERIOD_TEXT, 'actual 2025 period'),
    contemplated_period: exactSubspan(
      agreementSourceContext,
      CRITERION_INTERVAL,
      CONTEMPLATED_PERIOD_TEXT,
      'contemplated 2026 period',
    ),
    deal_value: buildSemanticSpan(dealValueSourceContext, DEAL_VALUE_INTERVAL.start, DEAL_VALUE_INTERVAL.end),
  });
  const excerpts = freeze(Object.fromEntries(Object.entries(spans)
    .filter(([key]) => key !== 'contracts')
    .map(([key, span]) => [key, buildExcerpt({
      source: key === 'deal_value' ? dealValueSourceContext : agreementSourceContext,
      span,
    })])));
  const provision = buildProvisionInstance({
    source: agreementSourceContext,
    span: spans.contracts,
    conceptKey: 'REP-T-CONTRACTS',
    party: PARTY,
    ordinal: 1,
    contractBundle,
  });
  const component = buildProvisionComponent({
    source: agreementSourceContext,
    parentProvision: provision,
    span: spans.criterion,
    componentKey: 'MATERIAL_CONTRACT_CRITERION',
    ordinal: 4,
    contractBundle,
  });
  const denominatorPrecisionPolicy = moneyDenominatorPrecisionPolicyForClaim(
    contractBundle,
    METRIC_KEY,
  );
  const normalised = normaliseMoneyRelativeToDealValue({
    rawAmount: '10000000',
    currency: 'USD',
    denominator: {
      value: '17000000000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [excerpts.deal_value.excerpt_id],
      ...(denominatorPrecisionPolicy ? { precision: 'APPROXIMATE' } : {}),
    },
    derivationVersion: REVIEW_VERSION,
  });
  const scopeIds = [excerpts.criterion.excerpt_id, excerpts.deal_value.excerpt_id].sort();
  const claim = buildClaimRevision({
    subject_occurrence_id: component.provision_component_id,
    claim_definition_key: METRIC_KEY,
    state: 'PRESENT',
    raw_value: '$10,000,000',
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    denominator: normalised.denominator,
    attributes: {
      basis_key: normalised.basis_key,
      raw_amount: normalised.raw_value.amount,
      raw_currency: normalised.raw_value.currency,
      criterion_code: 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR',
      contract_scope_code: 'ANY_COMPANY_CONTRACT',
      cash_flow_direction_code: 'BY_OR_TO_COMPANY',
      comparison_operator: 'GREATER_THAN',
      measurement_period_raw_text: 'actual expenditures or receipts in 2025; contemplated expenditures or receipts in 2026',
      actual_period_raw: '2025',
      contemplated_period_raw: '2026',
      measurement_period_mapping_state: 'UNMAPPED_FROZEN_TAXONOMY',
      ...(denominatorPrecisionPolicy ? { denominator_precision: 'APPROXIMATE' } : {}),
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: [
      'basis_key',
      'raw_amount',
      'raw_currency',
      'criterion_code',
      'contract_scope_code',
      'cash_flow_direction_code',
      'comparison_operator',
      'measurement_period_raw_text',
      'actual_period_raw',
      'contemplated_period_raw',
      'measurement_period_mapping_state',
      ...(denominatorPrecisionPolicy ? ['denominator_precision'] : []),
      'normalisation_payload_digest',
    ],
    evidence: [
      claimEvidence(excerpts.criterion, 'OPERATIVE_TEXT', 0),
      claimEvidence(excerpts.deal_value, 'DERIVATION_INPUT', 1),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
        review_version: REVIEW_VERSION,
        interval_ids: scopeIds,
      }),
      coverage_status: 'COMPLETE',
      required_interval_ids: scopeIds,
      examined_interval_ids: scopeIds,
    },
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
    claim_revision_id: claim.claim_revision_id,
    relationship_revision_ids: [],
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: DEAL_ADMISSION_ID,
    result_key: RESULT_KEY,
    result_version: 1,
    concept_key: 'REP-T-CONTRACTS',
    party: PARTY,
    value_slot_key: 'CASH_FLOW_THRESHOLD',
    ordinal: 0,
    claim,
    relationships: [],
    composition_scope_closure_id: compositionScopeClosureId,
    completeness: 'INCOMPLETE',
    comparability: 'NOT_CERTIFIED',
  });
  const deal = freeze({
    deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    document_hash: AGREEMENT_DOCUMENT_HASH,
    dimensions: {
      ...dealDimensions,
      adviser_firms: [...dealDimensions.adviser_firms],
      lawyers: [...dealDimensions.lawyers],
    },
  });
  const projection = projectMarketMetricSlot({
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal,
    concept_key: 'REP-T-CONTRACTS',
    metric_key: METRIC_KEY,
    party: PARTY,
    result,
    claim,
    relationships: [],
    value_slot_key: 'CASH_FLOW_THRESHOLD',
    ordinal: 0,
  });
  if (projection.observation
    || projection.exclusion?.exclusion_reason !== 'RESULT_INCOMPLETE'
    || projection.exclusion?.comparability_state !== 'NOT_CERTIFIED') {
    throw new TypeError('QXO material-contract threshold must remain outside the market cohort');
  }
  const derivedResultOccurrenceId = contentId('DERIVED_RESULT_OCCURRENCE/V1', {
    schema_version: 'DERIVED_RESULT_OCCURRENCE/V1',
    deal_admission_id: DEAL_ADMISSION_ID,
    result_key: RESULT_KEY,
    result_version: 1,
    concept_key: 'REP-T-CONTRACTS',
    party: PARTY,
    result_ordinal: 0,
  });
  const openWorld = buildOpenWorldPeriodGraph({ excerpts, derivedResultOccurrenceId });
  const intersectingCandidates = [{
    open_world_candidate_occurrence_id: openWorld.candidateOccurrence.open_world_candidate_occurrence_id,
    final_disposition_id: openWorld.finalDisposition.final_disposition_id,
    semantic_impact_closure_id: openWorld.semanticImpactClosure.semantic_impact_closure_id,
    impact_value: openWorld.semanticImpactClosure.impact_value,
  }];
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: AGREEMENT_DOCUMENT_HASH,
    canonical_text_ids: [AGREEMENT_CANONICAL_TEXT_ID, DEAL_VALUE_CANONICAL_TEXT_ID],
    governed_parent_intervals: [CONTRACTS_INTERVAL],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((row) => row.excerpt_id).sort(),
    canonical_object_ids: [
      provision.provision_instance_id,
      component.provision_component_id,
      claim.claim_revision_id,
      openWorld.openWorldCandidate.candidate_id,
      openWorld.candidateOccurrence.open_world_candidate_occurrence_id,
      openWorld.finalDisposition.final_disposition_id,
      openWorld.semanticImpactClosure.semantic_impact_closure_id,
    ].sort(),
  };
  const reviewedMapping = freeze({
    ...reviewedMappingBody,
    reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
    canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
  });
  const row = buildIncompleteCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: reviewedMapping.reviewed_mapping_id,
      contract_fingerprint: contractBundle.fingerprint,
      corpus_release_id: corpusReleaseId,
    }),
    projection_output: projection,
    result,
    claim,
    relationships: [],
    governed_reason_codes: [GOVERNED_REASON],
    intersecting_candidates: intersectingCandidates,
    result_ordinal: 0,
  });
  const closureId = contentId('QXO_MATERIAL_CONTRACT_SEMANTIC_CLOSURE/V1', {
    deal_admission_id: DEAL_ADMISSION_ID,
    reviewed_mapping_id: reviewedMapping.reviewed_mapping_id,
    incomplete_result_review_row_serving_key: row.row_serving_key,
  });
  const close = (rows) => rows.map((item) => freeze({ ...item, closure_id: closureId }));
  const occurrenceId = openWorld.candidateOccurrence.open_world_candidate_occurrence_id;
  const exactDetailSources = freeze([
    { source: agreementSourceContext, source_admission: agreementSourceAdmission },
    { source: dealValueSourceContext, source_admission: dealValueSourceAdmission },
  ]);
  const exactDetailComponents = freeze([{
    component: result,
    claim,
    relationships: [],
  }]);
  const exactDetailExcerpts = freeze([excerpts.criterion, excerpts.deal_value]);
  const exactDetailInput = freeze({
    schema_version: 'ADMITTED_MULTI_SOURCE_RESULT_COMPOSITION_INPUT/V1',
    adapter_status: 'CERTIFIED',
    source_context_ids: exactDetailSources.map((entry) => (
      entry.source.admitted_semantic_source_context_id
    )),
    source_admission_manifest_ids: exactDetailSources.map((entry) => (
      entry.source_admission?.source_admission_manifest_id
    )),
    source_ordinals: exactDetailSources.map((entry) => entry.source.source_ordinal),
    row_serving_key: row.row_serving_key,
    component: result,
    claim,
    relationships: [],
    relationship_targets: [],
    excerpts: exactDetailExcerpts,
  });
  const exactDetailPackage = buildAdmittedMultiSourceResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row,
    sources: exactDetailSources,
    components: exactDetailComponents,
    relationship_targets: [],
    excerpts: exactDetailExcerpts,
  });
  const publishedRow = exactDetailPackage.row;
  const semanticWriteSet = freeze({
    source_references: [
      buildAdmittedSourceReference(agreementSourceContext),
      buildAdmittedSourceReference(dealValueSourceContext),
    ],
    deal,
    excerpts: close(Object.values(excerpts)),
    validated_semantic_graphs: [],
    provisions: close([provision]),
    components: close([component]),
    claims: close([claim]),
    relationships: [],
    open_world_candidates: close([openWorld.openWorldCandidate]),
    open_world_candidate_occurrences: close([{
      schema_version: 'OPEN_WORLD_CANDIDATE_OCCURRENCE/V1',
      ...openWorld.candidateOccurrence,
    }]),
    open_world_evidence_references: close(openWorld.evidenceReferences.map((reference) => ({
      ...reference,
      open_world_candidate_occurrence_id: occurrenceId,
      canonical_text_id: AGREEMENT_CANONICAL_TEXT_ID,
    }))),
    open_world_candidate_dispositions: close([{
      schema_version: 'OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1',
      open_world_candidate_occurrence_id: occurrenceId,
      ...openWorld.finalDisposition,
    }]),
    open_world_primitives: close(openWorld.primitives.map((primitive) => ({
      open_world_candidate_occurrence_id: occurrenceId,
      ...primitive,
    }))),
    semantic_impact_closures: close([{
      schema_version: 'SEMANTIC_IMPACT_CLOSURE/V1',
      open_world_candidate_occurrence_id: occurrenceId,
      ...openWorld.semanticImpactClosure,
    }]),
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: close([{
      incomplete_result_review_row_serving_key: publishedRow.row_serving_key,
      shared_serving_row: publishedRow,
    }]),
  });
  return freeze({
    schema_version: 'QXO_MATERIAL_CONTRACTS_SLICE/V1',
    corpus_release_id: corpusReleaseId,
    reviewed_mapping: reviewedMapping,
    spans,
    excerpts,
    provision,
    component,
    claim,
    normalised,
    result,
    projection,
    incomplete_shared_row: publishedRow,
    open_world: openWorld,
    semantic_write_set: semanticWriteSet,
    admitted_exact_detail_input: exactDetailInput,
    admitted_exact_detail_package: exactDetailPackage,
    candidate_release_member: {
      projection_output: projection,
      shared_row: publishedRow,
      exact_detail: {
        package: exactDetailPackage,
        sources: exactDetailSources,
        components: exactDetailComponents,
        relationship_targets: [],
        excerpts: exactDetailExcerpts,
      },
    },
    incomplete_release_member_intent: {
      projection_output: projection,
      shared_row: publishedRow,
      admitted_exact_detail_input_id: contentId('ADMITTED_MULTI_SOURCE_RESULT_COMPOSITION_INPUT/V1', exactDetailInput),
    },
  });
}

function validateQxoMaterialContractsSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoMaterialContractsSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO material-contract slice identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  AGREEMENT_CANONICAL_TEXT_ID,
  AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  CONTRACTS_INTERVAL,
  CRITERION_INTERVAL,
  DEAL_ADMISSION_ID,
  DEAL_KEY,
  DEAL_VALUE_CANONICAL_TEXT_ID,
  DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  DEAL_VALUE_INTERVAL,
  GOVERNED_REASON,
  NON_COMPARABLE_REASON,
  REVIEW_VERSION,
  DEFAULT_DEAL_DIMENSIONS,
  buildQxoMaterialContractsSlice,
  validateQxoMaterialContractsSlice,
};
