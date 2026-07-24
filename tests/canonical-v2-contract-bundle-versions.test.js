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
  FIXTURE_CONTRACT_FINGERPRINTS,
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
  fixtureContractForFingerprint,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

const FROZEN_F1 = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const FROZEN_F2 = '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83';
const FROZEN_F3 = '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c';
const FROZEN_F4 = 'd4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74';
const FROZEN_F5 = 'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478';

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

test('F1 through F5 are distinct recognised fixture contract fingerprints', () => {
  assert.notEqual(FROZEN_F1, FROZEN_F2);
  assert.notEqual(FROZEN_F2, FROZEN_F3);
  assert.notEqual(FROZEN_F3, FROZEN_F4);
  assert.notEqual(FROZEN_F4, FROZEN_F5);
  assert.deepEqual(
    [...FIXTURE_CONTRACT_FINGERPRINTS].sort(),
    [FROZEN_F1, FROZEN_F2, FROZEN_F3, FROZEN_F4, FROZEN_F5].sort(),
  );
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

test('validateContractBundle accepts compiled V1 through V5 bundles', () => {
  assert.equal(validateContractBundle(compileFixtureContract()), true);
  assert.equal(validateContractBundle(compileFixtureContractV2()), true);
  assert.equal(validateContractBundle(compileFixtureContractV3()), true);
  assert.equal(validateContractBundle(compileFixtureContractV4()), true);
  assert.equal(validateContractBundle(compileFixtureContractV5()), true);
});
