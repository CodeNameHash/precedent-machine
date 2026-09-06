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
const migrations = [
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905212000_product_review_citation_repair.sql',
  'supabase/migrations/20260905215000_product_finding_resolution_validation.sql',
  'supabase/migrations/20260905220000_product_review_proposition_group_repair.sql',
  'supabase/migrations/20260905222000_product_relationship_review.sql',
  'supabase/migrations/20260905225000_product_legal_schema_v1_1_relationship_types.sql',
  'supabase/migrations/20260905230000_product_notice_update_relationship_types.sql',
  'supabase/migrations/20260905231000_product_termination_effect_relationship_types.sql',
];
const identityLookupMigration = path.join(
  ROOT, 'supabase/migrations/20260905232000_product_review_validation_identity_lookup.sql',
);

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const itemId = (kind, sourceId) => sha(`${kind}\u001f${sourceId}`);

async function execute(sql) {
  const client = database.getDatabaseClient();
  if (typeof client.exec === 'function') await client.exec(sql);
  else await client.query(sql);
}

async function immutableValidatorMetadata() {
  const result = await database.getDatabaseClient().query(`SELECT
    pg_get_functiondef('product_private.product_phase3_validate_review_immutable_sources(uuid,jsonb,boolean)'::regprocedure) AS definition,
    proowner::regrole::text AS owner,
    proacl::text AS acl,
    prosecdef AS security_definer,
    proconfig::text AS config
  FROM pg_proc
  WHERE oid = 'product_private.product_phase3_validate_review_immutable_sources(uuid,jsonb,boolean)'::regprocedure`);
  return result.rows[0];
}

async function insertJsonRows(client, table, columns, records) {
  await client.query(
    `INSERT INTO public.${table}(${columns.join(',')})
     SELECT ${columns.join(',')} FROM jsonb_to_recordset($1::jsonb) AS value(
       ${columns.map((column) => `${column} ${{
    run_id: 'uuid', payload: 'jsonb', families: 'jsonb',
  }[column] || (['authored_order'].includes(column) ? 'integer' : 'text')}`).join(',')}
     )`,
    [records],
  );
}

