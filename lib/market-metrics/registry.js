import { comparableMetric, nonComparableMetric } from './contract.js';
import iocObligationIdentity from './ioc-obligation-identity.js';

const { affirmativeObligationIdentity } = iocObligationIdentity;

export const DEAL_VALUE_NORMALISATION = Object.freeze({
  type: 'percent_of_deal_value',
  denominator: 'deal_value_usd',
  basisPolicy: 'stratify_by_basis',
  missingPolicy: 'exclude',
});

export const ALL_DEALS_COHORT = Object.freeze({
  scope: 'all_deals',
  eligibility: 'all_deals',
});

export const NOSOL_PROVISION_CODES = Object.freeze([
  'NOSOL-ACQPROPOSAL',
  'NOSOL-B',
  'NOSOL-CEASE',
  'NOSOL-CEASE-DISC',
  'NOSOL-CHANGEREC',
  'NOSOL-CONFID',
  'NOSOL-COR',
  'NOSOL-DATA-ROOM',
  'NOSOL-DISCLOSE',
  'NOSOL-ENFORCE',
  'NOSOL-EXCEPT',
  'NOSOL-EXCEPTION',
  'NOSOL-EXCEPTIONS',
  'NOSOL-FIDUCIARY',
  'NOSOL-GOSHOP',
  'NOSOL-INFORMATION',
  'NOSOL-INTERVENING',
  'NOSOL-M',
  'NOSOL-MATCH',
  'NOSOL-NEGOTIATE',
  'NOSOL-NOTICE',
  'NOSOL-OTHER',
  'NOSOL-PROHIBIT',
  'NOSOL-RECOMMEND',
  'NOSOL-REMATCH',
  'NOSOL-STANDSTILL-WAIVER',
  'NOSOL-SUPERIOR',
  'NOSOL-T',
  'NOSOL-WAIVER',
  'NOSOL-WINDOW',
]);

export function provisionCodesCohort(provisionCodes, { eligibility = 'all_deals', provisionFamily } = {}) {
  return {
    scope: 'provision_codes',
    provisionCodes: [...new Set((provisionCodes || []).filter(Boolean))],
    eligibility,
    ...(provisionFamily ? { provisionFamily } : {}),
  };
}

export function provisionFamilyCohort(provisionFamily) {
  return {
    scope: 'provision_family',
    provisionFamily,
    eligibility: 'family_present',
  };
}

export function marketDenominator(conditionalMetricKey = null) {
  return {
    prevalence: 'eligible_deals',
    distribution: 'present_deals',
    ...(conditionalMetricKey ? { conditionalOn: { metricKey: conditionalMetricKey, state: 'present' } } : {}),
  };
}

function featurePresence(featureKeys, missingState = 'unknown') {
  return { strategy: 'feature_non_empty', featureKeys, missingState };
}

function featureValue(featureKeys, extra = {}) {
  return { strategy: 'feature_value', featureKeys, ...extra };
}

export function featureMetricSet({
  rowKey,
  metricBase,
  label,
  featureKeys,
  kind,
  cohort,
  semantics,
  presence,
  value,
  observationScope,
  missingState = 'unknown',
}) {
  const presenceKey = `${metricBase}.presence`;
  const presenceObservation = presence || featurePresence(featureKeys, missingState);
  const primary = comparableMetric({
    rowKey,
    metricKey: presenceKey,
    label: `${label} prevalence`,
    kind: 'presence',
    cohort,
    observation: { ...(observationScope ? { scope: observationScope } : {}), presence: presenceObservation },
    denominator: marketDenominator(),
    presentation: { role: 'prevalence' },
  });
  if (!kind || kind === 'presence') return [primary];
  return [
    primary,
    comparableMetric({
      rowKey,
      metricKey: `${metricBase}.value`,
      label,
      kind,
      cohort,
      observation: {
        ...(observationScope ? { scope: observationScope } : {}),
        presence: presenceObservation,
        value: value || featureValue(featureKeys),
      },
      denominator: marketDenominator(presenceKey),
      semantics,
      presentation: { role: 'treatment' },
    }),
  ];
}

