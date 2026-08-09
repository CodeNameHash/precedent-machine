/**
 * lib/canonical-v2/native-producer/qualifier-kind-lexicon.js
 *
 * Deterministic qualifier-kind classifier per
 * docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md
 * section "2. Deterministic qualifier-kind classifier".
 *
 * MOTIVATION. A live extraction of the identical clause was classified
 * ACCURACY in run 1 and THRESHOLD in run 2 by the model's own `kind` field.
 * Identity must never key on an unstable model field, so this module
 * recomputes kind from the quote's TEXT alone -- a fixed marker lexicon plus
 * a written binding algorithm -- and treats the model's `kind` as a hint
 * that can, at most, route a result to review. No I/O, no model calls, pure
 * functions of their string inputs.
 *
 * FOUR FAMILIES. KNOWLEDGE, TEMPORAL, ACCURACY, THRESHOLD -- see the marker
 * tables below, each lifted verbatim from the spec's own enumeration.
 *
 * THE BINDING ALGORITHM (spec's own words, reproduced because two
 * implementers must produce the same classifier from them):
 *
 *   - Tokenise the normalised quote tracking parenthetical depth.
 *   - A bound clause opens at an auto-binding connective ("except",
 *     "except for", "except as", "other than", "excluding" -- NOT
 *     "provided that" / "subject to", which can introduce independent
 *     obligations and are therefore routed by the doubt rule instead).
 *   - A comma at the connective's own depth closes the bound clause ONLY
 *     when the continuation after that comma, up to the next same-depth
 *     boundary, contains a lexicon marker or another connective; otherwise
 *     the bound clause extends through the comma. Failing that, the clause
 *     closes at the FIRST of: a semicolon at the connective's depth, the
 *     close of the connective's enclosing parenthetical, or the end of the
 *     quote.
 *   - A connective inside a parenthetical binds within that parenthetical
 *     only.
 *   - The host is the marker-bearing span immediately preceding the bound
 *     clause at the same depth. No preceding marker at that depth -> the
 *     bound clause has no host -> the quote routes by the doubt rule (when
 *     the hostless clause itself carries a marker; a hostless clause with
 *     no marker of its own is simply a no-op, e.g. "except as set forth in
 *     the Disclosure Letter").
 *   - A marker found INSIDE a resolved bound clause is part of the host's
 *     unit, never a separate, free-standing qualifier.
 *
 * DETERMINISTIC SPLIT. After binding, if two or more marker families still
 * fire on free-standing (unbound, non-overlapping) spans, the quote is
 * split at depth-zero clause boundaries (commas/semicolons); markerless
 * residue between two firing spans stays with the preceding part; every
 * part is returned with its offsets into the ORIGINAL (un-normalised)
 * quote so the caller can byte-verify it -- this module never trusts its
 * own arithmetic on the caller's behalf, and never silently drops a part
 * that fails to reproduce.
 *
 * MEASUREMENT-DATE REACHABILITY, STATED POSITIVELY. A TEMPORAL result may
 * reach the (future, Task 3) measurement-date mapping ONLY when (a) the
 * whole quote fired TEMPORAL alone, or (b) the TEMPORAL part was split
 * from an ACCURACY host. TEMPORAL co-occurring with KNOWLEDGE or THRESHOLD
 * dates the qualifier, never the representation, and is marked ineligible.
 *
 * ASYMMETRIC DOUBT ROUTING. Doubt that touches ACCURACY (lexicon fires
 * ACCURACY and the model disagrees; the model claims ACCURACY and the
 * lexicon abstains or disagrees; ACCURACY/THRESHOLD entangled past what
 * binding can settle) is the only doubt that reaches human review, typed
 * `QUALIFIER_KIND_DISAGREEMENT` (both sides made a definite, differing
 * call) or `QUALIFIER_KIND_UNCLASSIFIED` (one side made no definite call).
 * Doubt confined to KNOWLEDGE / THRESHOLD / TEMPORAL routes to open world,
 * exactly as an unmapped generic key does today. Rationale: only ACCURACY
 * is identity-bearing under the currently registered claim definitions.
 *
 * MODEL-HINT ABSENCE (pinned decision). A missing/null producer `kind` is
 * ABSTENTION -- neither agreement nor disagreement. Classification proceeds
 * on the lexicon alone whenever exactly one family fires.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not decide claim identity, does
 * not consult attachment position (CHAPEAU/ITEM/TRAILING) -- that rekey is
 * Task 3's `GENERIC_CLAIM_KEY_RESOLUTION_TABLE`, not this classifier -- and
 * it never resolves a symbolic date to an ISO value (that is
 * measurement-date-parse.js, Task 3). This module answers exactly one
 * question: given a quote's text (and an optional model hint), what KIND
 * is it, deterministically, and does that answer need a human.
 */

'use strict';

const { normaliseForMatching, ZERO_WIDTH_PATTERN } = require('../zero-width-normalise');
// V1's materiality vocabulary, consumed rather than re-declared (docs/core/
// CLAUDE.md's "check the library before the scripts"): lib/taxonomy.js's
// MATERIALITY_CODES is the pre-existing, Ben-governed 13-code vocabulary
// and it ALREADY draws the whole-rep vs inline distinction this module's
// Stage 3 additions need (MAT_MATERIAL_TO_COMPANY vs MAT_MATERIAL_INLINE).
// Every ACCURACY code this module can emit is asserted at load time to be a
// member of that vocabulary, so the two estates can never silently diverge.
const { MATERIALITY_CODES } = require('../../taxonomy');

// P2 (docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md section 1):
// version 1 -> 2, QUALIFIER_KINDS four -> six.
// Stage 3 (docs/codex-program/notes/structural-inheritance-diagnosis.md;
// Ben's ruling: materiality standards are DISTINCT facts -- "in any
// material respect" and "in all material respects" get separate codes,
// never aliased): version 2 -> 3, two qualifier-only whitelist pairs and
// the whole-quote MAE-qualifier idiom front door added below.
// Step 2X-D / DECISIONS.md entry 14 (Ben, 2026-08-08): version 3 -> 4.
// The Stage 3 split of MAT_MAE_AGGREGATE from MAT_MAE_QUALIFIED on the
// drafting phrase "individually or in the aggregate" is REVERTED -- MAE
// is inherently aggregate, so both forms classify as MAT_MAE_QUALIFIED.
// That reversal supersedes the earlier never-alias ruling for this pair
// only; MAT_ALL_MATERIAL vs MAT_MATERIAL_INLINE remains distinct.
// Step 2X-K blind-successor recovery: version 4 -> 5. The bounded negative
// MAE tolerance grammar below changes mechanical classification.
const QUALIFIER_KIND_LEXICON_VERSION = 5;

const QUALIFIER_KINDS = Object.freeze([
  'KNOWLEDGE',
  'TEMPORAL',
  'ACCURACY',
  'THRESHOLD',
  'DISCLOSURE_SCHEDULE_CARVEOUT',
  'PERFORMANCE_ASSUMPTION',
]);

const QUALIFIER_KIND_DISAGREEMENT = 'QUALIFIER_KIND_DISAGREEMENT';
const QUALIFIER_KIND_UNCLASSIFIED = 'QUALIFIER_KIND_UNCLASSIFIED';

