const crypto = require('node:crypto');
const { signatureBytes } = require('./bytes');
const { validateSchema } = require('./schema-registry');

const SIGNATURE_ALGORITHM = 'Ed25519';
const SUPPORTED_KEY_TYPE = 'ed25519';
const TRUSTED_KEY_FIELDS = Object.freeze([
  'algorithm',
  'key_id',
  'permitted_domains',
  'permitted_roles',
  'public_key_pem',
  'revoked_at',
  'valid_from',
  'valid_until',
]);

function asEpochMilliseconds(value, label) {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    if (Number.isFinite(milliseconds)) return milliseconds;
  }
  if (typeof value === 'string') {
    const milliseconds = Date.parse(value);
    if (Number.isFinite(milliseconds)) return milliseconds;
  }
  if (Number.isFinite(value)) return value;
  throw new TypeError(`${label} must be a valid time`);
}

function keyForVerification({
  keyRegistry,
  keyId,
  role,
  domain,
  at,
}) {
  if (!keyRegistry || !Array.isArray(keyRegistry.keys)) {
    throw new TypeError('trusted public-key registry is invalid');
  }
  validateSchema('TrustedProgrammeGatePublicKeys/V1', keyRegistry);
  if (keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('trusted public-key registry is not active');
  }
  const matches = keyRegistry.keys.filter((entry) => entry.key_id === keyId);
  if (matches.length !== 1) throw new Error(`untrusted or ambiguous key ID: ${keyId}`);

  const key = matches[0];
  const actualFields = Object.keys(key).sort();
  if (actualFields.length !== TRUSTED_KEY_FIELDS.length
    || actualFields.some((field, index) => field !== TRUSTED_KEY_FIELDS[index])) {
    throw new Error(`key ${keyId} does not match the closed trusted-key record`);
  }
  if (key.algorithm !== SIGNATURE_ALGORITHM) {
    throw new Error(`key ${keyId} does not permit ${SIGNATURE_ALGORITHM}`);
  }
  if (!Array.isArray(key.permitted_roles) || !key.permitted_roles.includes(role)) {
    throw new Error(`key ${keyId} does not permit role ${role}`);
  }
  if (!Array.isArray(key.permitted_domains) || !key.permitted_domains.includes(domain)) {
    throw new Error(`key ${keyId} does not permit domain ${domain}`);
  }

  const verificationTime = asEpochMilliseconds(at, 'verification time');
  const validFrom = asEpochMilliseconds(key.valid_from, 'key valid_from');
  const validUntil = asEpochMilliseconds(key.valid_until, 'key valid_until');
  if (validFrom >= validUntil) throw new Error(`key ${keyId} has an invalid validity interval`);
  if (key.revoked_at !== null
    && verificationTime >= asEpochMilliseconds(key.revoked_at, 'key revoked_at')) {
    throw new Error(`key ${keyId} is revoked`);
  }
  if (verificationTime < validFrom) {
    throw new Error(`key ${keyId} is not yet valid`);
  }
  if (verificationTime >= validUntil) {
    throw new Error(`key ${keyId} is expired`);
  }

  const publicKey = crypto.createPublicKey(key.public_key_pem);
  if (publicKey.asymmetricKeyType !== SUPPORTED_KEY_TYPE) {
    throw new Error(`key ${keyId} must be an Ed25519 public key`);
  }
  return publicKey;
}

function decodeSignature(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('signature must be non-empty base64');
  }
  const signature = Buffer.from(value, 'base64');
  if (signature.length === 0 || signature.toString('base64') !== value) {
    throw new TypeError('signature must use canonical base64');
  }
  return signature;
}

function verifySignature({
  keyRegistry,
  keyId,
  role,
  domain,
  payload,
  signature,
  at = Date.now(),
}) {
  const publicKey = keyForVerification({
    keyRegistry,
    keyId,
    role,
    domain,
    at,
  });
  const verified = crypto.verify(
    null,
    signatureBytes({ domain, role, payload }),
    publicKey,
    decodeSignature(signature),
  );
  if (!verified) throw new Error('programme-gate signature verification failed');
  return true;
}

module.exports = {
  SIGNATURE_ALGORITHM,
  verifySignature,
};
