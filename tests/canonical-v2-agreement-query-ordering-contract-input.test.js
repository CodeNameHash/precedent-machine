const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AGREEMENT_QUERY_ORDERING_CONTRACT_DEFINITIONS,
  AGREEMENT_QUERY_ORDERING_CONTRACT_IDS,
  AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_KIND,
  AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_SCHEMA,
  validateAuthoredAgreementQueryOrderingInputs,
} = require(
  '../lib/canonical-v2/'
    + 'agreement-query-ordering-contract-input-validator',
);

const CONTRACT_PATH = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/agreement/query/'
    + 'agreement-comparable-result-ordering.v1.json',
);

function loadValue() {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

function loadMembers() {
  const canonicalValue = loadValue();
  return [{
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  }];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers one closed Agreement comparable-result ordering contract', () => {
  const members = loadMembers();
  assert.doesNotThrow(
    () => validateAuthoredAgreementQueryOrderingInputs(members),
  );
  assert.deepEqual(
    AGREEMENT_QUERY_ORDERING_CONTRACT_IDS,
    ['AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION'],
  );
  assert.equal(
    members[0].canonical_value.object_kind,
    AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_KIND,
  );
  assert.equal(
    members[0].canonical_value.schema_version,
    AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT_SCHEMA,
  );
  assert.equal(
    AGREEMENT_QUERY_ORDERING_CONTRACT_DEFINITIONS
      .AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION
      .definition_digest,
    '17eb9ac896e0898febaf06618b6cbf0d23b43b9fedcbd204be325c52af8d8df0',
  );
});

test('binds the exact Product query, release, catalogue and candidate set', () => {
  const binding = loadValue().definition
    .query_release_binding_contract;

  assert.equal(binding.exact_product_query_definition_id_required, true);
  assert.equal(binding.exact_approved_pm_data_version_id_required, true);
  assert.equal(
    binding.exact_candidate_release_manifest_id_and_payload_digest_required,
    true,
  );
  assert.equal(
    binding.exact_product_field_catalogue_id_and_payload_digest_required,
    true,
  );
  assert.equal(
    binding.exact_ordered_sort_vector_and_direction_required,
    true,
  );
  assert.equal(
    binding.exact_diversity_definition_id_and_payload_digest_required,
    true,
  );
  assert.equal(binding.complete_candidate_set_required, true);
  assert.equal(binding.candidate_can_move_between_query_or_release, false);
});

test('admits exactly five typed comparators and rejects professional sorting', () => {
  const definition = loadValue().definition;
  const comparison = definition.typed_comparison_contract;
  const registry = definition.typed_comparator_registry;

  assert.deepEqual(comparison.sortable_value_types, [
    'DEAL_REFERENCE',
    'DATE',
    'ENTITY_REFERENCE',
    'MONEY_WITH_BASIS',
    'ENUM',
  ]);
  assert.deepEqual(
    registry.map((entry) => entry.value_type),
    comparison.sortable_value_types,
  );
  assert.deepEqual(
    comparison.non_sortable_value_types,
    ['PROFESSIONAL_ASSIGNMENT'],
  );
  assert.equal(
    comparison.unsupported_sort_disposition,
    'SORT_FIELD_TYPE_NOT_SUPPORTED',
  );
  assert.equal(comparison.generic_canonical_json_comparison_permitted, false);
  assert.equal(comparison.locale_dependent_comparison_permitted, false);
  assert.equal(comparison.implicit_type_coercion_permitted, false);
});

test('defines exact reference, date, money and enum projection components', () => {
  const registry = new Map(
    loadValue().definition.typed_comparator_registry.map(
      (entry) => [entry.value_type, entry],
    ),
  );

  assert.deepEqual(
    registry.get('DEAL_REFERENCE').required_projection_components,
    ['governed_deal_id'],
  );
  assert.deepEqual(
    registry.get('DATE').required_projection_components,
    ['iso_8601_calendar_date'],
  );
  assert.deepEqual(
    registry.get('ENTITY_REFERENCE').required_projection_components,
    ['governed_entity_id'],
  );
  assert.deepEqual(
    registry.get('MONEY_WITH_BASIS').required_projection_components,
    [
      'value_basis_code',
      'iso_4217_currency_code',
      'canonical_decimal_amount',
    ],
  );
  assert.deepEqual(
    registry.get('ENUM').required_projection_components,
    ['ordered_governed_enum_codes'],
  );
});

