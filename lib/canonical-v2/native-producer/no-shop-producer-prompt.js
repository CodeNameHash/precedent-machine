/**
 * lib/canonical-v2/native-producer/no-shop-producer-prompt.js
 *
 * The extraction prompt for the no-shop family (docs/superpowers/specs/
 * 2026-08-02-family-no-shop-design.md, section 3 -- AUDIT-AMENDED).
 * Registered in producer-prompt-registry.js under the `NO_SHOP` section
 * family -- neither `capitalisation-producer-prompt.js` nor
 * `termination-fee-producer-prompt.js` is edited by this module: their own
 * PROMPT_VERSIONs do not move, and their recorded fixtures replay
 * byte-identically (mirrors those two modules' own file-header precedent).
 *
 * SAME ARCHITECTURAL CONSTRAINTS AS THE OTHER TWO PRODUCER PROMPTS (see
 * their own headers and EXECUTION-LEDGER M3 semantics):
 *
 *  - The producer NEVER asserts a negative (M3 rule 1, restated below).
 *  - Every value that is not a controlled code carries a verbatim quote,
 *    byte-verified after the response returns.
 *  - A novel proposition is preserved as an open-world candidate, never
 *    forced onto the nearest known concept.
 *
 * THIS FAMILY'S OWN DISCIPLINE (spec section 3): when unsure which action/
 * prerequisite code fits, or the drafting does not match any code, keep it
 * in open_world_candidates -- promotion narrows novelty, never forces fit.
 * Go-shop windows remain open world. Acquisition Proposal and Superior
 * Proposal definitions are owned by the defined-terms producer. A sentence stating two
 * periods ("three (3) Business Days instead of five (5) Business Days") is
 * TWO period_assertions with two quotes (mirrors the P1 compound-quote
 * split rule; the parser ABSTAINs on the compound as the backstop, spec
 * section 2's exactly-one rule).
 *
 * CONTROLLED VOCABULARIES ARE THE REGISTRY'S, SINGLE-SOURCED (spec section
 * 3): `NO_SHOP_ACTION_CODES_V2` / `NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2`
 * are imported directly from contract-bundle.js (both are already exported
 * there -- verified at require time by the byte-equality test in
 * tests/canonical-v2-no-shop-lexicon.test.js) rather than hand-copied as a
 * frozen literal the way capitalisation-producer-prompt.js's and
 * termination-fee-producer-prompt.js's own CONTROLLED_VOCABULARIES blocks
 * are: drift between prompt vocabulary and registry gate is a silent
 * corruption path this import closes structurally, never just tests for.
 */

'use strict';

const {
  NO_SHOP_ACTION_CODES_V2,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
} = require('../contract-bundle');

const PROMPT_ID = 'native-producer-no-shop/v2';
const PROMPT_VERSION = 3;

const WAVE_B_ASSERTION_KINDS = Object.freeze([
  'CEASE_ACTION',
  'REPRESENTATIVE_CONTROL_STANDARD',
  'REPRESENTATIVE_BREACH_ATTRIBUTION',
  'STANDSTILL_ACTION',
  'FIDUCIARY_ENGAGEMENT_STANDARD',
  'RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD',
  'RECOMMENDATION_CHANGE_ACTION',
  'RECOMMENDATION_CHANGE_TRIGGER',
  'RECOMMENDATION_SAFE_DISCLOSURE',
]);

