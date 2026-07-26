const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V9,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity,
} = require('./qxo-no-shop-definition-relationships-f8');
const {
  validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity,
} = require('./qxo-no-shop-notice-review-materialisation-f7');
const {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-notice-source-binding-f6');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_NOTICE_RECEIPT_F10_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const NOTICE_PROVISION_ID =
  '8a04ee23c9906b70bdb6fc5b5f3b8202992a91ff079a87b8bb69c00b0ec62512';
const F6_SOURCE_ID =
  '3e4e1a71bf89a360b7d712f96ea28ec2d8496868b7321648f9a214d96fcef7de';
const F6_SOURCE_DIGEST =
  '018dc57ded29b913378007f34ec2d7680076af6a321f0c32daef5b8807c9091b';
const F7_NOTICE_ID =
  '2d934013aba6d7571559696ecc2f0e063100798b2fea256e5804111dd9d3abba';
const F7_NOTICE_DIGEST =
  '73c4f8c83a4a1656491d029caff83a762240985f4fbe819f715d0ce6e6e4849e';
const F8_RELATIONSHIPS_ID =
  'bdff2e031cd831d158614965ce1eceed30a6dafc9f9e302338318927b96f3027';
const F8_RELATIONSHIPS_DIGEST =
  '9de3339e9299c2daaf79de33996f1a04e3a6d0dcacd2bbf48fa7b2a5f67d5f2a';
const NOTICE_SCHEMA_ID =
  'ebf4f905b56c58e2017de88bbbe5f66b5ec5eee7b6b81ef3e4ae73334dd7a48c';
const NOTICE_SCHEMA_DIGEST =
  '477c40df13ace461404fede2720d68505d0ed0a7e8e0969aa421d2ded9850cda';
const MAX_CARRIER_BYTES = 256 * 1024;

const PRIMARY_RECEIPT_CODE =
  'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST';
const PRIMARY_SUBJECT_CODE =
  'PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST';
const ALTERNATIVE_RECEIPT_CODE =
  'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED';
const AMBIGUITY_DIMENSIONS = Object.freeze([
  'REFERENT',
  'SCOPE',
  'CARDINALITY',
]);
const BLOCKER_CODES = Object.freeze([
  'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
  'DEFINITION_PRECEDENCE_CONFLICT_AND_OVERRIDE_SCAN_UNRESOLVED',
  'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
]);
const LAWYER_REVIEW_NOTE =
  'Primary reading: the Company must provide the specified copies promptly and no later than 24 elapsed hours after the Company receives the Company Acquisition Proposal or Company Request described in the preceding clause. The drafting remains ambiguous because “receipt” may instead refer to receipt of each item that must be copied, and it does not resolve item-by-item versus batch application.';

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_definition_relationships_f8',
  'qxo_no_shop_notice_review_materialisation_f7',
  'qxo_no_shop_notice_source_binding_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'notice_occurrence',
  'corrected_copy_clock_interpretation',
  'notice_revision',
  'status',
  'qxo_no_shop_notice_receipt_f10_id',
  'canonical_payload_digest',
]);

