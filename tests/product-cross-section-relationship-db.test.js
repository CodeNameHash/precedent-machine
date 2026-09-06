'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

const ROOT = path.resolve(__dirname, '..');
const prerequisiteMigrations = [
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905203000_product_finalization_retry.sql',
  'supabase/migrations/20260905205000_product_release_timing_guard.sql',
  'supabase/migrations/20260905212000_product_review_citation_repair.sql',
  'supabase/migrations/20260905213000_product_monotonic_failed_section_status.sql',
  'supabase/migrations/20260905214000_product_cumulative_review_timing.sql',
  'supabase/migrations/20260905215000_product_finding_resolution_validation.sql',
  'supabase/migrations/20260905220000_product_review_proposition_group_repair.sql',
  'supabase/migrations/20260905221000_product_analysis_running_progress.sql',
  'supabase/migrations/20260905222000_product_relationship_review.sql',
  'supabase/migrations/20260905223000_product_span_closure_lookup.sql',
];
const migration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905224000_product_cross_section_relationship_staging.sql',
), 'utf8');
const schemaRevisionMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905225000_product_legal_schema_v1_1_relationship_types.sql',
), 'utf8');
const noticeUpdateMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905230000_product_notice_update_relationship_types.sql',
), 'utf8');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function execute(sql) {
  const client = database.getDatabaseClient();
  if (process.env.TEST_PGLITE_MODULE) await client.exec(sql);
  else await client.query(sql);
}

