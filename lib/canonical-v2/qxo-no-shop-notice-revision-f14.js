const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V10,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopNoticeReceiptF10CarrierIdentity,
} = require('./qxo-no-shop-notice-receipt-f10');
const {
  validateQxoNoShopDefinitionScopeClosureF13CarrierIdentity,
} = require('./qxo-no-shop-definition-scope-closure-f13');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_NOTICE_REVISION_F14_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const NOTICE_OCCURRENCE_ID =
  '397e3db47dc62bd3090809574a4d4f1978644fc9b0c121ac10c3b1d2d5e2ade5';
const F10_NOTICE_ID =
  '487585d4eb9331d2c18a356e5b2a354e0059c4c458173e96e450dfa7e6252fbf';
const F10_NOTICE_DIGEST =
  '54b0ccd025e9034dc6eb53a20b19bd3ae47ef775fa661de778e0aee1d1a56c25';
const F13_SCOPE_ID =
  'e28ca2587accf82d40b605909b8dce2881cea88f7a6c7f6fe73496c64f3a390a';
const F13_SCOPE_DIGEST =
  '16587bcd89e0eb56150a50ca91c28e9813296a10985452ed417610ab5cd291c6';
const NOTICE_SCHEMA_ID =
  'c7ee5b2e00a42c2c8bc50ecd7487630587e3e5ad7d9265159b0eea3b73763a48';
const NOTICE_SCHEMA_DIGEST =
  '35776fafc632f692e2e94df11250661ae54c9cfce87f1dec6a06d9faf875581e';
const MAX_CARRIER_BYTES = 256 * 1024;
const REMAINING_BLOCKER =
  'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED';

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_definition_scope_closure_f13',
  'qxo_no_shop_notice_receipt_f10',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'notice_occurrence',
  'notice_revision',
  'review_projection',
  'status',
  'qxo_no_shop_notice_revision_f14_id',
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

class QxoNoShopNoticeRevisionF14Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopNoticeRevisionF14Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopNoticeRevisionF14Error(code, message);
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

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F14 input is outside its contract');
  }
  const {
    contract_bundle: contractBundle,
    qxo_no_shop_definition_scope_closure_f13: scope,
    qxo_no_shop_notice_receipt_f10: notice,
  } = input;
  validateContractBundle(contractBundle);
  validateQxoNoShopNoticeReceiptF10CarrierIdentity(notice);
  validateQxoNoShopDefinitionScopeClosureF13CarrierIdentity(scope);

  const noticeSchema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V10
    || noticeSchema?.record_schema !== 'NO_SHOP_NOTICE_OBLIGATION/V5'
    || noticeSchema.semantic_schema_definition_id !== NOTICE_SCHEMA_ID
    || noticeSchema.semantic_schema_definition_payload_digest
      !== NOTICE_SCHEMA_DIGEST
    || canonicalJson([...noticeSchema.required_fields].sort())
      !== canonicalJson([...REVISION_FIELDS].sort())
    || noticeSchema.maximum_definition_use_relationships !== 64) {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen V10 contract is required');
  }
  if (notice.qxo_no_shop_notice_receipt_f10_id !== F10_NOTICE_ID
    || notice.canonical_payload_digest !== F10_NOTICE_DIGEST
    || scope.qxo_no_shop_definition_scope_closure_f13_id !== F13_SCOPE_ID
    || scope.canonical_payload_digest !== F13_SCOPE_DIGEST) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact reviewed F10 and F13 carriers are required');
  }
  if (notice.source_binding.document_hash !== DOCUMENT_HASH
    || scope.source_binding.document_hash !== DOCUMENT_HASH
    || canonicalJson(notice.source_binding)
      !== canonicalJson(scope.source_binding)
    || notice.notice_occurrence.notice_obligation_occurrence_id
      !== NOTICE_OCCURRENCE_ID
    || scope.definition_scope_closure.notice_obligation_occurrence_id
      !== NOTICE_OCCURRENCE_ID) {
    fail('SOURCE_BINDING_DRIFT', 'the exact admitted QXO notice occurrence is required');
  }
  if (scope.definition_scope_closure.fixed_point_state !== 'REACHED'
    || scope.definition_scope_closure.unresolved_outcome_count !== 0
    || scope.definition_scope_closure.resolution_state
      !== 'RESOLVED_WITH_REVIEW_NOTE'
    || scope.status.definition_relationship_count < 1
    || scope.definition_use_relationships.some(
      (relationship) => relationship.suppressed,
    )) {
    fail('DEFINITION_SCOPE_INCOMPLETE', 'the reviewed definition closure is incomplete');
  }
  if (canonicalJson(scope.definition_scope_closure.root_scope_span)
      !== canonicalJson(notice.notice_occurrence.exact_source_span)
    || scope.definition_scope_closure.review_note_outcome_count !== 11
    || scope.reviewed_terminal_outcomes.length !== 11
    || scope.reviewed_terminal_outcomes.some(
      (terminal) => terminal.compare_projection
        !== 'EXPLICITLY_NON_COMPARABLE',
    )) {
    fail('DEFINITION_SCOPE_BINDING_DRIFT', 'the closure no longer binds the exact reviewed notice scope');
  }
  if (notice.notice_revision.copy_clock_scope.resolution_state
      !== 'BLOCKING_UNRESOLVED'
    || notice.notice_revision.copy_clock_scope.item_or_batch_cardinality_state
      !== 'UNRESOLVED'
    || notice.status.blocker_codes.includes(REMAINING_BLOCKER) !== true) {
    fail('COPY_CLOCK_AUTHORITY_DRIFT', 'the unresolved copy-clock child must remain unchanged');
  }
  return noticeSchema;
}

