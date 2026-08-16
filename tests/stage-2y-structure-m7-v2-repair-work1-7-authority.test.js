const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_COMMIT = 'dbaa62d0bde0d36a755ef8032d49c4475a1c7248';
const BRANCH = 'codex/recover-m7-20260812';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const WORK0_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const ACTIVATION_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const ADOPTED_PLAN_PATH = 'docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md';
const PLAN_PATH = 'docs/core/PLAN.md';
const OPERATING_PATH = 'docs/core/OPERATING-RULES.md';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-7-authority-validate.mjs';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work1-7-authority.test.js';
const AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1';
const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_VALIDATION/V1';
const AUTHORITY_BYTES = 29_144;
const AUTHORITY_SHA256 = '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c';
const AUTHORITY_DIGEST = '25ac58d418638432586a5cb24c1cfb766ba1440b77d992afc434ed71d1055afc';
const AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';

const POST_DOCUMENTS = Object.freeze({
  [PLAN_PATH]: Object.freeze({
    permitted_region: 'CURRENT_M7_STATUS_AND_STAGE_TABLE_ONLY',
    pre_work_byte_length: 89_279,
    pre_work_sha256: 'd02b85aec4acc0dc8a041c91592c95c34816e2dbc3f2163e63eea68ebe9acbff',
    pre_work_git_blob_oid: '52a6606cdf2e4d060f05384c890bcb86a72b1906',
    byte_length: 89_724,
    sha256: '1d1ddbc3f7374252a8cbe50a45a26eae6b8ea0ac2fb6c13ad28d7d4b2fc7bfb8',
    git_blob_oid: 'ab25b6069b89ad9e449552242690b62aa129d40b',
  }),
  [OPERATING_PATH]: Object.freeze({
    permitted_region: 'CURRENT_NARROWER_RULE_2026_08_14_ONLY',
    pre_work_byte_length: 53_877,
    pre_work_sha256: 'de15fec1cecb96479fe8f71da05260a51f92eeab684c2ead63453af7cfd4e3e6',
    pre_work_git_blob_oid: '6746919a5da2fb3bb6a02cab9af5d7df46a52fb1',
    byte_length: 54_288,
    sha256: 'e98d4f079f75689e7821dfd8fd7c87bb5989f9065a99427bdef714d9f4b6dd09',
    git_blob_oid: 'afa9cad46005c85c734ee3a3fe5803b9c8b31624',
  }),
});

const RECEIPT_KEYS = Object.freeze([
  'activation_receipt_digest',
  'activation_receipt_id',
  'adopted_plan_binding',
  'authority_binding',
  'base_commit',
  'checks',
  'core_document_bindings',
  'effects',
  'exact_activation_paths',
  'next_state',
  'schema_version',
  'snapshot_bindings',
  'stage',
  'state',
  'test_binding',
  'validator_binding',
  'work',
  'work0_evidence_root_binding',
]);

const RESULT_KEYS = Object.freeze([
  'activation_receipt',
  'activation_receipt_binding',
  'authority_binding',
  'checks',
  'effects',
  'mode',
  'repository',
  'schema_version',
  'status',
]);

const BINDING_KEYS = Object.freeze([
  'byte_length',
  'git_blob_oid',
  'path',
  'record_id',
  'record_id_field',
  'schema_version',
  'sha256',
]);

const CHECK_IDS = Object.freeze([
  'EXACT_AUTHORITY_BYTES_ID_DIGEST_SHA_AND_GIT_BLOB',
  'EXACT_WORK0_EVIDENCE_ROOT',
  'ADOPTED_PLAN_AND_BASE_COMMIT',
  'VALIDATOR_AND_TEST_BYTES_SHA_AND_GIT_BLOBS',
  'PLAN_AND_OPERATING_RULES_PRE_AND_POST_BINDINGS',
  'EXACT_ACTIVATION_PATH_SET',
  'ZERO_EXTERNAL_AND_PRODUCT_EFFECTS',
  'ALL_ACTIVATION_CHECKS_PASS',
]);

const RECEIPT_EFFECTS = Object.freeze({
  activation_receipt_writes: 1,
  semantic_runs: 0,
  database_writes: 0,
  deployment_actions: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  model_calls: 0,
  network_writes_other_than_exact_git_push: 0,
  phase_b_actions: 0,
  production_data_writes: 0,
  publication_changes: 0,
  selector_changes: 0,
  serving_changes: 0,
  unbound_network_reads: 0,
  v1_semantic_consumption: 0,
});

