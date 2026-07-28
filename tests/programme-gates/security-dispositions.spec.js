const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const {
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');
const { verifySignature } = require('../../lib/programme-gates/signatures');
const {
  createSecurityDispositionContractBundle,
} = require('../../lib/programme-gates/security-disposition-contracts');
const {
  SECURITY_DISPOSITION_CONTRACTS,
  enumerateSecurityDispositionExpectedMembers,
  memberSchemaSetForSecurityDisposition,
} = require('../../lib/programme-gates/security-disposition-enumerator');
const {
  SECURITY_GATE_ORDER,
  buildSecurityDispositionReadiness,
  createSecurityDispositionReadinessAuthority,
} = require('../../lib/programme-gates/security-disposition-readiness');
const { enumerateClosedMembers } = require('../../lib/programme-gates/enumerate');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const CONFIRMED_AT = '2026-07-28T07:21:18.000Z';
const OBSERVED_AT = '2026-07-28T07:24:00.000Z';
const SOURCE_PATH = path.resolve(
  __dirname,
  '../../docs/certification/evidence/G0-SECURITY-DISPOSITIONS-2026-07-28.json',
);

function source() {
  return JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
}

function testResult(overrides = {}) {
  return Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: 'GATE-01',
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    command_digest: 'c'.repeat(64),
    executable_digest: 'd'.repeat(64),
    started_at: '2026-07-28T07:19:00.000Z',
    completed_at: '2026-07-28T07:20:00.000Z',
    exit_code: 0,
    output_digest: 'e'.repeat(64),
    ...overrides,
  });
}

function authority(overrides = {}) {
  return createSecurityDispositionReadinessAuthority({
    specificationRoot: ROOT,
    codeCommit: COMMIT,
    environment: 'PRODUCTION',
    observedAt: OBSERVED_AT,
    verificationTime: '2026-07-28T07:25:00.000Z',
    ...overrides,
  });
}

test('the approved source records only the three non-secret owner confirmations', () => {
  const record = source();
  assert.deepEqual(Object.keys(record), [
    'schema_version',
    'source_id',
    'confirmed_by',
    'confirmed_at',
    'zayo',
    'claude',
    'supabase',
    'secret_field_count',
  ]);
  assert.equal(record.confirmed_at, CONFIRMED_AT);
  assert.equal(record.zayo.recognition_status, 'RECOGNISED');
  assert.equal(record.claude.revoked, true);
  assert.equal(record.claude.replacements_activated, true);
  assert.equal(record.supabase.disposition, 'ROTATED');
  assert.equal(record.secret_field_count, 0);
  assert.doesNotMatch(JSON.stringify(record), /sk-|sb_secret_|service_role|BEGIN PRIVATE KEY/i);
});

test('the three active contracts are closed and bind distinct evidence schemas', () => {
  const bundle = createSecurityDispositionContractBundle({ specificationRoot: ROOT });
  assert.deepEqual(
    bundle.definitions.map((definition) => definition.evidence_contract),
    Object.values(SECURITY_DISPOSITION_CONTRACTS),
  );
  assert.deepEqual(
    bundle.definitions.map((definition) => definition.evidence_object_json_schema_id),
    [
      'ZayoTrafficDisposition/V1',
      'ClaudeCredentialRotationReceipt/V1',
      'SupabaseSecretDisposition/V1',
    ],
  );
  for (const definition of bundle.definitions) {
    assert.equal(validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition), true);
    assert.equal(
      definition.immutable_member_json_schema_set_digest,
      domainDigest(
        'PROGRAMME_GATE_MEMBER_SCHEMA_SET/V1',
        memberSchemaSetForSecurityDisposition(definition.evidence_contract),
      ),
    );
  }
  assert.deepEqual(
    bundle.definitions[0].ordered_claim_predicate_definitions[0]
      .exact_input_member_types_and_paths.map((entry) => entry.json_pointer),
    ['/process_identity_digest', '/owner', '/purpose', '/secret_field_count'],
  );
  assert.deepEqual(
    bundle.definitions[2].ordered_claim_predicate_definitions[0]
      .exact_input_member_types_and_paths.map((entry) => entry.json_pointer),
    ['/disposition', '/rotation_verified_at', '/zayo_disposition_id', '/ben_approval_id'],
  );
});

