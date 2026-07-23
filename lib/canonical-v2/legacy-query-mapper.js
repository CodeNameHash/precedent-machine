// Canonical Query UI slice (2026-07-22): the single interception point
// between the legacy ad hoc query builders (pages/query/index.js,
// components/query/QueryLaunchBox.jsx — both navigate to
// /query/<slug>/adhoc?payload=<base64url>) and the frozen canonical Query
// contract (lib/canonical-v2/query-result.js, lib/canonical-v2/
// market-cohort-query.js). Pure module: no React/Next imports, no network
// calls. Everything here is deliberately narrow — ONE supported request
// shape (see docs/handoffs/SPEC-CANONICAL-QUERY-UI-SLICE-2026-07-22.md) —
// every other legacy request must keep running on the legacy engine
// untouched.

// Only these legacy deal_filter keys have an agreed, governed correspondence
// to a canonical cohort filter in this slice. law_firm/lawyer are
// deliberately excluded — the governed vocabulary splits adviser/lawyer into
// adviser_either/lawyer_either and nobody has made the legacy -> governed
// correspondence call yet (see the spec). consideration_type/search have no
// canonical cohort equivalent at all. Presence of any of those (or any
// unknown key) with a non-empty value routes to legacy.
const MAPPABLE_FILTER_KEYS = new Set(['buyer', 'sector', 'merger_form', 'signing_year']);

// The exact governed metric/party pair this slice supports — pulled from the
// frozen contract files named in the spec (lib/canonical-v2/
// serving-projection.js METRIC_DEFINITIONS, lib/canonical-v2/
// reviewed-termination-fee-slice.js), never invented here.
const SUPPORTED_METRIC_KEY = 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE';
const SUPPORTED_METRIC_VERSION = 1;
const SUPPORTED_CONCEPT_KEY = 'TERMF-TARGET';
const SUPPORTED_PARTY = Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
const SUPPORTED_PAGE_SIZE = 25;
const CANONICAL_QUERY_ENDPOINT = '/api/canonical-v2/query';

function isNonEmptyFilterValue(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// The legacy deal_filter shape carries some values as bare scalars and some
// (buyer, sector, merger_form, signing_year — see buildDealFilterPayload in
// components/query/QueryFilterControls.jsx) as single-element arrays. A
// multi-select (length > 1) has no single canonical filter value to map to
// and must stay on the legacy path rather than silently picking one entry.
function isSingleScalarValue(value) {
  if (Array.isArray(value)) return value.length === 1;
  return true;
}

function extractScalar(value) {
  return Array.isArray(value) ? value[0] : value;
}

// Exact predicate from the spec. `opts.flagEnabled` is the ALREADY-EVALUATED
// client flag (the caller reads NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED via
// isCanonicalV2QueryUiEnabled and passes the boolean in) — this module never
// reads env vars itself, keeping it pure and trivially testable.
function isSupportedCanonicalQuery(kind, payload, opts = {}) {
  const { flagEnabled, savedQueryId } = opts;
  if (flagEnabled !== true) return false;
  if (savedQueryId !== undefined && savedQueryId !== null && savedQueryId !== 'adhoc') return false;
  if (kind !== 'MARKET_RANGE') return false;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.provision_type !== 'TERMINATION_FEE') return false;
  // Exact string match only — reverseFeePctOfDealValue (or any other field)
  // is a different party/legal side and stays legacy (see spec: "party
  // specificity").
  if (payload.field_path !== 'feePctOfDealValue') return false;
  const dealFilter = payload.deal_filter;
  if (dealFilter !== undefined && dealFilter !== null) {
    if (typeof dealFilter !== 'object' || Array.isArray(dealFilter)) return false;
    for (const [key, value] of Object.entries(dealFilter)) {
      if (!isNonEmptyFilterValue(value)) continue;
      if (!MAPPABLE_FILTER_KEYS.has(key)) return false;
      if (!isSingleScalarValue(value)) return false;
      // signing_year must be cleanly mappable to the governed integer
      // year_from/year_to pair. A non-integer year (possible via a hand-
      // crafted payload URL) stays legacy instead of spending the one
      // canonical request on a guaranteed INVALID_REQUEST.
      if (key === 'signing_year' && !Number.isInteger(Number(extractScalar(value)))) return false;
    }
  }
  return true;
}

