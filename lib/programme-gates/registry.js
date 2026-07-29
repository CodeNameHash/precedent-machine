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
    exact_model_identifiers: Object.freeze(['fable-legal-reviewer']),
    exact_reasoning_level: 'provider_default',
  }),
  SOL_5_6_EXTRA_HIGH_ELIGIBLE: Object.freeze({
    reviewer_identity_class: 'OPENAI_MODEL',
    exact_model_identifier: 'gpt-5.6-sol',
    exact_reasoning_level: 'xhigh',
  }),
});

const REVIEW_CONTROLLER_POLICY = Object.freeze({
  controller_id: 'CODEX_CLI_REVIEW_CONTROLLER',
  controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
  task_manifest_version: 'TrustedReviewTaskManifest/V1',
  frozen_specification_manifest_id: 'codex-program-specification-manifest/v1',
  frozen_specification_file_count: 6,
  output_schema_id: 'ColdReviewOutput/V1',
  review_runtime_version: 'codex-cli/0.145.0',
  review_runtime_binary_path: '/opt/homebrew/bin/codex',
  review_runtime_binary_digest:
    '134063e133f0b4244fa3b251acf973d4fe4b4aeeacbdc135211bf480f59f1477',
  operating_system: 'darwin',
  architecture: 'arm64',
  path_value: '/opt/homebrew/bin:/usr/bin:/bin',
  locale: 'en_US.UTF-8',
  terminal: 'dumb',
  exact_model_identifier: 'gpt-5.6-sol',
  reasoning_level: 'xhigh',
  fable_model_identifiers: Object.freeze(['fable-legal-reviewer']),
  fable_reasoning_level: 'provider_default',
  prompt_digests: Object.freeze({
    ARCHITECTURE:
      'e8aa3359ecf632383562b66d61114b0556d8954527610498663642ab0b972297',
    LEGAL_SEMANTIC:
      '3f3d2e3b0e169a306307082cd3a0681e07164ca6dad73237794ccb78b0de4b6b',
    QUERY_EFFICIENCY:
      '0e5d489625e6cf9124951eb9df47672a668f7f535d3641a972aed5c363f23b06',
    OPEN_WORLD:
      '6d792fd85342d5cfa7b3863b32f9f6648afb91c2a27ed4e4b8b80519895d04d0',
    RELEASE_PROPAGATION:
      '57f06078844342428cef8a88f1ccfc731d7a389cc157fb5e4916c98e61e49f56',
  }),
});

