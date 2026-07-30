#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  deriveSignerCoverage,
  runPilotIntegrationPreflight,
} = require('../lib/programme-gates/pilot-integration-preflight');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input') throw new Error('usage: pilot-integration-preflight.mjs --input <json>');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (gitArgs) => execFileSync('git', ['-C', root, ...gitArgs], { encoding: 'utf8' }).trim();
const supplied = JSON.parse(fs.readFileSync(args[1], 'utf8'));
const expected = supplied.main?.expected_commit;
if (!/^[a-f0-9]{40}$/.test(expected || '')) throw new Error('input.main.expected_commit must be an exact commit');
const signerSource = fs.readFileSync(
  path.join(root, 'scripts/sign-g0-evidence.mjs'),
  'utf8',
);
const reviewBasis = deriveSignerCoverage(signerSource, []).review_basis_commit;
const signerRequiredPaths = git([
  'diff',
  '--name-only',
  `${reviewBasis}..HEAD`,
]).split('\n').filter(Boolean).sort();
const registeredWorktrees = new Set(
  git(['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .filter(Boolean)
    .map((entry) => (
      entry.split('\n').find((line) => line.startsWith('worktree '))?.slice(9)
    ))
    .filter(Boolean)
    .map((location) => path.resolve(location)),
);
const requestedWorktrees = supplied.required_worktree_paths === undefined
  ? [root]
  : supplied.required_worktree_paths;
if (
  !Array.isArray(requestedWorktrees)
  || requestedWorktrees.length === 0
  || requestedWorktrees.some((location) => typeof location !== 'string')
) {
  throw new Error('input.required_worktree_paths must be a non-empty path array');
}
const worktrees = [...new Set(requestedWorktrees.map((location) => path.resolve(location)))]
  .map((location) => ({
    clean: registeredWorktrees.has(location)
      && git(['-C', location, 'status', '--porcelain']) === '',
  }));
const live = {
  ...supplied,
  main: { ...supplied.main, head: git(['rev-parse', 'main']), is_expected_ancestor: (() => { try { git(['merge-base', '--is-ancestor', expected, 'main']); return true; } catch { return false; } })() },
  candidate: { head: git(['rev-parse', 'HEAD']) },
  worktrees,
  changed_paths: git(['diff', '--name-only', `${expected}..HEAD`]).split('\n').filter(Boolean).sort(),
  signer: deriveSignerCoverage(signerSource, signerRequiredPaths),
  author: { ...supplied.author, email: git(['config', 'user.email']) },
};
const result = runPilotIntegrationPreflight(live);
for (const stage of result.stages) process.stdout.write(`Stage ${stage.stage}: ${stage.state} ${stage.name}${stage.blocker ? ` [${stage.blocker.code}]` : ''}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.state !== 'READY_FOR_INTEGRATION') process.exitCode = 1;
