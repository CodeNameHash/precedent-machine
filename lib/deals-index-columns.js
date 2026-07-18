// Column registry for the / (deals index) table — DEALS-INDEX-SPEC item 6.
// Each entry describes how to read, sort and filter one column against the
// `publicDeal()` shape shipped by /api/home. Pure data + functions, no React,
// so it can be unit-tested and consumed by both the header popovers and the
// localStorage column picker.

const CONSIDERATION_TYPE_LABELS = {
  CASH: 'Cash',
  STOCK: 'Stock',
  MIXED: 'Mixed',
  MIXED_ELECTION: 'Mixed election',
  CASH_PLUS_CVR: 'Cash + CVR',
};

function considerationTypeDisplay(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (CONSIDERATION_TYPE_LABELS[key]) return CONSIDERATION_TYPE_LABELS[key];
  return String(raw);
}

const BUYER_PROFILE_LABELS = {
  financial: 'Take-private',
  strategic: 'Strategic',
};

function buyerProfileDisplay(raw) {
  if (!raw) return null;
  return BUYER_PROFILE_LABELS[String(raw).toLowerCase()] || String(raw);
}

function valueBand(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1e9) return '<$1B';
  if (n < 1e10) return '$1B-$10B';
  return '>$10B';
}

function signedYear(deal) {
  return deal.signing_date ? String(deal.signing_date).slice(0, 4) : null;
}

// Every column: { key, label, accessor(deal), sortValue(deal), sortable,
// filterable, defaultVisible, filterType: 'enum'|'band'|'year', coverage }
// accessor() returns the display string/number; sortValue() (when different
// from accessor) is used for ordering. filterType 'enum' builds a checklist
// of distinct accessor() values; 'band'/'year' use fixed/derived buckets.
const COLUMNS = [
  {
    key: 'deal',
    label: 'Deal',
    accessor: (deal) => deal.deal_name,
    sortValue: (deal) => (deal.deal_name || '').toLowerCase(),
    sortable: true,
    filterable: false,
    defaultVisible: true,
  },
  {
    key: 'signed',
    label: 'Signed',
    accessor: (deal) => deal.signing_date,
    sortValue: (deal) => deal.signing_date || '',
    sortable: true,
    filterable: true,
    filterType: 'year',
    filterValue: signedYear,
    defaultVisible: true,
  },
  {
    key: 'value',
    label: 'Value',
    accessor: (deal) => deal.value,
    sortValue: (deal) => Number(deal.value) || 0,
    sortable: true,
    filterable: true,
    filterType: 'band',
    filterValue: (deal) => deal.value_band || valueBand(deal.value),
    defaultVisible: true,
  },
  {
    key: 'type',
    label: 'Type',
    accessor: (deal) => considerationTypeDisplay(deal.consideration_type),
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: true,
  },
  {
    key: 'buyer_type',
    label: 'Buyer type',
    accessor: (deal) => buyerProfileDisplay(deal.buyer_profile),
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: true,
  },
  {
    key: 'sector',
    label: 'Sector',
    accessor: (deal) => deal.sector,
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: true,
  },
  {
    key: 'law_firm_buyer',
    label: 'Law firm (buyer)',
    accessor: (deal) => (deal.advisors?.buyer_firms || []).join(', ') || null,
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: false,
    coverage: '17/40',
  },
  {
    key: 'law_firm_target',
    label: 'Law firm (target)',
    accessor: (deal) => (deal.advisors?.seller_firms || []).join(', ') || null,
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: false,
    coverage: '17/40',
  },
  {
    key: 'lawyers_buyer',
    label: 'Lawyers (buyer)',
    accessor: (deal) => (deal.advisors?.buyer_lawyers || []).join(', ') || null,
    sortable: false,
    filterable: false,
    defaultVisible: false,
    coverage: '17/40',
  },
  {
    key: 'lawyers_target',
    label: 'Lawyers (target)',
    accessor: (deal) => (deal.advisors?.seller_lawyers || []).join(', ') || null,
    sortable: false,
    filterable: false,
    defaultVisible: false,
    coverage: '17/40',
  },
  {
    key: 'merger_form',
    label: 'Merger form',
    accessor: (deal) => deal.merger_form,
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: false,
  },
  {
    key: 'provisions',
    label: 'Provisions',
    accessor: (deal) => deal.provision_count,
    sortValue: (deal) => Number(deal.provision_count) || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
  },
];

const COLUMNS_BY_KEY = new Map(COLUMNS.map((col) => [col.key, col]));

function getColumn(key) {
  return COLUMNS_BY_KEY.get(key) || null;
}

function defaultVisibleKeys() {
  return COLUMNS.filter((col) => col.defaultVisible).map((col) => col.key);
}

module.exports = {
  COLUMNS,
  getColumn,
  defaultVisibleKeys,
  considerationTypeDisplay,
  buyerProfileDisplay,
  valueBand,
  signedYear,
};
