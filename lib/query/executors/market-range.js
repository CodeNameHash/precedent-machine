const { frequencyStats, histogram, numericStats } = require('../market-baseline');
const { comparisonDeals, fieldDef, fieldKind, firstProvisionWithField, provisionFieldValue } = require('./shared');

function executeMarketRange(payload, context) {
  const deals = comparisonDeals(context.deals || [], payload.deal_filter);
  const provisionType = payload.provision_type;
  const def = fieldDef(provisionType, payload.field_path);
  const kind = fieldKind(def);
  const dealPoints = [];
  for (const deal of deals) {
    const provision = firstProvisionWithField(context.provisions || [], deal.id, provisionType, payload.field_path);
    if (!provision) continue;
    const result = provisionFieldValue(provision, provisionType, payload.field_path);
    if (result.value === null || result.value === undefined || result.value === '') continue;
    dealPoints.push({
      deal_id: deal.id,
      deal_name: `${deal.acquirer || 'Buyer'} / ${deal.target || 'Target'}`,
      card_id: provision.id,
      value: result.value,
      verbatim_quote: result.quote,
      quote_section_ref: provision.section_ref || provision.section || null,
    });
  }
  const values = dealPoints.map((point) => point.value);
  const numeric = kind === 'numeric';
  return {
    kind: 'MARKET_RANGE',
    provision_type: provisionType,
    field_path: def ? def.key : payload.field_path,
    field_kind: def ? def.type : kind,
    n: dealPoints.length,
    comparison_set_filter_applied: payload.deal_filter || {},
    stats: numeric ? numericStats(values) : null,
    distribution: numeric ? histogram(values) : frequencyStats(values),
    deal_points: dealPoints,
  };
}

module.exports = { executeMarketRange };
