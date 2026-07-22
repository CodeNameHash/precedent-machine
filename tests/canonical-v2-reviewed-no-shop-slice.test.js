const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { InMemoryCanonicalRepository, createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
  validateFixtureExactDetailPackage,
} = require('../lib/canonical-v2/exact-detail');
const { buildReviewedCapitalisationSlice } = require('../lib/canonical-v2/reviewed-capitalisation-slice');
const {
  buildReviewedNoShopServingRows,
  buildReviewedNoShopSlice,
} = require('../lib/canonical-v2/reviewed-no-shop-slice');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const sourceText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const contractBundle = compileFixtureContract();

function build() {
  return buildReviewedNoShopSlice({ sourceText, contractBundle });
}

test('the real Landos no-shop becomes deterministic provisions, subterms and exact evidence', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.proposalBatch.schema_version, 'SOURCE_BACKED_PROVISION_PROPOSAL_BATCH/V1');
  assert.equal(first.proposalBatch.proposals.length, 1);
  assert.equal(first.proposalBatch.quarantined_proposals.length, 0);
  assert.equal(
    first.reviewed_mapping.proposal_batch_id,
    first.proposalBatch.proposal_batch_id,
  );
  assert.deepEqual(first.reviewed_mapping.source_backed_provision_proposal_ids, [
    first.section.source_backed_provision_proposal_id,
  ]);
  assert.equal(first.section.section_number, '5.3');
  for (const span of Object.values(first.spans)) {
    assert.equal(span.canonical_text_id, first.section.evidence_anchor.canonical_text_id);
    assert.ok(span.absolute_start >= first.section.evidence_anchor.absolute_start);
    assert.ok(span.absolute_end <= first.section.evidence_anchor.absolute_end);
  }
  assert.equal(first.actionComponents.length, 5);
  assert.deepEqual(first.actionClaims.map((claim) => claim.canonical_value), [
    'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
    'ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS',
    'CHANGE_RECOMMENDATION',
    'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
    'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
  ]);
  assert.deepEqual(first.prerequisiteClaims.map((claim) => claim.canonical_value), [
    'BEFORE_STOCKHOLDER_APPROVAL',
    'NO_PRIOR_BREACH',
    'CONFIDENTIALITY_AGREEMENT_NO_LESS_FAVOURABLE',
    'BUYER_RECEIVES_INFORMATION_CONCURRENTLY',
    'BOARD_GOOD_FAITH_DETERMINATION',
    'EXPECTED_TO_LEAD_TO_SUPERIOR_PROPOSAL',
    'FIDUCIARY_DUTIES_REQUIRE_ACTION',
  ]);
});

test('the exception is linked only to the restricted actions it actually qualifies', () => {
  const slice = build();
  const linked = new Map(slice.actionRelationships.map((relationship) => [
    relationship.source_occurrence_id,
    relationship.effect.legal_operation,
  ]));
  assert.equal(linked.size, 3);
  assert.equal(
    linked.get(slice.actionComponents[0].provision_component_id),
    'PERMITS_LIMITED_INFORMATION_SHARING',
  );
  assert.equal(
    linked.get(slice.actionComponents[1].provision_component_id),
    'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
  );
  assert.equal(linked.has(slice.actionComponents[2].provision_component_id), false);
  assert.equal(
    linked.get(slice.actionComponents[3].provision_component_id),
    'PERMITS_CONFIDENTIALITY_AGREEMENT',
  );
  assert.equal(linked.has(slice.actionComponents[4].provision_component_id), false);
  for (const relationship of slice.actionRelationships) {
    assert.deepEqual(relationship.target_occurrence_ids, [slice.exceptionComponent.provision_component_id]);
    assert.equal(relationship.effect.prerequisites.length, 7);
    assert.equal(relationship.evidence.length, 2);
  }
});