export function semanticMetricSet({
  rowKey,
  metricBase,
  label,
  cohort,
  prevalenceCohort = ALL_DEALS_COHORT,
  presence,
  observationScope,
  subterms,
}) {
  const presenceKey = `${metricBase}.presence`;
  const metrics = [comparableMetric({
    rowKey,
    metricKey: presenceKey,
    label: `${label} prevalence`,
    kind: 'presence',
    cohort: prevalenceCohort,
    observation: {
      ...(observationScope ? { scope: observationScope } : {}),
      presence,
    },
    denominator: marketDenominator(),
    presentation: { role: 'prevalence' },
  })];

  for (const subterm of subterms || []) {
    const featureKeys = subterm.featureKeys || [];
    const subtermPresence = subterm.presence || featurePresence(featureKeys, subterm.missingState || 'unknown');
    const role = subterm.role || (subterm.kind === 'numeric' || subterm.kind === 'money' || subterm.kind === 'duration'
      ? 'metric'
      : (/exception/i.test(`${subterm.key || ''} ${subterm.label || ''}`) ? 'exception' : 'treatment'));
    metrics.push(comparableMetric({
      rowKey,
      metricKey: `${metricBase}.${subterm.metric || subterm.key}`,
      label: subterm.label,
      kind: subterm.kind,
      cohort: subterm.cohort || cohort,
      observation: {
        ...((subterm.observationScope || observationScope) ? { scope: subterm.observationScope || observationScope } : {}),
        presence: subtermPresence,
        ...(subterm.kind === 'presence' ? {} : {
          value: subterm.value || featureValue(featureKeys),
        }),
      },
      denominator: marketDenominator(subterm.conditionalOnPresence === false ? null : presenceKey),
      semantics: subterm.semantics,
      presentation: { role },
    }));
  }
  return metrics;
}

function conditionalFeatureMetric({
  rowKey,
  metricKey,
  label,
  kind,
  cohort,
  featureKeys,
  value,
  conditionalMetricKey,
  semantics,
  observationScope,
  presence,
  missingState = 'unknown',
}) {
  return comparableMetric({
    rowKey,
    metricKey,
    label,
    kind,
    cohort,
    observation: {
      ...(observationScope ? { scope: observationScope } : {}),
      presence: presence || featurePresence(featureKeys, missingState),
      value,
    },
    denominator: marketDenominator(conditionalMetricKey),
    semantics,
    presentation: { role: /exception/i.test(`${metricKey} ${label}`) ? 'exception' : (['numeric', 'money', 'duration'].includes(kind) ? 'metric' : 'treatment') },
  });
}

