'use strict';

const { sha256Hex } = require('../canonical-v2/canonical-bytes');
const { getFamilyAdapter } = require('../canonical-v2/native-producer/anthropic-provider');
const { lookupGenericClaimKeyMapping } = require('../canonical-v2/native-producer/candidate-resolution');
const { REGISTERED_FAMILY_KEYS } = require('./family-taxonomy');

class ProviderRecordingAdapterError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.name = 'ProviderRecordingAdapterError'; this.code = code; }
}

// This table is an adapter between two registered vocabularies. It never scores
// words in an agreement or chooses a nearest-looking contract identifier.
const ACTIVE_MAPPING = Object.freeze({
  EMPLOYEE_MATTERS: { ITEM_STANDARD: ['EMPLOYEE_COMP_ITEM_STANDARD', 'EMPLOYEE_COMPENSATION'], SERVICE_CREDIT: ['EMPLOYEE_SERVICE_CREDIT', 'SERVICE_CREDIT'], WELFARE_RELIEF: ['WELFARE_PLAN_TRANSITION_RELIEF', 'WELFARE_RELIEF'] },
  GENERAL_COVENANTS: { 'COV-ACCESS': ['GENERAL_COVENANT_PRESENT', 'ACCESS'], 'COV-LITIGATION-NOTICE': ['GENERAL_COVENANT_PRESENT', 'LITIGATION_NOTIFICATION'], 'COV-NOTICE': ['GENERAL_COVENANT_PRESENT', 'GENERAL_NOTIFICATION'], 'COV-SECTION-16': ['GENERAL_COVENANT_PRESENT', 'SECTION_16'], 'COV-DELISTING': ['GENERAL_COVENANT_PRESENT', 'DELISTING'], 'COV-TAKEOVER-LAW': ['GENERAL_COVENANT_PRESENT', 'TAKEOVER_LAW'], 'COV-MERGER-SUB': ['GENERAL_COVENANT_PRESENT', 'MERGER_SUB_OBLIGATION'], 'COV-PUBLICITY': ['GENERAL_COVENANT_PRESENT', 'PUBLICITY'], 'COV-RESIGNATION': ['GENERAL_COVENANT_PRESENT', 'RESIGNATION'], 'COV-CVR': ['GENERAL_COVENANT_PRESENT', 'CVR'], 'COV-LISTING': ['GENERAL_COVENANT_PRESENT', 'LISTING'] },
  CLOSING_CONDITIONS: { STOCKHOLDER_APPROVAL: ['STOCKHOLDER_APPROVAL_CONDITION', 'STOCKHOLDER_APPROVAL'], REGULATORY_APPROVAL: ['REGULATORY_APPROVAL_CONDITION', 'REGULATORY_APPROVAL'], LEGAL_RESTRAINT: ['LEGAL_RESTRAINT_CONDITION', 'LEGAL_RESTRAINT'], LISTING: ['LISTING_CONDITION', 'LISTING_CONDITION'], NO_MAE: ['NO_MAE_CONDITION', 'NO_MAE_CONDITION'], OFFICER_CERTIFICATE: ['OFFICER_CERTIFICATE_REQUIRED', 'OFFICER_CERTIFICATE'] },
  KEY_DEFINED_TERMS: { ACQUISITION_PROPOSAL_THRESHOLD: ['ACQUISITION_PROPOSAL_THRESHOLD_PERCENT', 'ACQUISITION_PROPOSAL'], INTERVENING_EVENT_DEFINITION: ['INTERVENING_EVENT_DEFINITION', 'INTERVENING_EVENT'], INTERVENING_EVENT_EXCLUSION: ['INTERVENING_EVENT_EXCLUSION', 'INTERVENING_EVENT'], KNOWLEDGE_PERSON_SOURCE: ['KNOWLEDGE_PERSON_SOURCE', 'KNOWLEDGE'], KNOWLEDGE_STANDARD: ['KNOWLEDGE_STANDARD', 'KNOWLEDGE'], SUPERIOR_PROPOSAL_QUALIFIER: ['SUPERIOR_PROPOSAL_QUALIFIER', 'SUPERIOR_PROPOSAL'], SUPERIOR_PROPOSAL_THRESHOLD: ['SUPERIOR_PROPOSAL_THRESHOLD_PERCENT', 'SUPERIOR_PROPOSAL'], WILLFUL_BREACH_DEFINITION: ['WILLFUL_BREACH_DEFINITION', 'WILLFUL_BREACH'], WILLFUL_BREACH_KNOWLEDGE_STANDARD: ['WILLFUL_BREACH_KNOWLEDGE_STANDARD', 'WILLFUL_BREACH'] },
  INTERIM_OPERATING: { RESTRICTION_PRESENT: ['IOC_RESTRICTION_PRESENT', 'RESTRICTIVE_COVENANT'] },
  NO_SHOP: { NATIVE_NO_SHOP_ACTION_CANDIDATE: ['PROHIBITED_ACTION', 'PROHIBITED_ACTION'], NATIVE_NO_SHOP_EXCEPTION_PREREQUISITE_CANDIDATE: ['EXCEPTION_PREREQUISITE', 'EXCEPTION_PREREQUISITE'], NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE: ['NOTICE_PERIOD', 'NOTICE_PERIOD'], NATIVE_NO_SHOP_INITIAL_MATCH_PERIOD_CANDIDATE: ['INITIAL_MATCH_PERIOD', 'INITIAL_MATCH_PERIOD'], NATIVE_NO_SHOP_SUBSEQUENT_MATCH_PERIOD_CANDIDATE: ['SUBSEQUENT_MATCH_PERIOD', 'SUBSEQUENT_MATCH_PERIOD'], RECOMMENDATION_CHANGE_ACTION: ['RECOMMENDATION_CHANGE', 'RECOMMENDATION_CHANGE'] },
  DNO_INDEMNIFICATION: { INDEM_CONTINUATION: ['INDEMNIFICATION_CONTINUATION', 'INDEMNIFICATION_AND_EXCULPATION'], ADVANCEMENT: ['ADVANCEMENT_OF_EXPENSES', 'EXPENSE_ADVANCEMENT'], CHARTER_CONTINUATION: ['CHARTER_PROTECTION_CONTINUATION', 'CHARTER_AND_CONTRACT_CONTINUATION'], INDEM_SURVIVAL_PERIOD: ['INDEMNIFICATION_SURVIVAL_YEARS', 'INDEMNIFICATION_AND_EXCULPATION'], TAIL_OBLIGATION: ['TAIL_POLICY_OBLIGATION', 'DNO_INSURANCE_TAIL'], TAIL_PERIOD: ['TAIL_POLICY_PERIOD_YEARS', 'DNO_INSURANCE_TAIL'], TAIL_CAP_PERCENT: ['TAIL_PREMIUM_CAP_PERCENT', 'DNO_INSURANCE_TAIL'], TAIL_CAP_OFF_AGREEMENT: ['TAIL_PREMIUM_CAP_OFF_AGREEMENT', 'DNO_INSURANCE_TAIL'], TPB_RIGHTS: ['COVERED_PERSON_TPB_RIGHTS', 'THIRD_PARTY_ENFORCEMENT'] },
  NO_OTHER_REPS_FRAUD: { NATIVE_NO_OTHER_REPS_DISCLAIMER_CANDIDATE: ['NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT', 'NO_OTHER_REPRESENTATIONS_DISCLAIMER'], NATIVE_NON_RELIANCE_CANDIDATE: ['NON_RELIANCE_ACKNOWLEDGMENT_PRESENT', 'NON_RELIANCE_ACKNOWLEDGMENT'], NATIVE_EXTRA_CONTRACTUAL_RELIANCE_CANDIDATE: ['EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT', 'NON_RELIANCE_ACKNOWLEDGMENT'] },
  ANTITRUST_REGULATORY: { EFFORTS_STANDARD: ['REGULATORY_EFFORTS_STANDARD', 'EFFORTS'], REGULATORY_FILING_OBLIGATION: ['REGULATORY_FILING_OBLIGATION', 'FILING_OBLIGATION'], HSR_FILING_DEADLINE: ['HSR_FILING_DEADLINE_DAYS', 'FILING_DEADLINE'], BURDEN_COMMITMENT: ['REGULATORY_BURDEN_COMMITMENT', 'BURDEN'], LITIGATION_OBLIGATION: ['REGULATORY_LITIGATION_OBLIGATION', 'LITIGATION'], STRATEGY_CONTROL: ['REGULATORY_STRATEGY_CONTROL', 'STRATEGY_CONTROL'], CONSULTATION_RIGHT: ['REGULATORY_CONSULTATION_RIGHT', 'CONSULTATION'], COOPERATION_OBLIGATION: ['REGULATORY_COOPERATION_OBLIGATION', 'COOPERATION'], INFORMATION_SHARING_OBLIGATION: ['REGULATORY_INFORMATION_SHARING_OBLIGATION', 'INFORMATION_SHARING'], NOTIFICATION_OBLIGATION: ['REGULATORY_NOTIFICATION_OBLIGATION', 'REGULATORY_REQUEST_RESPONSE'] },
  APPRAISAL_DISSENTERS_RIGHTS: { SETTLEMENT_CONSENT: ['APPRAISAL_SETTLEMENT_CONSENT', 'SETTLEMENT_CONSENT'], WITHDRAWAL_RECONVERSION: ['APPRAISAL_WITHDRAWAL_RECONVERSION', 'WITHDRAWAL_RECONVERSION'] },
  CAPITALISATION: { AUTHORIZED: ['CAPITALISATION_AUTHORISED_CAPITAL', 'AUTHORISED_CAPITAL'], ISSUED_OUTSTANDING: ['CAPITALISATION_ISSUED_AND_OUTSTANDING', 'ISSUED_AND_OUTSTANDING'] },
  DIVIDENDS: { COORDINATION: ['DIVIDEND_COORDINATION_COVENANT', 'DIVIDEND_COORDINATION'] },
  FINANCING_COVENANTS: { OBTAIN_EFFORTS: ['FINANCING_OBTAIN_EFFORTS_STANDARD', 'OBTAIN_FINANCING'], PAYOFF_LEAD_TIME: ['PAYOFF_DELIVERY_LEAD_TIME_DAYS', 'PAYOFF'], NO_FINANCING_CONDITION_ACK: ['NO_FINANCING_CONDITION_ACKNOWLEDGMENT', 'NO_FINANCING_CONDITION'] },
  GUARANTY_FINANCING_PARTY: { GUARANTY_DELIVERED: ['LIMITED_GUARANTY_DELIVERED', 'LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP'] },
  MATERIAL_CONTRACTS: { NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE: ['MATERIAL_CONTRACT_BUCKET_PRESENT', 'MATERIAL_CONTRACT_CATEGORY_CRITERION'], NATIVE_MATERIAL_CONTRACT_THRESHOLD_CANDIDATE: ['MATERIAL_CONTRACT_THRESHOLD_STRUCTURE', 'MATERIAL_CONTRACT_CATEGORY_CRITERION'] },
  MERGER_STRUCTURE_CLOSING: { NATIVE_MERGER_TRANSACTION_STEP_CANDIDATE: ['MERGER_TRANSACTION_STEP', 'TRANSACTION_STEP'] },
  MISC_BOILERPLATE: { ASSIGNMENT_DETAIL: ['MISC_BOILERPLATE_MECHANIC_PRESENT', 'ASSIGNMENT'], CONSTRUCTION_OR_EXPENSES: ['MISC_BOILERPLATE_MECHANIC_PRESENT', 'CONSTRUCTION'], TPB_EXCEPTION: ['MISC_BOILERPLATE_MECHANIC_PRESENT', 'THIRD_PARTY_BENEFICIARY'] },
  PROXY_MEETING: { FILING_DEADLINE: ['PROXY_FILING_DEADLINE_DAYS', 'DOCUMENT_FILING'], RECORD_DATE_ESTABLISHMENT: ['RECORD_DATE_ESTABLISHMENT_PRESENT', 'RECORD_DATE_OR_BROKER_SEARCH'], CONVENE_OBLIGATION: ['MEETING_CONVENE_OBLIGATION', 'MEETING_CALL_OR_HOLD'], MEETING_DEADLINE: ['MEETING_DEADLINE_DAYS', 'MEETING_CALL_OR_HOLD'], ADJOURNMENT_REASON: ['MEETING_ADJOURNMENT_REASON', 'ADJOURNMENT'], RECOMMENDATION_INCLUSION: ['BOARD_RECOMMENDATION_INCLUSION', 'RECOMMENDATION_INCLUSION'] },
  SPECIFIC_PERFORMANCE_REMEDIES: { SPECIFIC_PERFORMANCE: ['SPECIFIC_PERFORMANCE_REMEDY_PRESENT', 'GENERAL_EQUITABLE_RELIEF'] },
  TAX_MATTERS: { TREATMENT_PROTECTION: ['TAX_TREATMENT_PROTECTION_COVENANT', 'TAX_TREATMENT_PROTECTION'], OPINION_COOPERATION: ['TAX_OPINION_COOPERATION_COVENANT', 'TAX_OPINION_COOPERATION'], TRANSFER_TAX_ALLOCATION: ['TRANSFER_TAX_ALLOCATION', 'TRANSFER_TAX_ALLOCATION'], INTENDED_TAX_TREATMENT: ['INTENDED_TAX_TREATMENT_KIND', 'INTENDED_TAX_TREATMENT'] },
});

