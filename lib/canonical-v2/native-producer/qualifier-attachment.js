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
 *                   SERIES markers ("in each case", "in either case", "in
 *                   any case", "in all cases", "in each of the foregoing",
 *                   "in each such case", "with respect to each of the
 *                   foregoing") imply the whole series -> ALL_ITEMS.
 *                   SINGLE-CLAUSE markers ("in the case of clause", "in the
 *                   case of the foregoing clause", "solely with respect to",
 *                   "with respect to clause") imply the final item only ->
 *                   THIS_ITEM_ONLY.
 *                 Both present -> AMBIGUOUS (contradictory drafting is a
 *                 genuine review item, not something to paper over). Neither
 *                 present -> AMBIGUOUS (the model must never pick a reading
 *                 for genuinely silent trailing text).
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

// Case-insensitive literal marker phrases (Ben's exact wording). Order
// within each family does not matter; the first match wins and its own
// matched substring (preserving source casing) is what gets recorded.
const SERIES_MARKER_PATTERNS = Object.freeze([
  /in each case/i,
  /in either case/i,
  /in any case/i,
  /in all cases/i,
  /in each of the foregoing/i,
  /in each such case/i,
  /with respect to each of the foregoing/i,
]);

// Single-clause markers optionally swallow a trailing parenthetical clause
// reference ("in the case of clause (iv)") when one immediately follows, so
// the recorded signal is the fullest verbatim phrase actually present.
const SINGLE_CLAUSE_MARKER_PATTERNS = Object.freeze([
  /in the case of the foregoing clauses?(?:\s*\([^)]{1,20}\))?/i,
  /in the case of clauses?(?:\s*\([^)]{1,20}\))?/i,
  /solely with respect to/i,
  /with respect to clauses?(?:\s*\([^)]{1,20}\))?/i,
]);

function firstMarkerMatch(text, patterns) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[0];
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
 *   ambiguity_signals: object, readings: (Array|null)}}
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
  const singleClauseMatch = firstMarkerMatch(quoteText, SINGLE_CLAUSE_MARKER_PATTERNS);

  const ambiguitySignals = Object.freeze({
    comma_before_qualifier: Boolean(commaBeforeQualifier),
    in_each_case_language: seriesMatch,
    single_clause_language: singleClauseMatch,
    items_grammatically_parallel: typeof itemsGrammaticallyParallel === 'boolean' ? itemsGrammaticallyParallel : null,
  });

  let scopeReading;
  let governsPath = null;
  let readings = null;

  if (position === 'CHAPEAU') {
    scopeReading = 'ALL_ITEMS';
    governsPath = null;
  } else if (position === 'ITEM') {
    scopeReading = 'THIS_ITEM_ONLY';
    governsPath = isNonEmptyPath(modelGovernsPath) ? [...modelGovernsPath] : null;
  } else {
    // TRAILING -- the HARD RULE: scope_reading is NEVER read from the model.
    // It is always one of the four deterministic outcomes below, decided
    // purely by which marker families matched the qualifier's own quote.
    if (seriesMatch && singleClauseMatch) {
      scopeReading = 'AMBIGUOUS'; // contradictory drafting -- a genuine review item
    } else if (seriesMatch) {
      scopeReading = 'ALL_ITEMS';
    } else if (singleClauseMatch) {
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
    ambiguity_signals: ambiguitySignals,
    readings,
  });
}

module.exports = {
  POSITIONS,
  SERIES_MARKER_PATTERNS,
  SINGLE_CLAUSE_MARKER_PATTERNS,
  firstMarkerMatch,
  buildAmbiguousReadings,
  resolveQualifierAttachment,
};
