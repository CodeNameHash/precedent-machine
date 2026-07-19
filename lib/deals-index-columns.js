// Column registry for the / (deals index) table — DEALS-INDEX-SPEC item 6.
// Each entry describes how to read, sort and filter one column against the
// `publicDeal()` shape shipped by /api/home. Pure data + functions, no React,
// so it can be unit-tested and consumed by both the header popovers and the
// localStorage column picker.

// Enum-code -> natural-language reuse (Ben, deals-index round): the same
// labelForCode(code, MERGER_FORMS) lookup the r4 structure-mechanics fix
// (components/review/table-configs/structure-mechanics.config.js) uses to
// turn REVERSE_TRIANGULAR_MERGER into "Reverse triangular merger" — sourced
// straight from lib/taxonomy.js so the index and the review page can never
// drift on the mapping.
const { MERGER_FORMS, labelForCode } = require('./taxonomy');

function mergerFormDisplay(raw) {
  if (!raw) return null;
  return labelForCode(String(raw), MERGER_FORMS) || String(raw);
}

// "$412M (1.8%)" — dollar amount from a companyTerminationFee/
// reverseTerminationFee claim, formatted the same B/M/raw way as the page's
// own fmtMoney() (pages/index.js) so the two never show mismatched units.
function fmtUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 10e9 ? 0 : 1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// deal.termination_fee = { amount, pct } | null — amount + query-time
// feePctOfDealValue (lib/query/derived-fields.js), both computed server-
// side in lib/home-data.js. Renders "$X (Y%)" per the spec, "$X" alone when
// deal value is missing/zero so pct couldn't be derived, or null (renders
// as a dash) when no fee amount was extracted at all.
function terminationFeeDisplay(fee) {
  if (!fee || fee.amount == null) return null;
  const money = fmtUsd(fee.amount);
  if (!money) return null;
  return fee.pct != null ? `${money} (${fee.pct}%)` : money;
}

// deal.reverse_termination_fee = { amount } | null.
function reverseFeeDisplay(fee) {
  if (!fee || fee.amount == null) return null;
  return fmtUsd(fee.amount);
}

// deal.outside_date_months — whole months from signing to the (initial)
// outside/drop-dead date, already computed at extraction time by the
// TERMR-OUTSIDE post-pass (outsideDateMonthsPostSigning) and surfaced
// per-deal by lib/home-data.js; no re-derivation needed here (see
// lib/query/derived-fields.js's file-header note on gap G-C).
function outsideDateDisplay(months) {
  if (months == null) return null;
  const n = Number(months);
  if (!Number.isFinite(n)) return null;
  return `${n} mo`;
}

// deal.go_shop: true | false | null (null = no go-shop-covenant provision
// found on the deal at all, distinct from an explicit "no go-shop").
function goShopDisplay(goShop) {
  if (goShop == null) return null;
  return goShop ? 'Yes' : 'No';
}

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
    accessor: (deal) => mergerFormDisplay(deal.merger_form),
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: false,
  },
  {
    key: 'term_fee',
    label: 'Company termination fee',
    accessor: (deal) => terminationFeeDisplay(deal.termination_fee),
    sortValue: (deal) => (deal.termination_fee && Number(deal.termination_fee.amount)) || 0,
    sortable: true,
    filterable: false,
    defaultVisible: true,
  },
  {
    key: 'reverse_fee',
    label: 'Reverse termination fee',
    accessor: (deal) => reverseFeeDisplay(deal.reverse_termination_fee),
    sortValue: (deal) => (deal.reverse_termination_fee && Number(deal.reverse_termination_fee.amount)) || 0,
    sortable: true,
    filterable: false,
    defaultVisible: false,
  },
  {
    key: 'outside_date',
    label: 'Outside date',
    accessor: (deal) => outsideDateDisplay(deal.outside_date_months),
    sortValue: (deal) => Number(deal.outside_date_months) || 0,
    sortable: true,
    filterable: true,
    filterType: 'enum',
    defaultVisible: true,
  },
  {
    key: 'go_shop',
    label: 'Go-shop',
    accessor: (deal) => goShopDisplay(deal.go_shop),
    sortable: true,
    filterable: true,
    filterType: 'enum',
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
  mergerFormDisplay,
  terminationFeeDisplay,
  reverseFeeDisplay,
  outsideDateDisplay,
  goShopDisplay,
};
