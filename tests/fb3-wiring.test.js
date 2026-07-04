/* FB3 — provision card view (Surface 1) + in-place document pop-under
   (Surface 2). The two new surfaces are plain JSX/pages and can't be
   rendered under node --test (no DOM/React harness in this repo — see
   tests/review-layout.test.js for the established precedent of asserting
   against source text instead). These tests pin the WIRING points: the
   shared <TermCell> helper is mounted where tables render clickable term
   labels, the page-level providers/state that make it work are present,
   and the new route file exists with the expected shape.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
const termCellSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'TermCell.js'), 'utf8');
const docPopUnderSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'DocPopUnder.js'), 'utf8');
const cardPagePath = path.join(__dirname, '..', 'pages', 'review', '[id]', 'provision', '[provisionId].js');

test('TermCell.js exports the shared cell-wrapper + nav context (single source for card click-through + see-text)', () => {
  assert.match(termCellSrc, /export const DealNavContext/);
  assert.match(termCellSrc, /export function useDealNav/);
  assert.match(termCellSrc, /export function TermCell/);
  // Card click-through: builds a link into the per-provision page.
  assert.match(termCellSrc, /\/review\/\$\{dealId\}\/provision\/\$\{provision\.id\}/);
  // "See text" affordance calls back into DealNavContext's openSeeText.
  assert.match(termCellSrc, /openSeeText\(\{ provision, quote/);
});

test('DocPopUnder.js renders a windowed excerpt (lib/doc-match), not the whole document in one node', () => {
  assert.match(docPopUnderSrc, /from '\.\.\/\.\.\/lib\/doc-match'/);
  assert.match(docPopUnderSrc, /locateQuoteInText/);
  assert.match(docPopUnderSrc, /buildWindow/);
  // Esc closes via the app-wide pm:escape event (components/ViewModeContext's
  // sibling convention — see pages/_app.js), not a duplicate keydown listener.
  assert.match(docPopUnderSrc, /pm:escape/);
});

test('pages/review/[id].js mounts DealNavContext so every TermCell knows its deal + can open the pop-under', () => {
  assert.match(reviewSrc, /import \{ DealNavContext, TermCell \} from '\.\.\/\.\.\/components\/review\/TermCell'/);
  assert.match(reviewSrc, /<DealNavContext\.Provider value=\{dealNavCtxValue\}>/);
  assert.match(reviewSrc, /const dealNavCtxValue = useMemo/);
});

test('pages/review/[id].js mounts exactly one DocPopUnder, wired to the docSheet state', () => {
  const matches = reviewSrc.match(/<DocPopUnder\b/g) || [];
  assert.equal(matches.length, 1);
  assert.match(reviewSrc, /const \[docSheet, setDocSheet\] = useState/);
  assert.match(reviewSrc, /const openSeeText = useCallback/);
});

test('pages/review/[id].js reads ?edit=<id> so Surface 1\'s "Edit" link can open the existing edit panel', () => {
  assert.match(reviewSrc, /router\.query\.edit/);
  assert.match(reviewSrc, /handleEditProvisionById\(editId\)/);
});

test('CategoryFeatureSummaryTable\'s term/label column is wired through TermCell (Surface 1 + 2 reachable from the generic summary table)', () => {
  const idx = reviewSrc.indexOf('function CategoryFeatureSummaryTable');
  assert.ok(idx > 0);
  const body = reviewSrc.slice(idx, reviewSrc.indexOf('\nfunction ', idx + 10));
  assert.match(body, /<TermCell provision=\{row\.hit && row\.hit\.provision\} quote=\{quote\}>/);
});

test('NosolFourTables mini-tables route their term column through the same TermCell (uniform wiring, not a per-table reimplementation)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'NosolFourTables.js'), 'utf8');
  assert.match(src, /import \{ TermCell \} from '\.\/TermCell'/);
  assert.match(src, /<TermCell provision=\{row\.hit && row\.hit\.provision\} quote=\{quote\}>/);
});

test('Surface 1 route file exists at pages/review/[id]/provision/[provisionId].js', () => {
  assert.ok(fs.existsSync(cardPagePath), 'expected the nested dynamic route file to exist');
  const src = fs.readFileSync(cardPagePath, 'utf8');
  // Features-top, full-text-below layout contract; family grouping via the
  // pure, independently-tested provision-family module (not reinvented here).
  assert.match(src, /buildProvisionFamily/);
  assert.match(src, /FeatureGrid/);
  assert.match(src, /rec-source-body/);
  // Edit mode links back to the review page's existing edit panel rather
  // than reimplementing EditPanel's page-level dependencies (deal/allTypes/
  // allCategories/save handlers) on a second page.
  assert.match(src, /\?mode=edit&edit=\$\{part\.id\}/);
});

test('components/review/provision-family.js has no JSX (pure logic — the reason it is unit-testable, unlike the page files)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'provision-family.js'), 'utf8');
  assert.ok(!/return\s*\(?\s*<[A-Za-z]/.test(src), 'expected no JSX element returned from this pure family-grouping module');
  assert.ok(!/\breact\b/i.test(src), 'expected no React import — this module is plain JS');
});
