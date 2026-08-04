'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const LOADED_MODULE_TRACE_SCHEMA = 'V1_LOADED_MODULE_TRACE_PROPOSAL/V1';
const SURFACE_OUTPUT_SCHEMA = 'V1_SURFACE_OUTPUT_PROPOSAL/V1';
const REPLAY_RECEIPT_SCHEMA = 'V1_REPLAY_RECEIPT_PROPOSAL/V1';
const SOURCE_DISPOSITION_SCHEMA = 'V1_SOURCE_DISPOSITION_PROPOSAL/V1';
const REFERENCE_ARCHIVE_SCHEMA = 'V1_REFERENCE_OCCURRENCE_EDGE_PROPOSAL/V1';
const VALIDATOR_LEDGER_SCHEMA = 'V1_VALIDATOR_DERIVED_LEDGER_PROPOSAL/V1';
const ACQUISITION_ATTESTATION_SCHEMA = 'V1_ACQUISITION_ATTESTATION_PROPOSAL/V1';
const NOT_ISSUED = 'NOT_ISSUED_PREVIEW_ONLY_NOT_AUTHORITY';
const SLOT_COUNT = 760;
const DEAL_COUNT = 40;
const CONFIGURATION_COUNT = 19;
const DISPOSITION_REASON = Object.freeze({
  SOURCE_CARD: 'RENDERED_SOURCE_CARD', PROVISION: 'RENDERED_PROVISION', CLAIM: 'RENDERED_CLAIM',
  HIDDEN: 'HIDDEN_BY_CONFIGURATION', UNMOUNTED: 'UNMOUNTED_ROUTE', UNRESOLVED: 'UNRESOLVED_REFERENCE',
});

