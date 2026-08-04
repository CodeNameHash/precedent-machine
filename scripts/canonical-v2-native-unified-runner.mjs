#!/usr/bin/env node

import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateUnifiedRunManifest } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

function usage() {
  throw new Error(
    'Usage: node scripts/canonical-v2-native-unified-runner.mjs '
      + '--mode=validate --manifest <path> | '
      + '--mode=execute --manifest <path> --controls <path> --artifact-root <path> --out <relative-path> '
      + '--checkpoint-dir <path> [--max-concurrency 1|2|3|4] | '
      + '--mode=execute-iteration-2 --manifest <path> --controls <path> --artifact-root <path> '
      + '--out iteration-2/execution-result.json --checkpoint-dir iteration-2/checkpoints '
      + '[--max-concurrency 1|2]',
  );
}

function parseArgs(argv) {
  let mode = null;
  let manifestPath = null;
  let controlsPath = null;
  let outPath = null;
  let checkpointDir = null;
  let artifactRoot = null;
  let maxConcurrency = 2;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith('--mode=')) mode = value.slice('--mode='.length);
    else if (value === '--manifest') manifestPath = argv[++index] || null;
    else if (value === '--controls') controlsPath = argv[++index] || null;
    else if (value === '--out') outPath = argv[++index] || null;
    else if (value === '--checkpoint-dir') checkpointDir = argv[++index] || null;
    else if (value === '--artifact-root') artifactRoot = argv[++index] || null;
    else if (value === '--max-concurrency') maxConcurrency = Number(argv[++index]);
    else usage();
  }
  if (!['validate', 'execute', 'execute-iteration-2'].includes(mode) || !manifestPath) usage();
  if (mode === 'validate' && (controlsPath || outPath || checkpointDir || artifactRoot || maxConcurrency !== 2)) usage();
  if (mode.startsWith('execute') && (!controlsPath || !outPath || !checkpointDir || !artifactRoot
    || !Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 4)) usage();
  if (mode === 'execute-iteration-2' && maxConcurrency > 2) usage();
  return {
    mode, manifestPath, controlsPath, outPath, checkpointDir, artifactRoot, maxConcurrency,
  };
}

function isInside(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    && pathFromRoot !== '..' && !isAbsolute(pathFromRoot));
}

function resolveArtifactRoot(value) {
  const candidate = resolve(process.cwd(), value);
  const stats = lstatSync(candidate);
  if (!stats.isDirectory()) throw new Error('--artifact-root must name an existing directory');
  return realpathSync(candidate);
}

function resolveArtifactPath(root, value, label) {
  if (isAbsolute(value)) throw new Error(`${label} must be relative to --artifact-root`);
  const candidate = resolve(root, value);
  if (!isInside(root, candidate)) throw new Error(`${label} escapes --artifact-root`);
  const parent = realpathSync(dirname(candidate));
  if (!isInside(root, parent)) throw new Error(`${label} parent escapes --artifact-root`);
  return candidate;
}

function prepareCheckpointDirectory(root, value) {
  const directory = resolveArtifactPath(root, value, '--checkpoint-dir');
  try {
    const stats = lstatSync(directory);
    if (!stats.isDirectory()) throw new Error('--checkpoint-dir must name a directory');
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
    mkdirSync(directory, { mode: 0o700 });
  }
  const realDirectory = realpathSync(directory);
  if (!isInside(root, realDirectory)) throw new Error('--checkpoint-dir resolves outside --artifact-root');
  const probe = resolve(realDirectory, '.checkpoint-write-probe');
  const descriptor = openSync(probe, 'wx', 0o600);
  closeSync(descriptor);
  unlinkSync(probe);
  return realDirectory;
}

function prepareFreshIteration2CheckpointDirectory(root, value) {
  if (value !== 'iteration-2/checkpoints') {
    throw new Error('iteration 2 checkpoint directory must be iteration-2/checkpoints');
  }
  const namespace = resolve(root, 'iteration-2');
  try {
    const stats = lstatSync(namespace);
    if (!stats.isDirectory()) throw new Error('iteration 2 artefact namespace must be a directory');
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
    mkdirSync(namespace, { mode: 0o700 });
  }
  const realNamespace = realpathSync(namespace);
  if (!isInside(root, realNamespace)) throw new Error('iteration 2 artefact namespace resolves outside --artifact-root');
  const directory = resolveArtifactPath(root, value, '--checkpoint-dir');
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error('iteration 2 checkpoint directory must be new and cannot resume or overwrite iteration 1');
    }
    throw error;
  }
  const realDirectory = realpathSync(directory);
  if (!isInside(realNamespace, realDirectory)) throw new Error('iteration 2 checkpoint directory resolves outside its artefact namespace');
  return realDirectory;
}

