#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';
import { replayInput, replayReceipt } from './stage-2y-corroboration-ladder.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { MANIFEST, DIGEST: manifest_digest } = require('../lib/vocab/resolution/registry-substrate-manifest');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-registry-substrate-replay.json');
const BASELINE_OUTPUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-registry-substrate-head-baseline.json');
const REPLAY_HARNESS = resolve(ROOT, 'scripts/stage-2y-corroboration-ladder.mjs');
const BASELINE_COMMAND = (acceptedDiffPath) => `node scripts/stage-2y-registry-substrate-replay.mjs --write-baseline --accepted-diff ${acceptedDiffPath}`;
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
  if (baselineRun?.input_digests
      && canonicalJson(baselineRun.input_digests) !== canonicalJson(input_digests)) {
    return { name, outcome: 'EXCLUDED', reason: 'BASELINE_INPUT_DIGEST_MISMATCH', input_digests };
  }
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
    if (baselineRun?.replay_coverage
        && canonicalJson(baselineRun.replay_coverage) !== canonicalJson(replayed.coverage)) {
      return { name, family: manifest.section_family, outcome: 'EXCLUDED', reason: 'BASELINE_REPLAY_COVERAGE_MISMATCH', input_digests, replay_coverage: replayed.coverage };
    }
    if (expectedSemantic !== actualSemantic) {
      return { name, family: manifest.section_family, outcome: 'EXCLUDED', reason: 'SEMANTIC_OUTPUT_MISMATCH', input_digests, expected_semantic_output_digest: expectedSemantic, replayed_semantic_output_digest: actualSemantic, committed_semantic_output_digest: committedSemantic, expected_receipt_projection_digest: expectedProjection, committed_receipt_projection_digest: committedProjection, replayed_receipt_projection_digest: actualProjection, receipt_projection_match: expectedProjection === actualProjection, replay_coverage: replayed.coverage };
    }
    return { name, family: manifest.section_family, outcome: 'INCLUDED', input_digests, semantic_output_digest: actualSemantic, receipt_projection_digest: actualProjection, receipt_projection_match: expectedProjection === actualProjection, expected_receipt_projection_digest: expectedProjection, committed_receipt_projection_digest: committedProjection, replay_coverage: replayed.coverage };
  } catch (error) {
    return { name, outcome: 'EXCLUDED', reason: errorCode(error), detail: String(error?.message || error), input_digests };
  }
}

async function build({ baseline = null, generation_command: generationCommand = null } = {}) {
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
  return { schema_version: 'STAGE_2Y_REGISTRY_SUBSTRATE_REPLAY/V3', generation_command: generationCommand, model_calls: 0, comparison_baseline: baseline ? { schema_version: baseline.schema_version, head_commit: baseline.head_commit, replay_harness_sha256: baseline.replay_harness_sha256 || baseline.harness_patch_sha256, accepted_resolution_diff: baseline.accepted_resolution_diff || null, run_count: baseline.run_names.length } : { kind: 'COMMITTED_RESOLUTION_ARTIFACTS' }, registry_substrate: { manifest: MANIFEST, manifest_digest }, discovered_run_names: run_names, included_run_names: included.map((run) => run.name), excluded_runs: excluded.map(({ name, reason, detail }) => ({ name, reason, detail })), receipt_only_differences: included.filter((run) => run.receipt_projection_match === false).map((run) => ({ name: run.name, expected_receipt_projection_digest: run.expected_receipt_projection_digest, replayed_receipt_projection_digest: run.receipt_projection_digest })), runs };
}

function assertBaselineAcceptance(value, baseline) {
  if (!baseline) return;
  if (value.excluded_runs.length !== 0 || value.included_run_names.length !== baseline.run_names.length) throw new Error('BASELINE_REPLAY_INCOMPLETE');
  if (value.excluded_runs.some((run) => run.reason === 'SEMANTIC_OUTPUT_MISMATCH')) throw new Error('SEMANTIC_OUTPUT_MISMATCH');
}

function assertCleanCommittedTree({ status, head }) {
  if (typeof status !== 'string' || status.trim().length !== 0) throw new Error('BASELINE_WRITE_DIRTY_TREE');
  if (typeof head !== 'string' || !/^[a-f0-9]{40}$/.test(head)) throw new Error('BASELINE_WRITE_HEAD_INVALID');
  return head;
}

function assertSourceStateUnchanged(initial, final) {
  const initialHead = assertCleanCommittedTree(initial);
  const finalHead = assertCleanCommittedTree(final);
  if (initialHead !== finalHead) throw new Error('BASELINE_WRITE_HEAD_CHANGED');
  return finalHead;
}

