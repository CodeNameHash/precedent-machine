#!/usr/bin/env node

const fs = require('fs');

function branchFromEnv(env = process.env) {
  return env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '';
}

function detectPhase(branchName) {
  const branch = String(branchName || '').trim();
  const match = branch.match(/^phase-([^/]+)\//);
  if (!match) {
    throw new Error(`Branch name must match phase-{N}/*, got "${branch || '(empty)'}"`);
  }
  return match[1];
}

function writeCiState(phase, env = process.env) {
  fs.writeFileSync('.phase-id', `${phase}\n`);
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `phase=${phase}\n`);
  }
  if (env.GITHUB_ENV) {
    fs.appendFileSync(env.GITHUB_ENV, `ACTIVE_PHASE=${phase}\n`);
  }
}

function main() {
  try {
    const phase = detectPhase(process.argv[2] || branchFromEnv());
    writeCiState(phase);
    process.stdout.write(`${phase}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { branchFromEnv, detectPhase, writeCiState };
