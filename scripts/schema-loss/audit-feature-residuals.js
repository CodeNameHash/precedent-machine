// scripts/schema-loss/audit-feature-residuals.js — GAP-E residual-capture
// PLUMBING, offline pass (dimension C of /admin/schema-loss).
//
// Sibling of audit-residuals.js (dimension A) and audit-claim-integrity.js
// (dimension B). Reads the same committed claims snapshot those scripts
// read (NORMALIZED_FILE) and runs it through
// lib/schema-loss/residuals.js#computeFeatureResiduals, writing the result
// to FEATURE_RESIDUALS_FILE for the admin queue API to serve.
//
// Feature-gated: when RESIDUAL_CAPTURE_ENABLED is not on, `run()` still
// writes a valid (empty) artifact -- `entries: []`, `enabled: false` -- so
// the queue API never has to special-case a missing file. This is the ONLY
// place in the plumbing that touches the flag by default; every other
// caller of computeFeatureResiduals can pass an explicit `enabled` to
// override for a hermetic test.
const fs = require('node:fs');
const path = require('node:path');

const { computeFeatureResiduals, isResidualCaptureEnabled } = require('../../lib/schema-loss/residuals');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const FEATURE_RESIDUALS_FILE = 'docs/schema-shape/feature-residuals.json';

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run({
  normalizedFile = NORMALIZED_FILE,
  outFile = FEATURE_RESIDUALS_FILE,
  enabled,
} = {}) {
  const capture = enabled === undefined ? isResidualCaptureEnabled() : enabled;
  const normalized = readJson(normalizedFile, { triples: [] });
  const entries = computeFeatureResiduals(normalized.triples || [], { enabled: capture });
  const artifact = {
    schema_version: 1,
    generated_by: 'scripts/schema-loss/audit-feature-residuals.js',
    enabled: capture,
    source: {
      normalized_claims: (normalized.triples || []).length,
    },
    note: capture
      ? null
      : 'RESIDUAL_CAPTURE_ENABLED is off (default) -- this queue is intentionally empty. Flip the flag in a review environment to populate it.',
    entries,
  };
  writeJson(outFile, artifact);
  return artifact;
}

if (require.main === module) {
  const artifact = run();
  console.log(`wrote ${artifact.entries.length} feature-residual entries to ${FEATURE_RESIDUALS_FILE} (enabled=${artifact.enabled})`);
}

module.exports = { run, FEATURE_RESIDUALS_FILE, NORMALIZED_FILE };