function validateAcceptedDiff({ acceptedDiff, resolverSourceDigest }) {
  if (!acceptedDiff || acceptedDiff.schema_version !== 'STAGE_2Y_RESOLUTION_SET_DIFF/V1'
      || acceptedDiff.phase !== 'fixed' || acceptedDiff.authority !== 'OFFLINE_REPLAY_COMPARISON_ONLY'
      || acceptedDiff.publication_authorisation !== 'NONE') throw new Error('ACCEPTED_DIFF_INVALID');
  const { comparison_digest: comparisonDigest, ...body } = acceptedDiff;
  if (comparisonDigest !== hash(body)) throw new Error('ACCEPTED_DIFF_DIGEST_MISMATCH');
  if (acceptedDiff.resolver_source_digest !== resolverSourceDigest) throw new Error('ACCEPTED_DIFF_RESOLVER_DRIFT');
  if (acceptedDiff.summary?.moved_previously_resolved_claim_count !== 0
      || acceptedDiff.moved_previously_resolved_claims?.length !== 0) {
    throw new Error('ACCEPTED_DIFF_MOVED_PREVIOUSLY_RESOLVED');
  }
  if (acceptedDiff.summary?.replay_error_count !== 0 || acceptedDiff.replay_errors?.length !== 0) {
    throw new Error('ACCEPTED_DIFF_REPLAY_ERRORS');
  }
  if (acceptedDiff.summary?.open_world_rise_family_count !== 0
      || acceptedDiff.open_world_by_family?.some((row) => row.delta > 0)) {
    throw new Error('ACCEPTED_DIFF_OPEN_WORLD_RISE');
  }
  if (!Array.isArray(acceptedDiff.run_names)
      || acceptedDiff.summary?.run_count !== acceptedDiff.run_names.length) throw new Error('ACCEPTED_DIFF_RUN_SET_INVALID');
  return comparisonDigest;
}

function baselineRun(run) {
  if (!run || typeof run.name !== 'string' || typeof run.family !== 'string'
      || run.replay_coverage?.complete !== true || !run.input_digests) throw new Error('BASELINE_SOURCE_REPLAY_INCOMPLETE');
  const semanticOutputDigest = run.outcome === 'INCLUDED'
    ? run.semantic_output_digest
    : run.reason === 'SEMANTIC_OUTPUT_MISMATCH'
      ? run.replayed_semantic_output_digest
      : null;
  const receiptProjectionDigest = run.outcome === 'INCLUDED'
    ? run.receipt_projection_digest
    : run.reason === 'SEMANTIC_OUTPUT_MISMATCH'
      ? run.replayed_receipt_projection_digest
      : null;
  if (typeof semanticOutputDigest !== 'string' || typeof receiptProjectionDigest !== 'string') {
    throw new Error('BASELINE_SOURCE_REPLAY_ERROR');
  }
  return {
    family: run.family,
    input_digests: run.input_digests,
    semantic_output_digest: semanticOutputDigest,
    receipt_projection_digest: receiptProjectionDigest,
    replay_coverage: run.replay_coverage,
  };
}

function adoptedReplayDigest(runNames, runs) {
  return hash({ run_names: runNames, runs });
}

function assertAdoptedReplayMatch(replay, baseline) {
  if (canonicalJson(replay.discovered_run_names) !== canonicalJson(baseline.run_names)
      || replay.runs.length !== baseline.run_names.length) throw new Error('BASELINE_VERIFICATION_RUN_SET_MISMATCH');
  const runs = Object.fromEntries(replay.runs.map((run, index) => {
    if (run.name !== baseline.run_names[index]) throw new Error('BASELINE_VERIFICATION_RUN_ORDER_MISMATCH');
    return [run.name, baselineRun(run)];
  }));
  if (adoptedReplayDigest(baseline.run_names, runs) !== baseline.adopted_replay_digest) {
    throw new Error('BASELINE_VERIFICATION_ADOPTION_MISMATCH');
  }
}

