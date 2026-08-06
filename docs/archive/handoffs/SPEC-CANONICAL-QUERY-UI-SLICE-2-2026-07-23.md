# Acceptance spec: Slice 2 — governed refinements on the canonical result

Follows `PROPOSAL-CANONICAL-QUERY-UI-NEXT-SLICES-2026-07-23.md` (Slice 2)
and the completed Slice 1 (`SPEC-CANONICAL-QUERY-UI-SLICE-2026-07-22.md`).
Written before implementation; review baseline for the diff. Same
constraints: no new vocabulary, no taxonomy, no legacy-path changes, flags
unchanged (default OFF), no corpus writes, production untouched.

## Scope

When the canonical view is rendered (Slice 1 path, seller termination fee
only), let the user refine the SAME query with governed `column_filters`
and re-issue exactly ONE new bounded POST per explicit apply action.
Nothing else changes. Cursor pagination ("show more") is included ONLY as
defined below (it is one bounded follow-up request, same contract).

## Files

New:
- `tests/canonical-v2-query-refinements.test.js`

Modified (minimal diffs only):
- `lib/canonical-v2/legacy-query-mapper.js` — add pure helpers (see
  Contracts): `buildRefinedCanonicalRequest`, `refinementOptionsFromView`,
  `appendCanonicalPage`.
- `components/query/CanonicalMarketRange.jsx` — refinement controls +
  "Show more" button; presentation only, all logic in the pure helpers.
- `pages/query/[kind]/[id].js` — pass an `onRequest(body)` callback that
  reuses the existing `fetchCanonical`, enforces single-in-flight, and
  updates `canonicalView`/`canonicalError`. No change to the routing
  decision, the legacy path, or first-request behaviour.

Forbidden (same list as Slice 1): `lib/query/**`, `pages/api/**`,
`lib/canonical-v2/query-result.js` and every other frozen contract file,
`docs/codex-program/**`, any registry, any taxonomy value.

## Contracts (pure helpers — all in legacy-query-mapper.js)

### `buildRefinedCanonicalRequest(baseBody, columnFilters)`

- `baseBody` is the Slice 1 mapper output (or a previously refined body).
- `columnFilters`: object with ONLY these keys permitted (the fee-metric
  governed set, pinned from `normaliseColumnFilters` in the frozen
  compiler): `min_percent_of_deal_value`, `max_percent_of_deal_value`,
  `fee_side`, `payer_capacity`, `payee_capacity`, `trigger_code`,
  `payment_timing`, `trigger_condition`.
- Returns a frozen new body identical to `baseBody` except
  `column_filters` (only non-empty entries included; `{}` when none) and
  `cursor: null` (a refinement change always restarts the page sequence).
- Client-side pre-validation mirrors (never replaces) the server rules:
  percent bounds must match `/^(0|[1-9]\d*)(\.\d+)?$/`; when both present
  min <= max (numeric compare is fine client-side; server remains
  authoritative); text values must be non-empty strings. On any invalid
  input the helper THROWS a plain Error — the caller must not send a
  request (an invalid refinement never spends a POST).
- Unknown keys throw. The helper never invents or completes values.

### `refinementOptionsFromView(view)`

- Source of dropdown values: ONLY codes actually present in the current
  page's rows (`rows[].cells.fee_side.code`, `rows[].cells.triggers[]`
  entries' `trigger_code`/`payment_timing`, payer/payee capacities) plus
  `view.refinements`/`view.columns` metadata for which controls to show.
  NO hardcoded vocabulary lists anywhere — if a code is not visible in
  the data or the view metadata, it is not offered. (Free-text entry is
  NOT offered in this slice.)
- Percent bounds are free numeric inputs (strings), validated as above.
- Returns `{column_key, label, values[]}` entries; deduplicated, sorted.

### `appendCanonicalPage(existingView, nextView)`

- For "Show more": returns a frozen view whose `rows` are
  `existingView.rows` followed by `nextView.rows` (no dedup logic beyond
  dropping any `nextView` row whose `row_serving_key` already exists),
  with `next_cursor`, `total_count`, `page_count` taken from `nextView`
  (`page_count` may instead be the combined rendered-row count ONLY if
  clearly labelled as "showing N"). Identity fields (`corpus_release_id`,
  `contract_fingerprint`) must be EQUAL between the two views; on any
  mismatch it throws — a release change mid-pagination must surface as
  the safe error, never a silently mixed result set.

## One-request behaviour (extended)

- Exactly one POST per explicit user action (Apply refinements / Show
  more / Clear). No auto-fire on keystroke or dropdown change — only on
  an explicit apply control. No retries, no legacy fallback, ever.
- Single-in-flight: while a canonical request is pending, apply/show-more
  controls are disabled; a second action cannot start until the first
  resolves.
- "Show more" sends the CURRENT refined body with
  `cursor: view.next_cursor` (exact `{governed_deal_key,
  row_serving_key}` object, untouched).
- A refinement error (non-200 or rejection) renders the existing safe
  error panel WITH the previous view's controls preserved so the user can
  correct; a show-more error preserves already-rendered rows.

## Rendering

- Controls appear only when the canonical view is present; styling
  follows the existing component. Each active filter shows as a removable
  chip; Clear resets to the base body ({} filters) with one POST.
- Everything else from Slice 1 rendering rules holds unchanged (no
  client-side cohort stats, row isolation, coded values verbatim).

## Tests (node:test, no new deps) — tests/canonical-v2-query-refinements.test.js

1. `buildRefinedCanonicalRequest`: valid text filters produce the exact
   body (deep-equal, frozen, cursor reset to null, base body unmutated).
2. Percent bounds: valid decimal strings pass; `min > max` throws;
   non-canonical strings (`'5.'`, `'abc'`, `'-1'`, `'05'`) throw; nothing
   is sent on throw (assert via caller harness).
3. Unknown keys and non-fee keys (`criterion_code`, etc.) throw.
4. Refined body passes the REAL `compileCanonicalActiveQueryRequest`
   (vocabulary agreement, no drift).
5. `refinementOptionsFromView`: options come only from view rows/metadata
   (build the view from the Landos fixture through the real pipeline as
   in tests/canonical-v2-query-result.test.js); a code absent from the
   view is absent from options; dedup + sort proven.
6. `appendCanonicalPage`: rows append, duplicate row_serving_key dropped,
   next_cursor/total_count from the second view; identity mismatch
   throws.
7. Single-request discipline at the helper level: a state harness proving
   apply → one call; pending → second apply is a no-op; error preserves
   prior view object.

## Verification battery (unchanged)

`npm test` green (zero regressions), `npm run verify:codex-program` PASS,
`npm run build` clean, `git diff --check` clean, plus the browser smokes:
Slice 1 smokes must still pass byte-identically (flag off pure legacy;
flag on one POST), and a new happy-path smoke step: apply a `fee_side`
refinement in the browser (intercepted API), assert a second POST whose
`column_filters` equals the governed selection and cursor is null.

## Review gates (Fable)

Same as Slice 1, plus: no hardcoded vocabulary lists in the diff; no
auto-fire requests; identity-mismatch safety proven; the base
(unrefined) request byte-identical to Slice 1's mapper output.