// P2 section 2 review-reason vocabulary.
const DISCLOSURE_CARVEOUT_PARTIAL = 'DISCLOSURE_CARVEOUT_PARTIAL';
const DISCLOSURE_CARVEOUT_UNCORROBORATED = 'DISCLOSURE_CARVEOUT_UNCORROBORATED';
const PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE = 'PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE';

// P2 section 6: the identity-bearing set. Doubt touching any member routes
// to REVIEW; all other doubt routes to open world. Audit minor 5: the
// refactor touches ONLY the two doubt branches below (buildClassified's
// single-family disagreement, doubtOutcome) -- the pre-existing ACCURACY
// literals elsewhere in this file and in candidate-resolution.js stay
// literal and untouched.
const IDENTITY_BEARING_KINDS = Object.freeze(['ACCURACY', 'DISCLOSURE_SCHEDULE_CARVEOUT']);

// P2 section 6 item 3: a model `kind` hint of KNOWLEDGE/TEMPORAL/THRESHOLD is
// ABSTENTION -- not disagreement -- against a new-kind front-door fire.
// Every committed fixture hint predates the new vocabulary (the model was
// forced to guess among four kinds containing no right answer). Permanent
// by design, not fixture-era-scoped. ACCURACY hints and a differing new-kind
// hint never soften -- both always route to REVIEW (handled at each
// front-door call site, not here).
const LEGACY_HINT_ABSTENTION_KINDS = Object.freeze(['KNOWLEDGE', 'TEMPORAL', 'THRESHOLD']);

// ─── Marker tables ───
//
// Each entry is a case-insensitive RegExp tested against the ZERO-WIDTH-
// NORMALISED quote (comparison text only -- see zero-width-normalise.js's
// own header for the two-layer rule; stored text is never touched here).

const KNOWLEDGE_PATTERNS = Object.freeze([
  /\bto\s+the\s+knowledge\s+of\b/i,
  /\bknown\s+to\b/i,
  /\baware\s+of\b/i,
]);

// TEMPORAL fires only on "as of" followed immediately (after whitespace) by
// either a calendar date the code itself parses, or a member of the CLOSED
// symbolic-date list below. The list is extensible only by a lexicon
// version bump -- see the module header.
const TEMPORAL_CALENDAR_MONTH =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE = `${TEMPORAL_CALENDAR_MONTH}\\s+\\d{1,2},\\s*\\d{4}`;
const TEMPORAL_CALENDAR_DATE_PATTERN = new RegExp(`^${TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE}`, 'i');

const TEMPORAL_SYMBOLIC_DATES = Object.freeze([
  'the date hereof',
  'the date of this Agreement',
  'the Closing Date',
  'the Effective Time',
  // P2 section 7a item 1: closed list +1. Market-standard defined term
  // appearing in all three deals; list stays CLOSED, extensible only by a
  // versioned lexicon bump (known cost, section 12).
  'the Capitalization Date',
]);

// P2 section 7a item 2: AS_OF_BRIDGE -- one optional, bounded bridge admitted
// between "as of" and the date/symbolic term. Covers the two C5 byte-forms
// ("the close of business on ..." and clock-time idioms) and nothing else;
// free prose between "as of" and the date still refuses to fire.
const AS_OF_BRIDGE_PATTERN_SOURCE =
  '(?:(?:the\\s+close\\s+of\\s+business\\s+on\\s+)|(?:\\d{1,2}:\\d{2}\\s*[ap]\\.m\\.,?\\s*(?:\\w+\\s+time,?\\s*)?on\\s+))?';

// P2 section 7a item 3: period grammar -- a new TEMPORAL occurrence shape.
// Endpoints outside the closed vocabulary (TEMPORAL_SYMBOLIC_DATES, or a
// calendar date) do not fire (anti-noise: "from time to time" cannot match).
const TEMPORAL_PERIOD_ENDPOINT_SOURCE = `(?:${TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE}|${TEMPORAL_SYMBOLIC_DATES.map(
  (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|')})`;

const ACCURACY_PATTERNS = Object.freeze([
  /\btrue\s+and\s+correct\b/i,
  /\bcorrect\s+and\s+complete\b/i,
  /\bin\s+all\s+material\s+respects\b/i,
  /\bin\s+all\s+respects\b/i,
]);

const THRESHOLD_PATTERNS = Object.freeze([
  /\bmaterial\s+to\b/i,
  /\$\s?\d[\d,]*(?:\.\d+)?/,
  /\b\d+(?:\.\d+)?\s?%/,
  /\bde\s+minimis\b/i,
]);

// ─── ACCURACY code whitelist ───
//
// Exact normalised-phrase -> code, matched against the WHOLE normalised
// quote (or, for a split part, that part's own whole normalised text).
// Whole-string matching means at most one pair can match -- there is no
// precedence order to state. Zero matches -> code null, never nearest-fit.
// Deal-specific variants that match no pair are the intended intake for
// new whitelist pairs (Fable/Ben-governed, versioned with the lexicon --
// see the module header).

const ACCURACY_CODES = Object.freeze({
  MAT_ALL_RESPECTS: 'MAT_ALL_RESPECTS',
  MAT_ALL_RESPECTS_DE_MINIMIS: 'MAT_ALL_RESPECTS_DE_MINIMIS',
  MAT_ALL_MATERIAL: 'MAT_ALL_MATERIAL',
  MAT_MATERIAL_TO_COMPANY: 'MAT_MATERIAL_TO_COMPANY',
  MAT_MAE_QUALIFIED: 'MAT_MAE_QUALIFIED',
  // Stage 3: MAT_MATERIAL_INLINE is "in any material respect" and other
  // inline-modifier materiality (materiality as an element of the rep's
  // content), kept DISTINCT from MAT_ALL_MATERIAL ("in all material
  // respects") per the never-alias ruling that still stands for that pair.
  // MAT_MAE_AGGREGATE was briefly emitted here for the "individually or in
  // the aggregate" MAE form; REMOVED at lexicon version 4 per Ben's
  // 2026-08-08 reversal (DECISIONS.md entry 14 / Step 2X-D) -- that phrase
  // is a drafting variant of MAT_MAE_QUALIFIED, not a separate standard.
  // The key remains in lib/taxonomy.js MATERIALITY_CODES for V1 legacy only.
  MAT_MATERIAL_INLINE: 'MAT_MATERIAL_INLINE',
});

// Load-time consistency pin: every ACCURACY code this module can emit must
// exist in the V1 materiality vocabulary it consumes. A divergence is a
// programming error worth failing fast on, not a runtime condition.
for (const code of Object.keys(ACCURACY_CODES)) {
  if (!Object.prototype.hasOwnProperty.call(MATERIALITY_CODES, code)) {
    throw new Error(`qualifier-kind-lexicon: ACCURACY code ${code} is not in lib/taxonomy.js MATERIALITY_CODES`);
  }
}

