import fs from 'fs';

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const DEFAULT_LIMIT = 100;

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function normaliseStatus(value) {
  return String(value || 'NEW').toUpperCase();
}

function entryMatches(entry, query = {}) {
  if (query.status && normaliseStatus(entry.status) !== normaliseStatus(query.status)) return false;
  if (query.field_key && entry.field_key !== query.field_key) return false;
  if (query.q) {
    const needle = String(query.q).toLowerCase();
    const haystack = `${entry.field_key || ''} ${entry.raw_value || ''} ${entry.source_excerpt || ''}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

function groupEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.field_key}|${entry.raw_value}`;
    const group = groups.get(key) || {
      id: key,
      field_key: entry.field_key,
      raw_value: entry.raw_value,
      source_excerpt: entry.source_excerpt,
      similarity_candidates: entry.similarity_candidates || [],
      status: entry.status,
      count: 0,
      deal_count: 0,
      entry_ids: [],
      status_counts: {},
      deal_ids: new Set(),
    };
    group.count += 1;
    group.entry_ids.push(entry.id);
    group.status_counts[entry.status] = (group.status_counts[entry.status] || 0) + 1;
    group.deal_ids.add(entry.deal_id);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const { deal_ids: dealIds, ...rest } = group;
    return { ...rest, deal_count: dealIds.size };
  }).sort((a, b) => b.count - a.count || a.field_key.localeCompare(b.field_key) || a.raw_value.localeCompare(b.raw_value));
}

export function readQueueSlice(query = {}) {
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const filtered = (queue.entries || []).filter((entry) => entryMatches(entry, query));
  const grouped = query.group === 'raw_value' || query.group === 'true';
  const items = grouped ? groupEntries(filtered) : filtered;
  const offset = clampInt(query.offset, 0, items.length);
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 500);
  return {
    schema_version: queue.schema_version,
    total: items.length,
    entry_total: filtered.length,
    offset,
    limit,
    grouped,
    entries: items.slice(offset, offset + limit),
  };
}

export { groupEntries };

export default function handler(req, res) {
  return res.status(200).json(readQueueSlice(req.query || {}));
}
