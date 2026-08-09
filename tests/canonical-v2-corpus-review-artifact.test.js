'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const vm = require('node:vm');

let artifact;

test.before(async () => {
  artifact = await import('../scripts/canonical-v2-corpus-review-artifact.mjs');
});

test('final corpus selector includes rung-labelled finals and excludes non-finals', () => {
  assert.equal(artifact.isFinalCorpusRun('topbuild-no-shop-20260809-2xk-r4-final'), true);
  assert.equal(artifact.isFinalCorpusRun('modiv-no-shop-20260809-2xk-final'), true);
  assert.equal(artifact.isFinalCorpusRun('modiv-no-shop-20260809-2xk-r1'), false);
});

test('model uses resolved divided by the full review queue and groups claims by excerpt', () => {
  const model = artifact.buildCorpusReviewModel({
    repoRoot: process.cwd(),
    runNames: ['skechers-consideration-20260809-2xk-final'],
  });
  const resolution = require('../evidence/canonical-v2/skechers-consideration-20260809-2xk-final/resolution.json');
  assert.equal(model.families[0].attempted, resolution.review_queue.length);
  assert.equal(model.families[0].resolved, resolution.resolved.length);
  assert.equal(model.families[0].rate, resolution.resolved.length / resolution.review_queue.length);
  assert.ok(model.excerptGroups.some((group) => group.claims.length > 1));
  assert.equal(
    model.excerptGroups.flatMap((group) => group.claims).filter((claim) => claim.state === 'OPEN_WORLD').length,
    resolution.open_world.length,
  );
});

test('artifact check rejects stale bytes without mutating the target, then accepts exact bytes', (t) => {
  const repoRoot = process.cwd();
  const runNames = ['modiv-no-shop-20260809-2xk-final'];
  const tempDir = mkdtempSync(join(tmpdir(), 'canonical-v2-corpus-review-'));
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));
  const outputPath = join(tempDir, 'review.html');
  const stale = '<!doctype html><title>stale</title>';
  writeFileSync(outputPath, stale);

  assert.throws(
    () => artifact.checkCorpusReviewArtifact({ repoRoot, runNames, outputPath }),
    (error) => error && error.code === 'STALE_CORPUS_REVIEW_ARTIFACT',
  );
  assert.equal(readFileSync(outputPath, 'utf8'), stale);

  const expected = artifact.expectedCorpusReview({ repoRoot, runNames });
  writeFileSync(outputPath, expected.html);
  assert.deepEqual(
    artifact.checkCorpusReviewArtifact({ repoRoot, runNames, outputPath }),
    { outputPath, runs: 1, cards: expected.model.excerptGroups.length },
  );
});

test('render is self-contained, body-safe, numbered, filterable and wraps wide tables', () => {
  const model = artifact.buildCorpusReviewModel({
    repoRoot: process.cwd(),
    runNames: ['modiv-no-shop-20260809-2xk-final'],
  });
  const output = artifact.renderCorpusReview(model);
  assert.match(output, /Content-Security-Policy/);
  assert.doesNotMatch(output, /https?:\/\//);
  assert.match(output, /overflow-x:hidden/);
  assert.match(output, /class="table-scroll"/);
  assert.match(output, /class="number">#1</);
  assert.match(output, /id="family-filter"/);
  assert.match(output, /id="status-filter"/);
  assert.match(output, /<option value="HELD">Unresolved only<\/option>/);
  assert.match(output, /<option value="OPEN_WORLD">Open-world only<\/option>/);
  assert.match(output, /data-family="NO_SHOP"/);
  assert.match(output, /data-state="OPEN_WORLD"/);
  assert.match(output, /script-src 'unsafe-inline'/);
});

test('inline controls combine family and status filters and hide non-matching claims', () => {
  const model = artifact.buildCorpusReviewModel({
    repoRoot: process.cwd(),
    runNames: ['modiv-no-shop-20260809-2xk-final'],
  });
  const output = artifact.renderCorpusReview(model);
  const script = /<script>\n([\s\S]+)\n<\/script>/.exec(output)?.[1];
  assert.ok(script);

  const control = () => ({ value: 'ALL', listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } });
  const familyFilter = control();
  const statusFilter = control();
  const count = { textContent: '' };
  const card = (family, states) => ({
    dataset: { family },
    hidden: false,
    claims: states.map((state) => ({ dataset: { state }, hidden: false })),
    querySelectorAll() { return this.claims; },
  });
  const cards = [card('NO_SHOP', ['RESOLVED', 'HELD', 'OPEN_WORLD']), card('TERMINATION', ['HELD'])];
  const document = {
    querySelector(selector) {
      return { '#family-filter': familyFilter, '#status-filter': statusFilter, '#filter-count': count }[selector];
    },
    querySelectorAll() { return cards; },
  };
  vm.runInNewContext(script, { document });
  assert.equal(count.textContent, '4 claims in 2 excerpts');

  familyFilter.value = 'NO_SHOP';
  statusFilter.value = 'OPEN_WORLD';
  statusFilter.listeners.change();
  assert.equal(count.textContent, '1 claims in 1 excerpts');
  assert.deepEqual(cards.map((item) => item.hidden), [false, true]);
  assert.deepEqual(cards[0].claims.map((claim) => claim.hidden), [true, true, false]);
});
