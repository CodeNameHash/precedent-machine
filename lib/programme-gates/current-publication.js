const { spawnSync } = require('node:child_process');

const {
  HEAD_PATH,
  PUBLICATION_REF,
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  STATUS_PATH,
  gitBlobObjectId,
} = require('./publication');

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const STATUS_SIGNATURE_DOMAIN = 'PROGRAMME_GATE_STATUS/V2';
const PUBLICATION_HEAD_SIGNATURE_DOMAIN =
  'PROGRAMME_GATE_PUBLICATION_HEAD/V1';
const STATUS_PUBLISHER_ROLE = 'STATUS_PUBLISHER';
const authorityBrands = new WeakSet();

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extras = keys.filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !keys.includes(key));
  if (extras.length > 0) {
    throw new Error(`${label} has unsupported fields: ${extras.join(', ')}`);
  }
  if (missing.length > 0) {
    throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
  }
}

function requireFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`${label} must be a function`);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function childEnvironment() {
  const environment = { ...process.env };
  delete environment.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY;
  delete environment.VERCEL_TOKEN;
  return environment;
}

function git(repositoryRoot, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: encoding === null ? null : encoding,
    env: childEnvironment(),
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed while reading the current publication`);
  }
  return encoding === null ? result.stdout : result.stdout.trim();
}

function remotePublicationObjectId(repositoryRoot, remote) {
  const output = git(repositoryRoot, [
    'ls-remote',
    '--refs',
    remote,
    PUBLICATION_REF,
  ]);
  if (!output) {
    throw new Error('the protected programme publication ref is absent');
  }
  const rows = output.split('\n');
  if (rows.length !== 1) {
    throw new Error('the protected programme publication ref is ambiguous');
  }
  const [objectId, ref, extra] = rows[0].split(/\s+/);
  if (extra !== undefined
    || ref !== PUBLICATION_REF
    || !COMMIT_PATTERN.test(objectId || '')) {
    throw new Error('the protected programme publication ref is malformed');
  }
  return objectId;
}

function parseTree(raw) {
  return raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((row) => {
      const match = row.match(
        /^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/s,
      );
      if (!match) {
        throw new Error('the current publication tree is malformed');
      }
      return Object.freeze({
        mode: match[1],
        type: match[2],
        git_blob_object_id: match[3],
        path: match[4],
      });
    });
}

function requireExactTree(entries) {
  const expectedPaths = [STATUS_PATH, HEAD_PATH].sort();
  const paths = entries.map((entry) => entry.path).sort();
  if (entries.length !== expectedPaths.length
    || paths.some((entry, index) => entry !== expectedPaths[index])) {
    throw new Error(
      'the current publication tree must contain exactly the two status files',
    );
  }
  for (const entry of entries) {
    if (entry.mode !== '100644' || entry.type !== 'blob') {
      throw new Error(
        `the current publication entry ${entry.path} is not a regular file`,
      );
    }
  }
}

function parseCanonicalJson(bytes, label, authority) {
  let payload;
  try {
    payload = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (!authority.canonicalBytes(payload).equals(bytes)) {
    throw new Error(`${label} does not contain canonical JSON bytes`);
  }
  return payload;
}

function commitParents(repositoryRoot, commit) {
  const row = git(repositoryRoot, [
    'rev-list',
    '--parents',
    '-n',
    '1',
    commit,
  ]).split(/\s+/);
  if (row[0] !== commit || row.slice(1).some((parent) => (
    !COMMIT_PATTERN.test(parent)
  ))) {
    throw new Error('the current publication commit ancestry is malformed');
  }
  return row.slice(1);
}

function requireDigest(value, label) {
  if (!DIGEST_PATTERN.test(value || '')) {
    throw new Error(`${label} is not a SHA-256 digest`);
  }
}

function publisherKeyId(keyRegistry) {
  const matches = keyRegistry.keys.filter((key) => (
    key.algorithm === 'Ed25519'
    && Array.isArray(key.permitted_roles)
    && key.permitted_roles.includes(STATUS_PUBLISHER_ROLE)
    && Array.isArray(key.permitted_domains)
    && key.permitted_domains.includes(STATUS_SIGNATURE_DOMAIN)
    && key.permitted_domains.includes(PUBLICATION_HEAD_SIGNATURE_DOMAIN)
  ));
  if (matches.length !== 1) {
    throw new Error('the trusted status-publisher key is unavailable or ambiguous');
  }
  return matches[0].key_id;
}

function createCurrentPublicationAuthority(dependencies) {
  requireExactKeys(dependencies, [
    'canonicalBytes',
    'domainDigest',
    'keyRegistry',
    'validateSchema',
    'verifySignature',
  ], 'current publication authority dependencies');
  const validateSchema = requireFunction(
    dependencies.validateSchema,
    'validateSchema',
  );
  validateSchema(
    'TrustedProgrammeGatePublicKeys/V1',
    dependencies.keyRegistry,
  );
  if (dependencies.keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('the trusted public-key registry is not active');
  }
  const keyRegistry = structuredClone(dependencies.keyRegistry);
  const authority = Object.freeze({
    canonicalBytes: requireFunction(
      dependencies.canonicalBytes,
      'canonicalBytes',
    ),
    domainDigest: requireFunction(
      dependencies.domainDigest,
      'domainDigest',
    ),
    keyRegistry: deepFreeze(keyRegistry),
    publisherKeyId: publisherKeyId(keyRegistry),
    validateSchema,
    verifySignature: requireFunction(
      dependencies.verifySignature,
      'verifySignature',
    ),
  });
  authorityBrands.add(authority);
  return authority;
}

function requireCurrentPublicationAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed current publication authority is required');
  }
  return value;
}

function requireSignature(authority, payload, {
  domain,
  keyId,
  signature,
  at,
}) {
  if (authority.verifySignature({
    keyRegistry: authority.keyRegistry,
    keyId,
    role: STATUS_PUBLISHER_ROLE,
    domain,
    payload,
    signature,
    at,
  }) !== true) {
    throw new Error(`the ${domain} signature was not verified`);
  }
}

function readBlob(repositoryRoot, entry) {
  return git(
    repositoryRoot,
    ['cat-file', 'blob', entry.git_blob_object_id],
    { encoding: null },
  );
}

function validatePredecessor({
  authority,
  repositoryRoot,
  status,
  head,
  currentCommit,
}) {
  const parents = commitParents(repositoryRoot, currentCommit);
  if (status.generation === 1) {
    if (status.predecessor_status_id !== 'NONE'
      || head.predecessor_git_object_id !== 'NONE'
      || parents.length !== 0) {
      throw new Error(
        'generation one must be parentless with predecessor NONE',
      );
    }
    return;
  }
  if (parents.length !== 1
    || head.predecessor_git_object_id !== parents[0]
    || !COMMIT_PATTERN.test(head.predecessor_git_object_id || '')) {
    throw new Error(
      'a successor publication must name its sole Git parent',
    );
  }
  requireDigest(
    status.predecessor_status_id,
    'the predecessor status artefact ID',
  );
  const predecessorBytes = git(
    repositoryRoot,
    ['show', `${parents[0]}:${STATUS_PATH}`],
    { encoding: null },
  );
  const predecessor = parseCanonicalJson(
    predecessorBytes,
    'the predecessor programme status',
    authority,
  );
  authority.validateSchema('ProgrammeGateStatusArtefact/V2', predecessor);
  const predecessorStatusId = authority.domainDigest(
    STATUS_ARTEFACT_ID_DOMAIN,
    predecessor,
  );
  if (status.generation !== predecessor.generation + 1
    || status.predecessor_status_id !== predecessorStatusId) {
    throw new Error(
      'the current publication does not bind the exact predecessor status',
    );
  }
}

function loadCurrentProgrammePublication(input) {
  requireExactKeys(
    input,
    ['authority', 'remote', 'repositoryRoot'],
    'current publication loader input',
  );
  const authority = requireCurrentPublicationAuthority(input.authority);
  if (typeof input.repositoryRoot !== 'string'
    || input.repositoryRoot.length === 0
    || typeof input.remote !== 'string'
    || input.remote.length === 0
    || /[\r\n\0]/.test(input.remote)) {
    throw new TypeError('repositoryRoot and remote must be non-empty strings');
  }

  const observedCommit = remotePublicationObjectId(
    input.repositoryRoot,
    input.remote,
  );
  git(input.repositoryRoot, [
    'fetch',
    '--quiet',
    '--no-tags',
    '--no-write-fetch-head',
    input.remote,
    PUBLICATION_REF,
  ]);
  if (remotePublicationObjectId(input.repositoryRoot, input.remote)
    !== observedCommit) {
    throw new Error('the protected programme publication ref changed during fetch');
  }
  git(input.repositoryRoot, ['cat-file', '-e', `${observedCommit}^{commit}`]);

  const entries = parseTree(git(
    input.repositoryRoot,
    ['ls-tree', '-rz', '--full-tree', observedCommit],
    { encoding: null },
  ));
  requireExactTree(entries);
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const statusEntry = byPath.get(STATUS_PATH);
  const headEntry = byPath.get(HEAD_PATH);
  const status = parseCanonicalJson(
    readBlob(input.repositoryRoot, statusEntry),
    'the current programme status',
    authority,
  );
  const head = parseCanonicalJson(
    readBlob(input.repositoryRoot, headEntry),
    'the current programme publication head',
    authority,
  );
  authority.validateSchema('ProgrammeGateStatusArtefact/V2', status);
  authority.validateSchema('ProgrammeStatusPublicationHead/V1', head);

  const publicationTime = git(input.repositoryRoot, [
    'show',
    '-s',
    '--format=%cI',
    observedCommit,
  ]);
  const { signature: statusSignature, ...unsignedStatus } = status;
  requireSignature(authority, unsignedStatus, {
    domain: STATUS_SIGNATURE_DOMAIN,
    keyId: authority.publisherKeyId,
    signature: statusSignature,
    at: publicationTime,
  });
  if (head.publisher_key_id !== authority.publisherKeyId) {
    throw new Error('the current publication head uses an unexpected publisher key');
  }
  const { signature: headSignature, ...unsignedHead } = head;
  requireSignature(authority, unsignedHead, {
    domain: PUBLICATION_HEAD_SIGNATURE_DOMAIN,
    keyId: head.publisher_key_id,
    signature: headSignature,
    at: publicationTime,
  });

  const statusArtefactId = authority.domainDigest(
    STATUS_ARTEFACT_ID_DOMAIN,
    status,
  );
  const statusPayloadDigest = authority.domainDigest(
    STATUS_ARTEFACT_PAYLOAD_DOMAIN,
    status,
  );
  if (head.generation !== status.generation
    || head.status_artefact_id !== statusArtefactId
    || head.status_artefact_payload_digest !== statusPayloadDigest
    || head.status_git_object_id !== statusEntry.git_blob_object_id
    || gitBlobObjectId(status, authority.canonicalBytes)
      !== statusEntry.git_blob_object_id) {
    throw new Error(
      'the current publication head does not bind the exact signed status',
    );
  }
  if (!Number.isInteger(status.generation) || status.generation < 1) {
    throw new Error('the current publication generation is invalid');
  }
  validatePredecessor({
    authority,
    repositoryRoot: input.repositoryRoot,
    status,
    head,
    currentCommit: observedCommit,
  });

  return Object.freeze({
    ref: PUBLICATION_REF,
    state: 'PRESENT',
    observed_git_object_id: observedCommit,
    status_artefact_id: statusArtefactId,
    generation: status.generation,
  });
}

module.exports = {
  createCurrentPublicationAuthority,
  loadCurrentProgrammePublication,
  requireCurrentPublicationAuthority,
};
