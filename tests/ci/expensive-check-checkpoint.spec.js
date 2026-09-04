'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODULE = path.resolve(__dirname, '../../scripts/ci/expensive-check-checkpoint.mjs');
const load = () => import(MODULE);

function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(directory, file, contents) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function commit(directory, message) {
  git(directory, ['add', '--all']);
  git(directory, [
    '-c', 'user.name=CI Test',
    '-c', 'user.email=ci@example.invalid',
    'commit', '-qm', message,
  ]);
  return git(directory, ['rev-parse', 'HEAD']);
}

const ENTRY = 'scripts/gate.mjs';
const INPUT = 'evidence/canonical-v2/report.json';
const FINAL_RUN = 'evidence/canonical-v2/run-20260809-2xk-final';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-gate-checkpoint-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  git(directory, ['init', '-q']);
  write(directory, 'package.json', '{"name":"fixture"}\n');
  write(directory, 'package-lock.json', '{}\n');
  write(directory, ENTRY, [
    "import { helper } from './lib/helper.mjs';",
    "// require('./only-in-a-comment') is prose, not a dependency",
    '/* import x from "./also-prose.js" */',
    "const shared = require('../lib/shared');",
    "const url = 'https://www.sec.gov/';",
    '',
  ].join('\n'));
  write(directory, 'scripts/lib/helper.mjs', "export const helper = 1;\nimport('./dynamic.js');\n");
  write(directory, 'scripts/lib/dynamic.js', 'module.exports = 1;\n');
  write(directory, 'lib/shared/index.js', "module.exports = require('./data.json');\n");
  write(directory, 'lib/shared/data.json', '{"v":1}\n');
  write(directory, `${FINAL_RUN}/adapter-result.json`, '{"a":1}\n');
  write(directory, 'evidence/canonical-v2/other-run/adapter-result.json', '{"b":1}\n');
  write(directory, INPUT, '{"r":1}\n');
  write(directory, 'unrelated/file.txt', 'x\n');
  commit(directory, 'base');
  return directory;
}

const options = (cwd, extra = {}) => ({
  cwd, gate: 'fixture-gate', entry: ENTRY, inputs: [INPUT], corpusRuns: true, ...extra,
});

test('the digest is stable, well-formed and built from the exact dependency closure', async (t) => {
  const { DIGEST_PATTERN, corpusRunDirectories, dependencyClosure, evidenceGateInputDigest, readTree } = await load();
  const cwd = fixture(t);
  const first = evidenceGateInputDigest(options(cwd));
  assert.match(first, DIGEST_PATTERN);
  assert.equal(evidenceGateInputDigest(options(cwd)), first);
  const tree = readTree('HEAD', cwd);
  assert.deepEqual(dependencyClosure(tree, ENTRY, cwd), [
    'lib/shared/data.json',
    'lib/shared/index.js',
    'scripts/gate.mjs',
    'scripts/lib/dynamic.js',
    'scripts/lib/helper.mjs',
  ]);
  assert.deepEqual(corpusRunDirectories(tree), [FINAL_RUN]);
});

test('the digest moves only when something the gate can read moves', async (t) => {
  const { evidenceGateInputDigest } = await load();
  const cwd = fixture(t);
  const base = evidenceGateInputDigest(options(cwd));

  write(cwd, 'unrelated/file.txt', 'y\n');
  write(cwd, 'evidence/canonical-v2/other-run/adapter-result.json', '{"b":2}\n');
  commit(cwd, 'unrelated');
  assert.equal(evidenceGateInputDigest(options(cwd)), base);

  write(cwd, 'lib/shared/data.json', '{"v":2}\n');
  commit(cwd, 'closure');
  const afterClosure = evidenceGateInputDigest(options(cwd));
  assert.notEqual(afterClosure, base);

  write(cwd, `${FINAL_RUN}/adapter-result.json`, '{"a":2}\n');
  commit(cwd, 'corpus run');
  const afterRun = evidenceGateInputDigest(options(cwd));
  assert.notEqual(afterRun, afterClosure);
  assert.equal(
    evidenceGateInputDigest(options(cwd, { corpusRuns: false })),
    evidenceGateInputDigest(options(cwd, { corpusRuns: false })),
  );

  write(cwd, INPUT, '{"r":2}\n');
  commit(cwd, 'declared input');
  const afterInput = evidenceGateInputDigest(options(cwd));
  assert.notEqual(afterInput, afterRun);
  assert.notEqual(evidenceGateInputDigest(options(cwd, { gate: 'other-gate' })), afterInput);
});

test('the digest fails closed on an unresolvable specifier or an untracked input', async (t) => {
  const { evidenceGateInputDigest } = await load();
  const cwd = fixture(t);
  assert.throws(
    () => evidenceGateInputDigest(options(cwd, { inputs: ['evidence/canonical-v2/absent.json'] })),
    /not tracked at the ref/,
  );
  assert.throws(() => evidenceGateInputDigest(options(cwd, { gate: 'Bad Gate' })), /gate name/);
  write(cwd, 'scripts/lib/dynamic.js', "module.exports = require('./nowhere');\n");
  commit(cwd, 'dangling');
  assert.throws(() => evidenceGateInputDigest(options(cwd)), /does not resolve/);
});

test('markers round-trip and reject drift, and digest arguments parse exactly', async (t) => {
  const { DIGEST_PATTERN, parseDigestArguments, verifyMarker, writeMarker } = await load();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-gate-marker-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const digest = 'a'.repeat(64);
  const marker = path.join(directory, 'nested', 'marker.txt');
  writeMarker(marker, digest);
  assert.match(digest, DIGEST_PATTERN);
  assert.equal(verifyMarker(marker, digest), true);
  assert.equal(verifyMarker(marker, 'b'.repeat(64)), false);
  assert.equal(verifyMarker(marker, 'not-a-digest'), false);
  assert.equal(verifyMarker(path.join(directory, 'missing.txt'), digest), false);
  assert.throws(() => writeMarker(marker, 'short'), /64 lowercase/);

  assert.deepEqual(
    parseDigestArguments(['--gate', 'g', '--entry', 'e.mjs', '--inputs', 'a,b', '--corpus-runs']),
    { ref: 'HEAD', inputs: ['a', 'b'], corpusRuns: true, gate: 'g', entry: 'e.mjs' },
  );
  assert.throws(() => parseDigestArguments(['--gate', 'g']), /requires --gate and --entry/);
  assert.throws(() => parseDigestArguments(['--gate']), /requires a value/);
  assert.throws(() => parseDigestArguments(['--gate', 'g', '--entry', 'e', '--what', 'x']), /unknown/);
});
