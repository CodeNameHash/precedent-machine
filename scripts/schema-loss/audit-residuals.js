const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const WARNINGS_FILE = 'docs/schema-shape/claim-integrity-warnings.jsonl';
const OBSERVATIONS_FILE = 'docs/schema-shape/unmapped-observations.json';
const LONGTAIL_FILE = 'docs/schema-shape/unmapped-observations-longtail.jsonl';
const REJECTIONS_FILE = 'docs/schema-shape/unmapped-rejections.jsonl';

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((row) => stableStringify(row)).join('\n') + (rows.length ? '\n' : ''));
}

function signature(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function buildResidualAudit({ normalized, warnings }) {
  const b1Quarantines = new Set(
    warnings
      .filter((warning) => (warning.checks_failed || []).includes('B1'))
      .map((warning) => warning.claim_hash)
  );
  return {
    schema_version: 1,
    generated_at: '2026-07-07T00:00:00.000Z',
    generated_by: 'scripts/schema-loss/audit-residuals.js',
    source: {
      normalized_claims: (normalized.triples || []).length,
      b1_quarantined_claims: b1Quarantines.size,
      provision_source: 'not available in committed Phase 0-D artefacts',
    },
    note: 'Dimension A requires full Provision text. This deterministic queue stays empty until a provisions snapshot or live provisions table is available.',
    clusters: [],
  };
}

function run({
  normalizedFile = NORMALIZED_FILE,
  warningsFile = WARNINGS_FILE,
  observationsFile = OBSERVATIONS_FILE,
  longtailFile = LONGTAIL_FILE,
  rejectionsFile = REJECTIONS_FILE,
} = {}) {
  const normalized = readJson(normalizedFile, { triples: [] });
  const warnings = readJsonl(warningsFile);
  const audit = buildResidualAudit({ normalized, warnings });
  writeJson(observationsFile, audit);
  writeJsonl(longtailFile, []);
  if (!fs.existsSync(rejectionsFile)) writeJsonl(rejectionsFile, []);
  return audit;
}

if (require.main === module) {
  const audit = run();
  console.log(`wrote ${audit.clusters.length} unmapped-observation clusters to ${OBSERVATIONS_FILE}`);
}

module.exports = {
  buildResidualAudit,
  readJsonl,
  run,
  signature,
  stableStringify,
  writeJsonl,
};
