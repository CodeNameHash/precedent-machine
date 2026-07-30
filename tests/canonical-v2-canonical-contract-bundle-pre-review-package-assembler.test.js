const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const { domainDigest } = require('../lib/programme-gates/bytes');
const { validateSchema } = require('../lib/programme-gates/schema-registry');
const {
  CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
  DEPENDENCY_REGISTRY_SCHEMA_VERSION,
  GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  SPECIFICATION_MANIFEST_PATH,
  SPECIFICATION_ROOT_DOMAIN,
  SPECIFICATION_ROOT_INPUT_ENCODING,
  SPECIFICATION_ROOT_MEMBERSHIP,
  REMAINING_FORMAL_FREEZE_INPUTS,
  PRE_REVIEW_ATTESTATION_PLACEHOLDER_SCHEMA_VERSION,
  PRE_REVIEW_ATTESTATION_PLACEHOLDER_ID_DOMAIN,
  PRE_REVIEW_FROZEN_PAIR_PLACEHOLDER_DOMAIN,
  PRE_REVIEW_INPUT_CONTEXT_PLACEHOLDER_DOMAIN,
  assembleCanonicalContractBundlePreReviewPackage,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-pre-review-package-assembler'
);

const GOVERNANCE_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function authoredMember(index, objectKind, stableId) {
  const canonicalValue = {
    object_kind: objectKind,
    stable_id: stableId,
    schema_version: `${objectKind}/V1`,
    legal_meaning: `MEANING_${index}`,
  };
  const bytes = Buffer.from(canonicalJson(canonicalValue), 'utf8');
  return {
    relative_path: `contracts/member-${String(index).padStart(2, '0')}.json`,
    object_kind: objectKind,
    stable_id: stableId,
    schema_version: canonicalValue.schema_version,
    canonical_bytes_digest: sha256Hex(bytes),
    canonical_byte_length: bytes.length,
    contract_ordinal: index,
    canonical_value: canonicalValue,
  };
}

function identity(member) {
  return {
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    schema_version: member.schema_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
  };
}

function canonicalInputIdentity(authoredMembers) {
  const body = {
    schema_version: 'CANONICAL_BUNDLE_INPUT_IDENTITY/V1',
    root_input_manifest_id: contentId('TEST_INPUT_MANIFEST_ID/V1', authoredMembers),
    root_input_manifest_payload_digest:
      contentId('TEST_INPUT_MANIFEST_PAYLOAD/V1', authoredMembers),
    compiler_input_schema_version: 'CANONICAL_BUNDLE_INPUT_COMPILER/V1',
    generator_input_schema_version: 'CANONICAL_BUNDLE_GENERATOR_INPUT/V1',
    ordered_entries: authoredMembers.map((member) => ({
      relative_path: member.relative_path,
      object_kind: member.object_kind,
      stable_id: member.stable_id,
      canonical_bytes_digest: member.canonical_bytes_digest,
    })),
    per_kind_counts: Object.fromEntries(authoredMembers.map(
      (member) => [member.object_kind, 1],
    )),
    per_kind_schema_versions: Object.fromEntries(authoredMembers.map(
      (member) => [member.object_kind, [member.schema_version]],
    )),
    validation_roots: {
      missing_input_root: contentId('CANONICAL_BUNDLE_INPUT_MISSING_ROOT/V1', []),
      extra_input_root: contentId('CANONICAL_BUNDLE_INPUT_EXTRA_ROOT/V1', []),
      duplicate_input_root: contentId('CANONICAL_BUNDLE_INPUT_DUPLICATE_ROOT/V1', []),
      conflicting_input_root: contentId('CANONICAL_BUNDLE_INPUT_CONFLICT_ROOT/V1', []),
    },
  };
  return {
    ...body,
    canonical_payload_digest: contentId(
      'CANONICAL_BUNDLE_INPUT_IDENTITY_PAYLOAD/V1',
      body,
    ),
    canonical_bundle_input_identity_id: contentId(
      'CANONICAL_BUNDLE_INPUT/V1',
      body,
    ),
  };
}

