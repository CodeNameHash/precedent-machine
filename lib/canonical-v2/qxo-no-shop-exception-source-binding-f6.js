const {
  buildAdmittedSourceReference,
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity,
} = require('./qxo-no-shop-actions-f6-parser-bridge');
const {
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity,
} = require('./qxo-no-shop-reviewed-definition-graph-f6');
const {
  buildExcerpt,
  buildSemanticSpan,
} = require('./source-structure');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_EXCEPTION_SOURCE_BINDINGS_F6_ONLY';
const DEAL_KEY = 'deal:qxo-topbuild';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID =
  'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const ACTION_SEED_ID =
  '0f7faa1713931ef5ea80a483e9e11ae5456595caefedd90a927117c2a0f1ed0f';
const ACTION_SEED_DIGEST =
  'e29687eb4637ab3d24f6cd8abd5d949d9fe024b5331009a57d958214f74440c8';
const DEFINITION_GRAPH_ID =
  '5f10f1f883b623efa5e988630240cf7c7bdbf6308c261383ae86a992f3f856bc';
const DEFINITION_GRAPH_DIGEST =
  '8f60c00c44c6d34e0a0ddec9c94f170c4e0e62dc9aafdd90cc9742cd713a8b1b';
const EXCEPTION_EFFECT_SCHEMA_ID =
  'e11fc723ec24e9b4934e891c18e59bc03606e95b08cefd78553d934957d2d609';
const EXCEPTION_EFFECT_SCHEMA_DIGEST =
  '6b9a9b3bb8f80f6d6f7383c41effe3d6bce72df7c5c40f22a63adc8ec1caddb1';
const INLINE_PERMISSION_EFFECT_SCHEMA_ID =
  '7071192bbe3d9e4b000189b6180c39f70adae7bb581be7be4e1859c774b756ad';
const INLINE_PERMISSION_EFFECT_SCHEMA_DIGEST =
  'd10f615c5040ef5d1136f44d4583b8c285987133c3bd599d452126993eda4229';
const MAX_BINDING_BYTES = 256 * 1024;
const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'qxo_no_shop_actions_f6_parser_bound_review_seed',
  'qxo_no_shop_reviewed_definition_graph_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'party_binding',
  'governed_scopes',
  'source_evidence',
  'prerequisite_outcomes',
  'exception_effect_outcomes',
  'inline_permission_source_binding',
  'unresolved_effects',
  'retained_source_residuals',
  'notice_dependency',
  'definition_relationship_dependency',
  'status',
  'qxo_no_shop_exception_source_binding_f6_id',
  'canonical_payload_digest',
]);

const TARGET_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const BUYER_PARTY = Object.freeze({
  role: 'RIGHT_HOLDER',
  value: 'PARENT',
  capacity: 'ACQUIRER',
});

const SOURCE_SPANS = Object.freeze({
  RESTRICTION_SCOPE: Object.freeze({
    start: 202400,
    end: 203664,
    sha256: 'c304ed0966b8db06fb54de3c24b5c037c3ff18848390f0037d8bd51748456186',
  }),
  INLINE_PERMISSION: Object.freeze({
    start: 202932,
    end: 203013,
    sha256: '7d4787c2196dd7f06e71f9b6bc9b8333a38403b94aa18fc577e43bbf7e446699',
  }),
  EXCEPTION_SCOPE: Object.freeze({
    start: 205454,
    end: 207783,
    sha256: 'af22a823e5af23092782d8054ff548cd6beb1d99b9f117de43778483cbe71b59',
  }),
  BROADER_PRECEDENCE: Object.freeze({
    start: 205457,
    end: 205570,
    sha256: '6db351ffeb3d824f625f74cd6c8d8124276fd69aa6a9f0d309956d1b106fc3ca',
  }),
  NOTICE_PRECEDENCE: Object.freeze({
    start: 205575,
    end: 205625,
    sha256: '4fff98d54ffa3c65a4afcab025756b2d731cdef39d831729daa9c08a9dfebaa7',
  }),
  WINDOW: Object.freeze({
    start: 205642,
    end: 205741,
    sha256: '33f1120e6f055fcb7993bfd440ffe67a8b1334f9495e2b3d7bdb0de00cc2f998',
  }),
  RECEIPT: Object.freeze({
    start: 205743,
    end: 205841,
    sha256: 'c7ab45c674f1c061e591732e95cd73a17f64eb72c061153c66c3291506473a6d',
  }),
  NO_BREACH: Object.freeze({
    start: 205843,
    end: 205914,
    sha256: 'a5c50c50adfdde7c37e27758baaa5439d1583db694dafe0482dd7a29df885fa6',
  }),
  BOARD_GOOD_FAITH: Object.freeze({
    start: 205916,
    end: 205961,
    sha256: '0a69e1f90f1efa97851c04322b8d92833c05518a6578ca7b9690fb91841974cf',
  }),
  SUPERIOR_COUNSEL: Object.freeze({
    start: 205967,
    end: 206079,
    sha256: '9a10ec9c331e31abea916620717d0a892ec5a064f11f1ba09f8ddb407eb6f200',
  }),
  SUPERIOR_RESULT: Object.freeze({
    start: 206081,
    end: 206204,
    sha256: '32db98b0950439349118cbac769f40153b1e962534fd612f4d8325db795a6361',
  }),
  FIDUCIARY_COUNSEL: Object.freeze({
    start: 206213,
    end: 206258,
    sha256: '3243ae6bfb3d97a131c2ccd5b1a87c92789460c1866ff5d37a8c98a089394978',
  }),
  FIDUCIARY_RESULT: Object.freeze({
    start: 206260,
    end: 206451,
    sha256: '3b01288ce9d3edf93b027697a538c66adea5739473124aae3a8f40a6f52a1323',
  }),
  ACTOR_CHANNEL: Object.freeze({
    start: 206458,
    end: 206525,
    sha256: '995c98f79f9d144ac47c598cdaee6a9e86d703bfe366201db8195e4df783645e',
  }),
  FURNISH_VERB: Object.freeze({
    start: 206531,
    end: 206538,
    sha256: '2355401ce9b52d24dea4764f03addf4a299cd6140fa109f5a9ddabb4e69f641e',
  }),
  FURNISH_CONDITION: Object.freeze({
    start: 206540,
    end: 206591,
    sha256: '701bfd28611774ba91c87113d030c0d0711cb5c64f3b641adcc4496bec465ef7',
  }),
  FURNISH_OBJECT: Object.freeze({
    start: 206593,
    end: 206749,
    sha256: '9c4cd7e7c3395b18c6eb3158c1e88d0a6321f40204ec62f239906608400fd668',
  }),
  INFORMATION_PROVISO: Object.freeze({
    start: 206751,
    end: 207009,
    sha256: '4dfe0622a14ad9de0cdcd1d3093c0cbd1b38a618e4405d67297a4a2a888236fe',
  }),
  INFORMATION_PARITY: Object.freeze({
    start: 206894,
    end: 207009,
    sha256: 'd8f91bcedf4377ce3efd8c402e44cb8e5449747bb477b4ec666ac6872f28bfe0',
  }),
  ENGAGE_VERB: Object.freeze({
    start: 207019,
    end: 207028,
    sha256: 'f12af1f1bef9e1e7d63cab9012cd72b5ef5339d3084148e9427d9d446549fcea',
  }),
  PARTICIPATE_VERB: Object.freeze({
    start: 207032,
    end: 207056,
    sha256: 'f33f52c58d659a3ffc5a63afd1c0b7c344a27d2ca0f32f48267d255dc8a89eca',
  }),
  DISCUSSIONS_OBJECT: Object.freeze({
    start: 207057,
    end: 207068,
    sha256: '2180ad87bed97605bccfde760e05a2ab63fc03d30268d4f0ca1009df9a4298f4',
  }),
  NEGOTIATIONS_OBJECT: Object.freeze({
    start: 207072,
    end: 207084,
    sha256: '00bfaa15d87354bf227b8baa91fe332d873e096b4c41f8a91fab0c940c36ecc2',
  }),
  DISCUSSION_CONTEXT: Object.freeze({
    start: 207085,
    end: 207221,
    sha256: 'd8d4cd6d876bde0b5b4622abc2196617c2410bfe72c5eccfbc94a0e54924d432',
  }),
  DISCUSSION_PERMISSION_CLUSTER: Object.freeze({
    start: 207010,
    end: 207221,
    sha256: '8c8c72b0320c9dafd866af66f06c7f32e20f3adabc90ca2d1cced7dbcba6a8cc',
  }),
  A_FURNISH_METHOD: Object.freeze({
    start: 202650,
    end: 202703,
    sha256: 'cf8dca9008330700fa52eaa237d01c0f00bf4555b90dba86afbfeb43d2c77e48',
  }),
  FIRST_SENTENCE_NOTICE: Object.freeze({
    start: 207783,
    end: 208859,
    sha256: '3f6d824c70d4194f63bdc3581987be1965c1bb242461ba7a8735341de4c362d5',
  }),
});

