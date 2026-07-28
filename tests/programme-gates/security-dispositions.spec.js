const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { domainDigest } = require('../../lib/programme-gates/bytes');
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
const OBSERVED_AT = '2026-07-28T07:21:18.000Z';
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
    verificationTime: '2026-07-28T07:22:00.000Z',
    ...overrides,
  });
}

test('the approved source records only the three non-secret owner confirmations', () => {
  const record = source();
  assert.deepEqual(Object.keys(record), [
    'schema_version',
    'source_id',
    'confirmed_by',
    'observed_at',
    'zayo',
    'claude',
    'supabase',
    'secret_field_count',
  ]);
  assert.equal(record.observed_at, OBSERVED_AT);
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
    ['/disposition', '/rotation_verified_at', '/ben_approval_id'],
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
      started_at: '2026-07-28T07:22:00.000Z',
      completed_at: '2026-07-28T07:23:00.000Z',
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
