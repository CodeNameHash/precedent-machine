// SPEC-VERSIONED-CONTRACT-2026-07-23.
//
// A reviewed artifact is bound to the contract it was reviewed under,
// forever: vocabulary growth must never move past reviews' digests. This
// file is the authoritative proof of that guarantee for the F1 -> F2
// amendment (Ben-approved concept keys: TERMR-NOSOL-BREACH, TERMR-BREACH,
// TERMR-NOVOTE, TERMR-OUTSIDE):
//
//   1. F1-immobility: compileFixtureContract()'s DEFAULT is unchanged. Every
//      existing reviewed-*-slice.js oracle and its pinned digest stays valid
//      with zero edits.
//   2. F2-pin: compileFixtureContractV2() compiles to a stable, pinned
//      fingerprint once computed.
//   3. Superset-diff: F2's compiled bundle is byte-identical to F1's in
//      every field except `concepts`, and F2's concepts are exactly F1's
//      concepts plus the four approved additions -- nothing else moved.

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT,
  FIXTURE_CONTRACT_INPUT_V1,
  FIXTURE_CONTRACT_INPUT_V2,
  FIXTURE_CONTRACT_INPUT_V3,
  FIXTURE_CONTRACT_INPUT_V4,
  FIXTURE_CONTRACT_INPUT_V5,
  FIXTURE_CONTRACT_INPUT_V6,
  FIXTURE_CONTRACT_INPUT_V7,
  FIXTURE_CONTRACT_INPUT_V8,
  FIXTURE_CONTRACT_INPUT_V9,
  FIXTURE_CONTRACT_INPUT_V10,
  FIXTURE_CONTRACT_INPUT_V11,
  FIXTURE_CONTRACT_INPUT_V12,
  FIXTURE_CONTRACT_INPUT_V13,
  FIXTURE_CONTRACT_INPUT_V18,
  FIXTURE_CONTRACT_INPUT_V19,
  FIXTURE_CONTRACT_INPUT_V20,
  FIXTURE_CONTRACT_INPUT_V21,
  FIXTURE_CONTRACT_INPUT_V22,
  FIXTURE_CONTRACT_INPUT_V23,
  FIXTURE_CONTRACT_INPUT_V24,
  FIXTURE_CONTRACT_INPUT_V25,
  FIXTURE_CONTRACT_INPUT_V26,
  FIXTURE_CONTRACT_INPUT_V27,
  FIXTURE_CONTRACT_INPUT_V28,
  FIXTURE_CONTRACT_INPUT_V29,
  FIXTURE_CONTRACT_FINGERPRINTS,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  BRINGS_DOWN_EFFECT_SCHEMA_V1,
  CAPITALISATION_REPRESENTATION_SCHEMA_V1,
  CLAIM_INTERPRETATION_POLICY_V1,
  CLAIM_INTERPRETATION_POLICY_V2,
  GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1,
  NO_SHOP_ACTION_CODES_V2,
  NO_SHOP_ACTION_ROLLUP_SCHEMA_V1,
  NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V6,
  NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
  REPRESENTATION_ACCURACY_STANDARD_METRIC_DEFINITION_V2,
  REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1,
  RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1,
  TARGET_CAPITALISATION_BRING_DOWN_RESULT_DEFINITION_V2,
  USES_DEFINITION_EFFECT_SCHEMA_V1,
  USES_DEFINITION_EFFECT_SCHEMA_V2,
  USES_DEFINITION_EFFECT_SCHEMA_V3,
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
  compileFixtureContractV6,
  compileFixtureContractV7,
  compileFixtureContractV8,
  compileFixtureContractV9,
  compileFixtureContractV10,
  compileFixtureContractV11,
  compileFixtureContractV12,
  compileFixtureContractV13,
  compileFixtureContractV16,
  compileFixtureContractV17,
  compileFixtureContractV18,
  compileFixtureContractV19,
  compileFixtureContractV20,
  compileFixtureContractV21,
  compileFixtureContractV22,
  compileFixtureContractV23,
  compileFixtureContractV24,
  compileFixtureContractV25,
  compileFixtureContractV26,
  compileFixtureContractV27,
  compileFixtureContractV28,
  compileFixtureContractV29,
  fixtureContractForFingerprint,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

const FROZEN_F1 = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const FROZEN_F2 = '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83';
const FROZEN_F3 = '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c';
const FROZEN_F4 = 'd4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74';
const FROZEN_F5 = 'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478';
const FROZEN_F6 = '161083b014a35d800dec0b0c41a97dc6d97f38a5dd206b388ba51b3ab9f68c08';
const FROZEN_F7 = '5037e25762892f44f660516913d58a23c17ebab0c10c160fcf8cbd0f65a90969';
const FROZEN_F8 = 'dd0f1d4afc02492edf1bbbebe1a6699498fd6c3d26d890254a151b1d8c7d0a80';
const FROZEN_F9 = '8576011555a67b18f6539bb259dea4285d2e3d982c4b906a3edc73162dc9e8c7';
const FROZEN_F10 = 'aee4b40ead2e76ed744b0f20967a48493c618125959a023f8262612da23aa0e5';
const FROZEN_F11 = '7cf669cb86e8cda58b33a623b7f5405e56b7c1aa4c9dfdbe1136edb6beffa6ca';
const FROZEN_F12 = '261525a8268a1392428a610bbf0c2166c87318192971d08bc7e6ac5f2c7235e5';
const FROZEN_F13 = '3c8ca48ff4f1f2f482b14a188045aa3a1ec7072704d396f7306b483e6338f2ac';
// F14 (P1 cap-table numeric promotions, docs/superpowers/specs/2026-08-02-
// p1-captable-numerics-design.md section 1): strictly additive spread of
// F13 -- two new claim definitions (CAPITALIZATION_SHARE_COUNT,
// RESERVED_SHARE_POOL), zero concept additions, zero other field changes.
const FROZEN_F14 = '6b58314592cc553675a4a3efefea8ae3caa7e9edb8a5625260b61e0e8b2591e7';
// F15 (family-termination-fee slice, docs/superpowers/specs/2026-08-02-
// family-termination-fee-design.md section 1): strictly additive spread of
// F14 -- three new claim definitions (TERMINATION_FEE_AMOUNT,
// TERMINATION_FEE_TRIGGER, TERMINATION_FEE_TAIL_PERIOD_MONTHS), zero
// concept additions, zero other field changes. See
// tests/canonical-v2-contract-bundle-v15.test.js for the dedicated V15
// acceptance tests (superset-diff by content, per the openworld-promotion-
// program's own merge-order convention).
const FROZEN_F15 = 'e7ae756e69c289ebe125bb2a1a9aa03753951bb761fb9b2a9b9a88cb7f48b57f';
// F16 (family-mae-definition slice, docs/superpowers/specs/2026-08-02-
// family-mae-definition-design.md section 1, AUDIT-AMENDED): strictly
// additive spread of F15 -- one new concept (DEF-MAE) and three new claim
// definitions (MAE_CARVEOUT, MAE_DEFINITION_PRONG,
// MAE_DISPROPORTIONALITY_CARVEBACK), zero other field changes. Derived by
// running compileFixtureContractV16() against the current code and pinning
// the resulting fingerprint (see tests/canonical-v2-contract-bundle-v16.test.js
// for the dedicated V16 acceptance tests).
const FROZEN_F16 = 'a1fe3ddb45d2371ccd428747da6837084ea61cd476afd1f74a964c5824f4fb87';
// F17 (family-termination-rights slice, docs/superpowers/specs/2026-08-02-
// family-termination-rights-design.md section 1, AUDIT-AMENDED): strictly
// additive spread of F16 -- two new concepts (TERMR-MUTUAL, TERMR-LEGAL,
// both FLAGGED FOR BEN) and three new claim definitions
// (TERMINATION_RIGHT_GRANT, TERMINATION_OUTSIDE_DATE, TERMINATION_CURE_
// PERIOD_DAYS), zero other field changes. Derived by running
// compileFixtureContractV17() against the current code and pinning the
// resulting fingerprint (see tests/canonical-v2-contract-bundle-v17.test.js
// for the dedicated V17 acceptance tests).
const FROZEN_F17 = 'c2d43ad9f6fd0008cc09b74d1d2dd75c87793781a40bd79faaa6f91e4b0fae5b';
const FROZEN_F18 = '49ffa4029d5bc4431b5bf7249c7008d482b41c13e7b01984822742b90027433d';
const FROZEN_F19 = '8ad419a69175c5c5db1506da15ccaff1d63fbf56c0d4424a123a0e7ebcfbec33';
const FROZEN_F28 = '1c0a086d1e9d20eb1eadcb6fab09527bbe9483189269e4ce6f8ba31b59402b1f';
const FROZEN_F29 = '25a9b634ce4e8c3e6f06d6287e9514116f7f13fa1b986ab0f282ca62aae22691';

const APPROVED_V2_ADDITIONS = [
  'TERMR-BREACH',
  'TERMR-NOSOL-BREACH',
  'TERMR-NOVOTE',
  'TERMR-OUTSIDE',
];

// ---------------------------------------------------------------------------
// 1. F1-immobility
// ---------------------------------------------------------------------------

test('compileFixtureContract() DEFAULT compiles to the frozen F1 fingerprint', () => {
  const bundle = compileFixtureContract();
  assert.equal(bundle.fingerprint, FROZEN_F1);
  assert.equal(validateContractBundle(bundle), true);
});

test('FIXTURE_CONTRACT_INPUT_V1 is byte-identical to the pre-versioning FIXTURE_CONTRACT_INPUT (test-proven, not asserted)', () => {
  // If FIXTURE_CONTRACT_INPUT_V1 had drifted from the exact input every
  // reviewed-*-slice.js oracle was built against, its compiled fingerprint
  // would move off F1. It does not.
  assert.equal(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V1).fingerprint, FROZEN_F1);
  // The exported back-compat alias used directly by existing callers
  // (tests/canonical-v2-source-identity.test.js, staging scripts) is the
  // exact same object, not a re-derived copy.
  assert.equal(FIXTURE_CONTRACT_INPUT, FIXTURE_CONTRACT_INPUT_V1);
});

test('every reviewed-*-slice.js oracle keeps compiling under F1 with zero edits', () => {
  const contractBundle = compileFixtureContract();
  const fs = require('node:fs');

  const { buildReviewedTerminationFeeSlice } = require('../lib/canonical-v2/reviewed-termination-fee-slice');
  const landosAgreement = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
  const landosDealValue = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
  assert.doesNotThrow(() => buildReviewedTerminationFeeSlice({
    agreementText: landosAgreement,
    dealValueSourceText: landosDealValue,
    contractBundle,
  }));
});

// ---------------------------------------------------------------------------
// 2. F2-pin
// ---------------------------------------------------------------------------

test('compileFixtureContractV2() compiles to a pinned F2 fingerprint', () => {
  const bundle = compileFixtureContractV2();
  assert.equal(bundle.fingerprint, FROZEN_F2);
  assert.equal(validateContractBundle(bundle), true);
});

test('compileFixtureContract(FIXTURE_CONTRACT_INPUT_V2) is equivalent to compileFixtureContractV2()', () => {
  assert.equal(
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V2)),
    canonicalJson(compileFixtureContractV2()),
  );
});

