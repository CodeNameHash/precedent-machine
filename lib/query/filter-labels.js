// Natural-language presentation for query filters/operators — item 3 of the
// Ben query-surface pass. Pure presentation: nothing here touches the
// underlying filter payload (provision_type/field/op/value stay exactly as
// the engine expects — see lib/query/executors/filter-then-list.js). This
// module only turns those raw enum values into copy for the builder UI and
// the "filters applied" chips on the result page.
//
// No existing field-label registry covers provision-card field paths (the
// deals-index column registry in lib/deals-index-columns.js only covers the
// deal-level table on `/`), so this introduces one scoped to the query
// surface.

const OPERATOR_LABELS = {
  eq: 'equals',
  neq: 'is not',
  gt: 'more than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  contains: 'contains',
};

function operatorLabel(op) {
  return OPERATOR_LABELS[String(op || '').toLowerCase()] || String(op || '');
}

// "forceTheVote" -> "Force the vote", "COVENANT_NO_SOLICITATION" -> "Covenant
// no solicitation", "total_deal_value" -> "Total deal value". Splits on
// underscores/hyphens and camelCase boundaries, lowercases, then sentence-
// cases the first word only (reads as a phrase, not a Title Case heading).
function humanizeKey(key) {
  if (!key) return '';
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase());
  if (!words.length) return '';
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

// Booleans render as Yes/No everywhere on the query surface (matches
// formatValue() on the result page); everything else is left as its plain
// string form (numbers, free-text values typed into the builder).
function formatFilterValue(value) {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

// One filter -> { provisionLabel, fieldLabel, opLabel, valueLabel, text }.
// `text` reads like "No-solicitation covenant: Force the vote is Yes" — the
// "Deal type is All cash" cadence from the spec, with the provision type as
// a scoping prefix since these filters are always provision-scoped.
function describeFilter(filter) {
  const provisionLabel = humanizeKey(filter.provision_type);
  const fieldLabel = humanizeKey(filter.field);
  const opLabel = operatorLabel(filter.op);
  const valueLabel = formatFilterValue(filter.value);
  const text = `${provisionLabel ? `${provisionLabel}: ` : ''}${fieldLabel} · ${opLabel} · ${valueLabel}`;
  return { provisionLabel, fieldLabel, opLabel, valueLabel, text };
}

module.exports = {
  OPERATOR_LABELS,
  operatorLabel,
  humanizeKey,
  formatFilterValue,
  describeFilter,
};