function sealClassificationRegistry(orderedClassifications) {
  const body = {
    schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    registry_version: 1,
    predecessor_registry: null,
    ordered_classifications: orderedClassifications,
  };
  const canonicalPayloadDigest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
    body,
  );
  return {
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    classification_registry_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
      {
        schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
        registry_version: 1,
        canonical_payload_digest: canonicalPayloadDigest,
      },
    ),
  };
}

function sealDependencyRegistry(orderedDependencies) {
  const body = {
    schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    registry_version: 1,
    predecessor_registry: null,
    ordered_dependencies: orderedDependencies,
  };
  const canonicalPayloadDigest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_PAYLOAD/V1',
    body,
  );
  return {
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    dependency_registry_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_ID/V1',
      {
        schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
        registry_version: 1,
        canonical_payload_digest: canonicalPayloadDigest,
      },
    ),
  };
}

function specificationMembers() {
  const contentMembers = Array.from({ length: 5 }, (_, index) => {
    const bytes = Buffer.from(`governing specification ${index + 1}`, 'utf8');
    return {
      order: index + 2,
      path: `docs/codex-program/specification-${index + 1}.txt`,
      byte_length: bytes.length,
      payload_digest: sha256Hex(bytes),
      source_bytes_base64: bytes.toString('base64'),
    };
  });
  const manifest = {
    schema: 'codex-program-specification-manifest/v1',
    domain_separator: SPECIFICATION_ROOT_DOMAIN,
    root_input_encoding: SPECIFICATION_ROOT_INPUT_ENCODING,
    root_membership: SPECIFICATION_ROOT_MEMBERSHIP,
    files: contentMembers.map((member) => ({
      order: member.order,
      path: member.path,
      byte_length: member.byte_length,
      sha256: member.payload_digest,
    })),
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return [{
    order: 1,
    path: SPECIFICATION_MANIFEST_PATH,
    byte_length: manifestBytes.length,
    payload_digest: sha256Hex(manifestBytes),
    source_bytes_base64: manifestBytes.toString('base64'),
  }, ...contentMembers];
}

function fixture() {
  const governance = authoredMember(0, GOVERNANCE_KIND, GOVERNANCE_KIND);
  const domainMembers = REQUIRED_BUNDLE_KINDS.map((kind, index) => (
    authoredMember(
      index + 1,
      index === 0 ? `TEST_QUERY_${kind}` : `TEST_${kind}`,
      index === 0 ? `TEST_QUERY_${kind}` : `TEST_${kind}`,
    )
  ));
  const authoredMembers = [governance, ...domainMembers];
  const identities = domainMembers
    .map(identity)
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const kindByStableId = new Map(
    REQUIRED_BUNDLE_KINDS.map((kind, index) => [
      index === 0 ? `TEST_QUERY_${kind}` : `TEST_${kind}`,
      kind,
    ]),
  );
  const classificationRegistry = sealClassificationRegistry(
    identities.map((authoredIdentity) => ({
      authored_identity: authoredIdentity,
      member_kind: kindByStableId.get(authoredIdentity.stable_id),
    })),
  );
  const dependencyRegistry = sealDependencyRegistry(
    identities.map((authoredIdentity, index) => ({
      authored_identity: authoredIdentity,
      ordered_dependency_identities: index === 0 ? [] : [identities[index - 1]],
    })),
  );
  const compilationInput = {
    canonical_contract_input_compilation: {
      schema_version: 'CANONICAL_BUNDLE_INPUT_COMPILATION/V1',
      canonical_bundle_input_identity: canonicalInputIdentity(authoredMembers),
      authored_members: authoredMembers,
      authored_universe_assessment: {
        status: 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY',
        required_kind_registry_binding: {
          relative_path: governance.relative_path,
          stable_id: governance.stable_id,
          schema_version: governance.schema_version,
          canonical_bytes_digest: governance.canonical_bytes_digest,
        },
      },
      disposition: {
        status: 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE',
        reason_code: 'BUNDLE_GENERATION_AND_FREEZE_NOT_EVALUATED',
        freeze_eligible: false,
        canonical_contract_bundle_authority: 'NONE',
        p1_gate_status: 'NOT_EVALUATED',
      },
    },
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings: {
      schema_version: GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
      classification_registry_id: classificationRegistry.classification_registry_id,
      classification_registry_payload_digest:
        classificationRegistry.canonical_payload_digest,
      dependency_registry_id: dependencyRegistry.dependency_registry_id,
      dependency_registry_payload_digest: dependencyRegistry.canonical_payload_digest,
    },
  };
  const successor = compileCanonicalContractBundle(compilationInput);
  const firstSuccessorMember = successor.canonical_contract_bundle_projection[0];
  const predecessorProjection = [
    {
      ...firstSuccessorMember,
      semantic_digest: 'a'.repeat(64),
    },
    {
      member_key: 'LEGACY_ONLY',
      semantic_digest: 'b'.repeat(64),
      identity_digest: 'c'.repeat(64),
    },
  ].sort((left, right) => left.member_key.localeCompare(right.member_key));
  return {
    ...compilationInput,
    predecessor_contract_bundle_projection: predecessorProjection,
    governing_specification_members: specificationMembers(),
    code_commit: 'd'.repeat(40),
    environment: 'STAGING',
    approval_epoch_nonce: 'freeze-approval-epoch-1',
  };
}

function assertAssemblerError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(
      error.name,
      'CanonicalContractBundlePreReviewPackageAssemblerError',
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('assembles one deterministic immutable pre-review package', () => {
  const input = fixture();
  const first = assembleCanonicalContractBundlePreReviewPackage(input);
  const second = assembleCanonicalContractBundlePreReviewPackage(clone(input));
  const review = first.exact_review_package;

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(review), true);
  assert.equal(
    first.exact_review_package_fingerprint,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V1',
      review,
    ),
  );
  assert.equal(
    first.pre_review_package_payload_digest,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_PRE_REVIEW_PACKAGE_PAYLOAD/V1',
      {
        exact_review_package: review,
        exact_review_package_fingerprint:
          first.exact_review_package_fingerprint,
        remaining_formal_freeze_input_inventory:
          first.remaining_formal_freeze_input_inventory,
        disposition: first.disposition,
      },
    ),
  );
  assert.equal(review.canonical_contract_bundle_members.length, 8);
  assert.equal(
    review.contract_bundle_freeze_candidate
      .unsigned_contract_bundle_compilation_receipt_payload
      .frozen_contract_pair_digest,
    review.pre_review_frozen_pair_placeholder_digest,
  );
  assert.equal(first.disposition.state, 'PRE_REVIEW_INPUTS_ASSEMBLED_NOT_REVIEWED');
  assert.equal(first.disposition.architecture_review_conclusion, 'NOT_SUPPLIED');
  assert.equal(first.disposition.legal_semantic_review_conclusion, 'NOT_SUPPLIED');
  assert.equal(first.disposition.ben_approval, 'NOT_SUPPLIED');
  assert.equal(first.disposition.freeze_authority, 'NONE');
});

