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
  buildTypedEmptyF28MarketResult,
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
    (entry) => entry.market_context.state === 'EMPTY_COHORT'
      && entry.market_context.reason_code
        === 'NO_INDEPENDENT_COMPARABLE_DEALS',
  ));
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
    request.subject_exclusion_predicate,
    'GOVERNED_DEAL_KEY_NOT_EQUAL_SUBJECT_DEAL_KEY',
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

test('F28 validates typed empty, ready and isolated failed slots', () => {
  const { release } = fixture();
  const request = compileQxoCapitalisationF28MarketRequest({ release });
  const empty = buildTypedEmptyF28MarketResult(request);
  assert.equal(
    validateQxoCapitalisationF28MarketResult(empty, request),
    true,
  );

  const ready = clone(empty);
  Object.assign(ready.slot_results[0], {
    result_state: 'READY',
    counts: {
      eligible_deals: 2,
      comparable_deals: 1,
      excluded_deals: 1,
    },
    state_groups: [{
      state: 'PRESENT',
      deal_count: 1,
      percentage: '100',
    }],
    value_groups: [{
      state: 'PRESENT',
      canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      deal_count: 1,
      percentage: '100',
    }],
    empty_cohort_reason_code: null,
  });
  assert.equal(
    validateQxoCapitalisationF28MarketResult(
      sealResult(ready),
      request,
    ),
    true,
  );

  const failed = clone(empty);
  Object.assign(failed.slot_results[3], {
    result_state: 'FAILED',
    empty_cohort_reason_code: null,
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
    (entry) => entry.result_state === 'EMPTY_COHORT',
  ));
  assert.ok(failed.slot_results.slice(4).every(
    (entry) => entry.result_state === 'EMPTY_COHORT',
  ));
});

test('F28 refuses slot reordering, subject leakage and rehashed drift', () => {
  const { release } = fixture();
  const request = compileQxoCapitalisationF28MarketRequest({ release });
  const empty = buildTypedEmptyF28MarketResult(request);

  const reordered = clone(empty);
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

  const leaked = clone(empty);
  leaked.slot_results[0].subject_exclusion.residual_subject_deals = 1;
  assert.throws(
    () => validateQxoCapitalisationF28MarketResult(
      sealResult(leaked),
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
    return buildTypedEmptyF28MarketResult(request);
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
