#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  compileLegacyF1CanonicalContractBundleMember,
  assembleCanonicalContractBundlePreReviewSourceClosure,
} = require('../lib/canonical-v2/canonical-contract-bundle-pre-review-source-closure');
const {
  SPECIFICATION_MANIFEST_PATH,
  SPECIFICATION_ROOT_DOMAIN,
  SPECIFICATION_ROOT_INPUT_ENCODING,
  SPECIFICATION_ROOT_MEMBERSHIP,
} = require('../lib/canonical-v2/canonical-contract-bundle-pre-review-package-assembler');

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const SUCCESSOR_CONTRACT_ROOT = 'contracts/canonical-v2/successor';
const OUTPUT_DIRECTORY = 'evidence/contract-freeze';
const COMMIT_RE = /^[a-f0-9]{40}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = {
    codeCommit: null,
    environment: null,
    approvalEpochNonce: null,
    output: null,
    check: false,
  };
  const values = new Map([
    ['--code-commit', 'codeCommit'],
    ['--environment', 'environment'],
    ['--approval-epoch-nonce', 'approvalEpochNonce'],
    ['--output', 'output'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      if (options.check) fail('--check may be supplied only once');
      options.check = true;
      continue;
    }
    const key = values.get(argument);
    if (!key) fail(`Unknown argument: ${argument}`);
    if (options[key] !== null) fail(`${argument} may be supplied only once`);
    index += 1;
    if (!argv[index]) fail(`${argument} requires a value`);
    options[key] = argv[index];
  }
  if (!COMMIT_RE.test(options.codeCommit || '')) {
    fail('--code-commit must be an exact 40-character lowercase Git commit');
  }
  if (options.environment !== 'STAGING') {
    fail('--environment must be exactly STAGING');
  }
  if (
    typeof options.approvalEpochNonce !== 'string'
    || options.approvalEpochNonce.length === 0
    || Buffer.byteLength(options.approvalEpochNonce, 'utf8') > 256
    || /[\u0000-\u001f\u007f]/.test(options.approvalEpochNonce)
  ) {
    fail('--approval-epoch-nonce must be a bounded non-empty string without control bytes');
  }
  if (options.check && options.output === null) {
    fail('--check requires an explicit --output path');
  }
  if (options.output !== null) validateOutputRelativePath(options.output);
  return options;
}

function validateSafeRelativePath(value, label) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > 512
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes('\0')
    || value.includes('\n')
    || !/^[A-Za-z0-9._/-]+$/.test(value)
    || value.split('/').some((part) => part === '.' || part === '..' || part === '')
  ) {
    fail(`${label} must be a safe repository-relative path`);
  }
}

function validateOutputRelativePath(value) {
  validateSafeRelativePath(value, '--output');
  if (!value.startsWith(`${OUTPUT_DIRECTORY}/`) || !value.endsWith('.json')) {
    fail(`--output must name a .json file below ${OUTPUT_DIRECTORY}/`);
  }
}

function resolveRepositoryPath(repositoryRoot, relativePath, label) {
  validateSafeRelativePath(relativePath, label);
  const root = fs.realpathSync(repositoryRoot);
  const resolved = path.resolve(root, ...relativePath.split('/'));
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    fail(`${label} escapes the repository root`);
  }
  return resolved;
}

