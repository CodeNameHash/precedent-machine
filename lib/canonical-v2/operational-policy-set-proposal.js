'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');
const { PROFILES } = require('./native-producer/codex-cli-provider');
const {
  SUCCESSOR_M1_AUTHORITY_SCHEMA,
  validateSuccessorM1Authority,
} = require('./native-producer/durable-12-item-pilot-readiness');

const OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA = 'OPERATIONAL_POLICY_SET_PROPOSAL/V2';
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
const TELEMETRY_SAMPLE_POLICY = Object.freeze({
  minimum_call_count: 24,
  maximum_call_count: 50,
  selection: 'STRATIFIED_REPRESENTATIVE_CALLS',
  required_receipt: 'SEALED_COST_AND_TIMING_RECEIPT',
});
const PROMPT_PACKING_POLICY = Object.freeze({
  eligibility: 'PER_FAMILY_ONLY_AFTER_MATCHED_PROOF',
  minimum_matched_item_count: 50,
  required_shared_dimensions: Object.freeze(['SOURCE', 'FAMILY']),
  required_item_boundaries: 'EXPLICIT',
  required_section_provenance: 'EXACT',
  material_difference_fields: Object.freeze([
    'CONCEPTS', 'CLAIMS', 'PARTIES', 'QUALIFIERS', 'VALUES',
    'EVIDENCE_SPANS', 'DISPOSITIONS', 'COMPARABILITY',
  ]),
  on_material_difference: 'REJECT_PACKING_FOR_FAMILY',
});
const SOURCE_DISPOSITION_AUTOMATION_POLICY = Object.freeze({
  automatic_terminal_dispositions: Object.freeze([
    'EXACT_RAW_BYTE_DUPLICATE',
    'NON_DOCUMENT_TRANSPORT_WRAPPER',
  ]),
  all_other_dispositions: 'REQUIRE_GOVERNED_REVIEW_AND_REQUIRED_APPROVAL',
});
const DARK_DEPLOY_POLICY = Object.freeze({
  earliest_preconditions: Object.freeze([
    'SUCCESSOR_M1_PASS',
    'NORMAL_REVIEW_PASS',
    'COMPLETE_TEST_SUITE_PASS',
    'BUILD_CHECK_PASS',
  ]),
  feature_flags: 'CLOSED',
  canonical_v2_production_writer: 'ABSENT',
  canonical_v2_production_credential: 'ABSENT',
  corpus_data: 'ABSENT',
  inactive_import_path: 'ABSENT',
  activation_path: 'ABSENT',
});
const IMPORT_RUNNER_POLICY = Object.freeze({
  runner: 'HERMETIC_SIGNED_RUNNER',
  credential: 'SHORT_LIVED_LEAST_PRIVILEGE',
  permitted_operation: 'EXACT_AUTHORISED_INACTIVE_IMPORT_ONLY',
  activation_authority: 'NONE',
});
const DATABASE_PARITY_POLICY = Object.freeze({
  required_comparisons: Object.freeze([
    'CONTENT_ROOTS', 'STATISTICS', 'SEMANTIC_QUERY_RESULTS',
    'GOVERNED_LATENCY_LIMITS', 'APPROVED_QUERY_PLAN_CLASSES',
  ]),
  exact_query_plan_fingerprint_requirement: 'DIAGNOSTIC_ONLY_NOT_EQUALITY_GATE',
});
const EXTRACTION_PROFILE = Object.freeze({
  profile_id: PROFILES.TERRA_MEDIUM.profile_id,
  model: PROFILES.TERRA_MEDIUM.model,
  reasoning_effort: PROFILES.TERRA_MEDIUM.reasoning_effort,
});
const SHADOW_EXECUTION_POLICY = Object.freeze({
  resumable_lane_count: 2,
  required_raw_response_telemetry_schemas: REQUIRED_RAW_RESPONSE_TELEMETRY,
  replay_invalidation_plan_schema: REPLAY_INVALIDATION_PLAN_SCHEMA,
});

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

