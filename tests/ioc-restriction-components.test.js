// FB3 missed item 2 — IOC restriction components: deterministic post-pass
// stamping `restrictionComponents` (IOC_CATEGORY_CODES-style tags) on each
// IOC-T/IOC-B sub-clause by keyword-matching its OWN text. Cross-deal
// comparability hook; no LLM involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  classifyIocRestrictionComponents,
  stampIocRestrictionComponents,
} = require('../lib/parser-v2/extract.js');
const { FEATURES, getFeaturesForType } = require('../lib/rubric');

test('restrictionComponents is registered on the shared IOC schema (IOC-T/IOC-B resolve to it), sourced as a post-pass (not requested of the LLM)', () => {
  const field = FEATURES.IOC.find((f) => f.key === 'restrictionComponents');
  assert.ok(field, 'IOC schema declares restrictionComponents');
  assert.equal(field.source, 'post-pass');
  assert.equal(field.type, 'list');
  assert.equal(field.scope, 'clause');
  // IOC-T / IOC-B aren't distinct rubric schema keys — they resolve to the
  // shared 'IOC' schema (lib/parser-v2/extract.js lookupType normalization).
  const resolved = getFeaturesForType('IOC');
  assert.ok(resolved.some((f) => f.key === 'restrictionComponents'));
});

test('classifyIocRestrictionComponents: a plain indebtedness clause tags INDEBTEDNESS only', () => {
  const text = 'incur, create, assume or otherwise become liable or responsible for any indebtedness for borrowed money';
  assert.deepEqual(classifyIocRestrictionComponents(text), ['INDEBTEDNESS']);
});

test('classifyIocRestrictionComponents: a bundled clause (indebtedness AND guaranteeing a third party\'s indebtedness) gets BOTH tags — real Metsera sub-clause (i)(i)', () => {
  const text = 'incur, create, assume or otherwise become liable or responsible for, or amend or modify the terms of, any indebtedness for borrowed money, or guarantee any indebtedness of another Person (except for short-term borrowings incurred in the ordinary course)';
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(codes.includes('INDEBTEDNESS'), 'indebtedness tag present');
  assert.ok(codes.includes('THIRD_PARTY_OBLIGATIONS'), 'guarantee-of-third-party-obligation tag present');
});

test('classifyIocRestrictionComponents: acquisitions vs dispositions vs mergers stay distinct', () => {
  assert.deepEqual(classifyIocRestrictionComponents('acquire or agree to acquire any business or any corporation'), ['ACQUISITIONS']);
  // "lease" is a real dual-signal (asset disposition AND the REAL_ESTATE
  // synonym /\bleases?\b/i) — both tags are correct, not a bug.
  const disposition = classifyIocRestrictionComponents('sell, transfer, lease, license, abandon or otherwise dispose of any material properties or assets');
  assert.ok(disposition.includes('ASSET_SALES_LICENSES'));
  assert.ok(disposition.includes('REAL_ESTATE'));
  assert.deepEqual(classifyIocRestrictionComponents('merge or consolidate the Company or any Company Subsidiary with any Person'), ['MERGE_DISSOLVE_RECAP']);
});

test('classifyIocRestrictionComponents: no keyword hit returns an empty array (never forces an OTHER/fabricated tag)', () => {
  assert.deepEqual(classifyIocRestrictionComponents('some unrelated boilerplate sentence with no restriction keywords'), []);
});

/* ── Wave-3 QA pinning: false-positive pills on unrelated deals ──
   The synonym regexes used to run against the WHOLE sub-clause, so words in
   the exception tail and in securities-mechanics operative language stamped
   unrelated restriction families onto dividends / issuance covenants. These
   fixtures are the verbatim stored texts that produced the wrong pills. */

