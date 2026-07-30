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
