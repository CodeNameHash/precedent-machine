const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const identity = require('../lib/canonical-v2/qxo-material-candidate-identity');

const RUNNER = 'scripts/canonical-v2-staging-qxo-material-contracts.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('QXO material-contract runner is exact-source, staging-only and two-source', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e/);
  assert.match(source, /abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d/);
  assert.match(source, /0444cefff473dca7b294d16b04f83db66574ae2f164829919f2cb4d34a5f3442/);
  assert.match(source, /343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827/);
  assert.match(source, /sourceOrdinal: 0/);
  assert.match(source, /sourceOrdinal: 1/);
  assert.match(source, /agreementSourceAdmission/);
  assert.match(source, /dealValueSourceAdmission/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
});

test('QXO material-contract runner uses the canonical writer with bounded rollback-first transport', () => {
  assert.match(source, /MAX_WRITER_REQUEST_BYTES = 512 \* 1024/);
  assert.match(source, /SET LOCAL statement_timeout='60000ms'/);
  assert.match(source, /operation: 'DEAL_SCOPE_RUN'/);
  assert.match(source, /SELECT public\.canonical_v2_write/);
  assert.match(source, /runSql\(sql\);[\s\S]*runSql\(sql, \{ commit: true \}\)/);
  assert.match(source, /Rollback-first QXO material-contract semantic run changed staging state/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i);
});

test('QXO material-contract runner pins an inactive release seed and protects the active pointer', () => {
  assert.match(source, /qxo-material-candidate-identity/);
  assert.match(source, /QXO_MATERIAL_COMBINED_CANDIDATE_SEED/);
  assert.match(source, /PROVISIONAL_CORPUS_RELEASE_ID/);
  assert.match(source, /assertActivePointerUnchanged\(activePointerBefore, after\.active_pointer\)/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.doesNotMatch(source, /activateCandidateRelease|canonical_v2_activate|active_corpus_release_pointers\s+SET/i);
});

test('QXO material combined candidate seed is reusable, deterministic and excludes the circular material closure', () => {
  const input = {
    contractFingerprint: '1'.repeat(64),
    materialReviewedMappingId: '2'.repeat(64),
  };
  const first = identity.buildQxoMaterialCombinedCandidateSeed(input);
  const second = identity.buildQxoMaterialCombinedCandidateSeed(input);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.schema_version, 'QXO_MATERIAL_COMBINED_CANDIDATE_SEED/V1');
  assert.equal(first.contract_fingerprint, input.contractFingerprint);
  assert.equal(first.material_reviewed_mapping_id, input.materialReviewedMappingId);
  assert.equal(first.prior_semantic_closure_ids.length, 4);
  assert.equal(Object.hasOwn(first, 'material_semantic_closure_id'), false);
  assert.equal(
    identity.qxoMaterialCombinedCandidateReleaseId(first),
    identity.qxoMaterialCombinedCandidateReleaseId(second),
  );
  assert.equal(
    identity.qxoMaterialCombinedCandidateReleaseId(identity.QXO_MATERIAL_COMBINED_CANDIDATE_SEED),
    identity.PROVISIONAL_CORPUS_RELEASE_ID,
  );
  assert.equal(identity.PROVISIONAL_CORPUS_RELEASE_ID, 'defab4022bf9b461c98151fc7afd8c6e090b2e429690934aee102a3eba8e6d30');
  assert.equal(identity.PROVISIONAL_CORPUS_RELEASE_SEED_DIGEST, 'c87b382a7d72126c96483bc5f9729e5a9d6b35effa000bb7bef1b6c8171616db');
  assert.equal(identity.QXO_MATERIAL_CORPUS_RELEASE_ID_V2, 'df83cf6f0328dd387280ae17fd5ebda4c0a606d9af0cff1c189399a1461b077d');
  assert.equal(identity.QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2, '0735cad212c782e92c149212365edf5d757cddb09f6c0cd3857a8d6af93c7fa3');
  assert.equal(
    identity.QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2.serving_projection_version,
    'canonical-v2-serving/v2',
  );
  assert.equal(
    identity.QXO_MATERIAL_COMBINED_CANDIDATE_SEED_V2.query_projection_contract_digest,
    '048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827',
  );
  assert.equal(identity.QXO_MATERIAL_COMBINED_CANDIDATE_SEED.prior_semantic_closure_ids.length, 4);
  assert.deepEqual(
    identity.QXO_MATERIAL_COMBINED_CANDIDATE_SEED.source_admission_manifest_ids,
    [
      'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
      '8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c',
    ],
  );
});

test('QXO material-contract runner verifies the incomplete row and complete open-world closure', () => {
  assert.match(source, /incomplete_canonical_result_rows/);
  assert.match(source, /open_world_candidates/);
  assert.match(source, /open_world_candidate_occurrences/);
  assert.match(source, /open_world_candidate_dispositions/);
  assert.match(source, /semantic_impact_closures/);
  assert.match(source, /reviewed_source_specific_rows/);
  assert.match(source, /The incomplete-result open-world closure is not exact/);
  assert.match(source, /metric_exclusion_reason/);
});

test('QXO material-contract runner attestation excludes source text, URLs and credentials', () => {
  const body = source.slice(source.indexOf('function attestation'), source.indexOf('const invocation'));
  assert.doesNotMatch(body, /canonical_text|retrieval_url|response_bytes|password|service_role/i);
  assert.match(body, /source_admission_manifest_ids/);
  assert.match(body, /expected_semantic_counts/);
  assert.match(body, /observed_semantic_counts/);
  assert.match(body, /writer_request_byte_length/);
  assert.match(source, /redacted-database-url/);
});

test('QXO material-contract runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
