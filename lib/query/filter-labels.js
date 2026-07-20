// Natural-language presentation for query filters/operators — item 3 of the
// Ben query-surface pass ("I HATE the equals/Yes — way too coder-like").
// Pure presentation: nothing here touches the underlying filter payload
// (provision_type/field/op/value stay exactly as the engine expects — see
// lib/query/executors/filter-then-list.js's testOp(), which this module's
// op vocabulary is kept in lockstep with, INCLUDING 'between' — that op was
// already supported server-side with value:[lo,hi], just never surfaced in
// the UI). This module only turns those raw values into copy for the
// builder UI and the "filters applied" chips on the result page.
//
// No existing field-label registry covers provision-card field paths (the
// deals-index column registry in lib/deals-index-columns.js only covers the
// deal-level table on `/`), so this introduces one scoped to the query
// surface.
//
// Kept dependency-free (no lib/taxonomy.js / lib/rubric.js import) so client
// bundles that pull this in (QueryFilterControls.jsx, QueryLaunchBox.jsx)
// don't drag in the heavy Node-oriented rubric — see lib/query/field-meta.js
// for the server-side module that resolves per-field TYPE and real corpus
// VALUE OPTIONS; components fetch that over /api/query/field-options and
// pass the result in here as `fieldMeta` so the sentence can be phrased
// correctly (boolean vs enum vs numeric). Every function here also works
// with fieldMeta omitted, falling back to a value-shape heuristic, so
// describeFilter() never regains "equals/Yes" wording even where a caller
// (e.g. the result page's filter chips) doesn't have fieldMeta handy.

const OPERATOR_LABELS = {
  eq: 'equals',
  neq: 'is not',
  gt: 'more than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  contains: 'contains',
  between: 'between',
};

// Numeric-typed field `type` strings (mirrors lib/query/field-meta.js's
// NUMERIC_TYPES — duplicated rather than imported, see file header). Only
// used as a fallback classifier when no fieldMeta is supplied.
const NUMERIC_TYPES = new Set(['usd', 'currency', 'percentage', 'percent', 'duration', 'number', 'decimal', 'int']);

const NUMERIC_QUANTIFIER_LABELS = {
  gte: 'at least',
  lte: 'at most',
  gt: 'more than',
  lt: 'less than',
  eq: 'exactly',
  neq: 'not',
};

function operatorLabel(op) {
  return OPERATOR_LABELS[String(op || '').toLowerCase()] || String(op || '');
}

// Acronyms and initialisms that must keep their casing when a key is
// humanized — "secFilingMeeting" must never render as "Sec filing meeting"
// (Ben r15, item 5: legal English, not mangled key-splits). Lower-case word
// -> display form. This is the MECHANISM fix: every label that falls through
// humanizeKey() (provision types, field keys, enum codes) picks these up, so
// there's no per-label whack-a-mole.
const ACRONYM_WORDS = {
  sec: 'SEC',
  hsr: 'HSR',
  mae: 'MAE',
  ioc: 'IOC',
  aoc: 'AoC',
  cvr: 'CVR',
  espp: 'ESPP',
  psu: 'PSU',
  rsu: 'RSU',
  ads: 'ADS',
  cfius: 'CFIUS',
  doj: 'DOJ',
  ftc: 'FTC',
  irs: 'IRS',
  erisa: 'ERISA',
  gaap: 'GAAP',
  usd: 'USD',
  llc: 'LLC',
  ftv: 'FTV',
  covid: 'COVID',
};

