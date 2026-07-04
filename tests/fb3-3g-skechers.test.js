const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let tableLogic;
let dealDisplay;
let extract;

test.before(async () => {
  tableLogic = await import(path.join('..', 'components', 'review', 'table-logic.js'));
  dealDisplay = await import(path.join('..', 'lib', 'deal-display.js'));
  extract = require('../lib/parser-v2/extract.js');
});

test('deal display prefers ultimate parent over filed acquisition vehicle', () => {
  const deal = {
    acquirer: 'Beach Acquisition Co Parent, LLC',
    target: 'Skechers U.S.A., Inc.',
    metadata: {
      parent_entity: '3G Capital',
      acquirer_display: 'Beach Acquisition Co Parent',
    },
  };
  assert.equal(dealDisplay.getDisplayAcquirer(deal), '3G Capital');
  assert.equal(dealDisplay.getDisplayTarget(deal), 'Skechers U.S.A., Inc.');
});

test('consideration headline detects cash/stock election mechanics as MIXED_ELECTION', () => {
  const type = tableLogic.deriveHeadlineConsiderationType([
    {
      type: 'CONSID',
      category: 'Mixed Election',
      features: { proration: 'Proration applies if cash election or stock election is oversubscribed.' },
      full_text: 'Each holder may make a Cash Election or a Stock Election by submitting an election form before the election deadline.',
    },
  ]);
  assert.equal(type, 'MIXED_ELECTION');
});

test('employee equity table source excludes synthetic Common Stock rows', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'ConsiderationTables.js'), 'utf8');
  assert.match(src, /Employee equity treatment/);
  assert.match(src, /code !== 'COMMON_STOCK'/);
  assert.doesNotMatch(src, /equityRows\.unshift\(commonStockRow\)/);
});

test('Material Contracts rep sources buckets from DEF when rep only references the defined term', () => {
  const rep = {
    id: 'rep-mcon',
    type: 'REP-T',
    code: 'REP-T-MATERIAL-CONTRACTS',
    category: 'Material Contracts',
    full_text: 'Section 3.18 of the Company Disclosure Letter lists each Material Contract.',
    features: { materialContractsBuckets: [] },
  };
  const def = {
    id: 'def-mcon',
    type: 'DEF',
    code: 'DEF-MATERIAL-CONTRACTS',
    category: 'Material Contracts',
    features: { canonicalTerm: 'Material Contracts' },
    full_text: '"Material Contracts" means any Contract: ' +
      '(a) required to be filed as a material contract pursuant to Item 601(b) of Regulation S-K; ' +
      '(b) involving aggregate payments in excess of $25,000,000; ' +
      '(c) evidencing Indebtedness; ' +
      '(d) creating any joint venture or partnership; ' +
      '(e) relating to any acquisition or disposition of assets or businesses; ' +
      '(f) inbound licenses of Intellectual Property; ' +
      '(g) outbound licenses of Intellectual Property; ' +
      '(h) supply agreements; ' +
      '(i) manufacturing agreements; ' +
      '(j) distribution or reseller agreements; ' +
      '(k) collaboration or research and development agreements; ' +
      '(l) settlement agreements; ' +
      '(m) non-competition or non-solicitation restrictions; ' +
      '(n) real estate leases; ' +
      '(o) employment agreements with key executives; ' +
      '(p) Government Contracts; ' +
      '(q) affiliate or related-party transactions; ' +
      '(r) exclusivity, most-favored-nation or standstill obligations; ' +
      '(s) capital expenditure commitments; ' +
      '(t) data privacy or security agreements; ' +
      '(u) voting, registration rights or stockholder agreements; ' +
      '(v) clinical trial or contract research organization agreements; ' +
      '(w) agreements with milestone, royalty or other ongoing obligations; and ' +
      '(x) rights of first refusal, first offer or first negotiation.',
  };
  const provisions = [rep, def];
  extract.stampMaterialContractsBucketsFromDefinitions(provisions);
  assert.equal(rep.features.materialContractsBuckets.length, 24);
  assert.equal(rep.features.materialContractsBuckets[0].code, 'SEC_ITEM_601');
  assert.equal(rep.features.materialContractsBuckets[1].code, 'AGGREGATE_PAYMENTS');
  assert.equal(rep.features.materialContractsBuckets[1].threshold, '$25,000,000');
  assert.equal(rep.features.materialContractsBuckets.at(-1).code, 'ROFR_ROFN');
  assert.equal(rep.features.materialContractsBucketsSource.source, 'definition');
});

/* ─────────────────────────────────────────────────────────────────────────
 * Audit-2 item 3 — live regression: Skechers' "Material Contract" definition
 * enumerates with ROMAN NUMERALS ("(i) ... (ii) ... (xiii)"), not letters.
 * The old splitLetteredDefinitionBuckets only recognized single-letter
 * "(a)/(b)/(c)" markers, so a roman-numeral definition produced ZERO buckets
 * (0/29 canonical coverage in production) even though isMaterialContractsRep
 * / isMaterialContractsDefinition matched correctly. Fixture below is
 * Skechers' real DEF text shape (trimmed to 8 items for test brevity).
 * ───────────────────────────────────────────────────────────────────────── */
