/* Metsera fb2 block 3 — conditions + termination display logic.
   Run: npm test

   REPEAT-FAILURE regression (3e): the reps bring-down must render ONE LINE
   PER TIER faithfully. The earlier per-group renderer (commit 4358e43)
   relabelled the catch-all tier "All other reps" (dropping the "other
   than …" exclusions), truncated resolved names (dropping "(first sentence
   only)"), de-duplicated, and re-sorted. Owner: "things can be in MAE
   standard and also in all material respects" — a rep appearing under two
   tiers must show under both. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

/* ── 3e: bring-down tiers — EXACT live Metsera COND-B-REP shape ─────────── */
const METSERA_TIERS = [
  {
    standard: 'MAT_MAE_QUALIFIED',
    reps_covered: 'All Company representations and warranties other than Section 3.01 (first sentence only), Section 3.02, Section 3.04, Section 3.05(a)(i)(x) and Section 3.22',
    standard_label: 'True except where failure would not have an MAE',
  },
  {
    standard: 'MAT_ALL_MATERIAL',
    reps_covered: 'Section 3.01 (first sentence only), Section 3.02(b) through Section 3.02(e), Section 3.04, Section 3.05(a)(i)(x), and Section 3.22',
    standard_label: 'In all material respects',
  },
  {
    standard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    exceptions: 'subject only to de minimis inaccuracies',
    reps_covered: 'Section 3.02(a)',
    standard_label: 'True except for de minimis inaccuracies',
  },
];

// Section → rep-name map, from the live Metsera REP-T rows.
const NAME_BY_SEC = {
  '3.01': 'Organization; Qualification; Standing',
  '3.02': 'Capitalization; Subsidiaries — Capital Structure',
  '3.04': 'Authority; Enforceability',
  '3.05': 'No Conflict; Required Filings and Consents',
  '3.22': 'Brokers; Finders',
};

test('3e: one line per tier, extracted order, no dedupe (Metsera shape)', () => {
  const lines = mod.buildBringdownTierLines(METSERA_TIERS, NAME_BY_SEC);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((l) => l.std), [
    'MAE standard',
    'In all material respects',
    'De minimis',
  ]);
});

test('3e: catch-all tier keeps its "other than …" exclusions (not relabelled "All other reps")', () => {
  const [mae] = mod.buildBringdownTierLines(METSERA_TIERS, NAME_BY_SEC);
  assert.ok(mae.group.startsWith('All Company representations and warranties other than'), mae.group);
  assert.ok(/\(first sentence only\)/.test(mae.group), 'first-sentence qualifier preserved');
  assert.ok(mae.group.includes('Organization; Qualification; Standing'), 'cites resolve to rep names');
  assert.equal(mae.general, true);
});

test('3e: a rep under TWO tiers appears under both (3.01 excluded from MAE tier AND listed in material-respects tier)', () => {
  const lines = mod.buildBringdownTierLines(METSERA_TIERS, NAME_BY_SEC);
  const inMae = lines[0].group.includes('Organization; Qualification; Standing (first sentence only)');
  const inMaterial = lines[1].group.includes('Organization; Qualification; Standing (first sentence only)');
  assert.ok(inMae && inMaterial, `3.01 must show under both tiers:\n${lines[0].group}\n${lines[1].group}`);
});

test('3e: parenthetical qualifiers on resolved cites are preserved, ranges compact', () => {
  const lines = mod.buildBringdownTierLines(METSERA_TIERS, NAME_BY_SEC);
  // "Section 3.02(b) through Section 3.02(e)" → resolved name once, range kept.
  assert.ok(/Capitalization; Subsidiaries — Capital Structure \(b\) through \(e\)/.test(lines[1].group), lines[1].group);
  // De-minimis tier resolves 3.02(a) with the sub-clause kept.
  assert.ok(/Capitalization; Subsidiaries — Capital Structure \(a\)/.test(lines[2].group), lines[2].group);
  assert.equal(lines[2].general, false);
});

test('3e: unresolvable cites stay verbatim (never dropped)', () => {
  const lines = mod.buildBringdownTierLines(
    [{ standard_label: 'In all material respects', reps_covered: 'Section 9.99 and Section 3.04' }],
    NAME_BY_SEC,
  );
  assert.ok(lines[0].group.includes('Section 9.99'));
  assert.ok(lines[0].group.includes('Authority; Enforceability'));
});

/* ── 3f: officer's certificate — real Metsera quote ────────────────────── */
const METSERA_CERT_QUOTE = 'The Company will have furnished Parent with a certificate dated as of the Closing Date signed on its behalf by its Chief Executive Officer or Chief Financial Officer to the effect that the conditions set forth in Section 7.02(a), Section 7.02(b) and Section 7.02(c) have been satisfied.';

