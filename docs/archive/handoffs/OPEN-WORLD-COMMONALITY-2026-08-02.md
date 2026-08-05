# Open-world commonality report — first cut (2026-08-02)

**Status:** ADJUDICATION MATERIAL FOR BEN. Proposes groupings only —
nothing here is a taxonomy promotion; the M3 protocol reserves every
promote/reject call to Ben. Produced by deterministic clustering
(Sonnet-run, Fable-reviewed) over the `open_world[]` arrays of the three
committed live-run fixtures; reproducible from the repo with no model
calls (method below).

**Source:** 136 candidates — 33 F28/TopBuild, 38 Skechers, 65 Modiv —
all from `prompt_id: CAPITALISATION_REPRESENTATION_PRODUCER`, in
`tests/fixtures/canonical-v2/{f28-third-live-run,skechers-first-live-run,modiv-first-live-run}/resolution.json`.

## Method (deterministic, reproducible)

Three top-level buckets by `claim_definition_key`, then shape, then
text:

- `NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE` (89): bucket by
  `attributes.limb_path` depth, then greedy single-link clustering on
  Jaccard token-set similarity of `attributes.subject` (lowercased,
  punctuation-stripped, minimal stopwords), threshold 0.30.
- `NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE` (45): bucket by
  `qualifier_kind|attachment.position|attachment.scope_reading`, then
  Jaccard on `raw_value`, threshold 0.25.
- `OPEN_WORLD_PROPOSITION` (2): bucket by `attributes.nearest_concept`,
  Jaccard threshold 0.30.

Greedy single-link: each candidate compares against every existing
cluster's seed token-set; joins the best cluster above threshold, else
seeds a new one. Deterministic given fixture order (F28 → Skechers →
Modiv, array order within each).

**Result: 66 clusters** — 13 cross-deal, 15 multi-member single-deal,
38 singletons.

**Known limitation, flagged not fixed:** hard shape-bucket partitions
sometimes split clearly-related candidates — the "no rights plan"
assertion pair (Skechers/Modiv) scored 0.286, just under 0.30, and the
equity-award-schedule completeness theme spans three limb-depth
buckets. Near-misses are called out by hand where legally significant;
the algorithmic boundaries are reported as-is for reproducibility.

## Ranked clusters — Tier 1: cross-deal

Every characterization is PROPOSED.

**C1. Authorized/outstanding share-count limb assertions** — 9, all 3
deals. F28 3.1(b) "The authorized capital stock of the Company
consists of"; Skechers 3.7(a) "130,289,468 shares of Company Class A
Common Stock were issued and outstanding"; Modiv 3.2(a) "10,323,670
Class C Common Shares were issued and outstanding,". PROPOSED: the raw
authorized/issued/outstanding counts by class — the numeric heart of
every capitalization rep, open-world today because no concept captures
"N shares of [class]" as a first-class assertion distinct from the
chapeau.

**C2. No-dilutive-securities-outstanding negative assertions** — 9,
all 3 deals (options / warrants / convertibles / voting trusts /
registration rights). PROPOSED: a family of "no other equity-linked
rights outstanding" assertions. NOTE: the algorithm likely OVER-MERGED
here — these probably deserve separate concepts per right-type; Ben
should split.

