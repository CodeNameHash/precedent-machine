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

test('every conflict-tolerant immutable insert has an exact post-conflict check', () => {
  const inserts = [...writer.matchAll(/ON CONFLICT \([^)]+\) DO NOTHING;/g)];
  assert.ok(inserts.length >= 25);
  for (const match of inserts) {
    const following = writer.slice(match.index + match[0].length, match.index + 1800);
    assert.match(
      following,
      /(?:IS DISTINCT FROM canonical_v2_staging\.payload_digest|IF NOT EXISTS \()/,
      `missing post-conflict check after ${match[0]} at writer offset ${match.index}`,
    );
  }
});

test('multi-row immutable inserts use deterministic primary-identity order', () => {
  for (const identity of [
    'immutable_source_document_id',
    'source_admission_manifest_id',
    'validated_semantic_graph_id',
    'excerpt_id',
    'provision_instance_id',
    'provision_component_id',
    'condition_group_revision_id',
    'claim_revision_id',
    'relationship_revision_id',
    'candidate_id',
    'open_world_candidate_occurrence_id',
    'evidence_reference_id',
    'final_disposition_id',
    'primitive_id',
    'semantic_impact_closure_id',
    'reviewed_source_specific_row_serving_key',
    'incomplete_result_review_row_serving_key',
    'residual_id',
    'quarantine_id',
    'correction_authority_materialisation_id',
  ]) {
    assert.match(writer, new RegExp(`ORDER BY ordered_item\\.value->>'${identity}'`));
  }
});

test('the receipt remains after all immutable payload checks', () => {
  const finalReceipt = writer.lastIndexOf(
    'INSERT INTO canonical_v2_staging.write_receipts',
  );
  for (const conflict of [
    'canonical residual identity conflict',
    'canonical quarantine identity conflict',
    'incomplete canonical result row identity conflict',
  ]) {
    assert.ok(writer.indexOf(conflict) < finalReceipt);
  }
});

test('Product persistence recomputes result identities and rejects rehashed sidecar swaps', () => {
  const productStart = writer.indexOf("IF p_operation = 'PRODUCT_RESULT_CANDIDATE_RUN'");
  const productEnd = writer.indexOf("IF p_operation = 'INTAKE_CAPTURE'", productStart);
  const product = writer.slice(productStart, productEnd);
  for (const [schema, id] of [
    ['METSERA_EXCLUSIVITY_PRODUCT_ADMISSION/V1', 'product_admission_adapter_receipt_id'],
    ['METSERA_EXCLUSIVITY_PRODUCT_ROW/V1', 'product_row_receipt_id'],
    ['METSERA_EXCLUSIVITY_PRODUCT_RESULT_SET/V1', 'product_result_set_receipt_id'],
    ['METSERA_EXCLUSIVITY_PRODUCT_PRESENTATION/V1', 'product_presentation_receipt_id'],
    ['METSERA_EXCLUSIVITY_PRODUCT_SURFACES/V1', 'product_surfaces_receipt_id'],
  ]) {
    assert.match(product, new RegExp(`${id}[\\s\\S]*content_id\\([\\s\\S]*${schema}`));
  }
  assert.match(product, /candidate_release_manifest_payload_digest[\s\S]*IS DISTINCT FROM/);
  assert.match(product, /product_presentation_receipt_id[\s\S]*product_surfaces/);
  assert.match(product, /Product candidate-result release or lineage mismatch/);
});

test('Product candidate replay is a no-op, conflicts fail, and the SQL function cannot partially commit', () => {
  const productStart = writer.indexOf("IF p_operation = 'PRODUCT_RESULT_CANDIDATE_RUN'");
  const productEnd = writer.indexOf("IF p_operation = 'INTAKE_CAPTURE'", productStart);
  const product = writer.slice(productStart, productEnd);
  const candidateInsert = product.indexOf(
    'INSERT INTO canonical_v2_staging.product_candidate_results',
  );
  const conflict = product.indexOf('Product candidate-result identity conflict');
  const receiptInsert = product.indexOf('INSERT INTO canonical_v2_staging.write_receipts');
  assert.ok(conflict !== -1 && candidateInsert !== -1 && receiptInsert > candidateInsert);
  assert.match(product, /ON CONFLICT \(candidate_product_result_id\) DO NOTHING;/);
  assert.match(product, /IF existing_digest IS DISTINCT FROM canonical_v2_staging\.payload_digest\([\s\S]*Product candidate-result identity conflict/);
  assert.match(writer, /RETURN existing_receipt\.canonical_payload \|\| jsonb_build_object\('replayed', true\)/);
  assert.match(writer, /idempotency key already names different canonical input/);
  assert.doesNotMatch(product, /\b(?:COMMIT|ROLLBACK)\b/);
});
