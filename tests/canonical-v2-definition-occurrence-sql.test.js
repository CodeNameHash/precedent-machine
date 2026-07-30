const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const writerStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_write');
const writerEnd = sql.indexOf(
  'CREATE OR REPLACE FUNCTION public.canonical_v2_select_candidate_inputs',
  writerStart,
);
const writer = sql.slice(writerStart, writerEnd);
const dealScopeStart = writer.indexOf("IF p_operation = 'DEAL_SCOPE_RUN' THEN");
const semanticInsert = writer.indexOf(
  'INSERT INTO canonical_v2_staging.deals',
  dealScopeStart,
);
const dealScopeValidation = writer.slice(dealScopeStart, semanticInsert);

test('definition occurrences have isolated immutable staging storage', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.definition_occurrences/);
  assert.match(sql, /definition_occurrence_id text PRIMARY KEY/);
  assert.match(sql, /canonical_text_id text NOT NULL CHECK/);
  assert.match(sql, /document_hash text NOT NULL CHECK/);
  assert.match(sql, /canonical_v2_definition_occurrences_closure_idx/);
  assert.match(sql, /canonical_v2_definition_occurrences_source_idx/);
  assert.match(sql, /ALTER TABLE canonical_v2_staging\.definition_occurrences ENABLE ROW LEVEL SECURITY/);
});

test('DEAL_SCOPE_RUN validates each definition occurrence before DML', () => {
  const failure = dealScopeValidation.indexOf(
    'DEAL_SCOPE_RUN definition occurrence identity, source evidence or closure is invalid',
  );
  const relationship = dealScopeValidation.indexOf(
    'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid',
  );
  assert.ok(failure >= 0);
  assert.ok(relationship >= 0);
  const definitionValidation = dealScopeValidation.slice(failure - 14000, failure);
  for (const required of [
    "'DEFINITION_OCCURRENCE/V1'",
    "'definition_occurrence_id'",
    "'exact_declaration_span'",
    "'ordered_body_spans'",
    "'declaration_evidence_excerpt_id'",
    "'body_evidence_excerpt_ids'",
    "content_id('DEFINITION_OCCURRENCE/V1'",
    'definition_body_spans',
    'supplied_excerpts',
    'canonical_text_byte_length',
  ]) assert.ok(definitionValidation.includes(required), `missing ${required}`);
  assert.match(definitionValidation, /body\.prior_absolute_end IS NOT NULL/);
  assert.match(definitionValidation, /HAVING count\(\*\) > 1/);
  assert.match(dealScopeValidation.slice(failure, failure + 240), /USING ERRCODE = '23514'/);
});

test('definition IDs are valid relationship endpoints and retained references', () => {
  assert.match(dealScopeValidation, /'definition_occurrences',\s*stored\.definition_occurrence_id/);
  assert.match(dealScopeValidation, /stored\.definition_occurrence_id = supplied\.reference->>'object_id'/);
  assert.match(dealScopeValidation, /WHEN 'definition_occurrences'\s*THEN stored\.canonical_payload->>'definition_occurrence_id'/);
  const definitionCte = dealScopeValidation.indexOf('supplied_definition_occurrences AS');
  const relationshipStart = dealScopeValidation.lastIndexOf('available_occurrences AS', definitionCte);
  const relationshipEnd = dealScopeValidation.indexOf(
    'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid',
  );
  const relationship = dealScopeValidation.slice(definitionCte, relationshipEnd);
  assert.match(relationship, /supplied_definition_occurrences AS/);
  assert.match(relationship, /SELECT definition->>'definition_occurrence_id'/);
  assert.match(relationship, /resolved_relationship_targets/);
});

test('definition occurrence writes replay exactly and reject identity conflicts', () => {
  const insertion = writer.indexOf('INSERT INTO canonical_v2_staging.definition_occurrences');
  assert.ok(insertion >= 0);
  const segment = writer.slice(insertion - 900, insertion + 1800);
  assert.match(segment, /ORDER BY ordered_item\.value->>'definition_occurrence_id'/);
  assert.match(segment, /ON CONFLICT \(definition_occurrence_id\) DO NOTHING/);
  assert.match(segment, /canonical definition occurrence identity conflict/);
  assert.match(segment, /canonical_v2_staging\.payload_digest\(item\)/);
});
