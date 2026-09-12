#!/usr/bin/env node
'use strict';

// Reports which Codex models the hosted worker sandbox can use with its
// ChatGPT login. The re-created sandbox installed the newest Codex CLI,
// which rejected gpt-5.4-mini for a ChatGPT account on the first V2 run
// (2026-09-12). This script runs one tiny prompt per candidate model inside
// the sandbox and prints accepted or the provider's error. It changes nothing.
//
// Run from a machine logged in to Vercel and linked to the deal-corpus
// project, from the repository root:
//
//   node scripts/product/probe-sandbox-models.js [model ...]

const { SANDBOX_NAME, SANDBOX_WORKDIR } = require('../../lib/product/sandbox-wake');

const CLI_PREFIX = '/vercel/sandbox/pm-cli';
const DEFAULT_CANDIDATES = ['gpt-5.4-mini', 'gpt-5.5', 'gpt-5.5-mini', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.1-codex-mini', 'gpt-5-codex-mini'];
const candidates = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CANDIDATES;
for (const model of candidates) {
  if (!/^[A-Za-z0-9._-]+$/.test(model)) { console.error(`unexpected model name: ${model}`); process.exit(64); }
}

async function sh(sandbox, script) {
  const command = await sandbox.runCommand({ cmd: 'sh', args: ['-c', script], cwd: SANDBOX_WORKDIR });
  const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
  return { exitCode: command.exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

function providerMessage(stdout) {
  const lines = stdout.split('\n').filter(Boolean);
  for (const line of lines.reverse()) {
    try {
      const event = JSON.parse(line);
      const message = event?.error?.message || (event.type === 'error' ? event.message : null);
      if (message) {
        try { return JSON.parse(message)?.error?.message || message; } catch { return message; }
      }
    } catch { /* not JSON */ }
  }
  return null;
}

(async () => {
  const { Sandbox } = await import('@vercel/sandbox');
  const sandbox = await Sandbox.get({ name: SANDBOX_NAME, resume: true });
  const env = `PATH=${CLI_PREFIX}/bin:$PATH HOME=/vercel`;
  console.log(`codex version: ${(await sh(sandbox, `${env} codex --version`)).stdout}`);
  console.log(`login: ${(await sh(sandbox, `${env} codex login status 2>&1`)).stdout}`);
  for (const model of candidates) {
    const result = await sh(sandbox, `${env} codex exec --model ${model} --sandbox read-only --skip-git-repo-check --json "Reply with the single word OK" 2>/dev/null`);
    const message = providerMessage(result.stdout);
    if (result.exitCode === 0 && !message) console.log(`${model}: accepted`);
    else console.log(`${model}: rejected (${message || `exit ${result.exitCode}`})`);
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
