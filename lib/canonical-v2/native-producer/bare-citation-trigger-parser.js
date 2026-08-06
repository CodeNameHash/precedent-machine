/**
 * lib/canonical-v2/native-producer/bare-citation-trigger-parser.js
 *
 * docs/codex-program/notes/citation-scope-design.md, Part 6.3: "a parser
 * for 'does this quote contain an explicit section reference and nothing
 * else usable' (distinct from a quote that merely mentions a section in
 * passing among other descriptive text: only the bare-citation shape
 * licenses the lookup)". This hardens the heuristic that document's own
 * offline harness (scripts/canonical-v2-citation-scope-resolution-
 * harness.mjs, `isBareCitationQuote`) prototyped -- that prototype's
 * narrow connector-word list misses real quotes in the committed evidence
 * (e.g. "terminated by the Company pursuant to Section 7.1(c)(ii) or
 * Section 7.1(c)(iii)" fails it on the word "terminated"; "if payable
 * pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v)" fails it on "if" /
 * "payable") -- both real, bare, trigger_code:null quotes in
 * evidence/canonical-v2/modiv-termination-fee-promptv3-20260805.
 *
 * WHY THIS MATTERS (not a style preference): `parseBareCitationTriggerQuote`
 * is the licence check that gates citation-following in
 * candidate-resolution.js's `handleFeeTriggerCandidate`. A FALSE NEGATIVE
 * (a genuinely bare quote misclassified as "not bare") only costs a missed
 * opportunity -- the candidate falls through to today's unmodified
 * TRIGGER_UNCORROBORATED outcome, exactly as if this module did not exist.
 * A FALSE POSITIVE (a quote that carries its own real descriptive content
 * misclassified as "bare") would license the citation-following resolver
 * to borrow ANOTHER section's trigger_code for a candidate that already had
 * a fair, honest chance to corroborate on its OWN quote -- which is exactly
 * the shape of hallucination this family's byte-verification discipline
 * exists to prevent. This module is therefore deliberately conservative in
 * one direction only: the word list below stays narrow (pure connective/
 * framing vocabulary, never a word that could plausibly appear in a REAL
 * description of a termination ground -- "breach", "recommendation",
 * "proposal", "meeting", "outside", "date" are all deliberately absent) so
 * that the one committed real quote this module MUST reject --
 * MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE-shaped text, real descriptive prose
 * that merely mentions a section in passing -- reliably leaves enough
 * un-stripped residue to fail the bare test. See this module's own test
 * file for that quote pinned as a negative case.
 *
 * SCOPE: this module answers ONE question about ONE quote -- section
 * resolution, ambiguity detection, dedup and dispatch selection are the
 * orchestrator's job (native-extraction-run-citation-followup.js), and
 * gating what a resolved answer is allowed to publish is
 * candidate-resolution.js's. This module never reads a tree, never makes a
 * network or model call, and never mutates anything.
 */

'use strict';

// Matches "Section 7.1(d)(ii)", "Section 8.12", "Section 7.3(b)" etc. --
// digits, optional decimal, then zero or more (letter|digit|roman) marker
// groups. Same shape as scripts/canonical-v2-citation-scope-resolution-
// harness.mjs's own CITATION_PATTERN, reproduced here rather than imported
// so this module has no dependency on a scripts/ file (which is not
// require()-safe as a library dependency and is not under this module's
// remit to promote).
const CITATION_PATTERN = /Section\s+(\d+(?:\.\d+)?(?:\([A-Za-z0-9]+\))*)/g;

// Enumeration/list markers a bare cross-reference clause is typically
// introduced or punctuated by -- "(i)", "(ii)", "(A)", "(1)" -- structural
// list furniture, never ground-describing content on their own. Bounded to
// 1-4 characters so it never eats a real parenthetical aside (e.g.
// "(whether or not conditional)" in the topping-fee quote is far longer
// than 4 characters and is deliberately left as real residue).
const ENUMERATION_MARKER_PATTERN = /\([A-Za-z0-9]{1,4}\)/g;

// Purely mechanical connector/framing words a bare cross-reference clause
// is built from. Deliberately narrow -- see the file header's "WHY THIS
// MATTERS" note for why widening this list is a real safety question, not
// a convenience one.
const CONNECTOR_WORD_LIST = [
  'by', 'the', 'company', 'parent', 'pursuant', 'to', 'or', 'and', 'this', 'agreement',
  'a', 'an', 'of', 'if', 'payable', 'terminated', 'terminate', 'terminating', 'termination',
  'is', 'are', 'was', 'were', 'shall', 'will', 'be', 'then', 'as', 'applicable', 'either', 'both',
];
const CONNECTOR_WORDS_PATTERN = new RegExp(`\\b(?:${CONNECTOR_WORD_LIST.join('|')})\\b`, 'gi');

// A stray leftover character or two (an orphaned comma-space artifact left
// by stripping) does not disqualify a quote from being bare -- mirrors the
// offline harness's own `<= 2` threshold, kept here because enumeration
// markers and connector words are already stripped by dedicated passes
// above, so this tolerance now only ever has to absorb punctuation noise,
// never a real marker.
const BARE_RESIDUE_MAX_LENGTH = 2;

function stripBareCitationFraming(quote) {
  return quote
    .replace(CITATION_PATTERN, ' ')
    .replace(ENUMERATION_MARKER_PATTERN, ' ')
    .replace(CONNECTOR_WORDS_PATTERN, ' ')
    .replace(/[().,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} quote a producer-asserted `fee_trigger_assertions[].quote`
 *   (candidate `raw_value`) to classify.
 * @returns {{ is_bare_citation: boolean, cited_references: string[] }}
 *   `cited_references` is every distinct "Section X..." reference string
 *   found in `quote`, in first-appearance order, POPULATED REGARDLESS of
 *   whether the quote is classified as bare -- a quote can name a section
 *   in passing without being bare (the topping-fee arming quote does
 *   exactly this: it cites Section 7.1(b)(ii)/7.1(b)(iii) but is not
 *   bare), and a caller that only wants to see which sections a quote
 *   *mentions* (independent of the bare-citation licence question) can use
 *   this field on its own. `is_bare_citation` is the only field that gates
 *   citation-following: a quote citing something IN PASSING, alongside its
 *   own real descriptive text, "already has a chance to resolve on its own
 *   quote, and citation-following is not licensed for it" (design doc Part
 *   6.3). A quote citing NOTHING (`cited_references.length === 0`) is
 *   never bare either -- there is nothing to follow.
 */
function parseBareCitationTriggerQuote(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    return Object.freeze({ is_bare_citation: false, cited_references: Object.freeze([]) });
  }

  const citedReferences = [];
  const seen = new Set();
  for (const match of quote.matchAll(CITATION_PATTERN)) {
    const reference = match[1];
    if (!seen.has(reference)) {
      seen.add(reference);
      citedReferences.push(reference);
    }
  }
  const frozenReferences = Object.freeze(citedReferences);

  if (citedReferences.length === 0) {
    return Object.freeze({ is_bare_citation: false, cited_references: frozenReferences });
  }

  const residue = stripBareCitationFraming(quote);
  const isBare = residue.length <= BARE_RESIDUE_MAX_LENGTH;

  return Object.freeze({ is_bare_citation: isBare, cited_references: frozenReferences });
}

module.exports = {
  CITATION_PATTERN,
  parseBareCitationTriggerQuote,
};
