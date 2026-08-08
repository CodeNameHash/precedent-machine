'use strict';
/**
 * lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-parser.js
 *
 * PLAN.md Step 3I ("payment timing"; DECISIONS.md item 5, "one claim per
 * limb"). A pilot-only sidecar, deliberately mirroring the SHAPE and the
 * SAFETY DISCIPLINE of the pre-existing
 * `modiv-termination-fee-source-parser.js` (`resolveModivConditionalFees`)
 * exactly: regex the ADMITTED SOURCE TEXT directly against Modiv's own
 * exact, hardcoded payment-timing sentences, gated on every one of the six
 * expected fee-trigger branches being independently retained with a valid
 * citation first. It does not, and cannot, generalise to a different
 * agreement's wording -- a partial match throws, and the caller (candidate-
 * resolution.js) turns that into an empty result, exactly like the
 * conditional-fee-value sidecar it mirrors.
 *
 * WHY A SIDECAR, NOT A NEW PRODUCER FIELD. DECISIONS.md item 5's own "Code"
 * section says the extraction that would populate a per-limb payment-timing
 * fact "from a live model call" was not yet built. Checked directly before
 * writing this file: no recorded native-producer response, for Modiv or any
 * other deal committed in this repository, carries payment-timing text in
 * any field (`grep`'d every `evidence/canonical-v2/**` termination-fee
 * recorded response for "Business Day"/"simultaneously with"/"substantially
 * concurrently with" -- zero hits). Unlike the grounds-to-amount mapping
 * (`grounds-to-amount-mapping.md`), where the model ALREADY emitted the
 * needed condition text unprompted and the only new work was a join, here
 * there is nothing already flowing to join against: the model's own
 * Section 7.3 response (`evidence/canonical-v2/modiv-termination-fee-
 * citation-following-20260806/native-producer-recorded-response-7.3.json`)
 * does not mention the payment-timing sentence at all, not even as an
 * open-world candidate. Populating a NEW producer field with a live model
 * call is exactly the option `grounds-to-amount-mapping.md` section 4
 * rejected for the identical reason ("would not exercise on a replay of the
 * already-committed run"), and this task has no live model access either
 * (no `ANTHROPIC_API_KEY` is set in this environment, checked directly).
 *
 * WHY NOT THE EXISTING TWO-VALUE `allowed_payment_timings` ENUM
 * (`contract-bundle.js`'s `TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2`).
 * Checked before reusing it: that enum was hand-curated for QXO's own two
 * payment-timing patterns and neither of its two values
 * (`TWO_BUSINESS_DAYS_AFTER_TERMINATION`, `UPON_EARLIER_OF_SIGNING_OR_
 * CONSUMMATION`) is an exact reading of Modiv's own three distinct real
 * patterns below -- branch (ii)'s "prior to or substantially concurrently
 * with such termination" matches neither. Coining new codes for a
 * three-value split is a codebook/taxonomy decision
 * (`docs/core/OPERATING-RULES.md` reserves taxonomy values and codebook
 * vocabularies to Ben), not something this file invents. So this sidecar
 * emits the payment-timing text VERBATIM (`payment_timing_quote`), the same
 * "quotable verbatim from the same sentence" shape ROADMAP.md's own P2
 * text asked for the grounds field, never a coded value -- narrower than
 * DECISIONS.md item 5's eventual, fully-coded target, but a real, per-limb,
 * cited fact today rather than nothing, and it invents no vocabulary.
 *
 * Modiv's real sentence (Section 7.3(b), converted through this repo's own
 * `convertSecHtmlToCanonicalText`, not hand-typed against the raw filing):
 *
 *   "The payment of the Company Termination Fee shall be made (1) in the
 *   case of a payment pursuant to Section 7.3(b)(i), Section 7.3(b)(iv) or
 *   Section 7.3(b)(v), within two (2) Business Days after the date of such
 *   termination by Parent, (2) in the case of a payment pursuant to Section
 *   7.3(b)(ii), prior to or substantially concurrently with such
 *   termination by the Company and (3) in the case of a payment pursuant to
 *   Section 7.3(b)(iii), within two (2) Business Days after the earlier of
 *   entry into a definitive agreement relating to the Company Acquisition
 *   Proposal referred to in clause (B) of Section 7.3(b)(iii) and
 *   consummation of such Company Acquisition Proposal."
 *
 *   "The payment of the Parent Termination Fee shall be made within two (2)
 *   Business Days after the date of such termination by the Company."
 */

const { contentId } = require('../canonical-bytes');

const SCHEMA = 'TERMINATION_FEE_PAYMENT_TIMING/V1';
const SIDES = new Set(['SELLER', 'BUYER']);
const BRANCHES = new Set(['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)', '7.3(c)']);

// Same six-branch gate as resolveModivConditionalFees's own
// EXPECTED_BRANCH_SIDES -- duplicated rather than imported, per this task's
// own "no change to the Modiv sidecar files" discipline
// (grounds-to-amount-mapping.md section 8's own convention, followed here
// for the identical reason: this file must never become a second place
// that can silently drift the first one's gate out of sync by editing it).
const EXPECTED_BRANCH_SIDES = new Map([
  ['7.3(b)(i)', 'SELLER'],
  ['7.3(b)(ii)', 'SELLER'],
  ['7.3(b)(iii)', 'SELLER'],
  ['7.3(b)(iv)', 'SELLER'],
  ['7.3(b)(v)', 'SELLER'],
  ['7.3(c)', 'BUYER'],
]);

/**
 * @param {object} value
 * @param {'SELLER'|'BUYER'} value.fee_side
 * @param {string} value.triggering_branch one of BRANCHES
 * @param {string} value.payment_timing_quote verbatim, non-empty
 * @param {string[]} value.source_citations at least one section reference
 * @returns {object} frozen, content-addressed
 */
