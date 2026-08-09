/**
 * lib/canonical-v2/native-producer/qualifier-attachment.js
 *
 * Deterministic resolution of a qualifier's ATTACHMENT: where it sits
 * relative to an enumerated list of limbs, and what that implies about its
 * scope. See docs/archive/handoffs/F28-FIRST-LIVE-RUN.md defect 2 and
 * capitalisation-producer-prompt.js's "QUALIFIER POSITION" instruction.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE, NOT INLINE IN THE MODEL RESPONSE
 *
 * A trailing qualifier (one that sits after the last item of an enumerated
 * list) is the classic last-antecedent problem: "governs the whole series"
 * and "governs the final item only" are both grammatically live readings,
 * and only explicit drafting language -- not the model's own judgment --
 * can settle it. Trusting the model to report its own resolved scope would
 * reintroduce exactly the silent-guess failure this feature exists to
 * remove. So the model is asked ONLY for POSITION (CHAPEAU / ITEM /
 * TRAILING) and the qualifier's own verbatim text; this module is the ONE
 * place that turns those two facts into a scope_reading, by a fixed, tested,
 * lexical rule -- never by re-asking the model and never by trusting a
 * model-supplied scope_reading field (there is no such field in the response
 * contract; see capitalisation-producer-prompt.js's RESPONSE_SHAPE).
 *
 * THE RULE (CHAPEAU and ITEM are unambiguous; TRAILING is a lexical test):
 *   - CHAPEAU  -> scope_reading ALL_ITEMS, governs_path null.
 *   - ITEM     -> scope_reading THIS_ITEM_ONLY, governs_path the model's
 *                 stated limb_path (the limb the qualifier's own text sits
 *                 inside).
 *   - TRAILING -> scan the qualifier's own verbatim quote (never a
 *                 model-supplied field) for two literal marker families:
 *                   SERIES markers ("in each case", "in either case",
 *                   "in all cases", "in each such case") imply the whole
 *                   series -> ALL_ITEMS. "in any case" was retired (Step
 *                   2X-A1): corpus uses are dominated by non-scope senses.
 *                   SINGLE-CLAUSE markers ("in the case of clause", "in the
 *                   case of the foregoing clause", "solely with respect to",
 *                   "with respect to clause") with zero or one parenthetical
 *                   clause reference imply the final item only ->
 *                   THIS_ITEM_ONLY. The same markers with two or more
 *                   parenthetical clause references in the run ("in the
 *                   case of clauses (ii) and (iii)") imply an explicitly
 *                   named subset -> NAMED_SUBSET, carrying the clause list.
 *                 Both SERIES and SINGLE-CLAUSE/NAMED_SUBSET present ->
 *                 AMBIGUOUS (contradictory drafting is a genuine review
 *                 item, not something to paper over). Neither present ->
 *                 AMBIGUOUS (the model must never pick a reading for
 *                 genuinely silent trailing text).
 *
 * DECISION SUPPORT FOR THE AMBIGUOUS CASE. When scope_reading is AMBIGUOUS,
 * `readings` names the concrete consequence of each option -- SERIES (every
 * sibling limb_path in the representation) and LAST_ANTECEDENT (the final
 * sibling limb_path only) -- derived purely from the limb_path structure
 * already captured, never asked of the model, so a human reviewer sees
 * exactly what each reading would mean without re-deriving it by hand.
 */

'use strict';

const POSITIONS = Object.freeze(['CHAPEAU', 'ITEM', 'TRAILING']);

const SCOPE_READINGS = Object.freeze([
  'ALL_ITEMS',
  'THIS_ITEM_ONLY',
  'NAMED_SUBSET',
  'AMBIGUOUS',
]);

// Case-insensitive literal marker phrases (Ben's exact wording). Order
// within each family does not matter; the first match wins and its own
// matched substring (preserving source casing) is what gets recorded.
//
// Retired (Step 2X-A1 corpus audit, zero occurrences in evidence/canonical-v2):
//   "in each of the foregoing", "with respect to each of the foregoing".
// Retired (Step 2X-A1 false friend, non-scope senses dominate corpus):
//   "in any case".
const SERIES_MARKER_PATTERNS = Object.freeze([
  /in each case/i,
  /in either case/i,
  /in all cases/i,
  /in each such case/i,
]);