async function largeInitialReviewFixture() {
  const client = database.getDatabaseClient();
  const runId = crypto.randomUUID();
  const sourceDocumentId = sha(`identity-source-${runId}`);
  const draftAnalysisId = sha(`identity-draft-${runId}`);
  const closureId = sha(`identity-closure-${runId}`);
  const spanId = sha(`identity-span-${runId}`);
  const modelCallId = sha(`identity-call-${runId}`);
  const groupId = sha(`identity-group-${runId}`);
  const filler = 'source-qualified-role-content '.repeat(45);

  await client.query(`INSERT INTO public.product_source_documents(
    source_document_id,retrieval_url,raw_sha256,payload,payload_sha256
  ) VALUES ($1,$2,$1,'{}'::jsonb,$1)`, [sourceDocumentId, `https://example.test/${runId}`]);
  await client.query(`INSERT INTO public.product_analysis_runs(
    run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
    schema_version,prompt_bundle_version,model_config,explicit_generation,source_generation,
    max_attempts,status,stage
  ) VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PROMPT/V1','{}'::jsonb,0,1,3,'READY','READY')`, [
    runId, sourceDocumentId, `https://example.test/${runId}`,
    `identity-${runId}`, `fingerprint-${runId}`,
  ]);
  await client.query(`INSERT INTO public.product_source_closures(
    run_id,source_closure_id,structure_node_id,section_reference,payload
  ) VALUES ($1,$2,'section-1','1.1','{}'::jsonb)`, [runId, closureId]);
  await client.query(`INSERT INTO public.product_source_spans(
    run_id,span_id,source_document_id,structure_node_id,kind,coordinate_system,
    start_byte,end_byte,text_sha256,exact_text
  ) VALUES ($1,$2,$3,'section-1','FULL_SECTION','UTF8_CANONICAL_TEXT_HALF_OPEN',0,4,$4,'test')`, [
    runId, spanId, sourceDocumentId, sha('test'),
  ]);
  await client.query(`INSERT INTO public.product_source_closure_spans(run_id,source_closure_id,span_id)
    VALUES ($1,$2,$3)`, [runId, closureId, spanId]);
  await client.query(`INSERT INTO public.product_model_calls(
    run_id,model_call_id,structure_node_id,call_kind,prompt_version,provider_id,model_id,
    request,response,input_tokens,output_tokens,cost_microusd,duration_ms
  ) VALUES ($1,$2,'section-1','EXTRACTION','PROMPT/V1','test','test','{}','{}',0,0,0,0)`, [runId, modelCallId]);
  await client.query(`INSERT INTO public.product_proposition_groups(
    run_id,proposition_group_id,structure_node_id,source_closure_id,family_key,subtype_key,payload
  ) VALUES ($1,$2,'section-1',$3,'TERMINATION','OUTSIDE_DATE','{}')`, [runId, groupId, closureId]);

  const proposals = Array.from({ length: 816 }, (_, index) => {
    const proposalId = sha(`proposal-${runId}-${index}`);
    const factOccurrenceId = sha(`occurrence-${runId}-${index}`);
    const payload = {
      schema_version: 'PRODUCT_PROPOSAL/V1', proposal_id: proposalId,
      fact_occurrence_id: factOccurrenceId, structure_node_id: 'section-1',
      source_closure_id: closureId, proposition_group_id: groupId,
      family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE',
      statement: `Outside date proposal ${index}`, roles: { EFFECT: filler },
      canonical_value: null, source_span_ids: [spanId], validation_status: 'VALID',
    };
    return { proposalId, factOccurrenceId, payload };
  });
  await insertJsonRows(client, 'product_proposals', [
    'run_id', 'proposal_id', 'fact_occurrence_id', 'structure_node_id', 'model_call_id',
    'source_closure_id', 'proposition_group_id', 'family_key', 'subtype_key', 'fact_type',
    'state', 'validation_status', 'payload',
  ], proposals.map((proposal) => ({
    run_id: runId, proposal_id: proposal.proposalId,
    fact_occurrence_id: proposal.factOccurrenceId, structure_node_id: 'section-1',
    model_call_id: modelCallId, source_closure_id: closureId, proposition_group_id: groupId,
    family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE',
    state: 'PROPOSED', validation_status: 'VALID', payload: proposal.payload,
  })));

  const links = Array.from({ length: 135 }, (_, index) => {
    const relationshipType = index < 46 ? 'EXCEPTS' : 'QUALIFIES';
    const factLinkId = sha(`link-${runId}-${index}`);
    const payload = {
      schema_version: 'PRODUCT_FACT_LINK/V1', fact_link_id: factLinkId,
      from_proposal_id: proposals[index].proposalId,
      to_proposal_id: proposals[index + 200].proposalId,
      relationship_type: relationshipType, source_span_ids: [spanId],
    };
    return { factLinkId, relationshipType, payload };
  });
  await insertJsonRows(client, 'product_fact_links', [
    'run_id', 'fact_link_id', 'from_proposal_id', 'to_proposal_id', 'relationship_type', 'payload',
  ], links.map((link) => ({
    run_id: runId, fact_link_id: link.factLinkId,
    from_proposal_id: link.payload.from_proposal_id, to_proposal_id: link.payload.to_proposal_id,
    relationship_type: link.relationshipType, payload: link.payload,
  })));

  const issues = Array.from({ length: 27 }, (_, index) => ({
    run_id: runId, issue_id: sha(`issue-${runId}-${index}`), kind: 'COVERAGE', state: 'OPEN',
    family_key: 'TERMINATION', structure_node_id: 'section-1', proposal_id: null,
    payload: { code: 'TEST_OPEN_ISSUE', detail: filler },
  }));
  await insertJsonRows(client, 'product_issues', [
    'run_id', 'issue_id', 'kind', 'state', 'family_key', 'structure_node_id', 'proposal_id', 'payload',
  ], issues);
  const coverage = Array.from({ length: 365 }, (_, index) => ({
    run_id: runId, coverage_assertion_id: sha(`coverage-${runId}-${index}`),
    subject_kind: 'FACT_TYPE', subject_id: `section-1:TERMINATION:TYPE-${index}`,
    family_key: 'TERMINATION', structure_node_id: 'section-1', model_call_id: modelCallId,
    state: 'UNRESOLVED', payload: { reason: `FACT_TYPE:TYPE-${index}` },
  }));
  await insertJsonRows(client, 'product_coverage_assertions', [
    'run_id', 'coverage_assertion_id', 'subject_kind', 'subject_id', 'family_key',
    'structure_node_id', 'model_call_id', 'state', 'payload',
  ], coverage);
  const routings = Array.from({ length: 5 }, (_, index) => ({
    run_id: runId, section_routing_id: sha(`routing-${runId}-${index}`),
    structure_node_id: `immaterial-${index}`, model_call_id: modelCallId, authored_order: index,
    disposition: 'IMMATERIAL', families: [], payload: { note: filler },
  }));
  await insertJsonRows(client, 'product_section_routings', [
    'run_id', 'section_routing_id', 'structure_node_id', 'model_call_id', 'authored_order',
    'disposition', 'families', 'payload',
  ], routings);

  const proposalItems = proposals.map(({ proposalId, payload }) => ({
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('PROPOSAL', proposalId),
    kind: 'PROPOSAL', source_id: proposalId, decision: 'PENDING',
    structure_node_id: 'section-1', family_key: 'TERMINATION',
    source_closure_id: closureId, source_span_ids: [spanId], original: payload,
    edited_statement: null, edited_roles: null, edited_value: null,
  }));
  const relationshipItems = links.map((link) => ({
    schema_version: 'PRODUCT_REVIEW_ITEM/V1',
    item_id: itemId(link.relationshipType === 'EXCEPTS' ? 'EXCEPTION_LINK' : 'RELATIONSHIP', link.factLinkId),
    kind: link.relationshipType === 'EXCEPTS' ? 'EXCEPTION_LINK' : 'RELATIONSHIP',
    source_id: link.factLinkId, decision: 'PENDING', source_closure_id: closureId,
    source_span_ids: [spanId], original: link.payload, edited_relationship: null,
  }));
  const issueItems = issues.map((issue) => ({
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('ISSUE', issue.issue_id),
    kind: 'ISSUE', source_id: issue.issue_id, decision: 'PENDING', original: issue.payload,
  }));
  const coverageItems = coverage.map((entry) => ({
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('COVERAGE', entry.coverage_assertion_id),
    kind: 'COVERAGE', source_id: entry.coverage_assertion_id, decision: 'PENDING', original: entry.payload,
  }));
  const routingItems = routings.map((routing) => ({
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('IMMATERIAL_ROUTING', routing.section_routing_id),
    kind: 'IMMATERIAL_ROUTING', source_id: routing.section_routing_id, decision: 'PENDING', original: routing.payload,
  }));
  const userFactOriginal = {
    schema_version: 'PRODUCT_USER_FACT/V1', family_key: 'TERMINATION',
    subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE', statement: 'Lawyer supplied fact',
    roles: { EFFECT: 'Lawyer supplied effect' }, canonical_value: null,
  };
  const userFactSourceId = sha([
    draftAnalysisId, 'section-1', 'TERMINATION', 'OUTSIDE_DATE', 'OUTSIDE_DATE',
    userFactOriginal.statement, spanId,
  ].join('\u001f'));
  const userFact = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('USER_FACT', userFactSourceId),
    kind: 'USER_FACT', source_id: userFactSourceId, decision: 'PENDING',
    structure_node_id: 'section-1', family_key: 'TERMINATION', source_closure_id: closureId,
    source_span_ids: [spanId], original: userFactOriginal,
  };
  const userRelationshipOriginal = {
    schema_version: 'PRODUCT_USER_RELATIONSHIP/V1',
    from_proposal_id: proposals[500].proposalId, to_proposal_id: userFactSourceId,
    relationship_type: 'QUALIFIES', source_closure_id: closureId, source_span_ids: [spanId],
  };
  const userRelationshipSourceId = sha([
    'PRODUCT_USER_RELATIONSHIP/V1', draftAnalysisId,
    userRelationshipOriginal.from_proposal_id, userRelationshipOriginal.to_proposal_id,
    userRelationshipOriginal.relationship_type, closureId, spanId,
  ].join('\u001f'));
  const userRelationship = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1',
    item_id: itemId('USER_RELATIONSHIP', userRelationshipSourceId),
    kind: 'USER_RELATIONSHIP', source_id: userRelationshipSourceId, decision: 'PENDING',
    source_closure_id: closureId, source_span_ids: [spanId],
    original: userRelationshipOriginal, edited_relationship: null,
  };
  const state = {
    schema_version: 'PRODUCT_REVIEW_STATE/V1', analysis_run_id: runId,
    draft_analysis_id: draftAnalysisId, status: 'DRAFT',
    agreement_coverage: { decision: 'PENDING' },
    items: [...proposalItems, ...relationshipItems, ...issueItems, ...coverageItems,
      ...routingItems, userFact, userRelationship].sort((a, b) => a.item_id.localeCompare(b.item_id)),
    summary: null, metrics: null, release_evaluation_input: null,
  };
  return { client, runId, state };
}