const NOSOL_FEATURE_ROWS = Object.freeze({
  'nosol-go-shop-none': {
    featureKeys: ['goShopPresent'], kind: 'categorical', metric: 'go-shop-present',
  },
  'nosol-go-shop-excluded': {
    featureKeys: ['goShopExcludedParties'], kind: 'multi_select', metric: 'go-shop-excluded-parties',
  },
  'nosol-noshop-prohibit': {
    featureKeys: ['ceaseDiscussionsProhibitedList'], kind: 'multi_select', metric: 'prohibited-actions', label: 'Prohibited actions',
  },
  'nosol-noshop-cease': {
    featureKeys: ['ceaseDiscussionsProhibitedList', 'ceaseDiscussionsAffiliateStandard', 'ceaseDiscussionsLiability'], kind: 'multi_select', metric: 'cease-discussions',
    subterms: [
      { key: 'prohibited-actions', label: 'Prohibited actions', featureKeys: ['ceaseDiscussionsProhibitedList'], kind: 'multi_select' },
      {
        key: 'affiliate-standard',
        label: 'Affiliate standard',
        featureKeys: ['ceaseDiscussionsAffiliateStandard', 'representativesStandard'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['ceaseDiscussionsAffiliateStandard', 'representativesStandard'],
          normalizer: 'cease_discussions_affiliate_standard',
        },
      },
      {
        key: 'liability-standard',
        label: 'Liability standard',
        featureKeys: ['ceaseDiscussionsLiability', 'ceaseDiscussionsAffiliateStandard', 'representativesStandard', 'mainConcept'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['ceaseDiscussionsLiability', 'ceaseDiscussionsAffiliateStandard', 'representativesStandard', 'mainConcept'],
          normalizer: 'cease_discussions_liability_standard',
        },
      },
    ],
  },
  'nosol-noshop-exceptions': {
    featureKeys: ['ceaseDiscussionsExceptions', 'permittedExceptions', 'fiduciaryCarveoutThreshold'], kind: 'multi_select', metric: 'no-shop-exceptions',
    subterms: [
      { key: 'cease-discussions-exceptions', label: 'Cease-discussions exceptions', featureKeys: ['ceaseDiscussionsExceptions'], kind: 'multi_select', role: 'exception', missingState: 'absent' },
      { key: 'permitted-exceptions', label: 'Permitted exceptions', featureKeys: ['permittedExceptions'], kind: 'multi_select', role: 'exception' },
      { key: 'fiduciary-carveout-threshold', label: 'Fiduciary carve-out threshold', featureKeys: ['fiduciaryCarveoutThreshold'], kind: 'categorical', role: 'exception' },
    ],
  },
  'nosol-noshop-standstill-enforce': {
    featureKeys: ['dontAskDontWaive', 'standstillWaiverConditions'], kind: 'categorical', metric: 'standstill-enforcement',
  },
  'nosol-fiduciary-engage': {
    featureKeys: ['fiduciaryEngageStandard', 'engagementStandard'], kind: 'categorical', metric: 'engagement-standard',
  },
  'nosol-fiduciary-final': {
    featureKeys: ['fiduciaryFinalStandard', 'changeRecStandard'], kind: 'categorical', metric: 'final-determination-standard',
    subterms: [
      {
        key: 'superior-proposal-test',
        label: 'Final Superior Proposal determination',
        featureKeys: ['fiduciaryFinalStandard'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['fiduciaryFinalStandard'],
          normalizer: 'fiduciary_final_standard',
        },
      },
      {
        key: 'fiduciary-duty-standard',
        label: 'Fiduciary-duty standard',
        featureKeys: ['changeRecStandard'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['changeRecStandard'],
          normalizer: 'fiduciary_duty_change_standard',
        },
      },
    ],
  },
  'nosol-fiduciary-board-change': {
    featureKeys: ['boardChangeForSuperiorProposal', 'boardChangeStandard'], kind: 'categorical', metric: 'board-change-right',
    subterms: [
      { key: 'right', label: 'Board change right', featureKeys: ['boardChangeForSuperiorProposal'], kind: 'categorical' },
      { key: 'standard', label: 'Board-change standard', featureKeys: ['boardChangeStandard'], kind: 'categorical' },
    ],
  },
  'nosol-fiduciary-notice-content': {
    featureKeys: ['noticeContent'], kind: 'presence', metric: 'notice-content',
  },
  'nosol-fiduciary-force-vote': {
    featureKeys: ['forceTheVote', 'forceTheVoteType'], kind: 'categorical', metric: 'force-the-vote',
    subterms: [
      { key: 'required', label: 'Force the vote', featureKeys: ['forceTheVote'], kind: 'categorical' },
      { key: 'type', label: 'Force-the-vote type', featureKeys: ['forceTheVoteType'], kind: 'categorical' },
    ],
  },
  'nosol-fiduciary-termination': {
    featureKeys: ['companyTerminationForSuperior', 'companyTerminationForSuperiorConditions'], kind: 'categorical', metric: 'company-termination-for-superior-proposal',
    subterms: [
      { key: 'right', label: 'Company termination right', featureKeys: ['companyTerminationForSuperior'], kind: 'categorical' },
      { key: 'conditions', label: 'Conditions to termination', featureKeys: ['companyTerminationForSuperiorConditions'], kind: 'multi_select' },
    ],
  },
  'nosol-fiduciary-reps': {
    featureKeys: ['representativesStandard', 'representativeBreachIsCompanyBreach'], kind: 'categorical', metric: 'representative-control-standard',
    subterms: [
      { key: 'standard', label: 'Representatives standard', featureKeys: ['representativesStandard'], kind: 'categorical' },
      { key: 'company-breach', label: 'Representative breach treated as company breach', featureKeys: ['representativeBreachIsCompanyBreach'], kind: 'categorical', missingState: 'absent' },
    ],
  },
  'nosol-fiduciary-buyer-termination': {
    featureKeys: ['parentTerminationRightForNonsolicitBreach'], kind: 'categorical', metric: 'buyer-termination-for-nonsolicit-breach',
  },
  'nosol-fiduciary-change-of-rec-items': {
    featureKeys: ['changeOfRecommendationItems'], kind: 'multi_select', metric: 'change-of-recommendation-actions', label: 'Constitutes a change of recommendation',
  },
  'nosol-fiduciary-not-change-of-rec-items': {
    featureKeys: ['notChangeOfRecommendationItems'], kind: 'multi_select', metric: 'not-change-of-recommendation-actions', label: 'Does not constitute a change of recommendation',
  },
  'nosol-fiduciary-superior-threshold': {
    featureKeys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], kind: 'numeric', metric: 'superior-proposal-threshold', semantics: { unit: 'percent' },
  },
  'nosol-fiduciary-superior-test': {
    featureKeys: ['superiorProposalTest'], kind: 'categorical', metric: 'superior-proposal-test',
  },
  'nosol-fiduciary-fiduciary-standard': {
    featureKeys: ['fiduciaryOutStandard'], kind: 'categorical', metric: 'fiduciary-out-standard',
  },
  'nosol-fiduciary-board-change-standard': {
    featureKeys: ['boardChangeStandard'], kind: 'categorical', metric: 'board-change-standard',
  },
  'nosol-fiduciary-acceptable-confidentiality': {
    featureKeys: ['acceptableConfidentialityAgreementDefinition'], kind: 'presence', metric: 'acceptable-confidentiality-agreement-definition',
  },
  'nosol-noshop-matching-period': {
    featureKeys: ['matchingPeriod'], kind: 'duration', metric: 'superior-proposal-match-period',
    semantics: {
      unit: 'business_days', calendarBasis: 'business', trigger: 'notice_of_superior_proposal', requiredDimensions: ['unit', 'calendarBasis'],
    },
  },
  'nosol-noshop-notice-hours': {
    featureKeys: ['discussionInitiationNoticeHours'], kind: 'duration', metric: 'discussion-initiation-notice',
    semantics: {
      unit: 'elapsed_hours', calendarBasis: 'elapsed', trigger: 'discussion_initiated', requiredDimensions: ['unit', 'calendarBasis'],
    },
  },
  'nosol-noshop-superior-threshold': {
    featureKeys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], kind: 'numeric', metric: 'superior-proposal-threshold', semantics: { unit: 'percent' },
  },
  'nosol-noshop-acquisition-threshold': {
    featureKeys: ['acquisitionTransactionPctThreshold'], kind: 'numeric', metric: 'acquisition-proposal-threshold', semantics: { unit: 'percent' },
  },
  'nosol-noshop-fiduciary-standard': {
    featureKeys: ['fiduciaryOutStandard'], kind: 'categorical', metric: 'fiduciary-out-standard',
  },
  'nosol-noshop-subsequent-match': {
    featureKeys: ['subsequentMatchPeriodDays'], kind: 'duration', metric: 'subsequent-superior-proposal-match-period',
    semantics: {
      unit: 'business_days', calendarBasis: 'business', trigger: 'material_change_to_superior_proposal', requiredDimensions: ['unit', 'calendarBasis'],
    },
  },
  'nosol-noshop-acquisition-definition': {
    featureKeys: ['acquisitionTransactionDefinition'], kind: 'presence', metric: 'acquisition-proposal-definition',
  },
  'nosol-intervening-provision': {
    featureKeys: ['interveningEventProvision', 'boardChangeForInterveningEvent'], kind: 'categorical', metric: 'intervening-event-provision',
  },
  'nosol-intervening-definition': {
    featureKeys: ['interveningEventDefinition', 'definitionText'], kind: 'presence', metric: 'intervening-event-definition', missingState: 'absent',
  },
  'nosol-intervening-scope': {
    featureKeys: ['interveningEventScope'], kind: 'categorical', metric: 'intervening-event-scope',
  },
  'nosol-intervening-exceptions': {
    featureKeys: ['interveningEventExceptions'], kind: 'categorical', metric: 'intervening-event-exceptions',
  },
  'nosol-intervening-termination': {
    featureKeys: ['interveningEventTermination'], kind: 'categorical', metric: 'intervening-event-termination',
  },
  'nosol-intervening-board-change-standard': {
    featureKeys: ['boardChangeStandard'], kind: 'categorical', metric: 'intervening-event-board-change-standard',
  },
  'nosol-superior-threshold': {
    featureKeys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], kind: 'numeric', metric: 'superior-proposal-threshold', semantics: { unit: 'percent' },
  },
  'nosol-superior-test': {
    featureKeys: ['superiorProposalTest'], kind: 'categorical', metric: 'superior-proposal-test',
  },
  'nosol-superior-determiner': {
    featureKeys: ['superiorProposalDeterminer'], kind: 'categorical', metric: 'superior-proposal-determiner',
  },
  'nosol-superior-engage': {
    featureKeys: ['fiduciaryEngageStandard', 'engagementStandard'], kind: 'categorical', metric: 'engagement-standard',
  },
  'nosol-superior-final': {
    featureKeys: ['fiduciaryFinalStandard', 'changeRecStandard'], kind: 'categorical', metric: 'final-determination-standard',
    subterms: [
      {
        key: 'superior-proposal-test',
        label: 'Final Superior Proposal determination',
        featureKeys: ['fiduciaryFinalStandard'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['fiduciaryFinalStandard'],
          normalizer: 'fiduciary_final_standard',
        },
      },
      {
        key: 'fiduciary-duty-standard',
        label: 'Fiduciary-duty standard',
        featureKeys: ['changeRecStandard'],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: ['changeRecStandard'],
          normalizer: 'fiduciary_duty_change_standard',
        },
      },
    ],
  },
  'nosol-superior-fiduciary-standard': {
    featureKeys: ['fiduciaryOutStandard'], kind: 'categorical', metric: 'fiduciary-out-standard',
  },
  'nosol-superior-board-change-standard': {
    featureKeys: ['boardChangeStandard'], kind: 'categorical', metric: 'board-change-standard',
  },
});