class V1ReplayEvidenceProposalError extends Error {
  constructor(code, message) { super(message); this.name = 'V1ReplayEvidenceProposalError'; this.code = code; }
}
function fail(code, message) { throw new V1ReplayEvidenceProposalError(code, message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return plain(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
function text(value, label) { if (typeof value !== 'string' || !value || value.trim() !== value) fail('V1_REPLAY_EVIDENCE_INVALID', `${label} must be a non-empty trimmed string.`); return value; }
function digest(value, label) { if (!/^[a-f0-9]{64}$/.test(value || '')) fail('V1_REPLAY_EVIDENCE_INVALID', `${label} must be a SHA-256 digest.`); return value; }
function freeze(value) { return Object.freeze(value); }
function outputSlotId({ outer_deal_id, renderer_configuration_id }) { return contentId('V1_SURFACE_OUTPUT_SLOT/V1', { outer_deal_id, renderer_configuration_id }); }
function bytes(value, label) { if (typeof value !== 'string' || !value) fail('V1_REPLAY_EVIDENCE_INVALID', `${label} must be canonical base64.`); const result = Buffer.from(value, 'base64'); if (!result.length || result.toString('base64') !== value) fail('V1_REPLAY_EVIDENCE_INVALID', `${label} must be canonical non-empty base64.`); return result; }

function buildLoadedModuleTraceProposal({ renderer_commit_id, loaded_modules } = {}) {
  digest(renderer_commit_id, 'renderer_commit_id');
  if (!Array.isArray(loaded_modules) || !loaded_modules.length) fail('V1_REPLAY_EVIDENCE_INVALID', 'loaded_modules must be non-empty.');
  const modules = loaded_modules.map((entry) => {
    if (!exactKeys(entry, ['loaded_module_path', 'module_bytes_sha256']) || entry.loaded_module_path.startsWith('/') || entry.loaded_module_path.includes('..')) fail('V1_REPLAY_EVIDENCE_INVALID', 'loaded module paths must be safe relative paths.');
    text(entry.loaded_module_path, 'loaded_module_path'); digest(entry.module_bytes_sha256, 'module_bytes_sha256');
    return freeze({ ...entry });
  }).sort((left, right) => left.loaded_module_path.localeCompare(right.loaded_module_path));
  if (new Set(modules.map((entry) => entry.loaded_module_path)).size !== modules.length) fail('V1_REPLAY_EVIDENCE_INVALID', 'loaded module paths must be unique.');
  const loaded_path_root = contentId('V1_LOADED_PATH_ROOT/V1', { renderer_commit_id, loaded_modules: modules });
  const body = { schema_version: LOADED_MODULE_TRACE_SCHEMA, status: NOT_ISSUED, authority: 'NONE', renderer_commit_id, loaded_modules: freeze(modules), loaded_path_root };
  return freeze({ ...body, loaded_module_trace_id: contentId(LOADED_MODULE_TRACE_SCHEMA, body) });
}
function validateLoadedModuleTraceProposal(value) {
  const keys = ['authority', 'loaded_module_trace_id', 'loaded_modules', 'loaded_path_root', 'renderer_commit_id', 'schema_version', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== LOADED_MODULE_TRACE_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_REPLAY_EVIDENCE_INVALID', 'loaded module trace must remain an exact non-authoritative proposal.');
  const { loaded_module_trace_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, loaded_path_root: ignoredRoot, ...input } = value;
  const expected = buildLoadedModuleTraceProposal(input);
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'loaded module trace is stale.');
  return expected;
}

function validateSurfaceScope(outerDealIds, rendererConfigurationIds) {
  if (!Array.isArray(outerDealIds) || outerDealIds.length !== DEAL_COUNT || new Set(outerDealIds).size !== DEAL_COUNT) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'surface output requires exactly 40 unique outer deals.');
  if (!Array.isArray(rendererConfigurationIds) || rendererConfigurationIds.length !== CONFIGURATION_COUNT || new Set(rendererConfigurationIds).size !== CONFIGURATION_COUNT) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'surface output requires exactly 19 unique renderer configurations.');
  outerDealIds.forEach((value) => text(value, 'outer_deal_id')); rendererConfigurationIds.forEach((value) => text(value, 'renderer_configuration_id'));
}
function buildSurfaceOutputProposal({ loaded_module_trace, outer_deal_ids, renderer_configuration_ids, slots } = {}) {
  const trace = validateLoadedModuleTraceProposal(loaded_module_trace);
  validateSurfaceScope(outer_deal_ids, renderer_configuration_ids);
  if (!Array.isArray(slots) || slots.length !== SLOT_COUNT) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'surface output requires exactly 760 slots.');
  const expectedPairs = new Set(outer_deal_ids.flatMap((deal) => renderer_configuration_ids.map((configuration) => `${deal}\u0000${configuration}`)));
  const normalised = slots.map((slot) => {
    if (!exactKeys(slot, ['dom_output_sha256', 'outer_deal_id', 'output_bytes_base64', 'renderer_configuration_id', 'surface_slot_id']) || !expectedPairs.has(`${slot.outer_deal_id}\u0000${slot.renderer_configuration_id}`)) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'every surface slot must belong to the declared 40 by 19 matrix.');
    if (slot.surface_slot_id !== outputSlotId(slot)) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'surface slot id must be derived from outer deal and renderer configuration.');
    if (slot.dom_output_sha256 !== sha256Hex(bytes(slot.output_bytes_base64, 'output_bytes_base64'))) fail('V1_REPLAY_EVIDENCE_INVALID', 'surface slot output hash must match exact bytes.');
    return freeze({ ...slot });
  }).sort((left, right) => left.surface_slot_id.localeCompare(right.surface_slot_id));
  if (new Set(normalised.map((slot) => slot.surface_slot_id)).size !== SLOT_COUNT) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'every 40 by 19 surface slot must occur exactly once.');
  const actualPairs = new Set(normalised.map((slot) => `${slot.outer_deal_id}\u0000${slot.renderer_configuration_id}`));
  if (actualPairs.size !== expectedPairs.size || [...expectedPairs].some((pair) => !actualPairs.has(pair))) fail('V1_REPLAY_SURFACE_COVERAGE_INVALID', 'surface output has incomplete 40 by 19 coverage.');
  const surface_output_root = contentId('V1_SURFACE_OUTPUT_ROOT/V1', { loaded_path_root: trace.loaded_path_root, slots: normalised });
  const body = { schema_version: SURFACE_OUTPUT_SCHEMA, status: NOT_ISSUED, authority: 'NONE', loaded_module_trace_id: trace.loaded_module_trace_id, loaded_path_root: trace.loaded_path_root, outer_deal_ids: freeze([...outer_deal_ids].sort()), renderer_configuration_ids: freeze([...renderer_configuration_ids].sort()), slots: freeze(normalised), surface_output_root };
  return freeze({ ...body, surface_output_id: contentId(SURFACE_OUTPUT_SCHEMA, body) });
}
function validateSurfaceOutputProposal(value, { loaded_module_trace } = {}) {
  const keys = ['authority', 'loaded_module_trace_id', 'loaded_path_root', 'outer_deal_ids', 'renderer_configuration_ids', 'schema_version', 'slots', 'status', 'surface_output_id', 'surface_output_root'];
  if (!exactKeys(value, keys) || value.schema_version !== SURFACE_OUTPUT_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_REPLAY_EVIDENCE_INVALID', 'surface output must remain an exact non-authoritative proposal.');
  const trace = validateLoadedModuleTraceProposal(loaded_module_trace);
  const { surface_output_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, loaded_path_root: ignoredRoot, surface_output_root: ignoredOutputRoot, loaded_module_trace_id: ignoredTrace, ...input } = value;
  const expected = buildSurfaceOutputProposal({ loaded_module_trace: trace, ...input });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'surface output is stale.');
  return expected;
}