class QxoNoShopNoticeReceiptF10Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopNoticeReceiptF10Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopNoticeReceiptF10Error(code, message);
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

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F10 input is outside its contract');
  }
  const {
    contract_bundle: contractBundle,
    qxo_no_shop_definition_relationships_f8: relationships,
    qxo_no_shop_notice_review_materialisation_f7: notice,
    qxo_no_shop_notice_source_binding_f6: source,
  } = input;
  validateContractBundle(contractBundle);
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity(relationships);
  validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity(notice);
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(source);

  const noticeSchema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V9
    || noticeSchema?.semantic_schema_definition_id !== NOTICE_SCHEMA_ID
    || noticeSchema?.semantic_schema_definition_payload_digest
      !== NOTICE_SCHEMA_DIGEST
    || noticeSchema?.record_schema !== 'NO_SHOP_NOTICE_OBLIGATION/V4') {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen F9 contract is required');
  }
  if (source.qxo_no_shop_notice_source_binding_f6_id !== F6_SOURCE_ID
    || source.canonical_payload_digest !== F6_SOURCE_DIGEST
    || notice.qxo_no_shop_notice_review_materialisation_f7_id !== F7_NOTICE_ID
    || notice.canonical_payload_digest !== F7_NOTICE_DIGEST
    || relationships.qxo_no_shop_definition_relationships_f8_id
      !== F8_RELATIONSHIPS_ID
    || relationships.canonical_payload_digest !== F8_RELATIONSHIPS_DIGEST) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact reviewed F6-F8 carriers are required');
  }
  for (const binding of [
    source.source_binding,
    notice.source_binding,
    relationships.source_binding,
  ]) {
    if (binding.document_hash !== DOCUMENT_HASH
      || binding.governed_deal_key !== 'deal:qxo-topbuild') {
      fail('SOURCE_BINDING_DRIFT', 'the exact admitted QXO source is required');
    }
  }
  if (source.notice_obligation_materialisation.source_provision_instance_id
      !== NOTICE_PROVISION_ID
    || relationships.notice_occurrence.source_provision_instance_id
      !== NOTICE_PROVISION_ID
    || relationships.relationship_outcomes.some((outcome) => outcome.suppressed)
    || notice.initial_notice_outcome.suppressed
    || notice.copy_clock_outcome.suppressed) {
    fail('UPSTREAM_REVIEW_INCOMPLETE', 'the required reviewed notice children are incomplete');
  }
  if (source.status.publication_blocked !== true
    || notice.status.canonical_write_authority !== 'NONE'
    || relationships.status.canonical_write_authority !== 'NONE') {
    fail('UPSTREAM_AUTHORITY_DRIFT', 'an upstream carrier granted unexpected authority');
  }
  return noticeSchema;
}

function fieldCodes(source, field) {
  return source.field_source_bindings
    .filter((binding) => binding.field === field)
    .map((binding) => binding.code)
    .sort();
}

function buildCorrectedInterpretation(source, notice, occurrence) {
  const evidenceExcerptIds = sortedUnique([
    ...notice.copy_clock_outcome.interpretation.evidence_excerpt_ids,
    ...source.copy_timing_source_binding.evidence_excerpt_ids,
  ]);
  const identity = {
    subject_kind: 'NOTICE_COPY_CLOCK',
    subject_identity: {
      notice_obligation_occurrence_id:
        occurrence.notice_obligation_occurrence_id,
      clock_role: 'COPY_CLOCK',
    },
    policy_version: 'CLAIM_INTERPRETATION_POLICY/V1',
    clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    primary_interpretation: {
      code: PRIMARY_RECEIPT_CODE,
      receipt_recipient_party: source.party_binding.obligated_party,
      subject_code: PRIMARY_SUBJECT_CODE,
    },
    alternative_interpretations: [{
      code: ALTERNATIVE_RECEIPT_CODE,
    }],
    ambiguity_dimension_codes: [...AMBIGUITY_DIMENSIONS],
    evidence_excerpt_ids: evidenceExcerptIds,
    lawyer_note_digest: sha256Hex(
      Buffer.from(LAWYER_REVIEW_NOTE, 'utf8'),
    ),
    review_provenance: {
      review_authority: 'BEN_APPROVED_F10_FREEZE_GATE_CORRECTION',
      decision_key:
        'QXO_PRIOR_PROPOSAL_OR_REQUEST_RECEIPT_PRIMARY_WITH_AMBIGUITY_FLAG',
      supersedes_decision_key:
        'QXO_COPY_RECEIPT_PRIMARY_WITH_RETAINED_AMBIGUITY',
      source_review_scope: 'EXACT_QXO_FIRST_NOTICE_SENTENCE',
      publication_authority: 'NONE',
    },
  };
  return freeze({
    schema_version: 'NOTICE_CLOCK_INTERPRETATION/V1',
    ...identity,
    interpretation_payload_id: contentId(
      'NOTICE_CLOCK_INTERPRETATION/V1',
      identity,
    ),
    lawyer_review_note: LAWYER_REVIEW_NOTE,
  });
}

