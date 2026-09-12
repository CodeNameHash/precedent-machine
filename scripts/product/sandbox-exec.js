#!/usr/bin/env node
'use strict';

// Runs one shell command inside the hosted worker sandbox and prints its
// output. Operator tool for the private preview only (checking the checkout
// commit, stopping a stale worker). Nothing here prints a credential.
//
// Run from a machine logged in to Vercel and linked to the deal-corpus
// project, from the repository root:
//
//   node scripts/product/sandbox-exec.js "<shell command>"

const { SANDBOX_NAME, SANDBOX_WORKDIR } = require('../../lib/product/sandbox-wake');

const script = process.argv.slice(2).join(' ');
if (!script.trim()) { console.error('usage: sandbox-exec.js "<shell command>"'); process.exit(64); }

(async () => {
  const { Sandbox } = await import('@vercel/sandbox');
  const sandbox = await Sandbox.get({ name: SANDBOX_NAME, resume: true });
  const command = await sandbox.runCommand({ cmd: 'sh', args: ['-c', script], cwd: SANDBOX_WORKDIR });
  const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  process.exit(command.exitCode);
})().catch((error) => { console.error(error.message || error); process.exit(1); });
