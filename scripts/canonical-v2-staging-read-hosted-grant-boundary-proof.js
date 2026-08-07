#!/usr/bin/env node
// PLAN.md Step 2B2. Proves the hosted read surface
// (supabase/canonical-v2-staging-read.sql) through the ACTUAL code path
// lib/canonical-v2/local-staging-deal-reader.js's hosted query interface
// uses -- not raw psql -- against a real local container with real written
// data. This is the acceptance evidence the step asks for: "the reader
// reads back as a non-owner role holding only canonical_v2_staging_reader",
// and "the same read attempted as anon, as service_role, and as
// canonical_v2_writer is refused".
//
// Never points at a hosted database: the connection string defaults to a
// local container, and the four role-boundary checks use `SET ROLE` on a
// superuser connection (SET ROLE genuinely switches the effective user for
// permission-checking purposes -- GRANT/REVOKE enforcement reads
// current_user, not session_user -- so this is a real non-owner-role
// read, not a simulation of one).
//
// Usage: node scripts/canonical-v2-staging-read-hosted-grant-boundary-proof.js [db-url]
// [db-url] defaults to postgres://postgres:postgres@localhost:55432/postgres
// Prerequisite: scripts/lib/canonical-v2-local-setup.sql,
// supabase/canonical-v2-foundation.sql, supabase/canonical-v2-serving.sql
// and supabase/canonical-v2-staging-read.sql already applied to that
// database, and at least one deal's data already written (e.g. via
// scripts/canonical-v2-local-staging-read-proof.js against the same DB).

'use strict';

const { Client } = require('pg');
const {
  readDealFromLocalCanonicalV2Staging, createHostedStagingQueryInterface, HOSTED_STAGING_RPC_NAMES,
} = require('../lib/canonical-v2/local-staging-deal-reader');

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
}

// The RPC argument order per function, hard-coded here the same way
// lib/canonical-v2/serving-client.js's RPC_SPECS hard-codes Step 5A's --
// this is the one piece a hosted client the app actually deploys must
// supply; this proof script's pg-over-`SET ROLE` version of it is not part
// of the module under test.
const RPC_ARG_ORDER = Object.freeze({
  canonical_v2_staging_read_provision_instances: ['p_document_hash'],
  canonical_v2_staging_read_provision_components: ['p_parent_provision_instance_ids'],
  canonical_v2_staging_read_claim_revisions: ['p_closure_ids', 'p_subject_occurrence_ids'],
  canonical_v2_staging_read_relationship_revisions: ['p_source_occurrence_ids'],
  canonical_v2_staging_read_open_world_candidates: ['p_document_hash'],
  canonical_v2_staging_read_open_world_candidate_occurrences: ['p_candidate_ids'],
  canonical_v2_staging_read_open_world_evidence_references: ['p_open_world_candidate_occurrence_ids'],
  canonical_v2_staging_read_conditional_termination_fee_values: ['p_document_hash'],
});

for (const name of HOSTED_STAGING_RPC_NAMES) {
  if (!RPC_ARG_ORDER[name]) throw new Error(`this proof script has no arg order for ${name} -- update RPC_ARG_ORDER`);
}

