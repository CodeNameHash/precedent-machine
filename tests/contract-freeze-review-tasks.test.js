const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  REQUIRED_BUNDLE_KINDS,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const { domainDigest } = require('../lib/programme-gates/bytes');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('../lib/programme-gates/git-authorship');
const {
  P1_CONTRACT_FREEZE_REVIEW_LANES,
  ContractFreezeReviewTaskError,
  createP1ContractFreezeReviewRequest,
  validateP1ContractFreezeReviewResults,
} = require('../lib/programme-gates/contract-freeze-review-tasks');
const { checkAllowlist } = require('../scripts/ci/check-allowlist');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-p1-contract-freeze-reviews.mjs');
const GENERATOR = path.join(
  ROOT,
  'scripts/generate-canonical-contract-current-review.mjs',
);
const ALLOWLIST = path.join(
  ROOT,
  '.github/phase-allowlists/wp-p1-contract-freeze-review-controller-v1.json',
);
const CODE_COMMIT = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const GIT_RUNTIME = Object.freeze({ repositoryRoot: ROOT });
const AUTHORSHIP_EVENTS = enumerateCompleteGitAuthorshipUniverse({
  repositoryRoot: ROOT,
  expectedCommit: CODE_COMMIT,
});
const AUTHORSHIP_ROOT = domainDigest(
  'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
  AUTHORSHIP_EVENTS,
);
const DIGEST = (value) => sha256Hex(Buffer.from(value, 'utf8'));

let closurePromise;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function packageValue(input) {
  return JSON.parse(
    Buffer.from(input.exact_review_package_bytes_base64, 'base64').toString('utf8'),
  );
}

function resealPackage(input, value) {
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  input.exact_review_package_bytes_base64 = bytes.toString('base64');
  input.exact_review_package_fingerprint = contentId(
    'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V2',
    value,
  );
}

function resealCandidate(candidate) {
  const payload = Object.fromEntries(Object.entries(candidate).filter(
    ([key]) => !['schema_version', 'freeze_candidate_payload_digest'].includes(key),
  ));
  candidate.freeze_candidate_payload_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_FREEZE_CANDIDATE_PAYLOAD/V1',
    payload,
  );
}

function withoutKeys(value, keys) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
}

