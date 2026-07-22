const test = require('node:test');
const assert = require('node:assert/strict');

const { APPLICATION_DEALS } = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const {
  buildActiveReviewContextResult,
  queryActiveReviewContext,
} = require('../lib/canonical-v2/review-context');
const {
  buildQxoCapitalisationServingFixture,
} = require('./helpers/qxo-capitalisation-serving-fixture');

test('actual QXO serving projection keeps tier B comparable and tier C explicitly excluded', () => {
  const fixture = buildQxoCapitalisationServingFixture();
  const [tierB, tierC] = fixture.serving.projections;
  const [row] = fixture.serving.shared_rows;

  assert.equal(validateSharedServingRow(row), true);
  assert.equal(tierB.observation.canonical_value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.equal(tierB.exclusion, null);
  assert.equal(tierC.observation, null);
  assert.equal(tierC.exclusion.exclusion_reason, 'RESULT_NOT_COMPARABLE');
  assert.equal(tierC.exclusion.comparability_state, 'NOT_COMPARABLE');
  assert.deepEqual(row.canonical_result.party, {
    role: 'CONDITION_BENEFICIARY',
    value: 'PARENT',
    capacity: 'ACQUIRER',
  });
  assert.deepEqual(fixture.serving.results.map((item) => item.certification_state), [
    'COMPARABLE',
    'NOT_CERTIFIED',
  ]);
});

test('the actual tier B SharedServingRow renders identically through all four surfaces', () => {
  const fixture = buildQxoCapitalisationServingFixture();
  const [row] = fixture.serving.shared_rows;
  const adapted = adaptSharedServingRow(row);
  const metric = adapted.data.byRow[row.row_serving_key].metrics.REPRESENTATION_ACCURACY_STANDARD;

  assert.deepEqual(Object.keys(adapted.surface_bindings), SURFACES);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].row_key, row.row_serving_key);
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
  assert.equal(metric.subject.value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.deepEqual(metric.subject.legalTerms.map((term) => [term.key, term.value]), [
    ['accuracy_standard', 'True in all respects, except de minimis inaccuracies'],
    ['exception', 'De minimis inaccuracies'],
    ['time_points', 'Signing and closing; specified earlier date where applicable'],
    ['knowledge_qualifier_1', 'No knowledge qualifier'],
    ['knowledge_qualifier_2', 'No knowledge qualifier'],
  ]);
  assert.doesNotMatch(JSON.stringify(adapted), /No market data/);
});

test('tier B source-detail input closes over exact QXO evidence and relationship targets', () => {
  const fixture = buildQxoCapitalisationServingFixture();
  const [detailInput] = fixture.serving.admitted_exact_detail_inputs;
  const tierBRelationship = fixture.slice.relationships[0];
  const excerptsById = new Map(Object.values(fixture.slice.excerpts).map((item) => [item.excerpt_id, item]));
  const exactExcerpts = detailInput.ordered_excerpt_ids.map((id) => excerptsById.get(id));

  assert.equal(detailInput.row_serving_key, fixture.serving.shared_rows[0].row_serving_key);
  assert.deepEqual(detailInput.relationship_revision_ids, [tierBRelationship.relationship_revision_id]);
  assert.deepEqual(
    detailInput.relationship_target_occurrence_ids,
    tierBRelationship.target_occurrence_ids,
  );
  assert.equal(exactExcerpts.every(Boolean), true);
  assert.ok(exactExcerpts.some((item) => /except for De Minimis Inaccuracies/.test(item.exact_text)));
  assert.ok(exactExcerpts.some((item) => /only as of such date or period/.test(item.exact_text)));
  assert.ok(exactExcerpts.some((item) => /authorized capital stock/.test(item.exact_text)));
  assert.equal(exactExcerpts.every((item) => (
    item.absolute_end - item.absolute_start === Buffer.byteLength(item.exact_text, 'utf8')
  )), true);
});

test('one bounded active-release read returns the comparable QXO shared row', async () => {
  const fixture = buildQxoCapitalisationServingFixture();
  const [row] = fixture.serving.shared_rows;
  const pointer = {
    pointer_id: fixture.corpusReleaseId,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
  };
  const request = {
    contract_fingerprint: fixture.contractBundle.fingerprint,
    application_deal_id: APPLICATION_DEALS.QXO,
    page_size: 2,
    after_row_serving_key: null,
  };
  const directoryRecord = {
    application_deal_id: APPLICATION_DEALS.QXO,
    governed_deal_key: row.governed_deal_key,
    deal_admission_id: row.deal_admission_id,
  };
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({
        data: buildActiveReviewContextResult({
          pointer,
          directoryRecord,
          rows: [row],
          request,
        }),
        error: null,
      });
    },
  };

  const response = await queryActiveReviewContext({ client, request });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_active_review_context');
  assert.equal(calls[0].params.p_page_size, 2);
  assert.equal(response.result.corpus_release_id, fixture.corpusReleaseId);
  assert.deepEqual(response.result.rows, [row]);
});

test('both terminal intents share one release partition without tier C poisoning tier B', () => {
  const fixture = buildQxoCapitalisationServingFixture();
  const [tierB, tierC] = fixture.serving.projections;
  const [row] = fixture.serving.shared_rows;

  assert.equal(fixture.serving.projections.length, 2);
  assert.equal(fixture.serving.candidate_release_member_intents.length, 2);
  assert.equal(fixture.serving.candidate_release_member_intents[0].shared_row, row);
  assert.equal(fixture.serving.candidate_release_member_intents[1].shared_row, null);
  assert.equal(
    fixture.serving.candidate_release_member_intents[0].projection_output.observation.corpus_release_id,
    fixture.corpusReleaseId,
  );
  assert.equal(
    fixture.serving.candidate_release_member_intents[1].projection_output.exclusion.corpus_release_id,
    fixture.corpusReleaseId,
  );
  assert.deepEqual(fixture.serving.release_readiness.comparable_metric_slot_keys, [
    tierB.metric_slot_key,
  ]);
  assert.deepEqual(fixture.serving.release_readiness.excluded_metric_slot_keys, [
    tierC.metric_slot_key,
  ]);
  assert.equal(tierB.observation.market_comparability, 'COMPARABLE');
  assert.equal(tierC.exclusion.exclusion_reason, 'RESULT_NOT_COMPARABLE');
  assert.equal(row.canonical_result.market_context.cohort.counts.comparable_deals, 1);
  assert.deepEqual(row.canonical_result.market_context.cohort.exclusions, [{
    reason_code: 'RESULT_NOT_COMPARABLE',
    slot_count: 1,
    deal_count: 1,
  }]);
});