async function validate(value, state = value.state) {
  return value.client.query(
    'SELECT product_private.product_phase3_validate_review($1,$2,false)',
    [value.runId, state],
  );
}

async function rejects(value, label, mutate, pattern) {
  const state = structuredClone(value.state);
  mutate(state);
  await value.client.query(`SAVEPOINT ${label}`);
  await assert.rejects(() => validate(value, state), pattern);
  await value.client.query(`ROLLBACK TO SAVEPOINT ${label}`);
  await value.client.query(`RELEASE SAVEPOINT ${label}`);
}

test.before(async () => {
  await database.setupDatabase();
  for (const migration of migrations) await execute(fs.readFileSync(path.join(ROOT, migration), 'utf8'));
  if (process.env.PRODUCT_REVIEW_IDENTITY_LOOKUP_SKIP_MIGRATION !== '1') {
    const client = database.getDatabaseClient();
    const prior = await immutableValidatorMetadata();
    const migration = fs.readFileSync(identityLookupMigration, 'utf8');
    await client.query('SAVEPOINT identity_lookup_rollback_proof');
    await execute(migration);
    const applied = await immutableValidatorMetadata();
    assert.notEqual(applied.definition, prior.definition);
    assert.deepEqual({ ...applied, definition: prior.definition }, prior);
    await client.query('ROLLBACK TO SAVEPOINT identity_lookup_rollback_proof');
    await client.query('RELEASE SAVEPOINT identity_lookup_rollback_proof');
    assert.deepEqual(await immutableValidatorMetadata(), prior);
    await execute(migration);
    const final = await immutableValidatorMetadata();
    assert.deepEqual({ ...final, definition: prior.definition }, prior);
  }
});
test.after(database.teardownDatabase);

