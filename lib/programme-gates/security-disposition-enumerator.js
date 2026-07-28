const SECURITY_DISPOSITION_CONTRACTS = Object.freeze({
  ZAYO: 'non-secret-owner-purpose-disposition/v1',
  CLAUDE: 'non-secret-rotation-completion/v1',
  SUPABASE: 'non-secret-rotation-or-approved-na/v1',
});

const SECURITY_DISPOSITION_BINDINGS = Object.freeze({
  [SECURITY_DISPOSITION_CONTRACTS.ZAYO]: Object.freeze({
    member_type: 'ZayoTrafficDisposition',
    schema_id: 'ZayoTrafficDisposition/V1',
  }),
  [SECURITY_DISPOSITION_CONTRACTS.CLAUDE]: Object.freeze({
    member_type: 'ClaudeCredentialRotationReceipt',
    schema_id: 'ClaudeCredentialRotationReceipt/V1',
  }),
  [SECURITY_DISPOSITION_CONTRACTS.SUPABASE]: Object.freeze({
    member_type: 'SupabaseSecretDisposition',
    schema_id: 'SupabaseSecretDisposition/V1',
  }),
});

function bindingForContract(evidenceContract) {
  const binding = SECURITY_DISPOSITION_BINDINGS[evidenceContract];
  if (!binding) {
    throw new Error(`unsupported security-disposition evidence contract: ${evidenceContract}`);
  }
  return binding;
}

function member(memberId, memberType, payload) {
  return Object.freeze({
    member_id: memberId,
    member_type: memberType,
    ...(payload === undefined ? {} : { payload }),
  });
}

function enumerateSecurityDispositionExpectedMembers({ definition, evidenceObject }) {
  const binding = bindingForContract(definition && definition.evidence_contract);
  if (!evidenceObject || typeof evidenceObject !== 'object' || Array.isArray(evidenceObject)) {
    throw new TypeError('security-disposition evidence object must be an object');
  }
  return Object.freeze([
    member(`disposition:${evidenceObject.gate_id}`, binding.member_type),
  ]);
}

function securityDispositionMembers({ definition, evidenceObject }) {
  const binding = bindingForContract(definition && definition.evidence_contract);
  return Object.freeze([
    member(`disposition:${evidenceObject.gate_id}`, binding.member_type, evidenceObject),
  ]);
}

function memberSchemaSetForSecurityDisposition(evidenceContract) {
  const binding = bindingForContract(evidenceContract);
  return Object.freeze([binding]);
}

module.exports = {
  SECURITY_DISPOSITION_BINDINGS,
  SECURITY_DISPOSITION_CONTRACTS,
  enumerateSecurityDispositionExpectedMembers,
  memberSchemaSetForSecurityDisposition,
  securityDispositionMembers,
};
