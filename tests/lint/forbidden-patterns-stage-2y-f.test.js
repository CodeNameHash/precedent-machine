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
const STAGE_2Y_CD_REPORT = 'evidence/canonical-v2/stage-2y-cd-report.json';
const STAGE_2Y_CD_REPORT_SCHEMA = 'STAGE_2Y_CD_REPORT/V1';
const STAGE_2Y_H_TOPIC_COMPARISON = 'evidence/canonical-v2/stage-2y-h-representation-topic-comparison.json';
const STAGE_2Y_H_TOPIC_COMPARISON_SCHEMA = 'STAGE_2Y_H_REPRESENTATION_TOPIC_COMPARISON/V1';
const HUMAN_ANCHOR_PACKET = 'evidence/blind-review/2026-08-10/stage-2y-0-human-anchor-machine-packet.json';
const HUMAN_ANCHOR_PACKET_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_MACHINE_PACKET/V3';
const HASHED_RUN_ID = '0'.repeat(64);
const STAGE_2Y_L_ADAPTER = `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/adapter-result.json`;
const STAGE_2Y_L_RECORDING = `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/recording.json`;
const STAGE_2Y_L_RESPONSE = `evidence/canonical-v2/stage-2y-l-live-runs/${HASHED_RUN_ID}/native-producer-recorded-response-6.4.json`;
const FAMILY_ROLE_SCHEMA = 'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/ANTITRUST_REGULATORY.json';
const FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m5-schema-approval.json';
const FAMILY_ROLE_SCHEMA_VERSION = 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1';
const FAMILY_ROLE_SCHEMA_APPROVAL_STATE = 'BEN_APPROVED_AND_SEALED';
const FAMILY_ROLE_SCHEMA_BYTES = fs.readFileSync(path.join(ROOT, FAMILY_ROLE_SCHEMA));
const FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES = fs.readFileSync(path.join(
  ROOT,
  FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT,
));
const PROSE_FINGERPRINT_TEXT = ['QUALI', 'FICATION from recorded agreement text lit', 'igation'].join('');
const PROSE_FINGERPRINT_PATTERN = ['QUALI', 'FICATION.*lit', 'igation'].join('');
const CODE_FINGERPRINT_TEXT = ['any', ' <', 'any>'].join('');
const CODE_FINGERPRINT_PATTERN = ['any', '\\s*<', 'any>'].join('');

