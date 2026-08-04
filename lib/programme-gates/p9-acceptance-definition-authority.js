const { domainDigest } = require('./bytes');

const AUTHORITY_SCHEMA_VERSION = 'P9AcceptanceDefinitionRecoveryAuthority/V2';
const AUTHORITY_ID_DOMAIN = 'PROGRAMME_GATE_P9_ACCEPTANCE_DEFINITION_RECOVERY_AUTHORITY/V2';
const FORMAL_DEFINITION_ISSUANCE = 'PROHIBITED_UNTIL_GOVERNING_AMENDMENT_AND_EXECUTABLE_DEFINITIONS';
const PASS_ISSUANCE = 'PROHIBITED';

const CURRENT_LIVE_P9_GATE_IDS = Object.freeze([
  'P9_SCOPE_EXACT',
  'P9_REGISTRY_DISPOSITIONS',
  'P9_MKT_WORK',
  'P9_BEN_RUNBOOK',
  'P9_NUMERIC',
  'P9_RENDER_PARITY',
  'P9_STRUCTURED_CLAIMS',
  'P9_PARTY_LINT',
  'P9_SHADOW_REEXTRACTION',
  'P9_IDENTITY_AND_DRIFT',
  'P9_BROWSER_A11Y_PERFORMANCE',
  'P9_STAGING_SMOKE_AND_ROLLBACK',
  'P9_DATABASE_SOAK',
  'P9_BACKUP_RESTORE',
  'P9_PREIMPORT_TRACEABILITY',
  'P9_DEPLOYMENT_PARITY',
  'P9_IMPORT_PARITY',
  'P9_PROMOTION_ELIGIBILITY',
  'P9_CUTOVER_AUTHORISATION',
  'P9_POSTCUTOVER_SMOKE',
  'P9_TRACEABILITY',
]);

const COMPLETION_GATE_ID = 'P9_PROGRAMME_COMPLETION_ATTESTATION';
const RECOVERED_CANDIDATE_P9_GATE_IDS = Object.freeze([
  ...CURRENT_LIVE_P9_GATE_IDS,
  COMPLETION_GATE_ID,
]);

const GOVERNING_INVENTORY_CONFLICT = Object.freeze({
  code: 'P9_COMPLETION_LEAF_RATIFICATION_REQUIRED',
  live_gate_count: CURRENT_LIVE_P9_GATE_IDS.length,
  recovered_candidate_gate_count: RECOVERED_CANDIDATE_P9_GATE_IDS.length,
  missing_live_gate_id: COMPLETION_GATE_ID,
  decision_state: 'BLOCKED_PENDING_BEN_RATIFICATION',
  recommended_disposition: 'RESTORE_AS_BUNDLE_FROZEN_TERMINAL_LEAF',
});

