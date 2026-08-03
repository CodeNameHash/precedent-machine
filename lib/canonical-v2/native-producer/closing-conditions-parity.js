'use strict';

const SURFACE_PATHS = Object.freeze({
  render: 'components/review/table-configs/conditions.config.js',
  query: 'lib/query/serving-registry-v1.json',
  compare: 'lib/canonical-conditions.js',
  market: 'components/review/table-configs/conditions.config.js',
});

const CLOSING_CONDITION_SURFACE_OWNERSHIP = Object.freeze([
  ['STOCKHOLDER_APPROVAL_CONDITION', 'stockholderApprovalRequired'],
  ['STOCKHOLDER_APPROVAL_CONDITION', 'approvalDefinition'],
  ['LEGAL_RESTRAINT_CONDITION', 'absenceOfEnjoiningOrderPresent'],
  ['LEGAL_RESTRAINT_CONDITION', 'absenceOfEnjoiningOrderDetails'],
  ['GOVERNMENT_PROCEEDING_CONDITION', 'governmentProceedingConditionPresent'],
  ['S4_CONDITION_COMPONENT', 'mainCondition'],
  ['LISTING_CONDITION', 'mainCondition'],
  ['FUNDS_AVAILABILITY_CONDITION', 'fundsCondition'],
  ['OFFICER_CERTIFICATE_REQUIRED', 'certificationRequired'],
  ['CONDITION_DOLLAR_THRESHOLD', 'dollarThreshold'],
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
    item: 'CERTIFICATE_TARGET_RELATIONSHIP',
    reason: 'RELATIONSHIP_RESOLUTION_REQUIRED',
    v1_feature_key: 'citedProvisionNames',
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
