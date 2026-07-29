const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  executeProgrammeStatusPublication,
  remoteRef,
} = require('../../lib/programme-gates/publication-executor');
const {
  HEAD_PATH,
  PUBLICATION_REF,
  STATUS_PATH,
} = require('../../lib/programme-gates/publication');

function run(cwd, args) {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout.trim();
}

function blob(bytes) {
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
}

function output(pathname, value) {
  const bytes = Buffer.from(value);
  return {
    path: pathname,
    git_blob_object_id: blob(bytes),
    canonical_bytes_base64: bytes.toString('base64'),
  };
}

function plan() {
  const outputs = [
    output(STATUS_PATH, '{"status":"signed"}'),
    output(HEAD_PATH, '{"head":"signed"}'),
  ];
  return {
    plan_type: 'ProgrammeStatusGitCasTransactionPlan/V1',
    mutation_performed: false,
    construction: {
      blobs: outputs,
      commit: {
        parent_git_object_ids: [],
        identity: {
          author_name: 'Programme Gate Publisher',
          author_email: 'bengoodchild@gmail.com',
          timestamp: '1785283200',
          timezone: '+0000',
          message: 'Publish programme gate status generation 1',
        },
      },
    },
    compare_and_swap: {
      ref: PUBLICATION_REF,
      expected_old_git_object_id: 'NONE',
      on_success: { consume_bootstrap_nonce: true },
    },
    post_verification: {
      verify_exact_tree_entries: outputs.map((entry) => ({
        mode: '100644',
        path: entry.path,
        git_blob_object_id: entry.git_blob_object_id,
      })),
    },
    receipt: {
      generation: 1,
      status_artefact_id: 'a'.repeat(64),
      status_artefact_payload_digest: 'b'.repeat(64),
    },
  };
}

test('executes genesis through one exact Git ref CAS and refuses replay', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'programme-publisher-test-'));
  const repository = path.join(root, 'repository');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(repository);
  fs.mkdirSync(remote);
  try {
    run(repository, ['init', '--quiet']);
    run(remote, ['init', '--bare', '--quiet']);
    run(repository, ['remote', 'add', 'origin', remote]);

    const transaction = plan();
    const receipt = executeProgrammeStatusPublication({
      plan: transaction,
      repositoryRoot: repository,
      remote: 'origin',
    });
    assert.equal(receipt.receipt_type, 'ProgrammeStatusPublicationReceipt/V1');
    assert.equal(receipt.post_verification, 'PASS');
    assert.equal(receipt.bootstrap_nonce_consumed, true);
    assert.match(receipt.new_git_object_id, /^[a-f0-9]{40}$/);
    assert.equal(
      remoteRef(repository, 'origin', PUBLICATION_REF),
      receipt.new_git_object_id,
    );

    const tree = run(remote, [
      'ls-tree',
      '-r',
      '--name-only',
      receipt.new_git_object_id,
    ]).split('\n');
    assert.deepEqual(tree, [STATUS_PATH, HEAD_PATH]);
    assert.throws(
      () => executeProgrammeStatusPublication({
        plan: transaction,
        repositoryRoot: repository,
        remote: 'origin',
      }),
      /predecessor changed/,
    );
    assert.equal(
      remoteRef(repository, 'origin', PUBLICATION_REF),
      receipt.new_git_object_id,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
