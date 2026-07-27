const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const fixture = require(
  './fixtures/canonical-v2/qxo-no-shop-actions-f25-staging-attestation.json',
);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_CONTRACT_FINGERPRINT_V12,
  NO_SHOP_ACTION_CODES_V2,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2,
} = require('../lib/canonical-v2/contract-bundle');
const {
  CONTINUE_EFFECT_SPECS,
  F25_BUNDLE_DIGEST,
  F25_BUNDLE_ID,
  F25_MANIFEST_DIGEST,
  F25_MANIFEST_ID,
  F25_REGISTRY_ID,
  buildServingExecutionBindings,
  compileF25CombinedMarketRequest,
  executeF25CombinedMarketRequest,
  prepareF25ItemsForRendering,
  resolveMetricServingAdmissionF25,
  validateF25EnvelopeIdentity,
  validateF25ExecutionResult,
  __test,
} = require(
  '../lib/canonical-v2/no-shop-actions-certification-f25',
);

const MODULE =
  'lib/canonical-v2/no-shop-actions-certification-f25.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const ALLOWLIST =
  '.github/phase-allowlists/wp-canonical-no-shop-actions-certification-f25.json';

function bundle() {
  return fixture.actions_certification_bundle;
}

function carrier(metricKey) {
  return bundle().categorical_certifications.find(
    (entry) => entry.observation.metric_key === metricKey,
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sealedExecutionResult(request, mutate = (value) => value) {
  const body = mutate({
    schema_version: 'F25_COMBINED_MARKET_RESULT/V1',
    certification_manifest_id: request.certification_manifest_id,
    predecessor_release_manifest_id:
      request.predecessor_release_manifest_id,
    cohort_digest: request.cohort_digest,
    cache_key: request.cache_key,
    metric_serving_admission_ids: request.metric_bindings.map(
      (entry) => entry.metric_serving_admission_id,
    ).sort(),
    metric_results: request.metric_bindings.map((binding) => ({
      metric_key: binding.metric_key,
      metric_serving_admission_id:
        binding.metric_serving_admission_id,
      counts: {
        eligible_deals: 1,
        comparable_deals: 1,
        excluded_deals: 0,
      },
      groups: [],
    })).sort((left, right) => (
      left.metric_key.localeCompare(right.metric_key)
    )),
  });
  return {
    ...body,
    canonical_payload_digest: contentId(
      'F25_COMBINED_MARKET_RESULT_PAYLOAD/V1',
      body,
    ),
  };
}

test('F25 is pinned to one exact predecessor, registry, manifest and bundle', () => {
  const value = bundle();
  assert.equal(validateF25EnvelopeIdentity(value), true);
  assert.equal(
    value.no_shop_actions_certification_bundle_f25_id,
    F25_BUNDLE_ID,
  );
  assert.equal(value.canonical_payload_digest, F25_BUNDLE_DIGEST);
  assert.equal(
    value.manifest.no_shop_actions_certification_manifest_f25_id,
    F25_MANIFEST_ID,
  );
  assert.equal(
    value.manifest.canonical_payload_digest,
    F25_MANIFEST_DIGEST,
  );
  assert.equal(
    value.registry.metric_serving_admission_registry_id,
    F25_REGISTRY_ID,
  );
  assert.equal(
    value.manifest.predecessor_manifest_id,
    'e8e870683b3e19a85caf2d6252edfe824daf2f3a5f615972ba74160003c0a04a',
  );
  assert.equal(value.manifest.metric_serving_admission_ids.length, 9);
  assert.equal(value.manifest.new_metric_serving_admission_ids.length, 5);
  assert.equal(value.serving_execution_bindings.length, 5);
  assert.equal(
    value.combined_market_request.certification_manifest_id,
    F25_MANIFEST_ID,
  );
  assert.equal(
    value.manifest.roots.combined_market_request_contract_root,
    value.combined_market_request.request_contract_digest,
  );
});

test('24 exact action occurrences become 23 deal-weighted categories', () => {
  const action = carrier('NO_SHOP_PROHIBITED_ACTION');
  assert.equal(action.metric_definition.metric_version, 2);
  assert.equal(
    action.metric_definition.contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V12,
  );
  assert.equal(
    action.metric_definition.source_contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V6,
  );
  assert.deepEqual(
    action.observation.items.map((entry) => entry.canonical_value),
    [...NO_SHOP_ACTION_CODES_V2].sort(),
  );
  assert.equal(action.observation.item_count, 23);
  assert.equal(
    action.observation.items.reduce(
      (sum, entry) => sum + entry.occurrence_count,
      0,
    ),
    24,
  );
  const furnish = action.observation.items.find(
    (entry) => entry.canonical_value === 'FURNISH_NONPUBLIC_INFORMATION',
  );
  assert.equal(furnish.occurrence_count, 2);
  assert.equal(new Set(
    furnish.occurrences.map((entry) => entry.action_occurrence_id),
  ).size, 2);
  assert.equal(
    action.cohort_result.distribution.find(
      (entry) => entry.canonical_value
        === 'FURNISH_NONPUBLIC_INFORMATION',
    ).deal_count,
    1,
  );
});

test('knowledge qualifiers remain tied to their exact action categories', () => {
  const knowledge = carrier(
    'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER',
  );
  assert.equal(knowledge.observation.item_count, 23);
  const knowingly = knowledge.observation.items.filter(
    (entry) => entry.canonical_value === 'KNOWINGLY',
  );
  assert.deepEqual(
    knowingly.map((entry) => entry.action_code).sort(),
    [
      'ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      'FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
    ],
  );
  assert.equal(
    knowledge.observation.items.every(
      (entry) => entry.source_occurrence_ids.length >= 1
        && entry.source_action_evidence.length >= 1
        && /^[a-f0-9]{64}$/.test(entry.source_action_item_id),
    ),
    true,
  );
});

test('all ten exception prerequisites retain class, source and effect scope', () => {
  const prerequisites = carrier(
    'NO_SHOP_EXCEPTION_PREREQUISITE',
  );
  assert.deepEqual(
    prerequisites.observation.items.map(
      (entry) => entry.canonical_value,
    ),
    [...NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2].sort(),
  );
  assert.equal(
    prerequisites.observation.items.filter(
      (entry) => entry.prerequisite_class === 'SHARED',
    ).length,
    8,
  );
  assert.equal(
    prerequisites.observation.items.filter(
      (entry) => entry.prerequisite_class === 'ACTION_SPECIFIC',
    ).length,
    2,
  );
  assert.equal(
    prerequisites.observation.items.every(
      (entry) => entry.evidence.length >= 1
        && entry.applies_to_effect_keys.length >= 1,
    ),
    true,
  );
});

test('five effects are express and two continue effects are visibly derived', () => {
  const effects = carrier('NO_SHOP_EXCEPTION_EFFECT');
  assert.equal(effects.observation.item_count, 7);
  const direct = effects.observation.items.filter(
    (entry) => entry.derivation_mode === 'DIRECT_SOURCE_TEXT',
  );
  const inferred = effects.observation.items.filter(
    (entry) => entry.derivation_mode
      === 'INFERRED_BY_PARTICIPATION_SUBSUMPTION',
  );
  assert.equal(direct.length, 5);
  assert.equal(inferred.length, 2);
  assert.deepEqual(
    inferred.map((entry) => entry.affected_action_code).sort(),
    CONTINUE_EFFECT_SPECS.map(
      (entry) => entry.affected_action_code,
    ).sort(),
  );
  assert.deepEqual(
    inferred.map((entry) => ({
      canonical_value: entry.canonical_value,
      affected_action_code: entry.affected_action_code,
      direct_source_effect_key: entry.direct_source_effect_key,
    })).sort((left, right) => (
      left.affected_action_code.localeCompare(
        right.affected_action_code,
      )
    )),
    CONTINUE_EFFECT_SPECS.map((entry) => ({
      canonical_value: entry.legal_operation,
      affected_action_code: entry.affected_action_code,
      direct_source_effect_key: entry.direct_effect_key,
    })).sort((left, right) => (
      left.affected_action_code.localeCompare(
        right.affected_action_code,
      )
    )),
  );
  for (const item of inferred) {
    assert.equal(
      [
        'PERMITS_PARTICIPATE_IN_DISCUSSIONS',
        'PERMITS_PARTICIPATE_IN_NEGOTIATIONS',
      ].includes(item.canonical_value),
      true,
    );
    assert.equal(item.lawyer_warning.required, true);
    assert.equal(
      item.lawyer_warning.code,
      'CONTINUE_EFFECT_DERIVED_FROM_PARTICIPATION_LANGUAGE',
    );
    assert.equal(
      item.source_wording,
      'engage in or otherwise participate in discussions or negotiations',
    );
    assert.equal(
      item.relationship_materialisation_state,
      'DERIVED_EFFECT_COMPARISON_ONLY_NOTICE_DEPENDENCY_UNMATERIALISED',
    );
    assert.equal(item.governing_notice_obligation_revision_id, null);
    assert.equal(
      item.schema_conformance_state,
      'F25_DERIVED_COMPARISON_NOT_F6_RELATIONSHIP_PAIR',
    );
  }
  for (const item of direct) {
    assert.equal(item.lawyer_warning.required, false);
    assert.equal(Array.isArray(item.source_wording), true);
    assert.equal(item.source_wording.length >= 1, true);
    assert.equal(
      item.relationship_materialisation_state,
      'SOURCE_EFFECT_COMPARISON_ONLY_NOTICE_DEPENDENCY_UNMATERIALISED',
    );
    assert.equal(
      item.schema_conformance_state,
      'F6_SCHEMA_CONFORMING_DIRECT_EFFECT',
    );
  }
});

test('shared prerequisites cover all effects while action-specific ones remain narrow', () => {
  const prerequisites = carrier(
    'NO_SHOP_EXCEPTION_PREREQUISITE',
  ).observation.items;
  const shared = prerequisites.filter(
    (entry) => entry.prerequisite_class === 'SHARED',
  );
  const actionSpecific = prerequisites.filter(
    (entry) => entry.prerequisite_class === 'ACTION_SPECIFIC',
  );
  assert.equal(
    shared.every((entry) => entry.applies_to_effect_keys.length === 7),
    true,
  );
  assert.equal(
    actionSpecific.every(
      (entry) => entry.applies_to_effect_keys.length === 1
        && entry.applies_to_effect_keys[0]
          === 'FURNISH_NONPUBLIC_INFORMATION_EXCEPTION',
    ),
    true,
  );
});

test('the inline permission remains separate and has no borrowed prerequisites', () => {
  const permission = carrier(
    'NO_SHOP_INLINE_PERMISSION_EFFECT',
  );
  assert.equal(permission.observation.item_count, 1);
  const [item] = permission.observation.items;
  assert.equal(
    item.canonical_value,
    'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS',
  );
  assert.deepEqual(item.prerequisite_codes, []);
  assert.equal(item.qualified_action_outcomes.length, 10);
  assert.equal(
    item.qualified_action_outcomes.every(
      (entry) => entry.suppressed === false,
    ),
    true,
  );
});

test('every carrier retains the complete source residual records and roots', () => {
  for (const entry of bundle().categorical_certifications) {
    const retained = entry.observation.retained_residuals;
    assert.equal(Array.isArray(retained.action_residuals), true);
    assert.equal(Array.isArray(retained.exception_residuals), true);
    assert.equal(retained.action_residuals.length >= 1, true);
    assert.equal(retained.exception_residuals.length >= 1, true);
    assert.equal(
      retained.action_residual_root,
      contentId(
        'F25_ACTION_RETAINED_RESIDUAL_ROOT/V1',
        retained.action_residuals,
      ),
    );
    assert.equal(
      retained.exception_residual_root,
      contentId(
        'F25_EXCEPTION_RETAINED_RESIDUAL_ROOT/V1',
        retained.exception_residuals,
      ),
    );
  }
});

test('each new metric resolves only through the exact manifest admission set', () => {
  const value = bundle();
  const declared =
    value.manifest.metric_serving_admission_ids;
  for (const entry of value.categorical_certifications) {
    const admission = entry.metric_serving_admission;
    const resolution = resolveMetricServingAdmissionF25({
      bundle: value,
      metric_key: admission.metric_key,
      metric_version: admission.metric_version,
      concept_key: admission.concept_key,
      required_claim_definition_key:
        admission.required_claim_definition_key,
      metric_serving_admission_id:
        admission.metric_serving_admission_id,
      declared_metric_serving_admission_ids: declared,
    });
    assert.equal(resolution.certification_manifest_validation, 'PASSED');
    assert.equal(
      resolution.authoritative_admission_validation,
      'NOT_PERFORMED_F26_CENTRAL_VALIDATOR_REQUIRED',
    );
    assert.equal(
      resolution.serving_authority,
      'NONE_F26_CENTRAL_VALIDATOR_REQUIRED',
    );
    assert.equal(resolution.release_authority, 'NONE');
    assert.equal(resolution.active_release_authority, 'NONE');
  }
  const first = value.categorical_certifications[0]
    .metric_serving_admission;
  const second = value.categorical_certifications[1]
    .metric_serving_admission;
  assert.throws(() => resolveMetricServingAdmissionF25({
    bundle: value,
    metric_key: first.metric_key,
    metric_version: first.metric_version,
    concept_key: first.concept_key,
    required_claim_definition_key:
      first.required_claim_definition_key,
    metric_serving_admission_id:
      second.metric_serving_admission_id,
    declared_metric_serving_admission_ids: declared,
  }), /did not resolve/);
  assert.throws(() => resolveMetricServingAdmissionF25({
    bundle: value,
    metric_key: first.metric_key,
    metric_version: first.metric_version,
    concept_key: first.concept_key,
    required_claim_definition_key:
      first.required_claim_definition_key,
    metric_serving_admission_id:
      first.metric_serving_admission_id,
    declared_metric_serving_admission_ids: declared.slice(1),
  }), /must equal the F25 manifest/);
});

test('render preparation isolates one malformed item and preserves siblings', () => {
  const records = bundle().categorical_certifications.flatMap(
    (entry) => entry.observation.items.map((item) => ({
      metric_key: entry.observation.metric_key,
      item,
    })),
  );
  assert.equal(records.length, 64);
  const changed = clone(records);
  changed[31].item.canonical_value = 'DRIFTED_VALUE';
  const rendered = prepareF25ItemsForRendering(changed, bundle());
  assert.equal(rendered.length, records.length);
  assert.equal(
    rendered.filter(
      (entry) => entry.render_kind
        === 'CATEGORICAL_MARKET_SUBROW_FAILED',
    ).length,
    1,
  );
  assert.equal(
    rendered.filter(
      (entry) => entry.render_kind
        === 'CATEGORICAL_MARKET_SUBROW',
    ).length,
    records.length - 1,
  );
});

test('render preparation rejects substitution, duplicates and omissions locally', () => {
  const records = bundle().categorical_certifications.flatMap(
    (entry) => entry.observation.items.map((item) => ({
      metric_key: entry.observation.metric_key,
      item,
    })),
  );
  const certifiedItem = clone(records[0].item);
  const typedSubstitution = clone(records);
  typedSubstitution[0] = {
    metric_key: typedSubstitution[0].metric_key,
    item: {
      ...typedSubstitution[0].item,
      canonical_value: 'ATTACKER_SUBSTITUTION',
    },
    state: 'NON_COMPARABLE',
    reason_code: 'REVIEWED_SOURCE_SPECIFIC',
  };
  const typed = prepareF25ItemsForRendering(
    typedSubstitution,
    bundle(),
  );
  assert.equal(
    typed[0].render_kind,
    'CATEGORICAL_MARKET_SUBROW_NON_COMPARABLE',
  );
  assert.deepEqual(typed[0].item, certifiedItem);

  const duplicated = prepareF25ItemsForRendering(
    [...records, clone(records[0])],
    bundle(),
  );
  assert.equal(
    duplicated.filter(
      (entry) => entry.reason_code
        === 'INVALID_F25_CATEGORICAL_ITEM_CERTIFICATION',
    ).length,
    1,
  );
  assert.equal(
    new Set(duplicated.map((entry) => entry.key)).size,
    duplicated.length,
  );

  const omitted = prepareF25ItemsForRendering(
    records.slice(1),
    bundle(),
  );
  assert.equal(
    omitted.filter(
      (entry) => entry.reason_code === 'MISSING_F25_CATEGORICAL_ITEM',
    ).length,
    1,
  );
  assert.equal(
    omitted.filter(
      (entry) => entry.render_kind === 'CATEGORICAL_MARKET_SUBROW',
    ).length,
    records.length - 1,
  );
  assert.equal(
    new Set(omitted.map((entry) => entry.key)).size,
    omitted.length,
  );
});

test('all governed non-value states render explicitly without affecting siblings', () => {
  const firstCarrier = bundle().categorical_certifications[0];
  const [first, second] = firstCarrier.observation.items;
  for (const state of [
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'UNRESOLVED',
    'NON_COMPARABLE',
    'FEATURE_DISABLED',
    'FAILED',
  ]) {
    const rendered = prepareF25ItemsForRendering([
      {
        metric_key: firstCarrier.observation.metric_key,
        item: first,
        state,
        reason_code: `TEST_${state}`,
      },
      {
        metric_key: firstCarrier.observation.metric_key,
        item: second,
      },
    ], bundle());
    assert.equal(
      rendered[0].render_kind,
      `CATEGORICAL_MARKET_SUBROW_${state}`,
    );
    assert.equal(
      rendered[1].render_kind,
      'CATEGORICAL_MARKET_SUBROW',
    );
  }
});

test('rendering is order-independent, cycle-safe and immutable', () => {
  const firstCarrier = bundle().categorical_certifications[0];
  const [first, second] = firstCarrier.observation.items;
  const forgedFirst = prepareF25ItemsForRendering([
    {
      metric_key: firstCarrier.observation.metric_key,
      item_id: first.item_id,
      state: 'FEATURE_DISABLED',
      reason_code: 'FORGED_FIRST',
    },
    {
      metric_key: firstCarrier.observation.metric_key,
      item: first,
    },
  ], bundle());
  assert.equal(
    forgedFirst[0].render_kind,
    'CATEGORICAL_MARKET_SUBROW_FAILED',
  );
  assert.equal(
    forgedFirst[1].render_kind,
    'CATEGORICAL_MARKET_SUBROW',
  );

  const conflictingTyped = prepareF25ItemsForRendering([
    {
      metric_key: firstCarrier.observation.metric_key,
      item_id: first.item_id,
      state: 'FEATURE_DISABLED',
      reason_code: 'DISABLED',
    },
    {
      metric_key: firstCarrier.observation.metric_key,
      item_id: first.item_id,
      state: 'NON_COMPARABLE',
      reason_code: 'SOURCE_SPECIFIC',
    },
  ], bundle());
  assert.equal(
    conflictingTyped.slice(0, 2).every(
      (entry) => entry.render_kind
        === 'CATEGORICAL_MARKET_SUBROW_FAILED',
    ),
    true,
  );

  const cyclic = { item_id: first.item_id };
  cyclic.self = cyclic;
  const cycleSafe = prepareF25ItemsForRendering([
    {
      metric_key: firstCarrier.observation.metric_key,
      item: cyclic,
    },
    {
      metric_key: firstCarrier.observation.metric_key,
      item: second,
    },
  ], bundle());
  assert.equal(
    cycleSafe[0].render_kind,
    'CATEGORICAL_MARKET_SUBROW_FAILED',
  );
  assert.equal(
    cycleSafe[1].render_kind,
    'CATEGORICAL_MARKET_SUBROW',
  );

  const unknownState = prepareF25ItemsForRendering([{
    metric_key: firstCarrier.observation.metric_key,
    item: first,
    state: 'PLAUSIBLE_BUT_UNGOVERNED',
  }], bundle());
  assert.equal(
    unknownState[0].render_kind,
    'CATEGORICAL_MARKET_SUBROW_FAILED',
  );

  const mutableItem = clone(first);
  const prepared = prepareF25ItemsForRendering([{
    metric_key: firstCarrier.observation.metric_key,
    item: mutableItem,
  }], bundle());
  mutableItem.canonical_value = 'POST_VALIDATION_MUTATION';
  assert.equal(
    prepared[0].item.canonical_value,
    first.canonical_value,
  );
  assert.equal(Object.isFrozen(prepared), true);
  assert.equal(Object.isFrozen(prepared[0].item), true);
});

test('outer re-signing cannot escape the exact frozen F25 identity', () => {
  const changed = clone(bundle());
  changed.combined_market_request.database_call_budget = 2;
  const {
    no_shop_actions_certification_bundle_f25_id: _id,
    canonical_payload_digest: _digest,
    ...body
  } = changed;
  changed.no_shop_actions_certification_bundle_f25_id = contentId(
    'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25/V1',
    body,
  );
  changed.canonical_payload_digest = contentId(
    'NO_SHOP_ACTIONS_CERTIFICATION_BUNDLE_F25_PAYLOAD/V1',
    body,
  );
  assert.throws(
    () => validateF25EnvelopeIdentity(changed),
    /exact F25 certification envelope/,
  );
});

test('the combined market request is one cacheable corpus-independent call', () => {
  const request = bundle().combined_market_request;
  assert.equal(request.execution_shape, 'ONE_INDEXED_SET_BASED_SQL');
  assert.equal(request.database_call_budget, 1);
  assert.equal(request.immediate_retries, 0);
  assert.equal(request.metric_bindings.length, 5);
  assert.equal(/^[a-f0-9]{64}$/.test(request.cache_key), true);
  assert.deepEqual(
    request.metric_bindings.map(
      (entry) => entry.metric_serving_admission_id,
    ).sort(),
    bundle().manifest.new_metric_serving_admission_ids,
  );
  assert.equal(
    request.metric_bindings.every(
      (entry) => entry.party
        && entry.source_binding.document_hash
          === bundle().categorical_certifications[0]
            .observation.document_hash
        && entry.source_binding.canonical_text_id
          === bundle().categorical_certifications[0]
            .observation.canonical_text_id,
    ),
    true,
  );
  assert.deepEqual(Object.keys(request.filters).sort(), [
    'adviser_either',
    'buyer',
    'lawyer_either',
    'max_value_usd',
    'merger_form',
    'min_value_usd',
    'sector',
    'year_from',
    'year_to',
  ]);
  assert.equal(
    bundle().manifest.serving_plan
      .database_call_growth_with_corpus_size,
    'CONSTANT',
  );
});

test('execution bindings close each carrier through source, manifest and cache identity', () => {
  const value = bundle();
  assert.deepEqual(
    buildServingExecutionBindings(
      value.categorical_certifications,
      value.combined_market_request,
      value.manifest,
    ),
    value.serving_execution_bindings,
  );
  for (const binding of value.serving_execution_bindings) {
    const carrierValue = carrier(binding.metric_key);
    assert.equal(binding.certification_manifest_id, F25_MANIFEST_ID);
    assert.equal(
      binding.metric_serving_admission_id,
      carrierValue.metric_serving_admission
        .metric_serving_admission_id,
    );
    assert.equal(
      binding.source_binding.document_hash,
      carrierValue.observation.document_hash,
    );
    assert.deepEqual(binding.party, carrierValue.observation.party);
    assert.equal(
      binding.release_aware_cache_key,
      value.combined_market_request.cache_key,
    );
  }
});

test('the request compiler accepts only bounded governed refinements', () => {
  const compiled = compileF25CombinedMarketRequest({
    bundle: bundle(),
    filters: {
      buyer: 'QXO, Inc.',
      year_from: 2024,
      year_to: 2026,
      min_value_usd: '10000000',
      max_value_usd: '5000000000.00',
    },
  });
  assert.equal(
    compiled.execution_state,
    'COMPILED_CERTIFICATION_SIMULATION_ONE_INDEXED_SET_BASED_RPC',
  );
  assert.equal(compiled.filters.buyer, 'QXO, Inc.');
  assert.notEqual(
    compiled.cache_key,
    bundle().combined_market_request.cache_key,
  );
  assert.throws(() => compileF25CombinedMarketRequest({
    bundle: bundle(),
    filters: { unknown_filter: true },
  }), /outside the closed contract/);
  assert.throws(() => compileF25CombinedMarketRequest({
    bundle: bundle(),
    filters: { year_from: 2027, year_to: 2026 },
  }), /cannot exceed/);
  assert.throws(() => compileF25CombinedMarketRequest({
    bundle: bundle(),
    filters: { min_value_usd: '1e9' },
  }), /canonical decimal string/);
});

test('one execution uses one RPC and the identical cache hit uses zero', async () => {
  const stored = new Map();
  const cache = {
    get: async (key) => stored.get(key),
    set: async (key, value) => stored.set(key, value),
  };
  let rpcCalls = 0;
  const rpc = async (request) => {
    rpcCalls += 1;
    return sealedExecutionResult(request);
  };
  const first = await executeF25CombinedMarketRequest({
    bundle: bundle(),
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(first.execution_source, 'RPC');
  assert.equal(first.database_calls, 1);
  assert.equal(first.immediate_retries, 0);
  assert.equal(rpcCalls, 1);
  const second = await executeF25CombinedMarketRequest({
    bundle: bundle(),
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(second.execution_source, 'CACHE');
  assert.equal(second.database_calls, 0);
  assert.equal(rpcCalls, 1);
});

test('execution snapshots validated RPC bytes before an awaited cache write', async () => {
  let mutableRpcResult;
  let cachedValue;
  const execution = await executeF25CombinedMarketRequest({
    bundle: bundle(),
    cache: {
      get: async () => null,
      set: async (_key, value) => {
        cachedValue = value;
        mutableRpcResult.certification_manifest_id = 'f'.repeat(64);
      },
    },
    rpc: async (request) => {
      mutableRpcResult = sealedExecutionResult(request);
      return mutableRpcResult;
    },
  });
  assert.equal(
    execution.result.certification_manifest_id,
    F25_MANIFEST_ID,
  );
  assert.equal(
    cachedValue.certification_manifest_id,
    F25_MANIFEST_ID,
  );
  assert.equal(Object.isFrozen(execution.result), true);
});

test('poisoned RPC and cache results are rejected and never cached', async () => {
  const request = compileF25CombinedMarketRequest({
    bundle: bundle(),
  });
  const poisoned = sealedExecutionResult(request, (body) => ({
    ...body,
    certification_manifest_id: 'f'.repeat(64),
  }));
  assert.throws(
    () => validateF25ExecutionResult(poisoned, request),
    /identity does not match/,
  );
  let cacheSets = 0;
  await assert.rejects(
    executeF25CombinedMarketRequest({
      bundle: bundle(),
      cache: {
        get: async () => null,
        set: async () => {
          cacheSets += 1;
        },
      },
      rpc: async () => poisoned,
    }),
    /identity does not match/,
  );
  assert.equal(cacheSets, 0);
  await assert.rejects(
    executeF25CombinedMarketRequest({
      bundle: bundle(),
      cache: {
        get: async () => poisoned,
        set: async () => {
          throw new Error('must not write after poisoned cache');
        },
      },
      rpc: async () => {
        throw new Error('must not call RPC after poisoned cache');
      },
    }),
    /identity does not match/,
  );
});

test('RPC grouping tuples cannot cross-swap governed legal semantics', () => {
  const request = compileF25CombinedMarketRequest({
    bundle: bundle(),
  });
  const effectBinding = request.metric_bindings.find(
    (entry) => entry.metric_key === 'NO_SHOP_EXCEPTION_EFFECT',
  );
  const inferred = effectBinding.governed_grouping_tuples.find(
    (entry) => entry.derivation_mode
      === 'INFERRED_BY_PARTICIPATION_SUBSUMPTION',
  );
  const invalidTuple = {
    ...inferred,
    derivation_mode: 'DIRECT_SOURCE_TEXT',
  };
  assert.equal(
    effectBinding.governed_grouping_tuples.some(
      (entry) => canonicalJson(entry) === canonicalJson(invalidTuple),
    ),
    false,
  );
  const poisoned = sealedExecutionResult(request, (body) => ({
    ...body,
    metric_results: body.metric_results.map((entry) => (
      entry.metric_key === effectBinding.metric_key
        ? {
          ...entry,
          groups: [{
            grouping_tuple: invalidTuple,
            deal_count: 1,
            subject_count: 1,
            percentage: '100',
            state: 'PRESENT',
            reason_code: null,
          }],
        }
        : entry
    )),
  }));
  assert.throws(
    () => validateF25ExecutionResult(poisoned, request),
    /group is invalid/,
  );
});

test('RPC aggregates and percentages must reconcile before caching', () => {
  const request = compileF25CombinedMarketRequest({
    bundle: bundle(),
  });
  const binding = request.metric_bindings[0];
  const poisoned = sealedExecutionResult(request, (body) => ({
    ...body,
    metric_results: body.metric_results.map((entry) => (
      entry.metric_key === binding.metric_key
        ? {
          ...entry,
          counts: {
            eligible_deals: 1,
            comparable_deals: 1,
            excluded_deals: 999,
          },
          groups: [{
            grouping_tuple: binding.governed_grouping_tuples[0],
            deal_count: 999999,
            subject_count: 888888,
            percentage: '0',
            state: 'PRESENT',
            reason_code: null,
          }],
        }
        : entry
    )),
  }));
  assert.throws(
    () => validateF25ExecutionResult(poisoned, request),
    /identity or bounds have drifted/,
  );

  const valid = sealedExecutionResult(request, (body) => ({
    ...body,
    metric_results: body.metric_results.map((entry) => (
      entry.metric_key === binding.metric_key
        ? {
          ...entry,
          groups: [{
            grouping_tuple: binding.governed_grouping_tuples[0],
            deal_count: 1,
            subject_count: 1,
            percentage: '100',
            state: 'PRESENT',
            reason_code: null,
          }],
        }
        : entry
    )),
  }));
  assert.equal(validateF25ExecutionResult(valid, request), true);

  const unsafe = sealedExecutionResult(request, (body) => ({
    ...body,
    metric_results: body.metric_results.map((entry, index) => (
      index === 0
        ? {
          ...entry,
          counts: {
            eligible_deals: Number.MAX_SAFE_INTEGER + 1,
            comparable_deals: 1,
            excluded_deals: 0,
          },
        }
        : entry
    )),
  }));
  assert.throws(
    () => validateF25ExecutionResult(unsafe, request),
    /identity or bounds have drifted/,
  );
});

test('RPC typed states require explicit reasons and include feature-disabled', () => {
  const request = compileF25CombinedMarketRequest({
    bundle: bundle(),
  });
  const binding = request.metric_bindings[0];
  function resultWithGroup(state, reasonCode) {
    return sealedExecutionResult(request, (body) => ({
      ...body,
      metric_results: body.metric_results.map((entry) => (
        entry.metric_key === binding.metric_key
          ? {
            ...entry,
            counts: {
              eligible_deals: 1,
              comparable_deals: 1,
              excluded_deals: 0,
            },
            groups: [{
              grouping_tuple:
                binding.governed_grouping_tuples[0],
              deal_count: 1,
              subject_count: 1,
              percentage: '100',
              state,
              reason_code: reasonCode,
            }],
          }
          : entry
      )),
    }));
  }
  assert.equal(
    validateF25ExecutionResult(
      resultWithGroup('FEATURE_DISABLED', 'FEATURE_FLAG_OFF'),
      request,
    ),
    true,
  );
  assert.throws(
    () => validateF25ExecutionResult(
      resultWithGroup('UNRESOLVED', null),
      request,
    ),
    /group is invalid/,
  );
});

test('F25 grants no route, release, pointer, write or production authority', () => {
  const value = bundle();
  for (const authority of [
    value.manifest.authority,
    ...value.categorical_certifications.map(
      (entry) => entry.authority,
    ),
  ]) {
    for (const result of Object.values(authority)) {
      assert.equal(result, 'NONE');
    }
  }
  assert.equal(value.manifest.status.publication_blocked, true);
  assert.equal(value.manifest.status.release_eligible, false);
  assert.equal(
    value.categorical_certifications.every(
      (entry) => entry.status.publication_blocked
        && !entry.status.release_eligible,
    ),
    true,
  );
});

test('canonical source identity is recomputed rather than trusted', () => {
  const text = 'source-backed no-shop text';
  const source = {
    source_content_id: contentId('TEST_SOURCE/V1', { text }),
    converter_digest: contentId('TEST_CONVERTER/V1', {}),
    converter_config_digest:
      contentId('TEST_CONVERTER_CONFIG/V1', {}),
    source_map_digest: contentId('TEST_SOURCE_MAP/V1', {}),
    canonical_text_sha256: sha256Hex(Buffer.from(text)),
    canonical_text_byte_length: Buffer.byteLength(text),
  };
  source.canonical_text_id = contentId(
    'SEC_CANONICAL_TEXT/V2',
    {
      source_response_content_id: source.source_content_id,
      converter_digest: source.converter_digest,
      converter_config_digest: source.converter_config_digest,
      canonical_text_sha256: source.canonical_text_sha256,
      canonical_text_byte_length: source.canonical_text_byte_length,
      source_map_digest: source.source_map_digest,
    },
  );
  source.canonical_text = {
    canonical_text_id: source.canonical_text_id,
    text,
  };
  assert.equal(__test.canonicalTextIdentityMatches(source), true);
  const changed = clone(source);
  changed.canonical_text.text = `${text}!`;
  assert.equal(__test.canonicalTextIdentityMatches(changed), false);

  const contextBody = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    value: 'source',
  };
  const context = {
    ...contextBody,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      contextBody,
    ),
  };
  assert.equal(__test.sourceContextIdentityMatches(context), true);
  context.value = 'drifted';
  assert.equal(__test.sourceContextIdentityMatches(context), false);
});

test('the staging runner is rollback-only, bounded and set-based', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  const begin = source.indexOf(
    '// F25_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN',
  );
  const end = source.indexOf(
    '// F25_ROLLBACK_ONLY_STAGING_CERTIFICATION_END',
  );
  assert.equal(begin >= 0 && end > begin, true);
  const f25Source = source.slice(begin, end);
  assert.match(source, /--no-shop-actions-f25-print/);
  assert.match(source, /--no-shop-actions-f25-verify/);
  assert.match(f25Source, /jsonb_to_recordset/);
  assert.match(f25Source, /SET LOCAL lock_timeout = '2000ms'/);
  assert.match(f25Source, /SET LOCAL statement_timeout = '15000ms'/);
  assert.match(f25Source, /ENABLE ROW LEVEL SECURITY/);
  assert.match(f25Source, /REVOKE ALL/);
  assert.match(f25Source, /ROLLBACK;/);
  assert.doesNotMatch(f25Source, /\bCOMMIT\b/);
  assert.equal(
    (f25Source.match(/\bINSERT INTO\b/g) || []).length,
    1,
  );
  assert.equal(
    fixture.staging_execution.active_pointer_unchanged,
    true,
  );
  assert.equal(fixture.staging_execution.rollback_verified, true);
  assert.equal(fixture.staging_execution.durable_rows_written, 0);
  assert.equal(
    fixture.staging_execution.post_rollback.probe_table_exists,
    false,
  );
  assert.deepEqual(
    fixture.staging_execution.transaction.active_pointer_during,
    fixture.staging_execution.active_pointer_before,
  );
  assert.deepEqual(
    fixture.staging_execution.post_rollback.active_pointer_after,
    fixture.staging_execution.active_pointer_before,
  );
  assert.equal(fixture.staging_execution.immediate_retries, 0);
  assert.equal(
    fixture.staging_execution
      .serving_request_database_call_budget,
    1,
  );
  const {
    qxo_no_shop_actions_f25_staging_attestation_id: attestationId,
    canonical_payload_digest: attestationDigest,
    ...attestationBody
  } = fixture;
  assert.equal(
    attestationId,
    contentId(
      'QXO_NO_SHOP_ACTIONS_F25_STAGING_ATTESTATION/V1',
      attestationBody,
    ),
  );
  assert.equal(
    attestationDigest,
    contentId(
      'QXO_NO_SHOP_ACTIONS_F25_STAGING_ATTESTATION_PAYLOAD/V1',
      attestationBody,
    ),
  );
  assert.doesNotMatch(
    moduleSource,
    /pages\/api|FEATURE_[A-Z_]+\s*=\s*true/,
  );
});

test('the F25 phase allowlist contains only the certification slice', () => {
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  assert.equal(
    allowlist.phase,
    'WP-CANONICAL-NO-SHOP-ACTIONS-CERTIFICATION-F25',
  );
  assert.deepEqual(allowlist.allowed, [
    ALLOWLIST,
    'docs/superpowers/plans/2026-07-27-no-shop-actions-certification-f25-plan.md',
    MODULE,
    RUNNER,
    'tests/canonical-v2-no-shop-actions-certification-f25.test.js',
    'tests/fixtures/canonical-v2/qxo-no-shop-actions-f25-staging-attestation.json',
    'tests/helpers/canonical-v2-staging-runner-scope.js',
  ]);
  for (const denied of [
    '.env*',
    'components/**',
    'lib/canonical-v2/contract-bundle.js',
    'pages/**',
    'sql/**',
    'supabase/**',
    'next.config.js',
  ]) {
    assert.equal(allowlist.denied.includes(denied), true, denied);
  }
});
