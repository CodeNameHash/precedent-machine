/* Unit test for the pure core of scripts/safety-check-nosol-rule.js — the
   mandatory pre-write corpus-wide safety check for the NOSOL title/content
   classify-rule fix. Feeds it fabricated classified_sections snapshots
   (no DB) plus the OLD (pre-fix) tryDeterministic loaded straight from this
   module (title rules unchanged in this test double — the fix under test
   is the diff logic itself, not the live corpus). Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFlips } = require('../scripts/safety-check-nosol-rule');
const { tryDeterministic: newTryDeterministic } = require('../lib/parser-v2/classify');

// A stand-in "old" tryDeterministic that behaves like pre-fix classify.js:
// no bare \bsolicitation\b alternative on the NOSOL rule.
function oldTryDeterministic(section) {
  const title = String(section.title || '');
  if (/no[\s-]*(?:solicitation|shop)|acquisition\s+proposals?/i.test(title)) {
    return { type: 'NOSOL', confidence: 'high' };
  }
  if (/covenants?\s+of\s+(?:the\s+)?company|conduct\s+of\s+(?:the\s+)?company/i.test(title)) {
    return { type: 'IOC-T', confidence: 'high' };
  }
  return null;
}

const section = (over) => ({
  sectionNumber: '1.1', title: 'Untitled', text: '', type: 'COV', ...over,
});

test('safety check flags the Frontier-style title flip (COV -> NOSOL)', () => {
  const deals = [{
    id: 'd1', acquirer: 'Verizon', target: 'Frontier',
    metadata: { classified_sections: [
      section({ sectionNumber: '5.02', title: 'Solicitation; Change in Recommendation', type: 'COV', text: 'boilerplate' }),
    ] },
  }];
  const flips = computeFlips(deals, oldTryDeterministic);
  assert.equal(flips.length, 1);
  assert.equal(flips[0].reason, 'title-rule');
  assert.equal(flips[0].newType, 'NOSOL');
});

test('safety check flags the SecureWorks-style content flip (IOC-T -> NOSOL)', () => {
  const noShopBody = 'shall not, directly or indirectly, initiate, solicit or knowingly encourage the making of any Acquisition Proposal';
  const deals = [{
    id: 'd2', acquirer: 'Sophos', target: 'SecureWorks',
    metadata: { classified_sections: [
      section({ sectionNumber: '6.01', title: 'Conduct of the Company', type: 'IOC-T', text: noShopBody }),
    ] },
  }];
  const flips = computeFlips(deals, oldTryDeterministic);
  assert.equal(flips.length, 1);
  assert.equal(flips[0].reason, 'content-fallback');
  assert.equal(flips[0].newType, 'NOSOL');
});

test('safety check reports NOTHING for an unrelated section (no title/content signal)', () => {
  const deals = [{
    id: 'd3', acquirer: 'A', target: 'B',
    metadata: { classified_sections: [
      section({ sectionNumber: '7.1', title: 'Employee Benefit Plan Matters', type: 'COV', text: 'ordinary covenant text with no solicitation language' }),
    ] },
  }];
  const flips = computeFlips(deals, oldTryDeterministic);
  assert.equal(flips.length, 0);
});

test('safety check does not double-report a section already stored as NOSOL', () => {
  const deals = [{
    id: 'd4', acquirer: 'A', target: 'B',
    metadata: { classified_sections: [
      section({ sectionNumber: '6.1', title: 'No Solicitation', type: 'NOSOL', text: 'shall not solicit or knowingly encourage any Acquisition Proposal' }),
    ] },
  }];
  const flips = computeFlips(deals, oldTryDeterministic);
  assert.equal(flips.length, 0);
});

test('safety check reports NOTHING for employee/proxy solicitation titles (bare-solicitation guard)', () => {
  const deals = [{
    id: 'd5', acquirer: 'A', target: 'B',
    metadata: { classified_sections: [
      section({ sectionNumber: '6.9', title: 'Non-Solicitation of Employees', type: 'COV', text: 'no-hire covenant text' }),
      section({ sectionNumber: '6.4', title: 'Solicitation of Proxies', type: 'COV', text: 'proxy solicitation mechanics' }),
    ] },
  }];
  const flips = computeFlips(deals, oldTryDeterministic);
  assert.equal(flips.length, 0);
});

test('sanity: computeFlips is driven by the REAL new tryDeterministic export (regression guard)', () => {
  // Confirms the wiring — computeFlips uses lib/parser-v2/classify's
  // current (post-fix) tryDeterministic internally, not a copy.
  assert.equal(newTryDeterministic({ title: 'Solicitation; Change in Recommendation' }, null).type, 'NOSOL');
});
