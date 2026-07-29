const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
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

function successorPlan(predecessor, suffix = 'generation-2') {
  const outputs = [
    output(STATUS_PATH, `{"status":"${suffix}"}`),
    output(HEAD_PATH, `{"head":"${suffix}"}`),
  ];
  return {
    plan_type: 'ProgrammeStatusGitCasTransactionPlan/V1',
    mutation_performed: false,
    construction: {
      blobs: outputs,
      commit: {
        parent_git_object_ids: [predecessor],
        identity: {
          author_name: 'Programme Gate Publisher',
          author_email: 'bengoodchild@gmail.com',
          timestamp: '1785283260',
          timezone: '+0000',
          message: `Publish programme gate status ${suffix}`,
        },
      },
    },
    compare_and_swap: {
      ref: PUBLICATION_REF,
      expected_old_git_object_id: predecessor,
      on_success: { consume_bootstrap_nonce: false },
    },
    post_verification: {
      verify_exact_tree_entries: outputs.map((entry) => ({
        mode: '100644',
        path: entry.path,
        git_blob_object_id: entry.git_blob_object_id,
      })),
    },
    receipt: {
      generation: 2,
      status_artefact_id: crypto.createHash('sha256').update(suffix).digest('hex'),
      status_artefact_payload_digest:
        crypto.createHash('sha256').update(`payload:${suffix}`).digest('hex'),
    },
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'programme-publisher-test-'));
  const repository = path.join(root, 'repository');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(repository);
  fs.mkdirSync(remote);
  run(repository, ['init', '--quiet']);
  run(remote, ['init', '--bare', '--quiet']);
  run(repository, ['remote', 'add', 'origin', remote]);
  return { root, repository, remote };
}

function executeInChild(repository, transaction) {
  const executorPath = path.resolve(
    __dirname,
    '../../lib/programme-gates/publication-executor.js',
  );
  const source = [
    "const { executeProgrammeStatusPublication } = require(process.env.EXECUTOR_PATH);",
    'const plan = JSON.parse(Buffer.from(process.env.PLAN_BASE64, "base64"));',
    'try {',
    '  const receipt = executeProgrammeStatusPublication({',
    '    plan, repositoryRoot: process.env.REPOSITORY, remote: "origin",',
    '  });',
    '  process.stdout.write(JSON.stringify({ ok: true, receipt }));',
    '} catch (error) {',
    '  process.stdout.write(JSON.stringify({ ok: false, message: error.message }));',
    '  process.exitCode = 1;',
    '}',
  ].join('\n');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', source], {
      env: {
        ...process.env,
        EXECUTOR_PATH: executorPath,
        PLAN_BASE64: Buffer.from(JSON.stringify(transaction)).toString('base64'),
        REPOSITORY: repository,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        resolve({ code, stderr, ...JSON.parse(stdout) });
      } catch {
        reject(new Error(`publication child returned invalid output: ${stdout}${stderr}`));
      }
    });
  });
}

test('executes genesis through one exact Git ref CAS and refuses replay', () => {
  const { root, repository, remote } = fixture();
  try {
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

test('executes an exact generation-1 to generation-2 successor and rejects stale replay', () => {
  const { root, repository, remote } = fixture();
  try {
    const genesis = executeProgrammeStatusPublication({
      plan: plan(),
      repositoryRoot: repository,
      remote: 'origin',
    });
    run(repository, [
      'fetch',
      '--quiet',
      '--no-tags',
      '--no-write-fetch-head',
      'origin',
      PUBLICATION_REF,
    ]);
    const transaction = successorPlan(genesis.new_git_object_id);
    const successor = executeProgrammeStatusPublication({
      plan: transaction,
      repositoryRoot: repository,
      remote: 'origin',
    });

    assert.equal(successor.generation, 2);
    assert.equal(successor.expected_old_git_object_id, genesis.new_git_object_id);
    assert.equal(successor.bootstrap_nonce_consumed, false);
    assert.equal(
      remoteRef(repository, 'origin', PUBLICATION_REF),
      successor.new_git_object_id,
    );
    assert.deepEqual(
      run(remote, ['rev-list', '--parents', '-n', '1', successor.new_git_object_id])
        .split(/\s+/),
      [successor.new_git_object_id, genesis.new_git_object_id],
    );
    assert.deepEqual(
      run(remote, ['ls-tree', '-r', '--name-only', successor.new_git_object_id])
        .split('\n'),
      [STATUS_PATH, HEAD_PATH],
    );
    assert.equal(
      run(remote, ['show', `${successor.new_git_object_id}:${STATUS_PATH}`]),
      '{"status":"generation-2"}',
    );
    assert.equal(
      run(remote, ['show', `${successor.new_git_object_id}:${HEAD_PATH}`]),
      '{"head":"generation-2"}',
    );

    assert.throws(
      () => executeProgrammeStatusPublication({
        plan: transaction,
        repositoryRoot: repository,
        remote: 'origin',
      }),
      /predecessor changed/,
    );
    assert.throws(
      () => executeProgrammeStatusPublication({
        plan: successorPlan(genesis.new_git_object_id, 'stale-competitor'),
        repositoryRoot: repository,
        remote: 'origin',
      }),
      /predecessor changed/,
    );
    assert.equal(
      remoteRef(repository, 'origin', PUBLICATION_REF),
      successor.new_git_object_id,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('two concurrent successors produce exactly one CAS winner', async () => {
  const { root, repository } = fixture();
  try {
    const genesis = executeProgrammeStatusPublication({
      plan: plan(),
      repositoryRoot: repository,
      remote: 'origin',
    });
    run(repository, [
      'fetch',
      '--quiet',
      '--no-tags',
      '--no-write-fetch-head',
      'origin',
      PUBLICATION_REF,
    ]);
    const attempts = await Promise.all([
      executeInChild(
        repository,
        successorPlan(genesis.new_git_object_id, 'concurrent-a'),
      ),
      executeInChild(
        repository,
        successorPlan(genesis.new_git_object_id, 'concurrent-b'),
      ),
    ]);
    const winners = attempts.filter((attempt) => attempt.ok);
    const losers = attempts.filter((attempt) => !attempt.ok);

    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert.equal(winners[0].code, 0);
    assert.notEqual(losers[0].code, 0);
    assert.equal(
      remoteRef(repository, 'origin', PUBLICATION_REF),
      winners[0].receipt.new_git_object_id,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