// The MAT_MATERIAL_TO_COMPANY and MAT_MAE_QUALIFIED phrases below were
// APPROVED by Ben 2026-08-01 as the v1 canonical forms
// (docs/acks/CLAIM-IDENTITY-APPROVALS-2026-08-01.md item 1). The spec
// stated those two pairs descriptively rather than quoting exact phrases
// (unlike the MAT_ALL_RESPECTS/MAT_ALL_MATERIAL family); the phrases were
// filled in best-faith and then governance-reviewed. Per the module
// header, whitelist edits remain identity-semantics changes: Fable-tier,
// Ben-reviewed, versioned.
const ACCURACY_CODE_WHITELIST = Object.freeze([
  Object.freeze({ phrase: 'true and correct in all respects', code: ACCURACY_CODES.MAT_ALL_RESPECTS }),
  Object.freeze({
    phrase: 'true and correct in all respects, except for de minimis inaccuracies',
    code: ACCURACY_CODES.MAT_ALL_RESPECTS_DE_MINIMIS,
  }),
  Object.freeze({
    phrase: 'true and correct in all respects except for de minimis inaccuracies',
    code: ACCURACY_CODES.MAT_ALL_RESPECTS_DE_MINIMIS,
  }),
  Object.freeze({ phrase: 'true and correct in all material respects', code: ACCURACY_CODES.MAT_ALL_MATERIAL }),
  Object.freeze({
    phrase: 'except as would not be material to the Company',
    code: ACCURACY_CODES.MAT_MATERIAL_TO_COMPANY,
  }),
  Object.freeze({
    // DEVIATION: exact MAE phrase not pinned by the spec text -- see note above.
    phrase:
      'true and correct in all respects, except as would not reasonably be expected to have a Material Adverse Effect',
    code: ACCURACY_CODES.MAT_MAE_QUALIFIED,
  }),
  // Stage 3 additions, lexicon version 3. Governance: Ben ruled directly
  // (docs/codex-program/notes/structural-inheritance-diagnosis.md section 9
  // question 1 / the staged-fix brief's "BEN HAS RULED" item 1) that the
  // two phrases below are DISTINCT facts carrying separate codes, never
  // aliased -- that ruling is the identity-semantics approval the module
  // header requires for a whitelist edit. Both are QUALIFIER-ONLY forms:
  // the producer contract deliberately separates host and qualifier, so
  // "in all material respects" arrives alone, without the "true and
  // correct" stem the earlier composite pairs assume travels with it.
  Object.freeze({ phrase: 'in all material respects', code: ACCURACY_CODES.MAT_ALL_MATERIAL }),
  Object.freeze({ phrase: 'in any material respect', code: ACCURACY_CODES.MAT_MATERIAL_INLINE }),
]);

// ─── Stage 3 front door: the whole-quote MAE-qualifier idiom ───
//
// The recurring chapeau/limb qualifier "(Except for matters that) would not
// reasonably be expected to have(, individually or in the aggregate,) a
// (Company/Parent) Material Adverse Effect" carries no marker in the four
// legacy tables (confirmed live: Red Hat's 48-row review queue, card 03 of
// the blind set), so a quote consisting of exactly this idiom could never
// classify. Deliberately a FRONT DOOR on classifyQualifierQuote -- the same
// shape as the P2 disclosure-carve-out door, and for the same reason:
// appending it to ACCURACY_PATTERNS would feed containsMarkerOrConnective
// and silently change bound-clause boundaries on legacy quotes.
//
// NEGATIVE FORM ONLY, whole-quote anchored, fail closed: "would not ...
// have a MAE" is an accuracy tolerance (failures below MAE level are
// tolerated); the affirmative "would reasonably be expected to have a MAE"
// is a different assertion and deliberately does NOT classify here.
// The optional "individually or in the aggregate" group still MATCHES so
// those quotes classify here, but both forms resolve to MAT_MAE_QUALIFIED
// -- Ben's 2026-08-08 reversal (DECISIONS.md entry 14 / Step 2X-D)
// supersedes the Stage 3 never-alias split for this pair. MAE is
// inherently an aggregate concept; the phrase is a drafting variant.
const MAE_QUALIFIER_IDIOM_PATTERN = new RegExp(
  '^(?:except\\s+(?:for\\s+|as\\s+|to\\s+the\\s+extent\\s+)?(?:matters?\\s+|those\\s+|any\\s+such\\s+\\w+\\s+|any\\s+\\w+\\s+)?)?'
  + '(?:that\\s+|which\\s+|as\\s+)?'
  + 'would\\s+not\\s+(?:reasonably\\s+be\\s+expected\\s+to\\s+)?(?:have|result\\s+in)\\s*,?\\s*'
  + '(?:individually\\s+or\\s+in\\s+the\\s+aggregate\\s*,?\\s*)?'
  + '(?:an?\\s+)?(?:Company\\s+|Parent\\s+)?Material\\s+Adverse\\s+Effect[\\s.,;)]*$',
  'i',
);

// Corpus-exact tolerance variants retain a concrete governed failure before
// the negative MAE tail.  They are not a nearest-fit rule: the start is
// closed, the failure text is bounded, and an affirmative MAE proposition
// never matches.  All map to the existing aggregate MAE tolerance code.
const MAE_TOLERANCE_FAILURE_IDIOM_PATTERN = new RegExp(
  '^(?:other than where the failure to [\\s\\S]{1,240}?'
  + '|except for such [\\s\\S]{1,240}?(?:the )?(?:absence|failure) of which[\\s\\S]{0,120}?'
  + '|such other [\\s\\S]{1,240}?the failure of which[\\s\\S]{0,120}?'
  + '|except for such failures to [\\s\\S]{1,240}?)\\b'
  + 'would\\s+not\\s+(?:reasonably\\s+be\\s+expected\\s+to\\s*,?\\s*)?'
  + '(?:individually\\s+or\\s+in\\s+the\\s+aggregate\\s*,?\\s*)?(?:have|result\\s+in)\\s*,?\\s*'
  + '(?:individually\\s+or\\s+in\\s+the\\s+aggregate\\s*,?\\s*)?'
  + '(?:an?\\s+)?(?:Company\\s+|Parent\\s+)?Material\\s+Adverse\\s+Effect[\\s.,;)]*$',
  'i',
);

// ─── P2 front-door patterns (section 1a, 1b) ───
//
// Deliberately NOT appended to the four-family marker tables above: those
// tables feed containsMarkerOrConnective, which drives the comma-close
// rule, and adding a new family there would silently change bound-clause
// boundaries on legacy quotes. Instead these are FRONT DOORS on
// classifyQualifierQuote (section 2), leaving applyExceptionConnectiveBinding
// byte-for-byte untouched.

const DISCLOSURE_CARVEOUT_VERB = '(?:set\\s+forth|provided|disclosed|described|listed)';
const DISCLOSURE_CARVEOUT_CITATION_TOKEN = '\\d+\\.\\d+(?:\\([^()\\s]+\\))*';
const DISCLOSURE_CARVEOUT_ANCHOR =
  'of\\s+the\\s+(?:\\w+\\s+){0,2}Disclosure\\s+(?:Letter|Schedule)s?';
const DISCLOSURE_CARVEOUT_CONNECTIVE = '(?:except|except as|except for|other than|excluding)';

// The CLASSIFY grammar -- full match only, anchored start/end.
const DISCLOSURE_CARVEOUT_CLAUSE_PATTERN = new RegExp(
  `^${DISCLOSURE_CARVEOUT_CONNECTIVE}\\s+(?:as\\s+)?${DISCLOSURE_CARVEOUT_VERB}\\s+(?:in|on)\\s+` +
    `Section\\s+(${DISCLOSURE_CARVEOUT_CITATION_TOKEN})\\s+${DISCLOSURE_CARVEOUT_ANCHOR}[\\s,;.]*$`,
  'i'
);

