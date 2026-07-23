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
  FIXTURE_CONTRACT_FINGERPRINTS,
  compileFixtureContract,
  compileFixtureContractV2,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

const FROZEN_F1 = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const FROZEN_F2 = '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83';

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

test('F1 and F2 are distinct, and both are recognised fixture contract fingerprints', () => {
  assert.notEqual(FROZEN_F1, FROZEN_F2);
  assert.deepEqual([...FIXTURE_CONTRACT_FINGERPRINTS].sort(), [FROZEN_F1, FROZEN_F2].sort());
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

test('validateContractBundle accepts both a compiled V1 bundle and a compiled V2 bundle', () => {
  assert.equal(validateContractBundle(compileFixtureContract()), true);
  assert.equal(validateContractBundle(compileFixtureContractV2()), true);
});
