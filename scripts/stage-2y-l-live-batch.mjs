#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { DEAL_PINS, resolvePromptVersionInfo } from './canonical-v2-live-extraction-run.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { PROVIDER_ID, resolveProfile } = require('../lib/canonical-v2/native-producer/codex-cli-provider');

const execFile = promisify(execFileCallback);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SCHEMA_VERSION = 'STAGE_2Y_L_LIVE_BATCH/V1';
const CALL_SCHEMA_VERSION = 'STAGE_2Y_L_LIVE_SECTION_CALL/V1';
const DEFAULT_OUTPUT = 'evidence/canonical-v2/stage-2y-l-live-batch.json';
const DEFAULT_RUNS_ROOT = 'evidence/canonical-v2/stage-2y-l-live-runs';
const PROFILE_ID = 'TERRA_MEDIUM';
const REQUESTED_MODEL_ID = 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM';
const DIGEST = /^[a-f0-9]{64}$/;
const RUN_ARTIFACT_FILES = Object.freeze(['run-manifest.json', 'source-reference.json', 'run-receipt.json', 'adapter-result.json', 'call-telemetry.json', 'recording.json']);
let atomicSequence = 0;

const SELECTED_SECTIONS = Object.freeze([
  ['concho', 'FINANCING_COVENANTS', '6.17'],
  ['modiv', 'FINANCING_COVENANTS', '4.13'], ['modiv', 'FINANCING_COVENANTS', '5.20'],
  ['skechers', 'FINANCING_COVENANTS', '6.5'], ['skechers', 'FINANCING_COVENANTS', '6.6'], ['skechers', 'FINANCING_COVENANTS', '6.19'],
  ['skywater', 'FINANCING_COVENANTS', '5.8'], ['topbuild', 'FINANCING_COVENANTS', '4.17'],
  ['concho', 'CLOSING_CONDITIONS', '7.1'], ['concho', 'CLOSING_CONDITIONS', '7.2'], ['concho', 'CLOSING_CONDITIONS', '7.3'], ['concho', 'CLOSING_CONDITIONS', '7.4'],
  ['metsera', 'CLOSING_CONDITIONS', '7.01'], ['metsera', 'CLOSING_CONDITIONS', '7.02'], ['metsera', 'CLOSING_CONDITIONS', '7.03'], ['metsera', 'CLOSING_CONDITIONS', '7.04'],
  ['modiv', 'CLOSING_CONDITIONS', '6.1'], ['modiv', 'CLOSING_CONDITIONS', '6.2'], ['modiv', 'CLOSING_CONDITIONS', '6.3'], ['modiv', 'CLOSING_CONDITIONS', '6.4'],
  ['redhat', 'CLOSING_CONDITIONS', '6.01'], ['redhat', 'CLOSING_CONDITIONS', '6.02'], ['redhat', 'CLOSING_CONDITIONS', '6.03'], ['redhat', 'CLOSING_CONDITIONS', '6.04'],
  ['skechers', 'CLOSING_CONDITIONS', '7.1'], ['skechers', 'CLOSING_CONDITIONS', '7.2'], ['skechers', 'CLOSING_CONDITIONS', '7.3'],
  ['skywater', 'CLOSING_CONDITIONS', '8.1'], ['skywater', 'CLOSING_CONDITIONS', '8.2'], ['skywater', 'CLOSING_CONDITIONS', '8.3'], ['skywater', 'CLOSING_CONDITIONS', '8.4'],
  ['topbuild', 'CLOSING_CONDITIONS', '5.1'], ['topbuild', 'CLOSING_CONDITIONS', '5.2'], ['topbuild', 'CLOSING_CONDITIONS', '5.3'],
  ['concho', 'PROXY_MEETING', '6.5'], ['concho', 'PROXY_MEETING', '6.6'],
  ['metsera', 'PROXY_MEETING', '6.01'], ['metsera', 'PROXY_MEETING', '6.10'], ['metsera', 'PROXY_MEETING', '6.11'],
  ['modiv', 'PROXY_MEETING', '5.4'], ['redhat', 'PROXY_MEETING', '5.01'],
  ['skechers', 'PROXY_MEETING', '6.3'], ['skechers', 'PROXY_MEETING', '6.4'], ['skechers', 'PROXY_MEETING', '6.17'],
  ['skywater', 'PROXY_MEETING', '5.3'], ['topbuild', 'PROXY_MEETING', '4.5'],
]);

