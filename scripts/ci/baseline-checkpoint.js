#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  SAFE_EXACT_PATHS,
} = require('./baseline-manifest-impact');

const DIGEST_VERSION = 'baseline-input-digest/v1';
const CACHE_KEY_PREFIX = 'baseline-manifest-checkpoint-v1-';
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const GIT_REF_PATTERN = /^(?:HEAD|[0-9a-f]{40})$/;
const MAX_TREE_BYTES = 128 * 1024 * 1024;
const BASELINE_GATE_CONTRACT = Object.freeze({
  command: 'npm run gate:baseline',
  nodeMajor: 22,
  runner: 'ubuntu-latest',
});
const ALWAYS_INPUT_EXACT_PATHS = new Set([
  '.gitattributes',
  '.npmrc',
  'evidence/canonical-v2/baseline-manifest.json',
  'npm-shrinkwrap.json',
  'package-lock.json',
  'package.json',
  'scripts/canonical-v2-baseline-manifest.mjs',
]);
const ALWAYS_INPUT_PREFIXES = Object.freeze([
  'contracts/',
  'evidence/canonical-v2/_admitted-source-map-payloads/',
  'lib/',
  'tests/fixtures/',
]);
const REVIEWED_LIB_EXCLUSIONS = new Set(
  [...SAFE_EXACT_PATHS].filter((file) => file.startsWith('lib/')),
);

function runtimeIdentity() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    zlib: process.versions.zlib,
  };
}

function validatedRuntimeIdentity(runtime) {
  const keys = Object.keys(runtime || {}).sort();
  if (keys.join(',') !== 'arch,node,platform,zlib'
    || !keys.every((key) => typeof runtime[key] === 'string' && runtime[key])) {
    throw new Error('runtime identity is malformed');
  }
  return runtime;
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function digestDomain(runtime = runtimeIdentity()) {
  const identity = validatedRuntimeIdentity(runtime);
  return JSON.stringify({
    version: DIGEST_VERSION,
    gate: BASELINE_GATE_CONTRACT,
    runtime: identity,
    inputSelection: {
      exactPaths: [...ALWAYS_INPUT_EXACT_PATHS].sort(),
      prefixes: [...ALWAYS_INPUT_PREFIXES],
      discoveredRuns: 'all tracked descendants of immediate evidence/canonical-v2/*/adapter-result.json',
      unknownPathBytes: 'included',
      selectedSymlinksAndSubmodules: 'digest unavailable',
    },
    reviewedLibExclusions: [...REVIEWED_LIB_EXCLUSIONS].sort(),
    checkpointImplementation: sha256(fs.readFileSync(__filename)),
  });
}

function splitNullDelimited(buffer) {
  if (buffer.length === 0) return [];
  if (buffer[buffer.length - 1] !== 0) throw new Error('git ls-tree output is not NUL terminated');
  const records = [];
  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) continue;
    records.push(buffer.subarray(start, index));
    start = index + 1;
  }
  return records;
}

function parseTreeRecord(record) {
  const tab = record.indexOf(0x09);
  if (tab <= 0 || tab === record.length - 1) throw new Error('malformed git ls-tree record');
  const metadata = record.subarray(0, tab).toString('ascii').split(' ');
  if (metadata.length !== 3) throw new Error('malformed git ls-tree metadata');
  const [mode, type, object] = metadata;
  const validBlob = type === 'blob' && /^(?:100644|100755|120000)$/.test(mode);
  const validCommit = type === 'commit' && mode === '160000';
  if ((!validBlob && !validCommit) || !/^[0-9a-f]{40}$/.test(object)) {
    throw new Error('unexpected git ls-tree entry');
  }
  return { mode, object, path: record.subarray(tab + 1), type };
}

function decodedGitPath(pathBuffer) {
  const file = pathBuffer.toString('utf8');
  if (!Buffer.from(file, 'utf8').equals(pathBuffer)) return null;
  return file;
}

