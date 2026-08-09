// Step 4A2 (docs/core/PLAN.md). Regression test for the SQL writer's new
// canonical_v2_staging.conditional_termination_fee_values table and the
// DEAL_SCOPE_RUN branch that writes it.
//
// This repository's existing SQL-source tests (tests/canonical-v2-writer-
// structure-identity-sql.test.js and siblings, plus tests/canonical-v2-
// writer-provision-shape-branch-sql.test.js from Step 4A1) pattern-match
// fragments of supabase/canonical-v2-foundation.sql rather than executing
// it, because CI has no live Postgres. This test follows that same
// convention. A live-execution reproduction -- real Modiv conditional fee
// values written durably, read back byte-identical, and three hostile
// malformed rows refused -- is recorded in docs/codex-program/notes/
// step-4a2-conditional-fee-table.md; do not read a pass here as proof the
// table and branch work against Postgres.
//
// What this guards against: conditional_termination_fee_values is a
// write-set object kind lib/canonical-v2/native-producer/conditional-
// termination-fee-value.js's buildConditionalTerminationFeeValue builds and
// resolveModivConditionalFees (modiv-termination-fee-source-parser.js)
// produces, but which had no table anywhere in supabase/canonical-v2-
// foundation.sql -- two of the ten cards a termination-fee run projects,
// including the Modiv headline number, came from it. DECISIONS.md decision
// 3, ruled by Ben 2026-08-07: give it a table.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');