const NEXT_STATE = Object.freeze({
  authority_state: 'PENDING_EXACT_ACTIVATION_COMMIT_PERSISTENT_PASS_AND_PUSH',
  work1_authorised: false,
  required_sequence: Object.freeze([
    'STAGED_VALIDATOR_PASS',
    'EXACT_ACTIVATION_SET_COMMITTED',
    'COMMITTED_VALIDATOR_PASS',
    'EXACT_BRANCH_PUSH_SUCCEEDS',
    'PERSISTENT_VALIDATOR_PASS',
  ]),
  work2_work7_require_preexisting_execution_manifest: true,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(root, repositoryPath) {
  return JSON.parse(readFileSync(path.join(root, repositoryPath), 'utf8'));
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function writeBytes(root, repositoryPath, bytes) {
  const absolutePath = path.join(root, repositoryPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, bytes);
}

function copyInto(root, repositoryPath) {
  const absolutePath = path.join(root, repositoryPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  copyFileSync(path.join(REPO_ROOT, repositoryPath), absolutePath);
}

function git(root, args, options = {}) {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return execFileSync('git', args, {
    cwd: root,
    env,
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
}

function committedBytes(repositoryPath) {
  return git(REPO_ROOT, ['show', `${BASE_COMMIT}:${repositoryPath}`], { encoding: null });
}

function restampAuthority(authority) {
  const unsigned = clone(authority);
  delete unsigned.authority_digest;
  delete unsigned.authority_id;
  const authorityDigest = sha256Hex(canonicalJson(unsigned));
  return {
    ...unsigned,
    authority_digest: authorityDigest,
    authority_id: contentId(authority.schema_version, {
      ...unsigned,
      authority_digest: authorityDigest,
    }),
  };
}

function makeReadyFixture(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'm7-work17-activation-')));
  t.after(() => rmSync(root, { force: true, recursive: true }));

  git(root, ['init']);
  git(root, ['config', 'user.name', 'M7 V2 Test']);
  git(root, ['config', 'user.email', 'm7-v2-test@example.invalid']);
  mkdirSync(path.join(root, '.git', 'refs', 'heads', 'codex'), { recursive: true });
  writeFileSync(path.join(root, '.git', 'HEAD'), `ref: refs/heads/${BRANCH}\n`);

  writeBytes(root, PLAN_PATH, committedBytes(PLAN_PATH));
  writeBytes(root, OPERATING_PATH, committedBytes(OPERATING_PATH));
  copyInto(root, ADOPTED_PLAN_PATH);
  copyInto(root, WORK0_RECEIPT_PATH);
  const markerPaths = [
    'evidence/canonical-v2/stage-2y-structure-migration/control/.work1-7-fixture-marker',
    'scripts/.work1-7-fixture-marker',
    'tests/.work1-7-fixture-marker',
  ];
  for (const markerPath of markerPaths) writeBytes(root, markerPath, Buffer.from('fixture\n'));
  const basePaths = [
    PLAN_PATH,
    OPERATING_PATH,
    ADOPTED_PLAN_PATH,
    WORK0_RECEIPT_PATH,
    ...markerPaths,
  ];
  git(root, ['add', '--', ...basePaths]);
  git(root, ['commit', '-m', 'fixture']);
  const baseCommit = git(root, ['rev-parse', 'HEAD']).trim();

  copyInto(root, PLAN_PATH);
  copyInto(root, OPERATING_PATH);
  copyInto(root, VALIDATOR_PATH);
  copyInto(root, TEST_PATH);

  const authority = readJson(REPO_ROOT, AUTHORITY_PATH);
  authority.base_commit = baseCommit;
  authority.activation_policy.activation_commit_parent = baseCommit;
  authority.permitted_reads.git_object_policy.base_commit = baseCommit;
  authority.adopted_plan_binding.commit = baseCommit;
  const fixtureAuthority = restampAuthority(authority);
  writeBytes(root, AUTHORITY_PATH, canonicalBytes(fixtureAuthority));

  return {
    root,
    baseCommit,
    authority: fixtureAuthority,
    activationPaths: fixtureAuthority.activation_policy.exact_activation_paths,
  };
}

function assertReceiptIdentity(receipt) {
  assert.deepEqual(Object.keys(receipt).sort(), [...RECEIPT_KEYS].sort());
  assert.equal(receipt.schema_version, RECEIPT_SCHEMA);
  assert.equal(receipt.stage, 'M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION');
  assert.equal(receipt.work, 'WORK1_7_AUTHORITY_ACTIVATION');
  assert.equal(receipt.state, 'PASS_AUTHORITY_ACTIVATION');
  const unsigned = clone(receipt);
  delete unsigned.activation_receipt_digest;
  delete unsigned.activation_receipt_id;
  const digest = sha256Hex(canonicalJson(unsigned));
  assert.equal(receipt.activation_receipt_digest, digest);
  assert.equal(receipt.activation_receipt_id, contentId(receipt.schema_version, {
    ...unsigned,
    activation_receipt_digest: digest,
  }));
}

function assertBinding(binding, expected) {
  assert.deepEqual(Object.keys(binding).sort(), Object.keys(expected).sort());
  assert.deepEqual(binding, expected);
}

function assertReadyResult(result, fixture, activationReceiptWrites) {
  assert.deepEqual(Object.keys(result).sort(), [...RESULT_KEYS].sort());
  assert.equal(result.schema_version, RESULT_SCHEMA);
  assert.equal(result.mode, 'READY_TO_STAGE');
  assert.match(result.status, /^PASS/);
  assertReceiptIdentity(result.activation_receipt);
  const receipt = result.activation_receipt;
  assert.equal(result.activation_receipt.base_commit, fixture.baseCommit);
  assert.deepEqual(result.activation_receipt.exact_activation_paths, fixture.activationPaths);
  assert.equal(result.activation_receipt.snapshot_bindings.length, 5);
  assert.deepEqual(
    result.activation_receipt.snapshot_bindings.map((binding) => binding.path),
    fixture.activationPaths.slice(0, 5),
  );
  assert.deepEqual(result.activation_receipt.checks, CHECK_IDS.map((check_id) => ({
    check_id,
    status: 'PASS',
  })));
  assert.deepEqual(result.activation_receipt.effects, RECEIPT_EFFECTS);
  assert.deepEqual(result.activation_receipt.next_state, NEXT_STATE);
  assert.deepEqual(result.effects, {
    ...RECEIPT_EFFECTS,
    activation_receipt_writes: activationReceiptWrites,
  });

  const authorityBytes = readFileSync(path.join(fixture.root, AUTHORITY_PATH));
  const authorityBinding = {
    path: AUTHORITY_PATH,
    schema_version: AUTHORITY_SCHEMA,
    record_id_field: 'authority_id',
    record_id: fixture.authority.authority_id,
    record_digest_field: 'authority_digest',
    record_digest: fixture.authority.authority_digest,
    byte_length: authorityBytes.length,
    sha256: sha256Hex(authorityBytes),
    git_blob_oid: gitBlobOid(authorityBytes),
  };
  assertBinding(receipt.authority_binding, authorityBinding);
  assertBinding(result.authority_binding, authorityBinding);

  const receiptBytes = canonicalBytes(receipt);
  assertBinding(result.activation_receipt_binding, {
    path: ACTIVATION_RECEIPT_PATH,
    schema_version: RECEIPT_SCHEMA,
    record_id_field: 'activation_receipt_id',
    record_id: receipt.activation_receipt_id,
    byte_length: receiptBytes.length,
    sha256: sha256Hex(receiptBytes),
    git_blob_oid: gitBlobOid(receiptBytes),
  });

  const work0Bytes = readFileSync(path.join(fixture.root, WORK0_RECEIPT_PATH));
  const work0Receipt = JSON.parse(work0Bytes);
  assertBinding(receipt.work0_evidence_root_binding, {
    path: WORK0_RECEIPT_PATH,
    schema_version: work0Receipt.schema_version,
    record_id_field: 'evidence_root_id',
    record_id: work0Receipt.evidence_root_id,
    byte_length: work0Bytes.length,
    sha256: sha256Hex(work0Bytes),
    git_blob_oid: gitBlobOid(work0Bytes),
  });

  const adoptedPlanBytes = readFileSync(path.join(fixture.root, ADOPTED_PLAN_PATH));
  assertBinding(receipt.adopted_plan_binding, {
    path: ADOPTED_PLAN_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    source_commit: fixture.authority.adopted_plan_binding.commit,
    byte_length: adoptedPlanBytes.length,
    sha256: sha256Hex(adoptedPlanBytes),
    git_blob_oid: gitBlobOid(adoptedPlanBytes),
  });

  const snapshotByPath = new Map(receipt.snapshot_bindings.map((binding) => [binding.path, binding]));
  for (const repositoryPath of fixture.activationPaths.slice(0, 5)) {
    const bytes = readFileSync(path.join(fixture.root, repositoryPath));
    const isAuthority = repositoryPath === AUTHORITY_PATH;
    assertBinding(snapshotByPath.get(repositoryPath), {
      path: repositoryPath,
      schema_version: isAuthority ? AUTHORITY_SCHEMA : null,
      record_id_field: isAuthority ? 'authority_id' : null,
      record_id: isAuthority ? fixture.authority.authority_id : null,
      ...(isAuthority ? {
        record_digest_field: 'authority_digest',
        record_digest: fixture.authority.authority_digest,
      } : {}),
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      git_blob_oid: gitBlobOid(bytes),
    });
  }
  assert.deepEqual(receipt.validator_binding, snapshotByPath.get(VALIDATOR_PATH));
  assert.deepEqual(receipt.test_binding, snapshotByPath.get(TEST_PATH));

  const documentByPath = new Map(receipt.core_document_bindings.map((binding) => [binding.path, binding]));
  for (const [repositoryPath, expected] of Object.entries(POST_DOCUMENTS)) {
    assert.deepEqual(documentByPath.get(repositoryPath), {
      path: repositoryPath,
      permitted_region: expected.permitted_region,
      pre_work_byte_length: expected.pre_work_byte_length,
      pre_work_sha256: expected.pre_work_sha256,
      pre_work_git_blob_oid: expected.pre_work_git_blob_oid,
      post_work_byte_length: expected.byte_length,
      post_work_sha256: expected.sha256,
      post_work_git_blob_oid: expected.git_blob_oid,
    });
  }
}

async function assertCode(validator, action, code) {
  await assert.rejects(
    Promise.resolve().then(action),
    (error) => {
      assert.ok(error instanceof validator.Work17AuthorityValidationError);
      assert.equal(error.code, code);
      return true;
    },
  );
}

function stageActivation(fixture) {
  git(fixture.root, ['add', '--', ...fixture.activationPaths]);
}

function commitActivation(fixture) {
  git(fixture.root, ['commit', '-m', 'fixture']);
  return git(fixture.root, ['rev-parse', 'HEAD']).trim();
}

function markOriginAt(root, commit) {
  const refPath = path.join(root, '.git', 'refs', 'remotes', 'origin', BRANCH);
  mkdirSync(path.dirname(refPath), { recursive: true });
  writeFileSync(refPath, `${commit}\n`);
}

test('Work 1-7 authority activation is evidence-bound and create-once', async (t) => {
  const validator = await import('../scripts/stage-2y-structure-m7-v2-repair-work1-7-authority-validate.mjs');

  await t.test('the frozen authority, documents and public seam match the activation contract', () => {
    assert.deepEqual(
      Object.keys(validator).sort(),
      ['Work17AuthorityValidationError', 'validateWork17AuthorityActivation'],
    );
    const authorityBytes = readFileSync(path.join(REPO_ROOT, AUTHORITY_PATH));
    const authority = JSON.parse(authorityBytes);
    assert.equal(authorityBytes.length, AUTHORITY_BYTES);
    assert.equal(sha256Hex(authorityBytes), AUTHORITY_SHA256);
    assert.equal(authority.schema_version, AUTHORITY_SCHEMA);
    assert.equal(authority.authority_digest, AUTHORITY_DIGEST);
    assert.equal(authority.authority_id, AUTHORITY_ID);
    assert.equal(
      authority.authority_state,
      'CONDITIONALLY_EFFECTIVE_AFTER_ACTIVATION_RECEIPT_PASS_COMMIT_AND_PUSH',
    );
    assert.equal(authority.activation_policy.work1_before_activation, 'FORBIDDEN');
    assert.equal(authority.immutable_paths.includes(VALIDATOR_PATH), true);
    assert.equal(authority.immutable_paths.includes(TEST_PATH), true);
    assert.deepEqual(
      authority.activation_policy.allowed_modes,
      ['READY_TO_STAGE', 'STAGED', 'COMMITTED', 'PERSISTENT'],
    );
    assert.deepEqual(authority.activation_policy.exact_activation_paths, [
      AUTHORITY_PATH,
      PLAN_PATH,
      OPERATING_PATH,
      VALIDATOR_PATH,
      TEST_PATH,
      ACTIVATION_RECEIPT_PATH,
    ]);
    for (const [repositoryPath, expected] of Object.entries(POST_DOCUMENTS)) {
      const bytes = readFileSync(path.join(REPO_ROOT, repositoryPath));
      assert.equal(bytes.length, expected.byte_length);
      assert.equal(sha256Hex(bytes), expected.sha256);
      assert.equal(git(REPO_ROOT, ['hash-object', '--', repositoryPath]).trim(), expected.git_blob_oid);
    }
    const receiptPath = path.join(REPO_ROOT, ACTIVATION_RECEIPT_PATH);
    if (existsSync(receiptPath)) {
      const receiptBytes = readFileSync(receiptPath);
      const receipt = JSON.parse(receiptBytes);
      assert.deepEqual(receiptBytes, canonicalBytes(receipt));
      assertReceiptIdentity(receipt);
      assert.equal(receipt.authority_binding.record_id, AUTHORITY_ID);
      assert.equal(receipt.authority_binding.byte_length, AUTHORITY_BYTES);
      assert.equal(receipt.authority_binding.sha256, AUTHORITY_SHA256);
      assert.deepEqual(receipt.exact_activation_paths, authority.activation_policy.exact_activation_paths);
      assert.deepEqual(
        receipt.snapshot_bindings.map((binding) => binding.path),
        authority.activation_policy.exact_activation_paths.slice(0, 5),
      );
    }
  });

  await t.test('READY_TO_STAGE previews deterministically, writes once, and never makes Work 1 active', async (st) => {
    const fixture = makeReadyFixture(st);
    const preview = await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'READY_TO_STAGE',
      writeReceipt: false,
    });
    assertReadyResult(preview, fixture, 0);
    assert.equal(existsSync(path.join(fixture.root, ACTIVATION_RECEIPT_PATH)), false);

    const written = await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'READY_TO_STAGE',
      writeReceipt: true,
    });
    assertReadyResult(written, fixture, 1);
    assert.deepEqual(written.activation_receipt, preview.activation_receipt);
    assert.deepEqual(
      readFileSync(path.join(fixture.root, ACTIVATION_RECEIPT_PATH)),
      canonicalBytes(preview.activation_receipt),
    );
    assert.equal(written.activation_receipt.next_state.work1_authorised, false);

    const repeatedRead = await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'READY_TO_STAGE',
      writeReceipt: false,
    });
    assert.deepEqual(repeatedRead.activation_receipt, preview.activation_receipt);
    assert.deepEqual(repeatedRead.effects, {
      ...RECEIPT_EFFECTS,
      activation_receipt_writes: 0,
    });
    await assertCode(validator, () => validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'READY_TO_STAGE',
      writeReceipt: true,
    }), 'RECEIPT_ALREADY_EXISTS');
    await assertCode(validator, () => validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'STAGED',
      writeReceipt: true,
    }), 'INVALID_OPTIONS');
    await assertCode(validator, () => validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'ACTIVE',
      writeReceipt: false,
    }), 'INVALID_MODE');
  });

  await t.test('authority, trust-root and document drift fail before receipt creation', async (st) => {
    {
      const fixture = makeReadyFixture(st);
      writeFileSync(path.join(fixture.root, AUTHORITY_PATH), Buffer.concat([
        readFileSync(path.join(fixture.root, AUTHORITY_PATH)),
        Buffer.from(' '),
      ]));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'AUTHORITY_BYTES_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      const authority = readJson(fixture.root, AUTHORITY_PATH);
      authority.authority_id = '0'.repeat(64);
      writeBytes(fixture.root, AUTHORITY_PATH, canonicalBytes(authority));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'AUTHORITY_IDENTITY_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      writeFileSync(path.join(fixture.root, WORK0_RECEIPT_PATH), Buffer.concat([
        readFileSync(path.join(fixture.root, WORK0_RECEIPT_PATH)),
        Buffer.from('\n'),
      ]));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'WORK0_BINDING_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      writeFileSync(path.join(fixture.root, ADOPTED_PLAN_PATH), Buffer.concat([
        readFileSync(path.join(fixture.root, ADOPTED_PLAN_PATH)),
        Buffer.from('\nfixture drift\n'),
      ]));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'ADOPTED_PLAN_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      writeFileSync(path.join(fixture.root, PLAN_PATH), Buffer.concat([
        readFileSync(path.join(fixture.root, PLAN_PATH)),
        Buffer.from('\nUnauthorised region drift.\n'),
      ]));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'CORE_DOC_REGION_DRIFT');
    }
  });

  await t.test('dirty, staged and receipt blob sets are exact', async (st) => {
    {
      const fixture = makeReadyFixture(st);
      const outside = path.join(fixture.root, 'outside-receipt.json');
      writeFileSync(outside, 'outside\n');
      const receiptPath = path.join(fixture.root, ACTIVATION_RECEIPT_PATH);
      mkdirSync(path.dirname(receiptPath), { recursive: true });
      symlinkSync(outside, receiptPath);
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
        writeReceipt: true,
      }), 'PATH_SAFETY');
      assert.equal(readFileSync(outside, 'utf8'), 'outside\n');
    }
    {
      const fixture = makeReadyFixture(st);
      writeBytes(fixture.root, 'unexpected.txt', Buffer.from('unexpected\n'));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'ACTIVATION_DELTA_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      git(fixture.root, ['add', '--', AUTHORITY_PATH]);
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'ACTIVATION_DELTA_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      await validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
        writeReceipt: true,
      });
      stageActivation(fixture);
      writeBytes(fixture.root, 'unexpected.txt', Buffer.from('unexpected\n'));
      git(fixture.root, ['add', '--', 'unexpected.txt']);
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'STAGED',
      }), 'STAGED_SET_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      await validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
        writeReceipt: true,
      });
      stageActivation(fixture);
      writeBytes(fixture.root, 'unexpected.txt', Buffer.from('unexpected\n'));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'STAGED',
      }), 'ACTIVATION_DELTA_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      await validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
        writeReceipt: true,
      });
      stageActivation(fixture);
      writeFileSync(path.join(fixture.root, TEST_PATH), Buffer.concat([
        readFileSync(path.join(fixture.root, TEST_PATH)),
        Buffer.from('\n'),
      ]));
      git(fixture.root, ['add', '--', TEST_PATH]);
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'STAGED',
      }), 'STAGED_BLOB_DRIFT');
    }
    {
      const fixture = makeReadyFixture(st);
      await validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
        writeReceipt: true,
      });
      const receipt = readJson(fixture.root, ACTIVATION_RECEIPT_PATH);
      receipt.activation_receipt_id = '0'.repeat(64);
      writeBytes(fixture.root, ACTIVATION_RECEIPT_PATH, canonicalBytes(receipt));
      await assertCode(validator, () => validator.validateWork17AuthorityActivation({
        repoRoot: fixture.root,
        mode: 'READY_TO_STAGE',
      }), 'RECEIPT_IDENTITY_DRIFT');
    }
  });

  await t.test('only an exact committed activation child at the pushed branch ref becomes persistent', async (st) => {
    const fixture = makeReadyFixture(st);
    await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'READY_TO_STAGE',
      writeReceipt: true,
    });
    stageActivation(fixture);
    const staged = await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'STAGED',
    });
    assert.equal(staged.mode, 'STAGED');
    assert.match(staged.status, /^PASS/);
    assert.equal(staged.activation_receipt.next_state.work1_authorised, false);

    const activationCommit = commitActivation(fixture);
    const committed = await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'COMMITTED',
    });
    assert.equal(committed.mode, 'COMMITTED');
    assert.match(committed.status, /^PASS/);
    assert.equal(committed.activation_receipt.next_state.work1_authorised, false);

    await assertCode(validator, () => validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'PERSISTENT',
    }), 'PUSH_STATE_DRIFT');
    markOriginAt(fixture.root, activationCommit);
    const persistent = await validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'PERSISTENT',
    });
    assert.equal(persistent.mode, 'PERSISTENT');
    assert.match(persistent.status, /^PASS/);

    writeBytes(fixture.root, 'later.txt', Buffer.from('later\n'));
    git(fixture.root, ['add', '--', 'later.txt']);
    git(fixture.root, ['commit', '-m', 'fixture']);
    const laterCommit = git(fixture.root, ['rev-parse', 'HEAD']).trim();
    markOriginAt(fixture.root, laterCommit);
    await assertCode(validator, () => validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'PERSISTENT',
    }), 'ACTIVATION_COMMIT_DRIFT');

    rmSync(path.join(fixture.root, ACTIVATION_RECEIPT_PATH));
    git(fixture.root, ['add', '--', ACTIVATION_RECEIPT_PATH]);
    git(fixture.root, ['commit', '-m', 'fixture']);
    const receiptDeletingCommit = git(fixture.root, ['rev-parse', 'HEAD']).trim();
    markOriginAt(fixture.root, receiptDeletingCommit);
    await assertCode(validator, () => validator.validateWork17AuthorityActivation({
      repoRoot: fixture.root,
      mode: 'PERSISTENT',
    }), 'RECEIPT_MISSING');
  });
});
