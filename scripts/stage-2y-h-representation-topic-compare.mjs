#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const BASELINE_REPLAY_BLOB = '2be1832b3ea5c5d74c5ab0571bf4d690ca8de23d';
const BASELINE_REPLAY_PATH = 'evidence/canonical-v2/stage-2y-h-representation-topic-replay.json';
const COMPARISON_OUTPUT = 'evidence/canonical-v2/stage-2y-h-representation-topic-comparison.json';
const SCHEMA = 'STAGE_2Y_H_REPRESENTATION_TOPIC_COMPARISON/V1';

function fail(code, details = '') {
  const error = new Error(details ? `${code}:${details}` : code);
  error.code = code;
  throw error;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readBaselineReplay({ repoRoot = ROOT } = {}) {
  const raw = execFileSync('git', ['show', BASELINE_REPLAY_BLOB], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function identityKey(row) {
  return row.identity?.closure_id || row.identity?.claim_occurrence_id || null;
}

function outcome(value) {
  return Object.freeze({
    classification: value.state,
    topic: value.canonical_value,
    reason: value.reason,
  });
}

function sourceSnapshot(row) {
  return Object.freeze({
    run: row.run,
    deal: row.deal,
    family: row.family,
    section_reference: row.section_reference,
    subject: row.subject,
    raw_value_digest: row.raw_value_digest,
    identity: row.identity,
    evidence: row.evidence,
  });
}

function countsDelta(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return Object.fromEntries(keys.map((key) => [key, (after[key] || 0) - (before[key] || 0)]));
}

function aggregateSummary(ledger) {
  return Object.freeze({
    final: Object.freeze({
      total_rows: ledger.conservation.total_rows,
      classified_rows: ledger.conservation.classified_rows,
      unclassified_rows: ledger.conservation.unclassified_rows,
      per_topic: ledger.counts.per_code,
      unclassified_by_reason: ledger.counts.unclassified_by_reason,
    }),
    rungs: Object.freeze(ledger.rungs.map((rung) => Object.freeze({
      topic_rung: rung.topic_rung,
      classified_rows: rung.classified_rows,
      unclassified_rows: rung.unclassified_rows,
      per_topic: rung.per_code,
      unclassified_by_reason: rung.unclassified_by_reason,
    }))),
  });
}

function aggregateDelta(before, after) {
  return Object.freeze({
    final: Object.freeze({
      total_rows: after.final.total_rows - before.final.total_rows,
      classified_rows: after.final.classified_rows - before.final.classified_rows,
      unclassified_rows: after.final.unclassified_rows - before.final.unclassified_rows,
      per_topic: countsDelta(before.final.per_topic, after.final.per_topic),
      unclassified_by_reason: countsDelta(before.final.unclassified_by_reason, after.final.unclassified_by_reason),
    }),
    rungs: Object.freeze(after.rungs.map((rung, index) => Object.freeze({
      topic_rung: rung.topic_rung,
      classified_rows: rung.classified_rows - before.rungs[index].classified_rows,
      unclassified_rows: rung.unclassified_rows - before.rungs[index].unclassified_rows,
      per_topic: countsDelta(before.rungs[index].per_topic, rung.per_topic),
      unclassified_by_reason: countsDelta(before.rungs[index].unclassified_by_reason, rung.unclassified_by_reason),
    }))),
  });
}

function changedRows(beforeRows, afterRows) {
  const afterByIdentity = new Map(afterRows.map((row) => [identityKey(row), row]));
  return Object.freeze(beforeRows.flatMap((beforeRow) => {
    const id = identityKey(beforeRow);
    const afterRow = afterByIdentity.get(id);
    if (!afterRow) fail('RESOLUTION_COLLECTION_CHANGED', `removed:${id}`);
    const beforeFinal = outcome(beforeRow.classifier_result);
    const afterFinal = outcome(afterRow.classifier_result);
    const rungChanges = beforeRow.rung_outcomes.flatMap((beforeRung, index) => {
      const afterRung = afterRow.rung_outcomes[index];
      const beforeValue = outcome(beforeRung);
      const afterValue = outcome(afterRung);
      return canonicalJson(beforeValue) === canonicalJson(afterValue)
        ? []
        : [Object.freeze({ topic_rung: index, before: beforeValue, after: afterValue })];
    });
    if (canonicalJson(beforeFinal) === canonicalJson(afterFinal) && rungChanges.length === 0) return [];
    return [Object.freeze({
      identity: beforeRow.identity,
      run: beforeRow.run,
      deal: beforeRow.deal,
      section_reference: beforeRow.section_reference,
      subject: beforeRow.subject,
      raw_value_digest: beforeRow.raw_value_digest,
      final: Object.freeze({ before: beforeFinal, after: afterFinal }),
      changed_rungs: Object.freeze(rungChanges),
    })];
  }));
}

function buildRepresentationTopicComparison({ before, after }) {
  if (before?.schema_version !== 'STAGE_2Y_H_REPRESENTATION_TOPIC_REPLAY_LEDGER/V2'
    || after?.schema_version !== before.schema_version) fail('INVALID_REPLAY_INPUT');
  const beforeByIdentity = new Map(before.representation_rows.map((row) => [identityKey(row), row]));
  const afterByIdentity = new Map(after.representation_rows.map((row) => [identityKey(row), row]));
  if (beforeByIdentity.size !== before.representation_rows.length
    || afterByIdentity.size !== after.representation_rows.length) fail('DUPLICATE_RESOLUTION_IDENTITY');
  const added = [...afterByIdentity.keys()].filter((id) => !beforeByIdentity.has(id)).sort();
  const removed = [...beforeByIdentity.keys()].filter((id) => !afterByIdentity.has(id)).sort();
  const sourceChanged = [...beforeByIdentity].flatMap(([id, row]) => {
    const next = afterByIdentity.get(id);
    return next && canonicalJson(sourceSnapshot(row)) !== canonicalJson(sourceSnapshot(next)) ? [id] : [];
  }).sort();
  const resolutionCollectionUnchanged = added.length === 0 && removed.length === 0 && sourceChanged.length === 0;
  if (!resolutionCollectionUnchanged) fail('RESOLUTION_COLLECTION_CHANGED');

  const publicationUnchanged = canonicalJson(before.publication) === canonicalJson(after.publication)
    && canonicalJson(before.activation) === canonicalJson(after.activation);
  if (!publicationUnchanged) fail('PUBLICATION_AUTHORITY_CHANGED');
  if (after.publication.serving_activated !== false
    || after.publication.writes_performed !== false
    || after.publication.publication_disposition !== 'WITHHELD'
    || after.activation.eligible !== false) fail('PUBLICATION_AUTHORITY_NOT_DARK');

  const beforeAggregates = aggregateSummary(before);
  const afterAggregates = aggregateSummary(after);
  const changes = changedRows(before.representation_rows, after.representation_rows);
  const body = {
    schema_version: SCHEMA,
    comparison_mode: 'PRIOR_GOVERNED_PIN_TO_TEMPORARY_REPLAY',
    before_source: Object.freeze({ path: BASELINE_REPLAY_PATH, git_blob: BASELINE_REPLAY_BLOB, canonical_digest: sha256Hex(canonicalJson(before)) }),
    after_source: Object.freeze({ path: 'TEMPORARY_REPLAY', canonical_digest: sha256Hex(canonicalJson(after)) }),
    resolution_collection: Object.freeze({
      unchanged: resolutionCollectionUnchanged,
      before_rows: before.representation_rows.length,
      after_rows: after.representation_rows.length,
      added_identity_count: added.length,
      added_identities: Object.freeze(added),
      removed_identity_count: removed.length,
      removed_identities: Object.freeze(removed),
      source_changed_identity_count: sourceChanged.length,
      source_changed_identities: Object.freeze(sourceChanged),
    }),
    publication_authority: Object.freeze({
      unchanged: publicationUnchanged,
      before: Object.freeze({ publication: before.publication, activation: before.activation }),
      after: Object.freeze({ publication: after.publication, activation: after.activation }),
    }),
    aggregate_counts: Object.freeze({
      before: beforeAggregates,
      after: afterAggregates,
      delta: aggregateDelta(beforeAggregates, afterAggregates),
    }),
    changed_row_count: changes.length,
    changed_rows: changes,
  };
  return Object.freeze({ ...body, comparison_id: contentId(SCHEMA, body) });
}

function renderComparison(comparison) {
  return `${canonicalJson(comparison)}\n`;
}

function main() {
  const mode = process.argv[2];
  const afterPath = process.argv[3];
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 4) {
    throw new Error('usage: --write <temporary-replay-path> | --check <temporary-replay-path>');
  }
  const before = readBaselineReplay();
  const after = readJson(resolve(afterPath));
  const comparison = buildRepresentationTopicComparison({ before, after });
  const output = renderComparison(comparison);
  const path = resolve(ROOT, COMPARISON_OUTPUT);
  if (mode === '--write') writeFileSync(path, output);
  if (!existsSync(path) || readFileSync(path, 'utf8') !== output) fail('STALE_COMPARISON_OUTPUT');
  process.stdout.write(`changed rows: ${comparison.changed_row_count}; resolution collection unchanged: ${comparison.resolution_collection.unchanged}; publication authority unchanged: ${comparison.publication_authority.unchanged}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export {
  BASELINE_REPLAY_BLOB,
  COMPARISON_OUTPUT,
  SCHEMA,
  buildRepresentationTopicComparison,
  readBaselineReplay,
  renderComparison,
};