const PREREQUISITE_SPECS = Object.freeze([
  Object.freeze({
    prerequisite_code: 'WINDOW_SIGNING_TO_STOCKHOLDER_APPROVAL',
    source_keys: Object.freeze(['WINDOW']),
    definition_uses: Object.freeze([]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED',
    source_keys: Object.freeze(['RECEIPT']),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 205797, 205825]),
    ]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'PROPOSAL_NOT_RESULTING_FROM_COVENANT_OBLIGOR_NO_SHOP_BREACH',
    source_keys: Object.freeze(['NO_BREACH']),
    definition_uses: Object.freeze([]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION',
    source_keys: Object.freeze([
      'BOARD_GOOD_FAITH',
      'SUPERIOR_COUNSEL',
      'SUPERIOR_RESULT',
    ]),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 206091, 206119]),
      Object.freeze(['COMPANY_SUPERIOR_PROPOSAL', 206179, 206204]),
    ]),
    definition_dependencies: Object.freeze([
      Object.freeze([
        'COMPANY_SUPERIOR_PROPOSAL',
        'COMPANY_ACQUISITION_PROPOSAL',
        212900,
      ]),
      Object.freeze([
        'COMPANY_SUPERIOR_PROPOSAL',
        'COMPANY_ACQUISITION_PROPOSAL',
        213708,
      ]),
      Object.freeze([
        'COMPANY_SUPERIOR_PROPOSAL',
        'COMPANY_ACQUISITION_PROPOSAL',
        214004,
      ]),
      Object.freeze([
        'COMPANY_SUPERIOR_PROPOSAL',
        'COMPANY_ACQUISITION_PROPOSAL',
        214097,
      ]),
    ]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'BOARD_GOOD_FAITH_FIDUCIARY_DUTY_DETERMINATION',
    source_keys: Object.freeze(['BOARD_GOOD_FAITH', 'FIDUCIARY_RESULT']),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 206277, 206305]),
    ]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'OUTSIDE_FINANCIAL_ADVISER_AND_LEGAL_COUNSEL_CONSULTATION',
    source_keys: Object.freeze(['SUPERIOR_COUNSEL']),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 206091, 206119]),
    ]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'OUTSIDE_LEGAL_COUNSEL_FIDUCIARY_CONSULTATION',
    source_keys: Object.freeze(['FIDUCIARY_COUNSEL']),
    definition_uses: Object.freeze([]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'SUBJECT_TO_INITIAL_PROPOSAL_NOTICE',
    source_keys: Object.freeze(['NOTICE_PRECEDENCE']),
    definition_uses: Object.freeze([]),
    class: 'SHARED',
  }),
  Object.freeze({
    prerequisite_code: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED',
    source_keys: Object.freeze(['FURNISH_CONDITION']),
    definition_uses: Object.freeze([
      Object.freeze(['ACCEPTABLE_CONFIDENTIALITY_AGREEMENT', 206555, 206591]),
    ]),
    class: 'ACTION_SPECIFIC',
  }),
  Object.freeze({
    prerequisite_code:
      'NONPUBLIC_INFORMATION_PREVIOUSLY_OR_SUBSTANTIALLY_SIMULTANEOUSLY_PROVIDED_TO_PROTECTED_PARTY',
    source_keys: Object.freeze(['INFORMATION_PROVISO', 'INFORMATION_PARITY']),
    definition_uses: Object.freeze([]),
    class: 'ACTION_SPECIFIC',
  }),
]);