function resealCoordinatedGeneratedSubstitution(input, reviewPackage) {
  const candidate = reviewPackage.contract_bundle_freeze_candidate;
  const topology = candidate.generated_contract_topology;
  const oldMember = topology.generated_contract_bundle_members.find(
    (entry) => entry.object_type === 'SEMANTIC_STAGE_REGISTRY',
  );
  assert.ok(oldMember, 'generated topology must retain its semantic-stage registry');
  const registry = JSON.parse(
    Buffer.from(oldMember.source_bytes_base64, 'base64').toString('utf8'),
  );
  const changedStage = registry.ordered_stage_contracts[0];
  changedStage.maximum_output_cardinality += 1;
  changedStage.semantic_stage_contract_digest = contentId(
    'SEMANTIC_STAGE_CONTRACT/V1',
    withoutKeys(changedStage, ['semantic_stage_contract_digest']),
  );
  const registryPayload = withoutKeys(registry, [
    'semantic_stage_registry_id',
    'canonical_payload_digest',
  ]);
  registry.semantic_stage_registry_id = contentId(
    'SEMANTIC_STAGE_REGISTRY_ID/V1',
    registryPayload,
  );
  registry.canonical_payload_digest = contentId(
    'SEMANTIC_STAGE_REGISTRY_PAYLOAD/V1',
    registryPayload,
  );
  const registryBytes = Buffer.from(canonicalJson(registry), 'utf8');
  const changedMember = {
    ...oldMember,
    member_key: `GENERATED/${registry.semantic_stage_registry_id.toUpperCase()}`,
    generated_id: registry.semantic_stage_registry_id,
    byte_length: registryBytes.length,
    payload_digest: sha256Hex(registryBytes),
    source_bytes_base64: registryBytes.toString('base64'),
    semantic_digest: contentId(
      'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_SEMANTIC/V1',
      registry,
    ),
  };
  changedMember.identity_digest = contentId(
    'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_IDENTITY/V1',
    {
      member_key: changedMember.member_key,
      generated_id: changedMember.generated_id,
      canonical_payload_digest: registry.canonical_payload_digest,
    },
  );

  topology.semantic_stage_registry = registry;
  topology.generated_contract_bundle_members =
    topology.generated_contract_bundle_members
      .map((entry) => (
        entry.member_key === oldMember.member_key ? changedMember : entry
      ))
      .sort((left, right) => left.member_key.localeCompare(right.member_key));
  topology.generated_contract_bundle_projection =
    topology.generated_contract_bundle_members.map((entry) => ({
      member_key: entry.member_key,
      semantic_digest: entry.semantic_digest,
      identity_digest: entry.identity_digest,
    }));
  topology.generated_contract_bundle_member_root = contentId(
    'CANONICAL_GENERATED_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    topology.generated_contract_bundle_members,
  );

  const manifest = topology.generated_output_manifest;
  manifest.ordered_outputs = topology.generated_contract_bundle_members
    .map((entry) => {
      const value = JSON.parse(
        Buffer.from(entry.source_bytes_base64, 'base64').toString('utf8'),
      );
      return {
        object_type: entry.object_type,
        generated_id: entry.generated_id,
        canonical_payload_digest: value.canonical_payload_digest,
      };
    })
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  manifest.generated_member_root =
    topology.generated_contract_bundle_member_root;
  manifest.generated_member_count =
    topology.generated_contract_bundle_members.length;
  manifest.output_count = manifest.ordered_outputs.length;
  const manifestPayload = withoutKeys(manifest, [
    'generated_output_manifest_id',
    'canonical_payload_digest',
  ]);
  manifest.generated_output_manifest_id = contentId(
    'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST_ID/V1',
    manifestPayload,
  );
  manifest.canonical_payload_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_GENERATED_OUTPUT_MANIFEST_PAYLOAD/V1',
    manifestPayload,
  );

  const finalBundle = topology.final_canonical_contract_bundle;
  finalBundle.generated_output_manifest = clone(manifest);
  finalBundle.ordered_generated_member_projection =
    clone(topology.generated_contract_bundle_projection);
  const finalPayload = withoutKeys(finalBundle, [
    'canonical_contract_bundle_id',
    'canonical_contract_bundle_fingerprint',
  ]);
  finalBundle.canonical_contract_bundle_id = contentId(
    'CANONICAL_CONTRACT_BUNDLE_ID/V3',
    finalPayload,
  );
  finalBundle.canonical_contract_bundle_fingerprint = contentId(
    'CANONICAL_CONTRACT_BUNDLE/V3',
    finalPayload,
  );
  topology.canonical_payload_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_GENERATED_TOPOLOGY_PAYLOAD/V2',
    withoutKeys(topology, ['schema_version', 'canonical_payload_digest']),
  );

  const generatedProjection = topology.generated_contract_bundle_projection;
  const combinedProjection = [
    ...reviewPackage.aggregate_canonical_contract_bundle_projection,
    ...generatedProjection,
  ].sort((left, right) => left.member_key.localeCompare(right.member_key));
  const memberRoot = contentId(
    'CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V3',
    {
      aggregate_members: reviewPackage.canonical_contract_bundle_members,
      generated_members: topology.generated_contract_bundle_members,
    },
  );
  reviewPackage.generated_contract_bundle_members =
    clone(topology.generated_contract_bundle_members);
  reviewPackage.canonical_contract_bundle_projection = combinedProjection;
  reviewPackage.contract_bundle_id =
    finalBundle.canonical_contract_bundle_id;
  reviewPackage.contract_bundle_digest =
    finalBundle.canonical_contract_bundle_fingerprint;

  const predecessorByKey = new Map(
    reviewPackage.predecessor_contract_bundle_projection.map(
      (entry) => [entry.member_key, entry],
    ),
  );
  const successorByKey = new Map(
    combinedProjection.map((entry) => [entry.member_key, entry]),
  );
  const sharedKeys = [...predecessorByKey.keys()].filter(
    (key) => successorByKey.has(key),
  );
  reviewPackage.semantic_identity_diff = {
    predecessor_contract_bundle_id:
      reviewPackage.predecessor_contract_bundle_id,
    successor_contract_bundle_id: reviewPackage.contract_bundle_id,
    added_member_keys: [...successorByKey.keys()].filter(
      (key) => !predecessorByKey.has(key),
    ),
    removed_member_keys: [...predecessorByKey.keys()].filter(
      (key) => !successorByKey.has(key),
    ),
    semantic_changed_member_keys: sharedKeys.filter((key) => (
      predecessorByKey.get(key).semantic_digest
        !== successorByKey.get(key).semantic_digest
    )),
    identity_changed_member_keys: sharedKeys.filter((key) => (
      predecessorByKey.get(key).identity_digest
        !== successorByKey.get(key).identity_digest
    )),
  };
  reviewPackage.semantic_identity_diff_digest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    reviewPackage.semantic_identity_diff,
  );

  const identity = reviewPackage.contract_freeze_attestation_identity;
  identity.contract_bundle_id = reviewPackage.contract_bundle_id;
  identity.contract_bundle_digest = reviewPackage.contract_bundle_digest;
  identity.contract_freeze_attestation_id = domainDigest(
    'PROGRAMME_GATE_CONTRACT_FREEZE_ATTESTATION_ID/V1',
    withoutKeys(identity, ['contract_freeze_attestation_id']),
  );
  const pairDigest = domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id:
        reviewPackage.predecessor_contract_bundle_id,
      predecessor_contract_bundle_digest:
        reviewPackage.predecessor_contract_bundle_digest,
      successor_contract_bundle_id: reviewPackage.contract_bundle_id,
      successor_contract_bundle_digest: reviewPackage.contract_bundle_digest,
      contract_freeze_attestation_id:
        identity.contract_freeze_attestation_id,
    },
  );
  reviewPackage.frozen_contract_pair_digest = pairDigest;

  candidate.generated_contract_bundle_members =
    clone(topology.generated_contract_bundle_members);
  candidate.canonical_contract_bundle_projection = clone(combinedProjection);
  candidate.generated_contract_topology = topology;
  candidate.contract_bundle_id = reviewPackage.contract_bundle_id;
  candidate.contract_bundle_digest = reviewPackage.contract_bundle_digest;
  candidate.canonical_contract_bundle_member_root = memberRoot;
  const topologyOutput = candidate.generated_output_inventory.find(
    (entry) => entry.path
      === 'generated/canonical-contract-bundle/generated-topology.json',
  );
  assert.ok(topologyOutput, 'freeze candidate must inventory its generated topology');
  topologyOutput.payload_digest = sha256Hex(
    Buffer.from(canonicalJson(topology), 'utf8'),
  );
  const receipt = candidate.unsigned_contract_bundle_compilation_receipt_payload;
  receipt.contract_bundle_id = candidate.contract_bundle_id;
  receipt.contract_bundle_digest = candidate.contract_bundle_digest;
  receipt.frozen_contract_pair_digest = pairDigest;
  receipt.generated_outputs = clone(candidate.generated_output_inventory);
  receipt.canonical_contract_bundle_member_root = memberRoot;
  receipt.canonical_contract_bundle_member_count =
    reviewPackage.canonical_contract_bundle_members.length
      + topology.generated_contract_bundle_members.length;
  resealCandidate(candidate);

  reviewPackage.reviewed_contract_source_set_digest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_SOURCE_SET/V1',
    {
      exact_review_input_schema_version:
        'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2',
      canonical_contract_bundle_compiler_input:
        reviewPackage.canonical_contract_bundle_compiler_input,
      governed_topology_input_identity:
        reviewPackage.governed_topology_input_identity,
      predecessor_canonical_contract_bundle_members:
        reviewPackage.predecessor_canonical_contract_bundle_members,
      canonical_contract_bundle_members:
        reviewPackage.canonical_contract_bundle_members,
      generated_contract_bundle_members:
        reviewPackage.generated_contract_bundle_members,
    },
  );
  reviewPackage.exact_review_input_context_digest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: reviewPackage.specification_root,
      code_commit: input.code_commit,
      predecessor_contract_bundle_id:
        reviewPackage.predecessor_contract_bundle_id,
      predecessor_contract_bundle_digest:
        reviewPackage.predecessor_contract_bundle_digest,
      contract_bundle_id: reviewPackage.contract_bundle_id,
      contract_bundle_digest: reviewPackage.contract_bundle_digest,
      frozen_contract_pair_digest: pairDigest,
      semantic_identity_diff_digest:
        reviewPackage.semantic_identity_diff_digest,
      reviewed_contract_source_set_digest:
        reviewPackage.reviewed_contract_source_set_digest,
    },
  );
  input.frozen_contract_pair_digest = pairDigest;
  input.source_closure_identity = clone(identity);
  resealPackage(input, reviewPackage);
}