test('keeps missing states after values and outside sort direction', () => {
  const missing = loadValue().definition.missing_state_contract;
  const comparison = loadValue().definition.typed_comparison_contract;

  assert.equal(missing.comparable_value_state, 'COMPARABLE_VALUE');
  assert.deepEqual(missing.typed_missing_states_in_fixed_order, [
    'CONFLICT',
    'KNOWN_MISSING',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'UNKNOWN',
  ]);
  assert.equal(missing.comparable_values_precede_typed_missing_states, true);
  assert.equal(missing.sort_direction_can_reverse_missing_state_order, false);
  assert.equal(
    missing.missing_state_can_be_recast_as_string_number_date_enum_or_reference,
    false,
  );
  assert.equal(
    missing.failed_or_unavailable_result_can_be_recast_as_sort_value,
    false,
  );
  assert.equal(missing.ordering_failure_state, 'ORDERING_UNAVAILABLE');
  assert.equal(
    missing.ordering_failures_follow_all_comparable_and_typed_missing_candidates,
    true,
  );
  assert.equal(
    missing.ordering_failure_order,
    'AGREEMENT_COMPARABLE_RESULT_IDENTITY_UTF8_ASC',
  );
  assert.equal(comparison.direction_applies_to_comparable_values_only, true);
});

test('uses a total comparator before stable deal diversification', () => {
  const definition = loadValue().definition;
  const comparator = definition.total_comparator_contract;
  const diversity = definition.diversification_contract;

  assert.deepEqual(comparator.comparison_sequence, [
    'ORDERED_QUERY_SORT_FIELDS',
    'AGREEMENT_COMPARABLE_RESULT_IDENTITY_UTF8',
  ]);
  assert.equal(comparator.each_sort_field_uses_field_catalogue_value_type, true);
  assert.equal(comparator.each_sort_field_uses_query_direction, true);
  assert.equal(comparator.result_identity_tie_breaker_is_always_ascending, true);
  assert.equal(comparator.total_order_required_before_diversification, true);
  assert.equal(
    diversity.algorithm,
    'STABLE_GOVERNED_DEAL_ROUND_ROBIN_OVER_TOTAL_ORDER/V1',
  );
  assert.equal(diversity.bucket_key, 'governed_deal_admission_id');
  assert.equal(diversity.within_bucket_total_order_preserved, true);
  assert.equal(
    diversity.ordering_unavailable_candidates_participate_in_diversity,
    false,
  );
  assert.equal(
    diversity.ordering_unavailable_candidates_append_after_diversified_candidates,
    true,
  );
  assert.equal(diversity.candidate_can_be_padded_or_repeated, false);
  assert.equal(diversity.candidate_can_be_silently_removed, false);
});

test('excludes caller, database, display and locale ordering authority', () => {
  const definition = loadValue().definition;
  const facts = definition.ordering_fact_contract;
  const identity = definition.projection_identity_contract;

  assert.deepEqual(facts.permitted_fact_states, [
    'VALIDATED_SORT_PROJECTION',
    'ORDERING_UNAVAILABLE',
  ]);
  assert.equal(
    facts.unavailable_fact_requires_typed_failure_identity_and_disposition,
    true,
  );
  assert.equal(facts.unavailable_fact_can_contain_sort_projection, false);
  assert.equal(facts.caller_rank_or_ordinal_permitted, false);
  assert.equal(facts.caller_comparator_callback_permitted, false);
  assert.equal(facts.caller_validity_boolean_permitted, false);
  assert.equal(facts.display_label_or_locale_value_permitted, false);
  assert.equal(facts.free_standing_digest_is_ordering_authority, false);
  assert.deepEqual(identity.prohibited_identity_inputs, [
    'application_row_order',
    'caller_rank',
    'database_row_order',
    'display_label',
    'locale',
    'render_timestamp',
  ]);
});

test('fails typed and retains exact failure and valid siblings', () => {
  const failure = loadValue().definition.failure_contract;

  assert.equal(failure.unsupported_sort_type_fails_typed, true);
  assert.equal(
    failure.invalid_sort_projection_emits_typed_ordering_failure,
    true,
  );
  assert.equal(failure.failed_candidate_remains_in_projection_membership, true);
  assert.equal(
    failure.failed_candidate_uses_stable_post_diversity_order,
    true,
  );
  assert.equal(
    failure.duplicate_missing_or_substituted_candidate_fails_projection,
    true,
  );
  assert.equal(
    failure.query_release_catalogue_sort_or_diversity_drift_fails_projection,
    true,
  );
  assert.equal(failure.one_failed_candidate_keeps_valid_siblings_available, true);
  assert.equal(failure.failed_candidate_identity_and_disposition_retained, true);
  assert.equal(failure.operational_failure_can_be_returned_as_empty_result, false);
});

