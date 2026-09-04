'use strict';

// Behavioural tests only, per CLAUDE.md: assertions on graph shape, field
// presence and derived output, never on lib/programme/*.js's source text,
// import list or pages/admin/programme.module.css's CSS literals.
//
// pages/admin/programme.js itself is ESM/JSX and cannot be `require()`-d by
// a bare `node --test` run (no babel-register in this repo's test script;
// confirmed directly -- requiring any existing JSX page file the same way
// throws "Unexpected token '<'"), so nothing here exercises the page module.
// It no longer has a local-only gate to test: Ben ruled on 2026-09-04
// (DECISIONS.md #27) that the page serves on Vercel previews and production,
// behind the same session auth middleware.js applies to every other route.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BASE_COMMIT,
  TASKS,
  MILESTONES,
  GATES,
  LATER_FEATURES,
  CONTROLS,
  OPEN_BEN_RULINGS,
} = require('../lib/programme/roadmap');

const {
  unresolvedDependencies,
  findCycle,
  topologicalOrder,
  parallelSets,
  currentPosition,
  nextExecutable,
  blockedBy,
  dateStatus,
  criticalPath,
  packageReleaseViolations,
} = require('../lib/programme/derive');

const TASK_IDS = new Set(TASKS.map((t) => t.id));
const STATUSES = new Set(['done', 'in_progress', 'blocked', 'not_started']);
const OWNERS = new Set(['lead', 'ext', 'ben', 'ci']);

test('every task id is unique', () => {
  assert.equal(TASK_IDS.size, TASKS.length);
});

test('every dependency id resolves', () => {
  const problems = unresolvedDependencies(TASKS);
  assert.deepEqual(problems, [], `unresolved dependencies: ${JSON.stringify(problems)}`);
});

test('the task graph has no cycles', () => {
  const cycle = findCycle(TASKS);
  assert.equal(cycle, null, `cycle found: ${JSON.stringify(cycle)}`);
});

test('topologicalOrder places every task exactly once, deps before dependents', () => {
  const order = topologicalOrder(TASKS);
  assert.equal(order.length, TASKS.length);
  assert.equal(new Set(order).size, TASKS.length);
  const position = new Map(order.map((id, i) => [id, i]));
  for (const task of TASKS) {
    for (const depId of task.dependsOn) {
      assert.ok(position.get(depId) < position.get(task.id), `${depId} should precede ${task.id}`);
    }
  }
});

test('every task has owner, status, estimate basis and evidence fields', () => {
  for (const task of TASKS) {
    assert.ok(OWNERS.has(task.owner), `${task.id}: owner "${task.owner}" is not one of lead/ext/ben/ci`);
    assert.ok(STATUSES.has(task.status), `${task.id}: status "${task.status}" is not recognised`);
    assert.ok(task.estimate && typeof task.estimate === 'object', `${task.id}: missing estimate`);
    // "estimate basis" is present either as the known-range basis string or
    // as the unknown-range reason -- dateStatus() below is the behavioural
    // check that exactly one of the two is set.
    assert.ok(
      typeof task.estimate.basis === 'string' || typeof task.estimate.unknownReason === 'string',
      `${task.id}: estimate has neither a basis nor an unknownReason`,
    );
    assert.ok(task.evidence && typeof task.evidence === 'string' && task.evidence.length > 0, `${task.id}: missing evidence`);
    assert.ok(Array.isArray(task.sources) && task.sources.length > 0, `${task.id}: missing source citations`);
  }
});

test('unknown dates are represented as null minDays/maxDays/basis with a reason', () => {
  let sawKnown = false;
  let sawUnknown = false;
  for (const task of TASKS) {
    const status = dateStatus(task);
    if (status.state === 'known') {
      sawKnown = true;
      assert.equal(task.estimate.unknownReason, null);
      assert.equal(typeof task.estimate.minDays, 'number');
      assert.equal(typeof task.estimate.maxDays, 'number');
      assert.ok(task.estimate.minDays <= task.estimate.maxDays);
    } else {
      sawUnknown = true;
      assert.equal(task.estimate.minDays, null);
      assert.equal(task.estimate.maxDays, null);
      assert.equal(task.estimate.basis, null);
      assert.ok(task.estimate.unknownReason.length > 0);
    }
  }
  // The dataset should honestly contain both: the first real run has a
  // documented range, everything after it does not.
  assert.ok(sawKnown, 'expected at least one task with a known estimate');
  assert.ok(sawUnknown, 'expected at least one task with an honestly unknown estimate');
});

