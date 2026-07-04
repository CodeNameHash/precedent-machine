/* Live-recheck polish batch — 6 diagnosed items surfaced on a live pass of
   Metsera (and, for item 4, a second deal). Run: npm test

   pages/review/[id].js and components/review/ConsiderationTables.js contain
   JSX and aren't directly importable under `node --test` (same constraint
   documented in table-logic.js's header) — the pure DECISION logic behind
   each testable item was extracted into table-logic.js (mirroring the
   existing termCellHoverQuote / knowledgeQualifierDisplay pattern) and is
   exercised here with real-shaped Metsera fixtures pulled from the deal's
   actual stored ai_metadata. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 1 — IOC General Exceptions: 4th pill (REQUIRED_BY_AGREEMENT) dropped.
 * Real Metsera shape: the General Exceptions preamble's permittedExceptions
 * carries exactly these 4 tagged items, each with its own distinct code.
 * ───────────────────────────────────────────────────────────────────────── */

const EXCEPTION_CODES_DICT = {
  COMPANY_DISCLOSURE_LETTER: 'As disclosed',
  DISCLOSURE_SCHEDULE: 'As disclosed',
  REQUIRED_BY_LAW: 'As required by law',
  REQUIRED_BY_AGREEMENT: 'As contemplated by this Agreement',
  WRITTEN_CONSENT: 'With Parent’s consent',
  PRIOR_WRITTEN_CONSENT: 'With Parent’s consent',
};

const METSERA_GENERAL_EXCEPTIONS_4 = [
  { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'except for matters set forth in Section 5.01 of the Company Disclosure Letter' },
  { code: 'REQUIRED_BY_AGREEMENT', label: 'As contemplated by this Agreement', text: 'otherwise expressly required by this Agreement' },
  { code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'required by applicable Law' },
  { code: 'PRIOR_WRITTEN_CONSENT', label: 'With Parent’s consent', text: 'without the prior written consent of Parent (which consent shall not be unreasonably withheld, delayed or conditioned)' },
];

test('item 1: all 4 Metsera General-Exceptions pills survive dedup — REQUIRED_BY_AGREEMENT is never folded into "As disclosed"', () => {
  const out = mod.dedupeIocExceptionEntries(METSERA_GENERAL_EXCEPTIONS_4, EXCEPTION_CODES_DICT);
  assert.equal(out.length, 4, `expected 4 pills, got ${out.length}: ${JSON.stringify(out.map((o) => o.code))}`);
  const codes = out.map((o) => o.code);
  assert.ok(codes.includes('REQUIRED_BY_AGREEMENT'), 'REQUIRED_BY_AGREEMENT pill present');
  const req = out.find((o) => o.code === 'REQUIRED_BY_AGREEMENT');
  assert.equal(req.label, 'As contemplated by this Agreement', 'its own distinct label, not "As disclosed"');
  assert.equal(req.text, 'otherwise expressly required by this Agreement', 'verbatim hover text preserved');
});

test('item 1: genuine near-duplicates (disclosure-schedule / consent variants) still collapse to one pill', () => {
  const out = mod.dedupeIocExceptionEntries([
    { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'a' },
    { code: 'DISCLOSURE_SCHEDULE', label: 'As disclosed', text: 'b' },
    { code: 'WRITTEN_CONSENT', label: 'With consent', text: 'c' },
    { code: 'PRIOR_WRITTEN_CONSENT', label: 'With Parent’s consent', text: 'd' },
  ], EXCEPTION_CODES_DICT);
  const codes = out.map((o) => o.code);
  assert.equal(codes.filter((c) => c === 'COMPANY_DISCLOSURE_LETTER').length, 1);
  assert.equal(codes.filter((c) => c === 'PRIOR_WRITTEN_CONSENT').length, 1);
  assert.equal(out.length, 2);
});

