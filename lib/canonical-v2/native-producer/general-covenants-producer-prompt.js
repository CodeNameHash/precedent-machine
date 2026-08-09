'use strict';

const { CODES } = require('../../rubric');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../p0-product-surface-routing');

const PROMPT_ID = 'native-producer-general-covenants/v1';
const PROMPT_VERSION = 2;
const GENERAL_COVENANT_CODES = Object.freeze(Object.keys(GENERAL_COVENANT_FOLLOW_ON_OWNERS).sort());
const GENERAL_COVENANT_CODEBOOK = Object.freeze(Object.fromEntries(
  GENERAL_COVENANT_CODES.map((code) => [code, Object.freeze({
    label: CODES[code].label,
    aliases: Object.freeze([...CODES[code].aliases]),
    owner_id: GENERAL_COVENANT_FOLLOW_ON_OWNERS[code],
  })]),
));

const RESPONSE_SHAPE = `{
  "general_covenants": [
    {
      "section_reference": "<verbatim section number>",
      "covenant_obligor": "<verbatim obligated-party phrase>",
      "covenant_code": "<one exact GENERAL_COVENANT code>",
      "definition_cross_references": ["<each unresolved defined term required to classify the covenant>"],
      "quote": "<smallest verbatim operative clause proving the covenant>"
    }
  ],
  "open_world_candidates": [
    {
      "observed_quote": "<verbatim unsupported covenant>",
      "why_unmapped": "<why no exact residual covenant code fits>",
      "nearest_concept": "GENERAL_COVENANT_ROUTER"
    }
  ]
}`;

const INSTRUCTIONS = `You are extracting residual general covenants. Produce positive facts only.

EXACT ROUTING. Use only a code in GENERAL_COVENANT. Each code is a separate legal family. Never classify from the COV prefix alone. Never emit a code owned by another native family.

APPROVAL BOUNDARY. Parent stockholder approval and Merger Sub stockholder approval are separate dedicated-family concepts. Never encode either as COV-CONSENT or COV-MERGESUB. COV-CONSENT is only delivery of third-party written consents. COV-MERGESUB is only Merger Sub compliance that does not state either approval concept.

EVIDENCE. Copy the smallest contiguous operative clause exactly. The quote must contain language that proves the selected code and identifies the obligated party. Do not use a heading alone.

DEFINED TERMS. List a defined term or cross-reference only when its unresolved meaning can change the selected covenant code. Never list a term merely because it is capitalised, appears in the quote, or affects only the parties or scope. The resolver will keep a listed term open-world. Do not infer the definition.

UNKNOWN COVENANTS. If no exact code fits, preserve the quote in open_world_candidates. Do not choose a plausible neighbour.

NO NEGATIVES. Do not assert that a covenant is absent.

Return only the JSON response object.`;

function buildGeneralCovenantsProducerPrompt({
  source_text: sourceText,
  governed_scope: governedScope,
  known_definitions: knownDefinitions = [],
} = {}) {
  if (typeof sourceText !== 'string' || !sourceText.length) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  const content = [
    INSTRUCTIONS,
    '',
    'GENERAL_COVENANT:',
    JSON.stringify(GENERAL_COVENANT_CODEBOOK, null, 2),
    '',
    'KNOWN DEFINITIONS:',
    JSON.stringify(knownDefinitions, null, 2),
    '',
    'RESPONSE SHAPE:',
    RESPONSE_SHAPE,
    '',
    'SOURCE TEXT:',
    sourceText,
  ].join('\n');
  return {
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: [{ role: 'user', content }],
  };
}

module.exports = {
  GENERAL_COVENANT_CODEBOOK,
  GENERAL_COVENANT_CODES,
  INSTRUCTIONS,
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_SHAPE,
  buildGeneralCovenantsProducerPrompt,
};
