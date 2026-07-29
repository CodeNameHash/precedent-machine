const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  COMPANY_PARTY,
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  buildQxoReviewedCapitalisationF27,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f27');
const {
  SURFACES,
  buildQxoCapitalisationCrossViewReleaseF27,
  buildQxoCapitalisationF27Preview,
  compileQxoCapitalisationF27MarketRequest,
  executeQxoCapitalisationF27MarketRequest,
  prepareQxoCapitalisationF27SubrowsForRendering,
  validateQxoCapitalisationCrossViewReleaseF27,
  validateQxoCapitalisationF27MarketResult,
} = require('../lib/canonical-v2/qxo-capitalisation-cross-view-release-f27');
const {
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');

function build() {
  const inputs = buildF27Inputs();
  const reviewedGraph = buildQxoReviewedCapitalisationF27(inputs);
  const release = buildQxoCapitalisationCrossViewReleaseF27({
    reviewedGraph,
    sourceContext: inputs.sourceContext,
    parserSourceClosure: inputs.parserSourceClosure,
    contractBundle: inputs.contractBundle,
  });
  return { inputs, reviewedGraph, release };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resignReviewedGraphShell(graph) {
  const body = clone(graph);
  delete body.qxo_reviewed_capitalisation_f27_id;
  delete body.canonical_payload_digest;
  return {
    ...body,
    qxo_reviewed_capitalisation_f27_id: contentId(
      'QXO_REVIEWED_CAPITALISATION_F27/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_REVIEWED_CAPITALISATION_F27_PAYLOAD/V1',
      body,
    ),
  };
}

function resignReleaseShell(release) {
  const body = clone(release);
  delete body.qxo_capitalisation_cross_view_release_f27_id;
  delete body.canonical_payload_digest;
  return {
    ...body,
    qxo_capitalisation_cross_view_release_f27_id: contentId(
      'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_CROSS_VIEW_RELEASE_F27_PAYLOAD/V1',
      body,
    ),
  };
}

function resignManifestAndReleaseShell(release) {
  const value = clone(release);
  const manifestBody = clone(value.manifest);
  delete manifestBody.release_manifest_id;
  delete manifestBody.canonical_payload_digest;
  value.manifest = {
    ...manifestBody,
    release_manifest_id: contentId(
      'QXO_CAPITALISATION_RELEASE_MANIFEST_F27/V1',
      manifestBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_RELEASE_MANIFEST_F27_PAYLOAD/V1',
      manifestBody,
    ),
  };
  for (const binding of Object.values(value.surface_bindings)) {
    binding.release_manifest_id = value.manifest.release_manifest_id;
  }
  return resignReleaseShell(value);
}

function sealedResult(request, mutate = (value) => value) {
  const body = mutate({
    schema_version: 'QXO_CAPITALISATION_MARKET_RESULT_F27/V1',
    release_id: request.release_id,
    release_manifest_id: request.release_manifest_id,
    request_digest: request.request_digest,
    cache_key: request.cache_key,
    subject_deal_key: request.subject_deal_key,
    class_results: request.metric_bindings.map((binding) => ({
      comparison_class_key: binding.comparison_class_key,
      metric_serving_admission_id:
        binding.metric_serving_admission_id,
      subject_exclusion: {
        subject_deal_key: request.subject_deal_key,
        subject_market_observation_id:
          binding.subject_market_observation_id,
        exclusion_predicate: request.subject_exclusion_predicate,
        state: 'APPLIED_AND_VERIFIED',
        residual_subject_deals: 0,
        residual_subject_observations: 0,
      },
      counts: {
        eligible_deals: 1,
        comparable_deals: 0,
        excluded_deals: 1,
      },
      groups: [],
      empty_cohort_reason_code:
        'NO_INDEPENDENT_COMPARABLE_DEALS',
    })),
  });
  return {
    ...body,
    canonical_payload_digest: contentId(
      'QXO_CAPITALISATION_MARKET_RESULT_F27_PAYLOAD/V1',
      body,
    ),
  };
}

test('F27 composes one inactive six-subrow provision row with no generic market fallback', () => {
  const { inputs, reviewedGraph, release } = build();
  assert.equal(validateQxoCapitalisationCrossViewReleaseF27({
    candidate: release,
    reviewedGraph,
    sourceContext: inputs.sourceContext,
    parserSourceClosure: inputs.parserSourceClosure,
    contractBundle: inputs.contractBundle,
  }), true);
  assert.equal(release.manifest.release_state, 'INACTIVE_CANDIDATE');
  assert.deepEqual(release.manifest.counts, {
    deals: 1,
    provision_rows: 1,
    primary_subrows: 2,
    contextual_subrows: 4,
    metric_admissions: 2,
    market_observations: 2,
    surface_bindings: 4,
  });
  assert.deepEqual(
    release.provision_row.subrows.map((entry) => ({
      label: entry.label,
      role: entry.row_role,
      state: entry.state,
    })),
    [
      {
        label: 'Clause (B) group',
        role: 'PRIMARY_COMPARABLE_TERM',
        state: 'PRESENT',
      },
      {
        label: 'Clause (C) group',
        role: 'PRIMARY_COMPARABLE_TERM',
        state: 'PRESENT',
      },
      {
        label: 'Measurement date',
        role: 'SUBJECT_CONTEXT',
        state: 'PRESENT',
      },
      {
        label: 'General knowledge qualifier',
        role: 'SUBJECT_CONTEXT',
        state: 'ABSENT',
      },
      {
        label: 'General materiality qualifier',
        role: 'SUBJECT_CONTEXT',
        state: 'ABSENT',
      },
      {
        label: 'Retrospective lookback',
        role: 'SUBJECT_CONTEXT',
        state: 'ABSENT',
      },
    ],
  );
  assert.equal(
    release.provision_row.presentation_order,
    'SUBJECT_TERMS_THEN_MARKET_CONTEXT',
  );
  assert.equal(release.provision_row.prevalence_display, 'SECONDARY');
  assert.equal(release.provision_row.generic_no_market_data_authority, 'NONE');
  assert.doesNotMatch(canonicalJson(release), /No market data|TIER_B|TIER_C/);
  assert.equal(
    Object.values(release.manifest.authority).every(
      (entry) => entry === 'NONE',
    ),
    true,
  );
});

test('Review, Corpus Context, Compare and Query receive the exact same row bytes', () => {
  const { release } = build();
  assert.deepEqual(Object.keys(release.surface_bindings), SURFACES);
  for (const surface of SURFACES) {
    const binding = release.surface_bindings[surface];
    assert.equal(binding.provision_row, release.provision_row);
    assert.equal(
      canonicalJson(binding.provision_row),
      canonicalJson(release.provision_row),
    );
    assert.equal(binding.provision_row_id, release.provision_row.provision_row_id);
  }
});

test('the committed F27 preview is the exact compact cross-view projection', () => {
  const { release } = build();
  const committed = JSON.parse(fs.readFileSync(
    '__fixtures__/canonical-v2/qxo-capitalisation-bring-down-f27.json',
    'utf8',
  ));
  assert.deepEqual(
    committed,
    buildQxoCapitalisationF27Preview(release),
  );
});

test('F27 creates exactly two non-aggregating admissions and observations under one metric', () => {
  const { release } = build();
  assert.deepEqual(
    release.admissions.map((entry) => entry.comparison_class_key),
    [CLAUSE_B_CLASS, CLAUSE_C_CLASS],
  );
  assert.equal(
    new Set(release.admissions.map((entry) => entry.metric_key)).size,
    1,
  );
  assert.equal(
    new Set(release.admissions.map(
      (entry) => entry.metric_serving_admission_id,
    )).size,
    2,
  );
  assert.deepEqual(
    release.observations.map((entry) => entry.comparison_class_key),
    [CLAUSE_B_CLASS, CLAUSE_C_CLASS],
  );
  assert.equal(
    release.observations.every(
      (entry) => entry.party.value === 'BUYER_GROUP'
        && entry.release_id === release.release_id
        && entry.governed_deal_key === 'deal:qxo-topbuild',
    ),
    true,
  );
  assert.equal(release.provision_row.class_aggregation, 'FORBIDDEN');
});

test('subject terms expose both legal standards, denominator and signing-relative date', () => {
  const { release } = build();
  const [clauseB, clauseC, measurement, knowledge, materiality, lookback] =
    release.provision_row.subrows;
  assert.equal(
    clauseB.subject.display_value,
    'True and correct, subject to De Minimis Inaccuracies',
  );
  assert.deepEqual(clauseB.subject.denominator, {
    basis: 'FULLY_DILUTED_EQUITY_CAPITALISATION',
    party_value: 'COMPANY',
  });
  assert.equal(
    clauseB.source.exact_detail.detail_kind,
    'CLAUSE_B_LIMBS_ACCURACY_PROVISO_DEFINITION_AND_DENOMINATOR',
  );
  assert.equal(
    clauseC.subject.display_value,
    'True and correct in all material respects, with materiality scrape',
  );
  assert.equal(clauseC.subject.materiality_scrape.state, 'APPLIED');
  assert.deepEqual(clauseB.representation_maker, COMPANY_PARTY);
  assert.deepEqual(clauseC.representation_maker, COMPANY_PARTY);
  assert.equal(measurement.subject.claim_attributes.signing_relative_offset, -1);
  assert.equal(measurement.subject.claim_attributes.day_basis, 'CALENDAR_DAY');
  for (const row of [knowledge, materiality, lookback]) {
    assert.deepEqual(row.party, COMPANY_PARTY);
    assert.equal(row.result_party.value, 'BUYER_GROUP');
    assert.equal(row.state, 'ABSENT');
    assert.equal(row.subject.display_value, 'Absent');
    assert.equal(row.comparability_state, 'EXPLICIT_ABSENCE_SUBJECT_CONTEXT');
  }
});

test('observations retain raw legal terms, parties and exact source lineage', () => {
  const { reviewedGraph, release } = build();
  const [clauseB, clauseC] = release.provision_row.subrows;
  for (const [observation, row] of release.observations.map(
    (entry, index) => [entry, [clauseB, clauseC][index]],
  )) {
    assert.equal(observation.raw_value, row.subject.raw_value);
    assert.equal(
      observation.canonical_value,
      row.subject.canonical_value,
    );
    assert.deepEqual(observation.representation_maker, COMPANY_PARTY);
    assert.deepEqual(observation.semantic_terms, {
      accuracy_exception: row.subject.accuracy_exception,
      denominator: row.subject.denominator,
      target_limb_ordinals: row.subject.target_limb_ordinals,
      dated_representation_proviso:
        row.subject.dated_representation_proviso,
      materiality_scrape: row.subject.materiality_scrape,
    });
    assert.equal(
      observation.source_lineage.reviewed_graph_id,
      reviewedGraph.qxo_reviewed_capitalisation_f27_id,
    );
    assert.deepEqual(
      observation.source_lineage.evidence_reference_ids,
      row.source.evidence_reference_ids,
    );
  }
});

test('source-authenticated composition rejects re-signed invented graph semantics', () => {
  const { inputs, reviewedGraph } = build();
  const attacks = [
    (graph) => {
      graph.claims[0].raw_value = 'FORGED SOURCE TEXT';
    },
    (graph) => {
      graph.claims[0].canonical_value = 'FORGED_STANDARD';
    },
    (graph) => {
      graph.relationships[0].effect.target_limb_occurrence_ids = [];
    },
    (graph) => {
      graph.relationships[1].effect.materiality_scrape.state = 'NOT_APPLIED';
    },
    (graph) => {
      graph.claims[2].denominator.party_value = 'PARENT';
    },
    (graph) => {
      graph.party.value = 'PARENT';
    },
  ];
  for (const attack of attacks) {
    const forged = clone(reviewedGraph);
    attack(forged);
    assert.throws(
      () => buildQxoCapitalisationCrossViewReleaseF27({
        reviewedGraph: resignReviewedGraphShell(forged),
        sourceContext: inputs.sourceContext,
        parserSourceClosure: inputs.parserSourceClosure,
        contractBundle: inputs.contractBundle,
      }),
      /reviewed QXO F27 capitalisation graph has drifted/,
    );
  }
});

test('request compilation rejects re-signed release shells and nested admissions', () => {
  const { release } = build();
  const forged = clone(release);
  forged.admissions[0].allowed_canonical_values = ['FORGED'];
  const resigned = resignReleaseShell(forged);
  assert.throws(
    () => compileQxoCapitalisationF27MarketRequest({
      release: resigned,
    }),
    /metric admission|semantics|identity/,
  );
  const unblocked = clone(release);
  unblocked.manifest.activation_eligibility = 'ELIGIBLE';
  unblocked.manifest.status = {
    publication_blocked: false,
    release_eligible: true,
    blocker_codes: [],
  };
  unblocked.manifest.serving_plan.shared_database_capacity_authority =
    'CERTIFIED';
  assert.throws(
    () => compileQxoCapitalisationF27MarketRequest({
      release: resignManifestAndReleaseShell(unblocked),
    }),
    /manifest identity|release envelope/,
  );
});

test('F27 compiles both classes into one constant-call, release-aware request', () => {
  const { release } = build();
  const request = compileQxoCapitalisationF27MarketRequest({
    release,
    filters: {
      lawyer_either: 'Paul, Weiss',
      year_from: 2024,
    },
  });
  assert.equal(request.execution_shape, 'ONE_INDEXED_SET_BASED_SQL_OR_RPC');
  assert.equal(request.database_call_budget, 1);
  assert.equal(request.database_call_growth_with_corpus_size, 'CONSTANT');
  assert.equal(request.immediate_retries, 0);
  assert.equal(request.broad_claim_or_card_loading, false);
  assert.equal(request.subject_deal_key, 'deal:qxo-topbuild');
  assert.equal(
    request.subject_exclusion_predicate,
    'GOVERNED_DEAL_KEY_NOT_EQUAL_SUBJECT_DEAL_KEY',
  );
  assert.deepEqual(
    request.metric_bindings.map((entry) => entry.comparison_class_key),
    [CLAUSE_B_CLASS, CLAUSE_C_CLASS],
  );
  assert.deepEqual(
    request.metric_bindings.map(
      (entry) => entry.subject_market_observation_id,
    ),
    release.observations.map(
      (entry) => entry.market_observation_id,
    ),
  );
  const other = compileQxoCapitalisationF27MarketRequest({
    release,
    filters: { lawyer_either: 'Wachtell' },
  });
  assert.notEqual(other.cache_key, request.cache_key);
  assert.throws(
    () => compileQxoCapitalisationF27MarketRequest({
      release,
      filters: { unknown_filter: true },
    }),
    /closed contract/,
  );
  assert.throws(
    () => compileQxoCapitalisationF27MarketRequest({
      release,
      filters: {
        min_value_usd: '200',
        max_value_usd: '100',
      },
    }),
    /inverted/,
  );
});

test('one cache miss uses one RPC, an identical hit uses none and no retry occurs', async () => {
  const { release } = build();
  const stored = new Map();
  const cache = {
    get: async (key) => stored.get(key),
    set: async (key, value) => stored.set(key, value),
  };
  let rpcCalls = 0;
  const rpc = async (request) => {
    rpcCalls += 1;
    return sealedResult(request);
  };
  const first = await executeQxoCapitalisationF27MarketRequest({
    release,
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(first.execution_source, 'RPC');
  assert.equal(first.database_calls, 1);
  assert.equal(first.immediate_retries, 0);
  assert.equal(rpcCalls, 1);
  const second = await executeQxoCapitalisationF27MarketRequest({
    release,
    filters: { sector: 'Industrials' },
    cache,
    rpc,
  });
  assert.equal(second.execution_source, 'CACHE');
  assert.equal(second.database_calls, 0);
  assert.equal(second.immediate_retries, 0);
  assert.equal(rpcCalls, 1);
});

test('simultaneous identical misses coalesce into one RPC', async () => {
  const { release } = build();
  let rpcCalls = 0;
  let releaseRpc;
  const hold = new Promise((resolve) => {
    releaseRpc = resolve;
  });
  const executions = Array.from({ length: 20 }, () => (
    executeQxoCapitalisationF27MarketRequest({
      release,
      filters: { buyer: 'QXO' },
      cache: {
        get: async () => null,
        set: async () => {},
      },
      rpc: async (request) => {
        rpcCalls += 1;
        await hold;
        return sealedResult(request);
      },
    })
  ));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rpcCalls, 1);
  releaseRpc();
  const results = await Promise.all(executions);
  assert.equal(
    results.filter((entry) => entry.execution_source === 'RPC').length,
    1,
  );
  assert.equal(
    results.filter(
      (entry) => entry.execution_source === 'COALESCED_INFLIGHT',
    ).length,
    19,
  );
  assert.equal(
    results.reduce((total, entry) => total + entry.database_calls, 0),
    1,
  );
});

test('result validation enforces exact QXO exclusion and refuses class substitution', () => {
  const { release } = build();
  const request = compileQxoCapitalisationF27MarketRequest({ release });
  assert.equal(
    validateQxoCapitalisationF27MarketResult(
      sealedResult(request),
      request,
    ),
    true,
  );
  const leaked = sealedResult(request, (body) => {
    body.class_results[0].subject_exclusion.residual_subject_deals = 1;
    return body;
  });
  assert.throws(
    () => validateQxoCapitalisationF27MarketResult(leaked, request),
    /invalid|unbounded/,
  );
  const swapped = sealedResult(request, (body) => {
    const first = body.class_results[0];
    const second = body.class_results[1];
    first.metric_serving_admission_id =
      second.metric_serving_admission_id;
    return body;
  });
  assert.throws(
    () => validateQxoCapitalisationF27MarketResult(swapped, request),
    /invalid|unbounded/,
  );
  const aggregated = sealedResult(request, (body) => {
    body.class_results = [body.class_results[0]];
    return body;
  });
  assert.throws(
    () => validateQxoCapitalisationF27MarketResult(aggregated, request),
    /identity|bounds/,
  );
  const unreconciled = sealedResult(request, (body) => {
    body.class_results[0].counts = {
      eligible_deals: 2,
      comparable_deals: 0,
      excluded_deals: 1,
    };
    return body;
  });
  assert.throws(
    () => validateQxoCapitalisationF27MarketResult(unreconciled, request),
    /invalid|unbounded/,
  );
});

test('market percentages are canonical six-place rounded values', () => {
  const { release } = build();
  const request = compileQxoCapitalisationF27MarketRequest({ release });
  const result = sealedResult(request, (body) => {
    body.class_results[0].counts = {
      eligible_deals: 4,
      comparable_deals: 3,
      excluded_deals: 1,
    };
    body.class_results[0].groups = [
      {
        canonical_value: 'MAT_ALL_RESPECTS',
        deal_count: 2,
        percentage: '66.666667',
        state: 'PRESENT',
        reason_code: null,
      },
      {
        canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
        deal_count: 1,
        percentage: '33.333333',
        state: 'PRESENT',
        reason_code: null,
      },
    ];
    body.class_results[0].empty_cohort_reason_code = null;
    return body;
  });
  assert.equal(
    validateQxoCapitalisationF27MarketResult(result, request),
    true,
  );
  const truncated = clone(result);
  truncated.class_results[0].groups[0].percentage = '66.666666';
  const body = clone(truncated);
  delete body.canonical_payload_digest;
  truncated.canonical_payload_digest = contentId(
    'QXO_CAPITALISATION_MARKET_RESULT_F27_PAYLOAD/V1',
    body,
  );
  assert.throws(
    () => validateQxoCapitalisationF27MarketResult(truncated, request),
    /market group is invalid/,
  );
});

test('each malformed subrow fails locally while all five siblings remain renderable', () => {
  const { release } = build();
  release.provision_row.subrows.forEach((_, damagedIndex) => {
    const rows = clone(release.provision_row.subrows);
    rows[damagedIndex].label = 'Damaged';
    const rendered = prepareQxoCapitalisationF27SubrowsForRendering(
      rows,
      release,
    );
    assert.equal(rendered.length, 6);
    assert.equal(
      rendered.filter(
        (entry) => entry.render_kind === 'CAPITALISATION_SUBROW_FAILED',
      ).length,
      1,
    );
    assert.equal(
      rendered.filter(
        (entry) => entry.render_kind === 'CAPITALISATION_SUBROW',
      ).length,
      5,
    );
    assert.equal(rendered.some(
      (entry) => entry.reason_code === 'No market data',
    ), false);
  });
});

test('missing, duplicate and unknown subrows cannot displace the six governed slots', () => {
  const { release } = build();
  const canonical = release.provision_row.subrows;
  const missing = prepareQxoCapitalisationF27SubrowsForRendering(
    canonical.slice(1),
    release,
  );
  assert.equal(missing.length, 6);
  assert.equal(missing[0].reason_code, 'MISSING_F27_SUBROW');
  assert.equal(
    missing.filter((entry) => entry.render_kind === 'CAPITALISATION_SUBROW').length,
    5,
  );

  const duplicate = prepareQxoCapitalisationF27SubrowsForRendering(
    [canonical[0], canonical[0], ...canonical.slice(1)],
    release,
  );
  assert.equal(duplicate.length, 6);
  assert.equal(duplicate[0].reason_code, 'DUPLICATE_F27_SUBROW');
  assert.equal(
    duplicate.filter((entry) => entry.render_kind === 'CAPITALISATION_SUBROW').length,
    5,
  );

  const unknown = prepareQxoCapitalisationF27SubrowsForRendering(
    [...canonical, { value_slot_key: 'FORGED' }],
    release,
  );
  assert.equal(unknown.length, 7);
  assert.equal(
    unknown[6].reason_code,
    'UNRECOGNISED_F27_SUBROW',
  );
  assert.equal(
    unknown.slice(0, 6).every(
      (entry) => entry.render_kind === 'CAPITALISATION_SUBROW',
    ),
    true,
  );
});

test('poisoned RPC results are never retried or cached', async () => {
  const { release } = build();
  let rpcCalls = 0;
  let cacheSets = 0;
  await assert.rejects(
    executeQxoCapitalisationF27MarketRequest({
      release,
      cache: {
        get: async () => null,
        set: async () => {
          cacheSets += 1;
        },
      },
      rpc: async (request) => {
        rpcCalls += 1;
        return sealedResult(request, (body) => {
          body.class_results[0].comparison_class_key =
            CLAUSE_C_CLASS;
          return body;
        });
      },
    }),
    /invalid|missing|reordered|aggregated/,
  );
  assert.equal(rpcCalls, 1);
  assert.equal(cacheSets, 0);
});
