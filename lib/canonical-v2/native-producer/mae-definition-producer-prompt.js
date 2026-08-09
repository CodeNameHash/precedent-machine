/**
 * lib/canonical-v2/native-producer/mae-definition-producer-prompt.js
 *
 * The extraction prompt for the MAE-definition family (docs/superpowers/
 * specs/2026-08-02-family-mae-definition-design.md, section 3 --
 * AUDIT-AMENDED). Registered in producer-prompt-registry.js under the
 * `MAE_DEFINITION` section family -- capitalisation-producer-prompt.js,
 * termination-fee-producer-prompt.js and no-shop-producer-prompt.js are NOT
 * edited by this module: their own PROMPT_VERSIONs do not move, and their
 * recorded fixtures replay byte-identically (mirrors all three modules'
 * own file-header precedent).
 *
 * SAME ARCHITECTURAL CONSTRAINTS AS THE OTHER PRODUCER PROMPTS (see their
 * own headers and EXECUTION-LEDGER M3 semantics):
 *
 *  - The producer NEVER asserts a negative (M3 rule 1, restated below).
 *  - Every value that is not a controlled code carries a verbatim quote,
 *    byte-verified after the response returns.
 *  - A novel proposition is preserved as an open-world candidate, never
 *    forced onto the nearest known concept.
 *
 * NO SELF-CONTAINMENT PROVER (spec Deliverable, the family-defining honesty
 * pin, "M3, stated first because everything downstream obeys it"). This
 * prompt does not attempt to detect nested/cross-referenced definitions --
 * that is legal judgment, not mechanics -- but its cross-reference rule
 * below keeps a MENTION of an MAE term (as opposed to a section that
 * DEFINES one) out of the typed path entirely, routing it to open world.
 *
 * CONTROLLED VOCABULARY IS THE REGISTRY'S, SINGLE-SOURCED (spec section 1:
 * "export it ... drift between prompt vocabulary and registry gate must be
 * loud"): `MAE_CARVEOUT_CODES_V2` is imported directly from
 * contract-bundle.js (already exported there) rather than hand-copied as a
 * frozen literal -- mirrors no-shop-producer-prompt.js's own precedent, not
 * the capitalisation/termination-fee modules' hand-carried
 * CONTROLLED_VOCABULARIES blocks.
 */

'use strict';

const { MAE_CARVEOUT_CODES_V2 } = require('../contract-bundle');

const PROMPT_ID = 'mae-definition-producer/v3';
const PROMPT_VERSION = 3;

const CONTROLLED_VOCABULARIES = Object.freeze({
  MAE_CARVEOUT_CODE: Object.freeze(MAE_CARVEOUT_CODES_V2),
  MAE_DEFINITION_PRONG_CODE: Object.freeze(['BUSINESS_EFFECTS', 'CONSUMMATION_PREVENTION']),
});

/**
 * The response contract (spec section 3): top-level arrays keyed by
 * `mae_definition_instances`, one per defined term per governing section
 * (the capitalisation one-instance-per-section rule, keyed by defined term
 * because two MAE terms legitimately share a definitions section -- Modiv,
 * Metsera), each carrying four nested lists (prong / carveout / limb-local
 * disproportionality / trailing-general disproportionality assertions), plus
 * the shared `open_world_candidates`.
 */
