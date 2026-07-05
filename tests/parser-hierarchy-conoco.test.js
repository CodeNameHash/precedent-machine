const test = require('node:test');
const assert = require('node:assert/strict');

const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const { classifySections } = require('../lib/parser-v2/classify');

const CONOCO_TERMINATION_FIXTURE = `
AGREEMENT AND PLAN OF MERGER

NOW, THEREFORE, the parties agree as follows:

ARTICLE VIII
TERMINATION

8.1 Termination. This Agreement may be terminated by either Parent or the Company if the Merger shall not have been consummated by the Outside Date.

8.2 Notice of Termination; Effect of Termination. A terminating Party shall provide written notice of termination to the other Party.

8.3 Expenses and Other Payments. (a) Except as otherwise provided in this Agreement, each Party shall pay its own expenses. (b) If this Agreement is terminated by Parent pursuant to Section 8.1 because the Company Board makes a Company Change of Recommendation, then the Company shall pay Parent the Company Termination Fee. (c) If this Agreement is terminated by the Company pursuant to Section 8.1 in order to enter into a Company Superior Proposal, then the Company shall pay Parent the Company Termination Fee.
`;

test('Conoco-shaped Expenses and Other Payments section is classified as TERMF', async () => {
  const parsed = parseStructure(cleanText(CONOCO_TERMINATION_FIXTURE));
  const fakeClient = {
    messages: {
      create: async () => {
        throw new Error('fixture should classify deterministically');
      },
    },
  };
  const classified = await classifySections(parsed.sections, parsed.articles, fakeClient);
  const fees = classified.find((section) => section.number === '8.3');

  assert.ok(fees);
  assert.equal(fees.provisionType, 'TERMF');
  assert.equal(fees.classifiedBy, 'regex');
});
