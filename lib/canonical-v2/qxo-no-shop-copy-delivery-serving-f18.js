const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateClaimInterpretation,
  validateInterpretedPresentClaimRevision,
} = require('./claim-interpretation');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  validateContractBundle,
} = require('./contract-bundle');
const {
  METRIC_DEFINITIONS,
  metricDefinitionId,
} = require('./serving-projection');

const AUTHORITY_SCOPE =
  'OFFLINE_QXO_COPY_DELIVERY_SERVING_AND_CANDIDATE_RELEASE_F18_ONLY';
const F17_ID =
  'f89db21d30e4985296c82abd7cdd6df63452f0fd61503d27a834c8c9c199c753';
const F17_DIGEST =
  '01ff52425c64daac1ad40654c2848619b567d95c9884b8f30201b58963fe97dd';
const METRIC_KEY = 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS';
const RELEASE_VERSION = 'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function digestSet(domain, values) {
  return contentId(domain, [...new Set(values)].sort());
}

function sortedUniqueValues(values) {
  return [...new Map(values.map((value) => [
    canonicalJson(value),
    value,
  ])).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    throw new TypeError(`${label} must be a full SHA-256 content ID`);
  }
  return value;
}

function requireF17(contractBundle, f17) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      contractBundle.fingerprint,
    )) {
    throw new TypeError(
      'F18 requires frozen V12 outside the active serving allowlist',
    );
  }
  if (!f17
    || f17.qxo_no_shop_copy_delivery_claim_f17_id !== F17_ID
    || f17.canonical_payload_digest !== F17_DIGEST
    || f17.status?.candidate_projection_authority !== 'NONE'
    || f17.status?.candidate_release_authority !== 'NONE') {
    throw new TypeError('F18 requires the exact frozen F17 carrier');
  }
  validateClaimInterpretation({
    claim_interpretation: f17.interpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
  });
  validateInterpretedPresentClaimRevision({
    claim: f17.claim,
    interpretation: f17.interpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
    allowed_attributes: Object.keys(f17.claim.attributes),
    codebooks: {},
    expected_attributes: f17.claim.attributes,
  });
  if (f17.result.claim_revision_ids.length !== 1
    || f17.result.claim_revision_ids[0] !== f17.claim.claim_revision_id
    || f17.result.completeness !== 'COMPLETE'
    || f17.result.comparability !== 'COMPARABLE'
    || f17.presentation?.lawyer_warning_required !== true) {
    throw new TypeError('F17 claim, result and warning lineage has drifted');
  }
  return f17;
}

function buildInterpretationProjection(f17) {
  const interpretation = f17.interpretation;
  const attributes = f17.claim.attributes;
  const body = {
    schema_version: 'MARKET_INTERPRETATION_PROJECTION/V1',
    policy_version: interpretation.policy_version,
    interpretation_payload_id: interpretation.interpretation_payload_id,
    clarity_state: interpretation.clarity_state,
    ambiguity_dimension_codes: [
      ...interpretation.ambiguity_dimension_codes,
    ],
    comparability_effect_code: attributes.comparability_effect_code,
    primary_interpretation_digest: contentId(
      'MARKET_PRIMARY_INTERPRETATION/V1',
      interpretation.primary_interpretation,
    ),
    alternative_interpretation_set_digest: contentId(
      'MARKET_ALTERNATIVE_INTERPRETATION_SET/V1',
      interpretation.alternative_interpretations,
    ),
    lawyer_note_digest: interpretation.lawyer_note_digest,
    ambiguity_warning_code:
      f17.presentation.ambiguity_warning_code,
    ambiguity_warning_text:
      f17.presentation.ambiguity_warning_text,
    lawyer_warning_required: true,
    primary_interpretation:
      interpretation.primary_interpretation,
    alternative_interpretations:
      interpretation.alternative_interpretations,
  };
  return {
    ...body,
    interpretation_projection_digest: contentId(
      'MARKET_INTERPRETATION_PROJECTION/V1',
      body,
    ),
  };
}

