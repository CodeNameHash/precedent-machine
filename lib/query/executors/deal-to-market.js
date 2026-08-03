const { numericStats, scoreValue, frequencyStats } = require('../market-baseline');
const { PROVISION_CARD_TYPES } = require('../types');
const { comparisonDeals, fieldDef, fieldKind, firstProvisionWithField, provisionFieldValue, buildProv, hasValue } = require('./shared');

const SCORE_FIELDS = {
  TERMINATION_FEE: ['terminationFeePercentEquityValue', 'reverseFeePercentage', 'tailFeeWindowMonths'],
  COVENANT_NO_SOLICITATION: ['goShopPresent', 'initialMatchPeriodDays', 'subsequentMatchPeriodDays', 'boardChangeForSuperiorProposal'],
  TERMINATION_RIGHT: ['extensionMaxExercises', 'finalAndNonappealableRequired'],
  CONSIDERATION: ['considerationType', 'perShareAmount'],
  REPRESENTATION: ['materialityScrape', 'knowledgeStandard', 'materialityQualifier'],
};

function executeDealToMarket(payload, context) {
  const deal = (context.deals || []).find((row) => row.id === payload.deal_id);
  const comparison = comparisonDeals(context.deals || [], payload.comparison_set_filter).filter((row) => row.id !== payload.deal_id);
  const provisionTypes = payload.provision_types || Object.keys(SCORE_FIELDS).filter((type) => PROVISION_CARD_TYPES.includes(type));
  const scorecard = [];
  for (const provisionType of provisionTypes) {
    for (const field of SCORE_FIELDS[provisionType] || []) {
      const def = fieldDef(provisionType, field);
      const kind = fieldKind(def);
      const values = [];
      for (const peer of comparison) {
        const provision = firstProvisionWithField(context.provisions || [], peer.id, provisionType, field, null, peer);
        if (!provision) continue;
        const result = provisionFieldValue(provision, provisionType, field, peer);
        if (result.value !== null && result.value !== undefined && result.value !== '') values.push(result.value);
      }
      const base = kind === 'numeric' ? numericStats(values) : frequencyStats(values);
      const dealProvision = deal ? firstProvisionWithField(context.provisions || [], deal.id, provisionType, field, null, deal) : null;
      const dealResult = dealProvision ? provisionFieldValue(dealProvision, provisionType, field, deal) : { value: null, quote: null };
      const status = scoreValue(dealResult.value, base, kind, values.length, comparison.length);
      scorecard.push({
        provision_type: provisionType,
        field_path: dealResult.key || def?.key || field,
        field_label: def ? def.label : field,
        deal_value: dealResult.value,
        baseline_stats: kind === 'numeric' ? base : { distribution: base, n: values.length },
        status,
        card_id: dealProvision && dealProvision.id,
        verbatim_quote: dealResult.quote,
        ...(hasValue(dealResult.value) ? { _prov: buildProv(dealResult, dealProvision) } : {}),
      });
    }
  }
  const summary = {
    market_count: scorecard.filter((x) => x.status === 'MARKET').length,
    off_market_count: scorecard.filter((x) => x.status === 'OFF_MARKET').length,
    unusual_count: scorecard.filter((x) => x.status === 'UNUSUAL').length,
    missing_count: scorecard.filter((x) => x.status === 'MISSING').length,
    not_applicable_count: scorecard.filter((x) => x.status === 'NOT_APPLICABLE').length,
  };
  return {
    kind: 'DEAL_TO_MARKET',
    deal_id: payload.deal_id,
    deal_name: deal ? `${deal.acquirer || 'Buyer'} / ${deal.target || 'Target'}` : null,
    comparison_set_size: comparison.length,
    comparison_set_filter_applied: payload.comparison_set_filter || {},
    scorecard,
    summary,
  };
}

module.exports = { executeDealToMarket };
