#!/usr/bin/env node

const fs = require('fs');
const crypto = require('crypto');
const { rankCandidates } = require('../../lib/schema-shape/similarity');
const { readVocab } = require('../../lib/schema-shape/normalize-value');
const { vocabRefForField } = require('./migrate-to-triples');

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const WORKLOG_FILE = 'WORKLOG-P0-C.md';

function queueId(dealId, fieldKey, rawValue) {
  return crypto.createHash('sha256').update(`${dealId}|${fieldKey}|${rawValue}`).digest('hex').slice(0, 16);
}

function registryIndex(entries = []) {
  return new Map(entries.map((entry) => [entry.key, entry]));
}

function validCanonical(fieldKey, canonicalKey, registryEntry = null) {
  if (!canonicalKey) return false;
  const vocabRef = vocabRefForField(fieldKey);
  if (vocabRef) {
    const vocab = readVocab(vocabRef);
    return (vocab.values || []).some((value) => value.key === canonicalKey);
  }
  return (registryEntry?.enumValues || []).some((value) => value === canonicalKey);
}

function enumCandidates(rawValue, registryEntry) {
  return (registryEntry?.enumValues || []).map((value) => ({
    canonicalKey: value,
    string_score: value === rawValue ? 1 : 0,
    context_score: 0,
    prior_score: 0,
    total: value === rawValue ? 1 : 0,
  })).sort((a, b) => b.total - a.total || a.canonicalKey.localeCompare(b.canonicalKey)).slice(0, 3);
}

function candidatesFor(triple, registryEntry = null) {
  if (registryEntry?.enumValues?.length) return enumCandidates(triple.raw_value, registryEntry);
  const vocab = vocabRefForField(triple.field_key);
  return rankCandidates(triple.raw_value, { vocab, shape: triple.field_key })
    .slice(0, 3)
    .map((candidate) => ({
      canonicalKey: candidate.key,
      string_score: candidate.score.string,
      context_score: candidate.score.context,
      prior_score: candidate.score.priors,
      total: candidate.score.total,
    }));
}

function buildQueue(normalized) {
  const triples = normalized.triples || [];
  const registry = registryIndex(normalized.entries || []);
  const entries = [];
  for (const triple of triples) {
    const registryEntry = registry.get(triple.field_key);
    if (validCanonical(triple.field_key, triple.canonicalKey, registryEntry)) continue;
    entries.push({
      id: queueId(triple.deal_id, triple.field_key, triple.raw_value),
      raw_value: triple.raw_value,
      field_key: triple.field_key,
      deal_id: triple.deal_id,
      source_excerpt: triple.evidence_quote,
      source_provision_id: triple.source_provision_id,
      similarity_candidates: candidatesFor(triple, registryEntry),
      status: 'NEW',
    });
  }
  const deduped = new Map();
  for (const entry of entries) {
    if (!deduped.has(entry.id)) deduped.set(entry.id, entry);
  }
  return {
    schema_version: 1,
    entries: [...deduped.values()].sort((a, b) => (
      a.field_key.localeCompare(b.field_key)
      || a.deal_id.localeCompare(b.deal_id)
      || a.raw_value.localeCompare(b.raw_value)
    )),
  };
}

function appendWorklog(line) {
  const current = fs.existsSync(WORKLOG_FILE) ? fs.readFileSync(WORKLOG_FILE, 'utf8') : '# WORKLOG-P0-C\n';
  const next = current.includes(line) ? current : `${current.replace(/\s*$/, '')}\n\n${line}\n`;
  fs.writeFileSync(WORKLOG_FILE, next);
}

function main() {
  const normalized = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const queue = buildQueue(normalized);
  const triples = normalized.triples || [];
  const line = `RECONCILE_CORPUS: ${queue.entries.length} queue entries produced from ${triples.length} triples`;
  const output = `${JSON.stringify(queue, null, 2)}\n`;
  if (process.argv.includes('--write')) {
    fs.writeFileSync(QUEUE_FILE, output);
    appendWorklog(line);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildQueue,
  queueId,
  registryIndex,
  validCanonical,
};