function validNormalizedSuccessorM1Binding(value) {
  const keys = [
    'schema_version', 'successor_m1_authority_id', 'successor_m1_acknowledgement_id',
    'successor_bundle_id', 'successor_contract_bundle_digest',
    'successor_canonical_payload_digest',
  ];
  return exactKeys(value, keys)
    && value.schema_version === SUCCESSOR_M1_AUTHORITY_SCHEMA
    && keys.slice(1).every((key) => isDigest(value[key]));
}

function validBlockerSet(proposal) {
  if (!Array.isArray(proposal.blockers)
    || proposal.blockers.some((entry) => !exactKeys(entry, ['code', 'message'])
      || typeof entry.code !== 'string' || entry.code.length === 0
      || typeof entry.message !== 'string' || entry.message.length === 0)) return false;
  const sorted = [...proposal.blockers].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  ));
  if (canonicalJson(proposal.blockers) !== canonicalJson(sorted)
    || new Set(proposal.blockers.map(({ code }) => code)).size !== proposal.blockers.length) return false;

  const codes = new Set(proposal.blockers.map(({ code }) => code));
  const manifestCodes = ['OPERATIONAL_POLICY_MANIFEST_SET_UNRESOLVED', 'OPERATIONAL_POLICY_MANIFEST_ID_INVALID'];
  const durableCodes = [
    'DURABLE_ARTIFACT_ROOT_REQUIRED', 'DURABLE_ARTIFACT_ROOT_TEMPORARY',
    'DURABLE_ARTIFACT_ROOT_NOT_ABSOLUTE', 'DURABLE_ARTIFACT_ROOT_UNAVAILABLE',
  ];
  const allowed = new Set();
  if (proposal.policy_manifest_ids === null) manifestCodes.forEach((code) => allowed.add(code));
  if (proposal.successor_m1_adoption_binding === null) allowed.add('SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED');
  if (proposal.durable_artifact_root === null) durableCodes.forEach((code) => allowed.add(code));
  if ([...codes].some((code) => !allowed.has(code))) return false;
  const exactlyOne = (candidates) => candidates.filter((code) => codes.has(code)).length === 1;
  return (proposal.policy_manifest_ids === null ? exactlyOne(manifestCodes) : !exactlyOne(manifestCodes))
    && (proposal.successor_m1_adoption_binding === null
      ? codes.has('SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED')
      : !codes.has('SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED'))
    && (proposal.durable_artifact_root === null ? exactlyOne(durableCodes) : !exactlyOne(durableCodes));
}

function validDynamicBindings(proposal) {
  if (proposal.policy_manifest_ids !== null) {
    if (!exactKeys(proposal.policy_manifest_ids, REQUIRED_POLICY_MANIFEST_KEYS)
      || Object.values(proposal.policy_manifest_ids).some((id) => !isDigest(id))) return false;
  }
  if (proposal.successor_m1_adoption_binding !== null
    && !validNormalizedSuccessorM1Binding(proposal.successor_m1_adoption_binding)) return false;
  if (proposal.durable_artifact_root !== null) {
    try {
      const resolved = resolveDurableArtifactRoot({
        root: proposal.durable_artifact_root,
        certificationMode: true,
        requireExisting: true,
      });
      if (resolved !== proposal.durable_artifact_root) return false;
    } catch (_) {
      return false;
    }
  }
  return validBlockerSet(proposal);
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

function rejectCallerPolicyValues(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).length > 0) {
    throw new TypeError('Operational policy proposals derive the current exact policy shape and accept no caller-supplied manifests, successor records, roots, or policy values.');
  }
}

