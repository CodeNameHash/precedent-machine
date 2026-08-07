#!/usr/bin/env node
// PLAN.md Step 4A2. Proves the new canonical_v2_staging.conditional_termination
// _fee_values table and the matching branch in public.canonical_v2_write
// against a real local Postgres container, using the SAME source-chain-
// persistence pattern scripts/canonical-v2-local-durable-write.js (Step 4A)
// established -- copied rather than imported, because that script is owned
// by Step 4A/4A1 and this task does not edit it (docs/core/PLAN.md Step 4A2's
// brief: "you own supabase/canonical-v2-foundation.sql, its digest pins, and
// test files you add").
//
// WHAT THIS ADDS ON TOP OF STEP 4A's HARNESS. The JS bridge
// (lib/canonical-v2/evidence-to-write-set-bridge.js) and the generic JS
// writer (lib/canonical-v2/canonical-writer.js) do not carry
// `conditional_termination_fee_values` through a DEAL_SCOPE_RUN write-set --
// that is a gap in a different file (lib/canonical-v2/native-producer/
// native-write-set-adapter.js, owned by another agent this task explicitly
// must not edit) than the one this step closes. So this script builds the
// base write-set exactly as the JS bridge would (dry run, to get the same
// inputDigest-free intermediate), splices the run's REAL
// `resolution.json#conditional_termination_fee_values` in as an additional
// top-level key -- the exact rows lib/canonical-v2/native-producer/modiv-
// termination-fee-source-parser.js's resolveModivConditionalFees produced,
// unmodified -- and computes a fresh, correct inputDigest/receipt over that
// larger write-set using the SAME schema-agnostic envelope helper
// (buildCanonicalWriteInputDigest) the real writer uses internally. The SQL
// function only ever compares p_input_digest/p_receipt against p_write_set
// content; it does not care which code path produced them, so this is a
// faithful proof of the SQL-side change, not a shortcut around it.
//
// Usage:
//   node scripts/canonical-v2-local-conditional-fee-write.js <run-directory> [db-url]
//
// <run-directory> defaults to
//   evidence/canonical-v2/modiv-termination-fee-20260807-replay

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
const { buildCanonicalWriteInputDigest } = require('../lib/canonical-v2/canonical-write-envelope');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Identical to canonical-v2-local-durable-write.js's function of the same
// name -- see that file's header for why each step is here.
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

