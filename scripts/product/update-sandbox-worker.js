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

const branch = process.argv[2] || 'codex/product-implementation-plan-20260904';
if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) {
  console.error('branch name contains unexpected characters');
  process.exit(64);
}

async function run(sandbox, cmd, args) {
  const command = await sandbox.runCommand({ cmd, args, cwd: SANDBOX_WORKDIR });
  const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
  if (command.exitCode !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${command.exitCode}\n${stderr || stdout}`);
  }
  return stdout.trim();
}

(async () => {
  const { Sandbox } = await import('@vercel/sandbox');
  const sandbox = await Sandbox.get({ name: SANDBOX_NAME, resume: true });
  const isGit = await run(sandbox, 'sh', ['-c', 'test -d .git && echo yes || echo no']);
  if (isGit !== 'yes') {
    console.error(`${SANDBOX_WORKDIR} in sandbox ${SANDBOX_NAME} is not a git checkout; it must be re-created from the repository by hand.`);
    process.exit(78);
  }
  const before = await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD']);
  console.log(`sandbox ${SANDBOX_NAME} at ${before} before update`);
  await run(sandbox, 'git', ['fetch', '--quiet', 'origin', branch]);
  await run(sandbox, 'git', ['checkout', '--quiet', '-B', branch, `origin/${branch}`]);
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
