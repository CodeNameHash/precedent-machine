'use strict';
const PROMPT_ID = 'native-producer-merger-structure/v1';
const PROMPT_VERSION = 1;
const RESPONSE_SHAPE = `{"structure_mechanics":[{"surface":"DIRECTORS | EFFECTS | ACTIONS | CLOSING_LOCATION | CLOSING_TIMING | EFFECTIVE_TIME | SHORT_FORM_251H | TOP_UP | SUBSEQUENT_OFFERING | SCHEDULE_TO_14D9 | STOCKHOLDER_LIST | BOARD_DESIGNATION","quote":"<one verbatim mechanism>","detail":"<factual description only>"}],"open_world_candidates":[]}`;
const INSTRUCTIONS = `Read merger structure and closing mechanics. Produce byte-verified evidence only. Capture directors, effects, actions, closing location or timing, effective time, short-form or 251(h), Top-Up, subsequent offering, Schedule TO or 14D-9, stockholder list, and board designation mechanisms. One entry contains one complete mechanism. Labels route evidence only, not legal codes. Do not calculate dates or thresholds. Do not capture consideration, closing conditions, termination rights, employee matters, or no-shop language. transaction_steps is a distinct source and must not be inferred or overwritten from agreement text. Never assert a negative. Return JSON only.`;
function buildMergerStructureProducerPrompt({ source_text: sourceText, governed_scope: governedScope }) {
  if (typeof sourceText !== 'string' || !sourceText) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] };
}
module.exports = { PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildMergerStructureProducerPrompt };
