'use strict';

// The first native representations slice owns only positive, clause-level
// accuracy and knowledge qualifiers. It deliberately does not classify a
// representation's commercial subject or infer a negative from silence.
const PROMPT_ID = 'native-producer-representations/v1';
const PROMPT_VERSION = 1;

const CONTROLLED_VOCABULARIES = Object.freeze({
  ACCURACY_STANDARD: Object.freeze({
    MAT_ALL_RESPECTS: 'True and correct in all respects',
    MAT_ALL_RESPECTS_DE_MINIMIS: 'True except for de minimis inaccuracies',
    MAT_ALL_MATERIAL: 'In all material respects',
    MAT_MATERIAL_TO_COMPANY: 'Materiality to the Company',
    MAT_MAE_QUALIFIED: 'True except where failure would not have a Material Adverse Effect',
  }),
  KNOWLEDGE_STANDARD: Object.freeze({
    ACTUAL: 'Actual knowledge',
    CONSTRUCTIVE: 'Constructive knowledge',
    AFTER_INQUIRY: 'Knowledge after reasonable inquiry',
  }),
  QUALIFIER_POSITION: Object.freeze({
    CHAPEAU: 'Before the representation limbs',
    ITEM: 'Inside one representation limb',
    TRAILING: 'After the representation limbs',
  }),
});

// This response shape intentionally matches the established representation
// shaper. That lets the existing governed claim definitions for accuracy and
// knowledge qualifiers apply to both Company and Parent representations.
const RESPONSE_SHAPE = `{
  "representation_instances": [{
    "section_reference": "<verbatim printed reference>",
    "party_making": "<verbatim party name>",
    "chapeau_quote": "<verbatim opening words, or null>",
    "limbs": [{ "limb_path": ["<verbatim label>"], "assertion_quote": "<verbatim representation limb>", "subject": "<short description>" }],
    "qualifiers": [{
      "kind": "ACCURACY | KNOWLEDGE | THRESHOLD | TEMPORAL",
      "code": "<controlled code or null>",
      "quote": "<verbatim qualifier>",
      "attachment": { "position": "CHAPEAU | ITEM | TRAILING", "governs_path": ["<limb label>"] | null, "ambiguity_signals": { "items_grammatically_parallel": true } }
    }],
    "definition_uses": [],
    "cross_references": []
  }],
  "bring_down_conditions": [],
  "open_world_candidates": [{ "observed_quote": "<verbatim text>", "why_unmapped": "<why this first slice cannot express it>", "nearest_concept": "<existing concept or null>" }]
}`;

const INSTRUCTIONS = `You are a senior M&A lawyer reading one complete, admitted representations-and-warranties section. Produce proposed extractions only.

EVIDENCE. Every quote must be copied character-for-character from the source. Never summarise, normalise, or use ellipses. Never assert that a qualifier, representation, or exception is absent.

SCOPE. This first slice captures only positive clause-level accuracy and knowledge qualifiers for Company/Target and Parent/Buyer representations. Emit one representation_instances object for each representation clause that contains a qualifier. A representation with no qualifier is not an absence finding and must not be emitted merely to say it is unqualified.

ACCURACY. Use a controlled ACCURACY_STANDARD code only when the words state how true or correct the representation must be. Do not code a substantive use of “material” that limits the subject matter. Put that in a THRESHOLD qualifier with code null. Preserve aggregation language in the quote, but do not invent a separate code for it.

KNOWLEDGE. Use ACTUAL, CONSTRUCTIVE, or AFTER_INQUIRY only when the text supports that standard. If a knowledge phrase does not fit, emit a KNOWLEDGE qualifier with code null or preserve it as open world.

ATTACHMENT. Report position only. Do not decide legal scope. CHAPEAU is before the limbs, ITEM is within one limb, and TRAILING is after the limbs. Every qualifier needs its own object even if its words are also inside assertion_quote.

OPEN WORLD. Preserve SEC-filings and disclosure-letter carve-outs, materiality scrapes, lookbacks, subject taxonomy, representation-specific commercial terms, and any uncertain proposition in open_world_candidates. Do not force them into an accuracy or knowledge code.

Return only the JSON object described. No prose or markdown fences.`;

function buildRepresentationsProducerPrompt({
  source_text: sourceText,
  governed_scope: governedScope,
  known_definitions: knownDefinitions = [],
} = {}) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    throw new TypeError('source_text must be a non-empty string');
  }
  if (!governedScope || typeof governedScope !== 'object') {
    throw new TypeError('governed_scope must be an object');
  }
  const definitionsBlock = knownDefinitions.length
    ? `DEFINED TERMS ALREADY RESOLVED:\n${knownDefinitions.map((item) => `- ${item.defined_term}`).join('\n')}\n\n`
    : '';
  return {
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: [{ role: 'user', content: [
      INSTRUCTIONS,
      '',
      'CONTROLLED VOCABULARIES:',
      JSON.stringify(CONTROLLED_VOCABULARIES, null, 2),
      '',
      'RESPONSE SHAPE:',
      RESPONSE_SHAPE,
      '',
      definitionsBlock,
      'SOURCE TEXT (the complete scope you may examine):',
      sourceText,
    ].join('\n') }],
  };
}

module.exports = {
  PROMPT_ID,
  PROMPT_VERSION,
  CONTROLLED_VOCABULARIES,
  RESPONSE_SHAPE,
  INSTRUCTIONS,
  buildRepresentationsProducerPrompt,
};
