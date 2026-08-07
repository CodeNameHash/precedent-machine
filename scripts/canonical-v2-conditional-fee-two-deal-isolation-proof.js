#!/usr/bin/env node
// PLAN.md Step 2C1. Proves the acceptance criterion the step names as "the
// point of the step": two deals' conditional_termination_fee_values rows in
// canonical_v2_staging at once, and each deal's serving payload contains
// only its own -- proven by writing a second deal's values and reading both
// back, not by inspection.
//
// Part A writes a SECOND, synthetic deal's conditional fee value through
// the real path this table now requires: its own admitted source chain
// (INTAKE_CAPTURE, STAGE_SOURCE_ARTIFACT_CHUNK per chunk, PREPARE_SOURCE_
// ADMISSION), then a DEAL_SCOPE_RUN write-set through public.canonical_v2_
// write, with document_hash populated by the SQL branch this step added.
// It is "synthetic" only in that its source text is a short literal string
// rather than a real SEC filing -- BRANCHES/SIDES on the table (7.3(b)(i)
// etc.) are a fixed shared vocabulary, not Modiv-bound, so a different
// base_amount is enough to get a distinct content-addressed id from every
// real Modiv row, and conditional_termination_fee_values carries no
// closure_id or provision linkage this deal would otherwise need to fake.
//
// Part B assumes Modiv's real 6 rows are ALREADY durably written (by
// scripts/canonical-v2-local-conditional-fee-write.js against the same
// container) and reads BOTH deals back through
// lib/canonical-v2/local-staging-deal-reader.js's new
// readConditionalTerminationFeeValuesForDeal, asserting each document_hash's
// read contains only its own rows.
//
// Part C re-reads Modiv's headline through
// lib/canonical-v2/termination-fee-serving-source.js's real database-backed
// builder (buildModivTerminationFeeCardsFromDatabase) and confirms it is
// unaffected by the second deal's presence in the same table.
//
// Usage: node scripts/canonical-v2-conditional-fee-two-deal-isolation-proof.js [db-url]
// [db-url] defaults to postgres://postgres:postgres@localhost:55432/postgres

'use strict';

const { Client } = require('pg');

const { buildAdmittedSemanticSourceContext, buildAdmittedSourceReference } = require('../lib/canonical-v2/admitted-semantic-source');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildCanonicalWriteInputDigest } = require('../lib/canonical-v2/canonical-write-envelope');
const { buildConditionalTerminationFeeValue } = require('../lib/canonical-v2/native-producer/conditional-termination-fee-value');
const {
  readDealFromLocalCanonicalV2Staging,
  readConditionalTerminationFeeValuesForDeal,
} = require('../lib/canonical-v2/local-staging-deal-reader');
const {
  MODIV_DOCUMENT_HASH,
  MODIV_DEAL_ID,
  buildModivTerminationFeeCardsFromDatabase,
} = require('../lib/canonical-v2/termination-fee-serving-source');

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
}

const SECOND_DEAL_KEY = 'deal:step-2c1-second-deal-isolation-proof';
const SECOND_DEAL_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/0000000000/step-2c1-second-deal.htm';

// A short, synthetic "merger agreement" fragment -- not a real SEC filing.
// Only exists to give convertSecHtmlToCanonicalText something to admit; the
// conditional-fee row this script writes carries no citation into it (the
// row's own source_citations are verbatim clause-reference strings, per
// conditional-termination-fee-value.js, not excerpt ids).
const SECOND_DEAL_HTML = '<html><body><p>SECOND DEAL Termination Fee shall mean an amount equal to the '
  + 'lesser of (i) the Second Deal Base Amount and (ii) the maximum amount, if any, that can be paid without '
  + 'causing a REIT Requirements failure, as determined by independent accountants. Section 9.9(b).</p></body></html>';