function resealGoverningMember(record, { bytes, memberPath = record.path }) {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const unsigned = {
    schema_version: 'ContractFreezeGoverningSpecificationMember/V1',
    path: memberPath,
    byte_length: source.length,
    payload_digest: sha256Hex(source),
    source_bytes_base64: source.toString('base64'),
  };
  return {
    ...unsigned,
    specification_member_id: domainDigest(
      'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
      unsigned,
    ),
  };
}

async function exactSourceClosure() {
  if (!closurePromise) {
    closurePromise = import(pathToFileURL(GENERATOR).href).then(
      ({ generateReviewSourceClosure }) => JSON.parse(
        generateReviewSourceClosure({
          repositoryRoot: ROOT,
          codeCommit: CODE_COMMIT,
          approvalEpochNonce: 'p1-review-controller-remediation-1',
        }).toString('utf8'),
      ),
    );
  }
  return clone(await closurePromise);
}

async function makeExactReviewInput() {
  const closure = await exactSourceClosure();
  const reviewPackage = closure.exact_review_package;
  const packageBytes = Buffer.from(canonicalJson(reviewPackage), 'utf8');
  const reviewerBindings = P1_CONTRACT_FREEZE_REVIEW_LANES.map(
    (lane, index) => {
      const reviewerIdentity = `p1-reviewer-${index + 1}@example.invalid`;
      return {
        lane_id: lane.lane_id,
        reviewer_role: lane.reviewer_role,
        reviewer_principal_id: `p1-reviewer-principal-${index + 1}`,
        reviewer_identity: reviewerIdentity,
        reviewer_model_identifier: 'gpt-5.6-sol',
        reasoning_level: 'high',
        reviewer_source_control_identity_set: [
          reviewerIdentity,
          `p1-reviewer-alias-${index + 1}@example.invalid`,
        ],
        reviewer_eligibility_digest: DIGEST(`eligibility-${index + 1}`),
        review_disposition_id: DIGEST(`disposition-${index + 1}`),
        independence_binding: {
          immutable_session_id: `p1-review-session-${index + 1}`,
          session_parent_or_genesis: 'GENESIS',
          source_control_history_scope:
            'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS',
          reviewed_code_commit: CODE_COMMIT,
          source_control_authorship_events: clone(AUTHORSHIP_EVENTS),
          source_control_authorship_event_set_root: AUTHORSHIP_ROOT,
          prior_conclusion_input_set: [],
          reviewer_edit_set: [],
        },
      };
    },
  );
  return {
    schema_version: 'P1ContractFreezeReviewRequestInput/V1',
    exact_review_package_fingerprint: closure.exact_review_package_fingerprint,
    exact_review_package_bytes_base64: packageBytes.toString('base64'),
    code_commit: CODE_COMMIT,
    frozen_contract_pair_digest: reviewPackage.frozen_contract_pair_digest,
    source_closure_identity:
      clone(reviewPackage.contract_freeze_attestation_identity),
    reviewer_bindings: reviewerBindings,
  };
}