function buildReplayReceiptProposal({ loaded_module_trace, surface_output, replay_nonce, process_id, temporary_directory_id, profile_id } = {}) {
  const trace = validateLoadedModuleTraceProposal(loaded_module_trace);
  const surface = validateSurfaceOutputProposal(surface_output, { loaded_module_trace: trace });
  [replay_nonce, process_id, temporary_directory_id, profile_id].forEach((value, index) => text(value, ['replay_nonce', 'process_id', 'temporary_directory_id', 'profile_id'][index]));
  const body = { schema_version: REPLAY_RECEIPT_SCHEMA, status: NOT_ISSUED, authority: 'NONE', loaded_module_trace_id: trace.loaded_module_trace_id, loaded_path_root: trace.loaded_path_root, surface_output_id: surface.surface_output_id, surface_output_root: surface.surface_output_root, replay_nonce, process_id, temporary_directory_id, profile_id };
  return freeze({ ...body, replay_receipt_id: contentId(REPLAY_RECEIPT_SCHEMA, body) });
}
function validateReplayReceiptProposal(value, { loaded_module_trace, surface_output } = {}) {
  const keys = ['authority', 'loaded_module_trace_id', 'loaded_path_root', 'process_id', 'profile_id', 'replay_nonce', 'replay_receipt_id', 'schema_version', 'status', 'surface_output_id', 'surface_output_root', 'temporary_directory_id'];
  if (!exactKeys(value, keys) || value.schema_version !== REPLAY_RECEIPT_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_REPLAY_EVIDENCE_INVALID', 'replay receipt must remain an exact non-authoritative proposal.');
  const { replay_receipt_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, loaded_module_trace_id: ignoredTrace, loaded_path_root: ignoredPathRoot, surface_output_id: ignoredOutput, surface_output_root: ignoredOutputRoot, ...input } = value;
  const expected = buildReplayReceiptProposal({ loaded_module_trace, surface_output, ...input });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'replay receipt is stale.');
  return expected;
}
function reconcileDistinctReplays({ first_replay, second_replay, loaded_module_trace, surface_output } = {}) {
  const first = validateReplayReceiptProposal(first_replay, { loaded_module_trace, surface_output });
  const second = validateReplayReceiptProposal(second_replay, { loaded_module_trace, surface_output });
  if (first.replay_receipt_id === second.replay_receipt_id || ['replay_nonce', 'process_id', 'temporary_directory_id', 'profile_id'].some((key) => first[key] === second[key])) fail('V1_REPLAY_NOT_DISTINCT', 'independent replays require distinct nonce, process, temporary directory and profile identifiers.');
  if (first.loaded_path_root !== second.loaded_path_root || first.surface_output_root !== second.surface_output_root) fail('V1_REPLAY_RECONCILIATION_FAILED', 'independent replays must share loaded-path and byte-identical surface-output roots.');
  return freeze({ replay_reconciliation_root: contentId('V1_REPLAY_RECONCILIATION_ROOT/V1', { first_replay_receipt_id: first.replay_receipt_id, second_replay_receipt_id: second.replay_receipt_id, loaded_path_root: first.loaded_path_root, surface_output_root: first.surface_output_root }), loaded_path_root: first.loaded_path_root, surface_output_root: first.surface_output_root });
}

