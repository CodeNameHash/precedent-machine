'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');

const {
  FAMILY_SOURCES,
  REVIEW_BINDING,
  REVIEW_PATH,
  loadSevenFamilyGroupingPreview,
  validateSealReceipt,
} = require('../lib/canonical-v2/seven-family-grouping-preview-source');

const PREVIEW_ENV = { VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' };

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function gitBlobOid(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

test('seven-family grouping preview is available only in a permitted preview runtime', () => {
  assert.equal(loadSevenFamilyGroupingPreview({
    env: { VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' },
  }), null);
  assert.equal(loadSevenFamilyGroupingPreview({
    env: { VERCEL: '1', VERCEL_ENV: 'development', NODE_ENV: 'production' },
  }), null);
  assert.equal(loadSevenFamilyGroupingPreview({ env: { NODE_ENV: 'development' } }).family_count, 7);
  assert.equal(loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV }).family_count, 7);
});

test('seven-family grouping preview reads the exact sealed successor estate', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  assert.deepEqual(preview.review, { state: 'PASS', path: REVIEW_PATH, ...REVIEW_BINDING });
  assert.equal(preview.family_count, 7);
  assert.equal(preview.profile_count, 140);
  assert.equal(preview.comparison_row_count, 29);
  assert.deepEqual(
    preview.families.map((family) => [family.family_key, family.profile_count, family.v2_rows.length]),
    [
      ['DIVIDENDS', 1, 1],
      ['MAE_DEFINITION', 4, 5],
      ['GUARANTY_FINANCING_PARTY', 5, 1],
      ['APPRAISAL_DISSENTERS_RIGHTS', 5, 1],
      ['FINANCING_COVENANTS', 5, 3],
      ['CONSIDERATION', 7, 2],
      ['INTERIM_OPERATING', 113, 16],
    ],
  );
  for (const family of preview.families) {
    assert.match(family.package.path, /grouping-successor-2026-09-01B\.json$/);
    assert.match(family.package.sha256, /^[0-9a-f]{64}$/);
    assert.ok(family.package.byte_length > 0);
    assert.match(family.package.family_profile_package_id, /^[0-9a-f]{64}$/);
    assert.ok(family.v1.rows.length > 0);
  }
});

test('independent-review PASS is bound to its exact recorded bytes', () => {
  const reviewBytes = fs.readFileSync(REVIEW_PATH);
  assert.equal(reviewBytes.length, REVIEW_BINDING.byte_length);
  assert.equal(sha256(reviewBytes), REVIEW_BINDING.sha256);
  assert.equal(gitBlobOid(reviewBytes), REVIEW_BINDING.git_blob_oid);
  assert.match(reviewBytes.toString('utf8'), /^\*\*Result:\*\* PASS\./m);
});

test('approved comparison lines, links and party bands render without deal-value claims', () => {
  const preview = loadSevenFamilyGroupingPreview({ env: PREVIEW_ENV });
  const byFamily = new Map(preview.families.map((family) => [family.family_key, family]));
  assert.deepEqual(
    byFamily.get('MAE_DEFINITION').v2_rows.map((row) => row.comparison_line),
    [
      'Definition prongs',
      'MAE Test',
      'Carve-outs',
      'Disproportionality relationships',
      'Exceptions to carve-outs',
    ],
  );
  assert.deepEqual(
    byFamily.get('CONSIDERATION').v2_rows.map((row) => [row.comparison_line, row.row_kind]),
    [
      ['Cash component', 'COMPARISON'],
      ["Appraisal / dissenters' rights", 'LINK'],
    ],
  );
  assert.deepEqual(byFamily.get('DIVIDENDS').v2_rows[0].bands, [
    { party_band: null, profile_count: 1 },
  ]);
  const interim = byFamily.get('INTERIM_OPERATING');
  const bandTotals = new Map();
  for (const row of interim.v2_rows) {
    for (const band of row.bands) {
      bandTotals.set(band.party_band, (bandTotals.get(band.party_band) || 0) + band.profile_count);
    }
  }
  assert.deepEqual(Object.fromEntries(bandTotals), { Target: 105, Parent: 8 });
  assert.deepEqual(
    interim.v2_rows.find((row) => row.comparison_line === 'Indebtedness and loans').bands,
    [
      { party_band: 'Target', profile_count: 18 },
      { party_band: 'Parent', profile_count: 1 },
    ],
  );
  for (const row of interim.v2_rows.filter((entry) => entry.bands.length === 2)) {
    assert.deepEqual(row.bands.map((band) => band.party_band), ['Target', 'Parent']);
  }
  assert.deepEqual(interim.unmeasured_concepts.map((entry) => entry.concept), [
    "affirmative-covenant band carrying V1's refined specifics",
    'asset sales / divestitures / licenses',
    'real estate / leases as its own category',
    'broader third-party-obligation guarantees beyond debt',
  ]);
});

test('a changed seal receipt cannot retain its pinned identity', () => {
  const spec = FAMILY_SOURCES.find((entry) => entry.family_key === 'MAE_DEFINITION');
  const seal = JSON.parse(fs.readFileSync(spec.seal.file, 'utf8'));
  seal.successor_disposition_binding.sha256 = '0'.repeat(64);
  assert.throws(
    () => validateSealReceipt(spec, seal),
    /MAE_DEFINITION seal receipt is invalid/,
  );
});

test('preview route stays server-derived and carries no serving or persistence path', () => {
  const page = fs.readFileSync('pages/design/canonical-v2-seven-family.js', 'utf8');
  assert.match(page, /getServerSideProps/);
  assert.match(page, /designPreviewServerSideProps/);
  assert.match(page, /loadSevenFamilyGroupingPreview/);
  assert.match(page, /Not yet extracted in V2/);
  assert.match(page, /SevenFamilyPreview\.noLayout = true/);
  assert.doesNotMatch(page, /fetch\(|useEffect|Supabase|database_url/i);
  assert.equal(FAMILY_SOURCES.length, 7);
});
