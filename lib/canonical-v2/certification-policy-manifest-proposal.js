'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  PROPOSAL_STATUS,
  validateOperationalPolicySetProposal,
} = require('./operational-policy-set-proposal');
const {
  SUCCESSOR_M1_AUTHORITY_SCHEMA,
  validateSuccessorM1Authority,
} = require('./native-producer/durable-12-item-pilot-readiness');

const CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA = 'CERTIFICATION_POLICY_MANIFEST_PROPOSAL/V1';
const REQUIRED_UNRESOLVED_CLOSURES = Object.freeze([
  'CURRENT_EFFECTIVE_TERMINAL_UNRESOLVED_ROOT',
  'GOVERNED_RESIDUAL_REVIEW_QUEUE_ROOT',
  'POST_CONFIRMATION_CHANGED_UNIT_SET',
]);
const REQUIRED_THIRD_RUN_TRIGGERS = Object.freeze([
  'EVERY_DISAGREEMENT',
  'EVERY_HIGH_RISK_FAMILY_UNIT',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function sortedUniqueText(values) {
  return Array.isArray(values)
    && values.length > 0
    && values.every((value) => typeof value === 'string' && value.trim() === value && value.length > 0)
    && new Set(values).size === values.length
    && canonicalJson(values) === canonicalJson([...values].sort());
}

function blocker(code, message) {
  return Object.freeze({ code, message });
}

function normalizeSuccessorM1(value, blockers) {
  try {
    const validated = validateSuccessorM1Authority(value);
    return Object.freeze({
      schema_version: SUCCESSOR_M1_AUTHORITY_SCHEMA,
      successor_m1_authority_id: validated.successor_m1_authority_id,
      successor_m1_acknowledgement_id: validated.successor_m1_acknowledgement_id,
      successor_bundle_id: value.successor_bundle_id,
      successor_contract_bundle_digest: value.successor_contract_bundle_digest,
      successor_canonical_payload_digest: value.successor_canonical_payload_digest,
    });
  } catch (error) {
    blockers.push(blocker('SUCCESSOR_M1_CERTIFICATION_BINDING_UNRESOLVED', error.message));
    return null;
  }
}

function requiredExplicitValue(value, code, message, blockers) {
  if (value === undefined || value === null) {
    blockers.push(blocker(code, message));
    return null;
  }
  return value;
}

function buildCertificationPolicyManifestProposal({
  operational_policy_set_proposal: operationalPolicySetProposal,
  successor_m1_authority: successorM1Authority,
  high_risk_family_ids: highRiskFamilyIds,
  registry_disposition_enum: registryDispositionEnum,
  semantic_diff_classifications: semanticDiffClassifications,
  recovery_counter_inventory: recoveryCounterInventory,
  certification_methods: certificationMethods,
  pass_thresholds: passThresholds,
  soak_test_formula: soakTestFormula,
  restore_or_rollback_success_criteria: restoreOrRollbackSuccessCriteria,
} = {}) {
  const blockers = [];
  let operationalPolicySet = null;
  try {
    operationalPolicySet = validateOperationalPolicySetProposal(operationalPolicySetProposal);
  } catch (error) {
    blockers.push(blocker('OPERATIONAL_POLICY_SET_UNRESOLVED', error.message));
  }
  const successorM1 = normalizeSuccessorM1(successorM1Authority, blockers);
  if (!sortedUniqueText(highRiskFamilyIds)) {
    blockers.push(blocker('HIGH_RISK_FAMILY_UNIVERSE_UNRESOLVED', 'The exact high-risk-family universe is not fixed by the current approved plan.'));
  }
  const explicitValues = {
    registry_disposition_enum: requiredExplicitValue(registryDispositionEnum, 'REGISTRY_DISPOSITION_ENUM_UNRESOLVED', 'Registry disposition selection must be explicit.', blockers),
    semantic_diff_classifications: requiredExplicitValue(semanticDiffClassifications, 'SEMANTIC_DIFF_CLASSIFICATIONS_UNRESOLVED', 'Semantic-diff classifications must be explicit.', blockers),
    recovery_counter_inventory: requiredExplicitValue(recoveryCounterInventory, 'RECOVERY_COUNTER_INVENTORY_UNRESOLVED', 'Recovery-counter inventory must be explicit.', blockers),
    certification_methods: requiredExplicitValue(certificationMethods, 'CERTIFICATION_METHODS_UNRESOLVED', 'Certification methods must be explicit.', blockers),
    pass_thresholds: requiredExplicitValue(passThresholds, 'PASS_THRESHOLDS_UNRESOLVED', 'Pass thresholds must be explicit.', blockers),
    soak_test_formula: requiredExplicitValue(soakTestFormula, 'SOAK_TEST_FORMULA_UNRESOLVED', 'Soak-test formula must be explicit.', blockers),
    restore_or_rollback_success_criteria: requiredExplicitValue(restoreOrRollbackSuccessCriteria, 'RESTORE_OR_ROLLBACK_CRITERIA_UNRESOLVED', 'Restore or rollback success criteria must be explicit.', blockers),
  };
  const sortedBlockers = Object.freeze([...blockers].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  )));
  const body = {
    schema_version: CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA,
    status: PROPOSAL_STATUS,
    production_authority: 'NONE',
    adoption_authority: 'NOT_GRANTED',
    operational_policy_set_proposal_id: operationalPolicySet?.operational_policy_set_proposal_id || null,
    successor_m1_certification_binding: successorM1,
    high_risk_family_ids: sortedUniqueText(highRiskFamilyIds) ? Object.freeze([...highRiskFamilyIds]) : null,
    certification_execution: Object.freeze({
      full_shadow_run_count: 2,
      required_third_run_triggers: REQUIRED_THIRD_RUN_TRIGGERS,
      majority_selection_forbidden: true,
      human_adjudication_required_for_disagreement: true,
      fresh_confirming_run_required_after_affected_change: true,
      required_empty_terminal_sets: REQUIRED_UNRESOLVED_CLOSURES,
    }),
    registry_disposition_enum: explicitValues.registry_disposition_enum,
    semantic_diff_classifications: explicitValues.semantic_diff_classifications,
    recovery_counter_inventory: explicitValues.recovery_counter_inventory,
    certification_methods: explicitValues.certification_methods,
    pass_thresholds: explicitValues.pass_thresholds,
    soak_test_formula: explicitValues.soak_test_formula,
    restore_or_rollback_success_criteria: explicitValues.restore_or_rollback_success_criteria,
    blockers: sortedBlockers,
  };
  return Object.freeze({
    ...body,
    certification_policy_manifest_proposal_id: contentId(CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA, body),
  });
}

