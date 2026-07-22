const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop.mjs';
const REVIEWED = 'lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice.js';

test('QXO no-shop runner is staging-only, rollback-first and writer-only', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /Refusing to run outside/);
  assert.match(source, /DEAL_SCOPE_RUN/);
  assert.match(source, /canonical_v2_write/);
  assert.match(source, /Rollback-first QXO no-shop semantic run changed staging state/);
  assert.doesNotMatch(source, /production/i);
  assert.doesNotMatch(source, /UPDATE canonical_v2_staging|DELETE FROM canonical_v2_staging/);
});

test('QXO no-shop runner pins source, review and closure identities without printing source text', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /EXPECTED_DEAL_ADMISSION_ID/);
  assert.match(source, /EXPECTED_SOURCE_ADMISSION_ID/);
  assert.match(source, /EXPECTED_REVIEWED_MAPPING_ID/);
  assert.match(source, /EXPECTED_SEMANTIC_CLOSURE_ID/);
  assert.match(source, /writer_request_byte_length/);
  assert.doesNotMatch(source, /exact_text|raw_value|canonical_text\.text/);
});

test('reviewed QXO no-shop slice uses admitted intervals and distinct day bases', () => {
  const source = fs.readFileSync(REVIEWED, 'utf8');
  assert.match(source, /ADMITTED_SEMANTIC_SOURCE_CONTEXT\/V1/);
  assert.match(source, /SECTION_4_3_SHA256/);
  assert.match(source, /NOTICE_SHA256/);
  assert.match(source, /MATCH_SHA256/);
  assert.match(source, /rawUnit: 'HOURS'/);
  assert.match(source, /dayBasis: 'ELAPSED'/);
  assert.match(source, /rawUnit: 'DAYS'/);
  assert.match(source, /dayBasis: 'BUSINESS'/);
  assert.match(source, /clauseExcerpt, 'OPERATIVE_TEXT'/);
  assert.match(source, /clockExcerpt, 'DERIVATION_INPUT'/);
  assert.doesNotMatch(source, /buildFixtureSourceAdmission|REVIEWED_MERGER_AGREEMENT_EXCERPT/);
});
