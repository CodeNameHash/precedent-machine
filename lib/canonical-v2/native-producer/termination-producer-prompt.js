/**
 * lib/canonical-v2/native-producer/termination-producer-prompt.js
 *
 * The extraction prompt for the termination-RIGHTS family (docs/
 * superpowers/specs/2026-08-02-family-termination-rights-design.md,
 * section 3). Registered in producer-prompt-registry.js under the
 * `TERMINATION` section family -- distinct from `TERMINATION_FEE`
 * (termination-fee-producer-prompt.js), which governs a different rank-20
 * family with its own section-family classification and its own producer
 * module. Neither capitalisation-producer-prompt.js, termination-fee-
 * producer-prompt.js, no-shop-producer-prompt.js, nor mae-definition-
 * producer-prompt.js is edited by this module: its own PROMPT_VERSION
 * moves independently and none of theirs move because of it.
 *
 * SAME ARCHITECTURAL CONSTRAINTS AS THE OTHER FAMILY PROMPTS (see those
 * files' own headers and EXECUTION-LEDGER M3 semantics):
 *
 *  - The producer NEVER asserts a negative.
 *  - Every value that is not a controlled code carries a verbatim quote,
 *    byte-verified after the response returns.
 *  - A novel proposition is preserved as an open-world candidate, never
 *    forced onto the nearest known concept.
 *
 * ONE ELEMENT PER LEGAL FACT (spec section 3): a breach right with a cure
 * period is TWO elements -- the grant (RIGHT_GRANT) and the cure count
 * (CURE_PERIOD) -- each with its own single-fact quote, mirroring the P1
 * compound-sentence rule. The prompt owns the split so the parsers' own
 * one-candidate rules (termination-deadline-parse.js's MULTIPLE_CALENDAR_
 * DATES, cure-period-parse.js's MULTIPLE_DAY_COUNTS) are satisfiable.
 *
 * QUOTE THE INITIAL DEADLINE SENTENCE ONLY (spec section 3): extension
 * provisos are separate open-world candidates, never folded into the same
 * OUTSIDE_DATE quote as the initial deadline -- the parser refuses to pick
 * between two dates in one quote, by design.
 */

'use strict';

const PROMPT_ID = 'native-producer-termination/v1';
const PROMPT_VERSION = 1;

/**
 * Controlled vocabularies the model may use. `TRIGGER_KIND` is the eight
 * registered-concept triggers (spec section 1's governed attribute enum);
 * `TERMINATING_PARTY_SCOPE` is the two-value scope enum (spec section 1's
 * "the legal substance the family exists to capture"). Both are duplicated
 * here as literal strings (never imported from contract-bundle.js, matching
 * termination-fee-producer-prompt.js's own precedent) so the model speaks
 * exactly the vocabulary the resolver will corroborate against.
 */
const CONTROLLED_VOCABULARIES = Object.freeze({
  TRIGGER_KIND: Object.freeze({
    MUTUAL_CONSENT: 'Termination by mutual written consent of both parties',
    OUTSIDE_DATE: 'Termination because the outside/end/termination date has passed without closing',
    VOTE_FAILURE: 'Termination for failure to obtain the required stockholder/shareholder vote',
    BREACH: 'Termination for the counterparty\'s breach of a representation, warranty or covenant',
    LEGAL_RESTRAINT: 'Termination because a permanent legal restraint/injunction prevents consummation',
    SUPERIOR_PROPOSAL: 'Termination by the Company to accept a superior proposal (the fiduciary out)',
    RECOMMENDATION_CHANGE: 'Termination following a change/adverse change in the board\'s recommendation',
    NO_SOLICITATION_BREACH: 'Termination for the Company\'s breach of the no-solicitation covenant',
  }),
  TERMINATING_PARTY_SCOPE: Object.freeze({
    EITHER_PARTY: 'Either party may exercise this termination right (a mutual or reciprocal right)',
    ONE_PARTY: 'Only one named party may exercise this termination right',
  }),
  DAY_KIND: Object.freeze({
    CALENDAR: 'The day count is calendar days',
    BUSINESS: 'The day count is Business Days',
  }),
  PERIOD_KIND: Object.freeze({
    CURE: 'A cure period -- time to cure a breach before termination becomes effective',
    NOTICE: 'A notice-delivery window -- advance notice required before termination',
  }),
});

