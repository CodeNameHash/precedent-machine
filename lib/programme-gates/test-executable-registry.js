const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TEST_EXECUTABLE_SET_DOMAIN = 'PROGRAMME_GATE_TEST_EXECUTABLE_SET/V1';
const ADVERSARIAL_SOURCE_PATH = path.resolve(
  __dirname,
  '../../docs/codex-program/adversarial-tests.md',
);
const UNIMPLEMENTED_EXECUTABLE_FILES = Object.freeze([
  'scripts/run-unimplemented-adversarial-test.mjs',
]);
const UNIMPLEMENTED_EXECUTABLE_DIGEST =
  'f1d8e5796856f8db729ae5a6f65d5cac5538175dd6b88ec1559d92f200ae7572';
const MANDATORY_ADVERSARIAL_TEST_IDS = Object.freeze(
  [...fs.readFileSync(ADVERSARIAL_SOURCE_PATH, 'utf8').matchAll(/^- `([^`]+)`/gm)]
    .map((match) => match[1]),
);
if (MANDATORY_ADVERSARIAL_TEST_IDS.length !== 286
  || new Set(MANDATORY_ADVERSARIAL_TEST_IDS).size !== 286
  || crypto.createHash('sha256')
    .update(`${MANDATORY_ADVERSARIAL_TEST_IDS.join('\n')}\n`)
    .digest('hex') !== 'e4ad6ea4d87db62d405f954007067f7eca87c32511c0aef97a5b258a5d3a87ed') {
  throw new Error('mandatory adversarial test identifier universe changed');
}

const IMPLEMENTED_TEST_EXECUTABLE_FILES = Object.freeze({
  'P0-ROUTE-01': Object.freeze([
    'tests/query-containment.test.js',
    'tests/broad-corpus-containment.test.js',
    'tests/service-client-route-actions.test.js',
  ]),
  'GATE-01': Object.freeze([
    'tests/programme-gates-schema-registry.test.js',
    'tests/programme-gates/g0-signer-workflow.spec.js',
    'tests/programme-gates/isolation-evidence.spec.js',
    'tests/programme-gates/predicates.spec.js',
    'tests/programme-gates/publication-executor.spec.js',
    'tests/programme-gates/publication.spec.js',
    'tests/programme-gates/security-disposition-signing.spec.js',
    'tests/programme-gates/security-dispositions.spec.js',
    'tests/programme-gates/validator-executable.spec.js',
    'tests/programme-gates/validator.spec.js',
  ]),
  'DEPLOY-CUTOVER-01': Object.freeze([
    'tests/programme-gates/isolation-evidence.spec.js',
    'tests/canonical-v2-staging-preview-access.test.js',
    'tests/canonical-v2-staging-runtime.test.js',
  ]),
  'PREVIEW-AUTH-01': Object.freeze([
    'tests/canonical-v2-staging-preview-access.test.js',
  ]),
  'REVIEW-CONTEXT-01': Object.freeze([
    'tests/programme-gates/review-artifact.spec.js',
    'tests/programme-gates/review-evidence.spec.js',
    'tests/programme-gates/review-readiness-signing.spec.js',
    'tests/programme-gates/g0-status-readiness.spec.js',
  ]),
  'CONTRACT-01': Object.freeze([
    'tests/programme-gates/contract-freeze-predicates.spec.js',
    'tests/programme-gates/predicates.spec.js',
    'tests/programme-gates/validator.spec.js',
  ]),
});

const IMPLEMENTED_TEST_EXECUTABLE_DIGESTS = Object.freeze({
  'P0-ROUTE-01': '3256da535b37bc8072189fffbd07fc0d9bfdd093a2b17ab0166c31434fc27cfa',
  'GATE-01': 'd5dcd66d3e0cea375ed2f9d91840b758397d1e306c889d8f45e22740cc5c4363',
  'DEPLOY-CUTOVER-01': '0ef8feb44867bcf85609b03a77dbee065d94212e4d42051d832d5aa814127d6a',
  'PREVIEW-AUTH-01': '727809074a09e2617f67abf710a8b171873fce9c821556fa20311de97762037f',
  'REVIEW-CONTEXT-01': '35e71d6102100ef4013c63c106a7d91143bbbcaba0cd3c089cb60ff97f78aede',
  'CONTRACT-01': '4f578fc05bc96f85db8cd53712e2accb76ff2a213f06e6701395106c93652f6f',
});

const TEST_EXECUTABLE_FILES = Object.freeze(Object.fromEntries(
  MANDATORY_ADVERSARIAL_TEST_IDS.map((testId) => [
    testId,
    IMPLEMENTED_TEST_EXECUTABLE_FILES[testId] || UNIMPLEMENTED_EXECUTABLE_FILES,
  ]),
));

const TEST_EXECUTABLE_DIGESTS = Object.freeze(Object.fromEntries(
  MANDATORY_ADVERSARIAL_TEST_IDS.map((testId) => [
    testId,
    IMPLEMENTED_TEST_EXECUTABLE_DIGESTS[testId] || UNIMPLEMENTED_EXECUTABLE_DIGEST,
  ]),
));

function testExecutableState(testId) {
  if (!Object.hasOwn(TEST_EXECUTABLE_FILES, testId)) {
    throw new Error(`unregistered programme-gate test ID: ${testId}`);
  }
  return Object.hasOwn(IMPLEMENTED_TEST_EXECUTABLE_FILES, testId)
    ? 'IMPLEMENTED'
    : 'BOUND_FAIL_CLOSED_UNIMPLEMENTED';
}

function testExecutableFiles(testId) {
  const files = TEST_EXECUTABLE_FILES[testId];
  if (!files) throw new Error(`unregistered programme-gate test ID: ${testId}`);
  return files;
}

function expectedTestExecutableDigest(testId) {
  const digest = TEST_EXECUTABLE_DIGESTS[testId];
  if (!digest) throw new Error(`unregistered programme-gate test ID: ${testId}`);
  return digest;
}

module.exports = {
  TEST_EXECUTABLE_DIGESTS,
  TEST_EXECUTABLE_FILES,
  TEST_EXECUTABLE_SET_DOMAIN,
  MANDATORY_ADVERSARIAL_TEST_IDS,
  expectedTestExecutableDigest,
  testExecutableState,
  testExecutableFiles,
};
