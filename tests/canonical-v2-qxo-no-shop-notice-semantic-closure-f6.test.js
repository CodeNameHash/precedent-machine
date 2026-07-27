const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  AUTHORITY_SCOPE,
  DEFINITION_DEPENDENCY_SPEC,
  DEFINITION_USE_SPECS,
  MAX_CARRIER_BYTES,
  buildQxoNoShopNoticeSemanticClosureF6,
  validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-notice-semantic-closure-f6');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-notice-semantic-closure-f6.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-semantic-closure-f6-staging-attestation.json';
const ALLOWLIST =
  '.github/phase-allowlists/wp-canonical-qxo-no-shop-notice-closure-f6.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_binding: {},
    party_binding: {},
    initial_notice_clock_outcome: {},
    copy_clock_outcome: {},
    definition_use_outcomes: [],
    definition_dependency_outcome: {},
    source_residual_dispositions: [],
    contract_representation_gap: {},
    notice_materialisation: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_notice_semantic_closure_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6_PAYLOAD/V1',
      body,
    ),
  };
}

test('the F6 notice semantic carrier is closed, bounded and deterministic', () => {
  const first = carrier();
  assert.equal(canonicalJson(first), canonicalJson(carrier()));
  assert.equal(
    validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopNoticeSemanticClosureF6({ unknown_authority: true }),
    /outside its contract/i,
  );

  const oversizedBody = {
    ...first,
    source_residual_dispositions: ['x'.repeat(MAX_CARRIER_BYTES)],
  };
  delete oversizedBody.qxo_no_shop_notice_semantic_closure_f6_id;
  delete oversizedBody.canonical_payload_digest;
  const oversized = {
    ...oversizedBody,
    qxo_no_shop_notice_semantic_closure_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6/V1',
      oversizedBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6_PAYLOAD/V1',
      oversizedBody,
    ),
  };
  assert.throws(
    () => validateQxoNoShopNoticeSemanticClosureF6CarrierIdentity(oversized),
    /exceeds its byte limit/i,
  );
});

test('staging pins the exact F6 contract, source carrier and immutable source', () => {
  const attestation = fixture();
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    '161083b014a35d800dec0b0c41a97dc6d97f38a5dd206b388ba51b3ab9f68c08',
  );
  assert.equal(
    attestation.upstream_binding.qxo_no_shop_notice_source_binding_f6_id,
    '3e4e1a71bf89a360b7d712f96ea28ec2d8496868b7321648f9a214d96fcef7de',
  );
  assert.equal(
    attestation.source_binding.document_hash,
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
  );
});

test('the first clock uses one inclusive ANY_OF expression across both receipts', () => {
  const initial = fixture().initial_notice_clock;
  assert.equal(initial.suppressed, false);
  assert.equal(
    initial.existing_claim_revision_id,
    '609e1153fd0e8fe5f75127bee4ef32480814226e7cb07b0b21448e9b11b28985',
  );
  assert.equal(initial.trigger_operator, 'ANY_OF');
  assert.deepEqual(initial.trigger_codes, [
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
    'RECEIPT_OF_COMPANY_REQUEST',
  ]);
  assert.equal(initial.canonical_trigger_expression_id, null);
});

test('the copy clock retains raw receipt and invents no object or cardinality', () => {
  const copy = fixture().copy_clock;
  assert.equal(
    copy.existing_claim_revision_id,
    'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177',
  );
  assert.deepEqual(copy.raw_referent, {
    exact_text: 'receipt',
    absolute_start: 208634,
    absolute_end: 208641,
    exact_bytes_digest:
      '6f32860910ca0fb2a20c7fda143666b09dbf8db5238195c90a586fb542ff0cad',
    parent_evidence_excerpt_id:
      'd0713059174b292f75c3f80909ad40535fdb52c53f13c696447fdb591e4230e5',
  });
  assert.equal(copy.canonical_trigger_code, null);
  assert.equal(copy.receipt_object_resolution, 'UNRESOLVED');
  assert.equal(copy.copy_subject_association_resolution, 'UNRESOLVED');
  assert.equal(copy.item_or_batch_cardinality_resolution, 'UNRESOLVED');
});

test('seven reviewed uses and one nested dependency remain relationship-free', () => {
  const attestation = fixture();
  assert.deepEqual(
    attestation.definition_use_outcomes.map(
      (outcome) => [
        outcome.definition_key,
        outcome.absolute_start,
        outcome.absolute_end,
      ],
    ),
    DEFINITION_USE_SPECS.map(
      (spec) => [
        spec.definition_key,
        spec.absolute_start,
        spec.absolute_end,
      ],
    ),
  );
  assert.equal(attestation.definition_use_outcomes.length, 7);
  assert.equal(
    attestation.definition_use_outcomes
      .every((outcome) => (
        outcome.canonical_definition_use_relationship_id === null
      )),
    true,
  );
  assert.equal(
    attestation.definition_dependency_outcome.upstream_review_resolution_id,
    DEFINITION_DEPENDENCY_SPEC.upstream_review_resolution_id,
  );
  assert.equal(
    attestation.definition_dependency_outcome
      .canonical_definition_use_relationship_id,
    null,
  );
});

test('the typed F6 representation gap blocks all canonical authority', () => {
  const attestation = fixture();
  assert.deepEqual(attestation.contract_representation_gap.gap_dimensions, [
    'TRIGGER_COMBINATION_AND_CLOCK_SCOPE_FIELD_ABSENT',
    'COPY_CLOCK_RECEIPT_REFERENT_FIELD_ABSENT',
    'USES_DEFINITION_EFFECT_SCHEMA_ABSENT',
  ]);
  assert.equal(
    attestation.contract_representation_gap
      .freeze_gate_required_before_canonical_materialisation,
    true,
  );
  assert.equal(attestation.notice_materialisation.canonical_object_count, 0);
  assert.equal(
    attestation.closure_status.first_sentence_definition_scope_complete,
    false,
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
    assert.equal(attestation.closure_status[key], 'NONE', key);
  }
  assert.equal(attestation.closure_status.publication_blocked, true);
  assert.equal(attestation.closure_status.release_eligible, false);
});

test('one failed resolution leaves every independent reviewed sibling intact', () => {
  const attestation = fixture();
  assert.equal(attestation.carrier_drift_rejected, true);
  assert.equal(attestation.failure_isolation_verified, true);
  assert.equal(attestation.closure_status.review_renderable, true);
});

test('the staging verifier remains one bounded read with no write path', () => {
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