// The DOUBT tripwire -- anywhere, plural "Sections?", bounded bridge.
const DISCLOSURE_CARVEOUT_SIGNAL_PATTERN = new RegExp(
  `${DISCLOSURE_CARVEOUT_VERB}\\s+(?:in|on)\\s+Sections?\\s+${DISCLOSURE_CARVEOUT_CITATION_TOKEN}` +
    `(?:[^;]{0,80}?)${DISCLOSURE_CARVEOUT_ANCHOR}`,
  'gi'
);

// The Modiv coverage map also contains one enumerated exception clause.
// Its final, singular disclosure-letter limb is separated from the opening
// "Except" by four Roman-numeral limbs. This is intentionally a separate,
// closed tripwire: it does not extend the ordinary 40-character connector
// window, and it refuses whole-letter and multi-citation forms.
const ENUMERATED_EXCEPT_DISCLOSURE_CARVEOUT_SIGNAL_PATTERN = new RegExp(
  `^\\s*except\\b(?=[^;]*\\(i\\)[^;]*\\(ii\\)[^;]*\\(iii\\)[^;]*\\(iv\\))[^;]*?` +
    `as\\s+set\\s+forth\\s+in\\s+Section\\s+${DISCLOSURE_CARVEOUT_CITATION_TOKEN}` +
    `(?!\\s*(?:,|and)\\s*(?:Sections?|\\d+\\.\\d+))\\s+${DISCLOSURE_CARVEOUT_ANCHOR}`,
  'i'
);

// Section 2 rule 3: DISCLOSURE_CARVEOUT_SIGNAL_PATTERN requires an
// except-family connective within 40 normalised chars BEFORE the verb --
// an affirmative reference has none and flows to the legacy pipeline.
const EXCEPT_FAMILY_CONNECTIVE_PATTERN = new RegExp(`\\b${DISCLOSURE_CARVEOUT_CONNECTIVE}\\b`, 'i');
const CARVEOUT_SIGNAL_CONNECTIVE_WINDOW = 40;

function hasCarveoutSignal(normalisedText) {
  if (ENUMERATED_EXCEPT_DISCLOSURE_CARVEOUT_SIGNAL_PATTERN.test(normalisedText)) return true;

  const re = new RegExp(DISCLOSURE_CARVEOUT_SIGNAL_PATTERN.source, 'gi');
  let m = re.exec(normalisedText);
  while (m) {
    const windowStart = Math.max(0, m.index - CARVEOUT_SIGNAL_CONNECTIVE_WINDOW);
    const before = normalisedText.slice(windowStart, m.index);
    if (EXCEPT_FAMILY_CONNECTIVE_PATTERN.test(before)) return true;
    m = re.exec(normalisedText);
  }
  return false;
}

// Section 1b. Full multi-word phrase required -- a bare \bassuming\b would
// fire on "assuming the accuracy of the representations and warranties"
// (the bring-down/condition idiom) and corrupt COND-family quotes.
const PERFORMANCE_ASSUMPTION_PATTERN =
  /\bassuming\s+(?:satisfaction|achievement)\s+of\s+(?:the\s+)?applicable\s+performance\s+(?:criteria|goals)\s+at\s+(?:the\s+)?(target|maximum)\s+levels?\b/gi;

function hasPerformanceAssumptionSignal(normalisedText) {
  return new RegExp(PERFORMANCE_ASSUMPTION_PATTERN.source, 'i').test(normalisedText);
}

// Auto-binding connectives, longest-phrase-first so the alternation prefers
// "except for"/"except as" over the bare "except" when both could match at
// the same position. "provided that" and "subject to" are deliberately
// excluded -- see the module header.
const AUTO_BINDING_CONNECTIVE_PHRASES = Object.freeze(['except for', 'except as', 'other than', 'excluding', 'except']);
const CONNECTIVE_SCAN_PATTERN = /\b(except for|except as|other than|excluding|except)\b/gi;
const DOUBT_ONLY_PHRASE_PATTERN = /\b(provided that|subject to)\b/i;

const ZERO_WIDTH_TEST_PATTERN = new RegExp(ZERO_WIDTH_PATTERN.source);

// ─── Normalisation with an offset map back to the original string ───
//
// Comparison happens on the zero-width-normalised text (per
// zero-width-normalise.js), but every span this module hands back to a
// caller must be a real offset into the ORIGINAL quote. `origIndex[i]` is
// the original-string offset of `normalised[i]`.

function buildNormalisationMap(original) {
  const chars = [];
  const origIndex = [];
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i];
    if (!ZERO_WIDTH_TEST_PATTERN.test(ch)) {
      chars.push(ch);
      origIndex.push(i);
    }
  }
  return { normalised: chars.join(''), origIndex, originalLength: original.length };
}

function normalisedIndexToOriginal(map, normalisedIndex) {
  if (normalisedIndex < map.origIndex.length) return map.origIndex[normalisedIndex];
  return map.originalLength;
}

// ─── Depth tracking ───
//
// depth[i] is the parenthetical nesting depth AT character i. An opening
// paren is recorded at the depth it was opened FROM; the matching close is
// recorded at the depth it closes TO -- both parens of one pair therefore
// share the same depth value, which is exactly the depth an algorithm
// looking for "the close of the enclosing parenthetical" wants to see.

function computeDepthArray(text) {
  const depth = new Array(text.length);
  let current = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') {
      depth[i] = current;
      current += 1;
    } else if (ch === ')') {
      current = Math.max(0, current - 1);
      depth[i] = current;
    } else {
      depth[i] = current;
    }
  }
  return depth;
}

// ─── Marker occurrence scanning ───

function scanPatterns(text, family, patterns) {
  const out = [];
  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let m = re.exec(text);
    while (m) {
      out.push({ family, start: m.index, end: m.index + m[0].length, phrase: m[0] });
      if (m[0].length === 0) re.lastIndex += 1;
      m = re.exec(text);
    }
  }
  return out;
}

const AS_OF_WITH_BRIDGE_PATTERN = new RegExp(`\\bas of\\s+${AS_OF_BRIDGE_PATTERN_SOURCE}`, 'gi');

function findTemporalOccurrences(text) {
  const out = [];
  const re = new RegExp(AS_OF_WITH_BRIDGE_PATTERN.source, 'gi');
  let m = re.exec(text);
  while (m) {
    const afterStart = m.index + m[0].length;
    const rest = text.slice(afterStart);
    const calendarMatch = rest.match(TEMPORAL_CALENDAR_DATE_PATTERN);
    if (calendarMatch) {
      out.push({
        family: 'TEMPORAL',
        start: m.index,
        end: afterStart + calendarMatch[0].length,
        phrase: text.slice(m.index, afterStart + calendarMatch[0].length),
        resolution: 'CALENDAR',
      });
    } else {
      const restLower = rest.toLowerCase();
      const symbolic = TEMPORAL_SYMBOLIC_DATES.find((sym) => restLower.startsWith(sym.toLowerCase()));
      if (symbolic) {
        out.push({
          family: 'TEMPORAL',
          start: m.index,
          end: afterStart + symbolic.length,
          phrase: text.slice(m.index, afterStart + symbolic.length),
          resolution: 'SYMBOLIC',
          symbolic,
        });
      }
    }
    m = re.exec(text);
  }
  return out;
}

