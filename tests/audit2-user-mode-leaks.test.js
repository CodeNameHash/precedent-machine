/* Audit-2 item 3 — user-mode leaks:
   (a) "[PROPOSED] " category prefixes (an editor-only promote-to-canonical
       signal, lib/parser-v2/extract.js stamps it when a proposed category
       isn't yet in the taxonomy) rendered verbatim in read-only USER mode
       (observed on Skechers x5, Cooper x8, Red Hat x3 provisions). Fixed at
       the single choke point every downstream table/sidebar/list already
       reads from: components/review/table-logic.js's
       filterProvisionsForViewMode.
   (b) Cooper's IOC(B) section stub showed a live Edit button in user mode —
       must gate on useViewMode's isEdit like every other edit affordance
       (pinned via source-text assertion; the section-stub component is JSX). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let tableLogic;
test.before(async () => {
  tableLogic = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

/* ── (a) stripProposedCategoryPrefix ── */

test('stripProposedCategoryPrefix removes the "[PROPOSED] " marker', () => {
  const { stripProposedCategoryPrefix } = tableLogic;
  assert.equal(stripProposedCategoryPrefix('[PROPOSED] Regulatory Efforts'), 'Regulatory Efforts');
});

test('stripProposedCategoryPrefix is a no-op on an already-canonical category', () => {
  const { stripProposedCategoryPrefix } = tableLogic;
  assert.equal(stripProposedCategoryPrefix('Regulatory Efforts'), 'Regulatory Efforts');
});

test('stripProposedCategoryPrefix passes non-strings through unchanged', () => {
  const { stripProposedCategoryPrefix } = tableLogic;
  assert.equal(stripProposedCategoryPrefix(null), null);
  assert.equal(stripProposedCategoryPrefix(undefined), undefined);
});

/* ── (a) filterProvisionsForViewMode strips the prefix outside edit mode ── */

test('filterProvisionsForViewMode strips "[PROPOSED] " from category in USER mode', () => {
  const { filterProvisionsForViewMode } = tableLogic;
  const provisions = [
    { id: 'p1', type: 'IOC', category: '[PROPOSED] Regulatory Efforts' },
    { id: 'p2', type: 'REP-T', category: 'Capital Structure' },
  ];
  const out = filterProvisionsForViewMode(provisions, false);
  assert.equal(out.find((p) => p.id === 'p1').category, 'Regulatory Efforts');
  assert.equal(out.find((p) => p.id === 'p2').category, 'Capital Structure');
});

test('filterProvisionsForViewMode leaves "[PROPOSED] " intact in EDIT mode (the promote-to-canonical signal)', () => {
  const { filterProvisionsForViewMode } = tableLogic;
  const provisions = [{ id: 'p1', type: 'IOC', category: '[PROPOSED] Regulatory Efforts' }];
  const out = filterProvisionsForViewMode(provisions, true);
  assert.equal(out[0].category, '[PROPOSED] Regulatory Efforts');
});

test('filterProvisionsForViewMode does not mutate the source provision object', () => {
  const { filterProvisionsForViewMode } = tableLogic;
  const original = { id: 'p1', type: 'IOC', category: '[PROPOSED] Regulatory Efforts' };
  const out = filterProvisionsForViewMode([original], false);
  assert.equal(original.category, '[PROPOSED] Regulatory Efforts', 'source object must be untouched');
  assert.equal(out[0].category, 'Regulatory Efforts');
});

test('filterProvisionsForViewMode still gates SECTION-LEFTOVER in USER mode (existing behavior preserved)', () => {
  const { filterProvisionsForViewMode } = tableLogic;
  const provisions = [
    { id: 'p1', type: 'SECTION-LEFTOVER', category: 'Coverage backfill' },
    { id: 'p2', type: 'REP-T', category: 'Capital Structure' },
  ];
  const out = filterProvisionsForViewMode(provisions, false);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'p2');
});

test('filterProvisionsForViewMode repeated on 5 (Skechers-scale) IOC provisions strips every proposed prefix', () => {
  const { filterProvisionsForViewMode } = tableLogic;
  const provisions = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    type: 'IOC',
    category: `[PROPOSED] Novel Covenant ${i}`,
  }));
  const out = filterProvisionsForViewMode(provisions, false);
  assert.ok(out.every((p) => !p.category.startsWith('[PROPOSED]')));
});

/* ── (b) Cooper IOC(B) section stub: Edit button gated on isEdit ──
   PreambleCard renders the "Section Preamble" card for the (often sole)
   provision in a section that has little else extracted yet — on Cooper's
   IOC(B) (Company-side Interim Operating Covenants), this preamble card IS
   the section stub. Its Edit button rendered whenever `onEdit` was truthy,
   with no isEdit check, unlike every other edit affordance in this file
   (e.g. the "onAddProvision={isEdit ? handleBeginAdd : undefined}" pattern
   a few lines below the PreambleCard call site). Pinned via source text:
   pages/review/[id].js is JSX and not directly importable under node:test
   (documented convention, see tests/fb3-chrome.test.js's header). */

const REVIEW_PATH = path.join(__dirname, '..', 'pages', 'review', '[id].js');
const reviewSrc = () => fs.readFileSync(REVIEW_PATH, 'utf8');

test('PreambleCard renders its Edit button only when onEdit is passed (component contract unchanged)', () => {
  const src = reviewSrc();
  const compIdx = src.indexOf('function PreambleCard(');
  assert.ok(compIdx > -1, 'expected to find the PreambleCard component');
  const body = src.slice(compIdx, compIdx + 2000);
  assert.match(body, /\{onEdit && \(/, 'PreambleCard still gates its Edit button on onEdit being truthy');
});

test('the PreambleCard call site passes onEdit gated on isEdit, not the handler unconditionally', () => {
  const src = reviewSrc();
  const callIdx = src.indexOf('<PreambleCard');
  assert.ok(callIdx > -1, 'expected to find the PreambleCard call site');
  const call = src.slice(callIdx, callIdx + 250);
  assert.match(
    call,
    /onEdit=\{isEdit \? handleEditProvision : undefined\}/,
    'PreambleCard (the section-stub content on e.g. Cooper IOC-B) must not show a live Edit button in read-only user mode'
  );
  assert.doesNotMatch(call, /onEdit=\{handleEditProvision\}/, 'must not pass the raw handler unconditionally');
});