test('the table exists, has no closure_id, and matches the JS builder\'s enums', () => {
  const tableStart = sql.indexOf(
    'CREATE TABLE IF NOT EXISTS canonical_v2_staging.conditional_termination_fee_values (',
  );
  assert.notEqual(tableStart, -1, 'the table must exist');
  const tableEnd = sql.indexOf(');', tableStart);
  const table = sql.slice(tableStart, tableEnd);

  assert.match(table, /conditional_termination_fee_value_id text PRIMARY KEY/);
  assert.match(table, /conditional_termination_fee_value_id ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.doesNotMatch(
    table,
    /closure_id/,
    'this kind carries no closure_id in lib/canonical-v2/native-producer/conditional-termination-fee-value.js -- the table must not invent one',
  );
  assert.match(table, /fee_side text NOT NULL CHECK \(fee_side IN \('SELLER', 'BUYER'\)\)/);
  assert.match(
    table,
    /triggering_branch text NOT NULL CHECK \(triggering_branch IN \(\s*'7\.3\(b\)\(i\)', '7\.3\(b\)\(ii\)', '7\.3\(b\)\(iii\)', '7\.3\(b\)\(iv\)', '7\.3\(b\)\(v\)', '7\.3\(c\)'\s*\)\)/,
  );
  // PLAN.md Step 2C1: the deal-scoping column this table had none of at
  // all -- Step 2C's serving read a second-deal-less table with no WHERE
  // clause, and Step 2D would have made that silently mix deals' fee
  // amounts. Populated from the write-set's own deal.document_hash, never
  // from canonical_payload -- this kind's 11-key schema has no document_hash
  // field to read one from.
  assert.match(table, /document_hash text NOT NULL CHECK \(document_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(table, /canonical_payload jsonb NOT NULL/);
  assert.match(
    table,
    /canonical_payload_digest text GENERATED ALWAYS AS \(\s*canonical_v2_staging\.payload_digest\(canonical_payload\)\s*\) STORED/,
  );
});

test('row-level security is enabled on the new table like every sibling table', () => {
  assert.match(
    sql,
    /ALTER TABLE canonical_v2_staging\.conditional_termination_fee_values ENABLE ROW LEVEL SECURITY;/,
  );
});

test('DEAL_SCOPE_RUN accepts conditional_termination_fee_values as an OPTIONAL key, not a required one', () => {
  const branchStart = sql.indexOf("IF p_operation = 'DEAL_SCOPE_RUN' THEN");
  const gateEnd = sql.indexOf(
    "RAISE EXCEPTION 'DEAL_SCOPE_RUN write set must match the closed reference-only contract'",
    branchStart,
  );
  const gate = sql.slice(branchStart, gateEnd);

  const requiredArrayStart = gate.indexOf('p_write_set ?& ARRAY[');
  const requiredArrayEnd = gate.indexOf('])', requiredArrayStart);
  const requiredArray = gate.slice(requiredArrayStart, requiredArrayEnd);
  assert.doesNotMatch(
    requiredArray,
    /conditional_termination_fee_values/,
    'conditional_termination_fee_values must not be in the REQUIRED (?&) key list -- most deals never produce it',
  );

  const subtractionArrayStart = gate.indexOf('p_write_set - ARRAY[');
  const subtractionArrayEnd = gate.indexOf(']::text[]', subtractionArrayStart);
  const subtractionArray = gate.slice(subtractionArrayStart, subtractionArrayEnd);
  assert.match(
    subtractionArray,
    /'persisted_object_references', 'conditional_termination_fee_values'/,
    'conditional_termination_fee_values must be an allowed OPTIONAL key, alongside persisted_object_references',
  );
});

test('the shape check mirrors buildConditionalTerminationFeeValue\'s exact 11-key contract and every field constraint', () => {
  const checkStart = sql.indexOf(
    'supplied_conditional_termination_fee_values AS (',
  );
  assert.notEqual(checkStart, -1);
  const checkEnd = sql.indexOf(
    "RAISE EXCEPTION 'DEAL_SCOPE_RUN conditional termination fee value shape is invalid'",
    checkStart,
  );
  const check = sql.slice(checkStart, checkEnd);

  // The exact 11-key contract, sourced from lib/canonical-v2/native-
  // producer/conditional-termination-fee-value.js's `required` array plus
  // schema_version and the id itself.
  for (const key of [
    'schema_version', 'fee_side', 'triggering_branch', 'base_amount',
    'currency', 'operator', 'reit_limit_cap_term_ref', 'defined_term_lineage',
    'source_citations', 'raw_formula', 'conditional_termination_fee_value_id',
  ]) {
    assert.match(check, new RegExp(`'${key}'`), `shape check must require key ${key}`);
  }
  // Extra-key hole guard: both a required-key membership check (?&) and a
  // closed-key subtraction check (- ARRAY[...] = '{}') must be present, the
  // same pattern the STRUCTURAL_PROVISION_INSTANCE/V1 branch (Step 4A1)
  // uses -- an exact key-set check that refuses extra keys as well as
  // missing ones.
  assert.match(check, /conditional_fee \?& ARRAY\[/);
  assert.match(check, /conditional_fee - ARRAY\[[\s\S]*?\]::text\[\] = '\{\}'::jsonb/);

  assert.match(check, /schema_version'\s*=\s*'CONDITIONAL_TERMINATION_FEE_VALUE\/V1'/);
  assert.match(check, /'fee_side' IN \('SELLER', 'BUYER'\)/);
  assert.match(
    check,
    /'triggering_branch' IN \(\s*'7\.3\(b\)\(i\)', '7\.3\(b\)\(ii\)', '7\.3\(b\)\(iii\)', '7\.3\(b\)\(iv\)',\s*'7\.3\(b\)\(v\)', '7\.3\(c\)'\s*\)/,
  );
  assert.match(check, /'base_amount' ~ '\^\[0-9\]\+\(\\\.\[0-9\]\+\)\?\$'/);
  assert.match(check, /'currency' = 'USD'/);
  assert.match(check, /'operator' = 'LOWER_OF'/);
  assert.match(check, /jsonb_array_length\(\s*supplied\.conditional_fee->'defined_term_lineage'\s*\) >= 2/);
  assert.match(check, /jsonb_array_length\(supplied\.conditional_fee->'source_citations'\)\s*>= 2/);
});

test('identity is recomputed inside the database, guarded so it only runs on an already-valid shape', () => {
  const identityCheckStart = sql.indexOf(
    "WHERE CASE\n        WHEN supplied.shape_valid THEN\n          supplied.conditional_fee->>'conditional_termination_fee_value_id'",
  );
  assert.notEqual(
    identityCheckStart,
    -1,
    'the identity recompute must be guarded by a CASE WHEN shape_valid, matching this file\'s established defensive pattern for content_id() calls on possibly-malformed input',
  );
  const identityCheckEnd = sql.indexOf(
    "RAISE EXCEPTION 'DEAL_SCOPE_RUN conditional termination fee value shape is invalid'",
    identityCheckStart,
  );
  const identityCheck = sql.slice(identityCheckStart, identityCheckEnd);
  assert.match(
    identityCheck,
    /canonical_v2_staging\.content_id\(\s*'CONDITIONAL_TERMINATION_FEE_VALUE\/V1',\s*supplied\.conditional_fee - 'conditional_termination_fee_value_id'\s*\)/,
  );
  assert.match(identityCheck, /ELSE true\s*END/);
});

test('a duplicate conditional_termination_fee_value_id is refused with its own message', () => {
  assert.match(
    sql,
    /RAISE EXCEPTION 'DEAL_SCOPE_RUN contains duplicate conditional termination fee values'/,
  );
});

test('conditional_termination_fee_values is excluded from every generic closure-keyed loop, not silently folded in', () => {
  // This kind has no closure_id (see the table-definition test above), so
  // every loop in the DEAL_SCOPE_RUN branch that assumes one -- persisted-
  // reference overlap, the advisory-lock closure collection, duplicate/
  // malformed-object detection, and residual/quarantine reconciliation --
  // must name it alongside source_references/deal/persisted_object_
  // references rather than iterate over it. Silently including it in one of
  // those loops would make that loop's own WHERE clause evaluate to NULL
  // (not TRUE) for every conditional-fee row, which passes vacuously
  // instead of validating anything -- worse than no check, because it reads
  // as covered.
  const genericLoopOccurrences = [
    ...sql.matchAll(/collection\.key NOT IN \(\s*'source_references', 'deal', 'persisted_object_references'(, 'conditional_termination_fee_values')?\s*\)/g),
  ];
  assert.ok(genericLoopOccurrences.length >= 9, 'expected at least 9 occurrences of the generic exclusion-list literal');
  const missing = genericLoopOccurrences.filter((match) => !match[1]);
  assert.equal(
    missing.length,
    0,
    `${missing.length} generic closure-keyed loop(s) do not exclude conditional_termination_fee_values`,
  );
});

test('the publishable-object-count sum still counts conditional_termination_fee_values (it is a real write, not a reference)', () => {
  const countSum = sql.slice(
    sql.indexOf('INTO publishable_object_count'),
    sql.indexOf('INTO publishable_object_count') + 400,
  );
  assert.match(
    countSum,
    /WHERE key NOT IN \('source_references', 'deal', 'persisted_object_references', 'publication_dispositions', 'publication_calibration_authorities'\);/,
    'the publishable-object-count exclusion list must exclude immutable publication sidecars but count conditional_termination_fee_values, which is a real write rather than a reference',
  );
});

test('the INSERT loop denormalises fee_side, triggering_branch and document_hash and orders by the primary key like its siblings', () => {
  const loopStart = sql.indexOf(
    "FROM jsonb_array_elements(\n      coalesce(p_write_set->'conditional_termination_fee_values', '[]'::jsonb)\n    ) AS ordered_item(value)",
  );
  assert.notEqual(loopStart, -1);
  const loopEnd = sql.indexOf('END LOOP;', loopStart);
  const loop = sql.slice(loopStart, loopEnd);
  assert.match(
    loop,
    /INSERT INTO canonical_v2_staging\.conditional_termination_fee_values\(\s*conditional_termination_fee_value_id, fee_side, triggering_branch, document_hash, canonical_payload\s*\) VALUES \(\s*item_id, item->>'fee_side', item->>'triggering_branch',\s*p_write_set->'deal'->>'document_hash', item\s*\) ON CONFLICT \(conditional_termination_fee_value_id\) DO NOTHING;/,
  );
  assert.match(loop, /'canonical conditional termination fee value identity conflict'/);
});

// PLAN.md Step 2C1. document_hash is not part of this kind's content-
// addressed id (see the table-definition test above), so two DIFFERENT
// deals that happened to produce a byte-identical row would otherwise
// collide on the primary key and ON CONFLICT DO NOTHING would silently
// keep the FIRST deal's document_hash on a row the second deal also wrote
// -- exactly the cross-deal leakage this step exists to close, at the
// write boundary rather than the read one. The identity-conflict guard
// must therefore check document_hash equality alongside the payload
// digest, on both the pre-INSERT short-circuit and the post-INSERT
// verification.
test('the identity-conflict guard also checks document_hash, not only the payload digest', () => {
  const loopStart = sql.indexOf(
    "FROM jsonb_array_elements(\n      coalesce(p_write_set->'conditional_termination_fee_values', '[]'::jsonb)\n    ) AS ordered_item(value)",
  );
  assert.notEqual(loopStart, -1);
  const loopEnd = sql.indexOf('END LOOP;', loopStart);
  const loop = sql.slice(loopStart, loopEnd);
  const documentHashChecks = [
    ...loop.matchAll(/existing_document_hash IS DISTINCT FROM \(p_write_set->'deal'->>'document_hash'\)/g),
  ];
  assert.ok(
    documentHashChecks.length >= 2,
    'expected the document_hash cross-check both before and after the INSERT, like the payload-digest check it sits beside',
  );
});
