const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-notice-source-binding-f6');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6_ONLY';
const NOTICE_SOURCE_BINDING_ID =
  '599727affea311b4ecc884e3806b21c5dbea8df77b10f01ca193c1184ce88c46';
const NOTICE_SOURCE_BINDING_DIGEST =
  '256ad333d0ca0c8593456c008f1e4ee6c532b6a8cf7c67efa64cfddbba44fc6c';
const NOTICE_SCHEMA_ID =
  'b19d73d141900929ddeb45449249c69debde0eed5da99dd02bf4dfd1d70e9b1c';
const NOTICE_SCHEMA_DIGEST =
  '53569e2b53f8c43a906d259ac5fdba70c86bbf2ac2a6aa8c64c6ed7cf0f82b39';
const FIRST_CLOCK_CLAIM_ID =
  '609e1153fd0e8fe5f75127bee4ef32480814226e7cb07b0b21448e9b11b28985';
const COPY_CLOCK_CLAIM_ID =
  'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177';
const MAX_CARRIER_BYTES = 64 * 1024;

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_notice_source_binding_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_binding',
  'party_binding',
  'initial_notice_clock_outcome',
  'copy_clock_outcome',
  'definition_use_outcomes',
  'definition_dependency_outcome',
  'source_residual_dispositions',
  'contract_representation_gap',
  'notice_materialisation',
  'status',
  'qxo_no_shop_notice_semantic_closure_f6_id',
  'canonical_payload_digest',
]);

const DEFINITION_USE_SPECS = Object.freeze([
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    absolute_start: 207988,
    absolute_end: 208016,
    upstream_review_resolution_id:
      '99a946517f07c0f1e6ffb6030f53337cbb270da5c3545137e93dfb2fb95a2ec4',
    resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    absolute_start: 208321,
    absolute_end: 208349,
    upstream_review_resolution_id:
      '46e75ce2de586c3d6a0d8c8368575884f48e8928dafc8b62935c467b2d07e4a3',
    resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    absolute_start: 208505,
    absolute_end: 208533,
    upstream_review_resolution_id:
      '997c03fa57291bb21b417b2a7b38c0c2c6067b88e325c801e2489605e04fb4e0',
    resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    absolute_start: 208541,
    absolute_end: 208556,
    upstream_review_resolution_id:
      '943bde35167fce7b05d3476301ed6ebd516015b2fefaacd2f53b8c2c8c6482b0',
    resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    absolute_start: 208683,
    absolute_end: 208699,
    upstream_review_resolution_id:
      '526976417751fbdd55f0d5776a3e6022c07c8853ba82be96cfcf5db037adb8ad',
    resolution_kind: 'REVIEWED_SOURCE_SPECIFIC_PLURAL_USE',
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    absolute_start: 208759,
    absolute_end: 208787,
    upstream_review_resolution_id:
      '2ee25a6a6ee510f7887ac5009e31ad1a647756bf05c81c2b166d9297b2da56b6',
    resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    absolute_start: 208830,
    absolute_end: 208858,
    upstream_review_resolution_id:
      'fa3eac7b2616b1f12291dd85394d7927a70e0751f946681098cb7649d78142fe',
    resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
  }),
]);

const DEFINITION_DEPENDENCY_SPEC = Object.freeze({
  container_definition_key: 'COMPANY_REQUEST',
  referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
  absolute_start: 208321,
  absolute_end: 208349,
  upstream_review_resolution_id:
    'cc8467abf2d8889d2a76b41cbf5bef404de973f53760c3cee2c98aa25185c972',
});

class QxoNoShopNoticeSemanticClosureF6Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopNoticeSemanticClosureF6Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopNoticeSemanticClosureF6Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validateContract(contractBundle, sourceCarrier) {
  validateContractBundle(contractBundle);
  const schema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6
    || !schema
    || schema.semantic_schema_definition_id !== NOTICE_SCHEMA_ID
    || schema.semantic_schema_definition_payload_digest !== NOTICE_SCHEMA_DIGEST
    || sourceCarrier.contract_binding.contract_fingerprint
      !== contractBundle.fingerprint
    || sourceCarrier.contract_binding.notice_schema_definition_id
      !== schema.semantic_schema_definition_id
    || sourceCarrier.contract_binding.notice_schema_definition_payload_digest
      !== schema.semantic_schema_definition_payload_digest) {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen F6 notice contract is required');
  }
  return schema;
}

