'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

async function subject() { return import(path.join(ROOT, 'scripts', 'stage-2y-l-per-family-diff.mjs')); }
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); }
function binding() { return { raw_bytes_sha256: 'a'.repeat(64), converter_digest: 'b'.repeat(64), converter_config_digest: 'c'.repeat(64), canonical_text_sha256: 'd'.repeat(64), source_map_compressed_sha256: 'e'.repeat(64), source_map_digest: 'f'.repeat(64) }; }
function resolved(id, section = '7.1') { return { section_reference: section, concept_key: `CONCEPT-${id}`, resolved_claim_definition_key: `DEF-${id}`, claim: { claim_occurrence_id: id, canonical_value: true, attributes: { section_reference: section } } }; }
function review(id, hasResolution, section = '7.1') { return { section_reference: section, original_claim_occurrence_id: id, concept_key: `CONCEPT-${id}`, resolved_claim_definition_key: hasResolution ? `DEF-${id}` : null, canonical_value: true, has_resolution: hasResolution, auto_pass: false, reasons: hasResolution ? [] : ['UNRESOLVED'] }; }
function openWorld(id, section = '7.1') { return { section_reference: section, closure_id: id, claim_definition_key: `PROPOSAL-${id}`, canonical_value: null, reason: 'OUT_OF_VOCABULARY' }; }

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-l-diff-'));
  const runDir = path.join(root, 'evidence', 'canonical-v2', 'stage-2y-l-live-runs', 'call-1');
  const baselineDir = path.join(root, 'evidence', 'canonical-v2', 'baseline');
  const source = binding();
  const prompt = { prompt_id: 'prompt/new', prompt_version: 2, prompt_digest: '1'.repeat(64), section_reference: '7.1' };
  const runFiles = {
    'source-reference.json': { raw_bytes_sha256: source.raw_bytes_sha256, canonical_text_sha256: source.canonical_text_sha256, admitted_source_capture_inputs: { source_map_compressed_sha256: source.source_map_compressed_sha256, source_map_digest: source.source_map_digest } },
    'adapter-result.json': { converter_digest: source.converter_digest, converter_config_digest: source.converter_config_digest },
    'run-manifest.json': { deal: 'concho', section_family: 'CLOSING_CONDITIONS', section_references: ['7.1'], requested_model_profile: 'TERRA_MEDIUM' },
    'run-receipt.json': { resolved_sections: [{ section_reference: '7.1', prompt_id: prompt.prompt_id, prompt_version: prompt.prompt_version, prompt_digest: prompt.prompt_digest }] },
    'call-telemetry.json': {},
    'recording.json': {},
    'resolution.json': { resolved: [resolved('after-resolved')], review_queue: [review('after-resolved', true), review('after-review', false)], open_world: [openWorld('after-open')] },
  };
  for (const [name, value] of Object.entries(runFiles)) writeJson(path.join(runDir, name), value);
  const artifactDigests = Object.fromEntries(['run-manifest.json', 'source-reference.json', 'run-receipt.json', 'adapter-result.json', 'call-telemetry.json', 'recording.json'].map((name) => [name.replace('.json', '').replaceAll('-', '_'), digest(fs.readFileSync(path.join(runDir, name)))]));
  const batch = {
    schema_version: 'STAGE_2Y_L_LIVE_BATCH/V1', expected_call_count: 1, actual_call_count: 1,
    calls: [{ call_id: 'call-1', state: 'COMPLETE', spec: { deal: 'concho', family: 'CLOSING_CONDITIONS', section_reference: '7.1', raw_html_path: 'raw.htm', agreement_date: '2020-01-01', prompt_identity: { prompt_id: prompt.prompt_id, prompt_version: prompt.prompt_version, section_reference: '7.1' } }, output: { output_directory: path.relative(root, runDir), source_binding: source, prompt_identity: prompt, artifact_digests: { run_manifest: artifactDigests.run_manifest, source_reference: artifactDigests.source_reference, run_receipt: artifactDigests.run_receipt, adapter_result: artifactDigests.adapter_result, call_telemetry: artifactDigests.call_telemetry, recording: artifactDigests.recording }, run_identity: { deal: 'concho', family: 'CLOSING_CONDITIONS', section_references: ['7.1'], requested_model_profile: 'TERRA_MEDIUM' } }, sealed_at: '2026-08-09T12:00:00.000Z', errors: [] }],
  };
  writeJson(path.join(root, 'batch.json'), batch);
  writeJson(path.join(baselineDir, 'source-reference.json'), runFiles['source-reference.json']);
  writeJson(path.join(baselineDir, 'adapter-result.json'), runFiles['adapter-result.json']);
  writeJson(path.join(baselineDir, 'run-manifest.json'), { deal: 'concho', section_family: 'CLOSING_CONDITIONS', section_references: ['7.1'] });
  writeJson(path.join(baselineDir, 'run-receipt.json'), { resolved_sections: [{ section_reference: '7.1', prompt_id: 'prompt/old', prompt_version: 1, prompt_digest: '2'.repeat(64) }] });
  writeJson(path.join(baselineDir, 'resolution.json'), { resolved: [resolved('before-resolved')], review_queue: [review('before-resolved', true), review('before-review', false)], open_world: [openWorld('before-open')] });
  return { root, batch, baselineMap: { 'concho/CLOSING_CONDITIONS': path.relative(root, baselineDir) } };
}
async function replayFixtureRun({ directory }) { return { runReceipt: JSON.parse(fs.readFileSync(path.join(directory, 'run-receipt.json'))), resolution: JSON.parse(fs.readFileSync(path.join(directory, 'resolution.json'))) }; }

