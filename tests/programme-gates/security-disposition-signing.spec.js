const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildSecurityDispositionReadiness,
  createSecurityDispositionReadinessAuthority,
} = require('../../lib/programme-gates/security-disposition-readiness');
const {
  buildSecurityDispositionSigningRequest,
  createSecurityDispositionSigningAuthority,
  preflightSecurityDispositionSignature,
} = require('../../lib/programme-gates/security-disposition-signing');
const {
  REGISTRY_DIGESTS,
} = require('../../lib/programme-gates/registry');
const {
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
} = require('../../lib/programme-gates/validator');
const {
  expectedTestExecutableDigest,
} = require('../../lib/programme-gates/test-executable-registry');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const VALIDATOR_DIGEST = 'c'.repeat(64);
const KEY_ID = 'TEST_SECURITY_VALIDATOR';
const OBSERVED_AT = '2026-07-28T07:24:00.000Z';
const VERIFICATION_TIME = '2026-07-28T07:25:00.000Z';
const SOURCE_PATH = path.resolve(
  __dirname,
  '../../docs/certification/evidence/G0-SECURITY-DISPOSITIONS-2026-07-28.json',
);

function source() {
  return JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
}

function testResult() {
  return Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: 'GATE-01',
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    command_digest: 'd'.repeat(64),
    executable_digest: expectedTestExecutableDigest('GATE-01'),
    started_at: '2026-07-28T07:19:00.000Z',
    completed_at: '2026-07-28T07:20:00.000Z',
    exit_code: 0,
    output_digest: 'f'.repeat(64),
  });
}

function readiness() {
  return buildSecurityDispositionReadiness({
    authority: createSecurityDispositionReadinessAuthority({
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'PRODUCTION',
      observedAt: OBSERVED_AT,
      verificationTime: VERIFICATION_TIME,
    }),
    source: source(),
    testResult: testResult(),
  });
}

function fixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: KEY_ID,
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
      permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
      permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
      valid_from: '2026-07-28T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const authority = createSecurityDispositionSigningAuthority({
    keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest: VALIDATOR_DIGEST,
    validatorKeyId: KEY_ID,
    verificationTime: VERIFICATION_TIME,
  });
  return { authority, privateKey };
}

function signatureFor(request, privateKey) {
  return crypto.sign(
    null,
    Buffer.from(request.signing_frame_base64, 'base64'),
    privateKey,
  ).toString('base64');
}

test('all three exact readiness candidates become domain-separated signing requests', () => {
  const bundle = readiness();
  const { authority } = fixture();
  for (const candidate of bundle.candidates) {
    const request = buildSecurityDispositionSigningRequest({
      authority,
      bundle,
      candidate,
    });
    assert.equal(request.gate_id, candidate.gate_id);
    assert.equal(request.signing_domain, EVIDENCE_SIGNATURE_DOMAIN);
    assert.equal(request.signing_role, EVIDENCE_SIGNATURE_ROLE);
    assert.equal(request.readiness_state, 'READY_FOR_EXTERNAL_SIGNATURE');
    assert.equal(request.formal_gate_state, 'OPEN');
    assert.equal(request.private_key_used, false);
    assert.equal(request.signature, null);
    assert.equal(request.unsigned_envelope.validator_key_id, KEY_ID);
    assert.equal(
      request.unsigned_envelope.validator_executable_digest,
      VALIDATOR_DIGEST,
    );
  }
});

test('externally signed security evidence passes the complete validator preflight', () => {
  const bundle = readiness();
  const { authority, privateKey } = fixture();
  for (const candidate of bundle.candidates) {
    const signingRequest = buildSecurityDispositionSigningRequest({
      authority,
      bundle,
      candidate,
    });
    const result = preflightSecurityDispositionSignature({
      authority,
      bundle,
      candidate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
    assert.equal(result.evidence_validation.valid, true);
    assert.equal(result.evidence_validation.state, 'PASS');
    assert.equal(result.signed_envelope.gate_id, candidate.gate_id);
    assert.equal(result.formal_gate_state, 'OPEN');
    assert.equal(result.private_key_used, false);
    assert.equal(result.status_publication_attempted, false);
  }
});

test('signature, request, readiness and key drift all fail closed', () => {
  const bundle = readiness();
  const { authority, privateKey } = fixture();
  const candidate = bundle.candidates[0];
  const signingRequest = buildSecurityDispositionSigningRequest({
    authority,
    bundle,
    candidate,
  });
  const validSignature = signatureFor(signingRequest, privateKey);

  const invalidSignature = preflightSecurityDispositionSignature({
    authority,
    bundle,
    candidate,
    signingRequest,
    signature: Buffer.alloc(64, 1).toString('base64'),
  });
  assert.equal(invalidSignature.evidence_validation.state, 'OPEN');
  assert.equal(invalidSignature.signed_envelope, null);

  const driftedRequest = structuredClone(signingRequest);
  driftedRequest.signing_frame_sha256 = '0'.repeat(64);
  const requestMismatch = preflightSecurityDispositionSignature({
    authority,
    bundle,
    candidate,
    signingRequest: driftedRequest,
    signature: validSignature,
  });
  assert.equal(requestMismatch.evidence_validation.reason_code, 'SIGNING_REQUEST_MISMATCH');

  const driftedBundle = structuredClone(bundle);
  driftedBundle.attestation_source_digest = '0'.repeat(64);
  assert.throws(
    () => buildSecurityDispositionSigningRequest({
      authority,
      bundle: driftedBundle,
      candidate,
    }),
    /drifted/,
  );

  const revoked = fixture();
  const registry = structuredClone(revoked.authority.keyRegistry);
  registry.keys[0].revoked_at = VERIFICATION_TIME;
  assert.throws(
    () => createSecurityDispositionSigningAuthority({
      keyRegistry: registry,
      validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
      validatorExecutableDigest: VALIDATOR_DIGEST,
      validatorKeyId: KEY_ID,
      verificationTime: VERIFICATION_TIME,
    }),
    /not valid/,
  );
});

test('the signing module exposes no private-key signing function', () => {
  const exported = require('../../lib/programme-gates/security-disposition-signing');
  assert.deepEqual(Object.keys(exported).sort(), [
    'SIGNING_REQUEST_DOMAIN',
    'buildSecurityDispositionSigningRequest',
    'createSecurityDispositionSigningAuthority',
    'preflightSecurityDispositionSignature',
  ]);
});