function buildSourceDispositionProposal({ surface_output, surface_slot_id, disposition_kind, dom_node_id, source_record_id = null, source_byte_sha256 = null } = {}) {
  const slot = surface_output?.slots?.find((entry) => entry.surface_slot_id === surface_slot_id);
  if (!slot || !Object.hasOwn(DISPOSITION_REASON, disposition_kind)) fail('V1_REPLAY_DISPOSITION_INVALID', 'source disposition must bind one known surface slot and closed disposition kind.');
  text(dom_node_id, 'dom_node_id');
  const rendered = ['SOURCE_CARD', 'PROVISION', 'CLAIM'].includes(disposition_kind);
  if (rendered) { text(source_record_id, 'source_record_id'); digest(source_byte_sha256, 'source_byte_sha256'); }
  else if (source_record_id !== null || source_byte_sha256 !== null) fail('V1_REPLAY_DISPOSITION_INVALID', 'non-rendered dispositions cannot invent source records.');
  const body = { schema_version: SOURCE_DISPOSITION_SCHEMA, status: NOT_ISSUED, authority: 'NONE', surface_output_id: surface_output.surface_output_id, surface_slot_id, disposition_kind, disposition_reason: DISPOSITION_REASON[disposition_kind], dom_node_id, source_record_id, source_byte_sha256 };
  return freeze({ ...body, source_disposition_id: contentId(SOURCE_DISPOSITION_SCHEMA, body) });
}
function validateSourceDispositionProposal(value, { surface_output } = {}) {
  const keys = ['authority', 'disposition_kind', 'disposition_reason', 'dom_node_id', 'schema_version', 'source_byte_sha256', 'source_disposition_id', 'source_record_id', 'status', 'surface_output_id', 'surface_slot_id'];
  if (!exactKeys(value, keys) || value.schema_version !== SOURCE_DISPOSITION_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_REPLAY_DISPOSITION_INVALID', 'source disposition must remain exact and non-authoritative.');
  const { source_disposition_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, surface_output_id: ignoredOutput, disposition_reason: ignoredReason, ...input } = value;
  const expected = buildSourceDispositionProposal({ surface_output, ...input });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'source disposition is stale.');
  return expected;
}

function buildReferenceArchiveProposal({ source_dispositions } = {}) {
  if (!Array.isArray(source_dispositions)) fail('V1_REPLAY_REFERENCE_INVALID', 'source dispositions must be explicit.');
  const rendered = source_dispositions.filter((entry) => ['SOURCE_CARD', 'PROVISION', 'CLAIM'].includes(entry.disposition_kind));
  const occurrences = rendered.map((entry) => freeze({ reference_occurrence_id: contentId('V1_REFERENCE_OCCURRENCE/V1', { source_disposition_id: entry.source_disposition_id, source_record_id: entry.source_record_id, source_byte_sha256: entry.source_byte_sha256 }), source_disposition_id: entry.source_disposition_id, source_record_id: entry.source_record_id, source_byte_sha256: entry.source_byte_sha256 }));
  const edges = occurrences.map((entry) => freeze({ reference_edge_id: contentId('V1_REFERENCE_EDGE/V1', { reference_occurrence_id: entry.reference_occurrence_id, source_disposition_id: entry.source_disposition_id }), reference_occurrence_id: entry.reference_occurrence_id, source_disposition_id: entry.source_disposition_id, edge_kind: 'DOM_REFERENCES_SOURCE' }));
  const body = { schema_version: REFERENCE_ARCHIVE_SCHEMA, status: NOT_ISSUED, authority: 'NONE', source_disposition_ids: freeze(source_dispositions.map((entry) => entry.source_disposition_id).sort()), reference_occurrences: freeze(occurrences.sort((left, right) => left.reference_occurrence_id.localeCompare(right.reference_occurrence_id))), reference_edges: freeze(edges.sort((left, right) => left.reference_edge_id.localeCompare(right.reference_edge_id))) };
  return freeze({ ...body, reference_archive_id: contentId(REFERENCE_ARCHIVE_SCHEMA, body) });
}
function validateReferenceArchiveProposal(value, { source_dispositions } = {}) {
  const keys = ['authority', 'reference_archive_id', 'reference_edges', 'reference_occurrences', 'schema_version', 'source_disposition_ids', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== REFERENCE_ARCHIVE_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_REPLAY_REFERENCE_INVALID', 'reference archive must remain exact and non-authoritative.');
  const { reference_archive_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, ...input } = value;
  const expected = buildReferenceArchiveProposal({ source_dispositions });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'reference archive is stale.');
  return expected;
}