function validateCertificationPolicyManifestProposal(proposal) {
  const keys = [
    'adoption_authority', 'blockers', 'certification_execution', 'certification_methods',
    'certification_policy_manifest_proposal_id', 'high_risk_family_ids',
    'operational_policy_set_proposal_id', 'pass_thresholds', 'production_authority',
    'recovery_counter_inventory', 'registry_disposition_enum',
    'restore_or_rollback_success_criteria', 'schema_version', 'semantic_diff_classifications',
    'soak_test_formula', 'status', 'successor_m1_certification_binding',
  ];
  if (!exactKeys(proposal, keys)
    || proposal.schema_version !== CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA
    || proposal.status !== PROPOSAL_STATUS
    || proposal.production_authority !== 'NONE'
    || proposal.adoption_authority !== 'NOT_GRANTED') {
    throw new TypeError('Certification-policy proposal has an invalid non-authority shape.');
  }
  const { certification_policy_manifest_proposal_id: proposalId, ...body } = proposal;
  if (!isDigest(proposalId) || proposalId !== contentId(CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA, body)) {
    throw new TypeError('Certification-policy proposal does not match its content identity.');
  }
  return Object.freeze({ ...proposal });
}

module.exports = {
  CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA,
  REQUIRED_THIRD_RUN_TRIGGERS,
  REQUIRED_UNRESOLVED_CLOSURES,
  buildCertificationPolicyManifestProposal,
  validateCertificationPolicyManifestProposal,
};