function readTree(ref, cwd) {
  if (!GIT_REF_PATTERN.test(ref)) throw new Error('ref must be HEAD or a lowercase GitHub SHA-1');
  const result = spawnSync('git', ['ls-tree', '-rz', '--full-tree', ref, '--'], {
    cwd,
    encoding: null,
    maxBuffer: MAX_TREE_BYTES,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8').trim() : '';
    throw new Error(detail || `git ls-tree exited ${result.status}`);
  }
  return splitNullDelimited(result.stdout).map(parseTreeRecord);
}

function readBlob(object, cwd) {
  const result = spawnSync('git', ['cat-file', 'blob', object], {
    cwd,
    encoding: null,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('unable to read source-reference blob');
  return result.stdout;
}

function rawSourcePath(sourceReferenceBuffer) {
  let sourceReference;
  try {
    sourceReference = JSON.parse(sourceReferenceBuffer.toString('utf8'));
  } catch (_) {
    throw new Error('source-reference.json is malformed');
  }
  if (!sourceReference || Array.isArray(sourceReference) || typeof sourceReference !== 'object') {
    throw new Error('source-reference.json must contain an object');
  }
  const recorded = sourceReference.admitted_source_capture_inputs;
  if (recorded !== undefined && recorded !== null
    && (Array.isArray(recorded) || typeof recorded !== 'object')) {
    throw new Error('source-reference.json capture inputs are malformed');
  }
  const raw = (recorded && recorded.raw_html_path)
    || sourceReference.reused_committed_raw_html;
  if (typeof raw !== 'string' || !raw || raw !== raw.trim() || raw.includes('\\')
    || path.posix.isAbsolute(raw) || path.posix.normalize(raw) !== raw
    || raw.split('/').includes('..')) {
    throw new Error('source-reference.json raw HTML path is unsafe or missing');
  }
  return raw;
}

function selectBaselineInputEntries(entries, { cwd = process.cwd() } = {}) {
  const decoded = entries.map((entry) => ({ entry, file: decodedGitPath(entry.path) }));
  for (const { entry, file } of decoded) {
    if (file && /^evidence\/canonical-v2\/[^/]+$/.test(file)
      && (entry.mode === '120000' || entry.type === 'commit')) {
      throw new Error('evidence root contains a symlink or submodule');
    }
  }
  const runPrefixes = decoded
    .filter(({ file }) => file && /^evidence\/canonical-v2\/[^/]+\/adapter-result\.json$/.test(file))
    .map(({ file }) => `${file.slice(0, -'adapter-result.json'.length)}`);
  const entryByPath = new Map(decoded.filter(({ file }) => file !== null)
    .map(({ entry, file }) => [file, entry]));
  const selected = decoded.filter(({ file }) => {
    if (file === null || file.includes('\\') || file !== file.trim()) return true;
    if (REVIEWED_LIB_EXCLUSIONS.has(file)) return false;
    return ALWAYS_INPUT_EXACT_PATHS.has(file)
      || ALWAYS_INPUT_PREFIXES.some((prefix) => file.startsWith(prefix))
      || runPrefixes.some((prefix) => file.startsWith(prefix));
  }).map(({ entry }) => entry);
  for (const runPrefix of runPrefixes) {
    const reference = entryByPath.get(`${runPrefix}source-reference.json`);
    if (!reference) throw new Error(`tracked run is missing ${runPrefix}source-reference.json`);
    if (reference.mode === '120000' || reference.type !== 'blob') {
      throw new Error('source-reference.json must be a tracked regular file');
    }
    const rawPath = rawSourcePath(readBlob(reference.object, cwd));
    const rawEntry = entryByPath.get(rawPath);
    if (!rawEntry) throw new Error(`raw HTML input is not tracked: ${rawPath}`);
    selected.push(rawEntry);
  }
  const unique = [...new Map(selected.map((entry) => [entry.path.toString('hex'), entry])).values()];
  for (const entry of unique) {
    if (entry.mode === '120000' || entry.type === 'commit') {
      throw new Error('baseline input tree contains a symlink or submodule');
    }
  }
  return unique;
}

function baselineInputDigest({ cwd = process.cwd(), ref = 'HEAD', runtime = runtimeIdentity() } = {}) {
  const entries = selectBaselineInputEntries(readTree(String(ref), cwd), { cwd })
    .sort((left, right) => Buffer.compare(left.path, right.path));
  const hash = crypto.createHash('sha256');
  hash.update(digestDomain(runtime));
  hash.update('\0');
  for (const entry of entries) {
    hash.update(`${entry.mode}\0${entry.type}\0${entry.object}\0`);
    hash.update(entry.path);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function markerForDigest(digest) {
  if (!DIGEST_PATTERN.test(digest)) throw new Error('digest must be 64 lowercase hexadecimal characters');
  return `PASS\n${digest}\n`;
}

function writeMarker(file, digest) {
  const marker = markerForDigest(digest);
  const target = path.resolve(file);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, marker, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    try {
      fs.rmSync(temporary);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function verifyMarker(file, expectedDigest) {
  if (!DIGEST_PATTERN.test(String(expectedDigest || ''))) return false;
  try {
    const expected = markerForDigest(expectedDigest);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Buffer.byteLength(expected)) return false;
    return fs.readFileSync(file, 'utf8') === expected;
  } catch (_) {
    return false;
  }
}

function main(argv = process.argv.slice(2)) {
  const [command, first, second, ...extra] = argv;
  if (extra.length > 0) throw new Error('unexpected arguments');
  if (command === 'digest' && second === undefined) {
    process.stdout.write(`${baselineInputDigest({ ref: first || 'HEAD' })}\n`);
    return;
  }
  if (command === 'write' && first && second) {
    writeMarker(second, first);
    return;
  }
  if (command === 'verify' && first && second) {
    if (!verifyMarker(second, first)) process.exitCode = 1;
    return;
  }
  throw new Error('usage: baseline-checkpoint.js digest [ref] | write DIGEST FILE | verify DIGEST FILE');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`BASELINE-CHECKPOINT: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  BASELINE_GATE_CONTRACT,
  ALWAYS_INPUT_EXACT_PATHS,
  ALWAYS_INPUT_PREFIXES,
  CACHE_KEY_PREFIX,
  DIGEST_VERSION,
  DIGEST_PATTERN,
  baselineInputDigest,
  digestDomain,
  runtimeIdentity,
  selectBaselineInputEntries,
  verifyMarker,
  writeMarker,
};
