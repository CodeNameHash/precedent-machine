'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LINTER = path.join(ROOT, 'scripts', 'lint', 'forbidden-patterns.sh');
const DUPLICATE_CHECK = path.join(ROOT, 'scripts', 'lint', 'resolution-registry-duplicates.js');
const LEDGER = 'evidence/canonical-v2/stage-2y-f-lexical-classification.json';
const TERRA_ADJUDICATION = 'evidence/canonical-v2/stage-2y-f-terra-adjudication.json';
const REPRESENTATION_REPLAY = 'evidence/canonical-v2/stage-2y-h-representation-topic-replay.json';
const CONCEPT_COVERAGE_SIMULATION = 'evidence/canonical-v2/stage-2y-f-concept-coverage-simulation.json';
const CONCEPT_COVERAGE_SCHEMA = 'STAGE_2Y_F_CONCEPT_COVERAGE_SIMULATION/V1';
const HASHED_RUN_ID = '0'.repeat(64);
const STAGE_2Y_L_ADAPTER = `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/adapter-result.json`;
const STAGE_2Y_L_RECORDING = `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/recording.json`;
const STAGE_2Y_L_RESPONSE = `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/native-producer-recorded-response-6.4.json`;
const PROSE_FINGERPRINT_TEXT = ['QUALI', 'FICATION from recorded agreement text lit', 'igation'].join('');
const PROSE_FINGERPRINT_PATTERN = ['QUALI', 'FICATION.*lit', 'igation'].join('');
const CODE_FINGERPRINT_TEXT = ['any', ' <', 'any>'].join('');
const CODE_FINGERPRINT_PATTERN = ['any', '\\s*<', 'any>'].join('');

function lintFixture({ relativePath, source }) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'forbidden-patterns-stage-2y-f-'));
  const target = path.join(fixture, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts', 'lint'), { recursive: true });
  fs.copyFileSync(DUPLICATE_CHECK, path.join(fixture, 'scripts', 'lint', 'resolution-registry-duplicates.js'));
  fs.writeFileSync(target, source);
  try {
    return spawnSync('bash', [LINTER, fixture], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CHANGED_FILES: relativePath },
    });
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

test('Stage 2Y-F lexical evidence ignores prose-only fingerprints', () => {
  const result = lintFixture({ relativePath: LEDGER, source: PROSE_FINGERPRINT_TEXT });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('Stage 2Y-F lexical evidence still rejects code fingerprints', () => {
  const result = lintFixture({ relativePath: LEDGER, source: `const unsafe: ${CODE_FINGERPRINT_TEXT} = value;` });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${LEDGER} :: ${CODE_FINGERPRINT_PATTERN}`));
});

test('Stage 2Y-F Terra adjudication evidence ignores prose-only fingerprints', () => {
  const result = lintFixture({ relativePath: TERRA_ADJUDICATION, source: PROSE_FINGERPRINT_TEXT });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('Stage 2Y-F Terra adjudication evidence still rejects code fingerprints', () => {
  const result = lintFixture({ relativePath: TERRA_ADJUDICATION, source: `const unsafe: ${CODE_FINGERPRINT_TEXT} = value;` });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${TERRA_ADJUDICATION} :: ${CODE_FINGERPRINT_PATTERN}`));
});

