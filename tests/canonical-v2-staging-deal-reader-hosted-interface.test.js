'use strict';

// PLAN.md Step 2B2. Hermetic tests for the hosted half of
// lib/canonical-v2/local-staging-deal-reader.js's query interface -- no live
// Postgres connection, so this runs in ordinary `npm test`/CI. The live
// proof against a real container, a real non-owner `canonical_v2_staging_
// reader` role and the four refusals (anon/service_role/canonical_v2_writer,
// plus the direct-table-SELECT check) is
// scripts/canonical-v2-staging-read-hosted-grant-boundary-proof.js -- see
// docs/codex-program/notes/step-2b2-hosted-read-surface.md for its output.
//
// This file's fake "hosted" client implements exactly the surface a real
// hosted client must (`async rpc(name, params) -> { data, error }`, the
// same shape lib/canonical-v2/serving-client.js already returns for Step
// 5A) against the SAME real write-boundary fixture data
// tests/canonical-v2-local-staging-deal-reader.test.js uses for the LOCAL
// interface -- so this proves the hosted path reassembles the identical
// resolution.json-shaped output from the identical underlying rows, not a
// lookalike shape.

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  readDealFromLocalCanonicalV2Staging,
  createHostedStagingQueryInterface,
  createStagingQueryInterface,
  createLocalStagingQueryInterface,
  HOSTED_STAGING_RPC_NAMES,
  LocalStagingReadError,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
} = require('../lib/canonical-v2/local-staging-deal-reader');
const { buildSyntheticMixedFixture } = require('./helpers/local-staging-read-fixture');

function fakeHostedClient(tables) {
  const calls = [];
  return {
    calls,
    async rpc(name, params) {
      calls.push({ name, params });
      if (name === 'canonical_v2_staging_read_provision_instances') {
        return { data: (tables.provision_instances || []).filter((r) => r.document_hash === params.p_document_hash), error: null };
      }
      if (name === 'canonical_v2_staging_read_provision_components') {
        return {
          data: (tables.provision_components || []).filter(
            (r) => params.p_parent_provision_instance_ids.includes(r.parent_provision_instance_id),
          ),
          error: null,
        };
      }
      if (name === 'canonical_v2_staging_read_claim_revisions') {
        return {
          data: (tables.claim_revisions || []).filter(
            (r) => params.p_closure_ids.includes(r.closure_id)
              || params.p_subject_occurrence_ids.includes(r.subject_occurrence_id),
          ),
          error: null,
        };
      }
      if (name === 'canonical_v2_staging_read_relationship_revisions') {
        return {
          data: (tables.relationship_revisions || []).filter(
            (r) => params.p_source_occurrence_ids.includes(r.source_occurrence_id),
          ),
          error: null,
        };
      }
      if (name === 'canonical_v2_staging_read_open_world_candidates') {
        return { data: (tables.open_world_candidates || []).filter((r) => r.document_hash === params.p_document_hash), error: null };
      }
      if (name === 'canonical_v2_staging_read_open_world_candidate_occurrences') {
        return {
          data: (tables.open_world_candidate_occurrences || []).filter((r) => params.p_candidate_ids.includes(r.candidate_id)),
          error: null,
        };
      }
      if (name === 'canonical_v2_staging_read_open_world_evidence_references') {
        return {
          data: (tables.open_world_evidence_references || []).filter(
            (r) => params.p_open_world_candidate_occurrence_ids.includes(r.open_world_candidate_occurrence_id),
          ),
          error: null,
        };
      }
      if (name === 'canonical_v2_staging_read_conditional_termination_fee_values') {
        return {
          data: (tables.conditional_termination_fee_values || [])
            .filter((r) => r.document_hash === params.p_document_hash)
            .map((r) => r.payload),
          error: null,
        };
      }
      return { data: null, error: { message: `fake hosted client cannot route rpc: ${name}` } };
    },
  };
}

let fixture;
test.before(async () => {
  fixture = await buildSyntheticMixedFixture();
});

function tablesFromFixture() {
  const { writeSet } = fixture;
  return {
    provision_instances: writeSet.provisions,
    claim_revisions: writeSet.claims,
    open_world_candidates: writeSet.open_world_candidates,
    open_world_candidate_occurrences: writeSet.open_world_candidate_occurrences,
    open_world_evidence_references: writeSet.open_world_evidence_references,
    relationship_revisions: [],
    conditional_termination_fee_values: [],
  };
}

// ── Dispatch: a .query client goes local, a .rpc client goes hosted. ──

test('createStagingQueryInterface builds the LOCAL interface for a .query client', () => {
  const iface = createStagingQueryInterface({ query: async () => ({ rows: [] }) });
  assert.equal(typeof iface.provisionInstancesByDocumentHash, 'function');
});