function createRequest(input) {
  return createP1ContractFreezeReviewRequest(input, {
    gitRuntime: GIT_RUNTIME,
  });
}

function validateResults(request, results) {
  return validateP1ContractFreezeReviewResults({
    request,
    results,
    gitRuntime: GIT_RUNTIME,
  });
}

function resultFor(task, disposition = 'PASS', findings = []) {
  return {
    schema_version: 'P1ContractFreezeReviewResult/V1',
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    lane_id: task.lane_id,
    task_id: task.task_id,
    exact_review_package_fingerprint:
      task.exact_review_input.exact_review_package_fingerprint,
    exact_review_package_payload_digest:
      task.exact_review_input.exact_review_package_payload_digest,
    code_commit: task.exact_review_input.code_commit,
    frozen_contract_pair_digest:
      task.exact_review_input.frozen_contract_pair_digest,
    contract_freeze_attestation_id:
      task.exact_review_input.contract_freeze_attestation_id,
    review_disposition_id:
      task.reviewer_binding.review_disposition_id,
    reviewer_principal_id:
      task.reviewer_binding.reviewer_principal_id,
    reviewer_identity: task.reviewer_binding.reviewer_identity,
    reviewer_role: task.reviewer_binding.reviewer_role,
    reviewer_model_identifier:
      task.reviewer_binding.reviewer_model_identifier,
    reasoning_level: task.reviewer_binding.reasoning_level,
    immutable_session_id:
      task.reviewer_binding.independence_binding.immutable_session_id,
    independence_binding_digest: task.independence_binding_digest,
    disposition,
    findings,
  };
}

