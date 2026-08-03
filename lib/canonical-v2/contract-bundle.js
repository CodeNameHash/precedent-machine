const { canonicalJson, contentId } = require('./canonical-bytes');

// SPEC-VERSIONED-CONTRACT-2026-07-23: a reviewed artifact is bound to the
// contract it was reviewed under, forever. FIXTURE_CONTRACT_INPUT_V1 is the
// EXACT input every existing reviewed-*-slice.js oracle and its pinned
// digests were built against -- byte-identical to the pre-versioning input,
// frozen, never edited again. New vocabulary is added only via a newer
// version constant (see FIXTURE_CONTRACT_INPUT_V2 below); compileFixtureContract()'s
// DEFAULT stays V1 so every existing caller and digest is untouched.
const FIXTURE_CONTRACT_INPUT_V1 = Object.freeze({
  schema_version: 'FIXTURE_CONTRACT_INPUT/V1',
  contract_key: 'CANONICAL_V2_VERTICAL_SLICE',
  concepts: Object.freeze([
    Object.freeze({ concept_key: 'COND-B-REP', version: 1 }),
    Object.freeze({ concept_key: 'IOC-CAPEX', version: 1 }),
    Object.freeze({ concept_key: 'IOC-GENERAL-EXCEPT', version: 1 }),
    Object.freeze({ concept_key: 'NOSOL-EXCEPT', version: 1 }),
    Object.freeze({ concept_key: 'NOSOL-MATCH', version: 1 }),
    Object.freeze({ concept_key: 'NOSOL-NOTICE', version: 1 }),
    Object.freeze({ concept_key: 'NOSOL-PROHIBIT', version: 1 }),
    Object.freeze({ concept_key: 'NOSOL-REMATCH', version: 1 }),
    Object.freeze({ concept_key: 'REP-T-CAP', version: 1 }),
    Object.freeze({ concept_key: 'REP-T-CONTRACTS', version: 1 }),
    Object.freeze({ concept_key: 'TERMF-TAIL', version: 1 }),
    Object.freeze({ concept_key: 'TERMF-TARGET', version: 1 }),
    Object.freeze({ concept_key: 'TERMR-RECOMMEND', version: 1 }),
    Object.freeze({ concept_key: 'TERMR-SUPERIOR', version: 1 }),
  ]),
  component_definitions: Object.freeze([
    Object.freeze({ component_key: 'COVENANT_LIMB', version: 1 }),
    Object.freeze({ component_key: 'EXCEPTION_LIMB', version: 1 }),
    Object.freeze({ component_key: 'FEE_AMOUNT_LIMB', version: 1 }),
    Object.freeze({ component_key: 'MATCH_PERIOD_LIMB', version: 1 }),
    Object.freeze({ component_key: 'MATERIAL_CONTRACT_CRITERION', version: 1 }),
    Object.freeze({ component_key: 'NOTICE_LIMB', version: 1 }),
    Object.freeze({ component_key: 'REPRESENTATION_LIMB', version: 1 }),
    Object.freeze({ component_key: 'RESTRICTED_ACTION', version: 1 }),
    Object.freeze({ component_key: 'TERMINATION_TRIGGER_LIMB', version: 1 }),
  ]),
  relationship_definitions: Object.freeze([
    Object.freeze({ relationship_key: 'BRINGS_DOWN', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 }),
    Object.freeze({ relationship_key: 'CONTAINED_IN', effect_mode: 'NON_SEMANTIC', version: 1 }),
    Object.freeze({ relationship_key: 'EXCEPTED_BY', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 }),
    Object.freeze({ relationship_key: 'TRIGGERED_BY', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 }),
    Object.freeze({ relationship_key: 'USES_DEFINITION', effect_mode: 'TYPED_LEGAL_EFFECT', version: 1 }),
  ]),
  claim_definitions: Object.freeze([
    Object.freeze({
      claim_definition_key: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'KNOWLEDGE_QUALIFIER',
      version: 1,
      allowed_canonical_values: Object.freeze([true]),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
      version: 1,
      allowed_canonical_values: Object.freeze([
        'BEFORE_STOCKHOLDER_APPROVAL',
        'NO_PRIOR_BREACH',
        'CONFIDENTIALITY_AGREEMENT_NO_LESS_FAVOURABLE',
        'BUYER_RECEIVES_INFORMATION_CONCURRENTLY',
        'BOARD_GOOD_FAITH_DETERMINATION',
        'EXPECTED_TO_LEAD_TO_SUPERIOR_PROPOSAL',
        'FIDUCIARY_DUTIES_REQUIRE_ACTION',
      ]),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
      version: 1,
      allowed_canonical_values: Object.freeze([
        'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
        'ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS',
        'CHANGE_RECOMMENDATION',
        'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
        'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
      ]),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
      version: 1,
      allowed_canonical_values: Object.freeze(['DE_MINIMIS_INACCURACIES']),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      version: 1,
      allowed_canonical_values: Object.freeze([
        'MAT_ALL_RESPECTS',
        'MAT_ALL_RESPECTS_DE_MINIMIS',
        'MAT_ALL_MATERIAL',
        'MAT_MAE_QUALIFIED',
      ]),
      canonical_value_required_when_present: true,
    }),
    Object.freeze({
      claim_definition_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      version: 1,
      canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
      canonical_value_required_when_present: true,
    }),
  ]),
  claim_states: Object.freeze([
    'PRESENT',
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ]),
  party_tuple_fields: Object.freeze(['role', 'value', 'capacity']),
  residual_reason_codes: Object.freeze([
    'UNKNOWN_ATTRIBUTE',
    'INVALID_TAXONOMY_CODE',
    'PRESENT_WITHOUT_EVIDENCE',
    'ABSENT_WITHOUT_COMPLETE_SCOPE',
    'NON_PRESENT_ASSERTED_VALUE',
    'PRESENT_WITHOUT_RESOLVED_TARGET',
    'PRESENT_WITHOUT_EFFECT',
    'STATE_DETAIL_REQUIRED',
    'INVALID_CANONICAL_VALUE',
    'CANONICAL_IDENTITY_MISMATCH',
    'EVIDENCE_REFERENCE_UNRESOLVED',
    'SEMANTIC_REFERENCE_UNRESOLVED',
  ]),
  serving_exact_detail_actions: Object.freeze([
    Object.freeze({
      action_slot_key: 'ACCURACY_STANDARD_CLAIM_EVIDENCE',
      action_version: 1,
      parent_kind: 'RESULT_ROW',
      detail_kind: 'CLAIM_EVIDENCE',
      selection_path_schema: 'RESULT_COMPONENT_CLAIM_EVIDENCE/V1',
      contextual_cardinality: 'EXACTLY_ONE',
      comparator: 'COMPONENT_ORDINAL_THEN_EVIDENCE_ORDINAL',
      duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
      maximum_references: 1,
      maximum_encoded_bytes: 16384,
      whole_document_permission: false,
      object_authorisation_predicate: 'PARENT_SELECTED_CLAIM_EVIDENCE_ONLY',
      route: 'INLINE_BATCH',
      response_schema: 'SERVING_EXACT_DETAIL_CLAIM_EVIDENCE_RESPONSE/V1',
      projection_version: 1,
    }),
    Object.freeze({
      action_slot_key: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
      action_version: 1,
      parent_kind: 'RESULT_ROW',
      detail_kind: 'CLAIM_EVIDENCE',
      selection_path_schema: 'RESULT_COMPONENT_CLAIM_EVIDENCE/V1',
      contextual_cardinality: 'EXACTLY_ONE',
      comparator: 'COMPONENT_ORDINAL_THEN_EVIDENCE_ORDINAL',
      duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
      maximum_references: 1,
      maximum_encoded_bytes: 16384,
      whole_document_permission: false,
      object_authorisation_predicate: 'PARENT_SELECTED_CLAIM_EVIDENCE_ONLY',
      route: 'INLINE_BATCH',
      response_schema: 'SERVING_EXACT_DETAIL_CLAIM_EVIDENCE_RESPONSE/V1',
      projection_version: 1,
    }),
    Object.freeze({
      action_slot_key: 'RESULT_COMPOSITION_EVIDENCE',
      action_version: 1,
      parent_kind: 'RESULT_ROW',
      detail_kind: 'RESULT_COMPOSITION_EVIDENCE',
      selection_path_schema: 'RESULT_COMPOSITION_SOURCE_CLOSURE/V1',
      contextual_cardinality: 'EXACTLY_ONE',
      comparator: 'COMPONENT_ORDINAL_THEN_RELATIONSHIP_THEN_SOURCE_ORDER',
      duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
      maximum_references: 1,
      maximum_encoded_bytes: 16384,
      whole_document_permission: false,
      object_authorisation_predicate: 'PARENT_SELECTED_RESULT_COMPOSITION_ONLY',
      route: 'INLINE_BATCH',
      response_schema: 'SERVING_EXACT_DETAIL_RESULT_COMPOSITION_RESPONSE/V1',
      projection_version: 1,
    }),
    Object.freeze({
      action_slot_key: 'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE',
      action_version: 1,
      parent_kind: 'REVIEWED_SOURCE_SPECIFIC_ROW',
      detail_kind: 'OPEN_WORLD_EVIDENCE',
      selection_path_schema: 'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE/V1',
      contextual_cardinality: 'EXACTLY_ONE',
      comparator: 'EVIDENCE_ORDINAL',
      duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
      maximum_references: 1,
      maximum_encoded_bytes: 16384,
      whole_document_permission: false,
      object_authorisation_predicate: 'PARENT_SELECTED_OPEN_WORLD_EVIDENCE_ONLY',
      route: 'INLINE_BATCH',
      response_schema: 'SERVING_EXACT_DETAIL_OPEN_WORLD_EVIDENCE_RESPONSE/V1',
      projection_version: 1,
    }),
  ]),
  parser_proposal_boundary: Object.freeze({
    adapter_key: 'PARSER_V2_STRUCTURAL_DEFINITION_PROPOSAL',
    adapter_version: 1,
    allowed_proposal_kinds: Object.freeze(['STRUCTURAL_SECTION', 'DEFINITION_CANDIDATE']),
    canonical_write_permission: false,
    absence_decision_permission: false,
    comparability_decision_permission: false,
    semantic_identity_permission: false,
    exact_evidence_required: true,
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    source_transform: 'PARSER_V2_TEXT_LAYERS/V1',
  }),
});

// Back-compat alias: every existing caller that imports FIXTURE_CONTRACT_INPUT
// (directly, or via compileFixtureContract()'s default parameter) keeps
// compiling F1, unchanged.
const FIXTURE_CONTRACT_INPUT = FIXTURE_CONTRACT_INPUT_V1;

// Ben-approved 2026-07-23 (docs/handoffs/SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md),
// naming per the frozen style (TERMR-SUPERIOR, TERMR-RECOMMEND, TERMF-TAIL).
// Adding these to FIXTURE_CONTRACT_INPUT_V1 directly would move F1 and
// invalidate every reviewed-*-slice.js module's pinned digest -- instead they
// exist ONLY in this new version constant.
const V2_ADDED_CONCEPTS = Object.freeze([
  // Termination right for material breach of the no-solicitation covenant.
  Object.freeze({ concept_key: 'TERMR-NOSOL-BREACH', version: 1 }),
  // General termination right for counterparty covenant/representation
  // breach, bring-down/MAE-gated.
  Object.freeze({ concept_key: 'TERMR-BREACH', version: 1 }),
  // Termination right for failure of the stockholder vote.
  Object.freeze({ concept_key: 'TERMR-NOVOTE', version: 1 }),
  // Outside-date termination right.
  Object.freeze({ concept_key: 'TERMR-OUTSIDE', version: 1 }),
]);

// V1 + the four Ben-approved concepts above; everything else identical to
// V1 (proven by the superset-diff test in
// tests/canonical-v2-contract-bundle-versions.test.js). Compiles to F2 via
// compileFixtureContractV2() / compileFixtureContract(FIXTURE_CONTRACT_INPUT_V2).
const FIXTURE_CONTRACT_INPUT_V2 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V1,
  concepts: Object.freeze([...FIXTURE_CONTRACT_INPUT_V1.concepts, ...V2_ADDED_CONCEPTS]),
});

const V3_ADDED_CONCEPTS = Object.freeze([
  Object.freeze({ concept_key: 'TERMF-REVERSE', version: 1 }),
]);
const V3_ADDED_CLAIMS = Object.freeze([
  Object.freeze({
    claim_definition_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    version: 1,
    canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
    canonical_value_required_when_present: true,
  }),
]);
const V3_ADDED_EXACT_DETAIL_ACTIONS = Object.freeze([
  Object.freeze({
    action_slot_key: 'TERMINATION_FEE_TRIGGER_EVIDENCE',
    action_version: 1,
    parent_kind: 'RESULT_ROW',
    detail_kind: 'TERMINATION_FEE_TRIGGER_EVIDENCE',
    selection_path_schema: 'RESULT_TERMINATION_FEE_TRIGGER_SET/V1',
    contextual_cardinality: 'EXACTLY_ONE',
    comparator: 'RELATIONSHIP_ORDINAL_THEN_SOURCE_ORDER',
    duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
    maximum_references: 1,
    maximum_encoded_bytes: 16384,
    whole_document_permission: false,
    object_authorisation_predicate: 'PARENT_SELECTED_TERMINATION_FEE_TRIGGER_SET_ONLY',
    route: 'INLINE_BATCH',
    response_schema: 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V1',
    projection_version: 1,
  }),
]);
const V3_METRIC_OPERATION_BINDINGS = Object.freeze([
  Object.freeze({
    binding_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V1',
    metric_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-REVERSE',
    required_claim_definition_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    relationship_key: 'TRIGGERED_BY',
    legal_operation: 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
    fee_side: 'BUYER',
    payer: Object.freeze({ role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' }),
    payee: Object.freeze({ role: 'FEE_PAYEE', value: 'COMPANY', capacity: 'TARGET' }),
  }),
]);
const FIXTURE_CONTRACT_INPUT_V3 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V2,
  concepts: Object.freeze([...FIXTURE_CONTRACT_INPUT_V2.concepts, ...V3_ADDED_CONCEPTS]),
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V2.claim_definitions,
    ...V3_ADDED_CLAIMS,
  ]),
  serving_exact_detail_actions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V2.serving_exact_detail_actions,
    ...V3_ADDED_EXACT_DETAIL_ACTIONS,
  ]),
  serving_metric_operation_bindings: V3_METRIC_OPERATION_BINDINGS,
});

const TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2 = Object.freeze({
  schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
  schema_version: 2,
  effect_schema: 'TERMINATION_FEE_TRIGGER_EFFECT/V2',
  root_operator: 'ALL_OF',
  expression_operators: Object.freeze(['ALL_OF', 'ANY_OF', 'FACT', 'IF_THEN']),
  indexed_fact_semantics: 'SET_MEMBERSHIP_SEARCH_AID_ONLY',
  maximum_paths: 16,
  maximum_expression_depth: 6,
  maximum_expression_nodes: 32,
  pathway_constraints: Object.freeze([
    Object.freeze({
      pathway_code: 'IMMEDIATE_RECOMMENDATION_CHANGE',
      trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
      terminating_party_rule: 'FEE_PAYEE_VALUE',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: '4d41c1687078d4c1e9a2781d30d0873edd0e4357ea6b2e0643672fd7a7867641',
        SELLER: '4d41c1687078d4c1e9a2781d30d0873edd0e4357ea6b2e0643672fd7a7867641',
      }),
    }),
    Object.freeze({
      pathway_code: 'IMMEDIATE_NO_SOLICIT_BREACH',
      trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
      terminating_party_rule: 'FEE_PAYEE_VALUE',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: '99f4bf3d847c7542df7f673a72e06ee61cfda1e4e1a4f7668e2f8296b2209cce',
        SELLER: '99f4bf3d847c7542df7f673a72e06ee61cfda1e4e1a4f7668e2f8296b2209cce',
      }),
    }),
    Object.freeze({
      pathway_code: 'IMMEDIATE_NO_VOTE_WITH_LATENT_RIGHT',
      trigger_code: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
      terminating_party_rule: 'EITHER_PARTY',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: '8ddb510929dc7f864bbe51de91f24b9a5009d56dd8fd5e6cac5a4603fd9f4d16',
        SELLER: '8ddb510929dc7f864bbe51de91f24b9a5009d56dd8fd5e6cac5a4603fd9f4d16',
      }),
    }),
    Object.freeze({
      pathway_code: 'IMMEDIATE_OUTSIDE_DATE_WITH_LATENT_RIGHT',
      trigger_code: 'OUTSIDE_DATE_TERMINATION',
      terminating_party_rule: 'EITHER_PARTY',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: '177e90b164ca8c597831f7ae43247ae87ddf8348db5b13694035a30235de344e',
        SELLER: '177e90b164ca8c597831f7ae43247ae87ddf8348db5b13694035a30235de344e',
      }),
    }),
    Object.freeze({
      pathway_code: 'TAIL_NO_VOTE',
      trigger_code: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
      terminating_party_rule: 'EITHER_PARTY',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: '27b13897a106645fd0a5a6862a564e5488d6d272cbf8a309f221cdee90e4ff31',
        SELLER: '27b13897a106645fd0a5a6862a564e5488d6d272cbf8a309f221cdee90e4ff31',
      }),
    }),
    Object.freeze({
      pathway_code: 'TAIL_OUTSIDE_DATE',
      trigger_code: 'OUTSIDE_DATE_TERMINATION',
      terminating_party_rule: 'EITHER_PARTY',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: 'e4dc8d3064248f67309580c52636d0cff38f7018d59d9b9bd6dbf7782bce3d80',
        SELLER: 'e4dc8d3064248f67309580c52636d0cff38f7018d59d9b9bd6dbf7782bce3d80',
      }),
    }),
    Object.freeze({
      pathway_code: 'TAIL_NO_SOLICIT_BREACH',
      trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
      terminating_party_rule: 'FEE_PAYEE_VALUE',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: 'e023ec762ee44517cee61c6d54501afa31ab454b71d5ee010e3d0f1ea6c4297d',
        SELLER: 'e023ec762ee44517cee61c6d54501afa31ab454b71d5ee010e3d0f1ea6c4297d',
      }),
    }),
    Object.freeze({
      pathway_code: 'TAIL_OTHER_COVENANT_BREACH',
      trigger_code: 'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
      terminating_party_rule: 'FEE_PAYEE_VALUE',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: 'f530b74d42b903c4e36be0444a5c91594f4880c49609c6af30086edd63513ccc',
        SELLER: 'c4c844109f7012f483f14e9335932500b9486a03beef7a29314c7266618466b6',
      }),
    }),
    Object.freeze({
      pathway_code: 'TAIL_INTERVENING_EVENT_RECOMMENDATION_CHANGE',
      trigger_code: 'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
      terminating_party_rule: 'FEE_PAYEE_VALUE',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
      expression_digest_by_fee_side: Object.freeze({
        BUYER: '1031da3bfe9216a4f530cf3fa05e2270a4e6df204ca6e4c0a870fa518f3d8391',
        SELLER: '1031da3bfe9216a4f530cf3fa05e2270a4e6df204ca6e4c0a870fa518f3d8391',
      }),
    }),
  ]),
  allowed_pathway_codes: Object.freeze([
    'IMMEDIATE_RECOMMENDATION_CHANGE',
    'IMMEDIATE_NO_SOLICIT_BREACH',
    'IMMEDIATE_NO_VOTE_WITH_LATENT_RIGHT',
    'IMMEDIATE_OUTSIDE_DATE_WITH_LATENT_RIGHT',
    'TAIL_NO_VOTE',
    'TAIL_OUTSIDE_DATE',
    'TAIL_NO_SOLICIT_BREACH',
    'TAIL_OTHER_COVENANT_BREACH',
    'TAIL_INTERVENING_EVENT_RECOMMENDATION_CHANGE',
  ]),
  allowed_trigger_codes: Object.freeze([
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'NO_SOLICIT_BREACH_TERMINATION',
    'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    'OUTSIDE_DATE_TERMINATION',
    'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
  ]),
  allowed_terminating_parties: Object.freeze(['COMPANY', 'PARENT', 'EITHER_PARTY']),
  allowed_payment_timings: Object.freeze([
    'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
    'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
  ]),
  allowed_fact_keys: Object.freeze([
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'NO_SOLICIT_BREACH_TERMINATION',
    'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    'OUTSIDE_DATE_TERMINATION',
    'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
    'FEE_PAYEE_COULD_TERMINATE_FOR_CHANGE_IN_RECOMMENDATION',
    'FEE_PAYEE_COULD_TERMINATE_FOR_DIRECT_NO_SOLICIT_BREACH',
    'FEE_PAYEE_COULD_TERMINATE_FOR_GENERAL_BREACH_IN_RESPECT_OF_NO_SOLICIT',
    'FEE_PAYEE_COULD_TERMINATE_ON_OUTSIDE_DATE',
    'FEE_PAYEE_COULD_TERMINATE_FOR_OTHER_COVENANT_BREACH',
    'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED',
    'IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY',
    'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_STOCKHOLDER_MEETING_AND_NOT_WITHDRAWN',
    'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_TERMINATION_AND_NOT_WITHDRAWN',
    'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
    'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    'TERMINATING_PARTY_IS_FEE_PAYER',
  ]),
});
const V4_TERMINATION_FEE_EXACT_DETAIL_ACTION = Object.freeze({
  action_slot_key: 'TERMINATION_FEE_TRIGGER_EVIDENCE',
  action_version: 2,
  parent_kind: 'RESULT_ROW',
  detail_kind: 'TERMINATION_FEE_TRIGGER_EVIDENCE',
  selection_path_schema: 'RESULT_TERMINATION_FEE_TRIGGER_SET/V2',
  contextual_cardinality: 'EXACTLY_ONE',
  comparator: 'RELATIONSHIP_ORDINAL_THEN_SOURCE_ORDER',
  duplicate_policy: 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT',
  maximum_references: 1,
  maximum_encoded_bytes: 32768,
  whole_document_permission: false,
  object_authorisation_predicate: 'PARENT_SELECTED_TERMINATION_FEE_TRIGGER_SET_ONLY',
  route: 'INLINE_BATCH',
  response_schema: 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2',
  projection_version: 2,
});
const V4_METRIC_OPERATION_BINDINGS = Object.freeze([
  Object.freeze({
    binding_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
    metric_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-REVERSE',
    required_claim_definition_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    relationship_key: 'TRIGGERED_BY',
    legal_operation: 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
    fee_side: 'BUYER',
    payer: Object.freeze({ role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' }),
    payee: Object.freeze({ role: 'FEE_PAYEE', value: 'COMPANY', capacity: 'TARGET' }),
    trigger_path_schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
    trigger_path_schema_version: 2,
  }),
  Object.freeze({
    binding_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    required_claim_definition_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    relationship_key: 'TRIGGERED_BY',
    legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
    fee_side: 'SELLER',
    payer: Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' }),
    payee: Object.freeze({ role: 'FEE_PAYEE', value: 'PARENT', capacity: 'BUYER' }),
    trigger_path_schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
    trigger_path_schema_version: 2,
  }),
]);
const FIXTURE_CONTRACT_INPUT_V4 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V3,
  serving_exact_detail_actions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V2.serving_exact_detail_actions,
    V4_TERMINATION_FEE_EXACT_DETAIL_ACTION,
  ]),
  serving_metric_operation_bindings: V4_METRIC_OPERATION_BINDINGS,
  serving_trigger_path_schemas: Object.freeze([TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2]),
});

