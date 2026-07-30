#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { authorisedPaths, deriveSignerCoverage, runPilotIntegrationPreflight, validateSignerPolicyEvolution } = require('../lib/programme-gates/pilot-integration-preflight');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input') throw new Error('usage: pilot-integration-preflight.mjs --input <json>');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitRaw = (gitArgs) => execFileSync('git', ['-C', root, ...gitArgs], { encoding: 'utf8' });
const git = (gitArgs) => gitRaw(gitArgs).trim();
const supplied = JSON.parse(fs.readFileSync(args[1], 'utf8'));
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
if (!exactKeys(supplied, ['additional_worktree_paths', 'evidence_paths'])
  || !Array.isArray(supplied.additional_worktree_paths)
  || supplied.additional_worktree_paths.some((value) => typeof value !== 'string')
  || !exactKeys(supplied.evidence_paths, [
    'deployment',
    'development_compiles',
    'test_receipts',
  ])
  || Object.values(supplied.evidence_paths).some(
    (value) => typeof value !== 'string' || value.length === 0,
  )) {
  throw new Error(
    'input must contain only additional_worktree_paths and the three evidence_paths',
  );
}
const localFile = (value) => {
  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('evidence path must be repository-local');
  return resolved;
};
const evidenceFile = (value) => {
  const resolved = path.isAbsolute(value) ? value : path.resolve(root, value);
  if (!fs.statSync(resolved).isFile()) {
    throw new Error('evidence path must identify a file');
  }
  return resolved;
};
const readEvidence = (key) => JSON.parse(fs.readFileSync(
  evidenceFile(supplied.evidence_paths[key]),
  'utf8',
));
const commandSucceeds = (command, commandArgs) => {
  try { execFileSync(command, commandArgs, { cwd: root, stdio: 'ignore' }); return true; } catch { return false; }
};
const protectedPublication = git(['rev-parse', 'origin/programme-status-publication-head']);
const signedStatus = JSON.parse(git(['show', `${protectedPublication}:docs/certification/programme-gate-status-v2.json`]));
const expected = signedStatus.code_commit;
if (!/^[a-f0-9]{40}$/.test(expected || '') || !/^[a-f0-9]{64}$/.test(signedStatus.specification_root || '') || !Number.isInteger(signedStatus.generation)) {
  throw new Error('protected signed publication has an invalid basis');
}
const candidate = git(['rev-parse', 'HEAD']);
const successorRoot = path.join(root, 'contracts/canonical-v2/successor');
const successorManifest = JSON.parse(fs.readFileSync(path.join(successorRoot, 'manifest.json'), 'utf8'));
const manifestFresh = commandSucceeds(process.execPath, [path.join(root, 'scripts/generate-canonical-v2-successor-manifest.mjs'), '--check', '--root', successorRoot]);
const manifestCount = Array.isArray(successorManifest.members) ? successorManifest.members.length : -1;
const countJsonFiles = (directory) => fs.readdirSync(directory, {
  withFileTypes: true,
}).reduce((count, entry) => {
  if (entry.name === 'manifest.json') return count;
  const member = path.join(directory, entry.name);
  if (entry.isDirectory()) return count + countJsonFiles(member);
  return count + (entry.isFile() && entry.name.endsWith('.json') ? 1 : 0);
}, 0);
const actualContractCount = countJsonFiles(successorRoot);
const changedPaths = git(['diff', '--name-only', `${expected}..${candidate}`]).split('\n').filter(Boolean).sort();
const allowlistPaths = git(['diff', '--name-only', `${expected}..${candidate}`, '--', '.github/phase-allowlists'])
  .split('\n').filter(Boolean).sort();
let allowedPaths = [];
let allowlistValid = true;
try {
  allowedPaths = [...new Set(allowlistPaths.flatMap((allowlistPath) => authorisedPaths(
    JSON.parse(fs.readFileSync(path.join(root, allowlistPath), 'utf8')),
  )))].sort();
} catch {
  allowlistValid = false;
}
const candidateSignerSource = fs.readFileSync(path.join(root, 'scripts/sign-g0-evidence.mjs'), 'utf8');
const trustedSignerSource = gitRaw(['show', `${expected}:scripts/sign-g0-evidence.mjs`]);
const signerBasis = deriveSignerCoverage(trustedSignerSource, []).review_basis_commit;
const signerRequiredPaths = git(['diff', '--name-only', `${signerBasis}..${candidate}`]).split('\n').filter(Boolean).sort();
const registeredWorktrees = new Set(git(['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean)
  .map((entry) => entry.split('\n').find((line) => line.startsWith('worktree '))?.slice(9))
  .filter(Boolean).map((location) => path.resolve(location)));
const requestedWorktrees = [root, ...supplied.additional_worktree_paths.map(localFile)];
const worktrees = [...new Set(requestedWorktrees)].map((location) => ({
  clean: registeredWorktrees.has(location) && git(['-C', location, 'status', '--porcelain']) === '',
}));
const live = {
  main: { expected_commit: expected, head: git(['rev-parse', 'main']), is_expected_ancestor: (() => { try { git(['merge-base', '--is-ancestor', expected, 'main']); return true; } catch { return false; } })() },
  candidate: { head: candidate }, worktrees, changed_paths: changedPaths, allowed_paths: allowedPaths, allowlist_valid: allowlistValid,
  signer: validateSignerPolicyEvolution(trustedSignerSource, candidateSignerSource, signerRequiredPaths),
  author: { email: git(['config', 'user.email']), verified_aliases: [] },
  publication: { commit: protectedPublication, generation: signedStatus.generation },
  specification_root: signedStatus.specification_root,
  evidence: {
    manifest: { schema_version: 'PilotIntegrationManifestReceipt/V1', candidate_commit: candidate, specification_root: signedStatus.specification_root, registered: manifestFresh, actual_count: actualContractCount, expected_count: manifestCount },
    development_compiles: readEvidence('development_compiles'),
    deployment: readEvidence('deployment'),
    test_receipts: readEvidence('test_receipts'),
  },
};
const result = runPilotIntegrationPreflight(live);
for (const stage of result.stages) process.stdout.write(`Stage ${stage.stage}: ${stage.state} ${stage.name}${stage.blocker ? ` [${stage.blocker.code}]` : ''}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.state !== 'READY_FOR_INTEGRATION') process.exitCode = 1;
