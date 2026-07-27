const { domainDigest } = require('./bytes');
const { schemaFor } = require('./schema-registry');

const SCHEMA_REGISTRY_DOMAIN = 'PROGRAMME_GATE_SCHEMA_REGISTRY/V1';
const VALIDATOR_CONFIGURATION_DOMAIN = 'PROGRAMME_GATE_VALIDATOR_CONFIGURATION/V1';
const TRUSTED_PUBLIC_KEY_REGISTRY_DOMAIN = 'PROGRAMME_GATE_TRUSTED_PUBLIC_KEY_REGISTRY/V1';
const REVIEW_LANE_REGISTRY_DOMAIN = 'PROGRAMME_GATE_REVIEW_LANE_REGISTRY/V1';
const ACCEPTANCE_DESCRIPTOR_SET_DOMAIN =
  'PROGRAMME_GATE_ACCEPTANCE_DEFINITION_DESCRIPTOR_SET/V1';

const REVIEW_LANES = Object.freeze([
  Object.freeze({
    lane_id: 'ARCHITECTURE',
    required_reviewer_profile: 'INDEPENDENT_REVIEWER',
    registered_prompt_id: 'COLD_ARCHITECTURE_REVIEW/V1',
  }),
  Object.freeze({
    lane_id: 'LEGAL_SEMANTIC',
    required_reviewer_profile: 'FABLE_OR_SOL_5_6_EXTRA_HIGH',
    registered_prompt_id: 'COLD_LEGAL_SEMANTIC_REVIEW/V1',
  }),
  Object.freeze({
    lane_id: 'QUERY_EFFICIENCY',
    required_reviewer_profile: 'INDEPENDENT_REVIEWER',
    registered_prompt_id: 'COLD_QUERY_EFFICIENCY_REVIEW/V1',
  }),
  Object.freeze({
    lane_id: 'OPEN_WORLD',
    required_reviewer_profile: 'INDEPENDENT_REVIEWER',
    registered_prompt_id: 'COLD_OPEN_WORLD_REVIEW/V1',
  }),
  Object.freeze({
    lane_id: 'RELEASE_PROPAGATION',
    required_reviewer_profile: 'INDEPENDENT_REVIEWER',
    registered_prompt_id: 'COLD_RELEASE_PROPAGATION_REVIEW/V1',
  }),
]);

const REVIEW_LANE_REGISTRY = Object.freeze({
  schema_version: 'ProgrammeGateReviewLaneRegistry/V1',
  lanes: REVIEW_LANES,
});

const REVIEWER_PROFILES = Object.freeze({
  FABLE_ELIGIBLE: Object.freeze({
    reviewer_identity_class: 'FABLE',
    exact_model_rule: 'CONTROLLER_OBSERVED_FABLE_ELIGIBLE_MODEL',
  }),
  SOL_5_6_EXTRA_HIGH_ELIGIBLE: Object.freeze({
    reviewer_identity_class: 'OPENAI_MODEL',
    exact_model_identifier: 'gpt-5.6-sol',
    exact_reasoning_level: 'xhigh',
  }),
});

const VALIDATOR_CONFIGURATION = Object.freeze({
  schema_version: 'ProgrammeGateValidatorConfiguration/V1',
  configuration_id: 'PROGRAMME_GATE_VALIDATOR_CONFIG/V1',
  schema_registry_ids: Object.freeze([
    'ProgrammeGateAcceptanceDefinition/V1',
    'ProgrammeGateEvidenceEnvelope/V2',
    'TrustedReviewControllerRecord/V1',
    'ReviewerIndependenceAttestation/V1',
    'ProgrammeGateStatusArtefact/V2',
    'ProgrammeStatusPublicationHead/V1',
    'ProgrammeGateValidatorConfiguration/V1',
    'TrustedProgrammeGatePublicKeys/V1',
    'ProgrammeGateReviewLaneRegistry/V1',
  ]),
  signature_algorithm: 'Ed25519',
  invalid_or_missing_evidence_state: 'OPEN',
  unknown_schema_effect: 'OPEN',
  unknown_key_effect: 'OPEN',
  invalid_signature_effect: 'OPEN',
  unknown_or_extra_claim_effect: 'OPEN',
  permitted_environments: Object.freeze(['STAGING', 'PRODUCTION']),
});

const TRUSTED_PUBLIC_KEY_REGISTRY = Object.freeze({
  schema_version: 'TrustedProgrammeGatePublicKeys/V1',
  registry_state: 'EMPTY_NOT_ACTIVATED',
  keys: Object.freeze([]),
});

