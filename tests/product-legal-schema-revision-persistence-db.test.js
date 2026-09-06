'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { ProductPhase2Store } = require('../lib/product/phase-2-store');

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
  'supabase/migrations/20260905224000_product_cross_section_relationship_staging.sql',
  'supabase/migrations/20260905225000_product_legal_schema_v1_1_relationship_types.sql',
];
const migrationPath = path.join(
  ROOT, 'supabase/migrations/20260905227000_product_legal_schema_revision_persistence.sql',
);
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function execute(sql) {
  const client = database.getDatabaseClient();
  if (typeof client.exec === 'function') await client.exec(sql);
  else await client.query(sql);
}

function facade() {
  const base = database.databaseFacade();
  return {
    ...base,
    async rpc(name, parameters) {
      if (name !== 'product_phase2_stage_cross_section_relationships') {
        return base.rpc(name, parameters);
      }
      try {
        await database.getDatabaseClient().query(
          'SELECT public.product_phase2_stage_cross_section_relationships($1,$2)',
          [parameters.p_run_id, parameters.p_staging],
        );
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}

function span({ runId, sourceId, nodeId, kind, start, end, text }) {
  return {
    schema_version: 'PRODUCT_SOURCE_SPAN/V1', span_id: sha(`${runId}:${nodeId}:${kind}:${start}:${end}`),
    source_document_id: sourceId, structure_node_id: nodeId, kind,
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: start, end_byte: end,
    text_sha256: sha(text), exact_text: text,
  };
}

async function createSavedRunFixture({ legalSchemaRevision, crossSection = false }) {
  const client = database.getDatabaseClient();
  const store = new ProductPhase2Store({ client: facade() });
  const runId = crypto.randomUUID();
  const sourceText = 'fee requires termination right';
  const sourceId = sha(`source:${runId}`);
  const structureId = sha(`structure:${runId}`);
  const draftAnalysisId = sha(`draft:${runId}`);
  const nodes = ['section-7.3', 'section-7.1'];
  const closureIds = Object.fromEntries(nodes.map((node) => [node, sha(`closure:${runId}:${node}`)]));
  const callIds = Object.fromEntries(nodes.map((node) => [node, sha(`call:${runId}:${node}`)]));
  const routingIds = Object.fromEntries(nodes.map((node) => [node, sha(`routing:${runId}:${node}`)]));
  const residualIds = Object.fromEntries(nodes.map((node) => [node, sha(`residual:${runId}:${node}`)]));
  const resultIds = Object.fromEntries(nodes.map((node) => [node, sha(`result:${runId}:${node}`)]));
  const groupIds = Object.fromEntries(nodes.map((node) => [node, sha(`group:${runId}:${node}`)]));
  const proposalIds = Object.fromEntries(nodes.map((node) => [node, sha(`proposal:${runId}:${node}`)]));
  const relationshipEvidence = span({ runId, sourceId, nodeId: nodes[0], kind: 'SUPPORTING_EVIDENCE', start: 0, end: 12, text: 'fee requires' });
  const originComponent = span({ runId, sourceId, nodeId: nodes[0], kind: 'FULL_SECTION', start: 0, end: 12, text: 'fee requires' });
  const targetEvidence = span({ runId, sourceId, nodeId: nodes[1], kind: 'SUPPORTING_EVIDENCE', start: 13, end: 30, text: 'termination right' });
  const targetComponent = span({ runId, sourceId, nodeId: nodes[1], kind: 'CROSS_REFERENCE', start: 13, end: 30, text: 'termination right' });
  const targetLocator = span({ runId, sourceId, nodeId: nodes[1], kind: 'SUPPORTING_EVIDENCE', start: 13, end: 24, text: 'termination' });
  const baseSpans = [relationshipEvidence, originComponent, targetEvidence, targetComponent];
  const allSpans = crossSection ? [...baseSpans, targetLocator] : baseSpans;
  const closureSpans = {
    [nodes[0]]: [relationshipEvidence, originComponent, ...(crossSection ? [targetComponent, targetLocator] : [])],
    [nodes[1]]: [targetEvidence, targetComponent],
  };
  const proposals = nodes.map((node, index) => ({
    schema_version: 'PRODUCT_PROPOSAL/V1', proposal_id: proposalIds[node],
    fact_occurrence_id: sha(`occurrence:${runId}:${node}`), structure_node_id: node,
    model_call_id: callIds[node], source_closure_id: closureIds[node],
    proposition_group_id: groupIds[node], family_key: index === 0 ? 'TERMINATION_FEE' : 'TERMINATION',
    subtype_key: index === 0 ? 'FEE_TRIGGER' : 'SUPERIOR_PROPOSAL',
    fact_type: index === 0 ? 'FEE_TRIGGER_EVENT' : 'TERMINATION_RIGHT',
    state: 'PROPOSED', validation_status: 'VALID',
    source_span_ids: [index === 0 ? relationshipEvidence.span_id : targetEvidence.span_id],
  }));
  const groups = nodes.map((node, index) => ({
    schema_version: 'PRODUCT_PROPOSITION_GROUP/V1', proposition_group_id: groupIds[node],
    structure_node_id: node, source_closure_id: closureIds[node],
    family_key: index === 0 ? 'TERMINATION_FEE' : 'TERMINATION',
    subtype_key: index === 0 ? 'FEE_TRIGGER' : 'SUPERIOR_PROPOSAL',
  }));
  const routings = nodes.map((node, index) => ({
    schema_version: 'PRODUCT_SECTION_ROUTING/V1', section_routing_id: routingIds[node],
    structure_node_id: node, model_call_id: callIds[node], section_reference: index === 0 ? '7.3' : '7.1',
    disposition: 'FAMILY_ASSIGNED', families: [index === 0 ? 'TERMINATION_FEE' : 'TERMINATION'],
  }));
  const residuals = nodes.map((node) => ({
    schema_version: 'PRODUCT_PARAGRAPH_RESIDUAL_PASS/V1', residual_pass_id: residualIds[node],
    structure_node_id: node, model_call_id: callIds[node], dispositions: [],
  }));
  const link = crossSection ? {
    schema_version: 'PRODUCT_FACT_LINK/V2', fact_link_id: sha(`link:${runId}`),
    from_proposal_id: proposalIds[nodes[0]], to_proposal_id: proposalIds[nodes[1]],
    relationship_type: 'REQUIRES', source_closure_id: closureIds[nodes[0]],
    source_span_ids: [relationshipEvidence.span_id], target_source_span_ids: [targetLocator.span_id],
  } : null;

  await client.query(`INSERT INTO public.product_source_documents
    (source_document_id,retrieval_url,raw_sha256,payload,payload_sha256)
    VALUES ($1,$2,$1,$3::jsonb,$1)`, [sourceId, `https://example.test/${runId}`, JSON.stringify({ canonical_text: sourceText })]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,schema_version,
      prompt_bundle_version,model_config,explicit_generation,source_generation,max_attempts,status,stage)
    VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PROMPT/V5','{}'::jsonb,0,1,3,'RUNNING','DRAFT_FINALIZATION')`,
  [runId, sourceId, `https://example.test/${runId}`, `revision-${runId}`, `fingerprint-${runId}`]);
  await client.query(`INSERT INTO public.product_agreement_structures(structure_id,source_document_id,payload,payload_sha256)
    VALUES ($1,$2,$3::jsonb,$1)`, [structureId, sourceId, JSON.stringify({
    schema_version: 'AGREEMENT_STRUCTURE/V1', structure_id: structureId,
    nodes: nodes.map((node, index) => ({ node_id: node, kind: 'SECTION', reference: index === 0 ? '7.3' : '7.1' })),
  })]);
  await client.query('INSERT INTO public.product_run_structures(run_id,structure_id) VALUES ($1,$2)', [runId, structureId]);
  await client.query("INSERT INTO public.product_drafts(run_id,version,state) VALUES ($1,0,'{}'::jsonb)", [runId]);
  for (const [index, node] of nodes.entries()) {
    await client.query(`INSERT INTO public.product_section_work(run_id,node_id,authored_order,status,max_attempts)
      VALUES ($1,$2,$3,'COMPLETE',3)`, [runId, node, index]);
    await client.query(`INSERT INTO public.product_model_calls(run_id,model_call_id,structure_node_id,call_kind,
      prompt_version,provider_id,model_id,request,response,input_tokens,output_tokens,cost_microusd,duration_ms)
      VALUES ($1,$2,$3,'EXTRACTION','PROMPT/V5','test','test','{}'::jsonb,'{}'::jsonb,0,0,0,0)`, [runId, callIds[node], node]);
    await client.query(`INSERT INTO public.product_source_closures(run_id,source_closure_id,structure_node_id,section_reference,payload)
      VALUES ($1,$2,$3,$4,$5::jsonb)`, [runId, closureIds[node], node, index === 0 ? '7.3' : '7.1', JSON.stringify({
      schema_version: 'PRODUCT_SOURCE_CLOSURE/V1', source_closure_id: closureIds[node],
      structure_node_id: node, section_reference: index === 0 ? '7.3' : '7.1',
    })]);
  }
  for (const item of baseSpans) {
    await client.query(`INSERT INTO public.product_source_spans(run_id,span_id,source_document_id,structure_node_id,kind,
      coordinate_system,start_byte,end_byte,text_sha256,exact_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [runId, item.span_id, sourceId, item.structure_node_id, item.kind, item.coordinate_system,
      item.start_byte, item.end_byte, item.text_sha256, item.exact_text]);
  }
  const initialClosureSpans = [
    [closureIds[nodes[0]], relationshipEvidence.span_id], [closureIds[nodes[0]], originComponent.span_id],
    [closureIds[nodes[1]], targetEvidence.span_id], [closureIds[nodes[1]], targetComponent.span_id],
    ...(crossSection ? [[closureIds[nodes[0]], targetComponent.span_id]] : []),
  ];
  for (const [closureId, spanId] of initialClosureSpans) {
    await client.query('INSERT INTO public.product_source_closure_spans(run_id,source_closure_id,span_id) VALUES ($1,$2,$3)', [runId, closureId, spanId]);
  }
  for (const [index, node] of nodes.entries()) {
    const routing = routings[index];
    const group = groups[index];
    const proposal = proposals[index];
    await client.query(`INSERT INTO public.product_section_routings(run_id,section_routing_id,structure_node_id,model_call_id,
      authored_order,disposition,families,payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
    [runId, routing.section_routing_id, node, callIds[node], index, routing.disposition,
      JSON.stringify(routing.families), JSON.stringify(routing)]);
    await client.query(`INSERT INTO public.product_proposition_groups(run_id,proposition_group_id,structure_node_id,
      source_closure_id,family_key,subtype_key,payload) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [runId, group.proposition_group_id, node, closureIds[node], group.family_key, group.subtype_key, JSON.stringify(group)]);
    await client.query(`INSERT INTO public.product_proposals(run_id,proposal_id,fact_occurrence_id,structure_node_id,
      model_call_id,source_closure_id,proposition_group_id,family_key,subtype_key,fact_type,state,validation_status,payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROPOSED','VALID',$11::jsonb)`,
    [runId, proposal.proposal_id, proposal.fact_occurrence_id, node, callIds[node], closureIds[node],
      groupIds[node], proposal.family_key, proposal.subtype_key, proposal.fact_type, JSON.stringify(proposal)]);
    await client.query('INSERT INTO public.product_proposal_spans(run_id,proposal_id,span_id,ordinal) VALUES ($1,$2,$3,0)',
      [runId, proposal.proposal_id, proposal.source_span_ids[0]]);
    await client.query(`INSERT INTO public.product_residual_passes(run_id,residual_pass_id,structure_node_id,model_call_id,payload)
      VALUES ($1,$2,$3,$4,$5::jsonb)`, [runId, residuals[index].residual_pass_id, node, callIds[node], JSON.stringify(residuals[index])]);
    await client.query(`INSERT INTO public.product_section_results(run_id,structure_node_id,section_result_id,
      section_routing_id,source_closure_id,payload_sha256) VALUES ($1,$2,$3,$4,$5,$6)`,
    [runId, node, resultIds[node], routingIds[node], closureIds[node], sha(`payload:${runId}:${node}`)]);
  }

  const draft = {
    schema_version: 'AGREEMENT_DRAFT/V1', draft_analysis_id: draftAnalysisId,
    source_document_id: sourceId, agreement_structure_id: structureId,
    legal_schema_version: 'LEGAL_SCHEMA/V1',
    ...(legalSchemaRevision === undefined ? {} : { legal_schema_revision: legalSchemaRevision }),
    totals: {
      substantive_sections: 2, routed_sections: 2, model_calls: 2, proposals: 2,
      residual_paragraphs: 0, unresolved_unusual_provisions: 0, open_issues: 0,
      cost_microusd: 0, input_tokens: 0, output_tokens: 0,
    },
    sections: nodes.map((node) => ({ node_id: node, section_routing_id: routingIds[node], source_closure_id: closureIds[node] })),
    residual_passes: residuals,
    model_calls: nodes.map((node) => ({ model_call_id: callIds[node] })),
    source_closures: nodes.map((node) => ({
      schema_version: 'PRODUCT_SOURCE_CLOSURE/V1', source_closure_id: closureIds[node],
      structure_node_id: node, section_reference: node === nodes[0] ? '7.3' : '7.1', spans: closureSpans[node],
    })),
    spans: allSpans, section_routings: routings, proposition_groups: groups, proposals,
    fact_links: link ? [link] : [], issues: [], coverage_assertions: [],
  };
  await store.finalizeDraft({ runId, draft });
  return { runId, store, draft, link, targetLocator };
}

test.before(async () => {
  await database.setupDatabase();
  for (const file of prerequisiteMigrations) await execute(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (process.env.PRODUCT_LEGAL_SCHEMA_REVISION_SKIP_MIGRATION !== '1') {
    await execute(fs.readFileSync(migrationPath, 'utf8'));
  }
});

test.after(database.teardownDatabase);

test('saved V1.1 draft preserves schema revision and cross-section V2 evidence through the read interface', async () => {
  const value = await createSavedRunFixture({ legalSchemaRevision: 'LEGAL_SCHEMA/V1.1', crossSection: true });
  const read = await value.store.getAgreementAnalysis(value.runId);
  assert.equal(read.legal_schema_version, 'LEGAL_SCHEMA/V1');
  assert.equal(read.legal_schema_revision, 'LEGAL_SCHEMA/V1.1');
  assert.deepEqual(read.fact_links, [value.link]);
  assert.deepEqual(read.fact_links[0].target_source_span_ids, [value.targetLocator.span_id]);
  const loadedLocator = read.spans.find((item) => item.span_id === value.targetLocator.span_id);
  assert.ok(loadedLocator);
  assert.deepEqual(loadedLocator.source_closure_ids, [value.link.source_closure_id]);
  const completed = await value.store.loadCompletedSectionResults(value.runId);
  const loadedLink = completed.flatMap((section) => section.links)
    .find((item) => item.fact_link_id === value.link.fact_link_id);
  assert.deepEqual(loadedLink, value.link);
  assert.ok(completed.flatMap((section) => section.spans)
    .some((item) => item.span_id === value.targetLocator.span_id));
  const stored = await database.getDatabaseClient().query(
    'SELECT legal_schema_version,legal_schema_revision FROM public.product_draft_analyses WHERE run_id=$1',
    [value.runId],
  );
  assert.deepEqual(stored.rows[0], {
    legal_schema_version: 'LEGAL_SCHEMA/V1', legal_schema_revision: 'LEGAL_SCHEMA/V1.1',
  });
});

test('legacy saved draft stays readable without an invented schema revision', async () => {
  const value = await createSavedRunFixture({ legalSchemaRevision: null, crossSection: false });
  const read = await value.store.getAgreementAnalysis(value.runId);
  assert.equal(Object.hasOwn(read, 'legal_schema_revision'), false);
  const stored = await database.getDatabaseClient().query(
    'SELECT legal_schema_revision FROM public.product_draft_analyses WHERE run_id=$1', [value.runId],
  );
  assert.equal(stored.rows[0].legal_schema_revision, null);
});
