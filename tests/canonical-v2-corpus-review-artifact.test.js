'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

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
});

test('render is self-contained, body-safe, numbered and wraps wide tables', () => {
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
});