const CONTROLLED_VOCABULARIES = Object.freeze({
  ACTION_CODE: Object.freeze(NO_SHOP_ACTION_CODES_V2),
  PREREQUISITE_CODE: Object.freeze(NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2),
  PERIOD_ROLE: Object.freeze(['NOTICE', 'INITIAL_MATCH', 'SUBSEQUENT_MATCH']),
  WAVE_B_ASSERTION_KIND: WAVE_B_ASSERTION_KINDS,
  CEASE_ACTION: Object.freeze([
    'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS',
    'CEASE_FURNISHING_INFORMATION',
    'TERMINATE_DATA_ROOM_ACCESS',
    'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
  ]),
  REPRESENTATIVE_CONTROL_STANDARD: Object.freeze(['CAUSE_NOT_TO', 'REASONABLE_BEST_EFFORTS', 'INSTRUCT_NOT_TO']),
  REPRESENTATIVE_BREACH_ATTRIBUTION: Object.freeze([true]),
  STANDSTILL_ACTION: Object.freeze([
    'ENFORCE',
    'NO_WAIVER_RELEASE_OR_MODIFICATION',
    'PERMIT_WAIVER_FOR_CONFIDENTIAL_PROPOSAL',
    'PERMIT_WAIVER_FIDUCIARY_DUTY_GATED',
  ]),
  FIDUCIARY_ENGAGEMENT_STANDARD: Object.freeze([
    'CONSTITUTES_OR_COULD_REASONABLY_BE_EXPECTED_TO_LEAD',
    'COULD_REASONABLY_BE_EXPECTED_TO_LEAD',
    'REASONABLY_LIKELY_TO_LEAD',
    'CONSTITUTES_SUPERIOR_PROPOSAL',
  ]),
  RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: Object.freeze([
    'INCONSISTENT_WITH_FIDUCIARY_DUTIES',
    'BREACH_OF_FIDUCIARY_DUTIES',
    'REASONABLY_LIKELY_BREACH',
  ]),
  RECOMMENDATION_CHANGE_ACTION: Object.freeze([
    'WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION',
    'APPROVE_ENDORSE_OR_RECOMMEND_ACQUISITION_PROPOSAL',
    'FAIL_TO_INCLUDE_RECOMMENDATION',
    'FAIL_TO_REAFFIRM_RECOMMENDATION',
    'TENDER_OFFER_NO_REJECTION',
    'ENTER_ALTERNATIVE_AGREEMENT',
    'RESOLVE_OR_AGREE_TO_FOREGOING',
  ]),
  RECOMMENDATION_CHANGE_TRIGGER: Object.freeze(['SUPERIOR_PROPOSAL', 'INTERVENING_EVENT']),
  RECOMMENDATION_SAFE_DISCLOSURE: Object.freeze([
    'STOP_LOOK_AND_LISTEN',
    'RULE_14D9_OR_14E2_DISCLOSURE',
    'FACTUAL_DISCLOSURE_REAFFIRMING_RECOMMENDATION',
    'DISCLOSURE_REQUIRED_BY_LAW',
  ]),
});

/**
 * The response contract is strictly additive to the four original arrays. Enum-
 * valued fields (action_code, prerequisite_code, period_role) are a gate,
 * not a suggestion -- an out-of-enum code from the model is routed to open
 * world downstream (candidate-resolution.js), never forced onto the
 * nearest registered value.
 */
