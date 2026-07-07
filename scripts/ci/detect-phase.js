#!/usr/bin/env node

const fs = require('fs');

function branchFromEnv(env = process.env) {
  return env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '';
}

function detectPhase(branchName) {
  return detectPhaseDetails(branchName).phase;
}

function detectPhaseDetails(branchName) {
  const branch = String(branchName || '').trim();
  if (branch === 'infra/ci-phase-detection-and-tail-recovery-allowlist') {
    return {
      rawPhase: 'WP-CI-INFRA-02',
      phase: 'WP-CI-INFRA-02',
    };
  }
  if (branch === 'infra/wp-branch-support') {
    return {
      rawPhase: 'WP-CI-INFRA-03',
      phase: 'WP-CI-INFRA-03',
    };
  }
  if (branch === 'plan/land-plan-system') {
    return {
      rawPhase: 'PLAN-SYSTEM',
      phase: 'PLAN-SYSTEM',
    };
  }
  const wpMatch = branch.match(/^wp\/([a-z0-9][a-z0-9-]*[a-z0-9])$/);
  if (wpMatch) {
    const slug = wpMatch[1];
    const phase = `WP-${slug.toUpperCase()}`;
    return { rawPhase: phase, phase };
  }
  const match = branch.match(/^phase-([^/]+)\//);
  if (!match) {
    throw new Error(`Branch name must match phase-{N}/*, wp/<slug>, plan/land-plan-system, or a hardcoded WP-CI-INFRA-* branch, got "${branch || '(empty)'}"`);
  }
  const rawPhase = match[1];
  return {
    rawPhase,
    phase: normalizeTailPhase(rawPhase),
  };
}

function normalizeTailPhase(phaseId) {
  const match = String(phaseId || '').match(/^([\w.-]+?)-tail(?:-(\d+))?$/);
  if (!match) return phaseId;
  const tailNum = match[2] ? Number(match[2]) : null;
  if (tailNum === null || tailNum <= 2) return match[1];
  return phaseId;
}

function writeCiState(phase, env = process.env, rawPhase = phase) {
  fs.writeFileSync('.phase-id', `${phase}\n`);
  fs.writeFileSync('.phase-raw-id', `${rawPhase}\n`);
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `phase=${phase}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `raw_phase=${rawPhase}\n`);
  }
  if (env.GITHUB_ENV) {
    fs.appendFileSync(env.GITHUB_ENV, `ACTIVE_PHASE=${phase}\n`);
    fs.appendFileSync(env.GITHUB_ENV, `RAW_PHASE_ID=${rawPhase}\n`);
  }
}

function main() {
  try {
    const details = detectPhaseDetails(process.argv[2] || branchFromEnv());
    writeCiState(details.phase, process.env, details.rawPhase);
    if (details.rawPhase !== details.phase) {
      process.stderr.write(`raw phase ${details.rawPhase} mapped to ${details.phase}\n`);
    }
    process.stdout.write(`${details.phase}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { branchFromEnv, detectPhase, detectPhaseDetails, normalizeTailPhase, writeCiState };
