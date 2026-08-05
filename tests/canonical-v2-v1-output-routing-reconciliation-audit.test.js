'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const audit = require('../lib/canonical-v2/v1-output-routing-reconciliation-audit');

const ROOT = path.resolve(__dirname, '..');
const INPUTS = ['agreement_source', 'deals', 'provision_types', 'provisions', 'review_cards', 'review_cards_claims'];
function immutable(schema, idField, body) { return { ...body, [idField]: contentId(schema, body) }; }
function plan() { return audit.buildV1RenderedSurfaceAcquisitionPlan({ repository_root: ROOT }); }
function collector() {
  const keys = crypto.generateKeyPairSync('ed25519');
  const collector_public_key_pem = keys.publicKey.export({ type: 'spki', format: 'pem' });
  const body = { schema_version: audit.V1_RENDER_COLLECTOR_AUTHORITY_SCHEMA, collector_public_key_pem, request_policy: { allowed_input_names: INPUTS, allowed_methods: ['GET'], capture_mode: 'READ_ONLY_PAGINATED_TABLE' } };
  return { authority: immutable(audit.V1_RENDER_COLLECTOR_AUTHORITY_SCHEMA, 'collector_authority_id', body), privateKey: keys.privateKey };
}
function signedCapture(body, privateKey) {
  const unsigned = { ...body }; delete unsigned.collector_signature_base64;
  body.collector_signature_base64 = crypto.sign(null, Buffer.from(contentId('V1_RENDER_SOURCE_CAPTURE_ATTESTATION/V1', unsigned), 'utf8'), privateKey).toString('base64');
  return immutable(audit.V1_RENDER_SOURCE_CAPTURE_SCHEMA, 'capture_id', body);
}
function validArtifacts() {
  const acquisitionPlan = plan(); const { authority, privateKey } = collector();
  const rawPages = INPUTS.map((input_name, inputIndex) => acquisitionPlan.home_directory_roster.deal_ids.map((deal_id, index) => ({ deal_id, input_name, raw_index: inputIndex * 40 + index })));
  const input_pages = INPUTS.map((input_name, inputIndex) => {
    const bodyBytes = Buffer.from(canonicalJson({ rows: rawPages[inputIndex] })); const raw_response_sha256 = sha256Hex(bodyBytes); const url = `/capture/${input_name}`;
    return { input_name, page_number: 1, eof_reached: true, url, method: 'GET', status: 200, body_bytes_base64: bodyBytes.toString('base64'), raw_response_sha256, row_count: 40, page_id: contentId('V1_RENDER_INPUT_PAGE/V1', { input_name, page_number: 1, url, raw_response_sha256, row_count: 40 }) };
  });
  const rows = input_pages.flatMap((page, inputIndex) => rawPages[inputIndex].map((rawRow, page_row_index) => {
    const bytes = Buffer.from(canonicalJson(rawRow)); const row_digest = sha256Hex(bytes);
    return { source_record_id: contentId('V1_RENDER_SOURCE_ROW/V1', { input_page_id: page.page_id, page_row_index, row_digest }), deal_id: rawRow.deal_id, input_page_id: page.page_id, page_row_index, row_bytes_base64: bytes.toString('base64'), row_digest };
  }));
  const captureBody = { schema_version: audit.V1_RENDER_SOURCE_CAPTURE_SCHEMA, collector_authority_id: authority.collector_authority_id, collector_signature_base64: '', renderer_dependency_closure_id: acquisitionPlan.renderer_dependency_closure.renderer_dependency_closure_id, capture_mode: 'READ_ONLY_PAGINATED_TABLE', selector_contract: acquisitionPlan.renderer_dependency_closure.selector_contract, home_directory_roster_digest: acquisitionPlan.home_directory_roster.roster_digest, pagination: { row_count: 40, eof_reached: true, selector_exceptions: [] }, rows, input_pages, network_log: input_pages.map((page) => ({ method: 'GET', url: page.url, status: 200, page_id: page.page_id })), raw_capture_sha256: audit.rawCaptureDigest(input_pages), source_record_count: rows.length };
  const capture = signedCapture(captureBody, privateKey);
  const output = Buffer.from(canonicalJson({ rendered: 'fixture' })); const outputSha = sha256Hex(output);
  const receipt = () => immutable(audit.V1_RENDER_EXECUTION_RECEIPT_SCHEMA, 'execution_receipt_id', { schema_version: audit.V1_RENDER_EXECUTION_RECEIPT_SCHEMA, status: 'PASS', input_set_digest: audit.expectedReplayInputDigest(capture, acquisitionPlan.renderer_dependency_closure, acquisitionPlan.renderer_dependency_closure.table_config_order), environment_digest: audit.expectedReplayEnvironmentDigest(acquisitionPlan.renderer_dependency_closure), output_bytes_base64: output.toString('base64'), output_sha256: outputSha });
  const replay = immutable(audit.V1_RENDER_REPLAY_SCHEMA, 'replay_id', { schema_version: audit.V1_RENDER_REPLAY_SCHEMA, capture_id: capture.capture_id, renderer_dependency_closure_id: acquisitionPlan.renderer_dependency_closure.renderer_dependency_closure_id, table_config_order: acquisitionPlan.renderer_dependency_closure.table_config_order, byte_identical_second_replay: true, rendered_output_bytes_base64: output.toString('base64'), rendered_output_sha256: outputSha, reference_resolution: { unresolved_reference_count: 0, reference_edge_count: 0, reference_edges_digest: sha256Hex(canonicalJson([])) }, first_execution_receipt: receipt(), second_execution_receipt: receipt() });
  const displayed_cells = rows.map((row, index) => {
    const cellBytes = Buffer.from(`cell-${index}`); const domBytes = Buffer.from(canonicalJson({ cell_text: cellBytes.toString('utf8'), column_index: 0, config_index: 0, deal_id: row.deal_id, selector_id: 'DISPLAYED_CELL', source_record_id: row.source_record_id, table_id: acquisitionPlan.renderer_dependency_closure.table_config_order[0].variable_name }));
    return { source_record_id: row.source_record_id, deal_id: row.deal_id, cell_bytes_base64: cellBytes.toString('base64'), cell_digest: sha256Hex(cellBytes), dom_bytes_base64: domBytes.toString('base64'), dom_bytes_sha256: sha256Hex(domBytes), config_index: 0, column_index: 0, selector_id: 'DISPLAYED_CELL', table_id: acquisitionPlan.renderer_dependency_closure.table_config_order[0].variable_name, disposition: 'DISPLAYED' };
  });
  const ledger = immutable(audit.V1_RENDER_LEDGER_SCHEMA, 'ledger_id', { schema_version: audit.V1_RENDER_LEDGER_SCHEMA, capture_id: capture.capture_id, replay_id: replay.replay_id, displayed_cells, source_lineage: rows.map((row) => ({ source_record_id: row.source_record_id, deal_id: row.deal_id, input_page_id: row.input_page_id, row_digest: row.row_digest })), hidden_unmounted_dispositions: [], reference_edges: [] });
  return { acquisitionPlan, authority, capture, replay, ledger };
}