const MONEY_DENOMINATOR_PRECISION_POLICY_V1 = Object.freeze({
  schema_version: 'MONEY_DENOMINATOR_PRECISION_POLICY/V1',
  value_kind: 'MONEY_RELATIVE_TO_DEAL_VALUE',
  required_claim_state: 'PRESENT',
  applicable_claim_definition_keys: Object.freeze([
    'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  ]),
  authoritative_path: 'denominator.precision',
  allowed_precision_values: Object.freeze(['APPROXIMATE', 'EXACT']),
  compatibility_projection_path: 'attributes.denominator_precision',
  compatibility_projection_must_equal_authoritative: true,
});

const FIXTURE_CONTRACT_INPUT_V5 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V4,
  residual_reason_codes: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V4.residual_reason_codes,
    'INVALID_DENOMINATOR_PRECISION',
  ]),
  money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
});

const NO_SHOP_ACTION_CODES_V2 = Object.freeze([
  'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
  'INITIATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
  'FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
  'ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
  'FURNISH_NONPUBLIC_INFORMATION',
  'GRANT_DGCL_SECTION_203_WAIVER',
  'ENGAGE_IN_DISCUSSIONS',
  'ENGAGE_IN_NEGOTIATIONS',
  'CONTINUE_DISCUSSIONS',
  'CONTINUE_NEGOTIATIONS',
  'PARTICIPATE_IN_DISCUSSIONS',
  'PARTICIPATE_IN_NEGOTIATIONS',
  'AFFORD_ACCESS_TO_PROPERTIES',
  'AFFORD_ACCESS_TO_BOOKS',
  'AFFORD_ACCESS_TO_RECORDS',
  'APPROVE_ALTERNATIVE_AGREEMENT',
  'RECOMMEND_ALTERNATIVE_AGREEMENT',
  'ENTER_ALTERNATIVE_AGREEMENT',
  'PROPOSE_TO_APPROVE_ALTERNATIVE_AGREEMENT',
  'PROPOSE_TO_RECOMMEND_ALTERNATIVE_AGREEMENT',
  'PROPOSE_TO_ENTER_ALTERNATIVE_AGREEMENT',
  'SUPPORT_ACQUISITION_PROPOSAL',
  'FURTHER_ACQUISITION_PROPOSAL',
]);
const NO_SHOP_ACTION_OCCURRENCE_SCHEMA_V1 = Object.freeze({
  schema_key: 'NO_SHOP_ACTION_OCCURRENCE',
  schema_version: 1,
  record_schema: 'NO_SHOP_ACTION_OCCURRENCE/V1',
  maximum_occurrences_per_result: 64,
  required_fields: Object.freeze([
    'action_code',
    'party',
    'source_limb_code',
    'governed_ordinal',
    'knowledge_qualifier_code',
    'evidence_excerpt_ids',
    'scope_closure_id',
    'method_of_action_occurrence_ids',
  ]),
  allowed_source_limb_codes: Object.freeze(['A', 'B', 'C']),
  allowed_knowledge_qualifier_codes: Object.freeze(['NONE', 'KNOWINGLY']),
  minimum_evidence_excerpts: 1,
  maximum_evidence_excerpts: 8,
  maximum_method_of_action_occurrences: 4,
});
const NO_SHOP_ACTION_ROLLUP_SCHEMA_V1 = Object.freeze({
  schema_key: 'NO_SHOP_ACTION_COMPARISON_ROLLUP',
  schema_version: 1,
  derivation_rule: 'ANY_PRESENT_MEMBER',
  derivation_version: 1,
  comparison_only: true,
  canonical_identity_authority: false,
  absence_authority: false,
  maximum_member_action_codes: 16,
  rollups: Object.freeze([
    Object.freeze({
      roll_up_code: 'SOLICIT_OR_INITIATE',
      member_action_codes: Object.freeze([
        'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
        'INITIATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      ]),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'KNOWINGLY_ENCOURAGE_OR_FACILITATE',
      member_action_codes: Object.freeze([
        'ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
        'FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      ]),
      required_qualifier_predicate: 'knowledge_qualifier_code=KNOWINGLY',
    }),
    Object.freeze({
      roll_up_code: 'FURNISH_NONPUBLIC_INFORMATION',
      member_action_codes: Object.freeze(['FURNISH_NONPUBLIC_INFORMATION']),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'AFFORD_ACCESS',
      member_action_codes: Object.freeze([
        'AFFORD_ACCESS_TO_PROPERTIES',
        'AFFORD_ACCESS_TO_BOOKS',
        'AFFORD_ACCESS_TO_RECORDS',
      ]),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'DISCUSS_OR_NEGOTIATE',
      member_action_codes: Object.freeze([
        'ENGAGE_IN_DISCUSSIONS',
        'ENGAGE_IN_NEGOTIATIONS',
        'CONTINUE_DISCUSSIONS',
        'CONTINUE_NEGOTIATIONS',
        'PARTICIPATE_IN_DISCUSSIONS',
        'PARTICIPATE_IN_NEGOTIATIONS',
      ]),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'APPROVE_OR_RECOMMEND_ALTERNATIVE_AGREEMENT',
      member_action_codes: Object.freeze([
        'APPROVE_ALTERNATIVE_AGREEMENT',
        'RECOMMEND_ALTERNATIVE_AGREEMENT',
      ]),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'ENTER_ALTERNATIVE_AGREEMENT',
      member_action_codes: Object.freeze(['ENTER_ALTERNATIVE_AGREEMENT']),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'PROPOSE_ALTERNATIVE_AGREEMENT',
      member_action_codes: Object.freeze([
        'PROPOSE_TO_APPROVE_ALTERNATIVE_AGREEMENT',
        'PROPOSE_TO_RECOMMEND_ALTERNATIVE_AGREEMENT',
        'PROPOSE_TO_ENTER_ALTERNATIVE_AGREEMENT',
      ]),
      required_qualifier_predicate: null,
    }),
    Object.freeze({
      roll_up_code: 'SUPPORT_OR_FURTHER_ACQUISITION_PROPOSAL',
      member_action_codes: Object.freeze([
        'SUPPORT_ACQUISITION_PROPOSAL',
        'FURTHER_ACQUISITION_PROPOSAL',
      ]),
      required_qualifier_predicate: null,
    }),
  ]),
  unrolled_action_codes: Object.freeze(['GRANT_DGCL_SECTION_203_WAIVER']),
});
const NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2 = Object.freeze([
  'WINDOW_SIGNING_TO_STOCKHOLDER_APPROVAL',
  'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED',
  'PROPOSAL_NOT_RESULTING_FROM_COVENANT_OBLIGOR_NO_SHOP_BREACH',
  'BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION',
  'BOARD_GOOD_FAITH_FIDUCIARY_DUTY_DETERMINATION',
  'OUTSIDE_FINANCIAL_ADVISER_AND_LEGAL_COUNSEL_CONSULTATION',
  'OUTSIDE_LEGAL_COUNSEL_FIDUCIARY_CONSULTATION',
  'SUBJECT_TO_INITIAL_PROPOSAL_NOTICE',
  'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED',
  'NONPUBLIC_INFORMATION_PREVIOUSLY_OR_SUBSTANTIALLY_SIMULTANEOUSLY_PROVIDED_TO_PROTECTED_PARTY',
]);
const NO_SHOP_SHARED_EXCEPTION_PREREQUISITE_CODES_V2 = Object.freeze(
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2.slice(0, 8),
);
const NO_SHOP_INFORMATION_EXCEPTION_PREREQUISITE_CODES_V2 = Object.freeze(
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2.slice(8),
);
const NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1 = Object.freeze({
  schema_key: 'NO_SHOP_EXCEPTION_EFFECT',
  schema_version: 1,
  relationship_key: 'EXCEPTED_BY',
  relationship_definition_version: 2,
  effect_schema: 'NO_SHOP_EXCEPTION_EFFECT/V1',
  effect_mode: 'TYPED_LEGAL_EFFECT',
  maximum_relationships_per_result: 16,
  maximum_shared_prerequisites: 8,
  maximum_action_specific_prerequisites: 2,
  required_effect_fields: Object.freeze([
    'legal_operation',
    'affected_action_code',
    'shared_prerequisite_codes',
    'action_specific_prerequisite_codes',
    'temporal_start',
    'temporal_end',
    'obligated_party',
    'protected_party',
    'governing_notice_obligation_revision_id',
    'definition_use_relationship_ids',
    'precedence_code',
  ]),
  required_shared_prerequisite_codes:
    NO_SHOP_SHARED_EXCEPTION_PREREQUISITE_CODES_V2,
  allowed_legal_operations: Object.freeze([
    Object.freeze({
      legal_operation: 'PERMITS_FURNISH_NONPUBLIC_INFORMATION',
      affected_action_code: 'FURNISH_NONPUBLIC_INFORMATION',
      required_action_specific_prerequisite_codes:
        NO_SHOP_INFORMATION_EXCEPTION_PREREQUISITE_CODES_V2,
      required_definition_relationship_key: 'USES_DEFINITION',
    }),
    Object.freeze({
      legal_operation: 'PERMITS_ENGAGE_IN_DISCUSSIONS',
      affected_action_code: 'ENGAGE_IN_DISCUSSIONS',
      required_action_specific_prerequisite_codes: Object.freeze([]),
      required_definition_relationship_key: null,
    }),
    Object.freeze({
      legal_operation: 'PERMITS_ENGAGE_IN_NEGOTIATIONS',
      affected_action_code: 'ENGAGE_IN_NEGOTIATIONS',
      required_action_specific_prerequisite_codes: Object.freeze([]),
      required_definition_relationship_key: null,
    }),
    Object.freeze({
      legal_operation: 'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
      affected_action_code: 'PARTICIPATE_IN_DISCUSSIONS',
      required_action_specific_prerequisite_codes: Object.freeze([]),
      required_definition_relationship_key: null,
    }),
    Object.freeze({
      legal_operation: 'PERMITS_PARTICIPATE_IN_NEGOTIATIONS',
      affected_action_code: 'PARTICIPATE_IN_NEGOTIATIONS',
      required_action_specific_prerequisite_codes: Object.freeze([]),
      required_definition_relationship_key: null,
    }),
  ]),
  temporal_start: 'SIGNING',
  temporal_end: 'STOCKHOLDER_APPROVAL',
  precedence_code: 'SUBJECT_TO_INITIAL_PROPOSAL_NOTICE',
  governed_notice_dependency: 'COMPLETE_FIRST_SENTENCE_NOTICE_OBLIGATION',
  partial_notice_claim_cannot_close_dependency: true,
});
const NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1 = Object.freeze({
  schema_key: 'NO_SHOP_INLINE_PERMISSION_EFFECT',
  schema_version: 1,
  relationship_key: 'EXCEPTED_BY',
  relationship_definition_version: 2,
  effect_schema: 'NO_SHOP_INLINE_PERMISSION_EFFECT/V1',
  effect_mode: 'TYPED_LEGAL_EFFECT',
  maximum_relationships_per_result: 8,
  required_effect_fields: Object.freeze([
    'legal_operation',
    'permitted_action_code',
    'qualified_action_occurrence_ids',
    'permitted_actor_party',
    'information_subject_code',
    'temporal_scope_inheritance',
    'cross_reference_excerpt_id',
    'evidence_excerpt_ids',
    'scope_closure_id',
  ]),
  legal_operation: 'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS',
  permitted_action_code: 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
  information_subject_code: 'GOVERNING_NO_SHOP_PROVISIONS',
  temporal_scope_inheritance: 'INHERITS_PARENT_NO_SHOP_RESTRICTION',
  minimum_qualified_action_occurrences: 1,
  maximum_qualified_action_occurrences: 16,
  minimum_evidence_excerpts: 1,
  maximum_evidence_excerpts: 8,
  forbidden_prerequisite_classes: Object.freeze([
    'PROPOSAL',
    'CONFIDENTIALITY',
    'INFORMATION_DELIVERY',
    'NOTICE',
  ]),
});
const NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1 = Object.freeze({
  schema_key: 'NO_SHOP_NOTICE_OBLIGATION',
  schema_version: 1,
  record_schema: 'NO_SHOP_NOTICE_OBLIGATION/V1',
  required_fields: Object.freeze([
    'notice_obligation_occurrence_id',
    'notice_obligation_revision_id',
    'source_provision_instance_id',
    'obligated_party',
    'protected_party',
    'trigger_codes',
    'notice_timing_claim_revision_ids',
    'notice_timing_qualifier_codes',
    'delivery_method_codes',
    'content_requirement_codes',
    'copy_timing_claim_revision_ids',
    'copy_timing_qualifier_codes',
    'copy_subject_codes',
    'definition_use_relationship_ids',
    'evidence_excerpt_ids',
    'scope_closure_id',
    'completeness',
  ]),
  allowed_trigger_codes: Object.freeze([
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
    'RECEIPT_OF_COMPANY_REQUEST',
  ]),
  allowed_delivery_method_codes: Object.freeze(['ORAL', 'WRITTEN']),
  allowed_content_requirement_codes: Object.freeze([
    'IDENTIFY_SUBMITTING_PERSON',
    'MATERIAL_TERMS_IN_REASONABLE_DETAIL',
    'MODIFICATIONS_IN_REASONABLE_DETAIL',
  ]),
  allowed_copy_subject_codes: Object.freeze([
    'WRITTEN_COMPANY_REQUESTS',
    'PROPOSALS_OR_INDICATIONS_OF_INTEREST',
    'DRAFT_AGREEMENTS',
  ]),
  required_trigger_codes: Object.freeze([
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
    'RECEIPT_OF_COMPANY_REQUEST',
  ]),
  required_delivery_method_codes: Object.freeze(['ORAL', 'WRITTEN']),
  required_content_requirement_codes: Object.freeze([
    'IDENTIFY_SUBMITTING_PERSON',
    'MATERIAL_TERMS_IN_REASONABLE_DETAIL',
    'MODIFICATIONS_IN_REASONABLE_DETAIL',
  ]),
  required_notice_timing_qualifier_codes: Object.freeze([
    'PROMPTLY',
    'NO_LATER_THAN_24_ELAPSED_HOURS',
  ]),
  required_copy_timing_qualifier_codes: Object.freeze([
    'PROMPTLY',
    'NO_LATER_THAN_24_ELAPSED_HOURS',
  ]),
  required_copy_subject_codes: Object.freeze([
    'WRITTEN_COMPANY_REQUESTS',
    'PROPOSALS_OR_INDICATIONS_OF_INTEREST',
    'DRAFT_AGREEMENTS',
  ]),
  timing_claim_definition_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
  minimum_trigger_codes: 2,
  maximum_trigger_codes: 2,
  minimum_notice_timing_claims: 1,
  maximum_notice_timing_claims: 4,
  minimum_delivery_methods: 2,
  maximum_delivery_methods: 2,
  minimum_content_requirements: 3,
  maximum_content_requirements: 3,
  minimum_copy_timing_claims: 1,
  maximum_copy_timing_claims: 4,
  minimum_copy_subject_codes: 3,
  maximum_copy_subject_codes: 3,
  maximum_definition_use_relationships: 8,
  minimum_evidence_excerpts: 1,
  maximum_evidence_excerpts: 32,
  required_completeness: 'COMPLETE',
});
const NO_SHOP_SEMANTIC_SCHEMAS_V1 = Object.freeze([
  NO_SHOP_ACTION_ROLLUP_SCHEMA_V1,
  NO_SHOP_ACTION_OCCURRENCE_SCHEMA_V1,
  NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1,
  NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1,
]);
const NO_SHOP_PROHIBITED_ACTION_CLAIM_V2 = Object.freeze({
  claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
  version: 2,
  allowed_canonical_values: NO_SHOP_ACTION_CODES_V2,
  canonical_value_required_when_present: true,
});
const NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_V2 = Object.freeze({
  claim_definition_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
  version: 2,
  allowed_canonical_values: NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
  canonical_value_required_when_present: true,
});
const FIXTURE_CONTRACT_INPUT_V6 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V5,
  relationship_definitions: Object.freeze(
    FIXTURE_CONTRACT_INPUT_V5.relationship_definitions.map((entry) => (
      entry.relationship_key === 'EXCEPTED_BY'
        ? Object.freeze({ ...entry, version: 2 })
        : entry
    )),
  ),
  claim_definitions: Object.freeze(
    FIXTURE_CONTRACT_INPUT_V5.claim_definitions.map((entry) => {
      if (entry.claim_definition_key === 'NO_SHOP_PROHIBITED_ACTION') {
        return NO_SHOP_PROHIBITED_ACTION_CLAIM_V2;
      }
      if (entry.claim_definition_key === 'NO_SHOP_EXCEPTION_PREREQUISITE') {
        return NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_V2;
      }
      return entry;
    }),
  ),
  no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V1,
});

const CLAIM_INTERPRETATION_POLICY_V1 = Object.freeze({
  schema_version: 'CLAIM_INTERPRETATION_POLICY/V1',
  applies_only_to_claim_state: 'PRESENT',
  interpretation_payload_schema: 'CLAIM_INTERPRETATION/V1',
  interpretation_payload_content_address_domain: 'CLAIM_INTERPRETATION/V1',
  referenced_by_claim_revision_schema: 'CLAIM_REVISION/V2',
  claim_revision_reference_field: 'interpretation_payload_id',
  identity_inputs: Object.freeze([
    'claim_occurrence_id',
    'policy_version',
    'clarity_state',
    'primary_interpretation',
    'alternative_interpretations',
    'ambiguity_dimension_codes',
    'evidence_excerpt_ids',
    'lawyer_note_digest',
    'review_provenance',
  ]),
  maximum_alternative_interpretations: 4,
  maximum_evidence_excerpts: 16,
  clarity_states: Object.freeze([
    Object.freeze({
      clarity_state: 'CLEAR',
      primary_interpretation_cardinality: 'EXACTLY_ONE',
      minimum_alternative_interpretations: 0,
      maximum_alternative_interpretations: 0,
      minimum_ambiguity_dimensions: 0,
      maximum_ambiguity_dimensions: 0,
      review_renderable: true,
      canonical_claim_publishable: true,
      default_metric_comparability: 'ALLOWED_IF_OTHERWISE_COMPLETE',
    }),
    Object.freeze({
      clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
      primary_interpretation_cardinality: 'EXACTLY_ONE',
      minimum_alternative_interpretations: 1,
      maximum_alternative_interpretations: 4,
      minimum_ambiguity_dimensions: 1,
      maximum_ambiguity_dimensions: 7,
      review_renderable: true,
      canonical_claim_publishable: true,
      default_metric_comparability: 'BLOCKED_UNLESS_METRIC_EXPLICITLY_ACCEPTS',
    }),
    Object.freeze({
      clarity_state: 'MULTIPLE_PLAUSIBLE_NO_PRIMARY',
      primary_interpretation_cardinality: 'NONE',
      minimum_alternative_interpretations: 2,
      maximum_alternative_interpretations: 4,
      minimum_ambiguity_dimensions: 1,
      maximum_ambiguity_dimensions: 7,
      review_renderable: true,
      canonical_claim_publishable: false,
      default_metric_comparability: 'BLOCKED',
    }),
  ]),
  ambiguity_dimension_codes: Object.freeze([
    'REFERENT',
    'SCOPE',
    'PARTY',
    'TIMING',
    'CARDINALITY',
    'DEFINITION_PRECEDENCE',
    'OTHER_REVIEWED',
  ]),
  comparability_effect_codes: Object.freeze([
    'AMBIGUITY_IMMATERIAL_TO_SELECTED_METRIC',
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    'AMBIGUITY_EFFECT_UNRESOLVED',
  ]),
  default_metric_accepted_clarity_states: Object.freeze(['CLEAR']),
  ambiguous_metric_admission_requires: Object.freeze([
    'metric_definition_id',
    'accepted_clarity_states',
    'accepted_ambiguity_dimension_codes',
    'comparability_effect_code',
  ]),
  ambiguous_metric_admission_code:
    'AMBIGUITY_IMMATERIAL_TO_SELECTED_METRIC',
  projection_retention_fields: Object.freeze([
    'policy_version',
    'interpretation_payload_id',
    'clarity_state',
    'ambiguity_dimension_codes',
    'comparability_effect_code',
  ]),
  cohort_denominator_and_cache_identity_fields: Object.freeze([
    'policy_version',
    'interpretation_payload_id',
    'clarity_state',
    'ambiguity_dimension_codes',
    'comparability_effect_code',
  ]),
  cohort_denominator_and_cache_identity_include_projection_fields: true,
  every_observed_ambiguity_dimension_must_be_explicitly_accepted: true,
  absent_or_unclassified_ambiguity_admission_blocks_comparison: true,
  other_reviewed_dimension_always_blocks_comparison: true,
  interpretation_payload_id_must_be_retained_for_lawyer_output: true,
  lawyer_facing_output_required_for_ambiguous_states: true,
  other_reviewed_dimension_requires_typed_reason_and_note: true,
  unresolved_primary_blocks_dependent_canonical_result: true,
});

const CLAIM_INTERPRETATION_POLICY_V2 = Object.freeze({
  ...CLAIM_INTERPRETATION_POLICY_V1,
  schema_version: 'CLAIM_INTERPRETATION_POLICY/V2',
  metric_specific_ambiguous_admissions: Object.freeze([
    Object.freeze({
      metric_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
      metric_version: 1,
      accepted_clarity_states: Object.freeze([
        'CLEAR',
        'REASONABLE_BUT_AMBIGUOUS',
      ]),
      accepted_ambiguity_dimension_codes: Object.freeze([
        'REFERENT',
        'SCOPE',
        'CARDINALITY',
      ]),
      accepted_comparability_effect_codes: Object.freeze([
        'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
      ]),
      admission_semantics:
        'SELECTED_PRIMARY_INTERPRETATION_FOR_SEPARATE_RELEASE_KEYED_COHORT_WITH_MANDATORY_LAWYER_WARNING',
      cohort_identity_must_include_interpretation_projection: true,
      lawyer_warning_required: true,
    }),
  ]),
});

const USES_DEFINITION_EFFECT_SCHEMA_V1 = Object.freeze({
  schema_version: 'USES_DEFINITION_EFFECT/V1',
  relationship_key: 'USES_DEFINITION',
  relationship_definition_version: 2,
  legal_operation: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
  maximum_recursive_dependencies: 16,
  maximum_evidence_excerpts: 8,
  required_effect_fields: Object.freeze([
    'legal_operation',
    'effect_schema_version',
    'exact_use_occurrence_id',
    'exact_use_span',
    'raw_use_form',
    'selected_definition_occurrence_id',
    'use_form_code',
    'legal_role_code',
    'affected_endpoint',
    'party_scope',
    'evidence_excerpt_ids',
    'evidence_by_role',
    'scope_closure_id',
    'relationship_interpretation_payload_id',
    'definition_precedence_review',
    'recursive_dependency_relationship_ids',
  ]),
  affected_endpoint_contract: Object.freeze({
    exactly_one_endpoint: true,
    allowed_endpoint_fields: Object.freeze([
      Object.freeze({
        endpoint_kind: 'NOTICE_OBLIGATION_REVISION',
        affected_field_keys: Object.freeze([
          'trigger_expression',
          'copy_subject_codes',
          'content_requirement_codes',
        ]),
      }),
      Object.freeze({
        endpoint_kind: 'DEFINITION_OCCURRENCE',
        affected_field_keys: Object.freeze([
          'nested_definition_dependency',
        ]),
      }),
    ]),
    required_fields: Object.freeze([
      'endpoint_kind',
      'endpoint_id',
      'affected_field_key',
    ]),
  }),
  allowed_use_form_codes: Object.freeze([
    'EXACT_DECLARED_TERM',
    'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
  ]),
  plural_normalisation_rule: Object.freeze({
    rule_key: 'EXACT_DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
    rule_version: 1,
    scope: 'THIS_SOURCE_USE_ONLY',
    requires_exact_singular_declaration: true,
    requires_same_governed_scope: true,
    requires_complete_conflict_scan_scope: true,
    separately_defined_plural_forbidden: true,
    conflicting_local_sense_forbidden: true,
    raw_form_must_be_preserved: true,
    definition_identity_matches_selected_singular_occurrence: true,
    alias_authority: 'NONE',
  }),
  allowed_legal_role_codes: Object.freeze([
    'OPERATIVE_TRIGGER',
    'OPERATIVE_OBLIGATION_OBJECT',
    'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
    'NESTED_DEFINITION_DEPENDENCY',
  ]),
  relationship_interpretation_payload_contract: Object.freeze({
    schema_version: 'RELATIONSHIP_INTERPRETATION/V1',
    content_address_domain: 'RELATIONSHIP_INTERPRETATION/V1',
    subject_kind: 'USES_DEFINITION_RELATIONSHIP_OCCURRENCE',
    identity_inputs: Object.freeze([
      'relationship_occurrence_id',
      'policy_version',
      'clarity_state',
      'primary_interpretation',
      'alternative_interpretations',
      'ambiguity_dimension_codes',
      'evidence_by_role',
      'lawyer_note_digest',
      'review_provenance',
    ]),
    clarity_states: Object.freeze([
      Object.freeze({
        clarity_state: 'CLEAR',
        primary_interpretation_cardinality: 'EXACTLY_ONE',
        minimum_alternative_interpretations: 0,
        maximum_alternative_interpretations: 0,
        minimum_ambiguity_dimensions: 0,
        maximum_ambiguity_dimensions: 0,
      }),
      Object.freeze({
        clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
        primary_interpretation_cardinality: 'EXACTLY_ONE',
        minimum_alternative_interpretations: 1,
        maximum_alternative_interpretations: 4,
        minimum_ambiguity_dimensions: 1,
        maximum_ambiguity_dimensions: 7,
      }),
      Object.freeze({
        clarity_state: 'MULTIPLE_PLAUSIBLE_NO_PRIMARY',
        primary_interpretation_cardinality: 'NONE',
        minimum_alternative_interpretations: 2,
        maximum_alternative_interpretations: 4,
        minimum_ambiguity_dimensions: 1,
        maximum_ambiguity_dimensions: 7,
      }),
    ]),
    ambiguity_dimension_codes: CLAIM_INTERPRETATION_POLICY_V1
      .ambiguity_dimension_codes,
  }),
  evidence_role_contract: Object.freeze({
    required_roles: Object.freeze([
      'EXACT_USE',
      'DEFINITION_DECLARATION',
      'DEFINITION_BODY',
    ]),
    plural_use_required_role: 'PLURAL_RESOLUTION',
    exact_one_excerpt_per_role: true,
  }),
  definition_precedence_review_contract: Object.freeze({
    allowed_states: Object.freeze([
      'CONTROLLING_DEFINITION_CONFIRMED',
      'BLOCKING_CONFLICT_OR_OVERRIDE_UNRESOLVED',
    ]),
    controlling_state_requires_complete_conflict_scan: true,
    controlling_state_requires_scope_closure_id: true,
  }),
  party_scope_contract: Object.freeze({
    required_fields: Object.freeze([
      'source_party_context_id',
      'affected_endpoint_party_context',
      'definition_party_context',
    ]),
    affected_endpoint_party_context_required: true,
    affected_endpoint_party_context_contract: Object.freeze({
      schema_version: 'PARTY_TUPLE/V1',
      required_fields: Object.freeze(['role', 'value', 'capacity']),
      exact_fields_only: true,
    }),
    definition_party_context_contract: Object.freeze({
      discriminator_field: 'applicability_state',
      variants: Object.freeze([
        Object.freeze({
          applicability_state: 'APPLICABLE',
          required_fields: Object.freeze(['applicability_state', 'party']),
          party_contract: 'PARTY_TUPLE/V1',
        }),
        Object.freeze({
          applicability_state: 'NOT_APPLICABLE',
          required_fields: Object.freeze(['applicability_state']),
          forbidden_fields: Object.freeze(['party']),
        }),
      ]),
      null_string_and_untyped_object_encodings_forbidden: true,
    }),
    party_inference_from_use_forbidden: true,
    party_inference_from_definition_forbidden: true,
    party_transfer_requires_separate_relationship: true,
  }),
  identity_inputs: Object.freeze([
    'legal_operation',
    'effect_schema_version',
    'exact_use_occurrence_id',
    'exact_use_span',
    'raw_use_form',
    'selected_definition_occurrence_id',
    'use_form_code',
    'legal_role_code',
    'affected_endpoint',
    'party_scope',
    'evidence_excerpt_ids',
    'evidence_by_role',
    'scope_closure_id',
    'relationship_interpretation_payload_id',
    'definition_precedence_review',
    'recursive_dependency_relationship_ids',
  ]),
  propagation: 'EXACT_NAMED_TARGET_ONLY',
  party_transfer: 'NONE',
  alias_authority: 'NONE',
  recursive_dependency_rules: Object.freeze({
    same_deal_required: true,
    acyclic_required: true,
    sorted_unique_required: true,
    self_reference_forbidden: true,
  }),
  controlling_definition_requires_closed_conflict_and_override_review: true,
  unresolved_definition_precedence_blocks_relationship_effect_publication: true,
  one_source_occurrence_may_support_use_and_dependency_without_duplication: true,
  plural_use_requires_distinct_use_and_relationship_identities: true,
  required_exact_values: Object.freeze({
    legal_operation: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
    effect_schema_version: 1,
    propagation: 'EXACT_NAMED_TARGET_ONLY',
    party_transfer: 'NONE',
    alias_authority: 'NONE',
  }),
});

const DEFINITION_OCCURRENCE_IDENTITY_CONTRACT_V1 = Object.freeze({
  record_schema: 'DEFINITION_OCCURRENCE_IDENTITY/V1',
  content_address_domain: 'DEFINITION_OCCURRENCE/V1',
  identity_inputs: Object.freeze([
    'document_hash',
    'exact_declaration_span',
    'ordered_body_spans',
    'neutral_definition_key',
    'governed_ordinal',
  ]),
  coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
  ordered_body_spans_required: true,
  neutral_definition_key_must_not_be_canonical_concept_key: true,
  selected_use_occurrences_forbidden_from_identity: true,
});

const DEFINITION_USE_OCCURRENCE_IDENTITY_CONTRACT_V1 = Object.freeze({
  record_schema: 'DEFINITION_USE_OCCURRENCE_IDENTITY/V1',
  content_address_domain: 'DEFINITION_USE_OCCURRENCE/V1',
  identity_inputs: Object.freeze([
    'document_hash',
    'exact_use_span',
    'raw_use_form',
    'governed_ordinal',
  ]),
  coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
  selected_definition_occurrence_id_forbidden_from_identity: true,
  legal_role_code_forbidden_from_identity: true,
  plural_normalisation_forbidden_from_identity: true,
});

const SOURCE_PARTY_CONTEXT_IDENTITY_CONTRACT_V1 = Object.freeze({
  record_schema: 'SOURCE_PARTY_CONTEXT_IDENTITY/V1',
  content_address_domain: 'SOURCE_PARTY_CONTEXT/V1',
  identity_inputs: Object.freeze([
    'document_hash',
    'source_scope_id',
    'party',
    'evidence_excerpt_ids',
  ]),
  party_contract: 'PARTY_TUPLE/V1',
  sorted_unique_evidence_excerpt_ids_required: true,
  party_inference_forbidden: true,
  party_transfer_forbidden: true,
});

const USES_DEFINITION_EFFECT_SCHEMA_V2 = Object.freeze({
  ...USES_DEFINITION_EFFECT_SCHEMA_V1,
  schema_version: 'USES_DEFINITION_EFFECT/V2',
  relationship_definition_version: 3,
  affected_endpoint_contract: Object.freeze({
    ...USES_DEFINITION_EFFECT_SCHEMA_V1.affected_endpoint_contract,
    allowed_endpoint_fields: Object.freeze([
      Object.freeze({
        endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
        affected_field_keys: Object.freeze([
          'trigger_expression',
          'copy_subject_codes',
          'content_requirement_codes',
        ]),
      }),
      Object.freeze({
        endpoint_kind: 'DEFINITION_OCCURRENCE',
        affected_field_keys: Object.freeze([
          'nested_definition_dependency',
        ]),
      }),
    ]),
  }),
  identity_contracts: Object.freeze({
    definition_occurrence: DEFINITION_OCCURRENCE_IDENTITY_CONTRACT_V1,
    exact_use_occurrence: DEFINITION_USE_OCCURRENCE_IDENTITY_CONTRACT_V1,
    source_party_context: SOURCE_PARTY_CONTEXT_IDENTITY_CONTRACT_V1,
  }),
  required_exact_values: Object.freeze({
    ...USES_DEFINITION_EFFECT_SCHEMA_V1.required_exact_values,
    effect_schema_version: 2,
  }),
  notice_relationship_endpoint_must_be_stable_occurrence: true,
  notice_revision_endpoint_forbidden: true,
});

const USES_DEFINITION_EFFECT_SCHEMA_V3 = Object.freeze({
  ...USES_DEFINITION_EFFECT_SCHEMA_V2,
  schema_version: 'USES_DEFINITION_EFFECT/V3',
  relationship_definition_version: 4,
  affected_endpoint_contract: Object.freeze({
    ...USES_DEFINITION_EFFECT_SCHEMA_V2.affected_endpoint_contract,
    allowed_endpoint_fields: Object.freeze([
      ...USES_DEFINITION_EFFECT_SCHEMA_V2.affected_endpoint_contract
        .allowed_endpoint_fields,
      Object.freeze({
        endpoint_kind: 'BRINGS_DOWN_RELATIONSHIP_OCCURRENCE',
        affected_field_keys: Object.freeze([
          'accuracy_exception',
          'definition_denominator_selection',
        ]),
      }),
    ]),
  }),
  allowed_legal_role_codes: Object.freeze([
    ...USES_DEFINITION_EFFECT_SCHEMA_V2.allowed_legal_role_codes,
    'OPERATIVE_ACCURACY_EXCEPTION',
  ]),
  definition_application_contract: Object.freeze({
    defined_term_code: 'DE_MINIMIS_INACCURACIES',
    allowed_denominator_party_values: Object.freeze([
      'COMPANY',
      'PARENT',
    ]),
    required_qxo_target_representation_denominator_party: 'COMPANY',
    raw_alternative_phrase_required: 'OR_PARENT_AS_THE_CASE_MAY_BE',
    denominator_selection_evidence_required: true,
    denominator_selection_derivation_version_required: true,
    parent_representation_generalisation_forbidden: true,
  }),
  required_exact_values: Object.freeze({
    ...USES_DEFINITION_EFFECT_SCHEMA_V2.required_exact_values,
    effect_schema_version: 3,
  }),
});

const NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2 = Object.freeze({
  ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1,
  schema_version: 2,
  record_schema: 'NO_SHOP_NOTICE_OBLIGATION/V2',
  required_fields: Object.freeze([
    'notice_obligation_occurrence_id',
    'notice_obligation_revision_id',
    'source_provision_instance_id',
    'obligated_party',
    'protected_party',
    'trigger_codes',
    'trigger_expression',
    'initial_notice_clock_scope',
    'delivery_method_codes',
    'content_requirement_codes',
    'copy_clock_scope',
    'copy_subject_codes',
    'definition_use_relationship_ids',
    'evidence_excerpt_ids',
    'scope_closure_id',
    'child_resolution_states',
  ]),
  trigger_expression_contract: Object.freeze({
    record_schema: 'NOTICE_TRIGGER_EXPRESSION/V1',
    required_fields: Object.freeze([
      'trigger_expression_id',
      'operator',
      'operands',
      'operand_sufficiency_code',
      'party',
      'source_scope_id',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'operator',
      'canonical_operand_set',
      'party',
      'source_scope_id',
      'evidence_excerpt_ids',
    ]),
    allowed_operators: Object.freeze(['ANY_OF']),
    required_operand_sufficiency_code:
      'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
    canonical_operand_set_derivation:
      'SORTED_UNIQUE_TRIGGER_CODE_ASCENDING',
    unique_operands_required: true,
    operand_union_must_equal_top_level_trigger_codes: true,
    same_notice_deal_and_source_lineage_required: true,
  }),
  initial_notice_clock_scope_contract: Object.freeze({
    record_schema: 'NOTICE_CLOCK_SCOPE/V1',
    content_address_domain: 'NOTICE_CLOCK_SCOPE/V1',
    required_fields: Object.freeze([
      'clock_scope_id',
      'timing_claim_revision_id',
      'trigger_expression_id',
      'application_scope_code',
      'qualifier_combination_operator',
      'temporal_operator',
      'qualifier_codes',
      'resolution_state',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'timing_claim_revision_id',
      'trigger_expression_id',
      'application_scope_code',
      'qualifier_combination_operator',
      'temporal_operator',
      'qualifier_codes',
      'resolution_state',
      'evidence_excerpt_ids',
    ]),
    required_application_scope_code:
      'EACH_SATISFYING_TRIGGER_OCCURRENCE',
    required_qualifier_combination_operator: 'ALL_OF',
    required_temporal_operator: 'CEILING',
    required_qualifier_codes: Object.freeze([
      'PROMPTLY',
      'NO_LATER_THAN_24_ELAPSED_HOURS',
    ]),
    cross_role_timing_claim_binding_forbidden: true,
    same_notice_deal_and_source_lineage_required: true,
  }),
  copy_clock_scope_contract: Object.freeze({
    record_schema: 'NOTICE_COPY_CLOCK_SCOPE/V1',
    content_address_domain: 'NOTICE_COPY_CLOCK_SCOPE/V1',
    required_fields: Object.freeze([
      'clock_scope_id',
      'notice_obligation_occurrence_id',
      'timing_claim_revision_id',
      'raw_receipt_referent',
      'receipt_recipient_party',
      'primary_receipt_interpretation_code',
      'primary_interpretation_subject_code',
      'alternative_receipt_interpretation_codes',
      'referent_interpretation_clarity_state',
      'ambiguity_dimension_codes',
      'comparability_effect_code',
      'lawyer_review_note',
      'receipt_referent_state',
      'receipt_scope_state',
      'copy_subject_association_state',
      'item_or_batch_cardinality_state',
      'interpretation_payload_id',
      'resolution_state',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'notice_obligation_occurrence_id',
      'timing_claim_revision_id',
      'raw_receipt_referent',
      'receipt_recipient_party',
      'primary_receipt_interpretation_code',
      'primary_interpretation_subject_code',
      'alternative_receipt_interpretation_codes',
      'referent_interpretation_clarity_state',
      'ambiguity_dimension_codes',
      'comparability_effect_code',
      'receipt_referent_state',
      'receipt_scope_state',
      'copy_subject_association_state',
      'item_or_batch_cardinality_state',
      'interpretation_payload_id',
      'resolution_state',
      'evidence_excerpt_ids',
    ]),
    allowed_primary_receipt_interpretation_codes: Object.freeze([
      'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
    ]),
    allowed_alternative_receipt_interpretation_codes: Object.freeze([
      'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    ]),
    required_primary_receipt_interpretation_code:
      'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
    allowed_primary_interpretation_subject_codes: Object.freeze([
      'ITEM_REQUIRED_TO_BE_COPIED',
    ]),
    required_primary_interpretation_subject_code:
      'ITEM_REQUIRED_TO_BE_COPIED',
    required_alternative_receipt_interpretation_codes: Object.freeze([
      'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    ]),
    required_referent_interpretation_clarity_state:
      'REASONABLE_BUT_AMBIGUOUS',
    required_ambiguity_dimension_codes: Object.freeze([
      'REFERENT',
      'SCOPE',
      'CARDINALITY',
    ]),
    required_comparability_effect_code:
      'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    allowed_receipt_referent_states: Object.freeze([
      'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    ]),
    allowed_receipt_scope_states: Object.freeze([
      'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    ]),
    allowed_copy_subject_association_states: Object.freeze([
      'PRIMARY_ITEM_ASSOCIATION_SELECTED_WITH_AMBIGUITY',
    ]),
    allowed_item_or_batch_cardinality_states: Object.freeze([
      'UNRESOLVED',
    ]),
    required_resolution_state: 'BLOCKING_UNRESOLVED',
    resolution_state_derivation:
      'ANY_UNRESOLVED_CHILD_BLOCKS_COPY_CLOCK_SCOPE',
    interpretation_payload_binding: Object.freeze({
      payload_schema: 'NOTICE_CLOCK_INTERPRETATION/V1',
      content_address_domain: 'NOTICE_CLOCK_INTERPRETATION/V1',
      subject_kind: 'NOTICE_COPY_CLOCK',
      subject_identity_inputs: Object.freeze([
        'notice_obligation_occurrence_id',
        'COPY_CLOCK',
      ]),
      payload_identity_inputs: Object.freeze([
        'subject_kind',
        'subject_identity',
        'policy_version',
        'clarity_state',
        'primary_interpretation',
        'alternative_interpretations',
        'ambiguity_dimension_codes',
        'evidence_excerpt_ids',
        'lawyer_note_digest',
        'review_provenance',
      ]),
      payload_is_sole_clarity_authority: true,
      duplicated_projection_fields_must_equal_payload: Object.freeze([
        Object.freeze({
          scope_field: 'referent_interpretation_clarity_state',
          payload_field: 'clarity_state',
        }),
        Object.freeze({
          scope_field: 'primary_receipt_interpretation_code',
          payload_field: 'primary_interpretation.code',
        }),
        Object.freeze({
          scope_field: 'alternative_receipt_interpretation_codes',
          payload_field: 'alternative_interpretations[].code',
        }),
        Object.freeze({
          scope_field: 'ambiguity_dimension_codes',
          payload_field: 'ambiguity_dimension_codes',
        }),
        Object.freeze({
          scope_field: 'lawyer_review_note',
          payload_field: 'lawyer_note_digest',
          comparison: 'UTF8_SHA256_DIGEST',
        }),
        Object.freeze({
          scope_field: 'evidence_excerpt_ids',
          payload_field: 'evidence_excerpt_ids',
        }),
      ]),
    }),
    canonical_trigger_code_forbidden: true,
    exact_raw_receipt_evidence_required: true,
    primary_interpretation_must_bind_recipient_and_subject_association: true,
    source_backed_alternative_required: true,
    lawyer_review_note_required: true,
    ambiguity_dimensions_requiring_explicit_clarity_or_flag: Object.freeze([
      'REFERENT',
      'SCOPE',
      'CARDINALITY',
    ]),
  }),
  allowed_child_resolution_states: Object.freeze([
    'RESOLVED_CLEAR',
    'RESOLVED_WITH_REVIEW_NOTE',
    'BLOCKING_UNRESOLVED',
  ]),
  child_resolution_state_contract: Object.freeze({
    required_child_keys: Object.freeze([
      'TRIGGER_EXPRESSION',
      'INITIAL_NOTICE_CLOCK_SCOPE',
      'COPY_CLOCK_SCOPE',
      'DEFINITION_USES',
      'DEFINITION_DEPENDENCY',
      'DEFINITION_SCOPE',
    ]),
    exactly_one_state_per_child: true,
    worst_state_order: Object.freeze([
      'RESOLVED_CLEAR',
      'RESOLVED_WITH_REVIEW_NOTE',
      'BLOCKING_UNRESOLVED',
    ]),
  }),
  minimum_notice_timing_claims: 1,
  maximum_notice_timing_claims: 1,
  minimum_copy_timing_claims: 1,
  maximum_copy_timing_claims: 1,
  required_completeness: null,
  legacy_completeness_field_forbidden: true,
  overall_resolution_derivation:
    'MECHANICAL_STRICT_WORST_CHILD_STATE_V1',
  independently_mutable_overall_resolution_forbidden: true,
});

const NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3 = Object.freeze({
  ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2,
  schema_version: 3,
  record_schema: 'NO_SHOP_NOTICE_OBLIGATION/V3',
  notice_occurrence_identity_contract: Object.freeze({
    record_schema: 'NOTICE_OBLIGATION_OCCURRENCE_IDENTITY/V1',
    content_address_domain: 'NOTICE_OBLIGATION_OCCURRENCE/V1',
    identity_inputs: Object.freeze([
      'document_hash',
      'exact_source_span',
      'concept_key',
      'party',
      'governed_ordinal',
      'source_provision_instance_id',
    ]),
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    exact_source_span_required: true,
    concept_key_required: 'NOSOL-NOTICE',
    party_contract: 'PARTY_TUPLE/V1',
    revision_content_forbidden_from_identity: true,
    relationship_occurrence_ids_forbidden_from_identity: true,
  }),
  notice_revision_identity_contract: Object.freeze({
    record_schema: 'NOTICE_OBLIGATION_REVISION_IDENTITY/V1',
    content_address_domain: 'NO_SHOP_NOTICE_OBLIGATION/V3',
    identity_inputs: Object.freeze(
      NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2.required_fields.filter(
        (field) => field !== 'notice_obligation_revision_id',
      ),
    ),
    occurrence_anchor_field: 'notice_obligation_occurrence_id',
    all_required_notice_fields_except_revision_id_are_identity_inputs: true,
    relationship_endpoints_must_target_notice_occurrence: true,
    self_reference_forbidden: true,
  }),
});

const NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4 = Object.freeze({
  ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3,
  schema_version: 4,
  record_schema: 'NO_SHOP_NOTICE_OBLIGATION/V4',
  copy_clock_scope_contract: Object.freeze({
    ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3.copy_clock_scope_contract,
    allowed_primary_receipt_interpretation_codes: Object.freeze([
      'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    ]),
    allowed_alternative_receipt_interpretation_codes: Object.freeze([
      'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
    ]),
    required_primary_receipt_interpretation_code:
      'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    allowed_primary_interpretation_subject_codes: Object.freeze([
      'PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    ]),
    required_primary_interpretation_subject_code:
      'PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
    required_alternative_receipt_interpretation_codes: Object.freeze([
      'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
    ]),
    allowed_copy_subject_association_states: Object.freeze([
      'PRIMARY_PRIOR_TRIGGER_ASSOCIATION_SELECTED_WITH_AMBIGUITY',
    ]),
    lawyer_ambiguity_flag_required: true,
  }),
  notice_revision_identity_contract: Object.freeze({
    ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3.notice_revision_identity_contract,
    content_address_domain: 'NO_SHOP_NOTICE_OBLIGATION/V4',
  }),
});

const NOTICE_DEFINITION_SCOPE_CLOSURE_V1 = Object.freeze({
  schema_version: 'NOTICE_DEFINITION_SCOPE_CLOSURE/V1',
  content_address_domain: 'NOTICE_DEFINITION_SCOPE_CLOSURE/V1',
  required_fields: Object.freeze([
    'definition_scope_closure_id',
    'notice_obligation_occurrence_id',
    'document_hash',
    'canonical_text_id',
    'root_scope_span',
    'scan_policy_digest',
    'document_definition_inventory_digest',
    'root_token_outcome_ids',
    'definition_occurrence_ids',
    'definition_use_relationship_ids',
    'party_token_outcome_ids',
    'terminal_reviewed_outcome_ids',
    'blocking_unresolved_outcome_ids',
    'topological_definition_occurrence_ids',
    'unresolved_outcome_count',
    'review_note_outcome_count',
    'fixed_point_state',
    'resolution_state',
  ]),
  identity_inputs: Object.freeze([
    'notice_obligation_occurrence_id',
    'document_hash',
    'canonical_text_id',
    'root_scope_span',
    'scan_policy_digest',
    'document_definition_inventory_digest',
    'root_token_outcome_ids',
    'definition_occurrence_ids',
    'definition_use_relationship_ids',
    'party_token_outcome_ids',
    'terminal_reviewed_outcome_ids',
    'blocking_unresolved_outcome_ids',
    'topological_definition_occurrence_ids',
    'unresolved_outcome_count',
    'review_note_outcome_count',
    'fixed_point_state',
    'resolution_state',
  ]),
  coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
  root_scope_must_equal_notice_occurrence_span: true,
  inventory_contract: Object.freeze({
    complete_document_definition_inventory_required: true,
    catalogue_matcher_required: true,
    catalogue_blind_capitalised_and_quoted_candidate_scan_required: true,
    catalogue_and_blind_inventory_reconciliation_required: true,
    longest_match_required: true,
    overlapping_shorter_token_must_not_be_emitted: true,
    exact_source_term_form_required: true,
    source_local_inflection_requires_reviewed_disposition: true,
    unknown_candidate_must_be_retained: true,
    silent_skip_forbidden: true,
    generic_non_substantive_fallback_forbidden: true,
  }),
  root_outcome_disposition_codes: Object.freeze([
    'DEFINITION_DECLARATION',
    'USES_DEFINITION',
    'PARTY_TOKEN_TERMINAL',
    'GOVERNANCE_BODY_DESIGNATION',
    'SOURCE_DOCUMENT_DESIGNATION',
    'STATUTE_DESIGNATION',
    'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE',
    'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE',
    'BLOCKING_UNRESOLVED_CANDIDATE',
  ]),
  root_token_outcome_contract: Object.freeze({
    record_schema: 'NOTICE_DEFINITION_SCOPE_TOKEN_OUTCOME/V1',
    content_address_domain: 'NOTICE_DEFINITION_SCOPE_TOKEN_OUTCOME/V1',
    required_fields: Object.freeze([
      'token_outcome_id',
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'candidate_origin',
      'disposition_code',
      'disposition_target',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'candidate_origin',
      'disposition_code',
      'disposition_target',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    disposition_target_contract: Object.freeze({
      discriminator_field: 'target_kind',
      target_kind_by_disposition_code: Object.freeze({
        DEFINITION_DECLARATION: 'DEFINITION_OCCURRENCE',
        USES_DEFINITION: 'DEFINITION_OCCURRENCE',
        PARTY_TOKEN_TERMINAL: 'PARTY_CONTEXT',
        GOVERNANCE_BODY_DESIGNATION: 'GOVERNANCE_CONTEXT',
        SOURCE_DOCUMENT_DESIGNATION: 'REVIEWED_TERMINAL',
        STATUTE_DESIGNATION: 'REVIEWED_TERMINAL',
        REVIEWED_UNDEFINED_SOURCE_PRIMITIVE: 'REVIEWED_TERMINAL',
        REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE: 'REVIEWED_TERMINAL',
        BLOCKING_UNRESOLVED_CANDIDATE: 'BLOCKING_UNRESOLVED',
      }),
      disposition_code_and_target_kind_must_correspond_exactly: true,
      variants: Object.freeze([
        Object.freeze({
          target_kind: 'DEFINITION_OCCURRENCE',
          required_fields: Object.freeze([
            'target_kind',
            'definition_occurrence_id',
          ]),
        }),
        Object.freeze({
          target_kind: 'PARTY_CONTEXT',
          required_fields: Object.freeze([
            'target_kind',
            'source_party_context_id',
          ]),
        }),
        Object.freeze({
          target_kind: 'GOVERNANCE_CONTEXT',
          required_fields: Object.freeze([
            'target_kind',
            'source_governance_context_id',
          ]),
        }),
        Object.freeze({
          target_kind: 'REVIEWED_TERMINAL',
          required_fields: Object.freeze([
            'target_kind',
            'terminal_reviewed_outcome_id',
          ]),
        }),
        Object.freeze({
          target_kind: 'BLOCKING_UNRESOLVED',
          required_fields: Object.freeze([
            'target_kind',
            'blocking_unresolved_outcome_id',
          ]),
        }),
      ]),
      exact_variant_fields_only: true,
    }),
    exact_source_evidence_required: true,
    sorted_unique_evidence_excerpt_ids_required: true,
    longest_match_winner_required: true,
  }),
  reviewed_terminal_disposition_codes: Object.freeze([
    'SOURCE_DOCUMENT_DESIGNATION',
    'STATUTE_DESIGNATION',
    'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE',
    'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE',
  ]),
  reviewed_terminal_outcome_contract: Object.freeze({
    record_schema: 'NOTICE_DEFINITION_SCOPE_REVIEWED_TERMINAL/V1',
    content_address_domain:
      'NOTICE_DEFINITION_SCOPE_REVIEWED_TERMINAL/V1',
    required_fields: Object.freeze([
      'terminal_reviewed_outcome_id',
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'disposition_code',
      'typed_reason_code',
      'lawyer_review_note',
      'non_comparable_reason',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'disposition_code',
      'typed_reason_code',
      'lawyer_review_note',
      'non_comparable_reason',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    exact_source_evidence_required: true,
    reviewed_disposition_required: true,
    typed_reason_code_required: true,
    lawyer_note_required: true,
    non_comparable_reason_required_for_undefined_or_non_enumerable: true,
    canonical_concept_invention_forbidden: true,
    market_cohort_admission_forbidden: true,
    unresolved_residual_encoding_forbidden: true,
    review_projection_required: true,
    review_must_render_raw_source_term: true,
    review_must_render_evidence_and_reason: true,
    compare_and_corpus_context_must_render_non_comparable_reason: true,
  }),
  blocking_unresolved_outcome_contract: Object.freeze({
    record_schema: 'NOTICE_DEFINITION_SCOPE_UNRESOLVED_OUTCOME/V1',
    content_address_domain: 'NOTICE_DEFINITION_SCOPE_UNRESOLVED_OUTCOME/V1',
    required_fields: Object.freeze([
      'blocking_unresolved_outcome_id',
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'typed_reason_code',
      'candidate_origin',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'typed_reason_code',
      'candidate_origin',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    exact_source_evidence_required: true,
    sorted_unique_evidence_excerpt_ids_required: true,
    review_queue_visibility_required: true,
    count_must_equal_blocking_unresolved_outcome_ids_cardinality: true,
    silent_count_only_encoding_forbidden: true,
  }),
  transitive_closure_contract: Object.freeze({
    every_selected_definition_body_scanned: true,
    same_reconciled_inventory_algorithm_required: true,
    one_relationship_per_exact_use_required: true,
    fixed_point_required: true,
    leaf_first_materialisation_required: true,
    sorted_unique_adjacency_required: true,
    same_document_and_deal_required: true,
    source_local_plural_self_reference_resolves_lexically_without_edge: true,
    relationship_cycles_forbidden: true,
    unclassified_frontier_forbidden: true,
  }),
  controlling_definition_contract: Object.freeze({
    complete_document_conflict_and_override_scan_required: true,
    controlling_scope_closure_required: true,
    local_override_scope_must_be_classified: true,
    unresolved_precedence_blocks_closure: true,
  }),
  party_token_contract: Object.freeze({
    record_schema: 'NOTICE_DEFINITION_SCOPE_PARTY_TOKEN_OUTCOME/V1',
    content_address_domain:
      'NOTICE_DEFINITION_SCOPE_PARTY_TOKEN_OUTCOME/V1',
    required_fields: Object.freeze([
      'party_token_outcome_id',
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'source_party_context_id',
      'party',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'document_hash',
      'parent_scope_identity',
      'exact_source_span',
      'raw_source_form',
      'source_party_context_id',
      'party',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    source_party_context_required: true,
    party_tuple_required: true,
    uses_definition_relationship_forbidden: true,
    party_transfer_forbidden: true,
    definition_semantic_inheritance_forbidden: true,
  }),
  governance_body_designation_contract: Object.freeze({
    record_schema: 'NOTICE_DEFINITION_SCOPE_GOVERNANCE_OUTCOME/V1',
    content_address_domain:
      'NOTICE_DEFINITION_SCOPE_GOVERNANCE_OUTCOME/V1',
    required_fields: Object.freeze([
      'source_governance_context_id',
      'document_hash',
      'exact_designation_span',
      'raw_source_form',
      'governed_entity_party_context_id',
      'governance_role_code',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    identity_inputs: Object.freeze([
      'document_hash',
      'exact_designation_span',
      'raw_source_form',
      'governed_entity_party_context_id',
      'governance_role_code',
      'governed_ordinal',
      'evidence_excerpt_ids',
    ]),
    source_governance_context_required: true,
    exact_designation_span_required: true,
    governed_entity_party_context_required: true,
    uses_definition_relationship_forbidden: true,
    party_substitution_forbidden: true,
    governed_entity_semantic_inheritance_forbidden: true,
    governance_body_semantics_transfer_requires_separate_relationship: true,
  }),
  terminalisation_precedence_contract: Object.freeze({
    definition_match_precedence_required: true,
    terminalisation_requires_no_applicable_substantive_definition_match: true,
    party_or_designation_terminal_requires_exact_reviewed_declaration_class:
      true,
    catalogue_match_cannot_be_relabelled_terminal_without_review: true,
    known_substantive_definition_bypass_forbidden: true,
  }),
  outcome_set_contract: Object.freeze({
    every_id_resolves_to_exactly_one_validated_child_object: true,
    every_id_array_sorted_unique: true,
    root_token_outcome_ids_equal_complete_root_inventory: true,
    blocking_unresolved_outcome_ids_equal_all_blocking_children: true,
    party_token_outcome_ids_equal_party_disposition_targets: true,
    terminal_reviewed_outcome_ids_equal_reviewed_terminal_targets: true,
    definition_occurrence_ids_equal_complete_reached_definition_node_set: true,
    definition_use_relationship_ids_equal_every_root_and_transitive_uses_definition_edge:
      true,
    topological_definition_occurrence_ids_exact_permutation_of_definition_occurrence_ids:
      true,
    topological_order_must_be_leaf_first_for_every_definition_use_relationship:
      true,
    definition_graph_arrays_forbid_omitted_or_extra_ids: true,
    party_and_reviewed_terminal_sets_disjoint: true,
    blocking_and_final_reviewed_sets_disjoint: true,
    unresolved_outcome_count_derivation:
      'CARDINALITY_OF_BLOCKING_UNRESOLVED_OUTCOME_IDS',
    review_note_outcome_count_derivation:
      'CARDINALITY_OF_TERMINAL_REVIEWED_OUTCOME_IDS',
  }),
  bounds: Object.freeze({
    maximum_definition_nodes: 32,
    maximum_definition_use_relationships: 64,
    maximum_party_token_outcomes: 64,
    maximum_root_token_outcomes: 64,
    maximum_total_transitive_token_outcomes: 256,
    maximum_terminal_reviewed_outcomes: 32,
    maximum_blocking_unresolved_outcomes: 32,
    maximum_total_evidence_excerpt_references: 512,
    maximum_dependency_depth: 16,
    maximum_encoded_bytes: 262144,
    maximum_referenced_outcome_encoded_bytes: 1048576,
  }),
  allowed_fixed_point_states: Object.freeze([
    'REACHED',
    'BLOCKING_UNRESOLVED',
  ]),
  allowed_resolution_states: Object.freeze([
    'RESOLVED_CLEAR',
    'RESOLVED_WITH_REVIEW_NOTE',
    'BLOCKING_UNRESOLVED',
  ]),
  resolution_derivation: Object.freeze({
    blocking_when: Object.freeze([
      'UNRESOLVED_OUTCOME_COUNT_NONZERO',
      'FIXED_POINT_NOT_REACHED',
      'INVENTORY_RECONCILIATION_FAILED',
      'DEFINITION_PRECEDENCE_UNRESOLVED',
      'RELATIONSHIP_CYCLE',
      'BOUND_EXCEEDED',
    ]),
    resolved_clear_when:
      'ZERO_UNRESOLVED_AND_ZERO_REVIEW_NOTES_AND_FIXED_POINT_REACHED',
    resolved_with_review_note_when:
      'ZERO_UNRESOLVED_AND_NONZERO_REVIEWED_TERMINALS_AND_FIXED_POINT_REACHED',
    final_reviewed_terminal_is_not_unresolved_residual: true,
  }),
  authority_contract: Object.freeze({
    absence_authority: 'NONE',
    canonical_write_authority: 'NONE',
    publication_authority: 'NONE',
    relationship_authority: 'NONE',
    result_authority: 'NONE',
    metric_authority: 'NONE',
    comparability_authority: 'NONE',
    query_authority: 'NONE',
    serving_authority: 'NONE',
    release_authority: 'NONE',
  }),
});

const NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5 = Object.freeze({
  ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4,
  schema_version: 5,
  record_schema: 'NO_SHOP_NOTICE_OBLIGATION/V5',
  required_fields: Object.freeze([
    ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4.required_fields,
    'definition_scope_closure_id',
  ]),
  maximum_definition_use_relationships: 64,
  definition_scope_closure_contract: NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
  definition_child_resolution_contract: Object.freeze({
    closure_reference_required_for_resolved_state: true,
    closure_must_match_notice_occurrence: true,
    closure_relationship_set_must_equal_notice_relationship_set: true,
    definition_scope_state_derivation: Object.freeze({
      RESOLVED_CLEAR: 'CLOSURE_RESOLVED_CLEAR',
      RESOLVED_WITH_REVIEW_NOTE: 'CLOSURE_RESOLVED_WITH_REVIEW_NOTE',
      BLOCKING_UNRESOLVED: 'CLOSURE_BLOCKING_OR_ABSENT',
    }),
    definition_uses_state_derivation: Object.freeze({
      RESOLVED_CLEAR:
        'ALL_REQUIRED_DEFINITION_USE_RELATIONSHIPS_VALID_AND_UNSUPPRESSED',
      RESOLVED_WITH_REVIEW_NOTE: 'FORBIDDEN',
      BLOCKING_UNRESOLVED:
        'ANY_REQUIRED_DEFINITION_USE_RELATIONSHIP_MISSING_INVALID_OR_SUPPRESSED',
    }),
    definition_dependency_state_derivation: Object.freeze({
      RESOLVED_CLEAR:
        'ALL_REQUIRED_DEPENDENCY_RELATIONSHIPS_VALID_ACYCLIC_AND_UNSUPPRESSED_AND_ZERO_REVIEWED_TERMINAL_OUTCOMES',
      RESOLVED_WITH_REVIEW_NOTE:
        'ALL_REQUIRED_DEPENDENCY_RELATIONSHIPS_VALID_ACYCLIC_AND_UNSUPPRESSED_AND_NONZERO_REVIEWED_TERMINAL_OUTCOMES',
      BLOCKING_UNRESOLVED:
        'ANY_REQUIRED_DEPENDENCY_MISSING_INVALID_CYCLIC_OR_SUPPRESSED',
      states_must_be_mutually_exclusive_and_exhaustive: true,
    }),
    independent_definition_child_labels_forbidden: true,
  }),
  notice_revision_identity_contract: Object.freeze({
    ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4.notice_revision_identity_contract,
    content_address_domain: 'NO_SHOP_NOTICE_OBLIGATION/V5',
    identity_inputs: Object.freeze([
      ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4.required_fields.filter(
        (field) => field !== 'notice_obligation_revision_id',
      ),
      'definition_scope_closure_id',
    ]),
  }),
});

const NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V6 = Object.freeze({
  ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5,
  schema_version: 6,
  record_schema: 'NO_SHOP_NOTICE_OBLIGATION/V6',
  copy_clock_scope_contract: Object.freeze({
    ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5.copy_clock_scope_contract,
    record_schema: 'NOTICE_COPY_CLOCK_SCOPE/V2',
    content_address_domain: 'NOTICE_COPY_CLOCK_SCOPE/V2',
    required_fields: Object.freeze([
      ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5.copy_clock_scope_contract
        .required_fields.filter(
          (field) => field !== 'item_or_batch_cardinality_state',
        ),
      'primary_clock_application_scope_code',
      'primary_item_or_batch_cardinality_state',
      'alternative_clock_application_scope_state',
      'alternative_item_or_batch_cardinality_state',
      'cardinality_ambiguity_scope_code',
      'comparability_state',
      'primary_metric_normalisation',
      'source_metric_lineage',
    ]),
    identity_inputs: Object.freeze([
      ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5.copy_clock_scope_contract
        .identity_inputs.filter(
          (field) => field !== 'item_or_batch_cardinality_state',
        ),
      'primary_clock_application_scope_code',
      'primary_item_or_batch_cardinality_state',
      'alternative_clock_application_scope_state',
      'alternative_item_or_batch_cardinality_state',
      'cardinality_ambiguity_scope_code',
      'comparability_state',
      'primary_metric_normalisation',
      'source_metric_lineage',
    ]),
    required_primary_clock_application_scope_code:
      'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE',
    allowed_primary_item_or_batch_cardinality_states: Object.freeze([
      'NOT_APPLICABLE',
    ]),
    required_primary_item_or_batch_cardinality_state: 'NOT_APPLICABLE',
    required_alternative_clock_application_scope_state:
      'UNRESOLVED_ITEM_OR_BATCH',
    allowed_alternative_item_or_batch_cardinality_states: Object.freeze([
      'UNRESOLVED',
    ]),
    required_alternative_item_or_batch_cardinality_state: 'UNRESOLVED',
    required_cardinality_ambiguity_scope_code:
      'ALTERNATIVE_ITEM_RECEIPT_INTERPRETATION_ONLY',
    legacy_combined_item_or_batch_cardinality_state_forbidden: true,
    required_comparability_effect_code:
      'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    required_comparability_state:
      'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG',
    required_resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
    resolution_state_derivation:
      'SELECTED_PRIMARY_CARDINALITY_NOT_APPLICABLE_AND_SOURCE_BACKED_ALTERNATIVE_CARDINALITY_UNRESOLVED',
    primary_metric_contract: Object.freeze({
      metric_role: 'COPY_DEADLINE_FROM_PROPOSAL_OR_REQUEST_RECEIPT',
      normalisation_schema: 'OBSERVATION_NORMALISATION/V1',
      value_kind: 'DURATION',
      required_raw_magnitude: '24',
      required_raw_unit: 'HOURS',
      required_canonical_value: '1',
      required_canonical_unit: 'DAYS',
      required_day_basis: 'ELAPSED',
      required_basis_key:
        'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
      required_trigger: 'PROPOSAL_OR_REQUEST_RECEIPT',
      required_derivation_version: 'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
      normalisation_payload_digest_required: true,
      source_timing_claim_revision_id_required: true,
      source_normalisation_payload_digest_required: true,
      cohort_requires_same_metric_role: true,
      cohort_requires_same_basis_key: true,
      item_receipt_clock_cohort_mix_forbidden: true,
      generic_notice_period_label_forbidden: true,
      promptly_qualifier_preservation_required: true,
    }),
    ambiguity_presentation_contract: Object.freeze({
      ambiguity_flag_required_in_every_review_compare_and_query_result: true,
      alternative_interpretation_required_in_every_review_compare_and_query_result:
        true,
      unresolved_alternative_must_not_be_rendered_as_absent_rejected_or_resolved:
        true,
      later_materials_timing_resolution_forbidden: true,
    }),
    interpretation_payload_binding: Object.freeze({
      ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5.copy_clock_scope_contract
        .interpretation_payload_binding,
      payload_schema: 'NOTICE_CLOCK_INTERPRETATION/V2',
      content_address_domain: 'NOTICE_CLOCK_INTERPRETATION/V2',
      payload_identity_inputs: Object.freeze([
        'subject_kind',
        'subject_identity',
        'policy_version',
        'clarity_state',
        'primary_interpretation',
        'alternative_interpretations',
        'ambiguity_dimension_codes',
        'primary_clock_application_scope_code',
        'alternative_clock_application_scope_state',
        'evidence_excerpt_ids',
        'lawyer_note_digest',
        'review_provenance',
      ]),
      duplicated_projection_fields_must_equal_payload: Object.freeze([
        ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5.copy_clock_scope_contract
          .interpretation_payload_binding
          .duplicated_projection_fields_must_equal_payload,
        Object.freeze({
          scope_field: 'primary_clock_application_scope_code',
          payload_field: 'primary_clock_application_scope_code',
        }),
        Object.freeze({
          scope_field: 'alternative_clock_application_scope_state',
          payload_field: 'alternative_clock_application_scope_state',
        }),
      ]),
    }),
  }),
  notice_revision_identity_contract: Object.freeze({
    ...NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5.notice_revision_identity_contract,
    content_address_domain: 'NO_SHOP_NOTICE_OBLIGATION/V6',
  }),
});

const NO_SHOP_SEMANTIC_SCHEMAS_V2 = Object.freeze(
  NO_SHOP_SEMANTIC_SCHEMAS_V1.map((entry) => (
    entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION'
      ? NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2
      : entry
  )),
);

const NO_SHOP_SEMANTIC_SCHEMAS_V3 = Object.freeze(
  NO_SHOP_SEMANTIC_SCHEMAS_V2.map((entry) => (
    entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION'
      ? NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3
      : entry
  )),
);

const NO_SHOP_SEMANTIC_SCHEMAS_V4 = Object.freeze(
  NO_SHOP_SEMANTIC_SCHEMAS_V3.map((entry) => (
    entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION'
      ? NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4
      : entry
  )),
);

const NO_SHOP_SEMANTIC_SCHEMAS_V5 = Object.freeze(
  NO_SHOP_SEMANTIC_SCHEMAS_V4.map((entry) => (
    entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION'
      ? NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5
      : entry
  )),
);

const NO_SHOP_SEMANTIC_SCHEMAS_V6 = Object.freeze(
  NO_SHOP_SEMANTIC_SCHEMAS_V5.map((entry) => (
    entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION'
      ? NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V6
      : entry
  )),
);

const FIXTURE_CONTRACT_INPUT_V7 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V6,
  relationship_definitions: Object.freeze(
    FIXTURE_CONTRACT_INPUT_V6.relationship_definitions.map((entry) => (
      entry.relationship_key === 'USES_DEFINITION'
        ? Object.freeze({
          ...entry,
          version: 2,
          effect_schema: 'USES_DEFINITION_EFFECT/V1',
        })
        : entry
    )),
  ),
  no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V2,
  claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V1,
  definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V1,
});

const FIXTURE_CONTRACT_INPUT_V8 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V7,
  relationship_definitions: Object.freeze(
    FIXTURE_CONTRACT_INPUT_V7.relationship_definitions.map((entry) => (
      entry.relationship_key === 'USES_DEFINITION'
        ? Object.freeze({
          ...entry,
          version: 3,
          effect_schema: 'USES_DEFINITION_EFFECT/V2',
        })
        : entry
    )),
  ),
  no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V3,
  definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V2,
});

const FIXTURE_CONTRACT_INPUT_V9 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V8,
  no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V4,
});

const FIXTURE_CONTRACT_INPUT_V10 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V9,
  no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V5,
});

const FIXTURE_CONTRACT_INPUT_V11 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V10,
  no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
});

const NO_SHOP_COPY_DELIVERY_PERIOD_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
  version: 1,
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  canonical_value_required_when_present: true,
});

const FIXTURE_CONTRACT_INPUT_V12 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V11,
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V11.claim_definitions,
    NO_SHOP_COPY_DELIVERY_PERIOD_CLAIM_DEFINITION_V1,
  ]),
  claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
});

const REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'REPRESENTATION_MEASUREMENT_DATE',
  version: 1,
  canonical_value_type: 'ISO_8601_DATE_STRING',
  canonical_value_required_when_present: true,
});

const GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'GENERAL_MATERIALITY_QUALIFIER',
  version: 1,
  allowed_canonical_values: Object.freeze([true]),
  canonical_value_required_when_present: true,
});

const RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'RETROSPECTIVE_LOOKBACK',
  version: 1,
  allowed_canonical_values: Object.freeze([true]),
  canonical_value_required_when_present: true,
});

const BRINGS_DOWN_EFFECT_SCHEMA_V1 = Object.freeze({
  schema_version: 'BRINGS_DOWN_EFFECT/V1',
  relationship_key: 'BRINGS_DOWN',
  relationship_definition_version: 2,
  legal_operation: 'TEST_REPRESENTATION_ACCURACY',
  source_endpoint_contract: Object.freeze({
    endpoint_kind: 'PROVISION_INSTANCE',
    required_concept_key: 'COND-B-REP',
    required_party_value: 'BUYER_GROUP',
  }),
  target_endpoint_contract: Object.freeze({
    endpoint_kind: 'PROVISION_COMPONENT',
    required_parent_concept_key: 'REP-T-CAP',
    required_component_key: 'REPRESENTATION_LIMB',
    same_deal_required: true,
    ordered_unique_targets_required: true,
    minimum_targets: 1,
    maximum_targets: 5,
    raw_scope_expansion_must_equal_resolved_targets: true,
  }),
  required_effect_fields: Object.freeze([
    'legal_operation',
    'effect_schema_version',
    'target_limb_occurrence_ids',
    'test_points',
    'dated_representation_proviso',
    'accuracy_standard',
    'accuracy_exception',
    'materiality_scrape',
    'evidence_excerpt_ids',
    'scope_closure_id',
  ]),
  allowed_test_point_codes: Object.freeze([
    'AGREEMENT_DATE',
    'CLOSING_DATE',
  ]),
  required_test_point_codes: Object.freeze([
    'AGREEMENT_DATE',
    'CLOSING_DATE',
  ]),
  dated_representation_proviso_contract: Object.freeze({
    required_application: 'EXPRESS_DATE_OR_PERIOD_ONLY',
    applies_to_comparison_classes: Object.freeze([
      'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
    ]),
    evidence_required: true,
  }),
  allowed_accuracy_standard_codes: Object.freeze([
    'MAT_ALL_RESPECTS_DE_MINIMIS',
    'MAT_ALL_MATERIAL',
  ]),
  allowed_accuracy_exception_codes: Object.freeze([
    'DE_MINIMIS_INACCURACIES',
  ]),
  materiality_scrape_contract: Object.freeze({
    allowed_states: Object.freeze(['NOT_APPLIED', 'APPLIED']),
    applied_state_required_qualifier_codes: Object.freeze([
      'MATERIAL',
      'MATERIALITY',
      'COMPANY_MATERIAL_ADVERSE_EFFECT',
    ]),
    clause_b_required_state: 'NOT_APPLIED',
    clause_c_required_state: 'APPLIED',
    exact_source_evidence_required: true,
  }),
  comparison_class_contracts: Object.freeze([
    Object.freeze({
      comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      required_target_limb_ordinals: Object.freeze([1, 3]),
      required_accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      required_accuracy_exception: 'DE_MINIMIS_INACCURACIES',
      required_materiality_scrape_state: 'NOT_APPLIED',
      required_definition_relationship_key: 'USES_DEFINITION',
    }),
    Object.freeze({
      comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      required_target_limb_ordinals: Object.freeze([2, 4, 5]),
      required_accuracy_standard: 'MAT_ALL_MATERIAL',
      required_accuracy_exception: null,
      required_materiality_scrape_state: 'APPLIED',
      required_definition_relationship_key: null,
    }),
  ]),
  maximum_evidence_excerpts: 16,
  complete_scope_closure_required: true,
  cross_class_target_overlap_forbidden: true,
  class_aggregation_forbidden: true,
});