function buildComparabilityClass(f17) {
  const interpretation = f17.interpretation;
  const attributes = f17.claim.attributes;
  const body = {
    schema_version: 'MARKET_COMPARABILITY_CLASS/V1',
    metric_key: METRIC_KEY,
    metric_version: 1,
    basis_key: attributes.basis_key,
    policy_version: interpretation.policy_version,
    clarity_state: interpretation.clarity_state,
    ambiguity_dimension_codes: [
      ...new Set(interpretation.ambiguity_dimension_codes),
    ].sort(),
    comparability_effect_code: attributes.comparability_effect_code,
    primary_semantic_class: {
      code: attributes.primary_receipt_interpretation_code,
      receipt_recipient_party:
        interpretation.primary_interpretation.receipt_recipient_party,
      trigger_expression_operator:
        attributes.trigger_expression_operator,
      trigger_operand_codes: [
        ...new Set(attributes.trigger_operand_codes),
      ].sort(),
      trigger_operand_sufficiency:
        attributes.trigger_operand_sufficiency,
      clock_application_scope_code:
        attributes.primary_clock_application_scope_code,
      item_or_batch_cardinality_state:
        attributes.primary_item_or_batch_cardinality_state,
      company_request_semantic_code:
        attributes.company_request_semantic_code,
    },
    alternative_semantic_classes: sortedUniqueValues([{
      code: attributes.alternative_receipt_interpretation_code,
      clock_application_scope_state:
        attributes.alternative_clock_application_scope_state,
      item_or_batch_cardinality_state:
        attributes.alternative_item_or_batch_cardinality_state,
      cardinality_ambiguity_scope_code:
        attributes.cardinality_ambiguity_scope_code,
    }]),
  };
  return {
    ...body,
    comparability_class_digest: contentId(
      'MARKET_COMPARABILITY_CLASS/V1',
      body,
    ),
  };
}

function buildObservation({
  contractBundle,
  f17,
  corpusReleaseId,
  interpretationProjection,
  comparabilityClass,
}) {
  const metric = METRIC_DEFINITIONS[METRIC_KEY];
  const occurrenceBody = {
    schema_version: 'METRIC_OBSERVATION_READINESS_OCCURRENCE/V1',
    deal_key: f17.source_binding.governed_deal_key,
    deal_admission_id: f17.source_binding.deal_admission_id,
    concept_key: metric.concept_key,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    party: f17.result.party,
    result_key: f17.result.result_key,
    result_version: f17.result.result_version,
    owner_occurrence_id: f17.result.component_occurrence_id,
    value_slot_key: f17.result.value_slot_key,
    governed_ordinal: f17.result.ordinal,
    interpretation_projection_digest:
      interpretationProjection.interpretation_projection_digest,
  };
  const occurrenceId = contentId(
    'METRIC_OBSERVATION_READINESS_OCCURRENCE/V1',
    occurrenceBody,
  );
  const body = {
    schema_version: 'MARKET_OBSERVATION_READINESS/V1',
    authority_scope: AUTHORITY_SCOPE,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_definition_id: metricDefinitionId(metric),
    metric_observation_occurrence_id: occurrenceId,
    deal_key: occurrenceBody.deal_key,
    deal_admission_id: occurrenceBody.deal_admission_id,
    concept_key: metric.concept_key,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    basis_key: metric.basis_key,
    party: f17.result.party,
    result_key: f17.result.result_key,
    result_version: f17.result.result_version,
    owner_occurrence_id: f17.result.component_occurrence_id,
    owner_revision_id: f17.result.component_revision_id,
    value_slot_key: f17.result.value_slot_key,
    governed_ordinal: f17.result.ordinal,
    claim_occurrence_id: f17.claim.claim_occurrence_id,
    claim_revision_id: f17.claim.claim_revision_id,
    claim_definition_key: f17.claim.claim_definition_key,
    claim_definition_version: f17.claim.claim_definition_version,
    state: 'PRESENT',
    raw_value: f17.claim.raw_value,
    canonical_value: f17.claim.canonical_value,
    canonical_unit: metric.canonical_unit,
    unit: f17.claim.unit,
    day_basis: f17.claim.day_basis,
    denominator: null,
    derivation_version: f17.claim.derivation_version,
    result_completeness: 'COMPLETE',
    market_comparability: 'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
    interpretation_projection: interpretationProjection,
    comparability_class: comparabilityClass,
    cohort_membership: 'SEPARATE_INTERPRETATION_KEYED_COHORT',
  };
  return {
    ...body,
    market_observation_serving_key: contentId(
      'MARKET_OBSERVATION_READINESS/V1',
      {
        corpus_release_id: corpusReleaseId,
        metric_observation_occurrence_id: occurrenceId,
      },
    ),
    canonical_payload_digest: contentId(
      'MARKET_OBSERVATION_READINESS_PAYLOAD/V1',
      body,
    ),
  };
}

