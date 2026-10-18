'use strict';

// The pool of named hosted worker sandboxes (implementer D, plan finding
// (140)): Olaplex and Apogee run at the same time on the subscription, each
// run on its own sandbox. One sandbox runs one worker at a time (the
// launcher's flock, per sandbox), so a run owns one sandbox from its first
// wake until it is READY or FAILED: a wake for a run that owns a sandbox
// goes to that sandbox; a wake for a run without one takes a free sandbox,
// or fails as PRODUCT_SANDBOX_POOL_BUSY naming the runs that hold the pool.
//
// The rule is written once here, as a pure decision, and implemented
// atomically in the database by product_sandbox_assign (migration
// 20261018200000_product_run_sandboxes.sql): the store calls the function;
// tests on fakes use the decision; the database test holds both to the
// same cases. Nothing here talks to Vercel.

// The one constant: how many sandboxes the pool has. The first keeps the
// name every earlier wake used; the others are numbered from 2.
const SANDBOX_POOL_SIZE = 2;
const SANDBOX_POOL_BASE_NAME = 'pm-codex-preview-worker';
const SANDBOX_NAME_PATTERN = /^pm-codex-preview-worker(-[1-9][0-9]*)?$/;

// Statuses at which a run's ownership of its sandbox ends.
const ENDED_RUN_STATUSES = Object.freeze(['READY', 'FAILED']);

function sandboxPoolNames(size = SANDBOX_POOL_SIZE) {
  if (!Number.isInteger(size) || size < 1) throw new TypeError('the pool needs at least one sandbox');
  return Object.freeze(Array.from({ length: size }, (_, index) => (index === 0 ? SANDBOX_POOL_BASE_NAME : `${SANDBOX_POOL_BASE_NAME}-${index + 1}`)));
}

function isSandboxPoolName(name, pool = sandboxPoolNames()) {
  return typeof name === 'string' && SANDBOX_NAME_PATTERN.test(name) && pool.includes(name);
}

function runEnded(status) {
  return ENDED_RUN_STATUSES.includes(status);
}

// The assignment decision for one wake. `assignments` are the rows of
// product_run_sandboxes joined to their run's status:
//   { run_id, sandbox_name, assigned_at, released_at, run_status }
// Returns { state, sandbox_name, releases, sandboxes }:
//   state     KEPT      the run already owns a live sandbox: use it
//             ASSIGNED  a free sandbox was taken for the run
//             BUSY      every sandbox is owned by another live run
//             RUN_ENDED the run is READY or FAILED and takes no sandbox
//   releases  the run ids whose live assignment ends now (their run is
//             READY or FAILED); the database function releases them in
//             the same transaction
//   sandboxes the pool after the decision, one entry per name, with the
//             run that holds it (null when free)
function decideSandboxAssignment({ runId, runStatus, pool = sandboxPoolNames(), assignments = [] }) {
  if (typeof runId !== 'string' || !runId) throw new TypeError('runId is required');
  if (!Array.isArray(pool) || pool.length === 0) throw new TypeError('pool is required');
  const live = assignments.filter((row) => row && row.released_at == null);
  const releases = live.filter((row) => runEnded(row.run_status)).map((row) => row.run_id);
  const holding = live.filter((row) => !releases.includes(row.run_id));
  const occupancy = (extra = null) => pool.map((name) => {
    const holder = (extra && extra.sandbox_name === name ? extra : null) || holding.find((row) => row.sandbox_name === name) || null;
    return { sandbox_name: name, run_id: holder ? holder.run_id : null, run_status: holder ? holder.run_status : null, assigned_at: holder ? holder.assigned_at ?? null : null };
  });
  if (runEnded(runStatus)) return { state: 'RUN_ENDED', sandbox_name: null, releases, sandboxes: occupancy() };
  const own = holding.find((row) => row.run_id === runId);
  if (own) return { state: 'KEPT', sandbox_name: own.sandbox_name, releases, sandboxes: occupancy() };
  const free = pool.find((name) => !holding.some((row) => row.sandbox_name === name));
  if (free) return { state: 'ASSIGNED', sandbox_name: free, releases, sandboxes: occupancy({ sandbox_name: free, run_id: runId, run_status: runStatus, assigned_at: null }) };
  return { state: 'BUSY', sandbox_name: null, releases, sandboxes: occupancy() };
}

function describeOccupancy(sandboxes = []) {
  return sandboxes.map((entry) => (entry.run_id ? `${entry.sandbox_name}: run ${entry.run_id} ${entry.run_status || ''}`.trim() : `${entry.sandbox_name}: free`)).join('; ');
}

function poolBusyError(assignment) {
  const error = new Error(`PRODUCT_SANDBOX_POOL_BUSY: every worker sandbox is held by a live run (${describeOccupancy(assignment.sandboxes)}); wake again when one is READY or FAILED`);
  error.code = 'PRODUCT_SANDBOX_POOL_BUSY';
  error.sandboxes = assignment.sandboxes;
  return error;
}

// The store's atomic assignment for a wake, or the one-sandbox answer for a
// store without the pool (the fakes of earlier tests). BUSY is thrown as
// PRODUCT_SANDBOX_POOL_BUSY so the run route can answer with the code.
async function assignSandboxForRun({ store, runId, pool = sandboxPoolNames() }) {
  if (!store || typeof store.assignRunSandbox !== 'function') {
    return { state: 'UNPOOLED', sandbox_name: pool[0], releases: [], sandboxes: [] };
  }
  const assignment = await store.assignRunSandbox({ runId, pool: [...pool] });
  if (!assignment || typeof assignment !== 'object' || !assignment.state) throw new Error('PRODUCT_SANDBOX_ASSIGNMENT_INVALID');
  if (assignment.state === 'BUSY') throw poolBusyError(assignment);
  return assignment;
}

// A read before the migration is applied (the table missing from the
// database or PostgREST's schema cache) reads as no placement, so the
// status poll and the preview keep working; the wake path still fails
// loudly on the missing function. Said once per process.
let missingTableSaid = false;
function isMissingSandboxTable(error) {
  const message = String(error?.message || '');
  return /product_run_sandboxes/.test(message) && /find the table|does not exist|schema cache|42P01|PGRST205/i.test(message);
}

// The sandbox a run is on now, for the read paths: the live row of
// product_run_sandboxes, or null; a store without the pool reads null.
async function runSandbox(store, runId) {
  if (!store || typeof store.getRunSandbox !== 'function') return null;
  let row;
  try {
    row = await store.getRunSandbox(runId);
  } catch (error) {
    if (!isMissingSandboxTable(error)) throw error;
    if (!missingTableSaid) {
      missingTableSaid = true;
      console.warn('[sandbox-pool] product_run_sandboxes is not in the database yet: apply supabase/migrations/20261018200000_product_run_sandboxes.sql');
    }
    return null;
  }
  if (!row) return null;
  return {
    sandbox_name: row.sandbox_name,
    assigned_at: row.assigned_at ?? null,
    released_at: row.released_at ?? null,
    release_reason: row.release_reason ?? null,
    live: row.released_at == null,
  };
}

module.exports = {
  ENDED_RUN_STATUSES,
  SANDBOX_NAME_PATTERN,
  SANDBOX_POOL_BASE_NAME,
  SANDBOX_POOL_SIZE,
  assignSandboxForRun,
  decideSandboxAssignment,
  describeOccupancy,
  isMissingSandboxTable,
  isSandboxPoolName,
  poolBusyError,
  runSandbox,
  sandboxPoolNames,
};
