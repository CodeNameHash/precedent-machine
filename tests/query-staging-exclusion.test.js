// tests/query-staging-exclusion.test.js — WP-7 (M5-06): staging deals must
// be invisible on every query/index surface. Before this WP, the query
// engine's own API route (pages/api/query/run.js), the demo-set tile
// resolver (pages/api/query/demo-set.js), and the live demo-set gate
// (scripts/query-demo-check.js) fetched every deal with no ingest_status
// filter at all — only pages/api/home.js and pages/api/deals.js excluded
// staging deals. This asserts the exclusion those two now carry too.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { isStagingDeal } = require('../scripts/query-demo-check');

test('query-demo-check.js isStagingDeal keys on metadata.ingest_status === "staging"', () => {
  assert.equal(isStagingDeal({ metadata: { ingest_status: 'staging' } }), true);
  assert.equal(isStagingDeal({ metadata: { ingest_status: 'clean' } }), false);
  assert.equal(isStagingDeal({ metadata: {} }), false);
  assert.equal(isStagingDeal({}), false);
  assert.equal(isStagingDeal(null), false);
});

// pages/api/query/run.js and pages/api/query/demo-set.js use `import`
// (ESM), which this repo's plain `node --test` runner can't require()
// directly — tests/admin/processing-flow.spec.js already uses the same
// source-text-assertion pattern for pages/ files under this constraint.
function readSource(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

// pages/api/query/run.js's original inline (deals, provisions) cache — with
// the staging-deal filtering below — was extracted to
// lib/query/context-cache.js (query-surface UX pass, item 1) so
// pages/api/query/field-options.js can share the same warm cache instead of
// opening a second full-corpus fetch path. run.js still consumes the
// filtered `{ deals, provisions }` it gets back; the staging-exclusion
// LOGIC itself now lives in the shared module, so this checks each file for
// the half of the guarantee it's responsible for.
test('pages/api/query/run.js hands runQuery the shared, staging-filtered query context', () => {
  const src = readSource('pages/api/query/run.js');
  assert.match(src, /require\(['"].*lib\/query\/context-cache['"]\)/);
  // The filtered `deals` (not a raw fetch) must be what's handed to
  // runQuery — guards against a future edit re-introducing an unfiltered
  // deal set into the query context.
  assert.match(src, /context:\s*{\s*deals,\s*provisions\s*}/);
});

test('lib/query/context-cache.js excludes staging deals from the shared query context (deals AND their provisions)', () => {
  const src = readSource('lib/query/context-cache.js');
  assert.match(src, /isStagingDeal/);
  assert.match(src, /ingest_status\s*===\s*'staging'/);
  // Provisions must be scoped to the filtered deal ids, not the raw
  // paginated fetch — guards against a future edit re-introducing
  // unfiltered `dealRows`/`allProvisions` into the cached context.
  assert.match(src, /liveDealIds\.has\(p\.deal_id\)/);
});

test('scripts/query-demo-check.js excludes staging deals from the live corpus it grades', () => {
  const src = readSource('scripts/query-demo-check.js');
  assert.match(src, /isStagingDeal/);
  assert.match(src, /liveDealIds\.has\(p\.deal_id\)/);
});

test('pages/api/query/demo-set.js excludes staging deals before resolving @deal:/@all_deals references', () => {
  const src = readSource('pages/api/query/demo-set.js');
  assert.match(src, /isStagingDeal/);
  assert.match(src, /resolveDemoPayload\(entry\.payload, deals \|\| \[\]\)/);
});
