const crypto = require('node:crypto');

const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V11,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopNoticeRevisionF14CarrierIdentity,
} = require('./qxo-no-shop-notice-revision-f14');
const {
  normaliseDurationToDays,
  validateObservationNormalisation,
} = require('./observation-normalisers');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_COPY_CLOCK_F15_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const NOTICE_OCCURRENCE_ID =
  '5bfba36963af3a1baec65d09a4fa479e21889ab522f66aaca89de348839c7440';
const F14_CARRIER_ID =
  'f3412261e6f8e7235b80aebb02795056ed0fac3c1842eef510655d5bc778cfe0';
const F14_CARRIER_DIGEST =
  'f41167f048ee86dafb4f72fbb7c0d7404f50273a01c8bc32cde1fdfc12656004';
const F14_REVISION_ID =
  '5ad5ec9837a9936a2d2d23138e154ac5c1fa715d6231dee10cec6b5bf55ec1e4';
const NOTICE_SCHEMA_ID =
  'cc3938feb63690f09ccb5fbf3fc74b27b4115f75a43dc5fb57cdb383051ebd03';
const NOTICE_SCHEMA_DIGEST =
  '3a0ff16d1a1432b9d03c03fd953d3b3d52f15fd2c847a398295ffa8a20329c78';
const F6_COPY_CLOCK_CLAIM_REVISION_ID =
  'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177';
const F6_COPY_CLOCK_NORMALISATION_PAYLOAD_DIGEST =
  '5bfd481545b53ec694ffa59ce51bd39019294b3d61a8c7b8a690a215ddb2b4fc';
const PRIMARY_RECEIPT_CODE =
  'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST';
const PRIMARY_SUBJECT_CODE =
  'PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST';
const ALTERNATIVE_RECEIPT_CODE =
  'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED';
const PRIMARY_CLOCK_SCOPE =
  'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE';
const ALTERNATIVE_CLOCK_SCOPE_STATE =
  'UNRESOLVED_ITEM_OR_BATCH';
const LAWYER_REVIEW_NOTE =
  'Primary reading: each receipt by the Company of a Company Acquisition Proposal or Company Request starts one copy-delivery clock; the specified copies are the duty objects, so item-by-item versus batch receipt is not applicable to that primary clock. The alternative reading, under which receipt refers to each item to be copied, remains source-backed and its item-versus-batch scope remains unresolved.';
const MAX_CARRIER_BYTES = 256 * 1024;

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_notice_revision_f14',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_binding',
  'notice_occurrence',
  'clock_interpretation',
  'notice_revision',
  'fallback_review_revision',
  'review_projection',
  'status',
  'qxo_no_shop_copy_clock_f15_id',
  'canonical_payload_digest',
]);
const REVISION_FIELDS = Object.freeze([
  'notice_obligation_revision_id',
  'notice_obligation_occurrence_id',
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
  'definition_scope_closure_id',
]);
const AUTHORITY_FIELDS = Object.freeze([
  'absence_authority',
  'canonical_write_authority',
  'publication_authority',
  'relationship_authority',
  'result_authority',
  'metric_authority',
  'comparability_authority',
  'query_authority',
  'serving_authority',
  'release_authority',
]);

