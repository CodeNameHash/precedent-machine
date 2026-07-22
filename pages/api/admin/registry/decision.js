import fs from 'fs/promises';
import path from 'path';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const STATE_FILE = path.join(process.cwd(), 'docs/market-registry/reviewer-state.json');
const VALID_DECISIONS = new Set(['approve', 'reject', 'merge', 'rename', 'defer']);

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      version: 'reviewer-state-v1',
      generated_from: 'docs/market-registry/generated-v1.deduped.json',
      decisions: {},
      updated_at: null,
    };
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function fail(res, status, error) {
  return res.status(status).json({ error });
}

export default async function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');

  const { key, decision, merge_into, rename_to, defer_to_phase } = req.body || {};
  if (!key || typeof key !== 'string') return fail(res, 400, 'missing_key');
  if (!VALID_DECISIONS.has(decision)) return fail(res, 400, 'invalid_decision');
  if (decision === 'merge' && !merge_into) return fail(res, 400, 'missing_merge_into');
  if (decision === 'rename' && !rename_to) return fail(res, 400, 'missing_rename_to');
  if (decision === 'defer' && !defer_to_phase) return fail(res, 400, 'missing_defer_to_phase');

  try {
    const state = await readState();
    const now = new Date().toISOString();
    state.decisions = state.decisions || {};
    state.decisions[key] = {
      key,
      decision,
      merge_into: merge_into || null,
      rename_to: rename_to || null,
      defer_to_phase: defer_to_phase || null,
      updated_at: now,
    };
    state.updated_at = now;
    await writeState(state);
    return res.status(200).json({ ok: true, state });
  } catch (error) {
    return fail(res, 500, error.message || 'decision_write_failed');
  }
}
