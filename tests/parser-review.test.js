const test = require('node:test');
const assert = require('node:assert/strict');

const { buildParserReview } = require('../lib/parser-v2/structural');

const CONOCO_SHAPED_FIXTURE = `
AGREEMENT AND PLAN OF MERGER

WHEREAS, the parties desire to merge.

NOW, THEREFORE, the parties agree as follows:

ARTICLE III
EFFECT OF THE MERGER ON THE CAPITAL STOCK

3.2 Treatment of Equity Compensation Awards. (a) Each Company Restricted Stock Award shall be converted into a Parent Restricted Stock Award. (b) Each Company Performance Unit Award shall be converted into a Parent Performance Unit Award.

3.3 Payment for Securities; Exchange. (a) Parent shall appoint the Exchange Agent. (b) Parent shall deposit the Exchange Fund.

3.4 No Appraisal Rights. No appraisal rights shall be available with respect to the Transactions.

ARTICLE VI
COVENANTS AND AGREEMENTS

6.1 Conduct of Company Business Pending the Merger. (a) Except as set forth on the Company Disclosure Letter, the Company shall conduct its business in the ordinary course. (b) The Company shall not issue equity securities.

6.3 No Solicitation by the Company. (a) The Company shall not solicit any Acquisition Proposal. (b) The Company may respond to a Superior Proposal if required by fiduciary duties.

IN WITNESS WHEREOF, the parties have executed this Agreement.

/s/ Parent

ANNEX A
Certain Definitions

"Company Competing Proposal" means any proposal involving, directly or indirectly: (b) any acquisition of beneficial ownership of equity securities.

EXHIBIT A
FORM OF CERTIFICATE OF INCORPORATION
This exhibit is not operative merger agreement body text.
`;

test('buildParserReview exposes structural categories separately from stored coverage gaps', () => {
  const review = buildParserReview(CONOCO_SHAPED_FIXTURE);

  assert.equal(review.summary.region_coverage_complete, true);
  assert.equal(review.data_model_flags.length, 1);
  assert.equal(review.data_model_flags[0].section_number, '3.2');

  const atomicByNumber = new Map(review.atomic_sections.map((section) => [section.section_number, section]));
  assert.equal(atomicByNumber.get('3.2').atomic_reason, 'equity_awards');
  assert.equal(atomicByNumber.get('3.3').atomic_reason, 'payment_exchange');
  assert.equal(atomicByNumber.get('6.1').atomic_reason, 'ioc');
  assert.equal(atomicByNumber.get('6.3').atomic_reason, 'nosol');

  assert.ok(review.definition_warnings.some((warning) => (
    warning.section_number === 'Annex-A'
    && warning.code === 'definition-mid-slice'
  )));
  assert.equal(
    review.structural_gaps.some((gap) => /FORM OF CERTIFICATE/.test(gap.full_text)),
    false,
  );
});
