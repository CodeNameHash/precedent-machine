const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  validateContractBundle,
} = require('./contract-bundle');
const {
  buildFixtureResultComponent,
  projectOfflineInterpretedMarketMetricSlot,
} = require('./serving-projection');
const {
  compileOfflineInterpretedMarketCohortRequest,
} = require('./market-cohort-query');
const {
  buildOfflineCandidateCanonicalResultServingRow,
} = require('./shared-serving-row');
const {
  buildOfflineInterpretedResultCompositionDetailPackage,
} = require('./admitted-composition-exact-detail');
const {
  buildDealServingDirectoryRecord,
  buildOfflineCandidateRelease,
} = require('./candidate-release');
const {
  buildOfflineInterpretedQueryProjectionRecord,
} = require('./query-result');
const {
  buildComparabilityClass,
} = require('./qxo-no-shop-copy-delivery-serving-f18');
const {
  QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
} = require('./candidate-metric-definition-policy');
const {
  buildExcerpt,
  buildSemanticSpan,
} = require('./source-structure');

const AUTHORITY_SCOPE = 'OFFLINE_QXO_COPY_DELIVERY_CANONICAL_F19_ONLY';
const F17_ID =
  'a3321ec1688efeecf5aece34151cde26def625bbc9b613898a0b5e31b41492bb';
const F17_DIGEST =
  'a54fc7b5eaa94e80f5772430e02eb4d2868d478848b4ba87525100d146cfe4d6';
const F18_ID =
  '543b1e37db768d316d3b33a5f63e348d61e0a3bf7f2113dd61f312f270808e36';
const F18_DIGEST =
  'a5700db031335497c8f6c7d88878e3f39845164c4232e5285ff95371eede7fd4';
const METRIC_KEY = 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS';
const APPLICATION_DEAL_ID = '00000000-0000-4000-8000-000000000019';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function sourceOrderedExcerpts(source, excerptMap, interpretation) {
  const firstSentence = [...excerptMap.values()].find((excerpt) => (
    excerpt.absolute_start === 207783
      && excerpt.absolute_end === 208859
  ));
  if (!firstSentence) {
    throw new TypeError('F19 lacks the complete notice sentence governing Company Request semantics');
  }
  const required = [...new Set([
    ...interpretation.evidence_excerpt_ids,
    firstSentence.excerpt_id,
  ])].sort();
  const selected = required.map((id) => {
    const sourceExcerpt = excerptMap.get(id);
    if (!sourceExcerpt) return null;
    return buildExcerpt({
      source,
      span: buildSemanticSpan(
        source,
        sourceExcerpt.absolute_start,
        sourceExcerpt.absolute_end,
      ),
    });
  });
  if (selected.some((excerpt) => !excerpt)) {
    throw new TypeError('F19 exact source resolver is missing governed interpretation evidence');
  }
  selected.sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
  if (selected.length !== 4
    || selected.some((excerpt) => (
      excerpt.ordered_component_assignments[0].semantic_span_id == null
        || typeof excerpt.exact_text !== 'string'
        || excerpt.exact_text.length === 0
    ))) {
    throw new TypeError('F19 exact source evidence coordinates or text have drifted');
  }
  return selected;
}

function validateInputs(input) {
  const contractBundle = input.contract_bundle;
  const f17 = input.qxo_no_shop_copy_delivery_claim_f17;
  const f18 = input.qxo_no_shop_copy_delivery_serving_f18;
  const source = input.admitted_source_context;
  const sourceAdmission = input.source_admission_manifest;
  validateContractBundle(contractBundle);
  const f17Body = { ...f17 };
  delete f17Body.qxo_no_shop_copy_delivery_claim_f17_id;
  delete f17Body.canonical_payload_digest;
  const f18Body = { ...f18 };
  delete f18Body.qxo_no_shop_copy_delivery_serving_f18_id;
  delete f18Body.canonical_payload_digest;
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(contractBundle.fingerprint)
    || f17?.qxo_no_shop_copy_delivery_claim_f17_id !== F17_ID
    || f17?.canonical_payload_digest !== F17_DIGEST
    || f18?.qxo_no_shop_copy_delivery_serving_f18_id !== F18_ID
    || f18?.canonical_payload_digest !== F18_DIGEST
    || f17.qxo_no_shop_copy_delivery_claim_f17_id !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17/V1',
      f17Body,
    )
    || f17.canonical_payload_digest !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17_PAYLOAD/V1',
      f17Body,
    )
    || f18.qxo_no_shop_copy_delivery_serving_f18_id !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18/V1',
      f18Body,
    )
    || f18.canonical_payload_digest !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18_PAYLOAD/V1',
      f18Body,
    )
    || f18.status?.candidate_release_authority !== 'NONE'
    || source?.document_hash !== f17.source_binding.document_hash
    || source?.canonical_text_id !== f17.source_binding.canonical_text_id
    || source?.governed_deal_key !== f17.source_binding.governed_deal_key
    || sourceAdmission?.source_admission_manifest_id
      !== source.source_admission_manifest_id) {
    throw new TypeError('F19 requires the exact F17/F18 and admitted V12 source lineage');
  }
  const excerptMap = new Map(
    Object.values(input.reviewed_no_shop_slice?.excerpts || {})
      .map((excerpt) => [excerpt.excerpt_id, excerpt]),
  );
  return {
    contractBundle,
    f17,
    f18,
    source,
    sourceAdmission,
    excerpts: sourceOrderedExcerpts(source, excerptMap, f17.interpretation),
  };
}