test('hours reconcile to elapsed days while business-day match periods retain their basis and trigger', () => {
  const { durationClaims } = build();
  assert.deepEqual({
    raw: durationClaims.notice.raw_value,
    value: durationClaims.notice.canonical_value,
    unit: durationClaims.notice.unit,
    basis: durationClaims.notice.day_basis,
    trigger: durationClaims.notice.attributes.trigger,
  }, {
    raw: 'within twenty-four (24) hours',
    value: '1',
    unit: 'DAYS',
    basis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
  });
  assert.deepEqual([
    durationClaims.initial_match.canonical_value,
    durationClaims.initial_match.day_basis,
    durationClaims.initial_match.attributes.trigger,
  ], ['4', 'BUSINESS', 'SUPERIOR_PROPOSAL_NOTICE']);
  assert.deepEqual([
    durationClaims.subsequent_match.canonical_value,
    durationClaims.subsequent_match.day_basis,
    durationClaims.subsequent_match.attributes.trigger,
  ], ['2', 'BUSINESS', 'MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL']);
});

test('the whole no-shop closure dry-runs and commits transactionally with zero residuals', async () => {
  const slice = build();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const dryRun = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-no-shop-v1',
    dryRun: true,
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(dryRun.validation.counts.publishable, 52);
  assert.equal(dryRun.validation.counts.residuals, 0);
  assert.equal(repository.transactionCount, 0);

  await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-no-shop-v1',
    writeSet: slice.canonicalWriteSet,
  });
  const stored = repository.snapshot();
  assert.equal(repository.transactionCount, 1);
  assert.equal(stored.provisions.length, 5);
  assert.equal(stored.components.length, 9);
  assert.equal(stored.claims.length, 15);
  assert.equal(stored.relationships.length, 3);
});

