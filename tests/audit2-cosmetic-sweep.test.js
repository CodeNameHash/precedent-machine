/* Audit-2 item 6 — cosmetic sweep. Each sub-item pinned via source text
   where the fix lives in a JSX file not directly importable under
   node:test (documented convention, see tests/fb3-chrome.test.js's
   header), or exercised directly where the fix lives in a pure module. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const REVIEW_SRC = () => read('pages', 'review', '[id].js');
const CONSID_SRC = () => read('components', 'review', 'ConsiderationTables.js');
const SHARED_SRC = () => read('components', 'review', 'shared.js');
const NOSOL_SRC = () => read('components', 'review', 'NosolFourTables.js');

/* ── (a) humanize MIXED_ELECTION / FIXED enums via prettifyEnumValue ── */

test('ConsiderationTables fieldValue routes the bare-string fallback through prettifyEnumValue (no more raw enum leak)', () => {
  const src = CONSID_SRC();
  const idx = src.indexOf('const fieldValue = (raw, featureKey)');
  assert.ok(idx > -1, 'fieldValue must accept a featureKey param');
  const body = src.slice(idx, idx + 400);
  assert.match(body, /return prettifyEnumValue\(featureKey, String\(raw\)\);/);
  assert.doesNotMatch(body, /return String\(raw\);/, 'must not fall back to a raw String() with no humanization');
});

test('pushObjectRows threads the field key through to pushStockRow so nested enum fields (e.g. Collar Type, Proration Election Type) get humanized too', () => {
  const src = CONSID_SRC();
  const idx = src.indexOf('const pushObjectRows = (prefix, obj, provision, fields) => {');
  assert.ok(idx > -1);
  const body = src.slice(idx, idx + 400);
  assert.match(body, /pushStockRow\(`\$\{prefix\} — \$\{label\}`, obj\[key\], provision, null, key\)/);
});

/* ── (b) dedupe Dividend Equivalence / Exchange of Certificates entries ── */

test('ConsiderationTables dedupedStockRows keys on provision id + normalized label, not label+value', () => {
  const src = CONSID_SRC();
  const idx = src.indexOf('const dedupedStockRows = stockRows.filter');
  assert.ok(idx > -1);
  const body = src.slice(idx - 200, idx + 400);
  assert.match(body, /row\.provisionId/);
  assert.match(body, /normalizedLabel/);
});

test('ProvisionsInSectionList dedupes entries by provision id AND normalized category label', () => {
  const src = REVIEW_SRC();
  const idx = src.indexOf('function ProvisionsInSectionList(');
  assert.ok(idx > -1);
  const body = src.slice(idx, idx + 1000);
  assert.match(body, /seenIds/);
  assert.match(body, /seenLabels/);
  assert.match(body, /normalizedLabel/);
});

/* ── (c) go-shop days units (NOT employee-benefits — that's excluded) ── */

test('NosolGoShopTop spec passes unit: "days" for Go-Shop Period and Extended Negotiating Period', () => {
  const src = NOSOL_SRC();
  const idx = src.indexOf('function NosolGoShopTop(');
  assert.ok(idx > -1);
  const body = src.slice(idx, idx + 1800);
  assert.match(body, /label: 'Go-Shop Period', keys: \['goShopPeriodDays', 'goShopWindow'\], unit: 'days'/);
  assert.match(body, /label: 'Extended Negotiating Period', keys: \['extendedNegotiatingPeriodDays'\], unit: 'days'/);
});

test('this fix does not touch the excluded Employee Benefit Continuation row', () => {
  const src = REVIEW_SRC();
  // The Employee Benefit Continuation row must still use the pre-existing
  // DefaultFeatureRow + employeeBenefitPeriod path — untouched by this sweep.
  assert.match(src, /label="Employee Benefit Continuation Period" provisions=\{provisions\} keys=\{\['employeeBenefitPeriod'\]\}/);
});

/* ── (d) Frustration banner grammar ── */

test('the Frustration banner fallback test text no longer produces "that party\'s the test caused the failure"', () => {
  const src = REVIEW_SRC();
  assert.doesNotMatch(src, /testLabel \|\| 'the test'/);
  assert.match(src, /testLabel \|\| 'own conduct'/);
});

/* ── (e) "Dgcl" -> "DGCL" casing ── */

test('DGCL is registered in HUMANIZE_ACRONYMS so it never gets title-cased to "Dgcl"', () => {
  const src = SHARED_SRC();
  const idx = src.indexOf('const HUMANIZE_ACRONYMS = new Set([');
  assert.ok(idx > -1);
  const line = src.slice(idx, src.indexOf(']);', idx) + 3);
  assert.match(line, /'DGCL'/);
});

/* ── (f) fees/expenses ref resolution: sectionIndex must fall back to
   provision.section_number (the DB column every canonical type actually
   carries), not just the OTHER-type-only features.sectionNumber ── */

test('renderFeeExpenseCell falls back to provision.section_number when features.sectionNumber is absent', () => {
  const src = REVIEW_SRC();
  const idx = src.indexOf('function renderFeeExpenseCell(');
  assert.ok(idx > -1);
  const body = src.slice(idx, idx + 1300);
  assert.match(body, /p\.section_number/);
});
