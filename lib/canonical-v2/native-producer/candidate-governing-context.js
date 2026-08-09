'use strict';

const { utf8Slice, sha256Hex } = require('../canonical-bytes');
const { canonicalEvidenceForEntry } = require('./structure-placement');
const {
  buildSectionOutline,
  resolveGoverningStructure,
  SEGMENTER_VERSION,
} = require('./governing-structure');

const SCHEMA_VERSION = 'CANDIDATE_GOVERNING_CONTEXT/V1';

const REASONS = Object.freeze({
  EVIDENCE_MISSING: 'EVIDENCE_MISSING',
  EVIDENCE_CONFLICT: 'EVIDENCE_CONFLICT',
  EVIDENCE_NOT_SINGLE_OPERATIVE: 'EVIDENCE_NOT_SINGLE_OPERATIVE',
  EVIDENCE_BYTES_MISMATCH: 'EVIDENCE_BYTES_MISMATCH',
  SECTION_UNAVAILABLE: 'SECTION_UNAVAILABLE',
});

function undetermined(reason) {
  return Object.freeze({
    status: 'UNDETERMINED',
    reason,
    schema_version: SCHEMA_VERSION,
    segmenter_version: SEGMENTER_VERSION,
  });
}

function recordForSpan(text, startByte, endByte, extra = {}) {
  const spanText = utf8Slice(text, startByte, endByte);
  return Object.freeze({
    ...extra,
    start_byte: startByte,
    end_byte: endByte,
    exact_bytes_digest: sha256Hex(Buffer.from(spanText, 'utf8')),
    text: spanText,
  });
}

function sectionReferenceFor(entry, claim) {
  const entryReference = entry?.section_reference;
  const claimReference = claim?.attributes?.section_reference;
  if (typeof entryReference === 'string' && entryReference.length > 0) return entryReference;
  return typeof claimReference === 'string' && claimReference.length > 0 ? claimReference : null;
}

function candidateClaim(entry, claim) {
  return claim || entry?.candidate?.claim || entry?.claim || null;
}

function createCandidateGoverningContext({
  admittedSourceContext = null,
  sectionsByReference = null,
  outlineByReference = new Map(),
} = {}) {
  const sourceText = admittedSourceContext?.canonical_text?.text;
  const cache = outlineByReference && typeof outlineByReference.get === 'function'
    && typeof outlineByReference.set === 'function'
    ? outlineByReference
    : new Map();

  function forCandidate({ entry = null, claim: suppliedClaim = null } = {}) {
    const claim = candidateClaim(entry, suppliedClaim);
    const canonicalEvidence = canonicalEvidenceForEntry({
      claim,
      evidence: entry?.evidence,
    });
    if (canonicalEvidence.status === 'CONFLICT') return undetermined(REASONS.EVIDENCE_CONFLICT);
    if (canonicalEvidence.status !== 'OK') return undetermined(REASONS.EVIDENCE_MISSING);

    const operative = canonicalEvidence.evidence.filter((edge) => edge?.evidence_role === 'OPERATIVE_TEXT');
    if (operative.length !== 1 || canonicalEvidence.evidence.length !== 1) {
      return undetermined(REASONS.EVIDENCE_NOT_SINGLE_OPERATIVE);
    }
    const edge = operative[0];
    if (!Number.isInteger(edge.absolute_start) || !Number.isInteger(edge.absolute_end)
      || edge.absolute_start < 0 || edge.absolute_end <= edge.absolute_start) {
      return undetermined(REASONS.EVIDENCE_NOT_SINGLE_OPERATIVE);
    }

    const sectionReference = sectionReferenceFor(entry, claim);
    const section = sectionReference && sectionsByReference && typeof sectionsByReference.get === 'function'
      ? sectionsByReference.get(sectionReference)
      : null;
    if (typeof sourceText !== 'string' || !section || !Number.isInteger(section.start)
      || !Number.isInteger(section.end) || section.start < 0 || section.end <= section.start) {
      return undetermined(REASONS.SECTION_UNAVAILABLE);
    }

    let sectionText;
    let operativeRecord;
    try {
      sectionText = utf8Slice(sourceText, section.start, section.end);
      const operativeText = utf8Slice(sectionText, edge.absolute_start, edge.absolute_end);
      if (typeof claim?.raw_value !== 'string'
        || !Buffer.from(operativeText, 'utf8').equals(Buffer.from(claim.raw_value, 'utf8'))) {
        return undetermined(REASONS.EVIDENCE_BYTES_MISMATCH);
      }
      operativeRecord = recordForSpan(sectionText, edge.absolute_start, edge.absolute_end, {
        evidence_role: 'OPERATIVE_TEXT',
      });
    } catch (_error) {
      return undetermined(REASONS.EVIDENCE_BYTES_MISMATCH);
    }

    let outline = cache.get(sectionReference);
    if (!outline) {
      outline = buildSectionOutline(sectionText);
      cache.set(sectionReference, outline);
    }
    const governing = resolveGoverningStructure({
      sectionText,
      startByte: edge.absolute_start,
      endByte: edge.absolute_end,
      outline,
    });
    if (governing.status !== 'RESOLVED') return undetermined(governing.reason);

    try {
      const leaf = recordForSpan(sectionText, governing.leaf.start_byte, governing.leaf.end_byte, {
        path: governing.leaf.path,
        depth: governing.leaf.depth,
      });
      const chain = governing.chain.map((item) => recordForSpan(sectionText, item.start_byte, item.end_byte, {
        path: item.path,
        depth: item.path == null ? 0 : String(item.path).split('.').length,
      }));
      const markerless = governing.markerless === true;
      const chapeau = markerless ? chain : chain.slice(1);
      const trailing = recordForSpan(sectionText, edge.absolute_end, governing.leaf.end_byte, {});
      return Object.freeze({
        status: 'RESOLVED',
        schema_version: SCHEMA_VERSION,
        source: Object.freeze({
          canonical_text_id: admittedSourceContext.canonical_text_id || admittedSourceContext.canonical_text?.canonical_text_id || null,
          document_hash: admittedSourceContext.document_hash || null,
          section_reference: sectionReference,
          section_start_byte: section.start,
          section_end_byte: section.end,
        }),
        operative: operativeRecord,
        leaf,
        chapeau: Object.freeze(chapeau),
        item: markerless ? null : leaf,
        trailing,
        markerless,
        marker_tier: governing.marker_tier,
        segmenter_version: governing.segmenter_version,
      });
    } catch (_error) {
      return undetermined(REASONS.EVIDENCE_BYTES_MISMATCH);
    }
  }

  return Object.freeze({ forCandidate });
}

module.exports = {
  SCHEMA_VERSION,
  REASONS,
  createCandidateGoverningContext,
};
