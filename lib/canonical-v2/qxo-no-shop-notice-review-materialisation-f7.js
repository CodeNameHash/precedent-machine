const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V7,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity,
} = require('./qxo-no-shop-notice-semantic-closure-f6');
const {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-notice-source-binding-f6');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_NOTICE_F7_CHILD_MATERIALISATION_ONLY';
const SOURCE_CARRIER_ID =
  '3e4e1a71bf89a360b7d712f96ea28ec2d8496868b7321648f9a214d96fcef7de';
const SOURCE_CARRIER_DIGEST =
  '018dc57ded29b913378007f34ec2d7680076af6a321f0c32daef5b8807c9091b';
const F6_CLOSURE_ID =
  '9863498a9792cb3655560213b625b99aadb7cc526b4039410133dcc4c5adbc64';
const F6_CLOSURE_DIGEST =
  '4b222b992c86b5407d535e65c1c67cc492637be8878045025ab27e07ff91b0b5';
const NOTICE_SCHEMA_ID =
  'f0f5e4d5340ed988a077ae456b49a91d23045860cacc94db3719a7376d131bf1';
const NOTICE_SCHEMA_DIGEST =
  'd49987bc008acb81a1c6a78946ceeec58d40466dc551730ab74863f1e2083254';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const NOTICE_PROVISION_ID =
  '8a04ee23c9906b70bdb6fc5b5f3b8202992a91ff079a87b8bb69c00b0ec62512';
const INITIAL_CLOCK_CLAIM_ID =
  '609e1153fd0e8fe5f75127bee4ef32480814226e7cb07b0b21448e9b11b28985';
const COPY_CLOCK_CLAIM_ID =
  'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177';
const MAX_CARRIER_BYTES = 96 * 1024;

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_notice_source_binding_f6',
  'qxo_no_shop_notice_semantic_closure_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_binding',
  'review_notice_occurrence',
  'initial_notice_outcome',
  'copy_clock_outcome',
  'notice_revision_materialisation',
  'status',
  'qxo_no_shop_notice_review_materialisation_f7_id',
  'canonical_payload_digest',
]);

const INITIAL_TRIGGER_CODES = Object.freeze([
  'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
  'RECEIPT_OF_COMPANY_REQUEST',
]);
const INITIAL_QUALIFIER_CODES = Object.freeze([
  'PROMPTLY',
  'NO_LATER_THAN_24_ELAPSED_HOURS',
]);
const COPY_AMBIGUITY_DIMENSIONS = Object.freeze([
  'REFERENT',
  'SCOPE',
  'CARDINALITY',
]);
const COPY_PRIMARY_CODE =
  'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED';
const COPY_ALTERNATIVE_CODE =
  'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST';
const COPY_LAWYER_NOTE =
  'The Company must act promptly, with 24 elapsed hours as the outside ceiling. Primary trigger reading: the clock starts when the Company receives the item it must copy. The drafting may instead refer back to receipt of a Company Acquisition Proposal or Company Request, and does not resolve item-by-item versus batch application.';

