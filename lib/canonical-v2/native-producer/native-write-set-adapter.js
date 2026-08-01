/**
 * lib/canonical-v2/native-producer/native-write-set-adapter.js
 *
 * The boundary where candidates leave `runNativeExtraction`'s run receipt
 * and enter the canonical write path. This module owns exactly one job:
 * turn a run receipt's SECTION-LOCAL evidence into a write set whose
 * evidence is DOCUMENT-ABSOLUTE, in the exact shape validate-write-set.js's
 * `validateResolvedCanonicalWriteSet` expects -- and never let the two
 * coordinate frames mix silently.
 *
 * THE HAZARD THIS CLOSES (docs/codex-program/EXECUTION-LEDGER.md, "OPEN
 * INTEGRATION HAZARD"). `runNativeExtraction` licenses each producer call
 * with only ONE resolved section's own text (`governed_scope.source_text`),
 * so every compiled candidate's evidence `absolute_start`/`absolute_end` is
 * necessarily local to that section's bytes, not the document's. The run
 * receipt separately carries each resolved section's OWN document-absolute
 * `start`/`end`. This module is where `section.start + local_offset` gets
 * computed, once, and nowhere else -- so no downstream stage can mistake a
 * section-local offset for a document-absolute one.
 *
 * WHY IDENTITY MUST BE RE-DERIVED, NOT JUST SHIFTED. The producer boundary
 * (`anthropic-provider.js`) mints each evidence edge's `excerpt_id` from a
 * domain keyed on `{quote, start, end}` where `start`/`end` are section-
 * local -- it is NOT a real `EXCERPT/V1` identity per source-structure.js
 * (that requires a `canonical_text_id` bound to the FULL document, which the
 * producer is never shown). `claim_evidence_id`/`relationship_evidence_id`
 * are in turn content-addressed FROM that excerpt_id, and the revision's own
 * `claim_revision_id`/`relationship_revision_id` embeds `evidence_ids` in
 * its own identity payload (see claims-relationships.js). So shifting the
 * offsets without re-deriving the excerpt (and everything hashed on top of
 * it) would leave the row's own stated identity referring to bytes that no
 * longer exist under that id -- a `CANONICAL_IDENTITY_MISMATCH` waiting to
 * happen, or worse, an identity that happens to validate against the wrong
 * text. This module rebuilds, in order: the excerpt (via source-structure.js
 * `buildExcerpt`, against the real admitted source context so its identity
 * is genuinely document-absolute) -> the evidence edge id -> the revision
 * id. `claim_occurrence_id`/`relationship_occurrence_id` are NOT re-derived:
 * neither depends on evidence, so the "same claim slot, new evidence
 * revision" semantics fall out for free. `closure_id` is likewise NOT
 * re-derived: candidate-proposal-compiler.js already minted one per
 * independently-produced candidate, and validate-write-set.js treats it as
 * an opaque quarantine-isolation token it never recomputes -- carrying it
 * forward unchanged is what "preserving per-candidate closure_id" means.
 * `retained_residuals`/`quarantine`/`publication_state` are also carried
 * forward unchanged in CONTENT (nothing about evidence coordinates bears on
 * whether an attribute or taxonomy code was already unknown at compile
 * time), but each retained residual's own `retained_residual_id` /
 * `affected_object_id` IS re-derived against the new revision id, so the
 * write set never carries a residual pointing at a stale, no-longer-issued
 * revision id.
 *
 * WHAT THIS MODULE DOES NOT SOLVE (reported, not silently worked around).
 * `subject_occurrence_id` (claims) / `source_occurrence_id` and
 * `target_occurrence_ids` (relationships) are minted by whichever producer
 * produced the proposals from data the run receipt does not carry (no
 * concept_key, no party) -- they are not offset-derived, so there is
 * nothing for this module to "re-derive" about them, and the run receipt
 * gives this module no way to construct the PROVISION_INSTANCE/V1 (etc) row
 * they would need to resolve against under validate-write-set.js's closed
 * occurrence contracts. This module passes them through verbatim. A caller
 * assembling a full write set is responsible for supplying the matching
 * `provisions`/`components`/`definition_occurrences` rows if it wants those
 * references to resolve; see the adapter test and its report for the full
 * finding.
 *
 * FAIL CLOSED, TYPED, NEVER A SILENT DROP. Structural mismatches between
 * the four inputs (wrong document, wrong section geometry, a compiled
 * candidate naming a section the receipt never resolved) abort the whole
 * call with a typed `NativeWriteSetAdapterError` -- these indicate the
 * caller wired the wrong document, not a per-candidate defect. A single
 * candidate whose evidence fails to shift or fails to byte-verify against
 * the admitted source is excluded from the write set (its identity chain is
 * broken; there is nothing safe to write) but is NEVER silently omitted --
 * it is recorded, with its own reason code and closure_id, in this module's
 * own residual channel alongside the provider's own `evidence_residuals`
 * and the run's `scope_violations`, so nothing the extractor found and
 * could not evidence is lost between the run receipt and the write set.
 */

