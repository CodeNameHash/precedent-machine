'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  projectTerminationFeeProductSurfaces,
  projectTerminationRightsProductSurfaces,
} = require('../lib/canonical-v2/termination-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { executeDealToMarket } = require('../lib/query/executors/deal-to-market');
const { provisionFieldValue } = require('../lib/query/types');
const { calculateMarketStats } = require('../lib/row-market-stats/service');

function resolved({ id, definition, value, concept, quote, attributes = {}, capacity = 'EITHER_PRINCIPAL_PARTY' }) {
  return {
    resolved_claim_definition_key: definition,
    concept_key: concept,
    section_reference: '8.1',
    party: { role: 'TERMINATION_RIGHT_HOLDER', value: 'Parent and Company', capacity },
    provision_instance: {
      provision_instance_id: id,
      party: { role: 'TERMINATION_RIGHT_HOLDER', value: 'Parent and Company', capacity },
    },
    claim: {
      claim_revision_id: `${id}:${definition}:${String(value)}`,
      canonical_value: value,
      raw_value: quote,
      attributes,
    },
  };
}

function openWorld(surface, quote, structured_mechanic = null) {
  return {
    section_reference: '8.1',
    reason: 'NATIVE_OPEN_WORLD_PROPOSAL',
    claim_definition_key: 'OPEN_WORLD_PROPOSITION',
    raw_value: quote,
    canonical_value: null,
    attributes: {
      why_unmapped: `${surface}: retained pending adjudication`,
      ...(structured_mechanic ? { structured_mechanic } : {}),
    },
    closure_id: `open:${surface}`,
  };
}

function compareFields(dealId, provisionType, cards, deal = {}) {
  const output = executeDealCompare({
    deal_ids: [dealId],
    provision_types: [provisionType],
    included_field_groups: ['all'],
    highlight_deltas: false,
  }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Company', metadata: {}, ...deal }],
    provisions: cards,
  });
  return new Map(output.rows[0].cells[0].key_fields.map((field) => [field.field, field.value]));
}

function marketFields(dealId, provisionType, cards, deals) {
  return new Map(executeDealToMarket({
    deal_id: dealId,
    provision_types: [provisionType],
  }, { deals, provisions: cards }).scorecard.map((field) => [field.field_path, field.deal_value]));
}

