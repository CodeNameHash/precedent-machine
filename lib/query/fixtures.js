const { kindToSlug } = require('./types');

function topDealIds(deals, count) {
  return (deals || []).slice(0, count).map((deal) => deal.id).filter(Boolean);
}

function featuredQueries(deals) {
  const ids = topDealIds(deals, 4);
  const first = ids[0] || null;
  return [
    {
      id: 'featured-deal-compare-bio',
      query_kind: 'DEAL_COMPARE',
      title: 'Recent Bio Deal Compare',
      description: 'Four-column compare across core deal terms.',
      href: `/newhome/query/${kindToSlug('DEAL_COMPARE')}/adhoc?payload=${encodePayload({ deal_ids: ids.slice(0, 4), provision_types: ['CONSIDERATION', 'TERMINATION_FEE', 'COVENANT_NO_SOLICITATION'], highlight_deltas: true, included_field_groups: ['primary', 'qualifiers'] })}`,
      preview: 'Consideration, no-sol and fee economics',
    },
    {
      id: 'featured-nosol-cross-cut',
      query_kind: 'PROVISION_CROSS_CUT',
      title: 'No-Sol Cross-Cut: 2025',
      description: 'Go-shop, fiduciary out and match rights by deal.',
      href: `/newhome/query/${kindToSlug('PROVISION_CROSS_CUT')}/adhoc?payload=${encodePayload({ provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: null, deal_ids: ids, columns: ['go_shop', 'fiduciary_out', 'matching_rights_days'], sort_by: 'deal_signing_date_desc' })}`,
      preview: 'One row per selected deal',
    },
    {
      id: 'featured-term-fee-range',
      query_kind: 'MARKET_RANGE',
      title: 'Term Fee Market Range',
      description: 'Distribution of target termination fee percentages.',
      href: `/newhome/query/${kindToSlug('MARKET_RANGE')}/adhoc?payload=${encodePayload({ provision_type: 'TERMINATION_FEE', field_path: 'fee_amount_percent', deal_filter: {}, chart_kind: 'HISTOGRAM' })}`,
      preview: 'Histogram and underlying deal points',
    },
    {
      id: 'featured-filter-goshop',
      query_kind: 'FILTER_THEN_LIST',
      title: 'Go-Shop Deals',
      description: 'Deals with a go-shop provision present.',
      href: `/newhome/query/${kindToSlug('FILTER_THEN_LIST')}/adhoc?payload=${encodePayload({ filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'go_shop', op: 'eq', value: true }], sort_by: 'deal_signing_date_desc', columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'] })}`,
      preview: 'Filter then list with matched hits',
    },
    {
      id: 'featured-deal-to-market',
      query_kind: 'DEAL_TO_MARKET',
      title: 'Deal-to-Market Scorecard',
      description: 'Market, off-market, unusual and missing terms.',
      href: `/newhome/query/${kindToSlug('DEAL_TO_MARKET')}/adhoc?payload=${encodePayload({ deal_id: first, comparison_set_filter: {}, provision_types: null })}`,
      preview: 'Scorecard against the corpus',
      disabled: !first,
    },
    {
      id: 'featured-match-days',
      query_kind: 'MARKET_RANGE',
      title: 'Matching Rights Days',
      description: 'Market range for initial match periods.',
      href: `/newhome/query/${kindToSlug('MARKET_RANGE')}/adhoc?payload=${encodePayload({ provision_type: 'COVENANT_NO_SOLICITATION', field_path: 'matching_rights_days', deal_filter: {}, chart_kind: 'HISTOGRAM' })}`,
      preview: 'No-sol mechanics snapshot',
    },
  ];
}

function snapshotPayloads() {
  return [
    { title: 'Median term fee', provision_type: 'TERMINATION_FEE', field_path: 'fee_amount_percent', chart_kind: 'HISTOGRAM' },
    { title: 'Outside date extensions', provision_type: 'TERMINATION_RIGHT', field_path: 'outside_date_extension_months', chart_kind: 'HISTOGRAM' },
    { title: 'Go-shop presence', provision_type: 'COVENANT_NO_SOLICITATION', field_path: 'go_shop', chart_kind: 'BAR' },
    { title: 'Matching rights days', provision_type: 'COVENANT_NO_SOLICITATION', field_path: 'matching_rights_days', chart_kind: 'HISTOGRAM' },
    { title: 'No-shop type distribution', provision_type: 'COVENANT_NO_SOLICITATION', field_path: 'no_shop_type', chart_kind: 'BAR' },
    { title: 'MAE carve-out count', provision_type: 'REPRESENTATION', field_path: 'maeLimbs', chart_kind: 'BAR' },
  ];
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(value) {
  if (!value) return null;
  return JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
}

module.exports = { featuredQueries, snapshotPayloads, encodePayload, decodePayload };
