'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const RECONSTRUCTED_REFERENCE_SCHEMA = 'V1_RECONSTRUCTED_RENDERER_REFERENCE_PROPOSAL/V1';
const RECONSTRUCTED_REFERENCE_ROOT_DOMAIN = 'V1_RECONSTRUCTED_RENDERER_REFERENCE_ROOTS/V1';
const FROZEN_PLAN_SCHEMA = 'V1_TRUSTED_CAPTURE_FROZEN_PLAN/V3';
const CAPTURE_PREFLIGHT_SCHEMA = 'V1_TRUSTED_CAPTURE_PREFLIGHT/V2';
const CAPTURE_APPROVAL_REQUEST_SCHEMA = 'V1_TRUSTED_CAPTURE_APPROVAL_REQUEST/V1';
const WORKER_REGISTRATION_SCHEMA = 'V1_TRUSTED_CAPTURE_WORKER_REGISTRATION/V1';
const SIGNED_RUN_HEAD_SCHEMA = 'V1_TRUSTED_CAPTURE_SIGNED_RUN_HEAD/V1';
const SIGNED_RUN_EVENT_SCHEMA = 'V1_TRUSTED_CAPTURE_SIGNED_RUN_EVENT/V1';
const SLOT_SCHEMA = 'V1_TRUSTED_CAPTURE_SLOT/V1';
const ONE_USE_ATTEMPT_DOMAIN = 'V1_TRUSTED_CAPTURE_ONE_USE_ATTEMPT/V1';
const SLOT_COUNT = 40 * 19;
const ROSTER_SIZE = 40;
const TABLE_CONFIG_COUNT = 19;
const REGISTRY_AMENDMENT_REQUIRED = 'REGISTRY_AMENDMENT_REQUIRED';
const SIGNATURE_STATE = 'UNVERIFIED_REGISTRY_AMENDMENT_REQUIRED';
const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const ISO_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const CLOSED_EVENT_TYPES = Object.freeze([
  'PREFLIGHT_BOUND',
  'CAPTURE_REQUESTED',
  'BLOCKED_REGISTRY_AMENDMENT',
  'CLOSED_WITHOUT_EXECUTION',
]);
const RECONSTRUCTED_REFERENCE = Object.freeze({
  reference_label: 'RECONSTRUCTED_V1_REFERENCE',
  git_commit_id: '484c40a9515366d8efbfdcc72b71aaaa3aafe6e0',
  git_tree_id: '568b4a7b7968330abc8ebff25b9d0f39749da058',
  truth_state: 'RECONSTRUCTED_REFERENCE_NOT_LIVE_PRODUCTION_TRUTH',
  renderer_dependency_closure_roots: Object.freeze({
    review_root_path: 'pages/review-v1/[id].js',
    review_root_sha256: '8c3d31e617e57dcd182b2a79f4b790d8133f21d4cd4026b0ed02ab619c9587f1',
    dependency_lock_path: 'package-lock.json',
    dependency_lock_sha256: '9e4683566c1b693e7bd2842173020127b97b5f78abcac91eb8b2dbf662d1884a',
    roster_path: 'lib/generated/home-deal-directory-v1.json',
    roster_sha256: '3b5301c70b8f2fe9d1a4db7a141a8e8d28d375146e7fb46e98cc789ed7c3a712',
  }),
});

class V1TrustedCaptureControlContractsError extends Error {
  constructor(code, message) { super(message); this.name = 'V1TrustedCaptureControlContractsError'; this.code = code; }
}

