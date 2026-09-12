#!/usr/bin/env node
'use strict';

// Updates the hosted worker's checkout inside the persistent Vercel Sandbox
// (name in lib/product/sandbox-wake.js) to a branch tip, and reinstalls
// dependencies. The sandbox keeps its Codex login and CLI; only the product
// code and node_modules under /vercel/sandbox/pm-product change.
//
// Run from a machine that is logged in to Vercel (`vercel login`) and linked
// to the deal-corpus project (`vercel link`), from the repository root:
//
//   node scripts/product/update-sandbox-worker.js [branch]
//
// Default branch: codex/product-implementation-plan-20260904. Prints the
// commit the sandbox is on before and after. Exits non-zero if the sandbox
// checkout is not a git repository, so nothing is half-updated.

const { SANDBOX_NAME, SANDBOX_WORKDIR } = require('../../lib/product/sandbox-wake');

const REPO = 'https://github.com/CodeNameHash/precedent-machine.git';
const branch = process.argv[2] || 'codex/product-implementation-plan-20260904';
if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) {
  console.error('branch name contains unexpected characters');
  process.exit(64);
}

async function run(sandbox, cmd, args) {
  const cwd = cmd === 'sh' ? '/vercel/sandbox' : SANDBOX_WORKDIR;
  const command = await sandbox.runCommand({ cmd, args, cwd });
  const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
  if (command.exitCode !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${command.exitCode}\n${stderr || stdout}`);
  }
  return stdout.trim();
}

(async () => {
  const { Sandbox } = await import('@vercel/sandbox');
  const sandbox = await Sandbox.get({ name: SANDBOX_NAME, resume: true });
  const isGit = await run(sandbox, 'sh', ['-c', `test -d ${SANDBOX_WORKDIR}/.git && echo yes || echo no`]);
  if (isGit !== 'yes') {
    // The checkout lost its .git directory (seen 2026-09-12 after the
    // sandbox was re-created). Replace the whole directory with a fresh
    // clone; the Codex CLI and login live outside it and are untouched.
    console.log(`${SANDBOX_WORKDIR} is not a git checkout; contents: ${await run(sandbox, 'sh', ['-c', `ls -a ${SANDBOX_WORKDIR} | tr '\n' ' '`])}`);
    console.log(`re-cloning ${branch} into ${SANDBOX_WORKDIR}`);
    await run(sandbox, 'sh', ['-c', `rm -rf ${SANDBOX_WORKDIR}.new && git clone --quiet --depth 50 --branch ${branch} ${REPO} ${SANDBOX_WORKDIR}.new && rm -rf ${SANDBOX_WORKDIR} && mv ${SANDBOX_WORKDIR}.new ${SANDBOX_WORKDIR}`]);
  } else {
    const before = await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD']);
    console.log(`sandbox ${SANDBOX_NAME} at ${before} before update`);
    await run(sandbox, 'git', ['fetch', '--quiet', 'origin', branch]);
    await run(sandbox, 'git', ['checkout', '--quiet', '-B', branch, `origin/${branch}`]);
  }
  const after = await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD']);
  console.log(`checked out ${branch} at ${after}`);
  console.log(await run(sandbox, 'npm', ['ci', '--no-audit', '--no-fund', '--omit=dev']));
  const check = await run(sandbox, 'node', ['-e', "require('./lib/product/legal-schema-selection'); require('./lib/product/fact-components'); console.log('modules load')"]);
  console.log(check);
  console.log(`done: ${SANDBOX_NAME} now runs ${branch} at ${after}`);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