test('Heinz §5.02(c) Dividends: buy-back "otherwise acquire ... Equity Interests" and exception-tail "Cashless Settlements" no longer tag ACQUISITIONS / LITIGATION_SETTLEMENTS', () => {
  const text = '(c) make, declare or pay any dividend, or make any other distribution on, or directly or indirectly redeem, purchase or otherwise acquire, any shares of its Equity Interests, except (i) dividends paid by any of the Heinz Subsidiaries to Heinz or to any of its Subsidiaries, (ii) any "Regular Quarterly Dividends", "Past Due Dividends" and "Additional Dividends" (each as defined in the Heinz Charter) made, declared or paid on Heinz Preferred Stock outstanding on the date of this Agreement pursuant to and in compliance with the terms of the Heinz Preferred Stock as in effect on the date of this Agreement and (iii) Forfeitures and Cashless Settlements in connection with the Heinz Stock Plan, Heinz Stock Options and Heinz RSUs;';
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(!codes.includes('ACQUISITIONS'), `share buy-back is not M&A: ${codes}`);
  assert.ok(!codes.includes('LITIGATION_SETTLEMENTS'), `Cashless Settlements is equity mechanics: ${codes}`);
  assert.deepEqual(codes, [], 'no threshold-family tag applies to a plain dividends covenant');
});

test('Heinz §5.02(d) Issuance: "Voting Debt" and exception-tail "settlement of Heinz RSUs" no longer tag INDEBTEDNESS / LITIGATION_SETTLEMENTS', () => {
  const text = "(d) issue, deliver, sell, grant, pledge or otherwise encumber or subject to any Lien (i) any Equity Interests of Heinz or any Heinz Subsidiary or any Heinz Voting Debt or (ii) any rights that are linked in any way to the price of any capital stock of, or to the value of or of any part of, or to any dividends or distributions paid on any capital stock of, Heinz or any Heinz Subsidiary, except (A) pursuant to the exercise of Heinz Stock Options or settlement of Heinz RSUs outstanding as of the date of this Agreement, (B) for issuances by a wholly owned Heinz Subsidiary of such Subsidiary's capital stock to Heinz or another wholly owned Heinz Subsidiary;";
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(!codes.includes('INDEBTEDNESS'), `Voting Debt is a security, not a financing restriction: ${codes}`);
  assert.ok(!codes.includes('LITIGATION_SETTLEMENTS'), `RSU settlement is equity mechanics: ${codes}`);
});

test('QXO §4.1(vi) Dividends: exception-tail "except for acquisitions, or deemed acquisitions, of ..." no longer tags ACQUISITIONS', () => {
  const text = '(vi)(A) declare, set aside or pay any dividend or other distribution, whether payable in cash, stock or other property, with respect to its capital stock, except for dividends by any wholly owned direct or indirect Subsidiary of the Company to the Company or any other wholly owned direct or indirect Subsidiary of the Company, (B) split, combine or reclassify the Company Shares or any other outstanding capital stock of the Company or issue or authorize the issuance of any other securities in respect of, in lieu of or in substitution therefor, (C) redeem, purchase or otherwise acquire, directly or indirectly, any capital stock of the Company, except for acquisitions, or deemed acquisitions, of Company Shares;';
  assert.deepEqual(classifyIocRestrictionComponents(text), []);
});

test('QXO §4.1(iv) Issuance: securities "disposition ... of shares of capital stock" and RSU/PSU settlement exceptions no longer tag ASSET_SALES_LICENSES / LITIGATION_SETTLEMENTS', () => {
  const text = '(iv) issue, sell, pledge, dispose of, grant, transfer, encumber, or authorize the issuance, sale, pledge, disposition, grant, transfer or encumbrance of, any shares of capital stock of the Company or any of its Subsidiaries (other than (A) the issuance of Company Shares upon the exercise of Company Options and the settlement of RSU Awards and PSU Awards (and dividend equivalents thereon, if applicable) outstanding on the date of this Agreement or (B) the issuance of shares of capital stock by a wholly owned Subsidiary of the Company to the Company or another wholly owned Subsidiary of the Company);';
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(!codes.includes('ASSET_SALES_LICENSES'), `disposition of own stock is not an asset sale: ${codes}`);
  assert.ok(!codes.includes('LITIGATION_SETTLEMENTS'), `RSU/PSU settlement is equity mechanics: ${codes}`);
});

/* True positives the fix must NOT lose (verbatim Heinz stored texts). */

test('Heinz §5.02(a) Indebtedness: operative language before "other than" still tags INDEBTEDNESS + LOANS_ADVANCES_CONTRIBUTIONS', () => {
  const text = '(a) incur any Indebtedness, make any loan or advance or enter into any swap or hedging transaction other than any of the following:\n\n(i) Indebtedness incurred under the Heinz Credit Facility in the ordinary course of business;';
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(codes.includes('INDEBTEDNESS'));
  assert.ok(codes.includes('LOANS_ADVANCES_CONTRIBUTIONS'));
});