const NOSOL_DURATION_ROWS = Object.freeze({
  'nosol-go-shop-period': {
    featureKeys: ['goShopPeriodDays', 'goShopWindow'], metric: 'go-shop-period', trigger: 'signing',
  },
  'nosol-go-shop-extended': {
    featureKeys: ['extendedNegotiatingPeriodDays'], metric: 'go-shop-extended-negotiating-period', trigger: 'go_shop_period_expiry',
  },
  'nosol-fiduciary-notice-period': {
    featureKeys: ['noticePeriod'], metric: 'board-action-notice-period', trigger: 'notice_of_board_action',
  },
  'nosol-fiduciary-initial-match': {
    featureKeys: ['initialMatchPeriodDays', 'matchingPeriod'], metric: 'initial-match-period', trigger: 'initial_notice_of_superior_proposal',
  },
  'nosol-fiduciary-subsequent-match': {
    featureKeys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'], metric: 'subsequent-match-period', trigger: 'material_change_to_superior_proposal',
  },
  'nosol-intervening-notice-period': {
    featureKeys: ['noticePeriod'], metric: 'intervening-event-notice-period', trigger: 'notice_of_intervening_event_board_action',
  },
  'nosol-intervening-matching-period': {
    featureKeys: ['matchingPeriod'], metric: 'intervening-event-match-period', trigger: 'notice_of_intervening_event_board_action',
  },
});

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}

