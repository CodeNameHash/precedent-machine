#!/usr/bin/env node
// PLAN.md Step 4A. Executes supabase/canonical-v2-foundation.sql against a
// local, throwaway Postgres container and calls public.canonical_v2_write
// with a real validated write-set produced by the existing bridge
// (lib/canonical-v2/evidence-to-write-set-bridge.js), durably.
//
// No Supabase project, credential, or account is touched. See
// docs/codex-program/notes/step-4a-durable-write.md for the full
// reproduction narrative this script is one part of.
//
// WHY THIS DOES MORE THAN CALL canonical_v2_write ONCE. The SQL function's
// DEAL_SCOPE_RUN branch resolves each write-set source_reference against
// rows already PERSISTED in canonical_v2_staging.immutable_source_documents,
// .source_admission_manifests, .semantic_extraction_input_envelopes and
// .canonical_text_conversions (foundation.sql ~3130-3222). Those rows do not
// exist on a fresh database. The JS writer's bridge
// (evidence-to-write-set-bridge.js) does not need them either: it validates
// the write-set's source chain by REBUILDING it from the committed raw HTML
// in memory (admitted-source-chain-rebuild.js) and never touches a
// database. So a DEAL_SCOPE_RUN call against a fresh schema fails with
// "DEAL_SCOPE_RUN source references are unresolved, mixed or incomplete"
// until the same chain has first been written via three prior
// canonical_v2_write calls: INTAKE_CAPTURE, STAGE_SOURCE_ARTIFACT_CHUNK
// (once per ~192 KiB chunk of the canonical-text-conversion payload) and
// PREPARE_SOURCE_ADMISSION. That is not a JS/SQL disagreement -- it is the
// same source chain, persisted rather than merely rebuilt in memory, and
// scripts/canonical-v2-staging-sec-intake.mjs /
// scripts/canonical-v2-staging-sec-admission.mjs already do exactly this
// sequence against isolated Supabase staging. This script does the same
// three steps against a LOCAL database, deriving the exact same primitives
// admitted-source-chain-rebuild.js derives (same functions, same inputs),
// so the ids line up with what the DEAL_SCOPE_RUN write-set's own
// source_references already name.
//
// Usage:
//   node scripts/canonical-v2-local-durable-write.js <run-directory> [db-url]
//
// <run-directory> defaults to evidence/canonical-v2/modiv-dno-20260807-replay
// [db-url] defaults to postgres://postgres:postgres@localhost:55432/postgres

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const { importRunEvidence } = require('../lib/canonical-v2/evidence-to-write-set-bridge');
const {
  adoptPersistedSourceMapPayload,
  retrievalPolicyDigestFor,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');

const REPO_ROOT = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Reproduces admitted-source-chain-rebuild.js's captureInputsFor + the body
// of rebuildAdmittedSourcePrimitives, but keeps the intermediate `capture`,
// `conversion`, `verification` and `bundle` objects that function does not
// return, because INTAKE_CAPTURE and PREPARE_SOURCE_ADMISSION need them.
// Deliberately calls the SAME exported functions, in the SAME order, on the
// SAME inputs as that module -- so the ids this produces are the ids the
// write-set's own source_references already name.
function rebuildSourceChainForPersistence(runDirectory) {
  const dir = path.resolve(runDirectory);
  const sourceReference = readJson(path.join(dir, 'source-reference.json'));
  const recorded = sourceReference.admitted_source_capture_inputs || null;
  const rawHtmlRelative = (recorded && recorded.raw_html_path)
    || sourceReference.reused_committed_raw_html;
  const rawHtmlPath = path.isAbsolute(rawHtmlRelative)
    ? rawHtmlRelative
    : path.join(REPO_ROOT, rawHtmlRelative);
  const rawBytes = fs.readFileSync(rawHtmlPath);

  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: (recorded && recorded.retrieval_url) || sourceReference.retrieval_url,
    final_url: (recorded && recorded.retrieval_url) || sourceReference.retrieval_url,
    status_code: 200,
    content_type: (recorded && recorded.content_type) || 'text/html; charset=UTF-8',
    retrieved_at: recorded && recorded.retrieved_at,
    retrieval_policy_digest: (recorded && recorded.retrieval_policy_digest)
      || retrievalPolicyDigestFor(sourceReference.deal),
    redirect_count: 0,
    response_bytes: rawBytes,
  });

  let conversion = convertSecHtmlToCanonicalText(capture);
  if (recorded && recorded.source_map_payload_path) {
    const payloadPath = path.isAbsolute(recorded.source_map_payload_path)
      ? recorded.source_map_payload_path
      : path.join(REPO_ROOT, recorded.source_map_payload_path);
    conversion = adoptPersistedSourceMapPayload({
      conversion,
      payloadBytes: fs.readFileSync(payloadPath),
      expectedSha256: recorded.source_map_compressed_sha256,
    });
  }

  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') {
    throw new Error(`source verification did not PASS for ${dir} (${verification.verification_status})`);
  }
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);

  return {
    capture, conversion, verification, bundle, artifact,
  };
}

