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
    item('p1', 'PROPOSAL', 'PENDING', { validation_status: 'VALID' }),
    item('p2', 'PROPOSAL', 'PENDING', { validation_status: 'VALID' }),
    item('p3', 'PROPOSAL', 'PENDING', { validation_status: 'VALID' }),
    item('n1', 'ISSUE', 'PENDING', { kind: 'NOTE', code: 'CONCLUSIONS_CELLS_DROPPED' }),
    item('d1', 'PROPOSAL', 'ACCEPTED', { validation_status: 'VALID' }),
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

test('a held proposal is rejected rather than accepted, because the server refuses an accepted invalid fact', () => {
  const state = reviewWith([
    { ...item('p-ok', 'PROPOSAL'), original: { validation_status: 'VALID' } },
    { ...item('p-held', 'PROPOSAL'), original: { validation_status: 'INVALID' } },
  ]).state;
  const commands = acceptanceCommands(state);
  assert.deepEqual(commands.map((command) => [command.item_id, command.decision]), [['p-ok', 'ACCEPTED'], ['p-held', 'REJECTED']]);
  // A model relationship is rejected for the same reason: ACCEPTED on one the
  // schema's type rules do not allow makes the save fail (finding (277)).
  const links = acceptanceCommands(reviewWith([
    { ...item('r1', 'RELATIONSHIP'), original: { relationship_type: 'QUALIFIES' } },
    { ...item('e1', 'EXCEPTION_LINK'), original: { relationship_type: 'EXCEPTS' } },
  ]).state);
  assert.deepEqual(links.map((command) => command.decision), ['REJECTED', 'REJECTED']);
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

test('publish stops at publication unless the caller holds the lawyer release payload', async () => {
  const seen = [];
  let version = 0;
  let persisted = reviewWith([]);
  const fetchJson = async (path, { body }) => {
    const command = body.command || body.commands[0];
    seen.push(command.type);
    version += 1;
    const state = { ...persisted.state };
    if (command.type === 'PUBLISH') state.status = 'PUBLISHED';
    if (command.type === 'EVALUATE_RELEASE') state.release_evaluation = { passed: true };
    if (command.type === 'ACTIVATE_RELEASE') state.active_release_id = `release-${version}`;
    if (command.type === 'CONFIRM_AGREEMENT_COVERAGE') state.agreement_coverage = { decision: 'ACCEPTED' };
    persisted = { ...reviewWith(state.items, version), status: state.status, state, active_release_id: state.active_release_id, release_evaluation: state.release_evaluation };
    return { status: 200, body: { review: persisted } };
  };
  // Without a release payload: coverage, publish, and a note that the
  // release steps need the lawyer.
  const published = await publishAndRelease({ fetchJson, runId: 'run-1', review: reviewWith([]) });
  assert.deepEqual(seen, ['CONFIRM_AGREEMENT_COVERAGE', 'PUBLISH']);
  assert.deepEqual(published.steps.map((step) => step.step), ['coverage', 'publish', 'release']);
  assert.equal(published.steps[2].status, 'NOT_TAKEN');
  assert.match(published.steps[2].note, /lawyer/);
  // With the payload, the steps run in order and the drill rolls back.
  seen.length = 0;
  const released = await publishAndRelease({
    fetchJson, runId: 'run-1', review: reviewWith([]),
    release: { evaluate: { reference_samples: [], lawyer_attestation: true, reference_samples_attestation: true }, activate: { release_id: 'release-x' }, drill: true },
  });
  assert.deepEqual(seen, ['CONFIRM_AGREEMENT_COVERAGE', 'PUBLISH', 'EVALUATE_RELEASE', 'ACTIVATE_RELEASE', 'ROLLBACK_RELEASE']);
  assert.deepEqual(released.steps.map((step) => step.step), ['coverage', 'publish', 'evaluate', 'activate', 'rollback']);
  assert.equal(released.steps[2].passed, true);
});

test('chunks never loses an item and a server refusal names its code', async () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  const fetchJson = async () => ({ status: 422, body: { error: 'REVIEW_PENDING_ITEMS', message: '1' } });
  await assert.rejects(() => acceptAll({ fetchJson, runId: 'r', review: reviewWith([item('p1', 'PROPOSAL')]) }), (error) => error.code === 'REVIEW_PENDING_ITEMS');
});

test('a server error is retried once with the same idempotency key, and a second failure is reported', async () => {
  const calls = [];
  const fetchJson = async (path, { body }) => {
    calls.push(body.idempotency_key);
    if (calls.length === 1) return { status: 500, body: { error: 'DATABASE_ERROR', message: 'schema cache' } };
    return { status: 200, body: { review: reviewWith([], 1) } };
  };
  const { postCommand } = require('../lib/product/review-driver');
  const review = await postCommand({ fetchJson, runId: 'r', version: 0, idempotencyKey: 'k-1', body: { command: { type: 'PUBLISH' } } });
  assert.equal(review.version, 1);
  assert.deepEqual(calls, ['k-1', 'k-1'], 'the same key on both attempts');
  // A second failure surfaces the message rather than a retry loop.
  const alwaysFails = async () => ({ status: 500, body: { error: 'DATABASE_ERROR', message: 'schema cache' } });
  await assert.rejects(() => postCommand({ fetchJson: alwaysFails, runId: 'r', version: 0, idempotencyKey: 'k-2', body: { command: { type: 'PUBLISH' } } }),
    (error) => error.code === 'DATABASE_ERROR' && /schema cache/.test(error.message));
});

test('a mismatch repair on a proposal with no roles rejects it rather than editing it', () => {
  const analysis = { proposition_groups: [{ proposition_group_id: 'g-wrong', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' }] };
  const state = reviewWith([{
    ...item('p-noroles', 'PROPOSAL'),
    original: { family_key: 'NO_SHOP', subtype_key: 'EXCEPTION_PREREQUISITE', proposition_group_id: 'g-wrong', statement: 'Legal fact.', roles: {} },
  }]).state;
  const repairs = groupMismatchRepairs(analysis, state);
  assert.deepEqual(repairs, [{ type: 'DECIDE_ITEM', item_id: 'p-noroles', decision: 'REJECTED' }]);
});
