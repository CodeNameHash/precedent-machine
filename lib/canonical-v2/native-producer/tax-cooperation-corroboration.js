'use strict';

/**
 * lib/canonical-v2/native-producer/tax-cooperation-corroboration.js
 *
 * Corroboration vocabulary for the two TAX_MATTERS cooperation covenants --
 * TAX_OPINION_COOPERATION and TRANSFER_COOPERATION -- in the shape of
 * ioc-corroboration.js: named pattern lists anyone can widen, tested against
 * the candidate's own quote, never a regex buried inline in the resolver.
 *
 * WHY THIS FILE EXISTS (PLAN.md Step 3G, defect 4). Before this file,
 * `handleTaxMattersCandidate` in candidate-resolution.js corroborated both
 * covenants with regexes hardcoded in the resolver itself, including a
 * literal `/tax opinion/i` bigram for TAX_OPINION_COOPERATION. Real drafting
 * does not write that bigram: Modiv's own tax-opinion-cooperation covenants
 * (3.13/4.15/5.12, modiv-tax-matters-20260807-replay) read "deliver ... a
 * ('Company Tax Representation Letter') ... to enable [counsel] to render
 * the opinion described in Section 6.3(d)" -- "Tax Representation Letter"
 * and "render the opinion", never the words "tax" and "opinion" adjacent.
 * All 4 of that run's TAX_OPINION_COOPERATION candidates failed the old
 * check and fell to TAX_ASSERTION_OPEN_WORLD. TRANSFER_COOPERATION had the
 * same problem one level down: its old check required the literal word
 * forms "preparation" or "filing", but Modiv's own clause uses "prepare",
 * "file" and "filed" -- none of which contain "preparation" or "filing" as
 * a substring -- so it failed too even though the clause is a textbook
 * Transfer Tax cooperation covenant ("Parent shall, with the Company's good
 * faith cooperation and assistance, prepare, execute and file ... all
 * returns ... regarding Transfer Taxes, and Parent and the Company shall
 * reasonably cooperate to minimize the amount of such Transfer Taxes").
 *
 * EACH TABLE IS TWO INDEPENDENT GATES, BOTH REQUIRED: the covenant's own
 * SUBJECT-MATTER vocabulary (tax-opinion delivery / Transfer Taxes) AND a
 * COOPERATIVE-ACTION verb (deliver/furnish/enable/cooperate/prepare/file).
 * Subject matter alone is not enough -- a representation that merely
 * DESCRIBES a tax opinion or Transfer Taxes with no cooperative obligation
 * is a different claim entirely (see the hostile tests in
 * tests/canonical-v2-tax-cooperation-corroboration.test.js, which prove a
 * bare "the Company has received a customary REIT opinion" sentence and a
 * bare "Parent shall pay all Transfer Taxes" allocation sentence -- real
 * TAX_MATTERS drafting shapes, neither of them a cooperation covenant --
 * both still refuse).
 *
 * Step 2X-B: when the primary tables miss, a second chance CONSULTS
 * lib/vocab/tax-cooperation-legacy.js but does NOT resolve (DECISIONS.md
 * §15 HOLD — report-only until a corpus-pass quote report is reviewed).
 * Hits are tagged `second_chance_would_resolve: true`. Primary hits stay
 * byte-identical. Step 2X-C: `taxCooperationPrimaryMatchingKinds` runs both
 * primary tables; enforcement waits on the widened held-quote collision
 * report (non-zero held collisions → do not enforce yet).
 */

const {
  taxOpinionCooperationLegacyCorroborated,
  transferCooperationLegacyCorroborated,
  taxCooperationLegacyKindMatches,
} = require('../../vocab/tax-cooperation-legacy');

const TAX_OPINION_VOCABULARY_PATTERNS = Object.freeze([
  /\btax\s+representation\s+letter\b/i,
  /\brender(?:ing)?\s+(?:the\s+)?(?:tax\s+)?opinion\b/i,
  /\b(?:REIT|tax)\s+Counsel\b/i,
  /\btax\s+opinion\b/i,
]);

const COOPERATIVE_ACTION_PATTERN = /\b(?:deliver|furnish|provide|execute|enable|cooperat\w*)\b/i;

function primaryTaxOpinionCooperationMatches(quote) {
  return TAX_OPINION_VOCABULARY_PATTERNS.some((pattern) => pattern.test(quote))
    && COOPERATIVE_ACTION_PATTERN.test(quote);
}

const TRANSFER_TAX_VOCABULARY_PATTERN = /\btransfer\s+taxe?s?\b|\bsales,\s*transfer,\s*stamp\b/i;

// PLAN.md Step 3G review, condition 4. The old gate (pre-Step-3G) required
// TWO things co-present: a cooperative-action verb AND a preparation/filing
// verb. The defect this Step actually targeted was a WORD-FORM gap --
// "preparation"/"filing" as literal strings do not match Modiv's own
// "prepare"/"file"/"filed" -- never the conjunction itself. The shipped fix
// folded `cooperat\w*` into the SAME alternation as `prepar\w*`/`fil\w*`,
// which turned the gate into a disjunction: ANY of the three words alone now
// corroborated, silently dropping the cooperation requirement. That is
// scope-widening beyond the stated defect, not a word-form fix, and it lets
// a unilateral allocation-and-filing clause -- "All Transfer Taxes shall be
// borne by Parent when due, and Parent shall file all necessary Tax Returns
// with respect to all such Transfer Taxes" -- corroborate as
// TRANSFER_COOPERATION even though nothing in it is a cooperation covenant
// (see the hostile test in tests/canonical-v2-tax-cooperation-
// corroboration.test.js). Restored: cooperation is mandatory, word-form
// tolerant on the preparation/filing side only (prepar\w*/fil\w* still
// covers "prepare", "preparation", "prepared", "file", "filed", "filing").
const TRANSFER_COOPERATION_VERB_PATTERN = /\bcooperat\w*\b/i;
const TRANSFER_PREPARATION_ACTION_PATTERN = /\b(?:prepar\w*|fil(?:e[ds]?|ing))\b/i;