test('dateStatus rejects a malformed estimate (both known and unknown, or neither)', () => {
  assert.throws(() => dateStatus({ id: 'x', estimate: { minDays: 1, maxDays: 2, basis: 'b', unknownReason: 'r' } }));
  assert.throws(() => dateStatus({ id: 'x', estimate: { minDays: null, maxDays: null, basis: null, unknownReason: null } }));
});

test('current position is exactly the in-progress task(s)', () => {
  const inProgress = TASKS.filter((t) => t.status === 'in_progress').map((t) => t.id).sort();
  assert.deepEqual(currentPosition(TASKS), inProgress);
  assert.deepEqual(inProgress, ['repair-phase0-authority']);
});

test('nextExecutable returns the expected set for the current data', () => {
  // Only tasks whose every dependency is done, and which are themselves
  // not_started, count. repair-phase0-authority is in_progress (its own
  // dependency, m7v2-replan-adopted, is done, but it is not "next" -- it is
  // current). Two tasks are genuinely ready right now: the quarantine PR
  // (Q9, already authorised, gated only on landing before the final merge)
  // and the deal-terms package-contract draft 2 (gated only on draft 1).
  assert.deepEqual(nextExecutable(TASKS), ['pkg-contract-draft2', 'quarantine-preview-path-pr']);
});

test('blockedBy explains an unmet dependency for a not-started task', () => {
  const info = blockedBy('repair-phase1-issue-only-run', TASKS);
  assert.equal(info.blocked, true);
  assert.deepEqual(info.unmetDependencies, ['repair-phase0-authority']);
});

test('blockedBy reports done/in-progress tasks as not blocked', () => {
  assert.equal(blockedBy('m0-m4-foundation', TASKS).blocked, false);
  assert.equal(blockedBy('repair-phase0-authority', TASKS).blocked, false);
});

test('a task waiting on Ben names an authority record or reason', () => {
  const waiting = TASKS.filter((t) => t.waitsOnBen);
  assert.ok(waiting.length > 0);
  for (const task of waiting) {
    assert.ok(
      task.authorityRecord || (task.benQuestions && task.benQuestions.length > 0) || task.blockedReason,
      `${task.id}: waitsOnBen is true but names no authority record, Ben question or reason`,
    );
  }
});

test('parallelSets groups tasks with no dependency edge between them at the same level', () => {
  const sets = parallelSets(TASKS);
  const level = new Map();
  for (const { level: lvl, taskIds } of sets) {
    for (const id of taskIds) level.set(id, lvl);
  }
  for (const task of TASKS) {
    for (const depId of task.dependsOn) {
      assert.ok(level.get(depId) < level.get(task.id), `${depId} (level ${level.get(depId)}) should be strictly before ${task.id} (level ${level.get(task.id)})`);
    }
  }
  // The documented Work 5 / Work 6 parallel opportunity (re-plan §10 node
  // 9 vs 10) must land in the same level.
  assert.equal(level.get('work5-packet-session3'), level.get('work6-rebind-rerun'));
  // The quarantine PR (independent of the repair phases) and Phase 0 both
  // depend only on the re-plan adoption, so they share a level too.
  assert.equal(level.get('quarantine-preview-path-pr'), level.get('repair-phase0-authority'));
});

test('criticalPath is a real dependency chain ending at the deepest task, truncated at the first unknown estimate', () => {
  const path = criticalPath(TASKS);
  assert.ok(path.taskIds.length > 10);
  const ids = new Map(TASKS.map((t) => [t.id, t]));
  for (let i = 1; i < path.taskIds.length; i += 1) {
    const task = ids.get(path.taskIds[i]);
    assert.ok(task.dependsOn.includes(path.taskIds[i - 1]), `${path.taskIds[i]} does not depend on ${path.taskIds[i - 1]}`);
  }
  // repair-phase1-issue-only-run is the last task on the critical path with
  // a known estimate; the plan is explicit that nothing after it is dated.
  assert.equal(path.truncatedAt, 'repair-phase2-extraction');
});

