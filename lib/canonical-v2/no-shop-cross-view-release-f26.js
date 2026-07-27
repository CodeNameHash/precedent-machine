const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  compileFixtureContractV12,
} = require('./contract-bundle');
const {
  resolveMetricServingAdmission,
} = require('./metric-serving-admission');
const {
  validateMetricScopedCandidateReleaseF23,
} = require('./metric-scoped-candidate-release-f23');
const {
  F23_MANIFEST_ID,
  F24_BUNDLE_DIGEST,
  F24_BUNDLE_ID,
  F24_MANIFEST_DIGEST,
  F24_MANIFEST_ID,
  F24_REGISTRY_ID,
  validateF24EnvelopeIdentity,
} = require('./no-shop-timing-certification-f24');
const {
  FILTER_KEYS,
  F25_BUNDLE_DIGEST,
  F25_BUNDLE_ID,
  F25_MANIFEST_DIGEST,
  F25_MANIFEST_ID,
  F25_REGISTRY_ID,
  validateF25EnvelopeIdentity,
} = require('./no-shop-actions-certification-f25');

const SHA256_RE = /^[a-f0-9]{64}$/;
const CANONICAL_DECIMAL_RE =
  /^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/;
const AUTHORITY_SCOPE =
  'OFFLINE_QXO_NO_SHOP_CROSS_VIEW_RELEASE_F26_ONLY';
const F23_BUNDLE_ID =
  '17964307fe57cf7292bb036e66e2d031feffc15ebcc7098249d1edb5510cc27c';
const F23_MANIFEST_DIGEST =
  'b995e985fbda8bc4be45bee5d7a4af424bebe3767b6c72bc7a1d8785730aa9b1';
const F26_RELEASE_ID =
  'fa473759f199a569ad9e9552c9da304c8f825685c2be255dd6018a0e3689381e';
const F26_RELEASE_DIGEST =
  '6fe12ec44c8ce718064f02b5c4086dd2df0139d3e0dde7777880a634a45507af';
const F26_MANIFEST_ID =
  '71ef26a1541f5e1f8ba3899e295d5f700bd80cce60b3ca13f3ee10e0d90c8afc';
const F26_MANIFEST_DIGEST =
  'c122a8582c9cc5e62ac2fc4cdee9bdd0ffb6eaf3db335f677dbc653e17bf6c22';
const F26_REGISTRY_ID =
  '3c635872c3f6fa738a19c1424520c05871c8cbabe1fbd0f2b2808c9e9e2229ca';
const F26_PROVISION_ROW_ID =
  'da5c653185e6520c755e8f75c4f7123a9035f9e4fe486dfa675658668b6853c8';
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const AUTHORITY_NONE = Object.freeze({
  active_release_authority: 'NONE',
  active_query_authority: 'NONE',
  active_pointer_authority: 'NONE',
  corpus_write_authority: 'NONE',
  production_activation_authority: 'NONE',
});
const METRIC_PRESENTATION = Object.freeze({
  NO_SHOP_COPY_DELIVERY_PERIOD_DAYS: Object.freeze({
    section: 'TIMING',
    label: 'Copy-delivery period',
    comparison_kind: 'DURATION',
    ordinal: 0,
  }),
  NO_SHOP_NOTICE_PERIOD_DAYS: Object.freeze({
    section: 'TIMING',
    label: 'Proposal notice period',
    comparison_kind: 'DURATION',
    ordinal: 1,
  }),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze({
    section: 'TIMING',
    label: 'Initial matching period',
    comparison_kind: 'DURATION',
    ordinal: 2,
  }),
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: Object.freeze({
    section: 'TIMING',
    label: 'Subsequent matching period',
    comparison_kind: 'DURATION',
    ordinal: 3,
  }),
  NO_SHOP_PROHIBITED_ACTION: Object.freeze({
    section: 'RESTRICTIONS',
    label: 'Prohibited actions',
    comparison_kind: 'CATEGORICAL_MULTI_SELECT',
    ordinal: 4,
  }),
  NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER: Object.freeze({
    section: 'RESTRICTIONS',
    label: 'Knowledge qualifiers by action',
    comparison_kind: 'CATEGORICAL_MULTI_SELECT',
    ordinal: 5,
  }),
  NO_SHOP_EXCEPTION_PREREQUISITE: Object.freeze({
    section: 'EXCEPTIONS',
    label: 'Exception prerequisites',
    comparison_kind: 'CATEGORICAL_MULTI_SELECT',
    ordinal: 6,
  }),
  NO_SHOP_EXCEPTION_EFFECT: Object.freeze({
    section: 'EXCEPTIONS',
    label: 'Permitted exception effects',
    comparison_kind: 'CATEGORICAL_MULTI_SELECT',
    ordinal: 7,
  }),
  NO_SHOP_INLINE_PERMISSION_EFFECT: Object.freeze({
    section: 'EXCEPTIONS',
    label: 'Inline permissions',
    comparison_kind: 'CATEGORICAL_MULTI_SELECT',
    ordinal: 8,
  }),
});
const DEFAULT_FILTERS = Object.freeze(
  Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
);
const MAX_EXECUTION_RESULT_BYTES = 1024 * 1024;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new TypeError(`${label} must be a sha256 digest`);
  }
  return value;
}

function exactKeys(value, keys) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function sortedUniqueDigests(values, label) {
  if (!Array.isArray(values)
    || values.length < 1
    || values.length > 256
    || values.some((value) => !SHA256_RE.test(value))
    || new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson([...values].sort())) {
    throw new TypeError(`${label} must be a sorted unique digest set`);
  }
  return values;
}

function humanise(value) {
  const text = String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length ? `${text[0].toUpperCase()}${text.slice(1)}` : '';
}

function warning(value) {
  return {
    required: Boolean(value?.required),
    code: value?.code || null,
    text: value?.text || null,
  };
}

function validateInputs({
  f23_candidate_release: f23,
  f24_timing_certification: f24,
  f25_actions_certification: f25,
} = {}) {
  validateMetricScopedCandidateReleaseF23(f23);
  validateF24EnvelopeIdentity(f24);
  validateF25EnvelopeIdentity(f25);
  if (f23.metric_scoped_candidate_release_bundle_id !== F23_BUNDLE_ID
    || f23.manifest.candidate_release_manifest_id !== F23_MANIFEST_ID
    || f23.manifest.canonical_payload_digest !== F23_MANIFEST_DIGEST
    || f24.predecessor_manifest.candidate_release_manifest_id
      !== f23.manifest.candidate_release_manifest_id
    || f24.predecessor_manifest.canonical_payload_digest
      !== f23.manifest.canonical_payload_digest
    || f25.predecessor_manifest
      .no_shop_timing_certification_manifest_f24_id
      !== f24.manifest.no_shop_timing_certification_manifest_f24_id
    || f25.predecessor_manifest.canonical_payload_digest
      !== f24.manifest.canonical_payload_digest
    || f25.registry.admission_records.length !== 9
    || f25.manifest.metric_serving_admission_ids.length !== 9) {
    throw new TypeError('F26 predecessor chain is not exact');
  }
  const admissionIds = f25.registry.admission_records.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  if (canonicalJson(admissionIds)
      !== canonicalJson(f25.manifest.metric_serving_admission_ids)) {
    throw new TypeError('F26 admission registry does not equal the F25 manifest');
  }
  return { f23, f24, f25 };
}

