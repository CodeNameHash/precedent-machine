const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V13,
  validateContractBundle,
} = require('./contract-bundle');
const {
  BUYER_GROUP_PARTY,
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  COMPANY_PARTY,
  REVIEW_VERSION,
  validateQxoReviewedCapitalisationF27,
} = require('./reviewed-qxo-capitalisation-f27');

const AUTHORITY_SCOPE =
  'OFFLINE_QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27_ONLY';
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const CLASS_KEYS = Object.freeze([
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
]);
const VALUE_SLOT_KEYS = Object.freeze([
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  'CAPITALISATION_MEASUREMENT_DATE',
  'GENERAL_KNOWLEDGE_QUALIFIER',
  'GENERAL_MATERIALITY_QUALIFIER',
  'RETROSPECTIVE_LOOKBACK',
]);
const ALLOWED_ACCURACY_VALUES = Object.freeze([
  'MAT_ALL_RESPECTS',
  'MAT_ALL_RESPECTS_DE_MINIMIS',
  'MAT_ALL_MATERIAL',
  'MAT_MAE_QUALIFIED',
]);
const FILTER_KEYS = Object.freeze([
  'sector',
  'buyer',
  'merger_form',
  'adviser_either',
  'lawyer_either',
  'year_from',
  'year_to',
  'min_value_usd',
  'max_value_usd',
]);
const DEFAULT_FILTERS = Object.freeze(
  Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
);
const CANONICAL_DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_RESULT_BYTES = 256 * 1024;
const MAX_LOCAL_INFLIGHT_MARKET_REQUESTS = 4;
const MARKET_REQUEST_TIMEOUT_MS = 15000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 30000;
const CIRCUIT_OPEN_MS = 30000;
const executionGuard = {
  inflight: new Map(),
  failureTimes: [],
  circuitOpenUntil: 0,
};
const AUTHORITY_NONE = Object.freeze({
  active_release_authority: 'NONE',
  active_query_authority: 'NONE',
  active_pointer_authority: 'NONE',
  corpus_write_authority: 'NONE',
  production_activation_authority: 'NONE',
});
const INACTIVE_BLOCKER_CODES = Object.freeze([
  'P1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED',
  'F27_SET_BASED_SERVING_RPC_NOT_CERTIFIED',
  'F27_GLOBAL_DATABASE_CAPACITY_NOT_CERTIFIED',
  'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    throw new TypeError(`${label} must be a sha256 digest`);
  }
  return value;
}

function requireContentIdentity(record, idKey, domain, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`${label} must be an object`);
  }
  const body = clone(record);
  delete body[idKey];
  if (record[idKey] !== contentId(domain, body)) {
    throw new TypeError(`${label} identity has drifted`);
  }
  return body;
}

function validateInputs({
  reviewedGraph,
  sourceContext,
  parserSourceClosure,
  contractBundle,
} = {}) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V13
    || reviewedGraph.contract_fingerprint !== contractBundle.fingerprint) {
    throw new TypeError('F27 requires the exact reviewed graph and V13 contract');
  }
  validateQxoReviewedCapitalisationF27({
    candidate: reviewedGraph,
    sourceContext,
    parserSourceClosure,
    contractBundle,
  });
  const resultDefinition = contractBundle.result_definitions.find(
    (entry) => entry.result_key === 'TARGET_CAPITALISATION_BRING_DOWN'
      && entry.result_version === 2,
  );
  const metricDefinition = contractBundle.market_metric_definitions.find(
    (entry) => entry.metric_key === 'REPRESENTATION_ACCURACY_STANDARD'
      && entry.metric_version === 2,
  );
  if (!resultDefinition || !metricDefinition) {
    throw new TypeError('F27 result or metric definition is absent');
  }
  return {
    reviewedGraph,
    sourceContext,
    parserSourceClosure,
    contractBundle,
    resultDefinition,
    metricDefinition,
  };
}

function byId(values, idKey) {
  return new Map(values.map((entry) => [entry[idKey], entry]));
}

function exactDetail(detailKind, evidenceReferenceIds, sourceDetailIds) {
  const body = {
    schema_version: 'F27_EXACT_DETAIL_REFERENCE/V1',
    detail_kind: detailKind,
    evidence_reference_ids:
      [...new Set(evidenceReferenceIds)].sort(),
    source_detail_ids: [...new Set(sourceDetailIds)].sort(),
    whole_document_permission: false,
  };
  return {
    ...body,
    exact_detail_reference_id: contentId(
      'F27_EXACT_DETAIL_REFERENCE/V1',
      body,
    ),
  };
}

function subjectMarketContext() {
  return {
    display_priority: 'SECONDARY',
    subject_deal_included: true,
    independent_comparable_deals: 0,
    state: 'INACTIVE_CANDIDATE_NO_INDEPENDENT_COHORT',
    presence_frequency: {
      eligible_deals: 0,
      present_deals: 0,
      percentage: null,
      reason_code: 'NO_INDEPENDENT_COMPARABLE_DEALS',
    },
    distribution: [],
  };
}

function subrow(body) {
  return freeze({
    ...body,
    subrow_id: contentId('CAPITALISATION_SUBROW_F27/V1', body),
  });
}

function buildPrimarySubrow(validated, input, ordinal) {
  const graph = validated.reviewedGraph;
  const claims = byId(graph.claims, 'claim_revision_id');
  const relationships = byId(graph.relationships, 'relationship_revision_id');
  const group = graph.condition_group_components.find(
    (entry) => entry.condition_group_revision_id
      === input.condition_group_revision_id,
  );
  const accuracy = input.claim_revision_ids
    .map((id) => claims.get(id))
    .find((entry) => entry?.claim_definition_key
      === 'REPRESENTATION_ACCURACY_STANDARD');
  const exception = input.claim_revision_ids
    .map((id) => claims.get(id))
    .find((entry) => entry?.claim_definition_key
      === 'REPRESENTATION_ACCURACY_EXCEPTION');
  const bringDown = input.relationship_revision_ids
    .map((id) => relationships.get(id))
    .find((entry) => entry?.relationship_definition_key === 'BRINGS_DOWN');
  const definitionUse = input.relationship_revision_ids
    .map((id) => relationships.get(id))
    .find((entry) => entry?.relationship_definition_key === 'USES_DEFINITION');
  if (!group
    || !accuracy
    || !bringDown
    || accuracy.attributes.comparison_class_key !== input.comparison_class_key
    || bringDown.effect.comparison_class_key !== input.comparison_class_key) {
    throw new TypeError('F27 primary result input is incomplete');
  }
  const isClauseB = input.comparison_class_key === CLAUSE_B_CLASS;
  if (isClauseB !== Boolean(exception && definitionUse)) {
    throw new TypeError('F27 definition exception is bound to the wrong class');
  }
  const evidenceIds = [
    ...accuracy.evidence.map((entry) => entry.excerpt_id),
    ...bringDown.evidence.map((entry) => entry.excerpt_id),
    ...(exception?.evidence || []).map((entry) => entry.excerpt_id),
    ...(definitionUse?.evidence || []).map((entry) => entry.excerpt_id),
  ];
  return subrow({
    schema_version: 'CAPITALISATION_SUBROW_F27/V1',
    value_slot_key: input.value_slot_key,
    display_ordinal: ordinal,
    row_role: 'PRIMARY_COMPARABLE_TERM',
    section: 'ACCURACY_AT_CLOSING',
    label: isClauseB ? 'Clause (B) group' : 'Clause (C) group',
    comparison_class_key: input.comparison_class_key,
    state: 'PRESENT',
    comparability_state: 'COMPARABLE_IN_EXACT_FROZEN_CLASS',
    party: clone(BUYER_GROUP_PARTY),
    representation_maker: clone(COMPANY_PARTY),
    subject: {
      display_value: isClauseB
        ? 'True and correct, subject to De Minimis Inaccuracies'
        : 'True and correct in all material respects, with materiality scrape',
      raw_value: accuracy.raw_value,
      canonical_value: accuracy.canonical_value,
      canonical_unit: 'ACCURACY_STANDARD_CODE',
      accuracy_exception: exception?.canonical_value || null,
      denominator: clone(exception?.denominator || null),
      target_limb_ordinals: clone(group.target_limb_ordinals),
      dated_representation_proviso:
        clone(bringDown.effect.dated_representation_proviso),
      materiality_scrape: clone(bringDown.effect.materiality_scrape),
    },
    market_context: subjectMarketContext(),
    source: {
      state: 'AVAILABLE',
      document_hash: graph.document_hash,
      evidence_reference_ids: [...new Set(evidenceIds)].sort(),
      exact_detail: exactDetail(
        isClauseB
          ? 'CLAUSE_B_LIMBS_ACCURACY_PROVISO_DEFINITION_AND_DENOMINATOR'
          : 'CLAUSE_C_LIMBS_ACCURACY_PROVISO_AND_SCRAPE',
        evidenceIds,
        [
          group.condition_group_revision_id,
          accuracy.claim_revision_id,
          bringDown.relationship_revision_id,
          ...(exception ? [exception.claim_revision_id] : []),
          ...(definitionUse
            ? [definitionUse.relationship_revision_id]
            : []),
        ],
      ),
    },
    dependency_subrow_keys: [],
  });
}

function buildContextSubrow(validated, input, ordinal) {
  const graph = validated.reviewedGraph;
  const claim = graph.claims.find(
    (entry) => entry.claim_revision_id === input.claim_revision_ids[0],
  );
  const presentation = {
    CAPITALISATION_MEASUREMENT_DATE: {
      label: 'Measurement date',
      display: '17 April 2026, one calendar day before signing',
    },
    GENERAL_KNOWLEDGE_QUALIFIER: {
      label: 'General knowledge qualifier',
      display: 'Absent',
    },
    GENERAL_MATERIALITY_QUALIFIER: {
      label: 'General materiality qualifier',
      display: 'Absent',
    },
    RETROSPECTIVE_LOOKBACK: {
      label: 'Retrospective lookback',
      display: 'Absent',
    },
  }[input.value_slot_key];
  if (!claim || !presentation) {
    throw new TypeError('F27 contextual result input is incomplete');
  }
  const evidenceIds = claim.state === 'PRESENT'
    ? claim.evidence.map((entry) => entry.excerpt_id)
    : claim.scope.required_interval_ids;
  return subrow({
    schema_version: 'CAPITALISATION_SUBROW_F27/V1',
    value_slot_key: input.value_slot_key,
    display_ordinal: ordinal,
    row_role: 'SUBJECT_CONTEXT',
    section: 'REPRESENTATION_CONTEXT',
    label: presentation.label,
    comparison_class_key: null,
    state: claim.state,
    comparability_state: input.value_slot_key
        === 'CAPITALISATION_MEASUREMENT_DATE'
      ? 'SUBJECT_CONTEXT_ONLY_NOT_METRIC_ADMITTED'
      : 'EXPLICIT_ABSENCE_SUBJECT_CONTEXT',
    party: clone(COMPANY_PARTY),
    result_party: clone(BUYER_GROUP_PARTY),
    subject: {
      display_value: presentation.display,
      raw_value: claim.raw_value,
      canonical_value: claim.canonical_value,
      canonical_unit: claim.unit,
      claim_attributes: clone(claim.attributes),
      scope_closure_id: claim.scope?.scope_closure_id || null,
    },
    market_context: subjectMarketContext(),
    source: {
      state: 'AVAILABLE',
      document_hash: graph.document_hash,
      evidence_reference_ids: [...new Set(evidenceIds)].sort(),
      exact_detail: exactDetail(
        input.value_slot_key,
        evidenceIds,
        [claim.claim_revision_id],
      ),
    },
    dependency_subrow_keys: [],
  });
}

function buildSubrows(validated) {
  const inputs = [...validated.reviewedGraph.result_inputs].sort(
    (left, right) => left.ordinal - right.ordinal,
  );
  if (inputs.length !== 6
    || inputs.some((entry, index) => entry.ordinal !== index)) {
    throw new TypeError('F27 result input inventory is not exact');
  }
  return inputs.map((input, index) => (
    input.comparison_class_key
      ? buildPrimarySubrow(validated, input, index)
      : buildContextSubrow(validated, input, index)
  ));
}