/**
 * The response contract. `termination_right_assertions` is this family's
 * OWN response array (spec section 3), deliberately NOT merged into any
 * sibling family's own response shape.
 */
const RESPONSE_SHAPE = `{
  "termination_right_assertions": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '8.1(b)'>",
      "assertion_kind": "RIGHT_GRANT | OUTSIDE_DATE | CURE_PERIOD -- see ASSERTION_KIND below",
      "trigger_kind": "<one TRIGGER_KIND from the controlled vocabulary, or null if none fits -- see TRIGGER_KIND below>",
      "terminating_party_scope": "EITHER_PARTY | ONE_PARTY -- see TERMINATING_PARTY_SCOPE below. If genuinely unclear, do NOT use this array -- raise an open_world_candidates entry instead",
      "terminating_party": "<verbatim party phrase exactly as printed, e.g. 'either Parent or the Company', 'the Company', 'Parent' -- see TERMINATING_PARTY below>",
      "deadline_term": "<OUTSIDE_DATE assertions ONLY -- the verbatim defined-term phrase for the deadline exactly as printed, e.g. 'Outside Date', 'End Date', 'Termination Date'; omit/null for other assertion_kind values>",
      "day_kind": "CALENDAR | BUSINESS -- CURE_PERIOD assertions ONLY; omit/null for other assertion_kind values",
      "period_kind": "CURE | NOTICE -- CURE_PERIOD assertions ONLY; omit/null for other assertion_kind values -- see PERIOD_KIND below",
      "quote": "<verbatim text carrying exactly ONE legal fact -- see ONE ELEMENT PER LEGAL FACT below>"
    }
  ],
  "wave_b_mechanics": [
    {
      "surface": "OUTSIDE_DATE_EXTENSION | RESTRAINT_FINALITY | VOTE_THRESHOLD | BREACH_STANDARD | PRE_VOTE_LIMIT",
      "quote": "<verbatim text carrying one deferred mechanism>",
      "detail": "<short factual description; do not calculate or classify it>"
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

const INSTRUCTIONS = `You are a senior M&A lawyer reading a merger agreement's termination-RIGHTS provisions (who may terminate, and on what grounds -- NOT the termination-fee amounts or triggers, which are a separate, already-governed family). You are producing PROPOSED extractions for review. Nothing you output is published without human review, and a confident wrong answer is far worse than an honest omission.

EVIDENCE RULE. Every quote field must be copied character-for-character from the source text you were given. Quotes are verified byte-for-byte against the source after you respond; a quote that does not reproduce exactly is discarded and the proposal with it. Never normalise, summarise, join with ellipses, or "clean up" a quote.

NEVER ASSERT A NEGATIVE. Do not report that a termination right, deadline, or cure period is absent or inapplicable. Report only what IS present, with evidence.

ONE ELEMENT PER LEGAL FACT -- SPLIT COMPOUND SENTENCES. A breach right stated alongside its own cure period is TWO assertions, not one: a RIGHT_GRANT (trigger_kind BREACH) and a separate CURE_PERIOD, each with its own quote naming its own single fact. Do not quote the whole compound sentence for both; each quote should be the smallest contiguous span that carries exactly one legal fact.

ASSERTION_KIND.
- RIGHT_GRANT: the bare grant of a termination right under a given trigger_kind (who may terminate, and why).
- OUTSIDE_DATE: the specific deadline/outside-date mechanism (a calendar date or the defined term naming it).
- CURE_PERIOD: a breach-cure or notice-delivery day count governing when a BREACH or NO_SOLICITATION_BREACH termination becomes effective.