function parseRecordedJson(rawResponse) {
  if (typeof rawResponse !== 'string' || rawResponse.trim().length === 0) throw new ProviderRecordingAdapterError('PROVIDER_RECORDING_RESPONSE', 'non-empty response text is required');
  const text = rawResponse.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('object required');
    return payload;
  } catch { throw new ProviderRecordingAdapterError('PROVIDER_RECORDING_JSON', 'response is not a JSON object'); }
}

function exactMapping(familyKey, proposal, legalContract) {
  const identifiers = [proposal.attributes?.assertion_kind, proposal.attributes?.count_kind, proposal.attributes?.covenant_code, proposal.claim_definition_key].filter(Boolean);
  let pair = identifiers.map((key) => ACTIVE_MAPPING[familyKey]?.[key]).find(Boolean) || null;
  if (!pair) {
    const mapped = lookupGenericClaimKeyMapping(proposal.claim_definition_key, proposal.attributes?.qualifier_kind || null, proposal.attributes?.attachment || null);
    if (mapped?.registered_claim_definition_key && legalContract.required_fact_types.includes(mapped.registered_claim_definition_key)) {
      const subtype = legalContract.subtypes.find((item) => item.subtype_key === mapped.concept_key);
      if (subtype) pair = [mapped.registered_claim_definition_key, subtype.subtype_key];
    }
  }
  if (!pair || !legalContract.required_fact_types.includes(pair[0]) || !legalContract.subtypes.some((item) => item.subtype_key === pair[1])) return null;
  return Object.freeze({ fact_type: pair[0], subtype_key: pair[1] });
}

