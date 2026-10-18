#!/usr/bin/env node
'use strict';

// Creates (or re-creates) the hosted worker sandbox that
// lib/product/sandbox-wake.js resumes, for any hosted provider (work
// package 4, plan finding (49); the sandbox idled for a month and no longer
// resumed: "Status code 400 is not ok: Cannot resume sandbox: no snapshot
// available"). Always: a persistent sandbox under the wake's name with
// snapshots that do not expire, the product branch cloned into
// /vercel/sandbox/pm-product, `npm ci --omit=dev`, /vercel/.codex (the
// launcher's flock file lives there for every path) and
// /vercel/sandbox/pm-cli, and a modules-load check. Per provider:
//   ANTHROPIC_API                    nothing more; the key arrives per wake.
//   ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION  @anthropic-ai/claude-code into pm-cli
//                                    (the launcher needs `claude` on PATH;
//                                    the OAuth token arrives per wake).
//   OPENAI_CODEX_CLI_SUBSCRIPTION      @openai/codex into pm-cli and the
//                                    Codex device login, completed in a
//                                    browser by the person running this.
// A sandbox that exists but cannot be resumed is treated as gone: its stale
// record is deleted and a fresh one created under the same name. Nothing
// here stores or prints a credential.
//
// Run from a shell with VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID
// set (lib/product/sandbox-wake.js sandboxCredentials), from the repository
// root:
//
//   node scripts/product/create-sandbox-worker.js [--provider ANTHROPIC_API] [--branch <branch>]
//
// The provider defaults to PRODUCT_MODEL_PROVIDER, else ANTHROPIC_API.

const { SANDBOX_NAME, SANDBOX_WORKDIR, MINIMUM_SESSION_MS, isSandboxGone, sandboxCredentials } = require('../../lib/product/sandbox-wake');
const { ANTHROPIC_API_PROVIDER_ID, CLAUDE_CLI_PROVIDER_ID, CODEX_PROVIDER_ID, isHostedProvider } = require('../../lib/product/product-model-config');

const REPO = 'https://github.com/CodeNameHash/precedent-machine.git';
const CLI_PREFIX = '/vercel/sandbox/pm-cli';
const DEFAULT_BRANCH = 'codex/product-implementation-plan-20260904';

// What each hosted provider needs in the sandbox beyond the product checkout.
const PROVIDER_SETUP = Object.freeze({
  [ANTHROPIC_API_PROVIDER_ID]: Object.freeze({ clis: [], binaries: [], login: false, modelModule: './lib/product/anthropic-api-model' }),
  [CLAUDE_CLI_PROVIDER_ID]: Object.freeze({ clis: ['@anthropic-ai/claude-code'], binaries: ['claude'], login: false, modelModule: './lib/product/claude-cli-model' }),
  [CODEX_PROVIDER_ID]: Object.freeze({ clis: ['@openai/codex'], binaries: ['codex'], login: true, modelModule: './lib/product/codex-cli-model' }),
});

function parseArguments(argv, env = process.env) {
  const options = { branch: DEFAULT_BRANCH, providerId: env.PRODUCT_MODEL_PROVIDER || ANTHROPIC_API_PROVIDER_ID };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--provider') { options.providerId = argv[index + 1]; index += 1; continue; }
    if (argument === '--branch') { options.branch = argv[index + 1]; index += 1; continue; }
    if (argument.startsWith('--')) throw new TypeError(`unknown option ${argument}`);
    options.branch = argument; // the earlier positional form
  }
  if (!/^[A-Za-z0-9._\/-]+$/.test(options.branch || '')) throw new TypeError('unexpected branch name');
  if (!isHostedProvider(options.providerId)) throw new TypeError(`--provider must be a hosted provider id (${Object.keys(PROVIDER_SETUP).join(', ')}), not ${options.providerId}`);
  return options;
}