function buildCohort({
  contractBundle,
  f17,
  corpusReleaseId,
  servingNamespaceId,
  observation,
  comparabilityClass,
}) {
  const identity = {
    schema_version: 'MARKET_COHORT_READINESS/V1',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: observation.metric_key,
    metric_version: observation.metric_version,
    concept_key: observation.concept_key,
    party: observation.party,
    basis_key: observation.basis_key,
    comparability_class_digest:
      comparabilityClass.comparability_class_digest,
    filters: {
      sector: null,
      buyer: null,
      merger_form: null,
      adviser_either: null,
      lawyer_either: null,
      year_from: null,
      year_to: null,
      min_value_usd: null,
      max_value_usd: null,
    },
  };
  const cohortDigest = contentId('MARKET_COHORT_READINESS/V1', identity);
  return {
    ...identity,
    subject_deal_key: f17.source_binding.governed_deal_key,
    cohort_digest: cohortDigest,
    cache_key: contentId('MARKET_COHORT_CACHE_CANDIDATE/V2', {
      serving_namespace_id: servingNamespaceId,
      corpus_release_id: corpusReleaseId,
      cohort_digest: cohortDigest,
      comparability_class_digest:
        identity.comparability_class_digest,
    }),
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
    query_plan: {
      execution_mode: 'ONE_INDEXED_SET_BASED_READ',
      broad_claim_or_card_loading: false,
      maximum_database_calls_per_request: 1,
      cache_scope:
        'RELEASE_METRIC_PARTY_FILTERS_AND_COMPARABILITY_CLASS',
      certification_state: 'UNCERTIFIED_DESIGN_INTENT',
    },
  };
}

