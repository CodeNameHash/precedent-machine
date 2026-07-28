const { domainDigest } = require('./bytes');
const {
  BROAD_ROUTE_CONTRACT,
  MARKET_STATS_CONTRACT,
  enumerateContainmentExpectedMembers,
  memberSchemaSetForContract,
} = require('./containment-enumerator');
const { ACCEPTANCE_PREDICATES } = require('./predicates');
const { acceptanceDescriptorForContract } = require('./registry');
const { schemaFor } = require('./schema-registry');
const {
  ACCEPTANCE_DEFINITION_ID_DOMAIN,
  EVIDENCE_OBJECT_SCHEMA_DOMAIN,
  MEMBER_SCHEMA_SET_DOMAIN,
  acceptanceDefinitionPayload,
} = require('./validator');

const ENUMERATOR_EXECUTABLE_DOMAIN = 'PROGRAMME_GATE_CONTAINMENT_ENUMERATOR_EXECUTABLE/V1';
const ENUMERATOR_CONFIGURATION_DOMAIN =
  'PROGRAMME_GATE_CONTAINMENT_ENUMERATOR_CONFIGURATION/V1';
const PREDICATE_EXECUTABLE_DOMAIN = 'PROGRAMME_GATE_CONTAINMENT_PREDICATE_EXECUTABLE/V1';
const PREDICATE_CONFIGURATION_DOMAIN =
  'PROGRAMME_GATE_CONTAINMENT_PREDICATE_CONFIGURATION/V1';

const CONTRACT_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    gate_id: 'G0_MARKET_STATS_CONTAINED',
    evidence_contract: MARKET_STATS_CONTRACT,
    evidence_schema_id: 'MarketStatsContainmentAttestation/V1',
    evidence_subject_type: 'MarketStatsContainmentSubject',
    universe_id: 'G0_MARKET_STATS_CONTAINMENT_MEMBERS',
    member_schema_set: memberSchemaSetForContract(MARKET_STATS_CONTRACT),
    claim_paths: Object.freeze({
      feature_gate_off: '/route_feature_enabled',
      live_route_zero_corpus_reads: '/method_probes',
      containment_test_pass: '/tests',
    }),
  }),
  Object.freeze({
    gate_id: 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    evidence_contract: BROAD_ROUTE_CONTRACT,
    evidence_schema_id: 'BroadRouteContainmentAttestation/V1',
    evidence_subject_type: 'BroadRouteContainmentSubject',
    universe_id: 'G0_BROAD_ROUTE_CONTAINMENT_MEMBERS',
    member_schema_set: memberSchemaSetForContract(BROAD_ROUTE_CONTRACT),
    claim_paths: Object.freeze({
      source_built_and_runtime_route_inventories_equal: '/source_route_ids',
      every_broad_route_contained: '/routes',
      zero_broad_node_fallback: '/routes',
    }),
  }),
]);