function validateSourceCarrier(sourceCarrier) {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(sourceCarrier);
  if (sourceCarrier.qxo_no_shop_notice_source_binding_f6_id
      !== NOTICE_SOURCE_BINDING_ID
    || sourceCarrier.canonical_payload_digest !== NOTICE_SOURCE_BINDING_DIGEST
    || sourceCarrier.status.review_source_mapping_complete !== true
    || sourceCarrier.status.publication_blocked !== true
    || sourceCarrier.status.canonical_write_authority !== 'NONE') {
    fail('NOTICE_SOURCE_BINDING_DRIFT', 'the exact reviewed F6 notice source carrier is required');
  }
}

function evidence(sourceCarrier, sourceKey, start, end) {
  const matches = sourceCarrier.source_evidence.filter((entry) => (
    entry.source_key === sourceKey
    && entry.semantic_span.absolute_start === start
    && entry.semantic_span.absolute_end === end
  ));
  if (matches.length !== 1) {
    fail('SOURCE_EVIDENCE_DRIFT', `${sourceKey} exact evidence is required`);
  }
  return matches[0];
}

function fieldBinding(sourceCarrier, field, code) {
  const matches = sourceCarrier.field_source_bindings.filter((entry) => (
    entry.field === field && entry.code === code
  ));
  if (matches.length !== 1) {
    fail('FIELD_BINDING_DRIFT', `${field}:${code} exact source binding is required`);
  }
  return matches[0];
}

function sourceResidual(sourceCarrier, residualCode) {
  const matches = sourceCarrier.retained_source_residuals.filter(
    (entry) => entry.residual_code === residualCode,
  );
  if (matches.length !== 1) {
    fail('SOURCE_RESIDUAL_DRIFT', `${residualCode} exact residual is required`);
  }
  return matches[0];
}

function buildInitialClockResolution(sourceCarrier) {
  const alternativeEvidence = evidence(
    sourceCarrier,
    'ALTERNATIVE_TRIGGERS',
    208484,
    208556,
  );
  const capEvidence = evidence(sourceCarrier, 'CAP_TRIGGER', 208505, 208533);
  const requestEvidence = evidence(
    sourceCarrier,
    'COMPANY_REQUEST_TRIGGER',
    208541,
    208556,
  );
  const noticeClockEvidence = evidence(
    sourceCarrier,
    'NOTICE_CLOCK',
    207841,
    207877,
  );
  const capBinding = fieldBinding(
    sourceCarrier,
    'TRIGGER_CODE',
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
  );
  const requestBinding = fieldBinding(
    sourceCarrier,
    'TRIGGER_CODE',
    'RECEIPT_OF_COMPANY_REQUEST',
  );
  const expressionBody = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_NOTICE_TRIGGER_EXPRESSION_F6/V1',
    operator: 'ANY_OF',
    operand_semantics: 'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
    operands: [
      {
        trigger_code: capBinding.code,
        field_source_binding_id:
          capBinding.qxo_no_shop_notice_field_source_binding_f6_id,
        evidence_excerpt_id: capEvidence.source_excerpt.excerpt_id,
      },
      {
        trigger_code: requestBinding.code,
        field_source_binding_id:
          requestBinding.qxo_no_shop_notice_field_source_binding_f6_id,
        evidence_excerpt_id: requestEvidence.source_excerpt.excerpt_id,
      },
    ],
    shared_expression_evidence_excerpt_id:
      alternativeEvidence.source_excerpt.excerpt_id,
    source_semantic_authority: 'THIS_QXO_SENTENCE_REVIEW_ONLY',
    canonical_trigger_expression_id: null,
  };
  const expression = freeze({
    ...expressionBody,
    qxo_no_shop_reviewed_notice_trigger_expression_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_NOTICE_TRIGGER_EXPRESSION_F6/V1',
      expressionBody,
    ),
  });
  const resolutionBody = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_INITIAL_NOTICE_CLOCK_SCOPE_F6/V1',
    existing_claim_revision_id:
      sourceCarrier.notice_timing_source_binding.existing_review_claim_revision_id,
    trigger_expression_id:
      expression.qxo_no_shop_reviewed_notice_trigger_expression_f6_id,
    qualifier_codes:
      sourceCarrier.notice_timing_source_binding.qualifier_codes,
    qualifier_semantics: 'CUMULATIVE_PROMPTLY_AND_24_ELAPSED_HOUR_CEILING',
    clock_applies_to_each_trigger_operand: true,
    clock_evidence_excerpt_id: noticeClockEvidence.source_excerpt.excerpt_id,
    legacy_trigger_disposition: {
      observed_trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
      disposition: 'UNDER_INCLUSIVE_REVIEW_INPUT_NOT_CANONICAL_AUTHORITY',
    },
    canonical_relationship_revision_id: null,
    source_semantic_authority: 'THIS_QXO_SENTENCE_REVIEW_ONLY',
  };
  return freeze({
    trigger_expression: expression,
    clock_scope_resolution: {
      ...resolutionBody,
      qxo_no_shop_reviewed_initial_notice_clock_scope_f6_id: contentId(
        'QXO_NO_SHOP_REVIEWED_INITIAL_NOTICE_CLOCK_SCOPE_F6/V1',
        resolutionBody,
      ),
    },
  });
}