function proposalQuote(proposal, sourceText) {
  const item = proposal.evidence?.[0];
  if (!item || !Number.isSafeInteger(item.absolute_start) || !Number.isSafeInteger(item.absolute_end)) return null;
  return Buffer.from(sourceText, 'utf8').subarray(item.absolute_start, item.absolute_end).toString('utf8');
}

function adaptRecordedFamilyResponse({ familyKey, legalContract, rawResponse, sourceText, sourceRecording }) {
  if (!REGISTERED_FAMILY_KEYS.includes(familyKey) || legalContract?.family_key !== familyKey) throw new ProviderRecordingAdapterError('PROVIDER_RECORDING_FAMILY', familyKey);
  if (typeof sourceText !== 'string' || sourceText.length === 0) throw new ProviderRecordingAdapterError('PROVIDER_RECORDING_SOURCE', familyKey);
  const payload = parseRecordedJson(rawResponse);
  const adapter = getFamilyAdapter(familyKey);
  if (!adapter) throw new ProviderRecordingAdapterError('PROVIDER_FAMILY_ADAPTER', familyKey);
  let shaped;
  try { shaped = adapter.response_shaper(payload, sourceText); } catch (error) { throw new ProviderRecordingAdapterError('PROVIDER_RESPONSE_SHAPER', `${familyKey}:${error.message}`); }
  const proposals = shaped.proposals.map((native) => Object.freeze({ native, exact_quote: proposalQuote(native, sourceText), active_mapping: exactMapping(familyKey, native, legalContract) }));
  const incompatibilities = [
    ...shaped.evidence_residuals.map((detail) => Object.freeze({ code: 'NATIVE_SHAPER_RESIDUAL', detail })),
    ...proposals.filter((item) => !item.active_mapping).map((item) => Object.freeze({ code: 'ACTIVE_CONTRACT_IDENTIFIER_UNMAPPED', claim_definition_key: item.native.claim_definition_key, assertion_kind: item.native.attributes?.assertion_kind || null })),
  ];
  return Object.freeze({
    schema_version: 'PRODUCT_PROVIDER_FAMILY_EVIDENCE/V1', family_key: familyKey, source_recording: sourceRecording,
    adapter_family: adapter.family,
    raw_response_sha256: sha256Hex(Buffer.from(rawResponse, 'utf8')), source_text_sha256: sha256Hex(Buffer.from(sourceText, 'utf8')),
    native_proposal_count: proposals.length, mapped_proposal_count: proposals.filter((item) => item.active_mapping).length,
    unmapped_proposal_count: proposals.filter((item) => !item.active_mapping).length,
    residual_count: shaped.evidence_residuals.length, proposals, incompatibilities,
  });
}