function buildAdmission(validated, subrow) {
  const metric = validated.metricDefinition;
  const classContract = metric.comparison_classes.find(
    (entry) => entry.comparison_class_key
      === subrow.comparison_class_key,
  );
  if (!classContract
    || canonicalJson(classContract.required_target_limb_ordinals)
      !== canonicalJson(subrow.subject.target_limb_ordinals)) {
    throw new TypeError('F27 metric class does not match its subrow');
  }
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION_F27/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_fingerprint: validated.contractBundle.fingerprint,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    metric_definition_id: metric.metric_definition_id,
    result_definition_id: validated.resultDefinition.result_definition_id,
    concept_key: metric.concept_key,
    comparison_class_key: subrow.comparison_class_key,
    required_value_slot_key: classContract.required_value_slot_key,
    required_claim_definition_key: metric.required_claim_definition_key,
    required_relationship_key: metric.required_relationship_key,
    required_relationship_version: metric.required_relationship_version,
    party: clone(BUYER_GROUP_PARTY),
    canonical_unit: metric.canonical_unit,
    allowed_canonical_values: clone(metric.allowed_canonical_values),
    target_limb_ordinals: clone(classContract.required_target_limb_ordinals),
    derivation_versions: [REVIEW_VERSION],
    authority: clone(AUTHORITY_NONE),
  };
  return freeze({
    ...body,
    metric_serving_admission_id: contentId(
      'METRIC_SERVING_ADMISSION_F27/V1',
      body,
    ),
  });
}

function buildObservation({
  releaseId,
  reviewedGraph,
  admission,
  subrow,
}) {
  const body = {
    schema_version: 'MARKET_OBSERVATION_F27/V1',
    release_id: releaseId,
    governed_deal_key: 'deal:qxo-topbuild',
    document_hash: reviewedGraph.document_hash,
    concept_key: admission.concept_key,
    metric_key: admission.metric_key,
    metric_version: admission.metric_version,
    metric_definition_id: admission.metric_definition_id,
    metric_serving_admission_id: admission.metric_serving_admission_id,
    comparison_class_key: admission.comparison_class_key,
    party: clone(BUYER_GROUP_PARTY),
    representation_maker: clone(COMPANY_PARTY),
    state: 'PRESENT',
    raw_value: subrow.subject.raw_value,
    canonical_value: subrow.subject.canonical_value,
    canonical_unit: admission.canonical_unit,
    semantic_terms: {
      accuracy_exception: clone(subrow.subject.accuracy_exception),
      denominator: clone(subrow.subject.denominator),
      target_limb_ordinals: clone(subrow.subject.target_limb_ordinals),
      dated_representation_proviso:
        clone(subrow.subject.dated_representation_proviso),
      materiality_scrape: clone(subrow.subject.materiality_scrape),
    },
    deal_weight: 1,
    claim_revision_ids: reviewedGraph.result_inputs.find(
      (entry) => entry.value_slot_key === subrow.value_slot_key,
    ).claim_revision_ids,
    relationship_revision_ids: reviewedGraph.result_inputs.find(
      (entry) => entry.value_slot_key === subrow.value_slot_key,
    ).relationship_revision_ids,
    evidence_root: contentId(
      'F27_MARKET_OBSERVATION_EVIDENCE_ROOT/V1',
      subrow.source.evidence_reference_ids,
    ),
    source_lineage: {
      reviewed_graph_id:
        reviewedGraph.qxo_reviewed_capitalisation_f27_id,
      reviewed_graph_payload_digest:
        reviewedGraph.canonical_payload_digest,
      parser_source_closure_id:
        reviewedGraph.parser_source_closure_id,
      source_context_id: reviewedGraph.source_context_id,
      canonical_text_id: reviewedGraph.canonical_text_id,
      evidence_reference_ids:
        clone(subrow.source.evidence_reference_ids),
    },
    derivation_version: REVIEW_VERSION,
    comparability_state: 'COMPARABLE_IN_EXACT_FROZEN_CLASS',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  return freeze({
    ...body,
    market_observation_id: contentId('MARKET_OBSERVATION_F27/V1', body),
  });
}

function buildQxoCapitalisationCrossViewReleaseF27({
  reviewedGraph,
  sourceContext,
  parserSourceClosure,
  contractBundle,
} = {}) {
  const validated = validateInputs({
    reviewedGraph,
    sourceContext,
    parserSourceClosure,
    contractBundle,
  });
  const subrows = buildSubrows(validated);
  const primarySubrows = subrows.filter(
    (entry) => entry.row_role === 'PRIMARY_COMPARABLE_TERM',
  );
  const admissions = primarySubrows.map(
    (row) => buildAdmission(validated, row),
  ).sort((left, right) => (
    left.comparison_class_key.localeCompare(right.comparison_class_key)
  ));
  const releaseId = contentId('QXO_CAPITALISATION_RELEASE_F27/V1', {
    reviewed_graph_id: reviewedGraph.qxo_reviewed_capitalisation_f27_id,
    reviewed_graph_payload_digest: reviewedGraph.canonical_payload_digest,
    contract_fingerprint: contractBundle.fingerprint,
    metric_serving_admission_ids:
      admissions.map((entry) => entry.metric_serving_admission_id),
  });
  const observations = admissions.map((admission) => {
    const row = primarySubrows.find(
      (entry) => entry.comparison_class_key
        === admission.comparison_class_key,
    );
    return buildObservation({
      releaseId,
      reviewedGraph,
      admission,
      subrow: row,
    });
  });
  const provisionBody = {
    schema_version: 'CAPITALISATION_SHARED_PROVISION_ROW_F27/V1',
    release_id: releaseId,
    governed_deal_key: 'deal:qxo-topbuild',
    document_hash: reviewedGraph.document_hash,
    provision_key: 'TARGET_CAPITAL_STRUCTURE_REPRESENTATION_AND_BRING_DOWN',
    label: 'Capital structure representation and bring-down',
    party: clone(BUYER_GROUP_PARTY),
    presentation_order: 'SUBJECT_TERMS_THEN_MARKET_CONTEXT',
    prevalence_display: 'SECONDARY',
    generic_no_market_data_authority: 'NONE',
    class_aggregation: 'FORBIDDEN',
    local_failure_isolation: 'REQUIRED',
    subrows,
  };
  const provisionRow = freeze({
    ...provisionBody,
    provision_row_id: contentId(
      'CAPITALISATION_SHARED_PROVISION_ROW_F27/V1',
      provisionBody,
    ),
  });
  const manifestBody = {
    schema_version: 'QXO_CAPITALISATION_RELEASE_MANIFEST_F27/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id: releaseId,
    release_state: 'INACTIVE_CANDIDATE',
    activation_eligibility: 'INELIGIBLE_EXPLICIT_ACTIVATION_REQUIRED',
    reviewed_graph_id: reviewedGraph.qxo_reviewed_capitalisation_f27_id,
    reviewed_graph_payload_digest: reviewedGraph.canonical_payload_digest,
    contract_fingerprint: contractBundle.fingerprint,
    result_definition_id: validated.resultDefinition.result_definition_id,
    metric_definition_id: validated.metricDefinition.metric_definition_id,
    metric_serving_admission_ids:
      admissions.map((entry) => entry.metric_serving_admission_id),
    market_observation_ids:
      observations.map((entry) => entry.market_observation_id),
    provision_row_id: provisionRow.provision_row_id,
    counts: {
      deals: 1,
      provision_rows: 1,
      primary_subrows: 2,
      contextual_subrows: 4,
      metric_admissions: 2,
      market_observations: 2,
      surface_bindings: 4,
    },
    serving_plan: {
      request_shape: 'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
      database_calls_per_request: 1,
      database_call_growth_with_corpus_size: 'CONSTANT',
      broad_claim_or_card_loading: false,
      immediate_retries: 0,
      local_single_flight: true,
      local_distinct_request_limit:
        MAX_LOCAL_INFLIGHT_MARKET_REQUESTS,
      request_timeout_ms: MARKET_REQUEST_TIMEOUT_MS,
      shared_database_capacity_authority:
        'NONE_PENDING_DATABASE_EXECUTOR_CERTIFICATION',
      cache_scope:
        'RELEASE_MANIFEST_CONTRACT_ADMISSIONS_CLASSES_PARTY_SUBJECT_FILTERS_DERIVATIONS',
    },
    authority: clone(AUTHORITY_NONE),
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        ...INACTIVE_BLOCKER_CODES,
      ],
    },
  };
  const manifest = freeze({
    ...manifestBody,
    release_manifest_id: contentId(
      'QXO_CAPITALISATION_RELEASE_MANIFEST_F27/V1',
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_RELEASE_MANIFEST_F27_PAYLOAD/V1',
      manifestBody,
    ),
  });
  const surfaceBindings = freeze(Object.fromEntries(SURFACES.map(
    (surface) => [surface, {
      schema_version: 'CAPITALISATION_SURFACE_BINDING_F27/V1',
      surface,
      release_id: releaseId,
      release_manifest_id: manifest.release_manifest_id,
      provision_row_id: provisionRow.provision_row_id,
      provision_row: provisionRow,
      serving_role: 'INACTIVE_STAGING_ACCEPTANCE_ONLY',
    }],
  )));
  const body = {
    schema_version: 'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id: releaseId,
    admissions,
    observations,
    provision_row: provisionRow,
    surface_bindings: surfaceBindings,
    manifest,
  };
  return freeze({
    ...body,
    qxo_capitalisation_cross_view_release_f27_id: contentId(
      'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoCapitalisationCrossViewReleaseF27({
  candidate,
  reviewedGraph,
  sourceContext,
  parserSourceClosure,
  contractBundle,
} = {}) {
  const expected = buildQxoCapitalisationCrossViewReleaseF27({
    reviewedGraph,
    sourceContext,
    parserSourceClosure,
    contractBundle,
  });
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F27 cross-view release has drifted');
  }
  return true;
}