// Maps an already-confirmed-supported legacy payload to the exact,
// pinned canonical ACTIVE query request body (LOGICAL_REQUEST_KEYS from
// lib/canonical-v2/query-result.js — never serving_namespace_id /
// corpus_release_id / contract_fingerprint / release_selector, which the
// ACTIVE route rejects outright). Filters follow market-cohort-query.js's
// own omit-null convention: only mapped, present keys are included, nothing
// else — compileMarketCohortRequest fills every omitted key in as null.
function mapLegacyRequestToCanonical(payload) {
  const dealFilter = (payload && payload.deal_filter) || {};
  const filters = {};
  if (isNonEmptyFilterValue(dealFilter.buyer)) filters.buyer = extractScalar(dealFilter.buyer);
  if (isNonEmptyFilterValue(dealFilter.sector)) filters.sector = extractScalar(dealFilter.sector);
  if (isNonEmptyFilterValue(dealFilter.merger_form)) filters.merger_form = extractScalar(dealFilter.merger_form);
  if (isNonEmptyFilterValue(dealFilter.signing_year)) {
    const year = Number(extractScalar(dealFilter.signing_year));
    filters.year_from = year;
    filters.year_to = year;
  }
  return Object.freeze({
    intent: 'MARKET_RANGE',
    metric_key: SUPPORTED_METRIC_KEY,
    metric_version: SUPPORTED_METRIC_VERSION,
    concept_key: SUPPORTED_CONCEPT_KEY,
    party: Object.freeze({ ...SUPPORTED_PARTY }),
    filters: Object.freeze(filters),
    selected_columns: null,
    // NOTE (deviation, documented in the handoff): the spec's pinned example
    // shows `column_filters: null`, mirroring `selected_columns: null`. They
    // are NOT equivalent against the frozen contract — query-result.js's
    // normaliseColumns() explicitly treats `columns == null` as "use the
    // default", but normaliseColumnFilters(filters = {}, ...) only applies
    // its default for an OMITTED (`undefined`) argument; an explicit `null`
    // fails `!filters` and throws INVALID_REQUEST. Verified directly against
    // compileCanonicalActiveQueryRequest. `{}` is what query-api-handler and
    // query-result's own existing test fixtures already send for this field
    // on this exact contract, so this is the established shape, not an
    // invented one.
    column_filters: Object.freeze({}),
    page_size: SUPPORTED_PAGE_SIZE,
    cursor: null,
  });
}

// ── Routing/fetch-target selection (page helper) ────────────────────────────
// Extracted out of pages/query/[kind]/[id].js so the one-request behaviour
// (exactly one POST, no fallback, no retry) is unit-testable without a
// React/JSX runtime. `fetchCanonical(body)` and `fetchLegacy()` are injected
// by the caller (real fetch() wrappers in the page, fakes in tests) — this
// function only ever calls ONE of them, exactly once, and never falls back
// from a canonical error to the legacy fetch (that would be a second request
// and would mask a containment state — see the spec's "one-request
// behaviour" section).
async function planCanonicalQueryRoute({ kind, payload, savedQueryId, flagEnabled }) {
  if (isSupportedCanonicalQuery(kind, payload, { flagEnabled, savedQueryId })) {
    return Object.freeze({
      mode: 'canonical',
      url: CANONICAL_QUERY_ENDPOINT,
      body: mapLegacyRequestToCanonical(payload),
    });
  }
  return Object.freeze({ mode: 'legacy' });
}