class QxoNoShopNoticeReviewMaterialisationF7Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopNoticeReviewMaterialisationF7Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopNoticeReviewMaterialisationF7Error(code, message);
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

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function evidence(sourceCarrier, sourceKey) {
  const matches = sourceCarrier.source_evidence.filter(
    (entry) => entry.source_key === sourceKey,
  );
  if (matches.length !== 1) {
    fail('SOURCE_EVIDENCE_DRIFT', `${sourceKey} exact evidence is required`);
  }
  return matches[0];
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F7 notice input is outside its contract');
  }
  const {
    contract_bundle: contractBundle,
    qxo_no_shop_notice_source_binding_f6: sourceCarrier,
    qxo_no_shop_notice_semantic_closure_f6: closure,
  } = input;
  validateContractBundle(contractBundle);
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(sourceCarrier);
  validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity(closure);

  const noticeSchema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V7
    || noticeSchema?.semantic_schema_definition_id !== NOTICE_SCHEMA_ID
    || noticeSchema?.semantic_schema_definition_payload_digest
      !== NOTICE_SCHEMA_DIGEST
    || noticeSchema?.record_schema !== 'NO_SHOP_NOTICE_OBLIGATION/V2') {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen F7 notice contract is required');
  }
  if (sourceCarrier.qxo_no_shop_notice_source_binding_f6_id
      !== SOURCE_CARRIER_ID
    || sourceCarrier.canonical_payload_digest !== SOURCE_CARRIER_DIGEST
    || closure.qxo_no_shop_notice_semantic_closure_f6_id !== F6_CLOSURE_ID
    || closure.canonical_payload_digest !== F6_CLOSURE_DIGEST
    || closure.upstream_binding.qxo_no_shop_notice_source_binding_f6_id
      !== SOURCE_CARRIER_ID
    || closure.source_binding.document_hash !== DOCUMENT_HASH
    || sourceCarrier.source_binding.document_hash !== DOCUMENT_HASH
    || sourceCarrier.notice_obligation_materialisation
      .source_provision_instance_id !== NOTICE_PROVISION_ID
    || sourceCarrier.notice_timing_source_binding
      .existing_review_claim_revision_id !== INITIAL_CLOCK_CLAIM_ID
    || sourceCarrier.copy_timing_source_binding.claim_revision_id
      !== COPY_CLOCK_CLAIM_ID) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact reviewed F6 notice carriers are required');
  }
  if (closure.status.review_renderable !== true
    || closure.status.canonical_write_authority !== 'NONE'
    || sourceCarrier.status.publication_blocked !== true) {
    fail('UPSTREAM_AUTHORITY_DRIFT', 'the F6 carriers granted unexpected authority');
  }
  return noticeSchema;
}

function buildReviewNoticeOccurrence(sourceCarrier) {
  const firstSentence = evidence(sourceCarrier, 'FIRST_SENTENCE');
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_REVIEW_OCCURRENCE_F7/V1',
    document_hash: DOCUMENT_HASH,
    source_provision_instance_id: NOTICE_PROVISION_ID,
    concept_key: 'NOSOL-NOTICE',
    governed_ordinal: firstSentence.governed_ordinal,
    source_span_id: firstSentence.semantic_span.semantic_span_id,
    source_evidence_excerpt_id: firstSentence.source_excerpt.excerpt_id,
    obligated_party: sourceCarrier.party_binding.obligated_party,
    identity_authority: 'REVIEW_CANDIDATE_ONLY',
  };
  return freeze({
    ...body,
    notice_obligation_occurrence_id: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_OCCURRENCE_F7/V1',
      body,
    ),
  });
}

function validateReviewNoticeOccurrenceIdentity(occurrence) {
  const body = { ...occurrence };
  delete body.notice_obligation_occurrence_id;
  if (occurrence.notice_obligation_occurrence_id !== contentId(
    'QXO_NO_SHOP_NOTICE_REVIEW_OCCURRENCE_F7/V1',
    body,
  ) || occurrence.identity_authority !== 'REVIEW_CANDIDATE_ONLY') {
    fail(
      'NOTICE_OCCURRENCE_IDENTITY_MISMATCH',
      'the review-only notice occurrence identity has drifted',
    );
  }
  return true;
}

