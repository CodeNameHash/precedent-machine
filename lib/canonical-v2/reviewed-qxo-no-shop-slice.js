const { contentId, utf8ByteLength } = require('./canonical-bytes');
const { buildClaimRevision } = require('./claims-relationships');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { normaliseDurationToDays } = require('./observation-normalisers');
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

const REVIEWED_SOURCE_HASH = '5a0a3df49f22a610f1fcca609b55bfa3fcb543d26dd3cbfde04670b29ced6e72';
const REVIEW_VERSION = 'QXO_NO_SHOP_NOTICE/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const TARGET_PARTY = Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' });
const BUYER_PARTY = Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' });
const NOTICE_TEXT = 'The Company shall promptly (and in no event later than twenty-four (24) hours after receipt)';
const MATCH_TEXT = "provided, however, that, prior to making such Company Adverse Recommendation Change";

function uniqueIndex(text, needle, label) {
  const start = text.indexOf(needle);
  if (start < 0 || text.indexOf(needle, start + 1) >= 0) throw new TypeError(`reviewed ${label} is missing or ambiguous`);
  return start;
}

function governedIndex(text, needle, governedOrdinal, expectedCount, label) {
  const starts = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf(needle, cursor);
    if (start < 0) break;
    starts.push(start);
    cursor = start + needle.length;
  }
  if (starts.length !== expectedCount || !starts[governedOrdinal]) {
    throw new TypeError(`reviewed ${label} occurrence set has drifted`);
  }
  return starts[governedOrdinal];
}

function span(source, start, end) {
  return buildSemanticSpan(source, utf8ByteLength(source.canonical_text.text.slice(0, start)), utf8ByteLength(source.canonical_text.text.slice(0, end)));
}

