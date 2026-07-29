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
if (MANDATORY_ADVERSARIAL_TEST_IDS.length !== 289
  || new Set(MANDATORY_ADVERSARIAL_TEST_IDS).size !== 289
  || crypto.createHash('sha256')
    .update(`${MANDATORY_ADVERSARIAL_TEST_IDS.join('\n')}\n`)
    .digest('hex') !== 'a03e2ac797ce941f1b04f82b30be78eb183ab5f26bf24c46b34046eef62b16a8') {
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
  'GATE-BOOTSTRAP-01': Object.freeze([
    'tests/programme-gates/bootstrap-acceptance-source.spec.js',
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
  'GATE-01': '6bcd59aae0d213a3edb2df8f5e63160f7658bf0a826e6101d14eeddbbf981dd7',
  'GATE-BOOTSTRAP-01': 'e02bc9acb2c965857e245f074eb2400a476b327792f6a4eda240abaa13b08a5b',
  'DEPLOY-CUTOVER-01': '53be6cb521df070c63974ddc1a75befed4ba7619975a3ce6d7b8cc228caf17ed',
  'PREVIEW-AUTH-01': '727809074a09e2617f67abf710a8b171873fce9c821556fa20311de97762037f',
  'REVIEW-CONTEXT-01': '2ce15e3a5635e7cfc3a2d2b9ba050139bb9c622e979fbc7400dd1a8fe9aa45e5',
  'CONTRACT-01': '3886fc33e3a9c3a3fcaaf3d71be09e1f9097200ce32632dfc0f50f43c29b883f',
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