test('the approved source produces three typed unsigned readiness candidates', () => {
  const readiness = buildSecurityDispositionReadiness({
    authority: authority(),
    source: source(),
    testResult: testResult(),
  });
  assert.equal(readiness.readiness_state, 'READY_FOR_SIGNATURE');
  assert.equal(readiness.formal_gate_state, 'OPEN');
  assert.equal(readiness.private_key_used, false);
  assert.equal(readiness.status_publication_attempted, false);
  assert.deepEqual(
    readiness.candidates.map((candidate) => candidate.gate_id),
    SECURITY_GATE_ORDER,
  );
  for (const candidate of readiness.candidates) {
    assert.equal(candidate.readiness_state, 'READY_FOR_SIGNATURE');
    assert.equal(candidate.formal_gate_state, 'OPEN');
    assert.equal(candidate.signature, null);
    assert.ok(candidate.exact_acceptance_claims.every(
      (claim) => claim.result_type === 'BOOLEAN' && claim.typed_value === true,
    ));
    assert.equal(candidate.evidence_object.secret_field_count, 0);
    assert.equal(
      candidate.evidence_object.attestation_source_digest,
      readiness.attestation_source_digest,
    );
    const definition = readiness.acceptance_definitions.find(
      (entry) => entry.definition_id === candidate.acceptance_definition_id,
    );
    const expectedMembers = enumerateSecurityDispositionExpectedMembers({
      definition,
      evidenceObject: candidate.evidence_object,
    });
    assert.equal(enumerateClosedMembers({
      expectedMembers,
      members: candidate.members,
    }).length, 1);
  }
  const claude = readiness.candidates[1].evidence_object;
  assert.deepEqual(claude.compromised_credential_ids, claude.revoked_ids);
  assert.match(claude.compromised_credential_ids[0], /^[a-f0-9]{64}$/);
});

test('missing, altered, stale or secret-bearing confirmations fail closed', () => {
  const missing = source();
  delete missing.supabase;
  assert.throws(
    () => buildSecurityDispositionReadiness({
      authority: authority(),
      source: missing,
      testResult: testResult(),
    }),
    /closed input/,
  );

  const altered = source();
  altered.claude.revoked = false;
  assert.throws(
    () => buildSecurityDispositionReadiness({
      authority: authority(),
      source: altered,
      testResult: testResult(),
    }),
    /approved confirmations/,
  );

  assert.throws(
    () => buildSecurityDispositionReadiness({
      authority: authority({ verificationTime: '2026-08-05T07:22:00.000Z' }),
      source: source(),
      testResult: testResult(),
    }),
    /acceptance claims/,
  );

  const secretBearing = source();
  secretBearing.secret_field_count = 1;
  assert.throws(
    () => buildSecurityDispositionReadiness({
      authority: authority(),
      source: secretBearing,
      testResult: testResult(),
    }),
    /approved confirmations/,
  );
});

test('wrong, failed or post-attestation GATE-01 executions fail closed', () => {
  for (const result of [
    testResult({ test_id: 'P0-ROUTE-01' }),
    testResult({ exit_code: 1 }),
    testResult({ code_commit: 'f'.repeat(40) }),
    testResult({
      started_at: '2026-07-28T07:25:00.000Z',
      completed_at: '2026-07-28T07:26:00.000Z',
    }),
  ]) {
    assert.throws(
      () => buildSecurityDispositionReadiness({
        authority: authority(),
        source: source(),
        testResult: result,
      }),
      /GATE-01 execution/,
    );
  }
});