class QxoNoShopCopyClockF15Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopCopyClockF15Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopCopyClockF15Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F15 input is outside its contract');
  }
  const {
    contract_bundle: contractBundle,
    qxo_no_shop_notice_revision_f14: predecessor,
  } = input;
  validateContractBundle(contractBundle);
  validateQxoNoShopNoticeRevisionF14CarrierIdentity(predecessor);
  const noticeSchema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V11
    || noticeSchema?.record_schema !== 'NO_SHOP_NOTICE_OBLIGATION/V6'
    || noticeSchema.semantic_schema_definition_id !== NOTICE_SCHEMA_ID
    || noticeSchema.semantic_schema_definition_payload_digest
      !== NOTICE_SCHEMA_DIGEST
    || canonicalJson([...noticeSchema.required_fields].sort())
      !== canonicalJson([...REVISION_FIELDS].sort())
    || noticeSchema.copy_clock_scope_contract.record_schema
      !== 'NOTICE_COPY_CLOCK_SCOPE/V2'
    || noticeSchema.copy_clock_scope_contract.interpretation_payload_binding
      .payload_schema !== 'NOTICE_CLOCK_INTERPRETATION/V2') {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen V11 contract is required');
  }
  if (predecessor.qxo_no_shop_notice_revision_f14_id !== F14_CARRIER_ID
    || predecessor.canonical_payload_digest !== F14_CARRIER_DIGEST
    || predecessor.notice_revision?.notice_obligation_revision_id
      !== F14_REVISION_ID) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact reviewed F14 revision is required');
  }
  if (predecessor.source_binding.document_hash !== DOCUMENT_HASH
    || predecessor.notice_occurrence.notice_obligation_occurrence_id
      !== NOTICE_OCCURRENCE_ID
    || predecessor.notice_revision.notice_obligation_occurrence_id
      !== NOTICE_OCCURRENCE_ID) {
    fail('SOURCE_BINDING_DRIFT', 'the exact admitted QXO notice occurrence is required');
  }
  const clock = predecessor.notice_revision.copy_clock_scope;
  if (clock.primary_receipt_interpretation_code !== PRIMARY_RECEIPT_CODE
    || clock.primary_interpretation_subject_code !== PRIMARY_SUBJECT_CODE
    || canonicalJson(clock.alternative_receipt_interpretation_codes)
      !== canonicalJson([ALTERNATIVE_RECEIPT_CODE])
    || clock.referent_interpretation_clarity_state
      !== 'REASONABLE_BUT_AMBIGUOUS'
    || canonicalJson(clock.ambiguity_dimension_codes)
      !== canonicalJson(['REFERENT', 'SCOPE', 'CARDINALITY'])
    || clock.timing_claim_revision_id !== F6_COPY_CLOCK_CLAIM_REVISION_ID
    || clock.item_or_batch_cardinality_state !== 'UNRESOLVED'
    || clock.resolution_state !== 'BLOCKING_UNRESOLVED'
    || predecessor.status.blocker_codes.length !== 1
    || predecessor.status.blocker_codes[0]
      !== 'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED') {
    fail('PREDECESSOR_COPY_CLOCK_DRIFT', 'the exact unresolved F14 copy clock is required');
  }
  return noticeSchema;
}

function buildInterpretation(predecessor) {
  const clock = predecessor.notice_revision.copy_clock_scope;
  const identity = {
    subject_kind: 'NOTICE_COPY_CLOCK',
    subject_identity: {
      notice_obligation_occurrence_id: NOTICE_OCCURRENCE_ID,
      clock_role: 'COPY_CLOCK',
    },
    policy_version: 'CLAIM_INTERPRETATION_POLICY/V1',
    clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    primary_interpretation: {
      code: PRIMARY_RECEIPT_CODE,
      receipt_recipient_party: clock.receipt_recipient_party,
      subject_code: PRIMARY_SUBJECT_CODE,
    },
    alternative_interpretations: [{
      code: ALTERNATIVE_RECEIPT_CODE,
    }],
    ambiguity_dimension_codes: ['REFERENT', 'SCOPE', 'CARDINALITY'],
    primary_clock_application_scope_code: PRIMARY_CLOCK_SCOPE,
    alternative_clock_application_scope_state:
      ALTERNATIVE_CLOCK_SCOPE_STATE,
    evidence_excerpt_ids: clock.evidence_excerpt_ids,
    lawyer_note_digest: sha256Hex(Buffer.from(LAWYER_REVIEW_NOTE, 'utf8')),
    review_provenance: {
      review_authority: 'BEN_APPROVED_F15_COPY_CLOCK_RESOLUTION',
      decision_key:
        'QXO_PRIMARY_PROPOSAL_OR_REQUEST_RECEIPT_CLOCK_WITH_RETAINED_ITEM_RECEIPT_ALTERNATIVE',
      predecessor_revision_id: F14_REVISION_ID,
      source_review_scope: 'EXACT_QXO_FIRST_NOTICE_SENTENCE',
      publication_authority: 'NONE',
    },
  };
  return freeze({
    schema_version: 'NOTICE_CLOCK_INTERPRETATION/V2',
    ...identity,
    interpretation_payload_id: contentId(
      'NOTICE_CLOCK_INTERPRETATION/V2',
      identity,
    ),
    lawyer_review_note: LAWYER_REVIEW_NOTE,
  });
}

