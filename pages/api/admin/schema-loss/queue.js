import fs from 'fs';

const OBSERVATIONS_FILE = 'docs/schema-shape/unmapped-observations.json';
const WARNINGS_FILE = 'docs/schema-shape/claim-integrity-warnings.jsonl';
const DEFAULT_LIMIT = 100;

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export function readSchemaLossQueue(query = {}) {
  const dimension = String(query.dimension || 'A').toUpperCase();
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 500);
  const offset = clampInt(query.offset, 0, Number.MAX_SAFE_INTEGER);
  if (dimension === 'B') {
    const entries = readJsonl(WARNINGS_FILE);
    return {
      dimension: 'B',
      label: 'Suspect Claims',
      total: entries.length,
      offset,
      limit,
      entries: entries.slice(offset, offset + limit),
    };
  }
  const queue = readJson(OBSERVATIONS_FILE, { clusters: [] });
  const entries = queue.clusters || [];
  return {
    dimension: 'A',
    label: 'Uncovered text',
    total: entries.length,
    offset,
    limit,
    entries: entries.slice(offset, offset + limit),
    meta: queue.source || {},
    note: queue.note || null,
  };
}

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json(readSchemaLossQueue(req.query || {}));
}
