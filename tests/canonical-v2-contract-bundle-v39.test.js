'use strict';

// PLAN.md Step 3J ("split payment timing into event and delay"; DECISIONS.md
// decision 5's "RULED 2026-08-07: split the field. Option B", cross-checked
// against decision 6). Dedicated V39 acceptance tests, following the
// existing per-version convention (tests/canonical-v2-contract-bundle-v14
// .test.js, -v15, -v17) rather than growing the giant, exhaustively-pinned
// tests/canonical-v2-contract-bundle-versions.test.js, which this step does
// not own and does not edit.
//
// V39 is strictly additive over V38: zero concept or claim-definition
// additions (dual numbering -- fixture-input version moves to V39, concept-
// keys version stays at V24, claim-keys version stays at V38), only
// `serving_trigger_path_schemas` gains TERMINATION_FEE_TRIGGER_PATH_
// SCHEMA_V3 alongside the untouched, frozen V2.

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT_V38,
  FIXTURE_CONTRACT_INPUT_V39,
  TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2,
  TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3,
  PAYMENT_TIMING_SPLIT_MIGRATION_V1,
  compileFixtureContractV38,
  compileFixtureContractV39,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

test('V39 compiles, validates, and is a strict superset of V38 except trigger_path_schemas', () => {
  const v38 = compileFixtureContractV38();
  const v39 = compileFixtureContractV39();
  assert.equal(validateContractBundle(v39), true);
  assert.equal(
    canonicalJson(compileFixtureContractV39()),
    canonicalJson(require('../lib/canonical-v2/contract-bundle').compileFixtureContract(FIXTURE_CONTRACT_INPUT_V39)),
  );
  assert.notEqual(v39.fingerprint, v38.fingerprint);
  assert.deepEqual(v39.concepts, v38.concepts);
  assert.deepEqual(v39.claim_definitions, v38.claim_definitions);
  assert.deepEqual(v39.relationship_definitions, v38.relationship_definitions);
  assert.deepEqual(v39.serving_metric_operation_bindings, v38.serving_metric_operation_bindings);
  const {
    trigger_path_schema_definition_id: _v2Id,
    trigger_path_schema_definition_payload_digest: _v2Digest,
    ...v2Compiled
  } = v38.serving_trigger_path_schema_definitions[0];
  const v39Schemas = v39.serving_trigger_path_schema_definitions.map((entry) => {
    const {
      trigger_path_schema_definition_id: _id,
      trigger_path_schema_definition_payload_digest: _digest,
      ...rest
    } = entry;
    return rest;
  });
  assert.equal(v39Schemas.length, 2);
  assert.deepEqual(v39Schemas[0], v2Compiled, 'V2 must appear in V39 completely unmodified');
  assert.equal(v39Schemas[1].trigger_path_schema_key, 'TERMINATION_FEE_TRIGGER_PATH');
  assert.equal(v39Schemas[1].trigger_path_schema_version, 3);
});

test('FIXTURE_CONTRACT_INPUT_V39 carries both schema versions, never replacing V2', () => {
  assert.equal(FIXTURE_CONTRACT_INPUT_V39.serving_trigger_path_schemas.length, 2);
  assert.equal(FIXTURE_CONTRACT_INPUT_V39.serving_trigger_path_schemas[0], TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2);
  assert.equal(FIXTURE_CONTRACT_INPUT_V39.serving_trigger_path_schemas[1], TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3);
  // V38's own trigger-path schema array (inherited from V4) is untouched --
  // still exactly [V2].
  assert.deepEqual(FIXTURE_CONTRACT_INPUT_V38.serving_trigger_path_schemas, [TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2]);
});