test('Supabase N/A requires the exact recognised Zayo fact and signed Ben approval', () => {
  const ben = crypto.generateKeyPairSync('ed25519');
  const sourceDigest = '3'.repeat(64);
  const zayo = {
    schema_version: 'ZayoTrafficDisposition/V1',
    gate_id: 'G0_ZAYO_DISPOSITION',
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    observed_at: OBSERVED_AT,
    attestation_source_digest: sourceDigest,
    process_identity_digest: '4'.repeat(64),
    owner: 'OWNER_IDENTITY_CONFIRMED_BY_BEN_GOODCHILD',
    purpose: 'AUTHORISED_DATABASE_TRAFFIC',
    recognition_status: 'RECOGNISED',
    rotation_required: false,
    rotation_completed: false,
    secret_field_count: 0,
  };
  const zayoId = domainDigest('PROGRAMME_GATE_ZAYO_DISPOSITION_ID/V1', zayo);
  const approvalIdentity = {
    schema_version: 'SupabaseSecretNaApproval/V1',
    supabase_attestation_source_digest: sourceDigest,
    zayo_process_identity_digest: zayo.process_identity_digest,
    approved_disposition: 'RECOGNISED_TRAFFIC_APPROVED_NA',
    approver_identity: 'BEN_GOODCHILD',
    conditions: [],
    approved_at: OBSERVED_AT,
    signature_algorithm: 'Ed25519',
    approver_key_id: 'BEN_NA_KEY',
  };
  const approvalId = domainDigest(
    'PROGRAMME_GATE_SUPABASE_SECRET_NA_APPROVAL_ID/V1',
    approvalIdentity,
  );
  const approvalUnsigned = { ...approvalIdentity, approval_id: approvalId };
  const approval = {
    ...approvalUnsigned,
    signature: crypto.sign(
      null,
      signatureBytes({
        domain: 'PROGRAMME_GATE_SUPABASE_SECRET_NA_APPROVAL/V1',
        role: 'BEN_APPROVER',
        payload: approvalUnsigned,
      }),
      ben.privateKey,
    ).toString('base64'),
  };
  const evidence = {
    schema_version: 'SupabaseSecretDisposition/V1',
    gate_id: 'G0_SUPABASE_SECRET_DISPOSITION',
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    observed_at: OBSERVED_AT,
    attestation_source_digest: sourceDigest,
    disposition: 'RECOGNISED_TRAFFIC_APPROVED_NA',
    rotation_verified_at: null,
    zayo_disposition_id: zayoId,
    ben_approval_id: approvalId,
    secret_field_count: 0,
  };
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: 'BEN_NA_KEY',
      algorithm: 'Ed25519',
      public_key_pem: ben.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      permitted_roles: ['BEN_APPROVER'],
      permitted_domains: ['PROGRAMME_GATE_SUPABASE_SECRET_NA_APPROVAL/V1'],
      valid_from: '2026-07-28T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const claims = (members) => evaluateAcceptanceClaims({
    gate_id: 'G0_SUPABASE_SECRET_DISPOSITION',
    evidence,
    context: {
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'PRODUCTION',
      expectedSpecificationRoot: ROOT,
      expectedCodeCommit: COMMIT,
      expectedEnvironment: 'PRODUCTION',
      observed_at: OBSERVED_AT,
      clock: { now: () => '2026-07-28T07:25:00.000Z' },
      immutableMembers: members,
      keyRegistry,
      verifySignature,
      domainDigest,
    },
  });
  const members = [
    {
      member_id: `zayo:${zayoId}`,
      member_type: 'ZayoTrafficDisposition',
      payload: zayo,
    },
    {
      member_id: `approval:${approvalId}`,
      member_type: 'SupabaseSecretNaApproval',
      payload: approval,
    },
  ];
  assert.deepEqual(claims(members).map((claim) => claim.typed_value), [true, true]);
  assert.equal(claims(members.slice(1))[0].typed_value, false);
  const forged = structuredClone(members);
  forged[1].payload.signature = Buffer.alloc(64, 1).toString('base64');
  assert.equal(claims(forged)[0].typed_value, false);
});
