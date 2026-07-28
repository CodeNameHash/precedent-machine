const { domainDigest } = require('./bytes');
const { createAcceptanceContractBundle } = require('./containment-contracts');
const {
  ISOLATION_CONTRACTS,
  enumerateIsolationExpectedMembers,
  memberSchemaSetForIsolation,
} = require('./isolation-enumerator');

const ISOLATION_ENUMERATOR_EXECUTABLE_DIGEST = domainDigest(
  'PROGRAMME_GATE_ISOLATION_ENUMERATOR_EXECUTABLE/V1',
  { source: enumerateIsolationExpectedMembers.toString() },
);

function configuration({
  gateId,
  evidenceContract,
  evidenceSchemaId,
  evidenceSubjectType,
  universeId,
  claimPaths,
}) {
  return Object.freeze({
    gate_id: gateId,
    evidence_contract: evidenceContract,
    evidence_schema_id: evidenceSchemaId,
    evidence_subject_type: evidenceSubjectType,
    evidence_subject_identity_fields: Object.freeze([
      'gate_id',
      'code_commit',
      'environment',
      'observed_at',
      'isolation_source_digest',
    ]),
    universe_id: universeId,
    member_schema_set: memberSchemaSetForIsolation(evidenceContract),
    member_enumerator_executable_digest: ISOLATION_ENUMERATOR_EXECUTABLE_DIGEST,
    claim_paths: Object.freeze(claimPaths),
  });
}

const ISOLATION_CONTRACT_CONFIGURATIONS = Object.freeze([
  configuration({
    gateId: 'G0_STAGING_SUPABASE_ISOLATED',
    evidenceContract: ISOLATION_CONTRACTS.SUPABASE,
    evidenceSchemaId: 'StagingSupabaseIsolationAttestation/V1',
    evidenceSubjectType: 'StagingSupabaseIsolationSubject',
    universeId: 'G0_STAGING_SUPABASE_ISOLATION_MEMBERS',
    claimPaths: {
      distinct_project_and_credentials: [
        '/production_project_identity_digest',
        '/staging_project_identity_digest',
        '/production_credential_identity_digest',
        '/staging_credential_identity_digest',
      ],
      production_dml_denied: '/production_dml_probe',
      snapshot_restore_only: '/restore_mode',
    },
  }),
  configuration({
    gateId: 'G0_STAGING_VERCEL_ISOLATED',
    evidenceContract: ISOLATION_CONTRACTS.VERCEL,
    evidenceSchemaId: 'StagingVercelIsolationAttestation/V1',
    evidenceSubjectType: 'StagingVercelIsolationSubject',
    universeId: 'G0_STAGING_VERCEL_ISOLATION_MEMBERS',
    claimPaths: {
      branch_preview_uses_staging_only_credentials: [
        '/preview_deployment_id',
        '/preview_credential_scope',
      ],
      production_alias_unchanged: [
        '/production_alias_before',
        '/production_alias_after',
      ],
    },
  }),
  configuration({
    gateId: 'G0_STAGING_ACCESS_PROTECTED',
    evidenceContract: ISOLATION_CONTRACTS.ACCESS,
    evidenceSchemaId: 'StagingAccessProtectionAttestation/V1',
    evidenceSubjectType: 'StagingAccessProtectionSubject',
    universeId: 'G0_STAGING_ACCESS_PROTECTION_MEMBERS',
    claimPaths: {
      complete_preview_route_action_inventory: '/preview_route_actions',
      unauthenticated_access_denied_before_and_after_restore: '/preview_route_actions',
      authenticated_non_admin_privileged_actions_denied: '/preview_route_actions',
      writer_ingest_correction_export_import_promotion_and_cutover_actions_disabled:
        '/preview_route_actions',
      authorised_read_only_test_access_pass: '/preview_route_actions',
    },
  }),
]);

function createIsolationContractBundle({ specificationRoot }) {
  return createAcceptanceContractBundle({
    configurations: ISOLATION_CONTRACT_CONFIGURATIONS,
    specificationRoot,
  });
}

module.exports = {
  ISOLATION_CONTRACT_CONFIGURATIONS,
  ISOLATION_ENUMERATOR_EXECUTABLE_DIGEST,
  createIsolationContractBundle,
};