test('a hybrid trying to smuggle a third or malformed trigger-path schema set is rejected', () => {
  const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
  // V3 alone (no V2 alongside it) does not match ANY recognised fixture
  // contract shape at all -- it never even reaches the trigger-path-schema-
  // specific check below, because nothing in KNOWN_VERSION_SHAPES has a
  // single-entry trigger_path_schemas list of just V3.
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V39,
    serving_trigger_path_schemas: [TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3],
  }), /concept keys do not match any frozen fixture contract version/);
  // A duplicated V3 alongside V2 is caught even earlier, by the generic
  // sortedUnique key-duplication guard every one of this file's governed
  // lists already shares.
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V39,
    serving_trigger_path_schemas: [
      TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2,
      TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3,
      TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3,
    ],
  }), /serving trigger-path schema keys contains duplicates/);
  // A pair that presents the same {schema_key, schema_version} identity as
  // [V2, V3] (so it passes the earlier version-shape lookup, which matches
  // on those identity strings only) but is not byte-identical to the real,
  // frozen V3 is rejected by the trigger-path-schema-specific assertExact.
  assert.throws(() => compileFixtureContract({
    ...FIXTURE_CONTRACT_INPUT_V39,
    serving_trigger_path_schemas: [
      TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2,
      { ...TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3, maximum_paths: 99 },
    ],
  }), /serving trigger-path schemas/);
});

// ---------------------------------------------------------------------------
// The migration: no legacy `payment_timing` / `allowed_payment_timings` form
// remains anywhere in V3, and every value is a deterministic function of
// V2's own frozen data (not hand-retyped).
// ---------------------------------------------------------------------------

test('TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3 carries no stored QXO value in the old single-field form', () => {
  assert.equal('allowed_payment_timings' in TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3, false);
  assert.ok(Array.isArray(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.allowed_payment_trigger_events));
  assert.ok(Array.isArray(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.allowed_payment_delays));
  for (const entry of TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.pathway_constraints) {
    assert.equal('payment_timing' in entry, false, `${entry.pathway_code} must not carry the legacy single field`);
    assert.ok(typeof entry.payment_trigger_event === 'string' && entry.payment_trigger_event.length > 0, entry.pathway_code);
    assert.ok(typeof entry.payment_delay === 'string' && entry.payment_delay.length > 0, entry.pathway_code);
  }
});

test('the split vocabulary is exactly what the five known real patterns require -- nothing more', () => {
  assert.deepEqual(
    [...TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.allowed_payment_trigger_events].sort(),
    ['CONCURRENT_WITH_TERMINATION', 'EARLIER_OF_SIGNING_OR_CONSUMMATION', 'TERMINATION'],
  );
  assert.deepEqual(
    [...TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.allowed_payment_delays].sort(),
    ['NONE', 'TWO_BUSINESS_DAYS'],
  );
});

test('every V3 pathway_constraint is the exact migration of its V2 sibling -- same pathway, same trigger, same digests, only payment_timing split', () => {
  assert.equal(
    TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.pathway_constraints.length,
    TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2.pathway_constraints.length,
  );
  for (const v2Entry of TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2.pathway_constraints) {
    const v3Entry = TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3.pathway_constraints.find(
      (entry) => entry.pathway_code === v2Entry.pathway_code,
    );
    assert.ok(v3Entry, v2Entry.pathway_code);
    assert.equal(v3Entry.trigger_code, v2Entry.trigger_code, v2Entry.pathway_code);
    assert.equal(v3Entry.terminating_party_rule, v2Entry.terminating_party_rule, v2Entry.pathway_code);
    assert.deepEqual(v3Entry.expression_digest_by_fee_side, v2Entry.expression_digest_by_fee_side, v2Entry.pathway_code);
    const expectedSplit = PAYMENT_TIMING_SPLIT_MIGRATION_V1[v2Entry.payment_timing];
    assert.equal(v3Entry.payment_trigger_event, expectedSplit.payment_trigger_event, v2Entry.pathway_code);
    assert.equal(v3Entry.payment_delay, expectedSplit.payment_delay, v2Entry.pathway_code);
  }
});

test('QXO migration table pins the two legacy codes to the exact required pair -- both QXO patterns encode', () => {
  assert.deepEqual(PAYMENT_TIMING_SPLIT_MIGRATION_V1.TWO_BUSINESS_DAYS_AFTER_TERMINATION, {
    payment_trigger_event: 'TERMINATION',
    payment_delay: 'TWO_BUSINESS_DAYS',
  });
  assert.deepEqual(PAYMENT_TIMING_SPLIT_MIGRATION_V1.UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION, {
    payment_trigger_event: 'EARLIER_OF_SIGNING_OR_CONSUMMATION',
    payment_delay: 'NONE',
  });
  assert.equal(Object.keys(PAYMENT_TIMING_SPLIT_MIGRATION_V1).length, 2, 'exactly the two legacy codes, nothing invented');
});
