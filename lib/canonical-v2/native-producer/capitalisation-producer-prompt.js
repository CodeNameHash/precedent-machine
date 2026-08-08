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
 * first live run (docs/archive/handoffs/F28-FIRST-LIVE-RUN.md):
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
 *
 * PROMPT_VERSION 4 (this revision) is a controlled-vocabulary cleanup, ruled
 * by Ben 2026-08-01 (docs/superpowers/specs/2026-08-01-claim-identity-
 * provenance-design.md section 6). No structural or instruction change to
 * the response shape beyond the vocabulary itself and one clarifying
 * instruction. Five ACCURACY_STANDARD codes removed or merged, each for a
 * distinct reason -- none of them "we don't need it anymore":
 *
 *  - REMOVED `MAT_MATERIAL_INLINE` -- superseded by limb-attached THRESHOLD
 *    qualifiers, which carry richer data (quote, span, attachment) than a
 *    bare accuracy code ever could. The v1 taxonomy keeps the code; a future
 *    differential net maps v1 `MAT_MATERIAL_INLINE` to v2 limb-attached
 *    THRESHOLD.
 *  - REMOVED `MAT_MATERIALITY_SCRAPE` -- this is a bring-down property, not
 *    a rep-qualifier code. The bring-down structures already carry a scrape
 *    field (see `scrape_quote` on `bring_down_conditions[].tiers[]` below);
 *    duplicating it as an accuracy code invited two disagreeing sources of
 *    truth for the same fact.
 *  - REMOVED `MAT_NO_QUALIFIER` -- this is an absence assertion, and the
 *    producer NEVER asserts a negative (see EVIDENCE RULE and NEVER ASSERT A
 *    NEGATIVE below). Absence comes from code with a coverage proof (the
 *    reviewed-slice pattern), never from the model saying so.
 *  - REMOVED `MAT_MAE_AGGREGATE` -- "individually or in the aggregate" is a
 *    property OF a qualifier (does it aggregate across breaches?), not a
 *    separate accuracy standard in its own right. It is now captured as
 *    qualifier text on the MAE-qualified claim (`MAT_MAE_QUALIFIED`), never
 *    as its own code -- see AGGREGATION LANGUAGE below. Confirmed and
 *    extended to the V2 resolver by Ben's 2026-08-08 reversal (DECISIONS.md
 *    entry 14 / Step 2X-D), which supersedes the Stage 3 never-alias split
 *    that had briefly re-emitted this code from the qualifier-kind lexicon.
 *  - MERGED `MAT_DE_MINIMIS` into `MAT_ALL_RESPECTS_DE_MINIMIS` -- the two
 *    codes named the same legal concept (true-and-correct subject to a
 *    de-minimis carve-out) under two labels; one survives.
 *
 * Final five: `MAT_ALL_RESPECTS`, `MAT_ALL_RESPECTS_DE_MINIMIS`,
 * `MAT_ALL_MATERIAL`, `MAT_MATERIAL_TO_COMPANY`, `MAT_MAE_QUALIFIED`.
 * `KNOWLEDGE_STANDARD` and `QUALIFIER_POSITION` are unchanged.
 * `lib/taxonomy.js` (the v1 vocabulary) is untouched by design -- this
 * cleanup is scoped to the native producer's own controlled vocabulary.
 *
 * PROMPT_VERSION 3 fixed two defects exposed by the F28
 * second live run (docs/archive/handoffs/F28-SECOND-LIVE-RUN.md):
 *
 *  3. QUALIFIER DECOMPOSITION REGRESSED. PROMPT_VERSION 2's worked example
 *     showed qualifiers as a flat, representation-level list, but never said
 *     what to do when a qualifier's own words already sit inside a limb's
 *     assertion_quote (they usually do -- assertion_quote is verbatim, so it
 *     necessarily contains everything the limb's sentence says, qualifiers
 *     included). Run 2 read that silence as "the qualifier is already
 *     captured by the assertion_quote" and stopped emitting roughly ten of
 *     the twelve qualifiers run 1 had found -- temporal dates, threshold
 *     provisos, an accuracy tag -- leaving them as unstructured prose a
 *     downstream query can no longer filter, resolve, or triage separately.
 *     "EVERY QUALIFIER GETS ITS OWN OBJECT" below closes that gap explicitly,
 *     with a worked example showing the SAME text doing double duty: inside
 *     a limb's assertion_quote AND as its own qualifiers[] entry.
 *  4. QUALIFIER KIND WAS UNSTABLE RUN TO RUN. The identical limb (iv)
 *     materiality clause was coded ACCURACY/MAT_MATERIAL_INLINE in run 1 and
 *     THRESHOLD/null in run 2 -- two codings that route to completely
 *     different, incompatible downstream resolutions
 *     (candidate-resolution.js's GENERIC_CLAIM_KEY_RESOLUTION_TABLE is keyed
 *     on qualifier_kind). THRESHOLD is the correct reading (docs/CODEX-
 *     PROGRAM.md's target semantics: "Limb (iv) separately contains a
 *     substantive threshold"), but the prompt never explained WHY, so the
 *     model had nothing to discriminate on beyond a bare enum label.
 *     "QUALIFIER KIND" below gives the legal test (HOW TRUE vs WHAT FALLS
 *     WITHIN SCOPE) and anchors it to this exact clause.
 */

'use strict';

const PROMPT_ID = 'CAPITALISATION_REPRESENTATION_PRODUCER';
// PROMPT_VERSION 5 (P1 cap-table numeric promotions, docs/superpowers/specs/
// 2026-08-02-p1-captable-numerics-design.md section 3): adds the
// `share_count_assertions` response array so a share/pool count that used to
// be reachable only by re-parsing an open-world limb assertion's prose is
// now a separately-typed, separately-quoted proposal the resolver can
// actually govern. PRESERVE THE NOVEL is unchanged; the new instruction
// narrows what qualifies for this new array without ever forcing a doubtful
// count into it -- "when unsure of count_kind, keep it in
// open_world_candidates" (see SHARE COUNTS below).
const PROMPT_VERSION = 5;

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
    MAT_MAE_QUALIFIED: 'True except where failure would not have an MAE',
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
          "kind": "ACCURACY | KNOWLEDGE | THRESHOLD | TEMPORAL -- see QUALIFIER KIND in the instructions: ACCURACY bounds how true the statement must be, THRESHOLD bounds what the statement is about",
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
  ],
  "share_count_assertions": [
    {
      "section_reference": "<verbatim section number as printed, e.g. '3.1(b)(i)'>",
      "party_making": "<verbatim party name as the agreement names it -- the party whose capitalization this count describes>",
      "count_kind": "AUTHORIZED | ISSUED_OUTSTANDING | RESERVED | TREASURY | OUTSTANDING_AWARDS -- see SHARE COUNTS below. If none of these five fits, do not use this array -- raise an open_world_candidates entry instead",
      "share_class": "<verbatim class phrase exactly as printed, e.g. 'Company Class A Common Stock' or 'preferred stock, par value $0.01 per share'>",
      "plan": "<verbatim plan phrase, e.g. 'the Company ESPP' -- REQUIRED when count_kind is RESERVED, otherwise null>",
      "quote": "<verbatim text containing exactly ONE share/pool count number and nothing else you would also need to quote separately -- see SHARE COUNTS below>",
      "limb_path": "<the limb_path array (see limbs[].limb_path) this count sits inside, or null if it is not inside any enumerated limb>"
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

EVERY QUALIFIER GETS ITS OWN OBJECT -- NEVER LEAVE ONE BURIED INSIDE assertion_quote. A limb's assertion_quote is the complete verbatim text of that limb, so as a matter of plain grammar it will often CONTAIN a qualifier's own words -- a date, a materiality proviso, a knowledge standard, an accuracy tag sitting right inside the sentence you are quoting. That is expected and correct: assertion_quote must stay verbatim and complete, so you do not strip the qualifier out of it. What is NOT correct is stopping there. EVERY qualifier that appears ANYWHERE in the representation -- including one whose words already sit inside a limb's own assertion_quote -- must ALSO be emitted as its own separate entry in the qualifiers array, with its own verbatim quote and an attachment pointing at the limb it sits inside. A qualifier you can find only by re-reading an assertion_quote, and that has no matching qualifiers[] entry of its own, is an EXTRACTION MISS: the downstream system can only filter, resolve, and route a qualifier it was separately given -- one it has to go re-parse out of prose is invisible to it.

WORKED EXAMPLE -- a limb-internal qualifier still gets its own object. Source text: "(iv)...Neither the Company nor any of its Subsidiaries owns beneficially or of record any shares of capital stock or other Company Equity Rights in any other Person that is not a Subsidiary of the Company with a fair market value that is material to the Company and its Subsidiaries, taken as a whole. Except as set forth above, ..." CORRECT -- BOTH of these are emitted, not just the first:
  limbs: [{ "limb_path": ["(iv)"], "assertion_quote": "Neither the Company nor any of its Subsidiaries owns beneficially or of record any shares of capital stock or other Company Equity Rights in any other Person that is not a Subsidiary of the Company with a fair market value that is material to the Company and its Subsidiaries, taken as a whole.", "subject": "no beneficial ownership of equity interests in non-Subsidiary persons" }]
  qualifiers: [{ "kind": "THRESHOLD", "code": null, "quote": "with a fair market value that is material to the Company and its Subsidiaries, taken as a whole", "attachment": { "position": "ITEM", "governs_path": ["(iv)"], "ambiguity_signals": { "items_grammatically_parallel": false } } }]
Notice the qualifier's quote is a literal substring of the limb's own assertion_quote -- that overlap is correct, not redundant. WRONG: emitting the limb's assertion_quote alone and treating the materiality language as already "captured" because it happens to appear inside that quote. It is not captured until it also has its own qualifiers[] entry. Apply this to every qualifying phrase in your scope -- temporal dates ("as of the date hereof", "since December 31, 2025"), threshold provisos, knowledge standards, accuracy tags -- not just the one shown here.

QUALIFIER KIND -- THE FOUR KINDS ARE A LEGAL DISTINCTION, NOT A LABEL YOU EYEBALL. Choose kind by asking what the clause actually does, not by pattern-matching the word "material":
  - ACCURACY qualifies HOW TRUE the statement must be -- it sets the STANDARD OF ACCURACY the assertion itself must meet. Markers: "in all material respects", "except for de minimis inaccuracies", "true and correct in all respects".
  - THRESHOLD qualifies WHAT FALLS WITHIN the statement's scope -- it draws the BOUNDARY of what is being asserted about, not how accurately it is asserted. Markers: "with a fair market value that is material to...", "in excess of $X", "other than immaterial contracts".
  - KNOWLEDGE qualifies WHOSE AWARENESS bounds the assertion. Marker: "to the Knowledge of the Company".
  - TEMPORAL qualifies WHEN the assertion speaks. Markers: "as of the date hereof", "since December 31, 2025".
  WORKED THRESHOLD EXAMPLE (the anchor for this distinction -- get this one right and the rule generalises): "...any other Person that is not a Subsidiary of the Company with a fair market value that is material to the Company and its Subsidiaries, taken as a whole" is THRESHOLD, not ACCURACY. The clause is not saying "this statement about equity holdings is true in all material respects" (that would be ACCURACY); it is saying "this statement is only ABOUT holdings above a materiality threshold -- smaller holdings are simply outside its scope" (that is THRESHOLD). The word "material" appearing in a clause does not make it ACCURACY. Ask: does the clause limit HOW ACCURATE the assertion must be, or does it limit WHAT THE ASSERTION IS ABOUT? A materiality phrase bolted onto a specific holding, dollar amount, or defined concept (rather than onto the representation's own truthfulness) is almost always THRESHOLD.

AGGREGATION LANGUAGE. "Individually or in the aggregate" (and equivalent phrasing) is qualifier TEXT, never a code of its own. Where it appears alongside an MAE-qualified accuracy standard, quote it as part of that qualifier's own quote and code it MAT_MAE_QUALIFIED -- do not invent or reach for a separate aggregate-specific code. There is none in the controlled vocabulary.

SEPARATE OBJECTS STAY SEPARATE. One section may contain several distinct legal objects: a representation, a definition nested inside it, a cross-reference to a disclosure schedule. Emit each as its own item. Do not collapse them into one summary. Two reciprocal obligations are two objects, not one mutual object.

BRING-DOWN TIERS ARE PER-SCOPE, NOT PER-AGREEMENT. A closing condition commonly applies different accuracy standards to different groups of representations. Emit one tier per standard, each carrying the verbatim scope expression that defines which representations it covers. If the scope expression names specific limbs, list them; if it describes them generally, leave covered_limb_references empty rather than guessing the expansion.

PRESERVE THE NOVEL. If the text asserts something you cannot express in the shape above without distorting it, do not force it into the nearest available field. Put it in open_world_candidates with the verbatim text and say what it resembles. A novel proposition preserved honestly is valuable; a novel proposition crammed into a familiar code is a silent error.

SHARE COUNTS -- ONE NUMBER, ONE ASSERTION, ONE OF FIVE KINDS. A capitalization representation is full of share and pool counts: authorized capital, issued and outstanding shares, reserved pools, treasury shares, and outstanding equity awards. Each one that fits ONE of exactly five count_kind values -- AUTHORIZED, ISSUED_OUTSTANDING, RESERVED, TREASURY, OUTSTANDING_AWARDS -- gets its own share_count_assertions entry. A count that does not obviously fit one of these five is NOT force-fit: raise it as an open_world_candidate instead, with your best guess at nearest_concept. When you are unsure which of the five applies, prefer open_world_candidates over guessing -- promotion into this array narrows what gets governed, it never forces a doubtful reading into a controlled kind.

ONE NUMBER PER QUOTE. Your quote field for a share_count_assertions entry must contain exactly the ONE number the assertion is about -- never a compound sentence naming two counts at once. Source text often states an authorized count and an outstanding count in the same sentence ("250,000,000 shares, of which 28,142,327 were outstanding"): that is TWO assertions, not one, and each gets its own share_count_assertions entry with its own quote, even though the quotes may overlap or sit adjacent to each other in the source. Do not quote the whole compound sentence for either one.

RESERVED NEEDS A PLAN. A RESERVED count_kind assertion must name the plan it reserves shares under (e.g. "the Company ESPP", "the A&R 2015 Plan") in the plan field, verbatim from the text. If the text reserves shares but does not identify a specific plan, this is exactly the doubtful case above: raise it as open_world_candidates instead of guessing a plan name or leaving plan null on a RESERVED entry.

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