function buildQxoNoShopCopyDeliveryCanonicalF19(input = {}) {
  const {
    contractBundle,
    f17,
    source,
    sourceAdmission,
    excerpts,
  } = validateInputs(input);
  const comparabilityClass = buildComparabilityClass(f17);
  const comparabilityContext = {
    schema_version: 'MARKET_COMPARABILITY_CONTEXT/V1',
    interpretation_payload_id:
      f17.interpretation.interpretation_payload_id,
    comparability_class_digest:
      comparabilityClass.comparability_class_digest,
    clarity_state: f17.interpretation.clarity_state,
    ambiguity_dimension_codes:
      f17.interpretation.ambiguity_dimension_codes,
    comparability_effect_code:
      f17.claim.attributes.comparability_effect_code,
    primary_semantic_class:
      comparabilityClass.primary_semantic_class,
    alternative_semantic_classes:
      comparabilityClass.alternative_semantic_classes,
    lawyer_warning: {
      required: true,
      code: f17.presentation.ambiguity_warning_code,
      text: f17.presentation.ambiguity_warning_text,
      lawyer_note_digest: f17.interpretation.lawyer_note_digest,
    },
    governing_evidence_excerpt_ids: excerpts
      .filter((excerpt) => (
        excerpt.absolute_start === 207783
          && excerpt.absolute_end === 208859
      ))
      .map((excerpt) => excerpt.excerpt_id),
  };
  const corpusReleaseId = contentId('CANDIDATE_CORPUS_RELEASE_OCCURRENCE/V3', {
    release_version: 'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19/V1',
    contract_fingerprint: contractBundle.fingerprint,
    source_admission_manifest_id: source.source_admission_manifest_id,
    comparability_class_digest:
      comparabilityContext.comparability_class_digest,
  });
  const servingNamespaceId = contentId('CANDIDATE_SERVING_NAMESPACE/V3', {
    corpus_release_id: corpusReleaseId,
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    integration_admission_id:
      QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: source.deal_admission_id,
    result_key: f17.result.result_key,
    result_version: f17.result.result_version,
    concept_key: f17.result.concept_key,
    party: f17.result.party,
    value_slot_key: f17.result.value_slot_key,
    ordinal: f17.result.ordinal,
    claim: f17.claim,
    relationships: [],
    composition_scope_closure_id:
      f17.result.composition_scope_closure_id,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  if (result.component_revision_id === f17.result.component_revision_id) {
    throw new TypeError('F19 must remint the result against the V12 deal admission');
  }
  const deal = {
    deal_key: source.governed_deal_key,
    deal_admission_id: source.deal_admission_id,
    document_hash: source.document_hash,
    dimensions: {
      sector: null,
      buyer: 'QXO',
      merger_form: null,
      adviser_firms: [],
      lawyers: [],
      announce_year: 2024,
      deal_value_usd: null,
    },
  };
  const projection = projectOfflineInterpretedMarketMetricSlot({
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    integration_admission_id:
      QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal,
    concept_key: f17.result.concept_key,
    metric_key: METRIC_KEY,
    party: f17.result.party,
    result,
    claim: f17.claim,
    claim_interpretation: f17.interpretation,
    comparability_context: comparabilityContext,
    relationships: [],
    value_slot_key: f17.result.value_slot_key,
    ordinal: f17.result.ordinal,
  });
  const cohortRequest = compileOfflineInterpretedMarketCohortRequest({
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    integration_admission_id:
      QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: METRIC_KEY,
    metric_version: 1,
    concept_key: f17.result.concept_key,
    party: f17.result.party,
    subject_deal_key: source.governed_deal_key,
    comparability_class_digest:
      comparabilityContext.comparability_class_digest,
    filters: {},
  });
  const cohortResult = {
    schema_version: 'MARKET_COHORT_RESULT/V2',
    authority_scope: 'OFFLINE_CANDIDATE_ONLY',
    integration_admission_id:
      QXO_COPY_DELIVERY_F19_INTEGRATION_ADMISSION_ID,
    execution_state: 'OFFLINE_FIXTURE_ONLY',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    cohort_digest: cohortRequest.cohort_digest,
    comparability_class_digest:
      cohortRequest.comparability_class_digest,
    metric_key: METRIC_KEY,
    metric_version: 1,
    concept_key: f17.result.concept_key,
    subject_deal_key: source.governed_deal_key,
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
      canonical_value: f17.claim.canonical_value,
      subject_count: 1,
      deal_count: 1,
    }],
    exclusions: [],
  };
  const baseRow = buildOfflineCandidateCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V2', {
      f17_id: F17_ID,
      corpus_release_id: corpusReleaseId,
      metric_slot_key: projection.metric_slot_key,
    }),
    projection_output: projection,
    cohort_request: cohortRequest,
    cohort_result: cohortResult,
    result,
    claim: f17.claim,
    interpretation: f17.interpretation,
    comparability_context: comparabilityContext,
  });
  const components = [{
    component: result,
    claim: f17.claim,
    interpretation: f17.interpretation,
    relationships: [],
  }];
  const exactDetailPackage =
    buildOfflineInterpretedResultCompositionDetailPackage({
      contract_bundle: contractBundle,
      row: baseRow,
      source,
      source_admission: sourceAdmission,
      components,
      excerpts,
    });
  const row = exactDetailPackage.row;
  const queryProjection = buildOfflineInterpretedQueryProjectionRecord({
    row,
    observation: projection.observation,
  });
  const dealDirectoryEntry = buildDealServingDirectoryRecord({
    servingNamespaceId,
    corpusReleaseId,
    contractFingerprint: contractBundle.fingerprint,
    applicationDealId: APPLICATION_DEAL_ID,
    governedDealKey: source.governed_deal_key,
    dealAdmissionId: source.deal_admission_id,
  });
  const candidateRelease = buildOfflineCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    observation: projection.observation,
    shared_row: row,
    exact_detail_package: exactDetailPackage,
    cohort_request: cohortRequest,
    cohort_result: cohortResult,
    query_projection: queryProjection,
    deal_directory_entry: dealDirectoryEntry,
  });
  const body = {
    schema_version: 'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19/V1',
    authority_scope: AUTHORITY_SCOPE,
    upstream_bindings: {
      qxo_no_shop_copy_delivery_claim_f17_id: F17_ID,
      qxo_no_shop_copy_delivery_claim_f17_payload_digest: F17_DIGEST,
      qxo_no_shop_copy_delivery_serving_f18_id: F18_ID,
      qxo_no_shop_copy_delivery_serving_f18_payload_digest: F18_DIGEST,
    },
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    result,
    projection,
    cohort_request: cohortRequest,
    cohort_result: cohortResult,
    shared_row: row,
    exact_detail_package: exactDetailPackage,
    query_projection: queryProjection,
    deal_directory_entry: dealDirectoryEntry,
    candidate_release: candidateRelease,
    status: {
      canonical_candidate_contract_integration: 'RESOLVED_OFFLINE',
      admitted_exact_source_resolver: 'RESOLVED_OFFLINE',
      indexed_query_executor_certification: 'NOT_BUILT',
      active_serving_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'INDEXED_QUERY_EXECUTOR_CERTIFICATION_REQUIRED',
        'V12_ACTIVE_SERVING_ADMISSION_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    qxo_no_shop_copy_delivery_canonical_f19_id: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoNoShopCopyDeliveryCanonicalF19({
  qxo_no_shop_copy_delivery_canonical_f19: candidate,
  ...inputs
} = {}) {
  const expected = buildQxoNoShopCopyDeliveryCanonicalF19(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F19 canonical integration carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  buildQxoNoShopCopyDeliveryCanonicalF19,
  validateQxoNoShopCopyDeliveryCanonicalF19,
};