function expectCode(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error instanceof ContractFreezeReviewTaskError, true);
    assert.equal(error.code, code);
    return true;
  });
}

test('creates three deterministic tasks from the real source-closed compiler bundle', async () => {
  const input = await makeExactReviewInput();
  const first = createRequest(input);
  const second = createRequest(input);
  const reviewPackage = packageValue(input);
  assert.deepEqual(first, second);
  assert.deepEqual(
    reviewPackage.canonical_contract_bundle_members.map(
      (member) => member.member_kind,
    ),
    REQUIRED_BUNDLE_KINDS,
  );
  assert.equal(reviewPackage.generated_contract_bundle_members.length > 0, true);
  assert.equal(
    reviewPackage.canonical_contract_bundle_projection.length,
    reviewPackage.canonical_contract_bundle_members.length
      + reviewPackage.generated_contract_bundle_members.length,
  );
  assert.equal(
    reviewPackage.contract_bundle_freeze_candidate.schema_version,
    'CANONICAL_CONTRACT_BUNDLE_FREEZE_CANDIDATE/V1',
  );
  assert.deepEqual(
    first.tasks.map((task) => task.formal_record_schema_id),
    [
      'ContractFreezeAuthorityEvidence/V1',
      'ContractFreezeAuthorityEvidence/V1',
      'ContractDiffReviewAttestation/V1',
    ],
  );
  for (const task of first.tasks) {
    assert.equal(task.reviewer_binding.reviewer_model_identifier, 'gpt-5.6-sol');
    assert.equal(task.reviewer_binding.reasoning_level, 'high');
    assert.match(task.prompt, /exact file, exact rule, and required correction/);
    assert.equal(task.output_contract.gate_authority, 'NONE');
  }
  assert.equal(first.disposition.state, 'TASKS_CREATED_NOT_REVIEWED');
});

test('uses the canonical governing-specification compiler against hostile sources', async () => {
  const mutations = [
    (reviewPackage) => {
      const records = reviewPackage.governing_specification_member_records;
      records[1] = resealGoverningMember(records[1], {
        bytes: Buffer.from(records[1].source_bytes_base64, 'base64'),
        memberPath: records[2].path,
      });
    },
    (reviewPackage) => {
      const records = reviewPackage.governing_specification_member_records;
      records[1] = resealGoverningMember(records[1], {
        bytes: Buffer.from(records[1].source_bytes_base64, 'base64'),
        memberPath: 'docs/codex-program/substituted-member.md',
      });
    },
    (reviewPackage) => {
      const records = reviewPackage.governing_specification_member_records;
      records[1] = resealGoverningMember(records[1], {
        bytes: Buffer.from(records[1].source_bytes_base64, 'base64'),
        memberPath: '../outside.md',
      });
    },
    (reviewPackage) => {
      const records = reviewPackage.governing_specification_member_records;
      records[0] = resealGoverningMember(records[0], {
        bytes: 'not-json',
      });
    },
    (reviewPackage) => {
      const records = reviewPackage.governing_specification_member_records;
      records[1] = resealGoverningMember(records[1], {
        bytes: Buffer.concat([
          Buffer.from(records[1].source_bytes_base64, 'base64'),
          Buffer.from('\nsubstitution\n', 'utf8'),
        ]),
      });
    },
  ];
  for (const mutate of mutations) {
    const input = await makeExactReviewInput();
    const reviewPackage = packageValue(input);
    mutate(reviewPackage);
    resealPackage(input, reviewPackage);
    expectCode(
      'INVALID_GOVERNING_SPECIFICATION_SOURCE_CLOSURE',
      () => createRequest(input),
    );
  }
});

