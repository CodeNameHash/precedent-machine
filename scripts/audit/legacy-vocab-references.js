#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.cwd();
const DEFAULT_JSON_PATH = 'docs/schema-migration/legacy-vocab-references.json';
const DEFAULT_MD_PATH = 'docs/schema-migration/deletions.md';

const TARGETS = [
  {
    target_path: 'lib/feature-validation.js',
    target_exports: ['validateFeatures', 'validateProvisionRow', 'validationSummary', 'unwrap', 'INFRA_KEYS'],
    semantic_role: 'Legacy adapter around schema validation for provision feature bags.',
  },
  {
    target_path: 'lib/expected-sets.js',
    target_exports: ['computeExpectedSets', 'analyzeDealCoverage', 'analyzeCorpusTaxonomy', 'familyType', 'provisionCode', 'isCanonicalCode', 'CURATED_CORE', 'CORE_THRESHOLD', 'COMMON_THRESHOLD'],
    semantic_role: 'Legacy expected-set and taxonomy-growth coverage helper.',
  },
  {
    target_path: 'lib/category-summary-features.js',
    target_exports: ['CATEGORY_SUMMARY_FEATURES'],
    semantic_role: 'Legacy per-category summary-table row configuration.',
  },
  {
    target_path: 'lib/taxonomy.js',
    target_exports: ['taxonomyForFeatureKey', 'labelForCode', 'isValidTaxonomyCode', 'formatDict', 'normalizeToCode', 'TERMF_TRIGGER_CODES', 'MERGER_FORMS', 'MAE_CARVEOUT_CODES', 'IOC_CATEGORY_CODES'],
    semantic_role: 'Legacy canonical tag dictionaries and feature-key taxonomy resolver.',
  },
  {
    target_path: 'lib/rubric.js',
    target_exports: ['PROVISION_TYPES', 'CODES', 'FEATURES', 'CITABLE_FEATURE_KEYS', 'getCodesForType', 'isValidCode', 'findCodeByAlias', 'getTypeLabel', 'getFeaturesForType', 'getFeaturesForCode'],
    semantic_role: 'Legacy provision-type, canonical-code, and feature-schema source.',
  },
  {
    target_path: 'lib/vocab/party-role-aliases.js',
    target_exports: ['PARTY_ROLE_ALIASES'],
    semantic_role: 'Legacy alias map for frozen party-role vocabulary normalisation.',
  },
  {
    target_path: 'lib/vocab/trigger-code-aliases.js',
    target_exports: ['TRIGGER_CODE_ALIASES'],
    semantic_role: 'Legacy alias map for frozen trigger-code vocabulary normalisation.',
  },
];

const EXCLUDED_DIRS = new Set(['.git', '.next', 'node_modules', 'coverage']);
const EXCLUDED_FILES = new Set([
  DEFAULT_JSON_PATH,
  DEFAULT_MD_PATH,
  'docs/market-registry/generated-v1.deduped.json',
  'docs/market-registry/generated-v1.json',
  'docs/market-registry/generated-v1.md',
  'docs/schema-shape/canonical-registry-v1.md',
  'docs/schema-shape/normalized-v1.json',
  'scripts/audit/legacy-vocab-references.js',
  'tests/audit/legacy-vocab-references.spec.js',
]);
const TEXT_EXTENSIONS = new Set(['.cjs', '.css', '.js', '.json', '.jsx', '.mjs', '.md', '.mmd', '.sql', '.ts', '.tsx', '.txt', '.yml', '.yaml']);

