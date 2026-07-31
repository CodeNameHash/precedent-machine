const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const {
  compileFixtureContractV12,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
} = require('../lib/canonical-v2/contract-bundle');
const {
  AUTHORITY_SCOPE,
  METRIC_KEY,
  buildComparabilityClass,
  buildQxoNoShopCopyDeliveryServingF18,
  validateQxoNoShopCopyDeliveryServingF18,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-serving-f18');

const F17_FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-claim-f17-staging-attestation.json';
const F18_FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-serving-f18-staging-attestation.json';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

function build() {
  return buildQxoNoShopCopyDeliveryServingF18({
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_delivery_claim_f17: JSON.parse(
      fs.readFileSync(F17_FIXTURE, 'utf8'),
    ),
  });
}

test('F18 creates one offline candidate observation for the distinct copy-delivery metric', () => {
  const value = build();
  assert.equal(value.authority_scope, AUTHORITY_SCOPE);
  assert.equal(value.observation.metric_key, METRIC_KEY);
  assert.equal(value.observation.canonical_value, '1');
  assert.equal(value.observation.unit, 'DAYS');
  assert.equal(value.observation.day_basis, 'ELAPSED');
  assert.equal(
    value.observation.basis_key,
    'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
  );
  assert.equal(
    value.observation.cohort_membership,
    'SEPARATE_INTERPRETATION_KEYED_COHORT',
  );
});

test('cohort and cache identities bind the governed cross-deal comparability class', () => {
  const value = build();
  const projection = value.observation.interpretation_projection;
  assert.equal(
    value.cohort.comparability_class_digest,
    value.observation.comparability_class.comparability_class_digest,
  );
  assert.equal(
    value.candidate_release.manifest.cohort_identity_contract
      .comparability_class_digest,
    value.observation.comparability_class.comparability_class_digest,
  );
  assert.equal(
    value.candidate_release.manifest.cohort_identity_contract.cache_key,
    value.cohort.cache_key,
  );
  assert.equal(projection.clarity_state, 'REASONABLE_BUT_AMBIGUOUS');
  assert.deepEqual(projection.ambiguity_dimension_codes, [
    'REFERENT',
    'SCOPE',
    'CARDINALITY',
  ]);
  assert.equal(
    projection.alternative_interpretations[0]
      .item_or_batch_cardinality_state,
    'UNRESOLVED',
  );
  assert.equal(
    projection.alternative_interpretations[0]
      .clock_application_scope_state,
    'UNRESOLVED_ITEM_OR_BATCH',
  );
});

test('occurrence lineage does not split legally identical cohorts, but changed semantics do', () => {
  const f17 = JSON.parse(fs.readFileSync(F17_FIXTURE, 'utf8'));
  const sameSemantics = structuredClone(f17);
  sameSemantics.claim.claim_occurrence_id = 'f'.repeat(64);
  sameSemantics.interpretation.interpretation_payload_id = 'e'.repeat(64);
  sameSemantics.interpretation.lawyer_note_digest = 'd'.repeat(64);
  sameSemantics.interpretation.ambiguity_dimension_codes.reverse();
  sameSemantics.claim.attributes.trigger_operand_codes.reverse();
  sameSemantics.presentation.ambiguity_warning_code =
    'SOURCE_SPECIFIC_WARNING_CODE';
  assert.equal(
    buildComparabilityClass(f17).comparability_class_digest,
    buildComparabilityClass(sameSemantics).comparability_class_digest,
  );
  const changedSemantics = structuredClone(f17);
  changedSemantics.claim.attributes.primary_clock_application_scope_code =
    'ONE_SHARED_CLOCK';
  assert.notEqual(
    buildComparabilityClass(f17).comparability_class_digest,
    buildComparabilityClass(changedSemantics).comparability_class_digest,
  );
  const changedRecipient = structuredClone(f17);
  changedRecipient.interpretation.primary_interpretation
    .receipt_recipient_party.value = 'PARENT';
  assert.notEqual(
    buildComparabilityClass(f17).comparability_class_digest,
    buildComparabilityClass(changedRecipient).comparability_class_digest,
  );
  const changedCompanyRequest = structuredClone(f17);
  changedCompanyRequest.claim.attributes.company_request_semantic_code =
    'REQUEST_FOR_ANY_INFORMATION';
  assert.notEqual(
    buildComparabilityClass(f17).comparability_class_digest,
    buildComparabilityClass(changedCompanyRequest)
      .comparability_class_digest,
  );
});

test('the shared row carries comparable terms, source identity and the lawyer warning', () => {
  const value = build();
  const row = value.shared_row;
  const result = row.canonical_result;
  assert.equal(row.schema_version, 'SHARED_SERVING_ROW_READINESS/V1');
  assert.equal(result.components.length, 1);
  assert.equal(
    result.components[0].claim_revision_id,
    value.observation.claim_revision_id,
  );
  assert.equal(result.presentation.display_value, 'Promptly, and no later than 1 elapsed day');
  assert.equal(result.presentation.lawyer_warning_required, true);
  assert.match(result.presentation.ambiguity_warning_text, /item to be copied/);
  assert.equal(
    result.market_context.subject_observation.interpretation_projection
      .interpretation_payload_id,
    value.observation.interpretation_projection.interpretation_payload_id,
  );
});

test('exact-detail readiness closes over typed lineage without pretending coordinates are source text', () => {
  const value = build();
  const detail = value.exact_detail_package;
  const response = detail.response_body;
  assert.equal(detail.parent_row_serving_key, value.shared_row.row_serving_key);
  assert.equal(response.components.length, 1);
  assert.equal(
    response.components[0].claim.claim_revision_id,
    value.observation.claim_revision_id,
  );
  assert.equal(
    response.components[0].interpretation.interpretation_payload_id,
    value.observation.interpretation_projection.interpretation_payload_id,
  );
  assert.equal(response.evidence_references.length, 2);
  assert.deepEqual(
    response.evidence_references.map((entry) => [
      entry.absolute_start,
      entry.absolute_end,
    ]),
    [
      [208562, 208858],
      [208605, 208641],
    ],
  );
  assert.equal(response.presentation.lawyer_warning_required, true);
  assert.equal(
    value.shared_row.canonical_result.source_detail_state.state,
    'UNAVAILABLE',
  );
  assert.equal(detail.resolver_contract.state, 'NOT_BUILT');
  assert.deepEqual(detail.resolver_contract.required_outputs, [
    'EXACT_TEXT',
    'EXACT_BYTES_DIGEST',
    'VALIDATED_ADMITTED_SOURCE_LINEAGE',
  ]);
});

test('the release-readiness bundle is deterministic, complete and inactive', () => {
  const first = build();
  const second = build();
  assert.deepEqual(first, second);
  assert.deepEqual(first.candidate_release.manifest.counts, {
    deals: 1,
    metric_slots: 1,
    observations: 1,
    shared_rows: 1,
    exact_detail_packages: 1,
    unresolved: 0,
    failed: 0,
  });
  assert.equal(
    first.candidate_release.manifest.release_state,
    'READINESS_ONLY_INACTIVE',
  );
  assert.equal(
    first.candidate_release.manifest.active_pointer_authority,
    'NONE',
  );
  assert.equal(first.status.candidate_projection_authority, 'NONE');
  assert.equal(first.status.candidate_release_authority, 'NONE');
  assert.equal(first.status.active_serving_authority, 'NONE');
  assert.equal(first.status.active_query_authority, 'NONE');
  assert.equal(first.status.active_pointer_authority, 'NONE');
  assert.equal(first.status.publication_blocked, true);
  assert.equal(first.status.release_eligible, false);
  assert.equal(
    first.candidate_release.manifest.certification_state,
    'NOT_CERTIFIED',
  );
});

test('F18 does not silently admit V12 to active serving', () => {
  const value = build();
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      value.observation.contract_fingerprint,
    ),
    false,
  );
});

