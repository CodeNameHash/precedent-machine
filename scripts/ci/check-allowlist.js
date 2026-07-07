#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { branchFromEnv, detectPhase } = require('./detect-phase');

function normalizeFile(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function globToRegExp(pattern) {
  const source = normalizeFile(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/§DOUBLESTAR§/g, '.*');
  return new RegExp(`^${source}$`);
}

function matchesPattern(file, pattern) {
  const target = normalizeFile(file);
  const pat = normalizeFile(pattern);
  if (!pat) return false;
  if (pat.endsWith('/')) return target.startsWith(pat);
  if (pat.includes('*')) return globToRegExp(pat).test(target);
  return target === pat || target.startsWith(`${pat}/`);
}

function readPhaseFromState(env = process.env) {
  if (env.ACTIVE_PHASE) return env.ACTIVE_PHASE;
  if (env.PHASE_ID) return env.PHASE_ID;
  if (fs.existsSync('.phase-id')) return fs.readFileSync('.phase-id', 'utf8').trim();
  return detectPhase(branchFromEnv(env));
}

function changedFiles(env = process.env) {
  if (env.CHANGED_FILES) {
    return env.CHANGED_FILES.split(/\r?\n/).map(normalizeFile).filter(Boolean);
  }
  const commandSets = [
    ['git', ['diff', '--name-only', 'origin/main...HEAD']],
    ['git', ['diff', '--name-only', 'main...HEAD']],
  ];
  for (const [cmd, args] of commandSets) {
    try {
      return execFileSync(cmd, args, { encoding: 'utf8' })
        .split(/\r?\n/)
        .map(normalizeFile)
        .filter(Boolean);
    } catch (_) {
      // Try the next base ref.
    }
  }
  throw new Error('Unable to compute changed files against main');
}

function loadAllowlist(phase) {
  const file = path.join('.github', 'phase-allowlists', `phase-${phase}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing allowlist for phase ${phase}: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function checkAllowlist(options = {}) {
  const phase = options.phase || readPhaseFromState();
  const files = options.files || (phase === '-1' ? [] : changedFiles());
  if (phase === '-1') {
    return { phase, files, denied: [], outside: [], bootstrap: true };
  }
  const allowlist = loadAllowlist(phase);
  const denied = [];
  const outside = [];
  for (const file of files) {
    if (allowlist.denied.some((pattern) => matchesPattern(file, pattern))) {
      denied.push(file);
      continue;
    }
    if (!allowlist.allowed.some((pattern) => matchesPattern(file, pattern))) {
      outside.push(file);
    }
  }
  return { phase, files, denied, outside };
}

function main() {
  try {
    const result = checkAllowlist();
    if (result.denied.length || result.outside.length) {
      if (result.denied.length) {
        process.stderr.write(`Denied files for phase ${result.phase}: ${result.denied.join(', ')}\n`);
      }
      if (result.outside.length) {
        process.stderr.write(`Files outside allowlist for phase ${result.phase}: ${result.outside.join(', ')}\n`);
      }
      process.exit(1);
    }
    const suffix = result.bootstrap ? ' bootstrap' : '';
    process.stdout.write(`PHASE-ALLOWLIST: PASS phase ${result.phase}${suffix}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAllowlist,
  changedFiles,
  globToRegExp,
  loadAllowlist,
  matchesPattern,
  normalizeFile,
  readPhaseFromState,
};
