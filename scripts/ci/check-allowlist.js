#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { branchFromEnv, detectPhase } = require('./detect-phase');

const MAX_CHANGED_FILES_BYTES = 8 * 1024 * 1024;

const WP_CI_INFRA_02_ALLOWED = [
  'scripts/ci/detect-phase.js',
  'scripts/ci/check-allowlist.js',
  '.github/phase-allowlists/phase-0-B.json',
  'HANDOFF.md',
  'tests/ci/detect-phase.spec.js',
  'tests/ci/check-allowlist.spec.js',
];

const WP_CI_INFRA_03_ALLOWED = [
  'scripts/ci/detect-phase.js',
  'scripts/ci/check-allowlist.js',
  'tests/ci/detect-phase.spec.js',
  'tests/ci/check-allowlist.spec.js',
  'HANDOFF.md',
];

const PLAN_SYSTEM_ALLOWED = [
  '.github/phase-allowlists/phase-0-D.json',
  'PLAN.md',
  'PLAN-M1-review-queue.md',
  'PLAN-M2-schema-deploy.md',
  'PLAN-M3-ingest-seamless.md',
  'PLAN-M4-query.md',
  'PLAN-M5-ui-homogenized.md',
  'PLAN-TAXONOMY-GAPS.md',
  'docs/acks/ACK-MASTER-V1.reference.md',
  'pm-master-straitjacket.codex.md',
  'pm-wp-ux-shell.codex.md',
  'scripts/ci/detect-phase.js',
  'scripts/ci/check-allowlist.js',
  'tests/ci/detect-phase.spec.js',
  'tests/ci/check-allowlist.spec.js',
  'WORKLOG-P-1.md',
];

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
  if (env.CHANGED_FILES_FILE) {
    const file = String(env.CHANGED_FILES_FILE).trim();
    if (!file) throw new Error('CHANGED_FILES_FILE is empty');
    let stat;
    try {
      stat = fs.statSync(file);
    } catch (error) {
      throw new Error(`Unable to read CHANGED_FILES_FILE: ${error.message}`);
    }
    if (!stat.isFile()) throw new Error('CHANGED_FILES_FILE is not a regular file');
    if (stat.size === 0) throw new Error('CHANGED_FILES_FILE is empty');
    if (stat.size > MAX_CHANGED_FILES_BYTES) {
      throw new Error(`CHANGED_FILES_FILE exceeds ${MAX_CHANGED_FILES_BYTES} bytes`);
    }
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    if (lines.some((line) => !line || line !== line.trim())) {
      throw new Error('CHANGED_FILES_FILE contains an empty path or a path with leading or trailing whitespace');
    }
    const files = lines.map(normalizeFile);
    if (files.length === 0) throw new Error('CHANGED_FILES_FILE contains no paths');
    return files;
  }
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
  const phaseStr = String(phase || '');
  if (phaseStr.startsWith('WP-CI-INFRA-')) {
    throw new Error(`No allowlist file for infra phase ${phaseStr}`);
  }
  const wpMatch = phaseStr.match(/^WP-([A-Z0-9-]+)$/);
  if (wpMatch) {
    const slug = wpMatch[1].toLowerCase();
    const file = path.join('.github', 'phase-allowlists', `wp-${slug}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing WP allowlist for ${phaseStr}: ${file}`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const file = path.join('.github', 'phase-allowlists', `phase-${phaseStr}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing allowlist for phase ${phaseStr}: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isAlwaysAllowed(file) {
  return /^BLOCKED-.*\.md$/.test(normalizeFile(file));
}

function checkInfraAllowlist(phase, files) {
  const allowed = phase === 'WP-CI-INFRA-03' ? WP_CI_INFRA_03_ALLOWED : WP_CI_INFRA_02_ALLOWED;
  const outside = files.filter((file) => !isAlwaysAllowed(file) && !allowed.includes(file));
  return { phase, files, denied: [], outside };
}

function checkExactAllowlist(phase, files, allowed) {
  const outside = files.filter((file) => !isAlwaysAllowed(file) && !allowed.includes(file));
  return { phase, files, denied: [], outside };
}

function checkAllowlist(options = {}) {
  const phase = options.phase || readPhaseFromState();
  const files = options.files || (phase === '-1' ? [] : changedFiles());
  if (phase === '-1') {
    return { phase, files, denied: [], outside: [], bootstrap: true };
  }
  if (phase === 'WP-CI-INFRA-02' || phase === 'WP-CI-INFRA-03') {
    return checkInfraAllowlist(phase, files);
  }
  if (phase === 'PLAN-SYSTEM') {
    return checkExactAllowlist(phase, files, PLAN_SYSTEM_ALLOWED);
  }
  const allowlist = loadAllowlist(phase);
  const denied = [];
  const outside = [];
  for (const file of files) {
    if (isAlwaysAllowed(file)) continue;
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
  MAX_CHANGED_FILES_BYTES,
  checkAllowlist,
  changedFiles,
  globToRegExp,
  isAlwaysAllowed,
  loadAllowlist,
  matchesPattern,
  normalizeFile,
  readPhaseFromState,
};
