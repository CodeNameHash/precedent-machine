import fs from 'fs';

const { applyResolution, selectedEntries, resolveDecidedBy } = require('../../../../lib/schema-shape/reconcile-decide');
const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const LOG_FILE = 'docs/schema-shape/reconciliation-log.jsonl';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';

// Thin route wrapper — all decision logic (decided_by resolution,
// claim_ids[] linkage, registry_version bump) lives in
// lib/schema-shape/reconcile-decide.js so it can be unit-tested against
// fixtures without going through the Next.js build transform. See
// docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md §5 (WP-4 delta) and
// docs/schema-shape/README-reconciliation.md.
export default function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const normalized = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const logBefore = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
  const decidedBy = resolveDecidedBy(req.body, req.headers['x-editor-key']);
  const prepared = applyResolution(queue, normalized, req.body, new Date().toISOString(), decidedBy);
  if (prepared.error) return res.status(400).json({ error: prepared.error });
  if (req.body.failAfterPrepare) return res.status(500).json({ error: 'Injected failure before commit' });
  try {
    fs.writeFileSync(QUEUE_FILE, `${JSON.stringify(prepared.nextQueue, null, 2)}\n`);
    fs.writeFileSync(NORMALIZED_FILE, `${JSON.stringify(prepared.nextNormalized, null, 2)}\n`);
    fs.writeFileSync(LOG_FILE, `${logBefore}${JSON.stringify(prepared.logRow)}\n`);
  } catch (error) {
    fs.writeFileSync(QUEUE_FILE, `${JSON.stringify(queue, null, 2)}\n`);
    fs.writeFileSync(NORMALIZED_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
    fs.writeFileSync(LOG_FILE, logBefore);
    throw error;
  }
  return res.status(200).json({ entries: prepared.entries, log: prepared.logRow });
}

export { applyResolution, selectedEntries, resolveDecidedBy };
