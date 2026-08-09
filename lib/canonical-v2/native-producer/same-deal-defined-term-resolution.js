'use strict';

// Agreement-local defined-term lookup. This module indexes recorded producer
// candidates only. It never searches source text for a replacement quote.

const { sha256Hex, utf8Slice } = require('../canonical-bytes');
const { buildSemanticSpan } = require('../source-structure');
const { canonicalEvidenceForEntry } = require('./structure-placement');
const { normaliseDefinedTermIdentity } = require('./anthropic-provider');

const INDEX_SCHEMA = 'SAME_DEAL_DEFINED_TERM_INDEX/V1';
const RESOLUTION_SCHEMA = 'SAME_DEAL_DEFINED_TERM_RESOLUTION/V1';
const OUTCOMES = Object.freeze({
  RESOLVED: 'RESOLVED',
  NO_DEFINITION: 'NO_DEFINITION',
  AMBIGUOUS_DEFINITION: 'AMBIGUOUS_DEFINITION',
  CONFLICTING_DEFINITION: 'CONFLICTING_DEFINITION',
  UNVERIFIED_DEFINITION: 'UNVERIFIED_DEFINITION',
  INERT: 'INERT',
});
const builtIndexes = new WeakSet();

function frozen(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(frozen));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, frozen(child)]),
  ));
  return value;
}

function inertIndex() {
  const index = Object.freeze({ schema_version: INDEX_SCHEMA, status: 'INERT', document_hash: null, entries: new Map(), calibration_id: null });
  builtIndexes.add(index);
  return index;
}

function calibrationIsExplicit(calibration) {
  return calibration && typeof calibration === 'object'
    && typeof calibration.calibration_id === 'string' && calibration.calibration_id.length > 0
    && typeof calibration.codebook_version === 'string' && calibration.codebook_version.length > 0
    && Array.isArray(calibration.allowed_assertion_kinds)
    && Array.isArray(calibration.composite_precedence)
    && calibration.integration_fixture_id;
}

function sectionFor(receipt, reference) {
  return (receipt.resolved_sections || []).find((section) => section.section_reference === reference) || null;
}

function proofFor({ claim, entry, receipt, source }) {
  const canonicalEvidence = canonicalEvidenceForEntry({ claim, evidence: entry.evidence });
  if (canonicalEvidence.status !== 'OK') return { ok: false, reason: canonicalEvidence.status === 'CONFLICT' ? 'EVIDENCE_CONFLICT' : 'EVIDENCE_MISSING' };
  const section = sectionFor(receipt, entry.section_reference);
  const text = source?.canonical_text?.text;
  if (!section || typeof text !== 'string' || !Number.isInteger(section.start)) return { ok: false, reason: 'SECTION_UNAVAILABLE' };
  const attrs = claim.attributes || {};
  const expectedByRole = new Map([['DEFINITION', attrs.definition_head_quote], ['OPERATIVE_TEXT', attrs.limb_quote]]);
  const proof = [];
  for (const [role, expected] of expectedByRole) {
    const edge = canonicalEvidence.evidence.find((item) => item.evidence_role === role)
      || (attrs.definition_head_quote === attrs.limb_quote ? canonicalEvidence.evidence[0] : null);
    if (!edge || typeof expected !== 'string' || !Number.isInteger(edge.absolute_start) || !Number.isInteger(edge.absolute_end)) {
      return { ok: false, reason: 'REQUIRED_EVIDENCE_MISSING' };
    }
    const start = section.start + edge.absolute_start;
    const end = section.start + edge.absolute_end;
    try {
      const exact = utf8Slice(text, start, end);
      if (exact !== expected) return { ok: false, reason: 'EVIDENCE_TEXT_MISMATCH' };
      const span = buildSemanticSpan(source, start, end);
      if (span.exact_bytes_digest !== sha256Hex(Buffer.from(exact, 'utf8'))) return { ok: false, reason: 'EVIDENCE_DIGEST_MISMATCH' };
      proof.push(frozen({ evidence_role: role, claim_evidence_id: edge.claim_evidence_id, excerpt_id: edge.excerpt_id, span }));
    } catch (_error) {
      return { ok: false, reason: 'EVIDENCE_BYTE_PROOF_FAILED' };
    }
  }
  return { ok: true, evidence: frozen(proof) };
}

function effectiveCode(records, calibration) {
  const codes = new Set(records.map((record) => record.code).filter(Boolean));
  const precedence = calibration.composite_precedence;
  for (const row of precedence) {
    if (!row || typeof row.code !== 'string') continue;
    const patterns = Array.isArray(row.patterns) ? row.patterns : [];
    if (codes.has(row.code) || patterns.some((pattern) => (
      typeof pattern === 'string' && records.some((record) => record.definition_text.toLowerCase().includes(pattern.toLowerCase()))
    ))) return row.code;
  }
  return codes.size === 1 ? [...codes][0] : null;
}

function hasCompositePrecedenceMatch(records, calibration) {
  return calibration.composite_precedence.some((row) => Array.isArray(row?.patterns)
    && row.patterns.some((pattern) => typeof pattern === 'string'
      && records.some((record) => record.definition_text.toLowerCase().includes(pattern.toLowerCase()))));
}

