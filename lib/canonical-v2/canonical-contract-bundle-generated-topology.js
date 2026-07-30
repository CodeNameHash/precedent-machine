const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const GENERATED_TOPOLOGY_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_GENERATED_TOPOLOGY/V1';
const FINAL_BUNDLE_SCHEMA_VERSION = 'CANONICAL_CONTRACT_BUNDLE/V3';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNANCE_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';

class CanonicalContractBundleGeneratedTopologyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundleGeneratedTopologyError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundleGeneratedTopologyError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_GENERATED_TOPOLOGY_INPUT', `${label} must be an object.`);
  }
}

function compareMember(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right));
}

function digestValue(domain, value) {
  return {
    canonical_payload_digest: contentId(`${domain}_PAYLOAD/V1`, value),
    generated_id: contentId(`${domain}_ID/V1`, value),
  };
}

function identityOf(member) {
  return {
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    schema_version: member.schema_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
  };
}

function collectStringLeaves(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStringLeaves(entry, output));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStringLeaves(entry, output));
  }
  return output;
}

function isQueryDefinition(member) {
  return (
    /(?:QUERY|SERVING|NAVIGATION|FIELD_CATALOGUE)/u.test(member.object_kind)
    || /(?:QUERY|SERVING|NAVIGATION|FIELD_CATALOGUE)/u.test(member.stable_id)
  );
}

function isGoldenFixture(member) {
  return /QUERY_GOLDEN_FIXTURE/u.test(member.object_kind);
}

function ownerClass(member) {
  return /(?:SOURCE|ADMISSION|PARSER|DOCUMENT)/u.test(member.object_kind)
    ? 'SCOPE_OR_SOURCE_ADMISSION'
    : 'DEAL_FAMILY';
}

function buildQueryDefinitionSetRoot(inputIdentity, members) {
  const entries = members.filter(isQueryDefinition).map((member) => ({
    authored_identity: identityOf(member),
    canonical_payload_digest: member.canonical_bytes_digest,
  })).sort(compareMember);
  if (entries.length === 0) {
    fail(
      'QUERY_DEFINITION_UNIVERSE_EMPTY',
      'The generated query definition universe cannot be empty.',
    );
  }
  const payload = {
    schema_version: 'QUERY_DEFINITION_SET_ROOT/V2',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    ordered_definitions: entries,
    definition_count: entries.length,
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      conflicting: [],
    },
  };
  const identity = digestValue('QUERY_DEFINITION_SET_ROOT', payload);
  return {
    ...payload,
    query_definition_set_root_id: identity.generated_id,
    canonical_payload_digest: identity.canonical_payload_digest,
  };
}

function buildQueryGoldenSuiteManifest(inputIdentity, queryRoot, members) {
  const fixtures = members.filter(isGoldenFixture).map((member) => ({
    authored_identity: identityOf(member),
    canonical_payload_digest: member.canonical_bytes_digest,
  })).sort(compareMember);
  const payload = {
    schema_version: 'QUERY_GOLDEN_SUITE_MANIFEST/V2',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    query_definition_set_root_id: queryRoot.query_definition_set_root_id,
    query_definition_set_root_payload_digest:
      queryRoot.canonical_payload_digest,
    ordered_fixtures: fixtures,
    fixture_count: fixtures.length,
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      conflicting: [],
    },
  };
  const identity = digestValue('QUERY_GOLDEN_SUITE_MANIFEST', payload);
  return {
    ...payload,
    query_golden_suite_manifest_id: identity.generated_id,
    canonical_payload_digest: identity.canonical_payload_digest,
  };
}