const EFFECT_SPECS = Object.freeze([
  Object.freeze({
    effect_key: 'FURNISH_NONPUBLIC_INFORMATION_EXCEPTION',
    legal_operation: 'PERMITS_FURNISH_NONPUBLIC_INFORMATION',
    affected_action_code: 'FURNISH_NONPUBLIC_INFORMATION',
    action_occurrence_keys: Object.freeze(['A_FURNISH_METHOD', 'B_FURNISH']),
    source_keys: Object.freeze([
      'ACTOR_CHANNEL',
      'FURNISH_VERB',
      'FURNISH_CONDITION',
      'FURNISH_OBJECT',
      'INFORMATION_PROVISO',
    ]),
    action_specific_prerequisite_codes: Object.freeze([
      'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED',
      'NONPUBLIC_INFORMATION_PREVIOUSLY_OR_SUBSTANTIALLY_SIMULTANEOUSLY_PROVIDED_TO_PROTECTED_PARTY',
    ]),
    definition_uses: Object.freeze([
      Object.freeze(['ACCEPTABLE_CONFIDENTIALITY_AGREEMENT', 206555, 206591]),
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 206721, 206749]),
    ]),
    definition_dependencies: Object.freeze([
      Object.freeze([
        'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT',
        'BASELINE_CONFIDENTIALITY_AGREEMENT',
        207463,
      ]),
    ]),
  }),
  Object.freeze({
    effect_key: 'B_ENGAGE_DISCUSSIONS_EXCEPTION',
    legal_operation: 'PERMITS_ENGAGE_IN_DISCUSSIONS',
    affected_action_code: 'ENGAGE_IN_DISCUSSIONS',
    action_occurrence_keys: Object.freeze(['B_ENGAGE_DISCUSSIONS']),
    source_keys: Object.freeze([
      'ACTOR_CHANNEL',
      'ENGAGE_VERB',
      'DISCUSSIONS_OBJECT',
      'DISCUSSION_CONTEXT',
      'DISCUSSION_PERMISSION_CLUSTER',
    ]),
    action_specific_prerequisite_codes: Object.freeze([]),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207113, 207141]),
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207157, 207185]),
    ]),
    definition_dependencies: Object.freeze([]),
  }),
  Object.freeze({
    effect_key: 'B_ENGAGE_NEGOTIATIONS_EXCEPTION',
    legal_operation: 'PERMITS_ENGAGE_IN_NEGOTIATIONS',
    affected_action_code: 'ENGAGE_IN_NEGOTIATIONS',
    action_occurrence_keys: Object.freeze(['B_ENGAGE_NEGOTIATIONS']),
    source_keys: Object.freeze([
      'ACTOR_CHANNEL',
      'ENGAGE_VERB',
      'NEGOTIATIONS_OBJECT',
      'DISCUSSION_CONTEXT',
      'DISCUSSION_PERMISSION_CLUSTER',
    ]),
    action_specific_prerequisite_codes: Object.freeze([]),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207113, 207141]),
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207157, 207185]),
    ]),
    definition_dependencies: Object.freeze([]),
  }),
  Object.freeze({
    effect_key: 'B_PARTICIPATE_DISCUSSIONS_EXCEPTION',
    legal_operation: 'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
    affected_action_code: 'PARTICIPATE_IN_DISCUSSIONS',
    action_occurrence_keys: Object.freeze(['B_PARTICIPATE_DISCUSSIONS']),
    source_keys: Object.freeze([
      'ACTOR_CHANNEL',
      'PARTICIPATE_VERB',
      'DISCUSSIONS_OBJECT',
      'DISCUSSION_CONTEXT',
      'DISCUSSION_PERMISSION_CLUSTER',
    ]),
    action_specific_prerequisite_codes: Object.freeze([]),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207113, 207141]),
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207157, 207185]),
    ]),
    definition_dependencies: Object.freeze([]),
  }),
  Object.freeze({
    effect_key: 'B_PARTICIPATE_NEGOTIATIONS_EXCEPTION',
    legal_operation: 'PERMITS_PARTICIPATE_IN_NEGOTIATIONS',
    affected_action_code: 'PARTICIPATE_IN_NEGOTIATIONS',
    action_occurrence_keys: Object.freeze(['B_PARTICIPATE_NEGOTIATIONS']),
    source_keys: Object.freeze([
      'ACTOR_CHANNEL',
      'PARTICIPATE_VERB',
      'NEGOTIATIONS_OBJECT',
      'DISCUSSION_CONTEXT',
      'DISCUSSION_PERMISSION_CLUSTER',
    ]),
    action_specific_prerequisite_codes: Object.freeze([]),
    definition_uses: Object.freeze([
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207113, 207141]),
      Object.freeze(['COMPANY_ACQUISITION_PROPOSAL', 207157, 207185]),
    ]),
    definition_dependencies: Object.freeze([]),
  }),
]);

const INLINE_QUALIFIED_ACTION_KEYS = Object.freeze([
  'B_ENGAGE_DISCUSSIONS',
  'B_ENGAGE_NEGOTIATIONS',
  'B_CONTINUE_DISCUSSIONS',
  'B_CONTINUE_NEGOTIATIONS',
  'B_PARTICIPATE_DISCUSSIONS',
  'B_PARTICIPATE_NEGOTIATIONS',
  'B_FURNISH',
  'B_ACCESS_PROPERTIES',
  'B_ACCESS_BOOKS',
  'B_ACCESS_RECORDS',
]);
const UNRESOLVED_EFFECT_SPECS = Object.freeze([
  Object.freeze({
    action_occurrence_key: 'B_CONTINUE_DISCUSSIONS',
    affected_action_code: 'CONTINUE_DISCUSSIONS',
  }),
  Object.freeze({
    action_occurrence_key: 'B_CONTINUE_NEGOTIATIONS',
    affected_action_code: 'CONTINUE_NEGOTIATIONS',
  }),
]);
const RETAINED_SOURCE_RESIDUAL_SPECS = Object.freeze([
  Object.freeze({
    residual_code: 'NO_SHOP_EXCEPTION_BROADER_PRECEDENCE_UNGOVERNED',
    source_keys: Object.freeze(['BROADER_PRECEDENCE']),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_EXCEPTION_ACTOR_CHANNEL_UNGOVERNED',
    source_keys: Object.freeze(['ACTOR_CHANNEL']),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_FURNISH_METHOD_EFFECT_SCOPE_UNGOVERNED',
    source_keys: Object.freeze(['A_FURNISH_METHOD', 'FURNISH_VERB']),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_FURNISH_RECIPIENT_AND_INFORMATION_SCOPE_UNGOVERNED',
    source_keys: Object.freeze(['FURNISH_OBJECT']),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_DISCUSSION_COUNTERPARTY_AND_PROPOSAL_SCOPE_UNGOVERNED',
    source_keys: Object.freeze(['DISCUSSION_CONTEXT']),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_NOTICE_ALTERNATIVE_TRIGGER_SEMANTICS_UNRESOLVED',
    source_keys: Object.freeze(['FIRST_SENTENCE_NOTICE']),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_EXCEPTION_DEFINITION_SCOPE_INCOMPLETE',
    source_keys: Object.freeze(['EXCEPTION_SCOPE']),
  }),
]);

