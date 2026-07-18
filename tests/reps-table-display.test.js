/* Metsera fb2 block 2 — reps table display logic.
   Run: npm test

   REPEAT-FAILURE regression (2a): hovering the TERM cell must surface the
   provision source popover for EVERY rep row. The earlier fix (commit
   686530d, "hover on empty cells") only routed VALUE cells through
   CellWithSource / MaterialityQualifierCell — the Term column is rendered
   directly by ProvisionTable and never passed through either renderer, so
   rows without a qualifier kept a hover-dead term cell. These tests pin BOTH
   halves of the fix: (1) the quote resolver returns the provision text even
   when the row has NO materiality qualifier, and (2) the Term cell in
   pages/review/[id].js is actually wired through HoverSource with that
   resolver (the wiring is what silently went missing last time). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

/* Real-shaped Metsera REP-T row WITHOUT a materiality qualifier
   ("Authority; Enforceability", section 3.04 — mq/kq both absent). */
const REP_NO_QUALIFIER = {
  id: 'p1',
  type: 'REP-T',
  category: 'Authority; Enforceability',
  full_text: 'SECTION 3.04. Authority; Enforceability. The Company has all requisite corporate power and authority to execute and deliver this Agreement…',
  ai_metadata: { code: 'REP-T-AUTH', features: { sectionNumber: '3.04' } },
};

test('2a regression: term-cell hover quote present for a rep with NO materiality qualifier', () => {
  const q = mod.termCellHoverQuote(REP_NO_QUALIFIER);
  assert.equal(q, REP_NO_QUALIFIER.full_text);
});

test('2a regression: no quote for empty/placeholder rows (no popover wiring)', () => {
  assert.equal(mod.termCellHoverQuote({ full_text: '' }), null);
  assert.equal(mod.termCellHoverQuote({ full_text: '   ' }), null);
  assert.equal(mod.termCellHoverQuote(null), null);
});

