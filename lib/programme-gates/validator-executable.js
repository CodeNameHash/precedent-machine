const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { domainDigest } = require('./bytes');

const VALIDATOR_EXECUTABLE_DOMAIN = 'PROGRAMME_GATE_VALIDATOR_EXECUTABLE/V1';
const VALIDATOR_EXECUTABLE_FILES = Object.freeze([
  'lib/canonical-v2/canonical-bytes.js',
  'lib/programme-gates/bytes.js',
  'lib/programme-gates/containment-contracts.js',
  'lib/programme-gates/enumerate.js',
  'lib/programme-gates/predicates.js',
  'lib/programme-gates/registry.js',
  'lib/programme-gates/schema-registry.js',
  'lib/programme-gates/security-disposition-contracts.js',
  'lib/programme-gates/security-disposition-enumerator.js',
  'lib/programme-gates/security-disposition-readiness.js',
  'lib/programme-gates/security-disposition-signing.js',
  'lib/programme-gates/signatures.js',
  'lib/programme-gates/validator-executable.js',
  'lib/programme-gates/validator.js',
]);

function programmeGateValidatorExecutableDigest({
  root,
  readFileSync = fs.readFileSync,
}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('validator executable root must be non-empty');
  }
  if (typeof readFileSync !== 'function') {
    throw new TypeError('validator executable readFileSync must be a function');
  }
  const members = VALIDATOR_EXECUTABLE_FILES.map((file) => {
    const bytes = readFileSync(path.resolve(root, file));
    return Object.freeze({
      path: file,
      byte_length: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
  });
  return domainDigest(VALIDATOR_EXECUTABLE_DOMAIN, members);
}

module.exports = {
  VALIDATOR_EXECUTABLE_DOMAIN,
  VALIDATOR_EXECUTABLE_FILES,
  programmeGateValidatorExecutableDigest,
};
