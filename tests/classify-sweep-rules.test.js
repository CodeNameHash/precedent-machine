/* Tests for the cross-deal sweep's deterministic-rule additions — every
   title below is a REAL section title from the corpus, and every rule was
   checked against ALL deals' parsed section titles before landing (the only
   corpus-wide matches are the intended sections; guards asserted here).
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { tryDeterministic } = require('../lib/parser-v2/classify');

const sec = (number, title, text) => ({
  number, title, heading: title,
  articleNumber: number.split('.')[0], startChar: 0,
  text: text || `Section ${number} ${title}. ${'Substantive obligations of the parties follow herein. '.repeat(10)}`,
});

test('Skechers interim-operations split: Affirmative Obligations / Forbearance Covenants → IOC-T', () => {
  // Article V title parses as bare "INTERIM" (marker split), so articleType
  // is null — the title rules must carry these on their own.
  assert.equal(tryDeterministic(sec('5.1', 'Affirmative Obligations'), null).type, 'IOC-T');
  assert.equal(tryDeterministic(sec('5.2', 'Forbearance Covenants'), null).type, 'IOC-T');
  assert.equal(tryDeterministic(sec('5.2', 'Forbearances'), null).type, 'IOC-T');
  // Guard: a rep section can't be yanked even if a doc titles one this way —
  // the REP article wins and the section stays REP-T.
  assert.equal(tryDeterministic(sec('3.12', 'Forbearance Covenants'), 'REP-T').type, 'REP-T');
});

test('efforts-covenant titles → ANTI, overriding a COV article', () => {
  for (const [num, title] of [
    ['6.1', 'Required Action and Forbearance; Efforts'], // Skechers
    ['6.03', 'Required Actions'],                        // Kraft
    ['6.2', 'Filings'],                                  // Skechers
    ['6.10', 'Efforts'],                                 // Bioverativ
    ['6.6', 'Further Action; Efforts'],                  // Verve
    ['6.8', 'HSR and Other Approvals'],                  // Concho
    ['6.3', 'Consummation of the Offer and the Merger'], // CSRA
  ]) {
    assert.equal(tryDeterministic(sec(num, title), 'COV').type, 'ANTI', `${title} → ANTI`);
  }
  // Anchor guards: filing-flavoured REP and proxy-covenant titles stay put.
  assert.equal(tryDeterministic(sec('3.7', 'SEC Filings'), 'REP-T').type, 'REP-T');
  assert.equal(tryDeterministic(sec('7.2', 'Certain Filings'), 'COV').type, 'COV');
  assert.equal(tryDeterministic(sec('6.3', 'Proxy Statement Filing; Information Supplied'), 'COV').type, 'COV');
  assert.equal(tryDeterministic(sec('4.4', 'Diligent Efforts'), 'COV').type, 'COV', 'CVR-agreement "Diligent Efforts" is not the antitrust covenant');
});

test('no-shop titled "Unsolicited Proposals" (Bioverativ 6.02) → NOSOL', () => {
  assert.equal(tryDeterministic(sec('6.02', 'Unsolicited Proposals'), 'COV').type, 'NOSOL');
});

test('consideration mechanics in a STRUCT article → CONSID', () => {
  assert.equal(tryDeterministic(sec('1.4', 'Effect on Capital Stock'), 'STRUCT').type, 'CONSID');   // Mr. Cooper / Prometheus / Anadarko
  assert.equal(tryDeterministic(sec('2.01', 'Conversion of Capital Stock'), null).type, 'CONSID');  // Red Hat
  // Genuinely-structural titles keep STRUCT.
  assert.equal(tryDeterministic(sec('2.4', 'Effect of the Merger'), 'STRUCT').type, 'STRUCT');
});

test('termination fees parked in the MISC article → TERMF', () => {
  assert.equal(tryDeterministic(sec('10.5', 'Company Termination Fee'), 'MISC').type, 'TERMF'); // Anadarko
  assert.equal(tryDeterministic(sec('10.5', 'Termination Fees'), 'MISC').type, 'TERMF');        // Mr. Cooper
  // Plain boilerplate stays MISC.
  assert.equal(tryDeterministic(sec('10.4', 'Expenses'), 'MISC').type, 'MISC');
});

test('TERMINATION-article "Fees and Expenses": TERMF only when the body carries a fee', () => {
  const feeBody = 'In the event of termination, the Company shall pay Parent the Company Termination Fee of $445,000,000 in cash. ' + 'Further mechanics follow. '.repeat(20);
  const boilerplate = 'All fees and expenses incurred in connection with this Agreement shall be paid by the party incurring such fees and expenses.';
  // Prometheus 8.3 / Skechers 8.3
  assert.equal(tryDeterministic(sec('8.3', 'Fees and Expenses', feeBody), 'TERMINATION').type, 'TERMF');
  // Metsera 8.03 — 323 chars of each-party-bears-its-own
  const misc = tryDeterministic(sec('8.03', 'Fees and Expenses', boilerplate), 'TERMINATION');
  assert.equal(misc.type, 'MISC');
  assert.equal(misc.code, 'MISC-EXPENSES');
  // Concho 8.3 — fee triggers dressed in an expenses title
  assert.equal(tryDeterministic(sec('8.3', 'Expenses and Other Payments'), 'TERMINATION').type, 'TERMF');
  // Fees and Expenses OUTSIDE a TERMINATION article keeps the MISC rule
  // (Kraft 6.08-style sections are a known body-level limitation).
  assert.equal(tryDeterministic(sec('6.08', 'Fees and Expenses'), 'COV').type, 'MISC');
});

test('tender-offer condition annex "Conditions to the Offer" → COND-B', () => {
  assert.equal(tryDeterministic(sec('ANNEX-COND', 'Conditions to the Offer'), null).type, 'COND-B');   // CSRA / Bioverativ / Pharmasset
  assert.equal(tryDeterministic(sec('Annex-I', 'CONDITIONS TO THE OFFER'), 'STRUCT').type, 'COND-B');  // Verve
});
