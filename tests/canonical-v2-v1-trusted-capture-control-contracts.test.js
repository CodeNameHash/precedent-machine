'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contracts = require('../lib/canonical-v2/v1-trusted-capture-control-contracts');

const ROOT = path.resolve(__dirname, '..');
const digest = (character) => character.repeat(64);
const roster = Object.freeze(Array.from({ length: 40 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`));
const tables = Object.freeze(Array.from({ length: 19 }, (_, index) => `TABLE_${String(index + 1).padStart(2, '0')}`));

function chain() {
  const reconstructedReference = contracts.buildReconstructedReferenceProposal();
  const frozenPlan = contracts.buildFrozenPlan({
    source_acquisition_plan_id: digest('1'), reconstructed_reference: reconstructedReference,
    pinned_tree: { commit: reconstructedReference.git_commit_id, checkout_tree_sha256: digest('2'), status_porcelain: '' }, roster, table_config_order: tables,
  });
  const preflight = contracts.buildCapturePreflight({ frozen_plan: frozenPlan });
  const approval = contracts.buildCaptureApprovalRequest({
    frozen_plan: frozenPlan, preflight, request_nonce: 'approval-nonce-0001', one_use_nonce: 'one-use-nonce-0001',
    approval_issued_at: '2026-08-04T00:00:00.000Z', approval_expires_at: '2026-08-04T01:00:00.000Z',
  });
  const worker = contracts.buildWorkerRegistration({ frozen_plan: frozenPlan, preflight, approval_request: approval, worker_id: 'capture-worker-01', worker_key_id: 'external-registry:pending-key-01' });
  const head = contracts.buildSignedRunHead({ frozen_plan: frozenPlan, preflight, approval_request: approval, worker_registration: worker, run_id: 'v1-capture-pilot-01', run_nonce: 'run-head-nonce-0001' });
  return { frozenPlan, preflight, approval, worker, head };
}

test('builds all five proposal-only trusted capture control shapes with the complete 40 by 19 slot set', () => {
  const { frozenPlan, preflight, approval, worker, head } = chain();
  assert.equal(frozenPlan.capture_slots.length, 760);
  assert.equal(contracts.SLOT_COUNT, 760);
  assert.equal(frozenPlan.authority, 'NONE');
  assert.equal(frozenPlan.reconstructed_reference.reference_label, 'RECONSTRUCTED_V1_REFERENCE');
  assert.equal(frozenPlan.reconstructed_reference.git_commit_id, '484c40a9515366d8efbfdcc72b71aaaa3aafe6e0');
  assert.match(frozenPlan.reconstructed_reference.git_tree_id, /^[a-f0-9]{40}$/);
  assert.equal(frozenPlan.reconstructed_reference.truth_state, 'RECONSTRUCTED_REFERENCE_NOT_LIVE_PRODUCTION_TRUTH');
  assert.match(frozenPlan.reconstructed_reference.renderer_dependency_closure_roots.review_root_sha256, /^[a-f0-9]{64}$/);
  assert.match(frozenPlan.pinned_tree.checkout_tree_sha256, /^[a-f0-9]{64}$/);
  assert.equal(preflight.network_access, 'NONE');
  assert.equal(preflight.database_access, 'NONE');
  assert.equal(approval.approval_signature, null);
  assert.equal(approval.consumption_state, 'UNCONSUMED_PROPOSAL_ONLY');
  assert.equal(approval.consumption_receipt_id, null);
  assert.equal(approval.predecessor_consumption_id, 'NONE');
  assert.equal(worker.trusted_key_material, null);
  assert.equal(head.signature, null);
  const first = contracts.buildSignedRunEvent({ run_head: head, generation: 1, predecessor_event_id: head.run_head_id, event_type: 'PREFLIGHT_BOUND', event_nonce: 'event-nonce-0001' });
  const second = contracts.buildSignedRunEvent({ run_head: head, generation: 2, predecessor_event_id: first.event_id, event_type: 'BLOCKED_REGISTRY_AMENDMENT', event_nonce: 'event-nonce-0002' });
  const lifecycle = contracts.validateSignedRunLifecycle({ frozen_plan: frozenPlan, preflight, approval_request: approval, worker_registration: worker, run_head: head, events: [first, second] });
  assert.equal(lifecycle.lifecycle_state, 'BLOCKED_REGISTRY_AMENDMENT');
});

test('rejects a dirty pinned tree and a frozen plan with one of 760 slots missing', () => {
  const { frozenPlan } = chain();
  const dirty = structuredClone(frozenPlan); dirty.pinned_tree.status_porcelain = ' M pages/review-v1/[id].js';
  assert.throws(() => contracts.validateFrozenPlan(dirty), (error) => error.code === 'PINNED_TREE_DIRTY');
  const missing = structuredClone(frozenPlan); missing.capture_slots.pop();
  assert.throws(() => contracts.validateFrozenPlan(missing), (error) => error.code === 'CAPTURE_SLOT_ENUMERATION_INVALID');
});

test('rejects Git tree identifier confusion and reconstructed-reference mutation', () => {
  const reference = contracts.buildReconstructedReferenceProposal();
  const wrongTreeKind = structuredClone(reference); wrongTreeKind.git_tree_id = digest('f');
  assert.throws(() => contracts.validateReconstructedReference(wrongTreeKind), (error) => error.code === 'RECONSTRUCTED_REFERENCE_INVALID');
  const wrongRoot = structuredClone(reference); wrongRoot.renderer_dependency_closure_roots.review_root_sha256 = digest('e');
  assert.throws(() => contracts.validateReconstructedReference(wrongRoot), (error) => error.code === 'RECONSTRUCTED_REFERENCE_INVALID');
  assert.throws(() => contracts.buildFrozenPlan({
    source_acquisition_plan_id: digest('1'), reconstructed_reference: reference,
    pinned_tree: { commit: reference.git_tree_id, checkout_tree_sha256: digest('2'), status_porcelain: '' }, roster, table_config_order: tables,
  }), (error) => error.code === 'PINNED_TREE_REFERENCE_MISMATCH');
});

test('rejects expired, replayed, or consumed capture approval proposals', () => {
  const { frozenPlan, preflight, approval } = chain();
  assert.throws(() => contracts.validateCaptureApprovalRequest(approval, {
    frozen_plan: frozenPlan, preflight, at_time: '2026-08-04T01:00:00.000Z',
  }), (error) => error.code === 'APPROVAL_EXPIRED');
  const invalidExpiry = structuredClone(approval); invalidExpiry.approval_expires_at = invalidExpiry.approval_issued_at;
  assert.throws(() => contracts.validateCaptureApprovalRequest(invalidExpiry, { frozen_plan: frozenPlan, preflight }), (error) => error.code === 'APPROVAL_EXPIRY_INVALID');
  const replayed = structuredClone(approval); replayed.one_use_nonce = replayed.request_nonce;
  assert.throws(() => contracts.validateCaptureApprovalRequest(replayed, { frozen_plan: frozenPlan, preflight }), (error) => error.code === 'APPROVAL_NONCE_REUSE_INVALID');
  const consumed = structuredClone(approval); consumed.consumption_state = 'CONSUMED';
  assert.throws(() => contracts.validateCaptureApprovalRequest(consumed, { frozen_plan: frozenPlan, preflight }), (error) => error.code === 'APPROVAL_REQUEST_STATE_INVALID');
  const predecessor = structuredClone(approval); predecessor.predecessor_consumption_id = digest('3');
  assert.throws(() => contracts.validateCaptureApprovalRequest(predecessor, { frozen_plan: frozenPlan, preflight }), (error) => error.code === 'APPROVAL_REQUEST_STATE_INVALID');
});

test('rejects repeated lifecycle nonces and skipped generations', () => {
  const { frozenPlan, preflight, approval, worker, head } = chain();
  const first = contracts.buildSignedRunEvent({ run_head: head, generation: 1, predecessor_event_id: head.run_head_id, event_type: 'PREFLIGHT_BOUND', event_nonce: 'event-nonce-0001' });
  const repeated = contracts.buildSignedRunEvent({ run_head: head, generation: 2, predecessor_event_id: first.event_id, event_type: 'BLOCKED_REGISTRY_AMENDMENT', event_nonce: 'event-nonce-0001' });
  const input = { frozen_plan: frozenPlan, preflight, approval_request: approval, worker_registration: worker, run_head: head };
  assert.throws(() => contracts.validateSignedRunLifecycle({ ...input, events: [first, repeated] }), (error) => error.code === 'RUN_EVENT_NONCE_REUSED');
  const skipped = contracts.buildSignedRunEvent({ run_head: head, generation: 3, predecessor_event_id: first.event_id, event_type: 'BLOCKED_REGISTRY_AMENDMENT', event_nonce: 'event-nonce-0003' });
  assert.throws(() => contracts.validateSignedRunLifecycle({ ...input, events: [first, skipped] }), (error) => error.code === 'RUN_EVENT_GENERATION_NOT_MONOTONIC');
});

test('rejects a self-generated worker key and blocks real trusted actions pending registry amendment', () => {
  const { frozenPlan, preflight, approval, worker } = chain();
  const selfGenerated = structuredClone(worker); selfGenerated.key_origin = 'SELF_GENERATED';
  assert.throws(() => contracts.validateWorkerRegistration(selfGenerated, { frozen_plan: frozenPlan, preflight, approval_request: approval }), (error) => error.code === 'WORKER_REGISTRATION_TRUST_INVALID');
  assert.throws(() => contracts.requireRegistryAmendmentForTrustedAction(), (error) => error.code === contracts.REGISTRY_AMENDMENT_REQUIRED);
});

test('has no key issuer, signer, network, database, or terminal PASS execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/v1-trusted-capture-control-contracts.js'), 'utf8');
  assert.doesNotMatch(source, /writeFile|mkdir|node:https|node:http|\bfetch\s*\(|supabase|createClient|INSERT\s+INTO|UPDATE\s+|DELETE\s+|crypto\.sign|createPrivateKey|terminal_state:\s*'PASS'/i);
});
