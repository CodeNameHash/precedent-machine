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
const migrationFiles = [
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905203000_product_finalization_retry.sql',
  'supabase/migrations/20260905205000_product_release_timing_guard.sql',
  'supabase/migrations/20260905212000_product_review_citation_repair.sql',
  'supabase/migrations/20260905214000_product_cumulative_review_timing.sql',
];
const findingMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905215000_product_finding_resolution_validation.sql',
), 'utf8');
const groupRepairMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905220000_product_review_proposition_group_repair.sql',
), 'utf8');

let sequence = 0;

async function execute(sql) {
  const client = database.getDatabaseClient();
  if (typeof client.exec === 'function') await client.exec(sql);
  else await client.query(sql);
}

function itemId(kind, sourceId) {
  return crypto.createHash('sha256').update(`${kind}${String.fromCharCode(31)}${sourceId}`).digest('hex');
}

async function fixture({ findingKind = 'COVERAGE', coverageState = 'UNRESOLVED' } = {}) {
  sequence += 1;
  const client = database.getDatabaseClient();
  const sourceId = crypto.createHash('sha256').update(`finding-source-${sequence}`).digest('hex');
  const findingId = crypto.createHash('sha256').update(`finding-${sequence}`).digest('hex');
  const runId = crypto.randomUUID();
  const sectionId = `section-${sequence}`;
  const factId = `fact-${sequence}`;
  const summary = {
    schema_version: 'PRODUCT_REVIEW_SUMMARY/V1',
    summary_id: crypto.createHash('sha256').update(`summary-${sequence}`).digest('hex'),
    families: [{ family_key: 'TERMINATION', facts: [{
      review_item_id: factId,
      structure_node_id: sectionId,
      family_key: 'TERMINATION',
      fact_type: 'OUTSIDE_DATE',
    }] }],
    relationships: [],
  };
  await client.query(`INSERT INTO public.product_source_documents(
    source_document_id,retrieval_url,raw_sha256,payload,payload_sha256
  ) VALUES ($1,$2,$1,'{}'::jsonb,$1)`, [sourceId, `https://example.test/finding/${sequence}`]);
  await client.query(`INSERT INTO public.product_analysis_runs(
    run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
    schema_version,prompt_bundle_version,model_config,explicit_generation,source_generation,
    max_attempts,status,stage
  ) VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PROMPT/V1','{}'::jsonb,0,1,3,'READY','READY')`, [
    runId, sourceId, `https://example.test/finding/${sequence}`,
    `finding-key-${sequence}`, `finding-fingerprint-${sequence}`,
  ]);
  if (findingKind === 'COVERAGE') {
    const payload = {
      coverage_assertion_id: findingId,
      subject_kind: 'FACT_TYPE',
      subject_id: `${sectionId}:TERMINATION:OUTSIDE_DATE`,
      structure_node_id: sectionId,
      family_key: 'TERMINATION',
      reason: 'FACT_TYPE:OUTSIDE_DATE',
      state: coverageState,
    };
    await client.query(`INSERT INTO public.product_coverage_assertions(
      run_id,coverage_assertion_id,subject_kind,subject_id,family_key,structure_node_id,state,payload
    ) VALUES ($1,$2,'FACT_TYPE',$3,'TERMINATION',$4,$5,$6)`, [
      runId, findingId, payload.subject_id, sectionId, coverageState, payload,
    ]);
  } else {
    const payload = {
      issue_id: findingId,
      kind: 'VALIDATION',
      code: 'CONTRADICTION_WITHIN_PROPOSITION_GROUP',
      state: 'OPEN',
      structure_node_id: sectionId,
      family_key: 'TERMINATION',
    };
    await client.query(`INSERT INTO public.product_issues(
      run_id,issue_id,kind,state,family_key,structure_node_id,payload
    ) VALUES ($1,$2,'VALIDATION','OPEN','TERMINATION',$3,$4)`, [runId, findingId, sectionId, payload]);
  }
  const findingItemId = itemId(findingKind, findingId);
  const findingItem = {
    schema_version: 'PRODUCT_REVIEW_ITEM/V1',
    item_id: findingItemId,
    kind: findingKind,
    source_id: findingId,
    decision: 'ACCEPTED',
    decided_by_role: 'LAWYER',
    original: {},
  };
  const state = {
    schema_version: 'PRODUCT_REVIEW_STATE/V1',
    analysis_run_id: runId,
    draft_analysis_id: crypto.createHash('sha256').update(`analysis-${sequence}`).digest('hex'),
    status: 'PUBLISHED',
    agreement_coverage: { decision: 'ACCEPTED' },
    items: [findingItem],
    summary,
    metrics: { review_time_seconds: 1 },
    release_evaluation_input: { finding_resolutions: [] },
  };
  await client.query(`INSERT INTO public.product_review_sessions(
    run_id,draft_analysis_id,version,status,state,started_at
  ) VALUES ($1,$2,1,'PUBLISHED',$3,now())`, [runId, state.draft_analysis_id, state]);
  await client.query(`INSERT INTO public.product_review_publications(
    run_id,publication_version,review_version,summary_id,summary,metrics,published_at
  ) VALUES ($1,1,1,$2,$3,$4,now())`, [runId, summary.summary_id, summary, state.metrics]);
  return { client, factId, findingItemId, runId, state };
}

