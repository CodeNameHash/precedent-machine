const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const schemaRunner = fs.readFileSync('scripts/canonical-v2-staging-schema.mjs', 'utf8');

test('source admission uses one closed staging-only writer operation', () => {
  assert.match(sql, /'INTAKE_CAPTURE',\s*'STAGE_SOURCE_ARTIFACT_CHUNK',\s*'PREPARE_SOURCE_ADMISSION'/);
  assert.match(sql, /IF p_operation = 'STAGE_SOURCE_ARTIFACT_CHUNK' THEN/);
  assert.match(sql, /'source_artifact_manifest', 'source_artifact_chunk'/);
  assert.match(sql, /IF p_operation = 'PREPARE_SOURCE_ADMISSION' THEN/);
  assert.match(sql, /'capture_reference', 'conversion_artifact_manifest',[\s\S]*'verification', 'source_admission_bundle'/);
  assert.match(sql, /p_write_set - ARRAY\[[\s\S]*'conversion_artifact_manifest'[\s\S]*'source_admission_bundle'[\s\S]*\]::text\[\] <> '\{\}'::jsonb/);
  assert.match(sql, /source admission preparation does not accept residuals or quarantines/);
});

test('the writer requires the exact prior intake capture and closed verified lineage', () => {
  assert.match(sql, /INTAKE_CAPTURE_REFERENCE\/V1/);
  assert.match(sql, /SELECT canonical_payload INTO capture[\s\S]*FROM canonical_v2_staging\.intake_capture_receipts/);
  assert.match(sql, /capture->>'source_response_content_id'[\s\S]*capture_reference->>'source_response_content_id'/);
  assert.match(sql, /SEC_HTML_CANONICAL_TEXT_CONVERSION\/V2/);
  assert.match(sql, /DEFLATE_RAW_CANONICAL_JSON_TUPLES\/V1/);
  assert.match(sql, /source_map_payload_base64/);
  assert.match(sql, /source_map_compressed_sha256/);
  assert.match(sql, /source_map_uncompressed_byte_length/);
  assert.match(sql, /replace\(encode\([\s\S]*decode\(conversion->>'source_map_payload_base64', 'base64'\)/);
  assert.match(sql, /extensions\.digest\([\s\S]*decode\(conversion->>'source_map_payload_base64', 'base64'\)[\s\S]*source_map_compressed_sha256/);
  assert.doesNotMatch(sql, /conversion->'(?:input_regions|output_mappings)'/);
  assert.match(sql, /CANONICAL_TEXT_VERIFICATION_MANIFEST\/V1/);
  assert.match(sql, /verification->>'verification_status' IS DISTINCT FROM 'PASS'/);
  assert.match(sql, /SOURCE_ADMISSION_MANIFEST\/V2/);
  assert.match(sql, /source_admission->>'admission_state' IS DISTINCT FROM 'VERIFIED'/);
  assert.match(sql, /source_admission->'excluded_intervals' IS DISTINCT FROM '\[\]'::jsonb/);
  assert.match(sql, /source_admission->>'discrepancy_count' IS DISTINCT FROM '0'/);
  assert.match(sql, /semantic_input->'admitted_intervals'[\s\S]*source_admission->'admitted_intervals'/);
  assert.match(sql, /semantic_input->>'verification_manifest_id'[\s\S]*verification->>'verification_manifest_id'/);
  assert.match(sql, /verification->>'input_region_count'[\s\S]*conversion->>'input_region_count'/);
  assert.match(sql, /verification->>'output_mapping_count'[\s\S]*conversion->>'output_mapping_count'/);
  assert.match(sql, /immutable_source->'source_map_encoding'[\s\S]*conversion->'source_map_encoding'/);
  assert.match(sql, /immutable_source->'source_map_compressed_sha256'[\s\S]*conversion->'source_map_compressed_sha256'/);
  assert.match(sql, /immutable_source->'source_map_uncompressed_byte_length'[\s\S]*conversion->'source_map_uncompressed_byte_length'/);
  assert.match(sql, /immutable_source->'input_region_count'[\s\S]*conversion->'input_region_count'/);
  assert.match(sql, /immutable_source->'output_mapping_count'[\s\S]*conversion->'output_mapping_count'/);
  assert.match(sql, /semantic_input->'source_map_encoding'[\s\S]*conversion->'source_map_encoding'/);
  assert.match(sql, /semantic_input->'source_map_compressed_sha256'[\s\S]*conversion->'source_map_compressed_sha256'/);
  assert.match(sql, /semantic_input->'source_map_uncompressed_byte_length'[\s\S]*conversion->'source_map_uncompressed_byte_length'/);
  assert.match(sql, /semantic_input->'input_region_count'[\s\S]*conversion->'input_region_count'/);
  assert.match(sql, /semantic_input->'output_mapping_count'[\s\S]*conversion->'output_mapping_count'/);
  assert.doesNotMatch(sql, /(?:immutable_source|semantic_input)->'source_map_payload_base64'/);
});

test('all six immutable admission objects persist before one generic receipt', () => {
  const orderedTables = [
    'canonical_text_conversions',
    'canonical_text_verification_manifests',
    'immutable_source_documents',
    'source_admission_manifests',
    'source_admission_preparation_receipts',
    'semantic_extraction_input_envelopes',
    'write_receipts',
  ];
  let cursor = sql.indexOf("IF p_operation = 'PREPARE_SOURCE_ADMISSION' THEN");
  for (const table of orderedTables) {
    cursor = sql.indexOf(`INSERT INTO canonical_v2_staging.${table}`, cursor + 1);
    assert.notEqual(cursor, -1, `${table} must be inserted by the admission transaction`);
  }
  assert.match(sql, /canonical text conversion identity conflict/);
  assert.match(sql, /canonical text verification identity conflict/);
  assert.match(sql, /source admission preparation receipt identity conflict/);
  assert.match(sql, /semantic extraction input envelope identity conflict/);
  assert.match(sql, /p_receipt->>'publishableObjectCount' IS DISTINCT FROM '6'/);
});

test('admission storage is RLS-enabled, writer-only and mechanically verified', () => {
  for (const table of [
    'source_artifact_manifests',
    'source_artifact_chunks',
    'canonical_text_conversions',
    'canonical_text_verification_manifests',
    'source_admission_preparation_receipts',
    'semantic_extraction_input_envelopes',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS canonical_v2_staging\\.${table}`));
    assert.match(sql, new RegExp(`ALTER TABLE canonical_v2_staging\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.doesNotMatch(sql, new RegExp(`GRANT (?:SELECT|INSERT|UPDATE|DELETE)[\\s\\S]{0,200}${table}`));
  }
  assert.match(schemaRunner, /canonical_text_conversion_table_exists/);
  assert.match(schemaRunner, /source_artifact_manifest_table_exists/);
  assert.match(schemaRunner, /source_artifact_chunk_table_exists/);
  assert.match(schemaRunner, /source_artifact_tables_denied/);
  assert.match(schemaRunner, /canonical_text_verification_table_exists/);
  assert.match(schemaRunner, /source_admission_preparation_table_exists/);
  assert.match(schemaRunner, /semantic_extraction_input_table_exists/);
  assert.match(schemaRunner, /source_admission_tables_denied/);
});

test('bounded artifact staging preserves exact bytes and PREPARE assembles them set-wise', () => {
  assert.match(sql, /SOURCE_ARTIFACT_MANIFEST\/V1/);
  assert.match(sql, /SOURCE_ARTIFACT_CHUNK\/V1/);
  assert.match(sql, /SEC_HTML_CANONICAL_TEXT_CONVERSION\/V2/);
  assert.match(sql, /CANONICAL_JSON_UTF8\/V1/);
  assert.match(sql, /chunk_byte_length BETWEEN 1 AND 196608/);
  assert.match(sql, /\(artifact_chunk->>'chunk_byte_length'\)::integer > 196608/);
  assert.match(sql, /ordered_chunk_sha256/);
  assert.match(sql, /string_agg\(encode\(staged_chunk\.chunk_payload, 'hex'\), '' ORDER BY staged_chunk\.chunk_ordinal\)/);
  assert.match(sql, /assembled_chunk_sha256 IS DISTINCT FROM artifact_manifest->'ordered_chunk_sha256'/);
  assert.match(sql, /octet_length\(assembled_artifact\)[\s\S]*artifact_manifest->>'payload_byte_length'/);
  assert.match(sql, /extensions\.digest\(assembled_artifact, 'sha256'/);
  assert.match(sql, /conversion := convert_from\(assembled_artifact, 'UTF8'\)::jsonb/);
  const prepareStart = sql.indexOf("IF p_operation = 'PREPARE_SOURCE_ADMISSION' THEN");
  const prepareEnd = sql.indexOf("IF p_operation = 'FIXTURE_CORRECTION_AUTHORITY' THEN", prepareStart);
  const prepareBlock = sql.slice(prepareStart, prepareEnd);
  assert.doesNotMatch(prepareBlock, /p_write_set->'(?:capture|conversion)'/);
});

test('the governed schema digest pins the compiled admission writer', () => {
  const digest = crypto.createHash('sha256').update(sql).digest('hex');
  assert.match(schemaRunner, new RegExp(`'canonical-v2-foundation\\.sql': '${digest}'`));
});
