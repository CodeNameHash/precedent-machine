# Acceptance spec: first feature-flagged Canonical Query UI path

Slice defined by `docs/handoffs/CANONICAL-V2-HANDOFF-2026-07-22.md` ("Next
bounded slice"). Governing programme: `docs/CODEX-PROGRAM.md`. This spec was
written before implementation and is the review baseline for the diff.

## Scope

One supported request only: an ad hoc `MARKET_RANGE` query for the seller
termination fee as a percentage of deal value. Everything else stays on the
legacy path, byte-for-byte unchanged in behaviour.

## New files

1. `lib/canonical-v2/legacy-query-mapper.js` — pure module, no imports from
   React/Next, no network. Exports:
   - `isSupportedCanonicalQuery(kind, payload, opts)` → boolean
   - `mapLegacyRequestToCanonical(payload)` → frozen canonical request body
2. `components/query/CanonicalMarketRange.jsx` — renders the canonical
   result view (see Rendering).
3. `tests/canonical-v2-legacy-query-mapper.test.js`
4. `tests/canonical-v2-query-ui-routing.test.js`

## Modified files (minimal diffs only)

- `lib/canonical-v2/feature-flags.js` — add
  `isCanonicalV2QueryUiEnabled(env = process.env)` reading
  `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED` via the existing `isEnabled`
  helper. Default OFF.
- `pages/query/[kind]/[id].js` — the single interception point (both
  builders navigate here). For the exact supported ad hoc request with the
  flag on: skip the `/api/query/run` fetch entirely (that is the legacy
  resolver preflight + execution), make exactly one POST to
  `/api/canonical-v2/query`, render `CanonicalMarketRange`.

No other file may change. Specifically forbidden: any change to
`lib/query/**` (legacy engine/resolver/executors), `pages/api/**`,
`lib/canonical-v2/query-result.js`, `shared-serving-row.js`,
`serving-projection.js`, `market-cohort-query.js`, any registry, any file
under `docs/codex-program/` (would break `verify:codex-program`), any
taxonomy/vocabulary value anywhere.

## Supported-request predicate (exact)

`isSupportedCanonicalQuery(kind, payload, { flagEnabled, savedQueryId })`
returns true iff ALL of:

- `flagEnabled === true` (caller passes the evaluated client flag);
- `savedQueryId` is absent/`'adhoc'` (saved queries always legacy);
- `kind === 'MARKET_RANGE'`;
- `payload.provision_type === 'TERMINATION_FEE'`;
- `payload.field_path === 'feePctOfDealValue'` (exact string — anything
  matching reverse, e.g. `reverseFeePctOfDealValue`, and any other field
  stays legacy: party specificity);
- every non-empty key of `payload.deal_filter` is in the cleanly-mappable
  set below. Presence of any other non-empty filter key (including
  `consideration_type`, `search`, `law_firm`, `lawyer`) → legacy. Values
  must be single scalars (or single-element arrays where the legacy shape
  is an array); multi-select values → legacy.

Cleanly-mappable `deal_filter` keys → canonical cohort `filters`:

| legacy key      | canonical filter key         |
|-----------------|------------------------------|
| `buyer`         | `buyer`                      |
| `sector`        | `sector`                     |
| `merger_form`   | `merger_form`                |
| `signing_year`  | `year_from` = `year_to` = Number(signing_year) |

`law_firm`/`lawyer` are NOT mapped in this slice: the governed cohort
vocabulary distinguishes `adviser_either`/`lawyer_either` and the legacy →
governed correspondence is a semantics call not yet made. Do not guess.

`chart_kind` is accepted and ignored for routing (any of the enum values).

## Mapper output (exact, pinned — no invention permitted)

```json
{
  "intent": "MARKET_RANGE",
  "metric_key": "SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE",
  "metric_version": 1,
  "concept_key": "TERMF-TARGET",
  "party": { "role": "FEE_PAYER", "value": "COMPANY", "capacity": "TARGET" },
  "filters": { /* only mapped keys, omit-null per market-cohort-query rules */ },
  "selected_columns": null,
  "column_filters": null,
  "page_size": 25,
  "cursor": null
}
```

Exactly the `LOGICAL_REQUEST_KEYS` set — never emit `serving_namespace_id`,
`corpus_release_id`, `contract_fingerprint`, or `release_selector` (the
ACTIVE route rejects them). Verify the exact null/omission convention for
`filters` against `compileMarketCohortRequest` in
`lib/canonical-v2/market-cohort-query.js` and match it.

## Review-accepted amendments (Fable review, same day)

1. `column_filters` is `{}`, not `null`: the frozen
   `compileCanonicalActiveQueryRequest` defaults only an OMITTED
   `column_filters` (unlike `selected_columns`, which treats `null` as
   default); an explicit `null` throws `INVALID_REQUEST`. `{}` is the shape
   the frozen contract's own test fixtures use.
2. `signing_year` must be integer-like or the request stays legacy — a
   hand-crafted payload URL must not spend the one canonical request on a
   guaranteed 400.
3. The routing helper (`runQueryRoute`) must never reject in canonical
   mode: a network-level fetch rejection (not a non-200) is the same safe
   error outcome, still with no legacy fallback.
4. The page may not import `lib/query/types.js` (transitively requires
   Node `fs`, unbundleable client-side); the slug→kind map is duplicated
   locally, following the existing `QueryFilterControls.jsx` precedent.

## One-request behaviour

- Exactly one POST to `/api/canonical-v2/query` per rendered query view. No
  retries on any failure class. No automatic fallback POST to
  `/api/query/run` after a canonical error (that would be a second request
  and would mask containment states). No pagination auto-follow;
  `next_cursor` presence renders as a "showing first N of total" notice
  only.
- When the canonical path is taken, the legacy fetch must not fire (assert
  in tests: zero calls to `/api/query/run`).

## Rendering (`CanonicalMarketRange`)

Render from `CANONICAL_QUERY_RESULT_VIEW/V1` only — no reshaping into the
legacy result contract, no reuse of the legacy `MarketRange` component:

- Header: metric label, party (payer capacity), `total_count`,
  `page_count`, and the release identity (`corpus_release_id` truncated,
  `contract_fingerprint` truncated) as provenance.
- Table: iterate `columns` for headers and `rows[].cells` for values.
  Percentage cells (`percent_of_deal_value`) are canonical decimal STRINGS
  denominated in percent (e.g. `"5.09090909"` means 5.09%): display
  rounded to 2dp with `%`; never divide by 100; never parseFloat for
  identity/keys — display only. `triggers` cells render each
  `{trigger_code, payment_timing}`; coded values render `label` when the
  view supplies one, else the code verbatim. Never invent display names
  for codes.
- Row-level isolation: a row whose cells throw during render must not
  suppress sibling rows (wrap per-row; render a per-row error cell).
- No client-side stats computation across rows (page ≠ cohort; fabricated
  stats over a partial page are a legal-accuracy failure). `total_count`
  is the only cohort-level number shown.

## Safe error rendering

Any non-200 from the canonical endpoint renders a contained error panel:
the governed `error` code (e.g. `FEATURE_DISABLED`, `AT_CAPACITY`,
`CIRCUIT_OPEN`, `INVALID_REQUEST`) and a neutral message. Never render raw
response bodies or messages as HTML; never echo request internals; no
retry button in this slice. Legacy path remains reachable by the user
turning the fee side to reverse or using any other query — do not offer an
automatic "run on legacy instead" action.

## Flag behaviour

- `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED` default OFF ⇒ zero behaviour
  change anywhere (routing predicate returns false before inspecting
  anything else; legacy path identical).
- Client flag ON but server `CANONICAL_V2_QUERY_ENABLED` OFF ⇒ the one
  canonical POST returns 503 `FEATURE_DISABLED` ⇒ safe error panel. This
  is acceptable and tested — flags are independent by design.
- Both flags remain OFF in production. Nothing in this diff sets either.

## Tests (all node:test + node:assert/strict, no new deps)

`tests/canonical-v2-legacy-query-mapper.test.js`:
1. Supported: exact request (empty filter) → true + pinned body above
   (deep-equal, including exact key set).
2. Party specificity: `reverseFeePctOfDealValue` → unsupported.
3. Other field (`companyTerminationFee`), other provision types, other
   kinds (`PROVISION_CROSS_CUT` etc.) → unsupported.
4. Filter mapping: buyer/sector/merger_form/signing_year map; signing_year
   sets year_from == year_to as integers.
5. Unsupported filter keys (`consideration_type`, `search`, `law_firm`,
   `lawyer`, unknown) or multi-select values → unsupported.
6. Flag off → unsupported even for the exact request.
7. Saved query id present → unsupported.
8. Mapper output passes `compileCanonicalActiveQueryRequest` (import the
   real compiler with the real metric definitions — proves vocabulary
   agreement with the frozen contract, no drift).
9. Mapper never emits release-pinned keys.

`tests/canonical-v2-query-ui-routing.test.js` (extract the page's routing
decision + fetch-target selection into a small pure helper if needed to
keep the page component thin — the helper may live in the mapper module):
1. Supported + flag on ⇒ canonical endpoint chosen, legacy fetch not
   called, exactly one POST body identical to mapper output.
2. Flag off ⇒ legacy fetch called, canonical not called.
3. Unsupported shape + flag on ⇒ legacy fetch called, canonical not.
4. Canonical 503 FEATURE_DISABLED ⇒ error state surfaced, no second
   request of any kind.
5. Percentage display formatting: `"5.09090909"` → `5.09%`; `"0"` → `0%`;
   no division by 100.
6. Row isolation: one malformed row does not prevent sibling row render
   (test the row-mapping function).

## Verification battery (all must pass before commit)

- `npm test` — full suite green (baseline 2,674 passing; new tests add to
  that; zero regressions).
- `npm run verify:codex-program` — must still pass (this diff must not
  touch the 4 governed spec docs).
- `npm run build` — green (only pre-existing warnings acceptable).
- `git diff --check` — clean.

## Review gates (Fable, against this spec)

- No dropped requirement, no scope-widening (extra metrics, reverse fee,
  saved-query routing, pagination following = reject).
- No taxonomy/vocabulary invention (every code in the diff must appear in
  the research-verified frozen contract files).
- Flags default off; no env file, no Vercel config, no prod exposure.
- Legacy path provably untouched when flag off.