function buildTriggerExpression(sourceCarrier) {
  const evidenceExcerptIds = sortedUnique([
    evidence(sourceCarrier, 'ALTERNATIVE_TRIGGERS').source_excerpt.excerpt_id,
    evidence(sourceCarrier, 'CAP_TRIGGER').source_excerpt.excerpt_id,
    evidence(sourceCarrier, 'COMPANY_REQUEST_TRIGGER').source_excerpt.excerpt_id,
  ]);
  const operands = [...INITIAL_TRIGGER_CODES];
  const identity = {
    operator: 'ANY_OF',
    canonical_operand_set: [...INITIAL_TRIGGER_CODES],
    party: sourceCarrier.party_binding.obligated_party,
    source_scope_id: NOTICE_PROVISION_ID,
    evidence_excerpt_ids: evidenceExcerptIds,
  };
  return freeze({
    schema_version: 'NOTICE_TRIGGER_EXPRESSION/V1',
    trigger_expression_id: contentId('NOTICE_TRIGGER_EXPRESSION/V1', identity),
    operator: identity.operator,
    operands,
    operand_sufficiency_code: 'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
    party: identity.party,
    source_scope_id: identity.source_scope_id,
    evidence_excerpt_ids: identity.evidence_excerpt_ids,
  });
}

function validateTriggerExpressionIdentity(expression) {
  const identity = {
    operator: expression.operator,
    canonical_operand_set: expression.operands,
    party: expression.party,
    source_scope_id: expression.source_scope_id,
    evidence_excerpt_ids: expression.evidence_excerpt_ids,
  };
  if (expression.schema_version !== 'NOTICE_TRIGGER_EXPRESSION/V1'
    || expression.trigger_expression_id !== contentId(
      'NOTICE_TRIGGER_EXPRESSION/V1',
      identity,
    )
    || canonicalJson(expression.operands)
      !== canonicalJson(INITIAL_TRIGGER_CODES)
    || expression.operand_sufficiency_code
      !== 'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT'
    || canonicalJson(expression.evidence_excerpt_ids)
      !== canonicalJson(sortedUnique(expression.evidence_excerpt_ids))) {
    fail(
      'TRIGGER_EXPRESSION_IDENTITY_MISMATCH',
      'the F7 trigger expression identity has drifted',
    );
  }
  return true;
}

function buildInitialClockScope(sourceCarrier, triggerExpression) {
  const evidenceExcerptIds = sortedUnique([
    evidence(sourceCarrier, 'NOTICE_PROMPTLY').source_excerpt.excerpt_id,
    evidence(sourceCarrier, 'NOTICE_CLOCK').source_excerpt.excerpt_id,
  ]);
  const identity = {
    timing_claim_revision_id: INITIAL_CLOCK_CLAIM_ID,
    trigger_expression_id: triggerExpression.trigger_expression_id,
    application_scope_code: 'EACH_SATISFYING_TRIGGER_OCCURRENCE',
    qualifier_combination_operator: 'ALL_OF',
    temporal_operator: 'CEILING',
    qualifier_codes: [...INITIAL_QUALIFIER_CODES],
    resolution_state: 'RESOLVED_CLEAR',
    evidence_excerpt_ids: evidenceExcerptIds,
  };
  return freeze({
    schema_version: 'NOTICE_CLOCK_SCOPE/V1',
    clock_scope_id: contentId('NOTICE_CLOCK_SCOPE/V1', identity),
    ...identity,
  });
}

function validateInitialClockScopeIdentity(clockScope) {
  const identity = { ...clockScope };
  delete identity.schema_version;
  delete identity.clock_scope_id;
  if (clockScope.schema_version !== 'NOTICE_CLOCK_SCOPE/V1'
    || clockScope.clock_scope_id !== contentId(
      'NOTICE_CLOCK_SCOPE/V1',
      identity,
    )
    || canonicalJson(clockScope.qualifier_codes)
      !== canonicalJson(INITIAL_QUALIFIER_CODES)
    || canonicalJson(clockScope.evidence_excerpt_ids)
      !== canonicalJson(sortedUnique(clockScope.evidence_excerpt_ids))) {
    fail(
      'INITIAL_CLOCK_SCOPE_IDENTITY_MISMATCH',
      'the F7 initial clock scope identity has drifted',
    );
  }
  return true;
}