function buildTerminationFeePaymentTiming(value) {
  const required = ['fee_side', 'triggering_branch', 'payment_timing_quote', 'source_citations'];
  if (!value || required.some((key) => !(key in value))
    || !SIDES.has(value.fee_side)
    || !BRANCHES.has(value.triggering_branch)
    || typeof value.payment_timing_quote !== 'string' || value.payment_timing_quote.length === 0
    || !Array.isArray(value.source_citations) || value.source_citations.length === 0
    || value.source_citations.some((ref) => typeof ref !== 'string' || ref.length === 0)) {
    throw new TypeError('invalid termination-fee payment-timing value');
  }
  const body = Object.freeze({ schema_version: SCHEMA, ...value });
  return Object.freeze({ ...body, termination_fee_payment_timing_id: contentId(SCHEMA, body) });
}

function exactlyOne(sourceText, pattern) {
  const matches = [...sourceText.matchAll(pattern)];
  return matches.length === 1 ? matches[0] : null;
}

// Real, byte-verifiable substrings of Modiv's converted canonical text (see
// this file's own header for the full sentences these regexes anchor
// against). Three capture groups on the Company sentence, one per limb
// group the sentence itself names; one capture group on the Parent
// sentence, which names no limb group because 7.3(c) has only one.
const COMPANY_PAYMENT_TIMING_RE = /The payment of the Company Termination Fee shall be made \(1\) in the case of a payment pursuant to Section 7\.3\(b\)\(i\), Section 7\.3\(b\)\(iv\) or Section 7\.3\(b\)\(v\), (within two \(2\) Business Days after the date of such termination by Parent), \(2\) in the case of a payment pursuant to Section 7\.3\(b\)\(ii\), (prior to or substantially concurrently with such termination by the Company) and \(3\) in the case of a payment pursuant to Section 7\.3\(b\)\(iii\), (within two \(2\) Business Days after the earlier of entry into a definitive agreement relating to the Company Acquisition Proposal referred to in clause \(B\) of Section 7\.3\(b\)\(iii\) and consummation of such Company Acquisition Proposal)\./g;
const PARENT_PAYMENT_TIMING_RE = /The payment of the Parent Termination Fee shall be made (within two \(2\) Business Days after the date of such termination by the Company)\./g;

function parseModivPaymentTimings(sourceText) {
  if (typeof sourceText !== 'string') throw new TypeError('sourceText must be a string');
  const company = exactlyOne(sourceText, COMPANY_PAYMENT_TIMING_RE);
  const parent = exactlyOne(sourceText, PARENT_PAYMENT_TIMING_RE);
  if (!company || !parent) throw new Error('MODIV_PAYMENT_TIMING_SENTENCE_MISSING_OR_AMBIGUOUS');
  const row = (feeSide, branch, quote) => buildTerminationFeePaymentTiming({
    fee_side: feeSide,
    triggering_branch: branch,
    payment_timing_quote: quote,
    source_citations: [branch],
  });
  return Object.freeze([
    row('SELLER', '7.3(b)(i)', company[1]),
    row('SELLER', '7.3(b)(iv)', company[1]),
    row('SELLER', '7.3(b)(v)', company[1]),
    row('SELLER', '7.3(b)(ii)', company[2]),
    row('SELLER', '7.3(b)(iii)', company[3]),
    row('BUYER', '7.3(c)', parent[1]),
  ]);
}

/**
 * Same gating shape as `resolveModivConditionalFees`: only fires when every
 * one of the six expected branches is present in this run's OWN compiled
 * fee-trigger candidates, with a citation this run itself accepted, and the
 * corroborated `fee_side` matches the expected one -- never guessed, never
 * partial. Any other agreement's fee-trigger candidates will not carry all
 * six of these exact branch citations, so this returns nothing for them,
 * silently, exactly as if this file did not exist.
 *
 * @param {object} args
 * @param {string} args.source_text admitted_source_context.canonical_text.text
 * @param {object[]} args.fee_trigger_candidates run_receipt.compiled_candidates,
 *   unfiltered -- this function does its own filtering, mirroring the
 *   sibling sidecar's own call contract exactly.
 * @returns {object[]} frozen array, one row per branch (six for Modiv)
 */
function resolveModivPaymentTimings({ source_text: sourceText, fee_trigger_candidates: feeTriggerCandidates } = {}) {
  if (!Array.isArray(feeTriggerCandidates)) throw new TypeError('fee_trigger_candidates must be an array');
  const supported = new Map();
  for (const entry of feeTriggerCandidates) {
    if (entry?.candidate?.kind !== 'claim'
      || entry.candidate.claim?.claim_definition_key !== 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE') {
      continue;
    }
    const branch = entry?.citation_validation?.accepted === true
      ? entry.citation_validation.derived_citation
      : null;
    const side = entry.candidate.claim.attributes?.fee_side;
    if (!EXPECTED_BRANCH_SIDES.has(branch)) continue;
    if (side !== EXPECTED_BRANCH_SIDES.get(branch)) {
      throw new Error('MODIV_PAYMENT_TIMING_TRIGGER_SIDE_MISMATCH');
    }
    supported.set(branch, true);
  }
  if ([...EXPECTED_BRANCH_SIDES.keys()].some((branch) => !supported.has(branch))) {
    throw new Error('MODIV_PAYMENT_TIMING_TRIGGER_BRANCH_UNSUPPORTED');
  }
  return parseModivPaymentTimings(sourceText);
}

module.exports = {
  SCHEMA,
  buildTerminationFeePaymentTiming,
  parseModivPaymentTimings,
  resolveModivPaymentTimings,
};
