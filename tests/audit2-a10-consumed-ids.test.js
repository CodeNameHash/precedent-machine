/* Audit-2 item 7 (A10) — "Other provisions in this section" must exclude
   provisions consumed by the section's SUMMARY tables. The existing
   consumedProvisionIds only ever marked the FIRST provision matching a key
   group as consumed (pickFirstNonEmpty) — when TWO physically different
   provisions both carry a value for the same summary key (Metsera: two
   separate "Standard of Efforts" provisions feeding the Antitrust Summary),
   the second was never marked consumed and leaked into the "Other
   provisions" footer as an apparent duplicate. allConsumedProvisionIds
   fixes this by scanning every provision, not just the first hit.
   pages/review/[id].js is JSX, not directly importable under node:test —
   pinned via source text (documented convention). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const REVIEW_PATH = path.join(__dirname, '..', 'pages', 'review', '[id].js');
const src = fs.readFileSync(REVIEW_PATH, 'utf8');

function slice(marker, len) {
  const idx = src.indexOf(marker);
  assert.ok(idx > -1, `expected to find "${marker}"`);
  return src.slice(idx, idx + len);
}

test('allConsumedProvisionIds marks every provision carrying a value for any key, not just the first hit', () => {
  const body = slice('function allConsumedProvisionIds(provisions, keyGroups) {', 700);
  assert.match(body, /for \(const p of provisions \|\| \[\]\)/, 'iterates ALL provisions, not just the first match per group');
  assert.match(body, /isEmptyValue\(f\[k\]\)/);
});

test('AntitrustSummaryTable extends consumedIds with allConsumedProvisionIds over ANTI_CONSUMED_KEY_GROUPS', () => {
  const body = slice('function AntitrustSummaryTable({ provisions, allProvisions, onSelectProvision }) {', 500);
  assert.match(body, /allConsumedProvisionIds\(provisions, ANTI_CONSUMED_KEY_GROUPS\)/);
});

test('ANTI_CONSUMED_KEY_GROUPS mirrors the same feature keys buildAntitrustSummaryRows reads (effortsStandard, litigationObligation, consultationTier, etc.)', () => {
  const body = slice('const ANTI_CONSUMED_KEY_GROUPS = [', 900);
  for (const key of ['effortsStandard', 'litigationObligation', 'consultationTier', 'clearSkies', 'pullRefile', 'timingAgreement']) {
    assert.ok(body.includes(key), `expected ${key} in ANTI_CONSUMED_KEY_GROUPS`);
  }
});

test('CategoryFeatureSummaryTable\'s "Other provisions" block extends consumedIds with allConsumedProvisionIds over every row\'s keys', () => {
  const idx = src.indexOf('const consumedIds = new Set([\n          ...rows.map((row) => row.hit && row.hit.provision && row.hit.provision.id).filter(Boolean),');
  assert.ok(idx > -1, 'expected the extended consumedIds construction in CategoryFeatureSummaryTable');
  const body = src.slice(idx, idx + 300);
  assert.match(body, /allConsumedProvisionIds\(provisions, rows\.map\(\(row\) => row\.keys\)\.filter\(Boolean\)\)/);
});

test('rawRows retains the full keys array (not just lookupKey) so the consumed-id scan can see every key a row searches', () => {
  const body = slice("return { label: row.label, hit, lookupKey:", 250);
  assert.match(body, /keys: row\.keys \|\| null/);
});
