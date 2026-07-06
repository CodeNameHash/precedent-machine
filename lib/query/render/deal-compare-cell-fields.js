const KEY_FIELDS = {
  CONSIDERATION: ['considerationType', 'perShareAmount', 'exchangeRatio', 'appraisalRightsAvailable'],
  REPRESENTATION: ['materialityQualifier', 'knowledgeQualifier', 'bringDownStandard', 'materialityScrape'],
  CLOSING_CONDITION: ['mainCondition', 'materialityScrapePresent'],
  COVENANT_INTERIM_OPERATING: ['consentStandard', 'ordinaryCourseCarveout', 'dollarThreshold', 'leadInPeriodDays'],
  COVENANT_NO_SOLICITATION: ['goShopPresent', 'initialMatchPeriodDays', 'subsequentMatchPeriodDays', 'boardChangeForSuperiorProposal'],
  TERMINATION_RIGHT: ['partyWhoCanTerminate', 'terminationTriggers', 'extensionMutualOrUnilateral', 'extensionMaxExercises'],
  TERMINATION_FEE: ['terminationFeePercentEquityValue', 'feeAmount', 'reverseFeePercentage', 'tailFeeWindowMonths'],
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
