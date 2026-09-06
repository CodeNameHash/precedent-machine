'use strict';

const assert = require('node:assert/strict');
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
  'supabase/migrations/20260905224000_product_cross_section_relationship_staging.sql',
  'supabase/migrations/20260905225000_product_legal_schema_v1_1_relationship_types.sql',
  'supabase/migrations/20260905227000_product_legal_schema_revision_persistence.sql',
  'supabase/migrations/20260905230000_product_notice_update_relationship_types.sql',
];
const migration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905231000_product_termination_effect_relationship_types.sql',
), 'utf8');
const legalSchema = JSON.parse(fs.readFileSync(path.join(
  ROOT, 'contracts/product/legal-schema.v1.json',
), 'utf8'));
const newSubtypeKeys = [
  'TERMINATION_NOTICE',
  'AGREEMENT_VOIDING',
  'PROVISION_SURVIVAL',
  'LIABILITY_RELEASE',
  'WILLFUL_MATERIAL_BREACH_CARVEOUT',
  'REMEDY_ENTITLEMENT',
];
const existingSubtypeKeys = [
  'MUTUAL_CONSENT',
  'OUTSIDE_DATE',
  'VOTE_FAILURE',
  'BREACH',
  'LEGAL_RESTRAINT',
  'SUPERIOR_PROPOSAL',
  'RECOMMENDATION_CHANGE',
  'NO_SOLICITATION_BREACH',
];
let existingBefore;

async function execute(sql) {
  const client = database.getDatabaseClient();
  if (typeof client.exec === 'function') await client.exec(sql);
  else await client.query(sql);
}

async function relationshipTypes(familyKey, subtypeKeys) {
  const result = await database.getDatabaseClient().query(`SELECT subtype_key,
    product_private.product_phase3_relationship_types($1, subtype_key) AS relationships
    FROM unnest($2::text[]) AS subtype_key ORDER BY subtype_key`, [familyKey, subtypeKeys]);
  return Object.fromEntries(result.rows.map((row) => [row.subtype_key, row.relationships]));
}

test.before(async () => {
  await database.setupDatabase();
  for (const file of prerequisiteMigrations) {
    await execute(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  }
  existingBefore = await relationshipTypes('TERMINATION', existingSubtypeKeys);
  await database.getDatabaseClient().query('SAVEPOINT before_termination_effect_migration');
  await execute(migration);
});

test.after(async () => {
  const client = database.getDatabaseClient();
  await client.query('ROLLBACK TO SAVEPOINT before_termination_effect_migration');
  assert.deepEqual(
    await relationshipTypes('TERMINATION', existingSubtypeKeys),
    existingBefore,
  );
  assert.deepEqual(
    await relationshipTypes('TERMINATION', newSubtypeKeys),
    Object.fromEntries(newSubtypeKeys.map((subtypeKey) => [subtypeKey, null])),
  );
  const restored = await client.query(`SELECT
    to_regprocedure('product_private.product_phase3_relationship_types(text,text)') AS current_function,
    to_regprocedure('product_private.product_phase3_relationship_types_before_term_effect_v1_2(text,text)') AS renamed_function`);
  assert.notEqual(restored.rows[0].current_function, null);
  assert.equal(restored.rows[0].renamed_function, null);
  await client.query('RELEASE SAVEPOINT before_termination_effect_migration');
  await database.teardownDatabase();
});

test('termination-effect relationship types match V1.2 without changing existing termination grants', async () => {
  const family = legalSchema.families.find((candidate) => candidate.family_key === 'TERMINATION');
  const expected = Object.fromEntries(newSubtypeKeys.map((subtypeKey) => {
    const subtype = family.subtypes.find((candidate) => candidate.subtype_key === subtypeKey);
    assert.ok(subtype);
    return [subtypeKey, subtype.relationships];
  }));

  assert.deepEqual(await relationshipTypes('TERMINATION', newSubtypeKeys), expected);
  assert.deepEqual(await relationshipTypes('TERMINATION', existingSubtypeKeys), existingBefore);

  const invalid = await relationshipTypes('TERMINATION', ['UNKNOWN_SUBTYPE']);
  const wrongFamily = await relationshipTypes('UNKNOWN_FAMILY', ['REMEDY_ENTITLEMENT']);
  assert.deepEqual(invalid, { UNKNOWN_SUBTYPE: null });
  assert.deepEqual(wrongFamily, { REMEDY_ENTITLEMENT: null });
});

test('the private relationship contract remains unavailable to application roles', async () => {
  const access = (await database.getDatabaseClient().query(`SELECT
    has_function_privilege('anon',
      'product_private.product_phase3_relationship_types(text,text)','EXECUTE') AS anon,
    has_function_privilege('authenticated',
      'product_private.product_phase3_relationship_types(text,text)','EXECUTE') AS authenticated,
    has_function_privilege('service_role',
      'product_private.product_phase3_relationship_types(text,text)','EXECUTE') AS service`)).rows[0];
  assert.deepEqual(access, { anon: false, authenticated: false, service: false });
});
