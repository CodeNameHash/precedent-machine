#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runPilotIntegrationPreflight } = require('../lib/programme-gates/pilot-integration-preflight');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input') throw new Error('usage: pilot-integration-preflight.mjs --input <json>');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (gitArgs) => execFileSync('git', ['-C', root, ...gitArgs], { encoding: 'utf8' }).trim();
const supplied = JSON.parse(fs.readFileSync(args[1], 'utf8'));
const expected = supplied.main?.expected_commit;
if (!/^[a-f0-9]{40}$/.test(expected || '')) throw new Error('input.main.expected_commit must be an exact commit');
const worktrees = git(['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map((entry) => {
  const location = entry.split('\n').find((line) => line.startsWith('worktree '))?.slice(9);
  return { clean: location ? git(['-C', location, 'status', '--porcelain']) === '' : false };
});
const live = {
  ...supplied,
  main: { ...supplied.main, head: git(['rev-parse', 'main']), is_expected_ancestor: (() => { try { git(['merge-base', '--is-ancestor', expected, 'main']); return true; } catch { return false; } })() },
  worktrees,
  changed_paths: git(['diff', '--name-only', `${expected}..HEAD`]).split('\n').filter(Boolean).sort(),
  author: { ...supplied.author, email: git(['config', 'user.email']) },
};
const result = runPilotIntegrationPreflight(live);
for (const stage of result.stages) process.stdout.write(`Stage ${stage.stage}: ${stage.state} ${stage.name}${stage.blocker ? ` [${stage.blocker.code}]` : ''}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.state !== 'READY_FOR_INTEGRATION') process.exitCode = 1;
