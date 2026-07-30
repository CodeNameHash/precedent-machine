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
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  assembleCanonicalContractBundleReviewedRegistries,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-reviewed-registry-assembler'
);
const {
  SPECIFICATION_MANIFEST_PATH,
  SPECIFICATION_ROOT_DOMAIN,
  SPECIFICATION_ROOT_INPUT_ENCODING,
  SPECIFICATION_ROOT_MEMBERSHIP,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-pre-review-package-assembler'
);
const {
  FIXTURE_CONTRACT_FINGERPRINT_V2,
  compileFixtureContract,
  compileFixtureContractV2,
} = require('../lib/canonical-v2/contract-bundle');
const {
  LEGACY_F1_CONTRACT_FINGERPRINT,
  LEGACY_F1_MEMBER_KEY,
  compileLegacyF1CanonicalContractBundleMember,
  validateCanonicalPredecessorBundleMembers,
  assembleCanonicalContractBundlePreReviewSourceClosure,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-pre-review-source-closure'
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
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return [{
    order: 1,
    path: SPECIFICATION_MANIFEST_PATH,
    byte_length: bytes.length,
    payload_digest: sha256Hex(bytes),
    source_bytes_base64: bytes.toString('base64'),
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
  const compilation = {
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
  };
  const registryAssembly = assembleCanonicalContractBundleReviewedRegistries({
    canonical_contract_input_compilation: compilation,
    reviewed_dispositions: identities.map((authoredIdentity, index) => ({
      authored_identity: authoredIdentity,
      member_kind: kindByStableId.get(authoredIdentity.stable_id),
      ordered_dependency_identities:
        index === 0 ? [] : [identities[index - 1]],
    })),
    registry_version: 1,
    predecessor_classification_registry: null,
    predecessor_dependency_registry: null,
  });
  return {
    canonical_contract_input_compilation: compilation,
    classification_registry: registryAssembly.classification_registry,
    dependency_registry: registryAssembly.dependency_registry,
    governed_registry_bindings: registryAssembly.governed_registry_bindings,
    predecessor_canonical_contract_bundle_members: [
      clone(compileLegacyF1CanonicalContractBundleMember()),
    ],
    governing_specification_members: specificationMembers(),
    code_commit: 'd'.repeat(40),
    environment: 'STAGING',
    approval_epoch_nonce: 'freeze-approval-epoch-1',
  };
}

function assertSourceClosureError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(
      error.name,
      'CanonicalContractBundlePreReviewSourceClosureError',
    );
    assert.equal(error.code, code);
    return true;
  });
}

function compiledAggregatePredecessorMembers() {
  const input = fixture();
  return compileCanonicalContractBundle({
    canonical_contract_input_compilation:
      input.canonical_contract_input_compilation,
    classification_registry: input.classification_registry,
    dependency_registry: input.dependency_registry,
    governed_registry_bindings: input.governed_registry_bindings,
  }).canonical_contract_bundle_members;
}

function aggregateSource(member) {
  return JSON.parse(
    Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
  );
}

function resealAggregateSource(member, source) {
  const sourceBytes = Buffer.from(canonicalJson(source), 'utf8');
  member.byte_length = sourceBytes.length;
  member.payload_digest = sha256Hex(sourceBytes);
  member.source_bytes_base64 = sourceBytes.toString('base64');
  member.semantic_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_SEMANTIC/V1',
    source,
  );
  member.identity_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_IDENTITY/V1',
    {
      member_kind: source.member_kind,
      ordered_authored_members: source.ordered_authored_members.map((entry) => ({
        authored_identity: entry.authored_identity,
        ordered_dependency_identities: entry.ordered_dependency_identities,
      })),
    },
  );
}