function buildCopyInterpretation(
  sourceCarrier,
  reviewNoticeOccurrence,
) {
  const evidenceExcerptIds = sortedUnique([
    evidence(sourceCarrier, 'ALTERNATIVE_TRIGGERS').source_excerpt.excerpt_id,
    evidence(sourceCarrier, 'COPY_DUTY').source_excerpt.excerpt_id,
    evidence(sourceCarrier, 'COPY_CLOCK').source_excerpt.excerpt_id,
  ]);
  const identity = {
    subject_kind: 'NOTICE_COPY_CLOCK',
    subject_identity: {
      notice_obligation_occurrence_id:
        reviewNoticeOccurrence.notice_obligation_occurrence_id,
      clock_role: 'COPY_CLOCK',
    },
    policy_version: 'CLAIM_INTERPRETATION_POLICY/V1',
    clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    primary_interpretation: {
      code: COPY_PRIMARY_CODE,
      receipt_recipient_party: sourceCarrier.party_binding.obligated_party,
      subject_code: 'ITEM_REQUIRED_TO_BE_COPIED',
    },
    alternative_interpretations: [{
      code: COPY_ALTERNATIVE_CODE,
    }],
    ambiguity_dimension_codes: [...COPY_AMBIGUITY_DIMENSIONS],
    evidence_excerpt_ids: evidenceExcerptIds,
    lawyer_note_digest: sha256Hex(Buffer.from(COPY_LAWYER_NOTE, 'utf8')),
    review_provenance: {
      review_authority: 'BEN_APPROVED_F7_FREEZE_GATE',
      decision_key: 'QXO_COPY_RECEIPT_PRIMARY_WITH_RETAINED_AMBIGUITY',
      source_review_scope: 'EXACT_QXO_FIRST_NOTICE_SENTENCE',
    },
  };
  return freeze({
    schema_version: 'NOTICE_CLOCK_INTERPRETATION/V1',
    ...identity,
    interpretation_payload_id: contentId(
      'NOTICE_CLOCK_INTERPRETATION/V1',
      identity,
    ),
  });
}

function validateCopyInterpretationIdentity(interpretation) {
  const identity = { ...interpretation };
  delete identity.schema_version;
  delete identity.interpretation_payload_id;
  if (interpretation.schema_version !== 'NOTICE_CLOCK_INTERPRETATION/V1'
    || interpretation.interpretation_payload_id !== contentId(
      'NOTICE_CLOCK_INTERPRETATION/V1',
      identity,
    )
    || interpretation.clarity_state !== 'REASONABLE_BUT_AMBIGUOUS'
    || interpretation.primary_interpretation.code !== COPY_PRIMARY_CODE
    || canonicalJson(
      interpretation.alternative_interpretations.map((entry) => entry.code),
    ) !== canonicalJson([COPY_ALTERNATIVE_CODE])
    || canonicalJson(interpretation.ambiguity_dimension_codes)
      !== canonicalJson(COPY_AMBIGUITY_DIMENSIONS)
    || canonicalJson(interpretation.evidence_excerpt_ids)
      !== canonicalJson(sortedUnique(interpretation.evidence_excerpt_ids))) {
    fail(
      'COPY_INTERPRETATION_IDENTITY_MISMATCH',
      'the F7 copy-clock interpretation identity has drifted',
    );
  }
  return true;
}

