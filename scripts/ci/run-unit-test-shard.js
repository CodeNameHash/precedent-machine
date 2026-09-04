#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

// One CI shard runs up to three lanes in parallel: the ordinary lane (its
// share of every test file, files in parallel), the Work3 lane (its share of
// the sealed Work3 test's titles), and, on the shards that carry one, a heavy
// lane (its share of one heavy file's titles). Each lane's TAP output is
// validated to contain exactly the titles it was given as passing tests.
const TOTAL_SHARDS = 8;
const SEALED_WORK3_TEST = 'tests/stage-2y-structure-m7-v2-repair-work3.test.js';
const REGISTRATION_TEST = 'tests/stage-2y-structure-m7-v2-repair-registration.test.js';
const EXECUTION_MANIFEST_TEST = 'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
// Heavy files run their tests sequentially, so each one alone would set the CI
// critical path. Each is split by top-level title across the listed shards and
// run as its own lane beside that shard's ordinary lane. The titles are parsed
// from the file at run time, because these files change (unlike the sealed
// Work3 test), so nothing here is maintained by hand: every title runs exactly
// once across the listed shards, and a shard carries at most one heavy lane.
const HEAVY_FILE_PARTITIONS = Object.freeze([
  Object.freeze({ file: EXECUTION_MANIFEST_TEST, shards: Object.freeze([4, 6, 7, 8]) }),
  Object.freeze({ file: REGISTRATION_TEST, shards: Object.freeze([2, 3]) }),
]);
const HEAVY_FILES = Object.freeze(new Set(HEAVY_FILE_PARTITIONS.map((entry) => entry.file)));
const TOP_LEVEL_TEST_PATTERN = /^test\(\s*'((?:[^'\\\n]|\\.)*)'/gm;
const SEALED_WORK3_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json';
const SEALED_WORK3_BYTE_LENGTH = 886974;
const SEALED_WORK3_SHA256 = 'eef969ddc83e776c4f4a728ef019080859abb96e12a00b27942fd6effa3d3548';
const MAX_WORK3_TAP_BYTES = 64 * 1024 * 1024;

const WORK3_TITLES = Object.freeze([
  'Work3 physical closure finaliser rejects CLI arguments before repository access',
  'Work3 physical closure finaliser rejects caller-supplied output descriptors',
  'Work3 no-argument finaliser rolls back receipt-last failure and retries cleanly',
  'Work3 finaliser refuses symbolic-link and partial repository states',
  'Work3 physical closure validates the exact 24-package and 5,655-member estate',
  'Work3 V2 receipt validator closes exactly 31 keys, 52 artefacts and 53 paths',
  'Work3 V2 receipt rejects self-consistent inner substitutions',
  'Work3 profile source adapter closes the exact additive three in memory',
  'Work3 profile source adapter requires the native additive source set',
  'Work3 profile source adapter closes governed samples to exact native M2 text',
  'Work3 profile source adapter rejects additive source drift in fixed order',
  'Work3 profile source adapter closes exact thirty sources and renders no-default gap review',
  'Work3 profile gap review carries a transient answer in memory without governing it',
  'Work3 review binds transient evidence to sealed and additive M2, M3, and M4 sources without authority',
  'Phase2 proposal derives a deterministic unapproved Termination partition',
  'Phase3 reference review candidate preserves unresolved Termination references without Work3 activation',
  'Phase3 reference target evidence preserves exact Termination source targets without Work3 materialisation',
  'Phase3 reference source normaliser records exact Termination source evidence without target strings',
  'Phase3 reference edge values project six exact Termination section targets without Work3 identity creation',
  'Phase3 linked-rule reference values preserve ten exact Termination notice targets without Work3 materialisation',
  'Phase3 raw-M2 reference owner values preserve seven exact Termination source owners without Work3 materialisation',
  'Phase3 source-occurrence self-reference values preserve twelve exact Termination source owners without Work3 materialisation',
  'Phase3 agreement-date source-pair reference value preserves one exact Termination date owner without Work3 materialisation',
  'Phase3 Company Stockholders Meeting event reference value preserves the approved exact Termination owner without Work3 materialisation',
  'Phase3 reference value materialisation preserves the 221-slot Termination ledger as 220 consumable values and one private Company Letter gap without package activation',
  'Phase3 Red Hat Company Letter source-discovery frontier preserves the sole Termination gap without inventing a candidate',
  'Phase4 Termination family profile package review returns 45 unapproved proposals and retains b9e as incomplete source-limited review-only without Work3 identities',
  'Phase5 Termination package resolution uses one governed disclosure note to satisfy b9e without a typed fact, target, dependency, absence proof or Work3 identity',
  'Work3 Termination governed disclosure note Stage A proves prospective schema compatibility without core integration or Work3 identity',
  'Work3 Termination Stage B builds the 45-profile unapproved blueprint proposal without Work3 identity or core integration',
  'Work3 Termination governed disclosure note core integration proves validator acceptance without Work3 identity or inventory',
  'Work3 Termination unapproved inventory review proves validator acceptance without Work3 identity or package approval',
  'Work3 Termination Ben inventory session disposition captures Ben-authored file without Work3 identity or package seal',
  'Work3 Termination family package seal captures Ben seal without Work3 identity or premature registration',
  'Work3 Termination family package registration emits Work3 identity without product write or activation',
  'Termination Milestone A family profile package on disk validates 45 registered profiles',
]);

