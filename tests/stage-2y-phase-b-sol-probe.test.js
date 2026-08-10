const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

async function load() { return import(path.join(ROOT, 'scripts/stage-2y-phase-b-sol-probe.mjs')); }

test('lead probe names GPT-5.6 Sol and keeps provider and effort constant', async () => {
  const { PROFILE, initial, check } = await load();
  assert.deepEqual(PROFILE, {
    provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION', profile_id: 'SOL_MEDIUM', model: 'gpt-5.6-sol',
    reasoning_effort: 'medium', requested_model_id: 'gpt-5.6-sol;reasoning=medium;profile=SOL_MEDIUM',
  });
  const artifact = initial();
  assert.equal(artifact.expected_call_count, 46);
  assert.equal(artifact.call_manifest.length, 46);
  assert.equal(artifact.publication_authorisation, 'NONE');
  assert.equal(artifact.serving_activated, false);
  assert.deepEqual(artifact.cohort.exact_composition, { CLOSING_CONDITIONS: 26, FINANCING_COVENANTS: 8, PROXY_MEETING: 12 });
  assert.deepEqual(check(artifact), { ok: true, errors: [], status: 'READY_OR_PARTIAL' });
  assert.equal(check({ ...artifact, source_batch_digest: 'changed' }).ok, false);
  assert.ok(check({ ...artifact, call_manifest: artifact.call_manifest.slice(1) }).errors.includes('MANIFEST_INVALID'));
});

test('probe runner uses the explicit report-only Sol flag', async () => {
  const { initial, runnerArgs } = await load();
  const args = runnerArgs(initial().call_manifest[0], '/tmp/stage-2y-phase-b-test');
  assert.equal(args[args.indexOf('--profile') + 1], 'SOL_MEDIUM');
  assert.ok(args.includes('--phase-b-lead-probe'));
});

test('section comparison stops on open-world rise or a resolved value change', async () => {
  const { compareSection } = await load();
  const resolved = (value) => ({ section_reference: '1.1', claim: { claim_occurrence_id: 'same', claim_definition_key: 'KEY', state: 'PRESENT', canonical_value: value } });
  const terra = { resolved: [resolved(true)], review_queue: [], open_world: [] };
  const changed = { resolved: [resolved(false)], review_queue: [], open_world: [] };
  assert.equal(compareSection({ terra, sol: changed, sectionReference: '1.1' }).stop, 'PREVIOUSLY_RESOLVED_CHANGED');
  const open = { resolved: [resolved(true)], review_queue: [], open_world: [{ section_reference: '1.1', closure_id: 'open' }] };
  const comparison = compareSection({ terra, sol: open, sectionReference: '1.1' });
  assert.equal(comparison.stop, 'OPEN_WORLD_RISE');
  assert.equal(comparison.after.attempted, 1);
  assert.equal(comparison.after.open_world, 1);
});
