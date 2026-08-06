# Fable analysis: legacy field ↔ governed metric correspondence (Slice 4)

Evidence-based correspondence review for routing further legacy ad hoc
queries to the canonical endpoint. Bar (from Slice 1): a mapping ships only
when the legacy request's meaning provably equals the governed metric's
frozen semantics. A plausible-but-wrong mapping silently answers a
different legal question than the user asked — worse than no mapping.

**Net result: zero of the three remaining `QUERY_METRICS` can be safely
mapped today.** Slice 4 as proposed is closed with documented evidence
rather than implemented. Detail below.

## 1. `NO_SHOP_NOTICE_PERIOD_DAYS` — REJECTED

- Governed semantics (frozen, `serving-projection.js`): duration in
  ELAPSED days, basis `DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL`.
- Legacy candidate `noticePeriod` (`lib/schema/features.js:11672`):
  label "Notice Period", unit "days", description literally "TODO" —
  neither the trigger (receipt of competing proposal? notice before board
  change? notice before termination?) nor the day basis
  (elapsed/business) is pinned. The serving registry marks it
  `benchmarkable: false`, and it applies across eight NOSOL provision
  codes, i.e. it is not specific to the NOSOL-NOTICE concept.
- Verdict: correspondence unprovable. Routing it would display precisely
  defined governed numbers for an imprecisely defined legacy question.

## 2. `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS` — closest match, but UNSERVABLE

- Legacy `initialMatchPeriodDays` ("Initial match period (business
  days)", aliased from `matching_rights_days` in `lib/query/types.js:72`)
  aligns well with the governed metric (BUSINESS days, trigger
  SUPERIOR_PROPOSAL_NOTICE) — the one genuinely promising pair.
- But `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS` is in `METRIC_DEFINITIONS` and
  NOT in `QUERY_METRICS` (`query-result.js:19-24`) — the endpoint refuses
  it. Widening the served metric set is a frozen-contract change
  (review-gated, not a UI slice). Parked with that dependency named; the
  residual question of whether legacy extraction reliably pinned the
  business-day basis would still need a data-level check before shipping.

## 3. `IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE` — NOTHING TO MAP

- Legacy has only booleans (`deal.ioc.category.capital_expenditures`,
  `deal.ioc.negativeCovenants.capex`). No legacy %-of-deal-value capex
  threshold field exists, so no legacy MARKET_RANGE request shape exists
  to intercept. Canonical-only UI entry for this metric would be NEW
  query-surface design, not interception — different slice class.

## 4. `MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE` — REJECTED

- Legacy `materialContractsDollarThresholds` is an ENUM of dollar
  thresholds; the governed metric is a continuous % of deal value with
  cash-flow-direction/scope refinements. Different scale (USD vs %),
  different shape (enum vs decimal). Not the same question.

## 5. `adviser_either`/`lawyer_either` ↔ legacy `law_firm`/`lawyer` — ONE QUESTION FOR BEN

- The governed cohort dimensions are `adviser_firms[]` and `lawyers[]`
  (`query-result.js:482-483`, matched by inclusion at :569-570). Their
  entity class is not pinned in any readable contract text, and every
  fixture carries empty arrays — I cannot prove whether `lawyers` holds
  individual names or firm names, nor whether `adviser_firms` means
  financial advisers exclusively.
- Unblocking is a one-line answer from Ben (or the writer definition):
  "`adviser_firms` = financial adviser firm names; `lawyers` = individual
  lawyer names / law firm names". With that, the mapping (or its
  rejection) is mechanical and I can ship it in a follow-up slice.

## Consequences

- The ad hoc canonical surface remains, correctly, seller termination fee
  only (plus Slice 2 refinements/pagination).
- Items for Ben, unchanged from the proposal, now sharpened: (a) the
  entity-class question above; (b) whether to authorise the
  frozen-contract widening that would make INITIAL_MATCH servable;
  (c) QXO freeze gate; (d) merge decision.
