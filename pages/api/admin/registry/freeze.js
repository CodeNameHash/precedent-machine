import fs from 'fs/promises';
import path from 'path';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const REGISTRY_FILE = path.join(process.cwd(), 'docs/market-registry/generated-v1.deduped.json');
const STATE_FILE = path.join(process.cwd(), 'docs/market-registry/reviewer-state.json');
const FROZEN_FILE = path.join(process.cwd(), 'docs/market-registry/FROZEN-v1.json');

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function fail(res, status, error, detail) {
  return res.status(status).json({ error, ...(detail ? { detail } : {}) });
}

function frozenField(field, decision, frozenAt) {
  const base = {
    ...field,
    status: 'FROZEN-v1',
    frozen_at: frozenAt,
    reviewer_decision: decision,
  };
  delete base.review_flag;
  delete base.proposed_action;
  if (decision.decision === 'rename') {
    base.previous_key = field.key;
    base.key = decision.rename_to;
  }
  return base;
}

export default async function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');

  try {
    const registry = await readJson(REGISTRY_FILE);
    const state = await readJson(STATE_FILE);
    const decisions = state.decisions || {};
    const pending = registry.fields.filter((field) => !decisions[field.key]?.decision);
    if (pending.length) {
      return fail(res, 409, 'pending_reviewer_decisions', {
        count: pending.length,
        sample: pending.slice(0, 10).map((field) => field.key),
      });
    }

    const frozenAt = new Date().toISOString();
    const fields = [];
    const omitted = [];
    for (const field of registry.fields) {
      const decision = decisions[field.key];
      if (decision.decision === 'approve' || decision.decision === 'rename') {
        fields.push(frozenField(field, decision, frozenAt));
      } else {
        omitted.push({ key: field.key, decision: decision.decision, target: decision.merge_into || decision.defer_to_phase || null });
      }
    }

    const frozen = {
      version: 'FROZEN-v1',
      generated_from: 'docs/market-registry/generated-v1.deduped.json',
      frozen_at: frozenAt,
      input_field_count: registry.fields.length,
      field_count: fields.length,
      omitted,
      fields,
    };
    await fs.writeFile(FROZEN_FILE, `${JSON.stringify(frozen, null, 2)}\n`);
    return res.status(200).json({ ok: true, frozen_at: frozenAt, field_count: fields.length, omitted_count: omitted.length });
  } catch (error) {
    return fail(res, 500, error.message || 'freeze_failed');
  }
}
