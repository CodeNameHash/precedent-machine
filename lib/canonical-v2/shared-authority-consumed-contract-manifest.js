const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('./canonical-contract-input-compiler');

const SHA256_RE = /^[0-9a-f]{64}$/;
const CONSUMED_MANIFEST_SCHEMA =
  'SHARED_AUTHORITY_CONSUMED_CONTRACT_MANIFEST/V1';
const CONSUMED_INPUT_SET_SCHEMA = 'SHARED_AUTHORITY_CONSUMED_INPUT_SET/V1';
const RELEASE_BINDING_SCHEMA = 'SHARED_AUTHORITY_CONSUMER_RELEASE_BINDING/V1';
const CONSUMED_INPUT_SET_DOMAIN = 'SHARED_AUTHORITY_CONSUMED_INPUT_SET/V1';
const CONSUMED_MANIFEST_DOMAIN =
  'SHARED_AUTHORITY_CONSUMED_CONTRACT_MANIFEST/V1';
const CONSUMED_MANIFEST_PAYLOAD_DOMAIN =
  'SHARED_AUTHORITY_CONSUMED_CONTRACT_MANIFEST_PAYLOAD/V1';
const RELEASE_BINDING_DOMAIN = 'SHARED_AUTHORITY_CONSUMER_RELEASE_BINDING/V1';
const RELEASE_BINDING_PAYLOAD_DOMAIN =
  'SHARED_AUTHORITY_CONSUMER_RELEASE_BINDING_PAYLOAD/V1';
const APPROVED_SHARED_DESIGN_SHA256 =
  '7dd9552c2634e4f64f0fc662f40002879fd6fca595a2394d8e3eb27baf35dbbe';
const PROJECTION_STABLE_ID = 'CANONICAL_DEAL_FACT_PROJECTION';
const FIELD_CATALOGUE_STABLE_ID = 'SHARED_DEAL_FIELD_CATALOGUE';
const EXPECTED_PROJECTION_CONTRACT_SHA256 =
  'd7f5c7bdab3ddcb60b2348ffb2f9dfe224f9aeecd7f63a7118e38e5ccced80d6';
const EXPECTED_FIELD_BINDINGS_SHA256 =
  '9c8ee2dd176a7f02045c6d9f77fe1ad0155b8d4062367cbd05e1089985393f14';
const EXPECTED_RUNTIME_COMPATIBILITY_SHA256 =
  'e81906c8afacf4988191c5f6a75632d2e7ed2f934adcf50d7f4d0d1cafee2a8c';
const EXPECTED_AUTHORITY_LIMITS_SHA256 =
  '86e06a0ee887c74f77931fb758cce145f7ab475ed5b648df50a5d5cc4a8717a0';

