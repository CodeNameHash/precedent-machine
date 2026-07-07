#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const DROPPED_FILE = 'docs/reprocess/moved-or-dropped-cleanup.md';
const DEFERRED_FILE = 'docs/reprocess/schema-deferred-waitlist.jsonl';
const ROUND_FILE = 'docs/reprocess/round-reconcil.md';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actionOf(entry) {
  return entry?.resolution?.action || entry?.action || null;
}

function targetKeys(entry) {
  return String(entry?.resolution?.targetCanonicalKey || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => (
    String(a.field_key || '').localeCompare(String(b.field_key || ''))
    || String(a.deal_id || '').localeCompare(String(b.deal_id || ''))
    || String(a.raw_value || '').localeCompare(String(b.raw_value || ''))
    || String(a.id || '').localeCompare(String(b.id || ''))
  ));
}

function exactTriples(triples, entry) {
  return triples.filter((triple) => (
    triple.deal_id === entry.deal_id
    && triple.field_key === entry.field_key
    && triple.raw_value === entry.raw_value
  ));
}

function targetTriples(triples, entry, keys = targetKeys(entry)) {
  const targets = new Set(keys);
  if (!targets.size) return [];
  return triples.filter((triple) => (
    triple.deal_id === entry.deal_id
    && triple.field_key === entry.field_key
    && triple.source_provision_id === entry.source_provision_id
    && targets.has(triple.canonicalKey)
  ));
}

function mergeReconciliationMetadata(triple, entry, origin = null) {
  triple.ai_metadata = triple.ai_metadata && typeof triple.ai_metadata === 'object' ? triple.ai_metadata : {};
  const previous = triple.ai_metadata.reconciliation && typeof triple.ai_metadata.reconciliation === 'object'
    ? triple.ai_metadata.reconciliation
    : {};
  const before = JSON.stringify(previous);
  const next = {
    ...previous,
    queue_entry_id: entry.id,
    action: actionOf(entry),
    targetCanonicalKey: entry.resolution?.targetCanonicalKey || null,
    resolved_at: entry.resolution?.resolved_at || null,
  };
  if (origin) next.origin = origin;
  triple.ai_metadata.reconciliation = next;
  return before !== JSON.stringify(next);
}

function applyMerge(normalized, entry) {
  const keys = targetKeys(entry);
  const target = keys[0] || null;
  const matches = exactTriples(normalized.triples || [], entry);
  let changed = 0;
  for (const triple of matches) {
    if (target && triple.canonicalKey !== target) {
      triple.canonicalKey = target;
      changed += 1;
    }
  }
  const fallback = matches.length ? [] : targetTriples(normalized.triples || [], entry, keys);
  return {
    outcome: matches.length ? 'reextracted' : (fallback.length ? 'already_reextracted' : 'not_found_after_prior_cleanup'),
    triple_count: matches.length || fallback.length,
    changed_count: changed,
  };
}

function applySplit(normalized, entry) {
  const matches = targetTriples(normalized.triples || [], entry);
  let changed = 0;
  for (const triple of matches) {
    if (mergeReconciliationMetadata(triple, entry, 'split')) changed += 1;
  }
  return {
    outcome: matches.length ? 'already_split_reextracted' : 'split_target_not_found',
    triple_count: matches.length,
    changed_count: changed,
  };
}

function classifyDeferred(entry) {
  if (entry.field_key === 'compensationItems') {
    return {
      waiting_on: 'employment_compensation_structured_object',
      target_wp: 'M3 residual schema review',
      reason: 'Needs item type, comparison group, standard, exceptions, and bundling fields before canonical coding.',
    };
  }
  if (/definition/i.test(`${entry.field_key} ${entry.resolution?.rationale || ''}`)) {
    return {
      waiting_on: 'Provision.kind = definition',
      target_wp: 'WP-M3-04',
      reason: 'Definition-like value needs definition provision modelling before reconciliation.',
    };
  }
  if (/provenance|source|quote|evidence/i.test(entry.resolution?.rationale || '')) {
    return {
      waiting_on: 'provenance bundle',
      target_wp: 'WP-M3-03',
      reason: 'Value needs richer provenance before safe reconciliation.',
    };
  }
  if (/instance|stable.*id|provision.*id/i.test(entry.resolution?.rationale || '')) {
    return {
      waiting_on: 'stable provision-instance ID',
      target_wp: 'WP-M3-01',
      reason: 'Value needs stable provision-instance identity before safe reconciliation.',
    };
  }
  return {
    waiting_on: 'unclassified',
    target_wp: 'M3 residual waitlist review',
    reason: 'No matching M3 schema dependency could be classified mechanically.',
  };
}

function dealList(entries) {
  return [...new Set(entries.map((entry) => entry.deal_id).filter(Boolean))].sort();
}

function escapeCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  ].join('\n');
}