// Single-clause marker bases. Clause-reference-bearing bases optionally
// swallow a run of parentheticals ("in the case of clauses (ii) and (iii)")
// so every named limb is captured, not just the first.
const SINGLE_CLAUSE_MARKER_BASES = Object.freeze([
  { pattern: /in the case of the foregoing clauses?/i, hasClauseRef: true },
  { pattern: /in the case of clauses?/i, hasClauseRef: true },
  { pattern: /solely with respect to/i, hasClauseRef: false },
  { pattern: /with respect to clauses?/i, hasClauseRef: true },
]);

// Parenthetical clause-reference run immediately following a clause-bearing
// base: one or more "(…)" groups separated by "and"/"or" (optional commas).
const CLAUSE_REF_RUN = /(?:\s*\([^)]{1,20}\)(?:\s*(?:,\s*)?(?:and|or)\s+)?)+/i;

// Legacy export: the old flat-regex list is no longer authoritative for
// matching (named-subset runs need post-processing), but kept for tests that
// assert the bases still exist.
const SINGLE_CLAUSE_MARKER_PATTERNS = Object.freeze(
  SINGLE_CLAUSE_MARKER_BASES.map(({ pattern }) => pattern),
);

function firstMarkerMatch(text, patterns) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

/**
 * Extract every parenthetical clause label from a matched substring.
 * @param {string} text
 * @returns {string[]}
 */
function extractParentheticalClausePaths(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const paths = [];
  const re = /\([^)]{1,20}\)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    paths.push(match[0]);
  }
  return paths;
}

/**
 * Match a single-clause or named-subset marker in `text`. Returns the fullest
 * verbatim phrase present plus every parenthetical clause label captured in
 * the clause-reference run (empty when the base has no clause references).
 *
 * @param {string} text
 * @returns {{ matched: string, clausePaths: string[] }|null}
 */
function matchSingleClauseMarker(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const { pattern, hasClauseRef } of SINGLE_CLAUSE_MARKER_BASES) {
    const baseMatch = pattern.exec(text);
    if (!baseMatch) continue;
    let matched = baseMatch[0];
    if (hasClauseRef) {
      const rest = text.slice(baseMatch.index + baseMatch[0].length);
      const runMatch = CLAUSE_REF_RUN.exec(rest);
      if (runMatch) matched += runMatch[0];
    }
    const clausePaths = hasClauseRef
      ? extractParentheticalClausePaths(matched.slice(baseMatch[0].length))
      : [];
    return { matched, clausePaths };
  }
  return null;
}

function isNonEmptyPath(value) {
  return Array.isArray(value) && value.length > 0 && value.every((label) => typeof label === 'string' && label.length > 0);
}

/**
 * Deterministic decision support for a genuinely AMBIGUOUS trailing
 * qualifier: what each of the two live readings would concretely mean,
 * given the sibling limb_paths already captured for this representation.
 * Returns null if there are no sibling limb_paths to reason about (nothing
 * for a human to choose between).
 */
function buildAmbiguousReadings(siblingLimbPaths) {
  const paths = (Array.isArray(siblingLimbPaths) ? siblingLimbPaths : []).filter(isNonEmptyPath);
  if (paths.length === 0) return null;
  const last = paths[paths.length - 1];
  return Object.freeze([
    Object.freeze({
      reading: 'SERIES',
      governs_paths: Object.freeze(paths.map((path) => Object.freeze([...path]))),
    }),
    Object.freeze({
      reading: 'LAST_ANTECEDENT',
      governs_paths: Object.freeze([Object.freeze([...last])]),
    }),
  ]);
}

/**
 * Resolves one qualifier's full attachment object. Pure function: every
 * input is a plain value, every output is a plain frozen value, no model
 * calls, no I/O.
 *
 * @param {object} args
 * @param {string} args.position                  CHAPEAU | ITEM | TRAILING (from the model)
 * @param {Array|null} [args.governs_path]         the model's stated limb_path, if any
 * @param {string} args.quote_text                 the qualifier's OWN byte-verified quote --
 *                                                  the marker test runs against THIS, never
 *                                                  against a model-supplied signal field
 * @param {boolean|null} [args.items_grammatically_parallel] the one ambiguity signal the
 *                                                  model does supply (a grammatical judgment
 *                                                  call, not a lexical fact)
 * @param {boolean} [args.comma_before_qualifier]  computed by the caller from the source
 *                                                  bytes immediately preceding the quote
 *                                                  (see anthropic-provider.js) -- never from
 *                                                  a model-supplied field
 * @param {Array[]} [args.sibling_limb_paths]       every limb_path captured for this
 *                                                  representation instance, in document order
 * @returns {{position: string, governs_path: (Array|null), scope_reading: string,
 *   named_subset_paths: (Array|null), ambiguity_signals: object, readings: (Array|null)}}
 */