test('uses a structurally distinct schema and digest domains for pre-review placeholders', () => {
  const result = assembleCanonicalContractBundlePreReviewPackage(fixture());
  const review = result.exact_review_package;
  const placeholder = review.pre_review_attestation_placeholder;

  assert.equal(
    placeholder.schema_version,
    PRE_REVIEW_ATTESTATION_PLACEHOLDER_SCHEMA_VERSION,
  );
  assert.equal('contract_freeze_attestation_id' in placeholder, false);
  assert.throws(() => validateSchema(
    'ContractFreezeAttestationIdentity/V1',
    placeholder,
  ));
  const {
    pre_review_attestation_placeholder_id: ignored,
    ...unsignedPlaceholder
  } = placeholder;
  assert.equal(
    placeholder.pre_review_attestation_placeholder_id,
    domainDigest(
      PRE_REVIEW_ATTESTATION_PLACEHOLDER_ID_DOMAIN,
      unsignedPlaceholder,
    ),
  );
  assert.equal(
    review.pre_review_frozen_pair_placeholder_digest,
    domainDigest(
      PRE_REVIEW_FROZEN_PAIR_PLACEHOLDER_DOMAIN,
      {
        predecessor_contract_bundle_id:
          review.predecessor_contract_bundle_id,
        predecessor_contract_bundle_digest:
          review.predecessor_contract_bundle_digest,
        successor_contract_bundle_id: review.contract_bundle_id,
        successor_contract_bundle_digest: review.contract_bundle_digest,
        pre_review_attestation_placeholder_id:
          placeholder.pre_review_attestation_placeholder_id,
      },
    ),
  );
  assert.equal(
    review.pre_review_input_context_placeholder_digest,
    domainDigest(
      PRE_REVIEW_INPUT_CONTEXT_PLACEHOLDER_DOMAIN,
      {
        specification_root: review.specification_root,
        code_commit: review.code_commit,
        predecessor_contract_bundle_id:
          review.predecessor_contract_bundle_id,
        predecessor_contract_bundle_digest:
          review.predecessor_contract_bundle_digest,
        contract_bundle_id: review.contract_bundle_id,
        contract_bundle_digest: review.contract_bundle_digest,
        pre_review_frozen_pair_placeholder_digest:
          review.pre_review_frozen_pair_placeholder_digest,
        semantic_identity_diff_digest:
          review.semantic_identity_diff_digest,
      },
    ),
  );
});

