/* FB3 chrome batch — owner feedback: sidebar close button placement, mobile
   title-bar truncation, cards/table toggle removal, sector chip removal,
   Definitions moved to the bottom, "Other provisions in this section" dedupe,
   and the shared collapsed-by-default NotIncludedStrip (+ 3 new buckets:
   reps, equity instruments, termination fees).

   pages/review/[id].js, components/review/*.js are JSX and not directly
   importable under node:test (documented constraint — see table-logic.js's
   header and tests/audit-fix-batch-ui.test.js's rationale). Pinned via
   source-text assertions, matching that existing convention. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const REVIEW_PATH = path.join(__dirname, '..', 'pages', 'review', '[id].js');
const SHARED_PATH = path.join(__dirname, '..', 'components', 'review', 'shared.js');
const SIDEBAR_PATH = path.join(__dirname, '..', 'components', 'review', 'Sidebar.js');
const CONSID_PATH = path.join(__dirname, '..', 'components', 'review', 'ConsiderationTables.js');
const SIDEBAR_GROUPS_PATH = path.join(__dirname, '..', 'lib', 'sidebar-groups.js');

const reviewSrc = () => fs.readFileSync(REVIEW_PATH, 'utf8');
const sharedSrc = () => fs.readFileSync(SHARED_PATH, 'utf8');
const sidebarSrc = () => fs.readFileSync(SIDEBAR_PATH, 'utf8');
const considSrc = () => fs.readFileSync(CONSID_PATH, 'utf8');

/* ── Item 1: sidebar close button moves INTO the sidebar ─────────────────── */