function buildDroppedReport(entries) {
  const rows = sortEntries(entries).map((entry) => [
    entry.field_key,
    entry.raw_value,
    entry.resolution?.rationale || '',
    entry.deal_id,
    entry.resolution?.resolved_at || '',
  ]);
  return [
    '# Moved or dropped cleanup',
    '',
    'Generated by `scripts/reprocess/apply-reconciliation.js`.',
    '',
    `Total entries: ${entries.length}`,
    '',
    markdownTable(['field_key', 'raw_value', 'rationale', 'source deals', 'resolved_at'], rows),
    '',
  ].join('\n');
}

function buildDeferredWaitlist(entries) {
  return `${sortEntries(entries).map((entry) => {
    const classification = classifyDeferred(entry);
    return JSON.stringify({
      id: entry.id,
      field_key: entry.field_key,
      raw_value: entry.raw_value,
      deal_id: entry.deal_id,
      source_provision_id: entry.source_provision_id,
      source_excerpt: entry.source_excerpt,
      rationale: entry.resolution?.rationale || '',
      resolved_at: entry.resolution?.resolved_at || null,
      waiting_on: classification.waiting_on,
      target_wp: classification.target_wp,
      drain_status: 'Waiting',
      classification_reason: classification.reason,
    });
  }).join('\n')}\n`;
}

function buildRoundDoc(queueEntries, outcomes) {
  const counts = {};
  for (const outcome of outcomes) {
    counts[outcome.route] = (counts[outcome.route] || 0) + 1;
  }
  const rows = sortEntries(queueEntries).map((entry) => {
    const outcome = outcomes.find((item) => item.id === entry.id);
    return [
      entry.id,
      actionOf(entry),
      outcome?.route || '',
      outcome?.outcome || '',
      entry.field_key,
      entry.raw_value,
      entry.resolution?.targetCanonicalKey || '',
      entry.deal_id,
      entry.source_provision_id,
      entry.resolution?.resolved_at || '',
    ];
  });
  return [
    '# WP-M2-01 reconciliation round',
    '',
    'Generated by `scripts/reprocess/apply-reconciliation.js`.',
    '',
    '## Summary',
    '',
    markdownTable(
      ['route', 'count'],
      Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    '',
    `Reextract entries: ${counts.reextracted || 0}`,
    `Routed elsewhere: ${(counts.dropped_audited || 0) + (counts.deferred_waitlisted || 0)}`,
    `Source deals touched: ${dealList(queueEntries).length}`,
    '',
    '## Entries',
    '',
    markdownTable(['id', 'action', 'route', 'outcome', 'field_key', 'raw_value', 'targetCanonicalKey', 'deal_id', 'source_provision_id', 'resolved_at'], rows),
    '',
  ].join('\n');
}

function applyReconciliation(queue, normalized) {
  const nextNormalized = clone(normalized);
  const outcomes = [];
  const entries = queue.entries || [];

  for (const entry of entries) {
    const action = actionOf(entry);
    if (action === 'MERGE') {
      const result = applyMerge(nextNormalized, entry);
      outcomes.push({ id: entry.id, route: 'reextracted', ...result });
    } else if (action === 'SPLIT') {
      const result = applySplit(nextNormalized, entry);
      outcomes.push({ id: entry.id, route: 'reextracted', ...result });
    } else if (action === 'MOVED_OR_DROPPED') {
      outcomes.push({ id: entry.id, route: 'dropped_audited', outcome: 'moved_or_dropped_reported', triple_count: 0, changed_count: 0 });
    } else if (action === 'SCHEMA_DEFERRED') {
      outcomes.push({ id: entry.id, route: 'deferred_waitlisted', outcome: 'schema_deferred_waitlisted', triple_count: 0, changed_count: 0 });
    }
  }

  const dropped = entries.filter((entry) => actionOf(entry) === 'MOVED_OR_DROPPED');
  const deferred = entries.filter((entry) => actionOf(entry) === 'SCHEMA_DEFERRED');
  return {
    normalized: nextNormalized,
    files: {
      [DROPPED_FILE]: buildDroppedReport(dropped),
      [DEFERRED_FILE]: buildDeferredWaitlist(deferred),
      [ROUND_FILE]: buildRoundDoc(entries, outcomes),
    },
    outcomes,
  };
}

function summary(outcomes) {
  const routeCounts = {};
  let changedTriples = 0;
  let touchedTriples = 0;
  for (const outcome of outcomes) {
    routeCounts[outcome.route] = (routeCounts[outcome.route] || 0) + 1;
    changedTriples += outcome.changed_count || 0;
    touchedTriples += outcome.triple_count || 0;
  }
  return { routeCounts, touchedTriples, changedTriples };
}

function main() {
  const write = process.argv.includes('--write');
  const queue = readJson(QUEUE_FILE);
  const normalized = readJson(NORMALIZED_FILE);
  const result = applyReconciliation(queue, normalized);
  const stats = summary(result.outcomes);

  if (write) {
    writeFile(NORMALIZED_FILE, `${JSON.stringify(result.normalized, null, 2)}\n`);
    for (const [file, text] of Object.entries(result.files)) writeFile(file, text);
  }

  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = {
  applyReconciliation,
  classifyDeferred,
  summary,
  targetKeys,
};
