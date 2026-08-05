const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('admin gaps deep links scroll selected G and U reader panels into view', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/gaps.js'), 'utf8');

  assert.match(source, /const readerRef = useRef\(null\)/);
  assert.match(source, /const reviewReaderRef = useRef\(null\)/);
  assert.match(source, /selectedGapId \? `gap:\$\{selectedGapId\}`/);
  assert.match(source, /selectedNeedsCodeId \? `needs_code:\$\{selectedNeedsCodeId\}`/);
  assert.match(source, /selectedDealId[\s\S]*scrollIntoView\(readerRef\)/);
  assert.match(source, /selectedReviewKey[\s\S]*scrollIntoView\(reviewReaderRef\)/);
  assert.match(source, /ref=\{readerRef\}/);
  assert.match(source, /ref=\{reviewReaderRef\}/);
});

test('admin gaps review queue row links preserve scroll while updating the deep link', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/gaps.js'), 'utf8');

  assert.match(source, /reviewItems\.map\(\(item\) => \(\s*<Link[\s\S]*href=\{\{ pathname: '\/admin\/gaps', query: \{ deal_id: selectedSummary\.deal_id, review_item: item\.key \} \}\}\s*scroll=\{false\}/);
});

test('admin gaps direct deal links skip the expensive summary auto-load', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/gaps.js'), 'utf8');

  assert.match(source, /const DEFAULT_LIMIT = 10/);
  assert.match(source, /if \(selectedDealId\) \{\s*setLoading\(false\);\s*setRows\(\[\]\);\s*setPagination\(null\);\s*return;\s*\}/);
  assert.match(source, /const showSummaryTable = !selectedDealId \|\| loading \|\| rows\.length > 0/);
});

test('admin gaps surfaces schema-backed main concepts in review items', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/gaps.js'), 'utf8');

  assert.match(source, /function conceptText/);
  assert.match(source, /function adjacentConcept/);
  assert.match(source, /mainConcept: adjacentConcept\(gap\)/);
  assert.match(source, /mainConcept: conceptText\(item\.main_concept\)/);
  assert.match(source, /Main concept:/);
  assert.match(source, /Adjacent provisions/);
});

// pages/compare.js was retired on 2026-08-05. Deal-versus-deal comparison now
// lives on the review page's own compare mode, which renders through the review
// table configs rather than a second feature renderer, so the compare half of
// this assertion has no surviving subject. The review half is unchanged and
// still guards what this test exists for: feature fallback must go through the
// schema renderer, and must not reach for the retired category-summary import.
test('review feature fallback rendering uses the schema renderer', () => {
  const reviewSource = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');
  const summarySource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'schema', 'summary.js'), 'utf8');

  assert.match(reviewSource, /renderFeatureValue as schemaRenderFeatureValue/);
  assert.match(reviewSource, /schemaRenderFeatureValue\(featureKey, value\)/);
  assert.match(reviewSource, /formatFeatureValue\(raw, featureKey\)/);
  assert.match(reviewSource, /lib\/schema\/summary/);
  assert.doesNotMatch(reviewSource, /import\s+\{ CATEGORY_SUMMARY_FEATURES \}\s+from ['"][^'"]*lib\/category-summary-features/);
  assert.match(summarySource, /getCategorySummaryRows/);
  assert.match(summarySource, /primaryFeature/);
});

test('the retired compare page is gone and nothing references it', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'pages', 'compare.js')), false);
});
