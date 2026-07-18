/* Audit-2 item 5 — Antitrust section (ANTI type):
   (a) the Litigation span must ALWAYS render, even when the deal has no
       litigationObligation feature (Metsera previously omitted the span
       entirely) — "Silent" is the affirmative-absence state.
   (b) Consultation renders a tier PILL only for a canonical CONSULTATION_TIER
       code; raw consultation prose that didn't map to a real tier code
       (Red Hat) must render as a short clipped quote styled as text, never
       a "fake pill" holding a whole sentence.
   buildAntitrustSummaryRows lives in components/review/table-logic.js
   (dependency-free, directly importable). The render-side fix
   (renderAntiHitValue / renderAntiObjectValue) is JSX in
   pages/review/[id].js — pinned via source text (documented convention). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let tableLogic;
test.before(async () => {
  tableLogic = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

function prov(id, features, code = 'ANTI-BURDEN', category = 'Antitrust Efforts') {
  return {
    id,
    type: 'ANTI',
    code,
    category,
    full_text: 'source text',
    ai_metadata: { code, features },
  };
}

/* ── (a) Litigation always renders ── */

test('buildAntitrustSummaryRows always includes a Litigation row, even with zero antitrust provisions (Metsera regression)', () => {
  const { buildAntitrustSummaryRows } = tableLogic;
  const rows = buildAntitrustSummaryRows([], []);
  const litigation = rows.find((r) => r.label === 'Litigation');
  assert.ok(litigation, 'Litigation row must always be present');
  assert.equal(litigation.hit, null, 'no litigationObligation feature means hit is null, not the row itself');
});

test('buildAntitrustSummaryRows Litigation row carries the real hit when litigationObligation is present', () => {
  const { buildAntitrustSummaryRows } = tableLogic;
  const provisions = [prov('p1', { litigationObligation: { code: 'MANDATORY_DEFEND', label: 'Must defend' } })];
  const rows = buildAntitrustSummaryRows(provisions, provisions);
  const litigation = rows.find((r) => r.label === 'Litigation');
  assert.ok(litigation.hit);
  assert.equal(litigation.hit.key, 'litigationObligation');
});

test('buildAntitrustSummaryRows Litigation row falls back to parentLitigationObligation', () => {
  const { buildAntitrustSummaryRows } = tableLogic;
  const provisions = [prov('p1', { parentLitigationObligation: { code: 'MANDATORY_DEFEND', label: 'Must defend' } })];
  const rows = buildAntitrustSummaryRows(provisions, provisions);
  const litigation = rows.find((r) => r.label === 'Litigation');
  assert.ok(litigation.hit);
  assert.equal(litigation.hit.key, 'parentLitigationObligation');
});

/* ── (a) render-side: "Silent" for the absent case, pinned via source text ── */

const REVIEW_PATH = path.join(__dirname, '..', 'pages', 'review-v1', '[id].js');
const reviewSrc = () => fs.readFileSync(REVIEW_PATH, 'utf8');

test('renderAntiHitValue renders "Silent" for the Litigation row specifically when hit is absent', () => {
  const src = reviewSrc();
  const fnIdx = src.indexOf('function renderAntiHitValue(row, provisions) {');
  assert.ok(fnIdx > -1);
  const body = src.slice(fnIdx, fnIdx + 700);
  assert.match(body, /row\.label === 'Litigation'.*Silent/s);
});

/* ── (b) Consultation: pill only for a canonical tagged value ── */

test('renderAntiObjectValue gates the Pill on a canonical taxonomy code (dict lookup), not just isTaggedItem', () => {
  const src = reviewSrc();
  const fnIdx = src.indexOf('function renderAntiObjectValue(featureKey, raw) {');
  assert.ok(fnIdx > -1);
  const body = src.slice(fnIdx, fnIdx + 1300);
  assert.match(body, /taxonomyForFeatureKey\(featureKey\)/);
  assert.match(body, /labelForCode\(v\.code, dict\)/);
  assert.match(body, /truncateAtWordBoundary\(text, 180\)/, 'non-canonical tagged values fall back to a clipped-text render, not a Pill');
});

test('renderAntiObjectValue still renders a real Pill for a genuinely canonical tagged value (unchanged behavior)', () => {
  const src = reviewSrc();
  const fnIdx = src.indexOf('function renderAntiObjectValue(featureKey, raw) {');
  const body = src.slice(fnIdx, fnIdx + 1300);
  assert.match(body, /<Pill text=\{label\} quote=\{v\.text\} tone="standard" \/>/);
});
