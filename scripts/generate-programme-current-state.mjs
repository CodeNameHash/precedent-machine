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
const main = git(['rev-parse', 'main']);
const publication = '9552de2185b11d80bd1e2b80757f4f07005c58d1';
const worktrees = git(['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map((entry) => {
  const fields = Object.fromEntries(entry.split('\n').map((line) => line.split(' ', 2)));
  return { branch: fields.branch?.replace('refs/heads/', '') || 'DETACHED', commit: fields.HEAD };
}).filter((entry) => entry.branch.includes('pilot') || entry.branch.includes('integration'));
const record = {
  schema_version: 'ProgrammeCurrentState/V1', main_commit: main,
  publication: { commit: publication, generation: 44 }, current_work_package: 'PILOT_FREEZE_AND_VERTICAL_SLICE',
  open_gates: ['LEGAL_DECISION', 'FORMAL_FREEZE_COMPILATION'], active_branches_worktrees: worktrees,
  reserved_paths: JSON.parse(fs.readFileSync(path.join(root, '.github/phase-allowlists/wp-pilot-integration-state-preflight-v1.json'), 'utf8')).allowed,
  ready_integration_commits: [],
  machine_derived_blockers: ['DEPLOYMENT_METADATA_REQUIRED', 'TEST_RECEIPTS_REQUIRED', 'FORMAL_FREEZE_COMPILATION_REQUIRED']
};
const output = `${JSON.stringify(record, null, 2)}\n`;
if (args.has('--check')) { if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) process.exitCode = 1; }
else fs.writeFileSync(target, output);
