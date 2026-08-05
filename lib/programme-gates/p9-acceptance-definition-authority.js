const { isDeepStrictEqual } = require('node:util');

const { domainDigest } = require('./bytes');

const AUTHORITY_SCHEMA_VERSION = 'P9AcceptanceDefinitionRecoveryAuthority/V3';
const AUTHORITY_ID_DOMAIN = 'PROGRAMME_GATE_P9_ACCEPTANCE_DEFINITION_RECOVERY_AUTHORITY/V3';
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
  'P9_SECURITY_AUTH',
  'P9_DEPLOYMENT_PARITY',
  'P9_IMPORT_PARITY',
  'P9_PROMOTION_ELIGIBILITY',
  'P9_CUTOVER_AUTHORISATION',
  'P9_POSTCUTOVER_SMOKE',
  'P9_TRACEABILITY',
  'P9_PROGRAMME_COMPLETION_ATTESTATION',
]);

const COMPLETION_GATE_ID = 'P9_PROGRAMME_COMPLETION_ATTESTATION';
const SECURITY_GATE_ID = 'P9_SECURITY_AUTH';
const COMPLETE_P9_GATE_IDS = CURRENT_LIVE_P9_GATE_IDS;

const GOVERNING_INVENTORY_DECISION = Object.freeze({
  code: 'P9_COMPLETION_LEAF_RATIFIED',
  live_gate_count: CURRENT_LIVE_P9_GATE_IDS.length,
  complete_gate_count: COMPLETE_P9_GATE_IDS.length,
  completion_gate_id: COMPLETION_GATE_ID,
  security_gate_id: SECURITY_GATE_ID,
  decision_state: 'RATIFIED_AND_RECORDED',
  disposition: 'LIVE_BUNDLE_FROZEN_TERMINAL_LEAF',
  production_access_prerequisite: 'P9_SECURITY_AUTH_PASS',
  authority: 'GATE_INVENTORY_ONLY_NO_PASS_OR_PRODUCTION_AUTHORITY',
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

function exactKeys(value, expectedKeys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && sameOrder(Object.keys(value).sort(), [...expectedKeys].sort());
}

function requireLiveP9GateIds(gateIds) {
  if (!sameOrder(gateIds, CURRENT_LIVE_P9_GATE_IDS)) {
    throw new Error('live P9 gate inventory differs from the recorded governing conflict');
  }
}

function leafFor(gateId) {
  let recoveryState = 'LIVE_ID_RECOVERED_DEFINITION_NOT_ADOPTED';
  if (gateId === SECURITY_GATE_ID) recoveryState = 'LIVE_PRODUCTION_ACCESS_PREREQUISITE_DEFINITION_NOT_ADOPTED';
  if (gateId === COMPLETION_GATE_ID) recoveryState = 'LIVE_RATIFIED_BUNDLE_FROZEN_TERMINAL_DEFINITION_NOT_ADOPTED';
  return Object.freeze({
    gate_id: gateId,
    recovery_state: recoveryState,
    definition_state: 'DRAFT_BLOCKED_EXECUTABLE_PREDICATE',
    required_ben_decision: null,
    formal_definition_issuance: FORMAL_DEFINITION_ISSUANCE,
    pass_issuance: PASS_ISSUANCE,
  });
}

function authorityPayload(authority) {
  return {
    schema_version: authority.schema_version,
    live_p9_gate_ids: authority.live_p9_gate_ids,
    complete_p9_gate_ids: authority.complete_p9_gate_ids,
    governing_inventory_decision: authority.governing_inventory_decision,
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
    complete_p9_gate_ids: Object.freeze([...COMPLETE_P9_GATE_IDS]),
    governing_inventory_decision: GOVERNING_INVENTORY_DECISION,
    scope_inventory_rule: SCOPE_INVENTORY_RULE,
    leaves: Object.freeze(COMPLETE_P9_GATE_IDS.map(leafFor)),
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
  if (!exactKeys(authority, [
    'authority_digest', 'authority_id', 'complete_p9_gate_ids',
    'formal_definition_issuance', 'governing_inventory_decision', 'leaves',
    'live_p9_gate_ids', 'pass_issuance', 'schema_version', 'scope_inventory_rule',
  ])) {
    throw new Error('P9 acceptance-definition recovery authority must be an object');
  }
  if (authority.schema_version !== AUTHORITY_SCHEMA_VERSION
    || authority.formal_definition_issuance !== FORMAL_DEFINITION_ISSUANCE
    || authority.pass_issuance !== PASS_ISSUANCE
    || !sameOrder(authority.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS)
    || !sameOrder(authority.complete_p9_gate_ids, COMPLETE_P9_GATE_IDS)
    || !isDeepStrictEqual(authority.governing_inventory_decision, GOVERNING_INVENTORY_DECISION)
    || !isDeepStrictEqual(authority.scope_inventory_rule, SCOPE_INVENTORY_RULE)
    || !Array.isArray(authority.leaves)
    || authority.leaves.length !== COMPLETE_P9_GATE_IDS.length) {
    throw new Error('P9 acceptance-definition recovery authority is not fail-closed');
  }
  for (const [index, leaf] of authority.leaves.entries()) {
    const gateId = COMPLETE_P9_GATE_IDS[index];
    if (!isDeepStrictEqual(leaf, leafFor(gateId))) {
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
  COMPLETE_P9_GATE_IDS,
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
  FORMAL_DEFINITION_ISSUANCE,
  GOVERNING_INVENTORY_DECISION,
  PASS_ISSUANCE,
  SECURITY_GATE_ID,
  SCOPE_INVENTORY_RULE,
  authorityPayload,
  compileP9AcceptanceDefinitionAuthority,
  validateP9AcceptanceDefinitionAuthority,
};
