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
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  buildSecEdgarIntakeCapture,
  validateSecEdgarIntakeCapture,
} = require('../lib/canonical-v2/sec-edgar-intake-capture');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const SNAPSHOT = Object.freeze({ ref: 'beddepjkshmgenhsrnno', name: 'deal-corpus-canonical-v2-staging-snapshot' });
const QXO_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const EXPECTED = Object.freeze({
  retrieval_url_sha256: 'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256: 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
  response_byte_length: 958459,
});
const IDEMPOTENCY_KEY = 'QXO_SEC_EDGAR_ORIGINAL_V1';
const POLICY = Object.freeze({
  schema_version: 'SEC_RETRIEVAL_POLICY/V1',
  user_agent: 'Deal Corpus canonical intake bengoodchild@gmail.com',
  accept: 'text/html',
  accept_encoding: 'identity',
  redirect_limit: 0,
  timeout_ms: 15000,
  maximum_response_bytes: 2 * 1024 * 1024,
});

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function safeDiagnostic(output) {
  const line = String(output || '').split('\n').find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item));
  return line
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i)).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    : 'Canonical intake database operation failed.';
}

function guardProject(projectDir, expected) {
  const ref = readFileSync(join(projectDir, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(join(projectDir, 'supabase/.temp/linked-project.json'), 'utf8'));
  if (ref !== expected.ref || linked.ref !== expected.ref || linked.name !== expected.name) {
    throw new Error(`Refusing to use a project other than ${expected.name} (${expected.ref}).`);
  }
}

function query(projectDir, sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-sec-intake-'));
  const file = join(directory, commit ? 'commit.sql' : 'rollback.sql');
  writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};\nSET LOCAL statement_timeout='10000ms';\n${sql}\n${commit ? 'COMMIT;' : 'ROLLBACK;'}\n`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 15000,
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

function readSourceUrl(snapshotDir) {
  const rows = query(snapshotDir, `SELECT metadata->>'source_url' AS source_url
FROM public.deals
WHERE id='${QXO_DEAL_ID}'::uuid
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1 || typeof rows[0].source_url !== 'string') {
    throw new Error('The pinned QXO snapshot source URL was not found exactly once.');
  }
  if (sha256Hex(Buffer.from(rows[0].source_url, 'utf8')) !== EXPECTED.retrieval_url_sha256) {
    throw new Error('The pinned QXO SEC source URL digest has drifted.');
  }
  return rows[0].source_url;
}

function fetchExact(url) {
  return new Promise((resolveFetch, reject) => {
    const request = https.get(url, { headers: {
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
        final_url: url,
        redirect_count: 0,
        response_bytes: Buffer.concat(chunks),
      }));
    });
    request.on('error', reject);
    request.setTimeout(POLICY.timeout_ms, () => request.destroy(new Error('SEC retrieval timed out.')));
  });
}

function assertExpectedBytes(capture) {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (capture[key] !== expected) throw new Error(`The original QXO SEC ${key} has drifted.`);
  }
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$intake_${createHash('sha256').update(json).digest('hex').slice(0, 16)}$`;
  if (json.includes(tag)) throw new Error('Unable to construct a safe canonical JSON literal.');
  return `${tag}${json}${tag}::jsonb`;
}

function writeSql({ inputDigest, receipt, capture }) {
  return `SELECT public.canonical_v2_write(
    'staging',
    'INTAKE_CAPTURE',
    '${IDEMPOTENCY_KEY}',
    '${inputDigest}',
    ${sqlJson({ intake_capture: capture })},
    '[]'::jsonb,
    '[]'::jsonb,
    ${sqlJson(receipt)}
  ) AS result;`;
}

async function buildWrite() {
  const snapshotDir = resolve(process.env.CANONICAL_V2_SNAPSHOT_PROJECT_DIR || '');
  if (!process.env.CANONICAL_V2_SNAPSHOT_PROJECT_DIR) {
    throw new Error('CANONICAL_V2_SNAPSHOT_PROJECT_DIR is required.');
  }
  guardProject(snapshotDir, SNAPSHOT);
  const retrievalUrl = readSourceUrl(snapshotDir);
  const response = await fetchExact(retrievalUrl);
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: retrievalUrl,
    ...response,
    retrieved_at: new Date().toISOString(),
    retrieval_policy_digest: contentId('SEC_RETRIEVAL_POLICY/V1', POLICY),
  });
  validateSecEdgarIntakeCapture(capture);
  assertExpectedBytes(capture);
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const input = { operation: 'INTAKE_CAPTURE', idempotencyKey: IDEMPOTENCY_KEY, writeSet: { intake_capture: capture } };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  return { capture, inputDigest: dryRun.inputDigest, receipt: committed.receipt };
}

function verifyStored() {
  const rows = query(ROOT, `SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE canonical_payload->>'retrieval_url_sha256'='${EXPECTED.retrieval_url_sha256}'
  AND canonical_payload->>'response_bytes_sha256'='${EXPECTED.response_bytes_sha256}'
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1) throw new Error('The exact QXO SEC intake capture is not stored exactly once.');
  validateSecEdgarIntakeCapture(rows[0].canonical_payload);
  assertExpectedBytes(rows[0].canonical_payload);
  return rows[0].canonical_payload;
}

function attestation(capture, mode) {
  return {
    schema_version: 'SEC_EDGAR_INTAKE_STAGING_ATTESTATION/V1',
    environment: 'staging',
    mode,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    source_response_content_id: capture.source_response_content_id,
    retrieval_url_sha256: capture.retrieval_url_sha256,
    response_bytes_sha256: capture.response_bytes_sha256,
    response_byte_length: capture.response_byte_length,
    canonical_text_status: capture.canonical_text_status,
    source_admission_status: capture.source_admission_status,
  };
}

const mode = process.argv[2];
if (!['--dry-run', '--apply', '--verify'].includes(mode) || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-sec-intake.mjs --dry-run|--apply|--verify');
}

try {
  guardProject(ROOT, STAGING);
  if (mode === '--verify') {
    process.stdout.write(`${canonicalJson(attestation(verifyStored(), 'VERIFIED'))}\n`);
  } else {
    const write = await buildWrite();
    query(ROOT, writeSql(write));
    if (mode === '--apply') query(ROOT, writeSql(write), { commit: true });
    const capture = mode === '--apply' ? verifyStored() : write.capture;
    process.stdout.write(`${canonicalJson(attestation(capture, mode === '--apply' ? 'COMMITTED' : 'ROLLED_BACK'))}\n`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical SEC intake failed.');
}