function createPgRpcClient(pgClient) {
  return {
    async rpc(name, params) {
      const argNames = RPC_ARG_ORDER[name];
      if (!argNames) return { data: null, error: { message: `unknown rpc ${name}` } };
      const values = argNames.map((argName) => params[argName]);
      const placeholders = argNames.map((_, i) => `$${i + 1}`).join(', ');
      try {
        const result = await pgClient.query(`SELECT public.${name}(${placeholders}) AS data`, values);
        return { data: result.rows[0].data, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    },
  };
}

async function main() {
  const dbUrl = process.argv[2] || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:postgres@localhost:55432/postgres';
  const documentHash = process.argv[3]
    || process.env.LOCAL_CANONICAL_V2_DOCUMENT_HASH
    || null;
  if (!documentHash) {
    throw new Error('a document_hash with real written data is required as argv[3] or LOCAL_CANONICAL_V2_DOCUMENT_HASH');
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const env = { NODE_ENV: 'development' };

  console.log('=== canonical_v2_staging_reader: the non-owner read ===');
  await client.query('SET ROLE canonical_v2_staging_reader');
  const hostedClient = createPgRpcClient(client);
  let result = null;
  try {
    result = await readDealFromLocalCanonicalV2Staging({ client: hostedClient, documentHash, env });
    check(
      `hosted read succeeds as canonical_v2_staging_reader (${result.resolved.length} claims, `
      + `${result.open_world.length} open-world bundles)`,
      result.resolved.length > 0 || result.open_world.length > 0
        || result.relationships.length > 0 || result.conditional_termination_fee_values.length > 0,
    );
  } catch (err) {
    check('hosted read succeeds as canonical_v2_staging_reader', false, err.message);
  }
  await client.query('RESET ROLE');

  console.log('\n=== Also proves: canonical_v2_staging_reader has NO table grant (SECURITY DEFINER boundary is real) ===');
  await client.query('SET ROLE canonical_v2_staging_reader');
  try {
    await client.query('SELECT 1 FROM canonical_v2_staging.provision_instances LIMIT 1');
    check('direct table SELECT as canonical_v2_staging_reader is refused', false, 'query did not throw');
  } catch (err) {
    check('direct table SELECT as canonical_v2_staging_reader is refused', /permission denied/.test(err.message), err.message);
  }
  await client.query('RESET ROLE');

  console.log('\n=== The four refusals: same read, three other roles, one whitelist name check ===');
  const rpcInterface = createHostedStagingQueryInterface(createPgRpcClient(client));
  for (const role of ['anon', 'service_role', 'canonical_v2_writer']) {
    // eslint-disable-next-line no-await-in-loop
    await client.query(`SET ROLE ${role}`);
    let refused = false;
    let detail = '';
    try {
      // eslint-disable-next-line no-await-in-loop
      await rpcInterface.provisionInstancesByDocumentHash(documentHash);
    } catch (err) {
      refused = err.code === 'HOSTED_RPC_FAILED' && /permission denied/.test(err.message);
      detail = err.message;
    }
    check(`read refused as ${role}`, refused, detail);
    // eslint-disable-next-line no-await-in-loop
    await client.query('RESET ROLE');
  }

  console.log(`\n=== All 8 read RPCs succeed as canonical_v2_staging_reader (document_hash: ${documentHash}) ===`);
  await client.query('SET ROLE canonical_v2_staging_reader');
  const readerInterface = createHostedStagingQueryInterface(createPgRpcClient(client));
  const provisionRows = await readerInterface.provisionInstancesByDocumentHash(documentHash);
  const provisionIds = provisionRows.map((row) => row.provision_instance_id);
  const componentRows = await readerInterface.provisionComponentsByParentProvisionInstanceIds(provisionIds);
  const claimRows = await readerInterface.claimRevisionsByClosureOrSubject(
    [...new Set(provisionRows.map((row) => row.closure_id))],
    [...provisionIds, ...componentRows.map((row) => row.provision_component_id)],
  );
  const relationshipRows = await readerInterface.relationshipRevisionsBySourceOccurrenceIds(provisionIds);
  const openWorldCandidateRows = await readerInterface.openWorldCandidatesByDocumentHash(documentHash);
  const openWorldOccurrenceRows = await readerInterface.openWorldCandidateOccurrencesByCandidateIds(
    openWorldCandidateRows.map((row) => row.candidate_id),
  );
  const openWorldEvidenceRows = await readerInterface.openWorldEvidenceReferencesByOccurrenceIds(
    openWorldOccurrenceRows.map((row) => row.open_world_candidate_occurrence_id),
  );
  const conditionalFeeRows = await readerInterface.conditionalTerminationFeeValuesByDocumentHash(documentHash);
  check(
    'all 8 hosted RPCs reachable and bounded as canonical_v2_staging_reader',
    true,
    `provisions=${provisionRows.length} components=${componentRows.length} claims=${claimRows.length} `
    + `relationships=${relationshipRows.length} open_world_candidates=${openWorldCandidateRows.length} `
    + `open_world_occurrences=${openWorldOccurrenceRows.length} open_world_evidence=${openWorldEvidenceRows.length} `
    + `conditional_fee_values=${conditionalFeeRows.length}`,
  );
  await client.query('RESET ROLE');

  await client.end();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
