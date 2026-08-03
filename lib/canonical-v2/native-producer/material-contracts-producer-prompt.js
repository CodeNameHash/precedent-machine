'use strict';

const { MATERIAL_CONTRACT_BUCKET_CODES } = require('../../taxonomy');

const PROMPT_ID = 'native-producer-material-contracts/v1';
const PROMPT_VERSION = 1;
const MATERIAL_CONTRACT_BUCKET_KINDS = Object.freeze(
  Object.keys(MATERIAL_CONTRACT_BUCKET_CODES).filter((code) => code !== 'OTHER').sort(),
);
const MATERIAL_CONTRACT_THRESHOLD_KINDS = Object.freeze(['ANY', 'PERCENT', 'TOP_N', 'USD']);
const MATERIAL_CONTRACT_CADENCE_KINDS = Object.freeze([
  'AGGREGATE', 'ANNUAL', 'PER_DAY', 'PER_EVENT', 'PER_MONTH', 'SPECIFIED_YEAR',
]);

const CONTROLLED_VOCABULARIES = Object.freeze({
  MATERIAL_CONTRACT_BUCKET: Object.freeze(Object.fromEntries(
    MATERIAL_CONTRACT_BUCKET_KINDS.map((code) => [code, MATERIAL_CONTRACT_BUCKET_CODES[code]]),
  )),
  THRESHOLD_KIND: MATERIAL_CONTRACT_THRESHOLD_KINDS,
  CADENCE_KIND: MATERIAL_CONTRACT_CADENCE_KINDS,
});

const RESPONSE_SHAPE = `{
  "material_contract_criteria": [
    {
      "section_reference": "<verbatim section number>",
      "party_making": "<verbatim representation-maker phrase>",
      "bucket_code": "<one MATERIAL_CONTRACT_BUCKET code>",
      "threshold_kind": "USD | PERCENT | TOP_N | ANY | null",
      "threshold_value": "<verbatim threshold token, such as '$10,000,000', '20%', 'Top 10' or 'Any'; null if not directly stated>",
      "cadence_kind": "AGGREGATE | ANNUAL | SPECIFIED_YEAR | PER_MONTH | PER_DAY | PER_EVENT | null",
      "definition_cross_references": ["<each defined term whose unresolved meaning is required to classify this criterion>"],
      "quote": "<smallest verbatim clause that proves the bucket and threshold>"
    }
  ],
  "open_world_candidates": [
    {
      "observed_quote": "<verbatim unsupported criterion>",
      "why_unmapped": "<why the existing bucket or threshold vocabulary cannot express it>",
      "nearest_concept": "REP-T-CONTRACTS"
    }
  ]
}`;

const INSTRUCTIONS = `You are extracting the target's Material Contracts representation. Produce proposed positive facts only.

EVIDENCE. Copy every quote exactly. Use the smallest contiguous clause that proves one contract bucket and its threshold. Never combine separate list clauses.

BUCKETS. Use only MATERIAL_CONTRACT_BUCKET codes. A synonym in the quote must directly prove the bucket. If no code fits, preserve the criterion in open_world_candidates.

THRESHOLDS. Emit USD, PERCENT or TOP_N only when the same quote contains the exact value. Emit ANY only when the clause expressly applies to any contract of that type without a quantitative floor. Otherwise use null. Do not derive a threshold from another clause.

DEFINED TERMS. If classification depends on the meaning of a defined term or cross-reference not supplied in known_definitions, list it in definition_cross_references. The resolver will keep that criterion open-world. Do not infer the definition.

NO NEGATIVES. Do not assert that a bucket or threshold is absent.

Return only the JSON response object.`;

function buildMaterialContractsProducerPrompt({
  source_text: sourceText,
  governed_scope: governedScope,
  known_definitions: knownDefinitions = [],
} = {}) {
  if (typeof sourceText !== 'string' || !sourceText.length) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  const content = [
    INSTRUCTIONS,
    '',
    'CONTROLLED VOCABULARIES:',
    JSON.stringify(CONTROLLED_VOCABULARIES, null, 2),
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
  CONTROLLED_VOCABULARIES,
  INSTRUCTIONS,
  MATERIAL_CONTRACT_BUCKET_KINDS,
  MATERIAL_CONTRACT_CADENCE_KINDS,
  MATERIAL_CONTRACT_THRESHOLD_KINDS,
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_SHAPE,
  buildMaterialContractsProducerPrompt,
};
