/**
 * lib/canonical-v2/native-producer/capitalisation-producer-prompt.js
 *
 * The extraction prompt for the CAPITALISATION representation family and its
 * bring-down closing condition.
 *
 * WHY THIS FILE IS WRITTEN THE WAY IT IS
 *
 * v1 has no capitalisation schema. `REP-T-CAP` falls through to the generic
 * `FEATURES['REP-T']` shared with Organization and Tax, so v1 captures a
 * capitalisation rep as one prose `mainConcept`, one whole-rep materiality
 * tag, and a binary ENTIRE_REP/PARTIAL scope flag. That schema structurally
 * cannot express the QXO fact pattern -- rep-level qualifier ABSENT while
 * limb (iv) carries its own substantive threshold -- because it has nowhere
 * to put a per-limb qualifier.
 *
 * v1 DOES extract deeply where a type has a dedicated schema. Its NOSOL
 * extraction splits one section into separate cards per sub-concept, with
 * enumerated code lists, typed numerics and verbatim standards. That is the
 * structural template used here: sub-concepts stay separate objects, acts are
 * enumerated rather than prose, numbers are typed, and standards are captured
 * verbatim.
 *
 * The specification of correctness is the "Target Capitalisation
 * representation" acceptance example in docs/CODEX-PROGRAM.md. There is no
 * golden for this provision anywhere in eval/goldens.json, so that prose is
 * the only ground truth until Ben's first review establishes one.
 *
 * ARCHITECTURAL CONSTRAINTS ENCODED HERE (see EXECUTION-LEDGER M3 semantics)
 *
 *  - The producer NEVER asserts a negative. It emits evidence-backed
 *    positives or open-world candidates. ABSENT is derived downstream from
 *    proven scope completeness; the model is never asked for one, so there is
 *    no confidence threshold to calibrate on the dangerous case.
 *  - Every value that is not a controlled code carries a verbatim quote that
 *    must reproduce byte-identically from the source. Quotes are the only
 *    thing standing between a proposal and a hallucination.
 *  - A novel proposition is preserved as an open-world candidate. It is never
 *    forced onto the nearest known concept.
 *  - Qualifiers attach at the level they actually operate. A threshold inside
 *    one limb is a limb-level object, never promoted to the representation.
 */

'use strict';

const PROMPT_ID = 'CAPITALISATION_REPRESENTATION_PRODUCER';
const PROMPT_VERSION = 1;

/**
 * Controlled vocabularies the model may use. Codes are drawn from
 * lib/taxonomy.js MATERIALITY_CODES and KNOWLEDGE_STANDARD_META so the
 * producer speaks the corpus's existing language rather than inventing one.
 * Anything the model cannot express in these codes must be raised as an
 * open-world candidate instead of being forced to the nearest fit.
 */
const CONTROLLED_VOCABULARIES = Object.freeze({
  ACCURACY_STANDARD: Object.freeze({
    MAT_ALL_RESPECTS: 'True and correct in all respects',
    MAT_ALL_RESPECTS_DE_MINIMIS: 'True except for de minimis inaccuracies',
    MAT_ALL_MATERIAL: 'In all material respects',
    MAT_MATERIAL_TO_COMPANY: 'Materiality to the Company (whole rep)',
    MAT_MATERIAL_INLINE: 'Materiality inline within the rep',
    MAT_MAE_QUALIFIED: 'True except where failure would not have an MAE',
    MAT_MAE_AGGREGATE: 'Would not, individually or in aggregate, have MAE',
    MAT_DE_MINIMIS: 'Except for de minimis inaccuracies',
    MAT_MATERIALITY_SCRAPE: 'Materiality qualifiers disregarded for bring-down',
    MAT_NO_QUALIFIER: 'No materiality qualifier',
  }),
  KNOWLEDGE_STANDARD: Object.freeze({
    ACTUAL: 'Actual knowledge',
    CONSTRUCTIVE: 'Constructive knowledge',
    AFTER_INQUIRY: 'Knowledge after reasonable inquiry',
  }),
  QUALIFIER_ATTACHMENT: Object.freeze({
    REPRESENTATION: 'Qualifies the whole representation',
    LIMB: 'Qualifies one enumerated limb only',
    PROVISO: 'Qualifies via a proviso or carve-out',
  }),
});

/**
 * The response contract. Presented to the model as an explicit shape so a
 * malformed response is a schema failure at the boundary rather than a silent
 * mis-parse downstream. Every leaf that is not a controlled code requires an
 * accompanying verbatim quote.
 */
