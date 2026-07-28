const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { buildIsolationObservationSource } = require(
  '../../lib/programme-gates/isolation-collector',
);
const {
  createIsolationContractBundle,
} = require('../../lib/programme-gates/isolation-contracts');
const {
  ISOLATION_GATE_ORDER,
  buildIsolationReadiness,
  createIsolationReadinessAuthority,
} = require('../../lib/programme-gates/isolation-readiness');
const {
  buildIsolationSigningRequest,
  createIsolationSigningAuthority,
  preflightIsolationSignature,
} = require('../../lib/programme-gates/isolation-signing');
const {
  REGISTRY_DIGESTS,
} = require('../../lib/programme-gates/registry');
const {
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
} = require('../../lib/programme-gates/validator');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const OBSERVED_AT = '2026-07-28T12:00:00.000Z';
const PREVIEW_ID = 'dpl_Preview123';
const PROJECT_ID = 'prj_Test123';
const PRODUCTION_ID = 'dpl_Production123';

function envRecord(key, value, target, gitBranch) {
  return {
    id: `env_${key}`,
    key,
    value,
    type: 'sensitive',
    target: [target],
    updatedAt: 1785220000000,
    ...(gitBranch ? { gitBranch } : {}),
  };
}

function productionEnvironment(serviceKey = 'production-service-secret') {
  return [
    envRecord(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'production-anon-key',
      'production',
    ),
    envRecord(
      'NEXT_PUBLIC_SUPABASE_URL',
      'https://tzulhdasmioeechxapdy.supabase.co',
      'production',
    ),
    envRecord('SUPABASE_SERVICE_ROLE_KEY', serviceKey, 'production'),
    envRecord(
      'SUPABASE_URL',
      'https://tzulhdasmioeechxapdy.supabase.co',
      'production',
    ),
  ];
}

function previewEnvironment(serviceKey = 'staging-service-secret') {
  return [
    envRecord(
      'CANONICAL_V2_STAGING_DATABASE_URL',
      'postgresql://canonical_v2_preview.sjumbznveyyiizhwvixj:secret@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require',
      'preview',
      'codex/canonical-corpus-v2',
    ),
    envRecord(
      'CANONICAL_V2_REVIEW_ENABLED',
      'true',
      'preview',
      'codex/canonical-corpus-v2',
    ),
    envRecord(
      'NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED',
      'true',
      'preview',
      'codex/canonical-corpus-v2',
    ),
    envRecord(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'staging-anon-key',
      'preview',
      'codex/canonical-corpus-v2',
    ),
    envRecord(
      'NEXT_PUBLIC_SUPABASE_URL',
      'https://sjumbznveyyiizhwvixj.supabase.co',
      'preview',
      'codex/canonical-corpus-v2',
    ),
    envRecord(
      'SUPABASE_SERVICE_ROLE_KEY',
      serviceKey,
      'preview',
      'codex/canonical-corpus-v2',
    ),
    envRecord(
      'SUPABASE_URL',
      'https://sjumbznveyyiizhwvixj.supabase.co',
      'preview',
      'codex/canonical-corpus-v2',
    ),
  ];
}

function observationInput(overrides = {}) {
  return {
    observedAt: OBSERVED_AT,
    codeCommit: COMMIT,
    projectId: PROJECT_ID,
    previewDeploymentId: PREVIEW_ID,
    productionEnvironment: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://tzulhdasmioeechxapdy.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'production-service-secret',
    },
    previewEnvironmentRecords: previewEnvironment(),
    stagingServiceKey: 'staging-service-secret',
    productionDmlResponse: { status: 401 },
    previewDeployment: {
      id: PREVIEW_ID,
      target: null,
      projectId: PROJECT_ID,
      meta: {
        githubCommitRef: 'codex/canonical-corpus-v2',
        githubCommitSha: COMMIT,
      },
    },
    productionDeploymentBefore: {
      id: PRODUCTION_ID,
      target: 'production',
      projectId: PROJECT_ID,
    },
    productionDeploymentAfter: {
      id: PRODUCTION_ID,
      target: 'production',
      projectId: PROJECT_ID,
    },
    unauthenticatedResponse: {
      status: 302,
      location: 'https://vercel.com/sso-api?url=https%3A%2F%2Fpreview.test',
    },
    authorisedResponse: { status: 200 },
    previewRuntimeResponse: { status: 200 },
    ...overrides,
  };
}

function testResult(testId) {
  return {
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: testId,
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    command_digest: 'c'.repeat(64),
    executable_digest: 'd'.repeat(64),
    started_at: '2026-07-28T11:55:00.000Z',
    completed_at: '2026-07-28T11:56:00.000Z',
    exit_code: 0,
    output_digest: 'e'.repeat(64),
  };
}

function source() {
  return buildIsolationObservationSource(observationInput());
}

function readiness() {
  return buildIsolationReadiness({
    authority: createIsolationReadinessAuthority({
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'PRODUCTION',
      observedAt: OBSERVED_AT,
      verificationTime: '2026-07-28T12:01:00.000Z',
    }),
    source: source(),
    gateTestResult: testResult('GATE-01'),
    deployCutoverTestResult: testResult('DEPLOY-CUTOVER-01'),
  });
}

