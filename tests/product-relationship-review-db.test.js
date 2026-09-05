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
const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { applyReviewCommand } = require('../lib/product/review-state');
const migrationFiles = [
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905203000_product_finalization_retry.sql',
  'supabase/migrations/20260905205000_product_release_timing_guard.sql',
  'supabase/migrations/20260905212000_product_review_citation_repair.sql',
  'supabase/migrations/20260905214000_product_cumulative_review_timing.sql',
  'supabase/migrations/20260905215000_product_finding_resolution_validation.sql',
  'supabase/migrations/20260905220000_product_review_proposition_group_repair.sql',
];
const relationshipMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905222000_product_relationship_review.sql',
), 'utf8');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const itemId = (kind, sourceId) => sha(`${kind}\u001f${sourceId}`);

async function execute(sql) {
  const client = database.getDatabaseClient();
  if (typeof client.exec === 'function') await client.exec(sql);
  else await client.query(sql);
}

function effectiveRelationship(item) {
  const values = item.edited_relationship || item.original;
  return {
    review_item_id: item.item_id,
    schema_version: item.original.schema_version || 'PRODUCT_FACT_LINK/V1',
    fact_link_id: item.original.fact_link_id || item.source_id,
    from_proposal_id: values.from_proposal_id,
    to_proposal_id: values.to_proposal_id,
    relationship_type: values.relationship_type,
    source_closure_id: item.edited_relationship
      ? item.edited_relationship.source_closure_id : item.source_closure_id,
    source_span_ids: item.edited_relationship
      ? item.edited_relationship.source_span_ids : item.source_span_ids,
  };
}