'use strict';

const { contentId, sha256Hex } = require('../canonical-bytes');
const { buildExcerpt, buildSemanticSpan } = require('../source-structure');
const { buildAdmittedSourceReference } = require('../admitted-semantic-source');
const { RUN_RECEIPT_SCHEMA } = require('./native-extraction-run');

const ADAPTER_RESULT_SCHEMA = 'NATIVE_WRITE_SET_ADAPTER_RESULT/V1';
const EXCERPT_CLOSURE_DOMAIN = 'NATIVE_WRITE_SET_EXCERPT_CLOSURE/V1';
const RETAINED_RESIDUAL_DOMAIN = 'RETAINED_RESIDUAL/V1';

// Validator origin discriminator (docs/superpowers/specs/2026-08-01-claim-
// identity-provenance-design.md, "Pinned implementation decisions"):
// validate-write-set.js's staged `answer_provenance` requirement keys on
// this. This module is the ONE place a native-producer write set is ever
// assembled, so it is the one place that gets to set it -- a caller building
// a reviewed-slice write set by other means never sets it at all, which is
// exactly the untouched, non-required path.
const WRITE_SET_ORIGIN_NATIVE_PRODUCER = 'NATIVE_PRODUCER';

// The 16 collection keys `validate-write-set.js`'s DEAL_SCOPE_WRITE_SET_KEYS
// requires beyond `source_references`/`deal` (see CANONICAL_COLLECTION_KEYS,
// CONDITION_GROUP_COLLECTION_KEYS, SEMANTIC_GRAPH_COLLECTION_KEYS and
// OPEN_WORLD_COLLECTION_KEYS there). This adapter only ever populates
// `excerpts`, `claims` and `relationships`; every other collection is
// present-but-empty because nothing here produces that kind of row.
const EMPTY_COLLECTION_KEYS = Object.freeze([
  'definition_occurrences',
  'provisions',
  'components',
  'condition_groups',
  'validated_semantic_graphs',
  'open_world_candidates',
  'open_world_candidate_occurrences',
  'open_world_evidence_references',
  'open_world_candidate_dispositions',
  'open_world_primitives',
  'semantic_impact_closures',
  'reviewed_source_specific_rows',
  'incomplete_canonical_result_rows',
]);

class NativeWriteSetAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeWriteSetAdapterError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NativeWriteSetAdapterError(code, message, details);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_INPUT', `${label} must be a non-empty string`);
  }
  return value;
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', `${label} must be a plain object`);
  }
  return value;
}