test('governed termination rights retain Wave B evidence and expose direct Query and market fields', async () => {
  const dealId = 'termination-rights-product';
  const resolution = {
    resolved: [
      resolved({
        id: 'right-mutual',
        definition: 'TERMINATION_RIGHT_GRANT',
        value: true,
        concept: 'TERMR-MUTUAL',
        quote: 'The agreement may be terminated by mutual written consent of Parent and the Company.',
        attributes: { trigger_kind: 'MUTUAL_CONSENT' },
      }),
      resolved({
        id: 'right-outside',
        definition: 'TERMINATION_OUTSIDE_DATE',
        value: '2027-06-30',
        concept: 'TERMR-OUTSIDE',
        quote: 'Either Parent or the Company may terminate if closing has not occurred by June 30, 2027.',
        attributes: { trigger_kind: 'OUTSIDE_DATE', deadline_term_ref: 'Outside Date' },
      }),
      resolved({
        id: 'right-breach',
        definition: 'TERMINATION_RIGHT_GRANT',
        value: true,
        concept: 'TERMR-BREACH',
        quote: 'Parent may terminate for a breach by the Company.',
        attributes: { trigger_kind: 'BREACH' },
        capacity: 'BUYER',
      }),
      resolved({
        id: 'right-breach',
        definition: 'TERMINATION_CURE_PERIOD_DAYS',
        value: '30',
        concept: 'TERMR-BREACH',
        quote: 'Parent may terminate for a breach by the Company not cured within 30 days.',
        attributes: { trigger_kind: 'BREACH', day_kind: 'CALENDAR', period_kind: 'CURE' },
        capacity: 'BUYER',
      }),
      resolved({
        id: 'right-vote',
        definition: 'TERMINATION_RIGHT_GRANT',
        value: true,
        concept: 'TERMR-NOVOTE',
        quote: 'Either party may terminate if the required stockholder vote is not obtained.',
        attributes: { trigger_kind: 'VOTE_FAILURE' },
      }),
    ],
    open_world: [
      openWorld(
        'OUTSIDE_DATE_EXTENSION',
        'The Outside Date shall automatically extend by three months, up to two times.',
        {
          surface: 'OUTSIDE_DATE_EXTENSION', extension_mode: 'AUTOMATIC', electing_party: null,
          consent_requirement_quote: null, trigger_quote: null, maximum_exercises: 2,
          extension_period_quote: 'three months',
        },
      ),
      openWorld(
        'RESTRAINT_FINALITY',
        'A final order may prevent the transaction.',
        { surface: 'RESTRAINT_FINALITY', finality_terms_present: ['FINAL'], other_finality_terms: [] },
      ),
    ],
  };
  const projection = projectTerminationRightsProductSurfaces({ resolution, deal_id: dealId });
  assert.equal(projection.open_items.length, 2);
  assert.equal(projection.claims.some((claim) => /extension/i.test(claim.attribute)), false);
  assert.equal(projection.cards.filter((card) => card.canonical_v2_lineage.source === EVIDENCE_SOURCE).length, 2);
  assert.ok(projection.cards.filter((card) => card.provision_subtype !== 'OPEN-WORLD')
    .every((card) => card.canonical_v2_lineage.source === NATIVE_SOURCE));

  const outside = projection.cards.find((card) => card.provision_subtype === 'TERMR-OUTSIDE');
  assert.equal(provisionFieldValue(outside, 'TERMINATION_RIGHT', 'outsideDate').value, '2027-06-30');
  const breach = projection.cards.find((card) => card.provision_subtype === 'TERMR-BREACH-T');
  assert.equal(provisionFieldValue(breach, 'TERMINATION_RIGHT', 'curePeriod').value, 30);

  const review = await import('../components/review/table-configs/termination-rights.config.js');
  const selected = review.terminationRightsConfig.selectRows({ cards: projection.cards });
  const rows = selected[0].groups.flatMap((group) => group.rows);
  assert.ok(rows.some((row) => row.id === 'termination-rights-vote' && row.present));
  assert.ok(rows.some((row) => row.id.startsWith('termination-rights-deferred-')));
  const outsideRow = rows.find((row) => row.id === 'termination-rights-outside');
  assert.deepEqual(outsideRow.marketSubterms.map((term) => term.key), ['outside-date', 'exercised-by']);
  const breachRow = rows.find((row) => row.id === 'termination-rights-breachT');
  assert.deepEqual(breachRow.marketSubterms.map((term) => term.key), ['cure-period']);

  const compare = compareFields(dealId, 'TERMINATION_RIGHT', projection.cards);
  assert.equal(compare.get('partyWhoCanTerminate'), 'PARTY_MUTUAL');
  assert.equal(compare.get('outsideDate'), '2027-06-30');
  assert.equal(compare.get('curePeriod'), 30);
  assert.equal(compare.has('extensionMaxExercises'), true);
  assert.equal(compare.get('extensionMaxExercises'), 2);

  const adapter = await import('../lib/market-metrics/adapter.js');
  const specs = adapter.resolveMarketMetricSpecs(outsideRow, { configId: 'termination-rights' });
  assert.ok(specs.length > 0);
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: dealId, announce_date: '2026-06-30', value_usd: 1000000000, metadata: {} }],
    cards: projection.cards,
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow[specs[0].rowKey].metrics).some((metric) => metric.coverage?.observedCount === 1));

  const rightsMarket = marketFields(dealId, 'TERMINATION_RIGHT', projection.cards, [
    { id: dealId, announce_date: '2026-06-30', metadata: {} },
    { id: 'peer-rights', announce_date: '2026-06-30', metadata: {} },
  ]);
  assert.equal(rightsMarket.get('extensionMaxExercises'), 2);
});

