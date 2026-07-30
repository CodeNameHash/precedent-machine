const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const { domainDigest } = require('../lib/programme-gates/bytes');
const {
  compileLegacyF1CanonicalContractBundleMember,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-pre-review-source-closure'
);
const {
  P1_CONTRACT_FREEZE_REVIEW_LANES,
  ContractFreezeReviewTaskError,
  createP1ContractFreezeReviewRequest,
  validateP1ContractFreezeReviewResults,
} = require('../lib/programme-gates/contract-freeze-review-tasks');
const { checkAllowlist } = require('../scripts/ci/check-allowlist');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/run-p1-contract-freeze-reviews.mjs');
const ALLOWLIST = path.join(
  ROOT,
  '.github/phase-allowlists/wp-p1-contract-freeze-review-controller-v1.json',
);
const CODE_COMMIT = 'd'.repeat(40);
const DIGEST = (value) => sha256Hex(Buffer.from(value, 'utf8'));
const MEMBER_KINDS = [
  'COMPARABILITY',
  'COMPOSITION_CATALOGUE',
  'CORE_CANONICAL_CONTRACT',
  'GOVERNED_RESIDUAL',
  'OPEN_WORLD_CONCEPT',
  'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  'SEMANTIC_CATALOGUE',
  'SOURCE_SPECIFIC_PUBLICATION',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function without(record, field) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== field),
  );
}

function successorMember(kind, index) {
  const source = {
    schema_version: 'TEST_CANONICAL_MEMBER_SOURCE/V1',
    member_kind: kind,
    ordinal: index,
  };
  const bytes = Buffer.from(canonicalJson(source), 'utf8');
  return {
    schema_version: 'CanonicalContractBundleMember/V1',
    member_key: `MEMBER_${String(index).padStart(2, '0')}`,
    member_kind: kind,
    logical_type: `Test${kind}`,
    member_schema_version: 'TEST/V1',
    byte_length: bytes.length,
    payload_digest: sha256Hex(bytes),
    source_bytes_base64: bytes.toString('base64'),
    semantic_digest: DIGEST(`semantic-${index}`),
    identity_digest: DIGEST(`identity-${index}`),
  };
}

function governingMembers() {
  const paths = [
    'docs/codex-program/specification-manifest.json',
    'docs/CODEX-PROGRAM.md',
    'docs/codex-program/acceptance-matrix.md',
    'docs/codex-program/canonical-architecture.md',
    'docs/codex-program/corpus-and-serving.md',
    'docs/codex-program/evidence-contracts.md',
  ];
  return paths.map((memberPath, index) => {
    const bytes = Buffer.from(`governing-${index + 1}`, 'utf8');
    const unsigned = {
      schema_version: 'ContractFreezeGoverningSpecificationMember/V1',
      path: memberPath,
      byte_length: bytes.length,
      payload_digest: sha256Hex(bytes),
      source_bytes_base64: bytes.toString('base64'),
    };
    return {
      ...unsigned,
      specification_member_id: domainDigest(
        'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
        unsigned,
      ),
    };
  });
}

