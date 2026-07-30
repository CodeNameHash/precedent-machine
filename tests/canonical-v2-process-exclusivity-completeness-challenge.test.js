const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProcessPredicateInputs,
} = require('../lib/canonical-v2/process-predicate-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function members() {
  return [
    loadMember(
      'process/predicates/exclusivity-completeness-challenge-protocol.v1.json',
    ),
    loadMember('process/predicates/exclusivity-predicate-catalogue.v2.json'),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function protocol(values) {
  return values.find(
    (member) => (
      member.canonical_value.stable_id
      === 'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL'
    ),
  ).canonical_value.definition;
}

test('registers the challenge protocol without claiming a completed challenge', () => {
  const values = members();
  assert.doesNotThrow(() => validateAuthoredProcessPredicateInputs(values));

  const definition = protocol(values);
  assert.equal(definition.completion_contract.this_member_is_challenge_catalogue, false);
  assert.equal(
    definition.completion_contract.this_member_satisfies_independent_challenge,
    false,
  );
  assert.equal(definition.completion_contract.challenge_catalogue_member_required, true);
  assert.equal(definition.completion_contract.reconciliation_member_required, true);
  assert.equal(definition.completion_contract.independence_evidence_member_required, true);
});

test('requires operational separation and proves it from evidence', () => {
  const independence = protocol(members()).operational_independence_contract;

  assert.equal(independence.separate_authoring_task_required, true);
  assert.equal(independence.separate_task_ancestry_required, true);
  assert.equal(independence.ordinary_catalogue_author_cannot_author_challenge_catalogue, true);
  assert.equal(independence.mechanism_class_must_differ_from_ordinary_authoring, true);
  assert.equal(independence.same_model_family_with_second_prompt_proves_independence, false);
  assert.equal(independence.shared_model_transcript_permitted, false);
  assert.equal(independence.shared_candidate_list_permitted, false);
  assert.equal(independence.shared_draft_or_mapping_permitted, false);
  assert.equal(independence.independence_is_mechanically_evidenced_not_self_asserted, true);
});

test('keeps ordinary catalogue content outside blind challenge authoring', () => {
  const definition = protocol(members());
  const blind = definition.blind_input_contract;

  assert.equal(
    definition.ordinary_catalogue_binding
      .ordinary_catalogue_is_permitted_blind_authoring_input,
    false,
  );
  assert.equal(
    definition.ordinary_catalogue_binding
      .ordinary_predicate_keys_are_permitted_blind_authoring_input,
    false,
  );
  assert.deepEqual(blind.prohibited_input_classes, [
    'ORDINARY_CATALOGUE_BYTES',
    'ORDINARY_PREDICATE_KEY_LIST',
    'ORDINARY_TO_CHALLENGE_MAPPING',
    'ORDINARY_CATALOGUE_AUTHOR_TRANSCRIPT',
    'ORDINARY_CATALOGUE_CANDIDATE_LIST',
    'TEST_FIXTURE_DERIVED_FROM_ORDINARY_KEYS',
  ]);
  assert.equal(blind.input_exclusion_evidence_required, true);
  assert.equal(blind.unproved_input_provenance_blocks_challenge_admission, true);
});

test('gives the challenge its own questions and answer slots before mapping', () => {
  const output = protocol(members()).challenge_output_contract;

  assert.equal(
    output.challenge_question_stable_id_domain,
    'PROCESS_EXCLUSIVITY_CHALLENGE_QUESTION/V1',
  );
  assert.equal(
    output.challenge_answer_slot_stable_id_domain,
    'PROCESS_EXCLUSIVITY_CHALLENGE_ANSWER_SLOT/V1',
  );
  assert.equal(output.ordinary_predicate_key_field_permitted, false);
  assert.equal(output.ordinary_mapping_field_permitted, false);
  assert.equal(output.one_or_more_questions_required, true);
  assert.equal(output.one_or_more_answer_slots_per_question_required, true);
  assert.equal(output.question_count_can_be_fixed_from_ordinary_catalogue, false);
  assert.equal(output.challenge_author_must_record_own_coverage_argument, true);
  assert.equal(output.known_limits_must_be_explicit, true);
});

test('seals the challenge before disclosure and reconciles every member', () => {
  const definition = protocol(members());
  const seal = definition.seal_contract;
  const reconciliation = definition.reconciliation_contract;

  assert.equal(seal.challenge_catalogue_sealed_before_ordinary_catalogue_disclosure, true);
  assert.equal(seal.sealed_bytes_are_immutable, true);
  assert.equal(seal.post_disclosure_edit_permitted, false);
  assert.equal(
    seal.failed_independence_cannot_be_repaired_by_resigning_same_output,
    true,
  );
  assert.equal(
    reconciliation.reconciliation_starts_only_after_both_catalogues_are_sealed,
    true,
  );
  assert.equal(
    reconciliation.ordinary_predicate_coverage_required,
    'EVERY_MANDATORY_PREDICATE_KEY_AND_VERSION',
  );
  assert.equal(
    reconciliation.challenge_coverage_required,
    'EVERY_CHALLENGE_ANSWER_SLOT',
  );
  assert.equal(reconciliation.silent_drop_or_merge_permitted, false);
  assert.equal(reconciliation.unreconciled_member_blocks_contract_freeze, true);
  assert.equal(
    reconciliation.new_required_predicate_requires_successor_ordinary_catalogue_amendment,
    true,
  );
});

test('rejects weakened independence, sealing, reconciliation and completion rules', () => {
  const mutations = [
    (value) => {
      value.operational_independence_contract
        .same_model_family_with_second_prompt_proves_independence = true;
    },
    (value) => {
      value.ordinary_catalogue_binding
        .ordinary_predicate_keys_are_permitted_blind_authoring_input = true;
    },
    (value) => {
      value.seal_contract.post_disclosure_edit_permitted = true;
    },
    (value) => {
      value.reconciliation_contract.silent_drop_or_merge_permitted = true;
    },
    (value) => {
      value.completion_contract.this_member_satisfies_independent_challenge = true;
    },
    (value) => {
      value.authority_contract.creates_contract_freeze_authority = true;
    },
  ];

  for (const mutate of mutations) {
    const values = clone(members());
    mutate(protocol(values));
    assert.throws(
      () => validateAuthoredProcessPredicateInputs(values),
      (error) => (
        error.code
        === 'INVALID_PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL'
      ),
    );
  }
});

test('compiles as a mechanically complete non-authoritative input universe', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });
  assert.equal(compiled.authored_members.length, 170);
  assert.equal(
    compiled.authored_universe_assessment.status,
    'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY',
  );
  assert.equal(
    compiled.disposition.status,
    'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE',
  );
  assert.equal(compiled.disposition.freeze_eligible, false);
  assert.equal(compiled.disposition.canonical_contract_bundle_authority, 'NONE');

  const authority = compiled.authored_members.find(
    (member) => (
      member.stable_id
      === 'PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_PROTOCOL'
    ),
  ).canonical_value.definition.authority_contract;
  assert.equal(Object.values(authority).every((value) => value === false), true);
});