function buildCopyClockScope(source, notice, occurrence, interpretation) {
  const predecessor = notice.copy_clock_outcome.clock_scope;
  const identity = {
    notice_obligation_occurrence_id:
      occurrence.notice_obligation_occurrence_id,
    timing_claim_revision_id: predecessor.timing_claim_revision_id,
    raw_receipt_referent: predecessor.raw_receipt_referent,
    receipt_recipient_party: source.party_binding.obligated_party,
    primary_receipt_interpretation_code: PRIMARY_RECEIPT_CODE,
    primary_interpretation_subject_code: PRIMARY_SUBJECT_CODE,
    alternative_receipt_interpretation_codes: [
      ALTERNATIVE_RECEIPT_CODE,
    ],
    referent_interpretation_clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    ambiguity_dimension_codes: [...AMBIGUITY_DIMENSIONS],
    comparability_effect_code: 'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    receipt_referent_state:
      'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    receipt_scope_state:
      'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    copy_subject_association_state:
      'PRIMARY_PRIOR_TRIGGER_ASSOCIATION_SELECTED_WITH_AMBIGUITY',
    item_or_batch_cardinality_state: 'UNRESOLVED',
    interpretation_payload_id: interpretation.interpretation_payload_id,
    resolution_state: 'BLOCKING_UNRESOLVED',
    evidence_excerpt_ids: interpretation.evidence_excerpt_ids,
  };
  return freeze({
    schema_version: 'NOTICE_COPY_CLOCK_SCOPE/V1',
    clock_scope_id: contentId('NOTICE_COPY_CLOCK_SCOPE/V1', identity),
    ...identity,
    lawyer_review_note: LAWYER_REVIEW_NOTE,
  });
}

function buildNoticeRevision(source, notice, relationships, interpretation) {
  const occurrence = relationships.notice_occurrence;
  const relationshipIds = relationships.relationship_outcomes.map(
    (outcome) => outcome.relationship.relationship_effect
      .relationship_effect_revision_id,
  ).sort();
  const evidenceExcerptIds = sortedUnique([
    ...source.source_evidence.map((entry) => entry.source_excerpt.excerpt_id),
    ...notice.initial_notice_outcome.trigger_expression.evidence_excerpt_ids,
    ...notice.initial_notice_outcome.clock_scope.evidence_excerpt_ids,
    ...interpretation.evidence_excerpt_ids,
  ]);
  const copyClockScope = buildCopyClockScope(
    source,
    notice,
    occurrence,
    interpretation,
  );
  const childResolutionStates = [
    ['TRIGGER_EXPRESSION', 'RESOLVED_CLEAR'],
    ['INITIAL_NOTICE_CLOCK_SCOPE', 'RESOLVED_CLEAR'],
    ['COPY_CLOCK_SCOPE', 'BLOCKING_UNRESOLVED'],
    ['DEFINITION_USES', 'BLOCKING_UNRESOLVED'],
    ['DEFINITION_DEPENDENCY', 'BLOCKING_UNRESOLVED'],
    ['DEFINITION_SCOPE', 'BLOCKING_UNRESOLVED'],
  ].map(([child_key, resolution_state]) => ({
    child_key,
    resolution_state,
  }));
  const scopeClosureId = contentId('QXO_NO_SHOP_NOTICE_SCOPE_F10/V1', {
    document_hash: DOCUMENT_HASH,
    notice_obligation_occurrence_id:
      occurrence.notice_obligation_occurrence_id,
    examined_source_span: occurrence.exact_source_span,
    evidence_excerpt_ids: evidenceExcerptIds,
    blocker_codes: [...BLOCKER_CODES],
  });
  const identity = {
    notice_obligation_occurrence_id:
      occurrence.notice_obligation_occurrence_id,
    source_provision_instance_id: NOTICE_PROVISION_ID,
    obligated_party: source.party_binding.obligated_party,
    protected_party: source.party_binding.protected_party,
    trigger_codes: fieldCodes(source, 'TRIGGER_CODE'),
    trigger_expression: notice.initial_notice_outcome.trigger_expression,
    initial_notice_clock_scope: notice.initial_notice_outcome.clock_scope,
    delivery_method_codes: fieldCodes(source, 'DELIVERY_METHOD_CODE'),
    content_requirement_codes:
      fieldCodes(source, 'CONTENT_REQUIREMENT_CODE'),
    copy_clock_scope: copyClockScope,
    copy_subject_codes: fieldCodes(source, 'COPY_SUBJECT_CODE'),
    definition_use_relationship_ids: relationshipIds,
    evidence_excerpt_ids: evidenceExcerptIds,
    scope_closure_id: scopeClosureId,
    child_resolution_states: childResolutionStates,
  };
  return freeze({
    schema_version: 'NO_SHOP_NOTICE_OBLIGATION/V4',
    notice_obligation_revision_id: contentId(
      'NO_SHOP_NOTICE_OBLIGATION/V4',
      identity,
    ),
    ...identity,
  });
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version !== 'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F10 carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F10 carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_notice_receipt_f10_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_notice_receipt_f10_id !== contentId(
    'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_NOTICE_RECEIPT_F10_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F10 carrier identity has drifted');
  }
  return true;
}

