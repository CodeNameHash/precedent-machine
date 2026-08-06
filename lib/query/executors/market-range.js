const { frequencyStats, histogram, numericStats } = require('../market-baseline');
const {
  comparisonDeals, dealColumn, fieldDef, fieldKind, firstProvisionWithField, provisionFieldValue, buildProv,
} = require('./shared');
const { percentOfDealValue } = require('../../percent-of-deal');
const { classifyDealValueBasis } = require('../../deal-value-basis');
const { feeDetails } = require('../derived-fields');
// r14 (Ben, "compare look-back LENGTHS, not dates"): registry-gated
// converter for deal-relative anchor fields (reps look-back dates, absence-
// of-changes since-dates, SEC-filings exception look-backs). See
// lib/query/relative-periods.js for the audited field list + rounding rule.
const { isRelativePeriodField, toRelativeMonthsForField, RELATIVE_MONTHS_UNIT } = require('../relative-periods');
const { assertNoDarkAuthorityRecords } = require('../dark-authority-fence');

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

function feeSideForField(provisionType, requestedField, canonicalField) {
  if (provisionType !== 'TERMINATION_FEE') return null;
  const field = `${requestedField || ''} ${canonicalField || ''}`.toLowerCase();
  if (/reverse/.test(field)) return 'reverse';
  if (/fee|termination/.test(field)) return 'company';
  return null;
}

function executeMarketRange(payload, context) {
  assertNoDarkAuthorityRecords(context.provisions || [], 'Query cannot admit a VALIDATED_NOT_SERVED provision.');
  const deals = comparisonDeals(context.deals || [], payload.deal_filter);
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]));
  const provisionType = payload.provision_type;
  const def = fieldDef(provisionType, payload.field_path);
  const kind = fieldKind(def);
  const isMoneyField = isMoneyFieldType(def && def.type);
  const feeSide = feeSideForField(provisionType, payload.field_path, def && def.key);
  const dealPoints = [];
  for (const deal of deals) {
    const provision = firstProvisionWithField(context.provisions || [], deal.id, provisionType, payload.field_path, null, deal);
    if (!provision) continue;
    const result = provisionFieldValue(provision, provisionType, payload.field_path, deal);
    if (result.value === null || result.value === undefined || result.value === '') continue;
    const details = feeSide ? feeDetails(provision, feeSide) : null;
    const point = {
      deal_id: deal.id,
      deal_name: dealColumn(deal).deal_name,
      card_id: provision.id,
      value: result.value,
      verbatim_quote: details?.quote || result.quote,
      quote_section_ref: provision.section_ref || provision.section || null,
      _prov: buildProv(result, provision),
      deal_value_basis: classifyDealValueBasis(deal),
    };
    if (details) {
      point.fee_side = details.side;
      point.fee_source = details.sourceLabel;
      point.amount_usd = details.amount;
      point.triggers = details.triggers;
      if (def && def.type === 'percentage') point.percent = Number(result.value);
    }
    dealPoints.push(point);
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
  let percentDistribution = null;
  if (numeric && isMoneyField) {
    let excludedCount = 0;
    for (const point of dealPoints) {
      const deal = dealsById.get(point.deal_id);
      const dealValueUsd = deal && deal.value_usd != null ? Number(deal.value_usd) : null;
      const percent = percentOfDealValue(Number(point.value), dealValueUsd);
      point.percent = percent;
      point.percent_of_deal_value = percent;
      if (percent === null) excludedCount += 1;
    }
    const percentValues = dealPoints.filter((point) => point.percent !== null).map((point) => point.percent);
    percentStats = { ...numericStats(percentValues), excludedCount };
    percentDistribution = histogram(percentValues);
  }

  if (feeSide && !isMoneyField) {
    for (const point of dealPoints) point.percent_of_deal_value = point.percent;
  }

  const observedBases = [...new Set(dealPoints.map((point) => point.deal_value_basis).filter(Boolean))];
  const dealValueBasis = observedBases.length === 1 ? observedBases[0] : (observedBases.length ? 'mixed' : 'unknown');

  // r14 ("compare look-back LENGTHS, not dates"): for a registry-listed
  // deal-relative anchor field, ALSO compute a parallel months-before-
  // signing distribution — each deal's stored anchor date (or stored
  // duration) converted against that deal's own signing date. Mirrors the
  // percentStats pattern exactly: NEW additive fields (relativeMonthsStats +
  // per-point `relative_months`), never touching `stats`/`distribution`/
  // existing deal_points keys, so every current consumer is unaffected.
  // Deals whose value can't convert (defined-term anchor like "the Balance
  // Sheet Date", missing signing date) are excluded and counted via
  // relativeMonthsStats.excludedCount — never guessed at.
  let relativeMonthsStats = null;
  const fieldKey = def ? def.key : payload.field_path;
  if (isRelativePeriodField(fieldKey)) {
    let excludedCount = 0;
    for (const point of dealPoints) {
      const deal = dealsById.get(point.deal_id);
      const months = toRelativeMonthsForField(fieldKey, point.value, deal || {});
      point.relative_months = months;
      if (months === null) excludedCount += 1;
    }
    const monthValues = dealPoints.filter((point) => point.relative_months !== null).map((point) => point.relative_months);
    relativeMonthsStats = { ...numericStats(monthValues), excludedCount, unit: RELATIVE_MONTHS_UNIT };
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
    percentDistribution,
    primary_basis: (isMoneyField || (feeSide && def && def.type === 'percentage')) ? 'percent_of_deal_value' : 'raw_value',
    deal_value_basis: dealValueBasis,
    fee_context: feeSide ? {
      side: feeSide === 'reverse' ? 'reverse_buyer' : 'company_target',
      label: feeSide === 'reverse' ? 'Reverse / buyer termination fee' : 'Company / target termination fee',
    } : null,
    relativeMonthsStats,
  };
}

module.exports = { executeMarketRange };
