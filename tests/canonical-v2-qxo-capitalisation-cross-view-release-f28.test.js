const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildQxoReviewedCapitalisationF28,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f28');
const {
  SURFACES,
  buildQxoCapitalisationCrossViewReleaseF28,
  buildSubjectOnlyF28MarketResult,
  compileQxoCapitalisationF28MarketRequest,
  executeQxoCapitalisationF28MarketRequest,
  validateQxoCapitalisationCrossViewReleaseF28,
  validateQxoCapitalisationF28MarketResult,
} = require('../lib/canonical-v2/qxo-capitalisation-cross-view-release-f28');
const {
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture() {
  const inputs = buildF27Inputs();
  const reviewedGraph = buildQxoReviewedCapitalisationF28(inputs);
  const release = buildQxoCapitalisationCrossViewReleaseF28({
    reviewedGraph,
    ...inputs,
  });
  return { inputs, reviewedGraph, release };
}

function sealResult(value) {
  const body = clone(value);
  delete body.canonical_payload_digest;
  value.canonical_payload_digest = contentId(
    'QXO_CAPITALISATION_MARKET_RESULT_F28_PAYLOAD/V1',
    body,
  );
  return value;
}

function sealRelease(value) {
  const body = clone(value);
  delete body.qxo_capitalisation_cross_view_release_f28_id;
  delete body.canonical_payload_digest;
  value.qxo_capitalisation_cross_view_release_f28_id = contentId(
    'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28/V1',
    body,
  );
  value.canonical_payload_digest = contentId(
    'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F28_PAYLOAD/V1',
    body,
  );
  return value;
}

test('F28 publishes six shared rows and fourteen typed market metrics', () => {
  const { inputs, reviewedGraph, release } = fixture();
  assert.equal(validateQxoCapitalisationCrossViewReleaseF28({
    candidate: release,
    reviewedGraph,
    ...inputs,
  }), true);
  assert.equal(release.provision_row.subrows.length, 6);
  assert.deepEqual(
    release.provision_row.subrows.map(
      (entry) => entry.market_context.metric_results.length,
    ),
    [5, 5, 1, 1, 1, 1],
  );
  const metricResults = release.provision_row.subrows.flatMap(
    (entry) => entry.market_context.metric_results,
  );
  assert.ok(metricResults.filter(
    (entry) => entry.subject_cohort_membership.status === 'INCLUDED',
  ).every(
    (entry) => entry.counts.eligible_deals === 1
      && entry.counts.comparable_deals === 1
      && entry.counts.excluded_deals === 0
      && entry.counts.independent_peer_count === 0
      && entry.state_groups.length === 1
      && entry.state_groups[0].deal_count === 1
      && entry.state_groups[0].percentage === '100',
  ));
  assert.ok(metricResults.filter(
    (entry) => entry.subject_cohort_membership.status === 'EXCLUDED',
  ).every(
    (entry) => entry.counts.eligible_deals === 1
      && entry.counts.comparable_deals === 0
      && entry.counts.excluded_deals === 1
      && entry.counts.independent_peer_count === 0,
  ));
  assert.equal(release.admissions.length, 14);
  assert.equal(release.observations.length, 13);
  assert.equal(release.exclusions.length, 1);
  assert.deepEqual(
    release.exclusions.map((entry) => ({
      slot: entry.value_slot_key,
      metric: entry.metric_key,
      state: entry.state,
      reason: entry.semantic_terms.reason_code,
    })),
    [{
      slot: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
      metric: 'REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR',
      state: 'NOT_APPLICABLE',
      reason: 'ACCURACY_EXCEPTION_ABSENT',
    }],
  );
  assert.equal(
    release.provision_row.generic_no_market_data_authority,
    'FORBIDDEN',
  );
  assert.ok(release.provision_row.subrows.every(
    (entry) => entry.market_context.subject_deal_included === true
      && entry.market_context.subject_cohort_membership.status === 'INCLUDED'
      && entry.market_context.subject_cohort_membership.exclusion_reason === null
      && entry.market_context.counts.comparable_deals === 1
      && entry.market_context.counts.independent_peer_count === 0
      && entry.market_context.state
        === 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS'
      && entry.market_context.reason_code
        === 'ZERO_INDEPENDENT_COMPARABLE_DEALS',
  ));
  const metricMemberships = release.provision_row.subrows.flatMap(
    (entry) => entry.market_context.metric_results.map(
      (metric) => metric.subject_cohort_membership,
    ),
  );
  assert.equal(
    metricMemberships.filter((entry) => entry.status === 'INCLUDED').length,
    13,
  );
  assert.deepEqual(
    metricMemberships.filter((entry) => entry.status === 'EXCLUDED'),
    [{
      status: 'EXCLUDED',
      exclusion_reason:
        'TYPED_NON_COMPARABILITY:ACCURACY_EXCEPTION_ABSENT',
    }],
  );
});

test('F28 keeps exact legal terms, class boundaries and source lineage', () => {
  const { release } = fixture();
  const observations = new Map(release.observations.map((entry) => [
    `${entry.value_slot_key}:${entry.metric_key}`,
    entry,
  ]));
  assert.equal(
    observations.get(
      'CAPITALISATION_CLAUSE_B_LIMBS_I_III:REPRESENTATION_ACCURACY_STANDARD',
    ).canonical_value,
    'MAT_ALL_RESPECTS_DE_MINIMIS',
  );
  assert.equal(
    observations.get(
      'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V:REPRESENTATION_ACCURACY_STANDARD',
    ).canonical_value,
    'MAT_ALL_MATERIAL',
  );
  assert.deepEqual(
    observations.get(
      'CAPITALISATION_CLAUSE_B_LIMBS_I_III:REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR',
    ).canonical_value,
    {
      basis: 'FULLY_DILUTED_EQUITY_CAPITALISATION',
      party_value: 'COMPANY',
    },
  );
  assert.equal(
    observations.get(
      'CAPITALISATION_MEASUREMENT_DATE:REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET',
    ).canonical_value,
    -1,
  );
  for (const key of [
    'GENERAL_KNOWLEDGE_QUALIFIER:KNOWLEDGE_QUALIFIER_STATE',
    'GENERAL_MATERIALITY_QUALIFIER:GENERAL_MATERIALITY_QUALIFIER_STATE',
    'RETROSPECTIVE_LOOKBACK:RETROSPECTIVE_LOOKBACK_STATE',
  ]) {
    const observation = observations.get(key);
    assert.equal(observation.state, 'ABSENT');
    assert.equal(observation.canonical_value, null);
    assert.equal(observation.semantic_terms.coverage_status, 'COMPLETE');
    assert.match(observation.semantic_terms.scope_closure_id, /^[a-f0-9]{64}$/);
  }
  assert.ok(release.observations.every(
    (entry) => entry.source_lineage.document_hash
      === release.provision_row.document_hash
      && entry.source_lineage.evidence_reference_ids.length > 0,
  ));
});

test('F28 binds identical row bytes to all four product surfaces', () => {
  const { release } = fixture();
  assert.deepEqual(Object.keys(release.surface_bindings).sort(), SURFACES);
  for (const surface of SURFACES) {
    assert.equal(
      canonicalJson(release.surface_bindings[surface].provision_row),
      canonicalJson(release.provision_row),
    );
  }
});

test('F28 compiles one bounded request for all fourteen metrics', () => {
  const { release } = fixture();
  const request = compileQxoCapitalisationF28MarketRequest({
    release,
    filters: {
      buyer: 'Acquirer',
      year_from: 2020,
      year_to: 2026,
      min_value_usd: '1000000',
      max_value_usd: '50000000000.25',
    },
  });
  assert.equal(request.database_call_budget, 1);
  assert.equal(request.immediate_retries, 0);
  assert.equal(request.metric_bindings.length, 14);
  assert.equal(
    request.subject_membership_policy,
    'INCLUDE_IF_ELIGIBLE_COMPARABLE_AND_IN_CORPUS',
  );
  assert.equal(
    request.independent_peer_count_predicate,
    'GOVERNED_DEAL_KEY_NOT_EQUAL_SUBJECT_DEAL_KEY',
  );
  assert.equal(
    request.metric_bindings.filter(
      (entry) => entry.subject_cohort_membership.status === 'INCLUDED',
    ).length,
    13,
  );
  assert.equal(request.filters.buyer, 'Acquirer');
  assert.throws(
    () => compileQxoCapitalisationF28MarketRequest({
      release,
      filters: { year_from: 2026, year_to: 2020 },
    }),
    /year filters are inverted/,
  );
  assert.throws(
    () => compileQxoCapitalisationF28MarketRequest({
      release,
      filters: { unknown: 'value' },
    }),
    /closed contract/,
  );
});

test('F28 validates subject-only, peer and isolated failed slots', () => {
  const { release } = fixture();
  const request = compileQxoCapitalisationF28MarketRequest({ release });
  const subjectOnly = buildSubjectOnlyF28MarketResult(request);
  assert.equal(
    validateQxoCapitalisationF28MarketResult(subjectOnly, request),
    true,
  );
  assert.equal(
    subjectOnly.slot_results.filter(
      (entry) => entry.result_state
        === 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
    ).length,
    13,
  );
  assert.equal(
    subjectOnly.slot_results.filter(
      (entry) => entry.result_state
        === 'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY',
    ).length,
    1,
  );

  const ready = clone(subjectOnly);
  Object.assign(ready.slot_results[0], {
    result_state: 'READY',
    counts: {
      eligible_deals: 2,
      comparable_deals: 2,
      excluded_deals: 0,
      independent_peer_count: 1,
    },
    state_groups: [{
      state: 'PRESENT',
      deal_count: 2,
      percentage: '100',
    }],
    value_groups: [{
      state: 'PRESENT',
      canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      deal_count: 2,
      percentage: '100',
    }],
    cohort_reason_code: null,
  });
  assert.equal(
    validateQxoCapitalisationF28MarketResult(
      sealResult(ready),
      request,
    ),
    true,
  );

  const failed = clone(subjectOnly);
  Object.assign(failed.slot_results[3], {
    result_state: 'FAILED',
    state_groups: [],
    value_groups: [],
    numeric_summary: null,
    cohort_reason_code: null,
    failure_reason_code: 'METRIC_VALUE_VALIDATION_FAILED',
  });
  assert.equal(
    validateQxoCapitalisationF28MarketResult(
      sealResult(failed),
      request,
    ),
    true,
  );
  assert.equal(failed.slot_results.length, 14);
  assert.ok(failed.slot_results.slice(0, 3).every(
    (entry) => entry.result_state
      === 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
  ));
  assert.ok(failed.slot_results.slice(4).every(
    (entry) => [
      'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
      'SUBJECT_EXCLUDED_TYPED_NON_COMPARABILITY',
    ].includes(entry.result_state),
  ));
});

test('F28 validates a non-empty signed-duration market slot', () => {
  const { release } = fixture();
  const request = compileQxoCapitalisationF28MarketRequest({ release });
  const result = clone(buildSubjectOnlyF28MarketResult(request));
  const durationIndex = request.metric_bindings.findIndex(
    (binding) => binding.metric_key
      === 'REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET',
  );
  assert.ok(durationIndex >= 0);
  Object.assign(result.slot_results[durationIndex], {
    result_state: 'READY',
    counts: {
      eligible_deals: 3,
      comparable_deals: 3,
      excluded_deals: 0,
      independent_peer_count: 2,
    },
    state_groups: [{
      state: 'PRESENT',
      deal_count: 3,
      percentage: '100',
    }],
    value_groups: [{
      state: 'PRESENT',
      canonical_value: -1,
      deal_count: 3,
      percentage: '100',
    }],
    numeric_summary: {
      count: 3,
      min: -1,
      max: -1,
      median: -1,
      mean: '-1',
    },
    cohort_reason_code: null,
  });
  assert.equal(
    validateQxoCapitalisationF28MarketResult(
      sealResult(result),
      request,
    ),
    true,
  );
});

test('F28 refuses slot reordering, peer leakage, untyped subject exclusion and rehashed drift', () => {
  const { release } = fixture();
  const request = compileQxoCapitalisationF28MarketRequest({ release });
  const subjectOnly = buildSubjectOnlyF28MarketResult(request);

  const reordered = clone(subjectOnly);
  [
    reordered.slot_results[0],
    reordered.slot_results[1],
  ] = [
    reordered.slot_results[1],
    reordered.slot_results[0],
  ];
  assert.throws(
    () => validateQxoCapitalisationF28MarketResult(
      sealResult(reordered),
      request,
    ),
    /invalid or reordered/,
  );

  const leaked = clone(subjectOnly);
  leaked.slot_results[0]
    .subject_membership_verification.selected_cohort_subject_deals = 0;
  assert.throws(
    () => validateQxoCapitalisationF28MarketResult(
      sealResult(leaked),
      request,
    ),
    /invalid or reordered/,
  );

  const subjectCountedAsPeer = clone(subjectOnly);
  Object.assign(subjectCountedAsPeer.slot_results[0], {
    result_state: 'READY',
    counts: {
      eligible_deals: 2,
      comparable_deals: 2,
      excluded_deals: 0,
      independent_peer_count: 2,
    },
    state_groups: [{
      state: 'PRESENT',
      deal_count: 2,
      percentage: '100',
    }],
    value_groups: [{
      state: 'PRESENT',
      canonical_value: request.metric_bindings[0].subject_canonical_value,
      deal_count: 2,
      percentage: '100',
    }],
    cohort_reason_code: null,
  });
  assert.throws(
    () => validateQxoCapitalisationF28MarketResult(
      sealResult(subjectCountedAsPeer),
      request,
    ),
    /invalid or reordered/,
  );

  const untypedExclusion = clone(subjectOnly);
  untypedExclusion.slot_results[0].subject_cohort_membership = {
    status: 'EXCLUDED',
    exclusion_reason: 'NO_INDEPENDENT_COMPARABLE_DEALS',
  };
  assert.throws(
    () => validateQxoCapitalisationF28MarketResult(
      sealResult(untypedExclusion),
      request,
    ),
    /invalid or reordered/,
  );

  const forged = clone(release);
  forged.admissions[0].canonical_unit = 'INVENTED_UNIT';
  const admissionBody = clone(forged.admissions[0]);
  delete admissionBody.metric_serving_admission_id;
  forged.admissions[0].metric_serving_admission_id = contentId(
    'METRIC_SERVING_ADMISSION_F28/V1',
    admissionBody,
  );
  assert.throws(
    () => compileQxoCapitalisationF28MarketRequest({
      release: sealRelease(forged),
    }),
    /admission 0 has drifted/,
  );
});

test('F28 execution uses one RPC, release-aware cache and single flight', async () => {
  const { release } = fixture();
  const values = new Map();
  const cache = {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
  };
  let calls = 0;
  const rpc = async (request) => {
    calls += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return buildSubjectOnlyF28MarketResult(request);
  };
  const [first, second] = await Promise.all([
    executeQxoCapitalisationF28MarketRequest({
      release,
      filters: { sector: 'Industrials' },
      cache,
      rpc,
    }),
    executeQxoCapitalisationF28MarketRequest({
      release,
      filters: { sector: 'Industrials' },
      cache,
      rpc,
    }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(
    [first.execution_source, second.execution_source].sort(),
    ['COALESCED_INFLIGHT', 'RPC'],
  );
  const cached = await executeQxoCapitalisationF28MarketRequest({
    release,
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(cached.execution_source, 'CACHE');
  assert.equal(cached.database_calls, 0);
  assert.equal(calls, 1);
});
