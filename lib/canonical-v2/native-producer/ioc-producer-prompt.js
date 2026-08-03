'use strict';

const PROMPT_ID = 'native-producer-interim-operating/v2';
const IOC_PROMPT_VERSION = 2;

const RESTRICTION_CATEGORIES = Object.freeze([
  'MERGE',
  'CONTRACT',
  'COMP',
  'DEBT',
  'TAX',
  'CHARTER',
  'ISSUE',
  'ACCOUNTING',
  'SETTLE',
  'DIVIDEND',
  'CAPEX',
]);

const RESPONSE_SHAPE = `{
  "ioc_restriction_assertions": [
    {
      "section_reference": "<verbatim section number>",
      "assertion_kind": "RESTRICTION_PRESENT",
      "restriction_category": "MERGE | CONTRACT | COMP | DEBT | TAX | CHARTER | ISSUE | ACCOUNTING | SETTLE | DIVIDEND | CAPEX",
      "threshold_basis": null,
      "quote": "<smallest exact contiguous source span carrying one governed restriction>"
    }
  ],
  "ioc_mechanics": [
    {
      "surface": "AFFIRMATIVE_COVENANT | LONG_TAIL_RESTRICTION | CONSENT_OR_EFFORTS_STANDARD | EXCEPTION | THRESHOLD_OR_NOTICE_WINDOW",
      "quote": "<one complete verbatim mechanism>",
      "detail": "<short factual description; do not calculate or classify>"
    }
  ],
  "open_world_candidates": [
    {
      "observed_quote": "<verbatim source text>",
      "why_unmapped": "<why no controlled category fits>",
      "nearest_concept": "<nearest controlled category or null>"
    }
  ]
}`;

const INSTRUCTIONS = `You are a senior M&A lawyer extracting interim operating covenants for review.

EVIDENCE. Copy every quote character-for-character from the supplied source. Use a contiguous span. Never paraphrase, normalise, join spans, or insert ellipses.

POSITIVES ONLY. Never assert that a restriction is absent, inapplicable, permitted, or unrestricted. Carve-outs remain part of the quoted evidence. They are not negative claims.

GOVERNED RESTRICTIONS. Emit one RESTRICTION_PRESENT assertion for each listed category that the quote itself supports. Split a limb that contains several governed categories. Do not emit threshold or other numeric assertions.

EVIDENCE-ONLY MECHANICS. Capture affirmative covenants, long-tail restrictions, consent or efforts standards, exceptions, thresholds, percentages, ratios, salary gates, per-unit rates, day counts and notice windows in ioc_mechanics. Surface labels route evidence only. They are not legal codes. Do not calculate, classify or promote these mechanisms.

QUOTE THE RESTRICTION LIMB, NOT ITS CHAPEAU. A heading or general undertaking is not category evidence. Quote the smallest limb that contains the operative restriction words.

CONTROLLED CATEGORIES. Do not force loans or investments, affirmative obligations, preambles, general exceptions, consent standards, numeric mechanics, notice windows, or another novel shape into the nearest restriction category. Preserve these items in ioc_mechanics or open_world_candidates.

SIDE. Do not infer or emit target or buyer side. The parent-section chapeau supplies the governed party. Never use legacy mutual party scope.

Return only the JSON object described. No prose or markdown fences.`;

function buildIocProducerPrompt({
  source_text: sourceText,
  governed_scope: governedScope,
  known_definitions: knownDefinitions = [],
} = {}) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    throw new TypeError('source_text must be a non-empty string');
  }
  if (!governedScope || typeof governedScope !== 'object' || Array.isArray(governedScope)) {
    throw new TypeError('governed_scope must be an object');
  }
  if (!Array.isArray(knownDefinitions)) {
    throw new TypeError('known_definitions must be an array');
  }

  const definitions = knownDefinitions.length === 0
    ? ''
    : `KNOWN DEFINITIONS:\n${knownDefinitions.map((definition) => `- ${definition.defined_term}`).join('\n')}\n\n`;
  return Object.freeze({
    prompt_id: PROMPT_ID,
    prompt_version: IOC_PROMPT_VERSION,
    messages: Object.freeze([Object.freeze({
      role: 'user',
      content: [
        INSTRUCTIONS,
        '',
        `RESTRICTION CATEGORIES: ${RESTRICTION_CATEGORIES.join(', ')}`,
        '',
        'RESPONSE SHAPE:',
        RESPONSE_SHAPE,
        '',
        definitions,
        'SOURCE TEXT:',
        sourceText,
      ].join('\n'),
    })]),
  });
}

module.exports = Object.freeze({
  PROMPT_ID,
  IOC_PROMPT_VERSION,
  RESTRICTION_CATEGORIES,
  RESPONSE_SHAPE,
  INSTRUCTIONS,
  buildIocProducerPrompt,
});
