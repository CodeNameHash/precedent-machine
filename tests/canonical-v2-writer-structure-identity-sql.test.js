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
const componentFailure = branch.indexOf(
  'DEAL_SCOPE_RUN component identity or parent lineage is invalid',
);
const firstClosureLock = branch.indexOf('PERFORM pg_advisory_xact_lock');

function requireBeforeInsert(pattern, label) {
  const match = pattern.exec(branch);
  assert.ok(match, `${label} must be recomputed in DEAL_SCOPE_RUN`);
  assert.ok(match.index < branch.length, `${label} must precede semantic DML`);
  return match.index;
}

test('DEAL_SCOPE_RUN recomputes the source-anchored structural identity chain', () => {
  assert.notEqual(branchStart, -1);
  assert.notEqual(firstSemanticInsert, -1);
  assert.notEqual(provisionFailure, -1);
  assert.notEqual(componentFailure, -1);

  requireBeforeInsert(
    /content_id\(\s*'ADMITTED_SOURCE_OCCURRENCE_KEY\/V1',\s*jsonb_build_object\(\s*'deal_admission_id', reference\.value->'deal_admission_id',\s*'source_ordinal', reference\.value->'source_ordinal',\s*'immutable_source_document_id',\s*reference\.value->'immutable_source_document_id'\s*\)\s*\)/,
    'admitted source occurrence key',
  );
  requireBeforeInsert(
    /content_id\(\s*'SOURCE_OCCURRENCE\/V1',\s*jsonb_build_object\(\s*'source_content_id',\s*source_lineage\.immutable_payload->'source_response_content_id',\s*'source_occurrence_key', source_lineage\.source_occurrence_key\s*\)\s*\)/,
    'source occurrence',
  );
  const spans = [...branch.matchAll(
    /content_id\(\s*'SEMANTIC_SPAN\/V1',\s*jsonb_build_object\(\s*'schema_version', 'SEMANTIC_SPAN\/V1',\s*'canonical_text_id', supplied\.(?:provision|component)->'canonical_text_id',\s*'absolute_start', supplied\.(?:provision|component)->'absolute_start',\s*'absolute_end', supplied\.(?:provision|component)->'absolute_end'\s*\)\s*\)/g,
  )];
  assert.equal(spans.length, 2);
  assert.ok(spans.every((match) => match.index < branch.length));

  const provisionFormulaStart = branch.lastIndexOf(
    "'PROVISION_INSTANCE/V1'",
    provisionFailure,
  );
  const provisionFormula = branch.slice(provisionFormulaStart, provisionFailure)
    .replace(/\s+/g, ' ');
  assert.ok(provisionFormulaStart >= 0);
  for (const pair of [
    "'schema_version', supplied.provision->'schema_version'",
    "'source_occurrence_id', supplied.provision->'source_occurrence_id'",
    "'canonical_text_id', supplied.provision->'canonical_text_id'",
    "'document_hash', supplied.provision->'document_hash'",
    "'absolute_start', supplied.provision->'absolute_start'",
    "'absolute_end', supplied.provision->'absolute_end'",
    "'concept_key', supplied.provision->'concept_key'",
    "'party', supplied.provision->'party'",
    "'ordinal', supplied.provision->'ordinal'",
  ]) assert.ok(provisionFormula.includes(pair), `missing provision identity pair ${pair}`);

  const componentFormulaStart = branch.lastIndexOf(
    "'PROVISION_COMPONENT/V1'",
    componentFailure,
  );
  const componentFormula = branch.slice(componentFormulaStart, componentFailure)
    .replace(/\s+/g, ' ');
  assert.ok(componentFormulaStart >= 0);
  for (const pair of [
    "'schema_version', supplied.component->'schema_version'",
    "'parent_provision_instance_id', supplied.component->'parent_provision_instance_id'",
    "'canonical_text_id', supplied.component->'canonical_text_id'",
    "'absolute_start', supplied.component->'absolute_start'",
    "'absolute_end', supplied.component->'absolute_end'",
    "'component_key', supplied.component->'component_key'",
    "'ordinal', supplied.component->'ordinal'",
  ]) assert.ok(componentFormula.includes(pair), `missing component identity pair ${pair}`);
});

test('structural validation is closed, set-based and precedes closure locks', () => {
  const structuralIdentityBranch = branch.slice(excerptFailure, componentFailure);
  assert.ok(provisionFailure < componentFailure);
  assert.ok(componentFailure < firstClosureLock);
  assert.match(branch.slice(provisionFailure, firstClosureLock), /USING ERRCODE = '23514'/);
  assert.match(branch, /stored\.canonical_payload[\s\S]*provision_instances stored/);
  assert.match(branch, /stored\.canonical_payload[\s\S]*provision_components stored/);
  assert.match(branch, /supplied\.provision - ARRAY\[/);
  assert.match(branch, /supplied\.component - ARRAY\[/);
  assert.match(
    branch,
    /supplied\.provision->>'concept_key'\s*~ '\^\[A-Z0-9\]\[A-Z0-9_-\]\*\$'/,
  );
  assert.match(
    branch,
    /supplied\.component->>'component_key'\s*~ '\^\[A-Z0-9\]\[A-Z0-9_-\]\*\$'/,
  );
  assert.equal(
    (
      structuralIdentityBranch.match(
        /supplied\.absolute_start < supplied\.absolute_end\s+AND \(/g,
      ) || []
    ).length,
    2,
  );
  assert.equal((structuralIdentityBranch.match(/get_byte\(/g) || []).length, 4);
  assert.equal((structuralIdentityBranch.match(/9007199254740991/g) || []).length, 2);
  assert.doesNotMatch(structuralIdentityBranch, /\[0-9\]\{0,9\}/);
  assert.doesNotMatch(branch.slice(
    branch.indexOf('WITH source_lineage AS'),
    componentFailure,
  ), /\bFOR\s+\w+\s+IN\b/);
});
