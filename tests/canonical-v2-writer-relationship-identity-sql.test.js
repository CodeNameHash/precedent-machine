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
const claimFailure = branch.indexOf(
  'DEAL_SCOPE_RUN claim identity, state or evidence lineage is invalid',
);
const relationshipFailure = branch.indexOf(
  'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid',
);
const firstClosureLock = branch.indexOf('PERFORM pg_advisory_xact_lock');
const relationshipBranch = branch.slice(claimFailure, relationshipFailure);

test('DEAL_SCOPE_RUN recomputes all relationship content identities', () => {
  assert.ok(claimFailure < relationshipFailure);
  assert.ok(relationshipFailure < firstClosureLock);
  for (const domain of [
    'RELATIONSHIP_OCCURRENCE/V1',
    'RELATIONSHIP_EVIDENCE/V1',
    'RELATIONSHIP_REVISION/V1',
  ]) {
    assert.match(
      relationshipBranch,
      new RegExp(`content_id\\(\\s*'${domain.replace('/', '\\/')}'`),
      `${domain} must be recomputed before DML`,
    );
  }

  const collapsed = relationshipBranch.replace(/\s+/g, ' ');
  for (const pair of [
    "'relationship_occurrence_id', relationship.relationship->'relationship_occurrence_id'",
    "'source_occurrence_id', relationship.relationship->'source_occurrence_id'",
    "'relationship_definition_key', relationship.relationship->'relationship_definition_key'",
    "'relationship_definition_version', relationship.relationship ->'relationship_definition_version'",
    "'ordinal', relationship.relationship->'ordinal'",
    "'state', relationship.relationship->'state'",
    "'target_occurrence_ids', relationship.relationship->'target_occurrence_ids'",
    "'effect', relationship.relationship->'effect'",
    "'evidence_ids', relationship.relationship->'evidence_ids'",
    "'resolver_version', relationship.relationship->'resolver_version'",
  ]) {
    assert.ok(collapsed.includes(pair), `missing relationship identity pair ${pair}`);
  }
});

test('relationship validation resolves bounded endpoints and exact evidence lineage', () => {
  assert.match(
    relationshipBranch,
    /stored\.canonical_payload[\s\S]*relationship_revisions stored/,
  );
  assert.match(relationshipBranch, /available_occurrences/);
  assert.match(relationshipBranch, /available_excerpts/);
  assert.match(relationshipBranch, /resolved_relationship_targets/);
  assert.match(relationshipBranch, /resolved_relationship_evidence/);
  assert.match(
    relationshipBranch,
    /evidence\.edge->'absolute_start'\s+IS DISTINCT FROM evidence\.excerpt_absolute_start/,
  );
  assert.match(
    relationshipBranch,
    /evidence\.edge->'absolute_end'\s+IS DISTINCT FROM evidence\.excerpt_absolute_end/,
  );
  assert.match(
    relationshipBranch,
    /evidence\.edge->>'excerpt_id' COLLATE "C",\s*evidence\.edge_array_ordinal/,
  );
  assert.match(relationshipBranch, /9007199254740991/);
  assert.ok((relationshipBranch.match(/<= 4096/g) || []).length >= 7);
  assert.doesNotMatch(relationshipBranch, /\bFOR\s+\w+\s+IN\b/);
});

test('relationship publication states fail closed before locks and DML', () => {
  for (const state of [
    'PRESENT',
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ]) assert.match(relationshipBranch, new RegExp(`'${state}'`));
  assert.match(relationshipBranch, /publication_state' = 'VALIDATED'/);
  assert.match(relationshipBranch, /retained_residuals' = '\[\]'::jsonb/);
  assert.match(relationshipBranch, /quarantine' = 'null'::jsonb/);
  assert.match(relationshipBranch, /required_interval_ids/);
  assert.match(relationshipBranch, /source_fact_ids/);
  assert.match(relationshipBranch, /attempted_extractor/);
  assert.match(
    relationshipBranch,
    /'effect_mode'\s+NOT IN \('NON_SEMANTIC', 'TYPED_LEGAL_EFFECT'\)/,
  );
  assert.match(relationshipBranch, /'effect'->'legal_operation'/);
  assert.match(branch.slice(relationshipFailure, firstClosureLock), /USING ERRCODE = '23514'/);
});
