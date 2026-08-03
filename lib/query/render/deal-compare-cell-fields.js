const KEY_FIELDS = {
  CONSIDERATION: ['considerationType', 'perShareAmount', 'exchangeRatio', 'appraisalRightsAvailable'],
  REPRESENTATION: ['materialityQualifier', 'knowledgeQualifier', 'bringDownStandard', 'materialityScrape', 'guarantyFact'],
  CLOSING_CONDITION: [
    'mainCondition',
    'stockholderApprovalRequired',
    'approvalDefinition',
    'absenceOfEnjoiningOrderPresent',
    'absenceOfEnjoiningOrderDetails',
    'governmentProceedingConditionPresent',
    'certificationRequired',
    'fundsCondition',
    'dollarThreshold',
    'burdensomeConditionPresent',
    'burdensomeConditionScope',
  ],
  COVENANT_INTERIM_OPERATING: ['iocRestrictionPresent', 'consentStandard', 'ordinaryCourseCarveout', 'dollarThreshold', 'leadInPeriodDays'],
  COVENANT_NO_SOLICITATION: ['goShopPresent', 'initialMatchPeriodDays', 'subsequentMatchPeriodDays', 'boardChangeForSuperiorProposal'],
  TERMINATION_RIGHT: ['partyWhoCanTerminate', 'terminationTriggers', 'outsideDate', 'curePeriod'],
  // The extracted percentage is sparse. Derive it from the dollar fee and
  // deal value so the comparison row is populated when both are known.
  TERMINATION_FEE: ['feePctOfDealValue', 'feeAmount', 'reverseFeeAmount', 'reverseFeePctOfDealValue', 'tailFeeWindowMonths'],
  ANTITRUST_REGULATORY: [
    'antitrustEffortsStandard',
    'burdenCommitment',
    'divestitureCap',
    'litigationObligation',
    'hsrFilingDeadlineBusinessDays',
    'foreignFilingsRequired',
    'otherRegulatoryFilingDeadlines',
    'regulatoryStrategyControlTagged',
    'consultationTier',
    'pullRefile',
    'timingAgreement',
    'clearSkiesParent',
    'clearSkiesCompany',
    'reverseTerminationFee',
  ],
  SEC_FILING_MEETING: [
    'proxyFilingDeadline',
    'meetingDeadline',
    'meetingAdjournmentMaxCount',
    'meetingAdjournmentMaxDays',
    'boardRecommendationInclusion',
    'meetingConveneObligation',
  ],
  COVENANT_OTHER: [
    'financingCovenantFact',
    'guarantyFact',
    'compensationItems',
    'protectionPeriodMonths',
    'continuedService',
    'eligibilityWaiver',
    'indemnificationPeriod',
    'insuranceCap',
    'advancementOfExpenses',
    'mainConcept',
  ],
  DEFINITION: ['financingCovenantFact', 'definedTermFact', 'maeDefinitionFact', 'mainConcept'],
};

function fieldsForCompareCell(provisionType, includedGroups) {
  const groups = Array.isArray(includedGroups) && includedGroups.length ? includedGroups : ['primary', 'qualifiers'];
  const keys = KEY_FIELDS[provisionType] || ['mainConcept'];
  if (groups.includes('all')) return keys;
  return keys.slice(0, groups.includes('mechanics') ? 4 : 3);
}

module.exports = { fieldsForCompareCell };
