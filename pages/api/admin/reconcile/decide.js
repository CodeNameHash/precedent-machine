import fs from 'fs';

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const LOG_FILE = 'docs/schema-shape/reconciliation-log.jsonl';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function selectedEntries(entries, body) {
  if (Array.isArray(body.ids) && body.ids.length) {
    const ids = new Set(body.ids);
    return entries.filter((entry) => ids.has(entry.id));
  }
  if (body.field_key && Object.prototype.hasOwnProperty.call(body, 'raw_value')) {
    return entries.filter((entry) => entry.field_key === body.field_key && entry.raw_value === body.raw_value && entry.status !== 'RESOLVED');
  }
  if (body.id) return entries.filter((entry) => entry.id === body.id);
  return [];
}

function applyResolution(queue, normalized, body, now = new Date().toISOString()) {
  const nextQueue = clone(queue);
  const nextNormalized = clone(normalized);
  const entries = selectedEntries(nextQueue.entries || [], body);
  if (!entries.length) return { error: 'Queue entry not found' };
  const action = body.action || 'MERGE';
  const targetCanonicalKey = body.targetCanonicalKey || null;
  if (['MERGE', 'PROMOTE'].includes(action) && !targetCanonicalKey) {
    return { error: `${action} requires targetCanonicalKey` };
  }
  if (action === 'SPLIT') {
    return { error: 'SPLIT is not implemented yet; use Merge, Promote, or Freeform.' };
  }
  const touched = [];
  for (const entry of entries) {
    entry.status = 'RESOLVED';
    entry.resolution = {
      action,
      targetCanonicalKey,
      rationale: body.rationale || '',
      resolved_at: now,
    };
    touched.push(entry.id);
  }
  if (targetCanonicalKey) {
    const selectedKeys = new Set(entries.map((entry) => `${entry.deal_id}|${entry.field_key}|${entry.raw_value}`));
    for (const triple of nextNormalized.triples || []) {
      if (selectedKeys.has(`${triple.deal_id}|${triple.field_key}|${triple.raw_value}`)) {
        triple.canonicalKey = targetCanonicalKey;
      }
    }
  }
  const first = entries[0];
  const logRow = {
    id: `log-${Date.now()}`,
    action,
    field_key: first.field_key,
    raw_value: first.raw_value,
    targetCanonicalKey,
    rationale: body.rationale || '',
    touched,
    resolved_at: now,
  };
  return { nextQueue, nextNormalized, entries, logRow };
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.VERCEL) {
    return res.status(409).json({ error: 'Reconciliation writes must run locally so repo JSON artifacts can be committed.' });
  }
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const normalized = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const logBefore = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
  const prepared = applyResolution(queue, normalized, req.body);
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

export { applyResolution, selectedEntries };