class QxoNoShopExceptionSourceBindingF6Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopExceptionSourceBindingF6Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopExceptionSourceBindingF6Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function boundedCanonicalBytes(value, maximum, code, message) {
  let encoded;
  try {
    encoded = canonicalJson(value);
  } catch (_) {
    fail(code, message);
  }
  if (Buffer.byteLength(encoded, 'utf8') > maximum) fail(code, message);
  return encoded;
}

function exactSourceEvidence(source, sourceKey, pin) {
  const bytes = Buffer.from(source.canonical_text.text, 'utf8')
    .subarray(pin.start, pin.end);
  if (bytes.length !== pin.end - pin.start || sha256Hex(bytes) !== pin.sha256) {
    fail('SOURCE_SPAN_DRIFT', `${sourceKey} exact source bytes have drifted`);
  }
  const span = buildSemanticSpan(source, pin.start, pin.end);
  const excerpt = buildExcerpt({ source, span });
  return freeze({
    schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_EVIDENCE_F6/V1',
    source_key: sourceKey,
    governed_ordinal: pin.start,
    semantic_span: span,
    source_excerpt: excerpt,
  });
}

function findSchema(contractBundle, key) {
  return contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === key,
  );
}

function validateContract(contractBundle) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    fail('WRONG_CONTRACT', 'the exact frozen F6 contract is required');
  }
  const exceptionSchema = findSchema(contractBundle, 'NO_SHOP_EXCEPTION_EFFECT');
  const inlineSchema = findSchema(contractBundle, 'NO_SHOP_INLINE_PERMISSION_EFFECT');
  if (!exceptionSchema || !inlineSchema) {
    fail('F6_EFFECT_SCHEMA_MISSING', 'the frozen F6 effect schemas are required');
  }
  if (exceptionSchema.semantic_schema_definition_id
      !== EXCEPTION_EFFECT_SCHEMA_ID
    || exceptionSchema.semantic_schema_definition_payload_digest
      !== EXCEPTION_EFFECT_SCHEMA_DIGEST
    || inlineSchema.semantic_schema_definition_id
      !== INLINE_PERMISSION_EFFECT_SCHEMA_ID
    || inlineSchema.semantic_schema_definition_payload_digest
      !== INLINE_PERMISSION_EFFECT_SCHEMA_DIGEST) {
    fail('F6_EFFECT_SCHEMA_IDENTITY_DRIFT', 'the frozen F6 effect schema identity has drifted');
  }
  const operationPairs = exceptionSchema.allowed_legal_operations.map((entry) => [
    entry.legal_operation,
    entry.affected_action_code,
  ]);
  const mappedPairs = [...new Map(EFFECT_SPECS.map((entry) => [
    entry.legal_operation,
    [entry.legal_operation, entry.affected_action_code],
  ])).values()];
  if (canonicalJson(operationPairs) !== canonicalJson(mappedPairs)
    || canonicalJson(exceptionSchema.required_shared_prerequisite_codes)
      !== canonicalJson(PREREQUISITE_SPECS
        .filter((entry) => entry.class === 'SHARED')
        .map((entry) => entry.prerequisite_code))
    || canonicalJson([
      ...new Set(PREREQUISITE_SPECS
        .filter((entry) => entry.class === 'ACTION_SPECIFIC')
        .map((entry) => entry.prerequisite_code)),
    ]) !== canonicalJson(exceptionSchema.allowed_legal_operations[0]
      .required_action_specific_prerequisite_codes)
    || inlineSchema.legal_operation
      !== 'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS'
    || inlineSchema.permitted_action_code
      !== 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS') {
    fail('F6_EFFECT_SCHEMA_DRIFT', 'the frozen F6 effect schema has drifted');
  }
  return { exceptionSchema, inlineSchema };
}

function validateSource({
  source,
  actionSeed,
  definitionGraph,
  immutableSourceDocument,
  sourceAdmissionManifest,
  semanticExtractionInputEnvelope,
  conversion,
}) {
  buildAdmittedSourceReference(source);
  if (source.governed_deal_key !== DEAL_KEY
    || source.document_hash !== DOCUMENT_HASH
    || source.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || Buffer.byteLength(source.canonical_text.text, 'utf8')
      !== CANONICAL_TEXT_BYTE_LENGTH) {
    fail('SOURCE_LINEAGE_DRIFT', 'the exact admitted QXO source is required');
  }
  validateAdmittedSemanticSourceContext({
    context: source,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: source.deal_admission_id,
    source_ordinal: source.source_ordinal,
  });
  const sourceBindings = [actionSeed.source_binding, definitionGraph.source_binding];
  for (const binding of sourceBindings) {
    if (binding.governed_deal_key !== DEAL_KEY
      || binding.document_hash !== DOCUMENT_HASH
      || binding.canonical_text_id !== CANONICAL_TEXT_ID
      || binding.deal_admission_id !== source.deal_admission_id
      || binding.admitted_semantic_source_context_id
        !== source.admitted_semantic_source_context_id
      || binding.immutable_source_document_id
        !== source.immutable_source_document_id
      || binding.source_admission_manifest_id
        !== source.source_admission_manifest_id) {
      fail('UPSTREAM_SOURCE_BINDING_DRIFT', 'the upstream F6 source bindings disagree');
    }
  }
}

function actionReferenceByKey(actionSeed, occurrenceKey) {
  const matches = actionSeed.action_outcomes.filter(
    (outcome) => outcome.occurrence_key === occurrenceKey,
  );
  if (matches.length !== 1 || matches[0].suppressed || !matches[0].reference) {
    return null;
  }
  return matches[0].reference;
}

function definitionUseByCoordinates(graph, [definitionKey, start, end]) {
  const matches = graph.reviewed_use_bindings.filter((binding) => (
    binding.definition_key === definitionKey
    && binding.absolute_start === start
    && binding.absolute_end === end
  ));
  return matches.length === 1 ? matches[0] : null;
}

function definitionDependencyByCoordinates(
  graph,
  [containerDefinitionKey, referencedDefinitionKey, governedOrdinal],
) {
  const matches = graph.definition_dependency_edges.filter((edge) => (
    edge.container_definition_key === containerDefinitionKey
    && edge.referenced_definition_key === referencedDefinitionKey
    && edge.governed_ordinal === governedOrdinal
  ));
  return matches.length === 1 ? matches[0] : null;
}

