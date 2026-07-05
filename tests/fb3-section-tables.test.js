/* FB3 — section-table restructure batch. Pure-logic unit tests for the new
   table-logic.js helpers backing pages/review/[id].js's MAE / AoC-rep /
   qualifier-pill / COV / MISC rebuilds. Fixtures are real-shaped: field
   values below are taken directly from the Metsera deal
   (885edae5-49e8-464a-9f33-edd229119d7c) as stored in ai_metadata.features,
   not invented shapes.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 2 — buildAocTermPills
 * ───────────────────────────────────────────────────────────────────────── */

// Real Metsera REP-T "Absence of Certain Changes or Events" features
// (ed2fca16-d20a-4c7a-867e-ea24f8375a63) — has BOTH the no-MAE limb and
// cited-covenant "specific IOC" cross-references.
const METSERA_AOC_FEATURES = {
  maeLimbs: 'TWO_LIMB',
  mainConcept: 'Representation that since January 1, 2025 there has not been a Company Material Adverse Effect...',
  sectionNumber: '3.08',
  aocNoMaePresent: true,
  aocNoMaeSinceDate: 'January 1, 2025',
  absenceOfChangesType: {
    value: { code: 'GENERAL_ORDINARY_COURSE', text: 'the Company and each Company Subsidiary has conducted its business in the ordinary course...', label: 'General operating covenant' },
    quotes: [],
  },
  aocCitedCovenantNames: [
    { name: 'Dividends and Distributions', section: '5.01(a)' },
    { name: 'Mergers, Acquisitions, Dispositions', section: '5.01(d)' },
  ],
  aocOrdinaryCourseLimb: 'From January 1, 2025 to the date of this Agreement, the Company and each Company Subsidiary has conducted its business in the ordinary course...',
  aocCitedCovenantSections: ['5.01(a)', '5.01(d)'],
  absenceOfChangesStartDate: 'January 1, 2025',
  absenceOfChangesExceptions: [],
};

test('buildAocTermPills: both limbs present renders [No MAE since <date>] + [Specific IOC carve-outs], never "General operating covenant"', () => {
  const pills = mod.buildAocTermPills(METSERA_AOC_FEATURES);
  assert.equal(pills.length, 2);
  assert.equal(pills[0].key, 'noMae');
  assert.equal(pills[0].label, 'No MAE since January 1, 2025');
  assert.equal(pills[1].key, 'iocs');
  assert.equal(pills[1].label, 'Specific IOC carve-outs');
  for (const p of pills) {
    assert.doesNotMatch(p.label, /General operating covenant/);
  }
});

test('buildAocTermPills: cited-covenant pill hovers to the ordinary-course limb text when the array itself carries no quote', () => {
  const pills = mod.buildAocTermPills(METSERA_AOC_FEATURES);
  const iocPill = pills.find((p) => p.key === 'iocs');
  assert.equal(iocPill.quote, METSERA_AOC_FEATURES.aocOrdinaryCourseLimb);
});

test('buildAocTermPills: ordinary-course limb only (no cited covenants) renders a plain "Ordinary course" pill', () => {
  const features = {
    aocNoMaePresent: false,
    aocOrdinaryCourseLimb: 'The Company has conducted its business in the ordinary course consistent with past practice.',
    aocCitedCovenantNames: [],
  };
  const pills = mod.buildAocTermPills(features);
  assert.deepEqual(pills.map((p) => p.key), ['oc']);
  assert.equal(pills[0].label, 'Ordinary course');
});

test('buildAocTermPills: no limbs extracted returns an empty array (never invents a pill)', () => {
  assert.deepEqual(mod.buildAocTermPills({}), []);
  assert.deepEqual(mod.buildAocTermPills({ aocNoMaePresent: false }), []);
});

