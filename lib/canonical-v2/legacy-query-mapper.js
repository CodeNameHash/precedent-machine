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

// Slice 2 (2026-07-23): the governed `column_filters` keys this metric's
// refinement controls are ever allowed to touch — pinned directly from
// `normaliseColumnFilters`'s `feeKeys` list plus the two percent-bound keys
// (lib/canonical-v2/query-result.js, frozen, not exported). This is a
// structural key-name pin, not a value vocabulary: no code/label ever
// invented here, only the field NAMES the frozen compiler already accepts
// for the seller termination fee metric.
const REFINEMENT_COLUMN_FILTER_KEYS = Object.freeze([
  'min_percent_of_deal_value',
  'max_percent_of_deal_value',
  'fee_side',
  'payer_capacity',
  'payee_capacity',
  'trigger_code',
  'payment_timing',
  'trigger_condition',
]);
const PERCENT_DECIMAL_RE = /^(0|[1-9]\d*)(\.\d+)?$/;

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

// ── Slice 2 (2026-07-23): governed refinements on the canonical result ─────
// Pure helpers only — the component calls these to build the exact request
// body it hands to `onRequest`; nothing here touches the network or React.

// Mirrors (never replaces) `compareDecimals` in lib/canonical-v2/
// query-result.js (frozen, not exported) — this is client-side
// pre-validation only, the server compiler remains authoritative. Both
// inputs are already known to match PERCENT_DECIMAL_RE by the time this is
// called.
function compareDecimalStrings(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftScaled = BigInt(`${leftInteger}${leftFraction.padEnd(scale, '0')}`);
  const rightScaled = BigInt(`${rightInteger}${rightFraction.padEnd(scale, '0')}`);
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

// `baseBody` is the Slice 1 mapper output, or a previously refined body (both
// carry the same LOGICAL_REQUEST_KEYS shape) — this never inspects which one
// it got, it only ever overwrites `column_filters`/`cursor`, so the deal-
// level `filters` a user set on the original ad hoc query survive every
// refinement untouched. Throws a plain Error (never sends a request) on any
// unknown key or invalid value; the caller must not call onRequest when this
// throws.
function buildRefinedCanonicalRequest(baseBody, columnFilters) {
  if (!baseBody || typeof baseBody !== 'object' || Array.isArray(baseBody)) {
    throw new Error('baseBody must be an object.');
  }
  if (!columnFilters || typeof columnFilters !== 'object' || Array.isArray(columnFilters)) {
    throw new Error('columnFilters must be an object.');
  }
  const unknown = Object.keys(columnFilters).filter((key) => !REFINEMENT_COLUMN_FILTER_KEYS.includes(key));
  if (unknown.length) throw new Error(`Unsupported column filter keys: ${unknown.sort().join(', ')}.`);

  const next = {};
  for (const key of REFINEMENT_COLUMN_FILTER_KEYS) {
    const value = columnFilters[key];
    if (value === undefined || value === null || value === '') continue; // omitted -> not sent, never invented
    if (key === 'min_percent_of_deal_value' || key === 'max_percent_of_deal_value') {
      if (typeof value !== 'string' || !PERCENT_DECIMAL_RE.test(value)) {
        throw new Error(`${key} must be a non-negative canonical decimal string.`);
      }
    } else if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${key} must be a non-empty string.`);
    }
    next[key] = value;
  }
  if (next.min_percent_of_deal_value !== undefined && next.max_percent_of_deal_value !== undefined
    && compareDecimalStrings(next.min_percent_of_deal_value, next.max_percent_of_deal_value) > 0) {
    throw new Error('min_percent_of_deal_value cannot exceed max_percent_of_deal_value.');
  }

  return Object.freeze({
    ...baseBody,
    column_filters: Object.freeze(next),
    cursor: null, // a refinement change always restarts the page sequence
  });
}

// Turns a governed column_filters key into plain UI copy mechanically (no
// per-code lookup table) — e.g. 'trigger_code' -> 'Trigger Code'. Safe to
// hardcode the transform (not a vocabulary): it never depends on, or
// invents, any CODE VALUE, only reshapes the field name itself.
function humanizeRefinementLabel(key) {
  return key.split('_').map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word)).join(' ');
}

// The refinement operators that describe a discrete coded control (a
// dropdown) as opposed to a BETWEEN range (the two free-text percent
// inputs, handled separately by the component). This distinguishes control
// SHAPES from the frozen contract's own operator vocabulary — it is not a
// value list.
const CODED_REFINEMENT_OPERATORS = new Set(['EQ', 'CONTAINS']);
const REQUEST_FIELD_PREFIX = 'column_filters.';

// Every value a given governed column-filter key could be set to, read
// straight off the current page's rows (never off a hardcoded list).
function valuesForRefinementKey(rows, filterKey) {
  const values = new Set();
  for (const row of rows) {
    const cells = row && row.cells;
    if (!cells) continue;
    if (filterKey === 'fee_side') {
      if (cells.fee_side && cells.fee_side.code) values.add(cells.fee_side.code);
      continue;
    }
    if (filterKey === 'payer_capacity') {
      if (cells.payer && cells.payer.capacity) values.add(cells.payer.capacity);
      continue;
    }
    if (filterKey === 'payee_capacity') {
      if (cells.payee && cells.payee.capacity) values.add(cells.payee.capacity);
      continue;
    }
    const triggers = Array.isArray(cells.triggers) ? cells.triggers : [];
    for (const trigger of triggers) {
      if (!trigger || typeof trigger !== 'object') continue;
      if (filterKey === 'trigger_code' && trigger.trigger_code) values.add(trigger.trigger_code);
      if (filterKey === 'payment_timing' && trigger.payment_timing) values.add(trigger.payment_timing);
      if (filterKey === 'trigger_condition' && Array.isArray(trigger.conditions)) {
        for (const condition of trigger.conditions) {
          if (condition) values.add(condition);
        }
      }
    }
  }
  return [...values].sort();
}

// Dropdown controls to offer, sourced ONLY from the view itself: WHICH
// controls to show comes from `view.refinements` (the frozen contract's own
// per-request metadata — a column not requested/governed for this metric
// simply never appears there), and every value inside each control comes
// only from `view.rows` (a code the current page never returned is never
// offered). No hardcoded vocabulary list anywhere in this function. Percent
// bounds are deliberately excluded (BETWEEN, not a coded control) — the
// component renders those as two free numeric inputs instead.
function refinementOptionsFromView(view) {
  if (!view || typeof view !== 'object') return [];
  const refinements = Array.isArray(view.refinements) ? view.refinements : [];
  const rows = Array.isArray(view.rows) ? view.rows : [];
  const seen = new Set();
  const options = [];
  for (const refinement of refinements) {
    if (!refinement || typeof refinement.request_field !== 'string') continue;
    if (!CODED_REFINEMENT_OPERATORS.has(refinement.operator)) continue;
    if (!refinement.request_field.startsWith(REQUEST_FIELD_PREFIX)) continue;
    const filterKey = refinement.request_field.slice(REQUEST_FIELD_PREFIX.length);
    if (!REFINEMENT_COLUMN_FILTER_KEYS.includes(filterKey) || seen.has(filterKey)) continue;
    seen.add(filterKey);
    options.push(Object.freeze({
      column_key: filterKey,
      label: humanizeRefinementLabel(filterKey),
      values: Object.freeze(valuesForRefinementKey(rows, filterKey)),
    }));
  }
  return Object.freeze(options);
}

// "Show more": appends nextView's rows after existingView's, dropping any
// nextView row whose row_serving_key already appears (defence in depth —
// the server's own keyset ordering should never repeat one, but a client
// that already rendered a row must never render it twice). next_cursor/
// total_count/page_count come from nextView, the page actually fetched.
// Identity (corpus_release_id, contract_fingerprint) must match between the
// two views — a release change mid-pagination throws rather than silently
// mixing rows from two releases.
function appendCanonicalPage(existingView, nextView) {
  if (!existingView || typeof existingView !== 'object') throw new Error('existingView must be an object.');
  if (!nextView || typeof nextView !== 'object') throw new Error('nextView must be an object.');
  if (existingView.corpus_release_id !== nextView.corpus_release_id
    || existingView.contract_fingerprint !== nextView.contract_fingerprint) {
    throw new Error('Cannot append a canonical query page from a different corpus release or contract fingerprint.');
  }
  const existingRows = Array.isArray(existingView.rows) ? existingView.rows : [];
  const nextRows = Array.isArray(nextView.rows) ? nextView.rows : [];
  const existingKeys = new Set(existingRows.map((row) => row && row.row_serving_key));
  const appended = nextRows.filter((row) => !(row && existingKeys.has(row.row_serving_key)));
  return Object.freeze({
    ...existingView,
    rows: Object.freeze([...existingRows, ...appended]),
    next_cursor: nextView.next_cursor ? { ...nextView.next_cursor } : null,
    total_count: nextView.total_count,
    page_count: nextView.page_count,
  });
}

// The append-vs-replace decision, isolated as its own pure, trivially
// unit-testable function: a refinement/Clear response REPLACES the view
// (it is a new page-1 result for a changed query); a Show more response
// APPENDS onto the view already on screen. Kept separate from the
// network-calling helper below so this decision itself never needs a fetch
// fake to test.
function resolveCanonicalQueryPageUpdate(isShowMore, existingView, nextView) {
  return isShowMore ? appendCanonicalPage(existingView, nextView) : nextView;
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

// fetchCanonical can REJECT outright (browser fetch throws on a
// network-level failure — that is not a non-200 status). This must never
// reject: an unhandled rejection in the page would leave the user stuck
// with no error state. A rejection is the same safe-error outcome as a
// non-200, and never falls back to a legacy fetch. Shared by runQueryRoute
// (the first request) and runCanonicalRefinementRequest (Slice 2's
// refinement/show-more requests) so the one-request error shaping never
// drifts between the two call sites.
async function fetchCanonicalOutcome(fetchCanonical, body) {
  let status = null;
  let json = null;
  try {
    ({ status, json } = await fetchCanonical(body));
  } catch {
    status = null;
    json = null;
  }
  if (status === 200) return Object.freeze({ ok: true, view: json });
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: (json && json.error && json.error.code) || 'DATA_SOURCE_ERROR',
      message: 'This query could not be run on Canonical Query right now.',
    }),
  });
}

async function runQueryRoute({
  kind, payload, savedQueryId, flagEnabled, fetchCanonical, fetchLegacy,
}) {
  const plan = await planCanonicalQueryRoute({
    kind, payload, savedQueryId, flagEnabled,
  });
  if (plan.mode === 'canonical') {
    const outcome = await fetchCanonicalOutcome(fetchCanonical, plan.body);
    if (outcome.ok) return Object.freeze({ mode: 'canonical', ok: true, view: outcome.view });
    return Object.freeze({ mode: 'canonical', ok: false, error: outcome.error });
  }
  const result = await fetchLegacy();
  return Object.freeze({ mode: 'legacy', ok: true, result });
}

// Slice 2: one bounded POST for an explicit Apply/Clear/chip-removal/Show
// more action. Reuses the exact fetchCanonical wrapper the page already
// built for the first request (same one-POST discipline, same never-reject
// contract as runQueryRoute above) — this never touches fetchLegacy, it
// only ever runs once a canonical view is already on screen. The single-
// in-flight guard itself is the caller's responsibility (this only ever
// issues the one fetch it's asked for); see pages/query/[kind]/[id].js.
async function runCanonicalRefinementRequest({
  fetchCanonical, body, isShowMore, existingView,
}) {
  const outcome = await fetchCanonicalOutcome(fetchCanonical, body);
  if (!outcome.ok) return Object.freeze({ ok: false, error: outcome.error });
  try {
    return Object.freeze({ ok: true, view: resolveCanonicalQueryPageUpdate(isShowMore, existingView, outcome.view) });
  } catch {
    // A show-more identity mismatch (appendCanonicalPage's own safety
    // throw) must surface as the same safe, contained error panel as any
    // other canonical failure — never an uncaught exception in the page.
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'INVALID_RESPONSE', message: 'This query could not be run on Canonical Query right now.' }),
    });
  }
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
  REFINEMENT_COLUMN_FILTER_KEYS,
  isSupportedCanonicalQuery,
  mapLegacyRequestToCanonical,
  planCanonicalQueryRoute,
  runQueryRoute,
  formatPercentOfDealValue,
  formatCellValue,
  mapCanonicalRowForRender,
  buildRefinedCanonicalRequest,
  refinementOptionsFromView,
  appendCanonicalPage,
  resolveCanonicalQueryPageUpdate,
  runCanonicalRefinementRequest,
  humanizeRefinementLabel,
};