function buildApplicabilityTopology(inputIdentity, members) {
  const entries = members.map((member) => {
    const selectedOwner = ownerClass(member);
    return {
      universe_member_kind: member.object_kind,
      universe_member_schema: member.schema_version,
      stable_key_extractor: 'AUTHORED_IDENTITY_STABLE_ID',
      owner_class: selectedOwner,
      subject_key_schema: selectedOwner === 'SCOPE_OR_SOURCE_ADMISSION'
        ? 'GOVERNED_SCOPE_SUBJECT_KEY/V1'
        : 'GOVERNED_DEAL_FAMILY_KEY/V1',
      operation: selectedOwner === 'SCOPE_OR_SOURCE_ADMISSION'
        ? 'DEAL_SCOPE_RUN'
        : 'DEAL_EXTRACTION_RUN',
      action: selectedOwner === 'SCOPE_OR_SOURCE_ADMISSION'
        ? 'MATERIALISE_SCOPE'
        : 'FAMILY_BUILD/MATERIALISE',
      authored_identity: identityOf(member),
    };
  }).sort(compareMember);
  const registryPayload = {
    schema_version:
      'APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY/V3',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    ordered_entries: entries,
    aggregate_scope_subject_root_contract: {
      carrier: 'SCOPE_SUBJECT_APPLICABILITY_ROOT',
      cardinality: 'EXACTLY_ONE_PER_GOVERNED_SUBJECT',
      caller_override_permitted: false,
    },
    validation_roots: {
      unknown: [],
      duplicate: [],
      conflicting_assignment: [],
    },
  };
  const registryIdentity = digestValue(
    'APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY',
    registryPayload,
  );
  const registry = {
    ...registryPayload,
    producer_registry_id: registryIdentity.generated_id,
    canonical_payload_digest: registryIdentity.canonical_payload_digest,
  };
  const definitions = members.map((member) => {
    const payload = {
      schema_version:
        'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION/V1',
      canonical_bundle_input_identity_id:
        inputIdentity.canonical_bundle_input_identity_id,
      adopted_contract_item: identityOf(member),
      predecessor_contract_item: 'INITIAL_CONTRACT_BASELINE',
      applicability_predicate: {
        operator: 'AFFECTED_BY_CONTRACT_ITEM',
        contract_item_stable_id: member.stable_id,
      },
      affected_dependency_closure_rule: 'TRANSITIVE_DEPENDANTS',
      producer_registry_id: registry.producer_registry_id,
      producer_registry_payload_digest: registry.canonical_payload_digest,
    };
    const identity = digestValue(
      'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION',
      payload,
    );
    return {
      ...payload,
      definition_id: identity.generated_id,
      canonical_payload_digest: identity.canonical_payload_digest,
    };
  }).sort(compareMember);
  const rootPayload = {
    schema_version:
      'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION_SET/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    producer_registry_id: registry.producer_registry_id,
    producer_registry_payload_digest: registry.canonical_payload_digest,
    ordered_definitions: definitions.map((definition) => ({
      definition_id: definition.definition_id,
      canonical_payload_digest: definition.canonical_payload_digest,
    })),
    definition_count: definitions.length,
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      conflicting: [],
      unresolved: [],
    },
  };
  const rootIdentity = digestValue(
    'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION_SET',
    rootPayload,
  );
  return {
    producer_registry: registry,
    requirement_definitions: definitions,
    requirement_set_root: {
      ...rootPayload,
      requirement_set_root_id: rootIdentity.generated_id,
      canonical_payload_digest: rootIdentity.canonical_payload_digest,
    },
  };
}

function buildMutableAuthorityRegistry(inputIdentity, members) {
  const authorityKeys = [...new Set(members.flatMap((member) => (
    collectStringLeaves(member.canonical_value)
      .filter((value) => /(?:Head|Slot|_HEAD|_SLOT)$/u.test(value))
  )))].sort();
  const entries = authorityKeys.map((authorityCode) => ({
    authority_code: authorityCode,
    admission_state: 'NOT_ADMITTED_FOR_PILOT_RUNTIME',
    physical_relation: null,
    key_schema: null,
    allowed_operation_actions: [],
  }));
  const payload = {
    schema_version: 'GLOBAL_MUTABLE_AUTHORITY_REGISTRY/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    ordered_authority_entries: entries,
    dependency_edges: [],
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      unbacked: [],
      unordered: [],
    },
  };
  const identity = digestValue('GLOBAL_MUTABLE_AUTHORITY_REGISTRY', payload);
  return {
    ...payload,
    global_mutable_authority_registry_id: identity.generated_id,
    canonical_payload_digest: identity.canonical_payload_digest,
  };
}

function buildLockPlanRegistry(inputIdentity, mutableRegistry) {
  const payload = {
    schema_version: 'GENERATED_LOCK_PLAN_REGISTRY/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    global_mutable_authority_registry_id:
      mutableRegistry.global_mutable_authority_registry_id,
    global_mutable_authority_registry_payload_digest:
      mutableRegistry.canonical_payload_digest,
    ordered_lock_plans: [],
    runtime_mutation_admission: 'NONE_FOR_PILOT',
    validation_roots: {
      missing: [],
      extra: [],
      cyclic: [],
      incomparable: [],
      unbacked: [],
    },
  };
  const identity = digestValue('GENERATED_LOCK_PLAN_REGISTRY', payload);
  return {
    ...payload,
    generated_lock_plan_registry_id: identity.generated_id,
    canonical_payload_digest: identity.canonical_payload_digest,
  };
}

