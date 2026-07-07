import fs from 'fs';

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const LOG_FILE = 'docs/schema-shape/reconciliation-log.jsonl';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const normalized = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const logBefore = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
  const nextQueue = clone(queue);
  const nextNormalized = clone(normalized);
  const entry = nextQueue.entries.find((item) => item.id === req.body.id);
  if (!entry) return res.status(404).json({ error: 'Queue entry not found' });
  if (req.body.failAfterPrepare) return res.status(500).json({ error: 'Injected failure before commit' });
  entry.status = 'RESOLVED';
  entry.resolution = { action: req.body.action, targetCanonicalKey: req.body.targetCanonicalKey || null, rationale: req.body.rationale };
  const logRow = {
    id: `log-${Date.now()}`,
    action: req.body.action || 'MERGE',
    rawValue: entry.rawValue,
    targetCanonicalKey: req.body.targetCanonicalKey || null,
    rationale: req.body.rationale || '',
    touched: entry.occurrences || [],
  };
  try {
    fs.writeFileSync(QUEUE_FILE, `${JSON.stringify(nextQueue, null, 2)}\n`);
    fs.writeFileSync(NORMALIZED_FILE, `${JSON.stringify(nextNormalized, null, 2)}\n`);
    fs.writeFileSync(LOG_FILE, `${logBefore}${JSON.stringify(logRow)}\n`);
  } catch (error) {
    fs.writeFileSync(QUEUE_FILE, `${JSON.stringify(queue, null, 2)}\n`);
    fs.writeFileSync(NORMALIZED_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
    fs.writeFileSync(LOG_FILE, logBefore);
    throw error;
  }
  return res.status(200).json({ entry, log: logRow });
}
