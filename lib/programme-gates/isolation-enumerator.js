const ISOLATION_CONTRACTS = Object.freeze({
  SUPABASE: 'staging-project-credential-isolation/v1',
  VERCEL: 'preview-project-credential-isolation/v1',
  ACCESS: 'default-deny-preview-access-test/v1',
});

const ISOLATION_BINDINGS = Object.freeze({
  [ISOLATION_CONTRACTS.SUPABASE]: Object.freeze({
    member_type: 'StagingSupabaseIsolationAttestation',
    schema_id: 'StagingSupabaseIsolationAttestation/V1',
  }),
  [ISOLATION_CONTRACTS.VERCEL]: Object.freeze({
    member_type: 'StagingVercelIsolationAttestation',
    schema_id: 'StagingVercelIsolationAttestation/V1',
  }),
  [ISOLATION_CONTRACTS.ACCESS]: Object.freeze({
    member_type: 'StagingAccessProtectionAttestation',
    schema_id: 'StagingAccessProtectionAttestation/V1',
  }),
});

function bindingForContract(evidenceContract) {
  const binding = ISOLATION_BINDINGS[evidenceContract];
  if (!binding) throw new Error(`unsupported isolation evidence contract: ${evidenceContract}`);
  return binding;
}

function member(memberId, memberType, payload) {
  return Object.freeze({
    member_id: memberId,
    member_type: memberType,
    ...(payload === undefined ? {} : { payload }),
  });
}

function enumerateIsolationExpectedMembers({ definition, evidenceObject }) {
  const binding = bindingForContract(definition && definition.evidence_contract);
  if (!evidenceObject || typeof evidenceObject !== 'object' || Array.isArray(evidenceObject)) {
    throw new TypeError('isolation evidence object must be an object');
  }
  const members = [
    member(`isolation:${definition.evidence_contract}`, binding.member_type),
  ];
  if (definition.evidence_contract === ISOLATION_CONTRACTS.ACCESS) {
    for (const [prefix, rootField] of [
      [
        'source',
        'source_route_action_inventory_root',
      ],
      [
        'built',
        'built_route_action_inventory_root',
      ],
      [
        'runtime',
        'runtime_route_action_inventory_root',
      ],
    ]) {
      if (typeof evidenceObject[rootField] !== 'string') {
        throw new Error(`access evidence lacks ${rootField}`);
      }
      members.push(member(
        `preview-action-inventory:${prefix}:${evidenceObject[rootField]}`,
        binding.member_type,
      ));
    }
  }
  return Object.freeze(members);
}

function isolationMembers({ definition, evidenceObject }) {
  const binding = bindingForContract(definition && definition.evidence_contract);
  const members = [
    member(`isolation:${definition.evidence_contract}`, binding.member_type, evidenceObject),
  ];
  if (definition.evidence_contract === ISOLATION_CONTRACTS.ACCESS) {
    for (const [prefix, rootField] of [
      [
        'source',
        'source_route_action_inventory_root',
      ],
      [
        'built',
        'built_route_action_inventory_root',
      ],
      [
        'runtime',
        'runtime_route_action_inventory_root',
      ],
    ]) {
      members.push(member(
        `preview-action-inventory:${prefix}:${evidenceObject[rootField]}`,
        binding.member_type,
        evidenceObject,
      ));
    }
  }
  return Object.freeze(members);
}

function memberSchemaSetForIsolation(evidenceContract) {
  return Object.freeze([bindingForContract(evidenceContract)]);
}

module.exports = {
  ISOLATION_BINDINGS,
  ISOLATION_CONTRACTS,
  enumerateIsolationExpectedMembers,
  isolationMembers,
  memberSchemaSetForIsolation,
};