// P2 section 7a item 3: (from|since) ENDPOINT (to|through|until) ENDPOINT.
// A distinct occurrence shape from the plain "as of" scan -- resolution:
// 'PERIOD' with both endpoint sub-spans (used by the resolver, section 7c,
// to mint TWO claims; never a composite string).
const TEMPORAL_PERIOD_PATTERN = new RegExp(
  `\\b(from|since)\\s+(${TEMPORAL_PERIOD_ENDPOINT_SOURCE})\\s+(to|through|until)\\s+(${TEMPORAL_PERIOD_ENDPOINT_SOURCE})\\b`,
  'gi'
);

function findTemporalPeriodOccurrences(text) {
  const out = [];
  const re = new RegExp(TEMPORAL_PERIOD_PATTERN.source, 'gi');
  let m = re.exec(text);
  while (m) {
    out.push({
      family: 'TEMPORAL',
      start: m.index,
      end: m.index + m[0].length,
      phrase: m[0],
      resolution: 'PERIOD',
      startEndpoint: m[2],
      endEndpoint: m[4],
    });
    m = re.exec(text);
  }
  return out;
}

/**
 * Every marker occurrence in `text` (already zero-width-normalised),
 * across all four families, sorted by start offset.
 * @param {string} text
 * @returns {Array<{family: string, start: number, end: number, phrase: string}>}
 */
function findAllMarkerOccurrences(text) {
  const periods = findTemporalPeriodOccurrences(text);
  // A period occurrence supersedes any plain "as of"/symbolic TEMPORAL
  // occurrence it contains -- section 7b's period-grammar-first dispatch
  // order applies here too: the single-date scan must never ALSO surface
  // "the date hereof" inside "From the Capitalization Date to the date
  // hereof" as a second, independent TEMPORAL occurrence.
  const plainTemporal = findTemporalOccurrences(text).filter(
    (occ) => !periods.some((p) => occ.start >= p.start && occ.end <= p.end)
  );
  const occurrences = [
    ...scanPatterns(text, 'KNOWLEDGE', KNOWLEDGE_PATTERNS),
    ...periods,
    ...plainTemporal,
    ...scanPatterns(text, 'ACCURACY', ACCURACY_PATTERNS),
    ...scanPatterns(text, 'THRESHOLD', THRESHOLD_PATTERNS),
  ];
  occurrences.sort((a, b) => a.start - b.start || a.end - b.end);
  return occurrences;
}

function containsMarkerOrConnective(text) {
  if (findAllMarkerOccurrences(text).length > 0) return true;
  return new RegExp(CONNECTIVE_SCAN_PATTERN.source, 'i').test(text);
}

// ─── Bound-clause boundary search ───

function findNextBoundaryAtDepth(text, depthArr, fromIndex, depthLevel) {
  let k = fromIndex;
  while (k < text.length) {
    if (depthArr[k] < depthLevel) return k;
    if (depthArr[k] === depthLevel && (text[k] === ',' || text[k] === ';')) return k;
    k += 1;
  }
  return text.length;
}

/**
 * The end offset (exclusive, normalised coordinates) of the bound clause
 * opened by a connective whose own text ends at `startIndex`, at depth
 * `depthLevel`. Implements the spec's comma-close rule exactly.
 */
function findBoundClauseEnd(text, depthArr, startIndex, depthLevel) {
  let j = startIndex;
  while (j < text.length) {
    const d = depthArr[j];
    if (d < depthLevel) return j; // enclosing parenthetical closed
    if (d === depthLevel) {
      const ch = text[j];
      if (ch === ';') return j;
      if (ch === ',') {
        const nextBoundary = findNextBoundaryAtDepth(text, depthArr, j + 1, depthLevel);
        const continuation = text.slice(j + 1, nextBoundary);
        if (containsMarkerOrConnective(continuation)) return j;
        // else: this comma does not close the clause -- keep scanning.
      }
    }
    j += 1;
  }
  return text.length;
}

function findConnectiveOccurrences(text, depthArr) {
  const out = [];
  const re = new RegExp(CONNECTIVE_SCAN_PATTERN.source, 'gi');
  let m = re.exec(text);
  while (m) {
    const start = m.index;
    const end = start + m[0].length;
    out.push({ phrase: m[0], start, end, depth: depthArr[start] });
    m = re.exec(text);
  }
  return out;
}

function findHost(occurrences, connectiveStart, depthLevel, depthArr) {
  let best = null;
  for (const occ of occurrences) {
    if (occ.end <= connectiveStart && depthArr[occ.start] === depthLevel) {
      if (!best || occ.start > best.start) best = occ;
    }
  }
  return best;
}

/**
 * Apply the exception-connective binding algorithm to `quote`. Pure,
 * returns offsets into the ORIGINAL (un-normalised) `quote` throughout, so
 * a caller can slice and byte-verify directly.
 *
 * @param {string} quote
 * @returns {{
 *   boundClauses: Array<{
 *     connective: string, connectiveStart: number, connectiveEnd: number,
 *     depth: number, clauseStart: number, clauseEnd: number, clauseText: string,
 *     hasMarker: boolean, host: ({family:string,start:number,end:number,text:string}|null),
 *     hostless: boolean, subsumed: boolean,
 *   }>,
 *   maskedSpans: Array<{start:number, end:number, family:string}>,
 *   hostlessDoubts: Array<{families: string[], start:number, end:number}>,
 *   markerOccurrences: Array<{family:string,start:number,end:number,phrase:string}> (original offsets),
 * }}
 */