function buildValidatorDerivedLedgerProposal({ surface_output, source_dispositions, reference_archive } = {}) {
  const surface = surface_output;
  const bySlot = new Map();
  for (const entry of source_dispositions || []) {
    const disposition = validateSourceDispositionProposal(entry, { surface_output: surface });
    if (bySlot.has(disposition.surface_slot_id)) fail('V1_REPLAY_LEDGER_INVALID', 'each surface slot needs exactly one source disposition.');
    bySlot.set(disposition.surface_slot_id, disposition);
  }
  if (bySlot.size !== SLOT_COUNT || surface.slots.some((slot) => !bySlot.has(slot.surface_slot_id))) fail('V1_REPLAY_LEDGER_INVALID', 'ledger requires one source disposition for every 40 by 19 surface slot.');
  const archive = validateReferenceArchiveProposal(reference_archive, { source_dispositions: [...bySlot.values()] });
  const entries = surface.slots.map((slot) => {
    const disposition = bySlot.get(slot.surface_slot_id);
    const occurrence = archive.reference_occurrences.find((entry) => entry.source_disposition_id === disposition.source_disposition_id) || null;
    const edge = occurrence ? archive.reference_edges.find((entry) => entry.reference_occurrence_id === occurrence.reference_occurrence_id) : null;
    if (['SOURCE_CARD', 'PROVISION', 'CLAIM'].includes(disposition.disposition_kind) && (!occurrence || !edge)) fail('V1_REPLAY_LEDGER_INVALID', 'rendered source dispositions require DOM, source and reference lineage.');
    return freeze({ surface_slot_id: slot.surface_slot_id, dom_output_sha256: slot.dom_output_sha256, source_disposition_id: disposition.source_disposition_id, disposition_kind: disposition.disposition_kind, reference_occurrence_id: occurrence?.reference_occurrence_id || null, reference_edge_id: edge?.reference_edge_id || null });
  }).sort((left, right) => left.surface_slot_id.localeCompare(right.surface_slot_id));
  const reconstructed_ledger_root = contentId('V1_RECONSTRUCTED_LEDGER_ROOT/V1', { surface_output_root: surface.surface_output_root, entries });
  const body = { schema_version: VALIDATOR_LEDGER_SCHEMA, status: NOT_ISSUED, authority: 'NONE', surface_output_id: surface.surface_output_id, reference_archive_id: archive.reference_archive_id, entries: freeze(entries), reconstructed_ledger_root };
  return freeze({ ...body, validator_derived_ledger_id: contentId(VALIDATOR_LEDGER_SCHEMA, body) });
}
function validateValidatorDerivedLedgerProposal(value, { surface_output, source_dispositions, reference_archive } = {}) {
  const keys = ['authority', 'entries', 'reconstructed_ledger_root', 'reference_archive_id', 'schema_version', 'status', 'surface_output_id', 'validator_derived_ledger_id'];
  if (!exactKeys(value, keys) || value.schema_version !== VALIDATOR_LEDGER_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE') fail('V1_REPLAY_LEDGER_INVALID', 'validator ledger must remain exact and non-authoritative.');
  const { validator_derived_ledger_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, authority: ignoredAuthority, surface_output_id: ignoredOutput, reference_archive_id: ignoredArchive, reconstructed_ledger_root: ignoredRoot, ...input } = value;
  const expected = buildValidatorDerivedLedgerProposal({ surface_output, source_dispositions, reference_archive });
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'validator ledger is stale.');
  return expected;
}
function reconcileByteEqualLedgers({ first_ledger, second_ledger } = {}) {
  if (!first_ledger || !second_ledger || canonicalJson(first_ledger.entries) !== canonicalJson(second_ledger.entries) || first_ledger.reconstructed_ledger_root !== second_ledger.reconstructed_ledger_root) fail('V1_REPLAY_LEDGER_RECONCILIATION_FAILED', 'independent replays must reconstruct byte-equal ledgers.');
  return freeze({ byte_equal_ledger_root: first_ledger.reconstructed_ledger_root });
}

