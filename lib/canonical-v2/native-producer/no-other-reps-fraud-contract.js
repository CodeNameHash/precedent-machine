'use strict';

const { GENERIC_KEYS } = require('./no-other-reps-fraud-producer');

const CONTRACT_SCHEMA = 'NATIVE_NO_OTHER_REPS_FRAUD_CONTRACT/V1';
const OWNER_FAMILY = 'NO_OTHER_REPS_FRAUD';
const WILLFUL_BREACH_OWNER_FAMILY = 'KEY_DEFINED_TERMS';
const REMEDIES_OWNER_FAMILY = 'SPECIFIC_PERFORMANCE_REMEDIES';

const ELEMENTS = Object.freeze({
  [GENERIC_KEYS.NO_OTHER_REPS]: Object.freeze({
    claim_definition_key: 'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
    element_kind: 'NOOTHERREPS',
    owner_family: OWNER_FAMILY,
    allowed_attributes: Object.freeze(['representation_maker_ref', 'agreement_scope_quote']),
  }),
  [GENERIC_KEYS.NON_RELIANCE]: Object.freeze({
    claim_definition_key: 'NON_RELIANCE_ACKNOWLEDGMENT_PRESENT',
    element_kind: 'NONRELIANCE',
    owner_family: OWNER_FAMILY,
    allowed_attributes: Object.freeze(['relying_party_ref', 'disclaimed_representation_party_ref', 'agreement_scope_quote']),
  }),
  [GENERIC_KEYS.EXTRA_CONTRACTUAL]: Object.freeze({
    claim_definition_key: 'EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT',
    element_kind: 'NONRELIANCE',
    owner_family: OWNER_FAMILY,
    allowed_attributes: Object.freeze(['relying_party_ref', 'extra_contractual_scope_quote']),
  }),
  [GENERIC_KEYS.INDEPENDENT_INVESTIGATION]: Object.freeze({
    claim_definition_key: 'INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT_PRESENT',
    element_kind: 'INDEPINVEST',
    owner_family: OWNER_FAMILY,
    allowed_attributes: Object.freeze(['investigating_party_ref']),
  }),
  [GENERIC_KEYS.FRAUD_CARVEOUT]: Object.freeze({
    claim_definition_key: 'FRAUD_CARVEOUT_PRESENT',
    element_kind: 'FRAUDCARVEOUT',
    owner_family: OWNER_FAMILY,
    qualified_owner_family: REMEDIES_OWNER_FAMILY,
    allowed_attributes: Object.freeze([]),
  }),
  [GENERIC_KEYS.WILLFUL_BREACH_DEFINITION]: Object.freeze({
    claim_definition_key: 'WILLFUL_BREACH_DEFINITION_PRESENT',
    concept_key: 'DEF-WILLFUL',
    element_kind: 'WILLFUL_BREACH_DEFINITION',
    owner_family: WILLFUL_BREACH_OWNER_FAMILY,
    qualified_owner_family: REMEDIES_OWNER_FAMILY,
    allowed_attributes: Object.freeze(['defined_term_ref']),
  }),
});

const CLAIM_DEFINITIONS = Object.freeze(Object.fromEntries(
  Object.values(ELEMENTS).map((element) => [element.claim_definition_key, Object.freeze({
    key: element.claim_definition_key,
    revision: 1,
    value_type: 'BOOLEAN',
    allowed_states: Object.freeze(['PRESENT']),
    allowed_canonical_values: Object.freeze([true]),
    owner_family: element.owner_family,
    allowed_attributes: element.allowed_attributes,
  })]),
));

function getNoOtherRepsFraudElement(genericKey) {
  return ELEMENTS[genericKey] || null;
}

module.exports = {
  CLAIM_DEFINITIONS,
  CONTRACT_SCHEMA,
  ELEMENTS,
  OWNER_FAMILY,
  REMEDIES_OWNER_FAMILY,
  WILLFUL_BREACH_OWNER_FAMILY,
  getNoOtherRepsFraudElement,
};