function buildPrerequisiteOutcome({
  spec,
  evidenceByKey,
  definitionGraph,
  forcedFailurePrerequisiteCode,
}) {
  let failureCode = spec.prerequisite_code === forcedFailurePrerequisiteCode
    ? 'ATTESTED_PREREQUISITE_FAILURE'
    : null;
  const sourceEvidence = spec.source_keys.map((key) => evidenceByKey.get(key));
  if (!failureCode && sourceEvidence.some((entry) => !entry)) {
    failureCode = 'PREREQUISITE_SOURCE_UNRESOLVED';
  }
  const definitionUses = spec.definition_uses.map(
    (coordinates) => definitionUseByCoordinates(definitionGraph, coordinates),
  );
  if (!failureCode && definitionUses.some((entry) => !entry)) {
    failureCode = 'PREREQUISITE_DEFINITION_USE_UNRESOLVED';
  }
  const definitionDependencies = (spec.definition_dependencies || []).map(
    (coordinates) => definitionDependencyByCoordinates(
      definitionGraph,
      coordinates,
    ),
  );
  if (!failureCode && definitionDependencies.some((entry) => !entry)) {
    failureCode = 'PREREQUISITE_DEFINITION_DEPENDENCY_UNRESOLVED';
  }
  const suppressed = Boolean(failureCode);
  const bindingBody = suppressed ? null : {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_PREREQUISITE_SOURCE_BINDING_F6/V1',
    prerequisite_code: spec.prerequisite_code,
    prerequisite_class: spec.class,
    governed_ordinal: sourceEvidence[0].governed_ordinal,
    evidence_excerpt_ids: sourceEvidence.map(
      (entry) => entry.source_excerpt.excerpt_id,
    ),
    definition_use_binding_ids: definitionUses.map(
      (entry) => entry.qxo_no_shop_reviewed_definition_use_binding_f6_id,
    ),
    definition_dependency_edge_ids: definitionDependencies.map(
      (entry) => entry.qxo_no_shop_definition_dependency_edge_f6_id,
    ),
    obligated_party: TARGET_PARTY,
    protected_party: BUYER_PARTY,
    canonical_claim_authority: 'NONE',
  };
  const binding = bindingBody ? freeze({
    ...bindingBody,
    qxo_no_shop_exception_prerequisite_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_PREREQUISITE_SOURCE_BINDING_F6/V1',
      bindingBody,
    ),
  }) : null;
  const body = {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_PREREQUISITE_OUTCOME_F6/V1',
    prerequisite_code: spec.prerequisite_code,
    prerequisite_class: spec.class,
    suppressed,
    failure_code: failureCode,
    source_binding: binding,
  };
  return freeze({
    ...body,
    qxo_no_shop_exception_prerequisite_outcome_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_PREREQUISITE_OUTCOME_F6/V1',
      body,
    ),
  });
}

function buildEffectOutcome({
  spec,
  actionSeed,
  evidenceByKey,
  definitionGraph,
  prerequisiteByCode,
  forcedFailureEffectKey,
}) {
  let failureCode = spec.effect_key === forcedFailureEffectKey
    ? 'ATTESTED_EFFECT_FAILURE'
    : null;
  const actionEndpoints = spec.action_occurrence_keys.map((occurrenceKey) => {
    const reference = actionReferenceByKey(actionSeed, occurrenceKey);
    return {
      occurrence_key: occurrenceKey,
      reference,
    };
  });
  if (!failureCode && actionEndpoints.some((entry) => !entry.reference)) {
    failureCode = 'ACTION_ENDPOINT_SET_UNRESOLVED';
  }
  if (!failureCode && actionEndpoints.some(
    (entry) => entry.reference.action_code !== spec.affected_action_code,
  )) {
    failureCode = 'ACTION_ENDPOINT_CODE_MISMATCH';
  }
  const sourceEvidence = spec.source_keys.map((key) => evidenceByKey.get(key));
  if (!failureCode && sourceEvidence.some((entry) => !entry)) {
    failureCode = 'EFFECT_SOURCE_UNRESOLVED';
  }
  const sharedPrerequisites = PREREQUISITE_SPECS
    .filter((entry) => entry.class === 'SHARED')
    .map((entry) => prerequisiteByCode.get(entry.prerequisite_code));
  if (!failureCode && sharedPrerequisites.some((entry) => entry?.suppressed !== false)) {
    failureCode = 'SHARED_PREREQUISITE_UNRESOLVED';
  }
  const actionSpecificPrerequisites = spec.action_specific_prerequisite_codes.map(
    (code) => prerequisiteByCode.get(code),
  );
  if (!failureCode && actionSpecificPrerequisites.some(
    (entry) => entry?.suppressed !== false,
  )) {
    failureCode = 'ACTION_SPECIFIC_PREREQUISITE_UNRESOLVED';
  }
  const definitionUses = spec.definition_uses.map(
    (coordinates) => definitionUseByCoordinates(definitionGraph, coordinates),
  );
  if (!failureCode && definitionUses.some((entry) => !entry)) {
    failureCode = 'EFFECT_DEFINITION_USE_UNRESOLVED';
  }
  const definitionDependencies = spec.definition_dependencies.map(
    (coordinates) => definitionDependencyByCoordinates(
      definitionGraph,
      coordinates,
    ),
  );
  if (!failureCode && definitionDependencies.some((entry) => !entry)) {
    failureCode = 'EFFECT_DEFINITION_DEPENDENCY_UNRESOLVED';
  }
  const suppressed = Boolean(failureCode);
  const bindingBody = suppressed ? null : {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_EFFECT_SOURCE_BINDING_F6/V1',
    materialisation_state: 'REVIEW_SOURCE_BINDING_ONLY',
    effect_key: spec.effect_key,
    legal_operation: spec.legal_operation,
    affected_action_code: spec.affected_action_code,
    affected_action_endpoints: actionEndpoints.map((entry) => ({
      occurrence_key: entry.occurrence_key,
      action_occurrence_id: entry.reference.action_occurrence_id,
      action_occurrence_revision_id:
        entry.reference.action_occurrence_revision_id,
    })),
    evidence_excerpt_ids: sourceEvidence.map(
      (entry) => entry.source_excerpt.excerpt_id,
    ),
    shared_prerequisite_source_binding_ids: sharedPrerequisites.map(
      (entry) => entry.source_binding
        .qxo_no_shop_exception_prerequisite_source_binding_f6_id,
    ),
    action_specific_prerequisite_source_binding_ids:
      actionSpecificPrerequisites.map(
        (entry) => entry.source_binding
          .qxo_no_shop_exception_prerequisite_source_binding_f6_id,
      ),
    definition_use_binding_ids: definitionUses.map(
      (entry) => entry.qxo_no_shop_reviewed_definition_use_binding_f6_id,
    ),
    definition_dependency_edge_ids: definitionDependencies.map(
      (entry) => entry.qxo_no_shop_definition_dependency_edge_f6_id,
    ),
    canonical_definition_use_relationship_ids: [],
    temporal_start: 'SIGNING',
    temporal_end: 'STOCKHOLDER_APPROVAL',
    obligated_party: TARGET_PARTY,
    protected_party: BUYER_PARTY,
    precedence_code: 'SUBJECT_TO_INITIAL_PROPOSAL_NOTICE',
    governing_notice_dependency:
      'COMPLETE_FIRST_SENTENCE_NOTICE_OBLIGATION',
    governing_notice_obligation_revision_id: null,
    relationship_effect_authority: 'NONE',
  };
  const binding = bindingBody ? freeze({
    ...bindingBody,
    qxo_no_shop_exception_effect_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_EFFECT_SOURCE_BINDING_F6/V1',
      bindingBody,
    ),
  }) : null;
  const body = {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_EFFECT_OUTCOME_F6/V1',
    effect_key: spec.effect_key,
    action_occurrence_keys: spec.action_occurrence_keys,
    suppressed,
    failure_code: failureCode,
    source_binding: binding,
  };
  return freeze({
    ...body,
    qxo_no_shop_exception_effect_outcome_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_EFFECT_OUTCOME_F6/V1',
      body,
    ),
  });
}

