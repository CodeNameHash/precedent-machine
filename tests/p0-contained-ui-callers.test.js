const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function source(file) {
  return fs.readFileSync(file, 'utf8');
}

test('Review never invokes disabled legacy market statistics', () => {
  const review = source('pages/review/[id].js');
  assert.match(review, /const legacyMarketStatsContained = true;/);
  assert.match(review, /typedMarketEnabled = marketMode\s+&& !legacyMarketStatsContained/);
  assert.match(review, /legacyMarketEnabled = marketMode\s+&& !legacyMarketStatsContained/);
});

test('normal Review exposes extraction status without production extraction writes', () => {
  const review = source('pages/review-v1/[id].js');
  assert.match(review, /Re-extraction is local-only during containment/);
  assert.doesNotMatch(review, /fetch\(['"]\/api\/ingest\/(?:classify|extract-type)['"]/);
});

test('other contained write controls are visibly disabled', () => {
  assert.match(source('components/review-v2/ClauseSidebar.jsx'), /const CORRECTION_SUBMISSION_CONTAINED = true;/);
  assert.match(source('components/review/EditPanel.js'), /const reextractionContained = true;/);
  assert.match(source('pages/admin/agreements.js'), /const productionIngestContained = true;/);
  assert.match(source('pages/admin/candidates.js'), /const CANDIDATE_ADMIN_CONTAINED = true;/);
  assert.match(source('pages/admin/ingest-runs.js'), /const INGEST_RUN_ADMIN_CONTAINED = true;/);
});
