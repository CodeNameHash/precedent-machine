const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  compileFixtureContractV12,
} = require('./contract-bundle');
const {
  compileOfflineInterpretedMarketCohortRequest,
  validateOfflineInterpretedMarketCohortRequest,
  validateOfflineInterpretedMarketCohortResult,
} = require('./market-cohort-query');
const {
  buildCopyDeliveryMetricServingAdmission,
  resolveMetricServingAdmission,
} = require('./metric-serving-admission');
const {
  validateOfflineCandidateRelease,
  validateDealServingDirectoryRecord,
} = require('./candidate-release');
const {
  validateOfflineInterpretedResultCompositionDetailPackageStructure,
} = require('./admitted-composition-exact-detail');
const {
  validateOfflineCandidateSharedServingRow,
} = require('./shared-serving-row');
const {
  validateOfflineInterpretedQueryProjectionRecord,
} = require('./query-result');

const SHA256_RE = /^[a-f0-9]{64}$/;
const AUTHORITY_SCOPE =
  'OFFLINE_METRIC_SCOPED_CANDIDATE_RELEASE_F23_ONLY';
const F19_ID =
  '4b825c971317b982e20d2fd231f9f2329f263237648b363a4e3cf988dfc142a8';
const F19_DIGEST =
  '3c51b6364c811a40629c9ce27e693b53a009f52301fef589053479f63fd31ae7';