test('package milestones exist and order matches A-0002: one-deal after Phase 1 exit, five-deal after Phase 2, fifty-deal after the corpus extension', () => {
  const byId = new Map(MILESTONES.map((m) => [m.id, m]));
  assert.ok(byId.has('pkg-one-deal'));
  assert.ok(byId.has('pkg-five-deal-wiring'));
  assert.ok(byId.has('pkg-fifty-deal-proof'));

  assert.ok(byId.get('pkg-one-deal').dependsOn.includes('repair-phase1-issue-only-run'));
  assert.ok(byId.get('pkg-five-deal-wiring').dependsOn.includes('repair-phase2-extraction'));
  assert.ok(byId.get('pkg-fifty-deal-proof').dependsOn.includes('pkg-corpus-extension-fifty'));

  const order = topologicalOrder(TASKS);
  const pos = new Map(order.map((id, i) => [id, i]));
  assert.ok(pos.get('repair-phase1-issue-only-run') < pos.get('pkg-one-deal'));
  assert.ok(pos.get('pkg-one-deal') < pos.get('pkg-five-deal-wiring'));
  assert.ok(pos.get('repair-phase2-extraction') < pos.get('pkg-five-deal-wiring'));
  assert.ok(pos.get('pkg-five-deal-wiring') < pos.get('pkg-fifty-deal-proof'));
  assert.ok(pos.get('product-stage-6') < pos.get('pkg-fifty-deal-proof'));
});

test('package release states are never PUBLIC before the production gate', () => {
  for (const m of MILESTONES) {
    assert.notEqual(m.releaseState, 'PUBLIC', `${m.id} must not be PUBLIC in the current dataset (production has not run)`);
  }
  const violations = packageReleaseViolations(MILESTONES, TASKS);
  assert.deepEqual(violations, []);

  // A synthetic milestone claiming PUBLIC ahead of its gate must be caught.
  const fakeMilestones = [{ id: 'fake', releaseState: 'PUBLIC', publicRequires: 'product-stage-9' }];
  const fakeViolations = packageReleaseViolations(fakeMilestones, TASKS);
  assert.equal(fakeViolations.length, 1);
  assert.equal(fakeViolations[0].milestoneId, 'fake');
});

test('a review-only wiring package is never marked user-facing', () => {
  const wiringPackages = MILESTONES.filter((m) => m.title.toLowerCase().includes('wiring only'));
  assert.ok(wiringPackages.length >= 2);
  for (const m of wiringPackages) {
    assert.equal(m.userFacing, false, `${m.id} is described as wiring-only but userFacing is not false`);
    assert.notEqual(m.releaseState, 'PUBLIC');
  }
});

test('every gate appliesTo id resolves against TASKS', () => {
  for (const gate of GATES) {
    for (const taskId of gate.appliesTo) {
      assert.ok(TASK_IDS.has(taskId), `gate ${gate.id} applies to unknown task ${taskId}`);
    }
    assert.ok(gate.sources && gate.sources.length > 0, `gate ${gate.id} has no sources`);
  }
});

test('every later-feature entry and open Ben ruling has a source citation, and later features are not scheduled tasks', () => {
  for (const feature of LATER_FEATURES) {
    assert.ok(feature.sources && feature.sources.length > 0, `${feature.id} has no sources`);
    assert.equal(TASK_IDS.has(feature.id), false, `${feature.id} collides with a scheduled task id`);
  }
  for (const ruling of OPEN_BEN_RULINGS) {
    assert.ok(ruling.sources && ruling.sources.length > 0, `${ruling.id} has no sources`);
    if (ruling.relatedTask) assert.ok(TASK_IDS.has(ruling.relatedTask), `${ruling.id} points at unknown task ${ruling.relatedTask}`);
  }
});

test('every control names a source citation', () => {
  assert.ok(CONTROLS.length > 0);
  for (const control of CONTROLS) {
    assert.ok(control.sources && control.sources.length > 0, `${control.id} has no sources`);
  }
});

test('BASE_COMMIT is a full 40-character git SHA', () => {
  assert.match(BASE_COMMIT, /^[0-9a-f]{40}$/);
});