function buildSharedRow({
  contractBundle,
  f17,
  corpusReleaseId,
  observation,
  cohort,
}) {
  const component = {
    component_occurrence_id: f17.result.component_occurrence_id,
    component_revision_id: f17.result.component_revision_id,
    component_slot_key: f17.result.value_slot_key,
    governed_ordinal: f17.result.ordinal,
    component_state: f17.claim.state,
    claim_occurrence_id: f17.claim.claim_occurrence_id,
    claim_revision_id: f17.claim.claim_revision_id,
    claim_definition_key: f17.claim.claim_definition_key,
    claim_definition_version: f17.claim.claim_definition_version,
    raw_value: f17.claim.raw_value,
    canonical_value: f17.claim.canonical_value,
    unit: f17.claim.unit,
    day_basis: f17.claim.day_basis,
    denominator: null,
    derivation_version: f17.claim.derivation_version,
      interpretation_projection:
        observation.interpretation_projection,
      comparability_class: observation.comparability_class,
  };
  const resultOccurrenceId = contentId(
    'DERIVED_RESULT_OCCURRENCE_READINESS/V1',
    {
      deal_admission_id: f17.source_binding.deal_admission_id,
      result_key: f17.result.result_key,
      result_version: f17.result.result_version,
      concept_key: f17.result.concept_key,
      party: f17.result.party,
      result_ordinal: 0,
    },
  );
  const resultRevisionId = contentId(
    'DERIVED_RESULT_REVISION_READINESS/V1',
    {
      derived_result_occurrence_id: resultOccurrenceId,
      component_revision_ids: [f17.result.component_revision_id],
      interpretation_projection_digest:
        observation.interpretation_projection
          .interpretation_projection_digest,
      result_completeness: 'COMPLETE',
      market_comparability:
        'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
    },
  );
  const rowServingKey = contentId(
    'RESULT_SERVING_ROW_READINESS/V1',
    {
      corpus_release_id: corpusReleaseId,
      derived_result_occurrence_id: resultOccurrenceId,
      interpretation_projection_digest:
        observation.interpretation_projection
          .interpretation_projection_digest,
    },
  );
  const body = {
    schema_version: 'SHARED_SERVING_ROW_READINESS/V1',
    row_kind: 'CANONICAL_RESULT',
    authority_scope: AUTHORITY_SCOPE,
    corpus_release_id: corpusReleaseId,
    governed_deal_key: f17.source_binding.governed_deal_key,
    deal_admission_id: f17.source_binding.deal_admission_id,
    row_serving_key: rowServingKey,
    provenance: {
      contract_fingerprint: contractBundle.fingerprint,
      metric_observation_occurrence_id:
        observation.metric_observation_occurrence_id,
      market_observation_serving_key:
        observation.market_observation_serving_key,
      owner_occurrence_id: f17.result.component_occurrence_id,
      owner_revision_id: f17.result.component_revision_id,
      interpretation_payload_id:
        f17.interpretation.interpretation_payload_id,
    },
    canonical_result: {
      result_key: f17.result.result_key,
      result_version: f17.result.result_version,
      concept_key: f17.result.concept_key,
      concept_version: 1,
      party: f17.result.party,
      result_completeness: 'COMPLETE',
      market_comparability:
        'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
      derived_result_occurrence_id: resultOccurrenceId,
      derived_result_revision_id: resultRevisionId,
      result_ordinal: 0,
      components: [component],
      presentation: {
        display_label: f17.presentation.display_label,
        display_value: f17.presentation.display_value,
        trigger_label: f17.presentation.trigger_label,
        ambiguity_warning_code:
          f17.presentation.ambiguity_warning_code,
        ambiguity_warning_text:
          f17.presentation.ambiguity_warning_text,
        lawyer_warning_required: true,
      },
      market_context: {
        subject_observation: {
          market_observation_serving_key:
            observation.market_observation_serving_key,
          canonical_value: observation.canonical_value,
          canonical_unit: observation.canonical_unit,
          basis_key: observation.basis_key,
          interpretation_projection:
            observation.interpretation_projection,
        },
        cohort: {
          cohort_digest: cohort.cohort_digest,
          counts: cohort.counts,
          distribution: cohort.distribution,
          exclusions: cohort.exclusions,
        },
        denominators: {
          prevalence: {
            kind: 'EXAMINED_ELIGIBLE_APPLICABLE_DEALS',
            deal_count: cohort.counts.examined_deals,
          },
          distribution: {
            kind: 'COMPARABLE_PRESENT_DEALS',
            deal_count: cohort.counts.distribution_deals,
          },
        },
      },
      source_detail_state: {
        state: 'UNAVAILABLE',
        reason_code:
          'ADMITTED_EXACT_SOURCE_RESOLVER_NOT_YET_BUILT',
      },
    },
  };
  return {
    ...body,
    canonical_payload_digest: contentId(
      'SHARED_SERVING_ROW_READINESS_PAYLOAD/V1',
      body,
    ),
  };
}