function makeExactReviewInput() {
  const predecessorMembers = [clone(compileLegacyF1CanonicalContractBundleMember())];
  const predecessorProjection = predecessorMembers.map((member) => ({
    member_key: member.member_key,
    semantic_digest: member.semantic_digest,
    identity_digest: member.identity_digest,
  }));
  const successorMembers = MEMBER_KINDS.map(successorMember)
    .sort((left, right) => left.member_key.localeCompare(right.member_key));
  const successorProjection = successorMembers.map((member) => ({
    member_key: member.member_key,
    semantic_digest: member.semantic_digest,
    identity_digest: member.identity_digest,
  }));
  const predecessorDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    predecessorProjection,
  );
  const successorDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    successorProjection,
  );
  const predecessorId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: predecessorDigest },
  );
  const successorId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: successorDigest },
  );
  const semanticIdentityDiff = {
    predecessor_contract_bundle_id: predecessorId,
    successor_contract_bundle_id: successorId,
    added_member_keys: successorProjection.map((member) => member.member_key),
    removed_member_keys: predecessorProjection.map((member) => member.member_key),
    semantic_changed_member_keys: [],
    identity_changed_member_keys: [],
  };
  const semanticIdentityDiffDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    semanticIdentityDiff,
  );
  const specificationMembers = governingMembers();
  const specificationRoot = sha256Hex(Buffer.from(
    `CODEX_PROGRAM_SPECIFICATION_ROOT_V1\n${specificationMembers.map(
      (member) => (
        `${member.path}\0${member.byte_length}\0${member.payload_digest}\n`
      ),
    ).join('')}`,
    'utf8',
  ));
  const identityUnsigned = {
    schema_version: 'ContractFreezeAttestationIdentity/V1',
    specification_root: specificationRoot,
    code_commit: CODE_COMMIT,
    environment: 'STAGING',
    predecessor_contract_bundle_id: predecessorId,
    predecessor_contract_bundle_digest: predecessorDigest,
    predecessor_canonical_contract_bundle_member_root: domainDigest(
      'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
      predecessorMembers,
    ),
    predecessor_canonical_contract_bundle_member_count: predecessorMembers.length,
    contract_bundle_id: successorId,
    contract_bundle_digest: successorDigest,
    approval_epoch_nonce: 'p1-review-epoch-1',
  };
  const sourceClosureIdentity = {
    ...identityUnsigned,
    contract_freeze_attestation_id: domainDigest(
      'PROGRAMME_GATE_CONTRACT_FREEZE_ATTESTATION_ID/V1',
      identityUnsigned,
    ),
  };
  const pairDigest = domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      successor_contract_bundle_id: successorId,
      successor_contract_bundle_digest: successorDigest,
      contract_freeze_attestation_id:
        sourceClosureIdentity.contract_freeze_attestation_id,
    },
  );
  const sourceSetDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_SOURCE_SET/V1',
    {
      exact_review_input_schema_version:
        'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2',
      predecessor_canonical_contract_bundle_members: predecessorMembers,
      canonical_contract_bundle_members: successorMembers,
    },
  );
  const exactInputContextDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: specificationRoot,
      code_commit: CODE_COMMIT,
      predecessor_contract_bundle_id: predecessorId,
      predecessor_contract_bundle_digest: predecessorDigest,
      contract_bundle_id: successorId,
      contract_bundle_digest: successorDigest,
      frozen_contract_pair_digest: pairDigest,
      semantic_identity_diff_digest: semanticIdentityDiffDigest,
      reviewed_contract_source_set_digest: sourceSetDigest,
    },
  );
  const packageValue = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_INPUT/V2',
    specification_root: specificationRoot,
    root_manifest_digest: specificationMembers[0].payload_digest,
    code_commit: CODE_COMMIT,
    environment: 'STAGING',
    pre_review_attestation_placeholder: { state: 'SUPERSEDED_BY_SOURCE_CLOSURE' },
    pre_review_frozen_pair_placeholder_digest: DIGEST('placeholder-pair'),
    predecessor_contract_bundle_id: predecessorId,
    predecessor_contract_bundle_digest: predecessorDigest,
    predecessor_contract_bundle_projection: predecessorProjection,
    contract_bundle_id: successorId,
    contract_bundle_digest: successorDigest,
    canonical_contract_bundle_members: successorMembers,
    canonical_contract_bundle_projection: successorProjection,
    semantic_identity_diff: semanticIdentityDiff,
    semantic_identity_diff_digest: semanticIdentityDiffDigest,
    pre_review_input_context_placeholder_digest: DIGEST('placeholder-context'),
    governing_specification_member_records: specificationMembers,
    contract_bundle_freeze_candidate: {
      contract_bundle_id: successorId,
      contract_bundle_digest: successorDigest,
      frozen_contract_pair_digest: pairDigest,
      canonical_contract_bundle_members: successorMembers,
      canonical_contract_bundle_projection: successorProjection,
    },
    contract_freeze_attestation_identity: sourceClosureIdentity,
    frozen_contract_pair_digest: pairDigest,
    predecessor_canonical_contract_bundle_members: predecessorMembers,
    predecessor_source_kinds: ['LEGACY_F1'],
    reviewed_contract_source_set_digest: sourceSetDigest,
    exact_review_input_context_digest: exactInputContextDigest,
  };
  const bytes = Buffer.from(canonicalJson(packageValue), 'utf8');
  const reviewerBindings = P1_CONTRACT_FREEZE_REVIEW_LANES.map((lane, index) => ({
    lane_id: lane.lane_id,
    reviewer_role: lane.reviewer_role,
    reviewer_principal_id: `reviewer-principal-${index + 1}`,
    reviewer_identity: `reviewer-${index + 1}@example.invalid`,
    reviewer_model_identifier: 'gpt-5.6-sol',
    reasoning_level: 'high',
    reviewer_source_control_identity_set: [
      `reviewer-${index + 1}@example.invalid`,
    ],
    reviewer_eligibility_digest: DIGEST('eligibility-set'),
    review_disposition_id: DIGEST(`disposition-${index + 1}`),
    independence_binding: {
      immutable_session_id: `p1-review-session-${index + 1}`,
      session_parent_or_genesis: 'GENESIS',
      source_control_history_scope:
        'REVIEWED_COMMIT_ANCESTRY_FROM_REPOSITORY_GENESIS',
      reviewed_code_commit: CODE_COMMIT,
      source_control_authorship_events: [{
        commit_id: CODE_COMMIT,
        identity_set: ['bundle-author@example.invalid'],
      }],
      prior_conclusion_input_set: [],
      reviewer_edit_set: [],
    },
  }));
  return {
    schema_version: 'P1ContractFreezeReviewRequestInput/V1',
    exact_review_package_fingerprint: contentId(
      'CANONICAL_CONTRACT_BUNDLE_EXACT_REVIEW_PACKAGE_FINGERPRINT/V2',
      packageValue,
    ),
    exact_review_package_bytes_base64: bytes.toString('base64'),
    code_commit: CODE_COMMIT,
    frozen_contract_pair_digest: pairDigest,
    source_closure_identity: sourceClosureIdentity,
    reviewer_bindings: reviewerBindings,
  };
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