function exactSourceCodes(row) {
  const singular = row?.card || row?.sourceCard || null;
  if (singular) return [cardCode(singular)].filter(Boolean);
  if (Array.isArray(row?.sourceCards) && row.sourceCards.length === 1) return [cardCode(row.sourceCards[0])].filter(Boolean);
  return [];
}

function defaultNosolObservationCodes(id) {
  if (id.startsWith('nosol-intervening-')) return ['NOSOL-INTERVENING'];
  if (id.startsWith('nosol-superior-')) return ['NOSOL-SUPERIOR'];
  if (id.startsWith('nosol-go-shop-')) return ['NOSOL-GOSHOP'];
  if (id === 'nosol-noshop-prohibit') return ['NOSOL-PROHIBIT'];
  if (id === 'nosol-noshop-cease') return ['NOSOL-CEASE', 'NOSOL-CEASE-DISC'];
  if (id === 'nosol-noshop-exceptions') return ['NOSOL-EXCEPT', 'NOSOL-EXCEPTION', 'NOSOL-EXCEPTIONS'];
  if (id === 'nosol-noshop-standstill-enforce') return ['NOSOL-ENFORCE', 'NOSOL-STANDSTILL-WAIVER', 'NOSOL-WAIVER'];
  if (id === 'nosol-noshop-matching-period' || id === 'nosol-noshop-subsequent-match') return ['NOSOL-MATCH', 'NOSOL-REMATCH'];
  if (id === 'nosol-noshop-notice-hours') return ['NOSOL-NOTICE', 'NOSOL-INFORMATION'];
  if (id.startsWith('nosol-noshop-')) return ['NOSOL-ACQPROPOSAL', 'NOSOL-PROHIBIT', 'NOSOL-EXCEPT'];
  if (['nosol-fiduciary-notice-period', 'nosol-fiduciary-initial-match', 'nosol-fiduciary-subsequent-match'].includes(id)) {
    return ['NOSOL-INTERVENING', 'NOSOL-MATCH', 'NOSOL-RECOMMEND', 'NOSOL-NEGOTIATE', 'NOSOL-REMATCH'];
  }
  if (id === 'nosol-fiduciary-notice-content') return ['NOSOL-NOTICE', 'NOSOL-DISCLOSE', 'NOSOL-RECOMMEND'];
  if (id.startsWith('nosol-fiduciary-')) {
    return ['NOSOL-RECOMMEND', 'NOSOL-COR', 'NOSOL-CHANGEREC', 'NOSOL-FIDUCIARY', 'NOSOL-MATCH'];
  }
  return [];
}

function manifestNosolMetrics(row, rowKey, label) {
  const id = String(row?.id || '');
  const rowIdentity = rowKey.replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
  const observationCodes = exactSourceCodes(row);
  const observationScope = {
    provisionCodes: observationCodes.length ? observationCodes : defaultNosolObservationCodes(id),
  };
  const cohort = provisionCodesCohort(observationScope.provisionCodes, {
    eligibility: 'family_present',
    provisionFamily: 'NOSOL',
  });
  const duration = NOSOL_DURATION_ROWS[id];
  if (duration) {
    const metricBase = `nosol.${duration.metric}.${rowIdentity}`;
    return semanticMetricSet({
      rowKey,
      metricBase,
      label,
      cohort,
      prevalenceCohort: ALL_DEALS_COHORT,
      presence: { strategy: 'card_exists', provisionCodes: observationScope.provisionCodes, missingState: 'absent' },
      observationScope,
      subterms: [{
        key: 'timing',
        label: 'Timing',
        featureKeys: duration.featureKeys,
        kind: 'duration',
        value: { strategy: 'feature_value', featureKeys: duration.featureKeys },
        semantics: {
          unit: 'days_equivalent',
          calendarBasis: 'mixed',
          trigger: duration.trigger,
          requiredDimensions: ['unit', 'calendarBasis'],
          normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
        },
      }],
    });
  }
  const feature = NOSOL_FEATURE_ROWS[id];
  if (!feature) return null;
  return semanticMetricSet({
    rowKey,
    metricBase: `nosol.${feature.metric}.${rowIdentity}`,
    label,
    cohort,
    prevalenceCohort: ALL_DEALS_COHORT,
    presence: { strategy: 'card_exists', provisionCodes: observationScope.provisionCodes, missingState: 'absent' },
    observationScope,
    subterms: feature.subterms || [{
      key: 'value',
      label: feature.label || label,
      featureKeys: feature.featureKeys,
      kind: feature.kind,
      semantics: feature.semantics,
      missingState: feature.missingState,
    }],
  });
}