function applyExceptionConnectiveBinding(quote) {
  if (typeof quote !== 'string') {
    throw new TypeError('applyExceptionConnectiveBinding expects a string');
  }
  const map = buildNormalisationMap(quote);
  const normalised = map.normalised;
  const depthArr = computeDepthArray(normalised);
  const markerOccurrencesNormalised = findAllMarkerOccurrences(normalised);
  const connectives = findConnectiveOccurrences(normalised, depthArr);

  // Innermost-first: deepest connectives resolved first so a shallower
  // connective's own scan can treat an already-resolved nested clause as
  // ordinary (inert) text it passes through, per the spec's nesting rule.
  const ordered = [...connectives].sort((a, b) => b.depth - a.depth || a.start - b.start);

  const maskedSpans = [];
  const hostlessDoubts = [];
  const boundClauses = [];

  const isSubsumed = (start, end) => maskedSpans.some((m) => start >= m.start && end <= m.end);

  for (const connective of ordered) {
    if (isSubsumed(connective.start, connective.end)) {
      boundClauses.push(mapBoundClause(map, connective, connective.end, false, null, true));
      continue;
    }
    const clauseEnd = findBoundClauseEnd(normalised, depthArr, connective.end, connective.depth);
    const clauseHasMarker = markerOccurrencesNormalised.some(
      (occ) => occ.start >= connective.end && occ.end <= clauseEnd && !isSubsumed(occ.start, occ.end)
    );

    if (!clauseHasMarker) {
      boundClauses.push(mapBoundClause(map, connective, clauseEnd, false, null, false));
      continue;
    }

    const host = findHost(markerOccurrencesNormalised, connective.start, connective.depth, depthArr);
    if (host) {
      maskedSpans.push({ start: host.start, end: clauseEnd, family: host.family });
      boundClauses.push(
        mapBoundClause(map, connective, clauseEnd, true, {
          family: host.family,
          start: normalisedIndexToOriginal(map, host.start),
          end: normalisedIndexToOriginal(map, host.end),
          text: quote.slice(normalisedIndexToOriginal(map, host.start), normalisedIndexToOriginal(map, host.end)),
        }, false)
      );
    } else {
      const families = [
        ...new Set(
          markerOccurrencesNormalised
            .filter((occ) => occ.start >= connective.end && occ.end <= clauseEnd)
            .map((occ) => occ.family)
        ),
      ];
      hostlessDoubts.push({
        families,
        start: normalisedIndexToOriginal(map, connective.start),
        end: normalisedIndexToOriginal(map, clauseEnd),
      });
      // The hostless clause is still masked off from independent
      // free-standing family detection: it has already been routed to
      // doubt as a unit, and its interior markers must not ALSO surface
      // as separate free-standing fires.
      maskedSpans.push({ start: connective.start, end: clauseEnd, family: null });
      boundClauses.push(mapBoundClause(map, connective, clauseEnd, true, null, false));
    }
  }

  // Restore document order for the returned boundClauses list.
  boundClauses.sort((a, b) => a.connectiveStart - b.connectiveStart);

  const markerOccurrences = markerOccurrencesNormalised.map((occ) => ({
    family: occ.family,
    start: normalisedIndexToOriginal(map, occ.start),
    end: normalisedIndexToOriginal(map, occ.end),
    phrase: quote.slice(normalisedIndexToOriginal(map, occ.start), normalisedIndexToOriginal(map, occ.end)),
  }));

  return Object.freeze({
    boundClauses: Object.freeze(boundClauses),
    maskedSpans: Object.freeze(
      maskedSpans.map((m) =>
        Object.freeze({
          start: normalisedIndexToOriginal(map, m.start),
          end: normalisedIndexToOriginal(map, m.end),
          family: m.family,
        })
      )
    ),
    hostlessDoubts: Object.freeze(hostlessDoubts.map((d) => Object.freeze(d))),
    markerOccurrences: Object.freeze(markerOccurrences),
    _internal: { map, normalised, depthArr, markerOccurrencesNormalised, maskedSpansNormalised: maskedSpans },
  });
}

function mapBoundClause(map, connective, clauseEndNormalised, hasMarker, host, subsumed) {
  const connectiveStart = normalisedIndexToOriginal(map, connective.start);
  const connectiveEnd = normalisedIndexToOriginal(map, connective.end);
  const clauseStart = connectiveEnd;
  const clauseEnd = normalisedIndexToOriginal(map, clauseEndNormalised);
  return Object.freeze({
    connective: connective.phrase,
    connectiveStart,
    connectiveEnd,
    depth: connective.depth,
    clauseStart,
    clauseEnd,
    clauseText: null, // filled by caller with the real slice (see below)
    hasMarker,
    host,
    hostless: hasMarker && !host && !subsumed,
    subsumed,
  });
}

// Second pass to fill in clauseText now that we have the original quote in
// scope at the call site (kept as a tiny helper rather than threading the
// original string through mapBoundClause's signature everywhere).
function withClauseText(quote, boundClause) {
  return Object.freeze({ ...boundClause, clauseText: quote.slice(boundClause.clauseStart, boundClause.clauseEnd) });
}

// ─── ACCURACY code derivation ───

/**
 * Exact-phrase ACCURACY code lookup against the WHOLE normalised text
 * handed in (whole-quote match, or a split part's own whole text). At most
 * one whitelist pair can match; zero matches -> null.
 * @param {string} text
 * @returns {string|null}
 */
function deriveAccuracyCode(text) {
  const trimmed = normaliseForMatching(text).trim();
  const matches = ACCURACY_CODE_WHITELIST.filter((entry) => entry.phrase === trimmed);
  return matches.length === 1 ? matches[0].code : null;
}

// ─── Family-fire computation (post-binding) ───

function computeEffectiveOccurrences(binding) {
  const { markerOccurrencesNormalised, maskedSpansNormalised } = binding._internal;
  const hostedSpans = maskedSpansNormalised.filter((m) => m.family !== null);
  const isConsumed = (occ) => maskedSpansNormalised.some((m) => occ.start >= m.start && occ.end <= m.end);
  const free = markerOccurrencesNormalised.filter((occ) => !isConsumed(occ));
  const hosted = hostedSpans.map((m) => ({ family: m.family, start: m.start, end: m.end }));
  const effective = [...free, ...hosted];
  effective.sort((a, b) => a.start - b.start);
  return effective;
}

// ─── Deterministic split ───

function attemptSplit(quote, binding, effectiveOccurrences) {
  const { map, normalised } = binding._internal;

  // MERGE consecutive same-family occurrences into one region each (spec §2
  // rule 3: parts partition per FAMILY, not per marker occurrence -- "true
  // and correct" + "in all material respects" are ONE ACCURACY region, so
  // the worked example yields exactly two parts and the merged ACCURACY
  // part can match the whole-part code whitelist. 2026-08-01 final audit,
  // finding C1).
  const regions = [];
  for (const occ of effectiveOccurrences) {
    const last = regions[regions.length - 1];
    if (last && last.family === occ.family) {
      last.end = Math.max(last.end, occ.end);
    } else {
      regions.push({ family: occ.family, start: occ.start, end: occ.end });
    }
  }

  // Parenthetical depth per index of the normalised string: a clause
  // boundary is a comma/semicolon at DEPTH ZERO only (spec §2 rule 3 --
  // "clause boundaries (commas/semicolons at depth zero)"; audit C1: a
  // depth-1 comma inside "(as amended, restated)" must never cut a part).
  const depthAt = new Array(normalised.length).fill(0);
  let depth = 0;
  for (let k = 0; k < normalised.length; k += 1) {
    if (normalised[k] === '(') depth += 1;
    depthAt[k] = depth;
    if (normalised[k] === ')') depth = Math.max(0, depth - 1);
  }

  const parts = [];
  let cursor = 0;
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i];
    const next = regions[i + 1];
    let partEndNormalised;
    if (!next) {
      partEndNormalised = normalised.length;
    } else {
      // The LAST depth-zero comma/semicolon between the regions closes this
      // part (punctuation stays with THIS part); no depth-zero punctuation
      // means the residue stays with the host part and the next region
      // starts the next part.
      let boundary = null;
      for (let k = region.end; k < next.start; k += 1) {
        if ((normalised[k] === ',' || normalised[k] === ';') && depthAt[k] === 0) {
          boundary = k + 1;
        }
      }
      partEndNormalised = boundary !== null ? boundary : next.start;
    }
    const startOrig = normalisedIndexToOriginal(map, cursor);
    const endOrig = normalisedIndexToOriginal(map, partEndNormalised);
    const text = quote.slice(startOrig, endOrig);
    // Byte verification: the part's normalised form must equal the
    // normalised slice we computed the boundaries from.
    const expectedNormalised = normalised.slice(cursor, partEndNormalised);
    if (normaliseForMatching(text) !== expectedNormalised) {
      return null; // split void -- caller falls back to the doubt rule
    }
    parts.push({ start: startOrig, end: endOrig, text, family: region.family });
    cursor = partEndNormalised;
  }
  return parts;
}

