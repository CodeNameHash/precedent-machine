/**
 * lib/canonical-v2/native-producer/mae-clause-label-parse.js
 *
 * Pure, deterministic clause_label verification for the MAE-definition
 * family (docs/codex-program/notes/mae-clause-label.md). Mirrors
 * termination-fee-parse.js's own contract shape: this module never calls a
 * model and never touches I/O -- candidate-resolution.js decides which
 * candidates are even eligible to reach it (enum checks, corroboration) and
 * gathers the plain-string inputs (sectionText, sibling quotes) from its own
 * already-admitted source context; this module answers exactly one
 * question -- does clauseLabel genuinely denote quote's own position -- and
 * says so honestly, typed, when it cannot.
 *
 * THE DEFECT THIS FIXES. mae-definition-producer-prompt.js's RESPONSE_SHAPE
 * carries clause_label and quote as two SEPARATE fields on purpose: "narrow
 * the quote to the single clause you are coding" when one lettered clause
 * legitimately matches two carve-out codes. A correctly narrowed quote
 * therefore does not, and should not, restate its own leading label -- so
 * candidate-resolution.js's original check (clauseLabel must be a substring
 * of quote itself) failed almost every real carve-out, and only ever passed
 * by coincidence, when a clause's OWN internal proviso happened to
 * self-reference its own letter ("... provided that this clause (C) shall
 * not apply ..."). Confirmed against TopBuild's real, committed, first live
 * MAE_DEFINITION run (evidence/canonical-v2/topbuild-mae-definition-
 * 20260806/): the model's own recorded response already carries clause_label
 * as its own correctly-populated field for every one of the 17 candidates
 * this fix resolves -- nothing here asks the model for anything new.
 *
 * TIERED VERIFICATION, EACH TIER STRICTLY ADDITIVE OVER THE LAST (never
 * removes a way a label could already be verified, only adds new ones --
 * see verifyMaeClauseLabel's own header for the full account, and the
 * design note for the empirical count against TopBuild's real 17; tier 4,
 * structural clause containment via lib/parser-v2/subclauses.js, was added
 * by the Stage 2 structural fix for compound-clause sub-items with no
 * full-clause sibling, verified against Metsera's and Concho's real rows).
 *
 * EVERY OUTCOME IS TYPED, never a bare boolean internally (verifyMaeClauseLabel
 * itself returns a boolean because that is the exact shape its two call
 * sites in candidate-resolution.js already gate on -- see that function's
 * own header) -- the two helper tiers (verifyMaeClauseLabelAdjacency,
 * selectMaeClauseLabelSibling) return `{ outcome, ... }` so a caller
 * building a residual or a test assertion can see WHICH tier answered and
 * why, exactly like parseFeeAmount / selectFeeAmountGroundsCondition's own
 * discipline in the sibling termination-fee-parse.js module.
 */

'use strict';

// V1's deterministic sub-clause segmenter, consumed rather than
// re-implemented (docs/core/CLAUDE.md's "check the library before the
// scripts"; lib/parser-v2/subclauses.js has its own 60-test suite and other
// live callers). COORDINATE-SPACE NOTE, load-bearing: segmentSubClauses
// works in UTF-16 STRING indices over the decoded string it is given, while
// the V2 pipeline slices by UTF-8 bytes -- tier 4 below therefore does ALL
// of its arithmetic inside the one string it was handed (leaf offsets and
// indexOf over the same string), and never exports an offset to a caller,
// so no byte/string-index conversion is needed and none can silently go
// wrong.
const { segmentSubClauses } = require('../../parser-v2/subclauses');

/**
 * Tier 2: does clauseLabel immediately precede quote's own UNIQUE location
 * in sectionText, modulo trailing whitespace/newlines between the label and
 * the quote (real filings wrap and indent between "(D)" and the clause text
 * that follows it)? Proven against the real, admitted section text, not the
 * model's own (deliberately narrowed) quote.
 *
 * Fails closed, never guesses: a quote that does not appear in sectionText
 * at all, or appears more than once, returns QUOTE_NOT_LOCATED rather than
 * picking an occurrence -- mirrors locateAllQuoteBytes's own "ambiguous ->
 * not found" discipline (anthropic-provider.js) applied here to a plain
 * string search over already-admitted text rather than a fresh byte
 * relocation, exactly as grounds-to-amount-mapping.md's own governing
 * principle chose for the analogous termination-fee join (section 4: "no
 * new byte-verification is invented ... done in the resolver, not a fresh
 * sourceBytes re-verification").
 *
 * @param {object} args
 * @param {string} args.sectionText the governing section's own admitted text.
 * @param {string} args.quote the candidate's own already-verified quote.
 * @param {string} args.clauseLabel the candidate's own asserted clause_label.
 * @returns {{outcome: 'ADJACENT'} | {outcome: 'NOT_ADJACENT'} | {outcome: 'QUOTE_NOT_LOCATED', occurrences: number}}
 */
