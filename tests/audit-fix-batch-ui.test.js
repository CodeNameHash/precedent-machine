/* Audit fix batch (reps columns, IOC exceptions/labels, RSA row, tail
   truncation) — component-level regression tests for items 1, 3, 4 and 10.
   Run: npm test

   [id].js itself is JSX and not directly importable under node:test (same
   constraint documented in components/review/table-logic.js's header), so
   the pure DECISION logic behind each fix was extracted into table-logic.js
   (mirroring the existing termCellHoverQuote / knowledgeQualifierDisplay /
   buildBringdownTierLines pattern) and is exercised here with real-shaped
   Metsera fixtures. Item 10 has no meaningful pure logic to extract (it's a
   JSX markup swap), so it's pinned via source-text assertions against
   pages/review/[id].js, matching the existing convention in
   tests/reps-table-display.test.js (block 2a/2b). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

const SRC_PATH = path.join(__dirname, '..', 'pages', 'review', '[id].js');
const src = () => fs.readFileSync(SRC_PATH, 'utf8');

// Slice out one top-level function's source text by name, bounded by the
// NEXT top-level (zero-indentation) `function `/`const NAME = ` declaration
// — nested helpers inside the function (e.g. `const Cell = (...) => {}`) are
// always indented, so they never match this boundary.
function functionBody(fnName) {
  const s = src();
  const fnStart = s.indexOf(`function ${fnName}(`);
  assert.ok(fnStart >= 0, `${fnName} found in source`);
  const rest = s.slice(fnStart + fnName.length + 10);
  const m = rest.match(/\n(?:function |const [A-Za-z0-9_]+ = )/);
  const fnEnd = m ? fnStart + fnName.length + 10 + m.index : s.length;
  return s.slice(fnStart, fnEnd);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Item 1 — reps-table raw-column leak. Batch-2 AoC / No-Other-Reps /
 * knowledge-scope keys must be hidden from the per-row column list, and the
 * AoC "No MAE" limb + cited-covenant text builders must render clean prose,
 * never "[object Object]".
 * ───────────────────────────────────────────────────────────────────────── */

test('item 1: batch-2 AoC/No-Other-Reps/knowledge keys are hidden from the REP-T/REP-B column list', () => {
  const s = src();
  const batch2Keys = [
    'aocNoMaePresent', 'aocOrdinaryCourseLimb', 'aocCitedCovenantSections',
    'aocCitedCovenantNames', 'noOtherRepsPresent', 'nonRelianceClause',
    'extraContractualClaimsWaived', 'fraudCarveout', 'knowledgeScope',
  ];
  // Pull the REP-T array literal out of HIDDEN_TABLE_COLUMNS specifically
  // (FEATURE_DISPLAY_ORDER earlier in the file also has an unrelated,
  // much shorter 'REP-T': [...] entry — anchor past that one first).
  const hiddenColumnsBlock = s.slice(s.indexOf('const HIDDEN_TABLE_COLUMNS'));
  const m = hiddenColumnsBlock.match(/'REP-T':\s*\[([\s\S]*?)\n  \],\n  'REP-B':/);
  assert.ok(m, 'REP-T hidden-columns block found');
  const repTBlock = m[1];
  for (const key of batch2Keys) {
    assert.ok(repTBlock.includes(`'${key}'`), `${key} must be in REP-T's hidden-columns denylist`);
  }
});

test('item 1: buildAocNoMaeLimbText renders "No MAE since <date>" (real Metsera shape)', () => {
  assert.equal(mod.buildAocNoMaeLimbText(true, 'January 1, 2025'), 'No MAE since January 1, 2025');
});

test('item 1: buildAocNoMaeLimbText falls back to a placeholder when the limb is present but undated', () => {
  assert.equal(mod.buildAocNoMaeLimbText(true, null), 'No MAE since [date not specified]');
});

test('item 1: buildAocNoMaeLimbText returns null when the limb is absent (never a false-y column)', () => {
  assert.equal(mod.buildAocNoMaeLimbText(false, null), null);
  assert.equal(mod.buildAocNoMaeLimbText(null, 'January 1, 2025'), null);
});

