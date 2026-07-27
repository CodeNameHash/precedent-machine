const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const { signatureBytes } = require('../lib/programme-gates/bytes');
const {
  SIGNATURE_ALGORITHM,
  verifySignature,
} = require('../lib/programme-gates/signatures');

const NOW = '2026-07-27T12:00:00.000Z';
const DOMAIN = 'TRUSTED_REVIEW_CONTROLLER_RECORD/V1';
const ROLE = 'REVIEW_CONTROLLER';
const PAYLOAD = Object.freeze({
  immutable_review_id: 'review-1',
  reviewer_disposition: 'PASS',
});

function fixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const key = {
    key_id: 'TEST_REVIEW_CONTROLLER_KEY',
    algorithm: 'Ed25519',
    public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
    permitted_roles: ['REVIEW_CONTROLLER'],
    permitted_domains: ['TRUSTED_REVIEW_CONTROLLER_RECORD/V1'],
    valid_from: '2026-07-27T00:00:00.000Z',
    valid_until: '2026-07-28T00:00:00.000Z',
    revoked_at: null,
  };
  const signature = crypto.sign(
    null,
    signatureBytes({ domain: DOMAIN, role: ROLE, payload: PAYLOAD }),
    privateKey,
  ).toString('base64');
  return {
    keyRegistry: {
      schema_version: 'TrustedProgrammeGatePublicKeys/V1',
      registry_state: 'ACTIVE',
      keys: [key],
    },
    key,
    privateKey,
    signature,
  };
}

test('Ed25519 verification succeeds only for the exact payload, role and domain', () => {
  const { keyRegistry, signature } = fixture();
  assert.equal(SIGNATURE_ALGORITHM, 'Ed25519');
  assert.equal(verifySignature({
    keyRegistry,
    keyId: 'TEST_REVIEW_CONTROLLER_KEY',
    role: ROLE,
    domain: DOMAIN,
    payload: PAYLOAD,
    signature,
    at: NOW,
  }), true);

  for (const changed of [
    { payload: { ...PAYLOAD, reviewer_disposition: 'FAIL' } },
    { role: 'VALIDATOR' },
    { domain: 'PROGRAMME_GATE_EVIDENCE/V2' },
  ]) {
    assert.throws(() => verifySignature({
      keyRegistry,
      keyId: 'TEST_REVIEW_CONTROLLER_KEY',
      role: ROLE,
      domain: DOMAIN,
      payload: PAYLOAD,
      signature,
      at: NOW,
      ...changed,
    }), /does not permit|verification failed/);
  }
});

test('verification rejects untrusted, revoked, premature and expired keys', () => {
  const { keyRegistry, key, signature } = fixture();
  const verifyWith = (registry, at = NOW, keyId = key.key_id) => verifySignature({
    keyRegistry: registry,
    keyId,
    role: ROLE,
    domain: DOMAIN,
    payload: PAYLOAD,
    signature,
    at,
  });

  assert.throws(() => verifyWith(keyRegistry, NOW, 'UNKNOWN_KEY'), /untrusted or ambiguous/);
  assert.throws(
    () => verifyWith({ ...keyRegistry, registry_state: 'EMPTY_NOT_ACTIVATED' }),
    /not active/,
  );
  assert.throws(
    () => verifyWith({ ...keyRegistry, keys: [{ ...key, revoked_at: '2026-07-27T11:00:00.000Z' }] }),
    /revoked/,
  );
  assert.equal(
    verifyWith({ ...keyRegistry, keys: [{ ...key, revoked_at: '2026-07-27T13:00:00.000Z' }] }),
    true,
  );
  assert.throws(() => verifyWith(keyRegistry, '2026-07-26T23:59:59.999Z'), /not yet valid/);
  assert.throws(() => verifyWith(keyRegistry, '2026-07-28T00:00:00.000Z'), /expired/);
});

test('verification rejects extra trusted-key fields', () => {
  const { keyRegistry, key, signature } = fixture();
  assert.throws(() => verifySignature({
    keyRegistry: { ...keyRegistry, keys: [{ ...key, owner_note: 'ignore me' }] },
    keyId: key.key_id,
    role: ROLE,
    domain: DOMAIN,
    payload: PAYLOAD,
    signature,
    at: NOW,
  }), /additional properties/);
});

test('verification rejects another algorithm or asymmetric key type', () => {
  const { keyRegistry, key, signature } = fixture();
  assert.throws(() => verifySignature({
    keyRegistry: { ...keyRegistry, keys: [{ ...key, algorithm: 'ECDSA' }] },
    keyId: key.key_id,
    role: ROLE,
    domain: DOMAIN,
    payload: PAYLOAD,
    signature,
    at: NOW,
  }), /algorithm must be equal to constant/);

  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => verifySignature({
    keyRegistry: {
      ...keyRegistry,
      keys: [{
        ...key,
        public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
      }],
    },
    keyId: key.key_id,
    role: ROLE,
    domain: DOMAIN,
    payload: PAYLOAD,
    signature,
    at: NOW,
  }), /must be an Ed25519 public key/);
});

test('signature module exposes verification only and accepts canonical base64 only', () => {
  const signatures = require('../lib/programme-gates/signatures');
  const { keyRegistry } = fixture();
  assert.equal(Object.hasOwn(signatures, 'sign'), false);
  assert.deepEqual(Object.keys(signatures).sort(), ['SIGNATURE_ALGORITHM', 'verifySignature']);
  assert.throws(() => verifySignature({
    keyRegistry,
    keyId: 'TEST_REVIEW_CONTROLLER_KEY',
    role: ROLE,
    domain: DOMAIN,
    payload: PAYLOAD,
    signature: 'not-base64',
    at: NOW,
  }), /canonical base64/);
});
