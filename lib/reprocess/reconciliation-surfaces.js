const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.cwd();
const DROPPED_FILE = path.join(ROOT, 'docs/reprocess/moved-or-dropped-cleanup.md');
const DEFERRED_FILE = path.join(ROOT, 'docs/reprocess/schema-deferred-waitlist.jsonl');
const QUEUE_FILE = path.join(ROOT, 'docs/schema-shape/reconciliation-queue.json');

function stableId(parts) {
  return crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 16);
}

function splitMarkdownRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cell = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    const next = trimmed[index + 1];
    if (char === '\\' && next === '|') {
      cell += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function parseDroppedMarkdown(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| ') && !line.includes('| --- |') && !line.includes('| field_key |'))
    .map((line) => {
      const [fieldKey, rawValue, rationale, sourceDeals, resolvedAt] = splitMarkdownRow(line);
      return {
        id: stableId([fieldKey, rawValue, sourceDeals, resolvedAt]),
        field_key: fieldKey,
        raw_value: rawValue,
        rationale,
        source_deals: sourceDeals.split(',').map((deal) => deal.trim()).filter(Boolean),
        resolved_at: resolvedAt,
      };
    });
}

function readQueueIndex(queueFile = QUEUE_FILE) {
  const text = fs.readFileSync(queueFile, 'utf8');
  const parsed = JSON.parse(text);
  const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];
  const lineById = new Map();
  text.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/"id": "([^"]+)"/);
    if (match) lineById.set(match[1], index + 1);
  });
  const byId = new Map();
  const byTuple = new Map();
  for (const entry of entries) {
    const withLine = { ...entry, queue_line: lineById.get(entry.id) || null };
    byId.set(entry.id, withLine);
    byTuple.set(`${entry.field_key}\u0000${entry.raw_value}\u0000${entry.deal_id}`, withLine);
  }
  return { byId, byTuple };
}

function decorateRow(row, queueEntry) {
  return {
    ...row,
    queue_entry_id: queueEntry?.id || null,
    queue_line: queueEntry?.queue_line || null,
    queue_entry: queueEntry || null,
  };
}

function readDroppedRows(options = {}) {
  const droppedFile = options.droppedFile || DROPPED_FILE;
  const queueFile = options.queueFile || QUEUE_FILE;
  const queue = readQueueIndex(queueFile);
  return parseDroppedMarkdown(fs.readFileSync(droppedFile, 'utf8')).map((row) => {
    const dealId = row.source_deals[0] || '';
    const queueEntry = queue.byTuple.get(`${row.field_key}\u0000${row.raw_value}\u0000${dealId}`);
    return decorateRow(row, queueEntry);
  });
}

function readDeferredRows(options = {}) {
  const deferredFile = options.deferredFile || DEFERRED_FILE;
  const queueFile = options.queueFile || QUEUE_FILE;
  const queue = readQueueIndex(queueFile);
  return fs
    .readFileSync(deferredFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((row) => decorateRow({ ...row, source_deals: [row.deal_id].filter(Boolean) }, queue.byId.get(row.id)));
}

function groupDeferredRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.waiting_on || 'unassigned';
    if (!groups.has(key)) {
      groups.set(key, {
        waiting_on: key,
        count: 0,
        target_wp: row.target_wp || '',
        drain_status: row.drain_status || '',
        rows: [],
      });
    }
    const group = groups.get(key);
    group.count += 1;
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.waiting_on.localeCompare(b.waiting_on));
}

function csvEscape(value) {
  const string = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/[",\n\r]/.test(string)) return `"${string.replace(/"/g, '""')}"`;
  return string;
}

function toCsv(rows, columns) {
  return [
    columns.map((column) => csvEscape(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(',')),
  ].join('\n');
}

module.exports = {
  parseDroppedMarkdown,
  readDeferredRows,
  readDroppedRows,
  groupDeferredRows,
  toCsv,
};
