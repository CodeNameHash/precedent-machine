const { signatureBytes } = require('./bytes');

const TEST_EXECUTION_SIGNATURE_DOMAIN = 'PROGRAMME_GATE_TEST_EXECUTION/V1';
const TEST_EXECUTION_SIGNATURE_ROLE = 'TEST_EXECUTION_ATTESTER';

function unsignedTestExecutionRecord(record) {
  const { execution_signature: executionSignature, ...payload } = record;
  void executionSignature;
  return payload;
}

function attestTestExecutionRecord({
  record,
  attesterKeyId,
  sign,
}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('test execution record must be an object');
  }
  if (typeof attesterKeyId !== 'string' || attesterKeyId.length === 0) {
    throw new TypeError('test execution attester key ID must be non-empty');
  }
  if (typeof sign !== 'function') {
    throw new TypeError('test execution signer must be a function');
  }
  const unsignedRecord = Object.freeze({
    ...record,
    attester_key_id: attesterKeyId,
    signature_algorithm: 'Ed25519',
  });
  const executionSignature = sign(signatureBytes({
    domain: TEST_EXECUTION_SIGNATURE_DOMAIN,
    role: TEST_EXECUTION_SIGNATURE_ROLE,
    payload: unsignedRecord,
  }));
  if (typeof executionSignature !== 'string' || executionSignature.length === 0) {
    throw new TypeError('test execution signature must be non-empty');
  }
  return Object.freeze({
    ...unsignedRecord,
    execution_signature: executionSignature,
  });
}

module.exports = {
  TEST_EXECUTION_SIGNATURE_DOMAIN,
  TEST_EXECUTION_SIGNATURE_ROLE,
  attestTestExecutionRecord,
  unsignedTestExecutionRecord,
};