function fail(code, message) { throw new V1TrustedCaptureControlContractsError(code, message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function exactKeys(value, keys, label) {
  if (!plain(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail('EXACT_KEY_SET_REQUIRED', `${label} has unsupported or missing fields.`);
}
function requireDigest(value, label) { if (typeof value !== 'string' || !SHA256_RE.test(value)) fail('DIGEST_INVALID', `${label} must be a SHA-256 digest.`); }
function requireNonce(value, label) { if (typeof value !== 'string' || !NONCE_RE.test(value)) fail('NONCE_INVALID', `${label} must be a bounded opaque nonce.`); }
function requireId(value, label) { requireDigest(value, label); }
function requireIsoTime(value, label) { if (typeof value !== 'string' || !ISO_TIME_RE.test(value) || Number.isNaN(Date.parse(value))) fail('TIME_INVALID', `${label} must be a canonical ISO UTC timestamp.`); }
function cloneFreeze(value) { return Object.freeze(structuredClone(value)); }

function validatePinnedTree(value) {
  exactKeys(value, ['commit', 'checkout_tree_sha256', 'status_porcelain'], 'Pinned tree');
  if (typeof value.commit !== 'string' || !COMMIT_RE.test(value.commit)) fail('PINNED_TREE_COMMIT_INVALID', 'Pinned tree commit must be a full Git commit identifier.');
  requireDigest(value.checkout_tree_sha256, 'Pinned checkout tree digest');
  if (value.status_porcelain !== '') fail('PINNED_TREE_DIRTY', 'A trusted-capture proposal requires a clean pinned tree.');
  return true;
}

function reconstructedReferenceRootsId(roots) {
  return contentId(RECONSTRUCTED_REFERENCE_ROOT_DOMAIN, roots);
}

function validateReconstructedReference(value) {
  exactKeys(value, [
    'authority', 'git_commit_id', 'git_tree_id', 'reconstructed_reference_id', 'reference_label',
    'renderer_dependency_closure_roots', 'renderer_dependency_closure_roots_id', 'schema_version', 'state', 'truth_state',
  ], 'Reconstructed V1 reference');
  if (value.schema_version !== RECONSTRUCTED_REFERENCE_SCHEMA || value.state !== 'PROPOSAL_ONLY_REFERENCE_PENDING_BEN_APPROVAL'
    || value.authority !== 'NONE' || value.reference_label !== RECONSTRUCTED_REFERENCE.reference_label
    || value.git_commit_id !== RECONSTRUCTED_REFERENCE.git_commit_id || value.git_tree_id !== RECONSTRUCTED_REFERENCE.git_tree_id
    || value.truth_state !== RECONSTRUCTED_REFERENCE.truth_state
    || !same(value.renderer_dependency_closure_roots, RECONSTRUCTED_REFERENCE.renderer_dependency_closure_roots)
    || value.renderer_dependency_closure_roots_id !== reconstructedReferenceRootsId(value.renderer_dependency_closure_roots)) {
    fail('RECONSTRUCTED_REFERENCE_INVALID', 'Reconstructed V1 reference must retain its exact Git identifiers, SHA-256 roots, and non-live truth label.');
  }
  const { reconstructed_reference_id: identifier, ...body } = value;
  if (identifier !== contentId(RECONSTRUCTED_REFERENCE_SCHEMA, body)) fail('RECONSTRUCTED_REFERENCE_ID_INVALID', 'Reconstructed V1 reference identity is invalid.');
  return cloneFreeze(value);
}

function buildReconstructedReferenceProposal() {
  const body = {
    schema_version: RECONSTRUCTED_REFERENCE_SCHEMA,
    state: 'PROPOSAL_ONLY_REFERENCE_PENDING_BEN_APPROVAL',
    authority: 'NONE',
    ...RECONSTRUCTED_REFERENCE,
    renderer_dependency_closure_roots: structuredClone(RECONSTRUCTED_REFERENCE.renderer_dependency_closure_roots),
    renderer_dependency_closure_roots_id: reconstructedReferenceRootsId(RECONSTRUCTED_REFERENCE.renderer_dependency_closure_roots),
  };
  return validateReconstructedReference({ ...body, reconstructed_reference_id: contentId(RECONSTRUCTED_REFERENCE_SCHEMA, body) });
}

function validateRoster(value) {
  if (!Array.isArray(value) || value.length !== ROSTER_SIZE || value.some((dealId) => typeof dealId !== 'string' || !UUID_RE.test(dealId)) || new Set(value).size !== ROSTER_SIZE) {
    fail('ROSTER_INVALID', 'The frozen plan requires exactly 40 unique deal UUIDs.');
  }
}

function validateTableConfigOrder(value) {
  if (!Array.isArray(value) || value.length !== TABLE_CONFIG_COUNT || value.some((tableId) => typeof tableId !== 'string' || !/^[A-Z][A-Z0-9_]{1,127}$/.test(tableId)) || new Set(value).size !== TABLE_CONFIG_COUNT) {
    fail('TABLE_CONFIG_ORDER_INVALID', 'The frozen plan requires exactly 19 unique table configuration identifiers.');
  }
}

function expectedSlots(roster, tableConfigOrder) {
  return roster.flatMap((dealId) => tableConfigOrder.map((tableId, configIndex) => {
    const body = { schema_version: SLOT_SCHEMA, deal_id: dealId, config_index: configIndex, table_id: tableId };
    return Object.freeze({ ...body, slot_id: contentId(SLOT_SCHEMA, body) });
  }));
}

function validateSlots(value, roster, tableConfigOrder) {
  const expected = expectedSlots(roster, tableConfigOrder);
  if (!Array.isArray(value) || value.length !== SLOT_COUNT || !same(value, expected)) {
    fail('CAPTURE_SLOT_ENUMERATION_INVALID', 'The frozen plan must enumerate every one of the 40 by 19 capture slots in canonical order.');
  }
  return expected;
}

function validateFrozenPlan(value) {
  exactKeys(value, [
    'authority', 'capture_slots', 'frozen_plan_id', 'pinned_tree', 'roster', 'schema_version',
    'reconstructed_reference', 'source_acquisition_plan_id', 'state', 'table_config_order',
  ], 'Frozen capture plan');
  if (value.schema_version !== FROZEN_PLAN_SCHEMA || value.state !== 'FROZEN_PROPOSAL' || value.authority !== 'NONE') {
    fail('FROZEN_PLAN_STATE_INVALID', 'Frozen capture plan must remain a proposal with no authority.');
  }
  requireId(value.source_acquisition_plan_id, 'Source acquisition plan ID');
  const reference = validateReconstructedReference(value.reconstructed_reference);
  validatePinnedTree(value.pinned_tree); validateRoster(value.roster); validateTableConfigOrder(value.table_config_order);
  if (value.pinned_tree.commit !== reference.git_commit_id) fail('PINNED_TREE_REFERENCE_MISMATCH', 'Pinned capture tree must use the reconstructed reference commit, not its Git tree identifier.');
  validateSlots(value.capture_slots, value.roster, value.table_config_order);
  const { frozen_plan_id: identifier, ...body } = value;
  if (identifier !== contentId(FROZEN_PLAN_SCHEMA, body)) fail('FROZEN_PLAN_ID_INVALID', 'Frozen plan content identifier is invalid.');
  return cloneFreeze(value);
}

function buildFrozenPlan(input) {
  exactKeys(input, ['pinned_tree', 'reconstructed_reference', 'roster', 'source_acquisition_plan_id', 'table_config_order'], 'Frozen plan input');
  const reference = validateReconstructedReference(input.reconstructed_reference);
  validatePinnedTree(input.pinned_tree); validateRoster(input.roster); validateTableConfigOrder(input.table_config_order); requireId(input.source_acquisition_plan_id, 'Source acquisition plan ID');
  if (input.pinned_tree.commit !== reference.git_commit_id) fail('PINNED_TREE_REFERENCE_MISMATCH', 'Frozen plan must pin the reconstructed reference commit.');
  const body = {
    schema_version: FROZEN_PLAN_SCHEMA,
    state: 'FROZEN_PROPOSAL',
    authority: 'NONE',
    source_acquisition_plan_id: input.source_acquisition_plan_id,
    reconstructed_reference: structuredClone(reference),
    pinned_tree: structuredClone(input.pinned_tree),
    roster: [...input.roster],
    table_config_order: [...input.table_config_order],
    capture_slots: expectedSlots(input.roster, input.table_config_order),
  };
  return validateFrozenPlan({ ...body, frozen_plan_id: contentId(FROZEN_PLAN_SCHEMA, body) });
}

function validatePreflight(value, frozenPlan) {
  validateFrozenPlan(frozenPlan);
  exactKeys(value, [
    'capture_slot_ids', 'database_access', 'execution_authority', 'frozen_plan_id', 'network_access',
    'pinned_tree', 'preflight_id', 'reconstructed_reference_id', 'schema_version', 'state',
  ], 'Capture preflight');
  if (value.schema_version !== CAPTURE_PREFLIGHT_SCHEMA || value.state !== 'PREFLIGHT_PROPOSAL'
    || value.execution_authority !== 'NONE' || value.network_access !== 'NONE' || value.database_access !== 'NONE') {
    fail('PREFLIGHT_STATE_INVALID', 'Capture preflight cannot authorise execution, network, or database access.');
  }
  if (value.frozen_plan_id !== frozenPlan.frozen_plan_id || value.reconstructed_reference_id !== frozenPlan.reconstructed_reference.reconstructed_reference_id || !same(value.pinned_tree, frozenPlan.pinned_tree)
    || !same(value.capture_slot_ids, frozenPlan.capture_slots.map((slot) => slot.slot_id))) {
    fail('PREFLIGHT_FROZEN_PLAN_BINDING_INVALID', 'Capture preflight must bind the exact frozen plan, clean tree, and complete slots.');
  }
  validatePinnedTree(value.pinned_tree);
  const { preflight_id: identifier, ...body } = value;
  if (identifier !== contentId(CAPTURE_PREFLIGHT_SCHEMA, body)) fail('PREFLIGHT_ID_INVALID', 'Capture preflight content identifier is invalid.');
  return cloneFreeze(value);
}

function buildCapturePreflight({ frozen_plan: frozenPlan } = {}) {
  validateFrozenPlan(frozenPlan);
  const body = {
    schema_version: CAPTURE_PREFLIGHT_SCHEMA,
    state: 'PREFLIGHT_PROPOSAL',
    execution_authority: 'NONE',
    network_access: 'NONE',
    database_access: 'NONE',
    frozen_plan_id: frozenPlan.frozen_plan_id,
    reconstructed_reference_id: frozenPlan.reconstructed_reference.reconstructed_reference_id,
    pinned_tree: structuredClone(frozenPlan.pinned_tree),
    capture_slot_ids: frozenPlan.capture_slots.map((slot) => slot.slot_id),
  };
  return validatePreflight({ ...body, preflight_id: contentId(CAPTURE_PREFLIGHT_SCHEMA, body) }, frozenPlan);
}

function validateCaptureApprovalRequest(value, { frozen_plan: frozenPlan, preflight, at_time: atTime } = {}) {
  validateFrozenPlan(frozenPlan); validatePreflight(preflight, frozenPlan);
  exactKeys(value, [
    'approval_authority', 'approval_expires_at', 'approval_issued_at', 'approval_request_id', 'approval_signature',
    'capture_attempt_id', 'consumption_authority', 'consumption_receipt_id', 'consumption_state', 'frozen_plan_id',
    'one_use_nonce', 'predecessor_consumption_id', 'predecessor_request_id', 'preflight_id', 'reconstructed_reference_id',
    'request_generation', 'request_nonce', 'schema_version', 'state',
  ], 'Capture approval request');
  if (value.schema_version !== CAPTURE_APPROVAL_REQUEST_SCHEMA || value.state !== 'REQUESTED_REGISTRY_AMENDMENT_REQUIRED'
    || value.approval_authority !== 'NONE' || value.approval_signature !== null
    || value.consumption_authority !== 'NONE' || value.consumption_state !== 'UNCONSUMED_PROPOSAL_ONLY'
    || value.consumption_receipt_id !== null || value.predecessor_consumption_id !== 'NONE') {
    fail('APPROVAL_REQUEST_STATE_INVALID', 'Capture approval remains an unsigned request pending a registry amendment.');
  }
  if (value.frozen_plan_id !== frozenPlan.frozen_plan_id || value.preflight_id !== preflight.preflight_id
    || value.reconstructed_reference_id !== frozenPlan.reconstructed_reference.reconstructed_reference_id
    || value.request_generation !== 1 || value.predecessor_request_id !== 'NONE') {
    fail('APPROVAL_REQUEST_LINEAGE_INVALID', 'Initial capture approval request must be generation one with no predecessor.');
  }
  requireNonce(value.request_nonce, 'Approval request nonce'); requireNonce(value.one_use_nonce, 'One-use nonce');
  if (value.request_nonce === value.one_use_nonce) fail('APPROVAL_NONCE_REUSE_INVALID', 'Approval and one-use nonces must be distinct.');
  requireIsoTime(value.approval_issued_at, 'Approval issued at'); requireIsoTime(value.approval_expires_at, 'Approval expires at');
  if (Date.parse(value.approval_expires_at) <= Date.parse(value.approval_issued_at)) fail('APPROVAL_EXPIRY_INVALID', 'Capture approval expiry must be after its issuance time.');
  if (atTime !== undefined) {
    requireIsoTime(atTime, 'Approval validation time');
    if (Date.parse(atTime) >= Date.parse(value.approval_expires_at)) fail('APPROVAL_EXPIRED', 'Capture approval proposal has expired and cannot be consumed.');
  }
  const expectedAttempt = contentId(ONE_USE_ATTEMPT_DOMAIN, {
    frozen_plan_id: value.frozen_plan_id, preflight_id: value.preflight_id,
    reconstructed_reference_id: value.reconstructed_reference_id, one_use_nonce: value.one_use_nonce,
    approval_expires_at: value.approval_expires_at, predecessor_consumption_id: value.predecessor_consumption_id,
  });
  if (value.capture_attempt_id !== expectedAttempt) fail('CAPTURE_ATTEMPT_ID_INVALID', 'One-use capture attempt identity must bind its exact nonce, expiry, reference, and predecessor state.');
  const { approval_request_id: identifier, ...body } = value;
  if (identifier !== contentId(CAPTURE_APPROVAL_REQUEST_SCHEMA, body)) fail('APPROVAL_REQUEST_ID_INVALID', 'Capture approval request content identifier is invalid.');
  return cloneFreeze(value);
}

function buildCaptureApprovalRequest({ frozen_plan: frozenPlan, preflight, request_nonce: requestNonce, one_use_nonce: oneUseNonce, approval_issued_at: issuedAt, approval_expires_at: expiresAt } = {}) {
  const reconstructedReferenceId = frozenPlan?.reconstructed_reference?.reconstructed_reference_id;
  const captureAttemptId = contentId(ONE_USE_ATTEMPT_DOMAIN, {
    frozen_plan_id: frozenPlan?.frozen_plan_id, preflight_id: preflight?.preflight_id,
    reconstructed_reference_id: reconstructedReferenceId, one_use_nonce: oneUseNonce,
    approval_expires_at: expiresAt, predecessor_consumption_id: 'NONE',
  });
  const body = {
    schema_version: CAPTURE_APPROVAL_REQUEST_SCHEMA,
    state: 'REQUESTED_REGISTRY_AMENDMENT_REQUIRED',
    approval_authority: 'NONE',
    approval_signature: null,
    approval_issued_at: issuedAt,
    approval_expires_at: expiresAt,
    frozen_plan_id: frozenPlan?.frozen_plan_id,
    preflight_id: preflight?.preflight_id,
    reconstructed_reference_id: reconstructedReferenceId,
    request_generation: 1,
    predecessor_request_id: 'NONE',
    request_nonce: requestNonce,
    one_use_nonce: oneUseNonce,
    capture_attempt_id: captureAttemptId,
    consumption_state: 'UNCONSUMED_PROPOSAL_ONLY',
    consumption_authority: 'NONE',
    consumption_receipt_id: null,
    predecessor_consumption_id: 'NONE',
  };
  return validateCaptureApprovalRequest({ ...body, approval_request_id: contentId(CAPTURE_APPROVAL_REQUEST_SCHEMA, body) }, { frozen_plan: frozenPlan, preflight });
}

function validateWorkerRegistration(value, { frozen_plan: frozenPlan, preflight, approval_request: approvalRequest } = {}) {
  validateCaptureApprovalRequest(approvalRequest, { frozen_plan: frozenPlan, preflight });
  exactKeys(value, [
    'approval_request_id', 'key_origin', 'registration_id', 'registration_state', 'signature', 'signature_state',
    'trusted_key_material', 'worker_id', 'worker_key_id', 'schema_version',
  ], 'Worker registration');
  if (value.schema_version !== WORKER_REGISTRATION_SCHEMA || value.approval_request_id !== approvalRequest.approval_request_id
    || value.registration_state !== 'PROPOSED_PENDING_REGISTRY_AMENDMENT' || value.key_origin !== 'EXTERNAL_TRUST_REGISTRY_REQUIRED'
    || value.signature !== null || value.signature_state !== SIGNATURE_STATE || value.trusted_key_material !== null) {
    fail('WORKER_REGISTRATION_TRUST_INVALID', 'Worker registration cannot create, self-attest, or verify a trusted key before a registry amendment.');
  }
  if (typeof value.worker_id !== 'string' || !/^[a-z][a-z0-9-]{2,63}$/.test(value.worker_id)
    || typeof value.worker_key_id !== 'string' || !/^external-registry:[A-Za-z0-9._:-]{3,127}$/.test(value.worker_key_id)) {
    fail('WORKER_REGISTRATION_IDENTITY_INVALID', 'Worker registration identifiers are invalid.');
  }
  const { registration_id: identifier, ...body } = value;
  if (identifier !== contentId(WORKER_REGISTRATION_SCHEMA, body)) fail('WORKER_REGISTRATION_ID_INVALID', 'Worker registration content identifier is invalid.');
  return cloneFreeze(value);
}

function buildWorkerRegistration({ frozen_plan: frozenPlan, preflight, approval_request: approvalRequest, worker_id: workerId, worker_key_id: workerKeyId } = {}) {
  const body = {
    schema_version: WORKER_REGISTRATION_SCHEMA,
    approval_request_id: approvalRequest?.approval_request_id,
    worker_id: workerId,
    worker_key_id: workerKeyId,
    key_origin: 'EXTERNAL_TRUST_REGISTRY_REQUIRED',
    trusted_key_material: null,
    registration_state: 'PROPOSED_PENDING_REGISTRY_AMENDMENT',
    signature_state: SIGNATURE_STATE,
    signature: null,
  };
  return validateWorkerRegistration({ ...body, registration_id: contentId(WORKER_REGISTRATION_SCHEMA, body) }, {
    frozen_plan: frozenPlan, preflight, approval_request: approvalRequest,
  });
}

function validateSignedRunHead(value, { frozen_plan: frozenPlan, preflight, approval_request: approvalRequest, worker_registration: workerRegistration } = {}) {
  validateFrozenPlan(frozenPlan); validatePreflight(preflight, frozenPlan);
  validateCaptureApprovalRequest(approvalRequest, { frozen_plan: frozenPlan, preflight });
  validateWorkerRegistration(workerRegistration, {
    frozen_plan: frozenPlan, preflight, approval_request: approvalRequest,
  });
  exactKeys(value, [
    'approval_request_id', 'frozen_plan_id', 'generation', 'predecessor_head_id', 'preflight_id', 'run_head_id',
    'run_id', 'run_nonce', 'schema_version', 'signature', 'signature_state', 'state', 'terminal_state', 'worker_registration_id',
  ], 'Signed run head');
  if (value.schema_version !== SIGNED_RUN_HEAD_SCHEMA || value.state !== 'NOT_STARTED'
    || value.terminal_state !== 'NONE' || value.signature !== null || value.signature_state !== SIGNATURE_STATE
    || value.generation !== 0 || value.predecessor_head_id !== 'NONE') {
    fail('RUN_HEAD_STATE_INVALID', 'Run head remains unsigned, generation zero, and not started pending a registry amendment.');
  }
  if (typeof value.run_id !== 'string' || !/^v1-capture-[a-z0-9-]{3,96}$/.test(value.run_id)) fail('RUN_ID_INVALID', 'Run identifier is invalid.');
  requireNonce(value.run_nonce, 'Run nonce');
  if (value.frozen_plan_id !== frozenPlan.frozen_plan_id || value.preflight_id !== preflight.preflight_id
    || value.approval_request_id !== approvalRequest.approval_request_id || value.worker_registration_id !== workerRegistration.registration_id) {
    fail('RUN_HEAD_BINDING_INVALID', 'Run head must bind the exact proposal chain.');
  }
  const { run_head_id: identifier, ...body } = value;
  if (identifier !== contentId(SIGNED_RUN_HEAD_SCHEMA, body)) fail('RUN_HEAD_ID_INVALID', 'Run head content identifier is invalid.');
  return cloneFreeze(value);
}

function buildSignedRunHead({ frozen_plan: frozenPlan, preflight, approval_request: approvalRequest, worker_registration: workerRegistration, run_id: runId, run_nonce: runNonce } = {}) {
  const body = {
    schema_version: SIGNED_RUN_HEAD_SCHEMA,
    state: 'NOT_STARTED', terminal_state: 'NONE', generation: 0, predecessor_head_id: 'NONE',
    frozen_plan_id: frozenPlan?.frozen_plan_id, preflight_id: preflight?.preflight_id,
    approval_request_id: approvalRequest?.approval_request_id, worker_registration_id: workerRegistration?.registration_id,
    run_id: runId, run_nonce: runNonce, signature_state: SIGNATURE_STATE, signature: null,
  };
  return validateSignedRunHead({ ...body, run_head_id: contentId(SIGNED_RUN_HEAD_SCHEMA, body) }, {
    frozen_plan: frozenPlan, preflight, approval_request: approvalRequest, worker_registration: workerRegistration,
  });
}

function validateSignedRunEvent(value, runHead) {
  if (!runHead || !plain(runHead)) fail('RUN_HEAD_REQUIRED', 'A signed run head is required.');
  exactKeys(value, [
    'event_id', 'event_nonce', 'event_type', 'generation', 'predecessor_event_id', 'run_head_id',
    'schema_version', 'signature', 'signature_state', 'state',
  ], 'Signed run event');
  if (value.schema_version !== SIGNED_RUN_EVENT_SCHEMA || value.state !== 'PROPOSED_UNVERIFIED'
    || !CLOSED_EVENT_TYPES.includes(value.event_type) || value.signature !== null || value.signature_state !== SIGNATURE_STATE
    || value.run_head_id !== runHead.run_head_id || !Number.isInteger(value.generation) || value.generation < 1) {
    fail('RUN_EVENT_STATE_INVALID', 'Run event is not a closed unsigned proposal event.');
  }
  requireNonce(value.event_nonce, 'Run event nonce');
  if (value.generation === 1 && value.predecessor_event_id !== runHead.run_head_id) fail('RUN_EVENT_PREDECESSOR_INVALID', 'First run event must follow the run head.');
  if (value.generation > 1) requireId(value.predecessor_event_id, 'Run event predecessor ID');
  const { event_id: identifier, ...body } = value;
  if (identifier !== contentId(SIGNED_RUN_EVENT_SCHEMA, body)) fail('RUN_EVENT_ID_INVALID', 'Run event content identifier is invalid.');
  return cloneFreeze(value);
}

function buildSignedRunEvent({ run_head: runHead, generation, predecessor_event_id: predecessorEventId, event_type: eventType, event_nonce: eventNonce } = {}) {
  const body = {
    schema_version: SIGNED_RUN_EVENT_SCHEMA, run_head_id: runHead?.run_head_id, generation,
    predecessor_event_id: predecessorEventId, event_type: eventType, event_nonce: eventNonce,
    state: 'PROPOSED_UNVERIFIED', signature_state: SIGNATURE_STATE, signature: null,
  };
  return validateSignedRunEvent({ ...body, event_id: contentId(SIGNED_RUN_EVENT_SCHEMA, body) }, runHead);
}

function validateSignedRunLifecycle({ frozen_plan: frozenPlan, preflight, approval_request: approvalRequest, worker_registration: workerRegistration, run_head: runHead, events } = {}) {
  if (!Array.isArray(events)) fail('RUN_EVENTS_REQUIRED', 'Run lifecycle events must be an array.');
  const head = validateSignedRunHead(runHead, {
    frozen_plan: frozenPlan, preflight, approval_request: approvalRequest, worker_registration: workerRegistration,
  });
  const nonces = new Set([head.run_nonce]);
  let predecessor = head.run_head_id;
  for (const [index, event] of events.entries()) {
    validateSignedRunEvent(event, head);
    if (event.generation !== index + 1 || event.predecessor_event_id !== predecessor) {
      fail('RUN_EVENT_GENERATION_NOT_MONOTONIC', 'Run events must have contiguous generations and exact predecessor linkage.');
    }
    if (nonces.has(event.event_nonce)) fail('RUN_EVENT_NONCE_REUSED', 'Run head and events cannot reuse a nonce.');
    nonces.add(event.event_nonce); predecessor = event.event_id;
  }
  return cloneFreeze({ run_head: head, events: structuredClone(events), lifecycle_state: events.length === 0 ? 'OPEN' : 'BLOCKED_REGISTRY_AMENDMENT' });
}

function requireRegistryAmendmentForTrustedAction() {
  fail(REGISTRY_AMENDMENT_REQUIRED, 'Trusted approval, worker registration, and signed event verification are blocked pending a registry amendment.');
}

module.exports = {
  CAPTURE_APPROVAL_REQUEST_SCHEMA, CAPTURE_PREFLIGHT_SCHEMA, CLOSED_EVENT_TYPES, FROZEN_PLAN_SCHEMA,
  ONE_USE_ATTEMPT_DOMAIN, RECONSTRUCTED_REFERENCE, RECONSTRUCTED_REFERENCE_ROOT_DOMAIN, RECONSTRUCTED_REFERENCE_SCHEMA,
  REGISTRY_AMENDMENT_REQUIRED, ROSTER_SIZE, SIGNATURE_STATE, SIGNED_RUN_EVENT_SCHEMA, SIGNED_RUN_HEAD_SCHEMA,
  SLOT_COUNT, SLOT_SCHEMA, TABLE_CONFIG_COUNT, WORKER_REGISTRATION_SCHEMA, V1TrustedCaptureControlContractsError,
  buildCaptureApprovalRequest, buildCapturePreflight, buildFrozenPlan, buildReconstructedReferenceProposal, buildSignedRunEvent, buildSignedRunHead,
  buildWorkerRegistration, expectedSlots, requireRegistryAmendmentForTrustedAction, validateCaptureApprovalRequest,
  validateFrozenPlan, validatePinnedTree, validatePreflight, validateReconstructedReference, validateSignedRunEvent, validateSignedRunHead,
  validateSignedRunLifecycle, validateWorkerRegistration,
};
