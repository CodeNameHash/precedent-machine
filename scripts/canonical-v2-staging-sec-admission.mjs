#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const SOURCE = Object.freeze({
  retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});
const IDEMPOTENCY_KEY = 'QXO_SEC_SOURCE_ADMISSION_V3';
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function guardProject() {
  const ref = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(join(ROOT, 'supabase/.temp/linked-project.json'), 'utf8'));
  if (ref !== PROJECT.ref || linked.ref !== PROJECT.ref || linked.name !== PROJECT.name) {
    throw new Error(`Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`);
  }
}

function safeDiagnostic(output) {
  const lines = String(output || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item)) || lines.at(-1);
  if (!line) return 'Canonical source-admission database operation failed.';
  const diagnostic = /(?:ERROR|DETAIL|HINT):/i.test(line)
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i))
    : line;
  return diagnostic
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-sec-admission-'));
  const file = join(directory, commit ? 'commit.sql' : 'query.sql');
  writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};
SET LOCAL statement_timeout='60000ms';
${sql}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json', '--debug'], {
      cwd: ROOT, encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows)) throw new Error('Supabase returned no rows array.');
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readCapture() {
  const rows = runSql(`SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256='${SOURCE.retrieval_url_sha256}'
  AND response_bytes_sha256='${SOURCE.response_bytes_sha256}'
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.canonical_payload) {
    throw new Error('The exact QXO SEC intake capture must exist exactly once.');
  }
  return rows[0].canonical_payload;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$admission_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

async function buildWrite() {
  const capture = readCapture();
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const sourceAdmissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);
  const captureReference = {
    schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    source_response_content_id: capture.source_response_content_id,
  };
  const writeSet = {
    capture_reference: captureReference,
    conversion_artifact_manifest: artifact.manifest,
    verification,
    source_admission_bundle: sourceAdmissionBundle,
  };
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  await writer.write({ operation: 'INTAKE_CAPTURE', idempotencyKey: 'QXO_SEC_INTAKE_PREREQUISITE', writeSet: { intake_capture: capture } });
  const chunkWrites = [];
  for (const chunk of artifact.chunks) {
    const input = {
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `QXO_SEC_SOURCE_ARTIFACT_${artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: {
        source_artifact_manifest: artifact.manifest,
        source_artifact_chunk: chunk,
      },
    };
    const dryRun = await writer.write({ ...input, dryRun: true });
    const committed = await writer.write(input);
    chunkWrites.push({ ...input, inputDigest: dryRun.inputDigest, receipt: committed.receipt });
  }
  const input = { operation: 'PREPARE_SOURCE_ADMISSION', idempotencyKey: IDEMPOTENCY_KEY, writeSet };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  return {
    capture,
    conversion,
    artifact,
    chunkWrites,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    writeSet,
    inputDigest: dryRun.inputDigest,
    receipt: committed.receipt,
  };
}

function writerSql(write) {
  return `SELECT public.canonical_v2_write(
    'staging', '${write.operation}', '${write.idempotencyKey}', '${write.inputDigest}',
    ${sqlJson(write.writeSet)}, '[]'::jsonb, '[]'::jsonb, ${sqlJson(write.receipt)}
  ) AS result;`;
}

function expected(write) {
  const bundle = write.writeSet.source_admission_bundle;
  return {
    conversion: write.conversion,
    verification: write.writeSet.verification,
    immutable: bundle.immutable_source_document,
    admission: bundle.source_admission_manifest,
    preparation: bundle.source_admission_preparation_receipt,
    semantic: bundle.semantic_extraction_input_envelope,
  };
}