test('binds direct and transitive dependencies to installed lock entries and runtime bytes', () => {
  const closure = audit.buildRendererDependencyClosure({ repository_root: ROOT });
  assert.equal(closure.direct_dependency_count, audit.DIRECT_RENDERER_DEPENDENCY_COUNT);
  assert.equal(closure.table_config_count, audit.TABLE_CONFIG_COUNT);
  assert.ok(closure.transitive_dependency_closure.external_imports.every((entry) => typeof entry.lock_version === 'string' && /^sha512-/.test(entry.lock_integrity) && /^[a-f0-9]{64}$/.test(entry.runtime_entry_sha256)));
});

test('keeps signed synthetic capture, replay and ledger diagnostics non-authoritative', () => {
  const { acquisitionPlan, authority, capture, replay, ledger } = validArtifacts();
  assert.equal(audit.validateV1RenderSourceCapture(capture, { renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure, collector_authority: authority }), true);
  assert.equal(audit.validateV1RenderReplay(replay, { capture, renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure }), true);
  assert.equal(audit.validateV1RenderLedger(ledger, { capture, replay }), true);
  assert.throws(
    () => audit.validateV1RenderedSurfaceArtifactSet({ source_capture: capture, replay, ledger, acquisition_plan: acquisitionPlan, collector_authority: authority, repository_root: ROOT }),
    (error) => error.code === audit.TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED,
  );
});

