/**
 * lib/canonical-v2/native-producer/termination-fee-producer-prompt.js
 *
 * The extraction prompt for the termination-fee family (docs/superpowers/
 * specs/2026-08-02-family-termination-fee-design.md, section 3). Registered
 * in producer-prompt-registry.js under the `TERMINATION_FEE` section
 * family -- `capitalisation-producer-prompt.js` is NOT edited by this
 * module: its PROMPT_VERSION does not move, and its own three recorded
 * fixtures replay byte-identically (see this module's file header note in
 * producer-prompt-registry.js and section-family-classifier.js for why a
 * second, independent producer module is the correct shape here, never a
 * capitalisation-prompt extension).
 *
 * SAME ARCHITECTURAL CONSTRAINTS AS capitalisation-producer-prompt.js (see
 * that file's own header and EXECUTION-LEDGER M3 semantics):
 *
 *  - The producer NEVER asserts a negative.
 *  - Every value that is not a controlled code carries a verbatim quote,
 *    byte-verified after the response returns.
 *  - A novel proposition is preserved as an open-world candidate, never
 *    forced onto the nearest known concept.
 *
 * THIS FAMILY'S OWN DISCIPLINE (spec section 3): when unsure of trigger_code
 * or fee_side, keep the item in open_world_candidates -- promotion narrows
 * what qualifies for a typed array, it never forces a doubtful reading into
 * a controlled shape. A compound quote stating more than one dollar figure
 * MUST be split into one fee_amount_assertions entry per limb (the Dyax
 * two-sided defined-term shape, spec section 1) -- the parser's own
 * MULTIPLE_MONEY_LITERALS/AMBIGUOUS_FEE_SIDE gates exist precisely because a
 * producer sometimes fails to split; this instruction is what tries to stop
 * that failure at the source.
 *
 * PROMPT_VERSION 2: splitting alone is not enough when the defining term is
 * stated ONCE, ahead of every limb -- true of both Dyax's two-payer shape
 * and, newly handled, a single-payer shape keyed on which of several
 * cross-referenced sections fires (a real Modiv agreement's "Company Base
 * Amount": (x) if Section 7.3(b)(i)-(iii), one figure; (y) if Section
 * 7.3(b)(iv)-(v), another). A split sibling whose OWN minimal span cannot
 * reach back to that term is a fragment that cannot say what it is the
 * amount of -- the resolver's fee_term_ref-in-quote gate correctly refuses
 * it, and a real recorded Modiv response produced exactly that fragment for
 * the (y) branch. The SPLIT COMPOUND SENTENCES BY LIMB rule below now says
 * when a limb may stay minimal (it already reaches the term unaided --
 * ordinarily only the first limb) and when it must quote its entire
 * defining sentence instead (every later limb, ordinarily), plus a
 * stricter, symmetric rule for the single-payer/conditional-on-trigger
 * shape: EVERY limb quotes the whole sentence, identically, because a lone
 * limb that resolves to one flat number misrepresents a figure that is
 * actually conditional on which ground the deal terminates under. Verified
 * against the real, unmodified resolver and the actual recorded Modiv
 * response (see this module's own test file); NOT verified against a live
 * model response -- no live run was made for this change, and none can
 * prove the model will follow the reworded rule.
 */

'use strict';

const PROMPT_ID = 'native-producer-termination-fee/v1';
const PROMPT_VERSION = 2;

/**
 * Controlled vocabularies the model may use. The trigger codes are the
 * governed TERMINATION_FEE_TRIGGER claim-definition enum (contract-
 * bundle.js V15) -- the six TERMINATION_FEE_TRIGGER_PATH/V2 codes plus
 * SUPERIOR_PROPOSAL_TERMINATION -- duplicated here as literal strings
 * (never imported from contract-bundle.js: this prompt module has no
 * dependency on the registry, matching capitalisation-producer-prompt.js's
 * own precedent of an inline CONTROLLED_VOCABULARIES block) so the model
 * speaks exactly the vocabulary the resolver will corroborate against.
 */
