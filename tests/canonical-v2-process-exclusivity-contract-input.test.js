const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');
const {
  validateAuthoredProcessPredicateInputs,
} = require('../lib/canonical-v2/process-predicate-contract-input-validator');
const {
  validateAuthoredProcessServingInputs,
} = require('../lib/canonical-v2/process-serving-contract-input-validator');

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function logicalMembers() {
  return [
    loadMember('process/agreements/process-agreement.v1.json'),
    loadMember('process/bidder-tracks/bidder-track.v1.json'),
    loadMember('process/domain/process-domain-registry.v1.json'),
    loadMember('process/events/process-event.v1.json'),
    loadMember('process/narration/process-narration-occurrence.v1.json'),
    loadMember('process/occurrence-slots/process-event.v1.json'),
    loadMember('process/occurrence-slots/process-narration.v1.json'),
    loadMember('process/participants/process-participant.v1.json'),
    loadMember('process/passages/process-passage.v1.json'),
    loadMember('process/phases/process-phase.v1.json'),
    loadMember('process/positions/process-position.v1.json'),
    loadMember('process/predicates/process-predicate-witness.v2.json'),
    loadMember('process/registries/process-controlled-code-registry.v2.json'),
    loadMember('process/relationships/process-relationship.v2.json'),
  ];
}

function predicateMembers() {
  return [
    loadMember(
      'process/predicates/exclusivity-completeness-challenge-protocol.v1.json',
    ),
    loadMember('process/predicates/exclusivity-predicate-catalogue.v2.json'),
  ];
}

function servingMembers() {
  return [
    loadMember('process/results/process-exclusivity-event-result.v1.json'),
    loadMember('process/results/process-phrasebook-passage-result.v1.json'),
    loadMember('process/serving/bounded-inline-passage-preview.v1.json'),
    loadMember('process/serving/parent-bound-paragraph-context.v1.json'),
    loadMember('process/serving/related-passage-child-collection.v1.json'),
  ];
}