function manifestMaterialContractMetrics(row, rowKey, label) {
  if (!String(row?.id || '').startsWith('material-contracts-')) return null;
  const itemCode = String(row?.code || '').trim().toUpperCase();
  if (!itemCode) {
    return [nonComparableMetric({
      rowKey,
      metricKey: `${rowKey}.value`,
      label,
      code: 'missing_canonical_identity',
      detail: 'This material-contract row has no canonical bucket code.',
    })];
  }
  const cadenceText = `${row?.threshold || ''} ${row?.evidence || ''}`;
  let cadence = 'aggregate';
  if (/\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(cadenceText)) cadence = 'annual';
  else if (/\bin\s+(?:19|20)\d{2}\b/i.test(cadenceText)) cadence = 'specified_year';
  else if (/\b(?:per\s+month|monthly)\b/i.test(cadenceText)) cadence = 'per_month';
  else if (/\b(?:per\s+day|daily)\b/i.test(cadenceText)) cadence = 'per_day';
  else if (/\b(?:per|each)\s+(?:event|occurrence)\b/i.test(cadenceText)) cadence = 'per_event';
  const rowVariant = String(rowKey).split(':').slice(3).join(':')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const metricBase = `material-contracts.bucket.${itemCode.toLowerCase()}.${cadence.replace(/_/g, '-')}${rowVariant ? `.${rowVariant}` : ''}`;
  const cohort = provisionCodesCohort(['REP-T-MATERIAL-CONTRACTS']);
  const presence = {
    strategy: 'list_item',
    featureKeys: ['materialContractsBuckets'],
    itemCode,
    missingState: 'absent',
  };
  const metrics = featureMetricSet({
    rowKey,
    metricBase,
    label,
    featureKeys: ['materialContractsBuckets'],
    kind: 'presence',
    cohort,
    presence,
  });
  metrics.push(comparableMetric({
    rowKey,
    metricKey: `${metricBase}.threshold-structure`,
    label: 'Threshold structure',
    kind: 'categorical',
    cohort,
    observation: {
      presence,
      value: {
        strategy: 'list_item_field',
        featureKeys: ['materialContractsBuckets'],
        itemCode,
        itemCadence: cadence,
        path: 'threshold',
        normalizer: 'material_contract_threshold_type',
      },
    },
    denominator: marketDenominator(`${metricBase}.presence`),
    presentation: { role: 'treatment' },
  }));
  if (!/\$\s*\d/i.test(String(row?.threshold || ''))) return metrics;
  metrics.push(comparableMetric({
    rowKey,
    metricKey: `${metricBase}.threshold`,
    label: `${label} threshold`,
    kind: 'money',
    cohort,
    observation: {
      presence,
      value: {
        strategy: 'list_item_field',
        featureKeys: ['materialContractsBuckets'],
        itemCode,
        itemCadence: cadence,
        path: 'threshold',
      },
    },
    denominator: marketDenominator(`${metricBase}.presence`),
    semantics: {
      unit: 'usd',
      cadence,
      requiredDimensions: ['cadence'],
      stratifyDimensions: ['cadence'],
      normalisation: DEAL_VALUE_NORMALISATION,
    },
  }));
  return metrics;
}

function manifestAffirmativeIocMetrics(row, rowKey, label) {
  if (!String(row?.id || '').startsWith('ioc-aff-')) return null;
  const cohort = ALL_DEALS_COHORT;
  const rowIdentity = rowKey.replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').toLowerCase() || 'limb';
  const metricBase = `ioc.affirmative-obligations.${rowIdentity}`;
  const featureKeys = ['positiveObligations'];
  const itemIdentity = affirmativeObligationIdentity(row?.evidence || label);
  if (!itemIdentity) return null;
  const presenceObservation = {
    strategy: 'list_item',
    featureKeys,
    itemIdentity,
    identityKind: 'affirmative_ioc_obligation',
    missingState: 'absent',
  };
  const [presence] = featureMetricSet({
    rowKey,
    metricBase,
    label: 'Affirmative interim operating covenants',
    featureKeys,
    kind: 'presence',
    cohort,
    presence: presenceObservation,
  });
  return [
    presence,
    conditionalFeatureMetric({
      rowKey,
      metricKey: `${metricBase}.scope`,
      label: `${label} scope`,
      kind: 'multi_select',
      cohort,
      featureKeys,
      value: {
        strategy: 'list_item_field', featureKeys, path: 'appliesTo', itemIdentity, identityKind: 'affirmative_ioc_obligation',
      },
      conditionalMetricKey: `${metricBase}.presence`,
      presence: presenceObservation,
    }),
    conditionalFeatureMetric({
      rowKey,
      metricKey: `${metricBase}.efforts-standard`,
      label: `${label} efforts standard`,
      kind: 'multi_select',
      cohort,
      featureKeys,
      value: {
        strategy: 'list_item_field', featureKeys, path: 'efforts_standard', itemIdentity, identityKind: 'affirmative_ioc_obligation',
      },
      conditionalMetricKey: `${metricBase}.presence`,
      presence: presenceObservation,
    }),
  ];
}

