const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const GENERATED_TOPOLOGY_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_GENERATED_TOPOLOGY/V2';
const FINAL_BUNDLE_SCHEMA_VERSION = 'CANONICAL_CONTRACT_BUNDLE/V3';
const GENERATED_MEMBER_SCHEMA_VERSION =
  'CanonicalGeneratedContractBundleMember/V1';
const GOVERNANCE_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GENERATED_MEMBER_KEYS = Object.freeze([
  'schema_version',
  'member_key',
  'object_type',
  'generated_id',
  'member_schema_version',
  'byte_length',
  'payload_digest',
  'source_bytes_base64',
  'semantic_digest',
  'identity_digest',
]);
const GENERATED_MEMBER_ID_FIELDS = Object.freeze({
  QUERY_DEFINITION_SET_ROOT: 'query_definition_set_root_id',
  QUERY_GOLDEN_SUITE_MANIFEST: 'query_golden_suite_manifest_id',
  APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY:
    'producer_registry_id',
  APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION: 'definition_id',
  APPLICABILITY_REEXAMINATION_REQUIREMENT_SET_ROOT: 'requirement_set_root_id',
  GLOBAL_MUTABLE_AUTHORITY_REGISTRY:
    'global_mutable_authority_registry_id',
  GENERATED_LOCK_PLAN_REGISTRY: 'generated_lock_plan_registry_id',
  SEMANTIC_STAGE_REGISTRY: 'semantic_stage_registry_id',
});

const GOVERNANCE_INPUT = require(
  '../../contracts/canonical-v2/generated-topology-inputs/governance/generated-topology-governance.v1.json'
);
const GOLDEN_FIXTURE_INPUTS = Object.freeze([
  require(
    '../../contracts/canonical-v2/generated-topology-inputs/query-golden-fixtures/metsera-process-query-goldens.v1.json'
  ),
  require(
    '../../contracts/canonical-v2/generated-topology-inputs/query-golden-fixtures/qxo-capitalisation-query-goldens.v1.json'
  ),
]);

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

function validateCanonicalGeneratedContractBundleMember(member) {
  if (
    !member
    || typeof member !== 'object'
    || Array.isArray(member)
    || Object.getPrototypeOf(member) !== Object.prototype
  ) {
    fail(
      'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
      'A generated contract bundle member must be a plain object.',
    );
  }
  const actualKeys = Object.keys(member).sort();
  const expectedKeys = [...GENERATED_MEMBER_KEYS].sort();
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail(
      'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
      'A generated contract bundle member must use the exact closed fields.',
    );
  }
  const idField = GENERATED_MEMBER_ID_FIELDS[member.object_type];
  if (
    member.schema_version !== GENERATED_MEMBER_SCHEMA_VERSION
    || !SHA256_RE.test(member.generated_id)
    || member.member_key !== `GENERATED/${member.generated_id.toUpperCase()}`
    || idField === undefined
    || typeof member.member_schema_version !== 'string'
    || member.member_schema_version.length === 0
    || !Number.isSafeInteger(member.byte_length)
    || member.byte_length < 1
    || !SHA256_RE.test(member.payload_digest)
    || !SHA256_RE.test(member.semantic_digest)
    || !SHA256_RE.test(member.identity_digest)
    || typeof member.source_bytes_base64 !== 'string'
    || member.source_bytes_base64.length === 0
  ) {
    fail(
      'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
      'A generated contract bundle member has an invalid closed identity.',
    );
  }
  const bytes = Buffer.from(member.source_bytes_base64, 'base64');
  if (
    bytes.length === 0
    || bytes.toString('base64') !== member.source_bytes_base64
  ) {
    fail(
      'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
      'A generated contract bundle member must contain canonical base64.',
    );
  }
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(
      'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
      'A generated contract bundle member must contain UTF-8 JSON.',
    );
  }
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !bytes.equals(Buffer.from(canonicalJson(value), 'utf8'))
    || bytes.length !== member.byte_length
    || sha256Hex(bytes) !== member.payload_digest
    || value.schema_version !== member.member_schema_version
    || value[idField] !== member.generated_id
    || !SHA256_RE.test(value.canonical_payload_digest)
    || member.semantic_digest !== contentId(
      'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_SEMANTIC/V1',
      value,
    )
    || member.identity_digest !== contentId(
      'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_IDENTITY/V1',
      {
        member_key: member.member_key,
        generated_id: member.generated_id,
        canonical_payload_digest: value.canonical_payload_digest,
      },
    )
  ) {
    fail(
      'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
      'A generated contract bundle member does not match its canonical bytes.',
    );
  }
  return true;
}

