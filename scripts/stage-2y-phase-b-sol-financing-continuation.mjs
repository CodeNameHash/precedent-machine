#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  PROFILE, canonical, collect, hash, outputDirectory, runnerArgs, terraCallMap,
  check as checkLegacy,
} from './stage-2y-phase-b-sol-probe.mjs';
import { assertPhaseBLiveAllowed } from './stage-2y-phase-b-live-authority.mjs';

const execFile = promisify(execFileCallback);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILY = 'FINANCING_COVENANTS';
const REGISTERED_RUNNER = 'canonical-v2-live-extraction-run.mjs';
const LEGACY_PATH = 'evidence/canonical-v2/stage-2y-phase-b/sol-probe.json';
const OUTPUT = 'evidence/canonical-v2/stage-2y-phase-b/sol-financing-continuation.json';
let sequence = 0;

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function readJson(path) { return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')); }
function fileHash(path) { return createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex'); }
function writeAtomic(path, value) {
  const absolute = resolve(ROOT, path); mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${sequence++}`;
  writeFileSync(temporary, `${canonical(value)}\n`); renameSync(temporary, absolute);
}
function continuationRunnerArgs(call, directory) {
  const args = runnerArgs(call, directory);
  if (!args[0].endsWith(REGISTERED_RUNNER)) throw new Error('LIVE_EXTRACTION_RUNNER_INVALID');
  return args;
}
function counts(calls, side) {
  const keys = ['attempted', 'resolved', 'open_world', 'review'];
  return Object.fromEntries(keys.map((key) => [key, calls.reduce((sum, call) => sum + call.output.comparison[side][key], 0)]));
}
function familyStop(calls, expectedCallCount) {
  const changes = calls.flatMap((call) => call.output?.comparison?.previously_resolved_changes || []);
  if (changes.length) return 'PREVIOUSLY_RESOLVED_CHANGED';
  if (calls.length !== expectedCallCount || calls.some((call) => call.state !== 'COMPLETE')) return null;
  return counts(calls, 'after').open_world > counts(calls, 'before').open_world ? 'OPEN_WORLD_RISE' : null;
}
function normaliseQuote(value) { return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function evidenceAnchor(row) {
  return (row.evidence || []).map((item) => ({
    document_ordinal: item.document_ordinal, evidence_role: item.evidence_role,
    absolute_start: item.absolute_start, absolute_end: item.absolute_end,
  })).sort((left, right) => canonical(left).localeCompare(canonical(right)));
}
function quoteOverlapReport(calls, side) {
  const terra = terraCallMap(); const exactGroups = []; const nestedPairs = []; const nestedChildren = new Set(); let rowCount = 0;
  for (const call of calls) {
    const spec = call.spec;
    const directory = side === 'before'
      ? resolve(ROOT, terra.get(`${spec.deal}|${spec.family}|${spec.section_reference}`).output.output_directory)
      : resolve(ROOT, call.output.output_directory);
    const resolution = JSON.parse(readFileSync(resolve(directory, 'resolution.json'), 'utf8'));
    const rows = (resolution.open_world || []).filter((row) => row.section_reference === spec.section_reference);
    rowCount += rows.length;
    const groups = new Map();
    for (const row of rows) {
      const key = canonical({ claim_definition_key: row.claim_definition_key, evidence_anchor: evidenceAnchor(row) });
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row);
    }
    for (const group of groups.values()) {
      if (group.length > 1) exactGroups.push({
        deal: spec.deal, section_reference: spec.section_reference,
        source_binding: call.output.source_binding, claim_definition_key: group[0].claim_definition_key,
        evidence_anchor: evidenceAnchor(group[0]), closure_ids: group.map((row) => row.closure_id),
        raw_values: group.map((row) => row.raw_value),
      });
    }
    const representatives = [...groups.values()].map((group) => group[0]);
    for (let left = 0; left < representatives.length; left += 1) {
      for (let right = left + 1; right < representatives.length; right += 1) {
        const leftRow = representatives[left]; const rightRow = representatives[right];
        const leftAnchor = evidenceAnchor(leftRow); const rightAnchor = evidenceAnchor(rightRow);
        if (leftAnchor.length !== 1 || rightAnchor.length !== 1 || leftRow.claim_definition_key !== rightRow.claim_definition_key) continue;
        const sameSurface = leftAnchor[0].document_ordinal === rightAnchor[0].document_ordinal && leftAnchor[0].evidence_role === rightAnchor[0].evidence_role;
        const leftContains = leftAnchor[0].absolute_start <= rightAnchor[0].absolute_start && leftAnchor[0].absolute_end >= rightAnchor[0].absolute_end
          && (leftAnchor[0].absolute_start < rightAnchor[0].absolute_start || leftAnchor[0].absolute_end > rightAnchor[0].absolute_end);
        const rightContains = rightAnchor[0].absolute_start <= leftAnchor[0].absolute_start && rightAnchor[0].absolute_end >= leftAnchor[0].absolute_end
          && (rightAnchor[0].absolute_start < leftAnchor[0].absolute_start || rightAnchor[0].absolute_end > leftAnchor[0].absolute_end);
        const container = leftContains ? leftRow : rightContains ? rightRow : null; const child = leftContains ? rightRow : rightContains ? leftRow : null;
        if (!sameSurface || !container || !normaliseQuote(container.raw_value).includes(normaliseQuote(child.raw_value))) continue;
        nestedChildren.add(`${spec.deal}|${spec.section_reference}|${child.closure_id}`);
        nestedPairs.push({
          deal: spec.deal, section_reference: spec.section_reference, source_binding: call.output.source_binding,
          container_closure_id: container.closure_id, child_closure_id: child.closure_id,
          container_evidence_anchor: evidenceAnchor(container), child_evidence_anchor: evidenceAnchor(child),
          container_raw_value: container.raw_value, child_raw_value: child.raw_value,
        });
      }
    }
  }
  const exactExcess = exactGroups.reduce((sum, group) => sum + group.closure_ids.length - 1, 0);
  return {
    row_count: rowCount,
    exact_group_count: exactGroups.length, exact_duplicate_excess: exactExcess,
    rows_after_exact_collapse: rowCount - exactExcess, nested_pair_count: nestedPairs.length,
    nested_child_row_count: nestedChildren.size, exact_groups: exactGroups, nested_pairs: nestedPairs,
  };
}
function familySummary(calls, expectedCallCount) {
  if (calls.length !== expectedCallCount || calls.some((call) => call.state !== 'COMPLETE')) return null;
  const before = counts(calls, 'before'); const after = counts(calls, 'after');
  return {
    family: FAMILY, completed_sections: calls.length, before, after,
    delta: Object.fromEntries(Object.keys(before).map((key) => [key, after[key] - before[key]])),
    section_open_world_rises: calls.filter((call) => call.output.comparison.delta.open_world > 0).map((call) => ({
      call_id: call.call_id, deal: call.spec.deal, section_reference: call.spec.section_reference,
      delta: call.output.comparison.delta.open_world,
    })),
    quote_overlap_report: { before: quoteOverlapReport(calls, 'before'), after: quoteOverlapReport(calls, 'after') },
    stop: familyStop(calls, expectedCallCount),
  };
}
function legacyEvidence() {
  const artifact = readJson(LEGACY_PATH); const validation = checkLegacy(artifact);
  if (!validation.ok || artifact.calls.length !== 1 || artifact.stopped?.code !== 'OPEN_WORLD_RISE') throw new Error('LEGACY_SOL_STOP_INVALID');
  return artifact;
}
function initial() {
  const legacy = legacyEvidence();
  const callManifest = legacy.call_manifest.filter((call) => call.family === FAMILY);
  if (callManifest.length !== 8 || legacy.calls[0].call_id !== callManifest[0].call_id) throw new Error('FINANCING_MANIFEST_INVALID');
  const body = {
    schema_version: 'STAGE_2Y_PHASE_B_SOL_FINANCING_CONTINUATION/V2',
    purpose: 'Report-only continuation. Open-world is assessed at the complete family boundary.',
    source_probe: {
      path: LEGACY_PATH, sha256: fileHash(LEGACY_PATH), manifest_id: legacy.manifest_id,
      stopped: legacy.stopped, inherited_call_id: legacy.calls[0].call_id,
      inherited_receipt_id: legacy.calls[0].receipt_id,
    },
    cohort: { family: FAMILY, selected_sections: 8 },
    commands: {
      prepare: 'node scripts/stage-2y-phase-b-sol-financing-continuation.mjs --prepare',
      live: 'node scripts/stage-2y-phase-b-sol-financing-continuation.mjs --live --resume',
      check: 'node scripts/stage-2y-phase-b-sol-financing-continuation.mjs --check',
    },
    expected_call_count: 8, provider: PROFILE, call_manifest: callManifest,
    publication_authorisation: 'NONE', product_writes: false, serving_activated: false,
  };
  return { ...body, manifest_id: hash(body), calls: [legacy.calls[0]], family_summary: null, stopped: null };
}
function check(artifact) {
  const errors = []; const expected = initial(); const legacy = legacyEvidence();
  for (const key of ['schema_version', 'purpose', 'source_probe', 'cohort', 'commands', 'expected_call_count', 'provider', 'call_manifest', 'publication_authorisation', 'product_writes', 'serving_activated', 'manifest_id']) {
    if (canonical(artifact?.[key]) !== canonical(expected[key])) errors.push('MANIFEST_INVALID');
  }
  if (!Array.isArray(artifact?.calls) || artifact.calls.length < 1 || artifact.calls.length > 8) errors.push('CALL_SET_INVALID');
  const requestIds = new Set(); const terra = terraCallMap();
  for (const [index, call] of (artifact.calls || []).entries()) {
    const spec = expected.call_manifest[index]; const directory = spec && outputDirectory(spec); const { receipt_id: ignored, ...body } = call;
    if (!spec || call.call_id !== spec.call_id || canonical(call.spec) !== canonical(spec) || call.receipt_id !== hash(body)) errors.push('CALL_BINDING_INVALID');
    if (index === 0 && canonical(call) !== canonical(legacy.calls[0])) errors.push('INHERITED_CALL_INVALID');
    if (spec && canonical(call.generation_command) !== canonical([process.execPath, ...continuationRunnerArgs(spec, directory)])) errors.push('GENERATION_COMMAND_INVALID');
    if (!['COMPLETE', 'CALL_FAILED'].includes(call.state) || !Array.isArray(call.errors)) errors.push('CALL_STATE_INVALID');
    if (call.state === 'COMPLETE' && spec) {
      const requestId = call.output?.provider?.provider_request_ids?.[0];
      if (!requestId || call.output.provider.provider_request_ids.length !== 1 || requestIds.has(requestId)) errors.push('PROVIDER_REQUEST_INVALID'); else requestIds.add(requestId);
      try {
        const terraCall = terra.get(`${spec.deal}|${spec.family}|${spec.section_reference}`);
        if (!terraCall || canonical(call.output) !== canonical(collect(spec, directory, terraCall))) errors.push('OUTPUT_BINDING_INVALID');
      } catch { errors.push('OUTPUT_BINDING_INVALID'); }
    } else if (call.output !== null || call.errors.length === 0) errors.push('FAILED_CALL_INVALID');
  }
  let expectedSummary = null;
  try { expectedSummary = familySummary(artifact.calls || [], 8); } catch { errors.push('FAMILY_SUMMARY_INVALID'); }
  if (canonical(artifact?.family_summary) !== canonical(expectedSummary)) errors.push('FAMILY_SUMMARY_INVALID');
  const immediateRegression = (artifact.calls || []).some((call) => (call.output?.comparison?.previously_resolved_changes || []).length > 0);
  const failed = (artifact.calls || []).some((call) => call.state === 'CALL_FAILED');
  const expectedStop = failed ? 'CALL_FAILED' : immediateRegression ? 'PREVIOUSLY_RESOLVED_CHANGED' : expectedSummary?.stop || null;
  if ((artifact.stopped?.code || null) !== expectedStop) errors.push('STOP_BINDING_INVALID');
  if (artifact.stopped && artifact.stopped.last_call_id !== artifact.calls.at(-1)?.call_id) errors.push('STOP_BINDING_INVALID');
  return { ok: errors.length === 0, errors: [...new Set(errors)], status: artifact.stopped ? 'STOPPED' : artifact.calls?.length === 8 ? 'COMPLETE' : 'READY_OR_PARTIAL' };
}
async function run({ resume }) {
  assertPhaseBLiveAllowed('SOL_FINANCING_CONTINUATION');
  const artifact = resume && existsSync(resolve(ROOT, OUTPUT)) ? readJson(OUTPUT) : initial();
  const validation = check(artifact); if (!validation.ok) throw new Error(validation.errors.join(','));
  if (artifact.stopped) throw new Error(`SOL_FINANCING_CONTINUATION_STOPPED:${artifact.stopped.code}`);
  const terra = terraCallMap(); const completed = new Set(artifact.calls.map((call) => call.call_id));
  for (const call of artifact.call_manifest) {
    if (completed.has(call.call_id)) continue;
    const directory = outputDirectory(call); mkdirSync(directory, { recursive: true });
    const generationArgs = continuationRunnerArgs(call, directory); const started = new Date().toISOString();
    let state = 'COMPLETE'; let output = null; let errors = [];
    try {
      if (!existsSync(resolve(directory, 'resolution.json'))) await execFile(process.execPath, generationArgs, { cwd: ROOT, maxBuffer: 1024 * 1024 * 32 });
      const terraCall = terra.get(`${call.deal}|${call.family}|${call.section_reference}`);
      if (!terraCall) throw new Error('TERRA_COMPARATOR_MISSING'); output = collect(call, directory, terraCall);
    } catch (error) { state = 'CALL_FAILED'; errors = [String(error?.message || error)]; }
    const record = { call_id: call.call_id, spec: call, generation_command: [process.execPath, ...generationArgs], state, output, errors, started_at: started, completed_at: new Date().toISOString() };
    artifact.calls.push({ ...record, receipt_id: hash(record) });
    artifact.family_summary = familySummary(artifact.calls, 8);
    const stop = state === 'CALL_FAILED' ? 'CALL_FAILED'
      : output.comparison.previously_resolved_changes.length ? 'PREVIOUSLY_RESOLVED_CHANGED'
        : artifact.family_summary?.stop || null;
    if (stop) artifact.stopped = { code: stop, family: FAMILY, last_call_id: call.call_id, stopped_at: new Date().toISOString() };
    const latest = check(artifact); if (!latest.ok) throw new Error(latest.errors.join(','));
    writeAtomic(OUTPUT, artifact); if (artifact.stopped) break;
  }
  return artifact;
}
function parseArgs(argv) {
  const mode = argv.find((arg) => ['--prepare', '--live', '--check'].includes(arg));
  if (!mode || argv.some((arg) => ![mode, '--resume'].includes(arg)) || (mode !== '--live' && argv.includes('--resume'))) throw new Error('USAGE: --prepare | --live [--resume] | --check');
  return { mode, resume: argv.includes('--resume') };
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === '--prepare') { const artifact = initial(); writeAtomic(OUTPUT, artifact); process.stdout.write('Sol Financing continuation prepared: 1/8 inherited\n'); return; }
  if (args.mode === '--check') { const result = check(readJson(OUTPUT)); if (!result.ok) throw new Error(result.errors.join(',')); process.stdout.write(`${result.status}\n`); return; }
  const result = await run(args); process.stdout.write(`Sol Financing continuation: ${result.calls.length}/8; stopped=${result.stopped?.code || 'no'}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

export { FAMILY, familyStop, familySummary, initial, check, parseArgs };