async function run(sandbox, cmd, args, { cwd = '/vercel/sandbox', stream = false, stdout = process.stdout } = {}) {
  const command = await sandbox.runCommand({ cmd, args, cwd, detached: stream });
  if (stream) {
    for await (const line of command.logs()) stdout.write(`${line.data}`);
    const finished = await command.wait();
    if (finished.exitCode !== 0) throw new Error(`${cmd} exited ${finished.exitCode}`);
    return '';
  }
  const [out, err] = await Promise.all([command.stdout(), command.stderr()]);
  if (command.exitCode !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${command.exitCode}\n${err || out}`);
  return out.trim();
}

// Resume the named sandbox; null when it does not exist or cannot be
// resumed (its stale record deleted so the name is free again).
async function resumeOrClear(Sandbox, credentials, log) {
  try {
    return await Sandbox.get({ name: SANDBOX_NAME, resume: true, ...credentials });
  } catch (error) {
    if (!isSandboxGone(error)) throw error;
    log(`sandbox ${SANDBOX_NAME} cannot be resumed (${String(error.message || error).slice(0, 160)}); treating it as gone`);
  }
  try {
    const stale = await Sandbox.get({ name: SANDBOX_NAME, resume: false, ...credentials });
    if (stale && typeof stale.delete === 'function') {
      await stale.delete({ deleteOrphanSnapshots: true });
      log(`deleted the stale record of ${SANDBOX_NAME}`);
    }
  } catch (error) {
    if (!isSandboxGone(error)) log(`could not delete the stale record (${String(error.message || error).slice(0, 160)}); creating anyway`);
  }
  return null;
}

async function createSandboxWorker({ Sandbox, branch, providerId, credentials = sandboxCredentials(), log = console.log, stdout = process.stdout }) {
  const setup = PROVIDER_SETUP[providerId];
  if (!setup) throw new TypeError(`unsupported provider ${providerId}`);
  const existing = await resumeOrClear(Sandbox, credentials, log);
  if (existing) {
    log(`sandbox ${SANDBOX_NAME} already exists (${existing.sandboxId || existing.id || 'id unknown'}); use update-sandbox-worker.js instead`);
    return { created: false, sandboxId: existing.sandboxId || existing.id || null };
  }
  log(`creating persistent sandbox ${SANDBOX_NAME} for ${providerId}`);
  const sandbox = await Sandbox.create({
    name: SANDBOX_NAME, persistent: true, runtime: 'node22', timeout: MINIMUM_SESSION_MS,
    // A snapshot that never expires: the month-idle loss of 2026-10 does
    // not repeat.
    snapshotExpiration: 0,
    ...credentials,
  });
  const sandboxId = sandbox.sandboxId || sandbox.id || null;
  log(`created ${SANDBOX_NAME} (${sandboxId || 'id unknown'}); cloning ${branch} into ${SANDBOX_WORKDIR}`);
  await run(sandbox, 'git', ['clone', '--quiet', '--depth', '50', '--branch', branch, REPO, SANDBOX_WORKDIR]);
  const commit = await run(sandbox, 'git', ['rev-parse', '--short', 'HEAD'], { cwd: SANDBOX_WORKDIR });
  log(`checked out ${branch} at ${commit}`);
  log('installing product dependencies');
  await run(sandbox, 'npm', ['ci', '--no-audit', '--no-fund', '--omit=dev'], { cwd: SANDBOX_WORKDIR });
  await run(sandbox, 'sh', ['-c', `mkdir -p /vercel/.codex ${CLI_PREFIX}/bin`]);
  const installed = [];
  for (const cli of setup.clis) {
    log(`installing ${cli} into pm-cli`);
    await run(sandbox, 'npm', ['install', '-g', '--no-audit', '--no-fund', '--prefix', CLI_PREFIX, cli]);
    installed.push(cli);
  }
  for (const binary of setup.binaries) {
    log(`${binary}: ${await run(sandbox, 'sh', ['-c', `${CLI_PREFIX}/bin/${binary} --version`])}`);
  }
  log(await run(sandbox, 'node', ['-e', `require('./lib/product/legal-schema-selection'); require('${setup.modelModule}'); console.log('modules load')`], { cwd: SANDBOX_WORKDIR }));
  if (setup.login) {
    log('starting Codex device login inside the sandbox; follow the URL and code below');
    await run(sandbox, 'sh', ['-c', `PATH=${CLI_PREFIX}/bin:$PATH HOME=/vercel codex login --device-auth`], { stream: true, stdout });
    const hasAuth = await run(sandbox, 'sh', ['-c', 'test -f /vercel/.codex/auth.json && echo yes || echo no']);
    if (hasAuth !== 'yes') throw new Error('Codex login did not produce /vercel/.codex/auth.json; run this script again');
  }
  log(`done: ${SANDBOX_NAME} (${sandboxId || 'id unknown'}) on ${branch} at ${commit}, provider ${providerId}, CLIs installed: ${installed.length ? installed.join(', ') : 'none'}`);
  return { created: true, sandboxId, commit, providerId, clis: installed };
}

async function main(argv) {
  const options = parseArguments(argv);
  const { Sandbox } = await import('@vercel/sandbox');
  return createSandboxWorker({ Sandbox, ...options });
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message || error); process.exit(1); });
}

module.exports = { PROVIDER_SETUP, createSandboxWorker, parseArguments, resumeOrClear };
