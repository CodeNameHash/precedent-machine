const { contentId, utf8ByteLength } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const { compileMarketCohortRequest } = require('./market-cohort-query');
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

const REVIEWED_SOURCE_HASH = 'fa2c0a883c64001e792cbed7b03077cfc4fc31909ac7a1d9e63c0e67b2c233be';
const REVIEW_VERSION = 'LANDOS_CAPITALISATION_BRING_DOWN/V1';
const DEAL_KEY = 'deal:landos-abbvie';
const CONDITION_PARTY = Object.freeze({ role: 'CONDITION_BENEFICIARY', value: 'BUYER', capacity: 'ACQUIRER' });
const REPRESENTATION_PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });

const REVIEWED_SECTIONS = Object.freeze({
  '3.3': Object.freeze({
    title: 'Capitalization',
    proposal_id: 'feb8619ddb90882f9cefa760759aac9d0e551916dbfcbf4035b82b41f83512f3',
  }),
  '6.3': Object.freeze({
    title: 'Conditions to Obligations of Parent and Merger Sub to Effect the Closing',
    proposal_id: 'f36f821d568037e91919fe4b3e8b969e3bc3eaa874cfaf784ece1ba1a65eae6d',
  }),
});

const TEXT_SELECTORS = Object.freeze({
  rep_a: Object.freeze({
    section: '3.3',
    start: '(a) The authorized capital stock of the Company consists of',
    end: 'in respect of, any shares of Company Common Stock.',
  }),
  rep_c_first_sentence: Object.freeze({
    section: '3.3',
    start: '(c) As of the close of business on the Reference Date:',
    end: 'upon the exercise of outstanding Company Warrants.',
  }),
  condition_tier: Object.freeze({
    section: '6.3',
    start: '(a) (i) The representations and warranties of the Company set forth in Section 3.3(a)',
    end: '(except to the extent expressly made as of an earlier date, in which case as of such date);',
    stop_before: '(ii) the representations and warranties of the Company set forth in',
  }),
  accuracy_standard: Object.freeze({
    section: '6.3',
    start: 'true and correct except for de minimis inaccuracies',
    end: 'true and correct except for de minimis inaccuracies',
  }),
  accuracy_exception: Object.freeze({
    section: '6.3',
    start: 'except for de minimis inaccuracies',
    end: 'except for de minimis inaccuracies',
  }),
});

function uniqueIndex(text, needle, label, from = 0) {
  const start = text.indexOf(needle, from);
  if (start < 0) throw new TypeError(`reviewed ${label} start was not found`);
  if (text.indexOf(needle, start + 1) >= 0) throw new TypeError(`reviewed ${label} is ambiguous`);
  return start;
}

function selectExactSpan(source, sectionProposal, selector, label) {
  const sectionText = sectionProposal.evidence_anchor.exact_text;
  const startChar = uniqueIndex(sectionText, selector.start, `${label} selector`);
  const stopChar = selector.stop_before
    ? sectionText.indexOf(selector.stop_before, startChar + selector.start.length)
    : sectionText.length;
  if (stopChar < 0) throw new TypeError(`reviewed ${label} stop boundary was not found`);
  const endNeedleStart = sectionText.indexOf(selector.end, startChar);
  if (endNeedleStart < startChar || endNeedleStart >= stopChar) throw new TypeError(`reviewed ${label} end was not found`);
  const duplicateEnd = sectionText.indexOf(selector.end, endNeedleStart + 1);
  if (duplicateEnd >= 0 && duplicateEnd < stopChar) throw new TypeError(`reviewed ${label} end is ambiguous`);
  const endChar = endNeedleStart + selector.end.length;
  const absoluteStart = sectionProposal.evidence_anchor.absolute_start + utf8ByteLength(sectionText.slice(0, startChar));
  const absoluteEnd = sectionProposal.evidence_anchor.absolute_start + utf8ByteLength(sectionText.slice(0, endChar));
  return buildSemanticSpan(source, absoluteStart, absoluteEnd);
}

function evidence(excerpt, evidenceRole) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function reviewedSection(envelope, sectionNumber) {
  const expected = REVIEWED_SECTIONS[sectionNumber];
  const matches = envelope.section_proposals.filter((row) => row.section_number === sectionNumber);
  if (matches.length !== 1) throw new TypeError(`reviewed Section ${sectionNumber} is missing or ambiguous`);
  const section = matches[0];
  if (section.section_title !== expected.title || section.structural_section_proposal_id !== expected.proposal_id) {
    throw new TypeError(`reviewed Section ${sectionNumber} proposal has drifted`);
  }
  return section;
}