async function writeOperation({
  client, writer, operation, idempotencyKey, writeSet,
}) {
  const input = { operation, idempotencyKey, writeSet };
  const dry = await writer.write({ ...input, dryRun: true });
  if (dry.replayed) {
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
    || 'evidence/canonical-v2/modiv-termination-fee-20260807-replay';
  const dbUrl = process.argv[3]
    || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:postgres@localhost:55432/postgres';
  const runDirectory = path.isAbsolute(runDirectoryArg)
    ? runDirectoryArg
    : path.join(REPO_ROOT, runDirectoryArg);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // --- Step 1: persist the source chain, exactly as Step 4A's harness does.
  const chain = rebuildSourceChainForPersistence(runDirectory);
  const chainRepository = new InMemoryCanonicalRepository();
  const chainWriter = createCanonicalWriter({ repository: chainRepository });
  const dealName = readJson(path.join(runDirectory, 'source-reference.json')).deal || 'run';

  const intakeResult = await writeOperation({
    client,
    writer: chainWriter,
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `LOCAL_${dealName}_CONDFEE_INTAKE`,
    writeSet: { intake_capture: chain.capture },
  });

  const chunkResults = [];
  for (const chunk of chain.artifact.chunks) {
    // eslint-disable-next-line no-await-in-loop
    const chunkResult = await writeOperation({
      client,
      writer: chainWriter,
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `LOCAL_${dealName}_CONDFEE_CHUNK_${chain.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: { source_artifact_manifest: chain.artifact.manifest, source_artifact_chunk: chunk },
    });
    chunkResults.push(chunkResult);
  }

  const admissionResult = await writeOperation({
    client,
    writer: chainWriter,
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `LOCAL_${dealName}_CONDFEE_ADMISSION`,
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

  // --- Step 2: the JS bridge's base DEAL_SCOPE_RUN write-set (dry run --
  // this run's provisions/claims/etc, exactly as importRunEvidence would
  // write them). Neither the bridge nor canonical-writer.js knows
  // conditional_termination_fee_values (that wiring is a different,
  // explicitly out-of-scope file); this step's own writer -- the SQL
  // function -- is what is under test, so this script supplies that
  // missing top-level key itself, from the run's own resolution.json,
  // rather than editing the bridge to do it.
  const contractBundle = compileFixtureContractV38();
  const dealRepository = new InMemoryCanonicalRepository();
  const dryRunResult = await importRunEvidence({
    runDirectory,
    repository: dealRepository,
    contractBundle,
    dryRun: true,
    operation: 'DEAL_SCOPE_RUN',
  });
  const baseWriteSet = dryRunResult.receipt.validation.publishableWriteSet;
  const residuals = dryRunResult.receipt.validation.residuals;
  const quarantines = dryRunResult.receipt.validation.quarantines;
  const basePublishableCount = dryRunResult.receipt.validation.counts.publishable;

  const resolution = readJson(path.join(runDirectory, 'resolution.json'));
  const conditionalFeeValues = resolution.conditional_termination_fee_values || [];
  if (conditionalFeeValues.length === 0) {
    throw new Error(`${runDirectory}/resolution.json has no conditional_termination_fee_values -- wrong run directory for this proof.`);
  }

  const writeSetForSql = { ...baseWriteSet, conditional_termination_fee_values: conditionalFeeValues };
  const idempotencyKey = `${dryRunResult.idempotency_key}_CONDFEE_20260807`;
  const publishableObjectCount = basePublishableCount + conditionalFeeValues.length;

  const inputDigest = buildCanonicalWriteInputDigest({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    writeSet: writeSetForSql,
    residuals,
    quarantines,
  });
  const receiptBody = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount,
    residualCount: residuals.length,
    quarantinedClosureCount: quarantines.length,
  };
  const receipt = { ...receiptBody, receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', receiptBody) };

  console.log('\n--- Write-set for SQL (base run + conditional_termination_fee_values) ---');
  console.log(JSON.stringify({
    run_directory: runDirectory,
    idempotency_key: idempotencyKey,
    input_digest: inputDigest,
    receipt,
    conditional_termination_fee_values_in_write_set: conditionalFeeValues.length,
    publishable_counts: Object.fromEntries(
      Object.entries(writeSetForSql)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => [k, v.length]),
    ),
  }, null, 2));

  // --- Step 3: the SQL writer side, durably.
  let sqlResult;
  await client.query('BEGIN');
  try {
    const queryResult = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb) AS result`,
      [
        'staging',
        'DEAL_SCOPE_RUN',
        idempotencyKey,
        inputDigest,
        JSON.stringify(writeSetForSql),
        JSON.stringify(residuals),
        JSON.stringify(quarantines),
        JSON.stringify(receipt),
      ],
    );
    sqlResult = queryResult.rows[0].result;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }

  console.log('\n--- SQL writer (public.canonical_v2_write), DEAL_SCOPE_RUN ---');
  console.log(JSON.stringify(sqlResult, null, 2));

  const rowCount = await client.query(
    'SELECT count(*)::int AS n FROM canonical_v2_staging.conditional_termination_fee_values',
  );

  // --- Step 4: headline round trip. The Modiv headline is the SELLER-side
  // (TERMF-TARGET) Company Termination Fee for the lowest-numbered branch,
  // 7.3(b)(i) -- lib/canonical-v2/termination-product-projection.js's
  // conditionalFeeCardSeed/conditionalFeeHeadline groups ALL SELLER rows
  // into the rendered headline text, but this checks the underlying
  // extracted row itself survives the round trip byte-identical, which is
  // what the headline text is built from.
  const headlineSource = conditionalFeeValues.find(
    (v) => v.fee_side === 'SELLER' && v.triggering_branch === '7.3(b)(i)',
  );
  const headlineReadBack = await client.query(
    `SELECT canonical_payload, canonical_payload_digest
     FROM canonical_v2_staging.conditional_termination_fee_values
     WHERE conditional_termination_fee_value_id = $1`,
    [headlineSource.conditional_termination_fee_value_id],
  );
  const headlineRoundTrip = headlineReadBack.rows[0]
    ? headlineReadBack.rows[0].canonical_payload
    : null;
  // "Byte-identical" means the same canonical bytes this codebase's own
  // identity machinery hashes (canonicalJson / content_id -- sorted keys,
  // ASCII-safe), not the raw jsonb text Postgres happens to print back.
  // jsonb deliberately does not preserve input key order (it stores by an
  // internal key-length/lexicographic order and reorders on the way out),
  // so a plain JSON.stringify(...) === JSON.stringify(...) comparison would
  // report a false mismatch here even though the value is untouched -- it
  // did, on the first run of this script, and this is why the check is
  // canonicalJson rather than JSON.stringify.
  const headlineCanonicalMatch = headlineRoundTrip
    ? canonicalJson(headlineRoundTrip) === canonicalJson(headlineSource)
    : false;

  console.log('\n--- Verification ---');
  console.log(JSON.stringify({
    conditional_termination_fee_values_in_write_set: conditionalFeeValues.length,
    conditional_termination_fee_values_row_count: rowCount.rows[0].n,
    counts_match: conditionalFeeValues.length === rowCount.rows[0].n,
    js_receipt_id: receipt.receiptId,
    sql_receipt_id: sqlResult && sqlResult.receiptId,
    receipt_ids_match: sqlResult && sqlResult.receiptId === receipt.receiptId,
    headline_conditional_termination_fee_value_id:
      headlineSource.conditional_termination_fee_value_id,
    headline_base_amount: headlineSource.base_amount,
    headline_stored_canonical_payload_digest:
      headlineReadBack.rows[0] && headlineReadBack.rows[0].canonical_payload_digest,
    headline_round_trip_canonical_bytes_identical: headlineCanonicalMatch,
  }, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
