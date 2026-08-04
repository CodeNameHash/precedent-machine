'use strict';

const PROMPT_ID = 'native-producer-closing-conditions/v3';
const PROMPT_VERSION = 4;
const RESPONSE_SHAPE = `{
  "closing_condition_assertions": [{
    "section_reference": "<verbatim section reference>",
    "assertion_kind": "BRING_DOWN_TIER | NO_MAE_CONDITION | MAE_CONTINUING | COVENANT_COMPLIANCE | REGULATORY_APPROVAL | STOCKHOLDER_APPROVAL | LEGAL_RESTRAINT | GOVERNMENT_PROCEEDING | S4_COMPONENT | LISTING | FUNDS | OFFICER_CERTIFICATE | FRUSTRATION_CAUSATION | FRUSTRATION_BREACH | DOLLAR_THRESHOLD | BURDENSOME_CONDITION",
    "condition_obligor": "<verbatim party phrase where the condition has an obligor, otherwise null>",
    "accuracy_standard": "<BRING_DOWN_TIER only, controlled code or null>",
    "rep_side": "<BRING_DOWN_TIER only: TARGET_REPS | BUYER_REPS | null>",
    "covered_scope": "<BRING_DOWN_TIER only, verbatim covered scope>",
    "scrape_quote": "<BRING_DOWN_TIER only, verbatim accuracy phrase>",
    "mae_term": "<MAE assertions only, verbatim term>",
    "mae_party": "<MAE assertions only: TARGET | BUYER | null>",
    "standard": "<COVENANT_COMPLIANCE only: MAT_ALL_MATERIAL | null>",
    "obligor": "<COVENANT_COMPLIANCE only, verbatim party phrase>",
    "approval_kind": "<REGULATORY_APPROVAL only: HSR | SCHEDULED_APPROVALS | null>",
    "approval_definition": "<STOCKHOLDER_APPROVAL only, verbatim approval standard or cross-reference>",
    "s4_component": "<S4_COMPONENT only: FORM_EFFECTIVE | NO_STOP_ORDER | NO_PENDING_OR_THREATENED_PROCEEDING>",
    "listing_venue": "<LISTING only, verbatim exchange name or null>",
    "certificate_side": "<OFFICER_CERTIFICATE only: TARGET_CERTIFICATE | BUYER_CERTIFICATE>",
    "certifying_party": "<OFFICER_CERTIFICATE only, verbatim party phrase>",
    "certified_condition_refs": ["<OFFICER_CERTIFICATE only, verbatim section reference>"],
    "causation_standard": "<FRUSTRATION_CAUSATION only: CAUSED_BY_BREACH | PROXIMATELY_CAUSED | PRINCIPALLY_CAUSED | PRIMARILY_RESULTED>",
    "breach_standard": "<FRUSTRATION_BREACH only: BREACH | MATERIAL_BREACH | FAILURE_TO_PERFORM>",
    "threshold_role": "<DOLLAR_THRESHOLD only: FUNDS_MINIMUM | REP_INACCURACY_CAP>",
    "burdensome_scope": "<BURDENSOME_CONDITION only: PARENT_ONLY | null>",
    "related_clause_reference": "<verbatim section reference expressly named in this clause, or null>",
    "cross_reference_quote": "<smallest exact quote containing that express reference, or null>",
    "quote": "<one verbatim legal fact>"
  }],
  "open_world_candidates": [{"observed_quote":"<verbatim>","why_unmapped":"<brief reason>","nearest_concept":null}]
}`;
const INSTRUCTIONS = `Extract only positive closing-condition facts. Copy every quote exactly. Split compound conditions into one fact per entry. For every S4_COMPONENT, repeat the full exact Registration Statement sentence for each component. Its quote must contain both “Registration Statement” and the exact effective, stop-order, or pending-proceeding words that support that component. Do not emit a stop-order or proceeding fragment without the Registration Statement subject. For an officer certificate, preserve every cited condition section in certified_condition_refs. Each entry is only a verbatim section-reference relationship. Do not claim that a cited condition resolves locally. A Closing Condition and a Termination Right can state different standards. Preserve the standard stated in each clause. Add related_clause_reference and cross_reference_quote only when this clause itself expressly cites the other clause. Never infer a link, inherit a standard, or deduplicate them. Dissent thresholds are retired as a comparable M3 field: never emit DISSENT_THRESHOLD. Preserve any such text as an exact open_world_candidate. It can become governed only after a separately approved stable grounded shape. Use open_world_candidates when a fact does not fit or a controlled code is uncertain. Never infer a party, threshold role, or controlled code. Return JSON only.`;
function buildClosingConditionsProducerPrompt({ source_text: sourceText, governed_scope: governedScope, known_definitions: knownDefinitions = [] }) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  const definitions = knownDefinitions.length ? `KNOWN DEFINITIONS:\n${knownDefinitions.map((d) => `- ${d.defined_term}`).join('\n')}\n` : '';
  return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, definitions, 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] };
}
module.exports = { PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildClosingConditionsProducerPrompt };
