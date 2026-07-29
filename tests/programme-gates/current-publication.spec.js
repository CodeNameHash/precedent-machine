const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  canonicalBytes,
  domainDigest,
  signatureBytes,
} = require('../../lib/programme-gates/bytes');
const {
  createCurrentPublicationAuthority,
  loadCurrentProgrammePublication,
} = require('../../lib/programme-gates/current-publication');
const {
  HEAD_PATH,
  PUBLICATION_REF,
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  STATUS_PATH,
  gitBlobObjectId,
} = require('../../lib/programme-gates/publication');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');
const { verifySignature } = require('../../lib/programme-gates/signatures');

const COMMIT_TIME = '2026-07-29T12:00:00.000Z';
const PUBLISHER_KEY_ID = 'TEST_PROGRAMME_STATUS_PUBLISHER';
const STATUS_DOMAIN = 'PROGRAMME_GATE_STATUS/V2';
const HEAD_DOMAIN = 'PROGRAMME_GATE_PUBLICATION_HEAD/V1';
const ROLE = 'STATUS_PUBLISHER';

function run(cwd, args, options = {}) {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: options.encoding === null ? null : 'utf8',
    env: options.env || {
      ...process.env,
      GIT_AUTHOR_NAME: 'Programme Status Test',
      GIT_AUTHOR_EMAIL: 'programme-status-test@example.invalid',
      GIT_COMMITTER_NAME: 'Programme Status Test',
      GIT_COMMITTER_EMAIL: 'programme-status-test@example.invalid',
    },
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr}`);
  }
  return options.encoding === null ? result.stdout : result.stdout.trim();
}

function testAuthority() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: PUBLISHER_KEY_ID,
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
      permitted_roles: [ROLE],
      permitted_domains: [STATUS_DOMAIN, HEAD_DOMAIN],
      valid_from: '2026-01-01T00:00:00.000Z',
      valid_until: '2027-01-01T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  return {
    authority: createCurrentPublicationAuthority({
      canonicalBytes,
      domainDigest,
      keyRegistry,
      validateSchema,
      verifySignature,
    }),
    privateKey,
  };
}

function sign(payload, domain, privateKey) {
  return crypto.sign(
    null,
    signatureBytes({ domain, role: ROLE, payload }),
    privateKey,
  ).toString('base64');
}

function unsignedStatus(generation, predecessorStatusId) {
  return {
    schema_version: 'ProgrammeGateStatusArtefact/V2',
    specification_root: '1'.repeat(64),
    code_commit: 'a'.repeat(40),
    environment: 'PRODUCTION',
    generation,
    predecessor_status_id: predecessorStatusId,
    gate_registry_digest: '2'.repeat(64),
    ordered_gate_projection: [{
      gate_id: 'G0_TEST',
      state: 'OPEN',
      evidence_envelope_id: null,
      evidence_payload_digest: null,
    }],
    ordered_work_class_projection: [{
      work_class: 'canonical_work_start',
      state: 'OPEN',
    }],
    validator_executable_digest: '3'.repeat(64),
    validator_configuration_digest: '4'.repeat(64),
    validator_key_id: 'TEST_VALIDATOR',
    signature_algorithm: 'Ed25519',
  };
}

function signedStatus(generation, predecessorStatusId, privateKey) {
  const unsigned = unsignedStatus(generation, predecessorStatusId);
  return {
    ...unsigned,
    signature: sign(unsigned, STATUS_DOMAIN, privateKey),
  };
}

function signedHead({
  generation,
  predecessorGitObjectId,
  status,
  privateKey,
  overrides = {},
}) {
  const unsigned = {
    schema_version: 'ProgrammeStatusPublicationHead/V1',
    generation,
    predecessor_git_object_id: predecessorGitObjectId,
    status_git_object_id: gitBlobObjectId(status, canonicalBytes),
    status_artefact_id: domainDigest(STATUS_ARTEFACT_ID_DOMAIN, status),
    status_artefact_payload_digest: domainDigest(
      STATUS_ARTEFACT_PAYLOAD_DOMAIN,
      status,
    ),
    publisher_key_id: PUBLISHER_KEY_ID,
    signature_algorithm: 'Ed25519',
    ...overrides,
  };
  return {
    ...unsigned,
    signature: sign(unsigned, HEAD_DOMAIN, privateKey),
  };
}

function blob(repository, bytes) {
  return run(repository, ['hash-object', '-w', '--stdin'], {
    input: bytes,
  });
}

function commitPublication(repository, {
  status,
  head,
  parent = null,
  extraEntries = [],
  statusBytes = canonicalBytes(status),
  headBytes = canonicalBytes(head),
  statusMode = '100644',
}) {
  const index = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'current-publication-index-')),
    'index',
  );
  const environment = {
    ...process.env,
    GIT_INDEX_FILE: index,
    GIT_AUTHOR_NAME: 'Programme Gate Publisher',
    GIT_AUTHOR_EMAIL: 'bengoodchild@gmail.com',
    GIT_AUTHOR_DATE: COMMIT_TIME,
    GIT_COMMITTER_NAME: 'Programme Gate Publisher',
    GIT_COMMITTER_EMAIL: 'bengoodchild@gmail.com',
    GIT_COMMITTER_DATE: COMMIT_TIME,
  };
  try {
    const entries = [
      [statusMode, blob(repository, statusBytes), STATUS_PATH],
      ['100644', blob(repository, headBytes), HEAD_PATH],
      ...extraEntries.map((entry) => [
        entry.mode || '100644',
        blob(repository, entry.bytes),
        entry.path,
      ]),
    ];
    for (const [mode, objectId, file] of entries) {
      run(repository, [
        'update-index',
        '--add',
        '--cacheinfo',
        `${mode},${objectId},${file}`,
      ], { env: environment });
    }
    const tree = run(repository, ['write-tree'], { env: environment });
    const args = ['commit-tree', tree];
    if (parent) args.push('-p', parent);
    return run(repository, args, {
      env: environment,
      input: `Publish programme gate status generation ${status.generation}\n`,
    });
  } finally {
    fs.rmSync(path.dirname(index), { recursive: true, force: true });
  }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'current-publication-'));
  const repository = path.join(root, 'repository');
  const remote = path.join(root, 'remote.git');
  fs.mkdirSync(repository);
  fs.mkdirSync(remote);
  run(repository, ['init', '--quiet']);
  run(remote, ['init', '--bare', '--quiet']);
  run(repository, ['remote', 'add', 'origin', remote]);
  const { authority, privateKey } = testAuthority();
  return {
    authority,
    privateKey,
    remote,
    repository,
    root,
    publish(commit) {
      run(repository, [
        'push',
        '--quiet',
        '--force',
        'origin',
        `${commit}:${PUBLICATION_REF}`,
      ]);
    },
    load() {
      return loadCurrentProgrammePublication({
        authority,
        remote: 'origin',
        repositoryRoot: repository,
      });
    },
  };
}

function generationOne(fx, options = {}) {
  const status = options.status
    || signedStatus(1, 'NONE', fx.privateKey);
  const head = options.head || signedHead({
    generation: 1,
    predecessorGitObjectId: 'NONE',
    status,
    privateKey: fx.privateKey,
  });
  const commit = commitPublication(fx.repository, {
    status,
    head,
    parent: options.parent,
    extraEntries: options.extraEntries,
    statusBytes: options.statusBytes,
    headBytes: options.headBytes,
    statusMode: options.statusMode,
  });
  fx.publish(commit);
  return { commit, head, status };
}

test('loads exact signed generation one metadata without comparing code_commit to main', () => {
  const fx = fixture();
  try {
    const published = generationOne(fx);
    assert.deepEqual(fx.load(), {
      ref: PUBLICATION_REF,
      state: 'PRESENT',
      observed_git_object_id: published.commit,
      status_artefact_id: domainDigest(
        STATUS_ARTEFACT_ID_DOMAIN,
        published.status,
      ),
      generation: 1,
    });
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test('rejects a third tree entry and a non-regular status entry', () => {
  for (const variant of ['third', 'non-regular']) {
    const fx = fixture();
    try {
      generationOne(fx, variant === 'third'
        ? {
          extraEntries: [{
            path: 'unexpected.json',
            bytes: Buffer.from('{}'),
          }],
        }
        : { statusMode: '120000' });
      assert.throws(
        () => fx.load(),
        variant === 'third' ? /exactly the two status files/ : /not a regular file/,
      );
    } finally {
      fs.rmSync(fx.root, { recursive: true, force: true });
    }
  }
});

test('rejects non-canonical status bytes', () => {
  const fx = fixture();
  try {
    const status = signedStatus(1, 'NONE', fx.privateKey);
    generationOne(fx, {
      status,
      statusBytes: Buffer.from(JSON.stringify(status, null, 2)),
    });
    assert.throws(() => fx.load(), /does not contain canonical JSON bytes/);
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test('rejects invalid status and publication-head signatures', () => {
  for (const invalid of ['status', 'head']) {
    const fx = fixture();
    try {
      const validStatus = signedStatus(1, 'NONE', fx.privateKey);
      const status = invalid === 'status'
        ? {
          ...validStatus,
          signature: Buffer.alloc(64, 7).toString('base64'),
        }
        : validStatus;
      const validHead = signedHead({
        generation: 1,
        predecessorGitObjectId: 'NONE',
        status,
        privateKey: fx.privateKey,
      });
      const head = invalid === 'head'
        ? {
          ...validHead,
          signature: Buffer.alloc(64, 9).toString('base64'),
        }
        : validHead;
      generationOne(fx, { status, head });
      assert.throws(
        () => fx.load(),
        /signature verification failed/,
      );
    } finally {
      fs.rmSync(fx.root, { recursive: true, force: true });
    }
  }
});

test('rejects a validly signed head that does not bind the status blob', () => {
  const fx = fixture();
  try {
    const status = signedStatus(1, 'NONE', fx.privateKey);
    const head = signedHead({
      generation: 1,
      predecessorGitObjectId: 'NONE',
      status,
      privateKey: fx.privateKey,
      overrides: { status_git_object_id: 'f'.repeat(40) },
    });
    generationOne(fx, { status, head });
    assert.throws(() => fx.load(), /does not bind the exact signed status/);
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test('rejects generation one with a parent', () => {
  const fx = fixture();
  try {
    const parent = run(fx.repository, ['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904']);
    generationOne(fx, { parent });
    assert.throws(() => fx.load(), /generation one must be parentless/);
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test('loads an exact successor and rejects the wrong predecessor status binding', () => {
  const fx = fixture();
  try {
    const predecessor = generationOne(fx);
    const predecessorId = domainDigest(
      STATUS_ARTEFACT_ID_DOMAIN,
      predecessor.status,
    );
    const status = signedStatus(2, predecessorId, fx.privateKey);
    const head = signedHead({
      generation: 2,
      predecessorGitObjectId: predecessor.commit,
      status,
      privateKey: fx.privateKey,
    });
    const commit = commitPublication(fx.repository, {
      status,
      head,
      parent: predecessor.commit,
    });
    fx.publish(commit);
    assert.equal(fx.load().generation, 2);

    const badStatus = signedStatus(2, 'e'.repeat(64), fx.privateKey);
    const badHead = signedHead({
      generation: 2,
      predecessorGitObjectId: predecessor.commit,
      status: badStatus,
      privateKey: fx.privateKey,
    });
    const badCommit = commitPublication(fx.repository, {
      status: badStatus,
      head: badHead,
      parent: predecessor.commit,
    });
    fx.publish(badCommit);
    assert.throws(
      () => fx.load(),
      /does not bind the exact predecessor status/,
    );
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test('rejects a successor whose signed head does not name its sole parent', () => {
  const fx = fixture();
  try {
    const predecessor = generationOne(fx);
    const status = signedStatus(
      2,
      domainDigest(STATUS_ARTEFACT_ID_DOMAIN, predecessor.status),
      fx.privateKey,
    );
    const head = signedHead({
      generation: 2,
      predecessorGitObjectId: 'f'.repeat(40),
      status,
      privateKey: fx.privateKey,
    });
    const commit = commitPublication(fx.repository, {
      status,
      head,
      parent: predecessor.commit,
    });
    fx.publish(commit);
    assert.throws(() => fx.load(), /must name its sole Git parent/);
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});
