'use strict';
//
// STEP 2F2 PROBE, 2026-08-08. The ONLY change in this version is the
// `open_world_candidates` element schema in RESPONSE_SHAPE below. The
// instructions are byte-identical to the previous version, deliberately, so
// that a change in open-world yield can be attributed to the response shape
// and to nothing else.
//
// The hypothesis under test: showing a model `"open_world_candidates":[]` --
// an empty array with no element schema -- teaches it that empty is the
// answer. Measured across TopBuild's 22 measurable family runs, the 11
// prompts showing that pre-filled empty averaged 2.5 open-world rows with 5
// returning zero; the 11 not showing one averaged 21.1 with 1 returning zero.
// That correlation is confounded -- the pre-filled prompts are also the terse
// ones -- which is why this is a three-family probe and not a sweep of all
// thirteen. THIS family is the decisive control: it is the only pre-filled
// prompt that is NOT terse, so if yield moves here, prompt length is not the
// explanation.

const {
  REGULATORY_BURDEN_COMMITMENT_CLAIM_DEFINITION_V1,
  REGULATORY_CONSULTATION_RIGHT_CLAIM_DEFINITION_V1,
  REGULATORY_EFFORTS_STANDARD_CLAIM_DEFINITION_V1,
  REGULATORY_FILING_TIMING_STANDARD_CLAIM_DEFINITION_V1,
  REGULATORY_LITIGATION_OBLIGATION_CLAIM_DEFINITION_V1,
  REGULATORY_STRATEGY_CONTROL_CLAIM_DEFINITION_V1,
  REGULATORY_TIMING_AGREEMENT_RESTRICTION_CLAIM_DEFINITION_V1,
  REGULATORY_WITHDRAWAL_REFILING_RESTRICTION_CLAIM_DEFINITION_V1,
} = require('../contract-bundle');