test('Stage 2Y-F Terra adjudication adjacent paths remain subject to prose-only fingerprints', () => {
  const adjacent = 'evidence/canonical-v2/stage-2y-f-terra-adjudication-copy.json';
  const result = lintFixture({ relativePath: adjacent, source: PROSE_FINGERPRINT_TEXT });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, new RegExp(`${adjacent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} :: ${PROSE_FINGERPRINT_PATTERN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('other evidence files remain subject to prose-only fingerprints', () => {
  const otherEvidence = 'evidence/canonical-v2/stage-2y-f-lexical-classification-copy.json';
  const result = lintFixture({ relativePath: otherEvidence, source: PROSE_FINGERPRINT_TEXT });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, new RegExp(`${otherEvidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} :: ${PROSE_FINGERPRINT_PATTERN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('Stage 2Y-H representation replay ignores prose-only fingerprints', () => {
  const result = lintFixture({ relativePath: REPRESENTATION_REPLAY, source: PROSE_FINGERPRINT_TEXT });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('Stage 2Y-H representation replay still rejects code fingerprints', () => {
  const result = lintFixture({ relativePath: REPRESENTATION_REPLAY, source: `const unsafe: ${CODE_FINGERPRINT_TEXT} = value;` });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${REPRESENTATION_REPLAY} :: ${CODE_FINGERPRINT_PATTERN}`));
});

test('Stage 2Y-H adjacent replay paths remain subject to prose-only fingerprints', () => {
  const adjacentReplay = 'evidence/canonical-v2/stage-2y-h-representation-topic-replay-copy.json';
  const result = lintFixture({ relativePath: adjacentReplay, source: PROSE_FINGERPRINT_TEXT });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, new RegExp(`${adjacentReplay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} :: ${PROSE_FINGERPRINT_PATTERN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('Stage 2Y-F concept-coverage simulation ignores prose-only fingerprints only under its exact schema', () => {
  const source = JSON.stringify({ schema_version: CONCEPT_COVERAGE_SCHEMA, source_text: PROSE_FINGERPRINT_TEXT });
  const result = lintFixture({ relativePath: CONCEPT_COVERAGE_SIMULATION, source });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);

  const wrongSchema = lintFixture({
    relativePath: CONCEPT_COVERAGE_SIMULATION,
    source: JSON.stringify({ schema_version: 'OTHER/V1', source_text: PROSE_FINGERPRINT_TEXT }),
  });
  assert.notEqual(wrongSchema.status, 0);
  assert.ok(wrongSchema.stdout.includes(`${CONCEPT_COVERAGE_SIMULATION} :: ${PROSE_FINGERPRINT_PATTERN}`));
});

test('adjacent code with the concept-coverage prose fingerprint still fails', () => {
  const adjacentCode = 'lib/stage-2y-f-concept-coverage-simulation.js';
  const result = lintFixture({ relativePath: adjacentCode, source: `const value = ${JSON.stringify(PROSE_FINGERPRINT_TEXT)};` });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${adjacentCode} :: ${PROSE_FINGERPRINT_PATTERN}`));
});

test('hash-addressed Stage 2Y-L source evidence ignores prose-only fingerprints under exact schemas', () => {
  for (const [relativePath, schemaVersion] of [
    [STAGE_2Y_L_ADAPTER, 'NATIVE_WRITE_SET_ADAPTER_RESULT/V1'],
    [STAGE_2Y_L_RECORDING, 'NATIVE_PRODUCER_RECORDED_RUN/V3'],
    [STAGE_2Y_L_RESPONSE, 'NATIVE_PRODUCER_RECORDED_RESPONSE/V1'],
  ]) {
    const source = JSON.stringify({ schema_version: schemaVersion, source_text: PROSE_FINGERPRINT_TEXT });
    const result = lintFixture({ relativePath, source });
    assert.equal(result.status, 0, `${relativePath}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /INVARIANT-4: PASS/);

    const wrongSchema = lintFixture({
      relativePath,
      source: JSON.stringify({ schema_version: 'OTHER/V1', source_text: PROSE_FINGERPRINT_TEXT }),
    });
    assert.notEqual(wrongSchema.status, 0);
    assert.ok(wrongSchema.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('Stage 2Y-L adapter exception does not cover adjacent evidence, code, or documentation', () => {
  for (const relativePath of [
    `evidence/canonical-v2/stage-2y-l-live-runs/not-a-hash/adapter-result.json`,
    `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/resolution.json`,
    'lib/stage-2y-l-live-run.js',
    'stage-2y-l-live-run.md',
  ]) {
    const result = lintFixture({ relativePath, source: PROSE_FINGERPRINT_TEXT });
    assert.notEqual(result.status, 0, relativePath);
    assert.ok(result.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});