// "forceTheVote" -> "Force the vote", "COVENANT_NO_SOLICITATION" -> "Covenant
// no solicitation", "total_deal_value" -> "Total deal value". Splits on
// underscores/hyphens and camelCase boundaries, lowercases, then sentence-
// cases the first word only (reads as a phrase, not a Title Case heading).
// Words in ACRONYM_WORDS keep their canonical casing ("secFilings" ->
// "SEC filings", never "Sec filings").
function humanizeKey(key) {
  if (!key) return '';
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase());
  if (!words.length) return '';
  return words
    .map((w, i) => {
      if (ACRONYM_WORDS[w]) return ACRONYM_WORDS[w];
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(' ');
}

function lowerFirst(s) {
  if (!s) return s;
  // Never de-case an acronym: "SEC filings exception" must not become
  // "sEC filings exception" when dropped mid-sentence.
  if (/^[A-Z]{2}/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Legal-English overrides for provision_type keys whose humanizeKey() output
// reads as coder-speak rather than a term a lawyer would use (Ben r13, item
// 2: "Covenant No Solicitation" -> "No Solicitation" everywhere
// user-facing). Only maps the COVENANT_* family, whose "Covenant " prefix is
// registry plumbing (it groups these under one card family internally) and
// carries no legal meaning a reviewer needs to see. Everything else still
// falls through to humanizeKey() unchanged. If NOSOL-B/NOSOL-M ever surface
// as distinct query-surface provision_type keys (today the no-solicitation
// family is a single COVENANT_NO_SOLICITATION type on the query surface —
// party scope rides the appliesToParty field instead, already humanized via
// lib/taxonomy.js's APPLIES_TO_PARTY dict), add them here as "No
// Solicitation — Parent" / "No Solicitation — Mutual" rather than letting
// them fall back to humanizeKey.
const PROVISION_TYPE_LABELS = {
  COVENANT_NO_SOLICITATION: 'No Solicitation',
  'NOSOL-B': 'No Solicitation — Parent',
  'NOSOL-M': 'No Solicitation — Mutual',
  COVENANT_INTERIM_OPERATING: 'Interim Operating Covenants',
  COVENANT_OTHER: 'Other Covenants',
  // Ben r15, item 5: every provision-type key gets a proper legal-English
  // display form — humanizeKey() key-splits ("Sec filing meeting") are never
  // acceptable in a dropdown a lawyer reads.
  CONSIDERATION: 'Consideration',
  REPRESENTATION: 'Representations & Warranties',
  MATERIAL_CONTRACT: 'Material Contracts',
  CLOSING_CONDITION: 'Closing Conditions',
  TERMINATION_RIGHT: 'Termination Rights',
  TERMINATION_FEE: 'Termination Fees',
  DEFINITION: 'Defined Terms',
  ANTITRUST_REGULATORY: 'Antitrust & Regulatory',
  SEC_FILING_MEETING: 'SEC Filings & Stockholder Meeting',
  EMPLOYEE_BENEFITS: 'Employees & Benefits',
  STRUCTURE_MECHANICS: 'Structure & Mechanics',
  MAE: 'Material Adverse Effect (MAE)',
  NO_OTHER_REPS: 'No Other Representations',
  MISC_BOILERPLATE: 'Miscellaneous & Boilerplate',
};

// ── Query kinds (Ben r15, item 1) ──────────────────────────────────────────
// Plain-English names for the five query kinds — the machine keys
// (FILTER_THEN_LIST, …) stay internal; anything user-facing (launch-box
// tabs, saved-query badges, result titles) renders these instead. The
// one-line descriptions sit under the active tab in the launch box so a
// lawyer knows what each question does without decoding the name.
const KIND_LABELS = {
  FILTER_THEN_LIST: 'Find deals with a provision',
  MARKET_RANGE: 'Benchmark a term',
  DEAL_COMPARE: 'Compare deals',
  PROVISION_CROSS_CUT: 'Market check on a provision',
  DEAL_TO_MARKET: 'Deal vs market',
};

const KIND_DESCRIPTIONS = {
  FILTER_THEN_LIST: 'List every deal whose agreement matches the conditions you set — or show all deals and how each one treats a term.',
  MARKET_RANGE: 'See where a negotiated number falls across the corpus — the range, the middle of the market, and every deal’s figure.',
  DEAL_COMPARE: 'Put two or more deals side by side, provision by provision, with the differences flagged.',
  PROVISION_CROSS_CUT: 'Read one provision as written in every deal in the corpus — a market check on how the term is done.',
  DEAL_TO_MARKET: 'Lay one deal against corpus norms and flag its off-market terms.',
};

function kindDisplayLabel(kind) {
  return KIND_LABELS[kind] || humanizeKey(kind);
}

// Provision-type display label for anything user-facing on the query surface
// (field dropdowns, filter sentences, result titles/headers): legal-English
// override when one exists, else humanizeKey()'s generic split/sentence-case.
function provisionTypeLabel(key) {
  return PROVISION_TYPE_LABELS[key] || humanizeKey(key);
}

// Booleans render as Yes/No everywhere on the query surface (matches
// formatValue() on the result page); everything else is left as its plain
// string form (numbers, free-text values typed into the builder). Kept for
// callers (e.g. the result page's filter-chip tooltip) that want the bare
// value rather than a full sentence.
function formatFilterValue(value) {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(formatFilterValue).join(' – ');
  return String(value);
}

function isBooleanFilter(filter, fieldMeta) {
  if (fieldMeta && fieldMeta.type) return fieldMeta.type === 'boolean';
  return filter.value === true || filter.value === false || filter.value === 'true' || filter.value === 'false';
}

function isNumericFilter(filter, fieldMeta) {
  if (fieldMeta && fieldMeta.type) return NUMERIC_TYPES.has(fieldMeta.type);
  if (filter.op === 'between') return true;
  return ['gt', 'gte', 'lt', 'lte'].includes(filter.op) && filter.value !== '' && !Number.isNaN(Number(filter.value));
}

// 100000000 -> "$100M", 3500000 -> "$3.5M", 750000 -> "$750K". Only applied
// to the '$' unit — everything else (percent/days/plain numbers) is left as
// a plain number so a day count doesn't turn into "1.2K days".
function formatCurrencyCompact(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const trim = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}K`;
  return `${sign}$${trim(abs)}`;
}

// Renders one numeric value with its field's unit hint: "$" -> compact
// currency, "%" -> trailing percent sign, any other unit string (e.g. "days",
// "business days") -> trailing unit word, no unit -> the bare number.
function formatValueWithUnit(value, unit) {
  if (value === null || value === undefined || value === '') return '';
  if (unit === '$') return formatCurrencyCompact(value);
  if (unit === '%') return `${value}%`;
  if (unit) return `${value} ${unit}`;
  return String(value);
}

// Resolves a coded value (enum/tagged code) to its human label: prefers the
// real corpus-observed options list from lib/query/field-meta.js
// (fieldMeta.options, [{code,label}]) when supplied, else humanizes the raw
// code as a last resort so an un-fetched fieldMeta never regresses to a bare
// enum constant like "ALL_CASH".
function valueLabelForCode(value, fieldMeta) {
  const code = String(value);
  const hit = fieldMeta && Array.isArray(fieldMeta.options) ? fieldMeta.options.find((o) => String(o.code) === code) : null;
  if (hit) return hit.label;
  return humanizeKey(code) || code;
}

// The human sentence for one filter — item 3's core ask. Phrasing depends on
// the field's TYPE (boolean/numeric/coded), which the caller supplies via
// `fieldMeta` (see lib/query/field-meta.js / /api/query/field-options) for
// an exact match, or is inferred from the filter's own op/value shape when
// fieldMeta isn't available (still never falls back to "equals"/"Yes"):
//   boolean  -> "Has force the vote" / "Does not have force the vote"
//   numeric  -> "Termination fee is at least $100M" / "... is between $50M and $150M"
//   coded    -> "Consideration form is all cash" / "... is not all cash"
//   contains -> "Deal name contains \"Metsera\"" (free-text fields only)
function sentenceForFilter(filter, fieldMeta) {
  const fieldLabel = (fieldMeta && fieldMeta.label) || humanizeKey(filter.field);
  const provisionLabel = provisionTypeLabel(filter.provision_type);
  const prefix = provisionLabel ? `${provisionLabel}: ` : '';

  // SHOW_ALL mode (Ben r15, item 7): the filter isn't a gate — it lists
  // every deal and annotates whether each has the term and what its value
  // is. Payload shape: { provision_type, field, mode: 'all' } (no op/value).
  if (filter.mode === 'all') {
    const boolish = fieldMeta ? fieldMeta.type === 'boolean' : true;
    return `All deals, showing ${lowerFirst(fieldLabel)}${boolish ? ' status' : ''}`;
  }

  if (isBooleanFilter(filter, fieldMeta)) {
    const truthy = filter.value === true || filter.value === 'true';
    const negated = filter.op === 'neq';
    const positive = negated ? !truthy : truthy;
    return `${prefix}${positive ? 'Has' : 'Does not have'} ${lowerFirst(fieldLabel)}`;
  }

  if (isNumericFilter(filter, fieldMeta)) {
    const unit = fieldMeta && fieldMeta.unit;
    if (filter.op === 'between' && Array.isArray(filter.value)) {
      return `${prefix}${fieldLabel} is between ${formatValueWithUnit(filter.value[0], unit)} and ${formatValueWithUnit(filter.value[1], unit)}`;
    }
    const quantifier = NUMERIC_QUANTIFIER_LABELS[filter.op] || operatorLabel(filter.op);
    return `${prefix}${fieldLabel} is ${quantifier} ${formatValueWithUnit(filter.value, unit)}`;
  }

  if (filter.op === 'contains') {
    return `${prefix}${fieldLabel} contains "${filter.value}"`;
  }

  const negated = filter.op === 'neq';
  const label = lowerFirst(valueLabelForCode(filter.value, fieldMeta));
  return `${prefix}${fieldLabel} is ${negated ? 'not ' : ''}${label}`;
}

// One filter -> { provisionLabel, fieldLabel, opLabel, valueLabel, text }.
// `text` is the human sentence from sentenceForFilter() above — the
// "Deal type is All cash" / "Has force the vote" cadence from the spec, with
// the provision type as a scoping prefix since these filters are always
// provision-scoped. `fieldMeta` (optional) is the /api/query/field-options
// response for this filter's field — pass it when available for an exact
// phrasing; omitted, the sentence still reads naturally via the op/value
// heuristics in sentenceForFilter().
function describeFilter(filter, fieldMeta) {
  const provisionLabel = provisionTypeLabel(filter.provision_type);
  const fieldLabel = (fieldMeta && fieldMeta.label) || humanizeKey(filter.field);
  const opLabel = operatorLabel(filter.op);
  const valueLabel = formatFilterValue(filter.value);
  const text = sentenceForFilter(filter, fieldMeta);
  return { provisionLabel, fieldLabel, opLabel, valueLabel, text };
}

module.exports = {
  KIND_LABELS,
  KIND_DESCRIPTIONS,
  kindDisplayLabel,
  OPERATOR_LABELS,
  NUMERIC_TYPES,
  NUMERIC_QUANTIFIER_LABELS,
  operatorLabel,
  humanizeKey,
  provisionTypeLabel,
  lowerFirst,
  formatFilterValue,
  formatValueWithUnit,
  formatCurrencyCompact,
  valueLabelForCode,
  isBooleanFilter,
  isNumericFilter,
  sentenceForFilter,
  describeFilter,
};
