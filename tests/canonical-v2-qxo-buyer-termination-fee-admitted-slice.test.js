const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const {
  buildCandidateReleaseImportPlan,
  validateCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
const {
  buildFixtureCandidateInputAuthority,
} = require('../__fixtures__/canonical-v2/candidate-input-authority');
const { buildQueryCohortSummary } = require('../__fixtures__/canonical-v2/query-cohort-summary');
const {
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const { validateFixtureExactDetailPackage } = require('../lib/canonical-v2/exact-detail');
const {
  BUYER_CONFIG,
  BUYER_GROUNDS,
  EXACT_PERCENT,
  SELLER_CONFIG,
  SELLER_GROUNDS,
  buildQxoBuyerTerminationFeeAdmittedSlice,
  buildQxoSellerTerminationFeeF4AdmittedSlice,
  validateQxoBuyerTerminationFeeAdmittedSlice,
  validateQxoSellerTerminationFeeF4AdmittedSlice,
} = require('../lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice');
const {
  validateQxoBuyerTerminationFeeTriggerDetailPackage,
} = require('../lib/canonical-v2/qxo-buyer-termination-fee-trigger-detail');
const {
  triggerPathSchemaForBinding,
  validateTerminationFeeTriggerEffect,
} = require('../lib/canonical-v2/termination-fee-trigger-path');
const {
  pathwayLabel,
} = require('../lib/canonical-v2/termination-fee-trigger-presentation');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const {
  buildCanonicalQueryResultView,
  compileCanonicalQueryRequest,
} = require('../lib/canonical-v2/query-result');
const {
  mapCanonicalRowForRender,
} = require('../lib/canonical-v2/legacy-query-mapper');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const {
  QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
  QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID,
} = require('../lib/canonical-v2/qxo-reverse-candidate-identity');
const {
  buildQxoF4SourceContexts,
} = require('./helpers/canonical-v2-qxo-f4-context');

const contractBundle = compileFixtureContractV4();
const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-f4-termination-admitted-test');
const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-f4-termination-admitted-test');

function buildSide(side, selectedContractBundle = contractBundle) {
  const contexts = buildQxoF4SourceContexts();
  const build = side === 'BUYER'
    ? buildQxoBuyerTerminationFeeAdmittedSlice
    : buildQxoSellerTerminationFeeF4AdmittedSlice;
  return {
    ...contexts,
    candidate: build({
      ...contexts,
      contractBundle: selectedContractBundle,
      corpusReleaseId,
      servingNamespaceId,
    }),
  };
}

test('F5 puts QXO fee denominator precision in the authoritative and compatibility paths', () => {
  const f5 = compileFixtureContractV5();
  for (const side of ['BUYER', 'SELLER']) {
    const { candidate } = buildSide(side, f5);
    assert.equal(candidate.claim.denominator.precision, 'APPROXIMATE');
    assert.equal(candidate.claim.attributes.denominator_precision, 'APPROXIMATE');
    assert.equal(candidate.projection.observation.canonical_value, EXACT_PERCENT);
    assert.equal(validateSharedServingRow(candidate.shared_row), true);
  }
});

function relationshipByPath(candidate, pathwayCode) {
  return candidate.relationships.find(
    (relationship) => relationship.effect.pathway_code === pathwayCode,
  );
}

for (const side of ['BUYER', 'SELLER']) {
  test(`QXO ${side.toLowerCase()} fee is source-pinned, party-correct and normalised`, () => {
    const { candidate } = buildSide(side);
    const config = side === 'BUYER' ? BUYER_CONFIG : SELLER_CONFIG;
    assert.equal(candidate.provisions.length, 7);
    assert.equal(candidate.components.length, 7);
    assert.equal(candidate.relationships.length, 9);
    assert.deepEqual(candidate.provisions[0].party, config.payer);
    assert.equal(candidate.provisions[0].concept_key, config.feeConcept);
    assert.equal(candidate.claim.claim_definition_key, config.metricKey);
    assert.equal(candidate.claim.raw_value, '$600,000,000');
    assert.equal(candidate.claim.canonical_value, EXACT_PERCENT);
    assert.equal(candidate.claim.unit, 'PERCENT_OF_DEAL_VALUE');
    assert.equal(candidate.claim.denominator.value, '17000000000');
    assert.equal(candidate.claim.attributes.fee_side, side);
    assert.equal(candidate.claim.attributes.payee_value, config.payee.value);
    assert.equal(candidate.claim.attributes.payee_capacity, config.payee.capacity);
    assert.equal(candidate.projection.observation.canonical_value, EXACT_PERCENT);
    validateSharedServingRow(candidate.shared_row);
  });

  test(`QXO ${side.toLowerCase()} fee preserves all nine source-backed pathways`, () => {
    const { candidate } = buildSide(side);
    const grounds = side === 'BUYER' ? BUYER_GROUNDS : SELLER_GROUNDS;
    assert.deepEqual(
      candidate.relationships.map((relationship) => relationship.effect),
      grounds.map((ground) => ground.effect),
    );
    assert.deepEqual(
      candidate.relationships.map((relationship) => relationship.ordinal),
      Array.from({ length: 9 }, (_, index) => index),
    );
    const gatewayId = candidate.excerpts.gateway.excerpt_id;
    const paymentId = candidate.excerpts.fee_payment.excerpt_id;
    for (const relationship of candidate.relationships) {
      const evidenceIds = relationship.evidence.map((edge) => edge.excerpt_id);
      assert.ok(evidenceIds.includes(gatewayId));
      assert.ok(evidenceIds.includes(paymentId));
      assert.equal(relationship.effect.trigger_path_schema_version, 2);
    }
    const intervening = relationshipByPath(
      candidate,
      'TAIL_INTERVENING_EVENT_RECOMMENDATION_CHANGE',
    );
    assert.deepEqual(intervening.effect.indexed_facts, [
      'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
      'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
      'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED',
    ]);
    assert.equal(
      intervening.effect.indexed_facts.some((factKey) => factKey.startsWith(
        'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_',
      )),
      false,
    );
    const noSolicitTail = relationshipByPath(candidate, 'TAIL_NO_SOLICIT_BREACH');
    const generalCovenant = candidate.provisions.find(
      (provision) => provision.concept_key === 'TERMR-BREACH',
    );
    const generalCovenantComponent = candidate.components.find(
      (component) => component.parent_provision_instance_id === generalCovenant.provision_instance_id,
    );
    assert.deepEqual(
      noSolicitTail.target_occurrence_ids,
      [generalCovenantComponent.provision_component_id],
    );
    assert.ok(
      noSolicitTail.evidence.some(
        (edge) => edge.excerpt_id === candidate.excerpts.covenant_breach.excerpt_id,
      ),
    );
    const noVoteTail = relationshipByPath(candidate, 'TAIL_NO_VOTE');
    const outsideTail = relationshipByPath(candidate, 'TAIL_OUTSIDE_DATE');
    assert.ok(noVoteTail.effect.indexed_facts.includes(
      'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_STOCKHOLDER_MEETING_AND_NOT_WITHDRAWN',
    ));
    assert.equal(noVoteTail.effect.indexed_facts.includes(
      'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_TERMINATION_AND_NOT_WITHDRAWN',
    ), false);
    assert.ok(outsideTail.effect.indexed_facts.includes(
      'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_TERMINATION_AND_NOT_WITHDRAWN',
    ));
    assert.equal(outsideTail.effect.indexed_facts.includes(
      'FEE_PAYEE_COULD_TERMINATE_FOR_DIRECT_NO_SOLICIT_BREACH',
    ), false);
    assert.ok(outsideTail.effect.indexed_facts.includes(
      'FEE_PAYEE_COULD_TERMINATE_FOR_GENERAL_BREACH_IN_RESPECT_OF_NO_SOLICIT',
    ));
    for (const relationship of candidate.relationships) {
      const targetComponent = candidate.components.find(
        (component) => component.provision_component_id === relationship.target_occurrence_ids[0],
      );
      const targetExcerpt = Object.values(candidate.excerpts).find(
        (excerpt) => excerpt.absolute_start === targetComponent.absolute_start
          && excerpt.absolute_end === targetComponent.absolute_end,
      );
      assert.deepEqual(relationship.scope.target_interval_ids, [targetExcerpt.excerpt_id]);
    }
  });

  test(`QXO ${side.toLowerCase()} fee reuses stable predecessor evidence without republishing it`, () => {
    const { candidate } = buildSide(side);
    const predecessorClosure = side === 'BUYER'
      ? QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID
      : QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID;
    const semantic = candidate.semantic_write_set;
    for (const key of ['fee_payment', 'fee_amount']) {
      assert.equal(
        semantic.excerpts.find(
          (excerpt) => excerpt.excerpt_id === candidate.excerpts[key].excerpt_id,
        ).closure_id,
        predecessorClosure,
      );
    }
    assert.equal(
      semantic.provisions.find(
        (provision) => provision.provision_instance_id === candidate.provisions[0].provision_instance_id,
      ).closure_id,
      predecessorClosure,
    );
    assert.equal(
      semantic.components.find(
        (component) => component.provision_component_id === candidate.components[0].provision_component_id,
      ).closure_id,
      predecessorClosure,
    );
    assert.ok(
      semantic.relationships.every(
        (relationship) => relationship.closure_id === candidate.semantic_closure_id,
      ),
    );
  });

  test(`QXO ${side.toLowerCase()} exact detail binds the complete typed trigger graph`, () => {
    const {
      candidate,
      agreementSourceContext,
      agreementSourceAdmission,
    } = buildSide(side);
    const detail = candidate.exact_detail_package;
    assert.equal(detail.action_definitions.length, 1);
    assert.equal(detail.references.length, 1);
    assert.equal(detail.detail_payloads.length, 1);
    assert.equal(detail.action_definitions[0].action_slot_key, 'TERMINATION_FEE_TRIGGER_EVIDENCE');
    assert.ok(
      detail.detail_payloads[0].encoded_byte_length
        <= detail.action_definitions[0].maximum_encoded_bytes,
    );
    const response = detail.detail_payloads[0].response_body;
    assert.equal(response.schema_version, 'SERVING_EXACT_DETAIL_TERMINATION_FEE_TRIGGERS_RESPONSE/V2');
    assert.equal(response.trigger_count, 9);
    assert.equal(response.triggers.length, 9);
    assert.ok(response.excerpts.length >= 8);
    const validation = {
      package: detail,
      contract_bundle: contractBundle,
      source: agreementSourceContext,
      source_admission: agreementSourceAdmission,
      relationships: candidate.relationships,
      excerpts: candidate.candidate_release_member.exact_detail.excerpts,
    };
    assert.ok(validateQxoBuyerTerminationFeeTriggerDetailPackage(validation));
    assert.ok(validateFixtureExactDetailPackage(validation));

    const tampered = JSON.parse(JSON.stringify(detail));
    tampered.detail_payloads[0].response_body.triggers[8].effect.indexed_facts.push(
      'COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_TERMINATION_AND_NOT_WITHDRAWN',
    );
    assert.throws(
      () => validateQxoBuyerTerminationFeeTriggerDetailPackage({
        ...validation,
        package: tampered,
      }),
      /identity or source closure mismatch/,
    );
  });
}

test('buyer and seller pathways retain the actual approval asymmetry', () => {
  const buyer = buildSide('BUYER').candidate;
  const seller = buildSide('SELLER').candidate;
  const buyerOtherCovenant = relationshipByPath(buyer, 'TAIL_OTHER_COVENANT_BREACH');
  const sellerOtherCovenant = relationshipByPath(seller, 'TAIL_OTHER_COVENANT_BREACH');
  assert.ok(
    buyerOtherCovenant.effect.indexed_facts.includes('STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'),
  );
  assert.equal(
    sellerOtherCovenant.effect.indexed_facts.includes('STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'),
    false,
  );
  assert.notEqual(
    buyerOtherCovenant.relationship_revision_id,
    sellerOtherCovenant.relationship_revision_id,
  );
});

test('QXO F4 Query and Review expose the approximate denominator and all governed pathways', () => {
  const { candidate } = buildSide('BUYER');
  const row = candidate.shared_row;
  const request = compileCanonicalQueryRequest({
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    intent: 'MARKET_RANGE',
    metric_key: BUYER_CONFIG.metricKey,
    metric_version: 1,
    concept_key: BUYER_CONFIG.feeConcept,
    party: BUYER_CONFIG.payer,
    filters: {},
    selected_columns: [
      'deal',
      'percent_of_deal_value',
      'raw_value',
      'fee_side',
      'payer',
      'payee',
      'triggers',
      'source',
    ],
    column_filters: {},
    page_size: 25,
    cursor: null,
  });
  const queryParams = {
    p_query_semantics_digest: request.query_semantics_digest,
    p_metric_key: request.metric_key,
    p_metric_version: request.metric_version,
    p_basis_key: request.basis_key,
  };
  const view = buildCanonicalQueryResultView({
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
    cache_state: 'MISS',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    query_semantics_digest: request.query_semantics_digest,
    total_count: 1,
    page_count: 1,
    cohort_summary: buildQueryCohortSummary({ params: queryParams, rows: [row] }),
    rows: [row],
    next_cursor: null,
  }, request);
  const triggers = view.rows[0].cells.triggers;
  assert.equal(view.rows[0].cells.percent_of_deal_value, EXACT_PERCENT);
  assert.equal(triggers.length, 9);
  assert.ok(triggers.every((trigger) => trigger.pathway_code));
  assert.ok(triggers.every((trigger) => trigger.pathway_label));
  assert.ok(triggers.every((trigger) => trigger.terminating_party_label));
  assert.ok(triggers.every((trigger) => trigger.payment_timing_label));
  assert.ok(triggers.every((trigger) => trigger.condition_expression_text));
  assert.match(
    pathwayLabel(relationshipByPath(candidate, 'IMMEDIATE_NO_SOLICIT_BREACH').effect),
    /dedicated/i,
  );
  assert.match(
    pathwayLabel(relationshipByPath(candidate, 'TAIL_NO_SOLICIT_BREACH').effect),
    /general covenant-breach right/i,
  );
  assert.equal(
    mapCanonicalRowForRender(view.rows[0], view.columns)
      .cells.find((cell) => cell.column_key === 'percent_of_deal_value').display,
    'Approximately 3.53%',
  );

  const review = adaptSharedServingRow(row);
  const reviewSubject = review.data.byRow[row.row_serving_key]
    .metrics[BUYER_CONFIG.metricKey].subject;
  assert.equal(reviewSubject.denominatorPrecision, 'APPROXIMATE');
  assert.equal(
    reviewSubject.legalTerms.find((term) => term.key === 'primary_value').value,
    'Approximately 3.53% of headline deal value',
  );
  assert.equal(reviewSubject.label, 'Approximately 3.53% of headline deal value');
  assert.equal(
    reviewSubject.legalTerms.find((term) => term.key === 'deal_value_basis').value,
    'SEC-reported approximate headline transaction value',
  );
  assert.equal(
    reviewSubject.legalTerms.filter((term) => term.key.startsWith('trigger_')).length,
    9,
  );
});

test('F4 trigger validation rejects optional, nested and negated declared triggers', () => {
  const candidate = buildSide('BUYER').candidate;
  const binding = contractBundle.serving_metric_operation_bindings.find(
    (entry) => entry.fee_side === 'BUYER',
  );
  const schema = triggerPathSchemaForBinding(contractBundle, binding);
  const base = JSON.parse(JSON.stringify(candidate.relationships[0].effect));
  const validate = (effect) => validateTerminationFeeTriggerEffect(effect, { binding, schema });

  const nested = structuredClone(base);
  nested.condition_expression = {
    operator: 'ALL_OF',
    operands: [{
      operator: 'ANY_OF',
      operands: [
        { operator: 'FACT', fact_key: base.trigger_code },
        { operator: 'FACT', fact_key: 'IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY' },
      ],
    }],
  };
  nested.indexed_facts = ['IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY'];
  assert.throws(() => validate(nested), /does not establish its declared trigger/);

  const conditional = structuredClone(base);
  conditional.condition_expression = {
    operator: 'ALL_OF',
    operands: [{
      operator: 'IF_THEN',
      if: { operator: 'FACT', fact_key: 'IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY' },
      then: { operator: 'FACT', fact_key: base.trigger_code },
    }],
  };
  conditional.indexed_facts = ['IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY'];
  assert.throws(() => validate(conditional), /does not establish its declared trigger/);

  const negated = structuredClone(base);
  negated.condition_expression = {
    operator: 'ALL_OF',
    operands: [{
      operator: 'NOT',
      operand: { operator: 'FACT', fact_key: base.trigger_code },
    }],
  };
  assert.throws(() => validate(negated), /unknown operator/);

  for (const mutation of [
    { pathway_code: 'TAIL_OUTSIDE_DATE' },
    { trigger_code: 'OUTSIDE_DATE_TERMINATION' },
    { terminating_party: 'EITHER_PARTY' },
    { payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION' },
  ]) {
    const hybrid = { ...structuredClone(base), ...mutation };
    if (mutation.trigger_code) {
      hybrid.condition_expression.operands[0].fact_key = mutation.trigger_code;
    }
    assert.throws(() => validate(hybrid), /frozen template/);
  }
});

test('F4 slices are deterministic and F3 cannot publish the corrected graph', () => {
  const buyer = buildSide('BUYER');
  const seller = buildSide('SELLER');
  assert.ok(validateQxoBuyerTerminationFeeAdmittedSlice({
    candidate: buyer.candidate,
    ...buyer,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
  }));
  assert.ok(validateQxoSellerTerminationFeeF4AdmittedSlice({
    candidate: seller.candidate,
    ...seller,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
  }));
  assert.equal(canonicalJson(buyer.candidate), canonicalJson(buildSide('BUYER').candidate));
  assert.equal(canonicalJson(seller.candidate), canonicalJson(buildSide('SELLER').candidate));
  assert.throws(() => buildQxoBuyerTerminationFeeAdmittedSlice({
    ...buildQxoF4SourceContexts(),
    contractBundle: compileFixtureContractV3(),
    corpusReleaseId,
    servingNamespaceId,
  }), /versioned F4 buyer-fee binding/);
});

test('both corrected fee members seal into one F4 candidate release and import plan', () => {
  const buyer = buildSide('BUYER').candidate;
  const seller = buildSide('SELLER').candidate;
  const release = buildFixtureCandidateRelease({
    contract_bundle: contractBundle,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: [seller.candidate_release_member, buyer.candidate_release_member],
    correction_authority_selection: buildFixtureCandidateInputAuthority({
      contractBundle,
    }),
    deal_directory_entries: [{
      application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
      governed_deal_key: 'deal:qxo-topbuild',
    }],
  });
  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.equal(release.market_observations.length, 2);
  assert.equal(release.market_exclusions.length, 0);
  assert.equal(release.shared_rows.length, 2);
  assert.equal(release.query_records.length, 2);
  assert.equal(release.exact_detail_packages.length, 2);
  const plan = buildCandidateReleaseImportPlan({ release });
  assert.equal(validateCandidateReleaseImportPlan(plan), true);
  assert.equal(plan.expected_counts.market_observations, 2);
  assert.equal(plan.expected_counts.query_records, 2);
  assert.equal(plan.expected_counts.exact_detail_packages, 2);
});