function buildAcquisitionAttestationProposal({ first_replay, second_replay, loaded_module_trace, surface_output, first_ledger, second_ledger } = {}) {
  const replay = reconcileDistinctReplays({ first_replay, second_replay, loaded_module_trace, surface_output });
  const ledger = reconcileByteEqualLedgers({ first_ledger, second_ledger });
  const body = { schema_version: ACQUISITION_ATTESTATION_SCHEMA, status: NOT_ISSUED, authority: 'NONE', pass_status: 'NOT_EVALUATED', first_replay_receipt_id: first_replay.replay_receipt_id, second_replay_receipt_id: second_replay.replay_receipt_id, replay_reconciliation_root: replay.replay_reconciliation_root, byte_equal_ledger_root: ledger.byte_equal_ledger_root };
  return freeze({ ...body, acquisition_attestation_id: contentId(ACQUISITION_ATTESTATION_SCHEMA, body) });
}
function validateAcquisitionAttestationProposal(value, input = {}) {
  const keys = ['acquisition_attestation_id', 'authority', 'byte_equal_ledger_root', 'first_replay_receipt_id', 'pass_status', 'replay_reconciliation_root', 'schema_version', 'second_replay_receipt_id', 'status'];
  if (!exactKeys(value, keys) || value.schema_version !== ACQUISITION_ATTESTATION_SCHEMA || value.status !== NOT_ISSUED || value.authority !== 'NONE' || value.pass_status !== 'NOT_EVALUATED') fail('V1_REPLAY_ATTESTATION_INVALID', 'acquisition attestation must remain exact and non-authoritative.');
  const expected = buildAcquisitionAttestationProposal(input);
  if (canonicalJson(expected) !== canonicalJson(value)) fail('V1_REPLAY_EVIDENCE_STALE', 'acquisition attestation is stale.');
  return expected;
}
function verifyFinalReplaySignature() { fail('V1_REPLAY_TRUST_REGISTRY_AMENDMENT_REQUIRED', 'Final replay signature verification is unavailable pending registry amendment and real execution.'); }
function issueReplayPass() { fail('V1_REPLAY_PASS_ISSUANCE_UNAVAILABLE', 'PASS issuance is unavailable pending registry amendment and real execution.'); }

module.exports = {
  LOADED_MODULE_TRACE_SCHEMA, SURFACE_OUTPUT_SCHEMA, REPLAY_RECEIPT_SCHEMA, SOURCE_DISPOSITION_SCHEMA, REFERENCE_ARCHIVE_SCHEMA, VALIDATOR_LEDGER_SCHEMA, ACQUISITION_ATTESTATION_SCHEMA, NOT_ISSUED, SLOT_COUNT, DEAL_COUNT, CONFIGURATION_COUNT, DISPOSITION_REASON,
  V1ReplayEvidenceProposalError, outputSlotId, buildLoadedModuleTraceProposal, validateLoadedModuleTraceProposal, buildSurfaceOutputProposal, validateSurfaceOutputProposal, buildReplayReceiptProposal, validateReplayReceiptProposal, reconcileDistinctReplays,
  buildSourceDispositionProposal, validateSourceDispositionProposal, buildReferenceArchiveProposal, validateReferenceArchiveProposal, buildValidatorDerivedLedgerProposal, validateValidatorDerivedLedgerProposal, reconcileByteEqualLedgers,
  buildAcquisitionAttestationProposal, validateAcquisitionAttestationProposal, verifyFinalReplaySignature, issueReplayPass,
};