test('creates exactly three deterministic formal P1 tasks with no authority', () => {
  const input = makeExactReviewInput();
  const first = createP1ContractFreezeReviewRequest(input);
  const second = createP1ContractFreezeReviewRequest(input);
  assert.deepEqual(first, second);
  assert.equal(first.tasks.length, 3);
  assert.deepEqual(
    first.tasks.map((task) => task.lane_id),
    P1_CONTRACT_FREEZE_REVIEW_LANES.map((lane) => lane.lane_id),
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
  assert.equal(first.disposition.freeze_authority, 'NONE');
});

test('rejects wrong bundle bytes, fingerprint, code, and frozen-pair bindings', () => {
  const wrongFingerprint = makeExactReviewInput();
  wrongFingerprint.exact_review_package_fingerprint = DIGEST('wrong');
  expectCode(
    'EXACT_REVIEW_PACKAGE_FINGERPRINT_MISMATCH',
    () => createP1ContractFreezeReviewRequest(wrongFingerprint),
  );

  const wrongBytes = makeExactReviewInput();
  wrongBytes.exact_review_package_bytes_base64 =
    Buffer.from('{}', 'utf8').toString('base64');
  expectCode(
    'INVALID_EXACT_REVIEW_PACKAGE',
    () => createP1ContractFreezeReviewRequest(wrongBytes),
  );

  const wrongCode = makeExactReviewInput();
  wrongCode.code_commit = 'e'.repeat(40);
  wrongCode.reviewer_bindings.forEach((binding) => {
    binding.independence_binding.reviewed_code_commit = wrongCode.code_commit;
    binding.independence_binding.source_control_authorship_events[0].commit_id =
      wrongCode.code_commit;
  });
  expectCode(
    'SOURCE_CLOSURE_IDENTITY_MISMATCH',
    () => createP1ContractFreezeReviewRequest(wrongCode),
  );

  const wrongPair = makeExactReviewInput();
  wrongPair.frozen_contract_pair_digest = DIGEST('wrong-pair');
  expectCode(
    'FROZEN_CONTRACT_PAIR_MISMATCH',
    () => createP1ContractFreezeReviewRequest(wrongPair),
  );
});

test('rejects missing, extra, duplicate, and G0 review lanes', () => {
  const missing = makeExactReviewInput();
  missing.reviewer_bindings.pop();
  expectCode(
    'INVALID_P1_REVIEW_LANE_SET',
    () => createP1ContractFreezeReviewRequest(missing),
  );

  const extra = makeExactReviewInput();
  extra.reviewer_bindings.push(clone(extra.reviewer_bindings[0]));
  expectCode(
    'INVALID_P1_REVIEW_LANE_SET',
    () => createP1ContractFreezeReviewRequest(extra),
  );

  const duplicate = makeExactReviewInput();
  duplicate.reviewer_bindings[1] = clone(duplicate.reviewer_bindings[0]);
  expectCode(
    'INVALID_P1_REVIEW_LANE_SET',
    () => createP1ContractFreezeReviewRequest(duplicate),
  );

  const g0 = makeExactReviewInput();
  g0.reviewer_bindings[0].lane_id = 'G0_LEGAL_SEMANTIC';
  expectCode(
    'P1_G0_SCOPE_CONFUSION',
    () => createP1ContractFreezeReviewRequest(g0),
  );
});

test('rejects non-independent ancestry and wrong reviewer runtime bindings', () => {
  const ancestry = makeExactReviewInput();
  ancestry.reviewer_bindings[0]
    .independence_binding.source_control_authorship_events[0]
    .identity_set.push(
      ancestry.reviewer_bindings[0].reviewer_source_control_identity_set[0],
    );
  expectCode(
    'NON_INDEPENDENT_P1_REVIEWER',
    () => createP1ContractFreezeReviewRequest(ancestry),
  );

  for (const [field, value, code] of [
    ['reviewer_role', 'G0_COLD_REVIEWER', 'INVALID_P1_REVIEW_LANE_SET'],
    ['reviewer_model_identifier', 'gpt-5.4', 'INVALID_P1_REVIEWER_RUNTIME'],
    ['reasoning_level', 'provider_default', 'INVALID_P1_REVIEWER_RUNTIME'],
  ]) {
    const input = makeExactReviewInput();
    input.reviewer_bindings[0][field] = value;
    expectCode(code, () => createP1ContractFreezeReviewRequest(input));
  }
});

test('structurally validates caller results without claiming review or gate PASS', () => {
  const request = createP1ContractFreezeReviewRequest(makeExactReviewInput());
  const results = [
    resultFor(request.tasks[0]),
    resultFor(request.tasks[1], 'NON-BLOCKING', [{
      disposition: 'NON-BLOCKING',
      file: 'contracts/canonical-v2/successor/composition.json',
      rule: 'COMPOSITION-COVERAGE-4',
      required_correction: 'Add the omitted neutral composition example.',
    }]),
    resultFor(request.tasks[2], 'BLOCKING', [{
      disposition: 'BLOCKING',
      file: 'contracts/canonical-v2/successor/identity.json',
      rule: 'IDENTITY-STABILITY-2',
      required_correction: 'Restore the predecessor stable identity.',
    }]),
  ];
  const validation = validateP1ContractFreezeReviewResults({ request, results });
  assert.equal(validation.validation_state, 'STRUCTURALLY_VALIDATED_ONLY');
  assert.equal(validation.gate_state, 'NOT_EVALUATED');
  assert.equal(validation.freeze_authority, 'NONE');
  assert.deepEqual(
    validation.lane_results.map((lane) => lane.reported_disposition),
    ['PASS', 'NON-BLOCKING', 'BLOCKING'],
  );
});

test('rejects result substitution, wrong runtime, omitted fields, and invalid findings', () => {
  const request = createP1ContractFreezeReviewRequest(makeExactReviewInput());
  const valid = request.tasks.map((task) => resultFor(task));

  const selfRehashed = clone(valid);
  selfRehashed[0].review_disposition_id = DIGEST('substitution');
  selfRehashed[0].task_id = domainDigest(
    'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_TASK_ID/V1',
    without(selfRehashed[0], 'task_id'),
  );
  expectCode(
    'P1_REVIEW_RESULT_BINDING_MISMATCH',
    () => validateP1ContractFreezeReviewResults({
      request,
      results: selfRehashed,
    }),
  );

  for (const [field, value] of [
    ['reviewer_role', 'G0_COLD_REVIEWER'],
    ['reviewer_model_identifier', 'gpt-5.4'],
    ['reasoning_level', 'provider_default'],
  ]) {
    const wrong = clone(valid);
    wrong[0][field] = value;
    expectCode(
      'P1_REVIEW_RESULT_BINDING_MISMATCH',
      () => validateP1ContractFreezeReviewResults({ request, results: wrong }),
    );
  }

  const omittedDisposition = clone(valid);
  delete omittedDisposition[0].disposition;
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateP1ContractFreezeReviewResults({
      request,
      results: omittedDisposition,
    }),
  );

  const omittedFindings = clone(valid);
  delete omittedFindings[0].findings;
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateP1ContractFreezeReviewResults({
      request,
      results: omittedFindings,
    }),
  );

  const blockingWithoutFinding = clone(valid);
  blockingWithoutFinding[0].disposition = 'BLOCKING';
  expectCode(
    'INVALID_P1_REVIEW_RESULT',
    () => validateP1ContractFreezeReviewResults({
      request,
      results: blockingWithoutFinding,
    }),
  );

  const duplicate = clone(valid);
  duplicate[1] = clone(duplicate[0]);
  expectCode(
    'INVALID_P1_REVIEW_RESULT_SET',
    () => validateP1ContractFreezeReviewResults({ request, results: duplicate }),
  );
});

test('CLI creates tasks and validates caller-supplied results without file writes', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-review-controller-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, 'input.json');
  const requestPath = path.join(directory, 'request.json');
  const resultsPath = path.join(directory, 'results.json');
  fs.writeFileSync(inputPath, canonicalJson(makeExactReviewInput()));
  const created = spawnSync(process.execPath, [SCRIPT, '--input', inputPath], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
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
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(validated.status, 0, validated.stderr);
  assert.equal(
    JSON.parse(validated.stdout).validation_state,
    'STRUCTURALLY_VALIDATED_ONLY',
  );
  assert.deepEqual(
    fs.readdirSync(directory).sort(),
    ['input.json', 'request.json', 'results.json'],
  );
});

test('exact four-file allowlist accepts only this pure controller unit', () => {
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
  assert.match(
    allowlist.note,
    /no model review, creates no signature, approval, review PASS, freeze readiness/i,
  );
});