function normalizeFile(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    jsonPath: DEFAULT_JSON_PATH,
    markdownPath: DEFAULT_MD_PATH,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.jsonPath = argv[++index];
    else if (arg === '--markdown') args.markdownPath = argv[++index];
    else if (arg === '--no-write') args.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function repoFiles(dir = ROOT, root = ROOT, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      repoFiles(path.join(dir, entry.name), root, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const fullPath = path.join(dir, entry.name);
    const rel = normalizeFile(path.relative(root, fullPath));
    if (EXCLUDED_FILES.has(rel)) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(rel);
  }
  return files.sort();
}

function patternsForTarget(target) {
  const targetPath = normalizeFile(target.target_path);
  const base = targetPath.replace(/\.js$/, '');
  const moduleName = base.split('/').pop();
  return [
    { kind: 'require', pattern: new RegExp(`require\\(\\s*['"][^'"]*${escapeRegExp(base)}(?:\\.js)?['"]\\s*\\)`) },
    { kind: 'import', pattern: new RegExp(`from\\s+['"][^'"]*${escapeRegExp(base)}(?:\\.js)?['"]`) },
    { kind: 'path-reference', pattern: new RegExp(`\\b${escapeRegExp(targetPath)}\\b`) },
    { kind: 'relative-module-reference', pattern: new RegExp(`['"](?:\\.\\.?/|/)[^'"]*${escapeRegExp(moduleName)}(?:\\.js)?['"]`) },
  ];
}

function excerpt(line) {
  return String(line || '').trim().replace(/\s+/g, ' ').slice(0, 220);
}

function scanFileForTarget(file, text, target) {
  if (normalizeFile(file) === normalizeFile(target.target_path)) return [];
  const patterns = patternsForTarget(target);
  const body = String(text || '');
  const rows = [];
  const seen = new Set();
  body.split(/\r?\n/).forEach((line, offset) => {
    for (const item of patterns) {
      if (!item.pattern.test(line)) continue;
      const key = `${offset + 1}:${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        file: normalizeFile(file),
        line: offset + 1,
        kind: item.kind,
        excerpt: excerpt(line),
      });
    }
  });
  return rows;
}

function auditTargets(options = {}) {
  const files = options.files || repoFiles();
  const readFile = options.readFile || ((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
  return TARGETS.map((target) => {
    const references = [];
    for (const file of files) {
      references.push(...scanFileForTarget(file, readFile(file), target));
    }
    references.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind));
    return {
      ...target,
      exists: fs.existsSync(path.join(ROOT, target.target_path)),
      references,
      reference_count: references.length,
      codex_verdict: references.length === 0 ? 'safe-to-delete' : 'unsafe-live-references',
    };
  });
}

function decisionForTarget(target) {
  if (!target.exists) return 'delete';
  return target.reference_count === 0 ? 'delete' : 'defer';
}

function rationaleForTarget(target) {
  if (!target.exists) return 'Target already absent on main.';
  if (target.reference_count === 0) return 'Approved deletion workflow plus zero live references.';
  return `Live references remain (${target.reference_count}); excluded from deletion until callers migrate.`;
}

function markdownForAudit(audit, generatedAt, signature) {
  const lines = [
    '# WP-M2-04 Legacy Vocab Deletion Manifest',
    '',
    `Generated: ${generatedAt}`,
    'Status: audited',
    `Authorization: Review Queue entry authorize-legacy-vocab-deletion approved by Ben on 2026-07-08.`,
    `Reference audit SHA-256: ${signature}`,
    '',
    'This manifest is conservative: only targets with zero live references are marked `delete`. Targets with any live references are deferred and must not be removed in the deletion PR.',
    '',
  ];
  for (const target of audit.targets) {
    lines.push(
      `## ${target.target_path}`,
      '',
      `- Semantic role: ${target.semantic_role}`,
      `- Exports audited: ${target.target_exports.join(', ') || '(none)'}`,
      `- References remaining: ${target.reference_count}`,
      `- Codex verdict: ${target.codex_verdict}`,
      `- Decision: ${decisionForTarget(target)}`,
      `- Rationale: ${rationaleForTarget(target)}`,
      '- Reference detail: see `docs/schema-migration/legacy-vocab-references.json`',
      '',
    );
  }
  return lines.join('\n');
}

function buildAudit() {
  const generatedAt = new Date().toISOString();
  const targets = auditTargets();
  const audit = {
    schema_version: 1,
    generated_at: generatedAt,
    generated_by: 'scripts/audit/legacy-vocab-references.js',
    targets,
  };
  const signature = crypto.createHash('sha256').update(JSON.stringify(audit, null, 2)).digest('hex');
  return { audit, generatedAt, signature };
}

function run(options = {}) {
  const { audit, generatedAt, signature } = buildAudit();
  const markdown = markdownForAudit(audit, generatedAt, signature);
  if (options.write !== false) {
    fs.mkdirSync(path.dirname(options.jsonPath || DEFAULT_JSON_PATH), { recursive: true });
    fs.writeFileSync(options.jsonPath || DEFAULT_JSON_PATH, `${JSON.stringify(audit, null, 2)}\n`);
    fs.writeFileSync(options.markdownPath || DEFAULT_MD_PATH, markdown);
  }
  return { audit, generatedAt, signature, markdown };
}

function main() {
  try {
    const result = run(parseArgs());
    const safe = result.audit.targets.filter((target) => target.reference_count === 0).length;
    process.stdout.write(`Legacy vocab reference audit: ${result.audit.targets.length} targets, ${safe} safe-to-delete\n`);
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  TARGETS,
  auditTargets,
  decisionForTarget,
  markdownForAudit,
  parseArgs,
  patternsForTarget,
  scanFileForTarget,
};