const SCOPE_INVENTORY_RULE = Object.freeze({
  inventory_model: 'ONE_DETERMINISTIC_COMPLETE_CORPUS_SCOPE_INVENTORY',
  required_validation: Object.freeze([
    'FOCUSED_CORRECTNESS_TESTS',
    'HOSTILE_CORRECTNESS_TESTS',
  ]),
  dual_independent_rule: 'GOLDEN_EXTRACTION_COMPARISON_ONLY',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function sameOrder(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function requireLiveP9GateIds(gateIds) {
  if (!sameOrder(gateIds, CURRENT_LIVE_P9_GATE_IDS)) {
    throw new Error('live P9 gate inventory differs from the recorded governing conflict');
  }
}

function leafFor(gateId) {
  return Object.freeze({
    gate_id: gateId,
    recovery_state: gateId === COMPLETION_GATE_ID
      ? 'RECOVERED_FROM_CONTRACT_AND_HOSTILE_TEST_NOT_LIVE'
      : 'LIVE_ID_RECOVERED_DEFINITION_NOT_ADOPTED',
    definition_state: 'DRAFT_BLOCKED_EXECUTABLE_PREDICATE',
    required_ben_decision: gateId === COMPLETION_GATE_ID
      ? GOVERNING_INVENTORY_CONFLICT.code
      : null,
    formal_definition_issuance: FORMAL_DEFINITION_ISSUANCE,
    pass_issuance: PASS_ISSUANCE,
  });
}

function authorityPayload(authority) {
  return {
    schema_version: authority.schema_version,
    live_p9_gate_ids: authority.live_p9_gate_ids,
    recovered_candidate_p9_gate_ids: authority.recovered_candidate_p9_gate_ids,
    governing_inventory_conflict: authority.governing_inventory_conflict,
    scope_inventory_rule: authority.scope_inventory_rule,
    leaves: authority.leaves,
    formal_definition_issuance: authority.formal_definition_issuance,
    pass_issuance: authority.pass_issuance,
  };
}

function compileP9AcceptanceDefinitionAuthority({ p9GateIds }) {
  requireLiveP9GateIds(p9GateIds);
  const authority = {
    schema_version: AUTHORITY_SCHEMA_VERSION,
    authority_id: '0'.repeat(64),
    authority_digest: '0'.repeat(64),
    live_p9_gate_ids: Object.freeze([...CURRENT_LIVE_P9_GATE_IDS]),
    recovered_candidate_p9_gate_ids: Object.freeze([...RECOVERED_CANDIDATE_P9_GATE_IDS]),
    governing_inventory_conflict: GOVERNING_INVENTORY_CONFLICT,
    scope_inventory_rule: SCOPE_INVENTORY_RULE,
    leaves: Object.freeze(RECOVERED_CANDIDATE_P9_GATE_IDS.map(leafFor)),
    formal_definition_issuance: FORMAL_DEFINITION_ISSUANCE,
    pass_issuance: PASS_ISSUANCE,
  };
  const digest = domainDigest(AUTHORITY_ID_DOMAIN, authorityPayload(authority));
  authority.authority_id = digest;
  authority.authority_digest = digest;
  return deepFreeze(authority);
}

function validateP9AcceptanceDefinitionAuthority(authority, { p9GateIds }) {
  requireLiveP9GateIds(p9GateIds);
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
    throw new Error('P9 acceptance-definition recovery authority must be an object');
  }
  if (authority.schema_version !== AUTHORITY_SCHEMA_VERSION
    || authority.formal_definition_issuance !== FORMAL_DEFINITION_ISSUANCE
    || authority.pass_issuance !== PASS_ISSUANCE
    || !sameOrder(authority.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS)
    || !sameOrder(authority.recovered_candidate_p9_gate_ids, RECOVERED_CANDIDATE_P9_GATE_IDS)
    || authority.governing_inventory_conflict?.code !== GOVERNING_INVENTORY_CONFLICT.code
    || authority.governing_inventory_conflict?.decision_state
      !== GOVERNING_INVENTORY_CONFLICT.decision_state
    || authority.scope_inventory_rule?.inventory_model !== SCOPE_INVENTORY_RULE.inventory_model
    || !sameOrder(
      authority.scope_inventory_rule?.required_validation,
      SCOPE_INVENTORY_RULE.required_validation,
    )
    || authority.scope_inventory_rule?.dual_independent_rule
      !== SCOPE_INVENTORY_RULE.dual_independent_rule
    || !Array.isArray(authority.leaves)
    || authority.leaves.length !== RECOVERED_CANDIDATE_P9_GATE_IDS.length) {
    throw new Error('P9 acceptance-definition recovery authority is not fail-closed');
  }
  for (const [index, leaf] of authority.leaves.entries()) {
    const gateId = RECOVERED_CANDIDATE_P9_GATE_IDS[index];
    const expectedDecision = gateId === COMPLETION_GATE_ID
      ? GOVERNING_INVENTORY_CONFLICT.code
      : null;
    const expectedRecoveryState = gateId === COMPLETION_GATE_ID
      ? 'RECOVERED_FROM_CONTRACT_AND_HOSTILE_TEST_NOT_LIVE'
      : 'LIVE_ID_RECOVERED_DEFINITION_NOT_ADOPTED';
    if (!leaf || leaf.gate_id !== gateId
      || leaf.recovery_state !== expectedRecoveryState
      || leaf.required_ben_decision !== expectedDecision
      || leaf.definition_state !== 'DRAFT_BLOCKED_EXECUTABLE_PREDICATE'
      || leaf.formal_definition_issuance !== FORMAL_DEFINITION_ISSUANCE
      || leaf.pass_issuance !== PASS_ISSUANCE) {
      throw new Error(`P9 acceptance-definition recovery leaf ${gateId} is not fail-closed`);
    }
  }
  const digest = domainDigest(AUTHORITY_ID_DOMAIN, authorityPayload(authority));
  if (authority.authority_id !== digest || authority.authority_digest !== digest) {
    throw new Error('P9 acceptance-definition recovery authority digest is stale');
  }
  return true;
}

module.exports = {
  AUTHORITY_ID_DOMAIN,
  AUTHORITY_SCHEMA_VERSION,
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
  FORMAL_DEFINITION_ISSUANCE,
  GOVERNING_INVENTORY_CONFLICT,
  PASS_ISSUANCE,
  RECOVERED_CANDIDATE_P9_GATE_IDS,
  SCOPE_INVENTORY_RULE,
  authorityPayload,
  compileP9AcceptanceDefinitionAuthority,
  validateP9AcceptanceDefinitionAuthority,
};
