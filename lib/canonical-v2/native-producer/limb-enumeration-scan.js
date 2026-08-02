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
 * MARKER CONTEXT CLASSIFICATION (2026-08-02 Modiv triage fix)
 *
 * The Modiv first live run produced 21/21 false MARKER_WITHOUT_LIMB
 * findings, all from ONE structural fact this scan originally ignored: not
 * every parenthetical marker token found in a governed section's text is a
 * candidate LIMB marker. Two other things wear the same "(x)" shape:
 *
 *  1. SECTION_PARAGRAPH_MARKER -- the top-level lettered marker that a
 *     nested provision's OWN citation consumes (e.g. scanning governed
 *     section "3.2", the "(a)" that opens the paragraph whose real section
 *     reference is "3.2(a)" -- that "(a)" is never itself a limb, it is the
 *     provision's own label). Two shapes, both typed out-of-scope, NEVER
 *     silently dropped -- every marker still appears in `markers_found`
 *     with this classification:
 *       - When `section_reference` itself carries a trailing "(x)" label
 *         (e.g. scanning "3.1(b)"), the FIRST marker in the text matching
 *         that exact trailing label is the section's own consumed citation.
 *       - When `section_reference` carries NO trailing label (e.g. "3.2"
 *         governing several lettered sub-paragraphs (a)-(g)), a marker that
 *         opens a new line (immediately preceded by start-of-text or a
 *         newline), resolves to an ALPHA family, AND was NEVER itself
 *         proposed as a limb path segment is a paragraph-opening marker for
 *         one of those nested provisions. That last condition -- checked
 *         against `proposed_limb_paths` when the caller supplies it (always
 *         true from `scanLimbEnumeration`, which has that data) -- is what
 *         keeps this rule from swallowing a genuine top-level alpha LIMB
 *         list (e.g. a governed section whose own real limbs start at
 *         "(a)"): if the run actually proposed "(a)" as a limb, it is never
 *         reclassified out from under that proposal. The SAME guard also
 *         covers a GAP in that list (2026-08-02 Fable review fix): if any
 *         OTHER member of this marker's own alpha chain (same case class)
 *         was proposed as a limb -- siblings proposed as limbs mean the
 *         whole chain is a limb list -- this marker is never reclassified
 *         to SECTION_PARAGRAPH_MARKER either, even though it itself was not
 *         proposed; it stays ENUMERATION_MARKER and correctly fires
 *         MARKER_WITHOUT_LIMB for the missed limb.
 *  2. CROSS_REFERENCE_MARKER -- a marker sitting inside a "Section N.N(x)
 *     [of the ... Disclosure Letter]" cross-reference the drafting repeats
 *     in prose (e.g. "except as set forth in Section 3.2(c) of the Company
 *     Disclosure Letter") -- not an enumeration at all, a citation to one.
 *     Detected via a lookbehind window over the marker's own preceding
 *     text, LTR-mark tolerant (`normaliseForMatching` -- the corpus
 *     routinely carries a real U+200E between "Section" and the number).
 *
 * Only markers classified `ENUMERATION_MARKER` participate in the
 * MARKER_WITHOUT_LIMB / LIMB_WITHOUT_MARKER comparison below. The other two
 * classifications are reported (via `markers_found[].classification` and
 * `classification_counts`) but never compared -- they are not enumeration
 * markers by construction, not tokens that failed to match one.
 *
 * THE ROMAN/ALPHA AMBIGUITY, AND THE CONSERVATIVE RULE THIS FILE USES
 *
 * A parenthetical token like "(i)" is genuinely ambiguous: it could be
 * lower-case alpha item 9 ("(a)".."(z)") or roman numeral 1. The same
 * ambiguity hits "(v)", "(x)", "(l)", "(c)", "(d)", "(m)" -- every letter
 * that is ALSO a valid roman numeral digit. `classifyToken` (context-free,
 * used standalone throughout this file's tests) resolves this ambiguity
 * with conservative, purely lexical rules, applied in order:
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
 *  3. LOWERCASE SINGLE letters are the one truly ambiguous case. Context-
 *     free, this scan resolves them ROMAN when the letter is also a valid
 *     roman digit ({i, v, x, l, c, d, m}), and ALPHA_LOWER otherwise (e.g.
 *     "(b)", "(e)" are unambiguous). This is a deliberate, documented,
 *     one-sided DEFAULT: with no surrounding context to go on, roman is the
 *     more common real-world reading for these letters as TOP-LEVEL limb
 *     markers in this corpus.
 *  4. A lowercase multi-letter token that does NOT parse as a valid roman
 *     numeral (e.g. "ab") is not a legal enumeration marker at all and is
 *     excluded from the scan entirely -- it is ordinary prose in
 *     parentheses, not a limb label.
 *
 * SEQUENCE-CONTEXT OVERRIDE (2026-08-02 Modiv triage fix (c)). The
 * context-free default above tags "(c)" and "(d)" ROMAN in every context,
 * including when they are plainly the alpha markers between "(b)" and "(e)"
 * (Modiv's "3.2" governed section runs (a)(b)(c)(d)(e)(f)(g), an ordinary
 * alpha sequence with two roman-digit-shaped letters sitting in it).
 * `scanEnumerationMarkers` layers a SECOND pass on top of `classifyToken`'s
 * default: for every ambiguous single-letter token, it looks at the
 * IMMEDIATELY adjacent marker tokens (previous and next, in raw document
 * order, regardless of their own classification) and tests two successor
 * chains, purely on the letters/values involved, never on inferred nesting
 * depth (explicitly out of scope for this file, see above):
 *   - ALPHA fit: an adjacent single lowercase-letter token is exactly one
 *     character away in the alphabet ("(b)" next to "(c)", "(d)" next to
 *     "(e)").
 *   - ROMAN fit: an adjacent token that parses as a roman numeral (any
 *     length) has a decimal value exactly one away ("(iv)" next to "(v)").
 *   - Exactly one chain fits -> that family overrides the context-free
 *     default.
 *   - BOTH chains fit -> typed `AMBIGUOUS_MARKER_FAMILY` in `markers_found`
 *     and reported, per the "never guessed" rule below.
 *   - NEITHER chain fits (2026-08-02 Fable review fix: value-aware rule,
 *     was previously "keep the context-free default" unconditionally) ->
 *     a lone "(i)" (roman value 1) keeps the documented one-sided default
 *     -- it is overwhelmingly the correct, isolated start of a roman
 *     sequence in this corpus, and treating it as ambiguous would turn the
 *     common, correct, isolated "(i)" case into a false alarm. Every OTHER
 *     lone ambiguous letter -- roman value > 1 ("(c)", "(d)", "(l)", "(m)",
 *     "(v)", "(x)") -- has no such lopsided real-world prior, so it is NOT
 *     defaulted to either family: it is typed `AMBIGUOUS_MARKER_FAMILY`,
 *     same as a genuine two-chain conflict, rather than the contract
 *     violation of silently guessing a family for it.
 *
 * "Ambiguous" here means a genuine local conflict, never a silent guess:
 * the family field for a conflicted token reads `AMBIGUOUS_MARKER_FAMILY`,
 * routed to `markers_found` for a human/downstream consumer, and the token
 * still participates fully in the ordinary MARKER_WITHOUT_LIMB /
 * LIMB_WITHOUT_MARKER token-string comparison below (family ambiguity is
 * about how to LABEL the marker, never about whether it exists in the
 * text).
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
// it for the base classifier -- `romanToDecimal` below handles conversion
// for the sequence-context override.
const ROMAN_NUMERAL_PATTERN = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const ROMAN_SINGLE_DIGIT_LETTERS = new Set(['i', 'v', 'x', 'l', 'c', 'd', 'm']);
const ROMAN_DIGIT_VALUES = {
  i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000,
};

const MARKER_TOKEN_PATTERN = /\(([A-Za-z]{1,6})\)/g;

// How many characters immediately before a marker are inspected for a
// "Section"/"Sections" + number cross-reference lead-in. Generous enough to
// survive "&nbsp;"'s decoded U+00A0 and a real U+200E LRM sitting in
// between (routine in this corpus -- see zero-width-normalise.js), never so
// wide that an unrelated earlier sentence could satisfy it.
const CROSS_REFERENCE_LOOKBEHIND_CHARS = 40;
const CROSS_REFERENCE_CONTEXT_RE = /\bsections?\s+\d+(?:\.\d+)*\s*$/i;

// How many characters immediately before a marker are inspected for the
// "start of a new line" test (paragraph-opening detection). Small window:
// only whitespace is tolerated between the newline and the marker.
const LINE_START_LOOKBEHIND_CHARS = 8;
const LINE_START_RE = /(^|\n)[ \t]*$/;

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

// Classifies one bracket-stripped token ("ii", "A", "b", …) per the
// context-free rule documented in the file header. Returns null for a
// lowercase multi-letter token that is not a valid roman numeral -- "not an
// enumeration marker".
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

// Decimal value of a lowercase token already known to satisfy
// ROMAN_NUMERAL_PATTERN (single- or multi-letter). Used only by the
// sequence-context override below -- never by `classifyToken` itself.
function romanToDecimal(token) {
  let total = 0;
  for (let i = 0; i < token.length; i += 1) {
    const current = ROMAN_DIGIT_VALUES[token[i]];
    const next = ROMAN_DIGIT_VALUES[token[i + 1]];
    total += next && current < next ? -current : current;
  }
  return total;
}

// True when `token` is the one truly ambiguous shape per the file header:
// a single lowercase letter that is also a valid roman digit.
function isAmbiguousSingleLetter(token) {
  return token.length === 1 && ROMAN_SINGLE_DIGIT_LETTERS.has(token);
}

// Sequence-context override (fix (c)): resolves ambiguous single-letter
// tokens using their IMMEDIATE neighbours in raw document order, per the
// file header's "SEQUENCE-CONTEXT OVERRIDE" section. Returns a Map from
// raw-match index -> resolved family string, containing entries ONLY for
// tokens whose family the context genuinely overrides or conflicts on
// (ALPHA_LOWER, ROMAN confirmed redundantly, or AMBIGUOUS_MARKER_FAMILY);
// every other index is absent, meaning "use classifyToken's default".
function resolveAmbiguousFamilies(rawMatches) {
  const resolved = new Map();
  for (let i = 0; i < rawMatches.length; i += 1) {
    const marker = rawMatches[i];
    if (!isAmbiguousSingleLetter(marker.inner)) continue;

    const prev = i > 0 ? rawMatches[i - 1] : null;
    const next = i < rawMatches.length - 1 ? rawMatches[i + 1] : null;
    const thisCode = marker.inner.charCodeAt(0);
    const thisRoman = romanToDecimal(marker.inner);

    const alphaFit = Boolean(
      (prev && prev.inner.length === 1 && /^[a-z]$/.test(prev.inner) && prev.inner.charCodeAt(0) + 1 === thisCode)
      || (next && next.inner.length === 1 && /^[a-z]$/.test(next.inner) && next.inner.charCodeAt(0) - 1 === thisCode),
    );
    const romanFit = Boolean(
      (prev && ROMAN_NUMERAL_PATTERN.test(prev.inner) && romanToDecimal(prev.inner) + 1 === thisRoman)
      || (next && ROMAN_NUMERAL_PATTERN.test(next.inner) && romanToDecimal(next.inner) - 1 === thisRoman),
    );

    if (alphaFit && !romanFit) resolved.set(i, 'ALPHA_LOWER');
    else if (romanFit && !alphaFit) resolved.set(i, 'ROMAN');
    else if (alphaFit && romanFit) resolved.set(i, 'AMBIGUOUS_MARKER_FAMILY');
    else if (thisRoman > 1) resolved.set(i, 'AMBIGUOUS_MARKER_FAMILY');
    // Neither chain fits AND the token's roman value is 1 (lone "(i)") ->
    // no entry -> classifyToken's documented default (ROMAN) stands. A lone
    // "(i)" is overwhelmingly the start of a roman sequence in this corpus,
    // so it alone keeps the default instead of being flagged ambiguous;
    // every other lone ambiguous letter (c/d/l/m/v/x -- roman value > 1) is
    // NOT defaulted to alpha or roman -- it is typed AMBIGUOUS_MARKER_FAMILY
    // so the classification never silently guesses a family for it.
  }
  return resolved;
}

// Extracts the LAST parenthetical component of a citation-shaped string
// ("3.1(b)" -> "(b)", "3.1(b)(i)" -> "(i)", "3.2" -> null). Used only to
// detect the section's own paragraph-opening marker (fix (a), first
// shape) -- never for citation validation itself (that is citation-
// constructibility.js's job).
function trailingMarkerLabel(sectionReference) {
  if (typeof sectionReference !== 'string') return null;
  const match = /\(([^()]+)\)\s*$/.exec(sectionReference.trim());
  return match ? `(${match[1]})` : null;
}

// True when `charIndex` in `sourceText` sits immediately after the start of
// the text or a newline (whitespace-only gap tolerated) -- "this marker
// opens a new line". Zero-width/bidi tolerant.
function isLineStart(sourceText, charIndex) {
  const windowStart = Math.max(0, charIndex - LINE_START_LOOKBEHIND_CHARS);
  const window = normaliseForMatching(sourceText.slice(windowStart, charIndex));
  return windowStart === 0 ? /^[ \t]*$/.test(window) || LINE_START_RE.test(window) : LINE_START_RE.test(window);
}

// True when `charIndex` in `sourceText` sits immediately after a
// "Section"/"Sections" + number lead-in -- "this marker is a cross-
// reference citation, not an enumeration". Zero-width/bidi tolerant (a real
// U+200E LRM routinely sits between "Section" and the number in this
// corpus).
function isCrossReferenceContext(sourceText, charIndex) {
  const windowStart = Math.max(0, charIndex - CROSS_REFERENCE_LOOKBEHIND_CHARS);
  const window = normaliseForMatching(sourceText.slice(windowStart, charIndex));
  return CROSS_REFERENCE_CONTEXT_RE.test(window);
}

/**
 * Scans `sourceText` for enumeration marker tokens in document order,
 * classifying each as `ENUMERATION_MARKER` (a real candidate limb/section
 * marker, eligible for the MARKER_WITHOUT_LIMB / LIMB_WITHOUT_MARKER
 * comparison in `scanLimbEnumeration`), `SECTION_PARAGRAPH_MARKER`, or
 * `CROSS_REFERENCE_MARKER` (both out-of-scope for that comparison -- see
 * file header). No marker is ever silently dropped: every one found
 * appears in the returned array with a classification.
 *
 * @param {string} sourceText
 * @param {object} [options]
 * @param {string} [options.section_reference] the governed section's own
 *   reference, used only to detect the SECTION_PARAGRAPH_MARKER shape whose
 *   letter the reference itself already carries (e.g. "3.1(b)"); omit/empty
 *   for a bare reference like "3.2" (the OTHER SECTION_PARAGRAPH_MARKER
 *   shape -- a line-opening alpha marker never itself proposed as a limb --
 *   still applies).
 * @param {string[][]} [options.proposed_limb_paths] every limb_path the run
 *   proposed, same shape as `scanLimbEnumeration`'s own parameter -- used
 *   only to keep the bare-reference SECTION_PARAGRAPH_MARKER rule from ever
 *   swallowing a token the run genuinely proposed as a limb (see file
 *   header). Omit to skip that rule entirely (a marker is never classified
 *   SECTION_PARAGRAPH_MARKER via the bare-reference shape without this
 *   data to check against).
 * @returns {{token:string, family:string, classification:string, start:number, end:number}[]}
 *   `start`/`end` are UTF-8 byte offsets of the full "(x)" token, half-open.
 */
function scanEnumerationMarkers(sourceText, options = {}) {
  requireString(sourceText, 'source_text');
  const { section_reference: sectionReference, proposed_limb_paths: proposedLimbPaths } = options || {};
  const rawMatches = [];
  MARKER_TOKEN_PATTERN.lastIndex = 0;
  let match;
  while ((match = MARKER_TOKEN_PATTERN.exec(sourceText)) !== null) {
    const inner = match[1];
    const baseFamily = classifyToken(inner);
    if (baseFamily === null) continue;
    rawMatches.push({ inner, charStart: match.index, fullToken: `(${inner})`, baseFamily });
  }

  const overrides = resolveAmbiguousFamilies(rawMatches);

  const trailingLabel = trailingMarkerLabel(sectionReference);
  const paragraphMarkerIndex = trailingLabel === null
    ? -1
    : rawMatches.findIndex((marker) => marker.fullToken === trailingLabel);

  const proposedTokenSet = Array.isArray(proposedLimbPaths)
    ? new Set(proposedLimbPaths.flat().filter((token) => typeof token === 'string').map((token) => normaliseForMatching(token)))
    : null;

  // Resolved family for every raw match, computed up front (needed below by
  // the sibling check, which must look at every OTHER marker's OWN resolved
  // family -- not re-derive it token-by-token, and never by pattern-matching
  // raw proposed strings directly: a proposed "(i)"/"(v)"/"(x)"/... is
  // syntactically a single lowercase letter too, so a naive regex over
  // `proposedTokenSet` would misread a proposed ROMAN limb as an alpha-chain
  // sibling. Comparing against this scan's OWN resolved families (which
  // already ran the roman/alpha disambiguation above) avoids that.
  const resolvedFamilies = rawMatches.map((marker, index) => (overrides.has(index) ? overrides.get(index) : marker.baseFamily));

  const markers = rawMatches.map((marker, index) => {
    const family = resolvedFamilies[index];

    let classification;
    if (trailingLabel !== null && index === paragraphMarkerIndex) {
      classification = 'SECTION_PARAGRAPH_MARKER';
    } else if (
      trailingLabel === null
      && proposedTokenSet !== null
      && (family === 'ALPHA_LOWER' || family === 'ALPHA_UPPER')
      && !proposedTokenSet.has(normaliseForMatching(marker.fullToken))
      && !hasAlphaChainSiblingProposed({
        rawMatches, resolvedFamilies, family, ownIndex: index, proposedTokenSet,
      })
      && isLineStart(sourceText, marker.charStart)
    ) {
      classification = 'SECTION_PARAGRAPH_MARKER';
    } else if (isCrossReferenceContext(sourceText, marker.charStart)) {
      classification = 'CROSS_REFERENCE_MARKER';
    } else {
      classification = 'ENUMERATION_MARKER';
    }

    const byteStart = Buffer.byteLength(sourceText.slice(0, marker.charStart), 'utf8');
    const byteEnd = byteStart + Buffer.byteLength(marker.fullToken, 'utf8');
    return {
      token: marker.fullToken, family, classification, start: byteStart, end: byteEnd,
    };
  });

  return markers;
}

// True when some OTHER marker actually found in this same text, resolved to
// the SAME family (ALPHA_LOWER or ALPHA_UPPER) as the current (unproposed)
// marker -- i.e. a sibling of the SAME alpha chain -- was itself proposed as
// a limb. Used by the bare-reference SECTION_PARAGRAPH_MARKER rule below to
// tell "this whole chain was never proposed as limbs -- it's the section's
// own paragraph labels" apart from "siblings in this chain WERE proposed as
// limbs -- this is a limb list with a genuine gap" (fix, 2026-08-02 Fable
// review: the latter case must never be swallowed into
// SECTION_PARAGRAPH_MARKER, or the gap's real MARKER_WITHOUT_LIMB finding is
// lost).
//
// Deliberately checks OTHER MARKERS' OWN RESOLVED FAMILIES, never a raw
// pattern match over `proposedTokenSet`'s strings directly: a proposed
// limb_path segment like "(i)"/"(v)"/"(x)" is syntactically a single
// lowercase letter too, so pattern-matching the proposed strings alone would
// misread a genuinely proposed ROMAN limb as an alpha-chain sibling and
// wrongly suppress the SECTION_PARAGRAPH_MARKER rule (this is exactly what
// happened during development against the real Modiv fixture, whose 22
// proposed limbs are all roman, several single-letter -- see
// tests/canonical-v2-limb-enumeration-scan.test.js's "MODIV REPLAY"
// regression guard).
function hasAlphaChainSiblingProposed({
  rawMatches, resolvedFamilies, family, ownIndex, proposedTokenSet,
}) {
  if (!proposedTokenSet) return false;
  for (let i = 0; i < rawMatches.length; i += 1) {
    if (i === ownIndex) continue;
    if (resolvedFamilies[i] !== family) continue;
    if (proposedTokenSet.has(normaliseForMatching(rawMatches[i].fullToken))) return true;
  }
  return false;
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

  const markers = scanEnumerationMarkers(sourceText, {
    section_reference: sectionReference,
    proposed_limb_paths: proposedLimbPaths,
  });
  const proposedTokens = flattenProposedTokens(proposedLimbPaths);

  const normalisedProposed = new Set(proposedTokens.map((token) => normaliseForMatching(token)));
  const inScopeMarkers = markers.filter((marker) => marker.classification === 'ENUMERATION_MARKER');
  const normalisedInScopeMarkers = new Set(inScopeMarkers.map((marker) => normaliseForMatching(marker.token)));

  const disagreements = [];

  for (const marker of markers) {
    if (marker.family === 'AMBIGUOUS_MARKER_FAMILY') {
      disagreements.push({
        type: 'LIMB_ENUMERATION_DISAGREEMENT',
        reason: 'AMBIGUOUS_MARKER_FAMILY',
        token: marker.token,
        family: marker.family,
        classification: marker.classification,
        start: marker.start,
        end: marker.end,
      });
    }
    if (marker.classification !== 'ENUMERATION_MARKER') continue;
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
    if (!normalisedInScopeMarkers.has(key) && !seenMissingLimbTokens.has(key)) {
      seenMissingLimbTokens.add(key);
      disagreements.push({
        type: 'LIMB_ENUMERATION_DISAGREEMENT',
        reason: 'LIMB_WITHOUT_MARKER',
        token,
      });
    }
  }

  const classificationCounts = {
    enumeration_marker: 0,
    section_paragraph_marker: 0,
    cross_reference_marker: 0,
  };
  for (const marker of markers) {
    if (marker.classification === 'ENUMERATION_MARKER') classificationCounts.enumeration_marker += 1;
    else if (marker.classification === 'SECTION_PARAGRAPH_MARKER') classificationCounts.section_paragraph_marker += 1;
    else if (marker.classification === 'CROSS_REFERENCE_MARKER') classificationCounts.cross_reference_marker += 1;
  }

  const report = {
    schema_version: LIMB_ENUMERATION_SCAN_REPORT_SCHEMA,
    section_reference: sectionReference,
    markers_found: markers,
    classification_counts: classificationCounts,
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
