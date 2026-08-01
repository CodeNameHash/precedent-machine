/**
 * lib/canonical-v2/native-producer/limb-enumeration-scan.js
 *
 * Limb-enumeration corroboration (spec: "Recall and volume instrumentation",
 * item 4; Ben, 2026-08-01 -- "a deterministic scan, NOT a sectionizer
 * change"). This scans a governed section's OWN text for its enumeration
 * markers -- (a)-(z), (i)/(ii)/... roman numerals, (A)-(Z) -- and compares
 * the set found against the limb paths a run proposed. A marker with no
 * proposed limb, or a proposed limb with no marker in the text, is a typed
 * `LIMB_ENUMERATION_DISAGREEMENT` entry.
 *
 * CORROBORATION ONLY. This module never constructs identity or spans: it
 * does not mint limb nodes, does not decide what a marker's legal content
 * is, and does not resolve nesting depth from document structure (that is
 * the sectionizer's job, explicitly out of scope here per Ben's framing).
 * It only asks "does this parenthetical marker token, read left to right
 * out of the raw text, have a counterpart in what the run proposed?" -- a
 * cheap recall check, same pattern as coverage-proxies.js and the citation
 * corroboration in citation-constructibility.js.
 *
 * THE ROMAN/ALPHA AMBIGUITY, AND THE CONSERVATIVE RULE THIS FILE USES
 *
 * A parenthetical token like "(i)" is genuinely ambiguous: it could be
 * lower-case alpha item 9 ("(a)".."(z)") or roman numeral 1. The same
 * ambiguity hits "(v)", "(x)", "(l)", "(c)", "(d)", "(m)" -- every letter
 * that is ALSO a valid roman numeral digit. This scan resolves the
 * ambiguity with two conservative, purely lexical rules, applied in order,
 * and never tries to infer nesting depth to break a tie:
 *
 *  1. UPPERCASE single letters ("(A)".."(Z)") are always classified
 *     ALPHA_UPPER. This corpus's drafting convention (and the spec's own
 *     enumeration alphabet list) never uses uppercase roman numerals for
 *     limb markers, so there is no real ambiguity to resolve here.
 *  2. LOWERCASE tokens of two or more letters ("ii", "iii", "iv", "ix", …)
 *     are classified ROMAN whenever they parse as a valid roman numeral.
 *     Alpha enumeration in this drafting convention is always a SINGLE
 *     letter ("(a)".."(z)"); a multi-letter lowercase token can only be
 *     roman, so there is no ambiguity here either.
 *  3. LOWERCASE SINGLE letters are the one truly ambiguous case. This scan
 *     resolves them ROMAN when the letter is also a valid roman digit
 *     ({i, v, x, l, c, d, m}), and ALPHA_LOWER otherwise (e.g. "(b)",
 *     "(e)" are unambiguous). This is a deliberate, documented, one-sided
 *     choice: in the real F28 governed section, the top-level enumeration
 *     is roman ("(i)".."(v)") and the single ambiguous letters that occur
 *     there ("(i)" and "(v)") are in fact roman, so this rule classifies
 *     real drafting correctly. A caller comparing against a document whose
 *     top-level convention is alpha, not roman, will see single ambiguous
 *     letters over-classified as ROMAN; because this scan only
 *     CORROBORATES (never constructs identity or spans), the cost of that
 *     misclassification is a comparison-family mismatch surfaced as a typed
 *     disagreement for a human to look at, never a wrong claim silently
 *     accepted.
 *  4. A lowercase multi-letter token that does NOT parse as a valid roman
 *     numeral (e.g. "ab") is not a legal enumeration marker at all and is
 *     excluded from the scan entirely -- it is ordinary prose in
 *     parentheses, not a limb label.
 *
 * MARKER-VS-LIMB COMPARISON is on the literal parenthetical token string
 * (e.g. "(ii)", "(A)"), case- and family-sensitive, zero-width/bidi
 * tolerant via `normaliseForMatching` (comparison only). Proposed limb
 * paths are flattened to their individual path segments before comparing,
 * so a nested path like ["(ii)", "(A)"] contributes both "(ii)" and "(A)"
 * to the proposed-marker set.
 */

'use strict';

const { normaliseForMatching } = require('../zero-width-normalise');

const LIMB_ENUMERATION_SCAN_REPORT_SCHEMA = 'LIMB_ENUMERATION_SCAN_REPORT/V1';

// Order matters for `romanToDecimal`-independent validation: this regex
// only needs to confirm a token is a WELL-FORMED roman numeral, not convert
// it, since the scan never needs the numeric value.
const ROMAN_NUMERAL_PATTERN = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const ROMAN_SINGLE_DIGIT_LETTERS = new Set(['i', 'v', 'x', 'l', 'c', 'd', 'm']);

const MARKER_TOKEN_PATTERN = /\(([A-Za-z]{1,6})\)/g;

class LimbEnumerationScanError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LimbEnumerationScanError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new LimbEnumerationScanError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

