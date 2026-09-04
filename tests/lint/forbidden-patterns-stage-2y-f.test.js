'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
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
const M1_SEMANTIC_MAPPING = 'evidence/canonical-v2/stage-2y-structure-migration/prototype/m1/current-semantic-mapping.json';
const M1_SEMANTIC_MAPPING_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m1-falsification-prototype.json';
const M1_SEMANTIC_MAPPING_BYTES = fs.readFileSync(path.join(ROOT, M1_SEMANTIC_MAPPING));
const M1_SEMANTIC_MAPPING_RECEIPT_BYTES = fs.readFileSync(path.join(ROOT, M1_SEMANTIC_MAPPING_RECEIPT));
const M2_AGREEMENT_INDEX = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m2/06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a.agreement-index.json';
const M2_AGREEMENT_INDEX_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m2-agreement-index.json';
const M2_AGREEMENT_INDEX_BYTES = fs.readFileSync(path.join(ROOT, M2_AGREEMENT_INDEX));
const M2_AGREEMENT_INDEX_RECEIPT_BYTES = fs.readFileSync(path.join(ROOT, M2_AGREEMENT_INDEX_RECEIPT));
const M7_GENERALISATION_AGREEMENT_INDEX = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-comparison-entry-correction/abbvie-landos/m2/agreement-index.json';
const M7_GENERALISATION_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-generalisation-comparison-entry-correction.json';
const M7_GENERALISATION_AGREEMENT_INDEX_BYTES = fs.readFileSync(path.join(ROOT, M7_GENERALISATION_AGREEMENT_INDEX));
const M7_GENERALISATION_RECEIPT_BYTES = fs.readFileSync(path.join(ROOT, M7_GENERALISATION_RECEIPT));
const M7_ROW_CORRECTION_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-generalisation-row-correction.json';
const M7_ROW_CORRECTION_RECEIPT_BYTES = fs.readFileSync(path.join(ROOT, M7_ROW_CORRECTION_RECEIPT));
const M7_ROW_CORRECTION_PROSE_OUTPUTS = Object.freeze([
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-row-correction/abbvie-landos/m4/agreement-analysis.json',
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-row-correction/abbvie-landos/m5/agreement-analysis.json',
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-row-correction/abbvie-landos/m5/families/05-MAE_DEFINITION.json',
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-row-correction/abbvie-landos/m6/agreement-projection.json',
]);
const M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-row-correction/lawyer-review-packet.json';
const M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET_BYTES = fs.readFileSync(path.join(
  ROOT,
  M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET,
));
const M7_SOURCE_ADMISSION = 'evidence/canonical-v2/stage-2y-structure-migration/source/m7-generalisation/abbvie-landos/admission.json';
const M7_SOURCE_ADMISSION_RECEIPT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-source-admission.json';
const M7_SOURCE_ADMISSION_BYTES = fs.readFileSync(path.join(ROOT, M7_SOURCE_ADMISSION));
const M7_SOURCE_ADMISSION_RECEIPT_BYTES = fs.readFileSync(path.join(ROOT, M7_SOURCE_ADMISSION_RECEIPT));
const CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-consideration-7-profile-inventory-review-packet-draft.json';
const CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET_BYTES = fs.readFileSync(path.join(
  ROOT,
  CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET,
));
const TOPBUILD_DEDUP_REPORT = 'reports/TOPBUILD-DEDUP-EVIDENCE-2026-07-15.md';
const IOC_OTHER_EXCLUSIONS_REPORT = 'reports/canonical-sweep/ioc-other-exclusions.md';
const PROSE_FINGERPRINT_TEXT = ['QUALI', 'FICATION from recorded agreement text lit', 'igation'].join('');
const PROSE_FINGERPRINT_FIRST = ['QUALI', 'FICATION'].join('');
const PROSE_FINGERPRINT_LAST = ['lit', 'igation'].join('');
const PROSE_FINGERPRINT_PATTERN = ['QUALI', 'FICATION.*lit', 'igation'].join('');
const CONSIDERATION_FINGERPRINT_PATTERN = 'Consideration:\\s*Cash\\b';
const MERGERS_FINGERPRINT_TEXT = ['Mergers', 'Acquisitions', 'Dispositions'].join(', ');
const MERGERS_FINGERPRINT_PATTERN = 'Mergers,\\s*Acquisitions,\\s*Dispositions';
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