test('large initial review validates within the production statement limit', async (context) => {
  const value = await largeInitialReviewFixture();
  assert.equal(value.state.items.filter((item) => item.kind === 'PROPOSAL').length, 816);
  assert.equal(value.state.items.filter((item) => ['EXCEPTION_LINK', 'RELATIONSHIP'].includes(item.kind)).length, 135);
  assert.deepEqual([...new Set(value.state.items.map((item) => item.kind))].sort(), [
    'COVERAGE', 'EXCEPTION_LINK', 'IMMATERIAL_ROUTING', 'ISSUE', 'PROPOSAL',
    'RELATIONSHIP', 'USER_FACT', 'USER_RELATIONSHIP',
  ]);
  const started = performance.now();
  await value.client.query("SET LOCAL statement_timeout = '8s'");
  assert.equal((await value.client.query('SHOW statement_timeout')).rows[0].statement_timeout, '8s');
  await validate(value);
  assert.equal((await value.client.query(
    'SELECT count(*)::integer AS count FROM public.product_review_sessions WHERE run_id=$1',
    [value.runId],
  )).rows[0].count, 0);
  context.diagnostic(`1,350-item review validation: ${Math.round(performance.now() - started)} ms`);
});

test('identity lookup rejects missing, duplicate, malformed, and changed immutable items', async () => {
  const value = await largeInitialReviewFixture();
  const proposal = value.state.items.find((item) => item.kind === 'PROPOSAL');
  const coverage = value.state.items.find((item) => item.kind === 'COVERAGE');
  const exception = value.state.items.find((item) => item.kind === 'EXCEPTION_LINK');
  const issue = value.state.items.find((item) => item.kind === 'ISSUE');
  const routing = value.state.items.find((item) => item.kind === 'IMMATERIAL_ROUTING');

  await rejects(value, 'missing_proposal', (state) => {
    state.items = state.items.filter((item) => item.item_id !== proposal.item_id);
  }, /review proposal graph mismatch/i);
  await rejects(value, 'duplicate_proposal', (state) => state.items.push(structuredClone(proposal)), /invalid (review items|relationship review item)/i);
  await rejects(value, 'shadow_proposal', (state) => {
    state.items.push({ ...structuredClone(proposal), item_id: sha('forged-shadow-item') });
  }, /invalid review items/i);
  await rejects(value, 'wrong_kind', (state) => {
    const item = state.items.find((candidate) => candidate.item_id === proposal.item_id);
    item.kind = 'ISSUE';
    item.item_id = itemId(item.kind, item.source_id);
  }, /review proposal graph mismatch/i);
  await rejects(value, 'wrong_source', (state) => {
    const item = state.items.find((candidate) => candidate.item_id === proposal.item_id);
    item.source_id = sha('unknown-proposal');
    item.item_id = itemId(item.kind, item.source_id);
  }, /review proposal graph mismatch/i);
  await rejects(value, 'changed_payload', (state) => {
    state.items.find((candidate) => candidate.item_id === proposal.item_id).original.statement = 'changed';
  }, /review proposal graph mismatch/i);
  await rejects(value, 'changed_closure', (state) => {
    state.items.find((candidate) => candidate.item_id === proposal.item_id).source_closure_id = sha('wrong-closure');
  }, /review proposal graph mismatch/i);
  await rejects(value, 'changed_spans', (state) => {
    state.items.find((candidate) => candidate.item_id === proposal.item_id).source_span_ids = [];
  }, /review proposal (graph|source) mismatch/i);
  for (const [label, item, pattern] of [
    ['exception', exception, /required review item is missing/i],
    ['coverage', coverage, /required review item is missing/i],
    ['issue', issue, /required review item is missing/i],
    ['routing', routing, /required review item is missing/i],
  ]) {
    await rejects(value, `missing_${label}`, (state) => {
      state.items = state.items.filter((candidate) => candidate.item_id !== item.item_id);
    }, pattern);
  }
});
