const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateOfflineCandidateRelease,
} = require('./candidate-release');
const {
  validateOfflineCandidateSharedServingRow,
} = require('./shared-serving-row');
const {
  validateOfflineInterpretedQueryProjectionRecord,
} = require('./query-result');

const AUTHORITY_SCOPE = 'OFFLINE_QXO_COPY_DELIVERY_QUERY_F20_ONLY';
const F19_ID =
  '362d2a28419eb77a321267a733ba84ab6d61e44afc42a45a8d13a4ce3586afa1';
const F19_DIGEST =
  '3305e3219478034e813fa2b678eced83b06e149a282fdb82b0c8c164c302820c';
const BASE_EXECUTOR_NAME = 'canonical_v2_query_page_v2';
const BASE_EXECUTOR_DEFINITION_DIGEST =
  '09fac06072089d8446bd6a72c640d3d99c80024157ce4507d3860f4c50dd0457';
const CANDIDATE_EXECUTOR_NAME =
  'canonical_v2_staging.canonical_v2_query_page_v3_candidate';
const CANDIDATE_INDEX_NAME =
  'canonical_v2_shared_rows_query_v3_candidate_idx';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const SHA256_RE = /^[a-f0-9]{64}$/;

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

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the F20 contract`);
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    throw new TypeError(`${label} must be a full SHA-256 digest`);
  }
}

function validateF19(candidate, contractBundle) {
  if (!candidate
    || candidate.qxo_no_shop_copy_delivery_canonical_f19_id !== F19_ID
    || candidate.canonical_payload_digest !== F19_DIGEST
    || candidate.candidate_release?.manifest?.contract_fingerprint
      !== contractBundle.fingerprint) {
    throw new TypeError('F20 requires the exact reviewed F19 carrier');
  }
  const {
    qxo_no_shop_copy_delivery_canonical_f19_id: carrierId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = candidate;
  if (carrierId !== contentId(
    'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19/V1',
    body,
  )
    || payloadDigest !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19_PAYLOAD/V1',
      body,
    )) {
    throw new TypeError('the nested F19 carrier identity has drifted');
  }
  validateOfflineCandidateRelease(candidate.candidate_release);
  validateOfflineCandidateSharedServingRow(candidate.shared_row);
  validateOfflineInterpretedQueryProjectionRecord(
    candidate.query_projection,
  );
  const classDigest = candidate.cohort_request
    ?.comparability_class_digest;
  requireDigest(classDigest, 'F19 comparability_class_digest');
  if (candidate.shared_row.canonical_result?.comparability_context
    ?.comparability_class_digest !== classDigest) {
    throw new TypeError('F19 shared row comparability class drifted');
  }
}

function planNodes(value, nodes = []) {
  if (Array.isArray(value)) {
    value.forEach((child) => planNodes(child, nodes));
    return nodes;
  }
  if (!value || typeof value !== 'object') return nodes;
  if (typeof value['Node Type'] === 'string') nodes.push(value);
  Object.values(value).forEach((child) => planNodes(child, nodes));
  return nodes;
}

function validateQueryResult(result, expectedCacheState, f19, execution) {
  requireExactKeys(result, [
    'schema_version',
    'cache_state',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'query_semantics_digest',
    'total_count',
    'page_count',
    'rows',
    'cohort_summary',
    'next_cursor',
  ], `${expectedCacheState} query result`);
  if (result.schema_version !== 'CANONICAL_QUERY_PAGE_RESULT/V2'
    || result.cache_state !== expectedCacheState
    || result.serving_namespace_id !== f19.serving_namespace_id
    || result.corpus_release_id !== f19.corpus_release_id
    || result.contract_fingerprint
      !== f19.candidate_release.manifest.contract_fingerprint
    || result.query_semantics_digest
      !== execution.query_semantics_digest
    || result.total_count !== 1
    || result.page_count !== 1
    || result.next_cursor !== null
    || result.rows?.length !== 1
    || canonicalJson(result.rows[0]) !== canonicalJson(f19.shared_row)
    || Buffer.byteLength(canonicalJson(result), 'utf8')
      > MAX_RESPONSE_BYTES) {
    throw new TypeError(
      `${expectedCacheState} result crossed its governed comparability class`,
    );
  }
  const summary = result.cohort_summary;
  if (summary?.schema_version !== 'CANONICAL_QUERY_COHORT_SUMMARY/V1'
    || summary.query_semantics_digest !== execution.query_semantics_digest
    || summary.metric_key !== f19.query_projection.metric_key
    || summary.metric_version !== f19.query_projection.metric_version
    || summary.basis_key !== f19.query_projection.basis_key
    || summary.counts?.result_rows !== 1
    || summary.counts?.distinct_deals !== 1
    || summary.counts?.numeric_result_rows !== 1
    || summary.counts?.numeric_distinct_deals !== 1
    || summary.counts?.multi_value_deals !== 0
    || summary.statistics?.state !== 'AVAILABLE'
    || summary.statistics?.n_deals !== 1
    || ['min', 'p25', 'median', 'mean', 'p75', 'max']
      .some((key) => Number(summary.statistics[key]) !== 1)) {
    throw new TypeError('F20 query cohort summary is not the one-day cohort');
  }
}

function validateExecution(execution, f19) {
  requireExactKeys(execution, [
    'schema_version',
    'environment',
    'authority_scope',
    'query_semantics_digest',
    'comparability_class_digest',
    'poison_semantic_proof',
    'explained_sql_digest',
    'base_executor',
    'candidate_executor',
    'candidate_index',
    'transaction',
    'post_rollback',
  ], 'F20 staging execution');
  requireDigest(execution.query_semantics_digest, 'query_semantics_digest');
  requireDigest(execution.explained_sql_digest, 'explained_sql_digest');
  if (execution.schema_version
      !== 'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20_EXECUTION/V2'
    || execution.environment !== 'STAGING'
    || execution.authority_scope
      !== 'ROLLBACK_ONLY_STAGING_CERTIFICATION'
    || execution.comparability_class_digest
      !== f19.cohort_request.comparability_class_digest) {
    throw new TypeError('F20 execution is outside its isolated legal cohort');
  }
  requireExactKeys(execution.poison_semantic_proof, [
    'governed_dimension',
    'baseline_value',
    'alternative_value',
    'baseline_comparability_class_digest',
    'alternative_comparability_class_digest',
    'alternative_primary_semantic_class',
    'shared_row_validation',
    'interpretation_validation',
    'claim_revision_validation',
    'interpretation_identity_propagation',
    'interpretation_warning_digest_alignment',
    'review_authority',
    'warning_authority',
    'admission_state',
    'alternative_interpretation_payload_id',
    'alternative_claim_revision_id',
    'alternative_component_revision_id',
    'alternative_row_serving_key',
    'alternative_row_payload_digest',
  ], 'F20 poison semantic proof');
  const poisonProof = execution.poison_semantic_proof;
  requireDigest(
    poisonProof.alternative_comparability_class_digest,
    'alternative comparability class',
  );
  requireDigest(
    poisonProof.alternative_interpretation_payload_id,
    'alternative interpretation payload',
  );
  requireDigest(
    poisonProof.alternative_claim_revision_id,
    'alternative claim revision',
  );
  requireDigest(
    poisonProof.alternative_component_revision_id,
    'alternative component revision',
  );
  requireDigest(
    poisonProof.alternative_row_serving_key,
    'alternative row serving key',
  );
  requireDigest(
    poisonProof.alternative_row_payload_digest,
    'alternative row payload',
  );
  if (poisonProof.governed_dimension
      !== 'primary_clock_application_scope_code'
    || poisonProof.baseline_value
      !== 'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE'
    || poisonProof.alternative_value !== 'ONE_SHARED_CLOCK'
    || poisonProof.baseline_comparability_class_digest
      !== execution.comparability_class_digest
    || poisonProof.alternative_comparability_class_digest
      === execution.comparability_class_digest
    || poisonProof.alternative_primary_semantic_class
      ?.clock_application_scope_code !== 'ONE_SHARED_CLOCK'
    || poisonProof.shared_row_validation !== 'PASSED'
    || poisonProof.interpretation_validation !== 'PASSED'
    || poisonProof.claim_revision_validation !== 'PASSED'
    || poisonProof.interpretation_identity_propagation !== 'PASSED'
    || poisonProof.interpretation_warning_digest_alignment !== 'PASSED'
    || poisonProof.review_authority
      !== 'HYPOTHETICAL_NON_ADMITTED_ONLY'
    || poisonProof.warning_authority
      !== 'HYPOTHETICAL_NON_ADMITTED_ONLY'
    || poisonProof.admission_state
      !== 'HYPOTHETICAL_NON_ADMITTED_ROLLBACK_ONLY'
    || poisonProof.alternative_interpretation_payload_id
      === f19.shared_row.provenance.interpretation_payload_id
    || poisonProof.alternative_claim_revision_id
      === f19.shared_row.canonical_result.components[0]
        .claim_revision_id
    || poisonProof.alternative_component_revision_id
      === f19.shared_row.canonical_result.components[0]
        .component_revision_id) {
    throw new TypeError('F20 poison is not a coherent governed alternative');
  }
  requireExactKeys(execution.base_executor, [
    'name',
    'definition_digest',
  ], 'F20 base executor');
  if (execution.base_executor.name !== BASE_EXECUTOR_NAME
    || execution.base_executor.definition_digest
      !== BASE_EXECUTOR_DEFINITION_DIGEST) {
    throw new TypeError('F20 did not derive from the pinned V2 executor');
  }
  requireExactKeys(execution.candidate_executor, [
    'name',
    'definition',
    'security_definer',
    'public_execute_granted',
  ], 'F20 candidate executor');
  requireExactKeys(execution.candidate_index, [
    'name',
    'definition',
  ], 'F20 candidate index');
  const candidateDefinition = execution.candidate_executor.definition;
  const indexDefinition = execution.candidate_index.definition;
  const requiredIndexFields = [
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'concept_key',
    'metric_key',
    'metric_version',
    'party_role',
    'party_value',
    'party_capacity',
    'basis_key',
    'comparability_class_digest',
    'governed_deal_key',
    'row_serving_key',
  ];
  const candidateFailures = [
    execution.candidate_executor.name !== CANDIDATE_EXECUTOR_NAME
      && 'executor_name',
    execution.candidate_executor.public_execute_granted !== false
      && 'public_execute',
    execution.candidate_executor.security_definer !== false
      && 'security_definer',
    execution.candidate_index.name !== CANDIDATE_INDEX_NAME
      && 'index_name',
    !candidateDefinition.includes('p_comparability_class_digest text')
      && 'class_parameter',
    !candidateDefinition.includes(
      "'comparability_class_digest', p_comparability_class_digest",
    ) && 'cache_class',
    !candidateDefinition.includes(
      'row.comparability_class_digest = p_comparability_class_digest',
    ) && 'class_predicate',
    !candidateDefinition.includes("SET statement_timeout TO '2500ms'")
      && 'timeout',
    !candidateDefinition.includes('WITH matching_keys AS MATERIALIZED')
      && 'matching_keys',
    !candidateDefinition.includes('LIMIT p_page_size + 1') && 'page_bound',
    !candidateDefinition.includes(
      'canonical_v2_staging.query_response_cache',
    ) && 'cache_table',
    requiredIndexFields.some(
      (field) => !indexDefinition.includes(field),
    ) && 'index_fields',
    !/WHERE \(\(row_kind = 'CANONICAL_RESULT'::text\) AND \(comparability_class_digest IS NOT NULL\)\)|WHERE \(row_kind = 'CANONICAL_RESULT'::text\) AND \(comparability_class_digest IS NOT NULL\)/.test(
      indexDefinition,
    ) && 'index_predicate',
    /(?:\bprovisions\b|\bclaims\b|\bcards\b)/i.test(candidateDefinition)
      && 'legacy_tables',
  ].filter(Boolean);
  if (candidateFailures.length) {
    throw new TypeError(
      `F20 candidate is not the bounded class-keyed projection: ${candidateFailures.join(', ')}`,
    );
  }
  requireExactKeys(execution.transaction, [
    'cold_result',
    'warm_result',
    'cache_entry',
    'cohort_probe',
    'active_pointer_before',
    'explain_plan',
  ], 'F20 rollback transaction');
  validateQueryResult(
    execution.transaction.cold_result,
    'MISS',
    f19,
    execution,
  );
  validateQueryResult(
    execution.transaction.warm_result,
    'HIT',
    f19,
    execution,
  );
  const coldBody = clone(execution.transaction.cold_result);
  const warmBody = clone(execution.transaction.warm_result);
  delete coldBody.cache_state;
  delete warmBody.cache_state;
  const cache = execution.transaction.cache_entry;
  const isolationFailures = [
    canonicalJson(coldBody) !== canonicalJson(warmBody)
      && 'cold_warm_body',
    cache?.row_count !== 1 && 'cache_row_count',
    cache?.physical_request?.comparability_class_digest
      !== execution.comparability_class_digest && 'cache_class',
    cache?.physical_request?.query_semantics_digest
      !== execution.query_semantics_digest && 'cache_semantics',
    cache?.response_bytes > MAX_RESPONSE_BYTES && 'response_bytes',
    execution.transaction.active_pointer_before?.corpus_release_id
      === f19.corpus_release_id && 'active_release',
    execution.transaction.active_pointer_before?.serving_namespace_id
      === f19.serving_namespace_id && 'active_namespace',
  ].filter(Boolean);
  if (isolationFailures.length) {
    throw new TypeError(
      `F20 cold, warm, cache or active isolation drifted: ${isolationFailures.join(', ')}`,
    );
  }
  const probe = execution.transaction.cohort_probe;
  requireExactKeys(probe, [
    'same_metric_all_classes',
    'exact_class_rows',
    'poison_class_rows',
  ], 'F20 poison cohort probe');
  if (probe.same_metric_all_classes !== 2
    || probe.exact_class_rows !== 1
    || probe.poison_class_rows !== 1
    || execution.transaction.cold_result.rows[0]
      .row_serving_key === poisonProof.alternative_row_serving_key) {
    throw new TypeError('F20 did not prove different-class poison isolation');
  }
  const nodes = planNodes(execution.transaction.explain_plan);
  const indexScan = nodes.find(
    (node) => node['Index Name'] === CANDIDATE_INDEX_NAME,
  );
  const forbiddenScan = nodes.find(
    (node) => node['Node Type'] === 'Seq Scan'
      && node['Relation Name'] === 'shared_serving_rows',
  );
  if (!indexScan
    || !['Index Only Scan', 'Index Scan', 'Bitmap Index Scan']
      .includes(indexScan['Node Type'])
    || Number(indexScan['Actual Rows']) !== 1
    || forbiddenScan) {
    throw new TypeError('F20 natural plan did not isolate via the class index');
  }
  requireExactKeys(execution.post_rollback, [
    'release_rows',
    'directory_rows',
    'shared_row_rows',
    'cache_rows',
    'class_column_exists',
    'candidate_index_exists',
    'candidate_function_exists',
    'active_pointer_after',
    'base_executor_definition_digest',
  ], 'F20 post-rollback proof');
  if (execution.post_rollback.release_rows !== 0
    || execution.post_rollback.directory_rows !== 0
    || execution.post_rollback.shared_row_rows !== 0
    || execution.post_rollback.cache_rows !== 0
    || execution.post_rollback.class_column_exists !== false
    || execution.post_rollback.candidate_index_exists !== false
    || execution.post_rollback.candidate_function_exists !== false
    || execution.post_rollback.base_executor_definition_digest
      !== BASE_EXECUTOR_DEFINITION_DIGEST
    || canonicalJson(execution.post_rollback.active_pointer_after)
      !== canonicalJson(execution.transaction.active_pointer_before)) {
    throw new TypeError('F20 rollback did not restore exact staging state');
  }
  return { coldBody, indexScan };
}

function buildQxoNoShopCopyDeliveryQueryF20({
  contract_bundle: contractBundle,
  qxo_no_shop_copy_delivery_canonical_f19: f19,
  staging_execution: execution,
} = {}) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V12) {
    throw new TypeError('F20 requires the frozen V12 contract');
  }
  validateF19(f19, contractBundle);
  const { coldBody, indexScan } = validateExecution(execution, f19);
  const body = {
    schema_version: 'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20/V2',
    authority_scope: AUTHORITY_SCOPE,
    upstream_binding: {
      qxo_no_shop_copy_delivery_canonical_f19_id: F19_ID,
      qxo_no_shop_copy_delivery_canonical_f19_payload_digest:
        F19_DIGEST,
    },
    query_certification: {
      environment: 'STAGING',
      execution_mode: 'ROLLBACK_ONLY',
      base_executor_function: BASE_EXECUTOR_NAME,
      base_executor_definition_digest:
        execution.base_executor.definition_digest,
      candidate_executor_function: CANDIDATE_EXECUTOR_NAME,
      candidate_executor_definition_digest: sha256Hex(Buffer.from(
        execution.candidate_executor.definition,
        'utf8',
      )),
      required_index: CANDIDATE_INDEX_NAME,
      index_definition_digest: sha256Hex(Buffer.from(
        execution.candidate_index.definition,
        'utf8',
      )),
      explained_sql_digest: execution.explained_sql_digest,
      plan_node_type: indexScan['Node Type'],
      plan_actual_rows: Number(indexScan['Actual Rows']),
      query_semantics_digest: execution.query_semantics_digest,
      comparability_class_digest:
        execution.comparability_class_digest,
      alternative_comparability_class_digest:
        execution.poison_semantic_proof
          .alternative_comparability_class_digest,
      poison_governed_semantic_delta: {
        dimension:
          execution.poison_semantic_proof.governed_dimension,
        baseline_value:
          execution.poison_semantic_proof.baseline_value,
        alternative_value:
          execution.poison_semantic_proof.alternative_value,
      },
      poison_shared_row_validation:
        execution.poison_semantic_proof.shared_row_validation,
      poison_interpretation_validation:
        execution.poison_semantic_proof.interpretation_validation,
      poison_claim_revision_validation:
        execution.poison_semantic_proof.claim_revision_validation,
      poison_interpretation_identity_propagation:
        execution.poison_semantic_proof
          .interpretation_identity_propagation,
      poison_interpretation_warning_digest_alignment:
        execution.poison_semantic_proof
          .interpretation_warning_digest_alignment,
      poison_review_authority:
        execution.poison_semantic_proof.review_authority,
      poison_warning_authority:
        execution.poison_semantic_proof.warning_authority,
      poison_admission_state:
        execution.poison_semantic_proof.admission_state,
      cold_result_digest: contentId(
        'CANONICAL_QUERY_PAGE_RESULT/V2',
        execution.transaction.cold_result,
      ),
      warm_result_digest: contentId(
        'CANONICAL_QUERY_PAGE_RESULT/V2',
        execution.transaction.warm_result,
      ),
      canonical_response_body_digest: contentId(
        'CANONICAL_QUERY_PAGE_BODY/V2',
        coldBody,
      ),
      database_calls_per_request: 1,
      page_size: 25,
      rows_returned: 1,
      response_byte_ceiling: MAX_RESPONSE_BYTES,
      cache_states_verified: ['MISS', 'HIT'],
      different_class_poison_excluded: true,
      release_aware_cache_verified: true,
      stable_keyset_pagination_verified: true,
      set_based_projection_verified: true,
      active_release_unchanged: true,
      rollback_verified: true,
    },
    status: {
      canonical_candidate_contract_integration: 'RESOLVED_OFFLINE',
      admitted_exact_source_resolver: 'RESOLVED_OFFLINE',
      indexed_query_executor_certification:
        'RESOLVED_STAGING_ROLLBACK_ONLY',
      active_serving_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'V12_ACTIVE_SERVING_ADMISSION_REQUIRED',
      ],
    },
  };
  return freeze({
    ...body,
    qxo_no_shop_copy_delivery_query_f20_id: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20/V2',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20_PAYLOAD/V2',
      body,
    ),
  });
}

function validateQxoNoShopCopyDeliveryQueryF20({
  qxo_no_shop_copy_delivery_query_f20: candidate,
  ...inputs
} = {}) {
  const expected = buildQxoNoShopCopyDeliveryQueryF20(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the QXO F20 query certification has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  BASE_EXECUTOR_DEFINITION_DIGEST,
  CANDIDATE_EXECUTOR_NAME,
  CANDIDATE_INDEX_NAME,
  buildQxoNoShopCopyDeliveryQueryF20,
  validateQxoNoShopCopyDeliveryQueryF20,
};
