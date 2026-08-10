'use strict';

const PREVIEW_SCHEMA = 'CANONICAL_V2_RENDERED_ROW_PREVIEW/V1';
const SECTION_PREVIEW_SCHEMA = 'CANONICAL_V2_RENDERED_SECTION_PREVIEW/V1';

const FAMILY_ROUTES = Object.freeze({
  CLOSING_CONDITIONS: Object.freeze({
    configId: 'conditions',
    projectionModule: 'lib/canonical-v2/closing-conditions-product-projection.js',
    projectionExport: 'projectClosingConditionProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  TERMINATION: Object.freeze({
    configId: 'termination-rights',
    projectionModule: 'lib/canonical-v2/termination-product-projection.js',
    projectionExport: 'projectTerminationRightsProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
    claimRouteByConceptKey: Object.freeze({
      'TERMR-SUPERIOR': Object.freeze({ configId: 'nosol' }),
    }),
  }),
  MATERIAL_CONTRACTS: Object.freeze({
    configId: 'material-contracts',
    projectionModule: 'lib/canonical-v2/material-contracts-product-projection.js',
    projectionExport: 'projectMaterialContractsProductSurfaces',
    rowMatch: 'BUCKET_CODE',
  }),
  ANTITRUST_REGULATORY: Object.freeze({
    configId: 'antitrust-regulatory',
    projectionModule: 'lib/canonical-v2/antitrust-product-projection.js',
    projectionExport: 'projectAntitrustProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: Object.freeze({
      REGULATORY_EFFORTS_STANDARD: 'antitrustEffortsStandard',
      REGULATORY_BURDEN_COMMITMENT: 'burdenCommitment',
      REGULATORY_DIVESTITURE_CAP_AMOUNT: 'divestitureCapAmount',
      REGULATORY_LITIGATION_OBLIGATION: 'litigationObligation',
      REGULATORY_TIMING_AGREEMENT_RESTRICTION: 'timingAgreement',
      REGULATORY_WITHDRAWAL_REFILING_RESTRICTION: 'pullRefile',
      HSR_FILING_DEADLINE_DAYS: 'hsrFilingDeadlineDays',
      REGULATORY_FILING_OBLIGATION: Object.freeze(['regulatoryFilingFacts', 'hsrFilingRequired']),
      REGULATORY_FILING_DEADLINE_DAYS: 'regulatoryFilingFacts',
      REGULATORY_STRATEGY_CONTROL: 'regulatoryStrategyControlTagged',
      REGULATORY_CONSULTATION_RIGHT: 'consultationTier',
      REGULATORY_NON_IMPEDIMENT_COVENANT: 'regulatoryNonImpedimentRequired',
      REGULATORY_COOPERATION_OBLIGATION: 'regulatoryCooperationRequired',
      REGULATORY_INFORMATION_SHARING_OBLIGATION: 'regulatoryInformationSharingRequired',
      REGULATORY_NOTIFICATION_OBLIGATION: 'regulatoryNotificationRequired',
      REGULATORY_FILING_TIMING_STANDARD: 'regulatoryFilingTimingStandard',
    }),
  }),
  PROXY_MEETING: Object.freeze({
    configId: 'votes-approvals-meeting',
    projectionModule: 'lib/canonical-v2/proxy-meeting-product-projection.js',
    projectionExport: 'projectProxyMeetingProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: Object.freeze({
      BOARD_RECOMMENDATION_INCLUSION: 'boardRecommendationInclusion',
      BROKER_SEARCH_OBLIGATION_PRESENT: 'brokerSearchObligation',
      MEETING_ADJOURNMENT_REASON: 'adjournmentRights',
      MEETING_CONVENE_OBLIGATION: 'meetingConveneObligation',
      MEETING_DEADLINE_DAYS: 'meetingDeadline',
      PROXY_FILING_DEADLINE_DAYS: 'proxyFilingDeadline',
      RECORD_DATE_ESTABLISHMENT_PRESENT: 'meetingRecordDate',
    }),
  }),
  GENERAL_COVENANTS: Object.freeze({
    configId: 'general-covenants',
    projectionModule: 'lib/canonical-v2/general-covenants-product-projection.js',
    projectionExport: 'projectGeneralCovenantsProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  EMPLOYEE_MATTERS: Object.freeze({
    configId: 'employee-benefits',
    projectionModule: 'lib/canonical-v2/employee-dno-product-projection.js',
    projectionExport: 'projectEmployeeDnoProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: Object.freeze({
      BENEFITS_CONTINUATION_PERIOD_MONTHS: 'protectionPeriodMonths',
      EMPLOYEE_COMP_ITEM_STANDARD: 'compensationItems',
      EMPLOYEE_MATTERS_TPB_DISCLAIMER: 'employeeMattersThirdPartyBeneficiaryDisclaimer',
      EMPLOYEE_SERVICE_CREDIT: 'continuedService',
      WELFARE_PLAN_TRANSITION_RELIEF: Object.freeze([
        'eligibilityWaiver',
        'welfarePlanExpenseCredit',
      ]),
    }),
  }),
  DNO_INDEMNIFICATION: Object.freeze({
    configId: 'general-covenants',
    projectionModule: 'lib/canonical-v2/employee-dno-product-projection.js',
    projectionExport: 'projectEmployeeDnoProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  SPECIFIC_PERFORMANCE_REMEDIES: Object.freeze({
    configId: 'misc-boilerplate',
    projectionModule: 'lib/canonical-v2/remedies-misc-product-projection.js',
    projectionExport: 'projectRemediesMiscProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  MISC_BOILERPLATE: Object.freeze({
    configId: 'misc-boilerplate',
    projectionModule: 'lib/canonical-v2/remedies-misc-product-projection.js',
    projectionExport: 'projectRemediesMiscProductSurfaces',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  TERMINATION_FEE: Object.freeze({
    configId: 'termination-fees',
    projectionModule: 'lib/canonical-v2/termination-product-projection.js',
    projectionExport: 'projectTerminationFeeProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
    claimRouteByClaimDefinition: Object.freeze({
      SOLE_REMEDY_LEGAL_EFFECT_PRESENT: Object.freeze({
        configId: 'misc-boilerplate',
        projectionModule: 'lib/canonical-v2/remedies-misc-product-projection.js',
        projectionExport: 'projectRemediesMiscProductSurfaces',
      }),
      SOLE_REMEDY_CARVEOUT_KIND: Object.freeze({
        configId: 'misc-boilerplate',
        projectionModule: 'lib/canonical-v2/remedies-misc-product-projection.js',
        projectionExport: 'projectRemediesMiscProductSurfaces',
      }),
    }),
  }),
  CONSIDERATION: Object.freeze({
    configId: 'consideration-hero',
    projectionModule: 'lib/canonical-v2/consideration-wave-a-product-projection.js',
    projectionExport: 'projectConsiderationWaveAClaims',
    projectionArgs: 'RESOLVED_ENTRIES',
    projectionScope: 'CLAIM',
    rowMatch: 'SOURCE_CARD',
    validateFeatureLineage: true,
    featureKeyByClaimDefinition: Object.freeze({
      PER_SHARE_CASH_CONSIDERATION: 'perShareAmount',
      EXCHANGE_RATIO_VALUE: 'exchangeRatio',
      APPRAISAL_RIGHTS_STATUS: 'appraisalRightsAvailable',
    }),
  }),
  INTERIM_OPERATING: Object.freeze({
    configIdByPartyCapacity: Object.freeze({
      TARGET: 'ioc-exceptions',
      BUYER: 'parent-ioc-exceptions',
    }),
    projectionModule: 'lib/canonical-v2/ioc-wave-a-product-projection.js',
    projectionExport: 'projectIocWaveAClaims',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  MAE_DEFINITION: Object.freeze({
    configId: 'mae-definitions',
    projectionModule: 'lib/canonical-v2/key-terms-mae-product-projection.js',
    projectionExport: 'projectKeyTermsMaeClaims',
    projectionArgs: 'RESOLVED_ENTRIES',
    cardArrayKey: 'mae_review_cards',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: Object.freeze({
      MAE_DEFINITION_PRONG: 'maeDefinitionProngs',
      MAE_CARVEOUT: 'carveouts',
      MAE_DISPROPORTIONALITY_CARVEBACK: 'maeDisproportionalityRelationships',
    }),
  }),
  NO_SHOP: Object.freeze({
    configId: 'nosol',
    projectionModule: 'lib/canonical-v2/no-shop-product-projection.js',
    projectionExport: 'projectNoShopProductSurfaces',
    projectionScope: 'CLAIM',
    rowMatch: 'SINGLE_SCOPED_ROW',
  }),
  MERGER_STRUCTURE_CLOSING: Object.freeze({
    configId: 'structure-mechanics',
    projectionModule: 'lib/canonical-v2/merger-structure-closing-product-projection.js',
    projectionExport: 'projectMergerStructureClosingProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: Object.freeze({
      MERGER_TRANSACTION_STEP: 'transactionSteps',
    }),
    featureKeyByAssertionKind: Object.freeze({
      ACTIONS: 'closingActions',
      BOARD_DESIGNATION: 'buyerBoardDesignation',
      CLOSING_LOCATION: 'closingLocation',
      CLOSING_TIMING: 'closingTiming',
      DIRECTORS: 'directorsAtEffectiveTime',
      EFFECTIVE_TIME: 'clause',
      EFFECTS: 'effectsOfMergerReference',
      SHORT_FORM_251H: 'section251h',
    }),
    reviewDealArrayFeature: Object.freeze({
      field: 'transactionSteps',
      feature: 'transactionSteps',
    }),
  }),
  NO_OTHER_REPS_FRAUD: Object.freeze({
    configId: 'no-other-reps-fraud',
    projectionModule: 'lib/canonical-v2/no-other-reps-fraud-review-projection.js',
    projectionExport: 'projectNoOtherRepsFraudReviewSurfaces',
    rowMatch: 'SOURCE_CARD',
    validateFeatureLineage: true,
    featureKeyByClaimDefinition: Object.freeze({
      NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT: 'noOtherRepsFraudFact',
      NON_RELIANCE_ACKNOWLEDGMENT_PRESENT: 'noOtherRepsFraudFact',
      EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT: 'noOtherRepsFraudFact',
    }),
    reviewDealExtra: Object.freeze({ canonical_v2_preview_enabled: true }),
  }),
  // NOT ROUTED, measured 2026-08-10, in three distinct states — the distinction
  // matters because only the third needs new architecture:
  //
  // (a) RECORDS-SHAPED PROJECTION, BUT NO REVIEW V2 CARDS OR APPROVED OWNER:
  //     KEY_DEFINED_TERMS (76). `projectKeyTermsMaeClaims` emits governed
  //     records for this family. Its `mae_review_cards` output belongs only to
  //     MAE_DEFINITION and is empty for a Key Defined Terms-only input.
  //
});

module.exports = { FAMILY_ROUTES, PREVIEW_SCHEMA, SECTION_PREVIEW_SCHEMA };