const F19_MANIFEST_ID =
  '38a9b2110c8e7d36bbcf4d92b4932456f0a9e7e8ab3d287e9b9fdc16ef2c632e';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields are outside the F23 contract`);
  }
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new TypeError(`${label} must be a sha256 digest`);
  }
  return value;
}

function validateExactF19Carrier(f19) {
  requireExactKeys(f19, [
    'schema_version',
    'authority_scope',
    'upstream_bindings',
    'corpus_release_id',
    'serving_namespace_id',
    'result',
    'projection',
    'cohort_request',
    'cohort_result',
    'shared_row',
    'exact_detail_package',
    'query_projection',
    'deal_directory_entry',
    'candidate_release',
    'status',
    'qxo_no_shop_copy_delivery_canonical_f19_id',
    'canonical_payload_digest',
  ], 'F19 carrier');
  const {
    qxo_no_shop_copy_delivery_canonical_f19_id: carrierId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = f19;
  if (f19.schema_version
      !== 'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19/V1'
    || carrierId !== F19_ID
    || payloadDigest !== F19_DIGEST
    || carrierId !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19/V1',
      body,
    )
    || payloadDigest !== contentId(
      'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19_PAYLOAD/V1',
      body,
    )
    || f19.candidate_release?.manifest
      ?.candidate_release_manifest_id !== F19_MANIFEST_ID) {
    throw new TypeError('F23 requires the exact F19 carrier');
  }
  validateOfflineCandidateRelease(f19.candidate_release);
  validateOfflineCandidateSharedServingRow(f19.shared_row);
  validateOfflineInterpretedResultCompositionDetailPackageStructure(
    f19.exact_detail_package,
  );
  validateOfflineInterpretedMarketCohortRequest(f19.cohort_request);
  validateOfflineInterpretedMarketCohortResult(
    f19.cohort_result,
    f19.cohort_request,
  );
  validateOfflineInterpretedQueryProjectionRecord(
    f19.query_projection,
  );
  validateDealServingDirectoryRecord(f19.deal_directory_entry);
  if (canonicalJson(f19.candidate_release.shared_rows)
      !== canonicalJson([f19.shared_row])
    || canonicalJson(f19.candidate_release.exact_detail_packages)
      !== canonicalJson([f19.exact_detail_package])
    || canonicalJson(f19.candidate_release.cohort_requests)
      !== canonicalJson([f19.cohort_request])
    || canonicalJson(f19.candidate_release.cohort_results)
      !== canonicalJson([f19.cohort_result])
    || canonicalJson(f19.candidate_release.query_records)
      !== canonicalJson([f19.query_projection])
    || canonicalJson(f19.candidate_release.deal_directory_entries)
      !== canonicalJson([f19.deal_directory_entry])
    || canonicalJson(f19.candidate_release.market_observations)
      !== canonicalJson([f19.projection.observation])) {
    throw new TypeError('F19 carrier partitions do not match its release');
  }
  return true;
}

function buildReleaseBoundSharedRow(baseRow, admissionId) {
  validateOfflineCandidateSharedServingRow(baseRow);
  const body = clone(baseRow);
  delete body.canonical_payload_digest;
  body.metric_serving_admission_id = admissionId;
  const row = {
    ...body,
    canonical_payload_digest: contentId(
      'SHARED_SERVING_ROW_PAYLOAD/V2',
      body,
    ),
  };
  validateMetricScopedSharedServingRow(row);
  return deepFreeze(row);
}

function baseSharedRow(row) {
  const base = clone(row);
  delete base.metric_serving_admission_id;
  delete base.canonical_payload_digest;
  return {
    ...base,
    canonical_payload_digest: contentId(
      'SHARED_SERVING_ROW_PAYLOAD/V2',
      base,
    ),
  };
}

function validateMetricScopedSharedServingRow(row) {
  requireDigest(
    row?.metric_serving_admission_id,
    'row.metric_serving_admission_id',
  );
  const base = baseSharedRow(row);
  requireExactKeys(
    row,
    [...Object.keys(base), 'metric_serving_admission_id'],
    'metric-scoped SharedServingRow/V2',
  );
  validateOfflineCandidateSharedServingRow(base);
  const { canonical_payload_digest: digest, ...body } = row;
  if (row.schema_version !== 'SHARED_SERVING_ROW/V2'
    || digest !== contentId('SHARED_SERVING_ROW_PAYLOAD/V2', body)) {
    throw new TypeError('metric-scoped SharedServingRow/V2 has drifted');
  }
  return true;
}

function buildReleaseBoundCohortRequest(baseRequest, admissionId) {
  validateOfflineInterpretedMarketCohortRequest(baseRequest);
  const request = releaseBoundCohortRequestFromBase(
    baseRequest,
    admissionId,
  );
  validateMetricScopedCohortRequest(request);
  return deepFreeze(request);
}

function releaseBoundCohortRequestFromBase(
  baseRequest,
  admissionId,
) {
  const {
    cohort_digest: _oldCohortDigest,
    cache_key: _oldCacheKey,
    execution_state: _oldExecutionState,
    ...base
  } = clone(baseRequest);
  const compiled = {
    ...base,
    schema_version: 'MARKET_COHORT_REQUEST/V3',
    metric_serving_admission_id: admissionId,
  };
  const {
    serving_namespace_id: _namespace,
    ...logicalCohort
  } = compiled;
  const cohortDigest = contentId(
    'MARKET_COHORT/V3',
    logicalCohort,
  );
  const request = {
    ...compiled,
    cohort_digest: cohortDigest,
    cache_key: contentId('MARKET_COHORT_CACHE/V3', {
      serving_namespace_id: compiled.serving_namespace_id,
      corpus_release_id: compiled.corpus_release_id,
      cohort_digest: cohortDigest,
      comparability_class_digest:
        compiled.comparability_class_digest,
      metric_serving_admission_id: admissionId,
    }),
    execution_state: 'NOT_BUILT',
  };
  return request;
}

function baseCohortRequest(request) {
  return compileOfflineInterpretedMarketCohortRequest({
    authority_scope: request.authority_scope,
    integration_admission_id: request.integration_admission_id,
    serving_namespace_id: request.serving_namespace_id,
    corpus_release_id: request.corpus_release_id,
    contract_fingerprint: request.contract_fingerprint,
    metric_key: request.metric_key,
    metric_version: request.metric_version,
    concept_key: request.concept_key,
    party: request.party,
    subject_deal_key: request.subject_deal_key,
    comparability_class_digest:
      request.comparability_class_digest,
    filters: request.filters,
  });
}

function validateMetricScopedCohortRequest(request) {
  const base = baseCohortRequest(request);
  requireExactKeys(request, [
    ...Object.keys(base),
    'metric_serving_admission_id',
  ], 'metric-scoped cohort request');
  validateOfflineInterpretedMarketCohortRequest(base);
  const rebuilt = releaseBoundCohortRequestFromBase(
    base,
    request.metric_serving_admission_id,
  );
  if (canonicalJson(request) !== canonicalJson(rebuilt)) {
    throw new TypeError('metric-scoped cohort request has drifted');
  }
  return true;
}

function buildReleaseBoundCohortResult(
  baseResult,
  baseRequest,
  request,
  admissionId,
) {
  validateOfflineInterpretedMarketCohortResult(
    baseResult,
    baseRequest,
  );
  const result = {
    ...clone(baseResult),
    schema_version: 'MARKET_COHORT_RESULT/V3',
    metric_serving_admission_id: admissionId,
    cohort_digest: request.cohort_digest,
  };
  validateMetricScopedCohortResult(result, request);
  return deepFreeze(result);
}

function baseCohortResult(result, request) {
  const base = clone(result);
  delete base.metric_serving_admission_id;
  base.schema_version = 'MARKET_COHORT_RESULT/V2';
  base.cohort_digest = baseCohortRequest(request).cohort_digest;
  return base;
}

function validateMetricScopedCohortResult(result, request) {
  validateMetricScopedCohortRequest(request);
  const baseRequest = baseCohortRequest(request);
  const baseResult = baseCohortResult(result, request);
  requireExactKeys(result, [
    ...Object.keys(baseResult),
    'metric_serving_admission_id',
  ], 'metric-scoped cohort result');
  validateOfflineInterpretedMarketCohortResult(
    baseResult,
    baseRequest,
  );
  if (result.schema_version !== 'MARKET_COHORT_RESULT/V3'
    || result.metric_serving_admission_id
      !== request.metric_serving_admission_id
    || result.cohort_digest !== request.cohort_digest) {
    throw new TypeError(
      'metric-scoped cohort result does not match its request',
    );
  }
  return true;
}

function buildReleaseBoundQueryRecord(
  baseRecord,
  request,
  admissionId,
) {
  validateOfflineInterpretedQueryProjectionRecord(baseRecord);
  const body = clone(baseRecord);
  delete body.canonical_payload_digest;
  body.schema_version = 'QUERY_PROJECTION_RECORD/V4';
  body.metric_serving_admission_id = admissionId;
  body.cohort_digest = request.cohort_digest;
  body.cache_key = request.cache_key;
  const record = {
    ...body,
    canonical_payload_digest: contentId(
      'QUERY_PROJECTION_RECORD_PAYLOAD/V4',
      body,
    ),
  };
  validateMetricScopedQueryRecord(record, request);
  return deepFreeze(record);
}

function baseQueryRecord(record) {
  const base = clone(record);
  delete base.metric_serving_admission_id;
  delete base.cohort_digest;
  delete base.cache_key;
  delete base.canonical_payload_digest;
  base.schema_version = 'QUERY_PROJECTION_RECORD/V3';
  return {
    ...base,
    canonical_payload_digest: contentId(
      'QUERY_PROJECTION_RECORD_PAYLOAD/V3',
      base,
    ),
  };
}

function validateMetricScopedQueryRecord(record, request) {
  validateMetricScopedCohortRequest(request);
  const base = baseQueryRecord(record);
  requireExactKeys(record, [
    ...Object.keys(base),
    'metric_serving_admission_id',
    'cohort_digest',
    'cache_key',
  ], 'metric-scoped Query projection');
  validateOfflineInterpretedQueryProjectionRecord(base);
  const { canonical_payload_digest: digest, ...body } = record;
  if (record.schema_version !== 'QUERY_PROJECTION_RECORD/V4'
    || record.metric_serving_admission_id
      !== request.metric_serving_admission_id
    || record.cohort_digest !== request.cohort_digest
    || record.cache_key !== request.cache_key
    || digest !== contentId(
      'QUERY_PROJECTION_RECORD_PAYLOAD/V4',
      body,
    )) {
    throw new TypeError('metric-scoped Query projection has drifted');
  }
  return true;
}

function releaseRoots(bundle) {
  return {
    observation_root: contentId(
      'F23_RELEASE_OBSERVATIONS/V1',
      bundle.market_observations.map(
        (entry) => entry.canonical_payload_digest,
      ),
    ),
    shared_row_root: contentId(
      'F23_RELEASE_ROWS/V1',
      bundle.shared_rows.map(
        (entry) => entry.canonical_payload_digest,
      ),
    ),
    exact_detail_root: contentId(
      'F23_RELEASE_DETAILS/V1',
      bundle.exact_detail_packages.map(
        (entry) => contentId(
          'METRIC_SCOPED_EXACT_DETAIL_PACKAGE/V1',
          entry,
        ),
      ),
    ),
    cohort_request_root: contentId(
      'F23_RELEASE_COHORT_REQUESTS/V1',
      bundle.cohort_requests.map(
        (entry) => contentId(
          'METRIC_SCOPED_COHORT_REQUEST/V1',
          entry,
        ),
      ),
    ),
    cohort_result_root: contentId(
      'F23_RELEASE_COHORT_RESULTS/V1',
      bundle.cohort_results.map(
        (entry) => contentId(
          'METRIC_SCOPED_COHORT_RESULT/V1',
          entry,
        ),
      ),
    ),
    query_projection_root: contentId(
      'F23_RELEASE_QUERY/V1',
      bundle.query_records.map(
        (entry) => entry.canonical_payload_digest,
      ),
    ),
    deal_directory_root: contentId(
      'F23_RELEASE_DEALS/V1',
      bundle.deal_directory_entries.map(
        (entry) => entry.canonical_payload_digest,
      ),
    ),
  };
}

function buildManifest(bundle, predecessorManifest, admission) {
  const body = {
    schema_version:
      'METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST/V1',
    authority_scope: AUTHORITY_SCOPE,
    certification_state:
      'CERTIFIED_STAGING_ROLLBACK_ONLY_NOT_ACTIVATABLE',
    activation_eligibility:
      'INELIGIBLE_ACTIVE_POINTER_NOT_AUTHORISED',
    serving_namespace_id: predecessorManifest
      .serving_namespace_id,
    corpus_release_id: predecessorManifest.corpus_release_id,
    contract_fingerprint:
      predecessorManifest.contract_fingerprint,
    predecessor_release_manifest_id:
      predecessorManifest.candidate_release_manifest_id,
    predecessor_release_manifest_payload_digest:
      predecessorManifest.canonical_payload_digest,
    certification_evidence: {
      qxo_no_shop_copy_delivery_canonical_f19_id: F19_ID,
      f19_canonical_payload_digest: F19_DIGEST,
      metric_serving_admission_id:
        admission.metric_serving_admission_id,
      metric_serving_admission_registry_id:
        resolveMetricServingAdmission({
          contract_bundle: compileFixtureContractV12(),
          metric_key: admission.metric_key,
          metric_version: admission.metric_version,
          concept_key: admission.concept_key,
          required_claim_definition_key:
            admission.required_claim_definition_key,
          metric_serving_admission_id:
            admission.metric_serving_admission_id,
          declared_metric_serving_admission_ids: [
            admission.metric_serving_admission_id,
          ],
        }).metric_serving_admission_registry_id,
    },
    metric_serving_admission_ids: [
      admission.metric_serving_admission_id,
    ],
    counts: {
      deals: 1,
      observations: 1,
      shared_rows: 1,
      exact_detail_packages: 1,
      cohort_requests: 1,
      cohort_results: 1,
      query_records: 1,
    },
    roots: releaseRoots(bundle),
    authority: {
      active_release_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'ROLLBACK_ONLY_STAGING_CERTIFICATION_REQUIRED',
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return {
    ...body,
    candidate_release_manifest_id: contentId(
      'METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
      body,
    ),
  };
}

function buildMetricScopedCandidateReleaseF23({
  qxo_no_shop_copy_delivery_canonical_f19: f19,
} = {}) {
  validateExactF19Carrier(f19);
  const admission = buildCopyDeliveryMetricServingAdmission();
  const admissionId = admission.metric_serving_admission_id;
  const row = buildReleaseBoundSharedRow(
    f19.shared_row,
    admissionId,
  );
  const detail = clone(f19.exact_detail_package);
  detail.row = clone(row);
  validateOfflineInterpretedResultCompositionDetailPackageStructure(
    detail,
  );
  const request = buildReleaseBoundCohortRequest(
    f19.cohort_request,
    admissionId,
  );
  const result = buildReleaseBoundCohortResult(
    f19.cohort_result,
    f19.cohort_request,
    request,
    admissionId,
  );
  const queryRecord = buildReleaseBoundQueryRecord(
    f19.query_projection,
    request,
    admissionId,
  );
  const predecessorManifest = clone(
    f19.candidate_release.manifest,
  );
  const bundleBody = {
    schema_version: 'METRIC_SCOPED_CANDIDATE_RELEASE_BUNDLE/V1',
    predecessor_manifest: predecessorManifest,
    market_observations: [
      clone(f19.projection.observation),
    ],
    shared_rows: [clone(row)],
    exact_detail_packages: [detail],
    cohort_requests: [clone(request)],
    cohort_results: [clone(result)],
    query_records: [clone(queryRecord)],
    deal_directory_entries: [
      clone(f19.deal_directory_entry),
    ],
  };
  const manifest = buildManifest(
    bundleBody,
    predecessorManifest,
    admission,
  );
  const bundle = {
    ...bundleBody,
    manifest,
    metric_scoped_candidate_release_bundle_id: contentId(
      'METRIC_SCOPED_CANDIDATE_RELEASE_BUNDLE/V1',
      {
        manifest_id: manifest.candidate_release_manifest_id,
        roots: manifest.roots,
      },
    ),
  };
  validateMetricScopedCandidateReleaseF23(bundle);
  return deepFreeze(bundle);
}

function validateAdmissionSet(values) {
  if (!Array.isArray(values)
    || values.length < 1
    || values.length > 256
    || values.some((value) => !SHA256_RE.test(value))
    || new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson([...values].sort())) {
    throw new TypeError(
      'manifest admission IDs must be bounded, unique and sorted',
    );
  }
}

function reconstructPredecessorBundle(bundle) {
  const request = baseCohortRequest(bundle.cohort_requests[0]);
  const row = baseSharedRow(bundle.shared_rows[0]);
  const detail = clone(bundle.exact_detail_packages[0]);
  detail.row = clone(row);
  return {
    schema_version: 'OFFLINE_CANDIDATE_RELEASE_BUNDLE/V1',
    manifest: clone(bundle.predecessor_manifest),
    market_observations: clone(bundle.market_observations),
    shared_rows: [row],
    exact_detail_packages: [detail],
    cohort_requests: [request],
    cohort_results: [
      baseCohortResult(bundle.cohort_results[0], request),
    ],
    query_records: [
      baseQueryRecord(bundle.query_records[0]),
    ],
    deal_directory_entries:
      clone(bundle.deal_directory_entries),
  };
}

function validateMetricScopedCandidateReleaseF23(bundle) {
  requireExactKeys(bundle, [
    'schema_version',
    'predecessor_manifest',
    'market_observations',
    'shared_rows',
    'exact_detail_packages',
    'cohort_requests',
    'cohort_results',
    'query_records',
    'deal_directory_entries',
    'manifest',
    'metric_scoped_candidate_release_bundle_id',
  ], 'F23 release bundle');
  requireExactKeys(bundle.manifest, [
    'schema_version',
    'authority_scope',
    'certification_state',
    'activation_eligibility',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'predecessor_release_manifest_id',
    'predecessor_release_manifest_payload_digest',
    'certification_evidence',
    'metric_serving_admission_ids',
    'counts',
    'roots',
    'authority',
    'status',
    'candidate_release_manifest_id',
    'canonical_payload_digest',
  ], 'F23 release manifest');
  if (bundle.schema_version
      !== 'METRIC_SCOPED_CANDIDATE_RELEASE_BUNDLE/V1'
    || bundle.manifest.schema_version
      !== 'METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST/V1'
    || bundle.manifest.authority_scope !== AUTHORITY_SCOPE
    || bundle.manifest.certification_state
      !== 'CERTIFIED_STAGING_ROLLBACK_ONLY_NOT_ACTIVATABLE'
    || bundle.manifest.activation_eligibility
      !== 'INELIGIBLE_ACTIVE_POINTER_NOT_AUTHORISED'
    || bundle.predecessor_manifest
      ?.candidate_release_manifest_id !== F19_MANIFEST_ID
    || bundle.market_observations?.length !== 1
    || bundle.shared_rows?.length !== 1
    || bundle.exact_detail_packages?.length !== 1
    || bundle.cohort_requests?.length !== 1
    || bundle.cohort_results?.length !== 1
    || bundle.query_records?.length !== 1
    || bundle.deal_directory_entries?.length !== 1) {
    throw new TypeError('invalid F23 metric-scoped candidate release');
  }
  validateAdmissionSet(
    bundle.manifest.metric_serving_admission_ids,
  );
  const admission = buildCopyDeliveryMetricServingAdmission();
  const admissionId = admission.metric_serving_admission_id;
  const row = bundle.shared_rows[0];
  const detail = bundle.exact_detail_packages[0];
  const request = bundle.cohort_requests[0];
  const result = bundle.cohort_results[0];
  const queryRecord = bundle.query_records[0];
  validateMetricScopedSharedServingRow(row);
  validateOfflineInterpretedResultCompositionDetailPackageStructure(
    detail,
  );
  validateMetricScopedCohortRequest(request);
  validateMetricScopedCohortResult(result, request);
  validateMetricScopedQueryRecord(queryRecord, request);
  validateDealServingDirectoryRecord(
    bundle.deal_directory_entries[0],
  );
  if (detail.row.metric_serving_admission_id !== admissionId
    || row.metric_serving_admission_id !== admissionId
    || request.metric_serving_admission_id !== admissionId
    || result.metric_serving_admission_id !== admissionId
    || queryRecord.metric_serving_admission_id !== admissionId
    || canonicalJson(
      bundle.manifest.metric_serving_admission_ids,
    ) !== canonicalJson([admissionId])
    || canonicalJson(detail.row) !== canonicalJson(row)
    || request.corpus_release_id !== row.corpus_release_id
    || result.corpus_release_id !== row.corpus_release_id
    || queryRecord.corpus_release_id !== row.corpus_release_id
    || queryRecord.row_serving_key !== row.row_serving_key
    || request.metric_key !== queryRecord.metric_key
    || request.metric_version !== queryRecord.metric_version
    || request.concept_key !== queryRecord.concept_key) {
    throw new TypeError(
      'F23 serving carriers do not share one admission identity',
    );
  }
  const resolution = resolveMetricServingAdmission({
    contract_bundle: compileFixtureContractV12(),
    metric_key: request.metric_key,
    metric_version: request.metric_version,
    concept_key: request.concept_key,
    required_claim_definition_key:
      admission.required_claim_definition_key,
    metric_serving_admission_id: admissionId,
    declared_metric_serving_admission_ids:
      bundle.manifest.metric_serving_admission_ids,
  });
  if (resolution.admission_lane !== 'METRIC_SCOPED'
    || resolution.declared_admission_membership !== 'PASSED') {
    throw new TypeError('F23 admission did not resolve centrally');
  }
  validateOfflineCandidateRelease(
    reconstructPredecessorBundle(bundle),
  );
  const expectedRoots = releaseRoots(bundle);
  const expectedCounts = {
    deals: 1,
    observations: 1,
    shared_rows: 1,
    exact_detail_packages: 1,
    cohort_requests: 1,
    cohort_results: 1,
    query_records: 1,
  };
  const expectedManifest = buildManifest(
    bundle,
    bundle.predecessor_manifest,
    admission,
  );
  if (canonicalJson(bundle.manifest.roots)
      !== canonicalJson(expectedRoots)
    || canonicalJson(bundle.manifest.counts)
      !== canonicalJson(expectedCounts)
    || canonicalJson(bundle.manifest)
      !== canonicalJson(expectedManifest)
    || bundle.metric_scoped_candidate_release_bundle_id
      !== contentId(
        'METRIC_SCOPED_CANDIDATE_RELEASE_BUNDLE/V1',
        {
          manifest_id:
            bundle.manifest.candidate_release_manifest_id,
          roots: bundle.manifest.roots,
        },
      )) {
    throw new TypeError('F23 release manifest has drifted');
  }
  return true;
}

function releaseManifestAdmissionResolution(bundle) {
  validateMetricScopedCandidateReleaseF23(bundle);
  const admission = buildCopyDeliveryMetricServingAdmission();
  return deepFreeze({
    schema_version:
      'METRIC_SERVING_RELEASE_MANIFEST_RESOLUTION/V1',
    candidate_release_manifest_id:
      bundle.manifest.candidate_release_manifest_id,
    metric_serving_admission_id:
      admission.metric_serving_admission_id,
    release_manifest_validation: 'PASSED',
    row_validation: 'PASSED',
    exact_detail_validation: 'PASSED',
    cohort_request_validation: 'PASSED',
    cohort_result_validation: 'PASSED',
    query_projection_validation: 'PASSED',
    cache_identity_validation: 'PASSED',
    active_release_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
}

function prepareMetricScopedRowsForRendering(rows, bundle) {
  validateMetricScopedCandidateReleaseF23(bundle);
  const admitted = new Set(
    bundle.manifest.metric_serving_admission_ids,
  );
  const releasedRows = new Map(
    bundle.shared_rows.map((row) => [
      row.row_serving_key,
      canonicalJson(row),
    ]),
  );
  const seen = new Set();
  return (rows || []).map((row, index) => {
    try {
      validateMetricScopedSharedServingRow(row);
      if (!admitted.has(row.metric_serving_admission_id)
        || seen.has(row.row_serving_key)
        || releasedRows.get(row.row_serving_key)
          !== canonicalJson(row)) {
        throw new TypeError('row is outside the release manifest');
      }
      seen.add(row.row_serving_key);
      return {
        render_kind: 'ROW',
        key: row.row_serving_key,
        row,
      };
    } catch {
      return {
        render_kind: 'ROW_RENDER_FAILED',
        key: SHA256_RE.test(row?.row_serving_key || '')
          ? row.row_serving_key
          : contentId('ROW_RENDER_FAILED/V1', { index }),
        reason_code: 'INVALID_METRIC_SCOPED_SHARED_SERVING_ROW',
      };
    }
  });
}

module.exports = {
  AUTHORITY_SCOPE,
  F19_DIGEST,
  F19_ID,
  F19_MANIFEST_ID,
  baseCohortRequest,
  baseCohortResult,
  baseQueryRecord,
  baseSharedRow,
  buildMetricScopedCandidateReleaseF23,
  prepareMetricScopedRowsForRendering,
  releaseManifestAdmissionResolution,
  validateExactF19Carrier,
  validateMetricScopedCandidateReleaseF23,
  validateMetricScopedCohortRequest,
  validateMetricScopedCohortResult,
  validateMetricScopedQueryRecord,
  validateMetricScopedSharedServingRow,
};
