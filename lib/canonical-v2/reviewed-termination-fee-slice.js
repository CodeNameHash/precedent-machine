const { contentId, utf8ByteLength } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const { compileMarketCohortRequest } = require('./market-cohort-query');
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
const REVIEW_VERSION = 'LANDOS_SELLER_TERMINATION_FEE/V1';
const DEAL_KEY = 'deal:landos-abbvie';
const FEE_PARTY = Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
const SUPERIOR_PARTY = Object.freeze({ role: 'TERMINATION_RIGHT_HOLDER', value: 'COMPANY', capacity: 'TARGET' });
const RECOMMEND_PARTY = Object.freeze({ role: 'TERMINATION_RIGHT_HOLDER', value: 'PARENT', capacity: 'BUYER' });
const TAIL_PARTY = Object.freeze({ role: 'FEE_TRIGGER_BENEFICIARY', value: 'PARENT', capacity: 'BUYER' });
const REVIEWED_SECTIONS = Object.freeze({
  '7.1': Object.freeze({ title: 'Termination and Abandonment', proposal_id: '5f845b587b02b75a9b457d812bc332aa6c2cf0a38e2f1eb7e070e6640479d7e8' }),
  '7.3': Object.freeze({ title: 'Termination Fee', proposal_id: 'ee52984411a4fb7598d3cef0e99d369d3b89a14eec69b42b7f97a1d7cbee2338' }),
});
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
  const endStart = sectionText.indexOf(endText, start);
  if (endStart < start) throw new TypeError(`reviewed ${label} end was not found`);
  const duplicateEnd = sectionText.indexOf(endText, endStart + 1);
  if (duplicateEnd >= 0) throw new TypeError(`reviewed ${label} end is ambiguous`);
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

function reviewedSection(envelope, sectionNumber) {
  const expected = REVIEWED_SECTIONS[sectionNumber];
  const matches = envelope.section_proposals.filter((row) => row.section_number === sectionNumber);
  if (matches.length !== 1) throw new TypeError(`reviewed Section ${sectionNumber} is missing or ambiguous`);
  const section = matches[0];
  if (section.section_title !== expected.title
    || section.structural_section_proposal_id !== expected.proposal_id) {
    throw new TypeError(`reviewed Section ${sectionNumber} proposal has drifted`);
  }
  return section;
}

function triggerRelationship({ feeComponent, triggerComponent, feeExcerpt, triggerExcerpt, ordinal, effect }) {
  const requiredIds = [feeExcerpt.excerpt_id, triggerExcerpt.excerpt_id].sort();
  return buildRelationshipRevision({
    source_occurrence_id: feeComponent.provision_component_id,
    relationship_definition_key: 'TRIGGERED_BY',
    ordinal,
    state: 'PRESENT',
    raw_scope: triggerExcerpt.exact_text,
    target_occurrence_ids: [triggerComponent.provision_component_id],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      ...effect,
    },
    evidence: [
      evidence(feeExcerpt, 'DERIVATION_INPUT', 0),
      evidence(triggerExcerpt, 'CROSS_REFERENCE', 0),
    ],
    scope: {
      scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', requiredIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: requiredIds,
      examined_interval_ids: requiredIds,
      target_interval_ids: [triggerExcerpt.excerpt_id],
    },
    resolver_version: REVIEW_VERSION,
  });
}