test('Heinz §5.02(g) Dispositions: genuine "dispose of any of its properties or assets" still tags ASSET_SALES_LICENSES (asset-context gate passes)', () => {
  const text = '(g) (i) sell, transfer, mortgage, encumber or otherwise dispose of any of its properties or assets in any transaction or series of transactions to any Person other than Heinz or a Heinz Subsidiary, other than in the ordinary course of business consistent with past practice;';
  assert.ok(classifyIocRestrictionComponents(text).includes('ASSET_SALES_LICENSES'));
});

test('Heinz §5.02(i) Settlement of Claims: genuine litigation settlement still tags LITIGATION_SETTLEMENTS (litigation-context gate passes)', () => {
  const text = '(i) settle any claim, action or proceeding if such settlement would require any payment by Heinz or any of the Heinz Subsidiaries of an amount in excess of $10,000,000 individually;';
  assert.deepEqual(classifyIocRestrictionComponents(text), ['LITIGATION_SETTLEMENTS']);
});

test('Heinz §5.02(j) Acquisitions/Capex: genuine "make any acquisition ... or make any capital expenditures" still tags ACQUISITIONS + CAPEX', () => {
  const text = '(j) directly or indirectly make, or agree to directly or indirectly make, any acquisition or investment either by merger, consolidation, purchase of stock or securities, contributions to capital, property transfers, or by purchase of any property or assets of any other Person, or make any capital expenditures, in each case other than (i) investments in Heinz Subsidiaries;';
  const codes = classifyIocRestrictionComponents(text);
  assert.ok(codes.includes('ACQUISITIONS'));
  assert.ok(codes.includes('CAPEX'));
});

test('leading-grace window: a chapeau-style "Except as set forth ..." opening does not wipe the operative clause', () => {
  const text = 'Except as set forth in the Company Disclosure Letter, the Company shall not incur any indebtedness for borrowed money;';
  assert.deepEqual(classifyIocRestrictionComponents(text), ['INDEBTEDNESS']);
});

test('stampIocRestrictionComponents: only stamps IOC-T / IOC-B sub-clauses, never the bare-IOC preamble/general-exceptions/affirmative provisions', () => {
  const provisions = [
    { type: 'IOC', category: 'IOC General Exceptions', full_text: 'guarantee any indebtedness of another Person', features: {} },
    { type: 'IOC-T', category: 'Indebtedness', full_text: 'incur any indebtedness for borrowed money, or guarantee any indebtedness of another Person', features: {} },
  ];
  stampIocRestrictionComponents(provisions);
  assert.equal(provisions[0].features.restrictionComponents, undefined, 'bare-IOC preamble untouched');
  assert.deepEqual(provisions[1].features.restrictionComponents.sort(), ['INDEBTEDNESS', 'THIRD_PARTY_OBLIGATIONS'].sort());
});

test('stampIocRestrictionComponents is idempotent — skips a provision that already carries a non-empty restrictionComponents', () => {
  const provisions = [
    { type: 'IOC-T', full_text: 'incur any indebtedness for borrowed money', features: { restrictionComponents: ['CAPEX'] } },
  ];
  stampIocRestrictionComponents(provisions);
  assert.deepEqual(provisions[0].features.restrictionComponents, ['CAPEX'], 'existing value preserved, not overwritten');
});

/* ── Wiring: restrictionComponents pills on the IOC negative-covenants table
   (pages/review/[id].js is JSX and can't be imported under node --test —
   see tests/fb3-wiring.test.js for the established source-text pattern). */
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review-v1', '[id].js'), 'utf8');

test('IocNegativeCovenantsTableSingle renders restrictionComponents pills in the strict Provision column', () => {
  const start = reviewSrc.indexOf('function IocNegativeCovenantsTableSingle(');
  assert.ok(start > 0);
  const body = reviewSrc.slice(start, reviewSrc.indexOf('function IocNegativeCovenantsTable(', start));
  assert.match(body, /<th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Provision<\/th>/);
  assert.match(body, /restrictionComponents/);
  assert.match(body, /IOC_CATEGORY_META\[code\]/);
});
