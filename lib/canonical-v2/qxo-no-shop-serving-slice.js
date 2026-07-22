const { canonicalJson, contentId } = require('./canonical-bytes');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const { buildAdmittedResultCompositionDetailPackage } = require('./admitted-composition-exact-detail');
const { validateQxoAdmittedNoShopNoticeSlice } = require('./reviewed-qxo-admitted-no-shop-slice');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest`);
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

function buildResult(input) {
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
    comparability: input.comparability,
  });
}

function buildCohort({ contractBundle, servingNamespaceId, corpusReleaseId, deal, input, observation }) {
  const request = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: input.metric_key,
    metric_version: 1,
    concept_key: input.concept_key,
    party: input.party,
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
        excluded_deals: 0,
        observation_slots: 1,
        excluded_slots: 0,
      },
      distribution: [{
        canonical_value: observation.canonical_value,
        subject_count: 1,
        deal_count: 1,
      }],
      exclusions: [],
    },
  };
}

function selectedExcerpts(slice, claim) {
  const byId = new Map(Object.values(slice.excerpts).map((excerpt) => [excerpt.excerpt_id, excerpt]));
  const selected = claim.evidence.map((edge) => byId.get(edge.excerpt_id));
  if (selected.some((excerpt) => !excerpt)) {
    throw new TypeError('QXO no-shop exact detail does not close over its reviewed excerpts');
  }
  return selected.sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
}

function buildQxoNoShopServingSlice({
  sourceContext,
  sourceAdmission,
  slice,
  contractBundle,
  corpusReleaseId,
  servingNamespaceId,
  dealDimensions,
} = {}) {
  requireDigest(corpusReleaseId, 'corpusReleaseId');
  requireDigest(servingNamespaceId, 'servingNamespaceId');
  if (!sourceAdmission?.source_admission_manifest_id) throw new TypeError('sourceAdmission is required');
  validateQxoAdmittedNoShopNoticeSlice({ sourceContext, contractBundle, slice });
  if (slice.resultInputs.length !== 2) throw new TypeError('reviewed QXO no-shop result inputs have drifted');

  const deal = buildDeal(sourceContext, dealDimensions);
  const outputs = slice.resultInputs.map((input) => {
    const result = buildResult(input);
    const projection = projectMarketMetricSlot({
      contract_bundle: contractBundle,
      release_state: 'CANDIDATE_CERTIFIED',
      corpus_release_id: corpusReleaseId,
      deal,
      concept_key: input.concept_key,
      metric_key: input.metric_key,
      party: input.party,
      result,
      claim: input.claim,
      relationships: input.relationships,
      value_slot_key: input.value_slot_key,
      ordinal: input.ordinal,
    });
    if (!projection.observation || projection.exclusion) {
      throw new TypeError(`QXO no-shop ${input.metric_key} did not produce one comparable observation`);
    }
    const cohort = buildCohort({
      contractBundle,
      servingNamespaceId,
      corpusReleaseId,
      deal,
      input,
      observation: projection.observation,
    });
    const baseRow = buildCanonicalResultServingRow({
      contract_bundle: contractBundle,
      frozen_pair_id: contentId('FROZEN_PAIR/V1', {
        reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
        corpus_release_id: corpusReleaseId,
        metric_slot_key: projection.metric_slot_key,
      }),
      projection_output: projection,
      cohort_request: cohort.request,
      cohort_result: cohort.result,
      result_ordinal: input.ordinal,
    });
    const components = [{ component: result, claim: input.claim, relationships: input.relationships }];
    const excerpts = selectedExcerpts(slice, input.claim);
    const exactDetailPackage = buildAdmittedResultCompositionDetailPackage({
      contract_bundle: contractBundle,
      row: baseRow,
      source: sourceContext,
      source_admission: sourceAdmission,
      components,
      relationship_targets: [],
      excerpts,
    });
    return {
      input,
      result,
      projection,
      row: exactDetailPackage.row,
      exact_detail_package: exactDetailPackage,
      excerpts,
      candidate_release_member: {
        projection_output: projection,
        shared_row: exactDetailPackage.row,
        exact_detail: {
          package: exactDetailPackage,
          source: sourceContext,
          source_admission: sourceAdmission,
          components,
          relationship_targets: [],
          excerpts,
        },
      },
    };
  });
  const notice = outputs.find((output) => output.input.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS');
  const match = outputs.find((output) => output.input.metric_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');
  if (notice?.projection.observation.canonical_value !== '1'
    || notice?.projection.observation.day_basis !== 'ELAPSED'
    || match?.projection.observation.canonical_value !== '4'
    || match?.projection.observation.day_basis !== 'BUSINESS') {
    throw new TypeError('QXO no-shop duration normalisation has drifted');
  }

  const readinessBody = {
    schema_version: 'QXO_NO_SHOP_RELEASE_READINESS/V1',
    status: 'READY_FOR_CANDIDATE_RELEASE',
    blocking_reasons: [],
    comparable_metric_slot_keys: outputs.map((output) => output.projection.metric_slot_key).sort(),
    shared_row_keys: outputs.map((output) => output.row.row_serving_key).sort(),
    exact_detail_package_count: outputs.length,
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_SERVING_SLICE/V1',
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    deal,
    results: outputs.map((output) => ({
      metric_key: output.input.metric_key,
      result: output.result,
      certification_state: 'COMPARABLE',
    })),
    projections: outputs.map((output) => output.projection),
    shared_rows: outputs.map((output) => output.row),
    admitted_exact_detail_packages: outputs.map((output) => output.exact_detail_package),
    candidate_release_members: outputs.map((output) => output.candidate_release_member),
    release_readiness: {
      ...readinessBody,
      qxo_no_shop_release_readiness_id: contentId('QXO_NO_SHOP_RELEASE_READINESS/V1', readinessBody),
    },
  });
}

function validateQxoNoShopServingSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoNoShopServingSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO no-shop serving slice identity or lineage has drifted');
  }
  return true;
}

module.exports = {
  buildQxoNoShopServingSlice,
  validateQxoNoShopServingSlice,
};