const WORK3_PART_TITLE_NUMBERS = Object.freeze([
  Object.freeze([8, 35]),
  Object.freeze([12, 16, 23]),
  Object.freeze([1, 2, 5, 6, 17, 21, 36]),
  Object.freeze([4, 14, 20, 27]),
  Object.freeze([3, 11, 15, 24]),
  Object.freeze([22, 25, 26, 31, 33]),
  Object.freeze([7, 9, 18, 29, 30, 34]),
  Object.freeze([10, 13, 19, 28, 32]),
]);

const WORK3_PARTS = Object.freeze(WORK3_PART_TITLE_NUMBERS.map((numbers) => (
  Object.freeze(numbers.map((number) => WORK3_TITLES[number - 1]))
)));

function validateWork3Partition() {
  const numbers = WORK3_PART_TITLE_NUMBERS.flat();
  const expected = Array.from({ length: WORK3_TITLES.length }, (_, index) => index + 1);
  const sorted = [...numbers].sort((left, right) => left - right);
  if (WORK3_TITLES.length !== 36
    || new Set(WORK3_TITLES).size !== WORK3_TITLES.length
    || WORK3_PARTS.length !== TOTAL_SHARDS
    || sorted.length !== expected.length
    || sorted.some((number, index) => number !== expected[index])) {
    throw new Error('Work3 title partition must contain each of the 36 sealed titles exactly once');
  }
}

validateWork3Partition();

function validateHeavyPartitions() {
  const seenFiles = new Set();
  const seenShards = new Set();
  for (const entry of HEAVY_FILE_PARTITIONS) {
    if (seenFiles.has(entry.file) || entry.file === SEALED_WORK3_TEST
      || entry.shards.length === 0
      || entry.shards.some((shard) => !Number.isInteger(shard) || shard < 1 || shard > TOTAL_SHARDS)
      || new Set(entry.shards).size !== entry.shards.length) {
      throw new Error('heavy file partition must name distinct in-range shards for a distinct file');
    }
    for (const shard of entry.shards) {
      if (seenShards.has(shard)) throw new Error(`shard ${shard} may carry at most one heavy lane`);
      seenShards.add(shard);
    }
    seenFiles.add(entry.file);
  }
}

validateHeavyPartitions();

function comparePaths(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function repositoryPath(cwd, file) {
  return path.join(cwd, ...file.split('/'));
}

function discoverTestFiles(cwd = process.cwd()) {
  const testRoot = repositoryPath(cwd, 'tests');
  const rootStat = fs.lstatSync(testRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('tests must be a real directory');
  }
  const files = [];
  const walk = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => comparePaths(left.name, right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(cwd, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        throw new Error(`test tree contains a symbolic link: ${relative}`);
      }
      if (stat.isDirectory()) {
        walk(absolute);
      } else if (stat.isFile() && /\.(?:test|spec)\.js$/.test(relative)) {
        files.push(relative);
      } else if (!stat.isFile() && /\.(?:test|spec)\.js$/.test(relative)) {
        throw new Error(`test path is not a regular file: ${relative}`);
      }
    }
  };
  walk(testRoot);
  return files.sort(comparePaths);
}

