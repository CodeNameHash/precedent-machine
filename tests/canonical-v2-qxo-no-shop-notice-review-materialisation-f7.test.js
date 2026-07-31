const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  AUTHORITY_SCOPE,
  COPY_ALTERNATIVE_CODE,
  COPY_AMBIGUITY_DIMENSIONS,
  COPY_LAWYER_NOTE,
  COPY_PRIMARY_CODE,
  INITIAL_QUALIFIER_CODES,
  INITIAL_TRIGGER_CODES,
  MAX_CARRIER_BYTES,
  validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-notice-review-materialisation-f7');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-notice-review-materialisation-f7.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-review-materialisation-f7-staging-attestation.json';
const ALLOWLIST =
  '.github/phase-allowlists/wp-canonical-qxo-no-shop-notice-f7.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_binding: {},
    review_notice_occurrence: {},
    initial_notice_outcome: {},
    copy_clock_outcome: {},
    notice_revision_materialisation: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_notice_review_materialisation_f7_id: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7_PAYLOAD/V1',
      body,
    ),
  };
}

test('the F7 notice review carrier is closed, bounded and deterministic', () => {
  const first = carrier();
  assert.equal(canonicalJson(first), canonicalJson(carrier()));
  assert.equal(
    validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity(
      changed,
    ),
    /identity has drifted/i,
  );

  const oversizedBody = {
    ...first,
    status: { retained: 'x'.repeat(MAX_CARRIER_BYTES) },
  };
  delete oversizedBody.qxo_no_shop_notice_review_materialisation_f7_id;
  delete oversizedBody.canonical_payload_digest;
  const oversized = {
    ...oversizedBody,
    qxo_no_shop_notice_review_materialisation_f7_id: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7/V1',
      oversizedBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7_PAYLOAD/V1',
      oversizedBody,
    ),
  };
  assert.throws(
    () => validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity(
      oversized,
    ),
    /exceeds its byte limit/i,
  );
});

test('staging pins the exact F7 contract and immutable QXO source lineage', () => {
  const attestation = fixture();
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    '5037e25762892f44f660516913d58a23c17ebab0c10c160fcf8cbd0f65a90969',
  );
  assert.equal(
    attestation.contract_binding.notice_schema_definition_id,
    'f0f5e4d5340ed988a077ae456b49a91d23045860cacc94db3719a7376d131bf1',
  );
  assert.equal(
    attestation.source_binding.document_hash,
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
  );
  assert.equal(
    attestation.upstream_binding
      .qxo_no_shop_notice_semantic_closure_f6_id,
    '20f43fd7ae4ee3518e16827fe3974df77d4be84e76228b7db7cdcedfcf49b148',
  );
});

test('the initial clock is an inclusive ANY_OF with one shared ceiling', () => {
  const initial = fixture().initial_notice;
  assert.equal(initial.trigger_operator, 'ANY_OF');
  assert.deepEqual(initial.trigger_codes, INITIAL_TRIGGER_CODES);
  assert.equal(
    initial.operand_sufficiency_code,
    'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
  );
  assert.equal(
    initial.timing_claim_revision_id,
    'a492fa77d2c529fcc63b21df119e1f4b4169294167bb243e7745668b18393a3b',
  );
  assert.equal(
    initial.application_scope_code,
    'EACH_SATISFYING_TRIGGER_OCCURRENCE',
  );
  assert.equal(initial.qualifier_combination_operator, 'ALL_OF');
  assert.equal(initial.temporal_operator, 'CEILING');
  assert.deepEqual(initial.qualifier_codes, INITIAL_QUALIFIER_CODES);
  assert.equal(initial.resolution_state, 'RESOLVED_CLEAR');
});

