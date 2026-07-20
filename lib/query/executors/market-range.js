const { frequencyStats, histogram, numericStats } = require('../market-baseline');
const { comparisonDeals, fieldDef, fieldKind, firstProvisionWithField, provisionFieldValue, buildProv } = require('./shared');
const { percentOfDealValue } = require('../../percent-of-deal');

// r13 (Ben, "% of deal value" — "Global calculation going to be required for
// that"): the registry annotates every dollar-amount field's type as 'usd'
// (see docs/schema-shape/normalized-v1.json, e.g. feeAmount/
// companyTerminationFee/reverseFeeAmount) or, on a couple of legacy rows,
// 'currency' — never any other type string. Deliberately narrow: this is
// the FEES/DOLLAR-AMOUNTS gate, not "any numeric field" — a percentage- or
// duration-typed field (already a ratio/period, not a dollar figure) never
// gets a parallel percent-of-deal-value distribution.
function isMoneyFieldType(type) {
  return type === 'usd' || type === 'currency';
}

function executeMarketRange(payload, context) {
  const deals = comparisonDeals(context.deals || [], payload.deal_filter);
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]));
  const provisionType = payload.provision_type;
  const def = fieldDef(provisionType, payload.field_path);
  const kind = fieldKind(def);
  const isMoneyField = isMoneyFieldType(def && def.type);
  const dealPoints = [];
  for (const deal of deals) {
    const provision = firstProvisionWithField(context.provisions || [], deal.id, provisionType, payload.field_path, null, deal);
    if (!provision) continue;
    const result = provisionFieldValue(provision, provisionType, payload.field_path, deal);
    if (result.value === null || result.value === undefined || result.value === '') continue;
    dealPoints.push({
      deal_id: deal.id,
      deal_name: `${deal.acquirer || 'Buyer'} / ${deal.target || 'Target'}`,
      card_id: provision.id,
      value: result.value,
      verbatim_quote: result.quote,
      quote_section_ref: provision.section_ref || provision.section || null,
      _prov: buildProv(result, provision),
    });
  }
  const values = dealPoints.map((point) => point.value);
  const numeric = kind === 'numeric';

  // "Global calculation": for a money field, ALSO compute a parallel
  // percent-basis distribution — each deal's own amount / that deal's own
  // value_usd — alongside the existing dollar stats. This is a NEW set of
  // fields (percentStats + per-point `percent`); it never touches `stats`/
  // `distribution`/`deal_points`' existing keys, so every current consumer
  // of this executor's response is unaffected. Deals with no (or
  // non-positive/non-finite) value_usd are excluded from the percent
  // distribution — reported via percentStats.excludedCount — rather than
  // guessed at.
  let percentStats = null;
  if (numeric && isMoneyField) {
    let excludedCount = 0;
    for (const point of dealPoints) {
      const deal = dealsById.get(point.deal_id);
      const dealValueUsd = deal && deal.value_usd != null ? Number(deal.value_usd) : null;
      const percent = percentOfDealValue(Number(point.value), dealValueUsd);
      point.percent = percent;
      if (percent === null) excludedCount += 1;
    }
    const percentValues = dealPoints.filter((point) => point.percent !== null).map((point) => point.percent);
    percentStats = { ...numericStats(percentValues), excludedCount };
  }

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
    percentStats,
  };
}

module.exports = { executeMarketRange };
