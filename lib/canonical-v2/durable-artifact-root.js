'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_ENV_KEY = 'CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT';

class DurableArtifactRootError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DurableArtifactRootError';
    this.code = code;
  }
}

function isInside(root, candidate) {
  const relation = path.relative(root, candidate);
  return relation === '' || (relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation));
}

function temporaryRoots() {
  const roots = ['/tmp', '/private/tmp', '/var/tmp', os.tmpdir()];
  for (const root of [...roots]) {
    if (root.startsWith('/var/')) roots.push(`/private${root}`);
  }
  return [...new Set(roots)]
    .map((root) => path.resolve(root));
}

function rejectTemporaryRoot(candidate) {
  if (temporaryRoots().some((temporaryRoot) => isInside(temporaryRoot, candidate))) {
    throw new DurableArtifactRootError(
      'DURABLE_ARTIFACT_ROOT_TEMPORARY',
      'Artifact root must not be inside an operating-system temporary directory.',
    );
  }
}

function resolveDurableArtifactRoot({
  root,
  environment = process.env,
  environmentKey = DEFAULT_ENV_KEY,
  certificationMode = false,
  requireExisting = false,
} = {}) {
  const supplied = root === undefined ? environment?.[environmentKey] : root;
  if (typeof supplied !== 'string' || !supplied.trim()) {
    if (certificationMode) {
      throw new DurableArtifactRootError(
        'DURABLE_ARTIFACT_ROOT_REQUIRED',
        `Certification requires an explicit absolute durable artifact root via ${environmentKey}.`,
      );
    }
    return null;
  }
  if (supplied !== supplied.trim() || !path.isAbsolute(supplied)) {
    throw new DurableArtifactRootError(
      'DURABLE_ARTIFACT_ROOT_NOT_ABSOLUTE',
      'Artifact root must be an explicit absolute path.',
    );
  }
  const candidate = path.resolve(supplied);
  rejectTemporaryRoot(candidate);
  if (requireExisting) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
      throw new DurableArtifactRootError(
        'DURABLE_ARTIFACT_ROOT_UNAVAILABLE',
        `Artifact root is unavailable: ${candidate}`,
      );
    }
    const realPath = fs.realpathSync(candidate);
    rejectTemporaryRoot(realPath);
    return realPath;
  }
  return candidate;
}

module.exports = {
  DEFAULT_ENV_KEY,
  DurableArtifactRootError,
  resolveDurableArtifactRoot,
};