test('2Y-L per-family diff uses review_queue as the full attempted set and reports stable additions/removals', async () => {
  const { buildStage2yLPerFamilyDiff } = await subject(); const fixture = makeFixture();
  try {
    const output = await buildStage2yLPerFamilyDiff({ repoRoot: fixture.root, batchArtifact: fixture.batch, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 1, replayRun: replayFixtureRun });
    assert.equal(output.sections.length, 1);
    const section = output.sections[0];
    assert.deepEqual(section.counts.before, { attempted: 2, resolved: 1, review: 1, open_world: 1 });
    assert.deepEqual(section.counts.after, { attempted: 2, resolved: 1, review: 1, open_world: 1 });
    assert.deepEqual(section.deltas.resolved.added.map((item) => item.semantic_id), ['resolved:after-resolved']);
    assert.deepEqual(section.deltas.resolved.removed.map((item) => item.semantic_id), ['resolved:before-resolved']);
    assert.equal(section.prompt.before.prompt_version, 1);
    assert.equal(section.prompt.after.prompt_version, 2);
    assert.deepEqual(section.source_binding.before, section.source_binding.after);
    assert.deepEqual(output.families[0].counts, { before: { attempted: 2, resolved: 1, review: 1, open_world: 1 }, after: { attempted: 2, resolved: 1, review: 1, open_world: 1 } });
    assert.deepEqual(output.families[0].delta_counts.resolved, { added: 1, removed: 1 });
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('2Y-L per-family diff rejects absolute and traversal output paths before replay', async () => {
  const { buildStage2yLPerFamilyDiff } = await subject(); const fixture = makeFixture();
  try {
    for (const outputDirectory of ['/tmp/forbidden', '../outside']) {
      const artifact = structuredClone(fixture.batch); artifact.calls[0].output.output_directory = outputDirectory;
      await assert.rejects(buildStage2yLPerFamilyDiff({ repoRoot: fixture.root, batchArtifact: artifact, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 1, replayRun: replayFixtureRun }), /OUTPUT_DIRECTORY_PATH_INVALID/);
    }
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('2Y-L per-family diff caches one replay for a shared baseline directory', async () => {
  const { cacheReplayByDirectory } = await subject(); let calls = 0;
  const replay = cacheReplayByDirectory(async () => { calls += 1; return { value: 'replayed' }; });
  const [first, second] = await Promise.all([replay({ directory: '/same' }), replay({ directory: '/same' })]);
  assert.deepEqual(first, second); assert.equal(calls, 1);
});

test('2Y-L per-family diff fails closed on a source binding mismatch and missing baseline', async () => {
  const { buildStage2yLPerFamilyDiff } = await subject(); const fixture = makeFixture();
  try {
    const mismatch = structuredClone(fixture.batch); mismatch.calls[0].output.source_binding.canonical_text_sha256 = '0'.repeat(64);
    await assert.rejects(buildStage2yLPerFamilyDiff({ repoRoot: fixture.root, batchArtifact: mismatch, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 1, replayRun: replayFixtureRun }), /SOURCE_BINDING_MISMATCH/);
    await assert.rejects(buildStage2yLPerFamilyDiff({ repoRoot: fixture.root, batchArtifact: fixture.batch, baselineByDealFamily: {}, expectedCallCount: 1, replayRun: replayFixtureRun }), /BASELINE_MISSING/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('2Y-L per-family diff requires a complete unique sealed batch', async () => {
  const { buildStage2yLPerFamilyDiff } = await subject(); const fixture = makeFixture();
  try {
    const incomplete = structuredClone(fixture.batch); incomplete.actual_call_count = 0;
    await assert.rejects(buildStage2yLPerFamilyDiff({ repoRoot: fixture.root, batchArtifact: incomplete, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 1, replayRun: replayFixtureRun }), /BATCH_CALL_COUNT_INVALID/);
    const duplicate = structuredClone(fixture.batch); duplicate.calls.push(structuredClone(duplicate.calls[0])); duplicate.expected_call_count = 2; duplicate.actual_call_count = 2;
    await assert.rejects(buildStage2yLPerFamilyDiff({ repoRoot: fixture.root, batchArtifact: duplicate, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 2, replayRun: replayFixtureRun }), /BATCH_CALL_DUPLICATE/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('2Y-L per-family diff writes deterministically and check only replays recorded inputs', async () => {
  const { writeStage2yLPerFamilyDiff, checkStage2yLPerFamilyDiff } = await subject(); const fixture = makeFixture();
  try {
    const outputPath = path.join(fixture.root, 'diff.json'); let replays = 0;
    const replayRun = async (input) => { replays += 1; return replayFixtureRun(input); };
    await writeStage2yLPerFamilyDiff({ outputPath, repoRoot: fixture.root, batchArtifact: fixture.batch, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 1, replayRun });
    const first = fs.readFileSync(outputPath, 'utf8');
    await checkStage2yLPerFamilyDiff({ outputPath, repoRoot: fixture.root, batchArtifact: fixture.batch, baselineByDealFamily: fixture.baselineMap, expectedCallCount: 1, replayRun });
    assert.equal(fs.readFileSync(outputPath, 'utf8'), first);
    assert.equal(replays, 4);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});