test('createStagingQueryInterface builds the HOSTED interface for a .rpc client', () => {
  const iface = createStagingQueryInterface({ rpc: async () => ({ data: [], error: null }) });
  assert.equal(typeof iface.provisionInstancesByDocumentHash, 'function');
});

test('createStagingQueryInterface refuses a client with neither .query nor .rpc', () => {
  assert.throws(() => createStagingQueryInterface({}), TypeError);
  assert.throws(() => createStagingQueryInterface(null), TypeError);
});

test('createLocalStagingQueryInterface issues the exact SQL text this module has always issued '
  + '(the same shapes tests/canonical-v2-local-staging-deal-reader.test.js\'s fake client routes on)', async () => {
  let capturedSql = null;
  const client = {
    query: async (sql, values) => {
      capturedSql = sql;
      assert.deepEqual(values, ['deadbeef']);
      return { rows: [] };
    },
  };
  await createLocalStagingQueryInterface(client).provisionInstancesByDocumentHash('deadbeef');
  assert.match(capturedSql, /FROM canonical_v2_staging\.provision_instances/);
  assert.match(capturedSql, /canonical_payload->>'document_hash' = \$1/);
});

// ── The hosted interface calls the whitelisted RPC, by name, with the
// documented params -- one assertion per of the eight functions this
// module and supabase/canonical-v2-staging-read.sql both define. ──

test('every hosted interface method calls a name in HOSTED_STAGING_RPC_NAMES, with the documented params shape', async () => {
  const client = fakeHostedClient({});
  const iface = createHostedStagingQueryInterface(client);

  await iface.provisionInstancesByDocumentHash('DH');
  await iface.provisionComponentsByParentProvisionInstanceIds(['P1']);
  await iface.claimRevisionsByClosureOrSubject(['C1'], ['S1']);
  await iface.relationshipRevisionsBySourceOccurrenceIds(['S1']);
  await iface.openWorldCandidatesByDocumentHash('DH');
  await iface.openWorldCandidateOccurrencesByCandidateIds(['CAND1']);
  await iface.openWorldEvidenceReferencesByOccurrenceIds(['OCC1']);
  await iface.conditionalTerminationFeeValuesByDocumentHash('DH');

  assert.equal(client.calls.length, 8);
  for (const call of client.calls) {
    assert.ok(HOSTED_STAGING_RPC_NAMES.includes(call.name), `${call.name} is not in HOSTED_STAGING_RPC_NAMES`);
  }
  const byName = Object.fromEntries(client.calls.map((call) => [call.name, call.params]));
  assert.deepEqual(byName.canonical_v2_staging_read_provision_instances, { p_document_hash: 'DH' });
  assert.deepEqual(byName.canonical_v2_staging_read_provision_components, { p_parent_provision_instance_ids: ['P1'] });
  assert.deepEqual(byName.canonical_v2_staging_read_claim_revisions, { p_closure_ids: ['C1'], p_subject_occurrence_ids: ['S1'] });
  assert.deepEqual(byName.canonical_v2_staging_read_relationship_revisions, { p_source_occurrence_ids: ['S1'] });
  assert.deepEqual(byName.canonical_v2_staging_read_open_world_candidates, { p_document_hash: 'DH' });
  assert.deepEqual(byName.canonical_v2_staging_read_open_world_candidate_occurrences, { p_candidate_ids: ['CAND1'] });
  assert.deepEqual(
    byName.canonical_v2_staging_read_open_world_evidence_references,
    { p_open_world_candidate_occurrence_ids: ['OCC1'] },
  );
  assert.deepEqual(byName.canonical_v2_staging_read_conditional_termination_fee_values, { p_document_hash: 'DH' });
});

test('HOSTED_STAGING_RPC_NAMES has exactly eight entries, one per function supabase/canonical-v2-staging-read.sql defines', () => {
  assert.equal(HOSTED_STAGING_RPC_NAMES.length, 8);
  assert.equal(new Set(HOSTED_STAGING_RPC_NAMES).size, 8, 'no duplicate RPC names');
});

// ── A refused read (the grant boundary firing) surfaces as a
// LocalStagingReadError, not a raw driver error a caller has to know to
// unwrap. ──

test('a permission-denied RPC response (the real shape SET ROLE anon/service_role/canonical_v2_writer produces) '
  + 'surfaces as LocalStagingReadError HOSTED_RPC_FAILED', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'permission denied for function canonical_v2_staging_read_provision_instances' } }) };
  const iface = createHostedStagingQueryInterface(client);
  await assert.rejects(
    () => iface.provisionInstancesByDocumentHash('DH'),
    (err) => err instanceof LocalStagingReadError && err.code === 'HOSTED_RPC_FAILED',
  );
});