test('wraps only the exact F1 fixture bundle as an immutable predecessor', () => {
  const member = compileLegacyF1CanonicalContractBundleMember();
  assert.equal(validateSchema('CanonicalContractBundleMember/V1', member), true);
  assert.equal(member.member_key, LEGACY_F1_MEMBER_KEY);
  assert.equal(member.semantic_digest, LEGACY_F1_CONTRACT_FINGERPRINT);
  const source = JSON.parse(
    Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
  );
  assert.equal(source.fingerprint, LEGACY_F1_CONTRACT_FINGERPRINT);
  assert.equal(canonicalJson(source), canonicalJson(compileFixtureContract()));
  assert.equal(
    sha256Hex(Buffer.from(member.source_bytes_base64, 'base64')),
    member.payload_digest,
  );
});

test('accepts the exact compiler aggregate set as a predecessor', () => {
  const members = compiledAggregatePredecessorMembers();
  const validated = validateCanonicalPredecessorBundleMembers(members);
  assert.equal(validated.members.length, REQUIRED_BUNDLE_KINDS.length);
  assert.deepEqual(
    validated.source_kinds,
    REQUIRED_BUNDLE_KINDS.map(() => 'CANONICAL_AGGREGATE'),
  );
  assert.equal(canonicalJson(validated.members), canonicalJson(members));
});

test('rejects a recognised aggregate that is not exact compiler output', () => {
  const members = clone(compiledAggregatePredecessorMembers());
  const member = members[0];
  const source = JSON.parse(
    Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
  );
  source.ordered_authored_members = source.ordered_authored_members.map(
    (entry) => ({
      authored_identity: entry.authored_identity,
      ordered_dependency_identities: entry.ordered_dependency_identities,
    }),
  );
  resealAggregateSource(member, source);
  assertSourceClosureError(
    'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_AGGREGATE_SET',
    () => validateCanonicalPredecessorBundleMembers(members),
  );
});

test('rejects aggregate value, identity, dependency order, closure and cycle drift', () => {
  const cases = [
    (members) => {
      const source = aggregateSource(members[0]);
      source.ordered_authored_members[0].canonical_value.legal_meaning =
        'DRIFTED_MEANING';
      resealAggregateSource(members[0], source);
    },
    (members) => {
      const source = aggregateSource(members[0]);
      source.ordered_authored_members.push(
        clone(source.ordered_authored_members[0]),
      );
      resealAggregateSource(members[0], source);
    },
    (members) => {
      const source = aggregateSource(members[0]);
      const dependencies = [
        aggregateSource(members[1]).ordered_authored_members[0].authored_identity,
        aggregateSource(members[2]).ordered_authored_members[0].authored_identity,
      ].sort((left, right) => canonicalJson(right).localeCompare(canonicalJson(left)));
      source.ordered_authored_members[0].ordered_dependency_identities =
        dependencies;
      resealAggregateSource(members[0], source);
    },
    (members) => {
      const source = aggregateSource(members[0]);
      const unresolved = clone(
        source.ordered_authored_members[0].authored_identity,
      );
      unresolved.stable_id = 'UNRESOLVED_PREDECESSOR_IDENTITY';
      source.ordered_authored_members[0].ordered_dependency_identities = [
        unresolved,
      ];
      resealAggregateSource(members[0], source);
    },
    (members) => {
      const firstSource = aggregateSource(members[0]);
      const secondSource = aggregateSource(members[1]);
      const firstIdentity =
        firstSource.ordered_authored_members[0].authored_identity;
      const secondIdentity =
        secondSource.ordered_authored_members[0].authored_identity;
      firstSource.ordered_authored_members[0].ordered_dependency_identities = [
        secondIdentity,
      ];
      secondSource.ordered_authored_members[0].ordered_dependency_identities = [
        firstIdentity,
      ];
      resealAggregateSource(members[0], firstSource);
      resealAggregateSource(members[1], secondSource);
    },
  ];
  for (const mutate of cases) {
    const members = clone(compiledAggregatePredecessorMembers());
    mutate(members);
    assertSourceClosureError(
      'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_AGGREGATE_SET',
      () => validateCanonicalPredecessorBundleMembers(members),
    );
  }
});

