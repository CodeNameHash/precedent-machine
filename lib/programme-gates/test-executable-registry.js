const TEST_EXECUTABLE_SET_DOMAIN = 'PROGRAMME_GATE_TEST_EXECUTABLE_SET/V1';

const TEST_EXECUTABLE_FILES = Object.freeze({
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

const TEST_EXECUTABLE_DIGESTS = Object.freeze({
  'P0-ROUTE-01': '3256da535b37bc8072189fffbd07fc0d9bfdd093a2b17ab0166c31434fc27cfa',
  'GATE-01': 'e087a56de8d46f3a18fe9872ce8ea97e68c208b03e16593416c46fa4ebaf3fd5',
  'DEPLOY-CUTOVER-01': '4b2f09d06361dce56ae61127946a72c19ceae208d622f085d2c378062e7b67ec',
  'PREVIEW-AUTH-01': '727809074a09e2617f67abf710a8b171873fce9c821556fa20311de97762037f',
  'REVIEW-CONTEXT-01': '23700b1df68a364763b7f8989507e7c680820cd8baed4e409d06c0edb7ec5d1d',
  'CONTRACT-01': 'a4d10be2cb7765057cebb0afd9429ccd6be9fcbc7ed73c834fd0730423d8bb57',
});

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
  expectedTestExecutableDigest,
  testExecutableFiles,
};
