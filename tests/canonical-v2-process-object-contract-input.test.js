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

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

function member(relativePath) {
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
    member('process/agreements/process-agreement.v1.json'),
    member('process/bidder-tracks/bidder-track.v1.json'),
    member('process/domain/process-domain-registry.v1.json'),
    member('process/events/process-event.v1.json'),
    member('process/narration/process-narration-occurrence.v1.json'),
    member('process/occurrence-slots/process-event.v1.json'),
    member('process/occurrence-slots/process-narration.v1.json'),
    member('process/participants/process-participant.v1.json'),
    member('process/passages/process-passage.v1.json'),
    member('process/phases/process-phase.v1.json'),
    member('process/positions/process-position.v1.json'),
    member('process/predicates/process-predicate-witness.v2.json'),
    member('process/registries/process-controlled-code-registry.v2.json'),
    member('process/relationships/process-relationship.v2.json'),
  ];
}

function definition(values, stableId) {
  return values.find(
    (entry) => entry.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('validates all four bounded Process object definitions', () => {
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members()));
});

test('keeps a ProcessPosition identity independent from its party, term and value', () => {
  const position = definition(members(), 'PROCESS_POSITION');

  assert.deepEqual(position.position_identity.stable_id_inputs, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_position_slot_key',
    'governed_ordinal',
  ]);
  assert.equal(position.occurrence_slot_contract.slot_key_is_self_authorising, false);
  assert.equal(position.subject_contract.same_governed_deal_required, true);
  assert.equal(position.term_contract.term_code_registry_required_before_materialisation, true);
  assert.equal(position.position_value_contract.silence_can_create_express_refusal, false);
  assert.equal(
    position.position_value_contract.no_recorded_grant_can_create_express_refusal,
    false,
  );
  assert.equal(position.event_link_contract.matching_date_alone_can_create_link, false);
  assert.equal(position.consideration_contract.shared_economic_fact_reauthoring_permitted, false);
});

test('preserves ProcessAgreement type, party, version and actual drafting lineage', () => {
  const agreement = definition(members(), 'PROCESS_AGREEMENT');

  assert.deepEqual(agreement.agreement_type_contract.minimum_governed_types, [
    'CONFIDENTIALITY',
    'EXCLUSIVITY',
    'OTHER_PROCESS_AGREEMENT',
    'STANDSTILL',
  ]);
  assert.equal(agreement.party_contract.party_names_cannot_create_relationships, true);
  assert.equal(agreement.version_contract.silent_revision_overwrite_permitted, false);
  assert.equal(agreement.version_contract.amendment_and_supersession_preserve_history, true);
  assert.equal(agreement.version_contract.exact_drafting_retained_through_process_passages, true);
  assert.equal(agreement.version_contract.process_passage_definition_stable_id, 'PROCESS_PASSAGE');
});

test('keeps Process relationships typed, directional and non-destructive', () => {
  const relationship = definition(members(), 'PROCESS_RELATIONSHIP');

  assert.equal(
    relationship.relationship_identity.stable_id_inputs.includes(
      'source_process_object_kind_and_id',
    ),
    true,
  );
  assert.equal(
    relationship.relationship_identity.stable_id_inputs.includes(
      'target_process_object_kind_and_id',
    ),
    true,
  );
  assert.equal(relationship.endpoint_contract.same_frozen_contract_pair_required, true);
  assert.equal(relationship.endpoint_contract.same_governed_deal_required, true);
  assert.equal(relationship.relationship_type_contract.direction_required, true);
  assert.equal(relationship.semantic_contract.continuation_merges_source_objects, false);
  assert.equal(relationship.semantic_contract.retelling_deletes_or_merges_source_object, false);
  assert.equal(
    relationship.semantic_contract.retelling_automatically_creates_new_market_observation,
    false,
  );
  assert.equal(relationship.semantic_contract.amendment_and_supersession_preserve_history, true);
});