const ACTOR_FIELDS = Object.freeze(['party_making', 'covenant_obligor', 'condition_obligor', 'obligor_party', 'obligor', 'payer_party', 'terminating_party', 'definition_subject', 'control_party']);
const TEMPORAL_FIELDS = Object.freeze(['period_term', 'day_kind', 'anchor_kind', 'deadline_days', 'period_days', 'period_months', 'period_years', 'section_reference']);

function firstExactAttribute(attributes, fields) {
  for (const field of fields) if (attributes[field] !== undefined && attributes[field] !== null && attributes[field] !== '') return attributes[field];
  return null;
}

function activeExtractionFromProviderEvidence({ evidence, familyContracts, sourceClosure }) {
  if (!Array.isArray(evidence) || !Array.isArray(familyContracts) || !sourceClosure) throw new ProviderRecordingAdapterError('PROVIDER_EVIDENCE_SET', 'evidence, contracts and source closure are required');
  const components = [...(sourceClosure.operative || []), ...(sourceClosure.chapeau || []), ...(sourceClosure.definitions || []), ...(sourceClosure.cross_references || []), sourceClosure.full_section].filter(Boolean);
  const proposals = [];
  const groups = [];
  const seen = new Set();
  const providerIncompatibilities = [];
  for (const contract of familyContracts) {
    const observations = evidence.filter((item) => item.family_key === contract.family_key).flatMap((item) => item.proposals);
    for (const observation of observations) {
      if (!observation.exact_quote) continue;
      const component = components.find((item) => item.exact_text.includes(observation.exact_quote));
      if (!component) continue;
      if (!observation.active_mapping) {
        providerIncompatibilities.push({ family_key: contract.family_key, code: 'ACTIVE_CONTRACT_IDENTIFIER_UNMAPPED', message: observation.native.claim_definition_key, source_span_id: component.span_id });
        continue;
      }
      const identity = `${contract.family_key}\u001f${observation.active_mapping.fact_type}\u001f${observation.active_mapping.subtype_key}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const native = observation.native;
      const attributes = native.attributes || {};
      const operation = attributes.assertion_kind || attributes.covenant_code || attributes.count_kind || native.claim_definition_key;
      const actor = firstExactAttribute(attributes, ACTOR_FIELDS) || native.subject_occurrence_id;
      const temporal = firstExactAttribute(attributes, TEMPORAL_FIELDS) || attributes.section_reference || native.subject_occurrence_id;
      const qualification = JSON.stringify({ attributes, taxonomy_codes: native.taxonomy_codes || {} });
      const roles = { LEGAL_ACTOR_OR_SUBJECT: actor, LEGAL_OPERATION: operation, OPERATIVE_OBJECT: native.raw_value || observation.exact_quote, TEMPORAL_OR_TRIGGER_SCOPE: temporal, QUALIFICATIONS: qualification };
      const index = component.exact_text.indexOf(observation.exact_quote);
      const occurrence = component.exact_text.slice(0, index).split(observation.exact_quote).length - 1;
      const clientRef = `PROVIDER-${contract.family_key}-${proposals.length}`;
      groups.push({ client_ref: `GROUP-${clientRef}`, family_key: contract.family_key, subtype_key: observation.active_mapping.subtype_key });
      proposals.push({
        client_ref: clientRef, group_ref: `GROUP-${clientRef}`, family_key: contract.family_key,
        subtype_key: observation.active_mapping.subtype_key, fact_type: observation.active_mapping.fact_type,
        statement: String(native.raw_value || observation.exact_quote).trim(), roles, value: native.canonical_value ?? null,
        evidence_quotes: [{ quote: observation.exact_quote, source_span_id: component.span_id, occurrence }],
      });
    }
  }
  const coverage = {};
  const factTypeCoverage = {};
  for (const contract of familyContracts) {
    const familyProposals = proposals.filter((item) => item.family_key === contract.family_key);
    const incompatible = providerIncompatibilities.some((item) => item.family_key === contract.family_key);
    coverage[contract.family_key] = incompatible ? 'UNRESOLVED' : familyProposals.length > 0 ? 'FOUND' : 'NOT_FOUND';
    factTypeCoverage[contract.family_key] = Object.fromEntries(contract.required_fact_types.map((factType) => [factType, incompatible ? 'UNRESOLVED' : familyProposals.some((item) => item.fact_type === factType) ? 'FOUND' : 'NOT_FOUND']));
  }
  return { proposals, groups, links: [], coverage, fact_type_coverage: factTypeCoverage, provider_incompatibilities: providerIncompatibilities };
}

module.exports = { ACTIVE_MAPPING, ProviderRecordingAdapterError, activeExtractionFromProviderEvidence, adaptRecordedFamilyResponse, parseRecordedJson };
