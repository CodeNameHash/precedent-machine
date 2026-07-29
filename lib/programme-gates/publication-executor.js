const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

function childEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  delete environment.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY;
  delete environment.VERCEL_TOKEN;
  return environment;
}

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extras = keys.filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !keys.includes(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(', ')}`);
  if (missing.length > 0) throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
}

function git(repositoryRoot, args, options = {}) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: options.encoding || 'utf8',
    env: options.env || childEnvironment(),
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed`);
  }
  return typeof result.stdout === 'string' ? result.stdout.trim() : result.stdout;
}

function remoteRef(repositoryRoot, remote, ref) {
  const output = git(repositoryRoot, ['ls-remote', '--refs', remote, ref]);
  if (output.length === 0) return 'NONE';
  const rows = output.split('\n');
  if (rows.length !== 1) throw new Error('publication ref lookup was ambiguous');
  const [objectId, observedRef] = rows[0].split(/\s+/);
  if (observedRef !== ref || !COMMIT_PATTERN.test(objectId)) {
    throw new Error('publication ref lookup was malformed');
  }
  return objectId;
}

function publicationEnvironment(repositoryRoot, objectDirectory, identity) {
  const sourceObjects = git(repositoryRoot, ['rev-parse', '--git-path', 'objects']);
  const absoluteSourceObjects = path.isAbsolute(sourceObjects)
    ? sourceObjects
    : path.resolve(repositoryRoot, sourceObjects);
  const date = `${identity.timestamp} ${identity.timezone}`;
  return {
    ...childEnvironment(),
    GIT_OBJECT_DIRECTORY: objectDirectory,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: absoluteSourceObjects,
    GIT_AUTHOR_NAME: identity.author_name,
    GIT_AUTHOR_EMAIL: identity.author_email,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_NAME: identity.author_name,
    GIT_COMMITTER_EMAIL: identity.author_email,
    GIT_COMMITTER_DATE: date,
  };
}

function verifyRemotePublication({
  repositoryRoot,
  remote,
  ref,
  expectedCommit,
  expectedEntries,
}) {
  const verificationRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'programme-status-verify-'),
  );
  try {
    git(verificationRoot, ['init', '--bare', '--quiet']);
    const remoteUrl = git(repositoryRoot, ['remote', 'get-url', remote]);
    git(verificationRoot, [
      'fetch',
      '--quiet',
      '--no-tags',
      remoteUrl,
      `${ref}:refs/verification/programme-status`,
    ]);
    const fetched = git(
      verificationRoot,
      ['rev-parse', 'refs/verification/programme-status'],
    );
    if (fetched !== expectedCommit) {
      throw new Error('post-publication ref verification failed');
    }
    const rows = git(
      verificationRoot,
      ['ls-tree', '-r', '--full-tree', expectedCommit],
    ).split('\n').filter(Boolean);
    const observed = rows.map((row) => {
      const match = row.match(/^100644 blob ([a-f0-9]{40})\t(.+)$/);
      if (!match) throw new Error('published tree contains an unsupported entry');
      return { mode: '100644', git_blob_object_id: match[1], path: match[2] };
    });
    const exact = observed.length === expectedEntries.length
      && observed.every((entry, index) => (
        entry.mode === expectedEntries[index].mode
        && entry.path === expectedEntries[index].path
        && entry.git_blob_object_id
          === expectedEntries[index].git_blob_object_id
      ));
    if (!exact) {
      throw new Error('published tree does not contain the exact planned entries');
    }
  } finally {
    fs.rmSync(verificationRoot, { recursive: true, force: true });
  }
}

function executeProgrammeStatusPublication(input) {
  requireExactKeys(
    input,
    ['plan', 'repositoryRoot', 'remote'],
    'programme status publication execution input',
  );
  const { plan, repositoryRoot, remote } = input;
  if (plan?.plan_type !== 'ProgrammeStatusGitCasTransactionPlan/V1'
    || plan.mutation_performed !== false) {
    throw new Error('an unexecuted programme status publication plan is required');
  }
  const ref = plan.compare_and_swap.ref;
  const expectedOld = plan.compare_and_swap.expected_old_git_object_id;
  if (remoteRef(repositoryRoot, remote, ref) !== expectedOld) {
    throw new Error('publication predecessor changed before construction');
  }

  const quarantineRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'programme-status-quarantine-'),
  );
  const objectDirectory = path.join(quarantineRoot, 'objects');
  const indexPath = path.join(quarantineRoot, 'index');
  fs.mkdirSync(objectDirectory);
  const environment = publicationEnvironment(
    repositoryRoot,
    objectDirectory,
    plan.construction.commit.identity,
  );
  environment.GIT_INDEX_FILE = indexPath;

  let commitId;
  try {
    for (const blob of plan.construction.blobs) {
      const bytes = Buffer.from(blob.canonical_bytes_base64, 'base64');
      const objectId = git(
        repositoryRoot,
        ['hash-object', '-w', '--stdin'],
        { env: environment, input: bytes },
      );
      if (objectId !== blob.git_blob_object_id) {
        throw new Error('constructed blob does not match publication plan');
      }
      git(repositoryRoot, [
        'update-index',
        '--add',
        '--cacheinfo',
        `100644,${objectId},${blob.path}`,
      ], { env: environment });
    }
    const treeId = git(repositoryRoot, ['write-tree'], { env: environment });
    const commitArgs = ['commit-tree', treeId];
    for (const parent of plan.construction.commit.parent_git_object_ids) {
      commitArgs.push('-p', parent);
    }
    commitId = git(repositoryRoot, commitArgs, {
      env: environment,
      input: `${plan.construction.commit.identity.message}\n`,
    });
    if (!COMMIT_PATTERN.test(commitId)) {
      throw new Error('publication commit construction failed');
    }
    if (remoteRef(repositoryRoot, remote, ref) !== expectedOld) {
      throw new Error('publication predecessor changed before compare-and-swap');
    }
    const lease = expectedOld === 'NONE'
      ? `--force-with-lease=${ref}:`
      : `--force-with-lease=${ref}:${expectedOld}`;
    git(repositoryRoot, [
      'push',
      '--quiet',
      lease,
      remote,
      `${commitId}:${ref}`,
    ], { env: environment });

    if (remoteRef(repositoryRoot, remote, ref) !== commitId) {
      throw new Error('publication ref did not advance to the planned commit');
    }
    verifyRemotePublication({
      repositoryRoot,
      remote,
      ref,
      expectedCommit: commitId,
      expectedEntries: plan.post_verification.verify_exact_tree_entries,
    });
    return Object.freeze({
      receipt_type: 'ProgrammeStatusPublicationReceipt/V1',
      publication_ref: ref,
      expected_old_git_object_id: expectedOld,
      new_git_object_id: commitId,
      generation: plan.receipt.generation,
      status_artefact_id: plan.receipt.status_artefact_id,
      status_artefact_payload_digest:
        plan.receipt.status_artefact_payload_digest,
      post_verification: 'PASS',
      bootstrap_nonce_consumed:
        plan.compare_and_swap.on_success.consume_bootstrap_nonce,
    });
  } finally {
    fs.rmSync(quarantineRoot, { recursive: true, force: true });
  }
}

module.exports = {
  executeProgrammeStatusPublication,
  remoteRef,
};