test('derives exact specification records and the frozen specification root', () => {
  const result = assembleCanonicalContractBundlePreReviewPackage(fixture());
  const review = result.exact_review_package;
  const members = review.governing_specification_member_records;
  assert.equal(members.length, 6);
  members.forEach((member) => {
    assert.equal(
      validateSchema('ContractFreezeGoverningSpecificationMember/V1', member),
      true,
    );
    const { specification_member_id: ignored, ...unsigned } = member;
    assert.equal(
      member.specification_member_id,
      domainDigest(
        'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
        unsigned,
      ),
    );
  });
  const records = members.map((member) => (
    `${member.path}\0${member.byte_length}\0${member.payload_digest}\n`
  )).join('');
  assert.equal(
    review.specification_root,
    sha256Hex(Buffer.from(`${SPECIFICATION_ROOT_DOMAIN}\n${records}`, 'utf8')),
  );
  assert.equal(review.root_manifest_digest, members[0].payload_digest);
});

test('derives the complete mechanical semantic and identity diff', () => {
  const review =
    assembleCanonicalContractBundlePreReviewPackage(fixture()).exact_review_package;
  assert.deepEqual(
    review.semantic_identity_diff.removed_member_keys,
    ['LEGACY_ONLY'],
  );
  assert.deepEqual(
    review.semantic_identity_diff.semantic_changed_member_keys,
    ['COMPARABILITY'],
  );
  assert.deepEqual(
    review.semantic_identity_diff.identity_changed_member_keys,
    [],
  );
  assert.equal(review.semantic_identity_diff.added_member_keys.length, 7);
  assert.equal(
    review.semantic_identity_diff_digest,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
      review.semantic_identity_diff,
    ),
  );
});

test('rejects changed specification bytes and duplicate paths', () => {
  const drifted = fixture();
  drifted.governing_specification_members[2].source_bytes_base64 =
    Buffer.from('changed bytes', 'utf8').toString('base64');
  assertAssemblerError(
    'GOVERNING_SPECIFICATION_MEMBER_SOURCE_DRIFT',
    () => assembleCanonicalContractBundlePreReviewPackage(drifted),
  );

  const duplicate = fixture();
  duplicate.governing_specification_members[2].path =
    duplicate.governing_specification_members[1].path;
  const duplicateBytes = Buffer.from(
    duplicate.governing_specification_members[0].source_bytes_base64,
    'base64',
  );
  const manifest = JSON.parse(duplicateBytes.toString('utf8'));
  manifest.files[1].path = manifest.files[0].path;
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  duplicate.governing_specification_members[0].byte_length = manifestBytes.length;
  duplicate.governing_specification_members[0].payload_digest =
    sha256Hex(manifestBytes);
  duplicate.governing_specification_members[0].source_bytes_base64 =
    manifestBytes.toString('base64');
  assertAssemblerError(
    'INVALID_GOVERNING_SPECIFICATION_MEMBER_SET',
    () => assembleCanonicalContractBundlePreReviewPackage(duplicate),
  );
});