// ─── Top-level classification ───

/**
 * Classify a single qualifier quote's kind, deterministically.
 *
 * @param {object} args
 * @param {string} args.quote                 The qualifier's verbatim text.
 * @param {string|null} [args.modelKind]       The producer's `kind` hint,
 *   one of QUALIFIER_KINDS, or null/undefined for abstention.
 * @returns {object} One of:
 *   { outcome: 'CLASSIFIED', kind, code, measurementDateEligible, lexiconKind }
 *   { outcome: 'SPLIT', parts: [{start,end,text,kind,code,measurementDateEligible}] }
 *   { outcome: 'REVIEW', reason: QUALIFIER_KIND_DISAGREEMENT|QUALIFIER_KIND_UNCLASSIFIED,
 *     lexiconKind, modelKind, families }
 *   { outcome: 'OPEN_WORLD', lexiconKind, modelKind, families }
 */
function classifyQualifierQuote(args) {
  if (!args || typeof args.quote !== 'string') {
    throw new TypeError('classifyQualifierQuote requires { quote: string }');
  }
  const quote = args.quote;
  const modelKind = args.modelKind === undefined ? null : args.modelKind;
  if (modelKind !== null && !QUALIFIER_KINDS.includes(modelKind)) {
    throw new TypeError(`classifyQualifierQuote: unrecognised modelKind ${JSON.stringify(modelKind)}`);
  }

  // ─── P2 section 2: two front-door steps, BEFORE applyExceptionConnectiveBinding ───

  const map = buildNormalisationMap(quote);
  const normalisedTrimmed = map.normalised.trim();

  // Step 1: SELF-HOSTING CLASSIFY. The whole normalised quote, trimmed,
  // full-matches the pure carve-out clause grammar.
  if (DISCLOSURE_CARVEOUT_CLAUSE_PATTERN.test(normalisedTrimmed)) {
    if (modelKind === 'ACCURACY') {
      // ACCURACY doubt is never overridden.
      return Object.freeze({
        outcome: 'REVIEW',
        reason: QUALIFIER_KIND_DISAGREEMENT,
        lexiconKind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
        modelKind,
        families: ['DISCLOSURE_SCHEDULE_CARVEOUT'],
      });
    }
    if (modelKind === 'PERFORMANCE_ASSUMPTION') {
      // Two definite new-vocabulary calls differing.
      return Object.freeze({
        outcome: 'REVIEW',
        reason: QUALIFIER_KIND_DISAGREEMENT,
        lexiconKind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
        modelKind,
        families: ['DISCLOSURE_SCHEDULE_CARVEOUT'],
      });
    }
    // A legacy KNOWLEDGE/TEMPORAL/THRESHOLD hint, or null, is abstention.
    return Object.freeze({
      outcome: 'CLASSIFIED',
      kind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
      code: null,
      measurementDateEligible: null,
      lexiconKind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
      modelKind,
    });
  }

  // Step 2: CARVEOUT DOUBT.
  const carveoutSignalFires = hasCarveoutSignal(map.normalised);
  if (carveoutSignalFires || modelKind === 'DISCLOSURE_SCHEDULE_CARVEOUT') {
    const reason = carveoutSignalFires ? DISCLOSURE_CARVEOUT_PARTIAL : DISCLOSURE_CARVEOUT_UNCORROBORATED;
    return Object.freeze({
      outcome: 'REVIEW',
      reason,
      lexiconKind: carveoutSignalFires ? 'DISCLOSURE_SCHEDULE_CARVEOUT' : null,
      modelKind,
      families: carveoutSignalFires ? ['DISCLOSURE_SCHEDULE_CARVEOUT'] : [],
    });
  }

  // Step 2.5 (Stage 3 front door; lexicon version 4 after Step 2X-D): two
  // ACCURACY front doors, both whole-quote anchored, both BEFORE the
  // binding pipeline for the same reason the P2 doors are -- they must
  // not perturb bound-clause boundaries on legacy quotes. A definite,
  // differing identity-bearing model hint still routes to review, never
  // overridden. MAE idiom (bare or with "individually or in the
  // aggregate") -> MAT_MAE_QUALIFIED only (DECISIONS.md entry 14).
  const frontDoorAccuracyCode = (() => {
    const whitelistCode = deriveAccuracyCode(normalisedTrimmed);
    if (whitelistCode !== null) return whitelistCode;
    if (MAE_QUALIFIER_IDIOM_PATTERN.test(normalisedTrimmed)
      || MAE_TOLERANCE_FAILURE_IDIOM_PATTERN.test(normalisedTrimmed)) {
      return ACCURACY_CODES.MAT_MAE_QUALIFIED;
    }
    return null;
  })();
  if (frontDoorAccuracyCode !== null) {
    // Doubt touching ACCURACY always reaches review (the module's own
    // asymmetric doubt rule, unchanged): ANY definite model hint other
    // than ACCURACY itself -- legacy or new-vocabulary -- disagrees with a
    // definite lexicon ACCURACY fire and routes to review, exactly as the
    // legacy single-family path below would have routed it. Only a null
    // hint (abstention) or an agreeing ACCURACY hint classifies.
    if (modelKind !== null && modelKind !== 'ACCURACY') {
      return Object.freeze({
        outcome: 'REVIEW',
        reason: QUALIFIER_KIND_DISAGREEMENT,
        lexiconKind: 'ACCURACY',
        modelKind,
        families: ['ACCURACY'],
      });
    }
    return Object.freeze({
      outcome: 'CLASSIFIED',
      kind: 'ACCURACY',
      code: frontDoorAccuracyCode,
      measurementDateEligible: null,
      lexiconKind: 'ACCURACY',
      modelKind,
    });
  }

  // Step 3: existing (v1) pipeline, byte-identically, for quotes matching
  // neither new pattern -- with the PERFORMANCE_ASSUMPTION check layered on
  // its output (section 2 item 3).
  const perfMatched = hasPerformanceAssumptionSignal(map.normalised);

  const binding = applyExceptionConnectiveBinding(quote);

  // Hostless bound clause carrying a marker -> unconditional doubt routing,
  // per the spec ("the bound clause has no host -> the quote routes by the
  // doubt rule").
  if (binding.hostlessDoubts.length > 0) {
    const families = new Set();
    for (const d of binding.hostlessDoubts) d.families.forEach((f) => families.add(f));
    if (perfMatched) families.add('PERFORMANCE_ASSUMPTION');
    return doubtOutcome([...families], modelKind);
  }

  const effective = computeEffectiveOccurrences(binding);
  const familySet = new Set(effective.map((o) => o.family));

  if (familySet.size === 0) {
    if (perfMatched) {
      return classifyPerformanceAssumption(quote, modelKind);
    }
    if (modelKind === 'ACCURACY') {
      return Object.freeze({
        outcome: 'REVIEW',
        reason: QUALIFIER_KIND_UNCLASSIFIED,
        lexiconKind: null,
        modelKind,
        families: [],
      });
    }
    return Object.freeze({ outcome: 'OPEN_WORLD', lexiconKind: null, modelKind, families: [] });
  }

  if (familySet.size === 1 && perfMatched) {
    // A legacy family co-fires with the performance-assumption phrase: the
    // tangle is genuine doubt (section 2 item 3), never a straight classify.
    return doubtOutcome([...familySet, 'PERFORMANCE_ASSUMPTION'], modelKind);
  }

  if (familySet.size === 1) {
    const family = [...familySet][0];
    if (modelKind === null || modelKind === family) {
      return buildClassified(quote, family, familySet, modelKind);
    }
    // Disagreement: asymmetric routing (P2 section 6: generalized to
    // IDENTITY_BEARING_KINDS; ACCURACY literals elsewhere untouched).
    if (IDENTITY_BEARING_KINDS.includes(family) || IDENTITY_BEARING_KINDS.includes(modelKind)) {
      return Object.freeze({
        outcome: 'REVIEW',
        reason: QUALIFIER_KIND_DISAGREEMENT,
        lexiconKind: family,
        modelKind,
        families: [family],
      });
    }
    return Object.freeze({ outcome: 'OPEN_WORLD', lexiconKind: family, modelKind, families: [family] });
  }

  // Two or more free-standing families. "provided that" / "subject to"
  // never auto-bind, so their presence alongside a genuine multi-family
  // fire routes straight to the doubt rule rather than attempting a split.
  if (DOUBT_ONLY_PHRASE_PATTERN.test(binding._internal.normalised)) {
    return doubtOutcome([...familySet], modelKind);
  }

  const parts = attemptSplit(quote, binding, effective);
  if (!parts) {
    return doubtOutcome([...familySet], modelKind);
  }

  const measurementDateEligible = familySet.has('TEMPORAL') && [...familySet].every((f) => f === 'TEMPORAL' || f === 'ACCURACY');

  const classifiedParts = parts.map((part) => {
    const code = part.family === 'ACCURACY' ? deriveAccuracyCode(part.text) : null;
    return Object.freeze({
      start: part.start,
      end: part.end,
      text: part.text,
      kind: part.family,
      code,
      measurementDateEligible: part.family === 'TEMPORAL' ? measurementDateEligible : null,
    });
  });

  return Object.freeze({ outcome: 'SPLIT', parts: Object.freeze(classifiedParts) });
}

