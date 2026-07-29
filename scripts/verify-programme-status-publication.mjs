#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const YAML = require('yaml');
const {
  canonicalBytes,
  domainDigest,
} = require('../lib/programme-gates/bytes');
const {
  createGoverningRegistryAuthority,
} = require('../lib/programme-gates/governing-registry');
const {
  HEAD_PATH,
  PUBLICATION_HEAD_PAYLOAD_DOMAIN,
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  STATUS_PATH,
  gitBlobObjectId,
} = require('../lib/programme-gates/publication');
const {
  REGISTRY_DIGESTS,
  TRUSTED_PUBLIC_KEY_REGISTRY,
} = require('../lib/programme-gates/registry');
const { validateSchema } = require('../lib/programme-gates/schema-registry');
const { verifySignature } = require('../lib/programme-gates/signatures');
const {
  createProgrammeStatusAuthority,
  resolveWorkClasses,
  unsignedProgrammeGateStatus,
} = require('../lib/programme-gates/status');
const {
  VALIDATOR_EXECUTABLE_FILES,
  programmeGateValidatorExecutableDigest,
} = require('../lib/programme-gates/validator-executable');

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const MAIN_REF = 'refs/remotes/origin/main';
const PUBLICATION_REMOTE_REF = 'refs/heads/programme-status-publication-head';
const PUBLICATION_LOCAL_REF = 'refs/remotes/origin/programme-status-publication-head';
const STATUS_PUBLISHER_KEY_ID = 'PROGRAMME_STATUS_PUBLISHER_2026_07';
const VALIDATOR_KEY_ID = 'PROGRAMME_GATE_VALIDATOR_2026_07';
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const GOVERNING_REGISTRY_FILE = 'docs/codex-program/programme-gates.yaml';

const VERIFICATION_SOURCE_FILES = Object.freeze([
  ...VALIDATOR_EXECUTABLE_FILES,
  'lib/programme-gates/publication.js',
]);

function fail(message) {
  throw new Error(message);
}

function git(root, args, options = {}) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitBytes(root, ref, file) {
  return git(root, ['show', `${ref}:${file}`], { encoding: null });
}

function gitText(root, ref, file) {
  return gitBytes(root, ref, file).toString('utf8');
}

function resolveCommit(root, ref) {
  return git(root, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
}

function fetchPublicationRefs(root) {
  git(root, [
    'fetch',
    '--no-tags',
    'origin',
    `refs/heads/main:${MAIN_REF}`,
    `${PUBLICATION_REMOTE_REF}:${PUBLICATION_LOCAL_REF}`,
  ]);
}

function parseTree(raw) {
  return raw
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/s);
      if (!match) fail('The publication tree has an invalid Git entry.');
      return {
        mode: match[1],
        type: match[2],
        objectId: match[3],
        path: match[4],
      };
    });
}

export function requireExactPublicationTree(entries) {
  const expectedPaths = [STATUS_PATH, HEAD_PATH].sort();
  const actualPaths = entries.map((entry) => entry.path).sort();
  if (entries.length !== 2
    || actualPaths.some((value, index) => value !== expectedPaths[index])) {
    fail('The publication commit must contain exactly the two status files.');
  }
  for (const entry of entries) {
    if (entry.mode !== '100644' || entry.type !== 'blob') {
      fail(`The publication entry ${entry.path} is not a regular file.`);
    }
  }
}

function requireCanonicalBlob(root, publicationCommit, entry, payload) {
  const storedBytes = gitBytes(root, publicationCommit, entry.path);
  const expectedBytes = canonicalBytes(payload);
  if (!storedBytes.equals(expectedBytes)) {
    fail(`${entry.path} does not contain canonical JSON bytes.`);
  }
  const expectedObjectId = gitBlobObjectId(payload, canonicalBytes);
  if (entry.objectId !== expectedObjectId) {
    fail(`${entry.path} does not match its Git blob ID.`);
  }
}

function assertVerificationSourcesMatchMain(root, mainRef) {
  for (const file of VERIFICATION_SOURCE_FILES) {
    const current = fs.readFileSync(path.resolve(root, file));
    const main = gitBytes(root, mainRef, file);
    if (!current.equals(main)) {
      fail(`Verification source differs from origin/main: ${file}`);
    }
  }
}

function mainBackedReader(root, mainRef) {
  return (absolutePath) => {
    let relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/');
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      const normalPath = absolutePath.replaceAll(path.sep, '/');
      if (normalPath.endsWith(`/${GOVERNING_REGISTRY_FILE}`)) {
        relativePath = GOVERNING_REGISTRY_FILE;
      } else {
        fail('The verifier requested a file outside the repository.');
      }
    }
    return gitBytes(root, mainRef, relativePath);
  };
}

