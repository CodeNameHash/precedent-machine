'use strict';

const PROMPT_ID = 'native-producer-consideration/v1';
const PROMPT_VERSION = 2;

const OBSERVED_MECHANIC_SURFACES = Object.freeze([
  'CVR',
  'ELECTION_ALTERNATIVE',
  'ELECTION_ALLOCATION',
  'ELECTION_DEFAULT',
  'ELECTION_DEADLINE',
  'PRORATION_FORMULA',
  'EQUITY_AWARD_TREATMENT',
  'COLLAR_WALKAWAY_TICKING',
  'WITHHOLDING',
  'EXCHANGE_MECHANICS',
]);

// These fields describe an election without turning its allocation into a
// computed result.  They are evidence fields.  In particular, no CVR
// agreement is represented here: the merger agreement can establish the
// right without supplying the separate agreement's terms.
const ELECTION_MECHANIC_FIELDS = Object.freeze([
  'alternatives', 'election_choice', 'cash_alternatives', 'stock_alternatives',
  'default_treatment', 'cash_cap', 'equity_cap',
  'proration_numerator', 'proration_denominator',
]);

const CONTROLLED_VOCABULARIES = Object.freeze({
  assertion_kind: Object.freeze(['PER_SHARE_CASH', 'EXCHANGE_RATIO', 'APPRAISAL_STATUS']),
  appraisal_status: Object.freeze(['AVAILABLE', 'NOT_AVAILABLE']),
});

const RESPONSE_SHAPE = `{
  "consideration_assertions": [{
    "section_reference": "verbatim section reference or null",
    "assertion_kind": "PER_SHARE_CASH | EXCHANGE_RATIO | APPRAISAL_STATUS",
    "consideration_term": "verbatim defined term or null",
    "ratio_term": "verbatim defined term or null",
    "issuer_stock": "verbatim stock phrase or null",
    "appraisal_status": "AVAILABLE | NOT_AVAILABLE | null",
    "statute": "verbatim statute citation or null",
    "quote": "smallest exact contiguous source quote"
  }],
  "consideration_mechanics": [{
    "surface": "CVR | ELECTION_ALTERNATIVE | ELECTION_ALLOCATION | ELECTION_DEFAULT | ELECTION_DEADLINE | PRORATION_FORMULA | EQUITY_AWARD_TREATMENT | COLLAR_WALKAWAY_TICKING | WITHHOLDING | EXCHANGE_MECHANICS",
    "quote": "one exact contiguous proposition",
    "detail": "short factual description without calculation",
    "alternatives": ["exact election alternative quote"],
    "election_choice": "exact election-choice quote or null",
    "cash_alternatives": ["exact cash alternative quote"],
    "stock_alternatives": ["exact stock alternative quote"],
    "default_treatment": "exact default-treatment quote or null",
    "cash_cap": "exact cash-cap quote or null",
    "equity_cap": "exact equity-cap quote or null",
    "proration_numerator": "exact numerator-operand quote or null",
    "proration_denominator": "exact denominator-operand quote or null"
  }],
  "open_world_candidates": [{
    "observed_quote": "exact contiguous source quote",
    "why_unmapped": "short explanation",
    "nearest_concept": null
  }]
}`;

const INSTRUCTIONS = `You extract consideration and exchange mechanics from one licensed merger-agreement scope.

EVIDENCE. Every quote must be copied character-for-character from SOURCE TEXT. Never normalise, join with ellipses, or repair text.

NEVER ASSERT A NEGATIVE FROM SILENCE. APPRAISAL_STATUS NOT_AVAILABLE is allowed only when the quote itself says no appraisal or dissenters' rights are available. Silence produces no assertion.

PER_SHARE_CASH. Emit one assertion per cash leg. consideration_term must be the verbatim defined term naming that payment. A mixed cash-and-stock sentence may support both a cash and ratio assertion with the same quote. An election clause with multiple cash values must be split into one narrow quote per cash leg.

EXCHANGE_RATIO. ratio_term and issuer_stock are required verbatim phrases. Never treat Merger Sub or Surviving Corporation internal share conversion as merger consideration. Never emit fixed or floating ratio type.

APPRAISAL_STATUS. Emit AVAILABLE by necessary implication only when the same quote identifies an appraisal statute, such as Section 262 of the DGCL. statute is then required and must be the exact statute phrase from the quote. Dissenting-share or Dissenter Rights wording without an identified statute stays in open_world_candidates. Emit NOT_AVAILABLE only for an express quoted no-availability sentence.

PRESERVE THE NOVEL. Capture every CVR, election alternative, allocation rule, default treatment, election deadline, proration formula, equity-award treatment, collar, ticking fee, withholding rule and exchange mechanic in consideration_mechanics. Keep each exact proposition separate. For an election, populate only the exact choice, cash alternative, stock alternative, default, cap and numerator/denominator operands that appear in the same quote. Do not calculate an allocation or a formula, resolve a separate CVR Agreement, or add a CVR-agreement component. Use open_world_candidates for novel shapes outside the observed surface list.

Return only the JSON object described. No prose or markdown.`;

function buildConsiderationProducerPrompt({
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
  CONTROLLED_VOCABULARIES,
  INSTRUCTIONS,
  OBSERVED_MECHANIC_SURFACES,
  ELECTION_MECHANIC_FIELDS,
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_SHAPE,
  buildConsiderationProducerPrompt,
};