// ── Bounds: the SQL side enforces its own row/byte ceilings first
// (staging_read_bound() in supabase/canonical-v2-staging-read.sql), but this
// module re-checks on the way back into JS -- the same defense-in-depth
// serving-client.js's boundedRpcData applies to Step 5A's RPCs. A response
// that slips past the SQL check some other way (a stub in a test, a future
// bug) must still be refused here. ──

test('a hosted response over the row ceiling is refused rather than silently truncated or accepted', async () => {
  const oversized = Array.from({ length: 2001 }, (_, i) => ({ id: i }));
  const client = { rpc: async () => ({ data: oversized, error: null }) };
  const iface = createHostedStagingQueryInterface(client);
  await assert.rejects(
    () => iface.provisionInstancesByDocumentHash('DH'),
    (err) => err instanceof LocalStagingReadError && err.code === 'HOSTED_RPC_RESPONSE_EXCEEDED_ROW_CEILING',
  );
});

test('a hosted response over the byte ceiling is refused', async () => {
  const oversized = [{ big: 'x'.repeat(5 * 1024 * 1024) }];
  const client = { rpc: async () => ({ data: oversized, error: null }) };
  const iface = createHostedStagingQueryInterface(client);
  await assert.rejects(
    () => iface.provisionInstancesByDocumentHash('DH'),
    (err) => err instanceof LocalStagingReadError && err.code === 'HOSTED_RPC_RESPONSE_EXCEEDED_BYTE_CEILING',
  );
});

test('a hosted response that is not an array is refused rather than treated as empty', async () => {
  const client = { rpc: async () => ({ data: { not: 'an array' }, error: null }) };
  const iface = createHostedStagingQueryInterface(client);
  await assert.rejects(
    () => iface.provisionInstancesByDocumentHash('DH'),
    (err) => err instanceof LocalStagingReadError && err.code === 'HOSTED_RPC_MALFORMED_RESPONSE',
  );
});

test('a hosted response of null data is treated as zero rows, not an error', async () => {
  const client = { rpc: async () => ({ data: null, error: null }) };
  const iface = createHostedStagingQueryInterface(client);
  const rows = await iface.provisionInstancesByDocumentHash('DH');
  assert.deepEqual(rows, []);
});

// ── End to end: the SAME fixture the local interface's own tests round-trip
// (a governed claim, an open-world bundle, from one buildNativeWriteSet
// call) driven entirely through the HOSTED interface, proving hosted mode
// reassembles the identical resolution.json-shaped output -- not a
// lookalike shape -- from the identical underlying rows. ──

test('readDealFromLocalCanonicalV2Staging through the HOSTED interface reassembles the same shape and same '
  + 'byte-identical payloads as the LOCAL interface does for the same fixture', async () => {
  const client = fakeHostedClient(tablesFromFixture());
  const result = await readDealFromLocalCanonicalV2Staging({ client, documentHash: fixture.documentHash, env: { NODE_ENV: 'test' } });

  assert.equal(result.resolved.length, 1);
  assert.equal(result.open_world.length, 1);
  const [entry] = result.resolved;
  assert.equal(entry.resolved_claim_definition_key, fixture.writeSet.claims[0].claim_definition_key);
  assert.equal(entry.section_reference, null);
  assert.equal(canonicalJson(entry.claim), canonicalJson(fixture.writeSet.claims[0]));

  const [bundle] = result.open_world;
  assert.equal(bundle.candidate.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  assert.equal(canonicalJson(bundle.candidate), canonicalJson(fixture.writeSet.open_world_candidates[0]));
});

test('readDealFromLocalCanonicalV2Staging through the HOSTED interface still throws EMPTY_DEAL_READ '
  + 'for a deal with no data -- the fail-loud guard is interface-agnostic', async () => {
  const client = fakeHostedClient({});
  await assert.rejects(
    () => readDealFromLocalCanonicalV2Staging({ client, documentHash: 'no-such-document', env: { NODE_ENV: 'test' } }),
    (err) => err instanceof LocalStagingReadError && err.code === 'EMPTY_DEAL_READ',
  );
});

test('readDealFromLocalCanonicalV2Staging through the HOSTED interface still refuses to run in a '
  + 'production-shaped environment, without issuing any RPC', async () => {
  const client = { rpc: async () => { throw new Error('must not be called in production'); } };
  await assert.rejects(
    () => readDealFromLocalCanonicalV2Staging({
      client, documentHash: fixture.documentHash, env: { NODE_ENV: 'production' },
    }),
    (err) => err instanceof LocalStagingReadError && err.code === 'RUNTIME_NOT_PERMITTED',
  );
});
