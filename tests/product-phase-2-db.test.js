'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Client } = require('pg');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { assembleAgreementDraft } = require('../lib/product/agreement-draft');
const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');
const { substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const databaseUrl = process.env.TEST_DATABASE_URL;
const pgliteModule = process.env.TEST_PGLITE_MODULE;
if (!databaseUrl && !pgliteModule) throw new Error('TEST_DATABASE_URL or TEST_PGLITE_MODULE is required for the Phase 2 database test');
const ROOT = path.resolve(__dirname, '..');
const migrations = [
  'supabase/migrations/20260905020346_product_phase_1_foundation.sql',
  'supabase/migrations/20260905043000_product_phase_2_vertical_slice.sql',
  'supabase/migrations/20260905190000_product_substantive_section_work.sql',
  'supabase/migrations/20260905200000_product_expired_section_recovery.sql',
  'supabase/migrations/20260905201000_product_residual_pass_persistence.sql',
  'supabase/migrations/20260905202000_product_section_lease_heartbeat.sql',
  'supabase/migrations/20260905204000_product_saved_run_finalization.sql',
  'supabase/migrations/20260905210000_product_structure_versions.sql',
].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'));
let client;

const rpcArguments = {
  product_phase1_persist_source: ['p_source'],
  product_phase1_create_run: ['p_source_document_id', 'p_retrieval_url', 'p_idempotency_key', 'p_schema_version', 'p_prompt_bundle_version', 'p_model_config', 'p_explicit_generation', 'p_max_attempts'],
  product_phase1_attach_structure: ['p_run_id', 'p_structure_id', 'p_structure', 'p_identity_review'],
  product_phase1_fail_run: ['p_run_id', 'p_stage', 'p_error'],
  product_phase1_resolve_identity: ['p_run_id', 'p_resolution'],
  product_phase1_claim_section: ['p_run_id', 'p_worker_id', 'p_lease_seconds'],
  product_phase1_recover_expired_sections: ['p_run_id'],
  product_phase1_renew_section_lease: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_lease_seconds'],
  product_phase1_complete_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_cost_microusd', 'p_input_tokens', 'p_output_tokens'],
  product_phase1_fail_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_error'],
  product_phase2_commit_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_result'],
  product_phase2_finalize_draft: ['p_run_id', 'p_draft'],
  product_phase2_finalize_saved_run: ['p_run_id', 'p_finalization'],
  product_phase2_get_analysis: ['p_run_id'],
  product_phase3_register_run_access: ['p_run_id', 'p_actor'],
  product_phase3_retry_run: ['p_run_id', 'p_actor', 'p_idempotency_key'],
  product_phase3_initialise_review: ['p_run_id', 'p_state', 'p_actor'],
  product_phase3_save_review: ['p_run_id', 'p_expected_version', 'p_state', 'p_actor', 'p_event_type', 'p_action_id', 'p_idempotency_key', 'p_command'],
  product_phase3_restore_review: ['p_run_id', 'p_expected_version', 'p_restore_version', 'p_actor', 'p_action_id', 'p_idempotency_key'],
  product_phase3_get_review: ['p_run_id', 'p_actor'],
};

function databaseFacade() {
  return {
    async rpc(name, parameters) {
      try {
        const names = rpcArguments[name];
        if (!names) throw new Error(`unsupported RPC ${name}`);
        const values = names.map((key) => parameters[key]);
        const markers = values.map((_, index) => `$${index + 1}`).join(',');
        const result = await client.query(`SELECT public.${name}(${markers}) AS data`, values);
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    from(table) {
      if (!/^product_[a-z_]+$/.test(table)) throw new Error('invalid table');
      let columns = '*';
      const filters = [];
      const orders = [];
      let range = null;
      const execute = async (single = false) => {
        try {
          const where = filters.length ? ` WHERE ${filters.map((item, index) => `${item.column} = $${index + 1}`).join(' AND ')}` : '';
          const order = orders.length ? ` ORDER BY ${orders.map((item) => `${item.column} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ')}` : '';
          const bounded = range ? ` LIMIT ${range.to - range.from + 1} OFFSET ${range.from}` : '';
          const result = await client.query(`SELECT ${columns} FROM public.${table}${where}${order}${bounded}`, filters.map((item) => item.value));
          return { data: single ? (result.rows[0] || null) : result.rows, error: null };
        } catch (error) {
          return { data: null, error };
        }
      };
      const builder = {
        select(value) { columns = value; return builder; },
        eq(column, value) {
          if (!/^[a-z_]+$/.test(column)) throw new Error('invalid column');
          filters.push({ column, value }); return builder;
        },
        order(column, options = {}) {
          if (!/^[a-z_]+$/.test(column)) throw new Error('invalid column');
          orders.push({ column, ascending: options.ascending !== false }); return builder;
        },
        range(from, to) { range = { from, to }; return builder; },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      return builder;
    },
  };
}

async function setupDatabase() {
  if (databaseUrl) {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  } else {
    const { PGlite } = require(pgliteModule);
    client = new PGlite();
    await client.waitReady;
  }
  const executeScript = (sql) => pgliteModule ? client.exec(sql) : client.query(sql);
  await client.query('BEGIN');
  await executeScript(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $$;`);
  if (pgliteModule) {
    await executeScript(`CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE FUNCTION extensions.digest(data bytea, algorithm text) RETURNS bytea LANGUAGE sql IMMUTABLE
      AS $$ SELECT CASE WHEN lower(algorithm) = 'sha256' THEN pg_catalog.sha256(data)
        ELSE decode(md5(data) || md5(data), 'hex') END $$;
      CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql VOLATILE
      AS $$ SELECT pg_catalog.gen_random_uuid() $$;`);
  }
  for (const migration of migrations) {
    await executeScript(pgliteModule ? migration.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;', '') : migration);
  }
  await executeScript(migrations[4]);
}

async function teardownDatabase() {
  if (!client) return;
  await client.query('ROLLBACK');
  const absent = await client.query("SELECT to_regclass('public.product_draft_analyses') AS relation");
  assert.equal(absent.rows[0].relation, null);
  if (typeof client.end === 'function') await client.end();
  else await client.close();
}

async function runPhase2DatabaseTest() {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const facade = databaseFacade();
  const store = new ProductPhase2Store({ client: facade });
  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'phase2-concho-durable-v1',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE2/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
  });
  await store.attachStructure({ runId: run.run_id, structure: agreementStructure });
  const read = await runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: createSyntheticConchoModel(), workerId: 'phase2-db-test',
  });
  assert.equal(read.kind, 'draftAnalysis');
  assert.equal(read.status, 'READY');
  assert.equal(read.source_document.source_document_id, sourceDocument.source_document_id);
  assert.deepEqual(new Set(read.proposals.map((item) => item.family_key)), new Set(['TERMINATION', 'TERMINATION_FEE', 'NO_SHOP']));
  assert.ok(read.spans.every((span) => span.source_closure_ids.length > 0));
  assert.equal(read.residual_passes.length, read.sections.length);
  assert.equal(read.residual_passes.every((pass) => pass.dispositions.length > 0), true);

  const handler = createProductAnalysisHandler({ getClient: () => facade });
  const response = {
    headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'GET', query: { id: run.run_id } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.draft_analysis_id, read.draft_analysis_id);

  const persisted = await client.query(`SELECT
    (SELECT count(*) FROM public.product_section_results WHERE run_id=$1) AS sections,
    (SELECT count(*) FROM public.product_residual_passes WHERE run_id=$1) AS residual_passes,
    (SELECT count(*) FROM public.product_model_calls WHERE run_id=$1) AS calls,
    (SELECT count(*) FROM public.product_proposals WHERE run_id=$1) AS proposals,
    (SELECT count(*) FROM public.product_source_spans WHERE run_id=$1) AS spans`, [run.run_id]);
  assert.equal(Number(persisted.rows[0].sections), read.sections.length);
  assert.equal(Number(persisted.rows[0].residual_passes), read.residual_passes.length);
  assert.equal(Number(persisted.rows[0].calls), read.model_calls.length);
  assert.equal(Number(persisted.rows[0].proposals), read.proposals.length);
  assert.ok(Number(persisted.rows[0].spans) > 0);

  const completedResults = await store.loadCompletedSectionResults(run.run_id);
  const finalizedDraft = assembleAgreementDraft({ sourceDocument, agreementStructure, legalSchema: schema, results: completedResults });
  const revisionBeforeRepeat = (await client.query(
    'SELECT version FROM public.product_drafts WHERE run_id=$1', [run.run_id],
  )).rows[0].version;
  assert.equal((await store.finalizeDraft({ runId: run.run_id, draft: finalizedDraft })).draft_analysis_id, read.draft_analysis_id);
  assert.equal((await client.query(
    'SELECT version FROM public.product_drafts WHERE run_id=$1', [run.run_id],
  )).rows[0].version, revisionBeforeRepeat);
  const collidingDraft = structuredClone(finalizedDraft);
  collidingDraft.issues.push({
    schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'f'.repeat(64), kind: 'COVERAGE', state: 'OPEN',
    family_key: null, structure_node_id: null, proposal_id: null, code: 'COLLISION_TEST',
  });
  await client.query('SAVEPOINT finalization_collision');
  await assert.rejects(
    () => store.finalizeDraft({ runId: run.run_id, draft: collidingDraft }),
    /PERSISTENCE_CONFLICT|AgreementDraft collision/i,
  );
  await client.query('ROLLBACK TO SAVEPOINT finalization_collision');
  await client.query('RELEASE SAVEPOINT finalization_collision');
  for (const missing of ['source_document_id', 'totals']) {
    const incompleteDraft = structuredClone(finalizedDraft);
    delete incompleteDraft[missing];
    await client.query(`SAVEPOINT missing_finalization_${missing}`);
    await assert.rejects(
      () => store.finalizeDraft({ runId: run.run_id, draft: incompleteDraft }),
      /invalid AgreementDraft finalization|DATABASE_ERROR/i,
    );
    await client.query(`ROLLBACK TO SAVEPOINT missing_finalization_${missing}`);
    await client.query(`RELEASE SAVEPOINT missing_finalization_${missing}`);
  }

  const originalStructureId = (await client.query(
    'SELECT structure_id FROM public.product_run_structures WHERE run_id=$1', [run.run_id],
  )).rows[0].structure_id;
  const versionedStructure = { ...structuredClone(agreementStructure), builder_revision: 'phase2-db-v2' };
  const versionedRun = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'phase2-versioned-structure-v2',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE2/V2',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    explicitGeneration: 8,
  });
  await store.attachStructure({ runId: versionedRun.run_id, structure: versionedStructure });
  const structureBindings = (await client.query(`SELECT rs.run_id, rs.structure_id
    FROM public.product_run_structures rs WHERE rs.run_id IN ($1,$2) ORDER BY rs.run_id`, [run.run_id, versionedRun.run_id])).rows;
  assert.equal(new Set(structureBindings.map((row) => row.structure_id)).size, 2);
  assert.equal(structureBindings.find((row) => row.run_id === run.run_id).structure_id, originalStructureId);
  assert.equal(Number((await client.query(
    'SELECT count(*) FROM public.product_agreement_structures WHERE source_document_id=$1', [sourceDocument.source_document_id],
  )).rows[0].count), 2);

  const retryRun = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'phase2-concho-atomicity-v1',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE2/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    explicitGeneration: 1,
  });
  await store.attachStructure({ runId: retryRun.run_id, structure: agreementStructure });
  const substantiveIds = new Set(substantiveSections(agreementStructure).map((node) => node.node_id));
  let claim;
  do {
    claim = await store.claimNextSection({ runId: retryRun.run_id, workerId: 'atomicity-test' });
    assert.ok(claim);
    if (!substantiveIds.has(claim.node_id)) {
      await store.completeSection({ runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test', attemptToken: claim.attempt_token });
    }
  } while (!substantiveIds.has(claim.node_id));
  const persistedResult = (await store.loadCompletedSectionResults(run.run_id)).find((item) => item.node_id === claim.node_id);
  assert.ok(persistedResult);
  await client.query('SAVEPOINT stale_attempt');
  await assert.rejects(
    () => store.commitSection({ runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test', attemptToken: crypto.randomUUID(), result: persistedResult }),
    /STALE_SECTION_ATTEMPT|stale section attempt/i,
  );
  await client.query('ROLLBACK TO SAVEPOINT stale_attempt');
  await client.query('RELEASE SAVEPOINT stale_attempt');
  const invalidResult = structuredClone(persistedResult);
  invalidResult.spans[0].exact_text = `${invalidResult.spans[0].exact_text}x`;
  await client.query('SAVEPOINT atomic_commit');
  await assert.rejects(
    () => store.commitSection({ runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test', attemptToken: claim.attempt_token, result: invalidResult }),
    /source span bytes do not match/i,
  );
  await client.query('ROLLBACK TO SAVEPOINT atomic_commit');
  await client.query('RELEASE SAVEPOINT atomic_commit');
  const partialRows = await client.query('SELECT count(*) FROM public.product_model_calls WHERE run_id=$1', [retryRun.run_id]);
  assert.equal(Number(partialRows.rows[0].count), 0);
  const missingResidual = structuredClone(persistedResult);
  delete missingResidual.residual_pass;
  await client.query('SAVEPOINT missing_residual');
  await assert.rejects(
    () => store.commitSection({
      runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test',
      attemptToken: claim.attempt_token, result: missingResidual,
    }),
    /invalid section draft input/i,
  );
  await client.query('ROLLBACK TO SAVEPOINT missing_residual');
  await client.query('RELEASE SAVEPOINT missing_residual');
  const storedResidual = (await client.query(
    'SELECT * FROM public.product_residual_passes WHERE run_id=$1 LIMIT 1', [run.run_id],
  )).rows[0];
  await client.query('SAVEPOINT residual_collision');
  await assert.rejects(() => client.query(`INSERT INTO public.product_residual_passes(
    run_id,residual_pass_id,structure_node_id,model_call_id,payload
  ) VALUES ($1,$2,$3,$4,$5)`, [
    storedResidual.run_id, storedResidual.residual_pass_id, storedResidual.structure_node_id,
    storedResidual.model_call_id, { ...storedResidual.payload, collision: true },
  ]), /duplicate key|unique constraint/i);
  await client.query('ROLLBACK TO SAVEPOINT residual_collision');
  await client.query('RELEASE SAVEPOINT residual_collision');
  const renewed = await store.renewSectionLease({
    runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test',
    attemptToken: claim.attempt_token, leaseSeconds: 300,
  });
  assert.equal(renewed.node_id, claim.node_id);
  await client.query('SAVEPOINT wrong_lease_owner');
  await assert.rejects(() => store.renewSectionLease({
    runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'other-worker',
    attemptToken: claim.attempt_token, leaseSeconds: 300,
  }), /STALE_SECTION_ATTEMPT|stale section attempt/i);
  await client.query('ROLLBACK TO SAVEPOINT wrong_lease_owner');
  await client.query('RELEASE SAVEPOINT wrong_lease_owner');
  await client.query(`UPDATE public.product_section_work SET lease_expires_at=now()-interval '1 second'
    WHERE run_id=$1 AND node_id=$2`, [retryRun.run_id, claim.node_id]);
  await client.query('SAVEPOINT expired_lease');
  await assert.rejects(() => store.renewSectionLease({
    runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test',
    attemptToken: claim.attempt_token, leaseSeconds: 300,
  }), /STALE_SECTION_ATTEMPT|stale section attempt/i);
  await client.query('ROLLBACK TO SAVEPOINT expired_lease');
  await client.query('RELEASE SAVEPOINT expired_lease');
  await client.query('SAVEPOINT late_completion');
  await assert.rejects(() => store.commitSection({
    runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test',
    attemptToken: claim.attempt_token, result: persistedResult,
  }), /STALE_SECTION_ATTEMPT|stale section attempt/i);
  await client.query('ROLLBACK TO SAVEPOINT late_completion');
  await client.query('RELEASE SAVEPOINT late_completion');
  const recovered = await store.recoverExpiredSections({ runId: retryRun.run_id });
  assert.equal(recovered.recovered_sections, 1);
  assert.deepEqual((await client.query('SELECT status,worker_id,attempt_token,lease_expires_at,error FROM public.product_section_work WHERE run_id=$1 AND node_id=$2', [retryRun.run_id, claim.node_id])).rows[0], {
    status: 'FAILED', worker_id: null, attempt_token: null, lease_expires_at: null, error: { code: 'SECTION_LEASE_EXPIRED' },
  });
  const reassigned = await store.claimNextSection({ runId: retryRun.run_id, workerId: 'replacement-worker', leaseSeconds: 300 });
  assert.equal(reassigned.node_id, claim.node_id);
  await client.query('SAVEPOINT reassigned_lease');
  await assert.rejects(() => store.renewSectionLease({
    runId: retryRun.run_id, nodeId: claim.node_id, workerId: 'atomicity-test',
    attemptToken: claim.attempt_token, leaseSeconds: 300,
  }), /STALE_SECTION_ATTEMPT|stale section attempt/i);
  await client.query('ROLLBACK TO SAVEPOINT reassigned_lease');
  await client.query('RELEASE SAVEPOINT reassigned_lease');
  await client.query(`UPDATE public.product_section_work SET lease_expires_at=now()-interval '1 second', attempts=max_attempts
    WHERE run_id=$1 AND node_id=$2`, [retryRun.run_id, claim.node_id]);
  assert.equal((await store.recoverExpiredSections({ runId: retryRun.run_id })).recovered_sections, 1);
  assert.equal((await store.recoverExpiredSections({ runId: retryRun.run_id })).recovered_sections, 0);
  assert.equal(Number((await client.query("SELECT count(*) FROM public.product_section_work WHERE run_id=$1 AND status='COMPLETE'", [run.run_id])).rows[0].count), read.sections.length);

  await client.query('SET LOCAL ROLE service_role');
  const serviceRead = await client.query('SELECT public.product_phase2_get_analysis($1) AS analysis', [run.run_id]);
  assert.equal(serviceRead.rows[0].analysis.kind, 'draftAnalysis');
  await client.query('RESET ROLE');
  await client.query('SAVEPOINT denied_client_role');
  await client.query('SET LOCAL ROLE anon');
  await assert.rejects(() => client.query('SELECT public.product_phase2_get_analysis($1)', [run.run_id]), /permission denied/i);
  await client.query('ROLLBACK TO SAVEPOINT denied_client_role');
  await client.query('RELEASE SAVEPOINT denied_client_role');

  const privileges = (await client.query(`SELECT
    has_table_privilege('service_role', 'public.product_proposals', 'INSERT') AS direct_insert,
    has_function_privilege('anon', 'public.product_phase2_get_analysis(uuid)', 'EXECUTE') AS anon_read,
    has_function_privilege('authenticated', 'public.product_phase2_finalize_draft(uuid,jsonb)', 'EXECUTE') AS authenticated_finalize,
    has_function_privilege('authenticated', 'public.product_phase2_finalize_saved_run(uuid,jsonb)', 'EXECUTE') AS authenticated_saved_finalize,
    has_function_privilege('anon', 'product_private.product_phase2_get_analysis(uuid)', 'EXECUTE') AS anon_private_read,
    has_function_privilege('authenticated', 'product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)', 'EXECUTE') AS authenticated_private_commit`)).rows[0];
  assert.equal(privileges.direct_insert, false);
  assert.equal(privileges.anon_read, false);
  assert.equal(privileges.authenticated_finalize, false);
  assert.equal(privileges.authenticated_saved_finalize, false);
  assert.equal(privileges.anon_private_read, false);
  assert.equal(privileges.authenticated_private_commit, false);
  assert.equal(contentId('AGREEMENT_STRUCTURE/V1', agreementStructure), contentId('AGREEMENT_STRUCTURE/V1', read.agreement_structure));
}

async function runScopedWorkSetTest() {
  const facade = databaseFacade();
  const store = new ProductPhase2Store({ client: facade });
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE I',
    'MAIN COVENANTS',
    'Section 1.01 Main Covenant.',
    'The parties shall perform.',
    '[Signature Page Follows]',
    'EXHIBIT A',
    'FORM OF OPERATIVE AGREEMENT',
    'ARTICLE I',
    'EXHIBIT COVENANTS',
    'Section 1.01 Exhibit Covenant.',
    'The parties shall perform under the exhibit.',
  ].join('\n');
  const sourceId = crypto.createHash('sha256').update(canonicalText).digest('hex');
  const raw = Buffer.from(canonicalText, 'utf8');
  const source = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sourceId, agreement_id: sourceId,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000002/scoped.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000002/scoped.htm',
    raw_sha256: sourceId, raw_bytes_base64: raw.toString('base64'), raw_byte_length: raw.length,
    canonical_text: canonicalText, canonical_text_sha256: sourceId, canonical_text_byte_length: raw.length,
    filing_accession: '2', exhibit_filename: 'scoped.htm', source_map_id: sourceId,
  };
  const structure = buildAgreementStructure(source);
  const substantiveIds = substantiveSections(structure).map((node) => node.node_id);
  assert.deepEqual(substantiveSections(structure).map((node) => node.reference), ['1.01', 'Exhibit-A::1.01']);
  await store.persistSourceDocument(source);
  const create = (key) => store.createOrGetRun({
    sourceDocumentId: sourceId, retrievalUrl: source.retrieval_url, idempotencyKey: key,
    schemaVersion: 'LEGAL_SCHEMA/V1', promptBundleVersion: 'PRODUCT_PROMPT_BUNDLE/V1',
    modelConfig: { provider_id: 'TEST' }, explicitGeneration: key.endsWith('review') ? 2 : 1,
  });
  const direct = await create('scoped-work-direct');
  await store.attachStructure({ runId: direct.run_id, structure });
  assert.deepEqual((await client.query(
    'SELECT node_id FROM public.product_section_work WHERE run_id=$1 ORDER BY authored_order', [direct.run_id],
  )).rows.map((row) => row.node_id), substantiveIds);
  const finalised = await runAgreementDraftAnalysis({
    runId: direct.run_id, store, legalSchema: schema, model: createSyntheticConchoModel(), workerId: 'scoped-db-test',
  });
  assert.equal(finalised.status, 'READY');
  assert.equal(finalised.sections.length, substantiveIds.length);
  assert.equal(finalised.residual_passes.length, substantiveIds.length);

  const reviewed = await create('scoped-work-review');
  await store.attachStructure({ runId: reviewed.run_id, structure, identityReview: { reasons: ['PARTIES_UNCONFIRMED'] } });
  assert.equal(Number((await client.query(
    'SELECT count(*) FROM public.product_section_work WHERE run_id=$1', [reviewed.run_id],
  )).rows[0].count), 0);
  await store.resolveIdentityReview({ runId: reviewed.run_id, resolution: { confirmed: true } });
  assert.deepEqual((await client.query(
    'SELECT node_id FROM public.product_section_work WHERE run_id=$1 ORDER BY authored_order', [reviewed.run_id],
  )).rows.map((row) => row.node_id), substantiveIds);
}

if (process.env.PRODUCT_PHASE2_DB_HELPER_ONLY !== '1') {
  test.before(setupDatabase);
  test.after(teardownDatabase);
  test('real Concho source persists atomically through runner, RPCs and Review read interface', runPhase2DatabaseTest);
  test('database enqueues only substantive scoped leaf sections before and after identity review', runScopedWorkSetTest);
}

module.exports = {
  databaseFacade,
  getDatabaseClient: () => client,
  runPhase2DatabaseTest,
  runScopedWorkSetTest,
  setupDatabase,
  teardownDatabase,
};
