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
const excerptFailure = branch.indexOf(
  'DEAL_SCOPE_RUN excerpt identity or source bytes are invalid',
);
const provisionFailure = branch.indexOf(
  'DEAL_SCOPE_RUN provision identity or source lineage is invalid',
);
const firstClosureLock = branch.indexOf('PERFORM pg_advisory_xact_lock');

test('DEAL_SCOPE_RUN binds excerpts to the frozen definition and admitted bytes', () => {
  assert.notEqual(branchStart, -1);
  assert.notEqual(firstSemanticInsert, -1);
  assert.ok(excerptFailure > 0);
  assert.ok(excerptFailure < provisionFailure);
  assert.ok(excerptFailure < firstClosureLock);

  const excerptBranch = branch.slice(
    branch.lastIndexOf('IF EXISTS (', excerptFailure),
    excerptFailure,
  );
  assert.match(excerptBranch, /'EXCERPT_DEFINITION\/V1'/);
  assert.match(excerptBranch, /'EXCERPT_DEFINITION_PAYLOAD\/V1'/);
  assert.match(excerptBranch, /'SINGLE_OPERATIVE_SPAN'/);
  assert.match(excerptBranch, /'PRIMARY'/);
  assert.match(excerptBranch, /'LEGAL_EVIDENCE'/);
  assert.match(excerptBranch, /'IDENTITY_UTF8\/V1'/);
  assert.match(excerptBranch, /'ADMITTED_SOURCE_OCCURRENCE_KEY\/V1'/);
  assert.match(excerptBranch, /'SOURCE_OCCURRENCE\/V1'/);
  assert.match(excerptBranch, /'SEMANTIC_SPAN\/V1'/);
  assert.match(excerptBranch, /'EXCERPT\/V1'/);
  assert.match(excerptBranch, /extensions\.digest\(/);
  assert.match(excerptBranch, /pg_catalog\.convert_from\(/);
  assert.match(
    excerptBranch,
    /supplied\.absolute_start < supplied\.absolute_end\s+AND \(/,
  );
});

test('new and retained excerpt rows share one closed set-based validator', () => {
  const excerptBranch = branch.slice(
    branch.lastIndexOf('IF EXISTS (', excerptFailure),
    excerptFailure,
  );
  assert.match(
    excerptBranch,
    /jsonb_array_elements\(p_write_set->'excerpts'\)/,
  );
  assert.match(
    excerptBranch,
    /persisted\.reference->>'object_kind' = 'excerpts'/,
  );
  assert.match(excerptBranch, /supplied\.excerpt - ARRAY\[/);
  assert.match(
    branch.slice(excerptFailure, firstClosureLock),
    /USING ERRCODE = '23514'/,
  );
  assert.doesNotMatch(excerptBranch, /\bFOR\s+\w+\s+IN\b/);
});