function readCheckpoints(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => JSON.parse(readFileSync(resolve(directory, entry.name), 'utf8')));
}

function persistCheckpoint(directory, checkpoint) {
  const destination = resolve(directory, `${checkpoint.checkpoint_id}.json`);
  try {
    writeFileSync(destination, `${JSON.stringify(checkpoint, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx', mode: 0o600,
    });
  } catch (error) {
    if (!error || error.code !== 'EEXIST') throw error;
    const existing = JSON.parse(readFileSync(destination, 'utf8'));
    if (existing.checkpoint_id !== checkpoint.checkpoint_id) throw error;
  }
}

let reservedOutput = null;
let reservedOutputPath = null;
try {
  const args = parseArgs(process.argv.slice(2));
  const { manifestPath } = args;
  const resolvedManifest = resolve(process.cwd(), manifestPath);
  const manifest = JSON.parse(readFileSync(resolvedManifest, 'utf8'));
  if (args.mode === 'validate') {
    const result = validateUnifiedRunManifest({ manifest, root_dir: process.cwd() });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    const {
      executeUnifiedRun,
      CONTROLS_SCHEMA,
      ITERATION_2_MAX_MODEL_INVOCATIONS,
      validateIteration2LiveLaunch,
    } = require('../lib/canonical-v2/native-producer/unified-runner-execute');
    const controls = JSON.parse(readFileSync(resolve(process.cwd(), args.controlsPath), 'utf8'));
    if (!controls || controls.schema_version !== CONTROLS_SCHEMA
      || JSON.stringify(Object.keys(controls).sort())
        !== JSON.stringify(['schema_version', 'work_item_controls'])) {
      throw new Error(`controls file must match ${CONTROLS_SCHEMA}`);
    }
    if (args.mode === 'execute-iteration-2') {
      validateIteration2LiveLaunch({ manifest, work_item_controls: controls.work_item_controls });
      if (args.outPath !== 'iteration-2/execution-result.json') {
        throw new Error('iteration 2 output path must be iteration-2/execution-result.json');
      }
    }
    const resolvedArtifactRoot = resolveArtifactRoot(args.artifactRoot);
    const resolvedCheckpointDir = args.mode === 'execute-iteration-2'
      ? prepareFreshIteration2CheckpointDirectory(resolvedArtifactRoot, args.checkpointDir)
      : prepareCheckpointDirectory(resolvedArtifactRoot, args.checkpointDir);
    const resolvedOut = resolveArtifactPath(resolvedArtifactRoot, args.outPath, '--out');
    if (isInside(resolvedCheckpointDir, resolvedOut)) {
      throw new Error('--out cannot be inside --checkpoint-dir');
    }
    reservedOutput = openSync(resolvedOut, 'wx', 0o600);
    reservedOutputPath = resolvedOut;
    const result = await executeUnifiedRun({
      manifest,
      work_item_controls: controls.work_item_controls,
      root_dir: process.cwd(),
      max_concurrency: args.maxConcurrency,
      ...(args.mode === 'execute-iteration-2'
        ? { max_model_invocations: ITERATION_2_MAX_MODEL_INVOCATIONS }
        : {}),
      resume_checkpoints: readCheckpoints(resolvedCheckpointDir),
      on_work_result: async (_workResult, checkpoint) => {
        persistCheckpoint(resolvedCheckpointDir, checkpoint);
      },
    });
    writeFileSync(reservedOutput, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8' });
    closeSync(reservedOutput);
    reservedOutput = null;
    reservedOutputPath = null;
    process.stdout.write(`${JSON.stringify({
      execution_result_id: result.execution_result_id,
      succeeded_count: result.succeeded_count,
      failed_count: result.failed_count,
      output_path: resolvedOut,
    })}\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'unified validation failed'}\n`);
  process.exitCode = 1;
} finally {
  if (reservedOutput !== null) closeSync(reservedOutput);
  if (reservedOutputPath) {
    try { unlinkSync(reservedOutputPath); } catch { /* reservation cleanup only */ }
  }
}
