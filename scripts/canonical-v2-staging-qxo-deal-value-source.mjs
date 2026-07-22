#!/usr/bin/env node

import https from 'node:https';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { buildSecEdgarIntakeCapture, validateSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const SOURCE = Object.freeze({
  url: 'https://www.sec.gov/Archives/edgar/data/1633931/000110465926045245/bld-20260418xex99d1.htm',
  retrieval_url_sha256: '0444cefff473dca7b294d16b04f83db66574ae2f164829919f2cb4d34a5f3442',
  response_bytes_sha256: '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827',
  response_byte_length: 151092,
});
const POLICY = Object.freeze({
  schema_version: 'SEC_RETRIEVAL_POLICY/V1',
  user_agent: 'Deal Corpus canonical intake bengoodchild@gmail.com',
  accept: 'text/html',
  accept_encoding: 'identity',
  redirect_limit: 0,
  timeout_ms: 15000,
  maximum_response_bytes: 512 * 1024,
});
const INTAKE_KEY = 'QXO_DEAL_VALUE_SEC_INTAKE_V1';
const ADMISSION_KEY = 'QXO_DEAL_VALUE_SEC_SOURCE_ADMISSION_V1';
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;
let stage = 'STARTUP';

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
  if (!line) return 'Canonical QXO deal-value source operation failed.';
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-deal-value-source-'));
  const file = join(directory, commit ? 'commit.sql' : 'query.sql');
  writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};
SET LOCAL statement_timeout='60000ms';
${sql}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 90000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows)) throw new Error('Supabase returned no rows array.');
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function fetchExact() {
  return new Promise((resolveFetch, reject) => {
    const request = https.get(SOURCE.url, { headers: {
      'User-Agent': POLICY.user_agent,
      Accept: POLICY.accept,
      'Accept-Encoding': POLICY.accept_encoding,
    } }, (response) => {
      const chunks = [];
      let length = 0;
      response.on('data', (chunk) => {
        length += chunk.length;
        if (length > POLICY.maximum_response_bytes) {
          request.destroy(new Error('SEC response exceeded the governed byte limit.'));
        } else chunks.push(chunk);
      });
      response.on('end', () => resolveFetch({
        status_code: response.statusCode,
        content_type: response.headers['content-type'],
        final_url: SOURCE.url,
        redirect_count: 0,
        response_bytes: Buffer.concat(chunks),
      }));
    });
    request.on('error', reject);
    request.setTimeout(POLICY.timeout_ms, () => request.destroy(new Error('SEC retrieval timed out.')));
  });
}

function assertCapture(capture) {
  validateSecEdgarIntakeCapture(capture);
  for (const key of ['retrieval_url_sha256', 'response_bytes_sha256', 'response_byte_length']) {
    if (capture[key] !== SOURCE[key]) throw new Error(`QXO deal-value source ${key} has drifted.`);
  }
}

function readStoredCapture() {
  const rows = runSql(`SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256='${SOURCE.retrieval_url_sha256}'
  AND response_bytes_sha256='${SOURCE.response_bytes_sha256}'
LIMIT 2;`, { readOnly: true });
  if (rows.length > 1) throw new Error('The exact QXO deal-value SEC capture is duplicated.');
  if (rows.length === 0) return null;
  assertCapture(rows[0].canonical_payload);
  return rows[0].canonical_payload;
}

async function captureForMode(mode) {
  const stored = readStoredCapture();
  if (stored) return { capture: stored, alreadyStored: true };
  if (mode === 'VERIFY') throw new Error('The exact QXO deal-value SEC capture is not stored.');
  const response = await fetchExact();
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: SOURCE.url,
    ...response,
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: contentId('SEC_RETRIEVAL_POLICY/V1', POLICY),
  });
  assertCapture(capture);
  return { capture, alreadyStored: false };
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_value_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function writerSql(request) {
  return `SELECT public.canonical_v2_write(
    'staging', '${request.operation}', '${request.idempotencyKey}', '${request.inputDigest}',
    ${sqlJson(request.writeSet)}, '[]'::jsonb, '[]'::jsonb, ${sqlJson(request.receipt)}
  ) AS result;`;
}

