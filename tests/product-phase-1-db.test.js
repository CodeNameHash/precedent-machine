'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

// Every migration in order (tests/helpers/product-database.js, finding (141)).
const database = require('./helpers/product-database');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
let client;

async function rejectsWithoutAbort(action, pattern) {
  await client.query('SAVEPOINT expected_failure');
  try {
    await assert.rejects(action(), pattern);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_failure');
    await client.query('RELEASE SAVEPOINT expected_failure');
  }
}

test.before(async () => { client = await database.setupDatabase(); });

test.after(database.teardownDatabase);

test('inactive Postgres proves durable state transitions, isolation and rollback', async () => {
  const sourceId = '1'.repeat(64);
  const raw = Buffer.from('hello');
  const source = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sourceId,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/98246/000119312519299997/test.htm',
    raw_sha256: sha256(raw), raw_bytes_base64: raw.toString('base64'), raw_byte_length: raw.length,
    canonical_text: 'hello', canonical_text_sha256: sha256('hello'), canonical_text_byte_length: 5,
  };
  const structureId = '2'.repeat(64);
  const structure = {
    schema_version: 'AGREEMENT_STRUCTURE/V1', agreement_id: sourceId,
    nodes: [
      { node_id: '3'.repeat(64), kind: 'SECTION', reference: '1.01', authored_order: 1 },
      { node_id: '4'.repeat(64), kind: 'SECTION', reference: 'Exhibit-A::1.01', authored_order: 2 },
      { node_id: '5'.repeat(64), kind: 'SECTION', reference: 'Exhibit-A', authored_order: 3 },
      { node_id: '7'.repeat(64), kind: 'SECTION', reference: 'Exhibit-A-INTRO', authored_order: 5 },
    ],
  };
  await client.query('SELECT public.product_phase1_persist_source($1)', [source]);
  await rejectsWithoutAbort(
    () => client.query('SELECT public.product_phase1_persist_source($1)', [{ ...source, raw_sha256: 'a'.repeat(64) }]),
    /bytes or hashes/i,
  );

  const create = async (key, schema = 'schema-1') => (await client.query(
    'SELECT public.product_phase1_create_run($1,$2,$3,$4,$5,$6,$7,$8) AS run',
    [sourceId, source.retrieval_url, key, schema, 'prompts-1', { model: 'test' }, 0, 2],
  )).rows[0].run;
  const runOne = await create('key-one');
  const alias = await create('key-alias');
  assert.equal(alias.run_id, runOne.run_id);
  await rejectsWithoutAbort(() => create('key-one', 'schema-2'), /idempotency key/i);
  const runTwo = await create('key-two', 'schema-2');
  assert.equal(runTwo.source_generation, 2);

  await client.query('SELECT public.product_phase1_attach_structure($1,$2,$3,$4)', [runOne.run_id, structureId, structure, null]);
  // The work set on the full migration list: the substantive sections and,
  // since 20260907005021_product_article_intro_coverage removed the
  // "-INTRO" exclusion (its own check raises if the exclusion remains), the
  // article introduction; never the exhibit container (finding (141)).
  assert.deepEqual((await client.query(
    'SELECT node_id FROM public.product_section_work WHERE run_id=$1 ORDER BY authored_order', [runOne.run_id],
  )).rows.map((row) => row.node_id), ['3'.repeat(64), '4'.repeat(64), '7'.repeat(64)]);
  let claim = (await client.query('SELECT public.product_phase1_claim_section($1,$2,$3) AS work', [runOne.run_id, 'worker-one', 300])).rows[0].work;
  await rejectsWithoutAbort(() => client.query(
    'SELECT public.product_phase1_complete_section($1,$2,$3,$4,$5,$6,$7)',
    [runOne.run_id, claim.node_id, 'worker-one', crypto.randomUUID(), 100, 10, 5],
  ), /stale section attempt/i);
  const complete = () => client.query('SELECT public.product_phase1_complete_section($1,$2,$3,$4,$5,$6,$7)',
    [runOne.run_id, claim.node_id, 'worker-one', claim.attempt_token, 100, 10, 5]);
  await complete();
  await complete();
  assert.equal(Number((await client.query('SELECT cost_microusd FROM public.product_section_work WHERE run_id=$1 AND node_id=$2', [runOne.run_id, claim.node_id])).rows[0].cost_microusd), 100);

  claim = (await client.query('SELECT public.product_phase1_claim_section($1,$2,$3) AS work', [runOne.run_id, 'worker-two', 300])).rows[0].work;
  await client.query('SELECT public.product_phase1_fail_section($1,$2,$3,$4,$5)', [runOne.run_id, claim.node_id, 'worker-two', claim.attempt_token, { message: 'retry' }]);
  assert.equal((await client.query('SELECT status FROM public.product_analysis_runs WHERE run_id=$1', [runOne.run_id])).rows[0].status, 'PARTIAL');
  const retry = (await client.query('SELECT public.product_phase1_claim_section($1,$2,$3) AS work', [runOne.run_id, 'worker-three', 300])).rows[0].work;
  assert.equal(retry.node_id, claim.node_id);
  assert.equal(retry.attempts, 2);
  await client.query('SELECT public.product_phase1_complete_section($1,$2,$3,$4,$5,$6,$7)', [runOne.run_id, retry.node_id, 'worker-three', retry.attempt_token, 200, 20, 10]);
  // The article introduction (the third section of the work set since
  // migration 20260907005021) is completed last; only then is the run READY.
  assert.equal((await client.query('SELECT status FROM public.product_analysis_runs WHERE run_id=$1', [runOne.run_id])).rows[0].status, 'RUNNING');
  const last = (await client.query('SELECT public.product_phase1_claim_section($1,$2,$3) AS work', [runOne.run_id, 'worker-three', 300])).rows[0].work;
  assert.equal(last.node_id, '7'.repeat(64));
  await client.query('SELECT public.product_phase1_complete_section($1,$2,$3,$4,$5,$6,$7)', [runOne.run_id, last.node_id, 'worker-three', last.attempt_token, 50, 5, 2]);
  assert.equal((await client.query('SELECT status FROM public.product_analysis_runs WHERE run_id=$1', [runOne.run_id])).rows[0].status, 'READY');

  const draft = (await client.query('SELECT * FROM public.product_drafts WHERE run_id=$1', [runOne.run_id])).rows[0];
  await client.query('SELECT public.product_phase1_save_draft($1,$2,$3,$4)', [draft.draft_id, 0, { field: 'saved' }, 'tester']);
  await rejectsWithoutAbort(
    () => client.query('SELECT public.product_phase1_save_draft($1,$2,$3,$4)', [draft.draft_id, 0, { field: 'stale' }, 'tester']),
    /optimistic lock/i,
  );
  assert.equal(Number((await client.query('SELECT count(*) FROM public.product_draft_revisions WHERE draft_id=$1', [draft.draft_id])).rows[0].count), 2);
  assert.equal(Number((await client.query('SELECT count(*) FROM public.product_draft_audit_events WHERE draft_id=$1', [draft.draft_id])).rows[0].count), 2);

  await client.query('SELECT public.product_phase1_attach_structure($1,$2,$3,$4)', [runTwo.run_id, structureId, structure, { reasons: ['PARTIES_UNCONFIRMED'] }]);
  assert.equal(Number((await client.query('SELECT count(*) FROM public.product_agreement_structures')).rows[0].count), 1);
  assert.equal(Number((await client.query('SELECT count(*) FROM public.product_section_work WHERE run_id=$1', [runTwo.run_id])).rows[0].count), 0);
  const blockedClaim = (await client.query('SELECT public.product_phase1_claim_section($1,$2,$3) AS work', [runTwo.run_id, 'worker-four', 300])).rows[0].work;
  assert.equal(blockedClaim, null);
  await client.query('SELECT public.product_phase1_resolve_identity($1,$2)', [runTwo.run_id, { confirmed: true }]);
  assert.deepEqual((await client.query(
    'SELECT node_id FROM public.product_section_work WHERE run_id=$1 ORDER BY authored_order', [runTwo.run_id],
  )).rows.map((row) => row.node_id), ['3'.repeat(64), '4'.repeat(64), '7'.repeat(64)]);

  const crashed = (await client.query('SELECT public.product_phase1_claim_section($1,$2,$3) AS work', [runTwo.run_id, 'crashed-worker', 300])).rows[0].work;
  await client.query(`UPDATE public.product_section_work SET lease_expires_at=now()-interval '1 second', attempts=max_attempts
    WHERE run_id=$1 AND node_id=$2`, [runTwo.run_id, crashed.node_id]);
  const recovered = (await client.query('SELECT public.product_phase1_recover_expired_sections($1) AS result', [runTwo.run_id])).rows[0].result;
  assert.equal(recovered.recovered_sections, 1);
  assert.deepEqual((await client.query('SELECT status,worker_id,attempt_token,lease_expires_at,error FROM public.product_section_work WHERE run_id=$1 AND node_id=$2', [runTwo.run_id, crashed.node_id])).rows[0], {
    status: 'FAILED', worker_id: null, attempt_token: null, lease_expires_at: null, error: { code: 'SECTION_LEASE_EXPIRED' },
  });
  assert.equal((await client.query('SELECT status FROM public.product_analysis_runs WHERE run_id=$1', [runTwo.run_id])).rows[0].status, 'FAILED');
  assert.equal((await client.query('SELECT public.product_phase1_recover_expired_sections($1) AS result', [runTwo.run_id])).rows[0].result.recovered_sections, 0);
  assert.equal(Number((await client.query("SELECT count(*) FROM public.product_section_work WHERE run_id=$1 AND status='COMPLETE'", [runOne.run_id])).rows[0].count), 3);

  const permissions = (await client.query(`SELECT
    has_table_privilege('service_role', 'public.product_analysis_runs', 'INSERT') AS direct_insert,
    has_function_privilege('anon', 'public.product_phase1_create_run(text,text,text,text,text,jsonb,integer,integer)', 'EXECUTE') AS anon_execute,
    to_regclass('public.product_visible_deals') AS visible_deals`)).rows[0];
  assert.equal(permissions.direct_insert, false);
  assert.equal(permissions.anon_execute, false);
  assert.equal(permissions.visible_deals, null);
});