test('F1 through F29 are distinct recognised fixture contract fingerprints', () => {
  assert.notEqual(FROZEN_F1, FROZEN_F2);
  assert.notEqual(FROZEN_F2, FROZEN_F3);
  assert.notEqual(FROZEN_F3, FROZEN_F4);
  assert.notEqual(FROZEN_F4, FROZEN_F5);
  assert.notEqual(FROZEN_F5, FROZEN_F6);
  assert.notEqual(FROZEN_F6, FROZEN_F7);
  assert.notEqual(FROZEN_F7, FROZEN_F8);
  assert.notEqual(FROZEN_F8, FROZEN_F9);
  assert.notEqual(FROZEN_F9, FROZEN_F10);
  assert.notEqual(FROZEN_F10, FROZEN_F11);
  assert.notEqual(FROZEN_F11, FROZEN_F12);
  assert.notEqual(FROZEN_F12, FROZEN_F13);
  assert.notEqual(FROZEN_F13, FROZEN_F14);
  assert.notEqual(FROZEN_F14, FROZEN_F15);
  assert.notEqual(FROZEN_F15, FROZEN_F16);
  assert.notEqual(FROZEN_F16, FROZEN_F17);
  assert.notEqual(FROZEN_F17, FROZEN_F18);
  assert.notEqual(FROZEN_F18, FROZEN_F19);
  assert.notEqual(FROZEN_F19, compileFixtureContractV20().fingerprint);
  assert.notEqual(compileFixtureContractV20().fingerprint, compileFixtureContractV21().fingerprint);
  assert.notEqual(compileFixtureContractV21().fingerprint, compileFixtureContractV22().fingerprint);
  assert.notEqual(compileFixtureContractV22().fingerprint, compileFixtureContractV23().fingerprint);
  assert.notEqual(compileFixtureContractV23().fingerprint, compileFixtureContractV24().fingerprint);
  assert.notEqual(compileFixtureContractV24().fingerprint, compileFixtureContractV25().fingerprint);
  assert.notEqual(compileFixtureContractV25().fingerprint, compileFixtureContractV26().fingerprint);
  assert.notEqual(compileFixtureContractV26().fingerprint, compileFixtureContractV27().fingerprint);
  assert.notEqual(compileFixtureContractV27().fingerprint, compileFixtureContractV28().fingerprint);
  assert.notEqual(compileFixtureContractV28().fingerprint, compileFixtureContractV29().fingerprint);
  assert.deepEqual(
    [...FIXTURE_CONTRACT_FINGERPRINTS].sort(),
    [
      FROZEN_F1,
      FROZEN_F2,
      FROZEN_F3,
      FROZEN_F4,
      FROZEN_F5,
      FROZEN_F6,
      FROZEN_F7,
      FROZEN_F8,
      FROZEN_F9,
      FROZEN_F10,
      FROZEN_F11,
      FROZEN_F12,
      FROZEN_F13,
      FROZEN_F14,
      FROZEN_F15,
      FROZEN_F16,
      FROZEN_F17,
      FROZEN_F18,
      FROZEN_F19,
      compileFixtureContractV20().fingerprint,
      compileFixtureContractV21().fingerprint,
      compileFixtureContractV22().fingerprint,
      compileFixtureContractV23().fingerprint,
      compileFixtureContractV24().fingerprint,
      compileFixtureContractV25().fingerprint,
      compileFixtureContractV26().fingerprint,
      compileFixtureContractV27().fingerprint,
      FROZEN_F28,
      FROZEN_F29,
    ].sort(),
  );
  assert.deepEqual(
    [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
    [FROZEN_F1, FROZEN_F2, FROZEN_F3, FROZEN_F4, FROZEN_F5].sort(),
  );
});

test('compileFixtureContractV16() compiles to a pinned F16 fingerprint (family-mae-definition slice)', () => {
  const bundle = compileFixtureContractV16();
  assert.equal(bundle.fingerprint, FROZEN_F16);
  assert.equal(validateContractBundle(bundle), true);
});

test('compileFixtureContractV17() compiles to a pinned F17 fingerprint (family-termination-rights slice)', () => {
  const bundle = compileFixtureContractV17();
  assert.equal(bundle.fingerprint, FROZEN_F17);
  assert.equal(validateContractBundle(bundle), true);
});

test('compileFixtureContractV18() compiles to a pinned F18 fingerprint (P2 qualifier kinds phase 2)', () => {
  const bundle = compileFixtureContractV18();
  assert.equal(bundle.fingerprint, FROZEN_F18);
  assert.equal(validateContractBundle(bundle), true);
  assert.equal(canonicalJson(bundle), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V18)));
});

test('compileFixtureContractV19() compiles to the antitrust regulatory-efforts vocabulary', () => {
  const bundle = compileFixtureContractV19();
  assert.equal(bundle.fingerprint, FROZEN_F19);
  assert.equal(validateContractBundle(bundle), true);
  assert.deepEqual(bundle.concepts.filter((concept) => concept.concept_key.startsWith('ANTI-')).map((concept) => concept.concept_key).sort(), ['ANTI-BURDEN', 'ANTI-EFFORTS', 'ANTI-FILING', 'ANTI-LITIGATION', 'ANTI-TIMING']);
  assert.equal(FIXTURE_CONTRACT_INPUT_V19.claim_definitions.length, FIXTURE_CONTRACT_INPUT_V18.claim_definitions.length + 6);
});

test('compileFixtureContractV20() adds the M3-B antitrust shapes without changing V19', () => {
  const bundle = compileFixtureContractV20();
  assert.equal(validateContractBundle(bundle), true);
  assert.deepEqual(
    bundle.concepts.filter((concept) => concept.concept_key.startsWith('ANTI-')).map((concept) => concept.concept_key).sort(),
    ['ANTI-AGREEMENTS', 'ANTI-BURDEN', 'ANTI-CONSULT', 'ANTI-EFFORTS', 'ANTI-FILING', 'ANTI-LITIGATION', 'ANTI-NOACTION', 'ANTI-STRATEGY', 'ANTI-TIMING'],
  );
  assert.equal(FIXTURE_CONTRACT_INPUT_V20.claim_definitions.length, FIXTURE_CONTRACT_INPUT_V19.claim_definitions.length + 7);
});

test('compileFixtureContractV28() adds the exact General Covenants vocabulary', () => {
  const bundle = compileFixtureContractV28();
  assert.equal(bundle.fingerprint, FROZEN_F28);
  assert.equal(validateContractBundle(bundle), true);
  assert.equal(canonicalJson(bundle), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V28)));
  assert.equal(bundle.claim_definitions.some(
    (definition) => definition.claim_definition_key === 'GENERAL_COVENANT_PRESENT',
  ), true);
});

test('compileFixtureContractV29() adds the adjudicated Proxy and Meeting follow-on vocabulary', () => {
  const bundle = compileFixtureContractV29();
  assert.equal(bundle.fingerprint, FROZEN_F29);
  assert.equal(validateContractBundle(bundle), true);
  assert.equal(
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V29)),
    canonicalJson(bundle),
  );
});

test('F22 adds only the three grounded Consideration concepts and claims', () => {
  const f21 = compileFixtureContractV21();
  const f22 = compileFixtureContractV22();
  assert.equal(validateContractBundle(f22), true);
  assert.equal(FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(f22.fingerprint), false);
  assert.equal(canonicalJson(f22), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V22)));
  assert.deepEqual(
    f22.concepts.filter((entry) => !f21.concepts.some(
      (prior) => prior.concept_key === entry.concept_key,
    )),
    [
      { concept_key: 'CONS-DISSENT', version: 1 },
      { concept_key: 'CONS-PERSHARE', version: 1 },
      { concept_key: 'CONS-RATIO', version: 1 },
    ],
  );
  assert.deepEqual(
    f22.claim_definitions.filter((entry) => !f21.claim_definitions.some(
      (prior) => prior.claim_definition_key === entry.claim_definition_key,
    )).map((entry) => entry.claim_definition_key),
    [
      'APPRAISAL_RIGHTS_STATUS',
      'EXCHANGE_RATIO_VALUE',
      'PER_SHARE_CASH_CONSIDERATION',
    ],
  );
  const { concepts: _concepts, claim_definitions: _claims, fingerprint: _fingerprint, ...f22Rest } = f22;
  const { concepts: _priorConcepts, claim_definitions: _priorClaims, fingerprint: _priorFingerprint, ...f21Rest } = f21;
  assert.equal(canonicalJson(f22Rest), canonicalJson(f21Rest));
});

test('F23 adds only the Closing Conditions foundation concepts and claims', () => {
  const f22 = compileFixtureContractV22();
  const f23 = compileFixtureContractV23();
  assert.equal(validateContractBundle(f23), true);
  assert.equal(canonicalJson(f23), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V23)));
  assert.deepEqual(
    f23.concepts.filter((entry) => !f22.concepts.some((prior) => prior.concept_key === entry.concept_key)),
    [
      { concept_key: 'COND-COV', version: 1 },
      { concept_key: 'COND-MAE', version: 1 },
      { concept_key: 'COND-REG', version: 1 },
      { concept_key: 'COND-S-REP', version: 1 },
    ],
  );
  assert.deepEqual(
    f23.claim_definitions.filter((entry) => !f22.claim_definitions.some(
      (prior) => prior.claim_definition_key === entry.claim_definition_key,
    )).map((entry) => entry.claim_definition_key),
    [
      'COVENANT_COMPLIANCE_STANDARD',
      'NO_MAE_CONDITION',
      'NO_MAE_CONDITION_CONTINUING',
      'REGULATORY_APPROVAL_CONDITION',
    ],
  );
});

test('F24 adds only the Closing Conditions Wave B concepts and claims', () => {
  const f23 = compileFixtureContractV23();
  const f24 = compileFixtureContractV24();
  assert.equal(validateContractBundle(f24), true);
  assert.equal(canonicalJson(f24), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V24)));
  assert.deepEqual(
    f24.concepts.filter((entry) => !f23.concepts.some((prior) => prior.concept_key === entry.concept_key)),
    [
      { concept_key: 'COND-B-CERT', version: 1 },
      { concept_key: 'COND-FRUSTRATE', version: 1 },
      { concept_key: 'COND-M-LEGAL', version: 1 },
      { concept_key: 'COND-M-LISTING', version: 1 },
      { concept_key: 'COND-M-S4', version: 1 },
      { concept_key: 'COND-M-STOCKHOLDER', version: 1 },
      { concept_key: 'COND-S-CERT', version: 1 },
      { concept_key: 'COND-S-FUNDS', version: 1 },
    ],
  );
});

test('F25 adds only IOC restriction-presence concepts and claim', () => {
  const f24 = compileFixtureContractV24();
  const f25 = compileFixtureContractV25();
  assert.equal(validateContractBundle(f25), true);
  assert.equal(canonicalJson(f25), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V25)));
  assert.deepEqual(
    f25.concepts.filter((entry) => !f24.concepts.some((prior) => prior.concept_key === entry.concept_key)),
    [
      'IOC-ACCOUNTING', 'IOC-CHARTER', 'IOC-COMP', 'IOC-CONTRACT', 'IOC-DEBT',
      'IOC-DIVIDEND', 'IOC-ISSUE', 'IOC-MERGE', 'IOC-SETTLE', 'IOC-TAX',
    ].map((concept_key) => ({ concept_key, version: 1 })).sort((a, b) => a.concept_key.localeCompare(b.concept_key)),
  );
  assert.deepEqual(
    f25.claim_definitions.filter((entry) => !f24.claim_definitions.some(
      (prior) => prior.claim_definition_key === entry.claim_definition_key,
    )).map((entry) => entry.claim_definition_key),
    ['IOC_RESTRICTION_PRESENT'],
  );
});

test('F27 adds only the two grounded Material Contracts claims', () => {
  const f26 = compileFixtureContractV26();
  const f27 = compileFixtureContractV27();
  assert.equal(validateContractBundle(f27), true);
  assert.equal(canonicalJson(f27), canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V27)));
  assert.deepEqual(f27.concepts, f26.concepts);
  assert.deepEqual(
    f27.claim_definitions.filter((entry) => !f26.claim_definitions.some(
      (prior) => prior.claim_definition_key === entry.claim_definition_key,
    )).map((entry) => entry.claim_definition_key),
    ['MATERIAL_CONTRACT_BUCKET_PRESENT', 'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE'],
  );
  assert.equal(FIXTURE_CONTRACT_INPUT_V27.claim_definitions.length, FIXTURE_CONTRACT_INPUT_V26.claim_definitions.length + 2);
});