test('assembles a deterministic review package with full predecessor bytes', () => {
  const input = fixture();
  const first = assembleCanonicalContractBundlePreReviewSourceClosure(input);
  const second =
    assembleCanonicalContractBundlePreReviewSourceClosure(clone(input));
  const review = first.exact_review_package;
  const predecessorMember =
    review.predecessor_canonical_contract_bundle_members[0];

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(
    first.exact_review_package_fingerprint,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V2',
      review,
    ),
  );
  assert.equal(
    predecessorMember.source_bytes_base64,
    compileLegacyF1CanonicalContractBundleMember().source_bytes_base64,
  );
  assert.deepEqual(review.predecessor_contract_bundle_projection, [{
    member_key: predecessorMember.member_key,
    semantic_digest: predecessorMember.semantic_digest,
    identity_digest: predecessorMember.identity_digest,
  }]);
  assert.equal(
    review.predecessor_contract_bundle_digest,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
      review.predecessor_contract_bundle_projection,
    ),
  );
  assert.deepEqual(review.predecessor_source_kinds, ['LEGACY_F1']);
  assert.equal(
    review.contract_bundle_freeze_candidate
      .unsigned_contract_bundle_compilation_receipt_payload
      .frozen_contract_pair_digest,
    review.frozen_contract_pair_digest,
  );
  assert.equal(
    validateSchema(
      'ContractFreezeAttestationIdentity/V1',
      review.contract_freeze_attestation_identity,
    ),
    true,
  );
  assert.equal(
    review.contract_freeze_attestation_identity
      .predecessor_canonical_contract_bundle_member_root,
    domainDigest(
      'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
      review.predecessor_canonical_contract_bundle_members,
    ),
  );
  assert.equal(
    review.contract_freeze_attestation_identity
      .predecessor_canonical_contract_bundle_member_count,
    review.predecessor_canonical_contract_bundle_members.length,
  );
  assert.equal(
    review.reviewed_contract_source_set_digest,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_SOURCE_SET/V1',
      {
        exact_review_input_schema_version:
          'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2',
        predecessor_canonical_contract_bundle_members:
          review.predecessor_canonical_contract_bundle_members,
        canonical_contract_bundle_members:
          review.canonical_contract_bundle_members,
      },
    ),
  );
  assert.equal(
    review.exact_review_input_context_digest,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
      {
        specification_root: review.specification_root,
        code_commit: review.code_commit,
        predecessor_contract_bundle_id:
          review.predecessor_contract_bundle_id,
        predecessor_contract_bundle_digest:
          review.predecessor_contract_bundle_digest,
        contract_bundle_id: review.contract_bundle_id,
        contract_bundle_digest: review.contract_bundle_digest,
        frozen_contract_pair_digest: review.frozen_contract_pair_digest,
        semantic_identity_diff_digest:
          review.semantic_identity_diff_digest,
        reviewed_contract_source_set_digest:
          review.reviewed_contract_source_set_digest,
      },
    ),
  );
  assert.equal(first.disposition.state, 'PRE_REVIEW_SOURCE_CLOSED_NOT_REVIEWED');
  assert.equal(first.disposition.ben_approval, 'NOT_SUPPLIED');
  assert.equal(first.disposition.freeze_authority, 'NONE');
});

test('rejects changed predecessor bytes, length and payload digest', () => {
  const bytes = fixture();
  bytes.predecessor_canonical_contract_bundle_members[0].source_bytes_base64 =
    Buffer.from('changed', 'utf8').toString('base64');
  assertSourceClosureError(
    'PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_SOURCE_DRIFT',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(bytes),
  );

  const length = fixture();
  length.predecessor_canonical_contract_bundle_members[0].byte_length += 1;
  assertSourceClosureError(
    'PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_SOURCE_DRIFT',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(length),
  );

  const digest = fixture();
  digest.predecessor_canonical_contract_bundle_members[0].payload_digest =
    'f'.repeat(64);
  assertSourceClosureError(
    'PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_SOURCE_DRIFT',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(digest),
  );
});

