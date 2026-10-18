'use strict';

// An in-memory store for the hosted worker sandbox pool (plan finding
// (140)): the same assignment rule the database function implements
// (lib/product/sandbox-pool.js decideSandboxAssignment) over rows kept in
// memory, so the run route, the wake and the read paths are tested with no
// database and no sandbox. `runs` maps run_id to a run record whose status
// the rule reads; tests change a status to end a run's ownership.
const { decideSandboxAssignment } = require('../../lib/product/sandbox-pool');

function createFakeSandboxStore({ runs = new Map(), analysis = (runId) => ({ run_id: runId }) } = {}) {
  const rows = new Map();
  const calls = { assign: [], release: [] };
  const assignments = () => [...rows.values()].map((row) => ({ ...row, run_status: runs.get(row.run_id)?.status ?? null }));
  const now = () => new Date().toISOString();
  return {
    rows, runs, calls,
    async assertAccess() {},
    async getRun(runId) { return runs.get(runId) || null; },
    async getAgreementAnalysis(runId) { return analysis(runId); },
    async assignRunSandbox({ runId, pool }) {
      calls.assign.push({ runId, pool });
      const run = runs.get(runId);
      if (!run) throw new Error('analysis run not found');
      const decision = decideSandboxAssignment({ runId, runStatus: run.status, pool, assignments: assignments() });
      for (const released of decision.releases) {
        const row = rows.get(released);
        rows.set(released, { ...row, released_at: now(), release_reason: runs.get(released).status });
      }
      if (decision.state === 'ASSIGNED') rows.set(runId, { run_id: runId, sandbox_name: decision.sandbox_name, assigned_at: now(), released_at: null, release_reason: null });
      return { run_id: runId, state: decision.state, sandbox_name: decision.sandbox_name, releases: decision.releases, sandboxes: decision.sandboxes };
    },
    async releaseRunSandbox({ runId, reason }) {
      calls.release.push({ runId, reason });
      const row = rows.get(runId);
      if (!row || row.released_at) return { run_id: runId, released: false, sandbox_name: null };
      rows.set(runId, { ...row, released_at: now(), release_reason: reason });
      return { run_id: runId, released: true, sandbox_name: row.sandbox_name };
    },
    async getRunSandbox(runId) { return rows.get(runId) || null; },
    async listLiveRunSandboxes() { return [...rows.values()].filter((row) => !row.released_at); },
  };
}

module.exports = { createFakeSandboxStore };
