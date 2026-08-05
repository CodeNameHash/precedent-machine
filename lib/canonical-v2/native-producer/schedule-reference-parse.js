/**
 * lib/canonical-v2/native-producer/schedule-reference-parse.js
 *
 * Pure, deterministic parser for the `SCHEDULE_REFERENCE_STRING` POINTER
 * value, per
 * docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md section 5a.
 * No I/O, no model, every outcome typed -- the P1 parser-contract precedent
 * (share-count-parse.js / measurement-date-parse.js).
 *
 * IMPORTS, NOT RE-DERIVES: `DISCLOSURE_CARVEOUT_CLAUSE_PATTERN` from the
 * lexicon (one grammar) and `parseCitationComponents`/`citationFromComponents`
 * from citation-constructibility.js (one normalizer) -- the CALENDAR_DATE_
 * PATTERN reuse precedent. Re-validates its own output against the
 * SCHEDULE_REFERENCE_STRING regex before returning RESOLVED (fail-closed:
 * canonicalValueAllowed must never be the first to catch a drift).
 */

'use strict';

const {
  normaliseForMatching,
} = require('../zero-width-normalise');
const {
  DISCLOSURE_CARVEOUT_CLAUSE_PATTERN,
} = require('./qualifier-kind-lexicon');
const {
  parseCitationComponents,
  citationFromComponents,
} = require('./citation-constructibility');

const SCHEDULE_REFERENCE_PARSE_VERSION = 1;

// P2 section 3: pinned, identical at all three lockstep sites.
const SCHEDULE_REFERENCE_STRING_PATTERN = /^\d+\.\d+(\([0-9A-Za-z]+\))*@DISCLOSURE_LETTER$/;
const DISCLOSURE_LETTER_SUFFIX = '@DISCLOSURE_LETTER';

// A quote that fails the pure-clause grammar but is recognisably a
// MULTIPLE-citation carve-out ("Sections 3.2(a) and 3.2(b) of the Company
// Disclosure Letter") gets the more specific abstain reason rather than the
// generic NOT_A_PURE_CARVEOUT_CLAUSE.
const MULTIPLE_CITATIONS_PATTERN =
  /^(?:except|except as|except for|other than|excluding)\s+(?:as\s+)?(?:set\s+forth|provided|disclosed|described|listed)\s+(?:in|on)\s+Sections\s+\d+\.\d+(?:\([^()\s]+\))*(?:\s*(?:,|and)\s*\d+\.\d+(?:\([^()\s]+\))*)+\s+of\s+the\s+(?:\w+\s+){0,2}Disclosure\s+(?:Letter|Schedule)s?[\s,;.]*$/i;

/**
 * @param {object} args
 * @param {string} args.quote  the qualifier's verbatim text.
 * @returns {
 *   {outcome: 'RESOLVED', canonical_value: string, citation: string, matched_text: string} |
 *   {outcome: 'ABSTAIN', reason: 'NOT_A_PURE_CARVEOUT_CLAUSE'|'MULTIPLE_SCHEDULE_CITATIONS'|'CITATION_UNNORMALIZABLE', matched_text?: string}
 * }
 */
function parseScheduleReference({ quote } = {}) {
  if (typeof quote !== 'string') {
    throw new TypeError('parseScheduleReference requires { quote: string }');
  }
  const normalised = normaliseForMatching(quote).trim();

  const match = DISCLOSURE_CARVEOUT_CLAUSE_PATTERN.exec(normalised);
  if (!match) {
    if (MULTIPLE_CITATIONS_PATTERN.test(normalised)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_SCHEDULE_CITATIONS', matched_text: null });
    }
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NOT_A_PURE_CARVEOUT_CLAUSE', matched_text: null });
  }

  const rawCitation = match[1];
  const components = parseCitationComponents(rawCitation);
  const citation = citationFromComponents(components);

  if (!citation) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'CITATION_UNNORMALIZABLE', matched_text: rawCitation });
  }

  const canonicalValue = `${citation}${DISCLOSURE_LETTER_SUFFIX}`;

  // Fail-closed re-validation: this module never lets a drift out.
  if (!SCHEDULE_REFERENCE_STRING_PATTERN.test(canonicalValue)) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'CITATION_UNNORMALIZABLE', matched_text: rawCitation });
  }

  // matched_text is sliced from the ORIGINAL quote via a normalised-index
  // search on the trimmed, normalised match -- the lexicon's own
  // normalise-then-map-back convention. Since parseScheduleReference is
  // only ever called on a whole quote (or byte-verified part) that already
  // full-matched the CLASSIFY grammar, the original quote itself IS the
  // matched text (modulo leading/trailing whitespace already trimmed by
  // the caller's own byte-verified slice).
  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: canonicalValue,
    citation,
    matched_text: quote,
  });
}

module.exports = {
  SCHEDULE_REFERENCE_PARSE_VERSION,
  SCHEDULE_REFERENCE_STRING_PATTERN,
  parseScheduleReference,
};
