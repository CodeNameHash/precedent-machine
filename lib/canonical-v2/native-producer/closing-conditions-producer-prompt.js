'use strict';

const PROMPT_ID = 'native-producer-closing-conditions/v1';
const PROMPT_VERSION = 1;
const RESPONSE_SHAPE = `{
  "closing_condition_assertions": [{
    "section_reference": "<verbatim section reference>",
    "assertion_kind": "BRING_DOWN_TIER | NO_MAE_CONDITION | MAE_CONTINUING | COVENANT_COMPLIANCE | REGULATORY_APPROVAL",
    "condition_obligor": "<verbatim party phrase where the condition has an obligor, otherwise null>",
    "accuracy_standard": "<BRING_DOWN_TIER only, controlled code or null>",
    "rep_side": "<BRING_DOWN_TIER only: TARGET | BUYER | null>",
    "covered_scope": "<BRING_DOWN_TIER only, verbatim covered scope>",
    "scrape_quote": "<BRING_DOWN_TIER only, verbatim accuracy phrase>",
    "mae_term": "<MAE assertions only, verbatim term>",
    "mae_party": "<MAE assertions only: TARGET | BUYER | null>",
    "standard": "<COVENANT_COMPLIANCE only: MAT_ALL_MATERIAL | null>",
    "obligor": "<COVENANT_COMPLIANCE only, verbatim party phrase>",
    "approval_kind": "<REGULATORY_APPROVAL only: HSR | SCHEDULED_JURISDICTIONS | null>",
    "quote": "<one verbatim legal fact>"
  }],
  "open_world_candidates": [{"observed_quote":"<verbatim>","why_unmapped":"<brief reason>","nearest_concept":null}]
}`;
const INSTRUCTIONS = `Extract only positive closing-condition facts. Copy every quote exactly. Split compound conditions into one fact per entry. Use open_world_candidates when a fact does not fit or a controlled code is uncertain. Never infer a party or an approval code. Return JSON only.`;
function buildClosingConditionsProducerPrompt({ source_text: sourceText, governed_scope: governedScope, known_definitions: knownDefinitions = [] }) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  const definitions = knownDefinitions.length ? `KNOWN DEFINITIONS:\n${knownDefinitions.map((d) => `- ${d.defined_term}`).join('\n')}\n` : '';
  return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, definitions, 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] };
}
module.exports = { PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildClosingConditionsProducerPrompt };
