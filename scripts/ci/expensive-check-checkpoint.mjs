#!/usr/bin/env node
// Digest-keyed checkpoint for the named evidence gates (`gate:near-miss`,
// `gate:replay-baseline`). Each gate re-derives a committed evidence report
// from the whole admitted corpus, which takes twenty minutes, and its result
// depends only on what its script can read. CI therefore runs a gate once per
// exact input digest and skips on an exact checkpoint hit, the same shape as
// baseline-checkpoint.js. The digest is computed from immutable Git tree
// objects at a ref, never from working-tree bytes, and covers exactly: the
// entry script's static relative dependency closure (require and import
// specifiers resolved against the tree), every path the gate's CI job declares
// as an input, every discovered final corpus run directory when asked, the
// package manifests, and this implementation's own bytes and the Node major.
// A specifier that cannot be resolved against the tree fails closed: the gate
// then runs rather than trusting a digest that might miss an input.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { isFinalCorpusRun } from '../canonical-v2-corpus-review-artifact.mjs';

const DIGEST_VERSION = 'evidence-gate-input-digest/v1';
const CACHE_KEY_PREFIX = 'evidence-gate-checkpoint-v1-';
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const GIT_REF_PATTERN = /^(?:HEAD|[0-9a-f]{40})$/;
const GATE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const REPOSITORY_PATH_PATTERN = /^(?!\.\.?(?:\/|$))[^\0\\]+$/;
const MAX_TREE_BYTES = 128 * 1024 * 1024;
const MAX_BLOB_BYTES = 8 * 1024 * 1024;
const ALWAYS_INPUT_EXACT_PATHS = Object.freeze(['package-lock.json', 'package.json']);
const SCANNED_EXTENSIONS = Object.freeze(['.js', '.mjs', '.cjs']);
const RESOLUTION_SUFFIXES = Object.freeze([
  '', '.js', '.mjs', '.cjs', '.json', '/index.js', '/index.mjs', '/index.cjs',
]);
const SPECIFIER_PATTERNS = Object.freeze([
  /\brequire\(\s*['"](\.\.?\/[^'"\n]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"](\.\.?\/[^'"\n]+)['"]\s*\)/g,
  /\bimport\b[^'";]*?\bfrom\s*['"](\.\.?\/[^'"\n]+)['"]/g,
  /\bimport\s*['"](\.\.?\/[^'"\n]+)['"]/g,
  /\bexport\b[^'";]*?\bfrom\s*['"](\.\.?\/[^'"\n]+)['"]/g,
]);
const OWN_PATH = fileURLToPath(import.meta.url);

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function nodeMajor(version = process.version) {
  const match = /^v(\d+)\./.exec(version);
  if (!match) throw new Error('Node version is malformed');
  return Number(match[1]);
}

function validRepositoryPath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()
    || !REPOSITORY_PATH_PATTERN.test(value) || path.posix.isAbsolute(value)
    || path.posix.normalize(value) !== value || value.split('/').includes('..')) {
    throw new Error(`${label} must be a normalised repository-relative path`);
  }
  return value;
}

function digestDomain({ gate, entry, inputs, corpusRuns, node = nodeMajor(), platform = process.platform }) {
  return JSON.stringify({
    version: DIGEST_VERSION,
    gate,
    entry,
    inputs: [...inputs].sort(),
    corpusRuns: corpusRuns === true,
    alwaysInputs: [...ALWAYS_INPUT_EXACT_PATHS],
    node,
    platform,
    implementation: sha256(fs.readFileSync(OWN_PATH)),
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
  const pathBuffer = record.subarray(tab + 1);
  const file = pathBuffer.toString('utf8');
  if (!Buffer.from(file, 'utf8').equals(pathBuffer)) {
    throw new Error('git ls-tree path is not valid UTF-8');
  }
  return { mode, object, path: file, type };
}

function readTree(ref, cwd) {
  if (!GIT_REF_PATTERN.test(ref)) throw new Error('ref must be HEAD or a lowercase GitHub SHA-1');
  let output;
  try {
    output = execFileSync('git', ['ls-tree', '-rz', '--full-tree', ref, '--'], {
      cwd,
      encoding: null,
      maxBuffer: MAX_TREE_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8').trim() : '';
    throw new Error(detail || `git ls-tree exited ${error.status}`);
  }
  const entries = splitNullDelimited(output).map(parseTreeRecord);
  return new Map(entries.map((entry) => [entry.path, entry]));
}

function readBlob(object, cwd) {
  try {
    return execFileSync('git', ['cat-file', 'blob', object], {
      cwd,
      encoding: null,
      maxBuffer: MAX_BLOB_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (_) {
    throw new Error('unable to read a dependency blob');
  }
}

function assertRegularBlob(entry, label) {
  if (!entry) throw new Error(`${label} is not tracked at the ref`);
  if (entry.type !== 'blob' || entry.mode === '120000') {
    throw new Error(`${label} must be a tracked regular file, not a symlink or submodule`);
  }
  return entry;
}

function resolveSpecifier(tree, importer, specifier) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  if (base.startsWith('../') || base === '..' || path.posix.isAbsolute(base)) {
    throw new Error(`${importer} imports outside the repository: ${specifier}`);
  }
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (tree.has(candidate)) return assertRegularBlob(tree.get(candidate), candidate).path;
  }
  throw new Error(`${importer} imports a specifier that does not resolve at the ref: ${specifier}`);
}

// Comments are removed before scanning so that a specifier quoted in prose
// (a header explaining what a module imports) is not treated as a dependency.
// A `//` preceded by `:` is kept, so a URL inside a string survives.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

function specifiersIn(source) {
  const found = new Set();
  const scanned = stripComments(source);
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of scanned.matchAll(pattern)) found.add(match[1]);
  }
  return [...found].sort();
}

function dependencyClosure(tree, entry, cwd) {
  const start = validRepositoryPath(entry, 'entry');
  assertRegularBlob(tree.get(start), start);
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift();
    if (!SCANNED_EXTENSIONS.includes(path.posix.extname(file))) continue;
    const source = readBlob(tree.get(file).object, cwd).toString('utf8');
    for (const specifier of specifiersIn(source)) {
      const resolved = resolveSpecifier(tree, file, specifier);
      if (!visited.has(resolved)) {
        visited.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...visited].sort();
}

function corpusRunDirectories(tree) {
  const names = new Set();
  for (const file of tree.keys()) {
    const match = /^evidence\/canonical-v2\/([^/]+)\//.exec(file);
    if (match && isFinalCorpusRun(match[1])) names.add(match[1]);
  }
  return [...names].sort().map((name) => `evidence/canonical-v2/${name}`);
}

function selectInputEntries(tree, { closure, inputs, corpusRuns }) {
  const prefixes = [
    ...inputs.map((input) => validRepositoryPath(input, 'input')),
    ...(corpusRuns ? corpusRunDirectories(tree) : []),
  ];
  const selected = new Map();
  for (const file of [...closure, ...ALWAYS_INPUT_EXACT_PATHS]) {
    selected.set(file, assertRegularBlob(tree.get(file), file));
  }
  for (const prefix of prefixes) {
    let matched = 0;
    for (const [file, entry] of tree) {
      if (file === prefix || file.startsWith(`${prefix}/`)) {
        selected.set(file, assertRegularBlob(entry, file));
        matched += 1;
      }
    }
    if (matched === 0) throw new Error(`input path is not tracked at the ref: ${prefix}`);
  }
  return [...selected.values()].sort((left, right) => (left.path < right.path ? -1 : 1));
}

export function evidenceGateInputDigest({
  cwd = process.cwd(), ref = 'HEAD', gate, entry, inputs = [], corpusRuns = false,
} = {}) {
  if (!GATE_NAME_PATTERN.test(String(gate || ''))) throw new Error('gate name is malformed');
  const tree = readTree(String(ref), cwd);
  const closure = dependencyClosure(tree, entry, cwd);
  const entries = selectInputEntries(tree, { closure, inputs, corpusRuns });
  const hash = crypto.createHash('sha256');
  hash.update(digestDomain({ gate, entry, inputs, corpusRuns }));
  hash.update('\0');
  for (const treeEntry of entries) {
    hash.update(`${treeEntry.mode}\0${treeEntry.type}\0${treeEntry.object}\0${treeEntry.path}\0`);
  }
  return hash.digest('hex');
}

export function markerForDigest(digest) {
  if (!DIGEST_PATTERN.test(digest)) throw new Error('digest must be 64 lowercase hexadecimal characters');
  return `PASS\n${digest}\n`;
}

export function writeMarker(file, digest) {
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

export function verifyMarker(file, expectedDigest) {
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

export function parseDigestArguments(argv) {
  const options = { ref: 'HEAD', inputs: [], corpusRuns: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--corpus-runs') {
      options.corpusRuns = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${flag} requires a value`);
    if (flag === '--gate') options.gate = value;
    else if (flag === '--entry') options.entry = value;
    else if (flag === '--ref') options.ref = value;
    else if (flag === '--inputs') options.inputs = value.split(',').filter(Boolean);
    else throw new Error(`unknown digest option ${flag}`);
    index += 1;
  }
  if (!options.gate || !options.entry) throw new Error('digest requires --gate and --entry');
  return options;
}

function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (command === 'digest') {
    process.stdout.write(`${evidenceGateInputDigest(parseDigestArguments(rest))}\n`);
    return;
  }
  if (command === 'write' && rest.length === 2) {
    writeMarker(rest[1], rest[0]);
    return;
  }
  if (command === 'verify' && rest.length === 2) {
    if (!verifyMarker(rest[1], rest[0])) process.exitCode = 1;
    return;
  }
  throw new Error(
    'usage: expensive-check-checkpoint.mjs digest --gate NAME --entry SCRIPT [--inputs a,b] [--corpus-runs] [--ref REF]'
    + ' | write DIGEST FILE | verify DIGEST FILE',
  );
}

export {
  ALWAYS_INPUT_EXACT_PATHS,
  CACHE_KEY_PREFIX,
  DIGEST_PATTERN,
  DIGEST_VERSION,
  corpusRunDirectories,
  dependencyClosure,
  digestDomain,
  readTree,
  specifiersIn,
};

if (process.argv[1] && path.resolve(process.argv[1]) === OWN_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`EVIDENCE-GATE-CHECKPOINT: ${error.message}\n`);
    process.exitCode = 1;
  }
}
