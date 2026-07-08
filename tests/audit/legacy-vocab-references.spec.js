const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TARGETS,
  auditTargets,
  decisionForTarget,
  markdownForAudit,
  parseArgs,
  scanFileForTarget,
} = require('../../scripts/audit/legacy-vocab-references');

test('scanFileForTarget records concrete module and path references only', () => {
  const target = TARGETS.find((item) => item.target_path === 'lib/rubric.js');

  const refs = scanFileForTarget('scripts/example.js', [
    "const { FEATURES } = require('../lib/rubric');",
    'console.log(FEATURES);',
  ].join('\n'), target);

  assert.equal(refs.some((ref) => ref.kind === 'require'), true);
  assert.equal(refs.some((ref) => ref.kind === 'export-reference'), false);

  const unrelated = scanFileForTarget('scripts/unrelated.js', 'const FEATURES = {};', target);
  assert.deepEqual(unrelated, []);
});

test('auditTargets marks zero-reference targets as safe and referenced targets as unsafe', () => {
  const files = ['lib/caller.js', 'lib/clean.js'];
  const audit = auditTargets({
    files,
    readFile(file) {
      if (file === 'lib/caller.js') return "const { validateFeatures } = require('./feature-validation');";
      return 'module.exports = {};';
    },
  });

  const validation = audit.find((target) => target.target_path === 'lib/feature-validation.js');
  const aliases = audit.find((target) => target.target_path === 'lib/vocab/trigger-code-aliases.js');

  assert.equal(validation.codex_verdict, 'unsafe-live-references');
  assert.equal(validation.reference_count > 0, true);
  assert.equal(decisionForTarget(validation), 'defer');
  assert.equal(aliases.codex_verdict, 'safe-to-delete');
  assert.equal(decisionForTarget(aliases), 'delete');
});

test('markdown manifest records authorization, verdicts, decisions, and reference hash', () => {
  const audit = {
    targets: [{
      target_path: 'lib/example.js',
      target_exports: ['EXAMPLE'],
      semantic_role: 'Fixture role.',
      reference_count: 0,
      codex_verdict: 'safe-to-delete',
      exists: true,
      references: [],
    }],
  };

  const markdown = markdownForAudit(audit, '2026-07-08T00:00:00.000Z', 'abc123');

  assert.match(markdown, /Status: audited/);
  assert.match(markdown, /Authorization: Review Queue entry authorize-legacy-vocab-deletion approved by Ben/);
  assert.match(markdown, /Reference audit SHA-256: abc123/);
  assert.match(markdown, /Decision: delete/);
});

test('parseArgs accepts output paths and no-write mode', () => {
  assert.deepEqual(parseArgs([
    '--json', 'tmp/legacy.json',
    '--markdown', 'tmp/deletions.md',
    '--no-write',
  ]), {
    jsonPath: 'tmp/legacy.json',
    markdownPath: 'tmp/deletions.md',
    write: false,
  });
});