function lintFixture({ relativePath, source, supportingFiles = {} }) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'forbidden-patterns-stage-2y-f-'));
  const target = path.join(fixture, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts', 'lint'), { recursive: true });
  fs.copyFileSync(DUPLICATE_CHECK, path.join(fixture, 'scripts', 'lint', 'resolution-registry-duplicates.js'));
  fs.writeFileSync(target, source);
  for (const [supportingPath, supportingSource] of Object.entries(supportingFiles)) {
    const supportingTarget = path.join(fixture, supportingPath);
    fs.mkdirSync(path.dirname(supportingTarget), { recursive: true });
    fs.writeFileSync(supportingTarget, supportingSource);
  }
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

test('the exact Phase C/D report ignores prose fingerprints only under its schema', () => {
  const source = JSON.stringify({ schema_version: STAGE_2Y_CD_REPORT_SCHEMA, source_text: PROSE_FINGERPRINT_TEXT });
  const result = lintFixture({ relativePath: STAGE_2Y_CD_REPORT, source });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  for (const [relativePath, schemaVersion] of [
    [STAGE_2Y_CD_REPORT, 'OTHER/V1'],
    ['evidence/canonical-v2/stage-2y-cd-report-copy.json', STAGE_2Y_CD_REPORT_SCHEMA],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source: JSON.stringify({ schema_version: schemaVersion, source_text: PROSE_FINGERPRINT_TEXT }),
    });
    assert.notEqual(rejected.status, 0);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('the exact representation-topic comparison ignores prose fingerprints only under its schema', () => {
  const source = JSON.stringify({ schema_version: STAGE_2Y_H_TOPIC_COMPARISON_SCHEMA, source_text: PROSE_FINGERPRINT_TEXT });
  const result = lintFixture({ relativePath: STAGE_2Y_H_TOPIC_COMPARISON, source });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  for (const [relativePath, schemaVersion] of [
    [STAGE_2Y_H_TOPIC_COMPARISON, 'OTHER/V1'],
    ['evidence/canonical-v2/stage-2y-h-representation-topic-comparison-copy.json', STAGE_2Y_H_TOPIC_COMPARISON_SCHEMA],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source: JSON.stringify({ schema_version: schemaVersion, source_text: PROSE_FINGERPRINT_TEXT }),
    });
    assert.notEqual(rejected.status, 0);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('the exact V3 human-anchor machine packet ignores prose-only fingerprints', () => {
  const source = JSON.stringify({ schema_version: HUMAN_ANCHOR_PACKET_SCHEMA, source_text: PROSE_FINGERPRINT_TEXT });
  const result = lintFixture({ relativePath: HUMAN_ANCHOR_PACKET, source });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);

  const wrongSchema = lintFixture({
    relativePath: HUMAN_ANCHOR_PACKET,
    source: JSON.stringify({ schema_version: 'OTHER/V1', source_text: PROSE_FINGERPRINT_TEXT }),
  });
  assert.notEqual(wrongSchema.status, 0);
  assert.ok(wrongSchema.stdout.includes(`${HUMAN_ANCHOR_PACKET} :: ${PROSE_FINGERPRINT_PATTERN}`));
});

test('the human-anchor packet exemption keeps code fingerprints and adjacent evidence in scope', () => {
  const unsafePacket = lintFixture({
    relativePath: HUMAN_ANCHOR_PACKET,
    source: JSON.stringify({ schema_version: HUMAN_ANCHOR_PACKET_SCHEMA, source_text: CODE_FINGERPRINT_TEXT }),
  });
  assert.notEqual(unsafePacket.status, 0);
  assert.ok(unsafePacket.stdout.includes(`${HUMAN_ANCHOR_PACKET} :: ${CODE_FINGERPRINT_PATTERN}`));

  const adjacent = 'evidence/blind-review/2026-08-10/stage-2y-0-human-anchor-machine-packet-copy.json';
  const adjacentResult = lintFixture({ relativePath: adjacent, source: PROSE_FINGERPRINT_TEXT });
  assert.notEqual(adjacentResult.status, 0);
  assert.ok(adjacentResult.stdout.includes(`${adjacent} :: ${PROSE_FINGERPRINT_PATTERN}`));
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

test('only receipt-bound family role schema bytes ignore prose fingerprints', () => {
  const supportingFiles = {
    [FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT]: FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES,
  };
  const result = lintFixture({
    relativePath: FAMILY_ROLE_SCHEMA,
    source: FAMILY_ROLE_SCHEMA_BYTES,
    supportingFiles,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);

  const selfDeclared = JSON.stringify({
    schema_version: FAMILY_ROLE_SCHEMA_VERSION,
    family_key: 'ANTITRUST_REGULATORY',
    approval_state: FAMILY_ROLE_SCHEMA_APPROVAL_STATE,
    role_schema_version: 1,
    subtype_profiles: [{
      required_roles: [{ role_key: 'QUALIFICATION' }],
      claim_definition_keys: ['ANTITRUST_LITIGATION_PROCEEDING'],
    }],
  });
  const rejectedSelfDeclaration = lintFixture({
    relativePath: FAMILY_ROLE_SCHEMA,
    source: selfDeclared,
    supportingFiles,
  });
  assert.notEqual(rejectedSelfDeclaration.status, 0);
  assert.ok(rejectedSelfDeclaration.stdout.includes(
    `${FAMILY_ROLE_SCHEMA} :: ${PROSE_FINGERPRINT_PATTERN}`,
  ));

  const sameLengthSchemaDrift = Buffer.from(FAMILY_ROLE_SCHEMA_BYTES);
  const approvalId = Buffer.from('"approval_id":"BEN_M5_PROGRAMME_RULES_2026_08_12"');
  const approvalIdAt = sameLengthSchemaDrift.indexOf(approvalId);
  assert.notEqual(approvalIdAt, -1);
  sameLengthSchemaDrift[approvalIdAt + approvalId.length - 2] = '3'.charCodeAt(0);

  for (const [relativePath, source, receiptBytes] of [
    [FAMILY_ROLE_SCHEMA, Buffer.concat([FAMILY_ROLE_SCHEMA_BYTES, Buffer.from(' ')]), FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES],
    [FAMILY_ROLE_SCHEMA, sameLengthSchemaDrift, FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES],
    [
      'evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/ANTITRUST_REGULATORY_COPY.json',
      FAMILY_ROLE_SCHEMA_BYTES,
      FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES,
    ],
    [
      FAMILY_ROLE_SCHEMA,
      FAMILY_ROLE_SCHEMA_BYTES,
      Buffer.from(FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES.toString('utf8').replace('"status":"PASS"', '"status":"FAIL"')),
    ],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source,
      supportingFiles: { [FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT]: receiptBytes },
    });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('approved family role schema evidence still rejects code fingerprints', () => {
  const source = JSON.stringify({
    schema_version: FAMILY_ROLE_SCHEMA_VERSION,
    family_key: 'ANTITRUST_REGULATORY',
    approval_state: FAMILY_ROLE_SCHEMA_APPROVAL_STATE,
    role_schema_version: 1,
    subtype_profiles: [],
    unsafe: CODE_FINGERPRINT_TEXT,
  });
  const result = lintFixture({
    relativePath: FAMILY_ROLE_SCHEMA,
    source,
    supportingFiles: {
      [FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT]: FAMILY_ROLE_SCHEMA_APPROVAL_RECEIPT_BYTES,
    },
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${FAMILY_ROLE_SCHEMA} :: ${CODE_FINGERPRINT_PATTERN}`));
});
