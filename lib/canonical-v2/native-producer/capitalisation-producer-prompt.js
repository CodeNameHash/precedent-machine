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
 *  - A qualifier's SCOPE (which limb(s) it governs) is never decided by the
 *    model. The model reports WHERE a qualifier sits (chapeau / inside one
 *    limb / trailing the whole list) and quotes it verbatim; a downstream,
 *    deterministic, testable rule (qualifier-attachment.js) -- never the
 *    model's own judgment -- turns that position into a scope reading. See
 *    "QUALIFIER POSITION" below and F28-FIRST-LIVE-RUN.md defect 2.
 *
 * PROMPT_VERSION 2 (this revision) fixes two defects exposed by the F28
 * first live run (docs/handoffs/F28-FIRST-LIVE-RUN.md):
 *
 *  1. FLAT LIMB REFERENCES CAUSED FRAGMENTATION. A flat `limb_reference`
 *     label ("(i)") is ambiguous the moment a document nests limbs (a
 *     top-level "(i)" containing its own "(A)"/"(B)"): the live run reused
 *     "(i)" across three unrelated pseudo-representations and split one
 *     representation into twelve. `limb_reference` is replaced with
 *     `limb_path`, an ordered array of labels from the representation root,
 *     and the model is explicitly told exactly one `representation_instance`
 *     is emitted per governing section -- sub-clauses are deeper path
 *     entries, never new instances.
 *  2. QUALIFIER ATTACHMENT WAS A FLAT REPRESENTATION/LIMB/PROVISO ENUM WITH
 *     NO ROOM FOR THE GENUINELY AMBIGUOUS CASE. A qualifier that trails an
 *     enumerated list (after the last item, governing either that item alone
 *     or the whole series) is the classic last-antecedent problem -- courts
 *     split on it, wording decides. The old enum forced a guess. The new
 *     `attachment` object separates POSITION (what the model can actually
 *     observe: chapeau / item / trailing) from SCOPE_READING (what follows
 *     from that position), and scope_reading is never taken from the model:
 *     it is computed deterministically downstream, so a trailing qualifier
 *     can never be silently resolved by model judgment.
 */

'use strict';

const PROMPT_ID = 'CAPITALISATION_REPRESENTATION_PRODUCER';
const PROMPT_VERSION = 2;

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
  QUALIFIER_POSITION: Object.freeze({
    CHAPEAU: 'The qualifier sits in the introductory language BEFORE the enumerated limbs -- it governs every limb',
    ITEM: 'The qualifier sits inside ONE limb\'s own text -- it governs that limb only',
    TRAILING: 'The qualifier sits AFTER the last enumerated limb, as freestanding text following the whole list -- '
      + 'its scope is the last-antecedent problem and is never decided by you',
  }),
});

/**
 * The response contract. Presented to the model as an explicit shape so a
 * malformed response is a schema failure at the boundary rather than a silent
 * mis-parse downstream. Every leaf that is not a controlled code requires an
 * accompanying verbatim quote.
 *
 * Note what is deliberately ABSENT: there is no `scope_reading` field
 * anywhere in `attachment`. That value is never asked of the model -- see
 * "QUALIFIER POSITION" in INSTRUCTIONS below -- it is computed downstream
 * from `position` and the qualifier's own quoted text by
 * qualifier-attachment.js, deterministically and testably. If a response
 * includes a `scope_reading` field anyway, it is ignored and recomputed.
 */
