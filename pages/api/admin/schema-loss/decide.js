import fs from 'fs';
import path from 'path';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const REJECTIONS_FILE = 'docs/schema-shape/unmapped-rejections.jsonl';
const DECISIONS_FILE = 'docs/schema-shape/claim-integrity-decisions.jsonl';
const HANDOFFS_FILE = 'docs/learn/loss-audit-handoffs.jsonl';

const A_REJECTION_DECISIONS = new Set(['noise', 'defer']);
const A_HANDOFF_DECISIONS = new Set(['promote-attribute', 'promote-canonical', 'promote-rule', 'route-to-learn']);
const B_DECISION_DECISIONS = new Set(['confirm-correct', 'reassign-attribute', 'reassign-party', 'reassign-canonical', 'quarantine']);
const B_HANDOFF_DECISIONS = new Set(['extractor-bug']);

function assertWritableTarget(file) {
  const target = file.split(path.sep).join('/');
  if (/docs\/vocab\/FROZEN-.*\.json$/.test(target) || /docs\/market-registry\/FROZEN-.*\.json$/.test(target)) {
    throw new Error(`Refusing to write frozen schema file: ${file}`);
  }
}

function appendJsonl(file, row) {
  assertWritableTarget(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
}

function gateForDecision(decisionType) {
  if (decisionType === 'promote-attribute') return 'G-0A';
  if (decisionType === 'promote-canonical') return 'G-1/G-2/G-3/G-3a/G-4';
  return null;
}

export function routeDecision(input = {}) {
  const dimension = String(input.dimension || '').toUpperCase();
  const decisionType = String(input.decision_type || input.decisionType || '');
  if (dimension === 'A') {
    if (A_REJECTION_DECISIONS.has(decisionType)) return { file: REJECTIONS_FILE, effect: 'append-rejection' };
    if (A_HANDOFF_DECISIONS.has(decisionType)) {
      return { file: HANDOFFS_FILE, effect: 'append-handoff', gate_reopen: gateForDecision(decisionType) };
    }
  }
  if (dimension === 'B') {
    if (B_DECISION_DECISIONS.has(decisionType)) return { file: DECISIONS_FILE, effect: 'append-integrity-decision' };
    if (B_HANDOFF_DECISIONS.has(decisionType)) return { file: HANDOFFS_FILE, effect: 'append-handoff' };
  }
  throw new Error(`Unsupported schema-loss decision: ${dimension}:${decisionType}`);
}

export function buildDecisionRecord(input = {}) {
  const route = routeDecision(input);
  return {
    id: input.id || input.cluster_id || input.claim_hash || null,
    dimension: String(input.dimension || '').toUpperCase(),
    decision_type: input.decision_type || input.decisionType || null,
    payload: input.payload || {},
    route: route.effect,
    gate_reopen: route.gate_reopen || null,
    reviewer_status: 'RECORDED',
    decided_at: new Date().toISOString(),
  };
}

export default function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const route = routeDecision(req.body || {});
    const record = buildDecisionRecord(req.body || {});
    appendJsonl(route.file, record);
    return res.status(200).json({ ok: true, wrote: route.file, record });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