function buildCopyClockScope(predecessor, interpretation) {
  const oldClock = predecessor.notice_revision.copy_clock_scope;
  const primaryMetricNormalisation = normaliseDurationToDays({
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'PROPOSAL_OR_REQUEST_RECEIPT',
    derivationVersion: 'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
  });
  validateObservationNormalisation(primaryMetricNormalisation);
  const identity = {
    notice_obligation_occurrence_id:
      oldClock.notice_obligation_occurrence_id,
    timing_claim_revision_id: oldClock.timing_claim_revision_id,
    raw_receipt_referent: oldClock.raw_receipt_referent,
    receipt_recipient_party: oldClock.receipt_recipient_party,
    primary_receipt_interpretation_code: PRIMARY_RECEIPT_CODE,
    primary_interpretation_subject_code: PRIMARY_SUBJECT_CODE,
    alternative_receipt_interpretation_codes: [ALTERNATIVE_RECEIPT_CODE],
    referent_interpretation_clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    ambiguity_dimension_codes: ['REFERENT', 'SCOPE', 'CARDINALITY'],
    comparability_effect_code: 'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
    receipt_referent_state:
      'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    receipt_scope_state:
      'PRIMARY_SELECTED_WITH_SOURCE_BACKED_ALTERNATIVE',
    copy_subject_association_state:
      'PRIMARY_PRIOR_TRIGGER_ASSOCIATION_SELECTED_WITH_AMBIGUITY',
    interpretation_payload_id: interpretation.interpretation_payload_id,
    resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
    evidence_excerpt_ids: oldClock.evidence_excerpt_ids,
    primary_clock_application_scope_code: PRIMARY_CLOCK_SCOPE,
    primary_item_or_batch_cardinality_state: 'NOT_APPLICABLE',
    alternative_clock_application_scope_state:
      ALTERNATIVE_CLOCK_SCOPE_STATE,
    alternative_item_or_batch_cardinality_state: 'UNRESOLVED',
    cardinality_ambiguity_scope_code:
      'ALTERNATIVE_ITEM_RECEIPT_INTERPRETATION_ONLY',
    comparability_state:
      'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG',
    primary_metric_normalisation: primaryMetricNormalisation,
    source_metric_lineage: {
      source_timing_claim_revision_id: F6_COPY_CLOCK_CLAIM_REVISION_ID,
      source_normalisation_payload_digest:
        F6_COPY_CLOCK_NORMALISATION_PAYLOAD_DIGEST,
      source_derivation_version:
        'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
    },
  };
  return freeze({
    schema_version: 'NOTICE_COPY_CLOCK_SCOPE/V2',
    clock_scope_id: contentId('NOTICE_COPY_CLOCK_SCOPE/V2', identity),
    ...identity,
    lawyer_review_note: LAWYER_REVIEW_NOTE,
  });
}