function verifyMaeClauseLabelAdjacency({ sectionText, quote, clauseLabel }) {
  if (typeof sectionText !== 'string' || typeof quote !== 'string' || quote.length === 0
    || typeof clauseLabel !== 'string' || clauseLabel.length === 0) {
    throw new TypeError('verifyMaeClauseLabelAdjacency requires non-empty { sectionText, quote, clauseLabel } strings');
  }
  const firstIndex = sectionText.indexOf(quote);
  if (firstIndex === -1) return Object.freeze({ outcome: 'QUOTE_NOT_LOCATED', occurrences: 0 });
  if (sectionText.indexOf(quote, firstIndex + 1) !== -1) {
    return Object.freeze({ outcome: 'QUOTE_NOT_LOCATED', occurrences: 2 });
  }
  const preceding = sectionText.slice(0, firstIndex).replace(/\s+$/, '');
  return Object.freeze({ outcome: preceding.endsWith(clauseLabel) ? 'ADJACENT' : 'NOT_ADJACENT' });
}

/**
 * Tier 3: is quote uniquely nested inside exactly one candidate sibling
 * quote (a sibling being another compiled MAE candidate in the SAME
 * section sharing this EXACT clause_label, already itself tier-1/tier-2
 * verified by the caller -- see verifyMaeClauseLabel)? Fixes a compound
 * clause whose several severable sub-items share one label and one common
 * chapeau the model correctly declines to repeat for each sub-item (real
 * TopBuild example: "(D) changes or developments arising out of acts of
 * terrorism ... weather conditions or other acts of God (including
 * storms, earthquakes, floods or other natural disasters or changes due to
 * the outbreak or continuation of any epidemic, pandemic or other health
 * crisis)" narrows into three separate carveout_assertions -- terrorism/war,
 * natural disasters, pandemic -- each correctly quoting only its own
 * distinctive words, none of them adjacent to "(D)" itself). The clause's
 * own limb-local disproportionality quote, when present, always spans the
 * clause's FULL text from its own label onward (it is never narrowed the
 * way a multi-code carve-out's sub-items are), so it both passes tier 2
 * directly and contains every sub-item's own narrower quote as a substring.
 *
 * Ambiguous nesting (quote appears more than once inside one candidate
 * sibling, or more than one sibling qualifies) is refused, never guessed --
 * identical discipline to selectFeeAmountGroundsCondition's own "candidate
 * whose own text appears MORE than once inside the outer quote is excluded
 * entirely" rule (termination-fee-parse.js).
 *
 * @param {object} args
 * @param {string} args.quote the narrower candidate's own already-verified quote.
 * @param {Array<{quote: string}>} args.candidates every OTHER already tier-1/
 *   tier-2-verified sibling sharing this exact clause_label -- the caller is
 *   responsible for that pre-filtering (see verifyMaeClauseLabel).
 * @returns {{outcome: 'NONE'} | {outcome: 'AMBIGUOUS', candidate_count: number} | {outcome: 'SELECTED', candidate: object}}
 */
function selectMaeClauseLabelSibling({ quote, candidates }) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('selectMaeClauseLabelSibling requires a non-empty { quote: string }');
  }
  if (!Array.isArray(candidates)) {
    throw new TypeError('selectMaeClauseLabelSibling requires { candidates: Array }');
  }
  const containing = [];
  for (const candidate of candidates) {
    const siblingQuote = candidate && candidate.quote;
    if (typeof siblingQuote !== 'string' || siblingQuote.length === 0 || siblingQuote === quote) continue;
    const start = siblingQuote.indexOf(quote);
    if (start === -1) continue;
    if (siblingQuote.indexOf(quote, start + 1) !== -1) continue; // ambiguous nesting within this one sibling
    containing.push(candidate);
  }
  if (containing.length === 0) return Object.freeze({ outcome: 'NONE' });
  if (containing.length > 1) return Object.freeze({ outcome: 'AMBIGUOUS', candidate_count: containing.length });
  return Object.freeze({ outcome: 'SELECTED', candidate: containing[0] });
}

