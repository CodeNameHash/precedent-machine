const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const RUNNER = 'scripts/canonical-v2-staging-agreement-product-writer-p8.mjs';
const ALLOWLIST =
  '.github/phase-allowlists/wp-p8-stage4-agreement-surface-sql-parity-v1.json';
const source = fs.readFileSync(RUNNER, 'utf8');

test('P8 hostile writer proof is linked only to isolated staging', () => {
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /P8 Agreement Product hostile writer staging proof/);
  assert.match(source, /runtime\.guardProject\(\)/);
  assert.match(source, /'staging'/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  assert.match(source, /production_accessed: false/);
});

test('P8 proves valid F28 and IOC public writer writes, replays and conflicts', () => {
  for (const profile of [
    'CAPITALISATION_BRING_DOWN_V3',
    'IOC_CAPEX_RESTRICTION_V1',
  ]) assert.match(source, new RegExp(profile));
  assert.match(source, /public\.canonical_v2_write/);
  assert.match(source, /f28_replay->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /ioc_replay->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /WHEN unique_violation/);
  assert.match(source, /idempotency key already names different canonical input/);
  assert.match(source, /candidate_count_after_valid <> candidate_count_before \+ 2/);
});

test('P8 hostile calls recompute identities then reject every semantic and terminal attack before DML', () => {
  for (const mutation of [
    'QUERY_PROFILE',
    'RESULT_ACTION_CITATION',
    'IOC_OLD_CAPEX_CITATION',
    'IOC_LOST_PRECISION',
    'ORDERING',
    'PRESENTATION',
    'SURFACES',
    'SURFACE_QUERY_DEFINITION_ID',
    'SURFACE_RESULT_IDENTITY',
    'SURFACE_DOMAIN_IDENTITY',
    'SURFACE_PRESENTATION_ID',
    'SURFACE_RELEASE_ID',
    'SURFACE_RELEASE_DIGEST',
    'SURFACE_CITATION_TARGET',
    'SURFACE_DETAIL_ACTION',
    'SURFACE_RENDERER_IDENTITY',
    'SURFACE_SOURCE_DOCUMENT',
    'SURFACE_SOURCE_EVIDENCE',
    'SURFACE_AUTHORITY',
    'SURFACE_EXTRA_FIELD',
    'SURFACE_MISSING_FIELD',
    'EVIDENCE_RELEASE',
    'TERMINAL_BODY',
    'TERMINAL_SUBJECT',
    'TERMINAL_ID',
    'TERMINAL_SHAPE',
    'PROVISION_ROW',
    'PRODUCT_MEMBERSHIP',
    'PRODUCT_MEMBERSHIP_EXTRA',
  ]) assert.match(source, new RegExp(mutation));
  for (const helper of [
    'recomputeTerminal',
    'recomputeQueryIdentity',
    'recomputeResultIdentity',
    'recomputeCitation',
    'recomputeOrdering',
    'recomputePresentation',
    'recomputeSurfaces',
    'recomputeSurfaceRecordId',
    'recomputeCarrier',
    'buildCanonicalWriteInputDigest',
    'buildCanonicalWriteReceipt',
  ]) assert.match(source, new RegExp(helper));
  assert.match(source, /WHEN check_violation/);
  assert.match(source, /invalid SQL-native Agreement candidate Product materialisation/);
  assert.match(source, /hostile .* Agreement Product write reached DML/);
  assert.match(source, /proveHostileStagingWriter/);
  assert.doesNotMatch(source, /commit:\s*true/);
});

test('P8 preserves durable rows, receipts and the active pointer by forced rollback', () => {
  assert.match(source, /runtime\.runSql\(/);
  assert.match(source, /Forced rollback changed durable Agreement Product writer state/);
  assert.match(source, /candidate_rows_unchanged: true/);
  assert.match(source, /receipt_rows_unchanged: true/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.match(source, /active_corpus_release_pointers/);
  assert.match(source, /JSON\.stringify\(after\) !== JSON\.stringify\(before\)/);
});

test('P8 hostile phase boundary owns only its staging proof, test and allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  assert.equal(
    allowlist.phase,
    'WP-P8-STAGE4-AGREEMENT-SURFACE-SQL-PARITY-V1',
  );
  assert.deepEqual(allowlist.allowed, [
    ALLOWLIST,
    'scripts/canonical-v2-optiona-authority-partition.mjs',
    'scripts/canonical-v2-staging-agreement-product-writer-p8.mjs',
    'scripts/canonical-v2-staging-schema.mjs',
    'sql/optionA/step0b-canonical-writer-by-contract.sql',
    'supabase/canonical-v2-foundation.sql',
    'supabase/canonical-v2-product-candidate-result-writer.sql',
    'tests/canonical-v2-agreement-writer-sql-native-validator.test.js',
    'tests/canonical-v2-product-candidate-result-writer.test.js',
    'tests/canonical-v2-staging-agreement-product-writer-p8.test.js',
  ]);
  assert.match(allowlist.note, /rollback transaction/i);
  assert.match(allowlist.note, /Production is not queried or modified/);
});
