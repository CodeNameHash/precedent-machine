const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const SOURCE = fs.readFileSync('pages/api/corpus-stats.js', 'utf8');

test('corpus-stats duration rows use strict claim cohorts without requiring canonical_numeric', () => {
  assert.match(SOURCE, /selectDurationCohort/);
  assert.match(SOURCE, /requestedCode:\s*code/);
  assert.match(SOURCE, /evidenceByCardKey/);
  assert.match(SOURCE, /primary_quote, region_full_text/);
  assert.doesNotMatch(SOURCE, /\.select\([^)]*canonical_numeric/);
});
