#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { STAGE_2Y_L_CALLS } from './stage-2y-l-live-batch.mjs';

const execFile = promisify(execFileCallback);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = 'evidence/canonical-v2/stage-2y-phase-b/sol-probe.json';
const RUNS_ROOT = 'evidence/canonical-v2/stage-2y-phase-b/sol-probe-runs';
const TERRA_BATCH = 'evidence/canonical-v2/stage-2y-l-live-batch.json';
const PROFILE = Object.freeze({
  provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION', profile_id: 'SOL_MEDIUM',
  model: 'gpt-5.6-sol', reasoning_effort: 'medium',
  requested_model_id: 'gpt-5.6-sol;reasoning=medium;profile=SOL_MEDIUM',
});
const HISTORICAL_CALL_RECEIPTS = Object.freeze({
  '1951ca1d38a0c01dcfd79fcc3e6ed34d90d32a7e2c276cb4af19acabf5c8aee5':
    '088f91a941f7870efb1fce1246379948bfe028383caf7d260180118eb20ad54a',
});
const REQUIRED_FILES = Object.freeze(['run-manifest.json', 'source-reference.json', 'run-receipt.json', 'adapter-result.json', 'call-telemetry.json', 'recording.json', 'resolution.json', 'review-queue.json', 'validation.json']);
let sequence = 0;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value) { return createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex'); }
function readJson(path) { return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')); }
function fileHash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function writeAtomic(path, value) { const absolute = resolve(ROOT, path); mkdirSync(dirname(absolute), { recursive: true }); const temporary = `${absolute}.tmp-${process.pid}-${sequence++}`; writeFileSync(temporary, `${canonical(value)}\n`); renameSync(temporary, absolute); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function findDigestField(value, key) { if (!object(value) && !Array.isArray(value)) return null; if (object(value) && typeof value[key] === 'string') return value[key]; for (const child of Object.values(value)) { const found = findDigestField(child, key); if (found) return found; } return null; }
function sourceBinding(directory) { const source = JSON.parse(readFileSync(resolve(directory, 'source-reference.json'), 'utf8')); const adapter = JSON.parse(readFileSync(resolve(directory, 'adapter-result.json'), 'utf8')); const admitted = source.admitted_source_capture_inputs || {}; return { raw_bytes_sha256: source.raw_bytes_sha256, canonical_text_sha256: source.canonical_text_sha256, converter_digest: findDigestField(adapter, 'converter_digest'), converter_config_digest: findDigestField(adapter, 'converter_config_digest'), source_map_compressed_sha256: admitted.source_map_compressed_sha256, source_map_digest: admitted.source_map_digest }; }
function sectionRows(resolution, state, sectionReference) {
  const rows = state === 'RESOLVED' ? resolution.resolved || [] : state === 'OPEN_WORLD' ? resolution.open_world || [] : (resolution.review_queue || []).filter((row) => row.has_resolution === false);
  return rows.filter((row) => row.section_reference === sectionReference);
}
function claim(row) { return row.claim || row.compiled_candidate?.candidate?.claim || row.candidate?.claim || {}; }
function identity(row) { const value = claim(row); return value.claim_occurrence_id || row.original_claim_occurrence_id || row.claim_occurrence_id || row.claim_revision_id || row.closure_id || null; }
function resolvedSignature(row) { const value = claim(row); return canonical({ claim_definition_key: value.claim_definition_key || row.resolved_claim_definition_key || row.claim_definition_key || null, state: value.state || 'PRESENT', canonical_value: value.canonical_value ?? row.canonical_value ?? null, party: row.party || row.provision_instance?.party || null }); }
function sectionCounts(resolution, sectionReference) { return { attempted: sectionRows(resolution, 'RESOLVED', sectionReference).length + sectionRows(resolution, 'REVIEW', sectionReference).length, resolved: sectionRows(resolution, 'RESOLVED', sectionReference).length, open_world: sectionRows(resolution, 'OPEN_WORLD', sectionReference).length, review: sectionRows(resolution, 'REVIEW', sectionReference).length }; }
function compareSection({ terra, sol, sectionReference }) {
  const before = sectionCounts(terra, sectionReference); const after = sectionCounts(sol, sectionReference); const changes = [];
  const afterResolved = new Map(sectionRows(sol, 'RESOLVED', sectionReference).map((row) => [identity(row), row]));
  for (const row of sectionRows(terra, 'RESOLVED', sectionReference)) {
    const id = identity(row); const next = afterResolved.get(id);
    if (!id || !next) changes.push({ identity: id, kind: 'PREVIOUSLY_RESOLVED_MISSING' });
    else if (resolvedSignature(row) !== resolvedSignature(next)) changes.push({ identity: id, kind: 'PREVIOUSLY_RESOLVED_VALUE_OR_STATE_CHANGED', before: JSON.parse(resolvedSignature(row)), after: JSON.parse(resolvedSignature(next)) });
  }
  const stop = after.open_world > before.open_world ? 'OPEN_WORLD_RISE' : changes.length ? 'PREVIOUSLY_RESOLVED_CHANGED' : null;
  return { before, after, delta: Object.fromEntries(Object.keys(before).map((key) => [key, after[key] - before[key]])), previously_resolved_changes: changes, stop };
}
function terraCallMap() {
  const batch = readJson(TERRA_BATCH); const map = new Map();
  for (const call of batch.calls || []) map.set(`${call.spec.deal}|${call.spec.family}|${call.spec.section_reference}`, call);
  if (map.size !== 46) throw new Error(`TERRA_BATCH_CALL_COUNT_MISMATCH:${map.size}`); return map;
}
function outputDirectory(call) { return resolve(ROOT, RUNS_ROOT, hash({ ...call, provider: PROFILE })); }
function runnerArgs(call, directory) {
  return [resolve(ROOT, 'scripts/canonical-v2-live-extraction-run.mjs'), '--deal', call.deal, '--family', call.family, '--raw-html', call.raw_html_path, '--section-refs', call.section_reference, '--agreement-date', call.agreement_date, '--profile', 'SOL_MEDIUM', '--phase-b-lead-probe', '--no-follow-citations', '--record', resolve(directory, 'recording.json'), '--out-dir', directory];
}
function collect(call, directory, terraCall) {
  for (const name of REQUIRED_FILES) if (!existsSync(resolve(directory, name))) throw new Error(`RUN_ARTIFACT_MISSING:${name}`);
  const manifest = JSON.parse(readFileSync(resolve(directory, 'run-manifest.json'), 'utf8'));
  const receipt = JSON.parse(readFileSync(resolve(directory, 'run-receipt.json'), 'utf8'));
  const telemetry = JSON.parse(readFileSync(resolve(directory, 'call-telemetry.json'), 'utf8'));
  const resolution = JSON.parse(readFileSync(resolve(directory, 'resolution.json'), 'utf8'));
  const terraDirectory = resolve(ROOT, terraCall.output.output_directory); const terraResolution = JSON.parse(readFileSync(resolve(terraDirectory, 'resolution.json'), 'utf8'));
  const sectionReceipt = (receipt.resolved_sections || []).find((row) => row.section_reference === call.section_reference); const producer = sectionReceipt?.producer_receipt || {};
  if (producer.model_id !== PROFILE.requested_model_id || manifest.requested_model_profile !== PROFILE.profile_id) throw new Error('SOL_PROFILE_PROVENANCE_INVALID');
  const requestIds = (telemetry.calls || []).filter((row) => row.section_reference === call.section_reference).map((row) => row.provider_request_id).filter(Boolean);
  if (requestIds.length !== 1 || telemetry.calls.some((row) => row.requested_model_profile !== PROFILE.profile_id || row.requested_model_id !== PROFILE.requested_model_id)) throw new Error('SOL_TRANSPORT_RECEIPT_INVALID');
  const solSource = sourceBinding(directory); const terraSource = terraCall.output.source_binding;
  if (canonical(solSource) !== canonical(terraSource)) throw new Error('SOL_TERRA_SOURCE_BINDING_MISMATCH');
  const prompt = { prompt_id: producer.prompt_id || sectionReceipt?.prompt_id, prompt_version: producer.prompt_version || sectionReceipt?.prompt_version, prompt_digest: producer.prompt_digest || sectionReceipt?.prompt_digest, section_reference: call.section_reference };
  if (canonical(prompt) !== canonical(terraCall.output.prompt_identity)) throw new Error('SOL_TERRA_PROMPT_BINDING_MISMATCH');
  const comparison = compareSection({ terra: terraResolution, sol: resolution, sectionReference: call.section_reference });
  return {
    output_directory: relative(ROOT, directory).replace(/\\/g, '/'), comparison,
    provider: { ...PROFILE, provider_request_ids: requestIds }, source_binding: solSource, prompt,
    artifact_digests: Object.fromEntries(REQUIRED_FILES.map((name) => [name, fileHash(resolve(directory, name))])),
  };
}
function initial() {
  const calls = STAGE_2Y_L_CALLS.map((call) => ({ ...call, provider: PROFILE, phase_b_lead_probe: true, call_id: hash({ ...call, provider: PROFILE, phase_b_lead_probe: true }) }));
  const body = { schema_version: 'STAGE_2Y_PHASE_B_SOL_PROBE/V1', purpose: 'Report-only same-vendor lead-tier probe. No publication or activation authority.', cohort: { authoritative_name: 'STAGE_2Y_L_CALLS', programme_shorthand: '46-call Closing Conditions batch', exact_composition: { CLOSING_CONDITIONS: 26, FINANCING_COVENANTS: 8, PROXY_MEETING: 12 } }, commands: { prepare: 'node scripts/stage-2y-phase-b-sol-probe.mjs --prepare', live: 'node scripts/stage-2y-phase-b-sol-probe.mjs --live --resume', check: 'node scripts/stage-2y-phase-b-sol-probe.mjs --check' }, expected_call_count: 46, provider: PROFILE, source_batch_digest: fileHash(resolve(ROOT, TERRA_BATCH)), calls: [], call_manifest: calls, stopped: null, publication_authorisation: 'NONE', product_writes: false, serving_activated: false };
  return { ...body, manifest_id: hash(body) };
}
function manifestIdentity(artifact) {
  const { manifest_id: ignored, ...body } = artifact;
  return hash({ ...body, calls: [], stopped: null });
}
function manifestStaticFields(artifact) {
  const {
    manifest_id: ignoredManifest, call_manifest: ignoredManifestCalls,
    calls: ignoredCalls, stopped: ignoredStop, ...fields
  } = artifact;
  return fields;
}
function knownManifestSpec(spec, currentSpec, terraCall) {
  if (!object(spec) || !object(terraCall?.spec)) return false;
  const historicalBody = { ...terraCall.spec, provider: PROFILE, phase_b_lead_probe: true };
  const historicalSpec = { ...historicalBody, call_id: hash(historicalBody) };
  return canonical(spec) === canonical(currentSpec) || canonical(spec) === canonical(historicalSpec);
}
function refreshUnattemptedSpecs(artifact) {
  const validation = check(artifact);
  if (!validation.ok) throw new Error(validation.errors.join(','));
  const current = initial();
  const recorded = new Set(artifact.calls.map((call) => call.call_id));
  const callManifest = artifact.call_manifest.map((spec, index) => (
    recorded.has(spec.call_id) ? spec : current.call_manifest[index]
  ));
  const next = { ...artifact, call_manifest: callManifest };
  return { ...next, manifest_id: manifestIdentity(next) };
}
function assertProbeWriteAllowed({ resume, outputExists = existsSync(resolve(ROOT, OUTPUT)) }) {
  if (!resume && outputExists) throw new Error('SOL_PROBE_RESUME_REQUIRED: existing probe evidence must be preserved');
}
async function run({ resume }) {
  assertProbeWriteAllowed({ resume });
  const artifact = resume && existsSync(resolve(ROOT, OUTPUT))
    ? refreshUnattemptedSpecs(readJson(OUTPUT))
    : initial();
  const terra = terraCallMap(); const completed = new Set(artifact.calls.map((row) => row.call_id));
  const validation = check(artifact); if (!validation.ok) throw new Error(validation.errors.join(',')); if (artifact.stopped) throw new Error(`SOL_PROBE_STOPPED:${artifact.stopped.code}`);
  for (const call of artifact.call_manifest) {
    if (completed.has(call.call_id)) continue; const directory = outputDirectory(call); mkdirSync(directory, { recursive: true }); const started = new Date().toISOString(); let state = 'COMPLETE'; let output = null; let errors = [];
    const generationArgs = runnerArgs(call, directory);
    try {
      if (!REQUIRED_FILES.every((name) => existsSync(resolve(directory, name)))) await execFile(process.execPath, generationArgs, { cwd: ROOT, maxBuffer: 1024 * 1024 * 32 });
      const terraCall = terra.get(`${call.deal}|${call.family}|${call.section_reference}`); if (!terraCall) throw new Error('TERRA_COMPARATOR_MISSING'); output = collect(call, directory, terraCall);
      if (output.comparison.stop) artifact.stopped = { code: output.comparison.stop, call_id: call.call_id, deal: call.deal, family: call.family, section_reference: call.section_reference, stopped_at: new Date().toISOString() };
    } catch (error) { state = 'CALL_FAILED'; errors = [String(error?.message || error)]; artifact.stopped = { code: 'CALL_FAILED', call_id: call.call_id, deal: call.deal, family: call.family, section_reference: call.section_reference, stopped_at: new Date().toISOString() }; }
    const record = { call_id: call.call_id, spec: call, generation_command: [process.execPath, ...generationArgs], state, output, errors, started_at: started, completed_at: new Date().toISOString() };
    artifact.calls.push({ ...record, receipt_id: hash(record) }); const latestValidation = check(artifact); if (!latestValidation.ok) throw new Error(latestValidation.errors.join(',')); writeAtomic(OUTPUT, artifact); if (artifact.stopped || state !== 'COMPLETE') break;
  }
  return artifact;
}
function check(artifact) {
  const errors = []; const expected = initial(); let terra = null;
  if (!object(artifact) || artifact.manifest_id !== manifestIdentity(artifact)
    || canonical(manifestStaticFields(artifact)) !== canonical(manifestStaticFields(expected))
    || !Array.isArray(artifact.call_manifest) || artifact.call_manifest.length !== expected.call_manifest.length) {
    errors.push('MANIFEST_INVALID');
  } else {
    try {
      terra = terraCallMap();
      for (const [index, spec] of artifact.call_manifest.entries()) {
        const currentSpec = expected.call_manifest[index];
        const terraCall = terra.get(`${currentSpec.deal}|${currentSpec.family}|${currentSpec.section_reference}`);
        if (!knownManifestSpec(spec, currentSpec, terraCall)) errors.push('MANIFEST_INVALID');
      }
    } catch { errors.push('MANIFEST_INVALID'); }
  }
  if (canonical(artifact.provider) !== canonical(PROFILE) || artifact.publication_authorisation !== 'NONE' || artifact.product_writes !== false || artifact.serving_activated !== false) errors.push('AUTHORITY_OR_PROVIDER_INVALID');
  if (!Array.isArray(artifact.calls) || artifact.calls.length > 46) errors.push('CALL_SET_INVALID');
  const requestIds = new Set();
  for (const [index, call] of (artifact.calls || []).entries()) {
    const spec = artifact.call_manifest?.[index]; const currentSpec = expected.call_manifest[index]; const { receipt_id: ignored, ...body } = call;
    if (!spec) { errors.push('CALL_BINDING_INVALID'); continue; }
    const directory = outputDirectory(spec);
    if (call.call_id !== spec.call_id || canonical(call.spec) !== canonical(spec) || call.receipt_id !== hash(body)) errors.push('CALL_BINDING_INVALID');
    if (spec && canonical(spec) !== canonical(currentSpec)
      && HISTORICAL_CALL_RECEIPTS[call.call_id] !== call.receipt_id) errors.push('HISTORICAL_CALL_SCOPE_INVALID');
    if (canonical(call.generation_command) !== canonical([process.execPath, ...runnerArgs(spec, directory)])) errors.push('GENERATION_COMMAND_INVALID');
    if (!['COMPLETE', 'CALL_FAILED'].includes(call.state) || !Array.isArray(call.errors)) errors.push('CALL_STATE_INVALID');
    if (call.state === 'COMPLETE') {
      const output = call.output; const requestId = output?.provider?.provider_request_ids?.[0];
      if (!object(output) || output.output_directory !== relative(ROOT, directory).replace(/\\/g, '/')) errors.push('OUTPUT_SHAPE_INVALID');
      if (canonical(output?.provider && { provider_id: output.provider.provider_id, profile_id: output.provider.profile_id, model: output.provider.model, reasoning_effort: output.provider.reasoning_effort, requested_model_id: output.provider.requested_model_id }) !== canonical(PROFILE)) errors.push('OUTPUT_PROVIDER_INVALID');
      if (!requestId || output.provider.provider_request_ids.length !== 1 || requestIds.has(requestId)) errors.push('PROVIDER_REQUEST_INVALID'); else requestIds.add(requestId);
      if (!object(output.source_binding) || !object(output.prompt) || !object(output.comparison) || !object(output.artifact_digests)
        || Object.keys(output.artifact_digests).sort().join('|') !== [...REQUIRED_FILES].sort().join('|')
        || Object.values(output.artifact_digests).some((digest) => !/^[a-f0-9]{64}$/.test(digest))) errors.push('OUTPUT_BINDING_INVALID');
      if (!existsSync(directory)) errors.push('RUN_ARTIFACT_MISSING');
      else {
        try {
          terra ||= terraCallMap(); const terraCall = terra.get(`${spec.deal}|${spec.family}|${spec.section_reference}`);
          if (!terraCall || canonical(output) !== canonical(collect(spec, directory, terraCall))) errors.push('OUTPUT_BINDING_INVALID');
        } catch { errors.push('OUTPUT_BINDING_INVALID'); }
      }
      if (output.comparison.stop && artifact.stopped?.call_id !== call.call_id) errors.push('STOP_BINDING_INVALID');
    } else if (call.output !== null || call.errors.length === 0) errors.push('FAILED_CALL_INVALID');
  }
  if (artifact.stopped && (!artifact.calls.length || artifact.stopped.call_id !== artifact.calls.at(-1).call_id || !['OPEN_WORLD_RISE', 'PREVIOUSLY_RESOLVED_CHANGED', 'CALL_FAILED'].includes(artifact.stopped.code))) errors.push('STOP_BINDING_INVALID');
  if (!artifact.stopped && artifact.calls.some((call) => call.state !== 'COMPLETE' || call.output?.comparison?.stop)) errors.push('STOP_BINDING_INVALID');
  return { ok: errors.length === 0, errors: [...new Set(errors)], status: artifact.calls?.length === 46 && !artifact.stopped ? 'COMPLETE' : artifact.stopped ? 'STOPPED' : 'READY_OR_PARTIAL' };
}
function parseArgs(argv) { const mode = argv.find((arg) => ['--prepare', '--live', '--check'].includes(arg)); if (!mode || argv.some((arg) => ![mode, '--resume'].includes(arg)) || (mode !== '--live' && argv.includes('--resume'))) throw new Error('USAGE: --prepare | --live [--resume] | --check'); return { mode, resume: argv.includes('--resume') }; }
async function main() { const args = parseArgs(process.argv.slice(2)); if (args.mode === '--prepare') { assertProbeWriteAllowed({ resume: false }); const artifact = initial(); writeAtomic(OUTPUT, artifact); process.stdout.write('Sol probe prepared: 0/46\n'); return; } if (args.mode === '--check') { const result = check(readJson(OUTPUT)); if (!result.ok) throw new Error(result.errors.join(',')); return; } const result = await run(args); process.stdout.write(`Sol probe: ${result.calls.length}/46; stopped=${result.stopped?.code || 'no'}\n`); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

export {
  PROFILE, canonical, collect, compareSection, hash, initial, outputDirectory,
  runnerArgs, assertProbeWriteAllowed, check, parseArgs, refreshUnattemptedSpecs, terraCallMap,
};
