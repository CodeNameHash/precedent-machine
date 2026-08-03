'use strict';

const { contentId, sha256Hex } = require('../canonical-bytes');
const { expandAntiRelianceElements } = require('../../parser-v2/extract');

const SLICE_SCHEMA = 'NATIVE_NO_OTHER_REPS_ELEMENT_CANDIDATE_SET/V1';
const ELEMENT_KINDS = Object.freeze([
  'FRAUDCARVEOUT',
  'INDEPINVEST',
  'NONRELIANCE',
  'NOOTHERREPS',
]);
const REPRESENTATION_SIDES = Object.freeze(['BUYER', 'TARGET']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function elementKind(code) {
  const kind = String(code || '').split('-').at(-1);
  return ELEMENT_KINDS.includes(kind) ? kind : null;
}

function evidenceFor(sourceText, exactText) {
  const start = sourceText.indexOf(exactText);
  if (start < 0 || sourceText.indexOf(exactText, start + 1) >= 0) return null;
  return Object.freeze({
    char_start: start,
    char_end: start + exactText.length,
    exact_text: exactText,
    exact_text_digest: sha256Hex(exactText),
  });
}

function buildNoOtherRepsNativeFirstSlice({
  source_id: sourceId,
  source_text: sourceText,
  section_ref: sectionRef,
  representation_side: representationSide,
} = {}) {
  requireText(sourceId, 'source_id');
  requireText(sourceText, 'source_text');
  requireText(sectionRef, 'section_ref');
  if (!REPRESENTATION_SIDES.includes(representationSide)) {
    throw new TypeError(`representation_side must be one of ${REPRESENTATION_SIDES.join(', ')}`);
  }

  const prefix = representationSide === 'BUYER' ? 'REP-B' : 'REP-T';
  const legacyCode = representationSide === 'BUYER' ? 'REP-B-ANTIRELIANCE' : 'REP-T-NOREP';
  const scanned = expandAntiRelianceElements([{
    type: prefix,
    code: legacyCode,
    category: 'No Other Representations / Non-Reliance',
    text: sourceText,
    startChar: 0,
    features: {},
  }]);

  const elements = [];
  const reviewItems = [];
  for (const row of scanned) {
    const kind = elementKind(row.code);
    const exactText = String(row.text || '').trim();
    const evidence = exactText ? evidenceFor(sourceText, exactText) : null;
    if (row.needs_review || !kind || !evidence) {
      reviewItems.push(Object.freeze({
        reason_code: row.needs_review ? 'UNBOUNDABLE_ELEMENT_SPANS' : 'ELEMENT_EVIDENCE_NOT_UNIQUE',
        observed_code: String(row.code || legacyCode),
      }));
      continue;
    }
    const elementBody = {
      concept_code: `${prefix}-${kind}`,
      element_kind: kind,
      representation_side: representationSide,
      state: 'PRESENT',
      evidence,
    };
    elements.push(Object.freeze({
      element_candidate_id: contentId('NATIVE_NO_OTHER_REPS_ELEMENT_CANDIDATE/V1', elementBody),
      ...elementBody,
    }));
  }
  elements.sort((a, b) => a.evidence.char_start - b.evidence.char_start
    || a.concept_code.localeCompare(b.concept_code));

  const body = {
    schema_version: SLICE_SCHEMA,
    source_id: sourceId,
    source_text_digest: sha256Hex(sourceText),
    section_ref: sectionRef,
    representation_side: representationSide,
    state: reviewItems.length ? 'REVIEW_REQUIRED' : 'RESOLVED',
    elements,
    review_items: reviewItems,
  };
  return deepFreeze({
    ...body,
    element_candidate_set_id: contentId(SLICE_SCHEMA, body),
  });
}

module.exports = {
  ELEMENT_KINDS,
  REPRESENTATION_SIDES,
  SLICE_SCHEMA,
  buildNoOtherRepsNativeFirstSlice,
};
