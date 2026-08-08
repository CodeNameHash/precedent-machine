#!/usr/bin/env node
// PLAN.md Step 2B, the read half. Proves
// lib/canonical-v2/local-staging-deal-reader.js against the SAME local
// container Step 4A (scripts/canonical-v2-local-durable-write.js) writes
// into, with real written data, for at least two families.
//
// What this script does, in order:
//   1. Durably writes two real Modiv families (no-other-reps, antitrust)
//      through the SAME path scripts/canonical-v2-local-durable-write.js
//      uses -- the JS writer, then public.canonical_v2_write -- and reads
//      them back through the new reader, comparing counts written vs read
//      and round-tripping a sample row through canonicalJson (not
//      JSON.stringify: Postgres jsonb reorders object keys on output).
//   2. Builds ONE additional synthetic fixture deal carrying both a governed
//      claim and an open-world entry from the SAME buildNativeWriteSet call
//      (the exact pattern tests/canonical-v2-open-world-write-boundary.test.js
//      proves at the write boundary), inserts its rows directly into the
//      governed and open-world tables using the identical
//      (id, closure_id, canonical_payload) column shape
//      supabase/canonical-v2-foundation.sql's own INSERT statements use, and
//      reads it back to prove the governed/open-world distinction survives.
//      THIS PART DOES NOT CALL public.canonical_v2_write -- see the comment
//      at writeSyntheticFixtureDirectly() for exactly why and what that does
//      and does not prove.
//   3. Proves the reader refuses an empty-looking deal rather than reporting
//      success, and refuses to run at all in a production-shaped environment.
//
// Usage: node scripts/canonical-v2-local-staging-read-proof.js [db-url]
// [db-url] defaults to postgres://postgres:postgres@localhost:55432/postgres

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');

const { importRunEvidence } = require('../lib/canonical-v2/evidence-to-write-set-bridge');
const {
  adoptPersistedSourceMapPayload, retrievalPolicyDigestFor,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV38, compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildSourceArtifactChunks } = require('../lib/canonical-v2/source-artifact-chunks');
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
} = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { buildSyntheticMixedFixture } = require('../tests/helpers/local-staging-read-fixture');
const {
  readDealFromLocalCanonicalV2Staging, LocalStagingReadError,
} = require('../lib/canonical-v2/local-staging-deal-reader');

const REPO_ROOT = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
}

