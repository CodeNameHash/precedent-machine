'use strict';

/**
 * tests/canonical-v2-queue-volume-dry-run.test.js
 *
 * Test-first, fixture-driven test for scripts/queue-volume-dry-run.mjs
 * (design spec, "Recall and volume instrumentation", item 3). Exercises
 * both the pure `analyzeQueueVolume`/`resolveItemExactKey` functions
 * (imported directly via dynamic import, since the script is ESM) and the
 * actual CLI entry point against temp `RESOLUTION_REVIEW_QUEUE/V1` JSON
 * files, per the plan's "fixture-driven test with temp files" instruction.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'queue-volume-dry-run.mjs');

function loadModule() {
  return import(`file://${SCRIPT_PATH}`);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'queue-volume-dry-run-'));
}

function writeQueueArtifact(dir, filename, body) {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, JSON.stringify({
    schema_version: 'RESOLUTION_REVIEW_QUEUE/V1',
    review_queue: [],
    ...body,
  }, null, 2));
  return filePath;
}

function taskAlignedItem({ phrase, attachment = 'ITEM', family = 'MATERIALITY' }) {
  return {
    normalised_phrase: phrase,
    attachment_position: attachment,
    concept_family: family,
    reasons: ['QUALIFIER_KIND_UNCLASSIFIED'],
  };
}

function proxyItem({ claimDefKey, conceptKey, reasons = ['UNRESOLVED_RESIDUAL'] }) {
  return {
    resolved_claim_definition_key: claimDefKey,
    concept_key: conceptKey,
    reasons,
  };
}

test('resolveItemExactKey: TASK4_ALIGNED_KEY when phrase/attachment/family all present', async () => {
  const { resolveItemExactKey } = await loadModule();
  const result = resolveItemExactKey(taskAlignedItem({ phrase: 'except as set forth' }));
  assert.equal(result.key_strategy, 'TASK4_ALIGNED_KEY');
  assert.ok(result.key.includes('except as set forth'));
});

test('resolveItemExactKey: quote is an acceptable substitute for normalised_phrase', async () => {
  const { resolveItemExactKey } = await loadModule();
  const result = resolveItemExactKey({
    quote: 'as of the date hereof',
    attachment_position: 'LIMB',
    concept_family: 'TEMPORAL',
  });
  assert.equal(result.key_strategy, 'TASK4_ALIGNED_KEY');
});

test('resolveItemExactKey: zero-width marks do not change the resolved key', async () => {
  const { resolveItemExactKey } = await loadModule();
  const a = resolveItemExactKey(taskAlignedItem({ phrase: 'except​as set forth' }));
  const b = resolveItemExactKey(taskAlignedItem({ phrase: 'exceptas set forth' }));
  assert.equal(a.key, b.key);
});

test('resolveItemExactKey: falls back to PROXY_KEY when the Task-4 triple is absent', async () => {
  const { resolveItemExactKey } = await loadModule();
  const result = resolveItemExactKey(proxyItem({ claimDefKey: 'MAE_QUALIFIED_REP', conceptKey: 'materiality' }));
  assert.equal(result.key_strategy, 'PROXY_KEY');
  assert.ok(result.key.startsWith('PROXY/'));
});

test('resolveItemExactKey: UNKEYABLE for an item with nothing usable, never throws', async () => {
  const { resolveItemExactKey } = await loadModule();
  assert.deepEqual(resolveItemExactKey({}), { key: null, key_strategy: 'UNKEYABLE' });
  assert.deepEqual(resolveItemExactKey(null), { key: null, key_strategy: 'UNKEYABLE' });
});

test('analyzeQueueVolume: per-deal counts and cross-deal exact-key hit rate', async () => {
  const { analyzeQueueVolume } = await loadModule();

  const dealA = {
    deal_id: 'deal-a',
    source_file: 'deal-a.json',
    review_queue: [
      taskAlignedItem({ phrase: 'except as set forth in the disclosure letter' }),
      taskAlignedItem({ phrase: 'as of the date hereof', family: 'TEMPORAL' }),
      proxyItem({ claimDefKey: 'MAE_QUALIFIED_REP', conceptKey: 'materiality' }),
    ],
  };
  const dealB = {
    deal_id: 'deal-b',
    source_file: 'deal-b.json',
    review_queue: [
      // Recurs exactly against deal A's first item -> a hit.
      taskAlignedItem({ phrase: 'except as set forth in the disclosure letter' }),
      // Deal-specific, does not recur.
      taskAlignedItem({ phrase: '$50,000,000 in the aggregate', family: 'THRESHOLD' }),
    ],
  };

  const report = analyzeQueueVolume([dealA, dealB]);

  assert.equal(report.schema_version, 'QUEUE_VOLUME_DRY_RUN_REPORT/V1');
  assert.equal(report.totals.deal_count, 2);
  assert.equal(report.totals.review_queue_item_count, 5);
  assert.equal(report.totals.average_items_per_deal, 2.5);

  assert.equal(report.deals[0].review_queue_item_count, 3);
  assert.equal(report.deals[1].review_queue_item_count, 2);
  assert.equal(report.deals[1].recurring_key_hits_against_earlier_deals, 1);
  assert.equal(report.deals[0].recurring_key_hits_against_earlier_deals, 0);

  // 1 recurring key out of 5 keyable items (all 5 items here are keyable).
  assert.equal(report.exact_key_hit_rate.keyable_item_count, 5);
  assert.equal(report.exact_key_hit_rate.recurring_key_hit_count, 1);
  assert.equal(report.exact_key_hit_rate.hit_rate, 0.2);
  assert.equal(report.exact_key_hit_rate.key_strategy_counts.TASK4_ALIGNED_KEY, 4);
  assert.equal(report.exact_key_hit_rate.key_strategy_counts.PROXY_KEY, 1);
  assert.equal(report.exact_key_hit_rate.key_strategy_counts.UNKEYABLE, 0);

  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.deals));
  assert.throws(() => { report.totals.deal_count = 999; });
});

test('analyzeQueueVolume: hit_rate is null (not 0, not NaN) when nothing is keyable', async () => {
  const { analyzeQueueVolume } = await loadModule();
  const report = analyzeQueueVolume([{ deal_id: 'x', source_file: 'x.json', review_queue: [{}] }]);
  assert.equal(report.exact_key_hit_rate.keyable_item_count, 0);
  assert.equal(report.exact_key_hit_rate.hit_rate, null);
});

test('analyzeQueueVolume: refuses to run on zero artifacts (fails closed, typed)', async () => {
  const { analyzeQueueVolume, QueueVolumeDryRunError } = await loadModule();
  assert.throws(() => analyzeQueueVolume([]), QueueVolumeDryRunError);
});

test('loadQueueArtifact: derives deal id from deal_key, else document_hash, else filename', async () => {
  const { loadQueueArtifact } = await loadModule();
  const dir = makeTempDir();

  const withDealKey = writeQueueArtifact(dir, 'a.json', { deal_key: 'qxo-topbuild' });
  assert.equal(loadQueueArtifact(withDealKey).deal_id, 'qxo-topbuild');

  const withDocumentHash = writeQueueArtifact(dir, 'b.json', { document_hash: 'abc123' });
  assert.equal(loadQueueArtifact(withDocumentHash).deal_id, 'abc123');

  const withNeither = writeQueueArtifact(dir, 'landos-abbvie.json', {});
  assert.equal(loadQueueArtifact(withNeither).deal_id, 'landos-abbvie');
});

test('loadQueueArtifact: fails closed (typed) on wrong schema_version or missing review_queue', async () => {
  const { loadQueueArtifact, QueueVolumeDryRunError } = await loadModule();
  const dir = makeTempDir();

  const wrongSchema = path.join(dir, 'wrong.json');
  fs.writeFileSync(wrongSchema, JSON.stringify({ schema_version: 'SOMETHING_ELSE/V1', review_queue: [] }));
  assert.throws(() => loadQueueArtifact(wrongSchema), QueueVolumeDryRunError);

  const missingQueue = path.join(dir, 'missing.json');
  fs.writeFileSync(missingQueue, JSON.stringify({ schema_version: 'RESOLUTION_REVIEW_QUEUE/V1' }));
  assert.throws(() => loadQueueArtifact(missingQueue), QueueVolumeDryRunError);
});

test('CLI: reports projected items per deal and exact-key hit rate against real temp fixture files', () => {
  const dir = makeTempDir();
  const dealAPath = writeQueueArtifact(dir, 'qxo-topbuild.json', {
    deal_key: 'qxo-topbuild',
    review_queue: [
      taskAlignedItem({ phrase: 'except as set forth in the disclosure letter' }),
      proxyItem({ claimDefKey: 'MAE_QUALIFIED_REP', conceptKey: 'materiality' }),
    ],
  });
  const dealBPath = writeQueueArtifact(dir, 'metsera-cohort.json', {
    deal_key: 'metsera-cohort',
    review_queue: [
      taskAlignedItem({ phrase: 'except as set forth in the disclosure letter' }),
      taskAlignedItem({ phrase: 'a wholly unrelated deal-specific carve-out clause' }),
    ],
  });

  const outPath = path.join(dir, 'report.json');
  const stdout = execFileSync('node', [SCRIPT_PATH, dealAPath, dealBPath, '--out', outPath], { encoding: 'utf8' });

  const stdoutReport = JSON.parse(stdout);
  const fileReport = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(stdoutReport, fileReport);

  assert.equal(fileReport.schema_version, 'QUEUE_VOLUME_DRY_RUN_REPORT/V1');
  assert.equal(fileReport.totals.deal_count, 2);
  assert.equal(fileReport.totals.review_queue_item_count, 4);
  assert.equal(fileReport.deals[0].deal_id, 'qxo-topbuild');
  assert.equal(fileReport.deals[1].deal_id, 'metsera-cohort');
  assert.equal(fileReport.deals[1].recurring_key_hits_against_earlier_deals, 1);
  assert.equal(fileReport.exact_key_hit_rate.recurring_key_hit_count, 1);
  assert.equal(fileReport.exact_key_hit_rate.hit_rate, 0.25);
});

test('CLI: exits non-zero with a clear message when given no input files', () => {
  assert.throws(() => {
    execFileSync('node', [SCRIPT_PATH], { encoding: 'utf8', stdio: 'pipe' });
  }, (error) => {
    assert.equal(error.status, 1);
    assert.match(error.stderr.toString(), /queue-volume-dry-run/);
    return true;
  });
});

test('CLI: exits non-zero on a queue file with the wrong schema_version', () => {
  const dir = makeTempDir();
  const badPath = path.join(dir, 'bad.json');
  fs.writeFileSync(badPath, JSON.stringify({ schema_version: 'NOT_A_QUEUE/V1', review_queue: [] }));
  assert.throws(() => {
    execFileSync('node', [SCRIPT_PATH, badPath], { encoding: 'utf8', stdio: 'pipe' });
  }, (error) => {
    assert.equal(error.status, 1);
    return true;
  });
});