const REQUIRED_RELEASE_IDENTITY_INPUTS = Object.freeze([
  'canonical_contract_fingerprint',
  'serving_namespace_id',
  'corpus_release_id',
  'governed_deal_id',
  'projection_version',
]);
const REQUIRED_FIELD_ENTRY_KEYS = Object.freeze([
  'field_key',
  'field_version',
  'canonical_value',
  'display_label',
  'typed_state',
  'typed_lineage',
  'exact_detail_action',
  'conflict_indicator',
  'derivation_reference',
  'release_identity',
]);
const REQUIRED_TERMINAL_LINEAGE_TYPES = Object.freeze([
  'ENTITY_REVISION',
  'ENTITY_NAME_REVISION',
  'IDENTITY_BRIDGE_REVISION',
  'DEAL_FACT_RESOLUTION_REVISION',
  'PARTICIPANT_RELATIONSHIP_REVISION',
  'PROFESSIONAL_ASSIGNMENT_REVISION',
  'LAWYER_FIRM_AFFILIATION_REVISION',
  'TRANSACTION_LEG_RESOLUTION_REVISION',
  'TRANSACTION_STRUCTURE_RESOLUTION_REVISION',
  'TRANSACTION_CONTROL_OUTCOME_REVISION',
  'SHARE_PURCHASE_INTEREST_COMPONENT_REVISION',
  'REGISTERED_DERIVATION',
]);
const REQUIRED_FIELD_KEYS = Object.freeze([
  'deal',
  'signed',
  'buyer',
  'value',
  'type',
  'structure',
  'buyer_type',
  'sector',
  'law_firm',
  'lawyer',
  'law_firm_buyer',
  'law_firm_target',
  'lawyers_buyer',
  'lawyers_target',
  'merger_form',
]);
const REQUIRED_SHARED_MEMBER_BINDINGS = Object.freeze([
  {
    relative_path: 'shared/deal-facts/deal-fact-resolution-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'DEAL_FACT_RESOLUTION_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'a9883c5ff6229b2d594cbc602d62b8815799cb16dbcaf7843e42a2a354b3e3b0',
  },
  {
    relative_path: 'shared/deal-facts/source-deal-fact-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'SOURCE_DEAL_FACT_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '086267640453e0ece4e91a57d029d923df4b233c3de97f48efec0debfd2a68e7',
  },
  {
    relative_path: 'shared/entities/entity-identity-bridge.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'ENTITY_IDENTITY_BRIDGE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'e3722675dffab74fccfbcc0e904bba2b40d7384296040e33de6f644767c2ee8b',
  },
  {
    relative_path: 'shared/entities/entity-name-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'ENTITY_NAME_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '49f00f8d3fc274b0de6400c905fefb7e426db41b51eab68ad019fe5263706728',
  },
  {
    relative_path: 'shared/entities/entity-subject.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'ENTITY_SUBJECT',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '8f16e192ae88a8e9f078e544e621aed9075e78b6eb5daf8f11aea4187ca1c2f3',
  },
  {
    relative_path: 'shared/field-definitions/shared-deal-field-catalogue.v1.json',
    object_kind: 'SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT',
    stable_id: FIELD_CATALOGUE_STABLE_ID,
    schema_version: 'SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT/V1',
    canonical_bytes_digest:
      'e2be1596428a1c0db063b79cc06de9a51ac8a374bd65dd6bdc92812e06cb4a26',
  },
  {
    relative_path:
      'shared/professionals/lawyer-firm-affiliation-relationship.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'dc9d597bb203af0c4356718dcfc449bdeb569577893e9edf627e7b4b8aaa7e55',
  },
  {
    relative_path:
      'shared/professionals/professional-assignment-relationship.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '1b92630e3659666c443a21645ba4622117e25a75d7e2a9075a1f6ebd8447cbe6',
  },
  {
    relative_path: 'shared/projections/canonical-deal-fact-projection.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: PROJECTION_STABLE_ID,
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '363e277e4df210436937dcdfe52045f7377fbb1b8c089712b22323e247f99e24',
  },
  {
    relative_path: 'shared/temporal/temporal-expression.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'TEMPORAL_EXPRESSION',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'd730b3f62b644cc7ea55c16531b5bff1256e64257ed003e5780b7cdf49cd6fc6',
  },
  {
    relative_path: 'shared/transactions/deal-participant-relationship.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'DEAL_PARTICIPANT_RELATIONSHIP',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'cdf7c421f50148959da2640e009eaac5a136c35ff68dbaa65a739436308f6b1b',
  },
  {
    relative_path:
      'shared/transactions/share-purchase-interest-component.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'SHARE_PURCHASE_INTEREST_COMPONENT',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '9fc0092b4ccd63cd9481b575a290987cb34e9f86647d78bd134cb62ad89c90a5',
  },
  {
    relative_path:
      'shared/transactions/source-transaction-leg-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'SOURCE_TRANSACTION_LEG_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      '904a08c052aaee219434ba9f96216d04ccc2ee8852c509b26b9ddda206557f16',
  },
  {
    relative_path:
      'shared/transactions/transaction-control-outcome-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'f2785ae8341dbf3d748cd8e4a630c08953c6fee9e3ed63acdf3650e717c95872',
  },
  {
    relative_path:
      'shared/transactions/transaction-leg-resolution-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'TRANSACTION_LEG_RESOLUTION_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'cc858c070d36029e13f2c2ff6e0e5bb2f9db9b9b5a7050950b669df1a65e83b7',
  },
  {
    relative_path:
      'shared/transactions/transaction-structure-resolution-occurrence.v1.json',
    object_kind: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
    stable_id: 'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE',
    schema_version: 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1',
    canonical_bytes_digest:
      'd7f5e009bff38a4f8186f812a243ffd0505508f0544cc8c3e154cd4c50572941',
  },
]);

class SharedAuthorityConsumedContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SharedAuthorityConsumedContractError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new SharedAuthorityConsumedContractError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, keys, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected,
    });
  }
}

function requireExactValue(actual, expected, label, code) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed value.`, {
      actual,
      expected,
    });
  }
}

function requireSha256(value, label, code) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`);
  }
}

function bindingForMember(member) {
  return {
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    schema_version: member.schema_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
  };
}

function requireExactMemberBytes(member) {
  const observed = sha256Hex(canonicalJson(member.canonical_value));
  if (observed !== member.canonical_bytes_digest) {
    fail(
      'SHARED_MEMBER_BYTES_MISMATCH',
      `${member.relative_path} canonical bytes do not match the compiled digest.`,
      {
        declared: member.canonical_bytes_digest,
        observed,
      },
    );
  }
}

function selectedSharedMembers(compiled) {
  requireObject(compiled, 'Compiled canonical input', 'INVALID_COMPILED_INPUT');
  if (!Array.isArray(compiled.authored_members)) {
    fail('INVALID_COMPILED_INPUT', 'Compiled canonical input has no authored members.');
  }
  const members = compiled.authored_members
    .filter((member) => member.relative_path.startsWith('shared/'));
  for (const member of members) requireExactMemberBytes(member);
  const bindings = members.map(bindingForMember);
  requireExactValue(
    bindings,
    REQUIRED_SHARED_MEMBER_BINDINGS,
    'Shared-authority member bindings',
    'SHARED_MEMBER_SET_MISMATCH',
  );
  return members;
}

