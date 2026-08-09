#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SCHEMA_VERSION = 'STAGE_2Y_L_PER_FAMILY_DIFF/V1';
const BATCH_SCHEMA_VERSION = 'STAGE_2Y_L_LIVE_BATCH/V1';
const DEFAULT_BATCH = 'evidence/canonical-v2/stage-2y-l-live-batch.json';
const DEFAULT_OUTPUT = 'evidence/canonical-v2/stage-2y-l-per-family-diff.json';
const EXPECTED_CALL_COUNT = 46;
const DIGEST = /^[a-f0-9]{64}$/;
let atomicSequence = 0;

const BASELINE_BY_DEAL_FAMILY = Object.freeze({
  'concho/FINANCING_COVENANTS': 'evidence/canonical-v2/concho-financing-covenants-20260809-2xk-final',
  'concho/CLOSING_CONDITIONS': 'evidence/canonical-v2/concho-closing-conditions-20260809-2xk-final',
  'concho/PROXY_MEETING': 'evidence/canonical-v2/concho-proxy-meeting-20260809-2xk-final',
  'metsera/CLOSING_CONDITIONS': 'evidence/canonical-v2/metsera-closing-conditions-20260809-2xk-final',
  'metsera/PROXY_MEETING': 'evidence/canonical-v2/metsera-proxy-meeting-20260809-2xk-final',
  'modiv/FINANCING_COVENANTS': 'evidence/canonical-v2/modiv-financing-covenants-20260809-2xk-r4',
  'modiv/CLOSING_CONDITIONS': 'evidence/canonical-v2/modiv-closing-conditions-20260809-2xk-final',
  'modiv/PROXY_MEETING': 'evidence/canonical-v2/modiv-proxy-meeting-20260809-2xk-final',
  'redhat/CLOSING_CONDITIONS': 'evidence/canonical-v2/redhat-closing-conditions-20260809-2xk-final',
  'redhat/PROXY_MEETING': 'evidence/canonical-v2/redhat-proxy-meeting-20260809-2xk-final',
  'skechers/FINANCING_COVENANTS': 'evidence/canonical-v2/skechers-financing-covenants-20260809-2xk-final',
  'skechers/CLOSING_CONDITIONS': 'evidence/canonical-v2/skechers-closing-conditions-20260809-2xk-final',
  'skechers/PROXY_MEETING': 'evidence/canonical-v2/skechers-proxy-meeting-20260809-2xk-final',
  'skywater/FINANCING_COVENANTS': 'evidence/canonical-v2/skywater-financing-covenants-20260809-2xk-final',
  'skywater/CLOSING_CONDITIONS': 'evidence/canonical-v2/skywater-closing-conditions-20260809-2xk-final',
  'skywater/PROXY_MEETING': 'evidence/canonical-v2/skywater-proxy-meeting-20260809-2xk-final',
  'topbuild/FINANCING_COVENANTS': 'evidence/canonical-v2/topbuild-financing-covenants-20260809-2xk-r4-final',
  'topbuild/CLOSING_CONDITIONS': 'evidence/canonical-v2/topbuild-closing-conditions-20260809-2xk-r3-final',
  'topbuild/PROXY_MEETING': 'evidence/canonical-v2/topbuild-proxy-meeting-20260809-2xk-r4-final',
});