function deriveChildResolutionStates(scope) {
  const definitionStates = new Map(
    scope.notice_child_state_projection.child_resolution_states.map(
      (entry) => [entry.child_key, entry.resolution_state],
    ),
  );
  const childResolutionStates = [
    ['TRIGGER_EXPRESSION', 'RESOLVED_CLEAR'],
    ['INITIAL_NOTICE_CLOCK_SCOPE', 'RESOLVED_CLEAR'],
    ['COPY_CLOCK_SCOPE', 'BLOCKING_UNRESOLVED'],
    ['DEFINITION_USES', definitionStates.get('DEFINITION_USES')],
    ['DEFINITION_DEPENDENCY', definitionStates.get('DEFINITION_DEPENDENCY')],
    ['DEFINITION_SCOPE', definitionStates.get('DEFINITION_SCOPE')],
  ].map(([child_key, resolution_state]) => ({
    child_key,
    resolution_state,
  }));
  if (childResolutionStates.some(
    (entry) => ![
      'RESOLVED_CLEAR',
      'RESOLVED_WITH_REVIEW_NOTE',
      'BLOCKING_UNRESOLVED',
    ].includes(entry.resolution_state),
  )) {
    fail('CHILD_STATE_DERIVATION_FAILED', 'a required notice child has no governed state');
  }
  return childResolutionStates;
}