const CONTROLLED_VOCABULARIES = Object.freeze({
  TRIGGER_CODE: Object.freeze({
    CHANGE_IN_RECOMMENDATION_TERMINATION: 'Termination following a change/adverse change in the board\'s recommendation',
    NO_SOLICIT_BREACH_TERMINATION: 'Termination for breach of the no-solicitation covenant',
    STOCKHOLDER_APPROVAL_FAILURE_TERMINATION: 'Termination for failure to obtain stockholder/shareholder approval',
    OUTSIDE_DATE_TERMINATION: 'Termination because the outside/end date has passed',
    COUNTERPARTY_COVENANT_BREACH_TERMINATION: 'Termination for the counterparty\'s breach of a covenant or failure to perform',
    INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION: 'Termination for a recommendation change following an intervening event',
    SUPERIOR_PROPOSAL_TERMINATION: 'Termination by the Company to accept a superior proposal (the fiduciary out)',
  }),
  FEE_SIDE: Object.freeze({
    SELLER: 'The Company (target) pays the fee',
    BUYER: 'Parent (acquirer) pays the fee',
  }),
});

/**
 * The response contract. Three new arrays alongside open_world_candidates
 * -- this family's OWN response schema, deliberately NOT added to the
 * capitalisation module's response shape (spec section 3: "this is
 * deliberately NOT the share_count precedent, which added lists to the
 * SAME capitalisation response").
 */
const RESPONSE_SHAPE = `{
  "fee_amount_assertions": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '8.3(a)'>",
      "fee_side": "SELLER | BUYER -- see FEE_SIDE below. If genuinely unclear which side pays, do NOT use this array -- raise an open_world_candidates entry instead",
      "payer_party": "<verbatim party phrase as printed, e.g. 'the Company' or 'Parent'>",
      "fee_term_ref": "<the verbatim defined-term phrase for this fee exactly as it appears in the quote, e.g. 'Termination Fee', 'Company Termination Fee', 'Parent Termination Fee', 'Parent Termination Payment'>",
      "quote": "<verbatim text carrying THIS limb's dollar figure and the verbatim fee_term_ref naming it -- your own limb's minimal span if that already reaches the term, otherwise the whole defining sentence -- see SPLIT COMPOUND SENTENCES BY LIMB below>"
    }
  ],
  "fee_trigger_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "fee_side": "SELLER | BUYER -- which side's fee this trigger governs",
      "trigger_code": "<one TRIGGER_CODE from the controlled vocabulary, or null if none fits -- see TRIGGER CODE below>",
      "quote": "<verbatim text describing the triggering event -- narrow it to a SINGLE trigger limb wherever the source lets you, see NARROW THE TRIGGER QUOTE below>"
    }
  ],
  "tail_period_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "quote": "<verbatim text stating the tail period -- see TAIL PERIODS below>"
    }
  ],
  "wave_b_mechanics": [
    {
      "surface": "SOLE_REMEDY | NAKED_NO_VOTE | EXPENSE_REIMBURSEMENT | LATE_PAYMENT_INTEREST | TAIL_FEE_STRUCTURE",
      "section_reference": "<verbatim section number as printed>",
      "quote": "<verbatim text carrying one deferred mechanism>",
      "detail": "<short factual description; do not calculate it>",
      "payment_context_quote": "<SOLE_REMEDY only: smallest exact quote identifying the fee payment context, or null>",
      "remedy_effect_quote": "<SOLE_REMEDY only: smallest exact quote stating the sole-remedy effect, or null>",
      "carve_outs": [{ "kind": "FRAUD | WILLFUL_BREACH", "quote": "<smallest exact quote for this carve-out>" }],
      "period_quote": "<TAIL_FEE_STRUCTURE only: exact tail-period wording, or null>",
      "arming_event_quote": "<TAIL_FEE_STRUCTURE only: exact event that arms the tail, or null>",
      "qualifying_transaction_quote": "<TAIL_FEE_STRUCTURE only: exact qualifying transaction wording, or null>",
      "threshold_quote": "<TAIL_FEE_STRUCTURE only: exact threshold wording, or null>",
      "same_proposal_requirement_quote": "<TAIL_FEE_STRUCTURE only: exact same-proposal requirement, or null>",
      "benchmark_quote": "<LATE_PAYMENT_INTEREST only: exact quoted benchmark/base wording, or null>",
      "due_date_reference_quote": "<LATE_PAYMENT_INTEREST only: exact due-date reference, or null>"
    }
  ],
  "open_world_candidates": [
    {
      "observed_quote": "<verbatim text of the proposition you could not express above>",
      "why_unmapped": "<one clause: what it asserts and which existing concept it resembles but is not>",
      "nearest_concept": "<the concept you deliberately did NOT force it into, or null>"
    }
  ]
}`;