function validateReleaseEnvelope(release) {
  if (!release
    || release.schema_version
      !== 'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27/V1'
    || release.authority_scope !== AUTHORITY_SCOPE
    || release.manifest?.release_state !== 'INACTIVE_CANDIDATE'
    || release.manifest?.contract_fingerprint
      !== FIXTURE_CONTRACT_FINGERPRINT_V13
    || release.admissions?.length !== 2
    || release.observations?.length !== 2
    || release.provision_row?.subrows?.length !== 6
    || canonicalJson(release.admissions.map(
      (entry) => entry.comparison_class_key,
    )) !== canonicalJson(CLASS_KEYS)
    || canonicalJson(release.observations.map(
      (entry) => entry.comparison_class_key,
    )) !== canonicalJson(CLASS_KEYS)
    || canonicalJson(Object.keys(release.surface_bindings).sort())
      !== canonicalJson(SURFACES)
    || Object.values(release.manifest.authority).some(
      (value) => value !== 'NONE',
    )) {
    throw new TypeError('invalid F27 release envelope');
  }
  const row = release.provision_row;
  requireContentIdentity(
    row,
    'provision_row_id',
    'CAPITALISATION_SHARED_PROVISION_ROW_F27/V1',
    'F27 provision row',
  );
  if (row.release_id !== release.release_id
    || row.governed_deal_key !== 'deal:qxo-topbuild'
    || canonicalJson(row.party) !== canonicalJson(BUYER_GROUP_PARTY)
    || canonicalJson(row.subrows.map(
      (entry) => entry.value_slot_key,
    )) !== canonicalJson(VALUE_SLOT_KEYS)) {
    throw new TypeError('F27 provision row semantics have drifted');
  }
  for (const [index, entry] of row.subrows.entries()) {
    requireContentIdentity(
      entry,
      'subrow_id',
      'CAPITALISATION_SUBROW_F27/V1',
      `F27 subrow ${index}`,
    );
    requireContentIdentity(
      entry.source.exact_detail,
      'exact_detail_reference_id',
      'F27_EXACT_DETAIL_REFERENCE/V1',
      `F27 subrow ${index} exact detail`,
    );
    if (entry.display_ordinal !== index
      || entry.source.document_hash !== row.document_hash
      || entry.source.exact_detail.whole_document_permission !== false
      || entry.market_context.display_priority !== 'SECONDARY') {
      throw new TypeError('F27 subrow source or ordering has drifted');
    }
  }
  const [clauseB, clauseC, ...contextRows] = row.subrows;
  if (clauseB.comparison_class_key !== CLAUSE_B_CLASS
    || clauseB.subject.canonical_value !== 'MAT_ALL_RESPECTS_DE_MINIMIS'
    || canonicalJson(clauseB.subject.target_limb_ordinals)
      !== canonicalJson([1, 3])
    || clauseB.subject.accuracy_exception !== 'DE_MINIMIS_INACCURACIES'
    || clauseB.subject.denominator?.basis
      !== 'FULLY_DILUTED_EQUITY_CAPITALISATION'
    || clauseB.subject.denominator?.party_value !== 'COMPANY'
    || clauseB.subject.materiality_scrape?.state !== 'NOT_APPLIED'
    || clauseC.comparison_class_key !== CLAUSE_C_CLASS
    || clauseC.subject.canonical_value !== 'MAT_ALL_MATERIAL'
    || canonicalJson(clauseC.subject.target_limb_ordinals)
      !== canonicalJson([2, 4, 5])
    || clauseC.subject.accuracy_exception !== null
    || clauseC.subject.denominator !== null
    || clauseC.subject.materiality_scrape?.state !== 'APPLIED'
    || canonicalJson(clauseB.party) !== canonicalJson(BUYER_GROUP_PARTY)
    || canonicalJson(clauseC.party) !== canonicalJson(BUYER_GROUP_PARTY)
    || canonicalJson(clauseB.representation_maker)
      !== canonicalJson(COMPANY_PARTY)
    || canonicalJson(clauseC.representation_maker)
      !== canonicalJson(COMPANY_PARTY)
    || contextRows.some(
      (entry) => canonicalJson(entry.party) !== canonicalJson(COMPANY_PARTY)
        || canonicalJson(entry.result_party)
          !== canonicalJson(BUYER_GROUP_PARTY),
    )) {
    throw new TypeError('F27 legal subrow semantics have drifted');
  }

  for (const [index, admission] of release.admissions.entries()) {
    requireContentIdentity(
      admission,
      'metric_serving_admission_id',
      'METRIC_SERVING_ADMISSION_F27/V1',
      `F27 metric admission ${index}`,
    );
    if (admission.comparison_class_key !== CLASS_KEYS[index]
      || admission.required_value_slot_key !== CLASS_KEYS[index]
      || canonicalJson(admission.allowed_canonical_values)
        !== canonicalJson(ALLOWED_ACCURACY_VALUES)
      || canonicalJson(admission.party) !== canonicalJson(BUYER_GROUP_PARTY)
      || admission.contract_fingerprint
        !== FIXTURE_CONTRACT_FINGERPRINT_V13
      || Object.values(admission.authority).some(
        (authority) => authority !== 'NONE',
      )) {
      throw new TypeError('F27 metric admission semantics have drifted');
    }
  }

  const admissionByClass = byId(
    release.admissions,
    'comparison_class_key',
  );
  const rowByClass = byId(
    row.subrows.slice(0, 2),
    'comparison_class_key',
  );
  for (const [index, observation] of release.observations.entries()) {
    requireContentIdentity(
      observation,
      'market_observation_id',
      'MARKET_OBSERVATION_F27/V1',
      `F27 market observation ${index}`,
    );
    const admission =
      admissionByClass.get(observation.comparison_class_key);
    const subjectRow =
      rowByClass.get(observation.comparison_class_key);
    const expectedTerms = {
      accuracy_exception:
        clone(subjectRow?.subject.accuracy_exception),
      denominator: clone(subjectRow?.subject.denominator),
      target_limb_ordinals:
        clone(subjectRow?.subject.target_limb_ordinals),
      dated_representation_proviso:
        clone(subjectRow?.subject.dated_representation_proviso),
      materiality_scrape:
        clone(subjectRow?.subject.materiality_scrape),
    };
    if (!admission
      || !subjectRow
      || observation.release_id !== release.release_id
      || observation.governed_deal_key !== 'deal:qxo-topbuild'
      || observation.document_hash !== row.document_hash
      || observation.metric_serving_admission_id
        !== admission.metric_serving_admission_id
      || observation.raw_value !== subjectRow.subject.raw_value
      || observation.canonical_value !== subjectRow.subject.canonical_value
      || canonicalJson(observation.semantic_terms)
        !== canonicalJson(expectedTerms)
      || canonicalJson(observation.party)
        !== canonicalJson(BUYER_GROUP_PARTY)
      || canonicalJson(observation.representation_maker)
        !== canonicalJson(COMPANY_PARTY)
      || observation.source_lineage.reviewed_graph_id
        !== release.manifest.reviewed_graph_id
      || observation.source_lineage.reviewed_graph_payload_digest
        !== release.manifest.reviewed_graph_payload_digest
      || observation.source_lineage.parser_source_closure_id == null
      || observation.source_lineage.source_context_id == null
      || observation.source_lineage.canonical_text_id == null
      || canonicalJson(
        observation.source_lineage.evidence_reference_ids,
      ) !== canonicalJson(subjectRow.source.evidence_reference_ids)
      || observation.active_release_authority !== 'NONE'
      || observation.production_activation_authority !== 'NONE') {
      throw new TypeError('F27 market observation semantics have drifted');
    }
  }

  const manifestBody = clone(release.manifest);
  delete manifestBody.release_manifest_id;
  delete manifestBody.canonical_payload_digest;
  const expectedServingPlan = {
    request_shape: 'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
    database_calls_per_request: 1,
    database_call_growth_with_corpus_size: 'CONSTANT',
    broad_claim_or_card_loading: false,
    immediate_retries: 0,
    local_single_flight: true,
    local_distinct_request_limit:
      MAX_LOCAL_INFLIGHT_MARKET_REQUESTS,
    request_timeout_ms: MARKET_REQUEST_TIMEOUT_MS,
    shared_database_capacity_authority:
      'NONE_PENDING_DATABASE_EXECUTOR_CERTIFICATION',
    cache_scope:
      'RELEASE_MANIFEST_CONTRACT_ADMISSIONS_CLASSES_PARTY_SUBJECT_FILTERS_DERIVATIONS',
  };
  const expectedStatus = {
    publication_blocked: true,
    release_eligible: false,
    blocker_codes: [...INACTIVE_BLOCKER_CODES],
  };
  if (release.manifest.release_manifest_id
      !== contentId(
        'QXO_CAPITALISATION_RELEASE_MANIFEST_F27/V1',
        manifestBody,
      )
    || release.manifest.canonical_payload_digest
      !== contentId(
        'QXO_CAPITALISATION_RELEASE_MANIFEST_F27_PAYLOAD/V1',
        manifestBody,
      )
    || release.manifest.release_id !== release.release_id
    || release.manifest.activation_eligibility
      !== 'INELIGIBLE_EXPLICIT_ACTIVATION_REQUIRED'
    || canonicalJson(release.manifest.status)
      !== canonicalJson(expectedStatus)
    || canonicalJson(release.manifest.serving_plan)
      !== canonicalJson(expectedServingPlan)
    || release.manifest.provision_row_id !== row.provision_row_id
    || canonicalJson(release.manifest.metric_serving_admission_ids)
      !== canonicalJson(release.admissions.map(
        (entry) => entry.metric_serving_admission_id,
      ))
    || canonicalJson(release.manifest.market_observation_ids)
      !== canonicalJson(release.observations.map(
        (entry) => entry.market_observation_id,
      ))) {
    throw new TypeError('F27 release manifest identity has drifted');
  }
  const expectedReleaseId = contentId(
    'QXO_CAPITALISATION_RELEASE_F27/V1',
    {
      reviewed_graph_id: release.manifest.reviewed_graph_id,
      reviewed_graph_payload_digest:
        release.manifest.reviewed_graph_payload_digest,
      contract_fingerprint: release.manifest.contract_fingerprint,
      metric_serving_admission_ids:
        release.admissions.map(
          (entry) => entry.metric_serving_admission_id,
        ),
    },
  );
  if (release.release_id !== expectedReleaseId) {
    throw new TypeError('F27 release semantic identity has drifted');
  }
  for (const surface of SURFACES) {
    const binding = release.surface_bindings[surface];
    if (binding?.surface !== surface
      || binding.release_id !== release.release_id
      || binding.release_manifest_id
        !== release.manifest.release_manifest_id
      || binding.provision_row_id !== row.provision_row_id
      || canonicalJson(binding.provision_row) !== canonicalJson(row)
      || binding.serving_role !== 'INACTIVE_STAGING_ACCEPTANCE_ONLY') {
      throw new TypeError('F27 surface binding has drifted');
    }
  }
  const body = clone(release);
  delete body.qxo_capitalisation_cross_view_release_f27_id;
  delete body.canonical_payload_digest;
  if (release.qxo_capitalisation_cross_view_release_f27_id
      !== contentId('QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27/V1', body)
    || release.canonical_payload_digest
      !== contentId(
        'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27_PAYLOAD/V1',
        body,
      )) {
    throw new TypeError('F27 release identity has drifted');
  }
  return true;
}