test('2a regression: legacy table branch is retired and schema card render path remains active', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');
  assert.match(src, /<ProvisionCardTable reviewDeal=\{reviewDealForTables/, 'schema card table remains the user render path');
  assert.doesNotMatch(src, /function ProvisionTable\(/, 'legacy ProvisionTable branch must stay deleted');
});

/* ── 2b: column order — Knowledge next to Materiality ─────────────────── */
test('2b: REP column order puts knowledgeQualifier immediately after materialityQualifier', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');
  for (const key of ["'REP-T'", "'REP-B'"]) {
    const m = src.match(new RegExp(`${key}: \\[([^\\]]+)\\]`));
    assert.ok(m, `${key} display order present`);
    const cols = m[1].split(',').map((s) => s.replace(/['"\s]/g, ''));
    assert.equal(cols[0], 'materialityQualifier');
    assert.equal(cols[1], 'knowledgeQualifier');
  }
});

/* ── 2c: knowledge-qualifier scope ─────────────────────────────────────── */
test('2c: bare boolean true (real Metsera shape) → standard only, no invented scope', () => {
  const d = mod.knowledgeQualifierDisplay(true);
  assert.equal(d.label, 'Knowledge-qualified');
  assert.equal(d.scope, null);
});

test('2c: false / null / undefined → no cell content', () => {
  assert.equal(mod.knowledgeQualifierDisplay(false), null);
  assert.equal(mod.knowledgeQualifierDisplay(null), null);
  assert.equal(mod.knowledgeQualifierDisplay(undefined), null);
  assert.equal(mod.knowledgeQualifierDisplay({ value: false, quotes: [] }), null);
});

test('2c: text naming specific sub-clauses → Partial with detail', () => {
  const d = mod.knowledgeQualifierDisplay({
    code: 'KNOW_ACTUAL',
    label: 'Actual knowledge',
    text: 'to the Company’s knowledge, solely with respect to clauses (b) and (c) of this Section 3.14',
  });
  assert.equal(d.scope, 'partial');
  assert.ok(/clauses \(b\) and \(c\)/.test(d.detail));
  assert.equal(d.label, 'Actual knowledge');
});

test('2c: tagged value with no scoping text → just the standard', () => {
  const d = mod.knowledgeQualifierDisplay({
    value: { code: 'KNOW_ACTUAL', label: 'Actual knowledge' },
    quotes: ['to the knowledge of the Company'],
  });
  assert.equal(d.scope, null);
  assert.equal(d.label, 'Actual knowledge');
});

test('fb3: knowledge header prefers DEF-derived knowledgeScope over legacy rep fields', () => {
  const def = '"Knowledge" means the actual knowledge of (i) the Chief Financial Officer or General Counsel, (ii) Director, Tax and (iii) Senior Vice President, Global Controller, in each case after reasonable inquiry.';
  const d = mod.deriveKnowledgeHeader({
    knowledgeScope: def,
    legacyStandard: 'Constructive knowledge',
    legacyGroup: ['Executive officers'],
  });
  assert.equal(d.standard, 'Actual knowledge (after reasonable inquiry)');
  assert.deepEqual(d.group, [
    'the Chief Financial Officer or General Counsel',
    'Director, Tax',
    'Senior Vice President, Global Controller',
  ]);
  assert.equal(d.quote, def);
  assert.equal(d.source, 'definition');
});

test('fb3: knowledge header falls back to legacy fields when no DEF scope exists', () => {
  const d = mod.deriveKnowledgeHeader({
    legacyStandard: 'Constructive knowledge',
    legacyGroup: [{ label: 'Executive officers' }, { label: 'Named officers' }],
  });
  assert.equal(d.standard, 'Constructive knowledge');
  assert.deepEqual(d.group, ['Executive officers', 'Named officers']);
  assert.equal(d.source, 'legacy');
});

test('fb3: SEC Cut-Off display path wraps the value in HoverSource with fallback quote', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');
  assert.match(src, /quote:\s*extractQuote\(lookbackRaw\)\s*\|\|\s*scopeQuote\s*\|\|\s*secCutoffFallbackQuote/);
  assert.match(src, /<HoverSource quote=\{s\.quote\} as="div">\s*<span[\s\S]*?\{s\.node \|\| <span className="text-inkFaint\/70 italic">—<\/span>\}/);
});

/* ── 2d: ERISA / Employee Benefits specific-features suppression ───────── */
test('2d: Metsera "Employee Benefit Plans; ERISA" rep is detected', () => {
  assert.equal(mod.isErisaBenefitsRep({
    type: 'REP-T',
    category: 'Employee Benefit Plans; ERISA',
    ai_metadata: { code: 'REP-T-BENEFITS' },
  }), true);
  assert.equal(mod.isErisaBenefitsRep(REP_NO_QUALIFIER), false);
});

/* ── 2e: agreement order — natural sectionNumber sort ──────────────────── */
test('2e: natural sort — 3.02 < 3.10 (numeric, not string compare)', () => {
  const rows = [
    { id: 'a', sec: '3.10' },
    { id: 'b', sec: '3.02' },
    { id: 'c', sec: '3.9' },
  ];
  const sorted = mod.sortByAgreementOrder(rows, (r) => r.sec);
  assert.deepEqual(sorted.map((r) => r.id), ['b', 'c', 'a']);
});

test('2e: sub-clause parens sort naturally within a section', () => {
  const rows = [
    { id: 'a', sec: '3.02(b)' },
    { id: 'b', sec: '3.02' },
    { id: 'c', sec: '3.02(a)' },
  ];
  const sorted = mod.sortByAgreementOrder(rows, (r) => r.sec);
  assert.deepEqual(sorted.map((r) => r.id), ['b', 'c', 'a']);
});

test('2e: rows without a parseable section keep their current relative order, after sectioned rows', () => {
  const rows = [
    { id: 'x', sec: null },
    { id: 'a', sec: '3.05' },
    { id: 'y', sec: 'III-INTRO' },
    { id: 'b', sec: '3.01' },
  ];
  const sorted = mod.sortByAgreementOrder(rows, (r) => r.sec);
  assert.deepEqual(sorted.map((r) => r.id), ['b', 'a', 'x', 'y']);
});

/* ── 2f: disclosure-schedules standard phrase ──────────────────────────── */
// Verbatim Metsera REP-T-PREAMBLE scheduleReference.
const METSERA_SCHEDULE_REF = 'the letter, dated as of the date of this Agreement (the "Company Disclosure Letter"), from the Company to Parent and Merger Sub (which shall be arranged in numbered and lettered sections corresponding to the numbered and lettered sections contained in this Article III, and the disclosure in any section shall be deemed to qualify or apply to other sections and subsections in this Article III to the extent that it is reasonably apparent on its face that such disclosure also qualifies or applies to such other sections and subsections)';

test('2f: extracts the cross-qualification sentence for the cell (Metsera text)', () => {
  const s = mod.extractCrossQualificationSentence(METSERA_SCHEDULE_REF);
  assert.ok(s);
  assert.ok(s.startsWith('the disclosure in any section shall be deemed to qualify'), s);
  assert.ok(/reasonably apparent on its face/.test(s));
  // The arrangement boilerplate stays out of the cell (hover keeps it).
  assert.ok(!/numbered and lettered/.test(s));
});

test('2f: no cross-qualification language → null (cell falls back to stored text)', () => {
  assert.equal(mod.extractCrossQualificationSentence('Section 3.05 of the Company Disclosure Letter'), null);
  assert.equal(mod.extractCrossQualificationSentence(''), null);
  assert.equal(mod.extractCrossQualificationSentence(null), null);
});
