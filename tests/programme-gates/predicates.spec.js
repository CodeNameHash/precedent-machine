const assert = require('node:assert/strict');
const test = require('node:test');

const { ACCEPTANCE_DEFINITION_DESCRIPTORS, REVIEW_LANES } = require('../../lib/programme-gates/registry');
const {
  ACCEPTANCE_PREDICATES,
  AcceptancePredicateError,
  RAW_EVIDENCE_KEYS,
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const DEPLOYMENT_ID = 'dpl_test_containment';
const NOW = '2026-07-27T12:00:00.000Z';
const DIGEST_C = 'c'.repeat(64);
const DIGEST_D = 'd'.repeat(64);
const DIGEST_E = 'e'.repeat(64);
const DIGEST_F = 'f'.repeat(64);

function context(overrides = {}) {
  return {
    specificationRoot: ROOT,
    codeCommit: COMMIT,
    environment: 'STAGING',
    expectedSpecificationRoot: ROOT,
    expectedCodeCommit: COMMIT,
    expectedEnvironment: 'STAGING',
    observed_at: '2026-07-27T11:00:00.000Z',
    clock: { now: () => NOW },
    verifiedReviewSet: {
      evidence_id: DIGEST_C,
      reviewed_root: ROOT,
      lane_ids: REVIEW_LANES.map((lane) => lane.lane_id),
      all_dispositions_pass: true,
      legal_reviewer_eligible: true,
      independence_recomputed: true,
      root_before: ROOT,
      root_after: ROOT,
    },
    verifiedBenApproval: {
      evidence_id: DIGEST_D,
      approved_root: ROOT,
      passing_review_set_evidence_id: DIGEST_C,
      identity_and_signature_verified: true,
      unconditional: true,
    },
    ...overrides,
  };
}

const OBSERVED_AT = '2026-07-27T11:00:00.000Z';
const TESTS = Object.freeze([Object.freeze({
  schema_version: 'ProgrammeGateTestExecutionRecord/V1',
  test_id: 'P0-ROUTE-01',
  code_commit: COMMIT,
  environment: 'STAGING',
  command_digest: DIGEST_C,
  executable_digest: DIGEST_D,
  started_at: '2026-07-27T10:00:00.000Z',
  completed_at: '2026-07-27T10:30:00.000Z',
  exit_code: 0,
  output_digest: DIGEST_E,
})]);

const FIXTURES = Object.freeze({
  G0_MARKET_STATS_CONTAINED: Object.freeze({
    schema_version: 'MarketStatsContainmentAttestation/V1',
    gate_id: 'G0_MARKET_STATS_CONTAINED',
    code_commit: COMMIT,
    runtime_deployment_id: DEPLOYMENT_ID,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
    route_feature_enabled: false,
    method_probes: Object.freeze([{
      schema_version: 'ContainedRouteMethodProbe/V1',
      member_id: 'POST /api/market-stats',
      route_id: '/api/market-stats',
      method: 'POST',
      status: 503,
      error_code: 'MARKET_STATS_DISABLED',
      cache_control: 'private, no-store',
      database_calls: 0,
      corpus_reads: 0,
      retry_after: null,
      code_commit: COMMIT,
      runtime_deployment_id: DEPLOYMENT_ID,
      environment: 'STAGING',
      observed_at: OBSERVED_AT,
    }]),
    tests: TESTS,
  }),
  G0_BROAD_CORPUS_ROUTES_CONTAINED: Object.freeze({
    schema_version: 'BroadRouteContainmentAttestation/V1',
    gate_id: 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    code_commit: COMMIT,
    runtime_deployment_id: DEPLOYMENT_ID,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
    source_route_ids: Object.freeze(['GET /api/query/run']),
    built_route_ids: Object.freeze(['GET /api/query/run']),
    runtime_route_ids: Object.freeze(['GET /api/query/run']),
    routes: Object.freeze([{
      schema_version: 'BroadRouteActionObservation/V1',
      member_id: 'GET /api/query/run',
      route_id: '/api/query/run',
      method: 'GET',
      containment_class: 'QUERY_ROUTE',
      source_contained: true,
      built_contained: true,
      runtime_contained: true,
      runtime_status: 503,
      runtime_error_code: 'ROUTE_CONTAINED',
      database_calls: 0,
      corpus_reads: 0,
      node_corpus_reads: 0,
      legacy_fallback_used: false,
      code_commit: COMMIT,
      runtime_deployment_id: DEPLOYMENT_ID,
      environment: 'STAGING',
      observed_at: OBSERVED_AT,
    }]),
    tests: TESTS,
  }),
  G0_ZAYO_DISPOSITION: Object.freeze({
    schema_version: 'ZayoTrafficDisposition/V1',
    gate_id: 'G0_ZAYO_DISPOSITION',
    code_commit: COMMIT,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
    attestation_source_digest: DIGEST_D,
    process_identity_digest: DIGEST_C,
    owner: 'approved-owner',
    purpose: 'approved-purpose',
    recognition_status: 'RECOGNISED',
    rotation_required: false,
    rotation_completed: false,
    secret_field_count: 0,
  }),
  G0_CLAUDE_CREDENTIAL_ROTATION: Object.freeze({
    schema_version: 'ClaudeCredentialRotationReceipt/V1',
    gate_id: 'G0_CLAUDE_CREDENTIAL_ROTATION',
    code_commit: COMMIT,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
    attestation_source_digest: DIGEST_D,
    compromised_credential_ids: Object.freeze([DIGEST_C]),
    revoked_ids: Object.freeze([DIGEST_C]),
    replacement_activation_verified_at: '2026-07-27T10:00:00.000Z',
    secret_field_count: 0,
  }),
  G0_SUPABASE_SECRET_DISPOSITION: Object.freeze({
    schema_version: 'SupabaseSecretDisposition/V1',
    gate_id: 'G0_SUPABASE_SECRET_DISPOSITION',
    code_commit: COMMIT,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
    attestation_source_digest: DIGEST_D,
    disposition: 'ROTATED',
    rotation_verified_at: '2026-07-27T10:00:00.000Z',
    ben_approval_id: null,
    secret_field_count: 0,
  }),
  G0_STAGING_SUPABASE_ISOLATED: Object.freeze({
    production_project_identity_digest: DIGEST_C,
    staging_project_identity_digest: DIGEST_D,
    production_credential_identity_digest: DIGEST_E,
    staging_credential_identity_digest: DIGEST_F,
    production_dml_probe: 'DENIED',
    restore_mode: 'PRODUCTION_SNAPSHOT_ONLY',
  }),
  G0_STAGING_VERCEL_ISOLATED: Object.freeze({
    preview_deployment_id: 'preview-deployment-1',
    preview_credential_scope: 'STAGING_ONLY',
    production_alias_before: 'deal-corpus.vercel.app',
    production_alias_after: 'deal-corpus.vercel.app',
  }),
  G0_STAGING_ACCESS_PROTECTED: Object.freeze({
    unauthenticated_status: 403,
    authorised_status: 200,
  }),
  G0_EXACT_DIGEST_REVIEW_SET: Object.freeze({
    review_set_evidence_id: DIGEST_C,
    reviewed_root: ROOT,
  }),
  G0_BEN_SPEC_APPROVAL: Object.freeze({
    approval_evidence_id: DIGEST_D,
    approved_root: ROOT,
    passing_review_set_evidence_id: DIGEST_C,
    conditions: Object.freeze([]),
  }),
});

test('registry contains 27 explicit functions with exact closed claim membership', () => {
  const descriptors = new Map(
    ACCEPTANCE_DEFINITION_DESCRIPTORS.map((descriptor) => [descriptor.gate_id, descriptor]),
  );
  let count = 0;

  assert.deepEqual(Object.keys(ACCEPTANCE_PREDICATES), [...descriptors.keys()]);
  assert.deepEqual(Object.keys(RAW_EVIDENCE_KEYS), [...descriptors.keys()]);
  for (const [gateId, predicates] of Object.entries(ACCEPTANCE_PREDICATES)) {
    assert.deepEqual(Object.keys(predicates), descriptors.get(gateId).ordered_claim_keys);
    for (const predicate of Object.values(predicates)) {
      assert.equal(typeof predicate, 'function');
      count += 1;
    }
  }
  assert.equal(count, 27);
});

test('all ten raw fixtures produce only typed boolean PASS claims', () => {
  for (const [gateId, evidence] of Object.entries(FIXTURES)) {
    const claims = evaluateAcceptanceClaims({
      gate_id: gateId,
      evidence,
      context: context(),
    });
    assert.equal(Object.isFrozen(claims), true);
    assert.ok(claims.every((claim) => (
      Object.isFrozen(claim)
      && claim.result_type === 'BOOLEAN'
      && claim.typed_value === true
    )), gateId);
  }
});

test('unknown, missing and caller-supplied result fields fail exact raw membership', () => {
  for (const invalidEvidence of [
    { ...FIXTURES.G0_MARKET_STATS_CONTAINED, result: true },
    {
      route_feature_enabled: false,
      method_probes: FIXTURES.G0_MARKET_STATS_CONTAINED.method_probes,
    },
    {
      ...FIXTURES.G0_MARKET_STATS_CONTAINED,
      exact_acceptance_claims: [{
        claim_key: 'feature_gate_off',
        result_type: 'BOOLEAN',
        typed_value: true,
      }],
    },
  ]) {
    const claims = evaluateAcceptanceClaims({
      gate_id: 'G0_MARKET_STATS_CONTAINED',
      evidence: invalidEvidence,
      context: context(),
    });
    assert.ok(claims.every((claim) => claim.typed_value === false));
  }
});

test('each claim derives from raw measurements instead of a supplied PASS', () => {
  const marketClaims = evaluateAcceptanceClaims({
    gate_id: 'G0_MARKET_STATS_CONTAINED',
    evidence: {
      ...FIXTURES.G0_MARKET_STATS_CONTAINED,
      route_feature_enabled: true,
      method_probes: [{
        ...FIXTURES.G0_MARKET_STATS_CONTAINED.method_probes[0],
        database_calls: 1,
      }],
      tests: [{ ...TESTS[0], exit_code: 1 }],
    },
    context: context(),
  });
  assert.deepEqual(marketClaims.map((claim) => claim.typed_value), [false, false, false]);
});

test('root, code and environment mismatch invalidate every claim immediately', () => {
  for (const mismatch of [
    { specificationRoot: 'c'.repeat(64) },
    { codeCommit: 'd'.repeat(40) },
    { environment: 'PRODUCTION' },
  ]) {
    const claims = evaluateAcceptanceClaims({
      gate_id: 'G0_MARKET_STATS_CONTAINED',
      evidence: FIXTURES.G0_MARKET_STATS_CONTAINED,
      context: context(mismatch),
    });
    assert.ok(claims.every((claim) => claim.typed_value === false));
  }
});

test('live route and access evidence expires after 24 hours', () => {
  for (const gateId of [
    'G0_MARKET_STATS_CONTAINED',
    'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    'G0_STAGING_ACCESS_PROTECTED',
  ]) {
    const evidence = gateId.startsWith('G0_') && Object.hasOwn(FIXTURES[gateId], 'observed_at')
      ? { ...FIXTURES[gateId], observed_at: '2026-07-26T11:59:59.999Z' }
      : FIXTURES[gateId];
    const claims = evaluateAcceptanceClaims({
      gate_id: gateId,
      evidence,
      context: context({ observed_at: '2026-07-26T11:59:59.999Z' }),
    });
    assert.ok(claims.every((claim) => claim.typed_value === false), gateId);
  }
});

test('credential, isolation, review and Ben evidence expires after seven days', () => {
  for (const gateId of [
    'G0_ZAYO_DISPOSITION',
    'G0_CLAUDE_CREDENTIAL_ROTATION',
    'G0_SUPABASE_SECRET_DISPOSITION',
    'G0_STAGING_SUPABASE_ISOLATED',
    'G0_STAGING_VERCEL_ISOLATED',
    'G0_EXACT_DIGEST_REVIEW_SET',
    'G0_BEN_SPEC_APPROVAL',
  ]) {
    const claims = evaluateAcceptanceClaims({
      gate_id: gateId,
      evidence: FIXTURES[gateId],
      context: context({ observed_at: '2026-07-20T11:59:59.999Z' }),
    });
    assert.ok(claims.every((claim) => claim.typed_value === false), gateId);
  }
});

test('evidence at the exact freshness boundary remains valid', () => {
  const observedAt = '2026-07-26T12:00:00.000Z';
  const liveClaims = evaluateAcceptanceClaims({
    gate_id: 'G0_MARKET_STATS_CONTAINED',
    evidence: {
      ...FIXTURES.G0_MARKET_STATS_CONTAINED,
      observed_at: observedAt,
      method_probes: [{
        ...FIXTURES.G0_MARKET_STATS_CONTAINED.method_probes[0],
        observed_at: observedAt,
      }],
      tests: [{
        ...FIXTURES.G0_MARKET_STATS_CONTAINED.tests[0],
        started_at: '2026-07-26T10:00:00.000Z',
        completed_at: '2026-07-26T10:30:00.000Z',
      }],
    },
    context: context({ observed_at: observedAt }),
  });
  const governanceClaims = evaluateAcceptanceClaims({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    evidence: FIXTURES.G0_BEN_SPEC_APPROVAL,
    context: context({ observed_at: '2026-07-20T12:00:00.000Z' }),
  });
  assert.ok(liveClaims.every((claim) => claim.typed_value === true));
  assert.ok(governanceClaims.every((claim) => claim.typed_value === true));
});

test('future evidence fails and no system-clock fallback is allowed', () => {
  const futureObservedAt = '2026-07-27T12:00:00.001Z';
  const future = evaluateAcceptanceClaims({
    gate_id: 'G0_MARKET_STATS_CONTAINED',
    evidence: {
      ...FIXTURES.G0_MARKET_STATS_CONTAINED,
      observed_at: futureObservedAt,
      method_probes: [{
        ...FIXTURES.G0_MARKET_STATS_CONTAINED.method_probes[0],
        observed_at: futureObservedAt,
      }],
    },
    context: context({ observed_at: futureObservedAt }),
  });
  assert.ok(future.every((claim) => claim.typed_value === false));

  assert.throws(
    () => evaluateAcceptanceClaims({
      gate_id: 'G0_MARKET_STATS_CONTAINED',
      evidence: FIXTURES.G0_MARKET_STATS_CONTAINED,
      context: context({ clock: undefined }),
    }),
    (error) => (
      error instanceof AcceptancePredicateError
      && error.code === 'TRUSTED_CLOCK_REQUIRED'
    ),
  );
});

test('closed route and lane universes reject duplicates and omissions', () => {
  const routeClaims = evaluateAcceptanceClaims({
    gate_id: 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    evidence: {
      ...FIXTURES.G0_BROAD_CORPUS_ROUTES_CONTAINED,
      source_route_ids: ['/api/query/run', '/api/query/run'],
    },
    context: context(),
  });
  assert.ok(routeClaims.every((claim) => claim.typed_value === false));

  const reviewClaims = evaluateAcceptanceClaims({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidence: FIXTURES.G0_EXACT_DIGEST_REVIEW_SET,
    context: context({
      verifiedReviewSet: {
        ...context().verifiedReviewSet,
        lane_ids: context().verifiedReviewSet.lane_ids.slice(0, 4),
      },
    }),
  });
  assert.equal(reviewClaims[0].typed_value, false);
  assert.equal(reviewClaims.some((claim) => claim.typed_value === false), true);
});

test('review and Ben booleans are rejected and only verified records can satisfy claims', () => {
  const reviewBoolean = evaluateAcceptanceClaims({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidence: {
      review_set_evidence_id: DIGEST_C,
      reviewed_root: ROOT,
      eligible_reviewer: true,
    },
    context: context(),
  });
  assert.ok(reviewBoolean.every((claim) => claim.typed_value === false));

  const benBoolean = evaluateAcceptanceClaims({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    evidence: {
      ...FIXTURES.G0_BEN_SPEC_APPROVAL,
      ben_identity_verified: true,
    },
    context: context(),
  });
  assert.ok(benBoolean.every((claim) => claim.typed_value === false));

  const missingVerification = evaluateAcceptanceClaims({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    evidence: FIXTURES.G0_BEN_SPEC_APPROVAL,
    context: context({ verifiedBenApproval: undefined }),
  });
  assert.ok(missingVerification.every((claim) => claim.typed_value === false));
});

test('unknown gate fails closed', () => {
  assert.throws(
    () => evaluateAcceptanceClaims({
      gate_id: 'G0_NOT_REGISTERED',
      evidence: {},
      context: context(),
    }),
    (error) => error instanceof AcceptancePredicateError && error.code === 'UNKNOWN_GATE',
  );
});