function requireRunReceipt(runReceipt) {
  requirePlainObject(runReceipt, 'run_receipt');
  if (runReceipt.schema_version !== RUN_RECEIPT_SCHEMA) {
    fail('INVALID_RUN_RECEIPT', `run_receipt.schema_version must be ${RUN_RECEIPT_SCHEMA}`, {
      schema_version: runReceipt.schema_version,
    });
  }
  if (!Array.isArray(runReceipt.resolved_sections)) {
    fail('INVALID_RUN_RECEIPT', 'run_receipt.resolved_sections must be an array');
  }
  if (!Array.isArray(runReceipt.compiled_candidates)) {
    fail('INVALID_RUN_RECEIPT', 'run_receipt.compiled_candidates must be an array');
  }
  return runReceipt;
}

// ---------------------------------------------------------------------------
// Evidence-edge sort/id/revision recomputation -- deliberately reimplemented
// against the PUBLIC, exported `contentId` rather than importing the
// private helpers inside claims-relationships.js (which are not exported,
// and that file is frozen/off-limits for this change). The formulas below
// are the exact ones documented in claims-relationships.js's
// `compareEvidence`/`normalizeEvidence`/revision-payload construction and
// mirrored again in validate-write-set.js's own `expectedObjectId` -- three
// independent call sites computing the identical hash, which is the point:
// this module does not get to invent its own identity scheme.
// ---------------------------------------------------------------------------

function compareEvidence(a, b) {
  const fields = ['document_ordinal', 'absolute_start', 'absolute_end'];
  for (const field of fields) {
    if (a[field] !== b[field]) return a[field] - b[field];
  }
  if (a.evidence_role !== b.evidence_role) return a.evidence_role.localeCompare(b.evidence_role);
  return a.excerpt_id.localeCompare(b.excerpt_id);
}

function rebuildEvidenceArray({ edges, occurrenceId, kind }) {
  const domain = `${kind.toUpperCase()}_EVIDENCE/V1`;
  const idField = `${kind}_evidence_id`;
  const sorted = [...edges].sort(compareEvidence);
  return sorted.map((edge, ordinal) => {
    const id = contentId(domain, {
      occurrence_id: occurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    });
    return Object.freeze({
      schema_version: domain,
      [idField]: id,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
      ordinal,
    });
  });
}

const CLAIM_REVISION_PAYLOAD_FIELDS = [
  'claim_occurrence_id', 'subject_occurrence_id', 'claim_definition_key', 'claim_definition_version',
  'ordinal', 'state', 'raw_value', 'canonical_value', 'unit', 'day_basis', 'denominator',
  'scope', 'applicability', 'not_examined', 'failure', 'attributes', 'taxonomy_codes',
  'extraction_version', 'normalisation_version', 'derivation_version',
];
const RELATIONSHIP_REVISION_PAYLOAD_FIELDS = [
  'relationship_occurrence_id', 'source_occurrence_id', 'relationship_definition_key',
  'relationship_definition_version', 'ordinal', 'state', 'raw_scope', 'scope', 'applicability',
  'not_examined', 'failure', 'target_occurrence_ids', 'effect', 'attributes', 'taxonomy_codes',
  'resolver_version',
];

function recomputeRevisionId(kind, row, evidenceIds) {
  const domain = kind === 'claim' ? 'CLAIM_REVISION/V1' : 'RELATIONSHIP_REVISION/V1';
  const fields = kind === 'claim' ? CLAIM_REVISION_PAYLOAD_FIELDS : RELATIONSHIP_REVISION_PAYLOAD_FIELDS;
  const payload = {};
  for (const field of fields) payload[field] = row[field];
  payload.evidence_ids = evidenceIds;
  return contentId(domain, payload);
}

