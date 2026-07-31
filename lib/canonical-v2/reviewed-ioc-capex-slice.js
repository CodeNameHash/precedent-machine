const { contentId, utf8ByteLength } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { moneyDenominatorPrecisionPolicyForClaim } = require('./contract-bundle');
const { normaliseMoneyRelativeToDealValue } = require('./observation-normalisers');
const { buildParserProposalEnvelope } = require('./parser-proposal-adapter');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const AGREEMENT_SOURCE_HASH = 'fa2c0a883c64001e792cbed7b03077cfc4fc31909ac7a1d9e63c0e67b2c233be';
const DEAL_VALUE_SOURCE_HASH = '60eb81f6a3091816da7f3390620266bfa60ce508e30ee9e61f1534626df479a3';
const REVIEW_VERSION = 'LANDOS_IOC_CAPEX/V1';
const DEAL_KEY = 'deal:landos-abbvie';
const TARGET_PARTY = Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' });
const REVIEWED_SECTION = Object.freeze({
  number: '5.2',
  title: "Operation of the Company's Business",
  proposal_id: 'ec3afbfd4535a7ed7b7ab1a1bb43216025ce9d5d7163412c05e3c022afc45567',
  f5_proposal_id: '3aa86c883673ae240bc98b7d8d1b5e07684351c66d94f91c3857b9e30f166db6',
});
const CAPEX_TEXT = '(viii) make or authorize aggregate capital expenditures in excess of $100,000, which expenditures shall be in\naccordance with the categories set forth in such budget;';
const GENERAL_EXCEPTION_START = '(b) During the Pre-Closing Period, except (w) as expressly required or contemplated';
const GENERAL_EXCEPTION_END = 'neither Company nor any Company Subsidiary shall:';
const DEAL_VALUE_TEXT = 'representing a total transaction value of approximately $137.5 million at the closing';

function uniqueIndex(text, needle, label, from = 0) {
  const start = text.indexOf(needle, from);
  if (start < 0) throw new TypeError(`reviewed ${label} was not found`);
  if (text.indexOf(needle, start + 1) >= 0) throw new TypeError(`reviewed ${label} is ambiguous`);
  return start;
}

function spanWithinSection(source, section, startText, endText, label) {
  const sectionText = section.evidence_anchor.exact_text;
  const start = uniqueIndex(sectionText, startText, `${label} start`);
  const endStart = uniqueIndex(sectionText, endText, `${label} end`, start);
  const end = endStart + endText.length;
  return buildSemanticSpan(
    source,
    section.evidence_anchor.absolute_start + utf8ByteLength(sectionText.slice(0, start)),
    section.evidence_anchor.absolute_start + utf8ByteLength(sectionText.slice(0, end)),
  );
}

function childSpan(source, parentSpan, needle, label) {
  const parentText = Buffer.from(source.canonical_text.text, 'utf8')
    .subarray(parentSpan.absolute_start, parentSpan.absolute_end)
    .toString('utf8');
  const start = uniqueIndex(parentText, needle, label);
  return buildSemanticSpan(
    source,
    parentSpan.absolute_start + utf8ByteLength(parentText.slice(0, start)),
    parentSpan.absolute_start + utf8ByteLength(parentText.slice(0, start + needle.length)),
  );
}

