import fs from 'fs';

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const DEFAULT_LIMIT = 100;

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export function readQueueSlice(query = {}) {
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const entries = queue.entries || [];
  const offset = clampInt(query.offset, 0, entries.length);
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 500);
  return {
    schema_version: queue.schema_version,
    total: entries.length,
    offset,
    limit,
    entries: entries.slice(offset, offset + limit),
  };
}

export default function handler(req, res) {
  return res.status(200).json(readQueueSlice(req.query || {}));
}