function sourceProof({
  stage,
  admission,
  carrierId,
  carrierDigest,
  sourceReferenceId,
}) {
  const body = {
    schema_version: 'F26_METRIC_ORIGIN_PROOF/V1',
    source_stage: stage,
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    source_carrier_id: carrierId,
    source_carrier_payload_digest: carrierDigest,
    source_reference_id: sourceReferenceId,
  };
  return {
    ...body,
    metric_origin_proof_id: contentId(
      'F26_METRIC_ORIGIN_PROOF/V1',
      body,
    ),
  };
}

function certificationMarketContext(context) {
  const suppressedSubjectCount =
    context.counts.comparable_deals;
  return {
    cohort_scope:
      'SINGLE_SELECTED_DEAL_CERTIFICATION_PREVIEW',
    subject_deal_included: true,
    independent_comparable_deals: 0,
    selected_deal_observations_suppressed:
      suppressedSubjectCount,
    counts: {
      ...clone(context.counts),
      comparable_deals: 0,
      excluded_deals:
        context.counts.excluded_deals
        + suppressedSubjectCount,
      ...(Object.prototype.hasOwnProperty.call(
        context.counts,
        'distribution_deals',
      )
        ? { distribution_deals: 0 }
        : {}),
    },
    distribution: [],
    exclusions: [{
      reason_code:
        'SELECTED_DEAL_ONLY_NOT_INDEPENDENT_MARKET_EVIDENCE',
      deal_count: suppressedSubjectCount,
    }],
  };
}

function subrow(body) {
  return {
    ...body,
    subrow_id: contentId('NO_SHOP_METRIC_SUBROW_F26/V1', body),
  };
}

function copyDeliverySubrow(validated, admission) {
  const { f23 } = validated;
  const row = f23.shared_rows[0];
  const component = row.canonical_result.components[0];
  const query = f23.query_records[0];
  const cohort = f23.cohort_results[0];
  const presentation =
    METRIC_PRESENTATION.NO_SHOP_COPY_DELIVERY_PERIOD_DAYS;
  const origin = sourceProof({
    stage: 'F23',
    admission,
    carrierId: f23.manifest.candidate_release_manifest_id,
    carrierDigest: f23.manifest.canonical_payload_digest,
    sourceReferenceId: row.row_serving_key,
  });
  return subrow({
    schema_version: 'NO_SHOP_METRIC_SUBROW_F26/V1',
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_definition_id: admission.metric_definition_id,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    concept_key: admission.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
    section: presentation.section,
    display_ordinal: presentation.ordinal,
    label: presentation.label,
    comparison_kind: presentation.comparison_kind,
    party: clone(query.party),
    state: component.component_state,
    comparability_state:
      'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
    comparability_class_digest:
      query.comparability_class_digest,
    grouping_dimensions: [],
    comparison_contract: {
      value_type: 'NON_NEGATIVE_CANONICAL_DECIMAL',
      allowed_canonical_values: null,
      grouping_dimension_codebooks: {},
      governed_grouping_tuples: null,
    },
    subject: {
      raw_value: component.raw_value,
      canonical_value: component.canonical_value,
      canonical_unit: query.canonical_unit,
      day_basis: query.day_basis,
      basis_key: query.basis_key,
      legal_trigger: clone(query.primary_semantic_class),
      items: [],
    },
    market_context: certificationMarketContext(cohort),
    clarity_state: query.clarity_state,
    ambiguity_dimension_codes:
      clone(query.ambiguity_dimension_codes),
    lawyer_warning: warning(query.lawyer_warning),
    source: {
      state: query.source_action_state,
      document_hash:
        validated.f24.timing_certifications[0]
          .observation.document_hash,
      evidence_reference_ids:
        clone(component.comparability_context
          .governing_evidence_excerpt_ids),
      source_detail_reference_id: row.row_serving_key,
      origin_proof: origin,
    },
  });
}

function timingSubrow(carrier, admission) {
  const observation = carrier.observation;
  const query = carrier.query_projection;
  const presentation = METRIC_PRESENTATION[observation.metric_key];
  const origin = sourceProof({
    stage: 'F24',
    admission,
    carrierId: carrier.timing_metric_certification_id,
    carrierDigest: carrier.canonical_payload_digest,
    sourceReferenceId: observation.claim_revision_id,
  });
  return subrow({
    schema_version: 'NO_SHOP_METRIC_SUBROW_F26/V1',
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_definition_id: admission.metric_definition_id,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    concept_key: admission.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
    section: presentation.section,
    display_ordinal: presentation.ordinal,
    label: presentation.label,
    comparison_kind: presentation.comparison_kind,
    party: clone(observation.party),
    state: observation.state,
    comparability_state: observation.comparability_state,
    comparability_class_digest:
      observation.comparability_class_digest,
    grouping_dimensions: [],
    comparison_contract: {
      value_type: 'NON_NEGATIVE_CANONICAL_DECIMAL',
      allowed_canonical_values: null,
      grouping_dimension_codebooks: {},
      governed_grouping_tuples: null,
    },
    subject: {
      raw_value: clone(observation.raw_value),
      canonical_value: observation.canonical_value,
      canonical_unit: observation.canonical_unit,
      day_basis: observation.day_basis,
      basis_key: observation.basis_key,
      legal_trigger: clone(observation.source_legal_trigger),
      items: [],
    },
    market_context:
      certificationMarketContext(carrier.cohort_result),
    clarity_state: query.clarity_state,
    ambiguity_dimension_codes:
      clone(query.ambiguity_dimension_codes),
    lawyer_warning:
      warning(carrier.interpretation_policy.lawyer_warning),
    source: {
      state: query.source_action_state,
      document_hash: observation.document_hash,
      evidence_reference_ids:
        observation.evidence.map((entry) => entry.excerpt_id).sort(),
      source_detail_reference_id:
        observation.claim_revision_id,
      origin_proof: origin,
    },
  });
}

function itemSource(item) {
  const sourceOccurrenceIds = [
    ...(Array.isArray(item.source_occurrence_ids)
      ? item.source_occurrence_ids
      : []),
    ...(Array.isArray(item.occurrences)
      ? item.occurrences.map(
        (entry) => entry.action_occurrence_id,
      )
      : []),
  ].filter((value) => SHA256_RE.test(value || ''));
  const evidence = item.evidence
    || item.source_action_evidence
    || item.occurrences?.flatMap((entry) => entry.evidence || [])
    || [];
  return {
    source_occurrence_ids:
      [...new Set(sourceOccurrenceIds)].sort(),
    source_action_item_id:
      SHA256_RE.test(item.source_action_item_id || '')
        ? item.source_action_item_id
        : null,
    evidence_root:
      SHA256_RE.test(item.evidence_root || '')
        ? item.evidence_root
        : contentId(
          'F26_CATEGORICAL_ITEM_EVIDENCE_ROOT/V1',
          evidence.map((entry) => ({
            excerpt_id: entry.excerpt_id,
            absolute_start: entry.absolute_start,
            absolute_end: entry.absolute_end,
            exact_bytes_digest: entry.exact_bytes_digest,
          })),
        ),
    source_binding_id:
      SHA256_RE.test(item.source_binding_id || '')
        ? item.source_binding_id
        : null,
  };
}

