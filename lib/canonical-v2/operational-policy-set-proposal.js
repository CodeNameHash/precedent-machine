'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');
const { PROFILES } = require('./native-producer/codex-cli-provider');
const {
  SUCCESSOR_M1_AUTHORITY_SCHEMA,
  validateSuccessorM1Authority,
} = require('./native-producer/durable-12-item-pilot-readiness');

const OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA = 'OPERATIONAL_POLICY_SET_PROPOSAL/V1';
const PROPOSAL_STATUS = 'PROPOSED_NOT_AUTHORITY';
const REQUIRED_POLICY_MANIFEST_KEYS = Object.freeze([
  'archive_safety_policy_manifest_id',
  'cache_budget_manifest_id',
  'capacity_manifest_id',
  'route_budget_manifest_id',
]);
const REQUIRED_RAW_RESPONSE_TELEMETRY = Object.freeze([
  'NATIVE_UNIFIED_RUN_PROVIDER_RECORDING/V1',
  'NATIVE_UNIFIED_RUN_WORK_ITEM_TELEMETRY/V1',
]);
const REPLAY_INVALIDATION_PLAN_SCHEMA = 'M3_REPLAY_INVALIDATION_PLAN/V1';
const CACHE_KEY_DIMENSIONS = Object.freeze([
  'FAMILY',
  'MODEL_PROFILE',
  'PROMPT_VERSION',
  'SECTION_IDENTITY',
  'SOURCE_DIGEST',
]);
const STOP_CONDITIONS = Object.freeze([
  'NO_CALL_COMPLETES_WITHIN_30_MINUTES',
  'SOURCE_IDENTITY_CHANGES',
  'TELEMETRY_DISAPPEARS',
  'THREE_PROVIDER_LIMIT_FAILURES_WITHIN_60_MINUTES',
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

function blocker(code, message) {
  return Object.freeze({ code, message });
}

function normalizeManifestIds(value, blockers) {
  if (!exactKeys(value, REQUIRED_POLICY_MANIFEST_KEYS)) {
    blockers.push(blocker('OPERATIONAL_POLICY_MANIFEST_SET_UNRESOLVED', 'The four operational policy manifest identities must be explicit.'));
    return null;
  }
  const normalized = Object.fromEntries(REQUIRED_POLICY_MANIFEST_KEYS.map((key) => [key, value[key]]));
  if (Object.values(normalized).some((id) => !isDigest(id))) {
    blockers.push(blocker('OPERATIONAL_POLICY_MANIFEST_ID_INVALID', 'Every operational policy manifest identity must be a SHA-256 digest.'));
    return null;
  }
  return Object.freeze(normalized);
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
    blockers.push(blocker('SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED', error.message));
    return null;
  }
}

function buildOperationalPolicySetProposal({
  policy_manifest_ids: policyManifestIds,
  successor_m1_authority: successorM1Authority,
  durable_artifact_root: durableArtifactRootInput,
} = {}) {
  const blockers = [];
  const manifestIds = normalizeManifestIds(policyManifestIds, blockers);
  const successorM1 = normalizeSuccessorM1(successorM1Authority, blockers);
  let durableArtifactRoot = null;
  try {
    durableArtifactRoot = resolveDurableArtifactRoot({
      root: durableArtifactRootInput,
      certificationMode: true,
      requireExisting: true,
    });
  } catch (error) {
    blockers.push(blocker(error?.code || 'DURABLE_ARTIFACT_ROOT_REQUIRED', error?.message || 'A durable artifact root is required.'));
  }
  const terra = PROFILES.TERRA_MEDIUM;
  const sortedBlockers = Object.freeze([...blockers].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  )));
  const body = {
    schema_version: OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA,
    status: PROPOSAL_STATUS,
    production_authority: 'NONE',
    adoption_authority: 'NOT_GRANTED',
    successor_m1_adoption_binding: successorM1,
    policy_manifest_ids: manifestIds,
    durable_artifact_root: durableArtifactRoot,
    extraction_profile: Object.freeze({
      profile_id: terra.profile_id,
      model: terra.model,
      reasoning_effort: terra.reasoning_effort,
    }),
    shadow_execution: Object.freeze({
      resumable_lane_count: 2,
      required_raw_response_telemetry_schemas: REQUIRED_RAW_RESPONSE_TELEMETRY,
      replay_invalidation_plan_schema: REPLAY_INVALIDATION_PLAN_SCHEMA,
    }),
    cache_key_dimensions: CACHE_KEY_DIMENSIONS,
    stop_conditions: STOP_CONDITIONS,
    blockers: sortedBlockers,
  };
  return Object.freeze({
    ...body,
    operational_policy_set_proposal_id: contentId(OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA, body),
  });
}

function validateOperationalPolicySetProposal(proposal) {
  const keys = [
    'adoption_authority', 'blockers', 'cache_key_dimensions', 'durable_artifact_root',
    'extraction_profile', 'operational_policy_set_proposal_id', 'policy_manifest_ids',
    'production_authority', 'schema_version', 'shadow_execution', 'status',
    'stop_conditions', 'successor_m1_adoption_binding',
  ];
  if (!exactKeys(proposal, keys)
    || proposal.schema_version !== OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA
    || proposal.status !== PROPOSAL_STATUS
    || proposal.production_authority !== 'NONE'
    || proposal.adoption_authority !== 'NOT_GRANTED') {
    throw new TypeError('Operational policy-set proposal has an invalid non-authority shape.');
  }
  const { operational_policy_set_proposal_id: proposalId, ...body } = proposal;
  if (!isDigest(proposalId) || proposalId !== contentId(OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA, body)) {
    throw new TypeError('Operational policy-set proposal does not match its content identity.');
  }
  return Object.freeze({ ...proposal });
}

module.exports = {
  OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA,
  PROPOSAL_STATUS,
  REPLAY_INVALIDATION_PLAN_SCHEMA,
  CACHE_KEY_DIMENSIONS,
  REQUIRED_POLICY_MANIFEST_KEYS,
  REQUIRED_RAW_RESPONSE_TELEMETRY,
  STOP_CONDITIONS,
  buildOperationalPolicySetProposal,
  validateOperationalPolicySetProposal,
};