const RESPONSE_SHAPE = `{
  "representation_instances": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '3.1(b)'>",
      "party_making": "<verbatim party name as the agreement names it>",
      "chapeau_quote": "<verbatim opening words that govern the enumerated limbs>",
      "limbs": [
        {
          "limb_reference": "<verbatim limb label as printed, e.g. '(iv)'>",
          "assertion_quote": "<the complete verbatim text of this limb>",
          "subject": "<what this limb asserts about, in your own words, one clause>",
          "qualifiers": [
            {
              "kind": "ACCURACY | KNOWLEDGE | THRESHOLD | TEMPORAL",
              "attachment": "<one of QUALIFIER_ATTACHMENT>",
              "code": "<controlled code, or null if this is a substantive threshold>",
              "quote": "<verbatim text of the qualifier itself>"
            }
          ]
        }
      ],
      "definition_uses": [
        { "defined_term": "<term as capitalised in the agreement>", "quote": "<verbatim use site>" }
      ],
      "cross_references": [
        { "target": "<verbatim reference as printed>", "quote": "<verbatim containing text>" }
      ]
    }
  ],
  "bring_down_conditions": [
    {
      "section_reference": "<verbatim section number of the closing condition>",
      "condition_obligor": "<party whose obligation is conditioned>",
      "beneficiary": "<party entitled to the condition>",
      "measurement_date_quote": "<verbatim text fixing when accuracy is tested>",
      "tiers": [
        {
          "accuracy_standard": "<controlled ACCURACY_STANDARD code>",
          "covered_scope_quote": "<verbatim contractual expression of which reps this tier covers>",
          "covered_limb_references": ["<limb labels the scope expression resolves to, if it names them>"],
          "scrape_quote": "<verbatim text disregarding materiality/MAE, or null>",
          "exception_quote": "<verbatim carve-out text, or null>"
        }
      ],
      "nested_definitions": [
        { "defined_term": "<term defined inside this condition>", "definition_quote": "<verbatim definition text>" }
      ]
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

/**
 * Instructions. Ordered so the rules that prevent the worst failures come
 * first: fabricated quotes, invented negatives, and qualifier promotion.
 */
const INSTRUCTIONS = `You are a senior M&A lawyer reading a merger agreement. You are producing PROPOSED extractions for review. Nothing you output is published without human review, and a confident wrong answer is far worse than an honest omission.

EVIDENCE RULE. Every quote field must be copied character-for-character from the source text you were given, including parentheticals, defined-term capitalisation and punctuation. Quotes are verified byte-for-byte against the source after you respond; a quote that does not reproduce exactly is discarded and the proposal with it. Never normalise, summarise, join with ellipses, or "clean up" a quote. If you cannot quote it exactly, omit the item.

NEVER ASSERT A NEGATIVE. Do not report that a qualifier, limb or condition is absent, inapplicable, or missing. You have no way to know whether the text you were given is the complete scope. Report only what IS present, with evidence. Absence is determined elsewhere by proving the full scope was examined. If you looked for something and did not find it, say nothing about it.

QUALIFIERS ATTACH WHERE THEY OPERATE. A threshold or standard that sits inside one enumerated limb qualifies THAT LIMB and must be recorded with attachment LIMB. Do not promote it to the representation. A representation-level accuracy qualifier is one that governs the whole assertion via the chapeau or a trailing proviso. Getting this wrong turns a narrow carve-out into a general qualifier and materially misstates the deal, so when the attachment is genuinely ambiguous, record the qualifier at the narrower level and raise the ambiguity as an open-world candidate.

SEPARATE OBJECTS STAY SEPARATE. One section may contain several distinct legal objects: a representation, a definition nested inside it, a cross-reference to a disclosure schedule. Emit each as its own item. Do not collapse them into one summary. Two reciprocal obligations are two objects, not one mutual object.

BRING-DOWN TIERS ARE PER-SCOPE, NOT PER-AGREEMENT. A closing condition commonly applies different accuracy standards to different groups of representations. Emit one tier per standard, each carrying the verbatim scope expression that defines which representations it covers. If the scope expression names specific limbs, list them; if it describes them generally, leave covered_limb_references empty rather than guessing the expansion.

PRESERVE THE NOVEL. If the text asserts something you cannot express in the shape above without distorting it, do not force it into the nearest available field. Put it in open_world_candidates with the verbatim text and say what it resembles. A novel proposition preserved honestly is valuable; a novel proposition crammed into a familiar code is a silent error.

CONTROLLED CODES ONLY. Where a field takes a code, use one from the supplied vocabularies exactly. If no code fits, set the field to null and raise an open-world candidate rather than inventing a code.

Return only the JSON object described. No prose, no markdown fences.`;

/**
 * Builds the prompt for one governed scope. The caller supplies the exact
 * admitted text and the scope that licenses examining it; this function does
 * not read files, call models, or decide anything about the result.
 *
 * @param {object} args
 * @param {string} args.source_text        exact admitted text for the governed scope
 * @param {object} args.governed_scope     what the producer is licensed to examine
 * @param {Array}  [args.known_definitions] defined terms already resolved upstream
 * @returns {{prompt_id: string, prompt_version: number, messages: Array}}
 */
function buildCapitalisationProducerPrompt({
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
  buildCapitalisationProducerPrompt,
};
