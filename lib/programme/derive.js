'use strict';

// Pure derivation functions over lib/programme/roadmap.js's task graph. No
// I/O, no module dependencies, no mutation of any argument. Every function
// takes the data it needs as an argument rather than importing roadmap.js
// itself, so it can be tested against fixtures independent of the live
// dataset and reused by both the page and its tests.

function byId(tasks) {
  const map = new Map();
  for (const task of tasks) map.set(task.id, task);
  return map;
}

// Returns the list of dependsOn references across `tasks` that do not
// resolve to another task in the same array, as { taskId, missingDepId }.
// Empty means every dependency id resolves.
function unresolvedDependencies(tasks) {
  const ids = byId(tasks);
  const problems = [];
  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (!ids.has(depId)) problems.push({ taskId: task.id, missingDepId: depId });
    }
  }
  return problems;
}

// Returns null if the graph is acyclic, or the list of task ids forming a
// cycle if not (a task id appears twice: once to open the cycle, once to
// close it).
function findCycle(tasks) {
  const ids = byId(tasks);
  const WHITE = 0; const GREY = 1; const BLACK = 2;
  const color = new Map(tasks.map((t) => [t.id, WHITE]));
  const stack = [];

  function visit(id) {
    color.set(id, GREY);
    stack.push(id);
    const task = ids.get(id);
    if (task) {
      for (const depId of task.dependsOn) {
        if (!ids.has(depId)) continue; // unresolved deps are reported separately
        const state = color.get(depId);
        if (state === GREY) {
          const cycleStart = stack.indexOf(depId);
          return [...stack.slice(cycleStart), depId];
        }
        if (state === WHITE) {
          const found = visit(depId);
          if (found) return found;
        }
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const task of tasks) {
    if (color.get(task.id) === WHITE) {
      const found = visit(task.id);
      if (found) return found;
    }
  }
  return null;
}

// Kahn's algorithm. Throws if the graph has a cycle or an unresolved
// dependency -- call unresolvedDependencies()/findCycle() first if you need
// to report those separately rather than fail fast.
function topologicalOrder(tasks) {
  const ids = byId(tasks);
  const indegree = new Map(tasks.map((t) => [t.id, 0]));
  const dependents = new Map(tasks.map((t) => [t.id, []]));

  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (!ids.has(depId)) throw new Error(`Unresolved dependency: ${task.id} -> ${depId}`);
      indegree.set(task.id, indegree.get(task.id) + 1);
      dependents.get(depId).push(task.id);
    }
  }

  const queue = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id).sort();
  const order = [];
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const dependentId of dependents.get(id)) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);
      if (indegree.get(dependentId) === 0) queue.push(dependentId);
    }
    queue.sort();
  }

  if (order.length !== tasks.length) throw new Error('Cycle detected: topological order could not include every task.');
  return order;
}

// Longest-path level from any root (a task with no unresolved dependency):
// level(t) = 0 if t.dependsOn is empty, else 1 + max(level(dep)) over
// t.dependsOn. Used both to report "what can run in parallel" (same level,
// no edge between them) and to lay out the flow diagram's columns.
function levels(tasks) {
  const ids = byId(tasks);
  const order = topologicalOrder(tasks);
  const level = new Map();
  for (const id of order) {
    const task = ids.get(id);
    if (task.dependsOn.length === 0) {
      level.set(id, 0);
    } else {
      level.set(id, 1 + Math.max(...task.dependsOn.map((depId) => level.get(depId))));
    }
  }
  return level;
}

// Tasks at the same level, grouped, for every level that has more than one
// task OR whose task set is worth surfacing. Returns [{ level, taskIds }],
// ordered by level ascending. This is the "what can happen in parallel"
// structural view: two tasks share a level only when neither depends on
// the other (transitively), because level is defined by longest path from
// a root.
function parallelSets(tasks) {
  const level = levels(tasks);
  const byLevel = new Map();
  for (const task of tasks) {
    const lvl = level.get(task.id);
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(task.id);
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lvl, taskIds]) => ({ level: lvl, taskIds: taskIds.sort() }));
}

// Tasks with status 'in_progress' -- the current position.
function currentPosition(tasks) {
  return tasks.filter((t) => t.status === 'in_progress').map((t) => t.id).sort();
}

// Tasks ready to start right now: status 'not_started' and every
// dependency's status is exactly 'done'. Does not include tasks already
// 'in_progress' (see currentPosition) or already 'done'.
function nextExecutable(tasks) {
  const ids = byId(tasks);
  return tasks
    .filter((t) => t.status === 'not_started')
    .filter((t) => t.dependsOn.every((depId) => ids.get(depId) && ids.get(depId).status === 'done'))
    .map((t) => t.id)
    .sort();
}

