const assert = require('node:assert/strict');
const test = require('node:test');

const {
  G0_GATE_ORDER,
  buildG0StatusReadiness,
  createG0StatusReadinessAuthority,
  enumerateG0ExpectedMembers,
} = require('../../lib/programme-gates/g0-status-readiness');
const {
  createContainmentContractBundle,
} = require('../../lib/programme-gates/containment-contracts');
const {
  createIsolationContractBundle,
} = require('../../lib/programme-gates/isolation-contracts');
const {
  createReviewContractBundle,
} = require('../../lib/programme-gates/review-contracts');
const {
  createSecurityDispositionContractBundle,
} = require('../../lib/programme-gates/security-disposition-contracts');
const {
  TRUSTED_PUBLIC_KEY_REGISTRY,
} = require('../../lib/programme-gates/registry');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const EXECUTABLE = 'c'.repeat(64);
const NOW = '2026-07-28T12:00:00.000Z';

test('the complete G0 status order contains exactly the ten bootstrap gates', () => {
  assert.deepEqual(G0_GATE_ORDER, [
    'G0_MARKET_STATS_CONTAINED',
    'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    'G0_ZAYO_DISPOSITION',
    'G0_CLAUDE_CREDENTIAL_ROTATION',
    'G0_SUPABASE_SECRET_DISPOSITION',
    'G0_STAGING_SUPABASE_ISOLATED',
    'G0_STAGING_VERCEL_ISOLATED',
    'G0_STAGING_ACCESS_PROTECTED',
    'G0_EXACT_DIGEST_REVIEW_SET',
    'G0_BEN_SPEC_APPROVAL',
  ]);
});

test('the combined member enumerator dispatches every active G0 contract family', () => {
  const containment = createContainmentContractBundle({ specificationRoot: ROOT });
  const security = createSecurityDispositionContractBundle({ specificationRoot: ROOT });
  const isolation = createIsolationContractBundle({ specificationRoot: ROOT });
  const review = createReviewContractBundle({ specificationRoot: ROOT });

  assert.equal(enumerateG0ExpectedMembers({
    definition: containment.definitions[0],
    evidenceObject: {
      method_probes: [{ member_id: 'POST /api/market-stats' }],
      tests: [{ test_id: 'P0-ROUTE-01' }],
    },
  }).length, 2);
  assert.equal(enumerateG0ExpectedMembers({
    definition: security.definitions[0],
    evidenceObject: { gate_id: 'G0_ZAYO_DISPOSITION' },
  }).length, 1);
  assert.equal(enumerateG0ExpectedMembers({
    definition: isolation.definitions[0],
    evidenceObject: {},
  }).length, 1);
  assert.equal(enumerateG0ExpectedMembers({
    definition: review.definitions[0],
    evidenceObject: {
      review_set_evidence_id: 'd'.repeat(64),
      reviewed_root: ROOT,
    },
  }).length, 10);
  assert.throws(
    () => enumerateG0ExpectedMembers({
      definition: { evidence_contract: 'invented/v1' },
      evidenceObject: {},
    }),
    /unsupported G0 evidence contract/,
  );
});

test('G0 status readiness has a closed authority and refuses incomplete groups', () => {
  const authority = createG0StatusReadinessAuthority({
    specificationRoot: ROOT,
    codeCommit: COMMIT,
    environment: 'PRODUCTION',
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorExecutableDigest: EXECUTABLE,
    validatorKeyId: 'PROGRAMME_GATE_VALIDATOR_2026_07',
    verificationTime: NOW,
    reviewSigningAuthority: {},
  });
  assert.throws(
    () => buildG0StatusReadiness({
      authority,
      containment: {},
      security: {},
      isolation: {},
      review: {},
    }),
    /review-approval signing authority|closed input/,
  );
  assert.throws(
    () => createG0StatusReadinessAuthority({
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'PRODUCTION',
      keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
      validatorExecutableDigest: EXECUTABLE,
      validatorKeyId: 'PROGRAMME_GATE_VALIDATOR_2026_07',
      verificationTime: NOW,
      reviewSigningAuthority: {},
      manualPass: true,
    }),
    /closed input/,
  );
});