function requireExactGateProjection(status, registry) {
  if (status.ordered_gate_projection.length !== registry.gate_ids.length) {
    fail('The status does not contain all 35 gates.');
  }
  registry.gate_ids.forEach((gateId, index) => {
    const row = status.ordered_gate_projection[index];
    if (row.gate_id !== gateId) fail('The status gate order is not valid.');
    if (row.state === 'PASS') {
      if (!DIGEST_PATTERN.test(row.evidence_envelope_id)
        || !DIGEST_PATTERN.test(row.evidence_payload_digest)) {
        fail(`The passing gate ${gateId} does not contain valid evidence IDs.`);
      }
    } else if (row.state !== 'OPEN'
      || row.evidence_envelope_id !== null
      || row.evidence_payload_digest !== null) {
      fail(`The non-passing gate ${gateId} is not exactly OPEN.`);
    }
  });
}

export function requireStatusHeadBindings({
  status,
  head,
  statusBlobId,
}) {
  const expectedStatusId = domainDigest(STATUS_ARTEFACT_ID_DOMAIN, status);
  const expectedPayloadDigest = domainDigest(STATUS_ARTEFACT_PAYLOAD_DOMAIN, status);
  if (head.status_artefact_id !== expectedStatusId
    || head.status_artefact_payload_digest !== expectedPayloadDigest
    || head.status_git_object_id !== statusBlobId
    || head.generation !== status.generation) {
    fail('The publication head does not bind the exact signed status.');
  }
}

function requireWorkClassProjection(status, statusAuthority) {
  const registry = statusAuthority.registry;
  if (status.ordered_work_class_projection.length !== registry.work_class_ids.length) {
    fail('The status does not contain all 13 work classes.');
  }
  registry.work_class_ids.forEach((workClass, index) => {
    if (status.ordered_work_class_projection[index].work_class !== workClass) {
      fail('The status work-class order is not valid.');
    }
  });
  const gateStateById = new Map(
    status.ordered_gate_projection.map((row) => [row.gate_id, row.state]),
  );
  const expected = resolveWorkClasses({
    authority: statusAuthority,
    gateStateById,
    generation: status.generation,
    predecessorStatusId: status.predecessor_status_id,
  });
  expected.forEach((expectedRow, index) => {
    const actualRow = status.ordered_work_class_projection[index];
    if (actualRow.work_class !== expectedRow.work_class
      || actualRow.state !== expectedRow.state) {
      fail('The signed work classes do not match the governing dependency rules.');
    }
  });
}

function requireSignature(payload, {
  keyId,
  role,
  domain,
  signature,
  at,
}) {
  return verifySignature({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    keyId,
    role,
    domain,
    payload,
    signature,
    at,
  });
}

