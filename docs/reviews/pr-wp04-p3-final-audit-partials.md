# WP04 Phase 3: Final-audit PARTIALs

Base resolved at phase start: `origin/main` after PR #93 and PR #95 were merged.

## Audit Source

No standalone `final-audit` report exists in the repo. I searched the repo for `final-audit`, `audit-report`, `PARTIAL`, `material improvement`, `Standard not specified`, and related audit terms. The actionable source is the WP04 contract plus PR #91 / #92 bodies.

## PARTIAL List and Disposition

1. NOSOL material-improvement two-limb split point lands mid-clause.
   - Disposition: fixed.
   - Root cause: `superiorProposalLimbs` split on broad `and` patterns around value-language instead of anchoring on the deliverability clause. In unnumbered drafting, that could put the limb boundary inside the value limb.
   - Fix: split on the deliverability anchor (`reasonably likely to be completed/consummated`) and support deliverability-first drafting while always rendering Value limb first.

2. Skechers buyer-side bring-down: `Standard not specified`.
   - Disposition: already fixed by current `main` data/code after #93.
   - Live Skechers `COND-S-REP` now carries three `bringDownTiers`: MAE aggregate, all material respects, and de minimis.
   - The canonical Parent Reps Bring-Down row matches `COND-S-REP`, and `buildBringdownTierLines` renders the three standards.

3. Cosmetics from PR #92.
   - Disposition: already fixed by PR #92 and covered by existing tests.
   - Enumerated cosmetics: enum humanisation for `FIXED` / `MIXED_ELECTION`; Dividend Equivalence / Exchange-of-Certificates dedupe; go-shop period and negotiating-window units as days; Frustration banner fallback grammar; `DGCL` acronym casing; fee/expense section-ref fallback to `provision.section_number`.

4. Commitments `5.01(ii)` parser issue.
   - Disposition: handled separately in WP04 Phase 2 / PR #96.
   - Not part of this Phase 3 diff.

## Code Changes

- `components/review/table-logic.js`
  - Tightens `superiorProposalLimbs` so unnumbered material-improvement drafting splits at the deliverability anchor.
  - Preserves numbered `(i)` / `(ii)` handling.
  - Supports deliverability-first drafting by reordering to Value limb, then Deliverability limb.

- `tests/final-audit-partials.test.js`
  - Adds targeted coverage for the NOSOL split.
  - Proves Skechers buyer-side bring-down is represented by `COND-S-REP` tiers.
  - Pins already-fixed cosmetics at source/helper level.

## Verify

Targeted:

```text
node --test tests/final-audit-partials.test.js
tests 4
pass 4
fail 0
```

Full suite:

```text
npm test
tests 671
pass 671
fail 0
```

No Supabase writes were made. Corpus QA was not required for this phase.
