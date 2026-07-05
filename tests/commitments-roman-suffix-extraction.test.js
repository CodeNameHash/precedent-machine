const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractProvisionsForType,
  splitSubClauses,
} = require('../lib/parser-v2/extract.js');

function echoIocClient() {
  return {
    messages: {
      create: async (payload) => {
        const prompt = payload.messages[0].content;
        const idxs = [...prompt.matchAll(/"idx":\s*(\d+)/g)]
          .map((m) => Number(m[1]));
        return {
          content: [{
            text: JSON.stringify({
              results: idxs.map((idx) => ({
                idx,
                code: 'IOC-COMMIT',
                category: 'Commitments',
                favorability: 'buyer',
                features: {},
                isNewCode: false,
              })),
            }),
          }],
        };
      },
    },
  };
}

const SECTION_5_01 =
  'SECTION 5.01. Conduct of Business. (b) the Company shall not: ' +
  '(i) merge or consolidate with any other Person or acquire any equity interests in any Person; ' +
  '(ii) make any capital contribution or investment in any Person, other than in wholly owned Subsidiaries; ' +
  '(c) incur any indebtedness for borrowed money.';

test('IOC nested roman sub-clause under 5.01 survives with its lettered parent suffix', async () => {
  const provisions = await extractProvisionsForType([{
    provision_type: 'IOC',
    number: '5.01',
    title: 'Conduct of Business',
    text: SECTION_5_01,
    startChar: 0,
  }], 'IOC', echoIocClient(), SECTION_5_01);

  const commitment = provisions.find((p) =>
    p.features &&
    p.features.sectionNumber === '5.01(b)(ii)');
  assert.ok(commitment, provisions.map((p) => p.features && p.features.sectionNumber).join(', '));
  assert.match(commitment.text, /make any capital contribution or investment in any Person/);
});

test('pure internal roman numbering is still skipped inside an IOC clause', () => {
  const text =
    'SECTION 5.01. Conduct of Business. (h) enter into any Contract with payment due on the earlier of ' +
    '(x) 90 days after signing and (y) the Outside Date; (i) incur any indebtedness for borrowed money.';
  const parts = splitSubClauses(text, 'IOC');
  const letters = parts.map((p) => p.letter);

  assert.ok(!letters.includes('h.x'), `pure date alternatives must not split: ${letters}`);
  assert.ok(!letters.includes('h.y'), `pure date alternatives must not split: ${letters}`);
  assert.ok(letters.includes('i'), `top-level letter i must remain top-level: ${letters}`);
});

test('mixed roman enumeration under 6.01 keeps substantive buyer-side clauses', async () => {
  const text =
    'SECTION 6.01. Conduct of Parent. (a) Parent shall not: ' +
    '(i) amend its organizational documents in a manner adverse to the Company; ' +
    '(ii) issue any equity securities except as expressly permitted by this Agreement; ' +
    '(b) take any action intended to prevent the Merger.';
  const provisions = await extractProvisionsForType([{
    provision_type: 'IOC-B',
    number: '6.01',
    title: 'Conduct of Parent',
    text,
    startChar: 0,
  }], 'IOC', echoIocClient(), text);

  const sectionNumbers = provisions
    .map((p) => p.features && p.features.sectionNumber)
    .filter(Boolean);
  assert.ok(sectionNumbers.includes('6.01(a)(i)'), sectionNumbers.join(', '));
  assert.ok(sectionNumbers.includes('6.01(a)(ii)'), sectionNumbers.join(', '));
});