function compareCanonicalDecimals(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length > rightInteger.length ? 1 : -1;
  }
  const integer = leftInteger.localeCompare(rightInteger);
  if (integer !== 0) return integer;
  const width = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction.padEnd(width, '0')
    .localeCompare(rightFraction.padEnd(width, '0'));
}

function normaliseFilters(filters = {}) {
  if (!filters
    || typeof filters !== 'object'
    || Array.isArray(filters)
    || Object.keys(filters).some((key) => !FILTER_KEYS.includes(key))) {
    throw new TypeError('F27 filters are outside the closed contract');
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
      throw new TypeError(`${key} is outside the F27 filter contract`);
    }
  }
  for (const key of ['year_from', 'year_to']) {
    if (value[key] !== null
      && (!Number.isInteger(value[key])
        || value[key] < 1900
        || value[key] > 2100)) {
      throw new TypeError(`${key} is outside the F27 filter contract`);
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
        || value[key].length > 64
        || !CANONICAL_DECIMAL_RE.test(value[key]))) {
      throw new TypeError(`${key} is outside the F27 filter contract`);
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

function compileQxoCapitalisationF27MarketRequest({
  release,
  filters = {},
} = {}) {
  validateReleaseEnvelope(release);
  const normalisedFilters = normaliseFilters(filters);
  const metricBindings = release.admissions.map((admission) => {
    const subjectObservation = release.observations.find(
      (entry) => entry.comparison_class_key
        === admission.comparison_class_key,
    );
    if (!subjectObservation) {
      throw new TypeError('F27 subject observation binding is absent');
    }
    return {
      metric_key: admission.metric_key,
      metric_version: admission.metric_version,
      metric_definition_id: admission.metric_definition_id,
      metric_serving_admission_id: admission.metric_serving_admission_id,
      subject_market_observation_id:
        subjectObservation.market_observation_id,
      concept_key: admission.concept_key,
      comparison_class_key: admission.comparison_class_key,
      party: clone(admission.party),
      canonical_unit: admission.canonical_unit,
      allowed_canonical_values: clone(admission.allowed_canonical_values),
      derivation_versions: clone(admission.derivation_versions),
    };
  });
  const base = {
    schema_version: 'QXO_CAPITALISATION_MARKET_REQUEST_F27/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id: release.release_id,
    release_manifest_id: release.manifest.release_manifest_id,
    contract_fingerprint: release.manifest.contract_fingerprint,
    subject_deal_key: release.provision_row.governed_deal_key,
    concept_key: 'COND-B-REP',
    party: clone(BUYER_GROUP_PARTY),
    execution_shape: 'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
    database_call_budget: 1,
    database_call_growth_with_corpus_size: 'CONSTANT',
    immediate_retries: 0,
    broad_claim_or_card_loading: false,
    subject_exclusion_predicate:
      'GOVERNED_DEAL_KEY_NOT_EQUAL_SUBJECT_DEAL_KEY',
    metric_bindings: metricBindings,
    filters: normalisedFilters,
  };
  const requestDigest = contentId(
    'QXO_CAPITALISATION_MARKET_REQUEST_F27/V1',
    base,
  );
  return freeze({
    ...base,
    request_digest: requestDigest,
    cache_key: contentId(
      'QXO_CAPITALISATION_MARKET_REQUEST_CACHE_F27/V1',
      {
        release_id: base.release_id,
        release_manifest_id: base.release_manifest_id,
        contract_fingerprint: base.contract_fingerprint,
        subject_deal_key: base.subject_deal_key,
        concept_key: base.concept_key,
        party: base.party,
        request_digest: requestDigest,
        metric_serving_admission_ids: metricBindings.map(
          (entry) => entry.metric_serving_admission_id,
        ),
        subject_market_observation_ids: metricBindings.map(
          (entry) => entry.subject_market_observation_id,
        ),
        comparison_class_keys: metricBindings.map(
          (entry) => entry.comparison_class_key,
        ),
        derivation_versions: [...new Set(metricBindings.flatMap(
          (entry) => entry.derivation_versions,
        ))].sort(),
        filters: normalisedFilters,
      },
    ),
    execution_state: 'COMPILED_INACTIVE_CANDIDATE_SIMULATION',
    active_query_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
}

function canonicalPercentage(numerator, denominator) {
  if (!Number.isSafeInteger(numerator)
    || numerator < 0
    || !Number.isSafeInteger(denominator)
    || denominator <= 0
    || numerator > denominator) {
    throw new TypeError('F27 percentage inputs are invalid');
  }
  const precision = 1000000n;
  const divisor = BigInt(denominator);
  const unrounded = BigInt(numerator) * 100n * precision;
  const quotient = unrounded / divisor;
  const remainder = unrounded % divisor;
  const scaled = remainder * 2n >= divisor ? quotient + 1n : quotient;
  const integer = scaled / precision;
  const fraction = String(scaled % precision)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : String(integer);
}

function validateQxoCapitalisationF27MarketResult(result, request) {
  if (!exactKeys(result, [
    'schema_version',
    'release_id',
    'release_manifest_id',
    'request_digest',
    'cache_key',
    'subject_deal_key',
    'class_results',
    'canonical_payload_digest',
  ])
    || result.schema_version !== 'QXO_CAPITALISATION_MARKET_RESULT_F27/V1'
    || result.release_id !== request.release_id
    || result.release_manifest_id !== request.release_manifest_id
    || result.request_digest !== request.request_digest
    || result.cache_key !== request.cache_key
    || result.subject_deal_key !== request.subject_deal_key
    || !Array.isArray(result.class_results)
    || result.class_results.length !== 2
    || Buffer.byteLength(canonicalJson(result), 'utf8') > MAX_RESULT_BYTES) {
    throw new TypeError('F27 market result identity or bounds are invalid');
  }
  const bindingByClass = new Map(request.metric_bindings.map(
    (entry) => [entry.comparison_class_key, entry],
  ));
  const seen = [];
  for (const classResult of result.class_results) {
    const binding = bindingByClass.get(classResult?.comparison_class_key);
    if (!exactKeys(classResult, [
      'comparison_class_key',
      'metric_serving_admission_id',
      'subject_exclusion',
      'counts',
      'groups',
      'empty_cohort_reason_code',
    ])
      || !binding
      || classResult.metric_serving_admission_id
        !== binding.metric_serving_admission_id
      || !exactKeys(classResult.subject_exclusion, [
        'subject_deal_key',
        'subject_market_observation_id',
        'exclusion_predicate',
        'state',
        'residual_subject_deals',
        'residual_subject_observations',
      ])
      || classResult.subject_exclusion.subject_deal_key
        !== request.subject_deal_key
      || classResult.subject_exclusion.subject_market_observation_id
        !== binding.subject_market_observation_id
      || classResult.subject_exclusion.exclusion_predicate
        !== request.subject_exclusion_predicate
      || classResult.subject_exclusion.state !== 'APPLIED_AND_VERIFIED'
      || classResult.subject_exclusion.residual_subject_deals !== 0
      || classResult.subject_exclusion.residual_subject_observations !== 0
      || !exactKeys(classResult.counts, [
        'eligible_deals',
        'comparable_deals',
        'excluded_deals',
      ])
      || Object.values(classResult.counts).some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      )
      || classResult.counts.comparable_deals
        + classResult.counts.excluded_deals
        !== classResult.counts.eligible_deals
      || !Array.isArray(classResult.groups)
      || classResult.groups.length > 4) {
      throw new TypeError('F27 class result is invalid or unbounded');
    }
    let totalDeals = 0;
    const values = new Set();
    for (const group of classResult.groups) {
      if (!exactKeys(group, [
        'canonical_value',
        'deal_count',
        'percentage',
        'state',
        'reason_code',
      ])
        || !binding.allowed_canonical_values.includes(group.canonical_value)
        || values.has(group.canonical_value)
        || !Number.isSafeInteger(group.deal_count)
        || group.deal_count < 0
        || group.state !== 'PRESENT'
        || group.reason_code !== null
        || group.percentage !== canonicalPercentage(
          group.deal_count,
          classResult.counts.comparable_deals,
        )) {
        throw new TypeError('F27 market group is invalid');
      }
      values.add(group.canonical_value);
      totalDeals += group.deal_count;
    }
    if (totalDeals !== classResult.counts.comparable_deals
      || (classResult.counts.comparable_deals === 0
        && (classResult.groups.length !== 0
          || classResult.empty_cohort_reason_code
            !== 'NO_INDEPENDENT_COMPARABLE_DEALS'))
      || (classResult.counts.comparable_deals > 0
        && classResult.empty_cohort_reason_code !== null)) {
      throw new TypeError('F27 market counts do not reconcile');
    }
    seen.push(classResult.comparison_class_key);
  }
  if (canonicalJson(seen) !== canonicalJson(CLASS_KEYS)) {
    throw new TypeError('F27 market classes are missing, reordered or aggregated');
  }
  const body = clone(result);
  delete body.canonical_payload_digest;
  if (result.canonical_payload_digest
      !== contentId(
        'QXO_CAPITALISATION_MARKET_RESULT_F27_PAYLOAD/V1',
        body,
      )) {
    throw new TypeError('F27 market result payload digest has drifted');
  }
  return true;
}

async function executeQxoCapitalisationF27MarketRequest({
  release,
  filters = {},
  cache,
  rpc,
} = {}) {
  if (!cache?.get || !cache?.set || typeof rpc !== 'function') {
    throw new TypeError('F27 execution requires cache and RPC bindings');
  }
  const request = compileQxoCapitalisationF27MarketRequest({
    release,
    filters,
  });
  const cached = await cache.get(request.cache_key);
  if (cached != null) {
    validateQxoCapitalisationF27MarketResult(cached, request);
    return freeze({
      execution_source: 'CACHE',
      database_calls: 0,
      immediate_retries: 0,
      request,
      result: clone(cached),
    });
  }
  const existing = executionGuard.inflight.get(request.cache_key);
  if (existing) {
    const snapshot = await existing;
    return freeze({
      execution_source: 'COALESCED_INFLIGHT',
      database_calls: 0,
      immediate_retries: 0,
      request,
      result: clone(snapshot),
    });
  }
  const now = Date.now();
  executionGuard.failureTimes = executionGuard.failureTimes.filter(
    (time) => time > now - CIRCUIT_WINDOW_MS,
  );
  if (executionGuard.circuitOpenUntil > now) {
    throw new Error('F27_MARKET_CIRCUIT_OPEN');
  }
  if (executionGuard.inflight.size
      >= MAX_LOCAL_INFLIGHT_MARKET_REQUESTS) {
    throw new Error('F27_MARKET_AT_CAPACITY');
  }
  const controller = new AbortController();
  let timeout;
  const execution = (async () => {
    try {
      const received = await Promise.race([
        rpc(request, { signal: controller.signal }),
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('F27_MARKET_REQUEST_TIMEOUT'));
          }, MARKET_REQUEST_TIMEOUT_MS);
        }),
      ]);
      validateQxoCapitalisationF27MarketResult(received, request);
      const snapshot = freeze(clone(received));
      await cache.set(request.cache_key, snapshot);
      executionGuard.failureTimes = [];
      executionGuard.circuitOpenUntil = 0;
      return snapshot;
    } catch (error) {
      const failedAt = Date.now();
      executionGuard.failureTimes.push(failedAt);
      executionGuard.failureTimes =
        executionGuard.failureTimes.filter(
          (time) => time > failedAt - CIRCUIT_WINDOW_MS,
        );
      if (executionGuard.failureTimes.length
          >= CIRCUIT_FAILURE_THRESHOLD) {
        executionGuard.circuitOpenUntil =
          failedAt + CIRCUIT_OPEN_MS;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      executionGuard.inflight.delete(request.cache_key);
    }
  })();
  executionGuard.inflight.set(request.cache_key, execution);
  const snapshot = await execution;
  return freeze({
    execution_source: 'RPC',
    database_calls: 1,
    immediate_retries: 0,
    request,
    result: clone(snapshot),
  });
}