function buildRevision(predecessor, copyClockScope) {
  const oldRevision = predecessor.notice_revision;
  const childResolutionStates = oldRevision.child_resolution_states.map(
    (entry) => entry.child_key === 'COPY_CLOCK_SCOPE'
      ? {
        child_key: entry.child_key,
        resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
      }
      : entry,
  );
  const scopeClosureId = buildScopeClosureId(predecessor);
  const identity = {
    notice_obligation_occurrence_id:
      oldRevision.notice_obligation_occurrence_id,
    source_provision_instance_id: oldRevision.source_provision_instance_id,
    obligated_party: oldRevision.obligated_party,
    protected_party: oldRevision.protected_party,
    trigger_codes: oldRevision.trigger_codes,
    trigger_expression: oldRevision.trigger_expression,
    initial_notice_clock_scope: oldRevision.initial_notice_clock_scope,
    delivery_method_codes: oldRevision.delivery_method_codes,
    content_requirement_codes: oldRevision.content_requirement_codes,
    copy_clock_scope: copyClockScope,
    copy_subject_codes: oldRevision.copy_subject_codes,
    definition_use_relationship_ids:
      oldRevision.definition_use_relationship_ids,
    evidence_excerpt_ids: oldRevision.evidence_excerpt_ids,
    scope_closure_id: scopeClosureId,
    child_resolution_states: childResolutionStates,
    definition_scope_closure_id: oldRevision.definition_scope_closure_id,
  };
  return freeze({
    schema_version: 'NO_SHOP_NOTICE_OBLIGATION/V6',
    notice_obligation_revision_id: contentId(
      'NO_SHOP_NOTICE_OBLIGATION/V6',
      identity,
    ),
    ...identity,
  });
}

function buildScopeClosureId(predecessor) {
  return contentId('QXO_NO_SHOP_NOTICE_SCOPE_F15/V1', {
    document_hash: DOCUMENT_HASH,
    notice_obligation_occurrence_id: NOTICE_OCCURRENCE_ID,
    examined_source_span: predecessor.notice_occurrence.exact_source_span,
    evidence_excerpt_ids:
      predecessor.notice_revision.evidence_excerpt_ids,
    blocker_codes: [],
    review_note_codes: ['COPY_CLOCK_SOURCE_AMBIGUITY_RETAINED'],
  });
}

function validateScopeClosureIdentity(revision, predecessor) {
  if (revision.scope_closure_id !== buildScopeClosureId(predecessor)
    || revision.scope_closure_id
      === predecessor.notice_revision.scope_closure_id) {
    fail('SCOPE_CLOSURE_IDENTITY_MISMATCH', 'the reminted F15 scope identity has drifted');
  }
  return true;
}

function validateSuccessor(revision, interpretation, noticeSchema, predecessor) {
  if (!exactKeys(revision, ['schema_version', ...REVISION_FIELDS])
    || revision.schema_version !== noticeSchema.record_schema) {
    fail('REVISION_CONTRACT_MISMATCH', 'the V6 notice revision shape is invalid');
  }
  const revisionIdentity = { ...revision };
  delete revisionIdentity.schema_version;
  delete revisionIdentity.notice_obligation_revision_id;
  if (revision.notice_obligation_revision_id !== contentId(
    'NO_SHOP_NOTICE_OBLIGATION/V6',
    revisionIdentity,
  )) {
    fail('REVISION_IDENTITY_MISMATCH', 'the V6 notice revision identity has drifted');
  }
  const clock = revision.copy_clock_scope;
  const clockIdentity = { ...clock };
  delete clockIdentity.schema_version;
  delete clockIdentity.clock_scope_id;
  delete clockIdentity.lawyer_review_note;
  if (clock.clock_scope_id !== contentId(
    'NOTICE_COPY_CLOCK_SCOPE/V2',
    clockIdentity,
  ) || clock.interpretation_payload_id
    !== interpretation.interpretation_payload_id) {
    fail('COPY_CLOCK_IDENTITY_MISMATCH', 'the V2 copy-clock identity has drifted');
  }
  validateObservationNormalisation(clock.primary_metric_normalisation);
  if (canonicalJson(clock.primary_metric_normalisation)
      !== canonicalJson(normaliseDurationToDays({
        rawMagnitude: '24',
        rawUnit: 'HOURS',
        dayBasis: 'ELAPSED',
        trigger: 'PROPOSAL_OR_REQUEST_RECEIPT',
        derivationVersion: 'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
      }))
    || canonicalJson(clock.source_metric_lineage) !== canonicalJson({
      source_timing_claim_revision_id: F6_COPY_CLOCK_CLAIM_REVISION_ID,
      source_normalisation_payload_digest:
        F6_COPY_CLOCK_NORMALISATION_PAYLOAD_DIGEST,
      source_derivation_version:
        'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
    })) {
    fail('METRIC_NORMALISATION_DRIFT', 'the governed F15 duration normalisation or F6 lineage has drifted');
  }
  const interpretationIdentity = { ...interpretation };
  delete interpretationIdentity.schema_version;
  delete interpretationIdentity.interpretation_payload_id;
  delete interpretationIdentity.lawyer_review_note;
  if (interpretation.interpretation_payload_id !== contentId(
    'NOTICE_CLOCK_INTERPRETATION/V2',
    interpretationIdentity,
  )) {
    fail('INTERPRETATION_IDENTITY_MISMATCH', 'the V2 interpretation identity has drifted');
  }
  const oldRevision = predecessor.notice_revision;
  const stableFields = REVISION_FIELDS.filter((field) => ![
    'notice_obligation_revision_id',
    'copy_clock_scope',
    'scope_closure_id',
    'child_resolution_states',
  ].includes(field));
  if (stableFields.some(
    (field) => canonicalJson(revision[field])
      !== canonicalJson(oldRevision[field]),
  ) || revision.definition_use_relationship_ids.length !== 30
    || revision.evidence_excerpt_ids.length !== 30) {
    fail('PREDECESSOR_SEMANTIC_DRIFT', 'F15 changed content outside the copy-clock decision');
  }
  if (revision.child_resolution_states.filter(
    (entry) => entry.child_key === 'COPY_CLOCK_SCOPE'
      && entry.resolution_state === 'RESOLVED_WITH_REVIEW_NOTE',
  ).length !== 1
    || revision.child_resolution_states.some(
      (entry) => entry.resolution_state === 'BLOCKING_UNRESOLVED',
    )) {
    fail('CHILD_STATE_DERIVATION_FAILED', 'the copy-clock blocker did not transition exactly');
  }
  validateScopeClosureIdentity(revision, predecessor);
  return true;
}