function resolveQualifierAttachment({
  position,
  governs_path: modelGovernsPath = null,
  quote_text: quoteText = '',
  items_grammatically_parallel: itemsGrammaticallyParallel = null,
  comma_before_qualifier: commaBeforeQualifier = false,
  sibling_limb_paths: siblingLimbPaths = [],
} = {}) {
  if (!POSITIONS.includes(position)) {
    throw new TypeError(`attachment.position must be one of ${POSITIONS.join(', ')}, got: ${position}`);
  }

  const seriesMatch = firstMarkerMatch(quoteText, SERIES_MARKER_PATTERNS);
  const singleClauseResult = matchSingleClauseMarker(quoteText);
  const singleClauseMatch = singleClauseResult ? singleClauseResult.matched : null;
  const namedSubsetPaths = singleClauseResult && singleClauseResult.clausePaths.length >= 2
    ? Object.freeze([...singleClauseResult.clausePaths])
    : null;
  const namedSubsetLanguage = namedSubsetPaths ? singleClauseMatch : null;
  const singleClauseLanguage = singleClauseResult && !namedSubsetPaths ? singleClauseMatch : null;

  const ambiguitySignals = Object.freeze({
    comma_before_qualifier: Boolean(commaBeforeQualifier),
    in_each_case_language: seriesMatch,
    single_clause_language: singleClauseLanguage,
    named_subset_language: namedSubsetLanguage,
    items_grammatically_parallel: typeof itemsGrammaticallyParallel === 'boolean' ? itemsGrammaticallyParallel : null,
  });

  let scopeReading;
  let governsPath = null;
  let readings = null;
  let namedSubsetPathsOut = null;

  if (position === 'CHAPEAU') {
    scopeReading = 'ALL_ITEMS';
    governsPath = null;
  } else if (position === 'ITEM') {
    scopeReading = 'THIS_ITEM_ONLY';
    governsPath = isNonEmptyPath(modelGovernsPath) ? [...modelGovernsPath] : null;
  } else {
    // TRAILING -- the HARD RULE: scope_reading is NEVER read from the model.
    // It is always one of the deterministic outcomes below, decided
    // purely by which marker families matched the qualifier's own quote.
    const hasClauseMarker = Boolean(singleClauseResult);
    if (seriesMatch && hasClauseMarker) {
      scopeReading = 'AMBIGUOUS'; // contradictory drafting -- a genuine review item
    } else if (seriesMatch) {
      scopeReading = 'ALL_ITEMS';
    } else if (namedSubsetPaths) {
      scopeReading = 'NAMED_SUBSET';
      namedSubsetPathsOut = namedSubsetPaths;
    } else if (hasClauseMarker) {
      scopeReading = 'THIS_ITEM_ONLY';
    } else {
      scopeReading = 'AMBIGUOUS'; // silent trailing text -- the model must never pick
    }
    governsPath = isNonEmptyPath(modelGovernsPath) ? [...modelGovernsPath] : null;
    if (scopeReading === 'AMBIGUOUS') {
      readings = buildAmbiguousReadings(siblingLimbPaths);
    }
  }

  return Object.freeze({
    position,
    governs_path: governsPath ? Object.freeze(governsPath) : null,
    scope_reading: scopeReading,
    named_subset_paths: namedSubsetPathsOut,
    ambiguity_signals: ambiguitySignals,
    readings,
  });
}

module.exports = {
  POSITIONS,
  SCOPE_READINGS,
  SERIES_MARKER_PATTERNS,
  SINGLE_CLAUSE_MARKER_PATTERNS,
  SINGLE_CLAUSE_MARKER_BASES,
  CLAUSE_REF_RUN,
  firstMarkerMatch,
  extractParentheticalClausePaths,
  matchSingleClauseMarker,
  buildAmbiguousReadings,
  resolveQualifierAttachment,
};
