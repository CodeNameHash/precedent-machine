const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ROUTE_SOURCE = fs.readFileSync('pages/api/corpus-stats.js', 'utf8');
const CORE_SOURCE = fs.readFileSync('lib/queries/corpus-stats-core.js', 'utf8');
const DURATION_SOURCE = fs.readFileSync('lib/queries/corpus-duration.js', 'utf8');
const CLAIMS_ADAPTER_SOURCE = fs.readFileSync('lib/queries/claims-adapter.js', 'utf8');

test('contained corpus-stats keeps strict duration normalisation in the non-routable core', () => {
  assert.match(ROUTE_SOURCE, /createBroadCorpusContainedHandler\('GET'\)/);
  assert.match(DURATION_SOURCE, /selectDurationCohort/);
  assert.match(DURATION_SOURCE, /requestedCode/);
  assert.match(DURATION_SOURCE, /evidenceByCardKey/);
  assert.match(DURATION_SOURCE, /durationInDays/);
  assert.doesNotMatch(DURATION_SOURCE, /canonical_numeric/);
});

test('contained corpus-stats retains means and material-contract claim metadata off the request path', () => {
  assert.match(CORE_SOURCE, /mean:\s*nums\.reduce/);
  assert.match(CLAIMS_ADAPTER_SOURCE, /materialContractsBuckets/);
  assert.doesNotMatch(ROUTE_SOURCE, /supabase|canonical_numeric|materialContractsBuckets/i);
});