const CAPITALISATION_REPRESENTATION_SCHEMA_V1 = Object.freeze({
  schema_key: 'CAPITALISATION_REPRESENTATION',
  schema_version: 1,
  record_schema: 'CAPITALISATION_REPRESENTATION/V1',
  representation_concept_key: 'REP-T-CAP',
  condition_concept_key: 'COND-B-REP',
  limb_component_key: 'REPRESENTATION_LIMB',
  condition_group_component_key: 'CAPITALISATION_ACCURACY_GROUP',
  condition_group_component_schema: 'CAPITALISATION_CONDITION_GROUP/V1',
  required_limb_ordinals: Object.freeze([1, 2, 3, 4, 5]),
  exact_limb_count: 5,
  exact_sub_limb_evidence_permitted: true,
  condition_group_contracts: Object.freeze([
    Object.freeze({
      source_clause_code: 'B',
      comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      required_limb_ordinals: Object.freeze([1, 3]),
    }),
    Object.freeze({
      source_clause_code: 'C',
      comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      required_limb_ordinals: Object.freeze([2, 4, 5]),
    }),
  ]),
  party_contract: Object.freeze({
    representation_maker: Object.freeze({
      role: 'REPRESENTATION_MAKER',
      value: 'COMPANY',
      capacity: 'TARGET',
    }),
    result_party: Object.freeze({
      role: 'CONDITION_BENEFICIARY',
      value: 'BUYER_GROUP',
      capacity: 'ACQUIRER',
    }),
    buyer_group_members: Object.freeze([
      Object.freeze({
        role: 'CONDITION_BENEFICIARY',
        value: 'PARENT',
        capacity: 'ACQUIRER',
      }),
      Object.freeze({
        role: 'CONDITION_BENEFICIARY',
        value: 'TITANIUM_MERGER_SUB',
        capacity: 'MERGER_SUB',
      }),
      Object.freeze({
        role: 'CONDITION_BENEFICIARY',
        value: 'FORWARD_MERGER_SUB',
        capacity: 'MERGER_SUB',
      }),
    ]),
    source_member_order_required: Object.freeze([
      'PARENT',
      'TITANIUM_MERGER_SUB',
      'FORWARD_MERGER_SUB',
    ]),
    one_result_and_observation_party_required: true,
  }),
  measurement_date_claim_contract: Object.freeze({
    claim_definition_key: 'REPRESENTATION_MEASUREMENT_DATE',
    canonical_value_type: 'ISO_8601_DATE_STRING',
    required_attributes: Object.freeze([
      'raw_measurement_date',
      'signing_date',
      'signing_relative_offset',
      'offset_unit',
      'day_basis',
      'semantic_class',
      'precision',
      'derivation_version',
      'signing_anchor_evidence_excerpt_ids',
    ]),
    required_offset_unit: 'CALENDAR_DAY',
    required_day_basis: 'CALENDAR_DAY',
    allowed_semantic_classes: Object.freeze([
      'NEAR_SIGNING_MEASUREMENT_SNAPSHOT',
    ]),
    allowed_precision_codes: Object.freeze(['EXACT']),
    qxo_required_measurement_date: '2026-04-17',
    qxo_required_signing_date: '2026-04-18',
    qxo_required_signing_relative_offset: -1,
    retrospective_lookback_projection_forbidden: true,
    unresolved_signing_anchor_comparability: 'NOT_COMPARABLE',
    raw_date_remains_reviewable_when_unresolved: true,
  }),
  qualifier_absence_scope_contract: Object.freeze({
    claim_definition_keys: Object.freeze([
      'KNOWLEDGE_QUALIFIER',
      'GENERAL_MATERIALITY_QUALIFIER',
      'RETROSPECTIVE_LOOKBACK',
    ]),
    required_claim_state: 'ABSENT',
    independent_scope_closure_per_claim_required: true,
    required_scope_members: Object.freeze([
      'REPRESENTATION_CHAPEAU',
      'REPRESENTATION_LIMB_I',
      'REPRESENTATION_LIMB_II',
      'REPRESENTATION_LIMB_III',
      'REPRESENTATION_LIMB_IV',
      'REPRESENTATION_LIMB_V',
      'APPLICABLE_PROVISOS',
      'DEFINED_TERM_USES',
      'CROSS_REFERENCES',
    ]),
    required_coverage_status: 'COMPLETE',
    exact_party_and_temporal_scope_required: true,
    candidate_selected_scope_forbidden: true,
    limb_iv_outside_investment_materiality_is_not_general_qualifier: true,
    measurement_date_is_not_retrospective_lookback: true,
  }),
  parser_layout_contract: Object.freeze({
    parser_source_transform: 'PARSER_V2_TEXT_LAYERS/V1',
    isolated_page_number_line: '16',
    immutable_source_bytes_preserved: true,
    parser_clean_text_exclusion_required: true,
    monotone_clean_to_source_projection_required: true,
    semantic_object_creation_for_page_marker_forbidden: true,
  }),
});