function buildSemanticStageRegistry(inputIdentity, members) {
  const recognisedStages = new Set([
    'SOURCE_ROLE',
    'CLASSIFICATION',
    'COMPOSITION',
    'FIELD_UNIVERSE',
    'THIRD_RECONCILER',
  ]);
  const observed = [...new Set(members.flatMap((member) => (
    collectStringLeaves(member.canonical_value)
      .filter((value) => recognisedStages.has(value))
  )))].sort();
  const payload = {
    schema_version: 'SEMANTIC_STAGE_REGISTRY/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    ordered_stage_keys: observed,
    unknown_stage_keys: [],
    duplicate_stage_keys: [],
  };
  const identity = digestValue('SEMANTIC_STAGE_REGISTRY', payload);
  return {
    ...payload,
    semantic_stage_registry_id: identity.generated_id,
    canonical_payload_digest: identity.canonical_payload_digest,
  };
}

function outputRecord(objectType, value, idField) {
  return {
    object_type: objectType,
    generated_id: value[idField],
    canonical_payload_digest: value.canonical_payload_digest,
  };
}

function compileCanonicalContractBundleGeneratedTopology({
  canonical_contract_input_compilation: inputCompilation,
  canonical_contract_bundle_compilation: bundleCompilation,
} = {}) {
  requireObject(inputCompilation, 'canonical_contract_input_compilation');
  requireObject(bundleCompilation, 'canonical_contract_bundle_compilation');
  const inputIdentity = inputCompilation.canonical_bundle_input_identity;
  requireObject(inputIdentity, 'canonical_bundle_input_identity');
  if (
    !SHA256_RE.test(inputIdentity.canonical_bundle_input_identity_id)
    || !SHA256_RE.test(inputIdentity.canonical_payload_digest)
    || inputCompilation.disposition.status
      !== 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE'
  ) {
    fail(
      'INCOMPLETE_CANONICAL_BUNDLE_INPUT_IDENTITY',
      'Generated topology requires one complete canonical input identity.',
    );
  }
  if (
    bundleCompilation.compile_report.status !== 'PASS'
    || bundleCompilation.compile_report.authored_input_identity_id
      !== inputIdentity.canonical_bundle_input_identity_id
  ) {
    fail(
      'GENERATED_TOPOLOGY_BUNDLE_INPUT_MISMATCH',
      'The aggregate compilation does not bind the exact canonical input identity.',
    );
  }
  const inputIdentityBody = clone(inputIdentity);
  delete inputIdentityBody.canonical_payload_digest;
  delete inputIdentityBody.canonical_bundle_input_identity_id;
  if (
    inputIdentity.canonical_payload_digest !== contentId(
      'CANONICAL_BUNDLE_INPUT_IDENTITY_PAYLOAD/V1',
      inputIdentityBody,
    )
    || inputIdentity.canonical_bundle_input_identity_id !== contentId(
      'CANONICAL_BUNDLE_INPUT/V1',
      inputIdentityBody,
    )
  ) {
    fail(
      'CANONICAL_BUNDLE_INPUT_IDENTITY_DRIFT',
      'The canonical input identity does not match its complete payload.',
    );
  }
  const members = inputCompilation.authored_members
    .filter((member) => member.object_kind !== GOVERNANCE_KIND);
  if (members.length === 0) {
    fail('EMPTY_GENERATED_TOPOLOGY_UNIVERSE', 'Authored contract members are required.');
  }
  members.forEach((member) => {
    const bytes = Buffer.from(canonicalJson(member.canonical_value), 'utf8');
    if (
      bytes.length !== member.canonical_byte_length
      || sha256Hex(bytes) !== member.canonical_bytes_digest
    ) {
      fail(
        'GENERATED_TOPOLOGY_AUTHORED_MEMBER_DRIFT',
        'An authored member does not match its retained identity.',
        { relative_path: member.relative_path },
      );
    }
  });

  const queryDefinitionSetRoot = buildQueryDefinitionSetRoot(inputIdentity, members);
  const queryGoldenSuiteManifest = buildQueryGoldenSuiteManifest(
    inputIdentity,
    queryDefinitionSetRoot,
    members,
  );
  const applicability = buildApplicabilityTopology(inputIdentity, members);
  const mutableAuthorityRegistry = buildMutableAuthorityRegistry(inputIdentity, members);
  const lockPlanRegistry = buildLockPlanRegistry(inputIdentity, mutableAuthorityRegistry);
  const semanticStageRegistry = buildSemanticStageRegistry(inputIdentity, members);
  const outputs = [
    outputRecord(
      'QUERY_DEFINITION_SET_ROOT',
      queryDefinitionSetRoot,
      'query_definition_set_root_id',
    ),
    outputRecord(
      'QUERY_GOLDEN_SUITE_MANIFEST',
      queryGoldenSuiteManifest,
      'query_golden_suite_manifest_id',
    ),
    outputRecord(
      'APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY',
      applicability.producer_registry,
      'producer_registry_id',
    ),
    ...applicability.requirement_definitions.map((definition) => outputRecord(
      'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION',
      definition,
      'definition_id',
    )),
    outputRecord(
      'APPLICABILITY_REEXAMINATION_REQUIREMENT_SET_ROOT',
      applicability.requirement_set_root,
      'requirement_set_root_id',
    ),
    outputRecord(
      'GLOBAL_MUTABLE_AUTHORITY_REGISTRY',
      mutableAuthorityRegistry,
      'global_mutable_authority_registry_id',
    ),
    outputRecord(
      'GENERATED_LOCK_PLAN_REGISTRY',
      lockPlanRegistry,
      'generated_lock_plan_registry_id',
    ),
    outputRecord(
      'SEMANTIC_STAGE_REGISTRY',
      semanticStageRegistry,
      'semantic_stage_registry_id',
    ),
  ].sort(compareMember);
  const outputKeys = outputs.map((entry) => (
    `${entry.object_type}:${entry.generated_id}`
  ));
  if (new Set(outputKeys).size !== outputKeys.length) {
    fail(
      'DUPLICATE_GENERATED_TOPOLOGY_IDENTITY',
      'Generated topology identities must be unique.',
    );
  }
  const manifestPayload = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    ordered_outputs: outputs,
    output_count: outputs.length,
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      conflicting: [],
      unresolved: [],
    },
  };
  const manifestIdentity = digestValue(
    'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST',
    manifestPayload,
  );
  const generatedOutputManifest = {
    ...manifestPayload,
    generated_output_manifest_id: manifestIdentity.generated_id,
    canonical_payload_digest: manifestIdentity.canonical_payload_digest,
  };
  const finalBundlePayload = {
    schema_version: FINAL_BUNDLE_SCHEMA_VERSION,
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    aggregate_contract_bundle_id: bundleCompilation.contract_bundle_id,
    aggregate_contract_bundle_digest: bundleCompilation.contract_bundle_digest,
    aggregate_member_root:
      bundleCompilation.canonical_contract_bundle_member_root,
    generated_output_manifest_id:
      generatedOutputManifest.generated_output_manifest_id,
    generated_output_manifest_payload_digest:
      generatedOutputManifest.canonical_payload_digest,
  };
  const finalBytes = Buffer.from(canonicalJson(finalBundlePayload), 'utf8');
  const finalBundle = {
    ...finalBundlePayload,
    canonical_contract_bundle_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_ID/V3',
      finalBundlePayload,
    ),
    canonical_contract_bundle_fingerprint: sha256Hex(finalBytes),
  };
  const payload = {
    canonical_bundle_input_identity: clone(inputIdentity),
    query_definition_set_root: queryDefinitionSetRoot,
    query_golden_suite_manifest: queryGoldenSuiteManifest,
    applicability_eligible_member_kind_producer_registry:
      applicability.producer_registry,
    applicability_reexamination_requirement_definitions:
      applicability.requirement_definitions,
    applicability_reexamination_requirement_set_root:
      applicability.requirement_set_root,
    global_mutable_authority_registry: mutableAuthorityRegistry,
    generated_lock_plan_registry: lockPlanRegistry,
    semantic_stage_registry: semanticStageRegistry,
    generated_output_manifest: generatedOutputManifest,
    final_canonical_contract_bundle: finalBundle,
    disposition: {
      state: 'GENERATED_TOPOLOGY_COMPLETE_NOT_FROZEN',
      freeze_authority: 'NONE',
      writer_authority: 'NONE',
      serving_authority: 'NONE',
      database_authority: 'NONE',
      release_authority: 'NONE',
      activation_authority: 'NONE',
      production_authority: 'NONE',
    },
  };
  return deepFreeze({
    schema_version: GENERATED_TOPOLOGY_SCHEMA_VERSION,
    ...payload,
    canonical_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_GENERATED_TOPOLOGY_PAYLOAD/V1',
      payload,
    ),
  });
}

module.exports = {
  GENERATED_TOPOLOGY_SCHEMA_VERSION,
  FINAL_BUNDLE_SCHEMA_VERSION,
  CanonicalContractBundleGeneratedTopologyError,
  compileCanonicalContractBundleGeneratedTopology,
};