function candidateRecord({ receipt, entry, source, calibration }) {
  const claim = entry?.candidate?.claim;
  const attrs = claim?.attributes || {};
  if (entry?.ok !== true || claim?.claim_definition_key !== 'NATIVE_DEFINED_TERM_CANDIDATE'
    || !calibration.allowed_assertion_kinds.includes(attrs.assertion_kind)
    || typeof attrs.knowledge_term_ref !== 'string') return null;
  const identity = normaliseDefinedTermIdentity(attrs.knowledge_term_ref);
  if (!identity) return null;
  const verified = proofFor({ claim, entry, receipt, source });
  return frozen({
    identity,
    assertion_kind: attrs.assertion_kind,
    party: typeof attrs.knowledge_party === 'string' ? attrs.knowledge_party : null,
    code: typeof attrs.standard_code === 'string' ? attrs.standard_code : null,
    definition_text: `${attrs.definition_head_quote}\n${attrs.limb_quote}`,
    claim_occurrence_id: claim.claim_occurrence_id,
    // The producer emits one assertion per operative limb. A shared head is
    // one composed definition, including actual-knowledge plus inquiry.
    definition_body_fingerprint: sha256Hex(attrs.definition_head_quote),
    verified,
  });
}

function buildSameDealDefinedTermIndex({ key_defined_term_receipts: receipts, admitted_source_context: source, calibration } = {}) {
  if (!calibrationIsExplicit(calibration) || !Array.isArray(receipts) || receipts.length === 0) return inertIndex();
  const documentHash = source?.document_hash;
  if (typeof documentHash !== 'string' || !receipts.every((receipt) => receipt?.document_hash === documentHash)) return inertIndex();
  const entries = new Map();
  for (const receipt of receipts) {
    for (const entry of receipt.compiled_candidates || []) {
      const record = candidateRecord({ receipt, entry, source, calibration });
      if (!record) continue;
      const records = entries.get(record.identity) || [];
      records.push(record);
      entries.set(record.identity, records);
    }
  }
  for (const [identity, records] of entries) entries.set(identity, Object.freeze(records));
  const index = Object.freeze({
    schema_version: INDEX_SCHEMA,
    status: 'CALIBRATED',
    document_hash: documentHash,
    entries,
    calibration_id: calibration.calibration_id,
    calibration: frozen({
      codebook_version: calibration.codebook_version,
      generic_party_neutral: calibration.generic_party_neutral === true,
      composite_precedence: calibration.composite_precedence,
    }),
  });
  builtIndexes.add(index);
  return index;
}

function validateSameDealDefinedTermIndex(index, documentHash) {
  if (!builtIndexes.has(index) || index?.schema_version !== INDEX_SCHEMA
    || !['INERT', 'CALIBRATED'].includes(index.status)) throw new TypeError('same_deal_defined_terms must be an index built by this service');
  if (index.status === 'CALIBRATED' && index.document_hash !== documentHash) throw new TypeError('same_deal_defined_terms document_hash mismatch');
  return index;
}

function result(outcome, extra = {}) {
  return frozen({ outcome, value: null, definition_evidence: [], definition_identity: null, definition_party: null, provenance: null, ...extra });
}

function resolveSameDealDefinedTerm({ index, term_ref: termRef, use_party: useParty, requested_kind: requestedKind } = {}) {
  if (!index || index.status === 'INERT') return result(OUTCOMES.INERT);
  const identity = normaliseDefinedTermIdentity(termRef);
  if (!identity) return result(OUTCOMES.NO_DEFINITION);
  const records = (index.entries.get(identity) || []).filter((record) => record.assertion_kind === requestedKind);
  const eligible = records.filter((record) => record.party === useParty
    || (record.party === null && index.calibration.generic_party_neutral));
  if (eligible.length === 0) {
    if (records.some((record) => record.party === null && !index.calibration.generic_party_neutral)) return result(OUTCOMES.AMBIGUOUS_DEFINITION);
    return result(OUTCOMES.NO_DEFINITION);
  }
  if (eligible.some((record) => !record.verified.ok)) return result(OUTCOMES.UNVERIFIED_DEFINITION);
  const bodyFingerprints = new Set(eligible.map((record) => record.definition_body_fingerprint));
  const codes = new Set(eligible.map((record) => record.code).filter(Boolean));
  if (codes.size > 1 && !hasCompositePrecedenceMatch(eligible, index.calibration)) return result(OUTCOMES.CONFLICTING_DEFINITION);
  const value = effectiveCode(eligible, index.calibration);
  if (!value) return result(OUTCOMES.CONFLICTING_DEFINITION);
  if (bodyFingerprints.size > 1) {
    if (codes.size > 1) return result(OUTCOMES.CONFLICTING_DEFINITION);
    return result(OUTCOMES.AMBIGUOUS_DEFINITION);
  }
  const unique = new Map();
  for (const record of eligible) {
    const key = `${record.party}:${record.code}:${record.verified.evidence.map((item) => (
      `${item.evidence_role}:${item.span.absolute_start}:${item.span.absolute_end}:${item.span.exact_bytes_digest}`
    )).join('|')}`;
    if (!unique.has(key)) unique.set(key, record);
  }
  const selected = [...unique.values()];
  return result(OUTCOMES.RESOLVED, {
    value,
    definition_identity: identity,
    definition_party: selected.some((record) => record.party === useParty) ? useParty : null,
    definition_evidence: frozen(selected.flatMap((record) => record.verified.evidence)),
    provenance: frozen({
      schema_version: RESOLUTION_SCHEMA,
      calibration_id: index.calibration_id,
      source_claim_occurrence_ids: selected.map((record) => record.claim_occurrence_id),
      definition_evidence_ids: selected.flatMap((record) => record.verified.evidence.map((item) => item.claim_evidence_id)),
      document_hash: index.document_hash,
    }),
  });
}

module.exports = {
  INDEX_SCHEMA,
  RESOLUTION_SCHEMA,
  OUTCOMES,
  buildSameDealDefinedTermIndex,
  validateSameDealDefinedTermIndex,
  resolveSameDealDefinedTerm,
};