const TARGET_CAPITALISATION_BRING_DOWN_RESULT_DEFINITION_V2 = Object.freeze({
  result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
  result_version: 2,
  concept_key: 'COND-B-REP',
  party: Object.freeze({
    role: 'CONDITION_BENEFICIARY',
    value: 'BUYER_GROUP',
    capacity: 'ACQUIRER',
  }),
  completeness_rule: 'ALL_REQUIRED_PRIMARY_GROUPS_PRESENT',
  primary_comparison_slots: Object.freeze([
    Object.freeze({
      value_slot_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      ordinal: 0,
      comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      required_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      required_relationship_key: 'BRINGS_DOWN',
      required_relationship_version: 2,
      required_target_limb_ordinals: Object.freeze([1, 3]),
    }),
    Object.freeze({
      value_slot_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      ordinal: 1,
      comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      required_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      required_relationship_key: 'BRINGS_DOWN',
      required_relationship_version: 2,
      required_target_limb_ordinals: Object.freeze([2, 4, 5]),
    }),
  ]),
  contextual_claim_slots: Object.freeze([
    Object.freeze({
      value_slot_key: 'CAPITALISATION_MEASUREMENT_DATE',
      ordinal: 2,
      claim_definition_key: 'REPRESENTATION_MEASUREMENT_DATE',
      required_state: 'PRESENT',
    }),
    Object.freeze({
      value_slot_key: 'GENERAL_KNOWLEDGE_QUALIFIER',
      ordinal: 3,
      claim_definition_key: 'KNOWLEDGE_QUALIFIER',
      required_state: 'ABSENT',
    }),
    Object.freeze({
      value_slot_key: 'GENERAL_MATERIALITY_QUALIFIER',
      ordinal: 4,
      claim_definition_key: 'GENERAL_MATERIALITY_QUALIFIER',
      required_state: 'ABSENT',
    }),
    Object.freeze({
      value_slot_key: 'RETROSPECTIVE_LOOKBACK',
      ordinal: 5,
      claim_definition_key: 'RETROSPECTIVE_LOOKBACK',
      required_state: 'ABSENT',
    }),
  ]),
  expected_result_input_lineage_slots: Object.freeze([
    Object.freeze({
      value_slot_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      required_claim_definition_keys: Object.freeze([
        'REPRESENTATION_ACCURACY_STANDARD',
        'REPRESENTATION_ACCURACY_EXCEPTION',
      ]),
      required_relationship_keys: Object.freeze([
        'BRINGS_DOWN',
        'USES_DEFINITION',
      ]),
      required_comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
    }),
    Object.freeze({
      value_slot_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      required_claim_definition_keys: Object.freeze([
        'REPRESENTATION_ACCURACY_STANDARD',
      ]),
      required_relationship_keys: Object.freeze(['BRINGS_DOWN']),
      required_comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
    }),
    Object.freeze({
      value_slot_key: 'CAPITALISATION_MEASUREMENT_DATE',
      required_claim_definition_keys: Object.freeze([
        'REPRESENTATION_MEASUREMENT_DATE',
      ]),
      required_relationship_keys: Object.freeze([]),
      required_comparison_class_key: null,
    }),
    Object.freeze({
      value_slot_key: 'GENERAL_KNOWLEDGE_QUALIFIER',
      required_claim_definition_keys: Object.freeze([
        'KNOWLEDGE_QUALIFIER',
      ]),
      required_relationship_keys: Object.freeze([]),
      required_comparison_class_key: null,
    }),
    Object.freeze({
      value_slot_key: 'GENERAL_MATERIALITY_QUALIFIER',
      required_claim_definition_keys: Object.freeze([
        'GENERAL_MATERIALITY_QUALIFIER',
      ]),
      required_relationship_keys: Object.freeze([]),
      required_comparison_class_key: null,
    }),
    Object.freeze({
      value_slot_key: 'RETROSPECTIVE_LOOKBACK',
      required_claim_definition_keys: Object.freeze([
        'RETROSPECTIVE_LOOKBACK',
      ]),
      required_relationship_keys: Object.freeze([]),
      required_comparison_class_key: null,
    }),
  ]),
  class_aggregation_forbidden: true,
  tier_naming_in_new_identifiers_forbidden: true,
  independently_suppressible_contextual_claims: true,
});

