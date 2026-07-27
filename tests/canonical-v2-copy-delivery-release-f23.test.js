const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV12,
} = require('../lib/canonical-v2/contract-bundle');
const {
  METRIC_DEFINITIONS,
} = require('../lib/canonical-v2/serving-projection');
const {
  validateOfflineCandidateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');
const {
  buildCopyDeliveryMetricServingAdmission,
  resolveMetricServingAdmission,
} = require('../lib/canonical-v2/metric-serving-admission');
const {
  baseSharedRow,
  prepareMetricScopedRowsForRendering,
  releaseManifestAdmissionResolution,
  validateMetricScopedCandidateReleaseF23,
} = require(
  '../lib/canonical-v2/metric-scoped-candidate-release-f23'
);

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-release-f23-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const ACTIVE_VALIDATOR_SNAPSHOTS = Object.freeze({
  'lib/canonical-v2/market-cohort-query.js':
    '5a4f29bada0792b784441cb38ac47e08d80ba16bf9add853644a2f152e848b9c',
  'lib/canonical-v2/shared-serving-row.js':
    '9932470f033914cc861b7134987b8afbc625301b48c3c2c82e830140136014ad',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function bundle() {
  return fixture().candidate_release_bundle;
}

function expectInvalid(
  mutate,
  pattern = /./,
) {
  const value = clone(bundle());
  mutate(value);
  assert.throws(
    () => validateMetricScopedCandidateReleaseF23(value),
    pattern,
  );
}

function resignRow(row) {
  const copy = clone(row);
  delete copy.canonical_payload_digest;
  return {
    ...copy,
    canonical_payload_digest: contentId(
      'SHARED_SERVING_ROW_PAYLOAD/V2',
      copy,
    ),
  };
}

function resignF23Envelope(value) {
  value.manifest.roots.shared_row_root = contentId(
    'F23_RELEASE_ROWS/V1',
    value.shared_rows.map(
      (row) => row.canonical_payload_digest,
    ),
  );
  value.manifest.roots.exact_detail_root = contentId(
    'F23_RELEASE_DETAILS/V1',
    value.exact_detail_packages.map(
      (detail) => contentId(
        'METRIC_SCOPED_EXACT_DETAIL_PACKAGE/V1',
        detail,
      ),
    ),
  );
  const {
    candidate_release_manifest_id: _manifestId,
    canonical_payload_digest: _manifestDigest,
    ...manifestBody
  } = value.manifest;
  value.manifest.candidate_release_manifest_id = contentId(
    'METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST/V1',
    manifestBody,
  );
  value.manifest.canonical_payload_digest = contentId(
    'METRIC_SCOPED_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    manifestBody,
  );
  value.metric_scoped_candidate_release_bundle_id = contentId(
    'METRIC_SCOPED_CANDIDATE_RELEASE_BUNDLE/V1',
    {
      manifest_id:
        value.manifest.candidate_release_manifest_id,
      roots: value.manifest.roots,
    },
  );
  return value;
}

test('F23 attestation and release identities are deterministic', () => {
  const value = fixture();
  const {
    qxo_copy_delivery_release_f23_staging_attestation_id: id,
    canonical_payload_digest: digest,
    ...body
  } = value;
  assert.equal(
    id,
    contentId(
      'QXO_COPY_DELIVERY_RELEASE_F23_STAGING_ATTESTATION/V1',
      body,
    ),
  );
  assert.equal(
    digest,
    contentId(
      'QXO_COPY_DELIVERY_RELEASE_F23_STAGING_ATTESTATION_PAYLOAD/V1',
      body,
    ),
  );
  assert.equal(
    id,
    '8c4b13f85feaedd0a88d67ff8d3839b01a3f0e2ac641152135ea39d25ca6b9c5',
  );
  assert.equal(
    digest,
    '691fd9442e3622656245e3471a6c6c4c4b01bdc8eb5cffb1c64aa22c1584682b',
  );
  assert.equal(
    value.candidate_release_bundle
      .metric_scoped_candidate_release_bundle_id,
    '17964307fe57cf7292bb036e66e2d031feffc15ebcc7098249d1edb5510cc27c',
  );
  assert.equal(
    value.candidate_release_bundle.manifest
      .candidate_release_manifest_id,
    '04559b6ef3b73eb2f7d2597f59f36301b453248d17e2974c53d49f3f524c4e73',
  );
  assert.equal(
    validateMetricScopedCandidateReleaseF23(
      value.candidate_release_bundle,
    ),
    true,
  );
});

test('one exact admission binds the manifest and all five carriers', () => {
  const value = bundle();
  const admission = buildCopyDeliveryMetricServingAdmission()
    .metric_serving_admission_id;
  const carrierAdmissions = [
    value.shared_rows[0].metric_serving_admission_id,
    value.exact_detail_packages[0].row
      .metric_serving_admission_id,
    value.cohort_requests[0].metric_serving_admission_id,
    value.cohort_results[0].metric_serving_admission_id,
    value.query_records[0].metric_serving_admission_id,
  ];
  assert.deepEqual(value.manifest.metric_serving_admission_ids, [
    admission,
  ]);
  assert.deepEqual(carrierAdmissions, Array(5).fill(admission));
  assert.equal(
    value.shared_rows[0].canonical_payload_digest,
    '683fdfe4f924f87e62177f14644d4f47dcfbb232090c344f4aa53670d63f4dcf',
  );
  assert.equal(
    value.cohort_requests[0].cohort_digest,
    '50b1c8f2e74c5935e92e251342d308c31925aac7ac3910ab15c816fbd634881f',
  );
  assert.equal(
    value.cohort_requests[0].cache_key,
    '2dbe6a868275864d4a29aa4a489610d22c0840eaa8f02955cd423a6e520a124e',
  );
  assert.equal(
    value.query_records[0].canonical_payload_digest,
    '9b14bfc6d138c3c22fbed5ba5bb5efd05c329ef0dc6baad4b1d59fd4bfe9eedb',
  );
});

test('F23 reconstructs the exact predecessor row and remains non-activating', () => {
  const value = fixture();
  const release = value.candidate_release_bundle;
  const row = release.shared_rows[0];
  const predecessor = baseSharedRow(row);
  assert.equal(row.schema_version, 'SHARED_SERVING_ROW/V2');
  assert.equal(
    validateOfflineCandidateSharedServingRow(predecessor),
    true,
  );
  assert.equal(
    predecessor.canonical_payload_digest,
    'f741577096c9701f0293b9309729fdb3f3ee24c294a9b0c5a719a7b07f4be239',
  );
  assert.equal(
    release.predecessor_manifest.candidate_release_manifest_id,
    '6b3413890ccd2af00da87ebe8033c43b25f1122453c1ef6c8dcca56fc93f915c',
  );
  assert.deepEqual(release.manifest.authority, {
    active_release_authority: 'NONE',
    active_query_authority: 'NONE',
    active_pointer_authority: 'NONE',
    corpus_write_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
  assert.deepEqual(value.authority, release.manifest.authority);
  assert.deepEqual(
    releaseManifestAdmissionResolution(release),
    value.release_manifest_resolution,
  );
});

test('cache and cohort identities are admission-bound', () => {
  const value = bundle();
  const request = value.cohort_requests[0];
  const admission = request.metric_serving_admission_id;
  const logicalCohort = clone(request);
  delete logicalCohort.serving_namespace_id;
  delete logicalCohort.cohort_digest;
  delete logicalCohort.cache_key;
  delete logicalCohort.execution_state;
  assert.equal(
    request.cohort_digest,
    contentId('MARKET_COHORT/V3', logicalCohort),
  );
  assert.equal(
    request.cache_key,
    contentId('MARKET_COHORT_CACHE/V3', {
      serving_namespace_id: request.serving_namespace_id,
      corpus_release_id: request.corpus_release_id,
      cohort_digest: request.cohort_digest,
      comparability_class_digest:
        request.comparability_class_digest,
      metric_serving_admission_id: admission,
    }),
  );
  assert.notEqual(
    request.cache_key,
    contentId('MARKET_COHORT_CACHE/V3', {
      serving_namespace_id: request.serving_namespace_id,
      corpus_release_id: request.corpus_release_id,
      cohort_digest: request.cohort_digest,
      comparability_class_digest:
        request.comparability_class_digest,
      metric_serving_admission_id: '0'.repeat(64),
    }),
  );
});

test('missing, forged, duplicate and extra manifest admissions fail closed', () => {
  expectInvalid(
    (value) => {
      value.manifest.metric_serving_admission_ids = [];
    },
    /at least|bounded/,
  );
  expectInvalid((value) => {
    value.manifest.metric_serving_admission_ids = ['0'.repeat(64)];
  });
  expectInvalid(
    (value) => {
      const admission = value.manifest.metric_serving_admission_ids[0];
      value.manifest.metric_serving_admission_ids = [
        admission,
        admission,
      ];
    },
    /unique and sorted/,
  );
  expectInvalid((value) => {
    value.manifest.metric_serving_admission_ids = [
      '0'.repeat(64),
      value.manifest.metric_serving_admission_ids[0],
    ];
  });
});

test('every serving carrier rejects admission substitution', () => {
  [
    (value) => {
      value.shared_rows[0].metric_serving_admission_id =
        '0'.repeat(64);
    },
    (value) => {
      value.exact_detail_packages[0].row
        .metric_serving_admission_id = '0'.repeat(64);
    },
    (value) => {
      value.cohort_requests[0].metric_serving_admission_id =
        '0'.repeat(64);
    },
    (value) => {
      value.cohort_results[0].metric_serving_admission_id =
        '0'.repeat(64);
    },
    (value) => {
      value.query_records[0].metric_serving_admission_id =
        '0'.repeat(64);
    },
  ].forEach((mutate) => expectInvalid(mutate));
});

test('cross-boundary substitutions and locally re-signed drift fail', () => {
  expectInvalid((value) => {
    value.cohort_requests[0].metric_key = 'INVENTED_METRIC';
  });
  expectInvalid((value) => {
    value.cohort_requests[0].concept_key = 'INVENTED-CONCEPT';
  });
  expectInvalid((value) => {
    value.cohort_requests[0].contract_fingerprint = '0'.repeat(64);
  });
  expectInvalid((value) => {
    value.cohort_requests[0].corpus_release_id = '0'.repeat(64);
  });
  expectInvalid((value) => {
    value.predecessor_manifest.candidate_release_manifest_id =
      '0'.repeat(64);
  });
  expectInvalid((value) => {
    const row = clone(value.shared_rows[0]);
    row.provenance.interpretation_payload_id = '0'.repeat(64);
    value.shared_rows[0] = resignRow(row);
    value.exact_detail_packages[0].row =
      clone(value.shared_rows[0]);
  });
  expectInvalid((value) => {
    const row = clone(value.shared_rows[0]);
    row.metric_serving_admission_id = '0'.repeat(64);
    value.shared_rows[0] = resignRow(row);
    value.exact_detail_packages[0].row =
      clone(value.shared_rows[0]);
  });
});

test('a fully re-signed F23 shell cannot rewrite its fixed F19 predecessor', () => {
  const value = clone(bundle());
  const row = clone(value.shared_rows[0]);
  row.canonical_result.components[0].raw_value =
    'five (5) Business Days';
  row.canonical_result.components[0].canonical_value = '5';
  row.canonical_result.comparability_context
    .lawyer_warning.text = 'No ambiguity';
  value.shared_rows[0] = resignRow(row);
  value.exact_detail_packages[0].row =
    clone(value.shared_rows[0]);
  resignF23Envelope(value);
  assert.throws(
    () => validateMetricScopedCandidateReleaseF23(value),
    /candidate release|predecessor|root|drift/i,
  );
});

test('another V12 metric cannot borrow the copy-delivery release admission', () => {
  const contract = compileFixtureContractV12();
  const admission = buildCopyDeliveryMetricServingAdmission();
  const other = Object.values(METRIC_DEFINITIONS).find(
    (metric) => metric.metric_key !== admission.metric_key
      && contract.concepts.some(
        (concept) => concept.concept_key === metric.concept_key,
      )
      && contract.claim_definitions.some(
        (claim) => claim.claim_definition_key
          === metric.required_claim_definition_key,
      ),
  );
  assert.ok(other);
  assert.throws(
    () => resolveMetricServingAdmission({
      contract_bundle: contract,
      metric_key: other.metric_key,
      metric_version: other.metric_version,
      concept_key: other.concept_key,
      required_claim_definition_key:
        other.required_claim_definition_key,
      metric_serving_admission_id:
        admission.metric_serving_admission_id,
      declared_metric_serving_admission_ids: [
        admission.metric_serving_admission_id,
      ],
    }),
    /does not match the scoped admission/,
  );
});

test('a malformed sibling cannot suppress the valid release row', () => {
  const value = bundle();
  const invalid = clone(value.shared_rows[0]);
  invalid.canonical_payload_digest = '0'.repeat(64);
  const rendered = prepareMetricScopedRowsForRendering(
    [value.shared_rows[0], invalid],
    value,
  );
  assert.equal(rendered.length, 2);
  assert.equal(rendered[0].render_kind, 'ROW');
  assert.equal(rendered[1].render_kind, 'ROW_RENDER_FAILED');
  assert.equal(
    rendered[1].reason_code,
    'INVALID_METRIC_SCOPED_SHARED_SERVING_ROW',
  );
});

test('a locally re-signed semantic forgery cannot render under the admission', () => {
  const value = bundle();
  const forged = clone(value.shared_rows[0]);
  forged.canonical_result.components[0].raw_value =
    'five (5) Business Days';
  forged.canonical_result.components[0].canonical_value = '5';
  forged.canonical_result.comparability_context
    .lawyer_warning.text = 'No ambiguity';
  const resigned = resignRow(forged);
  const rendered = prepareMetricScopedRowsForRendering(
    [value.shared_rows[0], resigned],
    value,
  );
  assert.equal(rendered[0].render_kind, 'ROW');
  assert.equal(rendered[1].render_kind, 'ROW_RENDER_FAILED');
  assert.equal(
    rendered[1].reason_code,
    'INVALID_METRIC_SCOPED_SHARED_SERVING_ROW',
  );
});

test('the staging proof is bounded, rollback-only and residue-free', () => {
  const value = fixture();
  const source = fs.readFileSync(RUNNER, 'utf8');
  const start = source.indexOf('function f23RollbackSql');
  const end = source.indexOf(
    'function buildCopyDeliveryReleaseF23Attestation',
  );
  const f23Source = source.slice(start, end);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /--copy-delivery-release-f23-verify/);
  assert.match(f23Source, /BEGIN;/);
  assert.match(f23Source, /ROLLBACK;/);
  assert.doesNotMatch(f23Source, /\bCOMMIT\b/);
  assert.match(f23Source, /statement_timeout = '15000ms'/);
  assert.match(f23Source, /lock_timeout = '2000ms'/);
  assert.match(f23Source, /pg_advisory_xact_lock\(20260727, 23\)/);
  assert.match(f23Source, /ENABLE ROW LEVEL SECURITY/);
  assert.match(f23Source, /REVOKE ALL/);
  assert.doesNotMatch(f23Source, /(?:retry|setTimeout)/i);
  assert.deepEqual(value.staging_execution, {
    ...value.staging_execution,
    database_calls: 3,
    immediate_retries: 0,
    statement_timeout_ms: 15000,
    lock_timeout_ms: 2000,
    active_pointer_unchanged: true,
    rollback_verified: true,
    durable_rows_written: 0,
  });
  assert.equal(
    value.staging_execution.transaction.bound_carriers,
    5,
  );
  assert.equal(
    value.staging_execution.post_rollback.probe_table_exists,
    false,
  );
  assert.deepEqual(
    value.staging_execution.active_pointer_before,
    value.staging_execution.transaction.active_pointer_during,
  );
  assert.deepEqual(
    value.staging_execution.active_pointer_before,
    value.staging_execution.post_rollback.active_pointer_after,
  );
});

test('F19 through F22 identities and frozen live validators remain unchanged', () => {
  const identities = [
    [
      'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-canonical-f19-staging-attestation.json',
      'qxo_no_shop_copy_delivery_canonical_f19_id',
      '362d2a28419eb77a321267a733ba84ab6d61e44afc42a45a8d13a4ce3586afa1',
    ],
    [
      'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json',
      'qxo_no_shop_copy_delivery_query_f20_id',
      'c9045081e5950fbb2d9785ae8c8f40e30f4251b34135ce9e14d8e04c3ed1bc00',
    ],
    [
      'tests/fixtures/canonical-v2/v12-serving-admission-readiness-f21.json',
      'v12_serving_admission_readiness_f21_id',
      '5c01b73dccef292d23591d0e351ed51b68bad1cb24fe710a503cf120b5ae2825',
    ],
    [
      'tests/fixtures/canonical-v2/metric-serving-admission-f22.json',
      'metric_serving_admission_registry_id',
      '914e3fb39cb51012fc52844bfcea1495e9b6f02716828f92cbfac0580f04eb7f',
    ],
  ];
  identities.forEach(([path, key, expected]) => {
    assert.equal(
      JSON.parse(fs.readFileSync(path, 'utf8'))[key],
      expected,
    );
  });
  Object.entries(ACTIVE_VALIDATOR_SNAPSHOTS).forEach(
    ([sourcePath, expectedDigest]) => {
      assert.equal(
        contentId('F21_SOURCE_SNAPSHOT/V1', {
          source_path: sourcePath,
          source_bytes: fs.readFileSync(sourcePath, 'utf8'),
        }),
        expectedDigest,
      );
    },
  );
});

test('F23 live verification replays only against linked staging', (t) => {
  if (process.env.CANONICAL_V2_LIVE_F23 !== '1') {
    t.skip('set CANONICAL_V2_LIVE_F23=1 for the linked staging proof');
    return;
  }
  if (!fs.existsSync('supabase/.temp/project-ref')
    || !fs.existsSync('supabase/.temp/linked-project.json')) {
    t.skip('isolated staging project is not linked in this environment');
    return;
  }
  const run = spawnSync(process.execPath, [
    RUNNER,
    '--copy-delivery-release-f23-verify',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 300_000,
    env: {
      ...process.env,
      QXO_STAGING_QUERY_TIMEOUT_MS: '240000',
    },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), fixture());
});
