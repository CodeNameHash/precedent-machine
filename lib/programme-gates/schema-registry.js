const Ajv = require('ajv');

const HEX_64 = '^[a-f0-9]{64}$';
const BASE64 = '^[A-Za-z0-9+/]+={0,2}$';
const TOKEN = '^[A-Z][A-Z0-9_./:-]{0,127}$';
const LOWER_ID = '^[a-z0-9][a-z0-9_./:-]{0,127}$';
const TYPE_ID = '^[A-Za-z][A-Za-z0-9_./:-]{0,127}$';

function closedObject(properties, required = Object.keys(properties)) {
  return {
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  };
}

const digest = { type: 'string', pattern: HEX_64 };
const codeCommit = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const token = { type: 'string', pattern: TOKEN };
const lowerId = { type: 'string', pattern: LOWER_ID };
const typeId = { type: 'string', pattern: TYPE_ID };
const nonEmptyString = { type: 'string', minLength: 1 };
const timestamp = { type: 'string', format: 'canonical-utc-timestamp' };
const environment = { enum: ['STAGING', 'PRODUCTION'] };
const stringSet = {
  type: 'array',
  uniqueItems: true,
  items: nonEmptyString,
};
const digestSet = {
  type: 'array',
  uniqueItems: true,
  items: digest,
};
const emptyStringSet = {
  type: 'array',
  maxItems: 0,
};
const previewRouteActionIdentitySchema = closedObject({
  action_id: token,
  action_class: {
    enum: [
      'READ_ONLY_TEST',
      'ADMIN_PRIVILEGED',
      'WRITER',
      'INGEST',
      'CORRECTION',
      'EXPORT',
      'IMPORT',
      'PROMOTION',
      'CUTOVER',
    ],
  },
});

function contractFreezeAuthorityEnvelope({
  authorityKind,
  payload,
  actorIdentity,
  disposition,
  attestorRole,
}) {
  return {
    required: [
      'authority_kind',
      'authority_payload',
      'actor_identity',
      'disposition',
      'attestor_role',
    ],
    properties: {
      authority_kind: { const: authorityKind },
      authority_payload: payload,
      actor_identity: { const: actorIdentity },
      disposition: { const: disposition },
      attestor_role: { const: attestorRole },
    },
  };
}

function catalogueAuthorshipPayload(catalogueKind) {
  return closedObject({
    disposition_id: digest,
    catalogue_kind: { const: catalogueKind },
    catalogue_root: digest,
    author_principal_id: nonEmptyString,
    input_isolation_disposition_id: digest,
    authorship_method: { const: 'INDEPENDENT_COLD_AUTHORSHIP' },
    authoring_session_id: nonEmptyString,
    authoring_executable_digest: digest,
    catalogue_members: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: closedObject({
        member_key: nonEmptyString,
        payload_digest: digest,
        source_bytes_base64: { type: 'string', pattern: BASE64, minLength: 1 },
      }),
    },
  });
}

function catalogueInputAccessPayload(catalogueKind) {
  return closedObject({
    disposition_id: digest,
    catalogue_kind: { const: catalogueKind },
    catalogue_root: digest,
    author_principal_id: nonEmptyString,
    access_mode: { const: 'NO_FROZEN_CATALOGUE_OR_PRIOR_REVIEW_ACCESS' },
    observed_input_set_root: digest,
    authoring_session_id: nonEmptyString,
    sandbox_profile_digest: digest,
    authoring_executable_digest: digest,
    permitted_input_members: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: closedObject({
        input_key: nonEmptyString,
        input_class: {
          enum: ['SOURCE_DOCUMENT', 'DEFINITION_INDEX', 'FROZEN_NEUTRAL_SCHEMA'],
        },
        byte_length: { type: 'integer', minimum: 1 },
        payload_digest: digest,
        source_bytes_base64: { type: 'string', pattern: BASE64, minLength: 1 },
      }),
    },
    observed_input_members: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: closedObject({
        input_key: nonEmptyString,
        input_class: {
          enum: ['SOURCE_DOCUMENT', 'DEFINITION_INDEX', 'FROZEN_NEUTRAL_SCHEMA'],
        },
        byte_length: { type: 'integer', minimum: 1 },
        payload_digest: digest,
      }),
    },
    prohibited_access_attempt_ids: emptyStringSet,
    ordinary_contract_mount_present: { const: false },
    generated_output_mount_present: { const: false },
    prior_review_mount_present: { const: false },
  });
}

function catalogueReviewPayload(catalogueKind, reviewScope) {
  return closedObject({
    disposition_id: digest,
    catalogue_kind: { const: catalogueKind },
    catalogue_root: digest,
    reviewer_principal_id: nonEmptyString,
    reviewer_identity: nonEmptyString,
    reviewer_model_identifier: nonEmptyString,
    reasoning_level: { enum: ['xhigh', 'provider_default'] },
    reviewer_eligibility_set_root: digest,
    authorship_disposition_id: digest,
    input_access_disposition_id: digest,
    review_scope: { const: reviewScope },
    blocking_finding_ids: emptyStringSet,
    authoring_event_intersection_ids: emptyStringSet,
    prior_conclusion_input_ids: emptyStringSet,
  });
}

const contractBundleMemberSchema = closedObject({
  member_key: nonEmptyString,
  semantic_digest: digest,
  identity_digest: digest,
});