// ---------------------------------------------------------------------------
// 3. Superset-diff: V2 is a strict superset of V1 except the four additions.
// ---------------------------------------------------------------------------

test('FIXTURE_CONTRACT_INPUT_V2 concepts are exactly V1 plus the four Ben-approved additions', () => {
  const v1Keys = FIXTURE_CONTRACT_INPUT_V1.concepts.map((entry) => entry.concept_key).sort();
  const v2Keys = FIXTURE_CONTRACT_INPUT_V2.concepts.map((entry) => entry.concept_key).sort();
  const added = v2Keys.filter((key) => !v1Keys.includes(key));
  const removed = v1Keys.filter((key) => !v2Keys.includes(key));
  assert.deepEqual(added.sort(), [...APPROVED_V2_ADDITIONS].sort());
  assert.deepEqual(removed, []);
  // Every added entry has the frozen {concept_key, version: 1} shape.
  for (const key of APPROVED_V2_ADDITIONS) {
    const entry = FIXTURE_CONTRACT_INPUT_V2.concepts.find((row) => row.concept_key === key);
    assert.deepEqual(entry, { concept_key: key, version: 1 });
  }
});

test('the compiled F2 bundle is byte-identical to F1 in every field except concepts and fingerprint', () => {
  const f1 = compileFixtureContract();
  const f2 = compileFixtureContractV2();
  const withoutConceptsOrFingerprint = (bundle) => {
    const { concepts: _concepts, fingerprint: _fingerprint, ...rest } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(withoutConceptsOrFingerprint(f1)), canonicalJson(withoutConceptsOrFingerprint(f2)));
  assert.notEqual(canonicalJson(f1.concepts), canonicalJson(f2.concepts));
  assert.notEqual(f1.fingerprint, f2.fingerprint);
});

test('the compiled F2 bundle concepts are exactly F1\'s concepts plus the four approved additions (deep-diff)', () => {
  const f1 = compileFixtureContract();
  const f2 = compileFixtureContractV2();
  const f2WithoutAdditions = f2.concepts.filter(
    (entry) => !APPROVED_V2_ADDITIONS.includes(entry.concept_key),
  );
  assert.equal(canonicalJson(f2WithoutAdditions), canonicalJson(f1.concepts));
  const f2Additions = f2.concepts
    .filter((entry) => APPROVED_V2_ADDITIONS.includes(entry.concept_key))
    .map((entry) => entry.concept_key)
    .sort();
  assert.deepEqual(f2Additions, [...APPROVED_V2_ADDITIONS].sort());
});

test('F3 pins the approved buyer fee concept, claim, exact-detail action and legal-operation binding', () => {
  const f3 = compileFixtureContractV3();
  assert.equal(f3.fingerprint, FROZEN_F3);
  assert.equal(validateContractBundle(f3), true);
  assert.equal(
    canonicalJson(f3),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V3)),
  );
  assert.deepEqual(
    f3.concepts.filter((entry) => !compileFixtureContractV2().concepts.some(
      (prior) => prior.concept_key === entry.concept_key,
    )),
    [{ concept_key: 'TERMF-REVERSE', version: 1 }],
  );
  assert.deepEqual(
    f3.claim_definitions.filter((entry) => !compileFixtureContractV2().claim_definitions.some(
      (prior) => prior.claim_definition_key === entry.claim_definition_key,
    )),
    [{
      claim_definition_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }],
  );
  assert.deepEqual(
    f3.serving_exact_detail_action_definitions
      .filter((entry) => entry.action_slot_key === 'TERMINATION_FEE_TRIGGER_EVIDENCE')
      .map((entry) => entry.action_slot_key),
    ['TERMINATION_FEE_TRIGGER_EVIDENCE'],
  );
  assert.deepEqual(f3.serving_metric_operation_bindings, [{
    binding_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V1',
    metric_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-REVERSE',
    required_claim_definition_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    relationship_key: 'TRIGGERED_BY',
    legal_operation: 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
    fee_side: 'BUYER',
    payer: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
    payee: { role: 'FEE_PAYEE', value: 'COMPANY', capacity: 'TARGET' },
  }]);
  assert.equal(canonicalJson(fixtureContractForFingerprint(FROZEN_F3)), canonicalJson(f3));
});

test('F3 concept-only, claim-only and unbound hybrid contracts are rejected', () => {
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V2,
    concepts: FIXTURE_CONTRACT_INPUT_V3.concepts,
  }), /concept keys do not match any frozen fixture contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V2,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V3.claim_definitions,
  }), /concept keys do not match any frozen fixture contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V3,
    serving_metric_operation_bindings: undefined,
  }), /concept keys do not match any frozen fixture contract version/);
});

test('F4 replaces the flawed six-path action with a bounded typed two-sided graph', () => {
  const f4 = compileFixtureContractV4();
  assert.equal(f4.fingerprint, FROZEN_F4);
  assert.equal(validateContractBundle(f4), true);
  assert.equal(
    canonicalJson(f4),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V4)),
  );
  assert.equal(canonicalJson(f4.concepts), canonicalJson(compileFixtureContractV3().concepts));
  assert.equal(
    canonicalJson(f4.claim_definitions),
    canonicalJson(compileFixtureContractV3().claim_definitions),
  );
  const action = f4.serving_exact_detail_action_definitions.find(
    (entry) => entry.action_slot_key === 'TERMINATION_FEE_TRIGGER_EVIDENCE',
  );
  assert.equal(action.action_version, 2);
  assert.equal(action.selection_path_schema, 'RESULT_TERMINATION_FEE_TRIGGER_SET/V2');
  assert.equal(action.response_schema, 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2');
  assert.equal(action.maximum_encoded_bytes, 32768);
  assert.deepEqual(
    f4.serving_metric_operation_bindings.map((binding) => ({
      binding_key: binding.binding_key,
      fee_side: binding.fee_side,
      concept_key: binding.concept_key,
      trigger_path_schema_key: binding.trigger_path_schema_key,
      trigger_path_schema_version: binding.trigger_path_schema_version,
    })),
    [
      {
        binding_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
        fee_side: 'BUYER',
        concept_key: 'TERMF-REVERSE',
        trigger_path_schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
        trigger_path_schema_version: 2,
      },
      {
        binding_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
        fee_side: 'SELLER',
        concept_key: 'TERMF-TARGET',
        trigger_path_schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
        trigger_path_schema_version: 2,
      },
    ],
  );
  const [schema] = f4.serving_trigger_path_schema_definitions;
  assert.equal(schema.trigger_path_schema_key, 'TERMINATION_FEE_TRIGGER_PATH');
  assert.equal(schema.trigger_path_schema_version, 2);
  assert.equal(schema.maximum_paths, 16);
  assert.equal(schema.maximum_expression_depth, 6);
  assert.equal(schema.maximum_expression_nodes, 32);
  assert.deepEqual(schema.expression_operators, ['ALL_OF', 'ANY_OF', 'FACT', 'IF_THEN']);
  assert.equal(schema.indexed_fact_semantics, 'SET_MEMBERSHIP_SEARCH_AID_ONLY');
  assert.equal(canonicalJson(fixtureContractForFingerprint(FROZEN_F4)), canonicalJson(f4));
});

test('F4 cannot be assembled from F3 with only one side or without its typed schema', () => {
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V4,
    serving_metric_operation_bindings: [
      FIXTURE_CONTRACT_INPUT_V4.serving_metric_operation_bindings[0],
    ],
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V4,
    serving_trigger_path_schemas: undefined,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V4,
    serving_exact_detail_actions: FIXTURE_CONTRACT_INPUT_V3.serving_exact_detail_actions,
  }), /termination-fee exact-detail action/);
});

test('F5 adds only the mandatory money denominator precision policy and residual', () => {
  const f4 = compileFixtureContractV4();
  const f5 = compileFixtureContractV5();
  assert.equal(f5.fingerprint, FROZEN_F5);
  assert.equal(validateContractBundle(f5), true);
  assert.equal(
    canonicalJson(f5),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V5)),
  );
  const {
    fingerprint: _f4Fingerprint,
    residual_reason_codes: _f4Residuals,
    ...f4Stable
  } = f4;
  const {
    fingerprint: _f5Fingerprint,
    residual_reason_codes: _f5Residuals,
    money_denominator_precision_policy_definition: _f5Policy,
    ...f5Stable
  } = f5;
  assert.equal(canonicalJson(f5Stable), canonicalJson(f4Stable));
  assert.deepEqual(
    f5.residual_reason_codes,
    [...f4.residual_reason_codes, 'INVALID_DENOMINATOR_PRECISION'],
  );
  assert.deepEqual(f5.money_denominator_precision_policy_definition, {
    schema_version: 'MONEY_DENOMINATOR_PRECISION_POLICY/V1',
    value_kind: 'MONEY_RELATIVE_TO_DEAL_VALUE',
    required_claim_state: 'PRESENT',
    applicable_claim_definition_keys: [
      'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    ],
    authoritative_path: 'denominator.precision',
    allowed_precision_values: ['APPROXIMATE', 'EXACT'],
    compatibility_projection_path: 'attributes.denominator_precision',
    compatibility_projection_must_equal_authoritative: true,
  });
  assert.equal(canonicalJson(fixtureContractForFingerprint(FROZEN_F5)), canonicalJson(f5));
});

test('F5 precision policy and residual cannot be adopted independently or altered', () => {
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V5,
    money_denominator_precision_policy: undefined,
  }), /residual reason codes/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V5,
    residual_reason_codes: FIXTURE_CONTRACT_INPUT_V4.residual_reason_codes,
  }), /residual reason codes/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V5,
    money_denominator_precision_policy: {
      ...FIXTURE_CONTRACT_INPUT_V5.money_denominator_precision_policy,
      allowed_precision_values: ['EXACT'],
    },
  }), /contract version/);
});