test('Material Contracts rep sources buckets from a ROMAN-NUMERAL-enumerated DEF (Skechers shape)', () => {
  const rep = {
    id: 'rep-mcon-roman',
    type: 'REP-T',
    code: 'REP-T-MATERIAL-CONTRACTS',
    category: 'Material Contracts',
    full_text: 'Section 3.18 of the Company Disclosure Letter lists each Material Contract.',
    features: { materialContractsBuckets: [] },
  };
  const def = {
    id: 'def-mcon-roman',
    type: 'DEF',
    code: 'DEF-MATCONTRACT',
    category: 'Material Contract',
    features: { canonicalTerm: 'Material Contract' },
    full_text: '"Material\nContract" means any of the following Contracts:\n\n' +
      ' (i) any "material contract" (as defined in Item 601(b)(10) of Regulation S-K promulgated by the SEC) with respect to the Company Group, taken as a whole;\n\n' +
      ' (ii) any material Contract with any of the top 20 suppliers to the Company Group, taken as a whole (the "Material Suppliers");\n\n' +
      ' (iii) any material Contract with any of the top 20 customers to the Company Group, taken as a whole;\n\n' +
      ' (iv) any Contract containing any covenant limiting the right of the Company Group to engage in any material line of business or containing any "most favored nation" or "exclusivity" provision;\n\n' +
      ' (v) any Contract relating to the disposition or acquisition of assets by the Company Group with a value greater than $15,000,000;\n\n' +
      ' (vi) any Contract pursuant to which a member of the Company Group has been granted or grants any license with respect to any material Intellectual Property;\n\n' +
      ' (vii) any mortgages, indentures, guarantees, loans or credit agreements relating to Indebtedness;\n\n' +
      ' (viii) any Lease of real property material to the Company Group.',
  };
  const provisions = [rep, def];
  extract.stampMaterialContractsBucketsFromDefinitions(provisions);
  const buckets = rep.features.materialContractsBuckets;
  assert.ok(buckets.length >= 7, `expected roman-enumerated buckets to populate, got ${buckets.length}`);
  const codes = buckets.map((b) => b.code);
  assert.ok(codes.includes('SEC_ITEM_601'), `expected a canonical code, got ${codes}`);
  assert.ok(codes.includes('EXCLUSIVITY_MFN'), `expected a canonical code, got ${codes}`);
  assert.ok(codes.includes('INDEBTEDNESS'), `expected a canonical code, got ${codes}`);
  assert.ok(codes.some((c) => c !== 'OTHER'), 'canonical coverage must be > 0, not all OTHER');
});

test('roman-enumerated IOC affirmative preamble splits into existence, ordinary course, preserve limbs with correct standards', () => {
  const text = 'the Company will, and will cause each of its Subsidiaries to, (i) maintain its existence in good standing (to the extent applicable) pursuant to applicable law; (ii) subject to the restrictions and exceptions set forth in Section 5.2 or elsewhere in this Agreement, use its commercially reasonable efforts to conduct its business and operations in the ordinary course of business; and (iii) use its respective commercially reasonable efforts to (A) preserve intact its material assets, properties, Contracts or other legally binding understandings, licenses and business organizations; (B) keep available the services of its current officers and key employees; and (C) preserve the current relationships with customers, vendors, distributors, partners (including system integrators, platform partners, referral partners, consulting and implementation partners), lessors, licensors, licensees, creditors, contractors and other Persons with which the Company Group has material business relations.';
  const split = extract.splitIocPreamble(text);
  assert.deepEqual(split.obligations.map((o) => o.key), ['IOC-EXISTENCE', 'IOC-ORDINARY', 'IOC-PRESERVE']);
  assert.deepEqual(split.obligations.map((o) => o.efforts_standard), ['FLAT', 'COMMERCIALLY_REASONABLE_EFFORTS', 'COMMERCIALLY_REASONABLE_EFFORTS']);
  assert.ok(split.obligations[2].text.includes('(A) preserve intact'));
  assert.ok(split.obligations[2].text.includes('(C) preserve the current relationships'));
});

test('bring-down redesign helper splits covered reps into pill labels while preserving qualifiers', () => {
  const lines = tableLogic.buildBringdownTierLines([
    {
      standard_label: 'In all material respects',
      reps_covered: 'Section 3.01 (first sentence only), Section 3.02(b) through Section 3.02(e), and Section 3.22',
    },
  ], {
    '3.01': 'Organization',
    '3.02': 'Capitalization',
    '3.22': 'Brokers',
  });
  const pills = tableLogic.splitBringdownCoveredPills(lines[0].group);
  assert.deepEqual(pills, [
    'Organization (first sentence only)',
    'Capitalization (b) through (e)',
    'Brokers',
  ]);
});
