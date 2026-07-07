import fs from 'fs';
import { buildAuditMatrix } from './matrix';

const STATE_FILE = 'docs/schema-shape/audit-state.json';
const MARKER_FILE = 'docs/schema-shape/phase-0-C.frozen';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const METSERA_DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function freezePreconditions() {
  const failures = [];
  const normalized = readJson(NORMALIZED_FILE, { triples: [] });
  const queue = readJson(QUEUE_FILE, { entries: [] });
  const triples = normalized.triples || [];
  const openQueue = (queue.entries || []).filter((entry) => ['NEW', 'IN_REVIEW'].includes(entry.status));
  const matrix = buildAuditMatrix({ deal_id: METSERA_DEAL_ID });
  const metsera = matrix.rows[0];
  const cells = metsera ? Object.values(metsera.cells || {}).filter((cell) => cell.status !== 'empty') : [];
  if (!triples.length) failures.push('normalized-v1.json has no triples');
  if (openQueue.length) failures.push(`${openQueue.length} reconciliation queue entries remain NEW/IN_REVIEW`);
  if (!metsera) failures.push('Metsera audit matrix row is missing');
  if (metsera && cells.length < 5) failures.push(`Metsera audit matrix has only ${cells.length} populated cells`);
  if (metsera && !cells.some((cell) => String(cell.evidence_quote || cell.source_excerpt || '').length > 20)) {
    failures.push('Metsera audit matrix has no evidence quote over 20 characters');
  }
  return { ok: failures.length === 0, failures };
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const unresolved = (state.decisions || []).filter((decision) => decision.status === 'red' && !decision.resolution);
  if (unresolved.length) return res.status(409).json({ error: 'Unresolved red cells', unresolved });
  const preconditions = freezePreconditions();
  if (!preconditions.ok) {
    return res.status(409).json({ error: 'Phase 0-C freeze preconditions failed', failures: preconditions.failures });
  }
  fs.writeFileSync(MARKER_FILE, `frozen_at=${new Date().toISOString()}\n`);
  return res.status(200).json({ ok: true, marker: MARKER_FILE });
}

export { freezePreconditions };