test('F6 freezes the approved atomic no-shop actions and exact exception contract', () => {
  const f5 = compileFixtureContractV5();
  const f6 = compileFixtureContractV6();
  assert.equal(f6.fingerprint, FROZEN_F6);
  assert.equal(validateContractBundle(f6), true);
  assert.equal(
    canonicalJson(f6),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V6)),
  );
  const actionClaim = f6.claim_definitions.find(
    (entry) => entry.claim_definition_key === 'NO_SHOP_PROHIBITED_ACTION',
  );
  const prerequisiteClaim = f6.claim_definitions.find(
    (entry) => entry.claim_definition_key === 'NO_SHOP_EXCEPTION_PREREQUISITE',
  );
  assert.equal(actionClaim.version, 2);
  assert.deepEqual(actionClaim.allowed_canonical_values, NO_SHOP_ACTION_CODES_V2);
  assert.equal(prerequisiteClaim.version, 2);
  assert.deepEqual(
    prerequisiteClaim.allowed_canonical_values,
    NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
  );
  assert.equal(
    f6.relationship_definitions.find(
      (entry) => entry.relationship_key === 'EXCEPTED_BY',
    ).version,
    2,
  );
  assert.deepEqual(
    f6.relationship_definitions.filter(
      (entry) => entry.relationship_key !== 'EXCEPTED_BY',
    ),
    f5.relationship_definitions.filter(
      (entry) => entry.relationship_key !== 'EXCEPTED_BY',
    ),
  );
  const schemaFor = (key) => f6.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === key,
  );
  assert.equal(actionClaim.allowed_canonical_values.length, 23);
  assert.deepEqual(
    schemaFor('NO_SHOP_ACTION_COMPARISON_ROLLUP').rollups,
    NO_SHOP_ACTION_ROLLUP_SCHEMA_V1.rollups,
  );
  assert.deepEqual(
    schemaFor('NO_SHOP_ACTION_COMPARISON_ROLLUP').unrolled_action_codes,
    ['GRANT_DGCL_SECTION_203_WAIVER'],
  );
  const schema = schemaFor('NO_SHOP_EXCEPTION_EFFECT');
  assert.equal(schema.relationship_key, 'EXCEPTED_BY');
  assert.equal(schema.relationship_definition_version, 2);
  assert.equal(schema.maximum_shared_prerequisites, 8);
  assert.equal(schema.maximum_action_specific_prerequisites, 2);
  assert.deepEqual(
    schema.allowed_legal_operations.map((entry) => [
      entry.legal_operation,
      entry.affected_action_code,
      entry.required_action_specific_prerequisite_codes,
      entry.required_definition_relationship_key,
    ]),
    [
      [
        'PERMITS_FURNISH_NONPUBLIC_INFORMATION',
        'FURNISH_NONPUBLIC_INFORMATION',
        [
          'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED',
          'NONPUBLIC_INFORMATION_PREVIOUSLY_OR_SUBSTANTIALLY_SIMULTANEOUSLY_PROVIDED_TO_PROTECTED_PARTY',
        ],
        'USES_DEFINITION',
      ],
      [
        'PERMITS_ENGAGE_IN_DISCUSSIONS',
        'ENGAGE_IN_DISCUSSIONS',
        [],
        null,
      ],
      [
        'PERMITS_ENGAGE_IN_NEGOTIATIONS',
        'ENGAGE_IN_NEGOTIATIONS',
        [],
        null,
      ],
      [
        'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
        'PARTICIPATE_IN_DISCUSSIONS',
        [],
        null,
      ],
      [
        'PERMITS_PARTICIPATE_IN_NEGOTIATIONS',
        'PARTICIPATE_IN_NEGOTIATIONS',
        [],
        null,
      ],
    ],
  );
  assert.equal(
    schema.governed_notice_dependency,
    'COMPLETE_FIRST_SENTENCE_NOTICE_OBLIGATION',
  );
  assert.equal(schema.partial_notice_claim_cannot_close_dependency, true);
  const inlinePermission = schemaFor('NO_SHOP_INLINE_PERMISSION_EFFECT');
  assert.equal(
    inlinePermission.legal_operation,
    NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1.legal_operation,
  );
  assert.equal(
    inlinePermission.permitted_action_code,
    'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
  );
  assert.deepEqual(
    inlinePermission.forbidden_prerequisite_classes,
    ['PROPOSAL', 'CONFIDENTIALITY', 'INFORMATION_DELIVERY', 'NOTICE'],
  );
  const notice = schemaFor('NO_SHOP_NOTICE_OBLIGATION');
  assert.deepEqual(
    notice.allowed_trigger_codes,
    NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1.allowed_trigger_codes,
  );
  assert.equal(notice.required_completeness, 'COMPLETE');
  assert.equal(notice.maximum_evidence_excerpts, 32);
  assert.deepEqual(notice.required_trigger_codes, notice.allowed_trigger_codes);
  assert.deepEqual(
    notice.required_delivery_method_codes,
    notice.allowed_delivery_method_codes,
  );
  assert.deepEqual(
    notice.required_content_requirement_codes,
    notice.allowed_content_requirement_codes,
  );
  assert.deepEqual(
    notice.required_copy_subject_codes,
    notice.allowed_copy_subject_codes,
  );
  assert.deepEqual(
    notice.required_notice_timing_qualifier_codes,
    ['PROMPTLY', 'NO_LATER_THAN_24_ELAPSED_HOURS'],
  );
  assert.deepEqual(
    notice.required_copy_timing_qualifier_codes,
    ['PROMPTLY', 'NO_LATER_THAN_24_ELAPSED_HOURS'],
  );
  assert.equal(notice.minimum_copy_timing_claims, 1);
  assert.equal(
    canonicalJson(fixtureContractForFingerprint(FROZEN_F6)),
    canonicalJson(f6),
  );
});

test('F6 changes only the approved no-shop claims, relationship version and effect schema', () => {
  const f5 = compileFixtureContractV5();
  const f6 = compileFixtureContractV6();
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      claim_definitions: _claims,
      relationship_definitions: _relationships,
      no_shop_semantic_schema_definitions: _noShopSchemas,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f5)), canonicalJson(stable(f6)));
  assert.deepEqual(
    f6.claim_definitions.filter(
      (entry) => ![
        'NO_SHOP_PROHIBITED_ACTION',
        'NO_SHOP_EXCEPTION_PREREQUISITE',
      ].includes(entry.claim_definition_key),
    ),
    f5.claim_definitions.filter(
      (entry) => ![
        'NO_SHOP_PROHIBITED_ACTION',
        'NO_SHOP_EXCEPTION_PREREQUISITE',
      ].includes(entry.claim_definition_key),
    ),
  );
});

test('F6 refuses partial, legacy-version and co-mutated no-shop hybrids', () => {
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V5,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V6.claim_definitions,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V5.relationship_definitions,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    no_shop_semantic_schemas: undefined,
  }), /contract version/);
  const changedSchemas = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V6.no_shop_semantic_schemas,
  ));
  changedSchemas.find(
    (entry) => entry.schema_key === 'NO_SHOP_EXCEPTION_EFFECT',
  ).allowed_legal_operations[1]
    .required_action_specific_prerequisite_codes = [
      'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED',
    ];
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    no_shop_semantic_schemas: changedSchemas,
  }), /contract version/);
  const changedRollups = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V6.no_shop_semantic_schemas,
  ));
  changedRollups.find(
    (entry) => entry.schema_key === 'NO_SHOP_ACTION_COMPARISON_ROLLUP',
  ).rollups[1].required_qualifier_predicate = null;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    no_shop_semantic_schemas: changedRollups,
  }), /contract version/);
  const missingParticipateEffect = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V6.no_shop_semantic_schemas,
  ));
  const exceptionSchema = missingParticipateEffect.find(
    (entry) => entry.schema_key === 'NO_SHOP_EXCEPTION_EFFECT',
  );
  exceptionSchema.allowed_legal_operations = exceptionSchema.allowed_legal_operations.filter(
    (entry) => entry.legal_operation !== 'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
  );
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    no_shop_semantic_schemas: missingParticipateEffect,
  }), /contract version/);
  const incompleteNotice = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V6.no_shop_semantic_schemas,
  ));
  const noticeSchema = incompleteNotice.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  noticeSchema.required_trigger_codes.pop();
  noticeSchema.required_delivery_method_codes.pop();
  noticeSchema.required_content_requirement_codes.pop();
  noticeSchema.required_notice_timing_qualifier_codes.pop();
  noticeSchema.required_copy_timing_qualifier_codes.pop();
  noticeSchema.required_copy_subject_codes.pop();
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    no_shop_semantic_schemas: incompleteNotice,
  }), /contract version/);
  const changedRelationships = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V6.relationship_definitions,
  ));
  changedRelationships.find(
    (entry) => entry.relationship_key === 'EXCEPTED_BY',
  ).effect_mode = 'NON_SEMANTIC';
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V6,
    relationship_definitions: changedRelationships,
  }), /contract version/);
});

test('F7 freezes typed interpretation clarity without serving activation', () => {
  const f6 = compileFixtureContractV6();
  const f7 = compileFixtureContractV7();
  assert.equal(f7.fingerprint, FROZEN_F7);
  assert.equal(validateContractBundle(f7), true);
  assert.equal(
    canonicalJson(f7),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V7)),
  );
  assert.equal(
    f7.claim_interpretation_policy_definition,
    CLAIM_INTERPRETATION_POLICY_V1,
  );
  assert.deepEqual(
    f7.claim_interpretation_policy_definition.clarity_states.map(
      (entry) => [
        entry.clarity_state,
        entry.review_renderable,
        entry.canonical_claim_publishable,
        entry.default_metric_comparability,
      ],
    ),
    [
      ['CLEAR', true, true, 'ALLOWED_IF_OTHERWISE_COMPLETE'],
      [
        'REASONABLE_BUT_AMBIGUOUS',
        true,
        true,
        'BLOCKED_UNLESS_METRIC_EXPLICITLY_ACCEPTS',
      ],
      ['MULTIPLE_PLAUSIBLE_NO_PRIMARY', true, false, 'BLOCKED'],
    ],
  );
  assert.deepEqual(
    f7.claim_interpretation_policy_definition.comparability_effect_codes,
    [
      'AMBIGUITY_IMMATERIAL_TO_SELECTED_METRIC',
      'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
      'AMBIGUITY_EFFECT_UNRESOLVED',
    ],
  );
  assert.deepEqual(
    f7.claim_interpretation_policy_definition
      .default_metric_accepted_clarity_states,
    ['CLEAR'],
  );
  assert.deepEqual(
    f7.claim_interpretation_policy_definition
      .ambiguous_metric_admission_requires,
    [
      'metric_definition_id',
      'accepted_clarity_states',
      'accepted_ambiguity_dimension_codes',
      'comparability_effect_code',
    ],
  );
  assert.deepEqual(
    f7.claim_interpretation_policy_definition.projection_retention_fields,
    f7.claim_interpretation_policy_definition
      .cohort_denominator_and_cache_identity_fields,
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F7),
    false,
  );
  assert.equal(canonicalJson(fixtureContractForFingerprint(FROZEN_F7)), canonicalJson(f7));
  assert.equal(canonicalJson(compileFixtureContractV6()), canonicalJson(f6));
});

test('F7 notice V2 binds trigger expression and clock identities without inventing copy trigger', () => {
  const f7 = compileFixtureContractV7();
  const notice = f7.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  assert.equal(
    canonicalJson(NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V7.no_shop_semantic_schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    )),
  );
  assert.equal(notice.semantic_schema_version, 2);
  assert.equal(notice.record_schema, 'NO_SHOP_NOTICE_OBLIGATION/V2');
  assert.deepEqual(notice.trigger_expression_contract.allowed_operators, ['ANY_OF']);
  assert.equal(
    notice.trigger_expression_contract.required_operand_sufficiency_code,
    'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
  );
  assert.equal(
    notice.initial_notice_clock_scope_contract.required_application_scope_code,
    'EACH_SATISFYING_TRIGGER_OCCURRENCE',
  );
  assert.equal(
    notice.initial_notice_clock_scope_contract
      .required_qualifier_combination_operator,
    'ALL_OF',
  );
  assert.equal(
    notice.initial_notice_clock_scope_contract.required_temporal_operator,
    'CEILING',
  );
  assert.equal(
    notice.trigger_expression_contract.canonical_operand_set_derivation,
    'SORTED_UNIQUE_TRIGGER_CODE_ASCENDING',
  );
  assert.equal(
    notice.initial_notice_clock_scope_contract.required_fields
      .includes('clock_scope_id'),
    true,
  );
  assert.equal(
    notice.copy_clock_scope_contract.required_fields.includes('clock_scope_id'),
    true,
  );
  assert.equal(
    notice.copy_clock_scope_contract
      .allowed_primary_receipt_interpretation_codes[0],
    'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
  );
  assert.equal(
    notice.copy_clock_scope_contract
      .required_referent_interpretation_clarity_state,
    'REASONABLE_BUT_AMBIGUOUS',
  );
  assert.deepEqual(
    notice.copy_clock_scope_contract.required_ambiguity_dimension_codes,
    ['REFERENT', 'SCOPE', 'CARDINALITY'],
  );
  assert.equal(
    notice.copy_clock_scope_contract.required_comparability_effect_code,
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  assert.equal(
    notice.copy_clock_scope_contract
      .required_primary_interpretation_subject_code,
    'ITEM_REQUIRED_TO_BE_COPIED',
  );
  assert.deepEqual(
    notice.copy_clock_scope_contract.allowed_item_or_batch_cardinality_states,
    ['UNRESOLVED'],
  );
  assert.equal(
    notice.copy_clock_scope_contract.required_resolution_state,
    'BLOCKING_UNRESOLVED',
  );
  assert.equal(
    notice.copy_clock_scope_contract.interpretation_payload_binding
      .payload_schema,
    'NOTICE_CLOCK_INTERPRETATION/V1',
  );
  assert.equal(
    notice.copy_clock_scope_contract.interpretation_payload_binding
      .payload_is_sole_clarity_authority,
    true,
  );
  assert.equal(
    notice.copy_clock_scope_contract.canonical_trigger_code_forbidden,
    true,
  );
  assert.deepEqual(
    notice.copy_clock_scope_contract
      .ambiguity_dimensions_requiring_explicit_clarity_or_flag,
    ['REFERENT', 'SCOPE', 'CARDINALITY'],
  );
  assert.equal(
    notice.independently_mutable_overall_resolution_forbidden,
    true,
  );
  assert.equal(notice.minimum_notice_timing_claims, 1);
  assert.equal(notice.maximum_notice_timing_claims, 1);
  assert.equal(notice.minimum_copy_timing_claims, 1);
  assert.equal(notice.maximum_copy_timing_claims, 1);
  assert.equal(notice.required_completeness, null);
  assert.equal(notice.legacy_completeness_field_forbidden, true);
  assert.deepEqual(
    notice.child_resolution_state_contract.worst_state_order,
    [
      'RESOLVED_CLEAR',
      'RESOLVED_WITH_REVIEW_NOTE',
      'BLOCKING_UNRESOLVED',
    ],
  );
});