// Re-keys each already-computed retained residual against the NEW revision
// id (the "stable id" a residual is filed against), without recomputing
// WHICH residuals exist or why -- that judgment was already made once, at
// compile time, from content this module never re-examines (attribute
// allow-lists / taxonomy codebooks are not carried on the compiled row).
function rebuildRetainedResiduals({ objectType, oldRow, newStableId }) {
  const source = Array.isArray(oldRow.retained_residuals) ? oldRow.retained_residuals : [];
  const retained = source.map((entry, ordinal) => {
    const {
      schema_version: _schemaVersion,
      retained_residual_id: _oldId,
      affected_object_type: _oldType,
      affected_object_id: _oldObjectId,
      ...residual
    } = entry;
    return Object.freeze({
      schema_version: 'RETAINED_RESIDUAL/V1',
      retained_residual_id: contentId(RETAINED_RESIDUAL_DOMAIN, {
        objectType, stableId: newStableId, ordinal, residual,
      }),
      affected_object_type: objectType,
      affected_object_id: newStableId,
      ...residual,
    });
  });
  const quarantined = retained.length > 0;
  return {
    retained_residuals: Object.freeze(retained),
    quarantine: quarantined ? Object.freeze({
      affected_object_type: objectType,
      affected_object_id: newStableId,
      reason_codes: Object.freeze([...new Set(retained.map((item) => item.reason))]),
    }) : null,
    publication_state: quarantined ? 'QUARANTINED' : 'VALIDATED',
  };
}

// `attributes` (and therefore any `attributes.answer_provenance` candidate-
// resolution.js already minted -- spec section 5) is carried through
// VERBATIM here, exactly like every other non-identity extra this pipeline
// stores there: it plays no part in the coordinate shift this module exists
// to perform, and `recomputeRevisionId` above already hashes it into the new
// claim_revision_id because `attributes` is one of CLAIM_REVISION_PAYLOAD_
// FIELDS -- so the field survives re-derivation for free, not by accident.
function rebuildClaimRow({ row, evidence, evidenceIds, closureId }) {
  const claimRevisionId = recomputeRevisionId('claim', row, evidenceIds);
  const residualBits = rebuildRetainedResiduals({
    objectType: 'ClaimRevision', oldRow: row, newStableId: claimRevisionId,
  });
  return Object.freeze({
    schema_version: 'CLAIM_REVISION/V1',
    claim_revision_id: claimRevisionId,
    claim_occurrence_id: row.claim_occurrence_id,
    subject_occurrence_id: row.subject_occurrence_id,
    claim_definition_key: row.claim_definition_key,
    claim_definition_version: row.claim_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_value: row.raw_value,
    canonical_value: row.canonical_value,
    unit: row.unit,
    day_basis: row.day_basis,
    denominator: row.denominator,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    evidence_ids: evidenceIds,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    extraction_version: row.extraction_version,
    normalisation_version: row.normalisation_version,
    derivation_version: row.derivation_version,
    evidence,
    publication_state: residualBits.publication_state,
    retained_residuals: residualBits.retained_residuals,
    quarantine: residualBits.quarantine,
    closure_id: closureId,
  });
}

function rebuildRelationshipRow({ row, evidence, evidenceIds, closureId }) {
  const relationshipRevisionId = recomputeRevisionId('relationship', row, evidenceIds);
  const residualBits = rebuildRetainedResiduals({
    objectType: 'RelationshipRevision', oldRow: row, newStableId: relationshipRevisionId,
  });
  return Object.freeze({
    schema_version: 'RELATIONSHIP_REVISION/V1',
    relationship_revision_id: relationshipRevisionId,
    relationship_occurrence_id: row.relationship_occurrence_id,
    source_occurrence_id: row.source_occurrence_id,
    relationship_definition_key: row.relationship_definition_key,
    relationship_definition_version: row.relationship_definition_version,
    ordinal: row.ordinal,
    state: row.state,
    raw_scope: row.raw_scope,
    scope: row.scope,
    applicability: row.applicability,
    not_examined: row.not_examined,
    failure: row.failure,
    target_occurrence_ids: row.target_occurrence_ids,
    effect: row.effect,
    evidence_ids: evidenceIds,
    attributes: row.attributes,
    taxonomy_codes: row.taxonomy_codes,
    resolver_version: row.resolver_version,
    evidence,
    publication_state: residualBits.publication_state,
    retained_residuals: residualBits.retained_residuals,
    quarantine: residualBits.quarantine,
    closure_id: closureId,
  });
}