function buildCopyClockScope(
  sourceCarrier,
  closure,
  reviewNoticeOccurrence,
  interpretation,
) {
  const rawReferent = closure.copy_clock_outcome.resolution.raw_referent;
  if (rawReferent.exact_text !== 'receipt'
    || rawReferent.absolute_start !== 208634
    || rawReferent.absolute_end !== 208641
    || rawReferent.exact_bytes_digest
      !== '6f32860910ca0fb2a20c7fda143666b09dbf8db5238195c90a586fb542ff0cad') {
    fail('COPY_RECEIPT_REFERENT_DRIFT', 'the exact raw copy-clock referent is required');
  }
  const identity = {
    notice_obligation_occurrence_id:
      reviewNoticeOccurrence.notice_obligation_occurrence_id,
    timing_claim_revision_id: COPY_CLOCK_CLAIM_ID,
    raw_receipt_referent: rawReferent,
    receipt_recipient_party: sourceCarrier.party_binding.obligated_party,
    primary_receipt_interpretation_code: COPY_PRIMARY_CODE,
    primary_interpretation_subject_code: 'ITEM_REQUIRED_TO_BE_COPIED',
    alternative_receipt_interpretation_codes: [COPY_ALTERNATIVE_CODE],
    referent_interpretation_clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    ambiguity_dimension_codes: [...COPY_AMBIGUITY_DIMENSIONS],
    comparability_effect_code: 'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    receipt_referent_state: 'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    receipt_scope_state: 'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    copy_subject_association_state:
      'PRIMARY_ITEM_ASSOCIATION_SELECTED_WITH_AMBIGUITY',
    item_or_batch_cardinality_state: 'UNRESOLVED',
    interpretation_payload_id: interpretation.interpretation_payload_id,
    resolution_state: 'BLOCKING_UNRESOLVED',
    evidence_excerpt_ids: interpretation.evidence_excerpt_ids,
  };
  return freeze({
    schema_version: 'NOTICE_COPY_CLOCK_SCOPE/V1',
    clock_scope_id: contentId('NOTICE_COPY_CLOCK_SCOPE/V1', identity),
    ...identity,
    lawyer_review_note: COPY_LAWYER_NOTE,
  });
}

function validateCopyClockScopeIdentity(clockScope) {
  const identity = { ...clockScope };
  delete identity.schema_version;
  delete identity.clock_scope_id;
  delete identity.lawyer_review_note;
  if (clockScope.schema_version !== 'NOTICE_COPY_CLOCK_SCOPE/V1'
    || clockScope.clock_scope_id !== contentId(
      'NOTICE_COPY_CLOCK_SCOPE/V1',
      identity,
    )
    || clockScope.comparability_effect_code
      !== 'AMBIGUITY_AFFECTS_METRIC_OR_COHORT'
    || clockScope.item_or_batch_cardinality_state !== 'UNRESOLVED'
    || clockScope.resolution_state !== 'BLOCKING_UNRESOLVED'
    || Object.hasOwn(clockScope, 'canonical_trigger_code')
    || canonicalJson(clockScope.evidence_excerpt_ids)
      !== canonicalJson(sortedUnique(clockScope.evidence_excerpt_ids))) {
    fail(
      'COPY_CLOCK_SCOPE_IDENTITY_MISMATCH',
      'the F7 copy-clock scope identity has drifted',
    );
  }
  return true;
}

function buildCopyTimingSemantics(sourceCarrier) {
  const sourceBinding = sourceCarrier.copy_timing_source_binding;
  if (sourceBinding.claim_revision_id !== COPY_CLOCK_CLAIM_ID
    || canonicalJson(sourceBinding.qualifier_codes)
      !== canonicalJson(INITIAL_QUALIFIER_CODES)
    || sourceBinding.temporal_operator !== 'CEILING') {
    fail(
      'COPY_TIMING_SEMANTICS_DRIFT',
      'the exact cumulative copy timing semantics are required',
    );
  }
  const identity = {
    timing_claim_revision_id: sourceBinding.claim_revision_id,
    qualifier_codes: [...sourceBinding.qualifier_codes],
    qualifier_combination_operator: 'ALL_OF',
    temporal_operator: sourceBinding.temporal_operator,
    raw_duration: sourceBinding.raw_duration,
    canonical_duration: sourceBinding.canonical_duration,
    evidence_excerpt_ids: sortedUnique(sourceBinding.evidence_excerpt_ids),
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_COPY_TIMING_SEMANTICS_F7/V1',
    copy_timing_semantics_id: contentId(
      'QXO_NO_SHOP_COPY_TIMING_SEMANTICS_F7/V1',
      identity,
    ),
    ...identity,
  });
}