function buildReviewedCapitalisationSlice({ sourceText, contractBundle, corpusReleaseId } = {}) {
  if (typeof sourceText !== 'string' || !sourceText.length) throw new TypeError('sourceText is required');
  if (!contractBundle || !contractBundle.fingerprint) throw new TypeError('contractBundle is required');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'landos-abbvie');
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'landos-abbvie-merger-agreement',
  });
  if (source.document_hash !== REVIEWED_SOURCE_HASH) {
    throw new TypeError('Landos reviewed source hash mismatch');
  }
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });
  const proposalEnvelope = buildParserProposalEnvelope({
    contract_bundle: contractBundle,
    source,
    source_admission: sourceAdmission,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
  });
  const section33 = reviewedSection(proposalEnvelope, '3.3');
  const section63 = reviewedSection(proposalEnvelope, '6.3');
  const sections = { '3.3': section33, '6.3': section63 };
  const spans = Object.fromEntries(Object.entries(TEXT_SELECTORS).map(([key, selector]) => [
    key,
    selectExactSpan(source, sections[selector.section], selector, key),
  ]));

  const excerpts = Object.fromEntries(Object.entries(spans).map(([key, span]) => [
    key,
    buildExcerpt({ source, span }),
  ]));
  const representationProvision = buildProvisionInstance({
    source,
    span: buildSemanticSpan(source, section33.evidence_anchor.absolute_start, section33.evidence_anchor.absolute_end),
    conceptKey: 'REP-T-CAP',
    party: REPRESENTATION_PARTY,
    ordinal: 1,
  });
  const conditionProvision = buildProvisionInstance({
    source,
    span: spans.condition_tier,
    conceptKey: 'COND-B-REP',
    party: CONDITION_PARTY,
    ordinal: 1,
  });
  const representationComponents = [
    buildProvisionComponent({
      source,
      parentProvision: representationProvision,
      span: spans.rep_a,
      componentKey: 'REPRESENTATION_LIMB',
      ordinal: 1,
    }),
    buildProvisionComponent({
      source,
      parentProvision: representationProvision,
      span: spans.rep_c_first_sentence,
      componentKey: 'REPRESENTATION_LIMB',
      ordinal: 2,
    }),
  ];
  const repScopeIntervalIds = [excerpts.rep_a.excerpt_id, excerpts.rep_c_first_sentence.excerpt_id].sort();
  const knowledgeClaims = representationComponents.map((component, index) => {
    const excerpt = index === 0 ? excerpts.rep_a : excerpts.rep_c_first_sentence;
    return buildClaimRevision({
      subject_occurrence_id: component.provision_component_id,
      claim_definition_key: 'KNOWLEDGE_QUALIFIER',
      state: 'ABSENT',
      scope: {
        scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
          review_version: REVIEW_VERSION,
          governed_component_id: component.provision_component_id,
          governed_interval_id: excerpt.excerpt_id,
        }),
        coverage_status: 'COMPLETE',
        required_interval_ids: [excerpt.excerpt_id],
        examined_interval_ids: [excerpt.excerpt_id],
      },
      extraction_version: REVIEW_VERSION,
      normalisation_version: REVIEW_VERSION,
      derivation_version: REVIEW_VERSION,
    });
  });
  const accuracyEvidence = evidence(excerpts.accuracy_standard, 'OPERATIVE_TEXT');
  const accuracyClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: excerpts.accuracy_standard.exact_text,
    canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS' },
    codebooks: { accuracy_standard: ['MAT_ALL_RESPECTS_DE_MINIMIS'] },
    evidence: [accuracyEvidence],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', accuracyEvidence.excerpt_id),
      coverage_status: 'COMPLETE',
      required_interval_ids: [accuracyEvidence.excerpt_id],
      examined_interval_ids: [accuracyEvidence.excerpt_id],
    },
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const exceptionEvidence = evidence(excerpts.accuracy_exception, 'EXCEPTION');
  const exceptionClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
    state: 'PRESENT',
    raw_value: excerpts.accuracy_exception.exact_text,
    canonical_value: 'DE_MINIMIS_INACCURACIES',
    taxonomy_codes: { accuracy_exception: 'DE_MINIMIS_INACCURACIES' },
    codebooks: { accuracy_exception: ['DE_MINIMIS_INACCURACIES'] },
    evidence: [exceptionEvidence],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const relationship = buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'BRINGS_DOWN',
    state: 'PRESENT',
    raw_scope: excerpts.condition_tier.exact_text,
    target_occurrence_ids: representationComponents.map((row) => row.provision_component_id),
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING',
      accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      exception: 'DE_MINIMIS_INACCURACIES',
      time_points: ['SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE'],
    },
    evidence: [
      evidence(excerpts.rep_a, 'DERIVATION_INPUT'),
      evidence(excerpts.rep_c_first_sentence, 'DERIVATION_INPUT'),
      evidence(excerpts.condition_tier, 'CROSS_REFERENCE'),
    ],
    scope: {
      scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', {
        condition: excerpts.condition_tier.excerpt_id,
        target_limbs: repScopeIntervalIds,
      }),
      coverage_status: 'COMPLETE',
      required_interval_ids: [excerpts.condition_tier.excerpt_id, ...repScopeIntervalIds].sort(),
      examined_interval_ids: [excerpts.condition_tier.excerpt_id, ...repScopeIntervalIds].sort(),
      target_interval_ids: repScopeIntervalIds,
    },
    resolver_version: REVIEW_VERSION,
  });
  const semanticClosureId = contentId('SEMANTIC_CLOSURE/V1', {
    review_version: REVIEW_VERSION,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    provision_instance_ids: [conditionProvision.provision_instance_id, representationProvision.provision_instance_id].sort(),
    provision_component_ids: representationComponents.map((row) => row.provision_component_id).sort(),
  });
  const deal = {
    deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    document_hash: source.document_hash,
    dimensions: {
      sector: 'Biopharma',
      buyer: 'AbbVie',
      merger_form: 'Reverse triangular merger',
      adviser_firms: [],
      lawyers: [],
      announce_year: 2024,
      deal_value_usd: null,
    },
  };
  const canonicalWriteSet = {
    source,
    source_admission: sourceAdmission,
    deal,
    excerpts: Object.values(excerpts).map((row) => ({ ...row, closure_id: semanticClosureId })),
    provisions: [conditionProvision, representationProvision].map((row) => ({ ...row, closure_id: semanticClosureId })),
    components: representationComponents.map((row) => ({ ...row, closure_id: semanticClosureId })),
    claims: [accuracyClaim, exceptionClaim, ...knowledgeClaims].map((row) => ({ ...row, closure_id: semanticClosureId })),
    relationships: [{ ...relationship, closure_id: semanticClosureId }],
  };
  const result = buildFixtureResultComponent({
    deal_admission_id: dealAdmissionId,
    result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
    result_version: 1,
    concept_key: 'COND-B-REP',
    party: CONDITION_PARTY,
    value_slot_key: 'ACCURACY_TIER_A',
    ordinal: 0,
    claim: accuracyClaim,
    relationships: [relationship],
    composition_scope_closure_id: relationship.scope.scope_closure_id,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const releaseId = corpusReleaseId || contentId('CORPUS_RELEASE/V1', 'landos-reviewed-fixture');
  const projection = projectMarketMetricSlot({
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: releaseId,
    deal,
    concept_key: 'COND-B-REP',
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    party: CONDITION_PARTY,
    result,
    claim: accuracyClaim,
    relationships: [relationship],
    value_slot_key: 'ACCURACY_TIER_A',
    ordinal: 0,
  });
  const reviewedMapping = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: source.document_hash,
    structural_section_proposal_ids: [
      section33.structural_section_proposal_id,
      section63.structural_section_proposal_id,
    ],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((row) => row.excerpt_id).sort(),
    canonical_object_ids: [
      conditionProvision.provision_instance_id,
      representationProvision.provision_instance_id,
      ...representationComponents.map((row) => row.provision_component_id),
      accuracyClaim.claim_revision_id,
      exceptionClaim.claim_revision_id,
      ...knowledgeClaims.map((row) => row.claim_revision_id),
      relationship.relationship_revision_id,
    ].sort(),
  };
  return Object.freeze({
    reviewed_mapping: Object.freeze({
      ...reviewedMapping,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMapping),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMapping),
    }),
    source,
    sourceAdmission,
    proposalEnvelope,
    spans: Object.freeze(spans),
    excerpts: Object.freeze(excerpts),
    conditionProvision,
    representationProvision,
    representationComponents: Object.freeze(representationComponents),
    accuracyClaim,
    exceptionClaim,
    knowledgeClaims: Object.freeze(knowledgeClaims),
    relationship,
    canonicalWriteSet,
    result,
    projection,
  });
}

function buildReviewedCapitalisationServingRow({ slice, contractBundle } = {}) {
  if (!slice || !slice.projection || !slice.projection.observation) throw new TypeError('a comparable reviewed slice is required');
  const observation = slice.projection.observation;
  const cohortRequest = {
    serving_namespace_id: contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture'),
    corpus_release_id: observation.corpus_release_id,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: observation.metric_key,
    metric_version: observation.metric_version,
    concept_key: observation.concept_key,
    party: observation.party,
    subject_deal_key: observation.deal_key,
    filters: {},
  };
  const compiled = compileMarketCohortRequest(cohortRequest);
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
  const row = buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
      corpus_release_id: observation.corpus_release_id,
    }),
    projection_output: slice.projection,
    cohort_request: cohortRequest,
    cohort_result: cohortResult,
  });
  return Object.freeze({ row, cohortRequest, cohortResult });
}

module.exports = {
  DEAL_KEY,
  REVIEWED_SOURCE_HASH,
  REVIEW_VERSION,
  buildReviewedCapitalisationServingRow,
  buildReviewedCapitalisationSlice,
};
