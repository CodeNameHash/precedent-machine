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
const componentFailure = branch.indexOf(
  'DEAL_SCOPE_RUN component identity or parent lineage is invalid',
);
const claimFailure = branch.indexOf(
  'DEAL_SCOPE_RUN claim identity, state or evidence lineage is invalid',
);
const firstClosureLock = branch.indexOf('PERFORM pg_advisory_xact_lock');
const claimBranch = branch.slice(componentFailure, claimFailure);

test('DEAL_SCOPE_RUN recomputes claim occurrence, revision and evidence identities', () => {
  assert.notEqual(branchStart, -1);
  assert.notEqual(firstSemanticInsert, -1);
  assert.ok(componentFailure < claimFailure);
  assert.ok(claimFailure < firstClosureLock);

  for (const domain of [
    'CLAIM_OCCURRENCE/V1',
    'CLAIM_REVISION/V1',
    'CLAIM_EVIDENCE/V1',
  ]) {
    assert.match(
      claimBranch,
      new RegExp(`content_id\\(\\s*'${domain.replace('/', '\\/')}'`),
      `${domain} must be recomputed before DML`,
    );
  }

  for (const pair of [
    "'claim_occurrence_id', claim.claim->'claim_occurrence_id'",
    "'subject_occurrence_id', claim.claim->'subject_occurrence_id'",
    "'claim_definition_key', claim.claim->'claim_definition_key'",
    "'claim_definition_version', claim.claim->'claim_definition_version'",
    "'ordinal', claim.claim->'ordinal'",
    "'state', claim.claim->'state'",
    "'evidence_ids', claim.claim->'evidence_ids'",
    "'denominator', claim.claim->'denominator'",
    "'derivation_version', claim.claim->'derivation_version'",
  ]) {
    assert.ok(
      claimBranch.replace(/\s+/g, ' ').includes(pair),
      `missing claim revision identity pair ${pair}`,
    );
  }
});

test('claim validation is closed, set-based and reference-complete', () => {
  assert.match(claimBranch, /stored\.canonical_payload[\s\S]*claim_revisions stored/);
  assert.match(claimBranch, /supplied\.claim - ARRAY\[/);
  assert.match(claimBranch, /evidence\.edge - ARRAY\[/);
  assert.match(claimBranch, /available_subjects/);
  assert.match(claimBranch, /available_excerpts/);
  assert.match(claimBranch, /admitted_source_ordinal/);
  assert.match(claimBranch, /evidence\.edge->'absolute_start'\s+IS DISTINCT FROM evidence\.excerpt_absolute_start/);
  assert.match(claimBranch, /evidence\.edge->'absolute_end'\s+IS DISTINCT FROM evidence\.excerpt_absolute_end/);
  assert.match(claimBranch, /source_lineage_ids/);
  assert.match(claimBranch, /DERIVATION_INPUT/);
  assert.match(
    claimBranch,
    /jsonb_array_length\(claim\.claim->'evidence'\) <= 4096/,
  );
  assert.match(
    claimBranch,
    /evidence\.edge->>'excerpt_id' COLLATE "C",\s*evidence\.edge_array_ordinal/,
  );
  assert.match(claimBranch, /9007199254740991/);
  assert.match(branch.slice(claimFailure, firstClosureLock), /USING ERRCODE = '23514'/);
  assert.doesNotMatch(claimBranch, /\bFOR\s+\w+\s+IN\b/);
});

test('claim state publication rules fail closed before closure locks', () => {
  for (const state of [
    'PRESENT',
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ]) assert.match(claimBranch, new RegExp(`'${state}'`));
  assert.match(claimBranch, /publication_state' = 'VALIDATED'/);
  assert.match(claimBranch, /retained_residuals' = '\[\]'::jsonb/);
  assert.match(claimBranch, /quarantine' = 'null'::jsonb/);
  assert.match(claimBranch, /required_interval_ids/);
  assert.match(claimBranch, /examined_interval_ids/);
  assert.match(claimBranch, /source_fact_ids/);
  assert.match(claimBranch, /attempted_extractor/);
  assert.match(
    claimBranch,
    /jsonb_typeof\(\s*claim\.claim->'applicability'->'rule'\s*\) <> 'string'/,
  );
  assert.match(
    claimBranch,
    /jsonb_typeof\(\s*claim\.claim->'not_examined'->'reason'\s*\) <> 'string'/,
  );
  assert.match(
    claimBranch,
    /jsonb_typeof\(\s*claim\.claim->'failure'->'failure_code'\s*\) <> 'string'/,
  );
  assert.ok((claimBranch.match(/> 4096/g) || []).length >= 3);
});
