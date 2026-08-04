#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function usage() {
  throw new Error(
    'Usage: node scripts/canonical-v2-assess-m3-attempt-3-live.mjs '
      + '--plan <path> --live-manifest <path> --live-execution <path> '
      + '--acceptance-checklist <path> --rubric <path> [--root-dir <path>]',
  );
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--plan') args.plan = argv[++index] || null;
    else if (value === '--live-manifest') args.liveManifest = argv[++index] || null;
    else if (value === '--live-execution') args.liveExecution = argv[++index] || null;
    else if (value === '--acceptance-checklist') args.checklist = argv[++index] || null;
    else if (value === '--rubric') args.rubric = argv[++index] || null;
    else if (value === '--root-dir') args.rootDir = argv[++index] || null;
    else usage();
  }
  if (!args.plan || !args.liveManifest || !args.liveExecution || !args.checklist || !args.rubric) usage();
  return args;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(resolve(process.cwd(), filePath), 'utf8'));
}

try {
  const args = parseArgs(process.argv.slice(2));
  const { assessAttempt3LiveOutputs } = require('../lib/canonical-v2/native-producer/m3-attempt-3-postrun-assessor');
  const result = assessAttempt3LiveOutputs({
    plan: readJson(args.plan),
    live_manifest: readJson(args.liveManifest),
    live_execution_result: readJson(args.liveExecution),
    acceptance_checklist: readJson(args.checklist),
    rubric: readJson(args.rubric),
    root_dir: args.rootDir ? resolve(process.cwd(), args.rootDir) : process.cwd(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'attempt-3 post-run assessment failed'}\n`);
  process.exitCode = 1;
}
