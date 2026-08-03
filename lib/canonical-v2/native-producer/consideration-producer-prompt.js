'use strict';

const PROMPT_ID = 'native-producer-consideration/v1';
const PROMPT_VERSION = 1;

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

APPRAISAL_STATUS. Emit AVAILABLE only for quoted statutory, dissenting-share, or Dissenter Rights language. Emit NOT_AVAILABLE only for an express quoted no-availability sentence. statute is optional and verbatim when present.

PRESERVE THE NOVEL. CVRs, collars, ticking fees, election forms, proration formulae, equity-award treatment, dividend equivalence, withholding, exchange plumbing, anti-dilution adjustment, and ratio type stay in open_world_candidates. Do not force them into the three controlled kinds.

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
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_SHAPE,
  buildConsiderationProducerPrompt,
};