function evidence(excerpt, evidenceRole, documentOrdinal) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: documentOrdinal,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function buildReviewedIocCapexSlice({
  agreementText,
  dealValueSourceText,
  contractBundle,
  corpusReleaseId,
} = {}) {
  if (typeof agreementText !== 'string' || !agreementText.length) throw new TypeError('agreementText is required');
  if (typeof dealValueSourceText !== 'string' || !dealValueSourceText.length) throw new TypeError('dealValueSourceText is required');
  if (!contractBundle || !contractBundle.fingerprint) throw new TypeError('contractBundle is required');

  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'landos-abbvie');
  const agreementSource = buildImmutableSource({
    sourceBytes: agreementText,
    sourceOccurrenceKey: 'landos-abbvie-merger-agreement',
  });
  const dealValueSource = buildImmutableSource({
    sourceBytes: dealValueSourceText,
    sourceKind: 'SEC_FILING_EXCERPT_UTF8',
    sourceOccurrenceKey: 'sec:1785345:000119312524077190:d787351ddefa14a.htm',
  });
  if (agreementSource.document_hash !== AGREEMENT_SOURCE_HASH) throw new TypeError('Landos agreement source hash mismatch');
  if (dealValueSource.document_hash !== DEAL_VALUE_SOURCE_HASH) throw new TypeError('Landos deal-value source hash mismatch');

  const agreementAdmission = buildFixtureSourceAdmission({
    source: agreementSource,
    dealKey: DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
    sourceOrdinal: 0,
  });
  const dealValueAdmission = buildFixtureSourceAdmission({
    source: dealValueSource,
    dealKey: DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
    sourceOrdinal: 1,
  });
  const proposalEnvelope = buildParserProposalEnvelope({
    contract_bundle: contractBundle,
    source: agreementSource,
    source_admission: agreementAdmission,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
  });
  const matches = proposalEnvelope.section_proposals.filter(
    (row) => row.section_number === REVIEWED_SECTION.number,
  );
  if (matches.length !== 1) throw new TypeError('reviewed Section 5.2 is missing or ambiguous');
  const section = matches[0];
  const governedPrecision = Boolean(moneyDenominatorPrecisionPolicyForClaim(
    contractBundle,
    'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  ));
  if (section.section_title !== REVIEWED_SECTION.title
    || section.structural_section_proposal_id !== (
      governedPrecision ? REVIEWED_SECTION.f5_proposal_id : REVIEWED_SECTION.proposal_id
    )) {
    throw new TypeError('reviewed Section 5.2 proposal has drifted');
  }

  const capexSpan = spanWithinSection(agreementSource, section, CAPEX_TEXT, CAPEX_TEXT, 'capex covenant');
  const generalExceptionSpan = spanWithinSection(
    agreementSource,
    section,
    GENERAL_EXCEPTION_START,
    GENERAL_EXCEPTION_END,
    'general exception chapeau',
  );
  const thresholdSpan = childSpan(agreementSource, capexSpan, '$100,000', 'capex threshold');
  const dealValueSpan = childSpan(dealValueSource, buildSemanticSpan(
    dealValueSource,
    0,
    dealValueSource.source_byte_length,
  ), DEAL_VALUE_TEXT, 'deal-value denominator');
  const excerpts = {
    capex: buildExcerpt({ source: agreementSource, span: capexSpan }),
    general_exception: buildExcerpt({ source: agreementSource, span: generalExceptionSpan }),
    threshold: buildExcerpt({ source: agreementSource, span: thresholdSpan }),
    deal_value: buildExcerpt({ source: dealValueSource, span: dealValueSpan }),
  };

  const capexProvision = buildProvisionInstance({
    source: agreementSource,
    span: capexSpan,
    conceptKey: 'IOC-CAPEX',
    party: TARGET_PARTY,
    ordinal: 1,
  });
  const exceptionProvision = buildProvisionInstance({
    source: agreementSource,
    span: generalExceptionSpan,
    conceptKey: 'IOC-GENERAL-EXCEPT',
    party: TARGET_PARTY,
    ordinal: 1,
  });
  const capexComponent = buildProvisionComponent({
    source: agreementSource,
    parentProvision: capexProvision,
    span: capexSpan,
    componentKey: 'COVENANT_LIMB',
    ordinal: 1,
  });
  const exceptionComponent = buildProvisionComponent({
    source: agreementSource,
    parentProvision: exceptionProvision,
    span: generalExceptionSpan,
    componentKey: 'EXCEPTION_LIMB',
    ordinal: 1,
  });

  const denominatorPrecisionPolicy = moneyDenominatorPrecisionPolicyForClaim(
    contractBundle,
    'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  );
  const normalised = normaliseMoneyRelativeToDealValue({
    rawAmount: '100000',
    currency: 'USD',
    denominator: {
      value: '137500000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [excerpts.deal_value.excerpt_id],
      ...(denominatorPrecisionPolicy ? { precision: 'APPROXIMATE' } : {}),
    },
    derivationVersion: REVIEW_VERSION,
  });
  const requiredEvidenceIds = [excerpts.threshold.excerpt_id, excerpts.deal_value.excerpt_id].sort();
  const thresholdClaim = buildClaimRevision({
    subject_occurrence_id: capexComponent.provision_component_id,
    claim_definition_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    state: 'PRESENT',
    raw_value: '$100,000',
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    denominator: normalised.denominator,
    attributes: {
      basis_key: normalised.basis_key,
      raw_amount: normalised.raw_value.amount,
      raw_currency: normalised.raw_value.currency,
      ...(denominatorPrecisionPolicy ? { denominator_precision: 'APPROXIMATE' } : {}),
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: [
      'basis_key',
      'raw_amount',
      'raw_currency',
      ...(denominatorPrecisionPolicy ? ['denominator_precision'] : []),
      'normalisation_payload_digest',
    ],
    evidence: [
      evidence(excerpts.threshold, 'OPERATIVE_TEXT', 0),
      evidence(excerpts.deal_value, 'DERIVATION_INPUT', 1),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', requiredEvidenceIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: requiredEvidenceIds,
      examined_interval_ids: requiredEvidenceIds,
    },
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  if (
    denominatorPrecisionPolicy
    && (
      thresholdClaim.denominator.precision !== 'APPROXIMATE'
      || thresholdClaim.attributes.denominator_precision !== 'APPROXIMATE'
    )
  ) {
    throw new TypeError(
      'reviewed IOC denominator precision does not match the governed policy',
    );
  }
  const relationshipEvidenceIds = [excerpts.capex.excerpt_id, excerpts.general_exception.excerpt_id].sort();
  const exceptionRelationship = buildRelationshipRevision({
    source_occurrence_id: capexComponent.provision_component_id,
    relationship_definition_key: 'EXCEPTED_BY',
    state: 'PRESENT',
    raw_scope: excerpts.general_exception.exact_text,
    target_occurrence_ids: [exceptionComponent.provision_component_id],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE',
      restriction_period: 'PRE_CLOSING_PERIOD',
      obligors: ['COMPANY', 'COMPANY_SUBSIDIARIES'],
      exceptions: [
        'REQUIRED_OR_CONTEMPLATED_BY_AGREEMENT_OR_LAW',
        'PARENT_WRITTEN_CONSENT',
        'COMPANY_DISCLOSURE_SCHEDULE',
      ],
      consent_standard: 'NOT_UNREASONABLY_WITHHELD_CONDITIONED_OR_DELAYED',
    },
    evidence: [
      evidence(excerpts.capex, 'DERIVATION_INPUT', 0),
      evidence(excerpts.general_exception, 'EXCEPTION', 0),
    ],
    scope: {
      scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', relationshipEvidenceIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: relationshipEvidenceIds,
      examined_interval_ids: relationshipEvidenceIds,
      target_interval_ids: [excerpts.general_exception.excerpt_id],
    },
    resolver_version: REVIEW_VERSION,
  });

  const provisions = [capexProvision, exceptionProvision];
  const components = [capexComponent, exceptionComponent];
  const semanticClosureId = contentId('SEMANTIC_CLOSURE/V1', {
    review_version: REVIEW_VERSION,
    source_admission_manifest_ids: [
      agreementAdmission.source_admission_manifest_id,
      dealValueAdmission.source_admission_manifest_id,
    ].sort(),
    provision_instance_ids: provisions.map((row) => row.provision_instance_id).sort(),
    provision_component_ids: components.map((row) => row.provision_component_id).sort(),
  });
  const deal = {
    deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    document_hash: agreementSource.document_hash,
    dimensions: {
      sector: 'Biopharma',
      buyer: 'AbbVie',
      merger_form: 'Reverse triangular merger',
      adviser_firms: [],
      lawyers: [],
      announce_year: 2024,
      deal_value_usd: '137500000',
    },
  };
  const canonicalWriteSet = {
    sources: [agreementSource, dealValueSource],
    source_admissions: [agreementAdmission, dealValueAdmission],
    deal,
    excerpts: Object.values(excerpts).map((row) => ({ ...row, closure_id: semanticClosureId })),
    provisions: provisions.map((row) => ({ ...row, closure_id: semanticClosureId })),
    components: components.map((row) => ({ ...row, closure_id: semanticClosureId })),
    claims: [{ ...thresholdClaim, closure_id: semanticClosureId }],
    relationships: [{ ...exceptionRelationship, closure_id: semanticClosureId }],
  };

  const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
    claim_revision_id: thresholdClaim.claim_revision_id,
    relationship_revision_ids: [exceptionRelationship.relationship_revision_id],
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: dealAdmissionId,
    result_key: 'TARGET_CAPEX_RESTRICTION',
    result_version: 1,
    concept_key: 'IOC-CAPEX',
    party: TARGET_PARTY,
    value_slot_key: 'CAPEX_THRESHOLD',
    ordinal: 0,
    claim: thresholdClaim,
    relationships: [exceptionRelationship],
    composition_scope_closure_id: compositionScopeClosureId,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const releaseId = corpusReleaseId || contentId('CORPUS_RELEASE/V1', 'landos-reviewed-fixture');
  const projection = projectMarketMetricSlot({
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: releaseId,
    deal,
    concept_key: 'IOC-CAPEX',
    metric_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    party: TARGET_PARTY,
    result,
    claim: thresholdClaim,
    relationships: [exceptionRelationship],
    value_slot_key: 'CAPEX_THRESHOLD',
    ordinal: 0,
  });

  const reviewedMapping = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: agreementSource.document_hash,
    structural_section_proposal_ids: [section.structural_section_proposal_id],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((row) => row.excerpt_id).sort(),
    canonical_object_ids: [
      ...provisions.map((row) => row.provision_instance_id),
      ...components.map((row) => row.provision_component_id),
      thresholdClaim.claim_revision_id,
      exceptionRelationship.relationship_revision_id,
    ].sort(),
  };
  return Object.freeze({
    reviewed_mapping: Object.freeze({
      ...reviewedMapping,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMapping),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMapping),
    }),
    agreementSource,
    dealValueSource,
    agreementAdmission,
    dealValueAdmission,
    proposalEnvelope,
    section,
    spans: Object.freeze({ capexSpan, generalExceptionSpan, thresholdSpan, dealValueSpan }),
    excerpts: Object.freeze(excerpts),
    provisions: Object.freeze(provisions),
    components: Object.freeze(components),
    capexComponent,
    exceptionComponent,
    thresholdClaim,
    exceptionRelationship,
    normalised,
    canonicalWriteSet,
    result,
    projection,
  });
}

function buildReviewedIocCapexServingRow({ slice, contractBundle } = {}) {
  if (!slice?.projection?.observation) throw new TypeError('a comparable reviewed IOC capex slice is required');
  const observation = slice.projection.observation;
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture');
  const request = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: observation.corpus_release_id,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: observation.metric_key,
    metric_version: observation.metric_version,
    concept_key: observation.concept_key,
    party: observation.party,
    subject_deal_key: observation.deal_key,
    filters: {},
  };
  const compiled = compileMarketCohortRequest(request);
  const cohortResult = {
    schema_version: 'MARKET_COHORT_RESULT/V1',
    serving_namespace_id: compiled.serving_namespace_id,
    corpus_release_id: compiled.corpus_release_id,
    contract_fingerprint: compiled.contract_fingerprint,
    cohort_digest: compiled.cohort_digest,
    metric_key: compiled.metric_key,
    metric_version: compiled.metric_version,
    concept_key: compiled.concept_key,
    subject_deal_key: compiled.subject_deal_key,
    counts: {
      eligible_deals: 1,
      applicable_deals: 1,
      examined_deals: 1,
      present_deals: 1,
      comparable_deals: 1,
      distribution_deals: 1,
      excluded_deals: 0,
      observation_slots: 1,
      excluded_slots: 0,
    },
    distribution: [{ canonical_value: observation.canonical_value, subject_count: 1, deal_count: 1 }],
    exclusions: [],
  };
  return buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
      contract_fingerprint: contractBundle.fingerprint,
    }),
    projection_output: slice.projection,
    cohort_request: request,
    cohort_result: cohortResult,
    result_ordinal: 0,
  });
}

module.exports = {
  buildReviewedIocCapexServingRow,
  buildReviewedIocCapexSlice,
};
