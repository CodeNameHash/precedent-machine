#!/usr/bin/env node
'use strict';

// Updates the hosted worker's checkout inside the persistent Vercel Sandboxes
// (the pool in lib/product/sandbox-pool.js) to a branch tip, and reinstalls
// dependencies. A sandbox keeps its CLIs and any login; only the product
// code and node_modules under /vercel/sandbox/pm-product change.
//
// Run from a shell with VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID
// set (lib/product/sandbox-wake.js sandboxCredentials), or from a machine
// logged in to Vercel and linked to the project, from the repository root:
//
//   node scripts/product/update-sandbox-worker.js [branch] [--name <sandbox>] [--force]
//
// Default branch: codex/product-implementation-plan-20260904. Without
// --name every sandbox of the pool is updated in turn (plan finding (140));
// with --name only that one. A sandbox whose launcher lock is held has a
// worker running on it and is skipped (an `npm ci` under a live worker
// removes the modules it may still load); --force updates it anyway.
// Prints the commit each sandbox is on before and after. Exits non-zero if
// a sandbox checkout is not a git repository, so nothing is half-updated.

const { SANDBOX_NAME, SANDBOX_POOL, SANDBOX_WORKDIR, isSandboxGone, sandboxCredentials } = require('../../lib/product/sandbox-wake');
const { isSandboxPoolName } = require('../../lib/product/sandbox-pool');

const REPO = 'https://github.com/CodeNameHash/precedent-machine.git';
const DEFAULT_BRANCH = 'codex/product-implementation-plan-20260904';
// The launcher's lock (infra/codex-sandbox-worker/launch.sh): held while a
// worker runs on the sandbox.
const WORKER_LOCK = '/vercel/.codex/pm-worker.lock';

// Work package 4 (plan finding (49)): a sandbox that no longer resumes is
// not updated, it is re-created; the message says which script does that.
function resumeFailureMessage(error, name = SANDBOX_NAME) {
  if (!isSandboxGone(error)) return null;
  return `sandbox ${name} no longer resumes (${String(error.message || error).slice(0, 160)}); re-create it with node scripts/product/create-sandbox-worker.js --provider <hosted provider id> --name ${name}`;
}

function parseArguments(argv) {
  const options = { branch: DEFAULT_BRANCH, names: [...SANDBOX_POOL], force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--name') {
      const name = argv[index + 1];
      if (!isSandboxPoolName(name, SANDBOX_POOL)) throw new TypeError(`--name must be a sandbox of the pool (${SANDBOX_POOL.join(', ')}), not ${name}`);
      options.names = [name];
      index += 1;
      continue;
    }
    if (argument === '--force') { options.force = true; continue; }
    if (argument === '--branch') { options.branch = argv[index + 1]; index += 1; continue; }
    if (argument.startsWith('--')) throw new TypeError(`unknown option ${argument}`);
    options.branch = argument;
  }
  if (!/^[A-Za-z0-9._\/-]+$/.test(options.branch || '')) throw new TypeError('branch name contains unexpected characters');
  return options;
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

// One sandbox. Returns { updated, skipped?, before?, after? }; a gone sandbox
// throws with resumeFailureMessage's line.
async function updateSandboxWorker({ Sandbox, name = SANDBOX_NAME, branch = DEFAULT_BRANCH, force = false, credentials = sandboxCredentials(), log = console.log }) {
  if (!isSandboxPoolName(name, SANDBOX_POOL)) throw new TypeError(`${name} is not a sandbox of the pool (${SANDBOX_POOL.join(', ')})`);
  let sandbox;
  try {
    sandbox = await Sandbox.get({ name, resume: true, ...credentials });
  } catch (error) {
    const gone = resumeFailureMessage(error, name);
    if (!gone) throw error;
    throw new Error(gone);
  }
  const lock = await run(sandbox, 'sh', ['-c', `test -e ${WORKER_LOCK} && flock -n ${WORKER_LOCK} true 2>/dev/null && echo free || { test -e ${WORKER_LOCK} && echo busy || echo free; }`]);
  if (lock === 'busy' && !force) {
    log(`skipped ${name}: a worker holds its launcher lock (${WORKER_LOCK}); update it when its run is READY or FAILED, or pass --force`);
    return { updated: false, skipped: 'WORKER_RUNNING' };
  }
  if (lock === 'busy') log(`updating ${name} under a running worker (--force)`);
  const isGit = await run(sandbox, 'sh', ['-c', `test -d ${SANDBOX_WORKDIR}/.git && echo yes || echo no`]);
  let before = null;
  if (isGit !== 'yes') {
    // The checkout lost its .git directory (seen 2026-09-12 after the
    // sandbox was re-created). Replace the whole directory with a fresh
    // clone; the CLIs and any login live outside it and are untouched.
    log(`${SANDBOX_WORKDIR} on ${name} is not a git checkout; contents: ${await run(sandbox, 'sh', ['-c', `ls -a ${SANDBOX_WORKDIR} | tr '\n' ' '`])}`);
    log(`re-cloning ${branch} into ${SANDBOX_WORKDIR}`);
    await run(sandbox, 'sh', ['-c', `rm -rf ${SANDBOX_WORKDIR}.new && git clone --quiet --depth 50 --branch ${branch} ${REPO} ${SANDBOX_WORKDIR}.new && rm -rf ${SANDBOX_WORKDIR} && mv ${SANDBOX_WORKDIR}.new ${SANDBOX_WORKDIR}`]);
  } else {
    before = await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD']);
    log(`sandbox ${name} at ${before} before update`);
    await run(sandbox, 'git', ['fetch', '--quiet', 'origin', branch]);
    await run(sandbox, 'git', ['checkout', '--quiet', '-B', branch, `origin/${branch}`]);
  }
  const after = await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD']);
  log(`checked out ${branch} at ${after}`);
  log(await run(sandbox, 'npm', ['ci', '--no-audit', '--no-fund', '--omit=dev']));
  log(await run(sandbox, 'node', ['-e', "require('./lib/product/legal-schema-selection'); require('./lib/product/fact-components'); console.log('modules load')"]));
  log(`done: ${name} now runs ${branch} at ${after}`);
  return { updated: true, before, after };
}

async function updateSandboxPool({ names = SANDBOX_POOL, ...rest }) {
  const results = {};
  for (const name of names) results[name] = await updateSandboxWorker({ name, ...rest });
  return results;
}

async function main(argv) {
  const { names, ...options } = parseArguments(argv);
  const { Sandbox } = await import('@vercel/sandbox');
  return updateSandboxPool({ Sandbox, names, ...options });
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message || error);
    process.exit(error instanceof TypeError ? 64 : 1);
  });
}

module.exports = { DEFAULT_BRANCH, WORKER_LOCK, parseArguments, resumeFailureMessage, updateSandboxPool, updateSandboxWorker };
