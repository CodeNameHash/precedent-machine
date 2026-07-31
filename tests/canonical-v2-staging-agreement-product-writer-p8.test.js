const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const RUNNER = 'scripts/canonical-v2-staging-agreement-product-writer-p8.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('P8 Agreement Product writer proof is linked to isolated staging only', () => {
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /P8 Agreement Product writer staging proof/);
  assert.match(source, /runtime\.guardProject\(\)/);
  assert.match(source, /'staging'/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  assert.match(source, /production_accessed: false/);
});

test('P8 proof compiles both generic Agreement Product profiles into carrier envelopes', () => {
  for (const profile of [
    'CAPITALISATION_BRING_DOWN_V3',
    'IOC_CAPEX_RESTRICTION_V1',
  ]) assert.match(source, new RegExp(profile));
  for (const symbol of [
    'evaluationEvidence',
    'compileAgreementCandidateProductMaterialisation',
    'buildAgreementCandidateEnvelopeCarrier',
    'buildProductCandidateResultWriteEnvelope',
    'validateProductCandidateResultWriteSet',
  ]) assert.match(source, new RegExp(symbol));
});

test('P8 proof exercises local dry-run, commit, replay and idempotency conflict', () => {
  assert.match(source, /InMemoryCanonicalRepository/);
  assert.match(source, /createCanonicalWriter/);
  assert.match(source, /dryRun: true/);
  assert.match(source, /commit\.replayed !== false/);
  assert.match(source, /replay\.replayed !== true/);
  assert.match(source, /IDEMPOTENCY_CONFLICT/);
  assert.match(source, /snapshot\.productCandidateResults\.length !== 1/);
  assert.match(source, /snapshot\.receipts\.length !== 1/);
});

test('P8 proof calls the public writer only in rollback-protected isolated staging', () => {
  assert.match(source, /public\.canonical_v2_write/);
  assert.match(source, /runtime\.runSql\(/);
  assert.match(source, /candidate_count_after <> candidate_count_before \+ 2/);
  assert.match(source, /receipt_count_after <> receipt_count_before \+ 2/);
  assert.match(source, /first_replay->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /second_replay->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /WHEN unique_violation/);
  assert.match(source, /runtime\.sqlText\(request\.idempotencyKey\)/);
  assert.match(source, /Forced rollback changed durable Agreement Product writer state/);
});

test('P8 proof preserves candidate counts, receipt counts and the active pointer', () => {
  assert.match(source, /candidate_rows_unchanged: true/);
  assert.match(source, /receipt_rows_unchanged: true/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.match(source, /JSON\.stringify\(after\) !== JSON\.stringify\(before\)/);
  assert.match(source, /active_corpus_release_pointers/);
});

test('P8 phase boundary owns only the staging proof, test and allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    '.github/phase-allowlists/wp-p8-agreement-product-writer-staging-v1.json',
    'utf8',
  ));
  assert.equal(allowlist.phase, 'WP-P8-AGREEMENT-PRODUCT-WRITER-STAGING-V1');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-agreement-product-writer-staging-v1.json',
    RUNNER,
    'tests/canonical-v2-staging-agreement-product-writer-p8.test.js',
  ]);
  assert.match(allowlist.note, /rollback transaction/i);
  assert.match(allowlist.note, /Production is not queried or modified/);
});
