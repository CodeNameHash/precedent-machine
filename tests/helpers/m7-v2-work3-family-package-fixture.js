'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');

const { canonicalJson, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');

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

function buildLawfulWork3FamilyPackageSetFixture() {
  const snapshot = loadFixtureSnapshot();
  const authorityBytes = readFileSync(join(REPO_ROOT, AUTHORITY_PATH));
  const authoritySource = assertExpectedBinding(
    exactRecordSource(AUTHORITY_PATH, authorityBytes, 'correction_authority_id'),
    AUTHORITY_BINDING,
    'Work3 entry-correction authority',
  );
  const scope = authoritySource.record.work3_scope_contract;
  const familyPackageSources = snapshot.family_package_sources.map(({ binding, record }) => (
    assertExpectedBinding(
      canonicalRecordSource(binding.path, record, 'family_profile_package_id'),
      binding,
      `family package ${record.family_key}`,
    )
  ));
  const profileSetSource = canonicalRecordSource(
    scope.approved_family_profile_set_contract.path,
    snapshot.family_profile_set,
    'family_profile_set_id',
  );
  const structureSetSource = canonicalRecordSource(
    scope.structure_disposition_set_contract.path,
    snapshot.structure_disposition_set,
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
  };
}

module.exports = { buildLawfulWork3FamilyPackageSetFixture };