test('F7 USES_DEFINITION V2 is exact-use scoped and plural-safe', () => {
  const f6 = compileFixtureContractV6();
  const f7 = compileFixtureContractV7();
  const relationship = f7.relationship_definitions.find(
    (entry) => entry.relationship_key === 'USES_DEFINITION',
  );
  assert.deepEqual(relationship, {
    relationship_key: 'USES_DEFINITION',
    effect_mode: 'TYPED_LEGAL_EFFECT',
    version: 2,
    effect_schema: 'USES_DEFINITION_EFFECT/V1',
  });
  assert.equal(
    f7.definition_use_effect_schema_definition,
    USES_DEFINITION_EFFECT_SCHEMA_V1,
  );
  assert.equal(
    f7.definition_use_effect_schema_definition.propagation,
    'EXACT_NAMED_TARGET_ONLY',
  );
  assert.equal(f7.definition_use_effect_schema_definition.party_transfer, 'NONE');
  assert.equal(f7.definition_use_effect_schema_definition.alias_authority, 'NONE');
  assert.deepEqual(
    f7.definition_use_effect_schema_definition.allowed_legal_role_codes,
    [
      'OPERATIVE_TRIGGER',
      'OPERATIVE_OBLIGATION_OBJECT',
      'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
      'NESTED_DEFINITION_DEPENDENCY',
    ],
  );
  assert.deepEqual(
    f7.definition_use_effect_schema_definition.allowed_use_form_codes,
    [
      'EXACT_DECLARED_TERM',
      'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
    ],
  );
  assert.equal(
    f7.definition_use_effect_schema_definition.plural_normalisation_rule
      .scope,
    'THIS_SOURCE_USE_ONLY',
  );
  assert.equal(
    f7.definition_use_effect_schema_definition.plural_normalisation_rule
      .alias_authority,
    'NONE',
  );
  assert.deepEqual(
    f7.definition_use_effect_schema_definition.evidence_role_contract
      .required_roles,
    ['EXACT_USE', 'DEFINITION_DECLARATION', 'DEFINITION_BODY'],
  );
  assert.equal(
    f7.definition_use_effect_schema_definition
      .relationship_interpretation_payload_contract.schema_version,
    'RELATIONSHIP_INTERPRETATION/V1',
  );
  assert.deepEqual(
    f7.definition_use_effect_schema_definition.required_exact_values,
    {
      legal_operation: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
      effect_schema_version: 1,
      propagation: 'EXACT_NAMED_TARGET_ONLY',
      party_transfer: 'NONE',
      alias_authority: 'NONE',
    },
  );
  assert.deepEqual(
    f7.definition_use_effect_schema_definition.affected_endpoint_contract
      .allowed_endpoint_fields,
    [
      {
        endpoint_kind: 'NOTICE_OBLIGATION_REVISION',
        affected_field_keys: [
          'trigger_expression',
          'copy_subject_codes',
          'content_requirement_codes',
        ],
      },
      {
        endpoint_kind: 'DEFINITION_OCCURRENCE',
        affected_field_keys: ['nested_definition_dependency'],
      },
    ],
  );
  assert.equal(
    f7.definition_use_effect_schema_definition
      .unresolved_definition_precedence_blocks_relationship_effect_publication,
    true,
  );
  assert.deepEqual(
    f7.definition_use_effect_schema_definition.party_scope_contract,
    {
      required_fields: [
        'source_party_context_id',
        'affected_endpoint_party_context',
        'definition_party_context',
      ],
      affected_endpoint_party_context_required: true,
      affected_endpoint_party_context_contract: {
        schema_version: 'PARTY_TUPLE/V1',
        required_fields: ['role', 'value', 'capacity'],
        exact_fields_only: true,
      },
      definition_party_context_contract: {
        discriminator_field: 'applicability_state',
        variants: [
          {
            applicability_state: 'APPLICABLE',
            required_fields: ['applicability_state', 'party'],
            party_contract: 'PARTY_TUPLE/V1',
          },
          {
            applicability_state: 'NOT_APPLICABLE',
            required_fields: ['applicability_state'],
            forbidden_fields: ['party'],
          },
        ],
        null_string_and_untyped_object_encodings_forbidden: true,
      },
      party_inference_from_use_forbidden: true,
      party_inference_from_definition_forbidden: true,
      party_transfer_requires_separate_relationship: true,
    },
  );
  assert.deepEqual(
    f7.relationship_definitions.filter(
      (entry) => entry.relationship_key !== 'USES_DEFINITION',
    ),
    f6.relationship_definitions.filter(
      (entry) => entry.relationship_key !== 'USES_DEFINITION',
    ),
  );
});

test('F7 refuses interpretation, notice and definition-effect hybrids', () => {
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    claim_interpretation_policy: undefined,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    definition_use_effect_schema: undefined,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    no_shop_semantic_schemas: FIXTURE_CONTRACT_INPUT_V6.no_shop_semantic_schemas,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V6.relationship_definitions,
  }), /contract version/);
  const widenedPluralRule = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.definition_use_effect_schema,
  ));
  widenedPluralRule.allowed_use_form_codes.push('IRREGULAR_PLURAL');
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    definition_use_effect_schema: widenedPluralRule,
  }), /contract version/);
  const unsafeAmbiguity = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.claim_interpretation_policy,
  ));
  unsafeAmbiguity.default_metric_accepted_clarity_states.push(
    'REASONABLE_BUT_AMBIGUOUS',
  );
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    claim_interpretation_policy: unsafeAmbiguity,
  }), /contract version/);
  const incompleteProjection = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.claim_interpretation_policy,
  ));
  incompleteProjection.projection_retention_fields =
    incompleteProjection.projection_retention_fields.filter(
      (field) => field !== 'interpretation_payload_id',
    );
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    claim_interpretation_policy: incompleteProjection,
  }), /contract version/);
  const broadEndpoint = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.definition_use_effect_schema,
  ));
  broadEndpoint.affected_endpoint_contract.allowed_endpoint_fields.push({
    endpoint_kind: 'PROVISION_RESULT_REVISION',
    affected_field_keys: ['result'],
  });
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    definition_use_effect_schema: broadEndpoint,
  }), /contract version/);
  const staleClockCardinality = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.no_shop_semantic_schemas,
  ));
  staleClockCardinality.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).maximum_copy_timing_claims = 4;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    no_shop_semantic_schemas: staleClockCardinality,
  }), /contract version/);
  const inventedCopyTrigger = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.no_shop_semantic_schemas,
  ));
  inventedCopyTrigger.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).copy_clock_scope_contract.canonical_trigger_code_forbidden = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    no_shop_semantic_schemas: inventedCopyTrigger,
  }), /contract version/);
  const ambiguousPartyEncoding = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.definition_use_effect_schema,
  ));
  ambiguousPartyEncoding.party_scope_contract
    .definition_party_context_contract
    .null_string_and_untyped_object_encodings_forbidden = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    definition_use_effect_schema: ambiguousPartyEncoding,
  }), /contract version/);
  const detachedInterpretation = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V7.no_shop_semantic_schemas,
  ));
  detachedInterpretation.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).copy_clock_scope_contract.interpretation_payload_binding
    .payload_is_sole_clarity_authority = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V7,
    no_shop_semantic_schemas: detachedInterpretation,
  }), /contract version/);
});

test('F8 freezes stable occurrence identities and removes the notice revision endpoint cycle', () => {
  const f7 = compileFixtureContractV7();
  const f8 = compileFixtureContractV8();
  assert.equal(f8.fingerprint, FROZEN_F8);
  assert.equal(validateContractBundle(f8), true);
  assert.equal(
    canonicalJson(f8),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V8)),
  );
  assert.equal(
    canonicalJson(NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V8.no_shop_semantic_schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    )),
  );
  assert.equal(
    f8.definition_use_effect_schema_definition,
    USES_DEFINITION_EFFECT_SCHEMA_V2,
  );
  assert.deepEqual(
    f8.relationship_definitions.find(
      (entry) => entry.relationship_key === 'USES_DEFINITION',
    ),
    {
      relationship_key: 'USES_DEFINITION',
      effect_mode: 'TYPED_LEGAL_EFFECT',
      version: 3,
      effect_schema: 'USES_DEFINITION_EFFECT/V2',
    },
  );
  assert.deepEqual(
    f8.definition_use_effect_schema_definition.affected_endpoint_contract
      .allowed_endpoint_fields,
    [
      {
        endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
        affected_field_keys: [
          'trigger_expression',
          'copy_subject_codes',
          'content_requirement_codes',
        ],
      },
      {
        endpoint_kind: 'DEFINITION_OCCURRENCE',
        affected_field_keys: ['nested_definition_dependency'],
      },
    ],
  );
  assert.equal(
    f8.definition_use_effect_schema_definition.notice_revision_endpoint_forbidden,
    true,
  );
  assert.equal(
    f8.definition_use_effect_schema_definition
      .notice_relationship_endpoint_must_be_stable_occurrence,
    true,
  );
  assert.equal(
    f8.definition_use_effect_schema_definition.required_exact_values
      .effect_schema_version,
    2,
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F8),
    false,
  );
  assert.equal(canonicalJson(fixtureContractForFingerprint(FROZEN_F8)), canonicalJson(f8));
  assert.equal(canonicalJson(compileFixtureContractV7()), canonicalJson(f7));
});

test('F8 identities anchor source occurrences without semantic or selected-target leakage', () => {
  const f8 = compileFixtureContractV8();
  const notice = f8.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  assert.equal(notice.semantic_schema_version, 3);
  assert.equal(notice.record_schema, 'NO_SHOP_NOTICE_OBLIGATION/V3');
  assert.deepEqual(
    notice.notice_occurrence_identity_contract.identity_inputs,
    [
      'document_hash',
      'exact_source_span',
      'concept_key',
      'party',
      'governed_ordinal',
      'source_provision_instance_id',
    ],
  );
  assert.equal(
    notice.notice_occurrence_identity_contract.revision_content_forbidden_from_identity,
    true,
  );
  assert.equal(
    notice.notice_occurrence_identity_contract
      .relationship_occurrence_ids_forbidden_from_identity,
    true,
  );
  assert.deepEqual(
    notice.notice_revision_identity_contract.identity_inputs,
    notice.required_fields.filter(
      (field) => field !== 'notice_obligation_revision_id',
    ),
  );
  assert.equal(
    notice.notice_revision_identity_contract
      .relationship_endpoints_must_target_notice_occurrence,
    true,
  );

  const identities = f8.definition_use_effect_schema_definition.identity_contracts;
  assert.deepEqual(
    identities.definition_occurrence.identity_inputs,
    [
      'document_hash',
      'exact_declaration_span',
      'ordered_body_spans',
      'neutral_definition_key',
      'governed_ordinal',
    ],
  );
  assert.equal(
    identities.definition_occurrence
      .neutral_definition_key_must_not_be_canonical_concept_key,
    true,
  );
  assert.deepEqual(
    identities.exact_use_occurrence.identity_inputs,
    [
      'document_hash',
      'exact_use_span',
      'raw_use_form',
      'governed_ordinal',
    ],
  );
  assert.equal(
    identities.exact_use_occurrence
      .selected_definition_occurrence_id_forbidden_from_identity,
    true,
  );
  assert.equal(
    identities.exact_use_occurrence.legal_role_code_forbidden_from_identity,
    true,
  );
  assert.deepEqual(
    identities.source_party_context.identity_inputs,
    ['document_hash', 'source_scope_id', 'party', 'evidence_excerpt_ids'],
  );
  assert.equal(identities.source_party_context.party_inference_forbidden, true);
  assert.equal(identities.source_party_context.party_transfer_forbidden, true);
});