test('grants no runtime, query, data, write or production authority', () => {
  const values = Object.values(
    loadValue().definition.authority_contract,
  );
  assert.equal(values.length, 16);
  assert.equal(values.every((value) => value === false), true);
});

test('rejects missing, duplicate and unregistered members', () => {
  assert.doesNotThrow(
    () => validateAuthoredAgreementQueryOrderingInputs([]),
  );

  const duplicate = [
    ...loadMembers(),
    ...loadMembers(),
  ];
  assert.throws(
    () => validateAuthoredAgreementQueryOrderingInputs(duplicate),
    {
      code: 'AGREEMENT_QUERY_ORDERING_CONTRACT_MEMBERSHIP_MISMATCH',
    },
  );

  const unknown = loadMembers();
  unknown[0].canonical_value.stable_id =
    'UNREGISTERED_AGREEMENT_ORDERING';
  assert.throws(
    () => validateAuthoredAgreementQueryOrderingInputs(unknown),
    {
      code: 'AGREEMENT_QUERY_ORDERING_CONTRACT_MEMBERSHIP_MISMATCH',
    },
  );
});

test('rejects every tested semantic weakening of the complete definition', () => {
  const changes = [
    (definition) => {
      definition.typed_comparison_contract.sortable_value_types
        .push('PROFESSIONAL_ASSIGNMENT');
    },
    (definition) => {
      definition.typed_comparison_contract
        .generic_canonical_json_comparison_permitted = true;
    },
    (definition) => {
      definition.typed_comparator_registry[3].comparator =
        'DECIMAL_AMOUNT_ONLY';
    },
    (definition) => {
      definition.missing_state_contract
        .typed_missing_states_in_fixed_order.reverse();
    },
    (definition) => {
      definition.missing_state_contract
        .sort_direction_can_reverse_missing_state_order = true;
    },
    (definition) => {
      definition.total_comparator_contract.comparison_sequence.pop();
    },
    (definition) => {
      definition.diversification_contract.algorithm =
        'CALLER_RANK/V1';
    },
    (definition) => {
      definition.diversification_contract
        .ordering_unavailable_candidates_append_after_diversified_candidates =
        false;
    },
    (definition) => {
      definition.ordering_fact_contract
        .caller_comparator_callback_permitted = true;
    },
    (definition) => {
      definition.authority_contract.creates_runtime_order = true;
    },
  ];

  for (const change of changes) {
    const members = clone(loadMembers());
    change(members[0].canonical_value.definition);
    assert.throws(
      () => validateAuthoredAgreementQueryOrderingInputs(members),
      { code: 'INVALID_AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT' },
    );
  }
});

test('rejects envelope drift and nested extra fields', () => {
  for (const change of [
    (value) => {
      value.object_kind = 'OTHER_KIND';
    },
    (value) => {
      value.schema_version =
        'AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT/V2';
    },
    (value) => {
      value.definition.contract_version = 2;
    },
    (value) => {
      value.definition.hidden_ordering_authority = false;
    },
  ]) {
    const members = clone(loadMembers());
    change(members[0].canonical_value);
    assert.throws(
      () => validateAuthoredAgreementQueryOrderingInputs(members),
    );
  }
});

test('contains no runtime order, query, source, network or database path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/'
        + 'agreement-query-ordering-contract-input-validator.js',
    ),
    'utf8',
  );
  for (const prohibited of [
    'fetch(',
    'XMLHttpRequest',
    'supabase',
    'openai',
    'anthropic',
    'readFile',
    'writeFile',
    '.sort((left, right)',
    'localeCompare',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});

test('uses the exact reserved four-file allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/'
        + 'wp-agreement-comparable-result-ordering-contract-v1.json',
    ),
    'utf8',
  ));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/'
      + 'wp-agreement-comparable-result-ordering-contract-v1.json',
    'contracts/canonical-v2/successor/agreement/query/'
      + 'agreement-comparable-result-ordering.v1.json',
    'lib/canonical-v2/'
      + 'agreement-query-ordering-contract-input-validator.js',
    'tests/canonical-v2-'
      + 'agreement-query-ordering-contract-input.test.js',
  ]);
});