function prepareQxoCapitalisationF27SubrowsForRendering(rows, release) {
  validateReleaseEnvelope(release);
  if (!Array.isArray(rows) || rows.length > 32) {
    throw new TypeError('F27 render rows must be bounded');
  }
  const expected = new Map(release.provision_row.subrows.map(
    (entry) => [entry.value_slot_key, entry],
  ));
  const received = new Map();
  const unknown = [];
  rows.forEach((row, index) => {
    if (!expected.has(row?.value_slot_key)) {
      unknown.push({ row, index });
      return;
    }
    const values = received.get(row.value_slot_key) || [];
    values.push(row);
    received.set(row.value_slot_key, values);
  });
  const rendered = release.provision_row.subrows.map((canonical) => {
    const values = received.get(canonical.value_slot_key) || [];
    const row = values[0];
    if (values.length !== 1
      || row.subrow_id !== canonical.subrow_id
      || canonicalJson(row) !== canonicalJson(canonical)) {
      return freeze({
        render_kind: 'CAPITALISATION_SUBROW_FAILED',
        value_slot_key: canonical.value_slot_key,
        display_ordinal: canonical.display_ordinal,
        state: 'FAILED',
        reason_code: values.length === 0
          ? 'MISSING_F27_SUBROW'
          : values.length > 1
            ? 'DUPLICATE_F27_SUBROW'
            : 'INVALID_F27_SUBROW',
        generic_no_market_data: false,
      });
    }
    return freeze({
      render_kind: 'CAPITALISATION_SUBROW',
      value_slot_key: canonical.value_slot_key,
      display_ordinal: canonical.display_ordinal,
      state: canonical.state,
      subrow: canonical,
    });
  });
  const unknownFailures = unknown.map(({ row, index }) => freeze({
    render_kind: 'CAPITALISATION_SUBROW_FAILED',
    value_slot_key: row?.value_slot_key || null,
    display_ordinal:
      release.provision_row.subrows.length + index,
    state: 'FAILED',
    reason_code: 'UNRECOGNISED_F27_SUBROW',
    generic_no_market_data: false,
  }));
  return freeze([...rendered, ...unknownFailures]);
}