function buildCopyClockResolution(sourceCarrier) {
  const copyClockEvidence = evidence(
    sourceCarrier,
    'COPY_CLOCK',
    208605,
    208641,
  );
  const rawBytes = Buffer.from(
    copyClockEvidence.source_excerpt.exact_text,
    'utf8',
  ).subarray(208634 - 208605, 208641 - 208605);
  if (rawBytes.toString('utf8') !== 'receipt'
    || sha256Hex(rawBytes)
      !== '6f32860910ca0fb2a20c7fda143666b09dbf8db5238195c90a586fb542ff0cad') {
    fail('COPY_RECEIPT_REFERENT_DRIFT', 'the exact raw copy-clock receipt referent is required');
  }
  const body = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_COPY_CLOCK_REFERENT_F6/V1',
    existing_claim_revision_id:
      sourceCarrier.copy_timing_source_binding.claim_revision_id,
    raw_referent: {
      exact_text: 'receipt',
      absolute_start: 208634,
      absolute_end: 208641,
      exact_bytes_digest:
        '6f32860910ca0fb2a20c7fda143666b09dbf8db5238195c90a586fb542ff0cad',
      parent_evidence_excerpt_id:
        copyClockEvidence.source_excerpt.excerpt_id,
    },
    canonical_trigger_code: null,
    canonical_trigger_expression_id: null,
    receipt_object_resolution: 'UNRESOLVED',
    copy_subject_association_resolution: 'UNRESOLVED',
    item_or_batch_cardinality_resolution: 'UNRESOLVED',
    source_semantic_authority: 'RAW_REFERENT_ONLY',
    canonical_relationship_revision_id: null,
  };
  return freeze({
    ...body,
    qxo_no_shop_reviewed_copy_clock_referent_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_COPY_CLOCK_REFERENT_F6/V1',
      body,
    ),
  });
}

function validateDefinitionInputs(sourceCarrier) {
  const directIds = DEFINITION_USE_SPECS
    .filter((entry) => entry.resolution_kind === 'REVIEWED_DEFINITION_USE_BINDING')
    .map((entry) => entry.upstream_review_resolution_id)
    .sort();
  if (canonicalJson(directIds) !== canonicalJson(
    sourceCarrier.definition_relationship_dependency
      .reviewed_definition_use_binding_ids,
  ) || sourceCarrier.plural_definition_use_resolution
    .qxo_no_shop_reviewed_plural_definition_use_f6_id
      !== DEFINITION_USE_SPECS[4].upstream_review_resolution_id
    || canonicalJson([
      DEFINITION_DEPENDENCY_SPEC.upstream_review_resolution_id,
    ]) !== canonicalJson(
      sourceCarrier.definition_relationship_dependency
        .reviewed_definition_dependency_edge_ids,
    )) {
    fail('DEFINITION_REVIEW_BINDING_DRIFT', 'the exact reviewed definition subgraph is required');
  }
}

