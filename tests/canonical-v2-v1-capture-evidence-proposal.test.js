'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const capture = require('../lib/canonical-v2/v1-capture-evidence-proposal');

const digest = (value) => sha256Hex(Buffer.from(value, 'utf8'));

function snapshot() {
  const query = digest('query-contract');
  const outer_deal_id = 'outer-deal-1';
  return capture.buildDatabaseSnapshotIdentityProposal({
    snapshot_query_contract_id: query,
    snapshot_boundary_id: digest('snapshot-boundary'),
    outer_deal_ids: [outer_deal_id],
    request_slots: [{
      outer_deal_id,
      input_name: 'cards',
      request_slot_id: capture.slotId({ snapshot_query_contract_id: query, outer_deal_id, input_name: 'cards' }),
    }],
  });
}
function page(database_snapshot_identity, { rows = [{ outer_deal_id: 'outer-deal-1', id: 'card-1' }], page_number = 1, eof_reached = true, request_url } = {}) {
  const slot = database_snapshot_identity.request_slots[0];
  return capture.buildInputPageProposal({
    database_snapshot_identity,
    request_slot_id: slot.request_slot_id,
    outer_deal_id: slot.outer_deal_id,
    input_name: slot.input_name,
    page_number,
    eof_reached,
    request_url: request_url || capture.requestUrl({ outer_deal_id: slot.outer_deal_id, input_name: slot.input_name, page_number }),
    body_bytes_base64: Buffer.from(JSON.stringify({ rows }), 'utf8').toString('base64'),
  });
}

test('proposal-only schemas 6-9 recompute exact page, outer-deal, coverage and capture roots without authority', () => {
  const database_snapshot_identity = snapshot();
  const input_page = page(database_snapshot_identity);
  const parsed_source_row = capture.buildParsedSourceRowProposal({ database_snapshot_identity, input_page, row_ordinal: 1 });
  const roots = capture.recomputeCaptureRoots({ database_snapshot_identity, input_pages: [input_page], parsed_source_rows: [parsed_source_row] });
  const source_capture = capture.buildSourceCaptureProposal({ database_snapshot_identity, input_pages: [input_page], parsed_source_rows: [parsed_source_row] });

  assert.equal(database_snapshot_identity.authority, 'NONE');
  assert.equal(input_page.authority, 'NONE');
  assert.equal(parsed_source_row.authority, 'NONE');
  assert.equal(source_capture.authority, 'NONE');
  assert.equal(source_capture.request_slot_coverage_root, roots.request_slot_coverage_root);
  assert.equal(source_capture.outer_deal_binding_root, roots.outer_deal_binding_root);
  assert.equal(source_capture.source_capture_root, roots.source_capture_root);
  assert.deepEqual(capture.validateDatabaseSnapshotIdentityProposal(database_snapshot_identity), database_snapshot_identity);
  assert.deepEqual(capture.validateInputPageProposal(input_page, { database_snapshot_identity }), input_page);
  assert.deepEqual(capture.validateParsedSourceRowProposal(parsed_source_row, { database_snapshot_identity, input_pages: [input_page] }), parsed_source_row);
  assert.deepEqual(capture.validateSourceCaptureProposal(source_capture, { database_snapshot_identity, input_pages: [input_page], parsed_source_rows: [parsed_source_row] }), source_capture);
});

test('arbitrary URLs, outer-deal swaps, and incomplete EOF or slot coverage fail deterministically', () => {
  const database_snapshot_identity = snapshot();
  assert.throws(() => page(database_snapshot_identity, { request_url: 'https://attacker.invalid/page' }), { code: 'V1_CAPTURE_URL_INVALID' });
  assert.throws(() => page(database_snapshot_identity, { rows: [{ outer_deal_id: 'outer-deal-2', id: 'swap' }] }), { code: 'V1_CAPTURE_OUTER_DEAL_BINDING_INVALID' });

  const incomplete = page(database_snapshot_identity, { eof_reached: false });
  const parsed = capture.buildParsedSourceRowProposal({ database_snapshot_identity, input_page: incomplete, row_ordinal: 1 });
  assert.throws(() => capture.recomputeRequestSlotCoverage({ database_snapshot_identity, input_pages: [incomplete] }), { code: 'V1_CAPTURE_SLOT_COVERAGE_INCOMPLETE' });
  assert.throws(() => capture.buildSourceCaptureProposal({ database_snapshot_identity, input_pages: [incomplete], parsed_source_rows: [parsed] }), { code: 'V1_CAPTURE_SLOT_COVERAGE_INCOMPLETE' });
});

test('self-rehashed pages and self-generated signing material cannot become authoritative capture evidence', () => {
  const database_snapshot_identity = snapshot();
  const selfRehashedPage = page(database_snapshot_identity, { rows: [{ outer_deal_id: 'outer-deal-1', id: 'changed-card' }] });
  const selfRehashedRow = capture.buildParsedSourceRowProposal({ database_snapshot_identity, input_page: selfRehashedPage, row_ordinal: 1 });
  const proposal = capture.buildSourceCaptureProposal({ database_snapshot_identity, input_pages: [selfRehashedPage], parsed_source_rows: [selfRehashedRow] });
  assert.equal(proposal.status, capture.NOT_ISSUED);
  assert.equal(proposal.authority, 'NONE');
  assert.throws(() => capture.validateV1CaptureControllerSignature({ private_key: 'self-generated', signature: 'self-signed' }), { code: 'V1_CAPTURE_TRUST_REGISTRY_AMENDMENT_REQUIRED' });
  assert.throws(() => capture.acceptSourceCapture({ source_capture: proposal }), { code: 'V1_CAPTURE_ACCEPTANCE_UNAVAILABLE' });
});

test('proposal validators reject stale page or source-capture content identities', () => {
  const database_snapshot_identity = snapshot();
  const input_page = page(database_snapshot_identity);
  const row = capture.buildParsedSourceRowProposal({ database_snapshot_identity, input_page, row_ordinal: 1 });
  const source_capture = capture.buildSourceCaptureProposal({ database_snapshot_identity, input_pages: [input_page], parsed_source_rows: [row] });
  assert.throws(() => capture.validateInputPageProposal({ ...input_page, page_parse_root: digest('forged') }, { database_snapshot_identity }), { code: 'V1_CAPTURE_EVIDENCE_STALE' });
  assert.throws(() => capture.validateSourceCaptureProposal({ ...source_capture, source_capture_root: digest('forged') }, { database_snapshot_identity, input_pages: [input_page], parsed_source_rows: [row] }), { code: 'V1_CAPTURE_EVIDENCE_STALE' });
});

test('a capture cannot omit a parsed row from a covered page', () => {
  const database_snapshot_identity = snapshot();
  const input_page = page(database_snapshot_identity, { rows: [
    { outer_deal_id: 'outer-deal-1', id: 'card-1' },
    { outer_deal_id: 'outer-deal-1', id: 'card-2' },
  ] });
  const firstRow = capture.buildParsedSourceRowProposal({ database_snapshot_identity, input_page, row_ordinal: 1 });
  assert.throws(() => capture.buildSourceCaptureProposal({ database_snapshot_identity, input_pages: [input_page], parsed_source_rows: [firstRow] }), { code: 'V1_CAPTURE_ROW_COVERAGE_INCOMPLETE' });
});