test('rejects missing kinds, substituted keys, and self-consistent non-compiler aggregates', async () => {
  const missing = await makeExactReviewInput();
  const missingPackage = packageValue(missing);
  missingPackage.canonical_contract_bundle_members.pop();
  resealPackage(missing, missingPackage);
  expectCode(
    'INVALID_EXACT_COMPILER_AGGREGATE_SET',
    () => createRequest(missing),
  );

  const substituted = await makeExactReviewInput();
  const substitutedPackage = packageValue(substituted);
  substitutedPackage.canonical_contract_bundle_members[0].member_key =
    'SUBSTITUTED_KEY';
  resealPackage(substituted, substitutedPackage);
  expectCode(
    'INVALID_EXACT_COMPILER_AGGREGATE_SET',
    () => createRequest(substituted),
  );

  const selfConsistent = await makeExactReviewInput();
  const selfConsistentPackage = packageValue(selfConsistent);
  const member = selfConsistentPackage.canonical_contract_bundle_members.find(
    (entry) => JSON.parse(
      Buffer.from(entry.source_bytes_base64, 'base64').toString('utf8'),
    ).ordered_authored_members.length > 1,
  );
  assert.ok(member, 'real compiler bundle must include a multi-member aggregate');
  const source = JSON.parse(
    Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
  );
  source.ordered_authored_members.reverse();
  const bytes = Buffer.from(canonicalJson(source), 'utf8');
  member.byte_length = bytes.length;
  member.payload_digest = sha256Hex(bytes);
  member.source_bytes_base64 = bytes.toString('base64');
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
  resealPackage(selfConsistent, selfConsistentPackage);
  expectCode(
    'INVALID_EXACT_COMPILER_AGGREGATE_SET',
    () => createRequest(selfConsistent),
  );
});

test('validates the complete freeze-candidate reports, inventory, roots and receipt', async () => {
  const mutations = [
    (candidate) => {
      candidate.unregistered_field = true;
    },
    (candidate) => {
      candidate.canonical_contract_bundle_member_root = DIGEST('wrong-root');
      resealCandidate(candidate);
    },
    (candidate) => {
      candidate.compile_report.missing_member_count = 1;
      candidate.compile_report_digest = contentId(
        'CANONICAL_CONTRACT_BUNDLE_COMPILE_REPORT_DIGEST/V1',
        candidate.compile_report,
      );
      resealCandidate(candidate);
    },
    (candidate) => {
      candidate.generated_output_inventory.pop();
      resealCandidate(candidate);
    },
    (candidate) => {
      candidate.generated_contract_bundle_members.pop();
      resealCandidate(candidate);
    },
    (candidate) => {
      candidate.unsigned_contract_bundle_compilation_receipt_payload
        .canonical_contract_bundle_member_root = DIGEST('wrong-receipt-root');
      resealCandidate(candidate);
    },
  ];
  for (const mutate of mutations) {
    const input = await makeExactReviewInput();
    const reviewPackage = packageValue(input);
    mutate(reviewPackage.contract_bundle_freeze_candidate);
    resealPackage(input, reviewPackage);
    expectCode('INVALID_FREEZE_CANDIDATE', () => createRequest(input));
  }
});

test('rejects a self-resealed generated-member substitution', async () => {
  const input = await makeExactReviewInput();
  const reviewPackage = packageValue(input);
  const member = reviewPackage.generated_contract_bundle_members[0];
  const source = JSON.parse(
    Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'),
  );
  source.hostile_substitution = true;
  const bytes = Buffer.from(canonicalJson(source), 'utf8');
  member.byte_length = bytes.length;
  member.payload_digest = sha256Hex(bytes);
  member.source_bytes_base64 = bytes.toString('base64');
  resealPackage(input, reviewPackage);
  expectCode(
    'INVALID_EXACT_GENERATED_MEMBER_SET',
    () => createRequest(input),
  );
});