test('live inputs reduce to three non-secret isolation observations', () => {
  const result = source();
  assert.equal(result.production_project_ref, 'tzulhdasmioeechxapdy');
  assert.equal(result.staging_project_ref, 'sjumbznveyyiizhwvixj');
  assert.notEqual(
    result.production_credential_identity_digest,
    result.staging_credential_identity_digest,
  );
  assert.equal(result.production_dml_probe, 'DENIED');
  assert.equal(result.restore_mode, 'PRODUCTION_SNAPSHOT_ONLY');
  assert.equal(result.preview_credential_scope, 'STAGING_ONLY');
  assert.equal(result.unauthenticated_status, 302);
  assert.equal(result.unauthenticated_redirect_origin, 'https://vercel.com/sso-api');
  assert.equal(result.authorised_status, 200);
  assert.equal(result.secret_field_count, 0);
  assert.doesNotMatch(
    JSON.stringify(result),
    /production-service-secret|staging-service-secret|postgresql:/,
  );
});

test('a production-target deployment cannot satisfy the isolated Preview boundary', () => {
  assert.throws(() => buildIsolationObservationSource(observationInput({
    previewDeployment: {
      ...observationInput().previewDeployment,
      target: 'production',
    },
  })), /not the exact isolated branch commit/);
});

test('credential reuse, public preview, production access and deployment drift fail closed', () => {
  assert.throws(
    () => buildIsolationObservationSource(observationInput({
      previewEnvironmentRecords: previewEnvironment('production-service-secret').map(
        (record) => record.key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
          ? { ...record, value: 'production-anon-key' }
          : record,
      ),
      stagingServiceKey: 'production-service-secret',
    })),
    /credentials are not distinct/,
  );
  assert.throws(
    () => buildIsolationObservationSource(observationInput({
      productionDmlResponse: { status: 204 },
    })),
    /not denied/,
  );
  assert.throws(
    () => buildIsolationObservationSource(observationInput({
      unauthenticatedResponse: { status: 200 },
    })),
    /did not pass/,
  );
  assert.throws(
    () => buildIsolationObservationSource(observationInput({
      productionDeploymentAfter: {
        id: 'dpl_OtherProduction',
        target: 'production',
        projectId: PROJECT_ID,
      },
    })),
    /alias changed/,
  );
});

test('three active contracts produce exact unsigned readiness', () => {
  const contracts = createIsolationContractBundle({ specificationRoot: ROOT });
  assert.deepEqual(
    contracts.definitions.map((definition) => definition.evidence_object_json_schema_id),
    [
      'StagingSupabaseIsolationAttestation/V1',
      'StagingVercelIsolationAttestation/V1',
      'StagingAccessProtectionAttestation/V1',
    ],
  );
  for (const definition of contracts.definitions) {
    assert.equal(validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition), true);
  }
  const bundle = readiness();
  assert.deepEqual(bundle.candidates.map((candidate) => candidate.gate_id), ISOLATION_GATE_ORDER);
  assert.equal(bundle.readiness_state, 'READY_FOR_SIGNATURE');
  assert.equal(bundle.formal_gate_state, 'OPEN');
  assert.equal(bundle.private_key_used, false);
  assert.equal(bundle.status_publication_attempted, false);
  assert.deepEqual(
    bundle.candidates.map((candidate) => candidate.test_results[0].test_id),
    ['DEPLOY-CUTOVER-01', 'DEPLOY-CUTOVER-01', 'GATE-01'],
  );
  assert.ok(bundle.candidates.every(
    (candidate) => candidate.exact_acceptance_claims.every(
      (claim) => claim.result_type === 'BOOLEAN' && claim.typed_value === true,
    ),
  ));
});

test('externally signed isolation evidence passes the complete validator', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = 'TEST_ISOLATION_VALIDATOR';
  const authority = createIsolationSigningAuthority({
    keyRegistry: {
      schema_version: 'TrustedProgrammeGatePublicKeys/V1',
      registry_state: 'ACTIVE',
      keys: [{
        key_id: keyId,
        algorithm: 'Ed25519',
        public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
        permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
        permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
        valid_from: '2026-07-28T00:00:00.000Z',
        valid_until: '2026-07-29T00:00:00.000Z',
        revoked_at: null,
      }],
    },
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest: 'f'.repeat(64),
    validatorKeyId: keyId,
    verificationTime: '2026-07-28T12:01:00.000Z',
  });
  const bundle = readiness();
  for (const candidate of bundle.candidates) {
    const signingRequest = buildIsolationSigningRequest({
      authority,
      bundle,
      candidate,
    });
    const signature = crypto.sign(
      null,
      Buffer.from(signingRequest.signing_frame_base64, 'base64'),
      privateKey,
    ).toString('base64');
    const result = preflightIsolationSignature({
      authority,
      bundle,
      candidate,
      signingRequest,
      signature,
    });
    assert.equal(result.evidence_validation.valid, true);
    assert.equal(result.evidence_validation.state, 'PASS');
    assert.equal(result.signed_envelope.gate_id, candidate.gate_id);
  }
});