const RESPONSE_SHAPE = `{
  "mae_definition_instances": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '1.1(g)' or '3.1(d)(iii)'>",
      "defined_term": "<verbatim defined term, e.g. 'Company Material Adverse Effect'>",
      "definition_subject": "<verbatim party phrase the definition attaches to, e.g. 'the Company', 'Parent', 'any Party'>",
      "limbs": [
        {
          "limb_path": ["<ordered verbatim label array from the definition root, e.g. ['(i)']>"],
          "assertion_quote": "<verbatim text of this definition limb>",
          "subject": "<short description of what this limb states>"
        }
      ],
      "prong_assertions": [
        {
          "prong_code": "BUSINESS_EFFECTS | CONSUMMATION_PREVENTION -- see PRONG CODE below",
          "prong_label": "<verbatim limb label as printed, e.g. '(i)', '(a)', or null if this is a one-prong definition with no label>",
          "quote": "<verbatim text of this single prong>",
          "limb_path": ["<ordered verbatim label array from the definition root, e.g. ['(i)']>"]
        }
      ],
      "carveout_assertions": [
        {
          "carveout_code": "<one MAE_CARVEOUT_CODE from the controlled vocabulary, or null if none fits -- see CARVEOUT CODE below>",
          "clause_label": "<verbatim enumeration label of this carve-out limb, e.g. '(A)', '(vii)', '(k)'>",
          "quote": "<verbatim text of this single carve-out clause -- narrow to the clause naming only the single code you are coding when a clause matches two codes>",
          "limb_path": ["<ordered verbatim label array from the definition root, e.g. ['(vii)']>"]
        }
      ],
      "limb_local_disproportionality_assertions": [
        {
          "clause_label": "<the single verbatim clause label whose own text contains this carveback, e.g. '(A)'>",
          "comparison_baseline_phrase": "<verbatim comparison class in this limb-local carveback>",
          "incremental_impact_phrase": "<verbatim incremental-impact phrase if present, or null>",
          "quote": "<verbatim text of this single carve-out clause, including its limb-local disproportionality wording>",
          "limb_path": ["<ordered verbatim label array from the definition root, e.g. ['(A)']>"]
        }
      ],
      "disproportionality_assertions": [
        {
          "applies_to_clause_labels": ["<verbatim clause labels this carveback claws back, e.g. '(i)', '(ii)'>"],
          "comparison_baseline_phrase": "<verbatim comparison class, e.g. 'other companies of a similar size operating in the industries in which the Company Group conducts business'>",
          "incremental_impact_phrase": "<verbatim incremental-impact phrase if present, e.g. 'only the incremental disproportionate adverse impact may be taken into account', or null if absent>",
          "quote": "<verbatim text of the disproportionality proviso>"
        }
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

const INSTRUCTIONS = `You are a senior M&A lawyer reading a merger agreement's Material Adverse Effect / Material Adverse Change definition (and its carve-outs and disproportionality carveback, if any). You are producing PROPOSED extractions for review. Nothing you output is published without human review, and a confident wrong answer is far worse than an honest omission.

EVIDENCE RULE. Every quote field must be copied character-for-character from the source text you were given. Quotes are verified byte-for-byte against the source after you respond; a quote that does not reproduce exactly is discarded and the proposal with it. Never normalise, summarise, join with ellipses, or "clean up" a quote.

NEVER ASSERT A NEGATIVE. Do not report that a carve-out is NOT present, that a carveback does NOT apply to a clause, or that a definition LACKS a prong. Report only what IS present, with evidence. ABSENT is derived downstream, never asserted here.

ONLY A DEFINITION, NEVER A MENTION. A sentence that USES or MINTS an MAE term by cross-reference -- "would not reasonably be expected to have ... a Material Adverse Effect on the Company (a "Company Material Adverse Effect")" -- is NOT a definition instance. Emit an open_world_candidates entry for it instead. Only the section that states what the term MEANS ("'X' means ...") is a definition instance.

ONE INSTANCE PER DEFINED TERM PER GOVERNING SECTION. If a section defines two different MAE terms (e.g. both "Company Material Adverse Effect" and "Parent Material Adverse Effect" in one Definitions article), emit two separate mae_definition_instances entries -- never merge them, even though they may share drafting language.

DEFINITION LIMBS. Emit one limbs[] entry per enumerated or labelled clause in the definition body, with limb_path and assertion_quote mirroring the capitalisation/representations limb shape. Prong, carve-out and disproportionality assertions remain separate typed arrays; limbs capture the structural definition text for component-tree minting downstream.

