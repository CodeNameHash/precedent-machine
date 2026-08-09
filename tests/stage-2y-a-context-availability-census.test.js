'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = path.resolve(root, 'scripts/stage-2y-a-context-availability-census.mjs');

test('Stage 2Y-A source fallback joins an open-world claim_definition_key', async () => {
  const { selectSourceCandidate } = await import(script);
  const claim = Object.freeze({
    claim_definition_key: 'OPEN_WORLD_PROPOSITION',
    raw_value: 'exact sole-remedy residual quote',
  });
  const selected = selectSourceCandidate({
    claim_definition_key: 'OPEN_WORLD_PROPOSITION',
    raw_value: 'exact sole-remedy residual quote',
  }, [Object.freeze({ candidate: Object.freeze({ claim }) })]);
  assert.equal(selected.status, 'UNIQUE');
  assert.equal(selected.route, 'EXACT_GENERIC_KEY_AND_RAW_VALUE');
  assert.strictEqual(selected.claim, claim);
});

test('Stage 2Y-A context census is current and read-only', () => {
  const run = spawnSync(process.execPath, [script, '--check'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  });
  assert.equal(run.status, 0, run.stderr);
});

test('Stage 2Y-A census records typed context outcomes and structural host context only', async () => {
  const { buildCensus } = await import(script);
  const census = buildCensus({ root });
  assert.deepEqual(census.mode, {
    model_calls: 0,
    product_writes: false,
    artifact_write_only: true,
    serving: false,
    classification_or_disposition_changes: false,
  });
  assert.equal(census.corpus.selected_final_runs, 157);
  assert.equal(census.corpus.loaded_runs, 157);
  assert.equal(census.corpus.unavailable_runs.length, 0);

  const fragment = census.fragment_structural_census;
  assert.equal(fragment.historical_surface_fragment_exclusions, 756);
  assert.equal(fragment.records.length, 756);
  assert.equal(fragment.resolved_with_chapeau, 628);
  assert.equal(fragment.structural_host_context_available, 575);
  assert.equal(fragment.candidate_host_binding_performed, false);
  assert.deepEqual(fragment.context_undetermined_reasons, {
    OPEN_WORLD_ROW_AMBIGUOUS: 44,
    SAME_STYLE_CHAIN: 11,
    SPAN_CROSSES_LEAVES: 41,
  });
  for (const record of [...census.targeted_records, ...fragment.records]) {
    assert.ok(['RESOLVED', 'UNDETERMINED'].includes(record.context.status));
    if (record.context.status === 'RESOLVED') {
      assert.equal(typeof record.context.exact_operational_span.start_byte, 'number');
      assert.equal(typeof record.context.exact_operational_span.end_byte, 'number');
      assert.match(record.context.exact_operational_span.exact_bytes_digest, /^[a-f0-9]{64}$/);
    } else assert.equal(typeof record.context.reason, 'string');
  }
});

test('Stage 2Y-A census rejects missing, repeated, combined, and unknown CLI modes', () => {
  for (const args of [[], ['--write', '--check'], ['--check', '--check'], ['--unknown']]) {
    const run = spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    });
    assert.notEqual(run.status, 0, args.join(' ') || 'no arguments');
    assert.match(run.stderr, /REQUIRES_EXACTLY_ONE_MODE/);
  }
});
