const assert = require('node:assert/strict');
const fs = require('node:fs');
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

test('generation command identity permits only the current or sealed Node launcher and a consistent checkout-root rebase', async () => {
  const {
    generationCommandMatches, initial, outputDirectory, runnerArgs,
  } = await load();
  const spec = initial().call_manifest[0];
  const current = [process.execPath, ...runnerArgs(spec, outputDirectory(spec))];
  const oldRoot = '/tmp/old-phase-b-checkout';
  const historical = current.map((argument) => (
    typeof argument === 'string' && argument.startsWith(`${ROOT}${path.sep}`)
      ? path.join(oldRoot, path.relative(ROOT, argument))
      : argument
  ));
  historical[0] = '/opt/homebrew/Cellar/node/25.9.0_2/bin/node';

  assert.equal(generationCommandMatches(current, current), true);
  assert.equal(generationCommandMatches(historical, current), true);

  const relocatedNode = [...historical];
  relocatedNode[0] = '/opt/hostedtoolcache/node/22.22.0/x64/bin/node';
  assert.equal(generationCommandMatches(relocatedNode, current), false);

  const changedExecutable = [...historical]; changedExecutable[0] = '/tmp/node';
  assert.equal(generationCommandMatches(changedExecutable, current), false);
  const relativeExecutable = [...historical]; relativeExecutable[0] = 'node';
  assert.equal(generationCommandMatches(relativeExecutable, current), false);
  const changedExpectedExecutable = [...current];
  changedExpectedExecutable[0] = '/opt/hostedtoolcache/node/22.22.0/x64/bin/node';
  assert.equal(generationCommandMatches(historical, changedExpectedExecutable), false);
  const changedRunner = [...historical]; changedRunner[1] = path.join(oldRoot, 'scripts/other.mjs');
  assert.equal(generationCommandMatches(changedRunner, current), false);
  const relativeRoot = historical.map((argument) => (
    typeof argument === 'string' && argument.startsWith(`${oldRoot}/`)
      ? argument.slice(oldRoot.length + 1)
      : argument
  ));
  assert.equal(generationCommandMatches(relativeRoot, current), false);
  const changedFlag = [...historical]; changedFlag[14] = '--phase-b-other-probe';
  assert.equal(generationCommandMatches(changedFlag, current), false);
  const mixedRoots = [...historical]; mixedRoots[19] = current[19];
  assert.equal(generationCommandMatches(mixedRoots, current), false);
});

test('existing deferred evidence cannot be reset or bypassed by a fresh live start', async () => {
  const { PHASE_B_LIVE_DEFERRED, assertLiveProbeAllowed, assertProbeWriteAllowed } = await load();
  assert.equal(PHASE_B_LIVE_DEFERRED, true);
  assert.throws(() => assertLiveProbeAllowed(), /PHASE_B_LIVE_DEFERRED:SOL_PROBE/);
  assert.throws(
    () => assertProbeWriteAllowed({ resume: false, outputExists: true }),
    /SOL_PROBE_RESUME_REQUIRED/,
  );
  assert.doesNotThrow(() => assertProbeWriteAllowed({ resume: true, outputExists: true }));
  assert.doesNotThrow(() => assertProbeWriteAllowed({ resume: false, outputExists: false }));
});

test('historical calls keep their sealed prompt while every resumed call uses the current prompt', async () => {
  const {
    check, hash, initial, outputDirectory, refreshUnattemptedSpecs, runnerArgs,
  } = await load();
  const historical = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence/canonical-v2/stage-2y-phase-b/sol-probe.json',
  ), 'utf8'));
  assert.deepEqual(check(historical), { ok: true, errors: [], status: 'STOPPED' });

  const refreshed = refreshUnattemptedSpecs(historical);
  const current = initial();
  assert.deepEqual(refreshed.calls, historical.calls);
  assert.deepEqual(refreshed.call_manifest[8], current.call_manifest[8]);
  assert.equal(historical.call_manifest[8].prompt_identity.prompt_version, 5);
  assert.equal(refreshed.call_manifest[8].prompt_identity.prompt_version, 6);
  assert.deepEqual(check(refreshed), { ok: true, errors: [], status: 'STOPPED' });

  const hostile = structuredClone(refreshed);
  hostile.call_manifest[8] = historical.call_manifest[8];
  for (let index = 1; index <= 8; index += 1) {
    const spec = hostile.call_manifest[index];
    const body = {
      call_id: spec.call_id,
      spec,
      generation_command: [process.execPath, ...runnerArgs(spec, outputDirectory(spec))],
      state: 'CALL_FAILED',
      output: null,
      errors: ['hostile old-prompt call'],
      started_at: '2026-08-10T20:00:00.000Z',
      completed_at: '2026-08-10T20:00:01.000Z',
    };
    hostile.calls.push({ ...body, receipt_id: hash(body) });
  }
  const last = hostile.calls.at(-1).spec;
  hostile.stopped = {
    code: 'CALL_FAILED', call_id: last.call_id, deal: last.deal, family: last.family,
    section_reference: last.section_reference, stopped_at: '2026-08-10T20:00:01.000Z',
  };
  const { manifest_id: ignoredManifest, ...manifestBody } = hostile;
  hostile.manifest_id = hash({ ...manifestBody, calls: [], stopped: null });
  assert.ok(check(hostile).errors.includes('HISTORICAL_CALL_SCOPE_INVALID'));
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