test('rejects a coordinated self-resealed generated-topology substitution', async () => {
  const input = await makeExactReviewInput();
  const reviewPackage = packageValue(input);
  resealCoordinatedGeneratedSubstitution(input, reviewPackage);
  expectCode(
    'INDEPENDENT_GENERATED_TOPOLOGY_MISMATCH',
    () => createRequest(input),
  );
});

test('requires exact distinct reviewer identities and disposition mappings', async () => {
  const absent = await makeExactReviewInput();
  absent.reviewer_bindings[0].reviewer_identity =
    'absent-reviewer@example.invalid';
  expectCode(
    'INVALID_P1_REVIEWER_IDENTITY_BINDING',
    () => createRequest(absent),
  );

  const overlap = await makeExactReviewInput();
  overlap.reviewer_bindings[1].reviewer_source_control_identity_set.push(
    overlap.reviewer_bindings[0].reviewer_source_control_identity_set[0],
  );
  expectCode(
    'OVERLAPPING_P1_REVIEWER_IDENTITY_SETS',
    () => createRequest(overlap),
  );

  const duplicateDisposition = await makeExactReviewInput();
  duplicateDisposition.reviewer_bindings[1].review_disposition_id =
    duplicateDisposition.reviewer_bindings[0].review_disposition_id;
  expectCode(
    'DUPLICATE_P1_REVIEWER',
    () => createRequest(duplicateDisposition),
  );
});

test('recomputes complete Git ancestry and rejects a self-rehashed omission', async () => {
  assert.ok(AUTHORSHIP_EVENTS.length > 1);
  const input = await makeExactReviewInput();
  const binding = input.reviewer_bindings[0].independence_binding;
  binding.source_control_authorship_events.shift();
  binding.source_control_authorship_event_set_root = domainDigest(
    'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
    binding.source_control_authorship_events,
  );
  expectCode(
    'INCOMPLETE_P1_REVIEWER_ANCESTRY',
    () => createRequest(input),
  );

  const authored = await makeExactReviewInput();
  authored.reviewer_bindings[0].reviewer_source_control_identity_set.push(
    AUTHORSHIP_EVENTS[0].identity_set[0],
  );
  expectCode(
    'NON_INDEPENDENT_P1_REVIEWER',
    () => createRequest(authored),
  );
});

test('rejects wrong package, P1 lanes, reviewer role, model and reasoning', async () => {
  const wrongFingerprint = await makeExactReviewInput();
  wrongFingerprint.exact_review_package_fingerprint = DIGEST('wrong');
  expectCode(
    'EXACT_REVIEW_PACKAGE_FINGERPRINT_MISMATCH',
    () => createRequest(wrongFingerprint),
  );

  const wrongCode = await makeExactReviewInput();
  wrongCode.code_commit = 'f'.repeat(40);
  expectCode(
    'INCOMPLETE_P1_REVIEWER_ANCESTRY',
    () => createRequest(wrongCode),
  );

  const wrongPair = await makeExactReviewInput();
  wrongPair.frozen_contract_pair_digest = DIGEST('wrong-pair');
  expectCode(
    'FROZEN_CONTRACT_PAIR_MISMATCH',
    () => createRequest(wrongPair),
  );

  const missingLane = await makeExactReviewInput();
  missingLane.reviewer_bindings.pop();
  expectCode(
    'INVALID_P1_REVIEW_LANE_SET',
    () => createRequest(missingLane),
  );

  const duplicateLane = await makeExactReviewInput();
  duplicateLane.reviewer_bindings[1] = clone(
    duplicateLane.reviewer_bindings[0],
  );
  expectCode(
    'INVALID_P1_REVIEW_LANE_SET',
    () => createRequest(duplicateLane),
  );

  const g0 = await makeExactReviewInput();
  g0.reviewer_bindings[0].lane_id = 'G0_LEGAL_SEMANTIC';
  expectCode('P1_G0_SCOPE_CONFUSION', () => createRequest(g0));

  for (const [field, value, code] of [
    ['reviewer_role', 'G0_COLD_REVIEWER', 'INVALID_P1_REVIEW_LANE_SET'],
    ['reviewer_model_identifier', 'gpt-5.4', 'INVALID_P1_REVIEWER_RUNTIME'],
    ['reasoning_level', 'provider_default', 'INVALID_P1_REVIEWER_RUNTIME'],
  ]) {
    const input = await makeExactReviewInput();
    input.reviewer_bindings[0][field] = value;
    expectCode(code, () => createRequest(input));
  }
});