function memberByStableId(members, stableId) {
  const matches = members.filter((member) => member.stable_id === stableId);
  if (matches.length !== 1) {
    fail(
      'SHARED_MEMBER_CARDINALITY_MISMATCH',
      `Expected one ${stableId} member, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function projectionContract(member) {
  const value = member.canonical_value;
  const typeContract = value?.definition?.type_contract;
  if (
    value.object_kind !== 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT'
    || value.stable_id !== PROJECTION_STABLE_ID
    || value.definition?.logical_type !== 'CanonicalDealFactProjection'
    || value.definition?.logical_type_version !== 1
  ) {
    fail('PROJECTION_CONTRACT_MISMATCH', 'The canonical deal-fact projection is invalid.');
  }
  requireExactValue(
    typeContract.release_identity_inputs,
    REQUIRED_RELEASE_IDENTITY_INPUTS,
    'Projection release identity inputs',
    'PROJECTION_CONTRACT_MISMATCH',
  );
  requireExactValue(
    typeContract.field_entry_required_keys,
    REQUIRED_FIELD_ENTRY_KEYS,
    'Projection field-entry keys',
    'PROJECTION_CONTRACT_MISMATCH',
  );
  requireExactValue(
    typeContract.terminal_lineage_types,
    REQUIRED_TERMINAL_LINEAGE_TYPES,
    'Projection terminal lineage types',
    'PROJECTION_CONTRACT_MISMATCH',
  );
  const requiredGuarantees = {
    admitted_fields_only: true,
    selected_revision_required: true,
    generic_revision_id_permitted: false,
    complete_release_identity_per_field: true,
    conflict_indicator_required: true,
    derivation_reference_required_when_applicable: true,
    exact_detail_action_from_terminal_lineage: true,
    write_credential_in_projection: false,
    direct_write_path: false,
    legacy_value_fallback: false,
    same_release_live_and_pinned_rows_equal: true,
  };
  for (const [key, expected] of Object.entries(requiredGuarantees)) {
    if (typeContract[key] !== expected) {
      fail(
        'PROJECTION_CONTRACT_MISMATCH',
        `Projection guarantee ${key} is ${typeContract[key]}, expected ${expected}.`,
      );
    }
  }
  return {
    stable_id: value.stable_id,
    logical_type: value.definition.logical_type,
    logical_type_version: value.definition.logical_type_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
    release_identity_inputs: typeContract.release_identity_inputs,
    field_entry_required_keys: typeContract.field_entry_required_keys,
    terminal_lineage_types: typeContract.terminal_lineage_types,
    guarantees: requiredGuarantees,
  };
}

function fieldCatalogueContract(member) {
  const value = member.canonical_value;
  if (
    value.object_kind !== 'SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT'
    || value.stable_id !== FIELD_CATALOGUE_STABLE_ID
  ) {
    fail('FIELD_CATALOGUE_CONTRACT_MISMATCH', 'The shared field catalogue is invalid.');
  }
  requireExactValue(
    value.current_pm_baseline_field_keys,
    REQUIRED_FIELD_KEYS,
    'Current PM baseline field keys',
    'FIELD_CATALOGUE_CONTRACT_MISMATCH',
  );
  const observedKeys = value.field_definitions.map((field) => field.field_key);
  requireExactValue(
    observedKeys,
    REQUIRED_FIELD_KEYS,
    'Shared field definitions',
    'FIELD_CATALOGUE_CONTRACT_MISMATCH',
  );
  for (const field of value.field_definitions) {
    if (
      field.capabilities?.filter !== true
      || field.legacy_filter_authority !== false
      || typeof field.projection_path !== 'string'
      || field.projection_path.length === 0
    ) {
      fail(
        'FIELD_CATALOGUE_CONTRACT_MISMATCH',
        `Field ${field.field_key} is not a release-admitted canonical filter.`,
      );
    }
  }
  return {
    stable_id: value.stable_id,
    canonical_bytes_digest: member.canonical_bytes_digest,
    current_pm_baseline_field_keys: value.current_pm_baseline_field_keys,
    field_bindings: value.field_definitions.map((field) => ({
      field_key: field.field_key,
      field_version: field.field_version,
      field_group: field.field_group,
      value_type: field.value_type,
      projection_path: field.projection_path,
      filter_scope: field.filter_scope,
      multiplicity: field.multiplicity,
      permitted_operators: field.permitted_operators,
      incomplete_collection_behaviour: field.incomplete_collection_behaviour,
      capabilities: field.capabilities,
      identity_filter_uses_canonical_id: field.identity_filter_uses_canonical_id,
      legacy_filter_authority: field.legacy_filter_authority,
    })),
  };
}

function manifestIdentity(body) {
  return {
    shared_authority_consumed_contract_manifest_id: contentId(
      CONSUMED_MANIFEST_DOMAIN,
      body,
    ),
    canonical_payload_digest: contentId(
      CONSUMED_MANIFEST_PAYLOAD_DOMAIN,
      body,
    ),
  };
}

function buildSharedAuthorityConsumedContractManifestFromCompiled(compiled) {
  const members = selectedSharedMembers(compiled);
  const bindings = members.map(bindingForMember);
  const sharedInputSetBody = {
    schema_version: CONSUMED_INPUT_SET_SCHEMA,
    compiler_input_schema_version:
      compiled.canonical_bundle_input_identity?.compiler_input_schema_version,
    generator_input_schema_version:
      compiled.canonical_bundle_input_identity?.generator_input_schema_version,
    ordered_shared_members: bindings,
  };
  if (
    typeof sharedInputSetBody.compiler_input_schema_version !== 'string'
    || typeof sharedInputSetBody.generator_input_schema_version !== 'string'
  ) {
    fail('INVALID_COMPILED_INPUT', 'Compiled canonical input lacks compiler identities.');
  }
  const sharedInputSet = {
    ...sharedInputSetBody,
    shared_authority_input_set_id: contentId(
      CONSUMED_INPUT_SET_DOMAIN,
      sharedInputSetBody,
    ),
  };
  const projection = projectionContract(
    memberByStableId(members, PROJECTION_STABLE_ID),
  );
  const fieldCatalogue = fieldCatalogueContract(
    memberByStableId(members, FIELD_CATALOGUE_STABLE_ID),
  );
  const body = {
    schema_version: CONSUMED_MANIFEST_SCHEMA,
    consumer_domain: 'PROCESS',
    authority: 'AUTHORED_INPUT_BINDING_ONLY',
    approved_shared_design_sha256: APPROVED_SHARED_DESIGN_SHA256,
    shared_authority_input_set: sharedInputSet,
    projection_contract: projection,
    field_catalogue_contract: fieldCatalogue,
    runtime_compatibility: {
      state: 'PRE_FREEZE_NOT_RUNTIME_ELIGIBLE',
      compatibility_rule:
        'EXACT_SHARED_INPUT_SET_PROJECTION_AND_FIELD_CATALOGUE/V1',
      required_release_binding_fields: [
        'canonical_contract_fingerprint',
        'serving_namespace_id',
        'corpus_release_id',
      ],
      frozen_contract_required: true,
      serving_namespace_required: true,
      corpus_release_required: true,
      runtime_without_release_binding: 'REJECT',
    },
    authority_limits: {
      read_only_consumer: true,
      contract_freeze_authority: 'NONE',
      canonical_write_authority: 'NONE',
      candidate_release_authority: 'NONE',
      active_release_authority: 'NONE',
      production_activation_authority: 'NONE',
      direct_write_path_permitted: false,
      service_role_credential_permitted: false,
      shared_fact_reauthoring_permitted: false,
      legacy_value_fallback_permitted: false,
    },
  };
  return deepFreeze({
    ...body,
    ...manifestIdentity(body),
  });
}

function buildSharedAuthorityConsumedContractManifest({ root_directory }) {
  if (typeof root_directory !== 'string' || root_directory.length === 0) {
    fail('INVALID_CONTRACT_ROOT', 'root_directory must be a non-empty string.');
  }
  const compiled = compileCanonicalContractInput({ root_directory });
  return buildSharedAuthorityConsumedContractManifestFromCompiled(compiled);
}

function validateSharedAuthorityConsumedContractManifest(manifest) {
  const code = 'INVALID_SHARED_AUTHORITY_CONSUMED_MANIFEST';
  requireExactKeys(manifest, [
    'schema_version',
    'consumer_domain',
    'authority',
    'approved_shared_design_sha256',
    'shared_authority_input_set',
    'projection_contract',
    'field_catalogue_contract',
    'runtime_compatibility',
    'authority_limits',
    'shared_authority_consumed_contract_manifest_id',
    'canonical_payload_digest',
  ], 'Shared-authority consumed manifest', code);
  const body = { ...manifest };
  delete body.shared_authority_consumed_contract_manifest_id;
  delete body.canonical_payload_digest;
  requireExactValue(manifestIdentity(body), {
    shared_authority_consumed_contract_manifest_id:
      manifest.shared_authority_consumed_contract_manifest_id,
    canonical_payload_digest: manifest.canonical_payload_digest,
  }, 'Shared-authority consumed manifest identity', code);
  if (
    manifest.schema_version !== CONSUMED_MANIFEST_SCHEMA
    || manifest.consumer_domain !== 'PROCESS'
    || manifest.authority !== 'AUTHORED_INPUT_BINDING_ONLY'
    || manifest.approved_shared_design_sha256 !== APPROVED_SHARED_DESIGN_SHA256
  ) {
    fail(code, 'Shared-authority consumed manifest identity is not approved.');
  }
  requireExactValue(
    manifest.shared_authority_input_set.ordered_shared_members,
    REQUIRED_SHARED_MEMBER_BINDINGS,
    'Consumed shared member bindings',
    code,
  );
  const inputSetBody = { ...manifest.shared_authority_input_set };
  delete inputSetBody.shared_authority_input_set_id;
  if (
    manifest.shared_authority_input_set.shared_authority_input_set_id
    !== contentId(CONSUMED_INPUT_SET_DOMAIN, inputSetBody)
  ) {
    fail(code, 'Consumed shared input-set identity is invalid.');
  }
  requireExactValue(
    manifest.projection_contract.terminal_lineage_types,
    REQUIRED_TERMINAL_LINEAGE_TYPES,
    'Consumed projection terminal types',
    code,
  );
  const expectedProjectionBinding = REQUIRED_SHARED_MEMBER_BINDINGS.find(
    (member) => member.stable_id === PROJECTION_STABLE_ID,
  );
  if (
    manifest.projection_contract.stable_id !== PROJECTION_STABLE_ID
    || manifest.projection_contract.canonical_bytes_digest
      !== expectedProjectionBinding.canonical_bytes_digest
    || sha256Hex(canonicalJson(manifest.projection_contract))
      !== EXPECTED_PROJECTION_CONTRACT_SHA256
  ) {
    fail(code, 'Consumed projection contract summary is not exact.');
  }
  requireExactValue(
    manifest.field_catalogue_contract.current_pm_baseline_field_keys,
    REQUIRED_FIELD_KEYS,
    'Consumed field keys',
    code,
  );
  const expectedCatalogueBinding = REQUIRED_SHARED_MEMBER_BINDINGS.find(
    (member) => member.stable_id === FIELD_CATALOGUE_STABLE_ID,
  );
  if (
    manifest.field_catalogue_contract.stable_id !== FIELD_CATALOGUE_STABLE_ID
    || manifest.field_catalogue_contract.canonical_bytes_digest
      !== expectedCatalogueBinding.canonical_bytes_digest
    || sha256Hex(canonicalJson(manifest.field_catalogue_contract.field_bindings))
      !== EXPECTED_FIELD_BINDINGS_SHA256
  ) {
    fail(code, 'Consumed field catalogue summary is not exact.');
  }
  if (
    sha256Hex(canonicalJson(manifest.runtime_compatibility))
      !== EXPECTED_RUNTIME_COMPATIBILITY_SHA256
    || sha256Hex(canonicalJson(manifest.authority_limits))
      !== EXPECTED_AUTHORITY_LIMITS_SHA256
  ) {
    fail(code, 'Consumed manifest grants unsupported runtime or write authority.');
  }
  return manifest;
}

function releaseBindingIdentity(body) {
  return {
    shared_authority_consumer_release_binding_id: contentId(
      RELEASE_BINDING_DOMAIN,
      body,
    ),
    canonical_payload_digest: contentId(
      RELEASE_BINDING_PAYLOAD_DOMAIN,
      body,
    ),
  };
}

function bindSharedAuthorityConsumerRelease({
  manifest,
  canonical_contract_fingerprint,
  serving_namespace_id,
  corpus_release_id,
}) {
  validateSharedAuthorityConsumedContractManifest(manifest);
  requireSha256(
    canonical_contract_fingerprint,
    'canonical_contract_fingerprint',
    'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );
  requireSha256(
    serving_namespace_id,
    'serving_namespace_id',
    'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );
  requireSha256(
    corpus_release_id,
    'corpus_release_id',
    'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );
  const body = {
    schema_version: RELEASE_BINDING_SCHEMA,
    consumer_domain: manifest.consumer_domain,
    shared_authority_consumed_contract_manifest_id:
      manifest.shared_authority_consumed_contract_manifest_id,
    shared_authority_input_set_id:
      manifest.shared_authority_input_set.shared_authority_input_set_id,
    projection_contract_digest:
      manifest.projection_contract.canonical_bytes_digest,
    field_catalogue_digest:
      manifest.field_catalogue_contract.canonical_bytes_digest,
    canonical_contract_fingerprint,
    serving_namespace_id,
    corpus_release_id,
    compatibility_rule:
      manifest.runtime_compatibility.compatibility_rule,
    authority: {
      read_only: true,
      direct_write_path_permitted: false,
      service_role_credential_permitted: false,
      legacy_value_fallback_permitted: false,
      shared_fact_reauthoring_permitted: false,
      production_activation_authority: 'NONE',
    },
  };
  return deepFreeze({
    ...body,
    ...releaseBindingIdentity(body),
  });
}

function validateSharedAuthorityConsumerReleaseBinding({ manifest, binding }) {
  validateSharedAuthorityConsumedContractManifest(manifest);
  const code = 'INVALID_SHARED_AUTHORITY_RELEASE_BINDING';
  requireExactKeys(binding, [
    'schema_version',
    'consumer_domain',
    'shared_authority_consumed_contract_manifest_id',
    'shared_authority_input_set_id',
    'projection_contract_digest',
    'field_catalogue_digest',
    'canonical_contract_fingerprint',
    'serving_namespace_id',
    'corpus_release_id',
    'compatibility_rule',
    'authority',
    'shared_authority_consumer_release_binding_id',
    'canonical_payload_digest',
  ], 'Shared-authority consumer release binding', code);
  const body = { ...binding };
  delete body.shared_authority_consumer_release_binding_id;
  delete body.canonical_payload_digest;
  requireExactValue(releaseBindingIdentity(body), {
    shared_authority_consumer_release_binding_id:
      binding.shared_authority_consumer_release_binding_id,
    canonical_payload_digest: binding.canonical_payload_digest,
  }, 'Shared-authority release binding identity', code);
  const expected = {
    consumer_domain: manifest.consumer_domain,
    manifest_id: manifest.shared_authority_consumed_contract_manifest_id,
    input_set_id: manifest.shared_authority_input_set.shared_authority_input_set_id,
    projection_digest: manifest.projection_contract.canonical_bytes_digest,
    catalogue_digest: manifest.field_catalogue_contract.canonical_bytes_digest,
    compatibility_rule: manifest.runtime_compatibility.compatibility_rule,
  };
  const actual = {
    consumer_domain: binding.consumer_domain,
    manifest_id: binding.shared_authority_consumed_contract_manifest_id,
    input_set_id: binding.shared_authority_input_set_id,
    projection_digest: binding.projection_contract_digest,
    catalogue_digest: binding.field_catalogue_digest,
    compatibility_rule: binding.compatibility_rule,
  };
  requireExactValue(actual, expected, 'Shared-authority release compatibility', code);
  for (const key of [
    'canonical_contract_fingerprint',
    'serving_namespace_id',
    'corpus_release_id',
  ]) {
    requireSha256(binding[key], key, code);
  }
  requireExactValue(binding.authority, {
    read_only: true,
    direct_write_path_permitted: false,
    service_role_credential_permitted: false,
    legacy_value_fallback_permitted: false,
    shared_fact_reauthoring_permitted: false,
    production_activation_authority: 'NONE',
  }, 'Shared-authority release binding authority', code);
  return binding;
}

module.exports = {
  APPROVED_SHARED_DESIGN_SHA256,
  REQUIRED_FIELD_KEYS,
  REQUIRED_SHARED_MEMBER_BINDINGS,
  REQUIRED_TERMINAL_LINEAGE_TYPES,
  SharedAuthorityConsumedContractError,
  bindSharedAuthorityConsumerRelease,
  buildSharedAuthorityConsumedContractManifest,
  buildSharedAuthorityConsumedContractManifestFromCompiled,
  validateSharedAuthorityConsumedContractManifest,
  validateSharedAuthorityConsumerReleaseBinding,
};
