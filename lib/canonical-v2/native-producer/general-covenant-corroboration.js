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
 * matches nothing, a second chance CONSULTS lib/vocab/
 * general-covenant-rubric-presentation.js but does NOT resolve
 * (DECISIONS.md §15 HOLD — report-only until a corpus-pass quote report is
 * reviewed). Hits are tagged `second_chance_would_resolve: true`. Primary
 * hits stay byte-identical -- no provenance enrichment on that path.
 * Step 2X-C: `generalCovenantPrimaryMatchingCodes` runs the full primary
 * table at runtime; enforcement follows the widened collision report.
 */

const { rubricPresentationCodeMatches } = require('../../vocab/general-covenant-rubric-presentation');

const GENERAL_COVENANT_CODE_PATTERNS = Object.freeze({
  'COV-16B': [
    /\bSection\s+16\b/i,
    /\bRule\s+16b-3\b/i,
    /\bshort-?swing\s+profit\b/i,
  ],
  // Modiv 5.9-family confidentiality/access covenant, confirmed against the
  // real quote ("give Parent and its authorized Representatives reasonable
  // access ... to all properties, facilities, personnel and books and
  // records") and its confidentiality sibling ("will hold ... in confidence
  // all documents and information ... pursuant to ... Mutual Non-Disclosure
  // Agreement").
  'COV-ACCESS': [
    /\breasonable\s+access\b/i,
    /\b(?:give|grant|provide|afford)\b[^.]{0,80}\baccess\b[^.]{0,80}\b(?:properties|personnel|books\s+and\s+records|records|information|facilities)\b/i,
    /\bhold\b[^.]{0,30}\bin\s+confidence\b/i,
    /\b(?:confidentiality|non-?disclosure)\s+agreement\b/i,
  ],
  'COV-CONSENT': [
    /\bthird[- ]party\s+consents?\b/i,
    /\b(?:deliver|obtain|use\s+(?:its|their)\s+(?:reasonable\s+)?(?:best\s+)?efforts\s+to\s+obtain)\b[^.]{0,80}\b(?:consents?|approvals?)\b[^.]{0,80}\b(?:required|necessary)\b/i,
    /\brequired\s+consents?\b/i,
  ],
  'COV-CVR': [
    /\bcontingent\s+value\s+rights?\b/i,
    /\bCVR\b/,
    /\bCVR\s+Agreement\b/i,
  ],
  'COV-DEBT': [
    /\bexisting\s+indebtedness\b/i,
    /\b(?:repay|redeem|discharge|satisfy)\b[^.]{0,60}\b(?:indebtedness|notes|credit\s+facility|credit\s+agreement)\b/i,
    /\bcredit\s+agreement\b/i,
  ],
  // COV-DELIST and COV-LIST share an owner_id (LISTING_DELISTING_COVENANTS)
  // but are opposite directions of the same transaction and must not share
  // a pattern: DELIST is the TARGET's shares coming OFF an exchange, LIST is
  // new (typically acquirer) shares going ON one.
  'COV-DELIST': [
    /\bdelist(?:ing)?\b/i,
    /\bderegist(?:er|ration)\b/i,
    /\bSection\s+12\(b\)\b/i,
  ],
  'COV-LIST': [
    /\b(?:approv(?:e|al)\s+for\s+listing|listed?)\b[^.]{0,60}\b(?:NYSE|Nasdaq|national\s+securities\s+exchange)\b/i,
    /\blisting\s+of\s+(?:the\s+)?(?:shares|stock)\b/i,
  ],
  'COV-FDACOMMS': [
    /\bFDA\b/,
    /\bFood\s+and\s+Drug\s+Administration\b/i,
  ],
  'COV-FURTHER': [
    /\bfurther\s+assurances?\b/i,
    /\bexecute(?:\s+and\s+deliver)?\b[^.]{0,40}\b(?:such\s+)?(?:other|further)\s+(?:documents|instruments|actions)\b/i,
  ],
  'COV-INDEMN': [
    /\bindemnif(?:y|ication)\b/i,
    /\bhold\s+harmless\b/i,
    /\bD\s*&\s*O\b/i,
    /\btail\s+(?:insurance|policy)\b/i,
  ],
  'COV-LITNOTIFY': [
    /\b(?:stockholder|transaction|securityholder)\s+litigation\b/i,
    /\b(?:Action|Proceeding|Legal\s+Proceeding)\b[^.]{0,60}\brelating\s+to\b[^.]{0,40}\b(?:this\s+Agreement|the\s+Mergers?|the\s+Transactions?)\b/i,
  ],
  'COV-MERGESUB': [
    /\bMerger\s+Sub\b[^.]{0,80}\bshall\b/i,
    /\bcause\s+Merger\s+Sub\s+to\b/i,
  ],
  // Confirmed against all 7 modiv-general-covenants-20260807-replay
  // COV-NOTIFY candidates, every one of which opens "The Company shall give
  // prompt notice to Parent...".
  'COV-NOTIFY': [
    /\b(?:give|deliver)\s+(?:prompt|written)\s+notice\b/i,
    /\bpromptly\s+notify\b/i,
    /\bpromptly\s+(?:give|provide|deliver)\s+notice\b/i,
  ],
  'COV-PAYAGENT': [
    /\bPaying\s+Agent\b/,
    /\bExchange\s+Agent\b/,
    /\bDisbursing\s+Agent\b/,
  ],
  // Confirmed against both modiv-general-covenants-20260807-replay
  // COV-PUBLICITY candidates ("issuing any press release", "public
  // statement").
  'COV-PUBLICITY': [
    /\bpress\s+releases?\b/i,
    /\bpublic\s+(?:statements?|announcements?)\b/i,
    /\bpublicity\b/i,
  ],
  'COV-RESIGN': [
    /\bresign(?:ation)?\b[^.]{0,60}\b(?:director|officer)\b/i,
    /\b(?:director|officer)\b[^.]{0,60}\bresign(?:ation)?\b/i,
    /\bcause\b[^.]{0,60}\bto\s+resign\b/i,
  ],
  'COV-SECREPORT': [
    /\bExchange\s+Act\s+reports?\b/i,
    /\bSEC\s+filings?\b/i,
    /\bperiodic\s+reports?\b[^.]{0,60}\bSEC\b/i,
  ],
  'COV-TAKEOVER': [
    /\btakeover\s+statutes?\b/i,
    /\bbusiness\s+combination\s+statutes?\b/i,
    /\bcontrol\s+share\s+acquisition\b/i,
    /\banti-?takeover\b/i,
    /\bSection\s+203\b/i,
  ],
});

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
 * Corroborate a GENERAL_COVENANT code against its own operative text.
 * Primary-test resolution stays byte-identical to pre-2X-B (no provenance).
 * A V1 rubric-presentation hit is tagged
 * `corroboration_provenance: 'V1_GENERAL_COVENANT_RUBRIC_PRESENTATION'`.
 */
function corroborateGeneralCovenantCode({ quote, code } = {}) {
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
  const v1Matches = rubricPresentationCodeMatches(quote);
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
  primaryGeneralCovenantCodeMatches,
  generalCovenantPrimaryMatchingCodes,
  corroborateGeneralCovenantCode,
  generalCovenantCodeCorroborated,
});