// Runs one canonical_v2_write operation through the JS writer (in memory,
// to compute the exact inputDigest/receipt envelope) and then through the
// real SQL function against the given client, durably (COMMIT).
async function writeOperation({
  client, writer, operation, idempotencyKey, writeSet,
}) {
  const input = { operation, idempotencyKey, writeSet };
  const dry = await writer.write({ ...input, dryRun: true });
  if (dry.replayed) {
    // Already persisted in-memory by an earlier call in this same process
    // (idempotent replay) -- should not happen within a single run of this
    // script, but handled rather than assumed away.
    return { replayed: true, receipt: dry.receipt, inputDigest: dry.inputDigest };
  }
  const committed = await writer.write(input);
  const receipt = committed.receipt;

  await client.query('BEGIN');
  try {
    const result = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, '[]'::jsonb, '[]'::jsonb, $6::jsonb) AS result`,
      ['staging', operation, idempotencyKey, dry.inputDigest, JSON.stringify(writeSet), JSON.stringify(receipt)],
    );
    await client.query('COMMIT');
    return { replayed: false, receipt, inputDigest: dry.inputDigest, sqlResult: result.rows[0].result };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function main() {
  const runDirectoryArg = process.argv[2]
    || 'evidence/canonical-v2/modiv-dno-20260807-replay';
  const dbUrl = process.argv[3]
    || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:postgres@localhost:55432/postgres';
  const runDirectory = path.isAbsolute(runDirectoryArg)
    ? runDirectoryArg
    : path.join(REPO_ROOT, runDirectoryArg);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // Everything from here on is wrapped in try/finally so the connection is
  // always closed, success or failure. Before this fix, only the success
  // path (the very end of main(), after every step returned) called
  // client.end() -- any error thrown by writeOperation() or by step 3's own
  // BEGIN/COMMIT block propagated straight past it to main().catch() below,
  // which logs and sets process.exitCode but never closes the client. A
  // live TCP socket keeps Node's event loop alive, so the process never
  // exited: every SQL error had to be killed by hand. Each inner
  // BEGIN/COMMIT block still does its own ROLLBACK-then-rethrow (necessary
  // so a partial transaction is never left open on the server), but that is
  // a different concern from closing the client connection itself, which
  // this try/finally now guarantees regardless of how far execution got.
  try {
    await runDealScopeWrite({ client, runDirectory });
  } finally {
    await client.end();
  }
}

async function runDealScopeWrite({ client, runDirectory }) {
  // --- Step 1: persist the source chain (INTAKE_CAPTURE ->
  // STAGE_SOURCE_ARTIFACT_CHUNK* -> PREPARE_SOURCE_ADMISSION), which the SQL
  // DEAL_SCOPE_RUN branch requires to already exist.
  const chain = rebuildSourceChainForPersistence(runDirectory);
  const chainRepository = new InMemoryCanonicalRepository();
  const chainWriter = createCanonicalWriter({ repository: chainRepository });
  const dealName = readJson(path.join(runDirectory, 'source-reference.json')).deal || 'run';

  const intakeResult = await writeOperation({
    client,
    writer: chainWriter,
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `LOCAL_${dealName}_INTAKE`,
    writeSet: { intake_capture: chain.capture },
  });

  const chunkResults = [];
  for (const chunk of chain.artifact.chunks) {
    // eslint-disable-next-line no-await-in-loop
    const chunkResult = await writeOperation({
      client,
      writer: chainWriter,
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `LOCAL_${dealName}_CHUNK_${chain.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: { source_artifact_manifest: chain.artifact.manifest, source_artifact_chunk: chunk },
    });
    chunkResults.push(chunkResult);
  }

  const admissionResult = await writeOperation({
    client,
    writer: chainWriter,
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `LOCAL_${dealName}_ADMISSION`,
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: chain.capture.intake_capture_receipt_id,
        source_response_content_id: chain.capture.source_response_content_id,
      },
      conversion_artifact_manifest: chain.artifact.manifest,
      verification: chain.verification,
      source_admission_bundle: chain.bundle,
    },
  });

  console.log('--- Source chain persisted ---');
  console.log(JSON.stringify({
    intake: { replayed: intakeResult.replayed, receiptId: intakeResult.receipt.receiptId },
    chunks: chunkResults.length,
    admission: { replayed: admissionResult.replayed, receiptId: admissionResult.receipt.receiptId },
  }, null, 2));

  // --- Step 2: the JS writer side for the DEAL_SCOPE_RUN itself: the
  // bridge revalidates the run's evidence (rebuilding, not trusting, the
  // source chain) and hands it to canonical-writer.js.
  const contractBundle = compileFixtureContractV38();
  const dealRepository = new InMemoryCanonicalRepository();
  const jsResult = await importRunEvidence({
    runDirectory,
    repository: dealRepository,
    contractBundle,
    dryRun: false,
    operation: 'DEAL_SCOPE_RUN',
  });

  const { receipt: jsWrite } = jsResult;
  if (jsWrite.dryRun || !jsWrite.receipt) {
    throw new Error(`expected a committed JS writer receipt, got: ${JSON.stringify(jsWrite)}`);
  }
  const { validation } = jsWrite;
  const writeSetForSql = validation.publishableWriteSet;
  const claimCountInWriteSet = (writeSetForSql.claims || []).length;

  console.log('\n--- JS writer (InMemoryCanonicalRepository), DEAL_SCOPE_RUN ---');
  console.log(JSON.stringify({
    run_directory: runDirectory,
    idempotency_key: jsResult.idempotency_key,
    input_digest: jsWrite.receipt.inputDigest,
    receipt: jsWrite.receipt,
    claims_in_write_set: claimCountInWriteSet,
    publishable_counts: Object.fromEntries(
      Object.entries(writeSetForSql)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, v.length]),
    ),
  }, null, 2));

  // --- Step 3: the SQL writer side: call public.canonical_v2_write
  // directly with the exact envelope the JS side computed, against the real
  // local database, durably.
  let sqlResult;
  await client.query('BEGIN');
  try {
    const queryResult = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb) AS result`,
      [
        'staging',
        'DEAL_SCOPE_RUN',
        jsResult.idempotency_key,
        jsWrite.receipt.inputDigest,
        JSON.stringify(writeSetForSql),
        JSON.stringify(validation.residuals),
        JSON.stringify(validation.quarantines),
        JSON.stringify(jsWrite.receipt),
      ],
    );
    sqlResult = queryResult.rows[0].result;
    // Durable: COMMIT, not ROLLBACK. This is the one place Step 4A requires
    // the write to survive.
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }

  console.log('\n--- SQL writer (public.canonical_v2_write), DEAL_SCOPE_RUN ---');
  console.log(JSON.stringify(sqlResult, null, 2));

  const claimRevisionsCount = await client.query(
    'SELECT count(*)::int AS n FROM canonical_v2_staging.claim_revisions',
  );

  console.log('\n--- Verification ---');
  console.log(JSON.stringify({
    claims_in_write_set: claimCountInWriteSet,
    claim_revisions_row_count: claimRevisionsCount.rows[0].n,
    counts_match: claimCountInWriteSet === claimRevisionsCount.rows[0].n,
    js_receipt_id: jsWrite.receipt.receiptId,
    sql_receipt_id: sqlResult && sqlResult.receiptId,
    receipt_ids_match: sqlResult && sqlResult.receiptId === jsWrite.receipt.receiptId,
  }, null, 2));
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
