const { canonicalJson, contentId } = require('./canonical-bytes');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const { buildAdmittedResultCompositionDetailPackage } = require('./admitted-composition-exact-detail');
const { validateQxoAdmittedNoShopRematchSlice } = require('./reviewed-qxo-admitted-no-shop-rematch-slice');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest`);
}

function buildQxoNoShopRematchServingSlice({
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
  validateQxoAdmittedNoShopRematchSlice({ sourceContext, contractBundle, slice });
  if (slice.resultInputs.length !== 1) throw new TypeError('reviewed QXO subsequent match result input has drifted');
  const input = slice.resultInputs[0];
  const deal = {
    deal_key: sourceContext.governed_deal_key,
    deal_admission_id: sourceContext.deal_admission_id,
    document_hash: sourceContext.document_hash,
    dimensions: {
      sector: dealDimensions?.sector ?? null,
      buyer: dealDimensions?.buyer ?? 'QXO',
      merger_form: dealDimensions?.merger_form ?? null,
      adviser_firms: dealDimensions?.adviser_firms ?? [],
      lawyers: dealDimensions?.lawyers ?? [],
      announce_year: dealDimensions?.announce_year ?? null,
      deal_value_usd: dealDimensions?.deal_value_usd ?? null,
    },
  };
  const result = buildFixtureResultComponent({
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
  if (!projection.observation
    || projection.exclusion
    || projection.observation.canonical_value !== '4'
    || projection.observation.day_basis !== 'BUSINESS'
    || projection.observation.basis_key !== 'DAYS:BUSINESS:MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL') {
    throw new TypeError('QXO subsequent match duration did not produce one comparable four-business-day observation');
  }
  const cohortRequest = {
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
    distribution: [{ canonical_value: '4', subject_count: 1, deal_count: 1 }],
    exclusions: [],
  };
  const baseRow = buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
      corpus_release_id: corpusReleaseId,
      metric_slot_key: projection.metric_slot_key,
    }),
    projection_output: projection,
    cohort_request: cohortRequest,
    cohort_result: cohortResult,
    result_ordinal: input.ordinal,
  });
  const excerpts = [slice.excerpts.rematch_clause, slice.excerpts.rematch_clock]
    .sort((left, right) => left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id));
  const components = [{ component: result, claim: input.claim, relationships: [] }];
  const exactDetailPackage = buildAdmittedResultCompositionDetailPackage({
    contract_bundle: contractBundle,
    row: baseRow,
    source: sourceContext,
    source_admission: sourceAdmission,
    components,
    relationship_targets: [],
    excerpts,
  });
  const readinessBody = {
    schema_version: 'QXO_NO_SHOP_REMATCH_RELEASE_READINESS/V1',
    status: 'READY_FOR_CANDIDATE_RELEASE',
    blocking_reasons: [],
    comparable_metric_slot_keys: [projection.metric_slot_key],
    shared_row_keys: [exactDetailPackage.row.row_serving_key],
    exact_detail_package_count: 1,
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_REMATCH_SERVING_SLICE/V1',
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    deal,
    result: {
      metric_key: input.metric_key,
      result,
      certification_state: 'COMPARABLE',
    },
    projection,
    shared_row: exactDetailPackage.row,
    admitted_exact_detail_package: exactDetailPackage,
    candidate_release_members: [{
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
    }],
    release_readiness: {
      ...readinessBody,
      qxo_no_shop_rematch_release_readiness_id: contentId(
        'QXO_NO_SHOP_REMATCH_RELEASE_READINESS/V1',
        readinessBody,
      ),
    },
  });
}

function validateQxoNoShopRematchServingSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoNoShopRematchServingSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO subsequent match serving slice identity or lineage has drifted');
  }
  return true;
}

module.exports = {
  buildQxoNoShopRematchServingSlice,
  validateQxoNoShopRematchServingSlice,
};
