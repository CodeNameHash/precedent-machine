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
  // PREVIEW-AUTH-01 is NOT implemented: its specification is that every
  // preview page and action denies unauthenticated access and that forged
  // and CSRF attempts fail. tests/canonical-v2-staging-preview-access.test.js
  // (previously bound here) asserts regular expressions against the source
  // text of scripts/canonical-v2-staging-preview-access.mjs -- a database
  // credential-provisioning script -- and never issues an HTTP request or
  // exercises a page. That is a real test of something else; it is not this
  // test. There is also no live authentication to test yet (ROADMAP.md S2).
  // Registering it here previously would have reported IMPLEMENTED for a
  // test that cannot fail when unauthenticated access actually succeeds.
  'REVIEW-CONTEXT-01': Object.freeze([
    'tests/programme-gates/review-artifact.spec.js',
    'tests/programme-gates/review-evidence.spec.js',
    'tests/programme-gates/review-readiness-signing.spec.js',
    'tests/programme-gates/g0-status-readiness.spec.js',
  ]),
  'CONTRACT-01': Object.freeze([
    'tests/p1-contract-freeze-review-registration.test.js',
    'tests/programme-gates/contract-freeze-predicates.spec.js',
    'tests/programme-gates/predicates.spec.js',
    'tests/programme-gates/validator.spec.js',
  ]),
  'VERTICAL-SLICE-01': Object.freeze([
    'tests/programme-gates/process-vertical-slice-registration.spec.js',
    'tests/programme-gates-schema-registry.test.js',
  ]),
});

const IMPLEMENTED_TEST_EXECUTABLE_DIGESTS = Object.freeze({
  'P0-ROUTE-01': '73e7b2f1031fc7a9a389a452c4ac73fee81c11c3ecafdf9885595689f393a7b2',
  'GATE-01': '8bb06dda0a625141f8b1b708ef59acbfbf1cfc95fbc73b1554f7f3d80e219b83',
  'GATE-BOOTSTRAP-01': '9d9ffaaa48978955374fbdeac4d5eb495d269cc10606607535b21deb6b302ac7',
  'DEPLOY-CUTOVER-01': '53be6cb521df070c63974ddc1a75befed4ba7619975a3ce6d7b8cc228caf17ed',
  'REVIEW-CONTEXT-01': 'd077e51de06d60dbb45713e86205c747c9d3f567b5f62dfffe165dff4421eb0b',
  'CONTRACT-01': '91a2be749fee09d5b3dbbdf22cc09cefd0635d3eb15a0763d688db00788b59f5',
  'VERTICAL-SLICE-01': '80bb69d3c96f1bc11645a77fff45d536ae510674d3474551ee6591fcbbbb3761',
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