function evidence(excerpt) {
  return {
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function completeScope(excerpt, subject) {
  return {
    scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', { subject, excerpt_id: excerpt.excerpt_id }),
    coverage_status: 'COMPLETE',
    required_interval_ids: [excerpt.excerpt_id],
    examined_interval_ids: [excerpt.excerpt_id],
  };
}

function durationClaim({ component, excerpt, definitionKey, rawMagnitude, rawUnit, dayBasis, trigger }) {
  const normalised = normaliseDurationToDays({
    rawMagnitude,
    rawUnit,
    dayBasis,
    trigger,
    derivationVersion: REVIEW_VERSION,
  });
  return buildClaimRevision({
    subject_occurrence_id: component.provision_component_id,
    claim_definition_key: definitionKey,
    state: 'PRESENT',
    raw_value: excerpt.exact_text,
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    day_basis: normalised.day_basis,
    attributes: {
      basis_key: normalised.basis_key,
      trigger: normalised.trigger,
      raw_magnitude: normalised.raw_value.magnitude,
      raw_unit: normalised.raw_value.unit,
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: ['basis_key', 'trigger', 'raw_magnitude', 'raw_unit', 'normalisation_payload_digest'],
    evidence: [evidence(excerpt)],
    scope: completeScope(excerpt, component.provision_component_id),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
}

function buildQxoNoShopNoticeSlice({ sourceText, contractBundle, corpusReleaseId } = {}) {
  if (typeof sourceText !== 'string' || !sourceText.length) throw new TypeError('sourceText is required');
  if (!contractBundle?.fingerprint) throw new TypeError('contractBundle is required');
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceKind: 'REVIEWED_MERGER_AGREEMENT_EXCERPT',
    sourceOccurrenceKey: 'qxo-topbuild-no-shop-reviewed-excerpts',
  });
  if (source.document_hash !== REVIEWED_SOURCE_HASH) throw new TypeError('QXO reviewed no-shop source hash mismatch');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'qxo-topbuild-reviewed-excerpts');
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });

  const separator = sourceText.indexOf('\n\n');
  if (separator < 1 || sourceText.indexOf('\n\n', separator + 2) >= 0) {
    throw new TypeError('QXO reviewed no-shop source must contain exactly two ordered clauses');
  }
  if (!sourceText.startsWith(NOTICE_TEXT) || !sourceText.slice(separator + 2).startsWith(MATCH_TEXT)) {
    throw new TypeError('QXO reviewed no-shop clause order has drifted');
  }
  const noticeClauseSpan = span(source, 0, separator);
  const matchStart = separator + 2;
  const matchEnd = sourceText.endsWith('\n') ? sourceText.length - 1 : sourceText.length;
  const matchClauseSpan = span(source, matchStart, matchEnd);
  const noticeClockText = 'twenty-four (24) hours after receipt';
  const matchClockText = "four (4) business days' prior written notice";
  const noticeClockStart = governedIndex(sourceText, noticeClockText, 0, 2, 'notice clock');
  const matchClockStart = uniqueIndex(sourceText, matchClockText, 'match clock');
  const noticeClockSpan = span(source, noticeClockStart, noticeClockStart + noticeClockText.length);
  const matchClockSpan = span(source, matchClockStart, matchClockStart + matchClockText.length);
  const excerpts = Object.freeze({
    notice_clause: buildExcerpt({ source, span: noticeClauseSpan }),
    match_clause: buildExcerpt({ source, span: matchClauseSpan }),
    notice_clock: buildExcerpt({ source, span: noticeClockSpan }),
    match_clock: buildExcerpt({ source, span: matchClockSpan }),
  });

  const noticeProvision = buildProvisionInstance({
    source, span: noticeClauseSpan, conceptKey: 'NOSOL-NOTICE', party: TARGET_PARTY, ordinal: 1,
  });
  const matchProvision = buildProvisionInstance({
    source, span: matchClauseSpan, conceptKey: 'NOSOL-MATCH', party: BUYER_PARTY, ordinal: 1,
  });
  const noticeComponent = buildProvisionComponent({
    source, parentProvision: noticeProvision, span: noticeClauseSpan, componentKey: 'NOTICE_LIMB', ordinal: 1,
  });
  const matchComponent = buildProvisionComponent({
    source, parentProvision: matchProvision, span: matchClauseSpan, componentKey: 'MATCH_PERIOD_LIMB', ordinal: 1,
  });
  const noticeClaim = durationClaim({
    component: noticeComponent,
    excerpt: excerpts.notice_clock,
    definitionKey: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
  });
  const matchClaim = durationClaim({
    component: matchComponent,
    excerpt: excerpts.match_clock,
    definitionKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    rawMagnitude: '4',
    rawUnit: 'DAYS',
    dayBasis: 'BUSINESS',
    trigger: 'SUPERIOR_PROPOSAL_NOTICE',
  });
  const semanticClosureId = contentId('SEMANTIC_CLOSURE/V1', {
    review_version: REVIEW_VERSION,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    provision_instance_ids: [noticeProvision.provision_instance_id, matchProvision.provision_instance_id].sort(),
  });
  const deal = {
    deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    document_hash: source.document_hash,
    dimensions: {
      sector: 'Building products',
      buyer: 'QXO',
      merger_form: 'Reverse triangular merger',
      adviser_firms: ['Paul Weiss', 'Jones Day'],
      lawyers: ['Scott Barshay', 'Robert Profusek'],
      announce_year: 2026,
      deal_value_usd: null,
    },
  };
  const canonicalWriteSet = {
    source,
    source_admission: sourceAdmission,
    deal,
    excerpts: Object.values(excerpts).map((row) => ({ ...row, closure_id: semanticClosureId })),
    provisions: [noticeProvision, matchProvision].map((row) => ({ ...row, closure_id: semanticClosureId })),
    components: [noticeComponent, matchComponent].map((row) => ({ ...row, closure_id: semanticClosureId })),
    claims: [noticeClaim, matchClaim].map((row) => ({ ...row, closure_id: semanticClosureId })),
    relationships: [],
  };
  const specs = [
    {
      claim: noticeClaim,
      component: noticeComponent,
      result_key: 'TARGET_NO_SHOP_NOTICE',
      concept_key: 'NOSOL-NOTICE',
      metric_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      party: TARGET_PARTY,
      value_slot_key: 'NOTICE_PERIOD',
      excerpt: excerpts.notice_clock,
    },
    {
      claim: matchClaim,
      component: matchComponent,
      result_key: 'BUYER_INITIAL_MATCH_RIGHT',
      concept_key: 'NOSOL-MATCH',
      metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      party: BUYER_PARTY,
      value_slot_key: 'INITIAL_MATCH_PERIOD',
      excerpt: excerpts.match_clock,
    },
  ];
  const releaseId = corpusReleaseId || contentId('CORPUS_RELEASE/V1', 'qxo-reviewed-notice-fixture');
  const results = specs.map((spec) => {
    const result = buildFixtureResultComponent({
      deal_admission_id: dealAdmissionId,
      result_key: spec.result_key,
      result_version: 1,
      concept_key: spec.concept_key,
      party: spec.party,
      value_slot_key: spec.value_slot_key,
      ordinal: 0,
      claim: spec.claim,
      relationships: [],
      composition_scope_closure_id: contentId('COMPOSITION_SCOPE_CLOSURE/V1', spec.claim.claim_revision_id),
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    });
    const projection = projectMarketMetricSlot({
      contract_bundle: contractBundle,
      release_state: 'CANDIDATE_CERTIFIED',
      corpus_release_id: releaseId,
      deal,
      concept_key: spec.concept_key,
      metric_key: spec.metric_key,
      party: spec.party,
      result,
      claim: spec.claim,
      relationships: [],
      value_slot_key: spec.value_slot_key,
      ordinal: 0,
    });
    return Object.freeze({ ...spec, result, projection });
  });
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: source.document_hash,
    governed_evidence_excerpt_ids: [excerpts.notice_clock.excerpt_id, excerpts.match_clock.excerpt_id].sort(),
    canonical_object_ids: [
      noticeProvision.provision_instance_id,
      matchProvision.provision_instance_id,
      noticeComponent.provision_component_id,
      matchComponent.provision_component_id,
      noticeClaim.claim_revision_id,
      matchClaim.claim_revision_id,
    ].sort(),
  };
  return Object.freeze({
    source,
    sourceAdmission,
    excerpts,
    provisions: Object.freeze([noticeProvision, matchProvision]),
    components: Object.freeze([noticeComponent, matchComponent]),
    claims: Object.freeze([noticeClaim, matchClaim]),
    canonicalWriteSet,
    results: Object.freeze(results),
    reviewed_mapping: Object.freeze({
      ...reviewedMappingBody,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
    }),
  });
}

function buildQxoNoShopServingRows({ slice, contractBundle, servingNamespaceId } = {}) {
  const frozenPairId = contentId('FROZEN_PAIR/V1', {
    reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  return Object.freeze(slice.results.map((item) => {
    const observation = item.projection.observation;
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
      frozen_pair_id: frozenPairId,
      projection_output: item.projection,
      cohort_request: request,
      cohort_result: cohortResult,
      result_ordinal: 0,
    });
  }));
}

module.exports = {
  DEAL_KEY,
  REVIEWED_SOURCE_HASH,
  buildQxoNoShopNoticeSlice,
  buildQxoNoShopServingRows,
};
