# Acceptance spec: serve NO_SHOP_INITIAL_MATCH_PERIOD_DAYS (D3, authorized)

Ben authorized this widening (DECISIONS 2026-07-23, D3). It is a
frozen-contract-adjacent change and gets the full review lane. Everything
lands flag-off; production behavior unchanged.

## Invariant that must hold (the whole safety case)

`FIXTURE_CONTRACT_FINGERPRINT` must NOT change: the metric already exists
in `METRIC_DEFINITIONS` and the fingerprint compiles from
`contract-bundle.js` inputs only. Therefore this diff may NOT touch
`lib/canonical-v2/contract-bundle.js`, `serving-projection.js`,
`shared-serving-row.js`, `market-cohort-query.js`, or any staging/
candidate/identity file. A new test pins the current fingerprint value
(read it at test time from a fixture-row's provenance — the Landos row's
`provenance.contract_fingerprint` — and assert equality with the live
compiled constant) so any accidental drift fails loudly.

## Changes

1. `lib/canonical-v2/query-result.js`:
   - new `NO_SHOP_INITIAL_MATCH_METRIC = 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS'`
     added to `QUERY_METRICS`;
   - `DEFAULT_COLUMNS` entry for it, modeled on the existing
     `NO_SHOP_NOTICE_METRIC` entry (day-value metric — reuse whatever
     column keys that metric already uses; invent none);
   - any `VALUE_LABELS`/column gating that the notice metric already has
     and this one needs identically. NOTHING else in the file changes.
2. `lib/canonical-v2/legacy-query-mapper.js`: second supported request.
   - Predicate: `kind === 'MARKET_RANGE'`, `provision_type ===
     'COVENANT_NO_SOLICITATION'`, `field_path` exactly
     `'initialMatchPeriodDays'` OR `'matching_rights_days'` (the
     registry alias — see `FIELD_ALIASES` in `lib/query/types.js:72`);
     same deal_filter rules as the fee slice; flag/savedQuery rules
     unchanged.
   - Mapped body: intent MARKET_RANGE, the new metric key, metric_version
     and concept_key read from the frozen definition (`NOSOL-MATCH`,
     version 1 — verify against `METRIC_DEFINITIONS`, do not hardcode
     without checking), `party` copied EXACTLY from the frozen reviewed
     no-shop slice's canonical_result.party for the NOSOL-MATCH concept
     (find it in `lib/canonical-v2/reviewed-qxo-*no-shop*` or the
     landos/qxo fixtures — quote the source in a comment; if no frozen
     row for NOSOL-MATCH exposes a party tuple, STOP and report instead
     of guessing), `column_filters: {}`, `selected_columns: null`,
     `page_size: 25`, `cursor: null`. Fee-specific refinement keys must
     NOT be offered for this metric (refinementOptionsFromView already
     derives from view metadata, so this should be automatic — add a test
     proving it).
   - Seller-fee routing must be bit-identical to before (existing tests
     unmodified and green).
3. `components/query/CanonicalMarketRange.jsx`: add the METRIC_LABELS
   entry (UI copy only): 'No-shop — initial match period (business days)'.

## Semantics note (record in the mapper comment)

Legacy `initialMatchPeriodDays` is labeled "Initial match period
(business days)" (`lib/schema/features.js:8255-8261`); the governed metric
is `DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE`. The label-level basis
agreement (business days) is the correspondence evidence
(`ANALYSIS-SLICE-4-FIELD-METRIC-CORRESPONDENCE-2026-07-23.md` §2); the
canonical rows carry their own precise basis so the rendered answer is
self-describing.

## Tests (extend existing canonical-v2 test files or add one new file)

1. Fingerprint pin: compiled `FIXTURE_CONTRACT_FINGERPRINT` equals the
   Landos fixture row's `provenance.contract_fingerprint` (guards against
   accidental contract drift from this or any future widening).
2. `QUERY_METRICS` contains exactly the 5 expected keys; the 4
   pre-existing metrics' DEFAULT_COLUMNS are deep-equal to before
   (pin them).
3. Mapper: both field_path spellings route; body passes the REAL
   `compileCanonicalActiveQueryRequest`; party matches the frozen slice
   tuple; fee requests still map exactly as before (existing tests
   untouched, still green).
4. Endpoint-level: a compile of the new metric request through
   `compileCanonicalActiveQueryRequest` succeeds and rejects fee-only
   column_filters (`fee_side` etc.) with INVALID_REQUEST for this metric.
5. refinementOptionsFromView on a synthetic view for this metric offers
   no fee-specific dropdowns.

## Battery

Post-commit: full `npm test`, `verify:codex-program` PASS (digest
unchanged), build, `git diff --check`, plus browser smokes: existing fee
smokes byte-identical; flag-on smoke of the new request path (intercepted
API acceptable) proving one canonical POST and legacy fallback for
non-exact shapes.

## Review gates (Fable)

Fingerprint unchanged; no touch to forbidden files; party tuple sourced
not invented (reject the diff if any party/concept value lacks a frozen-
file citation); seller-fee behavior byte-identical; flags off.
