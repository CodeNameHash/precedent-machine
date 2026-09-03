'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  HEAVY_FILES,
  HEAVY_FILE_PARTITIONS,
  SEALED_WORK3_TEST,
  TOTAL_SHARDS,
  assignedOrdinaryShard,
  buildLaneArguments,
  buildShardPlan,
  discoverTestFiles,
  heavyPartitionForShard,
  parseTopLevelTitles,
  validateWork3Tap,
} = require('../../scripts/ci/run-unit-test-shard');

test('heavy file partitions name distinct files on distinct in-range shards', () => {
  const shards = HEAVY_FILE_PARTITIONS.flatMap((entry) => entry.shards);
  assert.equal(new Set(shards).size, shards.length);
  assert.ok(shards.every((shard) => Number.isInteger(shard) && shard >= 1 && shard <= TOTAL_SHARDS));
  assert.equal(
    new Set(HEAVY_FILE_PARTITIONS.map((entry) => entry.file)).size,
    HEAVY_FILE_PARTITIONS.length,
  );
  assert.equal(HEAVY_FILES.has(SEALED_WORK3_TEST), false);
});

test('every heavy title runs exactly once across its shards and never in the ordinary lane', () => {
  const files = discoverTestFiles();
  for (const entry of HEAVY_FILE_PARTITIONS) {
    assert.ok(files.includes(entry.file), entry.file);
    assert.equal(assignedOrdinaryShard(entry.file, files.indexOf(entry.file)), null);
    const titles = parseTopLevelTitles(fs.readFileSync(entry.file, 'utf8'), entry.file);
    const assigned = [];
    for (let shard = 1; shard <= TOTAL_SHARDS; shard += 1) {
      const partition = heavyPartitionForShard(shard);
      if (!entry.shards.includes(shard)) {
        assert.notEqual(partition?.file, entry.file);
        continue;
      }
      assert.equal(partition.file, entry.file);
      const pattern = new RegExp(partition.pattern);
      for (const title of titles) {
        assert.equal(pattern.test(title), partition.titles.includes(title), `${shard}: ${title}`);
      }
      assigned.push(...partition.titles);
      const plan = buildShardPlan(shard);
      assert.equal(plan.heavyFile, entry.file);
      assert.deepEqual(plan.heavyTitles, partition.titles);
      assert.equal(plan.ordinaryFiles.includes(entry.file), false);
      const args = buildLaneArguments(plan);
      assert.equal(args.heavy.at(-1), entry.file);
      assert.equal(args.heavy.filter((argument) => argument.startsWith('--test-name-pattern=')).length, 1);
      assert.equal(args.ordinary.includes(entry.file), false);
    }
    assert.deepEqual([...assigned].sort(), [...titles].sort(), entry.file);
    assert.equal(assigned.length, new Set(assigned).size, entry.file);
  }
});

test('shards without a heavy lane plan none', () => {
  const heavyShards = new Set(HEAVY_FILE_PARTITIONS.flatMap((entry) => entry.shards));
  for (let shard = 1; shard <= TOTAL_SHARDS; shard += 1) {
    if (heavyShards.has(shard)) continue;
    assert.equal(heavyPartitionForShard(shard), null);
    const plan = buildShardPlan(shard);
    assert.equal(plan.heavyFile, null);
    assert.equal(plan.heavyPattern, null);
    assert.deepEqual(plan.heavyTitles, []);
  }
});

test('title parsing fails closed on anything but exact single-quoted top-level titles', () => {
  assert.deepEqual(
    parseTopLevelTitles(
      "test('alpha', () => {});\nconst retest = 1;\ntest('beta (x)', () => {});\n",
      'fixture',
    ),
    ['alpha', 'beta (x)'],
  );
  for (const source of [
    '',
    'test("double", () => {});\n',
    "test('alpha', () => {});\n  test('indented', () => {});\n",
    "test('alpha', () => {});\ntest.only('only', () => {});\n",
    "test('alpha', () => {});\ntest.skip('skipped', () => {});\n",
    "test('dup', () => {});\ntest('dup', () => {});\n",
    "test('', () => {});\n",
    "test('esc\\'aped', () => {});\n",
    'test(`template`, () => {});\n',
    "test('fine', () => {});\ntest(`template`, () => {});\n",
  ]) {
    assert.throws(() => parseTopLevelTitles(source, 'fixture'), /partitioned exactly/);
  }
});

test('lane TAP validation accepts exactly the selected titles and rejects drift', () => {
  const tap = (titles, failing = []) => [
    'TAP version 13',
    ...titles.flatMap((title, index) => [
      `# Subtest: ${title}`,
      `${failing.includes(title) ? 'not ok' : 'ok'} ${index + 1} - ${title}`,
    ]),
    `1..${titles.length}`,
  ].join('\n');
  assert.equal(validateWork3Tap(tap(['a', 'b']), ['a', 'b']), true);
  assert.throws(() => validateWork3Tap(tap(['a']), ['a', 'b']));
  assert.throws(() => validateWork3Tap(tap(['a', 'b', 'c']), ['a', 'b']));
  assert.throws(() => validateWork3Tap(tap(['a', 'b'], ['b']), ['a', 'b']));
  assert.throws(() => validateWork3Tap(tap(['b', 'a']), ['a', 'b']));
  assert.throws(() => validateWork3Tap(tap(['c']), ['a', 'b']));
});
