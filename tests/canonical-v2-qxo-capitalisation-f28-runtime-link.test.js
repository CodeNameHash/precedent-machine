const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildFixtureCandidateInputAuthority,
} = require('../__fixtures__/canonical-v2/candidate-input-authority');
const {
  buildQxoReviewedCapitalisationF27,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f27');
const {
  CANDIDATE_RELEASE_NOT_BOUND_REASON,
  RUNTIME_LINK_PLAN_SCHEMA,
  WRITER_NOT_BOUND_REASON,
  buildQxoCapitalisationF28RuntimeLinkPlan,
} = require('../lib/canonical-v2/qxo-capitalisation-f28-runtime-link');
const {
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');
const {
  buildF28ProductInputs,
  clone,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs');

function inputs() {
  const product = buildF28ProductInputs();
  return {
    reviewed_graph: product.reviewed_graph,
    qxo_cross_view_release: product.qxo_cross_view_release,
    source_context: product.source_context,
    parser_source_closure: product.parser_source_closure,
    contract_bundle: product.contract_bundle,
    correction_authority_selection: buildFixtureCandidateInputAuthority({
      contractBundle: product.contract_bundle,
    }),
    product_adapter_input: product,
  };
}

test('closes the exact F28 graph, release, authority head and Product result', () => {
  const plan = buildQxoCapitalisationF28RuntimeLinkPlan(inputs());
  assert.equal(plan.schema_version, RUNTIME_LINK_PLAN_SCHEMA);
  assert.equal(plan.counts.metric_admissions, 14);
  assert.equal(plan.counts.market_observations, 13);
  assert.equal(plan.counts.market_metric_slot_exclusions, 1);
  assert.equal(plan.counts.subrows, 6);
  assert.equal(plan.counts.surface_bindings, 4);
  assert.equal(plan.writer_state, 'NOT_BOUND');
  assert.equal(plan.writer_reason, WRITER_NOT_BOUND_REASON);
  assert.equal(plan.candidate_release_state, 'NOT_BOUND');
  assert.equal(plan.candidate_release_reason, CANDIDATE_RELEASE_NOT_BOUND_REASON);
  assert.equal(plan.execution_authority, 'NONE');
  assert.equal(plan.retries, 0);
  assert.equal(plan.active_pointer_mutation, false);
  assert.equal(
    plan.product_adapter_receipt.product_query_result.domain_result_identity,
    plan.provision_row_id,
  );
  assert.equal(Object.isFrozen(plan), true);
});

test('rejects F27 and forged F28 inputs', () => {
  const f27 = inputs();
  f27.reviewed_graph = buildQxoReviewedCapitalisationF27(buildF27Inputs());
  assert.throws(
    () => buildQxoCapitalisationF28RuntimeLinkPlan(f27),
    /F28|reviewed/i,
  );

  const forged = inputs();
  forged.reviewed_graph = clone(forged.reviewed_graph);
  forged.reviewed_graph.review_version = 'FORGED_F28/V1';
  assert.throws(
    () => buildQxoCapitalisationF28RuntimeLinkPlan(forged),
    /drifted|F28/i,
  );
});

test('rejects a missing F28 slot, drifted surface and aggregate Product input', () => {
  const missingSlot = inputs();
  missingSlot.qxo_cross_view_release = clone(
    missingSlot.qxo_cross_view_release,
  );
  missingSlot.qxo_cross_view_release.admissions.pop();
  assert.throws(
    () => buildQxoCapitalisationF28RuntimeLinkPlan(missingSlot),
    /drifted|inventory|slot/i,
  );

  const surfaceDrift = inputs();
  surfaceDrift.qxo_cross_view_release = clone(
    surfaceDrift.qxo_cross_view_release,
  );
  surfaceDrift.qxo_cross_view_release.surface_bindings.QUERY
    .provision_row.label = 'Drifted';
  assert.throws(
    () => buildQxoCapitalisationF28RuntimeLinkPlan(surfaceDrift),
    /drifted|surface/i,
  );

  const aggregate = inputs();
  aggregate.product_adapter_input = buildF28ProductInputs({
    useLegacyBringDown: true,
  });
  assert.throws(
    () => buildQxoCapitalisationF28RuntimeLinkPlan(aggregate),
    /Product adapter input|Product Query IR|aggregate/i,
  );
});

test('rejects extra authority, retry, active-pointer and PASS fields', () => {
  for (const field of [
    'writer_state',
    'candidate_release_state',
    'execution_authority',
    'retries',
    'active_pointer_mutation',
  ]) {
    const value = inputs();
    value[field] = 'PASS';
    assert.throws(
      () => buildQxoCapitalisationF28RuntimeLinkPlan(value),
      /closed runtime link/i,
    );
  }
});
