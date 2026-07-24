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
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V1,
    metric_operation_bindings: [],
    trigger_path_schemas: [],
    money_denominator_precision_policy: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V2,
    claims: EXPECTED_CLAIM_KEYS_V1,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V1,
    metric_operation_bindings: [],
    trigger_path_schemas: [],
    money_denominator_precision_policy: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V3,
    trigger_path_schemas: [],
    money_denominator_precision_policy: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: null,
  }),
  Object.freeze({
    concepts: EXPECTED_CONCEPT_KEYS_V3,
    claims: EXPECTED_CLAIM_KEYS_V3,
    exact_detail_actions: EXPECTED_EXACT_DETAIL_ACTION_KEYS_V3,
    metric_operation_bindings: EXPECTED_METRIC_OPERATION_BINDING_KEYS_V4,
    trigger_path_schemas: EXPECTED_TRIGGER_PATH_SCHEMA_KEYS_V4,
    money_denominator_precision_policy: MONEY_DENOMINATOR_PRECISION_POLICY_V1,
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
    && canonicalJson(exactDetailActions) === canonicalJson(shape.exact_detail_actions)
    && canonicalJson(metricOperationBindings) === canonicalJson(shape.metric_operation_bindings)
    && canonicalJson(triggerPathSchemas) === canonicalJson(shape.trigger_path_schemas)
    && canonicalJson(input.money_denominator_precision_policy || null)
      === canonicalJson(shape.money_denominator_precision_policy)
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
    if (!entry || entry.version !== 1 || !['NON_SEMANTIC', 'TYPED_LEGAL_EFFECT'].includes(entry.effect_mode)) {
      throw new Error('invalid fixture relationship definition');
    }
    if (Object.keys(entry).sort().join(',') !== 'effect_mode,relationship_key,version') {
      throw new Error('invalid fixture relationship fields');
    }
  }
  for (const entry of input.claim_definitions) {
    const enumDefinition = Array.isArray(entry && entry.allowed_canonical_values)
      && entry.allowed_canonical_values.length > 0
      && Object.keys(entry).sort().join(',') === 'allowed_canonical_values,canonical_value_required_when_present,claim_definition_key,version';
    const typedDefinition = entry && entry.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
      && Object.keys(entry).sort().join(',') === 'canonical_value_required_when_present,canonical_value_type,claim_definition_key,version';
    if (!entry || entry.version !== 1
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
const FIXTURE_CONTRACT_FINGERPRINTS = Object.freeze([
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
  FIXTURE_CONTRACT_FINGERPRINT_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  FIXTURE_CONTRACT_FINGERPRINT_V3,
  FIXTURE_CONTRACT_FINGERPRINT_V4,
  FIXTURE_CONTRACT_FINGERPRINT_V5,
  FIXTURE_CONTRACT_FINGERPRINTS,
  TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2,
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
  fixtureContractForFingerprint,
  moneyDenominatorPrecisionPolicyForClaim,
  validateContractBundle,
};