// Sibling rows shaped like CondSingleTable's famRowsInfo, using the live
// Metsera COND-B provisions (no stamped sectionNumber; leading clause letter
// in the verbatim text — the common shape today).
const METSERA_COND_B_ROWS = [
  { label: 'Reps Bring-Down', matches: [{ sectionNumber: undefined, fullText: '(a)\nRepresentations and Warranties. Each of (i) the representations and warranti…' }] },
  { label: 'Covenant Performance', matches: [{ sectionNumber: undefined, fullText: '(b) Performance of Obligations of the Company. The Company will have performed a…' }] },
  { label: 'No Material Adverse Effect', matches: [{ sectionNumber: undefined, fullText: '(c) No Company Material Adverse Effect. Since the date of this Agreement, there …' }] },
  { label: "Officer's Certificate", matches: [{ sectionNumber: undefined, fullText: '(d) Closing Certificate. The Company will have furnished Parent with a certifica…' }] },
  { label: 'Dissenting Shares Threshold', matches: [] },
];

test('3f: certified sections parse from the real quote', () => {
  const cites = mod.parseCertifiedSectionCites(METSERA_CERT_QUOTE);
  assert.deepEqual(cites.map((c) => c.cite), ['7.02(a)', '7.02(b)', '7.02(c)']);
});

test('3f: cites resolve to condition NAMES, not cites (Metsera rows)', () => {
  const names = mod.resolveCertifiedConditions(METSERA_CERT_QUOTE, METSERA_COND_B_ROWS);
  assert.deepEqual(names, ['reps bring-down', 'covenant performance', 'no MAE']);
});

test('3f: stamped features.sectionNumber wins when present', () => {
  const rows = [
    { label: 'Reps Bring-Down', matches: [{ sectionNumber: '7.02(a)', fullText: '' }] },
    { label: 'Covenant Performance', matches: [{ sectionNumber: '7.02(b)', fullText: '' }] },
  ];
  const names = mod.resolveCertifiedConditions('conditions set forth in Section 7.02(a) and Section 7.02(b)', rows);
  assert.deepEqual(names, ['reps bring-down', 'covenant performance']);
});

test('3f: quote without cites resolves nothing (caller falls back to boolean convention)', () => {
  assert.deepEqual(mod.resolveCertifiedConditions('a certificate to that effect', METSERA_COND_B_ROWS), []);
});

/* ── 3g: outside-date extension detail — real Metsera TERMR-OUTSIDE ────── */
const METSERA_OUTSIDE_FEATURES = {
  mainConcept: 'Either Parent or the Company may terminate if the Effective Time has not occurred by the Initial Outside Date of March 21, 2026, which automatically extends to June 21, 2026 if only antitrust/HSR-related closing conditions remain unsatisfied.',
  outsideDate: { value: 'March 21, 2026', quotes: ['if the Effective Time has not occurred on or before March 21, 2026 (the "Initial Outside Date", and as may be extended pursuant to this Section 8.01(b)(i), the "Outside Date")'] },
  extensionConditions: {
    value: 'Automatic extension triggers if, three business days before the Initial Outside Date, the antitrust/HSR closing condition remains unsatisfied but all other closing conditions are satisfied or capable of being satisfied.',
    quotes: ['if, on the date is the third (3rd) business day prior to the Initial Outside Date, one or both of the conditions set forth in Section 7.01(a) and Section 7.01(b) (if the Judgment that has caused such condition to not be satisfied relates to the HSR Act and any Foreign Merger Control Law) shall not have been satisfied or waived on or prior to such date, but all other conditions set forth in Article VII shall have been satisfied or waived (except for those conditions that by their nature are to be satisfied at the Closing, provided that such conditions shall be capable of being satisfied on such date)'],
  },
  outsideDateExtension: { value: true, quotes: ['then the Initial Outside Date shall automatically be extended to June 21, 2026'] },
};

test('3g: Metsera automatic extension reads faithfully with the capable-of-satisfaction rider', () => {
  const detail = mod.buildOutsideDateExtensionDetail(METSERA_OUTSIDE_FEATURES);
  assert.ok(detail.startsWith('Automatic extension to June 21, 2026'), detail);
  assert.ok(/available only if all other conditions remain capable of satisfaction/.test(detail), detail);
  // "Either party may elect" must NOT be invented for an automatic extension.
  assert.ok(!/elect/i.test(detail), detail);
});

test('3g: "either party may elect" phrasing only when the source supports it', () => {
  const detail = mod.buildOutsideDateExtensionDetail({
    outsideDateExtension: { value: true, quotes: ['either party may elect to extend the Outside Date to September 1, 2026'] },
  });
  assert.ok(detail.startsWith('Either party may elect to extend'), detail);
  assert.ok(/September 1, 2026/.test(detail), detail);
  assert.ok(!/capable of satisfaction/.test(detail), 'rider only when the source says so');
});

test('3g: no extension signal → null (never invents)', () => {
  assert.equal(mod.buildOutsideDateExtensionDetail({}), null);
  assert.equal(mod.buildOutsideDateExtensionDetail({ outsideDate: { value: 'March 21, 2026' } }), null);
});
