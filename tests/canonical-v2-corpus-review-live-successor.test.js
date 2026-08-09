const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  mkdtempSync, readFileSync, rmSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const REPO_ROOT = resolve(__dirname, '..');
const BASELINE_ARTIFACT = resolve(REPO_ROOT, 'evidence/canonical-v2/corpus-review-20260809.html');
const SUCCESSOR_SCRIPT = resolve(REPO_ROOT, 'scripts/canonical-v2-corpus-review-live-successor.mjs');

let successor;

test.before(async () => {
  successor = await import(pathToFileURL(SUCCESSOR_SCRIPT).href);
});

test('selects the sealed Stage 2Y-L live successor cohort without changing the baseline artifact', () => {
  const baselineBefore = createHash('sha256').update(readFileSync(BASELINE_ARTIFACT)).digest('hex');
  const selected = successor.selectStage2yLLiveSuccessorCohort({ repoRoot: REPO_ROOT });

  assert.equal(selected.runNames.length, 185);
  assert.equal(selected.metadata.baseline_runs, 157);
  assert.equal(selected.metadata.removed_baseline_runs, 18);
  assert.equal(selected.metadata.added_live_runs, 46);
  assert.equal(selected.metadata.deal_family_pairs, 147);
  assert.deepEqual(selected.metadata.added_without_predecessor, [
    { deal: 'modiv', family: 'FINANCING_COVENANTS' },
  ]);
  assert.equal(createHash('sha256').update(readFileSync(BASELINE_ARTIFACT)).digest('hex'), baselineBefore);
  assert.equal(baselineBefore, '579df3988d90b924a3d437ccf6d2f6dd8fc7ff6d23f8dfbc33d9d85cbef484c2');
});

test('renders the exact successor corpus and self-contained filters', () => {
  const result = successor.expectedStage2yLLiveSuccessorCorpusReview({ repoRoot: REPO_ROOT });

  assert.equal(result.model.runs.length, 185);
  assert.equal(new Set(result.model.runs.map((run) => `${run.deal}\0${run.family}`)).size, 147);
  assert.equal(result.model.excerptGroups.length, 4161);
  assert.equal(result.model.runs.reduce((total, run) => total + run.claims.length, 0), 5022);
  assert.match(result.html, /Canonical V2 Stage 2Y-L live successor corpus review/);
  assert.match(result.html, /sealed Stage 2Y-L live batch/);
  assert.match(result.html, /185 runs across 147 deal and family pairs/);
  assert.match(result.html, /Content-Security-Policy/);
  assert.match(result.html, /id="family-filter"/);
  assert.match(result.html, /value="HELD">Unresolved only/);
  assert.match(result.html, /value="OPEN_WORLD">Open-world only/);
  assert.doesNotMatch(result.html, /<script[^>]+src=/);
  assert.doesNotMatch(result.html, /<link[^>]+href=/);
});

test('rejects path, schema, manifest and digest defects', () => {
  const batch = JSON.parse(readFileSync(resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-l-live-batch.json'), 'utf8'));
  const record = batch.calls[0];

  assert.throws(
    () => successor.validateStage2yLLiveCall({ repoRoot: REPO_ROOT, record: {
      ...record,
      output: { ...record.output, output_directory: 'evidence/canonical-v2/stage-2y-l-live-runs/not-the-call-id' },
    } }),
    { code: 'LIVE_OUTPUT_PATH_INVALID' },
  );
  assert.throws(
    () => successor.validateStage2yLLiveCall({ repoRoot: REPO_ROOT, record: {
      ...record,
      spec: { ...record.spec, schema_version: 'WRONG/V1' },
    } }),
    { code: 'LIVE_CALL_SCHEMA_INVALID' },
  );
  assert.throws(
    () => successor.validateStage2yLLiveCall({ repoRoot: REPO_ROOT, record: {
      ...record,
      spec: { ...record.spec, deal: 'wrong-deal' },
      output: {
        ...record.output,
        run_identity: { ...record.output.run_identity, deal: 'wrong-deal' },
      },
    } }),
    { code: 'LIVE_MANIFEST_IDENTITY_MISMATCH' },
  );
  assert.throws(
    () => successor.validateStage2yLLiveCall({ repoRoot: REPO_ROOT, record: {
      ...record,
      output: {
        ...record.output,
        artifact_digests: { ...record.output.artifact_digests, run_manifest: '0'.repeat(64) },
      },
    } }),
    { code: 'LIVE_ARTIFACT_DIGEST_MISMATCH' },
  );
});

test('CLI writes and checks the deterministic successor artifact', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'stage-2y-l-corpus-review-'));
  const output = resolve(temporary, 'successor.html');
  try {
    const written = spawnSync(process.execPath, [SUCCESSOR_SCRIPT, '--write', output], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    });
    assert.equal(written.status, 0, written.stderr);
    assert.match(written.stdout, /185 runs, 4161 cards/);

    const checked = spawnSync(process.execPath, [SUCCESSOR_SCRIPT, '--check', output], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    });
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /CHECKED/);

    writeFileSync(output, `${readFileSync(output, 'utf8')}\n`);
    const stale = spawnSync(process.execPath, [SUCCESSOR_SCRIPT, '--check', output], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
    });
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /STALE_LIVE_SUCCESSOR_CORPUS_REVIEW_ARTIFACT/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
