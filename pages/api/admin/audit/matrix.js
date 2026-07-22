import fs from 'fs';
import { getServiceSupabase } from '../../../../lib/supabase.js';
import { getDisplayAcquirer, getDisplayTarget } from '../../../../lib/deal-display.js';

const { blockVercelRepositoryArtifactRoute } = require('../../../../lib/admin/repository-artifact-access');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const DEFAULT_COLUMN_LIMIT = 16;

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function queueIndex(queue) {
  return new Map((queue.entries || []).map((entry) => [`${entry.deal_id}|${entry.field_key}|${entry.raw_value}`, entry]));
}

function fieldColumns(triples, entries, limit = DEFAULT_COLUMN_LIMIT) {
  const labels = new Map((entries || []).map((entry) => [entry.key, entry.displayName || entry.key]));
  const counts = new Map();
  for (const triple of triples) counts.set(triple.field_key, (counts.get(triple.field_key) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => ({ key, label: labels.get(key) || key, required: false }));
}

function cellForTriples(triples, pendingQueue) {
  const canonical = triples.find((triple) => triple.canonicalKey) || triples[0];
  const pending = triples.some((triple) => {
    const entry = pendingQueue.get(`${triple.deal_id}|${triple.field_key}|${triple.raw_value}`);
    return entry && ['NEW', 'IN_REVIEW'].includes(entry.status);
  });
  return {
    status: pending ? 'red' : 'green',
    canonicalKey: canonical.canonicalKey,
    raw_value: canonical.raw_value,
    extractorRawValue: canonical.raw_value,
    sourceProvisionId: canonical.source_provision_id,
    source_provision_id: canonical.source_provision_id,
    section_anchor: null,
    evidence_quote: canonical.evidence_quote,
    source_excerpt: canonical.evidence_quote,
    value_count: triples.length,
  };
}

async function hydrateDealNames(dealIds) {
  const ids = [...new Set(dealIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = getServiceSupabase();
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from('deals')
    .select('id, metadata, target, acquirer')
    .in('id', ids);
  if (error || !data) return new Map();
  return new Map(data.map((row) => {
    const acq = getDisplayAcquirer(row);
    const tgt = getDisplayTarget(row);
    const label = acq && tgt ? `${acq} / ${tgt}` : (acq || tgt || row.id);
    return [row.id, label];
  }));
}

async function hydrateProvisionAnchors(provisionIds) {
  const ids = [...new Set(provisionIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const supabase = getServiceSupabase();
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from('provisions')
    .select('id, section_anchor, section_number')
    .in('id', ids);
  if (error || !data) return new Map();
  return new Map(data.map((row) => [row.id, row.section_anchor || row.section_number || null]));
}

export async function buildAuditMatrix({ deal_id: dealId, limit = DEFAULT_COLUMN_LIMIT } = {}) {
  const normalized = readJson(NORMALIZED_FILE, { entries: [], triples: [] });
  const queue = readJson(QUEUE_FILE, { entries: [] });
  const triples = (normalized.triples || []).filter((triple) => !dealId || triple.deal_id === dealId);
  const columns = fieldColumns(triples, normalized.entries, limit);
  const pendingQueue = queueIndex(queue);
  const grouped = new Map();
  for (const triple of triples) {
    const deal = grouped.get(triple.deal_id) || new Map();
    const field = deal.get(triple.field_key) || [];
    field.push(triple);
    deal.set(triple.field_key, field);
    grouped.set(triple.deal_id, deal);
  }
  const rows = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, fields]) => ({
    deal_id: id,
    deal_name: id,
    non_null_cells: columns.filter((column) => fields.has(column.key)).length,
    cells: Object.fromEntries(columns.map((column) => [
      column.key,
      fields.has(column.key) ? cellForTriples(fields.get(column.key), pendingQueue) : { status: 'empty' },
    ])),
  }));
  const provisionIds = [];
  for (const row of rows) {
    for (const cell of Object.values(row.cells || {})) {
      if (cell.sourceProvisionId) provisionIds.push(cell.sourceProvisionId);
    }
  }
  const [dealNames, provisionAnchors] = await Promise.all([
    hydrateDealNames(rows.map((row) => row.deal_id)),
    hydrateProvisionAnchors(provisionIds),
  ]);
  for (const row of rows) {
    row.deal_name = dealNames.get(row.deal_id) || row.deal_id;
    for (const cell of Object.values(row.cells || {})) {
      if (cell.sourceProvisionId) {
        cell.section_anchor = provisionAnchors.get(cell.sourceProvisionId) || null;
      }
    }
  }
  return { columns, rows, triple_count: triples.length };
}

export default async function handler(req, res) {
  if (blockVercelRepositoryArtifactRoute(res)) return;
  res.status(200).json(await buildAuditMatrix(req.query || {}));
}