function definitionUseOutcome(spec, forcedFailure) {
  const suppressed = forcedFailure?.kind === 'DEFINITION_USE'
    && forcedFailure.absolute_start === spec.absolute_start;
  const resolutionBody = suppressed ? null : {
    schema_version: 'QXO_NO_SHOP_NOTICE_DEFINITION_USE_RESOLUTION_F6/V1',
    definition_key: spec.definition_key,
    absolute_start: spec.absolute_start,
    absolute_end: spec.absolute_end,
    resolution_kind: spec.resolution_kind,
    upstream_review_resolution_id: spec.upstream_review_resolution_id,
    canonical_definition_use_relationship_id: null,
    relationship_authority: 'NONE',
  };
  const resolution = resolutionBody ? freeze({
    ...resolutionBody,
    qxo_no_shop_notice_definition_use_resolution_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_DEFINITION_USE_RESOLUTION_F6/V1',
      resolutionBody,
    ),
  }) : null;
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_DEFINITION_USE_OUTCOME_F6/V1',
    definition_key: spec.definition_key,
    absolute_start: spec.absolute_start,
    absolute_end: spec.absolute_end,
    suppressed,
    failure_code: suppressed ? 'ATTESTED_DEFINITION_USE_FAILURE' : null,
    resolution,
  };
  return freeze({
    ...body,
    qxo_no_shop_notice_definition_use_outcome_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_DEFINITION_USE_OUTCOME_F6/V1',
      body,
    ),
  });
}

function definitionDependencyOutcome(definitionOutcomes) {
  const dependencyUse = definitionOutcomes.find(
    (entry) => entry.absolute_start === DEFINITION_DEPENDENCY_SPEC.absolute_start,
  );
  const suppressed = !dependencyUse || dependencyUse.suppressed;
  const resolutionBody = suppressed ? null : {
    schema_version: 'QXO_NO_SHOP_NOTICE_DEFINITION_DEPENDENCY_RESOLUTION_F6/V1',
    ...DEFINITION_DEPENDENCY_SPEC,
    canonical_definition_use_relationship_id: null,
    relationship_authority: 'NONE',
  };
  const resolution = resolutionBody ? freeze({
    ...resolutionBody,
    qxo_no_shop_notice_definition_dependency_resolution_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_DEFINITION_DEPENDENCY_RESOLUTION_F6/V1',
      resolutionBody,
    ),
  }) : null;
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_DEFINITION_DEPENDENCY_OUTCOME_F6/V1',
    suppressed,
    failure_code: suppressed ? 'DEPENDENT_DEFINITION_USE_UNRESOLVED' : null,
    resolution,
  };
  return freeze({
    ...body,
    qxo_no_shop_notice_definition_dependency_outcome_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_DEFINITION_DEPENDENCY_OUTCOME_F6/V1',
      body,
    ),
  });
}

function residualDisposition(sourceCarrier, residualCode, disposition) {
  const residual = sourceResidual(sourceCarrier, residualCode);
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_SOURCE_RESIDUAL_DISPOSITION_F6/V1',
    predecessor_source_residual_id:
      residual.qxo_no_shop_notice_source_residual_f6_id,
    predecessor_residual_code: residual.residual_code,
    disposition,
    canonical_authority: 'NONE',
  };
  return freeze({
    ...body,
    qxo_no_shop_notice_source_residual_disposition_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_RESIDUAL_DISPOSITION_F6/V1',
      body,
    ),
  });
}