function buildReviewedTerminationFeeSlice({
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
  const section71 = reviewedSection(proposalEnvelope, '7.1');
  const section73 = reviewedSection(proposalEnvelope, '7.3');

  const spans = {
    superior_trigger: spanWithinSection(
      agreementSource,
      section71,
      '(g) prior to the time the Required Company Stockholder Vote is obtained',
      'the Termination Fee specified in Section 7.3(a)(i); and',
      'Superior Proposal trigger',
    ),
    recommendation_trigger: spanWithinSection(
      agreementSource,
      section71,
      '(h) prior to the time the Required Company Stockholder Vote is obtained',
      'Company Board shall have effected a Change in Recommendation.',
      'Change in Recommendation trigger',
    ),
    tail_trigger: spanWithinSection(
      agreementSource,
      section73,
      '(iii) by either Parent or the Company pursuant to',
      'any Company Alternative Transaction is consummated,',
      'tail trigger',
    ),
    fee_payment: spanWithinSection(
      agreementSource,
      section73,
      'then, in each case, the Company shall pay',
      'pay the Termination Fee on more than one occasion.',
      'fee payment',
    ),
  };
  spans.fee_amount = childSpan(agreementSource, spans.fee_payment, '$7,000,000', 'fee amount');
  spans.deal_value = childSpan(
    dealValueSource,
    buildSemanticSpan(dealValueSource, 0, dealValueSource.source_byte_length),
    DEAL_VALUE_TEXT,
    'deal-value denominator',
  );
  const excerpts = Object.fromEntries(Object.entries(spans).map(([key, span]) => [
    key,
    buildExcerpt({ source: key === 'deal_value' ? dealValueSource : agreementSource, span }),
  ]));

  const feeProvision = buildProvisionInstance({
    source: agreementSource,
    span: buildSemanticSpan(
      agreementSource,
      section73.evidence_anchor.absolute_start,
      section73.evidence_anchor.absolute_end,
    ),
    conceptKey: 'TERMF-TARGET',
    party: FEE_PARTY,
    ordinal: 1,
  });
  const triggerSpecs = [
    ['superior_trigger', 'TERMR-SUPERIOR', SUPERIOR_PARTY],
    ['recommendation_trigger', 'TERMR-RECOMMEND', RECOMMEND_PARTY],
    ['tail_trigger', 'TERMF-TAIL', TAIL_PARTY],
  ];
  const triggerProvisions = triggerSpecs.map(([spanKey, conceptKey, party], index) => buildProvisionInstance({
    source: agreementSource,
    span: spans[spanKey],
    conceptKey,
    party,
    ordinal: index + 1,
  }));
  const feeComponent = buildProvisionComponent({
    source: agreementSource,
    parentProvision: feeProvision,
    span: spans.fee_payment,
    componentKey: 'FEE_AMOUNT_LIMB',
    ordinal: 1,
  });
  const triggerComponents = triggerProvisions.map((provision, index) => buildProvisionComponent({
    source: agreementSource,
    parentProvision: provision,
    span: spans[triggerSpecs[index][0]],
    componentKey: 'TERMINATION_TRIGGER_LIMB',
    ordinal: index + 1,
  }));

  const normalised = normaliseMoneyRelativeToDealValue({
    rawAmount: '7000000',
    currency: 'USD',
    denominator: {
      value: '137500000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [excerpts.deal_value.excerpt_id],
    },
    derivationVersion: REVIEW_VERSION,
  });
  const claimEvidenceIds = [excerpts.fee_amount.excerpt_id, excerpts.deal_value.excerpt_id].sort();
  const feeClaim = buildClaimRevision({
    subject_occurrence_id: feeComponent.provision_component_id,
    claim_definition_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    state: 'PRESENT',
    raw_value: '$7,000,000',
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    denominator: normalised.denominator,
    attributes: {
      basis_key: normalised.basis_key,
      raw_amount: normalised.raw_value.amount,
      raw_currency: normalised.raw_value.currency,
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: ['basis_key', 'raw_amount', 'raw_currency', 'normalisation_payload_digest'],
    evidence: [
      evidence(excerpts.fee_amount, 'OPERATIVE_TEXT', 0),
      evidence(excerpts.deal_value, 'DERIVATION_INPUT', 1),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', claimEvidenceIds),
      coverage_status: 'COMPLETE',
      required_interval_ids: claimEvidenceIds,
      examined_interval_ids: claimEvidenceIds,
    },
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const triggerEffects = [
    {
      trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION',
      terminating_party: 'COMPANY',
      payment_timing: 'CONCURRENT_WITH_TERMINATION',
      conditions: [],
    },
    {
      trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
      terminating_party: 'PARENT',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      conditions: [],
    },
    {
      trigger_code: 'ACQUISITION_PROPOSAL_TAIL',
      terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
      conditions: [
        'PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN',
        'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
        'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
      ],
    },
  ];
  const triggerRelationships = triggerComponents.map((component, index) => triggerRelationship({
    feeComponent,
    triggerComponent: component,
    feeExcerpt: excerpts.fee_payment,
    triggerExcerpt: excerpts[triggerSpecs[index][0]],
    ordinal: index,
    effect: triggerEffects[index],
  }));

  const provisions = [feeProvision, ...triggerProvisions];
  const components = [feeComponent, ...triggerComponents];
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
    claims: [{ ...feeClaim, closure_id: semanticClosureId }],
    relationships: triggerRelationships.map((row) => ({ ...row, closure_id: semanticClosureId })),
  };
  const relationshipRevisionIds = triggerRelationships.map((row) => row.relationship_revision_id).sort();
  const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
    claim_revision_id: feeClaim.claim_revision_id,
    relationship_revision_ids: relationshipRevisionIds,
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: dealAdmissionId,
    result_key: 'SELLER_TERMINATION_FEE',
    result_version: 1,
    concept_key: 'TERMF-TARGET',
    party: FEE_PARTY,
    value_slot_key: 'FEE_AMOUNT',
    ordinal: 0,
    claim: feeClaim,
    relationships: triggerRelationships,
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
    concept_key: 'TERMF-TARGET',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    party: FEE_PARTY,
    result,
    claim: feeClaim,
    relationships: triggerRelationships,
    value_slot_key: 'FEE_AMOUNT',
    ordinal: 0,
  });

  const reviewedMapping = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: agreementSource.document_hash,
    structural_section_proposal_ids: [
      section71.structural_section_proposal_id,
      section73.structural_section_proposal_id,
    ].sort(),
    governed_evidence_excerpt_ids: Object.values(excerpts).map((row) => row.excerpt_id).sort(),
    canonical_object_ids: [
      ...provisions.map((row) => row.provision_instance_id),
      ...components.map((row) => row.provision_component_id),
      feeClaim.claim_revision_id,
      ...relationshipRevisionIds,
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
    sections: Object.freeze({ '7.1': section71, '7.3': section73 }),
    spans: Object.freeze(spans),
    excerpts: Object.freeze(excerpts),
    provisions: Object.freeze(provisions),
    components: Object.freeze(components),
    feeComponent,
    triggerComponents: Object.freeze(triggerComponents),
    feeClaim,
    triggerRelationships: Object.freeze(triggerRelationships),
    normalised,
    canonicalWriteSet,
    result,
    projection,
  });
}

function buildReviewedTerminationFeeServingRow({ slice, contractBundle } = {}) {
  if (!slice?.projection?.observation) throw new TypeError('a comparable reviewed termination-fee slice is required');
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
  buildReviewedTerminationFeeServingRow,
  buildReviewedTerminationFeeSlice,
};