PRONG CODE -- ONE PER LIMB. A definition's chapeau sentence may state one or two prongs: a BUSINESS_EFFECTS prong (harm to the business/condition/results of operations, usually "taken as a whole") and/or a CONSUMMATION_PREVENTION prong (prevention or material delay/impairment of the ability to consummate the transaction). Emit one prong_assertions entry per prong actually present, quoting only that prong's own text. A one-prong definition emits exactly one assertion -- never infer or assert that a second prong is absent, and never count or label a definition as "one-prong"/"two-prong" yourself; simply report what you observe.

CARVEOUT CODE -- ONE PER (CLAUSE, CODE) PAIR. Each enumerated exception clause is a limb; narrow the quote to the single clause you are coding. If a single clause legitimately matches TWO carve-out codes (the classic case: a clause naming both natural disasters AND pandemics/epidemics), emit TWO carveout_assertions entries, each with its own carveout_code, sharing the same clause_label and limb_path. When no listed carveout_code fits the clause, or you are unsure, set carveout_code to null and still emit the assertion (do NOT silently drop it) -- OR, if the whole clause resembles nothing in this shape at all, use open_world_candidates instead. Promotion narrows novelty, never forces fit. Known-novel shapes that belong in open_world_candidates, not forced onto the nearest code: cybersecurity/ransomware/data-breach carve-outs, carve-outs whose substance is incorporated by reference to an external Disclosure Letter section (the clause label is quotable but its content is not in this document), analyst-recommendation/credit-rating clauses, and any carve-out drafted around a quantified dollar or percentage MAE threshold.

DISPROPORTIONALITY CARVEBACK -- PRESERVE WHICH OF TWO SOURCE FORMS THE AGREEMENT USES. A limb-local carveback sits inside one carve-out limb, for example TopBuild clause (A): "except to the extent such changes or developments have a disproportionate effect ... relative to others in the industry". Emit one limb_local_disproportionality_assertions object for that limb. clause_label identifies exactly one limb and limb_path preserves its location. Do not repeat the same local object when one limb carries two carveout_code assertions.

A general trailing carveback is one proviso that names several covered limbs, for example "in the case of the foregoing clauses (a), (b), (c) ...". Emit that form in disproportionality_assertions and preserve the complete applies_to_clause_labels list. Do not convert a group of limb-local clauses into a synthetic trailing list. Do not split a true trailing list into invented limb-local quotes.

For BOTH source forms, emit a separate disproportionality assertion even when its words overlap a carve-out assertion. comparison_baseline_phrase is REQUIRED and must be copied verbatim. incremental_impact_phrase is OPTIONAL: include it only when the drafting expressly limits the carveback to the incremental disproportionate impact; set it to null when that limitation is absent. Never infer an absent limitation.

CROSS-REFERENCE RULE, RESTATED. If a clause you are about to code as a carve-out or a disproportionality proviso is itself only a MENTION of the MAE term (rather than part of the definition's own text), do not code it here -- use open_world_candidates.

CONTROLLED CODES ONLY. Where a field takes a code (prong_code, carveout_code), use one from the supplied vocabularies exactly, or null (carveout_code only -- prong_code has no null: if you cannot tell which prong a quote states, do not guess -- use open_world_candidates instead). Never invent a code.

Return only the JSON object described. No prose, no markdown fences.`;

/**
 * Builds the prompt for one governed scope (an MAE-definition-bearing
 * section: a Definitions article clause, or an inline "means ..." sentence
 * nested in a representation). Same contract as the sibling producer
 * prompts: the caller supplies the exact admitted text and the scope that
 * licenses examining it; this function does not read files, call models,
 * or decide anything about the result.
 *
 * @param {object} args
 * @param {string} args.source_text        exact admitted text for the governed scope
 * @param {object} args.governed_scope     what the producer is licensed to examine
 * @param {Array}  [args.known_definitions] defined terms already resolved upstream
 * @returns {{prompt_id: string, prompt_version: number, messages: Array}}
 */
function buildMaeDefinitionProducerPrompt({
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
  buildMaeDefinitionProducerPrompt,
};
