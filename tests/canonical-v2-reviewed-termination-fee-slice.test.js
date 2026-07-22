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
const {
  buildReviewedTerminationFeeServingRow,
  buildReviewedTerminationFeeSlice,
} = require('../lib/canonical-v2/reviewed-termination-fee-slice');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
const { adaptSharedServingRow, SURFACES } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');

const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
const contractBundle = compileFixtureContract();

function build() {
  return buildReviewedTerminationFeeSlice({ agreementText, dealValueSourceText, contractBundle });
}

test('the real Landos seller fee becomes a source-backed percentage with explicit side', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(Object.keys(first.sections), ['7.1', '7.3']);
  assert.equal(first.excerpts.fee_amount.exact_text, '$7,000,000');
  assert.equal(first.feeClaim.raw_value, '$7,000,000');
  assert.equal(first.feeClaim.canonical_value, '5.09090909');
  assert.equal(first.feeClaim.unit, 'PERCENT_OF_DEAL_VALUE');
  assert.deepEqual(first.result.party, { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
  assert.deepEqual(first.feeClaim.denominator, {
    value: '137500000',
    currency: 'USD',
    basis: 'HEADLINE_TRANSACTION_VALUE',
    source_lineage_ids: [first.excerpts.deal_value.excerpt_id],
  });
  assert.deepEqual(first.feeClaim.evidence.map((row) => row.document_ordinal), [0, 1]);
});

test('one fee result composes three exact trigger relationships from separate spans', () => {
  const slice = build();
  assert.equal(slice.triggerRelationships.length, 3);
  assert.deepEqual(slice.triggerRelationships.map((row) => row.effect.trigger_code), [
    'SUPERIOR_PROPOSAL_TERMINATION',
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'ACQUISITION_PROPOSAL_TAIL',
  ]);
  slice.triggerRelationships.forEach((relationship, index) => {
    assert.equal(relationship.source_occurrence_id, slice.feeComponent.provision_component_id);
    assert.deepEqual(relationship.target_occurrence_ids, [
      slice.triggerComponents[index].provision_component_id,
    ]);
    assert.equal(relationship.evidence.length, 2);
    assert.equal(relationship.publication_state, 'VALIDATED');
  });
  assert.deepEqual(slice.triggerRelationships[2].effect.conditions, [
    'PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN',
    'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
    'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
  ]);
  assert.equal(slice.result.relationship_revision_ids.length, 3);
});

test('the fee, triggers and both sources write transactionally with zero residuals', async () => {
  const slice = build();
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository, contractBundle });
  const dryRun = await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-termination-fee-v1',
    dryRun: true,
    writeSet: slice.canonicalWriteSet,
  });
  assert.equal(dryRun.validation.counts.residuals, 0);
  assert.equal(dryRun.validation.counts.quarantinedClosures, 0);
  assert.equal(repository.transactionCount, 0);

  await writer.write({
    operation: 'FIXTURE_DEAL_EXTRACTION_RUN',
    idempotencyKey: 'landos-termination-fee-v1',
    writeSet: slice.canonicalWriteSet,
  });
  const stored = repository.snapshot();
  assert.equal(repository.transactionCount, 1);
  assert.equal(stored.sources.length, 2);
  assert.equal(stored.sourceAdmissions.length, 2);
  assert.equal(stored.provisions.length, 4);
  assert.equal(stored.components.length, 4);
  assert.equal(stored.claims.length, 1);
  assert.equal(stored.relationships.length, 3);
});

test('all three triggers survive the release projection and one shared row', () => {
  const slice = build();
  assert.equal(slice.projection.exclusion, null);
  assert.equal(validateProjectedMetricSlotOutput(slice.projection), true);
  assert.equal(slice.projection.observation.relationship_revision_ids.length, 3);
  assert.equal(slice.projection.observation.relationship_effects.length, 3);

  const row = buildReviewedTerminationFeeServingRow({ slice, contractBundle });
  assert.equal(validateSharedServingRow(row), true);
  assert.equal(row.canonical_result.components[0].bounded_relationship_effects.length, 3);
  const adapted = adaptSharedServingRow(row);
  const metric = adapted.data.byRow[adapted.row_key]
    .metrics.SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE;
  assert.equal(metric.subject.rawAmount, '$7,000,000');
  assert.equal(metric.subject.percentOfDealValue, 5.09090909);
  assert.deepEqual(metric.subject.legalTerms.map((term) => term.label), [
    'Fee amount',
    'Fee side',
    'Payer',
    'Payee',
    'Deal-value basis',
    'Triggers',
    '',
    '',
  ]);
  const triggers = metric.subject.legalTerms.filter((term) => term.key.startsWith('trigger_'));
  assert.match(triggers[0].value, /Superior Proposal/);
  assert.match(triggers[1].value, /Change in Recommendation/);
  assert.match(triggers[2].value, /within 12 months/);
  for (const surface of SURFACES) {
    assert.equal(adapted.surface_bindings[surface].typed_market, adapted.typed_market);
  }
});

test('the source action can resolve either the fee or its denominator without broad source access', () => {
  const slice = build();
  const row = buildReviewedTerminationFeeServingRow({ slice, contractBundle });
  const inputs = [
    {
      source: slice.agreementSource,
      source_admission: slice.agreementAdmission,
      excerpt: slice.excerpts.fee_amount,
      evidence_ordinal: 0,
      exact_text: '$7,000,000',
    },
    {
      source: slice.dealValueSource,
      source_admission: slice.dealValueAdmission,
      excerpt: slice.excerpts.deal_value,
      evidence_ordinal: 1,
      exact_text: 'representing a total transaction value of approximately $137.5 million at the closing',
    },
  ];
  for (const input of inputs) {
    const detailPackage = buildFixtureClaimEvidenceDetailPackage({
      contract_bundle: contractBundle,
      row,
      claim: slice.feeClaim,
      action_slot_key: GENERAL_ACTION_SLOT_KEY,
      ...input,
    });
    assert.equal(detailPackage.detail_payloads[0].response_body.excerpt.exact_text, input.exact_text);
    assert.equal(validateFixtureExactDetailPackage({
      package: detailPackage,
      contract_bundle: contractBundle,
      source: input.source,
      source_admission: input.source_admission,
      excerpt: input.excerpt,
      claim: slice.feeClaim,
    }), true);
  }
});

test('either exact source drifting blocks the reviewed fee mapping', () => {
  assert.throws(() => buildReviewedTerminationFeeSlice({
    agreementText: `${agreementText} `,
    dealValueSourceText,
    contractBundle,
  }), /agreement source hash mismatch/);
  assert.throws(() => buildReviewedTerminationFeeSlice({
    agreementText,
    dealValueSourceText: `${dealValueSourceText} `,
    contractBundle,
  }), /deal-value source hash mismatch/);
});
