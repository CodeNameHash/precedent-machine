const { contentId, utf8ByteLength } = require('../../lib/canonical-v2/canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('../../lib/canonical-v2/claims-relationships');
const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const { compileMarketCohortRequest } = require('../../lib/canonical-v2/market-cohort-query');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('../../lib/canonical-v2/serving-projection');
const { buildCanonicalResultServingRow } = require('../../lib/canonical-v2/shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('../../lib/canonical-v2/source-structure');

const id = (domain, value) => contentId(`${domain}/V1`, value);

function buildCompleteServingFixture({
  release = 'candidate-a',
  rawValue = 'in all material respects',
  counts = {},
} = {}) {
  const contract = compileFixtureContract();
  const sourceText = 'The representations are true in all material respects. At closing, this tier tests the Capitalization representation.';
  const source = buildImmutableSource({
    sourceBytes: Buffer.from(sourceText, 'utf8'),
    sourceOccurrenceKey: 'qxo-complete-serving-fixture',
  });
  const claimStart = utf8ByteLength('The representations are ');
  const claimEnd = utf8ByteLength('The representations are true in all material respects.');
  const relationshipStart = utf8ByteLength('The representations are true in all material respects. ');
  const relationshipEnd = utf8ByteLength(sourceText);
  const claimSpan = buildSemanticSpan(source, claimStart, claimEnd);
  const relationshipSpan = buildSemanticSpan(source, relationshipStart, relationshipEnd);
  const conditionSpan = buildSemanticSpan(source, 0, relationshipEnd);
  const representationStart = utf8ByteLength('The representations are true in all material respects. At closing, this tier tests the ');
  const representationSpan = buildSemanticSpan(source, representationStart, relationshipEnd);
  const claimExcerpt = buildExcerpt({ source, span: claimSpan });
  const relationshipExcerpt = buildExcerpt({ source, span: relationshipSpan });
  const conditionProvision = buildProvisionInstance({
    source,
    span: conditionSpan,
    conceptKey: 'COND-B-REP',
    party: { role: 'CONDITION_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const representationProvision = buildProvisionInstance({
    source,
    span: representationSpan,
    conceptKey: 'REP-T-CAP',
    party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
  });
  const claimEvidence = {
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: claimExcerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: claimExcerpt.absolute_start,
    absolute_end: claimExcerpt.absolute_end,
  };
  const relationshipEvidence = {
    evidence_role: 'CROSS_REFERENCE',
    excerpt_id: relationshipExcerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: relationshipExcerpt.absolute_start,
    absolute_end: relationshipExcerpt.absolute_end,
  };
  const claim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    raw_value: rawValue,
    canonical_value: 'MAT_ALL_MATERIAL',
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_MATERIAL' },
    codebooks: { accuracy_standard: ['MAT_ALL_MATERIAL'] },
    evidence: [claimEvidence],
    scope: {
      scope_closure_id: id('CLAIM_SCOPE_CLOSURE', 'complete-tier'),
      coverage_status: 'COMPLETE',
      required_interval_ids: [claimEvidence.excerpt_id],
      examined_interval_ids: [claimEvidence.excerpt_id],
    },
  });
  const relationship = buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'BRINGS_DOWN',
    state: 'PRESENT',
    target_occurrence_ids: [representationProvision.provision_instance_id],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_ACCURACY_AT_CLOSING',
      accuracy_standard: 'MAT_ALL_MATERIAL',
    },
    evidence: [relationshipEvidence],
  });
  const deal = {
    deal_key: 'deal:qxo',
    deal_admission_id: id('DEAL_ADMISSION', 'qxo'),
    dimensions: {
      sector: 'Industrials',
      buyer: 'QXO',
      merger_form: 'Reverse triangular merger',
      adviser_firms: ['Paul Weiss', 'Wachtell'],
      lawyers: ['Ben Goodchild', 'Partner Two'],
      announce_year: 2025,
      deal_value_usd: '5000000000',
    },
  };
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: deal.deal_key,
    dealAdmissionId: deal.deal_admission_id,
    contractFingerprint: contract.fingerprint,
  });
  const closureId = id('SEMANTIC_CLOSURE', 'qxo-complete-serving-fixture');
  const canonicalWriteSet = {
    source,
    source_admission: sourceAdmission,
    deal: {
      ...deal,
      document_hash: source.document_hash,
    },
    excerpts: [
      { ...claimExcerpt, closure_id: closureId },
      { ...relationshipExcerpt, closure_id: closureId },
    ],
    provisions: [
      { ...conditionProvision, closure_id: closureId },
      { ...representationProvision, closure_id: closureId },
    ],
    claims: [{ ...claim, closure_id: closureId }],
    relationships: [{ ...relationship, closure_id: closureId }],
  };
  const party = { role: 'CONDITION_BENEFICIARY', value: 'BUYER', capacity: 'ACQUIRER' };
  const result = buildFixtureResultComponent({
    deal_admission_id: deal.deal_admission_id,
    result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
    result_version: 1,
    concept_key: 'COND-B-REP',
    party,
    value_slot_key: 'ACCURACY_TIER_A',
    ordinal: 0,
    claim,
    relationships: [relationship],
    composition_scope_closure_id: id('COMPOSITION_SCOPE_CLOSURE', 'qxo-tier-a'),
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const corpusReleaseId = id('CORPUS_RELEASE', release);
  const projection = projectMarketMetricSlot({
    contract_bundle: contract,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal,
    concept_key: 'COND-B-REP',
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    party,
    result,
    claim,
    relationships: [relationship],
    value_slot_key: 'ACCURACY_TIER_A',
    ordinal: 0,
  });
  const cohortRequest = {
    serving_namespace_id: id('SERVING_NAMESPACE', 'candidate'),
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contract.fingerprint,
    metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
    metric_version: 1,
    concept_key: 'COND-B-REP',
    party,
    subject_deal_key: deal.deal_key,
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
      eligible_deals: 39,
      applicable_deals: 39,
      examined_deals: 38,
      present_deals: 38,
      comparable_deals: 37,
      distribution_deals: 37,
      excluded_deals: 2,
      observation_slots: 37,
      excluded_slots: 2,
      ...counts,
    },
    distribution: [
      { canonical_value: 'MAT_ALL_MATERIAL', subject_count: 20, deal_count: 20 },
      { canonical_value: 'MAT_MAE_QUALIFIED', subject_count: 17, deal_count: 17 },
    ],
    exclusions: [
      { reason_code: 'OWNER_RELATIONSHIP_NOT_EXAMINED', slot_count: 2, deal_count: 2 },
    ],
  };
  const row = buildCanonicalResultServingRow({
    contract_bundle: contract,
    frozen_pair_id: id('FROZEN_PAIR', 'fixture'),
    projection_output: projection,
    cohort_request: cohortRequest,
    cohort_result: cohortResult,
  });
  return {
    contract,
    cohortRequest,
    cohortResult,
    projection,
    row,
    source,
    sourceAdmission,
    claimSpan,
    claimExcerpt,
    relationshipSpan,
    relationshipExcerpt,
    conditionProvision,
    representationProvision,
    claim,
    relationship,
    canonicalWriteSet,
  };
}

module.exports = { buildCompleteServingFixture, id };
