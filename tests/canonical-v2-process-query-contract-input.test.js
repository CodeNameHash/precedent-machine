const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessQueryInputs,
} = require('../lib/canonical-v2/process-query-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function queryMembers() {
  return [
    loadMember('process/query/process-ask-query-compiler.v1.json'),
    loadMember('process/query/process-browse-query-compiler.v1.json'),
    loadMember('process/query/process-query-ir.v1.json'),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(members, stableId) {
  return members.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('validates the closed Process Query IR and Ask/Browse compiler set', () => {
  const members = queryMembers();
  assert.doesNotThrow(() => validateAuthoredProcessQueryInputs(members));
  assert.deepEqual(
    members.map((member) => member.canonical_value.stable_id),
    [
      'PROCESS_ASK_QUERY_COMPILER',
      'PROCESS_BROWSE_QUERY_COMPILER',
      'PROCESS_QUERY_IR',
    ],
  );
});

test('binds one PM-wide Query IR to release, legal semantics and exact evidence', () => {
  const query = byId(queryMembers(), 'PROCESS_QUERY_IR');

  assert.equal(query.query_ir_contract.one_pm_wide_query_door_required, true);
  assert.equal(query.query_ir_contract.exactly_one_domain_plan_required, true);
  assert.equal(
    query.query_ir_contract.equivalent_semantics_require_byte_equivalent_query_ir,
    true,
  );
  assert.equal(
    query.release_contract.exact_approved_pm_data_version_required,
    true,
  );
  assert.equal(
    query.release_contract
      .exact_product_field_catalogue_manifest_id_and_digest_required,
    true,
  );
  assert.equal(
    query.semantic_contract
      .exact_certified_predicate_stable_id_and_revision_required,
    true,
  );
  assert.equal(
    query.semantic_contract.exact_result_definition_stable_id_and_version_required,
    true,
  );
  assert.equal(
    query.semantic_contract.exact_evidence_requirements_required,
    true,
  );
  assert.equal(query.semantic_contract.unadmitted_predicate_permitted, false);
});

test('rejects raw storage queries and preserves field scope and unknown states', () => {
  const query = byId(queryMembers(), 'PROCESS_QUERY_IR');
  const filters = query.cohort_and_filter_contract;

  assert.deepEqual(filters.field_scope_preserved, [
    'SAME_DEAL',
    'SAME_EVENT',
    'SAME_BIDDER_TRACK',
    'SAME_COMPONENT',
  ]);
  assert.deepEqual(filters.repeatable_set_semantics, [
    'EXISTS',
    'NONE',
    'NON_VACUOUS_ALL',
    'CANONICAL_SET',
    'GOVERNED_REDUCER',
  ]);
  assert.equal(filters.three_valued_completeness_required, true);
  assert.equal(filters.unknown_or_unexamined_cannot_equal_empty, true);
  assert.equal(filters.physical_database_field_permitted, false);
  assert.equal(filters.raw_sql_permitted, false);
});

test('makes Ask deterministic, checked and incapable of silent substitution', () => {
  const ask = byId(queryMembers(), 'PROCESS_ASK_QUERY_COMPILER');

  assert.equal(ask.compiler_contract.deterministic_and_bounded, true);
  assert.equal(ask.compiler_contract.narrative_llm_permitted, false);
  assert.deepEqual(ask.mapping_contract.required_positive_classes, [
    'PRACTITIONER_PHRASE',
    'DRAFTING_SYNONYM',
    'ABBREVIATION',
    'ORDINARY_MISSPELLING',
  ]);
  assert.deepEqual(ask.mapping_contract.required_boundary_classes, [
    'LEGALLY_ADJACENT_NEGATIVE',
    'AMBIGUOUS_LEGAL_PHRASE',
    'UNSUPPORTED_PHRASE',
  ]);
  assert.equal(ask.mapping_contract.independent_enumeration_required, true);
  assert.equal(ask.mapping_contract.handwritten_lexicon_alone_can_certify, false);
  assert.equal(ask.outcome_contract.ambiguous_output_requires_legal_choice, true);
  assert.equal(ask.outcome_contract.unsupported_output_can_execute_query, false);
  assert.equal(
    ask.outcome_contract.nearest_predicate_substitution_permitted,
    false,
  );
});

test('makes Browse dynamic and prevents display-only, All and cross-domain queries', () => {
  const browse = byId(queryMembers(), 'PROCESS_BROWSE_QUERY_COMPILER');

  assert.deepEqual(browse.navigation_input_contract.hierarchy, [
    'DOMAIN',
    'TOPIC',
    'PATTERN',
  ]);
  assert.equal(
    browse.navigation_input_contract.selected_topic_controls_pattern_membership,
    true,
  );
  assert.equal(
    browse.navigation_input_contract.pattern_must_bind_one_real_admitted_predicate,
    true,
  );
  assert.equal(browse.navigation_input_contract.display_only_label_permitted, false);
  assert.equal(
    browse.navigation_input_contract.fixed_topic_or_pattern_list_in_compiler_permitted,
    false,
  );
  assert.equal(
    browse.all_and_domain_boundary_contract.all_view_can_compile_union_query,
    false,
  );
  assert.equal(
    browse.all_and_domain_boundary_contract
      .all_view_can_combine_domain_result_rows,
    false,
  );
  assert.equal(
    browse.all_and_domain_boundary_contract.cross_domain_boolean_query_permitted,
    false,
  );
});

test('requires Ask and Browse byte equivalence for the same legal query', () => {
  const members = queryMembers();
  const ask = byId(members, 'PROCESS_ASK_QUERY_COMPILER');
  const browse = byId(members, 'PROCESS_BROWSE_QUERY_COMPILER');
  const query = byId(members, 'PROCESS_QUERY_IR');

  assert.deepEqual(
    ask.equivalence_contract.semantic_equivalence_inputs,
    browse.equivalence_contract.semantic_equivalence_inputs,
  );
  assert.equal(
    ask.equivalence_contract
      .same_semantic_inputs_as_browse_require_same_query_definition_id,
    true,
  );
  assert.equal(
    ask.equivalence_contract
      .same_semantic_inputs_as_browse_require_byte_equivalent_query_ir,
    true,
  );
  assert.equal(
    browse.equivalence_contract
      .same_semantic_inputs_as_ask_require_same_query_definition_id,
    true,
  );
  assert.equal(
    browse.equivalence_contract
      .same_semantic_inputs_as_ask_require_byte_equivalent_query_ir,
    true,
  );
  assert.equal(
    query.identity_contract.prohibited_identity_inputs.includes('source_entry_mode'),
    true,
  );
  assert.equal(
    query.identity_contract.prohibited_identity_inputs.includes('raw_ask_text'),
    true,
  );
  assert.equal(
    query.identity_contract.prohibited_identity_inputs.includes('browse_display_label'),
    true,
  );
});

test('grants no runtime, execution, data, UI, release or production authority', () => {
  for (const member of queryMembers()) {
    const authority = member.canonical_value.definition.authority_contract;
    assert.equal(Object.values(authority).every((value) => value === false), true);
  }
});

test('rejects missing, unregistered and semantically weakened query contracts', () => {
  assert.throws(
    () => validateAuthoredProcessQueryInputs(queryMembers().slice(1)),
    (error) => error.code === 'PROCESS_QUERY_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const unknown = clone(queryMembers());
  unknown[0].canonical_value.stable_id = 'UNREGISTERED_QUERY_COMPILER';
  assert.throws(
    () => validateAuthoredProcessQueryInputs(unknown),
    (error) => error.code === 'PROCESS_QUERY_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const substituted = clone(queryMembers());
  byId(
    substituted,
    'PROCESS_ASK_QUERY_COMPILER',
  ).outcome_contract.nearest_predicate_substitution_permitted = true;
  assert.throws(
    () => validateAuthoredProcessQueryInputs(substituted),
    (error) => error.code === 'INVALID_PROCESS_ASK_QUERY_COMPILER_INPUT',
  );

  const displayOnly = clone(queryMembers());
  byId(
    displayOnly,
    'PROCESS_BROWSE_QUERY_COMPILER',
  ).navigation_input_contract.display_only_label_permitted = true;
  assert.throws(
    () => validateAuthoredProcessQueryInputs(displayOnly),
    (error) => error.code === 'INVALID_PROCESS_BROWSE_QUERY_COMPILER_INPUT',
  );

  const rawSql = clone(queryMembers());
  byId(
    rawSql,
    'PROCESS_QUERY_IR',
  ).cohort_and_filter_contract.raw_sql_permitted = true;
  assert.throws(
    () => validateAuthoredProcessQueryInputs(rawSql),
    (error) => error.code === 'INVALID_PROCESS_QUERY_IR_INPUT',
  );

  const authority = clone(queryMembers());
  byId(
    authority,
    'PROCESS_QUERY_IR',
  ).authority_contract.creates_query_execution_authority = true;
  assert.throws(
    () => validateAuthoredProcessQueryInputs(authority),
    (error) => error.code === 'INVALID_PROCESS_QUERY_IR_INPUT',
  );
});