/**
 * Tier 4: is quote uniquely located inside the labelled clause's OWN
 * structural span? Fixes the compound-clause sub-item case tier 3 cannot
 * reach: a clause "(G)" narrows into several carveout_assertions, each
 * correctly quoting only its own words, and NO sibling candidate spans the
 * full clause (tier 3 needs one) -- confirmed live on Metsera's (B)/(F)/
 * (G)/(H) and Concho's (iv)/(v)/(viii)/(ix) sub-items, which all queued
 * CLAUSE_LABEL_NOT_IN_QUOTE despite carrying correct labels.
 *
 * The clause span comes from lib/parser-v2/subclauses.js's
 * segmentSubClauses -- V1's proven SIBLING/CHILD-OPEN/DEDENT outline walk,
 * which already distinguishes a real "(v)" limb marker from an inline
 * "Section 3.1(b)(v)" cross-reference -- never from a fresh regex written
 * here. Fails closed, never guesses: refuses when the label matches zero
 * or more than one outline node, when the quote appears anywhere in
 * sectionText other than exactly once, or when that one occurrence falls
 * outside the labelled clause's own span.
 *
 * @param {object} args
 * @param {string} args.sectionText the verification scope's own text (the
 *   whole governing section, or the candidate's own definition record when
 *   the caller scoped it -- see candidate-resolution.js's
 *   maeDefinedTermScopeText).
 * @param {string} args.quote the candidate's own already-verified quote.
 * @param {string} args.clauseLabel the candidate's own asserted clause_label.
 * @returns {{outcome: 'CONTAINED'} | {outcome: 'NOT_CONTAINED'} |
 *   {outcome: 'LABEL_NOT_IN_OUTLINE'} | {outcome: 'LABEL_AMBIGUOUS', node_count: number} |
 *   {outcome: 'QUOTE_NOT_LOCATED', occurrences: number}}
 */
function verifyMaeClauseLabelContainment({ sectionText, quote, clauseLabel }) {
  if (typeof sectionText !== 'string' || typeof quote !== 'string' || quote.length === 0
    || typeof clauseLabel !== 'string' || clauseLabel.length === 0) {
    throw new TypeError('verifyMaeClauseLabelContainment requires non-empty { sectionText, quote, clauseLabel } strings');
  }
  const labelContent = /^\(([A-Za-z0-9]{1,4})\)$/.exec(clauseLabel.trim());
  if (!labelContent) return Object.freeze({ outcome: 'LABEL_NOT_IN_OUTLINE' });
  const label = labelContent[1];

  const leaves = segmentSubClauses(sectionText);
  // The labelled clause's own node paths: every distinct dotted path whose
  // LAST segment is the label. More than one distinct node carrying this
  // label (e.g. "(v)" as both a roman and an alpha item in two different
  // lists) is refused as ambiguous rather than picked between.
  const nodePaths = [...new Set(
    leaves
      .filter((leaf) => typeof leaf.marker === 'string' && leaf.marker.split('.').at(-1) === label)
      .map((leaf) => leaf.marker),
  )];
  if (nodePaths.length === 0) return Object.freeze({ outcome: 'LABEL_NOT_IN_OUTLINE' });
  if (nodePaths.length > 1) return Object.freeze({ outcome: 'LABEL_AMBIGUOUS', node_count: nodePaths.length });
  const nodePath = nodePaths[0];

  // The clause's span: its own leaf plus every descendant leaf (paths
  // prefixed by nodePath + '.') -- contiguous by segmentSubClauses's own
  // partition construction, so min(start)..max(end) covers exactly the
  // clause and nothing else.
  const clauseLeaves = leaves.filter(
    (leaf) => typeof leaf.marker === 'string' && (leaf.marker === nodePath || leaf.marker.startsWith(`${nodePath}.`)),
  );
  const clauseStart = Math.min(...clauseLeaves.map((leaf) => leaf.start));
  const clauseEnd = Math.max(...clauseLeaves.map((leaf) => leaf.end));

  // Same coordinate space throughout: string indices into the SAME
  // sectionText segmentSubClauses walked. Quote must be unique in the whole
  // scope -- the identical fail-closed discipline as tier 2 -- and that one
  // occurrence must sit inside the clause span.
  const firstIndex = sectionText.indexOf(quote);
  if (firstIndex === -1) return Object.freeze({ outcome: 'QUOTE_NOT_LOCATED', occurrences: 0 });
  if (sectionText.indexOf(quote, firstIndex + 1) !== -1) {
    return Object.freeze({ outcome: 'QUOTE_NOT_LOCATED', occurrences: 2 });
  }
  const inside = firstIndex >= clauseStart && firstIndex + quote.length <= clauseEnd;
  return Object.freeze({ outcome: inside ? 'CONTAINED' : 'NOT_CONTAINED' });
}

