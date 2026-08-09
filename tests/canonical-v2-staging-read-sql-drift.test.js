'use strict';

// PLAN.md Step 2B2. The mandatory drift test the ruling names: reads the
// COMMITTED supabase/canonical-v2-staging-read.sql text and asserts its two
// governance-boundary literals equal the REAL JS constants they must never
// drift from, not a hand-typed second copy of the same string. Two copies
// of one predicate that can move independently is exactly what produced the
// defect this file closes (see open-world-evidence-serving.js's header: the
// marker-absence check accepted a QXO-era NOVEL_CONCEPT_CANDIDATE/V1 row on
// 2026-08-07 because the positive check had not yet been written anywhere).
//
// This test does NOT merely check the strings appear somewhere in the SQL
// file -- both literals also appear throughout this file's own prose
// comments, so a naive `sql.includes(...)` would pass even if the WHERE
// clause itself were wrong or missing. It extracts each function's actual
// body (between its own `AS $$ ... $$;`) and reads the literal out of the
// predicate, so a broken or deleted predicate fails this test even though
// the comment mentioning the right string is still sitting three lines
// above it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CLAIM_REVISION_SCHEMA } = require('../lib/canonical-v2/open-world-evidence-serving');
const { OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');

const SQL_PATH = path.join(__dirname, '..', 'supabase', 'canonical-v2-staging-read.sql');
const sqlText = fs.readFileSync(SQL_PATH, 'utf8');
// This file's own header comment discusses CREATE POLICY, FORCE ROW LEVEL
// SECURITY and table grants extensively in prose (explaining why none of
// them are used) -- so a check for their presence must look at CODE, not at
// a file that mentions them while correctly not doing them. Strip every
// `--`-prefixed line before testing for the real thing.
const sqlWithoutLineComments = sqlText
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

function extractFunctionBody(functionName) {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(`;
  const startIndex = sqlText.indexOf(marker);
  assert.notEqual(startIndex, -1, `${functionName} not found in ${SQL_PATH}`);
  const bodyStart = sqlText.indexOf('AS $$', startIndex);
  assert.notEqual(bodyStart, -1, `${functionName} has no AS $$ body`);
  const bodyEnd = sqlText.indexOf('$$;', bodyStart);
  assert.notEqual(bodyEnd, -1, `${functionName} body is not terminated with $$;`);
  return sqlText.slice(bodyStart, bodyEnd);
}

test('the SQL file exists and is non-empty (a missing/empty file must fail loud here, not pass by finding nothing)', () => {
  assert.ok(sqlText.length > 1000, `expected a substantial SQL file, got ${sqlText.length} bytes`);
});

test('CLAIM_REVISION_SCHEMA is a real, non-empty string (this test is worthless against an accidentally emptied constant)', () => {
  assert.equal(typeof CLAIM_REVISION_SCHEMA, 'string');
  assert.ok(CLAIM_REVISION_SCHEMA.length > 0);
});

test('OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER is a real, non-empty string', () => {
  assert.equal(typeof OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER, 'string');
  assert.ok(OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER.length > 0);
});

test('canonical_v2_staging_read_claim_revisions carries the POSITIVE CLAIM_REVISION_SCHEMA predicate, matching the real JS constant', () => {
  const body = extractFunctionBody('canonical_v2_staging_read_claim_revisions');
  const match = /canonical_payload->>'schema_version'\s*=\s*'([^']+)'/.exec(body);
  assert.ok(match, 'canonical_v2_staging_read_claim_revisions has no schema_version predicate -- '
    + 'the positive governed-claim check this ruling requires is missing');
  assert.equal(
    match[1],
    CLAIM_REVISION_SCHEMA,
    `SQL predicate literal ('${match[1]}') has drifted from open-world-evidence-serving.js's `
    + `CLAIM_REVISION_SCHEMA ('${CLAIM_REVISION_SCHEMA}') -- update supabase/canonical-v2-staging-read.sql `
    + 'to match',
  );
});

