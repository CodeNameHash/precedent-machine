const {
  canonicalJson,
  sha256Hex,
} = require('../canonical-v2/canonical-bytes');

const SIGNATURE_FRAME = 'PROGRAMME_GATE_SIGNATURE/V1';
const DIGEST_FRAME = 'PROGRAMME_GATE_DIGEST/V1';
const TOKEN_PATTERN = /^[A-Z][A-Z0-9_./:-]{0,127}$/;

function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value), 'utf8');
}

function canonicalDigest(value) {
  return sha256Hex(canonicalBytes(value));
}

function domainDigest(domain, value) {
  const checkedDomain = requireScopedToken(domain, 'digest domain');
  return sha256Hex(Buffer.concat([
    Buffer.from(`${DIGEST_FRAME}\0`, 'utf8'),
    lengthPrefixed(checkedDomain),
    Buffer.from('\0', 'utf8'),
    canonicalBytes(value),
  ]));
}

function requireScopedToken(value, label) {
  if (typeof value !== 'string' || !TOKEN_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a closed uppercase programme-gate token`);
  }
  return value;
}

function lengthPrefixed(value) {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([
    Buffer.from(String(bytes.length), 'ascii'),
    Buffer.from(':', 'ascii'),
    bytes,
  ]);
}

function signatureBytes({ domain, role, payload }) {
  const checkedDomain = requireScopedToken(domain, 'signature domain');
  const checkedRole = requireScopedToken(role, 'signature role');
  return Buffer.concat([
    Buffer.from(`${SIGNATURE_FRAME}\0`, 'utf8'),
    lengthPrefixed(checkedDomain),
    Buffer.from('\0', 'utf8'),
    lengthPrefixed(checkedRole),
    Buffer.from('\0', 'utf8'),
    canonicalBytes(payload),
  ]);
}

module.exports = {
  DIGEST_FRAME,
  SIGNATURE_FRAME,
  canonicalBytes,
  canonicalDigest,
  domainDigest,
  signatureBytes,
};
