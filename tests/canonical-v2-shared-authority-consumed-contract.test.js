const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  APPROVED_SHARED_DESIGN_SHA256,
  REQUIRED_FIELD_KEYS,
  REQUIRED_SHARED_MEMBER_BINDINGS,
  REQUIRED_TERMINAL_LINEAGE_TYPES,
  bindSharedAuthorityConsumerRelease,
  buildSharedAuthorityConsumedContractManifest,
  buildSharedAuthorityConsumedContractManifestFromCompiled,
  validateSharedAuthorityConsumedContractManifest,
  validateSharedAuthorityConsumerReleaseBinding,
} = require('../lib/canonical-v2/shared-authority-consumed-contract-manifest');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function build() {
  return buildSharedAuthorityConsumedContractManifest({
    root_directory: ROOT,
  });
}

function resignManifest(manifest) {
  const body = clone(manifest);
  delete body.shared_authority_consumed_contract_manifest_id;
  delete body.canonical_payload_digest;
  return {
    ...body,
    shared_authority_consumed_contract_manifest_id: contentId(
      'SHARED_AUTHORITY_CONSUMED_CONTRACT_MANIFEST/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'SHARED_AUTHORITY_CONSUMED_CONTRACT_MANIFEST_PAYLOAD/V1',
      body,
    ),
  };
}

test('builds one deterministic Process binding to the exact shared input set', () => {
  const first = build();
  const second = build();

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'SHARED_AUTHORITY_CONSUMED_CONTRACT_MANIFEST/V1');
  assert.equal(first.consumer_domain, 'PROCESS');
  assert.equal(first.authority, 'AUTHORED_INPUT_BINDING_ONLY');
  assert.equal(first.approved_shared_design_sha256, APPROVED_SHARED_DESIGN_SHA256);
  assert.deepEqual(
    first.shared_authority_input_set.ordered_shared_members,
    REQUIRED_SHARED_MEMBER_BINDINGS,
  );
  assert.equal(first.shared_authority_input_set.ordered_shared_members.length, 16);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.shared_authority_input_set), true);
  assert.doesNotThrow(() => validateSharedAuthorityConsumedContractManifest(first));
});

test('keeps the shared input identity independent of unrelated Process additions', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });
  const before = buildSharedAuthorityConsumedContractManifestFromCompiled(compiled);
  const extended = {
    ...compiled,
    authored_members: [
      ...compiled.authored_members,
      {
        relative_path: 'process/future/example.v1.json',
        object_kind: 'PROCESS_FUTURE_INPUT',
        stable_id: 'FUTURE_EXAMPLE',
        schema_version: 'PROCESS_FUTURE_INPUT/V1',
        canonical_bytes_digest: sha256Hex(canonicalJson({
          object_kind: 'PROCESS_FUTURE_INPUT',
          stable_id: 'FUTURE_EXAMPLE',
          schema_version: 'PROCESS_FUTURE_INPUT/V1',
        })),
        canonical_value: {
          object_kind: 'PROCESS_FUTURE_INPUT',
          stable_id: 'FUTURE_EXAMPLE',
          schema_version: 'PROCESS_FUTURE_INPUT/V1',
        },
      },
    ],
  };
  const after = buildSharedAuthorityConsumedContractManifestFromCompiled(extended);

  assert.equal(
    before.shared_authority_input_set.shared_authority_input_set_id,
    after.shared_authority_input_set.shared_authority_input_set_id,
  );
  assert.deepEqual(before, after);
});

test('pins the projection schema, typed lineage and read-only guarantees', () => {
  const projection = build().projection_contract;

  assert.equal(projection.stable_id, 'CANONICAL_DEAL_FACT_PROJECTION');
  assert.equal(
    projection.canonical_bytes_digest,
    '363e277e4df210436937dcdfe52045f7377fbb1b8c089712b22323e247f99e24',
  );
  assert.deepEqual(projection.terminal_lineage_types, REQUIRED_TERMINAL_LINEAGE_TYPES);
  assert.equal(projection.guarantees.selected_revision_required, true);
  assert.equal(projection.guarantees.generic_revision_id_permitted, false);
  assert.equal(projection.guarantees.complete_release_identity_per_field, true);
  assert.equal(projection.guarantees.exact_detail_action_from_terminal_lineage, true);
  assert.equal(projection.guarantees.write_credential_in_projection, false);
  assert.equal(projection.guarantees.direct_write_path, false);
  assert.equal(projection.guarantees.legacy_value_fallback, false);
});