const RESPONSE_SHAPE = `{
  "representation_instances": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '3.1(b)'. If the document prints no such numbering for this text (a bare lettered subsection with no decimal section number anywhere above it), use the governing section label exactly as it appears -- never invent a decimal number that is not printed>",
      "party_making": "<verbatim party name as the agreement names it>",
      "chapeau_quote": "<verbatim opening words that govern the enumerated limbs>",
      "limbs": [
        {
          "limb_path": ["<ordered array of verbatim limb labels from the representation root to this limb, e.g. [\\"(iv)\\"] for a top-level limb or [\\"(i)\\",\\"(A)\\"] for sub-clause (A) nested inside limb (i). NEVER a flat single label when the limb is nested.>"],
          "assertion_quote": "<the complete verbatim text of THIS limb's own clause only -- not its nested sub-clauses' text, which get their own limbs entries>",
          "subject": "<what this limb asserts about, in your own words, one clause>"
        }
      ],
      "qualifiers": [
        {
          "kind": "ACCURACY | KNOWLEDGE | THRESHOLD | TEMPORAL",
          "code": "<controlled code, or null if this is a substantive threshold or no code fits>",
          "quote": "<verbatim text of the qualifier itself>",
          "attachment": {
            "position": "CHAPEAU | ITEM | TRAILING",
            "governs_path": "<the limb_path array (see limbs[].limb_path) this qualifier sits inside, for ITEM; the limb_path array it immediately trails, for TRAILING; null for CHAPEAU>",
            "ambiguity_signals": {
              "items_grammatically_parallel": "<bool: your best-effort read of whether the enumerated items share the same grammatical form -- this is the only signal you supply; everything else in ambiguity_signals is computed downstream from your quote, not from you>"
            }
          }
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
 * first: fabricated quotes, invented negatives, structural fragmentation, and
 * qualifier scope guessing.
 */
const INSTRUCTIONS = `You are a senior M&A lawyer reading a merger agreement. You are producing PROPOSED extractions for review. Nothing you output is published without human review, and a confident wrong answer is far worse than an honest omission.

EVIDENCE RULE. Every quote field must be copied character-for-character from the source text you were given, including parentheticals, defined-term capitalisation and punctuation. Quotes are verified byte-for-byte against the source after you respond; a quote that does not reproduce exactly is discarded and the proposal with it. Never normalise, summarise, join with ellipses, or "clean up" a quote. If you cannot quote it exactly, omit the item.

NEVER ASSERT A NEGATIVE. Do not report that a qualifier, limb or condition is absent, inapplicable, or missing. You have no way to know whether the text you were given is the complete scope. Report only what IS present, with evidence. Absence is determined elsewhere by proving the full scope was examined. If you looked for something and did not find it, say nothing about it.

ONE REPRESENTATION PER GOVERNING SECTION. Emit exactly ONE representation_instance for the section you were asked to examine. A sub-clause nested inside another sub-clause is NEVER a new representation_instance -- it is a deeper entry in limb_path on the SAME representation_instance. Getting this wrong is the single most damaging failure mode this schema exists to prevent: it silently turns one governed representation into many unrelated fragments, reuses the same limb label under different parents, and makes a limb-level qualifier impossible to place correctly (see QUALIFIER POSITION below).

WORKED EXAMPLE -- nested limbs stay inside ONE representation. Source text: "(b) Capital Structure. (A) The authorized capital stock is as follows: (i) 250,000,000 shares of common stock... (ii) 10,000,000 shares of preferred stock... (B) All outstanding shares are duly authorized." CORRECT: one representation_instance for "(b)", with limbs:
  { "limb_path": ["(A)"], "assertion_quote": "The authorized capital stock is as follows:", "subject": "..." }
  { "limb_path": ["(A)","(i)"], "assertion_quote": "250,000,000 shares of common stock...", "subject": "..." }
  { "limb_path": ["(A)","(ii)"], "assertion_quote": "10,000,000 shares of preferred stock...", "subject": "..." }
  { "limb_path": ["(B)"], "assertion_quote": "All outstanding shares are duly authorized.", "subject": "..." }
WRONG: four separate representation_instances, one per limb. WRONG: giving limb (A)(i) the bare limb_path ["(i)"] -- that collides with any unrelated top-level "(i)" elsewhere in the document. limb_path always traces the unique path from the representation root.

QUALIFIER POSITION -- YOU REPORT WHERE, THE SYSTEM DECIDES SCOPE. A qualifier's scope depends on where it sits relative to the limbs it might govern -- not on your guess about what the drafter intended. Report exactly one of:
  - CHAPEAU: the qualifier sits in the introductory language BEFORE the enumerated limbs begin. It governs every limb. governs_path is null.
  - ITEM: the qualifier sits inside ONE limb's own text. It governs that limb only. governs_path is that limb's own limb_path.
  - TRAILING: the qualifier sits AFTER the last enumerated limb, as freestanding text following the whole list. This is the classic last-antecedent problem -- English alone cannot tell you whether it modifies the final limb only or the whole series, and courts split on exactly this question. Quote the qualifier's own text exactly and set governs_path to the limb_path it immediately trails. Do NOT try to resolve which reading is correct. There is no scope_reading field for you to fill in: the system computes it deterministically from your position and quote, never from your opinion. If you nonetheless include a scope_reading value, it is discarded.

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