const RESPONSE_SHAPE = `{
  "no_shop_action_assertions": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '6.3(a)'>",
      "action_code": "<one ACTION_CODE from the controlled vocabulary, or null if none fits -- see ACTION CODE below>",
      "covenant_obligor": "<verbatim party phrase as printed, e.g. 'the Company'>",
      "quote": "<verbatim text describing the prohibited action -- narrow it to a SINGLE action limb wherever the source lets you>"
    }
  ],
  "exception_prerequisite_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "prerequisite_code": "<one PREREQUISITE_CODE from the controlled vocabulary, or null if none fits>",
      "permitted_action_context": "<verbatim phrase describing the exception's permitted action, as printed>",
      "quote": "<verbatim text stating the prerequisite condition>"
    }
  ],
  "period_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "period_role": "NOTICE | INITIAL_MATCH | SUBSEQUENT_MATCH -- see PERIOD ROLE below",
      "quote": "<verbatim text containing BOTH the number AND its unit (days/Business Days/hours) -- see SPLIT COMPOUND PERIODS below>"
    }
  ],
  "cease_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "assertion_kind": "CEASE_ACTION | REPRESENTATIVE_CONTROL_STANDARD | REPRESENTATIVE_BREACH_ATTRIBUTION",
      "canonical_value": "<one value from the vocabulary named by assertion_kind>",
      "covenant_obligor": "<verbatim party phrase as printed>",
      "quote": "<verbatim text proving this single fact>"
    }
  ],
  "standstill_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "assertion_kind": "STANDSTILL_ACTION",
      "canonical_value": "<one STANDSTILL_ACTION value>",
      "covenant_obligor": "<verbatim party phrase as printed>",
      "quote": "<verbatim text proving this single fact>"
    }
  ],
  "fiduciary_standard_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "assertion_kind": "FIDUCIARY_ENGAGEMENT_STANDARD | RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD",
      "canonical_value": "<one value from the vocabulary named by assertion_kind>",
      "covenant_obligor": "<verbatim board or company phrase as printed>",
      "quote": "<verbatim text proving this single fact>"
    }
  ],
  "recommendation_assertions": [
    {
      "section_reference": "<verbatim section number as printed>",
      "assertion_kind": "RECOMMENDATION_CHANGE_ACTION | RECOMMENDATION_CHANGE_TRIGGER | RECOMMENDATION_SAFE_DISCLOSURE",
      "canonical_value": "<one value from the vocabulary named by assertion_kind>",
      "covenant_obligor": "<verbatim board or company phrase as printed>",
      "quote": "<verbatim text proving this single fact>"
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

const INSTRUCTIONS = `You are a senior M&A lawyer reading a merger agreement's no-shop / fiduciary-exception provisions. You are producing PROPOSED extractions for review. Nothing you output is published without human review, and a confident wrong answer is far worse than an honest omission.

EVIDENCE RULE. Every quote field must be copied character-for-character from the source text you were given. Quotes are verified byte-for-byte against the source after you respond; a quote that does not reproduce exactly is discarded and the proposal with it. Never normalise, summarise, join with ellipses, or "clean up" a quote.

SECTION REFERENCE. Use the governed outer section reference for every assertion unless the supplied source has a separately headed child section that the document itself can construct. Do not invent nested citations from clause labels such as "(i)" or "(ii)". The source evidence, not a guessed sub-citation, identifies the limb.

NEVER ASSERT A NEGATIVE. Do not report that an action is NOT prohibited, that an exception is NOT present, or that a notice/match period does NOT apply. Report only what IS present, with evidence. ABSENT is derived downstream, never asserted here.

ACTION CODE -- ONE LIMB, ONE CODE, NARROW THE QUOTE WHEREVER YOU CAN. A no-shop covenant sentence is often multi-limb ("solicit, initiate, knowingly encourage or knowingly facilitate ..."). If the full sentence covers more than one of the controlled ACTION_CODE meanings, prefer to quote the narrowest contiguous sub-span naming only the single action you are coding. If you cannot narrow it, quote the full sentence and let the resolver route it for review -- do not force a single code onto ambiguous, multi-limb text. If you are unsure which code fits, or the drafting matches none, leave action_code null and still emit the assertion (do NOT silently drop it) -- OR, if the whole proposition resembles nothing in this shape at all, use open_world_candidates instead.

PREREQUISITE CODE -- SAME DISCIPLINE. Fiduciary-exception prerequisites are frequently stacked in one clause (board good-faith determination, outside counsel consultation, prior notice, and more, all in one sentence). Narrow the quote to the single prerequisite you are coding wherever the source lets you; otherwise quote the full clause with prerequisite_code null and let the resolver route it.