async function buildRequests(capture) {
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const sourceAdmissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const materialise = async (input) => {
    const dryRun = await writer.write({ ...input, dryRun: true });
    const committed = await writer.write(input);
    return { ...input, inputDigest: dryRun.inputDigest, receipt: committed.receipt };
  };
  const intake = await materialise({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: INTAKE_KEY,
    writeSet: { intake_capture: capture },
  });
  const chunks = [];
  for (const chunk of artifact.chunks) {
    chunks.push(await materialise({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `QXO_DEAL_VALUE_SOURCE_ARTIFACT_${artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: { source_artifact_manifest: artifact.manifest, source_artifact_chunk: chunk },
    }));
  }
  const admission = await materialise({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: ADMISSION_KEY,
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: capture.intake_capture_receipt_id,
        source_response_content_id: capture.source_response_content_id,
      },
      conversion_artifact_manifest: artifact.manifest,
      verification,
      source_admission_bundle: sourceAdmissionBundle,
    },
  });
  return { capture, conversion, verification, sourceAdmissionBundle, artifact, intake, chunks, admission };
}

function state(built) {
  const bundle = built.sourceAdmissionBundle;
  const rows = runSql(`SELECT jsonb_build_object(
    'capture', EXISTS (SELECT 1 FROM canonical_v2_staging.intake_capture_receipts WHERE intake_capture_receipt_id='${built.capture.intake_capture_receipt_id}'),
    'artifact_manifest', EXISTS (SELECT 1 FROM canonical_v2_staging.source_artifact_manifests WHERE artifact_manifest_id='${built.artifact.manifest.artifact_manifest_id}'),
    'artifact_chunks', (SELECT count(*) = ${built.artifact.manifest.chunk_count} FROM canonical_v2_staging.source_artifact_chunks WHERE artifact_manifest_id='${built.artifact.manifest.artifact_manifest_id}'),
    'conversion', EXISTS (SELECT 1 FROM canonical_v2_staging.canonical_text_conversions WHERE canonical_text_id='${built.conversion.canonical_text_id}'),
    'verification', EXISTS (SELECT 1 FROM canonical_v2_staging.canonical_text_verification_manifests WHERE verification_manifest_id='${built.verification.verification_manifest_id}' AND canonical_payload->>'verification_status'='PASS'),
    'immutable_source', EXISTS (SELECT 1 FROM canonical_v2_staging.immutable_source_documents WHERE immutable_source_document_id='${bundle.immutable_source_document.immutable_source_document_id}'),
    'admission', EXISTS (SELECT 1 FROM canonical_v2_staging.source_admission_manifests WHERE source_admission_manifest_id='${bundle.source_admission_manifest.source_admission_manifest_id}' AND canonical_payload->>'admission_state'='VERIFIED'),
    'semantic_input', EXISTS (SELECT 1 FROM canonical_v2_staging.semantic_extraction_input_envelopes WHERE semantic_extraction_input_envelope_id='${bundle.semantic_extraction_input_envelope.semantic_extraction_input_envelope_id}')
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) throw new Error('QXO deal-value source state could not be read.');
  return rows[0].state;
}

function assertCommitted(value) {
  const missing = Object.entries(value).filter(([, present]) => present !== true).map(([key]) => key);
  if (missing.length) throw new Error(`QXO deal-value source admission is incomplete: ${missing.join(', ')}.`);
}

function assertBounded(built) {
  const requests = [built.intake, ...built.chunks, built.admission];
  const sizes = requests.map((request) => Buffer.byteLength(writerSql(request), 'utf8'));
  if (sizes.some((size) => size > MAX_WRITER_REQUEST_BYTES)) {
    throw new Error('A QXO deal-value source writer request exceeds its bounded transport limit.');
  }
  return Math.max(...sizes);
}

function attestation(built, mode, maximumWriterRequestByteLength) {
  const bundle = built.sourceAdmissionBundle;
  return {
    schema_version: 'QXO_DEAL_VALUE_SOURCE_STAGING_ATTESTATION/V1',
    environment: 'staging',
    mode,
    source_response_content_id: built.capture.source_response_content_id,
    document_hash: built.capture.response_bytes_sha256,
    intake_capture_receipt_id: built.capture.intake_capture_receipt_id,
    canonical_text_id: built.conversion.canonical_text_id,
    canonical_text_sha256: built.conversion.canonical_text_sha256,
    immutable_source_document_id: bundle.immutable_source_document.immutable_source_document_id,
    source_admission_manifest_id: bundle.source_admission_manifest.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: bundle.semantic_extraction_input_envelope.semantic_extraction_input_envelope_id,
    admission_state: bundle.source_admission_manifest.admission_state,
    conversion_artifact_chunk_count: built.artifact.manifest.chunk_count,
    maximum_writer_request_byte_length: maximumWriterRequestByteLength,
  };
}

const invocation = Object.freeze({ '--dry-run': 'DRY_RUN', '--apply': 'APPLY', '--verify': 'VERIFY' });
const mode = process.argv[2];
if (!invocation[mode] || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-deal-value-source.mjs --dry-run|--apply|--verify');
}

try {
  stage = 'GUARD_PROJECT';
  guardProject();
  stage = 'LOAD_OR_FETCH_CAPTURE';
  const { capture, alreadyStored } = await captureForMode(invocation[mode]);
  stage = 'BUILD_CANONICAL_REQUESTS';
  const built = await buildRequests(capture);
  const maximumWriterRequestByteLength = assertBounded(built);
  if (invocation[mode] === 'VERIFY') {
    stage = 'VERIFY_STORED_SOURCE';
    assertCommitted(state(built));
  } else if (invocation[mode] === 'APPLY') {
    if (!alreadyStored) {
      stage = 'ROLLBACK_INTAKE';
      runSql(writerSql(built.intake));
      stage = 'COMMIT_INTAKE';
      runSql(writerSql(built.intake), { commit: true });
    }
    for (const chunk of built.chunks) {
      stage = 'ROLLBACK_ARTIFACT_CHUNK';
      runSql(writerSql(chunk));
      stage = 'COMMIT_ARTIFACT_CHUNK';
      runSql(writerSql(chunk), { commit: true });
    }
    stage = 'ROLLBACK_SOURCE_ADMISSION';
    runSql(writerSql(built.admission));
    stage = 'COMMIT_SOURCE_ADMISSION';
    runSql(writerSql(built.admission), { commit: true });
    stage = 'VERIFY_COMMITTED_SOURCE';
    assertCommitted(state(built));
  }
  process.stdout.write(`${canonicalJson(attestation(
    built,
    invocation[mode] === 'APPLY' ? 'COMMITTED' : invocation[mode] === 'VERIFY' ? 'VERIFIED' : 'DRY_RUN',
    maximumWriterRequestByteLength,
  ))}\n`);
} catch (error) {
  fail(error instanceof Error ? `${stage}: ${error.message}` : `${stage}: QXO deal-value source admission failed.`);
}