function buildInlinePermissionBinding(actionSeed, evidenceByKey) {
  const sourceEvidence = evidenceByKey.get('INLINE_PERMISSION');
  const qualifiedActionOutcomes = INLINE_QUALIFIED_ACTION_KEYS.map((occurrenceKey) => {
    const reference = actionReferenceByKey(actionSeed, occurrenceKey);
    return freeze({
      occurrence_key: occurrenceKey,
      suppressed: !reference,
      failure_code: reference ? null : 'ACTION_ENDPOINT_UNRESOLVED',
      action_occurrence_id: reference?.action_occurrence_id || null,
      action_occurrence_revision_id:
        reference?.action_occurrence_revision_id || null,
    });
  });
  const body = {
    schema_version: 'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
    legal_operation: 'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS',
    permitted_action_code: 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS',
    information_subject_code: 'GOVERNING_NO_SHOP_PROVISIONS',
    temporal_scope_inheritance: 'INHERITS_PARENT_NO_SHOP_RESTRICTION',
    permitted_actor_party: TARGET_PARTY,
    evidence_excerpt_ids: [sourceEvidence.source_excerpt.excerpt_id],
    qualified_action_outcomes: qualifiedActionOutcomes,
    source_binding_complete:
      qualifiedActionOutcomes.every((outcome) => !outcome.suppressed),
    relationship_effect_authority: 'NONE',
  };
  return freeze({
    ...body,
    qxo_no_shop_inline_permission_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_INLINE_PERMISSION_SOURCE_BINDING_F6/V1',
      body,
    ),
  });
}

function buildUnresolvedEffects(actionSeed, evidenceByKey) {
  return freeze(UNRESOLVED_EFFECT_SPECS.map((spec) => {
    const reference = actionReferenceByKey(actionSeed, spec.action_occurrence_key);
    const body = {
      schema_version: 'QXO_NO_SHOP_UNRESOLVED_EXCEPTION_EFFECT_F6/V1',
      action_occurrence_key: spec.action_occurrence_key,
      affected_action_code: spec.affected_action_code,
      action_occurrence_id: reference?.action_occurrence_id || null,
      action_occurrence_revision_id:
        reference?.action_occurrence_revision_id || null,
      prohibition_evidence_excerpt_ids:
        reference?.evidence_excerpt_ids || [],
      exception_scope_excerpt_id:
        evidenceByKey.get('EXCEPTION_SCOPE').source_excerpt.excerpt_id,
      examined_permission_cluster_excerpt_id:
        evidenceByKey.get('DISCUSSION_PERMISSION_CLUSTER').source_excerpt.excerpt_id,
      state: 'UNMAPPED_FROZEN_EFFECT_OPERATION',
      reason_code: 'F6_EXCEPTION_EFFECT_LEGAL_OPERATION_NOT_FROZEN',
      legal_operation: null,
      absence_authority: 'NONE',
      comparability_authority: 'NONE',
      publication_effect: 'BLOCK_DEPENDENT_RESULT_ONLY',
    };
    return freeze({
      ...body,
      qxo_no_shop_unresolved_exception_effect_f6_id: contentId(
        'QXO_NO_SHOP_UNRESOLVED_EXCEPTION_EFFECT_F6/V1',
        body,
      ),
    });
  }));
}

function buildRetainedSourceResiduals(evidenceByKey) {
  return freeze(RETAINED_SOURCE_RESIDUAL_SPECS.map((spec) => {
    const evidence = spec.source_keys.map((key) => evidenceByKey.get(key));
    const body = {
      schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_RESIDUAL_F6/V1',
      residual_code: spec.residual_code,
      governed_ordinal: Math.min(...evidence.map((entry) => entry.governed_ordinal)),
      evidence_excerpt_ids: evidence.map(
        (entry) => entry.source_excerpt.excerpt_id,
      ),
      state: 'PENDING_GOVERNED_DISPOSITION',
      publication_effect: 'BLOCK_DEPENDENT_RESULT_ONLY',
      absence_authority: 'NONE',
      comparability_authority: 'NONE',
    };
    return freeze({
      ...body,
      qxo_no_shop_exception_source_residual_f6_id: contentId(
        'QXO_NO_SHOP_EXCEPTION_SOURCE_RESIDUAL_F6/V1',
        body,
      ),
    });
  }).sort((left, right) => left.governed_ordinal - right.governed_ordinal
    || left.residual_code.localeCompare(right.residual_code)));
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version
      !== 'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F6 source-binding carrier is invalid');
  }
  boundedCanonicalBytes(
    carrier,
    MAX_BINDING_BYTES,
    'CARRIER_LIMIT_EXCEEDED',
    'the F6 source-binding carrier exceeds its byte limit',
  );
  const body = { ...carrier };
  delete body.qxo_no_shop_exception_source_binding_f6_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_exception_source_binding_f6_id !== contentId(
    'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F6 source-binding identity has drifted');
  }
  return true;
}

