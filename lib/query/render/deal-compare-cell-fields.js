const KEY_FIELDS = {
  CONSIDERATION: ['considerationType', 'perShareAmount', 'exchangeRatio', 'appraisalRightsAvailable'],
  REPRESENTATION: ['materialityQualifier', 'knowledgeQualifier', 'bringDownStandard', 'materialityScrape'],
  CLOSING_CONDITION: ['mainCondition', 'materialityScrapePresent'],
  COVENANT_INTERIM_OPERATING: ['consentStandard', 'ordinaryCourseCarveout', 'dollarThreshold', 'leadInPeriodDays'],
  COVENANT_NO_SOLICITATION: ['goShopPresent', 'initialMatchPeriodDays', 'subsequentMatchPeriodDays', 'boardChangeForSuperiorProposal'],
  TERMINATION_RIGHT: ['partyWhoCanTerminate', 'terminationTriggers', 'extensionMutualOrUnilateral', 'extensionMaxExercises'],
  // The extracted percentage is sparse. Derive it from the dollar fee and
  // deal value so the comparison row is populated when both are known.
  TERMINATION_FEE: ['feePctOfDealValue', 'feeAmount', 'reverseFeePercentage', 'tailFeeWindowMonths'],
  ANTITRUST_REGULATORY: ['effortsStandard', 'hellOrHighWater', 'reverseTerminationFee'],
  DEFINITION: ['mainConcept'],
};

function fieldsForCompareCell(provisionType, includedGroups) {
  const groups = Array.isArray(includedGroups) && includedGroups.length ? includedGroups : ['primary', 'qualifiers'];
  const keys = KEY_FIELDS[provisionType] || ['mainConcept'];
  if (groups.includes('all')) return keys;
  return keys.slice(0, groups.includes('mechanics') ? 4 : 3);
}

module.exports = { fieldsForCompareCell };
