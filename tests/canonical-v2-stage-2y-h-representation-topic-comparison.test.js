'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const REPLAY_SCRIPT = path.join(ROOT, 'scripts/stage-2y-h-representation-topic-replay.mjs');
const COMPARE_SCRIPT = path.join(ROOT, 'scripts/stage-2y-h-representation-topic-compare.mjs');
const COMPARISON = path.join(ROOT, 'evidence/canonical-v2/stage-2y-h-representation-topic-comparison.json');

function identityKey(row) {
  return row.identity.closure_id || row.identity.claim_occurrence_id;
}

function outcome(value) {
  return {
    classification: value.state,
    topic: value.canonical_value,
    reason: value.reason,
  };
}

test('the governed comparison lists every changed replay row and proves authority stayed dark', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-h-comparison-test-'));
  const temporaryReplay = path.join(directory, 'replay.json');
  try {
    const replay = spawnSync(process.execPath, [REPLAY_SCRIPT, '--write-to', temporaryReplay], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(replay.status, 0, replay.stderr);
    const compare = spawnSync(process.execPath, [COMPARE_SCRIPT, '--check', temporaryReplay], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(compare.status, 0, compare.stderr);

    const report = JSON.parse(fs.readFileSync(COMPARISON, 'utf8'));
    const after = JSON.parse(fs.readFileSync(temporaryReplay, 'utf8'));
    const { readBaselineReplay } = await import(`${path.toNamespacedPath(COMPARE_SCRIPT)}?comparison=${Date.now()}`);
    const before = readBaselineReplay({ repoRoot: ROOT });
    const afterByIdentity = new Map(after.representation_rows.map((row) => [identityKey(row), row]));
    const independentlyChanged = before.representation_rows.filter((beforeRow) => {
      const afterRow = afterByIdentity.get(identityKey(beforeRow));
      assert.ok(afterRow);
      if (canonicalJson(outcome(beforeRow.classifier_result)) !== canonicalJson(outcome(afterRow.classifier_result))) return true;
      return beforeRow.rung_outcomes.some((rung, index) => (
        canonicalJson(outcome(rung)) !== canonicalJson(outcome(afterRow.rung_outcomes[index]))
      ));
    }).map(identityKey).sort();
    const reportedChanged = report.changed_rows.map(identityKey).sort();

    assert.equal(report.schema_version, 'STAGE_2Y_H_REPRESENTATION_TOPIC_COMPARISON/V1');
    assert.equal(report.changed_row_count, 155);
    assert.deepEqual(reportedChanged, independentlyChanged);
    assert.equal(report.changed_rows.every((row) => row.changed_rungs.length > 0), true);
    assert.deepEqual(report.resolution_collection, {
      unchanged: true,
      before_rows: 623,
      after_rows: 623,
      added_identity_count: 0,
      added_identities: [],
      removed_identity_count: 0,
      removed_identities: [],
      source_changed_identity_count: 0,
      source_changed_identities: [],
    });
    assert.equal(report.publication_authority.unchanged, true);
    assert.deepEqual(report.publication_authority.after, report.publication_authority.before);
    assert.deepEqual(report.publication_authority.after.publication, {
      model_calls: 0,
      publication_disposition: 'WITHHELD',
      serving_activated: false,
      writes_performed: false,
    });
    assert.deepEqual(report.publication_authority.after.activation, {
      blocker: 'ORDINARY_REVIEW_PENDING',
      eligible: false,
      human_ledger_decisions: 0,
    });
    assert.equal(report.aggregate_counts.before.final.classified_rows, 324);
    assert.equal(report.aggregate_counts.after.final.classified_rows, 336);
    assert.equal(report.aggregate_counts.delta.final.classified_rows, 12);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
