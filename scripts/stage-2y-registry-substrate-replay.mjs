#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';
import { replayInput, replayReceipt } from './stage-2y-corroboration-ladder.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { MANIFEST, DIGEST: manifest_digest } = require('../lib/vocab/resolution/registry-substrate-manifest');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-registry-substrate-replay.json');
const REQUIRED = Object.freeze(['run-manifest.json', 'run-receipt.json', 'resolution.json', 'source-reference.json', 'recording.json']);
const hash = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const bytes = (file) => `sha256:${sha256Hex(readFileSync(file))}`;
const projection = (receipt) => {
  const { registry_substrate, resolution_receipt_id, ...stable } = receipt || {};
  return stable;
};
const collections = (resolution) => Object.fromEntries(Object.entries(resolution).filter(([key]) => key !== 'resolution_receipt'));
const errorCode = (error) => String(error?.message || error).split(':', 1)[0].replace(/\s+/g, '_');

async function replayRun(name, baselineRun = null) {
  const dir = resolve(ROOT, 'evidence/canonical-v2', name);
  const missing = REQUIRED.filter((file) => !existsSync(resolve(dir, file)));
  if (missing.length) return { name, outcome: 'EXCLUDED', reason: `MISSING_REQUIRED_INPUT:${missing.join(',')}` };
  const input_digests = Object.fromEntries(REQUIRED.map((file) => [file, bytes(resolve(dir, file))]));
  try {
    const manifest = json(resolve(dir, 'run-manifest.json'));
    const sourceReference = json(resolve(dir, 'source-reference.json'));
    const recording = json(resolve(dir, 'recording.json'));
    const oldReceipt = json(resolve(dir, 'run-receipt.json'));
    const committed = json(resolve(dir, 'resolution.json'));
    replayInput({ family: manifest.section_family, runName: name, manifest, sourceReference, recording, oldReceipt });
    const replayed = await replayReceipt({ family: manifest.section_family, runName: name, manifest, sourceReference, recording, oldReceipt });
    const committedSemantic = hash(collections(committed));
    const expectedSemantic = baselineRun?.semantic_output_digest || committedSemantic;
    const actualSemantic = hash(collections(replayed.resolution));
    const committedProjection = hash(projection(committed.resolution_receipt));
    const expectedProjection = baselineRun?.receipt_projection_digest || committedProjection;
    const actualProjection = hash(projection(replayed.resolution.resolution_receipt));
    if (expectedSemantic !== actualSemantic) {
      return { name, family: manifest.section_family, outcome: 'EXCLUDED', reason: 'SEMANTIC_OUTPUT_MISMATCH', input_digests, expected_semantic_output_digest: expectedSemantic, replayed_semantic_output_digest: actualSemantic, committed_semantic_output_digest: committedSemantic, expected_receipt_projection_digest: expectedProjection, committed_receipt_projection_digest: committedProjection, replayed_receipt_projection_digest: actualProjection, receipt_projection_match: expectedProjection === actualProjection };
    }
    return { name, family: manifest.section_family, outcome: 'INCLUDED', input_digests, semantic_output_digest: actualSemantic, receipt_projection_digest: actualProjection, receipt_projection_match: expectedProjection === actualProjection, expected_receipt_projection_digest: expectedProjection, committed_receipt_projection_digest: committedProjection, replay_coverage: replayed.coverage };
  } catch (error) {
    return { name, outcome: 'EXCLUDED', reason: errorCode(error), detail: String(error?.message || error), input_digests };
  }
}

async function build({ baseline = null } = {}) {
  const base = resolve(ROOT, 'evidence/canonical-v2');
  const run_names = readdirSync(base).filter(isFinalCorpusRun).sort();
  const runs = [];
  if (baseline && canonicalJson(baseline.run_names) !== canonicalJson(run_names)) throw new Error('BASELINE_RUN_SET_MISMATCH');
  for (const name of run_names) {
    if (baseline && !baseline.runs?.[name]) throw new Error(`BASELINE_RUN_MISSING:${name}`);
    runs.push(await replayRun(name, baseline?.runs?.[name] || null));
    process.stderr.write(`REPLAYED ${runs.length}/${run_names.length} ${name}\n`);
  }
  const included = runs.filter((run) => run.outcome === 'INCLUDED');
  const excluded = runs.filter((run) => run.outcome === 'EXCLUDED');
  return { schema_version: 'STAGE_2Y_REGISTRY_SUBSTRATE_REPLAY/V3', model_calls: 0, comparison_baseline: baseline ? { schema_version: baseline.schema_version, head_commit: baseline.head_commit, harness_patch_sha256: baseline.harness_patch_sha256, run_count: baseline.run_names.length } : { kind: 'COMMITTED_RESOLUTION_ARTIFACTS' }, registry_substrate: { manifest: MANIFEST, manifest_digest }, discovered_run_names: run_names, included_run_names: included.map((run) => run.name), excluded_runs: excluded.map(({ name, reason, detail }) => ({ name, reason, detail })), receipt_only_differences: included.filter((run) => run.receipt_projection_match === false).map((run) => ({ name: run.name, expected_receipt_projection_digest: run.expected_receipt_projection_digest, replayed_receipt_projection_digest: run.receipt_projection_digest })), runs };
}

function assertBaselineAcceptance(value, baseline) {
  if (!baseline) return;
  if (value.excluded_runs.length !== 0 || value.included_run_names.length !== baseline.run_names.length) throw new Error('BASELINE_REPLAY_INCOMPLETE');
  if (value.excluded_runs.some((run) => run.reason === 'SEMANTIC_OUTPUT_MISMATCH')) throw new Error('SEMANTIC_OUTPUT_MISMATCH');
}
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const baselineIndex = args.indexOf('--baseline');
  const baseline = baselineIndex === -1 ? null : json(resolve(ROOT, args[baselineIndex + 1] || 'BASELINE_PATH_REQUIRED'));
  const mode = args.find((arg) => arg === '--write' || arg === '--check');
  if (!mode || args.filter((arg) => arg === '--write' || arg === '--check').length !== 1 || (baselineIndex !== -1 && !args[baselineIndex + 1])) throw new Error('USAGE: use --write|--check [--baseline path]');
  const value = await build({ baseline });
  assertBaselineAcceptance(value, baseline);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (mode === '--write') {
    writeFileSync(OUTPUT, text);
    process.stdout.write(`WROTE ${OUTPUT}\n`);
  } else if (mode === '--check') {
    if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== text) throw new Error('STALE_OUTPUT');
    process.stdout.write(`CHECKED ${OUTPUT}\n`);
  }
}

export { assertBaselineAcceptance, build, projection, replayRun };
