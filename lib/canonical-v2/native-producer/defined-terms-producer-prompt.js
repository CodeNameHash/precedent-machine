'use strict';

const PROMPT_ID = 'native-producer-defined-terms/v1';
const PROMPT_VERSION = 1;

const ASSERTION_KINDS = Object.freeze([
  'ACQ_THRESHOLD',
  'SUPERIOR_THRESHOLD',
  'THRESHOLD_SUBSTITUTION',
  'SUPERIOR_QUALIFIER',
  'INTERVENING_DEFINITION',
  'INTERVENING_EXCLUSION',
  'KNOWLEDGE_STANDARD',
  'KNOWLEDGE_PERSON_SOURCE',
  'WILLFUL_DEFINITION',
  'WILLFUL_STANDARD',
]);

const CONTROLLED_VOCABULARIES = Object.freeze({
  assertion_kind: ASSERTION_KINDS,
  threshold_basis: Object.freeze(['EQUITY_SECURITIES', 'ASSETS', 'REVENUE_OR_EARNINGS']),
  qualifier_code: Object.freeze(['FINANCIAL_FAVORABILITY', 'CONSUMMATION_LIKELIHOOD']),
  exclusion_code: Object.freeze(['ACQUISITION_PROPOSAL_RECEIPT', 'STOCK_PRICE_CHANGE', 'NON_MAE_EFFECT']),
  knowledge_standard_code: Object.freeze(['ACTUAL', 'AFTER_INQUIRY', 'CONSTRUCTIVE']),
  knowledge_person_source_code: Object.freeze(['NAMED_INDIVIDUALS', 'SCHEDULE_REFERENCE', 'TITLE_CLASS']),
  knowledge_party: Object.freeze(['TARGET', 'BUYER']),
  willful_standard_code: Object.freeze(['ACTUAL', 'ACTUAL_OR_CONSTRUCTIVE']),
});

const RESPONSE_SHAPE = `{
  "defined_term_assertions": [{
    "section_reference": "verbatim section reference or null",
    "assertion_kind": "one controlled assertion kind",
    "definition_head_quote": "exact contiguous definition-head quote",
    "limb_quote": "exact contiguous fact-specific limb quote",
    "proposal_term_ref": null,
    "superior_term_ref": null,
    "substitution_from_percent": null,
    "substituted_term_ref": null,
    "host_term_ref": null,
    "threshold_basis": null,
    "qualifier_code": null,
    "event_term_ref": null,
    "exclusion_code": null,
    "knowledge_term_ref": null,
    "standard_code": null,
    "source_code": null,
    "knowledge_party": null,
    "named_persons": [],
    "breach_term_ref": null
  }],
  "open_world_candidates": [{
    "observed_quote": "exact contiguous source quote",
    "why_unmapped": "short explanation",
    "nearest_concept": null
  }]
}`;

const INSTRUCTIONS = `Extract only the governed key defined-term facts from one licensed merger-agreement scope.

EVIDENCE. definition_head_quote and limb_quote must each be exact contiguous substrings of SOURCE TEXT. The head identifies the defined term through "means" or "shall mean". The limb isolates the value, basis, party, qualifier, exclusion, or standard. They may be identical only for a self-contained fact.

SPLIT COMPOUND DEFINITIONS. Emit one assertion per threshold basis, Superior Proposal qualifier, Intervening Event exclusion, knowledge party, knowledge standard, person source, and Willful Breach standard. Shared facts keep the same definition_head_quote and use separate limb_quote values.

SUBSTITUTIONS. A changed-from, deemed-reference, or instead-reference percent construction is THRESHOLD_SUBSTITUTION. Never report either operand as an effective Superior Proposal threshold and never apply the substitution.

BOUNDARIES. The Material Adverse Effect definition belongs to another producer. Emit no assertion and no open-world candidate for it. Termination-fee amounts and triggers, no-shop procedure and day counts, burdensome-condition caps, and closing conditions also belong to other families.

NEVER ASSERT A NEGATIVE FROM SILENCE. Never emit an absent definition, NA knowledge standard, or absent exclusion.

PRESERVE THE NOVEL. All-or-substantially-all thresholds, uncertain kinds or codes, and any shape outside the controlled vocabulary go to open_world_candidates. Do not force a nearest fit.

Return only the JSON object described. No prose or markdown.`;

function buildDefinedTermsProducerPrompt({
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
    ? `DEFINED TERMS ALREADY RESOLVED:\n${knownDefinitions.map((item) => `- ${item.defined_term}`).join('\n')}\n`
    : '';
  return {
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: [{
      role: 'user',
      content: [
        INSTRUCTIONS,
        '',
        'CONTROLLED VOCABULARIES:',
        JSON.stringify(CONTROLLED_VOCABULARIES, null, 2),
        '',
        'RESPONSE SHAPE:',
        RESPONSE_SHAPE,
        '',
        definitionsBlock,
        'SOURCE TEXT:',
        sourceText,
      ].join('\n'),
    }],
  };
}

module.exports = {
  ASSERTION_KINDS,
  CONTROLLED_VOCABULARIES,
  INSTRUCTIONS,
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_SHAPE,
  buildDefinedTermsProducerPrompt,
};
