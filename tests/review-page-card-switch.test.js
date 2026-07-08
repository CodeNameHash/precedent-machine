const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..');
const reviewPagePath = path.join(repoRoot, 'pages/review/[id].js');
const apiPath = path.join(repoRoot, 'pages/api/review/[id]/cards.js');
const reviewPageSource = fs.readFileSync(reviewPagePath, 'utf8');
const apiSource = fs.readFileSync(apiPath, 'utf8');

test('review page imports the provision card table', () => {
  assert.match(reviewPageSource, /import ProvisionCardTable from '..\/..\/components\/review\/ProvisionCardTable';/);
});

test('review page switches to schema render at the 40-card threshold', () => {
  assert.match(reviewPageSource, /const SCHEMA_RENDER_MIN_CARDS = 40;/);
  assert.match(reviewPageSource, /schemaCardCount >= SCHEMA_RENDER_MIN_CARDS/);
  assert.match(reviewPageSource, /<ProvisionCardTable reviewDeal=\{schemaReviewDeal/);
});

test('review page supports render query overrides', () => {
  assert.match(reviewPageSource, /renderModeParam === 'schema'/);
  assert.match(reviewPageSource, /renderModeParam === 'legacy'/);
  assert.match(reviewPageSource, /forcedRenderMode === 'legacy'/);
  assert.match(reviewPageSource, /forcedRenderMode === 'schema'/);
});

test('review page fetches card-backed deal data through the API route', () => {
  assert.match(reviewPageSource, /\/api\/review\/\$\{encodeURIComponent\(dealId\)\}\/cards/);
});

test('review cards API delegates to the server-side card query helper', () => {
  assert.match(apiSource, /import \{ fetchReviewDealCards \} from '..\/..\/..\/..\/lib\/queries\/review-deal';/);
  assert.match(apiSource, /const mode = rawMode === 'admin' \? 'admin' : 'user';/);
  assert.match(apiSource, /const reviewDeal = await fetchReviewDealCards\(dealId, sb, \{ mode \}\);/);
});