test('F8 changes only occurrence identity contracts and the corrected definition endpoint', () => {
  const f7 = compileFixtureContractV7();
  const f8 = compileFixtureContractV8();
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      relationship_definitions: _relationships,
      no_shop_semantic_schema_definitions: _noShopSchemas,
      definition_use_effect_schema_definition: _definitionEffect,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f8)), canonicalJson(stable(f7)));
  assert.deepEqual(
    f8.relationship_definitions.filter(
      (entry) => entry.relationship_key !== 'USES_DEFINITION',
    ),
    f7.relationship_definitions.filter(
      (entry) => entry.relationship_key !== 'USES_DEFINITION',
    ),
  );
  assert.deepEqual(
    f8.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
    f7.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
  );
});

test('F8 refuses partial endpoint, identity and version hybrids', () => {
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V8,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V7.relationship_definitions,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V8,
    no_shop_semantic_schemas: FIXTURE_CONTRACT_INPUT_V7.no_shop_semantic_schemas,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V8,
    definition_use_effect_schema: FIXTURE_CONTRACT_INPUT_V7.definition_use_effect_schema,
  }), /contract version/);

  const revisionEndpoint = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V8.definition_use_effect_schema,
  ));
  revisionEndpoint.affected_endpoint_contract.allowed_endpoint_fields[0]
    .endpoint_kind = 'NOTICE_OBLIGATION_REVISION';
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V8,
    definition_use_effect_schema: revisionEndpoint,
  }), /contract version/);

  const selectedTargetIdentity = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V8.definition_use_effect_schema,
  ));
  selectedTargetIdentity.identity_contracts.exact_use_occurrence.identity_inputs
    .push('selected_definition_occurrence_id');
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V8,
    definition_use_effect_schema: selectedTargetIdentity,
  }), /contract version/);

  const cyclicNoticeIdentity = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V8.no_shop_semantic_schemas,
  ));
  cyclicNoticeIdentity.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).notice_occurrence_identity_contract.identity_inputs
    .push('definition_use_relationship_ids');
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V8,
    no_shop_semantic_schemas: cyclicNoticeIdentity,
  }), /contract version/);
});

test('F9 corrects the QXO copy-clock primary reading and retains the ambiguity flag', () => {
  const f8 = compileFixtureContractV8();
  const f9 = compileFixtureContractV9();
  assert.equal(f9.fingerprint, FROZEN_F9);
  assert.equal(validateContractBundle(f9), true);
  assert.equal(
    canonicalJson(f9),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V9)),
  );
  assert.equal(
    canonicalJson(NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V9.no_shop_semantic_schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    )),
  );
  const notice = f9.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  assert.equal(notice.semantic_schema_version, 4);
  assert.equal(notice.record_schema, 'NO_SHOP_NOTICE_OBLIGATION/V4');
  assert.equal(
    notice.copy_clock_scope_contract
      .required_primary_receipt_interpretation_code,
    'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
  );
  assert.equal(
    notice.copy_clock_scope_contract
      .required_primary_interpretation_subject_code,
    'PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
  );
  assert.deepEqual(
    notice.copy_clock_scope_contract
      .required_alternative_receipt_interpretation_codes,
    ['RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED'],
  );
  assert.equal(
    notice.copy_clock_scope_contract.lawyer_ambiguity_flag_required,
    true,
  );
  assert.deepEqual(
    notice.copy_clock_scope_contract.required_ambiguity_dimension_codes,
    ['REFERENT', 'SCOPE', 'CARDINALITY'],
  );
  assert.equal(
    notice.copy_clock_scope_contract.required_comparability_effect_code,
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  assert.equal(
    notice.notice_revision_identity_contract.content_address_domain,
    'NO_SHOP_NOTICE_OBLIGATION/V4',
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F9),
    false,
  );
  assert.equal(
    canonicalJson(fixtureContractForFingerprint(FROZEN_F9)),
    canonicalJson(f9),
  );
  assert.equal(canonicalJson(compileFixtureContractV8()), canonicalJson(f8));
});

test('F9 changes only the notice receipt interpretation contract', () => {
  const f8 = compileFixtureContractV8();
  const f9 = compileFixtureContractV9();
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      no_shop_semantic_schema_definitions: _noShopSchemas,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f9)), canonicalJson(stable(f8)));
  assert.deepEqual(
    f9.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
    f8.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
  );
});

test('F9 refuses reversed, unflagged and co-mutated hybrids', () => {
  const reversed = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V9.no_shop_semantic_schemas,
  ));
  const reversedClock = reversed.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).copy_clock_scope_contract;
  reversedClock.required_primary_receipt_interpretation_code =
    'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED';
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V9,
    no_shop_semantic_schemas: reversed,
  }), /contract version/);

  const unflagged = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V9.no_shop_semantic_schemas,
  ));
  unflagged.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).copy_clock_scope_contract.lawyer_ambiguity_flag_required = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V9,
    no_shop_semantic_schemas: unflagged,
  }), /contract version/);

  const coMutated = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V9.definition_use_effect_schema,
  ));
  coMutated.notice_revision_endpoint_forbidden = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V9,
    definition_use_effect_schema: coMutated,
  }), /contract version/);
});

test('F10 freezes a bounded fixed-point definition-scope closure contract', () => {
  const f9 = compileFixtureContractV9();
  const f10 = compileFixtureContractV10();
  assert.equal(f10.fingerprint, FROZEN_F10);
  assert.equal(validateContractBundle(f10), true);
  assert.equal(
    canonicalJson(f10),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V10)),
  );
  assert.equal(
    canonicalJson(NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    )),
  );
  const notice = f10.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  assert.equal(notice.semantic_schema_version, 5);
  assert.equal(notice.record_schema, 'NO_SHOP_NOTICE_OBLIGATION/V5');
  assert.equal(notice.maximum_definition_use_relationships, 64);
  assert.deepEqual(
    notice.definition_scope_closure_contract,
    NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .inventory_contract.longest_match_required,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .inventory_contract.catalogue_blind_capitalised_and_quoted_candidate_scan_required,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .transitive_closure_contract.fixed_point_required,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .reviewed_terminal_outcome_contract.market_cohort_admission_forbidden,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .reviewed_terminal_outcome_contract.review_projection_required,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .reviewed_terminal_outcome_contract
      .compare_and_corpus_context_must_render_non_comparable_reason,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .blocking_unresolved_outcome_contract
      .silent_count_only_encoding_forbidden,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .blocking_unresolved_outcome_contract.required_fields.includes(
        'blocking_unresolved_outcome_id',
      ),
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .blocking_unresolved_outcome_contract.identity_inputs.includes(
        'evidence_excerpt_ids',
      ),
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .root_token_outcome_contract.disposition_target_contract
      .disposition_code_and_target_kind_must_correspond_exactly,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract.required_fields.includes(
      'blocking_unresolved_outcome_ids',
    ),
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .governance_body_designation_contract
      .uses_definition_relationship_forbidden,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .governance_body_designation_contract.party_substitution_forbidden,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .terminalisation_precedence_contract
      .known_substantive_definition_bypass_forbidden,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .transitive_closure_contract
      .source_local_plural_self_reference_resolves_lexically_without_edge,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .transitive_closure_contract.relationship_cycles_forbidden,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .outcome_set_contract.unresolved_outcome_count_derivation,
    'CARDINALITY_OF_BLOCKING_UNRESOLVED_OUTCOME_IDS',
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .outcome_set_contract.party_and_reviewed_terminal_sets_disjoint,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .outcome_set_contract
      .definition_occurrence_ids_equal_complete_reached_definition_node_set,
    true,
  );
  assert.equal(
    notice.definition_scope_closure_contract
      .outcome_set_contract
      .topological_definition_occurrence_ids_exact_permutation_of_definition_occurrence_ids,
    true,
  );
  assert.deepEqual(
    notice.definition_scope_closure_contract.authority_contract,
    {
      absence_authority: 'NONE',
      canonical_write_authority: 'NONE',
      publication_authority: 'NONE',
      relationship_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
    },
  );
  assert.equal(
    notice.definition_child_resolution_contract
      .definition_uses_state_derivation.RESOLVED_WITH_REVIEW_NOTE,
    'FORBIDDEN',
  );
  assert.equal(
    notice.definition_child_resolution_contract
      .definition_dependency_state_derivation.states_must_be_mutually_exclusive_and_exhaustive,
    true,
  );
  assert.deepEqual(
    notice.definition_scope_closure_contract
      .reviewed_terminal_disposition_codes.slice(-2),
    [
      'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE',
      'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE',
    ],
  );
  assert.equal(
    notice.notice_revision_identity_contract.content_address_domain,
    'NO_SHOP_NOTICE_OBLIGATION/V5',
  );
  assert.equal(
    notice.notice_revision_identity_contract.identity_inputs.includes(
      'definition_scope_closure_id',
    ),
    true,
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F10),
    false,
  );
  assert.equal(
    canonicalJson(fixtureContractForFingerprint(FROZEN_F10)),
    canonicalJson(f10),
  );
  assert.equal(canonicalJson(compileFixtureContractV9()), canonicalJson(f9));
});

test('F10 changes only the notice definition-scope contract', () => {
  const f9 = compileFixtureContractV9();
  const f10 = compileFixtureContractV10();
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      no_shop_semantic_schema_definitions: _noShopSchemas,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f10)), canonicalJson(stable(f9)));
  assert.deepEqual(
    f10.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
    f9.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
  );
});

test('F10 refuses opaque, unbounded and silently lossy closure hybrids', () => {
  const opaque = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  delete opaque.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.inventory_contract
    .catalogue_blind_capitalised_and_quoted_candidate_scan_required;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: opaque,
  }), /contract version/);

  const unbounded = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  unbounded.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.bounds
    .maximum_definition_use_relationships = Number.MAX_SAFE_INTEGER;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: unbounded,
  }), /contract version/);

  const lossy = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  lossy.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.inventory_contract
    .silent_skip_forbidden = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: lossy,
  }), /contract version/);

  const countOnly = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  countOnly.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.required_fields =
    countOnly.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    ).definition_scope_closure_contract.required_fields.filter(
      (field) => field !== 'blocking_unresolved_outcome_ids',
    );
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: countOnly,
  }), /contract version/);

  const cycle = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  cycle.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.transitive_closure_contract
    .relationship_cycles_forbidden = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: cycle,
  }), /contract version/);

  const authorityLeak = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  authorityLeak.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.authority_contract
    .serving_authority = 'ALLOWED';
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: authorityLeak,
  }), /contract version/);

  const contradictoryTarget = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  contradictoryTarget.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.root_token_outcome_contract
    .disposition_target_contract.target_kind_by_disposition_code
    .USES_DEFINITION = 'PARTY_CONTEXT';
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: contradictoryTarget,
  }), /contract version/);

  const incompleteGraph = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  incompleteGraph.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_scope_closure_contract.outcome_set_contract
    .definition_occurrence_ids_equal_complete_reached_definition_node_set = false;
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: incompleteGraph,
  }), /contract version/);

  const overlappingDependencyStates = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V10.no_shop_semantic_schemas,
  ));
  overlappingDependencyStates.find(
    (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  ).definition_child_resolution_contract.definition_dependency_state_derivation
    .RESOLVED_CLEAR =
      'ALL_REQUIRED_DEPENDENCY_RELATIONSHIPS_VALID_ACYCLIC_AND_UNSUPPRESSED';
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V10,
    no_shop_semantic_schemas: overlappingDependencyStates,
  }), /contract version/);
});

