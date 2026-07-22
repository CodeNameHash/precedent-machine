const { canonicalJson, contentId } = require('./canonical-bytes');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const {
  buildFixtureResultComponent,
  projectMarketMetricSlot,
} = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const {
  validateQxoReviewedCapitalisationSlice,
} = require('./reviewed-qxo-capitalisation-slice');

const METRIC_KEY = 'REPRESENTATION_ACCURACY_STANDARD';
const TIER_B_SLOT = 'CAPITALISATION_LIMBS_I_AND_III';
const TIER_C_SLOT = 'CAPITALISATION_OTHER_LIMBS';
const TIER_C_BLOCKING_REASON = 'BRING_DOWN_MATERIALITY_EFFECT_NOT_GOVERNED';
const EXACT_DETAIL_BLOCKING_REASON = 'ADMITTED_V2_EXACT_DETAIL_PACKAGE_REQUIRED';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest`);
}

function buildResult(input, comparability = input.comparability) {
  return buildFixtureResultComponent({
    deal_admission_id: input.deal_admission_id,
    result_key: input.result_key,
    result_version: input.result_version,
    concept_key: input.concept_key,
    party: input.party,
    value_slot_key: input.value_slot_key,
    ordinal: input.ordinal,
    claim: input.claim,
    relationships: input.relationships,
    composition_scope_closure_id: input.composition_scope_closure_id,
    completeness: input.completeness,
    comparability,
  });
}

function buildDeal(sourceContext, dimensions) {
  return {
    deal_key: sourceContext.governed_deal_key,
    deal_admission_id: sourceContext.deal_admission_id,
    document_hash: sourceContext.document_hash,
    dimensions: {
      sector: dimensions?.sector ?? null,
      buyer: dimensions?.buyer ?? 'QXO',
      merger_form: dimensions?.merger_form ?? null,
      adviser_firms: dimensions?.adviser_firms ?? [],
      lawyers: dimensions?.lawyers ?? [],
      announce_year: dimensions?.announce_year ?? null,
      deal_value_usd: dimensions?.deal_value_usd ?? null,
    },
  };
}

function projection({ contractBundle, corpusReleaseId, deal, input, result }) {
  return projectMarketMetricSlot({
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal,
    concept_key: input.concept_key,
    metric_key: METRIC_KEY,
    party: input.party,
    result,
    claim: input.claim,
    relationships: input.relationships,
    value_slot_key: input.value_slot_key,
    ordinal: input.ordinal,
  });
}

function buildCohort({
  contractBundle,
  servingNamespaceId,
  corpusReleaseId,
  deal,
  party,
  observation,
  exclusion,
}) {
  const request = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: METRIC_KEY,
    metric_version: 1,
    concept_key: 'COND-B-REP',
    party,
    subject_deal_key: deal.deal_key,
    filters: {},
  };
  const compiled = compileMarketCohortRequest(request);
  return {
    request,
    result: {
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
        excluded_deals: 1,
        observation_slots: 1,
        excluded_slots: 1,
      },
      distribution: [{
        canonical_value: observation.canonical_value,
        subject_count: 1,
        deal_count: 1,
      }],
      exclusions: [{
        reason_code: exclusion.exclusion_reason,
        slot_count: 1,
        deal_count: 1,
      }],
    },
  };
}

function exactDetailInput({ row, components, slice, sourceContext }) {
  const relationships = components.flatMap((entry) => entry.relationships);
  const excerptIds = [...new Set([
    ...components.flatMap((entry) => entry.claim.evidence.map((edge) => edge.excerpt_id)),
    ...components.flatMap((entry) => (
      entry.claim.state === 'ABSENT' ? entry.claim.scope.required_interval_ids : []
    )),
    ...relationships.flatMap((relationship) => relationship.evidence.map((edge) => edge.excerpt_id)),
  ])];
  const excerptsById = new Map(Object.values(slice.excerpts).map((excerpt) => [excerpt.excerpt_id, excerpt]));
  const selectedExcerpts = excerptIds.map((id) => excerptsById.get(id));
  if (selectedExcerpts.some((excerpt) => !excerpt)) {
    throw new TypeError('QXO exact-detail input does not close over its reviewed excerpts');
  }
  const orderedExcerpts = selectedExcerpts.sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
  const targetIds = relationships.flatMap((relationship) => relationship.target_occurrence_ids);
  const targetsById = new Map(slice.components.map((component) => [component.provision_component_id, component]));
  const targets = targetIds.map((id) => targetsById.get(id));
  if (targets.some((target) => !target)) {
    throw new TypeError('QXO exact-detail input does not close over its reviewed relationship targets');
  }
  const body = {
    schema_version: 'ADMITTED_RESULT_COMPOSITION_DETAIL_INPUT/V1',
    adapter_status: 'READY_FOR_ADMITTED_V2_PACKAGE',
    blocking_reason: EXACT_DETAIL_BLOCKING_REASON,
    row_serving_key: row.row_serving_key,
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    source_lineage: {
      governed_deal_key: sourceContext.governed_deal_key,
      deal_admission_id: sourceContext.deal_admission_id,
      source_ordinal: sourceContext.source_ordinal,
      immutable_source_document_id: sourceContext.immutable_source_document_id,
      source_admission_manifest_id: sourceContext.source_admission_manifest_id,
      semantic_extraction_input_envelope_id: sourceContext.semantic_extraction_input_envelope_id,
      source_content_id: sourceContext.source_content_id,
      source_occurrence_id: sourceContext.source_occurrence_id,
      source_occurrence_key: sourceContext.source_occurrence_key,
      source_kind: sourceContext.source_kind,
      document_hash: sourceContext.document_hash,
      source_byte_length: sourceContext.source_byte_length,
      canonical_text_id: sourceContext.canonical_text_id,
      canonical_text_sha256: sourceContext.canonical_text_sha256,
      canonical_text_byte_length: sourceContext.canonical_text_byte_length,
    },
    components,
    relationship_revision_ids: relationships.map((relationship) => relationship.relationship_revision_id),
    relationship_targets: targets,
    relationship_target_occurrence_ids: targets.map((target) => target.provision_component_id),
    excerpts: orderedExcerpts,
    ordered_excerpt_ids: orderedExcerpts.map((excerpt) => excerpt.excerpt_id),
  };
  return {
    ...body,
    admitted_result_composition_detail_input_id: contentId(
      'ADMITTED_RESULT_COMPOSITION_DETAIL_INPUT/V1',
      body,
    ),
  };
}

function buildQxoCapitalisationServingSlice({
  sourceContext,
  slice,
  contractBundle,
  corpusReleaseId,
  servingNamespaceId,
  dealDimensions,
  sourceAdmission = null,
} = {}) {
  requireDigest(corpusReleaseId, 'corpusReleaseId');
  requireDigest(servingNamespaceId, 'servingNamespaceId');
  validateQxoReviewedCapitalisationSlice({ sourceContext, contractBundle, slice });
  if (slice.resultInputs.length !== 2
    || slice.resultInputs[0].value_slot_key !== TIER_B_SLOT
    || slice.resultInputs[1].value_slot_key !== TIER_C_SLOT) {
    throw new TypeError('reviewed QXO capitalisation result inputs have drifted');
  }

  const deal = buildDeal(sourceContext, dealDimensions);
  const tierBInput = slice.resultInputs[0];
  const tierCInput = slice.resultInputs[1];
  const tierBResult = buildResult(tierBInput);
  const tierCResult = buildResult(tierCInput, 'NOT_CERTIFIED');
  const tierBContext = [
    {
      component: buildFixtureResultComponent({
        deal_admission_id: tierBInput.deal_admission_id,
        result_key: tierBInput.result_key,
        result_version: tierBInput.result_version,
        concept_key: tierBInput.concept_key,
        party: tierBInput.party,
        value_slot_key: 'ACCURACY_EXCEPTION',
        ordinal: 1,
        claim: slice.exceptionClaim,
        relationships: [],
        composition_scope_closure_id: tierBInput.composition_scope_closure_id,
        completeness: 'COMPLETE',
        comparability: 'COMPARABLE',
      }),
      claim: slice.exceptionClaim,
      relationships: [],
    },
    ...[
      { claim: slice.knowledgeClaims[0], slot: 'KNOWLEDGE_QUALIFIER_LIMB_I', ordinal: 2 },
      { claim: slice.knowledgeClaims[2], slot: 'KNOWLEDGE_QUALIFIER_LIMB_III', ordinal: 3 },
    ].map(({ claim, slot, ordinal }) => ({
      component: buildFixtureResultComponent({
        deal_admission_id: tierBInput.deal_admission_id,
        result_key: tierBInput.result_key,
        result_version: tierBInput.result_version,
        concept_key: tierBInput.concept_key,
        party: tierBInput.party,
        value_slot_key: slot,
        ordinal,
        claim,
        relationships: [],
        composition_scope_closure_id: claim.scope.scope_closure_id,
        completeness: 'COMPLETE',
        comparability: 'COMPARABLE',
      }),
      claim,
      relationships: [],
    })),
  ];
  const tierBProjection = projection({
    contractBundle,
    corpusReleaseId,
    deal,
    input: tierBInput,
    result: tierBResult,
  });
  const tierCProjection = projection({
    contractBundle,
    corpusReleaseId,
    deal,
    input: tierCInput,
    result: tierCResult,
  });
  if (!tierBProjection.observation
    || tierCProjection.exclusion?.exclusion_reason !== 'RESULT_NOT_COMPARABLE') {
    throw new TypeError('QXO capitalisation serving partition is not fail-closed');
  }

  const cohort = buildCohort({
    contractBundle,
    servingNamespaceId,
    corpusReleaseId,
    deal,
    party: tierBInput.party,
    observation: tierBProjection.observation,
    exclusion: tierCProjection.exclusion,
  });
  const row = buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
      corpus_release_id: corpusReleaseId,
      metric_slot_key: tierBProjection.metric_slot_key,
    }),
    projection_output: tierBProjection,
    cohort_request: cohort.request,
    cohort_result: cohort.result,
    context_components: tierBContext,
    result_ordinal: tierBInput.ordinal,
  });
  const compositionComponents = [
    { component: tierBResult, claim: tierBInput.claim, relationships: tierBInput.relationships },
    ...tierBContext,
  ];
  const admittedExactDetailInput = exactDetailInput({
    row,
    components: compositionComponents,
    slice,
    sourceContext,
  });
  let exactDetailPackage = null;
  let publishedRow = row;
  let candidateReleaseMembers = null;
  if (sourceAdmission !== null) {
    const {
      buildAdmittedResultCompositionDetailPackage,
    } = require('./admitted-composition-exact-detail');
    exactDetailPackage = buildAdmittedResultCompositionDetailPackage({
      contract_bundle: contractBundle,
      row,
      source: sourceContext,
      source_admission: sourceAdmission,
      components: compositionComponents,
      relationship_targets: admittedExactDetailInput.relationship_targets,
      excerpts: admittedExactDetailInput.excerpts,
    });
    publishedRow = exactDetailPackage.row;
    candidateReleaseMembers = [
      {
        projection_output: tierBProjection,
        shared_row: publishedRow,
        exact_detail: {
          package: exactDetailPackage,
          source: sourceContext,
          source_admission: sourceAdmission,
          components: compositionComponents,
          relationship_targets: admittedExactDetailInput.relationship_targets,
          excerpts: admittedExactDetailInput.excerpts,
        },
      },
      {
        projection_output: tierCProjection,
        shared_row: null,
        exact_detail: null,
      },
    ];
  }
  const releaseReadinessBody = {
    schema_version: 'QXO_CAPITALISATION_RELEASE_READINESS/V1',
    status: exactDetailPackage ? 'READY_FOR_CANDIDATE_RELEASE' : 'AWAITING_EXACT_DETAIL',
    blocking_reasons: exactDetailPackage ? [] : [EXACT_DETAIL_BLOCKING_REASON],
    comparable_metric_slot_keys: [tierBProjection.metric_slot_key],
    excluded_metric_slot_keys: [tierCProjection.metric_slot_key],
    shared_row_keys: [publishedRow.row_serving_key],
    admitted_exact_detail_input_ids: [
      admittedExactDetailInput.admitted_result_composition_detail_input_id,
    ],
  };
  const releaseReadiness = {
    ...releaseReadinessBody,
    qxo_capitalisation_release_readiness_id: contentId(
      'QXO_CAPITALISATION_RELEASE_READINESS/V1',
      releaseReadinessBody,
    ),
  };

  return freeze({
    schema_version: 'QXO_CAPITALISATION_SERVING_SLICE/V1',
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    deal,
    results: [
      { value_slot_key: TIER_B_SLOT, result: tierBResult, certification_state: 'COMPARABLE' },
      {
        value_slot_key: TIER_C_SLOT,
        result: tierCResult,
        certification_state: 'NOT_CERTIFIED',
        blocking_reason: TIER_C_BLOCKING_REASON,
      },
    ],
    projections: [tierBProjection, tierCProjection],
    shared_rows: [publishedRow],
    admitted_exact_detail_inputs: [admittedExactDetailInput],
    admitted_exact_detail_packages: exactDetailPackage ? [exactDetailPackage] : [],
    composition_components: compositionComponents,
    candidate_release_member_intents: [
      {
        projection_output: tierBProjection,
        shared_row: publishedRow,
        admitted_exact_detail_input_id:
          admittedExactDetailInput.admitted_result_composition_detail_input_id,
      },
      {
        projection_output: tierCProjection,
        shared_row: null,
        admitted_exact_detail_input_id: null,
      },
    ],
    candidate_release_members: candidateReleaseMembers,
    release_readiness: releaseReadiness,
  });
}

function validateQxoCapitalisationServingSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoCapitalisationServingSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO capitalisation serving slice identity or lineage has drifted');
  }
  return true;
}

module.exports = {
  EXACT_DETAIL_BLOCKING_REASON,
  TIER_C_BLOCKING_REASON,
  buildQxoCapitalisationServingSlice,
  validateQxoCapitalisationServingSlice,
};
