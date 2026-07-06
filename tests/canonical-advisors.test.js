/* Tests for lib/canonical-advisors.js — read-time canonicalization of
   law-firm and lawyer names extracted from notices provisions.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalFirm,
  cleanFirm,
  canonicalLawyer,
  canonicalLawyerKey,
  dedupeLawyers,
  dedupeFirms,
  getDisplayAdvisors,
} = require('../lib/canonical-advisors');

// ── Firm canonicalization ───────────────────────────────────────────────────

test('Paul Weiss variants all map to one canonical short name', () => {
  const variants = [
    'Paul, Weiss, Rifkind, Wharton & Garrison LLP',
    'Paul, Weiss, Rifkind, Wharton & Garrison',
    'Paul Weiss Rifkind Wharton & Garrison LLP',
    'Paul, Weiss LLP',
    'Paul Weiss',
    'PAUL, WEISS, RIFKIND, WHARTON & GARRISON LLP',
  ];
  for (const v of variants) {
    const { canonical, matched } = canonicalFirm(v);
    assert.equal(canonical, 'Paul, Weiss', `variant: ${v}`);
    assert.equal(matched, true, `variant: ${v}`);
  }
});

test('major-firm variants map to market colloquial names', () => {
  const cases = [
    ['Wachtell, Lipton, Rosen & Katz', 'Wachtell'],
    ['Skadden, Arps, Slate, Meagher & Flom LLP', 'Skadden'],
    ['Sullivan & Cromwell LLP', 'Sullivan & Cromwell'],
    ['Cravath, Swaine & Moore LLP', 'Cravath'],
    ['Davis Polk & Wardwell LLP', 'Davis Polk'],
    ['Simpson Thacher & Bartlett LLP', 'Simpson Thacher'],
    ['Latham & Watkins LLP', 'Latham & Watkins'],
    ['Kirkland & Ellis LLP', 'Kirkland & Ellis'],
    ['Cleary Gottlieb Steen & Hamilton LLP', 'Cleary Gottlieb'],
    ['Weil, Gotshal & Manges LLP', 'Weil'],
    ['Gibson, Dunn & Crutcher LLP', 'Gibson Dunn'],
    ['Hogan Lovells US LLP', 'Hogan Lovells'],
    ['Fried, Frank, Harris, Shriver & Jacobson LLP', 'Fried Frank'],
    ['Shearman & Sterling LLP', 'A&O Shearman'],
    ['Allen & Overy LLP', 'A&O Shearman'],
    ['Wilson Sonsini Goodrich & Rosati', 'Wilson Sonsini'],
    ['Jones Day', 'Jones Day'],
  ];
  for (const [raw, expected] of cases) {
    const { canonical, matched } = canonicalFirm(raw);
    assert.equal(canonical, expected, `raw: ${raw}`);
    assert.equal(matched, true, `raw: ${raw}`);
  }
});

test('unknown firm passes through cleaned (LLP stripped, whitespace collapsed)', () => {
  const { canonical, matched } = canonicalFirm('Smith &   Wesson   Legal Advisors, LLP');
  assert.equal(matched, false);
  assert.equal(canonical, 'Smith & Wesson Legal Advisors');
});

test('cleanFirm strips stacked suffixes and trailing punctuation', () => {
  assert.equal(cleanFirm('Acme Law Group LLC, LLP.'), 'Acme Law Group');
  assert.equal(cleanFirm('Richards, Layton & Finger, P.A.'), 'Richards, Layton & Finger');
});

test('canonicalFirm handles empty input', () => {
  assert.deepEqual(canonicalFirm(''), { canonical: null, matched: false });
  assert.deepEqual(canonicalFirm(null), { canonical: null, matched: false });
});

// ── Lawyer normalization ────────────────────────────────────────────────────

test('canonicalLawyer normalizes case, whitespace, credentials', () => {
  assert.equal(canonicalLawyer('BENJAMIN GOODCHILD'), 'Benjamin Goodchild');
  assert.equal(canonicalLawyer('benjamin   goodchild'), 'Benjamin Goodchild');
  assert.equal(canonicalLawyer('Krishna Veeraraghavan, Esq.'), 'Krishna Veeraraghavan');
  assert.equal(canonicalLawyer('Sarkis Jebejian, P.C.'), 'Sarkis Jebejian');
  assert.equal(canonicalLawyer('Scott A Barshay'), 'Scott A. Barshay');
  assert.equal(canonicalLawyer('Jane Doe,'), 'Jane Doe');
});

test('canonicalLawyer preserves internal capitalization and suffixes', () => {
  assert.equal(canonicalLawyer('Brandon Van Dyke'), 'Brandon Van Dyke');
  assert.equal(canonicalLawyer('Amanda McMillian'), 'Amanda McMillian');
  assert.equal(canonicalLawyer('O. Keith Hallam, III'), 'O. Keith Hallam III');
});

test('canonicalLawyerKey ignores middle initials and case', () => {
  const key = canonicalLawyerKey('Benjamin M. Goodchild');
  assert.equal(key, 'benjamin|goodchild');
  assert.equal(canonicalLawyerKey('Benjamin Goodchild'), key);
  assert.equal(canonicalLawyerKey('BENJAMIN GOODCHILD'), key);
  assert.equal(canonicalLawyerKey('benjamin  goodchild, Esq.'), key);
});

test('dedupeLawyers collapses variants, keeping the LONGEST form', () => {
  const out = dedupeLawyers([
    'Benjamin Goodchild',
    'Benjamin M. Goodchild',
    'BENJAMIN GOODCHILD',
    'Scott A. Barshay',
  ]);
  assert.deepEqual(out, ['Benjamin M. Goodchild', 'Scott A. Barshay']);
});

test('dedupeFirms collapses raw variants of the same firm', () => {
  const out = dedupeFirms([
    'Paul, Weiss, Rifkind, Wharton & Garrison LLP',
    'Paul Weiss LLP',
    'Wachtell, Lipton, Rosen & Katz',
  ]);
  assert.deepEqual(out, ['Paul, Weiss', 'Wachtell']);
});

// ── Read-time display helper ────────────────────────────────────────────────

test('getDisplayAdvisors canonicalizes an advisors_v2 blob', () => {
  const metadata = {
    advisors_v2: {
      buyer_firm: 'Paul, Weiss, Rifkind, Wharton & Garrison LLP',
      buyer_firms: ['Paul, Weiss, Rifkind, Wharton & Garrison LLP'],
      buyer_lawyers: ['Krishna Veeraraghavan', 'BENJAMIN GOODCHILD', 'Benjamin M. Goodchild'],
      seller_firm: 'Cooley LLP',
      seller_firms: ['Cooley LLP'],
      seller_lawyers: ['Kevin Cooper'],
    },
  };
  const d = getDisplayAdvisors(metadata);
  assert.equal(d.buyerFirm, 'Paul, Weiss');
  assert.deepEqual(d.buyerFirms, ['Paul, Weiss']);
  assert.deepEqual(d.buyerLawyers, ['Krishna Veeraraghavan', 'Benjamin M. Goodchild']);
  assert.equal(d.sellerFirm, 'Cooley');
  assert.deepEqual(d.sellerLawyers, ['Kevin Cooper']);
});

test('getDisplayAdvisors tolerates missing/partial metadata', () => {
  assert.deepEqual(getDisplayAdvisors(null).buyerFirms, []);
  assert.equal(getDisplayAdvisors({}).sellerFirm, null);
  // Legacy single-string firm without the _firms array still canonicalizes.
  const d = getDisplayAdvisors({ advisors_v2: { buyer_firm: 'Wachtell, Lipton, Rosen & Katz' } });
  assert.equal(d.buyerFirm, 'Wachtell');
});

test('getDisplayAdvisors falls back to deal facts and legacy edited advisors', () => {
  const facts = getDisplayAdvisors({
    deal_facts: {
      advisors: {
        buyer_firms: ['Paul, Weiss, Rifkind, Wharton & Garrison LLP'],
        seller_firms: ['Cooley LLP'],
      },
    },
  });
  assert.deepEqual(facts.buyerFirms, ['Paul, Weiss']);
  assert.deepEqual(facts.sellerFirms, ['Cooley']);

  const legacy = getDisplayAdvisors({
    advisors: [
      { firm: 'Wachtell, Lipton, Rosen & Katz', party: 'parent' },
      { firm: 'Wilson Sonsini Goodrich & Rosati', party: 'company' },
    ],
  });
  assert.deepEqual(legacy.buyerFirms, ['Wachtell']);
  assert.deepEqual(legacy.sellerFirms, ['Wilson Sonsini']);
});
