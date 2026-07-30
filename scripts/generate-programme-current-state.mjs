#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, '.github/pm-integration/current-state.json');
const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !['--check', '--write'].includes(arg)) || args.size !== 1) throw new Error('use exactly one of --check or --write');
const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const gitSucceeds = (args) => {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
};
const worktreeGit = (worktree, args) => execFileSync(
  'git',
  ['-C', worktree, ...args],
  { encoding: 'utf8' },
).trim();
const main = git(['rev-parse', 'origin/main']);
const publication = git(['rev-parse', 'origin/programme-status-publication-head']);
const currentBranch = git(['branch', '--show-current']);
const currentHead = git(['rev-parse', 'HEAD']);
const signedStatus = JSON.parse(git([
  'show',
  'origin/programme-status-publication-head:docs/certification/programme-gate-status-v2.json',
]));
const worktrees = git(['worktree', 'list', '--porcelain']).split('\n\n')
  .filter(Boolean)
  .map((entry) => Object.fromEntries(entry.split('\n').map((line) => {
    const separator = line.indexOf(' ');
    return separator < 0
      ? [line, true]
      : [line.slice(0, separator), line.slice(separator + 1)];
  })))
  .map((entry) => ({
    path: entry.worktree,
    branch: entry.branch?.replace('refs/heads/', '') || 'DETACHED',
  }))
  .filter((entry) => (
    entry.branch !== 'DETACHED'
    && gitSucceeds(['merge-base', '--is-ancestor', main, entry.branch])
  ));
const currentSubjects = new Set(
  git(['log', '--format=%s', currentHead]).split('\n').filter(Boolean),
);
const pendingCommits = (branch) => {
  if (branch === currentBranch) return [];
  return git(['cherry', currentHead, branch])
    .split('\n')
    .filter((line) => line.startsWith('+ '))
    .map((line) => line.slice(2))
    .filter((commit) => !currentSubjects.has(git(['show', '-s', '--format=%s', commit])));
};
const activeWorktrees = worktrees.map((entry) => ({
  ...entry,
  clean: worktreeGit(entry.path, ['status', '--porcelain']).length === 0,
  pending_commits: pendingCommits(entry.branch),
})).filter((entry) => (
  entry.branch === currentBranch
  || entry.pending_commits.length > 0
  || entry.clean === false
));
const phaseAllowlistPaths = (entry) => [
  ...new Set(entry.pending_commits.flatMap((commit) => git([
    'show',
    '--format=',
    '--name-only',
    commit,
    '--',
    '.github/phase-allowlists',
  ]).split('\n').filter(Boolean)))].sort();
const reservedPaths = new Set();
for (const entry of activeWorktrees) {
  if (entry.branch === currentBranch) continue;
  for (const allowlistPath of phaseAllowlistPaths(entry)) {
    let source;
    try {
      source = git(['show', `${entry.branch}:${allowlistPath}`]);
    } catch {
      source = fs.readFileSync(path.join(entry.path, allowlistPath), 'utf8');
    }
    for (const allowedPath of JSON.parse(source).allowed || []) {
      reservedPaths.add(allowedPath);
    }
  }
}
const openGates = signedStatus.ordered_gate_projection
  .filter((gate) => gate.state === 'OPEN')
  .map((gate) => gate.gate_id);
const blockers = [];
const testReceiptPath = path.join(
  root,
  '.github/pm-integration/test-receipts.json',
);
const receiptedCommits = fs.existsSync(testReceiptPath)
  ? new Set(JSON.parse(fs.readFileSync(testReceiptPath, 'utf8')).ready_commits || [])
  : new Set();
if (openGates.includes('P1_CONTRACT_FREEZE_ATTESTED')) {
  blockers.push('FORMAL_FREEZE_COMPILATION_REQUIRED');
}
if (!fs.existsSync(path.join(root, '.github/pm-integration/deployment-metadata.json'))) {
  blockers.push('DEPLOYMENT_METADATA_REQUIRED');
}
if (!fs.existsSync(testReceiptPath)) {
  blockers.push('TEST_RECEIPTS_REQUIRED');
}
const record = {
  schema_version: 'ProgrammeCurrentState/V1', main_commit: main,
  publication: { commit: publication, generation: signedStatus.generation }, current_work_package: 'PILOT_FREEZE_AND_VERTICAL_SLICE',
  open_gates: openGates,
  active_branches: activeWorktrees.map(({ branch }) => branch),
  reserved_paths: [...reservedPaths].sort(),
  ready_integration_commits: [...new Set(activeWorktrees.flatMap(
    (entry) => entry.pending_commits,
  ))].filter((commit) => receiptedCommits.has(commit)),
  machine_derived_blockers: blockers.sort(),
};
const output = `${JSON.stringify(record, null, 2)}\n`;
if (args.has('--check')) { if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) process.exitCode = 1; }
else fs.writeFileSync(target, output);
