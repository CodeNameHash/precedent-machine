// Step 4A1 (docs/core/PLAN.md). Regression test for the SQL writer's
// DEAL_SCOPE_RUN provision shape check.
//
// This repository's existing SQL-source tests
// (tests/canonical-v2-writer-structure-identity-sql.test.js and siblings)
// pattern-match fragments of supabase/canonical-v2-foundation.sql rather
// than executing it, because CI has no live Postgres. This test follows
// that same convention. The claim it actually did not run until executed
// against a real container is recorded, with a live-execution
// reproduction, in docs/codex-program/notes/step-4a1-partyless-provisions.md
// -- do not read a pass here as proof the fix works against Postgres.
//
// What this guards against: lib/canonical-v2/source-structure.js builds
// two provision kinds -- PROVISION_INSTANCE/V1 (names a party) and
// STRUCTURAL_PROVISION_INSTANCE/V1 (the same shape with `party` absent),
// both accepted by lib/canonical-v2/validate-write-set.js. Before Step 4A1,
// the SQL DEAL_SCOPE_RUN provision check recognised only the first, so
// CONSIDERATION, MERGER_STRUCTURE_CLOSING, MISC_BOILERPLATE, PROXY_MEETING,
// DNO_INDEMNIFICATION (and TERMINATION_FEE's structural rows) could never
// be imported -- see step-4a1-partyless-provisions.md for the durable
// six-family proof.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const branchStart = sql.indexOf("IF p_operation = 'DEAL_SCOPE_RUN' THEN");
const firstSemanticInsert = sql.indexOf(
  'INSERT INTO canonical_v2_staging.deals',
  branchStart,
);
const branch = sql.slice(branchStart, firstSemanticInsert);

const shapeFailure = branch.indexOf('DEAL_SCOPE_RUN provision shape is invalid');
const lineageFailure = branch.indexOf(
  'DEAL_SCOPE_RUN provision identity or source lineage is invalid',
);

test('DEAL_SCOPE_RUN raises a distinct message for a provision shape rejection than for a lineage rejection', () => {
  assert.notEqual(branchStart, -1);
  assert.notEqual(shapeFailure, -1, 'the shape-specific failure message must exist');
  assert.notEqual(lineageFailure, -1, 'the lineage-specific failure message must exist');
  assert.notEqual(shapeFailure, lineageFailure, 'the two messages must be textually distinct');
  assert.ok(
    shapeFailure < lineageFailure,
    'the shape check must be evaluated and able to raise before the lineage check is ever reached',
  );
});

test('the provision shape check recognises STRUCTURAL_PROVISION_INSTANCE/V1 with its own closed key set, party absent', () => {
  const shapeBlock = branch.slice(0, shapeFailure);
  assert.match(shapeBlock, /STRUCTURAL_PROVISION_INSTANCE\/V1/);

  const structuralBranchStart = shapeBlock.indexOf(
    "supplied.provision->>'schema_version' = 'STRUCTURAL_PROVISION_INSTANCE/V1'",
  );
  assert.notEqual(structuralBranchStart, -1);
  const partyBearingBranchStart = shapeBlock.indexOf('ELSE (', structuralBranchStart);
  assert.notEqual(partyBearingBranchStart, -1);
  const structuralBranch = shapeBlock.slice(structuralBranchStart, partyBearingBranchStart);

  // The exact 11-key structural contract, sourced from
  // lib/canonical-v2/validate-write-set.js's STRUCTURAL_PROVISION_INSTANCE_KEYS.
  for (const key of [
    'schema_version', 'source_occurrence_id', 'canonical_text_id',
    'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
    'ordinal', 'source_anchor_id', 'provision_instance_id', 'closure_id',
  ]) {
    assert.match(structuralBranch, new RegExp(`'${key}'`), `structural branch must require key ${key}`);
  }
  assert.doesNotMatch(
    structuralBranch,
    /'party'/,
    'the structural branch must not reference party at all',
  );
});

test('the party-bearing provision branch is not relaxed: party remains required, closed and non-empty', () => {
  const shapeBlock = branch.slice(0, shapeFailure);
  const partyBearingBranchStart = shapeBlock.lastIndexOf('ELSE (');
  assert.notEqual(partyBearingBranchStart, -1);
  const partyBearingBranch = shapeBlock.slice(partyBearingBranchStart);

  assert.match(partyBearingBranch, /supplied\.provision->>'schema_version' = 'PROVISION_INSTANCE\/V1'/);
  for (const key of [
    'schema_version', 'source_occurrence_id', 'canonical_text_id',
    'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
    'party', 'ordinal', 'source_anchor_id', 'provision_instance_id', 'closure_id',
  ]) {
    assert.match(partyBearingBranch, new RegExp(`'${key}'`), `party-bearing branch must require key ${key}`);
  }
  assert.match(
    partyBearingBranch,
    /jsonb_typeof\(supplied\.provision->'party'\) = 'object'/,
  );
  assert.match(
    partyBearingBranch,
    /supplied\.provision->'party' \?& ARRAY\['role', 'value', 'capacity'\]/,
  );
  for (const field of ['role', 'value', 'capacity']) {
    assert.match(
      partyBearingBranch,
      new RegExp(`coalesce\\(length\\(supplied\\.provision->'party'->>'${field}'\\), 0\\) > 0`),
      `party.${field} must still be required non-empty`,
    );
  }
});

test('the lineage check recomputes provision_instance_id with a structural branch that omits party from the hashed payload', () => {
  const lineageBlock = branch.slice(shapeFailure, lineageFailure);
  assert.match(lineageBlock, /is_structural/);
  assert.match(
    lineageBlock,
    /WHEN supplied\.is_structural THEN 'STRUCTURAL_PROVISION_INSTANCE\/V1'/,
  );
  const structuralPayloadStart = lineageBlock.indexOf(
    'WHEN supplied.is_structural THEN jsonb_build_object(',
  );
  const partyBearingPayloadStart = lineageBlock.indexOf('ELSE jsonb_build_object(', structuralPayloadStart);
  assert.notEqual(structuralPayloadStart, -1);
  assert.notEqual(partyBearingPayloadStart, -1);
  const structuralPayload = lineageBlock.slice(structuralPayloadStart, partyBearingPayloadStart);
  assert.doesNotMatch(
    structuralPayload,
    /'party'/,
    'the structural identity payload must not include party -- source-structure.js never hashes it',
  );
  const partyBearingPayload = lineageBlock.slice(partyBearingPayloadStart);
  assert.match(
    partyBearingPayload,
    /'party', supplied\.provision->'party'/,
    'the party-bearing identity payload must still include party, unchanged',
  );
});