const G0_ACCEPTANCE_INPUTS = Object.freeze([
  ['G0_MARKET_STATS_CONTAINED', 'route-disabled-code-test-live-response/v1', 'MarketStatsContainmentAttestation',
    ['feature_gate_off', 'live_route_zero_corpus_reads', 'containment_test_pass'], ['P0-ROUTE-01']],
  ['G0_BROAD_CORPUS_ROUTES_CONTAINED', 'broad-route-inventory-and-containment/v1', 'BroadRouteContainmentAttestation',
    ['source_built_and_runtime_route_inventories_equal', 'every_broad_route_contained', 'zero_broad_node_fallback'], ['P0-ROUTE-01']],
  ['G0_ZAYO_DISPOSITION', 'non-secret-owner-purpose-disposition/v1', 'ZayoTrafficDisposition',
    ['owner_and_purpose_recorded_without_secret', 'recognised_or_rotation_required'], ['GATE-01']],
  ['G0_CLAUDE_CREDENTIAL_ROTATION', 'non-secret-rotation-completion/v1', 'ClaudeCredentialRotationReceipt',
    ['compromised_credentials_revoked', 'replacement_activation_verified', 'no_secret_in_evidence'], ['GATE-01']],
  ['G0_SUPABASE_SECRET_DISPOSITION', 'non-secret-rotation-or-approved-na/v1', 'SupabaseSecretDisposition',
    ['rotation_verified_or_recognised_traffic_na_with_ben_approval', 'no_secret_in_evidence'], ['GATE-01']],
  ['G0_STAGING_SUPABASE_ISOLATED', 'staging-project-credential-isolation/v1', 'StagingSupabaseIsolationAttestation',
    ['distinct_project_and_credentials', 'production_dml_denied', 'snapshot_restore_only'], ['DEPLOY-CUTOVER-01']],
  ['G0_STAGING_VERCEL_ISOLATED', 'preview-project-credential-isolation/v1', 'StagingVercelIsolationAttestation',
    ['branch_preview_uses_staging_only_credentials', 'production_alias_unchanged'], ['DEPLOY-CUTOVER-01']],
  ['G0_STAGING_ACCESS_PROTECTED', 'default-deny-preview-access-test/v1', 'StagingAccessProtectionAttestation',
    ['unauthenticated_access_denied', 'authorised_test_access_pass'], ['GATE-01']],
  ['G0_EXACT_DIGEST_REVIEW_SET', 'five-lane-provider-attested-exact-specification-root-review-set/v3', 'ExactDigestReviewSetAttestation',
    ['five_named_lanes_pass_same_root', 'eligible_legal_reviewer', 'reviewer_independence_recomputed', 'root_unchanged_before_and_after'], ['GATE-01', 'REVIEW-CONTEXT-01']],
  ['G0_BEN_SPEC_APPROVAL', 'ben-approved-reviewed-specification-root/v3', 'BenSpecificationApproval',
    ['approved_root_equals_passing_review_root', 'ben_identity_and_signature_valid', 'approval_unconditional'], ['GATE-01']],
]);

const ACCEPTANCE_DEFINITION_DESCRIPTORS = Object.freeze(G0_ACCEPTANCE_INPUTS.map(([
  gateId,
  evidenceContract,
  evidenceObjectType,
  orderedClaimKeys,
  requiredAdversarialTests,
]) => Object.freeze({
  descriptor_version: 'ProgrammeGateAcceptanceDefinitionDescriptor/V1',
  activation_state: 'BLOCKED_PENDING_EXECUTABLE_BINDINGS',
  gate_id: gateId,
  evidence_contract: evidenceContract,
  evidence_object_type: evidenceObjectType,
  ordered_claim_keys: Object.freeze([...orderedClaimKeys]),
  required_adversarial_tests: Object.freeze([...requiredAdversarialTests]),
})));

function acceptanceDescriptorForContract(evidenceContract) {
  const matches = ACCEPTANCE_DEFINITION_DESCRIPTORS.filter(
    (entry) => entry.evidence_contract === evidenceContract,
  );
  if (matches.length !== 1) {
    throw new Error(`unknown or ambiguous G0 evidence contract: ${evidenceContract}`);
  }
  return matches[0];
}

const REGISTRY_DIGESTS = Object.freeze({
  schema_registry: domainDigest(
    SCHEMA_REGISTRY_DOMAIN,
    VALIDATOR_CONFIGURATION.schema_registry_ids.map((schemaId) => schemaFor(schemaId)),
  ),
  validator_configuration: domainDigest(
    VALIDATOR_CONFIGURATION_DOMAIN,
    VALIDATOR_CONFIGURATION,
  ),
  trusted_public_keys: domainDigest(
    TRUSTED_PUBLIC_KEY_REGISTRY_DOMAIN,
    TRUSTED_PUBLIC_KEY_REGISTRY,
  ),
  review_lanes: domainDigest(REVIEW_LANE_REGISTRY_DOMAIN, REVIEW_LANE_REGISTRY),
  acceptance_definition_descriptors: domainDigest(
    ACCEPTANCE_DESCRIPTOR_SET_DOMAIN,
    ACCEPTANCE_DEFINITION_DESCRIPTORS,
  ),
});

module.exports = {
  ACCEPTANCE_DEFINITION_DESCRIPTORS,
  REGISTRY_DIGESTS,
  REVIEWER_PROFILES,
  REVIEW_LANES,
  REVIEW_LANE_REGISTRY,
  TRUSTED_PUBLIC_KEY_REGISTRY,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
};