// Section 2 item 3: PERFORMANCE_ASSUMPTION_PATTERN matched and the legacy
// familySet was empty. classify unless the model hint is a definite,
// differing new-vocabulary/identity-bearing call.
function classifyPerformanceAssumption(quote, modelKind) {
  if (modelKind === 'ACCURACY') {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: QUALIFIER_KIND_DISAGREEMENT,
      lexiconKind: 'PERFORMANCE_ASSUMPTION',
      modelKind,
      families: ['PERFORMANCE_ASSUMPTION'],
    });
  }
  if (modelKind === 'DISCLOSURE_SCHEDULE_CARVEOUT') {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: QUALIFIER_KIND_DISAGREEMENT,
      lexiconKind: 'PERFORMANCE_ASSUMPTION',
      modelKind,
      families: ['PERFORMANCE_ASSUMPTION'],
    });
  }
  return Object.freeze({
    outcome: 'CLASSIFIED',
    kind: 'PERFORMANCE_ASSUMPTION',
    code: null,
    measurementDateEligible: null,
    lexiconKind: 'PERFORMANCE_ASSUMPTION',
    modelKind,
  });
}

function buildClassified(quote, family, familySet, modelKind) {
  if (family === 'ACCURACY') {
    const code = deriveAccuracyCode(quote);
    if (code === null) {
      // Plan item 5: zero/multiple whitelist matches -> code null, AND
      // review when the kind is ACCURACY (an ACCURACY claim with no
      // derivable code cannot mint REPRESENTATION_ACCURACY_STANDARD).
      return Object.freeze({
        outcome: 'REVIEW',
        reason: QUALIFIER_KIND_UNCLASSIFIED,
        lexiconKind: 'ACCURACY',
        modelKind,
        families: ['ACCURACY'],
      });
    }
    return Object.freeze({
      outcome: 'CLASSIFIED',
      kind: 'ACCURACY',
      code,
      measurementDateEligible: null,
      lexiconKind: 'ACCURACY',
      modelKind,
    });
  }
  const measurementDateEligible = family === 'TEMPORAL' ? familySet.size === 1 : null;
  return Object.freeze({
    outcome: 'CLASSIFIED',
    kind: family,
    code: null,
    measurementDateEligible,
    lexiconKind: family,
    modelKind,
  });
}

function doubtOutcome(families, modelKind) {
  // P2 section 6: generalized to IDENTITY_BEARING_KINDS.
  const touchesAccuracy =
    families.some((f) => IDENTITY_BEARING_KINDS.includes(f)) || IDENTITY_BEARING_KINDS.includes(modelKind);
  if (touchesAccuracy) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: QUALIFIER_KIND_DISAGREEMENT,
      lexiconKind: null,
      modelKind,
      families: [...families],
    });
  }
  return Object.freeze({ outcome: 'OPEN_WORLD', lexiconKind: null, modelKind, families: [...families] });
}

// Attach clauseText lazily on the public binding function's output so
// consumers see the real substring without threading `quote` through every
// internal helper above.
function applyExceptionConnectiveBindingPublic(quote) {
  const raw = applyExceptionConnectiveBinding(quote);
  const boundClauses = raw.boundClauses.map((bc) => withClauseText(quote, bc));
  return Object.freeze({
    boundClauses: Object.freeze(boundClauses),
    maskedSpans: raw.maskedSpans,
    hostlessDoubts: raw.hostlessDoubts,
    markerOccurrences: raw.markerOccurrences,
  });
}

module.exports = Object.freeze({
  QUALIFIER_KIND_LEXICON_VERSION,
  QUALIFIER_KINDS,
  QUALIFIER_KIND_DISAGREEMENT,
  QUALIFIER_KIND_UNCLASSIFIED,
  DISCLOSURE_CARVEOUT_PARTIAL,
  DISCLOSURE_CARVEOUT_UNCORROBORATED,
  PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE,
  IDENTITY_BEARING_KINDS,
  LEGACY_HINT_ABSTENTION_KINDS,
  KNOWLEDGE_PATTERNS,
  TEMPORAL_SYMBOLIC_DATES,
  ACCURACY_PATTERNS,
  THRESHOLD_PATTERNS,
  ACCURACY_CODES,
  ACCURACY_CODE_WHITELIST,
  MAE_TOLERANCE_FAILURE_IDIOM_PATTERN,
  AUTO_BINDING_CONNECTIVE_PHRASES,
  DISCLOSURE_CARVEOUT_CLAUSE_PATTERN,
  DISCLOSURE_CARVEOUT_SIGNAL_PATTERN,
  MAE_QUALIFIER_IDIOM_PATTERN,
  PERFORMANCE_ASSUMPTION_PATTERN,
  AS_OF_BRIDGE_PATTERN_SOURCE,
  TEMPORAL_PERIOD_PATTERN,
  findTemporalPeriodOccurrences,
  findAllMarkerOccurrences,
  deriveAccuracyCode,
  applyExceptionConnectiveBinding: applyExceptionConnectiveBindingPublic,
  classifyQualifierQuote,
});