test('makes capture issuance impossible without the separate collector authority', () => {
  const { acquisitionPlan, capture } = validArtifacts();
  assert.throws(() => audit.validateV1RenderSourceCapture(capture, { renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure }), (error) => error.code === 'RENDER_CAPTURE_COLLECTOR_AUTHORITY_REQUIRED');
});

test('rejects rehashed hostile capture substitutions after page parsing and signed receipt checks', () => {
  const { acquisitionPlan, authority, capture } = validArtifacts();
  const body = { ...capture }; delete body.capture_id; body.rows = body.rows.map((row, index) => index === 0 ? { ...row, deal_id: '00000000-0000-4000-8000-000000000000' } : row);
  const forged = immutable(audit.V1_RENDER_SOURCE_CAPTURE_SCHEMA, 'capture_id', body);
  assert.throws(() => audit.validateV1RenderSourceCapture(forged, { renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure, collector_authority: authority }), (error) => error.code === 'RENDER_CAPTURE_COLLECTOR_SIGNATURE_INVALID');
  const unsigned = { ...capture }; delete unsigned.capture_id; unsigned.collector_signature_base64 = ''; const fake = immutable(audit.V1_RENDER_SOURCE_CAPTURE_SCHEMA, 'capture_id', unsigned);
  assert.throws(() => audit.validateV1RenderSourceCapture(fake, { renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure, collector_authority: authority }), (error) => ['RENDER_BYTES_INVALID', 'RENDER_CAPTURE_COLLECTOR_SIGNATURE_INVALID'].includes(error.code));
});

test('recomputes raw pages, replay output receipts, DOM cells and exact reference edge evidence', () => {
  const { acquisitionPlan, authority, capture, replay, ledger } = validArtifacts();
  const changedPage = { ...capture }; delete changedPage.capture_id; changedPage.input_pages = changedPage.input_pages.map((page, index) => index === 0 ? { ...page, body_bytes_base64: Buffer.from(canonicalJson({ rows: [] })).toString('base64') } : page);
  assert.throws(() => audit.validateV1RenderSourceCapture(immutable(audit.V1_RENDER_SOURCE_CAPTURE_SCHEMA, 'capture_id', changedPage), { renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure, collector_authority: authority }), (error) => error.code === 'RENDER_CAPTURE_COLLECTOR_SIGNATURE_INVALID');
  const badReplayBody = { ...replay }; delete badReplayBody.replay_id; const badReceiptBody = { ...replay.first_execution_receipt }; delete badReceiptBody.execution_receipt_id; badReceiptBody.output_sha256 = sha256Hex('other'); badReplayBody.first_execution_receipt = immutable(audit.V1_RENDER_EXECUTION_RECEIPT_SCHEMA, 'execution_receipt_id', badReceiptBody); const badReplay = immutable(audit.V1_RENDER_REPLAY_SCHEMA, 'replay_id', badReplayBody);
  assert.throws(() => audit.validateV1RenderReplay(badReplay, { capture, renderer_dependency_closure: acquisitionPlan.renderer_dependency_closure }), (error) => error.code === 'RENDER_REPLAY_RECEIPT_INVALID');
  const badLedgerBody = { ...ledger }; delete badLedgerBody.ledger_id; badLedgerBody.displayed_cells = badLedgerBody.displayed_cells.map((cell, index) => index === 0 ? { ...cell, cell_digest: sha256Hex('forged') } : cell); const badLedger = immutable(audit.V1_RENDER_LEDGER_SCHEMA, 'ledger_id', badLedgerBody);
  assert.throws(() => audit.validateV1RenderLedger(badLedger, { capture, replay }), (error) => error.code === 'RENDER_LEDGER_CELL_INVALID');
});