test('the proposed request path is one bounded set-based read with release-aware caching', () => {
  const plan = build().cohort.query_plan;
  assert.equal(plan.execution_mode, 'ONE_INDEXED_SET_BASED_READ');
  assert.equal(plan.broad_claim_or_card_loading, false);
  assert.equal(plan.maximum_database_calls_per_request, 1);
  assert.equal(
    plan.cache_scope,
    'RELEASE_METRIC_PARTY_FILTERS_AND_COMPARABILITY_CLASS',
  );
  assert.equal(plan.certification_state, 'UNCERTIFIED_DESIGN_INTENT');
});

test('the F18 staging attestation is pinned to the bounded select-only runner', () => {
  const attestation = JSON.parse(fs.readFileSync(F18_FIXTURE, 'utf8'));
  const source = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(
    attestation.qxo_no_shop_copy_delivery_serving_f18_id,
    build().qxo_no_shop_copy_delivery_serving_f18_id,
  );
  assert.match(source, /--copy-delivery-serving-f18-verify/);
  assert.match(source, /LIMIT 2/);
  const start = source.indexOf(
    'function buildCopyDeliveryServingF18Attestation',
  );
  const end = source.indexOf('\nfunction ', start + 1);
  assert.doesNotMatch(
    source.slice(start, end),
    /\b(?:INSERT|UPDATE|DELETE|UPSERT)\b/,
  );
});

