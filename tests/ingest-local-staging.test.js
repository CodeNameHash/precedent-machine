// tests/ingest-local-staging.test.js — WP-7 (M5-06): scripts/ingest-local.js
// additive --file/--staging/--source-url flags used by scripts/demo-dryrun.js.
//
// parseArgs() is pure and exported — tested directly (real behavior, not
// text matching). ingestOne()'s staging branch calls through
// extractDealMetadata -> several chained LLM calls (base extraction, an
// optional sponsor second pass, value derivation) that aren't practically
// fakeable without reimplementing lib/ingest/deal-metadata-prompt.js's
// contract — that path is covered by the acceptance-gate live run instead
// (see the WP-7 report). The metadata/insert-shape conditional itself is
// small and reviewed directly here via source assertion, matching the
// pattern tests/admin/processing-flow.spec.js already uses for files this
// runner can't safely execute end-to-end.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { parseArgs } = require('../scripts/ingest-local');

test('parseArgs: --url/--manifest-only behavior is unchanged (no --file/--staging present)', () => {
  const args = parseArgs(['node', 'ingest-local.js', '--url', 'https://example.com/ex21.htm']);
  assert.equal(args.url, 'https://example.com/ex21.htm');
  assert.equal(args.file, null);
  assert.equal(args.staging, false);
  assert.equal(args.sourceUrl, null);
});

test('parseArgs: --file alone is now sufficient (no --url/--manifest required)', () => {
  const args = parseArgs(['node', 'ingest-local.js', '--file', '/tmp/fixture.txt']);
  assert.equal(args.file, '/tmp/fixture.txt');
  assert.equal(args.url, null);
});

test('parseArgs: --staging and --source-url compose with --file', () => {
  const args = parseArgs(['node', 'ingest-local.js', '--file', '/tmp/fixture.txt', '--staging', '--backend', 'codex', '--source-url', 'https://sec.gov/x.htm']);
  assert.equal(args.staging, true);
  assert.equal(args.backend, 'codex');
  assert.equal(args.sourceUrl, 'https://sec.gov/x.htm');
});

test('parseArgs: still requires one of --url/--manifest/--file', () => {
  const originalExit = process.exit;
  const originalError = console.error;
  let exitCode = null;
  let errMsg = null;
  process.exit = (code) => { exitCode = code; throw new Error('__exit__'); };
  console.error = (msg) => { errMsg = msg; };
  try {
    assert.throws(() => parseArgs(['node', 'ingest-local.js']), /__exit__/);
    assert.equal(exitCode, 1);
    assert.match(errMsg, /--file/);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
});

function readSource(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

test('ingest-local.js: --staging renames the target to DRYRUN-<timestamp> and stamps ingest_status/dryrun, additively only', () => {
  const src = readSource('scripts/ingest-local.js');
  assert.match(src, /pipelineOpts\.staging/);
  assert.match(src, /`DRYRUN-\$\{Date\.now\(\)\}`/);
  assert.match(src, /ingest_status:\s*'staging',\s*dryrun:\s*true/);
  // The staging branch must be additive (guarded by pipelineOpts.staging),
  // never unconditional — a regression here would tag every ingest staging.
  assert.match(src, /\.\.\.\(pipelineOpts\.staging \? \{ ingest_status: 'staging', dryrun: true, staged_at: new Date\(\)\.toISOString\(\) \} : \{\}\)/);
});

test('ingest-local.js: --file reads a local fixture instead of fetching, without touching the --url/--manifest loop', () => {
  const src = readSource('scripts/ingest-local.js');
  assert.match(src, /pipelineOpts\.file \? fs\.readFileSync\(pipelineOpts\.file, 'utf-8'\) : await fetchUrl\(url\)/);
  // The --file branch returns early in main() so it can never fall through
  // into (or be affected by) the pre-existing --url/--manifest loop.
  const fileBranchIdx = src.indexOf('if (args.file) {');
  assert.ok(fileBranchIdx >= 0, 'expected an `if (args.file) { ... }` branch in main()');
  const manifestLoopIdx = src.indexOf('const manifestRows = args.manifest');
  assert.ok(manifestLoopIdx > fileBranchIdx, 'the --file branch must precede the existing --url/--manifest loop');
  const between = src.slice(fileBranchIdx, manifestLoopIdx);
  assert.match(between, /return;/);
});