test('makes ProcessPassage exact, citable and expandable without silent release changes', () => {
  const passage = definition(members(), 'PROCESS_PASSAGE');

  assert.equal(passage.source_contract.coordinate_space, 'ADMITTED_SOURCE_UTF8_BYTES');
  assert.equal(passage.source_contract.clipped_or_reconstructed_text_permitted, false);
  assert.equal(passage.source_contract.source_intervals_fixed_before_candidate_values, true);
  assert.equal(passage.role_contract.actual_drafting_role_supported, true);
  assert.equal(passage.role_contract.summary_cannot_substitute_for_actual_drafting, true);
  assert.equal(passage.citation_contract.exact_release_identity_required, true);
  assert.equal(passage.citation_contract.silent_redirect_to_newer_release_permitted, false);
  assert.equal(passage.citation_contract.stale_release_requires_explicit_rerun_action, true);
  assert.equal(passage.context_contract.show_more_is_repeat_clickable, true);
  assert.equal(passage.context_contract.each_show_more_expands_monotonically, true);
  assert.equal(passage.context_contract.show_less_reverses_one_expansion_step, true);
  assert.equal(passage.context_contract.related_passages_require_typed_relationships, true);
  assert.equal(
    passage.context_contract.bounded_inline_preview_definition_stable_id,
    'BOUNDED_INLINE_PASSAGE_PREVIEW',
  );
  assert.equal(
    passage.context_contract.parent_bound_paragraph_context_definition_stable_id,
    'PARENT_BOUND_PARAGRAPH_CONTEXT',
  );
  assert.equal(
    passage.context_contract.related_passage_collection_stable_id,
    'RELATED_PASSAGE_CHILD_COLLECTION',
  );
});

test('grants none of the four definitions runtime or downstream authority', () => {
  const values = members();
  for (const stableId of [
    'PROCESS_AGREEMENT',
    'PROCESS_PASSAGE',
    'PROCESS_POSITION',
    'PROCESS_RELATIONSHIP',
  ]) {
    const definitionValue = definition(values, stableId);
    assert.equal(definitionValue.writer_action.current_release_writer_path, false);
    assert.equal(definitionValue.writer_action.definition_grants_execution_authority, false);
    assert.equal(Object.values(definitionValue.authority_contract).every(
      (authority) => authority === false,
    ), true);
  }
});

test('rejects semantic drift in each complete governed definition', () => {
  const cases = [
    {
      stableId: 'PROCESS_POSITION',
      code: 'INVALID_PROCESS_POSITION_INPUT',
      mutate(definitionValue) {
        definitionValue.position_value_contract.silence_can_create_express_refusal = true;
      },
    },
    {
      stableId: 'PROCESS_AGREEMENT',
      code: 'INVALID_PROCESS_AGREEMENT_INPUT',
      mutate(definitionValue) {
        definitionValue.version_contract.silent_revision_overwrite_permitted = true;
      },
    },
    {
      stableId: 'PROCESS_RELATIONSHIP',
      code: 'INVALID_PROCESS_RELATIONSHIP_INPUT',
      mutate(definitionValue) {
        definitionValue.semantic_contract.retelling_deletes_or_merges_source_object = true;
      },
    },
    {
      stableId: 'PROCESS_PASSAGE',
      code: 'INVALID_PROCESS_PASSAGE_INPUT',
      mutate(definitionValue) {
        definitionValue.citation_contract.silent_redirect_to_newer_release_permitted = true;
      },
    },
  ];

  for (const driftCase of cases) {
    const changed = clone(members());
    driftCase.mutate(definition(changed, driftCase.stableId));
    assert.throws(
      () => validateAuthoredProcessInputs(changed),
      (error) => error.code === driftCase.code,
    );
  }
});

test('is mechanically complete and grants no contract-freeze authority', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });

  assert.equal(compiled.authored_members.length, 173);
  assert.equal(
    compiled.disposition.status,
    'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE',
  );
  assert.equal(compiled.disposition.freeze_eligible, false);
  assert.equal(compiled.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(compiled.disposition.p1_gate_status, 'NOT_EVALUATED');
});
