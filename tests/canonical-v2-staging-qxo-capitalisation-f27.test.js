const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const RUNNER =
  'scripts/canonical-v2-staging-qxo-capitalisation-f27.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('F27 offline attestation validates exact identities without database access', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--attest'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const attestation = JSON.parse(result.stdout);
  assert.equal(
    attestation.schema_version,
    'QXO_CAPITALISATION_OFFLINE_ATTESTATION_F27/V1',
  );
  assert.equal(
    attestation.execution_state,
    'NOT_EXECUTED_OFFLINE_ONLY',
  );
  assert.equal(
    attestation.source_binding,
    'UNIT_TEST_EXACT_TEXT_FIXTURE',
  );
  assert.match(attestation.source_context_id, /^[a-f0-9]{64}$/);
  assert.match(attestation.document_hash, /^[a-f0-9]{64}$/);
  assert.equal(attestation.project_ref, 'sjumbznveyyiizhwvixj');
  assert.equal(attestation.probe_records, 6);
  assert.equal(attestation.comparison_classes, 2);
  assert.equal(attestation.market_database_call_budget, 1);
  assert.equal(attestation.immediate_retries, 0);
  assert.equal(attestation.durable_candidate_writes, 0);
  assert.equal(attestation.active_pointer_writes, 0);
  assert.ok(attestation.probe_payload_bytes < 256 * 1024);
  assert.match(attestation.release_id, /^[a-f0-9]{64}$/);
  assert.match(attestation.release_manifest_id, /^[a-f0-9]{64}$/);
  assert.match(attestation.provision_row_id, /^[a-f0-9]{64}$/);
  assert.match(attestation.contract_fingerprint, /^[a-f0-9]{64}$/);
});

test('F27 staging proof is exact-project, bounded and rollback-only', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /CANONICAL_V2_VERTICAL_SLICE_EXECUTION/);
  assert.match(source, /ADMITTED_QXO_IMMUTABLE_SOURCE/);
  assert.match(
    source,
    /f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819/,
  );
  assert.match(
    source,
    /bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1/,
  );
  assert.match(source, /buildAdmittedSemanticSourceContext/);
  assert.match(source, /SET LOCAL lock_timeout='2000ms'/);
  assert.match(source, /SET LOCAL statement_timeout='15000ms'/);
  assert.match(source, /SAVEPOINT qxo_capitalisation_f27_probe_start/);
  assert.match(
    source,
    /ROLLBACK TO SAVEPOINT qxo_capitalisation_f27_probe_start/,
  );
  assert.match(source, /ROLLBACK;/);
  assert.match(source, /MAX_PROBE_RECORDS = 6/);
  assert.match(source, /MAX_PROBE_PAYLOAD_BYTES = 256 \* 1024/);
  assert.match(source, /MAX_RESULT_BYTES = 64 \* 1024/);
  assert.equal((source.match(/spawnSync\(/g) || []).length, 1);
  assert.match(source, /--agent=yes/);
  assert.match(source, /CANONICAL_V2_F27_FIXTURE_SUPABASE_EXECUTABLE/);
  assert.doesNotMatch(source, /setTimeout|retry|maximumAttempts/);
  assert.match(
    source,
    /failed without publishing database diagnostics/,
  );
  assert.doesNotMatch(source, /lines\.find|DETAIL\|HINT/);
  assert.doesNotMatch(
    source,
    /(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+)?canonical_v2_staging/i,
  );
});

test('one set-based probe insert and one class read preserve both legal classes', () => {
  assert.equal(
    (
      source.match(
        /INSERT INTO qxo_capitalisation_f27_probe/g,
      ) || []
    ).length,
    1,
  );
  assert.equal((source.match(/jsonb_to_recordset\(/g) || []).length, 1);
  assert.match(source, /SELECT jsonb_agg\(to_jsonb\(class_counts\)/);
  assert.match(source, /subject_market_observations/);
  assert.match(source, /independent_market_observations/);
  assert.match(source, /governed_deal_key<>/);
  assert.match(source, /CLAUSE_B_CLASS/);
  assert.match(source, /CLAUSE_C_CLASS/);
  assert.match(source, /classes were missing, reordered or aggregated/);
  assert.match(source, /active_pointer_unchanged/);
  assert.match(source, /candidate_counts_unchanged/);
  assert.match(source, /probe_rolled_back/);
});

test('database execution is closed before project or Supabase access', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CANONICAL_V2_VERTICAL_SLICE_EXECUTION: '',
    },
  });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Refusing database access until CANONICAL_V2_VERTICAL_SLICE_EXECUTION=APPROVED/,
  );
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stderr, /Supabase|password|token|secret/i);
});

test('staging verification accepts the pinned agent envelope and exact array shape', () => {
  const offline = spawnSync(process.execPath, [RUNNER, '--attest'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(offline.status, 0, offline.stderr);
  const identity = JSON.parse(offline.stdout);
  for (const outputShape of ['agent', 'array']) {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'f27-fake-supabase-'),
    );
    const executable = path.join(directory, 'supabase');
    const attestation = {
      schema_version: 'QXO_CAPITALISATION_STAGING_PROOF_F27/V1',
      project_ref: identity.project_ref,
      release_id: identity.release_id,
      release_manifest_id: identity.release_manifest_id,
      provision_row_id: identity.provision_row_id,
      contract_fingerprint: identity.contract_fingerprint,
      source_binding: identity.source_binding,
      source_context_id: identity.source_context_id,
      document_hash: identity.document_hash,
      probe_records: 6,
      comparison_classes: 2,
      set_based_insert_statements: 1,
      set_based_class_reads: 1,
      subject_exclusion_verified: true,
      active_pointer_unchanged: true,
      candidate_counts_unchanged: true,
      probe_rolled_back: true,
      durable_candidate_writes: 0,
      active_pointer_writes: 0,
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
            CANONICAL_V2_VERTICAL_SLICE_EXECUTION: 'APPROVED',
            CANONICAL_V2_F27_FIXTURE_SUPABASE_EXECUTABLE: executable,
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

test('fixture rollback refuses ambient or linked Supabase execution', () => {
  const result = spawnSync(
    process.execPath,
    [RUNNER, '--verify-fixture-rollback'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CANONICAL_V2_VERTICAL_SLICE_EXECUTION: 'APPROVED',
        CANONICAL_V2_F27_FIXTURE_SUPABASE_EXECUTABLE: '',
      },
    },
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Fixture rollback requires an absolute/,
  );
  assert.equal(result.stdout, '');
});

test('ambiguous invocation fails before database work', () => {
  const result = spawnSync(
    process.execPath,
    [RUNNER, '--attest', '--verify'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