test('returns typed blocked state because no signed P1 registration exists', async () => {
  const request = createRequest(await makeExactReviewInput());
  const results = request.tasks.map((task) => resultFor(task));
  const validation = validateResults(request, results);
  assert.equal(validation.validation_state, 'BLOCKED');
  assert.equal(
    validation.reason_code,
    'P1_SIGNED_REVIEW_REGISTRATION_UNAVAILABLE',
  );
  assert.equal(validation.accepted_result_count, 0);
  assert.equal(validation.result_authentication, 'NOT_REGISTERED');
  assert.equal(validation.gate_state, 'NOT_EVALUATED');
  assert.equal(validation.freeze_authority, 'NONE');
  assert.equal('lane_results' in validation, false);
});

test('rejects unauthenticated structural substitution before returning blocked', async () => {
  const request = createRequest(await makeExactReviewInput());
  const valid = request.tasks.map((task) => resultFor(task));

  const substituted = clone(valid);
  substituted[0].review_disposition_id = DIGEST('substitution');
  expectCode(
    'P1_REVIEW_RESULT_BINDING_MISMATCH',
    () => validateResults(request, substituted),
  );

  const omittedDisposition = clone(valid);
  delete omittedDisposition[0].disposition;
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateResults(request, omittedDisposition),
  );

  const omittedFindings = clone(valid);
  delete omittedFindings[0].findings;
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateResults(request, omittedFindings),
  );

  const blockingWithoutFinding = clone(valid);
  blockingWithoutFinding[0].disposition = 'BLOCKING';
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateResults(request, blockingWithoutFinding),
  );

  const omittedCorrection = clone(valid);
  omittedCorrection[0].disposition = 'BLOCKING';
  omittedCorrection[0].findings = [{
    disposition: 'BLOCKING',
    file: 'contracts/canonical-v2/successor/example.json',
    rule: 'EXACT-RULE',
  }];
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateResults(request, omittedCorrection),
  );

  const duplicate = clone(valid);
  duplicate[1] = clone(duplicate[0]);
  expectCode(
    'INVALID_P1_REVIEW_RESULT_SET',
    () => validateResults(request, duplicate),
  );
});

test('CLI creates tasks but returns the same typed signed-registration block', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-review-controller-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, 'input.json');
  const requestPath = path.join(directory, 'request.json');
  const resultsPath = path.join(directory, 'results.json');
  fs.writeFileSync(inputPath, canonicalJson(await makeExactReviewInput()));
  const created = spawnSync(process.execPath, [SCRIPT, '--input', inputPath], {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(created.status, 0, created.stderr);
  const request = JSON.parse(created.stdout);
  fs.writeFileSync(requestPath, canonicalJson(request));
  fs.writeFileSync(
    resultsPath,
    canonicalJson(request.tasks.map((task) => resultFor(task))),
  );
  const validated = spawnSync(process.execPath, [
    SCRIPT,
    '--request', requestPath,
    '--results', resultsPath,
  ], {
    cwd: directory,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(JSON.parse(validated.stdout).validation_state, 'BLOCKED');
});

test('exact four-file allowlist remains closed around the blocked controller', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  const expected = [
    '.github/phase-allowlists/wp-p1-contract-freeze-review-controller-v1.json',
    'lib/programme-gates/contract-freeze-review-tasks.js',
    'scripts/run-p1-contract-freeze-reviews.mjs',
    'tests/contract-freeze-review-tasks.test.js',
  ];
  assert.deepEqual(allowlist.allowed, expected);
  const checked = checkAllowlist({
    phase: allowlist.phase,
    files: expected,
  });
  assert.deepEqual(checked.denied, []);
  assert.deepEqual(checked.outside, []);
  assert.match(allowlist.note, /blocked.*signed registration/i);
});
