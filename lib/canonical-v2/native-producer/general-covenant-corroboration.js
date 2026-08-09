'use strict';

/**
 * lib/canonical-v2/native-producer/general-covenant-corroboration.js
 *
 * Corroboration vocabulary for the 18 GENERAL_COVENANT_FOLLOW_ON_OWNERS
 * codes (p0-product-surface-routing.js), in the shape of ioc-corroboration.js:
 * a fixed table from code to a small set of operative-TEXT patterns, tested
 * against the candidate's own quote -- never against a display string meant
 * for a human reading a rubric.
 *
 * WHY THIS FILE EXISTS (PLAN.md Step 3G, defect 2). Before this file,
 * candidate-resolution.js's `generalCovenantGroundingFailure` corroborated a
 * covenant code by normalising `lib/rubric.js`'s CODES[code].label and
 * .aliases and checking whether the normalised QUOTE contained one of those
 * PRESENTATION strings verbatim (e.g. "access to information", "public
 * announcements", "notification of certain matters"). Those strings are
 * written for a person browsing a rubric of covenant TYPES, not for
 * corroborating a specific clause's own text, and real drafting essentially
 * never restates them: Modiv's actual General Covenants operative text reads
 * "give Parent and its authorized Representatives reasonable access", "shall
 * consult with each other before issuing any press release", "shall give
 * prompt notice to Parent" -- none of which contain the rubric phrases "access
 * to information", "public announcements", or "notification of certain
 * matters". Every one of the 11 GENERAL_COVENANT candidates in
 * modiv-general-covenants-20260807-replay failed this check and the family
 * resolved zero (docs/core/PLAN.md Step 3G).
 *
 * PATTERNS BELOW ARE GROUNDED IN REAL OPERATIVE TEXT, NOT INVENTED. The
 * COV-ACCESS, COV-PUBLICITY and COV-NOTIFY patterns are checked directly
 * against modiv-general-covenants-20260807-replay's own candidates (see
 * tests/canonical-v2-general-covenant-corroboration.test.js). The other 14
 * codes have no committed candidate to ground against yet -- their patterns
 * follow the same "what would the operative clause itself actually say"
 * discipline, drawn from the code's own rubric.js `description` (never its
 * `label`/`aliases`, which is exactly the mistake this file replaces), and
 * are narrow on purpose: a code with no real candidate yet should stay
 * narrow until one is found, not be guessed wide.
 *
 * EACH CODE IS A SEPARATE LEGAL FAMILY (general-covenants-producer-prompt.js's
 * own instruction to the model). Patterns are written to avoid cross-code
 * collision on ordinary contract language ("shall", "will", "agrees") --
 * every pattern below anchors on a term specific to its own covenant, never
 * on the auxiliary verb alone (that gate already runs separately, before
 * this one, in `generalCovenantGroundingFailure`).
 *
 * Step 2X-B (Stage 4 discipline): when the primary operative-text table
 * matches nothing, a second chance may CONSULT a caller-injected V1 rubric-
 * presentation matcher (lib/vocab/general-covenant-rubric-presentation.js)
 * but does NOT resolve (DECISIONS.md §15 HOLD — report-only until a
 * corpus-pass quote report is reviewed). Hits are tagged
 * `second_chance_would_resolve: true`. Primary hits stay byte-identical --
 * no provenance enrichment on that path. The matcher is injected so this
 * file stays a PRODUCTION_PATH_PURE_ANALYSIS leaf (zero module deps).
 * Step 2X-C: `generalCovenantPrimaryMatchingCodes` runs the full primary
 * table at runtime; enforcement follows the widened collision report.
 */

const {
  GENERAL_COVENANT_CODE_PATTERNS,
  GENERAL_COVENANT_SPECIFICITY_PRECEDENCE,
} = require('../../vocab/resolution/general-covenant-registry');

function primaryGeneralCovenantCodeMatches(quote, code) {
  const patterns = GENERAL_COVENANT_CODE_PATTERNS[code];
  if (!patterns) return false;
  return patterns.some((pattern) => pattern.test(quote));
}

function generalCovenantPrimaryMatchingCodes(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  return Object.keys(GENERAL_COVENANT_CODE_PATTERNS)
    .filter((code) => primaryGeneralCovenantCodeMatches(quote, code))
    .sort();
}

/**
 * After primary matches, apply specificity: suppress losers when their
 * winner also matched. Returns the surviving codes (sorted).
 */
function applyGeneralCovenantSpecificity(matchingCodes) {
  const codes = Array.isArray(matchingCodes) ? [...matchingCodes] : [];
  const suppressed = new Set();
  for (const { winner, loser } of GENERAL_COVENANT_SPECIFICITY_PRECEDENCE) {
    if (codes.includes(winner) && codes.includes(loser)) suppressed.add(loser);
  }
  return codes.filter((code) => !suppressed.has(code)).sort();
}