function manifestIocExceptionMetrics(row, rowKey, label) {
  const id = String(row?.id || '');
  if (!['ioc-exceptions-shared', 'ioc-exceptions-affirmative', 'ioc-exceptions-negative'].includes(id)) return null;
  const suffix = id.replace('ioc-exceptions-', '');
  const rowIdentity = rowKey.replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
  const metricBase = `ioc.exceptions.${suffix}.${rowIdentity}`;
  const parentMetricKey = `${metricBase}.parent-presence`;
  const cohort = provisionFamilyCohort('IOC');
  const parentPresence = id === 'ioc-exceptions-affirmative'
    ? { strategy: 'feature_non_empty', featureKeys: ['positiveObligations'], missingState: 'unknown' }
    : { strategy: 'card_exists', provisionFamily: 'IOC', missingState: 'unknown' };
  const exceptionCodes = id === 'ioc-exceptions-affirmative'
    ? ['IOC-GENERAL-EXCEPTIONS', 'IOC-EXCEPTIONS', 'IOC-POSITIVE-PREAMBLE']
    : (id === 'ioc-exceptions-negative'
      ? ['IOC-NEGATIVE-PREAMBLE']
      : ['IOC-GENERAL-EXCEPTIONS', 'IOC-EXCEPTIONS', 'IOC-POSITIVE-PREAMBLE', 'IOC-NEGATIVE-PREAMBLE']);
  const ownMetrics = featureMetricSet({
    rowKey,
    metricBase,
    label,
    featureKeys: ['permittedExceptions'],
    kind: 'multi_select',
    cohort,
    observationScope: { provisionCodes: exceptionCodes },
  });
  ownMetrics[1] = { ...ownMetrics[1], denominator: marketDenominator(parentMetricKey) };
  return [
    comparableMetric({
      rowKey,
      metricKey: parentMetricKey,
      label: id === 'ioc-exceptions-affirmative' ? 'Affirmative IOC parent population' : 'IOC parent population',
      kind: 'presence',
      cohort,
      observation: { presence: parentPresence },
      denominator: marketDenominator(),
    }),
    ...ownMetrics,
  ];
}

function manifestIocNegativeMetrics(row, rowKey, label) {
  const id = String(row?.id || '');
  if (!id.startsWith('ioc-neg-')) return null;
  const codeFromId = id.toUpperCase().match(/(IOC-[A-Z0-9-]+)$/)?.[1];
  const code = String(row?.code || codeFromId || '').toUpperCase();
  if (!code) return null;
  const rowIdentity = rowKey.replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
  const metricBase = `ioc.negative.${code.toLowerCase()}.${rowIdentity}`;
  const presenceKey = `${metricBase}.presence`;
  const cohort = ALL_DEALS_COHORT;
  const observationScope = { provisionCodes: [code] };
  return [comparableMetric({
    rowKey,
    metricKey: presenceKey,
    label: `${label} prevalence`,
    kind: 'presence',
    cohort,
    observation: {
      scope: observationScope,
      presence: { strategy: 'card_exists', provisionCodes: [code], missingState: 'absent' },
    },
    denominator: marketDenominator(),
  }),
  conditionalFeatureMetric({
    rowKey,
    metricKey: `${metricBase}.specific-restrictions`,
    label: `${label} specific restrictions`,
    kind: 'multi_select',
    cohort,
    featureKeys: ['restrictionComponents'],
    value: { strategy: 'feature_value', featureKeys: ['restrictionComponents'] },
    conditionalMetricKey: presenceKey,
    observationScope,
    missingState: 'absent',
  }),
  conditionalFeatureMetric({
    rowKey,
    metricKey: `${metricBase}.permitted-exceptions`,
    label: `${label} permitted exceptions`,
    kind: 'multi_select',
    cohort,
    featureKeys: ['permittedExceptions'],
    value: { strategy: 'feature_value', featureKeys: ['permittedExceptions'] },
    conditionalMetricKey: presenceKey,
    observationScope,
    missingState: 'absent',
  }),
  conditionalFeatureMetric({
    rowKey,
    metricKey: `${metricBase}.dollar-threshold`,
    label: `${label} dollar threshold`,
    kind: 'money',
    cohort,
    featureKeys: ['dollarThreshold', 'permittedExceptions'],
    presence: {
      strategy: 'optional_money',
      featureKeys: ['dollarThreshold', 'permittedExceptions'],
      missingState: 'absent',
    },
    value: {
      strategy: 'feature_value',
      featureKeys: ['dollarThreshold', 'permittedExceptions'],
      normalizer: 'ioc_dollar_threshold',
    },
    conditionalMetricKey: presenceKey,
    observationScope,
    semantics: {
      unit: 'usd',
      stratifyDimensions: ['cadence'],
      normalisation: DEAL_VALUE_NORMALISATION,
    },
  })];
}

