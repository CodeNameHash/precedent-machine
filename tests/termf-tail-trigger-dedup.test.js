// Item 9 (UI Feedback Round 3, QXO card fec8549c): companyTerminationFee.
// triggers stored SEVEN entries -- 2 direct triggers plus 5 tail sub-limbs
// of §6.5(b)(iii) whose labels all end "...followed within 12 months by the
// Company signing or consummating a competing Acquisition Proposal...".
// Only two of the five tail limbs were coded TAIL; the rest slipped through
// the old code-only filter and rendered as near-identical duplicate pills
// (two of them even sharing the RECOMMENDATION_CHANGE code). Tail mechanics
// already render in their own TermfTailMechanics table off the TERMF-TAIL
// card, so these limbs are pure duplication in the fee matrix.
const assert = require('node:assert/strict');
const test = require('node:test');

const QXO_COMPANY_FEE_TRIGGERS = [
  { code: 'RECOMMENDATION_CHANGE', label: 'Company terminates after a Change of Recommendation', text: 'Company terminates pursuant to Section 8.02(b)(i) following a Change of Recommendation.' },
  { code: 'NO_VOTE', label: 'Company terminates for failure to obtain the Company Stockholder Approval', text: 'Company terminates pursuant to Section 8.02(b)(ii) for failure to obtain the Company Stockholder Approval.' },
  { code: 'TAIL', label: 'Company terminates pursuant to Section 8.02(a)(iii) (no vote), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal', text: 'Section 6.5(b)(iii): Company terminates pursuant to Section 8.02(a)(iii) (no vote), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal.' },
  { code: null, label: 'Company terminates pursuant to Section 8.02(b)(iii) (no-solicit breach), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal', text: 'Section 6.5(b)(iii): Company terminates pursuant to Section 8.02(b)(iii) (no-solicit breach), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal.' },
  { code: 'COMPANY_BREACH', label: 'Parent terminates pursuant to Section 8.02(c) (Company breach), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal', text: 'Section 6.5(b)(iii): Parent terminates pursuant to Section 8.02(c) (Company breach), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal.' },
  { code: 'RECOMMENDATION_CHANGE', label: 'Company terminates pursuant to Section 8.02(b)(i) (recommendation change), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal', text: 'Section 6.5(b)(iii): Company terminates pursuant to Section 8.02(b)(i) (recommendation change), followed within 12 months by the Company signing or consummating a competing Acquisition Proposal.' },
  { code: null, label: 'A termination followed within 18 months by the Company signing or consummating a competing takeover proposal', text: 'Section 6.5(b)(iii): a termination followed within 18 months by the Company signing or consummating a competing takeover proposal.' },
];

test('Item 9: tail-fee sub-limbs (coded TAIL or not) are filtered out of the trigger matrix, leaving only the two direct triggers', async () => {
  const { parseTriggerStrings } = await import('../lib/termf.js');
  const triggers = parseTriggerStrings(QXO_COMPANY_FEE_TRIGGERS);
  assert.deepEqual(triggers.map((t) => t.code), ['RECOMMENDATION_CHANGE', 'NO_VOTE'], 'only the two direct triggers should survive -- every §6.5(b)(iii) tail limb is filtered');
});

test('Item 9: a duplicate code that survives the tail filter is deduped, keeping the first occurrence', async () => {
  const { parseTriggerStrings } = await import('../lib/termf.js');
  const triggers = parseTriggerStrings([
    { code: 'NO_VOTE', label: 'Company terminates for no vote', text: 'Section 8.02(b)(ii).' },
    { code: 'NO_VOTE', label: 'Company terminates for no vote (duplicate entry)', text: 'Section 8.02(b)(ii) duplicate.' },
  ]);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].name, 'Company terminates for no vote');
});

test('Item 9: codeless duplicate triggers dedupe by name', async () => {
  const { parseTriggerStrings } = await import('../lib/termf.js');
  const triggers = parseTriggerStrings([
    'Parent terminates pursuant to Section 8.01(b) (Regulatory Failure)',
    'Parent terminates pursuant to Section 8.01(b) (Regulatory Failure)',
  ]);
  assert.equal(triggers.length, 1);
});

test('Item 9: a genuine tail-fee descriptor row (own TermfTailMechanics table) is still filtered by code', async () => {
  const { parseTriggerStrings } = await import('../lib/termf.js');
  const triggers = parseTriggerStrings(['Tail fee: alternative transaction consummated within 12 months']);
  assert.deepEqual(triggers, []);
});