test('governed termination fees retain remedies ownership and expose direct late-interest Query and market fields', async () => {
  const dealId = 'termination-fee-product';
  const sellerQuote = 'The Company shall pay Parent a termination fee of $100,000,000 following a change in recommendation.';
  const resolution = {
    resolved: [
      resolved({ id: 'fee-seller', definition: 'TERMINATION_FEE_AMOUNT', value: '100000000', concept: 'TERMF-TARGET', quote: sellerQuote }),
      resolved({ id: 'fee-seller', definition: 'TERMINATION_FEE_TRIGGER', value: 'CHANGE_IN_RECOMMENDATION_TERMINATION', concept: 'TERMF-TARGET', quote: sellerQuote }),
      resolved({ id: 'fee-buyer', definition: 'TERMINATION_FEE_AMOUNT', value: '150000000', concept: 'TERMF-REVERSE', quote: 'Parent shall pay the Company a reverse termination fee of $150,000,000.' }),
      resolved({ id: 'fee-tail', definition: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS', value: '12', concept: 'TERMF-TAIL', quote: 'The tail period is twelve (12) months following termination.', capacity: 'TARGET' }),
    ],
    open_world: [
      openWorld(
        'SOLE_REMEDY',
        'Receipt of the termination fee is the sole and exclusive remedy, except for Fraud and Willful Breach.',
        {
          surface: 'SOLE_REMEDY_EVIDENCE', owner_family: 'SPECIFIC_PERFORMANCE_REMEDIES',
          payment_context_quote: 'Receipt of the termination fee',
          remedy_effect_quote: 'sole and exclusive remedy',
          carve_outs: ['Fraud', 'Willful Breach'],
        },
      ),
      openWorld(
        'LATE_PAYMENT_INTEREST',
        'If the termination fee is not paid when due, interest accrues at the Applicable Rate.',
        {
          surface: 'LATE_PAYMENT_INTEREST', interest_present: true,
          benchmark_quote: 'Applicable Rate', due_date_reference_quote: 'when due',
        },
      ),
    ],
  };
  const projection = projectTerminationFeeProductSurfaces({ resolution, deal_id: dealId });
  assert.equal(projection.open_items.length, 2);
  assert.equal(projection.claims.some((claim) => /sole|remedy/i.test(claim.attribute)), false);
  const seller = projection.cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  assert.equal(provisionFieldValue(seller, 'TERMINATION_FEE', 'feeAmount').value, 100000000);
  assert.equal(seller.features.companyTerminationFee.triggers[0].code, 'CHANGE_IN_RECOMMENDATION_TERMINATION');
  const sellerFeeClaims = projection.claims.filter((claim) => (
    claim.excerpt_id === seller.excerpt_id && claim.attribute === 'companyTerminationFee'
  ));
  assert.equal(sellerFeeClaims.length, 1);
  assert.equal(sellerFeeClaims[0].canonical.amount, '$100,000,000');
  assert.equal(sellerFeeClaims[0].canonical.triggers.length, 1);

  const review = await import('../components/review/table-configs/termination-fees.config.js');
  const rows = review.terminationFeesConfig.selectRows({ cards: projection.cards, value_usd: 2000000000 });
  assert.ok(rows.some((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE'));
  assert.ok(rows.some((row) => row.id === 'termination-fees-REVERSE_TERMINATION_FEE'));
  assert.ok(rows.some((row) => row.id.startsWith('termination-fees-deferred-')));
  const deferred = projection.cards.find((card) => card.features.remediesOwnedSoleRemedyEvidence);
  assert.ok(deferred.features.canonicalV2OpenWorldEvidence.structuredMechanic);
  assert.deepEqual(deferred.features.remediesOwnedSoleRemedyEvidence.carve_outs, ['Fraud', 'Willful Breach']);
  assert.equal(deferred.features.soleRemedy, undefined);
  const interest = projection.cards.find((card) => card.features.interestOnLatePayment);
  assert.equal(interest.features.interestOnLatePayment, true);
  assert.equal(interest.features.latePaymentInterestBenchmark, 'Applicable Rate');
  const sellerRow = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.ok(sellerRow.signals.some((signal) => signal.label === 'Change in recommendation'));

  const tailReview = await import('../components/review/table-configs/tail-fee.config.js');
  const tailRows = tailReview.tailFeeConfig.selectRows({ cards: projection.cards });
  assert.deepEqual(tailRows.map((row) => row.id), ['tail-window']);
  assert.equal(tailRows[0].value, '12 months');

  const compare = compareFields(dealId, 'TERMINATION_FEE', projection.cards, { value_usd: 2000000000 });
  assert.equal(compare.get('feeAmount'), 100000000);
  assert.equal(compare.get('feePctOfDealValue'), 5);
  assert.equal(compare.get('reverseFeeAmount'), 150000000);
  assert.equal(compare.get('reverseFeePctOfDealValue'), 7.5);
  assert.equal(compare.get('tailFeeWindowMonths'), 12);
  assert.equal(compare.get('interestOnLatePayment'), true);
  assert.equal(compare.has('reverseFeePercentage'), false);

  const adapter = await import('../lib/market-metrics/adapter.js');
  const specs = adapter.resolveMarketMetricSpecs(sellerRow, { configId: 'termination-fees' });
  const market = calculateMarketStats({ contractVersion: 1, subjectDealId: null, filters: {}, specs }, {
    deals: [{ id: dealId, value_usd: 2000000000, metadata: { deal_value_basis: 'equity_value' } }],
    cards: projection.cards,
    claims: projection.claims,
  });
  assert.ok(Object.values(market.byRow[specs[0].rowKey].metrics).some((metric) => metric.coverage?.observedCount === 1));

  const feeMarket = marketFields(dealId, 'TERMINATION_FEE', projection.cards, [
    { id: dealId, announce_date: '2026-06-30', value_usd: 2000000000, metadata: {} },
    { id: 'peer-fee', announce_date: '2026-06-30', value_usd: 1800000000, metadata: {} },
  ]);
  assert.equal(feeMarket.get('interestOnLatePayment'), true);
});
