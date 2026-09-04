#!/usr/bin/env node

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ZERO_SHA = /^0{40}$/;
const SAFE_PREFIXES = Object.freeze([
  '.cursor/',
  '.github/workflows/',
  'docs/',
  'scripts/ci/',
]);
// These reviewed modules only serve the seven-family preview or inspect source
// authority. The baseline import graph does not load them. Every other lib/
// change remains an input candidate and runs the expensive gate.
const SAFE_EXACT_PATHS = new Set([
  'components/review-v2/SevenFamilyV1Surface.jsx',
  'lib/canonical-v2/phase1-authority-boundary-inventory.js',
  'lib/canonical-v2/seven-family-grouping-preview-source.js',
  'lib/canonical-v2/seven-family-v1-preview-deal.js',
  'lib/canonical-v2/seven-family-v2-review-evidence.js',
  'pages/design/canonical-v2-seven-family.js',
]);

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isKnownNonInput(file) {
  const normalized = normalizePath(file);
  if (!normalized || normalized !== normalized.trim()) return false;
  if (normalized.startsWith('tests/') && !normalized.startsWith('tests/fixtures/')) return true;
  return SAFE_EXACT_PATHS.has(normalized)
    || SAFE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function classifyChangedFiles(files) {
  const normalized = [...new Set((files || []).map(normalizePath).filter(Boolean))].sort();
  if (normalized.length === 0) {
    return { run: true, changedFiles: [], impactingFiles: [], reason: 'NO_DIFF_AVAILABLE' };
  }
  const impactingFiles = normalized.filter((file) => !isKnownNonInput(file));
  return {
    run: impactingFiles.length > 0,
    changedFiles: normalized,
    impactingFiles,
    reason: impactingFiles.length > 0 ? 'POSSIBLE_INPUT_CHANGE' : 'KNOWN_NON_INPUT_ONLY',
  };
}

function changedFilesFromEnvironment(env = process.env) {
  if (env.CHANGED_FILES) return env.CHANGED_FILES.split(/\r?\n/);
  const base = String(env.BASE_SHA || '').trim();
  const head = String(env.HEAD_SHA || '').trim();
  if (!base || !head || ZERO_SHA.test(base) || ZERO_SHA.test(head)) return [];
  try {
    return execFileSync('git', ['diff', '--no-renames', '--name-only', base, head], { encoding: 'utf8' })
      .split(/\r?\n/);
  } catch (_) {
    return [];
  }
}

function writeOutput(result, env = process.env) {
  const run = result.run ? 'true' : 'false';
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `run=${run}\nreason=${result.reason}\n`);
  }
  const detail = result.impactingFiles.length > 0
    ? `: ${result.impactingFiles.join(', ')}`
    : '';
  process.stdout.write(`BASELINE-MANIFEST-IMPACT: run=${run} ${result.reason}${detail}\n`);
}

function main() {
  const result = classifyChangedFiles(changedFilesFromEnvironment());
  writeOutput(result);
}

if (require.main === module) main();

module.exports = {
  SAFE_EXACT_PATHS,
  SAFE_PREFIXES,
  changedFilesFromEnvironment,
  classifyChangedFiles,
  isKnownNonInput,
  normalizePath,
  writeOutput,
};
