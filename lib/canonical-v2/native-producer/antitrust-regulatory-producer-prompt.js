'use strict';

const PROMPT_ID = 'native-producer-antitrust-regulatory/v1';
const PROMPT_VERSION = 1;
const CONTROLLED_VOCABULARIES = Object.freeze({
  ASSERTION_KIND: Object.freeze(['EFFORTS_STANDARD', 'BURDEN_COMMITMENT', 'DIVESTITURE_CAP_AMOUNT', 'LITIGATION_OBLIGATION', 'TIMING_RESTRICTION', 'HSR_FILING_DEADLINE']),
  OBLIGOR_PARTY_SCOPE: Object.freeze(['MUTUAL', 'ONE_PARTY']),
  DAY_KIND: Object.freeze(['BUSINESS', 'CALENDAR']),
});
const RESPONSE_SHAPE = `{"regulatory_efforts_assertions":[{"section_reference":"<section>","assertion_kind":"EFFORTS_STANDARD | BURDEN_COMMITMENT | DIVESTITURE_CAP_AMOUNT | LITIGATION_OBLIGATION | TIMING_RESTRICTION | HSR_FILING_DEADLINE","canonical_value":"<registered enum value or null for parsed numeric kinds>","obligor_party_scope":"MUTUAL | ONE_PARTY","obligor_party":"<verbatim party phrase>","burden_term_ref":"<optional verbatim term>","burden_baseline":"<optional code>","day_kind":"BUSINESS | CALENDAR","filing_regime_ref":"<HSR Act only>","quote":"<one contiguous legal fact>"}],"open_world_candidates":[]}`;
const INSTRUCTIONS = `You are extracting antitrust and regulatory-efforts covenants from a merger agreement. Return only exact source quotes. Never assert that a cap, deadline, or obligation is absent, silent, or not stated. Make one assertion per legal fact. Split an efforts standard from a burden, litigation, timing, or filing fact. Use regulatory_efforts_assertions only for the listed assertion kinds. For an unfamiliar enum value, uncertain scope, non-HSR filing, or mixed multi-fact span, preserve the quote in open_world_candidates instead of forcing a fit. The obligor_party field must be copied verbatim. HSR_FILING_DEADLINE applies only to an HSR Act deadline. Do not calculate scaled money values.`;
function buildAntitrustRegulatoryProducerPrompt({ source_text: sourceText, governed_scope: governedScope }) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, 'CONTROLLED VOCABULARIES:', JSON.stringify(CONTROLLED_VOCABULARIES), 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] };
}
module.exports = { PROMPT_ID, PROMPT_VERSION, CONTROLLED_VOCABULARIES, RESPONSE_SHAPE, INSTRUCTIONS, buildAntitrustRegulatoryProducerPrompt };
