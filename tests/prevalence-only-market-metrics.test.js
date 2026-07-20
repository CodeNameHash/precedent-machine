import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMarketMetricRow, validateMarketMetricSpec } from '../lib/market-metrics/index.js';
import legalNormalizers from '../lib/row-market-stats/legal-normalizers.js';
import { buildGroups } from '../components/review/table-configs/nosol-section.config.js';
import { terminationFeesConfig } from '../components/review/table-configs/termination-fees.config.js';
import { tailFeeConfig } from '../components/review/table-configs/tail-fee.config.js';

const { NORMALIZERS } = legalNormalizers;

function card(id, provisionSubtype, features, primaryQuote = '') {
  return {
    id,
    provision_type: provisionSubtype.startsWith('TERMF-') ? 'TERMINATION_FEE' : 'COVENANT_NO_SOLICITATION',
    provision_subtype: provisionSubtype,
    short_title: id,
    primary_quote: primaryQuote,
    features,
  };
}

function claim(attribute, value, code = null) {
  return {
    id: `${attribute}-${code || 'claim'}`,
    deal_id: 'qxo',
    excerpt_id: `${code || 'card'}-excerpt`,
    attribute,
    canonical: typeof value === 'string' ? value : null,
    verbatim: typeof value === 'string' ? value : JSON.stringify(value),
    provenance: { ...(code ? { code } : {}), feature_value: value },
  };
}

function metricResolution(row, configId, provisionFamily) {
  return resolveMarketMetricRow(row, { sectionId: configId, configId, provisionFamily });
}

test('no-sol wrapper keeps semantic subterms and treats no go-shop as a comparable outcome', () => {
  const cards = [card(
    'superior',
    'NOSOL-SUPERIOR',
    {
      superiorProposalThresholdPct: 80,
      superiorProposalTest: 'reasonably likely to be completed and more favorable from a financial point of view',
    },
    'A Superior Proposal is reasonably likely to be completed and more favorable from a financial point of view.',
  )];
  const groups = buildGroups({ cards });
  const goShop = groups.find((group) => group.id === 'nosol-go-shop').rows[0];
  const superiorRows = groups.find((group) => group.id === 'nosol-superior').rows;
  const threshold = superiorRows.find((row) => row.id === 'nosol-superior-threshold');
  const testRow = superiorRows.find((row) => row.id === 'nosol-superior-test');

  assert.deepEqual(goShop.marketSubterms.map((subterm) => subterm.label), [
    'Go-shop availability',
    'Go-shop period',
    'Excluded-party treatment',
    'Extended negotiating period',
  ]);
  assert.equal(goShop.marketSubterms[0].conditionalOnPresence, false);
  assert.ok(goShop.marketProvisionCodes.includes('NOSOL-GOSHOP'));
  assert.ok(goShop.marketProvisionCodes.includes('NOSOL-SUPERIOR'));
  assert.equal(threshold.marketSubterms[0].kind, 'numeric');
  assert.equal(testRow.marketSubterms[0].value.normalizer, 'superior_proposal_test_factors');
  assert.deepEqual(testRow.marketProvisionCodes, ['NOSOL-SUPERIOR', 'DEF-SUPERIOR']);

  const resolution = metricResolution(goShop, 'nosol', 'NOSOL');
  assert.equal(resolution.resolution, 'semantic_row');
  assert.ok(resolution.metrics.every((metric) => validateMarketMetricSpec(metric).valid));
  const availability = resolution.metrics.find((metric) => metric.label === 'Go-shop availability');
  const period = resolution.metrics.find((metric) => metric.label === 'Go-shop period');
  assert.equal(availability.denominator.conditionalOn, undefined);
  assert.ok(period.denominator.conditionalOn?.metricKey);
});

test('Intervening Event rows compare rights, scope, exceptions and termination treatment', () => {
  const cards = [
    card('intervening', 'NOSOL-INTERVENING', {
      interveningEventProvision: true,
      boardChangeForInterveningEvent: true,
      interveningEventDefinition: 'a material event not known or reasonably foreseeable to the Board at signing',
      interveningEventScope: 'POSITIVE_ONLY',
      interveningEventExceptions: [{ code: 'ACQUISITION_PROPOSAL_RELATED' }, { code: 'AGREEMENT_COMPLIANCE_ACTIONS' }],
      interveningEventTermination: 'No separate termination right is created; only a recommendation change is permitted.',
    }, 'The Board may make an Intervening Event Recommendation Change. No separate termination right is created.'),
  ];
  const rows = buildGroups({ cards }).find((group) => group.id === 'nosol-intervening').rows;
  const expected = {
    'nosol-intervening-provision': 'intervening_event_rights',
    'nosol-intervening-scope': 'intervening_event_scope',
    'nosol-intervening-exceptions': 'intervening_event_exceptions',
    'nosol-intervening-termination': 'intervening_event_termination_treatment',
  };

  for (const [id, normalizer] of Object.entries(expected)) {
    const row = rows.find((candidate) => candidate.id === id);
    assert.ok(row, `${id} must render`);
    assert.equal(row.marketSubterms[0].value.normalizer, normalizer);
    assert.deepEqual(row.marketProvisionCodes, ['NOSOL-INTERVENING', 'DEF-INTERVENING']);
    const resolution = metricResolution(row, 'nosol', 'NOSOL');
    assert.equal(resolution.resolution, 'semantic_row');
    assert.ok(resolution.metrics.some((metric) => metric.comparison.kind !== 'presence'));
    assert.equal(resolution.errors.length, 0);
  }
});

test('late-payment interest and every tail row expose finite legal subterms', () => {
  const interest = {
    base: 'such overdue amount',
    rate: 'the prime rate set forth in The Wall Street Journal plus 2%',
  };
  const targetFee = card('target-fee', 'TERMF-TARGET', {
    companyTerminationFee: { amount: '$600,000,000', triggers: [] },
    interestOnLatePayment: interest,
    interestRateBasis: { code: 'PRIME_WSJ', label: 'WSJ prime' },
  }, 'Interest accrues on the overdue amount at WSJ prime plus 2%.');
  const interestRow = terminationFeesConfig.selectRows({ cards: [targetFee] })
    .find((row) => row.id === 'termination-fees-interest');
  assert.deepEqual(interestRow.marketSubterms.map((subterm) => subterm.value.normalizer), [
    'late_payment_rate_basis',
    'late_payment_spread_percent',
    'late_payment_interest_base',
  ]);
  assert.equal(metricResolution(interestRow, 'termination-fees', 'TERMF').errors.length, 0);

  const tailProvision = {
    period_months: 12,
    threshold_percentage: '50%',
    triggers: [{
      code: 'TAIL',
      label: 'Outside Date, no-vote, no-solicit or other covenant breach, or recommendation-change termination, followed by signing or consummating any publicly announced Acquisition Proposal',
      text: 'Within 12 months the Company enters into a definitive agreement for or consummates any Acquisition Proposal.',
    }],
  };
  const tailRows = tailFeeConfig.selectRows({ cards: [card('tail', 'TERMF-TAIL', { tailProvision }, 'Tail fee provision.')] });
  assert.deepEqual(tailRows.map((row) => row.marketSubterms[0].value.normalizer), [
    'tail_window_months',
    'tail_threshold_percent',
    'tail_arming_scenarios',
    'tail_qualifying_transaction_scope',
  ]);
  for (const row of tailRows) {
    const resolution = metricResolution(row, 'tail-fee', 'TERMF');
    assert.equal(resolution.resolution, 'semantic_row');
    assert.equal(resolution.errors.length, 0);
  }
});

