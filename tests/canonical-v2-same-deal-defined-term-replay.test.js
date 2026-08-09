'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Stage 2Y-D replay records definition outcomes and candidate integration dispositions', async () => {
  const root = path.resolve(__dirname, '..');
  const script = path.join(root, 'scripts/stage-2y-d-defined-term-replay.mjs');
  const evidencePath = path.join(root, 'evidence/canonical-v2/stage-2y-d-defined-term-replay.json');
  const replayModule = await import(`file://${script}`);
  const before = fs.readFileSync(evidencePath, 'utf8');
  const replay = replayModule.buildReplay();
  assert.equal(`${JSON.stringify(replay, null, 2)}\n`, before, 'replay generation is deterministic');
  assert.equal(spawnSync(process.execPath, [script, '--write'], { cwd: root, encoding: 'utf8' }).status, 0);
  assert.equal(fs.readFileSync(evidencePath, 'utf8'), before, '--write is idempotent');
  assert.equal(spawnSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' }).status, 0);

  assert.equal(replay.ledger_rows.length, 91);
  assert.deepEqual(replay.counts_by_deal, { concho: 23, metsera: 21, redhat: 11, skechers: 14, skywater: 13, topbuild: 9 });
  assert.deepEqual(replay.counts_by_definition_outcome, { NO_DEFINITION: 21, RESOLVED: 70 });
  assert.deepEqual(replay.counts_by_integration_disposition, { RESOLVED: 80, REVIEW: 11 });
  assert.deepEqual(replay.counts_by_integration_reason, { NONE: 80, REPRESENTATION_KNOWLEDGE_STANDARD_CONFLICT: 11 });
  assert.deepEqual(replay.counts_by_resolver_replay_disposition, { RESOLVED: 80, REVIEW: 11 });
  assert.equal(replay.definition_evidence_gap_report.false_no_definition_count, 18);
  assert.deepEqual(replay.definition_evidence_gap_report.false_no_definition_by_deal, { skywater: 13, topbuild: 5 });
  assert.match(replay.definition_evidence_gap_report.source_proof_by_deal.skywater.quote,
    /with respect to Parent, the actual knowledge/);
  assert.match(replay.definition_evidence_gap_report.source_proof_by_deal.topbuild.quote,
    /with respect to Parent shall mean the actual knowledge[\s\S]*after due inquiry/);
  for (const proof of Object.values(replay.definition_evidence_gap_report.source_proof_by_deal)) {
    assert.match(proof.exact_bytes_digest, /^[0-9a-f]{64}$/);
    assert.ok(proof.document_byte_span.end > proof.document_byte_span.start);
  }
  assert.deepEqual(replay.definition_evidence_gap_report.expected_after_evidence_repair, {
    counts_by_definition_outcome: { NO_DEFINITION: 3, RESOLVED: 88 },
    counts_by_resolver_disposition: { RESOLVED: 75, REVIEW: 16 },
  });
  assert.equal(replay.true_fallbacks.length, 3);
  assert.ok(replay.true_fallbacks.every((row) => row.deal === 'skechers' && row.representation_side === 'BUYER'));
  assert.equal(replay.topbuild_buyer_no_definition_count, 5);

  for (const row of replay.ledger_rows) {
    assert.equal(row.resolver_replay.disposition, row.integration_disposition);
    assert.equal(row.resolver_replay.reason, row.integration_reason);
    assert.equal(row.resolver_replay.model_calls, 0);
  }

  const skechersConflicts = replay.ledger_rows.filter((row) => row.deal === 'skechers'
    && row.definition_outcome === 'RESOLVED'
    && row.effective_code === 'AFTER_INQUIRY'
    && row.current_model_code === 'ACTUAL');
  assert.equal(skechersConflicts.length, 11);
  for (const row of skechersConflicts) {
    assert.equal(row.integration_disposition, 'REVIEW');
    assert.equal(row.integration_reason, 'REPRESENTATION_KNOWLEDGE_STANDARD_CONFLICT');
    assert.equal(row.effective_code_source, 'SAME_DEAL_DEFINED_TERM');
  }
  const consistentDefinitions = replay.ledger_rows.filter((row) => row.definition_outcome === 'RESOLVED'
    && row.integration_disposition === 'RESOLVED');
  assert.equal(consistentDefinitions.length, 59);
  for (const row of consistentDefinitions) {
    assert.equal(row.integration_reason, null);
    assert.equal(row.effective_code_source, 'SAME_DEAL_DEFINED_TERM');
  }
  const noDefinitionFallbacks = replay.ledger_rows.filter((row) => row.definition_outcome === 'NO_DEFINITION');
  assert.equal(noDefinitionFallbacks.length, 21);
  for (const row of noDefinitionFallbacks) {
    assert.equal(row.integration_disposition, 'RESOLVED');
    assert.equal(row.integration_reason, null);
    assert.equal(row.effective_code_source, 'REGISTERED_CURRENT_MODEL_FALLBACK');
  }

  const sources = new Map();
  for (const name of Object.values(replay.selected_current_final_key_defined_term_runs)) {
    const adapter = JSON.parse(fs.readFileSync(path.join(root, 'evidence/canonical-v2', name, 'adapter-result.json'), 'utf8'));
    const source = adapter.admitted_source_contexts[0];
    sources.set(source.document_hash, source);
  }
  assert.equal(replayModule.assertReplayIntegrity(replay, sources), true, 'every use and selected definition span re-slices and re-hashes');

  const hostileSources = new Map(sources);
  const first = replay.ledger_rows[0];
  const hostileSource = structuredClone(sources.get(first.document_hash));
  const hostileBytes = Buffer.from(hostileSource.canonical_text.text, 'utf8');
  hostileBytes[first.use.document_byte_span.start] = 0x58;
  hostileSource.canonical_text.text = hostileBytes.toString('utf8');
  hostileSources.set(first.document_hash, hostileSource);
  assert.throws(() => replayModule.assertReplayIntegrity(replay, hostileSources), /use quote mismatch/);

  const wrongDocument = structuredClone(replay);
  wrongDocument.ledger_rows[0].document_hash = '0'.repeat(64);
  assert.throws(() => replayModule.assertReplayIntegrity(wrongDocument, sources), /unknown document/);

  const duplicate = structuredClone(replay);
  duplicate.ledger_rows[1] = structuredClone(duplicate.ledger_rows[0]);
  assert.throws(() => replayModule.assertReplayIntegrity(duplicate, sources), /duplicate use/);
});
