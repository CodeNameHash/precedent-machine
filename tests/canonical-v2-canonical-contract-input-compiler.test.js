const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  COMPILER_INPUT_SCHEMA_VERSION,
  GENERATOR_INPUT_SCHEMA_VERSION,
  IDENTITY_DOMAIN,
  MANIFEST_SCHEMA_VERSION,
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');

function member(objectKind, stableId, schemaVersion, value = {}) {
  return {
    object_kind: objectKind,
    stable_id: stableId,
    schema_version: schemaVersion,
    ...value,
  };
}

function canonicalDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function declarations(valuesByPath) {
  return Object.entries(valuesByPath)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([relativePath, value]) => ({
      relative_path: relativePath,
      object_kind: value.object_kind,
      stable_id: value.stable_id,
      schema_version: value.schema_version,
      canonical_bytes_digest: canonicalDigest(value),
    }));
}

function perKind(declaredMembers) {
  const counts = {};
  const versions = {};
  for (const entry of declaredMembers) {
    counts[entry.object_kind] = (counts[entry.object_kind] || 0) + 1;
    versions[entry.object_kind] ||= [];
    if (!versions[entry.object_kind].includes(entry.schema_version)) {
      versions[entry.object_kind].push(entry.schema_version);
      versions[entry.object_kind].sort();
    }
  }
  return {
    counts: Object.fromEntries(Object.entries(counts).sort()),
    versions: Object.fromEntries(Object.entries(versions).sort()),
  };
}

function writeJson(root, relativePath, value, pretty = false) {
  const file = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pretty ? `${JSON.stringify(value, null, 2)}\n` : canonicalJson(value));
}

function fixture(mutator = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-bundle-input-'));
  const valuesByPath = {
    'claims/knowledge.json': member(
      'CLAIM_DEFINITION',
      'KNOWLEDGE_QUALIFIER',
      'CLAIM_DEFINITION/V1',
      { canonical_value_type: 'BOOLEAN' },
    ),
    'concepts/no-shop.json': member(
      'PROVISION_CONCEPT',
      'NOSOL-PROHIBIT',
      'PROVISION_CONCEPT/V1',
      { family: 'NO_SHOP' },
    ),
    'concepts/termination-fee.json': member(
      'PROVISION_CONCEPT',
      'TERMF-TARGET',
      'PROVISION_CONCEPT/V1',
      { family: 'TERMINATION_FEE' },
    ),
  };
  let manifestMembers = declarations(valuesByPath);
  const kinds = perKind(manifestMembers);
  const state = {
    root,
    valuesByPath,
    manifest: {
      schema_version: MANIFEST_SCHEMA_VERSION,
      compiler_input_schema_version: COMPILER_INPUT_SCHEMA_VERSION,
      generator_input_schema_version: GENERATOR_INPUT_SCHEMA_VERSION,
      members: manifestMembers,
      per_kind_counts: kinds.counts,
      per_kind_schema_versions: kinds.versions,
    },
  };
  mutator(state);
  manifestMembers = state.manifest.members;
  for (const [relativePath, value] of Object.entries(state.valuesByPath)) {
    writeJson(root, relativePath, value, relativePath === 'concepts/no-shop.json');
  }
  writeJson(root, 'manifest.json', state.manifest, true);
  return root;
}

function expectCode(code) {
  return (error) => error?.code === code;
}

test('compiles a closed authored JSON set twice to byte-identical input identity', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const first = compileCanonicalContractInput({ root_directory: root });
  const second = compileCanonicalContractInput({ root_directory: root });
  const identity = first.canonical_bundle_input_identity;
  const {
    canonical_bundle_input_identity_id: identityId,
    canonical_payload_digest: _identityPayloadDigest,
    ...identityBody
  } = identity;

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    identityId,
    contentId(IDENTITY_DOMAIN, identityBody),
  );
  assert.deepEqual(
    identity.ordered_entries.map((entry) => entry.relative_path),
    [
      'claims/knowledge.json',
      'concepts/no-shop.json',
      'concepts/termination-fee.json',
    ],
  );
  assert.deepEqual(identity.per_kind_counts, {
    CLAIM_DEFINITION: 1,
    PROVISION_CONCEPT: 2,
  });
  assert.deepEqual(identity.per_kind_schema_versions, {
    CLAIM_DEFINITION: ['CLAIM_DEFINITION/V1'],
    PROVISION_CONCEPT: ['PROVISION_CONCEPT/V1'],
  });
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.reason_code, 'GOVERNED_REQUIRED_KIND_REGISTRY_NOT_SUPPLIED');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(first, 'canonical_contract_bundle'), false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authored_members[0].canonical_value), true);
});

