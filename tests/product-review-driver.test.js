'use strict';

// Work package 50 (plan findings (276) and (277)): the driver that takes a
// review through its own HTTP boundary. The route's batch support is tested
// at the boundary in product-phase-3; here the driver's decisions are
// asserted against a fake server: every pending item is accepted exactly
// once, the version comes from each answer, a note is accepted like any
// other item, the group mismatch PUBLISH refuses on is repaired with an
// EDITED decision and no group, and the release steps are in order.

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  acceptanceCommands, groupMismatchRepairs, chunks, acceptAll, repairGroups, publishAndRelease,
} = require('../lib/product/review-driver');

function reviewWith(items, version = 0, extra = {}) {
  return { version, status: 'DRAFT', state: { items, agreement_coverage: { decision: 'PENDING' }, status: 'DRAFT' }, ...extra };
}

const item = (id, kind, decision = 'PENDING', original = {}) => ({ item_id: id, kind, decision, original, structure_node_id: 'n1' });

test('every pending item is accepted, notes included, in batches whose version comes from the answer', async () => {
  const items = [
    item('p1', 'PROPOSAL'), item('p2', 'PROPOSAL'), item('p3', 'PROPOSAL'),
    item('n1', 'ISSUE', 'PENDING', { kind: 'NOTE', code: 'CONCLUSIONS_CELLS_DROPPED' }),
    item('d1', 'PROPOSAL', 'ACCEPTED'),
  ];
  const calls = [];
  let version = 0;
  const fetchJson = async (path, { method, body }) => {
    calls.push({ path, method, body });
    assert.equal(body.expected_version, version);
    version += 1;
    const decided = (body.commands || [body.command]).filter((command) => command.type === 'DECIDE_ITEM').length;
    for (const command of body.commands || []) {
      const target = items.find((entry) => entry.item_id === command.item_id);
      if (target) target.decision = command.decision;
    }
    return { status: 200, body: { review: reviewWith(items, version) } };
  };
  const result = await acceptAll({ fetchJson, runId: 'run-1', review: reviewWith(items), batchSize: 2 });
  assert.equal(result.commands, 4, 'four pending items, one already decided');
  assert.equal(result.batches, 2, 'two saves for four decisions at a batch of two');
  assert.equal(result.review.version, 2);
  assert.ok(items.filter((entry) => entry.item_id !== 'd1').every((entry) => entry.decision === 'ACCEPTED'));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.body.commands.length), [2, 2]);
  assert.equal(calls[0].body.commands[0].item_id, 'p1');
});

test('a batch of decisions with a note included still counts the note', () => {
  const commands = acceptanceCommands(reviewWith([item('n1', 'ISSUE', 'PENDING', { kind: 'NOTE' })]).state);
  assert.equal(commands.length, 1, 'the loop empties the queue rather than leaving notes behind');
  const withoutNotes = acceptanceCommands(reviewWith([item('n1', 'ISSUE', 'PENDING', { kind: 'NOTE' })]).state, { includeNotes: false });
  assert.equal(withoutNotes.length, 0);
});

test('a proposal whose recorded group has another family is repaired with an edited decision and no group', () => {
  const analysis = {
    proposition_groups: [
      { proposition_group_id: 'g-ok', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' },
      { proposition_group_id: 'g-wrong', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' },
    ],
  };
  const state = reviewWith([
    { ...item('p-ok', 'PROPOSAL'), original: { family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', proposition_group_id: 'g-ok', statement: 'A fact.', roles: {} }, edited_statement: 'A fact.' },
    { ...item('p-wrong', 'PROPOSAL'), original: { family_key: 'NO_SHOP', subtype_key: 'EXCEPTION_PREREQUISITE', proposition_group_id: 'g-wrong', statement: 'Legal fact.', roles: { A: 'x' } } },
  ]).state;
  const repairs = groupMismatchRepairs(analysis, state);
  assert.equal(repairs.length, 1);
  assert.equal(repairs[0].item_id, 'p-wrong');
  assert.equal(repairs[0].decision, 'EDITED');
  assert.equal(repairs[0].proposition_group_id, null);
  assert.equal(repairs[0].statement, 'Legal fact.');
});

test('the release steps run in order and the drill rolls back and activates again', async () => {
  const seen = [];
  let version = 0;
  let persisted = reviewWith([]);
  const fetchJson = async (path, { body }) => {
    const command = body.command || body.commands[0];
    seen.push(command.type);
    version += 1;
    const state = { ...persisted.state };
    if (command.type === 'PUBLISH') state.status = 'PUBLISHED';
    if (command.type === 'ACTIVATE_RELEASE') state.active_release_id = `release-${version}`;
    if (command.type === 'CONFIRM_AGREEMENT_COVERAGE') state.agreement_coverage = { decision: 'ACCEPTED' };
    persisted = { ...reviewWith(state.items, version), status: state.status, state, active_release_id: state.active_release_id };
    return { status: 200, body: { review: persisted } };
  };
  const result = await publishAndRelease({ fetchJson, runId: 'run-1', review: reviewWith([]), drill: true });
  assert.deepEqual(seen, ['CONFIRM_AGREEMENT_COVERAGE', 'PUBLISH', 'EVALUATE_RELEASE', 'ACTIVATE_RELEASE', 'ROLLBACK_RELEASE', 'ACTIVATE_RELEASE']);
  assert.deepEqual(result.steps.map((step) => step.step), ['coverage', 'publish', 'evaluate', 'activate', 'rollback', 'activate again']);
  assert.equal(result.review.status, 'PUBLISHED');
});

test('chunks never loses an item and a server refusal names its code', async () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  const fetchJson = async () => ({ status: 422, body: { error: 'REVIEW_PENDING_ITEMS', message: '1' } });
  await assert.rejects(() => acceptAll({ fetchJson, runId: 'r', review: reviewWith([item('p1', 'PROPOSAL')]) }), (error) => error.code === 'REVIEW_PENDING_ITEMS');
});
