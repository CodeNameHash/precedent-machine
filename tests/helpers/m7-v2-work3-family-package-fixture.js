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
const DNO_ITEM42_SUCCESSOR_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-contract-work3-dno-indemnification-item-42-registration-successor-authority-2026-09-01.json';
const DNO_ITEM42_SUCCESSOR_AUTHORITY_BINDING = Object.freeze({
  byte_length: 4151,
  git_blob_oid: 'c643a9bb8f659cc1f6b228ad62057af2be22df04',
  path: DNO_ITEM42_SUCCESSOR_AUTHORITY_PATH,
  record_id: '38ba8297bcb7cf46dc9eee5b3feccc2008f9bc0f3b7242f5009c14a508dac472',
  record_id_field: 'item42_registration_successor_authority_id',
  schema_version: 'N1_DNO_ITEM42_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: '934a0b84fcde4124b9c781e42d08c06f2016de058e96fd484ae0ab36411f77b3',
});
const FAMILY_GROUPING_SUCCESSOR_AUTHORITY_BINDINGS = Object.freeze([
  Object.freeze({
    byte_length: 4166,
    git_blob_oid: 'cb0436c698bc6b81687a86f32aed7f00a74ad7c6',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-dividends-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: '07dc997eb5789f7c7e19e3c050d35ce649deca5f54f5f465bda3291f304d7ee7',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: 'daef1eef63284ef6c8de7b3f3aba523f242396a0b3a2b8d63c25f1183f8b3a77',
  }),
  Object.freeze({
    byte_length: 4185,
    git_blob_oid: 'bb1d9e1d4faf1e6267e74c4670e776f627eb4498',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-mae-definition-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: 'c4b20e87dd0643d8690d56ad6d4e78da9aae4e42c7784716f609558861038e0c',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '0a5a52c37b3c196ee29bb7198289baeb82944bf22856ed3ec2c1be4782c8c417',
  }),
  Object.freeze({
    byte_length: 4247,
    git_blob_oid: 'fc286c5d39a2213e946124f926d2f3dd608b1356',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-guaranty-financing-party-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: 'ad1efb8ad4b499e5f08f05fae77cc86b70b9f27325dd8d15beab87a799c94d71',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '7316d5fb453b4c0d4e4b23e8fff0f6e879f549b39fad35cde87c314af215e7d4',
  }),
  Object.freeze({
    byte_length: 4300,
    git_blob_oid: '501c0d1537f126e64852faa98abb6d0a1cded115',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-appraisal-dissenters-rights-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: '344ba0d71455ac95b24cb20e66fbc7859a1f26810a0432a914451d2066189ac0',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '47fa0c0a9c99af77a783bfe2e1e0302140e10b3be64c54ecdd5ff3f088303ab7',
  }),
  Object.freeze({
    byte_length: 4244,
    git_blob_oid: 'f78ff82cdae4b5e4039a7d0c17134af78b04cae0',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-financing-covenants-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: 'acb932208647c30746addd949cdbe097411a480e5ab7bd58ad156ad68fae6e44',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '80794b2cb9d8effefd61846cd7328c47240cb8aca411fd46a62469f2a151e98f',
  }),
  Object.freeze({
    byte_length: 4206,
    git_blob_oid: 'e35633b20f243a5a64210cfc3945d79242c9f0e3',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-consideration-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: 'f5f4fd5704d65d08a0dde56f643d9858af29ef75f0328a368a287cc16b019b43',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '2322f7e1ad5b788ea7155d5f507e13ba287675401b795fe0ae7ed8e23ce98b0e',
  }),
  Object.freeze({
    byte_length: 4573,
    git_blob_oid: '3c29b4e25ff746950d35138dd2fa77a802af5c0d',
    path:
      'evidence/canonical-v2/stage-2y-structure-migration/control/'
      + 'm7-v2-repair-contract-work3-interim-operating-grouping-registration-successor-authority-2026-09-01B.json',
    record_id: 'ef248f31b6edfaf290718a47b275eda7251da751fefa7f339cdf540764086941',
    record_id_field: 'grouping_registration_successor_authority_id',
    schema_version: 'N1_GROUPING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
    sha256: '0666eed09924daf00f9b213b7828efcb8543f6c4d1915fb7d602ad5021edd12c',
  }),
]);
const DNO_PREDECESSOR_PACKAGE_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-family-work3-profile-package-dno-indemnification.json';
const DNO_PREDECESSOR_PACKAGE_BINDING = Object.freeze({
  byte_length: 407522,
  git_blob_oid: 'c410d22bf518be891479995f878cdc2aa45b2b30',
  path: DNO_PREDECESSOR_PACKAGE_PATH,
  record_id: 'e5b568d8eaa764a63a17e4fc6337b3049c8cfa5163947cb230c120027c38395e',
  record_id_field: 'family_profile_package_id',
  schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
  sha256: '5fccaa143aed5deb4eecd81e9efaf3782930eaf282b069e6e5bc35f939acb0ed',
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

function restampInlineRecord(record, idField) {
  const unsigned = { ...record };
  delete unsigned.schema_version;
  delete unsigned[idField];
  record[idField] = contentId(record.schema_version, unsigned);
}

function restampBoundRecord(record, idField) {
  const unsigned = { ...record };
  delete unsigned[idField];
  record[idField] = contentId(record.schema_version, unsigned);
}

// CAPITALISATION is the only family without an on-disk package. Its synthetic
// WRONG_FAMILY proof originally selected the synthetic Antitrust profile. Once
// the sealed Antitrust package is loaded, rebind that proof to the pinned
// sealed package positive fixture and reseal only the in-memory test
// package. This preserves the negative expectation while allowing every sealed
// override, including Appraisal, to participate in the full-set validation.
function rebindSyntheticCapitalisationPackage(snapshotSource, antitrustSource) {
  const record = structuredClone(snapshotSource.record);
  if (record.family_key !== 'CAPITALISATION' || record.profiles.length !== 1) {
    throw new Error('synthetic Capitalisation fixture shape changed');
  }
  const profile = record.profiles[0];
  const wrongFamilyIndex = profile.fixture_proofs.findIndex(
    (proof) => proof.kind === 'WRONG_FAMILY',
  );
  const targetProfileKey =
    'PROFILE:ANTITRUST_REGULATORY:BURDEN:'
    + '9d6c60f9b2f724cb0f80a93e0538be1e32cc8eb993943f93a480f4cf20842a89';
  const targetProfile = antitrustSource.record.profiles.find(
    (candidate) => candidate.profile_key === targetProfileKey,
  );
  const targetProof = targetProfile?.fixture_proofs.find((proof) => proof.kind === 'POSITIVE');
  const wrongFamilyProof = profile.fixture_proofs[wrongFamilyIndex];
  if (antitrustSource.record.family_key !== 'ANTITRUST_REGULATORY'
      || wrongFamilyIndex === -1
      || wrongFamilyProof.expected_selected_profile_key !== 'PROFILE:ANTITRUST_REGULATORY'
      || wrongFamilyProof.fixture_id !== 'fixture-positive-PROFILE-ANTITRUST_REGULATORY'
      || targetProof === undefined
      || targetProof.expected_match !== true
      || targetProof.expected_selected_profile_key !== targetProfile.profile_key
      || targetProof.fixture_binding.container_path !== antitrustSource.binding.path) {
    throw new Error('sealed Antitrust package lacks a usable positive fixture');
  }
  profile.fixture_proofs[wrongFamilyIndex] = {
    ...profile.fixture_proofs[wrongFamilyIndex],
    fixture_id: targetProof.fixture_id,
    fixture_binding: structuredClone(targetProof.fixture_binding),
    input_occurrence_id: targetProof.input_occurrence_id,
    expected_selected_profile_key: targetProfile.profile_key,
  };
  const predecessorProfileId = profile.profile_id;
  restampInlineRecord(profile, 'profile_id');
  let updatedEvidenceCount = 0;
  for (const evidence of record.dimension_evidence) {
    if (evidence.profile_id !== predecessorProfileId) continue;
    evidence.profile_id = profile.profile_id;
    restampBoundRecord(evidence, 'dimension_evidence_id');
    updatedEvidenceCount += 1;
  }
  if (updatedEvidenceCount !== record.dimension_evidence.length) {
    throw new Error('synthetic Capitalisation dimension evidence is not one-profile scoped');
  }
  const inventory = {
    family_key: record.family_key,
    profile_set_version: record.profile_set_version,
    legal_decisions: record.legal_decisions,
    profile_ids: record.profiles.map((entry) => entry.profile_id),
    subtype_tree_id: record.subtype_tree.subtype_tree_id,
    match_fixture_record_ids: record.match_fixtures.map(
      (fixture) => fixture.match_fixture_id,
    ),
    dimension_evidence_ids: record.dimension_evidence.map(
      (evidence) => evidence.dimension_evidence_id,
    ),
    structure_fixture_ids: record.structure_fixture_members.map(
      (fixture) => fixture.fixture_id,
    ),
  };
  record.family_approval.approved_inventory_digest = sha256Hex(
    Buffer.from(canonicalJson(inventory), 'utf8'),
  );
  restampBoundRecord(record.family_approval, 'family_approval_id');
  restampBoundRecord(record, 'family_profile_package_id');
  return canonicalRecordSource(
    snapshotSource.binding.path,
    record,
    'family_profile_package_id',
  );
}

function buildLawfulWork3FamilyPackageSetFixture(options = {}) {
  const useOnDiskFamilyPackages = options.useOnDiskFamilyPackages ?? true;
  const snapshot = loadFixtureSnapshot();
  const onDiskOverrides = onDiskOverrideMap(snapshot);
  const authorityBytes = readFileSync(join(REPO_ROOT, AUTHORITY_PATH));
  const authoritySource = assertExpectedBinding(
    exactRecordSource(AUTHORITY_PATH, authorityBytes, 'correction_authority_id'),
    AUTHORITY_BINDING,
    'Work3 entry-correction authority',
  );
  const dnoItem42SuccessorAuthoritySource = useOnDiskFamilyPackages
    ? assertExpectedBinding(
      exactRecordSource(
        DNO_ITEM42_SUCCESSOR_AUTHORITY_PATH,
        readFileSync(join(REPO_ROOT, DNO_ITEM42_SUCCESSOR_AUTHORITY_PATH)),
        'item42_registration_successor_authority_id',
      ),
      DNO_ITEM42_SUCCESSOR_AUTHORITY_BINDING,
      'D&O item-42 package successor authority',
    )
    : null;
  const dnoPredecessorPackageSource = useOnDiskFamilyPackages
    ? assertExpectedBinding(
      exactRecordSource(
        DNO_PREDECESSOR_PACKAGE_PATH,
        readFileSync(join(REPO_ROOT, DNO_PREDECESSOR_PACKAGE_PATH)),
        'family_profile_package_id',
      ),
      DNO_PREDECESSOR_PACKAGE_BINDING,
      'D&O sealed predecessor package',
    )
    : null;
  const familyGroupingSuccessorAuthoritySources = useOnDiskFamilyPackages
    ? FAMILY_GROUPING_SUCCESSOR_AUTHORITY_BINDINGS.map((binding) => assertExpectedBinding(
      exactRecordSource(
        binding.path,
        readFileSync(join(REPO_ROOT, binding.path)),
        binding.record_id_field,
      ),
      binding,
      `family grouping package successor authority ${binding.path}`,
    ))
    : [];
  const scope = authoritySource.record.work3_scope_contract;
  const overrideSources = useOnDiskFamilyPackages
    ? new Map([...onDiskOverrides].map(([familyKey, override]) => {
      const bytes = readFileSync(join(REPO_ROOT, override.binding.path));
      return [familyKey, assertExpectedBinding(
        exactRecordSource(override.binding.path, bytes, 'family_profile_package_id'),
        override.binding,
        `family package ${familyKey}`,
      )];
    }))
    : new Map();
  const antitrustSource = overrideSources.get('ANTITRUST_REGULATORY');
  const familyPackageSources = snapshot.family_package_sources.map(({ binding, record }) => {
    const override = useOnDiskFamilyPackages ? onDiskOverrides.get(record.family_key) : undefined;
    if (override === undefined) {
      if (useOnDiskFamilyPackages && record.family_key === 'CAPITALISATION') {
        if (antitrustSource === undefined) {
          throw new Error('sealed Antitrust package is absent');
        }
        return rebindSyntheticCapitalisationPackage(
          { binding, record },
          antitrustSource,
        );
      }
      return assertExpectedBinding(
        canonicalRecordSource(binding.path, record, 'family_profile_package_id'),
        binding,
        `family package ${record.family_key}`,
      );
    }
    return overrideSources.get(record.family_key);
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
    dnoItem42SuccessorAuthority: dnoItem42SuccessorAuthoritySource?.record ?? null,
    familyGroupingSuccessorAuthorities: useOnDiskFamilyPackages
      ? familyGroupingSuccessorAuthoritySources.map((source) => source.record)
      : null,
    familyProfileSet: profileSetSource.record,
    familyPackageSources,
    familyPacketSet: familyPacketSource.record,
    structureDispositionSet: structureSetSource.record,
    nativeSourceRecords,
  };
  const fileEntries = [
    [authoritySource.binding.path, authoritySource.bytes],
    ...(dnoItem42SuccessorAuthoritySource === null ? [] : [[
      dnoItem42SuccessorAuthoritySource.binding.path,
      dnoItem42SuccessorAuthoritySource.bytes,
    ]]),
    ...(dnoPredecessorPackageSource === null ? [] : [[
      dnoPredecessorPackageSource.binding.path,
      dnoPredecessorPackageSource.bytes,
    ]]),
    ...familyGroupingSuccessorAuthoritySources.map((source) => [
      source.binding.path,
      source.bytes,
    ]),
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
    dnoItem42SuccessorAuthoritySource,
    dnoPredecessorPackageSource,
    familyGroupingSuccessorAuthoritySources,
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