// Real Metsera-shaped aocCitedCovenantNames: post-pass resolved { section,
// name } pairs, one with a null name (section only, e.g. an unresolvable
// cite).
const METSERA_CITED_COVENANTS = [
  { section: '5.01(a)', name: 'Dividends and Distributions' },
  { section: '5.01(d)', name: 'M&A/Dispositions' },
  { section: '5.01(h)', name: null },
];

test('item 1: buildAocCitedCovenantsText joins "<section> <name>" pairs, section alone when name is null', () => {
  const text = mod.buildAocCitedCovenantsText(METSERA_CITED_COVENANTS);
  assert.equal(
    text,
    '5.01(a) Dividends and Distributions, 5.01(d) M&A/Dispositions, 5.01(h)',
  );
  assert.ok(!/\[object Object\]/.test(text), 'never the generic array stringifier');
});

test('item 1: buildAocCitedCovenantsText returns null for an empty/absent list', () => {
  assert.equal(mod.buildAocCitedCovenantsText([]), null);
  assert.equal(mod.buildAocCitedCovenantsText(null), null);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 3 — IOC General Exceptions source selection. Metsera-shaped scenario:
 * a bare-IOC "General Exceptions" preamble row (permittedExceptions with 4
 * tagged items, including a verbatim Parent-consent parenthetical) sitting
 * alongside an IOC-T negative-covenant sub-clause row that must NOT
 * contribute. isPreambleProvision() never matches the General-Exceptions
 * row's own category, so the old code never treated it as a structured
 * source — this pins the fix.
 * ───────────────────────────────────────────────────────────────────────── */

const METSERA_GENERAL_EXCEPTIONS_ROW = {
  isNegativePreamble: false,
  isPositivePreamble: false, // bare-IOC row, category "General Exceptions" — NOT "Preamble"
  isGeneralExceptionsRow: true,
  permittedExceptions: [
    { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'except as set forth in the Company Disclosure Letter' },
    { code: 'REQUIRED_BY_LAW', label: 'Required by Law', text: 'or as required by applicable Law' },
    { code: 'PANDEMIC', label: 'COVID-19 Measures', text: 'or in connection with COVID-19 Measures' },
    { code: 'WITH_CONSENT', label: 'With consent', text: '(which consent of Parent shall not be unreasonably withheld, delayed or conditioned)' },
  ],
  generalExceptions: [],
  source: 'general-exceptions-provision',
};

const METSERA_NEGATIVE_SUBCLAUSE_ROW = {
  isNegativePreamble: false,
  isPositivePreamble: false,
  isGeneralExceptionsRow: false,
  permittedExceptions: [{ code: 'ORDINARY_COURSE', label: 'Ordinary course', text: 'in the ordinary course of business' }],
  generalExceptions: [],
  source: 'indebtedness-subclause-provision',
};

test('item 3: a bare-IOC General-Exceptions row contributes its structured pills regardless of party/preamble typing', () => {
  const { items, skipTextFallback } = mod.selectIocGeneralExceptionsItems([
    METSERA_GENERAL_EXCEPTIONS_ROW,
    METSERA_NEGATIVE_SUBCLAUSE_ROW,
  ]);
  assert.equal(items.length, 4, 'all 4 General-Exceptions pills selected, sub-clause row excluded');
  assert.ok(items.every((i) => i.source === 'general-exceptions-provision'));
  const consentPill = items.find((i) => i.item.code === 'WITH_CONSENT');
  assert.ok(consentPill, 'Parent-consent pill present');
  assert.equal(
    consentPill.item.text,
    '(which consent of Parent shall not be unreasonably withheld, delayed or conditioned)',
    'verbatim Parent-consent parenthetical preserved',
  );
  assert.equal(skipTextFallback, true, 'raw full_text splitter must be skipped once structured pills were found');
});

test('item 3: the raw-text fallback is NOT skipped when no row contributed structured items', () => {
  const { items, skipTextFallback } = mod.selectIocGeneralExceptionsItems([
    { ...METSERA_GENERAL_EXCEPTIONS_ROW, permittedExceptions: [], isGeneralExceptionsRow: true },
  ]);
  assert.equal(items.length, 0);
  assert.equal(skipTextFallback, false);
});

test('item 3: negative-preamble rows never contribute (excluded up front)', () => {
  const { items } = mod.selectIocGeneralExceptionsItems([
    { ...METSERA_GENERAL_EXCEPTIONS_ROW, isNegativePreamble: true },
  ]);
  assert.equal(items.length, 0);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 4 — IOC negative-covenant row naming. Real Metsera shape: 3 rows
 * share the raw category "Mergers, Acquisitions, Dispositions" but resolve
 * to 3 different canonical codes; 2 rows both genuinely resolve to
 * INDEBTEDNESS and must fall back to a section-number suffix.
 * ───────────────────────────────────────────────────────────────────────── */

test('item 4: rows sharing a raw category but different canonical codes get distinct labels, no suffix needed', () => {
  const labels = mod.buildIocRowDisplayLabels([
    { key: 'p1', canonicalLabel: 'Acquisitions / business combinations', fallbackLabel: 'Mergers, Acquisitions, Dispositions', sectionNumber: '5.01(b)(i)' },
    { key: 'p2', canonicalLabel: 'Asset sales / divestitures / licenses', fallbackLabel: 'Mergers, Acquisitions, Dispositions', sectionNumber: '5.01(b)(ii)' },
    { key: 'p3', canonicalLabel: 'Merger / consolidation / liquidation / recapitalization', fallbackLabel: 'Mergers, Acquisitions, Dispositions', sectionNumber: '5.01(b)(iii)' },
  ]);
  assert.equal(labels.get('p1'), 'Acquisitions / business combinations');
  assert.equal(labels.get('p2'), 'Asset sales / divestitures / licenses');
  assert.equal(labels.get('p3'), 'Merger / consolidation / liquidation / recapitalization');
});

test('item 4: two rows that genuinely resolve to the SAME canonical code disambiguate with a section-number suffix', () => {
  const labels = mod.buildIocRowDisplayLabels([
    { key: 'p1', canonicalLabel: 'Indebtedness / financing', fallbackLabel: 'Indebtedness', sectionNumber: '5.01(h)' },
    { key: 'p2', canonicalLabel: 'Indebtedness / financing', fallbackLabel: 'Indebtedness', sectionNumber: '5.01(i)' },
  ]);
  assert.equal(labels.get('p1'), 'Indebtedness / financing — 5.01(h)');
  assert.equal(labels.get('p2'), 'Indebtedness / financing — 5.01(i)');
});

test('item 4: an unresolved row (no canonical code) falls back to the raw category, uniquely', () => {
  const labels = mod.buildIocRowDisplayLabels([
    { key: 'p1', canonicalLabel: null, fallbackLabel: 'Bespoke Covenant', sectionNumber: null },
  ]);
  assert.equal(labels.get('p1'), 'Bespoke Covenant');
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 10 — Termination Rights absent-rights pill strip (same treatment as
 * Conditions). Source-pinned: no importable pure logic, JSX markup swap.
 * ───────────────────────────────────────────────────────────────────────── */

test('item 10: TermrRebuiltSummary no longer renders an inline per-right absence placeholder row', () => {
  const fnBody = functionBody('TermrRebuiltSummary');
  assert.ok(!/Not present in this agreement/.test(fnBody), 'inline absence-placeholder row must be gone');
});

test('item 10: TermrRebuiltSummary renders the same strikethrough "not included" pill strip as Conditions', () => {
  const fnBody = functionBody('TermrRebuiltSummary');
  assert.match(fnBody, /Termination rights not included/);
  assert.match(fnBody, /line-through/);
  assert.match(fnBody, /title=\{CONDITION_ABSENT_COPY\}/);
  // Same pill classes as CondSingleTable's "Conditions not included" strip.
  assert.match(fnBody, /inline-flex items-center text-\[10px\] font-ui px-1\.5 py-0\.5 rounded border bg-bg\/40 text-inkFaint\/70 border-border line-through/);
});

test('item 10: absent rights still get the green row dot treatment (only present-row markup changed)', () => {
  const fnBody = functionBody('TermrRebuiltSummary');
  assert.match(fnBody, /background: REP_ROW_DOT_GREEN/);
});