async function writeOperation({
  client, writer, operation, idempotencyKey, writeSet,
}) {
  const input = { operation, idempotencyKey, writeSet };
  const dry = await writer.write({ ...input, dryRun: true });
  if (dry.replayed) return { replayed: true, receipt: dry.receipt, inputDigest: dry.inputDigest };
  const committed = await writer.write(input);
  await client.query('BEGIN');
  try {
    await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, '[]'::jsonb, '[]'::jsonb, $6::jsonb) AS result`,
      ['staging', operation, idempotencyKey, dry.inputDigest, JSON.stringify(writeSet), JSON.stringify(committed.receipt)],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
  return { replayed: false, receipt: committed.receipt, inputDigest: dry.inputDigest };
}

// Builds and durably writes ONE conditional-fee-value row for a brand-new,
// synthetic second deal -- its own admitted source chain, its own
// DEAL_SCOPE_RUN, through public.canonical_v2_write, unconnected to Modiv's
// document_hash. Idempotent like every sibling local-write script: a second
// run against the same container replays rather than re-writing.
async function writeSecondDealConditionalFeeValue({ client }) {
  const retrievedAt = '2026-08-07T00:00:00.000Z';
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: SECOND_DEAL_RETRIEVAL_URL,
    final_url: SECOND_DEAL_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: retrievedAt,
    retrieval_policy_digest: sha256Hex(Buffer.from('PLAN.md Step 2C1 synthetic second-deal retrieval policy', 'utf8')),
    redirect_count: 0,
    response_bytes: Buffer.from(SECOND_DEAL_HTML, 'utf8'),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') {
    throw new Error(`second-deal source verification did not PASS (${verification.verification_status})`);
  }
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const artifact = buildSourceArtifactChunks(conversion);

  const chainRepository = new InMemoryCanonicalRepository();
  const chainWriter = createCanonicalWriter({ repository: chainRepository });

  await writeOperation({
    client, writer: chainWriter, operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'STEP_2C1_SECOND_DEAL_INTAKE', writeSet: { intake_capture: capture },
  });
  for (const chunk of artifact.chunks) {
    // eslint-disable-next-line no-await-in-loop
    await writeOperation({
      client, writer: chainWriter, operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `STEP_2C1_SECOND_DEAL_CHUNK_${artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: { source_artifact_manifest: artifact.manifest, source_artifact_chunk: chunk },
    });
  }
  await writeOperation({
    client, writer: chainWriter, operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'STEP_2C1_SECOND_DEAL_ADMISSION',
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: capture.intake_capture_receipt_id,
        source_response_content_id: capture.source_response_content_id,
      },
      conversion_artifact_manifest: artifact.manifest,
      verification,
      source_admission_bundle: bundle,
    },
  });

  const documentHash = bundle.immutable_source_document.response_bytes_sha256;
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: SECOND_DEAL_KEY,
    source_admission_manifest_id: bundle.source_admission_manifest.source_admission_manifest_id,
    contract_fingerprint: 'STEP_2C1_SECOND_DEAL_NO_CONTRACT',
  });
  const context = buildAdmittedSemanticSourceContext({
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope: bundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: SECOND_DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  if (context.document_hash !== documentHash) {
    throw new Error('second-deal document_hash mismatch between admitted context and immutable source document');
  }

  // A different base_amount (and a different branch than Modiv's headline,
  // 7.3(b)(i)) than any of Modiv's 6 real rows -- see this file's header
  // for why a distinct payload, not a distinct table, is what keeps this
  // row's content-addressed id from colliding with one of Modiv's.
  const conditionalFeeValue = buildConditionalTerminationFeeValue({
    fee_side: 'SELLER',
    triggering_branch: '7.3(c)',
    base_amount: '4200000',
    currency: 'USD',
    operator: 'LOWER_OF',
    reit_limit_cap_term_ref: 'Second Deal REIT Requirements',
    defined_term_lineage: ['Second Deal Termination Fee', 'Second Deal Base Amount'],
    source_citations: ['9.9(b)', '9.9(a)'],
    raw_formula: 'an amount equal to the lesser of (i) the Second Deal Base Amount and (ii) the maximum amount, '
      + 'if any, that can be paid without causing a REIT Requirements failure',
  });

  const writeSet = {
    source_references: [buildAdmittedSourceReference(context)],
    deal: {
      deal_key: SECOND_DEAL_KEY,
      deal_admission_id: dealAdmissionId,
      document_hash: documentHash,
    },
    excerpts: [],
    validated_semantic_graphs: [],
    definition_occurrences: [],
    provisions: [],
    components: [],
    condition_groups: [],
    claims: [],
    relationships: [],
    open_world_candidates: [],
    open_world_candidate_occurrences: [],
    open_world_evidence_references: [],
    open_world_candidate_dispositions: [],
    open_world_primitives: [],
    semantic_impact_closures: [],
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: [],
    conditional_termination_fee_values: [conditionalFeeValue],
  };

  // NOT through createCanonicalWriter's convenience wrapper for this
  // operation: writeDealScopeRun resolves source_references against an
  // in-memory repository's OWN prior writes, and the admission chain above
  // ran through a repository this deal's write never shares (matching
  // scripts/canonical-v2-local-conditional-fee-write.js and
  // scripts/canonical-v2-local-staging-read-proof.js, which both hit the
  // identical shape for the same reason and both go around it the same
  // way). This deal's `context` was already built directly above via
  // buildAdmittedSemanticSourceContext, so it is supplied as an already-
  // resolved admittedSourceContexts entry to the lower-level validator
  // instead of asking a resolver to rediscover it.
  const idempotencyKey = 'STEP_2C1_SECOND_DEAL_SCOPE_RUN';
  const contractBundle = compileFixtureContractV38();
  const revalidation = validateResolvedCanonicalWriteSet({
    writeSet, contractBundle, admittedSourceContexts: [context],
  });
  const { publishableWriteSet, residuals, quarantines } = revalidation;
  const publishableObjectCount = revalidation.counts.publishable;
  const inputDigest = buildCanonicalWriteInputDigest({
    operation: 'DEAL_SCOPE_RUN', idempotencyKey, writeSet: publishableWriteSet, residuals, quarantines,
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

  let sqlResult;
  await client.query('BEGIN');
  try {
    const queryResult = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb) AS result`,
      [
        'staging', 'DEAL_SCOPE_RUN', idempotencyKey, inputDigest,
        JSON.stringify(publishableWriteSet), JSON.stringify(residuals),
        JSON.stringify(quarantines), JSON.stringify(receipt),
      ],
    );
    sqlResult = queryResult.rows[0].result;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }

  return {
    documentHash,
    dealAdmissionId,
    writeSet: publishableWriteSet,
    conditionalFeeValue,
    result: { replayed: sqlResult.replayed === true, receipt, sqlResult },
  };
}

async function run(client, dbUrl) {
  const env = { NODE_ENV: 'development' };

  console.log('=== Part A: write a second, synthetic deal\'s conditional fee value ===');
  const second = await writeSecondDealConditionalFeeValue({ client });
  console.log(`  second deal document_hash=${second.documentHash} `
    + `conditional_termination_fee_value_id=${second.conditionalFeeValue.conditional_termination_fee_value_id} `
    + `replayed=${second.result.replayed}`);
  check('second deal document_hash differs from Modiv\'s', second.documentHash !== MODIV_DOCUMENT_HASH);

  const totalRowCount = await client.query(
    'SELECT count(*)::int AS n FROM canonical_v2_staging.conditional_termination_fee_values',
  );
  console.log(`  table now holds ${totalRowCount.rows[0].n} rows total (Modiv's 6 + the second deal's)`);
  check('table holds at least 7 rows (Modiv\'s 6 plus the second deal\'s 1)', totalRowCount.rows[0].n >= 7);

  console.log('\n=== Part B: read each deal back through local-staging-deal-reader.js, scoped ===');
  const modivRows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: MODIV_DOCUMENT_HASH });
  const secondRows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: second.documentHash });

  check('Modiv\'s scoped read returns exactly 6 rows', modivRows.length === 6, `got ${modivRows.length}`);
  check(
    'Modiv\'s scoped read contains NONE of the second deal\'s row',
    !modivRows.some((row) => row.conditional_termination_fee_value_id === second.conditionalFeeValue.conditional_termination_fee_value_id),
  );
  check('the second deal\'s scoped read returns exactly 1 row', secondRows.length === 1, `got ${secondRows.length}`);
  check(
    'the second deal\'s scoped read contains NONE of Modiv\'s 6 rows',
    !secondRows.some((row) => modivRows.some((modivRow) => modivRow.conditional_termination_fee_value_id === row.conditional_termination_fee_value_id)),
  );
  check(
    'the second deal\'s row round-trips byte-identical (canonicalJson) to what was written',
    secondRows.length === 1 && canonicalJson(secondRows[0]) === canonicalJson(second.conditionalFeeValue),
  );

  console.log('\n=== Part B2: the same isolation through the full deal reader ===');
  const modivDeal = await readDealFromLocalCanonicalV2Staging({ client, documentHash: MODIV_DOCUMENT_HASH, env });
  check(
    'readDealFromLocalCanonicalV2Staging(Modiv) carries exactly Modiv\'s 6 conditional fee values',
    Array.isArray(modivDeal.conditional_termination_fee_values) && modivDeal.conditional_termination_fee_values.length === 6,
    `got ${modivDeal.conditional_termination_fee_values && modivDeal.conditional_termination_fee_values.length}`,
  );

  console.log('\n=== Part C: the Modiv headline still serves correctly with a second deal present ===');
  const cards = await buildModivTerminationFeeCardsFromDatabase(MODIV_DEAL_ID, {
    env: { ...process.env, LOCAL_CANONICAL_V2_DB_URL: dbUrl, NODE_ENV: 'development' },
  });
  console.log(`  cards produced: ${cards.length}`);
  check('Modiv still produces cards with the second deal present in the same table', cards.length > 0);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

async function main() {
  const dbUrl = process.argv[2] || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:postgres@localhost:55432/postgres';
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await run(client, dbUrl);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