function validateCopyTimingSemanticsIdentity(timingSemantics) {
  const identity = { ...timingSemantics };
  delete identity.schema_version;
  delete identity.copy_timing_semantics_id;
  if (timingSemantics.copy_timing_semantics_id !== contentId(
    'QXO_NO_SHOP_COPY_TIMING_SEMANTICS_F7/V1',
    identity,
  ) || canonicalJson(timingSemantics.qualifier_codes)
    !== canonicalJson(INITIAL_QUALIFIER_CODES)
    || timingSemantics.qualifier_combination_operator !== 'ALL_OF'
    || timingSemantics.temporal_operator !== 'CEILING') {
    fail(
      'COPY_TIMING_SEMANTICS_IDENTITY_MISMATCH',
      'the F7 copy timing semantics identity has drifted',
    );
  }
  return true;
}

function validateCopyInterpretationBinding(interpretation, clockScope) {
  if (clockScope.interpretation_payload_id
      !== interpretation.interpretation_payload_id
    || clockScope.referent_interpretation_clarity_state
      !== interpretation.clarity_state
    || clockScope.primary_receipt_interpretation_code
      !== interpretation.primary_interpretation.code
    || canonicalJson(clockScope.alternative_receipt_interpretation_codes)
      !== canonicalJson(
        interpretation.alternative_interpretations.map((entry) => entry.code),
      )
    || canonicalJson(clockScope.ambiguity_dimension_codes)
      !== canonicalJson(interpretation.ambiguity_dimension_codes)
    || canonicalJson(clockScope.evidence_excerpt_ids)
      !== canonicalJson(interpretation.evidence_excerpt_ids)
    || sha256Hex(Buffer.from(clockScope.lawyer_review_note, 'utf8'))
      !== interpretation.lawyer_note_digest) {
    fail(
      'COPY_INTERPRETATION_BINDING_DRIFT',
      'the copy-clock projection disagrees with its sole interpretation authority',
    );
  }
  return true;
}

const ISOLATED_CHILD_ERROR_CODES = Object.freeze({
  INITIAL_NOTICE: Object.freeze([
    'ATTESTED_INITIAL_NOTICE_FAILURE',
    'SOURCE_EVIDENCE_DRIFT',
    'TRIGGER_EXPRESSION_IDENTITY_MISMATCH',
    'INITIAL_CLOCK_SCOPE_IDENTITY_MISMATCH',
  ]),
  COPY_CLOCK: Object.freeze([
    'ATTESTED_COPY_CLOCK_FAILURE',
    'SOURCE_EVIDENCE_DRIFT',
    'COPY_RECEIPT_REFERENT_DRIFT',
    'COPY_INTERPRETATION_IDENTITY_MISMATCH',
    'COPY_CLOCK_SCOPE_IDENTITY_MISMATCH',
    'COPY_TIMING_SEMANTICS_DRIFT',
    'COPY_TIMING_SEMANTICS_IDENTITY_MISMATCH',
    'COPY_INTERPRETATION_BINDING_DRIFT',
  ]),
});

function isolatedChildOutcome(childKey, builder, forcedFailure) {
  try {
    if (forcedFailure === childKey) {
      fail(
        childKey === 'INITIAL_NOTICE'
          ? 'ATTESTED_INITIAL_NOTICE_FAILURE'
          : 'ATTESTED_COPY_CLOCK_FAILURE',
        `${childKey} attested child failure`,
      );
    }
    return builder();
  } catch (error) {
    if (!(error instanceof QxoNoShopNoticeReviewMaterialisationF7Error)
      || !ISOLATED_CHILD_ERROR_CODES[childKey]?.includes(error.code)) {
      throw error;
    }
    return childKey === 'INITIAL_NOTICE'
      ? freeze({
        schema_version: 'QXO_NO_SHOP_NOTICE_F7_CHILD_OUTCOME/V1',
        child_key: childKey,
        suppressed: true,
        failure_code: error.code,
        trigger_expression: null,
        clock_scope: null,
      })
      : freeze({
        schema_version: 'QXO_NO_SHOP_NOTICE_F7_CHILD_OUTCOME/V1',
        child_key: childKey,
        suppressed: true,
        failure_code: error.code,
        interpretation: null,
        clock_scope: null,
        timing_semantics: null,
      });
  }
}

