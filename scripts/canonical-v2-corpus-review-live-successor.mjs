#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildCorpusReviewModel,
  isFinalCorpusRun,
  renderCorpusReview,
} from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_BATCH = 'evidence/canonical-v2/stage-2y-l-live-batch.json';
const DEFAULT_OUTPUT = 'evidence/canonical-v2/corpus-review-20260809-stage-2y-l-live-successor.html';
const LIVE_ROOT = 'evidence/canonical-v2/stage-2y-l-live-runs';
const SHA256 = /^[0-9a-f]{64}$/;
const LIVE_FILES = Object.freeze({
  run_manifest: 'run-manifest.json',
  source_reference: 'source-reference.json',
  run_receipt: 'run-receipt.json',
  adapter_result: 'adapter-result.json',
  call_telemetry: 'call-telemetry.json',
  recording: 'recording.json',
});

class CorpusReviewLiveSuccessorError extends Error {
  constructor(code, details = null) {
    super(details == null ? code : `${code}:${JSON.stringify(details)}`);
    this.name = 'CorpusReviewLiveSuccessorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, details = null) {
  throw new CorpusReviewLiveSuccessorError(code, details);
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(path, code = 'JSON_INVALID') {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(code, { path, cause: error.code || error.message });
  }
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256Canonical(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8'));
}

function artifactId(artifact) {
  const { artifact_id: ignored, ...body } = artifact;
  return sha256Canonical(body);
}

function validateStage2yLLiveCall({ repoRoot = DEFAULT_ROOT, record } = {}) {
  if (!plain(record) || record.state !== 'COMPLETE' || !plain(record.spec) || !plain(record.output)) {
    fail('LIVE_CALL_RECORD_INVALID');
  }
  const { spec, output } = record;
  if (spec.schema_version !== 'STAGE_2Y_L_LIVE_SECTION_CALL/V1') {
    fail('LIVE_CALL_SCHEMA_INVALID', { call_id: record.call_id, schema_version: spec.schema_version });
  }
  if (!SHA256.test(record.call_id || '') || spec.call_id !== record.call_id) {
    fail('LIVE_CALL_ID_INVALID', { call_id: record.call_id });
  }
  const expectedDirectory = `${LIVE_ROOT}/${record.call_id}`;
  if (output.output_directory !== expectedDirectory) {
    fail('LIVE_OUTPUT_PATH_INVALID', { call_id: record.call_id, path: output.output_directory });
  }
  const runDirectory = resolve(repoRoot, output.output_directory);
  if (runDirectory !== resolve(repoRoot, expectedDirectory)) {
    fail('LIVE_OUTPUT_PATH_INVALID', { call_id: record.call_id, path: output.output_directory });
  }
  const identity = output.run_identity;
  if (!plain(identity)
    || identity.deal !== spec.deal
    || identity.family !== spec.family
    || identity.requested_model_profile !== 'TERRA_MEDIUM'
    || canonicalJson(identity.section_references) !== canonicalJson([spec.section_reference])) {
    fail('LIVE_RUN_IDENTITY_INVALID', { call_id: record.call_id });
  }

  const digests = output.artifact_digests;
  if (!plain(digests)) fail('LIVE_ARTIFACT_DIGESTS_INVALID', { call_id: record.call_id });
  for (const [key, file] of Object.entries(LIVE_FILES)) {
    const expected = digests[key];
    const path = resolve(runDirectory, file);
    if (!SHA256.test(expected || '')) fail('LIVE_ARTIFACT_DIGESTS_INVALID', { call_id: record.call_id, key });
    if (!existsSync(path)) fail('LIVE_ARTIFACT_MISSING', { call_id: record.call_id, file });
    const actual = sha256Bytes(readFileSync(path));
    if (actual !== expected) fail('LIVE_ARTIFACT_DIGEST_MISMATCH', { call_id: record.call_id, file, expected, actual });
  }

  const manifest = readJson(resolve(runDirectory, 'run-manifest.json'), 'LIVE_MANIFEST_INVALID');
  if (manifest.schema_version !== 'GENERAL_EXTRACTION_RUN_MANIFEST/V1') {
    fail('LIVE_MANIFEST_SCHEMA_INVALID', { call_id: record.call_id, schema_version: manifest.schema_version });
  }
  if (manifest.deal !== spec.deal
    || manifest.section_family !== spec.family
    || canonicalJson(manifest.section_references) !== canonicalJson([spec.section_reference])) {
    fail('LIVE_MANIFEST_IDENTITY_MISMATCH', { call_id: record.call_id });
  }
  const receipt = readJson(resolve(runDirectory, 'run-receipt.json'), 'LIVE_RECEIPT_INVALID');
  if (receipt.schema_version !== 'NATIVE_EXTRACTION_RUN_RECEIPT/V1') {
    fail('LIVE_RECEIPT_SCHEMA_INVALID', { call_id: record.call_id, schema_version: receipt.schema_version });
  }
  const resolutionPath = resolve(runDirectory, 'resolution.json');
  if (!existsSync(resolutionPath)) fail('LIVE_RESOLUTION_MISSING', { call_id: record.call_id });
  const resolution = readJson(resolutionPath, 'LIVE_RESOLUTION_INVALID');
  if (!plain(resolution)
    || !Array.isArray(resolution.review_queue)
    || !Array.isArray(resolution.resolved)
    || !Array.isArray(resolution.open_world)) {
    fail('LIVE_RESOLUTION_SCHEMA_INVALID', { call_id: record.call_id });
  }
  return Object.freeze({
    call_id: record.call_id,
    deal: spec.deal,
    family: spec.family,
    section_reference: spec.section_reference,
    runName: `stage-2y-l-live-runs/${record.call_id}`,
  });
}

function baselineRun({ repoRoot, name }) {
  const directory = resolve(repoRoot, 'evidence/canonical-v2', name);
  for (const file of ['run-manifest.json', 'run-receipt.json', 'resolution.json']) {
    if (!existsSync(resolve(directory, file))) fail('BASELINE_RUN_ARTIFACT_MISSING', { name, file });
  }
  const manifest = readJson(resolve(directory, 'run-manifest.json'), 'BASELINE_MANIFEST_INVALID');
  if (manifest.schema_version !== 'GENERAL_EXTRACTION_RUN_MANIFEST/V1'
    || typeof manifest.deal !== 'string'
    || typeof manifest.section_family !== 'string') {
    fail('BASELINE_MANIFEST_SCHEMA_INVALID', { name });
  }
  return Object.freeze({ name, deal: manifest.deal, family: manifest.section_family });
}

function pairKey({ deal, family }) {
  return `${deal}\0${family}`;
}

function selectStage2yLLiveSuccessorCohort({
  repoRoot = DEFAULT_ROOT,
  batchPath = DEFAULT_BATCH,
} = {}) {
  const absoluteBatchPath = resolve(repoRoot, batchPath);
  const batch = readJson(absoluteBatchPath, 'LIVE_BATCH_INVALID');
  if (!plain(batch) || batch.schema_version !== 'STAGE_2Y_L_LIVE_BATCH/V1') {
    fail('LIVE_BATCH_SCHEMA_INVALID', { path: batchPath, schema_version: batch?.schema_version });
  }
  if (batch.expected_call_count !== 46
    || batch.actual_call_count !== 46
    || !Array.isArray(batch.calls)
    || batch.calls.length !== 46) {
    fail('LIVE_BATCH_CALL_COUNT_INVALID');
  }
  if (!Array.isArray(batch.call_manifest)
    || batch.call_manifest.length !== 46
    || batch.call_manifest_digest !== sha256Canonical(batch.call_manifest)) {
    fail('LIVE_BATCH_CALL_MANIFEST_INVALID');
  }
  if (batch.artifact_id !== artifactId(batch)) fail('LIVE_BATCH_DIGEST_MISMATCH');

  const seen = new Set();
  const liveRuns = batch.calls.map((record, index) => {
    if (seen.has(record?.call_id)) fail('LIVE_CALL_ID_DUPLICATE', { call_id: record?.call_id });
    seen.add(record?.call_id);
    if (canonicalJson(record?.spec) !== canonicalJson(batch.call_manifest[index])) {
      fail('LIVE_CALL_MANIFEST_MISMATCH', { call_id: record?.call_id, index });
    }
    return validateStage2yLLiveCall({ repoRoot, record });
  });

  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const baselines = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort()
    .map((name) => baselineRun({ repoRoot, name }));
  const touchedPairs = new Set(liveRuns.map(pairKey));
  const baselinePairCounts = new Map();
  for (const run of baselines) baselinePairCounts.set(pairKey(run), (baselinePairCounts.get(pairKey(run)) || 0) + 1);
  const retained = baselines.filter((run) => !touchedPairs.has(pairKey(run)));
  const removed = baselines.filter((run) => touchedPairs.has(pairKey(run)));
  const addedWithoutPredecessor = liveRuns
    .filter((run) => !baselinePairCounts.has(pairKey(run)))
    .map(({ deal, family }) => ({ deal, family }))
    .filter((pair, index, pairs) => pairs.findIndex((candidate) => pairKey(candidate) === pairKey(pair)) === index)
    .sort((left, right) => left.deal.localeCompare(right.deal) || left.family.localeCompare(right.family));
  const runNames = [...retained.map((run) => run.name), ...liveRuns.map((run) => run.runName)].sort();
  const pairCount = new Set([...retained, ...liveRuns].map(pairKey)).size;

  if (baselines.length !== 157
    || removed.length !== 18
    || runNames.length !== 185
    || pairCount !== 147
    || canonicalJson(addedWithoutPredecessor) !== canonicalJson([{ deal: 'modiv', family: 'FINANCING_COVENANTS' }])) {
    fail('LIVE_SUCCESSOR_COHORT_CARDINALITY_MISMATCH', {
      baseline_runs: baselines.length,
      removed_baseline_runs: removed.length,
      successor_runs: runNames.length,
      deal_family_pairs: pairCount,
      added_without_predecessor: addedWithoutPredecessor,
    });
  }

  return Object.freeze({
    runNames: Object.freeze(runNames),
    metadata: Object.freeze({
      schema_version: batch.schema_version,
      batch_artifact_id: batch.artifact_id,
      baseline_runs: baselines.length,
      removed_baseline_runs: removed.length,
      added_live_runs: liveRuns.length,
      successor_runs: runNames.length,
      deal_family_pairs: pairCount,
      added_without_predecessor: Object.freeze(addedWithoutPredecessor),
    }),
  });
}

function expectedStage2yLLiveSuccessorCorpusReview({ repoRoot = DEFAULT_ROOT, batchPath = DEFAULT_BATCH } = {}) {
  const cohort = selectStage2yLLiveSuccessorCohort({ repoRoot, batchPath });
  const model = buildCorpusReviewModel({ repoRoot, runNames: [...cohort.runNames] });
  const claimRows = model.runs.reduce((total, run) => total + run.claims.length, 0);
  if (model.runs.length !== 185 || model.excerptGroups.length !== 4161 || claimRows !== 5022) {
    fail('LIVE_SUCCESSOR_MODEL_CARDINALITY_MISMATCH', {
      runs: model.runs.length,
      cards: model.excerptGroups.length,
      claim_rows: claimRows,
    });
  }
  const html = renderCorpusReview(model, {
    title: 'Canonical V2 Stage 2Y-L live successor corpus review',
    heading: 'Canonical V2 Stage 2Y-L live successor corpus review',
    lede: 'Successor view from the sealed Stage 2Y-L live batch. It replaces 18 touched 2X-K baseline runs with all 46 live runs, including Modiv financing with no predecessor. The result is 185 runs across 147 deal and family pairs. Rates use resolved ÷ review_queue. Empty matrix cells mean no selected run for that deal and family.',
  });
  return Object.freeze({ cohort, model, html });
}

function writeStage2yLLiveSuccessorCorpusReviewArtifact({
  repoRoot = DEFAULT_ROOT,
  outputPath = DEFAULT_OUTPUT,
  batchPath = DEFAULT_BATCH,
} = {}) {
  const expected = expectedStage2yLLiveSuccessorCorpusReview({ repoRoot, batchPath });
  const output = resolve(repoRoot, outputPath);
  writeFileSync(output, expected.html);
  return Object.freeze({ outputPath: output, runs: expected.model.runs.length, cards: expected.model.excerptGroups.length });
}

function checkStage2yLLiveSuccessorCorpusReviewArtifact({
  repoRoot = DEFAULT_ROOT,
  outputPath = DEFAULT_OUTPUT,
  batchPath = DEFAULT_BATCH,
} = {}) {
  const expected = expectedStage2yLLiveSuccessorCorpusReview({ repoRoot, batchPath });
  const output = resolve(repoRoot, outputPath);
  if (!existsSync(output) || readFileSync(output, 'utf8') !== expected.html) {
    fail('STALE_LIVE_SUCCESSOR_CORPUS_REVIEW_ARTIFACT', { outputPath: output });
  }
  return Object.freeze({ outputPath: output, runs: expected.model.runs.length, cards: expected.model.excerptGroups.length });
}

function parseArgs(argv) {
  if (argv.length === 0) return { mode: 'write', outputPath: DEFAULT_OUTPUT };
  if ((argv[0] === '--write' || argv[0] === '--check') && argv.length <= 2) {
    return { mode: argv[0].slice(2), outputPath: argv[1] || DEFAULT_OUTPUT };
  }
  throw new Error('usage: canonical-v2-corpus-review-live-successor.mjs [--write|--check] [output-path]');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = args.mode === 'check'
    ? checkStage2yLLiveSuccessorCorpusReviewArtifact({ outputPath: args.outputPath })
    : writeStage2yLLiveSuccessorCorpusReviewArtifact({ outputPath: args.outputPath });
  process.stdout.write(`${args.mode === 'check' ? 'CHECKED ' : ''}${result.outputPath}\n${result.runs} runs, ${result.cards} cards\n`);
  return result;
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();

export {
  checkStage2yLLiveSuccessorCorpusReviewArtifact,
  CorpusReviewLiveSuccessorError,
  expectedStage2yLLiveSuccessorCorpusReview,
  main,
  parseArgs,
  selectStage2yLLiveSuccessorCohort,
  validateStage2yLLiveCall,
  writeStage2yLLiveSuccessorCorpusReviewArtifact,
};
