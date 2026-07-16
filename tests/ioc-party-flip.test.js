/* Tests for IOC-B subsection re-typing ("merger of equals"-style deals).
   classify.js types the WHOLE section from its top header (IOC-T, since bare
   "Conduct of Business" defaults to target), but Starwood/Marriott-style
   sections carry BOTH parties' conduct covenants: "(a) Conduct of Business by
   Starwood ... (b) Conduct of Business by Marriott ...". The acquirer's
   sub-clause (and everything nested under/after it) must re-type to IOC-B.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractProvisionsForType,
  detectIocPartyFlipLetter,
  splitSubClauses,
} = require('../lib/parser-v2/extract.js');

function echoIocClient() {
  return {
    messages: {
      create: async (payload) => {
        const prompt = payload.messages[0].content;
        const idxs = [...prompt.matchAll(/"idx":\s*(\d+)/g)].map((m) => Number(m[1]));
        return {
          content: [{
            text: JSON.stringify({
              results: idxs.map((idx) => ({
                idx,
                code: 'IOC-CHARTER',
                category: 'Charter / Bylaws Amendments',
                favorability: 'neutral',
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

const MIRRORED_SECTION =
  'SECTION 4.1. Conduct of Business. ' +
  '(a) Conduct of Business by Starwood. Except as set forth in Section 4.1 of the Company Disclosure Letter, ' +
  'Starwood shall not: (i) amend its certificate of incorporation or bylaws in any manner adverse to Marriott; ' +
  '(ii) issue any shares of capital stock except as expressly permitted by this Agreement. ' +
  '(b) Conduct of Business by Marriott. Except as set forth in Section 4.1 of the Parent Disclosure Letter, ' +
  'Marriott shall not: (i) amend its certificate of incorporation or bylaws in any manner adverse to Starwood; ' +
  '(ii) issue any shares of capital stock except as expressly permitted by this Agreement.';

test('detectIocPartyFlipLetter: second distinct "Conduct of Business by <Name>" flips at its letter', () => {
  const parts = splitSubClauses(MIRRORED_SECTION, 'IOC');
  const flip = detectIocPartyFlipLetter(parts);
  assert.equal(flip, 'b');
});

test('detectIocPartyFlipLetter: single-party section (no second name) returns null', () => {
  const text =
    'SECTION 5.1. Conduct of Business. (a) The Company shall not: (i) amend its charter; ' +
    '(b) issue any equity securities except as permitted by this Agreement.';
  const parts = splitSubClauses(text, 'IOC');
  assert.equal(detectIocPartyFlipLetter(parts), null);
});

test('mirrored IOC section: sub-clause (a) stays IOC-T, sub-clause (b) and its roman descendants flip to IOC-B', async () => {
  const provisions = await extractProvisionsForType([{
    provision_type: 'IOC-T',
    number: '4.1',
    title: 'Conduct of Business',
    text: MIRRORED_SECTION,
    startChar: 0,
  }], 'IOC', echoIocClient(), MIRRORED_SECTION);

  const byNum = {};
  for (const p of provisions) {
    const num = p.features && p.features.sectionNumber;
    if (num) byNum[num] = p.type;
  }

  assert.equal(byNum['4.1(a)(i)'], 'IOC-T', JSON.stringify(byNum));
  assert.equal(byNum['4.1(a)(ii)'], 'IOC-T', JSON.stringify(byNum));
  assert.equal(byNum['4.1(b)(i)'], 'IOC-B', JSON.stringify(byNum));
  assert.equal(byNum['4.1(b)(ii)'], 'IOC-B', JSON.stringify(byNum));
});

test('single-party IOC section is completely unaffected (no false-positive flip)', async () => {
  const text =
    'SECTION 5.1. Conduct of Business. (a) The Company shall not amend its certificate of incorporation. ' +
    '(b) The Company shall not issue any equity securities except as expressly permitted by this Agreement.';
  const provisions = await extractProvisionsForType([{
    provision_type: 'IOC-T',
    number: '5.1',
    title: 'Conduct of Business',
    text,
    startChar: 0,
  }], 'IOC', echoIocClient(), text);

  assert.ok(provisions.length > 0);
  for (const p of provisions) {
    assert.equal(p.type, 'IOC-T', `expected all provisions to stay IOC-T, got ${p.type}`);
  }
});