test('F17 identity, interpretation or warning drift fails closed', () => {
  const f17 = JSON.parse(fs.readFileSync(F17_FIXTURE, 'utf8'));
  const inputs = {
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_delivery_claim_f17: f17,
  };
  const wrongId = structuredClone(f17);
  wrongId.qxo_no_shop_copy_delivery_claim_f17_id = 'f'.repeat(64);
  assert.throws(() => buildQxoNoShopCopyDeliveryServingF18({
    ...inputs,
    qxo_no_shop_copy_delivery_claim_f17: wrongId,
  }), /exact frozen F17/);

  const changedInterpretation = structuredClone(f17);
  changedInterpretation.interpretation.clarity_state = 'CLEAR';
  assert.throws(() => buildQxoNoShopCopyDeliveryServingF18({
    ...inputs,
    qxo_no_shop_copy_delivery_claim_f17: changedInterpretation,
  }), /identity has drifted/);

  const warningRemoved = structuredClone(f17);
  warningRemoved.presentation.lawyer_warning_required = false;
  assert.throws(() => buildQxoNoShopCopyDeliveryServingF18({
    ...inputs,
    qxo_no_shop_copy_delivery_claim_f17: warningRemoved,
  }), /warning lineage has drifted/);
});

test('F18 validator rejects any nested serving drift', () => {
  const value = build();
  assert.equal(validateQxoNoShopCopyDeliveryServingF18({
    qxo_no_shop_copy_delivery_serving_f18: value,
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_delivery_claim_f17: JSON.parse(
      fs.readFileSync(F17_FIXTURE, 'utf8'),
    ),
  }), true);
  const changed = structuredClone(value);
  changed.shared_row.canonical_result.market_context.cohort.counts
    .distribution_deals = 2;
  assert.throws(() => validateQxoNoShopCopyDeliveryServingF18({
    qxo_no_shop_copy_delivery_serving_f18: changed,
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_delivery_claim_f17: JSON.parse(
      fs.readFileSync(F17_FIXTURE, 'utf8'),
    ),
  }), /carrier has drifted/);
});

test('all F18 identities are pinned', () => {
  const value = build();
  assert.equal(
    value.observation.market_observation_serving_key,
    'db3a2fb9429099325f5cf009fecf68312d201418df5723e8e026159f05f62c90',
  );
  assert.equal(
    value.shared_row.row_serving_key,
    'dd7092007add9ee15759b23adb76b281f600f0afbc46c16ff0d78a41fda1e2c2',
  );
  assert.equal(
    value.exact_detail_package.source_detail_payload_id,
    '1473b35537382373a2a6cb3242ac9775572da7c0af9507b2dadb04e3300147cd',
  );
  assert.equal(
    value.cohort.cohort_digest,
    'c999bf6b96a7343c596b280bb20683e098c9a6e506cfe5b4baa2c533754babfe',
  );
  assert.equal(
    value.qxo_no_shop_copy_delivery_serving_f18_id,
    '4d6aae5d8b52dd314ee6fde0e06d158e5267172ef5024fd697889350246855df',
  );
  assert.equal(
    value.canonical_payload_digest,
    '5570cb1b5c16401cd9c23975a7dcd7d2145d22cd7e174f48a7a012405186a0ba',
  );
});
