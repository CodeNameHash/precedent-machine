const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  AUTHORITY_SCOPE,
  FIELD_SPECS,
  MAX_CARRIER_BYTES,
  SOURCE_SPANS,
  buildQxoNoShopNoticeSourceBindingF6,
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-notice-source-binding-f6');

const MODULE = 'lib/canonical-v2/qxo-no-shop-notice-source-binding-f6.js';
const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-source-f6-staging-attestation.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_bindings: {},
    party_binding: {},
    source_evidence: [],
    field_source_bindings: [],
    notice_timing_source_binding: {},
    copy_timing_source_binding: {},
    plural_definition_use_resolution: null,
    definition_relationship_dependency: null,
    retained_source_residuals: [],
    notice_obligation_materialisation: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_notice_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6_PAYLOAD/V1',
      body,
    ),
  };
}

test('the F6 notice source-binding carrier is closed and deterministic', () => {
  const first = carrier();
  assert.equal(canonicalJson(first), canonicalJson(carrier()));
  assert.equal(
    validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopNoticeSourceBindingF6({ unknown_authority: true }),
    /outside its contract/i,
  );

  const oversizedBody = {
    ...first,
    source_evidence: ['x'.repeat(MAX_CARRIER_BYTES)],
  };
  delete oversizedBody.qxo_no_shop_notice_source_binding_f6_id;
  delete oversizedBody.canonical_payload_digest;
  const oversized = {
    ...oversizedBody,
    qxo_no_shop_notice_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1',
      oversizedBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6_PAYLOAD/V1',
      oversizedBody,
    ),
  };
  assert.throws(
    () => validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(oversized),
    /exceeds its byte limit/i,
  );
});

test('staging binds the exact F6 contract, source, clock, and definition graph', () => {
  const attestation = fixture();
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V6,
  );
  assert.equal(
    attestation.contract_binding.notice_schema_definition_id,
    'b19d73d141900929ddeb45449249c69debde0eed5da99dd02bf4dfd1d70e9b1c',
  );
  assert.equal(
    attestation.upstream_bindings
      .qxo_no_shop_clock_f6_parser_bound_review_seed_id,
    'e46361c44ab49a10499edd257f5a17413aae51927405ab80a6baaf2364abbcc6',
  );
  assert.equal(
    attestation.upstream_bindings
      .qxo_no_shop_reviewed_definition_graph_f6_id,
    '65362ac2af8f3459f8b1f09b1ce4485ef5b22b23b4a51c0c1407a35cdb811e18',
  );
  assert.equal(
    attestation.source_binding.document_hash,
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
  );
});

test('the complete first sentence and its two clocks use immutable coordinates', () => {
  assert.deepEqual(SOURCE_SPANS.FIRST_SENTENCE.slice(0, 2), [207783, 208859]);
  assert.deepEqual(SOURCE_SPANS.NOTICE_CLOCK.slice(0, 2), [207841, 207877]);
  assert.deepEqual(SOURCE_SPANS.COPY_CLOCK.slice(0, 2), [208605, 208641]);
  assert.deepEqual(
    SOURCE_SPANS.COMPANY_REQUESTS_TERM.slice(0, 2),
    [208683, 208699],
  );
  assert.equal(Object.keys(SOURCE_SPANS).length, 30);
  assert.equal(fixture().source_evidence_count, 30);
});

test('every frozen notice field is source-bound without collapsing alternatives or cumulative terms', () => {
  assert.deepEqual(
    FIELD_SPECS.map(({ field, code }) => `${field}:${code}`),
    [
      'TRIGGER_CODE:RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
      'TRIGGER_CODE:RECEIPT_OF_COMPANY_REQUEST',
      'DELIVERY_METHOD_CODE:ORAL',
      'DELIVERY_METHOD_CODE:WRITTEN',
      'CONTENT_REQUIREMENT_CODE:IDENTIFY_SUBMITTING_PERSON',
      'CONTENT_REQUIREMENT_CODE:MATERIAL_TERMS_IN_REASONABLE_DETAIL',
      'CONTENT_REQUIREMENT_CODE:MODIFICATIONS_IN_REASONABLE_DETAIL',
      'COPY_SUBJECT_CODE:WRITTEN_COMPANY_REQUESTS',
      'COPY_SUBJECT_CODE:PROPOSALS_OR_INDICATIONS_OF_INTEREST',
      'COPY_SUBJECT_CODE:DRAFT_AGREEMENTS',
    ],
  );
  assert.equal(fixture().field_source_binding_count, 10);
  assert.equal(
    fixture().binding_status.alternative_trigger_operator_complete,
    false,
  );
});

test('the copy clock is a distinct reviewed claim while both clocks remain non-comparable', () => {
  const attestation = fixture();
  assert.equal(
    attestation.first_clock_claim_revision_id,
    'a492fa77d2c529fcc63b21df119e1f4b4169294167bb243e7745668b18393a3b',
  );
  assert.equal(
    attestation.copy_clock_claim_revision_id,
    '8bc47e7e4c1ee206052b1f7bda05c337d2b99c3b670b456c8826542128b34f33',
  );
  assert.notEqual(
    attestation.copy_clock_claim_revision_id,
    attestation.first_clock_claim_revision_id,
  );
  assert.equal(attestation.binding_status.first_clock_trigger_scope_complete, false);
  assert.equal(attestation.binding_status.copy_clock_trigger_referent_complete, false);
  assert.equal(attestation.binding_status.metric_authority, 'NONE');
  assert.equal(attestation.binding_status.comparability_authority, 'NONE');
});

test('the exact plural use resolves only in Review and preserves full definition closure', () => {
  const attestation = fixture();
  assert.match(attestation.plural_definition_use_resolution_id, /^[a-f0-9]{64}$/);
  assert.equal(attestation.reviewed_definition_use_count, 7);
  assert.equal(attestation.reviewed_definition_dependency_edge_count, 1);
  assert.equal(attestation.failure_isolation_verified, true);
});

test('notice materialisation and every downstream authority remain blocked', () => {
  const attestation = fixture();
  const status = attestation.binding_status;
  assert.equal(attestation.notice_obligation_materialisation.completeness, 'INCOMPLETE');
  assert.equal(
    attestation.notice_obligation_materialisation.notice_obligation_revision_id,
    null,
  );
  assert.equal(attestation.retained_source_residual_count, 4);
  assert.equal(status.review_source_mapping_complete, true);
  assert.equal(status.review_renderable, true);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const key of [
    'absence_authority',
    'canonical_write_authority',
    'notice_obligation_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) assert.equal(status[key], 'NONE', key);
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      attestation.contract_binding.contract_fingerprint,
    ),
    false,
  );
});

test('live staging verification is one bounded read with no write path', () => {
  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  const runnerSource = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runnerSource, /--notice-source-f6-print/);
  assert.match(runnerSource, /--notice-source-f6-verify/);
  assert.equal((runnerSource.match(/\breadCapture\(\)/g) || []).length, 2);
  assert.match(runnerSource, /LIMIT 2/);
  assert.match(runnerSource, /MAX_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.doesNotMatch(
    runnerSource,
    /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT)\b/i,
  );
  assert.doesNotMatch(
    moduleSource,
    /canonical-writer|candidate-release|serving-projection|lib\/query/,
  );
});
