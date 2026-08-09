'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_MAP_PAYLOAD_STORE = 'evidence/canonical-v2/_admitted-source-map-payloads';
const DIGEST_RE = /^[a-f0-9]{64}$/;

class RepositoryPathError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'RepositoryPathError';
  }
}

function pathFail(code, message) {
  throw new RepositoryPathError(code, message);
}

function sourceMapPayloadPathFor(canonicalTextId) {
  if (!DIGEST_RE.test(canonicalTextId || '')) {
    pathFail('PERSISTED_SOURCE_MAP_CANONICAL_TEXT_ID_INVALID', 'canonical text ID must be a lower-case SHA-256 digest');
  }
  return `${SOURCE_MAP_PAYLOAD_STORE}/${canonicalTextId}.deflate`;
}

function assertRecordedSourceMapProvenance(provenance, canonicalTextId) {
  if (!provenance || !DIGEST_RE.test(provenance.source_map_compressed_sha256 || '')) {
    pathFail('PERSISTED_SOURCE_MAP_PROVENANCE_INVALID', 'recorded source-map path and SHA-256 are required');
  }
  const expectedPath = sourceMapPayloadPathFor(canonicalTextId);
  if (provenance.source_map_payload_path !== expectedPath) {
    const candidate = provenance.source_map_payload_path;
    const safeRelative = typeof candidate === 'string'
      && !path.isAbsolute(candidate)
      && !path.win32.isAbsolute(candidate)
      && !candidate.includes('\\')
      && !candidate.split('/').includes('..');
    pathFail(
      safeRelative ? 'PERSISTED_SOURCE_MAP_PATH_MISMATCH' : 'PERSISTED_SOURCE_MAP_PATH_INVALID',
      `recorded source-map path must equal ${expectedPath}`,
    );
  }
  return provenance;
}

function resolveContainedRepositoryPath(repoRoot, repositoryRelativePath, {
  allowMissingLeaf = false,
  codePrefix = 'REPOSITORY_FILE',
  expectedType = 'file',
  label = 'repository file',
} = {}) {
  if (typeof repositoryRelativePath !== 'string' || repositoryRelativePath.trim() === ''
    || repositoryRelativePath.includes('\0') || repositoryRelativePath.includes('\\')
    || path.isAbsolute(repositoryRelativePath) || path.win32.isAbsolute(repositoryRelativePath)) {
    pathFail(`${codePrefix}_PATH_INVALID`, `${label} must be a non-empty repository-relative path`);
  }
  const segments = repositoryRelativePath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    pathFail(`${codePrefix}_PATH_TRAVERSAL`, `${label} contains a forbidden path segment`);
  }

  const root = path.resolve(repoRoot);
  const realRoot = fs.realpathSync(root);
  const target = path.resolve(root, repositoryRelativePath);
  const lexicalRelative = path.relative(root, target);
  if (lexicalRelative === '..' || lexicalRelative.startsWith(`..${path.sep}`)
    || path.isAbsolute(lexicalRelative)) {
    pathFail(`${codePrefix}_PATH_ESCAPE`, `${label} escapes the repository root`);
  }

  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    cursor = path.resolve(cursor, segment);
    let stat;
    try {
      stat = fs.lstatSync(cursor);
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissingLeaf && index === segments.length - 1) return target;
      if (error.code === 'ENOENT') pathFail(`${codePrefix}_NOT_FOUND`, `${label} does not exist`);
      throw error;
    }
    if (stat.isSymbolicLink()) {
      pathFail(`${codePrefix}_SYMLINK_REFUSED`, `${label} contains symbolic-link component ${segment}`);
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      pathFail(`${codePrefix}_NOT_DIRECTORY`, `${label} has a non-directory parent component`);
    }
    if (index === segments.length - 1 && expectedType === 'file' && !stat.isFile()) {
      pathFail(`${codePrefix}_NOT_REGULAR_FILE`, `${label} is not a regular file`);
    }
    if (index === segments.length - 1 && expectedType === 'directory' && !stat.isDirectory()) {
      pathFail(`${codePrefix}_NOT_DIRECTORY`, `${label} is not a directory`);
    }
  }

  const realTarget = fs.realpathSync(target);
  const realRelative = path.relative(realRoot, realTarget);
  if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    pathFail(`${codePrefix}_REALPATH_ESCAPE`, `${label} resolves outside the repository root`);
  }
  return target;
}

function resolveSourceMapPayloadPath({ repoRoot, canonicalTextId, allowMissingLeaf = false }) {
  return resolveContainedRepositoryPath(repoRoot, sourceMapPayloadPathFor(canonicalTextId), {
    allowMissingLeaf,
    codePrefix: 'PERSISTED_SOURCE_MAP',
    label: 'persisted source-map payload',
  });
}

function readSourceMapPayload({ repoRoot, canonicalTextId }) {
  const payloadPath = resolveSourceMapPayloadPath({ repoRoot, canonicalTextId });
  const noFollow = fs.constants.O_NOFOLLOW;
  if (!Number.isInteger(noFollow)) {
    pathFail('PERSISTED_SOURCE_MAP_NOFOLLOW_UNAVAILABLE', 'platform does not support no-follow payload reads');
  }

  let descriptor;
  try {
    descriptor = fs.openSync(payloadPath, fs.constants.O_RDONLY | noFollow);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) {
      pathFail('PERSISTED_SOURCE_MAP_NOT_REGULAR_FILE', 'persisted source-map payload is not a regular file');
    }
    return fs.readFileSync(descriptor);
  } catch (error) {
    if (error instanceof RepositoryPathError) throw error;
    if (error.code === 'ELOOP') {
      pathFail('PERSISTED_SOURCE_MAP_SYMLINK_REFUSED', 'persisted source-map payload became a symbolic link before it was opened');
    }
    if (error.code === 'ENOENT') {
      pathFail('PERSISTED_SOURCE_MAP_NOT_FOUND', 'persisted source-map payload does not exist');
    }
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

module.exports = {
  RepositoryPathError,
  SOURCE_MAP_PAYLOAD_STORE,
  sourceMapPayloadPathFor,
  assertRecordedSourceMapProvenance,
  resolveContainedRepositoryPath,
  resolveSourceMapPayloadPath,
  readSourceMapPayload,
};
