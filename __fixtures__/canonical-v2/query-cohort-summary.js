const INTERNAL_SCALE = 16;
const OUTPUT_SCALE = 8;
const SCALE_REDUCTION = 10n ** BigInt(INTERNAL_SCALE - OUTPUT_SCALE);

function parseDecimal(value) {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(`${whole}${fraction.padEnd(INTERNAL_SCALE, '0').slice(0, INTERNAL_SCALE)}`);
}

function roundPositive(numerator, denominator) {
  return (numerator + (denominator / 2n)) / denominator;
}

function fixed8FromFraction(numerator, denominator = 1n) {
  const scaled = roundPositive(numerator, denominator * SCALE_REDUCTION);
  const text = scaled.toString().padStart(OUTPUT_SCALE + 1, '0');
  return `${text.slice(0, -OUTPUT_SCALE)}.${text.slice(-OUTPUT_SCALE)}`;
}

function percentile(values, quarter) {
  const positionNumerator = BigInt((values.length - 1) * quarter);
  const lower = Number(positionNumerator / 4n);
  const remainder = positionNumerator % 4n;
  const upper = remainder === 0n ? lower : lower + 1;
  return fixed8FromFraction(
    (values[lower] * (4n - remainder)) + (values[upper] * remainder),
    4n,
  );
}

function buildQueryCohortSummary({ params, rows }) {
  const projections = rows.map((row) => projectSharedServingRowRecord({
    row,
    serving_namespace_id: '0'.repeat(64),
  }));
  const valuesByDeal = new Map();
  const numericRows = [];
  for (const row of rows) {
    const value = row?.canonical_result?.components?.[0]?.canonical_value;
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) continue;
    const numeric = parseDecimal(value);
    numericRows.push(numeric);
    if (!valuesByDeal.has(row.governed_deal_key)) valuesByDeal.set(row.governed_deal_key, new Set());
    valuesByDeal.get(row.governed_deal_key).add(numeric);
  }
  const dealKeys = new Set(rows.map((row) => row.governed_deal_key));
  const multiValueDeals = [...valuesByDeal.values()].filter((values) => values.size > 1).length;
  const state = rows.length === 0
    ? 'NO_VALUES'
    : multiValueDeals > 0
      ? 'NOT_DEFINED_MULTI_VALUE_PER_DEAL'
      : numericRows.length !== rows.length || valuesByDeal.size !== dealKeys.size
        ? 'INCOMPLETE_NUMERIC_DOMAIN'
        : 'AVAILABLE';
  const perDealValues = state === 'AVAILABLE'
    ? [...valuesByDeal.values()].map((values) => [...values][0])
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    : [];
  const statistic = (value) => (state === 'AVAILABLE' ? fixed8FromFraction(value) : null);
  const approximateRows = rows.filter((row) => (
    row?.canonical_result?.components?.[0]?.claim_attributes?.denominator_precision
      === 'APPROXIMATE'
  ));
  const facet = (key) => {
    const groups = new Map();
    for (const projection of projections) {
      for (const value of projection[key]) {
        if (!groups.has(value)) groups.set(value, { rows: 0, deals: new Set() });
        const group = groups.get(value);
        group.rows += 1;
        group.deals.add(projection.governed_deal_key);
      }
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([value, group]) => ({
        value,
        result_count: group.rows,
        deal_count: group.deals.size,
      }));
  };
  const market = rows[0]?.canonical_result?.market_context;
  return {
    schema_version: 'CANONICAL_QUERY_COHORT_SUMMARY/V1',
    scope: 'FULL_FILTERED_COMPARABLE_QUERY_RESULTS',
    query_semantics_digest: params.p_query_semantics_digest,
    metric_key: params.p_metric_key || market?.metric_key,
    metric_version: params.p_metric_version || market?.metric_version,
    basis_key: params.p_basis_key || market?.subject_observation?.basis_key,
    counts: {
      result_rows: rows.length,
      distinct_deals: dealKeys.size,
      numeric_result_rows: numericRows.length,
      numeric_distinct_deals: valuesByDeal.size,
      multi_value_deals: multiValueDeals,
      approximate_result_rows: approximateRows.length,
      approximate_distinct_deals: new Set(
        approximateRows.map((row) => row.governed_deal_key),
      ).size,
    },
    statistics: {
      state,
      derivation_version: state === 'AVAILABLE'
        ? 'DECIMAL_PERCENTILE_CONT_LINEAR_SCALE_8/V1'
        : null,
      n_deals: perDealValues.length,
      min: statistic(perDealValues[0]),
      p25: state === 'AVAILABLE' ? percentile(perDealValues, 1) : null,
      median: state === 'AVAILABLE' ? percentile(perDealValues, 2) : null,
      mean: state === 'AVAILABLE'
        ? fixed8FromFraction(
          perDealValues.reduce((sum, value) => sum + value, 0n),
          BigInt(perDealValues.length),
        )
        : null,
      p75: state === 'AVAILABLE' ? percentile(perDealValues, 3) : null,
      max: statistic(perDealValues.at(-1)),
    },
    facets: {
      trigger_codes: facet('trigger_codes'),
      payment_timings: facet('payment_timings'),
      trigger_conditions: facet('trigger_conditions'),
    },
  };
}

module.exports = { buildQueryCohortSummary };
const { projectSharedServingRowRecord } = require('../../lib/canonical-v2/query-result');
