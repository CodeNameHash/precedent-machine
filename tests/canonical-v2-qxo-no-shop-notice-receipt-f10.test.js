const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  ALTERNATIVE_RECEIPT_CODE,
  AMBIGUITY_DIMENSIONS,
  AUTHORITY_SCOPE,
  LAWYER_REVIEW_NOTE,
  MAX_CARRIER_BYTES,
  PRIMARY_RECEIPT_CODE,
  PRIMARY_SUBJECT_CODE,
  validateQxoNoShopNoticeReceiptF10CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-notice-receipt-f10');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-notice-receipt-f10.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-receipt-f10-staging-attestation.json';
const ALLOWLIST =
  '.github/phase-allowlists/wp-canonical-qxo-no-shop-notice-receipt-f10.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_bindings: {},
    notice_occurrence: {},
    corrected_copy_clock_interpretation: {},
    notice_revision: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_notice_receipt_f10_id: contentId(
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10_PAYLOAD/V1',
      body,
    ),
  };
}

test('the F10 carrier is closed, bounded and deterministic', () => {
  const first = carrier();
  assert.equal(canonicalJson(first), canonicalJson(carrier()));
  assert.equal(
    validateQxoNoShopNoticeReceiptF10CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopNoticeReceiptF10CarrierIdentity(changed),
    /identity has drifted/i,
  );

  const oversizedBody = {
    ...first,
    status: { retained: 'x'.repeat(MAX_CARRIER_BYTES) },
  };
  delete oversizedBody.qxo_no_shop_notice_receipt_f10_id;
  delete oversizedBody.canonical_payload_digest;
  const oversized = {
    ...oversizedBody,
    qxo_no_shop_notice_receipt_f10_id: contentId(
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10/V1',
      oversizedBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10_PAYLOAD/V1',
      oversizedBody,
    ),
  };
  assert.throws(
    () => validateQxoNoShopNoticeReceiptF10CarrierIdentity(oversized),
    /exceeds its byte limit/i,
  );
});

test('F10 pins the corrected primary reading and preserves the legal ambiguity', () => {
  const attestation = fixture();
  const interpretation = attestation.corrected_copy_clock_interpretation;
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    '8576011555a67b18f6539bb259dea4285d2e3d982c4b906a3edc73162dc9e8c7',
  );
  assert.equal(
    interpretation.primary_interpretation.code,
    PRIMARY_RECEIPT_CODE,
  );
  assert.equal(
    interpretation.primary_interpretation.subject_code,
    PRIMARY_SUBJECT_CODE,
  );
  assert.deepEqual(
    interpretation.alternative_interpretations,
    [{ code: ALTERNATIVE_RECEIPT_CODE }],
  );
  assert.equal(
    interpretation.clarity_state,
    'REASONABLE_BUT_AMBIGUOUS',
  );
  assert.deepEqual(
    interpretation.ambiguity_dimension_codes,
    AMBIGUITY_DIMENSIONS,
  );
  assert.equal(interpretation.lawyer_review_note, LAWYER_REVIEW_NOTE);
  assert.equal(
    interpretation.review_provenance.supersedes_decision_key,
    'QXO_COPY_RECEIPT_PRIMARY_WITH_RETAINED_AMBIGUITY',
  );
});

test('F10 preserves the stable occurrence and assembles one review notice revision', () => {
  const attestation = fixture();
  const revision = attestation.notice_revision;
  assert.equal(
    attestation.notice_occurrence.notice_obligation_occurrence_id,
    '397e3db47dc62bd3090809574a4d4f1978644fc9b0c121ac10c3b1d2d5e2ade5',
  );
  assert.equal(
    revision.notice_obligation_occurrence_id,
    attestation.notice_occurrence.notice_obligation_occurrence_id,
  );
  assert.equal(
    revision.notice_obligation_revision_id,
    'ad75d2ead635b0298d681ff8b2567c68235d8a4e2900e93d2d53dcc3e8f0bde6',
  );
  assert.equal(revision.schema_version, 'NO_SHOP_NOTICE_OBLIGATION/V4');
  assert.deepEqual(revision.trigger_codes, [
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
    'RECEIPT_OF_COMPANY_REQUEST',
  ]);
  assert.deepEqual(revision.delivery_method_codes, ['ORAL', 'WRITTEN']);
  assert.deepEqual(revision.content_requirement_codes, [
    'IDENTIFY_SUBMITTING_PERSON',
    'MATERIAL_TERMS_IN_REASONABLE_DETAIL',
    'MODIFICATIONS_IN_REASONABLE_DETAIL',
  ]);
  assert.deepEqual(revision.copy_subject_codes, [
    'DRAFT_AGREEMENTS',
    'PROPOSALS_OR_INDICATIONS_OF_INTEREST',
    'WRITTEN_COMPANY_REQUESTS',
  ]);
  assert.equal(revision.definition_use_relationship_ids.length, 7);
  assert.equal(revision.evidence_excerpt_count, 30);
});

test('the ambiguous child remains visible without erasing resolved notice children', () => {
  const attestation = fixture();
  const revision = attestation.notice_revision;
  assert.deepEqual(revision.child_resolution_states, [
    {
      child_key: 'TRIGGER_EXPRESSION',
      resolution_state: 'RESOLVED_CLEAR',
    },
    {
      child_key: 'INITIAL_NOTICE_CLOCK_SCOPE',
      resolution_state: 'RESOLVED_CLEAR',
    },
    {
      child_key: 'COPY_CLOCK_SCOPE',
      resolution_state: 'BLOCKING_UNRESOLVED',
    },
    {
      child_key: 'DEFINITION_USES',
      resolution_state: 'BLOCKING_UNRESOLVED',
    },
    {
      child_key: 'DEFINITION_DEPENDENCY',
      resolution_state: 'BLOCKING_UNRESOLVED',
    },
    {
      child_key: 'DEFINITION_SCOPE',
      resolution_state: 'BLOCKING_UNRESOLVED',
    },
  ]);
  assert.equal(
    revision.copy_clock_scope.primary_receipt_interpretation_code,
    PRIMARY_RECEIPT_CODE,
  );
  assert.deepEqual(
    revision.copy_clock_scope.alternative_receipt_interpretation_codes,
    [ALTERNATIVE_RECEIPT_CODE],
  );
  assert.equal(
    revision.copy_clock_scope.comparability_effect_code,
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  );
  assert.equal(
    attestation.materialisation_status.ambiguity_flag_visible,
    true,
  );
  assert.equal(attestation.materialisation_status.review_renderable, true);
});

test('F10 grants no publication, comparison, serving or release authority', () => {
  const status = fixture().materialisation_status;
  assert.equal(status.publication_blocked, true);
  assert.equal(status.comparison_blocked, true);
  assert.equal(status.materialisation_authority, 'REVIEW_IDENTITY_ONLY');
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
    assert.equal(status[key], 'NONE', key);
  }
  assert.equal(status.release_eligible, false);
});

test('the F10 proof is one bounded staging read with no write or serving path', () => {
  assert.equal(fixture().carrier_drift_rejected, true);
  const runner = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runner, /--notice-receipt-f10-verify/);
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
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
    'lib/canonical-v2/canonical-writer.js',
    'lib/canonical-v2/candidate-release.js',
    'lib/canonical-v2/serving-projection.js',
    'sql/**',
    'supabase/**',
  ]) {
    assert.equal(allowlist.denied.includes(denied), true, denied);
  }
});