async function runQueryRoute({
  kind, payload, savedQueryId, flagEnabled, fetchCanonical, fetchLegacy,
}) {
  const plan = await planCanonicalQueryRoute({
    kind, payload, savedQueryId, flagEnabled,
  });
  if (plan.mode === 'canonical') {
    // fetchCanonical can REJECT outright (browser fetch throws on a
    // network-level failure — that is not a non-200 status). This function
    // must never reject in canonical mode: an unhandled rejection in the
    // page would leave the user stuck on "Loading query…" with no error
    // state. A rejection is the same safe-error outcome as a non-200, and
    // still never falls back to the legacy fetch.
    let status = null;
    let json = null;
    try {
      ({ status, json } = await fetchCanonical(plan.body));
    } catch {
      status = null;
      json = null;
    }
    if (status === 200) {
      return Object.freeze({ mode: 'canonical', ok: true, view: json });
    }
    return Object.freeze({
      mode: 'canonical',
      ok: false,
      error: Object.freeze({
        code: (json && json.error && json.error.code) || 'DATA_SOURCE_ERROR',
        message: 'This query could not be run on Canonical Query right now.',
      }),
    });
  }
  const result = await fetchLegacy();
  return Object.freeze({ mode: 'legacy', ok: true, result });
}

// ── Rendering helpers (pure — CanonicalMarketRange.jsx composes these) ─────

// Percentage cells are canonical decimal STRINGS denominated in percent
// (e.g. "5.09090909" means 5.09%) — never divide by 100. Rounds to 2dp and
// trims a trailing ".00"/trailing zero, matching the existing round() helper
// in pages/query/[kind]/[id].js so the two query surfaces don't grow two
// independent rounding rules.
function formatPercentOfDealValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const fixed = num.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${fixed}%`;
}

function formatTriggerCell(trigger) {
  if (!trigger || typeof trigger !== 'object') throw new TypeError('triggers[] entry must be an object');
  if (!trigger.trigger_code) throw new TypeError('triggers[] entry is missing trigger_code');
  return trigger.payment_timing ? `${trigger.trigger_code} — ${trigger.payment_timing}` : trigger.trigger_code;
}

// One cell's display value for a given governed column_key. Coded values
// ({code, label}) render `label` when the view supplies one, else the code
// verbatim — never an invented display name. Party-shaped cells (payer/
// payee: {role, value, capacity}) render their value/capacity verbatim.
// Anything else falls back to String(value); an unrecognised object shape
// throws so the caller's per-row isolation can catch it rather than render
// "[object Object]".
function formatCellValue(columnKey, value) {
  if (value === null || value === undefined) return '—';
  if (columnKey === 'percent_of_deal_value') {
    return formatPercentOfDealValue(value) ?? '—';
  }
  if (columnKey === 'triggers') {
    if (!Array.isArray(value)) throw new TypeError('triggers cell must be an array');
    return value.map(formatTriggerCell);
  }
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'code')) return value.label || value.code;
    if (Object.prototype.hasOwnProperty.call(value, 'role') && Object.prototype.hasOwnProperty.call(value, 'capacity')) {
      return `${value.value} (${value.capacity})`;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'detail_kind')) return value.detail_kind;
    throw new TypeError(`Unhandled cell shape for column ${columnKey}`);
  }
  return String(value);
}

// Row-level isolation: a malformed row's cells must never suppress sibling
// rows. Renders every column for one row and, on ANY failure, returns a
// per-row error marker instead of throwing out of the map — the caller
// (CanonicalMarketRange) can then render a per-row error cell and keep going.
function mapCanonicalRowForRender(row, columns) {
  const columnKeys = (columns || []).map((column) => column.column_key);
  try {
    if (!row || typeof row !== 'object') throw new TypeError('row must be an object');
    const cells = columnKeys.map((key) => ({
      column_key: key,
      display: formatCellValue(key, row.cells ? row.cells[key] : undefined),
    }));
    return Object.freeze({
      row_serving_key: row.row_serving_key,
      governed_deal_key: row.governed_deal_key,
      cells,
      error: null,
    });
  } catch {
    return Object.freeze({
      row_serving_key: (row && row.row_serving_key) || null,
      governed_deal_key: (row && row.governed_deal_key) || null,
      cells: [],
      error: 'This row could not be displayed.',
    });
  }
}

module.exports = {
  CANONICAL_QUERY_ENDPOINT,
  MAPPABLE_FILTER_KEYS,
  isSupportedCanonicalQuery,
  mapLegacyRequestToCanonical,
  planCanonicalQueryRoute,
  runQueryRoute,
  formatPercentOfDealValue,
  formatCellValue,
  mapCanonicalRowForRender,
};
