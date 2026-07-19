const KEY_FIELDS = {
  CONSIDERATION: ['considerationType', 'perShareAmount', 'exchangeRatio', 'appraisalRightsAvailable'],
  REPRESENTATION: ['materialityQualifier', 'knowledgeQualifier', 'bringDownStandard', 'materialityScrape'],
  CLOSING_CONDITION: ['mainCondition', 'materialityScrapePresent'],
  COVENANT_INTERIM_OPERATING: ['consentStandard', 'ordinaryCourseCarveout', 'dollarThreshold', 'leadInPeriodDays'],
  COVENANT_NO_SOLICITATION: ['goShopPresent', 'initialMatchPeriodDays', 'subsequentMatchPeriodDays', 'boardChangeForSuperiorProposal'],
  TERMINATION_RIGHT: ['partyWhoCanTerminate', 'terminationTriggers', 'extensionMutualOrUnilateral', 'extensionMaxExercises'],
  // B3 (2026-07-19 pre-demo audit): 'terminationFeePercentEquityValue' is
  // the raw-extracted pct field — rarely populated (most agreements state a
  // dollar fee, not a pct-of-equity figure), so this row rendered empty for
  // almost every deal. 'feePctOfDealValue' is the query-time derived field
  // (lib/query/derived-fields.js: companyTerminationFee.amount /
  // deals.value_usd) already used by the deals-index Termination fee column
  // (lib/home-data.js computeDealSignals) — same derivation, same data, but
  // actually populated whenever a dollar fee + deal value are both known.
  // provisionFieldValue() already resolves derived fields via
  // derivedFieldDef()/computeDerivedField(), so this is a drop-in swap.
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