function primaryTransferCooperationMatches(quote) {
  return TRANSFER_TAX_VOCABULARY_PATTERN.test(quote)
    && TRANSFER_COOPERATION_VERB_PATTERN.test(quote)
    && TRANSFER_PREPARATION_ACTION_PATTERN.test(quote);
}

function taxCooperationPrimaryMatchingKinds(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  const hits = [];
  if (primaryTaxOpinionCooperationMatches(quote)) hits.push('TAX_OPINION_COOPERATION');
  if (primaryTransferCooperationMatches(quote)) hits.push('TRANSFER_COOPERATION');
  return hits.sort();
}

function corroborateTaxOpinionCooperation(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  // Step 2X-C enforce (DECISIONS.md §15): multi-kind primary match refuses
  // even when the asserted kind's own pattern hits — same shape as IOC/
  // guaranty. Zero collisions on the widened held-quote report.
  const primaryKinds = taxCooperationPrimaryMatchingKinds(quote);
  if (primaryKinds.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_TAX_COOPERATION_KIND',
      matches: primaryKinds,
    });
  }
  if (primaryTaxOpinionCooperationMatches(quote)) {
    return Object.freeze({ outcome: 'RESOLVED', assertion_kind: 'TAX_OPINION_COOPERATION' });
  }
  const v1Kinds = taxCooperationLegacyKindMatches(quote);
  if (v1Kinds.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_TAX_COOPERATION_KIND',
      matches: v1Kinds,
      corroboration_scope: 'V1_TAX_COOPERATION_LEGACY',
    });
  }
  // Step 2X-B HOLD (DECISIONS.md §15): report-only until corpus-pass review.
  if (v1Kinds.length === 1 && v1Kinds[0] === 'TAX_OPINION_COOPERATION') {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'TAX_OPINION_COOPERATION_UNCORROBORATED',
      second_chance_would_resolve: true,
      assertion_kind: 'TAX_OPINION_COOPERATION',
      corroboration_provenance: 'V1_TAX_COOPERATION_LEGACY',
    });
  }
  return Object.freeze({ outcome: 'REVIEW', reason: 'TAX_OPINION_COOPERATION_UNCORROBORATED' });
}

function corroborateTransferCooperation(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('quote must be a non-empty string');
  }
  // Step 2X-C enforce (DECISIONS.md §15): see corroborateTaxOpinionCooperation.
  const primaryKinds = taxCooperationPrimaryMatchingKinds(quote);
  if (primaryKinds.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_TAX_COOPERATION_KIND',
      matches: primaryKinds,
    });
  }
  if (primaryTransferCooperationMatches(quote)) {
    return Object.freeze({ outcome: 'RESOLVED', assertion_kind: 'TRANSFER_COOPERATION' });
  }
  const v1Kinds = taxCooperationLegacyKindMatches(quote);
  if (v1Kinds.length > 1) {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'AMBIGUOUS_TAX_COOPERATION_KIND',
      matches: v1Kinds,
      corroboration_scope: 'V1_TAX_COOPERATION_LEGACY',
    });
  }
  // Step 2X-B HOLD (DECISIONS.md §15): report-only until corpus-pass review.
  if (v1Kinds.length === 1 && v1Kinds[0] === 'TRANSFER_COOPERATION') {
    return Object.freeze({
      outcome: 'REVIEW',
      reason: 'TRANSFER_COOPERATION_UNCORROBORATED',
      second_chance_would_resolve: true,
      assertion_kind: 'TRANSFER_COOPERATION',
      corroboration_provenance: 'V1_TAX_COOPERATION_LEGACY',
    });
  }
  return Object.freeze({ outcome: 'REVIEW', reason: 'TRANSFER_COOPERATION_UNCORROBORATED' });
}

function taxOpinionCooperationCorroborated(quote) {
  return corroborateTaxOpinionCooperation(quote).outcome === 'RESOLVED';
}

function transferCooperationCorroborated(quote) {
  return corroborateTransferCooperation(quote).outcome === 'RESOLVED';
}

module.exports = Object.freeze({
  TAX_OPINION_VOCABULARY_PATTERNS,
  COOPERATIVE_ACTION_PATTERN,
  TRANSFER_TAX_VOCABULARY_PATTERN,
  TRANSFER_COOPERATION_VERB_PATTERN,
  TRANSFER_PREPARATION_ACTION_PATTERN,
  primaryTaxOpinionCooperationMatches,
  primaryTransferCooperationMatches,
  taxCooperationPrimaryMatchingKinds,
  corroborateTaxOpinionCooperation,
  corroborateTransferCooperation,
  taxOpinionCooperationCorroborated,
  transferCooperationCorroborated,
});