/**
 * The composed policy candidate-resolution.js's two MAE handlers actually
 * call. Three tiers, each strictly additive over the last -- never removes
 * a way the label could already be verified, only adds new ones:
 *
 *   1. SELF-CONTAINED (the ORIGINAL check, unchanged, tried first): clauseLabel
 *      is a literal substring of quote itself. True whenever a clause
 *      restates its own label in a later proviso ("this clause (C)"), and
 *      true for every pre-existing synthetic test fixture in this repo
 *      (which, pre-dating this fix, all pass quote as the FULL clause text
 *      with its own leading label still attached) -- so this tier alone
 *      keeps every currently-passing test and every currently-resolved real
 *      claim resolving exactly as before.
 *   2. SOURCE-ADJACENT (new): verifyMaeClauseLabelAdjacency above. Fixes the
 *      ordinary case -- a cleanly, correctly narrowed quote that simply
 *      never repeats its own label. 14 of TopBuild's real 17 queued
 *      candidates.
 *   3. SIBLING-CONTAINED (new): selectMaeClauseLabelSibling above, over
 *      SAME-SECTION, SAME-clause_label siblings that are themselves tier-1
 *      or tier-2 verified. Fixes a compound clause's shared-chapeau
 *      sub-items. The remaining 3 of TopBuild's real 17.
 *
 * No new byte-verification is invented (grounds-to-amount-mapping.md
 * section 4's own governing principle, reused here): quote was already
 * independently byte-verified during shaping (anthropic-provider.js's
 * evidenceFromQuote); this only relates two already-asserted,
 * already-in-scope strings -- clauseLabel and quote's own position -- to
 * the resolver's own already-admitted sectionText, or to another already-
 * verified sibling claim's own quote.
 *
 * @param {object} args
 * @param {string} args.quote the candidate's own already-verified quote.
 * @param {string} args.clauseLabel the candidate's own asserted clause_label.
 * @param {string} [args.sectionText] the governing section's own admitted
 *   text -- absent/non-string short-circuits to tier 1 only (defensive; the
 *   resolver always has this when a section resolved at all).
 * @param {string[]} [args.siblingQuotes] every OTHER compiled MAE candidate's
 *   own quote in the SAME section sharing this EXACT clause_label (may
 *   include quotes that turn out not to be tier-1/tier-2 verified
 *   themselves -- this function filters them, the caller need not).
 * @returns {boolean}
 */
function verifyMaeClauseLabel({
  quote, clauseLabel, sectionText, siblingQuotes = [],
}) {
  if (typeof quote !== 'string' || quote.length === 0
    || typeof clauseLabel !== 'string' || clauseLabel.length === 0) {
    return false;
  }
  if (quote.includes(clauseLabel)) return true; // tier 1
  if (typeof sectionText !== 'string' || sectionText.length === 0) return false;

  const directlyAdjacent = (candidateQuote) => {
    if (typeof candidateQuote !== 'string' || candidateQuote.length === 0) return false;
    if (candidateQuote.includes(clauseLabel)) return true;
    return verifyMaeClauseLabelAdjacency({ sectionText, quote: candidateQuote, clauseLabel }).outcome === 'ADJACENT';
  };

  if (directlyAdjacent(quote)) return true; // tier 2

  const verifiedSiblings = siblingQuotes
    .filter((siblingQuote) => siblingQuote !== quote && directlyAdjacent(siblingQuote))
    .map((siblingQuote) => ({ quote: siblingQuote }));
  const viaSibling = selectMaeClauseLabelSibling({ quote, candidates: verifiedSiblings });
  if (viaSibling.outcome === 'SELECTED') return true; // tier 3

  // tier 4 (strictly additive over tiers 1-3, same discipline): structural
  // clause containment via V1's outline segmenter -- see
  // verifyMaeClauseLabelContainment's own header for the compound-clause
  // sub-item shape this reaches that tier 3 cannot.
  return verifyMaeClauseLabelContainment({ sectionText, quote, clauseLabel }).outcome === 'CONTAINED';
}

module.exports = {
  verifyMaeClauseLabelAdjacency,
  selectMaeClauseLabelSibling,
  verifyMaeClauseLabelContainment,
  verifyMaeClauseLabel,
};