const TAIL_FEE_ROWS = Object.freeze({
  'tail-window': {
    featureKeys: ['tailFeeWindowMonths'], kind: 'duration', metric: 'window',
    semantics: { unit: 'months', calendarBasis: 'elapsed', trigger: 'qualifying_termination', requiredDimensions: ['unit'] },
  },
  'tail-threshold': {
    featureKeys: ['tailFeeThresholdPct'], kind: 'numeric', metric: 'transaction-threshold', semantics: { unit: 'percent' },
  },
  'tail-arming': {
    featureKeys: ['tailFeeActivatingClauses'], kind: 'multi_select', metric: 'activating-clauses',
  },
  'tail-trigger-scope': {
    featureKeys: ['tailFeeRecognitionEvent'], kind: 'categorical', metric: 'recognition-event',
  },
});

function manifestTailFeeMetrics(row, rowKey, label) {
  const entry = TAIL_FEE_ROWS[row?.id];
  if (!entry) return null;
  return featureMetricSet({
    rowKey,
    metricBase: `termination.tail-fee.${entry.metric}`,
    label,
    featureKeys: entry.featureKeys,
    kind: entry.kind,
    cohort: provisionCodesCohort(['TERMF-TAIL']),
    semantics: entry.semantics,
  });
}

const TERMINATION_FEE_ROWS = Object.freeze({
  'termination-fees-COMPANY_TERMINATION_FEE': {
    featureKeys: ['companyTerminationFee', 'feeAmount'], codes: ['TERMF-TARGET'], metric: 'company',
  },
  'termination-fees-REVERSE_TERMINATION_FEE': {
    featureKeys: ['reverseTerminationFee', 'reverseFeeAmount'], codes: ['TERMF-REVERSE'], metric: 'reverse',
  },
  'termination-fees-EXPENSE_REIMBURSEMENT': {
    featureKeys: ['expenseReimbursementCap', 'expenseReimbursement'], codes: ['TERMF-EXPENSE', 'TERMF-REIMBURSE'], metric: 'expense-reimbursement',
  },
});

function manifestTerminationFeeMetrics(row, rowKey, label) {
  const entry = TERMINATION_FEE_ROWS[row?.id];
  if (!entry) return null;
  return featureMetricSet({
    rowKey,
    metricBase: `termination.fee.${entry.metric}`,
    label,
    featureKeys: entry.featureKeys,
    kind: 'money',
    cohort: provisionCodesCohort(entry.codes),
    presence: { strategy: 'card_exists', provisionCodes: entry.codes, missingState: 'absent' },
    semantics: {
      unit: 'usd',
      cadence: 'one_time',
      normalisation: DEAL_VALUE_NORMALISATION,
    },
  });
}

export function manifestDefinitionMetrics(row, rowKey, label) {
  const term = String(row?.defined_term || row?.definedTerm || '').trim();
  if (!term) return null;
  const metricIdentity = String(rowKey || `definitions:${term}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return [comparableMetric({
    rowKey,
    metricKey: `${metricIdentity}.presence`,
    label: `${label} prevalence`,
    kind: 'presence',
    cohort: ALL_DEALS_COHORT,
    observation: {
      presence: { strategy: 'definition_term', term, missingState: 'absent' },
    },
    denominator: marketDenominator(),
    presentation: { role: 'prevalence' },
  })];
}

export function manifestMetricsForRow(row, { rowKey, label } = {}) {
  if (!row || !rowKey || !label) return null;
  return manifestDefinitionMetrics(row, rowKey, label)
    || manifestMaterialContractMetrics(row, rowKey, label)
    || manifestAffirmativeIocMetrics(row, rowKey, label)
    || manifestIocExceptionMetrics(row, rowKey, label)
    || manifestIocNegativeMetrics(row, rowKey, label)
    || manifestNosolMetrics(row, rowKey, label)
    || manifestTailFeeMetrics(row, rowKey, label)
    || manifestTerminationFeeMetrics(row, rowKey, label)
    || null;
}
