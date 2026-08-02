# Open-world adjudication — Ben's rulings (2026-08-02)

Source material: `docs/handoffs/OPEN-WORLD-COMMONALITY-2026-08-02.md`
(first-cut commonality report over the 136 open-world candidates in the
three committed live-run fixtures). Rulings delivered via the
adjudication artifact, recorded verbatim.

| Cluster | Ruling | Note |
|---|---|---|
| C1+C9 (share-count assertions, all 3 deals) | **PROMOTE** | one concept keyed by share class |
| C2 (no-other-dilutive-rights, all 3 deals) | **SPLIT** | per-right-type concepts, not one family |
| C3+C6 (disclosure-schedule carve-out qualifier) | **PROMOTE** | Ben's question + resolution below |
| C4 (Capitalization-Date reference qualifier) | **PROMOTE** | |
| C5 (Capitalization-Date definition qualifier) | **PROMOTE** | separate role from C4 |
| C7 (securities-law transfer carve-out) | **PROMOTE** | own concept |
| C8+C11 (reserved-share-pool) | **PROMOTE** | one concept incl. zero case |
| C10 (no transfer restriction except org docs) | **PROMOTE** | |
| C12 (no repurchase/redemption obligation) | **PROMOTE** | |
| C13 (equity-award schedule completeness) | **PROMOTE** | per-field value shape |
| C14 (REIT/UPREIT structure family) | **PROMOTE** | design the family now, not deferred |
| C15 (no rights plan, near-miss pair) | **CONFIRM** | one concept, `NO_RIGHTS_PLAN` |
| PROP-65 (performance-vesting assumption) | **PROMOTE** | new qualifier kind |
| TAIL (38 singletons) | **DEFER** | re-cluster after more deals |

## Ben's open question on C3+C6, and the resolution

**Question (Ben):** "Is threshold the right type or should we just
have disclosure schedule?"

**Resolution (Fable recommendation, adopted unless Ben objects):**
DISCLOSURE-SCHEDULE CARVE-OUT SHOULD BE ITS OWN QUALIFIER TYPE, not a
THRESHOLD. Three reasons:

1. **Different value shape.** A threshold qualifier carries a standard
   (materiality, MAE-level); a schedule carve-out carries a POINTER
   (which schedule section). Forcing a pointer into a standard-shaped
   type corrupts both.
2. **Different market-statistics semantics.** "Qualified by a
   materiality threshold" and "qualified by scheduled exceptions" are
   different legal facts a user would query separately; merging them
   under THRESHOLD makes every threshold statistic silently include
   schedule carve-outs.
3. **Consistent with the existing lexicon's own doubt routing:** the
   qualifier-kind classifier already treats a hostless "except as set
   forth in the Disclosure Letter" as a no-op rather than a THRESHOLD —
   the taxonomy should agree with the classifier rather than fight it.

So C3+C6 promote as a new qualifier type `DISCLOSURE_SCHEDULE_CARVEOUT`
with value `{schedule_ref}` and attachment-position differentiation
(chapeau vs item), exactly as Ben's instinct suggested.

## Execution consequences

1. Registering the promoted concepts is Fable-end-to-end work
   (taxonomy/claim-definitions semantics). A promotion spec follows:
   concept keys, claim-definition keys, value shapes, generic-key
   resolution mappings, and per-concept acceptance tests replaying the
   committed fixtures (each promotion must convert its known fixture
   candidates from open_world to resolved).
2. C2's split and C14's REIT family are the two design-heavy items;
   C14 gets its own concept family (operating-partnership units, GP
   status, ownership limits) rather than a cap-table bolt-on.
3. Sequencing: the registry table lives in `candidate-resolution.js`,
   which the in-flight lexical-net build is editing — the promotion
   build starts after that slice lands. The spec does not wait.
4. With component rows merged, C1 promotions become publishable claims
   as soon as their definitions register — the first corpus-scale
   numeric payoff of the pipeline.