function buildQxoCapitalisationF27Preview(
  release,
  { previewScope = 'UNIT_TEST_EXACT_TEXT_PREVIEW' } = {},
) {
  validateReleaseEnvelope(release);
  if (![
    'UNIT_TEST_EXACT_TEXT_PREVIEW',
    'ADMITTED_STAGING_SOURCE_PREVIEW',
  ].includes(previewScope)) {
    throw new TypeError('F27 preview scope is invalid');
  }
  return freeze({
    schema_version: 'QXO_CAPITALISATION_PREVIEW_F27/V1',
    preview_scope: previewScope,
    release_id: release.release_id,
    release_manifest_id: release.manifest.release_manifest_id,
    release_state: release.manifest.release_state,
    contract_fingerprint: release.manifest.contract_fingerprint,
    provision_row: release.provision_row,
    surfaces: SURFACES,
    authority: release.manifest.authority,
  });
}

module.exports = {
  AUTHORITY_SCOPE,
  CLASS_KEYS,
  MAX_RESULT_BYTES,
  SURFACES,
  buildQxoCapitalisationCrossViewReleaseF27,
  buildQxoCapitalisationF27Preview,
  compileQxoCapitalisationF27MarketRequest,
  executeQxoCapitalisationF27MarketRequest,
  prepareQxoCapitalisationF27SubrowsForRendering,
  validateQxoCapitalisationCrossViewReleaseF27,
  validateQxoCapitalisationF27MarketResult,
};