const INSTRUCTIONS = `You are a senior M&A lawyer reading a merger agreement's termination-fee provisions. You are producing PROPOSED extractions for review. Nothing you output is published without human review, and a confident wrong answer is far worse than an honest omission.

EVIDENCE RULE. Every quote field must be copied character-for-character from the source text you were given. Quotes are verified byte-for-byte against the source after you respond; a quote that does not reproduce exactly is discarded and the proposal with it. Never normalise, summarise, join with ellipses, or "clean up" a quote.

NEVER ASSERT A NEGATIVE. Do not report that a fee, trigger, or tail period is absent or inapplicable. Report only what IS present, with evidence.

SPLIT COMPOUND SENTENCES BY LIMB -- NEVER LET THE SPLIT SEVER THE DEFINING TERM. A fee amount is often stated as more than one dollar figure in one sentence, for two different reasons. Both still get ONE fee_amount_assertions entry PER LIMB -- never one assertion quoting the whole compound sentence for a single limb, never two limbs' figures folded into one quote:

  (a) TWO SIDES, TWO FACTS. The sentence states each side's fee in one breath (e.g. ""Termination Fee" means (x) with respect to a payment required to be made by the Company, $X, and (y) with respect to a payment required to be made by Parent, $Y."). The Company's fee and Parent's fee are independent, unconditional facts -- each is simply true regardless of the other. Give each limb its own fee_side, payer_party and quote.

  (b) ONE SIDE, ONE CONDITIONAL FACT. The sentence states only one side's fee, and the figure depends on which of several cross-referenced sections actually triggers payment (e.g. ""Company Base Amount" means (x) if payable pursuant to Section X(i), Section X(ii) or Section X(iii), $X, or (y) if payable pursuant to Section X(iv) or Section X(v), $Y."). This is ONE fact -- what this side's fee comes to -- with an answer that depends on which ground the deal terminates under, not two competing facts. Still emit one entry per limb so the ground-to-amount mapping survives as separate rows, but see the quoting rule below: it treats (b) differently from (a).

QUOTE COMPLETENESS, BOTH SHAPES. Every limb's own quote must contain both its own dollar figure and the verbatim fee_term_ref naming it -- never a fragment that has lost the defining phrase, even if that costs you a larger quote than the limb's own text. If a limb's own text already carries the defining term without reaching into a sibling limb's text (typically the first limb, since the term is usually stated once, before any limb), keep that limb's quote to its own minimal span, as for an ordinary single-amount sentence. If a limb's own text cannot carry the defining term without also sweeping in a sibling's dollar figure (typically every limb after the first), quote that limb's ENTIRE defining sentence rather than truncate it into a fragment that cannot say what it is the amount of.

SHAPE (b) ONLY: quote EVERY limb's entire defining sentence, identically, including the first limb even though it could otherwise stay narrow. A single flat figure that reads as the whole, unconditional answer is WRONG exactly when the true answer is conditional -- so for a one-side conditional fact, no one limb may be left looking like a complete, standalone answer while its sibling is stuck as an unreadable fragment.

It is correct and required for two or more fee_amount_assertions to carry byte-for-byte identical quotes when they state alternative values of the same defined term. Do not treat identical quotes as a mistake, and never trim, paraphrase, or otherwise force two such quotes to look different from each other or from the source. There is no field for "which figure in this shared quote is this assertion's own" -- do not invent one by repurposing section_reference, payer_party or fee_term_ref; leave that disambiguation to the resolver and the human reviewer reading the full quote.

FEE_SIDE -- KEY ON WHO PAYS, NEVER ON WHO TERMINATES. "the Company terminates this Agreement ... then Parent shall pay the Company a termination fee" is a BUYER fee (Parent pays), even though "the Company" is the one terminating and appears first. Read the payment-direction verb ("shall pay"), not the termination-direction verb ("terminates"). If you cannot tell who pays, do not guess -- raise an open_world_candidates entry instead.

FEE_TERM_REF IS REQUIRED. Every fee_amount_assertions entry needs the verbatim defined-term phrase that names the fee (e.g. "Termination Fee", "Parent Termination Fee", "Parent Termination Payment") as it appears in your own quote. If you cannot identify one, still emit the amount with your best-effort fee_term_ref -- the resolver, not you, decides whether it is acceptable.

TRIGGER CODE -- ONE LIMB, ONE CODE, NARROW THE QUOTE WHEREVER YOU CAN. Real termination-fee trigger sections are usually MULTI-TRIGGER: one sentence conditions the fee on several alternative termination grounds. If the FULL sentence covers more than one of the controlled TRIGGER_CODE meanings, do not just quote the whole sentence and pick one code -- prefer to quote the NARROWEST contiguous sub-span that names only the single trigger you are coding (e.g. quote just the "(Company Change of Recommendation)" parenthetical rather than the whole multi-ground sentence). If you genuinely cannot narrow it, quote the full sentence and let the resolver route it for review -- do not force a single code onto ambiguous, multi-ground text.

A trigger quote that cites ONLY a section number (e.g. "terminated by the Company pursuant to Section 8.01(d)(i)") with no descriptive language of the ground itself still gets its own fee_trigger_assertions entry with trigger_code null if you cannot otherwise identify the ground -- do not invent descriptive text that is not in the source.

TAIL PERIODS. A tail period is the "for N months following termination" survival window on a company-side fee. Quote it verbatim, including any belt-and-braces spelled-and-parenthesised form ("twelve (12) months"). If the same clause states more than one time period (e.g. a shorter notice/cure period alongside the tail window itself), still quote the whole clause rather than trying to isolate just the tail phrase -- the resolver's own parser handles multi-period ambiguity.

WAVE B EVIDENCE CAPTURE. Also use wave_b_mechanics for a positive statement about a sole-remedy rule, naked-no-vote fee, expense reimbursement, late-payment interest, or tail-fee structure. Copy one complete, verbatim mechanism per entry. For SOLE_REMEDY, preserve the payment context and remedy effect separately. Record Fraud and Willful Breach as separate carve_outs. The Remedies family owns the legal effect. This fee family retains the payment context and evidence only. For TAIL_FEE_STRUCTURE, preserve period, arming event, qualifying transaction, threshold and same-proposal requirement as separate exact quotes. Do not reduce the object to a month count. For LATE_PAYMENT_INTEREST, presence follows from the positive quote. Preserve only the quoted benchmark/base and due-date reference. Never derive a rate or day-count basis. Do not decide a fee trigger or calculate a percentage. If it is unclear, use open_world_candidates instead.

PRESERVE THE NOVEL. If the text asserts something you cannot express in the shape above without distorting it -- including any amount, trigger, or tail period you are unsure about -- do not force it into the nearest available field. Put it in open_world_candidates with the verbatim text and say what it resembles. Promotion into a typed array narrows what gets governed; it never forces a doubtful reading into a controlled shape.

CONTROLLED CODES ONLY. Where a field takes a code (fee_side, trigger_code), use one from the supplied vocabularies exactly, or null. Never invent a code.

Return only the JSON object described. No prose, no markdown fences.`;