test('pins all 15 PM fields to canonical projection paths', () => {
  const catalogue = build().field_catalogue_contract;

  assert.deepEqual(catalogue.current_pm_baseline_field_keys, REQUIRED_FIELD_KEYS);
  assert.deepEqual(
    catalogue.field_bindings.map((field) => field.field_key),
    REQUIRED_FIELD_KEYS,
  );
  assert.ok(catalogue.field_bindings.every((field) => (
    field.capabilities.filter === true
    && field.legacy_filter_authority === false
    && typeof field.projection_path === 'string'
    && field.projection_path.length > 0
  )));
  const value = catalogue.field_bindings.find((field) => field.field_key === 'value');
  assert.deepEqual(
    {
      path: value.projection_path,
      scope: value.filter_scope,
      multiplicity: value.multiplicity,
    },
    {
      path: 'economics.normalised_equity_value',
      scope: 'SINGLE_DEAL_FACT_RESOLUTION',
      multiplicity: 'ZERO_OR_ONE',
    },
  );
});

test('keeps professional filters in one repeatable component', () => {
  const professionalFields = build().field_catalogue_contract.field_bindings
    .filter((field) => field.field_group === 'PROFESSIONALS');

  assert.equal(professionalFields.length, 6);
  assert.ok(professionalFields.every((field) => (
    field.filter_scope === 'SAME_PROFESSIONAL_ASSIGNMENT_COMPONENT'
    && field.multiplicity === 'MANY'
    && field.incomplete_collection_behaviour === 'UNKNOWN'
    && field.identity_filter_uses_canonical_id === true
    && field.permitted_operators.includes('ALL')
  )));
});

test('grants no runtime, write, release or legacy-fallback authority before freeze', () => {
  const manifest = build();

  assert.deepEqual(manifest.runtime_compatibility, {
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
  });
  assert.equal(manifest.authority_limits.read_only_consumer, true);
  assert.equal(manifest.authority_limits.contract_freeze_authority, 'NONE');
  assert.equal(manifest.authority_limits.canonical_write_authority, 'NONE');
  assert.equal(manifest.authority_limits.candidate_release_authority, 'NONE');
  assert.equal(manifest.authority_limits.active_release_authority, 'NONE');
  assert.equal(manifest.authority_limits.production_activation_authority, 'NONE');
  assert.equal(manifest.authority_limits.direct_write_path_permitted, false);
  assert.equal(manifest.authority_limits.service_role_credential_permitted, false);
  assert.equal(manifest.authority_limits.shared_fact_reauthoring_permitted, false);
  assert.equal(manifest.authority_limits.legacy_value_fallback_permitted, false);
});

test('fails closed on a missing, extra, changed or internally inconsistent shared member', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });
  const firstSharedIndex = compiled.authored_members.findIndex(
    (member) => member.relative_path.startsWith('shared/'),
  );

  const missing = clone(compiled);
  missing.authored_members.splice(firstSharedIndex, 1);
  assert.throws(
    () => buildSharedAuthorityConsumedContractManifestFromCompiled(missing),
    (error) => error.code === 'SHARED_MEMBER_SET_MISMATCH',
  );

  const extra = clone(compiled);
  extra.authored_members.push({
    ...clone(compiled.authored_members[firstSharedIndex]),
    relative_path: 'shared/unregistered.v1.json',
  });
  assert.throws(
    () => buildSharedAuthorityConsumedContractManifestFromCompiled(extra),
    (error) => error.code === 'SHARED_MEMBER_SET_MISMATCH',
  );

  const changed = clone(compiled);
  changed.authored_members[firstSharedIndex].canonical_bytes_digest = DIGEST_A;
  assert.throws(
    () => buildSharedAuthorityConsumedContractManifestFromCompiled(changed),
    (error) => error.code === 'SHARED_MEMBER_BYTES_MISMATCH',
  );

  const inconsistent = clone(compiled);
  inconsistent.authored_members[firstSharedIndex].canonical_value.stable_id = 'OTHER';
  assert.throws(
    () => buildSharedAuthorityConsumedContractManifestFromCompiled(inconsistent),
    (error) => error.code === 'SHARED_MEMBER_BYTES_MISMATCH',
  );
});

