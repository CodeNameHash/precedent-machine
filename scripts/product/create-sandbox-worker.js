#!/usr/bin/env node
'use strict';

// Re-creates the hosted worker sandbox when the named sandbox no longer
// exists in the deal-corpus project. Creates a persistent sandbox with the
// name lib/product/sandbox-wake.js resumes, clones the product branch into
// /vercel/sandbox/pm-product, installs dependencies, installs the Codex CLI
// into /vercel/sandbox/pm-cli, and starts the Codex device login so the
// person running this can complete it in a browser. Nothing here stores or
// prints a credential; the login file stays inside the sandbox.
//
// Run from a machine logged in to Vercel and linked to the deal-corpus
// project, from the repository root:
//
//   node scripts/product/create-sandbox-worker.js [branch]

const { SANDBOX_NAME, SANDBOX_WORKDIR, MINIMUM_SESSION_MS } = require('../../lib/product/sandbox-wake');

const REPO = 'https://github.com/CodeNameHash/precedent-machine.git';
const CLI_PREFIX = '/vercel/sandbox/pm-cli';
const branch = process.argv[2] || 'codex/product-implementation-plan-20260904';
if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) { console.error('unexpected branch name'); process.exit(64); }

async function run(sandbox, cmd, args, { cwd = '/vercel/sandbox', stream = false } = {}) {
  const command = await sandbox.runCommand({ cmd, args, cwd, detached: stream });
  if (stream) {
    for await (const line of command.logs()) process.stdout.write(`${line.data}`);
    const finished = await command.wait();
    if (finished.exitCode !== 0) throw new Error(`${cmd} exited ${finished.exitCode}`);
    return '';
  }
  const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
  if (command.exitCode !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${command.exitCode}\n${stderr || stdout}`);
  return stdout.trim();
}

(async () => {
  const { Sandbox } = await import('@vercel/sandbox');
  let sandbox;
  try {
    sandbox = await Sandbox.get({ name: SANDBOX_NAME, resume: true });
    console.log(`sandbox ${SANDBOX_NAME} already exists; use update-sandbox-worker.js instead`);
    process.exit(0);
  } catch (error) {
    if (!/not found/i.test(error.message || '')) throw error;
  }
  console.log(`creating persistent sandbox ${SANDBOX_NAME}`);
  sandbox = await Sandbox.create({ name: SANDBOX_NAME, persistent: true, runtime: 'node22', timeout: MINIMUM_SESSION_MS });
  console.log(`created; cloning ${branch} into ${SANDBOX_WORKDIR}`);
  await run(sandbox, 'git', ['clone', '--quiet', '--depth', '50', '--branch', branch, REPO, SANDBOX_WORKDIR]);
  console.log(`checked out ${await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD'], { cwd: SANDBOX_WORKDIR })}`);
  console.log('installing product dependencies');
  await run(sandbox, 'npm', ['ci', '--no-audit', '--no-fund', '--omit=dev'], { cwd: SANDBOX_WORKDIR });
  console.log('installing the Codex CLI into pm-cli');
  await run(sandbox, 'npm', ['install', '-g', '--no-audit', '--no-fund', '--prefix', CLI_PREFIX, '@openai/codex']);
  console.log(await run(sandbox, 'sh', ['-c', `${CLI_PREFIX}/bin/codex --version`]));
  console.log(await run(sandbox, 'node', ['-e', "require('./lib/product/legal-schema-selection'); require('./lib/product/codex-cli-model'); console.log('modules load')"], { cwd: SANDBOX_WORKDIR }));
  console.log('starting Codex device login inside the sandbox; follow the URL and code below');
  await run(sandbox, 'sh', ['-c', `PATH=${CLI_PREFIX}/bin:$PATH HOME=/vercel codex login --device-auth`], { stream: true });
  const hasAuth = await run(sandbox, 'sh', ['-c', 'test -f /vercel/.codex/auth.json && echo yes || echo no']);
  if (hasAuth !== 'yes') { console.error('Codex login did not produce /vercel/.codex/auth.json; run this script again'); process.exit(1); }
  console.log(`done: ${SANDBOX_NAME} ready on ${branch}; the app can now wake it for a run`);
})().catch((error) => { console.error(error.message || error); process.exit(1); });