const REPRESENTATION_ACCURACY_STANDARD_METRIC_DEFINITION_V2 = Object.freeze({
  metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
  metric_version: 2,
  concept_key: 'COND-B-REP',
  required_result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
  required_result_version: 2,
  owner_lineage_mode: 'RESULT_RELATIONSHIP',
  required_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
  required_relationship_key: 'BRINGS_DOWN',
  required_relationship_version: 2,
  value_dimension: 'CATEGORICAL',
  canonical_unit: 'ACCURACY_STANDARD_CODE',
  allowed_canonical_values: Object.freeze([
    'MAT_ALL_RESPECTS',
    'MAT_ALL_RESPECTS_DE_MINIMIS',
    'MAT_ALL_MATERIAL',
    'MAT_MAE_QUALIFIED',
  ]),
  comparison_classes: Object.freeze([
    Object.freeze({
      comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      required_value_slot_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
      required_target_limb_ordinals: Object.freeze([1, 3]),
    }),
    Object.freeze({
      comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      required_value_slot_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      required_target_limb_ordinals: Object.freeze([2, 4, 5]),
    }),
  ]),
  cohort_identity_requires_comparison_class: true,
  cross_class_aggregation_forbidden: true,
  distinct_metric_keys_per_class_forbidden: true,
  per_deal_rollup: 'DISTINCT_VALUE_SET_WITHIN_COMPARISON_CLASS',
  weighting: 'DEAL',
});

const FIXTURE_CONTRACT_INPUT_V13 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V12,
  relationship_definitions: Object.freeze(
    FIXTURE_CONTRACT_INPUT_V12.relationship_definitions.map((entry) => {
      if (entry.relationship_key === 'BRINGS_DOWN') {
        return Object.freeze({
          ...entry,
          version: 2,
          effect_schema: 'BRINGS_DOWN_EFFECT/V1',
        });
      }
      if (entry.relationship_key === 'USES_DEFINITION') {
        return Object.freeze({
          ...entry,
          version: 4,
          effect_schema: 'USES_DEFINITION_EFFECT/V3',
        });
      }
      return entry;
    }),
  ),
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V12.claim_definitions,
    REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1,
    GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1,
    RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1,
  ]),
  definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V3,
  brings_down_effect_schema: BRINGS_DOWN_EFFECT_SCHEMA_V1,
  capitalisation_semantic_schema: CAPITALISATION_REPRESENTATION_SCHEMA_V1,
  result_definitions: Object.freeze([
    TARGET_CAPITALISATION_BRING_DOWN_RESULT_DEFINITION_V2,
  ]),
  market_metric_definitions: Object.freeze([
    REPRESENTATION_ACCURACY_STANDARD_METRIC_DEFINITION_V2,
  ]),
});

// V14 (P1 cap-table numeric promotions, docs/superpowers/specs/
// 2026-08-02-p1-captable-numerics-design.md section 1): strictly additive
// spread of V13. Two new claim definitions govern the share-count and
// reserved-pool assertions the C1/C8/C9/C11 open-world clusters proposed --
// see the design doc for why class/pool identity travels as governed
// ATTRIBUTES on the claim (share_class_ref, count_kind, plan_ref) rather
// than in the claim_definition_key itself, mirroring the measurement-date
// precedent. No new concepts: both definitions live under the existing
// REP-T-CAP concept.
const CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'CAPITALIZATION_SHARE_COUNT',
  version: 1,
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  canonical_value_required_when_present: true,
});

const RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'RESERVED_SHARE_POOL',
  version: 1,
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  canonical_value_required_when_present: true,
});

const FIXTURE_CONTRACT_INPUT_V14 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V13,
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V13.claim_definitions,
    CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1,
    RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1,
  ]),
});

// V15 (family-termination-fee slice, docs/superpowers/specs/2026-08-02-
// family-termination-fee-design.md section 1): strictly additive spread of
// V14. New concepts: none -- TERMF-TARGET, TERMF-TAIL (V1) and
// TERMF-REVERSE (V3) already exist. Three new claim definitions govern the
// termination-fee dollar amount (per side), the fee trigger (an
// enum-valued, quote-grounded claim) and the tail period in months.
const TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'TERMINATION_FEE_AMOUNT',
  version: 1,
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  canonical_value_required_when_present: true,
});

// The trigger enum is the six codes ALREADY registered in
// TERMINATION_FEE_TRIGGER_PATH/V2.allowed_trigger_codes (never a parallel
// vocabulary) plus exactly one addition, SUPERIOR_PROPOSAL_TERMINATION (the
// company fiduciary-out termination) -- spec section 1. A test diffs this
// list against the trigger-path schema's own six codes so drift is loud.
const TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'TERMINATION_FEE_TRIGGER',
  version: 1,
  allowed_canonical_values: Object.freeze([
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'NO_SOLICIT_BREACH_TERMINATION',
    'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    'OUTSIDE_DATE_TERMINATION',
    'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
    'SUPERIOR_PROPOSAL_TERMINATION',
  ]),
  canonical_value_required_when_present: true,
});

const TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
  version: 1,
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  canonical_value_required_when_present: true,
});

const FIXTURE_CONTRACT_INPUT_V15 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V14,
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V14.claim_definitions,
    TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1,
    TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1,
    TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1,
  ]),
});

// V16 (family-mae-definition slice, docs/superpowers/specs/2026-08-02-
// family-mae-definition-design.md section 1, AUDIT-AMENDED): strictly
// additive spread of V15 (head at build time). One new concept (`DEF-MAE`,
// v1 subtype key reused verbatim -- spec: "one concept, not three") and
// three new enum-valued claim definitions. `MAE_CARVEOUT_CODES_V2` is the
// v1 `MAE_CARVEOUT_META` code list (lib/taxonomy.js) adopted verbatim minus
// `OTHER` -- exported so the producer prompt module single-sources it
// (spec section 1's "export it ... drift between prompt vocabulary and
// registry gate must be loud").
const MAE_CARVEOUT_CODES_V2 = Object.freeze([
  'ECONOMY_GENERAL',
  'INDUSTRY_GENERAL',
  'FINANCIAL_MARKETS',
  'ACTS_OF_WAR_TERRORISM',
  'NATURAL_DISASTERS',
  'PANDEMIC',
  'ANNOUNCEMENT_OR_PENDENCY',
  'COMPLIANCE_WITH_AGREEMENT',
  'ACTIONS_REQUESTED_BY_PARENT',
  'CHANGE_IN_LAW',
  'CHANGE_IN_GAAP',
  'STOCK_PRICE_CHANGES',
  'FAILURE_TO_MEET_PROJECTIONS',
  'PRICING_MFN',
  'EXECUTIVE_ACTION',
  'TARIFFS',
  'GOVERNMENT_SHUTDOWNS',
  'CLINICAL_RESULTS',
  'FDA_DISCUSSIONS',
  'FDA_APPROVALS_COMPETITOR_ENTRY',
  'SUPPLY_CHAIN',
  'PRICING_REIMBURSEMENT',
  'MEDICAL_ORGS_STATEMENTS',
  'PATENTS_EXCLUSIVITY',
  'PARENT_ACTIONS_OR_INACTION',
  'EMPLOYEE_DEPARTURES',
]);

const MAE_CARVEOUT_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'MAE_CARVEOUT',
  version: 1,
  allowed_canonical_values: MAE_CARVEOUT_CODES_V2,
  canonical_value_required_when_present: true,
});

const MAE_DEFINITION_PRONG_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'MAE_DEFINITION_PRONG',
  version: 1,
  allowed_canonical_values: Object.freeze(['BUSINESS_EFFECTS', 'CONSUMMATION_PREVENTION']),
  canonical_value_required_when_present: true,
});

const MAE_DISPROPORTIONALITY_CARVEBACK_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'MAE_DISPROPORTIONALITY_CARVEBACK',
  version: 1,
  allowed_canonical_values: Object.freeze([true]),
  canonical_value_required_when_present: true,
});

const FIXTURE_CONTRACT_INPUT_V16 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V15,
  concepts: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V15.concepts,
    Object.freeze({ concept_key: 'DEF-MAE', version: 1 }),
  ]),
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V15.claim_definitions,
    MAE_CARVEOUT_CLAIM_DEFINITION_V1,
    MAE_DEFINITION_PRONG_CLAIM_DEFINITION_V1,
    MAE_DISPROPORTIONALITY_CARVEBACK_CLAIM_DEFINITION_V1,
  ]),
});

// V17 (family-termination-rights slice, docs/superpowers/specs/2026-08-02-
// family-termination-rights-design.md section 1, AUDIT-AMENDED): strictly
// additive spread of V16. Two new concepts, TERMR-MUTUAL and TERMR-LEGAL
// (spec: "grows EXPECTED_CONCEPT_KEYS ... Both new concepts are FLAGGED FOR
// BEN in the PR body under the same convention as the 2026-07-23 concept
// amendment -- concept-key additions are taxonomy decisions, and this spec
// proposes rather than settles them"). Three new claim definitions: one
// presence claim (TERMINATION_RIGHT_GRANT) and two mechanical values
// (TERMINATION_OUTSIDE_DATE, TERMINATION_CURE_PERIOD_DAYS). No new
// canonical value types; no validator changes.
const TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'TERMINATION_RIGHT_GRANT',
  version: 1,
  allowed_canonical_values: Object.freeze([true]),
  canonical_value_required_when_present: true,
});

const TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'TERMINATION_OUTSIDE_DATE',
  version: 1,
  canonical_value_type: 'ISO_8601_DATE_STRING',
  canonical_value_required_when_present: true,
});

const TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1 = Object.freeze({
  claim_definition_key: 'TERMINATION_CURE_PERIOD_DAYS',
  version: 1,
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  canonical_value_required_when_present: true,
});

const FIXTURE_CONTRACT_INPUT_V17 = Object.freeze({
  ...FIXTURE_CONTRACT_INPUT_V16,
  concepts: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V16.concepts,
    Object.freeze({ concept_key: 'TERMR-MUTUAL', version: 1 }),
    Object.freeze({ concept_key: 'TERMR-LEGAL', version: 1 }),
  ]),
  claim_definitions: Object.freeze([
    ...FIXTURE_CONTRACT_INPUT_V16.claim_definitions,
    TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1,
    TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1,
    TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1,
  ]),
});

const EXPECTED_CONCEPT_KEYS_V1 = [
  'COND-B-REP',
  'IOC-CAPEX',
  'IOC-GENERAL-EXCEPT',
  'NOSOL-EXCEPT',
  'NOSOL-MATCH',
  'NOSOL-NOTICE',
  'NOSOL-PROHIBIT',
  'NOSOL-REMATCH',
  'REP-T-CAP',
  'REP-T-CONTRACTS',
  'TERMF-TAIL',
  'TERMF-TARGET',
  'TERMR-RECOMMEND',
  'TERMR-SUPERIOR',
];
const EXPECTED_CONCEPT_KEYS_V2 = [
  ...EXPECTED_CONCEPT_KEYS_V1,
  'TERMR-BREACH',
  'TERMR-NOSOL-BREACH',
  'TERMR-NOVOTE',
  'TERMR-OUTSIDE',
].sort();
const EXPECTED_CONCEPT_KEYS_V3 = [...EXPECTED_CONCEPT_KEYS_V2, 'TERMF-REVERSE'].sort();
// V4 (family-mae-definition slice): one new concept, `DEF-MAE`.
const EXPECTED_CONCEPT_KEYS_V4 = [...EXPECTED_CONCEPT_KEYS_V3, 'DEF-MAE'].sort();
// V5 (family-termination-rights slice): two new concepts, `TERMR-MUTUAL`
// and `TERMR-LEGAL` -- both FLAGGED FOR BEN in the PR body (spec section 1).
const EXPECTED_CONCEPT_KEYS_V5 = [
  ...EXPECTED_CONCEPT_KEYS_V4,
  'TERMR-MUTUAL',
  'TERMR-LEGAL',
].sort();
const EXPECTED_COMPONENT_KEYS = [
  'COVENANT_LIMB',
  'EXCEPTION_LIMB',
  'FEE_AMOUNT_LIMB',
  'MATCH_PERIOD_LIMB',
  'MATERIAL_CONTRACT_CRITERION',
  'NOTICE_LIMB',
  'REPRESENTATION_LIMB',
  'RESTRICTED_ACTION',
  'TERMINATION_TRIGGER_LIMB',
];
const EXPECTED_RELATIONSHIP_KEYS = ['BRINGS_DOWN', 'CONTAINED_IN', 'EXCEPTED_BY', 'TRIGGERED_BY', 'USES_DEFINITION'];
const EXPECTED_CLAIM_KEYS_V1 = [
  'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  'KNOWLEDGE_QUALIFIER',
  'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  'NO_SHOP_EXCEPTION_PREREQUISITE',
  'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
  'NO_SHOP_NOTICE_PERIOD_DAYS',
  'NO_SHOP_PROHIBITED_ACTION',
  'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
  'REPRESENTATION_ACCURACY_EXCEPTION',
  'REPRESENTATION_ACCURACY_STANDARD',
  'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
];
const EXPECTED_CLAIM_KEYS_V3 = [
  ...EXPECTED_CLAIM_KEYS_V1,
  'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
].sort();
const EXPECTED_CLAIM_KEYS_V4 = [
  ...EXPECTED_CLAIM_KEYS_V3,
  'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS',
].sort();
const EXPECTED_CLAIM_KEYS_V13 = [
  ...EXPECTED_CLAIM_KEYS_V4,
  'GENERAL_MATERIALITY_QUALIFIER',
  'REPRESENTATION_MEASUREMENT_DATE',
  'RETROSPECTIVE_LOOKBACK',
].sort();
const EXPECTED_CLAIM_KEYS_V14 = [
  ...EXPECTED_CLAIM_KEYS_V13,
  'CAPITALIZATION_SHARE_COUNT',
  'RESERVED_SHARE_POOL',
].sort();
const EXPECTED_CLAIM_KEYS_V15 = [
  ...EXPECTED_CLAIM_KEYS_V14,
  'TERMINATION_FEE_AMOUNT',
  'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
  'TERMINATION_FEE_TRIGGER',
].sort();
const EXPECTED_CLAIM_KEYS_V16 = [
  ...EXPECTED_CLAIM_KEYS_V15,
  'MAE_CARVEOUT',
  'MAE_DEFINITION_PRONG',
  'MAE_DISPROPORTIONALITY_CARVEBACK',
].sort();
const EXPECTED_CLAIM_KEYS_V17 = [
  ...EXPECTED_CLAIM_KEYS_V16,
  'TERMINATION_RIGHT_GRANT',
  'TERMINATION_OUTSIDE_DATE',
  'TERMINATION_CURE_PERIOD_DAYS',
].sort();
const EXPECTED_STATES = ['PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED'];
const EXPECTED_EXACT_DETAIL_ACTION_KEYS_V1 = [
  'ACCURACY_STANDARD_CLAIM_EVIDENCE',
  'RESULT_COMPONENT_CLAIM_EVIDENCE',
  'RESULT_COMPOSITION_EVIDENCE',
  'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE',
];
const EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3 = [
  ...EXPECTED_EXACT_DETAIL_ACTION_KEYS_V1,
  'TERMINATION_FEE_TRIGGER_EVIDENCE',
].sort();
const EXPECTED_METRIC_OPERATION_BINDING_KEYS_V3 = [
  'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V1',
];
const EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4 = [
  'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
  'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2',
];
const EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4 = ['TERMINATION_FEE_TRIGGER_PATH/V2'];
const EXPECTED_RESIDUAL_REASON_CODES_V1 = [
  'UNKNOWN_ATTRIBUTE',
  'INVALID_TAXONOMY_CODE',
  'PRESENT_WITHOUT_EVIDENCE',
  'ABSENT_WITHOUT_COMPLETE_SCOPE',
  'NON_PRESENT_ASSERTED_VALUE',
  'PRESENT_WITHOUT_RESOLVED_TARGET',
  'PRESENT_WITHOUT_EFFECT',
  'STATE_DETAIL_REQUIRED',
  'INVALID_CANONICAL_VALUE',
  'CANONICAL_IDENTITY_MISMATCH',
  'EVIDENCE_REFERENCE_UNRESOLVED',
  'SEMANTIC_REFERENCE_UNRESOLVED',
];
const EXPECTED_RESIDUAL_REASON_CODES_V5 = [
  ...EXPECTED_RESIDUAL_REASON_CODES_V1,
  'INVALID_DENOMINATOR_PRECISION',
];
const KNOWN_VERSION_SHAPES = Object.freeze([
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V1,
    claims: EXPECTED_CLAIM_KEYS_V1,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V1.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V1.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V1,
    metric_operation_bindings: [],
    trigger_path_schemas: [],
    money_denominator_precision_policy: null,
    no_shop_semantic_schemas: null,
    claim_interpretation_policy: null,
    definition_use_effect_schema: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V2,
    claims: EXPECTED_CLAIM_KEYS_V1,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V2.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V2.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V1,
    metric_operation_bindings: [],
    trigger_path_schemas: [],
    money_denominator_precision_policy: null,
    no_shop_semantic_schemas: null,
    claim_interpretation_policy: null,
    definition_use_effect_schema: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V3.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V3.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V3,
    trigger_path_schemas: [],
    money_denominator_precision_policy: null,
    no_shop_semantic_schemas: null,
    claim_interpretation_policy: null,
    definition_use_effect_schema: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V4.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V4.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: null,
    no_shop_semantic_schemas: null,
    claim_interpretation_policy: null,
    definition_use_effect_schema: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V5.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V5.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: null,
    claim_interpretation_policy: null,
    definition_use_effect_schema: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V6.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V6.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V1,
    claim_interpretation_policy: null,
    definition_use_effect_schema: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V7.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V7.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V2,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V1,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V1,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V8.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V8.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V3,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V1,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V2,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V9.claim_definitions,
    relationship_definitions: FIXTURE_CONTRACT_INPUT_V9.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V4,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V1,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V2,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V10.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V10.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V5,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V1,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V2,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V11.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V11.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V1,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V2,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V4,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V12.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V12.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V2,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V13,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V13.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V13.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V3,
    brings_down_effect_schema: BRINGS_DOWN_EFFECT_SCHEMA_V1,
    capitalisation_semantic_schema: CAPITALISATION_REPRESENTATION_SCHEMA_V1,
    result_definitions: FIXTURE_CONTRACT_INPUT_V13.result_definitions,
    market_metric_definitions:
      FIXTURE_CONTRACT_INPUT_V13.market_metric_definitions,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V14,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V14.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V14.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V3,
    brings_down_effect_schema: BRINGS_DOWN_EFFECT_SCHEMA_V1,
    capitalisation_semantic_schema: CAPITALISATION_REPRESENTATION_SCHEMA_V1,
    result_definitions: FIXTURE_CONTRACT_INPUT_V14.result_definitions,
    market_metric_definitions:
      FIXTURE_CONTRACT_INPUT_V14.market_metric_definitions,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V15,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V15.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V15.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V3,
    brings_down_effect_schema: BRINGS_DOWN_EFFECT_SCHEMA_V1,
    capitalisation_semantic_schema: CAPITALISATION_REPRESENTATION_SCHEMA_V1,
    result_definitions: FIXTURE_CONTRACT_INPUT_V15.result_definitions,
    market_metric_definitions:
      FIXTURE_CONTRACT_INPUT_V15.market_metric_definitions,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V4,
    claims: EXPECTED_CLAIM_KEYS_V16,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V16.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V16.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V3,
    brings_down_effect_schema: BRINGS_DOWN_EFFECT_SCHEMA_V1,
    capitalisation_semantic_schema: CAPITALISATION_REPRESENTATION_SCHEMA_V1,
    result_definitions: FIXTURE_CONTRACT_INPUT_V16.result_definitions,
    market_metric_definitions:
      FIXTURE_CONTRACT_INPUT_V16.market_metric_definitions,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V5,
    claims: EXPECTED_CLAIM_KEYS_V17,
    claim_definitions: FIXTURE_CONTRACT_INPUT_V17.claim_definitions,
    relationship_definitions:
      FIXTURE_CONTRACT_INPUT_V17.relationship_definitions,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
    no_shop_semantic_schemas: NO_SHOP_SEMANTIC_SCHEMAS_V6,
    claim_interpretation_policy: CLAIM_INTERPRETATION_POLICY_V2,
    definition_use_effect_schema: USES_DEFINITION_EFFECT_SCHEMA_V3,
    brings_down_effect_schema: BRINGS_DOWN_EFFECT_SCHEMA_V1,
    capitalisation_semantic_schema: CAPITALISATION_REPRESENTATION_SCHEMA_V1,
    result_definitions: FIXTURE_CONTRACT_INPUT_V17.result_definitions,
    market_metric_definitions:
      FIXTURE_CONTRACT_INPUT_V17.market_metric_definitions,
  }),
]);
const EXPECTED_PROPOSAL_BOUNDARY = Object.freeze({
  adapter_key: 'PARSER_V2_STRUCTURAL_DEFINITION_PROPOSAL',
  adapter_version: 1,
  allowed_proposal_kinds: ['STRUCTURAL_SECTION', 'DEFINITION_CANDIDATE'],
  canonical_write_permission: false,
  absence_decision_permission: false,
  comparability_decision_permission: false,
  semantic_identity_permission: false,
  exact_evidence_required: true,
  coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
  source_transform: 'PARSER_V2_TEXT_LAYERS/V1',
});