const VALIDATOR_CONFIGURATION = Object.freeze({
  schema_version: 'ProgrammeGateValidatorConfiguration/V1',
  configuration_id: 'PROGRAMME_GATE_VALIDATOR_CONFIG/V1',
  schema_registry_ids: Object.freeze([
    'ContainedRouteMethodProbe/V1',
    'BroadRouteActionObservation/V1',
    'ProgrammeGateTestExecutionRecord/V1',
    'MarketStatsContainmentAttestation/V1',
    'BroadRouteContainmentAttestation/V1',
    'ZayoTrafficDisposition/V1',
    'ClaudeCredentialRotationReceipt/V1',
    'SupabaseSecretDisposition/V1',
    'SupabaseSecretNaApproval/V1',
    'StagingSupabaseIsolationAttestation/V1',
    'StagingVercelIsolationAttestation/V1',
    'StagingAccessProtectionAttestation/V1',
    'ProgrammeGateAcceptanceDefinition/V1',
    'ProgrammeGateEvidenceEnvelope/V2',
    'TrustedReviewControllerRecord/V1',
    'ReviewerIndependenceAttestation/V1',
    'ColdReviewOutput/V1',
    'ExactDigestReviewSetAttestation/V1',
    'ExactDigestReviewSetAttestation/V2',
    'BenSpecificationApproval/V1',
    'BenSpecificationApproval/V2',
    'BenSpecificationApprovalEvidence/V1',
    'BenSpecificationApprovalEvidence/V2',
    'ContractFreezeAttestation/V1',
    'ContractFreezeAttestationIdentity/V1',
    'ContractFreezeAuthorityManifest/V1',
    'CanonicalContractBundleMember/V1',
    'ContractFreezeGoverningSpecificationMember/V1',
    'ContractFreezeAuthorityEvidence/V1',
    'ContractBundleCompilationReceipt/V1',
    'ContractDiffReviewAttestation/V1',
    'ContractFreezeApproval/V1',
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
  registry_state: 'ACTIVE',
  keys: Object.freeze([
    Object.freeze({
      key_id: 'PROGRAMME_GATE_VALIDATOR_2026_07',
      algorithm: 'Ed25519',
      public_key_pem: [
        '-----BEGIN PUBLIC KEY-----',
        'MCowBQYDK2VwAyEAiKkmqx3weHtAqBiTr6j5zWGaXNMyO9rF55dT8cpOx20=',
        '-----END PUBLIC KEY-----',
        '',
      ].join('\n'),
      permitted_roles: Object.freeze(['TEST_EXECUTION_ATTESTER', 'VALIDATOR']),
      permitted_domains: Object.freeze([
        'PROGRAMME_GATE_EVIDENCE/V2',
        'PROGRAMME_GATE_TEST_EXECUTION/V1',
        'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
        'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT/V1',
      ]),
      valid_from: '2026-07-28T07:08:01.000Z',
      valid_until: '2026-10-26T07:08:01.000Z',
      revoked_at: null,
    }),
    Object.freeze({
      key_id: 'PROGRAMME_STATUS_PUBLISHER_2026_07',
      algorithm: 'Ed25519',
      public_key_pem: [
        '-----BEGIN PUBLIC KEY-----',
        'MCowBQYDK2VwAyEAn7kdajyQhTpRcOKsBdGK5ChSgXqGvcIAFkC0a+RlZw0=',
        '-----END PUBLIC KEY-----',
        '',
      ].join('\n'),
      permitted_roles: Object.freeze(['STATUS_PUBLISHER', 'VALIDATOR']),
      permitted_domains: Object.freeze([
        'PROGRAMME_GATE_STATUS/V2',
        'PROGRAMME_GATE_PUBLICATION_HEAD/V1',
      ]),
      valid_from: '2026-07-28T07:08:01.000Z',
      valid_until: '2026-10-26T07:08:01.000Z',
      revoked_at: null,
    }),
    Object.freeze({
      key_id: 'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07',
      algorithm: 'Ed25519',
      public_key_pem: [
        '-----BEGIN PUBLIC KEY-----',
        'MCowBQYDK2VwAyEAjDjroH2I2mViDwiXI3AjoogNKXL2P2hVEBmM8ArLWio=',
        '-----END PUBLIC KEY-----',
        '',
      ].join('\n'),
      permitted_roles: Object.freeze(['REVIEW_CONTROLLER']),
      permitted_domains: Object.freeze([
        'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1',
        'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      ]),
      valid_from: '2026-07-28T07:08:01.000Z',
      valid_until: '2026-10-26T07:08:01.000Z',
      revoked_at: null,
    }),
    Object.freeze({
      key_id: 'PROGRAMME_GATE_BEN_APPROVER_2026_07',
      algorithm: 'Ed25519',
      public_key_pem: [
        '-----BEGIN PUBLIC KEY-----',
        'MCowBQYDK2VwAyEAhbHlf10h8sqMSAvxPlB9DMxL6h3A9zryaMM/Atgy4t8=',
        '-----END PUBLIC KEY-----',
        '',
      ].join('\n'),
      permitted_roles: Object.freeze(['BEN_APPROVER']),
      permitted_domains: Object.freeze([
        'PROGRAMME_GATE_BEN_APPROVAL/V1',
        'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
      ]),
      valid_from: '2026-07-28T07:08:01.000Z',
      valid_until: '2026-10-26T07:08:01.000Z',
      revoked_at: null,
    }),
  ]),
});

const BOOTSTRAP_ACCEPTANCE_INPUTS = Object.freeze([
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
    [
      'complete_preview_route_action_inventory',
      'unauthenticated_access_denied_before_and_after_restore',
      'authenticated_non_admin_privileged_actions_denied',
      'writer_ingest_correction_export_import_promotion_and_cutover_actions_disabled',
      'authorised_read_only_test_access_pass',
    ], ['GATE-01', 'PREVIEW-AUTH-01']],
  ['G0_EXACT_DIGEST_REVIEW_SET', 'five-lane-exact-signed-review-outcomes-recorded/v1', 'ExactDigestReviewSetAttestation',
    ['five_named_lane_outcomes_recorded_same_root', 'review_outputs_match_signed_controller_digests', 'eligible_legal_reviewer', 'reviewer_independence_recomputed', 'full_review_pass_not_claimed'], ['GATE-01', 'REVIEW-CONTEXT-01']],
  ['G0_BEN_SPEC_APPROVAL', 'ben-exact-root-isolated-staging-authorisation/v1', 'BenSpecificationApproval',
    ['approved_root_and_commit_exact', 'review_outcome_set_acknowledged', 'ben_identity_and_signature_valid', 'authorisation_scope_bounded', 'full_review_pass_not_claimed'], ['GATE-01']],
  ['P1_CONTRACT_FREEZE_ATTESTED', 'exact-contract-freeze-attestation-and-status-generation/v7', 'ContractFreezeAttestation',
    ['bundle_compiles', 'semantic_and_identity_diff_reviewed', 'freeze_gate_approved', 'status_generation_matches'], ['CONTRACT-01']],
]);

const ACCEPTANCE_DEFINITION_DESCRIPTORS = Object.freeze(BOOTSTRAP_ACCEPTANCE_INPUTS.map(([
  gateId,
  evidenceContract,
  evidenceObjectType,
  orderedClaimKeys,
  requiredAdversarialTests,
]) => Object.freeze({
  descriptor_version: 'ProgrammeGateAcceptanceDefinitionDescriptor/V1',
  activation_state: [
    'G0_MARKET_STATS_CONTAINED',
    'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    'G0_ZAYO_DISPOSITION',
    'G0_CLAUDE_CREDENTIAL_ROTATION',
    'G0_SUPABASE_SECRET_DISPOSITION',
    'G0_STAGING_SUPABASE_ISOLATED',
    'G0_STAGING_VERCEL_ISOLATED',
    'G0_STAGING_ACCESS_PROTECTED',
    'G0_EXACT_DIGEST_REVIEW_SET',
    'G0_BEN_SPEC_APPROVAL',
    'P1_CONTRACT_FREEZE_ATTESTED',
  ].includes(gateId)
    ? 'ACTIVE'
    : 'BLOCKED_PENDING_EXECUTABLE_BINDINGS',
  gate_id: gateId,
  evidence_contract: evidenceContract,
  evidence_object_type: evidenceObjectType,
  ordered_claim_keys: Object.freeze([...orderedClaimKeys]),
  required_adversarial_tests: Object.freeze([...requiredAdversarialTests]),
})));

const LEGACY_STRICT_P1_REVIEW_DESCRIPTORS = Object.freeze([
  Object.freeze({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidence_contract:
      'five-lane-provider-attested-exact-specification-root-review-set/v3',
    evidence_object_type: 'ExactDigestReviewSetAttestation',
    ordered_claim_keys: Object.freeze([
      'five_named_lanes_pass_same_root',
      'eligible_legal_reviewer',
      'reviewer_independence_recomputed',
      'root_unchanged_before_and_after',
    ]),
  }),
  Object.freeze({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    evidence_contract: 'ben-approved-reviewed-specification-root/v3',
    evidence_object_type: 'BenSpecificationApproval',
    ordered_claim_keys: Object.freeze([
      'approved_root_equals_passing_review_root',
      'ben_identity_and_signature_valid',
      'approval_unconditional',
    ]),
  }),
]);

function acceptanceDescriptorForContract(evidenceContract) {
  const matches = [
    ...ACCEPTANCE_DEFINITION_DESCRIPTORS,
    ...LEGACY_STRICT_P1_REVIEW_DESCRIPTORS,
  ].filter(
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
  LEGACY_STRICT_P1_REVIEW_DESCRIPTORS,
  REGISTRY_DIGESTS,
  REVIEW_CONTROLLER_POLICY,
  REVIEWER_PROFILES,
  REVIEW_LANES,
  REVIEW_LANE_REGISTRY,
  TRUSTED_PUBLIC_KEY_REGISTRY,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
};