// For a single task, explains why it is not executable yet: the specific
// upstream task ids that are not 'done', plus whether it separately waits
// on Ben (waitsOnBen) or names an authority record not yet committed. A
// task already 'done' or 'in_progress' returns { blocked: false }.
function blockedBy(taskId, tasks) {
  const ids = byId(tasks);
  const task = ids.get(taskId);
  if (!task) throw new Error(`Unknown task id: ${taskId}`);
  if (task.status === 'done' || task.status === 'in_progress') return { blocked: false, unmetDependencies: [], waitsOnBen: false };
  const unmetDependencies = task.dependsOn.filter((depId) => !ids.has(depId) || ids.get(depId).status !== 'done');
  return {
    blocked: unmetDependencies.length > 0 || task.status === 'blocked',
    unmetDependencies,
    waitsOnBen: Boolean(task.waitsOnBen),
    authorityRecord: task.authorityRecord || null,
    reason: task.blockedReason || null,
  };
}

// 'known' when estimate.basis is set, 'unknown' (with task.estimate's
// reason) otherwise. Enforces the estimate invariant used throughout
// roadmap.js: exactly one of (minDays & maxDays & basis) or unknownReason
// is set, never both, never neither.
function dateStatus(task) {
  const e = task.estimate;
  const hasKnown = e.minDays !== null && e.maxDays !== null && e.basis !== null;
  const hasUnknown = e.unknownReason !== null && e.unknownReason !== undefined;
  if (hasKnown === hasUnknown) {
    throw new Error(`Task ${task.id}: estimate must be known (minDays/maxDays/basis) XOR unknown (unknownReason), never both or neither.`);
  }
  return hasKnown ? { state: 'known', minDays: e.minDays, maxDays: e.maxDays, basis: e.basis } : { state: 'unknown', reason: e.unknownReason };
}

// The longest dependency chain by hop count (structural critical path),
// with the cumulative known-day range summed only over the prefix of the
// chain whose estimates are known -- it does not fabricate a duration for
// work the documents do not estimate. `truncatedAt` names the first task
// on the path whose estimate is unknown, or null if every task on the
// path has a known estimate.
function criticalPath(tasks) {
  const level = levels(tasks);
  const ids = byId(tasks);
  let endId = null;
  let maxLevel = -1;
  for (const [id, lvl] of level.entries()) {
    if (lvl > maxLevel) { maxLevel = lvl; endId = id; }
  }
  // Walk backward from the deepest task, at each step following the
  // dependency with the highest level (i.e. the one that produced this
  // task's level), breaking ties alphabetically for determinism.
  const path = [];
  let cursor = endId;
  while (cursor) {
    path.unshift(cursor);
    const task = ids.get(cursor);
    if (task.dependsOn.length === 0) break;
    let best = null;
    let bestLevel = -1;
    for (const depId of [...task.dependsOn].sort()) {
      const depLevel = level.get(depId);
      if (depLevel > bestLevel) { bestLevel = depLevel; best = depId; }
    }
    cursor = best;
  }

  // Day-counting starts at the first not-done task on the path: completed
  // work needs no forward estimate, and mixing historical "no estimate was
  // recorded" tasks in with the live "unknown until the first real run"
  // ones would make the whole path look unknown from day one. Walk the
  // remaining (not-done) tasks in path order and stop at the first one
  // whose estimate is honestly unknown.
  const remainingTaskIds = path.filter((id) => ids.get(id).status !== 'done');
  let minDays = 0;
  let maxDays = 0;
  let truncatedAt = null;
  for (const id of remainingTaskIds) {
    const status = dateStatus(ids.get(id));
    if (status.state === 'unknown') { truncatedAt = id; break; }
    minDays += status.minDays;
    maxDays += status.maxDays;
  }

  return { taskIds: path, remainingTaskIds, knownMinDays: minDays, knownMaxDays: maxDays, truncatedAt };
}

// Validates the invariant tests/programme-roadmap.test.js checks for
// package milestones: a milestone's releaseState must never be 'PUBLIC'
// unless the task named by its publicRequires field is 'done'. Returns a
// list of violations (empty means the invariant holds).
function packageReleaseViolations(milestones, tasks) {
  const ids = byId(tasks);
  const violations = [];
  for (const m of milestones) {
    if (m.releaseState === 'PUBLIC') {
      const gate = m.publicRequires ? ids.get(m.publicRequires) : null;
      if (!gate || gate.status !== 'done') {
        violations.push({ milestoneId: m.id, reason: 'releaseState is PUBLIC but its publicRequires task is not done', publicRequires: m.publicRequires || null });
      }
    }
  }
  return violations;
}

// The page's local-only gate, factored out here so it is plain CommonJS
// and testable without a JSX/ESM transpiler (pages/admin/programme.js
// itself cannot be `require()`-d directly by node:test -- Next transpiles
// its `export`/JSX at build time; nothing does that for a bare `node --test`
// run). Returns { notFound: true } whenever process.env.VERCEL or
// process.env.VERCEL_ENV is set (any value, including 'preview') or
// NODE_ENV is exactly 'production'; returns null otherwise, meaning the
// page may render.
function localOnlyGate(env) {
  const e = env || {};
  if (e.VERCEL || e.VERCEL_ENV || e.NODE_ENV === 'production') return { notFound: true };
  return null;
}

module.exports = {
  unresolvedDependencies,
  findCycle,
  topologicalOrder,
  levels,
  parallelSets,
  currentPosition,
  nextExecutable,
  blockedBy,
  dateStatus,
  criticalPath,
  packageReleaseViolations,
  localOnlyGate,
};