// ---------------------------------------------------------------------------
// Per-edge coordinate shift + verification.
// ---------------------------------------------------------------------------

// `expectedText` is what this edge is claimed to reproduce once shifted.
// For `claim` candidates this pipeline only ever produces evidence whose
// (section-local) slice already equals the compiled row's own `raw_value`
// -- `native-extraction-run.js`'s own `checkEvidenceScope` enforces exactly
// that before compilation ever happens -- so re-checking against
// `raw_value` after the shift is the direct, byte-exact proof that the
// shift preserved what the section-local check already proved. Relationship
// proposals carry no single row-level text (`raw_scope` describes the
// relationship's scope, not each evidence edge), so for `relationship`
// candidates this falls back to the section-local slice at the SAME local
// offsets recorded on the compiled row -- still a genuine, non-tautological
// proof that shifting did not corrupt the edge, just anchored to the
// receipt's own previously-proven text rather than to a single label field.
function expectedTextForEdge({ kind, row, edge, sectionBytes }) {
  if (kind === 'claim' && typeof row.raw_value === 'string') return row.raw_value;
  if (edge.absolute_end > sectionBytes.length) return null;
  return sectionBytes.subarray(edge.absolute_start, edge.absolute_end).toString('utf8');
}

function shiftEdge({
  kind, row, edge, section, sectionBytes, fullBytes,
}) {
  if (!Number.isSafeInteger(edge.absolute_start) || edge.absolute_start < 0
    || !Number.isSafeInteger(edge.absolute_end) || edge.absolute_end <= edge.absolute_start) {
    return { ok: false, reason: 'EVIDENCE_LOCAL_OFFSETS_INVALID' };
  }
  const absoluteStart = section.start + edge.absolute_start;
  const absoluteEnd = section.start + edge.absolute_end;
  if (absoluteEnd > section.end) {
    return { ok: false, reason: 'EVIDENCE_SHIFT_OUTSIDE_RESOLVED_SECTION' };
  }
  if (absoluteStart < 0 || absoluteEnd > fullBytes.length) {
    return { ok: false, reason: 'EVIDENCE_SHIFT_OUTSIDE_DOCUMENT' };
  }
  const expected = expectedTextForEdge({
    kind, row, edge, sectionBytes,
  });
  if (expected == null) {
    return { ok: false, reason: 'EVIDENCE_LOCAL_TEXT_UNRESOLVABLE' };
  }
  const actual = fullBytes.subarray(absoluteStart, absoluteEnd).toString('utf8');
  if (actual !== expected) {
    return {
      ok: false, reason: 'EVIDENCE_SHIFT_TEXT_MISMATCH', expected, actual,
    };
  }
  return {
    ok: true, absoluteStart, absoluteEnd, text: actual,
  };
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

/**
 * @param {object} args
 * @param {object} args.run_receipt              a frozen run receipt from
 *   `runNativeExtraction` (native-extraction-run.js) -- section-local evidence.
 * @param {string} args.source_text              the exact admitted document text
 *   the run receipt was produced against, in full (not a section slice).
 * @param {string} args.document_hash            content hash binding this call to
 *   `source_text`; must agree with both the run receipt and the admitted context.
 * @param {object} args.admitted_source_context   an `ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1`
 *   (admitted-semantic-source.js) whose `canonical_text.text` is `source_text`.
 * @returns {{
 *   schema_version: string,
 *   write_set: object,
 *   admitted_source_contexts: object[],
 *   residuals: object[],
 *   counts: object,
 * }}
 */
function buildNativeWriteSet({
  run_receipt: runReceiptInput,
  source_text: sourceText,
  document_hash: documentHash,
  admitted_source_context: admittedSourceContext,
} = {}) {
  const runReceipt = requireRunReceipt(runReceiptInput);
  requireNonEmptyString(sourceText, 'source_text');
  requireNonEmptyString(documentHash, 'document_hash');
  requirePlainObject(admittedSourceContext, 'admitted_source_context');

  if (runReceipt.document_hash !== documentHash) {
    fail('DOCUMENT_HASH_MISMATCH', 'document_hash does not match run_receipt.document_hash', {
      expected: runReceipt.document_hash, actual: documentHash,
    });
  }
  if (admittedSourceContext.document_hash !== documentHash) {
    fail('DOCUMENT_HASH_MISMATCH', 'document_hash does not match admitted_source_context.document_hash', {
      expected: admittedSourceContext.document_hash, actual: documentHash,
    });
  }
  if (admittedSourceContext.canonical_text?.text !== sourceText) {
    fail('SOURCE_TEXT_MISMATCH', 'source_text does not match admitted_source_context.canonical_text.text');
  }

  const fullBytes = Buffer.from(sourceText, 'utf8');
  if (fullBytes.length !== runReceipt.source_byte_length) {
    fail('SOURCE_LENGTH_MISMATCH', 'source_text byte length does not match run_receipt.source_byte_length', {
      expected: runReceipt.source_byte_length, actual: fullBytes.length,
    });
  }
  const sourceSha256 = sha256Hex(fullBytes);
  if (runReceipt.source_sha256 && sourceSha256 !== runReceipt.source_sha256) {
    fail('SOURCE_HASH_MISMATCH', 'source_text does not hash to run_receipt.source_sha256: this is not the document the receipt was produced against', {
      expected: runReceipt.source_sha256, actual: sourceSha256,
    });
  }

  const sectionsByReference = new Map(
    runReceipt.resolved_sections.map((section) => [section.section_reference, section]),
  );

  const excerptsById = new Map();
  const claims = [];
  const relationships = [];
  const residuals = [];

  function residualPush(entry) {
    residuals.push(Object.freeze(entry));
  }

  function excerptFor(absoluteStart, absoluteEnd) {
    let span;
    let excerpt;
    try {
      span = buildSemanticSpan(admittedSourceContext, absoluteStart, absoluteEnd);
      excerpt = buildExcerpt({ source: admittedSourceContext, span });
    } catch (error) {
      return { ok: false, reason: 'EXCERPT_CONSTRUCTION_FAILED', message: error.message };
    }
    const cached = excerptsById.get(excerpt.excerpt_id);
    if (cached) return { ok: true, excerpt: cached };
    const closureId = contentId(EXCERPT_CLOSURE_DOMAIN, { excerpt_id: excerpt.excerpt_id });
    const row = Object.freeze({ ...excerpt, closure_id: closureId });
    excerptsById.set(excerpt.excerpt_id, row);
    return { ok: true, excerpt: row };
  }

  let candidatesRejectedByCompiler = 0;
  let candidatesRejectedByShift = 0;

  for (const entry of runReceipt.compiled_candidates) {
    if (!entry || entry.ok !== true) {
      candidatesRejectedByCompiler += 1;
      residualPush({
        residual_type: 'REJECTED_CANDIDATE',
        section_reference: entry && entry.section_reference != null ? entry.section_reference : null,
        reason_code: entry && entry.reason_code != null ? entry.reason_code : 'UNKNOWN_COMPILER_REJECTION',
        message: entry && entry.message != null ? entry.message : null,
      });
      continue;
    }

    const { candidate, section_reference: sectionReference } = entry;
    const section = sectionsByReference.get(sectionReference);
    if (!section) {
      fail('SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT', 'a compiled candidate names a section the run receipt never resolved -- the receipt is internally inconsistent', {
        section_reference: sectionReference,
      });
    }

    const kind = candidate.kind;
    const row = candidate[kind];
    const occurrenceId = kind === 'claim' ? row.claim_occurrence_id : row.relationship_occurrence_id;
    const sectionBytes = fullBytes.subarray(section.start, section.end);

    const shiftedEdges = [];
    let failure = null;
    for (const edge of row.evidence) {
      const shifted = shiftEdge({
        kind, row, edge, section, sectionBytes, fullBytes,
      });
      if (!shifted.ok) {
        failure = { ...shifted, edge };
        break;
      }
      shiftedEdges.push({ edge, shifted });
    }

    if (failure) {
      candidatesRejectedByShift += 1;
      residualPush({
        residual_type: 'EVIDENCE_COORDINATE_SHIFT_FAILED',
        section_reference: sectionReference,
        kind,
        occurrence_id: occurrenceId,
        closure_id: row.closure_id,
        reason_code: failure.reason,
        expected: failure.expected ?? null,
        actual: failure.actual ?? null,
        edge: failure.edge,
      });
      continue;
    }

    const finalEdges = [];
    let excerptFailure = null;
    for (const { edge, shifted } of shiftedEdges) {
      const built = excerptFor(shifted.absoluteStart, shifted.absoluteEnd);
      if (!built.ok) {
        excerptFailure = { ...built, edge };
        break;
      }
      finalEdges.push({
        evidence_role: edge.evidence_role,
        excerpt_id: built.excerpt.excerpt_id,
        document_ordinal: admittedSourceContext.source_ordinal,
        absolute_start: shifted.absoluteStart,
        absolute_end: shifted.absoluteEnd,
      });
    }

    if (excerptFailure) {
      candidatesRejectedByShift += 1;
      residualPush({
        residual_type: 'EVIDENCE_COORDINATE_SHIFT_FAILED',
        section_reference: sectionReference,
        kind,
        occurrence_id: occurrenceId,
        closure_id: row.closure_id,
        reason_code: excerptFailure.reason,
        message: excerptFailure.message ?? null,
        edge: excerptFailure.edge,
      });
      continue;
    }

    const evidenceArray = rebuildEvidenceArray({ edges: finalEdges, occurrenceId, kind });
    const idField = `${kind}_evidence_id`;
    const evidenceIds = evidenceArray.map((item) => item[idField]);

    if (kind === 'claim') {
      claims.push(rebuildClaimRow({
        row, evidence: evidenceArray, evidenceIds, closureId: row.closure_id,
      }));
    } else {
      relationships.push(rebuildRelationshipRow({
        row, evidence: evidenceArray, evidenceIds, closureId: row.closure_id,
      }));
    }
  }

  for (const item of (runReceipt.evidence_residuals || [])) {
    residualPush({ residual_type: 'PROVIDER_EVIDENCE_RESIDUAL', ...item });
  }
  for (const item of (runReceipt.scope_violations || [])) {
    residualPush({ residual_type: 'SCOPE_VIOLATION', ...item });
  }

  const sourceReference = buildAdmittedSourceReference(admittedSourceContext);
  const writeSet = {
    source_references: [sourceReference],
    write_set_origin: WRITE_SET_ORIGIN_NATIVE_PRODUCER,
    deal: {
      deal_key: admittedSourceContext.governed_deal_key,
      deal_admission_id: admittedSourceContext.deal_admission_id,
      document_hash: admittedSourceContext.document_hash,
    },
    excerpts: [...excerptsById.values()],
    claims,
    relationships,
    ...Object.fromEntries(EMPTY_COLLECTION_KEYS.map((key) => [key, []])),
  };

  return Object.freeze({
    schema_version: ADAPTER_RESULT_SCHEMA,
    write_set: Object.freeze(writeSet),
    admitted_source_contexts: Object.freeze([admittedSourceContext]),
    residuals: Object.freeze(residuals),
    counts: Object.freeze({
      candidates_total: runReceipt.compiled_candidates.length,
      candidates_written: claims.length + relationships.length,
      candidates_rejected_by_compiler: candidatesRejectedByCompiler,
      candidates_rejected_by_coordinate_shift: candidatesRejectedByShift,
      excerpts_written: excerptsById.size,
      residuals: residuals.length,
    }),
  });
}

module.exports = {
  ADAPTER_RESULT_SCHEMA,
  WRITE_SET_ORIGIN_NATIVE_PRODUCER,
  NativeWriteSetAdapterError,
  buildNativeWriteSet,
};