/**
 * Decide how to treat an asserted code given the quote's primary matches.
 * @returns {{ action: 'PASS' }
 *   | { action: 'REMAP', code: string, from: string }
 *   | { action: 'HOLD', otherCode: string }}
 */
function resolveGeneralCovenantSpecificity({ quote, assertedCode, owners } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  if (typeof assertedCode !== 'string' || !assertedCode) {
    throw new TypeError('assertedCode must be a non-empty string');
  }
  if (!owners || typeof owners !== 'object') {
    throw new TypeError('owners map is required');
  }
  const matches = generalCovenantPrimaryMatchingCodes(quote);
  const effective = applyGeneralCovenantSpecificity(matches);

  let preferred = assertedCode;
  for (const { winner, loser } of GENERAL_COVENANT_SPECIFICITY_PRECEDENCE) {
    if (matches.includes(winner) && matches.includes(loser)) preferred = winner;
  }

  // Step 2X-C enforce (DECISIONS.md §15): after §16 specificity, more than
  // one surviving code is a primary multi-match refusal — review_queue, not
  // silent resolve. Zero on the current corpus (authorises a no-op land).
  if (effective.length > 1) {
    const other = effective.find((code) => code !== preferred) || effective[0];
    return Object.freeze({ action: 'HOLD', otherCode: other, matches: effective });
  }
  if (preferred !== assertedCode) {
    if (!owners[preferred]) {
      return Object.freeze({ action: 'HOLD', otherCode: preferred, matches: effective });
    }
    return Object.freeze({ action: 'REMAP', code: preferred, from: assertedCode });
  }
  return Object.freeze({ action: 'PASS' });
}

/**
 * Corroborate a GENERAL_COVENANT code against its own operative text.
 * Primary-test resolution stays byte-identical to pre-2X-B (no provenance).
 * A V1 rubric-presentation hit is tagged
 * `corroboration_provenance: 'V1_GENERAL_COVENANT_RUBRIC_PRESENTATION'`.
 *
 * @param {object} args
 * @param {string} args.quote
 * @param {string} args.code
 * @param {(quote: string) => string[]|null|undefined} [args.rubricPresentationCodeMatches]
 *   Optional injected second-chance matcher. When omitted, second-chance is
 *   skipped (primary-only). Callers that own the Stage-4 HOLD scaffold
 *   (candidate-resolution, corpus-pass report) pass the vocab function in.
 */
function corroborateGeneralCovenantCode({
  quote,
  code,
  rubricPresentationCodeMatches = null,
} = {}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  if (!Object.hasOwn(GENERAL_COVENANT_CODE_PATTERNS, code)) {
    return Object.freeze({ outcome: 'REVIEW', reason: 'GENERAL_COVENANT_CODE_UNKNOWN' });
  }
  if (primaryGeneralCovenantCodeMatches(quote, code)) {
    return Object.freeze({ outcome: 'RESOLVED', covenant_code: code });
  }
  const primaryMatches = generalCovenantPrimaryMatchingCodes(quote);
  if (primaryMatches.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_GENERAL_COVENANT_CODE',
      matches: primaryMatches,
    });
  }
  const v1Matches = typeof rubricPresentationCodeMatches === 'function'
    ? (rubricPresentationCodeMatches(quote) || [])
    : [];
  if (v1Matches.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_GENERAL_COVENANT_CODE',
      matches: v1Matches,
      corroboration_scope: 'V1_GENERAL_COVENANT_RUBRIC_PRESENTATION',
    });
  }
  // Step 2X-B HOLD (DECISIONS.md §15): second-chance must not manufacture
  // resolves until the corpus-pass quote report is reviewed. Report-only.
  if (v1Matches.length === 1 && v1Matches[0] === code) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'GENERAL_COVENANT_CODE_UNCORROBORATED',
      second_chance_would_resolve: true,
      covenant_code: code,
      corroboration_provenance: 'V1_GENERAL_COVENANT_RUBRIC_PRESENTATION',
      matches: v1Matches,
    });
  }
  return Object.freeze({
    outcome: 'REVIEW',
    reason: 'GENERAL_COVENANT_CODE_UNCORROBORATED',
    matches: primaryMatches.length ? primaryMatches : v1Matches,
  });
}

/**
 * Returns true iff `code` is a known code AND corroboration resolves.
 * Unknown codes never corroborate (the caller already gates on
 * GENERAL_COVENANT_CODES membership before reaching this, but this function
 * stays safe standalone too).
 */
function generalCovenantCodeCorroborated({ quote, code } = {}) {
  return corroborateGeneralCovenantCode({ quote, code }).outcome === 'RESOLVED';
}

module.exports = Object.freeze({
  GENERAL_COVENANT_CODE_PATTERNS,
  GENERAL_COVENANT_SPECIFICITY_PRECEDENCE,
  primaryGeneralCovenantCodeMatches,
  generalCovenantPrimaryMatchingCodes,
  applyGeneralCovenantSpecificity,
  resolveGeneralCovenantSpecificity,
  corroborateGeneralCovenantCode,
  generalCovenantCodeCorroborated,
});