async function fixture({ emptyExceptionSource = false } = {}) {
  const client = database.getDatabaseClient();
  const runId = crypto.randomUUID();
  const sourceId = sha(`relationship-source-${runId}`);
  const draftAnalysisId = sha(`relationship-analysis-${runId}`);
  const closureId = sha(`relationship-closure-${runId}`);
  const spanId = sha(`relationship-span-${runId}`);
  const modelCallId = sha(`relationship-call-${runId}`);
  const proposalIds = [1, 2, 3].map((number) => sha(`relationship-proposal-${runId}-${number}`));
  const groupIds = [1, 2, 3].map((number) => sha(`relationship-group-${runId}-${number}`));
  const rawLinkIds = [sha(`relationship-exception-${runId}`), sha(`relationship-qualified-${runId}`)];

  await client.query(`INSERT INTO public.product_source_documents
    (source_document_id,retrieval_url,raw_sha256,payload,payload_sha256)
    VALUES ($1,$2,$1,'{}'::jsonb,$1)`, [sourceId, `https://example.test/relationship/${runId}`]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
      schema_version,prompt_bundle_version,model_config,explicit_generation,source_generation,
      max_attempts,status,stage)
    VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PROMPT/V1','{}'::jsonb,0,1,3,'READY','READY')`, [
    runId, sourceId, `https://example.test/relationship/${runId}`,
    `relationship-key-${runId}`, `relationship-fingerprint-${runId}`,
  ]);
  await client.query(`INSERT INTO public.product_source_closures
    (run_id,source_closure_id,structure_node_id,section_reference,payload)
    VALUES ($1,$2,'section-1','1.1','{}'::jsonb)`, [runId, closureId]);
  await client.query(`INSERT INTO public.product_source_spans
    (run_id,span_id,source_document_id,structure_node_id,kind,coordinate_system,
      start_byte,end_byte,text_sha256,exact_text)
    VALUES ($1,$2,$3,'section-1','FULL_SECTION','UTF8_CANONICAL_TEXT_HALF_OPEN',0,4,$4,'test')`, [
    runId, spanId, sourceId, sha('test'),
  ]);
  await client.query(`INSERT INTO public.product_source_closure_spans(run_id,source_closure_id,span_id)
    VALUES ($1,$2,$3)`, [runId, closureId, spanId]);
  await client.query(`INSERT INTO public.product_model_calls
    (run_id,model_call_id,structure_node_id,call_kind,prompt_version,provider_id,model_id,
      request,response,input_tokens,output_tokens,cost_microusd,duration_ms)
    VALUES ($1,$2,'section-1','EXTRACTION','PROMPT/V1','test','test','{}'::jsonb,
      '{}'::jsonb,0,0,0,0)`, [runId, modelCallId]);

  const proposalPayloads = proposalIds.map((proposalId, index) => ({
    schema_version: 'PRODUCT_PROPOSAL/V1',
    proposal_id: proposalId,
    fact_occurrence_id: sha(`relationship-occurrence-${runId}-${index}`),
    structure_node_id: 'section-1',
    source_closure_id: closureId,
    proposition_group_id: groupIds[index],
    family_key: 'TERMINATION',
    subtype_key: 'OUTSIDE_DATE',
    fact_type: 'OUTSIDE_DATE',
    statement: `Proposal ${index + 1}`,
    roles: {},
    canonical_value: null,
    source_span_ids: [spanId],
    validation_status: 'VALID',
  }));
  for (let index = 0; index < proposalPayloads.length; index += 1) {
    const proposal = proposalPayloads[index];
    await client.query(`INSERT INTO public.product_proposition_groups
      (run_id,proposition_group_id,structure_node_id,source_closure_id,family_key,subtype_key,payload)
      VALUES ($1,$2,'section-1',$3,'TERMINATION','OUTSIDE_DATE','{}'::jsonb)`, [
      runId, groupIds[index], closureId,
    ]);
    await client.query(`INSERT INTO public.product_proposals
      (run_id,proposal_id,fact_occurrence_id,structure_node_id,model_call_id,source_closure_id,
        proposition_group_id,family_key,subtype_key,fact_type,state,validation_status,payload)
      VALUES ($1,$2,$3,'section-1',$4,$5,$6,'TERMINATION','OUTSIDE_DATE','OUTSIDE_DATE',
        'PROPOSED','VALID',$7::jsonb)`, [
      runId, proposal.proposal_id, proposal.fact_occurrence_id, modelCallId, closureId,
      proposal.proposition_group_id, proposal,
    ]);
  }

  const rawLinks = [
    {
      schema_version: 'PRODUCT_FACT_LINK/V1', fact_link_id: rawLinkIds[0],
      from_proposal_id: proposalIds[0], to_proposal_id: proposalIds[1],
      relationship_type: 'EXCEPTS', source_span_ids: emptyExceptionSource ? [] : [spanId],
    },
    {
      schema_version: 'PRODUCT_FACT_LINK/V1', fact_link_id: rawLinkIds[1],
      from_proposal_id: proposalIds[0], to_proposal_id: proposalIds[2],
      relationship_type: 'QUALIFIES', source_span_ids: [spanId],
    },
  ];
  for (const link of rawLinks) {
    await client.query(`INSERT INTO public.product_fact_links
      (run_id,fact_link_id,from_proposal_id,to_proposal_id,relationship_type,payload)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [
      runId, link.fact_link_id, link.from_proposal_id, link.to_proposal_id,
      link.relationship_type, link,
    ]);
  }

  const proposalItems = proposalPayloads.map((proposal, index) => ({
    schema_version: 'PRODUCT_REVIEW_ITEM/V1',
    item_id: itemId('PROPOSAL', proposal.proposal_id),
    kind: 'PROPOSAL', source_id: proposal.proposal_id,
    decision: index === 1 ? 'REJECTED' : 'ACCEPTED', decided_by_role: 'LAWYER',
    structure_node_id: 'section-1', family_key: 'TERMINATION',
    source_closure_id: closureId, source_span_ids: [spanId], original: proposal,
    edited_statement: null, edited_roles: null, edited_value: null,
  }));
  const userFactOriginal = {
    schema_version: 'PRODUCT_USER_FACT/V1', family_key: 'TERMINATION',
    subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE', statement: 'Lawyer-added fact',
    roles: {}, canonical_value: null,
  };
  const userFactSourceId = sha([
    draftAnalysisId, 'section-1', 'TERMINATION', 'OUTSIDE_DATE', 'OUTSIDE_DATE',
    userFactOriginal.statement, spanId,
  ].join('\u001f'));
  const userFactItem = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('USER_FACT', userFactSourceId),
    kind: 'USER_FACT', source_id: userFactSourceId, decision: 'EDITED', decided_by_role: 'LAWYER',
    structure_node_id: 'section-1', family_key: 'TERMINATION',
    source_closure_id: closureId, source_span_ids: [spanId], original: userFactOriginal,
    edited_statement: userFactOriginal.statement, edited_roles: {}, edited_value: null,
  };
  const exceptionItem = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('EXCEPTION_LINK', rawLinkIds[0]),
    kind: 'EXCEPTION_LINK', source_id: rawLinkIds[0], decision: 'EDITED', decided_by_role: 'LAWYER',
    source_closure_id: closureId, source_span_ids: [spanId], original: rawLinks[0],
    edited_relationship: {
      from_proposal_id: proposalIds[0], to_proposal_id: userFactSourceId,
      relationship_type: 'EXCEPTS', source_closure_id: closureId, source_span_ids: [spanId],
    },
  };
  const typedItem = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1', item_id: itemId('RELATIONSHIP', rawLinkIds[1]),
    kind: 'RELATIONSHIP', source_id: rawLinkIds[1], decision: 'ACCEPTED', decided_by_role: 'LAWYER',
    source_closure_id: closureId, source_span_ids: [spanId], original: rawLinks[1],
    edited_relationship: null,
  };
  const userRelationshipOriginal = {
    schema_version: 'PRODUCT_USER_RELATIONSHIP/V1',
    from_proposal_id: proposalIds[0], to_proposal_id: userFactSourceId,
    relationship_type: 'EXTENDS', source_closure_id: closureId, source_span_ids: [spanId],
  };
  const userRelationshipSourceId = sha([
    'PRODUCT_USER_RELATIONSHIP/V1', draftAnalysisId, proposalIds[0], userFactSourceId,
    'EXTENDS', closureId, spanId,
  ].join('\u001f'));
  const userRelationshipItem = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1',
    item_id: itemId('USER_RELATIONSHIP', userRelationshipSourceId),
    kind: 'USER_RELATIONSHIP', source_id: userRelationshipSourceId,
    decision: 'EDITED', decided_by_role: 'LAWYER',
    source_closure_id: closureId, source_span_ids: [spanId],
    original: userRelationshipOriginal, edited_relationship: null,
  };
  const relationshipItems = [exceptionItem, typedItem, userRelationshipItem];
  const facts = [...proposalItems.filter((item) => item.decision !== 'REJECTED'), userFactItem].map((item) => ({
    review_item_id: item.item_id, source_id: item.source_id,
    structure_node_id: item.structure_node_id, family_key: item.family_key,
    subtype_key: item.original.subtype_key, fact_type: item.original.fact_type,
    statement: item.edited_statement || item.original.statement,
    roles: item.edited_roles || item.original.roles,
    canonical_value: item.edited_value ?? item.original.canonical_value ?? null,
    proposition_group_id: item.kind === 'PROPOSAL' ? item.original.proposition_group_id : null,
    source_closure_id: item.source_closure_id, source_span_ids: item.source_span_ids,
  }));
  const summary = {
    schema_version: 'PRODUCT_REVIEW_SUMMARY/V1', draft_analysis_id: draftAnalysisId,
    families: legalSchema.families.map((family) => ({
      family_key: family.family_key,
      facts: facts.filter((fact) => fact.family_key === family.family_key),
    })),
    relationships: relationshipItems.map(effectiveRelationship),
  };
  summary.summary_id = sha(JSON.stringify(summary));
  const state = {
    schema_version: 'PRODUCT_REVIEW_STATE/V1', analysis_run_id: runId,
    draft_analysis_id: draftAnalysisId, status: 'PUBLISHED',
    agreement_coverage: { decision: 'ACCEPTED' },
    items: [...proposalItems, userFactItem, ...relationshipItems], summary,
    metrics: { proposal_count: 3, proposal_errors: 1, proposal_omissions: 1, unresolved_count: 0, review_time_seconds: 60 },
    release_evaluation_input: null,
  };
  return {
    client, closureId, exceptionItem, proposalIds, rawLinks, runId, spanId,
    state, typedItem, userFactItem, userRelationshipItem,
  };
}

async function validate(fixtureValue, state = fixtureValue.state, publish = true) {
  return fixtureValue.client.query(
    'SELECT product_private.product_phase3_validate_review($1,$2,$3)',
    [fixtureValue.runId, state, publish],
  );
}

async function rejects(label, fixtureValue, mutate, pattern = /relationship/i) {
  const state = structuredClone(fixtureValue.state);
  mutate(state);
  await fixtureValue.client.query(`SAVEPOINT ${label}`);
  await assert.rejects(() => validate(fixtureValue, state), pattern);
  await fixtureValue.client.query(`ROLLBACK TO SAVEPOINT ${label}`);
  await fixtureValue.client.query(`RELEASE SAVEPOINT ${label}`);
}

async function rejectsDraft(label, fixtureValue, mutate, pattern = /relationship/i) {
  const state = {
    ...structuredClone(fixtureValue.state), status: 'DRAFT', summary: null, metrics: null,
  };
  mutate(state);
  await fixtureValue.client.query(`SAVEPOINT ${label}`);
  await assert.rejects(() => validate(fixtureValue, state, false), pattern);
  await fixtureValue.client.query(`ROLLBACK TO SAVEPOINT ${label}`);
  await fixtureValue.client.query(`RELEASE SAVEPOINT ${label}`);
}

function reidentifyUserRelationship(state) {
  const item = state.items.find((candidate) => candidate.kind === 'USER_RELATIONSHIP');
  const priorItemId = item.item_id;
  item.source_id = sha([
    'PRODUCT_USER_RELATIONSHIP/V1', state.draft_analysis_id,
    item.original.from_proposal_id, item.original.to_proposal_id,
    item.original.relationship_type, item.original.source_closure_id,
    [...item.original.source_span_ids].sort().join(','),
  ].join('\u001f'));
  item.item_id = itemId('USER_RELATIONSHIP', item.source_id);
  const summaryIndex = state.summary.relationships
    .findIndex((relationship) => relationship.review_item_id === priorItemId);
  state.summary.relationships[summaryIndex] = effectiveRelationship(item);
}

test.before(async () => {
  await database.setupDatabase();
  for (const file of migrationFiles) await execute(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (process.env.PRODUCT_RELATIONSHIP_REVIEW_SKIP_MIGRATION !== '1') await execute(relationshipMigration);
});
test.after(database.teardownDatabase);

test('database validates edited, added, and all raw typed reviewed relationships', async () => {
  const value = await fixture();
  await validate(value);
  assert.equal(value.state.items.find((item) => item.source_id === value.rawLinks[0].to_proposal_id).decision, 'REJECTED');
  assert.equal(value.state.summary.relationships.length, 3);
  assert.ok(value.state.summary.relationships.some((item) => item.relationship_type === 'QUALIFIES'));
  assert.ok(value.state.summary.relationships.some((item) => item.review_item_id === value.userRelationshipItem.item_id
    && item.to_proposal_id === value.userFactItem.source_id));
  assert.equal(value.userRelationshipItem.original.fact_link_id, undefined);
  assert.equal(value.state.summary.relationships.find((item) => (
    item.review_item_id === value.userRelationshipItem.item_id
  )).fact_link_id, value.userRelationshipItem.source_id);

  const rejectedEdit = structuredClone(value.state);
  rejectedEdit.items.find((item) => item.item_id === value.exceptionItem.item_id).decision = 'REJECTED';
  rejectedEdit.summary.relationships = rejectedEdit.summary.relationships
    .filter((item) => item.review_item_id !== value.exceptionItem.item_id);
  await validate(value, rejectedEdit);
  assert.deepEqual(
    rejectedEdit.items.find((item) => item.item_id === value.exceptionItem.item_id).edited_relationship,
    value.exceptionItem.edited_relationship,
  );
  const acceptedEdit = structuredClone(rejectedEdit);
  acceptedEdit.items.find((item) => item.item_id === value.exceptionItem.item_id).decision = 'ACCEPTED';
  acceptedEdit.summary.relationships.push(effectiveRelationship(
    acceptedEdit.items.find((item) => item.item_id === value.exceptionItem.item_id),
  ));
  await validate(value, acceptedEdit);

  const legacyDraft = structuredClone(value.state);
  legacyDraft.status = 'DRAFT';
  legacyDraft.summary = null;
  legacyDraft.metrics = null;
  legacyDraft.items = legacyDraft.items.filter((item) => (
    item.kind !== 'RELATIONSHIP' && item.kind !== 'USER_RELATIONSHIP'
  ));
  const legacyException = legacyDraft.items.find((item) => item.kind === 'EXCEPTION_LINK');
  legacyException.decision = 'REJECTED';
  legacyException.edited_relationship = null;
  await validate(value, legacyDraft, false);

  const normalisedDraft = structuredClone(value.state);
  normalisedDraft.status = 'DRAFT';
  normalisedDraft.summary = null;
  normalisedDraft.metrics = null;
  const pendingTyped = normalisedDraft.items.find((item) => item.kind === 'RELATIONSHIP');
  pendingTyped.decision = 'PENDING';
  await validate(value, normalisedDraft, false);
});

test('database accepts a citation edit produced for an existing user relationship', async () => {
  const value = await fixture();
  const secondClosureId = sha(`relationship-closure-2-${value.runId}`);
  const secondSpanId = sha(`relationship-span-2-${value.runId}`);
  await value.client.query(`INSERT INTO public.product_source_closures
    (run_id,source_closure_id,structure_node_id,section_reference,payload)
    VALUES ($1,$2,'section-1','1.2','{}'::jsonb)`, [value.runId, secondClosureId]);
  await value.client.query(`INSERT INTO public.product_source_spans
    (run_id,span_id,source_document_id,structure_node_id,kind,coordinate_system,
      start_byte,end_byte,text_sha256,exact_text)
    SELECT run_id,$2,source_document_id,'section-1','FULL_SECTION',
      'UTF8_CANONICAL_TEXT_HALF_OPEN',0,6,$3,'second'
    FROM public.product_analysis_runs WHERE run_id=$1`, [value.runId, secondSpanId, sha('second')]);
  await value.client.query(`INSERT INTO public.product_source_closure_spans
    (run_id,source_closure_id,span_id) VALUES ($1,$2,$3)`, [
    value.runId, secondClosureId, secondSpanId,
  ]);

  const draft = {
    ...structuredClone(value.state), status: 'DRAFT', summary: null, metrics: null,
  };
  const existing = draft.items.find((item) => item.kind === 'USER_RELATIONSHIP');
  const from = draft.items.find((item) => item.source_id === existing.original.from_proposal_id);
  const to = draft.items.find((item) => item.source_id === existing.original.to_proposal_id);
  const edited = applyReviewCommand(draft, {
    type: 'UPSERT_RELATIONSHIP', item_id: existing.item_id,
    from_item_id: from.item_id, to_item_id: to.item_id,
    relationship_type: existing.original.relationship_type,
    source_closure_id: secondClosureId, source_span_ids: [secondSpanId],
  }, {
    analysis: {
      fact_links: value.rawLinks,
      source_closures: [
        { source_closure_id: value.closureId, structure_node_id: 'section-1' },
        { source_closure_id: secondClosureId, structure_node_id: 'section-1' },
      ],
      spans: [
        { span_id: value.spanId, source_closure_ids: [value.closureId] },
        { span_id: secondSpanId, source_closure_ids: [secondClosureId] },
      ],
    },
    legalSchema,
  });
  const editedItem = edited.items.find((item) => item.item_id === existing.item_id);
  assert.deepEqual(editedItem.original, existing.original);
  assert.equal(editedItem.source_id, existing.source_id);
  assert.equal(editedItem.source_closure_id, secondClosureId);
  assert.deepEqual(editedItem.source_span_ids, [secondSpanId]);
  assert.equal(editedItem.edited_relationship.source_closure_id, secondClosureId);
  await validate(value, edited, false);
});

test('legacy raw fallback citations remain draft-saveable but require an explicit edit to publish', async () => {
  const value = await fixture({ emptyExceptionSource: true });
  const emptySourceLink = value.rawLinks[0];

  const legacyDraft = {
    ...structuredClone(value.state), status: 'DRAFT', summary: null, metrics: null,
  };
  const legacyItem = legacyDraft.items.find((item) => item.kind === 'EXCEPTION_LINK');
  legacyItem.original = emptySourceLink;
  legacyItem.edited_relationship = null;
  legacyItem.decision = 'REJECTED';
  assert.deepEqual(legacyItem.source_span_ids, [value.spanId]);
  await validate(value, legacyDraft, false);

  const acceptedWithoutEdit = structuredClone(legacyDraft);
  acceptedWithoutEdit.items.find((item) => item.item_id === legacyItem.item_id).decision = 'ACCEPTED';
  await value.client.query('SAVEPOINT legacy_accept');
  await assert.rejects(() => validate(value, acceptedWithoutEdit, false), /invalid relationship review item/i);
  await value.client.query('ROLLBACK TO SAVEPOINT legacy_accept');
  await value.client.query('RELEASE SAVEPOINT legacy_accept');
  const publishedWithoutEdit = {
    ...acceptedWithoutEdit, status: 'PUBLISHED', summary: structuredClone(value.state.summary),
    metrics: structuredClone(value.state.metrics),
  };
  await value.client.query('SAVEPOINT legacy_publish');
  await assert.rejects(() => validate(value, publishedWithoutEdit), /invalid relationship review item/i);
  await value.client.query('ROLLBACK TO SAVEPOINT legacy_publish');
  await value.client.query('RELEASE SAVEPOINT legacy_publish');

  const corrected = structuredClone(value.state);
  corrected.items.find((item) => item.item_id === legacyItem.item_id).original = emptySourceLink;
  await validate(value, corrected);
});

test('database rejects hostile relationship identity, endpoint, type, citation, duplicate, and summary changes', async () => {
  const value = await fixture();
  const cases = [
    ['missing_relationship_kind', (state) => { delete state.items.find((item) => item.kind === 'USER_RELATIONSHIP').kind; }, /review item/i],
    ['null_relationship_kind', (state) => { state.items.find((item) => item.kind === 'USER_RELATIONSHIP').kind = null; }, /review item/i],
    ['missing_relationship_decision', (state) => { delete state.items.find((item) => item.kind === 'RELATIONSHIP').decision; }, /invalid relationship review item/i],
    ['null_relationship_decision', (state) => { state.items.find((item) => item.kind === 'RELATIONSHIP').decision = null; }, /invalid relationship review item/i],
    ['forged_relationship_id', (state) => { state.items.find((item) => item.kind === 'USER_RELATIONSHIP').source_id = 'f'.repeat(64); }, /invalid relationship review item/i],
    ['same_relationship_endpoint', (state) => { const item = state.items.find((candidate) => candidate.kind === 'USER_RELATIONSHIP'); item.original.to_proposal_id = item.original.from_proposal_id; reidentifyUserRelationship(state); }, /invalid effective relationship/i],
    ['unknown_relationship_endpoint', (state) => { state.items.find((item) => item.kind === 'USER_RELATIONSHIP').original.to_proposal_id = 'f'.repeat(64); reidentifyUserRelationship(state); }, /relationship endpoint or source mismatch/i],
    ['forbidden_relationship_type', (state) => { state.items.find((item) => item.kind === 'USER_RELATIONSHIP').original.relationship_type = 'DEFINED_BY'; reidentifyUserRelationship(state); }, /not allowed by the originating fact subtype/i],
    ['unknown_relationship_type', (state) => { state.items.find((item) => item.kind === 'USER_RELATIONSHIP').original.relationship_type = 'MODEL_TYPE'; reidentifyUserRelationship(state); }, /invalid effective relationship/i],
    ['unknown_relationship_closure', (state) => { const item = state.items.find((candidate) => candidate.kind === 'USER_RELATIONSHIP'); item.original.source_closure_id = 'f'.repeat(64); item.source_closure_id = 'f'.repeat(64); reidentifyUserRelationship(state); }, /relationship endpoint or source mismatch/i],
    ['empty_relationship_spans', (state) => { const item = state.items.find((candidate) => candidate.kind === 'USER_RELATIONSHIP'); item.original.source_span_ids = []; item.source_span_ids = []; reidentifyUserRelationship(state); }, /relationship endpoint or source mismatch/i],
    ['duplicate_relationship_spans', (state) => { const item = state.items.find((candidate) => candidate.kind === 'USER_RELATIONSHIP'); item.original.source_span_ids = [value.spanId, value.spanId]; item.source_span_ids = [value.spanId, value.spanId]; reidentifyUserRelationship(state); }, /relationship endpoint or source mismatch/i],
    ['duplicate_effective_relationship', (state) => { state.items.find((item) => item.kind === 'USER_RELATIONSHIP').original.relationship_type = 'EXCEPTS'; reidentifyUserRelationship(state); }, /duplicate effective relationship/i],
    ['missing_summary_relationship', (state) => { state.summary.relationships.pop(); }, /published relationship summary mismatch/i],
    ['forged_summary_relationship', (state) => { state.summary.relationships[0].to_proposal_id = value.proposalIds[2]; }, /published relationship summary mismatch/i],
  ];
  for (const [label, mutate, pattern] of cases) await rejects(label, value, mutate, pattern);
  await rejectsDraft('missing_relationship_decision_draft', value, (state) => {
    delete state.items.find((item) => item.kind === 'RELATIONSHIP').decision;
  }, /invalid relationship review item/i);
  await rejectsDraft('null_relationship_decision_draft', value, (state) => {
    state.items.find((item) => item.kind === 'RELATIONSHIP').decision = null;
  }, /invalid relationship review item/i);
  await rejectsDraft('missing_relationship_kind_draft', value, (state) => {
    delete state.items.find((item) => item.kind === 'USER_RELATIONSHIP').kind;
  }, /invalid relationship review item/i);
  await rejectsDraft('null_relationship_kind_draft', value, (state) => {
    state.items.find((item) => item.kind === 'USER_RELATIONSHIP').kind = null;
  }, /invalid relationship review item/i);

  await value.client.query('SAVEPOINT unknown_relationship_schema');
  await value.client.query("UPDATE public.product_analysis_runs SET schema_version='LEGAL_SCHEMA/V999' WHERE run_id=$1", [value.runId]);
  await assert.rejects(() => validate(value), /not allowed by the originating fact subtype/i);
  await value.client.query('ROLLBACK TO SAVEPOINT unknown_relationship_schema');
  await value.client.query('RELEASE SAVEPOINT unknown_relationship_schema');
});

test('database blocks unfinished relationship review and retains prior validator safeguards', async () => {
  const value = await fixture();
  for (const decision of ['PENDING', 'UNRESOLVED']) {
    await rejects(`${decision.toLowerCase()}_relationship`, value, (state) => {
      state.items.find((item) => item.kind === 'RELATIONSHIP').decision = decision;
    }, /published relationship review is incomplete/i);
  }
  await rejects('missing_raw_relationship', value, (state) => {
    state.items = state.items.filter((item) => item.kind !== 'RELATIONSHIP');
    state.summary.relationships = state.summary.relationships.filter((item) => item.review_item_id !== value.typedItem.item_id);
  }, /required relationship review item is missing/i);
  await rejects('immutable_proposal', value, (state) => {
    state.items.find((item) => item.kind === 'PROPOSAL').original.statement = 'forged';
  }, /review proposal graph mismatch/i);
  await rejects('proposal_citation', value, (state) => {
    state.items.find((item) => item.kind === 'PROPOSAL' && item.decision === 'ACCEPTED').source_span_ids = [];
  }, /review proposal source mismatch/i);
  await rejects('proposition_group', value, (state) => {
    state.summary.families.flatMap((family) => family.facts)
      .find((fact) => fact.proposition_group_id).proposition_group_id = null;
  }, /published review proposition group mismatch/i);
  await rejects('finding_resolution', value, (state) => {
    state.release_evaluation_input = { finding_resolutions: [{ forged: true }] };
  }, /invalid finding resolutions/i);
});

test('private relationship permissions match the active legal contract and preserve validator ACLs', async () => {
  const client = database.getDatabaseClient();
  for (const family of legalSchema.families) {
    for (const subtype of family.subtypes) {
      const result = (await client.query(
        'SELECT product_private.product_phase3_relationship_types($1,$2) AS value',
        [family.family_key, subtype.subtype_key],
      )).rows[0].value;
      assert.deepEqual(result, subtype.relationships);
    }
  }
  assert.equal((await client.query(
    "SELECT product_private.product_phase3_relationship_types('UNKNOWN','UNKNOWN') AS value",
  )).rows[0].value, null);
  const privileges = (await client.query(`SELECT
    has_function_privilege('service_role','product_private.product_phase3_validate_review(uuid,jsonb,boolean)','EXECUTE') AS service_validator,
    has_function_privilege('anon','product_private.product_phase3_validate_review(uuid,jsonb,boolean)','EXECUTE') AS anon_validator,
    has_function_privilege('authenticated','product_private.product_phase3_validate_review(uuid,jsonb,boolean)','EXECUTE') AS authenticated_validator,
    has_function_privilege('service_role','product_private.product_phase3_validate_review_before_relationship_review(uuid,jsonb,boolean)','EXECUTE') AS service_prior,
    has_function_privilege('service_role','product_private.product_phase3_relationship_types(text,text)','EXECUTE') AS service_lookup`)).rows[0];
  assert.deepEqual(privileges, {
    service_validator: true, anon_validator: false, authenticated_validator: false,
    service_prior: false, service_lookup: false,
  });
  const functionSettings = (await client.query(`SELECT prosecdef,proconfig
    FROM pg_proc WHERE oid=
      'product_private.product_phase3_validate_review(uuid,jsonb,boolean)'::regprocedure`)).rows[0];
  assert.equal(functionSettings.prosecdef, true);
  assert.ok(functionSettings.proconfig.includes('search_path=""'));
});