function buildCarrier(input, forcedFailures = {}) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F6 source-binding input is outside its contract');
  }
  if (!exactKeys(forcedFailures, [
    'prerequisite_code',
    'effect_key',
  ])) {
    fail('FAILURE_ATTESTATION_CONTRACT_MISMATCH', 'the failure attestation is invalid');
  }
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: source,
    qxo_no_shop_actions_f6_parser_bound_review_seed: actionSeed,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  } = input;
  const { exceptionSchema, inlineSchema } = validateContract(contractBundle);
  validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity(actionSeed);
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity(definitionGraph);
  if (actionSeed.qxo_no_shop_actions_f6_parser_bound_review_seed_id !== ACTION_SEED_ID
    || actionSeed.canonical_payload_digest !== ACTION_SEED_DIGEST
    || definitionGraph.qxo_no_shop_reviewed_definition_graph_f6_id
      !== DEFINITION_GRAPH_ID
    || definitionGraph.canonical_payload_digest !== DEFINITION_GRAPH_DIGEST
    || actionSeed.contract_binding.contract_fingerprint !== contractBundle.fingerprint
    || definitionGraph.contract_binding.contract_fingerprint !== contractBundle.fingerprint
    || actionSeed.parser_binding.admitted_parser_proposal_envelope_id
      !== definitionGraph.parser_binding.admitted_parser_proposal_envelope_id
    || actionSeed.parser_binding.admitted_parser_proposal_envelope_payload_digest
      !== definitionGraph.parser_binding.admitted_parser_proposal_envelope_payload_digest) {
    fail('UPSTREAM_BINDING_DRIFT', 'the F6 action and definition carriers disagree');
  }
  validateSource({
    source,
    actionSeed,
    definitionGraph,
    immutableSourceDocument,
    sourceAdmissionManifest,
    semanticExtractionInputEnvelope,
    conversion,
  });
  if (forcedFailures.prerequisite_code !== null
    && !PREREQUISITE_SPECS.some(
      (spec) => spec.prerequisite_code === forcedFailures.prerequisite_code,
    )) {
    fail('UNKNOWN_FORCED_PREREQUISITE_FAILURE', 'the prerequisite failure key is unknown');
  }
  if (forcedFailures.effect_key !== null
    && !EFFECT_SPECS.some((spec) => spec.effect_key === forcedFailures.effect_key)) {
    fail('UNKNOWN_FORCED_EFFECT_FAILURE', 'the effect failure key is unknown');
  }

  const sourceEvidence = Object.entries(SOURCE_SPANS).map(
    ([sourceKey, pin]) => exactSourceEvidence(source, sourceKey, pin),
  ).sort((left, right) => left.governed_ordinal - right.governed_ordinal
    || left.source_key.localeCompare(right.source_key));
  const evidenceByKey = new Map(
    sourceEvidence.map((entry) => [entry.source_key, entry]),
  );
  const prerequisiteOutcomes = PREREQUISITE_SPECS.map(
    (spec) => buildPrerequisiteOutcome({
      spec,
      evidenceByKey,
      definitionGraph,
      forcedFailurePrerequisiteCode: forcedFailures.prerequisite_code,
    }),
  );
  const prerequisiteByCode = new Map(prerequisiteOutcomes.map(
    (outcome) => [outcome.prerequisite_code, outcome],
  ));
  const exceptionEffectOutcomes = EFFECT_SPECS.map((spec) => buildEffectOutcome({
    spec,
    actionSeed,
    evidenceByKey,
    definitionGraph,
    prerequisiteByCode,
    forcedFailureEffectKey: forcedFailures.effect_key,
  }));
  const inlinePermissionSourceBinding = buildInlinePermissionBinding(
    actionSeed,
    evidenceByKey,
  );
  const unresolvedEffects = buildUnresolvedEffects(actionSeed, evidenceByKey);
  const retainedSourceResiduals = buildRetainedSourceResiduals(evidenceByKey);
  const pluralNoticeResidual = definitionGraph.retained_use_residuals.find(
    (residual) => residual.definition_key === 'COMPANY_REQUEST'
      && residual.dependent_result_keys.includes('NO_SHOP_COMPLETE_NOTICE'),
  );
  if (!pluralNoticeResidual) {
    fail('NOTICE_DEPENDENCY_RESIDUAL_MISSING', 'the complete notice blocker is absent');
  }
  const noticeDependencyBody = {
    schema_version: 'QXO_NO_SHOP_NOTICE_DEPENDENCY_SOURCE_BINDING_F6/V1',
    governed_notice_dependency:
      exceptionSchema.governed_notice_dependency,
    first_sentence_notice_excerpt_id:
      evidenceByKey.get('FIRST_SENTENCE_NOTICE').source_excerpt.excerpt_id,
    retained_definition_use_residual_id:
      pluralNoticeResidual.qxo_no_shop_definition_use_residual_f6_id,
    notice_obligation_revision_id: null,
    dependency_state: 'SOURCE_BOUND_OBLIGATION_UNRESOLVED',
    absence_authority: 'NONE',
  };
  const noticeDependency = freeze({
    ...noticeDependencyBody,
    qxo_no_shop_notice_dependency_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_DEPENDENCY_SOURCE_BINDING_F6/V1',
      noticeDependencyBody,
    ),
  });
  const successfulPrerequisiteBindings = prerequisiteOutcomes
    .map((outcome) => outcome.source_binding)
    .filter(Boolean);
  const successfulEffectBindings = exceptionEffectOutcomes
    .map((outcome) => outcome.source_binding)
    .filter(Boolean);
  const definitionRelationshipDependencyBody = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_RELATIONSHIP_DEPENDENCY_F6/V1',
    reviewed_definition_use_binding_ids: [...new Set([
      ...successfulPrerequisiteBindings.flatMap(
        (binding) => binding.definition_use_binding_ids,
      ),
      ...successfulEffectBindings.flatMap(
        (binding) => binding.definition_use_binding_ids,
      ),
    ])].sort(),
    reviewed_definition_dependency_edge_ids: [...new Set(
      [
        ...successfulPrerequisiteBindings.flatMap(
          (binding) => binding.definition_dependency_edge_ids,
        ),
        ...successfulEffectBindings.flatMap(
          (binding) => binding.definition_dependency_edge_ids,
        ),
      ],
    )].sort(),
    canonical_definition_use_relationship_ids: [],
    dependency_state: 'REVIEW_BINDINGS_ONLY_RELATIONSHIPS_UNMATERIALISED',
    relationship_authority: 'NONE',
  };
  const definitionRelationshipDependency = freeze({
    ...definitionRelationshipDependencyBody,
    qxo_no_shop_definition_relationship_dependency_f6_id: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIP_DEPENDENCY_F6/V1',
      definitionRelationshipDependencyBody,
    ),
  });
  const sourceBindingsComplete =
    prerequisiteOutcomes.every((outcome) => !outcome.suppressed)
    && exceptionEffectOutcomes.every((outcome) => !outcome.suppressed);
  const body = {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
      exception_effect_schema_definition_id:
        exceptionSchema.semantic_schema_definition_id,
      exception_effect_schema_definition_payload_digest:
        exceptionSchema.semantic_schema_definition_payload_digest,
      inline_permission_effect_schema_definition_id:
        inlineSchema.semantic_schema_definition_id,
      inline_permission_effect_schema_definition_payload_digest:
        inlineSchema.semantic_schema_definition_payload_digest,
    },
    source_binding: {
      governed_deal_key: DEAL_KEY,
      deal_admission_id: source.deal_admission_id,
      immutable_source_document_id: source.immutable_source_document_id,
      source_admission_manifest_id: source.source_admission_manifest_id,
      semantic_extraction_input_envelope_id:
        source.semantic_extraction_input_envelope_id,
      admitted_semantic_source_context_id:
        source.admitted_semantic_source_context_id,
      document_hash: DOCUMENT_HASH,
      canonical_text_id: CANONICAL_TEXT_ID,
      source_ordinal: source.source_ordinal,
    },
    upstream_bindings: {
      qxo_no_shop_actions_f6_parser_bound_review_seed_id:
        actionSeed.qxo_no_shop_actions_f6_parser_bound_review_seed_id,
      qxo_no_shop_actions_f6_parser_bound_review_seed_payload_digest:
        actionSeed.canonical_payload_digest,
      qxo_no_shop_reviewed_definition_graph_f6_id:
        definitionGraph.qxo_no_shop_reviewed_definition_graph_f6_id,
      qxo_no_shop_reviewed_definition_graph_f6_payload_digest:
        definitionGraph.canonical_payload_digest,
      admitted_parser_proposal_envelope_id:
        actionSeed.parser_binding.admitted_parser_proposal_envelope_id,
    },
    party_binding: {
      obligated_party: TARGET_PARTY,
      protected_party: BUYER_PARTY,
      party_classification_authority: 'EXISTING_REVIEWED_QXO_PARTY_TOKENS_ONLY',
    },
    governed_scopes: {
      restriction_scope_excerpt_id:
        evidenceByKey.get('RESTRICTION_SCOPE').source_excerpt.excerpt_id,
      exception_scope_excerpt_id:
        evidenceByKey.get('EXCEPTION_SCOPE').source_excerpt.excerpt_id,
      first_sentence_notice_excerpt_id:
        evidenceByKey.get('FIRST_SENTENCE_NOTICE').source_excerpt.excerpt_id,
    },
    source_evidence: sourceEvidence,
    prerequisite_outcomes: prerequisiteOutcomes,
    exception_effect_outcomes: exceptionEffectOutcomes,
    inline_permission_source_binding: inlinePermissionSourceBinding,
    unresolved_effects: unresolvedEffects,
    retained_source_residuals: retainedSourceResiduals,
    notice_dependency: noticeDependency,
    definition_relationship_dependency: definitionRelationshipDependency,
    status: {
      prerequisite_source_bindings_complete:
        prerequisiteOutcomes.every((outcome) => !outcome.suppressed),
      governed_effect_source_bindings_complete:
        exceptionEffectOutcomes.every((outcome) => !outcome.suppressed),
      inline_permission_source_binding_complete:
        inlinePermissionSourceBinding.source_binding_complete,
      unresolved_exception_effect_count: unresolvedEffects.length,
      retained_source_residual_count: retainedSourceResiduals.length,
      notice_dependency_complete: false,
      definition_relationship_dependency_complete: false,
      review_source_binding_authority: 'EXACT_SOURCE_ONLY',
      review_renderable: sourceEvidence.length > 0,
      publication_blocked: true,
      absence_authority: 'NONE',
      relationship_effect_authority: 'NONE',
      canonical_write_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      failure_isolation:
        'SUPPRESS_AFFECTED_SOURCE_BINDING_OR_DEPENDENT_EFFECT_ONLY',
      blocker_codes: [
        ...sourceBindingsComplete ? [] : ['F6_EXCEPTION_SOURCE_BINDING_INCOMPLETE'],
        'F6_CONTINUE_DISCUSSIONS_EXCEPTION_EFFECT_UNGOVERNED',
        'F6_CONTINUE_NEGOTIATIONS_EXCEPTION_EFFECT_UNGOVERNED',
        'F6_COMPLETE_NOTICE_OBLIGATION_DEFERRED',
        'F6_DEFINITION_RELATIONSHIP_MATERIALISATION_DEFERRED',
        'F6_EXCEPTION_RELATIONSHIP_COMPOSITION_DEFERRED',
        'F6_INLINE_PERMISSION_RELATIONSHIP_COMPOSITION_DEFERRED',
        'F6_EXCEPTION_SCOPE_DIMENSIONS_UNGOVERNED',
        'F6_FURNISH_METHOD_EFFECT_SCOPE_UNGOVERNED',
        'F6_RESULT_DEFINITION_DEFERRED',
        'UPSTREAM_RETAINED_RESIDUALS',
      ].sort(),
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_exception_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_BINDING_F6_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function buildQxoNoShopExceptionSourceBindingF6(input = {}) {
  return buildCarrier(input, {
    prerequisite_code: null,
    effect_key: null,
  });
}

function buildQxoNoShopExceptionSourceBindingF6FailureIsolationAttestation(
  input = {},
  forcedFailures = {},
) {
  return buildCarrier(input, {
    prerequisite_code: forcedFailures.prerequisite_code ?? null,
    effect_key: forcedFailures.effect_key ?? null,
  });
}

function validateQxoNoShopExceptionSourceBindingF6({
  qxo_no_shop_exception_source_binding_f6: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  const expected = buildQxoNoShopExceptionSourceBindingF6(input);
  if (canonicalJson(carrier) !== canonicalJson(expected)) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F6 source-binding carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  EFFECT_SPECS,
  MAX_BINDING_BYTES,
  PREREQUISITE_SPECS,
  QxoNoShopExceptionSourceBindingF6Error,
  SOURCE_SPANS,
  UNRESOLVED_EFFECT_SPECS,
  buildQxoNoShopExceptionSourceBindingF6,
  buildQxoNoShopExceptionSourceBindingF6FailureIsolationAttestation,
  validateQxoNoShopExceptionSourceBindingF6,
  validateQxoNoShopExceptionSourceBindingF6CarrierIdentity:
    validateCarrierIdentity,
};
