'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const DATABASE_SNAPSHOT_IDENTITY_SCHEMA = 'V1_DATABASE_SNAPSHOT_IDENTITY_PROPOSAL/V1';
const INPUT_PAGE_SCHEMA = 'V1_CAPTURE_INPUT_PAGE_PROPOSAL/V1';
const PARSED_SOURCE_ROW_SCHEMA = 'V1_PARSED_SOURCE_ROW_PROPOSAL/V1';
const SOURCE_CAPTURE_SCHEMA = 'V1_SOURCE_CAPTURE_PROPOSAL/V1';
const NOT_ISSUED = 'NOT_ISSUED_PREVIEW_ONLY_NOT_AUTHORITY';

class V1CaptureEvidenceProposalError extends Error {
  constructor(code, message) { super(message); this.name = 'V1CaptureEvidenceProposalError'; this.code = code; }
}
function fail(code, message) { throw new V1CaptureEvidenceProposalError(code, message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return plain(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
function text(value, label) { if (typeof value !== 'string' || !value || value.trim() !== value) fail('V1_CAPTURE_EVIDENCE_INVALID', `${label} must be a non-empty trimmed string.`); return value; }
function digest(value, label) { if (!/^[a-f0-9]{64}$/.test(value || '')) fail('V1_CAPTURE_EVIDENCE_INVALID', `${label} must be a SHA-256 digest.`); return value; }
function freeze(value) { return Object.freeze(value); }

function slotId({ snapshot_query_contract_id, outer_deal_id, input_name }) {
  return contentId('V1_CAPTURE_REQUEST_SLOT/V1', { snapshot_query_contract_id, outer_deal_id, input_name });
}
function requestUrl({ outer_deal_id, input_name, page_number }) {
  if (!Number.isSafeInteger(page_number) || page_number < 1) fail('V1_CAPTURE_EVIDENCE_INVALID', 'page_number must be a positive safe integer.');
  return `v1-review-capture://${encodeURIComponent(input_name)}/${encodeURIComponent(outer_deal_id)}?page=${page_number}`;
}
function base64Bytes(value) {
  if (typeof value !== 'string' || !value) fail('V1_CAPTURE_EVIDENCE_INVALID', 'body_bytes_base64 must be non-empty base64.');
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.toString('base64') !== value) fail('V1_CAPTURE_EVIDENCE_INVALID', 'body_bytes_base64 must be canonical base64.');
  return bytes;
}
function parsePageBytes(bytes) {
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { fail('V1_CAPTURE_PAGE_PARSE_INVALID', 'captured page bytes must be UTF-8 JSON.'); }
  if (!exactKeys(parsed, ['rows']) || !Array.isArray(parsed.rows)) fail('V1_CAPTURE_PAGE_PARSE_INVALID', 'captured page JSON must contain only rows.');
  return parsed.rows.map((row, index) => {
    if (!plain(row)) fail('V1_CAPTURE_PAGE_PARSE_INVALID', `captured row ${index + 1} must be an object.`);
    text(row.outer_deal_id, `captured row ${index + 1}.outer_deal_id`);
    return freeze({ row_ordinal: index + 1, outer_deal_id: row.outer_deal_id, raw_row_sha256: sha256Hex(Buffer.from(canonicalJson(row), 'utf8')), raw_row: freeze({ ...row }) });
  });
}

function buildDatabaseSnapshotIdentityProposal({ snapshot_query_contract_id, snapshot_boundary_id, outer_deal_ids, request_slots } = {}) {
  digest(snapshot_query_contract_id, 'snapshot_query_contract_id');
  digest(snapshot_boundary_id, 'snapshot_boundary_id');
  if (!Array.isArray(outer_deal_ids) || !outer_deal_ids.length || new Set(outer_deal_ids).size !== outer_deal_ids.length) fail('V1_CAPTURE_EVIDENCE_INVALID', 'outer_deal_ids must be a non-empty unique array.');
  outer_deal_ids.forEach((value) => text(value, 'outer_deal_id'));
  if (!Array.isArray(request_slots) || !request_slots.length) fail('V1_CAPTURE_EVIDENCE_INVALID', 'request_slots must be a non-empty array.');
  const slots = request_slots.map((slot) => {
    if (!exactKeys(slot, ['input_name', 'outer_deal_id', 'request_slot_id']) || !outer_deal_ids.includes(slot.outer_deal_id)) fail('V1_CAPTURE_EVIDENCE_INVALID', 'every request slot must bind one declared outer deal and input name.');
    text(slot.input_name, 'request_slot.input_name');
    const expected = slotId({ snapshot_query_contract_id, outer_deal_id: slot.outer_deal_id, input_name: slot.input_name });
    if (slot.request_slot_id !== expected) fail('V1_CAPTURE_EVIDENCE_INVALID', 'request slot id must be derived from the snapshot contract and outer deal.');
    return freeze({ ...slot });
  }).sort((left, right) => left.request_slot_id.localeCompare(right.request_slot_id));
  if (new Set(slots.map((slot) => slot.request_slot_id)).size !== slots.length) fail('V1_CAPTURE_EVIDENCE_INVALID', 'request slots must be unique.');
  const body = { schema_version: DATABASE_SNAPSHOT_IDENTITY_SCHEMA, status: NOT_ISSUED, authority: 'NONE', snapshot_query_contract_id, snapshot_boundary_id, outer_deal_ids: freeze([...outer_deal_ids].sort()), request_slots: freeze(slots) };
  return freeze({ ...body, database_snapshot_identity_id: contentId(DATABASE_SNAPSHOT_IDENTITY_SCHEMA, body) });
}
function validateDatabaseSnapshotIdentityProposal(value) {
  const keys = ['authority', 'database_snapshot_identity_id', 'outer_deal_ids', 'request_slots', 'schema_version', 'snapshot_boundary_id', 'snapshot_query_contract_id', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== DATABASE_SNAPSHOT_IDENTITY_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_CAPTURE_EVIDENCE_INVALID', 'database snapshot identity must remain an exact non-authoritative proposal.');
  const { database_snapshot_identity_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, ...input } = value;
  const expected = buildDatabaseSnapshotIdentityProposal(input);
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_CAPTURE_EVIDENCE_STALE', 'database snapshot identity is stale.');
  return expected;
}

function recomputePageParsing({ database_snapshot_identity, input_page } = {}) {
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  if (!plain(input_page)) fail('V1_CAPTURE_EVIDENCE_INVALID', 'input_page must be an object.');
  const slot = snapshot.request_slots.find((entry) => entry.request_slot_id === input_page.request_slot_id);
  if (!slot || input_page.database_snapshot_identity_id !== snapshot.database_snapshot_identity_id || input_page.outer_deal_id !== slot.outer_deal_id || input_page.input_name !== slot.input_name) fail('V1_CAPTURE_OUTER_DEAL_BINDING_INVALID', 'input page must bind one exact snapshot request slot and outer deal.');
  const bytes = base64Bytes(input_page.body_bytes_base64);
  if (input_page.raw_response_sha256 !== sha256Hex(bytes)) fail('V1_CAPTURE_EVIDENCE_INVALID', 'input page raw hash does not match its bytes.');
  if (input_page.request_url !== requestUrl(input_page)) fail('V1_CAPTURE_URL_INVALID', 'input page URL must be derived from its declared request slot and page number.');
  const rows = parsePageBytes(bytes);
  if (rows.some((row) => row.outer_deal_id !== slot.outer_deal_id)) fail('V1_CAPTURE_OUTER_DEAL_BINDING_INVALID', 'each parsed row must bind the outer deal of its request slot.');
  const page_parse_root = contentId('V1_CAPTURE_PAGE_PARSE_ROOT/V1', { database_snapshot_identity_id: snapshot.database_snapshot_identity_id, request_slot_id: slot.request_slot_id, page_number: input_page.page_number, rows });
  return freeze({ rows: freeze(rows), page_parse_root });
}

function buildInputPageProposal({ database_snapshot_identity, request_slot_id, outer_deal_id, input_name, page_number, eof_reached, request_url, body_bytes_base64 } = {}) {
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  const base = { database_snapshot_identity_id: snapshot.database_snapshot_identity_id, request_slot_id, outer_deal_id, input_name, page_number, eof_reached, request_url, body_bytes_base64, raw_response_sha256: sha256Hex(base64Bytes(body_bytes_base64)) };
  if (!Number.isSafeInteger(page_number) || page_number < 1 || typeof eof_reached !== 'boolean') fail('V1_CAPTURE_EVIDENCE_INVALID', 'input page requires a positive page number and eof flag.');
  const parsed = recomputePageParsing({ database_snapshot_identity: snapshot, input_page: base });
  const body = { schema_version: INPUT_PAGE_SCHEMA, status: NOT_ISSUED, authority: 'NONE', ...base, parsed_row_count: parsed.rows.length, page_parse_root: parsed.page_parse_root };
  return freeze({ ...body, input_page_id: contentId(INPUT_PAGE_SCHEMA, body) });
}
function validateInputPageProposal(value, { database_snapshot_identity } = {}) {
  const keys = ['authority', 'body_bytes_base64', 'database_snapshot_identity_id', 'eof_reached', 'input_name', 'input_page_id', 'outer_deal_id', 'page_number', 'page_parse_root', 'parsed_row_count', 'raw_response_sha256', 'request_slot_id', 'request_url', 'schema_version', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== INPUT_PAGE_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_CAPTURE_EVIDENCE_INVALID', 'input page must remain an exact non-authoritative proposal.');
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  const { input_page_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, ...input } = value;
  const expected = buildInputPageProposal({ database_snapshot_identity: snapshot, ...input });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_CAPTURE_EVIDENCE_STALE', 'input page is stale or self-rehashed outside its snapshot contract.');
  return expected;
}

function buildParsedSourceRowProposal({ database_snapshot_identity, input_page, row_ordinal } = {}) {
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  const page = validateInputPageProposal(input_page, { database_snapshot_identity: snapshot });
  if (!Number.isSafeInteger(row_ordinal) || row_ordinal < 1) fail('V1_CAPTURE_EVIDENCE_INVALID', 'row_ordinal must be a positive safe integer.');
  const parsed = recomputePageParsing({ database_snapshot_identity: snapshot, input_page: page });
  const row = parsed.rows[row_ordinal - 1];
  if (!row) fail('V1_CAPTURE_EVIDENCE_INVALID', 'row_ordinal is outside the parsed page.');
  const body = { schema_version: PARSED_SOURCE_ROW_SCHEMA, status: NOT_ISSUED, authority: 'NONE', database_snapshot_identity_id: snapshot.database_snapshot_identity_id, input_page_id: page.input_page_id, request_slot_id: page.request_slot_id, outer_deal_id: row.outer_deal_id, row_ordinal, raw_row_sha256: row.raw_row_sha256, raw_row: row.raw_row };
  return freeze({ ...body, parsed_source_row_id: contentId(PARSED_SOURCE_ROW_SCHEMA, body) });
}
function validateParsedSourceRowProposal(value, { database_snapshot_identity, input_pages } = {}) {
  const keys = ['authority', 'database_snapshot_identity_id', 'input_page_id', 'outer_deal_id', 'parsed_source_row_id', 'raw_row', 'raw_row_sha256', 'request_slot_id', 'row_ordinal', 'schema_version', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== PARSED_SOURCE_ROW_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_CAPTURE_EVIDENCE_INVALID', 'parsed source row must remain an exact non-authoritative proposal.');
  const page = (input_pages || []).find((entry) => entry.input_page_id === value.input_page_id);
  if (!page) fail('V1_CAPTURE_EVIDENCE_INVALID', 'parsed source row must name one supplied input page.');
  const { parsed_source_row_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, ...input } = value;
  const expected = buildParsedSourceRowProposal({ database_snapshot_identity, input_page: page, row_ordinal: input.row_ordinal });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_CAPTURE_EVIDENCE_STALE', 'parsed source row is stale or does not match its input page.');
  return expected;
}

function recomputeOuterDealBinding({ database_snapshot_identity, input_pages, parsed_source_rows } = {}) {
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  const rows = (parsed_source_rows || []).map((row) => validateParsedSourceRowProposal(row, { database_snapshot_identity: snapshot, input_pages }));
  const bindings = rows.map((row) => freeze({ parsed_source_row_id: row.parsed_source_row_id, request_slot_id: row.request_slot_id, outer_deal_id: row.outer_deal_id })).sort((left, right) => left.parsed_source_row_id.localeCompare(right.parsed_source_row_id));
  return freeze({ outer_deal_binding_root: contentId('V1_CAPTURE_OUTER_DEAL_BINDING_ROOT/V1', { database_snapshot_identity_id: snapshot.database_snapshot_identity_id, bindings }), bindings: freeze(bindings) });
}
function recomputeRequestSlotCoverage({ database_snapshot_identity, input_pages } = {}) {
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  const pages = (input_pages || []).map((page) => validateInputPageProposal(page, { database_snapshot_identity: snapshot }));
  const coverage = snapshot.request_slots.map((slot) => {
    const slots = pages.filter((page) => page.request_slot_id === slot.request_slot_id).sort((left, right) => left.page_number - right.page_number);
    if (!slots.length || slots.some((page, index) => page.page_number !== index + 1 || (index < slots.length - 1 && page.eof_reached)) || !slots.at(-1).eof_reached) fail('V1_CAPTURE_SLOT_COVERAGE_INCOMPLETE', 'each request slot needs sequential pages and one final EOF page.');
    return freeze({ request_slot_id: slot.request_slot_id, input_page_ids: freeze(slots.map((page) => page.input_page_id)), eof_page_number: slots.at(-1).page_number });
  }).sort((left, right) => left.request_slot_id.localeCompare(right.request_slot_id));
  if (new Set(pages.map((page) => `${page.request_slot_id}:${page.page_number}`)).size !== pages.length) fail('V1_CAPTURE_SLOT_COVERAGE_INCOMPLETE', 'a request slot cannot have duplicate page numbers.');
  return freeze({ request_slot_coverage_root: contentId('V1_CAPTURE_REQUEST_SLOT_COVERAGE_ROOT/V1', { database_snapshot_identity_id: snapshot.database_snapshot_identity_id, coverage }), coverage: freeze(coverage) });
}
function recomputeCaptureRoots({ database_snapshot_identity, input_pages, parsed_source_rows } = {}) {
  if (!Array.isArray(input_pages) || !Array.isArray(parsed_source_rows)) fail('V1_CAPTURE_EVIDENCE_INVALID', 'capture roots require explicit input pages and parsed source rows.');
  const coverage = recomputeRequestSlotCoverage({ database_snapshot_identity, input_pages });
  const outer = recomputeOuterDealBinding({ database_snapshot_identity, input_pages, parsed_source_rows });
  const expectedRows = input_pages.flatMap((page) => recomputePageParsing({ database_snapshot_identity, input_page: page }).rows
    .map((row) => `${page.input_page_id}:${row.row_ordinal}`)).sort();
  const actualRows = [...parsed_source_rows].map((row) => `${row.input_page_id}:${row.row_ordinal}`).sort();
  if (canonicalJson(expectedRows) !== canonicalJson(actualRows)) fail('V1_CAPTURE_ROW_COVERAGE_INCOMPLETE', 'every parsed row from every covered page must have one source-row proposal.');
  const row_ids = [...parsed_source_rows].map((row) => row.parsed_source_row_id).sort();
  const source_capture_root = contentId('V1_SOURCE_CAPTURE_ROOT/V1', { database_snapshot_identity_id: database_snapshot_identity.database_snapshot_identity_id, request_slot_coverage_root: coverage.request_slot_coverage_root, outer_deal_binding_root: outer.outer_deal_binding_root, parsed_source_row_ids: row_ids });
  return freeze({ ...coverage, ...outer, parsed_source_row_ids: freeze(row_ids), source_capture_root });
}

function buildSourceCaptureProposal({ database_snapshot_identity, input_pages, parsed_source_rows } = {}) {
  const snapshot = validateDatabaseSnapshotIdentityProposal(database_snapshot_identity);
  const roots = recomputeCaptureRoots({ database_snapshot_identity: snapshot, input_pages, parsed_source_rows });
  const body = { schema_version: SOURCE_CAPTURE_SCHEMA, status: NOT_ISSUED, authority: 'NONE', database_snapshot_identity_id: snapshot.database_snapshot_identity_id, input_page_ids: freeze([...input_pages].map((page) => page.input_page_id).sort()), parsed_source_row_ids: roots.parsed_source_row_ids, request_slot_coverage_root: roots.request_slot_coverage_root, outer_deal_binding_root: roots.outer_deal_binding_root, source_capture_root: roots.source_capture_root };
  return freeze({ ...body, source_capture_id: contentId(SOURCE_CAPTURE_SCHEMA, body) });
}
function validateSourceCaptureProposal(value, { database_snapshot_identity, input_pages, parsed_source_rows } = {}) {
  const keys = ['authority', 'database_snapshot_identity_id', 'input_page_ids', 'outer_deal_binding_root', 'parsed_source_row_ids', 'request_slot_coverage_root', 'schema_version', 'source_capture_id', 'source_capture_root', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== SOURCE_CAPTURE_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_CAPTURE_EVIDENCE_INVALID', 'source capture must remain an exact non-authoritative proposal.');
  const expected = buildSourceCaptureProposal({ database_snapshot_identity, input_pages, parsed_source_rows });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_CAPTURE_EVIDENCE_STALE', 'source capture proposal is stale or incomplete.');
  return expected;
}

function validateV1CaptureControllerSignature() { fail('V1_CAPTURE_TRUST_REGISTRY_AMENDMENT_REQUIRED', 'Controller and worker signatures remain unavailable until the trusted registry amendment is issued.'); }
function acceptSourceCapture() { fail('V1_CAPTURE_ACCEPTANCE_UNAVAILABLE', 'Final V1 capture acceptance remains unavailable until registry amendment and controlled execution exist.'); }

module.exports = {
  DATABASE_SNAPSHOT_IDENTITY_SCHEMA, INPUT_PAGE_SCHEMA, PARSED_SOURCE_ROW_SCHEMA, SOURCE_CAPTURE_SCHEMA, NOT_ISSUED,
  V1CaptureEvidenceProposalError, slotId, requestUrl, parsePageBytes, recomputePageParsing, recomputeOuterDealBinding, recomputeRequestSlotCoverage, recomputeCaptureRoots,
  buildDatabaseSnapshotIdentityProposal, validateDatabaseSnapshotIdentityProposal, buildInputPageProposal, validateInputPageProposal,
  buildParsedSourceRowProposal, validateParsedSourceRowProposal, buildSourceCaptureProposal, validateSourceCaptureProposal,
  validateV1CaptureControllerSignature, acceptSourceCapture,
};
