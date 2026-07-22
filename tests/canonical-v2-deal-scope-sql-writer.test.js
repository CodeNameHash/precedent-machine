const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const schemaRunner = fs.readFileSync('scripts/canonical-v2-staging-schema.mjs', 'utf8');
const start = sql.indexOf("IF p_operation = 'DEAL_SCOPE_RUN' THEN");
const correctionStart = sql.indexOf("IF p_operation = 'FIXTURE_CORRECTION_AUTHORITY' THEN", start);
const validationBlock = sql.slice(start, correctionStart);
const firstSemanticWrite = sql.indexOf('INSERT INTO canonical_v2_staging.deals', correctionStart);

test('DEAL_SCOPE_RUN is a closed reference-only writer operation', () => {
  assert.notEqual(start, -1);
  assert.match(sql, /'PREPARE_SOURCE_ADMISSION',\s*'DEAL_SCOPE_RUN'/);
  for (const key of [
    'source_references', 'deal', 'excerpts', 'validated_semantic_graphs',
    'provisions', 'components', 'claims', 'relationships', 'open_world_candidates',
    'open_world_candidate_occurrences', 'open_world_evidence_references',
    'open_world_candidate_dispositions', 'open_world_primitives',
    'semantic_impact_closures', 'reviewed_source_specific_rows',
    'incomplete_canonical_result_rows',
  ]) assert.match(validationBlock, new RegExp(`'${key}'`));
  assert.doesNotMatch(validationBlock, /p_write_set->'(?:source|sources|source_admission|source_admissions|conversion)'/);
  assert.match(sql, /IF p_operation <> 'DEAL_SCOPE_RUN' THEN[\s\S]*p_write_set \? 'sources'/);
});

test('source references resolve once through exact indexed lineage joins', () => {
  assert.equal((validationBlock.match(/WITH supplied_references AS/g) || []).length, 1);
  assert.match(validationBlock, /FROM supplied_references supplied[\s\S]*LEFT JOIN canonical_v2_staging\.immutable_source_documents[\s\S]*immutable_source_document_id[\s\S]*supplied\.reference->>'immutable_source_document_id'/);
  assert.match(validationBlock, /LEFT JOIN canonical_v2_staging\.source_admission_manifests[\s\S]*source_admission_manifest_id[\s\S]*supplied\.reference->>'source_admission_manifest_id'/);
  assert.match(validationBlock, /LEFT JOIN canonical_v2_staging\.semantic_extraction_input_envelopes[\s\S]*semantic_extraction_input_envelope_id[\s\S]*supplied\.reference->>'semantic_extraction_input_envelope_id'/);
  assert.match(validationBlock, /LEFT JOIN canonical_v2_staging\.canonical_text_conversions[\s\S]*canonical_text_id[\s\S]*supplied\.reference->>'canonical_text_id'/);
  assert.match(validationBlock, /admission\.canonical_payload->>'admission_state' = 'VERIFIED'/);
  assert.match(validationBlock, /semantic_input\.canonical_payload->>'input_status' = 'READY_FOR_OFFLINE_PROPOSAL'/);
  assert.match(validationBlock, /admission\.canonical_payload->'admitted_intervals'[\s\S]*canonical_text_byte_length/);
  assert.match(validationBlock, /response_bytes_sha256'[\s\S]*item->>'document_hash'/);
  assert.doesNotMatch(validationBlock, /SELECT \* FROM canonical_v2_staging/);
});

test('all inputs are bounded and residual/quarantine closure is exact', () => {
  assert.match(validationBlock, /source_reference_count NOT BETWEEN 1 AND 32/);
  assert.match(validationBlock, /jsonb_array_length\(collection\.value\) > 4096/);
  assert.match(validationBlock, /publishable_object_count > 16384/);
  assert.match(validationBlock, /quarantine\.value->'residual_ids' \? \(residual\.value->>'residual_id'\)/);
  assert.match(validationBlock, /residual\.value->>'residual_id' = residual_id/);
  assert.match(validationBlock, /DEAL_SCOPE_RUN residual and quarantine outputs do not close exactly/);
});

test('lineage, quarantine and receipt failures all precede semantic writes', () => {
  assert.ok(start < correctionStart);
  assert.ok(correctionStart < firstSemanticWrite);
  for (const failure of [
    'source references are unresolved, mixed or incomplete',
    'contains invalid or duplicate semantic objects',
    'residual and quarantine outputs do not close exactly',
    'invalid DEAL_SCOPE_RUN write receipt',
  ]) assert.ok(sql.indexOf(failure, start) < firstSemanticWrite, failure);
  assert.match(sql.slice(correctionStart, firstSemanticWrite), /quarantined semantic closure cannot publish/);
  assert.ok(sql.indexOf('INSERT INTO canonical_v2_staging.write_receipts', firstSemanticWrite) > firstSemanticWrite);
});

test('receipt counts bind only publishable semantic objects, residuals and quarantines', () => {
  assert.match(validationBlock, /p_receipt->>'publishableObjectCount' <> publishable_object_count::text/);
  assert.match(validationBlock, /p_receipt->>'residualCount' <> residual_count::text/);
  assert.match(validationBlock, /p_receipt->>'quarantinedClosureCount' <> quarantine_count::text/);
  assert.match(validationBlock, /existing_receipt\.canonical_payload \|\| jsonb_build_object\('replayed', true\)/);
});

test('the governed schema digest pins the authoritative deal-scope writer', () => {
  const digest = crypto.createHash('sha256').update(sql).digest('hex');
  assert.match(schemaRunner, new RegExp(`'canonical-v2-foundation\\.sql': '${digest}'`));
});