const immutableContractBundleMemberSchema = closedObject({
  schema_version: { const: 'CanonicalContractBundleMember/V1' },
  member_key: nonEmptyString,
  member_kind: {
    enum: [
      'CORE_CANONICAL_CONTRACT',
      'SEMANTIC_CATALOGUE',
      'COMPOSITION_CATALOGUE',
      'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
      'OPEN_WORLD_CONCEPT',
      'GOVERNED_RESIDUAL',
      'SOURCE_SPECIFIC_PUBLICATION',
      'COMPARABILITY',
    ],
  },
  logical_type: nonEmptyString,
  member_schema_version: nonEmptyString,
  byte_length: { type: 'integer', minimum: 1 },
  payload_digest: digest,
  source_bytes_base64: { type: 'string', pattern: BASE64, minLength: 1 },
  semantic_digest: digest,
  identity_digest: digest,
});

const contractSemanticIdentityDiffSchema = closedObject({
  predecessor_contract_bundle_id: digest,
  successor_contract_bundle_id: digest,
  added_member_keys: stringSet,
  removed_member_keys: stringSet,
  semantic_changed_member_keys: stringSet,
  identity_changed_member_keys: stringSet,
});
const trustedReviewTaskManifestSchema = closedObject({
  manifest_version: { const: 'TrustedReviewTaskManifest/V1' },
  lane_id: token,
  exact_specification_root: digest,
  frozen_specification: closedObject({
    manifest_id: nonEmptyString,
    manifest_digest: digest,
    file_count: { type: 'integer', minimum: 1 },
    ordered_members: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: closedObject({
        order: { type: 'integer', minimum: 1 },
        path: nonEmptyString,
        byte_length: { type: 'integer', minimum: 1 },
        payload_digest: digest,
        source_bytes_base64: { type: 'string', pattern: BASE64, minLength: 1 },
      }),
    },
    immutable: { const: true },
  }),
  registered_prompt: closedObject({
    prompt_id: token,
    path: nonEmptyString,
    payload_digest: digest,
    byte_length: { type: 'integer', minimum: 1 },
    immutable: { const: true },
    contains_prior_review_conclusions: { const: false },
  }),
  output_schema: closedObject({
    schema_id: nonEmptyString,
    path: nonEmptyString,
    payload_digest: digest,
    byte_length: { type: 'integer', minimum: 1 },
    source_bytes_base64: { type: 'string', pattern: BASE64, minLength: 1 },
    immutable: { const: true },
  }),
});
const trustedReviewRuntimeContextSchema = closedObject({
  context_version: { const: 'TrustedReviewRuntimeContext/V1' },
  review_runtime_binary_path: nonEmptyString,
  review_runtime_version: nonEmptyString,
  review_runtime_binary_digest: digest,
  controller_run_root: nonEmptyString,
  lane_run_root: nonEmptyString,
  working_directory: nonEmptyString,
  operating_system: nonEmptyString,
  architecture: nonEmptyString,
  home_path: nonEmptyString,
  codex_home_path: nonEmptyString,
  tmpdir_path: nonEmptyString,
  path_value: nonEmptyString,
  lang: nonEmptyString,
  lc_all: nonEmptyString,
  term: nonEmptyString,
});

const claimValueSchema = {
  oneOf: [
    { type: 'boolean' },
    { type: 'integer' },
    { type: 'number' },
    { type: 'string' },
    { type: 'null' },
  ],
};

const exactAcceptanceClaimSchema = closedObject({
  claim_key: lowerId,
  result_type: { enum: ['BOOLEAN', 'INTEGER', 'NUMBER', 'STRING', 'NULL'] },
  typed_value: claimValueSchema,
});

const claimPredicateSchema = closedObject({
  claim_key: lowerId,
  result_type: { enum: ['BOOLEAN', 'INTEGER', 'NUMBER', 'STRING', 'NULL'] },
  exact_input_member_types_and_paths: {
    type: 'array',
    minItems: 1,
    items: closedObject({
      member_type: typeId,
      json_pointer: { type: 'string', pattern: '^(/([^/~]|~[01])*)*$' },
    }),
  },
  measurement_executable_digest: digest,
  measurement_configuration_digest: digest,
  comparison_operator: {
    enum: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUALS', 'LESS_THAN', 'LESS_THAN_OR_EQUALS'],
  },
  expected_typed_value: claimValueSchema,
});

const containedRouteMethodProbeSchema = closedObject({
  schema_version: { const: 'ContainedRouteMethodProbe/V1' },
  member_id: nonEmptyString,
  route_id: nonEmptyString,
  method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] },
  status: { type: 'integer', minimum: 100, maximum: 599 },
  error_code: token,
  cache_control: nonEmptyString,
  retry_after: { oneOf: [nonEmptyString, { type: 'null' }] },
  database_calls: { type: 'integer', minimum: 0 },
  corpus_reads: { type: 'integer', minimum: 0 },
  code_commit: codeCommit,
  runtime_deployment_id: nonEmptyString,
  environment,
  observed_at: timestamp,
});

const broadRouteActionObservationSchema = closedObject({
  schema_version: { const: 'BroadRouteActionObservation/V1' },
  member_id: nonEmptyString,
  route_id: nonEmptyString,
  method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] },
  containment_class: {
    enum: ['QUERY_ROUTE', 'BROAD_CORPUS_ACTION', 'PUBLIC_SERVICE_ACTION'],
  },
  source_contained: { type: 'boolean' },
  built_contained: { type: 'boolean' },
  runtime_contained: { type: 'boolean' },
  runtime_status: { type: 'integer', minimum: 100, maximum: 599 },
  runtime_error_code: { oneOf: [token, { type: 'null' }] },
  database_calls: { type: 'integer', minimum: 0 },
  corpus_reads: { type: 'integer', minimum: 0 },
  node_corpus_reads: { type: 'integer', minimum: 0 },
  legacy_fallback_used: { type: 'boolean' },
  code_commit: codeCommit,
  runtime_deployment_id: nonEmptyString,
  environment,
  observed_at: timestamp,
});

