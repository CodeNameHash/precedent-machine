const { domainDigest } = require('./bytes');
const {
  createAcceptanceContractBundle,
} = require('./containment-contracts');
const {
  SECURITY_DISPOSITION_CONTRACTS,
  enumerateSecurityDispositionExpectedMembers,
  memberSchemaSetForSecurityDisposition,
} = require('./security-disposition-enumerator');

const SECURITY_ENUMERATOR_EXECUTABLE_DOMAIN =
  'PROGRAMME_GATE_SECURITY_DISPOSITION_ENUMERATOR_EXECUTABLE/V1';
const SECURITY_ENUMERATOR_EXECUTABLE_DIGEST = domainDigest(
  SECURITY_ENUMERATOR_EXECUTABLE_DOMAIN,
  { source: enumerateSecurityDispositionExpectedMembers.toString() },
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
      'attestation_source_digest',
    ]),
    universe_id: universeId,
    member_schema_set: memberSchemaSetForSecurityDisposition(evidenceContract),
    member_enumerator_executable_digest: SECURITY_ENUMERATOR_EXECUTABLE_DIGEST,
    claim_paths: Object.freeze(claimPaths),
  });
}

const SECURITY_DISPOSITION_CONTRACT_CONFIGURATIONS = Object.freeze([
  configuration({
    gateId: 'G0_ZAYO_DISPOSITION',
    evidenceContract: SECURITY_DISPOSITION_CONTRACTS.ZAYO,
    evidenceSchemaId: 'ZayoTrafficDisposition/V1',
    evidenceSubjectType: 'ZayoTrafficDispositionSubject',
    universeId: 'G0_ZAYO_DISPOSITION_MEMBERS',
    claimPaths: {
      owner_and_purpose_recorded_without_secret: [
        '/process_identity_digest',
        '/owner',
        '/purpose',
        '/secret_field_count',
      ],
      recognised_or_rotation_required: [
        '/recognition_status',
        '/rotation_required',
        '/rotation_completed',
      ],
    },
  }),
  configuration({
    gateId: 'G0_CLAUDE_CREDENTIAL_ROTATION',
    evidenceContract: SECURITY_DISPOSITION_CONTRACTS.CLAUDE,
    evidenceSchemaId: 'ClaudeCredentialRotationReceipt/V1',
    evidenceSubjectType: 'ClaudeCredentialRotationSubject',
    universeId: 'G0_CLAUDE_CREDENTIAL_ROTATION_MEMBERS',
    claimPaths: {
      compromised_credentials_revoked: [
        '/compromised_credential_ids',
        '/revoked_ids',
      ],
      replacement_activation_verified: '/replacement_activation_verified_at',
      no_secret_in_evidence: '/secret_field_count',
    },
  }),
  configuration({
    gateId: 'G0_SUPABASE_SECRET_DISPOSITION',
    evidenceContract: SECURITY_DISPOSITION_CONTRACTS.SUPABASE,
    evidenceSchemaId: 'SupabaseSecretDisposition/V1',
    evidenceSubjectType: 'SupabaseSecretDispositionSubject',
    universeId: 'G0_SUPABASE_SECRET_DISPOSITION_MEMBERS',
    claimPaths: {
      rotation_verified_or_recognised_traffic_na_with_ben_approval: [
        '/disposition',
        '/rotation_verified_at',
        '/zayo_disposition_id',
        '/ben_approval_id',
      ],
      no_secret_in_evidence: '/secret_field_count',
    },
  }),
]);

function createSecurityDispositionContractBundle({ specificationRoot }) {
  return createAcceptanceContractBundle({
    configurations: SECURITY_DISPOSITION_CONTRACT_CONFIGURATIONS,
    specificationRoot,
  });
}

module.exports = {
  SECURITY_DISPOSITION_CONTRACT_CONFIGURATIONS,
  SECURITY_ENUMERATOR_EXECUTABLE_DIGEST,
  createSecurityDispositionContractBundle,
};
