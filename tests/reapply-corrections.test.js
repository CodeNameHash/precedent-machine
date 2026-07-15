/* Tests for lib/parser-v2/reapply-corrections.js — edits survive re-extraction. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeUserDelta,
  matchCorrectionToProvision,
  planReapplication,
} = require('../lib/parser-v2/reapply-corrections');

const FEE_TEXT = 'If the Company terminates this Agreement to enter a Superior Proposal, the Company shall pay Parent a termination fee of $6,900,000 in cash within two Business Days.';

test('computeUserDelta captures only what the user changed', () => {
  const before = { category: 'Company Termination Fee', ai_favorability: 'neutral', features: { a: 1, b: 2, c: 3 } };
  const after = { category: 'Company Termination Fee', ai_favorability: 'buyer-favorable', features: { a: 1, b: 99 } };
  const d = computeUserDelta(before, after);
  assert.deepEqual(d.set, { ai_favorability: 'buyer-favorable' });
  assert.deepEqual(d.featureSet, { b: 99 });
  assert.deepEqual(d.featureDelete, ['c']);
  assert.equal(d.empty, false);
});

test('computeUserDelta is empty when nothing changed', () => {
  const snap = { category: 'X', features: { a: 1 } };
  assert.equal(computeUserDelta(snap, snap).empty, true);
});

test('match prefers category match, requires text similarity otherwise', () => {
  const correction = { before: { category: 'Company Termination Fee', full_text: FEE_TEXT }, after: {} };
  const fresh = [
    { id: 'p1', category: 'Company Termination Fee', full_text: FEE_TEXT.replace('$6,900,000', '$6.9 million') },
    { id: 'p2', category: 'Tail Provision', full_text: 'completely different tail language about twelve month periods' },
  ];
  const m = matchCorrectionToProvision(correction, fresh);
  assert.equal(m.provision.id, 'p1');

  // Same correction against only dissimilar text with a different category: no match.
  const none = matchCorrectionToProvision(correction, [fresh[1]]);
  assert.equal(none, null);
});

test('match falls back to AFTER category when the user renamed it and the fresh run agrees', () => {
  const correction = {
    before: { category: 'Acquirer Expense Reimbursement', full_text: FEE_TEXT },
    after: { category: 'Fee Enforcement Costs', full_text: FEE_TEXT },
  };
  const fresh = [{ id: 'p1', category: 'Fee Enforcement Costs', full_text: FEE_TEXT }];
  assert.equal(matchCorrectionToProvision(correction, fresh).provision.id, 'p1');
});

test('planReapplication merges sequential corrections, latest field wins, reports unmatched', () => {
  const corrections = [
    {
      id: 'c1',
      before: { category: 'Company Termination Fee', full_text: FEE_TEXT, ai_favorability: 'neutral', features: {} },
      after: { category: 'Company Termination Fee', full_text: FEE_TEXT, ai_favorability: 'buyer-favorable', features: {} },
    },
    {
      id: 'c2',
      before: { category: 'Company Termination Fee', full_text: FEE_TEXT, ai_favorability: 'buyer-favorable', features: {} },
      after: { category: 'Company Termination Fee', full_text: FEE_TEXT, ai_favorability: 'seller-favorable', features: { note: 'checked' } },
    },
    {
      id: 'c3',
      before: { category: 'Ghost Provision', full_text: 'text that matches nothing in the fresh extraction at all' },
      after: { category: 'Ghost Provision', full_text: 'still matches nothing', ai_favorability: 'neutral' },
    },
  ];
  const fresh = [{ id: 'p1', category: 'Company Termination Fee', full_text: FEE_TEXT, ai_metadata: { features: {} } }];
  const { updates, unmatched } = planReapplication(corrections, fresh);
  assert.equal(updates.size, 1);
  const u = updates.get('p1');
  assert.equal(u.set.ai_favorability, 'seller-favorable'); // c2 wins over c1
  assert.deepEqual(u.featureSet, { note: 'checked' });
  assert.deepEqual(u.correctionIds, ['c1', 'c2']);
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].correction_id, 'c3');
});

// ---------------------------------------------------------------------------
// DATA-2 hardening: raised category-match floor (0.45), a runner-up margin
// (0.15), and a fragment re-check against before.full_text. Unmatched is the
// safe outcome -- callers preserve/surface it, never guess.
// ---------------------------------------------------------------------------

test('DATA-2: a confident, unambiguous match still works under the raised floor + margin + fragment guards', () => {
  const correction = { before: { category: 'Company Termination Fee', full_text: FEE_TEXT }, after: {} };
  const fresh = [
    { id: 'p1', category: 'Company Termination Fee', full_text: FEE_TEXT.replace('$6,900,000', '$6.9 million') },
    { id: 'p2', category: 'Tail Provision', full_text: 'completely different tail language about twelve month periods' },
  ];
  const m = matchCorrectionToProvision(correction, fresh);
  assert.equal(m.provision.id, 'p1');
});

test('DATA-2: an ambiguous near-tie between two textually-similar siblings in the same category is rejected (unmatched), not guessed', () => {
  const correction = { before: { category: 'Company Termination Fee', full_text: FEE_TEXT }, after: {} };
  const fresh = [
    {
      id: 'p1',
      category: 'Company Termination Fee',
      full_text: 'If the Company terminates this Agreement to enter a Superior Proposal prior to the Stockholder Vote, the Company shall pay Parent a termination fee of $6,900,000 in cash within two Business Days.',
    },
    {
      id: 'p2',
      category: 'Company Termination Fee',
      full_text: 'If the Company terminates this Agreement to enter a Superior Proposal after the No-Shop Period Start Date, the Company shall pay Parent a termination fee of $6,900,000 in cash within three Business Days.',
    },
  ];
  // Sanity: both siblings clear the (raised) category-match floor on their own --
  // the near-tie margin guard, not the floor, is what must reject this.
  const solo1 = matchCorrectionToProvision(correction, [fresh[0]]);
  const solo2 = matchCorrectionToProvision(correction, [fresh[1]]);
  assert.ok(solo1 && solo1.provision.id === 'p1');
  assert.ok(solo2 && solo2.provision.id === 'p2');

  assert.equal(matchCorrectionToProvision(correction, fresh), null);
});

test('DATA-2: a wrong-provision graft is prevented -- vocabulary-overlapping but substantively different sibling text fails the fragment re-check', () => {
  const correction = { before: { category: 'Company Termination Fee', full_text: FEE_TEXT }, after: {} };
  // Reuses much of the same vocabulary (pay/Company/Parent/termination/fee/
  // cash/Business/Days/Agreement) reordered around a different dollar figure
  // and a different trigger (breach, not a Superior Proposal) -- clears the
  // Jaccard category floor but shares no real contiguous text with `before`.
  const wrongSibling = {
    id: 'wrong',
    category: 'Company Termination Fee',
    full_text: 'Parent shall pay the Company a termination fee of $9,100,000 in cash within three Business Days if Parent terminates this Agreement following a material breach by Parent of its covenants.',
  };
  assert.equal(matchCorrectionToProvision(correction, [wrongSibling]), null);
});

test('a feature re-set after deletion is not deleted', () => {
  const corrections = [
    {
      id: 'c1',
      before: { category: 'X', full_text: FEE_TEXT, features: { k: 1 } },
      after: { category: 'X', full_text: FEE_TEXT, features: {} }, // deleted k
    },
    {
      id: 'c2',
      before: { category: 'X', full_text: FEE_TEXT, features: {} },
      after: { category: 'X', full_text: FEE_TEXT, features: { k: 2 } }, // re-added k
    },
  ];
  const fresh = [{ id: 'p1', category: 'X', full_text: FEE_TEXT, ai_metadata: { features: {} } }];
  const { updates } = planReapplication(corrections, fresh);
  const u = updates.get('p1');
  assert.deepEqual(u.featureSet, { k: 2 });
  assert.equal(u.featureDelete.has('k'), false);
});