test('QXO-shaped clauses normalise into useful finite market categories', () => {
  const qxoSuperior = 'The Board determines in good faith that the proposal is reasonably likely to be completed, taking into account all financial, legal, regulatory and other aspects and the Person making it, is more favorable from a financial point of view, and contains no due diligence or financing condition.';
  assert.deepEqual(NORMALIZERS.superior_proposal_test_factors(qxoSuperior), [
    'FINANCIALLY_MORE_FAVOURABLE',
    'REASONABLY_LIKELY_TO_COMPLETE',
    'FINANCIAL_LEGAL_AND_REGULATORY_FACTORS',
    'BIDDER_IDENTITY_OR_CAPABILITY',
    'NO_FINANCING_CONDITION',
    'NO_DUE_DILIGENCE_CONDITION',
  ]);

  const interveningClaims = [
    claim('interveningEventScope', { code: 'POSITIVE_ONLY' }, 'NOSOL-INTERVENING'),
    claim('interveningEventDefinition', 'a material event, development or change not known or reasonably foreseeable to the Board at signing, including consequences whose magnitude was not reasonably foreseeable, becoming known before stockholder approval', 'NOSOL-INTERVENING'),
    claim('interveningEventExceptions', [{ code: 'ACQUISITION_PROPOSAL_RELATED' }, { code: 'AGREEMENT_COMPLIANCE_ACTIONS' }], 'NOSOL-INTERVENING'),
    claim('boardChangeForInterveningEvent', true, 'NOSOL-INTERVENING'),
    claim('interveningEventTermination', 'No separate termination right is created; the provision only permits a recommendation change.', 'NOSOL-INTERVENING'),
  ];
  assert.deepEqual(NORMALIZERS.intervening_event_scope(interveningClaims[0].provenance.feature_value, interveningClaims[0], '', interveningClaims), [
    'IE_POSITIVE_OR_NEGATIVE',
    'UNKNOWN_OR_UNFORESEEABLE_AT_SIGNING',
    'UNKNOWN_MAGNITUDE_OR_CONSEQUENCES',
    'DISCOVERED_BEFORE_STOCKHOLDER_APPROVAL',
    'MATERIAL_EVENT_REQUIRED',
  ]);
  assert.deepEqual(NORMALIZERS.intervening_event_exceptions(null, interveningClaims[2], '', interveningClaims), [
    'ACQUISITION_PROPOSAL_RELATED',
    'AGREEMENT_COMPLIANCE_ACTIONS',
  ]);
  assert.deepEqual(NORMALIZERS.intervening_event_termination_treatment(null, interveningClaims[4], '', interveningClaims), ['RECOMMENDATION_CHANGE_ONLY']);

  const interestClaims = [
    claim('interestRateBasis', { code: 'PRIME_WSJ' }, 'TERMF-TARGET'),
    claim('interestOnLatePayment', { base: 'such overdue amount', rate: 'WSJ prime plus 2%' }, 'TERMF-TARGET'),
  ];
  assert.deepEqual(NORMALIZERS.late_payment_rate_basis(null, interestClaims[0], '', interestClaims), ['PRIME_WSJ']);
  assert.deepEqual(NORMALIZERS.late_payment_spread_percent(null, interestClaims[1], '', interestClaims), [{ value: 2, unit: 'percent' }]);
  assert.deepEqual(NORMALIZERS.late_payment_interest_base(null, interestClaims[1], '', interestClaims), ['OVERDUE_AMOUNT']);

  const tail = {
    period_months: 12,
    threshold_percentage: '50%',
    triggers: [{
      label: 'Outside Date, no-vote, no-solicit/covenant breach or other covenant breach, or recommendation-change termination preceded by a publicly announced Acquisition Proposal',
      text: 'Within 12 months the Company enters into a definitive agreement with respect to any Company Acquisition Proposal or the transaction is consummated.',
    }],
  };
  assert.deepEqual(NORMALIZERS.tail_window_months(tail, claim('tailProvision', tail)), [{ value: 12, unit: 'months', calendarBasis: 'elapsed', trigger: 'qualifying_termination' }]);
  assert.deepEqual(NORMALIZERS.tail_threshold_percent(tail, claim('tailProvision', tail)), [{ value: 50, unit: 'percent' }]);
  assert.deepEqual(NORMALIZERS.tail_arming_scenarios(tail), [
    'OUTSIDE_DATE_TERMINATION',
    'STOCKHOLDER_NO_VOTE_TERMINATION',
    'NO_SOLICIT_BREACH_TERMINATION',
    'OTHER_COVENANT_BREACH_TERMINATION',
    'ADVERSE_RECOMMENDATION_CHANGE_TERMINATION',
  ]);
  assert.deepEqual(NORMALIZERS.tail_qualifying_transaction_scope(tail), [
    'DEFINITIVE_AGREEMENT_WITHIN_TAIL_WINDOW',
    'CONSUMMATION_WITHIN_TAIL_WINDOW',
    'PRE_TERMINATION_PUBLIC_ANNOUNCEMENT_REQUIRED',
    'ANY_QUALIFYING_TRANSACTION',
  ]);

  const ceaseClaims = [
    claim(
      'ceaseDiscussionsAffiliateStandard',
      'The Company shall cause its Affiliates and Representatives to immediately cease all discussions.',
      'NOSOL-CEASE',
    ),
    claim(
      'ceaseDiscussionsAffiliateStandard',
      'The Company shall cause each Affiliate and Representative to terminate existing negotiations.',
      'NOSOL-CEASE',
    ),
  ];
  assert.deepEqual(
    NORMALIZERS.cease_discussions_affiliate_standard(null, ceaseClaims[0], '', ceaseClaims),
    ['CAUSE_AFFILIATES_AND_REPRESENTATIVES'],
  );
  assert.deepEqual(
    NORMALIZERS.cease_discussions_liability_standard(null, ceaseClaims[0], '', ceaseClaims),
    ['NO_EXPRESS_REPRESENTATIVE_BREACH_ATTRIBUTION'],
  );

  const finalStandard = claim('fiduciaryFinalStandard', 'The Board determines that the Acquisition Proposal constitutes a Company Superior Proposal.', 'NOSOL-MATCH');
  const dutyStandard = claim('changeRecStandard', 'Failure to make a Change of Recommendation would be inconsistent with the directors\' fiduciary duties.', 'NOSOL-MATCH');
  assert.deepEqual(NORMALIZERS.fiduciary_final_standard(null, finalStandard), ['CONSTITUTES_SUPERIOR_PROPOSAL']);
  assert.deepEqual(
    NORMALIZERS.fiduciary_duty_change_standard(null, dutyStandard),
    ['FAILURE_TO_CHANGE_INCONSISTENT_WITH_FIDUCIARY_DUTIES'],
  );

  const preVote = claim('preVoteOnlyWindow', 'prior to receipt of the Company Stockholder Approval', 'NOSOL-RECOMMEND');
  assert.deepEqual(NORMALIZERS.pre_vote_only(null, preVote, '', [preVote]), ['BEFORE_STOCKHOLDER_APPROVAL']);
  assert.deepEqual(
    NORMALIZERS.stockholder_vote_standard('Approval by a majority of the outstanding shares', claim('definitionText', 'Approval by a majority of the outstanding shares', 'DEF-STOCKHOLDER')),
    ['MAJORITY_OF_OUTSTANDING_SHARES'],
  );
  assert.deepEqual(
    NORMALIZERS.stockholder_vote_standard('Approval by a majority of the votes cast', claim('definitionText', 'Approval by a majority of the votes cast', 'DEF-STOCKHOLDER')),
    ['MAJORITY_OF_VOTES_CAST'],
  );
  assert.deepEqual(
    NORMALIZERS.stockholder_vote_standard('Merger Sub Stockholder Approval means approval by its sole stockholder.', claim('definitionText', 'Merger Sub Stockholder Approval means approval by its sole stockholder.', 'DEF-STOCKHOLDER')),
    [],
  );

  const approvalTiming = claim('mainConcept', 'Parent shall cause the written consent to be executed immediately following execution of this Agreement.', 'COV-SHAPRV-PARENT');
  assert.deepEqual(NORMALIZERS.parent_approval_timing(null, approvalTiming, '', [approvalTiming]), ['IMMEDIATELY_AFTER_SIGNING']);
});
