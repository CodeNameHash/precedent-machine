// Human titles for query results — item 1 of the 2026-07-19 query-results
// overhaul. Every QUERY_KINDS result used to title itself with the raw
// machine kind ("FILTER_THEN_LIST") on the result page
// (pages/query/[kind]/[id].js); this derives a plain-English title straight
// from the result payload for each of the five kinds instead. Pulled out of
// the page component (which is JSX and awkward to unit-test directly) so it
// can be required/tested in plain Node — same split as
// lib/query/filter-labels.js, which this module builds on.
//
// savedQuery.title still wins over all of this on the page — see
// pages/query/[kind]/[id].js's `title` useMemo.

const {
  humanizeKey, provisionTypeLabel, lowerFirst, sentenceForFilter, isBooleanFilter, KIND_LABELS,
} = require('./filter-labels');

function kindLabel(kind) {
  // r15 item 1: plain-English kind names ("Benchmark a term"), never the
  // machine key. Unknown kinds still degrade to a de-underscored string.
  return KIND_LABELS[kind] || String(kind || 'Query').replace(/_/g, ' ').replace(/-/g, ' ');
}

// sentenceForFilter() prefixes provision-scoped filters with "<Provision
// label>: " (e.g. "Covenant no solicitation: Has force the vote") — strip
// that back off for the title, which reads as "Deals with force the vote".
function stripProvisionPrefix(sentence, filter) {
  const provisionLabel = provisionTypeLabel(filter.provision_type);
  const prefix = provisionLabel ? `${provisionLabel}: ` : '';
  return sentence.startsWith(prefix) ? sentence.slice(prefix.length) : sentence;
}

// One filter, boolean -> "Deals with <field>" / "Deals without <field>".
// Multiple filters, or a single non-boolean filter -> "Deals where <sentence
// 1> and <sentence 2>…", reusing sentenceForFilter's full phrasing (numeric
// ranges, coded values, contains) for anything that isn't a plain has/hasn't.
function filterThenListTitle(result) {
  const filters = result.filters_applied || [];
  if (!filters.length) return 'All deals';
  // SHOW_ALL mode (r15 item 7): a single mode:'all' filter lists every deal
  // annotated with the term — title it "<Field> across all deals".
  if (filters.length === 1 && filters[0].mode === 'all') {
    return `${humanizeKey(filters[0].field)} across all deals`;
  }
  if (filters.length === 1 && isBooleanFilter(filters[0])) {
    const filter = filters[0];
    const fieldLabel = humanizeKey(filter.field);
    const truthy = filter.value === true || filter.value === 'true';
    const negated = filter.op === 'neq';
    const positive = negated ? !truthy : truthy;
    return `Deals ${positive ? 'with' : 'without'} ${lowerFirst(fieldLabel)}`;
  }
  const clauses = filters.map((filter) => lowerFirst(stripProvisionPrefix(sentenceForFilter(filter), filter)));
  return `Deals where ${clauses.join(' and ')}`;
}

function resultTitle(result) {
  if (!result) return '';
  if (result.kind === 'FILTER_THEN_LIST') return filterThenListTitle(result);
  if (result.kind === 'MARKET_RANGE') return `Benchmark — ${humanizeKey(result.field_path)}`;
  if (result.kind === 'DEAL_COMPARE') return `Compare: ${(result.columns || []).map((col) => col.deal_name).join(' vs ')}`;
  if (result.kind === 'PROVISION_CROSS_CUT') return `${provisionTypeLabel(result.provision_type)} across deals`;
  if (result.kind === 'DEAL_TO_MARKET') return `${result.deal_name || 'This deal'} vs the market`;
  return kindLabel(result.kind);
}

module.exports = { resultTitle, filterThenListTitle, stripProvisionPrefix, kindLabel };
