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
const relationshipFailure = branch.indexOf(
  'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid',
);
const graphFailure = branch.indexOf(
  'DEAL_SCOPE_RUN validated semantic graph identity, child identity or source bytes are invalid',
);
const firstClosureLock = branch.indexOf('PERFORM pg_advisory_xact_lock');
const graphBranch = branch.slice(relationshipFailure, graphFailure);

test('DEAL_SCOPE_RUN recomputes the complete semantic graph identity chain', () => {
  assert.notEqual(branchStart, -1);
  assert.notEqual(firstSemanticInsert, -1);
  assert.ok(relationshipFailure < graphFailure);
  assert.ok(graphFailure < firstClosureLock);
  for (const domain of [
    'VALIDATED_SEMANTIC_GRAPH/V1',
    'DEFINITION_CUE/V1',
    'DEFINITION_USE_CUE/V1',
    'SEMANTIC_SPAN/V1',
    'RAW_DEFINITION_TERM/V1',
  ]) {
    assert.match(
      graphBranch,
      new RegExp(`content_id\\(\\s*'${domain.replace('/', '\\/')}'`),
      `${domain} must be recomputed before DML`,
    );
  }
});

test('new and retained graphs share one closed bounded set-based validator', () => {
  assert.match(
    graphBranch,
    /p_write_set->'validated_semantic_graphs'/,
  );
  assert.match(
    graphBranch,
    /stored\.canonical_payload[\s\S]*validated_semantic_graphs stored/,
  );
  assert.match(graphBranch, /supplied\.graph - ARRAY\[/);
  assert.match(graphBranch, /member\.cue - ARRAY\[/);
  assert.match(graphBranch, /member\.use_cue - ARRAY\[/);
  assert.match(graphBranch, /member\.span - ARRAY\[/);
  assert.ok(
    (graphBranch.match(/WHEN jsonb_typeof\([^)]*\) = 'object'\s+THEN \(/g) || [])
      .length >= 4,
  );
  assert.match(graphBranch, /nested\.nested_member_count <= 16384/);
  assert.match(graphBranch, /request_child_counts/);
  assert.match(graphBranch, /request_nested_counts/);
  assert.match(graphBranch, /request_id_counts/);
  assert.match(graphBranch, /request_children\.child_count <= 16384/);
  assert.match(
    graphBranch,
    /request_nested\.nested_member_count <= 16384/,
  );
  assert.match(graphBranch, /request_ids\.id_member_count <= 16384/);
  assert.ok((graphBranch.match(/4096/g) || []).length >= 10);
  assert.match(graphBranch, /9007199254740991/);
  assert.doesNotMatch(graphBranch, /\bFOR\s+\w+\s+IN\b/);
});

test('graph validation binds exact UTF-8 bytes, geometry, links and child order', () => {
  assert.match(graphBranch, /get_byte\(/);
  assert.match(graphBranch, /source_bound_spans/);
  assert.match(graphBranch, /utf8_checked_spans/);
  assert.match(graphBranch, /prepared_cues/);
  assert.match(graphBranch, /prepared_uses/);
  assert.match(graphBranch, /prepared_graph_ids/);
  assert.match(graphBranch, /expected_raw_term_digest/);
  assert.match(graphBranch, /expected_cue_id IS NULL/);
  assert.match(graphBranch, /expected_use_id IS NULL/);
  assert.match(graphBranch, /prepared\.expected_graph_id IS NULL/);
  assert.match(
    graphBranch,
    /'body_span_ids', body\.body_ids_in_input_order/,
  );
  assert.match(
    graphBranch,
    /'definition_cue_ids', cues\.cue_ids_in_input_order/,
  );
  assert.doesNotMatch(
    graphBranch,
    /'body_span_ids', cue\.cue->'body_span_ids'/,
  );
  assert.match(
    graphBranch,
    /span\.absolute_end < span\.canonical_text_byte_length\s+THEN get_byte\(/,
  );
  assert.match(
    graphBranch,
    /extensions\.digest\(span\.exact_bytes, 'sha256'::text\)/,
  );
  assert.match(graphBranch, /pg_catalog\.convert_to\(cue\.cue->>'raw_term', 'UTF8'\)/);
  assert.match(graphBranch, /contains_overlap/);
  assert.match(graphBranch, /'POSTFIX_INLINE'/);
  assert.match(graphBranch, /'NESTED_INLINE'/);
  assert.match(graphBranch, /cue\.cue->>'definition_cue_id'\s+= use_cue\.use_cue->>'definition_cue_id'/);
  assert.match(graphBranch, /COLLATE "C"/);
  assert.match(graphBranch, /cues_in_canonical_order/);
  assert.match(graphBranch, /uses_in_canonical_order/);
  assert.match(
    branch.slice(graphFailure, firstClosureLock),
    /USING ERRCODE = '23514'/,
  );
  assert.doesNotMatch(
    graphBranch,
    /jsonb_typeof\([^)]*body_spans[^)]*\) = 'array'\s+AND jsonb_array_length/,
  );
});