function buildOperationalPolicySetProposal(options = {}) {
  rejectCallerPolicyValues(options);
  const policyManifestIds = undefined;
  const successorM1Authority = undefined;
  const durableArtifactRootInput = undefined;
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
    extraction_profile: EXTRACTION_PROFILE,
    shadow_execution: SHADOW_EXECUTION_POLICY,
    telemetry_sample_policy: TELEMETRY_SAMPLE_POLICY,
    prompt_packing_policy: PROMPT_PACKING_POLICY,
    source_disposition_automation_policy: SOURCE_DISPOSITION_AUTOMATION_POLICY,
    database_parity_policy: DATABASE_PARITY_POLICY,
    import_runner_policy: IMPORT_RUNNER_POLICY,
    dark_deploy_policy: DARK_DEPLOY_POLICY,
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
    'dark_deploy_policy', 'database_parity_policy', 'extraction_profile',
    'import_runner_policy', 'operational_policy_set_proposal_id', 'policy_manifest_ids',
    'production_authority', 'prompt_packing_policy', 'schema_version', 'shadow_execution',
    'source_disposition_automation_policy', 'status', 'stop_conditions',
    'successor_m1_adoption_binding', 'telemetry_sample_policy',
  ];
  if (!exactKeys(proposal, keys)
    || proposal.schema_version !== OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA
    || proposal.status !== PROPOSAL_STATUS
    || proposal.production_authority !== 'NONE'
    || proposal.adoption_authority !== 'NOT_GRANTED'
    || canonicalJson(proposal.extraction_profile) !== canonicalJson(EXTRACTION_PROFILE)
    || canonicalJson(proposal.shadow_execution) !== canonicalJson(SHADOW_EXECUTION_POLICY)
    || canonicalJson(proposal.telemetry_sample_policy) !== canonicalJson(TELEMETRY_SAMPLE_POLICY)
    || canonicalJson(proposal.prompt_packing_policy) !== canonicalJson(PROMPT_PACKING_POLICY)
    || canonicalJson(proposal.source_disposition_automation_policy) !== canonicalJson(SOURCE_DISPOSITION_AUTOMATION_POLICY)
    || canonicalJson(proposal.database_parity_policy) !== canonicalJson(DATABASE_PARITY_POLICY)
    || canonicalJson(proposal.import_runner_policy) !== canonicalJson(IMPORT_RUNNER_POLICY)
    || canonicalJson(proposal.dark_deploy_policy) !== canonicalJson(DARK_DEPLOY_POLICY)
    || canonicalJson(proposal.cache_key_dimensions) !== canonicalJson(CACHE_KEY_DIMENSIONS)
    || canonicalJson(proposal.stop_conditions) !== canonicalJson(STOP_CONDITIONS)
    || !validDynamicBindings(proposal)) {
    throw new TypeError('Operational policy-set proposal has an invalid non-authority shape.');
  }
  const { operational_policy_set_proposal_id: proposalId, ...body } = proposal;
  if (!isDigest(proposalId) || proposalId !== contentId(OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA, body)) {
    throw new TypeError('Operational policy-set proposal does not match its content identity.');
  }
  const expected = buildOperationalPolicySetProposal();
  if (canonicalJson(proposal) !== canonicalJson(expected)) {
    throw new TypeError('Operational policy-set proposal is stale, forged, partial, or contains caller-supplied policy values.');
  }
  return expected;
}

module.exports = {
  OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA,
  PROPOSAL_STATUS,
  REPLAY_INVALIDATION_PLAN_SCHEMA,
  CACHE_KEY_DIMENSIONS,
  REQUIRED_POLICY_MANIFEST_KEYS,
  REQUIRED_RAW_RESPONSE_TELEMETRY,
  STOP_CONDITIONS,
  EXTRACTION_PROFILE,
  SHADOW_EXECUTION_POLICY,
  TELEMETRY_SAMPLE_POLICY,
  PROMPT_PACKING_POLICY,
  SOURCE_DISPOSITION_AUTOMATION_POLICY,
  DATABASE_PARITY_POLICY,
  IMPORT_RUNNER_POLICY,
  DARK_DEPLOY_POLICY,
  buildOperationalPolicySetProposal,
  validateOperationalPolicySetProposal,
};