// ── Part 1: real Modiv families, through the real writer, both sides. ──
// Reproduces admitted-source-chain-rebuild.js's captureInputsFor + the body
// of rebuildAdmittedSourcePrimitives -- copied from
// canonical-v2-local-durable-write.js rather than imported, because that
// script keeps the intermediate values (capture/conversion/verification/
// bundle) private to its own main(); duplicated here rather than refactored
// so this remains a read-side proof script that does not risk changing the
// write-side one PLAN.md's evidence already cites by exact behaviour.
function rebuildSourceChainForPersistence(runDirectory) {
  const dir = path.resolve(runDirectory);
  const sourceReference = readJson(path.join(dir, 'source-reference.json'));
  const recorded = sourceReference.admitted_source_capture_inputs || null;
  const rawHtmlRelative = (recorded && recorded.raw_html_path) || sourceReference.reused_committed_raw_html;
  const rawHtmlPath = path.isAbsolute(rawHtmlRelative) ? rawHtmlRelative : path.join(REPO_ROOT, rawHtmlRelative);
  const rawBytes = fs.readFileSync(rawHtmlPath);

  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: (recorded && recorded.retrieval_url) || sourceReference.retrieval_url,
    final_url: (recorded && recorded.retrieval_url) || sourceReference.retrieval_url,
    status_code: 200,
    content_type: (recorded && recorded.content_type) || 'text/html; charset=UTF-8',
    retrieved_at: recorded && recorded.retrieved_at,
    retrieval_policy_digest: (recorded && recorded.retrieval_policy_digest) || retrievalPolicyDigestFor(sourceReference.deal),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  let conversion = convertSecHtmlToCanonicalText(capture);
  if (recorded && recorded.source_map_payload_path) {
    const payloadPath = path.isAbsolute(recorded.source_map_payload_path)
      ? recorded.source_map_payload_path : path.join(REPO_ROOT, recorded.source_map_payload_path);
    conversion = adoptPersistedSourceMapPayload({
      conversion, payloadBytes: fs.readFileSync(payloadPath), expectedSha256: recorded.source_map_compressed_sha256,
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

// Idempotent: a second run against the same container replays rather than
// re-writing, exactly like scripts/canonical-v2-local-durable-write.js.
async function ensureModivFamilyWrittenDurably({ client, runDirectory }) {
  const dir = path.isAbsolute(runDirectory) ? runDirectory : path.join(REPO_ROOT, runDirectory);
  const chain = rebuildSourceChainForPersistence(dir);
  const chainRepository = new InMemoryCanonicalRepository();
  const chainWriter = createCanonicalWriter({ repository: chainRepository });
  const dealName = readJson(path.join(dir, 'source-reference.json')).deal || 'run';

  await writeOperation({
    client, writer: chainWriter, operation: 'INTAKE_CAPTURE',
    idempotencyKey: `LOCAL_${dealName}_INTAKE`, writeSet: { intake_capture: chain.capture },
  });
  for (const chunk of chain.artifact.chunks) {
    // eslint-disable-next-line no-await-in-loop
    await writeOperation({
      client, writer: chainWriter, operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey: `LOCAL_${dealName}_CHUNK_${chain.artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: { source_artifact_manifest: chain.artifact.manifest, source_artifact_chunk: chunk },
    });
  }
  await writeOperation({
    client, writer: chainWriter, operation: 'PREPARE_SOURCE_ADMISSION',
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

  const contractBundle = compileFixtureContractV38();
  const dealRepository = new InMemoryCanonicalRepository();
  const jsResult = await importRunEvidence({
    runDirectory: dir, repository: dealRepository, contractBundle, dryRun: false, operation: 'DEAL_SCOPE_RUN',
  });
  const { receipt: jsWrite } = jsResult;
  const { validation } = jsWrite;
  const writeSetForSql = validation.publishableWriteSet;

  await client.query('BEGIN');
  let sqlResult;
  try {
    const queryResult = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb) AS result`,
      ['staging', 'DEAL_SCOPE_RUN', jsResult.idempotency_key, jsWrite.receipt.inputDigest,
        JSON.stringify(writeSetForSql), JSON.stringify(validation.residuals),
        JSON.stringify(validation.quarantines), JSON.stringify(jsWrite.receipt)],
    );
    sqlResult = queryResult.rows[0].result;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }

  return {
    dealName,
    writeSet: writeSetForSql,
    receiptId: jsWrite.receipt.receiptId,
    sqlStatus: sqlResult.status,
    documentHash: writeSetForSql.claims[0]
      ? null // claims carry no document_hash; taken from provisions below
      : null,
  };
}

// ── Part 2: one synthetic fixture, governed + open-world from one call. ──
// WHY THIS DOES NOT CALL public.canonical_v2_write, unlike part 1.
// DEAL_SCOPE_RUN's SQL branch resolves source_references against rows
// PERSISTED in canonical_v2_staging.immutable_source_documents /
// .source_admission_manifests / .semantic_extraction_input_envelopes /
// .canonical_text_conversions -- the same requirement local-durable-write.js
// documents and this script's Part 1 satisfies for two real Modiv deals by
// rebuilding the chain from committed raw HTML
// (buildSecEdgarIntakeCapture/convertSecHtmlToCanonicalText/
// verifySecHtmlCanonicalText/buildVerifiedSecSourceAdmission). This
// fixture's document is synthetic identity-converted text
// (buildIdentityAdmittedSourceContext, the same helper
// canonical-v2-open-world-write-boundary.test.js uses), not a SEC filing,
// so it has no raw HTML to persist that chain from. Rebuilding an
// equivalent chain for a synthetic document is write-half plumbing outside
// this read-half task's scope, and inventing one would risk exactly the
// "confident structural claim built on one unchecked assumption" failure
// CLAUDE.md warns about.
//
// What this DOES prove, honestly: the exact row objects
// buildNativeWriteSet (native-write-set-adapter.js, the real write-boundary
// code) produces for a governed claim and an open-world entry drawn from the
// SAME provider call -- proven correct at the write boundary already by
// tests/canonical-v2-open-world-write-boundary.test.js -- inserted with the
// IDENTICAL (id, closure_id, canonical_payload) column shape
// supabase/canonical-v2-foundation.sql's own INSERT statements use (grepped
// directly, not assumed), survive a real Postgres jsonb round trip and come
// back out through this task's new reader distinguishable by their
// evidence_governance marker. What it does NOT prove: that
// public.canonical_v2_write's own validation accepts this write-set (that is
// Part 1's proof, for two real families) or that a synthetic fixture deal
// can complete the DEAL_SCOPE_RUN source-chain persistence Part 1 exercises.

async function writeSyntheticFixtureDirectly({ client, writeSet }) {
  const insert = async (table, idField, rows) => {
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO canonical_v2_staging.${table}(${idField}, closure_id, canonical_payload)
         VALUES ($1, $2, $3::jsonb) ON CONFLICT (${idField}) DO NOTHING`,
        [row[idField], row.closure_id, JSON.stringify(row)],
      );
    }
  };
  await insert('excerpts', 'excerpt_id', writeSet.excerpts);
  await insert('provision_instances', 'provision_instance_id', writeSet.provisions);
  await insert('claim_revisions', 'claim_revision_id', writeSet.claims);
  await insert('open_world_candidates', 'candidate_id', writeSet.open_world_candidates);
  await insert('open_world_candidate_occurrences', 'open_world_candidate_occurrence_id', writeSet.open_world_candidate_occurrences);
  await insert('open_world_evidence_references', 'evidence_reference_id', writeSet.open_world_evidence_references);
}

async function main() {
  const dbUrl = process.argv[2] || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:postgres@localhost:55432/postgres';
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const env = { NODE_ENV: 'development' }; // local/dev shape -- isPermittedCanonicalV2Runtime allows this

  console.log('=== Part 1: two real Modiv families, real writer, real DB ===');
  const families = [
    { dir: 'evidence/canonical-v2/modiv-no-other-reps-20260807-replay', label: 'NO_OTHER_REPS_FRAUD' },
    { dir: 'evidence/canonical-v2/modiv-antitrust-20260807-replay', label: 'ANTITRUST_REGULATORY' },
  ];
  const familyResults = [];
  for (const family of families) {
    // eslint-disable-next-line no-await-in-loop
    const result = await ensureModivFamilyWrittenDurably({ client, runDirectory: family.dir });
    const documentHash = result.writeSet.provisions[0].document_hash;
    familyResults.push({
      ...family, documentHash, writeSet: result.writeSet, receiptId: result.receiptId,
    });
    console.log(`  wrote ${family.label}: claims=${result.writeSet.claims.length} `
      + `provisions=${result.writeSet.provisions.length} excerpts=${result.writeSet.excerpts.length} `
      + `sql_status=${result.sqlStatus}`);
  }

  console.log('\n=== Part 1: read back through lib/canonical-v2/local-staging-deal-reader.js ===');
  // IMPORTANT, and the point PLAN.md's trap #2 exists to make concrete:
  // document_hash is the DEAL identity, not deal_key -- deal_key is per
  // (deal, family). Both families below are the SAME Modiv document, so a
  // read by document_hash correctly returns BOTH families' claims together,
  // not just one. Comparing "claims written by this family" against "total
  // claims read for the deal" would fail for exactly that reason and would
  // be the reader working correctly, not a bug -- so this checks per-family
  // SUBSET containment (every claim this family's write-set produced is
  // present, byte-identical, in the deal-level read) rather than an exact
  // total, and separately reports the deal-level total to make the sharing
  // explicit rather than silently correct.
  let dealLevelRead = null;
  for (const family of familyResults) {
    // eslint-disable-next-line no-await-in-loop
    const read = await readDealFromLocalCanonicalV2Staging({ client, documentHash: family.documentHash, env });
    dealLevelRead = read;
    const readClaimById = new Map(read.resolved.map((entry) => [entry.claim.claim_revision_id, entry]));
    let subsetOk = family.writeSet.claims.length > 0;
    let roundTripOk = true;
    for (const written of family.writeSet.claims) {
      const entry = readClaimById.get(written.claim_revision_id);
      if (!entry) { subsetOk = false; continue; }
      if (canonicalJson(written) !== canonicalJson(entry.claim)) roundTripOk = false;
    }
    check(
      `${family.label}: all ${family.writeSet.claims.length} claims written are present in the deal-level read `
      + `(deal-level total: ${read.resolved.length} claims, shared with other families on this document_hash)`,
      subsetOk,
    );
    check(`${family.label}: every one of its claims round-trips byte-identical (canonicalJson) to what was written`, roundTripOk);
  }
  if (dealLevelRead) {
    const expectedTotal = familyResults.reduce((sum, f) => sum + f.writeSet.claims.length, 0);
    check(
      `deal-level read total (${dealLevelRead.resolved.length}) === sum of both families' written claims (${expectedTotal}) `
      + '-- proves document_hash, not deal_key, is the deal boundary',
      dealLevelRead.resolved.length === expectedTotal,
    );
    const noMarker = dealLevelRead.resolved.every(
      (entry) => !Object.prototype.hasOwnProperty.call(entry.claim, 'evidence_governance'),
    );
    check('deal-level read: every governed claim carries no evidence_governance marker', noMarker);
  }

  console.log('\n=== Part 2: synthetic fixture, governed + open-world from one call ===');
  const fixture = await buildSyntheticMixedFixture();
  console.log(`  built fixture: claims=${fixture.writeSet.claims.length} `
    + `open_world_candidates=${fixture.writeSet.open_world_candidates.length} `
    + `open_world_candidate_occurrences=${fixture.writeSet.open_world_candidate_occurrences.length} `
    + `open_world_evidence_references=${fixture.writeSet.open_world_evidence_references.length}`);
  await writeSyntheticFixtureDirectly({ client, writeSet: fixture.writeSet });

  const fixtureRead = await readDealFromLocalCanonicalV2Staging({ client, documentHash: fixture.documentHash, env });
  check('fixture: 1 governed claim read back', fixtureRead.resolved.length === 1);
  check('fixture: 1 open-world bundle read back', fixtureRead.open_world.length === 1);
  check(
    'fixture: governed claim carries no evidence_governance marker',
    fixtureRead.resolved.length === 1
      && !Object.prototype.hasOwnProperty.call(fixtureRead.resolved[0].claim, 'evidence_governance'),
  );
  if (fixtureRead.open_world.length === 1) {
    const bundle = fixtureRead.open_world[0];
    check(
      'fixture: open-world candidate/occurrence/evidence all carry the marker',
      bundle.candidate.evidence_governance === OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER
        && bundle.occurrence.evidence_governance === OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER
        && bundle.evidenceReferences.length > 0
        && bundle.evidenceReferences.every((e) => e.evidence_governance === OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER),
    );
    check(
      'fixture: open-world candidate round-trips byte-identical (canonicalJson) to what was written',
      canonicalJson(bundle.candidate) === canonicalJson(fixture.writeSet.open_world_candidates[0]),
    );
  }

  console.log('\n=== Part 3: fail-loud guards ===');
  let threwOnEmpty = false;
  try {
    await readDealFromLocalCanonicalV2Staging({
      client, documentHash: sha256Hex('a document_hash that was never written'), env,
    });
  } catch (err) {
    threwOnEmpty = err instanceof LocalStagingReadError && err.code === 'EMPTY_DEAL_READ';
  }
  check('reader throws EMPTY_DEAL_READ rather than reporting success for a deal with no data', threwOnEmpty);

  let threwInProduction = false;
  const productionEnv = { NODE_ENV: 'production' };
  const clientThatMustNotBeQueried = { query: async () => { throw new Error('must not query in production'); } };
  try {
    await readDealFromLocalCanonicalV2Staging({
      client: clientThatMustNotBeQueried, documentHash: familyResults[0].documentHash, env: productionEnv,
    });
  } catch (err) {
    threwInProduction = err instanceof LocalStagingReadError && err.code === 'RUNTIME_NOT_PERMITTED';
  }
  check('reader refuses to run (and never queries) in a production-shaped environment', threwInProduction);

  await client.end();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