function readRegularRepositoryFile(repositoryRoot, relativePath, label) {
  const absolutePath = resolveRepositoryPath(repositoryRoot, relativePath, label);
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch {
    fail(`${label} does not exist: ${relativePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${label} must be a regular non-symbolic-link file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath);
}

function parseSpecificationManifest(bytes) {
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('The governing specification manifest is not valid UTF-8 JSON');
  }
  if (
    !manifest
    || typeof manifest !== 'object'
    || Array.isArray(manifest)
    || manifest.schema !== 'codex-program-specification-manifest/v1'
    || manifest.domain_separator !== SPECIFICATION_ROOT_DOMAIN
    || manifest.root_input_encoding !== SPECIFICATION_ROOT_INPUT_ENCODING
    || manifest.root_membership !== SPECIFICATION_ROOT_MEMBERSHIP
    || !Array.isArray(manifest.files)
    || manifest.files.length !== 5
  ) {
    fail('The governing specification manifest does not match the frozen six-member root contract');
  }
  return manifest;
}

function readGoverningSpecificationMembers(repositoryRoot = REPOSITORY_ROOT) {
  const manifestBytes = readRegularRepositoryFile(
    repositoryRoot,
    SPECIFICATION_MANIFEST_PATH,
    'governing specification manifest',
  );
  const manifest = parseSpecificationManifest(manifestBytes);
  const members = [{
    order: 1,
    path: SPECIFICATION_MANIFEST_PATH,
    byte_length: manifestBytes.length,
    payload_digest: sha256Hex(manifestBytes),
    source_bytes_base64: manifestBytes.toString('base64'),
  }];
  const seenPaths = new Set([SPECIFICATION_MANIFEST_PATH]);
  for (let index = 0; index < manifest.files.length; index += 1) {
    const declared = manifest.files[index];
    if (
      !declared
      || typeof declared !== 'object'
      || Array.isArray(declared)
      || Object.keys(declared).sort().join(',') !== 'byte_length,order,path,sha256'
      || declared.order !== index + 2
      || !Number.isSafeInteger(declared.byte_length)
      || declared.byte_length < 1
      || typeof declared.sha256 !== 'string'
      || !SHA256_RE.test(declared.sha256)
    ) {
      fail(`Invalid governing specification declaration at manifest.files[${index}]`);
    }
    validateSafeRelativePath(declared.path, `manifest.files[${index}].path`);
    if (seenPaths.has(declared.path)) {
      fail(`Duplicate governing specification path: ${declared.path}`);
    }
    seenPaths.add(declared.path);
    const bytes = readRegularRepositoryFile(
      repositoryRoot,
      declared.path,
      `governing specification member ${declared.path}`,
    );
    const digest = sha256Hex(bytes);
    if (bytes.length !== declared.byte_length || digest !== declared.sha256) {
      fail(`Governing specification member drift: ${declared.path}`);
    }
    members.push({
      order: declared.order,
      path: declared.path,
      byte_length: bytes.length,
      payload_digest: digest,
      source_bytes_base64: bytes.toString('base64'),
    });
  }
  return members;
}

function currentRootCompilerInput(repositoryRoot) {
  const compilation = compileCanonicalContractInput({
    root_directory: path.join(repositoryRoot, SUCCESSOR_CONTRACT_ROOT),
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: compilation,
  });
  return {
    canonical_contract_input_compilation: compilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  };
}

function assembleOneReviewSourceClosure({ repositoryRoot, codeCommit, approvalEpochNonce }) {
  return assembleCanonicalContractBundlePreReviewSourceClosure({
    ...currentRootCompilerInput(repositoryRoot),
    predecessor_canonical_contract_bundle_members: [
      compileLegacyF1CanonicalContractBundleMember(),
    ],
    governing_specification_members: readGoverningSpecificationMembers(repositoryRoot),
    code_commit: codeCommit,
    environment: 'STAGING',
    approval_epoch_nonce: approvalEpochNonce,
  });
}

function generateReviewSourceClosure({
  repositoryRoot = REPOSITORY_ROOT,
  codeCommit,
  approvalEpochNonce,
} = {}) {
  const first = assembleOneReviewSourceClosure({
    repositoryRoot,
    codeCommit,
    approvalEpochNonce,
  });
  const second = assembleOneReviewSourceClosure({
    repositoryRoot,
    codeCommit,
    approvalEpochNonce,
  });
  const firstBytes = Buffer.from(canonicalJson(first), 'utf8');
  const secondBytes = Buffer.from(canonicalJson(second), 'utf8');
  if (!firstBytes.equals(secondBytes)) {
    fail('Two uncached review-source-closure assemblies produced different canonical bytes');
  }
  if (first.disposition?.state !== 'PRE_REVIEW_SOURCE_CLOSED_NOT_REVIEWED') {
    fail('The assembled package did not retain the required pre-review-only state');
  }
  return firstBytes;
}

function gitOutput(repositoryRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail(`Unable to read Git ${args.join(' ')}`);
  }
}

function assertCleanGitBinding(repositoryRoot, codeCommit, allowedUntrackedOutput = null) {
  const head = gitOutput(repositoryRoot, ['rev-parse', 'HEAD']);
  if (head !== codeCommit) {
    fail('--code-commit must exactly equal git rev-parse HEAD');
  }
  const status = gitOutput(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  const allowedStatus = allowedUntrackedOutput === null
    ? []
    : [`?? ${allowedUntrackedOutput}`];
  if (status !== '' && !allowedStatus.includes(status)) {
    fail('Refusing to generate from a dirty Git worktree');
  }
}

function assertNoSymbolicLinkInExistingParents(repositoryRoot, relativePath) {
  const root = fs.realpathSync(repositoryRoot);
  let current = root;
  for (const segment of relativePath.split('/').slice(0, -1)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) continue;
    if (fs.lstatSync(current).isSymbolicLink()) {
      fail(`--output parent must not be a symbolic link: ${segment}`);
    }
  }
}

function writeOutputAtomically(repositoryRoot, relativePath, bytes) {
  validateOutputRelativePath(relativePath);
  assertNoSymbolicLinkInExistingParents(repositoryRoot, relativePath);
  const destination = resolveRepositoryPath(repositoryRoot, relativePath, '--output');
  const directory = path.dirname(destination);
  fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  const temporary = path.join(
    directory,
    `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, bytes, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function checkOutput(repositoryRoot, relativePath, bytes) {
  const destination = resolveRepositoryPath(repositoryRoot, relativePath, '--output');
  let actual;
  try {
    const stat = fs.lstatSync(destination);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('--output must be a regular non-symbolic-link file for --check');
    actual = fs.readFileSync(destination);
  } catch (error) {
    if (error.message.startsWith('--output')) throw error;
    fail(`Review source-closure output does not exist: ${relativePath}`);
  }
  if (!actual.equals(bytes)) fail('Review source-closure output drifted from the exact generated bytes');
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  assertCleanGitBinding(
    REPOSITORY_ROOT,
    options.codeCommit,
    options.output,
  );
  const bytes = generateReviewSourceClosure({
    repositoryRoot: REPOSITORY_ROOT,
    codeCommit: options.codeCommit,
    approvalEpochNonce: options.approvalEpochNonce,
  });
  if (options.check) {
    checkOutput(REPOSITORY_ROOT, options.output, bytes);
  } else if (options.output !== null) {
    writeOutputAtomically(REPOSITORY_ROOT, options.output, bytes);
  } else {
    process.stdout.write(bytes);
  }
}

if (
  process.argv[1]
  && fs.realpathSync(path.resolve(process.argv[1]))
    === fs.realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

export {
  OUTPUT_DIRECTORY,
  REPOSITORY_ROOT,
  parseArguments,
  readGoverningSpecificationMembers,
  generateReviewSourceClosure,
  assertCleanGitBinding,
};
