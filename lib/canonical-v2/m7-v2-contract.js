'use strict';

const {
  compileSyntheticProfileExpression,
} = require('./m7-v2-deterministic-generator');

const TERMINATION_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE2_AUTHORITY/V2';
const TERMINATION_PHASE2_AUTHORITY_ID =
  'df1e3d4711e1b2fca09ea681e43db19a6b7cbfe1055e6a57c3ea48b2f588bf15';
const TERMINATION_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json';
const TERMINATION_PHASE2_AUTHORITY_BYTES = 787442;
const TERMINATION_PHASE2_AUTHORITY_SHA256 =
  '897022076002dc07d16d7a60071dd932c829428fe0763d42d9b70fd1b21055cb';
const TERMINATION_PHASE2_ERRORS = Object.freeze({
  AUTHORITY: 'M7_V2_TERMINATION_AUTHORING_PHASE2_AUTHORITY_DRIFT',
  TOPOLOGY: 'M7_V2_TERMINATION_PHASE2_EVIDENCE_TOPOLOGY',
  PROVENANCE: 'M7_V2_TERMINATION_PHASE2_EVIDENCE_PROVENANCE',
  REFERENCE: 'M7_V2_TERMINATION_PHASE2_REFERENCE_RESOLUTION',
});

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const ANALYSIS_SCHEMA = 'AGREEMENT_ANALYSIS/V2';
const PROJECTION_SCHEMA = 'AGREEMENT_PROJECTION/V2';
const VIEW_POLICY_SCHEMA = 'STAGE_2Y_M7_V2_VIEW_POLICY/V1';
const CANDIDATE_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const CANDIDATE_VERIFICATION_SCHEMA =
  'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1';
const RULE_SCHEMA = 'AGREEMENT_LEGAL_RULE/V2';
const CANDIDATE_SET_SCHEMA = 'STAGE_2Y_M7_V2_INSPECTED_CANDIDATE_SET/V1';
const SOURCE_CLOSURE_SCHEMA = 'STAGE_2Y_M7_V2_REVIEWED_SOURCE_CLOSURE/V1';
const EFFECT_LEDGER_SCHEMA = 'STAGE_2Y_M7_V2_AUTHORED_UNIT_EFFECT_LEDGER/V1';
const SUBTYPE_TREE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1';
const AGREEMENT_INDEX_SCHEMA = 'AGREEMENT_INDEX/V1';
const LAWYER_REVIEW_PACKET_SCHEMA = 'STAGE_2Y_LAWYER_REVIEW_PACKET/V1';
const FAMILY_PROFILE_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1';
const FAMILY_PROFILE_PACKAGE_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2';
const FAMILY_PROFILE_PACKAGE_APPROVAL_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_APPROVAL/V1';
const PACKAGE_MEMBER_BINDING_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const PROFILE_REQUIREMENT_SCHEMA = 'STAGE_2Y_M7_V2_PROFILE_REQUIREMENT/V1';
const GOVERNED_DISCLOSURE_NOTE_SCHEMA = 'STAGE_2Y_M7_V2_GOVERNED_DISCLOSURE_NOTE/V1';
const GOVERNED_DISCLOSURE_NOTE_EXACT_KEYS = Object.freeze([
  'schema_version',
  'governed_disclosure_note_id',
  'agreement_id',
  'profile_key',
  'source_unit_key',
  'field_key',
  'requirement_id',
  'reference_slot_key',
  'source_admission_gap_id',
  'disposition_kind',
  'display_text',
  'lawyer_ruling_id',
]);
const B9E_TERMINATION_GOVERNED_DISCLOSURE_NOTE_PATH_ORDINALS = Object.freeze([10, 1, 7]);
const PROFILE_CONDITIONAL_REQUIREMENT_SCHEMA =
  'STAGE_2Y_M7_V2_PROFILE_CONDITIONAL_REQUIREMENT/V1';
const PROFILE_CHILD_RULE_REQUIREMENT_SCHEMA =
  'STAGE_2Y_M7_V2_PROFILE_CHILD_RULE_REQUIREMENT/V1';
const MATCH_FIXTURE_SCHEMA = 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1';
const DIMENSION_EVIDENCE_SCHEMA = 'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1';
const STRUCTURE_OVERLAY_SCHEMA = 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY/V1';
const STRUCTURE_CANDIDATE_TREE_SCHEMA =
  'STAGE_2Y_M7_V2_STRUCTURE_CANDIDATE_TREE/V1';
const STRUCTURE_OVERLAY_FIXTURE_SCHEMA =
  'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1';
const FACT_SCHEMA = 'AGREEMENT_SEMANTIC_FACT/V2';
const SHARED_FACT_COVERAGE_SCHEMA = 'STAGE_2Y_M7_V2_SHARED_FACT_COVERAGE/V1';
const EXPRESSION_SCHEMA = 'STAGE_2Y_M7_V2_EXPRESSION/V1';
const DISPOSITION_SCHEMA = 'STAGE_2Y_M7_V2_DISPOSITION/V1';
const ANALYSIS_VALIDATION_SCHEMA = 'STAGE_2Y_M7_V2_ANALYSIS_VALIDATION/V1';
const AGREEMENT_ANALYSIS_V1_SCHEMA = 'AGREEMENT_ANALYSIS/V1';
const CONTEXT_COMPILATION_V1_SCHEMA = 'CONTEXT_COMPILATION/V1';
const ANALYSIS_VALIDATION_RESULTS = new WeakMap();
const AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';
const AUTHORITY_SHA256 = '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c';
const ACTIVATION_ID = '7821c19a5aaae6f974599cefc8460fb88b8f2302fcefbdde4c0efbadbdea0d7a';
const ACTIVATION_SHA256 = 'f0401bb7f75fe72b7719663573ab75581aecffeb2949618b991ec41e54f1c578';
const WORK3_ENTRY_CORRECTION_AUTHORITY_ID =
  '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873';
const TEMPORAL_PHASE1_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_TEMPORAL_PHASE1_AUTHORITY/V1';
const TEMPORAL_PHASE1_AUTHORITY_ID =
  'ac7af03e6206c62ef20eb97bff7f47e2180b23bc0468b7b517792078c10350a7';
const TEMPORAL_PHASE1_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-termination-temporal-phase1-authority.json';
const TEMPORAL_PHASE1_AUTHORITY_BYTE_LENGTH = 24742;
const TEMPORAL_PHASE1_AUTHORITY_SHA256 =
  '64ac377ea1124c379423d9fa5a79c751d9880f11b170a156538668ac5c965ec8';
const WORK0_ID = '885d404502276d85af385fce20cd93b601f09a30a3300c371df870337f7d5fab';
const WORK0_SHA256 = '04e010105dcb4b449b7f8e3aa05fb3bec69cdada8d385999e7c86a8150eaff83';
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const WORK0_EVIDENCE_ROOT_PATH =
  `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const FIXED_SAMPLE_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-fixed-sample-identity-manifest.json`;
const REPAIR_BASELINE_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-baseline-ledger.json`;
const CALIBRATION_RULING_MAP_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-calibration-question-ruling-map.json`;
const LAWYER_REVIEW_PACKET_PATH =
  `${MIGRATION_ROOT}/shadow/m7-comparison-entry-correction/lawyer-review-packet.json`;
const LINKED_POINT_ORDINALS = Object.freeze([6, 27, 28, 32, 33, 34, 35, 36]);
const REPAIR_INVARIANTS = Object.freeze({
  MATERIAL_MEANING_OMITTED_OR_HIDDEN:
    'NO_NAMED_EFFECT_PARTY_CONDITION_EXCEPTION_TIMING_STANDARD_THRESHOLD_OR_QUALIFIER_MAY_BE_OMITTED_HIDDEN_IN_DISPLAY_TEXT_OR_RELABELLED_SOURCE_LIMITED',
  CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE:
    'CORRECT_FAMILY_AND_MOST_SPECIFIC_SUPPORTED_SUBTYPE_WITH_LAWYER_READABLE_TYPED_FIELDS_FOR_EACH_IDENTIFIED_LEGAL_EFFECT',
  FALSE_PARSER_AMBIGUITY:
    'NESTED_LIST_LABEL_RESTART_ALONE_IS_NOT_AMBIGUITY_PRESERVE_AUTHORED_NESTING',
  SOURCE_ARTEFACT:
    'EXCLUDE_ONLY_THE_IDENTIFIED_ARTEFACT_SPAN_PRESERVE_ADJACENT_LEGAL_TEXT',
  APPROVED_NO_COMPARISON:
    'COMPLETE_NO_COMPARISON_ONLY_FOR_THIS_GOVERNED_MECHANICS_OCCURRENCE_NO_ROW_AND_NO_FAMILY_WIDE_SUPPRESSION',
  CLEAN_CONTROL:
    'PRESERVE_ACCEPTED_LEGAL_MEANING_CLASSIFICATION_FIELDS_DISPOSITION_AND_RENDERING_WITH_NO_REGRESSION',
});
const ITEM39_AMBIGUITY_ID = '21f1bca531ca44030c615da1e88a933704ee74402a35f5aa36982fb1bbb21e00';
const ITEM39_DISPOSITION_ID = '7bc98f42d8580f9aada5ee4274e9ada3d22ddd12e9150898a3188e7ddbf122d3';
const ITEM39_DECISION_ID = 'ac56600e311361f72e9423de2fd9a4a468e536ce25974dbc9f450369b8e097f6';
const ITEM39_PARENT_NODE_ID = '9a9d339a33d7c530a9668482cb65f537e96bf9c78836de56cae76d92f6ceff35';
const ITEM39_AMBIGUITY_SHA256 = '75beb6bb93b368073110d0a8f28dd4d038ba357281a509618b70567dd527cfb7';
const ITEM28_DECISION_ID = 'b7993d5b54e20fb4a66ef27ec9d4906f49a050fba416cba70362972c200d9fff';
const ITEM42_DECISION_ID = 'd44da4450537479614de70175996b16a86495de989d1795ed4c01b7cba24412e';
const ITEM44_DECISION_ID = '0b0efa85bac341e0ee3e29075563620365c9022c2dd8cf08de4e9f73ae7454a4';
const ITEM28_SOURCE_NODE_ID = '717b78ef0bd7b4f18a66f142e1213676c2ebc557e5d91811d348fe0ac9e47dc2';
const ITEM42_SOURCE_NODE_ID = '005e1651ed5ba5f031509229658f4e9682d95f1b59ce894bfb4f319388ad9ad4';
const ITEM44_SOURCE_NODE_ID = 'd011f79aae3c051670469038a679a5c72c80eb96af29cfe4f5d607c1d614aa19';
const ITEM28_AGREEMENT_ID = 'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c';
const ITEM42_44_AGREEMENT_ID = 'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71';
const ITEM42_SHARED_SOURCE_PROFILE_KEYS = Object.freeze([
  'PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT',
  'PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL',
]);
const DNO_ITEM42_RULING_ID = 'dno-item-42-linked-duty-blocker-b';
const DNO_ITEM42_RULING_PATH =
  'docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-2026-08-25.json';
const DNO_ITEM42_PREDECESSOR_PACKAGE_BINDING = Object.freeze({
  byte_length: 407522,
  git_blob_oid: 'c410d22bf518be891479995f878cdc2aa45b2b30',
  path: `${MIGRATION_ROOT}/control/m7-v2-repair-family-work3-profile-package-dno-indemnification.json`,
  record_id: 'e5b568d8eaa764a63a17e4fc6337b3049c8cfa5163947cb230c120027c38395e',
  record_id_field: 'family_profile_package_id',
  schema_version: FAMILY_PROFILE_PACKAGE_SCHEMA,
  sha256: '5fccaa143aed5deb4eecd81e9efaf3782930eaf282b069e6e5bc35f939acb0ed',
});
const DNO_ITEM42_SUCCESSOR_PACKAGE_PATH =
  `${MIGRATION_ROOT}/control/`
  + 'm7-v2-repair-family-work3-profile-package-dno-indemnification-item-42-successor-2026-09-01.json';
const DNO_ITEM42_SUCCESSOR_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2820,
  git_blob_oid: 'accb6537d37681ecbe32913d435a0a2a0d0ad4f7',
  path: `${MIGRATION_ROOT}/control/m7-v2-repair-dno-indemnification-item-42-family-package-seal-receipt-2026-09-01.json`,
  record_id: '4d1d936db237141e25aa932d17193678f4da43f209029116a8ce5cc0e5d7e46a',
  record_id_field: 'item42_family_package_seal_receipt_id',
  schema_version: 'N1_DNO_ITEM42_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '340d2685d5b906150224265bf2a9d0374fb585727222570245ac5331e9eeed31',
});
const DNO_ITEM42_SUCCESSOR_DISPOSITION_BINDING = Object.freeze({
  byte_length: 9800,
  git_blob_oid: '0e1592aed2cc2c10073efd0caa20a23736c370e7',
  path: `${MIGRATION_ROOT}/control/m7-v2-repair-dno-33-profile-inventory-disposition-item-42-successor-2026-09-01.json`,
  record_id: '71eff36c209588af11e36a878e760661aeb14e2d244b4c685a1ea719f5725a52',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'N1_DNO_ITEM42_33_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: 'eaee3ae7906fc32aff1bb360f5d03ae589a88a0bff15d1eb9708ff78c6da644c',
});
const DNO_ITEM42_SUCCESSOR_POLICY_BINDING = Object.freeze({
  byte_length: 4644,
  git_blob_oid: 'd67b22d6f93e3503b520adffb5c583c365e2c349',
  path: `${MIGRATION_ROOT}/control/m7-v2-repair-contract-policy-item-42-successor-authority-2026-09-01.json`,
  record_id: '5618d94dea06aa0a1e7fac948031d38ab028b541e0316792540fe03fb93b88e8',
  record_id_field: 'item42_policy_pin_successor_authority_id',
  schema_version: 'N1_DNO_ITEM42_POLICY_PIN_SUCCESSOR_AUTHORITY/V1',
  sha256: '7fd28a6bc36264cde6b1d316dfa35adc556af5a0d5793d54aa123575a7fb5c9f',
});
const DNO_ITEM42_CHANGED_ORDINALS = Object.freeze([14, 19, 22, 25, 27]);
const WORK3_PENDING_ISSUE = 'WORK3_BEN_PROFILE_APPROVAL_PENDING';
const WIDER_SCOPE_ISSUE = 'WIDER_MATERIAL_SCOPE_UNMODELLED';

const FAMILY_KEYS = Object.freeze([
  'ANTITRUST_REGULATORY',
  'APPRAISAL_DISSENTERS_RIGHTS',
  'CAPITALISATION',
  'CLOSING_CONDITIONS',
  'CONSIDERATION',
  'DIVIDENDS',
  'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS',
  'FINANCING_COVENANTS',
  'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'INTERIM_OPERATING',
  'KEY_DEFINED_TERMS',
  'MAE_DEFINITION',
  'MATERIAL_CONTRACTS',
  'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE',
  'NO_OTHER_REPS_FRAUD',
  'NO_SHOP',
  'PROXY_MEETING',
  'REPRESENTATIONS',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION',
  'TERMINATION_FEE',
]);

const FAMILY_PROFILE_PACKAGE_PATHS = Object.freeze(FAMILY_KEYS.map((familyKey) => (
  `${MIGRATION_ROOT}/control/m7-v2-repair-family-work3-profile-package-${familyKey
    .toLowerCase().replaceAll('_', '-')}.json`
)));
const FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY = new Map(FAMILY_KEYS.map(
  (familyKey, index) => [familyKey, FAMILY_PROFILE_PACKAGE_PATHS[index]],
));
const AMBIGUOUS_REPEAT_FIXTURE_ID =
  'de4176a0d940b1c71fe7523eaec101a070ef49577af9413405c1733cd2b5a999';
const AMBIGUOUS_REPEAT_AMBIGUITY_ID =
  '43d669b21d69377790b8044f5f2b67387a7255effdfc8a92e36cd3e38ef2f195';
const AMBIGUOUS_REPEAT_INDEX_BINDING = Object.freeze({
  path: `${MIGRATION_ROOT}/control/m7-v2-repair-work3-ambiguous-repeat-agreement-index.json`,
  schema_version: AGREEMENT_INDEX_SCHEMA,
  record_id_field: 'agreement_index_id',
  record_id: '45affe3a9824595810d53e2fbcc97b5320c3137984318fef7b64622e3022898d',
  byte_length: 2813,
  sha256: '1826e44e4b3f35a92a684ad0d9fd5c4a1657f1628339a3f83726a223eaa96b4e',
  git_blob_oid: '8f1097da322739d969411f29bfa6d9ff02a6a86d',
});
const AMBIGUOUS_REPEAT_MEMBER_BINDING = Object.freeze({
  schema_version: PACKAGE_MEMBER_BINDING_SCHEMA,
  container_path: FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY.get('TERMINATION'),
  member_field: 'structure_fixture_members',
  member_index: 0,
  member_schema_version: STRUCTURE_OVERLAY_FIXTURE_SCHEMA,
  member_record_id_field: 'fixture_id',
  member_record_id: AMBIGUOUS_REPEAT_FIXTURE_ID,
  member_byte_length: 8762,
  member_sha256: '1523af1d69fe4c88fdbc2ef078e1c06db10ef4ce1871acc6061e497026680dde',
});
const SEALED_AGREEMENT_IDS = Object.freeze([
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154',
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116',
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb',
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363',
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c',
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c',
]);
const ADDITIVE_AGREEMENT_IDS = Object.freeze([
  'aa72f3af29316df52ab5cb75eb2b0bb0a5b31036bd24c7f812241c5a688f4319',
  'f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71',
  'fa0fff26622d0e90b47c3df527ccff91f4daa3db12f08d3832de76d8ae7541b5',
]);
const GOVERNED_AGREEMENT_IDS = Object.freeze([
  ...SEALED_AGREEMENT_IDS,
  ...ADDITIVE_AGREEMENT_IDS,
].sort());

const CODE_ROLES = Object.freeze([
  'COMPILER',
  'DETERMINISTIC_GENERATOR',
  'CONTRACT_VALIDATOR',
]);

const INPUT_ROLES = Object.freeze([
  'BASE_ANALYSIS_SET',
  'AGREEMENT_INDEX_SET',
  'CONTEXT_COMPILATION_SET',
  'APPROVED_FAMILY_PACKET_SET',
  'APPROVED_FAMILY_PROFILE_SET',
  'APPROVED_STRUCTURE_DISPOSITION_SET',
]);

const INPUT_SCHEMAS = Object.freeze({
  BASE_ANALYSIS_SET: 'AGREEMENT_ANALYSIS_SET/V1',
  AGREEMENT_INDEX_SET: 'AGREEMENT_INDEX_SET/V1',
  CONTEXT_COMPILATION_SET: 'CONTEXT_COMPILATION_SET/V1',
  APPROVED_FAMILY_PACKET_SET: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
  APPROVED_FAMILY_PROFILE_SET: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
  APPROVED_STRUCTURE_DISPOSITION_SET: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
});

const EXPRESSION_CHILD_KINDS = Object.freeze([
  'FACT',
  'RULE',
  'EXPRESSION',
  'GOVERNED_DISCLOSURE_NOTE',
]);

const OPERATORS = Object.freeze(new Map([
  ['ALL_OF', { min: 2, max: Infinity, childKinds: EXPRESSION_CHILD_KINDS }],
  ['ANY_OF', { min: 2, max: Infinity, childKinds: EXPRESSION_CHILD_KINDS }],
  ['NOT', { min: 1, max: 1, childKinds: EXPRESSION_CHILD_KINDS }],
  ['IF_THEN', { min: 2, max: 2, childKinds: EXPRESSION_CHILD_KINDS }],
  ['EXCEPTION_TO', { min: 2, max: 2, childKinds: EXPRESSION_CHILD_KINDS }],
  ['OVERRIDES', { min: 2, max: 2, childKinds: ['RULE', 'EXPRESSION'] }],
  ['DEEMS_AS', { min: 2, max: 2, childKinds: EXPRESSION_CHILD_KINDS }],
  ['EARLIER_OF', { min: 2, max: Infinity, childKinds: ['FACT', 'EXPRESSION'] }],
  ['LATER_OF', { min: 2, max: Infinity, childKinds: ['FACT', 'EXPRESSION'] }],
  ['TO_EXTENT', { min: 2, max: 2, childKinds: EXPRESSION_CHILD_KINDS }],
  ['CONSEQUENCE_MODIFIER', { min: 2, max: 2, childKinds: EXPRESSION_CHILD_KINDS }],
]));

const FACT_VALUE_TYPES = Object.freeze([
  'PARTY_SET',
  'PARTY',
  'ENUM',
  'DEFINED_TERM',
  'BOOLEAN',
  'NUMBER',
  'PERCENTAGE',
  'MONEY',
  'DATE',
  'DURATION',
  'PERIOD',
  'REFERENCE',
]);

const CHILD_ROLES = Object.freeze({
  ALL_OF: ['MEMBER'],
  ANY_OF: ['MEMBER'],
  NOT: ['NEGATED'],
  IF_THEN: ['CONDITION', 'CONSEQUENCE'],
  EXCEPTION_TO: ['BASE', 'EXCEPTION'],
  OVERRIDES: ['OVERRIDING', 'OVERRIDDEN'],
  DEEMS_AS: ['TRIGGER', 'DEEMED_RESULT'],
  EARLIER_OF: ['MEMBER'],
  LATER_OF: ['MEMBER'],
  TO_EXTENT: ['BASE', 'EXTENT_LIMIT'],
  CONSEQUENCE_MODIFIER: ['BASE_EFFECT', 'MODIFIED_CONSEQUENCE'],
});

const BINDING_KEYS = Object.freeze([
  'path',
  'schema_version',
  'record_id_field',
  'record_id',
  'byte_length',
  'sha256',
  'git_blob_oid',
]);

const PACKAGE_MEMBER_BINDING_KEYS = Object.freeze([
  'schema_version',
  'container_path',
  'member_field',
  'member_index',
  'member_schema_version',
  'member_record_id_field',
  'member_record_id',
  'member_byte_length',
  'member_sha256',
]);
const PACKAGE_MEMBER_FIELDS = Object.freeze({
  profiles: Object.freeze({
    schema: FAMILY_PROFILE_SCHEMA, idField: 'profile_id', singleton: false,
  }),
  subtype_tree: Object.freeze({
    schema: SUBTYPE_TREE_SCHEMA, idField: 'subtype_tree_id', singleton: true,
  }),
  match_fixtures: Object.freeze({
    schema: MATCH_FIXTURE_SCHEMA, idField: 'match_fixture_id', singleton: false,
  }),
  dimension_evidence: Object.freeze({
    schema: DIMENSION_EVIDENCE_SCHEMA, idField: 'dimension_evidence_id', singleton: false,
  }),
  structure_fixture_members: Object.freeze({
    schema: STRUCTURE_OVERLAY_FIXTURE_SCHEMA, idField: 'fixture_id', singleton: false,
  }),
});

const CANDIDATE_KEYS = Object.freeze([
  'schema_version',
  'candidate_registration_id',
  'stage',
  'lifecycle_state',
  'parent_authority_binding',
  'activation_receipt_binding',
  'work0_evidence_root_binding',
  'code_bindings',
  'semantic_input_bindings',
  'family_profile_set_binding',
  'subtype_tree_bindings',
  'structure_disposition_set_binding',
  'view_policy_binding',
  'predecessor_receipt_bindings',
  'allowed_output_root',
  'counts',
  'effects',
]);

const CANDIDATE_CODE_KEYS = Object.freeze([
  'compiler',
  'deterministic_generator',
  'contract_validator',
  'projector',
  'independent_verifier',
  'runners',
  'tests',
]);

const CANDIDATE_RUNNER_PATHS = Object.freeze([
  'scripts/stage-2y-structure-family-aggregate.mjs',
  'scripts/stage-2y-structure-generalisation-shadow.mjs',
  'scripts/stage-2y-structure-m6-project.mjs',
]);

const CANDIDATE_TEST_PATHS = Object.freeze([
  'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
  'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
  'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
]);

const CANDIDATE_VERIFICATION_CHECKS = Object.freeze([
  'REGISTRATION_SELF_IDENTITY',
  'AUTHORITY_AND_WORK0_BINDINGS',
  'REQUIRED_COMPONENT_BINDINGS',
  'SIX_SEMANTIC_INPUT_BINDINGS',
  'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS',
  'PREDECESSOR_AND_OUTPUT_SCOPE',
  'ZERO_PROHIBITED_EFFECTS',
]);

const ANALYSIS_VALIDATION_CHECKS = Object.freeze([
  'GOVERNANCE_AND_SIX_INPUTS',
  'PROFILE_AND_FIXTURE_GATE',
  'SOURCE_CLOSURE_AND_COVERAGE',
  'FACT_OWNERSHIP_AND_NORMALISATION',
  'EXPRESSION_AND_LINKED_RULE_TOPOLOGY',
  'EFFECT_AND_DISPOSITION_COMPLETENESS',
  'FAMILY_CORRECTION_COMPLETENESS',
  'CONTENT_IDENTITY_AND_COUNTS',
]);

const ANALYSIS_VALIDATION_EFFECTS = Object.freeze({
  files_written: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
});

const CANDIDATE_EFFECTS = Object.freeze({
  registration_file_writes: 1,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
});

const CANDIDATE_VERIFICATION_EFFECTS = Object.freeze({
  files_written: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
});

const NORMALISATION_RULES = Object.freeze([
  'EXACT_TOKEN/V1',
  'BOOLEAN_LITERAL_MAP/V1',
  'NUMBER_PARSER/V1',
  'PERCENTAGE_PARSER/V1',
  'MONEY_PARSER/V1',
  'DURATION_PARSER/V1',
  'PERIOD_PARSER/V1',
  'DATE_ISO_PARSER/V1',
  'BOUND_PARTY_ALIAS/V1',
  'DEFINED_TERM_REFERENCE/V1',
  'ENUM_LITERAL_MAP/V1',
  'REFERENCE_EDGE/V1',
]);

const NORMALISATION_VALUE_TYPES = Object.freeze(new Map([
  ['EXACT_TOKEN/V1', ['ENUM']],
  ['BOOLEAN_LITERAL_MAP/V1', ['BOOLEAN']],
  ['NUMBER_PARSER/V1', ['NUMBER']],
  ['PERCENTAGE_PARSER/V1', ['PERCENTAGE']],
  ['MONEY_PARSER/V1', ['MONEY']],
  ['DURATION_PARSER/V1', ['DURATION']],
  ['PERIOD_PARSER/V1', ['PERIOD']],
  ['DATE_ISO_PARSER/V1', ['DATE']],
  ['BOUND_PARTY_ALIAS/V1', ['PARTY', 'PARTY_SET']],
  ['DEFINED_TERM_REFERENCE/V1', ['DEFINED_TERM']],
  ['ENUM_LITERAL_MAP/V1', ['ENUM']],
  ['REFERENCE_EDGE/V1', ['REFERENCE']],
]));

const EQUIVALENCE_SIGNATURE_SLOTS = Object.freeze([
  'actor',
  'effect',
  'standard',
  'threshold',
  'timing',
  'conditions',
  'qualifications',
]);

function fail(code, detail) {
  const error = new TypeError(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function object(value, code, label) {
  if (!isObject(value)) fail(code, `${label} must be an object`);
  return value;
}

function array(value, code, label) {
  if (!Array.isArray(value)) fail(code, `${label} must be an array`);
  return value;
}

function string(value, code, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string`);
  }
  return value;
}

function codeUnitCompare(left, right) {
  const leftValue = String(left);
  const rightValue = String(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function isStrictIsoCalendarDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function exactKeys(value, keys, code, label) {
  object(value, code, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!same(actual, expected)) fail(code, `${label} has an open or incomplete shape`);
}

function same(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function unique(values, code, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(code, `${label} contains a duplicate`);
    seen.add(value);
  }
  return seen;
}

function indexBy(values, field, code, label) {
  const result = new Map();
  for (const value of values) {
    object(value, code, label);
    const id = string(value[field], code, `${label}.${field}`);
    if (result.has(id)) fail(code, `${label} contains duplicate ${field}`);
    result.set(id, value);
  }
  return result;
}

function assertHex(value, length, code, label) {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    fail(code, `${label} is not a lowercase hexadecimal identifier`);
  }
}

function bytes(value, code, label) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  fail(code, `${label} did not resolve to bytes`);
}

function rotateLeft32(value, bits) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function sha1Hex(value) {
  const input = Buffer.from(value);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = Buffer.alloc(paddedLength);
  input.copy(padded);
  padded[input.length] = 0x80;
  padded.writeUInt32BE(Math.floor(bitLength / 0x100000000), paddedLength - 8);
  padded.writeUInt32BE(bitLength >>> 0, paddedLength - 4);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = padded.readUInt32BE(offset + (index * 4));
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft32(
        words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1,
      );
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let f;
      let k;
      if (index < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const next = (rotateLeft32(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft32(b, 30);
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4]
    .map((value32) => value32.toString(16).padStart(8, '0')).join('');
}

function gitBlobOid(value) {
  const selected = Buffer.from(value);
  return sha1Hex(Buffer.concat([
    Buffer.from(`blob ${selected.length}\0`, 'utf8'),
    selected,
  ]));
}

function validateBinding(binding, resolveBinding, label) {
  const code = 'M7_V2_BINDING_DRIFT';
  exactKeys(binding, BINDING_KEYS, code, label);
  string(binding.path, code, `${label}.path`);
  if (binding.path.startsWith('/') || binding.path.split('/').includes('..')) {
    fail(code, `${label}.path escapes its bound root`);
  }
  if (binding.schema_version !== null) string(binding.schema_version, code, `${label}.schema_version`);
  if (binding.record_id_field !== null) string(binding.record_id_field, code, `${label}.record_id_field`);
  if (binding.record_id !== null) string(binding.record_id, code, `${label}.record_id`);
  if ((binding.record_id_field === null) !== (binding.record_id === null)) {
    fail(code, `${label} has a partial record identity`);
  }
  if (!Number.isInteger(binding.byte_length) || binding.byte_length < 0) {
    fail(code, `${label}.byte_length is invalid`);
  }
  assertHex(binding.sha256, 64, code, `${label}.sha256`);
  assertHex(binding.git_blob_oid, 40, code, `${label}.git_blob_oid`);
  let selected;
  try {
    selected = resolveBinding(binding);
  } catch {
    fail(code, `${label} could not be resolved`);
  }
  const selectedBytes = bytes(selected, code, label);
  if (selectedBytes.length !== binding.byte_length
      || sha256Hex(selectedBytes) !== binding.sha256
      || gitBlobOid(selectedBytes) !== binding.git_blob_oid) {
    fail(code, `${label} bytes do not match their binding`);
  }
  return selectedBytes;
}

function validateCanonicalRecordBytes(selectedBytes, binding, code, label) {
  let record;
  try {
    record = JSON.parse(selectedBytes.toString('utf8'));
  } catch {
    fail(code, `${label} is not JSON`);
  }
  if (!selectedBytes.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8'))) {
    fail(code, `${label} bytes are not canonical`);
  }
  if (binding.schema_version === null || binding.record_id_field === null
      || binding.record_id === null || record.schema_version !== binding.schema_version
      || record[binding.record_id_field] !== binding.record_id) {
    fail(code, `${label} envelope differs from its binding`);
  }
  assertHex(binding.record_id, 64, code, `${label} record ID`);
  let expectedId;
  if (binding.schema_version === AGREEMENT_INDEX_SCHEMA) {
    const requiredArrays = [
      'nodes',
      'annotations',
      'source_artefacts',
      'aliases',
      'ambiguities',
      'diagnostics',
      'inline_marker_dispositions',
    ];
    if (requiredArrays.some((field) => !Array.isArray(record[field]))
        || !isObject(record.source_binding) || !isObject(record.structural_policy)
        || !isObject(record.inline_marker_partition) || !isObject(record.byte_coverage)) {
      fail(code, `${label} lacks native AgreementIndex identity inputs`);
    }
    expectedId = contentId(AGREEMENT_INDEX_SCHEMA, {
      agreement_id: record.source_binding.agreement_id,
      canonical_text_id: record.source_binding.canonical_text_id,
      structural_policy_digest: record.structural_policy.policy_digest,
      root_node_occurrence_id: record.root_node_occurrence_id,
      counts: record.counts,
      node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', record.nodes),
      annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', record.annotations),
      source_artefact_set_digest: contentId(
        'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', record.source_artefacts,
      ),
      alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', record.aliases),
      ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', record.ambiguities),
      diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', record.diagnostics),
      inline_marker_disposition_set_digest: contentId(
        'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
        record.inline_marker_dispositions,
      ),
      inline_marker_partition_proof_digest: record.inline_marker_partition.proof_digest,
      byte_coverage_proof_digest: record.byte_coverage.proof_digest,
    });
  } else if (binding.schema_version === LAWYER_REVIEW_PACKET_SCHEMA) {
    if (binding.record_id_field !== 'lawyer_review_packet_id') {
      fail(code, `${label} uses the wrong native lawyer review packet ID field`);
    }
    const payload = { ...record };
    delete payload.schema_version;
    delete payload.lawyer_review_packet_id;
    expectedId = contentId(LAWYER_REVIEW_PACKET_SCHEMA, payload);
  } else {
    const unsigned = { ...record };
    delete unsigned[binding.record_id_field];
    expectedId = contentId(binding.schema_version, unsigned);
  }
  if (expectedId !== binding.record_id) {
    fail(code, `${label} content ID is invalid`);
  }
  return record;
}

function validateResolvedRecordBinding(binding, resolveBinding, label, code = 'M7_V2_BINDING_DRIFT') {
  const selectedBytes = validateBinding(binding, resolveBinding, label);
  return validateCanonicalRecordBytes(selectedBytes, binding, code, label);
}

function validatePackageMemberBindingShape(
  binding, label, code, memberContracts = PACKAGE_MEMBER_FIELDS,
) {
  exactKeys(binding, PACKAGE_MEMBER_BINDING_KEYS, code, label);
  if (binding.schema_version !== PACKAGE_MEMBER_BINDING_SCHEMA) {
    fail(code, `${label} has the wrong package-member schema`);
  }
  string(binding.container_path, code, `${label}.container_path`);
  const memberContract = memberContracts[binding.member_field];
  if (!memberContract
      || binding.member_schema_version !== memberContract.schema
      || binding.member_record_id_field !== memberContract.idField
      || (memberContract.singleton
        ? binding.member_index !== null
        : !Number.isInteger(binding.member_index) || binding.member_index < 0)) {
    fail(code, `${label} has an invalid package-member route`);
  }
  assertHex(binding.member_record_id, 64, code, `${label}.member_record_id`);
  if (!Number.isInteger(binding.member_byte_length) || binding.member_byte_length < 0) {
    fail(code, `${label}.member_byte_length is invalid`);
  }
  assertHex(binding.member_sha256, 64, code, `${label}.member_sha256`);
  return memberContract;
}

function memberContentId(record, memberContract) {
  const unsigned = { ...record };
  delete unsigned[memberContract.idField];
  if (memberContract.schema === FAMILY_PROFILE_SCHEMA) delete unsigned.schema_version;
  return contentId(memberContract.schema, unsigned);
}

function familyPackageMemberContracts(authorityContract) {
  const memberContracts = authorityContract?.member_contracts;
  const profileContract = memberContracts?.profiles ?? {
    schema_version: FAMILY_PROFILE_SCHEMA,
    record_id_field: 'profile_id',
  };
  const treeContract = memberContracts?.subtype_tree ?? {
    schema_version: SUBTYPE_TREE_SCHEMA,
    record_id_field: 'subtype_tree_id',
  };
  const matchContract = memberContracts?.match_fixtures ?? {
    schema_version: MATCH_FIXTURE_SCHEMA,
    record_id_field: 'match_fixture_id',
  };
  const dimensionContract = memberContracts?.dimension_evidence ?? {
    schema_version: DIMENSION_EVIDENCE_SCHEMA,
    record_id_field: 'dimension_evidence_id',
  };
  const structureContract = memberContracts?.structure_fixture_members
    ?.allowed_schemas?.[0] ?? {
      schema_version: STRUCTURE_OVERLAY_FIXTURE_SCHEMA,
      record_id_field: 'fixture_id',
    };
  return {
    profileContract,
    treeContract,
    matchContract,
    dimensionContract,
    structureContract,
    memberContentContracts: {
      profiles: {
        schema: profileContract.schema_version,
        idField: profileContract.record_id_field,
      },
      subtype_tree: {
        schema: treeContract.schema_version,
        idField: treeContract.record_id_field,
      },
      match_fixtures: {
        schema: matchContract.schema_version,
        idField: matchContract.record_id_field,
      },
      dimension_evidence: {
        schema: dimensionContract.schema_version,
        idField: dimensionContract.record_id_field,
      },
      structure_fixture_members: {
        schema: structureContract.schema_version,
        idField: structureContract.record_id_field,
      },
    },
  };
}

function validateFamilyPackageInventoryCore(input, code, authorityContract = null) {
  exactKeys(input, [
    'familyKey', 'profileSetVersion', 'benApprovalId', 'legalDecisions', 'members',
  ], code, 'single-family member inventory input');
  const familyKey = string(input.familyKey, code, 'family key');
  if (!Number.isInteger(input.profileSetVersion) || input.profileSetVersion < 1) {
    fail(code, `family package ${familyKey} profile-set version is invalid`);
  }
  const benApprovalId = string(input.benApprovalId, code, 'Ben approval ID');
  exactKeys(input.members, Object.keys(PACKAGE_MEMBER_FIELDS), code,
    `family package ${familyKey} members`);
  const {
    profileContract,
    treeContract,
    matchContract,
    dimensionContract,
    structureContract,
    memberContentContracts,
  } = familyPackageMemberContracts(authorityContract);
  const profiles = array(
    input.members.profiles, code, `family package ${familyKey} profiles`,
  );
  const matchFixtures = array(
    input.members.match_fixtures, code, `family package ${familyKey} match fixtures`,
  );
  const dimensions = array(
    input.members.dimension_evidence, code,
    `family package ${familyKey} dimension evidence`,
  );
  const structureFixtures = array(
    input.members.structure_fixture_members, code,
    `family package ${familyKey} structure fixtures`,
  );
  for (const [members, label] of [
    [profiles, 'profiles'],
    [matchFixtures, 'match fixtures'],
    [dimensions, 'dimension evidence'],
    [structureFixtures, 'structure fixtures'],
  ]) {
    if (members.some((member) => !isObject(member))) {
      fail(code, `family package ${familyKey} ${label} must contain only record objects`);
    }
  }
  const orderedProfiles = [...profiles].sort((left, right) => (
    codeUnitCompare(left.profile_key, right.profile_key)
      || codeUnitCompare(left.profile_id, right.profile_id)
  ));
  if (!same(profiles, orderedProfiles)
      || profiles.some((profile) => profile.schema_version !== profileContract.schema_version
        || profile.family_key !== familyKey
        || profile.profile_set_version !== input.profileSetVersion
        || profile[profileContract.record_id_field]
          !== memberContentId(profile, memberContentContracts.profiles))) {
    fail(code, `family package ${familyKey} profiles are not exact`);
  }
  unique(profiles.map((profile) => profile[profileContract.record_id_field]),
    code, 'package profile IDs');
  unique(profiles.map((profile) => profile.profile_key), code, 'package profile keys');
  const tree = input.members.subtype_tree;
  if (!isObject(tree) || tree.schema_version !== treeContract.schema_version
      || tree.family_key !== familyKey
      || tree.profile_set_version !== input.profileSetVersion
      || tree[treeContract.record_id_field]
        !== memberContentId(tree, memberContentContracts.subtype_tree)) {
    fail(code, `family package ${familyKey} subtype tree is invalid`);
  }
  for (const [members, field, contract] of [
    [matchFixtures, 'match_fixtures', matchContract],
    [dimensions, 'dimension_evidence', dimensionContract],
    [structureFixtures, 'structure_fixture_members', structureContract],
  ]) {
    const idField = contract.record_id_field;
    const contentContract = memberContentContracts[field];
    if (!same(members.map((member) => member[idField]),
      members.map((member) => member[idField]).slice().sort())
        || members.some((member) => member.schema_version !== contract.schema_version
          || member[idField] !== memberContentId(member, contentContract))) {
      fail(code, `family package ${familyKey} ${field} is not canonical`);
    }
    unique(members.map((member) => member[idField]), code, `${field} IDs`);
  }
  for (const fixture of matchFixtures) {
    validateFixtureRecord(fixture, {
      fixture_id: fixture.fixture_id,
      input_occurrence_id: fixture.input_occurrence_id,
    }, code);
  }
  const item39Contract = authorityContract?.single_global_item39_overlay_fixture_contract;
  const item39FamilyKey = item39Contract?.family_key ?? 'TERMINATION';
  const item39FixtureCount = item39Contract?.total_structure_overlay_fixture_count ?? 1;
  if ((familyKey === item39FamilyKey && structureFixtures.length !== item39FixtureCount)
      || (familyKey !== item39FamilyKey && structureFixtures.length !== 0)) {
    fail(code, 'the global structure-overlay fixture is not owned exactly once');
  }
  const legalDecisions = canonicalStringSet(
    input.legalDecisions, code, `family package ${familyKey} legal decisions`,
  );
  const profileFixtureProofs = profiles.flatMap((profile) => {
    const proofs = array(profile.fixture_proofs, code, 'profile fixture proofs');
    for (const proof of proofs) {
      if (!isObject(proof)) {
        fail(code, 'profile fixture proofs must contain only record objects');
      }
      string(proof.lawyer_ruling_id, code, 'profile fixture proof lawyer ruling ID');
    }
    return proofs;
  });
  const usedDecisions = [...new Set([
    benApprovalId,
    ...profiles.flatMap((profile) => [
      ...array(profile.legal_authority_ids, code, 'profile legal authorities'),
      ...array(profile.shared_source_lawyer_decision_ids, code,
        'profile shared-source decisions'),
    ]),
    ...profileFixtureProofs.map((proof) => proof.lawyer_ruling_id),
    ...dimensions.map((evidence) => evidence.lawyer_ruling_id),
    ...structureFixtures.map((fixture) => fixture.lawyer_ruling_id),
  ])].filter((value) => value !== null).sort();
  if (!same(legalDecisions, usedDecisions)) {
    fail(code, `family package ${familyKey} legal decision inventory is not exact`);
  }
  const memberInventory = {
    family_key: familyKey,
    profile_set_version: input.profileSetVersion,
    legal_decisions: [...legalDecisions],
    profile_ids: profiles.map((profile) => profile.profile_id),
    subtype_tree_id: tree.subtype_tree_id,
    match_fixture_record_ids: matchFixtures.map((fixture) => fixture.match_fixture_id),
    dimension_evidence_ids: dimensions.map((evidence) => evidence.dimension_evidence_id),
    structure_fixture_ids: structureFixtures.map((fixture) => fixture.fixture_id),
  };
  const approvalContract = authorityContract?.family_approval_contract;
  if (approvalContract?.approved_inventory_digest_payload_exact_keys
      && !same(Object.keys(memberInventory).sort(),
        [...approvalContract.approved_inventory_digest_payload_exact_keys].sort())) {
    fail(code, `family package ${familyKey} approval digest contract is invalid`);
  }
  return {
    memberInventory,
    inventoryFingerprint: sha256Hex(
      Buffer.from(canonicalJson(memberInventory), 'utf8'),
    ),
  };
}

function validateFamilyPackageRecord(record, familyKey, code, authorityContract = null) {
  const packageSchema = authorityContract?.schema_version
    ?? FAMILY_PROFILE_PACKAGE_SCHEMA;
  const packageKeys = authorityContract?.exact_keys ?? [
    'schema_version', 'family_profile_package_id', 'state', 'family_key',
    'profile_set_version', 'family_approval', 'legal_decisions', 'profiles',
    'subtype_tree', 'match_fixtures', 'dimension_evidence',
    'structure_fixture_members',
  ];
  const approvalContract = authorityContract?.family_approval_contract;
  exactKeys(record, packageKeys, code, `family package ${familyKey}`);
  const unsignedPackage = { ...record };
  delete unsignedPackage.family_profile_package_id;
  if (record.schema_version !== packageSchema
      || record.family_profile_package_id !== contentId(packageSchema, unsignedPackage)
      || record.state !== (authorityContract?.repository_state
        ?? 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE')
      || record.family_key !== familyKey
      || !Number.isInteger(record.profile_set_version)
      || record.profile_set_version < 1) {
    fail(code, `family package ${familyKey} has an invalid envelope`);
  }
  const approval = record.family_approval;
  exactKeys(approval, approvalContract?.exact_keys ?? [
    'schema_version', 'family_approval_id', 'ben_approval_id', 'family_key',
    'profile_set_version', 'approver', 'approved_on', 'approval_text',
    'approved_inventory_digest', 'approved_decision_classes',
  ], code, `family package ${familyKey} approval`);
  const unsignedApproval = { ...approval };
  delete unsignedApproval.family_approval_id;
  const approvalSchema = approvalContract?.schema_version
    ?? FAMILY_PROFILE_PACKAGE_APPROVAL_SCHEMA;
  if (approval.schema_version !== approvalSchema
      || approval.family_approval_id !== contentId(
        approvalSchema, unsignedApproval,
      )
      || approval.family_key !== familyKey
      || approval.profile_set_version !== record.profile_set_version
      || approval.approver !== (approvalContract?.approver ?? 'BEN_GOODCHILD')
      || !isStrictIsoCalendarDate(approval.approved_on)
      || typeof approval.approval_text !== 'string'
      || approval.approval_text.length === 0) {
    fail(code, `family package ${familyKey} approval is invalid`);
  }
  string(approval.ben_approval_id, code, 'Ben approval ID');
  assertHex(approval.approved_inventory_digest, 64, code, 'approved inventory digest');
  const allowedDecisionClasses = approvalContract?.approved_decision_classes
    ?.allowed_parent_work3_classes ?? [
    'V2_PROFILE_APPROVALS',
    'GENERIC_LEVEL_OUTPUT_APPROVED',
    'SOURCE_LIMITED_FIELD_FINDINGS',
    'LEGAL_TEXT_EXCLUSIONS',
    'FAMILY_CORRECTIONS',
    'NO_COMPARISON_RULES',
    'FAMILY_WIDE_NO_OUTPUT_POLICIES',
    'LEGAL_STRUCTURE_OVERLAYS',
    ];
  const decisionClasses = canonicalStringSet(
    approval.approved_decision_classes, code, 'approved decision classes',
  );
  if (decisionClasses.some((value) => !allowedDecisionClasses.includes(value))) {
    fail(code, `family package ${familyKey} has an unknown decision class`);
  }
  const { inventoryFingerprint } = validateFamilyPackageInventoryCore({
    familyKey,
    profileSetVersion: record.profile_set_version,
    benApprovalId: approval.ben_approval_id,
    legalDecisions: record.legal_decisions,
    members: {
      profiles: record.profiles,
      subtype_tree: record.subtype_tree,
      match_fixtures: record.match_fixtures,
      dimension_evidence: record.dimension_evidence,
      structure_fixture_members: record.structure_fixture_members,
    },
  }, code, authorityContract);
  if (approval.approved_inventory_digest !== inventoryFingerprint) {
    fail(code, `family package ${familyKey} approval digest is false`);
  }
  return record;
}

function buildFamilyPackageRegistry(profileSet, resolveBinding, code) {
  const bindings = array(
    profileSet?.family_profile_package_bindings, code, 'family profile package bindings',
  );
  if (bindings.length !== FAMILY_KEYS.length) {
    fail(code, 'approved profile set does not bind exactly 25 family packages');
  }
  const byPath = new Map();
  const byFamily = new Map();
  for (let index = 0; index < FAMILY_KEYS.length; index += 1) {
    const familyKey = FAMILY_KEYS[index];
    const binding = bindings[index];
    exactKeys(binding, BINDING_KEYS, code, `family package binding ${familyKey}`);
    if (binding.path !== FAMILY_PROFILE_PACKAGE_PATH_BY_FAMILY.get(familyKey)
        || binding.schema_version !== FAMILY_PROFILE_PACKAGE_SCHEMA
        || binding.record_id_field !== 'family_profile_package_id'
        || byPath.has(binding.path)) {
      fail(code, 'family package bindings are missing, duplicated, or reordered');
    }
    const record = validateResolvedRecordBinding(
      binding, resolveBinding, `family package ${familyKey}`, code,
    );
    byPath.set(binding.path, { binding, record, familyKey });
    byFamily.set(familyKey, { binding, record });
  }
  const benApprovalIds = FAMILY_KEYS.map((familyKey) => {
    const record = byFamily.get(familyKey).record;
    validateFamilyPackageRecord(record, familyKey, code);
    return record.family_approval.ben_approval_id;
  });
  unique(benApprovalIds, code, 'family package Ben approval IDs');
  return { bindings, byPath, byFamily, memberContracts: PACKAGE_MEMBER_FIELDS };
}

function resolvePackageMemberBinding(binding, registry, expectedField, label, code) {
  const memberContract = validatePackageMemberBindingShape(
    binding, label, code, registry?.memberContracts,
  );
  if (binding.member_field !== expectedField) {
    fail(code, `${label} uses the wrong package member field`);
  }
  const outer = registry?.byPath.get(binding.container_path);
  if (!outer) fail(code, `${label} does not join one validated outer package`);
  const member = memberContract.singleton
    ? outer.record[binding.member_field]
    : outer.record[binding.member_field]?.[binding.member_index];
  if (!isObject(member)) fail(code, `${label} does not resolve to one package member`);
  const selectedBytes = Buffer.from(canonicalJson(member), 'utf8');
  if (member.schema_version !== binding.member_schema_version
      || member[binding.member_record_id_field] !== binding.member_record_id
      || memberContentId(member, memberContract) !== binding.member_record_id
      || selectedBytes.length !== binding.member_byte_length
      || sha256Hex(selectedBytes) !== binding.member_sha256) {
    fail(code, `${label} bytes or identity differ from the package member`);
  }
  return member;
}

function validateCandidateVerification(verification, candidate, registrationBinding) {
  const code = 'M7_V2_GOVERNANCE';
  exactKeys(verification, [
    'schema_version',
    'verification_id',
    'state',
    'candidate_registration_id',
    'registration_binding',
    'checks',
    'counts',
    'effects',
  ], code, 'candidate verification');
  if (verification.schema_version !== CANDIDATE_VERIFICATION_SCHEMA
      || verification.state !== 'PASS_CANDIDATE_REGISTRATION'
      || verification.candidate_registration_id !== candidate.candidate_registration_id
      || !same(verification.registration_binding, registrationBinding)
      || !same(verification.counts, candidate.counts)
      || !same(verification.effects, CANDIDATE_VERIFICATION_EFFECTS)) {
    fail(code, 'candidate verification does not prove the selected registration');
  }
  const checks = array(verification.checks, code, 'candidate verification checks');
  if (!same(checks, CANDIDATE_VERIFICATION_CHECKS.map(
    (check_id) => ({ check_id, status: 'PASS' }),
  ))) {
    fail(code, 'candidate verification checks are incomplete or reordered');
  }
  assertHex(verification.verification_id, 64, code, 'candidate verification ID');
  const unsigned = { ...verification };
  delete unsigned.verification_id;
  if (contentId(CANDIDATE_VERIFICATION_SCHEMA, unsigned) !== verification.verification_id) {
    fail(code, 'candidate verification content ID is invalid');
  }
}

function validateCandidateRegistrationBytes(selectedBytes, governance) {
  const code = 'M7_V2_GOVERNANCE';
  let registration;
  try {
    registration = JSON.parse(selectedBytes.toString('utf8'));
  } catch {
    fail(code, 'candidate registration is not JSON');
  }
  if (!selectedBytes.equals(Buffer.from(`${canonicalJson(registration)}\n`, 'utf8'))) {
    fail(code, 'candidate registration bytes are not canonical');
  }
  if (registration.schema_version !== CANDIDATE_SCHEMA
      || registration.stage !== 'M7_V2_REPAIR'
      || registration.lifecycle_state !== 'CANDIDATE_PENDING_REVIEW') {
    fail(code, 'candidate registration envelope is not a pending V2 candidate');
  }
  exactKeys(registration, CANDIDATE_KEYS, code, 'candidate registration');
  exactKeys(registration.code_bindings, CANDIDATE_CODE_KEYS, code,
    'candidate registration code bindings');
  array(registration.code_bindings.runners, code, 'candidate runners');
  array(registration.code_bindings.tests, code, 'candidate tests');
  array(registration.semantic_input_bindings, code, 'candidate semantic inputs');
  array(registration.subtype_tree_bindings, code, 'candidate subtype trees');
  array(registration.predecessor_receipt_bindings, code, 'candidate predecessors');
  object(registration.counts, code, 'candidate counts');
  object(registration.effects, code, 'candidate effects');
  string(registration.allowed_output_root, code, 'candidate output root');
  for (const [label, binding] of [
    ['parent authority', registration.parent_authority_binding],
    ['activation receipt', registration.activation_receipt_binding],
    ['Work 0 evidence root', registration.work0_evidence_root_binding],
    ['direct family profile set', registration.family_profile_set_binding],
    ['direct structure disposition set', registration.structure_disposition_set_binding],
  ]) {
    exactKeys(binding, BINDING_KEYS, code, `candidate ${label} binding`);
    assertHex(binding.record_id, 64, code, `candidate ${label} record ID`);
  }
  const fixedGovernanceBindings = [
    [registration.parent_authority_binding,
      'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json',
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1', 'authority_id',
      AUTHORITY_ID, AUTHORITY_SHA256],
    [registration.activation_receipt_binding,
      'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json',
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
      'activation_receipt_id', ACTIVATION_ID, ACTIVATION_SHA256],
    [registration.work0_evidence_root_binding,
      'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json',
      'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1', 'evidence_root_id',
      WORK0_ID, WORK0_SHA256],
  ];
  for (const [binding, path, schemaVersion, idField, recordId, sha256] of fixedGovernanceBindings) {
    if (binding.path !== path || binding.schema_version !== schemaVersion
        || binding.record_id_field !== idField || binding.record_id !== recordId
        || binding.sha256 !== sha256) {
      fail(code, `candidate fixed governance binding ${path} is invalid`);
    }
  }
  for (const entry of registration.semantic_input_bindings) {
    exactKeys(entry, ['input_role', 'binding'], code, 'candidate semantic input');
    exactKeys(entry.binding, BINDING_KEYS, code, 'candidate semantic input binding');
    assertHex(entry.binding.record_id, 64, code, 'candidate semantic input record ID');
  }
  for (const entry of registration.predecessor_receipt_bindings) {
    exactKeys(entry, ['work', 'binding'], code, 'candidate predecessor');
    exactKeys(entry.binding, BINDING_KEYS, code, 'candidate predecessor binding');
  }
  const expectedCodePaths = {
    compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
    deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
    projector: 'lib/canonical-v2/agreement-projection.js',
    independent_verifier: 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  };
  for (const [role, path] of Object.entries(expectedCodePaths)) {
    exactKeys(registration.code_bindings[role], BINDING_KEYS, code,
      `candidate ${role} binding`);
    if (registration.code_bindings[role].path !== path) {
      fail(code, `candidate ${role} binding uses an unregistered path`);
    }
  }
  const runnerPaths = registration.code_bindings.runners.map((binding) => {
    exactKeys(binding, BINDING_KEYS, code, 'candidate runner binding');
    return binding.path;
  });
  const testPaths = registration.code_bindings.tests.map((binding) => {
    exactKeys(binding, BINDING_KEYS, code, 'candidate test binding');
    return binding.path;
  });
  const predecessorCount = registration.predecessor_receipt_bindings.length;
  const requiredTests = [
    ...CANDIDATE_TEST_PATHS,
    ...Array.from({ length: predecessorCount }, (_, index) => (
      `tests/stage-2y-structure-m7-v2-repair-work${index + 2}.test.js`
    )),
  ].sort();
  if (!same(runnerPaths, CANDIDATE_RUNNER_PATHS)
      || !same(testPaths, requiredTests)) {
    fail(code, 'candidate runner or test closed set is incomplete');
  }
  const subtypeFamilies = [];
  const subtypeContainerPaths = [];
  for (const entry of registration.subtype_tree_bindings) {
    exactKeys(entry, ['family_key', 'binding'], code, 'candidate subtype-tree binding');
    subtypeFamilies.push(string(entry.family_key, code, 'candidate subtype-tree family'));
    validatePackageMemberBindingShape(
      entry.binding, 'candidate subtype-tree package-member binding', code,
    );
    if (entry.binding.member_field !== 'subtype_tree') {
      fail(code, 'candidate subtype-tree binding uses another package member field');
    }
    subtypeContainerPaths.push(entry.binding.container_path);
  }
  if (!same(subtypeFamilies, FAMILY_KEYS)) {
    fail(code, 'candidate does not bind one ordered subtype tree for all 25 families');
  }
  unique(subtypeContainerPaths, code, 'candidate subtype-tree package paths');
  if (!same(subtypeContainerPaths, FAMILY_PROFILE_PACKAGE_PATHS)) {
    fail(code, 'candidate subtype trees do not join the exact family package registry');
  }
  exactKeys(registration.view_policy_binding, BINDING_KEYS, code,
    'candidate view-policy binding');
  if (registration.view_policy_binding.schema_version !== VIEW_POLICY_SCHEMA
      || registration.view_policy_binding.record_id_field !== 'view_policy_id') {
    fail(code, 'candidate view-policy binding has the wrong schema');
  }
  assertHex(registration.view_policy_binding.record_id, 64, code, 'candidate view-policy ID');
  const inputRoles = registration.semantic_input_bindings.map((entry) => entry.input_role);
  if (!same(inputRoles, INPUT_ROLES)
      || registration.semantic_input_bindings.some(
        (entry) => entry.binding.schema_version !== INPUT_SCHEMAS[entry.input_role],
      )) {
    fail('M7_V2_INPUT_CONSUMPTION',
      'candidate semantic inputs have the wrong role order or schemas');
  }
  const predecessors = registration.predecessor_receipt_bindings.map((entry, index) => {
    if (entry.work !== `WORK${index + 1}`) {
      fail(code, 'candidate predecessor closed set is incomplete or reordered');
    }
    assertHex(entry.binding.record_id, 64, code, 'candidate predecessor record ID');
    return entry.binding;
  });
  if (predecessors.length === 0 || predecessors.length > 5
      || predecessors[0].path !== 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json'
      || predecessors[0].schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1'
      || predecessors[0].record_id_field !== 'work1_contract_receipt_id') {
    fail(code, 'candidate predecessor chain does not start at the Work 1 receipt');
  }
  if (!registration.allowed_output_root.startsWith(
    'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/',
  )) {
    fail(code, 'candidate output root is outside the V2 repair root');
  }
  if (!same(registration.effects, CANDIDATE_EFFECTS)) {
    fail(code, 'candidate effects are not the closed zero-effect contract');
  }
  const boundPaths = [
    registration.parent_authority_binding,
    registration.activation_receipt_binding,
    registration.work0_evidence_root_binding,
    ...Object.keys(expectedCodePaths).map((role) => registration.code_bindings[role]),
    ...registration.code_bindings.runners,
    ...registration.code_bindings.tests,
    ...registration.semantic_input_bindings.map((entry) => entry.binding),
    registration.family_profile_set_binding,
    ...registration.subtype_tree_bindings.map((entry) => entry.binding),
    registration.structure_disposition_set_binding,
    registration.view_policy_binding,
    ...registration.predecessor_receipt_bindings.map((entry) => entry.binding),
  ].map((binding) => binding.path ?? binding.container_path);
  const expectedCounts = {
    code_file_count: 5 + runnerPaths.length + testPaths.length,
    runner_count: runnerPaths.length,
    test_count: testPaths.length,
    semantic_input_count: registration.semantic_input_bindings.length,
    subtype_tree_count: registration.subtype_tree_bindings.length,
    predecessor_receipt_count: registration.predecessor_receipt_bindings.length,
    unique_bound_path_count: new Set(boundPaths).size,
  };
  if (!same(registration.counts, expectedCounts)) {
    fail(code, 'candidate registration counts are false');
  }
  const unsigned = { ...registration };
  delete unsigned.candidate_registration_id;
  const expectedId = contentId(registration.schema_version, unsigned);
  if (registration.candidate_registration_id !== expectedId
      || governance.candidate_registration_id !== expectedId) {
    fail(code, 'candidate registration self identity is invalid');
  }
  const expectedRegistrationPath =
    `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/${expectedId}.json`;
  if (governance.candidate_registration_binding.path !== expectedRegistrationPath) {
    fail(code, 'candidate registration binding path is not content addressed');
  }
  return registration;
}

function validateGovernance(governance, resolveBinding) {
  const code = 'M7_V2_GOVERNANCE';
  const inputCode = 'M7_V2_INPUT_CONSUMPTION';
  exactKeys(governance, [
    'candidate_registration_id',
    'candidate_registration_verification',
    'candidate_registration_binding',
    'code_bindings',
    'semantic_input_bindings',
    'family_profile_set_binding',
    'structure_disposition_set_binding',
    'view_policy_binding',
    'predecessor_receipt_bindings',
  ], code, 'analysis.governance');
  assertHex(governance.candidate_registration_id, 64, code, 'candidate registration ID');
  const candidateBytes = validateBinding(governance.candidate_registration_binding, resolveBinding,
    'candidate registration binding');
  if (governance.candidate_registration_binding.schema_version
      !== CANDIDATE_SCHEMA
      || governance.candidate_registration_binding.record_id_field !== 'candidate_registration_id'
      || governance.candidate_registration_binding.record_id !== governance.candidate_registration_id) {
    fail(code, 'candidate registration identity is inconsistent');
  }
  const candidate = validateCandidateRegistrationBytes(candidateBytes, governance);
  validateCandidateVerification(governance.candidate_registration_verification, candidate,
    governance.candidate_registration_binding);

  array(governance.code_bindings, code, 'code bindings');
  const codeRoles = [];
  for (const entry of governance.code_bindings) {
    exactKeys(entry, ['role', 'binding'], code, 'code binding');
    codeRoles.push(string(entry.role, code, 'code binding role'));
    validateBinding(entry.binding, resolveBinding, `code binding ${entry.role}`);
  }
  unique(codeRoles, code, 'code binding roles');
  if (!same([...codeRoles].sort(), [...CODE_ROLES].sort())) {
    fail(code, 'the three bound deterministic code roles are not exact');
  }
  const governanceCodeByRole = new Map(governance.code_bindings.map(
    (entry) => [entry.role, entry.binding],
  ));
  if (!same(candidate.code_bindings.compiler, governanceCodeByRole.get('COMPILER'))
      || !same(candidate.code_bindings.deterministic_generator,
        governanceCodeByRole.get('DETERMINISTIC_GENERATOR'))
      || !same(candidate.code_bindings.contract_validator,
        governanceCodeByRole.get('CONTRACT_VALIDATOR'))) {
    fail(code, 'analysis code bindings differ from the registered candidate');
  }

  array(governance.semantic_input_bindings, code, 'semantic input bindings');
  const inputByRole = new Map();
  const inputRecords = new Map();
  for (const entry of governance.semantic_input_bindings) {
    exactKeys(entry, ['role', 'binding'], code, 'semantic input binding');
    const role = string(entry.role, code, 'semantic input role');
    if (inputByRole.has(role)) fail(inputCode, `duplicate semantic input role ${role}`);
    if (entry.binding.schema_version !== INPUT_SCHEMAS[role]) {
      fail(inputCode, `semantic input ${role} has the wrong schema`);
    }
    const record = validateResolvedRecordBinding(entry.binding, resolveBinding,
      `semantic input ${role}`, inputCode);
    inputByRole.set(role, entry.binding);
    inputRecords.set(role, record);
  }
  if (!same([...inputByRole.keys()].sort(), [...INPUT_ROLES].sort())) {
    fail(inputCode, 'the six registered semantic inputs are not exact');
  }
  if (!same(governance.family_profile_set_binding,
    inputByRole.get('APPROVED_FAMILY_PROFILE_SET'))
      || !same(governance.structure_disposition_set_binding,
        inputByRole.get('APPROVED_STRUCTURE_DISPOSITION_SET'))) {
    fail(inputCode, 'direct profile or structure binding differs from the registered input');
  }
  const candidateInputs = new Map();
  for (const entry of candidate.semantic_input_bindings) {
    exactKeys(entry, ['input_role', 'binding'], code, 'candidate semantic input');
    if (candidateInputs.has(entry.input_role)) {
      fail(inputCode, 'candidate registration repeats a semantic input role');
    }
    candidateInputs.set(entry.input_role, entry.binding);
  }
  if (!same([...candidateInputs.keys()], INPUT_ROLES)
      || INPUT_ROLES.some((role) => !same(candidateInputs.get(role), inputByRole.get(role)))) {
    fail(inputCode, 'analysis semantic inputs differ from the registered candidate');
  }
  if (!same(candidate.family_profile_set_binding, governance.family_profile_set_binding)
      || !same(candidate.structure_disposition_set_binding,
        governance.structure_disposition_set_binding)) {
    fail(inputCode, 'analysis direct semantic bindings differ from the registered candidate');
  }
  const packageRegistry = buildFamilyPackageRegistry(
    inputRecords.get('APPROVED_FAMILY_PROFILE_SET'), resolveBinding, 'M7_V2_PROFILE_GATE',
  );
  const approvedTreeBindings = inputRecords.get(
    'APPROVED_FAMILY_PROFILE_SET',
  ).subtype_tree_bindings;
  if (!same(candidate.subtype_tree_bindings, approvedTreeBindings)) {
    fail('M7_V2_PROFILE_GATE',
      'candidate subtype trees differ from the approved package members');
  }
  for (let index = 0; index < candidate.subtype_tree_bindings.length; index += 1) {
    const entry = candidate.subtype_tree_bindings[index];
    if (entry.family_key !== FAMILY_KEYS[index]) {
      fail(code, 'candidate subtype trees are not in C3 family order');
    }
    resolvePackageMemberBinding(
      entry.binding, packageRegistry, 'subtype_tree',
      `candidate subtype tree ${entry.family_key}`, code,
    );
  }
  if (!same(candidate.view_policy_binding, governance.view_policy_binding)) {
    fail(code, 'analysis view-policy binding differs from the registered candidate');
  }
  validateResolvedRecordBinding(governance.view_policy_binding, resolveBinding,
    'registered view policy', code);

  array(governance.predecessor_receipt_bindings, code, 'predecessor receipt bindings');
  if (governance.predecessor_receipt_bindings.length === 0) {
    fail(code, 'at least one predecessor receipt must be bound');
  }
  const predecessorPaths = [];
  for (const binding of governance.predecessor_receipt_bindings) {
    const receipt = validateResolvedRecordBinding(binding, resolveBinding,
      'predecessor receipt binding', code);
    if (receipt.status !== 'PASS' || typeof receipt.state !== 'string'
        || !receipt.state.startsWith('PASS')) {
      fail(code, 'predecessor receipt does not record a pass');
    }
    predecessorPaths.push(binding.path);
  }
  unique(predecessorPaths, code, 'predecessor receipt paths');
  const candidatePredecessors = candidate.predecessor_receipt_bindings.map((entry) => {
    exactKeys(entry, ['work', 'binding'], code, 'candidate predecessor');
    if (!/^WORK[1-7]$/.test(entry.work)) fail(code, 'candidate predecessor work is invalid');
    return entry.binding;
  });
  if (!same(candidatePredecessors, governance.predecessor_receipt_bindings)) {
    fail(code, 'analysis predecessors differ from the registered candidate');
  }
  return { candidate, inputByRole, inputRecords, packageRegistry };
}

function validateFamilyPacketAuthority(
  familyPacketSet, governance, resolveBinding, familyKeys = FAMILY_KEYS,
) {
  const code = 'M7_V2_INPUT_CONSUMPTION';
  const bindingCode = 'M7_V2_BINDING_DRIFT';
  exactKeys(familyPacketSet, [
    'schema_version', 'family_packet_set_id', 'family_packet_set_digest', 'stage', 'state',
    'work0_evidence_root_binding', 'fixed_sample_identity_binding',
    'repair_baseline_binding', 'calibration_ruling_map_binding',
    'lawyer_review_packet_binding', 'coverage', 'constraints', 'families',
    'structure_ambiguity_members',
  ], code, 'family packet set');
  if (familyPacketSet.schema_version !== INPUT_SCHEMAS.APPROVED_FAMILY_PACKET_SET
      || familyPacketSet.stage !== 'M7_V2_REPAIR_WORK1'
      || familyPacketSet.state !== 'LEGAL_EVIDENCE_ORACLE_NOT_EXECUTABLE_PROFILE_AUTHORITY') {
    fail(code, 'family packet set envelope is not the exact Work1 legal evidence oracle');
  }
  const unsignedPacket = { ...familyPacketSet };
  delete unsignedPacket.family_packet_set_digest;
  delete unsignedPacket.family_packet_set_id;
  const expectedDigest = sha256Hex(canonicalJson(unsignedPacket));
  const withDigest = { ...unsignedPacket, family_packet_set_digest: expectedDigest };
  if (familyPacketSet.family_packet_set_digest !== expectedDigest
      || familyPacketSet.family_packet_set_id !== contentId(
        INPUT_SCHEMAS.APPROVED_FAMILY_PACKET_SET, withDigest,
      )) {
    fail(code, 'family packet set digest or content identity is invalid');
  }
  const packetBinding = governance.inputByRole.get('APPROVED_FAMILY_PACKET_SET');
  if (packetBinding.schema_version !== INPUT_SCHEMAS.APPROVED_FAMILY_PACKET_SET
      || packetBinding.record_id_field !== 'family_packet_set_id'
      || packetBinding.record_id !== familyPacketSet.family_packet_set_id) {
    fail(bindingCode, 'family packet set binding does not identify the exact packet bytes');
  }

  if (!same(familyPacketSet.work0_evidence_root_binding,
    governance.candidate.work0_evidence_root_binding)) {
    fail(bindingCode, 'family packet Work0 binding differs from the registered candidate');
  }
  const work0 = validateResolvedRecordBinding(
    familyPacketSet.work0_evidence_root_binding, resolveBinding,
    'family packet Work0 evidence root', bindingCode,
  );
  if (familyPacketSet.work0_evidence_root_binding.path !== WORK0_EVIDENCE_ROOT_PATH
      || familyPacketSet.work0_evidence_root_binding.schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1'
      || familyPacketSet.work0_evidence_root_binding.record_id_field !== 'evidence_root_id'
      || familyPacketSet.work0_evidence_root_binding.record_id !== WORK0_ID
      || work0.evidence_root_id !== WORK0_ID) {
    fail(bindingCode, 'family packet does not bind the immutable Work0 evidence root');
  }
  const work0Records = array(work0.work0_record_bindings, code,
    'Work0 record bindings');
  const work0Snapshots = array(work0.snapshot_bindings, code,
    'Work0 snapshot bindings');
  const exactWork0Binding = (entries, repositoryPath, label) => {
    const matches = entries.filter((binding) => binding.path === repositoryPath);
    if (matches.length !== 1) fail(bindingCode, `${label} is not unique in the Work0 root`);
    exactKeys(matches[0], BINDING_KEYS, bindingCode, label);
    return matches[0];
  };
  const sourceSpecifications = [
    ['fixed_sample_identity_binding', FIXED_SAMPLE_PATH, 'fixed sample'],
    ['repair_baseline_binding', REPAIR_BASELINE_PATH, 'repair baseline'],
    ['calibration_ruling_map_binding', CALIBRATION_RULING_MAP_PATH,
      'calibration ruling map'],
  ];
  const sourceRecords = new Map();
  for (const [field, repositoryPath, label] of sourceSpecifications) {
    exactKeys(familyPacketSet[field], BINDING_KEYS, bindingCode,
      `family packet ${label} binding`);
    const work0RecordBinding = exactWork0Binding(work0Records, repositoryPath,
      `Work0 ${label} record binding`);
    const work0SnapshotBinding = exactWork0Binding(work0Snapshots, repositoryPath,
      `Work0 ${label} snapshot binding`);
    if (!same(familyPacketSet[field], work0RecordBinding)
        || !same(familyPacketSet[field], work0SnapshotBinding)) {
      fail(bindingCode,
        `family packet ${label} binding differs from the immutable Work0 root`);
    }
    sourceRecords.set(field, validateResolvedRecordBinding(
      familyPacketSet[field], resolveBinding, `family packet ${label}`, bindingCode,
    ));
  }

  exactKeys(familyPacketSet.lawyer_review_packet_binding, BINDING_KEYS, bindingCode,
    'family packet lawyer review binding');
  const work0ReviewBindings = array(work0.evidence_input_bindings, code,
    'Work0 evidence input bindings').filter((entry) => (
    entry.role === 'LAWYER_REVIEW_PACKET' && entry.path === LAWYER_REVIEW_PACKET_PATH
  ));
  if (work0ReviewBindings.length !== 1) {
    fail(bindingCode, 'lawyer review packet is not unique in the immutable Work0 root');
  }
  const work0ReviewBinding = work0ReviewBindings[0];
  const reviewBytes = validateBinding(familyPacketSet.lawyer_review_packet_binding,
    resolveBinding, 'family packet lawyer review packet');
  const lawyerReviewPacket = validateCanonicalRecordBytes(
    reviewBytes, familyPacketSet.lawyer_review_packet_binding, bindingCode,
    'family packet lawyer review packet',
  );
  const expectedReviewBinding = {
    path: work0ReviewBinding.path,
    schema_version: work0ReviewBinding.schema_version,
    record_id_field: work0ReviewBinding.record_id_field,
    record_id: work0ReviewBinding.record_id,
    byte_length: work0ReviewBinding.byte_length,
    sha256: work0ReviewBinding.sha256,
    git_blob_oid: gitBlobOid(reviewBytes),
  };
  if (!same(familyPacketSet.lawyer_review_packet_binding, expectedReviewBinding)
      || work0ReviewBinding.binding_source !== 'ADOPTED_PLAN_COMMIT_BLOB'
      || work0ReviewBinding.purpose !== 'WORK0_FAILURE_EVIDENCE'
      || work0ReviewBinding.v2_admissible !== false) {
    fail(bindingCode,
      'family packet lawyer review binding differs from the Work0 evidence input');
  }

  const fixedSample = sourceRecords.get('fixed_sample_identity_binding');
  const repairBaseline = sourceRecords.get('repair_baseline_binding');
  const calibrationRulingMap = sourceRecords.get('calibration_ruling_map_binding');
  const expectedCoverage = {
    ...lawyerReviewPacket.coverage,
    repair_item_count: repairBaseline.counts.repair_items,
    control_item_count: repairBaseline.counts.control_items,
    linked_point_count: LINKED_POINT_ORDINALS.length,
    linked_point_ordinals: LINKED_POINT_ORDINALS,
  };
  const expectedConstraints = {
    exact_family_count: 25,
    exact_sample_count: 50,
    exact_structure_ambiguity_count: 1,
    contains_executable_matcher: false,
    can_assert_completeness: false,
    v1_role_relabelling_forbidden: true,
    every_sample_has_broad_and_family_subtype_question: true,
    substantive_notes_preserved_verbatim: true,
    focused_expectations_are_closed_and_testable: true,
  };
  if (!same(familyPacketSet.coverage, expectedCoverage)
      || !same(familyPacketSet.constraints, expectedConstraints)) {
    fail(code, 'family packet coverage or constraints differ from the Work1 finaliser');
  }

  const fixedMembers = array(fixedSample.members, code, 'fixed-sample members');
  const baselineEntries = array(repairBaseline.entries, code, 'repair-baseline entries');
  const reviewItems = array(lawyerReviewPacket.items, code, 'lawyer review items');
  const rulingFamilies = array(calibrationRulingMap.families, code,
    'calibration ruling families');
  const fixedByOrdinal = new Map(fixedMembers.map(
    (member) => [member.sample_ordinal, member],
  ));
  const baselineByOrdinal = new Map(baselineEntries.map(
    (entry) => [entry.sample_ordinal, entry],
  ));
  const reviewByOrdinal = new Map(reviewItems.map(
    (item) => [item.sample_ordinal, item],
  ));
  if (fixedMembers.length !== 50 || fixedByOrdinal.size !== 50
      || baselineEntries.length !== 50 || baselineByOrdinal.size !== 50
      || reviewItems.length !== 50 || reviewByOrdinal.size !== 50
      || rulingFamilies.length !== familyKeys.length
      || !same([...new Set(rulingFamilies.map((family) => family.family_key))].sort(),
        [...familyKeys].sort())) {
    fail(code, 'family packet source records do not preserve the Work0 50-item programme');
  }

  const families = array(familyPacketSet.families, code, 'family packet families');
  if (families.length !== rulingFamilies.length
      || !same(families.map((family) => family.family_key),
        rulingFamilies.map((family) => family.family_key))) {
    fail(code, 'family packet family order differs from the bound ruling map');
  }
  const packetRulingIds = new Set();
  const decisionAuthorities = new Map();
  const seenOrdinals = [];
  const seenReviewItemIds = [];
  const memberKeys = [
    'sample_ordinal', 'review_item_id', 'agreement_id', 'item_kind', 'prior_row_id',
    'source_node_occurrence_ids', 'ambiguity_id', 'source_spans',
    'source_excerpt_sha256', 'repair_membership', 'repair_class', 'original_decision',
    'original_note', 'lawyer_decision_id', 'reviewer',
    'fresh_work5_question_required', 'linked_point_annotation',
    'broad_legal_meaning_question', 'family_and_subtype_question', 'focused_expectation',
  ];
  const validatePacketMember = (packetMember, expectedFamilyKey) => {
    exactKeys(packetMember, memberKeys, code, 'family packet sample member');
    exactKeys(packetMember.focused_expectation,
      ['state', 'invariant_id', 'note_application'], code,
      'family packet focused expectation');
    const fixed = fixedByOrdinal.get(packetMember.sample_ordinal);
    const baseline = baselineByOrdinal.get(packetMember.sample_ordinal);
    const reviewItem = reviewByOrdinal.get(packetMember.sample_ordinal);
    const expectedFocusedExpectation = {
      state: baseline?.requires_fresh_work5_question
        ? 'FRESH_WORK5_RULING_REQUIRED' : 'TESTABLE',
      invariant_id: REPAIR_INVARIANTS[baseline?.repair_class],
      note_application: baseline?.requires_fresh_work5_question
        ? 'PRIOR_RECORD_CONFLICT_VISIBLE_NOT_AUTHORITY'
        : baseline?.repair_membership === 'CONTROL'
          ? 'NO_REGRESSION_FROM_ACCEPTED_RESULT'
          : baseline?.original_note !== null
            ? 'EVERY_SOURCE_FEATURE_IDENTIFIED_BY_VERBATIM_NOTE_MUST_BE_ACCOUNTED_FOR_IN_TYPED_FACT_EXPRESSION_DEPENDENCY_OR_GOVERNED_DISPOSITION'
            : 'CLASS_INVARIANT_ONLY',
    };
    if (!fixed || !baseline || !reviewItem
        || fixed.family_key !== expectedFamilyKey
        || reviewItem.family_key !== expectedFamilyKey
        || packetMember.review_item_id !== fixed.review_item_id
        || packetMember.review_item_id !== reviewItem.review_item_id
        || packetMember.agreement_id !== fixed.agreement_id
        || packetMember.item_kind !== fixed.item_kind
        || packetMember.prior_row_id !== fixed.prior_row_id
        || !same(packetMember.source_node_occurrence_ids, fixed.source_node_occurrence_ids)
        || packetMember.ambiguity_id !== fixed.ambiguity_id
        || !same(packetMember.source_spans, fixed.source_spans)
        || packetMember.source_excerpt_sha256 !== fixed.source_excerpt_sha256
        || packetMember.review_item_id !== baseline.review_item_id
        || packetMember.repair_membership !== baseline.repair_membership
        || packetMember.repair_class !== baseline.repair_class
        || packetMember.original_decision !== baseline.original_decision
        || packetMember.original_note !== baseline.original_note
        || packetMember.lawyer_decision_id !== baseline.lawyer_decision_id
        || packetMember.reviewer !== baseline.reviewer
        || packetMember.fresh_work5_question_required
          !== baseline.requires_fresh_work5_question
        || packetMember.linked_point_annotation
          !== LINKED_POINT_ORDINALS.includes(packetMember.sample_ordinal)
        || packetMember.broad_legal_meaning_question
          !== 'Does the V2 result preserve every important legal effect, condition, exception, timing term, standard and qualification in this source?'
        || packetMember.family_and_subtype_question
          !== `Is ${expectedFamilyKey ?? 'the post-overlay result'} assigned to the correct family and most-specific supported subtype?`
        || !same(packetMember.focused_expectation, expectedFocusedExpectation)) {
      fail(code, `family packet item ${packetMember.sample_ordinal} drifts from Work0`);
    }
    assertHex(packetMember.lawyer_decision_id, 64, code, 'lawyer decision ID');
    string(packetMember.reviewer, code, 'lawyer decision reviewer');
    if (decisionAuthorities.has(packetMember.lawyer_decision_id)) {
      fail(code, 'family packet repeats a lawyer decision ID');
    }
    decisionAuthorities.set(packetMember.lawyer_decision_id, {
      packetMember,
      fixedMember: fixed,
      baselineEntry: baseline,
    });
    seenOrdinals.push(packetMember.sample_ordinal);
    seenReviewItemIds.push(packetMember.review_item_id);
  };

  for (let index = 0; index < families.length; index += 1) {
    const family = families[index];
    const rulingFamily = rulingFamilies[index];
    exactKeys(family, [
      'family_key', 'wave', 'calibration_pack_binding', 'programme_question_mappings',
      'sample_members', 'legal_oracle_state', 'executable_matcher_present',
      'profile_set_binding_state',
    ], code, 'family packet family');
    const expectedMappings = array(rulingFamily.question_mappings, code,
      'calibration question mappings').map((mapping) => ({
      family_question_id: mapping.family_question_id,
      programme_question_id: mapping.programme_question_id,
      ruling_id: mapping.ruling_id,
      selection: mapping.selection,
      legal_rule: mapping.legal_rule,
    }));
    const mappings = array(family.programme_question_mappings, code,
      'family programme question mappings');
    mappings.forEach((mapping) => exactKeys(mapping, [
      'family_question_id', 'programme_question_id', 'ruling_id', 'selection', 'legal_rule',
    ], code, 'family programme question mapping'));
    const sampleMembers = array(family.sample_members, code, 'family packet sample members');
    const expectedSampleOrdinals = fixedMembers.filter(
      (member) => member.family_key === family.family_key,
    ).map((member) => member.sample_ordinal);
    if (family.wave !== rulingFamily.wave
        || !same(family.calibration_pack_binding, rulingFamily.calibration_pack_binding)
        || !same(mappings, expectedMappings)
        || family.legal_oracle_state !== 'WORK1_EVIDENCE_ONLY_NOT_COMPLETENESS_AUTHORITY'
        || family.executable_matcher_present !== false
        || family.profile_set_binding_state !== 'PENDING_WORK3_BEN_APPROVAL'
        || !same(sampleMembers.map((member) => member.sample_ordinal),
          expectedSampleOrdinals)) {
      fail(code, `family packet ${family.family_key} differs from the bound ruling map`);
    }
    mappings.forEach((mapping) => packetRulingIds.add(
      string(mapping.ruling_id, code, 'packet ruling ID'),
    ));
    sampleMembers.forEach((member) => validatePacketMember(member, family.family_key));
  }

  const structureAmbiguityMembers = array(familyPacketSet.structure_ambiguity_members,
    code, 'family packet structure-ambiguity members');
  if (structureAmbiguityMembers.length !== 1
      || structureAmbiguityMembers[0].sample_ordinal !== 39) {
    fail(code, 'family packet structure ambiguity member is not exact item 39');
  }
  validatePacketMember(structureAmbiguityMembers[0], null);
  const expectedOrdinals = Array.from({ length: 50 }, (_, index) => index + 1);
  if (!same([...seenOrdinals].sort((left, right) => left - right), expectedOrdinals)
      || new Set(seenReviewItemIds).size !== 50
      || decisionAuthorities.size !== 50) {
    fail(code, 'family packet does not cover each Work0 item exactly once');
  }
  return { packetRulingIds, decisionAuthorities };
}

function nativeContextSpanKey(agreementIndexId, sourceNodeId, span) {
  return [
    agreementIndexId,
    sourceNodeId,
    span.start_byte,
    span.end_byte,
    span.text_sha256,
  ].join('\0');
}

function contextProjectionSpans(analysis, agreementIndexId, resolveBinding) {
  const code = 'M7_V2_INPUT_CONSUMPTION';
  const spansByKey = new Map();
  const partySupportIds = new Set(
    (Array.isArray(analysis.facts) ? analysis.facts : []).filter(
      (fact) => ['PARTY', 'PARTY_SET'].includes(fact?.value_type)
        && Array.isArray(fact.source_support_ids),
    ).flatMap((fact) => fact.source_support_ids),
  );
  for (const closure of Array.isArray(analysis.source_closures) ? analysis.source_closures : []) {
    if (!isObject(closure.agreement_index_binding)
        || closure.agreement_index_binding.record_id !== agreementIndexId
        || !Array.isArray(closure.spans)) continue;
    const agreementIndex = validateResolvedRecordBinding(
      closure.agreement_index_binding, resolveBinding,
      `context projection AgreementIndex ${agreementIndexId}`, code,
    );
    const sourceText = agreementIndex.source_binding?.canonical_text;
    if (typeof sourceText !== 'string') {
      fail(code, 'context projection AgreementIndex lacks canonical source bytes');
    }
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    for (const span of closure.spans) {
      if (!isObject(span) || typeof span.span_id !== 'string'
          || typeof span.source_node_occurrence_id !== 'string'
          || !Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)
          || typeof span.text_sha256 !== 'string' || span.start_byte < 0
          || span.end_byte <= span.start_byte || span.end_byte > sourceBytes.length) continue;
      const key = nativeContextSpanKey(
        agreementIndexId, span.source_node_occurrence_id, span,
      );
      const selected = {
        span_id: span.span_id,
        source_node_occurrence_id: span.source_node_occurrence_id,
        start_byte: span.start_byte,
        end_byte: span.end_byte,
        source_bytes: sourceBytes.subarray(span.start_byte, span.end_byte),
      };
      const prior = spansByKey.get(key);
      if (prior && (prior.span_id !== selected.span_id
          || !prior.source_bytes.equals(selected.source_bytes))) {
        fail(code, 'one native context span maps to conflicting V2 source spans');
      }
      spansByKey.set(key, selected);
    }
  }
  return { spansByKey, partySupportIds };
}

function addProjectedContextEdge(contextEdges, edge, code) {
  const prior = contextEdges.get(edge.edge_id);
  if (prior && !same(prior, edge)) {
    fail(code, `native context edge ${edge.edge_id} has conflicting projections`);
  }
  if (prior) fail(code, `native context edge ${edge.edge_id} is duplicated`);
  contextEdges.set(edge.edge_id, edge);
}

function projectNativeContextEdges(contextRecord, analysis, resolveBinding) {
  const code = 'M7_V2_INPUT_CONSUMPTION';
  const agreementIndexId = contextRecord.agreement_index_binding?.agreement_index_id;
  assertHex(agreementIndexId, 64, code, 'native context AgreementIndex ID');
  const { spansByKey, partySupportIds } = contextProjectionSpans(
    analysis, agreementIndexId, resolveBinding,
  );
  const contextEdges = new Map();
  const referenceGroups = new Map();
  for (const edge of array(contextRecord.reference_edges, code, 'native reference edges')) {
    if (!isObject(edge.source_span) || typeof edge.owner_node_occurrence_id !== 'string') continue;
    const selected = spansByKey.get(nativeContextSpanKey(
      agreementIndexId, edge.owner_node_occurrence_id, edge.source_span,
    ));
    if (!selected) continue;
    exactKeys(edge, [
      'schema_version', 'reference_edge_id', 'owner_node_occurrence_id',
      'source_annotation_occurrence_id', 'source_span', 'raw_text', 'normalised_reference',
      'target_node_occurrence_ids', 'selected_target_node_occurrence_id', 'state',
      'reason_code', 'rule_id', 'rule_version',
    ], code, 'selected native reference edge');
    if (edge.schema_version !== 'CONTEXT_REFERENCE_EDGE/V1'
        || !['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(edge.state)
        || (edge.state === 'RESOLVED'
          ? typeof edge.selected_target_node_occurrence_id !== 'string'
          : edge.selected_target_node_occurrence_id !== null)
        || !selected.source_bytes.equals(Buffer.from(edge.raw_text, 'utf8'))) {
      fail(code, 'selected native reference edge is not exact');
    }
    const edgeId = string(edge.reference_edge_id, code, 'native reference edge ID');
    const projected = {
      edge_id: edgeId,
      edge_type: 'REFERENCE_TARGET',
      target_id: edge.state === 'RESOLVED' ? edge.selected_target_node_occurrence_id : null,
      state: edge.state,
    };
    const signature = {
      owner_node_occurrence_id: edge.owner_node_occurrence_id,
      source_annotation_occurrence_id: edge.source_annotation_occurrence_id,
      normalised_reference: edge.normalised_reference,
      target_node_occurrence_ids: edge.target_node_occurrence_ids,
      reason_code: edge.reason_code,
      rule_id: edge.rule_id,
      rule_version: edge.rule_version,
      projected,
    };
    const group = referenceGroups.get(edgeId) ?? {
      signature,
      projected,
      selected: [],
      spanIds: new Set(),
    };
    if (!same(group.signature, signature) || group.spanIds.has(selected.span_id)) {
      fail(code, `native reference edge ${edgeId} has conflicting per-span evidence`);
    }
    group.spanIds.add(selected.span_id);
    group.selected.push(selected);
    referenceGroups.set(edgeId, group);
  }
  for (const [edgeId, group] of referenceGroups) {
    const ordered = [...group.selected].sort((left, right) =>
      left.start_byte - right.start_byte || left.end_byte - right.end_byte);
    if (ordered.some((selected, index) => index > 0
        && (ordered[index - 1].source_node_occurrence_id
          !== selected.source_node_occurrence_id
          || ordered[index - 1].end_byte !== selected.start_byte))) {
      fail(code, `native reference edge ${edgeId} spans non-contiguous source`);
    }
    const nonWhitespace = ordered.filter(
      (selected) => /\S/u.test(selected.source_bytes.toString('utf8')),
    );
    if (nonWhitespace.length !== 1 || ordered.some((selected) => (
      selected !== nonWhitespace[0]
        && !/^\s+$/u.test(selected.source_bytes.toString('utf8'))
    ))) {
      fail(code, `native reference edge ${edgeId} lacks one exact token and whitespace boundary`);
    }
    addProjectedContextEdge(contextEdges, {
      ...group.projected,
      source_support_ids: ordered.map((selected) => selected.span_id),
    }, code);
  }

  const claimedPartySpanIds = new Set();
  for (const relationship of array(
    contextRecord.semantic_relationships, code, 'native semantic relationships',
  )) {
    if (!Array.isArray(relationship.source_spans)
        || !Array.isArray(relationship.source_node_occurrence_ids)) continue;
    const selectedPartySpans = [];
    for (const nativeSpan of relationship.source_spans) {
      const matches = relationship.source_node_occurrence_ids.flatMap((sourceNodeId) => {
        const selected = spansByKey.get(nativeContextSpanKey(
          agreementIndexId, sourceNodeId, nativeSpan,
        ));
        return selected && partySupportIds.has(selected.span_id) ? [selected] : [];
      });
      if (matches.length > 1) {
        fail(code, 'one native relationship span maps to multiple V2 party spans');
      }
      if (matches.length === 1) selectedPartySpans.push(matches[0]);
    }
    if (selectedPartySpans.length === 0) continue;
    exactKeys(relationship, [
      'schema_version', 'semantic_relationship_id', 'relationship_type', 'state',
      'directed', 'reason_code', 'rule_id', 'rule_version', 'source_endpoint',
      'target_endpoint', 'source_node_occurrence_ids', 'source_spans', 'temporal_scope',
    ], code, 'selected native semantic relationship');
    if (relationship.schema_version !== 'CONTEXT_SEMANTIC_RELATIONSHIP/V1'
        || !['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(relationship.state)) {
      fail(code, 'selected native semantic relationship is invalid');
    }
    const endpoints = [relationship.source_endpoint, relationship.target_endpoint];
    for (const endpoint of endpoints) {
      exactKeys(endpoint, [
        'canonical_label', 'definition_annotation_occurrence_id', 'entity_id', 'entity_kind',
        'source_node_occurrence_id', 'source_span',
      ], code, 'native semantic relationship endpoint');
    }
    for (const selected of selectedPartySpans) {
      const matchingEndpoints = endpoints.filter((endpoint) => (
        typeof endpoint.canonical_label === 'string'
          && selected.source_bytes.equals(Buffer.from(endpoint.canonical_label, 'utf8'))
      ));
      if (matchingEndpoints.length !== 1) {
        fail(code, 'native party span does not prove exactly one bound entity endpoint');
      }
      if (claimedPartySpanIds.has(selected.span_id)) {
        fail(code, 'one party alias interval maps to more than one native relationship endpoint');
      }
      claimedPartySpanIds.add(selected.span_id);
      const endpoint = matchingEndpoints[0];
      addProjectedContextEdge(contextEdges, {
        edge_id: `${string(relationship.semantic_relationship_id, code,
          'native semantic relationship ID')}:${string(endpoint.entity_id, code,
          'native relationship entity ID')}`,
        edge_type: 'PARTY_ALIAS',
        target_id: endpoint.entity_id,
        state: relationship.state,
        source_support_ids: [selected.span_id],
      }, code);
    }
  }
  return contextEdges;
}

function addGovernedDurationContextEdges(analysis, contextEdges) {
  const code = 'M7_V2_FACT_OWNERSHIP';
  const dependencies = Array.isArray(analysis.dependencies) ? analysis.dependencies : [];
  const links = Array.isArray(analysis.ownership_links) ? analysis.ownership_links : [];
  const facts = Array.isArray(analysis.facts) ? analysis.facts : [];
  for (const dependency of dependencies.filter(
    (entry) => entry?.dependency_type === 'DURATION_CONDITION_REFERENCE',
  )) {
    const matchingLinks = links.filter((link) => Array.isArray(link.consumer_dependency_ids)
      && link.consumer_dependency_ids.includes(dependency.dependency_id)
      && Array.isArray(link.consumer_context_edge_ids)
      && link.consumer_context_edge_ids.includes(dependency.context_edge_id));
    if (matchingLinks.length !== 1) {
      fail(code, 'duration dependency lacks one exact ownership link');
    }
    const link = matchingLinks[0];
    const ownerFact = facts.find((fact) => fact.fact_id === link.owner_fact_id);
    if (!ownerFact || dependency.target_id !== link.resolved_owner_target_id
        || dependency.target_id !== ownerFact.semantic_fact_key
        || !same(dependency.source_support_ids, link.consumer_reference_span_ids)) {
      fail(code, 'duration dependency and ownership link do not prove one owner fact');
    }
    addProjectedContextEdge(contextEdges, {
      edge_id: dependency.context_edge_id,
      edge_type: 'DURATION_REFERENCE_TARGET',
      target_id: link.resolved_owner_target_id,
      state: dependency.state,
      source_support_ids: dependency.source_support_ids,
    }, code);
  }
}

function validateSemanticInputConsumption(analysis, governance, resolveBinding) {
  const code = 'M7_V2_INPUT_CONSUMPTION';
  const baseSet = governance.inputRecords.get('BASE_ANALYSIS_SET');
  exactKeys(baseSet, ['schema_version', 'agreement_analysis_set_id', 'members'], code,
    'base analysis set');
  if (baseSet.schema_version !== INPUT_SCHEMAS.BASE_ANALYSIS_SET) {
    fail(code, 'base analysis set schema is invalid');
  }
  const baseMembers = array(baseSet.members, code, 'base analysis members');
  const baseAgreementIds = [];
  const baseRecords = new Map();
  for (const member of baseMembers) {
    exactKeys(member, ['agreement_id', 'agreement_analysis_binding'], code,
      'base analysis member');
    const agreementId = string(member.agreement_id, code, 'base agreement ID');
    const binding = member.agreement_analysis_binding;
    const record = validateResolvedRecordBinding(
      binding, resolveBinding, `base AgreementAnalysis ${agreementId}`, code,
    );
    if (binding.schema_version !== AGREEMENT_ANALYSIS_V1_SCHEMA
        || binding.record_id_field !== 'agreement_analysis_id'
        || record.agreement_id !== agreementId) {
      fail(code, 'base analysis member does not bind its exact native M4 record');
    }
    const occurrenceIds = array(record.claims, code, 'native M4 claims').map(
      (claim) => string(claim?.claim_occurrence_id, code, 'native M4 claim occurrence ID'),
    );
    unique(occurrenceIds, code, 'native M4 claim occurrences');
    baseAgreementIds.push(agreementId);
    baseRecords.set(agreementId, { member, binding, record, occurrenceIds });
  }
  unique(baseAgreementIds, code, 'base agreement IDs');
  if (!same(baseAgreementIds, [...baseAgreementIds].sort())) {
    fail(code, 'base analysis members are not in canonical agreement order');
  }
  if (baseAgreementIds.length === GOVERNED_AGREEMENT_IDS.length
      && !same(baseAgreementIds, GOVERNED_AGREEMENT_IDS)) {
    fail(code, 'governed M4 set differs from the exact sealed-seven plus additive-three corpus');
  }
  const baseMember = baseRecords.get(analysis.agreement_id);
  if (!baseMember || !same(
    [...baseMember.occurrenceIds].sort((left, right) => left < right ? -1 : left > right ? 1 : 0),
    analysis.governed_input_occurrence_ids,
  )) {
    fail(code, 'V2 governed occurrences differ from the bound M4 identity set');
  }

  const contextSet = governance.inputRecords.get('CONTEXT_COMPILATION_SET');
  exactKeys(contextSet, ['schema_version', 'context_compilation_set_id', 'members'], code,
    'context compilation set');
  if (contextSet.schema_version !== INPUT_SCHEMAS.CONTEXT_COMPILATION_SET) {
    fail(code, 'context compilation set schema is invalid');
  }
  const contextMembers = array(contextSet.members, code, 'context compilation members');
  const contextAgreementIds = [];
  const contextRecords = new Map();
  for (const member of contextMembers) {
    exactKeys(member, ['agreement_id', 'context_compilation_binding'], code,
      'context compilation member');
    const agreementId = string(member.agreement_id, code, 'context agreement ID');
    const binding = member.context_compilation_binding;
    const record = validateResolvedRecordBinding(
      binding, resolveBinding, `native ContextCompilation ${agreementId}`, code,
    );
    if (binding.schema_version !== CONTEXT_COMPILATION_V1_SCHEMA
        || binding.record_id_field !== 'context_compilation_id') {
      fail(code, 'context member does not bind an exact native M3 record');
    }
    contextAgreementIds.push(agreementId);
    contextRecords.set(agreementId, { member, binding, record });
  }
  unique(contextAgreementIds, code, 'context agreement IDs');
  if (!same(contextAgreementIds, [...contextAgreementIds].sort())
      || !same(contextAgreementIds, baseAgreementIds)) {
    fail(code, 'M3 and M4 source sets do not have one exact sorted agreement inventory');
  }
  if (contextAgreementIds.length === GOVERNED_AGREEMENT_IDS.length
      && !same(contextAgreementIds, GOVERNED_AGREEMENT_IDS)) {
    fail(code, 'governed M3 set differs from the exact sealed-seven plus additive-three corpus');
  }
  for (const agreementId of baseAgreementIds) {
    const base = baseRecords.get(agreementId);
    const context = contextRecords.get(agreementId);
    const nativeContextBinding = base.record.context_compilation_binding;
    const nativeIndexBinding = base.record.agreement_index_binding;
    exactKeys(context.record.agreement_index_binding, [
      'agreement_index_id', 'agreement_index_sha256', 'canonical_text_sha256',
      'structural_policy_digest',
    ], code, 'native M3 agreement index binding');
    if (ADDITIVE_AGREEMENT_IDS.includes(agreementId)) {
      exactKeys(nativeContextBinding, ['context_compilation_id'], code,
        'additive M4 context compilation binding');
      exactKeys(nativeIndexBinding, ['agreement_index_id'], code,
        'additive M4 agreement index binding');
      if (nativeContextBinding.context_compilation_id !== context.binding.record_id
          || nativeIndexBinding.agreement_index_id
            !== context.record.agreement_index_binding.agreement_index_id) {
        fail(code, 'additive M4 record does not bind its paired native M3 and M2 identities');
      }
    } else {
      exactKeys(nativeContextBinding, [
        'agreement_id', 'agreement_index_id', 'byte_length', 'context_compilation_id',
        'path', 'schema_version', 'sha256',
      ], code, 'sealed M4 context compilation binding');
      exactKeys(nativeIndexBinding, [
        'agreement_index_id', 'agreement_index_sha256', 'canonical_text_sha256',
        'structural_policy_digest',
      ], code, 'sealed M4 agreement index binding');
      const expectedNativeBinding = {
        agreement_id: agreementId,
        agreement_index_id: context.record.agreement_index_binding.agreement_index_id,
        byte_length: context.binding.byte_length,
        context_compilation_id: context.binding.record_id,
        path: context.binding.path,
        schema_version: context.binding.schema_version,
        sha256: context.binding.sha256,
      };
      if (!same(nativeContextBinding, expectedNativeBinding)
          || !same(nativeIndexBinding, context.record.agreement_index_binding)) {
        fail(code, 'sealed M4 record does not bind its paired native M3 and M2 lineage');
      }
    }
  }
  const contextMember = contextRecords.get(analysis.agreement_id);
  if (!contextMember) fail(code, 'agreement is absent from the context compilation set');
  const contextEdges = projectNativeContextEdges(
    contextMember.record, analysis, resolveBinding,
  );
  addGovernedDurationContextEdges(analysis, contextEdges);

  const familyPacketSet = governance.inputRecords.get('APPROVED_FAMILY_PACKET_SET');
  const { packetRulingIds, decisionAuthorities } = validateFamilyPacketAuthority(
    familyPacketSet, governance, resolveBinding,
  );

  const structureSet = governance.inputRecords.get('APPROVED_STRUCTURE_DISPOSITION_SET');
  exactKeys(structureSet, [
    'schema_version', 'structure_disposition_set_id', 'state', 'members',
  ], code, 'structure disposition set');
  if (structureSet.schema_version !== INPUT_SCHEMAS.APPROVED_STRUCTURE_DISPOSITION_SET
      || structureSet.state !== 'BEN_APPROVED_STRUCTURE_DISPOSITION_SET') {
    fail(code, 'structure disposition set state is invalid');
  }
  const structureMemberRecords = array(
    structureSet.members, code, 'structure disposition members',
  );
  if (!same(structureMemberRecords.map((member) => member.structure_disposition_id),
    structureMemberRecords.map((member) => member.structure_disposition_id).slice().sort())) {
    fail(code, 'structure disposition members are not in canonical ID order');
  }
  const structureMembers = indexBy(
    structureMemberRecords, 'structure_disposition_id', code, 'structure disposition',
  );
  const structureOverlayEvidence = new Map();
  let item39OverlayCount = 0;
  for (const member of structureMembers.values()) {
    exactKeys(member, [
      'schema_version', 'structure_disposition_id', 'kind', 'reason_code',
      'policy_id', 'policy_version',
      'authority_class', 'approver', 'lawyer_ruling_id', 'scope',
      'inclusion_fixture_bindings', 'exclusion_fixture_bindings', 'match_test',
      'inline_list_overlay',
    ], code, 'structure disposition');
    if (member.schema_version !== INPUT_SCHEMAS.APPROVED_STRUCTURE_DISPOSITION_SET) {
      fail(code, 'structure disposition member schema is invalid');
    }
    const unsignedMember = { ...member };
    delete unsignedMember.schema_version;
    delete unsignedMember.structure_disposition_id;
    if (member.structure_disposition_id !== contentId(
      INPUT_SCHEMAS.APPROVED_STRUCTURE_DISPOSITION_SET, unsignedMember,
    )) fail(code, 'structure disposition member content identity is invalid');
    string(member.reason_code, code, 'structure reason code');
    string(member.policy_id, code, 'structure policy ID');
    if (!Number.isInteger(member.policy_version) || member.policy_version < 1) {
      fail(code, 'structure policy version is invalid');
    }
    if (!['TECHNICAL_STRUCTURE', 'SOURCE_ARTEFACT', 'LEGAL_TEXT_EXCLUSION',
      'NO_OUTPUT', 'BEN_AUTHORED_INLINE_LIST_OVERLAY'].includes(member.kind)) {
      fail(code, 'structure disposition kind is invalid');
    }
    if (!['DETERMINISTIC_TECHNICAL', 'BEN_LEGAL_RULING'].includes(member.authority_class)) {
      fail(code, 'structure authority class is invalid');
    }
    const requiresBen = member.kind === 'LEGAL_TEXT_EXCLUSION' || member.kind === 'NO_OUTPUT'
      || member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY';
    if (requiresBen && (member.authority_class !== 'BEN_LEGAL_RULING'
        || member.approver !== 'BEN_GOODCHILD'
        || typeof member.lawyer_ruling_id !== 'string'
        || member.lawyer_ruling_id.length === 0)) {
      fail(code, 'legal structure disposition lacks Ben authority');
    }
    if (requiresBen && member.kind !== 'BEN_AUTHORED_INLINE_LIST_OVERLAY'
        && !packetRulingIds.has(member.lawyer_ruling_id)) {
      fail(code, 'legal structure disposition ruling is absent from the family packet');
    }
    if (!requiresBen && member.authority_class === 'DETERMINISTIC_TECHNICAL'
        && (member.approver !== null || member.lawyer_ruling_id !== null)) {
      fail(code, 'technical structure disposition carries false legal authority');
    }
    exactKeys(member.scope, [
      'agreement_index_id', 'source_node_occurrence_id', 'start_byte', 'end_byte',
      'governed_input_occurrence_ids',
    ], code, 'structure disposition scope');
    assertHex(member.scope.agreement_index_id, 64, code, 'structure agreement index ID');
    string(member.scope.source_node_occurrence_id, code, 'structure node occurrence ID');
    if (!Number.isInteger(member.scope.start_byte) || !Number.isInteger(member.scope.end_byte)
        || member.scope.start_byte < 0 || member.scope.end_byte <= member.scope.start_byte) {
      fail(code, 'structure disposition byte range is invalid');
    }
    const occurrenceIds = array(member.scope.governed_input_occurrence_ids, code,
      'structure governed occurrences');
    occurrenceIds.forEach((value) => string(value, code, 'structure governed occurrence'));
    unique(occurrenceIds, code, 'structure governed occurrences');
    if (member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY') {
      item39OverlayCount += 1;
      exactKeys(member.inline_list_overlay, [
        'schema_version',
        'lawyer_ruling_id',
        'agreement_index_binding',
        'sealed_ambiguity_id',
        'sealed_ambiguity_type',
        'sealed_ambiguity_span',
        'inline_marker_disposition_id',
        'parent_node_occurrence_id',
        'parent_reference',
        'parent_scoping_rule',
        'marker_eligibility',
        'candidate_trees',
        'selected_candidate_tree_id',
        'technical_review',
        'ambiguous_repeat_fixture_bindings',
      ], code, 'authored-list overlay');
      const overlay = member.inline_list_overlay;
      exactKeys(overlay.agreement_index_binding, BINDING_KEYS, code,
        'overlay AgreementIndex binding');
      exactKeys(overlay.sealed_ambiguity_span, [
        'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
      ], code, 'overlay sealed ambiguity span');
      exactKeys(overlay.parent_scoping_rule, [
        'rule_id', 'rule_version', 'marker_identity', 'candidate_enumeration',
        'selection_rule',
      ], code, 'overlay parent-scoping rule');
      exactKeys(overlay.marker_eligibility, [
        'structural_candidate_disposition_ids',
        'excluded_glued_reference_disposition_ids',
      ], code, 'overlay marker eligibility');
      const expectedParentRule = {
        rule_id: 'PARENT_SCOPED_ORDERED_SIBLINGS',
        rule_version: 1,
        marker_identity: 'PARENT_SCOPE_PLUS_EXACT_MARKER_SPAN',
        candidate_enumeration:
          'ALL_MATERIAL_CONTINUATION_SAME_PARENT_RESTART_AND_IMMEDIATE_NESTING_READINGS_UNDER_PREORDER_AND_CONTIGUOUS_SOURCE_RULES',
        selection_rule: 'EXACTLY_ONE_PASSING_TREE_ELSE_REVIEW_ONLY',
      };
      const exactItem39Decision = decisionAuthorities.get(member.lawyer_ruling_id);
      const fixedIndexBinding = exactItem39Decision?.fixedMember?.agreement_index_binding;
      const overlayIndexWork0Binding = {
        path: overlay.agreement_index_binding.path,
        schema_version: overlay.agreement_index_binding.schema_version,
        record_id_field: overlay.agreement_index_binding.record_id_field,
        record_id: overlay.agreement_index_binding.record_id,
        byte_length: overlay.agreement_index_binding.byte_length,
        sha256: overlay.agreement_index_binding.sha256,
      };
      if (member.reason_code !== 'FALSE_M2_AMBIGUITY'
          || member.lawyer_ruling_id !== ITEM39_DECISION_ID
          || overlay.lawyer_ruling_id !== member.lawyer_ruling_id
          || !exactItem39Decision
          || exactItem39Decision.packetMember.sample_ordinal !== 39
          || exactItem39Decision.packetMember.ambiguity_id !== ITEM39_AMBIGUITY_ID
          || exactItem39Decision.packetMember.reviewer !== 'BEN_GOODCHILD'
          || !isObject(fixedIndexBinding)
          || !same(overlayIndexWork0Binding, fixedIndexBinding)
          || overlay.schema_version !== STRUCTURE_OVERLAY_SCHEMA
          || overlay.agreement_index_binding.schema_version !== AGREEMENT_INDEX_SCHEMA
          || overlay.agreement_index_binding.record_id_field !== 'agreement_index_id'
          || overlay.sealed_ambiguity_id !== ITEM39_AMBIGUITY_ID
          || overlay.sealed_ambiguity_type !== 'UNRESOLVED_INLINE_LIST'
          || !same(overlay.sealed_ambiguity_span, {
            coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
            start_byte: 229260,
            end_byte: 229525,
            text_sha256: ITEM39_AMBIGUITY_SHA256,
          })
          || overlay.inline_marker_disposition_id !== ITEM39_DISPOSITION_ID
          || overlay.parent_node_occurrence_id !== ITEM39_PARENT_NODE_ID
          || overlay.parent_reference !== '7.01(d)'
          || !same(overlay.parent_scoping_rule, expectedParentRule)
          || !same(overlay.marker_eligibility, {
            structural_candidate_disposition_ids: [
              ITEM39_DISPOSITION_ID,
              '6a5b77ebda120dc322edf5febfc44c03663e9c3a3dc92b55000a3a40e53f0c7d',
              '64c180da22ae7721b3e0e7cced6786ba824bc632a42dccf53330b1cbc4531b2d',
            ],
            excluded_glued_reference_disposition_ids: [
              'c346c4bf8df8e757eeaf8ee241d485c0eb60aec8c19a4da54ee48dcf7ef06afd',
              '8e5b36c152615105d5ba0e3f8c6ef8887e3f4f5a7e3525e9d73cb5f2169c7b54',
            ],
          })
          || member.scope.agreement_index_id !== overlay.agreement_index_binding.record_id
          || member.scope.source_node_occurrence_id !== ITEM39_PARENT_NODE_ID
          || member.scope.start_byte !== overlay.sealed_ambiguity_span.start_byte
          || member.scope.end_byte !== overlay.sealed_ambiguity_span.end_byte) {
        fail(code, 'authored-list overlay is not the exact sealed item-39 ruling');
      }
      const overlayIndex = validateResolvedRecordBinding(
        overlay.agreement_index_binding, resolveBinding, 'overlay AgreementIndex', code,
      );
      const candidateTrees = array(overlay.candidate_trees, code,
        'overlay candidate trees');
      if (candidateTrees.length < 2) fail(code, 'overlay does not materialise every candidate tree');
      const candidateTreeIds = candidateTrees.map((tree) =>
        validateStructureCandidateTreeShape(tree, code));
      unique(candidateTreeIds, code, 'overlay candidate-tree IDs');
      const claimedPassingTrees = candidateTrees.filter(
        (tree) => tree.tree_state === 'PASS_PARENT_SCOPING',
      );
      if (claimedPassingTrees.length !== 1
          || overlay.selected_candidate_tree_id !== claimedPassingTrees[0].candidate_tree_id) {
        fail(code, 'overlay does not claim one unique parent-scoped candidate tree');
      }
      exactKeys(overlay.technical_review, ['state', 'check_ids', 'effects'], code,
        'overlay technical review');
      exactKeys(overlay.technical_review.effects, [
        'files_written', 'model_calls', 'network_reads', 'network_writes',
        'database_writes', 'product_writes',
      ], code, 'overlay technical-review effects');
      if (overlay.technical_review.state !== 'PASS'
          || !same(overlay.technical_review.check_ids, [
            'SEALED_M2_UNCHANGED',
            'ALL_CANDIDATE_TREES_MATERIALISED',
            'PARENT_SCOPING_RECOMPUTED',
            'UNIQUE_SELECTION',
            'AMBIGUOUS_REPEAT_NEGATIVE',
          ])
          || Object.values(overlay.technical_review.effects).some((value) => value !== 0)) {
        fail(code, 'overlay technical review is incomplete or records an effect');
      }
      const repeatBindings = array(overlay.ambiguous_repeat_fixture_bindings, code,
        'overlay ambiguous-repeat fixtures');
      if (repeatBindings.length !== 1
          || !same(repeatBindings[0], AMBIGUOUS_REPEAT_MEMBER_BINDING)) {
        fail(code, 'overlay lacks the exact C3 ambiguous-repeat negative route');
      }
      const repeatFixtures = repeatBindings.map((binding) => {
        return resolvePackageMemberBinding(
          binding, governance.packageRegistry, 'structure_fixture_members',
          'overlay ambiguous-repeat fixture', code,
        );
      });
      for (const fixture of repeatFixtures) {
        validateAmbiguousRepeatOverlayFixture(
          fixture,
          resolveBinding,
          expectedParentRule,
          overlay.sealed_ambiguity_span,
          code,
        );
      }
      structureOverlayEvidence.set(member.structure_disposition_id, {
        ...validateGlobalItem39OverlayEvidence(member, overlayIndex, code),
        repeatFixtures,
      });
    } else if (member.inline_list_overlay !== null) {
      fail(code, 'non-overlay structure disposition carries an inline-list overlay');
    }
    validateMatchTestShape(member.match_test, code,
      `structure disposition ${member.structure_disposition_id} match test`);
    const structureFixtureIds = {
      inclusion_fixture_bindings: new Set(),
      exclusion_fixture_bindings: new Set(),
    };
    for (const field of ['inclusion_fixture_bindings', 'exclusion_fixture_bindings']) {
      const bindings = array(member[field], code, `structure ${field}`);
      if (bindings.length === 0) fail(code, `structure ${field} is empty`);
      for (const binding of bindings) {
        const fixture = resolvePackageMemberBinding(
          binding, governance.packageRegistry, 'match_fixtures',
          `structure disposition ${field}`, code,
        );
        const context = validateFixtureRecord(fixture, {
          fixture_id: fixture.fixture_id,
          input_occurrence_id: fixture.input_occurrence_id,
        });
        if (structureFixtureIds[field].has(fixture.fixture_id)) {
          fail(code, `structure ${field} repeats a fixture`);
        }
        structureFixtureIds[field].add(fixture.fixture_id);
        const fixtureIsInScope = occurrenceIds.includes(fixture.input_occurrence_id);
        if (fixtureIsInScope !== (field === 'inclusion_fixture_bindings')) {
          fail(code, `structure ${field} has the wrong governed-occurrence membership`);
        }
        const evaluated = evaluateMatchTest(member.match_test, context);
        const expectedMatch = field === 'inclusion_fixture_bindings';
        if (evaluated.matched !== expectedMatch) {
          fail(code, `structure disposition ${field} does not prove its match boundary`);
        }
      }
    }
    if ([...structureFixtureIds.inclusion_fixture_bindings].some(
      (fixtureId) => structureFixtureIds.exclusion_fixture_bindings.has(fixtureId),
    )) fail(code, 'structure inclusion and exclusion fixtures overlap');
  }
  if (item39OverlayCount !== 1 || structureOverlayEvidence.size !== 1) {
    fail(code, 'approved structure set must contain exactly one validated item-39 overlay');
  }
  return {
    baseMember,
    contextEdges,
    familyPacketSet,
    packetRulingIds,
    decisionAuthorities,
    structureMembers,
    structureOverlayEvidence,
    packageRegistry: governance.packageRegistry,
  };
}

function validateMatchTestShape(test, code, label, leafIds = new Set()) {
  object(test, code, label);
  if (['ALL', 'ANY', 'NOT'].includes(test.kind)) {
    exactKeys(test, ['kind', 'children'], code, label);
    const children = array(test.children, code, `${label} children`);
    if ((test.kind === 'NOT' && children.length !== 1)
        || (test.kind !== 'NOT' && children.length < 2)) {
      fail(code, `${label} has invalid predicate arity`);
    }
    children.forEach((child, index) => validateMatchTestShape(
      child, code, `${label}.${index}`, leafIds,
    ));
    return leafIds;
  }
  if (['SOURCE_TOKEN_SEQUENCE', 'SOURCE_TOKEN_ANY', 'SOURCE_TOKEN_ALL'].includes(test.kind)) {
    exactKeys(test, ['kind', 'leaf_id', 'tokens', 'scope'], code, label);
    string(test.leaf_id, code, `${label}.leaf_id`);
    const tokens = array(test.tokens, code, `${label}.tokens`);
    if (tokens.length === 0) fail(code, `${label} has no source test`);
    tokens.forEach((token) => string(token, code, `${label}.token`));
    if (test.kind !== 'SOURCE_TOKEN_SEQUENCE') unique(tokens, code, `${label}.tokens`);
    if (!['EFFECT_SOURCE_SPANS', 'AUTHORED_UNIT_SOURCE_CLOSURE'].includes(test.scope)) {
      fail(code, `${label} has an invalid source scope`);
    }
    if (leafIds.has(test.leaf_id)) fail(code, `${label} repeats a leaf ID`);
    leafIds.add(test.leaf_id);
    return leafIds;
  }
  if (test.kind === 'INDEX_NODE_KIND') {
    exactKeys(test, ['kind', 'leaf_id', 'node_kind', 'ancestor_node_kinds'], code, label);
    string(test.leaf_id, code, `${label}.leaf_id`);
    string(test.node_kind, code, `${label}.node_kind`);
    array(test.ancestor_node_kinds, code, `${label}.ancestor_node_kinds`)
      .forEach((kind) => string(kind, code, `${label}.ancestor node kind`));
    if (leafIds.has(test.leaf_id)) fail(code, `${label} repeats a leaf ID`);
    leafIds.add(test.leaf_id);
    return leafIds;
  }
  if (test.kind === 'CONTEXT_EDGE') {
    exactKeys(test, ['kind', 'leaf_id', 'edge_type', 'target_id'], code, label);
    string(test.leaf_id, code, `${label}.leaf_id`);
    string(test.edge_type, code, `${label}.edge_type`);
    if (test.target_id !== null) string(test.target_id, code, `${label}.target_id`);
    if (leafIds.has(test.leaf_id)) fail(code, `${label} repeats a leaf ID`);
    leafIds.add(test.leaf_id);
    return leafIds;
  }
  if (test.kind === 'TYPED_FACT_EQUALS') {
    exactKeys(test, ['kind', 'leaf_id', 'field_key', 'value_type', 'typed_value'], code, label);
    string(test.leaf_id, code, `${label}.leaf_id`);
    string(test.field_key, code, `${label}.field_key`);
    if (!FACT_VALUE_TYPES.includes(test.value_type)) fail(code, `${label} value type is invalid`);
    validateTypedValue({
      fact_id: test.leaf_id,
      atomicity: 'ATOMIC_TYPED_VALUE',
      value_type: test.value_type,
      typed_value: test.typed_value,
    });
    if (leafIds.has(test.leaf_id)) fail(code, `${label} repeats a leaf ID`);
    leafIds.add(test.leaf_id);
    return leafIds;
  }
  fail(code, `${label} uses an unsupported match-test atom`);
}

function canonicalStringSet(values, code, label) {
  const members = array(values, code, label);
  members.forEach((member) => string(member, code, `${label} member`));
  if (!same(members, [...new Set(members)].sort())) {
    fail(code, `${label} is not a canonical set`);
  }
  return members;
}

function deriveFixtureDimensionKeys(profile, fixture) {
  const code = 'M7_V2_PROFILE_GATE';
  const requirements = new Map([
    ...array(profile.required_fields, code, 'profile required fields'),
    ...array(profile.optional_fields, code, 'profile optional fields'),
  ].map((requirement) => [requirement.field_key, requirement]));
  const allowedDependencyTypes = new Set(array(
    profile.allowed_dependency_types, code, 'profile allowed dependency types',
  ).map((entry) => entry.dependency_type));
  const facts = array(fixture.typed_facts, code, 'dimension fixture typed facts');
  const factsByField = new Map();
  const derivedMaterialFields = [];
  const derivedDependencyFields = [];
  for (const fact of facts) {
    const requirement = requirements.get(fact.field_key);
    if (!requirement || factsByField.has(fact.field_key)
        || fact.materiality !== requirement.materiality) {
      fail(code, 'dimension fixture fact is duplicate or differs from its profile field');
    }
    factsByField.set(fact.field_key, fact);
    if (fact.materiality === 'MATERIAL') derivedMaterialFields.push(fact.field_key);
    if (fact.dependency_types.length > 0) {
      if (fact.dependency_types.some((dependencyType) => (
        !allowedDependencyTypes.has(dependencyType)
      ))) fail(code, 'dimension fixture uses a dependency type outside its profile');
      derivedDependencyFields.push(fact.field_key);
    }
  }
  const materialFields = canonicalStringSet(
    fixture.expected_material_field_keys, code, 'fixture expected material fields',
  );
  const dependencyFields = canonicalStringSet(
    fixture.expected_dependency_backed_field_keys,
    code,
    'fixture expected dependency-backed fields',
  );
  if (!same(materialFields, [...derivedMaterialFields].sort())
      || !same(dependencyFields, [...derivedDependencyFields].sort())) {
    fail(code, 'dimension fixture field expectations differ from its typed facts');
  }

  const triggeredConditions = array(
    profile.conditional_requirements, code, 'profile conditional requirements',
  ).filter((condition) => {
    const fact = factsByField.get(condition.predicate.field_key);
    return fact
      && fact.value_type === condition.predicate.value_type
      && same(fact.typed_value, condition.predicate.typed_value);
  });
  const conditionalIds = canonicalStringSet(
    fixture.expected_conditional_requirement_ids,
    code,
    'fixture expected conditional requirements',
  );
  if (!same(conditionalIds, triggeredConditions.map(
    (condition) => condition.conditional_requirement_id,
  ).sort())) {
    fail(code, 'dimension fixture conditional expectations are not derived from its facts');
  }

  const expectedChildIds = array(
    profile.child_rule_profiles, code, 'profile child-rule requirements',
  ).map((requirement) => requirement.child_rule_requirement_id).sort();
  const childIds = canonicalStringSet(
    fixture.expected_child_rule_requirement_ids,
    code,
    'fixture expected child-rule requirements',
  );
  if (!same(childIds, expectedChildIds)) {
    fail(code, 'dimension fixture child-rule expectations differ from its profile');
  }
  const expectedExcludedKeys = array(
    profile.excluded_or_delegated_dimensions, code, 'profile dimension dispositions',
  ).filter((dimension) => dimension.disposition === 'EXCLUDED')
    .map((dimension) => dimension.dimension_key).sort();
  const expectedDelegatedKeys = profile.excluded_or_delegated_dimensions
    .filter((dimension) => dimension.disposition === 'DELEGATED')
    .map((dimension) => dimension.dimension_key).sort();
  const excludedKeys = canonicalStringSet(
    fixture.expected_excluded_dimension_keys,
    code,
    'fixture expected excluded dimensions',
  );
  const delegatedKeys = canonicalStringSet(
    fixture.expected_delegated_dimension_keys,
    code,
    'fixture expected delegated dimensions',
  );
  if (!same(excludedKeys, expectedExcludedKeys)
      || !same(delegatedKeys, expectedDelegatedKeys)) {
    fail(code, 'dimension fixture dispositions differ from its approved profile');
  }

  return [...new Set([
    ...materialFields,
    ...dependencyFields,
    ...triggeredConditions.flatMap((condition) => [
      condition.predicate.field_key,
      ...condition.required_field_keys,
    ]),
    ...childIds.map((requirementId) => `CHILD_RULE:${requirementId}`),
    ...excludedKeys,
    ...delegatedKeys,
  ])].sort();
}

function hasApprovedProfileAuthority(profile, rulingId, semanticInputs) {
  const familyPackage = semanticInputs.packageRegistry.byFamily.get(
    profile.family_key,
  )?.record;
  return familyPackage !== undefined
    && profile.legal_authority_ids.includes(rulingId)
    && familyPackage.legal_decisions.includes(rulingId)
    && (semanticInputs.packetRulingIds.has(rulingId)
      || rulingId === familyPackage.family_approval.ben_approval_id);
}

function deepFreezeTransient(value) {
  if (!isObject(value) && !Array.isArray(value)) return value;
  for (const member of Object.values(value)) deepFreezeTransient(member);
  return Object.freeze(value);
}

function validateWork3FamilyPackageAuthority(work3Authority, code) {
  object(work3Authority, code, 'Work3 entry-correction authority');
  const authoritySchema =
    'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1';
  const unsignedAuthority = { ...work3Authority };
  delete unsignedAuthority.correction_authority_id;
  if (work3Authority.schema_version !== authoritySchema
      || work3Authority.correction_authority_id
        !== WORK3_ENTRY_CORRECTION_AUTHORITY_ID
      || work3Authority.correction_authority_id !== contentId(
        authoritySchema, unsignedAuthority,
      )) {
    fail(code, 'Work3 entry-correction authority identity is invalid');
  }
  const scope = object(
    work3Authority.work3_scope_contract, code, 'Work3 scope contract',
  );
  const packageContract = object(
    scope.family_profile_package_contract, code, 'family package contract',
  );
  const profileSetContract = object(
    scope.approved_family_profile_set_contract, code, 'approved profile-set contract',
  );
  const memberBindingContract = object(
    scope.package_member_binding_contract, code, 'package-member binding contract',
  );
  const familyPacketContract = object(
    scope.family_packet_set_source_contract, code, 'family-packet source contract',
  );
  const structureContract = object(
    scope.structure_disposition_set_contract, code, 'structure-set contract',
  );
  const familyKeys = array(
    profileSetContract.family_key_order, code, 'authority family-key order',
  );
  familyKeys.forEach((familyKey) => string(familyKey, code, 'authority family key'));
  if (familyKeys.length !== 25
      || !same(familyKeys, [...new Set(familyKeys)].sort())
      || !same(scope.family_keys, familyKeys)) {
    fail(code, 'Work3 authority does not own one canonical order of 25 families');
  }
  const pathMapping = array(
    profileSetContract.package_path_mapping, code, 'authority package-path mapping',
  );
  if (pathMapping.length !== familyKeys.length) {
    fail(code, 'Work3 authority package-path mapping is incomplete');
  }
  const packagePaths = pathMapping.map((entry, index) => {
    exactKeys(entry, ['family_key', 'path'], code, 'authority package-path entry');
    if (entry.family_key !== familyKeys[index]) {
      fail(code, 'Work3 authority package paths are not in family order');
    }
    return string(entry.path, code, 'authority package path');
  });
  unique(packagePaths, code, 'authority package paths');
  if (!same([...scope.family_profile_package_paths].sort(), [...packagePaths].sort())
      || !same(scope.family_profile_package_paths_by_family_key, pathMapping)) {
    fail(code, 'Work3 authority package paths disagree');
  }
  if (packageContract.schema_version !== FAMILY_PROFILE_PACKAGE_SCHEMA
      || packageContract.family_approval_contract?.schema_version
        !== FAMILY_PROFILE_PACKAGE_APPROVAL_SCHEMA
      || profileSetContract.schema_version
        !== INPUT_SCHEMAS.APPROVED_FAMILY_PROFILE_SET
      || memberBindingContract.schema_version !== PACKAGE_MEMBER_BINDING_SCHEMA
      || structureContract.schema_version
        !== INPUT_SCHEMAS.APPROVED_STRUCTURE_DISPOSITION_SET) {
    fail(code, 'Work3 authority uses an unsupported frozen schema');
  }
  return {
    scope,
    packageContract,
    profileSetContract,
    memberBindingContract,
    familyPacketContract,
    structureContract,
    familyKeys,
    packagePaths,
  };
}

function applyDnoItem42PackageSuccessorAuthority(
  authority, work3Authority, successorAuthority, familyPackageSources, code,
) {
  if (successorAuthority === null) return authority;
  object(successorAuthority, code, 'D&O item-42 package successor authority');
  exactKeys(successorAuthority, [
    'schema_version',
    'item42_registration_successor_authority_id',
    'applied_on',
    'authority_state',
    'exact_changed_existing_ordinals',
    'exact_new_profile_keys',
    'family_package_seal_receipt_binding',
    'predecessor_package_binding',
    'profile_count',
    'production_activation_permitted',
    'ruling_binding',
    'ruling_id',
    'ruling_option_id',
    'stamp_clearance_permitted',
    'successor_disposition_binding',
    'successor_package_binding',
    'successor_policy_pin_binding',
    'work3_entry_correction_authority_binding',
    'zero_effect_boundary',
  ], code, 'D&O item-42 package successor authority');
  const schema = 'N1_DNO_ITEM42_REGISTRATION_SUCCESSOR_AUTHORITY/V1';
  const unsigned = { ...successorAuthority };
  delete unsigned.item42_registration_successor_authority_id;
  if (successorAuthority.schema_version !== schema
      || successorAuthority.item42_registration_successor_authority_id
        !== contentId(schema, unsigned)
      || successorAuthority.applied_on !== '2026-09-01'
      || successorAuthority.authority_state !== 'REGISTERED_ZERO_PRODUCT_WRITE_EFFECT'
      || successorAuthority.ruling_id !== DNO_ITEM42_RULING_ID
      || successorAuthority.ruling_option_id !== 'approve-child-profiles'
      || successorAuthority.profile_count !== 33
      || successorAuthority.production_activation_permitted !== false
      || successorAuthority.stamp_clearance_permitted !== false
      || !same(successorAuthority.exact_changed_existing_ordinals,
        DNO_ITEM42_CHANGED_ORDINALS)
      || !same(successorAuthority.exact_new_profile_keys,
        ITEM42_SHARED_SOURCE_PROFILE_KEYS)) {
    fail(code, 'D&O item-42 package successor authority identity or ruling scope is invalid');
  }
  if (!same(successorAuthority.ruling_binding, {
    byte_length: 7654,
    path: DNO_ITEM42_RULING_PATH,
    schema_version: 'N1_BEN_LEGAL_RULINGS_RECEIPT/V1',
    sha256: '30b0b0e628a23f20fb2dc3f91e43b3d1524b04e90d58571c337270cd00167a34',
  }) || !same(successorAuthority.predecessor_package_binding,
    DNO_ITEM42_PREDECESSOR_PACKAGE_BINDING)) {
    fail(code, 'D&O item-42 successor does not bind the exact ruling and predecessor seal');
  }
  const work3Bytes = Buffer.from(`${canonicalJson(work3Authority)}\n`, 'utf8');
  const work3Binding = {
    byte_length: work3Bytes.length,
    git_blob_oid: gitBlobOid(work3Bytes),
    path: `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work3-entry-correction-authority.json`,
    record_id: work3Authority.correction_authority_id,
    record_id_field: 'correction_authority_id',
    schema_version: work3Authority.schema_version,
    sha256: sha256Hex(work3Bytes),
  };
  if (!same(successorAuthority.work3_entry_correction_authority_binding, work3Binding)) {
    fail(code, 'D&O item-42 successor does not bind the exact Work3 authority');
  }
  const successorBinding = successorAuthority.successor_package_binding;
  exactKeys(successorBinding, BINDING_KEYS, code, 'D&O item-42 successor package binding');
  if (successorBinding.path !== DNO_ITEM42_SUCCESSOR_PACKAGE_PATH
      || successorBinding.schema_version !== FAMILY_PROFILE_PACKAGE_SCHEMA
      || successorBinding.record_id_field !== 'family_profile_package_id') {
    fail(code, 'D&O item-42 successor package path or schema is invalid');
  }
  const dnoIndex = authority.familyKeys.indexOf('DNO_INDEMNIFICATION');
  const suppliedDnoSource = familyPackageSources[dnoIndex];
  if (!suppliedDnoSource || !same(suppliedDnoSource.binding, successorBinding)
      || suppliedDnoSource.record?.family_key !== 'DNO_INDEMNIFICATION'
      || suppliedDnoSource.record?.profiles?.length !== successorAuthority.profile_count
      || suppliedDnoSource.record?.dimension_evidence?.length
        !== successorAuthority.profile_count) {
    fail(code, 'D&O item-42 successor package bytes do not match its authority');
  }
  const expectedBindings = [
    [successorAuthority.family_package_seal_receipt_binding,
      DNO_ITEM42_SUCCESSOR_SEAL_RECEIPT_BINDING],
    [successorAuthority.successor_disposition_binding,
      DNO_ITEM42_SUCCESSOR_DISPOSITION_BINDING],
    [successorAuthority.successor_policy_pin_binding,
      DNO_ITEM42_SUCCESSOR_POLICY_BINDING],
  ];
  for (const [binding, expectedBinding] of expectedBindings) {
    exactKeys(binding, BINDING_KEYS, code, 'D&O item-42 successor-chain binding');
    if (!same(binding, expectedBinding)) {
      fail(code, 'D&O item-42 successor-chain binding is not the approved record');
    }
  }
  if (!same(successorAuthority.zero_effect_boundary, {
    database_write_count: 0,
    product_write_count: 0,
    serving_change_count: 0,
  })) {
    fail(code, 'D&O item-42 successor exceeds its zero-effect boundary');
  }
  const packagePaths = [...authority.packagePaths];
  packagePaths[dnoIndex] = successorBinding.path;
  return { ...authority, packagePaths };
}

function validateSingleFamilyPackageInventory(input) {
  const code = 'M7_V2_PROFILE_GATE';
  exactKeys(input, [
    'work3Authority',
    'familyKey',
    'profileSetVersion',
    'benApprovalId',
    'legalDecisions',
    'members',
    'memberInventory',
    'inventoryFingerprint',
  ], code, 'single-family inventory validation input');
  const authority = validateWork3FamilyPackageAuthority(input.work3Authority, code);
  const familyKey = string(input.familyKey, code, 'single-family inventory family key');
  if (!authority.familyKeys.includes(familyKey)) {
    fail(code, 'single-family inventory uses an unknown family');
  }
  const result = validateFamilyPackageInventoryCore({
    familyKey,
    profileSetVersion: input.profileSetVersion,
    benApprovalId: input.benApprovalId,
    legalDecisions: input.legalDecisions,
    members: input.members,
  }, code, authority.packageContract);
  const inventoryKeys = array(
    authority.packageContract.family_approval_contract
      ?.approved_inventory_digest_payload_exact_keys,
    code,
    'single-family inventory keys',
  );
  exactKeys(input.memberInventory, inventoryKeys, code, 'single-family member inventory');
  assertHex(input.inventoryFingerprint, 64, code, 'single-family inventory fingerprint');
  if (!same(input.memberInventory, result.memberInventory)
      || input.inventoryFingerprint !== result.inventoryFingerprint) {
    fail(code, 'single-family member inventory or fingerprint is false');
  }
  return deepFreezeTransient({
    status: 'FAMILY_MEMBER_IDENTITY_PASS_SEMANTIC_AND_GLOBAL_SET_PENDING',
    family_key: familyKey,
    profile_set_version: input.profileSetVersion,
    ben_approval_id: input.benApprovalId,
    member_inventory: result.memberInventory,
    inventory_fingerprint: result.inventoryFingerprint,
  });
}

function memberContractsFromAuthority(authority, code) {
  const declaredFields = array(
    authority.memberBindingContract.member_field_enum,
    code,
    'authority package-member fields',
  );
  const expectedFields = Object.keys(PACKAGE_MEMBER_FIELDS);
  if (!same([...declaredFields].sort(), [...expectedFields].sort())) {
    fail(code, 'Work3 authority package-member fields are incomplete');
  }
  const schemas = object(
    authority.memberBindingContract.member_schema_and_id_field_by_member_field,
    code,
    'authority package-member schemas',
  );
  const contracts = {};
  for (const field of expectedFields) {
    const declared = object(schemas[field], code, `authority ${field} member contract`);
    const packageDeclared = object(
      authority.packageContract.member_contracts?.[field],
      code,
      `authority package ${field} member contract`,
    );
    const allowed = field === 'structure_fixture_members'
      ? array(declared.allowed_schemas, code, 'authority structure-member schemas')[0]
      : declared;
    const packageAllowed = field === 'structure_fixture_members'
      ? array(packageDeclared.allowed_schemas, code, 'package structure-member schemas')[0]
      : packageDeclared;
    object(allowed, code, `authority ${field} schema contract`);
    object(packageAllowed, code, `package ${field} schema contract`);
    if (allowed.schema_version !== packageAllowed.schema_version
        || allowed.record_id_field !== packageAllowed.record_id_field
        || allowed.schema_version !== PACKAGE_MEMBER_FIELDS[field].schema
        || allowed.record_id_field !== PACKAGE_MEMBER_FIELDS[field].idField) {
      fail(code, `Work3 authority ${field} member contract disagrees`);
    }
    contracts[field] = Object.freeze({
      schema: allowed.schema_version,
      idField: allowed.record_id_field,
      singleton: declared.container === 'SINGLETON',
    });
  }
  return Object.freeze(contracts);
}

function providedSourceRegistry(sources, label, code, canonicalRecords = false) {
  const entries = array(sources, code, label);
  const byPath = new Map();
  const byRecordId = new Map();
  for (const source of entries) {
    exactKeys(source, ['binding', 'bytes', 'record'], code, `${label} entry`);
    exactKeys(source.binding, BINDING_KEYS, code, `${label} binding`);
    object(source.record, code, `${label} record`);
    if (byPath.has(source.binding.path)) fail(code, `${label} repeats a path`);
    const selectedBytes = bytes(source.bytes, code, `${label} bytes`);
    if (selectedBytes.length !== source.binding.byte_length
        || sha256Hex(selectedBytes) !== source.binding.sha256
        || gitBlobOid(selectedBytes) !== source.binding.git_blob_oid) {
      fail(code, `${label} record bytes differ from their supplied binding`);
    }
    let parsed;
    try {
      parsed = JSON.parse(selectedBytes.toString('utf8'));
    } catch {
      fail(code, `${label} record bytes are not JSON`);
    }
    if (!same(parsed, source.record)
        || source.record.schema_version !== source.binding.schema_version
        || source.record[source.binding.record_id_field] !== source.binding.record_id) {
      fail(code, `${label} record differs from its bound bytes or envelope`);
    }
    if (canonicalRecords) {
      validateCanonicalRecordBytes(selectedBytes, source.binding, code, label);
    }
    byPath.set(source.binding.path, { ...source, selectedBytes });
    if (source.binding.record_id !== null) {
      if (byRecordId.has(source.binding.record_id)) {
        fail(code, `${label} repeats a record ID`);
      }
      byRecordId.set(source.binding.record_id, { ...source, selectedBytes });
    }
  }
  const usedPaths = new Set();
  const resolveBinding = (binding) => {
    const source = byPath.get(binding.path);
    if (!source || !same(source.binding, binding)) {
      throw new Error('supplied source binding does not resolve exactly');
    }
    usedPaths.add(binding.path);
    return source.selectedBytes;
  };
  return { entries, byPath, byRecordId, usedPaths, resolveBinding };
}

function containsExactNestedValue(value, target) {
  if ((!isObject(value) && !Array.isArray(value)) || value === null) return false;
  if (same(value, target)) return true;
  return Object.values(value).some((member) => containsExactNestedValue(member, target));
}

function buildAuthorityFamilyPackageRegistry(
  profileSet, packageSources, authority, code,
) {
  exactKeys(profileSet, authority.profileSetContract.exact_keys,
    code, 'approved family profile set');
  const unsignedProfileSet = { ...profileSet };
  delete unsignedProfileSet.family_profile_set_id;
  if (profileSet.schema_version !== authority.profileSetContract.schema_version
      || profileSet.state !== authority.profileSetContract.state
      || profileSet.family_profile_set_id !== contentId(
        authority.profileSetContract.schema_version, unsignedProfileSet,
      )) {
    fail(code, 'approved family profile set identity or state is invalid');
  }
  const bindings = array(
    profileSet.family_profile_package_bindings,
    code,
    'approved family package bindings',
  );
  const sources = providedSourceRegistry(
    packageSources, 'family package sources', code, true,
  );
  if (bindings.length !== authority.familyKeys.length
      || sources.entries.length !== authority.familyKeys.length) {
    fail(code, 'approved profile set does not provide exactly 25 family packages');
  }
  const memberContracts = memberContractsFromAuthority(authority, code);
  const byPath = new Map();
  const byFamily = new Map();
  const approvalIds = [];
  const profileSetVersions = new Set();
  for (let index = 0; index < authority.familyKeys.length; index += 1) {
    const familyKey = authority.familyKeys[index];
    const binding = bindings[index];
    const source = sources.entries[index];
    exactKeys(binding, BINDING_KEYS, code, `family package binding ${familyKey}`);
    if (!same(binding, source.binding)
        || binding.path !== authority.packagePaths[index]
        || binding.schema_version !== authority.packageContract.schema_version
        || binding.record_id_field !== authority.packageContract.record_id_field) {
      fail(code, 'family package bindings differ from the Work3 authority');
    }
    const record = validateResolvedRecordBinding(
      binding, sources.resolveBinding, `family package ${familyKey}`, code,
    );
    if (!same(record, source.record)) {
      fail(code, `family package ${familyKey} supplied record is not exact`);
    }
    validateFamilyPackageRecord(record, familyKey, code, authority.packageContract);
    const nestedPackage = { ...record };
    delete nestedPackage.family_profile_package_id;
    if (containsExactNestedValue(nestedPackage, binding)
        || [binding.record_id, binding.sha256, binding.git_blob_oid].some(
          (forbidden) => JSON.stringify(nestedPackage).includes(forbidden),
        )) {
      fail(code, `family package ${familyKey} contains its own outer binding`);
    }
    byPath.set(binding.path, { binding, record, familyKey });
    byFamily.set(familyKey, { binding, record });
    approvalIds.push(record.family_approval.ben_approval_id);
    profileSetVersions.add(record.profile_set_version);
  }
  unique(approvalIds, code, 'family package Ben approval IDs');
  if (approvalIds.some((approvalId) => typeof approvalId !== 'string'
      || approvalId.length === 0) || profileSetVersions.size !== 1) {
    fail(code, 'family package approvals or profile-set versions are not globally closed');
  }
  return {
    bindings,
    byPath,
    byFamily,
    memberContracts,
    profileSetVersion: [...profileSetVersions][0],
  };
}

function validateStructureSetForFamilyPackages(
  structureSet, packageRegistry, packetAuthority, nativeSources, authority, code,
) {
  exactKeys(structureSet, authority.structureContract.exact_keys,
    code, 'approved structure disposition set');
  const unsignedSet = { ...structureSet };
  delete unsignedSet.structure_disposition_set_id;
  if (structureSet.schema_version !== authority.structureContract.schema_version
      || structureSet.state !== authority.structureContract.state
      || structureSet.structure_disposition_set_id !== contentId(
        authority.structureContract.schema_version, unsignedSet,
      )) {
    fail(code, 'approved structure disposition set identity or state is invalid');
  }
  const records = array(structureSet.members, code, 'structure disposition members');
  if (!same(records.map((member) => member.structure_disposition_id),
    records.map((member) => member.structure_disposition_id).slice().sort())) {
    fail(code, 'structure disposition members are not in canonical order');
  }
  const members = indexBy(
    records, 'structure_disposition_id', code, 'structure disposition',
  );
  const item39Contract = authority.packageContract
    .single_global_item39_overlay_fixture_contract;
  const expectedRepeatBinding = authority.structureContract
    .item39_overlay_fixture_binding_contract?.exact_binding;
  if (!same(expectedRepeatBinding,
    item39Contract?.ambiguous_repeat_fixture_member_binding)) {
    fail(code, 'Work3 authority contains two different Item 39 package bindings');
  }
  let item39Count = 0;
  for (const member of members.values()) {
    exactKeys(member, authority.structureContract.member_exact_keys,
      code, 'structure disposition');
    const unsignedMember = { ...member };
    delete unsignedMember.schema_version;
    delete unsignedMember.structure_disposition_id;
    if (member.schema_version !== authority.structureContract.schema_version
        || member.structure_disposition_id !== contentId(
          authority.structureContract.schema_version, unsignedMember,
        )) {
      fail(code, 'structure disposition content identity is invalid');
    }
    validateMatchTestShape(member.match_test, code,
      `structure disposition ${member.structure_disposition_id} match test`);
    const source = nativeSources.byRecordId.get(member.scope?.agreement_index_id);
    if (!source) fail(code, 'structure disposition has no exact native source');
    validateResolvedRecordBinding(
      source.binding, nativeSources.resolveBinding,
      'structure disposition native source', code,
    );
    const occurrenceIds = array(
      member.scope?.governed_input_occurrence_ids,
      code,
      'structure governed occurrences',
    );
    const fixtureIds = new Map([
      ['inclusion_fixture_bindings', new Set()],
      ['exclusion_fixture_bindings', new Set()],
    ]);
    for (const field of fixtureIds.keys()) {
      const bindings = array(member[field], code, `structure ${field}`);
      if (bindings.length === 0) fail(code, `structure ${field} is empty`);
      for (const binding of bindings) {
        const fixture = resolvePackageMemberBinding(
          binding, packageRegistry, 'match_fixtures', `structure ${field}`, code,
        );
        const context = validateFixtureRecord(fixture, {
          fixture_id: fixture.fixture_id,
          input_occurrence_id: fixture.input_occurrence_id,
        }, code);
        if (fixtureIds.get(field).has(fixture.match_fixture_id)) {
          fail(code, `structure ${field} repeats a fixture`);
        }
        fixtureIds.get(field).add(fixture.match_fixture_id);
        const expectedMatch = field === 'inclusion_fixture_bindings';
        if (occurrenceIds.includes(fixture.input_occurrence_id) !== expectedMatch
            || evaluateMatchTest(member.match_test, context).matched !== expectedMatch) {
          fail(code, `structure ${field} does not prove its exact boundary`);
        }
      }
    }
    if ([...fixtureIds.get('inclusion_fixture_bindings')].some(
      (fixtureId) => fixtureIds.get('exclusion_fixture_bindings').has(fixtureId),
    )) fail(code, 'structure inclusion and exclusion fixtures overlap');
    if (member.inline_list_overlay === null) continue;
    item39Count += 1;
    const overlay = member.inline_list_overlay;
    const governed = item39Contract.governed_item39_source;
    if (member.kind !== 'BEN_AUTHORED_INLINE_LIST_OVERLAY'
        || member.lawyer_ruling_id !== governed.lawyer_ruling_id
        || member.scope.agreement_index_id !== governed.agreement_index_id
        || member.scope.source_node_occurrence_id !== governed.source_node_occurrence_id
        || member.scope.start_byte !== governed.span.start_byte
        || member.scope.end_byte !== governed.span.end_byte
        || overlay.sealed_ambiguity_id !== governed.ambiguity_id
        || overlay.inline_marker_disposition_id !== governed.inline_marker_disposition_id
        || overlay.parent_reference !== governed.section_reference
        || !same(overlay.sealed_ambiguity_span, governed.span)) {
      fail(code, 'structure disposition differs from the authority Item 39 source');
    }
    const overlayIndex = validateResolvedRecordBinding(
      overlay.agreement_index_binding, nativeSources.resolveBinding,
      'Item 39 governed AgreementIndex', code,
    );
    const repeatBindings = array(
      overlay.ambiguous_repeat_fixture_bindings,
      code,
      'Item 39 ambiguous-repeat bindings',
    );
    if (repeatBindings.length !== 1 || !same(repeatBindings[0], expectedRepeatBinding)) {
      fail(code, 'structure disposition lacks the exact authority Item 39 negative');
    }
    const repeatFixture = resolvePackageMemberBinding(
      repeatBindings[0], packageRegistry, 'structure_fixture_members',
      'Item 39 ambiguous-repeat fixture', code,
    );
    validateGlobalItem39OverlayEvidence(member, overlayIndex, code);
    validateAmbiguousRepeatOverlayFixture(
      repeatFixture,
      nativeSources.resolveBinding,
      overlay.parent_scoping_rule,
      overlay.sealed_ambiguity_span,
      code,
      item39Contract,
    );
  }
  if (item39Count !== item39Contract.total_structure_overlay_fixture_count) {
    fail(code, 'approved structure set does not close the single Item 39 overlay');
  }
  return members;
}

function validateProfileSnapshots(
  analysis, candidate, resolveBinding, profileSet, semanticInputs,
  familyKeys = FAMILY_KEYS,
) {
  const code = 'M7_V2_PROFILE_GATE';
  exactKeys(profileSet, [
    'schema_version', 'family_profile_set_id', 'state',
    'family_profile_package_bindings', 'profiles', 'dimension_evidence_bindings',
    'subtype_tree_bindings',
  ], code, 'approved family profile set');
  if (profileSet.schema_version !== INPUT_SCHEMAS.APPROVED_FAMILY_PROFILE_SET
      || profileSet.state !== 'BEN_APPROVED_PROFILE_SET') {
    fail(code, 'approved family profile set state is invalid');
  }
  if (!same(profileSet.family_profile_package_bindings,
    semanticInputs.packageRegistry.bindings)) {
    fail(code, 'approved profile set package bindings differ from the validated registry');
  }
  const profileMembers = array(profileSet.profiles, code, 'approved profiles');
  const expectedProfiles = familyKeys.flatMap(
    (familyKey) => semanticInputs.packageRegistry.byFamily.get(familyKey).record.profiles,
  );
  if (!same(profileMembers, expectedProfiles)) {
    fail(code, 'approved profile members differ from their exact family packages or order');
  }
  const approvedProfiles = indexBy(profileMembers,
    'profile_id', code, 'approved profile');
  const approvedProfileKeyPairs = new Set();
  for (const profile of profileMembers) {
    const pair = `${profile.family_key}\0${profile.profile_key}`;
    if (approvedProfileKeyPairs.has(pair)) {
      fail(code, 'approved profile key is duplicated within one family');
    }
    approvedProfileKeyPairs.add(pair);
  }
  const dimensionEvidenceByProfile = new Map(
    [...approvedProfiles.keys()].map((profileId) => [profileId, []]),
  );
  const expectedDimensionBindings = familyKeys.flatMap((familyKey) => {
    const outer = semanticInputs.packageRegistry.byFamily.get(familyKey);
    return outer.record.dimension_evidence.map((record, index) => ({
      schema_version: PACKAGE_MEMBER_BINDING_SCHEMA,
      container_path: outer.binding.path,
      member_field: 'dimension_evidence',
      member_index: index,
      member_schema_version: DIMENSION_EVIDENCE_SCHEMA,
      member_record_id_field: 'dimension_evidence_id',
      member_record_id: record.dimension_evidence_id,
      member_byte_length: Buffer.byteLength(canonicalJson(record), 'utf8'),
      member_sha256: sha256Hex(Buffer.from(canonicalJson(record), 'utf8')),
    }));
  });
  if (!same(profileSet.dimension_evidence_bindings, expectedDimensionBindings)) {
    fail(code, 'dimension evidence bindings differ from the exact package inventory');
  }
  const dimensionEvidenceIds = [];
  for (const evidenceBinding of array(
    profileSet.dimension_evidence_bindings, code, 'dimension evidence bindings',
  )) {
    const evidence = resolvePackageMemberBinding(
      evidenceBinding, semanticInputs.packageRegistry, 'dimension_evidence',
      'dimension evidence', code,
    );
    dimensionEvidenceIds.push(evidence.dimension_evidence_id);
    exactKeys(evidence, [
      'schema_version', 'dimension_evidence_id', 'family_key', 'profile_id',
      'source_class', 'evidence_binding', 'dimension_keys', 'lawyer_ruling_id',
    ], code, 'dimension evidence');
    const profile = approvedProfiles.get(evidence.profile_id);
    if (!profile || !Array.isArray(profile.legal_authority_ids)
        || !Array.isArray(profile.fixture_proofs)
        || evidence.family_key !== profile.family_key
        || !['CALIBRATION', 'ADVERSARIAL'].includes(evidence.source_class)
        || !hasApprovedProfileAuthority(
          profile, evidence.lawyer_ruling_id, semanticInputs,
        )) {
      fail(code, 'dimension evidence is outside its approved profile and ruling');
    }
    validatePackageMemberBindingShape(
      evidence.evidence_binding, 'dimension source or fixture binding', code,
    );
    if (evidence.evidence_binding.member_field !== 'match_fixtures'
        || !profile.fixture_proofs.some(
          (proof) => same(proof.fixture_binding, evidence.evidence_binding),
        )) {
      fail(code, 'dimension evidence does not bind an approved exact fixture');
    }
    const dimensionKeys = canonicalStringSet(
      evidence.dimension_keys, code, 'dimension evidence keys',
    );
    if (dimensionKeys.length === 0) fail(code, 'dimension evidence keys are empty');
    const proof = profile.fixture_proofs.find(
      (entry) => same(entry.fixture_binding, evidence.evidence_binding),
    );
    const fixture = resolvePackageMemberBinding(
      evidence.evidence_binding, semanticInputs.packageRegistry, 'match_fixtures',
      'dimension evidence fixture', code,
    );
    validateFixtureRecord(fixture, proof);
    dimensionEvidenceByProfile.get(evidence.profile_id).push({ evidence, fixture });
  }
  unique(dimensionEvidenceIds, code, 'dimension evidence IDs');
  const approvedFamilies = new Set();
  const item42SharedSourceProfileKeys = new Set();
  for (const member of approvedProfiles.values()) {
    exactKeys(member, [
      'schema_version',
      'profile_id',
      'profile_key',
      'profile_set_version',
      'family_key',
      'parent_profile_id',
      'subtype_path',
      'classification_path',
      'required_fields',
      'optional_fields',
      'conditional_requirements',
      'minimum_floor_fields',
      'allowed_source_types',
      'allowed_dependency_types',
      'child_rule_profiles',
      'allowed_operators',
      'required_expression_signature',
      'equivalence_signature_mapping',
      'display_order',
      'grouping_policy',
      'known_relevant_dimensions',
      'excluded_or_delegated_dimensions',
      'approved_structure_disposition_ids',
      'no_comparison_policy',
      'legal_authority_ids',
      'shared_source_lawyer_decision_ids',
      'fixture_proofs',
      'match_test',
    ], code, `approved profile ${member.profile_id}`);
    if (member.schema_version !== FAMILY_PROFILE_SCHEMA
        || !familyKeys.includes(member.family_key)) {
      fail(code, 'approved profile family or schema is invalid');
    }
    string(member.profile_key, code, 'approved profile key');
    const unsignedProfile = { ...member };
    delete unsignedProfile.schema_version;
    delete unsignedProfile.profile_id;
    if (member.profile_id !== contentId(FAMILY_PROFILE_SCHEMA, unsignedProfile)) {
      fail(code, 'approved profile content identity is invalid');
    }
    if (member.parent_profile_id !== null) {
      string(member.parent_profile_id, code, 'approved parent profile ID');
    }
    approvedFamilies.add(member.family_key);
    validateMatchTestShape(member.match_test, code, `approved profile ${member.profile_id} match test`);
    for (const field of ['approved_structure_disposition_ids', 'legal_authority_ids']) {
      const values = array(member[field], code, `approved profile ${field}`);
      values.forEach((value) => string(value, code, `approved profile ${field} member`));
      unique(values, code, `approved profile ${field}`);
    }
    const sharedSourceDecisionIds = canonicalStringSet(
      member.shared_source_lawyer_decision_ids,
      code,
      'approved profile shared-source lawyer decisions',
    );
    for (const decisionId of sharedSourceDecisionIds) {
      const authority = semanticInputs.decisionAuthorities.get(decisionId);
      if (decisionId !== ITEM42_DECISION_ID
          || member.family_key !== 'DNO_INDEMNIFICATION'
          || !ITEM42_SHARED_SOURCE_PROFILE_KEYS.includes(member.profile_key)
          || !Array.isArray(member.subtype_path)
          || !['RIGHTS_SURVIVAL', 'NO_ADVERSE_AMENDMENT'].includes(
            member.subtype_path.at(-1),
          )
          || authority?.packetMember.sample_ordinal !== 42
          || authority.packetMember.reviewer !== 'BEN_GOODCHILD') {
        fail(code, 'shared-source profile authority is not the exact item-42 evidence');
      }
      item42SharedSourceProfileKeys.add(member.profile_key);
    }
    const packageApprovalId = semanticInputs.packageRegistry.byFamily.get(
      member.family_key,
    ).record.family_approval.ben_approval_id;
    if (member.legal_authority_ids.length === 0
        || !member.legal_authority_ids.includes(packageApprovalId)
        || member.legal_authority_ids.some(
          (rulingId) => rulingId !== packageApprovalId
            && !semanticInputs.packetRulingIds.has(rulingId),
        )) fail(code, 'approved profile does not trace to its package approval and packet rulings');
    if (member.approved_structure_disposition_ids.some(
      (id) => !semanticInputs.structureMembers.has(id),
    )) fail(code, 'approved profile cites an unapproved structure disposition');
    const fixtureKinds = [];
    const fixtureIds = [];
    for (const proof of array(member.fixture_proofs, code, 'profile fixture proofs')) {
      exactKeys(proof, [
        'fixture_id', 'kind', 'fixture_binding', 'input_occurrence_id', 'expected_match',
        'expected_selected_profile_key', 'expected_predicate_result_digest',
        'decisive_leaf_ids', 'lawyer_ruling_id',
      ], code, 'profile fixture proof');
      string(proof.fixture_id, code, 'profile fixture ID');
      fixtureIds.push(proof.fixture_id);
      fixtureKinds.push(proof.kind);
      if (!['POSITIVE', 'NEAR_NEGATIVE', 'WRONG_FAMILY', 'WRONG_SUBTYPE'].includes(proof.kind)) {
        fail(code, 'profile fixture kind is invalid');
      }
      validatePackageMemberBindingShape(
        proof.fixture_binding, 'profile fixture binding', code,
      );
      if (proof.fixture_binding.member_field !== 'match_fixtures') {
        fail(code, 'profile fixture binding schema is invalid');
      }
      string(proof.input_occurrence_id, code, 'profile fixture occurrence ID');
      if (typeof proof.expected_match !== 'boolean') fail(code, 'fixture match is not boolean');
      if (proof.expected_selected_profile_key !== null) {
        string(proof.expected_selected_profile_key, code, 'fixture selected profile key');
        if (!profileMembers.some(
          (profile) => profile.profile_key === proof.expected_selected_profile_key,
        )) {
          fail(code, 'fixture selected profile key is not approved');
        }
      }
      assertHex(proof.expected_predicate_result_digest, 64, code,
        'fixture predicate result digest');
      const decisive = array(proof.decisive_leaf_ids, code, 'fixture decisive leaves');
      decisive.forEach((value) => string(value, code, 'fixture decisive leaf ID'));
      if (!proof.expected_match && decisive.length === 0) {
        fail(code, 'negative fixture has no decisive leaf');
      }
      string(proof.lawyer_ruling_id, code, 'fixture lawyer ruling ID');
      if (!member.legal_authority_ids.includes(proof.lawyer_ruling_id)) {
        fail(code, 'profile fixture ruling is absent from the profile legal basis');
      }
    }
    if (!same([...new Set(fixtureKinds)].sort(), [
      'NEAR_NEGATIVE', 'POSITIVE', 'WRONG_FAMILY', 'WRONG_SUBTYPE',
    ])) fail(code, 'approved profile fixture kinds are incomplete');
    unique(fixtureIds, code, 'profile fixture IDs');
  }
  if (!same([...approvedFamilies].sort(), [...familyKeys].sort())) {
    fail(code, 'approved family profile set does not cover all 25 families');
  }
  if (!same([...item42SharedSourceProfileKeys].sort(), ITEM42_SHARED_SOURCE_PROFILE_KEYS)) {
    fail(code, 'item-42 shared-source authority is not unique to its two exact profiles');
  }
  const ownedTreeBindings = array(
    profileSet.subtype_tree_bindings, code, 'profile-set subtype-tree bindings',
  );
  if (!same(ownedTreeBindings, candidate.subtype_tree_bindings)) {
    fail(code, 'candidate subtype trees differ from the approved profile-set trees');
  }
  const orderedFamilies = familyKeys;
  if (ownedTreeBindings.length !== orderedFamilies.length) {
    fail(code, 'approved profile set does not own exactly 25 subtype trees');
  }
  const treesByFamily = new Map();
  const treeIds = [];
  for (let index = 0; index < ownedTreeBindings.length; index += 1) {
    const entry = ownedTreeBindings[index];
    exactKeys(entry, ['family_key', 'binding'], code, 'profile-set subtype-tree binding');
    if (entry.family_key !== orderedFamilies[index]) {
      fail(code, 'profile-set subtype trees are not in exact family order');
    }
    treeIds.push(entry.binding.member_record_id);
    const tree = resolvePackageMemberBinding(
      entry.binding, semanticInputs.packageRegistry, 'subtype_tree',
      `profile-set subtype tree ${entry.family_key}`, code,
    );
    exactKeys(tree, [
      'schema_version',
      'subtype_tree_id',
      'family_key',
      'tree_id',
      'profile_set_version',
      'completeness_state',
      'nodes',
    ], code, `profile-set subtype tree ${entry.family_key}`);
    const familyProfiles = [...approvedProfiles.values()].filter(
      (profile) => profile.family_key === entry.family_key,
    );
    const familyVersions = [...new Set(familyProfiles.map(
      (profile) => profile.profile_set_version,
    ))];
    if (tree.schema_version !== SUBTYPE_TREE_SCHEMA
        || tree.subtype_tree_id !== entry.binding.member_record_id
        || tree.family_key !== entry.family_key
        || familyVersions.length !== 1
        || !Number.isInteger(familyVersions[0])
        || familyVersions[0] < 1
        || tree.profile_set_version !== familyVersions[0]
        || !['TREE_OUTPUT_COMPLETE', 'TREE_OUTPUT_INCOMPLETE'].includes(
          tree.completeness_state,
        )) fail(code, `profile-set subtype tree ${entry.family_key} is inconsistent`);
    string(tree.tree_id, code, 'profile-set tree ID');
    const nodes = indexBy(array(tree.nodes, code, 'profile-set tree nodes'),
      'profile_key', code, 'profile-set tree node');
    const expectedProfileKeys = familyProfiles.map((profile) => profile.profile_key).sort();
    if (!same([...nodes.keys()].sort(), expectedProfileKeys)) {
      fail(code, `subtype tree ${entry.family_key} differs from its approved profile members`);
    }
    let rootCount = 0;
    const childCounts = new Map([...nodes.keys()].map((profileKey) => [profileKey, 0]));
    for (const node of nodes.values()) {
      exactKeys(node, [
        'profile_key', 'parent_profile_key', 'node_state',
      ], code, 'profile-set tree node');
      const profile = familyProfiles.find(
        (candidateProfile) => candidateProfile.profile_key === node.profile_key,
      );
      const parentProfile = profile?.parent_profile_id === null
        ? null : approvedProfiles.get(profile?.parent_profile_id);
      const expectedParentKey = parentProfile?.profile_key ?? null;
      if (!profile || profile.family_key !== entry.family_key
          || node.parent_profile_key !== expectedParentKey
          || (node.parent_profile_key !== null && !nodes.has(node.parent_profile_key))) {
        fail(code, 'profile-set tree node differs from its approved profile parent');
      }
      if (node.parent_profile_key === null) rootCount += 1;
      if (!['ABSTRACT', 'TERMINAL_OUTPUT_PERMITTED'].includes(node.node_state)) {
        fail(code, 'profile-set tree node state is invalid');
      }
      if (node.parent_profile_key !== null) {
        childCounts.set(
          node.parent_profile_key,
          childCounts.get(node.parent_profile_key) + 1,
        );
      }
      const ancestors = new Set([node.profile_key]);
      let parentKey = node.parent_profile_key;
      while (parentKey !== null) {
        if (ancestors.has(parentKey)) fail(code, 'profile-set subtype tree contains a cycle');
        ancestors.add(parentKey);
        parentKey = nodes.get(parentKey).parent_profile_key;
      }
    }
    for (const node of nodes.values()) {
      if (childCounts.get(node.profile_key) === 0
          && node.node_state !== 'TERMINAL_OUTPUT_PERMITTED') {
        fail(code, 'profile-set subtype tree leaf must permit terminal output');
      }
    }
    if ((tree.completeness_state === 'TREE_OUTPUT_COMPLETE' && rootCount !== 1)
        || (tree.completeness_state === 'TREE_OUTPUT_INCOMPLETE' && rootCount < 1)) {
      fail(code, 'profile-set subtype tree root count differs from its completeness state');
    }
    treesByFamily.set(entry.family_key, tree);
  }
  unique(treeIds, code, 'profile-set subtype-tree IDs');
  const profiles = indexBy(array(analysis.profile_snapshots, code, 'profile snapshots'),
    'profile_id', code, 'profile snapshot');
  const trees = new Map();
  if (profiles.size !== approvedProfiles.size
      || !same([...profiles.keys()].sort(), [...approvedProfiles.keys()].sort())) {
    fail(code, 'analysis must snapshot every and only approved profile');
  }
  if (!same([...profiles.keys()], [...approvedProfiles.keys()])) {
    fail(code, 'analysis profile snapshots are not in approved profile-set order');
  }
  for (const profile of profiles.values()) {
    exactKeys(profile, [
      'schema_version',
      'profile_id',
      'profile_key',
      'profile_set_binding',
      'tree_binding',
      'profile_set_version',
      'family_key',
      'parent_profile_id',
      'subtype_path',
      'classification_path',
      'required_fields',
      'optional_fields',
      'conditional_requirements',
      'minimum_floor_fields',
      'allowed_source_types',
      'allowed_dependency_types',
      'child_rule_profiles',
      'allowed_operators',
      'required_expression_signature',
      'equivalence_signature_mapping',
      'display_order',
      'grouping_policy',
      'known_relevant_dimensions',
      'excluded_or_delegated_dimensions',
      'approved_structure_disposition_ids',
      'no_comparison_policy',
      'legal_authority_ids',
      'shared_source_lawyer_decision_ids',
      'fixture_proofs',
      'match_test',
    ], code, `profile ${profile.profile_id}`);
    if (!same(profile.profile_set_binding, analysis.governance.family_profile_set_binding)) {
      fail(code, `profile ${profile.profile_id} has a stale profile-set binding`);
    }
    const snapshotBody = { ...profile };
    delete snapshotBody.profile_set_binding;
    delete snapshotBody.tree_binding;
    if (!same(snapshotBody, approvedProfiles.get(profile.profile_id))) {
      fail(code, `profile ${profile.profile_id} differs from its approved set member`);
    }
    validateMatchTestShape(profile.match_test, code, `profile ${profile.profile_id} match test`);
    const approvedTree = ownedTreeBindings.find(
      (entry) => entry.family_key === profile.family_key,
    );
    if (!approvedTree || !same(approvedTree.binding, profile.tree_binding)) {
      fail(code, `profile ${profile.profile_id} does not use its profile-set-owned subtype tree`);
    }
    const boundTree = treesByFamily.get(profile.family_key);
    if (!Number.isInteger(profile.profile_set_version) || profile.profile_set_version < 1) {
      fail(code, `profile ${profile.profile_id} has an invalid version`);
    }
    if (!familyKeys.includes(profile.family_key)) fail(code, 'profile family is not approved');
    if (profile.parent_profile_id !== null
        && profiles.get(profile.parent_profile_id)?.family_key !== profile.family_key) {
      fail(code, 'profile parent is absent or belongs to another family');
    }
    array(profile.subtype_path, code, 'subtype path');
    array(profile.classification_path, code, 'classification path');
    if (profile.subtype_path.length === 0
        || profile.classification_path.length !== profile.subtype_path.length
        || profile.subtype_path[0] !== profile.family_key) {
      fail(code, `profile ${profile.profile_id} has an invalid classification path`);
    }
    profile.subtype_path.forEach((value) => string(value, code, 'subtype path member'));
    profile.classification_path.forEach((value) => string(value, code, 'classification path member'));

    const validateFieldRequirement = (requirement, allowedCardinalities, label) => {
      exactKeys(requirement, [
        'requirement_id', 'field_key', 'value_type', 'cardinality', 'materiality',
        'lawyer_ruling_id',
      ], code, label);
      const unsignedRequirement = { ...requirement };
      delete unsignedRequirement.requirement_id;
      if (requirement.requirement_id !== contentId(
        PROFILE_REQUIREMENT_SCHEMA, unsignedRequirement,
      )) fail(code, `${label} content identity is invalid`);
      string(requirement.field_key, code, `${label} key`);
      if (!FACT_VALUE_TYPES.includes(requirement.value_type)
          || !allowedCardinalities.includes(requirement.cardinality)
          || !['MATERIAL', 'NON_MATERIAL'].includes(requirement.materiality)) {
        fail(code, `${label} has an invalid type, cardinality, or materiality`);
      }
      if (!hasApprovedProfileAuthority(profile, requirement.lawyer_ruling_id, semanticInputs)) {
        fail(code, `${label} lacks an exact approved family authority`);
      }
      return requirement.field_key;
    };
    const requiredFieldKeys = array(profile.required_fields, code, 'required fields').map(
      (requirement) => validateFieldRequirement(
        requirement, ['ONE', 'ONE_OR_MORE'], 'required field',
      ),
    );
    const optionalFieldKeys = array(profile.optional_fields, code, 'optional fields').map(
      (requirement) => validateFieldRequirement(
        requirement, ['ZERO_OR_ONE', 'ZERO_OR_MORE'], 'optional field',
      ),
    );
    unique(requiredFieldKeys, code, 'profile required fields');
    unique(optionalFieldKeys, code, 'profile optional fields');
    if (requiredFieldKeys.some((field) => optionalFieldKeys.includes(field))) {
      fail(code, 'a profile field is both mandatory and optional');
    }
    const declaredFieldKeys = [...requiredFieldKeys, ...optionalFieldKeys];
    const rawDimensionDispositions = array(
      profile.excluded_or_delegated_dimensions, code, 'profile dimension dispositions',
    );
    const delegatedDimensionKeys = rawDimensionDispositions.filter(
      (dimension) => isObject(dimension) && dimension.disposition === 'DELEGATED',
    ).map((dimension) => dimension.dimension_key);
    const declaredOrDelegatedFieldKeys = [...declaredFieldKeys, ...delegatedDimensionKeys];
    const conditionalIds = [];
    for (const condition of array(
      profile.conditional_requirements, code, 'conditional requirements',
    )) {
      exactKeys(condition, [
        'conditional_requirement_id', 'predicate', 'required_field_keys',
        'lawyer_ruling_id',
      ], code, 'conditional requirement');
      const unsignedCondition = { ...condition };
      delete unsignedCondition.conditional_requirement_id;
      if (condition.conditional_requirement_id !== contentId(
        PROFILE_CONDITIONAL_REQUIREMENT_SCHEMA, unsignedCondition,
      )) fail(code, 'conditional requirement content identity is invalid');
      conditionalIds.push(condition.conditional_requirement_id);
      exactKeys(condition.predicate, [
        'field_key', 'value_type', 'operator', 'typed_value',
      ], code, 'conditional predicate');
      const predicateRequirement = [
        ...profile.required_fields, ...profile.optional_fields,
      ].find((requirement) => requirement.field_key === condition.predicate.field_key);
      if (!predicateRequirement
          || condition.predicate.operator !== 'EQUALS'
          || condition.predicate.value_type !== predicateRequirement.value_type) {
        fail(code, 'conditional predicate is outside the declared typed fields');
      }
      validateTypedValue({
        fact_id: condition.conditional_requirement_id,
        atomicity: 'ATOMIC_TYPED_VALUE',
        value_type: condition.predicate.value_type,
        typed_value: condition.predicate.typed_value,
      });
      const conditionalFields = array(condition.required_field_keys, code,
        'conditional required fields');
      if (conditionalFields.length === 0
          || conditionalFields.some((field) => !optionalFieldKeys.includes(field))) {
        fail(code, 'conditional requirements must activate declared optional fields');
      }
      unique(conditionalFields, code, 'conditional required fields');
      if (!hasApprovedProfileAuthority(profile, condition.lawyer_ruling_id, semanticInputs)) {
        fail(code, 'conditional requirement lacks an exact approved family authority');
      }
    }
    unique(conditionalIds, code, 'conditional requirement IDs');
    const floorFields = array(profile.minimum_floor_fields, code, 'minimum floor fields');
    unique(floorFields, code, 'minimum floor fields');
    if (!floorFields.includes('APPLIES_TO') || !floorFields.includes('LEGAL_EFFECT')
        || floorFields.some((field) => !requiredFieldKeys.includes(field))) {
      fail(code, 'minimum floor must contain mandatory APPLIES_TO and LEGAL_EFFECT fields');
    }
    const allowedSourceTypes = array(profile.allowed_source_types, code,
      'allowed source types');
    if (allowedSourceTypes.length === 0) fail(code, 'profile has no allowed source type');
    for (const sourceType of allowedSourceTypes) {
      exactKeys(sourceType, ['source_type', 'lawyer_ruling_id'], code, 'allowed source type');
      string(sourceType.source_type, code, 'allowed source type');
      if (!hasApprovedProfileAuthority(profile, sourceType.lawyer_ruling_id, semanticInputs)) {
        fail(code, 'allowed source type lacks an exact approved family authority');
      }
    }
    unique(allowedSourceTypes.map((entry) => entry.source_type), code, 'allowed source types');
    const allowedDependencyTypes = array(profile.allowed_dependency_types, code,
      'allowed dependency types');
    for (const dependencyType of allowedDependencyTypes) {
      exactKeys(dependencyType, ['dependency_type', 'lawyer_ruling_id'], code,
        'allowed dependency type');
      string(dependencyType.dependency_type, code, 'allowed dependency type');
      if (!hasApprovedProfileAuthority(profile, dependencyType.lawyer_ruling_id, semanticInputs)) {
        fail(code, 'allowed dependency type lacks an exact approved family authority');
      }
    }
    unique(allowedDependencyTypes.map((entry) => entry.dependency_type), code,
      'allowed dependency types');
    const childRequirementIds = [];
    for (const requirement of array(profile.child_rule_profiles, code,
      'child rule requirements')) {
      exactKeys(requirement, [
        'child_rule_requirement_id', 'profile_id', 'relationship_operator', 'cardinality',
        'lawyer_ruling_id',
      ], code, 'child rule requirement');
      const unsignedRequirement = { ...requirement };
      delete unsignedRequirement.child_rule_requirement_id;
      if (requirement.child_rule_requirement_id !== contentId(
        PROFILE_CHILD_RULE_REQUIREMENT_SCHEMA, unsignedRequirement,
      ) || !approvedProfiles.has(requirement.profile_id)
          || !OPERATORS.has(requirement.relationship_operator)
          || !Array.isArray(profile.allowed_operators)
          || !profile.allowed_operators.includes(requirement.relationship_operator)
          || !['ONE', 'ZERO_OR_ONE', 'ONE_OR_MORE', 'ZERO_OR_MORE'].includes(
            requirement.cardinality,
          )) fail(code, 'child rule requirement is invalid');
      childRequirementIds.push(requirement.child_rule_requirement_id);
      if (!hasApprovedProfileAuthority(profile, requirement.lawyer_ruling_id, semanticInputs)) {
        fail(code, 'child rule requirement lacks an exact approved family authority');
      }
    }
    unique(childRequirementIds, code, 'child rule requirement IDs');
    exactKeys(profile.equivalence_signature_mapping, EQUIVALENCE_SIGNATURE_SLOTS,
      code, 'profile equivalence-signature mapping');
    const groupingRelevantFields = new Set([
      ...profile.required_fields,
      ...profile.optional_fields,
    ].filter((requirement) => requirement.materiality === 'MATERIAL')
      .map((requirement) => requirement.field_key));
    delegatedDimensionKeys.forEach((dimensionKey) => groupingRelevantFields.add(dimensionKey));
    const mappedGroupingFields = new Set();
    let expressionRoleCount = 0;
    for (const slot of EQUIVALENCE_SIGNATURE_SLOTS) {
      const mapping = profile.equivalence_signature_mapping[slot];
      exactKeys(mapping, [
        'field_keys', 'expression_signature_role', 'lawyer_ruling_id',
      ], code, `equivalence-signature ${slot} mapping`);
      const fieldKeys = array(mapping.field_keys, code,
        `equivalence-signature ${slot} fields`);
      fieldKeys.forEach((fieldKey) => string(fieldKey, code,
        `equivalence-signature ${slot} field`));
      unique(fieldKeys, code, `equivalence-signature ${slot} fields`);
      if (fieldKeys.some((fieldKey) => !declaredOrDelegatedFieldKeys.includes(fieldKey))
          || ![null, 'CANONICAL_EXPRESSION'].includes(mapping.expression_signature_role)
          || !hasApprovedProfileAuthority(profile, mapping.lawyer_ruling_id, semanticInputs)) {
        fail(code, `equivalence-signature ${slot} mapping is not approved`);
      }
      fieldKeys.forEach((fieldKey) => mappedGroupingFields.add(fieldKey));
      if (mapping.expression_signature_role === 'CANONICAL_EXPRESSION') {
        expressionRoleCount += 1;
      }
    }
    if (!profile.equivalence_signature_mapping.actor.field_keys.includes('APPLIES_TO')
        || !profile.equivalence_signature_mapping.effect.field_keys.includes('LEGAL_EFFECT')
        || [...groupingRelevantFields].some((fieldKey) => !mappedGroupingFields.has(fieldKey))
        || expressionRoleCount === 0) {
      fail(code, 'equivalence signature omits a grouping-relevant fact or expression');
    }
    const displayOrder = array(profile.display_order, code, 'profile display order');
    displayOrder.forEach((field) => string(field, code, 'display-order field'));
    unique(displayOrder, code, 'profile display order');
    if (!same([...displayOrder].sort(), [...declaredOrDelegatedFieldKeys].sort())) {
      fail(code,
        'profile display order does not cover every declared and delegated field exactly once');
    }
    exactKeys(profile.grouping_policy, [
      'allowed', 'compatible_profile_ids', 'lawyer_ruling_id',
    ], code, 'profile grouping policy');
    const compatibleProfiles = array(profile.grouping_policy.compatible_profile_ids, code,
      'compatible grouping profiles');
    compatibleProfiles.forEach((profileId) => string(profileId, code,
      'compatible grouping profile'));
    unique(compatibleProfiles, code, 'compatible grouping profiles');
    if (compatibleProfiles.some((profileId) => !approvedProfiles.has(profileId)
        || profileId === profile.profile_id)
        || typeof profile.grouping_policy.allowed !== 'boolean'
        || (profile.grouping_policy.allowed
          && !hasApprovedProfileAuthority(
            profile, profile.grouping_policy.lawyer_ruling_id, semanticInputs,
          ))
        || (!profile.grouping_policy.allowed && (
          compatibleProfiles.length !== 0 || profile.grouping_policy.lawyer_ruling_id !== null
        ))) fail(code, 'profile grouping policy is invalid');

    const knownDimensionKeys = [];
    for (const dimension of array(profile.known_relevant_dimensions, code,
      'known relevant dimensions')) {
      exactKeys(dimension, [
        'dimension_key', 'source', 'lawyer_ruling_id',
      ], code, 'known relevant dimension');
      knownDimensionKeys.push(string(dimension.dimension_key, code, 'known dimension key'));
      if (!['CALIBRATION', 'ADVERSARIAL'].includes(dimension.source)
          || !hasApprovedProfileAuthority(profile, dimension.lawyer_ruling_id, semanticInputs)) {
        fail(code, 'known dimension lacks an exact approved source and ruling');
      }
    }
    if (knownDimensionKeys.length === 0) fail(code, 'profile has no known-dimension inventory');
    unique(knownDimensionKeys, code, 'known dimension keys');
    const knownDimensionsByKey = new Map(profile.known_relevant_dimensions.map(
      (dimension) => [dimension.dimension_key, dimension],
    ));
    const profileDimensionEvidence = dimensionEvidenceByProfile.get(profile.profile_id) ?? [];
    const claimedEvidenceDimensionKeys = new Set();
    for (const { evidence, fixture } of profileDimensionEvidence) {
      const derivedDimensionKeys = new Set(deriveFixtureDimensionKeys(profile, fixture));
      for (const dimensionKey of evidence.dimension_keys) {
        const knownDimension = knownDimensionsByKey.get(dimensionKey);
        if (!derivedDimensionKeys.has(dimensionKey)) {
          fail(code, 'dimension evidence key is not derived from the bound exact fixture');
        }
        if (claimedEvidenceDimensionKeys.has(dimensionKey)) {
          fail(code, 'dimension evidence records overlap for one approved profile');
        }
        if (!knownDimension
            || knownDimension.source !== evidence.source_class
            || knownDimension.lawyer_ruling_id !== evidence.lawyer_ruling_id) {
          fail(code, 'dimension evidence key differs from its exact source class or ruling');
        }
        claimedEvidenceDimensionKeys.add(dimensionKey);
      }
    }
    const evidenceDimensionKeys = [...claimedEvidenceDimensionKeys].sort();
    if (profileDimensionEvidence.length === 0
        || !same([...knownDimensionKeys].sort(), evidenceDimensionKeys)) {
      fail(code, 'known dimensions differ from the bound calibration and adversarial evidence');
    }
    for (const dimension of profile.known_relevant_dimensions) {
      if (!profileDimensionEvidence.some(
        ({ evidence }) => evidence.dimension_keys.includes(dimension.dimension_key)
          && evidence.source_class === dimension.source
          && evidence.lawyer_ruling_id === dimension.lawyer_ruling_id,
      )) {
        fail(code, 'known dimension has no exact evidence source and ruling');
      }
    }
    const dimensionDispositions = new Map();
    for (const dimension of rawDimensionDispositions) {
      exactKeys(dimension, [
        'dimension_key', 'disposition', 'lawyer_ruling_id', 'owner_profile_id',
        'owner_field_key',
      ], code, 'dimension disposition');
      string(dimension.dimension_key, code, 'dimension disposition key');
      if (dimensionDispositions.has(dimension.dimension_key)
          || declaredFieldKeys.includes(dimension.dimension_key)
          || !['EXCLUDED', 'DELEGATED'].includes(dimension.disposition)
          || !hasApprovedProfileAuthority(profile, dimension.lawyer_ruling_id, semanticInputs)) {
        fail(code, 'dimension disposition is duplicate or lacks exact authority');
      }
      if (dimension.disposition === 'EXCLUDED') {
        if (dimension.owner_profile_id !== null || dimension.owner_field_key !== null) {
          fail(code, 'excluded dimension carries a false semantic owner');
        }
      } else {
        const ownerProfile = approvedProfiles.get(dimension.owner_profile_id);
        const ownerFields = ownerProfile ? [
          ...ownerProfile.required_fields,
          ...ownerProfile.optional_fields,
        ].map((entry) => entry.field_key) : [];
        if (!ownerProfile || !ownerFields.includes(dimension.owner_field_key)) {
          fail(code, 'delegated dimension has no exact approved owner profile and field');
        }
      }
      dimensionDispositions.set(dimension.dimension_key, dimension);
    }
    const accountedDimensions = new Set([
      ...declaredFieldKeys,
      ...dimensionDispositions.keys(),
      ...childRequirementIds.map((requirementId) => `CHILD_RULE:${requirementId}`),
    ]);
    if (!same([...accountedDimensions].sort(), [...knownDimensionKeys].sort())) {
      fail(code, 'known dimensions are not finitely required, optional, excluded, or delegated');
    }
    array(profile.allowed_operators, code, 'allowed operators');
    unique(profile.allowed_operators, code, 'allowed operators');
    for (const operator of profile.allowed_operators) {
      if (!OPERATORS.has(operator)) fail(code, `operator ${operator} is not in V2`);
    }
    string(profile.required_expression_signature, code, 'required expression signature');

    exactKeys(boundTree, [
      'schema_version',
      'subtype_tree_id',
      'family_key',
      'tree_id',
      'profile_set_version',
      'completeness_state',
      'nodes',
    ], code, 'profile subtype tree');
    if (boundTree.schema_version !== SUBTYPE_TREE_SCHEMA
        || boundTree.subtype_tree_id !== profile.tree_binding.member_record_id
        || boundTree.family_key !== profile.family_key
        || boundTree.profile_set_version !== profile.profile_set_version) {
      fail(code, `profile ${profile.profile_id} subtype tree identity is inconsistent`);
    }
    string(boundTree.tree_id, code, 'profile tree ID');
    if (!['TREE_OUTPUT_COMPLETE', 'TREE_OUTPUT_INCOMPLETE'].includes(
      boundTree.completeness_state,
    )) {
      fail(code, 'profile subtype tree completeness state is invalid');
    }
    const nodes = indexBy(array(boundTree.nodes, code, 'profile tree nodes'),
      'profile_key', code, 'profile tree node');
    let rootCount = 0;
    const childCounts = new Map([...nodes.keys()].map((profileKey) => [profileKey, 0]));
    for (const node of nodes.values()) {
      exactKeys(node, [
        'profile_key', 'parent_profile_key', 'node_state',
      ], code, 'profile tree node');
      if (node.parent_profile_key !== null && !nodes.has(node.parent_profile_key)) {
        fail(code, `profile tree parent ${node.parent_profile_key} is absent`);
      }
      if (node.parent_profile_key === null) rootCount += 1;
      if (!['ABSTRACT', 'TERMINAL_OUTPUT_PERMITTED'].includes(node.node_state)) {
        fail(code, 'profile tree node state is invalid');
      }
      if (node.parent_profile_key !== null) {
        childCounts.set(
          node.parent_profile_key,
          childCounts.get(node.parent_profile_key) + 1,
        );
      }
      const ancestors = new Set([node.profile_key]);
      let parentKey = node.parent_profile_key;
      while (parentKey !== null) {
        if (ancestors.has(parentKey)) fail(code, 'profile subtype tree contains a cycle');
        ancestors.add(parentKey);
        parentKey = nodes.get(parentKey).parent_profile_key;
      }
    }
    for (const node of nodes.values()) {
      if (childCounts.get(node.profile_key) === 0
          && node.node_state !== 'TERMINAL_OUTPUT_PERMITTED') {
        fail(code, 'profile subtype tree leaf must permit terminal output');
      }
    }
    if ((boundTree.completeness_state === 'TREE_OUTPUT_COMPLETE' && rootCount !== 1)
        || (boundTree.completeness_state === 'TREE_OUTPUT_INCOMPLETE' && rootCount < 1)) {
      fail(code, 'profile subtype tree root count differs from its completeness state');
    }
    if (!nodes.has(profile.profile_key)) fail(code, 'profile is absent from its subtype tree');
    const parentProfileKey = profile.parent_profile_id === null
      ? null : profiles.get(profile.parent_profile_id)?.profile_key;
    if (nodes.get(profile.profile_key).parent_profile_key !== parentProfileKey) {
      fail(code, 'profile parent differs from its approved subtype tree');
    }
    if (profile.no_comparison_policy !== null) {
      exactKeys(profile.no_comparison_policy, [
        'authority_kind',
        'policy_id',
        'lawyer_ruling_id',
        'approver',
        'legal_reason',
        'covered_occurrence_class',
        'positive_fixture_ids',
        'near_negative_fixture_ids',
      ], code, 'profile no-comparison policy');
      if (profile.no_comparison_policy.authority_kind !== 'BEN_APPROVED_NO_COMPARISON_PROFILE'
          || profile.no_comparison_policy.approver !== 'BEN_GOODCHILD') {
        fail(code, 'profile no-comparison policy lacks Ben approval');
      }
      for (const field of [
        'policy_id', 'lawyer_ruling_id', 'legal_reason', 'covered_occurrence_class',
      ]) string(profile.no_comparison_policy[field], code, `no-comparison ${field}`);
      if (!hasApprovedProfileAuthority(
        profile, profile.no_comparison_policy.lawyer_ruling_id, semanticInputs,
      )) {
        fail(code, 'no-comparison policy ruling is absent from the approved legal basis');
      }
      for (const field of ['positive_fixture_ids', 'near_negative_fixture_ids']) {
        const values = array(profile.no_comparison_policy[field], code,
          `no-comparison ${field}`);
        if (values.length === 0) fail(code, `no-comparison ${field} is empty`);
        values.forEach((value) => string(value, code, `no-comparison ${field} member`));
        unique(values, code, `no-comparison ${field}`);
      }
      const positiveIds = profile.fixture_proofs.filter((proof) => proof.kind === 'POSITIVE')
        .map((proof) => proof.fixture_id).sort();
      const nearNegativeIds = profile.fixture_proofs.filter(
        (proof) => proof.kind === 'NEAR_NEGATIVE',
      ).map((proof) => proof.fixture_id).sort();
      if (!same([...profile.no_comparison_policy.positive_fixture_ids].sort(), positiveIds)
          || !same([...profile.no_comparison_policy.near_negative_fixture_ids].sort(),
            nearNegativeIds)) {
        fail(code, 'no-comparison policy fixture scope differs from approved profile proofs');
      }
    }
    const tracedRulings = new Set([
      semanticInputs.packageRegistry.byFamily.get(
        profile.family_key,
      ).record.family_approval.ben_approval_id,
      'M5-RULING-ONE-OPERATIVE-LIMB',
      'M5-RULING-ONE-SEMANTIC-OWNER',
      'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
      ...profile.fixture_proofs.map((proof) => proof.lawyer_ruling_id),
      ...profile.required_fields.map((field) => field.lawyer_ruling_id),
      ...profile.optional_fields.map((field) => field.lawyer_ruling_id),
      ...profile.conditional_requirements.map((condition) => condition.lawyer_ruling_id),
      ...profile.child_rule_profiles.map((requirement) => requirement.lawyer_ruling_id),
      ...profile.allowed_source_types.map((entry) => entry.lawyer_ruling_id),
      ...profile.allowed_dependency_types.map((entry) => entry.lawyer_ruling_id),
      ...profile.known_relevant_dimensions.map((dimension) => dimension.lawyer_ruling_id),
      ...profile.excluded_or_delegated_dimensions.map(
        (dimension) => dimension.lawyer_ruling_id,
      ),
      ...EQUIVALENCE_SIGNATURE_SLOTS.map(
        (slot) => profile.equivalence_signature_mapping[slot].lawyer_ruling_id,
      ),
      ...(profile.grouping_policy.allowed ? [profile.grouping_policy.lawyer_ruling_id] : []),
      ...(profile.no_comparison_policy === null
        ? [] : [profile.no_comparison_policy.lawyer_ruling_id]),
    ]);
    if (profile.legal_authority_ids.some((rulingId) => !tracedRulings.has(rulingId))) {
      fail(code, 'profile contains an untraced legal-authority ruling');
    }
    trees.set(profile.profile_id, boundTree);
  }
  return { approvedProfiles, profiles, trees, treesByFamily };
}

function validateFamilyProfilePackageSetForWork3(input) {
  const code = 'M7_V2_PROFILE_GATE';
  exactKeys(input, [
    'work3Authority',
    'dnoItem42SuccessorAuthority',
    'familyProfileSet',
    'familyPackageSources',
    'familyPacketSet',
    'structureDispositionSet',
    'nativeSourceRecords',
  ], code, 'Work3 family-package validation input');
  const baseAuthority = validateWork3FamilyPackageAuthority(input.work3Authority, code);
  const authority = applyDnoItem42PackageSuccessorAuthority(
    baseAuthority,
    input.work3Authority,
    input.dnoItem42SuccessorAuthority,
    input.familyPackageSources,
    code,
  );
  const packageRegistry = buildAuthorityFamilyPackageRegistry(
    input.familyProfileSet,
    input.familyPackageSources,
    authority,
    code,
  );
  const nativeSources = providedSourceRegistry(
    input.nativeSourceRecords, 'Work3 native source records', code,
  );

  const familyPacketBinding = authority.familyPacketContract.binding;
  exactKeys(familyPacketBinding, BINDING_KEYS, code, 'authority family-packet binding');
  const familyPacketBytes = Buffer.from(`${canonicalJson(input.familyPacketSet)}\n`, 'utf8');
  validateBinding(familyPacketBinding, () => familyPacketBytes, 'authority family packet');
  validateCanonicalRecordBytes(
    familyPacketBytes, familyPacketBinding, code, 'authority family packet',
  );
  const packetSourceBindings = [
    input.familyPacketSet.work0_evidence_root_binding,
    input.familyPacketSet.fixed_sample_identity_binding,
    input.familyPacketSet.repair_baseline_binding,
    input.familyPacketSet.calibration_ruling_map_binding,
    input.familyPacketSet.lawyer_review_packet_binding,
    ...array(input.familyPacketSet.families, code, 'family packet families').map(
      (family) => family.calibration_pack_binding,
    ),
  ];
  const packetSourcePaths = packetSourceBindings.map(
    (binding) => string(binding?.path, code, 'family packet source path'),
  );
  unique(packetSourcePaths, code, 'family packet source paths');
  const authorityPacketPaths = array(
    authority.familyPacketContract.transitive_binding_paths,
    code,
    'authority family-packet source paths',
  );
  if (!same([...packetSourcePaths].sort(), [...authorityPacketPaths].sort())) {
    fail(code, 'family packet source paths differ from the Work3 authority');
  }
  for (const binding of packetSourceBindings) {
    if (Object.hasOwn(binding, 'git_blob_oid')) {
      validateResolvedRecordBinding(
        binding, nativeSources.resolveBinding, 'family packet transitive source', code,
      );
    } else {
      exactKeys(binding, BINDING_KEYS.filter((key) => key !== 'git_blob_oid'),
        code, 'family packet calibration source binding');
      const source = nativeSources.byPath.get(binding.path);
      if (!source || !same(binding, Object.fromEntries(
        Object.entries(source.binding).filter(([key]) => key !== 'git_blob_oid'),
      ))) {
        fail(code, 'family packet calibration source does not resolve exactly');
      }
      validateBinding(
        source.binding, nativeSources.resolveBinding,
        'family packet calibration source',
      );
    }
  }
  const packetAuthority = validateFamilyPacketAuthority(
    input.familyPacketSet,
    {
      inputByRole: new Map([['APPROVED_FAMILY_PACKET_SET', familyPacketBinding]]),
      candidate: {
        work0_evidence_root_binding: input.familyPacketSet.work0_evidence_root_binding,
      },
    },
    nativeSources.resolveBinding,
    authority.familyKeys,
  );

  const structureMembers = validateStructureSetForFamilyPackages(
    input.structureDispositionSet,
    packageRegistry,
    packetAuthority,
    nativeSources,
    authority,
    code,
  );
  const resolvedLegalDecisionIds = new Set([
    ...packetAuthority.packetRulingIds,
    ...packetAuthority.decisionAuthorities.keys(),
  ]);
  for (const familyKey of authority.familyKeys) {
    const packageRecord = packageRegistry.byFamily.get(familyKey).record;
    const approvalId = packageRecord.family_approval.ben_approval_id;
    if (packageRecord.legal_decisions.some(
      (decisionId) => decisionId !== approvalId
        && !resolvedLegalDecisionIds.has(decisionId),
    )) {
      fail(code, `family package ${familyKey} cites an unresolved legal decision`);
    }
  }

  const profileSetMarker = Object.freeze({
    family_profile_set_id: input.familyProfileSet.family_profile_set_id,
  });
  const treeBindingsByFamily = new Map(array(
    input.familyProfileSet.subtype_tree_bindings,
    code,
    'profile-set subtype-tree bindings',
  ).map((entry) => [entry.family_key, entry.binding]));
  const syntheticAnalysis = {
    governance: { family_profile_set_binding: profileSetMarker },
    profile_snapshots: input.familyProfileSet.profiles.map((profile) => ({
      ...profile,
      profile_set_binding: profileSetMarker,
      tree_binding: treeBindingsByFamily.get(profile.family_key),
    })),
  };
  const semanticInputs = {
    packageRegistry,
    packetRulingIds: packetAuthority.packetRulingIds,
    decisionAuthorities: packetAuthority.decisionAuthorities,
    structureMembers,
  };
  const profiles = validateProfileSnapshots(
    syntheticAnalysis,
    { subtype_tree_bindings: input.familyProfileSet.subtype_tree_bindings },
    nativeSources.resolveBinding,
    input.familyProfileSet,
    semanticInputs,
    authority.familyKeys,
  );
  validateProfileFixtures(profiles.profiles, nativeSources.resolveBinding, semanticInputs);

  if (!same([...nativeSources.usedPaths].sort(),
    nativeSources.entries.map((entry) => entry.binding.path).sort())) {
    fail(code, 'Work3 native source input contains an unused or missing record');
  }
  return deepFreezeTransient({
    status: 'PASS',
    family_profile_set_id: input.familyProfileSet.family_profile_set_id,
    family_package_count: packageRegistry.byFamily.size,
    profile_count: profiles.approvedProfiles.size,
    dimension_evidence_count: input.familyProfileSet.dimension_evidence_bindings.length,
    subtype_tree_count: profiles.treesByFamily.size,
    structure_disposition_count: structureMembers.size,
  });
}

function validateCandidateSets(analysis) {
  const code = 'M7_V2_CANDIDATE_SET';
  const candidateSets = indexBy(array(analysis.candidate_sets, code, 'candidate sets'),
    'candidate_set_id', code, 'candidate set');
  const byAuthoredUnit = new Map();
  const effects = new Map();
  for (const candidateSet of candidateSets.values()) {
    exactKeys(candidateSet, [
      'schema_version',
      'candidate_set_id',
      'authored_unit_id',
      'source_closure_id',
      'considered_family_keys',
      'effects',
    ], code, 'candidate set');
    if (candidateSet.schema_version !== CANDIDATE_SET_SCHEMA) {
      fail(code, 'candidate set schema is not V2 inspected-candidate V1');
    }
    const unsignedCandidateSet = { ...candidateSet };
    delete unsignedCandidateSet.schema_version;
    delete unsignedCandidateSet.candidate_set_id;
    if (candidateSet.candidate_set_id !== contentId(CANDIDATE_SET_SCHEMA, unsignedCandidateSet)) {
      fail(code, 'candidate set content identity is invalid');
    }
    string(candidateSet.authored_unit_id, code, 'candidate authored unit');
    if (byAuthoredUnit.has(candidateSet.authored_unit_id)) {
      fail(code, 'an authored unit has more than one candidate set');
    }
    byAuthoredUnit.set(candidateSet.authored_unit_id, candidateSet);
    string(candidateSet.source_closure_id, code, 'candidate source closure ID');
    array(candidateSet.considered_family_keys, code, 'considered family keys');
    unique(candidateSet.considered_family_keys, code, 'considered family keys');
    if (!same(candidateSet.considered_family_keys, FAMILY_KEYS)) {
      fail(code, 'candidate set does not bind all 25 family sets');
    }
    const candidateEffects = array(candidateSet.effects, code, 'candidate effects');
    if (candidateEffects.length === 0) fail(code, 'candidate set has no inspected effects');
    for (const effect of candidateEffects) {
      exactKeys(effect, [
        'effect_id',
        'input_occurrence_id',
        'source_span_ids',
        'fact_ids',
        'expression_root_id',
        'profile_results',
        'selected_profile_id',
        'selected_profile_key',
        'no_more_specific_descendant_match',
        'generic_level_output_authority',
      ], code, 'candidate effect');
      string(effect.input_occurrence_id, code, 'effect input occurrence ID');
      const sourceSpanIds = array(effect.source_span_ids, code, 'effect source spans');
      if (sourceSpanIds.length === 0) fail(code, 'candidate effect has no source spans');
      sourceSpanIds.forEach((value) => string(value, code, 'effect source span ID'));
      unique(sourceSpanIds, code, 'effect source spans');
      const factIds = array(effect.fact_ids, code, 'effect fact IDs');
      factIds.forEach((value) => string(value, code, 'effect fact ID'));
      unique(factIds, code, 'effect fact IDs');
      if (effect.expression_root_id !== null) {
        string(effect.expression_root_id, code, 'effect expression root ID');
      }
      if (effect.effect_id !== contentId('STAGE_2Y_M7_V2_INSPECTED_EFFECT/V1', {
        input_occurrence_id: effect.input_occurrence_id,
        source_span_ids: effect.source_span_ids,
        fact_ids: effect.fact_ids,
        expression_root_id: effect.expression_root_id,
      })) fail(code, 'candidate effect content identity is invalid');
      for (const result of array(effect.profile_results, code, 'effect profile results')) {
        exactKeys(result, [
          'profile_id', 'profile_key', 'matched', 'predicate_result_digest',
          'decisive_leaf_ids',
        ], code, 'effect profile result');
        string(result.profile_id, code, 'effect result profile ID');
        string(result.profile_key, code, 'effect result profile key');
        if (typeof result.matched !== 'boolean') fail(code, 'effect match result is not boolean');
        assertHex(result.predicate_result_digest, 64, code, 'effect predicate digest');
        const decisive = array(result.decisive_leaf_ids, code, 'effect decisive leaves');
        decisive.forEach((leafId) => string(leafId, code, 'effect decisive leaf'));
        unique(decisive, code, 'effect decisive leaves');
      }
      if (effect.selected_profile_id !== null) {
        string(effect.selected_profile_id, code, 'selected profile ID');
      }
      if (effect.selected_profile_key !== null) {
        string(effect.selected_profile_key, code, 'selected profile key');
      }
      if ((effect.selected_profile_id === null) !== (effect.selected_profile_key === null)) {
        fail(code, 'selected profile ID and key are inconsistent');
      }
      if (typeof effect.no_more_specific_descendant_match !== 'boolean') {
        fail(code, 'descendant-match result is not boolean');
      }
      if (effect.generic_level_output_authority !== null
          && !isObject(effect.generic_level_output_authority)) {
        fail(code, 'generic-level authority is not an object or null');
      }
      if (effects.has(effect.effect_id)) fail(code, 'effect appears in two candidate sets');
      effects.set(effect.effect_id, { candidateSet, effect });
    }
  }
  return { byAuthoredUnit, effects };
}

function containsTokenSequence(haystack, needle) {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
    if (needle.every((token, index) => haystack[offset + index] === token)) return true;
  }
  return false;
}

function decisiveLeafIds(kind, childResults, value) {
  if (kind === 'NOT') return childResults[0].decisive_leaf_ids;
  const selected = childResults.filter((child) => child.value === value);
  return selected.flatMap((child) => child.decisive_leaf_ids);
}

function evaluateMatchTest(test, context) {
  const leafResults = [];
  function visit(node) {
    if (['ALL', 'ANY', 'NOT'].includes(node.kind)) {
      const children = node.children.map(visit);
      const value = node.kind === 'ALL' ? children.every((child) => child.value)
        : node.kind === 'ANY' ? children.some((child) => child.value)
          : !children[0].value;
      return {
        value,
        decisive_leaf_ids: decisiveLeafIds(node.kind, children, value),
      };
    }
    let value;
    if (['SOURCE_TOKEN_SEQUENCE', 'SOURCE_TOKEN_ANY', 'SOURCE_TOKEN_ALL'].includes(node.kind)) {
      const words = node.scope === 'EFFECT_SOURCE_SPANS'
        ? context.effect_source_words : context.authored_unit_source_words;
      const requested = node.tokens.flatMap((token) => normalisedWords(token));
      if (requested.length !== node.tokens.length) {
        fail('M7_V2_PROFILE_GATE', `match leaf ${node.leaf_id} contains a non-atomic token`);
      }
      if (node.kind === 'SOURCE_TOKEN_SEQUENCE') value = containsTokenSequence(words, requested);
      else if (node.kind === 'SOURCE_TOKEN_ANY') value = requested.some((token) => words.includes(token));
      else value = requested.every((token) => words.includes(token));
    } else if (node.kind === 'INDEX_NODE_KIND') {
      value = context.node_kind === node.node_kind
        && same(context.ancestor_node_kinds, node.ancestor_node_kinds);
    } else if (node.kind === 'CONTEXT_EDGE') {
      value = context.context_edges.some((edge) => edge.state === 'RESOLVED'
        && edge.edge_type === node.edge_type && edge.target_id === node.target_id);
    } else if (node.kind === 'TYPED_FACT_EQUALS') {
      value = context.typed_facts.some((fact) => fact.field_key === node.field_key
        && fact.value_type === node.value_type && same(fact.typed_value, node.typed_value));
    } else {
      fail('M7_V2_PROFILE_GATE', 'unsupported match predicate reached evaluation');
    }
    leafResults.push({ leaf_id: node.leaf_id, result: value });
    return { value, decisive_leaf_ids: [node.leaf_id] };
  }
  const evaluated = visit(test);
  return {
    matched: evaluated.value,
    predicate_result_digest: sha256Hex(canonicalJson({
      matched: evaluated.value,
      leaf_results: leafResults,
    })),
    decisive_leaf_ids: [...new Set(evaluated.decisive_leaf_ids)],
    leaf_results: leafResults,
  };
}

function profileDepth(profileId, profiles) {
  let depth = 0;
  let current = profiles.get(profileId);
  const seen = new Set();
  while (current?.parent_profile_id !== null) {
    if (!current || seen.has(current.profile_id)) {
      fail('M7_V2_PROFILE_GATE', 'approved profile parentage is cyclic or incomplete');
    }
    seen.add(current.profile_id);
    current = profiles.get(current.parent_profile_id);
    depth += 1;
  }
  return depth;
}

function isProfileDescendant(candidateId, ancestorId, profiles) {
  let current = profiles.get(candidateId);
  const seen = new Set();
  while (current?.parent_profile_id !== null) {
    if (seen.has(current.profile_id)) {
      fail('M7_V2_PROFILE_GATE', 'approved profile parentage is cyclic');
    }
    seen.add(current.profile_id);
    if (current.parent_profile_id === ancestorId) return true;
    current = profiles.get(current.parent_profile_id);
  }
  return false;
}

function evaluateApprovedProfiles(profiles, context) {
  const profileResults = [];
  for (const profile of profiles.values()) {
    const evaluated = evaluateMatchTest(profile.match_test, context);
    profileResults.push({
      profile_id: profile.profile_id,
      profile_key: profile.profile_key,
      matched: evaluated.matched,
      predicate_result_digest: evaluated.predicate_result_digest,
      decisive_leaf_ids: evaluated.decisive_leaf_ids,
    });
  }
  const matchedIds = profileResults.filter((result) => result.matched)
    .map((result) => result.profile_id);
  const mostSpecific = matchedIds.filter((profileId) => !matchedIds.some(
    (candidateId) => candidateId !== profileId
      && isProfileDescendant(candidateId, profileId, profiles),
  )).sort((left, right) => profileDepth(right, profiles) - profileDepth(left, profiles)
    || left.localeCompare(right));
  const selectedProfileId = mostSpecific.length === 1 ? mostSpecific[0] : null;
  const selectedProfileKey = selectedProfileId === null
    ? null : profiles.get(selectedProfileId).profile_key;
  return {
    profile_results: profileResults,
    selected_profile_id: selectedProfileId,
    selected_profile_key: selectedProfileKey,
    no_more_specific_descendant_match: selectedProfileId !== null,
    profile_match_state: matchedIds.length === 0 ? 'NO_COMPATIBLE_PROFILE'
      : selectedProfileId === null ? 'AMBIGUOUS_PROFILE_MATCH' : 'EXACT_ONE_MOST_SPECIFIC',
  };
}

function ancestorNodeKinds(sourceNode, agreementIndex) {
  const nodes = indexBy(array(agreementIndex.nodes, 'M7_V2_PROFILE_GATE', 'agreement index nodes'),
    'node_occurrence_id', 'M7_V2_PROFILE_GATE', 'agreement index node');
  const result = [];
  const seen = new Set([sourceNode.node_occurrence_id]);
  let parentId = sourceNode.parent_node_occurrence_id;
  while (parentId !== null) {
    if (seen.has(parentId)) fail('M7_V2_PROFILE_GATE', 'AgreementIndex parentage is cyclic');
    seen.add(parentId);
    const parent = nodes.get(parentId);
    if (!parent) fail('M7_V2_PROFILE_GATE', 'AgreementIndex parentage is incomplete');
    result.push(string(parent.node_kind, 'M7_V2_PROFILE_GATE', 'ancestor node kind'));
    parentId = parent.parent_node_occurrence_id;
  }
  return result;
}

function effectLocalDependencyIds(effect, closure, sources, facts, ownershipLinks, rules) {
  const effectSpanIds = new Set(effect.source_span_ids);
  const dependencyIds = new Set(closure.required_dependency_ids.filter((dependencyId) => {
    const dependency = sources.dependencies.get(dependencyId);
    return dependency?.source_support_ids.length > 0
      && dependency.source_support_ids.every((spanId) => effectSpanIds.has(spanId));
  }));
  for (const factId of effect.fact_ids) {
    const fact = facts.get(factId);
    if (fact) fact.dependency_ids.forEach((dependencyId) => dependencyIds.add(dependencyId));
  }
  for (const link of ownershipLinks.values()) {
    if (rules.get(link.consumer_rule_id)?.effect_id === effect.effect_id) {
      link.consumer_dependency_ids.forEach((dependencyId) => dependencyIds.add(dependencyId));
    }
  }
  return dependencyIds;
}

function matcherContextForEffect(
  effect, candidateSet, sources, facts, semanticInputs, ownershipLinks, rules,
) {
  const closure = sources.closures.get(candidateSet.source_closure_id);
  if (!closure || closure.authored_unit_id !== candidateSet.authored_unit_id) {
    fail('M7_V2_PROFILE_GATE', 'candidate set source closure is inconsistent');
  }
  if (effect.source_span_ids.some(
    (spanId) => sources.closureBySpan.get(spanId) !== closure.source_closure_id,
  )) fail('M7_V2_PROFILE_GATE', 'candidate effect source falls outside its authored unit');
  const sourceNode = sources.sourceNodeByClosure.get(closure.source_closure_id);
  const agreementIndex = sources.agreementIndexByClosure.get(closure.source_closure_id);
  const effectSource = sourceTextForSpanIds(
    effect.source_span_ids, sources, 'M7_V2_PROFILE_GATE', 'candidate effect',
  );
  const fullSource = sources.sourceBytesByClosure.get(closure.source_closure_id)
    .subarray(closure.governing_start_byte, closure.governing_end_byte).toString('utf8');
  const typedFacts = effect.fact_ids.map((factId) => {
    const fact = facts.get(factId);
    if (!fact) fail('M7_V2_PROFILE_GATE', 'candidate effect cites an unknown fact');
    return { field_key: fact.field_key, value_type: fact.value_type, typed_value: fact.typed_value };
  });
  const contextEdgeIds = new Set();
  for (const factId of effect.fact_ids) {
    const fact = facts.get(factId);
    for (const edgeId of fact.normalisation_proof.input_context_edge_ids) {
      contextEdgeIds.add(edgeId);
    }
  }
  for (const dependencyId of effectLocalDependencyIds(
    effect, closure, sources, facts, ownershipLinks, rules,
  )) {
    const dependency = sources.dependencies.get(dependencyId);
    if (dependency) contextEdgeIds.add(dependency.context_edge_id);
  }
  return {
    authored_unit_source_words: normalisedWords(fullSource),
    effect_source_words: normalisedWords(effectSource),
    node_kind: string(sourceNode.node_kind, 'M7_V2_PROFILE_GATE', 'source node kind'),
    ancestor_node_kinds: ancestorNodeKinds(sourceNode, agreementIndex),
    context_edges: [...contextEdgeIds].map((edgeId) => {
      const edge = semanticInputs.contextEdges.get(edgeId);
      if (!edge) fail('M7_V2_PROFILE_GATE', 'candidate effect context edge is absent');
      return edge;
    }),
    typed_facts: typedFacts,
  };
}

function validateFixtureRecord(record, proof, code = 'M7_V2_PROFILE_FIXTURE') {
  exactKeys(record, [
    'schema_version', 'match_fixture_id', 'fixture_id', 'input_occurrence_id',
    'authored_unit_source_text', 'effect_source_text', 'node_kind',
    'ancestor_node_kinds', 'context_edges', 'typed_facts',
    'expected_material_field_keys', 'expected_dependency_backed_field_keys',
    'expected_conditional_requirement_ids', 'expected_child_rule_requirement_ids',
    'expected_excluded_dimension_keys', 'expected_delegated_dimension_keys',
  ], code, 'match fixture');
  string(record.fixture_id, code, 'fixture ID');
  string(record.input_occurrence_id, code, 'fixture input occurrence ID');
  if (record.schema_version !== MATCH_FIXTURE_SCHEMA
      || record.fixture_id !== proof.fixture_id
      || record.input_occurrence_id !== proof.input_occurrence_id) {
    fail(code, 'fixture identity differs from its approved proof');
  }
  const contextEdges = array(record.context_edges, code, 'fixture context edges');
  for (const edge of contextEdges) {
    exactKeys(edge, ['edge_type', 'target_id', 'state'], code, 'fixture context edge');
    string(edge.edge_type, code, 'fixture context edge type');
    if (edge.target_id !== null) string(edge.target_id, code, 'fixture context edge target');
    if (!['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(edge.state)) {
      fail(code, 'fixture context edge state is invalid');
    }
  }
  const typedFacts = array(record.typed_facts, code, 'fixture typed facts');
  for (const fact of typedFacts) {
    exactKeys(fact, [
      'field_key', 'value_type', 'typed_value', 'materiality', 'dependency_types',
    ], code, 'fixture typed fact');
    string(fact.field_key, code, 'fixture field key');
    if (!FACT_VALUE_TYPES.includes(fact.value_type)
        || !['MATERIAL', 'NON_MATERIAL'].includes(fact.materiality)) {
      fail(code, 'fixture fact type or materiality is invalid');
    }
    canonicalStringSet(fact.dependency_types, code, 'fixture fact dependency types');
    validateTypedValue({
      fact_id: `${record.fixture_id}:${fact.field_key}`,
      atomicity: 'ATOMIC_TYPED_VALUE',
      value_type: fact.value_type,
      typed_value: fact.typed_value,
    });
  }
  unique(typedFacts.map((fact) => fact.field_key), code, 'fixture typed fact fields');
  canonicalStringSet(record.expected_material_field_keys, code,
    'fixture expected material fields');
  canonicalStringSet(record.expected_dependency_backed_field_keys, code,
    'fixture expected dependency-backed fields');
  canonicalStringSet(record.expected_conditional_requirement_ids, code,
    'fixture expected conditional requirements');
  canonicalStringSet(record.expected_child_rule_requirement_ids, code,
    'fixture expected child-rule requirements');
  canonicalStringSet(record.expected_excluded_dimension_keys, code,
    'fixture expected excluded dimensions');
  canonicalStringSet(record.expected_delegated_dimension_keys, code,
    'fixture expected delegated dimensions');
  const ancestors = array(record.ancestor_node_kinds, code, 'fixture ancestor kinds');
  ancestors.forEach((kind) => string(kind, code, 'fixture ancestor kind'));
  return {
    authored_unit_source_words: normalisedWords(string(
      record.authored_unit_source_text, code, 'fixture authored-unit source',
    )),
    effect_source_words: normalisedWords(string(
      record.effect_source_text, code, 'fixture effect source',
    )),
    node_kind: string(record.node_kind, code, 'fixture node kind'),
    ancestor_node_kinds: ancestors,
    context_edges: contextEdges,
    typed_facts: typedFacts,
  };
}

function validateProfileFixtures(profiles, resolveBinding, semanticInputs) {
  const code = 'M7_V2_PROFILE_FIXTURE';
  const evaluatedBindings = new Map();
  for (const profile of profiles.values()) {
    for (const proof of profile.fixture_proofs) {
      const bindingKey = canonicalJson(proof.fixture_binding);
      let fixture = evaluatedBindings.get(bindingKey)?.fixture;
      let evaluated = evaluatedBindings.get(bindingKey)?.evaluated;
      const cachedBinding = evaluatedBindings.get(bindingKey)?.binding;
      if (cachedBinding && !same(cachedBinding, proof.fixture_binding)) {
        fail(code, 'one package member carries two different byte bindings');
      }
      if (!fixture) {
        fixture = resolvePackageMemberBinding(
          proof.fixture_binding, semanticInputs.packageRegistry, 'match_fixtures',
          `match fixture ${proof.fixture_id}`, code,
        );
        const context = validateFixtureRecord(fixture, proof);
        evaluated = evaluateApprovedProfiles(profiles, context);
        evaluatedBindings.set(bindingKey, {
          binding: proof.fixture_binding, fixture, evaluated,
        });
      } else if (fixture.fixture_id !== proof.fixture_id
          || fixture.input_occurrence_id !== proof.input_occurrence_id) {
        fail(code, 'one fixture binding is claimed as two fixture identities');
      }
      const result = evaluated.profile_results.find(
        (entry) => entry.profile_id === profile.profile_id,
      );
      if (!result || result.matched !== proof.expected_match
          || evaluated.selected_profile_key !== proof.expected_selected_profile_key
          || result.predicate_result_digest !== proof.expected_predicate_result_digest
          || !same(result.decisive_leaf_ids, proof.decisive_leaf_ids)) {
        fail(code, `fixture ${proof.fixture_id} does not prove its approved expectation`);
      }
      if (!hasApprovedProfileAuthority(profile, proof.lawyer_ruling_id, semanticInputs)) {
        fail(code, `fixture ${proof.fixture_id} lacks an exact approved family authority`);
      }
    }
  }
  return evaluatedBindings;
}

function validateEffectProfileMatches(
  candidates, profiles, sources, facts, semanticInputs, ownershipLinks, rules,
) {
  const code = 'M7_V2_PROFILE_GATE';
  const matches = new Map();
  if (candidates.byAuthoredUnit.size !== sources.closures.size
      || [...sources.closures.values()].some((closure) => (
        candidates.byAuthoredUnit.get(closure.authored_unit_id)?.source_closure_id
          !== closure.source_closure_id
      ))) fail(code, 'source closures and authored-unit candidate sets are not one-to-one');
  for (const { candidateSet, effect } of candidates.effects.values()) {
    if (candidateSet.source_closure_id
        !== sources.closures.get(candidateSet.source_closure_id)?.source_closure_id) {
      fail(code, 'candidate source closure is absent');
    }
    const expected = evaluateApprovedProfiles(
      profiles, matcherContextForEffect(
        effect, candidateSet, sources, facts, semanticInputs, ownershipLinks, rules,
      ),
    );
    if (!same(effect.profile_results, expected.profile_results)
        || effect.selected_profile_id !== expected.selected_profile_id
        || effect.selected_profile_key !== expected.selected_profile_key
        || effect.no_more_specific_descendant_match
          !== expected.no_more_specific_descendant_match) {
      fail(code, `candidate effect ${effect.effect_id} contains a false profile match`);
    }
    matches.set(effect.effect_id, expected);
  }
  return matches;
}

function structureMarkerEvidenceId(agreementIndexId, markerSpan) {
  return contentId('STAGE_2Y_M7_V2_STRUCTURE_MARKER_EVIDENCE/V1', {
    agreement_index_id: agreementIndexId,
    start_byte: markerSpan.start_byte,
    end_byte: markerSpan.end_byte,
    text_sha256: markerSpan.text_sha256,
  });
}

function validateStructureCandidateTreeShape(tree, code) {
  exactKeys(tree, [
    'schema_version', 'candidate_tree_id', 'nodes', 'constraint_results', 'tree_state',
  ], code, 'structure candidate tree');
  if (tree.schema_version !== STRUCTURE_CANDIDATE_TREE_SCHEMA) {
    fail(code, 'structure candidate tree schema is invalid');
  }
  const unsignedTree = { ...tree };
  delete unsignedTree.candidate_tree_id;
  if (tree.candidate_tree_id !== contentId(STRUCTURE_CANDIDATE_TREE_SCHEMA, unsignedTree)) {
    fail(code, 'structure candidate tree content identity is invalid');
  }
  const nodes = array(tree.nodes, code, 'structure candidate-tree nodes');
  if (nodes.length === 0) fail(code, 'structure candidate tree is empty');
  for (const node of nodes) {
    exactKeys(node, [
      'marker_span', 'marker_text', 'source_disposition_id', 'parent_key',
      'sibling_ordinal', 'depth',
    ], code, 'structure candidate-tree node');
    exactKeys(node.marker_span, [
      'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
    ], code, 'structure candidate-tree marker span');
    string(node.marker_text, code, 'structure candidate-tree marker text');
    assertHex(node.source_disposition_id, 64, code,
      'structure candidate-tree source disposition ID');
    string(node.parent_key, code, 'structure candidate-tree parent key');
    if (!Number.isInteger(node.sibling_ordinal) || node.sibling_ordinal < 0
        || !Number.isInteger(node.depth) || node.depth < 1) {
      fail(code, 'structure candidate-tree ordinal or depth is invalid');
    }
  }
  const expectedConstraintIds = [
    'BOUND_PARENT_CONTAINMENT',
    'DOCUMENT_ORDER',
    'CONTIGUOUS_SIBLING_SEQUENCE',
    'LABEL_SEQUENCE_PER_PARENT',
  ];
  const results = array(tree.constraint_results, code,
    'structure candidate-tree constraint results');
  if (!same(results.map((result) => result.constraint_id), expectedConstraintIds)) {
    fail(code, 'structure candidate-tree constraints are not the closed ordered set');
  }
  for (const result of results) {
    exactKeys(result, ['constraint_id', 'status', 'evidence_span_ids'], code,
      'structure candidate-tree constraint');
    if (!['PASS', 'FAIL'].includes(result.status)) {
      fail(code, 'structure candidate-tree constraint status is invalid');
    }
    const evidenceIds = array(result.evidence_span_ids, code,
      'structure candidate-tree evidence span IDs');
    evidenceIds.forEach((value) => assertHex(value, 64, code,
      'structure candidate-tree evidence span ID'));
    unique(evidenceIds, code, 'structure candidate-tree evidence span IDs');
  }
  if (!['PASS_PARENT_SCOPING', 'REJECTED_PARENT_SCOPING'].includes(tree.tree_state)) {
    fail(code, 'structure candidate-tree state is invalid');
  }
  return tree.candidate_tree_id;
}

function outlineLabelValue(markerText) {
  const label = /^\(([A-Za-z]{1,5}|[0-9]{1,3})\)$|^([A-Za-z]{1,5}|[0-9]{1,3})[.)]$/u
    .exec(markerText);
  const selected = label?.[1] ?? label?.[2] ?? null;
  if (selected === null) return null;
  if (/^[0-9]{1,3}$/u.test(selected)) return { style: 'DIGIT', value: Number(selected) };
  const lower = selected.toLowerCase();
  const romans = [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
  ];
  const romanIndex = romans.indexOf(lower);
  if (romanIndex >= 0
      && (/^[a-z]+$/u.test(selected) || /^[A-Z]+$/u.test(selected))) {
    return { style: /^[A-Z]+$/u.test(selected) ? 'ROMAN_UPPER' : 'ROMAN_LOWER', value: romanIndex };
  }
  if (/^[A-Za-z]$/u.test(selected)) {
    return {
      style: /^[A-Z]$/u.test(selected) ? 'ALPHA_UPPER' : 'ALPHA_LOWER',
      value: lower.charCodeAt(0) - 97,
    };
  }
  if ((/^[a-z]{2}$/u.test(selected) || /^[A-Z]{2}$/u.test(selected))
      && lower[0] === lower[1]) {
    return {
      style: /^[A-Z]{2}$/u.test(selected) ? 'ALPHA_UPPER' : 'ALPHA_LOWER',
      value: 26 + lower.charCodeAt(0) - 97,
    };
  }
  return null;
}

function firstOutlineLabelValue(label) {
  return label.style === 'DIGIT' ? 1 : 0;
}

function evaluateStructureCandidateTree(tree, context, code) {
  validateStructureCandidateTreeShape(tree, code);
  const nodes = tree.nodes;
  const evidenceIds = nodes.map((node) => structureMarkerEvidenceId(
    context.agreementIndex.agreement_index_id, node.marker_span,
  ));
  const exactMarkerSet = same(nodes.map((node) => ({
    marker_span: node.marker_span,
    source_disposition_id: node.source_disposition_id,
  })), context.requiredMarkerEvidence);
  const exactMarkerBytes = nodes.every((node) => node.marker_text
    === context.sourceBytes.subarray(
      node.marker_span.start_byte, node.marker_span.end_byte,
    ).toString('utf8'));
  const nodesByMarkerKey = new Map(nodes.map((node) => [
    `MARKER:${node.marker_span.start_byte}:${node.marker_span.end_byte}`, node,
  ]));
  const parentContainment = exactMarkerSet && exactMarkerBytes && nodes.every((node) => {
    if (node.parent_key === `SEALED_PARENT:${context.parentNodeId}`) return node.depth === 1;
    const parent = nodesByMarkerKey.get(node.parent_key);
    return parent !== undefined
      && parent.marker_span.start_byte < node.marker_span.start_byte
      && parent.marker_span.end_byte <= node.marker_span.start_byte
      && node.depth === parent.depth + 1;
  });
  const documentOrder = nodes.every((node, index) => index === 0
    || nodes[index - 1].marker_span.start_byte < node.marker_span.start_byte);
  const byParent = new Map();
  for (const node of nodes) {
    if (!byParent.has(node.parent_key)) byParent.set(node.parent_key, []);
    byParent.get(node.parent_key).push(node);
  }
  const contiguousSiblings = [...byParent.values()].every((siblings) => siblings.every(
    (node, index) => node.sibling_ordinal === index,
  ));
  const labelSequence = [...byParent.values()].every((siblings) => {
    const labels = siblings.map((node) => outlineLabelValue(node.marker_text));
    return labels.every((label) => label !== null)
      && labels[0].value === firstOutlineLabelValue(labels[0])
      && labels.every((label, index) => index === 0
        || (label.style === labels[index - 1].style
          && label.value === labels[index - 1].value + 1));
  });
  const values = [parentContainment, documentOrder, contiguousSiblings, labelSequence];
  const expectedResults = [
    'BOUND_PARENT_CONTAINMENT',
    'DOCUMENT_ORDER',
    'CONTIGUOUS_SIBLING_SEQUENCE',
    'LABEL_SEQUENCE_PER_PARENT',
  ].map((constraintId, index) => ({
    constraint_id: constraintId,
    status: values[index] ? 'PASS' : 'FAIL',
    evidence_span_ids: evidenceIds,
  }));
  const expectedState = values.every(Boolean)
    ? 'PASS_PARENT_SCOPING' : 'REJECTED_PARENT_SCOPING';
  if (!same(tree.constraint_results, expectedResults) || tree.tree_state !== expectedState) {
    fail(code, `structure candidate tree ${tree.candidate_tree_id} has false constraints`);
  }
  return expectedState;
}

function candidateParentIndex(depths, nodeIndex) {
  if (depths[nodeIndex] === 1) return -1;
  for (let index = nodeIndex - 1; index >= 0; index -= 1) {
    if (depths[index] === depths[nodeIndex] - 1) return index;
  }
  return null;
}

function enumerateMaterialRepeatDepthSequences(requiredMarkerEvidence, sourceBytes, code) {
  const labels = requiredMarkerEvidence.map((evidence) => outlineLabelValue(
    sourceBytes.subarray(
      evidence.marker_span.start_byte, evidence.marker_span.end_byte,
    ).toString('utf8'),
  ));
  if (labels.length === 0 || labels.some((label) => label === null)) {
    fail(code, 'structure marker evidence contains an unsupported outline label');
  }
  if (labels[0].value !== firstOutlineLabelValue(labels[0])) {
    fail(code, 'structure marker sequence does not begin at the first label');
  }
  let candidates = [[1]];
  for (let nodeIndex = 1; nodeIndex < labels.length; nodeIndex += 1) {
    const label = labels[nodeIndex];
    const next = [];
    for (const depths of candidates) {
      const previousDepth = depths[depths.length - 1];
      for (let depth = 1; depth <= previousDepth + 1; depth += 1) {
        const proposedDepths = [...depths, depth];
        const parentIndex = candidateParentIndex(proposedDepths, nodeIndex);
        if (parentIndex === null) continue;
        const directChildren = [];
        for (let priorIndex = 0; priorIndex < nodeIndex; priorIndex += 1) {
          if (candidateParentIndex(proposedDepths, priorIndex) === parentIndex) {
            directChildren.push(priorIndex);
          }
        }
        const lastChildIndex = directChildren[directChildren.length - 1] ?? null;
        const lastChildLabel = lastChildIndex === null ? null : labels[lastChildIndex];
        const continuesSequence = lastChildLabel !== null
          && lastChildLabel.style === label.style
          && label.value === lastChildLabel.value + 1;
        const isFirstLabel = label.value === firstOutlineLabelValue(label);
        const startsNestedSequence = isFirstLabel && parentIndex === nodeIndex - 1;
        const restartsKnownSequence = isFirstLabel && directChildren.some(
          (childIndex) => labels[childIndex].style === label.style,
        );
        if (continuesSequence || startsNestedSequence || restartsKnownSequence) {
          next.push(proposedDepths);
        }
      }
    }
    const uniqueCandidates = new Map(next.map((depths) => [depths.join(','), depths]));
    candidates = [...uniqueCandidates.values()];
    if (candidates.length === 0) {
      fail(code, 'structure marker sequence has no material parent-scoped reading');
    }
  }
  return candidates;
}

function materialiseStructureCandidateTree(depths, context, code) {
  const parentCounts = new Map();
  const nodes = context.requiredMarkerEvidence.map((evidence, index) => {
    const depth = depths[index];
    let parentKey;
    if (depth === 1) {
      parentKey = `SEALED_PARENT:${context.parentNodeId}`;
    } else {
      let parentIndex = index - 1;
      while (parentIndex >= 0 && depths[parentIndex] !== depth - 1) parentIndex -= 1;
      if (parentIndex < 0) fail(code, 'Catalan candidate lacks its preceding parent');
      const parentSpan = context.requiredMarkerEvidence[parentIndex].marker_span;
      parentKey = `MARKER:${parentSpan.start_byte}:${parentSpan.end_byte}`;
    }
    const siblingOrdinal = parentCounts.get(parentKey) ?? 0;
    parentCounts.set(parentKey, siblingOrdinal + 1);
    const markerSpan = evidence.marker_span;
    return {
      marker_span: markerSpan,
      marker_text: context.sourceBytes.subarray(
        markerSpan.start_byte, markerSpan.end_byte,
      ).toString('utf8'),
      source_disposition_id: evidence.source_disposition_id,
      parent_key: parentKey,
      sibling_ordinal: siblingOrdinal,
      depth,
    };
  });
  const evidenceSpanIds = nodes.map((node) => structureMarkerEvidenceId(
    context.agreementIndex.agreement_index_id, node.marker_span,
  ));
  const siblingsByParent = new Map();
  for (const node of nodes) {
    if (!siblingsByParent.has(node.parent_key)) siblingsByParent.set(node.parent_key, []);
    siblingsByParent.get(node.parent_key).push(node);
  }
  const labelSequencePasses = [...siblingsByParent.values()].every((siblings) => {
    const labels = siblings.map((node) => outlineLabelValue(node.marker_text));
    return labels.every((label) => label !== null)
      && labels[0].value === firstOutlineLabelValue(labels[0])
      && labels.every((label, index) => index === 0
        || (label.style === labels[index - 1].style
          && label.value === labels[index - 1].value + 1));
  });
  const constraintResults = [
    ['BOUND_PARENT_CONTAINMENT', true],
    ['DOCUMENT_ORDER', true],
    ['CONTIGUOUS_SIBLING_SEQUENCE', true],
    ['LABEL_SEQUENCE_PER_PARENT', labelSequencePasses],
  ].map(([constraint_id, status]) => ({
    constraint_id,
    status: status ? 'PASS' : 'FAIL',
    evidence_span_ids: evidenceSpanIds,
  }));
  const treeState = labelSequencePasses
    ? 'PASS_PARENT_SCOPING' : 'REJECTED_PARENT_SCOPING';
  const unsigned = {
    schema_version: STRUCTURE_CANDIDATE_TREE_SCHEMA,
    nodes,
    constraint_results: constraintResults,
    tree_state: treeState,
  };
  return {
    schema_version: STRUCTURE_CANDIDATE_TREE_SCHEMA,
    candidate_tree_id: contentId(STRUCTURE_CANDIDATE_TREE_SCHEMA, unsigned),
    nodes,
    constraint_results: constraintResults,
    tree_state: treeState,
  };
}

function validateNativeStructureEvidence(agreementIndex, sourceBytes, code) {
  const nodes = new Map(array(agreementIndex.nodes, code,
    'AgreementIndex nodes').map((node) => [node.node_occurrence_id, node]));
  const ambiguities = new Map();
  for (const ambiguity of array(agreementIndex.ambiguities, code,
    'AgreementIndex ambiguities')) {
    exactKeys(ambiguity, [
      'schema_version', 'ambiguity_id', 'ambiguity_type', 'status',
      'node_occurrence_ids', 'span', 'detail',
    ], code, 'AgreementIndex structure ambiguity');
    const unsignedAmbiguity = { ...ambiguity };
    delete unsignedAmbiguity.ambiguity_id;
    exactKeys(ambiguity.span, [
      'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
    ], code, 'AgreementIndex ambiguity span');
    const occurrenceIds = array(ambiguity.node_occurrence_ids, code,
      'AgreementIndex ambiguity node occurrences');
    occurrenceIds.forEach((value) => string(value, code,
      'AgreementIndex ambiguity node occurrence'));
    unique(occurrenceIds, code, 'AgreementIndex ambiguity node occurrences');
    if (ambiguity.schema_version !== 'AGREEMENT_STRUCTURE_AMBIGUITY/V1'
        || ambiguity.ambiguity_id !== contentId(
          'AGREEMENT_STRUCTURE_AMBIGUITY/V1', unsignedAmbiguity,
        )
        || !['OPEN', 'RESOLVED'].includes(ambiguity.status)
        || ambiguity.span.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
        || !Number.isInteger(ambiguity.span.start_byte)
        || !Number.isInteger(ambiguity.span.end_byte)
        || ambiguity.span.start_byte < 0
        || ambiguity.span.end_byte <= ambiguity.span.start_byte
        || ambiguity.span.end_byte > sourceBytes.length
        || ambiguity.span.text_sha256 !== sha256Hex(sourceBytes.subarray(
          ambiguity.span.start_byte, ambiguity.span.end_byte,
        ))
        || occurrenceIds.some((occurrenceId) => !nodes.has(occurrenceId))
        || !isObject(ambiguity.detail)) {
      fail(code, 'AgreementIndex structure ambiguity evidence is invalid');
    }
    if (ambiguities.has(ambiguity.ambiguity_id)) {
      fail(code, 'AgreementIndex repeats a structure ambiguity ID');
    }
    ambiguities.set(ambiguity.ambiguity_id, ambiguity);
  }
  const dispositions = new Map();
  for (const disposition of array(agreementIndex.inline_marker_dispositions, code,
    'AgreementIndex inline-marker dispositions')) {
    exactKeys(disposition, [
      'schema_version', 'disposition_id', 'disposition', 'reason', 'style', 'depth',
      'parent_node_occurrence_id', 'marker_spans', 'produced_limb_node_occurrence_ids',
    ], code, 'AgreementIndex inline-marker disposition');
    const unsignedDisposition = { ...disposition };
    delete unsignedDisposition.disposition_id;
    const markerSpans = array(disposition.marker_spans, code,
      'AgreementIndex disposition marker spans');
    const producedLimbIds = array(disposition.produced_limb_node_occurrence_ids, code,
      'AgreementIndex produced limb IDs');
    if (disposition.schema_version !== 'AGREEMENT_INLINE_MARKER_DISPOSITION/V1'
        || disposition.disposition_id !== contentId(
          'AGREEMENT_INLINE_MARKER_DISPOSITION/V1', unsignedDisposition,
        )
        || !['AUTHORED_INLINE_LIST', 'NON_STRUCTURAL_MARKER',
          'UNRESOLVED_INLINE_LIST'].includes(disposition.disposition)
        || typeof disposition.reason !== 'string' || disposition.reason.length === 0
        || typeof disposition.style !== 'string' || disposition.style.length === 0
        || (disposition.depth !== null
          && (!Number.isInteger(disposition.depth) || disposition.depth < 1))
        || !nodes.has(disposition.parent_node_occurrence_id)
        || markerSpans.length === 0
        || (disposition.disposition === 'AUTHORED_INLINE_LIST'
          ? markerSpans.length < 2 || producedLimbIds.length !== markerSpans.length
          : producedLimbIds.length !== 0)) {
      fail(code, 'AgreementIndex inline-marker disposition evidence is invalid');
    }
    for (let index = 0; index < markerSpans.length; index += 1) {
      const markerSpan = markerSpans[index];
      exactKeys(markerSpan, [
        'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
      ], code, 'AgreementIndex disposition marker span');
      if (markerSpan.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
          || !Number.isInteger(markerSpan.start_byte)
          || !Number.isInteger(markerSpan.end_byte)
          || markerSpan.start_byte < 0 || markerSpan.end_byte <= markerSpan.start_byte
          || markerSpan.end_byte > sourceBytes.length
          || markerSpan.text_sha256 !== sha256Hex(sourceBytes.subarray(
            markerSpan.start_byte, markerSpan.end_byte,
          ))) {
        fail(code, 'AgreementIndex disposition marker span is invalid');
      }
      if (disposition.disposition === 'AUTHORED_INLINE_LIST') {
        const limb = nodes.get(producedLimbIds[index]);
        if (!limb || limb.node_kind !== 'LIMB'
            || !Array.isArray(limb.roles) || !limb.roles.includes('AUTHORED_INLINE_LIMB')
            || limb.parent_node_occurrence_id !== disposition.parent_node_occurrence_id
            || !isObject(limb.extent_span)
            || limb.extent_span.start_byte > markerSpan.start_byte
            || limb.extent_span.end_byte < markerSpan.end_byte) {
          fail(code, 'AgreementIndex authored inline-list limb evidence is invalid');
        }
      }
    }
    if (dispositions.has(disposition.disposition_id)) {
      fail(code, 'AgreementIndex repeats an inline-marker disposition ID');
    }
    dispositions.set(disposition.disposition_id, disposition);
  }
  return { nodes, ambiguities, dispositions };
}

function validateGlobalItem39OverlayEvidence(member, agreementIndex, code) {
  const overlay = member.inline_list_overlay;
  const sourceBytes = Buffer.from(string(agreementIndex.source_binding?.canonical_text, code,
    'item-39 canonical source'), 'utf8');
  const native = validateNativeStructureEvidence(agreementIndex, sourceBytes, code);
  const ambiguity = native.ambiguities.get(overlay.sealed_ambiguity_id);
  const unresolved = native.dispositions.get(overlay.inline_marker_disposition_id);
  if (!ambiguity || ambiguity.ambiguity_type !== 'UNRESOLVED_INLINE_LIST'
      || ambiguity.status !== 'OPEN'
      || !same(ambiguity.span, overlay.sealed_ambiguity_span)
      || ambiguity.node_occurrence_ids.length !== 1
      || ambiguity.node_occurrence_ids[0] !== overlay.parent_node_occurrence_id
      || ambiguity.detail.inline_marker_disposition_id
        !== overlay.inline_marker_disposition_id
      || ambiguity.detail.reason !== 'AMBIGUOUS_SAME_STYLE_RESTART'
      || !unresolved || unresolved.disposition !== 'UNRESOLVED_INLINE_LIST'
      || unresolved.reason !== ambiguity.detail.reason
      || unresolved.style !== 'romanLower'
      || unresolved.parent_node_occurrence_id !== overlay.parent_node_occurrence_id
      || unresolved.produced_limb_node_occurrence_ids.length !== 0) {
    fail(code, 'item-39 overlay differs from its exact native M2 ambiguity');
  }
  const parentNode = native.nodes.get(overlay.parent_node_occurrence_id);
  let ancestor = parentNode?.parent_node_occurrence_id === null
    ? null : native.nodes.get(parentNode?.parent_node_occurrence_id);
  while (ancestor && ancestor.reference === null) {
    ancestor = ancestor.parent_node_occurrence_id === null
      ? null : native.nodes.get(ancestor.parent_node_occurrence_id);
  }
  if (!parentNode || !ancestor || ancestor.reference !== overlay.parent_reference) {
    fail(code, 'item-39 overlay parent reference is absent from the native ancestor chain');
  }
  const structuralDispositions = overlay.marker_eligibility
    .structural_candidate_disposition_ids.map((dispositionId) =>
      native.dispositions.get(dispositionId));
  const excludedDispositions = overlay.marker_eligibility
    .excluded_glued_reference_disposition_ids.map((dispositionId) =>
      native.dispositions.get(dispositionId));
  const [romanDisposition, upperADisposition, upperBDisposition] = structuralDispositions;
  if (!romanDisposition || romanDisposition.disposition_id !== ITEM39_DISPOSITION_ID
      || romanDisposition.disposition !== 'UNRESOLVED_INLINE_LIST'
      || !upperADisposition || upperADisposition.disposition !== 'NON_STRUCTURAL_MARKER'
      || upperADisposition.reason !== 'UNCORROBORATED_FIRST_MARKER'
      || !upperBDisposition || upperBDisposition.disposition !== 'NON_STRUCTURAL_MARKER'
      || upperBDisposition.reason !== 'AMBIGUOUS_MARKER_STYLE'
      || excludedDispositions.some((entry) => !entry
        || entry.disposition !== 'NON_STRUCTURAL_MARKER'
        || entry.reason !== 'GLUED_SECTION_REFERENCE')) {
    fail(code, 'item-39 marker eligibility differs from the native M2 dispositions');
  }
  const requiredMarkerEvidence = structuralDispositions
    .flatMap((entry) => entry.marker_spans.map((markerSpan) => ({
      marker_span: markerSpan,
      source_disposition_id: entry.disposition_id,
    })))
    .sort((left, right) => left.marker_span.start_byte - right.marker_span.start_byte);
  if (requiredMarkerEvidence.length !== 6
      || excludedDispositions.flatMap((entry) => entry.marker_spans).some(
        (excludedSpan) => requiredMarkerEvidence.some(
          (evidence) => same(evidence.marker_span, excludedSpan),
        ),
      )) {
    fail(code, 'item-39 overlay does not partition six structural and two glued markers');
  }
  const candidateContext = {
    agreementIndex,
    sourceBytes,
    requiredMarkerEvidence,
    parentNodeId: overlay.parent_node_occurrence_id,
  };
  const expectedCandidateTrees = enumerateMaterialRepeatDepthSequences(
    requiredMarkerEvidence, sourceBytes, code,
  ).map((depths) => materialiseStructureCandidateTree(depths, candidateContext, code));
  overlay.candidate_trees.forEach((tree) => evaluateStructureCandidateTree(
    tree, candidateContext, code,
  ));
  const passingTrees = expectedCandidateTrees.filter(
    (tree) => tree.tree_state === 'PASS_PARENT_SCOPING',
  );
  if (!same(overlay.candidate_trees, expectedCandidateTrees)
      || expectedCandidateTrees.length !== 2 || passingTrees.length !== 1
      || overlay.selected_candidate_tree_id !== passingTrees[0].candidate_tree_id) {
    fail(code, 'item-39 overlay candidate set or unique selection is false');
  }
  return { agreementIndex, sourceBytes, native, requiredMarkerEvidence };
}

function validateAmbiguousRepeatOverlayFixture(
  fixture, resolveBinding, expectedParentRule, governedSpan, code,
  authorityItem39Contract = null,
) {
  const syntheticContract = authorityItem39Contract?.synthetic_ambiguous_repeat_source;
  const expectedMemberBinding = authorityItem39Contract
    ?.ambiguous_repeat_fixture_member_binding ?? AMBIGUOUS_REPEAT_MEMBER_BINDING;
  const expectedIndexBinding = syntheticContract?.agreement_index_binding
    ?? AMBIGUOUS_REPEAT_INDEX_BINDING;
  const expectedFixtureId = expectedMemberBinding.member_record_id
    ?? AMBIGUOUS_REPEAT_FIXTURE_ID;
  const expectedAmbiguityId = syntheticContract?.ambiguity_id
    ?? AMBIGUOUS_REPEAT_AMBIGUITY_ID;
  const expectedOutputDisposition = syntheticContract?.expected_output_disposition
    ?? 'REVIEW_ONLY';
  const expectedSelectedTreeId = syntheticContract?.expected_selected_candidate_tree_id
    ?? null;
  const expectedLawyerRulingId = authorityItem39Contract?.governed_item39_source
    ?.lawyer_ruling_id ?? ITEM39_DECISION_ID;
  exactKeys(fixture, [
    'schema_version', 'fixture_id', 'kind', 'agreement_index_binding', 'ambiguity_id',
    'parent_scoping_rule', 'marker_eligibility', 'candidate_trees',
    'expected_selected_candidate_tree_id', 'expected_output_disposition',
    'lawyer_ruling_id',
  ], code, 'ambiguous-repeat overlay fixture');
  if (fixture.schema_version !== STRUCTURE_OVERLAY_FIXTURE_SCHEMA
      || fixture.fixture_id !== expectedFixtureId
      || fixture.kind !== 'GENUINELY_AMBIGUOUS_REPEAT'
      || !same(fixture.parent_scoping_rule, expectedParentRule)
      || fixture.expected_selected_candidate_tree_id !== expectedSelectedTreeId
      || fixture.expected_output_disposition !== expectedOutputDisposition
      || fixture.lawyer_ruling_id !== expectedLawyerRulingId) {
    fail(code, 'ambiguous-repeat fixture does not bind the closed negative result');
  }
  exactKeys(fixture.agreement_index_binding, BINDING_KEYS, code,
    'ambiguous-repeat AgreementIndex binding');
  if (!same(fixture.agreement_index_binding, expectedIndexBinding)) {
    fail(code, 'ambiguous-repeat fixture does not bind the exact C3 synthetic AgreementIndex');
  }
  const agreementIndex = validateResolvedRecordBinding(
    fixture.agreement_index_binding, resolveBinding,
    'ambiguous-repeat AgreementIndex', code,
  );
  const sourceBytes = Buffer.from(string(agreementIndex.source_binding?.canonical_text, code,
    'ambiguous-repeat canonical source'), 'utf8');
  const native = validateNativeStructureEvidence(agreementIndex, sourceBytes, code);
  const ambiguity = native.ambiguities.get(fixture.ambiguity_id);
  if (fixture.ambiguity_id !== expectedAmbiguityId
      || !ambiguity || ambiguity.ambiguity_type !== 'UNRESOLVED_INLINE_LIST'
      || ambiguity.status !== 'OPEN' || !isObject(ambiguity.span)
      || !(ambiguity.span.end_byte <= governedSpan.start_byte
        || ambiguity.span.start_byte >= governedSpan.end_byte)
      || ambiguity.span.text_sha256 !== sha256Hex(sourceBytes.subarray(
        ambiguity.span.start_byte, ambiguity.span.end_byte,
      ))) {
    fail(code, 'ambiguous-repeat fixture is not a disjoint exact M2 ambiguity');
  }
  const dispositionId = ambiguity.detail?.inline_marker_disposition_id;
  const dispositions = [...native.dispositions.values()];
  const ambiguityDisposition = native.dispositions.get(dispositionId);
  if (!ambiguityDisposition || !Array.isArray(ambiguity.node_occurrence_ids)
      || ambiguity.node_occurrence_ids.length !== 1
      || ambiguityDisposition.disposition !== 'UNRESOLVED_INLINE_LIST'
      || ambiguityDisposition.parent_node_occurrence_id
        !== ambiguity.node_occurrence_ids[0]
      || ambiguity.detail.reason !== 'AMBIGUOUS_SAME_STYLE_RESTART'
      || ambiguityDisposition.reason !== ambiguity.detail.reason
      || typeof ambiguityDisposition.style !== 'string'
      || ambiguityDisposition.style.length === 0) {
    fail(code, 'ambiguous-repeat fixture lacks its exact unresolved disposition');
  }
  exactKeys(fixture.marker_eligibility, [
    'structural_candidate_disposition_ids',
    'excluded_glued_reference_disposition_ids',
  ], code, 'ambiguous-repeat marker eligibility');
  const overlapsAmbiguity = (entry) => array(entry.marker_spans, code,
    'ambiguous-repeat marker spans').some((span) =>
    span.start_byte < ambiguity.span.end_byte && span.end_byte > ambiguity.span.start_byte);
  const insideSameParent = (entry) => entry.parent_node_occurrence_id
      === ambiguityDisposition.parent_node_occurrence_id
    && entry.marker_spans.every((span) => span.start_byte >= ambiguity.span.start_byte
      && span.end_byte <= ambiguity.span.end_byte);
  const eligibleDispositions = [];
  const excludedDispositions = [];
  const unclassifiedDispositions = [];
  for (const entry of dispositions.filter(overlapsAmbiguity)) {
    if (entry.disposition_id === ambiguityDisposition.disposition_id
        || (insideSameParent(entry) && entry.disposition === 'AUTHORED_INLINE_LIST')
        || (insideSameParent(entry) && entry.disposition === 'NON_STRUCTURAL_MARKER'
          && ['UNCORROBORATED_FIRST_MARKER', 'AMBIGUOUS_MARKER_STYLE']
            .includes(entry.reason))) {
      eligibleDispositions.push(entry);
    } else if (insideSameParent(entry) && entry.disposition === 'NON_STRUCTURAL_MARKER'
        && entry.reason === 'GLUED_SECTION_REFERENCE') {
      excludedDispositions.push(entry);
    } else {
      unclassifiedDispositions.push(entry);
    }
  }
  if (unclassifiedDispositions.length !== 0) {
    fail(code, 'ambiguous-repeat fixture has an unclassified overlapping marker disposition');
  }
  eligibleDispositions.sort((left, right) => left.marker_spans[0].start_byte
    - right.marker_spans[0].start_byte);
  excludedDispositions.sort((left, right) => left.marker_spans[0].start_byte
    - right.marker_spans[0].start_byte);
  if (!same(fixture.marker_eligibility, {
    structural_candidate_disposition_ids: eligibleDispositions.map(
      (entry) => entry.disposition_id,
    ),
    excluded_glued_reference_disposition_ids: excludedDispositions.map(
      (entry) => entry.disposition_id,
    ),
  })) {
    fail(code, 'ambiguous-repeat marker eligibility differs from the bound M2 evidence');
  }
  const requiredMarkerEvidence = eligibleDispositions
    .flatMap((entry) => entry.marker_spans.map((markerSpan) => ({
      marker_span: markerSpan,
      source_disposition_id: entry.disposition_id,
    })))
    .sort((left, right) => left.marker_span.start_byte - right.marker_span.start_byte);
  const repeatedMarkerIdentities = new Map();
  for (const evidence of requiredMarkerEvidence) {
    const markerText = sourceBytes.subarray(
      evidence.marker_span.start_byte, evidence.marker_span.end_byte,
    ).toString('utf8');
    const label = outlineLabelValue(markerText);
    if (label === null) fail(code, 'ambiguous-repeat fixture has an unsupported marker label');
    const identity = `${label.style}:${label.value}`;
    if (!repeatedMarkerIdentities.has(identity)) repeatedMarkerIdentities.set(identity, new Set());
    repeatedMarkerIdentities.get(identity).add(
      `${evidence.marker_span.start_byte}:${evidence.marker_span.end_byte}`,
    );
  }
  if (![...repeatedMarkerIdentities.values()].some((spans) => spans.size >= 2)) {
    fail(code, 'ambiguous-repeat fixture does not contain a repeated marker identity');
  }
  const candidateTrees = array(fixture.candidate_trees, code,
    'ambiguous-repeat candidate trees');
  if (candidateTrees.length < 2) {
    fail(code, 'ambiguous-repeat fixture does not materialise competing trees');
  }
  const candidateContext = {
    agreementIndex,
    sourceBytes,
    requiredMarkerEvidence,
    parentNodeId: ambiguityDisposition.parent_node_occurrence_id,
  };
  const expectedCandidateTrees = enumerateMaterialRepeatDepthSequences(
    requiredMarkerEvidence, sourceBytes, code,
  ).map((depths) => materialiseStructureCandidateTree(depths, candidateContext, code));
  candidateTrees.forEach((tree) => evaluateStructureCandidateTree(
    tree, candidateContext, code,
  ));
  if (!same(candidateTrees, expectedCandidateTrees)) {
    fail(code, 'ambiguous-repeat fixture omits or invents a parent-scoped candidate tree');
  }
  if (expectedCandidateTrees.filter(
    (tree) => tree.tree_state === 'PASS_PARENT_SCOPING',
  ).length < 2) {
    fail(code, 'ambiguous-repeat fixture does not preserve two passing readings');
  }
}

function authorisedAuthoredMarkerSpans(
  agreementIndex, sourceBytes, analysis, closure, sourceNode, semanticInputs, code,
) {
  const nodes = new Map(array(agreementIndex.nodes, code, 'agreement index nodes').map(
    (node) => [node.node_occurrence_id, node],
  ));
  const evidenceByRange = new Map();
  const dispositions = new Map();
  for (const disposition of array(agreementIndex.inline_marker_dispositions, code,
    'AgreementIndex inline-marker dispositions')) {
    exactKeys(disposition, [
      'schema_version',
      'disposition_id',
      'disposition',
      'reason',
      'style',
      'depth',
      'parent_node_occurrence_id',
      'marker_spans',
      'produced_limb_node_occurrence_ids',
    ], code, 'AgreementIndex inline-marker disposition');
    const unsignedDisposition = { ...disposition };
    delete unsignedDisposition.disposition_id;
    const markerSpans = array(disposition.marker_spans, code,
      'AgreementIndex disposition marker spans');
    const producedLimbIds = array(disposition.produced_limb_node_occurrence_ids, code,
      'AgreementIndex produced limb IDs');
    if (disposition.schema_version !== 'AGREEMENT_INLINE_MARKER_DISPOSITION/V1'
        || disposition.disposition_id !== contentId(
          'AGREEMENT_INLINE_MARKER_DISPOSITION/V1', unsignedDisposition,
        )
        || !['AUTHORED_INLINE_LIST', 'NON_STRUCTURAL_MARKER',
          'UNRESOLVED_INLINE_LIST'].includes(disposition.disposition)
        || typeof disposition.reason !== 'string' || disposition.reason.length === 0
        || typeof disposition.style !== 'string' || disposition.style.length === 0
        || (disposition.depth !== null
          && (!Number.isInteger(disposition.depth) || disposition.depth < 1))
        || !nodes.has(disposition.parent_node_occurrence_id)
        || markerSpans.length === 0
        || (disposition.disposition === 'AUTHORED_INLINE_LIST'
          ? markerSpans.length < 2 || producedLimbIds.length !== markerSpans.length
          : producedLimbIds.length !== 0)) {
      fail(code, 'AgreementIndex inline-marker disposition evidence is invalid');
    }
    for (let index = 0; index < markerSpans.length; index += 1) {
      const markerSpan = markerSpans[index];
      exactKeys(markerSpan, [
        'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
      ], code, 'AgreementIndex disposition marker span');
      if (markerSpan.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
          || !Number.isInteger(markerSpan.start_byte)
          || !Number.isInteger(markerSpan.end_byte)
          || markerSpan.start_byte < 0
          || markerSpan.end_byte <= markerSpan.start_byte
          || markerSpan.end_byte > sourceBytes.length
          || markerSpan.text_sha256 !== sha256Hex(sourceBytes.subarray(
            markerSpan.start_byte, markerSpan.end_byte,
          ))) {
        fail(code, 'AgreementIndex disposition marker span is invalid');
      }
      if (disposition.disposition !== 'AUTHORED_INLINE_LIST') continue;
      const limb = nodes.get(producedLimbIds[index]);
      if (!limb || limb.node_kind !== 'LIMB'
          || !Array.isArray(limb.roles) || !limb.roles.includes('AUTHORED_INLINE_LIMB')
          || limb.parent_node_occurrence_id !== disposition.parent_node_occurrence_id
          || !isObject(limb.extent_span)
          || limb.extent_span.start_byte > markerSpan.start_byte
          || limb.extent_span.end_byte < markerSpan.end_byte) {
        fail(code, 'AgreementIndex authored inline-list limb evidence is invalid');
      }
      evidenceByRange.set(`${markerSpan.start_byte}:${markerSpan.end_byte}`, null);
    }
    dispositions.set(disposition.disposition_id, disposition);
  }
  for (const annotation of array(agreementIndex.annotations, code,
    'AgreementIndex annotations')) {
    if (!isObject(annotation) || annotation.annotation_kind !== 'OUTLINE_MARKER') continue;
    const owner = nodes.get(annotation.owner_node_occurrence_id);
    if (!owner || owner.node_kind !== 'LIMB') continue;
    exactKeys(annotation, [
      'schema_version', 'annotation_occurrence_id', 'annotation_kind', 'roles',
      'span', 'owner_node_occurrence_id', 'value',
    ], code, 'AgreementIndex structural marker annotation');
    exactKeys(annotation.span, [
      'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
    ], code, 'AgreementIndex structural marker annotation span');
    const expectedAnnotationId = contentId('AGREEMENT_SOURCE_ANNOTATION/V1', {
      canonical_text_id: agreementIndex.source_binding.canonical_text_id,
      annotation_kind: annotation.annotation_kind,
      start_byte: annotation.span.start_byte,
      end_byte: annotation.span.end_byte,
      value: annotation.value,
    });
    if (annotation.schema_version !== 'AGREEMENT_SOURCE_ANNOTATION/V1'
        || annotation.annotation_occurrence_id !== expectedAnnotationId
        || !Array.isArray(annotation.roles) || !annotation.roles.includes('STRUCTURAL_MARKER')
        || annotation.span.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
        || !Number.isInteger(annotation.span.start_byte)
        || !Number.isInteger(annotation.span.end_byte)
        || annotation.span.start_byte < 0
        || annotation.span.end_byte <= annotation.span.start_byte
        || annotation.span.end_byte > sourceBytes.length
        || annotation.span.text_sha256 !== sha256Hex(sourceBytes.subarray(
          annotation.span.start_byte, annotation.span.end_byte,
        ))
        || !isObject(owner.extent_span)
        || owner.extent_span.start_byte > annotation.span.start_byte
        || owner.extent_span.end_byte < annotation.span.end_byte) {
      fail(code, 'AgreementIndex structural marker annotation is invalid');
    }
    evidenceByRange.set(`${annotation.span.start_byte}:${annotation.span.end_byte}`, null);
  }
  const matchedOverlayDispositions = new Set();
  for (const authority of semanticInputs.structureMembers.values()) {
    if (authority.kind !== 'BEN_AUTHORED_INLINE_LIST_OVERLAY') continue;
    const overlay = authority.inline_list_overlay;
    if (overlay.agreement_index_binding.record_id !== agreementIndex.agreement_index_id
        || authority.scope.source_node_occurrence_id !== closure.source_node_occurrence_id
        || overlay.parent_node_occurrence_id !== closure.source_node_occurrence_id) continue;
    const globalOverlayEvidence = semanticInputs.structureOverlayEvidence.get(
      authority.structure_disposition_id,
    );
    if (!globalOverlayEvidence
        || globalOverlayEvidence.agreementIndex.agreement_index_id
          !== agreementIndex.agreement_index_id) {
      fail(code, 'item-39 overlay lacks its globally validated native evidence');
    }
    if (!same(overlay.agreement_index_binding, closure.agreement_index_binding)
        || authority.scope.agreement_index_id !== agreementIndex.agreement_index_id) {
      fail(code, 'item-39 overlay is outside the exact current closure and source node');
    }
    const disposition = dispositions.get(overlay.inline_marker_disposition_id);
    const ambiguity = array(agreementIndex.ambiguities, code,
      'AgreementIndex ambiguities').find(
      (entry) => entry.ambiguity_id === overlay.sealed_ambiguity_id,
    );
    if (!disposition || disposition.disposition !== 'UNRESOLVED_INLINE_LIST'
        || disposition.parent_node_occurrence_id !== overlay.parent_node_occurrence_id
        || disposition.produced_limb_node_occurrence_ids.length !== 0
        || !ambiguity) {
      fail(code, 'Ben inline-list overlay differs from its exact M2 ambiguity');
    }
    exactKeys(ambiguity, [
      'schema_version', 'ambiguity_id', 'ambiguity_type', 'status',
      'node_occurrence_ids', 'span', 'detail',
    ], code, 'AgreementIndex inline-list ambiguity');
    const unsignedAmbiguity = { ...ambiguity };
    delete unsignedAmbiguity.ambiguity_id;
    if (ambiguity.schema_version !== 'AGREEMENT_STRUCTURE_AMBIGUITY/V1'
        || ambiguity.ambiguity_id !== contentId(
          'AGREEMENT_STRUCTURE_AMBIGUITY/V1', unsignedAmbiguity,
        )
        || ambiguity.ambiguity_type !== 'UNRESOLVED_INLINE_LIST'
        || ambiguity.status !== 'OPEN'
        || !same(ambiguity.span, overlay.sealed_ambiguity_span)
        || !Array.isArray(ambiguity.node_occurrence_ids)
        || !ambiguity.node_occurrence_ids.includes(overlay.parent_node_occurrence_id)
        || !isObject(ambiguity.detail)
        || ambiguity.detail.inline_marker_disposition_id
          !== overlay.inline_marker_disposition_id
        || ambiguity.span.text_sha256 !== sha256Hex(sourceBytes.subarray(
          ambiguity.span.start_byte, ambiguity.span.end_byte,
        ))) {
      fail(code, 'Ben inline-list overlay lacks the exact bound M2 ambiguity');
    }
    let ancestor = nodes.get(sourceNode.parent_node_occurrence_id);
    while (ancestor && ancestor.reference === null) {
      ancestor = ancestor.parent_node_occurrence_id === null
        ? null : nodes.get(ancestor.parent_node_occurrence_id);
    }
    if (!ancestor || ancestor.reference !== overlay.parent_reference) {
      fail(code, 'item-39 overlay parent reference is not proved by the nearest bound ancestor');
    }
    const rawCandidateSets = array(analysis.candidate_sets, code, 'candidate sets');
    const actualOccurrenceIds = [...new Set(rawCandidateSets
      .filter((candidateSet) => isObject(candidateSet)
        && candidateSet.authored_unit_id === closure.authored_unit_id)
      .flatMap((candidateSet) => array(candidateSet.effects, code,
        'overlay candidate effects').map((effect) => string(
        effect.input_occurrence_id, code, 'overlay input occurrence ID',
      ))))].sort();
    if (actualOccurrenceIds.length === 0
        || !same(actualOccurrenceIds, authority.scope.governed_input_occurrence_ids)) {
      fail(code, 'Ben inline-list overlay covers the wrong governed occurrence set');
    }
    const structuralDispositionIds = overlay.marker_eligibility
      .structural_candidate_disposition_ids;
    const structuralDispositions = structuralDispositionIds.map((dispositionId) => {
      const selected = dispositions.get(dispositionId);
      if (!selected) fail(code, 'overlay structural marker disposition is absent from M2');
      return selected;
    });
    const [romanDisposition, upperADisposition, upperBDisposition] = structuralDispositions;
    if (romanDisposition.disposition !== 'UNRESOLVED_INLINE_LIST'
        || romanDisposition.disposition_id !== ITEM39_DISPOSITION_ID
        || upperADisposition.disposition !== 'NON_STRUCTURAL_MARKER'
        || upperADisposition.reason !== 'UNCORROBORATED_FIRST_MARKER'
        || upperBDisposition.disposition !== 'NON_STRUCTURAL_MARKER'
        || upperBDisposition.reason !== 'AMBIGUOUS_MARKER_STYLE') {
      fail(code, 'overlay marker eligibility differs from the exact item-39 M2 dispositions');
    }
    const excludedDispositions = overlay.marker_eligibility
      .excluded_glued_reference_disposition_ids.map((dispositionId) => {
        const selected = dispositions.get(dispositionId);
        if (!selected || selected.disposition !== 'NON_STRUCTURAL_MARKER'
            || selected.reason !== 'GLUED_SECTION_REFERENCE') {
          fail(code, 'overlay glued-reference exclusion differs from M2');
        }
        return selected;
      });
    const requiredMarkerEvidence = structuralDispositions
      .flatMap((selected) => selected.marker_spans.map((markerSpan) => ({
        marker_span: markerSpan,
        source_disposition_id: selected.disposition_id,
      })))
      .sort((left, right) => left.marker_span.start_byte - right.marker_span.start_byte);
    if (requiredMarkerEvidence.length !== 6
        || excludedDispositions.flatMap((selected) => selected.marker_spans).some(
          (excludedSpan) => requiredMarkerEvidence.some(
            (evidence) => same(evidence.marker_span, excludedSpan),
          ),
        )) {
      fail(code, 'item-39 overlay does not partition six structural and two glued markers');
    }
    const candidateContext = {
      agreementIndex,
      sourceBytes,
      requiredMarkerEvidence,
      parentNodeId: overlay.parent_node_occurrence_id,
    };
    const expectedCandidateTrees = enumerateMaterialRepeatDepthSequences(
      requiredMarkerEvidence, sourceBytes, code,
    ).map((depths) => materialiseStructureCandidateTree(depths, candidateContext, code));
    if (!same(overlay.candidate_trees, expectedCandidateTrees)) {
      fail(code, 'item-39 candidate-tree enumeration is incomplete or reordered');
    }
    overlay.candidate_trees.forEach((tree) => evaluateStructureCandidateTree(
      tree, candidateContext, code,
    ));
    const passingTrees = expectedCandidateTrees.filter(
      (tree) => tree.tree_state === 'PASS_PARENT_SCOPING',
    );
    if (expectedCandidateTrees.length !== 2 || passingTrees.length !== 1
        || overlay.selected_candidate_tree_id !== passingTrees[0].candidate_tree_id) {
      fail(code, 'item-39 parent-scoping rule does not select the sole correct tree');
    }
    const selectedTree = passingTrees[0];
    const closureSpanIds = new Set(array(closure.spans, code, 'source spans').map(
      (span) => span.span_id,
    ));
    const actualContext = {
      authored_unit_source_words: normalisedWords(sourceBytes.subarray(
        closure.governing_start_byte, closure.governing_end_byte,
      ).toString('utf8')),
      effect_source_words: normalisedWords(sourceBytes.subarray(
        overlay.sealed_ambiguity_span.start_byte,
        overlay.sealed_ambiguity_span.end_byte,
      ).toString('utf8')),
      node_kind: string(sourceNode.node_kind, code, 'source node kind'),
      ancestor_node_kinds: ancestorNodeKinds(sourceNode, agreementIndex),
      context_edges: [...semanticInputs.contextEdges.values()].filter((edge) =>
        edge.source_support_ids.some((spanId) => closureSpanIds.has(spanId))),
      typed_facts: [],
    };
    if (!evaluateMatchTest(authority.match_test, actualContext).matched) {
      fail(code, 'Ben inline-list overlay does not match actual source and index context');
    }
    if (matchedOverlayDispositions.has(disposition.disposition_id)) {
      fail(code, 'M2 inline-list ambiguity has competing Ben overlays');
    }
    matchedOverlayDispositions.add(disposition.disposition_id);
    for (const evidence of requiredMarkerEvidence) {
      const rangeKey = `${evidence.marker_span.start_byte}:${evidence.marker_span.end_byte}`;
      const treeNode = selectedTree.nodes.find((node) =>
        node.marker_span.start_byte === evidence.marker_span.start_byte
          && node.marker_span.end_byte === evidence.marker_span.end_byte
          && node.marker_span.text_sha256 === evidence.marker_span.text_sha256);
      if (!treeNode) fail(code, 'item-39 selected tree omits an authorised marker');
      const previous = evidenceByRange.get(rangeKey);
      if (previous !== undefined && previous !== null
          && previous.authority_id !== authority.structure_disposition_id) {
        fail(code, 'authored marker has competing overlay authority');
      }
      evidenceByRange.set(rangeKey, {
        authority_id: authority.structure_disposition_id,
        selected_candidate_tree_id: selectedTree.candidate_tree_id,
        tree_node: treeNode,
      });
    }
  }
  return evidenceByRange;
}

function deriveOperativeMarkerRanges(
  sourceBytes, startByte, endByte, agreementIndex, analysis, closure, sourceNode,
  semanticInputs, code,
) {
  const sourceText = sourceBytes.subarray(startByte, endByte).toString('utf8');
  const markers = [];
  const nativeAuthoredMarkers = authorisedAuthoredMarkerSpans(
    agreementIndex, sourceBytes, analysis, closure, sourceNode, semanticInputs, code,
  );
  const romanLimbLabels = new Set([
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
    'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
  ]);
  const approvedLimbLabel = (value) => {
    const lower = value.toLowerCase();
    return /^[0-9]{1,3}$/u.test(value)
      || /^[a-z]$/iu.test(value)
      || ((/^[a-z]{2}$/u.test(value) || /^[A-Z]{2}$/u.test(value))
        && lower[0] === lower[1])
      || (romanLimbLabels.has(lower)
        && (/^[a-z]+$/u.test(value) || /^[A-Z]+$/u.test(value)));
  };
  const addMatches = (
    pattern, captureIndex, markerKind, labelCaptureIndex = null, requiresNativeMarker = false,
    matchFilter = null,
  ) => {
    for (const match of sourceText.matchAll(pattern)) {
      if (matchFilter !== null && !matchFilter(match, sourceText)) continue;
      const markerText = match[captureIndex];
      if (labelCaptureIndex !== null && !approvedLimbLabel(match[labelCaptureIndex])) continue;
      const markerCharacterOffset = match.index + match[0].lastIndexOf(markerText);
      const markerStartByte = startByte + Buffer.byteLength(
        sourceText.slice(0, markerCharacterOffset), 'utf8',
      );
      const markerEndByte = markerStartByte + Buffer.byteLength(markerText, 'utf8');
      const authoredMarkerEvidence = nativeAuthoredMarkers.get(
        `${markerStartByte}:${markerEndByte}`,
      );
      if (requiresNativeMarker && authoredMarkerEvidence === undefined) continue;
      markers.push({
        start_byte: markerStartByte,
        end_byte: markerEndByte,
        marker_kind: markerKind,
        authored_limb_overlay_evidence: authoredMarkerEvidence ?? null,
      });
    }
  };
  addMatches(
    /(^|[^\p{L}\p{N}_])(shall|must|will|would|may|agree|agrees|undertake|undertakes)(?=$|[^\p{L}\p{N}_])/gimu,
    2,
    'MODAL',
  );
  addMatches(
    /(^|[^\p{L}\p{N}_])(covenant|covenants)(?=\s+(?:(?:not\s+)?to|that|and\s+(?:agree|agrees|undertake|undertakes))\b)/gimu,
    2,
    'MODAL',
    null,
    false,
    (match, value) => !/(?:['’]s|\b(?:a|an|the|this|that|these|those|its|their|our|your|his|her|any|such|all|other))\s*$/iu.test(
      value.slice(0, match.index + match[1].length),
    ),
  );
  addMatches(
    /(^|[^\p{L}\p{N}_])(\(([a-z]{1,5}|[0-9]{1,3})\))(?=\s)/gimu,
    2,
    'ENUMERATED_LIMB',
    3,
    true,
  );
  addMatches(
    /(^|[\r\n;:])[ \t]*(([a-z]{1,5}|[0-9]{1,3})[.)])(?=\s)/gimu,
    2,
    'ENUMERATED_LIMB',
    3,
    true,
  );
  markers.sort((left, right) => left.start_byte - right.start_byte
    || left.end_byte - right.end_byte || (left.marker_kind < right.marker_kind ? -1 : 1));
  return markers;
}

function nativeSourceArtefactCoveringSpan(agreementIndex, closure, span, sourceBytes, code) {
  const candidates = array(agreementIndex.source_artefacts, code,
    'AgreementIndex source artefacts').filter((artefact) => isObject(artefact)
      && isObject(artefact.span)
      && artefact.span.start_byte === span.start_byte
      && artefact.span.end_byte === span.end_byte);
  const verified = [];
  for (const artefact of candidates) {
    exactKeys(artefact, [
      'schema_version',
      'source_artefact_id',
      'source_artefact_kind',
      'span',
      'containing_node_occurrence_id',
    ], code, 'AgreementIndex source artefact');
    exactKeys(artefact.span, [
      'coordinate_system', 'start_byte', 'end_byte', 'text_sha256',
    ], code, 'AgreementIndex source artefact span');
    if (artefact.schema_version !== 'AGREEMENT_SOURCE_ARTEFACT/V1'
        || !['PAGE_NUMBER', 'FORM_FEED', 'CONVERSION_CONTROL'].includes(
          artefact.source_artefact_kind,
        )
        || artefact.span.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
        || !Number.isInteger(artefact.span.start_byte)
        || !Number.isInteger(artefact.span.end_byte)
        || artefact.span.start_byte < closure.governing_start_byte
        || artefact.span.end_byte > closure.governing_end_byte
        || artefact.span.end_byte <= artefact.span.start_byte
        || artefact.span.text_sha256 !== sha256Hex(sourceBytes.subarray(
          artefact.span.start_byte, artefact.span.end_byte,
        ))) {
      fail(code, 'AgreementIndex source artefact evidence is invalid');
    }
    const expectedId = contentId('AGREEMENT_SOURCE_ARTEFACT/V1', {
      canonical_text_id: closure.canonical_source_binding.canonical_text_id,
      source_artefact_kind: artefact.source_artefact_kind,
      start_byte: artefact.span.start_byte,
      end_byte: artefact.span.end_byte,
      text_sha256: artefact.span.text_sha256,
    });
    const containingNode = array(agreementIndex.nodes, code, 'agreement index nodes').find(
      (node) => node.node_occurrence_id === artefact.containing_node_occurrence_id,
    );
    if (artefact.source_artefact_id !== expectedId
        || !containingNode || !isObject(containingNode.extent_span)
        || containingNode.extent_span.coordinate_system
          !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
        || !Number.isInteger(containingNode.extent_span.start_byte)
        || !Number.isInteger(containingNode.extent_span.end_byte)
        || containingNode.extent_span.start_byte > artefact.span.start_byte
        || containingNode.extent_span.end_byte < artefact.span.end_byte) {
      fail(code, 'AgreementIndex source artefact identity or containing node is invalid');
    }
    verified.push(artefact);
  }
  if (verified.length > 1) {
    fail(code, `source span ${span.span_id} has competing native source artefact evidence`);
  }
  return verified[0] ?? null;
}

function validateSources(analysis, governance, resolveBinding, semanticInputs) {
  const closureCode = 'M7_V2_SOURCE_CLOSURE';
  const indexSet = governance.inputRecords.get('AGREEMENT_INDEX_SET');
  exactKeys(indexSet, ['schema_version', 'agreement_index_set_id', 'members'], closureCode,
    'agreement index set');
  if (indexSet.schema_version !== INPUT_SCHEMAS.AGREEMENT_INDEX_SET) {
    fail(closureCode, 'agreement index set schema is invalid');
  }
  const indexMembers = array(indexSet.members, closureCode, 'agreement index set members');
  if (indexMembers.length === 0) fail(closureCode, 'agreement index set is empty');
  for (const binding of indexMembers) {
    exactKeys(binding, BINDING_KEYS, closureCode, 'agreement index set member');
    if (binding.schema_version !== AGREEMENT_INDEX_SCHEMA
        || binding.record_id_field !== 'agreement_index_id') {
      fail(closureCode, 'agreement index set member has the wrong schema');
    }
  }
  unique(indexMembers.map((binding) => binding.path), closureCode, 'agreement index member paths');
  unique(indexMembers.map((binding) => binding.record_id), closureCode,
    'agreement index member IDs');
  if (!same(indexMembers.map((binding) => binding.path),
    indexMembers.map((binding) => binding.path).sort())) {
    fail(closureCode, 'agreement index members are not in canonical path order');
  }
  const closures = indexBy(array(analysis.source_closures, closureCode, 'source closures'),
    'source_closure_id', closureCode, 'source closure');
  const spanById = new Map();
  const closureBySpan = new Map();
  const sourceTextByClosure = new Map();
  const sourceBytesByClosure = new Map();
  const sourceNodeByClosure = new Map();
  const agreementIndexByClosure = new Map();
  const spanBytesById = new Map();
  const sourceStatusBySpan = new Map();
  for (const closure of closures.values()) {
    exactKeys(closure, [
      'schema_version',
      'source_closure_id',
      'authored_unit_id',
      'agreement_index_binding',
      'canonical_source_binding',
      'source_node_occurrence_id',
      'complete_review_state',
      'governing_chapeau_span_ids',
      'required_dependency_ids',
      'governing_start_byte',
      'governing_end_byte',
      'whitespace_punctuation_policy_id',
      'spans',
    ], closureCode, 'source closure');
    if (closure.schema_version !== SOURCE_CLOSURE_SCHEMA) {
      fail(closureCode, 'source closure schema is invalid');
    }
    const unsignedClosure = { ...closure };
    delete unsignedClosure.schema_version;
    delete unsignedClosure.source_closure_id;
    if (closure.source_closure_id !== contentId(SOURCE_CLOSURE_SCHEMA, unsignedClosure)) {
      fail(closureCode, 'source closure content identity is invalid');
    }
    exactKeys(closure.agreement_index_binding, BINDING_KEYS, closureCode,
      'source closure agreement index binding');
    const memberBinding = indexMembers.find(
      (binding) => same(binding, closure.agreement_index_binding),
    );
    if (!memberBinding) fail(closureCode, 'source closure index is outside the governed index set');
    const agreementIndex = validateResolvedRecordBinding(memberBinding, resolveBinding,
      'source closure agreement index', closureCode);
    exactKeys(closure.canonical_source_binding, [
      'canonical_text_id',
      'canonical_text_sha256',
      'canonical_text_byte_length',
    ], closureCode, 'canonical source binding');
    object(agreementIndex.source_binding, closureCode, 'agreement index source binding');
    if (agreementIndex.source_binding.agreement_id !== analysis.agreement_id) {
      fail(closureCode, 'source closure AgreementIndex belongs to another agreement');
    }
    const sourceText = string(agreementIndex.source_binding.canonical_text, closureCode,
      'agreement index canonical text');
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    sourceTextByClosure.set(closure.source_closure_id, sourceText);
    sourceBytesByClosure.set(closure.source_closure_id, sourceBytes);
    const expectedCanonicalSource = {
      canonical_text_id: agreementIndex.source_binding.canonical_text_id,
      canonical_text_sha256: agreementIndex.source_binding.canonical_text_sha256,
      canonical_text_byte_length: agreementIndex.source_binding.canonical_text_byte_length,
    };
    if (!same(closure.canonical_source_binding, expectedCanonicalSource)
        || sourceBytes.length !== closure.canonical_source_binding.canonical_text_byte_length
        || sha256Hex(sourceBytes) !== closure.canonical_source_binding.canonical_text_sha256) {
      fail(closureCode, 'canonical source bytes differ from the closure binding');
    }
    assertHex(closure.canonical_source_binding.canonical_text_id, 64, closureCode,
      'canonical text ID');
    string(closure.source_node_occurrence_id, closureCode, 'source node occurrence ID');
    const sourceNode = array(agreementIndex.nodes, closureCode, 'agreement index nodes')
      .find((node) => node.node_occurrence_id === closure.source_node_occurrence_id);
    if (!sourceNode || !isObject(sourceNode.extent_span)
        || sourceNode.extent_span.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN') {
      fail(closureCode, 'source closure node occurrence is absent or uses another coordinate system');
    }
    if (!Number.isInteger(sourceNode.extent_span.start_byte)
        || !Number.isInteger(sourceNode.extent_span.end_byte)
        || sourceNode.extent_span.start_byte < 0
        || sourceNode.extent_span.end_byte <= sourceNode.extent_span.start_byte
        || sourceNode.extent_span.end_byte > sourceBytes.length
        || sha256Hex(sourceBytes.subarray(
          sourceNode.extent_span.start_byte, sourceNode.extent_span.end_byte,
        )) !== sourceNode.extent_span.text_sha256) {
      fail(closureCode, 'source node extent does not match exact canonical source bytes');
    }
    sourceNodeByClosure.set(closure.source_closure_id, sourceNode);
    agreementIndexByClosure.set(closure.source_closure_id, agreementIndex);
    string(closure.authored_unit_id, closureCode, 'source authored unit');
    if (closure.authored_unit_id !== closure.source_node_occurrence_id) {
      fail(closureCode, 'authored unit identity differs from its exact source node occurrence');
    }
    if (closure.complete_review_state !== 'COMPLETE_REVIEWED_SOURCE_CLOSURE') {
      fail(closureCode, 'source closure is not complete and reviewed');
    }
    if (!Number.isInteger(closure.governing_start_byte)
        || !Number.isInteger(closure.governing_end_byte)
        || closure.governing_start_byte < 0
        || closure.governing_end_byte <= closure.governing_start_byte) {
      fail(closureCode, 'source closure byte range is invalid');
    }
    if (closure.governing_start_byte !== sourceNode.extent_span.start_byte
        || closure.governing_end_byte !== sourceNode.extent_span.end_byte
        || closure.governing_end_byte > sourceBytes.length) {
      fail(closureCode, 'source closure does not cover its full authored-unit node occurrence');
    }
    string(closure.whitespace_punctuation_policy_id, closureCode,
      'whitespace and punctuation policy');
    const operativeMarkerRanges = deriveOperativeMarkerRanges(
      sourceBytes, closure.governing_start_byte, closure.governing_end_byte,
      agreementIndex, analysis, closure, sourceNode, semanticInputs, closureCode,
    );
    for (let index = 1; index < operativeMarkerRanges.length; index += 1) {
      if (operativeMarkerRanges[index].start_byte < operativeMarkerRanges[index - 1].end_byte) {
        fail(closureCode, 'source-first operative marker ranges overlap');
      }
    }
    const claimedOperativeMarkerRanges = new Set();
    let expectedStart = closure.governing_start_byte;
    for (const span of array(closure.spans, closureCode, 'source spans')) {
      exactKeys(span, [
        'span_id',
        'source_node_occurrence_id',
        'start_byte',
        'end_byte',
        'text_sha256',
        'legal_text',
        'operative',
        'materiality',
      ], closureCode, 'source span');
      string(span.span_id, closureCode, 'source span ID');
      if (span.span_id !== contentId('AGREEMENT_SOURCE_SPAN/V2', {
        agreement_index_id: agreementIndex.agreement_index_id,
        source_node_occurrence_id: span.source_node_occurrence_id,
        start_byte: span.start_byte,
        end_byte: span.end_byte,
        text_sha256: span.text_sha256,
      })) fail(closureCode, 'source span content identity is invalid');
      string(span.source_node_occurrence_id, closureCode, 'source node occurrence ID');
      if (span.source_node_occurrence_id !== closure.source_node_occurrence_id) {
        fail(closureCode, 'source span uses another node occurrence');
      }
      if (spanById.has(span.span_id)) fail(closureCode, 'source span ID is not unique');
      if (!Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)
          || span.start_byte !== expectedStart || span.end_byte <= span.start_byte
          || span.end_byte > closure.governing_end_byte) {
        fail(closureCode, 'source spans do not form an exact ordered partition');
      }
      assertHex(span.text_sha256, 64, closureCode, 'source span digest');
      if (sha256Hex(sourceBytes.subarray(span.start_byte, span.end_byte)) !== span.text_sha256) {
        fail(closureCode, `source span ${span.span_id} digest does not match exact source bytes`);
      }
      if (typeof span.legal_text !== 'boolean' || typeof span.operative !== 'boolean') {
        fail(closureCode, 'source span legal status is invalid');
      }
      if (!['MATERIAL', 'NON_MATERIAL'].includes(span.materiality)) {
        fail(closureCode, 'source span materiality is invalid');
      }
      const spanText = sourceBytes.subarray(span.start_byte, span.end_byte).toString('utf8');
      const overlappingMarkerRanges = operativeMarkerRanges.filter(
        (marker) => marker.start_byte < span.end_byte && marker.end_byte > span.start_byte,
      );
      const exactMarkerRanges = overlappingMarkerRanges.filter(
        (marker) => marker.start_byte === span.start_byte && marker.end_byte === span.end_byte,
      );
      if (overlappingMarkerRanges.length !== exactMarkerRanges.length
          || exactMarkerRanges.length > 1) {
        fail(closureCode, `source span ${span.span_id} splits or absorbs an operative marker`);
      }
      const operativeMarker = exactMarkerRanges[0] ?? null;
      if (operativeMarker !== null) {
        claimedOperativeMarkerRanges.add(
          `${operativeMarker.start_byte}:${operativeMarker.end_byte}:${operativeMarker.marker_kind}`,
        );
      }
      const scopedTechnicalAuthorities = [...semanticInputs.structureMembers.values()].filter(
        (authority) => ['TECHNICAL_STRUCTURE', 'SOURCE_ARTEFACT'].includes(authority.kind)
          && authority.scope.agreement_index_id === agreementIndex.agreement_index_id
          && authority.scope.source_node_occurrence_id === span.source_node_occurrence_id
          && authority.scope.start_byte === span.start_byte
          && authority.scope.end_byte === span.end_byte,
      );
      const actualSpanContext = {
        authored_unit_source_words: normalisedWords(sourceBytes.subarray(
          closure.governing_start_byte, closure.governing_end_byte,
        ).toString('utf8')),
        effect_source_words: normalisedWords(spanText),
        node_kind: string(sourceNode.node_kind, closureCode, 'source node kind'),
        ancestor_node_kinds: ancestorNodeKinds(sourceNode, agreementIndex),
        context_edges: [...semanticInputs.contextEdges.values()].filter(
          (edge) => edge.source_support_ids.includes(span.span_id),
        ),
        typed_facts: [],
      };
      const containsAuthoredCharacters = /[\p{L}\p{N}]/u.test(spanText);
      const nativeSourceArtefact = containsAuthoredCharacters
        ? nativeSourceArtefactCoveringSpan(
          agreementIndex, closure, span, sourceBytes, closureCode,
        )
        : null;
      const matchedTechnicalAuthorities = scopedTechnicalAuthorities.filter(
        (authority) => {
          if (!evaluateMatchTest(authority.match_test, actualSpanContext).matched) return false;
          if (!containsAuthoredCharacters) return true;
          const hasIndependentNativeEvidence = authority.kind === 'SOURCE_ARTEFACT'
            && nativeSourceArtefact !== null;
          const hasExactBenRuling = authority.authority_class === 'BEN_LEGAL_RULING'
            && authority.approver === 'BEN_GOODCHILD'
            && typeof authority.lawyer_ruling_id === 'string'
            && semanticInputs.packetRulingIds.has(authority.lawyer_ruling_id);
          return hasIndependentNativeEvidence || hasExactBenRuling;
        },
      );
      if (matchedTechnicalAuthorities.length > 1) {
        fail(closureCode, `source span ${span.span_id} has competing technical dispositions`);
      }
      const technicalAuthority = matchedTechnicalAuthorities[0] ?? null;
      if (technicalAuthority !== null && operativeMarker !== null) {
        fail(closureCode, `source span ${span.span_id} hides an operative marker as technical text`);
      }
      const technical = !containsAuthoredCharacters || technicalAuthority !== null;
      const expectedStatus = {
        technical,
        legal_text: !technical,
        operative: operativeMarker !== null,
        materiality: technical ? 'NON_MATERIAL' : 'MATERIAL',
        operative_marker_kind: operativeMarker?.marker_kind ?? null,
        authored_limb_overlay_authority_id:
          operativeMarker?.authored_limb_overlay_evidence?.authority_id ?? null,
        authored_limb_selected_candidate_tree_id:
          operativeMarker?.authored_limb_overlay_evidence?.selected_candidate_tree_id ?? null,
        authored_limb_selected_tree_node:
          operativeMarker?.authored_limb_overlay_evidence?.tree_node ?? null,
        technical_authority_id: technicalAuthority?.structure_disposition_id ?? null,
        technical_authority_kind: technicalAuthority?.kind ?? null,
        technical_authority_class: technicalAuthority?.authority_class ?? null,
        native_source_artefact_id: technicalAuthority?.kind === 'SOURCE_ARTEFACT'
          ? nativeSourceArtefact?.source_artefact_id ?? null
          : null,
      };
      if (span.legal_text !== expectedStatus.legal_text
          || span.operative !== expectedStatus.operative
          || span.materiality !== expectedStatus.materiality) {
        fail(closureCode,
          `source span ${span.span_id} legal, operative, or material status is not source-derived`);
      }
      expectedStart = span.end_byte;
      spanById.set(span.span_id, span);
      closureBySpan.set(span.span_id, closure.source_closure_id);
      spanBytesById.set(span.span_id, sourceBytes.subarray(span.start_byte, span.end_byte));
      sourceStatusBySpan.set(span.span_id, expectedStatus);
    }
    if (expectedStart !== closure.governing_end_byte) {
      fail(closureCode, 'source spans do not close the governing byte range');
    }
    if (claimedOperativeMarkerRanges.size !== operativeMarkerRanges.length) {
      fail(closureCode, 'source span partition omits a source-derived operative marker');
    }
    array(closure.governing_chapeau_span_ids, closureCode, 'governing chapeau spans');
    if (closure.governing_chapeau_span_ids.length === 0) {
      fail(closureCode, 'source closure has no governing chapeau');
    }
    for (const spanId of closure.governing_chapeau_span_ids) {
      if (closureBySpan.get(spanId) !== closure.source_closure_id) {
        fail(closureCode, 'governing chapeau falls outside its closure');
      }
    }
    array(closure.required_dependency_ids, closureCode, 'required dependencies');
    unique(closure.required_dependency_ids, closureCode, 'required dependencies');
  }

  const dependencyCode = 'M7_V2_DEPENDENCY';
  const dependencies = indexBy(array(analysis.dependencies, dependencyCode, 'dependencies'),
    'dependency_id', dependencyCode, 'dependency');
  for (const dependency of dependencies.values()) {
    const rawContextEdge = typeof dependency.context_edge_id === 'string'
      ? semanticInputs.contextEdges.get(dependency.context_edge_id) : null;
    const focusedDurationDependency = dependency.dependency_type
        === 'DURATION_CONDITION_REFERENCE'
      || rawContextEdge?.edge_type === 'DURATION_REFERENCE_TARGET'
      || (analysis.agreement_id === ITEM42_44_AGREEMENT_ID
        && Array.isArray(dependency.source_support_ids)
        && dependency.source_support_ids.some((spanId) => {
          const closureId = closureBySpan.get(spanId);
          return sourceNodeByClosure.get(closureId)?.node_occurrence_id
            === ITEM42_SOURCE_NODE_ID;
        }));
    const selectedDependencyCode = focusedDurationDependency
      ? 'M7_V2_FACT_OWNERSHIP' : dependencyCode;
    exactKeys(dependency, [
      'dependency_id',
      'context_edge_id',
      'dependency_type',
      'state',
      'target_id',
      'source_support_ids',
    ], selectedDependencyCode, 'dependency');
    string(dependency.context_edge_id, selectedDependencyCode, 'dependency context edge ID');
    string(dependency.dependency_type, selectedDependencyCode, 'dependency type');
    if (!['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(dependency.state)) {
      fail(selectedDependencyCode, 'dependency state is invalid');
    }
    if (dependency.target_id !== null) {
      string(dependency.target_id, selectedDependencyCode, 'dependency target');
    }
    array(dependency.source_support_ids, selectedDependencyCode, 'dependency source supports');
    if (dependency.source_support_ids.length === 0) {
      fail(selectedDependencyCode, 'dependency is unproved');
    }
    unique(dependency.source_support_ids, selectedDependencyCode, 'dependency source supports');
    dependency.source_support_ids.forEach((spanId) => {
      if (!spanById.has(spanId)) {
        fail(selectedDependencyCode, 'dependency cites an unknown span');
      }
    });
    const contextEdge = semanticInputs.contextEdges.get(dependency.context_edge_id);
    const expectedContextEdgeType = dependency.dependency_type === 'DURATION_CONDITION_REFERENCE'
      ? 'DURATION_REFERENCE_TARGET' : dependency.dependency_type;
    if (!contextEdge || contextEdge.edge_type !== expectedContextEdgeType
        || contextEdge.target_id !== dependency.target_id
        || contextEdge.state !== dependency.state
        || !same(contextEdge.source_support_ids, dependency.source_support_ids)) {
      fail(selectedDependencyCode, 'dependency differs from its exact bound context edge');
    }
  }
  for (const closure of closures.values()) {
    for (const dependencyId of closure.required_dependency_ids) {
      if (!dependencies.has(dependencyId)) {
        const missingDependencyCode = analysis.agreement_id === ITEM42_44_AGREEMENT_ID
            && sourceNodeByClosure.get(closure.source_closure_id)?.node_occurrence_id
              === ITEM42_SOURCE_NODE_ID
          ? 'M7_V2_FACT_OWNERSHIP' : dependencyCode;
        fail(missingDependencyCode, 'source closure requires an absent dependency');
      }
    }
  }
  return {
    closures,
    spanById,
    closureBySpan,
    dependencies,
    sourceTextByClosure,
    sourceBytesByClosure,
    sourceNodeByClosure,
    agreementIndexByClosure,
    spanBytesById,
    sourceStatusBySpan,
  };
}

function validateTypedValue(fact) {
  const code = 'M7_V2_FACT_ATOMICITY';
  if (fact.atomicity !== 'ATOMIC_TYPED_VALUE'
      || /(?:CLAUSE|SUBCLAUSE|SOURCE|QUOTE|BLOB|PROSE|TEXT_BLOCK)/.test(fact.value_type)) {
    fail(code, `fact ${fact.fact_id} is not an atomic typed value`);
  }
  if (fact.value_type === 'PARTY_SET') {
    exactKeys(fact.typed_value, ['parties'], code, 'party set');
    array(fact.typed_value.parties, code, 'parties');
    if (fact.typed_value.parties.length === 0) fail(code, 'party set is empty');
    fact.typed_value.parties.forEach((party) => string(party, code, 'party'));
    unique(fact.typed_value.parties, code, 'party set');
    return;
  }
  if (fact.value_type === 'ENUM' || fact.value_type === 'PARTY'
      || fact.value_type === 'DEFINED_TERM' || fact.value_type === 'DATE'
      || fact.value_type === 'REFERENCE') {
    string(fact.typed_value, code, `${fact.value_type} value`);
    return;
  }
  if (fact.value_type === 'BOOLEAN') {
    if (typeof fact.typed_value !== 'boolean') fail(code, 'boolean fact is not boolean');
    return;
  }
  if (fact.value_type === 'NUMBER' || fact.value_type === 'PERCENTAGE') {
    if (typeof fact.typed_value !== 'number' || !Number.isFinite(fact.typed_value)) {
      fail(code, `${fact.value_type} fact is not finite`);
    }
    return;
  }
  if (fact.value_type === 'DURATION' || fact.value_type === 'PERIOD') {
    exactKeys(fact.typed_value, ['bound_type', 'count', 'unit'], code, 'duration value');
    const permittedBounds = fact.value_type === 'DURATION'
      ? ['EXACT', 'WITHIN', 'AT_LEAST'] : ['EXACT', 'WITHIN'];
    if (!permittedBounds.includes(fact.typed_value.bound_type)) {
      fail(code, 'duration bound is outside the closed vocabulary');
    }
    if (!Number.isInteger(fact.typed_value.count) || fact.typed_value.count < 0) {
      fail(code, 'duration count is invalid');
    }
    if (!['DAY', 'WEEK', 'MONTH', 'YEAR'].includes(fact.typed_value.unit)) {
      fail(code, 'duration unit is outside the closed vocabulary');
    }
    return;
  }
  if (fact.value_type === 'MONEY') {
    exactKeys(fact.typed_value, ['amount', 'currency'], code, 'money value');
    if (typeof fact.typed_value.amount !== 'number' || !Number.isFinite(fact.typed_value.amount)) {
      fail(code, 'money amount is invalid');
    }
    string(fact.typed_value.currency, code, 'money currency');
    return;
  }
  fail(code, `fact ${fact.fact_id} uses an unapproved value type`);
}

function validateFocusedSourceAuthorityContinuity(analysis, sources, semanticInputs) {
  const code = 'M7_V2_INPUT_CONSUMPTION';
  const focusedItems = [
    {
      ordinal: 28,
      agreementId: ITEM28_AGREEMENT_ID,
      sourceNodeId: ITEM28_SOURCE_NODE_ID,
      decisionId: ITEM28_DECISION_ID,
    },
    {
      ordinal: 42,
      agreementId: ITEM42_44_AGREEMENT_ID,
      sourceNodeId: ITEM42_SOURCE_NODE_ID,
      decisionId: ITEM42_DECISION_ID,
    },
    {
      ordinal: 44,
      agreementId: ITEM42_44_AGREEMENT_ID,
      sourceNodeId: ITEM44_SOURCE_NODE_ID,
      decisionId: ITEM44_DECISION_ID,
    },
  ];
  const fixedIndexBindingKeys = [
    'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  ];
  const fixedSpanKeys = [
    'coordinate_system', 'source_node_occurrence_id', 'start_byte', 'end_byte',
    'text_sha256',
  ];
  for (const focused of focusedItems) {
    const matches = [...sources.closures.values()].filter(
      (closure) => analysis.agreement_id === focused.agreementId
        && closure.source_node_occurrence_id === focused.sourceNodeId,
    );
    if (matches.length === 0) continue;
    if (matches.length !== 1) {
      fail(code, `focused item ${focused.ordinal} has no unique immutable source closure`);
    }
    const closure = matches[0];
    const authority = semanticInputs.decisionAuthorities.get(focused.decisionId);
    const fixedMember = authority?.fixedMember;
    const packetMember = authority?.packetMember;
    if (!fixedMember || !packetMember
        || fixedMember.sample_ordinal !== focused.ordinal
        || packetMember.sample_ordinal !== focused.ordinal
        || fixedMember.agreement_id !== analysis.agreement_id
        || packetMember.agreement_id !== analysis.agreement_id
        || !same(fixedMember.source_node_occurrence_ids, [focused.sourceNodeId])
        || !same(packetMember.source_node_occurrence_ids, [focused.sourceNodeId])) {
      fail(code, `focused item ${focused.ordinal} lacks its exact immutable sample authority`);
    }
    exactKeys(fixedMember.agreement_index_binding, fixedIndexBindingKeys, code,
      `focused item ${focused.ordinal} fixed AgreementIndex binding`);
    exactKeys(fixedMember.canonical_source_binding, [
      'canonical_text_id', 'canonical_text_sha256', 'canonical_text_byte_length',
    ], code, `focused item ${focused.ordinal} fixed canonical source binding`);
    const closureIndexBinding = Object.fromEntries(fixedIndexBindingKeys.map(
      (key) => [key, closure.agreement_index_binding[key]],
    ));
    const fixedSpans = array(fixedMember.source_spans, code,
      `focused item ${focused.ordinal} fixed source spans`);
    if (fixedSpans.length !== 1) {
      fail(code, `focused item ${focused.ordinal} does not have one exact immutable source span`);
    }
    const fixedSpan = fixedSpans[0];
    exactKeys(fixedSpan, fixedSpanKeys, code,
      `focused item ${focused.ordinal} fixed source span`);
    const sourceBytes = sources.sourceBytesByClosure.get(closure.source_closure_id);
    const sourceNode = sources.sourceNodeByClosure.get(closure.source_closure_id);
    const agreementIndex = sources.agreementIndexByClosure.get(closure.source_closure_id);
    const excerptBytes = sourceBytes?.subarray(
      closure.governing_start_byte, closure.governing_end_byte,
    );
    const expectedSpan = {
      coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      source_node_occurrence_id: closure.source_node_occurrence_id,
      start_byte: closure.governing_start_byte,
      end_byte: closure.governing_end_byte,
      text_sha256: excerptBytes ? sha256Hex(excerptBytes) : null,
    };
    if (!same(closureIndexBinding, fixedMember.agreement_index_binding)
        || !same(closure.canonical_source_binding, fixedMember.canonical_source_binding)
        || !same(fixedSpan, expectedSpan)
        || fixedMember.source_excerpt_sha256 !== expectedSpan.text_sha256
        || packetMember.source_excerpt_sha256 !== expectedSpan.text_sha256
        || agreementIndex?.agreement_index_id !== fixedMember.agreement_index_binding.record_id
        || agreementIndex?.source_binding?.agreement_id !== fixedMember.agreement_id
        || sourceNode?.node_occurrence_id !== focused.sourceNodeId
        || !same(sourceNode?.extent_span, {
          coordinate_system: fixedSpan.coordinate_system,
          start_byte: fixedSpan.start_byte,
          end_byte: fixedSpan.end_byte,
          text_sha256: fixedSpan.text_sha256,
        })) {
      fail(code,
        `focused item ${focused.ordinal} source bytes or bindings drift from the immutable sample`);
    }
  }
}

function normalisedWords(value) {
  return value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function validateDistinctExpressionChildren(expression) {
  const seen = new Set();
  for (const child of expression.children) {
    const key = `${child.kind}:${child.id}`;
    if (seen.has(key)) {
      fail('M7_V2_EXPRESSION_TOPOLOGY', `expression contains duplicate child ${key}`);
    }
    seen.add(key);
  }
}

function sourceTextForSpanIds(
  spanIds, sources, code, label, { atomic = false, includeAtomicEvidence = false } = {},
) {
  const selected = spanIds.map((spanId) => {
    const span = sources.spanById.get(spanId);
    const value = sources.spanBytesById.get(spanId);
    if (!span || !value) fail(code, `${label} cites an unknown source span`);
    return { span, value };
  });
  const spans = [...selected].sort((left, right) => left.span.start_byte - right.span.start_byte);
  if (!same(selected.map((entry) => entry.span.span_id),
    spans.map((entry) => entry.span.span_id))) {
    fail(code, `${label} source spans are not in document order`);
  }
  if (atomic && spans.some(
    (entry, index) => index > 0 && spans[index - 1].span.end_byte !== entry.span.start_byte,
  )) {
    fail(code, `${label} omits source bytes between atomic spans`);
  }
  const boundBytes = Buffer.concat(spans.map((entry) => entry.value));
  const boundText = boundBytes.toString('utf8');
  if (!atomic) return boundText.trim();
  if (spans.length === 0
      || boundBytes.length !== spans[spans.length - 1].span.end_byte - spans[0].span.start_byte) {
    fail(code, `${label} does not exactly cover its bound source range`);
  }
  const boundaryMatch = boundText.match(/^(\s*)([\s\S]*?)(\s*)$/u);
  if (!boundaryMatch || boundaryMatch[2].length === 0) {
    fail(code, `${label} contains no atomic source text`);
  }
  const text = boundaryMatch[2];
  if (!includeAtomicEvidence) return text;
  const parseStartByte = spans[0].span.start_byte
    + Buffer.byteLength(boundaryMatch[1], 'utf8');
  return {
    text,
    bound_text: boundText,
    bound_start_byte: spans[0].span.start_byte,
    bound_end_byte: spans[spans.length - 1].span.end_byte,
    parse_start_byte: parseStartByte,
    parse_end_byte: parseStartByte + Buffer.byteLength(text, 'utf8'),
    spans,
  };
}

function validateExpressionSourceOrder(expression, sources) {
  const code = 'M7_V2_EXPRESSION_PROVENANCE';
  for (const [field, label] of [
    ['connective_span_ids', 'expression connective spans'],
    ['authored_limb_marker_span_ids', 'expression authored marker spans'],
    ['scope_span_ids', 'expression scope spans'],
  ]) {
    sourceTextForSpanIds(expression[field], sources, code, label);
  }
}

function validateExpressionScopeEvidence(expressions, facts, rules = new Map()) {
  const provenanceCode = 'M7_V2_EXPRESSION_PROVENANCE';
  const visiting = new Set();
  const visited = new Set();
  const visit = (expressionId) => {
    if (visited.has(expressionId) || visiting.has(expressionId)) return;
    const expression = expressions.get(expressionId);
    if (!expression) return;
    visiting.add(expressionId);
    const requiredSpanIds = new Set([
      ...expression.connective_span_ids,
      ...expression.authored_limb_marker_span_ids,
    ]);
    const includeFactEvidence = (factId) => {
      const fact = facts.get(factId);
      if (!fact) return;
      for (const spanId of fact.source_support_ids) requiredSpanIds.add(spanId);
    };
    const includeExpressionEvidence = (childExpressionId) => {
      const childExpression = expressions.get(childExpressionId);
      if (!childExpression) return;
      visit(childExpressionId);
      for (const spanId of childExpression.scope_span_ids) requiredSpanIds.add(spanId);
    };
    for (const child of expression.children) {
      if (child.kind === 'FACT') includeFactEvidence(child.id);
      if (child.kind === 'EXPRESSION') includeExpressionEvidence(child.id);
      if (child.kind === 'RULE') {
        const childRule = rules.get(child.id);
        if (!childRule) continue;
        for (const factId of childRule.fact_ids) includeFactEvidence(factId);
        includeExpressionEvidence(childRule.root_expression_id);
      }
    }
    const scope = new Set(expression.scope_span_ids);
    for (const spanId of requiredSpanIds) {
      if (!scope.has(spanId)) {
        fail(provenanceCode,
          `expression ${expression.expression_id} scope omits required evidence span ${spanId}`);
      }
    }
    visiting.delete(expressionId);
    visited.add(expressionId);
  };
  for (const expressionId of expressions.keys()) visit(expressionId);
}

function partyAliasTokens(value, code) {
  const separator = /\p{White_Space}*(?:,\p{White_Space}*(?:(?:and|or)\p{White_Space}+)?|\b(?:and|or)\b\p{White_Space}+)/giu;
  const aliases = [];
  let cursor = 0;
  for (const match of value.matchAll(separator)) {
    aliases.push({ text: value.slice(cursor, match.index), start: cursor, end: match.index });
    cursor = match.index + match[0].length;
  }
  aliases.push({ text: value.slice(cursor), start: cursor, end: value.length });
  const aliasGrammar = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}&'’().\-]*(?:[\p{Zs}\t]+[\p{L}\p{N}][\p{L}\p{N}\p{M}&'’().\-]*)*$/u;
  if (aliases.some((alias) => !aliasGrammar.test(alias.text))) {
    fail(code, 'party alias source is not one closed alias list');
  }
  return aliases;
}

function partyEdgeInterval(edge, allowedSpanIds, sources, code) {
  if (edge.edge_type !== 'PARTY_ALIAS') {
    fail(code, 'party alias normalisation uses a non-party context edge');
  }
  const supportIds = array(edge.source_support_ids, code, 'party context-edge supports');
  if (supportIds.length === 0) fail(code, 'party context edge has no source support');
  unique(supportIds, code, 'party context-edge supports');
  if (supportIds.some((spanId) => !allowedSpanIds.has(spanId))) {
    fail(code, 'party context-edge support lies outside the party fact source');
  }
  const supports = supportIds.map((spanId) => {
    const span = sources.spanById.get(spanId);
    if (!span) fail(code, 'party context edge cites an unknown source span');
    return span;
  });
  const ordered = [...supports].sort((left, right) => left.start_byte - right.start_byte);
  if (!same(supports.map((span) => span.span_id), ordered.map((span) => span.span_id))
      || ordered.some((span, index) => index > 0
        && ordered[index - 1].end_byte !== span.start_byte)) {
    fail(code, 'party context-edge supports are not one ordered contiguous token');
  }
  return {
    start_byte: ordered[0].start_byte,
    end_byte: ordered[ordered.length - 1].end_byte,
    target_id: edge.target_id,
  };
}

function atomicNumber(value, code, label) {
  if (!/^-?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/u.test(value)) {
    fail(code, `${label} is not one complete number`);
  }
  const result = Number(value.replace(/,/gu, ''));
  if (!Number.isFinite(result)) fail(code, `${label} is not finite`);
  return result;
}

function rejectClauseText(value, code, label) {
  if (/\b(?:shall|must|may|will|if|unless|except|provided|subject\s+to|within|before|after|earlier|later|until|when|where|upon)\b/iu.test(
    value,
  )) {
    fail(code, `${label} contains operative or conditional text`);
  }
}

function recomputeNormalisedValue(fact, sources, semanticInputs) {
  const code = 'M7_V2_FACT_ATOMICITY';
  const proof = fact.normalisation_proof;
  exactKeys(proof, [
    'rule_id', 'input_source_span_ids', 'input_context_edge_ids', 'result_digest',
  ], code, 'fact normalisation proof');
  if (!NORMALISATION_RULES.includes(proof.rule_id)) {
    fail(code, `fact ${fact.fact_id} uses an unapproved normalisation rule`);
  }
  if (!NORMALISATION_VALUE_TYPES.get(proof.rule_id)?.includes(fact.value_type)) {
    fail(code, `fact ${fact.fact_id} uses a normalisation rule for another value type`);
  }
  const spanIds = array(proof.input_source_span_ids, code, 'normalisation source spans');
  const contextIds = array(proof.input_context_edge_ids, code, 'normalisation context edges');
  if (!same(spanIds, fact.source_support_ids)) {
    fail(code, `fact ${fact.fact_id} normalises different source spans`);
  }
  unique(spanIds, code, 'normalisation source spans');
  unique(contextIds, code, 'normalisation context edges');
  const contextEdges = contextIds.map((edgeId) => {
    const edge = semanticInputs.contextEdges.get(edgeId);
    if (!edge || edge.state !== 'RESOLVED') {
      fail(code, `fact ${fact.fact_id} uses an unresolved context edge`);
    }
    return edge;
  });
  const atomicSource = sourceTextForSpanIds(
    spanIds, sources, code, 'normalisation proof',
    { atomic: true, includeAtomicEvidence: true },
  );
  const sourceText = atomicSource.text;
  if (Buffer.byteLength(atomicSource.bound_text, 'utf8') > 256) {
    fail(code, `fact ${fact.fact_id} normalises a clause-sized source blob`);
  }
  const words = normalisedWords(sourceText);
  let result;
  if (proof.rule_id === 'BOOLEAN_LITERAL_MAP/V1') {
    const values = new Map([
      ['true', true], ['yes', true], ['shall', true], ['must', true],
      ['required', true], ['permitted', true], ['false', false], ['no', false],
      ['not', false], ['prohibited', false],
    ]);
    if (words.length !== 1 || sourceText.toLocaleLowerCase('en-US') !== words[0]
        || !values.has(words[0])) {
      fail(code, 'boolean source is not one complete approved literal');
    }
    result = values.get(words[0]);
  } else if (proof.rule_id === 'NUMBER_PARSER/V1'
      || proof.rule_id === 'PERCENTAGE_PARSER/V1') {
    if (proof.rule_id === 'PERCENTAGE_PARSER/V1') {
      const match = sourceText.match(/^(.+?)(?:%|\s+percent)$/iu);
      if (!match) fail(code, 'percentage source is not one complete percentage');
      result = atomicNumber(match[1], code, 'percentage source');
    } else {
      result = atomicNumber(sourceText, code, 'numeric source');
    }
  } else if (proof.rule_id === 'MONEY_PARSER/V1') {
    const match = sourceText.match(/^(USD|EUR|GBP|CAD|AUD|JPY)\s+(.+)$/iu);
    if (!match) fail(code, 'money source is not one complete currency amount');
    result = {
      amount: atomicNumber(match[2], code, 'money amount'),
      currency: match[1].toUpperCase(),
    };
  } else if (proof.rule_id === 'DURATION_PARSER/V1') {
    const match = sourceText.match(
      /^(?:(not less than|within|exactly)\s+)?(?:(0|[1-9]\d*)|([a-z]+)\s*\((0|[1-9]\d*)\))\s+(day|days|week|weeks|month|months|year|years)$/iu,
    );
    if (!match) fail(code, 'duration source is not one complete legal-number duration');
    const numberWords = new Map([
      ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
      ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
    ]);
    const wordCount = match[3] === undefined
      ? null : numberWords.get(match[3].toLocaleLowerCase('en-US'));
    const numericCount = Number(match[2] ?? match[4]);
    if (match[3] !== undefined && (wordCount === undefined || wordCount !== numericCount)) {
      fail(code, 'duration word and parenthesised numeral do not agree');
    }
    const prefix = match[1]?.toLocaleLowerCase('en-US') ?? null;
    result = {
      bound_type: prefix === 'not less than' ? 'AT_LEAST'
        : prefix === 'within' ? 'WITHIN' : 'EXACT',
      count: numericCount,
      unit: match[5].toUpperCase().replace(/S$/u, ''),
    };
  } else if (proof.rule_id === 'PERIOD_PARSER/V1') {
    const match = sourceText.match(
      /^(?:(within|exactly)\s+)?(0|[1-9]\d*)\s+(day|days|week|weeks|month|months|year|years)$/iu,
    );
    if (!match) fail(code, 'period source is not one complete period');
    result = {
      bound_type: match[1]?.toUpperCase() === 'WITHIN' ? 'WITHIN' : 'EXACT',
      count: Number(match[2]),
      unit: match[3].toUpperCase().replace(/S$/u, ''),
    };
  } else if (proof.rule_id === 'DATE_ISO_PARSER/V1') {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(sourceText)) {
      fail(code, 'date source is not one complete ISO date');
    }
    result = sourceText;
  } else if (proof.rule_id === 'BOUND_PARTY_ALIAS/V1') {
    if (!['PARTY', 'PARTY_SET'].includes(fact.value_type)
        || contextEdges.length === 0
        || contextEdges.some((edge) => edge.target_id === null)) {
      fail(code, 'party alias has no exact context target');
    }
    const aliases = partyAliasTokens(sourceText, code);
    if ((fact.value_type === 'PARTY' && aliases.length !== 1)
        || (fact.value_type === 'PARTY_SET' && aliases.length < 2)) {
      fail(code, 'party value cardinality differs from its closed alias-list source');
    }
    const allowedSpanIds = new Set(spanIds);
    const intervalToEdge = new Map();
    for (const edge of contextEdges) {
      const interval = partyEdgeInterval(edge, allowedSpanIds, sources, code);
      const intervalKey = `${interval.start_byte}:${interval.end_byte}`;
      if (intervalToEdge.has(intervalKey)) {
        fail(code, 'more than one party context edge claims the same alias token');
      }
      intervalToEdge.set(intervalKey, interval);
    }
    const partyTargets = aliases.map((alias) => {
      const startByte = atomicSource.parse_start_byte
        + Buffer.byteLength(sourceText.slice(0, alias.start), 'utf8');
      const endByte = atomicSource.parse_start_byte
        + Buffer.byteLength(sourceText.slice(0, alias.end), 'utf8');
      const edge = intervalToEdge.get(`${startByte}:${endByte}`);
      if (!edge) fail(code, 'party alias token lacks exact context-edge source support');
      return edge.target_id;
    });
    if (intervalToEdge.size !== aliases.length
        || new Set(partyTargets).size !== partyTargets.length) {
      fail(code, 'party alias context does not identify one atomic party value');
    }
    result = fact.value_type === 'PARTY_SET'
      ? { parties: partyTargets }
      : partyTargets[0];
  } else if (proof.rule_id === 'REFERENCE_EDGE/V1') {
    if (contextEdges.length !== 1 || contextEdges[0].target_id === null
        || contextEdges[0].edge_type !== 'REFERENCE_TARGET'
        || !same(contextEdges[0].source_support_ids, spanIds)) {
      fail(code, 'reference edge is not exact');
    }
    if (!/^(?:section|article|clause|schedule|exhibit|annex)\s+[\p{L}\p{N}().\-]+$/iu.test(
      sourceText,
    )) {
      fail(code, 'reference source is not one complete reference');
    }
    result = contextEdges[0].target_id;
  } else if (proof.rule_id === 'ENUM_LITERAL_MAP/V1') {
    if (!/^[\p{L}\p{N}'’]+(?:[ _-][\p{L}\p{N}'’]+)*$/u.test(sourceText)
        || /\b(?:and|or|if|unless|except|provided|earlier|later)\b/iu.test(sourceText)) {
      fail(code, 'enum source hides a clause or operative connective');
    }
    result = words.join('_').toUpperCase();
  } else if (proof.rule_id === 'DEFINED_TERM_REFERENCE/V1') {
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}&'’().,\- ]*$/u.test(sourceText)) {
      fail(code, 'defined-term source is not one complete term');
    }
    rejectClauseText(sourceText, code, 'defined-term source');
    result = sourceText;
  } else {
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M}_.'’/%-]*$/u.test(sourceText)
        || /\b(?:and|or|if|unless|except|provided|earlier|later)\b/iu.test(sourceText)) {
      fail(code, 'exact-token source hides a clause or operative connective');
    }
    result = sourceText;
  }
  if (!same(result, fact.typed_value)
      || proof.result_digest !== sha256Hex(canonicalJson(result))) {
    fail(code, `fact ${fact.fact_id} typed value is not recomputed from bound evidence`);
  }
}

function validateFacts(analysis, sources, semanticInputs) {
  const code = 'M7_V2_FACT';
  const rules = indexBy(array(analysis.rules, code, 'rules'), 'rule_id', code, 'rule');
  const facts = indexBy(array(analysis.facts, code, 'facts'), 'fact_id', code, 'fact');
  const semanticOwners = new Map();
  for (const fact of facts.values()) {
    exactKeys(fact, [
      'fact_id',
      'semantic_fact_key',
      'owner_rule_id',
      'field_key',
      'label_id',
      'value_type',
      'typed_value',
      'materiality',
      'atomicity',
      'legal_effect_role',
      'legal_subject',
      'temporal_scope_signature',
      'source_support_ids',
      'dependency_ids',
      'normalisation_proof',
      'display_rule',
    ], code, `fact ${fact.fact_id}`);
    string(fact.semantic_fact_key, code, 'semantic fact key');
    string(fact.owner_rule_id, code, 'fact owner rule');
    string(fact.field_key, code, 'fact field key');
    string(fact.label_id, code, 'fact label');
    string(fact.value_type, code, 'fact value type');
    string(fact.legal_effect_role, code, 'fact legal-effect role');
    string(fact.legal_subject, code, 'fact legal subject');
    string(fact.temporal_scope_signature, code, 'fact temporal scope signature');
    if (!['MATERIAL', 'NON_MATERIAL'].includes(fact.materiality)) {
      fail(code, 'fact materiality is invalid');
    }
    if (!['DISPLAY_REQUIRED', 'DISPLAY_OPTIONAL', 'NEVER_DISPLAY'].includes(fact.display_rule)) {
      fail(code, 'fact display rule is invalid');
    }
    if (fact.materiality === 'MATERIAL' && fact.display_rule !== 'DISPLAY_REQUIRED') {
      fail(code, `material fact ${fact.fact_id} may not be hidden by a display rule`);
    }
    validateTypedValue(fact);
    recomputeNormalisedValue(fact, sources, semanticInputs);
    const expectedSemanticKey = contentId(FACT_SCHEMA, {
      agreement_id: analysis.agreement_id,
      field_key: fact.field_key,
      normalised_typed_value: fact.typed_value,
      legal_subject: fact.legal_subject,
      temporal_scope_signature: fact.temporal_scope_signature,
      source_support_ids: fact.source_support_ids,
      legal_effect_role: fact.legal_effect_role,
    });
    if (fact.semantic_fact_key !== expectedSemanticKey) {
      fail('M7_V2_FACT_OWNERSHIP', `fact ${fact.fact_id} semantic identity is false`);
    }
    if (fact.fact_id !== contentId(FACT_SCHEMA, {
      agreement_id: analysis.agreement_id,
      semantic_fact_key: fact.semantic_fact_key,
    })) fail('M7_V2_FACT_OWNERSHIP', `fact ${fact.fact_id} content identity is false`);
    const owner = rules.get(fact.owner_rule_id);
    if (!owner || !Array.isArray(owner.fact_ids) || !owner.fact_ids.includes(fact.fact_id)) {
      fail('M7_V2_FACT_OWNERSHIP', `fact ${fact.fact_id} has no exact owner`);
    }
    if (semanticOwners.has(fact.semantic_fact_key)) {
      fail('M7_V2_FACT_OWNERSHIP', `semantic fact ${fact.semantic_fact_key} has two owners`);
    }
    semanticOwners.set(fact.semantic_fact_key, fact.fact_id);
    array(fact.source_support_ids, code, 'fact source supports');
    if (fact.source_support_ids.length === 0) fail(code, `fact ${fact.fact_id} has no provenance`);
    unique(fact.source_support_ids, code, 'fact source supports');
    for (const spanId of fact.source_support_ids) {
      if (!sources.spanById.has(spanId)
          || sources.closureBySpan.get(spanId) !== owner.source_closure_id) {
        fail(code, `fact ${fact.fact_id} cites source outside its rule closure`);
      }
    }
    array(fact.dependency_ids, code, 'fact dependencies');
    unique(fact.dependency_ids, code, 'fact dependencies');
    for (const dependencyId of fact.dependency_ids) {
      if (!sources.dependencies.has(dependencyId)) {
        fail(code, `fact ${fact.fact_id} cites an unknown dependency`);
      }
    }
  }
  const usedDependencies = new Set([
    ...[...sources.closures.values()].flatMap((closure) => closure.required_dependency_ids),
    ...[...facts.values()].flatMap((fact) => fact.dependency_ids),
    ...array(analysis.ownership_links, code, 'ownership links').flatMap(
      (link) => Array.isArray(link.consumer_dependency_ids) ? link.consumer_dependency_ids : [],
    ),
  ]);
  if ([...sources.dependencies.keys()].some((dependencyId) => !usedDependencies.has(dependencyId))) {
    fail(code, 'analysis contains an unused dependency');
  }
  return { facts, rules };
}

function validateFocusedTemporalProfileContracts(analysis, profiles, rules, sources) {
  if (analysis.agreement_id !== ITEM42_44_AGREEMENT_ID) return;
  const item42Closures = [...sources.closures.values()].filter(
    (closure) => closure.source_node_occurrence_id === ITEM42_SOURCE_NODE_ID,
  );
  if (item42Closures.length === 0) return;
  if (item42Closures.length !== 1) {
    fail('M7_V2_PROFILE_GATE', 'item 42 has more than one profile source closure');
  }
  const itemRules = [...rules.values()].filter(
    (rule) => rule.source_closure_id === item42Closures[0].source_closure_id,
  );
  if (itemRules.length !== 3) return;
  const ruleBySubtype = new Map(itemRules.map(
    (rule) => [profiles.get(rule.profile_id)?.subtype_path.at(-1), rule],
  ));
  const rightsRule = ruleBySubtype.get('RIGHTS_SURVIVAL');
  const noAdverseRule = ruleBySubtype.get('NO_ADVERSE_AMENDMENT');
  const claimRule = ruleBySubtype.get('CLAIM_CONTINUATION');
  if (!rightsRule || !noAdverseRule || !claimRule) return;
  const rightsProfile = profiles.get(rightsRule.profile_id);
  const noAdverseProfile = profiles.get(noAdverseRule.profile_id);
  const claimProfile = profiles.get(claimRule.profile_id);
  const exactSharedSourceProfileIds = new Set([
    rightsRule.profile_id, noAdverseRule.profile_id,
  ]);
  const expectedClaimDependencies = [{
    dependency_type: 'DURATION_CONDITION_REFERENCE',
    lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
  }];
  const expectedClaimDelegation = [{
    dimension_key: 'CLAIM_CONTINUATION_PERIOD_REFERENCE',
    disposition: 'DELEGATED',
    lawyer_ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
    owner_profile_id: rightsRule.profile_id,
    owner_field_key: 'RIGHTS_SURVIVAL_DURATION',
  }];
  if (!same(rightsProfile?.shared_source_lawyer_decision_ids, [ITEM42_DECISION_ID])
      || !same(noAdverseProfile?.shared_source_lawyer_decision_ids, [ITEM42_DECISION_ID])
      || !same(claimProfile?.shared_source_lawyer_decision_ids, [])
      || !same(claimProfile?.allowed_dependency_types, expectedClaimDependencies)
      || !same(claimProfile?.excluded_or_delegated_dimensions, expectedClaimDelegation)
      || [...profiles.values()].some((profile) => (
        profile.shared_source_lawyer_decision_ids.includes(ITEM42_DECISION_ID)
          !== exactSharedSourceProfileIds.has(profile.profile_id)
      ))) {
    fail('M7_V2_PROFILE_GATE',
      'item-42 profiles lack the exact shared-source and delegated-duration authority');
  }
}

function durationReferenceValue(sourceText, code) {
  const match = sourceText.match(
    /^such (zero|one|two|three|four|five|six|seven|eight|nine|ten)-(day|week|month|year) period$/iu,
  );
  if (!match) fail(code, 'duration reference is not one complete deictic period reference');
  const numberWords = new Map([
    ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
    ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ]);
  return {
    count: numberWords.get(match[1].toLocaleLowerCase('en-US')),
    unit: match[2].toUpperCase(),
  };
}

function validateOwnershipLinks(analysis, facts, rules, profiles, sources, semanticInputs) {
  const code = 'M7_V2_FACT_OWNERSHIP';
  const links = indexBy(array(analysis.ownership_links, code, 'ownership links'),
    'link_id', code, 'ownership link');
  for (const link of links.values()) {
    exactKeys(link, [
      'link_id',
      'consumer_rule_id',
      'owner_rule_id',
      'owner_fact_id',
      'resolved_owner_target_id',
      'source_support_ids',
      'consumer_reference_span_ids',
      'consumer_dependency_ids',
      'consumer_context_edge_ids',
    ], code, 'ownership link');
    const unsignedLink = { ...link };
    delete unsignedLink.link_id;
    if (link.link_id !== contentId('AGREEMENT_SEMANTIC_OWNERSHIP_LINK/V2', unsignedLink)) {
      fail(code, 'ownership link content identity is invalid');
    }
    const consumer = rules.get(link.consumer_rule_id);
    const owner = rules.get(link.owner_rule_id);
    const fact = facts.get(link.owner_fact_id);
    string(link.resolved_owner_target_id, code, 'resolved owner target ID');
    if (!consumer || !owner || !fact || fact.owner_rule_id !== owner.rule_id
        || !consumer.consumer_link_ids.includes(link.link_id)
        || !same(link.source_support_ids, fact.source_support_ids)) {
      fail(code, `ownership link ${link.link_id} does not resolve to its canonical owner`);
    }
    const referenceSpanIds = array(link.consumer_reference_span_ids, code,
      'consumer reference spans');
    const dependencyIds = array(link.consumer_dependency_ids, code,
      'consumer reference dependencies');
    const contextEdgeIds = array(link.consumer_context_edge_ids, code,
      'consumer reference context edges');
    if (referenceSpanIds.length === 0 || dependencyIds.length === 0
        || contextEdgeIds.length === 0) {
      fail(code, 'consumer ownership link lacks exact reference proof');
    }
    unique(referenceSpanIds, code, 'consumer reference spans');
    unique(dependencyIds, code, 'consumer reference dependencies');
    unique(contextEdgeIds, code, 'consumer reference context edges');
    if (referenceSpanIds.some(
      (spanId) => sources.closureBySpan.get(spanId) !== consumer.source_closure_id,
    )) fail(code, 'consumer reference span falls outside its rule closure');
    const dependencies = dependencyIds.map((dependencyId) => {
      const dependency = sources.dependencies.get(dependencyId);
      if (!dependency || dependency.state !== 'RESOLVED'
          || dependency.target_id !== link.resolved_owner_target_id) {
        fail(code, 'consumer reference uses an unresolved dependency');
      }
      return dependency;
    });
    const expectedContextEdgeIds = [...new Set(
      dependencies.map((dependency) => dependency.context_edge_id),
    )].sort();
    const expectedReferenceSpanIds = [...new Set(
      dependencies.flatMap((dependency) => dependency.source_support_ids),
    )].sort();
    if (!same([...contextEdgeIds].sort(), expectedContextEdgeIds)
        || !same([...referenceSpanIds].sort(), expectedReferenceSpanIds)
        || contextEdgeIds.some((edgeId) => {
          const edge = semanticInputs.contextEdges.get(edgeId);
          return edge?.state !== 'RESOLVED'
            || edge.target_id !== link.resolved_owner_target_id;
        })) {
      fail(code, 'consumer reference spans, dependencies, and context edges do not reconcile');
    }
    const typedOwnerTargets = fact.value_type === 'PARTY_SET'
      ? fact.typed_value.parties
      : ['PARTY', 'DEFINED_TERM', 'REFERENCE'].includes(fact.value_type)
        ? [fact.typed_value]
        : ['DURATION', 'PERIOD'].includes(fact.value_type)
          ? [fact.semantic_fact_key] : [];
    const proofOwnerTargets = fact.normalisation_proof.input_context_edge_ids.map(
      (edgeId) => semanticInputs.contextEdges.get(edgeId)?.target_id,
    ).filter((targetId) => targetId !== null && targetId !== undefined);
    if (![...typedOwnerTargets, ...proofOwnerTargets].includes(
      link.resolved_owner_target_id,
    )) {
      fail(code, 'consumer reference target does not resolve to the chosen canonical owner');
    }
    const consumerProfile = profiles.get(consumer.profile_id);
    const delegated = consumerProfile?.excluded_or_delegated_dimensions.filter(
      (dimension) => dimension.disposition === 'DELEGATED'
        && dimension.owner_profile_id === owner.profile_id
        && dimension.owner_field_key === fact.field_key,
    ) ?? [];
    if (delegated.length !== 1) {
      fail(code, 'consumer ownership link has no exact delegated profile dimension');
    }
    if (['DURATION', 'PERIOD'].includes(fact.value_type)) {
      const dependency = dependencies[0];
      const contextEdge = semanticInputs.contextEdges.get(contextEdgeIds[0]);
      const referenceSource = sourceTextForSpanIds(
        referenceSpanIds, sources, code, 'duration consumer reference', { atomic: true },
      );
      const referencedValue = durationReferenceValue(referenceSource, code);
      if (consumer.input_occurrence_id !== owner.input_occurrence_id
          || delegated[0].dimension_key !== 'CLAIM_CONTINUATION_PERIOD_REFERENCE'
          || dependencyIds.length !== 1 || contextEdgeIds.length !== 1
          || dependency?.dependency_type !== 'DURATION_CONDITION_REFERENCE'
          || contextEdge?.edge_type !== 'DURATION_REFERENCE_TARGET'
          || link.resolved_owner_target_id !== fact.semantic_fact_key
          || referencedValue.count !== fact.typed_value.count
          || referencedValue.unit !== fact.typed_value.unit) {
        fail(code, 'duration consumer link does not resolve the exact deictic owner value');
      }
      const directOwnerRepresentations = consumer.fact_ids.map(
        (factId) => facts.get(factId),
      ).filter((consumerFact) => consumerFact
        && ['DURATION', 'PERIOD'].includes(consumerFact.value_type)
        && (same(consumerFact.typed_value, fact.typed_value)
          || consumerFact.source_support_ids.some(
            (spanId) => fact.source_support_ids.includes(spanId),
          )
          || consumerFact.field_key === fact.field_key
          || consumerFact.semantic_fact_key === link.resolved_owner_target_id));
      if (directOwnerRepresentations.length !== 0) {
        fail(code,
          'duration consumer duplicates its delegated owner instead of using the exact link');
      }
    }
  }
  for (const rule of rules.values()) {
    array(rule.consumer_link_ids, code, 'rule consumer links');
    unique(rule.consumer_link_ids, code, 'rule consumer links');
    for (const linkId of rule.consumer_link_ids) {
      if (!links.has(linkId)) fail(code, `rule ${rule.rule_id} cites an unknown owner link`);
    }
    const profile = profiles.get(rule.profile_id);
    if (!profile) fail(code, `rule ${rule.rule_id} has no profile for ownership links`);
    for (const dimension of profile.excluded_or_delegated_dimensions.filter(
      (entry) => entry.disposition === 'DELEGATED',
    )) {
      const matchingLinks = rule.consumer_link_ids.map((linkId) => links.get(linkId)).filter(
        (link) => {
          const ownerRule = rules.get(link.owner_rule_id);
          const ownerFact = facts.get(link.owner_fact_id);
          return ownerRule?.profile_id === dimension.owner_profile_id
            && ownerFact?.field_key === dimension.owner_field_key;
        },
      );
      if (matchingLinks.length !== 1) {
        fail(code, `delegated dimension ${dimension.dimension_key} lacks one exact owner link`);
      }
    }
  }
  return links;
}

function expressionSignature(rootId, expressions, facts, rules, allowedOperators) {
  const visiting = new Set();
  const visited = new Set();
  const referencedRules = new Set();
  function visit(expressionId, expectedParent, ownerRule) {
    const expression = expressions.get(expressionId);
    if (!expression) fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression child is absent');
    if (visiting.has(expressionId) || visited.has(expressionId)) {
      fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression graph is cyclic or shared');
    }
    if (expression.parent_expression_id !== expectedParent) {
      fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression parent pointer is inconsistent');
    }
    if (!allowedOperators.has(expression.operator)) {
      fail('M7_V2_EXPRESSION_TOPOLOGY', `operator ${expression.operator} is not profile-approved`);
    }
    visiting.add(expressionId);
    const childSignatures = [];
    for (let index = 0; index < expression.children.length; index += 1) {
      const child = expression.children[index];
      if (child.ordinal !== index + 1) {
        fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression child order is not canonical');
      }
      if (child.kind === 'FACT') {
        const fact = facts.get(child.id);
        if (!fact || !ownerRule.fact_ids.includes(fact.fact_id)) {
          fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression fact child is absent or belongs to another rule');
        }
        childSignatures.push(fact.field_key);
      } else if (child.kind === 'EXPRESSION') {
        childSignatures.push(visit(child.id, expressionId, ownerRule));
      } else if (child.kind === 'RULE') {
        const childRule = rules.get(child.id);
        if (!childRule || !ownerRule.child_rule_ids.includes(childRule.rule_id)) {
          fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression rule child is absent or unlinked');
        }
        referencedRules.add(childRule.rule_id);
        childSignatures.push(`RULE(${childRule.expression_signature})`);
      } else if (child.kind === 'GOVERNED_DISCLOSURE_NOTE') {
        childSignatures.push(`GOVERNED_DISCLOSURE_NOTE(${child.id})`);
      } else {
        fail('M7_V2_EXPRESSION_TOPOLOGY', 'expression child kind is invalid');
      }
    }
    visiting.delete(expressionId);
    visited.add(expressionId);
    return `${expression.operator}(${childSignatures.join(',')})`;
  }
  return (ownerRule) => ({
    signature: visit(rootId, null, ownerRule),
    visited,
    referencedRules,
  });
}

function freezeTemporalPhase1Capability(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    freezeTemporalPhase1Capability(child);
  }
  return Object.freeze(value);
}

function sameTemporalPhase1Value(actual, expected) {
  try {
    return canonicalJson(actual) === canonicalJson(expected);
  } catch {
    return false;
  }
}

function validateTemporalPhase1AuthorityEnvelope(envelope) {
  const code = 'M7_V2_TEMPORAL_PHASE1_AUTHORITY_DRIFT';
  object(envelope, code, 'temporalPhase1Authority');
  exactKeys(envelope, ['binding', 'record'], code, 'temporalPhase1Authority');
  object(envelope.binding, code, 'temporalPhase1Authority.binding');
  exactKeys(
    envelope.binding,
    [
      'byte_length',
      'path',
      'record_id',
      'record_id_field',
      'schema_version',
      'sha256',
    ],
    code,
    'temporalPhase1Authority.binding',
  );
  object(envelope.record, code, 'temporalPhase1Authority.record');

  const binding = envelope.binding;
  const record = envelope.record;
  if (
    binding.byte_length !== TEMPORAL_PHASE1_AUTHORITY_BYTE_LENGTH
    || binding.path !== TEMPORAL_PHASE1_AUTHORITY_PATH
    || binding.record_id !== TEMPORAL_PHASE1_AUTHORITY_ID
    || binding.record_id_field !== 'temporal_phase1_authority_id'
    || binding.schema_version !== TEMPORAL_PHASE1_AUTHORITY_SCHEMA
    || binding.sha256 !== TEMPORAL_PHASE1_AUTHORITY_SHA256
    || record.schema_version !== TEMPORAL_PHASE1_AUTHORITY_SCHEMA
    || record.temporal_phase1_authority_id !== TEMPORAL_PHASE1_AUTHORITY_ID
  ) {
    fail(code, 'temporal Phase 1 authority binding does not match the sealed record');
  }

  let recordBytes;
  let recomputedRecordId;
  try {
    recordBytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
    const unsignedRecord = { ...record };
    delete unsignedRecord.temporal_phase1_authority_id;
    recomputedRecordId = contentId(TEMPORAL_PHASE1_AUTHORITY_SCHEMA, unsignedRecord);
  } catch {
    fail(code, 'temporal Phase 1 authority record is not canonical');
  }
  if (
    recordBytes.length !== TEMPORAL_PHASE1_AUTHORITY_BYTE_LENGTH
    || sha256Hex(recordBytes) !== TEMPORAL_PHASE1_AUTHORITY_SHA256
    || recomputedRecordId !== TEMPORAL_PHASE1_AUTHORITY_ID
  ) {
    fail(code, 'temporal Phase 1 authority record bytes do not match the sealed record');
  }

  const capability = JSON.parse(canonicalJson({
    policy_overlay: record.policy_overlay,
    red_hat_source_authority: record.red_hat_source_authority,
  }));
  return freezeTemporalPhase1Capability(capability);
}

function validateTemporalPhase1SyntheticExpressionEvidence(input) {
  const topologyCode = 'M7_V2_EXPRESSION_TOPOLOGY';
  const provenanceCode = 'M7_V2_EXPRESSION_PROVENANCE';
  const capability = validateTemporalPhase1AuthorityEnvelope(
    input.temporalPhase1Authority,
  );
  exactKeys(
    input,
    [
      'temporalPhase1Authority',
      'source_text',
      'source_spans',
      'facts',
      'expressions',
      'links',
    ],
    topologyCode,
    'synthetic temporal Phase 1 expression evidence',
  );

  const sourceText = string(input.source_text, provenanceCode, 'source_text');
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const sourceSpans = array(input.source_spans, provenanceCode, 'source_spans');
  const spanById = new Map();
  const spanTextById = new Map();
  for (const [index, sourceSpan] of sourceSpans.entries()) {
    object(sourceSpan, provenanceCode, `source_spans[${index}]`);
    exactKeys(
      sourceSpan,
      ['span_id', 'start_byte', 'end_byte'],
      provenanceCode,
      `source_spans[${index}]`,
    );
    const spanId = string(
      sourceSpan.span_id,
      provenanceCode,
      `source_spans[${index}].span_id`,
    );
    if (
      spanById.has(spanId)
      || !Number.isInteger(sourceSpan.start_byte)
      || !Number.isInteger(sourceSpan.end_byte)
      || sourceSpan.start_byte < 0
      || sourceSpan.end_byte <= sourceSpan.start_byte
      || sourceSpan.end_byte > sourceBytes.length
    ) {
      fail(provenanceCode, `source span ${spanId} is duplicated or out of range`);
    }
    spanById.set(spanId, sourceSpan);
    spanTextById.set(
      spanId,
      sourceBytes.subarray(sourceSpan.start_byte, sourceSpan.end_byte).toString('utf8'),
    );
  }

  const referenceContract = capability.policy_overlay.event_reference_contract;
  const requiredSignature =
    capability.policy_overlay.required_synthetic_signatures.red_hat_7_01_c_ii;
  const expectedSignature =
    'ON_OR_BEFORE(INTENT_ADVANCE_NOTICE_EVENT,'
    + 'OFFSET_BEFORE(TERMINATION_EXERCISE_EVENT_REFERENCE,INTENT_NOTICE_LEAD_PERIOD))';
  if (
    !referenceContract
    || requiredSignature !== expectedSignature
    || referenceContract.owner_fact_field_key !== 'TERMINATION_EXERCISE_NOTICE_EVENT'
    || referenceContract.consumer_fact_field_key !== 'TERMINATION_EXERCISE_EVENT_REFERENCE'
    || referenceContract.consumer_fact_value_type !== 'REFERENCE'
    || referenceContract.edge_rule_id !== 'EVENT_REFERENCE_EDGE/V1'
    || referenceContract.edge_type !== 'EVENT_REFERENCE_TARGET'
  ) {
    fail(
      'M7_V2_TEMPORAL_PHASE1_AUTHORITY_DRIFT',
      'sealed temporal Phase 1 capability does not contain the required c(ii) grant',
    );
  }

  const authoritySupportByLabel = new Map(
    capability.red_hat_source_authority.exact_support_spans.map(
      (support) => [support.label, support.source_span],
    ),
  );
  const factSpecs = new Map([
    [
      referenceContract.owner_fact_field_key,
      {
        ownerRuleId: 'rule:chapeau-owner',
        sourceNodeOccurrenceId: referenceContract.owner_node_occurrence_id,
        valueType: 'ENUM',
        typedValue: 'TERMINATION_EXERCISE_NOTICE',
        normalisationRuleId: 'ENUM_LITERAL_MAP/V1',
        sourceSpanId: 'span:exercise-owner',
        sourceText: 'TERMINATION_EXERCISE_NOTICE_EVENT',
        authoritySupport: referenceContract.owner_support,
      },
    ],
    [
      'INTENT_NOTICE_EVENT',
      {
        ownerRuleId: 'rule:intent-notice',
        sourceNodeOccurrenceId: referenceContract.intent_notice_source_node_occurrence_id,
        valueType: 'ENUM',
        typedValue: 'INTENT_TO_TERMINATE_NOTICE',
        normalisationRuleId: 'ENUM_LITERAL_MAP/V1',
        sourceSpanId: 'span:intent-notice',
        sourceText: 'INTENT_NOTICE_EVENT',
        authoritySupport: referenceContract.intent_notice_support,
      },
    ],
    [
      'INTENT_ADVANCE_NOTICE_EVENT',
      {
        ownerRuleId: 'rule:qualification',
        sourceNodeOccurrenceId: referenceContract.consumer_node_occurrence_id,
        valueType: 'ENUM',
        typedValue: 'INTENT_TO_TERMINATE_NOTICE',
        normalisationRuleId: 'ENUM_LITERAL_MAP/V1',
        sourceSpanId: 'span:advance-intent',
        sourceText: 'INTENT_ADVANCE_NOTICE_EVENT',
        authoritySupport: authoritySupportByLabel.get('CII_ADVANCE_NOTICE_TIMING'),
      },
    ],
    [
      referenceContract.consumer_fact_field_key,
      {
        ownerRuleId: 'rule:qualification',
        sourceNodeOccurrenceId: referenceContract.consumer_node_occurrence_id,
        valueType: referenceContract.consumer_fact_value_type,
        normalisationRuleId: referenceContract.edge_rule_id,
        sourceSpanId: 'span:exercise-reference',
        sourceText: 'TERMINATION_EXERCISE_EVENT_REFERENCE',
        authoritySupport: referenceContract.consumer_reference_support,
      },
    ],
    [
      'INTENT_NOTICE_LEAD_PERIOD',
      {
        ownerRuleId: 'rule:qualification',
        sourceNodeOccurrenceId: referenceContract.consumer_node_occurrence_id,
        valueType: 'DURATION',
        typedValue: { bound_type: 'AT_LEAST', count: 1, unit: 'BUSINESS_DAY' },
        normalisationRuleId: 'DURATION_PARSER/V2',
        sourceSpanId: 'span:lead-period',
        sourceText: 'at least one (1) Business Day',
        authoritySupport: authoritySupportByLabel.get('CII_ONE_BUSINESS_DAY'),
      },
    ],
  ]);

  const facts = array(input.facts, topologyCode, 'facts');
  if (facts.length !== factSpecs.size) {
    fail(topologyCode, 'c(ii) temporal Phase 1 evidence requires exactly five facts');
  }
  const factById = new Map();
  const factByFieldKey = new Map();
  for (const [index, fact] of facts.entries()) {
    object(fact, topologyCode, `facts[${index}]`);
    exactKeys(
      fact,
      [
        'fact_id',
        'semantic_fact_key',
        'owner_rule_id',
        'source_node_occurrence_id',
        'field_key',
        'value_type',
        'typed_value',
        'normalisation_rule_id',
        'source_support_ids',
        'authority_source_support',
      ],
      topologyCode,
      `facts[${index}]`,
    );
    const factId = string(fact.fact_id, topologyCode, `facts[${index}].fact_id`);
    const fieldKey = string(fact.field_key, topologyCode, `facts[${index}].field_key`);
    const spec = factSpecs.get(fieldKey);
    if (!spec || factById.has(factId) || factByFieldKey.has(fieldKey)) {
      fail(topologyCode, `fact ${factId} is duplicated or is not authorised for c(ii)`);
    }
    if (!/^[0-9a-f]{64}$/u.test(fact.semantic_fact_key)) {
      fail(topologyCode, `fact ${factId} has an invalid semantic_fact_key`);
    }
    const sourceSupportIds = array(
      fact.source_support_ids,
      provenanceCode,
      `${factId}.source_support_ids`,
    );
    if (
      sourceSupportIds.length !== 1
      || sourceSupportIds[0] !== spec.sourceSpanId
      || !spanById.has(spec.sourceSpanId)
      || spanTextById.get(spec.sourceSpanId) !== spec.sourceText
      || fact.owner_rule_id !== spec.ownerRuleId
      || fact.source_node_occurrence_id !== spec.sourceNodeOccurrenceId
      || fact.value_type !== spec.valueType
      || fact.normalisation_rule_id !== spec.normalisationRuleId
      || !sameTemporalPhase1Value(fact.authority_source_support, spec.authoritySupport)
    ) {
      fail(provenanceCode, `fact ${factId} does not match its authorised c(ii) source`);
    }
    if (
      Object.prototype.hasOwnProperty.call(spec, 'typedValue')
      && !sameTemporalPhase1Value(fact.typed_value, spec.typedValue)
    ) {
      fail(topologyCode, `fact ${factId} has an invalid typed value`);
    }
    factById.set(factId, fact);
    factByFieldKey.set(fieldKey, fact);
  }

  const ownerFact = factByFieldKey.get(referenceContract.owner_fact_field_key);
  const intentFact = factByFieldKey.get('INTENT_NOTICE_EVENT');
  const advanceIntentFact = factByFieldKey.get('INTENT_ADVANCE_NOTICE_EVENT');
  const referenceFact = factByFieldKey.get(referenceContract.consumer_fact_field_key);
  if (
    ownerFact.semantic_fact_key === intentFact.semantic_fact_key
    || ownerFact.semantic_fact_key === advanceIntentFact.semantic_fact_key
    || ownerFact.semantic_fact_key === referenceFact.semantic_fact_key
    || referenceFact.typed_value !== ownerFact.semantic_fact_key
  ) {
    fail(
      topologyCode,
      'intent roles, event reference, and termination exercise owner must preserve their authorised identities',
    );
  }

  const operatorContracts = new Map([
    [
      'ON_OR_BEFORE',
      {
        resultKind: 'LOGICAL',
        children: [
          {
            role: 'SUBJECT_EVENT',
            kinds: ['FACT', 'EXPRESSION'],
            factValueTypes: ['ENUM', 'REFERENCE'],
            expressionResultKinds: ['TEMPORAL'],
          },
          {
            role: 'TEMPORAL_BOUNDARY',
            kinds: ['FACT', 'EXPRESSION'],
            factValueTypes: ['DATE', 'DEFINED_TERM', 'REFERENCE'],
            expressionResultKinds: ['TEMPORAL'],
          },
        ],
      },
    ],
    [
      'OFFSET_BEFORE',
      {
        resultKind: 'TEMPORAL',
        children: [
          {
            role: 'ANCHOR',
            kinds: ['FACT', 'EXPRESSION'],
            factValueTypes: ['DATE', 'DEFINED_TERM', 'ENUM', 'REFERENCE'],
            expressionResultKinds: ['TEMPORAL'],
          },
          {
            role: 'OFFSET_AMOUNT',
            kinds: ['FACT'],
            factValueTypes: ['DURATION'],
            expressionResultKinds: [],
          },
        ],
      },
    ],
  ]);

  const expressions = array(input.expressions, topologyCode, 'expressions');
  if (expressions.length !== 2) {
    fail(topologyCode, 'c(ii) temporal Phase 1 evidence requires exactly two expressions');
  }
  const expressionById = new Map();
  for (const [index, expression] of expressions.entries()) {
    object(expression, topologyCode, `expressions[${index}]`);
    exactKeys(
      expression,
      [
        'expression_id',
        'operator',
        'result_kind',
        'children',
        'parent_expression_id',
        'connective_span_ids',
        'authored_limb_marker_span_ids',
        'scope_span_ids',
      ],
      topologyCode,
      `expressions[${index}]`,
    );
    const expressionId = string(
      expression.expression_id,
      topologyCode,
      `expressions[${index}].expression_id`,
    );
    if (expressionById.has(expressionId)) {
      fail(topologyCode, `duplicate expression_id ${expressionId}`);
    }
    expressionById.set(expressionId, expression);
  }

  for (const expression of expressions) {
    const contract = operatorContracts.get(expression.operator);
    if (!contract || expression.result_kind !== contract.resultKind) {
      fail(topologyCode, `operator ${expression.operator} is not authorised for c(ii)`);
    }
    const children = array(
      expression.children,
      topologyCode,
      `${expression.expression_id}.children`,
    );
    if (children.length !== contract.children.length) {
      fail(topologyCode, `${expression.operator} must have exactly two children`);
    }
    for (const [index, child] of children.entries()) {
      object(child, topologyCode, `${expression.expression_id}.children[${index}]`);
      exactKeys(
        child,
        ['kind', 'id', 'ordinal', 'role'],
        topologyCode,
        `${expression.expression_id}.children[${index}]`,
      );
      const childContract = contract.children[index];
      if (
        child.ordinal !== index + 1
        || child.role !== childContract.role
        || !childContract.kinds.includes(child.kind)
      ) {
        fail(topologyCode, `${expression.operator} child ${index + 1} has an invalid role or kind`);
      }
      if (child.kind === 'FACT') {
        const fact = factById.get(child.id);
        if (!fact || !childContract.factValueTypes.includes(fact.value_type)) {
          fail(topologyCode, `${expression.operator} child ${index + 1} has an invalid fact type`);
        }
      } else {
        const nestedExpression = expressionById.get(child.id);
        if (
          !nestedExpression
          || !childContract.expressionResultKinds.includes(nestedExpression.result_kind)
        ) {
          fail(topologyCode, `${expression.operator} child ${index + 1} has an invalid expression type`);
        }
      }
    }

    const connectiveSpanIds = array(
      expression.connective_span_ids,
      provenanceCode,
      `${expression.expression_id}.connective_span_ids`,
    );
    const authoredLimbMarkerSpanIds = array(
      expression.authored_limb_marker_span_ids,
      provenanceCode,
      `${expression.expression_id}.authored_limb_marker_span_ids`,
    );
    const scopeSpanIds = array(
      expression.scope_span_ids,
      provenanceCode,
      `${expression.expression_id}.scope_span_ids`,
    );
    if (
      connectiveSpanIds.length !== 1
      || spanTextById.get(connectiveSpanIds[0]) !== expression.operator
      || authoredLimbMarkerSpanIds.length !== 0
      || scopeSpanIds.length === 0
      || scopeSpanIds.some((spanId) => !spanById.has(spanId))
    ) {
      fail(provenanceCode, `${expression.expression_id} has invalid source evidence`);
    }
  }

  const roots = expressions.filter((expression) => expression.parent_expression_id === null);
  if (roots.length !== 1) {
    fail(topologyCode, 'c(ii) temporal Phase 1 evidence must have one root expression');
  }
  for (const expression of expressions) {
    if (expression.parent_expression_id !== null) {
      const parent = expressionById.get(expression.parent_expression_id);
      if (
        !parent
        || !parent.children.some(
          (child) => child.kind === 'EXPRESSION' && child.id === expression.expression_id,
        )
      ) {
        fail(topologyCode, `${expression.expression_id} has an invalid parent_expression_id`);
      }
    }
  }
  validateExpressionScopeEvidence(expressionById, factById);

  function expressionSignature(expression, activeExpressionIds = new Set()) {
    if (activeExpressionIds.has(expression.expression_id)) {
      fail(topologyCode, 'expression graph contains a cycle');
    }
    const nextActiveExpressionIds = new Set(activeExpressionIds);
    nextActiveExpressionIds.add(expression.expression_id);
    const childSignatures = expression.children.map((child) => {
      if (child.kind === 'FACT') {
        return factById.get(child.id).field_key;
      }
      return expressionSignature(expressionById.get(child.id), nextActiveExpressionIds);
    });
    return `${expression.operator}(${childSignatures.join(',')})`;
  }

  const signature = expressionSignature(roots[0]);
  if (signature !== expectedSignature) {
    fail(topologyCode, `c(ii) expression signature must be ${expectedSignature}`);
  }

  const links = array(input.links, topologyCode, 'links');
  if (links.length !== 1) {
    fail(topologyCode, 'c(ii) temporal Phase 1 evidence requires exactly one event reference link');
  }
  const link = links[0];
  object(link, topologyCode, 'links[0]');
  exactKeys(
    link,
    [
      'link_id',
      'edge_rule_id',
      'edge_type',
      'state',
      'consumer_rule_id',
      'consumer_fact_id',
      'consumer_dependency_id',
      'consumer_context_edge_id',
      'owner_rule_id',
      'owner_fact_id',
      'target_semantic_fact_key',
      'source_support_ids',
    ],
    topologyCode,
    'links[0]',
  );
  if (
    link.link_id !== 'link:exercise-event'
    || link.edge_rule_id !== referenceContract.edge_rule_id
    || link.edge_type !== referenceContract.edge_type
    || link.state !== 'RESOLVED'
    || link.consumer_rule_id !== referenceFact.owner_rule_id
    || link.consumer_fact_id !== referenceFact.fact_id
    || link.consumer_dependency_id !== 'dependency:exercise-event'
    || link.consumer_context_edge_id !== 'context-edge:exercise-event'
    || link.owner_rule_id !== ownerFact.owner_rule_id
    || link.owner_fact_id !== ownerFact.fact_id
    || link.target_semantic_fact_key !== ownerFact.semantic_fact_key
    || !sameTemporalPhase1Value(link.source_support_ids, referenceFact.source_support_ids)
  ) {
    fail(topologyCode, 'c(ii) event reference link does not resolve to the chapeau owner');
  }

  return Object.freeze({
    schema_version: 'STAGE_2Y_M7_V2_SYNTHETIC_EXPRESSION_EVIDENCE_VALIDATION/V1',
    status: 'PASS',
    expression_count: expressions.length,
    expression_signature: signature,
    cross_rule_event_reference_count: 1,
  });
}

function terminationPhase2HasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function terminationPhase2IsObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function terminationPhase2Fail(kind, detail) {
  fail(TERMINATION_PHASE2_ERRORS[kind], detail);
}

function terminationPhase2ExactKeys(value, expectedKeys, kind, detail) {
  if (!terminationPhase2IsObject(value)) {
    terminationPhase2Fail(kind, `${detail}: expected object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    terminationPhase2Fail(kind, `${detail}: exact keys`);
  }
}

function terminationPhase2Same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function terminationPhase2Freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const member of Object.values(value)) terminationPhase2Freeze(member);
    Object.freeze(value);
  }
  return value;
}

function validateTerminationPhase2AuthorityEnvelope(envelope) {
  terminationPhase2ExactKeys(envelope, ['binding', 'record'], 'AUTHORITY', 'authority envelope');
  terminationPhase2ExactKeys(
    envelope.binding,
    ['byte_length', 'path', 'record_id', 'record_id_field', 'schema_version', 'sha256'],
    'AUTHORITY',
    'authority binding',
  );
  const binding = envelope.binding;
  if (
    binding.byte_length !== TERMINATION_PHASE2_AUTHORITY_BYTES ||
    binding.path !== TERMINATION_PHASE2_AUTHORITY_PATH ||
    binding.record_id !== TERMINATION_PHASE2_AUTHORITY_ID ||
    binding.record_id_field !== 'termination_authoring_phase2_authority_id' ||
    binding.schema_version !== TERMINATION_PHASE2_AUTHORITY_SCHEMA ||
    binding.sha256 !== TERMINATION_PHASE2_AUTHORITY_SHA256
  ) {
    terminationPhase2Fail('AUTHORITY', 'authority binding drift');
  }
  if (!terminationPhase2IsObject(envelope.record)) {
    terminationPhase2Fail('AUTHORITY', 'authority record');
  }
  const record = envelope.record;
  if (
    record.schema_version !== TERMINATION_PHASE2_AUTHORITY_SCHEMA ||
    record.termination_authoring_phase2_authority_id !== TERMINATION_PHASE2_AUTHORITY_ID
  ) {
    terminationPhase2Fail('AUTHORITY', 'authority record identity');
  }
  const fileBytes = `${canonicalJson(record)}\n`;
  if (
    Buffer.byteLength(fileBytes, 'utf8') !== TERMINATION_PHASE2_AUTHORITY_BYTES ||
    sha256Hex(fileBytes) !== TERMINATION_PHASE2_AUTHORITY_SHA256
  ) {
    terminationPhase2Fail('AUTHORITY', 'authority canonical bytes');
  }
  const unsigned = { ...record };
  delete unsigned.termination_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== TERMINATION_PHASE2_AUTHORITY_ID) {
    terminationPhase2Fail('AUTHORITY', 'authority self identity');
  }
  return terminationPhase2Freeze(JSON.parse(canonicalJson(envelope)));
}

function terminationPhase2IdentityContract(record) {
  const contract =
    record.implementation_contract &&
    record.implementation_contract.evidence_validation_contract &&
    record.implementation_contract.evidence_validation_contract
      .independent_graph_typed_registry_contract &&
    record.implementation_contract.evidence_validation_contract
      .independent_graph_typed_registry_contract.identity_derivation_contract;
  if (!terminationPhase2IsObject(contract)) {
    terminationPhase2Fail('AUTHORITY', 'identity derivation contract');
  }
  return contract;
}

function terminationPhase2IdentityId(record, ruleKey, payload) {
  const rule = terminationPhase2IdentityContract(record)[ruleKey];
  if (
    !terminationPhase2IsObject(rule) ||
    typeof rule.domain !== 'string' ||
    !Array.isArray(rule.payload_exact_keys)
  ) {
    terminationPhase2Fail('AUTHORITY', `identity rule ${ruleKey}`);
  }
  terminationPhase2ExactKeys(payload, rule.payload_exact_keys, 'AUTHORITY', `identity payload ${ruleKey}`);
  return contentId(rule.domain, payload);
}

function terminationPhase2SourceSupportId(agreementIndexId, support) {
  if (!terminationPhase2IsObject(support) || !terminationPhase2IsObject(support.source_span)) {
    terminationPhase2Fail('AUTHORITY', 'source support');
  }
  const payload = {
    agreement_index_id: agreementIndexId,
    source_node_occurrence_id: support.node_occurrence_id,
    start_byte: support.source_span.start_byte,
    end_byte: support.source_span.end_byte,
    text_sha256: support.source_span.text_sha256,
  };
  return contentId('AGREEMENT_SOURCE_SPAN/V2', payload);
}

function terminationPhase2M2AgreementIndexIds(record) {
  const answer = new Map();
  const bindings =
    record.immutable_parent_bindings && record.immutable_parent_bindings.m2_m3_m4;
  if (!Array.isArray(bindings)) return answer;
  for (const binding of bindings) {
    if (!terminationPhase2IsObject(binding) || !terminationPhase2IsObject(binding.m2)) continue;
    const agreementId = binding.agreement_id || binding.m2.agreement_id;
    if (typeof agreementId === 'string' && typeof binding.m2.record_id === 'string') {
      answer.set(agreementId, binding.m2.record_id);
    }
  }
  return answer;
}

function terminationPhase2OwnerTemplate(record, graph) {
  const registry =
    record.implementation_contract &&
    record.implementation_contract.reference_target_owner_template_registry;
  const templates = registry && registry.templates;
  if (!Array.isArray(templates)) {
    terminationPhase2Fail('AUTHORITY', 'reference target owner template registry');
  }
  const expectedDescriptor = {
    defined_term_key: graph.defined_term_key,
    graph_key: graph.graph_key,
    kind: 'DERIVED_REFERENCE_TARGET/V1',
    resolved_analysis_value_kind: 'SEMANTIC_FACT_KEY',
    target_kind: 'TEMPORAL_STATE_GRAPH_OWNER_FACT',
  };
  const matches = templates.filter(
    (template) =>
      template.agreement_id === graph.agreement_id &&
      template.field_key === graph.defined_term_key &&
      template.target_kind === 'TEMPORAL_STATE_GRAPH_OWNER_FACT' &&
      terminationPhase2Same(template.descriptor_key, expectedDescriptor),
  );
  if (matches.length !== 1) {
    terminationPhase2Fail('AUTHORITY', `owner template ${graph.graph_key}`);
  }
  const template = matches[0];
  const m2Ids = terminationPhase2M2AgreementIndexIds(record);
  if (m2Ids.has(graph.agreement_id) && m2Ids.get(graph.agreement_id) !== template.agreement_index_id) {
    terminationPhase2Fail('AUTHORITY', `owner M2 binding ${graph.graph_key}`);
  }
  if (!Array.isArray(template.source_supports)) {
    terminationPhase2Fail('AUTHORITY', `owner supports ${graph.graph_key}`);
  }
  const sourceSupportIds = template.source_supports.map((support) => {
    const sourceSupportId = terminationPhase2SourceSupportId(template.agreement_index_id, support);
    if (support.source_support_id !== sourceSupportId) {
      terminationPhase2Fail('AUTHORITY', `owner support identity ${graph.graph_key}`);
    }
    return sourceSupportId;
  });
  return { template, sourceSupportIds };
}

function terminationPhase2GraphSupportIds(ownerTemplate, supports) {
  if (!Array.isArray(supports)) terminationPhase2Fail('AUTHORITY', 'graph supports');
  return supports.map((support) =>
    terminationPhase2SourceSupportId(ownerTemplate.agreement_index_id, support),
  );
}

function terminationPhase2ExpressionRef(record, tree, factContracts, context, expressionPath) {
  if (!terminationPhase2IsObject(tree)) {
    terminationPhase2Fail('AUTHORITY', 'expression tree node');
  }
  if (tree.kind === 'FACT') {
    terminationPhase2ExactKeys(tree, ['field_key', 'kind'], 'AUTHORITY', 'fact leaf');
    const matches = factContracts.filter((fact) => fact.field_key === tree.field_key);
    if (matches.length !== 1) {
      terminationPhase2Fail('AUTHORITY', `fact contract ${tree.field_key}`);
    }
    const factContract = matches[0];
    const payload = context.state_key
      ? {
          agreement_id: context.agreement_id,
          graph_key: context.graph_key,
          state_key: context.state_key,
          expression_path: expressionPath,
          fact_contract: factContract,
        }
      : {
          agreement_id: context.agreement_id,
          graph_key: context.graph_key,
          edge_key: context.edge_key,
          evaluation_ordinal: context.evaluation_ordinal,
          expression_path: expressionPath,
          fact_contract: factContract,
        };
    const ruleKey = context.state_key
      ? 'graph_state_fact_id_rule'
      : 'graph_edge_evaluation_fact_id_rule';
    return {
      kind: 'FACT',
      id: terminationPhase2IdentityId(record, ruleKey, payload),
      resultKind: factContract.value_type,
    };
  }
  if (tree.kind !== 'EXPRESSION') {
    terminationPhase2Fail('AUTHORITY', `expression node kind ${tree.kind}`);
  }
  terminationPhase2ExactKeys(
    tree,
    ['children', 'kind', 'operator', 'result_kind'],
    'AUTHORITY',
    'expression node',
  );
  if (!Array.isArray(tree.children)) terminationPhase2Fail('AUTHORITY', 'expression children');
  const children = tree.children.map((child, index) => {
    terminationPhase2ExactKeys(child, ['node', 'role'], 'AUTHORITY', 'expression child');
    const childRef = terminationPhase2ExpressionRef(
      record,
      child.node,
      factContracts,
      context,
      `${expressionPath}.${index + 1}`,
    );
    return {
      kind: childRef.kind,
      id: childRef.id,
      ordinal: index + 1,
      role: child.role,
    };
  });
  const payload = context.state_key
    ? {
        agreement_id: context.agreement_id,
        graph_key: context.graph_key,
        state_key: context.state_key,
        expression_path: expressionPath,
        operator: tree.operator,
        result_kind: tree.result_kind,
        children,
      }
    : {
        agreement_id: context.agreement_id,
        graph_key: context.graph_key,
        edge_key: context.edge_key,
        evaluation_ordinal: context.evaluation_ordinal,
        expression_path: expressionPath,
        operator: tree.operator,
        result_kind: tree.result_kind,
        children,
      };
  const ruleKey = context.state_key
    ? 'graph_state_expression_id_rule'
    : 'graph_edge_evaluation_expression_id_rule';
  return {
    kind: 'EXPRESSION',
    id: terminationPhase2IdentityId(record, ruleKey, payload),
    resultKind: tree.result_kind,
  };
}

function terminationPhase2StateValueRef(record, graph, state) {
  const template = state.value_ref_template;
  if (!terminationPhase2IsObject(template)) {
    terminationPhase2Fail('AUTHORITY', `state value template ${graph.graph_key}.${state.state_key}`);
  }
  if (template.kind === 'SOURCE_TYPED_FACT') {
    const id = terminationPhase2IdentityId(record, 'graph_state_fact_id_rule', {
      agreement_id: graph.agreement_id,
      graph_key: graph.graph_key,
      state_key: state.state_key,
      expression_path: '0',
      fact_contract: template,
    });
    if (!['DATE', 'DEFINED_TERM', 'REFERENCE'].includes(template.value_type)) {
      terminationPhase2Fail('AUTHORITY', `state fact result ${graph.graph_key}.${state.state_key}`);
    }
    return { kind: 'FACT', id };
  }
  if (template.kind !== 'DERIVED_TEMPORAL_EXPRESSION' || !Array.isArray(template.fact_contracts)) {
    terminationPhase2Fail('AUTHORITY', `state expression template ${graph.graph_key}.${state.state_key}`);
  }
  const root = terminationPhase2ExpressionRef(
    record,
    template.expression_tree,
    template.fact_contracts,
    {
      agreement_id: graph.agreement_id,
      graph_key: graph.graph_key,
      state_key: state.state_key,
    },
    '0',
  );
  if (root.kind !== 'EXPRESSION' || root.resultKind !== 'TEMPORAL') {
    terminationPhase2Fail('AUTHORITY', `state expression result ${graph.graph_key}.${state.state_key}`);
  }
  return { kind: 'EXPRESSION', id: root.id };
}

function terminationPhase2UnsignedRecordId(unsignedRecord) {
  return contentId(unsignedRecord.schema_version, unsignedRecord);
}

function terminationPhase2MaterialiseGraphs(record) {
  const graphs = record.authorised_symbolic_graph_fixtures;
  if (!Array.isArray(graphs)) terminationPhase2Fail('AUTHORITY', 'symbolic graph fixtures');
  const states = [];
  const edges = [];
  const graphResults = new Map();
  for (const graph of graphs) {
    const owner = terminationPhase2OwnerTemplate(record, graph);
    if (!Array.isArray(graph.ordered_state_templates) || !Array.isArray(graph.ordered_edge_templates)) {
      terminationPhase2Fail('AUTHORITY', `graph templates ${graph.graph_key}`);
    }
    const stateByKey = new Map();
    const graphStates = [];
    for (const state of graph.ordered_state_templates) {
      const valueRef = terminationPhase2StateValueRef(record, graph, state);
      const sourceSupportIds = terminationPhase2GraphSupportIds(owner.template, state.source_supports);
      const unsignedState = {
        schema_version: 'TEMPORAL_DEFINED_TERM_STATE/V1',
        agreement_id: graph.agreement_id,
        defined_term_key: graph.defined_term_key,
        defined_term_owner_node_occurrence_id: graph.defined_term_owner_node_occurrence_id,
        state_key: state.state_key,
        ordinal: state.ordinal,
        value_ref: valueRef,
        source_node_occurrence_id: state.source_node_occurrence_id,
        source_support_ids: sourceSupportIds,
        resolution_state: state.resolution_state,
        unresolved_dimensions: state.unresolved_dimensions,
      };
      const stateId = terminationPhase2UnsignedRecordId(unsignedState);
      const outputState = {
        schema_version: unsignedState.schema_version,
        state_id: stateId,
        agreement_id: unsignedState.agreement_id,
        defined_term_key: unsignedState.defined_term_key,
        defined_term_owner_node_occurrence_id:
          unsignedState.defined_term_owner_node_occurrence_id,
        state_key: unsignedState.state_key,
        ordinal: unsignedState.ordinal,
        value_ref: unsignedState.value_ref,
        source_node_occurrence_id: unsignedState.source_node_occurrence_id,
        source_support_ids: unsignedState.source_support_ids,
        resolution_state: unsignedState.resolution_state,
        unresolved_dimensions: unsignedState.unresolved_dimensions,
      };
      states.push(outputState);
      graphStates.push(outputState);
      stateByKey.set(state.state_key, outputState);
    }
    const graphEdges = [];
    for (const edge of graph.ordered_edge_templates) {
      const predecessor = stateByKey.get(edge.predecessor_state_key);
      const successor = stateByKey.get(edge.successor_state_key);
      if (!predecessor || !successor) {
        terminationPhase2Fail('AUTHORITY', `edge endpoints ${graph.graph_key}.${edge.edge_key}`);
      }
      const triggerExpressionId = terminationPhase2IdentityId(
        record,
        'graph_edge_trigger_id_rule',
        {
          agreement_id: graph.agreement_id,
          graph_key: graph.graph_key,
          edge_key: edge.edge_key,
          trigger_template: edge.trigger_template,
        },
      );
      if (
        edge.trigger_template.kind !== 'DERIVED_LOGICAL_TRIGGER/V1' ||
        edge.trigger_template.resolved_proposal_value_kind !== 'EXPRESSION_ID'
      ) {
        terminationPhase2Fail('AUTHORITY', `edge trigger result ${graph.graph_key}.${edge.edge_key}`);
      }
      if (!Array.isArray(edge.evaluation_templates)) {
        terminationPhase2Fail('AUTHORITY', `edge evaluations ${graph.graph_key}.${edge.edge_key}`);
      }
      const evaluationExpressionIds = edge.evaluation_templates.map((evaluation, index) => {
        const root = terminationPhase2ExpressionRef(
          record,
          evaluation.expression_tree,
          evaluation.fact_contracts,
          {
            agreement_id: graph.agreement_id,
            graph_key: graph.graph_key,
            edge_key: edge.edge_key,
            evaluation_ordinal: index + 1,
          },
          '0',
        );
        if (root.resultKind !== 'TEMPORAL') {
          terminationPhase2Fail(
            'AUTHORITY',
            `edge evaluation result ${graph.graph_key}.${edge.edge_key}.${index + 1}`,
          );
        }
        return root.id;
      });
      const sourceSupportIds = terminationPhase2GraphSupportIds(owner.template, edge.source_supports);
      const unsignedEdge = {
        schema_version: 'TEMPORAL_STATE_EDGE/V1',
        edge_rule_id: 'TEMPORAL_STATE_EDGE/V1',
        agreement_id: graph.agreement_id,
        defined_term_key: graph.defined_term_key,
        defined_term_owner_node_occurrence_id: graph.defined_term_owner_node_occurrence_id,
        predecessor_state_id: predecessor.state_id,
        successor_state_id: successor.state_id,
        trigger_expression_id: triggerExpressionId,
        evaluation_expression_ids: evaluationExpressionIds,
        transition_kind: edge.transition_kind,
        source_node_occurrence_ids: edge.source_node_occurrence_ids,
        source_support_ids: sourceSupportIds,
        resolution_state: 'SYMBOLIC_SOURCE_PROVED',
      };
      const temporalStateEdgeId = terminationPhase2UnsignedRecordId(unsignedEdge);
      const outputEdge = {
        schema_version: unsignedEdge.schema_version,
        temporal_state_edge_id: temporalStateEdgeId,
        edge_rule_id: unsignedEdge.edge_rule_id,
        agreement_id: unsignedEdge.agreement_id,
        defined_term_key: unsignedEdge.defined_term_key,
        defined_term_owner_node_occurrence_id:
          unsignedEdge.defined_term_owner_node_occurrence_id,
        predecessor_state_id: unsignedEdge.predecessor_state_id,
        successor_state_id: unsignedEdge.successor_state_id,
        trigger_expression_id: unsignedEdge.trigger_expression_id,
        evaluation_expression_ids: unsignedEdge.evaluation_expression_ids,
        transition_kind: unsignedEdge.transition_kind,
        source_node_occurrence_ids: unsignedEdge.source_node_occurrence_ids,
        source_support_ids: unsignedEdge.source_support_ids,
        resolution_state: unsignedEdge.resolution_state,
      };
      edges.push(outputEdge);
      graphEdges.push(outputEdge);
    }
    graphResults.set(graph.graph_key, {
      graph,
      owner,
      states: graphStates,
      edges: graphEdges,
    });
  }
  return { states, edges, graphResults };
}

function terminationPhase2TargetSemanticFactKey(owner) {
  const template = owner.template;
  return contentId('AGREEMENT_SEMANTIC_FACT/V2', {
    agreement_id: template.agreement_id,
    field_key: template.field_key,
    normalised_typed_value: template.typed_value,
    legal_subject: template.legal_subject,
    temporal_scope_signature: template.temporal_scope_signature,
    source_support_ids: owner.sourceSupportIds,
    legal_effect_role: template.legal_effect_role,
  });
}

function terminationPhase2MaterialiseReferences(record, graphMaterialisation) {
  const schedule = record.temporal_state_reference_occurrence_schedule;
  if (!Array.isArray(schedule)) terminationPhase2Fail('AUTHORITY', 'reference schedule');
  return schedule.map((row) => {
    const graphResult = graphMaterialisation.graphResults.get(row.graph_key);
    if (!graphResult) terminationPhase2Fail('AUTHORITY', `reference graph ${row.graph_key}`);
    const graph = graphResult.graph;
    const owner = graphResult.owner;
    const targetSemanticFactKey = terminationPhase2TargetSemanticFactKey(owner);
    const support = {
      node_occurrence_id: row.source_node_occurrence_id,
      source_span: row.source_span,
    };
    const sourceSupportIds = [
      terminationPhase2SourceSupportId(owner.template.agreement_index_id, support),
    ];
    const sourceRoleIdentity = {
      graph_key: row.graph_key,
      consumer_rule_key: row.consumer_rule_key,
      field_key: row.field_key,
      source_role_occurrence_ordinal: row.source_role_occurrence_ordinal,
      source_node_occurrence_id: row.source_node_occurrence_id,
      source_span: row.source_span,
    };
    const consumerRuleId = terminationPhase2IdentityId(record, 'reference_consumer_rule_id_rule', {
      agreement_id: graph.agreement_id,
      graph_key: row.graph_key,
      consumer_rule_key: row.consumer_rule_key,
    });
    const consumerFactId = terminationPhase2IdentityId(record, 'reference_consumer_fact_id_rule', {
      consumer_rule_id: consumerRuleId,
      source_role_identity: sourceRoleIdentity,
      value_type: 'REFERENCE',
      typed_value: targetSemanticFactKey,
      normaliser_id: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
      source_support_ids: sourceSupportIds,
    });
    const stateIds = graphResult.states.map((state) => state.state_id);
    const transitionEdgeIds = graphResult.edges.map((edge) => edge.temporal_state_edge_id);
    const consumerDependencyId = terminationPhase2IdentityId(
      record,
      'reference_consumer_dependency_id_rule',
      {
        consumer_fact_id: consumerFactId,
        edge_rule_id: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
        edge_type: 'TEMPORAL_STATE_GRAPH_TARGET',
        target_semantic_fact_key: targetSemanticFactKey,
        state_ids: stateIds,
        transition_edge_ids: transitionEdgeIds,
        native_m3_resolution: row.native_m3_resolution,
        native_m3_definition_edge_id: row.native_m3_definition_edge_id,
        native_m3_subterm_edge_id: row.native_m3_subterm_edge_id,
      },
    );
    const consumerContextEdgeId = terminationPhase2IdentityId(
      record,
      'reference_consumer_context_edge_id_rule',
      {
        consumer_rule_id: consumerRuleId,
        consumer_fact_id: consumerFactId,
        consumer_dependency_id: consumerDependencyId,
        source_role_identity: sourceRoleIdentity,
        source_support_ids: sourceSupportIds,
      },
    );
    const unsignedReference = {
      schema_version: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
      edge_rule_id: 'TEMPORAL_STATE_REFERENCE_EDGE/V1',
      edge_type: 'TEMPORAL_STATE_GRAPH_TARGET',
      agreement_id: graph.agreement_id,
      defined_term_key: graph.defined_term_key,
      defined_term_owner_node_occurrence_id: graph.defined_term_owner_node_occurrence_id,
      consumer_rule_id: consumerRuleId,
      consumer_fact_id: consumerFactId,
      consumer_dependency_id: consumerDependencyId,
      consumer_context_edge_id: consumerContextEdgeId,
      state_ids: stateIds,
      transition_edge_ids: transitionEdgeIds,
      source_support_ids: sourceSupportIds,
      resolution_state: 'SYMBOLIC_GRAPH_BOUND',
    };
    const temporalStateReferenceEdgeId = terminationPhase2UnsignedRecordId(unsignedReference);
    return {
      schema_version: unsignedReference.schema_version,
      temporal_state_reference_edge_id: temporalStateReferenceEdgeId,
      edge_rule_id: unsignedReference.edge_rule_id,
      edge_type: unsignedReference.edge_type,
      agreement_id: unsignedReference.agreement_id,
      defined_term_key: unsignedReference.defined_term_key,
      defined_term_owner_node_occurrence_id:
        unsignedReference.defined_term_owner_node_occurrence_id,
      consumer_rule_id: unsignedReference.consumer_rule_id,
      consumer_fact_id: unsignedReference.consumer_fact_id,
      consumer_dependency_id: unsignedReference.consumer_dependency_id,
      consumer_context_edge_id: unsignedReference.consumer_context_edge_id,
      state_ids: unsignedReference.state_ids,
      transition_edge_ids: unsignedReference.transition_edge_ids,
      source_support_ids: unsignedReference.source_support_ids,
      resolution_state: unsignedReference.resolution_state,
    };
  });
}

function terminationPhase2CompareStates(actualStates, expectedStates) {
  if (!Array.isArray(actualStates) || actualStates.length !== expectedStates.length) {
    terminationPhase2Fail('TOPOLOGY', 'state count');
  }
  const keys = [
    'schema_version',
    'state_id',
    'agreement_id',
    'defined_term_key',
    'defined_term_owner_node_occurrence_id',
    'state_key',
    'ordinal',
    'value_ref',
    'source_node_occurrence_id',
    'source_support_ids',
    'resolution_state',
    'unresolved_dimensions',
  ];
  for (let index = 0; index < expectedStates.length; index += 1) {
    const actual = actualStates[index];
    const expected = expectedStates[index];
    terminationPhase2ExactKeys(actual, keys, 'TOPOLOGY', `state ${index}`);
    terminationPhase2ExactKeys(actual.value_ref, ['kind', 'id'], 'TOPOLOGY', `state value ref ${index}`);
    const identity = [
      'schema_version',
      'agreement_id',
      'defined_term_key',
      'defined_term_owner_node_occurrence_id',
      'state_key',
      'ordinal',
    ];
    if (identity.some((key) => !terminationPhase2Same(actual[key], expected[key]))) {
      terminationPhase2Fail('TOPOLOGY', `state order ${index}`);
    }
    if (
      actual.source_node_occurrence_id !== expected.source_node_occurrence_id ||
      !terminationPhase2Same(actual.source_support_ids, expected.source_support_ids)
    ) {
      terminationPhase2Fail('PROVENANCE', `state provenance ${index}`);
    }
    if (!terminationPhase2Same(actual, expected)) {
      terminationPhase2Fail('TOPOLOGY', `state record ${index}`);
    }
  }
}

function terminationPhase2CompareEdges(actualEdges, expectedEdges) {
  if (!Array.isArray(actualEdges) || actualEdges.length !== expectedEdges.length) {
    terminationPhase2Fail('TOPOLOGY', 'edge count');
  }
  const keys = [
    'schema_version',
    'temporal_state_edge_id',
    'edge_rule_id',
    'agreement_id',
    'defined_term_key',
    'defined_term_owner_node_occurrence_id',
    'predecessor_state_id',
    'successor_state_id',
    'trigger_expression_id',
    'evaluation_expression_ids',
    'transition_kind',
    'source_node_occurrence_ids',
    'source_support_ids',
    'resolution_state',
  ];
  for (let index = 0; index < expectedEdges.length; index += 1) {
    const actual = actualEdges[index];
    const expected = expectedEdges[index];
    terminationPhase2ExactKeys(actual, keys, 'TOPOLOGY', `edge ${index}`);
    const identity = [
      'schema_version',
      'edge_rule_id',
      'agreement_id',
      'defined_term_key',
      'defined_term_owner_node_occurrence_id',
      'predecessor_state_id',
      'successor_state_id',
      'transition_kind',
    ];
    if (identity.some((key) => !terminationPhase2Same(actual[key], expected[key]))) {
      terminationPhase2Fail('TOPOLOGY', `edge order ${index}`);
    }
    if (
      !terminationPhase2Same(actual.source_node_occurrence_ids, expected.source_node_occurrence_ids) ||
      !terminationPhase2Same(actual.source_support_ids, expected.source_support_ids)
    ) {
      terminationPhase2Fail('PROVENANCE', `edge provenance ${index}`);
    }
    if (!terminationPhase2Same(actual, expected)) {
      terminationPhase2Fail('TOPOLOGY', `edge record ${index}`);
    }
  }
}

function terminationPhase2CompareReferences(actualReferences, expectedReferences) {
  if (!Array.isArray(actualReferences) || actualReferences.length !== expectedReferences.length) {
    terminationPhase2Fail('TOPOLOGY', 'reference count');
  }
  const keys = [
    'schema_version',
    'temporal_state_reference_edge_id',
    'edge_rule_id',
    'edge_type',
    'agreement_id',
    'defined_term_key',
    'defined_term_owner_node_occurrence_id',
    'consumer_rule_id',
    'consumer_fact_id',
    'consumer_dependency_id',
    'consumer_context_edge_id',
    'state_ids',
    'transition_edge_ids',
    'source_support_ids',
    'resolution_state',
  ];
  const seen = new Set();
  for (let index = 0; index < expectedReferences.length; index += 1) {
    const actual = actualReferences[index];
    const expected = expectedReferences[index];
    terminationPhase2ExactKeys(actual, keys, 'REFERENCE', `reference ${index}`);
    if (seen.has(actual.temporal_state_reference_edge_id)) {
      terminationPhase2Fail('REFERENCE', `duplicate reference ${index}`);
    }
    seen.add(actual.temporal_state_reference_edge_id);
    const identity = [
      'schema_version',
      'edge_rule_id',
      'edge_type',
      'agreement_id',
      'defined_term_key',
      'defined_term_owner_node_occurrence_id',
      'consumer_rule_id',
    ];
    if (identity.some((key) => !terminationPhase2Same(actual[key], expected[key]))) {
      terminationPhase2Fail('REFERENCE', `reference order ${index}`);
    }
    if (!terminationPhase2Same(actual.source_support_ids, expected.source_support_ids)) {
      terminationPhase2Fail('PROVENANCE', `reference provenance ${index}`);
    }
    if (!terminationPhase2Same(actual, expected)) {
      terminationPhase2Fail('REFERENCE', `reference record ${index}`);
    }
  }
}

function validateTerminationPhase2SyntheticExpressionEvidence(input) {
  const sealedEnvelope = validateTerminationPhase2AuthorityEnvelope(
    input.terminationAuthoringPhase2Authority,
  );
  if (terminationPhase2HasOwn(input, 'temporalPhase1Authority')) {
    terminationPhase2Fail('TOPOLOGY', 'Phase1 authority collision');
  }
  terminationPhase2ExactKeys(
    input,
    [
      'terminationAuthoringPhase2Authority',
      'authorised_rule_components',
      'temporal_defined_term_states',
      'temporal_state_edges',
      'temporal_state_reference_edges',
    ],
    'TOPOLOGY',
    'Phase2 evidence input',
  );
  const authorityRecord = sealedEnvelope.record;
  const components = authorityRecord.authorised_synthetic_rule_components;
  const actualComponents = input.authorised_rule_components;
  if (!Array.isArray(components) || !Array.isArray(actualComponents) || actualComponents.length !== components.length) {
    terminationPhase2Fail('TOPOLOGY', 'component count');
  }
  const compiledKeys = [
    'profile_id',
    'expression_signature',
    'root_expression_id',
    'source_spans',
    'facts',
    'expressions',
  ];
  for (let index = 0; index < components.length; index += 1) {
    const actual = actualComponents[index];
    const component = components[index];
    terminationPhase2ExactKeys(
      actual,
      ['component_key', 'compiled_output'],
      'TOPOLOGY',
      `component wrapper ${index}`,
    );
    if (actual.component_key !== component.component_key) {
      terminationPhase2Fail('TOPOLOGY', `component order ${index}`);
    }
    terminationPhase2ExactKeys(
      actual.compiled_output,
      compiledKeys,
      'TOPOLOGY',
      `compiled output ${index}`,
    );
    let expectedCompiled;
    try {
      expectedCompiled = compileSyntheticProfileExpression({
        terminationAuthoringPhase2Authority: sealedEnvelope,
        component_key: component.component_key,
      });
    } catch (error) {
      terminationPhase2Fail('TOPOLOGY', `component compilation ${index}`);
    }
    if (!terminationPhase2Same(actual.compiled_output, expectedCompiled)) {
      terminationPhase2Fail('TOPOLOGY', `compiled output mismatch ${index}`);
    }
  }
  const graphMaterialisation = terminationPhase2MaterialiseGraphs(authorityRecord);
  terminationPhase2CompareStates(
    input.temporal_defined_term_states,
    graphMaterialisation.states,
  );
  terminationPhase2CompareEdges(input.temporal_state_edges, graphMaterialisation.edges);
  const expectedReferences = terminationPhase2MaterialiseReferences(
    authorityRecord,
    graphMaterialisation,
  );
  terminationPhase2CompareReferences(
    input.temporal_state_reference_edges,
    expectedReferences,
  );
  return Object.freeze({
    schema_version:
      'STAGE_2Y_M7_V2_TERMINATION_PHASE2_SYNTHETIC_EVIDENCE_VALIDATION/V1',
    status: 'PASS',
    authorised_rule_component_count: components.length,
    temporal_defined_term_state_count: graphMaterialisation.states.length,
    temporal_state_edge_count: graphMaterialisation.edges.length,
    temporal_state_reference_edge_count: expectedReferences.length,
  });
}

function validateStage2YGovernedDisclosureNote(
  note,
  topologyCode,
  label,
  requirementsById = null,
) {
  exactKeys(note, GOVERNED_DISCLOSURE_NOTE_EXACT_KEYS, topologyCode, label);
  if (note.schema_version !== GOVERNED_DISCLOSURE_NOTE_SCHEMA) {
    fail(topologyCode, `${label} schema version is invalid`);
  }
  const unsigned = { ...note };
  delete unsigned.schema_version;
  delete unsigned.governed_disclosure_note_id;
  if (note.governed_disclosure_note_id !== contentId(
    GOVERNED_DISCLOSURE_NOTE_SCHEMA,
    unsigned,
  )) {
    fail(topologyCode, `${label} content identity is invalid`);
  }
  string(note.agreement_id, topologyCode, `${label} agreement ID`);
  string(note.profile_key, topologyCode, `${label} profile key`);
  string(note.source_unit_key, topologyCode, `${label} source unit key`);
  string(note.field_key, topologyCode, `${label} field key`);
  string(note.requirement_id, topologyCode, `${label} requirement ID`);
  string(note.reference_slot_key, topologyCode, `${label} reference slot key`);
  string(note.source_admission_gap_id, topologyCode, `${label} source admission gap ID`);
  string(note.disposition_kind, topologyCode, `${label} disposition kind`);
  string(note.display_text, topologyCode, `${label} display text`);
  string(note.lawyer_ruling_id, topologyCode, `${label} lawyer ruling ID`);
  if (requirementsById && !requirementsById.has(note.requirement_id)) {
    fail(topologyCode, `${label} cites an unknown profile requirement`);
  }
  if (requirementsById) {
    const requirement = requirementsById.get(note.requirement_id);
    if (requirement.field_key !== note.field_key) {
      fail(topologyCode, `${label} field key does not match its requirement`);
    }
  }
  return note;
}

function validateStage2YProfileRequirement(requirement, topologyCode, label) {
  exactKeys(requirement, [
    'requirement_id',
    'field_key',
    'value_type',
    'cardinality',
    'materiality',
    'lawyer_ruling_id',
  ], topologyCode, label);
  const unsigned = { ...requirement };
  delete unsigned.requirement_id;
  if (requirement.requirement_id !== contentId(PROFILE_REQUIREMENT_SCHEMA, unsigned)) {
    fail(topologyCode, `${label} content identity is invalid`);
  }
  string(requirement.field_key, topologyCode, `${label} field key`);
  if (!FACT_VALUE_TYPES.includes(requirement.value_type)
      || !['ONE', 'ONE_OR_MORE'].includes(requirement.cardinality)
      || !['MATERIAL', 'NON_MATERIAL'].includes(requirement.materiality)) {
    fail(topologyCode, `${label} has an invalid type, cardinality, or materiality`);
  }
  string(requirement.lawyer_ruling_id, topologyCode, `${label} lawyer ruling ID`);
  return requirement;
}

function resolveExpressionChildByOrdinals(
  expression,
  expressions,
  ordinals,
  topologyCode,
) {
  let current = expression;
  for (let index = 0; index < ordinals.length; index += 1) {
    const ordinal = ordinals[index];
    const child = current.children.find((entry) => entry.ordinal === ordinal);
    if (!child) {
      fail(topologyCode, `expression path ordinal ${ordinal} is absent`);
    }
    if (index === ordinals.length - 1) return child;
    if (child.kind !== 'EXPRESSION') {
      fail(topologyCode, 'expression path ordinal does not reach an expression child');
    }
    current = expressions.get(child.id);
    if (!current) {
      fail(topologyCode, 'expression path cites an unknown child expression');
    }
  }
  fail(topologyCode, 'expression path ordinals are empty');
}

function validateGovernedDisclosureNoteCoreIntegrationEvidence(input = {}) {
  const topologyCode = 'M7_V2_GOVERNED_DISCLOSURE_NOTE_CORE_INTEGRATION';
  exactKeys(
    input,
    [
      'governed_disclosure_notes',
      'profile_requirements',
      'synthetic_expression_evidence',
    ],
    topologyCode,
    'governed disclosure note core integration evidence',
  );
  const requirements = array(
    input.profile_requirements,
    topologyCode,
    'profile requirements',
  );
  const requirementsById = indexBy(
    requirements,
    'requirement_id',
    topologyCode,
    'profile requirement',
  );
  for (const requirement of requirementsById.values()) {
    validateStage2YProfileRequirement(requirement, topologyCode, 'profile requirement');
  }
  const notes = array(
    input.governed_disclosure_notes,
    topologyCode,
    'governed disclosure notes',
  );
  const notesById = new Map();
  for (const note of notes) {
    const validated = validateStage2YGovernedDisclosureNote(
      note,
      topologyCode,
      'governed disclosure note',
      requirementsById,
    );
    notesById.set(validated.governed_disclosure_note_id, validated);
  }
  const syntheticEvidence = { ...input.synthetic_expression_evidence };
  if (!Array.isArray(syntheticEvidence.governed_disclosure_notes)) {
    syntheticEvidence.governed_disclosure_notes = notes;
  }
  const syntheticForValidation = {
    ...syntheticEvidence,
    expressions: array(
      syntheticEvidence.expressions,
      topologyCode,
      'synthetic expressions',
    ).map((expression) => ({
      ...expression,
      children: expression.children.map((child) => ({
        kind: child.kind,
        id: child.id,
      })),
    })),
  };
  const expressionValidation = validateSyntheticExpressionEvidence(syntheticForValidation);
  const expressions = indexBy(
    array(
      syntheticEvidence.expressions,
      topologyCode,
      'synthetic expressions',
    ),
    'expression_id',
    topologyCode,
    'synthetic expression',
  );
  const rootExpression = expressions.get('expression:root');
  if (!rootExpression || rootExpression.operator !== 'ALL_OF') {
    fail(topologyCode, 'B9e core integration root expression drift');
  }
  const pathChild = resolveExpressionChildByOrdinals(
    rootExpression,
    expressions,
    B9E_TERMINATION_GOVERNED_DISCLOSURE_NOTE_PATH_ORDINALS,
    topologyCode,
  );
  if (pathChild.kind !== 'GOVERNED_DISCLOSURE_NOTE') {
    fail(topologyCode, 'B9e core integration path child is not a governed disclosure note');
  }
  if (!notesById.has(pathChild.id)) {
    fail(topologyCode, 'B9e core integration path child cites an unknown governed disclosure note');
  }
  const exceptionExpression = expressions.get(
    rootExpression.children.find((child) => child.ordinal === 10).id,
  );
  if (!exceptionExpression || exceptionExpression.operator !== 'EXCEPTION_TO') {
    fail(topologyCode, 'B9e core integration exception expression drift');
  }
  const baseExpression = expressions.get(
    exceptionExpression.children.find((child) => child.ordinal === 1).id,
  );
  if (!baseExpression || baseExpression.operator !== 'ALL_OF') {
    fail(topologyCode, 'B9e core integration base expression drift');
  }
  return Object.freeze({
    schema_version:
      'STAGE_2Y_M7_V2_GOVERNED_DISCLOSURE_NOTE_CORE_INTEGRATION_EVIDENCE_VALIDATION/V1',
    status: 'PASS',
    expression_validation_schema_version: expressionValidation.schema_version,
    governed_disclosure_note_count: notesById.size,
    profile_requirement_count: requirementsById.size,
    b9e_path_child_kind: pathChild.kind,
    b9e_path_child_id: pathChild.id,
  });
}

function validateTerminationUnapprovedInventoryReviewEvidence(input = {}) {
  const topologyCode = 'M7_V2_TERMINATION_UNAPPROVED_INVENTORY_REVIEW';
  exactKeys(
    input,
    [
      'profile_approval_state',
      'profile_count',
      'complete_profile_count',
      'incomplete_profile_count',
      'proposed_profiles',
      'retained_source_gaps',
    ],
    topologyCode,
    'termination unapproved inventory review evidence',
  );
  if (input.profile_approval_state !== 'UNAPPROVED') {
    fail(topologyCode, 'termination inventory review profile approval state drift');
  }
  if (
    input.profile_count !== 45 ||
    input.complete_profile_count !== 44 ||
    input.incomplete_profile_count !== 1
  ) {
    fail(topologyCode, 'termination inventory review 45-profile census drift');
  }
  const profiles = array(
    input.proposed_profiles,
    topologyCode,
    'proposed profiles',
  );
  if (profiles.length !== 45) {
    fail(topologyCode, 'termination inventory review proposed profile count drift');
  }
  const gaps = array(
    input.retained_source_gaps,
    topologyCode,
    'retained source gaps',
  );
  if (gaps.length !== 1) {
    fail(topologyCode, 'termination inventory review retained source gap count drift');
  }
  return Object.freeze({
    schema_version:
      'STAGE_2Y_M7_V2_TERMINATION_UNAPPROVED_INVENTORY_REVIEW_EVIDENCE_VALIDATION/V1',
    status: 'PASS',
    profile_count: input.profile_count,
    complete_profile_count: input.complete_profile_count,
    incomplete_profile_count: input.incomplete_profile_count,
    retained_source_gap_count: gaps.length,
  });
}

function validateSyntheticExpressionEvidence(input = {}) {
  if (
    Object.prototype.hasOwnProperty.call(input, 'terminationAuthoringPhase2Authority') &&
    input.terminationAuthoringPhase2Authority !== undefined
  ) {
    return validateTerminationPhase2SyntheticExpressionEvidence(input);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'terminationAuthoringPhase2Authority')) {
    input = { ...input };
    delete input.terminationAuthoringPhase2Authority;
    return validateSyntheticExpressionEvidence(input);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'temporalPhase1Authority')
      && input.temporalPhase1Authority !== undefined) {
    return validateTemporalPhase1SyntheticExpressionEvidence(input);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'temporalPhase1Authority')) {
    input = { ...input };
    delete input.temporalPhase1Authority;
  }
  const topologyCode = 'M7_V2_EXPRESSION_TOPOLOGY';
  const provenanceCode = 'M7_V2_EXPRESSION_PROVENANCE';
  const inputKeys = [
    'source_text',
    'source_spans',
    'facts',
    'expressions',
  ];
  if (Object.prototype.hasOwnProperty.call(input, 'governed_disclosure_notes')) {
    inputKeys.push('governed_disclosure_notes');
  }
  exactKeys(input, inputKeys, topologyCode, 'synthetic expression evidence input');
  const sourceText = string(input.source_text, provenanceCode, 'synthetic source text');
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const spanById = indexBy(array(input.source_spans, provenanceCode, 'synthetic source spans'),
    'span_id', provenanceCode, 'synthetic source span');
  const spanBytesById = new Map();
  for (const span of spanById.values()) {
    exactKeys(span, ['span_id', 'start_byte', 'end_byte'], provenanceCode,
      'synthetic source span');
    if (!Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)
        || span.start_byte < 0 || span.end_byte <= span.start_byte
        || span.end_byte > sourceBytes.length) {
      fail(provenanceCode, 'synthetic source span has an invalid byte range');
    }
    spanBytesById.set(span.span_id, sourceBytes.subarray(span.start_byte, span.end_byte));
  }
  const sources = { spanById, spanBytesById };
  const facts = indexBy(array(input.facts, topologyCode, 'synthetic facts'),
    'fact_id', topologyCode, 'synthetic fact');
  const governedDisclosureNotes = Object.prototype.hasOwnProperty.call(
    input,
    'governed_disclosure_notes',
  ) ? indexBy(
    array(input.governed_disclosure_notes, topologyCode, 'synthetic governed disclosure notes'),
    'governed_disclosure_note_id',
    topologyCode,
    'synthetic governed disclosure note',
  ) : null;
  if (governedDisclosureNotes) {
    for (const note of governedDisclosureNotes.values()) {
      validateStage2YGovernedDisclosureNote(
        note,
        topologyCode,
        'synthetic governed disclosure note',
      );
    }
  }
  for (const fact of facts.values()) {
    exactKeys(fact, ['fact_id', 'source_support_ids'], topologyCode, 'synthetic fact');
    array(fact.source_support_ids, provenanceCode, 'synthetic fact source support');
    unique(fact.source_support_ids, provenanceCode, 'synthetic fact source support');
    if (fact.source_support_ids.some((spanId) => !spanById.has(spanId))) {
      fail(provenanceCode, 'synthetic fact cites an unknown source span');
    }
  }
  const expressions = indexBy(array(input.expressions, topologyCode, 'synthetic expressions'),
    'expression_id', topologyCode, 'synthetic expression');
  for (const expression of expressions.values()) {
    exactKeys(expression, [
      'expression_id', 'operator', 'children', 'connective_span_ids',
      'authored_limb_marker_span_ids', 'scope_span_ids',
    ], topologyCode, 'synthetic expression');
    if (!OPERATORS.has(expression.operator)) {
      fail(topologyCode, `operator ${expression.operator} is not in V2`);
    }
    array(expression.children, topologyCode, 'synthetic expression children');
    for (const child of expression.children) {
      exactKeys(child, ['kind', 'id'], topologyCode, 'synthetic expression child');
      if (!EXPRESSION_CHILD_KINDS.includes(child.kind)) {
        fail(topologyCode, 'synthetic expression child kind is invalid');
      }
      if (child.kind === 'FACT' && !facts.has(child.id)) {
        fail(topologyCode, 'synthetic expression child is absent');
      }
      if (child.kind === 'EXPRESSION' && !expressions.has(child.id)) {
        fail(topologyCode, 'synthetic expression child is absent');
      }
      if (child.kind === 'GOVERNED_DISCLOSURE_NOTE'
          && (!governedDisclosureNotes || !governedDisclosureNotes.has(child.id))) {
        fail(topologyCode, 'synthetic expression child is absent');
      }
    }
    validateDistinctExpressionChildren(expression);
    for (const [field, label] of [
      ['connective_span_ids', 'synthetic connective spans'],
      ['authored_limb_marker_span_ids', 'synthetic authored marker spans'],
      ['scope_span_ids', 'synthetic expression scope spans'],
    ]) {
      array(expression[field], provenanceCode, label);
      unique(expression[field], provenanceCode, label);
      if (expression[field].some((spanId) => !spanById.has(spanId))) {
        fail(provenanceCode, `${label} cite an unknown source span`);
      }
    }
    if (expression.connective_span_ids.length === 0) {
      fail(provenanceCode, 'synthetic expression lacks connective proof');
    }
    validateExpressionSourceOrder(expression, sources);
  }
  validateExpressionScopeEvidence(expressions, facts);
  return Object.freeze({
    schema_version: 'STAGE_2Y_M7_V2_SYNTHETIC_EXPRESSION_EVIDENCE_VALIDATION/V1',
    status: 'PASS',
    expression_count: expressions.size,
  });
}

function validateExpressions(analysis, profiles, facts, rules, sources) {
  const topologyCode = 'M7_V2_EXPRESSION_TOPOLOGY';
  const expressions = indexBy(array(analysis.expressions, topologyCode, 'expressions'),
    'expression_id', topologyCode, 'expression');
  const connectiveOwners = new Map();
  const authoredLimbMarkerOwners = new Map();
  for (const expression of expressions.values()) {
    exactKeys(expression, [
      'expression_id',
      'operator',
      'result_kind',
      'children',
      'parent_expression_id',
      'connective_span_ids',
      'authored_limb_marker_span_ids',
      'scope_span_ids',
    ], topologyCode, 'expression');
    const arity = OPERATORS.get(expression.operator);
    if (!arity) fail(topologyCode, `operator ${expression.operator} is not in V2`);
    const temporalOperator = expression.operator === 'EARLIER_OF'
      || expression.operator === 'LATER_OF';
    if (expression.result_kind !== (temporalOperator ? 'TEMPORAL' : 'LOGICAL')) {
      fail(topologyCode, `operator ${expression.operator} has the wrong result kind`);
    }
    array(expression.children, topologyCode, 'expression children');
    if (expression.expression_id !== contentId(EXPRESSION_SCHEMA, {
      operator: expression.operator,
      result_kind: expression.result_kind,
      children: expression.children,
      connective_span_ids: expression.connective_span_ids,
      authored_limb_marker_span_ids: expression.authored_limb_marker_span_ids,
      scope_span_ids: expression.scope_span_ids,
    })) fail(topologyCode, 'expression content identity is invalid');
    if (expression.children.length < arity.min || expression.children.length > arity.max) {
      fail(topologyCode, `operator ${expression.operator} has invalid arity`);
    }
    for (let childIndex = 0; childIndex < expression.children.length; childIndex += 1) {
      const child = expression.children[childIndex];
      exactKeys(child, ['kind', 'id', 'ordinal', 'role'], topologyCode, 'expression child');
      string(child.id, topologyCode, 'expression child ID');
      if (!Number.isInteger(child.ordinal) || child.ordinal < 1) {
        fail(topologyCode, 'expression child ordinal is invalid');
      }
      if (!arity.childKinds.includes(child.kind)) {
        fail(topologyCode, `operator ${expression.operator} cannot contain ${child.kind}`);
      }
      const approvedRoles = CHILD_ROLES[expression.operator];
      const expectedRole = approvedRoles.length === 1 ? approvedRoles[0] : approvedRoles[childIndex];
      if (child.role !== expectedRole) {
        fail(topologyCode, `operator ${expression.operator} child role is invalid`);
      }
      if (temporalOperator) {
        if (child.kind === 'FACT') {
          const timingFact = facts.get(child.id);
          if (!timingFact
              || !['DATE', 'DURATION', 'PERIOD', 'REFERENCE'].includes(timingFact.value_type)) {
            fail(topologyCode, `${expression.operator} contains a non-temporal fact`);
          }
        } else if (expressions.get(child.id)?.result_kind !== 'TEMPORAL') {
          fail(topologyCode, `${expression.operator} contains a non-temporal expression`);
        }
      }
    }
    validateDistinctExpressionChildren(expression);
    if (expression.parent_expression_id !== null) {
      string(expression.parent_expression_id, topologyCode, 'expression parent');
    }
    array(expression.connective_span_ids, 'M7_V2_EXPRESSION_PROVENANCE', 'connective spans');
    if (expression.connective_span_ids.length === 0) {
      fail('M7_V2_EXPRESSION_PROVENANCE', `expression ${expression.expression_id} lacks connective proof`);
    }
    unique(expression.connective_span_ids, 'M7_V2_EXPRESSION_PROVENANCE', 'connective spans');
    for (const spanId of expression.connective_span_ids) {
      if (!sources.spanById.has(spanId) || connectiveOwners.has(spanId)) {
        fail('M7_V2_EXPRESSION_PROVENANCE', 'connective span is absent or multiply owned');
      }
      connectiveOwners.set(spanId, expression.expression_id);
    }
    array(expression.authored_limb_marker_span_ids,
      'M7_V2_EXPRESSION_PROVENANCE', 'authored limb marker spans');
    unique(expression.authored_limb_marker_span_ids,
      'M7_V2_EXPRESSION_PROVENANCE', 'authored limb marker spans');
    for (const spanId of expression.authored_limb_marker_span_ids) {
      const sourceStatus = sources.sourceStatusBySpan.get(spanId);
      if (!sources.spanById.has(spanId) || authoredLimbMarkerOwners.has(spanId)
          || sourceStatus?.operative_marker_kind !== 'ENUMERATED_LIMB'
          || sourceStatus.authored_limb_overlay_authority_id === null) {
        fail('M7_V2_EXPRESSION_PROVENANCE',
          'authored limb marker is absent, multiply owned, or lacks exact overlay authority');
      }
      authoredLimbMarkerOwners.set(spanId, expression.expression_id);
    }
    array(expression.scope_span_ids, 'M7_V2_EXPRESSION_PROVENANCE', 'expression scope spans');
    if (expression.scope_span_ids.length === 0) {
      fail('M7_V2_EXPRESSION_PROVENANCE', 'expression scope is empty');
    }
    unique(expression.scope_span_ids, 'M7_V2_EXPRESSION_PROVENANCE', 'expression scope spans');
    for (const spanId of expression.scope_span_ids) {
      if (!sources.spanById.has(spanId)) {
        fail('M7_V2_EXPRESSION_PROVENANCE', 'expression scope cites an unknown span');
      }
    }
    validateExpressionSourceOrder(expression, sources);
  }
  validateExpressionScopeEvidence(expressions, facts, rules);

  const allVisited = new Set();
  const childRuleParents = new Map();
  for (const rule of rules.values()) {
    const profile = profiles.get(rule.profile_id);
    if (!profile) fail('M7_V2_PROFILE_GATE', `rule ${rule.rule_id} has no approved profile`);
    const calculated = expressionSignature(rule.root_expression_id, expressions, facts, rules,
      new Set(profile.allowed_operators))(rule);
    for (const expressionId of calculated.visited) {
      if (allVisited.has(expressionId)) fail(topologyCode, 'expression is shared by two rules');
      allVisited.add(expressionId);
      const expression = expressions.get(expressionId);
      const ownedSpanIds = [
        ...expression.connective_span_ids,
        ...expression.authored_limb_marker_span_ids,
        ...expression.scope_span_ids,
      ];
      if (ownedSpanIds.some(
        (spanId) => sources.closureBySpan.get(spanId) !== rule.source_closure_id,
      )) {
        fail('M7_V2_EXPRESSION_PROVENANCE',
          `expression ${expressionId} cites source outside its owning rule closure`);
      }
    }
    if (rule.expression_signature !== calculated.signature) {
      fail(topologyCode, `rule ${rule.rule_id} expression signature is false`);
    }
    if (!same([...calculated.referencedRules].sort(), [...rule.child_rule_ids].sort())) {
      fail(topologyCode, `rule ${rule.rule_id} child-rule links are unused or incomplete`);
    }
    for (const childRuleId of calculated.referencedRules) {
      if (childRuleParents.has(childRuleId)) {
        fail(topologyCode, `child rule ${childRuleId} is shared by two parents`);
      }
      childRuleParents.set(childRuleId, rule.rule_id);
    }
    if (['NORMAL', 'APPROVED_LIMITED', 'NO_COMPARISON'].includes(
      rule.validation.output_disposition)
        && profile.required_expression_signature !== calculated.signature) {
      fail(topologyCode, `rule ${rule.rule_id} does not match its required expression`);
    }
  }
  if (allVisited.size !== expressions.size) fail(topologyCode, 'expression graph contains an orphan');
  for (const rule of rules.values()) {
    const seenRules = new Set([rule.rule_id]);
    let parentId = childRuleParents.get(rule.rule_id);
    while (parentId !== undefined) {
      if (seenRules.has(parentId)) fail(topologyCode, 'child-rule graph contains a cycle');
      seenRules.add(parentId);
      parentId = childRuleParents.get(parentId);
    }
  }
  return { expressions, connectiveOwners };
}

function validateEffectLocalProvenance(candidates, facts, expressions, rules, sources) {
  const code = 'M7_V2_EFFECT_PROVENANCE';
  const factEffectOwner = new Map();
  const expressionEffectOwner = new Map();
  for (const { candidateSet, effect } of candidates.effects.values()) {
    const effectSpanIds = new Set(effect.source_span_ids);
    const closure = sources.closures.get(candidateSet.source_closure_id);
    if (!closure || effect.source_span_ids.some(
      (spanId) => sources.closureBySpan.get(spanId) !== closure.source_closure_id,
    )) fail(code, `effect ${effect.effect_id} cites source outside its exact closure`);
    for (const factId of effect.fact_ids) {
      const fact = facts.get(factId);
      if (!fact || fact.source_support_ids.length === 0
          || fact.source_support_ids.some((spanId) => !effectSpanIds.has(spanId))) {
        fail(code, `effect ${effect.effect_id} contains a fact proved by another effect`);
      }
      if (factEffectOwner.has(factId) && factEffectOwner.get(factId) !== effect.effect_id) {
        fail(code, `fact ${factId} is shared by two inspected effects`);
      }
      factEffectOwner.set(factId, effect.effect_id);
      const ownerRule = rules.get(fact.owner_rule_id);
      if (!ownerRule || ownerRule.effect_id !== effect.effect_id) {
        fail(code, `fact ${factId} is owned by a rule from another effect`);
      }
    }
    const visited = new Set();
    const visitExpression = (expressionId) => {
      if (visited.has(expressionId)) return;
      visited.add(expressionId);
      const expression = expressions.get(expressionId);
      if (!expression
          || [...expression.connective_span_ids, ...expression.authored_limb_marker_span_ids,
            ...expression.scope_span_ids].some(
            (spanId) => !effectSpanIds.has(spanId),
          )) {
        fail(code, `effect ${effect.effect_id} contains logic proved by another effect`);
      }
      if (expressionEffectOwner.has(expressionId)
          && expressionEffectOwner.get(expressionId) !== effect.effect_id) {
        fail(code, `expression ${expressionId} is shared by two inspected effects`);
      }
      expressionEffectOwner.set(expressionId, effect.effect_id);
      for (const child of expression.children) {
        if (child.kind === 'FACT' && !effect.fact_ids.includes(child.id)) {
          fail(code, `effect ${effect.effect_id} expression cites another effect's fact`);
        }
        if (child.kind === 'EXPRESSION') visitExpression(child.id);
        if (child.kind === 'RULE' && rules.get(child.id)?.effect_id !== effect.effect_id) {
          fail(code, `effect ${effect.effect_id} expression cites another effect's rule`);
        }
      }
    };
    if (effect.expression_root_id !== null) visitExpression(effect.expression_root_id);
    const effectRules = [...rules.values()].filter((rule) => rule.effect_id === effect.effect_id);
    if (effectRules.some((rule) => rule.root_expression_id !== effect.expression_root_id
        || rule.fact_ids.some((factId) => !effect.fact_ids.includes(factId)))) {
      fail(code, `effect ${effect.effect_id} differs from its derived rule support`);
    }
  }
  for (const fact of facts.values()) {
    if (!factEffectOwner.has(fact.fact_id)) {
      fail(code, `fact ${fact.fact_id} belongs to no inspected effect`);
    }
  }
  for (const expression of expressions.values()) {
    if (!expressionEffectOwner.has(expression.expression_id)) {
      fail(code, `expression ${expression.expression_id} belongs to no inspected effect`);
    }
  }
}

function validateSharedFactCoverages(analysis, sources, facts, rules, profiles, semanticInputs) {
  const code = 'M7_V2_SOURCE_COVERAGE';
  const byId = indexBy(array(
    analysis.shared_fact_coverages, code, 'shared fact coverages',
  ), 'shared_fact_coverage_id', code, 'shared fact coverage');
  const bySpan = new Map();
  const byFact = new Map();
  for (const record of byId.values()) {
    exactKeys(record, [
      'schema_version', 'shared_fact_coverage_id', 'input_occurrence_id',
      'source_closure_id', 'span_id', 'fact_ids', 'lawyer_decision_id', 'reason_code',
    ], code, 'shared fact coverage');
    const unsigned = { ...record };
    delete unsigned.schema_version;
    delete unsigned.shared_fact_coverage_id;
    if (record.schema_version !== SHARED_FACT_COVERAGE_SCHEMA
        || record.shared_fact_coverage_id !== contentId(
          SHARED_FACT_COVERAGE_SCHEMA, unsigned,
        )) {
      fail(code, 'shared fact coverage content identity is invalid');
    }
    string(record.input_occurrence_id, code, 'shared fact occurrence ID');
    string(record.source_closure_id, code, 'shared fact source closure ID');
    string(record.span_id, code, 'shared fact source span ID');
    const factIds = canonicalStringSet(record.fact_ids, code, 'shared fact IDs');
    if (factIds.length !== 2 || !same(factIds, record.fact_ids)
        || record.reason_code !== 'SAME_SOURCE_DISTINCT_LEGAL_EFFECT_ROLE'
        || record.lawyer_decision_id !== ITEM42_DECISION_ID
        || bySpan.has(record.span_id)) {
      fail(code, 'shared fact coverage is not the exact two-fact item-42 exception');
    }
    const authority = semanticInputs.decisionAuthorities.get(record.lawyer_decision_id);
    const closure = sources.closures.get(record.source_closure_id);
    const sharedFacts = factIds.map((factId) => facts.get(factId));
    const ownerRules = sharedFacts.map((fact) => rules.get(fact?.owner_rule_id));
    const sharedProfiles = ownerRules.map((rule) => profiles.get(rule?.profile_id));
    if (authority?.packetMember.sample_ordinal !== 42
        || authority.packetMember.reviewer !== 'BEN_GOODCHILD'
        || authority.fixedMember.family_key !== 'DNO_INDEMNIFICATION'
        || analysis.agreement_id !== ITEM42_44_AGREEMENT_ID
        || closure?.source_node_occurrence_id !== ITEM42_SOURCE_NODE_ID
        || !authority.fixedMember.source_node_occurrence_ids.includes(
          closure.source_node_occurrence_id,
        )
        || !semanticInputs.packetRulingIds.has('M5-RULING-ONE-SEMANTIC-OWNER')
        || sharedFacts.some((fact) => !fact || fact.value_type !== 'DURATION'
          || fact.normalisation_proof.rule_id !== 'DURATION_PARSER/V1'
          || fact.dependency_ids.length !== 0
          || !same(fact.source_support_ids, [record.span_id]))
        || !same(sharedFacts[0].typed_value, sharedFacts[1].typed_value)
        || !same(sharedFacts[0].typed_value, {
          bound_type: 'EXACT', count: 6, unit: 'YEAR',
        })
        || new Set(sharedFacts.map((fact) => fact.field_key)).size !== 2
        || !same(sharedFacts.map((fact) => fact.field_key).sort(), [
          'NO_ADVERSE_AMENDMENT_DURATION', 'RIGHTS_SURVIVAL_DURATION',
        ])
        || !same(sharedFacts.map((fact) => fact.legal_effect_role).sort(), [
          'NO_ADVERSE_AMENDMENT_PROTECTION_PERIOD', 'RIGHTS_SURVIVAL_PERIOD',
        ])
        || sharedFacts.some((fact) => (
          fact.temporal_scope_signature !== 'FROM_EFFECTIVE_TIME_FOR_SIX_YEARS'
        ))
        || sources.spanBytesById.get(record.span_id)?.toString('utf8') !== 'six (6) years'
        || ownerRules.some((rule) => !rule
          || rule.input_occurrence_id !== record.input_occurrence_id
          || rule.source_closure_id !== record.source_closure_id)
        || new Set(ownerRules.map((rule) => rule.rule_id)).size !== 2
        || new Set(ownerRules.map((rule) => rule.effect_id)).size !== 2
        || !same(sharedProfiles.map((profile) => profile?.subtype_path.at(-1)).sort(), [
          'NO_ADVERSE_AMENDMENT', 'RIGHTS_SURVIVAL',
        ])) {
      fail(code, 'shared fact coverage lacks exact item-42 source, profile, or lawyer authority');
    }
    for (const factId of factIds) {
      if (byFact.has(factId)) fail(code, 'fact appears in two shared-source records');
      byFact.set(factId, record);
    }
    bySpan.set(record.span_id, record);
  }
  return { byId, bySpan, byFact };
}

function validateCoverage(
  analysis, sources, facts, expressions, semanticInputs, sharedFactCoverages,
) {
  const code = 'M7_V2_SOURCE_COVERAGE';
  const partitions = indexBy(array(analysis.coverage_partitions, code, 'coverage partitions'),
    'source_closure_id', code, 'coverage partition');
  const coverageBySpan = new Map();
  if (partitions.size !== sources.closures.size) fail(code, 'coverage partitions are incomplete');
  for (const closure of sources.closures.values()) {
    const partition = partitions.get(closure.source_closure_id);
    if (!partition) fail(code, `source closure ${closure.source_closure_id} is unpartitioned`);
    exactKeys(partition, ['source_closure_id', 'entries'], code, 'coverage partition');
    array(partition.entries, code, 'coverage entries');
    if (partition.entries.length !== closure.spans.length) {
      fail(code, 'coverage partition does not have one entry per source span');
    }
    const noOutputDispositions = analysis.dispositions.filter(
      (disposition) => disposition.source_closure_id === closure.source_closure_id
        && disposition.output_disposition === 'NO_OUTPUT',
    );
    const noOutputAuthorityIds = [...new Set(noOutputDispositions.map(
      (disposition) => disposition.no_output_authority?.structure_disposition_id,
    ))];
    if (noOutputAuthorityIds.length > 1 || noOutputAuthorityIds.includes(undefined)) {
      fail(code, 'one source closure has inconsistent no-output authorities');
    }
    const noOutputAuthorityId = noOutputAuthorityIds[0] ?? null;
    for (let index = 0; index < closure.spans.length; index += 1) {
      const span = closure.spans[index];
      const entry = partition.entries[index];
      exactKeys(entry, [
        'span_id',
        'treatment_kind',
        'owner_id',
        'reason_code',
        'authority_id',
        'materiality',
      ], code, 'coverage entry');
      if (entry.span_id !== span.span_id || entry.materiality !== span.materiality) {
        fail(code, 'coverage partition is not an exact ordered source partition');
      }
      coverageBySpan.set(span.span_id, entry);
      if (entry.treatment_kind === 'FACT') {
        const fact = facts.get(entry.owner_id);
        if (!fact || !fact.source_support_ids.includes(span.span_id)
            || entry.reason_code !== null || entry.authority_id !== null) {
          fail(code, `fact coverage for ${span.span_id} is false`);
        }
      } else if (entry.treatment_kind === 'SHARED_FACT') {
        const shared = sharedFactCoverages.byId.get(entry.owner_id);
        if (!shared || shared.span_id !== span.span_id
            || entry.reason_code !== shared.reason_code
            || entry.authority_id !== shared.lawyer_decision_id
            || shared.fact_ids.some((factId) => !facts.get(factId)?.source_support_ids.includes(
              span.span_id,
            ))) {
          fail(code, `shared fact coverage for ${span.span_id} is false`);
        }
      } else if (entry.treatment_kind === 'LOGIC_CONNECTIVE') {
        const expression = expressions.get(entry.owner_id);
        if (!expression || !expression.connective_span_ids.includes(span.span_id)
            || sources.sourceStatusBySpan.get(span.span_id)
              ?.authored_limb_overlay_authority_id !== null
            || entry.reason_code !== null || entry.authority_id !== null) {
          fail(code, `connective coverage for ${span.span_id} is false`);
        }
      } else if (entry.treatment_kind === 'AUTHORED_LIMB_MARKER') {
        const expression = expressions.get(entry.owner_id);
        const sourceStatus = sources.sourceStatusBySpan.get(span.span_id);
        const authority = semanticInputs.structureMembers.get(entry.authority_id);
        if (!expression
            || !expression.authored_limb_marker_span_ids.includes(span.span_id)
            || sourceStatus?.operative_marker_kind !== 'ENUMERATED_LIMB'
            || sourceStatus.authored_limb_overlay_authority_id !== entry.authority_id
            || !authority || authority.kind !== 'BEN_AUTHORED_INLINE_LIST_OVERLAY'
            || authority.authority_class !== 'BEN_LEGAL_RULING'
            || authority.approver !== 'BEN_GOODCHILD'
            || entry.reason_code !== authority.reason_code) {
          fail(code, `authored limb marker coverage for ${span.span_id} is false`);
        }
        validateAuthoredLimbMarkerScope(authority, span, sources, closure, code);
      } else if (entry.treatment_kind === 'RESOLVED_DEPENDENCY') {
        const dependency = sources.dependencies.get(entry.owner_id);
        if (!dependency || dependency.state !== 'RESOLVED'
            || !dependency.source_support_ids.includes(span.span_id)
            || entry.reason_code !== null || entry.authority_id !== null) {
          fail(code, `dependency coverage for ${span.span_id} is false`);
        }
      } else if (entry.treatment_kind === 'STRUCTURAL_TEXT'
          || entry.treatment_kind === 'SOURCE_ARTEFACT') {
        const authority = semanticInputs.structureMembers.get(entry.authority_id);
        const sourceStatus = sources.sourceStatusBySpan.get(span.span_id);
        const expectedKind = entry.treatment_kind === 'STRUCTURAL_TEXT'
          ? 'TECHNICAL_STRUCTURE' : 'SOURCE_ARTEFACT';
        if (!sourceStatus?.technical
            || sourceStatus.legal_text || sourceStatus.operative
            || sourceStatus.materiality === 'MATERIAL'
            || sourceStatus.technical_authority_id !== entry.authority_id
            || sourceStatus.technical_authority_kind !== expectedKind
            || entry.owner_id !== null
            || typeof entry.reason_code !== 'string' || entry.reason_code.length === 0
            || !authority || authority.kind !== expectedKind
            || authority.authority_class !== sourceStatus.technical_authority_class
            || (authority.authority_class === 'BEN_LEGAL_RULING'
              && (authority.approver !== 'BEN_GOODCHILD'
                || typeof authority.lawyer_ruling_id !== 'string'
                || !semanticInputs.packetRulingIds.has(authority.lawyer_ruling_id)))
            || (authority.authority_class === 'DETERMINISTIC_TECHNICAL'
              && expectedKind === 'SOURCE_ARTEFACT'
              && sourceStatus.native_source_artefact_id === null
              && /[\p{L}\p{N}]/u.test(sources.spanBytesById.get(span.span_id).toString('utf8')))
            || authority.reason_code !== entry.reason_code) {
          fail(code, `legal or material span ${span.span_id} was hidden as technical text`);
        }
        validateStructureScope(authority, span, sources, closure, code);
      } else if (entry.treatment_kind === 'LEGAL_TEXT_EXCLUSION') {
        const authority = semanticInputs.structureMembers.get(entry.authority_id);
        const approvedLegalExclusion = authority?.kind === 'LEGAL_TEXT_EXCLUSION';
        const approvedNoOutputExclusion = authority?.kind === 'NO_OUTPUT'
          && noOutputAuthorityId === authority.structure_disposition_id;
        if (typeof entry.reason_code !== 'string' || entry.reason_code.length === 0
            || entry.owner_id !== null
            || !authority || (!approvedLegalExclusion && !approvedNoOutputExclusion)
            || authority.authority_class !== 'BEN_LEGAL_RULING'
            || authority.reason_code !== entry.reason_code
            || authority.approver !== 'BEN_GOODCHILD') {
          fail(code, `legal-text exclusion ${span.span_id} lacks exact authority`);
        }
        if (approvedNoOutputExclusion) {
          validateNoOutputScope(authority, span, sources, closure, code);
        } else {
          validateStructureScope(authority, span, sources, closure, code);
        }
      } else {
        fail(code, `coverage treatment ${entry.treatment_kind} is not approved`);
      }
    }
    if (noOutputAuthorityId !== null) {
      for (let index = 0; index < closure.spans.length; index += 1) {
        const span = closure.spans[index];
        const entry = partition.entries[index];
        const sourceStatus = sources.sourceStatusBySpan.get(span.span_id);
        const exactNoOutputExclusion = entry.treatment_kind === 'LEGAL_TEXT_EXCLUSION'
          && entry.authority_id === noOutputAuthorityId;
        const exactDependency = entry.treatment_kind === 'RESOLVED_DEPENDENCY';
        const exactTechnical = entry.treatment_kind === 'STRUCTURAL_TEXT'
          || entry.treatment_kind === 'SOURCE_ARTEFACT';
        if ((!exactNoOutputExclusion && !exactDependency && !exactTechnical)
            || (sourceStatus?.operative && !exactNoOutputExclusion)
            || (sourceStatus?.technical && !exactTechnical)
            || (!sourceStatus?.technical && !exactDependency && !exactNoOutputExclusion)) {
          fail(code, 'no-output coverage does not exhaust the exact authorised source closure');
        }
      }
    }
  }
  for (const fact of facts.values()) {
    for (const spanId of fact.source_support_ids) {
      const entry = coverageBySpan.get(spanId);
      const shared = sharedFactCoverages.byFact.get(fact.fact_id);
      const exactScalarOwner = entry?.treatment_kind === 'FACT'
        && entry.owner_id === fact.fact_id;
      const exactSharedOwner = entry?.treatment_kind === 'SHARED_FACT'
        && entry.owner_id === shared?.shared_fact_coverage_id
        && shared.span_id === spanId;
      if (!exactScalarOwner && !exactSharedOwner) {
        fail(code, `fact ${fact.fact_id} does not own its exact source support`);
      }
    }
  }
  for (const expression of expressions.values()) {
    for (const spanId of expression.connective_span_ids) {
      const entry = coverageBySpan.get(spanId);
      if (!entry || entry.treatment_kind !== 'LOGIC_CONNECTIVE'
          || entry.owner_id !== expression.expression_id) {
        fail(code, `expression ${expression.expression_id} does not own its connective proof`);
      }
    }
    for (const spanId of expression.authored_limb_marker_span_ids) {
      const entry = coverageBySpan.get(spanId);
      const sourceStatus = sources.sourceStatusBySpan.get(spanId);
      if (!entry || entry.treatment_kind !== 'AUTHORED_LIMB_MARKER'
          || entry.owner_id !== expression.expression_id
          || entry.authority_id !== sourceStatus?.authored_limb_overlay_authority_id) {
        fail(code, `expression ${expression.expression_id} does not own its authored limb proof`);
      }
    }
  }
  return coverageBySpan;
}

function validateAuthoredLimbMarkerScope(authority, span, sources, closure, code) {
  const agreementIndex = sources.agreementIndexByClosure.get(closure.source_closure_id);
  if (!agreementIndex || authority.scope.agreement_index_id !== agreementIndex.agreement_index_id
      || authority.scope.source_node_occurrence_id !== span.source_node_occurrence_id
      || span.start_byte < authority.scope.start_byte
      || span.end_byte > authority.scope.end_byte) {
    fail(code,
      `authored limb overlay ${authority.structure_disposition_id} has a false marker scope`);
  }
}

function validateStructureScope(authority, span, sources, closure, code) {
  const agreementIndex = sources.agreementIndexByClosure.get(closure.source_closure_id);
  if (!agreementIndex || authority.scope.agreement_index_id !== agreementIndex.agreement_index_id
      || authority.scope.source_node_occurrence_id !== span.source_node_occurrence_id
      || authority.scope.start_byte !== span.start_byte
      || authority.scope.end_byte !== span.end_byte) {
    fail(code, `structure disposition ${authority.structure_disposition_id} has a false scope`);
  }
}

function validateNoOutputScope(authority, span, sources, closure, code) {
  const agreementIndex = sources.agreementIndexByClosure.get(closure.source_closure_id);
  if (!agreementIndex || authority.scope.agreement_index_id !== agreementIndex.agreement_index_id
      || authority.scope.source_node_occurrence_id !== closure.source_node_occurrence_id
      || authority.scope.start_byte !== closure.governing_start_byte
      || authority.scope.end_byte !== closure.governing_end_byte
      || span.source_node_occurrence_id !== closure.source_node_occurrence_id
      || span.start_byte < authority.scope.start_byte
      || span.end_byte > authority.scope.end_byte) {
    fail(code, `no-output disposition ${authority.structure_disposition_id} has a false scope`);
  }
}

function validateOverlayCompoundEffect(
  analysis, ledger, closure, entry, derivedMarkerSpanIds, facts, rules, expressions,
  sources, candidates, semanticInputs, linkedExpressionIds,
) {
  const code = 'M7_V2_EFFECT_LEDGER';
  const stateCode = 'M7_V2_STATE_COMBINATION';
  const overlayMarkerSpanIds = derivedMarkerSpanIds.filter((spanId) => (
    typeof sources.sourceStatusBySpan.get(spanId)?.authored_limb_overlay_authority_id
      === 'string'
  ));
  if (overlayMarkerSpanIds.length === 0) return;
  const modalMarkerSpanIds = derivedMarkerSpanIds.filter((spanId) => (
    sources.sourceStatusBySpan.get(spanId)?.operative_marker_kind === 'MODAL'
  ));
  const limbMarkerSpanIds = derivedMarkerSpanIds.filter((spanId) => (
    sources.sourceStatusBySpan.get(spanId)?.operative_marker_kind === 'ENUMERATED_LIMB'
  ));
  const overlayAuthorityIds = new Set(overlayMarkerSpanIds.map(
    (spanId) => sources.sourceStatusBySpan.get(spanId).authored_limb_overlay_authority_id,
  ));
  const selectedTreeIds = new Set(overlayMarkerSpanIds.map(
    (spanId) => sources.sourceStatusBySpan.get(spanId)
      .authored_limb_selected_candidate_tree_id,
  ));
  if (ledger.entries.length !== 1 || entry.effect_kind !== 'COMBINED_MODAL_LIMB'
      || entry.rule_ids.length !== 1 || overlayMarkerSpanIds.length !== 6
      || limbMarkerSpanIds.length !== 6 || modalMarkerSpanIds.length !== 4
      || derivedMarkerSpanIds.length !== 10
      || !same(overlayMarkerSpanIds, limbMarkerSpanIds)
      || overlayAuthorityIds.size !== 1 || selectedTreeIds.size !== 1) {
    fail(code, 'item-39 overlay is not one compound effect with six limbs and four modals');
  }
  const overlayAuthorityId = [...overlayAuthorityIds][0];
  const selectedTreeId = [...selectedTreeIds][0];
  const overlayAuthority = semanticInputs.structureMembers.get(overlayAuthorityId);
  if (!overlayAuthority || overlayAuthority.kind !== 'BEN_AUTHORED_INLINE_LIST_OVERLAY'
      || overlayAuthority.authority_class !== 'BEN_LEGAL_RULING'
      || overlayAuthority.approver !== 'BEN_GOODCHILD'
      || overlayAuthority.inline_list_overlay.selected_candidate_tree_id !== selectedTreeId) {
    fail(code, 'item-39 compound effect lacks its exact selected overlay authority');
  }
  const rule = rules.get(entry.rule_ids[0]);
  const candidate = candidates.effects.get(entry.effect_id);
  if (!rule || !candidate || rule.effect_id !== entry.effect_id
      || rule.source_closure_id !== closure.source_closure_id
      || rule.root_expression_id !== candidate.effect.expression_root_id
      || candidate.effect.generic_level_output_authority !== null) {
    fail(code, 'item-39 compound effect does not bind one direct review-only rule');
  }

  const expressionByMarkerSpan = new Map();
  for (const expressionId of linkedExpressionIds) {
    const expression = expressions.get(expressionId);
    if (!expression) fail(code, 'item-39 compound effect cites an absent expression');
    const ownedOverlayMarkers = expression.authored_limb_marker_span_ids.filter(
      (spanId) => overlayMarkerSpanIds.includes(spanId),
    );
    if (ownedOverlayMarkers.length > 1
        || (ownedOverlayMarkers.length === 1
          && expression.authored_limb_marker_span_ids.length !== 1)) {
      fail(code, 'item-39 marker expression does not own exactly one selected-tree limb');
    }
    if (ownedOverlayMarkers.length === 1) {
      expressionByMarkerSpan.set(ownedOverlayMarkers[0], expression);
    }
  }
  if (expressionByMarkerSpan.size !== 6
      || linkedExpressionIds.size !== 7
      || [...expressionByMarkerSpan.values()].some(
        (expression) => expression.expression_id === rule.root_expression_id,
      )) {
    fail(code, 'item-39 selected tree is not six marker expressions under one rule root');
  }

  const expressionByMarkerKey = new Map();
  const markerNodes = overlayMarkerSpanIds.map((spanId) => {
    const sourceStatus = sources.sourceStatusBySpan.get(spanId);
    const node = sourceStatus.authored_limb_selected_tree_node;
    const span = sources.spanById.get(spanId);
    if (!node || !span || node.marker_span.start_byte !== span.start_byte
        || node.marker_span.end_byte !== span.end_byte
        || node.marker_span.text_sha256 !== span.text_sha256) {
      fail(code, 'item-39 expression marker differs from its selected-tree node');
    }
    const markerKey = `MARKER:${node.marker_span.start_byte}:${node.marker_span.end_byte}`;
    expressionByMarkerKey.set(markerKey, expressionByMarkerSpan.get(spanId));
    return { spanId, node, markerKey };
  });
  const expectedChildrenByParent = new Map();
  for (const { spanId, node } of markerNodes) {
    const markerExpression = expressionByMarkerSpan.get(spanId);
    const expectedParent = node.parent_key.startsWith('SEALED_PARENT:')
      ? expressions.get(rule.root_expression_id)
      : expressionByMarkerKey.get(node.parent_key);
    if (!expectedParent || markerExpression.parent_expression_id
        !== expectedParent.expression_id) {
      fail(code, 'item-39 expression parentage differs from the selected overlay tree');
    }
    if (!expectedChildrenByParent.has(node.parent_key)) {
      expectedChildrenByParent.set(node.parent_key, []);
    }
    expectedChildrenByParent.get(node.parent_key).push({
      expression_id: markerExpression.expression_id,
      sibling_ordinal: node.sibling_ordinal,
    });
  }
  const parentKeys = new Set([
    ...expectedChildrenByParent.keys(),
    ...markerNodes.map(({ markerKey }) => markerKey),
  ]);
  for (const parentKey of parentKeys) {
    const parentExpression = parentKey.startsWith('SEALED_PARENT:')
      ? expressions.get(rule.root_expression_id)
      : expressionByMarkerKey.get(parentKey);
    const expectedChildren = (expectedChildrenByParent.get(parentKey) ?? [])
      .sort((left, right) => left.sibling_ordinal - right.sibling_ordinal);
    if (!parentExpression
        || expectedChildren.some((child, index) => child.sibling_ordinal !== index)
        || !same(parentExpression.children.filter((child) => child.kind === 'EXPRESSION')
          .map((child) => child.id), expectedChildren.map((child) => child.expression_id))) {
      fail(code, 'item-39 expression sibling order differs from the selected overlay tree');
    }
  }

  const appliesToFactIds = array(
    rule.applies_to_fact_ids, stateCode, 'item-39 applies-to fact IDs',
  );
  const ownedAppliesToFactIds = array(
    rule.fact_ids, stateCode, 'item-39 rule fact IDs',
  ).filter((factId) => facts.get(factId)?.field_key === 'APPLIES_TO');
  if (!isObject(rule.validation)
      || rule.validation.extraction_state !== 'INCOMPLETE'
      || rule.validation.source_quality !== 'SUFFICIENT'
      || rule.validation.output_disposition !== 'REVIEW_ONLY'
      || !same(rule.validation.issue_codes, ['MISSING_OPERATIVE_CHAPEAU'])
      || rule.validation.no_comparison_authority !== null
      || appliesToFactIds.length !== 1
      || !same(ownedAppliesToFactIds, appliesToFactIds)) {
    fail(stateCode, 'item-39 compound rule is not the exact incomplete review-only result');
  }
  const appliesToFact = facts.get(appliesToFactIds[0]);
  const appliesToSource = appliesToFact ? sourceTextForSpanIds(
    appliesToFact.source_support_ids, sources, stateCode, 'item-39 applies-to source',
  ) : null;
  if (!appliesToFact || appliesToFact.owner_rule_id !== rule.rule_id
      || appliesToFact.field_key !== 'APPLIES_TO' || appliesToFact.value_type !== 'PARTY'
      || appliesToFact.normalisation_proof.rule_id !== 'BOUND_PARTY_ALIAS/V1'
      || appliesToFact.dependency_ids.length !== 0
      || !same(normalisedWords(appliesToSource), ['parent'])
      || appliesToFact.source_support_ids.some(
        (spanId) => !entry.source_span_ids.includes(spanId),
      )) {
    fail(stateCode, 'item-39 rule lacks the direct local Parent applies-to fact');
  }
  const matchingDispositions = analysis.dispositions.filter(
    (disposition) => disposition.input_occurrence_id === entry.input_occurrence_id,
  );
  const disposition = matchingDispositions[0];
  if (matchingDispositions.length !== 1 || !isObject(disposition)
      || !same(disposition.rule_ids, [rule.rule_id])
      || disposition.extraction_state !== 'INCOMPLETE'
      || disposition.source_quality !== 'SUFFICIENT'
      || disposition.output_disposition !== 'REVIEW_ONLY'
      || disposition.no_output_authority !== null || !Array.isArray(disposition.issues)
      || disposition.issues.length !== 1) {
    fail(stateCode, 'item-39 occurrence is not the exact incomplete review-only result');
  }
  const issue = disposition.issues[0];
  if (issue.effect_id !== entry.effect_id || issue.rule_id !== rule.rule_id
      || issue.issue_code !== 'MISSING_OPERATIVE_CHAPEAU'
      || issue.extraction_state !== 'INCOMPLETE' || issue.source_quality !== 'SUFFICIENT'
      || !Array.isArray(issue.source_span_ids) || issue.source_span_ids.length === 0
      || issue.source_span_ids.some((spanId) => !entry.source_span_ids.includes(spanId))) {
    fail(stateCode, 'item-39 occurrence lacks the exact missing-chapeau issue');
  }
}

function validateEffectLedgers(
  analysis, facts, rules, expressions, sources, candidates, semanticInputs, coverageBySpan,
  sharedFactCoverages, ownershipLinks,
) {
  const code = 'M7_V2_EFFECT_LEDGER';
  const targetRules = new Set();
  const targetEffects = new Set();
  const authoredUnits = new Set();
  const sharedLedgerUses = new Map(
    [...sharedFactCoverages.byId.keys()].map((sharedId) => [sharedId, []]),
  );
  for (const ledger of array(analysis.authored_unit_effect_ledgers, code, 'effect ledgers')) {
    exactKeys(ledger, [
      'schema_version', 'effect_ledger_id', 'authored_unit_id', 'source_closure_id', 'entries',
    ], code, 'effect ledger');
    if (ledger.schema_version !== EFFECT_LEDGER_SCHEMA) {
      fail(code, 'effect ledger schema is invalid');
    }
    const unsignedLedger = { ...ledger };
    delete unsignedLedger.schema_version;
    delete unsignedLedger.effect_ledger_id;
    if (ledger.effect_ledger_id !== contentId(EFFECT_LEDGER_SCHEMA, unsignedLedger)) {
      fail(code, 'effect ledger content identity is invalid');
    }
    string(ledger.authored_unit_id, code, 'effect-ledger authored unit');
    if (authoredUnits.has(ledger.authored_unit_id)) fail(code, 'authored unit has two effect ledgers');
    authoredUnits.add(ledger.authored_unit_id);
    const closure = sources.closures.get(ledger.source_closure_id);
    if (!closure || closure.authored_unit_id !== ledger.authored_unit_id) {
      fail(code, 'effect ledger source closure is inconsistent');
    }
    const closureDispositions = analysis.dispositions.filter(
      (disposition) => disposition.source_closure_id === ledger.source_closure_id,
    );
    const noOutputDispositions = closureDispositions.filter(
      (disposition) => disposition.output_disposition === 'NO_OUTPUT',
    );
    const noOutputAuthorityIds = [...new Set(noOutputDispositions.map(
      (disposition) => disposition.no_output_authority?.structure_disposition_id,
    ))];
    if (noOutputAuthorityIds.length > 1 || noOutputAuthorityIds.includes(undefined)) {
      fail(code, 'one effect ledger has inconsistent no-output authorities');
    }
    const noOutputAuthorityId = noOutputAuthorityIds[0] ?? null;
    const noOutputOccurrenceIds = new Set(noOutputDispositions.map(
      (disposition) => disposition.input_occurrence_id,
    ));
    if (!candidates.byAuthoredUnit.has(ledger.authored_unit_id)) {
      fail(code, 'effect ledger lacks an all-family candidate set');
    }
    const effectIds = new Set();
    const ledgerSpanOwners = new Map();
    const operativeMarkerOwners = new Map();
    for (const entry of array(ledger.entries, code, 'effect ledger entries')) {
      exactKeys(entry, [
        'effect_id', 'input_occurrence_id', 'effect_kind', 'rule_ids', 'source_span_ids',
        'operative_marker_span_ids', 'treatments',
      ], code, 'effect ledger entry');
      string(entry.effect_id, code, 'effect ledger effect ID');
      if (effectIds.has(entry.effect_id)) fail(code, 'effect ledger contains a duplicate effect');
      effectIds.add(entry.effect_id);
      const candidate = candidates.effects.get(entry.effect_id);
      if (!candidate || candidate.candidateSet.authored_unit_id !== ledger.authored_unit_id
          || candidate.candidateSet.source_closure_id !== ledger.source_closure_id
          || candidate.effect.input_occurrence_id !== entry.input_occurrence_id) {
        fail(code, 'effect ledger entry differs from its inspected candidate effect');
      }
      if (targetEffects.has(entry.effect_id)) fail(code, 'candidate effect appears in two ledgers');
      targetEffects.add(entry.effect_id);
      const expectedRuleIds = [...rules.values()].filter(
        (rule) => rule.effect_id === entry.effect_id,
      ).map((rule) => rule.rule_id).sort();
      const ruleIds = array(entry.rule_ids, code, 'effect ledger rule IDs');
      ruleIds.forEach((ruleId) => string(ruleId, code, 'effect ledger rule ID'));
      unique(ruleIds, code, 'effect ledger rule IDs');
      if (!same([...ruleIds].sort(), expectedRuleIds)) {
        fail(code, 'effect ledger does not bind every and only derived rule');
      }
      const noOutputEffect = ruleIds.length === 0
        && noOutputOccurrenceIds.has(entry.input_occurrence_id);
      if (noOutputEffect && (candidate.effect.fact_ids.length !== 0
          || candidate.effect.expression_root_id !== null)) {
        fail(code, 'no-output effect contains an unowned fact or expression');
      }
      for (const ruleId of ruleIds) {
        const rule = rules.get(ruleId);
        if (!rule || rule.authored_unit_id !== ledger.authored_unit_id
            || rule.source_closure_id !== ledger.source_closure_id
            || targetRules.has(ruleId)) {
          fail(code, 'derived rule appears outside or twice in its effect ledger');
        }
        targetRules.add(ruleId);
      }
      array(entry.source_span_ids, code, 'effect source spans');
      if (entry.source_span_ids.length === 0) fail(code, 'effect has no source proof');
      unique(entry.source_span_ids, code, 'effect source spans');
      for (const spanId of entry.source_span_ids) {
        if (sources.closureBySpan.get(spanId) !== ledger.source_closure_id) {
          fail(code, 'effect source span falls outside its authored unit');
        }
      }
      if (!same(entry.source_span_ids, candidate.effect.source_span_ids)) {
        fail(code, 'effect ledger source differs from the inspected effect');
      }
      if (!['MODAL', 'ENUMERATED_LIMB', 'COMBINED_MODAL_LIMB'].includes(
        entry.effect_kind,
      )) {
        fail(code, 'effect ledger kind is not source-first');
      }
      const markerSpanIds = array(entry.operative_marker_span_ids, code,
        'operative marker spans');
      unique(markerSpanIds, code, 'operative marker spans');
      const derivedMarkerSpanIds = entry.source_span_ids.filter(
        (spanId) => sources.sourceStatusBySpan.get(spanId)?.operative === true,
      );
      const derivedMarkerKinds = derivedMarkerSpanIds.map(
        (spanId) => sources.sourceStatusBySpan.get(spanId).operative_marker_kind,
      );
      const modalMarkerCount = derivedMarkerKinds.filter((kind) => kind === 'MODAL').length;
      const limbMarkerCount = derivedMarkerKinds.filter(
        (kind) => kind === 'ENUMERATED_LIMB',
      ).length;
      const expectedEffectKind = modalMarkerCount > 0 && limbMarkerCount === 0 ? 'MODAL'
        : modalMarkerCount === 0 && limbMarkerCount > 0 ? 'ENUMERATED_LIMB'
          : modalMarkerCount > 0 && limbMarkerCount > 0 ? 'COMBINED_MODAL_LIMB' : null;
      if (expectedEffectKind === null || entry.effect_kind !== expectedEffectKind
          || !same(markerSpanIds, derivedMarkerSpanIds)) {
        fail(code, 'operative markers do not identify the exact modal or authored limb');
      }
      for (const spanId of entry.source_span_ids) {
        const priorOwners = ledgerSpanOwners.get(spanId) ?? [];
        if (priorOwners.length > 0 && !sharedFactCoverages.bySpan.has(spanId)) {
          fail(code, 'one source span was absorbed by two candidate effects');
        }
        if (priorOwners.includes(entry.effect_id) || priorOwners.length >= 2) {
          fail(code, 'shared fact source span has more than its exact two effect owners');
        }
        ledgerSpanOwners.set(spanId, [...priorOwners, entry.effect_id]);
      }
      for (const spanId of markerSpanIds) {
        if (operativeMarkerOwners.has(spanId)) {
          fail(code, 'one operative marker was absorbed by two candidate effects');
        }
        operativeMarkerOwners.set(spanId, entry.effect_id);
      }
      const treatmentSpanIds = [];
      const treatedRuleIds = new Set();
      const treatedExpressionIds = new Set();
      const treatedDependencyIds = new Set();
      const treatmentKindBySpan = new Map();
      const treatmentTargetBySpan = new Map();
      const sourceOrdinal = new Map(entry.source_span_ids.map(
        (spanId, index) => [spanId, index],
      ));
      const linkedExpressionIds = new Set();
      const collectExpressions = (expressionId) => {
        if (linkedExpressionIds.has(expressionId)) return;
        linkedExpressionIds.add(expressionId);
        const expression = expressions.get(expressionId);
        if (expression) expression.children.filter((child) => child.kind === 'EXPRESSION')
          .forEach((child) => collectExpressions(child.id));
      };
      ruleIds.forEach((ruleId) => collectExpressions(rules.get(ruleId).root_expression_id));
      const linkedDependencyIds = [...ownershipLinks.values()].filter(
        (link) => ruleIds.includes(link.consumer_rule_id),
      ).flatMap((link) => link.consumer_dependency_ids);
      const expectedDependencyIds = (noOutputEffect
        ? closure.required_dependency_ids.filter((dependencyId) => {
          const dependency = sources.dependencies.get(dependencyId);
          return dependency?.source_support_ids.length > 0
            && dependency.source_support_ids.every(
              (spanId) => entry.source_span_ids.includes(spanId),
            );
        })
        : [...new Set([
          ...candidate.effect.fact_ids.flatMap(
            (factId) => facts.get(factId)?.dependency_ids ?? [],
          ),
          ...linkedDependencyIds,
        ])]).sort();
      const treatments = array(entry.treatments, code, 'effect treatments');
      if (noOutputEffect && treatments.some(
        (treatment) => !['DEPENDENCY', 'LEGAL_TEXT_EXCLUSION'].includes(
          treatment.treatment_kind,
        ),
      )) fail(code, 'no-output effect contains a semantic treatment without a rule');
      for (const treatment of treatments) {
        exactKeys(treatment, [
          'treatment_kind', 'target_id', 'source_span_ids', 'authority_id',
        ], code, 'effect treatment');
        if (!['RULE', 'EXPRESSION', 'DEPENDENCY',
          'LEGAL_TEXT_EXCLUSION'].includes(treatment.treatment_kind)) {
          fail(code, 'effect treatment kind is not approved');
        }
        string(treatment.target_id, code, 'effect treatment target');
        const spanIds = array(treatment.source_span_ids, code, 'effect treatment spans');
        if (spanIds.length === 0) fail(code, 'effect treatment has no source span');
        unique(spanIds, code, 'effect treatment spans');
        if (spanIds.some((spanId) => !entry.source_span_ids.includes(spanId))) {
          fail(code, 'effect treatment falls outside its exact candidate effect');
        }
        const orderedSpanIds = [...spanIds].sort(
          (left, right) => sourceOrdinal.get(left) - sourceOrdinal.get(right),
        );
        if (!same(spanIds, orderedSpanIds)) {
          fail(code, 'effect treatment spans are not in exact source order');
        }
        for (const spanId of spanIds) {
          if (treatmentKindBySpan.has(spanId)) {
            fail(code, 'effect source span is assigned to two treatments');
          }
          treatmentKindBySpan.set(spanId, treatment.treatment_kind);
          treatmentTargetBySpan.set(spanId, treatment.target_id);
        }
        treatmentSpanIds.push(...spanIds);
        if (treatment.treatment_kind === 'RULE') {
          const treatedRule = rules.get(treatment.target_id);
          const expectedSupportSet = new Set((treatedRule?.fact_ids ?? []).flatMap(
            (factId) => facts.get(factId)?.source_support_ids ?? [],
          ));
          spanIds.filter((spanId) => derivedMarkerSpanIds.includes(spanId))
            .forEach((spanId) => expectedSupportSet.add(spanId));
          const expectedSupports = entry.source_span_ids.filter(
            (spanId) => expectedSupportSet.has(spanId),
          );
          if (!ruleIds.includes(treatment.target_id) || treatment.authority_id !== null
              || treatedRuleIds.has(treatment.target_id)
              || !same(spanIds, expectedSupports)) {
            fail(code, 'rule treatment does not bind a linked rule');
          }
          treatedRuleIds.add(treatment.target_id);
        } else if (treatment.treatment_kind === 'EXPRESSION') {
          const expression = expressions.get(treatment.target_id);
          const expectedSupportSet = new Set([
            ...(expression?.connective_span_ids ?? []),
            ...(expression?.authored_limb_marker_span_ids ?? []),
          ]);
          const expectedSupports = entry.source_span_ids.filter(
            (spanId) => expectedSupportSet.has(spanId),
          );
          if (!expression || !linkedExpressionIds.has(treatment.target_id)
              || treatment.authority_id !== null
              || treatedExpressionIds.has(treatment.target_id)
              || !same(spanIds, expectedSupports)
              || expectedSupportSet.size !== expectedSupports.length) {
            fail(code, 'expression treatment does not bind exact expression source');
          }
          treatedExpressionIds.add(treatment.target_id);
        } else if (treatment.treatment_kind === 'DEPENDENCY') {
          const dependency = sources.dependencies.get(treatment.target_id);
          if (!dependency || treatment.authority_id !== null
              || treatedDependencyIds.has(treatment.target_id)
              || !same([...spanIds].sort(), [...dependency.source_support_ids].sort())
              || (noOutputEffect && spanIds.some((spanId) => {
                const coverage = coverageBySpan.get(spanId);
                return coverage?.treatment_kind !== 'RESOLVED_DEPENDENCY'
                  || coverage.owner_id !== treatment.target_id;
              }))) {
            fail(code, 'dependency treatment does not bind exact dependency source');
          }
          treatedDependencyIds.add(treatment.target_id);
        } else {
          const authority = semanticInputs.structureMembers.get(treatment.authority_id);
          const ordinaryExclusion = authority?.kind === 'LEGAL_TEXT_EXCLUSION';
          const noOutputExclusion = ruleIds.length === 0 && authority?.kind === 'NO_OUTPUT'
            && noOutputAuthorityId === authority.structure_disposition_id
            && noOutputOccurrenceIds.has(entry.input_occurrence_id);
          if (!authority || treatment.target_id !== treatment.authority_id
              || (!ordinaryExclusion && !noOutputExclusion)
              || authority.authority_class !== 'BEN_LEGAL_RULING'
              || authority.approver !== 'BEN_GOODCHILD') {
            fail(code, 'legal-text exclusion treatment lacks exact Ben authority');
          }
          for (const spanId of spanIds) {
            const span = sources.spanById.get(spanId);
            if (!span) fail(code, 'legal-text exclusion treatment cites an absent span');
            if (noOutputExclusion) {
              const coverage = coverageBySpan.get(spanId);
              if (coverage?.treatment_kind !== 'LEGAL_TEXT_EXCLUSION'
                  || coverage.authority_id !== authority.structure_disposition_id) {
                fail(code, 'no-output treatment differs from the exact coverage partition');
              }
              validateNoOutputScope(authority, span, sources, closure, code);
            } else {
              validateStructureScope(authority, span, sources, closure, code);
            }
          }
        }
      }
      const orderedTreatmentSpanIds = [...treatmentSpanIds].sort(
        (left, right) => sourceOrdinal.get(left) - sourceOrdinal.get(right),
      );
      if (!same(orderedTreatmentSpanIds, entry.source_span_ids)
          || !same([...treatedRuleIds].sort(), [...ruleIds].sort())
          || !same([...treatedExpressionIds].sort(), [...linkedExpressionIds].sort())
          || !same([...treatedDependencyIds].sort(), expectedDependencyIds)) {
        fail(code, 'effect treatments do not partition its source and linked rules exactly once');
      }
      for (const spanId of derivedMarkerSpanIds) {
        const treatmentKind = treatmentKindBySpan.get(spanId);
        const treatmentTargetId = treatmentTargetBySpan.get(spanId);
        const sourceStatus = sources.sourceStatusBySpan.get(spanId);
        if (ruleIds.length === 0) {
          if (treatmentKind !== 'LEGAL_TEXT_EXCLUSION') {
            fail(code, 'zero-rule operative marker lacks its exact no-output authority');
          }
        } else if (sourceStatus?.authored_limb_overlay_authority_id !== null) {
          const expression = expressions.get(treatmentTargetId);
          if (treatmentKind !== 'EXPRESSION'
              || !expression?.authored_limb_marker_span_ids.includes(spanId)) {
            fail(code, 'overlay-authored limb marker is not owned by its exact expression');
          }
        } else if (treatmentKind !== 'RULE' && treatmentKind !== 'EXPRESSION') {
          fail(code, 'operative marker is hidden from its linked rule or expression');
        }
      }
      for (const spanId of entry.source_span_ids) {
        const shared = sharedFactCoverages.bySpan.get(spanId);
        if (!shared) continue;
        sharedLedgerUses.get(shared.shared_fact_coverage_id).push({
          effect_id: entry.effect_id,
          treatment_kind: treatmentKindBySpan.get(spanId),
          target_id: treatmentTargetBySpan.get(spanId),
        });
      }
      validateOverlayCompoundEffect(
        analysis, ledger, closure, entry, derivedMarkerSpanIds, facts, rules, expressions,
        sources, candidates, semanticInputs, linkedExpressionIds,
      );
    }
    if (noOutputAuthorityId !== null) {
      if (ledger.entries.some((entry) => !noOutputOccurrenceIds.has(entry.input_occurrence_id)
          || entry.rule_ids.length !== 0)) {
        fail(code, 'no-output closure contains a rule or another occurrence treatment');
      }
      const expectedEffectSpanIds = closure.spans.filter((span) => {
        const coverage = coverageBySpan.get(span.span_id);
        return coverage?.treatment_kind === 'RESOLVED_DEPENDENCY'
          || (coverage?.treatment_kind === 'LEGAL_TEXT_EXCLUSION'
            && coverage.authority_id === noOutputAuthorityId);
      }).map((span) => span.span_id);
      const actualEffectSpanIds = ledger.entries.flatMap((entry) => entry.source_span_ids);
      if (!same(actualEffectSpanIds, expectedEffectSpanIds)) {
        fail(code, 'zero-rule effects and coverage do not exhaust the no-output closure');
      }
    }
    const operativeSpanIds = closure.spans.filter(
      (span) => sources.sourceStatusBySpan.get(span.span_id)?.operative === true,
    )
      .map((span) => span.span_id);
    if (operativeSpanIds.some((spanId) => !ledgerSpanOwners.has(spanId))
        || !same([...operativeMarkerOwners.keys()].sort(), [...operativeSpanIds].sort())) {
      fail(code, 'operative spans are not in one-to-one source-first effect accounting');
    }
    const candidateSet = candidates.byAuthoredUnit.get(ledger.authored_unit_id);
    if (!same(ledger.entries.map((entry) => entry.effect_id),
      candidateSet.effects.map((effect) => effect.effect_id))) {
      fail(code, 'effect ledger order differs from its inspected candidate set');
    }
  }
  if (targetRules.size !== rules.size) fail(code, 'not every derived rule is effect-ledgered');
  if (targetEffects.size !== candidates.effects.size) {
    fail(code, 'not every inspected effect is retained in an effect ledger');
  }
  if (authoredUnits.size !== candidates.byAuthoredUnit.size
      || [...candidates.byAuthoredUnit.keys()].some((id) => !authoredUnits.has(id))) {
    fail(code, 'candidate set is absent from the authored-unit effect ledgers');
  }
  for (const shared of sharedFactCoverages.byId.values()) {
    const uses = sharedLedgerUses.get(shared.shared_fact_coverage_id);
    const expectedRuleIds = shared.fact_ids.map(
      (factId) => facts.get(factId)?.owner_rule_id,
    ).sort();
    if (uses.length !== 2 || new Set(uses.map((use) => use.effect_id)).size !== 2
        || uses.some((use) => use.treatment_kind !== 'RULE')
        || !same(uses.map((use) => use.target_id).sort(), expectedRuleIds)) {
      fail(code, 'shared fact source lacks exactly two RULE-only ledger uses');
    }
  }
}

function validateSourceLimitedProofs(disposition, rule, profile, closure, dependencies, facts) {
  const code = 'M7_V2_SOURCE_LIMITED_PROOF';
  const proofs = array(disposition.absence_proofs, code, 'absence proofs').filter(
    (proof) => proof.rule_id === rule.rule_id,
  );
  if (proofs.length === 0) fail(code, 'source-limited output has no field-level absence proof');
  for (const proof of proofs) {
    exactKeys(proof, [
      'rule_id',
      'field_key',
      'observation_kind',
      'source_closure_id',
      'authored_unit_id',
      'governing_chapeau_span_ids',
      'checked_dependency_ids',
      'profile_requirement_id',
      'lawyer_ruling_id',
    ], code, 'absence proof');
    if (proof.rule_id !== rule.rule_id
        || proof.observation_kind !== 'SOURCE_NOT_EXPRESSLY_STATED'
        || proof.source_closure_id !== closure.source_closure_id
        || proof.authored_unit_id !== rule.authored_unit_id
        || !same(proof.governing_chapeau_span_ids, closure.governing_chapeau_span_ids)) {
      fail(code, 'source-limited observation does not bind the complete reviewed source');
    }
    string(proof.field_key, code, 'absence-proof field');
    string(proof.profile_requirement_id, code, 'absence-proof profile requirement');
    string(proof.lawyer_ruling_id, code, 'absence-proof lawyer ruling');
    const requirement = [...profile.required_fields, ...profile.optional_fields].find(
      (entry) => entry.field_key === proof.field_key,
    );
    if (!requirement || requirement.requirement_id !== proof.profile_requirement_id
        || requirement.lawyer_ruling_id !== proof.lawyer_ruling_id
        || !profile.legal_authority_ids.includes(proof.lawyer_ruling_id)
        || rule.fact_ids.some((factId) => facts.get(factId)?.field_key === proof.field_key)) {
      fail(code, 'absence proof concerns no profile requirement');
    }
    array(proof.checked_dependency_ids, code, 'checked dependencies');
    if (!same([...proof.checked_dependency_ids].sort(),
      [...closure.required_dependency_ids].sort())) {
      fail(code, 'absence proof did not inspect every required dependency');
    }
    for (const dependencyId of proof.checked_dependency_ids) {
      if (dependencies.get(dependencyId)?.state !== 'RESOLVED') {
        fail(code, 'absence proof relies on an unresolved dependency');
      }
    }
  }
}

function validStateCombination(extraction, quality, output) {
  return (extraction === 'COMPLETE' && quality === 'SUFFICIENT'
      && ['NORMAL', 'NO_COMPARISON', 'NO_OUTPUT'].includes(output))
    || (extraction === 'COMPLETE' && quality === 'SOURCE_LIMITED'
      && output === 'APPROVED_LIMITED')
    || (output === 'REVIEW_ONLY'
      && (extraction === 'INCOMPLETE' || extraction === 'AMBIGUOUS'
        || quality === 'DRAFTING_AMBIGUOUS'));
}

function summariseOccurrenceStates(occurrenceRules, issues) {
  const states = [
    ...occurrenceRules.map((rule) => rule.validation),
    ...issues.map((issue) => ({
      extraction_state: issue.extraction_state,
      source_quality: issue.source_quality,
      output_disposition: 'REVIEW_ONLY',
    })),
  ];
  if (states.some((state) => state.output_disposition === 'REVIEW_ONLY')) {
    return {
      extraction_state: states.some(
        (state) => state.extraction_state === 'AMBIGUOUS',
      ) ? 'AMBIGUOUS' : 'INCOMPLETE',
      source_quality: states.some(
        (state) => state.source_quality === 'DRAFTING_AMBIGUOUS',
      ) ? 'DRAFTING_AMBIGUOUS' : states.some(
        (state) => state.source_quality === 'SOURCE_LIMITED',
      ) ? 'SOURCE_LIMITED' : 'SUFFICIENT',
      output_disposition: 'REVIEW_ONLY',
    };
  }
  if (states.some((state) => state.output_disposition === 'APPROVED_LIMITED')) {
    return {
      extraction_state: 'COMPLETE',
      source_quality: 'SOURCE_LIMITED',
      output_disposition: 'APPROVED_LIMITED',
    };
  }
  if (states.some((state) => state.output_disposition === 'NORMAL')) {
    return {
      extraction_state: 'COMPLETE',
      source_quality: 'SUFFICIENT',
      output_disposition: 'NORMAL',
    };
  }
  return {
    extraction_state: 'COMPLETE',
    source_quality: 'SUFFICIENT',
    output_disposition: 'NO_COMPARISON',
  };
}

function allFamilyResults(effectMatches, profiles) {
  return FAMILY_KEYS.map((familyKey) => ({
    family_key: familyKey,
    matched_profile_ids: [...new Set(effectMatches.flatMap((match) => (
      match.profile_results.filter((result) => result.matched
        && profiles.get(result.profile_id)?.family_key === familyKey)
        .map((result) => result.profile_id)
    )))].sort(),
  }));
}

function childRuleRelationships(rule, expressions) {
  const relationships = new Map();
  const visited = new Set();
  function visit(expressionId) {
    if (visited.has(expressionId)) return;
    visited.add(expressionId);
    const expression = expressions.get(expressionId);
    if (!expression) return;
    for (const child of expression.children) {
      if (child.kind === 'RULE') {
        if (relationships.has(child.id)) {
          fail('M7_V2_EXPRESSION_TOPOLOGY', 'child rule has two relationship operators');
        }
        relationships.set(child.id, expression.operator);
      } else if (child.kind === 'EXPRESSION') visit(child.id);
    }
  }
  visit(rule.root_expression_id);
  return relationships;
}

function deriveEquivalenceSignature(profile, rule, ruleFacts, ownershipLinks, facts) {
  const signature = {};
  for (const slot of EQUIVALENCE_SIGNATURE_SLOTS) {
    const mapping = profile.equivalence_signature_mapping[slot];
    const entries = [];
    for (const fieldKey of mapping.field_keys) {
      const fieldEntries = ruleFacts.filter((fact) => fact.field_key === fieldKey).map(
        (fact) => ({
          kind: 'FACT',
          field_key: fact.field_key,
          value_type: fact.value_type,
          typed_value: fact.typed_value,
          legal_subject: fact.legal_subject,
          temporal_scope_signature: fact.temporal_scope_signature,
          legal_effect_role: fact.legal_effect_role,
        }),
      ).sort((left, right) => {
        const leftBytes = canonicalJson(left);
        const rightBytes = canonicalJson(right);
        return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
      });
      entries.push(...fieldEntries);
      const delegated = profile.excluded_or_delegated_dimensions.find(
        (dimension) => dimension.disposition === 'DELEGATED'
          && dimension.dimension_key === fieldKey,
      );
      if (delegated) {
        const linkedEntries = [...ownershipLinks.values()].filter(
          (link) => link.consumer_rule_id === rule.rule_id,
        ).map((link) => ({ link, fact: facts.get(link.owner_fact_id) })).filter(
          ({ fact }) => fact?.field_key === delegated.owner_field_key,
        ).map(({ link, fact }) => ({
          kind: 'LINKED_FACT',
          field_key: fieldKey,
          value_type: fact.value_type,
          typed_value: fact.typed_value,
          legal_subject: fact.legal_subject,
          temporal_scope_signature: fact.temporal_scope_signature,
          legal_effect_role: fact.legal_effect_role,
          ownership_link_id: link.link_id,
        }));
        entries.push(...linkedEntries);
      }
    }
    if (mapping.expression_signature_role === 'CANONICAL_EXPRESSION') {
      entries.push({
        kind: 'EXPRESSION',
        role: 'CANONICAL_EXPRESSION',
        signature: rule.expression_signature,
      });
    }
    signature[slot] = entries;
  }
  return signature;
}

function validateGenericOutputAuthority(
  authority, rule, profile, tree, candidate, governed, packageRegistry,
) {
  const code = 'M7_V2_PROFILE_GATE';
  const selectedNode = tree.nodes.find((node) => node.profile_key === profile.profile_key);
  const normalTreeRoute = tree.completeness_state === 'TREE_OUTPUT_COMPLETE'
    && selectedNode?.node_state === 'TERMINAL_OUTPUT_PERMITTED';
  if (normalTreeRoute) {
    if (authority !== null) fail(code, 'terminal profile carries unnecessary generic authority');
    return;
  }
  exactKeys(authority, [
    'authority_kind', 'profile_id', 'profile_set_version', 'profile_set_binding',
    'lawyer_ruling_id', 'approver', 'covered_occurrence_class', 'legal_reason',
    'covered_input_occurrence_ids', 'inclusion_fixture_bindings',
    'exclusion_fixture_bindings',
  ], code, 'generic-level output authority');
  string(authority.covered_occurrence_class, code, 'generic covered occurrence class');
  string(authority.legal_reason, code, 'generic legal reason');
  const covered = array(authority.covered_input_occurrence_ids, code,
    'generic-level covered occurrences');
  covered.forEach((id) => string(id, code, 'generic-level covered occurrence'));
  unique(covered, code, 'generic-level covered occurrences');
  const genericFixtureMembers = new Set();
  for (const [field, expectedMatch] of [
    ['inclusion_fixture_bindings', true],
    ['exclusion_fixture_bindings', false],
  ]) {
    const bindings = array(authority[field], code, `generic ${field}`);
    if (bindings.length === 0) fail(code, `generic ${field} is empty`);
    for (const fixtureBinding of bindings) {
      resolvePackageMemberBinding(
        fixtureBinding, packageRegistry, 'match_fixtures',
        `generic ${field} binding`, code,
      );
      const proof = profile.fixture_proofs.find(
        (entry) => same(entry.fixture_binding, fixtureBinding),
      );
      const memberKey = canonicalJson(fixtureBinding);
      if (!proof || proof.expected_match !== expectedMatch
          || proof.lawyer_ruling_id !== authority.lawyer_ruling_id
          || (expectedMatch && proof.expected_selected_profile_key !== profile.profile_key)
          || genericFixtureMembers.has(memberKey)) {
        fail(code, `generic ${field} differs from evaluated profile/version/ruling fixtures`);
      }
      genericFixtureMembers.add(memberKey);
    }
  }
  if (authority.authority_kind !== 'GENERIC_LEVEL_OUTPUT_APPROVED'
      || authority.profile_id !== rule.profile_id
      || authority.profile_set_version !== profile.profile_set_version
      || !same(authority.profile_set_binding, profile.profile_set_binding)
      || authority.approver !== 'BEN_GOODCHILD'
      || !profile.legal_authority_ids.includes(authority.lawyer_ruling_id)
      || authority.covered_occurrence_class !== profile.classification_path.join(' > ')
      || authority.legal_reason
        !== 'GENERIC_ANCESTOR_OUTPUT_APPROVED_FOR_EXACT_COVERED_OCCURRENCE_CLASS'
      || !covered.includes(rule.input_occurrence_id)
      || covered.some((id) => !governed.includes(id))
      || candidate.effect.input_occurrence_id !== rule.input_occurrence_id
      || selectedNode?.node_state !== 'TERMINAL_OUTPUT_PERMITTED') {
    fail(code, 'generic-level authority is not exact Ben-approved occurrence authority');
  }
}

function validateStateAndProfiles(
  analysis, profiles, trees, facts, rules, expressions, sources, candidates, effectMatches,
  semanticInputs, ownershipLinks,
) {
  const stateCode = 'M7_V2_STATE_COMBINATION';
  const governed = array(analysis.governed_input_occurrence_ids, stateCode,
    'governed input occurrence IDs');
  governed.forEach((id) => string(id, stateCode, 'governed input occurrence ID'));
  unique(governed, stateCode, 'governed input occurrence IDs');
  const dispositions = indexBy(array(analysis.dispositions, stateCode, 'dispositions'),
    'input_occurrence_id', stateCode, 'disposition');
  if (dispositions.size !== governed.length
      || !same([...dispositions.keys()].sort(), [...governed].sort())) {
    fail(stateCode, 'every governed input occurrence must have exactly one disposition');
  }
  const effectsByOccurrence = new Map(governed.map((id) => [id, []]));
  for (const candidate of candidates.effects.values()) {
    const bucket = effectsByOccurrence.get(candidate.effect.input_occurrence_id);
    if (!bucket) fail(stateCode, 'candidate effect is outside the governed M4 occurrence set');
    bucket.push(candidate);
  }
  if ([...effectsByOccurrence.values()].some((entries) => entries.length === 0)) {
    fail(stateCode, 'a governed input occurrence was silently omitted from candidate inspection');
  }

  for (const rule of rules.values()) {
    exactKeys(rule, [
      'schema_version', 'rule_id', 'input_occurrence_id', 'authored_unit_id', 'effect_id',
      'family_key', 'profile_id', 'subtype_path', 'applies_to_fact_ids', 'fact_ids',
      'consumer_link_ids', 'root_expression_id', 'child_rule_ids', 'source_closure_id',
      'expression_signature', 'equivalence_signature', 'validation',
    ], stateCode, `rule ${rule.rule_id}`);
    if (rule.schema_version !== RULE_SCHEMA) fail(stateCode, 'legal rule schema is not V2');
    const expectedRuleId = contentId(RULE_SCHEMA, {
      agreement_id: analysis.agreement_id,
      input_occurrence_id: rule.input_occurrence_id,
      effect_id: rule.effect_id,
      family_key: rule.family_key,
      profile_id: rule.profile_id,
      subtype_path: rule.subtype_path,
      semantic_fact_keys: rule.fact_ids.map((factId) => facts.get(factId)?.semantic_fact_key),
      canonical_expression_signature: rule.expression_signature,
      child_rule_ids: rule.child_rule_ids,
      source_closure_id: rule.source_closure_id,
    });
    if (rule.rule_id !== expectedRuleId) fail(stateCode, 'legal rule content identity is invalid');
    if (!governed.includes(rule.input_occurrence_id)) fail(stateCode, 'rule lost its input identity');
    const closure = sources.closures.get(rule.source_closure_id);
    if (!closure || closure.authored_unit_id !== rule.authored_unit_id) {
      fail(stateCode, 'rule source closure does not bind its authored unit');
    }
    const profile = profiles.get(rule.profile_id);
    if (!profile || profile.family_key !== rule.family_key
        || !same(profile.subtype_path, rule.subtype_path)) {
      fail('M7_V2_PROFILE_GATE', 'rule profile identity is stale or inconsistent');
    }
    const candidate = candidates.effects.get(rule.effect_id);
    const match = effectMatches.get(rule.effect_id);
    if (!candidate || !match || candidate.candidateSet.authored_unit_id !== rule.authored_unit_id
        || candidate.effect.input_occurrence_id !== rule.input_occurrence_id
        || candidate.effect.expression_root_id !== rule.root_expression_id) {
      fail('M7_V2_PROFILE_GATE', 'rule was not matched inside its exact authored effect');
    }
    array(rule.fact_ids, stateCode, 'rule fact IDs');
    unique(rule.fact_ids, stateCode, 'rule fact IDs');
    if (!same([...rule.fact_ids].sort(), [...candidate.effect.fact_ids].sort())) {
      fail('M7_V2_FACT_OWNERSHIP', 'rule facts differ from its inspected effect');
    }
    const ruleFacts = rule.fact_ids.map((factId) => facts.get(factId));
    if (ruleFacts.some((fact) => !fact || fact.owner_rule_id !== rule.rule_id)) {
      fail('M7_V2_FACT_OWNERSHIP', `rule ${rule.rule_id} contains an unowned fact`);
    }
    array(rule.applies_to_fact_ids, stateCode, 'applies-to fact IDs');
    const expectedAppliesToFactIds = rule.fact_ids.filter(
      (factId) => facts.get(factId)?.field_key === 'APPLIES_TO',
    );
    if (expectedAppliesToFactIds.length === 0) {
      fail(stateCode, 'rule has no proved actor or subject');
    }
    if (!same(rule.applies_to_fact_ids, expectedAppliesToFactIds)) {
      fail('M7_V2_FACT_OWNERSHIP',
        'applies-to fact IDs differ from the exact ordered owned actor subset');
    }
    array(rule.child_rule_ids, stateCode, 'child rule IDs');
    unique(rule.child_rule_ids, stateCode, 'child rule IDs');
    rule.child_rule_ids.forEach((ruleId) => {
      if (!rules.has(ruleId)) fail(stateCode, 'child rule is absent');
    });
    exactKeys(rule.equivalence_signature, EQUIVALENCE_SIGNATURE_SLOTS,
      stateCode, 'rule equivalence signature');
    for (const slot of EQUIVALENCE_SIGNATURE_SLOTS) {
      array(rule.equivalence_signature[slot], stateCode, `equivalence ${slot}`);
    }
    const derivedEquivalenceSignature = deriveEquivalenceSignature(
      profile, rule, ruleFacts, ownershipLinks, facts,
    );
    if (!same(rule.equivalence_signature, derivedEquivalenceSignature)) {
      fail(stateCode, `rule ${rule.rule_id} equivalence signature is not derived`);
    }
    exactKeys(rule.validation, [
      'extraction_state', 'source_quality', 'output_disposition', 'issue_codes',
      'no_comparison_authority',
    ], stateCode, 'rule validation');
    const { extraction_state: extraction, source_quality: quality,
      output_disposition: output } = rule.validation;
    if (!['COMPLETE', 'INCOMPLETE', 'AMBIGUOUS'].includes(extraction)
        || !['SUFFICIENT', 'SOURCE_LIMITED', 'DRAFTING_AMBIGUOUS'].includes(quality)
        || !['NORMAL', 'APPROVED_LIMITED', 'REVIEW_ONLY', 'NO_COMPARISON'].includes(output)
        || !validStateCombination(extraction, quality, output)) {
      fail(stateCode, 'rule state combination can produce false completeness');
    }
    const issueCodes = array(rule.validation.issue_codes, stateCode, 'rule issue codes');
    issueCodes.forEach((issue) => string(issue, stateCode, 'rule issue code'));
    unique(issueCodes, stateCode, 'rule issue codes');
    if ((output === 'REVIEW_ONLY') !== (issueCodes.length > 0)) {
      fail(stateCode, 'review-only issue evidence is inconsistent');
    }
    if (output === 'NO_COMPARISON') {
      exactKeys(rule.validation.no_comparison_authority, [
        'authority_kind', 'policy_id', 'lawyer_ruling_id', 'input_occurrence_id', 'rule_id',
      ], stateCode, 'rule no-comparison authority');
      if (!isObject(profile.no_comparison_policy)
          || rule.validation.no_comparison_authority.authority_kind
            !== 'PROFILE_NO_COMPARISON_APPROVAL'
          || rule.validation.no_comparison_authority.policy_id
            !== profile.no_comparison_policy.policy_id
          || rule.validation.no_comparison_authority.lawyer_ruling_id
            !== profile.no_comparison_policy.lawyer_ruling_id
          || rule.validation.no_comparison_authority.input_occurrence_id
            !== rule.input_occurrence_id
          || rule.validation.no_comparison_authority.rule_id !== rule.rule_id) {
        fail(stateCode, 'rule no-comparison authority differs from its approved profile');
      }
    } else if (rule.validation.no_comparison_authority !== null) {
      fail(stateCode, 'rule carries no-comparison authority on another output state');
    }
    if (['NORMAL', 'APPROVED_LIMITED', 'NO_COMPARISON'].includes(output)) {
      if (match.selected_profile_id !== rule.profile_id
          || match.selected_profile_key !== profile.profile_key
          || match.profile_match_state !== 'EXACT_ONE_MOST_SPECIFIC'
          || match.no_more_specific_descendant_match !== true) {
        fail('M7_V2_PROFILE_GATE', 'emitting rule lacks one recomputed most-specific profile');
      }
      validateGenericOutputAuthority(
        candidate.effect.generic_level_output_authority, rule, profile,
        trees.get(rule.profile_id), candidate, governed, semanticInputs.packageRegistry,
      );
    }
    const fieldCounts = new Map();
    for (const fact of ruleFacts) {
      fieldCounts.set(fact.field_key, (fieldCounts.get(fact.field_key) || 0) + 1);
    }
    const profileRequirements = [...profile.required_fields, ...profile.optional_fields];
    const requirementByField = new Map(
      profileRequirements.map((requirement) => [requirement.field_key, requirement]),
    );
    for (const fact of ruleFacts) {
      const requirement = requirementByField.get(fact.field_key);
      if (!requirement || fact.value_type !== requirement.value_type
          || fact.materiality !== requirement.materiality) {
        fail(stateCode, `rule ${rule.rule_id} contains an undeclared or mismatched typed field`);
      }
    }
    for (const requirement of profile.optional_fields) {
      const count = fieldCounts.get(requirement.field_key) || 0;
      if (requirement.cardinality === 'ZERO_OR_ONE' && count > 1) {
        fail(stateCode, `rule ${rule.rule_id} exceeds optional ${requirement.field_key}`);
      }
    }
    const sourceNode = sources.sourceNodeByClosure.get(rule.source_closure_id);
    if (!sourceNode || !profile.allowed_source_types.some(
      (entry) => entry.source_type === sourceNode.node_kind,
    )) {
      fail('M7_V2_PROFILE_GATE', `rule ${rule.rule_id} uses an unapproved source type`);
    }
    const reachableDependencies = effectLocalDependencyIds(
      candidate.effect, closure, sources, facts, ownershipLinks, rules,
    );
    for (const dependencyId of reachableDependencies) {
      const dependency = sources.dependencies.get(dependencyId);
      if (!dependency || !profile.allowed_dependency_types.some(
        (entry) => entry.dependency_type === dependency.dependency_type,
      )) {
        fail('M7_V2_PROFILE_GATE', `rule ${rule.rule_id} uses an unapproved dependency type`);
      }
    }
    const childRelationships = childRuleRelationships(rule, expressions);
    for (const [childRuleId, relationshipOperator] of childRelationships) {
      const childRule = rules.get(childRuleId);
      const matching = profile.child_rule_profiles.filter(
        (requirement) => requirement.profile_id === childRule?.profile_id
          && requirement.relationship_operator === relationshipOperator,
      );
      if (matching.length !== 1) {
        fail('M7_V2_PROFILE_GATE', `child rule ${childRuleId} has no exact profile relationship`);
      }
    }
    const disposition = dispositions.get(rule.input_occurrence_id);
    let absentFields = new Set();
    if (output === 'APPROVED_LIMITED') {
      validateSourceLimitedProofs(
        disposition, rule, profile, closure, sources.dependencies, facts,
      );
      absentFields = new Set(disposition.absence_proofs.filter(
        (proof) => proof.rule_id === rule.rule_id,
      ).map((proof) => proof.field_key));
      const permittedAbsentFields = new Set(profile.required_fields.map(
        (requirement) => requirement.field_key,
      ));
      for (const condition of profile.conditional_requirements) {
        if (ruleFacts.some((fact) => fact.field_key === condition.predicate.field_key
            && fact.value_type === condition.predicate.value_type
            && same(fact.typed_value, condition.predicate.typed_value))) {
          condition.required_field_keys.forEach((field) => permittedAbsentFields.add(field));
        }
      }
      if ([...absentFields].some((field) => !permittedAbsentFields.has(field))) {
        fail('M7_V2_SOURCE_LIMITED_PROOF', 'absence proof covers no mandatory or triggered field');
      }
    }
    if (['NORMAL', 'APPROVED_LIMITED', 'NO_COMPARISON'].includes(output)) {
      for (const requirement of profile.required_fields) {
        const count = fieldCounts.get(requirement.field_key) || 0;
        const missingByProof = absentFields.has(requirement.field_key);
        if ((requirement.cardinality === 'ONE' && count !== 1 && !missingByProof)
            || (requirement.cardinality === 'ONE_OR_MORE' && count < 1 && !missingByProof)
            || (count > 0 && ruleFacts.filter((fact) => fact.field_key === requirement.field_key)
              .some((fact) => fact.value_type !== requirement.value_type
                || fact.materiality !== requirement.materiality))) {
          fail(stateCode, `rule ${rule.rule_id} does not satisfy ${requirement.field_key}`);
        }
      }
      for (const condition of profile.conditional_requirements) {
        const predicateMatched = ruleFacts.some(
          (fact) => fact.field_key === condition.predicate.field_key
            && fact.value_type === condition.predicate.value_type
            && same(fact.typed_value, condition.predicate.typed_value),
        );
        if (predicateMatched && condition.required_field_keys.some(
          (field) => !fieldCounts.has(field) && !absentFields.has(field),
        )) {
          fail(stateCode, `rule ${rule.rule_id} does not satisfy a triggered conditional field`);
        }
      }
      for (const requirement of profile.child_rule_profiles) {
        const count = [...childRelationships].filter(([childRuleId, relationshipOperator]) => (
          rules.get(childRuleId)?.profile_id === requirement.profile_id
            && relationshipOperator === requirement.relationship_operator
        )).length;
        if ((requirement.cardinality === 'ONE' && count !== 1)
            || (requirement.cardinality === 'ONE_OR_MORE' && count < 1)
            || (requirement.cardinality === 'ZERO_OR_ONE' && count > 1)) {
          fail(stateCode, `rule ${rule.rule_id} violates a child-rule profile cardinality`);
        }
      }
      for (const field of profile.minimum_floor_fields) {
        if (!fieldCounts.has(field) && !absentFields.has(field)) {
          fail(stateCode, `rule ${rule.rule_id} is below the minimum legal floor`);
        }
      }
      for (const dependencyId of reachableDependencies) {
        if (sources.dependencies.get(dependencyId)?.state !== 'RESOLVED') {
          fail('M7_V2_DEPENDENCY_UNRESOLVED',
            `rule ${rule.rule_id} has a reachable unresolved dependency`);
        }
      }
    }
  }

  for (const candidate of candidates.effects.values()) {
    if (candidate.effect.generic_level_output_authority !== null) {
      const consumers = [...rules.values()].filter((rule) => rule.effect_id === candidate.effect.effect_id
        && ['NORMAL', 'APPROVED_LIMITED', 'NO_COMPARISON'].includes(
          rule.validation.output_disposition,
        ));
      if (consumers.length !== 1) {
        fail('M7_V2_PROFILE_GATE', 'generic-level authority is absent from or shared by output');
      }
    }
  }

  for (const disposition of dispositions.values()) {
    exactKeys(disposition, [
      'schema_version', 'disposition_id', 'input_occurrence_id', 'prior_family_key',
      'authored_unit_id', 'source_closure_id', 'source_closure_digest',
      'candidate_set_id', 'candidate_set_digest', 'rule_ids', 'all_family_profile_results',
      'compatible_cross_family_match_count', 'extraction_state', 'source_quality',
      'output_disposition', 'profile_match_state', 'absence_proofs', 'issues',
      'no_comparison_authorities', 'no_output_authority',
    ], stateCode, 'disposition');
    if (disposition.schema_version !== DISPOSITION_SCHEMA) {
      fail(stateCode, 'disposition schema is invalid');
    }
    const unsignedDisposition = { ...disposition };
    delete unsignedDisposition.schema_version;
    delete unsignedDisposition.disposition_id;
    if (disposition.disposition_id !== contentId(DISPOSITION_SCHEMA, unsignedDisposition)) {
      fail(stateCode, 'disposition content identity is invalid');
    }
    if (disposition.prior_family_key !== null
        && !FAMILY_KEYS.includes(disposition.prior_family_key)) {
      fail(stateCode, 'prior family is invalid');
    }
    const occurrenceCandidates = effectsByOccurrence.get(disposition.input_occurrence_id);
    const candidateSetIds = new Set(occurrenceCandidates.map(
      (entry) => entry.candidateSet.candidate_set_id,
    ));
    if (candidateSetIds.size !== 1) fail(stateCode, 'occurrence spans multiple candidate sets');
    const candidateSet = occurrenceCandidates[0].candidateSet;
    const closure = sources.closures.get(candidateSet.source_closure_id);
    if (!closure || disposition.authored_unit_id !== candidateSet.authored_unit_id
        || disposition.source_closure_id !== closure.source_closure_id
        || disposition.candidate_set_id !== candidateSet.candidate_set_id
        || disposition.source_closure_digest !== sha256Hex(canonicalJson(closure))
        || disposition.candidate_set_digest !== sha256Hex(canonicalJson(candidateSet))) {
      fail(stateCode, 'disposition source or candidate identity is false');
    }
    const occurrenceMatches = occurrenceCandidates.map(
      (entry) => effectMatches.get(entry.effect.effect_id),
    );
    if (occurrenceMatches.some((match) => !match)) {
      fail('M7_V2_PROFILE_GATE', 'occurrence match evidence is absent');
    }
    const expectedFamilyResults = allFamilyResults(occurrenceMatches, profiles);
    if (!same(disposition.all_family_profile_results, expectedFamilyResults)) {
      fail('M7_V2_PROFILE_GATE', 'disposition does not preserve all 25 recomputed profile results');
    }
    const compatibleCrossFamily = expectedFamilyResults.filter(
      (entry) => disposition.prior_family_key === null
        || entry.family_key !== disposition.prior_family_key,
    ).reduce((count, entry) => count + entry.matched_profile_ids.length, 0);
    if (disposition.compatible_cross_family_match_count !== compatibleCrossFamily) {
      fail('M7_V2_PROFILE_GATE', 'compatible cross-family match count is false');
    }
    const expectedMatchState = occurrenceMatches.every(
      (match) => match.profile_match_state === 'NO_COMPATIBLE_PROFILE',
    ) ? 'NO_COMPATIBLE_PROFILE' : occurrenceMatches.every(
      (match) => match.profile_match_state === 'EXACT_ONE_MOST_SPECIFIC',
    ) ? 'EXACT_ONE_MOST_SPECIFIC' : 'AMBIGUOUS_PROFILE_MATCH';
    if (disposition.profile_match_state !== expectedMatchState) {
      fail('M7_V2_PROFILE_GATE', 'disposition profile state differs from recomputed evidence');
    }
    const occurrenceRules = [...rules.values()].filter(
      (rule) => rule.input_occurrence_id === disposition.input_occurrence_id,
    );
    const ruleIds = array(disposition.rule_ids, stateCode, 'disposition rule IDs');
    unique(ruleIds, stateCode, 'disposition rule IDs');
    if (!same([...ruleIds].sort(), occurrenceRules.map((rule) => rule.rule_id).sort())) {
      fail(stateCode, 'disposition does not bind every derived rule for its occurrence');
    }
    const issues = array(disposition.issues, stateCode, 'disposition issues');
    const issueKeys = [];
    for (const issue of issues) {
      exactKeys(issue, [
        'effect_id', 'rule_id', 'issue_code', 'extraction_state', 'source_quality',
        'source_span_ids',
      ], stateCode, 'disposition issue');
      const candidate = occurrenceCandidates.find(
        (entry) => entry.effect.effect_id === issue.effect_id,
      );
      const issueRule = issue.rule_id === null ? null : occurrenceRules.find(
        (rule) => rule.rule_id === issue.rule_id,
      );
      const effectRules = occurrenceRules.filter(
        (rule) => rule.effect_id === issue.effect_id,
      );
      if (!candidate || (issue.rule_id !== null
        && (!issueRule || issueRule.effect_id !== issue.effect_id))) {
        fail(stateCode, 'disposition issue belongs to another effect or occurrence');
      }
      if (issue.rule_id === null && effectRules.length !== 0) {
        fail(stateCode, 'null issue rule ID is permitted only when the effect produced no rule');
      }
      string(issue.issue_code, stateCode, 'issue code');
      if (!['INCOMPLETE', 'AMBIGUOUS'].includes(issue.extraction_state)
          || !['SUFFICIENT', 'SOURCE_LIMITED', 'DRAFTING_AMBIGUOUS'].includes(
            issue.source_quality,
          )
          || (issueRule !== null && (issueRule.validation.output_disposition !== 'REVIEW_ONLY'
            || issueRule.validation.extraction_state !== issue.extraction_state
            || issueRule.validation.source_quality !== issue.source_quality
            || !issueRule.validation.issue_codes.includes(issue.issue_code)))) {
        fail(stateCode, 'disposition issue state differs from its dependent rule');
      }
      const spanIds = array(issue.source_span_ids, stateCode, 'issue source spans');
      if (spanIds.length === 0 || spanIds.some(
        (spanId) => sources.closureBySpan.get(spanId) !== closure.source_closure_id,
      )) fail(stateCode, 'issue is not proved inside the reviewed source closure');
      unique(spanIds, stateCode, 'issue source spans');
      issueKeys.push(`${issue.effect_id}\0${issue.rule_id ?? ''}\0${issue.issue_code}`);
    }
    unique(issueKeys, stateCode, 'disposition issue keys');
    for (const rule of occurrenceRules.filter(
      (entry) => entry.validation.output_disposition === 'REVIEW_ONLY',
    )) {
      if (rule.validation.issue_codes.some((issueCode) => !issues.some(
        (issue) => issue.rule_id === rule.rule_id && issue.issue_code === issueCode,
      ))) fail(stateCode, 'review-only rule issue is absent from its occurrence disposition');
    }
    for (const candidate of occurrenceCandidates) {
      const hasRule = occurrenceRules.some((rule) => rule.effect_id === candidate.effect.effect_id);
      if (!hasRule && !issues.some(
        (issue) => issue.effect_id === candidate.effect.effect_id && issue.rule_id === null,
      ) && disposition.output_disposition !== 'NO_OUTPUT') {
        fail(stateCode, 'inspected effect has neither a derived rule nor an exact review issue');
      }
    }
    if (!validStateCombination(disposition.extraction_state, disposition.source_quality,
      disposition.output_disposition)) {
      fail(stateCode, 'disposition state combination can produce false completeness');
    }
    const expectedState = occurrenceRules.length === 0 && issues.length === 0 ? null
      : summariseOccurrenceStates(occurrenceRules, issues);
    if (expectedState !== null && (disposition.extraction_state !== expectedState.extraction_state
        || disposition.source_quality !== expectedState.source_quality
        || disposition.output_disposition !== expectedState.output_disposition)) {
      fail(stateCode, 'occurrence disposition is not the deterministic summary of its linked states');
    }
    if ((disposition.output_disposition === 'REVIEW_ONLY') !== (issues.length > 0)) {
      fail(stateCode, 'disposition review evidence is inconsistent');
    }
    const absenceProofs = array(disposition.absence_proofs, stateCode,
      'disposition absence proofs');
    unique(absenceProofs.map((proof) => `${proof.rule_id}\0${proof.field_key}`),
      stateCode, 'disposition absence proof keys');
    if (absenceProofs.some(
      (proof) => !occurrenceRules.some((rule) => rule.rule_id === proof.rule_id),
    )) fail(stateCode, 'absence proof belongs to no rule in its disposition');
    if (!occurrenceRules.some(
      (rule) => rule.validation.output_disposition === 'APPROVED_LIMITED',
    ) && disposition.absence_proofs.length !== 0) {
      fail(stateCode, 'absence proof appears outside approved source-limited output');
    }
    const expectedNoComparisonAuthorities = occurrenceRules.filter(
      (rule) => rule.validation.output_disposition === 'NO_COMPARISON',
    ).map((rule) => rule.validation.no_comparison_authority);
    if (!same(disposition.no_comparison_authorities, expectedNoComparisonAuthorities)) {
      fail(stateCode, 'disposition no-comparison authorities differ from its linked rules');
    }
    if (disposition.output_disposition === 'NO_OUTPUT') {
      if (occurrenceRules.length !== 0 || disposition.profile_match_state !== 'NO_COMPATIBLE_PROFILE'
          || disposition.compatible_cross_family_match_count !== 0
          || disposition.prior_family_key === null) {
        fail(stateCode, 'no-output record hides a rule, match, or missing prior family');
      }
      const authority = disposition.no_output_authority;
      exactKeys(authority, [
        'authority_kind', 'structure_disposition_id', 'policy_id', 'policy_version',
        'lawyer_ruling_id', 'approver', 'legal_reason', 'covered_input_occurrence_ids',
        'inclusion_fixture_bindings', 'exclusion_fixture_bindings',
      ], stateCode, 'no-output authority');
      for (const [field, bindings] of [
        ['inclusion_fixture_bindings', authority.inclusion_fixture_bindings],
        ['exclusion_fixture_bindings', authority.exclusion_fixture_bindings],
      ]) {
        for (const binding of array(bindings, stateCode, `no-output ${field}`)) {
          resolvePackageMemberBinding(
            binding, semanticInputs.packageRegistry, 'match_fixtures',
            `no-output ${field}`, stateCode,
          );
        }
      }
      const approved = semanticInputs.structureMembers.get(authority.structure_disposition_id);
      const agreementIndex = sources.agreementIndexByClosure.get(closure.source_closure_id);
      if (!approved || approved.kind !== 'NO_OUTPUT'
          || authority.authority_kind !== 'BEN_APPROVED_OCCURRENCE_NO_OUTPUT'
          || authority.policy_id !== approved.policy_id
          || authority.policy_version !== approved.policy_version
          || authority.lawyer_ruling_id !== approved.lawyer_ruling_id
          || authority.approver !== approved.approver
          || authority.legal_reason !== approved.reason_code
          || !same(authority.covered_input_occurrence_ids,
            approved.scope.governed_input_occurrence_ids)
          || !same(authority.inclusion_fixture_bindings, approved.inclusion_fixture_bindings)
          || !same(authority.exclusion_fixture_bindings, approved.exclusion_fixture_bindings)
          || !authority.covered_input_occurrence_ids.includes(disposition.input_occurrence_id)
          || approved.scope.agreement_index_id !== agreementIndex?.agreement_index_id
          || approved.scope.source_node_occurrence_id !== closure.source_node_occurrence_id
          || approved.scope.start_byte !== closure.governing_start_byte
          || approved.scope.end_byte !== closure.governing_end_byte) {
        fail(stateCode, 'no-output authority differs from its exact Ben-approved member');
      }
    } else if (disposition.no_output_authority !== null) {
      fail(stateCode, 'no-output authority appears on another state');
    }
  }
  return dispositions;
}

function validateFocusedTemporalCases(
  analysis, profiles, facts, rules, sources, candidates, dispositions, semanticInputs,
  sharedFactCoverages, ownershipLinks,
) {
  const closureFor = (agreementId, sourceNodeId, decisionId, ordinal) => {
    const matches = [...sources.closures.values()].filter(
      (closure) => analysis.agreement_id === agreementId
        && closure.source_node_occurrence_id === sourceNodeId,
    );
    if (matches.length > 1) {
      fail('M7_V2_SOURCE_CLOSURE', `focused item ${ordinal} has two source closures`);
    }
    if (matches.length === 0) return null;
    const authority = semanticInputs.decisionAuthorities.get(decisionId);
    if (authority?.packetMember.sample_ordinal !== ordinal
        || authority.packetMember.reviewer !== 'BEN_GOODCHILD'
        || !authority.fixedMember.source_node_occurrence_ids.includes(sourceNodeId)) {
      fail('M7_V2_INPUT_CONSUMPTION', `focused item ${ordinal} authority is not immutable`);
    }
    return matches[0];
  };
  const factsForClosure = (closure) => [...facts.values()].filter(
    (fact) => rules.get(fact.owner_rule_id)?.source_closure_id === closure.source_closure_id,
  );
  const rulesForClosure = (closure) => [...rules.values()].filter(
    (rule) => rule.source_closure_id === closure.source_closure_id,
  );

  const item28Closure = closureFor(
    ITEM28_AGREEMENT_ID, ITEM28_SOURCE_NODE_ID, ITEM28_DECISION_ID, 28,
  );
  if (item28Closure) {
    const itemRules = rulesForClosure(item28Closure);
    const ruleBySubtype = new Map(itemRules.map(
      (rule) => [profiles.get(rule.profile_id)?.subtype_path.at(-1), rule],
    ));
    const rightsRule = ruleBySubtype.get('RIGHTS_SURVIVAL');
    const noAdverseRule = ruleBySubtype.get('NO_ADVERSE_AMENDMENT');
    const occurrenceIds = new Set(itemRules.map((rule) => rule.input_occurrence_id));
    const effectIds = new Set(itemRules.map((rule) => rule.effect_id));
    if (itemRules.length !== 2 || ruleBySubtype.size !== 2
        || !rightsRule || !noAdverseRule || occurrenceIds.size !== 1 || effectIds.size !== 2) {
      fail('M7_V2_PROFILE_GATE',
        'item 28 lacks the exact linked rights-survival and no-adverse-amendment rules');
    }
    const disposition = dispositions.get(rightsRule.input_occurrence_id);
    if (!disposition
        || !same([...disposition.rule_ids].sort(), itemRules.map((rule) => rule.rule_id).sort())) {
      fail('M7_V2_PROFILE_GATE',
        'item 28 linked rules do not share one exact governed disposition');
    }
    const itemFacts = factsForClosure(item28Closure);
    const rights = itemFacts.filter((fact) => fact.field_key === 'RIGHTS_SURVIVAL_DURATION');
    const noAdverse = itemFacts.filter(
      (fact) => fact.field_key === 'NO_ADVERSE_AMENDMENT_DURATION',
    );
    if (rights.length !== 1 || noAdverse.length !== 1) {
      fail('M7_V2_FACT_ATOMICITY',
        'item 28 lacks its two exact duration facts');
    }
    if (rights[0].owner_rule_id !== rightsRule.rule_id
        || noAdverse[0].owner_rule_id !== noAdverseRule.rule_id) {
      fail('M7_V2_FACT_OWNERSHIP',
        'item 28 linked rules do not retain distinct duration-fact ownership');
    }
    if (rights[0].value_type !== 'DURATION' || noAdverse[0].value_type !== 'DURATION'
        || !same(rights[0].typed_value, { bound_type: 'AT_LEAST', count: 6, unit: 'YEAR' })
        || !same(noAdverse[0].typed_value, { bound_type: 'EXACT', count: 6, unit: 'YEAR' })
        || same(rights[0].source_support_ids, noAdverse[0].source_support_ids)
        || sourceTextForSpanIds(rights[0].source_support_ids, sources,
          'M7_V2_FACT_ATOMICITY', 'item-28 rights duration', { atomic: true })
          !== 'not less than six (6) years'
        || sourceTextForSpanIds(noAdverse[0].source_support_ids, sources,
          'M7_V2_FACT_ATOMICITY', 'item-28 no-adverse duration', { atomic: true })
          !== 'six (6) years'
        || sharedFactCoverages.byFact.has(rights[0].fact_id)
        || sharedFactCoverages.byFact.has(noAdverse[0].fact_id)) {
      fail('M7_V2_FACT_ATOMICITY',
        'item 28 does not retain distinct AT_LEAST and EXACT duration facts');
    }
  }

  const item42Closure = closureFor(
    ITEM42_44_AGREEMENT_ID, ITEM42_SOURCE_NODE_ID, ITEM42_DECISION_ID, 42,
  );
  if (item42Closure) {
    const itemRules = rulesForClosure(item42Closure);
    const itemFacts = factsForClosure(item42Closure);
    const ruleBySubtype = new Map(itemRules.map(
      (rule) => [profiles.get(rule.profile_id)?.subtype_path.at(-1), rule],
    ));
    const requiredSubtypes = [
      'RIGHTS_SURVIVAL', 'NO_ADVERSE_AMENDMENT', 'CLAIM_CONTINUATION',
    ];
    const occurrenceIds = [...new Set(itemRules.map((rule) => rule.input_occurrence_id))];
    const itemCandidates = [...candidates.effects.values()].filter(
      (candidate) => candidate.candidateSet.source_closure_id === item42Closure.source_closure_id,
    );
    if (itemRules.length !== 3 || ruleBySubtype.size !== 3
        || requiredSubtypes.some((subtype) => !ruleBySubtype.has(subtype))
        || occurrenceIds.length !== 1 || itemCandidates.length !== 3
        || !semanticInputs.packetRulingIds.has('M5-RULING-ONE-OPERATIVE-LIMB')
        || !semanticInputs.packetRulingIds.has('M5-RULING-ONE-SEMANTIC-OWNER')) {
      fail('M7_V2_STATE_COMBINATION',
        'item 42 is not the exact additive three-rule reviewed result');
    }
    const rightsRule = ruleBySubtype.get('RIGHTS_SURVIVAL');
    const noAdverseRule = ruleBySubtype.get('NO_ADVERSE_AMENDMENT');
    const claimRule = ruleBySubtype.get('CLAIM_CONTINUATION');
    const rightsFact = itemFacts.find(
      (fact) => fact.owner_rule_id === rightsRule.rule_id
        && fact.field_key === 'RIGHTS_SURVIVAL_DURATION',
    );
    const noAdverseFact = itemFacts.find(
      (fact) => fact.owner_rule_id === noAdverseRule.rule_id
        && fact.field_key === 'NO_ADVERSE_AMENDMENT_DURATION',
    );
    const shared = rightsFact ? sharedFactCoverages.byFact.get(rightsFact.fact_id) : null;
    const claimLinks = [...ownershipLinks.values()].filter(
      (link) => link.consumer_rule_id === claimRule.rule_id,
    );
    const claimFieldKeys = claimRule.fact_ids.map((factId) => facts.get(factId)?.field_key);
    const requiredClaimFields = [
      'APPLIES_TO', 'LEGAL_EFFECT', 'CLAIM_MADE_PURSUANT_TO_RIGHTS',
      'CLAIM_CONTINUES_SUBJECT_TO_SECTION', 'CLAIM_CONTINUES_WITH_RIGHTS',
      'UNTIL_CLAIM_DISPOSITION',
    ];
    if (claimRule.expression_signature
          !== 'IF_THEN(CLAIM_MADE_PURSUANT_TO_RIGHTS,ALL_OF(CLAIM_CONTINUES_SUBJECT_TO_SECTION,CLAIM_CONTINUES_WITH_RIGHTS,UNTIL_CLAIM_DISPOSITION))'
        || requiredClaimFields.some((fieldKey) => !claimFieldKeys.includes(fieldKey))
        || claimFieldKeys.includes('CLAIM_CONTINUATION_PERIOD_REFERENCE')
        || claimRule.fact_ids.some(
          (factId) => ['DURATION', 'PERIOD'].includes(facts.get(factId)?.value_type),
        )) {
      fail('M7_V2_PROFILE_GATE',
        'item-42 claim continuation does not satisfy its exact approved profile');
    }
    if (!rightsFact || !noAdverseFact || !shared
        || shared !== sharedFactCoverages.byFact.get(noAdverseFact.fact_id)
        || !same(shared.fact_ids, [rightsFact.fact_id, noAdverseFact.fact_id].sort())
        || claimLinks.length !== 1 || claimLinks[0].owner_fact_id !== rightsFact.fact_id
        || claimRule.consumer_link_ids.length !== 1
        || claimRule.consumer_link_ids[0] !== claimLinks[0].link_id) {
      fail('M7_V2_STATE_COMBINATION',
        'item-42 claim continuation does not use the exact delegated duration owner');
    }
    const disposition = dispositions.get(occurrenceIds[0]);
    const issueRuleIds = disposition?.issues.filter(
      (issue) => issue.issue_code === WORK3_PENDING_ISSUE,
    ).map((issue) => issue.rule_id).sort() ?? [];
    if (!disposition || disposition.extraction_state !== 'INCOMPLETE'
        || disposition.source_quality !== 'SUFFICIENT'
        || disposition.output_disposition !== 'REVIEW_ONLY'
        || disposition.issues.length !== itemRules.length
        || !same(issueRuleIds, itemRules.map((rule) => rule.rule_id).sort())
        || itemRules.some((rule) => rule.validation.extraction_state !== 'INCOMPLETE'
          || rule.validation.source_quality !== 'SUFFICIENT'
          || rule.validation.output_disposition !== 'REVIEW_ONLY'
          || !same(rule.validation.issue_codes, [WORK3_PENDING_ISSUE]))
        || itemCandidates.some(
          (candidate) => candidate.effect.generic_level_output_authority !== null,
        )) {
      fail('M7_V2_STATE_COMBINATION',
        'item 42 may not emit before a future Work3 Ben profile approval');
    }
  }

  const item44Closure = closureFor(
    ITEM42_44_AGREEMENT_ID, ITEM44_SOURCE_NODE_ID, ITEM44_DECISION_ID, 44,
  );
  if (item44Closure) {
    const itemRules = rulesForClosure(item44Closure);
    const itemFacts = factsForClosure(item44Closure);
    const businessHours = itemFacts.filter(
      (fact) => fact.field_key === 'BUSINESS_HOURS_TIMING',
    );
    const occurrenceIds = [...new Set(itemRules.map((rule) => rule.input_occurrence_id))];
    const disposition = occurrenceIds.length === 1 ? dispositions.get(occurrenceIds[0]) : null;
    if (businessHours.length !== 1 || businessHours[0].value_type !== 'ENUM'
        || businessHours[0].typed_value !== 'NORMAL_BUSINESS_HOURS'
        || businessHours[0].normalisation_proof.rule_id !== 'ENUM_LITERAL_MAP/V1'
        || sourceTextForSpanIds(businessHours[0].source_support_ids, sources,
          'M7_V2_FACT_ATOMICITY', 'item-44 business hours', { atomic: true })
          !== 'normal business hours') {
      fail('M7_V2_FACT_ATOMICITY',
        'item 44 does not model normal business hours as the exact ENUM literal');
    }
    if (itemRules.length === 0 || occurrenceIds.length !== 1 || !disposition
        || disposition.extraction_state !== 'INCOMPLETE'
        || disposition.source_quality !== 'SUFFICIENT'
        || disposition.output_disposition !== 'REVIEW_ONLY'
        || disposition.issues.length !== itemRules.length
        || !same(disposition.issues.map((issue) => issue.rule_id).sort(),
          itemRules.map((rule) => rule.rule_id).sort())
        || disposition.issues.some((issue) => issue.issue_code !== WIDER_SCOPE_ISSUE)
        || itemRules.some((rule) => rule.validation.extraction_state !== 'INCOMPLETE'
          || rule.validation.source_quality !== 'SUFFICIENT'
          || rule.validation.output_disposition !== 'REVIEW_ONLY'
          || !same(rule.validation.issue_codes, [WIDER_SCOPE_ISSUE]))) {
      fail('M7_V2_STATE_COMBINATION',
        'item 44 may not emit before its wider material access scope is modelled');
    }
  }
}

function validateFamilyCorrections(analysis, rules, sources, dispositions, semanticInputs) {
  const code = 'M7_V2_FAMILY_CORRECTION';
  const correctionIds = new Set();
  for (const correction of array(analysis.family_corrections, code, 'family corrections')) {
    exactKeys(correction, [
      'correction_id',
      'rule_id',
      'old_family_key',
      'new_family_key',
      'source_support_ids',
      'lawyer_ruling_id',
    ], code, 'family correction');
    string(correction.correction_id, code, 'family correction ID');
    const unsignedCorrection = { ...correction };
    delete unsignedCorrection.correction_id;
    if (correction.correction_id !== contentId(
      'STAGE_2Y_M7_V2_FAMILY_CORRECTION/V1', unsignedCorrection,
    )) fail(code, 'family correction content identity is invalid');
    if (correctionIds.has(correction.correction_id)) fail(code, 'duplicate family correction ID');
    correctionIds.add(correction.correction_id);
    const rule = rules.get(correction.rule_id);
    if (!rule || correction.new_family_key !== rule.family_key
        || correction.old_family_key === correction.new_family_key) {
      fail(code, 'family correction does not bind an actual family change');
    }
    const disposition = dispositions.get(rule.input_occurrence_id);
    if (!disposition || disposition.prior_family_key !== correction.old_family_key) {
      fail(code, 'family correction does not bind the occurrence prior family');
    }
    string(correction.lawyer_ruling_id, code, 'family correction ruling');
    if (!semanticInputs.packetRulingIds.has(correction.lawyer_ruling_id)) {
      fail(code, 'family correction ruling is absent from the approved packet');
    }
    array(correction.source_support_ids, code, 'family correction source');
    if (correction.source_support_ids.length === 0
        || correction.source_support_ids.some(
          (spanId) => sources.closureBySpan.get(spanId) !== rule.source_closure_id,
        )) {
      fail(code, 'family correction is not source-proved');
    }
  }
  const expectedRuleIds = [...rules.values()].filter((rule) => {
    const priorFamily = dispositions.get(rule.input_occurrence_id)?.prior_family_key;
    return priorFamily !== null && priorFamily !== undefined && priorFamily !== rule.family_key;
  }).map((rule) => rule.rule_id).sort();
  const actualRuleIds = analysis.family_corrections.map((correction) => correction.rule_id).sort();
  if (!same(actualRuleIds, expectedRuleIds)) {
    fail(code, 'family corrections are not complete for every changed prior family');
  }
}

function validateCounts(analysis) {
  const code = 'M7_V2_COUNTS';
  exactKeys(analysis.counts, [
    'governed_input_occurrences',
    'rules',
    'facts',
    'shared_fact_coverages',
    'expressions',
    'source_closures',
    'dispositions',
  ], code, 'analysis counts');
  const expected = {
    governed_input_occurrences: analysis.governed_input_occurrence_ids.length,
    rules: analysis.rules.length,
    facts: analysis.facts.length,
    shared_fact_coverages: analysis.shared_fact_coverages.length,
    expressions: analysis.expressions.length,
    source_closures: analysis.source_closures.length,
    dispositions: analysis.dispositions.length,
  };
  if (!same(analysis.counts, expected)) fail(code, 'analysis counts do not match the record');
}

function validateAnalysisIdentity(analysis) {
  const unsigned = { ...analysis };
  delete unsigned.schema_version;
  delete unsigned.agreement_analysis_id;
  const expected = contentId(ANALYSIS_SCHEMA, unsigned);
  if (analysis.agreement_analysis_id !== expected) {
    fail('M7_V2_IDENTITY', 'agreement analysis content ID is invalid');
  }
}

function analysisValidationRecord(analysis, dispositions) {
  const dispositionValues = [...dispositions.values()];
  const ruleStates = {
    normal: analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'NORMAL',
    ).length,
    approved_limited: analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'APPROVED_LIMITED',
    ).length,
    review_only: analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'REVIEW_ONLY',
    ).length,
    no_comparison: analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'NO_COMPARISON',
    ).length,
  };
  const unsigned = {
    schema_version: ANALYSIS_VALIDATION_SCHEMA,
    status: 'PASS',
    agreement_id: analysis.agreement_id,
    agreement_analysis_id: analysis.agreement_analysis_id,
    agreement_analysis_sha256: sha256Hex(Buffer.from(`${canonicalJson(analysis)}\n`, 'utf8')),
    candidate_registration_id: analysis.governance.candidate_registration_id,
    counts: {
      ...analysis.counts,
      rule_states: ruleStates,
      review_only_dispositions: dispositionValues.filter(
        (entry) => entry.output_disposition === 'REVIEW_ONLY',
      ).length,
      no_output_dispositions: dispositionValues.filter(
        (entry) => entry.output_disposition === 'NO_OUTPUT',
      ).length,
    },
    checks: ANALYSIS_VALIDATION_CHECKS.map((check_id) => ({ check_id, status: 'PASS' })),
    effects: ANALYSIS_VALIDATION_EFFECTS,
  };
  return Object.freeze({
    ...unsigned,
    analysis_validation_id: contentId(unsigned.schema_version, unsigned),
  });
}

function validateAnalysisV2({
  analysis,
  resolveBinding,
  temporalPhase1Authority,
} = {}) {
  if (temporalPhase1Authority !== undefined) {
    validateTemporalPhase1AuthorityEnvelope(temporalPhase1Authority);
  }
  if (!isObject(analysis) || analysis.schema_version !== ANALYSIS_SCHEMA) {
    fail('M7_V2_SCHEMA', 'analysis must use AGREEMENT_ANALYSIS/V2');
  }
  ANALYSIS_VALIDATION_RESULTS.delete(analysis);
  if (typeof resolveBinding !== 'function') {
    fail('M7_V2_BINDING_DRIFT', 'analysis requires an exact binding resolver');
  }
  exactKeys(analysis, [
    'schema_version',
    'agreement_analysis_id',
    'agreement_id',
    'governed_input_occurrence_ids',
    'governance',
    'profile_snapshots',
    'candidate_sets',
    'source_closures',
    'dependencies',
    'facts',
    'expressions',
    'rules',
    'authored_unit_effect_ledgers',
    'shared_fact_coverages',
    'coverage_partitions',
    'ownership_links',
    'family_corrections',
    'dispositions',
    'counts',
  ], 'M7_V2_SCHEMA', 'analysis');
  string(analysis.agreement_id, 'M7_V2_SCHEMA', 'agreement ID');
  assertHex(analysis.agreement_analysis_id, 64, 'M7_V2_IDENTITY', 'agreement analysis ID');
  validateAnalysisIdentity(analysis);
  const governance = validateGovernance(analysis.governance, resolveBinding);
  const { candidate } = governance;
  const semanticInputs = validateSemanticInputConsumption(analysis, governance, resolveBinding);
  const { profiles, trees } = validateProfileSnapshots(
    analysis,
    candidate,
    resolveBinding,
    governance.inputRecords.get('APPROVED_FAMILY_PROFILE_SET'),
    semanticInputs,
  );
  validateProfileFixtures(profiles, resolveBinding, semanticInputs);
  const candidates = validateCandidateSets(analysis);
  const sources = validateSources(analysis, governance, resolveBinding, semanticInputs);
  validateFocusedSourceAuthorityContinuity(analysis, sources, semanticInputs);
  const { facts, rules } = validateFacts(analysis, sources, semanticInputs);
  validateFocusedTemporalProfileContracts(analysis, profiles, rules, sources);
  const ownershipLinks = validateOwnershipLinks(
    analysis, facts, rules, profiles, sources, semanticInputs,
  );
  const sharedFactCoverages = validateSharedFactCoverages(
    analysis, sources, facts, rules, profiles, semanticInputs,
  );
  const { expressions } = validateExpressions(analysis, profiles, facts, rules, sources);
  validateEffectLocalProvenance(candidates, facts, expressions, rules, sources);
  const effectMatches = validateEffectProfileMatches(
    candidates, profiles, sources, facts, semanticInputs, ownershipLinks, rules,
  );
  const coverageBySpan = validateCoverage(
    analysis, sources, facts, expressions, semanticInputs, sharedFactCoverages,
  );
  validateEffectLedgers(
    analysis, facts, rules, expressions, sources, candidates, semanticInputs, coverageBySpan,
    sharedFactCoverages, ownershipLinks,
  );
  const dispositions = validateStateAndProfiles(
    analysis, profiles, trees, facts, rules, expressions, sources, candidates, effectMatches,
    semanticInputs, ownershipLinks,
  );
  validateFocusedTemporalCases(
    analysis, profiles, facts, rules, sources, candidates, dispositions, semanticInputs,
    sharedFactCoverages, ownershipLinks,
  );
  validateFamilyCorrections(analysis, rules, sources, dispositions, semanticInputs);
  validateCounts(analysis);
  const validationResult = analysisValidationRecord(analysis, dispositions);
  ANALYSIS_VALIDATION_RESULTS.set(analysis, validationResult);
  return validationResult;
}

function validatedAnalysisResultForProjection(analysis) {
  const stored = ANALYSIS_VALIDATION_RESULTS.get(analysis);
  if (!stored) {
    fail('M7_V2_LAYOUT_RECONCILIATION',
      'projection requires the same analysis object to pass full V2 validation first');
  }
  let currentSha256;
  try {
    currentSha256 = sha256Hex(Buffer.from(`${canonicalJson(analysis)}\n`, 'utf8'));
  } catch {
    fail('M7_V2_LAYOUT_RECONCILIATION',
      'analysis changed after its full V2 validation');
  }
  if (currentSha256 !== stored.agreement_analysis_sha256) {
    fail('M7_V2_LAYOUT_RECONCILIATION',
      'analysis changed after its full V2 validation');
  }
  return stored;
}

function validateViewPolicy(viewPolicy) {
  const code = 'M7_V2_VIEW_POLICY';
  if (!isObject(viewPolicy) || viewPolicy.schema_version !== VIEW_POLICY_SCHEMA) {
    fail(code, 'projection requires a V2 view policy');
  }
  exactKeys(viewPolicy, [
    'schema_version',
    'view_policy_id',
    'labels',
    'layouts',
    'formatters',
    'grouping_policy',
  ], code, 'view policy');
  assertHex(viewPolicy.view_policy_id, 64, code, 'view policy ID');
  const labels = indexBy(array(viewPolicy.labels, code, 'view labels'),
    'label_id', code, 'view label');
  const labelByField = new Map();
  for (const label of labels.values()) {
    exactKeys(label, ['label_id', 'field_key', 'text'], code, 'view label');
    string(label.field_key, code, 'view label field');
    string(label.text, code, 'view label text');
    if (labelByField.has(label.field_key)) fail(code, 'view policy has two labels for one field');
    labelByField.set(label.field_key, label);
  }
  const layouts = indexBy(array(viewPolicy.layouts, code, 'view layouts'),
    'layout_id', code, 'view layout');
  for (const layout of layouts.values()) {
    exactKeys(layout, [
      'layout_id',
      'required_classification_levels',
      'required_field_keys',
      'permitted_omission_rule_ids',
    ], code, 'view layout');
    const requiredClassificationLevels = array(
      layout.required_classification_levels, code, 'required classification levels',
    );
    const requiredFieldKeys = array(
      layout.required_field_keys, code, 'required layout fields',
    );
    const permittedOmissionRuleIds = array(
      layout.permitted_omission_rule_ids, code, 'permitted omission rules',
    );
    requiredClassificationLevels.forEach(
      (level) => string(level, code, 'required classification level'),
    );
    requiredFieldKeys.forEach(
      (fieldKey) => string(fieldKey, code, 'required layout field'),
    );
    permittedOmissionRuleIds.forEach(
      (ruleId) => string(ruleId, code, 'permitted omission rule'),
    );
    unique(layout.required_classification_levels, code, 'required classification levels');
    unique(layout.required_field_keys, code, 'required layout fields');
    unique(layout.permitted_omission_rule_ids, code, 'permitted omission rules');
  }
  const formatters = new Map();
  for (const formatter of array(viewPolicy.formatters, code, 'formatters')) {
    exactKeys(formatter, ['value_type', 'formatter_id'], code, 'formatter');
    if (!FACT_VALUE_TYPES.includes(formatter.value_type)) {
      fail(code, `formatter value type ${formatter.value_type} is not approved`);
    }
    string(formatter.formatter_id, code, 'formatter ID');
    if (formatters.has(formatter.value_type)) fail(code, 'duplicate formatter value type');
    formatters.set(formatter.value_type, formatter.formatter_id);
  }
  if (!same([...formatters.keys()].sort(), [...FACT_VALUE_TYPES].sort())) {
    fail(code, 'view policy does not define one formatter for every V2 typed value');
  }
  exactKeys(viewPolicy.grouping_policy, [
    'allowed',
    'requires_exact_equivalence_signature',
  ], code, 'grouping policy');
  if (typeof viewPolicy.grouping_policy.allowed !== 'boolean'
      || typeof viewPolicy.grouping_policy.requires_exact_equivalence_signature !== 'boolean') {
    fail(code, 'grouping policy contains an invalid flag');
  }
  const unsigned = { ...viewPolicy };
  delete unsigned.view_policy_id;
  if (contentId(VIEW_POLICY_SCHEMA, unsigned) !== viewPolicy.view_policy_id) {
    fail(code, 'view policy content ID is invalid');
  }
  return { labels, labelByField, layouts, formatters };
}

function validateViewPolicyForProjection(viewPolicy) {
  validateViewPolicy(viewPolicy);
}

function validateViewPolicyBinding(analysis, viewPolicy, projection = null) {
  const viewPolicyBytes = Buffer.from(`${canonicalJson(viewPolicy)}\n`, 'utf8');
  if (projection !== null) {
    exactKeys(projection.view_policy_binding, BINDING_KEYS, 'M7_V2_VIEW_POLICY',
      'projection view-policy binding');
  }
  const analysisBinding = analysis.governance.view_policy_binding;
  if ((projection !== null && projection.view_policy_id !== viewPolicy.view_policy_id)
      || (projection !== null && !same(projection.view_policy_binding, analysisBinding))
      || analysisBinding.schema_version !== VIEW_POLICY_SCHEMA
      || analysisBinding.record_id_field !== 'view_policy_id'
      || analysisBinding.record_id !== viewPolicy.view_policy_id
      || analysisBinding.byte_length !== viewPolicyBytes.length
      || analysisBinding.sha256 !== sha256Hex(viewPolicyBytes)
      || analysisBinding.git_blob_oid !== gitBlobOid(viewPolicyBytes)) {
    fail('M7_V2_VIEW_POLICY', 'projection names a different view policy');
  }
}

function validateViewPolicyBindingForProjection(analysis, viewPolicy) {
  validateViewPolicyBinding(analysis, viewPolicy);
}

function validateProjectionIdentity(projection) {
  const unsigned = { ...projection };
  delete unsigned.schema_version;
  delete unsigned.agreement_projection_id;
  const expected = contentId(PROJECTION_SCHEMA, unsigned);
  if (projection.agreement_projection_id !== expected) {
    fail('M7_V2_IDENTITY', 'agreement projection content ID is invalid');
  }
}

function titleEnum(value) {
  return value.toLowerCase().split('_')
    .map((word, index) => index === 0 ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function renderPartyValue(fact) {
  if (fact.value_type === 'PARTY') return fact.typed_value;
  if (fact.value_type === 'PARTY_SET') return fact.typed_value.parties.join('; ');
  fail('M7_V2_LAYOUT_RECONCILIATION', 'classification contains a non-party applies-to value');
}

function renderFact(fact, formatterId) {
  if (fact.value_type === 'PARTY_SET' && formatterId === 'party-set-v1') {
    return renderPartyValue(fact);
  }
  if (fact.value_type === 'PARTY' && formatterId === 'string-v1') {
    return renderPartyValue(fact);
  }
  if (fact.value_type === 'ENUM' && formatterId === 'enum-title-v1') {
    return titleEnum(fact.typed_value);
  }
  if (['DEFINED_TERM', 'REFERENCE'].includes(fact.value_type)
      && formatterId === 'string-v1') {
    return fact.typed_value;
  }
  if (fact.value_type === 'NUMBER' && formatterId === 'number-v1') {
    return String(fact.typed_value);
  }
  if (fact.value_type === 'PERCENTAGE' && formatterId === 'percentage-v1') {
    return `${fact.typed_value}%`;
  }
  if (fact.value_type === 'MONEY' && formatterId === 'money-v1') {
    return `${fact.typed_value.currency} ${fact.typed_value.amount}`;
  }
  if (fact.value_type === 'DATE' && formatterId === 'date-iso-v1') {
    return fact.typed_value;
  }
  if (fact.value_type === 'BOOLEAN' && formatterId === 'yes-no-v1') {
    return fact.typed_value ? 'Yes' : 'No';
  }
  if ((fact.value_type === 'DURATION' || fact.value_type === 'PERIOD')
      && formatterId === 'duration-v1') {
    const bound = titleEnum(fact.typed_value.bound_type);
    const unit = fact.typed_value.unit.toLowerCase();
    return `${bound} ${fact.typed_value.count} ${unit}${fact.typed_value.count === 1 ? '' : 's'}`;
  }
  fail('M7_V2_RENDER_RECONCILIATION',
    `no deterministic formatter is registered for ${fact.value_type}`);
}

function expectedClassification(rule, facts, profile) {
  const appliesTo = rule.applies_to_fact_ids.map((factId) => facts.get(factId));
  if (appliesTo.length === 0 || appliesTo.some(
    (fact) => !fact || !['PARTY', 'PARTY_SET'].includes(fact.value_type),
  )) {
    fail('M7_V2_LAYOUT_RECONCILIATION', 'classification has no proved applies-to value');
  }
  const levels = [
    { level: 'APPLIES_TO', value: appliesTo.map(renderPartyValue).join('; ') },
  ];
  profile.classification_path.forEach((value, index) => {
    const level = index === 0 ? 'PROVISION_TYPE'
      : index === 1 ? 'SUB_PROVISION_TYPE'
        : index === 2 ? 'NESTED_SUBTYPE' : `NESTED_SUBTYPE_${index - 1}`;
    levels.push({ level, value });
  });
  return levels;
}

function validateRenderBinding(
  binding, layoutId, fact, policy, ownershipLink = null, delegatedFieldKey = null,
) {
  exactKeys(binding, [
    'fact_id',
    'ownership_link_id',
    'field_key',
    'label_id',
    'typed_value_digest',
    'rendered_value',
    'rendered_value_digest',
    'layout_id',
  ], 'M7_V2_RENDER_RECONCILIATION', 'render binding');
  const expectedFieldKey = delegatedFieldKey ?? fact.field_key;
  if (binding.layout_id !== layoutId || binding.fact_id !== fact.fact_id
      || binding.field_key !== expectedFieldKey
      || binding.ownership_link_id !== (ownershipLink?.link_id ?? null)) {
    fail('M7_V2_RENDER_RECONCILIATION', 'render binding identifies the wrong typed fact');
  }
  const label = policy.labels.get(binding.label_id);
  if (!label || label.field_key !== expectedFieldKey
      || (ownershipLink === null && binding.label_id !== fact.label_id)) {
    fail('M7_V2_LABEL_BINDING', `fact ${fact.fact_id} has the wrong approved label`);
  }
  if (!Array.isArray(fact.source_support_ids) || fact.source_support_ids.length === 0) {
    fail('M7_V2_PROVENANCE', `fact ${fact.fact_id} has no exact source support`);
  }
  const formatterId = policy.formatters.get(fact.value_type);
  const expectedValue = renderFact(fact, formatterId);
  if (binding.typed_value_digest !== sha256Hex(canonicalJson(fact.typed_value))
      || binding.rendered_value !== expectedValue
      || binding.rendered_value_digest !== sha256Hex(expectedValue)) {
    fail('M7_V2_RENDER_RECONCILIATION', `fact ${fact.fact_id} was truncated or altered`);
  }
}

function validateProjectionRows(projection, analysis, viewPolicy, policy) {
  const rules = indexBy(analysis.rules, 'rule_id', 'M7_V2_LAYOUT_RECONCILIATION', 'analysis rule');
  const facts = indexBy(analysis.facts, 'fact_id', 'M7_V2_LAYOUT_RECONCILIATION', 'analysis fact');
  const profiles = indexBy(analysis.profile_snapshots, 'profile_id',
    'M7_V2_LAYOUT_RECONCILIATION', 'analysis profile');
  const ownershipLinks = indexBy(analysis.ownership_links, 'link_id',
    'M7_V2_LAYOUT_RECONCILIATION', 'analysis ownership link');
  const dispositions = indexBy(analysis.dispositions, 'input_occurrence_id',
    'M7_V2_LAYOUT_RECONCILIATION', 'analysis disposition');
  const rows = indexBy(array(projection.rows, 'M7_V2_LAYOUT_RECONCILIATION', 'projection rows'),
    'row_id', 'M7_V2_LAYOUT_RECONCILIATION', 'projection row');
  const rowByRule = new Map();
  for (const row of rows.values()) {
    exactKeys(row, [
      'row_id', 'rule_id', 'disposition_id', 'output_disposition',
      'classification_levels', 'equivalence_signature', 'source_limitation',
      'group_id', 'layouts',
    ], 'M7_V2_LAYOUT_RECONCILIATION', 'projection row');
    const unsignedRow = { ...row };
    delete unsignedRow.row_id;
    if (row.row_id !== contentId('AGREEMENT_PROJECTION_ROW/V2', unsignedRow)) {
      fail('M7_V2_LAYOUT_RECONCILIATION', 'projection row content identity is invalid');
    }
    const rule = rules.get(row.rule_id);
    const disposition = rule ? dispositions.get(rule.input_occurrence_id) : null;
    if (!rule || !['NORMAL', 'APPROVED_LIMITED'].includes(rule.validation.output_disposition)
        || row.output_disposition !== rule.validation.output_disposition
        || row.disposition_id !== disposition?.disposition_id) {
      fail('M7_V2_LAYOUT_RECONCILIATION', 'normal row does not bind an emitting analysis rule');
    }
    if (rowByRule.has(rule.rule_id)) fail('M7_V2_LAYOUT_RECONCILIATION', 'rule has two rows');
    rowByRule.set(rule.rule_id, row);
    if (!same(row.equivalence_signature, rule.equivalence_signature)) {
      fail('M7_V2_GROUPING_SIGNATURE', 'projection changed the M5 equivalence signature');
    }
    const profile = profiles.get(rule.profile_id);
    if (!profile) fail('M7_V2_LAYOUT_RECONCILIATION', 'row profile is absent');
    const classification = expectedClassification(rule, facts, profile);
    if (!same(row.classification_levels, classification)) {
      fail('M7_V2_LAYOUT_RECONCILIATION', 'row classification differs from the proved profile');
    }
    if (rule.validation.output_disposition === 'APPROVED_LIMITED') {
      const ruleProofs = disposition.absence_proofs.filter(
        (proof) => proof.rule_id === rule.rule_id,
      );
      const expectedLimitation = {
        text: 'Not expressly stated in the complete reviewed clause',
        source_closure_id: disposition.source_closure_id,
        authored_unit_id: disposition.authored_unit_id,
        field_keys: [...new Set(ruleProofs.map((proof) => proof.field_key))].sort(),
        lawyer_ruling_ids: [...new Set(
          ruleProofs.map((proof) => proof.lawyer_ruling_id),
        )].sort(),
      };
      if (expectedLimitation.field_keys.length === 0
          || expectedLimitation.lawyer_ruling_ids.length === 0
          || !same(row.source_limitation, expectedLimitation)) {
        fail('M7_V2_LAYOUT_RECONCILIATION', 'approved-limited row lost its text, scope, or ruling');
      }
    } else if (row.source_limitation !== null) {
      fail('M7_V2_LAYOUT_RECONCILIATION', 'source-limitation text appears on normal output');
    }
    if (row.group_id !== null) {
      string(row.group_id, 'M7_V2_GROUPING_SIGNATURE', 'row group ID');
      if (!viewPolicy.grouping_policy.allowed
          || !viewPolicy.grouping_policy.requires_exact_equivalence_signature
          || profile.grouping_policy.allowed !== true) {
        fail('M7_V2_GROUPING_SIGNATURE', 'view policy does not authorise grouping');
      }
    }
    const layoutById = new Map();
    for (const layout of array(row.layouts, 'M7_V2_LAYOUT_RECONCILIATION', 'row layouts')) {
      exactKeys(layout, [
        'layout_id',
        'classification_levels',
        'render_bindings',
        'omission_ledger',
      ], 'M7_V2_LAYOUT_RECONCILIATION', 'row layout');
      if (layoutById.has(layout.layout_id)) {
        fail('M7_V2_LAYOUT_RECONCILIATION', 'row repeats a layout');
      }
      layoutById.set(layout.layout_id, layout);
      const layoutPolicy = policy.layouts.get(layout.layout_id);
      if (!layoutPolicy || !same(layout.classification_levels, classification)) {
        fail('M7_V2_LAYOUT_RECONCILIATION', 'layout classification is incomplete or altered');
      }
      const levels = layout.classification_levels.map((entry) => entry.level);
      if (!same(levels, layoutPolicy.required_classification_levels)) {
        fail('M7_V2_LAYOUT_RECONCILIATION', 'layout classification floor is incomplete');
      }
      const renderedFacts = new Set();
      const renderedDelegatedFields = new Set();
      const renderedFieldOrder = [];
      for (const renderBinding of array(layout.render_bindings,
        'M7_V2_LAYOUT_RECONCILIATION', 'render bindings')) {
        const fact = facts.get(renderBinding.fact_id);
        const ownershipLink = renderBinding.ownership_link_id === null
          ? null : ownershipLinks.get(renderBinding.ownership_link_id);
        const delegatedDimension = ownershipLink === null ? null
          : profile.excluded_or_delegated_dimensions.find(
            (dimension) => dimension.disposition === 'DELEGATED'
              && dimension.dimension_key === renderBinding.field_key
              && ownershipLink.consumer_rule_id === rule.rule_id
              && ownershipLink.owner_fact_id === fact?.fact_id
              && dimension.owner_profile_id === rules.get(
                ownershipLink.owner_rule_id,
              )?.profile_id
              && dimension.owner_field_key === fact?.field_key,
          );
        const duplicate = ownershipLink === null
          ? renderedFacts.has(fact?.fact_id)
          : renderedDelegatedFields.has(delegatedDimension?.dimension_key);
        if (!fact || duplicate
            || (ownershipLink === null && fact.owner_rule_id !== rule.rule_id)
            || (ownershipLink !== null && !delegatedDimension)) {
          fail('M7_V2_LAYOUT_RECONCILIATION', 'layout renders an absent or duplicate fact');
        }
        if (fact.display_rule === 'NEVER_DISPLAY') {
          fail('M7_V2_LAYOUT_RECONCILIATION', `layout renders NEVER_DISPLAY fact ${fact.fact_id}`);
        }
        validateRenderBinding(
          renderBinding, layout.layout_id, fact, policy,
          ownershipLink, delegatedDimension?.dimension_key ?? null,
        );
        if (ownershipLink === null) renderedFacts.add(fact.fact_id);
        else renderedDelegatedFields.add(delegatedDimension.dimension_key);
        renderedFieldOrder.push(delegatedDimension?.dimension_key ?? fact.field_key);
      }
      const displayIndexes = renderedFieldOrder.map((field) => profile.display_order.indexOf(field));
      if (displayIndexes.some((value) => value < 0)
          || displayIndexes.some((value, index) => index > 0 && value < displayIndexes[index - 1])) {
        fail('M7_V2_LAYOUT_RECONCILIATION', 'layout facts differ from profile display order');
      }
      const omittedFacts = new Set();
      for (const omission of array(layout.omission_ledger,
        'M7_V2_LAYOUT_RECONCILIATION', 'omission ledger')) {
        exactKeys(omission, ['fact_id', 'omission_rule_id'],
          'M7_V2_LAYOUT_RECONCILIATION', 'omission');
        const fact = facts.get(omission.fact_id);
        if (!fact || fact.owner_rule_id !== rule.rule_id || omittedFacts.has(fact.fact_id)
            || renderedFacts.has(fact.fact_id)
            || fact.display_rule === 'DISPLAY_REQUIRED' || fact.materiality === 'MATERIAL'
            || !layoutPolicy.permitted_omission_rule_ids.includes(omission.omission_rule_id)) {
          fail('M7_V2_LAYOUT_RECONCILIATION', 'layout omission is not authorised');
        }
        omittedFacts.add(fact.fact_id);
      }
      for (const requiredField of layoutPolicy.required_field_keys) {
        const matching = rule.fact_ids.map((factId) => facts.get(factId))
          .filter((fact) => fact.field_key === requiredField);
        const delegatedRendered = renderedDelegatedFields.has(requiredField);
        if ((!delegatedRendered && matching.length === 0)
            || matching.some((fact) => !renderedFacts.has(fact.fact_id))) {
          fail('M7_V2_LAYOUT_RECONCILIATION', `layout omitted required field ${requiredField}`);
        }
      }
      const expectedDelegatedFields = profile.excluded_or_delegated_dimensions.filter(
        (dimension) => dimension.disposition === 'DELEGATED',
      ).map((dimension) => dimension.dimension_key).sort();
      if (!same([...renderedDelegatedFields].sort(), expectedDelegatedFields)) {
        fail('M7_V2_LAYOUT_RECONCILIATION',
          'layout does not render every delegated material dimension exactly once');
      }
      for (const factId of rule.fact_ids) {
        if (renderedFacts.has(factId) === omittedFacts.has(factId)) {
          fail('M7_V2_LAYOUT_RECONCILIATION', `layout does not account exactly once for fact ${factId}`);
        }
      }
    }
    if (!same([...layoutById.keys()].sort(), [...policy.layouts.keys()].sort())) {
      fail('M7_V2_LAYOUT_RECONCILIATION', 'row does not contain every approved layout exactly once');
    }
  }

  const expectedNormal = [...rules.values()]
    .filter((rule) => ['NORMAL', 'APPROVED_LIMITED'].includes(rule.validation.output_disposition));
  if (rowByRule.size !== expectedNormal.length
      || expectedNormal.some((rule) => !rowByRule.has(rule.rule_id))) {
    fail('M7_V2_LAYOUT_RECONCILIATION', 'projection lost or invented a normal row');
  }
  const grouped = new Map();
  for (const row of rows.values()) {
    if (row.group_id === null) continue;
    const signature = canonicalJson(row.equivalence_signature);
    const rule = rules.get(row.rule_id);
    const profile = profiles.get(rule.profile_id);
    const group = grouped.get(row.group_id) ?? { signature, profile_ids: [] };
    if (group.signature !== signature) {
      fail('M7_V2_GROUPING_SIGNATURE', 'group contains unequal legal rules');
    }
    for (const otherProfileId of group.profile_ids) {
      const otherProfile = profiles.get(otherProfileId);
      if (otherProfileId !== profile.profile_id
          && (!profile.grouping_policy.compatible_profile_ids.includes(otherProfileId)
            || !otherProfile.grouping_policy.compatible_profile_ids.includes(profile.profile_id))) {
        fail('M7_V2_GROUPING_SIGNATURE', 'group combines profiles without mutual exact authority');
      }
    }
    group.profile_ids.push(profile.profile_id);
    grouped.set(row.group_id, group);
  }
  return rows;
}

function validateProjectionRouting(projection, analysis) {
  const code = 'M7_V2_LAYOUT_RECONCILIATION';
  if (!same(projection.disposition_ledger, analysis.dispositions)) {
    fail(code, 'projection does not retain every full validated disposition record');
  }
  const expectedReview = analysis.dispositions.filter(
    (disposition) => disposition.output_disposition === 'REVIEW_ONLY',
  ).map((disposition) => ({
    disposition_id: disposition.disposition_id,
    input_occurrence_id: disposition.input_occurrence_id,
    rule_ids: disposition.rule_ids,
    issues: disposition.issues,
  }));
  if (!same(array(projection.review_rows, code, 'review rows'), expectedReview)) {
    fail(code, 'review-only dispositions were not routed exactly with their issues');
  }
  const dispositionByOccurrence = new Map(analysis.dispositions.map(
    (disposition) => [disposition.input_occurrence_id, disposition],
  ));
  const expectedNonOutput = [
    ...analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'NO_COMPARISON',
    ).map((rule) => ({
      disposition_id: dispositionByOccurrence.get(rule.input_occurrence_id).disposition_id,
      input_occurrence_id: rule.input_occurrence_id,
      rule_id: rule.rule_id,
      output_disposition: 'NO_COMPARISON',
    })),
    ...analysis.dispositions.filter(
      (disposition) => disposition.output_disposition === 'NO_OUTPUT',
    ).map((disposition) => ({
      disposition_id: disposition.disposition_id,
      input_occurrence_id: disposition.input_occurrence_id,
      rule_id: null,
      output_disposition: 'NO_OUTPUT',
    })),
  ];
  if (!same(array(projection.non_output_dispositions, code,
    'non-output dispositions'), expectedNonOutput)) {
    fail(code, 'non-output dispositions were not routed exactly');
  }
}

function validateProjectionCounts(projection) {
  const code = 'M7_V2_COUNTS';
  exactKeys(projection.counts, [
    'normal_rows', 'review_rows', 'non_output_dispositions', 'disposition_records',
  ],
    code, 'projection counts');
  const expected = {
    normal_rows: projection.rows.length,
    review_rows: projection.review_rows.length,
    non_output_dispositions: projection.non_output_dispositions.length,
    disposition_records: projection.disposition_ledger.length,
  };
  if (!same(projection.counts, expected)) fail(code, 'projection counts do not match its rows');
}

function validateProjectionV2(options = {}) {
  if (!isObject(options)
      || !same(Object.keys(options).sort(), ['analysis', 'projection', 'viewPolicy'])) {
    fail('M7_V2_INPUT_CONSUMPTION',
      'projection validation accepts only projection, analysis and view policy');
  }
  const { projection, analysis, viewPolicy } = options;
  if (!isObject(projection) || projection.schema_version !== PROJECTION_SCHEMA
      || !isObject(analysis) || analysis.schema_version !== ANALYSIS_SCHEMA) {
    fail('M7_V2_SCHEMA', 'projection and analysis must both use V2 schemas');
  }
  exactKeys(projection, [
    'schema_version',
    'agreement_projection_id',
    'agreement_id',
    'agreement_analysis_id',
    'analysis_validation',
    'view_policy_id',
    'view_policy_binding',
    'rows',
    'review_rows',
    'non_output_dispositions',
    'disposition_ledger',
    'counts',
  ], 'M7_V2_SCHEMA', 'projection');
  assertHex(projection.agreement_projection_id, 64, 'M7_V2_IDENTITY',
    'agreement projection ID');
  validateProjectionIdentity(projection);
  validateAnalysisIdentity(analysis);
  if (projection.agreement_id !== analysis.agreement_id
      || projection.agreement_analysis_id !== analysis.agreement_analysis_id) {
    fail('M7_V2_IDENTITY', 'projection is not bound to its exact analysis');
  }
  const analysisDispositions = indexBy(analysis.dispositions, 'input_occurrence_id',
    'M7_V2_LAYOUT_RECONCILIATION', 'analysis disposition');
  const storedAnalysisValidation = validatedAnalysisResultForProjection(analysis);
  const expectedAnalysisValidation = analysisValidationRecord(analysis, analysisDispositions);
  if (!same(storedAnalysisValidation, expectedAnalysisValidation)
      || !same(projection.analysis_validation, storedAnalysisValidation)) {
    fail('M7_V2_LAYOUT_RECONCILIATION', 'projection lacks the exact analysis-validation result');
  }
  const policy = validateViewPolicy(viewPolicy);
  validateViewPolicyBinding(analysis, viewPolicy, projection);
  validateProjectionRows(projection, analysis, viewPolicy, policy);
  validateProjectionRouting(projection, analysis);
  validateProjectionCounts(projection);
  return Object.freeze({
    schema_version: 'STAGE_2Y_M7_V2_PROJECTION_VALIDATION/V1',
    status: 'PASS',
    agreement_id: projection.agreement_id,
    agreement_projection_id: projection.agreement_projection_id,
    normal_row_count: projection.rows.length,
    review_row_count: projection.review_rows.length,
    non_output_disposition_count: projection.non_output_dispositions.length,
  });
}

module.exports = {
  validateFamilyProfilePackageSetForWork3,
  validateSingleFamilyPackageInventory,
  validatedAnalysisResultForProjection,
  validateAnalysisV2,
  validateProjectionV2,
  validateGovernedDisclosureNoteCoreIntegrationEvidence,
  validateTerminationUnapprovedInventoryReviewEvidence,
  validateSyntheticExpressionEvidence,
  validateViewPolicyBindingForProjection,
  validateViewPolicyForProjection,
};
