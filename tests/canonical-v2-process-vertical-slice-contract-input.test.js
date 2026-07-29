const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessGateInputs,
} = require('../lib/canonical-v2/process-gate-contract-input-validator');

const FILE = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/process/gates/process-vertical-slice-pass.v1.json',
);

function member() {
  const canonicalValue = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function definition(value = member()) {
  return value.canonical_value.definition;
}

test('validates the complete Process vertical-slice pass contract', () => {
  assert.doesNotThrow(() => validateAuthoredProcessGateInputs([member()]));
});

test('binds a future fail-closed gate to the exact same frozen pair as the canonical slice', () => {
  const value = definition();

  assert.deepEqual(value.gate_identity_contract, {
    gate_id: 'PROCESS_VERTICAL_SLICE_PASS',
    evidence_schema_id: 'PROCESS_VERTICAL_SLICE_ATTESTATION/V1',
    required_status: 'PASS',
    canonical_predecessor_gate_id: 'P1_VERTICAL_SLICE_PASS',
    canonical_predecessor_is_substitutable: false,
    governing_gate_activation_state: 'DEFERRED_UNTIL_P8_EXACT_ROOT_AMENDMENT',
    governing_gate_entry_required_before_evidence_execution: true,
    successor_candidate_scope_dependency_required: true,
  });
  assert.equal(
    value.frozen_basis_contract.process_and_canonical_attestations_must_bind_same_pair,
    true,
  );
  assert.equal(
    value.frozen_basis_contract.prior_pair_or_prior_process_evidence_permitted,
    false,
  );
});

test('requires the exact independently sealed Metsera source and gold basis', () => {
  const pilot = definition().pilot_admission_contract;

  assert.equal(pilot.anchor_deal_key, 'METSERA');
  assert.equal(
    pilot.exact_admitted_source_universe_manifest_id_and_digest_required,
    true,
  );
  assert.equal(
    pilot.independent_source_only_enumeration_receipts_required,
    2,
  );
  assert.equal(pilot.gold_package_can_consume_extractor_output, false);
  assert.equal(
    pilot.extractor_can_access_case_level_gold_before_comparison,
    false,
  );
  assert.equal(pilot.release_scope_can_shrink_after_evidence_begins, false);
});

test('closes all fifteen Process-slice acceptance propositions', () => {
  const acceptance = definition().acceptance_contract;

  assert.equal(acceptance.all_items_required, true);
  assert.equal(acceptance.required_items.length, 15);
  assert.equal(new Set(acceptance.required_items).size, 15);
  assert.equal(acceptance.promised_shared_field_may_be_absent, false);
  assert.equal(acceptance.unproved_track_must_remain_source_local, true);
  assert.equal(
    acceptance.enabled_predicate_or_field_may_lack_certification_identity,
    false,
  );
});

test('prevents party, track, repeated-narration and source identity shortcuts', () => {
  const source = definition().source_and_identity_contract;

  assert.equal(source.exact_source_intervals_and_ordered_evidence_required, true);
  assert.equal(source.generic_side_label_can_establish_party_role, false);
  assert.equal(
    source.chronology_or_matching_economics_can_merge_bidder_tracks,
    false,
  );
  assert.equal(source.repeated_narration_resolution_disposition_required, true);
  assert.equal(
    source.source_text_rewrite_or_silent_normalisation_permitted,
    false,
  );
});

test('requires one bounded set-based serving call and the frozen performance limits', () => {
  const query = definition().query_and_context_contract;

  assert.equal(query.ask_and_browse_byte_equivalent_query_ir_required, true);
  assert.equal(query.one_mandatory_admission_rpc_required, true);
  assert.equal(query.maximum_bounded_set_based_serving_rpcs, 1);
  assert.equal(query.corpus_proportional_database_calls_permitted, false);
  assert.equal(query.p95_warm_query_milliseconds_less_than, 500);
  assert.equal(query.p95_cold_query_milliseconds_less_than, 1500);
  assert.equal(query.p95_local_browse_and_filter_milliseconds_less_than, 200);
  assert.equal(
    query.p95_cached_or_range_addressable_context_milliseconds_less_than,
    300,
  );
});

test('isolates malformed and unrecognised siblings without weakening integrity containment', () => {
  const isolation = definition().failure_isolation_contract;

  assert.equal(isolation.malformed_row_fails_closed_locally, true);
  assert.equal(isolation.malformed_detail_fails_closed_locally, true);
  assert.equal(isolation.valid_sibling_rows_remain_renderable, true);
  assert.equal(isolation.valid_sibling_details_remain_renderable, true);
  assert.equal(isolation.one_unrecognised_provision_can_block_other_provisions, false);
  assert.equal(
    isolation.release_wide_failure_requires_governed_integrity_trigger,
    true,
  );
});

test('requires independently addressable evidence and all adversarial rejections', () => {
  const value = definition();

  assert.equal(value.evidence_contract.per_acceptance_item_evidence_required, true);
  assert.equal(value.evidence_contract.all_claims_must_pass, true);
  assert.equal(
    value.evidence_contract.missing_stale_conflicting_or_unresolved_evidence_fails,
    true,
  );
  assert.equal(value.evidence_contract.caller_supplied_pass_boolean_permitted, false);
  assert.equal(value.adversarial_contract.required_rejections.length, 15);
  assert.equal(
    new Set(value.adversarial_contract.required_rejections).size,
    15,
  );
  assert.equal(
    value.adversarial_contract.every_rejection_requires_focused_test,
    true,
  );
});

test('grants only later stratified-pilot eligibility and no runtime authority', () => {
  const value = definition();

  assert.equal(
    value.downstream_effect_contract.passing_effect,
    'PERMITS_STRATIFIED_PROCESS_PILOT_ONLY',
  );
  assert.equal(value.downstream_effect_contract.production_activation_permitted, false);
  assert.equal(
    value.downstream_effect_contract
      .broad_candidate_scope_and_extraction_requires_governing_dependency_pass,
    true,
  );
  assert.equal(
    Object.values(value.authority_contract).every((entry) => entry === false),
    true,
  );
});

test('rejects duplicates, unknown identities and any semantic weakening', () => {
  const original = member();

  assert.throws(
    () => validateAuthoredProcessGateInputs([original, clone(original)]),
    (error) => error.code === 'PROCESS_GATE_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const unknown = clone(original);
  unknown.canonical_value.stable_id = 'UNREGISTERED_PROCESS_GATE';
  assert.throws(
    () => validateAuthoredProcessGateInputs([unknown]),
    (error) => error.code === 'PROCESS_GATE_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const inherited = clone(original);
  definition(inherited).evidence_contract.earlier_gate_or_release_status_can_infer_pass = true;
  assert.throws(
    () => validateAuthoredProcessGateInputs([inherited]),
    (error) => error.code === 'INVALID_PROCESS_VERTICAL_SLICE_PASS_INPUT',
  );

  const propagated = clone(original);
  definition(propagated)
    .failure_isolation_contract.one_unrecognised_provision_can_block_other_provisions = true;
  assert.throws(
    () => validateAuthoredProcessGateInputs([propagated]),
    (error) => error.code === 'INVALID_PROCESS_VERTICAL_SLICE_PASS_INPUT',
  );

  const premature = clone(original);
  definition(premature).authority_contract.creates_runtime_gate = true;
  assert.throws(
    () => validateAuthoredProcessGateInputs([premature]),
    (error) => error.code === 'INVALID_PROCESS_VERTICAL_SLICE_PASS_INPUT',
  );
});