test('rejects forged semantic and identity projection digests', () => {
  const semantic = fixture();
  semantic.predecessor_canonical_contract_bundle_members[0].semantic_digest =
    'a'.repeat(64);
  assertSourceClosureError(
    'UNRECOGNISED_LEGACY_PREDECESSOR_CONTRACT',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(semantic),
  );

  const identityDrift = fixture();
  identityDrift.predecessor_canonical_contract_bundle_members[0].identity_digest =
    'b'.repeat(64);
  assertSourceClosureError(
    'UNRECOGNISED_LEGACY_PREDECESSOR_CONTRACT',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(identityDrift),
  );
});

test('rejects non-canonical predecessor JSON even when its raw digest matches', () => {
  const input = fixture();
  const member = input.predecessor_canonical_contract_bundle_members[0];
  const source = Buffer.from(member.source_bytes_base64, 'base64').toString('utf8');
  const nonCanonical = Buffer.from(`${source}\n`, 'utf8');
  member.byte_length = nonCanonical.length;
  member.payload_digest = sha256Hex(nonCanonical);
  member.source_bytes_base64 = nonCanonical.toString('base64');
  assertSourceClosureError(
    'NON_CANONICAL_PREDECESSOR_CONTRACT_BUNDLE_MEMBER_BYTES',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(input),
  );
});

test('refuses later fixture versions as formal legacy predecessors', () => {
  const f1 = compileLegacyF1CanonicalContractBundleMember();
  const f2Bundle = compileFixtureContractV2();
  assert.equal(f2Bundle.fingerprint, FIXTURE_CONTRACT_FINGERPRINT_V2);
  assert.notEqual(f2Bundle.fingerprint, LEGACY_F1_CONTRACT_FINGERPRINT);
  const bytes = Buffer.from(canonicalJson(f2Bundle), 'utf8');
  const forgedF2Member = {
    ...clone(f1),
    byte_length: bytes.length,
    payload_digest: sha256Hex(bytes),
    source_bytes_base64: bytes.toString('base64'),
    semantic_digest: f2Bundle.fingerprint,
  };
  assertSourceClosureError(
    'UNRECOGNISED_LEGACY_PREDECESSOR_CONTRACT',
    () => validateCanonicalPredecessorBundleMembers([forgedF2Member]),
  );
});

test('rejects duplicate, unordered and mixed legacy predecessor sets', () => {
  const duplicate = fixture();
  duplicate.predecessor_canonical_contract_bundle_members.push(
    clone(duplicate.predecessor_canonical_contract_bundle_members[0]),
  );
  assertSourceClosureError(
    'INVALID_PREDECESSOR_CANONICAL_CONTRACT_BUNDLE_MEMBER_ORDER',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(duplicate),
  );

  const mixed = fixture();
  const second = clone(mixed.predecessor_canonical_contract_bundle_members[0]);
  second.member_key = 'ZZZ_LEGACY_COPY';
  second.identity_digest = 'a'.repeat(64);
  mixed.predecessor_canonical_contract_bundle_members.push(second);
  assertSourceClosureError(
    'UNRECOGNISED_LEGACY_PREDECESSOR_CONTRACT',
    () => assembleCanonicalContractBundlePreReviewSourceClosure(mixed),
  );
});

test('rejects caller projection, authority, review, approval and status fields', () => {
  for (const field of [
    'predecessor_contract_bundle_projection',
    'authority_manifest',
    'review_conclusion',
    'ben_approval',
    'signature',
    'programme_status',
  ]) {
    const input = fixture();
    input[field] = {};
    assertSourceClosureError(
      'INVALID_PRE_REVIEW_SOURCE_CLOSURE_INPUT',
      () => assembleCanonicalContractBundlePreReviewSourceClosure(input),
    );
  }
});
