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
    linked_bindings: Object.freeze([
      Object.freeze({
        member_type: 'ZayoTrafficDisposition',
        schema_id: 'ZayoTrafficDisposition/V1',
      }),
      Object.freeze({
        member_type: 'SupabaseSecretNaApproval',
        schema_id: 'SupabaseSecretNaApproval/V1',
      }),
    ]),
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
  const expected = [
    member(`disposition:${evidenceObject.gate_id}`, binding.member_type),
  ];
  if (evidenceObject.disposition === 'RECOGNISED_TRAFFIC_APPROVED_NA') {
    expected.push(
      member(`zayo:${evidenceObject.zayo_disposition_id}`, 'ZayoTrafficDisposition'),
      member(`approval:${evidenceObject.ben_approval_id}`, 'SupabaseSecretNaApproval'),
    );
  }
  return Object.freeze(expected);
}

function securityDispositionMembers({ definition, evidenceObject, linkedMembers = [] }) {
  const binding = bindingForContract(definition && definition.evidence_contract);
  return Object.freeze([
    member(`disposition:${evidenceObject.gate_id}`, binding.member_type, evidenceObject),
    ...linkedMembers,
  ]);
}

function memberSchemaSetForSecurityDisposition(evidenceContract) {
  const binding = bindingForContract(evidenceContract);
  return Object.freeze([binding, ...(binding.linked_bindings || [])].map((entry) => ({
    member_type: entry.member_type,
    schema_id: entry.schema_id,
  })));
}

module.exports = {
  SECURITY_DISPOSITION_BINDINGS,
  SECURITY_DISPOSITION_CONTRACTS,
  enumerateSecurityDispositionExpectedMembers,
  memberSchemaSetForSecurityDisposition,
  securityDispositionMembers,
};
