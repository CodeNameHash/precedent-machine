const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-qxo-tier-b-attestation.mjs';
const REVIEW = 'tests/fixtures/canonical-v2/qxo-tier-b-staging-lineage-review.json';
const source = fs.readFileSync(RUNNER, 'utf8');
const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));

test('QXO Tier B staging attestation is exact-source, bounded and read-only', () => {
  assert.doesNotMatch(source, /createCanonicalV2StagingRuntime|sqlRpcClient|commit\s*=/);
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /ROLLBACK/);
  assert.match(source, /statement_timeout='60000ms'/);
  assert.match(source, /canonical_v2_staging\.intake_capture_receipts/);
  assert.match(source, /canonical_v2_staging\.canonical_text_conversions/);
  assert.match(source, /canonical_v2_staging\.canonical_text_verification_manifests/);
  assert.match(source, /canonical_v2_staging\.immutable_source_documents/);
  assert.match(source, /canonical_v2_staging\.source_admission_manifests/);
  assert.match(source, /canonical_v2_staging\.semantic_extraction_input_envelopes/);
  assert.match(source, /canonical_v2_staging\.deals/);
  assert.match(source, /retrieval_url_sha256/);
  assert.match(source, /response_bytes_sha256/);
  assert.match(source, /LIMIT 2/);
  assert.match(source, /database_round_trip_count: 1/);
  assert.match(source, /database_write_count: 0/);
  assert.doesNotMatch(source, /canonical_v2_write|canonical_v2_import|canonical_v2_activate/i);
  assert.doesNotMatch(
    source,
    /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i,
  );
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  const failureDiagnosticPath = source.slice(
    source.indexOf('if (result.error || result.status !== 0)'),
    source.indexOf("if (Buffer.byteLength(result.stdout || '', 'utf8')"),
  );
  assert.doesNotMatch(failureDiagnosticPath, /result\.stdout/);
});

test('QXO Tier B staging review is honest about reviewer identity and authority', () => {
  assert.equal(review.authority_scope, 'STAGING_SOURCE_BACKED_REPRODUCTION_ONLY');
  assert.equal(review.review_eligibility_state, 'UNVERIFIED_IDENTITY');
  assert.deepEqual(review.reviewer_identity, {
    actor_kind: 'AI_REVIEW_AGENT',
    provider: 'OPENAI_CODEX',
    review_lane: 'INDEPENDENT_LEGAL_SEMANTIC',
    identity_attestation_state: 'UNAVAILABLE',
  });
  assert.ok(review.review_findings.includes('USES_DEFINITION_AUTHORITY_ABSENT'));
  assert.ok(
    review.review_findings.includes(
      'COMPARABILITY_QUERY_SERVING_RELEASE_WRITE_AUTHORITY_ABSENT',
    ),
  );
});

test('QXO Tier B attestation binds the strict bridge and emits no source payload', () => {
  assert.match(source, /buildQxoTierBParserBoundReviewSeed/);
  assert.match(source, /validateQxoTierBParserBoundReviewSeed/);
  assert.match(source, /buildReviewedDefinitionGraphPackage/);
  assert.match(source, /reviewed_definition_geometry/);
  const body = source.slice(
    source.indexOf('function attest'),
    source.indexOf('if (process.argv.length'),
  );
  assert.doesNotMatch(
    body,
    /canonical_text[,}]|response_bytes|source_map|retrieval_url[^_]|service_role|password|exact_text/i,
  );
  assert.match(body, /VERIFIED_READ_ONLY/);
  assert.match(body, /REVIEW_ONLY_NO_CANONICAL_WRITE/);
  assert.match(body, /review_eligibility_state/);
});

test('QXO Tier B staging runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