test('rejects non-canonical source pages, unlisted hidden reasons and untyped reference edges', () => {
  const { capture, replay, ledger } = validArtifacts();
  const badReasonBody = { ...ledger }; delete badReasonBody.ledger_id; const first = badReasonBody.displayed_cells.shift(); badReasonBody.hidden_unmounted_dispositions = [{ source_record_id: first.source_record_id, disposition: 'HIDDEN', reason_code: 'FREE_TEXT_REASON' }];
  const badReason = immutable(audit.V1_RENDER_LEDGER_SCHEMA, 'ledger_id', badReasonBody);
  assert.throws(() => audit.validateV1RenderLedger(badReason, { capture, replay }), (error) => error.code === 'RENDER_LEDGER_DISPOSITION_INVALID');
  const edgeEvidence = Buffer.from('source-row-reference'); const edge = { source_record_id: capture.rows[0].source_record_id, target_source_record_id: capture.rows[1].source_record_id, edge_type: 'UNLISTED_EDGE', evidence_bytes_base64: edgeEvidence.toString('base64'), evidence_sha256: sha256Hex(edgeEvidence), edge_digest: contentId('V1_RENDER_REFERENCE_EDGE/V1', { source_record_id: capture.rows[0].source_record_id, target_source_record_id: capture.rows[1].source_record_id, edge_type: 'UNLISTED_EDGE', evidence_sha256: sha256Hex(edgeEvidence) }) };
  const replayBody = { ...replay }; delete replayBody.replay_id; replayBody.reference_resolution = { unresolved_reference_count: 0, reference_edge_count: 1, reference_edges_digest: sha256Hex(canonicalJson([edge])) }; const edgeReplay = immutable(audit.V1_RENDER_REPLAY_SCHEMA, 'replay_id', replayBody);
  const edgeLedgerBody = { ...ledger }; delete edgeLedgerBody.ledger_id; edgeLedgerBody.replay_id = edgeReplay.replay_id; edgeLedgerBody.reference_edges = [edge]; const edgeLedger = immutable(audit.V1_RENDER_LEDGER_SCHEMA, 'ledger_id', edgeLedgerBody);
  assert.throws(() => audit.validateV1RenderLedger(edgeLedger, { capture, replay: edgeReplay }), (error) => error.code === 'RENDER_LEDGER_REFERENCE_INVALID');
});

test('scanner covers spaced require, side-effect import and literal dynamic import, while ignoring comments and strings', () => {
  const found = audit.scanModuleSpecifiers("// import 'commented'\nconst text = \"require('string')\"; import 'side'; const a = require ( 'space' ); const b = import('dynamic');");
  assert.deepEqual(found, [{ specifier: 'side', kind: 'SIDE_EFFECT_IMPORT' }, { specifier: 'space', kind: 'COMMONJS_REQUIRE' }, { specifier: 'dynamic', kind: 'DYNAMIC_IMPORT' }]);
  assert.throws(() => audit.scanModuleSpecifiers("const x = import(variable);"), (error) => error.code === 'RENDERER_DEPENDENCY_DYNAMIC_UNRESOLVED');
  assert.throws(() => audit.scanModuleSpecifiers("const x = require ( variable );"), (error) => error.code === 'RENDERER_DEPENDENCY_DYNAMIC_UNRESOLVED');
});

test('keeps the static plan evidence-incomplete and grants no provider or database path', () => {
  const acquisitionPlan = plan();
  assert.equal(acquisitionPlan.status, audit.STATUS);
  assert.equal(audit.validateV1OutputRoutingReconciliationAudit(acquisitionPlan, { repository_root: ROOT }), true);
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/v1-output-routing-reconciliation-audit.js'), 'utf8');
  for (const forbidden of ['createClient', 'getServiceSupabase', 'fetch(', 'produceCandidate']) assert.equal(source.includes(forbidden), false, `${forbidden} is forbidden`);
});
