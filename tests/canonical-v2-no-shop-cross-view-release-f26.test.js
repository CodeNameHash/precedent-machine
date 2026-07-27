const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');

const f23 = require(
  './fixtures/canonical-v2/qxo-no-shop-copy-delivery-release-f23-staging-attestation.json',
).candidate_release_bundle;
const f24 = require(
  './fixtures/canonical-v2/qxo-no-shop-timing-f24-staging-attestation.json',
).timing_certification_bundle;
const f25 = require(
  './fixtures/canonical-v2/qxo-no-shop-actions-f25-staging-attestation.json',
).actions_certification_bundle;
const {
  F26_MANIFEST_DIGEST,
  F26_MANIFEST_ID,
  F26_PROVISION_ROW_ID,
  F26_REGISTRY_ID,
  F26_RELEASE_DIGEST,
  F26_RELEASE_ID,
  buildNoShopCrossViewReleaseF26,
  buildNoShopF26Preview,
  compileNoShopF26MarketRequest,
  executeNoShopF26MarketRequest,
  prepareNoShopF26SubrowsForRendering,
  resolveMetricServingAdmissionF26,
  validateAllMetricServingAdmissionsF26,
  validateNoShopF26MarketResult,
  validateNoShopCrossViewReleaseF26,
} = require('../lib/canonical-v2/no-shop-cross-view-release-f26');