function buildRevision(notice, scope) {
  const predecessor = notice.notice_revision;
  const sourceRelationshipIds =
    scope.definition_scope_closure.definition_use_relationship_ids;
  const definitionRelationshipIds = sortedUnique(sourceRelationshipIds);
  if (definitionRelationshipIds.length !== 30
    || definitionRelationshipIds.length
      !== scope.definition_use_relationships.length
    || canonicalJson(sourceRelationshipIds)
      !== canonicalJson(definitionRelationshipIds)) {
    fail('RELATIONSHIP_SET_MISMATCH', 'the closure relationship set is not exact');
  }
  if (predecessor.evidence_excerpt_ids.length > 32) {
    fail('NOTICE_EVIDENCE_BOUND_EXCEEDED', 'the direct notice evidence exceeds the frozen bound');
  }
  const scopeClosureId = contentId('QXO_NO_SHOP_NOTICE_SCOPE_F14/V1', {
    document_hash: DOCUMENT_HASH,
    notice_obligation_occurrence_id:
      predecessor.notice_obligation_occurrence_id,
    examined_source_span: notice.notice_occurrence.exact_source_span,
    evidence_excerpt_ids: predecessor.evidence_excerpt_ids,
    blocker_codes: [REMAINING_BLOCKER],
  });
  const identity = {
    notice_obligation_occurrence_id:
      predecessor.notice_obligation_occurrence_id,
    source_provision_instance_id: predecessor.source_provision_instance_id,
    obligated_party: predecessor.obligated_party,
    protected_party: predecessor.protected_party,
    trigger_codes: predecessor.trigger_codes,
    trigger_expression: predecessor.trigger_expression,
    initial_notice_clock_scope: predecessor.initial_notice_clock_scope,
    delivery_method_codes: predecessor.delivery_method_codes,
    content_requirement_codes: predecessor.content_requirement_codes,
    copy_clock_scope: predecessor.copy_clock_scope,
    copy_subject_codes: predecessor.copy_subject_codes,
    definition_use_relationship_ids: definitionRelationshipIds,
    evidence_excerpt_ids: predecessor.evidence_excerpt_ids,
    scope_closure_id: scopeClosureId,
    child_resolution_states: deriveChildResolutionStates(scope),
    definition_scope_closure_id:
      scope.definition_scope_closure.definition_scope_closure_id,
  };
  return freeze({
    schema_version: 'NO_SHOP_NOTICE_OBLIGATION/V5',
    notice_obligation_revision_id: contentId(
      'NO_SHOP_NOTICE_OBLIGATION/V5',
      identity,
    ),
    ...identity,
  });
}

function validateRevision(revision, noticeSchema, scope, notice) {
  if (!exactKeys(revision, [
    'schema_version',
    ...REVISION_FIELDS,
  ]) || revision.schema_version !== noticeSchema.record_schema) {
    fail('REVISION_CONTRACT_MISMATCH', 'the V5 notice revision shape is invalid');
  }
  const identity = { ...revision };
  delete identity.schema_version;
  delete identity.notice_obligation_revision_id;
  if (revision.notice_obligation_revision_id !== contentId(
    'NO_SHOP_NOTICE_OBLIGATION/V5',
    identity,
  )) {
    fail('REVISION_IDENTITY_MISMATCH', 'the V5 notice revision identity has drifted');
  }
  if (revision.definition_scope_closure_id
      !== scope.definition_scope_closure.definition_scope_closure_id
    || canonicalJson(revision.definition_use_relationship_ids)
      !== canonicalJson(sortedUnique(
        scope.definition_scope_closure.definition_use_relationship_ids,
      ))
    || revision.child_resolution_states.length !== 6
    || revision.child_resolution_states.filter(
      (entry) => entry.child_key === 'COPY_CLOCK_SCOPE'
        && entry.resolution_state === 'BLOCKING_UNRESOLVED',
    ).length !== 1) {
    fail('REVISION_CLOSURE_MISMATCH', 'the V5 revision does not bind the exact reviewed closure');
  }
  if (revision.scope_closure_id === notice.notice_revision.scope_closure_id
    || revision.scope_closure_id !== contentId(
      'QXO_NO_SHOP_NOTICE_SCOPE_F14/V1',
      {
        document_hash: DOCUMENT_HASH,
        notice_obligation_occurrence_id:
          revision.notice_obligation_occurrence_id,
        examined_source_span: notice.notice_occurrence.exact_source_span,
        evidence_excerpt_ids: notice.notice_revision.evidence_excerpt_ids,
        blocker_codes: [REMAINING_BLOCKER],
      },
    )
    || canonicalJson(revision.evidence_excerpt_ids)
      !== canonicalJson(notice.notice_revision.evidence_excerpt_ids)
    || revision.evidence_excerpt_ids.length > 32) {
    fail('REVISION_SCOPE_MISMATCH', 'the V5 revision retained a stale scope or exceeded its evidence bound');
  }
  return true;
}