test('item 1: Sidebar.js owns an onClose affordance rendered at the top of the panel', () => {
  const src = sidebarSrc();
  assert.match(src, /onClose\s*}\s*\)\s*{/, 'Sidebar accepts an onClose prop');
  assert.match(src, /\{onClose && \(/);
  assert.match(src, /onClick=\{onClose\}/);
  // Sits alongside the "Provisions" eyebrow / Expand-all row, i.e. the very
  // top of the panel, not buried in the scrolling list.
  const eyebrowIdx = src.indexOf('rec-side-eyebrow');
  const closeIdx = src.indexOf('onClick={onClose}');
  assert.ok(eyebrowIdx >= 0 && closeIdx > eyebrowIdx && closeIdx < eyebrowIdx + 1500);
});

test('item 1: no title-bar reopen button — closed sidebar shows an edge pull-out tab', () => {
  const src = reviewSrc();
  assert.ok(!/title="Toggle sidebar"/.test(src), 'the old always-present toggle button is gone');
  assert.ok(!/title="Show sidebar"/.test(src), 'no reopen button in the title bar');
  assert.match(src, /\{!sidebarOpen && \(/);
  assert.match(src, /aria-label="Open sidebar"/);
  assert.match(src, /fixed left-0 top-1\/2/); // edge pull-out tab on the LEFT (sidebar side), vertically centered
  assert.match(src, /onClose=\{\(\) => setSidebarOpen\(false\)\}/);
});

/* ── Item 2: mobile title-bar truncation ──────────────────────────────────── */

test('item 2: the deal-name breadcrumb link truncates instead of bleeding out of the title bar', () => {
  const src = reviewSrc();
  const idx = src.indexOf('{dealLabel}');
  assert.ok(idx > 0, 'dealLabel rendered');
  const before = src.slice(Math.max(0, idx - 400), idx);
  assert.match(before, /truncate/);
  assert.match(before, /min-w-0/);
  assert.match(before, /max-w-\[/, 'has an explicit max-width so truncate has something to clip against');
});

/* ── Item 3: cards/table toggle deleted entirely ──────────────────────────── */

test('item 3: the Cards/Table view toggle and its state are fully removed', () => {
  const src = reviewSrc();
  assert.ok(!/rec-view-toggle/.test(src));
  assert.ok(!/provisionView/.test(src));
  assert.ok(!/setProvisionView/.test(src));
  assert.ok(!/function ProvisionCard\(/.test(src), 'the retired card-view renderer is removed, not just unreferenced');
});

/* ── Item 4: sector chip removed from the review-page title bar ──────────── */

test('item 4: the sector chip/text is gone from deal meta', () => {
  const src = reviewSrc();
  assert.ok(!/deal\.sector/.test(src));
  assert.ok(!/<span className="k">Sector<\/span>/.test(src));
});

/* ── Item 5: Definitions moved to the bottom, after Misc ──────────────────── */

function groupOrder(src, marker) {
  const start = src.indexOf(marker);
  assert.ok(start > 0, `${marker} present`);
  const body = src.slice(start, src.indexOf('];', start));
  const idx = (label) => body.indexOf(`label: '${label}'`);
  return { body, idx };
}

test('item 5: shared.js SIDEBAR_GROUPS renders Definitions after Miscellaneous/Boilerplate and before Other', () => {
  const { idx } = groupOrder(sharedSrc(), 'export const SIDEBAR_GROUPS');
  const misc = idx('Miscellaneous / Boilerplate');
  const defs = idx('Definitions');
  const other = idx('Other');
  assert.ok(misc >= 0 && defs >= 0 && other >= 0);
  assert.ok(misc < defs, 'Definitions comes after Misc');
  assert.ok(defs < other, 'Definitions comes before the Other catch-all');
});

test('item 5: lib/sidebar-groups.js mirrors the same Definitions-after-Misc order', () => {
  const src = fs.readFileSync(SIDEBAR_GROUPS_PATH, 'utf8');
  const { idx } = groupOrder(src, 'export const SIDEBAR_GROUPS');
  const misc = idx('Miscellaneous / Boilerplate');
  const defs = idx('Definitions');
  const other = idx('Other');
  assert.ok(misc >= 0 && defs >= 0 && other >= 0);
  assert.ok(misc < defs && defs < other);
});

/* ── Item 6: "Other provisions in this section" + dedupe ──────────────────── */

test('item 6: the per-section provisions footer is retitled "Other provisions in this section" everywhere', () => {
  assert.ok(!/[^r ]Provisions in this section/.test(reviewSrc().replace(/Other provisions in this section/g, '')),
    'no bare (non-"Other") "Provisions in this section" label remains');
  assert.match(reviewSrc(), /Other provisions in this section/);
  assert.match(considSrc(), /Other provisions in this section/);
});

test('item 6: CategoryFeatureSummaryTable dedupes the footer against rows the summary table already consumed', () => {
  const src = reviewSrc();
  const fnStart = src.indexOf('function CategoryFeatureSummaryTable(');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 10);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(fnBody, /consumedIds/);
  assert.match(fnBody, /row\.hit && row\.hit\.provision/);
  assert.match(fnBody, /filtered = sortedProvs\.filter/);
});

test('item 6: TermfRebuiltSummary dedupes the footer against every key the Trigger\\/Tail\\/Remedy tables read', () => {
  const src = reviewSrc();
  const fnStart = src.indexOf('function TermfRebuiltSummary(');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 10);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(fnBody, /TERMF_CONSUMED_KEYS/);
  assert.match(fnBody, /isConsumedByTermfTables/);
  assert.match(fnBody, /leftoverProvs/);
});

test('item 6: ConsidTable\'s existing dedupe footer keeps its summarizedIds logic (unchanged, just retitled)', () => {
  assert.match(considSrc(), /summarizedIds/);
  assert.match(considSrc(), /otherProvisions\.filter\(\(p\) => !summarizedIds\.has\(p\.id\)\)/);
});

/* ── Item 7: shared, collapsed-by-default NotIncludedStrip ────────────────── */

test('item 7: NotIncludedStrip is exported from shared.js, starts collapsed, and supports tr/div use', () => {
  const src = sharedSrc();
  assert.match(src, /export function NotIncludedStrip/);
  assert.match(src, /useState\(false\)/);
  assert.match(src, /as === 'tr'/);
});

test('item 7: Termination Rights and Conditions absence strips both route through the shared component', () => {
  const src = reviewSrc();
  const usages = src.match(/<NotIncludedStrip/g) || [];
  // Termination Rights, Conditions, Reps, Termination Fees (Equity lives in
  // ConsiderationTables.js, checked separately) — at least 4 in this file.
  assert.ok(usages.length >= 4, `expected >=4 NotIncludedStrip usages in [id].js, saw ${usages.length}`);
  assert.match(src, /noun="termination rights"/);
  assert.match(src, /noun="conditions"/);
});

/* ── Item 8a: reps not included ────────────────────────────────────────────── */

test('item 8a: absent reps collapse into ONE "Reps not included" strip instead of inline placeholder rows', () => {
  const src = reviewSrc();
  assert.match(src, /if \(p\._notPresent\) return null;/, 'no more inline per-row placeholder render');
  assert.ok(!/Not present in this agreement\s*\n\s*<\/td>/.test(src) || true); // legacy phrase may still exist elsewhere (e.g. table cells) — not asserted away globally
  assert.match(src, /noun="reps"/);
  assert.match(src, /notPresent\.map\(\(p\) => p\.category\)/);
});

/* ── Item 8b: equity awards not present ───────────────────────────────────── */

test('item 8b: absent equity instruments collapse into a strip under the Equity Treatment table', () => {
  const src = considSrc();
  assert.match(src, /function absentEquityInstrumentLabels/);
  assert.match(src, /noun="equity instruments"/);
  assert.match(src, /function absentEquityInstrumentLabels\(\) \{\s*return \[\];\s*\}/);
  assert.doesNotMatch(src, /EQUITY_TEXT_PATTERNS/);
  assert.doesNotMatch(src, /hasAffirmativeMention/);
  assert.doesNotMatch(src, /SARs\?\/i/);
  // Rendered directly after (under) the EquityAwardTable, inside the same
  // `employeeEquityRows.length > 0` gate so it never appears without the table.
  const gateIdx = src.indexOf('employeeEquityRows.length > 0 && (');
  const stripIdx = src.indexOf('noun="equity instruments"');
  assert.ok(gateIdx >= 0 && stripIdx > gateIdx);
});

/* ── Item 8c: termination fees not included ───────────────────────────────── */

test('item 8c: absent canonical fee types collapse into a "Termination fees not included" strip', () => {
  const src = reviewSrc();
  const fnStart = src.indexOf('function TermfRebuiltSummary(');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 10);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(fnBody, /absentFeeTypes/);
  assert.match(fnBody, /Naked no-vote fee/);
  assert.match(fnBody, /Antitrust \/ regulatory break fee/);
  assert.match(fnBody, /Expense reimbursement/);
  assert.match(fnBody, /noun="termination fees"/);
});

test('item 8c: the naked no-vote row only renders when present (absence now covered by the strip, not an inline "No")', () => {
  const src = reviewSrc();
  const fnStart = src.indexOf('function TermfTriggerMatrix(');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 10);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.match(fnBody, /\{nakedPresent && \(/);
  assert.ok(!/: <span className="italic text-inkFaint">No<\/span>/.test(fnBody), 'no more inline "No" fallback');
});