function buildBody(input, forcedFailure) {
  const noticeSchema = validateInputs(input);
  const predecessor = input.qxo_no_shop_notice_revision_f14;
  const interpretation = forcedFailure === 'COPY_CLOCK_MATERIALISATION'
    ? null
    : buildInterpretation(predecessor);
  const revision = interpretation
    ? buildRevision(
      predecessor,
      buildCopyClockScope(predecessor, interpretation),
    )
    : null;
  if (revision) {
    validateSuccessor(revision, interpretation, noticeSchema, predecessor);
  }
  const metricNormalisation =
    revision?.copy_clock_scope.primary_metric_normalisation;
  return {
    schema_version: 'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_version: 6,
      notice_schema_definition_id:
        noticeSchema.semantic_schema_definition_id,
      notice_schema_definition_payload_digest:
        noticeSchema.semantic_schema_definition_payload_digest,
    },
    source_binding: predecessor.source_binding,
    upstream_binding: {
      qxo_no_shop_notice_revision_f14_id: F14_CARRIER_ID,
      qxo_no_shop_notice_revision_f14_payload_digest: F14_CARRIER_DIGEST,
      predecessor_notice_obligation_revision_id: F14_REVISION_ID,
    },
    notice_occurrence: predecessor.notice_occurrence,
    clock_interpretation: interpretation,
    notice_revision: revision,
    fallback_review_revision: predecessor.notice_revision,
    review_projection: {
      renderable: true,
      fallback_renderable: true,
      primary_receipt_interpretation_code: PRIMARY_RECEIPT_CODE,
      primary_clock_application_scope_code: PRIMARY_CLOCK_SCOPE,
      raw_duration: {
        magnitude:
          metricNormalisation?.raw_value.magnitude || '24',
        unit:
          metricNormalisation?.raw_value.unit || 'HOURS',
        day_basis:
          metricNormalisation?.raw_value.day_basis || 'ELAPSED',
      },
      canonical_duration: {
        magnitude: metricNormalisation?.canonical_value || '1',
        unit: metricNormalisation?.canonical_unit || 'DAYS',
        day_basis: metricNormalisation?.day_basis || 'ELAPSED',
      },
      basis_key:
        metricNormalisation?.basis_key
        || 'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
      normalisation_payload_digest:
        metricNormalisation?.normalisation_payload_digest || null,
      source_timing_claim_revision_id:
        F6_COPY_CLOCK_CLAIM_REVISION_ID,
      source_normalisation_payload_digest:
        F6_COPY_CLOCK_NORMALISATION_PAYLOAD_DIGEST,
      promptly_qualifier_visible: true,
      ambiguity_flag_visible: true,
      alternative_receipt_interpretation_code: ALTERNATIVE_RECEIPT_CODE,
      alternative_item_or_batch_cardinality_state: 'UNRESOLVED',
      copy_clock_state: revision
        ? 'RESOLVED_WITH_REVIEW_NOTE'
        : 'FALLBACK_TO_F14_BLOCKING_UNRESOLVED',
      market_comparison_state: 'BLOCKED_PENDING_GOVERNED_RELEASE',
    },
    status: {
      review_renderable: true,
      successor_materialised: revision !== null,
      failed_component_code: forcedFailure
        ? 'COPY_CLOCK_MATERIALISATION'
        : null,
      unaffected_child_keys: forcedFailure
        ? [
          'TRIGGER_EXPRESSION',
          'INITIAL_NOTICE_CLOCK_SCOPE',
          'DEFINITION_USES',
          'DEFINITION_DEPENDENCY',
          'DEFINITION_SCOPE',
        ]
        : [],
      notice_schema_version: 6,
      overall_resolution_state: revision
        ? 'RESOLVED_WITH_REVIEW_NOTE'
        : 'BLOCKING_UNRESOLVED',
      publication_blocked: true,
      comparison_blocked: true,
      materialisation_authority: revision
        ? 'REVIEW_IDENTITY_ONLY'
        : 'NONE',
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
      release_eligible: false,
      blocker_codes: revision
        ? []
        : [
          'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
          'COPY_CLOCK_MATERIALISATION_FAILED',
        ],
      review_note_codes: revision
        ? ['COPY_CLOCK_SOURCE_AMBIGUITY_RETAINED']
        : [],
    },
  };
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version !== 'QXO_NO_SHOP_COPY_CLOCK_F15/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F15 carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F15 carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_copy_clock_f15_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_copy_clock_f15_id !== contentId(
    'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_COPY_CLOCK_F15_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F15 carrier identity has drifted');
  }
  return true;
}