**C3. Chapeau-level disclosure-schedule carve-out qualifiers** — 3,
one per deal, structurally identical ("Except as set forth in
[section/Disclosure Letter]", governs all items). Strong candidate for
a `THRESHOLD`/`CHAPEAU` carve-out code with a schedule pointer value.

**C4. Item-level "as of / since the Capitalization Date" temporal
qualifiers** — 10, Skechers + Modiv. Needs `date_anchor_ref` (defined
term) plus point-in-time vs period scope.

**C5. Capitalization-Date-DEFINING qualifiers** — 5, F28 + Modiv
("as of the close of business on April 17, 2026", "...May 1, 2026 (the
'Capitalization Date')"). Distinct from C4: this clause DEFINES the
date; C4 references it. Propose separate roles `DATE_DEFINITION` vs
`DATE_REFERENCE`.

**C6. Item-level disclosure-schedule carve-outs** — 6, F28 + Modiv.
Same legal function as C3, `ITEM` attachment — probably the same
concept key differentiated by attachment, not a separate concept.

**C7. Securities-law transfer-restriction carve-outs** — 4, F28 +
Modiv ("other than restrictions on transfer arising under applicable
securities Laws"). Distinct legal substance from C6; own code.

**C8/C11. Reserved-share-pool assertions** — 4 across all 3 deals
(split by the algorithm into two clusters; recommend reviewing as one
"shares reserved for future plan issuance" concept, value
{count, plan_ref}).

**C9. Preferred-stock outstanding counts** — 2, Skechers + Modiv;
sub-case of C1, fold in.

**C10. No-transfer-restriction-except-organizational-docs
assertions** — 2, Skechers + Modiv.

**C12. No self-repurchase/redemption obligation** — 2, Skechers +
Modiv.

## Tier 2: single-deal, high value

**C13. Equity-award schedule completeness** — 7 Modiv candidates
(3.2(g): holder, counts, grant date, vesting, distribution threshold)
PLUS one F28 and one Skechers singleton asserting the same thing (the
algorithm split them across limb-depth buckets; the cross-deal theme
is real — 9 across all 3 deals). PROPOSED: `EQUITY_SCHEDULE_
COMPLETENESS`, value {field_name, schedule_ref}, needs per-field
enumeration.

**C14. Operating-partnership / REIT-structure assertions** — ~15,
Modiv only: sole-GP status, Partnership Units, Class C/X Unit
redemption/conversion, Charter ownership limits, Excepted Holder
Limits. OUTSIDE the current cap-structure family — REIT/UPREIT
plumbing that does not map to corporate cap-table concepts. If REIT
deals recur, this needs its own concept family, not a bolt-on.

**C15. No stockholder/shareholder rights plan** — Skechers + Modiv
near-miss pair (Jaccard 0.286 vs 0.30 cutoff): real cross-deal
concept, `NO_RIGHTS_PLAN`; confirm manually.

**PROP-65. PSA performance-vesting assumption** — 2, Skechers only;
the extractor itself flagged these as fitting no qualifier kind
("states the performance-vesting assumption underlying a PSA share
count"). PROPOSED: new qualifier kind `PERFORMANCE_ASSUMPTION`, value
{level: target|maximum}.

## Tier 3: long tail

38 singletons (28%), deal-idiosyncratic phrasing, no cross-deal match
at threshold. No codes recommended yet; re-run after more deals
ingest.

## Summary table

| Cluster | Count | Deals | Proposed characterization | Code needs |
|---|---|---|---|---|
| C1 (+C9) | 11 | 3 | Share-count limbs by class | concept per class; value {count, class, as-of ref} |
| C2 | 9 | 3 | No-other-dilutive-rights (SPLIT on review) | several concepts, per right-type |
| C3 (+C6) | 9 | 3 | Disclosure-schedule carve-out qualifier | one concept, attachment-differentiated |
| C4 | 10 | 2 | Capitalization-Date reference qualifier | `date_anchor_ref` + PIT/period scope |
| C5 | 5 | 2 | Capitalization-Date definition qualifier | `DATE_DEFINITION` role; ISO date + term name |
| C7 | 4 | 2 | Securities-law transfer carve-out | own code |
| C8/C11 | 4 | 3 | Reserved-share-pool | {count, plan_ref} |
| C10 | 2 | 2 | No transfer restriction except org docs | own code |
| C12 | 2 | 2 | No repurchase/redemption obligation | own code |
| C13 | 9 | 3 | Equity-award schedule completeness | {field_name, schedule_ref} |
| C14 | ~15 | 1 | REIT/UPREIT structure family | new family if REITs recur |
| C15 | 2 | 2 | No rights plan (near-miss, confirm) | `NO_RIGHTS_PLAN` |
| PROP-65 | 2 | 1 | Performance-vesting assumption | new qualifier kind |
| singletons | 38 | — | idiosyncratic | none yet |

## Ben's adjudication asks (when ready — nothing blocks on this today)

1. Promote/reject/split per cluster above — C1, C3, C13 look like the
   highest-value promotions (all-3-deal presence, core cap-table
   substance).
2. C2's split decision (per-right-type concepts vs one family).
3. Whether C14 (REIT family) waits for a second REIT deal or gets
   designed now.
4. Confirm C15's near-miss pair as one concept.

Promotions feed the claim-definitions registry; each one converts a
slice of the 136 open-world candidates into resolvable (and eventually
publishable) claims — with component rows already merged, the
share-count assertions in C1 become publishable as soon as their
definitions are registered.
