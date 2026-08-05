'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const replay = require('../lib/canonical-v2/v1-replay-evidence-proposal');

const digest = (value) => sha256Hex(Buffer.from(value, 'utf8'));

function fixture() {
  const outer_deal_ids = Array.from({ length: replay.DEAL_COUNT }, (_, index) => `deal-${String(index + 1).padStart(2, '0')}`);
  const renderer_configuration_ids = Array.from({ length: replay.CONFIGURATION_COUNT }, (_, index) => `renderer-${String(index + 1).padStart(2, '0')}`);
  const loaded_module_trace = replay.buildLoadedModuleTraceProposal({
    renderer_commit_id: digest('renderer-commit'),
    loaded_modules: [
      { loaded_module_path: 'app/review/page.js', module_bytes_sha256: digest('page') },
      { loaded_module_path: 'lib/render.js', module_bytes_sha256: digest('render') },
    ],
  });
  const slots = outer_deal_ids.flatMap((outer_deal_id) => renderer_configuration_ids.map((renderer_configuration_id) => {
    const output = Buffer.from(`output:${outer_deal_id}:${renderer_configuration_id}`, 'utf8');
    return {
      outer_deal_id,
      renderer_configuration_id,
      surface_slot_id: replay.outputSlotId({ outer_deal_id, renderer_configuration_id }),
      output_bytes_base64: output.toString('base64'),
      dom_output_sha256: sha256Hex(output),
    };
  }));
  const surface_output = replay.buildSurfaceOutputProposal({ loaded_module_trace, outer_deal_ids, renderer_configuration_ids, slots });
  const source_dispositions = surface_output.slots.map((slot, index) => replay.buildSourceDispositionProposal({
    surface_output,
    surface_slot_id: slot.surface_slot_id,
    disposition_kind: index === 0 ? 'SOURCE_CARD' : 'UNMOUNTED',
    dom_node_id: `dom:${slot.surface_slot_id}`,
    source_record_id: index === 0 ? 'card-1' : null,
    source_byte_sha256: index === 0 ? digest('card-1-bytes') : null,
  }));
  const reference_archive = replay.buildReferenceArchiveProposal({ source_dispositions });
  const ledger = replay.buildValidatorDerivedLedgerProposal({ surface_output, source_dispositions, reference_archive });
  return { outer_deal_ids, renderer_configuration_ids, loaded_module_trace, surface_output, source_dispositions, reference_archive, ledger };
}

test('schemas 10-16 produce exact 40 by 19 surface coverage, loaded-path roots, lineage and byte-equal ledgers', () => {
  const value = fixture();
  assert.equal(value.surface_output.slots.length, 760);
  assert.equal(value.ledger.entries.length, 760);
  assert.equal(value.ledger.entries[0].reference_occurrence_id !== null, true, 'rendered card preserves DOM/source/reference lineage');
  assert.deepEqual(replay.validateLoadedModuleTraceProposal(value.loaded_module_trace), value.loaded_module_trace);
  assert.deepEqual(replay.validateSurfaceOutputProposal(value.surface_output, { loaded_module_trace: value.loaded_module_trace }), value.surface_output);
  assert.deepEqual(replay.validateReferenceArchiveProposal(value.reference_archive, { source_dispositions: value.source_dispositions }), value.reference_archive);
  assert.deepEqual(replay.validateValidatorDerivedLedgerProposal(value.ledger, { surface_output: value.surface_output, source_dispositions: value.source_dispositions, reference_archive: value.reference_archive }), value.ledger);
  assert.deepEqual(replay.reconcileByteEqualLedgers({ first_ledger: value.ledger, second_ledger: structuredClone(value.ledger) }), { byte_equal_ledger_root: value.ledger.reconstructed_ledger_root });
});

test('two replay receipts require distinct execution identities but exact loaded paths and output roots', () => {
  const value = fixture();
  const first_replay = replay.buildReplayReceiptProposal({
    loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output,
    replay_nonce: 'nonce-one', process_id: 'process-one', temporary_directory_id: 'temp-one', profile_id: 'profile-one',
  });
  const second_replay = replay.buildReplayReceiptProposal({
    loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output,
    replay_nonce: 'nonce-two', process_id: 'process-two', temporary_directory_id: 'temp-two', profile_id: 'profile-two',
  });
  const reconciliation = replay.reconcileDistinctReplays({ first_replay, second_replay, loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output });
  assert.equal(reconciliation.loaded_path_root, value.loaded_module_trace.loaded_path_root);
  assert.equal(reconciliation.surface_output_root, value.surface_output.surface_output_root);
  const sameNonceReplay = replay.buildReplayReceiptProposal({
    loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output,
    replay_nonce: first_replay.replay_nonce, process_id: 'process-three', temporary_directory_id: 'temp-three', profile_id: 'profile-three',
  });
  assert.throws(() => replay.reconcileDistinctReplays({ first_replay, second_replay: sameNonceReplay, loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output }), { code: 'V1_REPLAY_NOT_DISTINCT' });
});

test('incomplete surface coverage, unsafe module paths, stale ledger content and unauthorised PASS paths fail closed', () => {
  const value = fixture();
  assert.throws(() => replay.buildLoadedModuleTraceProposal({ renderer_commit_id: digest('commit'), loaded_modules: [{ loaded_module_path: '../escape.js', module_bytes_sha256: digest('x') }] }), { code: 'V1_REPLAY_EVIDENCE_INVALID' });
  assert.throws(() => replay.buildSurfaceOutputProposal({
    loaded_module_trace: value.loaded_module_trace,
    outer_deal_ids: value.outer_deal_ids,
    renderer_configuration_ids: value.renderer_configuration_ids,
    slots: value.surface_output.slots.slice(1),
  }), { code: 'V1_REPLAY_SURFACE_COVERAGE_INVALID' });
  assert.throws(() => replay.validateValidatorDerivedLedgerProposal({ ...value.ledger, reconstructed_ledger_root: digest('forged') }, { surface_output: value.surface_output, source_dispositions: value.source_dispositions, reference_archive: value.reference_archive }), { code: 'V1_REPLAY_EVIDENCE_STALE' });
  assert.throws(() => replay.verifyFinalReplaySignature({ private_key: 'self-generated', signature: 'self-signed' }), { code: 'V1_REPLAY_TRUST_REGISTRY_AMENDMENT_REQUIRED' });
  assert.throws(() => replay.issueReplayPass({}), { code: 'V1_REPLAY_PASS_ISSUANCE_UNAVAILABLE' });
});

test('final acquisition attestation remains proposal-only after distinct replay and byte-equal ledger reconciliation', () => {
  const value = fixture();
  const first_replay = replay.buildReplayReceiptProposal({ loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output, replay_nonce: 'nonce-one', process_id: 'process-one', temporary_directory_id: 'temp-one', profile_id: 'profile-one' });
  const second_replay = replay.buildReplayReceiptProposal({ loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output, replay_nonce: 'nonce-two', process_id: 'process-two', temporary_directory_id: 'temp-two', profile_id: 'profile-two' });
  const attestation = replay.buildAcquisitionAttestationProposal({ first_replay, second_replay, loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output, first_ledger: value.ledger, second_ledger: structuredClone(value.ledger) });
  assert.equal(attestation.authority, 'NONE');
  assert.equal(attestation.pass_status, 'NOT_EVALUATED');
  assert.deepEqual(replay.validateAcquisitionAttestationProposal(attestation, { first_replay, second_replay, loaded_module_trace: value.loaded_module_trace, surface_output: value.surface_output, first_ledger: value.ledger, second_ledger: structuredClone(value.ledger) }), attestation);
});
