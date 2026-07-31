const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const RUNNER = 'scripts/canonical-v2-staging-agreement-product-writer-p8.mjs';
const ALLOWLIST =
  '.github/phase-allowlists/wp-p8-agreement-product-writer-hostile-staging-v1.json';
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
    'ORDERING',
    'PRESENTATION',
    'SURFACES',
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
    'WP-P8-AGREEMENT-PRODUCT-WRITER-HOSTILE-STAGING-V1',
  );
  assert.deepEqual(allowlist.allowed, [ALLOWLIST, RUNNER,
    'tests/canonical-v2-staging-agreement-product-writer-p8.test.js']);
  assert.match(allowlist.note, /rollback transaction/i);
  assert.match(allowlist.note, /Production is not queried or modified/);
});