test('all eight values publish through the release-keyed projection and shared row contract', () => {
  const slice = build();
  slice.results.forEach((result) => {
    assert.equal(result.projection.exclusion, null);
    assert.equal(validateProjectedMetricSlotOutput(result.projection), true);
  });
  const rows = buildReviewedNoShopServingRows({ slice, contractBundle });
  assert.equal(rows.length, 8);
  rows.forEach((row) => assert.equal(validateSharedServingRow(row), true));

  const actionRows = rows.filter(
    (row) => row.canonical_result.market_context.metric_key === 'NO_SHOP_PROHIBITED_ACTION',
  );
  assert.equal(actionRows.length, 5);
  assert.equal(actionRows[0].canonical_result.market_context.cohort.counts.observation_slots, 5);
  assert.equal(actionRows[0].canonical_result.market_context.cohort.distribution.length, 5);
  assert.equal(actionRows[0].canonical_result.components[0].bounded_relationship_effects.length, 1);
  assert.equal(actionRows[2].canonical_result.components[0].bounded_relationship_effects.length, 0);

  const notice = rows.find(
    (row) => row.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  assert.equal(notice.canonical_result.market_context.subject_observation.canonical_value, '1');
  assert.equal(
    notice.canonical_result.market_context.subject_observation.basis_key,
    'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL',
  );
});

test('the shared adapter exposes terms and exceptions consistently across every surface', () => {
  const slice = build();
  const rows = buildReviewedNoShopServingRows({ slice, contractBundle });
  const action = adaptSharedServingRow(rows.find(
    (row) => row.canonical_result.market_context.subject_observation.canonical_value
      === 'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
  ));
  const metric = action.data.byRow[action.row_key].metrics.NO_SHOP_PROHIBITED_ACTION;
  assert.deepEqual(metric.subject.legalTerms.map((term) => term.label), [
    'Prohibited action',
    'Permitted exception',
    'Conditions',
  ]);
  assert.match(metric.subject.legalTerms[1].value, /provide information/);
  assert.match(metric.subject.legalTerms[2].value, /before stockholder approval/);
  assert.equal(metric.distribution.values.length, 5);
  for (const surface of SURFACES) {
    assert.equal(action.surface_bindings[surface].typed_market, action.typed_market);
  }

  const notice = adaptSharedServingRow(rows.find(
    (row) => row.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  ));
  const noticeMetric = notice.data.byRow[notice.row_key].metrics.NO_SHOP_NOTICE_PERIOD_DAYS;
  assert.equal(noticeMetric.subject.value, 1);
  assert.equal(noticeMetric.subject.label, '1 elapsed day');
  assert.deepEqual(noticeMetric.subject.semantics, {
    unit: 'days_equivalent',
    calendarBasis: 'elapsed',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
  });
});

test('every no-shop result can attach one bounded exact-evidence action', () => {
  const slice = build();
  const rows = buildReviewedNoShopServingRows({ slice, contractBundle });
  const excerptsById = new Map(Object.values(slice.excerpts).map((excerpt) => [excerpt.excerpt_id, excerpt]));
  for (const row of rows) {
    const claimRevisionId = row.canonical_result.components[0].claim_revision_id;
    const result = slice.results.find((item) => item.claim.claim_revision_id === claimRevisionId);
    const excerpt = excerptsById.get(result.claim.evidence[0].excerpt_id);
    const detailPackage = buildFixtureClaimEvidenceDetailPackage({
      contract_bundle: contractBundle,
      row,
      source: slice.source,
      source_admission: slice.sourceAdmission,
      excerpt,
      claim: result.claim,
      action_slot_key: GENERAL_ACTION_SLOT_KEY,
      evidence_ordinal: 0,
    });
    assert.equal(validateFixtureExactDetailPackage({
      package: detailPackage,
      contract_bundle: contractBundle,
      source: slice.source,
      source_admission: slice.sourceAdmission,
      excerpt,
      claim: result.claim,
    }), true);
    assert.equal(detailPackage.row.source_actions.length, 1);
    assert.equal(detailPackage.row.canonical_result.source_detail_state.state, 'AVAILABLE');
  }
});

test('the reviewed no-shop mapping fails closed on source drift', () => {
  assert.throws(
    () => buildReviewedNoShopSlice({
      sourceText: sourceText.replace('within twenty-four (24) hours', 'within forty-eight (48) hours'),
      contractBundle,
    }),
    /source hash mismatch/,
  );
});

test('proposal batch identity and exact admission lineage drift block the no-shop family', () => {
  const proposalBatch = structuredClone(build().proposalBatch);
  proposalBatch.source_admission_manifest_payload_digest = '0'.repeat(64);
  assert.throws(
    () => buildReviewedNoShopSlice({ sourceText, contractBundle, proposalBatch }),
    /proposal batch identity or exact source mapping mismatch/,
  );
});

test('a proposal moved away from reviewed Section 5.3 cannot feed the no-shop family', () => {
  const proposalBatch = structuredClone(build().proposalBatch);
  proposalBatch.proposals[0].section_number = '5.4';
  assert.throws(
    () => buildReviewedNoShopSlice({ sourceText, contractBundle, proposalBatch }),
    /proposal batch identity or exact source mapping mismatch/,
  );
});

test('a quarantined sibling blocks this family invocation without poisoning deterministic replay', () => {
  const baseline = build();
  const independentBefore = buildReviewedCapitalisationSlice({ sourceText, contractBundle });
  const proposalBatch = structuredClone(baseline.proposalBatch);
  proposalBatch.quarantined_proposals.push({
    schema_version: 'QUARANTINED_PARSER_PROPOSAL/V1',
    reason_code: 'EXACT_EVIDENCE_UNRESOLVED',
  });
  proposalBatch.diagnostics.quarantined_proposal_count = 1;
  proposalBatch.diagnostics.publication_blocked = true;
  assert.throws(
    () => buildReviewedNoShopSlice({ sourceText, contractBundle, proposalBatch }),
    /proposal batch contains quarantined input/,
  );
  assert.equal(canonicalJson(build()), canonicalJson(baseline));
  assert.equal(
    canonicalJson(buildReviewedCapitalisationSlice({ sourceText, contractBundle })),
    canonicalJson(independentBefore),
  );
});