function definition(members, stableId) {
  return members.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('registers the closed ordinary exclusivity predicate catalogue', () => {
  const members = predicateMembers();
  assert.doesNotThrow(() => validateAuthoredProcessPredicateInputs(members));

  const catalogue = definition(
    members,
    'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  );
  assert.equal(
    catalogue.ordinary_question_contract.mandatory_predicate_keys.length,
    41,
  );
  assert.equal(
    new Set(catalogue.ordinary_question_contract.mandatory_predicate_keys).size,
    41,
  );
  assert.equal(
    catalogue.ordinary_question_contract.natural_language_maps_only_to_governed_predicates,
    true,
  );
  assert.equal(
    catalogue.ordinary_question_contract.unknown_question_has_runtime_path,
    false,
  );
  assert.equal(
    catalogue.completeness_challenge_contract
      .independent_challenge_catalogue_required_before_freeze,
    true,
  );
  assert.equal(
    catalogue.completeness_challenge_contract
      .this_catalogue_satisfies_independent_challenge,
    false,
  );
});

test('keeps request, response and grant states distinct', () => {
  const catalogue = definition(
    predicateMembers(),
    'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  );
  const response = catalogue.response_contract;

  assert.deepEqual(response.atomic_response_predicate_keys, [
    'EXCLUSIVITY_EXPRESS_REFUSAL',
    'EXCLUSIVITY_COUNTERPROPOSAL',
    'EXCLUSIVITY_CONDITIONAL_ACCEPTANCE',
    'EXCLUSIVITY_GRANTED',
  ]);
  assert.equal(response.union_requires_admitted_atomic_constituent, true);
  assert.equal(response.union_preserves_constituent_predicate_key, true);
  assert.equal(response.union_preserves_exact_subject_and_response_state, true);
  assert.equal(response.request_can_satisfy_grant, false);
  assert.equal(response.shortened_term_can_become_express_refusal, false);
  assert.equal(response.conditional_response_can_become_express_refusal, false);
  assert.equal(response.silence_can_become_express_refusal, false);
  assert.equal(response.no_recorded_grant_can_become_express_refusal, false);
});

test('keeps exclusivity subject, participant, time and bidder-track evidence exact', () => {
  const catalogue = definition(
    predicateMembers(),
    'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  );

  assert.deepEqual(catalogue.subject_contract.initial_subject_codes, [
    'NEGOTIATION_EXCLUSIVITY',
    'TRANSACTION_EXCLUSIVITY',
    'EXCLUSIVE_DILIGENCE',
    'EXCLUSIVE_DATA_ACCESS',
  ]);
  assert.equal(
    catalogue.subject_contract.exclusive_data_access_can_become_negotiation_exclusivity,
    false,
  );
  assert.equal(
    catalogue.participant_role_contract.generic_acquirer_side_can_supply_beneficiary,
    false,
  );
  assert.equal(
    catalogue.temporal_contract
      .business_days_can_become_elapsed_days_without_admitted_node,
    false,
  );
  assert.equal(
    catalogue.temporal_contract
      .date_inheritance_by_same_day_or_paragraph_proximity_permitted,
    false,
  );
  assert.equal(catalogue.context_contract.bidder_tracks_cannot_be_mixed, true);
  assert.equal(
    catalogue.context_contract.actual_drafting_cannot_be_replaced_by_summary,
    true,
  );
});

test('registers the predicate witness at the required terminal revision type', () => {
  const members = logicalMembers();
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members));

  const witness = definition(members, 'PROCESS_PREDICATE_WITNESS');
  assert.equal(witness.trace_treatment.terminal_type, 'PREDICATE_WITNESS_REVISION');
  assert.equal(
    witness.narration_contract.exactly_one_source_local_narration_required,
    true,
  );
  assert.equal(
    witness.dimension_contract.subject_role_temporal_track_relationship_and_drafting_are_separable,
    true,
  );
  assert.equal(
    witness.dimension_contract.actual_drafting_requires_process_passage_revision,
    true,
  );
  assert.equal(witness.dimension_contract.summary_can_satisfy_actual_drafting, false);
  assert.equal(witness.evidence_rules.silence_can_support_express_refusal, false);
});

test('defines a composed event result without creating deal chronology', () => {
  const members = servingMembers();
  assert.doesNotThrow(() => validateAuthoredProcessServingInputs(members));

  const result = definition(members, 'PROCESS_EXCLUSIVITY_EVENT_RESULT');
  assert.deepEqual(result.component_slot_contract.required_slots, [
    {
      slot_key: 'PROCESS_EVENT',
      terminal_type: 'PROCESS_EVENT_REVISION',
      cardinality: 'EXACTLY_ONE',
    },
    {
      slot_key: 'PREDICATE_WITNESSES',
      terminal_type: 'PREDICATE_WITNESS_REVISION',
      cardinality: 'ONE_OR_MORE',
    },
    {
      slot_key: 'ACTUAL_DRAFTING',
      terminal_type: 'PROCESS_PASSAGE_REVISION',
      cardinality: 'ONE_OR_MORE',
    },
  ]);
  assert.equal(
    result.history_projection_contract.label_as_complete_deal_chronology_permitted,
    false,
  );
  assert.equal(
    result.history_projection_contract.separate_bidder_tracks_can_be_mixed,
    false,
  );
  assert.equal(
    result.history_projection_contract.projection_can_create_facts_or_summaries,
    false,
  );
  assert.equal(result.exact_detail_contract.actual_drafting_required, true);
  assert.equal(
    result.exact_detail_contract.summary_can_replace_actual_drafting,
    false,
  );
});

test('rejects any semantic weakening of the three governed definitions', () => {
  const predicate = clone(predicateMembers());
  definition(
    predicate,
    'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  ).response_contract.silence_can_become_express_refusal = true;
  assert.throws(
    () => validateAuthoredProcessPredicateInputs(predicate),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
  );

  const logical = clone(logicalMembers());
  definition(
    logical,
    'PROCESS_PREDICATE_WITNESS',
  ).dimension_contract.summary_can_satisfy_actual_drafting = true;
  assert.throws(
    () => validateAuthoredProcessInputs(logical),
    (error) => error.code === 'INVALID_PROCESS_PREDICATE_WITNESS_INPUT',
  );

  const serving = clone(servingMembers());
  definition(
    serving,
    'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  ).history_projection_contract.separate_bidder_tracks_can_be_mixed = true;
  assert.throws(
    () => validateAuthoredProcessServingInputs(serving),
    (error) => error.code === 'INVALID_PROCESS_EXCLUSIVITY_EVENT_RESULT_INPUT',
  );
});

test('compiles without freeze, extraction, writer, serving or release authority', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });
  assert.equal(compiled.authored_members.length, 173);
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

  const governed = compiled.authored_members.filter((member) => [
    'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
    'PROCESS_EXCLUSIVITY_EVENT_RESULT',
    'PROCESS_PREDICATE_WITNESS',
  ].includes(member.stable_id));
  assert.equal(governed.length, 3);
  for (const member of governed) {
    assert.equal(
      Object.values(member.canonical_value.definition.authority_contract)
        .every((value) => value === false),
      true,
    );
  }
});