const programmeGateTestExecutionRecordSchema = closedObject({
  schema_version: { const: 'ProgrammeGateTestExecutionRecord/V1' },
  test_id: token,
  code_commit: codeCommit,
  environment,
  command_digest: digest,
  executable_digest: digest,
  started_at: timestamp,
  completed_at: timestamp,
  exit_code: { type: 'integer' },
  output_digest: digest,
  attester_key_id: token,
  signature_algorithm: { const: 'Ed25519' },
  execution_signature: { type: 'string', pattern: BASE64 },
});

const schemas = Object.freeze({
  'ContainedRouteMethodProbe/V1': {
    $id: 'ContainedRouteMethodProbe/V1',
    ...containedRouteMethodProbeSchema,
  },

  'BroadRouteActionObservation/V1': {
    $id: 'BroadRouteActionObservation/V1',
    ...broadRouteActionObservationSchema,
  },

  'ProgrammeGateTestExecutionRecord/V1': {
    $id: 'ProgrammeGateTestExecutionRecord/V1',
    ...programmeGateTestExecutionRecordSchema,
  },

  'MarketStatsContainmentAttestation/V1': {
    $id: 'MarketStatsContainmentAttestation/V1',
    ...closedObject({
      schema_version: { const: 'MarketStatsContainmentAttestation/V1' },
      gate_id: { const: 'G0_MARKET_STATS_CONTAINED' },
      code_commit: codeCommit,
      runtime_deployment_id: nonEmptyString,
      environment,
      observed_at: timestamp,
      route_feature_enabled: { const: false },
      method_probes: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: containedRouteMethodProbeSchema,
      },
      tests: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: programmeGateTestExecutionRecordSchema,
      },
    }),
  },

  'BroadRouteContainmentAttestation/V1': {
    $id: 'BroadRouteContainmentAttestation/V1',
    ...closedObject({
      schema_version: { const: 'BroadRouteContainmentAttestation/V1' },
      gate_id: { const: 'G0_BROAD_CORPUS_ROUTES_CONTAINED' },
      code_commit: codeCommit,
      runtime_deployment_id: nonEmptyString,
      environment,
      observed_at: timestamp,
      source_route_ids: stringSet,
      built_route_ids: stringSet,
      runtime_route_ids: stringSet,
      routes: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: broadRouteActionObservationSchema,
      },
      tests: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: programmeGateTestExecutionRecordSchema,
      },
    }),
  },

  'ZayoTrafficDisposition/V1': {
    $id: 'ZayoTrafficDisposition/V1',
    ...closedObject({
      schema_version: { const: 'ZayoTrafficDisposition/V1' },
      gate_id: { const: 'G0_ZAYO_DISPOSITION' },
      code_commit: codeCommit,
      environment,
      observed_at: timestamp,
      attestation_source_digest: digest,
      process_identity_digest: digest,
      owner: nonEmptyString,
      purpose: nonEmptyString,
      recognition_status: { enum: ['RECOGNISED', 'UNRECOGNISED'] },
      rotation_required: { type: 'boolean' },
      rotation_completed: { type: 'boolean' },
      secret_field_count: { const: 0 },
    }),
  },

  'ClaudeCredentialRotationReceipt/V1': {
    $id: 'ClaudeCredentialRotationReceipt/V1',
    ...closedObject({
      schema_version: { const: 'ClaudeCredentialRotationReceipt/V1' },
      gate_id: { const: 'G0_CLAUDE_CREDENTIAL_ROTATION' },
      code_commit: codeCommit,
      environment,
      observed_at: timestamp,
      attestation_source_digest: digest,
      compromised_credential_ids: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: digest,
      },
      revoked_ids: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: digest,
      },
      replacement_activation_verified_at: timestamp,
      secret_field_count: { const: 0 },
    }),
  },

  'SupabaseSecretDisposition/V1': {
    $id: 'SupabaseSecretDisposition/V1',
    ...closedObject({
      schema_version: { const: 'SupabaseSecretDisposition/V1' },
      gate_id: { const: 'G0_SUPABASE_SECRET_DISPOSITION' },
      code_commit: codeCommit,
      environment,
      observed_at: timestamp,
      attestation_source_digest: digest,
      disposition: { enum: ['ROTATED', 'RECOGNISED_TRAFFIC_APPROVED_NA'] },
      rotation_verified_at: { oneOf: [timestamp, { type: 'null' }] },
      zayo_disposition_id: { oneOf: [digest, { type: 'null' }] },
      ben_approval_id: { oneOf: [digest, { type: 'null' }] },
      secret_field_count: { const: 0 },
    }),
  },

  'SupabaseSecretNaApproval/V1': {
    $id: 'SupabaseSecretNaApproval/V1',
    ...closedObject({
      schema_version: { const: 'SupabaseSecretNaApproval/V1' },
      approval_id: digest,
      supabase_attestation_source_digest: digest,
      zayo_process_identity_digest: digest,
      approved_disposition: { const: 'RECOGNISED_TRAFFIC_APPROVED_NA' },
      approver_identity: { const: 'BEN_GOODCHILD' },
      conditions: {
        type: 'array',
        maxItems: 0,
      },
      approved_at: timestamp,
      signature_algorithm: { const: 'Ed25519' },
      approver_key_id: token,
      signature: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
  },

  'StagingSupabaseIsolationAttestation/V1': {
    $id: 'StagingSupabaseIsolationAttestation/V1',
    ...closedObject({
      production_project_identity_digest: digest,
      staging_project_identity_digest: digest,
      production_credential_identity_digest: digest,
      staging_credential_identity_digest: digest,
      production_dml_probe: { const: 'DENIED' },
      restore_mode: { const: 'PRODUCTION_SNAPSHOT_ONLY' },
    }),
  },

  'StagingVercelIsolationAttestation/V1': {
    $id: 'StagingVercelIsolationAttestation/V1',
    ...closedObject({
      preview_deployment_id: nonEmptyString,
      preview_credential_scope: { const: 'STAGING_ONLY' },
      production_alias_before: nonEmptyString,
      production_alias_after: nonEmptyString,
    }),
  },

  'StagingAccessProtectionAttestation/V1': {
    $id: 'StagingAccessProtectionAttestation/V1',
    ...closedObject({
      source_route_action_inventory: {
        type: 'array',
        minItems: 9,
        uniqueItems: true,
        items: previewRouteActionIdentitySchema,
      },
      source_route_action_inventory_root: digest,
      built_route_action_inventory: {
        type: 'array',
        minItems: 9,
        uniqueItems: true,
        items: previewRouteActionIdentitySchema,
      },
      built_route_action_inventory_root: digest,
      runtime_route_action_inventory: {
        type: 'array',
        minItems: 9,
        uniqueItems: true,
        items: previewRouteActionIdentitySchema,
      },
      runtime_route_action_inventory_root: digest,
      preview_route_actions: {
        type: 'array',
        minItems: 9,
        uniqueItems: true,
        items: closedObject({
          action_id: token,
          action_class: {
            enum: [
              'READ_ONLY_TEST',
              'ADMIN_PRIVILEGED',
              'WRITER',
              'INGEST',
              'CORRECTION',
              'EXPORT',
              'IMPORT',
              'PROMOTION',
              'CUTOVER',
            ],
          },
          unauthenticated_before_restore_status: {
            type: 'integer',
            minimum: 100,
            maximum: 599,
          },
          unauthenticated_after_restore_status: {
            type: 'integer',
            minimum: 100,
            maximum: 599,
          },
          authenticated_non_admin_status: {
            type: 'integer',
            minimum: 100,
            maximum: 599,
          },
          authorised_test_status: {
            oneOf: [
              { type: 'integer', minimum: 100, maximum: 599 },
              { type: 'null' },
            ],
          },
          feature_enabled: { type: 'boolean' },
        }),
      },
    }),
  },

  'ProgrammeGateAcceptanceDefinition/V1': {
    $id: 'ProgrammeGateAcceptanceDefinition/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateAcceptanceDefinition/V1' },
      definition_id: digest,
      definition_digest: digest,
      evidence_contract: lowerId,
      specification_root: digest,
      frozen_contract_pair_digest: { oneOf: [digest, { type: 'null' }] },
      evidence_object_json_schema_id: nonEmptyString,
      evidence_object_json_schema_digest: digest,
      evidence_subject_type: typeId,
      evidence_subject_identity_fields: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: lowerId,
      },
      immutable_member_universe_definition: closedObject({
        universe_id: token,
        ordering_rule: token,
        duplicate_effect: { const: 'OPEN' },
        missing_or_extra_effect: { const: 'OPEN' },
      }),
      immutable_member_json_schema_set_digest: digest,
      member_enumerator_executable_digest: digest,
      member_enumerator_configuration_digest: digest,
      ordered_claim_predicate_definitions: {
        type: 'array',
        minItems: 1,
        items: claimPredicateSchema,
      },
    }),
  },

  'ProgrammeGateEvidenceEnvelope/V2': {
    $id: 'ProgrammeGateEvidenceEnvelope/V2',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateEvidenceEnvelope/V2' },
      gate_id: token,
      evidence_contract: lowerId,
      acceptance_definition_id: digest,
      acceptance_definition_digest: digest,
      specification_root: digest,
      code_commit: codeCommit,
      environment,
      evidence_subject_type: typeId,
      evidence_subject_id: digest,
      evidence_subject_payload_digest: digest,
      required_evidence_object_type: typeId,
      required_evidence_object_payload_digest: digest,
      exact_acceptance_claims: {
        type: 'array',
        minItems: 1,
        items: exactAcceptanceClaimSchema,
      },
      immutable_member_root: digest,
      test_result_root: digest,
      validator_executable_digest: digest,
      validator_configuration_digest: digest,
      validator_key_id: token,
      terminal_state: { const: 'PASS' },
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'TrustedReviewControllerRecord/V1': {
    $id: 'TrustedReviewControllerRecord/V1',
    ...closedObject({
      schema_version: { const: 'TrustedReviewControllerRecord/V1' },
      controller_id: token,
      controller_version: nonEmptyString,
      review_runtime_version: nonEmptyString,
      review_runtime_binary_digest: digest,
      fixed_controller_runtime_context_digest: digest,
      controller_supplied_input_manifest: trustedReviewTaskManifestSchema,
      fixed_controller_runtime_context: trustedReviewRuntimeContextSchema,
      exact_specification_root: digest,
      exact_model_identifier: nonEmptyString,
      reasoning_level: { enum: ['xhigh', 'provider_default'] },
      immutable_task_id: nonEmptyString,
      immutable_session_id: nonEmptyString,
      immutable_review_id: nonEmptyString,
      registered_prompt_id: token,
      cold_review_prompt_digest: digest,
      controller_supplied_input_manifest_digest: digest,
      exact_input_context_digest: digest,
      input_context_digest_before_review: digest,
      input_context_digest_after_review: digest,
      review_output_digest: digest,
      review_start_time: timestamp,
      review_end_time: timestamp,
      reviewer_principal_id: nonEmptyString,
      reviewer_source_control_identity_set: stringSet,
      reviewer_disposition: { enum: ['PASS', 'FAIL'] },
      reviewer_edit_set_root: digest,
      parent_session_state: { const: 'GENESIS' },
      no_earlier_review_conclusions_were_inputs: { const: true },
      nonce: nonEmptyString,
      signature_algorithm: { const: 'Ed25519' },
      controller_key_id: token,
      controller_signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ReviewerIndependenceAttestation/V1': {
    $id: 'ReviewerIndependenceAttestation/V1',
    ...closedObject({
      schema_version: { const: 'ReviewerIndependenceAttestation/V1' },
      reviewer_principal_id: nonEmptyString,
      immutable_session_id: nonEmptyString,
      session_parent_or_genesis: { const: 'GENESIS' },
      exact_input_context_digest: digest,
      reviewed_code_commit: codeCommit,
      source_control_history_scope: { const: 'ALL_REFS_FROM_REPOSITORY_GENESIS' },
      source_control_authorship_events: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          commit_id: codeCommit,
          identity_set: stringSet,
        }),
      },
      source_control_authorship_event_set_root: digest,
      prior_conclusion_input_set: stringSet,
      authoring_event_intersection_root: digest,
      prior_conclusion_intersection_root: digest,
      reviewer_edit_set_root: digest,
      validator_executable_digest: digest,
      validator_configuration_digest: digest,
      validator_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ExactDigestReviewSetAttestation/V1': {
    $id: 'ExactDigestReviewSetAttestation/V1',
    ...closedObject({
      review_set_evidence_id: digest,
      reviewed_root: digest,
    }),
  },

  'BenSpecificationApproval/V1': {
    $id: 'BenSpecificationApproval/V1',
    ...closedObject({
      schema_version: { const: 'BenSpecificationApproval/V1' },
      approved_root: digest,
      passing_review_set_evidence_id: digest,
      approver_identity: { const: 'BEN_GOODCHILD' },
      conditions: {
        type: 'array',
        uniqueItems: true,
        items: nonEmptyString,
      },
      approved_at: timestamp,
      nonce: nonEmptyString,
      signature_algorithm: { const: 'Ed25519' },
      approver_key_id: token,
      signature: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
  },

  'BenSpecificationApprovalEvidence/V1': {
    $id: 'BenSpecificationApprovalEvidence/V1',
    ...closedObject({
      approval_evidence_id: digest,
      approved_root: digest,
      passing_review_set_evidence_id: digest,
      conditions: {
        type: 'array',
        uniqueItems: true,
        items: nonEmptyString,
      },
    }),
  },

  'ContractFreezeAttestation/V1': {
    $id: 'ContractFreezeAttestation/V1',
    ...closedObject({
      schema_version: { const: 'ContractFreezeAttestation/V1' },
      gate_id: { const: 'P1_CONTRACT_FREEZE_ATTESTED' },
      specification_root: digest,
      code_commit: codeCommit,
      environment,
      observed_at: timestamp,
      contract_bundle_id: digest,
      contract_bundle_digest: digest,
      contract_freeze_attestation_id: digest,
      frozen_contract_pair_digest: digest,
      contract_authority_manifest_id: digest,
      contract_authority_manifest_digest: digest,
      compilation_receipt_id: digest,
      semantic_identity_review_id: digest,
      legal_semantic_review_disposition_id: digest,
      identity_review_disposition_id: digest,
      freeze_gate_approval_id: digest,
      ben_bundle_approval_evidence_id: digest,
      authority_member_inventory: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          member_id: nonEmptyString,
          member_type: nonEmptyString,
        }),
      },
      status_generation: { type: 'integer', minimum: 1 },
      status_payload_digest: digest,
    }),
  },

  'ContractFreezeAttestationIdentity/V1': {
    $id: 'ContractFreezeAttestationIdentity/V1',
    ...closedObject({
      schema_version: { const: 'ContractFreezeAttestationIdentity/V1' },
      contract_freeze_attestation_id: digest,
      specification_root: digest,
      code_commit: codeCommit,
      environment,
      predecessor_contract_bundle_id: digest,
      predecessor_contract_bundle_digest: digest,
      contract_bundle_id: digest,
      contract_bundle_digest: digest,
      approval_epoch_nonce: nonEmptyString,
    }),
  },

  'ContractFreezeAuthorityManifest/V1': {
    $id: 'ContractFreezeAuthorityManifest/V1',
    ...closedObject({
      schema_version: { const: 'ContractFreezeAuthorityManifest/V1' },
      authority_manifest_id: digest,
      specification_root: digest,
      contract_bundle_id: digest,
      contract_bundle_digest: digest,
      frozen_contract_pair_digest: digest,
      root_manifest_digest: digest,
      predecessor_attestation_id: { oneOf: [digest, { const: 'GENESIS' }] },
      semantic_identity_diff_digest: digest,
      compiler_version: nonEmptyString,
      generator_version: nonEmptyString,
      compile_report_digest: digest,
      cycle_report_digest: digest,
      drift_report_digest: digest,
      generated_outputs: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          path: nonEmptyString,
          payload_digest: digest,
        }),
      },
      governing_specification_members: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          path: nonEmptyString,
          byte_length: { type: 'integer', minimum: 1 },
          payload_digest: digest,
        }),
      },
      g0_review_set_evidence_id: digest,
      g0_review_set_payload_digest: digest,
      g0_ben_approval_evidence_id: digest,
      g0_ben_approval_payload_digest: digest,
      independent_semantic_question_catalogue_authorship_id: digest,
      independent_semantic_question_catalogue_input_access_id: digest,
      independent_semantic_question_catalogue_review_id: digest,
      independent_composition_catalogue_authorship_id: digest,
      independent_composition_catalogue_input_access_id: digest,
      independent_composition_catalogue_review_id: digest,
      semantic_question_catalogue_reconciliation_digest: digest,
      neutral_projection_digest: digest,
      pre_freeze_semantic_stage_output_set_roots: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: digest,
      },
      pre_freeze_neutral_projection_set_roots: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: digest,
      },
      relationship_effect_field_universe_set_root: digest,
      reviewer_eligibility_set_root: digest,
      independent_reviewer_bindings: {
        type: 'array',
        minItems: 3,
        uniqueItems: true,
        items: closedObject({
          reviewer_principal_id: nonEmptyString,
          reviewer_identity: nonEmptyString,
          eligibility_evidence_digest: digest,
          review_disposition_id: digest,
        }),
      },
      ben_taxonomy_codebook_decision_set_root: digest,
      canonical_contract_bundle_member_root: digest,
      canonical_contract_bundle_member_count: { type: 'integer', minimum: 8 },
      canonical_contract_bundle_required_kind_set_root: digest,
    }),
  },

  'CanonicalContractBundleMember/V1': {
    $id: 'CanonicalContractBundleMember/V1',
    ...immutableContractBundleMemberSchema,
  },

  'ContractFreezeGoverningSpecificationMember/V1': {
    $id: 'ContractFreezeGoverningSpecificationMember/V1',
    ...closedObject({
      schema_version: { const: 'ContractFreezeGoverningSpecificationMember/V1' },
      specification_member_id: digest,
      path: nonEmptyString,
      byte_length: { type: 'integer', minimum: 1 },
      payload_digest: digest,
      source_bytes_base64: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
  },

  'ContractFreezeAuthorityEvidence/V1': {
    $id: 'ContractFreezeAuthorityEvidence/V1',
    ...closedObject({
      schema_version: { const: 'ContractFreezeAuthorityEvidence/V1' },
      authority_evidence_id: digest,
      authority_kind: token,
      authority_subject_id: digest,
      authority_payload: { type: 'object' },
      authority_payload_digest: digest,
      actor_identity: token,
      disposition: { enum: ['PASS', 'APPROVED', 'RECONCILED'] },
      related_authority_ids: digestSet,
      conditions: emptyStringSet,
      attestor_role: { enum: ['VALIDATOR', 'REVIEW_CONTROLLER', 'BEN_APPROVER'] },
      attestor_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
    oneOf: [
      contractFreezeAuthorityEnvelope({
        authorityKind: 'SEMANTIC_QUESTION_CATALOGUE_AUTHORSHIP',
        payload: catalogueAuthorshipPayload('SEMANTIC_QUESTION'),
        actorIdentity: 'INDEPENDENT_SEMANTIC_QUESTION_CATALOGUE_AUTHOR',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'SEMANTIC_QUESTION_CATALOGUE_INPUT_ACCESS',
        payload: catalogueInputAccessPayload('SEMANTIC_QUESTION'),
        actorIdentity: 'INPUT_ISOLATION_VALIDATOR',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'SEMANTIC_QUESTION_CATALOGUE_REVIEW',
        payload: catalogueReviewPayload(
          'SEMANTIC_QUESTION',
          'LEGAL_SEMANTIC_COMPLETENESS',
        ),
        actorIdentity: 'INDEPENDENT_SEMANTIC_QUESTION_CATALOGUE_REVIEWER',
        disposition: 'PASS',
        attestorRole: 'REVIEW_CONTROLLER',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'COMPOSITION_CATALOGUE_AUTHORSHIP',
        payload: catalogueAuthorshipPayload('COMPOSITION'),
        actorIdentity: 'INDEPENDENT_COMPOSITION_CATALOGUE_AUTHOR',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'COMPOSITION_CATALOGUE_INPUT_ACCESS',
        payload: catalogueInputAccessPayload('COMPOSITION'),
        actorIdentity: 'INPUT_ISOLATION_VALIDATOR',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'COMPOSITION_CATALOGUE_REVIEW',
        payload: catalogueReviewPayload(
          'COMPOSITION',
          'LEGAL_COMPOSITION_COMPLETENESS',
        ),
        actorIdentity: 'INDEPENDENT_COMPOSITION_CATALOGUE_REVIEWER',
        disposition: 'PASS',
        attestorRole: 'REVIEW_CONTROLLER',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'SEMANTIC_QUESTION_CATALOGUE_RECONCILIATION',
        payload: closedObject({
          semantic_question_catalogue_root: digest,
          composition_catalogue_root: digest,
          semantic_review_disposition_id: digest,
          composition_review_disposition_id: digest,
          semantic_question_stage_output_set_root: digest,
          composition_stage_output_set_root: digest,
          reconciliation_status: { const: 'NO_UNRESOLVED_CONFLICTS' },
          conflict_ids: emptyStringSet,
        }),
        actorIdentity: 'CATALOGUE_RECONCILIATION_VALIDATOR',
        disposition: 'RECONCILED',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'NEUTRAL_PROJECTION',
        payload: closedObject({
          source_reconciliation_digest: digest,
          projection_root: digest,
          projection_mode: { const: 'SEMANTICALLY_NEUTRAL' },
          excluded_inference_ids: emptyStringSet,
        }),
        actorIdentity: 'NEUTRAL_PROJECTION_COMPILER',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET',
        payload: closedObject({
          stage_id: token,
          catalogue_kind: { enum: ['SEMANTIC_QUESTION', 'COMPOSITION'] },
          catalogue_root: digest,
          catalogue_review_disposition_id: digest,
          output_set_root: digest,
          output_member_count: { type: 'integer', minimum: 1 },
          output_members: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: contractBundleMemberSchema,
          },
          failed_member_ids: emptyStringSet,
        }),
        actorIdentity: 'SEMANTIC_STAGE_EXECUTOR',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'PRE_FREEZE_NEUTRAL_PROJECTION_SET',
        payload: closedObject({
          neutral_projection_digest: digest,
          neutral_projection_set_root: digest,
          projection_member_count: { type: 'integer', minimum: 1 },
          projection_members: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: contractBundleMemberSchema,
          },
          unresolved_member_ids: emptyStringSet,
        }),
        actorIdentity: 'NEUTRAL_PROJECTION_COMPILER',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
        payload: closedObject({
          field_universe_set_root: digest,
          relationship_definition_set_root: digest,
          effect_schema_set_root: digest,
          field_universe_members: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: contractBundleMemberSchema,
          },
          relationship_definition_members: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: contractBundleMemberSchema,
          },
          effect_schema_members: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: contractBundleMemberSchema,
          },
          unresolved_field_ids: emptyStringSet,
        }),
        actorIdentity: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE_COMPILER',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'REVIEWER_ELIGIBILITY_SET',
        payload: closedObject({
          eligibility_set_root: digest,
          eligible_reviewers: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: closedObject({
              reviewer_principal_id: nonEmptyString,
              reviewer_identity: nonEmptyString,
              reviewer_model_identifier: nonEmptyString,
              reasoning_level: { enum: ['xhigh', 'provider_default'] },
            }),
          },
          excluded_reviewer_ids: emptyStringSet,
        }),
        actorIdentity: 'REVIEW_ELIGIBILITY_VALIDATOR',
        disposition: 'PASS',
        attestorRole: 'VALIDATOR',
      }),
      contractFreezeAuthorityEnvelope({
        authorityKind: 'BEN_TAXONOMY_CODEBOOK_DECISION_SET',
        payload: closedObject({
          decision_set_root: digest,
          approver_identity: { const: 'BEN_GOODCHILD' },
          approved_taxonomy_version: nonEmptyString,
          decision_ids: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: digest,
          },
          unresolved_decision_ids: emptyStringSet,
        }),
        actorIdentity: 'BEN_GOODCHILD',
        disposition: 'APPROVED',
        attestorRole: 'BEN_APPROVER',
      }),
    ],
  },

  'ContractBundleCompilationReceipt/V1': {
    $id: 'ContractBundleCompilationReceipt/V1',
    ...closedObject({
      schema_version: { const: 'ContractBundleCompilationReceipt/V1' },
      receipt_id: digest,
      contract_bundle_id: digest,
      contract_bundle_digest: digest,
      frozen_contract_pair_digest: digest,
      compiler_version: nonEmptyString,
      generator_version: nonEmptyString,
      compile_report_digest: digest,
      cycle_report_digest: digest,
      drift_report_digest: digest,
      generated_outputs: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          path: nonEmptyString,
          payload_digest: digest,
        }),
      },
      canonical_contract_bundle_member_root: digest,
      canonical_contract_bundle_member_count: { type: 'integer', minimum: 8 },
      canonical_contract_bundle_required_kind_set_root: digest,
      compile_errors: stringSet,
      cycle_errors: stringSet,
      drift_errors: stringSet,
      terminal_state: { const: 'PASS' },
      validator_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
  },

  'ContractDiffReviewAttestation/V1': {
    $id: 'ContractDiffReviewAttestation/V1',
    ...closedObject({
      schema_version: { const: 'ContractDiffReviewAttestation/V1' },
      review_id: digest,
      predecessor_contract_bundle_id: digest,
      predecessor_contract_bundle_digest: digest,
      predecessor_contract_members: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: contractBundleMemberSchema,
      },
      contract_bundle_id: digest,
      contract_bundle_digest: digest,
      contract_bundle_members: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: contractBundleMemberSchema,
      },
      frozen_contract_pair_digest: digest,
      semantic_identity_diff: contractSemanticIdentityDiffSchema,
      semantic_identity_diff_digest: digest,
      review_scope: { const: 'SEMANTIC_AND_IDENTITY_DIFF' },
      review_disposition: { const: 'PASS' },
      blocking_finding_count: { const: 0 },
      blocking_finding_ids: {
        type: 'array',
        maxItems: 0,
      },
      reviewer_identity: nonEmptyString,
      reviewer_model_identifier: nonEmptyString,
      reasoning_level: { enum: ['xhigh', 'provider_default'] },
      reviewer_principal_id: nonEmptyString,
      immutable_session_id: nonEmptyString,
      reviewer_source_control_identity_set: stringSet,
      reviewer_eligibility_digest: digest,
      review_set_root: digest,
      exact_input_context_digest: digest,
      independence_attestation_id: digest,
      independence_attestation_payload_digest: digest,
      controller_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
  },

  'ContractFreezeApproval/V1': {
    $id: 'ContractFreezeApproval/V1',
    ...closedObject({
      schema_version: { const: 'ContractFreezeApproval/V1' },
      approval_id: digest,
      authority_manifest_id: digest,
      frozen_contract_pair_digest: digest,
      approver_identity: { const: 'BEN_GOODCHILD' },
      conditions: {
        type: 'array',
        maxItems: 0,
      },
      approved_at: timestamp,
      approver_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64, minLength: 1 },
    }),
  },

  'ProgrammeGateStatusArtefact/V2': {
    $id: 'ProgrammeGateStatusArtefact/V2',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateStatusArtefact/V2' },
      specification_root: digest,
      code_commit: codeCommit,
      environment,
      generation: { type: 'integer', minimum: 1 },
      predecessor_status_id: { oneOf: [digest, { const: 'NONE' }] },
      gate_registry_digest: digest,
      ordered_gate_projection: {
        type: 'array',
        minItems: 1,
        items: closedObject({
          gate_id: token,
          state: { enum: ['OPEN', 'PASS', 'FAIL', 'NOT_APPLICABLE'] },
          evidence_envelope_id: { oneOf: [digest, { type: 'null' }] },
          evidence_payload_digest: { oneOf: [digest, { type: 'null' }] },
        }),
      },
      ordered_work_class_projection: {
        type: 'array',
        minItems: 1,
        items: closedObject({
          work_class: lowerId,
          state: { enum: ['OPEN', 'PASS'] },
        }),
      },
      validator_executable_digest: digest,
      validator_configuration_digest: digest,
      validator_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ProgrammeStatusPublicationHead/V1': {
    $id: 'ProgrammeStatusPublicationHead/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeStatusPublicationHead/V1' },
      generation: { type: 'integer', minimum: 1 },
      predecessor_git_object_id: {
        oneOf: [
          { type: 'string', pattern: '^[a-f0-9]{40}$' },
          { const: 'NONE' },
        ],
      },
      status_git_object_id: { type: 'string', pattern: '^[a-f0-9]{40}$' },
      status_artefact_id: digest,
      status_artefact_payload_digest: digest,
      publisher_key_id: token,
      signature_algorithm: { const: 'Ed25519' },
      signature: { type: 'string', pattern: BASE64 },
    }),
  },

  'ProgrammeGateValidatorConfiguration/V1': {
    $id: 'ProgrammeGateValidatorConfiguration/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateValidatorConfiguration/V1' },
      configuration_id: { const: 'PROGRAMME_GATE_VALIDATOR_CONFIG/V1' },
      schema_registry_ids: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: nonEmptyString,
      },
      signature_algorithm: { const: 'Ed25519' },
      invalid_or_missing_evidence_state: { const: 'OPEN' },
      unknown_schema_effect: { const: 'OPEN' },
      unknown_key_effect: { const: 'OPEN' },
      invalid_signature_effect: { const: 'OPEN' },
      unknown_or_extra_claim_effect: { const: 'OPEN' },
      permitted_environments: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: { enum: ['STAGING', 'PRODUCTION'] },
      },
    }),
  },

  'TrustedProgrammeGatePublicKeys/V1': {
    $id: 'TrustedProgrammeGatePublicKeys/V1',
    ...closedObject({
      schema_version: { const: 'TrustedProgrammeGatePublicKeys/V1' },
      registry_state: { enum: ['EMPTY_NOT_ACTIVATED', 'ACTIVE'] },
      keys: {
        type: 'array',
        uniqueItems: true,
        items: closedObject({
          key_id: token,
          algorithm: { const: 'Ed25519' },
          public_key_pem: { type: 'string', pattern: '^-----BEGIN PUBLIC KEY-----' },
          permitted_roles: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: token,
          },
          permitted_domains: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: token,
          },
          valid_from: timestamp,
          valid_until: timestamp,
          revoked_at: { oneOf: [timestamp, { type: 'null' }] },
        }),
      },
    }),
  },

  'ProgrammeGateReviewLaneRegistry/V1': {
    $id: 'ProgrammeGateReviewLaneRegistry/V1',
    ...closedObject({
      schema_version: { const: 'ProgrammeGateReviewLaneRegistry/V1' },
      lanes: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: closedObject({
          lane_id: token,
          required_reviewer_profile: token,
          registered_prompt_id: token,
        }),
      },
    }),
  },
});

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
ajv.addFormat('canonical-utc-timestamp', {
  type: 'string',
  validate(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) return false;
    const canonical = new Date(milliseconds).toISOString();
    return value === canonical || value === canonical.replace('.000Z', 'Z');
  },
});

const validators = new Map(
  Object.entries(schemas).map(([schemaId, schema]) => [schemaId, ajv.compile(schema)]),
);

function schemaFor(schemaId) {
  const schema = schemas[schemaId];
  if (!schema) throw new Error(`unknown programme-gate schema ID: ${schemaId}`);
  return schema;
}

function validateSchema(schemaId, value) {
  const validate = validators.get(schemaId);
  if (!validate) throw new Error(`unknown programme-gate schema ID: ${schemaId}`);
  if (validate(value)) return true;
  const details = ajv.errorsText(validate.errors, { separator: '; ' });
  throw new Error(`${schemaId} validation failed: ${details}`);
}

module.exports = {
  SCHEMA_IDS: Object.freeze(Object.keys(schemas)),
  schemas,
  schemaFor,
  validateSchema,
};
