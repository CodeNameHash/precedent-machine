/* v1 reclassification (2026-08-02) — offline unit coverage for
 * scripts/safety-check-reclass-rules.js's pure core (computeFlips /
 * checkBacklogExits). The script's DB-backed main() is NOT exercised here
 * (this slice is offline-only, no DB reads — see the script's own header
 * comment and the slice handoff's gap list); these tests validate the
 * comparison logic in isolation with synthetic classified_sections
 * snapshots. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeFlips,
  checkBacklogExits,
  loadOldRefineSubCode,
  R1R2_NEW_CODES,
  BACKLOG_EXITS,
  BASELINE_REF,
  comparePinnedKeys,
} = require('../scripts/safety-check-reclass-rules');

// A stand-in for the OLD (pre-change) refineSubCode: R1/R2 old codes were
// AI-classification-only, so the old rule table never stamped a sub-code
// for these titles — always returns null for REP-T.
const oldRefineSubCode = () => null;

test('the live safety gate compares against the pre-reclassification baseline', () => {
  assert.equal(BASELINE_REF, '1ce030c^');
  const baseline = loadOldRefineSubCode();
  assert.equal(
    baseline({ title: 'Requisite Stockholder Approval' }, 'REP-T'),
    null,
  );
});

test('pinned population comparison fails on both additions and omissions', () => {
  assert.deepEqual(comparePinnedKeys(['a', 'c'], ['a', 'b']), {
    unexpected: ['c'],
    missing: ['b'],
  });
});

test('R1: a "Requisite Stockholder Approval" REP-T section is a pinned, expected flip', () => {
  const deals = [{
    id: 'af4940e1-aaaa-bbbb-cccc-dddddddddddd',
    acquirer: '3G', target: 'Skechers',
    metadata: {
      classified_sections: [
        { type: 'REP-T', sectionNumber: '3.4', title: 'Requisite Stockholder Approval' },
        { type: 'REP-T', sectionNumber: '3.6', title: 'Requisite Governmental Approvals' },
      ],
    },
  }];
  const flips = computeFlips(deals, oldRefineSubCode);
  assert.equal(flips.length, 2);
  const codes = flips.map((f) => f.newSub).sort();
  assert.deepEqual(codes, ['REP-T-GOVAPPROVAL', 'REP-T-STOCKAPPROVAL']);
  for (const f of flips) assert.ok(R1R2_NEW_CODES.has(f.newSub));
});

test('non-REP-T sections are never considered (whenType discipline)', () => {
  const deals = [{
    id: 'x', metadata: { classified_sections: [{ type: 'REP-B', sectionNumber: '4.1', title: 'Requisite Stockholder Approval' }] },
  }];
  assert.deepEqual(computeFlips(deals, oldRefineSubCode), []);
});

test('a title matching neither R1/R2 rule is not a flip', () => {
  const deals = [{
    id: 'x', metadata: { classified_sections: [{ type: 'REP-T', sectionNumber: '3.9', title: 'Litigation' }] },
  }];
  assert.deepEqual(computeFlips(deals, oldRefineSubCode), []);
});

test('checkBacklogExits: the two pinned backlog cards stay uncoded (no title match) — clean', () => {
  const deals = BACKLOG_EXITS.map((exit) => ({
    id: `${exit.dealIdPrefix}-1111-2222-3333-444444444444`,
    metadata: { classified_sections: [{ type: 'REP-T', sectionNumber: exit.sectionNumber, title: 'Foreign Operations' }] },
  }));
  assert.deepEqual(checkBacklogExits(deals), []);
});

test('checkBacklogExits: flags a violation if a backlog card WOULD get a new deterministic code', () => {
  const deals = [{
    id: 'df393645-1111-2222-3333-444444444444',
    metadata: { classified_sections: [{ type: 'REP-T', sectionNumber: '3.22', title: 'Requisite Stockholder Approval' }] },
  }];
  const violations = checkBacklogExits(deals);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].label, 'Bonds');
  assert.equal(violations[0].newSub, 'REP-T-STOCKAPPROVAL');
});