function categoricalSemanticContext(item) {
  if (item.action_code) {
    return {
      action_code: item.action_code,
    };
  }
  if (item.prerequisite_class) {
    return {
      prerequisite_class: item.prerequisite_class,
      applies_to_effect_keys:
        clone(item.applies_to_effect_keys || []),
    };
  }
  if (item.effect_key) {
    return {
      effect_key: item.effect_key,
      direct_source_effect_key:
        item.direct_source_effect_key,
      affected_action_code:
        item.affected_action_code,
      affected_action_endpoints:
        clone(item.affected_action_endpoints),
      derivation_mode: item.derivation_mode,
      temporal_start: item.temporal_start,
      temporal_end: item.temporal_end,
      precedence_code: item.precedence_code,
      governing_notice_dependency:
        item.governing_notice_dependency,
      governing_notice_obligation_revision_id:
        item.governing_notice_obligation_revision_id,
      relationship_materialisation_state:
        item.relationship_materialisation_state,
      shared_prerequisite_source_binding_ids:
        clone(item.shared_prerequisite_source_binding_ids),
      action_specific_prerequisite_source_binding_ids:
        clone(
          item.action_specific_prerequisite_source_binding_ids,
        ),
    };
  }
  if (item.permitted_action_code) {
    return {
      permitted_action_code:
        item.permitted_action_code,
      permitted_actor_party:
        clone(item.permitted_actor_party),
      information_subject_code:
        item.information_subject_code,
      temporal_scope_inheritance:
        item.temporal_scope_inheritance,
      qualified_action_outcomes:
        clone(item.qualified_action_outcomes),
      prerequisite_codes:
        clone(item.prerequisite_codes),
    };
  }
  return {};
}

function categoricalItem(item, dimensions) {
  const grouping = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      item[dimension] ?? null,
    ]),
  );
  return {
    item_id: item.item_id,
    state: item.state,
    canonical_value: clone(item.canonical_value),
    label: humanise(item.canonical_value),
    grouping,
    semantic_context: categoricalSemanticContext(item),
    lawyer_warning: warning(item.lawyer_warning),
    source: itemSource(item),
  };
}

function categoricalSubrow(carrier, admission) {
  const observation = carrier.observation;
  const query = carrier.query_projection;
  const presentation = METRIC_PRESENTATION[observation.metric_key];
  const dimensions =
    clone(carrier.metric_definition.grouping_dimensions);
  const origin = sourceProof({
    stage: 'F25',
    admission,
    carrierId: carrier.categorical_metric_certification_id,
    carrierDigest: carrier.canonical_payload_digest,
    sourceReferenceId: observation.item_root,
  });
  return subrow({
    schema_version: 'NO_SHOP_METRIC_SUBROW_F26/V1',
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_definition_id: admission.metric_definition_id,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    concept_key: admission.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
    section: presentation.section,
    display_ordinal: presentation.ordinal,
    label: presentation.label,
    comparison_kind: presentation.comparison_kind,
    party: clone(observation.party),
    state: observation.state,
    comparability_state: observation.comparability_state,
    comparability_class_digest: contentId(
      'F26_CATEGORICAL_COMPARABILITY_CLASS/V1',
      {
        metric_definition_id: admission.metric_definition_id,
        party: observation.party,
        grouping_dimensions: dimensions,
        interpretation_policy_digest:
          carrier.interpretation_policy
            .interpretation_policy_digest,
      },
    ),
    grouping_dimensions: dimensions,
    comparison_contract: {
      value_type: 'CLOSED_CANONICAL_CODE',
      allowed_canonical_values:
        clone(carrier.metric_definition.allowed_canonical_values),
      grouping_dimension_codebooks:
        clone(
          carrier.metric_definition
            .grouping_dimension_codebooks,
        ),
      governed_grouping_tuples:
        observation.items.map((item) => ({
          canonical_value:
            typeof item.canonical_value === 'string'
              ? item.canonical_value
              : canonicalJson(item.canonical_value),
          ...Object.fromEntries(dimensions.map(
            (dimension) => [
              dimension,
              item[dimension] ?? null,
            ],
          )),
        })).sort((left, right) => (
          canonicalJson(left).localeCompare(canonicalJson(right))
        )),
    },
    subject: {
      raw_value: null,
      canonical_value: null,
      canonical_unit: observation.canonical_unit,
      day_basis: null,
      basis_key: null,
      legal_trigger: null,
      items: observation.items.map(
        (item) => categoricalItem(item, dimensions),
      ),
    },
    market_context:
      certificationMarketContext(carrier.cohort_result),
    clarity_state: observation.items.some(
      (item) => item.lawyer_warning?.required,
    )
      ? 'ITEM_LEVEL_LAWYER_REVIEW_REQUIRED'
      : 'CLEAR',
    ambiguity_dimension_codes: [],
    lawyer_warning: warning(null),
    source: {
      state: query.source_action_state,
      document_hash: observation.document_hash,
      evidence_reference_ids: [],
      source_detail_reference_id: observation.item_root,
      origin_proof: origin,
    },
  });
}