function buildCarrier(input, forcedFailure = null) {
  if (![null, 'COPY_CLOCK_MATERIALISATION'].includes(forcedFailure)) {
    fail('UNKNOWN_FORCED_FAILURE', 'the F15 failure probe is not governed');
  }
  const body = buildBody(input, forcedFailure);
  const carrier = freeze({
    ...body,
    qxo_no_shop_copy_clock_f15_id: contentId(
      'QXO_NO_SHOP_COPY_CLOCK_F15/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_COPY_CLOCK_F15_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateQxoNoShopCopyClockF15({
  qxo_no_shop_copy_clock_f15: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier) !== canonicalJson(buildCarrier(input))) {
    fail('CARRIER_DRIFT', 'the QXO F15 copy-clock carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  AUTHORITY_FIELDS,
  LAWYER_REVIEW_NOTE,
  MAX_CARRIER_BYTES,
  QxoNoShopCopyClockF15Error,
  buildQxoNoShopCopyClockF15: buildCarrier,
  buildQxoNoShopCopyClockF15FailureAttestation:
    (input) => buildCarrier(input, 'COPY_CLOCK_MATERIALISATION'),
  validateQxoNoShopCopyClockF15,
  validateQxoNoShopCopyClockF15CarrierIdentity: validateCarrierIdentity,
  __test: {
    buildCopyClockScope,
    buildInterpretation,
    buildScopeClosureId,
    validateScopeClosureIdentity,
    validateSuccessor,
  },
};
