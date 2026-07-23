# Proposal: next bounded canonical Query UI slices (needs Ben's approval)

Status: PROPOSAL ONLY — nothing here is implemented. Per the programme,
slice selection and every semantics call below is Ben's. The completed
first slice is recorded in `HANDOFF-CANONICAL-QUERY-UI-2026-07-23.md`.

## Candidate slices, in recommended order

### Slice 2 (recommended next): governed refinements on the canonical result

The query response already returns `refinements` metadata (fee_side,
percent-of-deal-value bounds, trigger_code, payment_timing,
trigger_condition, payer/payee capacity) — all frozen `column_filters`
vocabulary. Add refinement controls to `CanonicalMarketRange` that
re-issue exactly ONE new bounded POST per user action with the chosen
governed `column_filters`. No new vocabulary, no new metrics, no legacy
changes. Same watchdog pipeline as slice 1 (spec → cheap production →
Fable review → battery → browser smoke).

- Bounded: one endpoint, one component, mapper untouched except passing
  through `column_filters` built from a governed picker.
- Risk: low — every filter value is validated server-side by the frozen
  compiler anyway.

### Slice 3: cursor pagination ("show more")

Follow `next_cursor` with one additional bounded request per explicit
user click, appending rows with the same row-isolation rules. Trivial
scope; could be folded into Slice 2.

### Slice 4: remaining governed metrics on the ad hoc path

`QUERY_METRICS` already freezes three more metrics:
`NO_SHOP_NOTICE_PERIOD_DAYS`, `IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE`,
`MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE`. Each needs
one legacy `field_path` → metric mapping decision (a legal-semantics call:
which legacy field, if any, corresponds to each governed metric — wrong
correspondence is the plausible-but-wrong failure class). Propose: Ben (or
Fable with Ben sign-off) pins the three mappings in the spec before any
implementation; unmappable ones simply stay legacy.

### Explicitly NOT proposed (blocked on upstream decisions)

- Reverse/buyer termination fee: no governed metric exists in
  `METRIC_DEFINITIONS` — needs a new metric definition (legal-semantic,
  review-gated) and possibly the QXO freeze-gate taxonomy work first.
- `law_firm`/`lawyer` filter mapping: the `adviser_either`/`lawyer_either`
  correspondence is an unmade semantics call (carried from slice 1).
- Saved queries on canonical: needs a design decision about payload
  stamping/validation because saved payloads validate through the legacy
  engine at save time.

## Decisions needed from Ben (the hard gate)

1. Approve/adjust the slice order above (or name different work).
2. `adviser_either`/`lawyer_either` ↔ legacy `law_firm`/`lawyer` mapping —
   decide or defer.
3. Slice 4 field-path↔metric correspondences — decide, delegate to a
   Fable-reviewed spec, or defer.
4. QXO termination taxonomy Freeze Gate — unchanged, pending, yours.
5. Staging live-path test of slice 1 (optional): set
   `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED`,
   `CANONICAL_V2_QUERY_ENABLED` and the staging serving-role connection
   string in the Vercel PREVIEW environment only (never production) for
   the branch preview — the serving credentials never enter this repo or
   a remote session.
6. Merge decision for `claude/persistent-sessions-infrastructure-u10wiz`
   (3 commits, previews build READY, production untouched).