function buildSubrows(validated) {
  const admissionByMetric = new Map(
    validated.f25.registry.admission_records.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const rows = [
    copyDeliverySubrow(
      validated,
      admissionByMetric.get(
        'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
      ),
    ),
    ...validated.f24.timing_certifications.map(
      (carrier) => timingSubrow(
        carrier,
        admissionByMetric.get(carrier.observation.metric_key),
      ),
    ),
    ...validated.f25.categorical_certifications.map(
      (carrier) => categoricalSubrow(
        carrier,
        admissionByMetric.get(carrier.observation.metric_key),
      ),
    ),
  ].sort((left, right) => (
    left.display_ordinal - right.display_ordinal
  ));
  if (rows.length !== 9
    || new Set(rows.map((row) => row.metric_key)).size !== 9
    || rows.some((row, index) => row.display_ordinal !== index)) {
    throw new TypeError('F26 no-shop metric subrow inventory is not exact');
  }
  return rows;
}

function buildAdmissionRegistry(validated) {
  const records = clone(
    validated.f25.registry.admission_records,
  );
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION_REGISTRY/V4',
    authority_scope: AUTHORITY_SCOPE,
    predecessor_registry_id: F25_REGISTRY_ID,
    contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V12,
    later_contract_default: 'DENY',
    admission_records: records,
    wildcard_admission_authority: 'NONE',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  return {
    ...body,
    metric_serving_admission_registry_id: contentId(
      'METRIC_SERVING_ADMISSION_REGISTRY/V4',
      body,
    ),
  };
}

function buildProvisionRow(validated, subrows) {
  const source = subrows[0].source;
  const body = {
    schema_version: 'NO_SHOP_SHARED_PROVISION_ROW/V1',
    governed_deal_key:
      validated.f25.categorical_certifications[0]
        .observation.governed_deal_key,
    document_hash: source.document_hash,
    provision_key: 'NO_SHOP_NON_SOLICIT_RESTRICTION',
    label: 'No-shop / non-solicit restriction',
    party_scope: 'MULTI_PARTY_SUBROWS',
    market_comparability:
      'COMPARABLE_BY_EXACT_METRIC_SUBROW_ONLY',
    generic_no_market_data_authority: 'NONE',
    local_failure_isolation: 'REQUIRED',
    subrows,
  };
  return {
    ...body,
    provision_row_id: contentId(
      'NO_SHOP_SHARED_PROVISION_ROW/V1',
      body,
    ),
  };
}

function buildManifest(validated, registry, provisionRow) {
  const admissionIds = registry.admission_records.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  const body = {
    schema_version:
      'NO_SHOP_CROSS_VIEW_RELEASE_MANIFEST_F26/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_state: 'INACTIVE_CANDIDATE',
    activation_eligibility:
      'INELIGIBLE_EXPLICIT_ACTIVATION_REQUIRED',
    contract_fingerprint:
      FIXTURE_CONTRACT_FINGERPRINT_V12,
    predecessor_chain: {
      f23_bundle_id: F23_BUNDLE_ID,
      f23_manifest_id: F23_MANIFEST_ID,
      f23_manifest_payload_digest: F23_MANIFEST_DIGEST,
      f24_bundle_id: F24_BUNDLE_ID,
      f24_bundle_payload_digest: F24_BUNDLE_DIGEST,
      f24_manifest_id: F24_MANIFEST_ID,
      f24_manifest_payload_digest: F24_MANIFEST_DIGEST,
      f24_registry_id: F24_REGISTRY_ID,
      f25_bundle_id: F25_BUNDLE_ID,
      f25_bundle_payload_digest: F25_BUNDLE_DIGEST,
      f25_manifest_id: F25_MANIFEST_ID,
      f25_manifest_payload_digest: F25_MANIFEST_DIGEST,
      f25_registry_id: F25_REGISTRY_ID,
    },
    metric_serving_admission_registry_id:
      registry.metric_serving_admission_registry_id,
    metric_serving_admission_ids: admissionIds,
    provision_row_id: provisionRow.provision_row_id,
    counts: {
      admissions: 9,
      deals: 1,
      provision_rows: 1,
      metric_subrows: 9,
      timing_subrows: 4,
      categorical_subrows: 5,
      surface_bindings: 4,
    },
    roots: {
      admission_root: contentId(
        'F26_METRIC_SERVING_ADMISSION_ROOT/V1',
        admissionIds,
      ),
      metric_subrow_root: contentId(
        'F26_NO_SHOP_METRIC_SUBROW_ROOT/V1',
        provisionRow.subrows.map((row) => row.subrow_id),
      ),
      origin_proof_root: contentId(
        'F26_METRIC_ORIGIN_PROOF_ROOT/V1',
        provisionRow.subrows.map(
          (row) => row.source.origin_proof.metric_origin_proof_id,
        ),
      ),
    },
    serving_plan: {
      database_calls_per_request: 1,
      database_call_growth_with_corpus_size: 'CONSTANT',
      request_shape: 'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
      cache_scope:
        'RELEASE_COHORT_FILTERS_SORTED_ADMISSION_SET',
      broad_claim_or_card_loading: false,
      immediate_retries: 0,
    },
    authority: clone(AUTHORITY_NONE),
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'F26_BROWSER_ACCEPTANCE_REQUIRED',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return {
    ...body,
    no_shop_cross_view_release_manifest_f26_id:
      contentId(
        'NO_SHOP_CROSS_VIEW_RELEASE_MANIFEST_F26/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'NO_SHOP_CROSS_VIEW_RELEASE_MANIFEST_F26_PAYLOAD/V1',
      body,
    ),
  };
}

function buildSurfaceBindings(releaseId, manifest, provisionRow) {
  return Object.fromEntries(SURFACES.map((surface) => [
    surface,
    {
      schema_version: 'F26_NO_SHOP_SURFACE_BINDING/V1',
      surface,
      release_id: releaseId,
      release_manifest_id:
        manifest.no_shop_cross_view_release_manifest_f26_id,
      provision_row_id: provisionRow.provision_row_id,
      provision_row: provisionRow,
      serving_role: 'INACTIVE_STAGING_ACCEPTANCE_ONLY',
      market_cohort_eligible: true,
    },
  ]));
}

function buildNoShopCrossViewReleaseF26(input = {}) {
  const validated = validateInputs(input);
  const registry = buildAdmissionRegistry(validated);
  const subrows = buildSubrows(validated);
  const provisionRow = buildProvisionRow(validated, subrows);
  const manifest = buildManifest(
    validated,
    registry,
    provisionRow,
  );
  const releaseId = contentId(
    'NO_SHOP_CROSS_VIEW_RELEASE_F26/V1',
    {
      release_manifest_id:
        manifest.no_shop_cross_view_release_manifest_f26_id,
      release_manifest_payload_digest:
        manifest.canonical_payload_digest,
      provision_row_id: provisionRow.provision_row_id,
    },
  );
  const surfaceBindings = buildSurfaceBindings(
    releaseId,
    manifest,
    provisionRow,
  );
  const body = {
    schema_version:
      'NO_SHOP_CROSS_VIEW_RELEASE_BUNDLE_F26/V1',
    authority_scope: AUTHORITY_SCOPE,
    admission_registry: registry,
    provision_row: provisionRow,
    surface_bindings: surfaceBindings,
    manifest,
  };
  const release = {
    ...body,
    no_shop_cross_view_release_f26_id: releaseId,
    canonical_payload_digest: contentId(
      'NO_SHOP_CROSS_VIEW_RELEASE_BUNDLE_F26_PAYLOAD/V1',
      body,
    ),
  };
  validateNoShopCrossViewReleaseF26(release);
  validateAllMetricServingAdmissionsF26(release);
  return freeze(release);
}

function validateAdmissionRecord(admission) {
  if (admission.schema_version !== 'METRIC_SERVING_ADMISSION/V1'
    || admission.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || admission.metric_serving_admission_id
      !== contentId(
        'METRIC_SERVING_ADMISSION/V1',
        Object.fromEntries(Object.entries(admission).filter(
          ([key]) => key !== 'metric_serving_admission_id',
        )),
      )
    || admission.authority.active_release_authority !== 'NONE'
    || admission.authority.production_activation_authority !== 'NONE') {
    throw new TypeError('F26 admission record identity is invalid');
  }
}

function validateSubrow(row, admission) {
  const { subrow_id: subrowId, ...body } = row || {};
  requireDigest(subrowId, 'subrow_id');
  if (!admission
    || subrowId !== contentId(
      'NO_SHOP_METRIC_SUBROW_F26/V1',
      body,
    )
    || row.schema_version !== 'NO_SHOP_METRIC_SUBROW_F26/V1'
    || row.metric_key !== admission.metric_key
    || row.metric_version !== admission.metric_version
    || row.metric_definition_id !== admission.metric_definition_id
    || row.metric_serving_admission_id
      !== admission.metric_serving_admission_id
    || row.concept_key !== admission.concept_key
    || row.required_claim_definition_key
      !== admission.required_claim_definition_key
    || !METRIC_PRESENTATION[row.metric_key]
    || row.display_ordinal
      !== METRIC_PRESENTATION[row.metric_key].ordinal
    || row.label !== METRIC_PRESENTATION[row.metric_key].label
    || row.comparison_kind
      !== METRIC_PRESENTATION[row.metric_key].comparison_kind
    || row.section !== METRIC_PRESENTATION[row.metric_key].section
    || row.state !== 'PRESENT'
    || row.source.state !== 'AVAILABLE'
    || row.source.origin_proof.metric_key !== row.metric_key
    || row.source.origin_proof.metric_serving_admission_id
      !== row.metric_serving_admission_id
    || row.market_context.cohort_scope
      !== 'SINGLE_SELECTED_DEAL_CERTIFICATION_PREVIEW'
    || row.market_context.subject_deal_included !== true
    || row.market_context.independent_comparable_deals !== 0
    || row.source.origin_proof.metric_origin_proof_id
      !== contentId(
        'F26_METRIC_ORIGIN_PROOF/V1',
        Object.fromEntries(
          Object.entries(row.source.origin_proof).filter(
            ([key]) => key !== 'metric_origin_proof_id',
          ),
        ),
      )) {
    throw new TypeError('F26 metric subrow identity is invalid');
  }
  if (row.comparison_kind === 'DURATION') {
    if (row.subject.items.length !== 0
      || row.subject.canonical_unit !== 'DAYS'
      || row.comparison_contract.value_type
        !== 'NON_NEGATIVE_CANONICAL_DECIMAL'
      || row.comparison_contract.allowed_canonical_values !== null
      || row.comparison_contract.governed_grouping_tuples !== null
      || !['ELAPSED', 'BUSINESS'].includes(
        row.subject.day_basis,
      )) {
      throw new TypeError('F26 duration subrow is invalid');
    }
  } else if (!Array.isArray(row.subject.items)
    || row.subject.items.length < 1
    || row.comparison_contract.value_type
      !== 'CLOSED_CANONICAL_CODE'
    || !Array.isArray(
      row.comparison_contract.allowed_canonical_values,
    )
    || !Array.isArray(
      row.comparison_contract.governed_grouping_tuples,
    )
    || row.subject.items.some(
      (item) => !SHA256_RE.test(item.item_id || '')
        || item.state !== 'PRESENT'
        || !SHA256_RE.test(item.source.evidence_root || '')
        || !item.semantic_context,
    )) {
    throw new TypeError('F26 categorical subrow is invalid');
  }
}

function validateNoShopCrossViewReleaseF26(release) {
  if (!release
    || release.schema_version
      !== 'NO_SHOP_CROSS_VIEW_RELEASE_BUNDLE_F26/V1'
    || release.authority_scope !== AUTHORITY_SCOPE) {
    throw new TypeError('invalid F26 cross-view release');
  }
  const registry = release.admission_registry;
  const manifest = release.manifest;
  const provisionRow = release.provision_row;
  if (registry.schema_version
      !== 'METRIC_SERVING_ADMISSION_REGISTRY/V4'
    || registry.predecessor_registry_id !== F25_REGISTRY_ID
    || registry.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V12
    || registry.admission_records?.length !== 9
    || registry.metric_serving_admission_registry_id
      !== contentId(
        'METRIC_SERVING_ADMISSION_REGISTRY/V4',
        Object.fromEntries(Object.entries(registry).filter(
          ([key]) => key
            !== 'metric_serving_admission_registry_id',
        )),
      )
    || registry.metric_serving_admission_registry_id
      !== F26_REGISTRY_ID) {
    throw new TypeError('invalid F26 admission registry');
  }
  registry.admission_records.forEach(validateAdmissionRecord);
  const admissionsByMetric = new Map(
    registry.admission_records.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  if (admissionsByMetric.size !== 9
    || provisionRow.subrows?.length !== 9) {
    throw new TypeError('F26 metric inventory is not exact');
  }
  provisionRow.subrows.forEach(
    (row) => validateSubrow(
      row,
      admissionsByMetric.get(row.metric_key),
    ),
  );
  const provisionBody = clone(provisionRow);
  delete provisionBody.provision_row_id;
  if (provisionRow.provision_row_id
      !== contentId(
        'NO_SHOP_SHARED_PROVISION_ROW/V1',
        provisionBody,
      )
    || provisionRow.provision_row_id
      !== F26_PROVISION_ROW_ID
    || provisionRow.generic_no_market_data_authority !== 'NONE'
    || provisionRow.local_failure_isolation !== 'REQUIRED') {
    throw new TypeError('invalid F26 no-shop provision row');
  }
  const admissionIds = registry.admission_records.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  sortedUniqueDigests(admissionIds, 'F26 admission IDs');
  const expectedPredecessorChain = {
    f23_bundle_id: F23_BUNDLE_ID,
    f23_manifest_id: F23_MANIFEST_ID,
    f23_manifest_payload_digest: F23_MANIFEST_DIGEST,
    f24_bundle_id: F24_BUNDLE_ID,
    f24_bundle_payload_digest: F24_BUNDLE_DIGEST,
    f24_manifest_id: F24_MANIFEST_ID,
    f24_manifest_payload_digest: F24_MANIFEST_DIGEST,
    f24_registry_id: F24_REGISTRY_ID,
    f25_bundle_id: F25_BUNDLE_ID,
    f25_bundle_payload_digest: F25_BUNDLE_DIGEST,
    f25_manifest_id: F25_MANIFEST_ID,
    f25_manifest_payload_digest: F25_MANIFEST_DIGEST,
    f25_registry_id: F25_REGISTRY_ID,
  };
  if (manifest.schema_version
      !== 'NO_SHOP_CROSS_VIEW_RELEASE_MANIFEST_F26/V1'
    || manifest.release_state !== 'INACTIVE_CANDIDATE'
    || manifest.activation_eligibility
      !== 'INELIGIBLE_EXPLICIT_ACTIVATION_REQUIRED'
    || canonicalJson(manifest.predecessor_chain)
      !== canonicalJson(expectedPredecessorChain)
    || canonicalJson(manifest.metric_serving_admission_ids)
      !== canonicalJson(admissionIds)
    || manifest.metric_serving_admission_registry_id
      !== registry.metric_serving_admission_registry_id
    || manifest.provision_row_id !== provisionRow.provision_row_id
    || canonicalJson(manifest.authority)
      !== canonicalJson(AUTHORITY_NONE)
    || manifest.status.publication_blocked !== true
    || manifest.status.release_eligible !== false) {
    throw new TypeError('invalid F26 release manifest');
  }
  const manifestBody = clone(manifest);
  delete manifestBody
    .no_shop_cross_view_release_manifest_f26_id;
  delete manifestBody.canonical_payload_digest;
  if (manifest
    .no_shop_cross_view_release_manifest_f26_id
      !== contentId(
        'NO_SHOP_CROSS_VIEW_RELEASE_MANIFEST_F26/V1',
        manifestBody,
      )
    || manifest
      .no_shop_cross_view_release_manifest_f26_id
      !== F26_MANIFEST_ID
    || manifest.canonical_payload_digest
      !== contentId(
        'NO_SHOP_CROSS_VIEW_RELEASE_MANIFEST_F26_PAYLOAD/V1',
        manifestBody,
      )
    || manifest.canonical_payload_digest
      !== F26_MANIFEST_DIGEST
    || manifest.roots.admission_root
      !== contentId(
        'F26_METRIC_SERVING_ADMISSION_ROOT/V1',
        admissionIds,
      )
    || manifest.roots.metric_subrow_root
      !== contentId(
        'F26_NO_SHOP_METRIC_SUBROW_ROOT/V1',
        provisionRow.subrows.map((row) => row.subrow_id),
      )
    || manifest.roots.origin_proof_root
      !== contentId(
        'F26_METRIC_ORIGIN_PROOF_ROOT/V1',
        provisionRow.subrows.map(
          (row) => row.source.origin_proof.metric_origin_proof_id,
        ),
      )) {
    throw new TypeError('F26 manifest identity has drifted');
  }
  const expectedReleaseId = contentId(
    'NO_SHOP_CROSS_VIEW_RELEASE_F26/V1',
    {
      release_manifest_id:
        manifest.no_shop_cross_view_release_manifest_f26_id,
      release_manifest_payload_digest:
        manifest.canonical_payload_digest,
      provision_row_id: provisionRow.provision_row_id,
    },
  );
  if (release.no_shop_cross_view_release_f26_id
      !== expectedReleaseId
    || release.no_shop_cross_view_release_f26_id
      !== F26_RELEASE_ID
    || canonicalJson(Object.keys(release.surface_bindings).sort())
      !== canonicalJson(SURFACES)
    || Object.entries(release.surface_bindings).some(
      ([surface, binding]) => (
        binding.surface !== surface
        || binding.release_id !== expectedReleaseId
        || binding.release_manifest_id
          !== manifest
            .no_shop_cross_view_release_manifest_f26_id
        || binding.provision_row_id
          !== provisionRow.provision_row_id
        || canonicalJson(binding.provision_row)
          !== canonicalJson(provisionRow)
        || binding.serving_role
          !== 'INACTIVE_STAGING_ACCEPTANCE_ONLY'
      ),
    )) {
    throw new TypeError('F26 surface bindings have drifted');
  }
  const releaseBody = clone(release);
  delete releaseBody.no_shop_cross_view_release_f26_id;
  delete releaseBody.canonical_payload_digest;
  if (release.canonical_payload_digest
      !== contentId(
        'NO_SHOP_CROSS_VIEW_RELEASE_BUNDLE_F26_PAYLOAD/V1',
        releaseBody,
      )
    || release.canonical_payload_digest
      !== F26_RELEASE_DIGEST) {
    throw new TypeError('F26 release payload digest has drifted');
  }
  return true;
}

function resolveMetricServingAdmissionF26({
  release,
  metric_key: metricKey,
  metric_version: metricVersion,
  concept_key: conceptKey,
  required_claim_definition_key: claimDefinitionKey,
  metric_serving_admission_id: admissionId,
  declared_metric_serving_admission_ids: declaredIds,
} = {}) {
  validateNoShopCrossViewReleaseF26(release);
  sortedUniqueDigests(
    declaredIds,
    'declared metric serving admission IDs',
  );
  if (canonicalJson(declaredIds)
      !== canonicalJson(
        release.manifest.metric_serving_admission_ids,
      )) {
    throw new TypeError(
      'declared metric serving admissions must equal the F26 manifest',
    );
  }
  const admission = release.admission_registry
    .admission_records.find(
      (entry) => entry.metric_serving_admission_id
        === admissionId,
    );
  const row = release.provision_row.subrows.find(
    (entry) => entry.metric_key === metricKey,
  );
  if (!admission
    || !row
    || admission.metric_key !== metricKey
    || admission.metric_version !== metricVersion
    || admission.concept_key !== conceptKey
    || admission.required_claim_definition_key
      !== claimDefinitionKey
    || row.metric_serving_admission_id !== admissionId
    || row.source.origin_proof.metric_serving_admission_id
      !== admissionId) {
    throw new TypeError(
      'F26 metric identity does not match its exact admission',
    );
  }
  let predecessorResolution;
  if (metricKey === 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS') {
    const f22 = resolveMetricServingAdmission({
      contract_bundle: compileFixtureContractV12(),
      metric_key: metricKey,
      metric_version: metricVersion,
      concept_key: conceptKey,
      required_claim_definition_key: claimDefinitionKey,
      metric_serving_admission_id: admissionId,
      declared_metric_serving_admission_ids: [admissionId],
    });
    predecessorResolution =
      `${f22.admission_lane}_F22_VALIDATED`;
  } else if ([
    'NO_SHOP_NOTICE_PERIOD_DAYS',
    'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
  ].includes(metricKey)) {
    if (row.source.origin_proof.source_stage !== 'F24'
      || !SHA256_RE.test(
        row.source.origin_proof.source_carrier_id,
      )
      || !SHA256_RE.test(
        row.source.origin_proof
          .source_carrier_payload_digest,
      )
      || release.manifest.predecessor_chain.f24_manifest_id
        !== F24_MANIFEST_ID
      || release.manifest.predecessor_chain
        .f24_manifest_payload_digest
        !== F24_MANIFEST_DIGEST) {
      throw new TypeError(
        'F26 timing admission lacks its exact F24 proof',
      );
    }
    predecessorResolution =
      'F24_TIMING_CERTIFICATION_VALIDATED';
  } else {
    if (row.source.origin_proof.source_stage !== 'F25'
      || !SHA256_RE.test(
        row.source.origin_proof.source_carrier_id,
      )
      || !SHA256_RE.test(
        row.source.origin_proof
          .source_carrier_payload_digest,
      )
      || release.manifest.predecessor_chain.f25_manifest_id
        !== F25_MANIFEST_ID
      || release.manifest.predecessor_chain
        .f25_manifest_payload_digest
        !== F25_MANIFEST_DIGEST) {
      throw new TypeError(
        'F26 categorical admission lacks its exact F25 proof',
      );
    }
    predecessorResolution =
      'F25_CATEGORICAL_CERTIFICATION_VALIDATED';
  }
  const body = {
    schema_version:
      'METRIC_SERVING_ADMISSION_RESOLUTION/V4',
    admission_lane:
      'F26_SUCCESSOR_CENTRAL_VALIDATOR',
    predecessor_resolution: predecessorResolution,
    contract_fingerprint:
      admission.contract_fingerprint,
    metric_key: metricKey,
    metric_version: metricVersion,
    metric_definition_id:
      admission.metric_definition_id,
    concept_key: conceptKey,
    required_claim_definition_key: claimDefinitionKey,
    metric_serving_admission_id: admissionId,
    metric_serving_admission_registry_id:
      release.admission_registry
        .metric_serving_admission_registry_id,
    metric_origin_proof_id:
      row.source.origin_proof.metric_origin_proof_id,
    declared_admission_membership: 'PASSED',
    central_admission_validation: 'PASSED',
    release_manifest_validation: 'PASSED',
    policy_eligibility:
      'PASSED_INACTIVE_CANDIDATE_ONLY',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  return freeze({
    ...body,
    central_admission_resolution_id: contentId(
      'METRIC_SERVING_ADMISSION_RESOLUTION/V4',
      body,
    ),
  });
}

function validateAllMetricServingAdmissionsF26(release) {
  validateNoShopCrossViewReleaseF26(release);
  const declaredIds =
    release.manifest.metric_serving_admission_ids;
  const resolutions = release.provision_row.subrows.map(
    (row) => resolveMetricServingAdmissionF26({
      release,
      metric_key: row.metric_key,
      metric_version: row.metric_version,
      concept_key: row.concept_key,
      required_claim_definition_key:
        row.required_claim_definition_key,
      metric_serving_admission_id:
        row.metric_serving_admission_id,
      declared_metric_serving_admission_ids:
        declaredIds,
    }),
  );
  if (resolutions.length !== 9
    || new Set(resolutions.map(
      (entry) => entry.metric_key,
    )).size !== 9) {
    throw new TypeError(
      'F26 central admission resolution set is not exact',
    );
  }
  return freeze(resolutions);
}

function normaliseFilters(filters = {}) {
  if (!filters
    || typeof filters !== 'object'
    || Array.isArray(filters)
    || Object.keys(filters).some(
      (key) => !FILTER_KEYS.includes(key),
    )) {
    throw new TypeError('F26 filters are outside the closed contract');
  }
  const value = { ...DEFAULT_FILTERS, ...filters };
  for (const key of [
    'sector',
    'buyer',
    'merger_form',
    'adviser_either',
    'lawyer_either',
  ]) {
    if (value[key] !== null
      && (typeof value[key] !== 'string'
        || value[key].length < 1
        || value[key].length > 256)) {
      throw new TypeError(`${key} is outside the F26 filter contract`);
    }
  }
  for (const key of ['year_from', 'year_to']) {
    if (value[key] !== null
      && (!Number.isInteger(value[key])
        || value[key] < 1900
        || value[key] > 2100)) {
      throw new TypeError(`${key} is outside the F26 filter contract`);
    }
  }
  if (value.year_from !== null
    && value.year_to !== null
    && value.year_from > value.year_to) {
    throw new TypeError('year filters are inverted');
  }
  for (const key of ['min_value_usd', 'max_value_usd']) {
    if (value[key] !== null
      && (typeof value[key] !== 'string'
        || !CANONICAL_DECIMAL_RE.test(value[key])
        || value[key].length > 64)) {
      throw new TypeError(`${key} is outside the F26 filter contract`);
    }
  }
  if (value.min_value_usd !== null
    && value.max_value_usd !== null
    && compareCanonicalDecimals(
      value.min_value_usd,
      value.max_value_usd,
    ) > 0) {
    throw new TypeError('value filters are inverted');
  }
  return freeze(value);
}

function compareCanonicalDecimals(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length > rightInteger.length ? 1 : -1;
  }
  const integerComparison =
    leftInteger.localeCompare(rightInteger);
  if (integerComparison !== 0) return integerComparison;
  const width = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction.padEnd(width, '0')
    .localeCompare(rightFraction.padEnd(width, '0'));
}

function compileNoShopF26MarketRequest({
  release,
  filters = {},
} = {}) {
  const admissionResolutions =
    validateAllMetricServingAdmissionsF26(release);
  const resolutionByMetric = new Map(
    admissionResolutions.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const normalisedFilters = normaliseFilters(filters);
  const metricBindings = release.provision_row.subrows.map(
    (row) => ({
      metric_key: row.metric_key,
      metric_version: row.metric_version,
      metric_definition_id: row.metric_definition_id,
      metric_serving_admission_id:
        row.metric_serving_admission_id,
      concept_key: row.concept_key,
      party: clone(row.party),
      comparison_kind: row.comparison_kind,
      canonical_unit: row.subject.canonical_unit,
      day_basis: row.subject.day_basis,
      comparability_class_digest:
        row.comparability_class_digest,
      grouping_dimensions:
        clone(row.grouping_dimensions),
      comparison_contract:
        clone(row.comparison_contract),
      central_admission_resolution_id:
        resolutionByMetric.get(row.metric_key)
          .central_admission_resolution_id,
    }),
  ).sort((left, right) => (
    left.metric_key.localeCompare(right.metric_key)
  ));
  const base = {
    schema_version: 'F26_NO_SHOP_MARKET_REQUEST/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id:
      release.no_shop_cross_view_release_f26_id,
    release_manifest_id:
      release.manifest
        .no_shop_cross_view_release_manifest_f26_id,
    contract_fingerprint:
      release.manifest.contract_fingerprint,
    execution_shape:
      'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
    database_call_budget: 1,
    database_call_growth_with_corpus_size: 'CONSTANT',
    immediate_retries: 0,
    broad_claim_or_card_loading: false,
    metric_bindings: metricBindings,
    filters: normalisedFilters,
  };
  const requestDigest = contentId(
    'F26_NO_SHOP_MARKET_REQUEST/V1',
    base,
  );
  return freeze({
    ...base,
    request_digest: requestDigest,
    cache_key: contentId(
      'F26_NO_SHOP_MARKET_REQUEST_CACHE/V1',
      {
        release_id: base.release_id,
        request_digest: requestDigest,
        metric_serving_admission_ids:
          metricBindings.map(
            (entry) => entry.metric_serving_admission_id,
          ).sort(),
        filters: normalisedFilters,
      },
    ),
    execution_state:
      'COMPILED_INACTIVE_CANDIDATE_SIMULATION',
    active_query_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
}

function canonicalPercentage(numerator, denominator) {
  if (!Number.isSafeInteger(numerator)
    || numerator < 0
    || !Number.isSafeInteger(denominator)
    || denominator < 0
    || numerator > denominator) {
    throw new TypeError('F26 percentage inputs are invalid');
  }
  if (denominator === 0) return null;
  const scale = 1000000n;
  const scaledNumerator =
    BigInt(numerator) * 100n * scale;
  const denominatorBigInt = BigInt(denominator);
  let rounded = scaledNumerator / denominatorBigInt;
  const remainder = scaledNumerator % denominatorBigInt;
  if (remainder * 2n >= denominatorBigInt) rounded += 1n;
  const integer = rounded / scale;
  const fraction = String(rounded % scale)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction.length > 0
    ? `${integer}.${fraction}`
    : String(integer);
}

function validateNoShopF26MarketResult(result, request) {
  const outerKeys = [
    'schema_version',
    'release_id',
    'release_manifest_id',
    'request_digest',
    'cache_key',
    'metric_serving_admission_ids',
    'metric_results',
    'canonical_payload_digest',
  ];
  if (!exactKeys(result, outerKeys)
    || result.schema_version
      !== 'F26_NO_SHOP_MARKET_RESULT/V1'
    || result.release_id !== request.release_id
    || result.release_manifest_id
      !== request.release_manifest_id
    || result.request_digest !== request.request_digest
    || result.cache_key !== request.cache_key
    || !Array.isArray(result.metric_results)
    || result.metric_results.length
      !== request.metric_bindings.length) {
    throw new TypeError(
      'F26 market result identity does not match its request',
    );
  }
  const expectedAdmissionIds = request.metric_bindings.map(
    (entry) => entry.metric_serving_admission_id,
  ).sort();
  sortedUniqueDigests(
    result.metric_serving_admission_ids,
    'F26 result admission IDs',
  );
  if (canonicalJson(result.metric_serving_admission_ids)
      !== canonicalJson(expectedAdmissionIds)) {
    throw new TypeError('F26 result admission set has drifted');
  }
  const bindingByMetric = new Map(
    request.metric_bindings.map(
      (entry) => [entry.metric_key, entry],
    ),
  );
  const metricKeys = [];
  for (const metricResult of result.metric_results) {
    const binding = bindingByMetric.get(metricResult?.metric_key);
    if (!exactKeys(metricResult, [
      'metric_key',
      'metric_serving_admission_id',
      'counts',
      'groups',
    ])
      || !binding
      || metricResult.metric_serving_admission_id
        !== binding.metric_serving_admission_id
      || !exactKeys(metricResult.counts, [
        'eligible_deals',
        'comparable_deals',
        'excluded_deals',
      ])
      || Object.values(metricResult.counts).some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      )
      || metricResult.counts.comparable_deals
        > metricResult.counts.eligible_deals
      || metricResult.counts.excluded_deals
        > metricResult.counts.eligible_deals
      || metricResult.counts.comparable_deals
        + metricResult.counts.excluded_deals
        > metricResult.counts.eligible_deals
      || metricResult.counts.comparable_deals
        > Math.floor(Number.MAX_SAFE_INTEGER / 256)
      || !Array.isArray(metricResult.groups)
      || metricResult.groups.length > 256) {
      throw new TypeError(
        'F26 market metric result is invalid or unbounded',
      );
    }
    const tupleKeys = [
      'canonical_value',
      ...binding.grouping_dimensions,
    ].sort();
    const contract = binding.comparison_contract;
    const categorical =
      contract.value_type === 'CLOSED_CANONICAL_CODE';
    const governedTuples = categorical
      ? new Set(
        contract.governed_grouping_tuples.map(canonicalJson),
      )
      : null;
    const seenTuples = new Set();
    let priorTuple = null;
    let durationDealCount = 0;
    for (const group of metricResult.groups) {
      const tuple = group?.grouping_tuple;
      const tupleBytes = canonicalJson(tuple);
      const canonicalValue = tuple?.canonical_value;
      const nonMarketState = [
        'NOT_APPLICABLE',
        'NOT_EXAMINED',
        'UNRESOLVED',
        'NON_COMPARABLE',
        'FEATURE_DISABLED',
        'FAILED',
      ].includes(group?.state);
      if (!exactKeys(group, [
        'grouping_tuple',
        'deal_count',
        'subject_count',
        'percentage',
        'state',
        'reason_code',
      ])
        || !exactKeys(tuple, tupleKeys)
        || typeof canonicalValue !== 'string'
        || (categorical
          ? !contract.allowed_canonical_values.includes(
            canonicalValue,
          )
          : !CANONICAL_DECIMAL_RE.test(
            canonicalValue,
          ))
        || (categorical && !governedTuples.has(tupleBytes))
        || binding.grouping_dimensions.some(
          (dimension) => !contract
            .grouping_dimension_codebooks[dimension]
            .includes(tuple[dimension]),
        )
        || seenTuples.has(tupleBytes)
        || (priorTuple !== null
          && priorTuple.localeCompare(tupleBytes) >= 0)
        || !Number.isSafeInteger(group.deal_count)
        || group.deal_count < 0
        || group.deal_count
          > metricResult.counts.comparable_deals
        || !Number.isSafeInteger(group.subject_count)
        || group.subject_count < group.deal_count
        || group.subject_count
          > metricResult.counts.comparable_deals * 256
        || group.percentage !== (
          nonMarketState
            ? null
            : canonicalPercentage(
              group.deal_count,
              metricResult.counts.comparable_deals,
            )
        )
        || ![
          'PRESENT',
          'ABSENT',
          'NOT_APPLICABLE',
          'NOT_EXAMINED',
          'UNRESOLVED',
          'NON_COMPARABLE',
          'FEATURE_DISABLED',
          'FAILED',
        ].includes(group.state)
        || (nonMarketState
          ? typeof group.reason_code !== 'string'
            || group.reason_code.length < 1
            || group.reason_code.length > 256
            || group.deal_count !== 0
            || group.subject_count !== 0
          : group.reason_code !== null)
        || (!categorical
          && (!nonMarketState
            && group.state !== 'PRESENT'
            || group.subject_count !== group.deal_count))) {
        throw new TypeError(
          'F26 market result grouping is invalid',
        );
      }
      if (!categorical) {
        durationDealCount += group.deal_count;
      }
      seenTuples.add(tupleBytes);
      priorTuple = tupleBytes;
    }
    if (!categorical
      && durationDealCount
        !== metricResult.counts.comparable_deals) {
      throw new TypeError(
        'F26 duration result does not reconcile to its cohort',
      );
    }
    metricKeys.push(metricResult.metric_key);
  }
  if (canonicalJson(metricKeys)
      !== canonicalJson([...bindingByMetric.keys()].sort())) {
    throw new TypeError('F26 metric result set is not exact and sorted');
  }
  const {
    canonical_payload_digest: payloadDigest,
    ...body
  } = result;
  if (payloadDigest !== contentId(
    'F26_NO_SHOP_MARKET_RESULT_PAYLOAD/V1',
    body,
  )
    || Buffer.byteLength(canonicalJson(result), 'utf8')
      > MAX_EXECUTION_RESULT_BYTES) {
    throw new TypeError('F26 market result is invalid or oversized');
  }
  return true;
}

async function executeNoShopF26MarketRequest({
  release,
  filters = {},
  cache,
  rpc,
} = {}) {
  if (!cache
    || typeof cache.get !== 'function'
    || typeof cache.set !== 'function'
    || typeof rpc !== 'function') {
    throw new TypeError(
      'F26 execution requires injected cache and RPC functions',
    );
  }
  const request = compileNoShopF26MarketRequest({
    release,
    filters,
  });
  const cached = await cache.get(request.cache_key);
  if (cached !== undefined && cached !== null) {
    const snapshot = freeze(clone(cached));
    validateNoShopF26MarketResult(snapshot, request);
    return freeze({
      schema_version: 'F26_NO_SHOP_MARKET_EXECUTION/V1',
      execution_source: 'CACHE',
      database_calls: 0,
      immediate_retries: 0,
      active_query_authority: 'NONE',
      production_activation_authority: 'NONE',
      request,
      result: snapshot,
    });
  }
  const snapshot = freeze(clone(await rpc(request)));
  validateNoShopF26MarketResult(snapshot, request);
  await cache.set(request.cache_key, clone(snapshot));
  return freeze({
    schema_version: 'F26_NO_SHOP_MARKET_EXECUTION/V1',
    execution_source: 'RPC',
    database_calls: 1,
    immediate_retries: 0,
    active_query_authority: 'NONE',
    production_activation_authority: 'NONE',
    request,
    result: snapshot,
  });
}

function prepareNoShopF26SubrowsForRendering(
  records,
  release,
) {
  validateAllMetricServingAdmissionsF26(release);
  const certified = new Map(
    release.provision_row.subrows.map(
      (row) => [row.metric_key, canonicalJson(row)],
    ),
  );
  const seen = new Set();
  const encounteredKnown = new Set();
  const rendered = (Array.isArray(records) ? records : [])
    .map((row, index) => {
      try {
        const metricKey =
          typeof row?.metric_key === 'string'
            ? row.metric_key
            : null;
        if (metricKey !== null
          && certified.has(metricKey)
          && !encounteredKnown.has(metricKey)) {
          encounteredKnown.add(metricKey);
        }
        if (!row
          || seen.has(row.metric_key)
          || certified.get(row.metric_key)
            !== canonicalJson(row)) {
          throw new TypeError('invalid metric subrow');
        }
        seen.add(row.metric_key);
        return freeze({
          render_kind: 'METRIC_SUBROW',
          key: row.subrow_id,
          metric_key: row.metric_key,
          row,
        });
      } catch {
        return freeze({
          render_kind: 'METRIC_SUBROW_FAILED',
          key: contentId(
            'F26_METRIC_SUBROW_RENDER_FAILED/V1',
            {
              index,
              supplied_metric_key:
                typeof row?.metric_key === 'string'
                  ? row.metric_key
                  : null,
              supplied_subrow_id:
                SHA256_RE.test(row?.subrow_id || '')
                  ? row.subrow_id
                  : null,
            },
          ),
          metric_key:
            typeof row?.metric_key === 'string'
              ? row.metric_key
              : null,
          reason_code:
            'INVALID_OR_UNRECOGNISED_F26_METRIC_SUBROW',
        });
      }
    });
  release.provision_row.subrows.forEach((row) => {
    if (encounteredKnown.has(row.metric_key)) return;
    rendered.push(freeze({
      render_kind: 'METRIC_SUBROW_FAILED',
      key: contentId(
        'F26_METRIC_SUBROW_RENDER_FAILED/V1',
        {
          supplied_metric_key: row.metric_key,
          supplied_subrow_id: null,
          reason_code: 'MISSING_F26_METRIC_SUBROW',
        },
      ),
      metric_key: row.metric_key,
      reason_code: 'MISSING_F26_METRIC_SUBROW',
    }));
  });
  return freeze(rendered);
}

function buildNoShopF26Preview(release) {
  validateAllMetricServingAdmissionsF26(release);
  return freeze({
    schema_version: 'QXO_NO_SHOP_CROSS_VIEW_F26_PREVIEW/V1',
    release_id: release.no_shop_cross_view_release_f26_id,
    release_payload_digest: release.canonical_payload_digest,
    manifest_id:
      release.manifest.no_shop_cross_view_release_manifest_f26_id,
    manifest_payload_digest:
      release.manifest.canonical_payload_digest,
    release_state: release.manifest.release_state,
    activation_eligibility:
      release.manifest.activation_eligibility,
    authority: release.manifest.authority,
    counts: release.manifest.counts,
    serving_plan: release.manifest.serving_plan,
    surfaces: Object.keys(release.surface_bindings),
    provision_row: release.provision_row,
  });
}

module.exports = {
  AUTHORITY_SCOPE,
  F26_MANIFEST_DIGEST,
  F26_MANIFEST_ID,
  F26_PROVISION_ROW_ID,
  F26_REGISTRY_ID,
  F26_RELEASE_DIGEST,
  F26_RELEASE_ID,
  METRIC_PRESENTATION,
  SURFACES,
  buildNoShopCrossViewReleaseF26,
  buildNoShopF26Preview,
  compileNoShopF26MarketRequest,
  executeNoShopF26MarketRequest,
  prepareNoShopF26SubrowsForRendering,
  resolveMetricServingAdmissionF26,
  validateAllMetricServingAdmissionsF26,
  validateNoShopF26MarketResult,
  validateNoShopCrossViewReleaseF26,
};
