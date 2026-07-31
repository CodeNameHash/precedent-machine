const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sources = [
  'sql/optionA/step0b-canonical-writer-by-contract.sql',
  'supabase/canonical-v2-foundation.sql',
  'supabase/canonical-v2-product-candidate-result-writer.sql',
].map((file) => ({ file, sql: fs.readFileSync(file, 'utf8') }));

const signature = 'CREATE OR REPLACE FUNCTION canonical_v2_staging.validate_agreement_candidate_product_carrier(';

function validator(source) {
  const start = source.indexOf(signature);
  const end = source.indexOf('\n$$;', start);
  assert.ok(start !== -1 && end > start);
  return source.slice(start, end + 4);
}

test('the three SQL installation forms carry byte-identical native Agreement validation', () => {
  const implementations = sources.map(({ sql }) => validator(sql));
  assert.equal(implementations[0], implementations[1]);
  assert.equal(implementations[0], implementations[2]);
});

test('the SQL sources contain no literal patch markers', () => {
  for (const { sql } of sources) {
    assert.doesNotMatch(sql, /^\+CREATE OR REPLACE FUNCTION/m);
  }
});

test('the validator covers each hostile Agreement drift boundary', () => {
  const implementation = validator(sources[0].sql);
  for (const marker of [
    'CAPITALISATION_BRING_DOWN_V3',
    'IOC_CAPEX_RESTRICTION_V1',
    'AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1',
    'AGREEMENT_CANDIDATE_ENVELOPE_SOURCE_PROJECTION/V1',
    'PRODUCT_QUERY_IR/V1',
    'TARGET_CAPEX_RESTRICTION',
    'PRODUCT_QUERY_RESULT/V1',
    'PRODUCT_EXACT_CITATION/V1',
    'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION/V1',
    'PRODUCT_QUERY_EXECUTION_SUMMARY/V1',
    'PRODUCT_RESULT_PRESENTATION/V1',
    'PRODUCT_RESULT_SURFACE_BINDING/V1',
    'AGREEMENT_CANDIDATE_PRODUCT_EVALUATION_EVIDENCE/V1',
    'candidate_release_manifest_payload_digest',
  ]) assert.match(implementation, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(implementation, /semantic_contract'->>'predicate_key' IS DISTINCT FROM result_id/);
  assert.match(implementation, /presentation_contract'->'sort' IS DISTINCT FROM '\[\]'::jsonb/);
  assert.match(implementation, /comparator_state' IS DISTINCT FROM 'GOVERNED_TYPED_TOTAL_COMPARATOR_APPLIED'/);
  assert.match(implementation, /validated_ordering_facts' IS DISTINCT FROM v->'agreement_ordering_facts'/);
  assert.match(implementation, /PRODUCT_FIELD_CATALOGUE_MANIFEST_PAYLOAD\/V1/);
  assert.match(implementation, /filter_sentence' IS DISTINCT FROM jsonb_build_object/);
  assert.match(implementation, /surface_state' IS DISTINCT FROM 'VALIDATED_NOT_SERVED'/);
  assert.match(implementation, /terminal_payload_digest/);
  assert.match(implementation, /subject_terminal_payload_digest/);
  assert.match(implementation, /invalid SQL-native Agreement candidate Product materialisation/);
});

test('each public writer invokes native validation before Agreement Product DML', () => {
  for (const { sql } of sources) {
    const agreement = sql.indexOf("AGREEMENT_CANDIDATE_ENVELOPE' THEN");
    const call = sql.indexOf('validate_agreement_candidate_product_carrier', agreement);
    const insert = sql.indexOf(
      'INSERT INTO canonical_v2_staging.product_candidate_results',
      agreement,
    );
    assert.ok(agreement !== -1 && call > agreement && insert > call);
  }
});
