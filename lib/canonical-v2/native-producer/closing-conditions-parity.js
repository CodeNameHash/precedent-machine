'use strict';

const SURFACE_PATHS = Object.freeze({
  render: 'components/review/table-configs/conditions.config.js',
  query: 'lib/query/serving-registry-v1.json',
  compare: 'lib/query/executors/deal-compare.js',
  market: 'components/review/table-configs/conditions.config.js',
});

const CLOSING_CONDITION_SURFACE_OWNERSHIP = Object.freeze([
  ['STOCKHOLDER_APPROVAL_CONDITION', 'stockholderApprovalRequired'],
  ['STOCKHOLDER_APPROVAL_CONDITION', 'approvalDefinition'],
  ['LEGAL_RESTRAINT_CONDITION', 'absenceOfEnjoiningOrderPresent'],
  ['LEGAL_RESTRAINT_CONDITION', 'absenceOfEnjoiningOrderDetails'],
  ['GOVERNMENT_PROCEEDING_CONDITION', 'governmentProceedingConditionPresent'],
  ['S4_CONDITION_COMPONENT', 's4ConditionComponents'],
  ['LISTING_CONDITION', 'listingConditionPresent'],
  ['LISTING_CONDITION', 'listingVenue'],
  ['FUNDS_AVAILABILITY_CONDITION', 'fundsCondition'],
  ['OFFICER_CERTIFICATE_REQUIRED', 'certificationRequired'],
  ['OFFICER_CERTIFICATE_REQUIRED', 'certificateSide'],
  ['OFFICER_CERTIFICATE_REQUIRED', 'certifiedConditionRefs'],
  ['OFFICER_CERTIFICATE_REQUIRED', 'certificateRelationshipStatus'],
  ['FRUSTRATION_CAUSATION_STANDARD', 'frustrationCausationStandard'],
  ['FRUSTRATION_BREACH_STANDARD', 'frustrationBreachStandard'],
  ['CONDITION_DOLLAR_THRESHOLD', 'dollarThreshold'],
  ['CONDITION_DOLLAR_THRESHOLD', 'conditionThresholdRole'],
  ['BURDENSOME_CONDITION', 'burdensomeConditionPresent'],
  ['BURDENSOME_CONDITION', 'burdensomeConditionScope'],
].map(([claimDefinitionKey, v1FeatureKey]) => Object.freeze({
  claim_definition_key: claimDefinitionKey,
  v1_feature_key: v1FeatureKey,
  surfaces: SURFACE_PATHS,
})));

const OPEN_WORLD_SURFACE_GAPS = Object.freeze([
  Object.freeze({
    item: 'DISSENT_THRESHOLD',
    reason: 'NO_GROUNDED_CORPUS_QUOTE',
    v1_feature_key: 'dissentingSharesThreshold',
  }),
  Object.freeze({
    item: 'CONDITION_CURE_PERIOD',
    reason: 'NO_BOUNDED_WAVE_B_SHAPE',
    v1_feature_key: 'cureDays',
  }),
  Object.freeze({
    item: 'CONDITION_SCHEDULE_REFERENCE',
    reason: 'RELATIONSHIP_RESOLUTION_REQUIRED',
    v1_feature_key: 'scheduleReference',
  }),
]);

module.exports = {
  CLOSING_CONDITION_SURFACE_OWNERSHIP,
  OPEN_WORLD_SURFACE_GAPS,
  SURFACE_PATHS,
};