const PROMPT_ID = 'native-producer-antitrust-regulatory/v1';
const PROMPT_VERSION = 6;
const allowedValues = (definition) => Object.freeze([...definition.allowed_canonical_values]);
const CONTROLLED_VOCABULARIES = Object.freeze({
  ASSERTION_KIND: Object.freeze(['EFFORTS_STANDARD', 'BURDEN_COMMITMENT', 'DIVESTITURE_CAP_AMOUNT', 'LITIGATION_OBLIGATION', 'TIMING_AGREEMENT_RESTRICTION', 'WITHDRAWAL_REFILING_RESTRICTION', 'HSR_FILING_DEADLINE', 'REGULATORY_FILING_OBLIGATION', 'REGULATORY_FILING_DEADLINE', 'REGULATORY_FILING_TIMING_STANDARD', 'STRATEGY_CONTROL', 'CONSULTATION_RIGHT', 'COOPERATION_OBLIGATION', 'INFORMATION_SHARING_OBLIGATION', 'NOTIFICATION_OBLIGATION', 'NON_IMPEDIMENT_COVENANT']),
  OBLIGOR_PARTY_SCOPE: Object.freeze(['MUTUAL', 'ONE_PARTY']),
  DAY_KIND: Object.freeze(['BUSINESS', 'CALENDAR']),
  BURDEN_BASELINE: Object.freeze(['TARGET_ONLY', 'BUYER_ONLY', 'COMBINED_ENTITY', 'SIZE_NORMALIZED']),
  INFORMATION_PROTECTION_KIND: Object.freeze(['OUTSIDE_COUNSEL_ONLY', 'PRIVILEGE_REDACTION', 'VALUATION_REDACTION', 'LEGAL_RESTRICTION']),
  EFFORTS_STANDARD_VALUE: allowedValues(REGULATORY_EFFORTS_STANDARD_CLAIM_DEFINITION_V1),
  BURDEN_COMMITMENT_VALUE: Object.freeze(allowedValues(REGULATORY_BURDEN_COMMITMENT_CLAIM_DEFINITION_V1)
    .filter((value) => value !== 'NAMED_ASSET_CARVEOUT')),
  LITIGATION_OBLIGATION_VALUE: allowedValues(REGULATORY_LITIGATION_OBLIGATION_CLAIM_DEFINITION_V1),
  TIMING_AGREEMENT_VALUE: allowedValues(REGULATORY_TIMING_AGREEMENT_RESTRICTION_CLAIM_DEFINITION_V1),
  WITHDRAWAL_REFILING_VALUE: allowedValues(REGULATORY_WITHDRAWAL_REFILING_RESTRICTION_CLAIM_DEFINITION_V1),
  FILING_TIMING_STANDARD_VALUE: allowedValues(REGULATORY_FILING_TIMING_STANDARD_CLAIM_DEFINITION_V1),
  STRATEGY_CONTROL_VALUE: allowedValues(REGULATORY_STRATEGY_CONTROL_CLAIM_DEFINITION_V1),
  CONSULTATION_RIGHT_VALUE: allowedValues(REGULATORY_CONSULTATION_RIGHT_CLAIM_DEFINITION_V1),
});
const RESPONSE_SHAPE = `{"regulatory_efforts_assertions":[{"section_reference":"<section>","assertion_kind":"<ASSERTION_KIND value>","canonical_value":null,"obligor_party_scope":"MUTUAL | ONE_PARTY","obligor_party":"<verbatim obligor>","burden_term_ref":"<exact defined burden term>","burden_baseline":"<BURDEN_BASELINE value>","burden_baseline_ref":"<exact baseline phrase>","filing_regime_ref":"<one exact named regime only>","day_kind":"BUSINESS | CALENDAR only when stated","timing_relation":"<exact phrase>","timing_trigger":"<exact phrase>","fixed_date_ref":"<exact date phrase>","control_holder_party":"<exact holder>","strategy_scope_ref":"<exact controlled scope>","right_holder_party":"<exact consultation holder>","cooperation_scope_ref":"<exact scope>","information_scope_ref":"<exact information scope>","information_protection_kinds":["<each stated INFORMATION_PROTECTION_KIND>"],"notification_event_ref":"<exact event>","notification_timing_ref":"<exact notification timing phrase>","prohibited_action_ref":"<exact action>","impairment_effect_ref":"<exact effect>","withdrawal_exception_ref":"<exact proviso>","withdrawal_refile_period_days":"<digits only when quoted>","withdrawal_refile_day_kind":"BUSINESS | CALENDAR only when stated","quote":"<one contiguous legal fact>"}],"open_world_candidates":[{"observed_quote":"<verbatim>","why_unmapped":"<brief>","nearest_concept":null}]}`;
const CANONICAL_VALUE_EXAMPLES = Object.freeze({
  controlled_vocabulary_kind: 'REASONABLE_BEST_EFFORTS',
  boolean_obligation_kind: true,
  parsed_numeric_kind: null,
});
const INSTRUCTIONS = `You are extracting antitrust and regulatory-efforts covenants from a merger agreement. Return exact source quotes only. Never assert absence or silence. Make one assertion per atomic legal fact. A mixed clause may produce several assertions, each with a quote that contains its obligor and operative verb. Use canonical_value only from the controlled vocabulary for that assertion kind: EFFORTS_STANDARD_VALUE for EFFORTS_STANDARD; BURDEN_COMMITMENT_VALUE for BURDEN_COMMITMENT; LITIGATION_OBLIGATION_VALUE for LITIGATION_OBLIGATION; TIMING_AGREEMENT_VALUE for TIMING_AGREEMENT_RESTRICTION; WITHDRAWAL_REFILING_VALUE for WITHDRAWAL_REFILING_RESTRICTION; FILING_TIMING_STANDARD_VALUE for REGULATORY_FILING_TIMING_STANDARD; STRATEGY_CONTROL_VALUE for STRATEGY_CONTROL; CONSULTATION_RIGHT_VALUE for CONSULTATION_RIGHT. Use boolean true for filing, cooperation, information-sharing, notification and non-impediment obligations. Use null for parsed money and numeric deadline kinds. ANTI-AGREEMENTS owns timing agreements and withdrawal/refiling. Do not emit legacy TIMING_RESTRICTION, ANTI-FOREIGN, or ANTI-INTERIM labels. STRATEGY_CONTROL requires exact control, direction, lead, or primary-responsibility language and must copy control_holder_party and strategy_scope_ref. CONSULTATION_RIGHT must copy the beneficiary into right_holder_party, not the obligor. COOPERATION_OBLIGATION requires an operative cooperate or coordinate duty and must copy its scope. INFORMATION_SHARING_OBLIGATION requires an operative furnish, supply, share, provide, or copy duty; copy its scope and emit every stated protection as a separate information_protection_kinds entry. Never infer a protection. NOTIFICATION_OBLIGATION requires an operative notify, advise, or keep-informed duty, an exact event or subject, and any exact stated timing such as promptly. NON_IMPEDIMENT_COVENANT requires an express prohibition and an exact prevention, delay, impairment, impediment, or adverse-effect phrase. For each filing fact, filing_regime_ref must be one exact named regime copied from the same quote. HSR is always a separate fact, whether the quote says HSR Act or the full Hart-Scott-Rodino name. Never aggregate HSR and another regime. A qualitative filing time uses REGULATORY_FILING_TIMING_STANDARD. A stated calendar date uses FIXED_DATE and fixed_date_ref. A numeric filing deadline uses the applicable deadline kind and day_kind only when Business Days or Calendar Days is express. Bare days are not calendar days. TIMING_AGREEMENT_RESTRICTION covers stay, toll, extension, or timing agreements. WITHDRAWAL_REFILING_RESTRICTION covers withdrawal, pull-and-refile, or refiling; capture any narrow proviso without applying it to timing agreements. For a named burden term, copy burden_term_ref. For a burden baseline, emit both burden_baseline and burden_baseline_ref. For every obligation, the quote must include the exact obligor_party phrase and the operative verb. Do not emit a leaf from an enumerated list when its quote omits the actor stated in the governing sentence. Do not calculate scaled money, foreign exchange, annualised values, or derived USD. Uncertain facts and residual text stay in open_world_candidates.`;
function buildAntitrustRegulatoryProducerPrompt({ source_text: sourceText, governed_scope: governedScope }) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, 'CONTROLLED VOCABULARIES:', JSON.stringify(CONTROLLED_VOCABULARIES), 'CANONICAL VALUE JSON TYPES:', JSON.stringify(CANONICAL_VALUE_EXAMPLES), 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] };
}
module.exports = { PROMPT_ID, PROMPT_VERSION, CONTROLLED_VOCABULARIES, CANONICAL_VALUE_EXAMPLES, RESPONSE_SHAPE, INSTRUCTIONS, buildAntitrustRegulatoryProducerPrompt };