function buildBody(input, forcedFailure) {
  const noticeSchema = validateInputs(input);
  const notice = input.qxo_no_shop_notice_receipt_f10;
  const scope = input.qxo_no_shop_definition_scope_closure_f13;
  const revision = forcedFailure === 'DEFINITION_RELATIONSHIP'
    ? null
    : buildRevision(notice, scope);
  if (revision) {
    validateRevision(revision, noticeSchema, scope, notice);
  }
  const blockerCodes = revision
    ? [REMAINING_BLOCKER]
    : [
      REMAINING_BLOCKER,
      'NOTICE_REVISION_MATERIALISATION_FAILED',
    ];
  return {
    schema_version: 'QXO_NO_SHOP_NOTICE_REVISION_F14/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_version: 5,
      notice_schema_definition_id:
        noticeSchema.semantic_schema_definition_id,
      notice_schema_definition_payload_digest:
        noticeSchema.semantic_schema_definition_payload_digest,
    },
    source_binding: notice.source_binding,
    upstream_bindings: {
      qxo_no_shop_notice_receipt_f10_id: F10_NOTICE_ID,
      qxo_no_shop_notice_receipt_f10_payload_digest: F10_NOTICE_DIGEST,
      qxo_no_shop_definition_scope_closure_f13_id: F13_SCOPE_ID,
      qxo_no_shop_definition_scope_closure_f13_payload_digest:
        F13_SCOPE_DIGEST,
    },
    notice_occurrence: notice.notice_occurrence,
    notice_revision: revision,
    review_projection: {
      renderable: true,
      primary_receipt_interpretation_code:
        notice.status.primary_receipt_interpretation_code,
      ambiguity_flag_visible: notice.status.ambiguity_flag_visible,
      definition_scope_state:
        scope.definition_scope_closure.resolution_state,
      reviewed_terminal_outcome_count:
        scope.definition_scope_closure.review_note_outcome_count,
      copy_clock_state: 'BLOCKING_UNRESOLVED',
      comparison_state: 'BLOCKED',
    },
    status: {
      review_renderable: true,
      revision_materialised: revision !== null,
      failed_component_code: forcedFailure
        ? 'DEFINITION_RELATIONSHIP_BINDING'
        : null,
      unaffected_child_keys: forcedFailure
        ? [
          'TRIGGER_EXPRESSION',
          'INITIAL_NOTICE_CLOCK_SCOPE',
          'COPY_CLOCK_SCOPE',
        ]
        : [],
      notice_schema_version: 5,
      overall_resolution_state: 'BLOCKING_UNRESOLVED',
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
      blocker_codes: blockerCodes,
    },
  };
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version !== 'QXO_NO_SHOP_NOTICE_REVISION_F14/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F14 carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F14 carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_notice_revision_f14_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_notice_revision_f14_id !== contentId(
    'QXO_NO_SHOP_NOTICE_REVISION_F14/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_NOTICE_REVISION_F14_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F14 carrier identity has drifted');
  }
  return true;
}

function buildCarrier(input, forcedFailure = null) {
  if (![null, 'DEFINITION_RELATIONSHIP'].includes(forcedFailure)) {
    fail('UNKNOWN_FORCED_FAILURE', 'the F14 failure probe is not governed');
  }
  const body = buildBody(input, forcedFailure);
  const carrier = freeze({
    ...body,
    qxo_no_shop_notice_revision_f14_id: contentId(
      'QXO_NO_SHOP_NOTICE_REVISION_F14/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_REVISION_F14_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateQxoNoShopNoticeRevisionF14({
  qxo_no_shop_notice_revision_f14: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier) !== canonicalJson(buildCarrier(input))) {
    fail('CARRIER_DRIFT', 'the QXO F14 notice revision carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  AUTHORITY_FIELDS,
  MAX_CARRIER_BYTES,
  REMAINING_BLOCKER,
  QxoNoShopNoticeRevisionF14Error,
  buildQxoNoShopNoticeRevisionF14: buildCarrier,
  buildQxoNoShopNoticeRevisionF14FailureAttestation:
    (input) => buildCarrier(input, 'DEFINITION_RELATIONSHIP'),
  validateQxoNoShopNoticeRevisionF14,
  validateQxoNoShopNoticeRevisionF14CarrierIdentity:
    validateCarrierIdentity,
  __test: {
    deriveChildResolutionStates,
    validateRevision,
  },
};