function compareCanonical(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right));
}

function compareStrings(left, right) {
  return left.localeCompare(right);
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

function sourceIdentity(value, sourcePath) {
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  return {
    relative_path: sourcePath,
    object_kind: value.object_kind,
    stable_id: value.stable_id,
    schema_version: value.schema_version,
    canonical_bytes_digest: sha256Hex(bytes),
    canonical_byte_length: bytes.length,
  };
}

function uniqueStrings(values, label) {
  if (
    !Array.isArray(values)
    || values.length === 0
    || values.some((value) => typeof value !== 'string' || value.length === 0)
    || new Set(values).size !== values.length
  ) {
    fail('INVALID_GENERATED_TOPOLOGY_GOVERNANCE', `${label} must be non-empty and unique.`);
  }
  return [...values].sort(compareStrings);
}

function validateAuthorityContract(value, label) {
  requireObject(value, label);
  const expected = [
    'freeze_authority',
    'writer_authority',
    'serving_authority',
    'database_authority',
    'release_authority',
    'activation_authority',
    'production_authority',
  ];
  for (const key of expected) {
    if (value[key] !== 'NONE') {
      fail(
        'GENERATED_TOPOLOGY_AUTHORITY_ESCALATION',
        `${label}.${key} must remain NONE.`,
      );
    }
  }
}

function compileGovernedTopologyInputs({
  governance = GOVERNANCE_INPUT,
  fixture_sets: fixtureSets = GOLDEN_FIXTURE_INPUTS,
} = {}) {
  requireObject(governance, 'generated topology governance');
  if (
    governance.object_kind !== 'GENERATED_TOPOLOGY_GOVERNANCE_INPUT'
    || governance.stable_id !== 'P1_PILOT_GENERATED_TOPOLOGY_GOVERNANCE'
    || governance.schema_version !== 'GENERATED_TOPOLOGY_GOVERNANCE_INPUT/V1'
  ) {
    fail(
      'INVALID_GENERATED_TOPOLOGY_GOVERNANCE',
      'The generated topology governance identity is not the governed pilot identity.',
    );
  }
  requireObject(governance.definition, 'generated topology governance definition');
  const definition = governance.definition;
  validateAuthorityContract(definition.authority_contract, 'governance authority contract');

  const queryDefinitionStableIds = uniqueStrings(
    definition.query_definition_stable_ids,
    'query_definition_stable_ids',
  );
  const queryTemplates = clone(definition.query_template_contracts || [])
    .sort(compareCanonical);
  const templateIds = queryTemplates.map((entry) => entry.template_id);
  if (
    queryTemplates.length === 0
    || new Set(templateIds).size !== templateIds.length
    || queryTemplates.some((entry) => (
      !['DATABASE_API', 'CLIENT_ONLY_NO_SQL_NO_API'].includes(entry.fixture_kind)
      || entry.minimum_fixture_count !== 1
    ))
  ) {
    fail(
      'INVALID_QUERY_TEMPLATE_GOVERNANCE',
      'Query template contracts must be unique and require one governed fixture.',
    );
  }
  const refusalClasses = uniqueStrings(
    definition.refusal_classes,
    'refusal_classes',
  );
  const applicabilityRules = clone(definition.applicability_kind_rules || [])
    .sort(compareCanonical);
  const applicabilityKinds = applicabilityRules.map(
    (entry) => entry.universe_member_kind,
  );
  if (
    applicabilityRules.length === 0
    || new Set(applicabilityKinds).size !== applicabilityKinds.length
    || applicabilityRules.some((entry) => (
      !['DEAL_FAMILY', 'SCOPE_OR_SOURCE_ADMISSION'].includes(entry.owner_class)
    ))
  ) {
    fail(
      'INVALID_APPLICABILITY_KIND_GOVERNANCE',
      'Applicability kind rules must contain one explicit owner per eligible kind.',
    );
  }
  const mutableAuthorityExclusions = uniqueStrings(
    definition.mutable_authority_exclusions,
    'mutable_authority_exclusions',
  );
  requireObject(
    definition.mutable_authority_exclusion_rule,
    'mutable authority exclusion rule',
  );
  if (
    definition.mutable_authority_exclusion_rule.classification
      !== 'IMMUTABLE_LOGICAL_CREATION_SLOT_CONTRACT'
    || definition.mutable_authority_exclusion_rule.runtime_mutation_admission
      !== 'NONE_FOR_PILOT'
  ) {
    fail(
      'INVALID_MUTABLE_AUTHORITY_EXCLUSION_GOVERNANCE',
      'Pilot mutable-authority exclusions must deny runtime mutation.',
    );
  }
  const semanticStageContracts = clone(definition.semantic_stage_contracts || [])
    .sort((left, right) => compareStrings(left.stage_key, right.stage_key));
  const requiredStageKeys = [
    'CLASSIFICATION',
    'COMPOSITION',
    'FIELD_UNIVERSE',
    'SOURCE_ROLE',
    'THIRD_RECONCILER',
  ];
  if (
    canonicalJson(semanticStageContracts.map((entry) => entry.stage_key).sort())
      !== canonicalJson(requiredStageKeys)
    || semanticStageContracts.some((entry) => (
      !Array.isArray(entry.permitted_worker_paths)
      || entry.permitted_worker_paths.length === 0
      || !Array.isArray(entry.ordered_input_roles)
      || entry.ordered_input_roles.length === 0
      || !Number.isSafeInteger(entry.maximum_output_cardinality)
      || entry.maximum_output_cardinality < 1
    ))
  ) {
    fail(
      'INVALID_SEMANTIC_STAGE_GOVERNANCE',
      'The semantic-stage registry must define all five complete pilot stages.',
    );
  }

  if (!Array.isArray(fixtureSets) || fixtureSets.length !== 2) {
    fail(
      'INVALID_QUERY_GOLDEN_FIXTURE_SET',
      'Exactly the governed QXO and Metsera fixture sets are required.',
    );
  }
  const orderedFixtureSets = clone(fixtureSets).sort(
    (left, right) => compareStrings(left.stable_id, right.stable_id),
  );
  const fixtures = [];
  for (const fixtureSet of orderedFixtureSets) {
    if (
      fixtureSet.object_kind !== 'QUERY_GOLDEN_FIXTURE_SET'
      || fixtureSet.schema_version !== 'QUERY_GOLDEN_FIXTURE_SET/V1'
      || !['METSERA_PROCESS_QUERY_GOLDENS', 'QXO_CAPITALISATION_QUERY_GOLDENS']
        .includes(fixtureSet.stable_id)
      || !Array.isArray(fixtureSet.fixtures)
      || fixtureSet.fixtures.length === 0
    ) {
      fail(
        'INVALID_QUERY_GOLDEN_FIXTURE_SET',
        'A governed query fixture set is incomplete or has an unknown identity.',
      );
    }
    for (const fixture of fixtureSet.fixtures) {
      requireObject(fixture, 'query golden fixture');
      if (
        typeof fixture.test_id !== 'string'
        || !['DATABASE_API', 'CLIENT_ONLY_NO_SQL_NO_API', 'REFUSAL']
          .includes(fixture.fixture_kind)
      ) {
        fail(
          'INVALID_QUERY_GOLDEN_FIXTURE',
          'Every query golden fixture needs a test ID and governed tagged kind.',
        );
      }
      if (
        fixture.fixture_kind === 'REFUSAL'
        && !refusalClasses.includes(fixture.refusal_class)
      ) {
        fail(
          'INVALID_QUERY_GOLDEN_FIXTURE',
          'A refusal fixture uses an ungoverned refusal class.',
        );
      }
      fixtures.push({
        fixture_set_stable_id: fixtureSet.stable_id,
        ...fixture,
      });
    }
  }
  fixtures.sort((left, right) => compareStrings(left.test_id, right.test_id));
  if (new Set(fixtures.map((entry) => entry.test_id)).size !== fixtures.length) {
    fail('DUPLICATE_QUERY_GOLDEN_FIXTURE', 'Query golden test IDs must be unique.');
  }
  const missingTemplates = queryTemplates.filter((template) => (
    fixtures.filter((fixture) => (
      fixture.fixture_kind === template.fixture_kind
      && fixture.template_id === template.template_id
    )).length < template.minimum_fixture_count
  )).map((entry) => entry.template_id);
  const missingRefusals = refusalClasses.filter((refusalClass) => (
    !fixtures.some((fixture) => (
      fixture.fixture_kind === 'REFUSAL'
      && fixture.refusal_class === refusalClass
    ))
  ));
  if (missingTemplates.length > 0 || missingRefusals.length > 0) {
    fail(
      'INCOMPLETE_QUERY_GOLDEN_COVERAGE',
      'The governed golden suite does not cover every pilot template and refusal class.',
      { missing_templates: missingTemplates, missing_refusal_classes: missingRefusals },
    );
  }

  const governanceIdentity = sourceIdentity(
    governance,
    'contracts/canonical-v2/generated-topology-inputs/governance/generated-topology-governance.v1.json',
  );
  const fixtureSetIdentities = orderedFixtureSets.map((fixtureSet) => sourceIdentity(
    fixtureSet,
    `contracts/canonical-v2/generated-topology-inputs/query-golden-fixtures/${
      fixtureSet.stable_id === 'METSERA_PROCESS_QUERY_GOLDENS'
        ? 'metsera-process-query-goldens.v1.json'
        : 'qxo-capitalisation-query-goldens.v1.json'
    }`,
  ));
  const inputPayload = {
    governance_identity: governanceIdentity,
    ordered_fixture_set_identities: fixtureSetIdentities,
  };
  return deepFreeze({
    governance: clone(governance),
    fixture_sets: orderedFixtureSets,
    fixtures,
    query_definition_stable_ids: queryDefinitionStableIds,
    query_template_contracts: queryTemplates,
    refusal_classes: refusalClasses,
    applicability_kind_rules: applicabilityRules,
    mutable_authority_exclusions: mutableAuthorityExclusions,
    mutable_authority_exclusion_rule:
      clone(definition.mutable_authority_exclusion_rule),
    semantic_stage_contracts: semanticStageContracts,
    governed_topology_input_identity: {
      ...inputPayload,
      governed_topology_input_id: contentId(
        'CANONICAL_GENERATED_TOPOLOGY_GOVERNED_INPUT/V1',
        inputPayload,
      ),
      canonical_payload_digest: contentId(
        'CANONICAL_GENERATED_TOPOLOGY_GOVERNED_INPUT_PAYLOAD/V1',
        inputPayload,
      ),
    },
  });
}

function buildQueryDefinitionSetRoot(inputIdentity, members, governed) {
  const byStableId = new Map(members.map((member) => [member.stable_id, member]));
  const missing = governed.query_definition_stable_ids.filter(
    (stableId) => !byStableId.has(stableId),
  );
  if (missing.length > 0) {
    fail(
      'QUERY_DEFINITION_UNIVERSE_INCOMPLETE',
      'A governed query definition is absent from the canonical authored universe.',
      { missing_stable_ids: missing },
    );
  }
  const entries = governed.query_definition_stable_ids.map((stableId) => {
    const member = byStableId.get(stableId);
    return {
      authored_identity: identityOf(member),
      canonical_payload_digest: member.canonical_bytes_digest,
    };
  }).sort(compareCanonical);
  const perKindCounts = {};
  for (const entry of entries) {
    const kind = entry.authored_identity.object_kind;
    perKindCounts[kind] = (perKindCounts[kind] || 0) + 1;
  }
  const payload = {
    schema_version: 'QUERY_DEFINITION_SET_ROOT/V2',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    governed_topology_input_id:
      governed.governed_topology_input_identity.governed_topology_input_id,
    ordered_definitions: entries,
    definition_count: entries.length,
    per_kind_counts: Object.fromEntries(
      Object.entries(perKindCounts).sort(([left], [right]) => compareStrings(left, right)),
    ),
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

function buildQueryGoldenSuiteManifest(inputIdentity, queryRoot, governed) {
  const orderedFixtures = governed.fixtures.map((fixture) => {
    const payloadDigest = contentId('QUERY_GOLDEN_FIXTURE_PAYLOAD/V1', fixture);
    return {
      test_id: fixture.test_id,
      fixture_kind: fixture.fixture_kind,
      template_id: fixture.template_id || null,
      refusal_class: fixture.refusal_class || null,
      fixture_set_stable_id: fixture.fixture_set_stable_id,
      canonical_payload_digest: payloadDigest,
      fixture_id: contentId('QUERY_GOLDEN_FIXTURE_ID/V1', {
        test_id: fixture.test_id,
        canonical_payload_digest: payloadDigest,
      }),
    };
  }).sort(compareCanonical);
  const perKindCounts = {};
  for (const fixture of orderedFixtures) {
    perKindCounts[fixture.fixture_kind] =
      (perKindCounts[fixture.fixture_kind] || 0) + 1;
  }
  const coverage = governed.query_template_contracts.map((template) => ({
    template_id: template.template_id,
    fixture_kind: template.fixture_kind,
    fixture_ids: orderedFixtures.filter((fixture) => (
      fixture.fixture_kind === template.fixture_kind
      && fixture.template_id === template.template_id
    )).map((fixture) => fixture.fixture_id),
  })).sort(compareCanonical);
  const refusalCoverage = governed.refusal_classes.map((refusalClass) => ({
    refusal_class: refusalClass,
    fixture_ids: orderedFixtures.filter((fixture) => (
      fixture.fixture_kind === 'REFUSAL'
      && fixture.refusal_class === refusalClass
    )).map((fixture) => fixture.fixture_id),
  })).sort(compareCanonical);
  const payload = {
    schema_version: 'QUERY_GOLDEN_SUITE_MANIFEST/V2',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    governed_topology_input_id:
      governed.governed_topology_input_identity.governed_topology_input_id,
    query_definition_set_root_id: queryRoot.query_definition_set_root_id,
    query_definition_set_root_payload_digest:
      queryRoot.canonical_payload_digest,
    ordered_fixture_set_identities:
      governed.governed_topology_input_identity.ordered_fixture_set_identities,
    ordered_fixtures: orderedFixtures,
    fixture_count: orderedFixtures.length,
    per_kind_counts: Object.fromEntries(
      Object.entries(perKindCounts).sort(([left], [right]) => compareStrings(left, right)),
    ),
    template_coverage: coverage,
    refusal_coverage: refusalCoverage,
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      conflicting: [],
      uncovered_template: [],
      uncovered_refusal_class: [],
    },
  };
  const identity = digestValue('QUERY_GOLDEN_SUITE_MANIFEST', payload);
  return {
    ...payload,
    query_golden_suite_manifest_id: identity.generated_id,
    canonical_payload_digest: identity.canonical_payload_digest,
  };
}

function producerFields(rule) {
  if (rule.owner_class === 'SCOPE_OR_SOURCE_ADMISSION') {
    return {
      subject_key_schema: 'GOVERNED_SCOPE_SUBJECT_KEY/V1',
      local_slice_rule: 'ONE_SCOPE_ENTRY_AND_SLICE_PER_KIND_AND_SUBJECT',
      cardinality: 'EXACTLY_ONE_PER_KIND_AND_GOVERNED_SUBJECT',
      operation: 'DEAL_SCOPE_RUN',
      action: 'MATERIALISE_SCOPE',
      discriminator_set: ['MULTI_SUBJECT_CORRECTION', 'SINGLE_SUBJECT'],
      discriminator_rule: 'MECHANICAL_FIXED_POINT_COMPONENT_CARDINALITY/V1',
      entry_physical_carrier: 'SCOPE_APPLICABILITY_ENTRY',
      slice_physical_carrier: 'SCOPE_APPLICABILITY_SLICE',
      receipt_policy: 'DEAL_SCOPE_RUN_RECEIPT_BINDS_DISCRIMINATOR',
      creation_slot_authority: 'SCOPE_APPLICABILITY_CREATION_SLOT',
      lock_authority: 'SCOPE_APPLICABILITY_CREATION_SLOT',
    };
  }
  return {
    subject_key_schema: 'GOVERNED_DEAL_FAMILY_KEY/V1',
    local_slice_rule: 'ONE_FAMILY_ENTRY_AND_SLICE_PER_KIND_AND_FAMILY',
    cardinality: 'EXACTLY_ONE_PER_KIND_AND_GOVERNED_FAMILY',
    operation: 'DEAL_EXTRACTION_RUN',
    action: 'FAMILY_BUILD/MATERIALISE',
    discriminator_set: ['DEAL_FAMILY'],
    discriminator_rule: 'EXACT_GOVERNED_DEAL_FAMILY_KEY/V1',
    entry_physical_carrier: 'FAMILY_APPLICABILITY_ENTRY',
    slice_physical_carrier: 'FAMILY_APPLICABILITY_SLICE',
    receipt_policy: 'FAMILY_BUILD_RECEIPT_IS_RECEIPT',
    creation_slot_authority: 'FAMILY_APPLICABILITY_CREATION_SLOT',
    lock_authority: 'FAMILY_APPLICABILITY_CREATION_SLOT',
  };
}

function buildApplicabilityTopology(inputIdentity, members, governed) {
  const rulesByKind = new Map(governed.applicability_kind_rules.map(
    (rule) => [rule.universe_member_kind, rule],
  ));
  const eligibleMembers = members.filter((member) => rulesByKind.has(member.object_kind));
  if (eligibleMembers.length === 0) {
    fail('EMPTY_APPLICABILITY_DELTA_UNIVERSE', 'Pilot taxonomy deltas are required.');
  }
  const schemasByKind = new Map();
  for (const member of eligibleMembers) {
    const existing = schemasByKind.get(member.object_kind);
    if (existing && existing !== member.schema_version) {
      fail(
        'CONFLICTING_APPLICABILITY_KIND_SCHEMA',
        'An applicability kind has more than one authored schema version.',
        { universe_member_kind: member.object_kind },
      );
    }
    schemasByKind.set(member.object_kind, member.schema_version);
  }
  const missingKinds = governed.applicability_kind_rules
    .map((rule) => rule.universe_member_kind)
    .filter((kind) => !schemasByKind.has(kind));
  if (missingKinds.length > 0) {
    fail(
      'MISSING_APPLICABILITY_KIND',
      'A governed applicability kind is absent from the authored pilot universe.',
      { missing_kinds: missingKinds },
    );
  }
  const entries = governed.applicability_kind_rules.map((rule) => ({
    universe_member_kind: rule.universe_member_kind,
    universe_member_schema: schemasByKind.get(rule.universe_member_kind),
    stable_key_extractor: 'AUTHORED_IDENTITY_STABLE_ID',
    owner_class: rule.owner_class,
    ...producerFields(rule),
  })).sort(compareCanonical);
  const registryPayload = {
    schema_version:
      'APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY/V3',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    canonical_bundle_input_identity_payload_digest:
      inputIdentity.canonical_payload_digest,
    governed_topology_input_id:
      governed.governed_topology_input_identity.governed_topology_input_id,
    ordered_entries: entries,
    aggregate_scope_subject_root_contract: {
      carrier: 'SCOPE_SUBJECT_APPLICABILITY_ROOT',
      root_schema: 'SCOPE_SUBJECT_APPLICABILITY_ROOT/V1',
      stable_key_extractor: 'GOVERNED_SCOPE_SUBJECT_KEY',
      cardinality: 'EXACTLY_ONE_PER_GOVERNED_SUBJECT',
      discriminator_set: ['MULTI_SUBJECT_CORRECTION', 'SINGLE_SUBJECT'],
      creation_slot_authority: 'SCOPE_SUBJECT_APPLICABILITY_ROOT_CREATION_SLOT',
      lock_authority: 'SCOPE_SUBJECT_APPLICABILITY_ROOT_CREATION_SLOT',
      receipt_policy: 'DEAL_SCOPE_RUN_RECEIPT_BINDS_DISCRIMINATOR',
      caller_override_permitted: false,
    },
    validation_roots: {
      unknown: [],
      duplicate: [],
      conflicting_assignment: [],
      incomplete_entry: [],
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
  const entryKeys = new Map(entries.map((entry) => [
    entry.universe_member_kind,
    contentId('APPLICABILITY_PRODUCER_REGISTRY_ENTRY/V1', entry),
  ]));
  const definitions = eligibleMembers.map((member) => {
    const payload = {
      schema_version:
        'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION/V1',
      canonical_bundle_input_identity_id:
        inputIdentity.canonical_bundle_input_identity_id,
      canonical_bundle_input_identity_payload_digest:
        inputIdentity.canonical_payload_digest,
      adopted_contract_item: identityOf(member),
      predecessor_contract_item: {
        marker: 'INITIAL_CONTRACT_BASELINE',
        governance:
          'P1_PILOT_SUCCESSOR_HAS_NO_PREDECESSOR_ITEM_WITH_THIS_STABLE_KEY_AND_VERSION',
      },
      applicability_predicate: {
        operator: 'AFFECTED_BY_CONTRACT_ITEM',
        contract_item_kind: member.object_kind,
        contract_item_stable_id: member.stable_id,
        contract_item_schema_version: member.schema_version,
      },
      affected_dependency_closure_rule: 'TRANSITIVE_DEPENDANTS',
      producer_registry_id: registry.producer_registry_id,
      producer_registry_payload_digest: registry.canonical_payload_digest,
      permitted_registry_entry_set: [entryKeys.get(member.object_kind)],
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
  }).sort(compareCanonical);
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

function buildMutableAuthorityRegistry(inputIdentity, members, governed) {
  const observed = [...new Set(members.flatMap((member) => (
    collectStringLeaves(member.canonical_value)
      .filter((value) => /(?:Head|Slot|_HEAD|_SLOT)$/u.test(value))
  )))].sort(compareStrings);
  const missingExclusions = observed.filter(
    (authorityCode) => !governed.mutable_authority_exclusions.includes(authorityCode),
  );
  const extraExclusions = governed.mutable_authority_exclusions.filter(
    (authorityCode) => !observed.includes(authorityCode),
  );
  if (missingExclusions.length > 0 || extraExclusions.length > 0) {
    fail(
      'MUTABLE_AUTHORITY_CLOSURE_MISMATCH',
      'Every observed pilot slot token must have one exact governed exclusion.',
      { missing_exclusions: missingExclusions, extra_exclusions: extraExclusions },
    );
  }
  const exclusions = observed.map((authorityCode) => ({
    authority_code: authorityCode,
    ...clone(governed.mutable_authority_exclusion_rule),
  }));
  const payload = {
    schema_version: 'GLOBAL_MUTABLE_AUTHORITY_REGISTRY/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    governed_topology_input_id:
      governed.governed_topology_input_identity.governed_topology_input_id,
    ordered_authority_entries: [],
    governed_non_mutable_exclusions: exclusions,
    dependency_edges: [],
    runtime_mutation_admission: 'NONE_FOR_PILOT',
    validation_roots: {
      missing: [],
      extra: [],
      duplicate: [],
      unbacked: [],
      unordered: [],
      unexplained_exclusion: [],
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
  if (
    mutableRegistry.ordered_authority_entries.length !== 0
    || mutableRegistry.runtime_mutation_admission !== 'NONE_FOR_PILOT'
  ) {
    fail(
      'UNPLANNED_MUTABLE_AUTHORITY',
      'Every admitted mutable authority requires an exact generated lock plan.',
    );
  }
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
    empty_plan_proof: {
      admitted_mutable_authority_count: 0,
      admitted_database_operation_action_count: 0,
      governed_exclusion_count:
        mutableRegistry.governed_non_mutable_exclusions.length,
    },
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

function buildSemanticStageRegistry(inputIdentity, governed) {
  const orderedStageContracts = governed.semantic_stage_contracts.map((entry) => ({
    ...entry,
    semantic_stage_contract_digest: contentId(
      'SEMANTIC_STAGE_CONTRACT/V1',
      entry,
    ),
  }));
  const payload = {
    schema_version: 'SEMANTIC_STAGE_REGISTRY/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    governed_topology_input_id:
      governed.governed_topology_input_identity.governed_topology_input_id,
    ordered_stage_contracts: orderedStageContracts,
    stage_count: orderedStageContracts.length,
    unknown_stage_keys: [],
    duplicate_stage_keys: [],
    incomplete_stage_contracts: [],
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

function generatedMember(objectType, value, idField) {
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  const generatedId = value[idField];
  const memberKey = `GENERATED/${generatedId.toUpperCase()}`;
  const member = {
    schema_version: GENERATED_MEMBER_SCHEMA_VERSION,
    member_key: memberKey,
    object_type: objectType,
    generated_id: generatedId,
    member_schema_version: value.schema_version,
    byte_length: bytes.length,
    payload_digest: sha256Hex(bytes),
    source_bytes_base64: bytes.toString('base64'),
    semantic_digest: contentId(
      'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_SEMANTIC/V1',
      value,
    ),
    identity_digest: contentId(
      'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_IDENTITY/V1',
      {
        member_key: memberKey,
        generated_id: generatedId,
        canonical_payload_digest: value.canonical_payload_digest,
      },
    ),
  };
  validateCanonicalGeneratedContractBundleMember(member);
  return member;
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
  const governed = compileGovernedTopologyInputs();
  const queryDefinitionSetRoot =
    buildQueryDefinitionSetRoot(inputIdentity, members, governed);
  const queryGoldenSuiteManifest =
    buildQueryGoldenSuiteManifest(inputIdentity, queryDefinitionSetRoot, governed);
  const applicability = buildApplicabilityTopology(inputIdentity, members, governed);
  const mutableAuthorityRegistry =
    buildMutableAuthorityRegistry(inputIdentity, members, governed);
  const lockPlanRegistry =
    buildLockPlanRegistry(inputIdentity, mutableAuthorityRegistry);
  const semanticStageRegistry =
    buildSemanticStageRegistry(inputIdentity, governed);

  const generatedValues = [
    {
      objectType: 'QUERY_DEFINITION_SET_ROOT',
      value: queryDefinitionSetRoot,
      idField: 'query_definition_set_root_id',
    },
    {
      objectType: 'QUERY_GOLDEN_SUITE_MANIFEST',
      value: queryGoldenSuiteManifest,
      idField: 'query_golden_suite_manifest_id',
    },
    {
      objectType: 'APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY',
      value: applicability.producer_registry,
      idField: 'producer_registry_id',
    },
    ...applicability.requirement_definitions.map((value) => ({
      objectType: 'APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION',
      value,
      idField: 'definition_id',
    })),
    {
      objectType: 'APPLICABILITY_REEXAMINATION_REQUIREMENT_SET_ROOT',
      value: applicability.requirement_set_root,
      idField: 'requirement_set_root_id',
    },
    {
      objectType: 'GLOBAL_MUTABLE_AUTHORITY_REGISTRY',
      value: mutableAuthorityRegistry,
      idField: 'global_mutable_authority_registry_id',
    },
    {
      objectType: 'GENERATED_LOCK_PLAN_REGISTRY',
      value: lockPlanRegistry,
      idField: 'generated_lock_plan_registry_id',
    },
    {
      objectType: 'SEMANTIC_STAGE_REGISTRY',
      value: semanticStageRegistry,
      idField: 'semantic_stage_registry_id',
    },
  ];
  const outputs = generatedValues.map((entry) => outputRecord(
    entry.objectType,
    entry.value,
    entry.idField,
  )).sort(compareCanonical);
  const outputKeys = outputs.map((entry) => (
    `${entry.object_type}:${entry.generated_id}`
  ));
  if (new Set(outputKeys).size !== outputKeys.length) {
    fail(
      'DUPLICATE_GENERATED_TOPOLOGY_IDENTITY',
      'Generated topology identities must be unique.',
    );
  }
  const generatedMembers = generatedValues.map((entry) => generatedMember(
    entry.objectType,
    entry.value,
    entry.idField,
  )).sort((left, right) => compareStrings(left.member_key, right.member_key));
  const generatedProjection = generatedMembers.map((member) => ({
    member_key: member.member_key,
    semantic_digest: member.semantic_digest,
    identity_digest: member.identity_digest,
  }));
  const generatedMemberRoot = contentId(
    'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    generatedMembers,
  );
  const manifestPayload = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST/V1',
    canonical_bundle_input_identity_id:
      inputIdentity.canonical_bundle_input_identity_id,
    governed_topology_input_identity:
      clone(governed.governed_topology_input_identity),
    ordered_outputs: outputs,
    generated_member_root: generatedMemberRoot,
    generated_member_count: generatedMembers.length,
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
    generated_output_manifest: generatedOutputManifest,
    ordered_generated_member_projection: generatedProjection,
  };
  const finalBundle = {
    ...finalBundlePayload,
    canonical_contract_bundle_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_ID/V3',
      finalBundlePayload,
    ),
    canonical_contract_bundle_fingerprint: contentId(
      'CANONICAL_CONTRACT_BUNDLE/V3',
      finalBundlePayload,
    ),
  };
  const payload = {
    canonical_bundle_input_identity: clone(inputIdentity),
    governed_topology_input_identity:
      clone(governed.governed_topology_input_identity),
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
    generated_contract_bundle_members: generatedMembers,
    generated_contract_bundle_projection: generatedProjection,
    generated_contract_bundle_member_root: generatedMemberRoot,
    generated_output_manifest: generatedOutputManifest,
    final_canonical_contract_bundle: finalBundle,
    disposition: {
      state: 'GENERATED_TOPOLOGY_COMPLETE_NOT_FROZEN',
      freeze_authority: 'NONE',
      signing_authority: 'NONE',
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
      'CANONICAL_CONTRACT_BUNDLE_GENERATED_TOPOLOGY_PAYLOAD/V2',
      payload,
    ),
  });
}

module.exports = {
  GENERATED_TOPOLOGY_SCHEMA_VERSION,
  FINAL_BUNDLE_SCHEMA_VERSION,
  GENERATED_MEMBER_SCHEMA_VERSION,
  CanonicalContractBundleGeneratedTopologyError,
  validateCanonicalGeneratedContractBundleMember,
  compileGovernedTopologyInputs,
  compileCanonicalContractBundleGeneratedTopology,
};
