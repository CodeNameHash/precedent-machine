/* Tests for bare-numbered heading shapes surfaced by Forest City (Antlia
   2018) and Prometheus (Merck 2023) — lib/parser-v2/structural +
   lib/edgar-cleanup. Four shapes:
     1. "6.2. Corporate\nAuthority." — number WITH trailing period, title
        hard-wrapped (repairWrappedHeadings previously required the number
        to be period-free, so the join never fired and the heading was lost;
        gap recovery then skipped it as "already covered" by 6.1).
     2. "9.6. Payment of Parent Termination Payment\n\n(a) ..." — title with
        NO terminal period, body opening on a lettered sub-clause.
     3. "8.2 Notice of Termination; Effect\nof Termination." — wrapped title
        whose continuation starts LOWERCASE (the wrap-join requires a capital,
        so the heading pattern itself must tolerate one wrap).
     4. "... governed by\nSection 7.14);" / "... in accordance\n\nwith
        Section 4.3) issued ..." — parenthetical cross-references that
        previously became phantom sections (the 7.14 phantom swallowed 32k
        chars of Section 7.1).
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const { repairWrappedHeadings } = require('../lib/edgar-cleanup');

const BODY_FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.'.repeat(3);

test('repairWrappedHeadings: wrapped title after a period-carrying bare number is rejoined', () => {
  const wrapped = 'in full force and effect.\n\n 6.2. Corporate\nAuthority. No vote of holders of capital stock of Parent is necessary.';
  assert.match(
    repairWrappedHeadings(wrapped),
    /6\.2\. Corporate Authority\. No vote/,
    'number-with-period wrapped title joined'
  );
  // A COMPLETE heading line (title already period-terminated) must not be
  // glued to the prose after it.
  const complete = 'date.\n\n 6.3. Litigation. There are no actions pending.\nEach of the foregoing is qualified.';
  assert.equal(repairWrappedHeadings(complete), complete, 'complete heading untouched');
});

test('Forest City shapes: wrapped titles, no-period titles, and paren cross-refs', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER, dated as of July 30, 2018 (this "Agreement"), among ANTLIA HOLDINGS LLC, ANTLIA MERGER SUB CORP. and FOREST CITY REALTY TRUST, INC.',
    '',
    'ARTICLE IV',
    '',
    'EFFECT OF THE MERGER ON CAPITAL STOCK',
    '',
    `4.1. Effect of the Merger on Capital Stock. At the Effective Time, each share of common stock (other than Company RSUs, which will be treated in accordance`,
    '',
    `with Section 4.3) issued and outstanding immediately prior to the Effective Time will be converted into the right to receive cash.${BODY_FILLER}`,
    '',
    `4.3. Treatment and Payment of Company Equity Awards. Effective as of the Effective Time, each option shall be cancelled.${BODY_FILLER}`,
    '',
    'ARTICLE VI',
    '',
    'REPRESENTATIONS AND WARRANTIES OF PARENT AND MERGER SUB',
    '',
    `6.1. Organization, Good Standing, and Qualification. Each of Parent and Merger Sub is a legal entity duly organized and validly existing.${BODY_FILLER}`,
    '',
    '6.2. Corporate',
    `Authority. No vote of holders of capital stock of Parent is necessary to approve this Agreement.${BODY_FILLER}`,
    '',
    'ARTICLE IX',
    '',
    'TERMINATION',
    '',
    `9.5. Effect of Termination and Abandonment. In the event of termination of this Agreement, this Agreement shall be of no further force and effect; provided that any Transaction Litigation shall be governed by`,
    `Section 7.14);${BODY_FILLER}`,
    '',
    '9.6. Payment of Parent Termination Payment',
    '',
    `(a) Notwithstanding anything to the contrary in this Agreement, in the event the Company determines in good faith to pursue payment of the Parent Termination Payment.${BODY_FILLER}`,
    '',
    '8.2 Notice of Termination; Effect',
    `of Termination. Any proper and valid termination of this Agreement shall be effective upon notice.${BODY_FILLER}`,
  ].join('\n');

  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));

  // Shape 1: wrapped title after a period-carrying number.
  const s62 = sections.find((s) => String(s.number) === '6.2');
  assert.ok(s62, `6.2 recovered (got ${nums})`);
  assert.match(s62.title || '', /Corporate Authority/);

  // Shape 2: no-period title followed by a blank line and "(a)".
  const s96 = sections.find((s) => String(s.number) === '9.6');
  assert.ok(s96, `9.6 recovered (got ${nums})`);
  assert.match(s96.text || '', /Notwithstanding anything to the contrary/);

  // Shape 3: wrapped title with a lowercase continuation.
  const s82 = sections.find((s) => String(s.number) === '8.2');
  assert.ok(s82, `8.2 recovered (got ${nums})`);
  assert.match(s82.title || '', /Notice of Termination/);

  // Shape 4: parenthetical cross-references never become phantom headings.
  assert.ok(!nums.includes('7.14'), `no phantom 7.14 (got ${nums})`);
  const s43 = sections.find((s) => String(s.number) === '4.3');
  assert.ok(s43, '4.3 present');
  assert.match(s43.title || '', /Treatment and Payment/, 'the REAL 4.3 heading won, not the "with Section 4.3)" cross-ref');
  const s95 = sections.find((s) => String(s.number) === '9.5');
  assert.match(s95.text || '', /Section 7\.14\)/, 'the cross-ref stayed inside 9.5');
});