function validateDiscoveredTests(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('test discovery returned no files');
  }
  if (files.some((file) => typeof file !== 'string'
    || !file.startsWith('tests/')
    || file !== file.trim()
    || file.includes('\\')
    || !/\.(?:test|spec)\.js$/.test(file))) {
    throw new Error('test discovery returned an unsafe path');
  }
  const sorted = [...files].sort(comparePaths);
  if (sorted.some((file, index) => file !== files[index])
    || new Set(files).size !== files.length) {
    throw new Error('test discovery must be sorted and unique');
  }
  for (const required of [SEALED_WORK3_TEST, ...HEAVY_FILES]) {
    if (files.filter((file) => file === required).length !== 1) {
      throw new Error(`test discovery must contain exactly one ${required}`);
    }
  }
}

function nativeShardForIndex(index) {
  if (!Number.isInteger(index) || index < 0) throw new Error('test index must be non-negative');
  return (index % TOTAL_SHARDS) + 1;
}

function assignedOrdinaryShard(file, index) {
  if (file === SEALED_WORK3_TEST || HEAVY_FILES.has(file)) return null;
  return nativeShardForIndex(index);
}

function assignOrdinaryFiles(files, shard) {
  if (!Number.isInteger(shard) || shard < 1 || shard > TOTAL_SHARDS) {
    throw new Error(`shard must be between 1 and ${TOTAL_SHARDS}`);
  }
  return files.filter((file, index) => assignedOrdinaryShard(file, index) === shard);
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWork3Pattern(titles) {
  if (!Array.isArray(titles) || titles.length === 0
    || titles.some((title) => typeof title !== 'string' || !title)) {
    throw new Error('Work3 part must contain at least one title');
  }
  return `^(?:${titles.map(escapeRegularExpression).join('|')})$`;
}

// A title is selected only if it is a column-0 `test('…'` call. Every other
// call that could register a top-level test (indented, `test.only(`,
// `test.skip(`) is counted too, and any mismatch fails closed, because a
// registered test that no shard's pattern selects would otherwise run zero
// times without a trace.
function parseTopLevelTitles(source, file) {
  const text = String(source);
  const starts = (text.match(/^test\(/gm) || []).length;
  const registrations = (text.match(/(?<![.\w$])test\s*(?:\.\w+)?\s*\(/g) || []).length;
  const titles = [...text.matchAll(TOP_LEVEL_TEST_PATTERN)].map((match) => match[1]);
  if (starts === 0 || titles.length !== starts || registrations !== starts
    || titles.some((title) => title.length === 0 || title.includes('\\'))
    || new Set(titles).size !== titles.length) {
    throw new Error(`heavy test file titles could not be partitioned exactly: ${file}`);
  }
  return titles;
}

function heavyPartitionForShard(shard, cwd = process.cwd()) {
  const entries = HEAVY_FILE_PARTITIONS.filter((entry) => entry.shards.includes(shard));
  if (entries.length === 0) return null;
  const [entry] = entries;
  const source = fs.readFileSync(repositoryPath(cwd, entry.file), 'utf8');
  const titles = parseTopLevelTitles(source, entry.file);
  const part = entry.shards.indexOf(shard);
  const selected = titles.filter((_, index) => index % entry.shards.length === part);
  if (selected.length === 0) {
    throw new Error(`heavy lane for ${entry.file} on shard ${shard} selects no title`);
  }
  return { file: entry.file, pattern: buildWork3Pattern(selected), titles: selected };
}

function parseShard(value) {
  const match = String(value || '').match(/^([1-8])\/8$/);
  if (!match) throw new Error('shard must be one of 1/8 through 8/8');
  return Number(match[1]);
}

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || !argv[0].startsWith('--shard=')) {
    throw new Error('usage: run-unit-test-shard.js --shard=N/8');
  }
  return parseShard(argv[0].slice('--shard='.length));
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function verifySealedWork3(cwd = process.cwd()) {
  const testPath = repositoryPath(cwd, SEALED_WORK3_TEST);
  const testStat = fs.lstatSync(testPath);
  if (!testStat.isFile() || testStat.isSymbolicLink()) {
    throw new Error('sealed Work3 test must be a real file');
  }
  const bytes = fs.readFileSync(testPath);
  if (bytes.length !== SEALED_WORK3_BYTE_LENGTH || sha256(bytes) !== SEALED_WORK3_SHA256) {
    throw new Error('sealed Work3 test does not match its receipt binding');
  }

  const receiptPath = repositoryPath(cwd, SEALED_WORK3_RECEIPT);
  const receiptStat = fs.lstatSync(receiptPath);
  if (!receiptStat.isFile() || receiptStat.isSymbolicLink()) {
    throw new Error('Work3 receipt must be a real file');
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (!Array.isArray(receipt.artifact_bindings)) {
    throw new Error('Work3 receipt artifact bindings are missing');
  }
  const bindings = receipt.artifact_bindings.filter((binding) => (
    binding && binding.path === SEALED_WORK3_TEST
  ));
  if (bindings.length !== 1
    || bindings[0].byte_length !== SEALED_WORK3_BYTE_LENGTH
    || bindings[0].sha256 !== SEALED_WORK3_SHA256) {
    throw new Error('Work3 receipt does not bind the sealed test exactly once');
  }
  return {
    byteLength: bytes.length,
    receiptBinding: bindings[0],
    sha256: SEALED_WORK3_SHA256,
  };
}

function buildShardPlan(shard, cwd = process.cwd()) {
  const files = discoverTestFiles(cwd);
  validateDiscoveredTests(files);
  const ordinaryFiles = assignOrdinaryFiles(files, shard);
  if (ordinaryFiles.length === 0) throw new Error(`ordinary shard ${shard}/${TOTAL_SHARDS} is empty`);
  const work3Titles = WORK3_PARTS[shard - 1];
  const heavy = heavyPartitionForShard(shard, cwd);
  return {
    heavyFile: heavy === null ? null : heavy.file,
    heavyPattern: heavy === null ? null : heavy.pattern,
    heavyTitles: heavy === null ? [] : heavy.titles,
    ordinaryFiles,
    shard,
    totalShards: TOTAL_SHARDS,
    work3Pattern: buildWork3Pattern(work3Titles),
    work3Titles,
  };
}

function buildLaneArguments(plan) {
  return {
    ordinary: [
      '--max-old-space-size=8192',
      '--test',
      '--test-reporter=tap',
      ...plan.ordinaryFiles,
    ],
    work3: [
      '--max-old-space-size=8192',
      '--test',
      '--test-reporter=tap',
      `--test-name-pattern=${plan.work3Pattern}`,
      SEALED_WORK3_TEST,
    ],
    heavy: [
      '--max-old-space-size=8192',
      '--test',
      '--test-reporter=tap',
      `--test-name-pattern=${plan.heavyPattern}`,
      plan.heavyFile,
    ],
  };
}

function startLane(label, args, outputPath, cwd) {
  let descriptor;
  try {
    descriptor = fs.openSync(outputPath, 'wx', 0o600);
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', descriptor, descriptor],
    });
    fs.closeSync(descriptor);
    descriptor = undefined;
    return new Promise((resolve) => {
      let error = null;
      child.once('error', (value) => {
        error = value;
      });
      child.once('close', (code, signal) => {
        resolve({ code, error, label, outputPath, signal });
      });
    });
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    return Promise.resolve({ code: null, error, label, outputPath, signal: null });
  }
}

function assertSuccessfulLane(result) {
  if (!result || result.error) {
    throw new Error(`${result && result.label ? result.label : 'test'} lane could not start`);
  }
  if (result.signal) throw new Error(`${result.label} lane ended on signal ${result.signal}`);
  if (result.code !== 0) throw new Error(`${result.label} lane exited ${result.code}`);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateWork3Tap(output, expectedTitles) {
  if (typeof output !== 'string') throw new Error('Work3 TAP output must be text');
  const subtests = [];
  const successes = [];
  let topLevelFailure = false;
  for (const rawLine of output.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith('# Subtest: ')) subtests.push(line.slice('# Subtest: '.length));
    const success = line.match(/^ok \d+ - (.+)$/);
    if (success) successes.push(success[1]);
    if (/^not ok \d+ - /.test(line)) topLevelFailure = true;
  }
  const selectedSubtests = subtests.filter((title) => expectedTitles.includes(title));
  if (selectedSubtests.length === 0) throw new Error('Work3 title pattern matched zero tests');
  if (topLevelFailure
    || !arraysEqual(subtests, expectedTitles)
    || !arraysEqual(successes, expectedTitles)) {
    throw new Error('Work3 TAP output does not contain the exact selected titles as passing tests');
  }
  return true;
}

async function replayFile(file, output = process.stdout) {
  for await (const chunk of fs.createReadStream(file)) {
    if (!output.write(chunk)) await once(output, 'drain');
  }
}

async function runShard(shard, { cwd = process.cwd(), output = process.stdout } = {}) {
  verifySealedWork3(cwd);
  const plan = buildShardPlan(shard, cwd);
  const args = buildLaneArguments(plan);
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `unit-shard-${shard}-`));
  const ordinaryOutput = path.join(temporaryDirectory, 'ordinary.tap');
  const work3Output = path.join(temporaryDirectory, 'work3.tap');
  const heavyOutput = path.join(temporaryDirectory, 'heavy.tap');
  const heavyLane = plan.heavyFile !== null;
  try {
    output.write(`# CI shard ${shard}/${TOTAL_SHARDS}: ordinary, Work3${heavyLane ? ' and heavy' : ''} lanes started\n`);
    const heartbeat = setInterval(() => {
      output.write(`# CI shard ${shard}/${TOTAL_SHARDS}: lanes still running\n`);
    }, 60_000);
    let results;
    try {
      results = await Promise.all([
        startLane('ordinary', args.ordinary, ordinaryOutput, cwd),
        startLane('Work3', args.work3, work3Output, cwd),
        ...(heavyLane ? [startLane('heavy', args.heavy, heavyOutput, cwd)] : []),
      ]);
    } finally {
      clearInterval(heartbeat);
    }

    output.write(`# CI shard ${shard}/${TOTAL_SHARDS}: ordinary lane output\n`);
    await replayFile(ordinaryOutput, output);
    output.write(`# CI shard ${shard}/${TOTAL_SHARDS}: Work3 lane output\n`);
    await replayFile(work3Output, output);
    if (heavyLane) {
      output.write(`# CI shard ${shard}/${TOTAL_SHARDS}: heavy lane output (${plan.heavyFile})\n`);
      await replayFile(heavyOutput, output);
    }
    for (const result of results) assertSuccessfulLane(result);

    const work3Stat = fs.statSync(work3Output);
    if (!work3Stat.isFile() || work3Stat.size > MAX_WORK3_TAP_BYTES) {
      throw new Error('Work3 TAP output is missing or exceeds its byte bound');
    }
    validateWork3Tap(fs.readFileSync(work3Output, 'utf8'), plan.work3Titles);
    if (heavyLane) {
      const heavyStat = fs.statSync(heavyOutput);
      if (!heavyStat.isFile() || heavyStat.size > MAX_WORK3_TAP_BYTES) {
        throw new Error('heavy lane TAP output is missing or exceeds its byte bound');
      }
      validateWork3Tap(fs.readFileSync(heavyOutput, 'utf8'), plan.heavyTitles);
    }
    return plan;
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main(argv = process.argv.slice(2)) {
  await runShard(parseArguments(argv));
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`UNIT-TEST-SHARD: FAIL ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXECUTION_MANIFEST_TEST,
  HEAVY_FILES,
  HEAVY_FILE_PARTITIONS,
  REGISTRATION_TEST,
  SEALED_WORK3_BYTE_LENGTH,
  SEALED_WORK3_RECEIPT,
  SEALED_WORK3_SHA256,
  SEALED_WORK3_TEST,
  TOTAL_SHARDS,
  WORK3_PARTS,
  WORK3_PART_TITLE_NUMBERS,
  WORK3_TITLES,
  assertSuccessfulLane,
  assignOrdinaryFiles,
  assignedOrdinaryShard,
  buildLaneArguments,
  buildShardPlan,
  buildWork3Pattern,
  discoverTestFiles,
  heavyPartitionForShard,
  nativeShardForIndex,
  parseArguments,
  parseShard,
  parseTopLevelTitles,
  runShard,
  validateDiscoveredTests,
  validateWork3Tap,
  verifySealedWork3,
};