function release() {
  return buildNoShopCrossViewReleaseF26({
    f23_candidate_release: f23,
    f24_timing_certification: f24,
    f25_actions_certification: f25,
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sealedMarketResult(request, mutate = (value) => value) {
  const metricResults = request.metric_bindings.map((binding) => {
    const groupingTuple =
      binding.comparison_contract.governed_grouping_tuples?.[0]
      || { canonical_value: '1' };
    return {
      metric_key: binding.metric_key,
      metric_serving_admission_id:
        binding.metric_serving_admission_id,
      counts: {
        eligible_deals: 1,
        comparable_deals: 1,
        excluded_deals: 0,
      },
      groups: [{
        grouping_tuple: clone(groupingTuple),
        deal_count: 1,
        subject_count: 1,
        percentage: '100',
        state: 'PRESENT',
        reason_code: null,
      }],
    };
  });
  const original = {
    schema_version: 'F26_NO_SHOP_MARKET_RESULT/V1',
    release_id: request.release_id,
    release_manifest_id: request.release_manifest_id,
    request_digest: request.request_digest,
    cache_key: request.cache_key,
    metric_serving_admission_ids:
      request.metric_bindings.map(
        (entry) => entry.metric_serving_admission_id,
      ).sort(),
    metric_results: metricResults,
  };
  const body = mutate(clone(original));
  return {
    ...body,
    canonical_payload_digest: contentId(
      'F26_NO_SHOP_MARKET_RESULT_PAYLOAD/V1',
      body,
    ),
  };
}

test('F26 assembles one inactive content-addressed no-shop release over all nine exact admissions', () => {
  const value = release();
  assert.equal(validateNoShopCrossViewReleaseF26(value), true);
  assert.equal(value.no_shop_cross_view_release_f26_id, F26_RELEASE_ID);
  assert.equal(value.canonical_payload_digest, F26_RELEASE_DIGEST);
  assert.equal(
    value.manifest.no_shop_cross_view_release_manifest_f26_id,
    F26_MANIFEST_ID,
  );
  assert.equal(value.manifest.canonical_payload_digest, F26_MANIFEST_DIGEST);
  assert.equal(
    value.admission_registry.metric_serving_admission_registry_id,
    F26_REGISTRY_ID,
  );
  assert.equal(value.provision_row.provision_row_id, F26_PROVISION_ROW_ID);
  assert.equal(value.manifest.metric_serving_admission_ids.length, 9);
  assert.equal(value.provision_row.subrows.length, 9);
  assert.deepEqual(value.manifest.counts, {
    admissions: 9,
    deals: 1,
    provision_rows: 1,
    metric_subrows: 9,
    timing_subrows: 4,
    categorical_subrows: 5,
    surface_bindings: 4,
  });
  assert.equal(value.manifest.release_state, 'INACTIVE_CANDIDATE');
  assert.equal(value.manifest.activation_eligibility, 'INELIGIBLE_EXPLICIT_ACTIVATION_REQUIRED');
  assert.deepEqual(value.manifest.authority, {
    active_release_authority: 'NONE',
    active_query_authority: 'NONE',
    active_pointer_authority: 'NONE',
    corpus_write_authority: 'NONE',
    production_activation_authority: 'NONE',
  });
  assert.equal(value.provision_row.label, 'No-shop / non-solicit restriction');
  assert.deepEqual(Object.keys(value.surface_bindings), [
    'COMPARE',
    'CORPUS_CONTEXT',
    'QUERY',
    'REVIEW',
  ]);
  for (const binding of Object.values(value.surface_bindings)) {
    assert.equal(binding.provision_row, value.provision_row);
    assert.equal(binding.release_id, value.no_shop_cross_view_release_f26_id);
  }
  assert.doesNotMatch(JSON.stringify(value), /No market data/);
});

test('the committed browser preview is the exact compact projection of the certified release', () => {
  const committed = JSON.parse(fs.readFileSync(
    '__fixtures__/canonical-v2/qxo-no-shop-cross-view-f26.json',
    'utf8',
  ));
  assert.deepEqual(committed, buildNoShopF26Preview(release()));
});

test('the successor central resolver admits every exact F26 metric and rejects identity swaps', () => {
  const value = release();
  const resolutions =
    validateAllMetricServingAdmissionsF26(value);
  assert.equal(resolutions.length, 9);
  assert.equal(
    resolutions.filter(
      (entry) => entry.predecessor_resolution
        === 'F24_TIMING_CERTIFICATION_VALIDATED',
    ).length,
    3,
  );
  assert.equal(
    resolutions.filter(
      (entry) => entry.predecessor_resolution
        === 'F25_CATEGORICAL_CERTIFICATION_VALIDATED',
    ).length,
    5,
  );
  const ids = value.manifest.metric_serving_admission_ids;
  for (const admission of value.admission_registry.admission_records) {
    const resolved = resolveMetricServingAdmissionF26({
      release: value,
      metric_key: admission.metric_key,
      metric_version: admission.metric_version,
      concept_key: admission.concept_key,
      required_claim_definition_key: admission.required_claim_definition_key,
      metric_serving_admission_id: admission.metric_serving_admission_id,
      declared_metric_serving_admission_ids: ids,
    });
    assert.equal(resolved.central_admission_validation, 'PASSED');
    assert.equal(resolved.release_manifest_validation, 'PASSED');
    assert.equal(resolved.active_release_authority, 'NONE');
    assert.equal(resolved.production_activation_authority, 'NONE');
  }

  const [first, second] = value.admission_registry.admission_records;
  assert.throws(() => resolveMetricServingAdmissionF26({
    release: value,
    metric_key: first.metric_key,
    metric_version: first.metric_version,
    concept_key: first.concept_key,
    required_claim_definition_key: first.required_claim_definition_key,
    metric_serving_admission_id: second.metric_serving_admission_id,
    declared_metric_serving_admission_ids: ids,
  }), /identity|admission/i);
  assert.throws(() => resolveMetricServingAdmissionF26({
    release: value,
    metric_key: first.metric_key,
    metric_version: first.metric_version,
    concept_key: first.concept_key,
    required_claim_definition_key: first.required_claim_definition_key,
    metric_serving_admission_id: first.metric_serving_admission_id,
    declared_metric_serving_admission_ids: ids.slice(1),
  }), /declared|manifest/i);
});

test('duration normalisation, day basis, triggers and the copy-clock ambiguity survive release assembly', () => {
  const value = release();
  const byMetric = new Map(value.provision_row.subrows.map(
    (row) => [row.metric_key, row],
  ));
  const copy = byMetric.get('NO_SHOP_COPY_DELIVERY_PERIOD_DAYS');
  const notice = byMetric.get('NO_SHOP_NOTICE_PERIOD_DAYS');
  const initial = byMetric.get('NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');
  const subsequent = byMetric.get('NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS');

  assert.equal(copy.subject.canonical_value, '1');
  assert.equal(copy.subject.day_basis, 'ELAPSED');
  assert.equal(copy.subject.raw_value, 'twenty-four (24) hours after receipt');
  assert.equal(copy.lawyer_warning.required, true);
  assert.match(copy.lawyer_warning.text, /receipt by the Company/i);
  assert.equal(notice.subject.raw_value.magnitude, '24');
  assert.equal(notice.subject.raw_value.unit, 'HOURS');
  assert.equal(notice.subject.canonical_value, '1');
  assert.equal(notice.subject.day_basis, 'ELAPSED');
  assert.equal(initial.subject.canonical_value, '4');
  assert.equal(initial.subject.day_basis, 'BUSINESS');
  assert.equal(subsequent.subject.canonical_value, '4');
  assert.equal(subsequent.subject.day_basis, 'BUSINESS');
  assert.notEqual(initial.comparability_class_digest, notice.comparability_class_digest);
  for (const row of [copy, notice, initial, subsequent]) {
    assert.equal(
      row.market_context.independent_comparable_deals,
      0,
    );
    assert.equal(row.market_context.counts.comparable_deals, 0);
    assert.deepEqual(row.market_context.distribution, []);
    if ('distribution_deals' in row.market_context.counts) {
      assert.equal(
        row.market_context.counts.distribution_deals,
        0,
      );
    }
  }
});

test('categorical identities, exact grouping dimensions and warnings remain distinct', () => {
  const value = release();
  const byMetric = new Map(value.provision_row.subrows.map(
    (row) => [row.metric_key, row],
  ));
  const actions = byMetric.get('NO_SHOP_PROHIBITED_ACTION');
  const knowledge = byMetric.get('NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER');
  const prerequisites = byMetric.get('NO_SHOP_EXCEPTION_PREREQUISITE');
  const effects = byMetric.get('NO_SHOP_EXCEPTION_EFFECT');
  const inline = byMetric.get('NO_SHOP_INLINE_PERMISSION_EFFECT');

  assert.equal(actions.subject.items.length, 23);
  assert.equal(knowledge.subject.items.length, 23);
  assert.equal(prerequisites.subject.items.length, 10);
  assert.equal(effects.subject.items.length, 7);
  assert.equal(inline.subject.items.length, 1);
  assert.deepEqual(knowledge.grouping_dimensions, ['action_code']);
  assert.deepEqual(effects.grouping_dimensions, [
    'affected_action_code',
    'derivation_mode',
  ]);
  assert.equal(effects.subject.items.filter(
    (item) => item.lawyer_warning?.required,
  ).length, 2);
  assert.notEqual(actions.metric_serving_admission_id, knowledge.metric_serving_admission_id);
});

test('one invalid subrow fails locally and valid siblings remain renderable on all four surfaces', () => {
  const value = release();
  const rows = clone(value.provision_row.subrows);
  rows.splice(4, 0, {
    metric_key: 'UNRECOGNISED_NO_SHOP_DIMENSION',
    subrow_id: 'not-a-digest',
  });
  const rendered = prepareNoShopF26SubrowsForRendering(rows, value);
  assert.equal(rendered.length, 10);
  assert.equal(rendered.filter((row) => row.render_kind === 'METRIC_SUBROW').length, 9);
  assert.equal(rendered.filter((row) => row.render_kind === 'METRIC_SUBROW_FAILED').length, 1);
  assert.equal(rendered[4].reason_code, 'INVALID_OR_UNRECOGNISED_F26_METRIC_SUBROW');
  assert.equal(rendered[0].render_kind, 'METRIC_SUBROW');
  assert.equal(rendered.at(-1).render_kind, 'METRIC_SUBROW');

  const damagedKnown = clone(value.provision_row.subrows);
  damagedKnown[4].label = 'Damaged';
  const isolated = prepareNoShopF26SubrowsForRendering(
    damagedKnown,
    value,
  );
  assert.equal(isolated.length, 9);
  assert.equal(
    isolated.filter(
      (row) => row.render_kind === 'METRIC_SUBROW_FAILED',
    ).length,
    1,
  );
  assert.equal(
    isolated.some(
      (row) => row.reason_code === 'MISSING_F26_METRIC_SUBROW',
    ),
    false,
  );
});

test('F26 compiles one compact, release-aware and corpus-independent market request', () => {
  const value = release();
  const request = compileNoShopF26MarketRequest({
    release: value,
    filters: {
      lawyer_either: 'Paul, Weiss',
      year_from: 2024,
    },
  });
  assert.equal(request.execution_shape, 'ONE_INDEXED_SET_BASED_SQL_OR_RPC');
  assert.equal(request.database_call_budget, 1);
  assert.equal(request.database_call_growth_with_corpus_size, 'CONSTANT');
  assert.equal(request.immediate_retries, 0);
  assert.equal(request.metric_bindings.length, 9);
  assert.equal(request.release_id, value.no_shop_cross_view_release_f26_id);
  assert.doesNotMatch(JSON.stringify(request), /claims|cards|canonical_text|items/);
  assert.throws(() => compileNoShopF26MarketRequest({
    release: value,
    filters: { unknown_filter: 'x' },
  }), /filter/i);
  assert.throws(() => compileNoShopF26MarketRequest({
    release: value,
    filters: {
      min_value_usd: '2000000000',
      max_value_usd: '1000000000',
    },
  }), /inverted/i);
  assert.throws(() => compileNoShopF26MarketRequest({
    release: value,
    filters: { min_value_usd: '1000000000.0' },
  }), /filter/i);
  assert.match(
    request.execution_state,
    /COMPILED_INACTIVE_CANDIDATE/,
  );
});

test('one F26 execution uses one RPC, a cache hit uses none and poisoned results never cache', async () => {
  const stored = new Map();
  const cache = {
    get: async (key) => stored.get(key),
    set: async (key, value) => stored.set(key, value),
  };
  let rpcCalls = 0;
  const rpc = async (request) => {
    rpcCalls += 1;
    return sealedMarketResult(request);
  };
  const first = await executeNoShopF26MarketRequest({
    release: release(),
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(first.execution_source, 'RPC');
  assert.equal(first.database_calls, 1);
  assert.equal(first.immediate_retries, 0);
  assert.equal(rpcCalls, 1);
  const second = await executeNoShopF26MarketRequest({
    release: release(),
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(second.execution_source, 'CACHE');
  assert.equal(second.database_calls, 0);
  assert.equal(rpcCalls, 1);

  let cacheSets = 0;
  await assert.rejects(
    executeNoShopF26MarketRequest({
      release: release(),
      cache: {
        get: async () => null,
        set: async () => {
          cacheSets += 1;
        },
      },
      rpc: async (request) => sealedMarketResult(
        request,
        (body) => {
          const effect = body.metric_results.find(
            (entry) => entry.metric_key
              === 'NO_SHOP_EXCEPTION_EFFECT',
          );
          effect.groups[0].grouping_tuple.derivation_mode =
            effect.groups[0].grouping_tuple.derivation_mode
              === 'DIRECT_SOURCE_TEXT'
              ? 'INFERRED_BY_PARTICIPATION_SUBSUMPTION'
              : 'DIRECT_SOURCE_TEXT';
          return body;
        },
      ),
    }),
    /grouping/i,
  );
  assert.equal(cacheSets, 0);
});

test('F26 result validation reconciles scalar duration buckets and typed failure states', () => {
  const request = compileNoShopF26MarketRequest({
    release: release(),
  });
  const valid = sealedMarketResult(request);
  assert.equal(
    validateNoShopF26MarketResult(valid, request),
    true,
  );
  const missingDurationDeal = sealedMarketResult(
    request,
    (body) => {
      const duration = body.metric_results.find(
        (entry) => entry.metric_key
          === 'NO_SHOP_NOTICE_PERIOD_DAYS',
      );
      duration.counts.eligible_deals = 2;
      duration.counts.comparable_deals = 2;
      duration.groups[0].percentage = '50';
      return body;
    },
  );
  assert.throws(
    () => validateNoShopF26MarketResult(
      missingDurationDeal,
      request,
    ),
    /reconcile/i,
  );
  const countedFailure = sealedMarketResult(
    request,
    (body) => {
      const group = body.metric_results[0].groups[0];
      group.state = 'FAILED';
      group.reason_code = 'RPC_FAILED';
      return body;
    },
  );
  assert.throws(
    () => validateNoShopF26MarketResult(
      countedFailure,
      request,
    ),
    /grouping/i,
  );
  const duplicateNumericBucket = sealedMarketResult(
    request,
    (body) => {
      const duration = body.metric_results.find(
        (entry) => entry.metric_key
          === 'NO_SHOP_NOTICE_PERIOD_DAYS',
      );
      duration.counts.eligible_deals = 2;
      duration.counts.comparable_deals = 2;
      const first = {
        ...duration.groups[0],
        deal_count: 1,
        subject_count: 1,
        percentage: '50',
      };
      duration.groups = [
        first,
        {
          ...clone(first),
          grouping_tuple: {
            canonical_value: '1.0',
          },
        },
      ].sort((left, right) => (
        JSON.stringify(left.grouping_tuple)
          .localeCompare(JSON.stringify(right.grouping_tuple))
      ));
      return body;
    },
  );
  assert.throws(
    () => validateNoShopF26MarketResult(
      duplicateNumericBucket,
      request,
    ),
    /grouping/i,
  );
});

test('the F26 phase allowlist preserves frozen history and forbids production mutation', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    '.github/phase-allowlists/wp-canonical-cross-view-release-assembly-f26.json',
    'utf8',
  ));
  assert.equal(allowlist.phase, 'WP-CANONICAL-CROSS-VIEW-RELEASE-ASSEMBLY-F26');
  for (const path of [
    'lib/canonical-v2/metric-serving-admission.js',
    'lib/canonical-v2/no-shop-timing-certification-f24.js',
    'lib/canonical-v2/no-shop-actions-certification-f25.js',
    'lib/canonical-v2/shared-serving-row.js',
    'pages/api/**',
    'sql/**',
    'supabase/**',
  ]) {
    assert.equal(allowlist.denied.includes(path), true, path);
  }
});