function buildCarrier(input) {
  const noticeSchema = validateInputs(input);
  const {
    qxo_no_shop_definition_relationships_f8: relationships,
    qxo_no_shop_notice_review_materialisation_f7: notice,
    qxo_no_shop_notice_source_binding_f6: source,
  } = input;
  const occurrence = relationships.notice_occurrence;
  const interpretation = buildCorrectedInterpretation(
    source,
    notice,
    occurrence,
  );
  const revision = buildNoticeRevision(
    source,
    notice,
    relationships,
    interpretation,
  );
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_definition_id:
        noticeSchema.semantic_schema_definition_id,
      notice_schema_definition_payload_digest:
        noticeSchema.semantic_schema_definition_payload_digest,
    },
    source_binding: source.source_binding,
    upstream_bindings: {
      qxo_no_shop_notice_source_binding_f6_id: F6_SOURCE_ID,
      qxo_no_shop_notice_source_binding_f6_payload_digest:
        F6_SOURCE_DIGEST,
      qxo_no_shop_notice_review_materialisation_f7_id: F7_NOTICE_ID,
      qxo_no_shop_notice_review_materialisation_f7_payload_digest:
        F7_NOTICE_DIGEST,
      qxo_no_shop_definition_relationships_f8_id:
        F8_RELATIONSHIPS_ID,
      qxo_no_shop_definition_relationships_f8_payload_digest:
        F8_RELATIONSHIPS_DIGEST,
    },
    notice_occurrence: occurrence,
    corrected_copy_clock_interpretation: interpretation,
    notice_revision: revision,
    status: {
      review_renderable: true,
      primary_receipt_interpretation_code: PRIMARY_RECEIPT_CODE,
      ambiguity_flag_visible: true,
      overall_resolution_state: 'BLOCKING_UNRESOLVED',
      publication_blocked: true,
      comparison_blocked: true,
      materialisation_authority: 'REVIEW_IDENTITY_ONLY',
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
      blocker_codes: [...BLOCKER_CODES],
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_notice_receipt_f10_id: contentId(
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateQxoNoShopNoticeReceiptF10({
  qxo_no_shop_notice_receipt_f10: carrier,
  ...input
}) {
  const expected = buildCarrier(input);
  if (canonicalJson(carrier) !== canonicalJson(expected)) {
    fail('CARRIER_DRIFT', 'the QXO F10 notice carrier has drifted');
  }
  return true;
}

module.exports = {
  ALTERNATIVE_RECEIPT_CODE,
  AMBIGUITY_DIMENSIONS,
  AUTHORITY_SCOPE,
  BLOCKER_CODES,
  LAWYER_REVIEW_NOTE,
  MAX_CARRIER_BYTES,
  PRIMARY_RECEIPT_CODE,
  PRIMARY_SUBJECT_CODE,
  QxoNoShopNoticeReceiptF10Error,
  buildQxoNoShopNoticeReceiptF10: buildCarrier,
  validateQxoNoShopNoticeReceiptF10,
  validateQxoNoShopNoticeReceiptF10CarrierIdentity: validateCarrierIdentity,
};