function linkedResolution(findingItemId, factId, overrides = {}) {
  return {
    finding_item_id: findingItemId,
    disposition: 'PUBLISHED_FACT',
    published_fact_review_item_id: factId,
    reviewed_by_role: 'LAWYER',
    ...overrides,
  };
}

async function validate(runId, state) {
  return database.getDatabaseClient().query(
    'SELECT product_private.product_phase3_validate_review($1,$2,false)', [runId, state],
  );
}

async function rejectsValidation(label, runId, state) {
  const client = database.getDatabaseClient();
  await client.query(`SAVEPOINT ${label}`);
  await assert.rejects(() => validate(runId, state), /invalid finding resolutions/i);
  await client.query(`ROLLBACK TO SAVEPOINT ${label}`);
  await client.query(`RELEASE SAVEPOINT ${label}`);
}

test.before(async () => {
  await database.setupDatabase();
  for (const file of migrationFiles) await execute(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (process.env.PRODUCT_FINDING_RESOLUTION_SKIP_MIGRATION !== '1') await execute(findingMigration);
  await execute(groupRepairMigration);
});
test.after(database.teardownDatabase);

test('database accepts exact published-fact and reasoned-omission resolutions', async () => {
  const linked = await fixture();
  linked.state.release_evaluation_input.finding_resolutions = [
    linkedResolution(linked.findingItemId, linked.factId),
  ];
  await validate(linked.runId, linked.state);
  const omitted = await fixture({ findingKind: 'ISSUE' });
  omitted.state.release_evaluation_input.finding_resolutions = [{
    finding_item_id: omitted.findingItemId,
    disposition: 'REVIEWED_OMISSION',
    omission_reason: 'The lawyer rejected the conflicting extraction after source review.',
    reviewed_by_role: 'LAWYER',
  }];
  await validate(omitted.runId, omitted.state);
});

test('database rejects NOT_RUN, forged, duplicate and incompatible finding resolutions', async () => {
  const notRun = await fixture({ coverageState: 'NOT_RUN' });
  notRun.state.release_evaluation_input.finding_resolutions = [
    linkedResolution(notRun.findingItemId, notRun.factId),
  ];
  await rejectsValidation('not_run_resolution', notRun.runId, notRun.state);

  const valid = await fixture();
  const resolution = linkedResolution(valid.findingItemId, valid.factId);
  for (const [label, resolutions] of [
    ['unknown_finding_resolution', [{ ...resolution, finding_item_id: 'unknown' }]],
    ['wrong_role_resolution', [{ ...resolution, reviewed_by_role: 'AUTOMATION' }]],
    ['unknown_fact_resolution', [{ ...resolution, published_fact_review_item_id: 'unknown' }]],
    ['duplicate_finding_resolution', [resolution, resolution]],
  ]) {
    const state = structuredClone(valid.state);
    state.release_evaluation_input.finding_resolutions = resolutions;
    await rejectsValidation(label, valid.runId, state);
  }
  const incompatible = structuredClone(valid.state);
  incompatible.summary.families[0].facts[0].family_key = 'NO_SHOP';
  incompatible.release_evaluation_input.finding_resolutions = [resolution];
  await rejectsValidation('incompatible_fact_resolution', valid.runId, incompatible);
});