test('canonicalises member bytes so source JSON formatting does not change the identity', (t) => {
  const firstRoot = fixture();
  const secondRoot = fixture();
  t.after(() => fs.rmSync(firstRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(secondRoot, { recursive: true, force: true }));

  const source = JSON.parse(fs.readFileSync(path.join(secondRoot, 'claims/knowledge.json'), 'utf8'));
  fs.writeFileSync(
    path.join(secondRoot, 'claims/knowledge.json'),
    `{\n  "schema_version": ${JSON.stringify(source.schema_version)},\n`
      + `  "stable_id": ${JSON.stringify(source.stable_id)},\n`
      + `  "canonical_value_type": ${JSON.stringify(source.canonical_value_type)},\n`
      + `  "object_kind": ${JSON.stringify(source.object_kind)}\n}\n`,
  );

  assert.equal(
    canonicalJson(compileCanonicalContractInput({ root_directory: firstRoot })),
    canonicalJson(compileCanonicalContractInput({ root_directory: secondRoot })),
  );
});

test('rejects missing and extra JSON members before compiling', (t) => {
  const missingRoot = fixture((state) => {
    delete state.valuesByPath['concepts/no-shop.json'];
  });
  const extraRoot = fixture((state) => {
    state.valuesByPath['unlisted.json'] = member('CLAIM_DEFINITION', 'UNLISTED', 'CLAIM_DEFINITION/V1');
  });
  t.after(() => fs.rmSync(missingRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(extraRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: missingRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_CLOSED_SET_MISMATCH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: extraRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_CLOSED_SET_MISMATCH'),
  );
});

test('rejects duplicate paths and conflicting (object_kind, stable_id) identities', (t) => {
  const duplicatePathRoot = fixture((state) => {
    state.manifest.members.splice(1, 0, { ...state.manifest.members[0] });
  });
  const conflictingIdentityRoot = fixture((state) => {
    state.manifest.members[2].object_kind = state.manifest.members[1].object_kind;
    state.manifest.members[2].stable_id = state.manifest.members[1].stable_id;
  });
  t.after(() => fs.rmSync(duplicatePathRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(conflictingIdentityRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: duplicatePathRoot }),
    expectCode('DUPLICATE_CANONICAL_BUNDLE_INPUT_PATH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: conflictingIdentityRoot }),
    expectCode('DUPLICATE_CANONICAL_BUNDLE_INPUT_IDENTITY'),
  );
});

test('rejects manifest/member metadata conflicts and canonical digest drift', (t) => {
  const metadataRoot = fixture((state) => {
    state.manifest.members[0].schema_version = 'CLAIM_DEFINITION/V2';
    state.manifest.per_kind_schema_versions.CLAIM_DEFINITION = ['CLAIM_DEFINITION/V2'];
  });
  const digestRoot = fixture((state) => {
    state.valuesByPath['claims/knowledge.json'].canonical_value_type = 'TRISTATE';
  });
  t.after(() => fs.rmSync(metadataRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(digestRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: metadataRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_MEMBER_METADATA_MISMATCH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: digestRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_DIGEST_MISMATCH'),
  );
});

test('rejects incorrect per-kind counts and schema-version declarations', (t) => {
  const countRoot = fixture((state) => {
    state.manifest.per_kind_counts.PROVISION_CONCEPT = 3;
  });
  const versionRoot = fixture((state) => {
    state.manifest.per_kind_schema_versions.PROVISION_CONCEPT = [
      'PROVISION_CONCEPT/V1',
      'PROVISION_CONCEPT/V2',
    ];
  });
  t.after(() => fs.rmSync(countRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(versionRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: countRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_KIND_COUNT_MISMATCH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: versionRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_KIND_SCHEMA_VERSION_MISMATCH'),
  );
});

test('rejects traversal paths, symlinks and manifest reordering', (t) => {
  const traversalRoot = fixture((state) => {
    state.manifest.members[0].relative_path = '../outside.json';
  });
  const symlinkRoot = fixture();
  fs.symlinkSync(
    path.join(symlinkRoot, 'claims/knowledge.json'),
    path.join(symlinkRoot, 'linked.json'),
  );
  const reorderedRoot = fixture((state) => {
    [state.manifest.members[0], state.manifest.members[1]] = [
      state.manifest.members[1],
      state.manifest.members[0],
    ];
  });
  t.after(() => fs.rmSync(traversalRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(symlinkRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(reorderedRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: traversalRoot }),
    expectCode('INVALID_CANONICAL_BUNDLE_INPUT_PATH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: symlinkRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_SYMLINK_NOT_ALLOWED'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: reorderedRoot }),
    expectCode('UNSTABLE_CANONICAL_BUNDLE_INPUT_ORDER'),
  );
});