function requireString(value, label) {
  if (typeof value !== 'string') fail('INVALID_INPUT', `${label} must be a string`, { label });
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`, { label });
  return value;
}

// Classifies one bracket-stripped token ("ii", "A", "b", …) per the rule
// documented in the file header. Returns null for a lowercase multi-letter
// token that is not a valid roman numeral -- "not an enumeration marker".
function classifyToken(token) {
  if (/^[A-Z]$/.test(token)) return 'ALPHA_UPPER';

  if (/^[A-Z]+$/.test(token)) {
    // Multi-letter uppercase: only meaningful if it happens to be a valid
    // roman numeral (very rare in this corpus); otherwise not a marker.
    return ROMAN_NUMERAL_PATTERN.test(token.toLowerCase()) ? 'ROMAN_UPPER' : null;
  }

  if (/^[a-z]$/.test(token)) {
    return ROMAN_SINGLE_DIGIT_LETTERS.has(token) ? 'ROMAN' : 'ALPHA_LOWER';
  }

  if (/^[a-z]+$/.test(token)) {
    return ROMAN_NUMERAL_PATTERN.test(token) && token.length > 0 ? 'ROMAN' : null;
  }

  return null;
}

/**
 * Scans `sourceText` for enumeration marker tokens in document order.
 * @param {string} sourceText
 * @returns {{token:string, family:string, start:number, end:number}[]}
 *   `start`/`end` are UTF-8 byte offsets of the full "(x)" token, half-open.
 */
function scanEnumerationMarkers(sourceText) {
  requireString(sourceText, 'source_text');
  const markers = [];
  const buffer = Buffer.from(sourceText, 'utf8');
  let match;
  MARKER_TOKEN_PATTERN.lastIndex = 0;
  while ((match = MARKER_TOKEN_PATTERN.exec(sourceText)) !== null) {
    const inner = match[1];
    const family = classifyToken(inner);
    if (family === null) continue;
    const fullToken = `(${inner})`;
    // Byte offsets: the char-index match position, converted via the byte
    // length of everything before it (source text is not guaranteed ASCII
    // elsewhere in the document, so this stays byte-accurate).
    const charStart = match.index;
    const byteStart = Buffer.byteLength(sourceText.slice(0, charStart), 'utf8');
    const byteEnd = byteStart + Buffer.byteLength(fullToken, 'utf8');
    markers.push({ token: fullToken, family, start: byteStart, end: byteEnd });
  }
  return markers;
}

function flattenProposedTokens(proposedLimbPaths) {
  const tokens = [];
  for (const path of proposedLimbPaths) {
    if (!Array.isArray(path)) {
      fail('INVALID_INPUT', 'each entry of proposed_limb_paths must be an array of path segments', { path });
    }
    for (const segment of path) {
      if (typeof segment !== 'string') {
        fail('INVALID_INPUT', 'limb_path segments must be strings', { path });
      }
      tokens.push(segment);
    }
  }
  return tokens;
}

/**
 * @param {object} args
 * @param {string} args.section_reference
 * @param {string} args.source_text            the governed section's own text
 * @param {string[][]} args.proposed_limb_paths every limb_path the run proposed
 *   (e.g. [["(i)"], ["(i)","(A)"], ["(ii)"]])
 * @returns {object} frozen `LIMB_ENUMERATION_SCAN_REPORT/V1`
 */
function scanLimbEnumeration({
  section_reference: sectionReference,
  source_text: sourceText,
  proposed_limb_paths: proposedLimbPaths,
} = {}) {
  requireString(sectionReference, 'section_reference');
  requireString(sourceText, 'source_text');
  requireArray(proposedLimbPaths, 'proposed_limb_paths');

  const markers = scanEnumerationMarkers(sourceText);
  const proposedTokens = flattenProposedTokens(proposedLimbPaths);

  const normalisedProposed = new Set(proposedTokens.map((token) => normaliseForMatching(token)));
  const normalisedMarkers = new Set(markers.map((marker) => normaliseForMatching(marker.token)));

  const disagreements = [];

  for (const marker of markers) {
    const key = normaliseForMatching(marker.token);
    if (!normalisedProposed.has(key)) {
      disagreements.push({
        type: 'LIMB_ENUMERATION_DISAGREEMENT',
        reason: 'MARKER_WITHOUT_LIMB',
        token: marker.token,
        family: marker.family,
        start: marker.start,
        end: marker.end,
      });
    }
  }

  const seenMissingLimbTokens = new Set();
  for (const token of proposedTokens) {
    const key = normaliseForMatching(token);
    if (!normalisedMarkers.has(key) && !seenMissingLimbTokens.has(key)) {
      seenMissingLimbTokens.add(key);
      disagreements.push({
        type: 'LIMB_ENUMERATION_DISAGREEMENT',
        reason: 'LIMB_WITHOUT_MARKER',
        token,
      });
    }
  }

  const report = {
    schema_version: LIMB_ENUMERATION_SCAN_REPORT_SCHEMA,
    section_reference: sectionReference,
    markers_found: markers,
    proposed_tokens: Array.from(new Set(proposedTokens)),
    disagreements,
    disagreement_count: disagreements.length,
  };

  return deepFreeze(report);
}

module.exports = {
  LIMB_ENUMERATION_SCAN_REPORT_SCHEMA,
  LimbEnumerationScanError,
  classifyToken,
  scanEnumerationMarkers,
  scanLimbEnumeration,
};