test('only receipt-bound M1 semantic-mapping bytes ignore recorded legal prose', () => {
  const supportingFiles = {
    [M1_SEMANTIC_MAPPING_RECEIPT]: M1_SEMANTIC_MAPPING_RECEIPT_BYTES,
  };
  const result = lintFixture({
    relativePath: M1_SEMANTIC_MAPPING,
    source: M1_SEMANTIC_MAPPING_BYTES,
    supportingFiles,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const fabricated = Buffer.from(JSON.stringify({
    schema_version: 'STAGE_2Y_STRUCTURE_SEMANTIC_MAPPING/V1',
    source_text: PROSE_FINGERPRINT_TEXT,
  }));
  const forgedReceipt = JSON.parse(M1_SEMANTIC_MAPPING_RECEIPT_BYTES.toString('utf8'));
  const forgedBinding = forgedReceipt.output_bindings.find(({ path: bindingPath }) => (
    bindingPath === M1_SEMANTIC_MAPPING
  ));
  forgedBinding.byte_length = fabricated.length;
  forgedBinding.sha256 = createHash('sha256').update(fabricated).digest('hex');

  for (const [relativePath, source, receiptBytes] of [
    [M1_SEMANTIC_MAPPING, fabricated, M1_SEMANTIC_MAPPING_RECEIPT_BYTES],
    [M1_SEMANTIC_MAPPING, fabricated, Buffer.from(JSON.stringify(forgedReceipt))],
    [M1_SEMANTIC_MAPPING.replace('.json', '-copy.json'), M1_SEMANTIC_MAPPING_BYTES, M1_SEMANTIC_MAPPING_RECEIPT_BYTES],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source,
      supportingFiles: { [M1_SEMANTIC_MAPPING_RECEIPT]: receiptBytes },
    });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('only sealed-receipt-bound M2 agreement indexes ignore recorded legal prose', () => {
  const supportingFiles = {
    [M2_AGREEMENT_INDEX_RECEIPT]: M2_AGREEMENT_INDEX_RECEIPT_BYTES,
  };
  const result = lintFixture({
    relativePath: M2_AGREEMENT_INDEX,
    source: M2_AGREEMENT_INDEX_BYTES,
    supportingFiles,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const fabricated = Buffer.from(JSON.stringify({
    schema_version: 'AGREEMENT_INDEX/V1',
    source_text: PROSE_FINGERPRINT_TEXT,
  }));
  const forgedReceipt = JSON.parse(M2_AGREEMENT_INDEX_RECEIPT_BYTES.toString('utf8'));
  const forgedBinding = forgedReceipt.output_bindings.find(({ path: bindingPath }) => (
    bindingPath === M2_AGREEMENT_INDEX
  ));
  forgedBinding.byte_length = fabricated.length;
  forgedBinding.sha256 = createHash('sha256').update(fabricated).digest('hex');

  for (const [relativePath, source, receiptBytes] of [
    [M2_AGREEMENT_INDEX, fabricated, M2_AGREEMENT_INDEX_RECEIPT_BYTES],
    [M2_AGREEMENT_INDEX, fabricated, Buffer.from(JSON.stringify(forgedReceipt))],
    [M2_AGREEMENT_INDEX.replace('.json', '-copy.json'), M2_AGREEMENT_INDEX_BYTES, M2_AGREEMENT_INDEX_RECEIPT_BYTES],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source,
      supportingFiles: { [M2_AGREEMENT_INDEX_RECEIPT]: receiptBytes },
    });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('only stage-receipt-bound M7 generalisation outputs ignore recorded legal prose', () => {
  const supportingFiles = {
    [M7_GENERALISATION_RECEIPT]: M7_GENERALISATION_RECEIPT_BYTES,
  };
  const result = lintFixture({
    relativePath: M7_GENERALISATION_AGREEMENT_INDEX,
    source: M7_GENERALISATION_AGREEMENT_INDEX_BYTES,
    supportingFiles,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const fabricated = Buffer.from(JSON.stringify({
    schema_version: 'AGREEMENT_INDEX/V1',
    source_text: PROSE_FINGERPRINT_TEXT,
  }));
  const forgedReceipt = JSON.parse(M7_GENERALISATION_RECEIPT_BYTES.toString('utf8'));
  const forgedBinding = forgedReceipt.output_bindings.find(({ path: bindingPath }) => (
    bindingPath === M7_GENERALISATION_AGREEMENT_INDEX
  ));
  forgedBinding.byte_length = fabricated.length;
  forgedBinding.sha256 = createHash('sha256').update(fabricated).digest('hex');

  for (const [relativePath, source, receiptBytes] of [
    [M7_GENERALISATION_AGREEMENT_INDEX, fabricated, M7_GENERALISATION_RECEIPT_BYTES],
    [M7_GENERALISATION_AGREEMENT_INDEX, fabricated, Buffer.from(JSON.stringify(forgedReceipt))],
    [
      M7_GENERALISATION_AGREEMENT_INDEX.replace('agreement-index.json', 'agreement-index-copy.json'),
      M7_GENERALISATION_AGREEMENT_INDEX_BYTES,
      M7_GENERALISATION_RECEIPT_BYTES,
    ],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source,
      supportingFiles: { [M7_GENERALISATION_RECEIPT]: receiptBytes },
    });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('all receipt-bound M7 source-bearing schemas ignore their recorded prose', () => {
  for (const relativePath of M7_ROW_CORRECTION_PROSE_OUTPUTS) {
    const result = lintFixture({
      relativePath,
      source: fs.readFileSync(path.join(ROOT, relativePath)),
      supportingFiles: {
        [M7_ROW_CORRECTION_RECEIPT]: M7_ROW_CORRECTION_RECEIPT_BYTES,
      },
    });
    assert.equal(result.status, 0, `${relativePath}\n${result.stdout}\n${result.stderr}`);
  }
});

test('only the physically pinned M7 row-correction lawyer packet ignores its recorded prose', () => {
  const result = lintFixture({
    relativePath: M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET,
    source: M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET_BYTES,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const forged = JSON.parse(M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET_BYTES.toString('utf8'));
  forged.lawyer_review_packet_id = '0'.repeat(64);
  for (const [relativePath, source] of [
    [M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET, Buffer.from(JSON.stringify(forged))],
    [
      M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET.replace('.json', '-copy.json'),
      M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET_BYTES,
    ],
  ]) {
    const rejected = lintFixture({ relativePath, source });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('only sealed-receipt-bound M7 source-admission outputs ignore recorded legal prose', () => {
  const supportingFiles = {
    [M7_SOURCE_ADMISSION_RECEIPT]: M7_SOURCE_ADMISSION_RECEIPT_BYTES,
  };
  const result = lintFixture({
    relativePath: M7_SOURCE_ADMISSION,
    source: M7_SOURCE_ADMISSION_BYTES,
    supportingFiles,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const fabricated = Buffer.from(JSON.stringify({
    bundle: { source_text: PROSE_FINGERPRINT_TEXT },
    candidate: {},
    capture: {},
    conversion: {},
    verification: {},
  }));
  const forgedReceipt = JSON.parse(M7_SOURCE_ADMISSION_RECEIPT_BYTES.toString('utf8'));
  const forgedBinding = forgedReceipt.output_bindings.find(({ path: bindingPath }) => (
    bindingPath === M7_SOURCE_ADMISSION
  ));
  forgedBinding.byte_length = fabricated.length;
  forgedBinding.sha256 = createHash('sha256').update(fabricated).digest('hex');

  for (const [relativePath, source, receiptBytes] of [
    [M7_SOURCE_ADMISSION, fabricated, M7_SOURCE_ADMISSION_RECEIPT_BYTES],
    [M7_SOURCE_ADMISSION, fabricated, Buffer.from(JSON.stringify(forgedReceipt))],
    [M7_SOURCE_ADMISSION.replace('.json', '-copy.json'), M7_SOURCE_ADMISSION_BYTES, M7_SOURCE_ADMISSION_RECEIPT_BYTES],
  ]) {
    const rejected = lintFixture({
      relativePath,
      source,
      supportingFiles: { [M7_SOURCE_ADMISSION_RECEIPT]: receiptBytes },
    });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(rejected.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
  }
});

test('trusted prose-evidence paths reject substituted code fingerprints', () => {
  const cases = [
    [M1_SEMANTIC_MAPPING, { [M1_SEMANTIC_MAPPING_RECEIPT]: M1_SEMANTIC_MAPPING_RECEIPT_BYTES }],
    [M2_AGREEMENT_INDEX, { [M2_AGREEMENT_INDEX_RECEIPT]: M2_AGREEMENT_INDEX_RECEIPT_BYTES }],
    [M7_GENERALISATION_AGREEMENT_INDEX, { [M7_GENERALISATION_RECEIPT]: M7_GENERALISATION_RECEIPT_BYTES }],
    [M7_ROW_CORRECTION_LAWYER_REVIEW_PACKET, {}],
    [M7_SOURCE_ADMISSION, { [M7_SOURCE_ADMISSION_RECEIPT]: M7_SOURCE_ADMISSION_RECEIPT_BYTES }],
  ];
  for (const [relativePath, supportingFiles] of cases) {
    const substituted = Buffer.from(JSON.stringify({ unsafe: CODE_FINGERPRINT_TEXT }));
    const rejected = lintFixture({ relativePath, source: substituted, supportingFiles });
    assert.notEqual(rejected.status, 0, relativePath);
    assert.ok(
      rejected.stdout.includes(`${relativePath} :: ${CODE_FINGERPRINT_PATTERN}`),
      `${relativePath}\n${rejected.stdout}\n${rejected.stderr}`,
    );
  }
});

test('Consideration structured identifiers are not human-facing label failures', () => {
  const result = lintFixture({
    relativePath: CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET,
    source: CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET_BYTES,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('a literal Consideration label remains forbidden', () => {
  const result = lintFixture({
    relativePath: CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET,
    source: JSON.stringify({ unsafe: ['Consideration:', 'Cash'].join(' ') }),
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(
    `${CONSIDERATION_WORK3_INVENTORY_REVIEW_PACKET} :: ${CONSIDERATION_FINGERPRINT_PATTERN}`,
  ));
});

test('the exact TopBuild dedup report may record the IOC-MERGE taxonomy label', () => {
  const result = lintFixture({
    relativePath: TOPBUILD_DEDUP_REPORT,
    source: `| Deal | Family |\n| --- | --- |\n| Heinz/Kraft | IOC-T / ${MERGERS_FINGERPRINT_TEXT} |`,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('the TopBuild report exemption keeps code fingerprints and adjacent reports in scope', () => {
  const unsafeReport = lintFixture({
    relativePath: TOPBUILD_DEDUP_REPORT,
    source: `const unsafe: ${CODE_FINGERPRINT_TEXT} = value;`,
  });
  assert.notEqual(unsafeReport.status, 0);
  assert.ok(unsafeReport.stdout.includes(`${TOPBUILD_DEDUP_REPORT} :: ${CODE_FINGERPRINT_PATTERN}`));

  const adjacentReport = TOPBUILD_DEDUP_REPORT.replace('.md', '-COPY.md');
  const adjacentResult = lintFixture({ relativePath: adjacentReport, source: MERGERS_FINGERPRINT_TEXT });
  assert.notEqual(adjacentResult.status, 0);
  assert.ok(adjacentResult.stdout.includes(`${adjacentReport} :: ${MERGERS_FINGERPRINT_PATTERN}`));
});

test('the exact IOC exclusions sweep may record the IOC-MERGE taxonomy label', () => {
  const result = lintFixture({
    relativePath: IOC_OTHER_EXCLUSIONS_REPORT,
    source: `| Samples |\n| --- |\n| Other specific exception (${MERGERS_FINGERPRINT_TEXT}) |`,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('the IOC exclusions report exemption keeps code fingerprints and adjacent reports in scope', () => {
  const unsafeReport = lintFixture({
    relativePath: IOC_OTHER_EXCLUSIONS_REPORT,
    source: `const unsafe: ${CODE_FINGERPRINT_TEXT} = value;`,
  });
  assert.notEqual(unsafeReport.status, 0);
  assert.ok(unsafeReport.stdout.includes(`${IOC_OTHER_EXCLUSIONS_REPORT} :: ${CODE_FINGERPRINT_PATTERN}`));

  const adjacentReport = IOC_OTHER_EXCLUSIONS_REPORT.replace('.md', '-copy.md');
  const adjacentResult = lintFixture({ relativePath: adjacentReport, source: MERGERS_FINGERPRINT_TEXT });
  assert.notEqual(adjacentResult.status, 0);
  assert.ok(adjacentResult.stdout.includes(`${adjacentReport} :: ${MERGERS_FINGERPRINT_PATTERN}`));
});

test('prose fingerprints in JSON do not bridge distinct string values', () => {
  const relativePath = 'evidence/canonical-v2/structured-cross-field.json';
  const result = lintFixture({
    relativePath,
    source: JSON.stringify({ first: PROSE_FINGERPRINT_FIRST, second: PROSE_FINGERPRINT_LAST }),
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /INVARIANT-4: PASS/);
});

test('an actual prose fingerprint inside one JSON string still fails', () => {
  const relativePath = 'evidence/canonical-v2/structured-same-field.json';
  const result = lintFixture({
    relativePath,
    source: JSON.stringify({ value: [PROSE_FINGERPRINT_FIRST, PROSE_FINGERPRINT_LAST].join('\n') }),
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
});

test('an actual prose fingerprint inside one JSON key still fails', () => {
  const relativePath = 'evidence/canonical-v2/structured-same-key.json';
  const result = lintFixture({
    relativePath,
    source: JSON.stringify({ [PROSE_FINGERPRINT_TEXT]: true }),
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
});

test('a forbidden overwritten duplicate-key value still fails', () => {
  const relativePath = 'evidence/canonical-v2/structured-duplicate-key.json';
  const result = lintFixture({
    relativePath,
    source: `{"duplicate":${JSON.stringify(PROSE_FINGERPRINT_TEXT)},"duplicate":"safe"}`,
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
});

test('code-class fingerprints continue to scan the whole JSON source', () => {
  const relativePath = 'evidence/canonical-v2/structured-code-cross-field.json';
  const pattern = 'Question\\s*:.*\\|.*Answer\\s*:';
  const result = lintFixture({
    relativePath,
    source: JSON.stringify({
      first: ['Question', ':'].join(''),
      separator: String.fromCharCode(124),
      last: ['Answer', ':'].join(''),
    }),
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${relativePath} :: ${pattern}`));
});

test('malformed JSON falls back to whole-source prose scanning', () => {
  const relativePath = 'evidence/canonical-v2/structured-malformed.json';
  const result = lintFixture({
    relativePath,
    source: `{"first":${JSON.stringify(PROSE_FINGERPRINT_FIRST)},"second":${JSON.stringify(PROSE_FINGERPRINT_LAST)}`,
  });
  assert.notEqual(result.status, 0);
  assert.ok(result.stdout.includes(`${relativePath} :: ${PROSE_FINGERPRINT_PATTERN}`));
});