test('F11 separates the selected primary copy clock from the unresolved alternative', () => {
  const f10 = compileFixtureContractV10();
  const f11 = compileFixtureContractV11();
  assert.equal(f11.fingerprint, FROZEN_F11);
  assert.equal(validateContractBundle(f11), true);
  assert.equal(
    canonicalJson(f11),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V11)),
  );
  assert.equal(
    canonicalJson(NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V6),
    canonicalJson(FIXTURE_CONTRACT_INPUT_V11.no_shop_semantic_schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    )),
  );
  const notice = f11.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  const clock = notice.copy_clock_scope_contract;
  assert.equal(notice.semantic_schema_version, 6);
  assert.equal(notice.record_schema, 'NO_SHOP_NOTICE_OBLIGATION/V6');
  assert.equal(clock.record_schema, 'NOTICE_COPY_CLOCK_SCOPE/V2');
  assert.equal(
    clock.interpretation_payload_binding.payload_schema,
    'NOTICE_CLOCK_INTERPRETATION/V2',
  );
  assert.equal(
    clock.required_primary_receipt_interpretation_code,
    'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
  );
  assert.equal(
    clock.required_primary_clock_application_scope_code,
    'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE',
  );
  assert.equal(
    clock.required_primary_item_or_batch_cardinality_state,
    'NOT_APPLICABLE',
  );
  assert.equal(
    clock.required_alternative_clock_application_scope_state,
    'UNRESOLVED_ITEM_OR_BATCH',
  );
  assert.equal(
    clock.required_alternative_item_or_batch_cardinality_state,
    'UNRESOLVED',
  );
  assert.equal(
    clock.required_cardinality_ambiguity_scope_code,
    'ALTERNATIVE_ITEM_RECEIPT_INTERPRETATION_ONLY',
  );
  assert.equal(
    clock.required_comparability_state,
    'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG',
  );
  assert.equal(clock.required_resolution_state, 'RESOLVED_WITH_REVIEW_NOTE');
  assert.equal(
    clock.required_fields.includes('item_or_batch_cardinality_state'),
    false,
  );
  assert.equal(clock.legacy_combined_item_or_batch_cardinality_state_forbidden, true);
  assert.deepEqual(clock.primary_metric_contract, {
    metric_role: 'COPY_DEADLINE_FROM_PROPOSAL_OR_REQUEST_RECEIPT',
    normalisation_schema: 'OBSERVATION_NORMALISATION/V1',
    value_kind: 'DURATION',
    required_raw_magnitude: '24',
    required_raw_unit: 'HOURS',
    required_canonical_value: '1',
    required_canonical_unit: 'DAYS',
    required_day_basis: 'ELAPSED',
    required_basis_key:
      'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
    required_trigger: 'PROPOSAL_OR_REQUEST_RECEIPT',
    required_derivation_version: 'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
    normalisation_payload_digest_required: true,
    source_timing_claim_revision_id_required: true,
    source_normalisation_payload_digest_required: true,
    cohort_requires_same_metric_role: true,
    cohort_requires_same_basis_key: true,
    item_receipt_clock_cohort_mix_forbidden: true,
    generic_notice_period_label_forbidden: true,
    promptly_qualifier_preservation_required: true,
  });
  assert.equal(
    notice.notice_revision_identity_contract.content_address_domain,
    'NO_SHOP_NOTICE_OBLIGATION/V6',
  );
  assert.deepEqual(
    notice.definition_scope_closure_contract,
    NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
  );
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F11),
    false,
  );
  assert.equal(
    canonicalJson(fixtureContractForFingerprint(FROZEN_F11)),
    canonicalJson(f11),
  );
  assert.equal(canonicalJson(compileFixtureContractV10()), canonicalJson(f10));
});

test('F11 changes only the versioned notice copy-clock and revision contract', () => {
  const f10 = compileFixtureContractV10();
  const f11 = compileFixtureContractV11();
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      no_shop_semantic_schema_definitions: _noShopSchemas,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f11)), canonicalJson(stable(f10)));
  assert.deepEqual(
    f11.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
    f10.no_shop_semantic_schema_definitions.filter(
      (entry) => entry.semantic_schema_key !== 'NO_SHOP_NOTICE_OBLIGATION',
    ),
  );
  const notice10 = f10.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  const notice11 = f11.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  assert.deepEqual(
    notice11.definition_scope_closure_contract,
    notice10.definition_scope_closure_contract,
  );
  assert.deepEqual(
    notice11.definition_child_resolution_contract,
    notice10.definition_child_resolution_contract,
  );
  assert.deepEqual(notice11.required_fields, notice10.required_fields);
});

test('F11 refuses lossy copy-clock hybrids and silent ambiguity removal', () => {
  const mutateClock = (mutation) => {
    const schemas = JSON.parse(JSON.stringify(
      FIXTURE_CONTRACT_INPUT_V11.no_shop_semantic_schemas,
    ));
    const notice = schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    );
    mutation(notice.copy_clock_scope_contract, notice);
    return schemas;
  };
  const reject = (mutation) => assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V11,
    no_shop_semantic_schemas: mutateClock(mutation),
  }), /contract version/);

  reject((clock) => {
    clock.record_schema = 'NOTICE_COPY_CLOCK_SCOPE/V1';
  });
  reject((clock) => {
    clock.interpretation_payload_binding.payload_schema =
      'NOTICE_CLOCK_INTERPRETATION/V1';
  });
  reject((clock) => {
    clock.required_primary_interpretation_subject_code =
      'ITEM_REQUIRED_TO_BE_COPIED';
  });
  reject((clock) => {
    clock.required_primary_item_or_batch_cardinality_state = 'UNRESOLVED';
  });
  reject((clock) => {
    delete clock.required_alternative_item_or_batch_cardinality_state;
  });
  reject((clock) => {
    clock.required_alternative_item_or_batch_cardinality_state = 'RESOLVED';
  });
  reject((clock) => {
    clock.required_cardinality_ambiguity_scope_code = 'NONE';
  });
  reject((clock) => {
    clock.lawyer_ambiguity_flag_required = false;
  });
  reject((clock) => {
    clock.required_resolution_state = 'RESOLVED_CLEAR';
  });
  reject((_clock, notice) => {
    notice.notice_revision_identity_contract.content_address_domain =
      'NO_SHOP_NOTICE_OBLIGATION/V5';
  });
});

test('F11 defines semantic comparison but grants no serving authority', () => {
  const f11 = compileFixtureContractV11();
  const notice = f11.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  assert.equal(
    notice.copy_clock_scope_contract.required_comparability_effect_code,
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  assert.equal(
    notice.copy_clock_scope_contract.ambiguity_presentation_contract
      .ambiguity_flag_required_in_every_review_compare_and_query_result,
    true,
  );
  assert.equal(
    notice.copy_clock_scope_contract.ambiguity_presentation_contract
      .alternative_interpretation_required_in_every_review_compare_and_query_result,
    true,
  );
  assert.equal(FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F11), false);
});

test('F12 adds the distinct copy-delivery claim and interpretation admission', () => {
  const f11 = compileFixtureContractV11();
  const f12 = compileFixtureContractV12();
  assert.equal(f12.fingerprint, FROZEN_F12);
  assert.equal(
    canonicalJson(f12),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V12)),
  );
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      claim_definitions: _claimDefinitions,
      claim_interpretation_policy_definition: _interpretationPolicy,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f12)), canonicalJson(stable(f11)));
  const added = f12.claim_definitions.filter(
    (definition) => !f11.claim_definitions.some(
      (prior) => prior.claim_definition_key
        === definition.claim_definition_key,
    ),
  );
  assert.deepEqual(added, [{
    claim_definition_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  }]);
  assert.deepEqual(
    f12.claim_interpretation_policy_definition,
    CLAIM_INTERPRETATION_POLICY_V2,
  );
  assert.deepEqual(
    f11.claim_interpretation_policy_definition,
    CLAIM_INTERPRETATION_POLICY_V1,
  );
  assert.deepEqual(
    f12.claim_interpretation_policy_definition
      .metric_specific_ambiguous_admissions,
    [{
      metric_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
      metric_version: 1,
      accepted_clarity_states: ['CLEAR', 'REASONABLE_BUT_AMBIGUOUS'],
      accepted_ambiguity_dimension_codes: [
        'REFERENT',
        'SCOPE',
        'CARDINALITY',
      ],
      accepted_comparability_effect_codes: [
        'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
      ],
      admission_semantics:
        'SELECTED_PRIMARY_INTERPRETATION_FOR_SEPARATE_RELEASE_KEYED_COHORT_WITH_MANDATORY_LAWYER_WARNING',
      cohort_identity_must_include_interpretation_projection: true,
      lawyer_warning_required: true,
    }],
  );
  assert.equal(FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F12), false);
  assert.equal(
    canonicalJson(fixtureContractForFingerprint(FROZEN_F12)),
    canonicalJson(f12),
  );
});

test('F13 freezes complete capitalisation bring-down semantics without moving F12', () => {
  const f12 = compileFixtureContractV12();
  const f13 = compileFixtureContractV13();
  assert.equal(f12.fingerprint, FROZEN_F12);
  assert.equal(f13.fingerprint, FROZEN_F13);
  assert.equal(validateContractBundle(f13), true);
  assert.equal(
    canonicalJson(f13),
    canonicalJson(compileFixtureContract(FIXTURE_CONTRACT_INPUT_V13)),
  );
  const stable = (bundle) => {
    const {
      fingerprint: _fingerprint,
      claim_definitions: _claimDefinitions,
      relationship_definitions: _relationshipDefinitions,
      definition_use_effect_schema_definition: _definitionUseEffect,
      brings_down_effect_schema_definition: _bringsDownEffect,
      capitalisation_semantic_schema_definition: _capitalisationSchema,
      result_definitions: _resultDefinitions,
      market_metric_definitions: _marketMetricDefinitions,
      ...rest
    } = bundle;
    return rest;
  };
  assert.equal(canonicalJson(stable(f13)), canonicalJson(stable(f12)));
  assert.deepEqual(
    f13.relationship_definitions.filter(
      (entry) => !['BRINGS_DOWN', 'USES_DEFINITION'].includes(
        entry.relationship_key,
      ),
    ),
    f12.relationship_definitions.filter(
      (entry) => !['BRINGS_DOWN', 'USES_DEFINITION'].includes(
        entry.relationship_key,
      ),
    ),
  );
  assert.deepEqual(
    f13.claim_definitions.filter(
      (definition) => !f12.claim_definitions.some(
        (prior) => prior.claim_definition_key
          === definition.claim_definition_key,
      ),
    ),
    [
      GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1,
      REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1,
      RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1,
    ],
  );
  assert.equal(FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FROZEN_F13), false);
  assert.equal(
    canonicalJson(fixtureContractForFingerprint(FROZEN_F13)),
    canonicalJson(f13),
  );
});

