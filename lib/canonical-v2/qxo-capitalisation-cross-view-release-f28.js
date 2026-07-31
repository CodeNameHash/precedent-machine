const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  buildQxoCapitalisationCrossViewReleaseF27,
} = require('./qxo-capitalisation-cross-view-release-f27');
const {
  buildQxoReviewedCapitalisationF27,
} = require('./reviewed-qxo-capitalisation-f27');
const {
  BUYER_GROUP_PARTY,
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  COMPANY_PARTY,
  REVIEW_VERSION,
  validateQxoReviewedCapitalisationF28,
} = require('./reviewed-qxo-capitalisation-f28');
const {
  METRIC_DEFINITIONS,
  RESULT_DEFINITION_V3,
} = require('./qxo-capitalisation-contract-input-validator');

const AUTHORITY_SCOPE =
  'OFFLINE_QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28_ONLY';
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const VALUE_SLOT_KEYS = Object.freeze([
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  'CAPITALISATION_MEASUREMENT_DATE',
  'GENERAL_KNOWLEDGE_QUALIFIER',
  'GENERAL_MATERIALITY_QUALIFIER',
  'RETROSPECTIVE_LOOKBACK',
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
const DEFAULT_FILTERS = Object.freeze(Object.fromEntries(
  FILTER_KEYS.map((key) => [key, null]),
));
const CANONICAL_DECIMAL_RE = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const MAX_RESULT_BYTES = 512 * 1024;
const MAX_LOCAL_INFLIGHT_MARKET_REQUESTS = 4;
const MARKET_REQUEST_TIMEOUT_MS = 15000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 30000;
const CIRCUIT_OPEN_MS = 30000;
const SHA256_RE = /^[a-f0-9]{64}$/;
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
const SUBJECT_INCLUSION_POLICY =
  'INCLUDE_IF_ELIGIBLE_COMPARABLE_AND_IN_CORPUS';
const SUBJECT_EXCLUSION_REASON_PREFIXES = Object.freeze([
  'SELECTED_NARROWER_COHORT:',
  'TYPED_NON_COMPARABILITY:',
]);

function clone(value) {
  return JSON.parse(canonicalJson(value));
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

function requireContentIdentity(value, idKey, domain, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} is not an object`);
  }
  const body = clone(value);
  const identity = body[idKey];
  delete body[idKey];
  if (identity !== contentId(domain, body)) {
    throw new TypeError(`${label} identity has drifted`);
  }
}

function byId(values, key) {
  return new Map(values.map((entry) => [entry[key], entry]));
}

function metricDefinitionMap(reviewedGraph) {
  return new Map(reviewedGraph.metric_contracts.map((entry) => [
    entry.stable_id,
    entry.authored_definition,
  ]));
}

function exactDetail(detail) {
  return {
    ...clone(detail),
  };
}

function predecessorRelease(inputs, reviewedGraph) {
  const predecessorGraph = buildQxoReviewedCapitalisationF27(inputs);
  if (
    predecessorGraph.qxo_reviewed_capitalisation_f27_id
      !== reviewedGraph.predecessor_reviewed_graph_id
    || predecessorGraph.canonical_payload_digest
      !== reviewedGraph.predecessor_reviewed_graph_payload_digest
  ) {
    throw new TypeError('the F28 predecessor reviewed graph has drifted');
  }
  return buildQxoCapitalisationCrossViewReleaseF27({
    reviewedGraph: predecessorGraph,
    sourceContext: inputs.sourceContext,
    parserSourceClosure: inputs.parserSourceClosure,
    contractBundle: inputs.contractBundle,
  });
}

function metricBindings(reviewedGraph) {
  const definitions = metricDefinitionMap(reviewedGraph);
  const slots =
    reviewedGraph.result_contract.authored_definition.market_metric_slots;
  const values = [];
  for (const slot of slots) {
    for (const metricKey of slot.metric_keys) {
      const definition = definitions.get(metricKey);
      if (!definition) {
        throw new TypeError(`F28 metric definition is absent: ${metricKey}`);
      }
      values.push({
        value_slot_key: slot.value_slot_key,
        comparison_class_key: slot.comparison_class_key,
        metric_key: metricKey,
        metric_version: definition.metric_version,
        metric_definition: clone(definition),
        metric_definition_digest: contentId(
          'QXO_CAPITALISATION_METRIC_DEFINITION_F28/V1',
          definition,
        ),
        display_ordinal: values.length,
      });
    }
  }
  if (
    values.length !== 14
    || values.some((entry, index) => entry.display_ordinal !== index)
  ) {
    throw new TypeError('the F28 metric slot inventory is not exact');
  }
  return values;
}

function sourceLineage(reviewedGraph, subrow, input) {
  return {
    reviewed_graph_id:
      reviewedGraph.qxo_reviewed_capitalisation_f28_id,
    reviewed_graph_payload_digest:
      reviewedGraph.canonical_payload_digest,
    predecessor_reviewed_graph_id:
      reviewedGraph.predecessor_reviewed_graph_id,
    predecessor_reviewed_graph_payload_digest:
      reviewedGraph.predecessor_reviewed_graph_payload_digest,
    parser_source_closure_id: reviewedGraph.parser_source_closure_id,
    source_context_id: reviewedGraph.source_context_id,
    canonical_text_id: reviewedGraph.canonical_text_id,
    document_hash: reviewedGraph.document_hash,
    claim_revision_ids: clone(input.claim_revision_ids),
    relationship_revision_ids: clone(input.relationship_revision_ids),
    evidence_reference_ids: clone(
      subrow.source.evidence_reference_ids,
    ),
    exact_detail_reference_id:
      subrow.source.exact_detail.exact_detail_reference_id,
    derivation_version: REVIEW_VERSION,
  };
}

function subjectValue(reviewedGraph, subrow, binding) {
  const input = reviewedGraph.result_inputs.find(
    (entry) => entry.value_slot_key === binding.value_slot_key,
  );
  const claims = byId(reviewedGraph.claims, 'claim_revision_id');
  const relationships = byId(
    reviewedGraph.relationships,
    'relationship_revision_id',
  );
  const selectedClaims = input.claim_revision_ids.map((id) => claims.get(id));
  const selectedRelationships =
    input.relationship_revision_ids.map((id) => relationships.get(id));
  const accuracy = selectedClaims.find(
    (entry) => entry?.claim_definition_key
      === 'REPRESENTATION_ACCURACY_STANDARD',
  );
  const exception = selectedClaims.find(
    (entry) => entry?.claim_definition_key
      === 'REPRESENTATION_ACCURACY_EXCEPTION',
  );
  const bringDown = selectedRelationships.find(
    (entry) => entry?.relationship_definition_key === 'BRINGS_DOWN',
  );
  const claim = selectedClaims[0];
  const common = {
    party: binding.comparison_class_key
      ? clone(BUYER_GROUP_PARTY)
      : clone(COMPANY_PARTY),
    result_party: clone(BUYER_GROUP_PARTY),
    representation_maker: clone(COMPANY_PARTY),
    source_lineage: sourceLineage(
      reviewedGraph,
      subrow,
      input,
    ),
  };
  switch (binding.metric_key) {
    case 'REPRESENTATION_ACCURACY_STANDARD':
      return {
        ...common,
        terminal_kind: 'OBSERVATION',
        state: 'PRESENT',
        raw_value: accuracy.raw_value,
        canonical_value: accuracy.canonical_value,
        canonical_unit: 'ACCURACY_STANDARD_CODE',
        semantic_terms: {},
      };
    case 'REPRESENTATION_ACCURACY_EXCEPTION':
      return {
        ...common,
        terminal_kind: 'OBSERVATION',
        state: exception ? 'PRESENT' : 'ABSENT',
        raw_value: exception?.raw_value || null,
        canonical_value: exception?.canonical_value || null,
        canonical_unit: 'ACCURACY_EXCEPTION_CODE',
        semantic_terms: {},
      };
    case 'REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR':
      return exception
        ? {
          ...common,
          terminal_kind: 'OBSERVATION',
          state: 'PRESENT',
          raw_value: exception.raw_value,
          canonical_value: {
            basis: exception.denominator.basis,
            party_value: exception.denominator.party_value,
          },
          canonical_unit: 'DENOMINATOR_BASIS_AND_PARTY',
          semantic_terms: {},
        }
        : {
          ...common,
          terminal_kind: 'EXCLUSION',
          state: 'NOT_APPLICABLE',
          raw_value: null,
          canonical_value: null,
          canonical_unit: 'DENOMINATOR_BASIS_AND_PARTY',
          semantic_terms: {
            reason_code: 'ACCURACY_EXCEPTION_ABSENT',
          },
        };
    case 'DATED_REPRESENTATION_TREATMENT':
      return {
        ...common,
        terminal_kind: 'OBSERVATION',
        state: 'PRESENT',
        raw_value: bringDown.raw_scope,
        canonical_value:
          bringDown.effect.dated_representation_proviso.application,
        canonical_unit: 'DATED_REPRESENTATION_TREATMENT_CODE',
        semantic_terms: {
          evidence_excerpt_id:
            bringDown.effect.dated_representation_proviso
              .evidence_excerpt_id,
        },
      };
    case 'REPRESENTATION_MATERIALITY_SCRAPE':
      return {
        ...common,
        terminal_kind: 'OBSERVATION',
        state: 'PRESENT',
        raw_value: bringDown.raw_scope,
        canonical_value: bringDown.effect.materiality_scrape.state,
        canonical_unit: 'MATERIALITY_SCRAPE_STATE',
        semantic_terms: {
          disregarded_qualifier_codes: clone(
            bringDown.effect.materiality_scrape
              .disregarded_qualifier_codes,
          ),
          evidence_excerpt_id:
            bringDown.effect.materiality_scrape.evidence_excerpt_id,
        },
      };
    case 'REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET':
      return {
        ...common,
        terminal_kind: 'OBSERVATION',
        state: claim.state,
        raw_value: claim.raw_value,
        canonical_value: claim.attributes.signing_relative_offset,
        canonical_unit: 'CALENDAR_DAYS_RELATIVE_TO_SIGNING',
        semantic_terms: {
          raw_measurement_date: claim.attributes.raw_measurement_date,
          signing_date: claim.attributes.signing_date,
          day_basis: claim.attributes.day_basis,
          semantic_class: claim.attributes.semantic_class,
          precision: claim.attributes.precision,
        },
      };
    case 'KNOWLEDGE_QUALIFIER_STATE':
    case 'GENERAL_MATERIALITY_QUALIFIER_STATE':
    case 'RETROSPECTIVE_LOOKBACK_STATE':
      return {
        ...common,
        terminal_kind: 'OBSERVATION',
        state: claim.state,
        raw_value: claim.raw_value,
        canonical_value: claim.canonical_value,
        canonical_unit: 'CLAIM_STATE',
        semantic_terms: {
          scope_closure_id: claim.scope.scope_closure_id,
          coverage_status: claim.scope.coverage_status,
        },
      };
    default:
      throw new TypeError(`unsupported F28 metric: ${binding.metric_key}`);
  }
}

function buildAdmission(reviewedGraph, binding, subrow) {
  const subject = subjectValue(reviewedGraph, subrow, binding);
  const body = {
    schema_version: 'METRIC_SERVING_ADMISSION_F28/V1',
    authority_scope: AUTHORITY_SCOPE,
    result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
    result_version: 3,
    concept_key: 'COND-B-REP',
    value_slot_key: binding.value_slot_key,
    comparison_class_key: binding.comparison_class_key,
    metric_key: binding.metric_key,
    metric_version: binding.metric_version,
    metric_definition_digest: binding.metric_definition_digest,
    display_ordinal: binding.display_ordinal,
    party: clone(subject.party),
    result_party: clone(subject.result_party),
    canonical_unit: subject.canonical_unit,
    value_dimension: binding.metric_definition.value_dimension,
    allowed_observation_states: clone(
      binding.metric_definition.allowed_observation_states || [],
    ),
    allowed_slot_exclusion_states: clone(
      binding.metric_definition.allowed_slot_exclusion_states || [],
    ),
    allowed_canonical_values: clone(
      binding.metric_definition.allowed_canonical_values || [],
    ),
    allowed_basis_codes: clone(
      binding.metric_definition.allowed_basis_codes || [],
    ),
    allowed_denominator_party_values: clone(
      binding.metric_definition.allowed_denominator_party_values || [],
    ),
    derivation_versions: [REVIEW_VERSION],
    authority: clone(AUTHORITY_NONE),
  };
  return freeze({
    ...body,
    metric_serving_admission_id: contentId(
      'METRIC_SERVING_ADMISSION_F28/V1',
      body,
    ),
  });
}

function buildTerminal({
  releaseId,
  reviewedGraph,
  binding,
  admission,
  subrow,
}) {
  const subject = subjectValue(reviewedGraph, subrow, binding);
  const body = {
    schema_version: subject.terminal_kind === 'OBSERVATION'
      ? 'MARKET_OBSERVATION_F28/V1'
      : 'MARKET_METRIC_SLOT_EXCLUSION_F28/V1',
    release_id: releaseId,
    governed_deal_key: 'deal:qxo-topbuild',
    concept_key: 'COND-B-REP',
    value_slot_key: binding.value_slot_key,
    comparison_class_key: binding.comparison_class_key,
    metric_key: binding.metric_key,
    metric_version: binding.metric_version,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    party: clone(subject.party),
    result_party: clone(subject.result_party),
    representation_maker: clone(subject.representation_maker),
    state: subject.state,
    raw_value: clone(subject.raw_value),
    canonical_value: clone(subject.canonical_value),
    canonical_unit: subject.canonical_unit,
    semantic_terms: clone(subject.semantic_terms),
    source_lineage: clone(subject.source_lineage),
    deal_weight: subject.terminal_kind === 'OBSERVATION' ? 1 : 0,
    cohort_membership:
      subject.terminal_kind === 'OBSERVATION' ? 'ELIGIBLE' : 'NONE',
    aggregate_authority:
      subject.terminal_kind === 'OBSERVATION' ? 'INACTIVE_ONLY' : 'NONE',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  };
  const idKey = subject.terminal_kind === 'OBSERVATION'
    ? 'market_observation_id'
    : 'market_metric_slot_exclusion_id';
  const domain = subject.terminal_kind === 'OBSERVATION'
    ? 'MARKET_OBSERVATION_F28/V1'
    : 'MARKET_METRIC_SLOT_EXCLUSION_F28/V1';
  return freeze({
    ...body,
    [idKey]: contentId(domain, body),
  });
}

function terminalId(terminal) {
  return terminal.market_observation_id
    || terminal.market_metric_slot_exclusion_id;
}

function subjectCohortMembership(terminal) {
  if (terminal.schema_version === 'MARKET_OBSERVATION_F28/V1') {
    return {
      status: 'INCLUDED',
      exclusion_reason: null,
    };
  }
  return {
    status: 'EXCLUDED',
    exclusion_reason:
      `TYPED_NON_COMPARABILITY:${terminal.semantic_terms.reason_code}`,
  };
}

function validSubjectCohortMembership(value) {
  if (!exactKeys(value, ['status', 'exclusion_reason'])) return false;
  if (value.status === 'INCLUDED') return value.exclusion_reason === null;
  return value.status === 'EXCLUDED'
    && typeof value.exclusion_reason === 'string'
    && SUBJECT_EXCLUSION_REASON_PREFIXES.some(
      (prefix) => value.exclusion_reason.startsWith(prefix)
        && value.exclusion_reason.length > prefix.length,
    );
}

function subjectMetricDistribution(terminal, valueDimension) {
  const membership = subjectCohortMembership(terminal);
  if (membership.status === 'EXCLUDED') {
    return {
      subject_cohort_membership: membership,
      counts: {
        eligible_deals: 1,
        comparable_deals: 0,
        excluded_deals: 1,
        independent_peer_count: 0,
      },
      state_groups: [],
      value_groups: [],
      numeric_summary: null,
    };
  }
  const present = terminal.state === 'PRESENT';
  return {
    subject_cohort_membership: membership,
    counts: {
      eligible_deals: 1,
      comparable_deals: 1,
      excluded_deals: 0,
      independent_peer_count: 0,
    },
    state_groups: [{
      state: terminal.state,
      deal_count: 1,
      percentage: '100',
    }],
    value_groups: present ? [{
      state: 'PRESENT',
      canonical_value: clone(terminal.canonical_value),
      deal_count: 1,
      percentage: '100',
    }] : [],
    numeric_summary:
      present && valueDimension === 'SIGNED_DURATION'
        ? {
          count: 1,
          min: terminal.canonical_value,
          max: terminal.canonical_value,
          median: terminal.canonical_value,
          mean: String(terminal.canonical_value),
        }
        : null,
  };
}

function emptyMarketContext(bindings, admissionByOrdinal, terminalByOrdinal) {
  return {
    display_priority: 'PRIMARY_TERM_COMPARISON',
    subject_deal_included: true,
    subject_cohort_membership: {
      status: 'INCLUDED',
      exclusion_reason: null,
    },
    state: 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
    reason_code: 'ZERO_INDEPENDENT_COMPARABLE_DEALS',
    counts: {
      eligible_deals: 1,
      comparable_deals: 1,
      independent_peer_count: 0,
      excluded_subject_deals: 0,
    },
    metric_results: bindings.map((binding) => {
      const terminal = terminalByOrdinal.get(binding.display_ordinal);
      const admission = admissionByOrdinal.get(binding.display_ordinal);
      const projection = subjectMetricDistribution(
        terminal,
        admission.value_dimension,
      );
      const membership = projection.subject_cohort_membership;
      return {
        schema_version: 'CAPITALISATION_SUBROW_MARKET_CONTEXT_F28/V1',
        metric_key: binding.metric_key,
        metric_version: binding.metric_version,
        comparison_class_key: binding.comparison_class_key,
        metric_serving_admission_id:
          admission.metric_serving_admission_id,
        subject_metric_output_id: terminalId(terminal),
        subject_state: terminal.state,
        subject_cohort_membership: membership,
        result_state: membership.status === 'INCLUDED'
          ? 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS'
          : 'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY',
        counts: projection.counts,
        state_groups: projection.state_groups,
        value_groups: projection.value_groups,
        numeric_summary: projection.numeric_summary,
        reason_code: membership.status === 'INCLUDED'
          ? 'ZERO_INDEPENDENT_COMPARABLE_DEALS'
          : membership.exclusion_reason,
      };
    }),
  };
}

function buildQxoCapitalisationCrossViewReleaseF28({
  reviewedGraph,
  sourceContext,
  parserSourceClosure,
  contractBundle,
} = {}) {
  const inputs = { sourceContext, parserSourceClosure, contractBundle };
  validateQxoReviewedCapitalisationF28({
    candidate: reviewedGraph,
    ...inputs,
  });
  const predecessor = predecessorRelease(inputs, reviewedGraph);
  const bindings = metricBindings(reviewedGraph);
  const subrowByKey = byId(
    predecessor.provision_row.subrows,
    'value_slot_key',
  );
  const admissions = bindings.map((binding) => buildAdmission(
    reviewedGraph,
    binding,
    subrowByKey.get(binding.value_slot_key),
  ));
  const releaseId = contentId('QXO_CAPITALISATION_RELEASE_F28/V1', {
    reviewed_graph_id:
      reviewedGraph.qxo_reviewed_capitalisation_f28_id,
    reviewed_graph_payload_digest:
      reviewedGraph.canonical_payload_digest,
    metric_serving_admission_ids:
      admissions.map((entry) => entry.metric_serving_admission_id),
  });
  const terminals = bindings.map((binding, index) => buildTerminal({
    releaseId,
    reviewedGraph,
    binding,
    admission: admissions[index],
    subrow: subrowByKey.get(binding.value_slot_key),
  }));
  const admissionByOrdinal = new Map(
    admissions.map((entry) => [entry.display_ordinal, entry]),
  );
  const terminalByOrdinal = new Map(
    bindings.map((entry, index) => [
      entry.display_ordinal,
      terminals[index],
    ]),
  );
  const enrichedSubrows = predecessor.provision_row.subrows.map((subrow) => {
    const subrowBindings = bindings.filter(
      (entry) => entry.value_slot_key === subrow.value_slot_key,
    );
    const body = {
      ...clone(subrow),
      schema_version: 'CAPITALISATION_SUBROW_F28/V1',
      predecessor_subrow_id: subrow.subrow_id,
      market_context: emptyMarketContext(
        subrowBindings,
        admissionByOrdinal,
        terminalByOrdinal,
      ),
      source: {
        ...clone(subrow.source),
        exact_detail: exactDetail(subrow.source.exact_detail),
      },
    };
    delete body.subrow_id;
    return freeze({
      ...body,
      subrow_id: contentId('CAPITALISATION_SUBROW_F28/V1', body),
    });
  });
  const provisionBody = {
    ...clone(predecessor.provision_row),
    schema_version: 'CAPITALISATION_SHARED_PROVISION_ROW_F28/V1',
    release_id: releaseId,
    predecessor_provision_row_id:
      predecessor.provision_row.provision_row_id,
    subrows: enrichedSubrows,
    generic_no_market_data_authority: 'FORBIDDEN',
    market_metric_slot_count: 14,
    market_request_shape: 'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
  };
  delete provisionBody.provision_row_id;
  const provisionRow = freeze({
    ...provisionBody,
    provision_row_id: contentId(
      'CAPITALISATION_SHARED_PROVISION_ROW_F28/V1',
      provisionBody,
    ),
  });
  const observations = terminals.filter(
    (entry) => entry.schema_version === 'MARKET_OBSERVATION_F28/V1',
  );
  const exclusions = terminals.filter(
    (entry) => entry.schema_version
      === 'MARKET_METRIC_SLOT_EXCLUSION_F28/V1',
  );
  const manifestBody = {
    schema_version: 'QXO_CAPITALISATION_RELEASE_MANIFEST_F28/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id: releaseId,
    release_state: 'INACTIVE_CANDIDATE',
    activation_eligibility: 'INELIGIBLE_EXPLICIT_ACTIVATION_REQUIRED',
    reviewed_graph_id:
      reviewedGraph.qxo_reviewed_capitalisation_f28_id,
    reviewed_graph_payload_digest:
      reviewedGraph.canonical_payload_digest,
    result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
    result_version: 3,
    metric_serving_admission_ids:
      admissions.map((entry) => entry.metric_serving_admission_id),
    market_observation_ids:
      observations.map((entry) => entry.market_observation_id),
    market_metric_slot_exclusion_ids:
      exclusions.map((entry) => entry.market_metric_slot_exclusion_id),
    provision_row_id: provisionRow.provision_row_id,
    counts: {
      deals: 1,
      provision_rows: 1,
      subrows: 6,
      metric_slots: 14,
      metric_admissions: 14,
      market_observations: 13,
      market_metric_slot_exclusions: 1,
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
        'RELEASE_METRIC_SLOTS_PARTY_SUBJECT_FILTERS_DERIVATIONS',
    },
    authority: clone(AUTHORITY_NONE),
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'P1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED',
        'F28_SET_BASED_SERVING_RPC_NOT_CERTIFIED',
        'F28_GLOBAL_DATABASE_CAPACITY_NOT_CERTIFIED',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  const manifest = freeze({
    ...manifestBody,
    release_manifest_id: contentId(
      'QXO_CAPITALISATION_RELEASE_MANIFEST_F28/V1',
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_RELEASE_MANIFEST_F28_PAYLOAD/V1',
      manifestBody,
    ),
  });
  const surfaceBindings = freeze(Object.fromEntries(SURFACES.map(
    (surface) => [surface, {
      schema_version: 'CAPITALISATION_SURFACE_BINDING_F28/V1',
      surface,
      release_id: releaseId,
      release_manifest_id: manifest.release_manifest_id,
      provision_row_id: provisionRow.provision_row_id,
      provision_row: provisionRow,
      serving_role: 'INACTIVE_STAGING_ACCEPTANCE_ONLY',
    }],
  )));
  const body = {
    schema_version: 'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id: releaseId,
    admissions,
    observations,
    exclusions,
    provision_row: provisionRow,
    surface_bindings: surfaceBindings,
    manifest,
  };
  return freeze({
    ...body,
    qxo_capitalisation_cross_view_release_f28_id: contentId(
      'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoCapitalisationCrossViewReleaseF28({
  candidate,
  ...inputs
} = {}) {
  const expected = buildQxoCapitalisationCrossViewReleaseF28(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F28 cross-view release has drifted');
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
    throw new TypeError('F28 filters are outside the closed contract');
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
      throw new TypeError(`${key} is outside the F28 filter contract`);
    }
  }
  for (const key of ['year_from', 'year_to']) {
    if (value[key] !== null
      && (!Number.isInteger(value[key])
        || value[key] < 1900
        || value[key] > 2100)) {
      throw new TypeError(`${key} is outside the F28 filter contract`);
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
      throw new TypeError(`${key} is outside the F28 filter contract`);
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

function expectedMetricInventory() {
  const definitions = new Map(METRIC_DEFINITIONS.map((entry) => [
    entry.stable_id,
    entry.authored_definition,
  ]));
  const values = [];
  for (const slot of RESULT_DEFINITION_V3.authored_definition
    .market_metric_slots) {
    for (const metricKey of slot.metric_keys) {
      const definition = definitions.get(metricKey);
      values.push({
        value_slot_key: slot.value_slot_key,
        comparison_class_key: slot.comparison_class_key,
        metric_key: metricKey,
        metric_version: definition.metric_version,
        metric_definition: definition,
        metric_definition_digest: contentId(
          'QXO_CAPITALISATION_METRIC_DEFINITION_F28/V1',
          definition,
        ),
        display_ordinal: values.length,
      });
    }
  }
  return values;
}

function validateReleaseEnvelope(release) {
  if (
    !exactKeys(release, [
      'schema_version',
      'authority_scope',
      'release_id',
      'admissions',
      'observations',
      'exclusions',
      'provision_row',
      'surface_bindings',
      'manifest',
      'qxo_capitalisation_cross_view_release_f28_id',
      'canonical_payload_digest',
    ])
    || release.schema_version
      !== 'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1'
    || release.authority_scope !== AUTHORITY_SCOPE
    || release.manifest?.release_state !== 'INACTIVE_CANDIDATE'
    || release.admissions?.length !== 14
    || release.observations?.length !== 13
    || release.exclusions?.length !== 1
    || release.provision_row?.subrows?.length !== 6
    || canonicalJson(Object.keys(release.surface_bindings || {}).sort())
      !== canonicalJson(SURFACES)
    || Object.values(release.manifest.authority).some(
      (value) => value !== 'NONE',
    )
  ) {
    throw new TypeError('invalid F28 release envelope');
  }
  const inventory = expectedMetricInventory();
  const terminalByAdmission = new Map([
    ...release.observations,
    ...release.exclusions,
  ].map((entry) => [entry.metric_serving_admission_id, entry]));
  if (terminalByAdmission.size !== 14) {
    throw new TypeError('F28 terminal admissions are duplicated');
  }
  for (const [index, admission] of release.admissions.entries()) {
    const expected = inventory[index];
    const definition = expected.metric_definition;
    requireContentIdentity(
      admission,
      'metric_serving_admission_id',
      'METRIC_SERVING_ADMISSION_F28/V1',
      `F28 metric admission ${index}`,
    );
    if (
      admission.schema_version !== 'METRIC_SERVING_ADMISSION_F28/V1'
      || admission.authority_scope !== AUTHORITY_SCOPE
      || admission.result_key !== 'TARGET_CAPITALISATION_BRING_DOWN'
      || admission.result_version !== 3
      || admission.concept_key !== 'COND-B-REP'
      || admission.value_slot_key !== expected.value_slot_key
      || admission.comparison_class_key
        !== expected.comparison_class_key
      || admission.metric_key !== expected.metric_key
      || admission.metric_version !== expected.metric_version
      || admission.metric_definition_digest
        !== expected.metric_definition_digest
      || admission.display_ordinal !== index
      || admission.canonical_unit !== definition.canonical_unit
      || admission.value_dimension !== definition.value_dimension
      || canonicalJson(admission.allowed_observation_states)
        !== canonicalJson(definition.allowed_observation_states || [])
      || canonicalJson(admission.allowed_slot_exclusion_states)
        !== canonicalJson(definition.allowed_slot_exclusion_states || [])
      || canonicalJson(admission.allowed_canonical_values)
        !== canonicalJson(definition.allowed_canonical_values || [])
      || canonicalJson(admission.allowed_basis_codes)
        !== canonicalJson(definition.allowed_basis_codes || [])
      || canonicalJson(admission.allowed_denominator_party_values)
        !== canonicalJson(
          definition.allowed_denominator_party_values || [],
        )
      || canonicalJson(admission.party) !== canonicalJson(
        expected.comparison_class_key
          ? BUYER_GROUP_PARTY
          : COMPANY_PARTY,
      )
      || canonicalJson(admission.result_party)
        !== canonicalJson(BUYER_GROUP_PARTY)
      || canonicalJson(admission.derivation_versions)
        !== canonicalJson([REVIEW_VERSION])
      || Object.values(admission.authority).some(
        (authority) => authority !== 'NONE',
      )
    ) {
      throw new TypeError(`F28 metric admission ${index} has drifted`);
    }
    const terminal = terminalByAdmission.get(
      admission.metric_serving_admission_id,
    );
    if (!terminal) {
      throw new TypeError(`F28 metric terminal ${index} is absent`);
    }
    const isObservation =
      terminal.schema_version === 'MARKET_OBSERVATION_F28/V1';
    const idKey = isObservation
      ? 'market_observation_id'
      : 'market_metric_slot_exclusion_id';
    const domain = isObservation
      ? 'MARKET_OBSERVATION_F28/V1'
      : 'MARKET_METRIC_SLOT_EXCLUSION_F28/V1';
    requireContentIdentity(terminal, idKey, domain, `F28 terminal ${index}`);
    if (
      terminal.release_id !== release.release_id
      || terminal.governed_deal_key !== 'deal:qxo-topbuild'
      || terminal.concept_key !== 'COND-B-REP'
      || terminal.value_slot_key !== admission.value_slot_key
      || terminal.comparison_class_key
        !== admission.comparison_class_key
      || terminal.metric_key !== admission.metric_key
      || terminal.metric_version !== admission.metric_version
      || canonicalJson(terminal.party) !== canonicalJson(admission.party)
      || canonicalJson(terminal.result_party)
        !== canonicalJson(admission.result_party)
      || canonicalJson(terminal.representation_maker)
        !== canonicalJson(COMPANY_PARTY)
      || terminal.canonical_unit !== admission.canonical_unit
      || terminal.source_lineage?.derivation_version !== REVIEW_VERSION
      || terminal.source_lineage?.document_hash
        !== release.provision_row.document_hash
      || terminal.active_release_authority !== 'NONE'
      || terminal.production_activation_authority !== 'NONE'
      || (
        isObservation
        && (
          !admission.allowed_observation_states.includes(terminal.state)
          || terminal.deal_weight !== 1
          || terminal.cohort_membership !== 'ELIGIBLE'
          || terminal.aggregate_authority !== 'INACTIVE_ONLY'
        )
      )
      || (
        !isObservation
        && (
          !admission.allowed_slot_exclusion_states.includes(terminal.state)
          || terminal.deal_weight !== 0
          || terminal.cohort_membership !== 'NONE'
          || terminal.aggregate_authority !== 'NONE'
        )
      )
    ) {
      throw new TypeError(`F28 metric terminal ${index} has drifted`);
    }
  }
  const exclusion = release.exclusions[0];
  if (
    exclusion.metric_key
      !== 'REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR'
    || exclusion.value_slot_key !== CLAUSE_C_CLASS
    || exclusion.comparison_class_key !== CLAUSE_C_CLASS
    || exclusion.state !== 'NOT_APPLICABLE'
    || exclusion.semantic_terms?.reason_code
      !== 'ACCURACY_EXCEPTION_ABSENT'
  ) {
    throw new TypeError('F28 typed metric exclusion has drifted');
  }
  const row = release.provision_row;
  requireContentIdentity(
    row,
    'provision_row_id',
    'CAPITALISATION_SHARED_PROVISION_ROW_F28/V1',
    'F28 provision row',
  );
  if (
    row.release_id !== release.release_id
    || row.governed_deal_key !== 'deal:qxo-topbuild'
    || row.generic_no_market_data_authority !== 'FORBIDDEN'
    || row.market_metric_slot_count !== 14
    || row.market_request_shape !== 'ONE_INDEXED_SET_BASED_SQL_OR_RPC'
    || canonicalJson(row.subrows.map((entry) => entry.value_slot_key))
      !== canonicalJson(VALUE_SLOT_KEYS)
  ) {
    throw new TypeError('F28 provision row semantics have drifted');
  }
  for (const [index, subrow] of row.subrows.entries()) {
    requireContentIdentity(
      subrow,
      'subrow_id',
      'CAPITALISATION_SUBROW_F28/V1',
      `F28 subrow ${index}`,
    );
    const expectedBindings = release.admissions.filter(
      (entry) => entry.value_slot_key === subrow.value_slot_key,
    );
    if (
      subrow.display_ordinal !== index
      || subrow.source?.document_hash !== row.document_hash
      || subrow.market_context?.display_priority
        !== 'PRIMARY_TERM_COMPARISON'
      || subrow.market_context?.subject_deal_included !== true
      || !validSubjectCohortMembership(
        subrow.market_context?.subject_cohort_membership,
      )
      || subrow.market_context?.subject_cohort_membership.status
        !== 'INCLUDED'
      || subrow.market_context?.state
        !== 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS'
      || subrow.market_context?.reason_code
        !== 'ZERO_INDEPENDENT_COMPARABLE_DEALS'
      || subrow.market_context?.counts?.eligible_deals !== 1
      || subrow.market_context?.counts?.comparable_deals !== 1
      || subrow.market_context?.counts?.independent_peer_count !== 0
      || subrow.market_context?.counts?.excluded_subject_deals !== 0
      || subrow.market_context?.metric_results?.length
        !== expectedBindings.length
    ) {
      throw new TypeError(`F28 subrow ${index} market context has drifted`);
    }
    for (const [metricIndex, metric] of
      subrow.market_context.metric_results.entries()) {
      const admission = expectedBindings[metricIndex];
      const terminal = terminalByAdmission.get(
        admission.metric_serving_admission_id,
      );
      const expectedMembership = subjectCohortMembership(terminal);
      const expectedProjection = subjectMetricDistribution(
        terminal,
        admission.value_dimension,
      );
      if (
        metric.metric_key !== admission.metric_key
        || metric.metric_version !== admission.metric_version
        || metric.comparison_class_key
          !== admission.comparison_class_key
        || metric.metric_serving_admission_id
          !== admission.metric_serving_admission_id
        || metric.subject_metric_output_id !== terminalId(terminal)
        || metric.subject_state !== terminal.state
        || canonicalJson(metric.subject_cohort_membership)
          !== canonicalJson(expectedMembership)
        || metric.result_state !== (
          expectedMembership.status === 'INCLUDED'
            ? 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS'
            : 'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY'
        )
        || metric.reason_code !== (
          expectedMembership.status === 'INCLUDED'
            ? 'ZERO_INDEPENDENT_COMPARABLE_DEALS'
            : expectedMembership.exclusion_reason
        )
        || canonicalJson(metric.counts)
          !== canonicalJson(expectedProjection.counts)
        || canonicalJson(metric.state_groups)
          !== canonicalJson(expectedProjection.state_groups)
        || canonicalJson(metric.value_groups)
          !== canonicalJson(expectedProjection.value_groups)
        || canonicalJson(metric.numeric_summary)
          !== canonicalJson(expectedProjection.numeric_summary)
      ) {
        throw new TypeError(`F28 subrow ${index} metric context has drifted`);
      }
    }
  }
  const manifestBody = clone(release.manifest);
  delete manifestBody.release_manifest_id;
  delete manifestBody.canonical_payload_digest;
  if (
    release.manifest.release_manifest_id
      !== contentId(
        'QXO_CAPITALISATION_RELEASE_MANIFEST_F28/V1',
        manifestBody,
      )
    || release.manifest.canonical_payload_digest
      !== contentId(
        'QXO_CAPITALISATION_RELEASE_MANIFEST_F28_PAYLOAD/V1',
        manifestBody,
      )
    || release.manifest.release_id !== release.release_id
    || release.manifest.result_key !== 'TARGET_CAPITALISATION_BRING_DOWN'
    || release.manifest.result_version !== 3
    || release.manifest.provision_row_id !== row.provision_row_id
    || canonicalJson(release.manifest.metric_serving_admission_ids)
      !== canonicalJson(release.admissions.map(
        (entry) => entry.metric_serving_admission_id,
      ))
    || canonicalJson(release.manifest.market_observation_ids)
      !== canonicalJson(release.observations.map(
        (entry) => entry.market_observation_id,
      ))
    || canonicalJson(release.manifest.market_metric_slot_exclusion_ids)
      !== canonicalJson(release.exclusions.map(
        (entry) => entry.market_metric_slot_exclusion_id,
      ))
  ) {
    throw new TypeError('F28 release manifest identity has drifted');
  }
  const expectedReleaseId = contentId(
    'QXO_CAPITALISATION_RELEASE_F28/V1',
    {
      reviewed_graph_id: release.manifest.reviewed_graph_id,
      reviewed_graph_payload_digest:
        release.manifest.reviewed_graph_payload_digest,
      metric_serving_admission_ids:
        release.admissions.map(
          (entry) => entry.metric_serving_admission_id,
        ),
    },
  );
  if (release.release_id !== expectedReleaseId) {
    throw new TypeError('F28 release semantic identity has drifted');
  }
  for (const surface of SURFACES) {
    const binding = release.surface_bindings[surface];
    if (
      binding?.surface !== surface
      || binding.release_id !== release.release_id
      || binding.release_manifest_id
        !== release.manifest.release_manifest_id
      || binding.provision_row_id !== row.provision_row_id
      || canonicalJson(binding.provision_row) !== canonicalJson(row)
      || binding.serving_role !== 'INACTIVE_STAGING_ACCEPTANCE_ONLY'
    ) {
      throw new TypeError(`F28 ${surface} surface binding has drifted`);
    }
  }
  const body = clone(release);
  delete body.qxo_capitalisation_cross_view_release_f28_id;
  delete body.canonical_payload_digest;
  if (
    release.qxo_capitalisation_cross_view_release_f28_id
      !== contentId('QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1', body)
    || release.canonical_payload_digest
      !== contentId(
        'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28_PAYLOAD/V1',
        body,
      )
  ) {
    throw new TypeError('F28 release identity has drifted');
  }
}

function compileQxoCapitalisationF28MarketRequest({
  release,
  filters = {},
} = {}) {
  validateReleaseEnvelope(release);
  const normalisedFilters = normaliseFilters(filters);
  const terminalByAdmission = new Map([
    ...release.observations,
    ...release.exclusions,
  ].map((entry) => [entry.metric_serving_admission_id, entry]));
  const metricBindings = release.admissions.map((admission) => {
    const terminal = terminalByAdmission.get(
      admission.metric_serving_admission_id,
    );
    if (!terminal) {
      throw new TypeError('F28 subject metric output is absent');
    }
    return {
      value_slot_key: admission.value_slot_key,
      comparison_class_key: admission.comparison_class_key,
      metric_key: admission.metric_key,
      metric_version: admission.metric_version,
      metric_serving_admission_id:
        admission.metric_serving_admission_id,
      subject_metric_output_id: terminalId(terminal),
      subject_state: terminal.state,
      subject_canonical_value: clone(terminal.canonical_value),
      subject_cohort_membership: subjectCohortMembership(terminal),
      party: clone(admission.party),
      result_party: clone(admission.result_party),
      canonical_unit: admission.canonical_unit,
      value_dimension: admission.value_dimension,
      allowed_observation_states:
        clone(admission.allowed_observation_states),
      allowed_canonical_values:
        clone(admission.allowed_canonical_values),
      allowed_basis_codes: clone(admission.allowed_basis_codes),
      allowed_denominator_party_values:
        clone(admission.allowed_denominator_party_values),
      display_ordinal: admission.display_ordinal,
      derivation_versions: clone(admission.derivation_versions),
    };
  });
  const base = {
    schema_version: 'QXO_CAPITALISATION_MARKET_REQUEST_F28/V1',
    authority_scope: AUTHORITY_SCOPE,
    release_id: release.release_id,
    release_manifest_id: release.manifest.release_manifest_id,
    subject_deal_key: release.provision_row.governed_deal_key,
    concept_key: 'COND-B-REP',
    execution_shape: 'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
    database_call_budget: 1,
    database_call_growth_with_corpus_size: 'CONSTANT',
    immediate_retries: 0,
    broad_claim_or_card_loading: false,
    subject_membership_policy: SUBJECT_INCLUSION_POLICY,
    independent_peer_count_predicate:
      'GOVERNED_DEAL_KEY_NOT_EQUAL_SUBJECT_DEAL_KEY',
    metric_bindings: metricBindings,
    filters: normalisedFilters,
  };
  const requestDigest = contentId(
    'QXO_CAPITALISATION_MARKET_REQUEST_F28/V1',
    base,
  );
  return freeze({
    ...base,
    request_digest: requestDigest,
    cache_key: contentId(
      'QXO_CAPITALISATION_MARKET_REQUEST_CACHE_F28/V1',
      {
        release_id: base.release_id,
        release_manifest_id: base.release_manifest_id,
        subject_deal_key: base.subject_deal_key,
        request_digest: requestDigest,
        metric_serving_admission_ids: metricBindings.map(
          (entry) => entry.metric_serving_admission_id,
        ),
        subject_metric_output_ids: metricBindings.map(
          (entry) => entry.subject_metric_output_id,
        ),
        filters: normalisedFilters,
      },
    ),
    execution_state: 'COMPILED_INACTIVE_CANDIDATE_SIMULATION',
    active_query_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
}

function validateSubjectMembershipVerification(value, request, binding) {
  const included = binding.subject_cohort_membership.status === 'INCLUDED';
  return exactKeys(value, [
    'subject_deal_key',
    'subject_metric_output_id',
    'membership_policy',
    'state',
    'selected_cohort_subject_deals',
    'selected_cohort_subject_metric_outputs',
    ])
    && value.subject_deal_key === request.subject_deal_key
    && value.subject_metric_output_id === binding.subject_metric_output_id
    && value.membership_policy === request.subject_membership_policy
    && value.state === (
      included ? 'INCLUDED_AND_VERIFIED' : 'EXCLUDED_WITH_TYPED_REASON'
    )
    && value.selected_cohort_subject_deals === (included ? 1 : 0)
    && value.selected_cohort_subject_metric_outputs === (included ? 1 : 0);
}

function canonicalPercentage(numerator, denominator) {
  if (!Number.isSafeInteger(numerator)
    || numerator < 0
    || !Number.isSafeInteger(denominator)
    || denominator <= 0
    || numerator > denominator) {
    throw new TypeError('F28 percentage inputs are invalid');
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

function validCanonicalGroupValue(value, binding) {
  if (binding.allowed_canonical_values.length > 0) {
    return binding.allowed_canonical_values.some(
      (allowed) => canonicalJson(allowed) === canonicalJson(value),
    );
  }
  if (binding.value_dimension === 'STATE_AND_STRUCTURED_CATEGORICAL') {
    return exactKeys(value, ['basis', 'party_value'])
      && binding.allowed_basis_codes.includes(value.basis)
      && binding.allowed_denominator_party_values.includes(
        value.party_value,
      );
  }
  if (binding.value_dimension === 'SIGNED_DURATION') {
    return Number.isSafeInteger(value);
  }
  if (binding.value_dimension === 'CLAIM_STATE') {
    return typeof value === 'boolean';
  }
  return false;
}

function validateReadySlot(slot, binding) {
  const states = new Set();
  let stateTotal = 0;
  let presentDeals = 0;
  for (const group of slot.state_groups) {
    if (
      !exactKeys(group, ['state', 'deal_count', 'percentage'])
      || !binding.allowed_observation_states.includes(group.state)
      || states.has(group.state)
      || !Number.isSafeInteger(group.deal_count)
      || group.deal_count <= 0
      || group.percentage !== canonicalPercentage(
        group.deal_count,
        slot.counts.comparable_deals,
      )
    ) {
      throw new TypeError('F28 market state group is invalid');
    }
    states.add(group.state);
    stateTotal += group.deal_count;
    if (group.state === 'PRESENT') presentDeals = group.deal_count;
  }
  const values = new Set();
  let valueTotal = 0;
  for (const group of slot.value_groups) {
    const valueKey = canonicalJson(group?.canonical_value);
    if (
      !exactKeys(group, [
        'state',
        'canonical_value',
        'deal_count',
        'percentage',
      ])
      || group.state !== 'PRESENT'
      || !validCanonicalGroupValue(group.canonical_value, binding)
      || values.has(valueKey)
      || !Number.isSafeInteger(group.deal_count)
      || group.deal_count <= 0
      || group.percentage !== canonicalPercentage(
        group.deal_count,
        slot.counts.comparable_deals,
      )
    ) {
      throw new TypeError('F28 market value group is invalid');
    }
    values.add(valueKey);
    valueTotal += group.deal_count;
  }
  if (
    stateTotal !== slot.counts.comparable_deals
    || valueTotal !== presentDeals
    || (presentDeals > 0 && slot.value_groups.length === 0)
    || (presentDeals === 0 && slot.value_groups.length !== 0)
  ) {
    throw new TypeError('F28 market groups do not reconcile');
  }
  if (binding.value_dimension === 'SIGNED_DURATION') {
    if (
      !exactKeys(slot.numeric_summary, [
        'count',
        'min',
        'max',
        'median',
        'mean',
      ])
      || slot.numeric_summary.count !== presentDeals
      || !Number.isSafeInteger(slot.numeric_summary.min)
      || !Number.isSafeInteger(slot.numeric_summary.max)
      || !Number.isSafeInteger(slot.numeric_summary.median)
      || typeof slot.numeric_summary.mean !== 'string'
      || !/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(
        slot.numeric_summary.mean,
      )
      || slot.numeric_summary.min > slot.numeric_summary.max
      || slot.numeric_summary.median < slot.numeric_summary.min
      || slot.numeric_summary.median > slot.numeric_summary.max
    ) {
      throw new TypeError('F28 numeric summary is invalid');
    }
  } else if (slot.numeric_summary !== null) {
    throw new TypeError('F28 non-numeric slot has a numeric summary');
  }
}

function validateQxoCapitalisationF28MarketResult(result, request) {
  if (
    !exactKeys(result, [
      'schema_version',
      'release_id',
      'release_manifest_id',
      'request_digest',
      'cache_key',
      'subject_deal_key',
      'slot_results',
      'canonical_payload_digest',
    ])
    || result.schema_version
      !== 'QXO_CAPITALISATION_MARKET_RESULT_F28/V1'
    || result.release_id !== request.release_id
    || result.release_manifest_id !== request.release_manifest_id
    || result.request_digest !== request.request_digest
    || result.cache_key !== request.cache_key
    || result.subject_deal_key !== request.subject_deal_key
    || !Array.isArray(result.slot_results)
    || result.slot_results.length !== 14
    || Buffer.byteLength(canonicalJson(result), 'utf8') > MAX_RESULT_BYTES
  ) {
    throw new TypeError('F28 market result identity or bounds are invalid');
  }
  for (const [index, slot] of result.slot_results.entries()) {
    const binding = request.metric_bindings[index];
    if (
      !exactKeys(slot, [
        'value_slot_key',
        'comparison_class_key',
        'metric_key',
        'metric_serving_admission_id',
        'subject_cohort_membership',
        'subject_membership_verification',
        'result_state',
        'counts',
        'state_groups',
        'value_groups',
        'numeric_summary',
        'cohort_reason_code',
        'failure_reason_code',
      ])
      || slot.value_slot_key !== binding.value_slot_key
      || slot.comparison_class_key !== binding.comparison_class_key
      || slot.metric_key !== binding.metric_key
      || slot.metric_serving_admission_id
        !== binding.metric_serving_admission_id
      || canonicalJson(slot.subject_cohort_membership)
        !== canonicalJson(binding.subject_cohort_membership)
      || !validSubjectCohortMembership(slot.subject_cohort_membership)
      || !validateSubjectMembershipVerification(
        slot.subject_membership_verification,
        request,
        binding,
      )
      || ![
        'READY',
        'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
        'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY',
        'FAILED',
      ].includes(
        slot.result_state,
      )
      || !exactKeys(slot.counts, [
        'eligible_deals',
        'comparable_deals',
        'excluded_deals',
        'independent_peer_count',
      ])
      || Object.values(slot.counts).some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      )
      || slot.counts.comparable_deals
        + slot.counts.excluded_deals
        !== slot.counts.eligible_deals
      || slot.counts.comparable_deals
        !== slot.counts.independent_peer_count
          + slot.subject_membership_verification
            .selected_cohort_subject_deals
      || !Array.isArray(slot.state_groups)
      || !Array.isArray(slot.value_groups)
    ) {
      throw new TypeError('F28 market slot is invalid or reordered');
    }
    if (
      slot.result_state === 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS'
      && (
        slot.subject_cohort_membership.status !== 'INCLUDED'
        || slot.counts.comparable_deals !== 1
        || slot.counts.independent_peer_count !== 0
        || slot.cohort_reason_code
          !== 'ZERO_INDEPENDENT_COMPARABLE_DEALS'
        || slot.failure_reason_code !== null
      )
    ) {
      throw new TypeError('F28 subject-only cohort is not reconciled');
    }
    if (
      slot.result_state === 'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY'
      && (
        slot.subject_cohort_membership.status !== 'EXCLUDED'
        || slot.counts.comparable_deals !== 0
        || slot.counts.independent_peer_count !== 0
        || slot.state_groups.length !== 0
        || slot.value_groups.length !== 0
        || slot.numeric_summary !== null
        || slot.cohort_reason_code
          !== slot.subject_cohort_membership.exclusion_reason
        || slot.failure_reason_code !== null
      )
    ) {
      throw new TypeError('F28 subject exclusion is not typed or reconciled');
    }
    if (
      slot.result_state === 'FAILED'
      && (
        slot.state_groups.length !== 0
        || slot.value_groups.length !== 0
        || slot.numeric_summary !== null
        || slot.cohort_reason_code !== null
        || typeof slot.failure_reason_code !== 'string'
        || slot.failure_reason_code.length === 0
      )
    ) {
      throw new TypeError('F28 failed metric slot is invalid');
    }
    if (
      slot.result_state === 'READY'
      && (
        slot.counts.comparable_deals === 0
        || slot.cohort_reason_code !== null
        || slot.failure_reason_code !== null
      )
    ) {
      throw new TypeError('F28 ready metric slot has invalid counts');
    }
    if ([
      'READY',
      'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
    ].includes(slot.result_state)) {
      validateReadySlot(slot, binding);
    }
  }
  const body = clone(result);
  delete body.canonical_payload_digest;
  if (
    result.canonical_payload_digest
      !== contentId(
        'QXO_CAPITALISATION_MARKET_RESULT_F28_PAYLOAD/V1',
        body,
      )
  ) {
    throw new TypeError('F28 market result payload digest has drifted');
  }
  return true;
}

async function executeQxoCapitalisationF28MarketRequest({
  release,
  filters = {},
  cache,
  rpc,
} = {}) {
  if (!cache?.get || !cache?.set || typeof rpc !== 'function') {
    throw new TypeError('F28 execution requires cache and RPC bindings');
  }
  const request = compileQxoCapitalisationF28MarketRequest({
    release,
    filters,
  });
  const cached = await cache.get(request.cache_key);
  if (cached != null) {
    validateQxoCapitalisationF28MarketResult(cached, request);
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
    throw new Error('F28_MARKET_CIRCUIT_OPEN');
  }
  if (executionGuard.inflight.size
      >= MAX_LOCAL_INFLIGHT_MARKET_REQUESTS) {
    throw new Error('F28_MARKET_AT_CAPACITY');
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
            reject(new Error('F28_MARKET_REQUEST_TIMEOUT'));
          }, MARKET_REQUEST_TIMEOUT_MS);
        }),
      ]);
      validateQxoCapitalisationF28MarketResult(received, request);
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
      if (
        executionGuard.failureTimes.length >= CIRCUIT_FAILURE_THRESHOLD
      ) {
        executionGuard.circuitOpenUntil = failedAt + CIRCUIT_OPEN_MS;
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

function buildSubjectOnlyF28MarketResult(request) {
  const body = {
    schema_version: 'QXO_CAPITALISATION_MARKET_RESULT_F28/V1',
    release_id: request.release_id,
    release_manifest_id: request.release_manifest_id,
    request_digest: request.request_digest,
    cache_key: request.cache_key,
    subject_deal_key: request.subject_deal_key,
    slot_results: request.metric_bindings.map((binding) => {
      const included =
        binding.subject_cohort_membership.status === 'INCLUDED';
      const present = binding.subject_state === 'PRESENT';
      return {
        value_slot_key: binding.value_slot_key,
        comparison_class_key: binding.comparison_class_key,
        metric_key: binding.metric_key,
        metric_serving_admission_id:
          binding.metric_serving_admission_id,
        subject_cohort_membership:
          clone(binding.subject_cohort_membership),
        subject_membership_verification: {
          subject_deal_key: request.subject_deal_key,
          subject_metric_output_id: binding.subject_metric_output_id,
          membership_policy: request.subject_membership_policy,
          state: included
            ? 'INCLUDED_AND_VERIFIED'
            : 'EXCLUDED_WITH_TYPED_REASON',
          selected_cohort_subject_deals: included ? 1 : 0,
          selected_cohort_subject_metric_outputs: included ? 1 : 0,
        },
        result_state: included
          ? 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS'
          : 'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY',
        counts: {
          eligible_deals: 1,
          comparable_deals: included ? 1 : 0,
          excluded_deals: included ? 0 : 1,
          independent_peer_count: 0,
        },
        state_groups: included ? [{
          state: binding.subject_state,
          deal_count: 1,
          percentage: '100',
        }] : [],
        value_groups: included && present ? [{
          state: 'PRESENT',
          canonical_value: clone(binding.subject_canonical_value),
          deal_count: 1,
          percentage: '100',
        }] : [],
        numeric_summary:
          included
          && present
          && binding.value_dimension === 'SIGNED_DURATION'
            ? {
              count: 1,
              min: binding.subject_canonical_value,
              max: binding.subject_canonical_value,
              median: binding.subject_canonical_value,
              mean: String(binding.subject_canonical_value),
            }
            : null,
        cohort_reason_code: included
          ? 'ZERO_INDEPENDENT_COMPARABLE_DEALS'
          : binding.subject_cohort_membership.exclusion_reason,
        failure_reason_code: null,
      };
    }),
  };
  return freeze({
    ...body,
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_MARKET_RESULT_F28_PAYLOAD/V1',
      body,
    ),
  });
}

module.exports = {
  AUTHORITY_SCOPE,
  MAX_RESULT_BYTES,
  SURFACES,
  VALUE_SLOT_KEYS,
  buildQxoCapitalisationCrossViewReleaseF28,
  buildSubjectOnlyF28MarketResult,
  compileQxoCapitalisationF28MarketRequest,
  executeQxoCapitalisationF28MarketRequest,
  validateQxoCapitalisationCrossViewReleaseF28,
  validateQxoCapitalisationF28MarketResult,
};