// The three open-world functions -- candidates, occurrences, evidence
// references -- each carry their own copy of the same predicate (SQL has no
// shared-constant mechanism across three separate WHERE clauses the way JS
// does), so each is checked independently. A QXO-era NOVEL_CONCEPT_CANDIDATE/V1
// row, which by design never carries this field, must fail every one of
// these three predicates -- proven directly against real Postgres in
// scripts/canonical-v2-staging-read-hosted-grant-boundary-proof.js's sibling
// live proof, not repeated here since this test is hermetic by design.
for (const functionName of [
  'canonical_v2_staging_read_open_world_candidates',
  'canonical_v2_staging_read_open_world_candidate_occurrences',
  'canonical_v2_staging_read_open_world_evidence_references',
]) {
  test(`${functionName} carries the POSITIVE evidence_governance predicate, matching the real JS constant`, () => {
    const body = extractFunctionBody(functionName);
    const match = /canonical_payload->>'evidence_governance'\s*=\s*'([^']+)'/.exec(body);
    assert.ok(match, `${functionName} has no evidence_governance predicate -- the positive open-world `
      + 'check this ruling requires is missing');
    assert.equal(
      match[1],
      OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
      `SQL predicate literal ('${match[1]}') has drifted from native-write-set-adapter.js's `
      + `OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER ('${OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER}') -- update `
      + 'supabase/canonical-v2-staging-read.sql to match',
    );
  });
}

test('the two literals are not accidentally the same string (a drift test that could never fail is not a test)', () => {
  assert.notEqual(CLAIM_REVISION_SCHEMA, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
});

// ── The grant boundary this file's own header claims: read it mechanically
// rather than trusting the prose. ──

test('every canonical_v2_staging_read_* function REVOKEs from PUBLIC, anon, authenticated, service_role, '
  + 'canonical_v2_writer AND canonical_v2_serving before granting to canonical_v2_staging_reader', () => {
  const functionNames = [
    'canonical_v2_staging_read_provision_instances',
    'canonical_v2_staging_read_provision_components',
    'canonical_v2_staging_read_claim_revisions',
    'canonical_v2_staging_read_relationship_revisions',
    'canonical_v2_staging_read_open_world_candidates',
    'canonical_v2_staging_read_open_world_candidate_occurrences',
    'canonical_v2_staging_read_open_world_evidence_references',
    'canonical_v2_staging_read_conditional_termination_fee_values',
    'canonical_v2_staging_read_claim_publication_dispositions',
  ];
  for (const functionName of functionNames) {
    const revokeMatch = new RegExp(
      `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^)]*\\)\\s*\\n\\s*FROM PUBLIC, anon, authenticated, `
      + 'service_role, canonical_v2_writer, canonical_v2_serving;',
    ).test(sqlText);
    assert.ok(revokeMatch, `${functionName} is missing its full REVOKE (PUBLIC, anon, authenticated, `
      + 'service_role, canonical_v2_writer, canonical_v2_serving)');
    const grantMatch = new RegExp(
      `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([^)]*\\)\\s*\\n\\s*TO canonical_v2_staging_reader;`,
    ).test(sqlText);
    assert.ok(grantMatch, `${functionName} is missing its GRANT EXECUTE ... TO canonical_v2_staging_reader`);
  }
});

test('publication disposition RPC uses one named immutable decision id, never a set, clock, or latest-state selector', () => {
  const functionText = sqlText.slice(
    sqlText.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_claim_publication_dispositions('),
    sqlText.indexOf('$$;', sqlText.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_staging_read_claim_publication_dispositions(')) + 3,
  );
  const body = extractFunctionBody('canonical_v2_staging_read_claim_publication_dispositions');
  assert.match(functionText, /p_claim_revision_ids text\[\], p_decision_id text/);
  assert.match(body, /row\.decision_id\s*=\s*ANY\(canonical_v2_staging\.staging_read_id_array\(ARRAY\[p_decision_id\]\)\)/);
  assert.doesNotMatch(functionText, /disposition_set_id|latest|now\s*\(|current_timestamp/i);
});

test('the SQL file introduces no CREATE POLICY and no FORCE ROW LEVEL SECURITY -- the ruling\'s hard constraint '
  + '(checked against the code, with comments stripped, since this file\'s own header discusses both in prose)', () => {
  assert.equal(/CREATE POLICY/i.test(sqlWithoutLineComments), false, 'this file must not introduce any RLS policy');
  assert.equal(
    /FORCE ROW LEVEL SECURITY/i.test(sqlWithoutLineComments),
    false,
    'this file must not force row level security',
  );
  assert.equal(
    /\bGRANT\b[^;]*\bON\s+(TABLE|ALL TABLES)\b/i.test(sqlWithoutLineComments),
    false,
    'this file must not grant any table privilege',
  );
});

test('the new role is NOLOGIN, mirroring canonical_v2_writer and canonical_v2_serving', () => {
  assert.match(sqlText, /CREATE ROLE canonical_v2_staging_reader NOLOGIN;/);
});
