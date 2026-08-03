'use strict';
const PROMPT_ID = 'native-producer-appraisal/v1'; const PROMPT_VERSION = 1;
const RESPONSE_SHAPE = '{"appraisal_assertions":[{"section_reference":"<section>","assertion_kind":"SETTLEMENT_CONSENT | WITHDRAWAL_RECONVERSION","quote":"<verbatim>","statute_ref":null}],"open_world_candidates":[]}';
function buildAppraisalProducerPrompt({ source_text }) { if (typeof source_text !== 'string' || !source_text) throw new TypeError('source_text must be a non-empty string'); return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: `Extract only standalone appraisal settlement-consent and withdrawal-reconversion covenants. Availability, conversion and exchange mechanics remain with Consideration. Never assert a negative. Return JSON only.\n${RESPONSE_SHAPE}\nSOURCE TEXT:\n${source_text}` }] }; }
module.exports = { PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, buildAppraisalProducerPrompt };