test('item 1: entries with no dictionary label fall back to their own label', () => {
  const out = mod.dedupeIocExceptionEntries([
    { code: 'BESPOKE_CODE', label: 'Some bespoke carve-out', text: 'x' },
  ], EXCEPTION_CODES_DICT);
  assert.equal(out[0].label, 'Some bespoke carve-out');
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 2 — equity-instrument vesting inheritance. Real Metsera shape: 3
 * outstandingInstruments (Stock Options, Restricted Stock, ESPP) but only 1
 * instrumentVesting entry (the options' own double-trigger clause).
 * ───────────────────────────────────────────────────────────────────────── */

const METSERA_DOUBLE_TRIGGER_VESTING = {
  code: 'ACCEL_ELSE_DOUBLE_TRIGGER',
  label: 'Accelerates if it vests by its terms; otherwise rolls over subject to double-trigger vesting',
  text: 'shall be subject to the same vesting schedule and terms (including double-trigger vesting protection) as were applicable to the corresponding Company Stock Option',
};

test('item 2: the instrument WITH its own vesting entry keeps it (index 0 — Stock Options)', () => {
  const v = mod.resolveInstrumentVesting(0, [METSERA_DOUBLE_TRIGGER_VESTING], METSERA_DOUBLE_TRIGGER_VESTING, 3);
  assert.equal(v, METSERA_DOUBLE_TRIGGER_VESTING);
});

test('item 2: instruments beyond the vesting array (RESTRICTED_STOCK, ESPP) render nothing — never inherit the options\' clause', () => {
  const rsaVesting = mod.resolveInstrumentVesting(1, [METSERA_DOUBLE_TRIGGER_VESTING], METSERA_DOUBLE_TRIGGER_VESTING, 3);
  const esppVesting = mod.resolveInstrumentVesting(2, [METSERA_DOUBLE_TRIGGER_VESTING], METSERA_DOUBLE_TRIGGER_VESTING, 3);
  assert.equal(rsaVesting, null, 'RSA row must render "—", not the options\' double-trigger text');
  assert.equal(esppVesting, null, 'ESPP row must render "—", not the options\' double-trigger text');
});

test('item 2: the section-wide field IS trusted when it is genuinely the section\'s only instrument', () => {
  const v = mod.resolveInstrumentVesting(0, [], METSERA_DOUBLE_TRIGGER_VESTING, 1);
  assert.equal(v, METSERA_DOUBLE_TRIGGER_VESTING);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 3 — Knowledge Qualifier "Partial: PARTIAL" raw-enum leak.
 * ───────────────────────────────────────────────────────────────────────── */

test('item 3: scope=PARTIAL with no descriptive text renders bare "Partial" (detail is null, not the raw enum)', () => {
  const d = mod.knowledgeQualifierDisplay({
    code: 'KNOW_ACTUAL',
    label: 'Actual knowledge',
    scope: 'PARTIAL',
  });
  assert.equal(d.scope, 'partial');
  assert.equal(d.detail, null, 'detail must never be the raw "PARTIAL" enum');
});

test('item 3: scope=ENTIRE_REP still renders "entire" with no detail leak either', () => {
  const d = mod.knowledgeQualifierDisplay({
    code: 'KNOW_ACTUAL',
    label: 'Actual knowledge',
    scope: 'ENTIRE_REP',
  });
  assert.equal(d.scope, 'entire');
  assert.equal(d.detail, null);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 5 — SECTION-LEFTOVER gated to edit mode only.
 * ───────────────────────────────────────────────────────────────────────── */

const MIXED_PROVISIONS = [
  { id: '1', type: 'REP-T' },
  { id: '2', type: 'SECTION-LEFTOVER' },
  { id: '3', type: 'TERMF' },
  { id: '4', type: 'SECTION-LEFTOVER' },
];

test('item 5: USER mode filters SECTION-LEFTOVER out entirely', () => {
  const out = mod.filterProvisionsForViewMode(MIXED_PROVISIONS, false);
  assert.equal(out.length, 2);
  assert.ok(out.every((p) => p.type !== 'SECTION-LEFTOVER'));
});

test('item 5: EDIT mode keeps SECTION-LEFTOVER visible', () => {
  const out = mod.filterProvisionsForViewMode(MIXED_PROVISIONS, true);
  assert.equal(out.length, 4);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 6 — tail-arming truncation ends mid-clause. Real Metsera TAIL trigger
 * label (218 chars, COMPLETE in storage) used to truncate to 120 chars,
 * landing on "...with a bidder that was on the table is…" — a dangling
 * verb. Truncation must prefer a clause boundary and use a generous enough
 * cap that this real sentence lands on one.
 * ───────────────────────────────────────────────────────────────────────── */

const METSERA_TAIL_TRIGGER_LABEL =
  'Deal is terminated on specified grounds and an alternative takeover ' +
  'transaction with a bidder that was on the table is consummated, or a ' +
  'definitive agreement for it is signed and later consummated, within ' +
  'twelve months';

test('item 6: the real Metsera TAIL label no longer ends on a dangling verb', () => {
  const truncated = mod.truncateAtWordBoundary(METSERA_TAIL_TRIGGER_LABEL, 200);
  assert.ok(!/\bis…$/.test(truncated), `must not dangle on "is…", got: ${truncated}`);
  assert.ok(truncated.endsWith('…'), 'still marked as truncated');
  assert.ok(truncated.length < METSERA_TAIL_TRIGGER_LABEL.length, 'actually shortened');
});

test('item 6: prefers a clause boundary (comma) over a bare word boundary when one exists in range', () => {
  const truncated = mod.truncateAtWordBoundary(METSERA_TAIL_TRIGGER_LABEL, 200);
  assert.equal(
    truncated,
    'Deal is terminated on specified grounds and an alternative takeover transaction with a bidder that was on the table is consummated, or a definitive agreement for it is signed and later consummated…',
  );
});

test('item 6: text at-or-under max passes through untouched', () => {
  assert.equal(mod.truncateAtWordBoundary('short clause', 200), 'short clause');
});

test('item 6: never cuts mid-word even with no clause punctuation in range', () => {
  const text = 'Supercalifragilisticexpialidocious '.repeat(10).trim();
  const truncated = mod.truncateAtWordBoundary(text, 50);
  // The cut must land right after a full word — i.e. the character in the
  // ORIGINAL text immediately after the truncated (non-ellipsis) portion is
  // either a space or the end of the string, never mid-word.
  const withoutEllipsis = truncated.slice(0, -1);
  const cutPoint = withoutEllipsis.length;
  assert.ok(
    cutPoint === 0 || text[cutPoint] === ' ' || text[cutPoint] === undefined,
    `cut must land on a word boundary, got: ${JSON.stringify(truncated)}`,
  );
});