TRIGGER_KIND -- ONE LIMB, ONE CODE. If the quote covers more than one of the controlled TRIGGER_KIND meanings, prefer the NARROWEST contiguous sub-span that names only the single trigger you are coding. If you genuinely cannot tell which trigger applies, leave trigger_kind null rather than guessing -- the resolver routes a null trigger_kind to review rather than resolving it, which is the correct outcome for an unclear ground.

TERMINATING_PARTY_SCOPE -- KEY ON WHO MAY EXERCISE THE RIGHT, NEVER ON WHO BREACHED. In a breach clause, BOTH parties are typically named ("by Parent, if there shall have been a breach ... on the part of the Company") -- terminating_party is the party who MAY TERMINATE (here, Parent), never the breaching party (here, the Company). Getting this backwards inverts the legal substance of the clause. If you cannot tell who may terminate, do not guess -- raise an open_world_candidates entry instead.

TERMINATING_PARTY IS REQUIRED for both RIGHT_GRANT and CURE_PERIOD (CURE_PERIOD inherits the same terminating party as the right it governs). Use the verbatim phrase from the quote (e.g. "either Parent or the Company", "the Company", "Parent") -- never paraphrase or normalise it.

OUTSIDE_DATE -- QUOTE THE INITIAL DEADLINE SENTENCE ONLY. If the same section also describes an automatic or elective extension of the deadline ("the End Date will be automatically extended to..."), do NOT include the extension language in the same quote -- quote only the sentence stating the INITIAL deadline, and raise a SEPARATE open_world_candidates entry for the extension mechanics. A quote containing two dates cannot be resolved by the downstream parser; it will simply queue for review, so narrowing at the source is strictly better.

WAVE B EVIDENCE CAPTURE. Also use wave_b_mechanics for a positive statement about an outside-date extension, restraint finality, vote threshold, breach standard, or pre-vote limit. These labels route evidence only. They are not legal codes. Copy one complete, verbatim mechanism per entry. Do not infer a negative, calculate a period, or decide that the mechanism belongs to a closing condition, no-shop, proxy, or remedies family. If it is unclear, use UNCLASSIFIED_SURFACE in open_world_candidates instead.

CURE_PERIOD -- day_kind and period_kind. day_kind is CALENDAR unless the quote itself says "Business Day"/"Business Days". period_kind is CURE when the count governs curing a breach (e.g. "not cured within 30 days") and NOTICE when the count governs an advance-notice delivery window (e.g. "delivered at least 45 days prior to such termination") -- these are DIFFERENT legal facts even when both numbers appear in neighboring sentences; do not conflate them into one assertion.

PRESERVE THE NOVEL. If the text asserts something you cannot express in the shape above without distorting it -- including any trigger, party scope, or period you are unsure about -- do not force it into the nearest available field. Put it in open_world_candidates with the verbatim text and say what it resembles. Promotion into a typed array narrows what gets governed; it never forces a doubtful reading into a controlled shape.

CONTROLLED CODES ONLY. Where a field takes a code (assertion_kind, trigger_kind, terminating_party_scope, day_kind, period_kind), use one from the supplied vocabularies exactly, or null (where null is allowed above). Never invent a code.

Return only the JSON object described. No prose, no markdown fences.`;

/**
 * Builds the prompt for one governed scope (the termination-rights article
 * scope). Same contract as buildCapitalisationProducerPrompt /
 * buildTerminationFeeProducerPrompt: the caller supplies the exact admitted
 * text and the scope that licenses examining it; this function does not
 * read files, call models, or decide anything about the result.
 *
 * @param {object} args
 * @param {string} args.source_text        exact admitted text for the governed scope
 * @param {object} args.governed_scope     what the producer is licensed to examine
 * @param {Array}  [args.known_definitions] defined terms already resolved upstream
 * @returns {{prompt_id: string, prompt_version: number, messages: Array}}
 */
function buildTerminationProducerPrompt({
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
  buildTerminationProducerPrompt,
};