function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function digest(value) { return typeof value === 'string' && DIGEST.test(value); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function fileDigest(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function runPath(root, location, label = 'RUN_DIRECTORY') {
  if (typeof location !== 'string' || !location || isAbsolute(location)) throw new Error(`${label}_PATH_INVALID:${location}`);
  const resolved = resolve(root, location); const canonical = relative(root, resolved).replace(/\\/g, '/');
  if (!canonical || canonical === '..' || canonical.startsWith('../') || canonical !== location.replace(/\\/g, '/')) throw new Error(`${label}_PATH_INVALID:${location}`);
  return resolved;
}
function findDigestField(value, key) {
  if (!plain(value) && !Array.isArray(value)) return null;
  if (plain(value) && digest(value[key])) return value[key];
  for (const child of Object.values(value)) { const found = findDigestField(child, key); if (found) return found; }
  return null;
}
function sourceBinding(directory) {
  const sourcePath = resolve(directory, 'source-reference.json'); const adapterPath = resolve(directory, 'adapter-result.json');
  if (!existsSync(sourcePath) || !existsSync(adapterPath)) throw new Error(`SOURCE_BINDING_ARTIFACT_MISSING:${directory}`);
  const source = readJson(sourcePath); const adapter = readJson(adapterPath); const admitted = source.admitted_source_capture_inputs || {};
  const binding = {
    raw_bytes_sha256: source.raw_bytes_sha256, converter_digest: findDigestField(adapter, 'converter_digest'),
    converter_config_digest: findDigestField(adapter, 'converter_config_digest'), canonical_text_sha256: source.canonical_text_sha256,
    source_map_compressed_sha256: admitted.source_map_compressed_sha256, source_map_digest: admitted.source_map_digest,
  };
  if (!Object.values(binding).every(digest)) throw new Error(`SOURCE_BINDING_INVALID:${directory}`);
  return binding;
}
function equalBinding(left, right) { return canonicalJson(left) === canonicalJson(right); }
function promptIdentityFromReceipt(receipt, sectionReference, source) {
  const section = (receipt?.resolved_sections || []).filter((item) => item.section_reference === sectionReference);
  if (section.length !== 1) throw new Error(`PROMPT_SECTION_MISSING_OR_DUPLICATE:${source}:${sectionReference}`);
  const item = section[0]; const providerReceipt = item.producer_receipt || {};
  const identity = { prompt_id: providerReceipt.prompt_id || item.prompt_id, prompt_version: providerReceipt.prompt_version || item.prompt_version, prompt_digest: providerReceipt.prompt_digest || item.prompt_digest, section_reference: sectionReference };
  if (typeof identity.prompt_id !== 'string' || !Number.isInteger(identity.prompt_version) || !digest(identity.prompt_digest)) throw new Error(`PROMPT_IDENTITY_INVALID:${source}:${sectionReference}`);
  return identity;
}
function checkedResolution(value, source) {
  if (!Array.isArray(value.resolved) || !Array.isArray(value.review_queue) || !Array.isArray(value.open_world)) throw new Error(`RESOLUTION_SCHEMA_INVALID:${source}`);
  return value;
}
function semanticId(kind, item) {
  const claim = item.claim || item.candidate?.claim || {};
  const compiled = item.compiled_candidate?.candidate?.claim || {};
  const source = item.original_claim_occurrence_id || compiled.claim_occurrence_id || claim.claim_occurrence_id || item.claim_occurrence_id || item.claim_revision_id || item.closure_id;
  if (typeof source !== 'string' || !source) throw new Error(`SEMANTIC_ID_MISSING:${kind}`);
  return `${kind}:${source}`;
}
function semanticItems(kind, items, sectionReference) {
  const byId = new Map();
  for (const item of items.filter((entry) => entry.section_reference === sectionReference)) {
    const semantic_id = semanticId(kind, item);
    if (byId.has(semantic_id)) throw new Error(`SEMANTIC_ID_DUPLICATE:${kind}:${sectionReference}:${semantic_id}`);
    byId.set(semantic_id, { semantic_id, section_reference: sectionReference, concept_key: item.concept_key || null, claim_definition_key: item.resolved_claim_definition_key || item.claim_definition_key || item.claim?.claim_definition_key || null, canonical_value: item.canonical_value ?? item.claim?.canonical_value ?? null });
  }
  return [...byId.values()].sort((left, right) => left.semantic_id.localeCompare(right.semantic_id));
}
function change(before, after) {
  const left = new Map(before.map((item) => [item.semantic_id, item])); const right = new Map(after.map((item) => [item.semantic_id, item]));
  return { added: [...right.values()].filter((item) => !left.has(item.semantic_id)), removed: [...left.values()].filter((item) => !right.has(item.semantic_id)) };
}
function sectionView(data, sectionReference) {
  const attempted = semanticItems('claim', data.review_queue, sectionReference);
  const resolved = semanticItems('resolved', data.resolved, sectionReference);
  const review = semanticItems('review', data.review_queue.filter((item) => item.has_resolution === false), sectionReference);
  const open_world = semanticItems('open_world', data.open_world, sectionReference);
  return { counts: { attempted: attempted.length, resolved: resolved.length, review: review.length, open_world: open_world.length }, attempted, resolved, review, open_world };
}
function verifyCurrentArtifacts(call, directory) {
  const names = { run_manifest: 'run-manifest.json', source_reference: 'source-reference.json', run_receipt: 'run-receipt.json', adapter_result: 'adapter-result.json', call_telemetry: 'call-telemetry.json', recording: 'recording.json' };
  for (const [key, name] of Object.entries(names)) {
    const path = resolve(directory, name); if (!existsSync(path) || call.output?.artifact_digests?.[key] !== fileDigest(path)) throw new Error(`CURRENT_ARTIFACT_DIGEST_MISMATCH:${call.call_id}:${key}`);
  }
}
async function replayRecordedRunAtCurrentHead({ repoRoot, directory }) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2'); const sourceRun = relative(evidenceRoot, directory).replace(/\\/g, '/');
  if (!sourceRun || sourceRun.startsWith('../') || !existsSync(resolve(directory, 'recording.json'))) throw new Error(`RECORDED_RUN_INVALID:${directory}`);
  const recording = readJson(resolve(directory, 'recording.json'));
  if (recording.schema_version !== 'NATIVE_PRODUCER_RECORDED_RUN/V3' || !Array.isArray(recording.calls) || recording.call_count !== recording.calls.length) throw new Error(`RECORDING_SCHEMA_INVALID:${directory}`);
  const [{ resolveSourceRun }, runner] = await Promise.all([
    import('./canonical-v2-step-2x-k-blind-successor.mjs'),
    import('./canonical-v2-live-extraction-run.mjs'),
  ]);
  return resolveSourceRun({ repoRoot, sourceRun, runner });
}
function verifyBatch({ batchArtifact, expectedCallCount }) {
  if (!plain(batchArtifact) || batchArtifact.schema_version !== BATCH_SCHEMA_VERSION || batchArtifact.expected_call_count !== expectedCallCount || batchArtifact.actual_call_count !== expectedCallCount || !Array.isArray(batchArtifact.calls) || batchArtifact.calls.length !== expectedCallCount) throw new Error('BATCH_CALL_COUNT_INVALID');
  const seen = new Set();
  for (const call of batchArtifact.calls) {
    if (call?.state !== 'COMPLETE') throw new Error(`BATCH_CALL_NOT_COMPLETE:${call?.call_id || 'unknown'}`);
    if (typeof call.call_id !== 'string' || seen.has(call.call_id)) throw new Error(`BATCH_CALL_DUPLICATE:${call?.call_id || 'unknown'}`);
    seen.add(call.call_id);
    if (!plain(call.spec) || !plain(call.output) || !plain(call.output.source_binding) || !plain(call.output.prompt_identity) || !plain(call.output.artifact_digests) || typeof call.output.output_directory !== 'string') throw new Error(`BATCH_CALL_SCHEMA_INVALID:${call.call_id}`);
  }
}
function familyRows(sections) {
  const byFamily = new Map();
  for (const section of sections) { if (!byFamily.has(section.family)) byFamily.set(section.family, []); byFamily.get(section.family).push(section); }
  const countKeys = ['attempted', 'resolved', 'review', 'open_world']; const deltaKeys = ['claim', 'resolved', 'review', 'open_world'];
  return [...byFamily.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([family, entries]) => ({
    family, section_count: entries.length, sections: entries.map((entry) => entry.section_reference).sort((left, right) => left.localeCompare(right)),
    counts: Object.fromEntries(['before', 'after'].map((side) => [side, Object.fromEntries(countKeys.map((key) => [key, entries.reduce((sum, entry) => sum + entry.counts[side][key], 0)]))])),
    delta_counts: Object.fromEntries(deltaKeys.map((key) => [key, { added: entries.reduce((sum, entry) => sum + entry.deltas[key].added.length, 0), removed: entries.reduce((sum, entry) => sum + entry.deltas[key].removed.length, 0) }])),
  }));
}
function cacheReplayByDirectory(replayRun) {
  const cache = new Map();
  return (input) => {
    const key = input.directory;
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => replayRun(input)));
    return cache.get(key);
  };
}
async function buildStage2yLPerFamilyDiff({ repoRoot = REPO_ROOT, batchArtifact, baselineByDealFamily = BASELINE_BY_DEAL_FAMILY, expectedCallCount = EXPECTED_CALL_COUNT, replayRun = replayRecordedRunAtCurrentHead } = {}) {
  verifyBatch({ batchArtifact, expectedCallCount }); const sections = [];
  const replayCached = cacheReplayByDirectory(replayRun);
  for (const call of batchArtifact.calls) {
    const { deal, family, section_reference } = call.spec; const baselineLocation = baselineByDealFamily[`${deal}/${family}`];
    if (typeof baselineLocation !== 'string') throw new Error(`BASELINE_MISSING:${deal}/${family}`);
    const baselineDirectory = runPath(repoRoot, baselineLocation, 'BASELINE'); const currentDirectory = runPath(repoRoot, call.output.output_directory, 'OUTPUT_DIRECTORY');
    if (!existsSync(baselineDirectory) || !existsSync(currentDirectory)) throw new Error(`RUN_DIRECTORY_MISSING:${call.call_id}`);
    verifyCurrentArtifacts(call, currentDirectory);
    const beforeBinding = sourceBinding(baselineDirectory); const afterBinding = sourceBinding(currentDirectory);
    if (!equalBinding(beforeBinding, afterBinding) || !equalBinding(afterBinding, call.output.source_binding)) throw new Error(`SOURCE_BINDING_MISMATCH:${call.call_id}`);
    const [beforeReplayed, afterReplayed] = await Promise.all([
      replayCached({ repoRoot, directory: baselineDirectory, call, role: 'baseline' }),
      replayCached({ repoRoot, directory: currentDirectory, call, role: 'current' }),
    ]);
    const beforePrompt = promptIdentityFromReceipt(beforeReplayed.runReceipt, section_reference, baselineDirectory); const afterPrompt = promptIdentityFromReceipt(afterReplayed.runReceipt, section_reference, currentDirectory);
    if (canonicalJson(afterPrompt) !== canonicalJson(call.output.prompt_identity)) throw new Error(`CURRENT_PROMPT_IDENTITY_MISMATCH:${call.call_id}`);
    const before = sectionView(checkedResolution(beforeReplayed.resolution, baselineDirectory), section_reference); const after = sectionView(checkedResolution(afterReplayed.resolution, currentDirectory), section_reference);
    sections.push({ call_id: call.call_id, deal, family, section_reference, baseline_directory: baselineLocation, current_directory: call.output.output_directory, prompt: { before: beforePrompt, after: afterPrompt }, source_binding: { before: beforeBinding, after: afterBinding }, counts: { before: before.counts, after: after.counts }, deltas: { claim: change(before.attempted, after.attempted), resolved: change(before.resolved, after.resolved), review: change(before.review, after.review), open_world: change(before.open_world, after.open_world) } });
  }
  sections.sort((left, right) => `${left.family}/${left.deal}/${left.section_reference}`.localeCompare(`${right.family}/${right.deal}/${right.section_reference}`));
  const output = { schema_version: SCHEMA_VERSION, batch_schema_version: BATCH_SCHEMA_VERSION, replay_mode: 'CURRENT_HEAD_RE_RESOLUTION_OF_RECORDED_RECEIPTS', model_calls: 0, expected_call_count: expectedCallCount, actual_call_count: sections.length, publication_authorisation: 'NONE', sections, families: familyRows(sections) };
  return { ...output, artifact_id: createHash('sha256').update(canonicalJson(output)).digest('hex') };
}
async function validateStage2yLPerFamilyDiff({ repoRoot = REPO_ROOT, batchArtifact, artifact, baselineByDealFamily = BASELINE_BY_DEAL_FAMILY, expectedCallCount = EXPECTED_CALL_COUNT } = {}) {
  try { const expected = await buildStage2yLPerFamilyDiff({ repoRoot, batchArtifact, baselineByDealFamily, expectedCallCount }); return { ok: canonicalJson(expected) === canonicalJson(artifact), errors: canonicalJson(expected) === canonicalJson(artifact) ? [] : ['DIFF_ARTIFACT_MISMATCH'] }; } catch (error) { return { ok: false, errors: [String(error?.message || error)] }; }
}
function writeAtomic(path, value) { mkdirSync(dirname(path), { recursive: true }); const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${atomicSequence++}`; writeFileSync(temporary, value); renameSync(temporary, path); }
async function writeStage2yLPerFamilyDiff({ outputPath, ...options } = {}) {
  if (typeof outputPath !== 'string' || !outputPath) throw new Error('OUTPUT_PATH_REQUIRED');
  const artifact = await buildStage2yLPerFamilyDiff(options); writeAtomic(outputPath, `${canonicalJson(artifact)}\n`); return artifact;
}
async function checkStage2yLPerFamilyDiff({ outputPath, ...options } = {}) {
  if (typeof outputPath !== 'string' || !outputPath || !existsSync(outputPath)) throw new Error('DIFF_ARTIFACT_MISSING');
  const expected = await buildStage2yLPerFamilyDiff(options); if (canonicalJson(readJson(outputPath)) !== canonicalJson(expected)) throw new Error('DIFF_ARTIFACT_MISMATCH'); return expected;
}
function parseArgs(args) {
  const config = { mode: null, batch: DEFAULT_BATCH, output: DEFAULT_OUTPUT };
  for (let index = 0; index < args.length; index += 1) { const arg = args[index]; if (arg === '--check' || arg === '--write') { if (config.mode) throw new Error('MODE_DUPLICATE'); config.mode = arg; } else if (arg === '--batch') config.batch = args[++index]; else if (arg === '--output') config.output = args[++index]; else throw new Error('USAGE: --check | --write [--batch <path>] [--output <path>]'); }
  if (!config.mode || typeof config.batch !== 'string' || typeof config.output !== 'string') throw new Error('USAGE: --check | --write [--batch <path>] [--output <path>]'); return config;
}
async function main() {
  const config = parseArgs(process.argv.slice(2)); const batchPath = resolve(REPO_ROOT, config.batch); const outputPath = resolve(REPO_ROOT, config.output); if (!existsSync(batchPath)) throw new Error('BATCH_ARTIFACT_MISSING'); const batchArtifact = readJson(batchPath);
  if (config.mode === '--write') { await writeStage2yLPerFamilyDiff({ outputPath, batchArtifact }); return; }
  await checkStage2yLPerFamilyDiff({ outputPath, batchArtifact });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

export { SCHEMA_VERSION, BASELINE_BY_DEAL_FAMILY, cacheReplayByDirectory, buildStage2yLPerFamilyDiff, validateStage2yLPerFamilyDiff, writeStage2yLPerFamilyDiff, checkStage2yLPerFamilyDiff, parseArgs, writeAtomic };