PERIOD ROLE -- THE LEGAL DISTINCTION THIS FAMILY IS MOST EXPOSED TO. Agreements frequently label the MATCHING window "the 'Notice Period'" even though the true notice obligation is a separate, often hour-denominated, duty triggered by RECEIPT of a proposal. Do not let the agreement's own defined-term label decide the role:
  - NOTICE = the obligation to tell the buyer UPON RECEIPT of a proposal/inquiry.
  - INITIAL_MATCH = the advance-notice window before a recommendation change or termination during which the buyer may negotiate or match -- even where the agreement calls it a "Notice Period".
  - SUBSEQUENT_MATCH = the renewed window triggered by a MATERIAL AMENDMENT or modification to the proposal.
If you cannot tell which role a period quote plays, do not guess -- raise an open_world_candidates entry instead.

SPLIT COMPOUND PERIODS. A sentence stating two periods ("such period shall be three (3) Business Days instead of five (5) Business Days") is TWO period_assertions, each with its own quote naming its own single period -- never one compound quote covering both.

HOURS ARE NOT DAYS. A period_assertions quote may describe an hour-denominated obligation ("within 24 hours", "within forty-eight (48) hours"). Quote it verbatim exactly as you would a day-denominated period -- do NOT convert it, estimate a day equivalent, or omit it. The resolver, not you, decides that an hour-denominated quote cannot publish as a day count.

WAVE B FACTS. Use cease_assertions for each distinct cessation action, representative-control standard, or express attribution of a representative's breach to the Company. Use standstill_assertions to distinguish an obligation to enforce or not waive a standstill from an express permission to waive one. Use fiduciary_standard_assertions to distinguish the standard for engaging with a proposal from the standard for changing the board recommendation. Use recommendation_assertions for each separate recommendation action, trigger, or expressly permitted disclosure. Split distinct facts into distinct assertions and narrow each quote to the fact it proves.

COVERAGE CHECK BEFORE YOU RETURN. Scan the full section for: (1) each core prohibited action; (2) each express fiduciary-exception prerequisite; (3) each notice, initial-match and subsequent-match period; (4) each recommendation-change action and its stated Superior Proposal or Intervening Event trigger; and (5) each permitted disclosure. Emit each supported fact once with its narrow exact quote. Keep a novel action, exception or standard open world rather than inventing a controlled code.

DEFINED TERMS HAVE A DIFFERENT OWNER. The Acquisition Proposal and Superior Proposal definitions, including their percentages and substantive tests, belong to the defined-terms producer. Do not re-derive or duplicate them here. A reference to Superior Proposal or Intervening Event may still be emitted as a recommendation-change trigger when the quote itself connects that trigger to the recommendation action.

PRESERVE THE NOVEL. Go-shop windows and any proposition that does not fit a controlled Wave B value remain open world. Do not infer a duty, permission, standard, trigger, or safe disclosure from silence. If the text asserts something you cannot express in the shape above without distorting it, put it in open_world_candidates with the verbatim text and say what it resembles.

CONTROLLED CODES ONLY. Where a field takes a code (action_code, prerequisite_code, period_role, assertion_kind, canonical_value), use one from the supplied vocabularies exactly, or null (for action_code/prerequisite_code only -- the other controlled fields have no null: if you cannot identify them, use open_world_candidates instead). canonical_value must come from the vocabulary whose name equals assertion_kind. Never invent a code.

Return only the JSON object described. No prose, no markdown fences.`;

/**
 * Builds the prompt for one governed scope (the no-shop / fiduciary-
 * exception article scope). Same contract as buildCapitalisationProducerPrompt
 * / buildTerminationFeeProducerPrompt: the caller supplies the exact
 * admitted text and the scope that licenses examining it; this function
 * does not read files, call models, or decide anything about the result.
 *
 * @param {object} args
 * @param {string} args.source_text        exact admitted text for the governed scope
 * @param {object} args.governed_scope     what the producer is licensed to examine
 * @param {Array}  [args.known_definitions] defined terms already resolved upstream
 * @returns {{prompt_id: string, prompt_version: number, messages: Array}}
 */
function buildNoShopProducerPrompt({
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
  buildNoShopProducerPrompt,
};