function buildExactDetail({
  f17,
  corpusReleaseId,
  row,
}) {
  const evidenceReferences = f17.claim.evidence.map((entry) => ({
    claim_evidence_id: entry.claim_evidence_id,
    evidence_role: entry.evidence_role,
    excerpt_id: entry.excerpt_id,
    document_hash: f17.source_binding.document_hash,
    document_ordinal: entry.document_ordinal,
    absolute_start: entry.absolute_start,
    absolute_end: entry.absolute_end,
    governed_ordinal: entry.ordinal,
  }));
  const responseBody = {
    schema_version:
      'RESULT_COMPOSITION_EVIDENCE_RESPONSE_CANDIDATE/V2',
    derived_result_occurrence_id:
      row.canonical_result.derived_result_occurrence_id,
    derived_result_revision_id:
      row.canonical_result.derived_result_revision_id,
    components: [{
      governed_ordinal: 0,
      component_slot_key: f17.result.value_slot_key,
      component_occurrence_id: f17.result.component_occurrence_id,
      component_revision_id: f17.result.component_revision_id,
      claim: f17.claim,
      interpretation: f17.interpretation,
    }],
    evidence_references: evidenceReferences,
    source_lineage: {
      immutable_source_document_id:
        f17.source_binding.immutable_source_document_id,
      source_admission_manifest_id:
        f17.source_binding.source_admission_manifest_id,
      deal_admission_id: f17.source_binding.deal_admission_id,
      document_hash: f17.source_binding.document_hash,
      canonical_text_id: f17.source_binding.canonical_text_id,
      source_ordinal: f17.source_binding.source_ordinal,
    },
    presentation: row.canonical_result.presentation,
  };
  const body = {
    schema_version: 'EXACT_DETAIL_READINESS_PACKAGE/V1',
    authority_scope: AUTHORITY_SCOPE,
    corpus_release_id: corpusReleaseId,
    parent_row_serving_key: row.row_serving_key,
    detail_kind: 'RESULT_COMPOSITION_EVIDENCE',
    response_body: responseBody,
    resolver_contract: {
      required: true,
      state: 'NOT_BUILT',
      required_outputs: [
        'EXACT_TEXT',
        'EXACT_BYTES_DIGEST',
        'VALIDATED_ADMITTED_SOURCE_LINEAGE',
      ],
    },
    response_body_digest: contentId(
      'SERVING_EXACT_DETAIL_RESPONSE_BODY_CANDIDATE/V2',
      responseBody,
    ),
  };
  return {
    ...body,
    source_detail_payload_id: contentId(
      'SERVING_EXACT_DETAIL_PAYLOAD_CANDIDATE/V2',
      body,
    ),
    canonical_payload_digest: contentId(
      'SERVING_EXACT_DETAIL_PAYLOAD_BODY_CANDIDATE/V2',
      body,
    ),
  };
}

function buildRelease({
  contractBundle,
  corpusReleaseId,
  servingNamespaceId,
  observation,
  row,
  exactDetail,
  cohort,
}) {
  const roots = {
    observation_root: digestSet(
      'CANDIDATE_OBSERVATION_ROOT/V2',
      [observation.canonical_payload_digest],
    ),
    shared_row_root: digestSet(
      'CANDIDATE_SHARED_ROW_ROOT/V2',
      [row.canonical_payload_digest],
    ),
    exact_detail_root: digestSet(
      'CANDIDATE_EXACT_DETAIL_ROOT/V2',
      [exactDetail.canonical_payload_digest],
    ),
    cohort_root: digestSet(
      'CANDIDATE_COHORT_ROOT/V2',
      [cohort.cohort_digest],
    ),
  };
  const manifestBody = {
    schema_version: 'CANDIDATE_RELEASE_READINESS_MANIFEST/V1',
    authority_scope: AUTHORITY_SCOPE,
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    contract_fingerprint: contractBundle.fingerprint,
    release_state: 'READINESS_ONLY_INACTIVE',
    counts: {
      deals: 1,
      metric_slots: 1,
      observations: 1,
      shared_rows: 1,
      exact_detail_packages: 1,
      unresolved: 0,
      failed: 0,
    },
    roots,
    cohort_identity_contract: {
      schema_version: 'MARKET_COHORT_READINESS/V1',
      comparability_class_required: true,
      comparability_class_digest:
        observation.comparability_class
          .comparability_class_digest,
      cache_key: cohort.cache_key,
    },
    certification_state: 'NOT_CERTIFIED',
    active_pointer_authority: 'NONE',
  };
  const manifest = {
    ...manifestBody,
    candidate_release_manifest_id: contentId(
      'CANDIDATE_RELEASE_READINESS_MANIFEST/V1',
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      'CANDIDATE_RELEASE_READINESS_MANIFEST_PAYLOAD/V1',
      manifestBody,
    ),
  };
  return {
    schema_version: 'CANDIDATE_RELEASE_READINESS_BUNDLE/V1',
    manifest,
    market_observations: [observation],
    shared_rows: [row],
    exact_detail_packages: [exactDetail],
    cohort_certificates: [cohort],
  };
}