test('F13 freezes the governed date, clause groups, parties and qualifier absence scope', () => {
  const f13 = compileFixtureContractV13();
  const schema = f13.capitalisation_semantic_schema_definition;
  assert.equal(schema.semantic_schema_key, 'CAPITALISATION_REPRESENTATION');
  assert.equal(schema.semantic_schema_version, 1);
  assert.deepEqual(schema.required_limb_ordinals, [1, 2, 3, 4, 5]);
  assert.equal(schema.exact_limb_count, 5);
  assert.deepEqual(
    schema.condition_group_contracts.map((group) => [
      group.source_clause_code,
      group.comparison_class_key,
      group.required_limb_ordinals,
    ]),
    [
      [
        'B',
        'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
        [1, 3],
      ],
      [
        'C',
        'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
        [2, 4, 5],
      ],
    ],
  );
  assert.deepEqual(
    schema.party_contract.buyer_group_members.map(
      (member) => [member.value, member.capacity],
    ),
    [
      ['PARENT', 'ACQUIRER'],
      ['TITANIUM_MERGER_SUB', 'MERGER_SUB'],
      ['FORWARD_MERGER_SUB', 'MERGER_SUB'],
    ],
  );
  assert.equal(
    schema.party_contract.one_result_and_observation_party_required,
    true,
  );
  assert.deepEqual(
    {
      measurement_date:
        schema.measurement_date_claim_contract.qxo_required_measurement_date,
      signing_date:
        schema.measurement_date_claim_contract.qxo_required_signing_date,
      offset:
        schema.measurement_date_claim_contract
          .qxo_required_signing_relative_offset,
      offset_unit:
        schema.measurement_date_claim_contract.required_offset_unit,
      day_basis:
        schema.measurement_date_claim_contract.required_day_basis,
      semantic_class:
        schema.measurement_date_claim_contract.allowed_semantic_classes,
    },
    {
      measurement_date: '2026-04-17',
      signing_date: '2026-04-18',
      offset: -1,
      offset_unit: 'CALENDAR_DAY',
      day_basis: 'CALENDAR_DAY',
      semantic_class: ['NEAR_SIGNING_MEASUREMENT_SNAPSHOT'],
    },
  );
  assert.equal(
    schema.measurement_date_claim_contract
      .retrospective_lookback_projection_forbidden,
    true,
  );
  assert.deepEqual(
    schema.qualifier_absence_scope_contract.claim_definition_keys,
    [
      'KNOWLEDGE_QUALIFIER',
      'GENERAL_MATERIALITY_QUALIFIER',
      'RETROSPECTIVE_LOOKBACK',
    ],
  );
  assert.equal(
    schema.qualifier_absence_scope_contract.required_claim_state,
    'ABSENT',
  );
  assert.equal(
    schema.qualifier_absence_scope_contract.required_coverage_status,
    'COMPLETE',
  );
  assert.deepEqual(
    schema.qualifier_absence_scope_contract.required_scope_members,
    [
      'REPRESENTATION_CHAPEAU',
      'REPRESENTATION_LIMB_I',
      'REPRESENTATION_LIMB_II',
      'REPRESENTATION_LIMB_III',
      'REPRESENTATION_LIMB_IV',
      'REPRESENTATION_LIMB_V',
      'APPLICABLE_PROVISOS',
      'DEFINED_TERM_USES',
      'CROSS_REFERENCES',
    ],
  );
  assert.equal(schema.parser_layout_contract.isolated_page_number_line, '16');
  assert.equal(
    schema.parser_layout_contract.semantic_object_creation_for_page_marker_forbidden,
    true,
  );
});

test('F13 freezes typed bring-down and definition-use effects for both clause classes', () => {
  const f12 = compileFixtureContractV12();
  const f13 = compileFixtureContractV13();
  assert.deepEqual(
    f13.relationship_definitions.find(
      (entry) => entry.relationship_key === 'BRINGS_DOWN',
    ),
    {
      relationship_key: 'BRINGS_DOWN',
      effect_mode: 'TYPED_LEGAL_EFFECT',
      version: 2,
      effect_schema: 'BRINGS_DOWN_EFFECT/V1',
    },
  );
  assert.deepEqual(
    f13.relationship_definitions.find(
      (entry) => entry.relationship_key === 'USES_DEFINITION',
    ),
    {
      relationship_key: 'USES_DEFINITION',
      effect_mode: 'TYPED_LEGAL_EFFECT',
      version: 4,
      effect_schema: 'USES_DEFINITION_EFFECT/V3',
    },
  );
  assert.equal(
    f13.brings_down_effect_schema_definition,
    BRINGS_DOWN_EFFECT_SCHEMA_V1,
  );
  assert.equal(
    f13.definition_use_effect_schema_definition,
    USES_DEFINITION_EFFECT_SCHEMA_V3,
  );
  assert.deepEqual(
    f13.brings_down_effect_schema_definition.comparison_class_contracts.map(
      (entry) => [
        entry.comparison_class_key,
        entry.required_target_limb_ordinals,
        entry.required_accuracy_standard,
        entry.required_accuracy_exception,
        entry.required_materiality_scrape_state,
      ],
    ),
    [
      [
        'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
        [1, 3],
        'MAT_ALL_RESPECTS_DE_MINIMIS',
        'DE_MINIMIS_INACCURACIES',
        'NOT_APPLIED',
      ],
      [
        'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
        [2, 4, 5],
        'MAT_ALL_MATERIAL',
        null,
        'APPLIED',
      ],
    ],
  );
  assert.deepEqual(
    f13.brings_down_effect_schema_definition.required_test_point_codes,
    ['AGREEMENT_DATE', 'CLOSING_DATE'],
  );
  assert.equal(
    f13.brings_down_effect_schema_definition.class_aggregation_forbidden,
    true,
  );
  assert.equal(
    f13.definition_use_effect_schema_definition
      .definition_application_contract
      .required_qxo_target_representation_denominator_party,
    'COMPANY',
  );
  assert.equal(
    f13.definition_use_effect_schema_definition
      .definition_application_contract.raw_alternative_phrase_required,
    'OR_PARENT_AS_THE_CASE_MAY_BE',
  );
  assert.equal(
    f12.relationship_definitions.find(
      (entry) => entry.relationship_key === 'BRINGS_DOWN',
    ).version,
    1,
  );
  assert.equal(
    f12.definition_use_effect_schema_definition,
    USES_DEFINITION_EFFECT_SCHEMA_V2,
  );
});

test('F13 freezes one result and one metric with two non-aggregating clause classes', () => {
  const f13 = compileFixtureContractV13();
  assert.equal(f13.result_definitions.length, 1);
  assert.equal(f13.market_metric_definitions.length, 1);
  const [result] = f13.result_definitions;
  const [metric] = f13.market_metric_definitions;
  assert.equal(
    result.result_key,
    TARGET_CAPITALISATION_BRING_DOWN_RESULT_DEFINITION_V2.result_key,
  );
  assert.equal(result.result_version, 2);
  assert.deepEqual(
    result.primary_comparison_slots.map((slot) => [
      slot.ordinal,
      slot.comparison_class_key,
      slot.required_target_limb_ordinals,
    ]),
    [
      [0, 'CAPITALISATION_CLAUSE_B_LIMBS_I_III', [1, 3]],
      [1, 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V', [2, 4, 5]],
    ],
  );
  assert.deepEqual(
    result.contextual_claim_slots.map((slot) => [
      slot.ordinal,
      slot.claim_definition_key,
      slot.required_state,
    ]),
    [
      [2, 'REPRESENTATION_MEASUREMENT_DATE', 'PRESENT'],
      [3, 'KNOWLEDGE_QUALIFIER', 'ABSENT'],
      [4, 'GENERAL_MATERIALITY_QUALIFIER', 'ABSENT'],
      [5, 'RETROSPECTIVE_LOOKBACK', 'ABSENT'],
    ],
  );
  assert.deepEqual(
    result.expected_result_input_lineage_slots.slice(0, 2).map(
      (slot) => [
        slot.required_comparison_class_key,
        slot.required_claim_definition_keys,
        slot.required_relationship_keys,
      ],
    ),
    [
      [
        'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
        [
          'REPRESENTATION_ACCURACY_STANDARD',
          'REPRESENTATION_ACCURACY_EXCEPTION',
        ],
        ['BRINGS_DOWN', 'USES_DEFINITION'],
      ],
      [
        'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
        ['REPRESENTATION_ACCURACY_STANDARD'],
        ['BRINGS_DOWN'],
      ],
    ],
  );
  assert.equal(
    metric.metric_key,
    REPRESENTATION_ACCURACY_STANDARD_METRIC_DEFINITION_V2.metric_key,
  );
  assert.equal(metric.metric_version, 2);
  assert.equal(metric.required_result_version, 2);
  assert.deepEqual(
    metric.comparison_classes.map((entry) => entry.comparison_class_key),
    [
      'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
    ],
  );
  assert.equal(metric.cohort_identity_requires_comparison_class, true);
  assert.equal(metric.cross_class_aggregation_forbidden, true);
  assert.equal(metric.distinct_metric_keys_per_class_forbidden, true);
});

test('F13 refuses partial and co-mutated capitalisation contract hybrids', () => {
  for (const field of [
    'brings_down_effect_schema',
    'capitalisation_semantic_schema',
    'result_definitions',
    'market_metric_definitions',
  ]) {
    assert.throws(() => compileFixtureContract({
      ...FIXTURE_CONTRACT_INPUT_V13,
      [field]: undefined,
    }), /contract version/);
  }
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V13,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V12.relationship_definitions,
  }), /contract version/);
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V12,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V13.claim_definitions,
  }), /contract version/);
  const changedMetrics = JSON.parse(JSON.stringify(
    FIXTURE_CONTRACT_INPUT_V13.market_metric_definitions,
  ));
  changedMetrics[0].comparison_classes = [
    {
      comparison_class_key: 'CAPITALISATION_COMBINED',
      required_value_slot_key: 'CAPITALISATION_COMBINED',
      required_target_limb_ordinals: [1, 2, 3, 4, 5],
    },
  ];
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V13,
    market_metric_definitions: changedMetrics,
  }), /contract version/);
});

// ---------------------------------------------------------------------------
// Per-version validation: validateInput (exercised via compileFixtureContract)
// accepts either frozen concept-key vocabulary and rejects anything else.
// ---------------------------------------------------------------------------

test('a concept-key list matching neither V1 nor V2 is rejected', () => {
  const tampered = {
    ...FIXTURE_CONTRACT_INPUT_V1,
    concepts: Object.freeze([
      ...FIXTURE_CONTRACT_INPUT_V1.concepts,
      Object.freeze({ concept_key: 'INVENTED-CONCEPT', version: 1 }),
    ]),
  };
  assert.throws(() => compileFixtureContract(tampered), /concept keys do not match any frozen fixture contract version/);
});

test('a bundle missing one of the four V2 additions is rejected (not silently accepted as a third version)', () => {
  const partial = {
    ...FIXTURE_CONTRACT_INPUT_V2,
    concepts: Object.freeze(
      FIXTURE_CONTRACT_INPUT_V2.concepts.filter((entry) => entry.concept_key !== 'TERMR-OUTSIDE'),
    ),
  };
  assert.throws(() => compileFixtureContract(partial), /concept keys do not match any frozen fixture contract version/);
});

test('validateContractBundle accepts compiled V1 through V13 bundles', () => {
  assert.equal(validateContractBundle(compileFixtureContract()), true);
  assert.equal(validateContractBundle(compileFixtureContractV2()), true);
  assert.equal(validateContractBundle(compileFixtureContractV3()), true);
  assert.equal(validateContractBundle(compileFixtureContractV4()), true);
  assert.equal(validateContractBundle(compileFixtureContractV5()), true);
  assert.equal(validateContractBundle(compileFixtureContractV6()), true);
  assert.equal(validateContractBundle(compileFixtureContractV7()), true);
  assert.equal(validateContractBundle(compileFixtureContractV8()), true);
  assert.equal(validateContractBundle(compileFixtureContractV9()), true);
  assert.equal(validateContractBundle(compileFixtureContractV10()), true);
  assert.equal(validateContractBundle(compileFixtureContractV11()), true);
  assert.equal(validateContractBundle(compileFixtureContractV12()), true);
  assert.equal(validateContractBundle(compileFixtureContractV13()), true);
});
