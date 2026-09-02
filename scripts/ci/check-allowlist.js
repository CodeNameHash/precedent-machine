#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { branchFromEnv, detectPhase } = require('./detect-phase');

const MAX_CHANGED_FILES_BYTES = 8 * 1024 * 1024;
const RECOVERY_PHASE = 'WP-RECOVER-M7-20260812';

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

function isNormalisedConcreteFile(file) {
  if (typeof file !== 'string' || !file || file !== normalizeFile(file)) return false;
  if (path.posix.isAbsolute(file) || /^[A-Za-z]:\//.test(file)) return false;
  if (file.endsWith('/') || file.includes('*') || /[\0\r\n]/.test(file)) return false;
  if (file.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return false;
  return path.posix.normalize(file) === file;
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

function checkRecoveryAllowlist(phase, files, allowlist) {
  if (allowlist.phase !== RECOVERY_PHASE) {
    throw new Error(`Recovery allowlist must declare phase ${RECOVERY_PHASE}`);
  }
  if (!Array.isArray(allowlist.allowed)) {
    throw new Error('Recovery allowlist allowed entries must be an array');
  }
  const allowedSet = new Set();
  for (const file of allowlist.allowed) {
    if (!isNormalisedConcreteFile(file)) {
      throw new Error(`Recovery allowlist entry must be a normalised concrete file path: ${JSON.stringify(file)}`);
    }
    if (allowedSet.has(file)) {
      throw new Error(`Recovery allowlist contains duplicate allowed path: ${file}`);
    }
    allowedSet.add(file);
  }
  const fileSet = new Set();
  for (const file of files) {
    if (fileSet.has(file)) {
      throw new Error(`Recovery changed-file set contains duplicate changed-file path: ${file}`);
    }
    fileSet.add(file);
  }
  const denied = [];
  const outside = [];
  for (const file of files) {
    if (allowlist.denied.some((pattern) => matchesPattern(file, pattern))) {
      denied.push(file);
      continue;
    }
    if (!allowedSet.has(file)) outside.push(file);
  }
  const missing = allowlist.allowed.filter((file) => !fileSet.has(file));
  return { phase, files, denied, outside, missing };
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
  const allowlist = phase === RECOVERY_PHASE && options.allowlist
    ? options.allowlist
    : loadAllowlist(phase);
  if (phase === RECOVERY_PHASE) {
    return checkRecoveryAllowlist(phase, files, allowlist);
  }
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
    const missing = result.missing || [];
    if (result.denied.length || result.outside.length || missing.length) {
      if (result.denied.length) {
        process.stderr.write(`Denied files for phase ${result.phase}: ${result.denied.join(', ')}\n`);
      }
      if (result.outside.length) {
        process.stderr.write(`Files outside allowlist for phase ${result.phase}: ${result.outside.join(', ')}\n`);
      }
      if (missing.length) {
        process.stderr.write(`Allowed files missing from changed-file set for phase ${result.phase}: ${missing.join(', ')}\n`);
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