/**
 * Builds the prompt for one governed scope (the termination/fee article
 * scope). Same contract as buildCapitalisationProducerPrompt: the caller
 * supplies the exact admitted text and the scope that licenses examining
 * it; this function does not read files, call models, or decide anything
 * about the result.
 *
 * @param {object} args
 * @param {string} args.source_text        exact admitted text for the governed scope
 * @param {object} args.governed_scope     what the producer is licensed to examine
 * @param {Array}  [args.known_definitions] defined terms already resolved upstream
 * @returns {{prompt_id: string, prompt_version: number, messages: Array}}
 */
function buildTerminationFeeProducerPrompt({
  source_text: sourceText,
  governed_scope: governedScope,
  known_definitions: knownDefinitions = [],
}) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    throw new TypeError('source_text must be a non-empty string');
  }
  if (!governedScope || typeof governedScope !== 'object') {
    throw new TypeError('governed_scope must be an object');
  }

  const definitionsBlock = knownDefinitions.length
    ? `DEFINED TERMS ALREADY RESOLVED (reference these rather than re-deriving them):\n${
      knownDefinitions.map((d) => `- ${d.defined_term}`).join('\n')}\n\n`
    : '';

  const content = [
    INSTRUCTIONS,
    '',
    'CONTROLLED VOCABULARIES:',
    JSON.stringify(CONTROLLED_VOCABULARIES, null, 2),
    '',
    'RESPONSE SHAPE:',
    RESPONSE_SHAPE,
    '',
    definitionsBlock,
    'SOURCE TEXT (this is the complete scope you are licensed to examine; quote only from it):',
    sourceText,
  ].join('\n');

  return {
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: [{ role: 'user', content }],
  };
}

module.exports = {
  PROMPT_ID,
  PROMPT_VERSION,
  CONTROLLED_VOCABULARIES,
  RESPONSE_SHAPE,
  INSTRUCTIONS,
  buildTerminationFeeProducerPrompt,
};
