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
    'f46f3e9610b54a9b0d08a29e4768ac5de52a4722abc89a152cb11931961b7e69',
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
    'b1205e6364517a0b57c276618475ce12a2c76a81df589159927ab468455ccf65',
  );
  assert.equal(
    digest,
    'b43ea5cb3ca45ac7b24d08f85378e1b532bedaa80187460d21ae55b7dd5d8dd7',
  );
  assert.equal(
    value.candidate_release_bundle
      .metric_scoped_candidate_release_bundle_id,
    '831c95a1465aa02e1cd3314f1d2cea1847aef59e160a35afbfca966b4f330218',
  );
  assert.equal(
    value.candidate_release_bundle.manifest
      .candidate_release_manifest_id,
    '974fe5d7d6e0378416076bdbc748b6fe2e6b9c12c7b08b79a39974579c88703f',
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
    'c1e585a6e4acdf3c21a693ea469ea809681de2b8bb869b4daa1a1cee4a95caff',
  );
  assert.equal(
    value.cohort_requests[0].cohort_digest,
    '8b9b894fa751c9907b4ca7e738d23c67627da38219cb27a277b3f7165464952e',
  );
  assert.equal(
    value.cohort_requests[0].cache_key,
    'aea4dba6c47f4e868a8fef68f27e704b6cc90546b6f72819d9801f12a03ef934',
  );
  assert.equal(
    value.query_records[0].canonical_payload_digest,
    'a5db487f58e2e1fbdf0eca34adff3bea35a67157d179cfd0ccbd5e43c5cc0ec0',
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
    'bb882b5b18746af5a47c5b01d5e8c0dde6dfa6c037fcb2c4a21b290730a25a2d',
  );
  assert.equal(
    release.predecessor_manifest.candidate_release_manifest_id,
    '38a9b2110c8e7d36bbcf4d92b4932456f0a9e7e8ab3d287e9b9fdc16ef2c632e',
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
      '4b825c971317b982e20d2fd231f9f2329f263237648b363a4e3cf988dfc142a8',
    ],
    [
      'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json',
      'qxo_no_shop_copy_delivery_query_f20_id',
      'bf2e3edd1bf1247fe2bb5a21f01b86141725beb3ad9b1c0d61091b855fe4ba23',
    ],
    [
      'tests/fixtures/canonical-v2/v12-serving-admission-readiness-f21.json',
      'v12_serving_admission_readiness_f21_id',
      '7783e9734d257cadf52c330a6f201b246af060c486c5d69a9b2d490dccae6bd9',
    ],
    [
      'tests/fixtures/canonical-v2/metric-serving-admission-f22.json',
      'metric_serving_admission_registry_id',
      '419e1198e8cfb0451634a5847ed08c5935b17f4f06749f81804085318df71a9c',
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