async function fixture({
  missingSourceText = false,
  originFamily = 'TERMINATION_FEE',
  originSubtype = 'FEE_TRIGGER',
  relationshipType = 'REQUIRES',
} = {}) {
  const client = database.getDatabaseClient();
  const runId = crypto.randomUUID();
  const canonicalText = 'fee requires termination right';
  const sourceId = sha(`source-${runId}`);
  const originClosureId = sha(`origin-closure-${runId}`);
  const targetClosureId = sha(`target-closure-${runId}`);
  const relationshipSpanId = sha(`relationship-span-${runId}`);
  const targetEvidenceSpanId = sha(`target-evidence-${runId}`);
  const targetLocatorSpanId = sha(`target-locator-${runId}`);
  const originComponentSpanId = sha(`origin-component-${runId}`);
  const targetComponentSpanId = sha(`target-component-${runId}`);
  const originProposalId = sha(`origin-proposal-${runId}`);
  const targetProposalId = sha(`target-proposal-${runId}`);
  const callId = sha(`call-${runId}`);
  const originGroupId = sha(`origin-group-${runId}`);
  const targetGroupId = sha(`target-group-${runId}`);
  const spans = [{
    schema_version: 'PRODUCT_SOURCE_SPAN/V1', span_id: relationshipSpanId,
    source_document_id: sourceId, structure_node_id: 'section-7.3', kind: 'SUPPORTING_EVIDENCE',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: 0, end_byte: 12,
    text_sha256: sha('fee requires'), exact_text: 'fee requires',
  }, {
    schema_version: 'PRODUCT_SOURCE_SPAN/V1', span_id: targetEvidenceSpanId,
    source_document_id: sourceId, structure_node_id: 'section-7.1', kind: 'SUPPORTING_EVIDENCE',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: 13, end_byte: 30,
    text_sha256: sha('termination right'), exact_text: 'termination right',
  }, {
    schema_version: 'PRODUCT_SOURCE_SPAN/V1', span_id: targetLocatorSpanId,
    source_document_id: sourceId, structure_node_id: 'section-7.1', kind: 'SUPPORTING_EVIDENCE',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: 13, end_byte: 24,
    text_sha256: sha('termination'), exact_text: 'termination',
  }, {
    schema_version: 'PRODUCT_SOURCE_SPAN/V1', span_id: originComponentSpanId,
    source_document_id: sourceId, structure_node_id: 'section-7.3', kind: 'FULL_SECTION',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: 0, end_byte: 12,
    text_sha256: sha('fee requires'), exact_text: 'fee requires',
  }, {
    schema_version: 'PRODUCT_SOURCE_SPAN/V1', span_id: targetComponentSpanId,
    source_document_id: sourceId, structure_node_id: 'section-7.1', kind: 'CROSS_REFERENCE',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: 13, end_byte: 30,
    text_sha256: sha('termination right'), exact_text: 'termination right',
  }];

  await client.query(`INSERT INTO public.product_source_documents
    (source_document_id,retrieval_url,raw_sha256,payload,payload_sha256)
    VALUES ($1,$2,$1,$3::jsonb,$1)`, [
    sourceId, `https://example.test/${runId}`,
    JSON.stringify(missingSourceText ? {} : { canonical_text: canonicalText }),
  ]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
      schema_version,prompt_bundle_version,model_config,explicit_generation,source_generation,
      max_attempts,status,stage)
    VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PROMPT/V1','{}'::jsonb,0,1,3,'RUNNING','EXTRACTION')`, [
    runId, sourceId, `https://example.test/${runId}`, `cross-link-${runId}`, `fingerprint-${runId}`,
  ]);
  await client.query(`INSERT INTO public.product_section_work
    (run_id,node_id,authored_order,status,max_attempts) VALUES
    ($1,'section-7.1',0,'COMPLETE',3),($1,'section-7.3',1,'COMPLETE',3)`, [runId]);
  await client.query(`INSERT INTO public.product_source_closures
    (run_id,source_closure_id,structure_node_id,section_reference,payload) VALUES
    ($1,$2,'section-7.3','7.3','{}'::jsonb),($1,$3,'section-7.1','7.1','{}'::jsonb)`, [
    runId, originClosureId, targetClosureId,
  ]);
  for (const stored of [spans[0], spans[1], spans[3], spans[4]]) {
    await client.query(`INSERT INTO public.product_source_spans
      (run_id,span_id,source_document_id,structure_node_id,kind,coordinate_system,
        start_byte,end_byte,text_sha256,exact_text)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
      runId, stored.span_id, stored.source_document_id, stored.structure_node_id, stored.kind,
      stored.coordinate_system, stored.start_byte, stored.end_byte, stored.text_sha256, stored.exact_text,
    ]);
  }
  await client.query(`INSERT INTO public.product_source_closure_spans
    (run_id,source_closure_id,span_id) VALUES
      ($1,$2,$3),($1,$4,$5),($1,$2,$6),($1,$2,$7)`, [
    runId, originClosureId, relationshipSpanId, targetClosureId, targetEvidenceSpanId,
    originComponentSpanId, targetComponentSpanId,
  ]);
  await client.query(`INSERT INTO public.product_model_calls
    (run_id,model_call_id,structure_node_id,call_kind,prompt_version,provider_id,model_id,
      request,response,input_tokens,output_tokens,cost_microusd,duration_ms)
    VALUES ($1,$2,'section-7.3','EXTRACTION','PROMPT/V1','test','test','{}'::jsonb,
      '{}'::jsonb,0,0,0,0)`, [runId, callId]);
  await client.query(`INSERT INTO public.product_proposition_groups
    (run_id,proposition_group_id,structure_node_id,source_closure_id,family_key,subtype_key,payload)
    VALUES ($1,$2,'section-7.3',$3,$4,$5,'{}'::jsonb),
      ($1,$6,'section-7.1',$7,'TERMINATION','SUPERIOR_PROPOSAL','{}'::jsonb)`, [
    runId, originGroupId, originClosureId, originFamily, originSubtype,
    targetGroupId, targetClosureId,
  ]);
  await client.query(`INSERT INTO public.product_proposals
    (run_id,proposal_id,fact_occurrence_id,structure_node_id,model_call_id,source_closure_id,
      proposition_group_id,family_key,subtype_key,fact_type,state,validation_status,payload)
    VALUES ($1,$2,$3,'section-7.3',$4,$5,$6,$7,$8,'TEST_FACT','PROPOSED','VALID','{}'::jsonb),
      ($1,$9,$10,'section-7.1',$4,$11,$12,'TERMINATION','SUPERIOR_PROPOSAL','TERMINATION_RIGHT','PROPOSED','VALID','{}'::jsonb)`, [
    runId, originProposalId, sha(`origin-occurrence-${runId}`), callId, originClosureId,
    originGroupId, originFamily, originSubtype, targetProposalId,
    sha(`target-occurrence-${runId}`), targetClosureId, targetGroupId,
  ]);
  await client.query(`INSERT INTO public.product_proposal_spans
    (run_id,proposal_id,span_id,ordinal) VALUES ($1,$2,$3,0),($1,$4,$5,0)`, [
    runId, originProposalId, relationshipSpanId, targetProposalId, targetEvidenceSpanId,
  ]);
  const link = {
    schema_version: 'PRODUCT_FACT_LINK/V2', fact_link_id: sha(`link-${runId}`),
    from_proposal_id: originProposalId, to_proposal_id: targetProposalId,
    relationship_type: relationshipType, source_closure_id: originClosureId,
    source_span_ids: [relationshipSpanId], target_source_span_ids: [targetLocatorSpanId],
  };
  const staging = {
    schema_version: 'PRODUCT_CROSS_SECTION_RELATIONSHIP_STAGING/V1',
    source_document_id: sourceId, spans,
    source_closure_spans: [
      { source_closure_id: originClosureId, span_id: relationshipSpanId },
      { source_closure_id: targetClosureId, span_id: targetEvidenceSpanId },
      { source_closure_id: originClosureId, span_id: targetLocatorSpanId },
      { source_closure_id: originClosureId, span_id: originComponentSpanId },
      { source_closure_id: originClosureId, span_id: targetComponentSpanId },
    ],
    links: [link],
  };
  return { client, runId, sourceId, link, staging, relationshipSpanId };
}

test.before(async () => {
  await database.setupDatabase();
  for (const file of prerequisiteMigrations) await execute(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  await database.getDatabaseClient().query('SAVEPOINT before_cross_section_relationship_migration');
  await execute(migration);
  await execute(schemaRevisionMigration);
  await execute(noticeUpdateMigration);
});

test.after(async () => {
  const client = database.getDatabaseClient();
  await client.query('ROLLBACK TO SAVEPOINT before_cross_section_relationship_migration');
  const absent = await client.query("SELECT to_regprocedure('public.product_phase2_stage_cross_section_relationships(uuid,jsonb)') AS procedure");
  assert.equal(absent.rows[0].procedure, null);
  const restored = await client.query(`SELECT
    product_private.product_phase3_relationship_types(
      'CLOSING_CONDITIONS','GENERAL_CLOSING_CONDITION'
    ) AS added,
    product_private.product_phase3_relationship_types(
      'TERMINATION_FEE','FEE_TRIGGER'
    ) AS legacy`);
  assert.equal(restored.rows[0].added, null);
  assert.ok(restored.rows[0].legacy.includes('REQUIRES'));
  await client.query('RELEASE SAVEPOINT before_cross_section_relationship_migration');
  await database.teardownDatabase();
});

test('database stages only source-proved cross-section links and keeps access service-only', async () => {
  const value = await fixture();
  await value.client.query(
    'SELECT public.product_phase2_stage_cross_section_relationships($1,$2)',
    [value.runId, value.staging],
  );
  const stored = await value.client.query(`SELECT payload FROM public.product_fact_links
    WHERE run_id=$1 AND fact_link_id=$2`, [value.runId, value.link.fact_link_id]);
  assert.deepEqual(stored.rows[0].payload, value.link);

  const access = (await value.client.query(`SELECT
    has_function_privilege('service_role','public.product_phase2_stage_cross_section_relationships(uuid,jsonb)','EXECUTE') service,
    has_function_privilege('anon','public.product_phase2_stage_cross_section_relationships(uuid,jsonb)','EXECUTE') anon,
    has_function_privilege('authenticated','public.product_phase2_stage_cross_section_relationships(uuid,jsonb)','EXECUTE') authenticated`)).rows[0];
  assert.deepEqual(access, { service: true, anon: false, authenticated: false });

  await value.client.query('SAVEPOINT forged_target');
  const forged = structuredClone(value.staging);
  forged.links[0].fact_link_id = sha(`forged-${value.runId}`);
  forged.links[0].target_source_span_ids = [value.relationshipSpanId];
  await assert.rejects(() => value.client.query(
    'SELECT public.product_phase2_stage_cross_section_relationships($1,$2)',
    [value.runId, forged],
  ), /target mismatch/i);
  await value.client.query('ROLLBACK TO SAVEPOINT forged_target');
  await value.client.query('RELEASE SAVEPOINT forged_target');

  const missingSource = await fixture({ missingSourceText: true });
  await value.client.query('SAVEPOINT missing_source');
  await assert.rejects(() => missingSource.client.query(
    'SELECT public.product_phase2_stage_cross_section_relationships($1,$2)',
    [missingSource.runId, missingSource.staging],
  ), /source text is unavailable/i);
  await value.client.query('ROLLBACK TO SAVEPOINT missing_source');
  await value.client.query('RELEASE SAVEPOINT missing_source');
});

test('database enforces V1.1 condition, remedy and update relationship types in real staging', async () => {
  for (const [originFamily, originSubtype] of [
    ['CLOSING_CONDITIONS', 'GENERAL_CLOSING_CONDITION'],
    ['SPECIFIC_PERFORMANCE_REMEDIES', 'PAID_FEE_EXCLUSIVE_REMEDY'],
    ['NO_SHOP', 'NOTICE_UPDATE_OBLIGATION'],
  ]) {
    const value = await fixture({ originFamily, originSubtype });
    await value.client.query(
      'SELECT public.product_phase2_stage_cross_section_relationships($1,$2)',
      [value.runId, value.staging],
    );
    const count = await value.client.query(`SELECT count(*)::integer AS count
      FROM public.product_fact_links WHERE run_id=$1`, [value.runId]);
    assert.equal(count.rows[0].count, 1);
  }

  const invalid = await fixture({
    originFamily: 'SPECIFIC_PERFORMANCE_REMEDIES',
    originSubtype: 'PAID_FEE_EXCLUSIVE_REMEDY',
    relationshipType: 'CONTAINS',
  });
  await invalid.client.query('SAVEPOINT unsupported_v1_1_relationship');
  await assert.rejects(() => invalid.client.query(
    'SELECT public.product_phase2_stage_cross_section_relationships($1,$2)',
    [invalid.runId, invalid.staging],
  ), /invalid cross-section relationship link/i);
  await invalid.client.query('ROLLBACK TO SAVEPOINT unsupported_v1_1_relationship');
  await invalid.client.query('RELEASE SAVEPOINT unsupported_v1_1_relationship');
});
