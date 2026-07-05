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
  assert.equal(tryDeterministic(sec('3.2', 'Treatment of Equity Compensation Awards'), null).type, 'CONSID'); // Concho
  assert.equal(tryDeterministic(sec('3.3', 'Payment for Securities; Exchange'), null).type, 'CONSID'); // Concho
  assert.equal(tryDeterministic(sec('3.4', 'No Appraisal Rights'), null).type, 'CONSID'); // Concho
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
});

test('body-aware "Fees and Expenses" generalizes BEYOND the TERMINATION article (Red Hat / Kraft / Bioverativ)', () => {
  // Bioverativ 9.04(b) — a real $326,000,000 termination fee sitting in a
  // MISCELLANEOUS-article "Fees and Expenses" section, not a TERMINATION
  // article. PR #67 only checked the body inside TERMINATION articles, so
  // this stayed MISC/COV corpus-wide until now.
  const bioverativBody = 'In the event this Agreement is terminated under circumstances requiring payment of the Company Termination Fee, ' +
    'the Company shall pay to Parent a fee of $326,000,000 (the "Company Termination Fee"), payable by wire transfer within two business days of such termination. ' +
    'Except as set forth in this Section 9.04, each party shall bear its own fees and expenses. '.repeat(5);
  assert.deepEqual(
    tryDeterministic(sec('9.04', 'Fees and Expenses', bioverativBody), 'MISC'),
    { type: 'TERMF', confidence: 'high' },
  );
  // Same shape, sitting in a COV article (Kraft/Red Hat-style placement) —
  // still TERMF, because the discriminator is body-keyed, not article-keyed.
  assert.equal(tryDeterministic(sec('6.08', 'Fees and Expenses', bioverativBody), 'COV').type, 'TERMF');
  // No article context at all (title rule alone must still catch it).
  assert.equal(tryDeterministic(sec('6.08', 'Fees and Expenses', bioverativBody), null).type, 'TERMF');
  // "Expense Reimbursement" outside TERMINATION, with real fee substance —
  // the fourth title this discriminator covers.
  assert.equal(tryDeterministic(sec('9.5', 'Expense Reimbursement', bioverativBody), 'MISC').type, 'TERMF');
  // Bioverativ's ACTUAL title punctuates with a semicolon ("Fees; Expenses"),
  // not "and" — the corpus-wide safety sweep caught this as the reason the
  // section wasn't matching at all pre-fix. Real body text (Section 9.04(b)).
  const bioverativReal = 'Section 9.04. Fees; Expenses. ' +
    '(a) Except as otherwise expressly provided in this Agreement, all costs and expenses incurred in connection with this Agreement and the Transactions shall be paid by the party incurring such costs or expenses. ' +
    '(b) If this Agreement is terminated by the Company pursuant to Section 8.01(d)(i), prior to or concurrently with such termination, the Company shall pay Parent a fee in the amount of $326,000,000 (the "Termination Fee").';
  assert.deepEqual(
    tryDeterministic(sec('9.04', 'Fees; Expenses', bioverativReal), 'MISC'),
    { type: 'TERMF', confidence: 'high' },
  );
});

test('body-aware "Fees and Expenses"/"Expenses" negative: genuine boilerplate stays MISC in ANY article', () => {
  // CSRA-shaped: ~278 chars of pure each-party-bears-its-own boilerplate, no
  // dollar figures, no "Termination Fee" term, no payable-upon-termination
  // language. Must stay MISC no matter which article it lands in.
  const csraBoilerplate = 'Except as otherwise expressly provided in this Agreement, all fees, costs and expenses incurred in connection with this Agreement and the transactions ' +
    'contemplated hereby shall be paid by the party incurring such fees, costs or expenses, whether or not the Merger is consummated.';
  const miscCov = tryDeterministic(sec('6.08', 'Fees and Expenses', csraBoilerplate), 'COV');
  assert.equal(miscCov.type, 'MISC');
  assert.equal(miscCov.code, 'MISC-EXPENSES');
  const miscTerm = tryDeterministic(sec('8.03', 'Fees and Expenses', csraBoilerplate), 'TERMINATION');
  assert.equal(miscTerm.type, 'MISC');
  assert.equal(miscTerm.code, 'MISC-EXPENSES');
  const miscMisc = tryDeterministic(sec('10.4', 'Expenses'), 'MISC');
  assert.equal(miscMisc.type, 'MISC');

  // A REP-article section that merely mentions fees in prose must not be
  // yanked by the generic title regex — "Fees and Expenses" only fires on
  // an exact (anchored) title, so a differently-titled rep stays put.
  const repProse = sec(
    '3.09',
    'Brokers and Finders Fees',
    "Except for fees payable to the Company's financial advisor, no broker, finder or investment banker is entitled to any brokerage, finder's or other fee or commission in connection with the transactions contemplated by this Agreement.",
  );
  assert.equal(tryDeterministic(repProse, 'REP-T').type, 'REP-T');

  // Belt-and-braces: even an EXACT "Expenses" title inside a REP article
  // (never happens in practice, but the notInArticle guard must hold) keeps
  // the article's REP-T, not MISC/TERMF, regardless of body content.
  assert.equal(tryDeterministic(sec('3.10', 'Expenses', bioverativBodyForRepGuard()), 'REP-T').type, 'REP-T');
});

function bioverativBodyForRepGuard() {
  return 'The Company shall pay Parent a fee of $326,000,000 (the "Company Termination Fee") payable upon termination of this Agreement.';
}

test('tender-offer condition annex "Conditions to the Offer" → COND-B', () => {
  assert.equal(tryDeterministic(sec('ANNEX-COND', 'Conditions to the Offer'), null).type, 'COND-B');   // CSRA / Bioverativ / Pharmasset
  assert.equal(tryDeterministic(sec('Annex-I', 'CONDITIONS TO THE OFFER'), 'STRUCT').type, 'COND-B');  // Verve
});
