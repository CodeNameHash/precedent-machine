import fs from 'fs';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
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

function registryIndex(entries = []) {
  return new Map(entries.map((entry) => [entry.key, entry]));
}

function enumCandidates(entry, registry) {
  const enumValues = registry.get(entry.field_key)?.enumValues || [];
  if (!enumValues.length) return entry.similarity_candidates || [];
  return enumValues.map((canonicalKey) => ({
    canonicalKey,
    string_score: canonicalKey === entry.raw_value ? 1 : 0,
    context_score: 0,
    prior_score: 0,
    total: canonicalKey === entry.raw_value ? 1 : 0,
  }));
}

function hydrateCandidates(entries, registry) {
  return entries.map((entry) => ({
    ...entry,
    similarity_candidates: enumCandidates(entry, registry),
  }));
}

function groupRawEntries(entries) {
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
    return { ...rest, deal_count: dealIds.size, deal_ids: [...dealIds] };
  }).sort((a, b) => b.count - a.count || a.field_key.localeCompare(b.field_key) || a.raw_value.localeCompare(b.raw_value));
}

function groupFieldEntries(entries) {
  const rawGroups = groupRawEntries(entries);
  const groups = new Map();
  for (const rawGroup of rawGroups) {
    const group = groups.get(rawGroup.field_key) || {
      id: rawGroup.field_key,
      group_type: 'field_key',
      field_key: rawGroup.field_key,
      count: 0,
      deal_count: 0,
      raw_count: 0,
      raw_groups: [],
      deal_ids: new Set(),
    };
    group.count += rawGroup.count;
    group.raw_count += 1;
    group.raw_groups.push(rawGroup);
    for (const dealId of rawGroup.deal_ids || []) group.deal_ids.add(dealId);
    groups.set(rawGroup.field_key, group);
  }
  return [...groups.values()].map((group) => {
    const { deal_ids: dealIds, ...rest } = group;
    return { ...rest, deal_count: dealIds.size };
  }).sort((a, b) => a.field_key.localeCompare(b.field_key));
}

export function readQueueSlice(query = {}) {
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const normalized = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const registry = registryIndex(normalized.entries || []);
  const filtered = hydrateCandidates((queue.entries || []).filter((entry) => entryMatches(entry, query)), registry);
  const grouped = ['raw_value', 'field_key', 'true'].includes(String(query.group || ''));
  const items = query.group === 'field_key' ? groupFieldEntries(filtered) : (grouped ? groupRawEntries(filtered) : filtered);
  const offset = clampInt(query.offset, 0, items.length);
  const limit = clampInt(query.limit, DEFAULT_LIMIT, 500);
  return {
    schema_version: queue.schema_version,
    total: items.length,
    entry_total: filtered.length,
    offset,
    limit,
    grouped,
    group: query.group || null,
    entries: items.slice(offset, offset + limit),
  };
}

export { groupRawEntries as groupEntries, groupFieldEntries };

export default function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  return res.status(200).json(readQueueSlice(req.query || {}));
}
