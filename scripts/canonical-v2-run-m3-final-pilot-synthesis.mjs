#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function usage() {
  throw new Error('Usage: node scripts/canonical-v2-run-m3-final-pilot-synthesis.mjs --artifact-root <path> --required-repair-commit <full-sha> [--required-repair-commit <full-sha>] [--out <relative-path>]');
}

function parseArgs(argv) {
  const args = { repairCommits: [], out: 'final-review/sealed-final-pilot-review-packet.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--artifact-root') args.artifactRoot = argv[++index] || null;
    else if (value === '--required-repair-commit') args.repairCommits.push(argv[++index] || null);
    else if (value === '--out') args.out = argv[++index] || null;
    else usage();
  }
  if (!args.artifactRoot || args.repairCommits.length === 0 || !args.out) usage();
  args.repairCommits.sort();
  return args;
}

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function git(root, args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim(); }
function verifiedCommits(root, commits) {
  return commits.map((commit) => {
    const full = git(root, ['rev-parse', '--verify', `${commit}^{commit}`]);
    try { execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', full, 'HEAD']); }
    catch { throw new Error(`Required repair commit is not an ancestor of HEAD: ${full}`); }
    return full;
  }).sort();
}
function outputPath(root, out) {
  const target = resolve(root, out);
  const relation = relative(root, target);
  if (!relation || relation === '..' || relation.startsWith('../')) throw new Error('--out must be a file below --artifact-root.');
  return target;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const artifactRoot = resolve(rootDir, args.artifactRoot);
  if (!existsSync(artifactRoot)) throw new Error('--artifact-root must exist.');
  const requiredRepairCommits = verifiedCommits(rootDir, args.repairCommits);
  const { buildFinalPilotSynthesis } = require('../lib/canonical-v2/native-producer/m3-final-pilot-synthesis');
  const result = await buildFinalPilotSynthesis({
    first_execution_result: readJson(resolve(artifactRoot, 'final-output/execution-result.json')),
    iteration_2_execution_result: readJson(resolve(artifactRoot, 'iteration-2/execution-result.json')),
    iteration_2_rerun_plan: readJson(resolve(artifactRoot, 'iteration-2-preparation/attempt-3/sealed-rerun-plan.json')),
    revised_decision_vector: readJson(resolve(artifactRoot, 'iteration-2-preparation/sealed-revised-decision-vector-v3.json')),
    repair_rerun_vector: readJson(resolve(artifactRoot, 'iteration-2-preparation/attempt-3/sealed-repair-rerun-vector-v1.json')),
    replay_only_results: [
      readJson(resolve(artifactRoot, 'iteration-2-preparation/attempt-3/replay-results/skechers-no-other-reps-3-28.json')),
      readJson(resolve(artifactRoot, 'iteration-2-preparation/attempt-3/replay-results/topbuild-termination-company-6-3.json')),
    ],
    required_repair_commits: requiredRepairCommits,
    present_repair_commits: requiredRepairCommits,
    root_dir: rootDir,
  });
  const target = outputPath(artifactRoot, args.out);
  if (existsSync(target)) throw new Error('The final review packet path already exists and cannot be overwritten.');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(result)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ final_review_packet_id: result.final_review_packet_id, output_path: target, model_call_count: result.model_call_count, legal_disposition: result.legal_disposition })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'final pilot synthesis failed'}\n`);
  process.exitCode = 1;
}
