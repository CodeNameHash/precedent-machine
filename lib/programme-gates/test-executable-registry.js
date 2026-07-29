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
  'GATE-01': 'ac756444fc3638ec65583249e1285530babcd45e078d2b6b4f4eeb2a207f22e2',
  'DEPLOY-CUTOVER-01': '4b2f09d06361dce56ae61127946a72c19ceae208d622f085d2c378062e7b67ec',
  'PREVIEW-AUTH-01': '727809074a09e2617f67abf710a8b171873fce9c821556fa20311de97762037f',
  'REVIEW-CONTEXT-01': 'd653d19d0d05be1256c4f4f75237bfab9a0ea24559769d8f1fd57c5775536eca',
  'CONTRACT-01': 'd9cfdd132687ccf60bcd852f64f107754cde92873ba294066a9eee456fbcf1a1',
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