function buildAcceptedBaseline({
  replay,
  accepted_diff: acceptedDiff,
  accepted_diff_path: acceptedDiffPath,
  accepted_diff_sha256: acceptedDiffSha256,
  head_commit: headCommit,
  replay_harness_sha256: replayHarnessSha256,
  resolver_source_digest: resolverSourceDigest,
}) {
  const comparisonDigest = validateAcceptedDiff({ acceptedDiff, resolverSourceDigest });
  if (!replay || canonicalJson(replay.discovered_run_names) !== canonicalJson(acceptedDiff.run_names)
      || !Array.isArray(replay.runs) || replay.runs.length !== acceptedDiff.run_names.length) {
    throw new Error('BASELINE_SOURCE_RUN_SET_MISMATCH');
  }
  const operationalErrors = replay.runs.filter((run) => run.outcome !== 'INCLUDED'
    && run.reason !== 'SEMANTIC_OUTPUT_MISMATCH');
  if (operationalErrors.length !== 0) throw new Error('BASELINE_SOURCE_REPLAY_ERROR');
  const runs = Object.fromEntries(replay.runs.map((run, index) => {
    if (run.name !== acceptedDiff.run_names[index]) throw new Error('BASELINE_SOURCE_RUN_ORDER_MISMATCH');
    return [run.name, baselineRun(run)];
  }));
  const generationCommand = BASELINE_COMMAND(acceptedDiffPath);
  return {
    schema_version: 'STAGE_2Y_REGISTRY_BASELINE/V2',
    generation_command: generationCommand,
    head_commit: headCommit,
    replay_harness_sha256: replayHarnessSha256,
    adopted_replay_digest: adoptedReplayDigest(acceptedDiff.run_names, runs),
    accepted_resolution_diff: {
      path: acceptedDiffPath,
      file_sha256: acceptedDiffSha256,
      comparison_digest: comparisonDigest,
      run_count: acceptedDiff.run_names.length,
    },
    run_names: acceptedDiff.run_names,
    runs,
    baseline_provenance: {
      generation_command: generationCommand,
      frozen_head: headCommit,
      replay_harness_path: 'scripts/stage-2y-corroboration-ladder.mjs',
      replay_harness_sha256: replayHarnessSha256,
      accepted_resolution_diff_path: acceptedDiffPath,
      accepted_resolution_diff_sha256: acceptedDiffSha256,
      accepted_resolution_diff_comparison_digest: comparisonDigest,
      adopted_replay_digest: adoptedReplayDigest(acceptedDiff.run_names, runs),
    },
  };
}

function writeAtomic(file, text) {
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, file);
}

function sourceState() {
  return {
    status: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  };
}

async function writeAcceptedBaseline(acceptedDiffArgument) {
  if (!acceptedDiffArgument || isAbsolute(acceptedDiffArgument)) throw new Error('ACCEPTED_DIFF_PATH_INVALID');
  const acceptedDiffFile = resolve(ROOT, acceptedDiffArgument);
  const acceptedDiffPath = relative(ROOT, acceptedDiffFile).replaceAll('\\', '/');
  if (acceptedDiffPath.startsWith('../') || !acceptedDiffPath.startsWith('evidence/canonical-v2/')) {
    throw new Error('ACCEPTED_DIFF_PATH_INVALID');
  }
  const initialSourceState = sourceState();
  const headCommit = assertCleanCommittedTree(initialSourceState);
  const acceptedDiff = json(acceptedDiffFile);
  const generationCommand = BASELINE_COMMAND(acceptedDiffPath);
  const replay = await build({ generation_command: generationCommand });
  const baseline = buildAcceptedBaseline({
    replay,
    accepted_diff: acceptedDiff,
    accepted_diff_path: acceptedDiffPath,
    accepted_diff_sha256: bytes(acceptedDiffFile),
    head_commit: headCommit,
    replay_harness_sha256: bytes(REPLAY_HARNESS),
    resolver_source_digest: bytes(resolve(ROOT, 'lib/canonical-v2/native-producer/candidate-resolution.js')),
  });
  const verifiedReplay = await build({ baseline, generation_command: generationCommand });
  assertBaselineAcceptance(verifiedReplay, baseline);
  if (verifiedReplay.receipt_only_differences.length !== 0) throw new Error('BASELINE_VERIFICATION_RECEIPT_DRIFT');
  assertAdoptedReplayMatch(verifiedReplay, baseline);
  assertSourceStateUnchanged(initialSourceState, sourceState());
  writeAtomic(BASELINE_OUTPUT, `${JSON.stringify(baseline, null, 2)}\n`);
  writeAtomic(OUTPUT, `${JSON.stringify(verifiedReplay, null, 2)}\n`);
  process.stdout.write(`WROTE ${BASELINE_OUTPUT}\nWROTE ${OUTPUT}\n`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--write-baseline') {
    if (args.length !== 3 || args[1] !== '--accepted-diff') {
      throw new Error('USAGE: use --write-baseline --accepted-diff evidence-path');
    }
    await writeAcceptedBaseline(args[2]);
    return;
  }
  const baselineIndex = args.indexOf('--baseline');
  const baseline = baselineIndex === -1 ? null : json(resolve(ROOT, args[baselineIndex + 1] || 'BASELINE_PATH_REQUIRED'));
  const mode = args.find((arg) => arg === '--write' || arg === '--check');
  if (!mode || args.filter((arg) => arg === '--write' || arg === '--check').length !== 1 || (baselineIndex !== -1 && !args[baselineIndex + 1])) throw new Error('USAGE: use --write|--check [--baseline path]');
  const value = await build({ baseline, generation_command: baseline?.baseline_provenance?.generation_command || null });
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
if (isMain) await main();

export { assertAdoptedReplayMatch, assertBaselineAcceptance, assertCleanCommittedTree, assertSourceStateUnchanged, build, buildAcceptedBaseline, projection, replayRun, validateAcceptedDiff, writeAcceptedBaseline };