test('rejects re-signed projection, field, runtime and authority summary drift', () => {
  const projection = clone(build());
  projection.projection_contract.guarantees.generic_revision_id_permitted = true;
  assert.throws(
    () => validateSharedAuthorityConsumedContractManifest(resignManifest(projection)),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_CONSUMED_MANIFEST',
  );

  const field = clone(build());
  field.field_catalogue_contract.field_bindings
    .find((entry) => entry.field_key === 'value')
    .projection_path = 'legacy.value';
  assert.throws(
    () => validateSharedAuthorityConsumedContractManifest(resignManifest(field)),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_CONSUMED_MANIFEST',
  );

  const runtime = clone(build());
  runtime.runtime_compatibility.frozen_contract_required = false;
  assert.throws(
    () => validateSharedAuthorityConsumedContractManifest(resignManifest(runtime)),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_CONSUMED_MANIFEST',
  );

  const authority = clone(build());
  authority.authority_limits.shared_fact_reauthoring_permitted = true;
  assert.throws(
    () => validateSharedAuthorityConsumedContractManifest(resignManifest(authority)),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_CONSUMED_MANIFEST',
  );
});

test('creates a release binding only from a complete exact frozen tuple', () => {
  const manifest = build();
  const binding = bindSharedAuthorityConsumerRelease({
    manifest,
    canonical_contract_fingerprint: DIGEST_A,
    serving_namespace_id: DIGEST_B,
    corpus_release_id: DIGEST_C,
  });

  assert.equal(binding.schema_version, 'SHARED_AUTHORITY_CONSUMER_RELEASE_BINDING/V1');
  assert.equal(
    binding.shared_authority_consumed_contract_manifest_id,
    manifest.shared_authority_consumed_contract_manifest_id,
  );
  assert.equal(
    binding.shared_authority_input_set_id,
    manifest.shared_authority_input_set.shared_authority_input_set_id,
  );
  assert.deepEqual(binding.authority, {
    read_only: true,
    direct_write_path_permitted: false,
    service_role_credential_permitted: false,
    legacy_value_fallback_permitted: false,
    shared_fact_reauthoring_permitted: false,
    production_activation_authority: 'NONE',
  });
  assert.equal(Object.isFrozen(binding), true);
  assert.doesNotThrow(() => validateSharedAuthorityConsumerReleaseBinding({
    manifest,
    binding,
  }));
});

test('rejects incomplete, malformed and incompatible release bindings', () => {
  const manifest = build();

  assert.throws(
    () => bindSharedAuthorityConsumerRelease({
      manifest,
      canonical_contract_fingerprint: DIGEST_A,
      serving_namespace_id: DIGEST_B,
    }),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );
  assert.throws(
    () => bindSharedAuthorityConsumerRelease({
      manifest,
      canonical_contract_fingerprint: 'not-a-digest',
      serving_namespace_id: DIGEST_B,
      corpus_release_id: DIGEST_C,
    }),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );

  const binding = clone(bindSharedAuthorityConsumerRelease({
    manifest,
    canonical_contract_fingerprint: DIGEST_A,
    serving_namespace_id: DIGEST_B,
    corpus_release_id: DIGEST_C,
  }));
  binding.projection_contract_digest = DIGEST_A;
  assert.throws(
    () => validateSharedAuthorityConsumerReleaseBinding({ manifest, binding }),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );

  const writeEnabled = clone(bindSharedAuthorityConsumerRelease({
    manifest,
    canonical_contract_fingerprint: DIGEST_A,
    serving_namespace_id: DIGEST_B,
    corpus_release_id: DIGEST_C,
  }));
  writeEnabled.authority.direct_write_path_permitted = true;
  assert.throws(
    () => validateSharedAuthorityConsumerReleaseBinding({
      manifest,
      binding: writeEnabled,
    }),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_RELEASE_BINDING',
  );
});