function sortedUnique(values, label) {
  if (!Array.isArray(values) || values.length === 0) throw new TypeError(`${label} must be a non-empty array`);
  const sorted = [...values].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error(`${label} contains duplicates`);
  return sorted;
}

function assertExact(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} does not match the frozen fixture contract`);
  }
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('contract input must be an object');
  if (input.schema_version !== 'FIXTURE_CONTRACT_INPUT/V1') throw new Error('invalid fixture contract schema version');
  if (input.contract_key !== 'CANONICAL_V2_VERTICAL_SLICE') throw new Error('invalid fixture contract key');

  const concepts = sortedUnique(input.concepts.map((entry) => entry && entry.concept_key), 'concept keys');
  const components = sortedUnique(
    input.component_definitions.map((entry) => entry && entry.component_key),
    'component keys',
  );
  const relationships = sortedUnique(
    input.relationship_definitions.map((entry) => entry && entry.relationship_key),
    'relationship keys',
  );
  const relationshipDefinitions = [...input.relationship_definitions].sort(
    (a, b) => a.relationship_key.localeCompare(b.relationship_key),
  );
  const claims = sortedUnique(
    input.claim_definitions.map((entry) => entry && entry.claim_definition_key),
    'claim definition keys',
  );
  assertExact(components, EXPECTED_COMPONENT_KEYS, 'component keys');
  assertExact(relationships, EXPECTED_RELATIONSHIP_KEYS, 'relationship keys');
  assertExact(input.claim_states, EXPECTED_STATES, 'claim states');
  assertExact(input.party_tuple_fields, ['role', 'value', 'capacity'], 'party tuple fields');
  const exactDetailActions = sortedUnique(
    input.serving_exact_detail_actions.map((entry) => entry && entry.action_slot_key),
    'serving exact-detail action keys',
  );
  const metricOperationBindings = input.serving_metric_operation_bindings == null
    ? []
    : sortedUnique(
      input.serving_metric_operation_bindings.map((entry) => entry && entry.binding_key),
      'serving metric-operation binding keys',
    );
  const triggerPathSchemas = input.serving_trigger_path_schemas == null
    ? []
    : sortedUnique(
      input.serving_trigger_path_schemas.map(
        (entry) => entry && `${entry.schema_key}/V${entry.schema_version}`,
      ),
      'serving trigger-path schema keys',
    );
  const versionShape = KNOWN_VERSION_SHAPES.find((shape) => (
    canonicalJson(concepts) === canonicalJson(shape.concepts)
    && canonicalJson(claims) === canonicalJson(shape.claims)
    && canonicalJson([...input.claim_definitions].sort(
      (a, b) => a.claim_definition_key.localeCompare(b.claim_definition_key),
    )) === canonicalJson([...shape.claim_definitions].sort(
      (a, b) => a.claim_definition_key.localeCompare(b.claim_definition_key),
    ))
    && canonicalJson(relationshipDefinitions)
      === canonicalJson([...shape.relationship_definitions].sort(
        (a, b) => a.relationship_key.localeCompare(b.relationship_key),
      ))
    && canonicalJson(exactDetailActions) === canonicalJson(shape.exact_detail_actions)
    && canonicalJson(metricOperationBindings) === canonicalJson(shape.metric_operation_bindings)
    && canonicalJson(triggerPathSchemas) === canonicalJson(shape.trigger_path_schemas)
    && canonicalJson(input.money_denominator_precision_policy || null)
      === canonicalJson(shape.money_denominator_precision_policy)
    && canonicalJson(input.no_shop_semantic_schemas || null)
      === canonicalJson(shape.no_shop_semantic_schemas)
    && canonicalJson(input.claim_interpretation_policy || null)
      === canonicalJson(shape.claim_interpretation_policy)
    && canonicalJson(input.definition_use_effect_schema || null)
      === canonicalJson(shape.definition_use_effect_schema)
    && canonicalJson(input.brings_down_effect_schema || null)
      === canonicalJson(shape.brings_down_effect_schema || null)
    && canonicalJson(input.capitalisation_semantic_schema || null)
      === canonicalJson(shape.capitalisation_semantic_schema || null)
    && canonicalJson(input.result_definitions || null)
      === canonicalJson(shape.result_definitions || null)
    && canonicalJson(input.market_metric_definitions || null)
      === canonicalJson(shape.market_metric_definitions || null)
  ));
  if (!versionShape) {
    throw new Error('concept keys do not match any frozen fixture contract version or its bound claims, actions and metrics');
  }
  assertExact(
    input.residual_reason_codes,
    versionShape.money_denominator_precision_policy == null
      ? EXPECTED_RESIDUAL_REASON_CODES_V1
      : EXPECTED_RESIDUAL_REASON_CODES_V5,
    'residual reason codes',
  );
  assertExact(input.parser_proposal_boundary, EXPECTED_PROPOSAL_BOUNDARY, 'parser proposal boundary');

  for (const entry of input.concepts) {
    if (!entry || entry.version !== 1 || Object.keys(entry).sort().join(',') !== 'concept_key,version') {
      throw new Error('invalid fixture concept definition');
    }
  }
  for (const entry of input.component_definitions) {
    if (!entry || entry.version !== 1 || Object.keys(entry).sort().join(',') !== 'component_key,version') {
      throw new Error('invalid fixture component definition');
    }
  }
  for (const entry of input.relationship_definitions) {
    const isTypedDefinitionUse = entry?.relationship_key === 'USES_DEFINITION'
      && entry.effect_mode === 'TYPED_LEGAL_EFFECT'
      && ((entry.version === 2 && entry.effect_schema === 'USES_DEFINITION_EFFECT/V1')
        || (entry.version === 3 && entry.effect_schema === 'USES_DEFINITION_EFFECT/V2')
        || (entry.version === 4 && entry.effect_schema === 'USES_DEFINITION_EFFECT/V3'))
      && Object.keys(entry).sort().join(',')
        === 'effect_mode,effect_schema,relationship_key,version';
    const isTypedBringsDown = entry?.relationship_key === 'BRINGS_DOWN'
      && entry.effect_mode === 'TYPED_LEGAL_EFFECT'
      && entry.version === 2
      && entry.effect_schema === 'BRINGS_DOWN_EFFECT/V1'
      && Object.keys(entry).sort().join(',')
        === 'effect_mode,effect_schema,relationship_key,version';
    if (!entry || !Number.isSafeInteger(entry.version) || entry.version < 1
      || !['NON_SEMANTIC', 'TYPED_LEGAL_EFFECT'].includes(entry.effect_mode)
      || (entry.effect_schema != null
        && !isTypedDefinitionUse
        && !isTypedBringsDown)) {
      throw new Error('invalid fixture relationship definition');
    }
    if (!isTypedDefinitionUse && !isTypedBringsDown
      && Object.keys(entry).sort().join(',') !== 'effect_mode,relationship_key,version') {
      throw new Error('invalid fixture relationship fields');
    }
  }
  for (const entry of input.claim_definitions) {
    const enumDefinition = Array.isArray(entry && entry.allowed_canonical_values)
      && entry.allowed_canonical_values.length > 0
      && Object.keys(entry).sort().join(',') === 'allowed_canonical_values,canonical_value_required_when_present,claim_definition_key,version';
    const typedDefinition = entry
      // P2 (docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md
      // section 3): SCHEDULE_REFERENCE_STRING added. The ONLY registry-
      // validator change this slice.
      && ['ISO_8601_DATE_STRING', 'NON_NEGATIVE_DECIMAL_STRING', 'SCHEDULE_REFERENCE_STRING']
        .includes(entry.canonical_value_type)
      && Object.keys(entry).sort().join(',') === 'canonical_value_required_when_present,canonical_value_type,claim_definition_key,version';
    if (!entry || !Number.isSafeInteger(entry.version) || entry.version < 1
      || entry.canonical_value_required_when_present !== true
      || (!enumDefinition && !typedDefinition)) {
      throw new Error('invalid fixture claim definition');
    }
  }
  for (const entry of input.serving_exact_detail_actions) {
    const claimEvidenceAction = entry
      && entry.parent_kind === 'RESULT_ROW'
      && entry.detail_kind === 'CLAIM_EVIDENCE'
      && entry.selection_path_schema === 'RESULT_COMPONENT_CLAIM_EVIDENCE/V1'
      && entry.comparator === 'COMPONENT_ORDINAL_THEN_EVIDENCE_ORDINAL'
      && entry.object_authorisation_predicate === 'PARENT_SELECTED_CLAIM_EVIDENCE_ONLY'
      && entry.response_schema === 'SERVING_EXACT_DETAIL_CLAIM_EVIDENCE_RESPONSE/V1';
    const openWorldEvidenceAction = entry
      && entry.parent_kind === 'REVIEWED_SOURCE_SPECIFIC_ROW'
      && entry.detail_kind === 'OPEN_WORLD_EVIDENCE'
      && entry.selection_path_schema === 'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE/V1'
      && entry.comparator === 'EVIDENCE_ORDINAL'
      && entry.object_authorisation_predicate === 'PARENT_SELECTED_OPEN_WORLD_EVIDENCE_ONLY'
      && entry.response_schema === 'SERVING_EXACT_DETAIL_OPEN_WORLD_EVIDENCE_RESPONSE/V1';
    const resultCompositionEvidenceAction = entry
      && entry.parent_kind === 'RESULT_ROW'
      && entry.detail_kind === 'RESULT_COMPOSITION_EVIDENCE'
      && entry.selection_path_schema === 'RESULT_COMPOSITION_SOURCE_CLOSURE/V1'
      && entry.comparator === 'COMPONENT_ORDINAL_THEN_RELATIONSHIP_THEN_SOURCE_ORDER'
      && entry.object_authorisation_predicate === 'PARENT_SELECTED_RESULT_COMPOSITION_ONLY'
      && entry.response_schema === 'SERVING_EXACT_DETAIL_RESULT_COMPOSITION_RESPONSE/V1';
    const terminationFeeTriggerEvidenceAction = entry
      && entry.parent_kind === 'RESULT_ROW'
      && entry.detail_kind === 'TERMINATION_FEE_TRIGGER_EVIDENCE'
      && ['RESULT_TERMINATION_FEE_TRIGGER_SET/V1', 'RESULT_TERMINATION_FEE_TRIGGER_SET/V2']
        .includes(entry.selection_path_schema)
      && entry.comparator === 'RELATIONSHIP_ORDINAL_THEN_SOURCE_ORDER'
      && entry.object_authorisation_predicate === 'PARENT_SELECTED_TERMINATION_FEE_TRIGGER_SET_ONLY'
      && ['SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V1',
        'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2']
        .includes(entry.response_schema);
    const actionShapeMatchesKey = entry
      && (entry.action_slot_key === 'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE'
        ? openWorldEvidenceAction
        : entry.action_slot_key === 'RESULT_COMPOSITION_EVIDENCE'
          ? resultCompositionEvidenceAction
          : entry.action_slot_key === 'TERMINATION_FEE_TRIGGER_EVIDENCE'
            ? terminationFeeTriggerEvidenceAction
        : claimEvidenceAction);
    const isV2TerminationAction = entry?.action_slot_key === 'TERMINATION_FEE_TRIGGER_EVIDENCE'
      && entry.action_version === 2
      && entry.selection_path_schema === 'RESULT_TERMINATION_FEE_TRIGGER_SET/V2'
      && entry.response_schema === 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2'
      && entry.projection_version === 2;
    if (!entry
      || (entry.action_version !== 1 && !isV2TerminationAction)
      || !actionShapeMatchesKey
      || entry.contextual_cardinality !== 'EXACTLY_ONE'
      || entry.duplicate_policy !== 'REJECT_NON_IDENTICAL_COLLAPSE_EXACT'
      || entry.maximum_references !== 1
      || (entry.maximum_encoded_bytes !== 16384
        && !(isV2TerminationAction && entry.maximum_encoded_bytes === 32768))
      || entry.whole_document_permission !== false
      || entry.route !== 'INLINE_BATCH'
      || (entry.projection_version !== 1 && !isV2TerminationAction)
      || Object.keys(entry).sort().join(',') !== [
        'action_slot_key',
        'action_version',
        'comparator',
        'contextual_cardinality',
        'detail_kind',
        'duplicate_policy',
        'maximum_encoded_bytes',
        'maximum_references',
        'object_authorisation_predicate',
        'parent_kind',
        'projection_version',
        'response_schema',
        'route',
        'selection_path_schema',
        'whole_document_permission',
      ].sort().join(',')) {
      throw new Error('invalid fixture exact-detail action definition');
    }
  }
  if (input.serving_metric_operation_bindings != null) {
    const expectedBindings = input.serving_trigger_path_schemas == null
      ? V3_METRIC_OPERATION_BINDINGS
      : V4_METRIC_OPERATION_BINDINGS;
    assertExact(input.serving_metric_operation_bindings, expectedBindings, 'serving metric-operation bindings');
  }
  if (input.serving_trigger_path_schemas != null) {
    assertExact(
      input.serving_trigger_path_schemas,
      [TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2],
      'serving trigger-path schemas',
    );
  }
  const terminationFeeAction = input.serving_exact_detail_actions.find(
    (entry) => entry.action_slot_key === 'TERMINATION_FEE_TRIGGER_EVIDENCE',
  );
  if (terminationFeeAction) {
    assertExact(
      terminationFeeAction,
      input.serving_trigger_path_schemas == null
        ? V3_ADDED_EXACT_DETAIL_ACTIONS[0]
        : V4_TERMINATION_FEE_EXACT_DETAIL_ACTION,
      'termination-fee exact-detail action',
    );
  }
  if (input.money_denominator_precision_policy != null) {
    assertExact(
      input.money_denominator_precision_policy,
      MONEY_DENOMINATOR_PRECISION_POLICY_V1,
      'money denominator precision policy',
    );
  }
  if (input.no_shop_semantic_schemas != null) {
    const noticeSchemaVersion = input.no_shop_semantic_schemas.find(
      (entry) => entry.schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
    )?.schema_version;
    assertExact(
      input.no_shop_semantic_schemas,
      input.claim_interpretation_policy == null
        ? NO_SHOP_SEMANTIC_SCHEMAS_V1
        : noticeSchemaVersion === 6
          ? NO_SHOP_SEMANTIC_SCHEMAS_V6
          : noticeSchemaVersion === 5
            ? NO_SHOP_SEMANTIC_SCHEMAS_V5
            : noticeSchemaVersion === 4
              ? NO_SHOP_SEMANTIC_SCHEMAS_V4
              : input.definition_use_effect_schema?.schema_version
                  === 'USES_DEFINITION_EFFECT/V2'
                ? NO_SHOP_SEMANTIC_SCHEMAS_V3
                : NO_SHOP_SEMANTIC_SCHEMAS_V2,
      'no-shop semantic schemas',
    );
  }
  if (input.claim_interpretation_policy != null) {
    assertExact(
      input.claim_interpretation_policy,
      input.claim_interpretation_policy.schema_version
          === 'CLAIM_INTERPRETATION_POLICY/V2'
        ? CLAIM_INTERPRETATION_POLICY_V2
        : CLAIM_INTERPRETATION_POLICY_V1,
      'claim interpretation policy',
    );
  }
  if (input.definition_use_effect_schema != null) {
    assertExact(
      input.definition_use_effect_schema,
      input.definition_use_effect_schema.schema_version === 'USES_DEFINITION_EFFECT/V3'
        ? USES_DEFINITION_EFFECT_SCHEMA_V3
        : input.definition_use_effect_schema.schema_version === 'USES_DEFINITION_EFFECT/V2'
          ? USES_DEFINITION_EFFECT_SCHEMA_V2
          : USES_DEFINITION_EFFECT_SCHEMA_V1,
      'definition-use effect schema',
    );
  }
  if (input.brings_down_effect_schema != null) {
    assertExact(
      input.brings_down_effect_schema,
      BRINGS_DOWN_EFFECT_SCHEMA_V1,
      'bring-down effect schema',
    );
  }
  if (input.capitalisation_semantic_schema != null) {
    assertExact(
      input.capitalisation_semantic_schema,
      CAPITALISATION_REPRESENTATION_SCHEMA_V1,
      'capitalisation semantic schema',
    );
  }
  if (input.result_definitions != null) {
    assertExact(
      input.result_definitions,
      [TARGET_CAPITALISATION_BRING_DOWN_RESULT_DEFINITION_V2],
      'result definitions',
    );
  }
  if (input.market_metric_definitions != null) {
    assertExact(
      input.market_metric_definitions,
      [REPRESENTATION_ACCURACY_STANDARD_METRIC_DEFINITION_V2],
      'market metric definitions',
    );
  }
}

function compileParserProposalBoundary(entry) {
  const body = {
    schema_version: 'PARSER_PROPOSAL_BOUNDARY_DEFINITION/V1',
    ...entry,
  };
  return Object.freeze({
    ...body,
    proposal_boundary_definition_id: contentId('PARSER_PROPOSAL_BOUNDARY_DEFINITION/V1', body),
    proposal_boundary_definition_payload_digest: contentId(
      'PARSER_PROPOSAL_BOUNDARY_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileExactDetailAction(entry) {
  const body = {
    schema_version: 'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1',
    ...entry,
  };
  return Object.freeze({
    ...body,
    action_definition_id: contentId('SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1', body),
    action_definition_payload_digest: contentId(
      'SERVING_EXACT_DETAIL_ACTION_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileTriggerPathSchema(entry) {
  const {
    schema_key: triggerPathSchemaKey,
    schema_version: triggerPathSchemaVersion,
    ...definition
  } = entry;
  const body = {
    schema_version: 'SERVING_TRIGGER_PATH_SCHEMA_DEFINITION/V1',
    trigger_path_schema_key: triggerPathSchemaKey,
    trigger_path_schema_version: triggerPathSchemaVersion,
    ...definition,
  };
  return Object.freeze({
    ...body,
    trigger_path_schema_definition_id: contentId(
      'SERVING_TRIGGER_PATH_SCHEMA_DEFINITION/V1',
      body,
    ),
    trigger_path_schema_definition_payload_digest: contentId(
      'SERVING_TRIGGER_PATH_SCHEMA_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileNoShopSemanticSchema(entry) {
  const {
    schema_key: semanticSchemaKey,
    schema_version: semanticSchemaVersion,
    ...definition
  } = entry;
  const body = {
    schema_version: 'NO_SHOP_SEMANTIC_SCHEMA_DEFINITION/V1',
    semantic_schema_key: semanticSchemaKey,
    semantic_schema_version: semanticSchemaVersion,
    ...definition,
  };
  return Object.freeze({
    ...body,
    semantic_schema_definition_id: contentId(
      'NO_SHOP_SEMANTIC_SCHEMA_DEFINITION/V1',
      body,
    ),
    semantic_schema_definition_payload_digest: contentId(
      'NO_SHOP_SEMANTIC_SCHEMA_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileCapitalisationSemanticSchema(entry) {
  const {
    schema_key: semanticSchemaKey,
    schema_version: semanticSchemaVersion,
    ...definition
  } = entry;
  const body = {
    schema_version: 'CAPITALISATION_SEMANTIC_SCHEMA_DEFINITION/V1',
    semantic_schema_key: semanticSchemaKey,
    semantic_schema_version: semanticSchemaVersion,
    ...definition,
  };
  return Object.freeze({
    ...body,
    semantic_schema_definition_id: contentId(
      'CAPITALISATION_SEMANTIC_SCHEMA_DEFINITION/V1',
      body,
    ),
    semantic_schema_definition_payload_digest: contentId(
      'CAPITALISATION_SEMANTIC_SCHEMA_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileResultDefinition(entry) {
  const body = {
    schema_version: 'RESULT_DEFINITION/V1',
    ...entry,
  };
  return Object.freeze({
    ...body,
    result_definition_id: contentId('RESULT_DEFINITION/V1', body),
    result_definition_payload_digest: contentId(
      'RESULT_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileMarketMetricDefinition(entry) {
  const body = {
    schema_version: 'METRIC_DEFINITION/V1',
    ...entry,
  };
  return Object.freeze({
    ...body,
    metric_definition_id: contentId('METRIC_DEFINITION/V1', body),
    metric_definition_payload_digest: contentId(
      'METRIC_DEFINITION_PAYLOAD/V1',
      body,
    ),
  });
}

function compileFixtureContract(input = FIXTURE_CONTRACT_INPUT_V1) {
  validateInput(input);
  const payload = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE/V1',
    contract_key: input.contract_key,
    concepts: [...input.concepts].sort((a, b) => a.concept_key.localeCompare(b.concept_key)),
    component_definitions: [...input.component_definitions]
      .sort((a, b) => a.component_key.localeCompare(b.component_key)),
    relationship_definitions: [...input.relationship_definitions]
      .sort((a, b) => a.relationship_key.localeCompare(b.relationship_key)),
    claim_definitions: [...input.claim_definitions]
      .sort((a, b) => a.claim_definition_key.localeCompare(b.claim_definition_key)),
    claim_states: [...input.claim_states],
    party_tuple_fields: [...input.party_tuple_fields],
    residual_reason_codes: [...input.residual_reason_codes],
    serving_exact_detail_action_definitions: [...input.serving_exact_detail_actions]
      .sort((a, b) => a.action_slot_key.localeCompare(b.action_slot_key))
      .map(compileExactDetailAction),
    parser_proposal_boundary_definition: compileParserProposalBoundary(input.parser_proposal_boundary),
  };
  if (input.serving_metric_operation_bindings != null) {
    payload.serving_metric_operation_bindings = [...input.serving_metric_operation_bindings]
      .sort((a, b) => a.binding_key.localeCompare(b.binding_key));
  }
  if (input.serving_trigger_path_schemas != null) {
    payload.serving_trigger_path_schema_definitions = [...input.serving_trigger_path_schemas]
      .sort((a, b) => a.schema_key.localeCompare(b.schema_key)
        || a.schema_version - b.schema_version)
      .map(compileTriggerPathSchema);
  }
  if (input.money_denominator_precision_policy != null) {
    payload.money_denominator_precision_policy_definition =
      input.money_denominator_precision_policy;
  }
  if (input.no_shop_semantic_schemas != null) {
    payload.no_shop_semantic_schema_definitions = [...input.no_shop_semantic_schemas]
      .sort((a, b) => a.schema_key.localeCompare(b.schema_key)
        || a.schema_version - b.schema_version)
      .map(compileNoShopSemanticSchema);
  }
  if (input.claim_interpretation_policy != null) {
    payload.claim_interpretation_policy_definition =
      input.claim_interpretation_policy;
  }
  if (input.definition_use_effect_schema != null) {
    payload.definition_use_effect_schema_definition =
      input.definition_use_effect_schema;
  }
  if (input.brings_down_effect_schema != null) {
    payload.brings_down_effect_schema_definition =
      input.brings_down_effect_schema;
  }
  if (input.capitalisation_semantic_schema != null) {
    payload.capitalisation_semantic_schema_definition =
      compileCapitalisationSemanticSchema(
        input.capitalisation_semantic_schema,
      );
  }
  if (input.result_definitions != null) {
    payload.result_definitions = [...input.result_definitions]
      .sort((a, b) => a.result_key.localeCompare(b.result_key)
        || a.result_version - b.result_version)
      .map(compileResultDefinition);
  }
  if (input.market_metric_definitions != null) {
    payload.market_metric_definitions =
      [...input.market_metric_definitions]
        .sort((a, b) => a.metric_key.localeCompare(b.metric_key)
          || a.metric_version - b.metric_version)
        .map(compileMarketMetricDefinition);
  }
  const fingerprint = contentId('CANONICAL_CONTRACT_BUNDLE/V1', payload);
  return Object.freeze({ ...payload, fingerprint });
}

function validateContractBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new TypeError('contract bundle must be an object');
  if (!/^[a-f0-9]{64}$/.test(bundle.fingerprint || '')) throw new Error('invalid contract fingerprint');
  const { fingerprint, ...payload } = bundle;
  const reconstructedInput = {
    schema_version: 'FIXTURE_CONTRACT_INPUT/V1',
    contract_key: payload.contract_key,
    concepts: payload.concepts,
    component_definitions: payload.component_definitions,
    relationship_definitions: payload.relationship_definitions,
    claim_definitions: payload.claim_definitions,
    claim_states: payload.claim_states,
    party_tuple_fields: payload.party_tuple_fields,
    residual_reason_codes: payload.residual_reason_codes,
    serving_exact_detail_actions: payload.serving_exact_detail_action_definitions.map((definition) => {
      const {
        schema_version: _schemaVersion,
        action_definition_id: _definitionId,
        action_definition_payload_digest: _payloadDigest,
        ...input
      } = definition;
      return input;
    }),
    parser_proposal_boundary: (() => {
      const {
        schema_version: _schemaVersion,
        proposal_boundary_definition_id: _definitionId,
        proposal_boundary_definition_payload_digest: _payloadDigest,
        ...input
      } = payload.parser_proposal_boundary_definition;
      return input;
    })(),
  };
  if (payload.serving_metric_operation_bindings != null) {
    reconstructedInput.serving_metric_operation_bindings = payload.serving_metric_operation_bindings;
  }
  if (payload.serving_trigger_path_schema_definitions != null) {
    reconstructedInput.serving_trigger_path_schemas =
      payload.serving_trigger_path_schema_definitions.map((definition) => {
        const {
          schema_version: _schemaVersion,
          trigger_path_schema_definition_id: _definitionId,
          trigger_path_schema_definition_payload_digest: _payloadDigest,
          trigger_path_schema_key: schemaKey,
          trigger_path_schema_version: schemaVersion,
          ...input
        } = definition;
        return {
          schema_key: schemaKey,
          schema_version: schemaVersion,
          ...input,
        };
      });
  }
  if (payload.money_denominator_precision_policy_definition != null) {
    reconstructedInput.money_denominator_precision_policy =
      payload.money_denominator_precision_policy_definition;
  }
  if (payload.no_shop_semantic_schema_definitions != null) {
    reconstructedInput.no_shop_semantic_schemas =
      payload.no_shop_semantic_schema_definitions.map((definition) => {
        const {
          schema_version: _schemaVersion,
          semantic_schema_definition_id: _definitionId,
          semantic_schema_definition_payload_digest: _payloadDigest,
          semantic_schema_key: schemaKey,
          semantic_schema_version: schemaVersion,
          ...input
        } = definition;
        return {
          schema_key: schemaKey,
          schema_version: schemaVersion,
          ...input,
        };
      });
  }
  if (payload.claim_interpretation_policy_definition != null) {
    reconstructedInput.claim_interpretation_policy =
      payload.claim_interpretation_policy_definition;
  }
  if (payload.definition_use_effect_schema_definition != null) {
    reconstructedInput.definition_use_effect_schema =
      payload.definition_use_effect_schema_definition;
  }
  if (payload.brings_down_effect_schema_definition != null) {
    reconstructedInput.brings_down_effect_schema =
      payload.brings_down_effect_schema_definition;
  }
  if (payload.capitalisation_semantic_schema_definition != null) {
    const {
      schema_version: _schemaVersion,
      semantic_schema_definition_id: _definitionId,
      semantic_schema_definition_payload_digest: _payloadDigest,
      semantic_schema_key: schemaKey,
      semantic_schema_version: schemaVersion,
      ...definition
    } = payload.capitalisation_semantic_schema_definition;
    reconstructedInput.capitalisation_semantic_schema = {
      schema_key: schemaKey,
      schema_version: schemaVersion,
      ...definition,
    };
  }
  if (payload.result_definitions != null) {
    reconstructedInput.result_definitions =
      payload.result_definitions.map((definition) => {
        const {
          schema_version: _schemaVersion,
          result_definition_id: _definitionId,
          result_definition_payload_digest: _payloadDigest,
          ...input
        } = definition;
        return input;
      });
  }
  if (payload.market_metric_definitions != null) {
    reconstructedInput.market_metric_definitions =
      payload.market_metric_definitions.map((definition) => {
        const {
          schema_version: _schemaVersion,
          metric_definition_id: _definitionId,
          metric_definition_payload_digest: _payloadDigest,
          ...input
        } = definition;
        return input;
      });
  }
  const expected = compileFixtureContract(reconstructedInput);
  if (payload.schema_version !== expected.schema_version) throw new Error('invalid contract bundle schema version');
  const expectedPayload = {
    schema_version: expected.schema_version,
    contract_key: expected.contract_key,
    concepts: expected.concepts,
    component_definitions: expected.component_definitions,
    relationship_definitions: expected.relationship_definitions,
    claim_definitions: expected.claim_definitions,
    claim_states: expected.claim_states,
    party_tuple_fields: expected.party_tuple_fields,
    residual_reason_codes: expected.residual_reason_codes,
    serving_exact_detail_action_definitions: expected.serving_exact_detail_action_definitions,
    parser_proposal_boundary_definition: expected.parser_proposal_boundary_definition,
  };
  if (expected.serving_metric_operation_bindings != null) {
    expectedPayload.serving_metric_operation_bindings = expected.serving_metric_operation_bindings;
  }
  if (expected.serving_trigger_path_schema_definitions != null) {
    expectedPayload.serving_trigger_path_schema_definitions =
      expected.serving_trigger_path_schema_definitions;
  }
  if (expected.money_denominator_precision_policy_definition != null) {
    expectedPayload.money_denominator_precision_policy_definition =
      expected.money_denominator_precision_policy_definition;
  }
  if (expected.no_shop_semantic_schema_definitions != null) {
    expectedPayload.no_shop_semantic_schema_definitions =
      expected.no_shop_semantic_schema_definitions;
  }
  if (expected.claim_interpretation_policy_definition != null) {
    expectedPayload.claim_interpretation_policy_definition =
      expected.claim_interpretation_policy_definition;
  }
  if (expected.definition_use_effect_schema_definition != null) {
    expectedPayload.definition_use_effect_schema_definition =
      expected.definition_use_effect_schema_definition;
  }
  if (expected.brings_down_effect_schema_definition != null) {
    expectedPayload.brings_down_effect_schema_definition =
      expected.brings_down_effect_schema_definition;
  }
  if (expected.capitalisation_semantic_schema_definition != null) {
    expectedPayload.capitalisation_semantic_schema_definition =
      expected.capitalisation_semantic_schema_definition;
  }
  if (expected.result_definitions != null) {
    expectedPayload.result_definitions = expected.result_definitions;
  }
  if (expected.market_metric_definitions != null) {
    expectedPayload.market_metric_definitions =
      expected.market_metric_definitions;
  }
  if (canonicalJson(payload) !== canonicalJson(expectedPayload)) throw new Error('contract bundle payload mismatch');
  if (fingerprint !== contentId('CANONICAL_CONTRACT_BUNDLE/V1', payload)) throw new Error('contract fingerprint mismatch');
  return true;
}

// compileFixtureContractV2() compiles F2 (V1 + the four Ben-approved
// concepts). compileFixtureContract() DEFAULT is unchanged (V1 / F1).
function compileFixtureContractV2() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V2);
}

function compileFixtureContractV3() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V3);
}

function compileFixtureContractV4() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V4);
}

function compileFixtureContractV5() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V5);
}

function compileFixtureContractV6() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V6);
}

function compileFixtureContractV7() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V7);
}

function compileFixtureContractV8() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V8);
}

function compileFixtureContractV9() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V9);
}

function compileFixtureContractV10() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V10);
}

function compileFixtureContractV11() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V11);
}

function compileFixtureContractV12() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V12);
}

function compileFixtureContractV13() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V13);
}

function compileFixtureContractV14() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V14);
}

function compileFixtureContractV15() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V15);
}

function compileFixtureContractV16() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V16);
}

function compileFixtureContractV17() {
  return compileFixtureContract(FIXTURE_CONTRACT_INPUT_V17);
}

function moneyDenominatorPrecisionPolicyForClaim(contractBundle, claimDefinitionKey) {
  const policy = contractBundle?.money_denominator_precision_policy_definition;
  if (!policy || !policy.applicable_claim_definition_keys.includes(claimDefinitionKey)) return null;
  return policy;
}

// The set of contract fingerprints any currently-supported version compiles
// to. Modules that gate on "is this a fixture contract fingerprint we
// recognise" (market-cohort-query.js, shared-serving-row.js) check
// membership in this set instead of equality with a single hardcoded
// default, so a reviewed artifact built under F2 keeps serving without
// weakening the F1 pin any other module still checks for exactly.
const FIXTURE_CONTRACT_FINGERPRINT_V1 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V1).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V2 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V2).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V3 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V3).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V4 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V4).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V5 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V5).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V6 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V6).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V7 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V7).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V8 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V8).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V9 = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V9).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V10 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V10).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V11 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V11).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V12 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V12).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V13 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V13).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V14 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V14).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V15 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V15).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V16 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V16).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINT_V17 =
  compileFixtureContract(FIXTURE_CONTRACT_INPUT_V17).fingerprint;
const FIXTURE_CONTRACT_FINGERPRINTS = Object.freeze([
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_CONTRACT_FINGERPRINT_V7,
  FIXTURE_CONTRACT_FINGERPRINT_V8,
  FIXTURE_CONTRACT_FINGERPRINT_V9,
  FIXTURE_CONTRACT_FINGERPRINT_V10,
  FIXTURE_CONTRACT_FINGERPRINT_V11,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_CONTRACT_FINGERPRINT_V13,
  FIXTURE_CONTRACT_FINGERPRINT_V14,
  FIXTURE_CONTRACT_FINGERPRINT_V15,
  FIXTURE_CONTRACT_FINGERPRINT_V16,
  FIXTURE_CONTRACT_FINGERPRINT_V17,
]);
const FIXTURE_SERVING_CONTRACT_FINGERPRINTS = Object.freeze([
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
]);
const FIXTURE_CONTRACTS_BY_FINGERPRINT = new Map([
  [FIXTURE_CONTRACT_FINGERPRINT_V1, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V1)],
  [FIXTURE_CONTRACT_FINGERPRINT_V2, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V2)],
  [FIXTURE_CONTRACT_FINGERPRINT_V3, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V3)],
  [FIXTURE_CONTRACT_FINGERPRINT_V4, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V4)],
  [FIXTURE_CONTRACT_FINGERPRINT_V5, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V5)],
  [FIXTURE_CONTRACT_FINGERPRINT_V6, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V6)],
  [FIXTURE_CONTRACT_FINGERPRINT_V7, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V7)],
  [FIXTURE_CONTRACT_FINGERPRINT_V8, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V8)],
  [FIXTURE_CONTRACT_FINGERPRINT_V9, compileFixtureContract(FIXTURE_CONTRACT_INPUT_V9)],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V10,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V10),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V11,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V11),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V12,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V12),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V13,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V13),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V14,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V14),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V15,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V15),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V16,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V16),
  ],
  [
    FIXTURE_CONTRACT_FINGERPRINT_V17,
    compileFixtureContract(FIXTURE_CONTRACT_INPUT_V17),
  ],
]);

function fixtureContractForFingerprint(fingerprint) {
  return FIXTURE_CONTRACTS_BY_FINGERPRINT.get(fingerprint) || null;
}

module.exports = {
  FIXTURE_CONTRACT_INPUT,
  FIXTURE_CONTRACT_INPUT_V1,
  FIXTURE_CONTRACT_INPUT_V2,
  FIXTURE_CONTRACT_INPUT_V3,
  FIXTURE_CONTRACT_INPUT_V4,
  FIXTURE_CONTRACT_INPUT_V5,
  FIXTURE_CONTRACT_INPUT_V6,
  FIXTURE_CONTRACT_INPUT_V7,
  FIXTURE_CONTRACT_INPUT_V8,
  FIXTURE_CONTRACT_INPUT_V9,
  FIXTURE_CONTRACT_INPUT_V10,
  FIXTURE_CONTRACT_INPUT_V11,
  FIXTURE_CONTRACT_INPUT_V12,
  FIXTURE_CONTRACT_INPUT_V13,
  FIXTURE_CONTRACT_INPUT_V14,
  FIXTURE_CONTRACT_INPUT_V15,
  FIXTURE_CONTRACT_INPUT_V16,
  FIXTURE_CONTRACT_INPUT_V17,
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_CONTRACT_FINGERPRINT_V7,
  FIXTURE_CONTRACT_FINGERPRINT_V8,
  FIXTURE_CONTRACT_FINGERPRINT_V9,
  FIXTURE_CONTRACT_FINGERPRINT_V10,
  FIXTURE_CONTRACT_FINGERPRINT_V11,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  FIXTURE_CONTRACT_FINGERPRINT_V13,
  FIXTURE_CONTRACT_FINGERPRINT_V14,
  FIXTURE_CONTRACT_FINGERPRINT_V15,
  FIXTURE_CONTRACT_FINGERPRINT_V16,
  FIXTURE_CONTRACT_FINGERPRINT_V17,
  FIXTURE_CONTRACT_FINGERPRINTS,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  NO_SHOP_ACTION_CODES_V2,
  NO_SHOP_ACTION_OCCURRENCE_SCHEMA_V1,
  NO_SHOP_ACTION_ROLLUP_SCHEMA_V1,
  NO_SHOP_EXCEPTION_EFFECT_SCHEMA_V1,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
  NO_SHOP_INLINE_PERMISSION_EFFECT_SCHEMA_V1,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V1,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V2,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V3,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V4,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V5,
  NO_SHOP_NOTICE_OBLIGATION_SCHEMA_V6,
  NO_SHOP_COPY_DELIVERY_PERIOD_CLAIM_DEFINITION_V1,
  REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1,
  GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1,
  RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1,
  CAPITALIZATION_SHARE_COUNT_CLAIM_DEFINITION_V1,
  RESERVED_SHARE_POOL_CLAIM_DEFINITION_V1,
  TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1,
  TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1,
  TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1,
  MAE_CARVEOUT_CODES_V2,
  MAE_CARVEOUT_CLAIM_DEFINITION_V1,
  MAE_DEFINITION_PRONG_CLAIM_DEFINITION_V1,
  MAE_DISPROPORTIONALITY_CARVEBACK_CLAIM_DEFINITION_V1,
  TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1,
  TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1,
  TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1,
  BRINGS_DOWN_EFFECT_SCHEMA_V1,
  CAPITALISATION_REPRESENTATION_SCHEMA_V1,
  TARGET_CAPITALISATION_BRING_DOWN_RESULT_DEFINITION_V2,
  REPRESENTATION_ACCURACY_STANDARD_METRIC_DEFINITION_V2,
  NOTICE_DEFINITION_SCOPE_CLOSURE_V1,
  CLAIM_INTERPRETATION_POLICY_V1,
  CLAIM_INTERPRETATION_POLICY_V2,
  TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2,
  USES_DEFINITION_EFFECT_SCHEMA_V1,
  USES_DEFINITION_EFFECT_SCHEMA_V2,
  USES_DEFINITION_EFFECT_SCHEMA_V3,
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
  compileFixtureContractV6,
  compileFixtureContractV7,
  compileFixtureContractV8,
  compileFixtureContractV9,
  compileFixtureContractV10,
  compileFixtureContractV11,
  compileFixtureContractV12,
  compileFixtureContractV13,
  compileFixtureContractV14,
  compileFixtureContractV15,
  compileFixtureContractV16,
  compileFixtureContractV17,
  fixtureContractForFingerprint,
  moneyDenominatorPrecisionPolicyForClaim,
  validateContractBundle,
};