test('buildAocTermPills: aocNoMaePresent without a since-date still renders a "No MAE" pill', () => {
  const pills = mod.buildAocTermPills({ aocNoMaePresent: true });
  assert.equal(pills.length, 1);
  assert.equal(pills[0].label, 'No MAE since [date not specified]');
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 3 — withScopeParens / normalizeQualifierScope
 * ───────────────────────────────────────────────────────────────────────── */

test('withScopeParens: "partial" scope appends "(partial)" INSIDE the label, not as separate text', () => {
  assert.equal(mod.withScopeParens('Knowledge-qualified', 'partial'), 'Knowledge-qualified (partial)');
});

test('withScopeParens: "entire" or absent scope renders the label unchanged (no "(entire)" clutter)', () => {
  assert.equal(mod.withScopeParens('Knowledge-qualified', 'entire'), 'Knowledge-qualified');
  assert.equal(mod.withScopeParens('Knowledge-qualified', null), 'Knowledge-qualified');
  assert.equal(mod.withScopeParens('Knowledge-qualified', undefined), 'Knowledge-qualified');
});

test('normalizeQualifierScope: materialityQualifier.scope (ENTIRE_REP / PARTIAL) normalizes to the same vocabulary as knowledgeQualifierDisplay', () => {
  assert.equal(mod.normalizeQualifierScope('PARTIAL'), 'partial');
  assert.equal(mod.normalizeQualifierScope('ENTIRE_REP'), 'entire');
  assert.equal(mod.normalizeQualifierScope('WHOLE_REP'), 'entire');
  assert.equal(mod.normalizeQualifierScope(undefined), null);
  assert.equal(mod.normalizeQualifierScope('something-else'), null);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 4(a) — D&O Insurance Cap concise form
 * ───────────────────────────────────────────────────────────────────────── */

// Real Metsera D&O clause (7ddf43ca-a1a1-40e3-8252-f89095dd0725), abridged.
const METSERA_INSURANCE_CAP_TEXT =
  'the maximum aggregate annual premium for such "tail" insurance policies for any such year shall not exceed the maximum aggregate annual premium contemplated by the second succeeding sentence... neither Parent nor the Surviving Corporation shall be required to pay an aggregate annual premium for such insurance policies in excess of three hundred percent (300%) of the annual premium payable by the Company for coverage for its current fiscal year under the Existing D&O Policies; provided, further, that if the aggregate annual premium of such insurance coverage exceeds such amount, the Surviving Corporation shall be obligated to obtain the most advantageous policy...';

test('deriveInsuranceCapConcise: real Metsera D&O clause derives "300% of annual premium"', () => {
  assert.equal(mod.deriveInsuranceCapConcise(METSERA_INSURANCE_CAP_TEXT), '300% of annual premium');
});

test('deriveInsuranceCapConcise: a dollar-cap clause derives the dollar figure', () => {
  const text = 'the aggregate annual premium for such tail policies shall not exceed $2,500,000 in premium for any policy year.';
  assert.equal(mod.deriveInsuranceCapConcise(text), '$2,500,000');
});

test('deriveInsuranceCapConcise: no percentage/dollar figure near "premium" returns null — never invents a number', () => {
  assert.equal(mod.deriveInsuranceCapConcise('the Company shall maintain customary tail insurance for six years.'), null);
  assert.equal(mod.deriveInsuranceCapConcise(''), null);
  assert.equal(mod.deriveInsuranceCapConcise(null), null);
});

// Audit-2 item 5 — real Cooper Tire (Goodyear) clause: the qualifier is
// "the LAST annual premium", which the old (then-current|current)-only
// alternation missed, so the cell rendered the raw proviso.
const COOPER_INSURANCE_CAP_TEXT =
  'Parent will not be required to pay annual premiums in excess of 300% of the last annual premium paid by the Company prior to the date hereof in respect of the coverage required to be obtained pursuant hereto, but in such case will purchase as much coverage as reasonably practicable for such amount; and provided further, that if the Surviving Corporation purchases a "tail policy" and the same coverage costs on an annual basis more than 300% of such last annual premium, the Surviving Corporation will purchase the maximum amount of coverage that can be obtained for 300% of such last annual premium.';

test('deriveInsuranceCapConcise: Cooper Tire "300% of the last annual premium" derives the concise form', () => {
  assert.equal(mod.deriveInsuranceCapConcise(COOPER_INSURANCE_CAP_TEXT), '300% of annual premium');
});

test('deriveInsuranceCapConcise: "450% of the current aggregate annual premium" (Cooper company tail) derives too', () => {
  const text = 'the Company shall not pay an aggregate amount for such policy in excess of 450% of the current aggregate annual premium paid by the Company for the existing policy.';
  assert.equal(mod.deriveInsuranceCapConcise(text), '450% of annual premium');
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 4(d) — Access scope humanization + purpose-pill detection
 * ───────────────────────────────────────────────────────────────────────── */

test('humanizeAccessScopeToken: hyphenated enum token humanizes to sentence case', () => {
  assert.equal(mod.humanizeAccessScopeToken('reasonable-access'), 'Reasonable access');
  assert.equal(mod.humanizeAccessScopeToken('broad-access'), 'Broad access');
  assert.equal(mod.humanizeAccessScopeToken('limited-access'), 'Limited access');
  assert.equal(mod.humanizeAccessScopeToken(''), null);
  assert.equal(mod.humanizeAccessScopeToken(null), null);
});

// Real Metsera accessPurposeLimitation text (c7c76307-9ddb-4c94-8505-74b28ee28591).
const METSERA_ACCESS_PURPOSE_TEXT = 'solely for the purpose of consummating the Transactions or integration planning purposes';

test('detectAccessPurposes: real Metsera text names BOTH consummation and integration — two purposes', () => {
  assert.deepEqual(mod.detectAccessPurposes(METSERA_ACCESS_PURPOSE_TEXT), ['consummation', 'integration']);
});

test('detectAccessPurposes: single-purpose text returns one purpose', () => {
  assert.deepEqual(mod.detectAccessPurposes('solely for integration planning purposes'), ['integration']);
  assert.deepEqual(mod.detectAccessPurposes('solely for purposes of consummating the transactions'), ['consummation']);
});

test('detectAccessPurposes: text naming neither purpose falls back to ["other"]; empty text returns []', () => {
  assert.deepEqual(mod.detectAccessPurposes('for due diligence purposes'), ['other']);
  assert.deepEqual(mod.detectAccessPurposes(''), []);
  assert.deepEqual(mod.detectAccessPurposes(null), []);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 5(d) — Jurisdiction: name the courts + fallback, never bare "Yes"
 * ───────────────────────────────────────────────────────────────────────── */

// Real Metsera jurisdiction text (4ea1366c-1f97-43ed-974c-42aafd02da3a) — the
// fallback court is embedded in the SAME verbatim string.
const METSERA_JURISDICTION_TEXT = 'Court of Chancery of the State of Delaware (or, if such court shall be unavailable, any state or federal court sitting in the State of Delaware)';

test('buildJurisdictionDisplay: real Metsera text names both the primary court and its fallback', () => {
  const display = mod.buildJurisdictionDisplay({
    jurisdictionText: METSERA_JURISDICTION_TEXT,
    jurisdictionExclusive: true,
    jurisdictionExclusiveText: 'each of the parties hereby irrevocably agrees that all claims...may be heard and determined exclusively in such court.',
  });
  assert.ok(display);
  assert.match(display.text, /Court of Chancery/);
  assert.match(display.text, /unavailable/);
  assert.equal(display.exclusive, true);
});

test('buildJurisdictionDisplay: only the boolean exclusivity flag (no court-name text) never renders bare "Yes" — falls back to the exclusivity clause\'s own text', () => {
  const display = mod.buildJurisdictionDisplay({
    jurisdictionText: null,
    jurisdictionExclusive: true,
    jurisdictionExclusiveText: 'each of the parties hereby irrevocably agrees that all claims...may be heard and determined exclusively in such court.',
  });
  assert.ok(display);
  assert.doesNotMatch(display.text, /^Yes$/);
});

test('buildJurisdictionDisplay: nothing extracted at all returns null (never invents a court)', () => {
  assert.equal(mod.buildJurisdictionDisplay({ jurisdictionText: null, jurisdictionExclusive: false, jurisdictionExclusiveText: null }), null);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 5(e) — Fees & Expenses: resolve §-refs against the deal's own sections
 * ───────────────────────────────────────────────────────────────────────── */

// Real Metsera Expenses clause (1ab40014-3d6c-479b-a9e5-14a4e199ef97).
const METSERA_FEE_EXPENSE_TEXT = 'Except as set forth in Section 6.02, Section 6.03(b), Section 6.05 and Section 8.02, all fees and expenses incurred in connection with this Agreement, the Merger and the other Transactions shall be paid by the party incurring such fees or expenses, whether or not the Merger is consummated.';

test('extractSectionRefs: pulls every distinct Section cite, including sub-clause letters', () => {
  const refs = mod.extractSectionRefs(METSERA_FEE_EXPENSE_TEXT);
  assert.deepEqual(refs, ['Section 6.02', 'Section 6.03(b)', 'Section 6.05', 'Section 8.02']);
});

test('resolveSectionRef: a ref whose base section number matches a deal provision resolves to "<cite> (<category>)"', () => {
  const sectionIndex = [{ sectionNumber: '6.02', category: 'Access to Information; Confidentiality' }];
  assert.equal(mod.resolveSectionRef('Section 6.02', sectionIndex), 'Section 6.02 (Access to Information; Confidentiality)');
});

test('resolveSectionRef: a sub-clause cite ("6.03(b)") resolves against a provision classified at the base section ("6.03")', () => {
  const sectionIndex = [{ sectionNumber: '6.03', category: 'No-Solicitation' }];
  assert.equal(mod.resolveSectionRef('Section 6.03(b)', sectionIndex), 'Section 6.03(b) (No-Solicitation)');
});

test('resolveSectionRef: unresolvable cite keeps the bare citation — never invents a name', () => {
  assert.equal(mod.resolveSectionRef('Section 8.02', []), 'Section 8.02');
  assert.equal(mod.resolveSectionRef('Section 8.02', [{ sectionNumber: '6.05', category: 'D&O Indemnification and Insurance' }]), 'Section 8.02');
});

test('buildFeeExpenseSentence: real Metsera clause resolves known sections and keeps unresolvable cites bare', () => {
  const sectionIndex = [
    { sectionNumber: '6.02', category: 'Access to Information; Confidentiality' },
    { sectionNumber: '6.05', category: 'D&O Indemnification and Insurance' },
    // 6.03 and 8.02 deliberately absent from the index (unresolvable).
  ];
  const sentence = mod.buildFeeExpenseSentence(METSERA_FEE_EXPENSE_TEXT, sectionIndex);
  assert.match(sentence, /^Parties pay their own fees and expenses, except for /);
  assert.match(sentence, /Section 6\.02 \(Access to Information; Confidentiality\)/);
  assert.match(sentence, /Section 6\.05 \(D&O Indemnification and Insurance\)/);
  assert.match(sentence, /Section 6\.03\(b\)(?!\s*\()/); // bare cite, no invented name
  assert.match(sentence, /Section 8\.02(?!\s*\()/);
});

test('buildFeeExpenseSentence: no section refs at all still resolves to the plain phrasing', () => {
  assert.equal(
    mod.buildFeeExpenseSentence('Each party shall bear its own costs and expenses.', []),
    'Parties pay their own fees and expenses.',
  );
});

test('buildFeeExpenseSentence: empty/missing text returns null (row falls back to "Not present")', () => {
  assert.equal(mod.buildFeeExpenseSentence('', []), null);
  assert.equal(mod.buildFeeExpenseSentence(null, []), null);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Item 4(e) — Public Statements exceptions dedupe
 * ───────────────────────────────────────────────────────────────────────── */

// Real Metsera Public Announcements clause (fa5dbfd4-563b-4aae-898f-d9a8c11634ee)
// — Parent and Company carveout text is IDENTICAL on this deal.
const METSERA_PUBLIC_STATEMENTS_CARVEOUT =
  "Notwithstanding the foregoing, without prior consent of the other parties hereto, each party hereto may (a) disseminate information substantially similar to information included in a press release or other document previously approved for public distribution by the other parties hereto; and (b) communicate information that is not confidential information of any other party with financial analysts, investors and media representatives in a manner consistent with its past practice and in compliance with applicable Law.";

test('dedupeTexts: identical Parent/Company carveout text collapses to ONE entry, not two', () => {
  const texts = mod.dedupeTexts([METSERA_PUBLIC_STATEMENTS_CARVEOUT, METSERA_PUBLIC_STATEMENTS_CARVEOUT]);
  assert.equal(texts.length, 1);
  assert.equal(texts[0], METSERA_PUBLIC_STATEMENTS_CARVEOUT);
});

test('dedupeTexts: distinct texts are both kept, in order; blanks/nulls are dropped', () => {
  const texts = mod.dedupeTexts(['A carveout.', null, 'A different carveout.', '', 'A carveout.']);
  assert.deepEqual(texts, ['A carveout.', 'A different carveout.']);
});
