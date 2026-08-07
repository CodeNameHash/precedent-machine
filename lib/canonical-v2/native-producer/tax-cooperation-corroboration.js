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
 */

const TAX_OPINION_VOCABULARY_PATTERNS = Object.freeze([
  /\btax\s+representation\s+letter\b/i,
  /\brender(?:ing)?\s+(?:the\s+)?(?:tax\s+)?opinion\b/i,
  /\b(?:REIT|tax)\s+Counsel\b/i,
  /\btax\s+opinion\b/i,
]);

const COOPERATIVE_ACTION_PATTERN = /\b(?:deliver|furnish|provide|execute|enable|cooperat\w*)\b/i;

function taxOpinionCooperationCorroborated(quote) {
  if (typeof quote !== 'string' || quote.length === 0) throw new TypeError('quote must be a non-empty string');
  return TAX_OPINION_VOCABULARY_PATTERNS.some((pattern) => pattern.test(quote))
    && COOPERATIVE_ACTION_PATTERN.test(quote);
}

const TRANSFER_TAX_VOCABULARY_PATTERN = /\btransfer\s+taxe?s?\b|\bsales,\s*transfer,\s*stamp\b/i;

// Word-form tolerant on purpose -- prepar\w*/fil\w* covers "prepare",
// "preparation", "prepared", "file", "filed", "filing" alike, which is the
// exact gap the literal "preparation"/"filing" strings left open.
const TRANSFER_PREPARATION_ACTION_PATTERN = /\b(?:cooperat\w*|prepar\w*|fil(?:e[ds]?|ing))\b/i;

function transferCooperationCorroborated(quote) {
  if (typeof quote !== 'string' || quote.length === 0) throw new TypeError('quote must be a non-empty string');
  return TRANSFER_TAX_VOCABULARY_PATTERN.test(quote)
    && TRANSFER_PREPARATION_ACTION_PATTERN.test(quote);
}

module.exports = Object.freeze({
  TAX_OPINION_VOCABULARY_PATTERNS,
  COOPERATIVE_ACTION_PATTERN,
  TRANSFER_TAX_VOCABULARY_PATTERN,
  TRANSFER_PREPARATION_ACTION_PATTERN,
  taxOpinionCooperationCorroborated,
  transferCooperationCorroborated,
});