const ENUMERATOR_EXECUTABLE_DIGEST = domainDigest(
  ENUMERATOR_EXECUTABLE_DOMAIN,
  { source: enumerateContainmentExpectedMembers.toString() },
);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${label} must be a SHA-256 digest`);
  }
  return value;
}

function executableBindingsFor(configuration) {
  const descriptor = acceptanceDescriptorForContract(configuration.evidence_contract);
  if (descriptor.activation_state !== 'ACTIVE') {
    throw new Error(`${configuration.gate_id} acceptance descriptor is not active`);
  }
  const memberSchemaSet = configuration.member_schema_set;
  const enumeratorConfiguration = {
    evidence_contract: configuration.evidence_contract,
    member_schema_set: memberSchemaSet,
    ordering_rule: 'UTF8_MEMBER_TYPE_THEN_ID',
  };
  const predicates = ACCEPTANCE_PREDICATES[configuration.gate_id];
  const predicateBindings = {};
  for (const claimKey of descriptor.ordered_claim_keys) {
    const predicate = predicates && predicates[claimKey];
    const exactInputs = configuration.claim_inputs?.[claimKey]
      || (
        Array.isArray(configuration.claim_paths[claimKey])
          ? configuration.claim_paths[claimKey]
          : [configuration.claim_paths[claimKey]]
      ).map((jsonPointer) => ({
        member_type: descriptor.evidence_object_type,
        json_pointer: jsonPointer,
      }));
    if (typeof predicate !== 'function') {
      throw new Error(`${configuration.gate_id} has no executable predicate ${claimKey}`);
    }
    if (!Array.isArray(exactInputs) || exactInputs.length === 0) {
      throw new Error(`${configuration.gate_id} has no exact inputs for ${claimKey}`);
    }
    if (exactInputs.some((entry) => (
      !entry
      || typeof entry.member_type !== 'string'
      || entry.member_type.length === 0
      || typeof entry.json_pointer !== 'string'
      || !entry.json_pointer.startsWith('/')
    ))) {
      throw new Error(`${configuration.gate_id} has an invalid exact input for ${claimKey}`);
    }
    predicateBindings[claimKey] = Object.freeze({
      exact_inputs: Object.freeze(exactInputs.map((entry) => Object.freeze({ ...entry }))),
      executable_digest: domainDigest(
        PREDICATE_EXECUTABLE_DOMAIN,
        { gate_id: configuration.gate_id, claim_key: claimKey, source: predicate.toString() },
      ),
      configuration_digest: domainDigest(
        PREDICATE_CONFIGURATION_DOMAIN,
        {
          gate_id: configuration.gate_id,
          claim_key: claimKey,
          exact_inputs: exactInputs,
        },
      ),
    });
  }
  return Object.freeze({
    member_enumerator: Object.freeze({
      executable_digest: configuration.member_enumerator_executable_digest
        || ENUMERATOR_EXECUTABLE_DIGEST,
      configuration_digest: domainDigest(
        ENUMERATOR_CONFIGURATION_DOMAIN,
        enumeratorConfiguration,
      ),
    }),
    predicates: Object.freeze(predicateBindings),
  });
}

function definitionFor(configuration, specificationRoot, executableBindings) {
  const descriptor = acceptanceDescriptorForContract(configuration.evidence_contract);
  const memberSchemaSet = configuration.member_schema_set;
  const definition = {
    schema_version: 'ProgrammeGateAcceptanceDefinition/V1',
    definition_id: '0'.repeat(64),
    definition_digest: '0'.repeat(64),
    evidence_contract: configuration.evidence_contract,
    specification_root: specificationRoot,
    frozen_contract_pair_digest: null,
    evidence_object_json_schema_id: configuration.evidence_schema_id,
    evidence_object_json_schema_digest: domainDigest(
      EVIDENCE_OBJECT_SCHEMA_DOMAIN,
      schemaFor(configuration.evidence_schema_id),
    ),
    evidence_subject_type: configuration.evidence_subject_type,
    evidence_subject_identity_fields: configuration.evidence_subject_identity_fields || [
      'gate_id',
      'code_commit',
      'runtime_deployment_id',
      'environment',
    ],
    immutable_member_universe_definition: {
      universe_id: configuration.universe_id,
      ordering_rule: 'UTF8_MEMBER_TYPE_THEN_ID',
      duplicate_effect: 'OPEN',
      missing_or_extra_effect: 'OPEN',
    },
    immutable_member_json_schema_set_digest: domainDigest(
      MEMBER_SCHEMA_SET_DOMAIN,
      memberSchemaSet,
    ),
    member_enumerator_executable_digest:
      executableBindings.member_enumerator.executable_digest,
    member_enumerator_configuration_digest:
      executableBindings.member_enumerator.configuration_digest,
    ordered_claim_predicate_definitions: descriptor.ordered_claim_keys.map((claimKey) => ({
      claim_key: claimKey,
      result_type: 'BOOLEAN',
      exact_input_member_types_and_paths:
        executableBindings.predicates[claimKey].exact_inputs,
      measurement_executable_digest:
        executableBindings.predicates[claimKey].executable_digest,
      measurement_configuration_digest:
        executableBindings.predicates[claimKey].configuration_digest,
      comparison_operator: 'EQUALS',
      expected_typed_value: true,
    })),
  };
  const definitionDigest = domainDigest(
    ACCEPTANCE_DEFINITION_ID_DOMAIN,
    acceptanceDefinitionPayload(definition),
  );
  definition.definition_id = definitionDigest;
  definition.definition_digest = definitionDigest;
  return deepFreeze(definition);
}

function createAcceptanceContractBundle({ configurations, specificationRoot }) {
  requireDigest(specificationRoot, 'specification root');
  if (!Array.isArray(configurations) || configurations.length === 0) {
    throw new TypeError('acceptance contract configurations must be non-empty');
  }
  const definitions = [];
  const executableBindings = {};
  for (const configuration of configurations) {
    const bindings = executableBindingsFor(configuration);
    executableBindings[configuration.gate_id] = bindings;
    definitions.push(definitionFor(configuration, specificationRoot, bindings));
  }
  return deepFreeze({
    definitions,
    executable_bindings: executableBindings,
  });
}

function createContainmentContractBundle({ specificationRoot }) {
  return createAcceptanceContractBundle({
    configurations: CONTRACT_CONFIGURATIONS,
    specificationRoot,
  });
}

module.exports = {
  CONTRACT_CONFIGURATIONS,
  ENUMERATOR_EXECUTABLE_DIGEST,
  createAcceptanceContractBundle,
  createContainmentContractBundle,
};