export function verifyFetchedPublication({
  root = DEFAULT_ROOT,
  mainRef = MAIN_REF,
  publicationRef = PUBLICATION_LOCAL_REF,
} = {}) {
  const mainCommit = resolveCommit(root, mainRef);
  const publicationCommit = resolveCommit(root, publicationRef);
  const entries = parseTree(
    git(root, ['ls-tree', '-rz', '--full-tree', publicationCommit]),
  );
  requireExactPublicationTree(entries);
  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const status = JSON.parse(gitText(root, publicationCommit, STATUS_PATH));
  const head = JSON.parse(gitText(root, publicationCommit, HEAD_PATH));
  const parentLine = git(root, ['rev-list', '--parents', '-n', '1', publicationCommit]).trim();
  const parentCommits = parentLine.split(/\s+/).slice(1);
  if (status.generation === 1 && parentCommits.length !== 0) {
    fail('The generation-one publication commit must have no parent.');
  }
  if (status.generation > 1) {
    if (parentCommits.length !== 1
      || parentCommits[0] !== head.predecessor_git_object_id) {
      fail('The publication commit does not have the exact signed predecessor.');
    }
    const predecessorStatus = JSON.parse(gitText(root, parentCommits[0], STATUS_PATH));
    const predecessorStatusId = domainDigest(
      STATUS_ARTEFACT_ID_DOMAIN,
      predecessorStatus,
    );
    if (status.generation !== predecessorStatus.generation + 1
      || status.predecessor_status_id !== predecessorStatusId) {
      fail('The signed status does not bind the exact predecessor status.');
    }
  }
  requireCanonicalBlob(root, publicationCommit, entryByPath.get(STATUS_PATH), status);
  requireCanonicalBlob(root, publicationCommit, entryByPath.get(HEAD_PATH), head);

  assertVerificationSourcesMatchMain(root, mainRef);
  validateSchema('ProgrammeGateStatusArtefact/V2', status);
  validateSchema('ProgrammeStatusPublicationHead/V1', head);
  const publicationTime = git(root, ['show', '-s', '--format=%cI', publicationCommit]).trim();
  requireSignature(unsignedProgrammeGateStatus(status), {
    keyId: STATUS_PUBLISHER_KEY_ID,
    role: 'STATUS_PUBLISHER',
    domain: 'PROGRAMME_GATE_STATUS/V2',
    signature: status.signature,
    at: publicationTime,
  });
  if (head.publisher_key_id !== STATUS_PUBLISHER_KEY_ID) {
    fail('The publication head uses an unexpected publisher key.');
  }
  const { signature: headSignature, ...unsignedHead } = head;
  requireSignature(unsignedHead, {
    keyId: head.publisher_key_id,
    role: 'STATUS_PUBLISHER',
    domain: 'PROGRAMME_GATE_PUBLICATION_HEAD/V1',
    signature: headSignature,
    at: publicationTime,
  });

  const readMainFile = mainBackedReader(root, mainRef);
  const governingRegistryAuthority = createGoverningRegistryAuthority({
    readFileSync: readMainFile,
    parseYaml: YAML.parse,
    domainDigest,
  });
  const validatorExecutableDigest = programmeGateValidatorExecutableDigest({
    root,
    readFileSync: readMainFile,
  });
  if (status.code_commit !== mainCommit) {
    fail('The signed status code commit is stale.');
  }
  if (status.environment !== 'PRODUCTION') {
    fail('The signed status is not for PRODUCTION.');
  }
  if (status.gate_registry_digest !== governingRegistryAuthority.digest) {
    fail('The signed status does not bind the governing gate registry.');
  }
  if (status.validator_configuration_digest !== REGISTRY_DIGESTS.validator_configuration) {
    fail('The signed status does not bind the validator configuration.');
  }
  if (status.validator_executable_digest !== validatorExecutableDigest) {
    fail('The signed status does not bind the validator executable.');
  }
  if (status.validator_key_id !== VALIDATOR_KEY_ID) {
    fail('The signed status uses an unexpected validator key.');
  }

  requireExactGateProjection(status, governingRegistryAuthority);
  const completionState = status.ordered_work_class_projection.find(
    (row) => row.work_class === 'programme_complete',
  )?.state;
  const statusAuthority = createProgrammeStatusAuthority({
    governingRegistryAuthority,
    domainDigest,
    validateEvidence: () => {
      fail('Evidence validation is not used by the publication consumer.');
    },
    evidencePayloadForDigest: () => {
      fail('Evidence payload projection is not used by the publication consumer.');
    },
    validateStatusSchema: validateSchema,
    verifyStatusSignature: () => true,
    validatorExecutableDigest,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorKeyId: VALIDATOR_KEY_ID,
    bootstrapState: status.generation === 1 ? 'AVAILABLE' : 'CONSUMED',
    terminalPairState: completionState === 'PASS' ? 'VALIDATED' : 'UNVALIDATED',
  });
  requireWorkClassProjection(status, statusAuthority);
  requireStatusHeadBindings({
    status,
    head,
    statusBlobId: entryByPath.get(STATUS_PATH).objectId,
  });
  if (status.generation === 1) {
    if (status.predecessor_status_id !== 'NONE'
      || head.predecessor_git_object_id !== 'NONE') {
      fail('The generation-one publication has an invalid predecessor.');
    }
  }

  return Object.freeze({
    result: 'PASS',
    origin_main_commit: mainCommit,
    publication_commit: publicationCommit,
    generation: status.generation,
    gate_states: Object.fromEntries(
      status.ordered_gate_projection.map((row) => [row.gate_id, row.state]),
    ),
    work_classes: Object.fromEntries(
      status.ordered_work_class_projection.map((row) => [row.work_class, row.state]),
    ),
  });
}

function parseArguments(argv) {
  const options = { root: DEFAULT_ROOT, fetch: true };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--no-fetch') {
      options.fetch = false;
    } else if (argument === '--root') {
      index += 1;
      if (!argv[index]) fail('--root requires a repository path.');
      options.root = path.resolve(argv[index]);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.fetch) fetchPublicationRefs(options.root);
    const result = verifyFetchedPublication({ root: options.root });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`PROGRAMME-STATUS: FAIL: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