function buildQxoNoShopCopyDeliveryServingF18({
  contract_bundle: contractBundle,
  qxo_no_shop_copy_delivery_claim_f17: suppliedF17,
} = {}) {
  const f17 = requireF17(contractBundle, suppliedF17);
  const corpusReleaseId = contentId(
    'CANDIDATE_CORPUS_RELEASE_OCCURRENCE/V2',
    {
      release_version: RELEASE_VERSION,
      contract_fingerprint: contractBundle.fingerprint,
      source_f17_id: F17_ID,
      source_f17_digest: F17_DIGEST,
    },
  );
  const servingNamespaceId = contentId(
    'CANDIDATE_SERVING_NAMESPACE/V2',
    {
      corpus_release_id: corpusReleaseId,
      authority_scope: AUTHORITY_SCOPE,
    },
  );
  const interpretationProjection = buildInterpretationProjection(f17);
  const comparabilityClass = buildComparabilityClass(f17);
  const observation = buildObservation({
    contractBundle,
    f17,
    corpusReleaseId,
    interpretationProjection,
    comparabilityClass,
  });
  const cohort = buildCohort({
    contractBundle,
    f17,
    corpusReleaseId,
    servingNamespaceId,
    observation,
    comparabilityClass,
  });
  const row = buildSharedRow({
    contractBundle,
    f17,
    corpusReleaseId,
    observation,
    cohort,
  });
  const exactDetail = buildExactDetail({
    f17,
    corpusReleaseId,
    row,
  });
  const release = buildRelease({
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    observation,
    row,
    exactDetail,
    cohort,
  });
  const body = {
    schema_version: 'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18/V1',
    authority_scope: AUTHORITY_SCOPE,
    upstream_binding: {
      qxo_no_shop_copy_delivery_claim_f17_id: F17_ID,
      qxo_no_shop_copy_delivery_claim_f17_payload_digest: F17_DIGEST,
    },
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    observation,
    cohort,
    shared_row: row,
    exact_detail_package: exactDetail,
    candidate_release: release,
    status: {
      candidate_projection_authority: 'NONE',
      candidate_release_authority: 'NONE',
      active_serving_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'CANONICAL_CANDIDATE_CONTRACT_INTEGRATION_REQUIRED',
        'ADMITTED_EXACT_SOURCE_RESOLVER_REQUIRED',
        'INDEXED_QUERY_EXECUTOR_CERTIFICATION_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    qxo_no_shop_copy_delivery_serving_f18_id: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoNoShopCopyDeliveryServingF18({
  qxo_no_shop_copy_delivery_serving_f18: candidate,
  ...inputs
} = {}) {
  const expected = buildQxoNoShopCopyDeliveryServingF18(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F18 serving carrier has drifted');
  }
  requireDigest(candidate.corpus_release_id, 'corpus_release_id');
  requireDigest(candidate.serving_namespace_id, 'serving_namespace_id');
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  METRIC_KEY,
  RELEASE_VERSION,
  buildComparabilityClass,
  buildQxoNoShopCopyDeliveryServingF18,
  validateQxoNoShopCopyDeliveryServingF18,
};