function state(write) {
  const item = expected(write);
  const chunkReceipts = write.chunkWrites.map((chunkWrite) => ({
    idempotency_key: chunkWrite.idempotencyKey,
    input_digest: chunkWrite.inputDigest,
    receipt_id: chunkWrite.receipt.receiptId,
  }));
  const rows = runSql(`SELECT jsonb_build_object(
    'artifact_manifest', EXISTS (SELECT 1 FROM canonical_v2_staging.source_artifact_manifests WHERE artifact_manifest_id='${write.artifact.manifest.artifact_manifest_id}' AND payload_sha256='${write.artifact.manifest.payload_sha256}'),
    'artifact_chunks', (SELECT count(*) = ${write.artifact.manifest.chunk_count} FROM canonical_v2_staging.source_artifact_chunks WHERE artifact_manifest_id='${write.artifact.manifest.artifact_manifest_id}'),
    'artifact_receipts', (SELECT count(*) = ${write.artifact.manifest.chunk_count} FROM canonical_v2_staging.write_receipts AS receipt JOIN jsonb_to_recordset(${sqlJson(chunkReceipts)}) AS expected(idempotency_key text, input_digest text, receipt_id text) ON receipt.operation='STAGE_SOURCE_ARTIFACT_CHUNK' AND receipt.idempotency_key=expected.idempotency_key AND receipt.input_digest=expected.input_digest AND receipt.receipt_id=expected.receipt_id),
    'conversion', EXISTS (SELECT 1 FROM canonical_v2_staging.canonical_text_conversions WHERE canonical_text_id='${item.conversion.canonical_text_id}' AND canonical_payload->>'source_map_digest'='${item.conversion.source_map_digest}' AND canonical_payload->>'canonical_text_sha256'='${item.conversion.canonical_text_sha256}'),
    'verification', EXISTS (SELECT 1 FROM canonical_v2_staging.canonical_text_verification_manifests WHERE verification_manifest_id='${item.verification.verification_manifest_id}' AND canonical_payload->>'verification_status'='PASS'),
    'immutable_source', EXISTS (SELECT 1 FROM canonical_v2_staging.immutable_source_documents WHERE immutable_source_document_id='${item.immutable.immutable_source_document_id}' AND canonical_payload->>'canonical_text_id'='${item.conversion.canonical_text_id}'),
    'admission', EXISTS (SELECT 1 FROM canonical_v2_staging.source_admission_manifests WHERE source_admission_manifest_id='${item.admission.source_admission_manifest_id}' AND canonical_payload->>'admission_state'='VERIFIED'),
    'preparation', EXISTS (SELECT 1 FROM canonical_v2_staging.source_admission_preparation_receipts WHERE source_admission_preparation_receipt_id='${item.preparation.source_admission_preparation_receipt_id}'),
    'semantic_input', EXISTS (SELECT 1 FROM canonical_v2_staging.semantic_extraction_input_envelopes WHERE semantic_extraction_input_envelope_id='${item.semantic.semantic_extraction_input_envelope_id}' AND canonical_payload->>'semantic_extraction_status'='NOT_ATTEMPTED'),
    'write_receipt', EXISTS (SELECT 1 FROM canonical_v2_staging.write_receipts WHERE operation='PREPARE_SOURCE_ADMISSION' AND idempotency_key='${IDEMPOTENCY_KEY}' AND input_digest='${write.inputDigest}' AND receipt_id='${write.receipt.receiptId}')
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) throw new Error('Source-admission state could not be read.');
  return rows[0].state;
}

function assertCommitted(stateValue) {
  const missing = Object.entries(stateValue)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`The source-admission transaction is incomplete: ${missing.join(', ')}.`);
  }
}

function attest(write, mode) {
  const item = expected(write);
  const requestByteLengths = [writerSql(write), ...write.chunkWrites.map(writerSql)]
    .map((sql) => Buffer.byteLength(sql, 'utf8'));
  return {
    schema_version: 'SEC_SOURCE_ADMISSION_STAGING_ATTESTATION/V1',
    environment: 'staging', mode,
    source_response_content_id: write.writeSet.capture_reference.source_response_content_id,
    conversion_artifact_manifest_id: write.artifact.manifest.artifact_manifest_id,
    conversion_artifact_chunk_count: write.artifact.manifest.chunk_count,
    maximum_writer_request_byte_length: Math.max(...requestByteLengths),
    canonical_text_id: item.conversion.canonical_text_id,
    verification_manifest_id: item.verification.verification_manifest_id,
    immutable_source_document_id: item.immutable.immutable_source_document_id,
    source_admission_manifest_id: item.admission.source_admission_manifest_id,
    source_admission_preparation_receipt_id: item.preparation.source_admission_preparation_receipt_id,
    semantic_extraction_input_envelope_id: item.semantic.semantic_extraction_input_envelope_id,
    admission_state: item.admission.admission_state,
    semantic_extraction_status: item.semantic.semantic_extraction_status,
  };
}

const mode = process.argv[2];
if (!['--dry-run', '--apply', '--verify'].includes(mode) || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-sec-admission.mjs --dry-run|--apply|--verify');
}

try {
  guardProject();
  const write = await buildWrite();
  const writerRequests = [writerSql(write), ...write.chunkWrites.map(writerSql)];
  if (writerRequests.some((sql) => Buffer.byteLength(sql, 'utf8') > MAX_WRITER_REQUEST_BYTES)) {
    throw new Error('A bounded source-admission writer request exceeds its transport limit.');
  }
  if (mode === '--verify') {
    assertCommitted(state(write));
  } else {
    const before = state(write);
    for (const chunkWrite of write.chunkWrites) {
      runSql(writerSql(chunkWrite));
    }
    if (canonicalJson(before) !== canonicalJson(state(write))) {
      throw new Error('Rollback-first source artifact staging changed staging state.');
    }
    if (mode === '--apply') {
      for (const chunkWrite of write.chunkWrites) {
        runSql(writerSql(chunkWrite), { commit: true });
      }
      const staged = state(write);
      if (!staged.artifact_manifest || !staged.artifact_chunks || !staged.artifact_receipts) {
        throw new Error('The bounded source artifact did not stage completely.');
      }
      runSql(writerSql(write));
      const rolledBack = state(write);
      for (const key of ['conversion', 'verification', 'immutable_source', 'admission', 'preparation', 'semantic_input', 'write_receipt']) {
        if (rolledBack[key] !== before[key]) {
          throw new Error('Rollback-first source admission changed admitted staging state.');
        }
      }
      runSql(writerSql(write), { commit: true });
      assertCommitted(state(write));
    }
  }
  process.stdout.write(`${canonicalJson(attest(write, mode === '--apply' ? 'COMMITTED' : mode === '--verify' ? 'VERIFIED' : 'ROLLED_BACK'))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical source admission failed.');
}