function buildCarrier(input, forcedFailure = null) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F6 notice semantic closure received fields outside its contract');
  }
  if (forcedFailure !== null
    && forcedFailure !== 'INITIAL_CLOCK'
    && forcedFailure !== 'COPY_CLOCK'
    && !(forcedFailure?.kind === 'DEFINITION_USE'
      && Number.isInteger(forcedFailure.absolute_start))) {
    fail('UNKNOWN_FORCED_FAILURE', 'the semantic closure failure key is unknown');
  }
  const sourceCarrier = input.qxo_no_shop_notice_source_binding_f6;
  validateSourceCarrier(sourceCarrier);
  validateContract(input.contract_bundle, sourceCarrier);
  validateDefinitionInputs(sourceCarrier);

  const initialNoticeClockOutcome = forcedFailure === 'INITIAL_CLOCK'
    ? freeze({
      schema_version: 'QXO_NO_SHOP_NOTICE_CLOCK_SEMANTIC_OUTCOME_F6/V1',
      clock_role: 'INITIAL_NOTICE',
      suppressed: true,
      failure_code: 'ATTESTED_INITIAL_CLOCK_FAILURE',
      resolution: null,
    })
    : freeze({
      schema_version: 'QXO_NO_SHOP_NOTICE_CLOCK_SEMANTIC_OUTCOME_F6/V1',
      clock_role: 'INITIAL_NOTICE',
      suppressed: false,
      failure_code: null,
      resolution: buildInitialClockResolution(sourceCarrier),
    });
  const copyClockOutcome = forcedFailure === 'COPY_CLOCK'
    ? freeze({
      schema_version: 'QXO_NO_SHOP_NOTICE_CLOCK_SEMANTIC_OUTCOME_F6/V1',
      clock_role: 'COPY_DUTY',
      suppressed: true,
      failure_code: 'ATTESTED_COPY_CLOCK_FAILURE',
      resolution: null,
    })
    : freeze({
      schema_version: 'QXO_NO_SHOP_NOTICE_CLOCK_SEMANTIC_OUTCOME_F6/V1',
      clock_role: 'COPY_DUTY',
      suppressed: false,
      failure_code: null,
      resolution: buildCopyClockResolution(sourceCarrier),
    });
  const definitionUseOutcomes = freeze(DEFINITION_USE_SPECS.map(
    (spec) => definitionUseOutcome(spec, forcedFailure),
  ));
  const definitionDependency = definitionDependencyOutcome(
    definitionUseOutcomes,
  );

  const sourceResidualDispositions = freeze([
    residualDisposition(
      sourceCarrier,
      'NOTICE_ALTERNATIVE_TRIGGER_OPERATOR_UNGOVERNED',
      'SOURCE_LOCAL_ANY_OF_REVIEW_RESOLUTION',
    ),
    residualDisposition(
      sourceCarrier,
      'NOTICE_FIRST_CLOCK_TRIGGER_SCOPE_INCOMPLETE',
      'SOURCE_LOCAL_FIRST_CLOCK_SCOPE_REVIEW_RESOLUTION',
    ),
    residualDisposition(
      sourceCarrier,
      'NOTICE_COPY_CLOCK_TRIGGER_REFERENT_UNGOVERNED',
      'RAW_RECEIPT_REFERENT_RETAINED_OBJECT_UNRESOLVED',
    ),
    residualDisposition(
      sourceCarrier,
      'NOTICE_DEFINITION_SCOPE_INCOMPLETE',
      'RETAINED_INCOMPLETE_OUTSIDE_REVIEWED_DEFINITION_SUBGRAPH',
    ),
  ]);
  const representationGapBody = {
    schema_version:
      'QXO_NO_SHOP_NOTICE_CONTRACT_REPRESENTATION_GAP_F6/V1',
    frozen_notice_schema_definition_id: NOTICE_SCHEMA_ID,
    gap_dimensions: [
      'TRIGGER_COMBINATION_AND_CLOCK_SCOPE_FIELD_ABSENT',
      'COPY_CLOCK_RECEIPT_REFERENT_FIELD_ABSENT',
      'USES_DEFINITION_EFFECT_SCHEMA_ABSENT',
    ],
    raw_copy_receipt_object_unresolved: true,
    raw_copy_subject_association_unresolved: true,
    raw_copy_item_or_batch_cardinality_unresolved: true,
    first_sentence_definition_scope_complete: false,
    known_unclosed_term_texts: [
      'Company',
      'Company Board',
      'Parent',
      'Person',
      'Subsidiary',
    ],
    successor_contract_required: true,
    freeze_gate_required_before_canonical_materialisation: true,
    canonical_object_count: 0,
  };
  const contractRepresentationGap = freeze({
    ...representationGapBody,
    qxo_no_shop_notice_contract_representation_gap_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_CONTRACT_REPRESENTATION_GAP_F6/V1',
      representationGapBody,
    ),
  });
  const anySuppressed = initialNoticeClockOutcome.suppressed
    || copyClockOutcome.suppressed
    || definitionUseOutcomes.some((entry) => entry.suppressed)
    || definitionDependency.suppressed;
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_definition_id: NOTICE_SCHEMA_ID,
      notice_schema_definition_payload_digest: NOTICE_SCHEMA_DIGEST,
    },
    source_binding: sourceCarrier.source_binding,
    upstream_binding: {
      qxo_no_shop_notice_source_binding_f6_id:
        sourceCarrier.qxo_no_shop_notice_source_binding_f6_id,
      qxo_no_shop_notice_source_binding_f6_payload_digest:
        sourceCarrier.canonical_payload_digest,
    },
    party_binding: sourceCarrier.party_binding,
    initial_notice_clock_outcome: initialNoticeClockOutcome,
    copy_clock_outcome: copyClockOutcome,
    definition_use_outcomes: definitionUseOutcomes,
    definition_dependency_outcome: definitionDependency,
    source_residual_dispositions: sourceResidualDispositions,
    contract_representation_gap: contractRepresentationGap,
    notice_materialisation: {
      notice_obligation_occurrence_id: null,
      notice_obligation_revision_id: null,
      new_claim_revision_ids: [],
      relationship_revision_ids: [],
      canonical_definition_use_relationship_ids: [],
      canonical_object_count: 0,
      materialisation_authority: 'NONE',
    },
    status: {
      review_renderable: true,
      review_source_semantic_resolution_complete: !anySuppressed,
      full_notice_semantic_closure_complete: false,
      first_sentence_definition_scope_complete: false,
      source_failure_isolated: anySuppressed,
      contract_representation_complete: false,
      publication_blocked: true,
      absence_authority: 'NONE',
      canonical_write_authority: 'NONE',
      relationship_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      blocker_codes: [
        'F6_NOTICE_CONTRACT_REPRESENTATION_GAP',
        'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
        'NOTICE_CANONICAL_DEFINITION_RELATIONSHIPS_UNMATERIALISED',
        'NOTICE_EXCEPTION_DEPENDENCY_UNMATERIALISED',
        'UPSTREAM_RETAINED_RESIDUALS',
        ...anySuppressed ? ['ATTESTED_REVIEW_RESOLUTION_FAILURE'] : [],
      ].sort(),
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_notice_semantic_closure_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version
      !== 'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F6 notice semantic closure carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F6 notice semantic closure exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_notice_semantic_closure_f6_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_notice_semantic_closure_f6_id !== contentId(
    'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F6 notice semantic closure identity has drifted');
  }
  return true;
}

function buildQxoNoShopNoticeSemanticClosureF6(input = {}) {
  return buildCarrier(input);
}

function buildQxoNoShopNoticeSemanticClosureF6FailureIsolationAttestation(
  input = {},
  forcedFailure,
) {
  return buildCarrier(input, forcedFailure);
}

function validateQxoNoShopNoticeSemanticClosureF6({
  qxo_no_shop_notice_semantic_closure_f6: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier)
    !== canonicalJson(buildQxoNoShopNoticeSemanticClosureF6(input))) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F6 notice semantic closure has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  DEFINITION_DEPENDENCY_SPEC,
  DEFINITION_USE_SPECS,
  MAX_CARRIER_BYTES,
  QxoNoShopNoticeSemanticClosureF6Error,
  buildQxoNoShopNoticeSemanticClosureF6,
  buildQxoNoShopNoticeSemanticClosureF6FailureIsolationAttestation,
  validateQxoNoShopNoticeSemanticClosureF6,
  validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity:
    validateCarrierIdentity,
};