test('rejects manifest drift from the exact supplied member set', () => {
  const input = fixture();
  const manifestBytes = Buffer.from(
    input.governing_specification_members[0].source_bytes_base64,
    'base64',
  );
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  manifest.files[0].sha256 = 'e'.repeat(64);
  const changed = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  input.governing_specification_members[0].byte_length = changed.length;
  input.governing_specification_members[0].payload_digest = sha256Hex(changed);
  input.governing_specification_members[0].source_bytes_base64 =
    changed.toString('base64');
  assertAssemblerError(
    'GOVERNING_SPECIFICATION_MANIFEST_MEMBER_DRIFT',
    () => assembleCanonicalContractBundlePreReviewPackage(input),
  );
});

test('rejects malformed, duplicate and unordered predecessor projections', () => {
  const malformed = fixture();
  malformed.predecessor_contract_bundle_projection[0].display_label = 'forged';
  assertAssemblerError(
    'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    () => assembleCanonicalContractBundlePreReviewPackage(malformed),
  );

  const duplicate = fixture();
  duplicate.predecessor_contract_bundle_projection.push(
    clone(duplicate.predecessor_contract_bundle_projection[0]),
  );
  assertAssemblerError(
    'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    () => assembleCanonicalContractBundlePreReviewPackage(duplicate),
  );

  const unordered = fixture();
  unordered.predecessor_contract_bundle_projection.reverse();
  assertAssemblerError(
    'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    () => assembleCanonicalContractBundlePreReviewPackage(unordered),
  );

  const unsafeKey = fixture();
  unsafeKey.predecessor_contract_bundle_projection[0].member_key =
    '../not-a-governed-key';
  assertAssemblerError(
    'INVALID_PREDECESSOR_CONTRACT_BUNDLE_PROJECTION',
    () => assembleCanonicalContractBundlePreReviewPackage(unsafeKey),
  );
});

test('rejects authority, review, approval, signature and status inputs', () => {
  for (const field of [
    'authority_manifest',
    'review_conclusion',
    'ben_approval',
    'private_key',
    'signature',
    'programme_status',
  ]) {
    const input = fixture();
    input[field] = {};
    assertAssemblerError(
      'INVALID_PRE_REVIEW_PACKAGE_INPUT',
      () => assembleCanonicalContractBundlePreReviewPackage(input),
    );
  }
});

test('rejects unsafe specification paths', () => {
  const input = fixture();
  input.governing_specification_members[1].path = '../outside.md';
  assertAssemblerError(
    'INVALID_GOVERNING_SPECIFICATION_MEMBER',
    () => assembleCanonicalContractBundlePreReviewPackage(input),
  );
});

test('retains an exact machine-readable list of remaining freeze inputs', () => {
  const result = assembleCanonicalContractBundlePreReviewPackage(fixture());
  assert.deepEqual(
    result.remaining_formal_freeze_input_inventory,
    REMAINING_FORMAL_FREEZE_INPUTS,
  );
  assert.equal(
    result.remaining_formal_freeze_input_inventory
      .find((entry) => entry.schema_id === 'ContractDiffReviewAttestation/V1')
      .state,
    'REVIEW_CONCLUSION_NOT_SUPPLIED',
  );
  assert.equal(
    result.remaining_formal_freeze_input_inventory
      .find((entry) => entry.schema_id === 'ContractFreezeApproval/V1')
      .state,
    'BEN_APPROVAL_NOT_SUPPLIED',
  );
});
