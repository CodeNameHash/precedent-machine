const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('M2 plan records WP-M2-00 as shipped and backfill green', () => {
  const src = fs.readFileSync('archive/PLAN-M2-schema-deploy.md', 'utf8');
  assert.match(src, /WP-M2-00 has shipped/);
  assert.match(src, /minimum of 237 `provision_cards` rows per deal/);
  assert.match(src, /round-m2-00-backfill\.md/);
});

test('M3 plan no longer owns pulled-forward provision-card semantics', () => {
  const src = fs.readFileSync('archive/PLAN-M3-ingest-seamless.md', 'utf8');
  assert.doesNotMatch(src, /WP-M3-01: Provision-instance identity/);
  assert.doesNotMatch(src, /WP-M3-03: Provenance bundle/);
  assert.doesNotMatch(src, /WP-M3-04: Definitions as Provisions/);
  assert.match(src, /WP-M3-02: Normalizer manifest/);
  assert.match(src, /WP-M3-05: Ingest end-to-end smoke test/);
});

test('taxonomy gaps pulled forward G1 G2 G4 G5 G10 G11 to M2', () => {
  const src = fs.readFileSync('archive/PLAN-TAXONOMY-GAPS.md', 'utf8');
  for (const gap of ['G1', 'G2', 'G4', 'G5', 'G10', 'G11']) {
    assert.match(src, new RegExp(`\\| ${gap} \\|[^\\n]+\\| WP-M2-00`));
  }
  assert.match(src, /175 reconciliation entries remain on the waitlist for `employment_compensation_structured_object`/);
});

test('WP-M2-00 drain report leaves employment compensation waitlist intact', () => {
  const src = fs.readFileSync('docs/reprocess/round-m2-00-waitlist-drain.md', 'utf8');
  assert.match(src, /Rows drained in WP-M2-00: 0/);
  assert.match(src, /employment_compensation_structured_object \\| 175/);
});
