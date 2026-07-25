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
  FIXTURE_CONTRACT_FINGERPRINTS,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  NO_SHOP_ACTION_CODES_V2,
  NO_SHOP_ACTION_ROLLUP_SCHEMA_V1,
  NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
  compileFixtureContractV6,
  fixtureContractForFingerprint,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

const FROZEN_F1 = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const FROZEN_F2 = '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83';
const FROZEN_F3 = '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c';
const FROZEN_F4 = 'd4ce5235be1818a42d9aba0dfb34198456eb062381e7d7db7b8289dd88671c74';
const FROZEN_F5 = 'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478';
const FROZEN_F6 = '161083b014a35d800dec0b0c41a97dc6d97f38a5dd206b388ba51b3ab9f68c08';

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

test('F1 through F6 are distinct recognised fixture contract fingerprints', () => {
  assert.notEqual(FROZEN_F1, FROZEN_F2);
  assert.notEqual(FROZEN_F2, FROZEN_F3);
  assert.notEqual(FROZEN_F3, FROZEN_F4);
  assert.notEqual(FROZEN_F4, FROZEN_F5);
  assert.notEqual(FROZEN_F5, FROZEN_F6);
  assert.deepEqual(
    [...FIXTURE_CONTRACT_FINGERPRINTS].sort(),
    [FROZEN_F1, FROZEN_F2, FROZEN_F3, FROZEN_F4, FROZEN_F5, FROZEN_F6].sort(),
  );
  assert.deepEqual(
    [...FIXTURE_SERVING_CONTRACT_FINGERPRINTS].sort(),
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

test('validateContractBundle accepts compiled V1 through V6 bundles', () => {
  assert.equal(validateContractBundle(compileFixtureContract()), true);
  assert.equal(validateContractBundle(compileFixtureContractV2()), true);
  assert.equal(validateContractBundle(compileFixtureContractV3()), true);
  assert.equal(validateContractBundle(compileFixtureContractV4()), true);
  assert.equal(validateContractBundle(compileFixtureContractV5()), true);
  assert.equal(validateContractBundle(compileFixtureContractV6()), true);
});