function hash(value) { return sha256Hex(Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8')); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonempty(value) { return typeof value === 'string' && value.length > 0; }
function digest(value) { return typeof value === 'string' && DIGEST.test(value); }
function isoTimestamp(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value); }
function rawBytesDigest(call) {
  const rawPath = resolve(REPO_ROOT, call.raw_html_path);
  if (!existsSync(rawPath)) return null;
  return createHash('sha256').update(readFileSync(rawPath)).digest('hex');
}
function profileMetadata() { const profile = resolveProfile(PROFILE_ID); return Object.freeze({ provider_id: PROVIDER_ID, profile_id: profile.profile_id, requested_model_id: `${profile.model};reasoning=${profile.reasoning_effort};profile=${profile.profile_id}` }); }
function callId(call) { const { call_id, ...body } = call; return hash(body); }
function artifactId(artifact) { const { artifact_id, ...body } = artifact; return hash(body); }

function buildCall(deal, family, sectionReference) {
  const pin = DEAL_PINS[deal];
  if (!pin) throw new Error(`UNPINNED_DEAL:${deal}`);
  const prompt = resolvePromptVersionInfo(family);
  const call = {
    schema_version: CALL_SCHEMA_VERSION, deal, family, section_reference: sectionReference,
    raw_html_path: pin.raw_html_path, agreement_date: pin.agreement_date,
    prompt_identity: { prompt_id: prompt.prompt_id, prompt_version: prompt.prompt_version, section_reference: sectionReference },
    provider: profileMetadata(),
  };
  return Object.freeze({ ...call, call_id: callId(call) });
}

const STAGE_2Y_L_CALLS = Object.freeze(SELECTED_SECTIONS.map(([deal, family, section]) => buildCall(deal, family, section)));

function batchManifest(calls = STAGE_2Y_L_CALLS) {
  return {
    schema_version: SCHEMA_VERSION, purpose: 'Stage 2Y-L admitted-source live extraction only. No publication or activation authority.',
    expected_call_count: calls.length, call_manifest_digest: hash(calls), call_manifest: calls.map((call) => ({ ...call })), calls: [],
    provider: profileMetadata(), publication_authorisation: 'NONE', product_writes: false,
    serving_activated: false, taxonomy_activated: false, artifact_id: null,
  };
}

function findDigestField(value, key) {
  if (!plain(value) && !Array.isArray(value)) return null;
  if (plain(value) && digest(value[key])) return value[key];
  for (const item of Object.values(value)) { const found = findDigestField(item, key); if (found) return found; }
  return null;
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function fileDigest(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }

function collectRunOutput({ call, outputDir }) {
  const names = RUN_ARTIFACT_FILES;
  const paths = Object.fromEntries(names.map((name) => [name, resolve(outputDir, name)]));
  if (names.some((name) => !existsSync(paths[name]))) throw new Error('RUN_ARTIFACT_MISSING');
  const runManifest = readJson(paths['run-manifest.json']); const sourceReference = readJson(paths['source-reference.json']);
  const receipt = readJson(paths['run-receipt.json']); const adapter = readJson(paths['adapter-result.json']); const telemetry = readJson(paths['call-telemetry.json']);
  const receiptSection = (receipt.resolved_sections || []).find((section) => section.section_reference === call.section_reference);
  const producer = receiptSection?.producer_receipt;
  const admitted = sourceReference.admitted_source_capture_inputs || {};
  const binding = {
    raw_bytes_sha256: sourceReference.raw_bytes_sha256,
    converter_digest: findDigestField(adapter, 'converter_digest'), converter_config_digest: findDigestField(adapter, 'converter_config_digest'),
    canonical_text_sha256: sourceReference.canonical_text_sha256, source_map_compressed_sha256: admitted.source_map_compressed_sha256,
    source_map_digest: admitted.source_map_digest,
  };
  const requestIds = (telemetry.calls || []).filter((item) => item.section_reference === call.section_reference).map((item) => item.provider_request_id).filter(nonempty);
  return {
    provider: { provider_id: producer?.provider_id, profile_id: PROFILE_ID, requested_model_id: producer?.model_id, provider_request_ids: requestIds },
    source_binding: binding,
    prompt_identity: { prompt_id: producer?.prompt_id || receiptSection?.prompt_id, prompt_version: producer?.prompt_version || receiptSection?.prompt_version, section_reference: call.section_reference, prompt_digest: producer?.prompt_digest || receiptSection?.prompt_digest },
    artifact_digests: {
      run_manifest: fileDigest(paths['run-manifest.json']), source_reference: fileDigest(paths['source-reference.json']), run_receipt: fileDigest(paths['run-receipt.json']),
      adapter_result: fileDigest(paths['adapter-result.json']), call_telemetry: fileDigest(paths['call-telemetry.json']), recording: fileDigest(paths['recording.json']),
    },
    output_directory: outputDir,
    run_identity: { deal: runManifest.deal, family: runManifest.section_family, section_references: runManifest.section_references, requested_model_profile: runManifest.requested_model_profile },
  };
}

function outputErrors(call, output) {
  const errors = [];
  if (!plain(output)) return ['OUTPUT_NOT_OBJECT'];
  const provider = output.provider; const source = output.source_binding; const prompt = output.prompt_identity; const artifacts = output.artifact_digests;
  if (!plain(provider) || provider.provider_id !== PROVIDER_ID || provider.profile_id !== PROFILE_ID || provider.requested_model_id !== REQUESTED_MODEL_ID || !Array.isArray(provider.provider_request_ids) || provider.provider_request_ids.length !== 1 || !nonempty(provider.provider_request_ids[0])) errors.push('PROVIDER_PROVENANCE_INVALID');
  if (!plain(source) || !['raw_bytes_sha256', 'converter_digest', 'converter_config_digest', 'canonical_text_sha256', 'source_map_compressed_sha256', 'source_map_digest'].every((key) => digest(source?.[key]))) errors.push('SOURCE_BINDING_INVALID');
  else if (source.raw_bytes_sha256 !== rawBytesDigest(call)) errors.push('RAW_BYTES_DIGEST_MISMATCH');
  if (!plain(prompt) || prompt.prompt_id !== call.prompt_identity.prompt_id || prompt.prompt_version !== call.prompt_identity.prompt_version || prompt.section_reference !== call.section_reference || !digest(prompt.prompt_digest)) errors.push('PROMPT_IDENTITY_INVALID');
  if (!plain(artifacts) || !['run_manifest', 'source_reference', 'run_receipt', 'adapter_result', 'call_telemetry', 'recording'].every((key) => digest(artifacts?.[key]))) errors.push('ARTIFACT_DIGESTS_INVALID');
  if (!plain(output.run_identity) || output.run_identity.deal !== call.deal || output.run_identity.family !== call.family || !Array.isArray(output.run_identity.section_references) || output.run_identity.section_references.length !== 1 || output.run_identity.section_references[0] !== call.section_reference || output.run_identity.requested_model_profile !== PROFILE_ID) errors.push('RUN_IDENTITY_INVALID');
  return errors;
}

function ordered(artifact, calls) { const order = new Map(calls.map((call, index) => [call.call_id, index])); artifact.calls.sort((a, b) => order.get(a.call_id) - order.get(b.call_id)); artifact.actual_call_count = artifact.calls.length; return artifact; }
function validateStage2yLArtifact({ calls = STAGE_2Y_L_CALLS, artifact } = {}) {
  const errors = [];
  if (!plain(artifact) || artifact.schema_version !== SCHEMA_VERSION) return { ok: false, errors: ['ARTIFACT_SCHEMA_INVALID'] };
  if (artifact.expected_call_count !== calls.length || artifact.actual_call_count !== artifact.calls?.length || !Array.isArray(artifact.calls)) errors.push('CALL_COUNT_INVALID');
  if (artifact.calls?.length !== calls.length) errors.push('ARTIFACT_INCOMPLETE');
  if (artifact.call_manifest_digest !== hash(calls) || canonicalJson(artifact.call_manifest) !== canonicalJson(calls)) errors.push('CALL_MANIFEST_INVALID');
  if (canonicalJson(artifact.provider) !== canonicalJson(profileMetadata())) errors.push('PROVIDER_INVALID');
  if (artifact.publication_authorisation !== 'NONE' || artifact.product_writes !== false || artifact.serving_activated !== false || artifact.taxonomy_activated !== false) errors.push('AUTHORISATION_INVALID');
  const expected = new Map(calls.map((call) => [call.call_id, call])); const seen = new Set(); const providerRequestIds = new Set();
  for (const record of artifact.calls || []) {
    const call = expected.get(record?.call_id);
    if (!call || seen.has(record.call_id) || canonicalJson(record.spec) !== canonicalJson(call)) { errors.push('CALL_SPEC_INVALID'); continue; }
    seen.add(record.call_id);
    if (!['COMPLETE', 'CALL_FAILED', 'MALFORMED_OUTPUT'].includes(record.state)) errors.push('CALL_STATE_INVALID');
    if (!isoTimestamp(record.sealed_at)) errors.push('SEALED_AT_INVALID');
    if (record.state === 'COMPLETE' && outputErrors(call, record.output).length) errors.push('COMPLETE_OUTPUT_INVALID');
    if (record.state === 'COMPLETE' && nonempty(record.output?.provider?.provider_request_ids?.[0])) {
      const requestId = record.output.provider.provider_request_ids[0];
      if (providerRequestIds.has(requestId)) errors.push('PROVIDER_REQUEST_ID_DUPLICATE');
      providerRequestIds.add(requestId);
    }
    if (record.state !== 'COMPLETE' && (!Array.isArray(record.errors) || record.output !== null)) errors.push('SEALED_FAILURE_INVALID');
  }
  if (artifact.calls.length === calls.length && artifact.artifact_id !== artifactId(artifact)) errors.push('ARTIFACT_ID_INVALID');
  if (artifact.calls.length < calls.length && artifact.artifact_id !== null) errors.push('PARTIAL_ARTIFACT_ID_INVALID');
  if ((artifact.calls || []).some((record) => record.state !== 'COMPLETE')) errors.push('SEALED_CALL_NOT_COMPLETE');
  return { ok: errors.length === 0, errors: [...new Set(errors)].sort() };
}

async function runStage2yLLiveBatch({ calls = STAGE_2Y_L_CALLS, executeSection, checkpointArtifact = null, onCheckpoint = null, concurrency = 4 } = {}) {
  if (typeof executeSection !== 'function') throw new Error('SECTION_EXECUTOR_REQUIRED');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('CONCURRENCY_INVALID');
  if (checkpointArtifact !== null) {
    const check = validateCheckpoint({ calls, artifact: checkpointArtifact }); if (!check.ok) throw new Error(`RESUME_CHECKPOINT_INVALID:${check.errors.join(',')}`);
  }
  const artifact = checkpointArtifact ? structuredClone(checkpointArtifact) : batchManifest(calls);
  const sealed = new Set(artifact.calls.map((record) => record.call_id)); const pending = calls.filter((call) => !sealed.has(call.call_id)); let next = 0;
  let checkpointQueue = Promise.resolve();
  function checkpoint(snapshot) {
    if (!onCheckpoint) return Promise.resolve();
    checkpointQueue = checkpointQueue.then(() => onCheckpoint(snapshot));
    return checkpointQueue;
  }
  async function worker() {
    while (next < pending.length) {
      const call = pending[next++]; let state = 'COMPLETE'; let output = null; let errors = [];
      try { output = await executeSection({ call }); errors = outputErrors(call, output); if (errors.length) { state = 'MALFORMED_OUTPUT'; output = null; } }
      catch (error) { state = 'CALL_FAILED'; errors = [`CALL_FAILED:${String(error?.message || error)}`]; output = null; }
      artifact.calls.push({ call_id: call.call_id, spec: call, state, output, errors, sealed_at: new Date().toISOString() }); ordered(artifact, calls);
      await checkpoint(structuredClone(artifact));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
  ordered(artifact, calls); if (artifact.calls.length === calls.length) artifact.artifact_id = artifactId(artifact); return artifact;
}

function validateCheckpoint({ calls = STAGE_2Y_L_CALLS, artifact } = {}) {
  const checked = validateStage2yLArtifact({ calls, artifact });
  return { ok: checked.errors.every((error) => error === 'SEALED_CALL_NOT_COMPLETE' || error === 'ARTIFACT_INCOMPLETE'), errors: checked.errors.filter((error) => error !== 'SEALED_CALL_NOT_COMPLETE' && error !== 'ARTIFACT_INCOMPLETE') };
}
function checkStage2yLArtifact({ calls = STAGE_2Y_L_CALLS, artifact } = {}) { return validateStage2yLArtifact({ calls, artifact }); }
function writeAtomic(path, value) { mkdirSync(dirname(path), { recursive: true }); const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${atomicSequence++}`; writeFileSync(temporary, value); renameSync(temporary, path); }

function buildLiveRunnerArgs({ call, outputDir }) {
  return [resolve(SCRIPT_DIR, 'canonical-v2-live-extraction-run.mjs'), '--deal', call.deal, '--family', call.family, '--raw-html', call.raw_html_path, '--section-refs', call.section_reference, '--agreement-date', call.agreement_date, '--profile', PROFILE_ID, '--no-follow-citations', '--record', resolve(outputDir, 'recording.json'), '--out-dir', outputDir];
}
function makeLiveExecutor({ runsRoot, invokeRunner = null }) {
  return async ({ call }) => {
    const outputDir = resolve(runsRoot, call.call_id);
    if (existsSync(outputDir)) {
      if (RUN_ARTIFACT_FILES.every((name) => existsSync(resolve(outputDir, name)))) return collectRunOutput({ call, outputDir });
      throw new Error(`EXISTING_RUN_DIRECTORY_PARTIAL:${outputDir}`);
    }
    mkdirSync(outputDir, { recursive: true });
    const args = buildLiveRunnerArgs({ call, outputDir });
    if (invokeRunner) await invokeRunner({ call, outputDir, args });
    else await execFile(process.execPath, args, { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 16 });
    return collectRunOutput({ call, outputDir });
  };
}
function parseArgs(args) {
  const config = { mode: null, output: DEFAULT_OUTPUT, runsRoot: DEFAULT_RUNS_ROOT, resume: false, concurrency: 4 };
  for (let i = 0; i < args.length; i += 1) { const arg = args[i]; if (arg === '--check' || arg === '--live') { if (config.mode) throw new Error('MODE_DUPLICATE'); config.mode = arg; } else if (arg === '--resume') config.resume = true; else if (arg === '--concurrency') { config.concurrency = Number(args[++i]); } else if (arg === '--output') config.output = args[++i]; else if (arg === '--runs-root') config.runsRoot = args[++i]; else throw new Error('USAGE: --check | --live [--resume] [--concurrency 1..4] [--output <path>] [--runs-root <path>]'); }
  if (!config.mode || (config.mode === '--check' && config.resume) || !nonempty(config.output) || !nonempty(config.runsRoot) || !Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 4) throw new Error('USAGE: --check | --live [--resume] [--concurrency 1..4] [--output <path>] [--runs-root <path>]');
  return config;
}
async function main() {
  const config = parseArgs(process.argv.slice(2)); const outputPath = resolve(REPO_ROOT, config.output);
  if (config.mode === '--check') { if (!existsSync(outputPath)) throw new Error('STAGE_2Y_L_ARTIFACT_MISSING'); const checked = checkStage2yLArtifact({ artifact: readJson(outputPath) }); if (!checked.ok) throw new Error(checked.errors.join(',')); return; }
  if (existsSync(outputPath) && !config.resume) throw new Error('OUTPUT_EXISTS_REQUIRES_RESUME');
  const checkpointArtifact = config.resume ? readJson(outputPath) : null;
  const artifact = await runStage2yLLiveBatch({ checkpointArtifact, concurrency: config.concurrency, executeSection: makeLiveExecutor({ runsRoot: resolve(REPO_ROOT, config.runsRoot) }), onCheckpoint: async (checkpoint) => writeAtomic(outputPath, `${canonicalJson(checkpoint)}\n`) });
  writeAtomic(outputPath, `${canonicalJson(artifact)}\n`); const checked = checkStage2yLArtifact({ artifact }); if (!checked.ok) throw new Error(checked.errors.join(','));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { SCHEMA_VERSION, CALL_SCHEMA_VERSION, STAGE_2Y_L_CALLS, batchManifest, collectRunOutput, buildLiveRunnerArgs, makeLiveExecutor, runStage2yLLiveBatch, validateStage2yLArtifact, validateCheckpoint, checkStage2yLArtifact, writeAtomic, parseArgs };
