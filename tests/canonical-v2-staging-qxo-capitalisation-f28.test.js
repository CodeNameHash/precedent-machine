const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  requireVerticalSliceExecutionPermission,
} = require('../lib/programme-gates/vertical-slice-permission');

const RUNNER =
  'scripts/canonical-v2-staging-qxo-capitalisation-f28.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

function offlineAttestation() {
  const result = spawnSync(process.execPath, [RUNNER, '--attest'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('F28 offline attestation binds all fourteen market metrics', () => {
  const attestation = offlineAttestation();
  assert.equal(
    attestation.schema_version,
    'QXO_CAPITALISATION_OFFLINE_ATTESTATION_F28/V1',
  );
  assert.equal(attestation.execution_state, 'NOT_EXECUTED_OFFLINE_ONLY');
  assert.equal(attestation.source_binding, 'UNIT_TEST_EXACT_TEXT_FIXTURE');
  assert.equal(attestation.project_ref, 'sjumbznveyyiizhwvixj');
  assert.equal(attestation.probe_records, 30);
  assert.ok(attestation.probe_payload_bytes < 1024 * 1024);
  assert.equal(attestation.metric_slots, 14);
  assert.equal(attestation.metric_admissions, 14);
  assert.equal(attestation.market_observations, 13);
  assert.equal(attestation.typed_slot_exclusions, 1);
  assert.equal(attestation.market_database_call_budget, 1);
  assert.equal(attestation.immediate_retries, 0);
  assert.equal(attestation.durable_candidate_writes, 0);
  assert.equal(attestation.active_pointer_writes, 0);
  for (const key of [
    'source_context_id',
    'document_hash',
    'release_id',
    'release_manifest_id',
    'provision_row_id',
    'candidate_envelope_id',
    'writer_link_receipt_id',
    'canonical_writer_receipt_id',
    'product_adapter_receipt_id',
    'product_surfaces_id',
    'product_query_result_identity',
    'reviewed_graph_payload_digest',
  ]) {
    assert.match(attestation[key], /^[a-f0-9]{64}$/);
  }
});

test('F28 proof is exact-project, signed-permission and rollback-only', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /verifyFetchedPublication/);
  assert.match(source, /requireVerticalSliceExecutionPermission/);
  assert.match(source, /ADMITTED_QXO_IMMUTABLE_SOURCE/);
  assert.match(source, /buildAdmittedSemanticSourceContext/);
  assert.match(source, /SET LOCAL lock_timeout='2000ms'/);
  assert.match(source, /SET LOCAL statement_timeout='15000ms'/);
  assert.match(source, /SAVEPOINT qxo_capitalisation_f28_probe_start/);
  assert.match(
    source,
    /ROLLBACK TO SAVEPOINT qxo_capitalisation_f28_probe_start/,
  );
  assert.match(source, /ROLLBACK;/);
  assert.match(source, /MAX_PROBE_RECORDS = 30/);
  assert.match(source, /MAX_PROBE_PAYLOAD_BYTES = 1024 \* 1024/);
  assert.match(source, /MAX_RESULT_BYTES = 128 \* 1024/);
  assert.match(source, /--agent=yes/);
  assert.doesNotMatch(source, /setTimeout|retry|maximumAttempts/);
  assert.doesNotMatch(
    source,
    /(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+)?canonical_v2_staging/i,
  );
});

test('one probe insert and one set-based metric read cover all slots', () => {
  assert.equal(
    (
      source.match(/INSERT INTO qxo_capitalisation_f28_probe/g) || []
    ).length,
    1,
  );
  assert.equal((source.match(/jsonb_to_recordset\(/g) || []).length, 1);
  assert.match(
    source,
    /SELECT jsonb_agg\(to_jsonb\(metric_counts\) ORDER BY display_ordinal\)/,
  );
  assert.match(source, /subject_market_observations/);
  assert.match(source, /subject_slot_exclusions/);
  assert.match(source, /independent_market_observations/);
  assert.match(source, /governed_deal_key<>/);
  assert.match(source, /metric slots were missing, reordered or aggregated/);
  assert.match(source, /active_pointer_unchanged/);
  assert.match(source, /candidate_counts_unchanged/);
  assert.match(source, /probe_rolled_back/);
});

test('production-like execution requires the protected signed gate', () => {
  const verified = {
    result: 'PASS',
    origin_main_commit: 'a'.repeat(40),
    publication_commit: 'b'.repeat(40),
    generation: 45,
    gate_states: {
      P1_CONTRACT_FREEZE_ATTESTED: 'OPEN',
    },
    work_classes: {
      vertical_slice_execution: 'OPEN',
    },
  };
  assert.throws(
    () => requireVerticalSliceExecutionPermission(verified),
    (error) => error.code === 'VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED',
  );
  verified.gate_states.P1_CONTRACT_FREEZE_ATTESTED = 'PASS';
  verified.work_classes.vertical_slice_execution = 'PASS';
  assert.equal(
    requireVerticalSliceExecutionPermission(verified)
      .vertical_slice_execution,
    'PASS',
  );
  assert.doesNotMatch(
    source,
    /CANONICAL_V2_VERTICAL_SLICE_EXECUTION/,
  );
});

test('fixture rollback accepts only one exact bounded attestation', () => {
  const identity = offlineAttestation();
  for (const outputShape of ['agent', 'array']) {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'f28-fake-supabase-'),
    );
    const executable = path.join(directory, 'supabase');
    const attestation = {
      schema_version: 'QXO_CAPITALISATION_STAGING_PROOF_F28/V1',
      project_ref: identity.project_ref,
      release_id: identity.release_id,
      release_manifest_id: identity.release_manifest_id,
      provision_row_id: identity.provision_row_id,
      candidate_envelope_id: identity.candidate_envelope_id,
      writer_receipt_id: identity.canonical_writer_receipt_id,
      product_adapter_receipt_id: identity.product_adapter_receipt_id,
      product_surfaces_id: identity.product_surfaces_id,
      product_query_result_identity:
        identity.product_query_result_identity,
      reviewed_graph_payload_digest:
        identity.reviewed_graph_payload_digest,
      source_binding: identity.source_binding,
      source_context_id: identity.source_context_id,
      document_hash: identity.document_hash,
      programme_status_generation: 1,
      programme_status_main_commit: '0'.repeat(40),
      programme_status_publication_commit: '1'.repeat(40),
      vertical_slice_execution: 'PASS',
      probe_records: 30,
      metric_slots: 14,
      writer_calls: 1,
      probe_insert_statements: 1,
      set_based_metric_reads: 1,
      subject_exclusion_verified: true,
      active_pointer_unchanged: true,
      candidate_counts_unchanged: true,
      probe_rolled_back: true,
      durable_candidate_writes: 0,
      active_pointer_writes: 0,
      database_calls_per_market_request: 1,
      immediate_retries: 0,
    };
    const rows = [{ attestation }];
    const output = outputShape === 'agent' ? { rows } : rows;
    fs.writeFileSync(
      executable,
      '#!/usr/bin/env node\n'
        + `process.stdout.write(${JSON.stringify(JSON.stringify(output))});\n`,
      { mode: 0o700 },
    );
    try {
      const result = spawnSync(
        process.execPath,
        [RUNNER, '--verify-fixture-rollback'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            CANONICAL_V2_F28_FIXTURE_SUPABASE_EXECUTABLE: executable,
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), attestation);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('fixture mode refuses ambient Supabase and ambiguous invocation', () => {
  const missing = spawnSync(
    process.execPath,
    [RUNNER, '--verify-fixture-rollback'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CANONICAL_V2_F28_FIXTURE_SUPABASE_EXECUTABLE: '',
      },
    },
  );
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Fixture rollback requires an absolute/);
  assert.equal(missing.stdout, '');

  const ambiguous = spawnSync(
    process.execPath,
    [RUNNER, '--attest', '--verify'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /Usage:/);
  assert.equal(ambiguous.stdout, '');
});
