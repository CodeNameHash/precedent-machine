'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');

const { canonicalJson, contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = join(__dirname, '..', '..');
const AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';
const AUTHORITY_BINDING = Object.freeze({
  path: AUTHORITY_PATH,
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
  record_id_field: 'correction_authority_id',
  record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
  byte_length: 237749,
  sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  git_blob_oid: '5ff4bcd0ca719c4da97dd9bb64d610349e3d7afd',
});
const FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/lawful-work3-family-package-set.json.gz.b64';
const PACKAGE_MEMBER_BINDING_SCHEMA =
  'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';

let fixtureSnapshot;

function loadFixtureSnapshot() {
  if (fixtureSnapshot !== undefined) return structuredClone(fixtureSnapshot);
  const encoded = readFileSync(join(REPO_ROOT, FIXTURE_PATH), 'utf8').trim();
  const parsed = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  const body = { ...parsed };
  delete body.fixture_digest;
  if (parsed.schema_version
      !== 'STAGE_2Y_M7_V2_LAWFUL_FAMILY_PACKAGE_SET_TEST_FIXTURE/V1'
      || parsed.fixture_digest !== sha256Hex(Buffer.from(canonicalJson(body), 'utf8'))) {
    throw new Error('lawful Work3 family-package fixture identity is invalid');
  }
  fixtureSnapshot = parsed;
  return structuredClone(fixtureSnapshot);
}

function gitBlobOid(value) {
  const bytes = Buffer.from(value);
  return createHash('sha1').update(Buffer.concat([
    Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
    bytes,
  ])).digest('hex');
}

function bindingForBytes(path, bytes, schemaVersion, recordIdField, recordId) {
  return {
    path,
    schema_version: schemaVersion,
    record_id_field: recordIdField,
    record_id: recordId,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function canonicalRecordSource(path, record, recordIdField) {
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    binding: bindingForBytes(
      path,
      bytes,
      record.schema_version,
      recordIdField,
      record[recordIdField],
    ),
    bytes,
    record,
  };
}

function exactRecordSource(path, bytes, recordIdField) {
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    binding: bindingForBytes(
      path,
      bytes,
      record.schema_version,
      recordIdField,
      record[recordIdField],
    ),
    bytes,
    record,
  };
}

function assertExpectedBinding(source, expectedBinding, label) {
  if (canonicalJson(source.binding) !== canonicalJson(expectedBinding)) {
    throw new Error(`${label} differs from its exact fixture binding`);
  }
  return source;
}

function packageMemberBinding(containerPath, memberField, memberIndex, record, idField) {
  const memberBytes = Buffer.from(canonicalJson(record), 'utf8');
  return {
    schema_version: PACKAGE_MEMBER_BINDING_SCHEMA,
    container_path: containerPath,
    member_field: memberField,
    member_index: memberIndex,
    member_schema_version: record.schema_version,
    member_record_id_field: idField,
    member_record_id: record[idField],
    member_byte_length: memberBytes.length,
    member_sha256: sha256Hex(memberBytes),
  };
}

function onDiskOverrideMap(snapshot) {
  return new Map((snapshot.on_disk_family_package_overrides ?? []).map(
    (override) => [override.family_key, override],
  ));
}

function buildProfileSetRecord(snapshotProfileSet, packageSources) {
  const profileSet = {
    schema_version: snapshotProfileSet.schema_version,
    state: snapshotProfileSet.state,
    family_profile_package_bindings: packageSources.map((source) => source.binding),
    profiles: packageSources.flatMap((source) => source.record.profiles),
    dimension_evidence_bindings: packageSources.flatMap((source) => source.record.dimension_evidence.map(
      (record, index) => packageMemberBinding(
        source.binding.path,
        'dimension_evidence',
        index,
        record,
        'dimension_evidence_id',
      ),
    )),
    subtype_tree_bindings: packageSources.map((source) => ({
      family_key: source.record.family_key,
      binding: packageMemberBinding(
        source.binding.path,
        'subtype_tree',
        null,
        source.record.subtype_tree,
        'subtype_tree_id',
      ),
    })),
  };
  const unsignedProfileSet = { ...profileSet };
  delete unsignedProfileSet.family_profile_set_id;
  profileSet.family_profile_set_id = contentId(profileSet.schema_version, unsignedProfileSet);
  return profileSet;
}

// The structure dispositions bind two Termination match fixtures each by
// container path and member index. Match fixtures are ordered by ascending
// record ID inside a package, so an on-disk package that carries per-profile
// fixtures the synthetic template does not carry holds those same records at
// different indices. Re-point the bindings on record ID — the fixture bytes are
// unchanged — and re-seal the members and the set, whose IDs cover the bindings.
function repointStructureSetToPackages(structureSet, packageSources) {
  const packagesByPath = new Map(packageSources.map(
    (source) => [source.binding.path, source.record],
  ));
  const repointBinding = (binding) => {
    const record = packagesByPath.get(binding.container_path);
    if (record === undefined) {
      throw new Error(`structure disposition binds an unknown package ${binding.container_path}`);
    }
    const memberIndex = record[binding.member_field].findIndex(
      (member) => member[binding.member_record_id_field] === binding.member_record_id,
    );
    if (memberIndex === -1) {
      throw new Error(`structure disposition fixture ${binding.member_record_id} is absent`);
    }
    return packageMemberBinding(
      binding.container_path,
      binding.member_field,
      memberIndex,
      record[binding.member_field][memberIndex],
      binding.member_record_id_field,
    );
  };
  const members = structureSet.members.map((member) => {
    const repointed = {
      ...member,
      inclusion_fixture_bindings: member.inclusion_fixture_bindings.map(repointBinding),
      exclusion_fixture_bindings: member.exclusion_fixture_bindings.map(repointBinding),
    };
    const unsigned = { ...repointed };
    delete unsigned.schema_version;
    delete unsigned.structure_disposition_id;
    repointed.structure_disposition_id = contentId(structureSet.schema_version, unsigned);
    return repointed;
  }).sort((left, right) => (
    left.structure_disposition_id < right.structure_disposition_id ? -1
      : left.structure_disposition_id > right.structure_disposition_id ? 1 : 0
  ));
  const repointedSet = { ...structureSet, members };
  const unsignedSet = { ...repointedSet };
  delete unsignedSet.structure_disposition_set_id;
  repointedSet.structure_disposition_set_id = contentId(
    structureSet.schema_version, unsignedSet,
  );
  return repointedSet;
}

// The synthetic template gives every family the same WRONG_FAMILY witness: one
// fixture in the ANTITRUST_REGULATORY package, expected to select that package's
// single synthetic profile. A sealed package replaces those synthetic profiles
// with real ones, so swapping a family in while other families still cite a
// profile key only its synthetic record carries would leave those citations
// pointing at nothing. Withhold such an override until the families that depend
// on it are themselves sealed; the override stays recorded either way, so the
// tests that track its bytes are unaffected.
function applicableOnDiskOverrides(snapshot, overrides) {
  const applicable = new Map(overrides);
  let settled = false;
  while (!settled) {
    settled = true;
    const dependedKeys = new Set();
    for (const { record } of snapshot.family_package_sources) {
      if (applicable.has(record.family_key)) continue;
      for (const profile of record.profiles) {
        for (const proof of profile.fixture_proofs) {
          if (proof.expected_selected_profile_key !== null) {
            dependedKeys.add(proof.expected_selected_profile_key);
          }
        }
      }
    }
    for (const [familyKey, override] of applicable) {
      const synthetic = snapshot.family_package_sources.find(
        (entry) => entry.record.family_key === familyKey,
      );
      const onDisk = JSON.parse(readFileSync(join(REPO_ROOT, override.binding.path), 'utf8'));
      const onDiskKeys = new Set(onDisk.profiles.map((profile) => profile.profile_key));
      const withdrawn = synthetic.record.profiles.some(
        (profile) => dependedKeys.has(profile.profile_key) && !onDiskKeys.has(profile.profile_key),
      );
      if (withdrawn) {
        applicable.delete(familyKey);
        settled = false;
        break;
      }
    }
  }
  return applicable;
}

function buildLawfulWork3FamilyPackageSetFixture(options = {}) {
  const useOnDiskFamilyPackages = options.useOnDiskFamilyPackages ?? true;
  const snapshot = loadFixtureSnapshot();
  const onDiskOverrides = useOnDiskFamilyPackages
    ? applicableOnDiskOverrides(snapshot, onDiskOverrideMap(snapshot))
    : onDiskOverrideMap(snapshot);
  const authorityBytes = readFileSync(join(REPO_ROOT, AUTHORITY_PATH));
  const authoritySource = assertExpectedBinding(
    exactRecordSource(AUTHORITY_PATH, authorityBytes, 'correction_authority_id'),
    AUTHORITY_BINDING,
    'Work3 entry-correction authority',
  );
  const scope = authoritySource.record.work3_scope_contract;
  const familyPackageSources = snapshot.family_package_sources.map(({ binding, record }) => {
    const override = useOnDiskFamilyPackages ? onDiskOverrides.get(record.family_key) : undefined;
    if (override === undefined) {
      return assertExpectedBinding(
        canonicalRecordSource(binding.path, record, 'family_profile_package_id'),
        binding,
        `family package ${record.family_key}`,
      );
    }
    const bytes = readFileSync(join(REPO_ROOT, override.binding.path));
    return assertExpectedBinding(
      exactRecordSource(override.binding.path, bytes, 'family_profile_package_id'),
      override.binding,
      `family package ${record.family_key}`,
    );
  });
  const profileSetRecord = useOnDiskFamilyPackages
    ? buildProfileSetRecord(snapshot.family_profile_set, familyPackageSources)
    : snapshot.family_profile_set;
  const profileSetSource = canonicalRecordSource(
    scope.approved_family_profile_set_contract.path,
    profileSetRecord,
    'family_profile_set_id',
  );
  const structureSetSource = canonicalRecordSource(
    scope.structure_disposition_set_contract.path,
    useOnDiskFamilyPackages
      ? repointStructureSetToPackages(snapshot.structure_disposition_set, familyPackageSources)
      : snapshot.structure_disposition_set,
    'structure_disposition_set_id',
  );
  const familyPacketBinding = scope.family_packet_set_source_contract.binding;
  const familyPacketSource = assertExpectedBinding(
    exactRecordSource(
      familyPacketBinding.path,
      readFileSync(join(REPO_ROOT, familyPacketBinding.path)),
      'family_packet_set_id',
    ),
    familyPacketBinding,
    'family packet',
  );
  const generatedNativeRecords = new Map(snapshot.generated_native_source_records.map(
    (source) => [source.binding.path, source],
  ));
  const nativeSourceRecords = snapshot.native_source_bindings.map((binding) => {
    const generated = generatedNativeRecords.get(binding.path);
    const source = generated === undefined
      ? exactRecordSource(
        binding.path,
        readFileSync(join(REPO_ROOT, binding.path)),
        binding.record_id_field,
      )
      : canonicalRecordSource(binding.path, generated.record, binding.record_id_field);
    return assertExpectedBinding(source, binding, `native source ${binding.path}`);
  });
  const validationInput = {
    work3Authority: authoritySource.record,
    familyProfileSet: profileSetSource.record,
    familyPackageSources,
    familyPacketSet: familyPacketSource.record,
    structureDispositionSet: structureSetSource.record,
    nativeSourceRecords,
  };
  const fileEntries = [
    [authoritySource.binding.path, authoritySource.bytes],
    [profileSetSource.binding.path, profileSetSource.bytes],
    [structureSetSource.binding.path, structureSetSource.bytes],
    [familyPacketSource.binding.path, familyPacketSource.bytes],
    ...familyPackageSources.map((source) => [source.binding.path, source.bytes]),
    ...nativeSourceRecords.map((source) => [source.binding.path, source.bytes]),
  ];
  const filesByPath = new Map(fileEntries);
  if (filesByPath.size !== fileEntries.length) {
    throw new Error('lawful Work3 fixture contains a duplicate repository path');
  }
  return {
    validationInput,
    authoritySource,
    profileSetSource,
    structureSetSource,
    familyPacketSource,
    familyPackageSources,
    nativeSourceRecords,
    filesByPath,
    useOnDiskFamilyPackages,
  };
}

module.exports = { buildLawfulWork3FamilyPackageSetFixture };
