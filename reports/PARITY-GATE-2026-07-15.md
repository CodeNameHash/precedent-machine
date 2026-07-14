# M2 Parity Gate — formal run (2026-07-15)

**Verdict: PASS at the data level — zero unexplained content drops across all 40 deals.**

## Method
1. Corpus data-level sweep using the existing harness (`scripts/audit/schema-parity.js`
   compare functions) against the current post-rematerialize DB: 24,870 cells compared
   (12,553 legacy-derived / 12,317 schema-first) across 40 deals.
2. Raw diffs (541 legacy-only, 450 new-only, 118 short-title mismatches, 0 type
   mismatches) were then RECONCILED by content, because the harness pairs cells by
   excerpt key and the TASK 3 re-extraction re-carved excerpt boundaries corpus-wide:
   - 395/541 legacy-only cells are the identical content under a new excerpt key
     (verbatim or containment match against the new-only set);
   - 24/541 are partial re-carves (identical 120-char heads, different boundaries);
   - the remaining 122 were checked against the full provisions substrate in the live
     DB: **all 122 survive in provisions.full_text**. Zero legacy cells' content is
     absent from the current database.
3. Metsera detail: 301 legacy vs 302 schema cells, 289 clean-paired, every diff
   accounted for by re-keying (e.g. the COR cell "(e) Neither the Company Board…"
   appears verbatim as a new-keyed schema cell).

## What the diffs actually are
- **Re-keyed excerpts** (the dominant class): same clause text, new excerpt hash after
  re-extraction. Render-equivalent.
- **Relocated content**: clause text now lives in a different/larger provision carve
  (e.g. content that moved into the Intervening Event or Fiduciary Out rows during
  round-2 curation). Present in the substrate; rendered under the covering row.
- **Card-less rows**: content extracted into provisions that await cards (the counted
  M3 backlog, 20 mintable + 27 title-taken per the mint dry-run) — visible in data,
  not yet on the page. This is the ONLY class with a render gap, and it is already
  queued behind the Ben-gated mint apply.
- **Title churn** (118 cells): visible relabels (e.g. "Standstill Waiver /
  Don't-Ask-Don't-Waive" → "Enforcement of Standstills"), enumerated in the sweep data.

## Limitations
- **Render-level legacy comparison is impossible**: no pre-M2-00 commit exists in this
  repository's captured history (oldest commit already contains the schema-first path).
  Fallback references: `docs/audit/m2-09-legacy-inventory.md` and
  `docs/audit/legacy-layout-inventory.md`. The gate is therefore a data-level proof
  plus the live-page spot checks performed during the corpus rollout (pilots + Cooper
  Tire, Whole Foods, Red Hat, Concho, post-round-2 verifications).
- Worst-diff deal was Concho (67 raw diffs) — fully reconciled like the rest; its
  volume is explained by the reciprocal-deal re-carving and (Parent) scoping.

## Data
- `reports/parity-data-sweep-2026-07-15.md` / `.json` — per-deal tables and raw diffs.
- Reconciliation classification embedded in this run's method (step 2), reproducible
  from the JSON.

## M2 acceptance statement
The schema-first path renders from a substrate that contains 100% of the legacy
signal; no unexplained drops; additions (canonical pills, (Parent) scoping, Breach by
Representatives) are enumerated in the curation reports. Remaining render-side gap =
the counted card-less backlog (Ben-gated mint + M3). On that basis M2's parity bar is
met at the data level, with the render-level limitation stated above.
