#!/usr/bin/env node
// PLAN.md Step 4A3. Proves the wiring Step 4A2 disclosed as missing: that a
// REAL extraction run's OWN write-set -- produced by calling the real
// `buildNativeWriteSet` (native-write-set-adapter.js) on that run's own
// committed run-receipt/resolution, not a hand-built harness input -- now
// carries `conditional_termination_fee_values` through
// `evidence-to-write-set-bridge.js`'s validators and `canonical-writer.js`'s
// DEAL_SCOPE_RUN writer into `public.canonical_v2_write`, and that the Modiv
// headline number arrives in the table.
//
// WHY THIS DOES NOT JUST RE-RUN scripts/canonical-v2-local-conditional-fee-
// write.js. That script (Step 4A2) proved the SQL side by manually splicing
// `resolution.json#conditional_termination_fee_values` onto the JS bridge's
// base write-set -- necessary then, because neither the adapter nor
// validate-write-set.js/canonical-writer.js knew this key. This script
// proves the OPPOSITE half: with the adapter and both validators now fixed
// (this step), the field should require NO manual splicing at all. So this
// script:
//   1. Reads the run's own committed run-receipt.json and resolution.json
//      (evidence/canonical-v2/modiv-termination-fee-20260807-replay -- no
//      live model call, fully deterministic from committed data).
//   2. Reconstructs the RESOLVED run receipt exactly as
//      scripts/canonical-v2-live-extraction-run.mjs:1304-1307 does
//      (`{...receipt, compiled_candidates: resolution.resolved.map(e =>
//      e.compiled_candidate)}`) and calls `buildNativeWriteSet` -- the real,
//      now-fixed adapter -- fresh, with `resolution` passed through exactly
//      as production does. This produces a NEW write_set that carries
//      `conditional_termination_fee_values`, without this script ever
//      touching that key itself.
//   3. Composes the full write-set the same way
//      evidence-to-write-set-bridge.js's readRunEvidence does (adapter
//      write_set + provisions/components recovered from resolution.json).
//   4. Feeds it through the REAL bridge path: validateResolvedCanonicalWrite
//      Set, then createCanonicalWriter's DEAL_SCOPE_RUN writer (dry run) --
//      exactly what importRunEvidence does internally. If canonical-writer.
//      js's assertDealScopeWriteSetShape had not also been widened, this
//      step would fail here with INVALID_DEAL_SCOPE_WRITE_SET.
//   5. Persists the source chain (Step 4A's pattern) and calls
//      public.canonical_v2_write with the writer's own publishableWriteSet/
//      residuals/quarantines/receipt -- no manually-assembled write-set.
//   6. Verifies: count in the write-set, count in the table, and the
//      headline row round-tripped byte-identical.
//
// The committed evidence/canonical-v2/modiv-termination-fee-20260807-replay
// directory is READ ONLY here -- never overwritten -- so the baseline
// manifest and every other test pinned against its committed files stay
// unaffected by this proof.
//
// Usage:
//   node scripts/canonical-v2-step-4a3-conditional-fee-adapter-proof.js [run-directory] [db-url]
//
// [run-directory] defaults to
//   evidence/canonical-v2/modiv-termination-fee-20260807-replay
// [db-url] defaults to postgres://postgres:postgres@localhost:55432/postgres

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const {
  adoptPersistedSourceMapPayload,
  retrievalPolicyDigestFor,
  createRebuildingSourceReferenceResolver,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Identical in substance to canonical-v2-local-durable-write.js's function of
// the same name (Step 4A) -- copied rather than imported for the same reason
// that script gives: it is not factored to export its pieces, and this
// script does not own it.
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
  const { receipt } = committed;

  await client.query('BEGIN');
  try {
    const result = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, '[]'::jsonb, '[]'::jsonb, $6::jsonb) AS result`,
      ['staging', operation, idempotencyKey, dry.inputDigest, JSON.stringify(writeSet), JSON.stringify(receipt)],
    );
    await client.query('COMMIT');
    return {
      replayed: false, receipt, inputDigest: dry.inputDigest, sqlResult: result.rows[0].result,
    };
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

  // --- Step 1: reconstruct the exact write-set the REAL, now-fixed adapter
  // produces from this run's own committed data. No live model call: the
  // resolved run receipt and resolution are already on disk.
  const rawReceipt = readJson(path.join(runDirectory, 'run-receipt.json'));
  const resolution = readJson(path.join(runDirectory, 'resolution.json'));
  const oldAdapterResult = readJson(path.join(runDirectory, 'adapter-result.json'));
  const admittedSourceContext = oldAdapterResult.admitted_source_contexts[0];
  const sourceText = admittedSourceContext.canonical_text.text;
  const documentHash = admittedSourceContext.document_hash;

  const resolvedRunReceipt = {
    ...rawReceipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };

  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: sourceText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
    resolution,
  });

  console.log('--- Fresh adapter call (real inputs, no manual splicing) ---');
  console.log(JSON.stringify({
    write_set_carries_key: Object.prototype.hasOwnProperty.call(
      adapterResult.write_set, 'conditional_termination_fee_values',
    ),
    conditional_termination_fee_values_in_fresh_write_set:
      (adapterResult.write_set.conditional_termination_fee_values || []).length,
    counts_conditional_termination_fee_values_written:
      adapterResult.counts.conditional_termination_fee_values_written,
  }, null, 2));

  if ((adapterResult.write_set.conditional_termination_fee_values || []).length === 0) {
    throw new Error(
      'the fresh adapter call produced no conditional_termination_fee_values -- either the wiring '
      + 'regressed or this is the wrong run directory for this proof.',
    );
  }

  // --- Step 2: compose the full write-set exactly as evidence-to-write-set-
  // bridge.js's readRunEvidence does -- adapter write_set plus provisions/
  // components recovered from resolution.json. No hand-built fields.
  const provisionsById = new Map(
    resolution.resolved
      .map((entry) => entry.provision_instance)
      .filter(Boolean)
      .map((provision) => [provision.provision_instance_id, provision]),
  );
  const freshWriteSet = {
    ...adapterResult.write_set,
    provisions: [...provisionsById.values()],
    components: adapterResult.write_set.components || [],
  };

  // --- Step 3: the REAL bridge path -- validateResolvedCanonicalWriteSet,
  // exactly as evidence-to-write-set-bridge.js calls it, to inspect the
  // publishable write-set this run now produces.
  const contractBundle = compileFixtureContractV38();
  const revalidation = validateResolvedCanonicalWriteSet({
    writeSet: freshWriteSet,
    contractBundle,
    admittedSourceContexts: [admittedSourceContext],
  });
  console.log('\n--- validateResolvedCanonicalWriteSet (the real bridge validator) ---');
  console.log(JSON.stringify({
    accepted: revalidation.accepted,
    conditional_termination_fee_values_in_publishable_write_set:
      (revalidation.publishableWriteSet.conditional_termination_fee_values || []).length,
    counts: revalidation.counts,
  }, null, 2));

  // --- Step 4: persist the source chain (Step 4A's pattern), then run the
  // freshWriteSet through the REAL canonical-writer.js DEAL_SCOPE_RUN writer
  // -- the same call evidence-to-write-set-bridge.js's importRunEvidence
  // makes, decorated with the same rebuilding source-reference resolver, so
  // this exercises canonical-writer.js's own (now-widened)
  // assertDealScopeWriteSetShape, not a bypass of it.
  const chain = rebuildSourceChainForPersistence(runDirectory);
  const chainRepository = new InMemoryCanonicalRepository();
  const chainWriter = createCanonicalWriter({ repository: chainRepository });
  const dealName = readJson(path.join(runDirectory, 'source-reference.json')).deal || 'run';

  const intakeResult = await writeOperation({
    client,
    writer: chainWriter,
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: `LOCAL_${dealName}_4A3_INTAKE`,
    writeSet: { intake_capture: chain.capture },
  });

  const chunkResults = [];
  for (const chunk of chain.artifact.chunks) {
    // eslint-disable-next-line no-await-in-loop
    const chunkResult = await writeOperation({
      client,
      writer: chainWriter,
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `LOCAL_${dealName}_4A3_CHUNK_${chain.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: { source_artifact_manifest: chain.artifact.manifest, source_artifact_chunk: chunk },
    });
    chunkResults.push(chunkResult);
  }

  const admissionResult = await writeOperation({
    client,
    writer: chainWriter,
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: `LOCAL_${dealName}_4A3_ADMISSION`,
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

  console.log('\n--- Source chain persisted ---');
  console.log(JSON.stringify({
    intake: { replayed: intakeResult.replayed, receiptId: intakeResult.receipt.receiptId },
    chunks: chunkResults.length,
    admission: { replayed: admissionResult.replayed, receiptId: admissionResult.receipt.receiptId },
  }, null, 2));

  const dealRepository = new InMemoryCanonicalRepository();
  const resolver = createRebuildingSourceReferenceResolver({ runDirectory });
  const resolvingRepository = Object.create(dealRepository, {
    resolveAdmittedSourceReferences: { value: resolver },
    transaction: {
      value: (work, ...rest) => dealRepository.transaction(
        (handle) => work(Object.create(handle, {
          resolveAdmittedSourceReferences: { value: resolver },
        })),
        ...rest,
      ),
    },
  });
  const dealWriter = createCanonicalWriter({ repository: resolvingRepository, contractBundle });
  const idempotencyKey = 'evidence-bridge:step-4a3-conditional-fee-adapter-proof:'
    + `${admittedSourceContext.document_hash}:TERMINATION_FEE`;

  // Dry run through the REAL writer -- this is the call that would have
  // thrown INVALID_DEAL_SCOPE_WRITE_SET before canonical-writer.js's
  // assertDealScopeWriteSetShape was widened to accept the new key.
  const dryRun = await dealWriter.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    dryRun: true,
    writeSet: freshWriteSet,
  });
  console.log('\n--- JS writer (createCanonicalWriter), DEAL_SCOPE_RUN, dry run ---');
  console.log(JSON.stringify({
    inputDigest: dryRun.inputDigest,
    conditional_termination_fee_values_in_publishable_write_set:
      (dryRun.validation.publishableWriteSet.conditional_termination_fee_values || []).length,
  }, null, 2));

  const publishableWriteSet = dryRun.validation.publishableWriteSet;
  const { residuals } = dryRun.validation;
  const { quarantines } = dryRun.validation;
  const conditionalFeeValuesInWriteSet = publishableWriteSet.conditional_termination_fee_values || [];

  // --- Step 5: the SQL writer side, durably -- given exactly the writer's
  // own publishableWriteSet, never a manually re-assembled one.
  const receiptBody = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    inputDigest: dryRun.inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: dryRun.validation.counts.publishable,
    residualCount: residuals.length,
    quarantinedClosureCount: quarantines.length,
  };
  const receipt = { ...receiptBody, receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', receiptBody) };

  let sqlResult;
  await client.query('BEGIN');
  try {
    const queryResult = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb) AS result`,
      [
        'staging',
        'DEAL_SCOPE_RUN',
        idempotencyKey,
        dryRun.inputDigest,
        JSON.stringify(publishableWriteSet),
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

  // --- Step 6: headline round trip, from a fresh connection's query, same
  // canonical-bytes comparison Step 4A2 established (jsonb reorders keys on
  // output; canonicalJson is this codebase's own notion of "identical").
  const headlineSource = conditionalFeeValuesInWriteSet.find(
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
  const headlineCanonicalMatch = headlineRoundTrip
    ? canonicalJson(headlineRoundTrip) === canonicalJson(headlineSource)
    : false;

  console.log('\n--- Verification ---');
  console.log(JSON.stringify({
    conditional_termination_fee_values_in_write_set: conditionalFeeValuesInWriteSet.length,
    conditional_termination_fee_values_row_count: rowCount.rows[0].n,
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