test('the copy clock shows the primary reading and retains the ambiguity', () => {
  const copy = fixture().copy_clock;
  assert.equal(copy.clarity_state, 'REASONABLE_BUT_AMBIGUOUS');
  assert.equal(copy.primary_interpretation_code, COPY_PRIMARY_CODE);
  assert.deepEqual(
    copy.alternative_interpretation_codes,
    [COPY_ALTERNATIVE_CODE],
  );
  assert.deepEqual(
    copy.ambiguity_dimension_codes,
    COPY_AMBIGUITY_DIMENSIONS,
  );
  assert.equal(
    copy.lawyer_note_digest,
    sha256Hex(Buffer.from(COPY_LAWYER_NOTE, 'utf8')),
  );
  assert.deepEqual(copy.qualifier_codes, INITIAL_QUALIFIER_CODES);
  assert.equal(copy.qualifier_combination_operator, 'ALL_OF');
  assert.equal(copy.temporal_operator, 'CEILING');
  assert.deepEqual(copy.raw_duration, {
    magnitude: '24',
    unit: 'HOURS',
  });
  assert.deepEqual(copy.canonical_duration, {
    magnitude: '1',
    unit: 'DAYS',
    day_basis: 'ELAPSED',
  });
  assert.deepEqual(copy.raw_receipt_referent, {
    exact_text: 'receipt',
    absolute_start: 208634,
    absolute_end: 208641,
    exact_bytes_digest:
      '6f32860910ca0fb2a20c7fda143666b09dbf8db5238195c90a586fb542ff0cad',
    parent_evidence_excerpt_id:
      'cf20e94b556b2742883007922268fc58026d1a58f733e6ecb65f40d1dce58c8e',
  });
  assert.equal(copy.item_or_batch_cardinality_state, 'UNRESOLVED');
  assert.equal(
    copy.comparability_effect_code,
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  assert.equal(copy.resolution_state, 'BLOCKING_UNRESOLVED');
});

test('the unresolved identity cycle cannot become a plausible notice revision', () => {
  const attestation = fixture();
  assert.equal(
    attestation.review_notice_occurrence.identity_authority,
    'REVIEW_CANDIDATE_ONLY',
  );
  assert.equal(
    attestation.notice_revision_materialisation
      .notice_obligation_revision_id,
    null,
  );
  assert.deepEqual(
    attestation.notice_revision_materialisation
      .definition_use_relationship_ids,
    [],
  );
  assert.deepEqual(
    attestation.notice_revision_materialisation.blocker_codes,
    [
      'NOTICE_REVISION_IDENTITY_CONTRACT_UNFROZEN',
      'USES_DEFINITION_NOTICE_REVISION_ENDPOINT_CYCLE_UNRESOLVED',
    ],
  );
  assert.equal(attestation.materialisation_status.review_renderable, true);
  assert.equal(attestation.materialisation_status.publication_blocked, true);
  assert.equal(
    attestation.materialisation_status.copy_clock_comparability,
    'BLOCKED_AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  for (const key of [
    'absence_authority',
    'canonical_write_authority',
    'relationship_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(attestation.materialisation_status[key], 'NONE', key);
  }
  assert.equal(attestation.materialisation_status.release_eligible, false);
});

test('independent child failures are isolated and staging remains read-only', () => {
  const attestation = fixture();
  assert.equal(attestation.carrier_drift_rejected, true);
  assert.equal(attestation.failure_isolation_verified, true);

  const runner = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
  assert.match(runner, /MAX_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.equal((runner.match(/function readCapture\(\)/g) || []).length, 1);
  assert.doesNotMatch(
    runner,
    /\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|UPSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i,
  );

  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  assert.match(moduleSource, /function isolatedChildOutcome\(/);
  assert.match(moduleSource, /if \(forcedFailure === childKey\) \{\s+fail\(/);
  assert.doesNotMatch(
    moduleSource,
    /(?:supabase|canonical-writer|candidate-release|serving-projection|lib\/query)/i,
  );
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  for (const denied of [
    'lib/canonical-v2/contract-bundle.js',
    'lib/canonical-v2/canonical-writer.js',
    'lib/canonical-v2/candidate-release.js',
    'lib/canonical-v2/serving-projection.js',
    'sql/**',
    'supabase/**',
  ]) {
    assert.equal(allowlist.denied.includes(denied), true, denied);
  }
});