function buildCarrier(input, forcedFailure = null) {
  validateInputs(input);
  if (forcedFailure !== null
    && forcedFailure !== 'INITIAL_NOTICE'
    && forcedFailure !== 'COPY_CLOCK') {
    fail('UNKNOWN_FORCED_FAILURE', 'the F7 notice failure key is unknown');
  }
  const sourceCarrier = input.qxo_no_shop_notice_source_binding_f6;
  const closure = input.qxo_no_shop_notice_semantic_closure_f6;
  const reviewNoticeOccurrence = buildReviewNoticeOccurrence(sourceCarrier);
  validateReviewNoticeOccurrenceIdentity(reviewNoticeOccurrence);

  const initialNoticeOutcome = isolatedChildOutcome(
    'INITIAL_NOTICE',
    () => {
      const triggerExpression = buildTriggerExpression(sourceCarrier);
      validateTriggerExpressionIdentity(triggerExpression);
      const clockScope = buildInitialClockScope(
        sourceCarrier,
        triggerExpression,
      );
      validateInitialClockScopeIdentity(clockScope);
      return freeze({
        schema_version: 'QXO_NO_SHOP_NOTICE_F7_CHILD_OUTCOME/V1',
        child_key: 'INITIAL_NOTICE',
        suppressed: false,
        failure_code: null,
        trigger_expression: triggerExpression,
        clock_scope: clockScope,
      });
    },
    forcedFailure,
  );

  const copyClockOutcome = isolatedChildOutcome(
    'COPY_CLOCK',
    () => {
      const interpretation = buildCopyInterpretation(
        sourceCarrier,
        reviewNoticeOccurrence,
      );
      const clockScope = buildCopyClockScope(
        sourceCarrier,
        closure,
        reviewNoticeOccurrence,
        interpretation,
      );
      const timingSemantics = buildCopyTimingSemantics(sourceCarrier);
      validateCopyInterpretationIdentity(interpretation);
      validateCopyClockScopeIdentity(clockScope);
      validateCopyTimingSemanticsIdentity(timingSemantics);
      validateCopyInterpretationBinding(interpretation, clockScope);
      return freeze({
        schema_version: 'QXO_NO_SHOP_NOTICE_F7_CHILD_OUTCOME/V1',
        child_key: 'COPY_CLOCK',
        suppressed: false,
        failure_code: null,
        interpretation,
        clock_scope: clockScope,
        timing_semantics: timingSemantics,
      });
    },
    forcedFailure,
  );

  const anySuppressed = initialNoticeOutcome.suppressed
    || copyClockOutcome.suppressed;
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_definition_id: NOTICE_SCHEMA_ID,
      notice_schema_definition_payload_digest: NOTICE_SCHEMA_DIGEST,
    },
    source_binding: sourceCarrier.source_binding,
    upstream_binding: {
      qxo_no_shop_notice_source_binding_f6_id: SOURCE_CARRIER_ID,
      qxo_no_shop_notice_source_binding_f6_payload_digest:
        SOURCE_CARRIER_DIGEST,
      qxo_no_shop_notice_semantic_closure_f6_id: F6_CLOSURE_ID,
      qxo_no_shop_notice_semantic_closure_f6_payload_digest:
        F6_CLOSURE_DIGEST,
    },
    review_notice_occurrence: reviewNoticeOccurrence,
    initial_notice_outcome: initialNoticeOutcome,
    copy_clock_outcome: copyClockOutcome,
    notice_revision_materialisation: {
      notice_obligation_revision_id: null,
      definition_use_relationship_ids: [],
      relationship_revision_ids: [],
      materialisation_authority: 'NONE',
      blocker_codes: [
        'NOTICE_REVISION_IDENTITY_CONTRACT_UNFROZEN',
        'USES_DEFINITION_NOTICE_REVISION_ENDPOINT_CYCLE_UNRESOLVED',
      ],
    },
    status: {
      review_renderable: true,
      independent_child_failure_isolated: anySuppressed,
      trigger_expression_materialised: !initialNoticeOutcome.suppressed,
      initial_clock_scope_materialised: !initialNoticeOutcome.suppressed,
      copy_interpretation_materialised: !copyClockOutcome.suppressed,
      copy_clock_scope_materialised: !copyClockOutcome.suppressed,
      copy_clock_comparability: copyClockOutcome.suppressed
        ? 'NOT_EXAMINED_DUE_TO_ISOLATED_FAILURE'
        : 'BLOCKED_AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
      overall_resolution_state: 'BLOCKING_UNRESOLVED',
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
        'NOTICE_REVISION_IDENTITY_CONTRACT_UNFROZEN',
        'USES_DEFINITION_NOTICE_REVISION_ENDPOINT_CYCLE_UNRESOLVED',
        'NOTICE_DEFINITION_RELATIONSHIPS_UNMATERIALISED',
        'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
        'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
        ...anySuppressed ? ['ATTESTED_CHILD_FAILURE'] : [],
      ].sort(),
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_notice_review_materialisation_f7_id: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version
      !== 'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F7 notice carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F7 notice carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_notice_review_materialisation_f7_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_notice_review_materialisation_f7_id !== contentId(
    'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F7 notice carrier identity has drifted');
  }
  if (carrier.review_notice_occurrence?.notice_obligation_occurrence_id) {
    validateReviewNoticeOccurrenceIdentity(carrier.review_notice_occurrence);
  }
  if (carrier.initial_notice_outcome?.suppressed === false) {
    validateTriggerExpressionIdentity(
      carrier.initial_notice_outcome.trigger_expression,
    );
    validateInitialClockScopeIdentity(
      carrier.initial_notice_outcome.clock_scope,
    );
  }
  if (carrier.copy_clock_outcome?.suppressed === false) {
    validateCopyInterpretationIdentity(
      carrier.copy_clock_outcome.interpretation,
    );
    validateCopyClockScopeIdentity(carrier.copy_clock_outcome.clock_scope);
    validateCopyTimingSemanticsIdentity(
      carrier.copy_clock_outcome.timing_semantics,
    );
    validateCopyInterpretationBinding(
      carrier.copy_clock_outcome.interpretation,
      carrier.copy_clock_outcome.clock_scope,
    );
  }
  return true;
}

function buildQxoNoShopNoticeReviewMaterialisationF7(input = {}) {
  return buildCarrier(input);
}

function buildQxoNoShopNoticeReviewMaterialisationF7FailureIsolationAttestation(
  input = {},
  forcedFailure,
) {
  return buildCarrier(input, forcedFailure);
}

function validateQxoNoShopNoticeReviewMaterialisationF7({
  qxo_no_shop_notice_review_materialisation_f7: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier) !== canonicalJson(
    buildQxoNoShopNoticeReviewMaterialisationF7(input),
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F7 notice materialisation has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  COPY_ALTERNATIVE_CODE,
  COPY_AMBIGUITY_DIMENSIONS,
  COPY_LAWYER_NOTE,
  COPY_PRIMARY_CODE,
  INITIAL_QUALIFIER_CODES,
  INITIAL_TRIGGER_CODES,
  MAX_CARRIER_BYTES,
  QxoNoShopNoticeReviewMaterialisationF7Error,
  buildQxoNoShopNoticeReviewMaterialisationF7,
  buildQxoNoShopNoticeReviewMaterialisationF7FailureIsolationAttestation,
  validateQxoNoShopNoticeReviewMaterialisationF7,
  validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity:
    validateCarrierIdentity,
};
