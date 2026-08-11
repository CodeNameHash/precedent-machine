# Stage 2Y measurement and evidence-authority audit

Date: 2026-08-10

Review base: `853b9e83b1bf067eabb5b2c86a10918e47a7d7e6`

## Result

The stated headline numbers are arithmetically correct and match the committed evidence. No numerical discrepancy was found.

The numbers need precise labels. The 1,241 and 1,097 counts are claim-level output successes, not counts of distinct physical rows. The 1,097 count is not human acceptance. The four extraction counts are not four disjoint groups. The 109 error count proves that feature-to-row lineage was not unique. The saved machine report does not prove that grouping caused every failure. The saved machine report also does not name the one claim that produced no row.

No generator, model route or test was run for this audit. The audit read the committed scripts and artefacts. It independently checked the committed hashes and arithmetic.

## Terms

A **pinned run** is one saved extraction run whose file path and hash are fixed in a manifest. A manifest is a list of authorised inputs.

A **claim revision** is one versioned semantic claim in a saved `resolution.resolved` array.

A **claim-level output success** means that one resolved claim passed the route, card, exact-row match and non-empty-cell checks. It does not mean that the output row is legally complete.

A **full-output signature** is a digest of every rendered row and cell returned for one claim's projection. Equal signatures mean equal complete rendered outputs under this measurement. They do not prove that two legal claims are duplicates.

## Evidence chain

### Pinned input set

The baseline manifest fixes 130 runs. It fixes one run for each `section_family|deal` key. The selection rule chooses the run with the highest resolved count, then the lexically first directory on a tie. A run with zero resolved claims is not eligible. See `scripts/stage-2y-cd-measurement.mjs:122-157` and `:174-197`.

The committed manifest records this rule and the report-only authority at `evidence/canonical-v2/stage-2y-cd-baseline-manifest.json:1`, JSON paths `.selection` and `.authority`.

The audit independently checked:

- 130 pinned runs;
- 260 pinned run-manifest and resolution files;
- the pinned Stage 2Y-N artefact;
- the manifest and Phase C/D report hashes bound by the known-loss artefact;
- the manifest, input-set, baseline and known-loss self-identifiers.

All 263 file-hash checks passed. All four self-identifier checks passed.

This selection has a material caveat. It favours the saved run with the most resolved claims and excludes zero-resolved family-deal runs. The result is not an unbiased corpus recall measurement. It is a fixed regression cohort for output measurement.

### Extraction counts

The measurement script defines the counts at `scripts/stage-2y-cd-measurement.mjs:71-77`:

```text
resolved   = length of resolution.resolved
open-world = length of resolution.open_world
review     = review_queue rows where has_resolution is exactly false
attempted  = resolved + review
```

It sums these raw counts over the 130 pinned runs at `scripts/stage-2y-cd-measurement.mjs:402-410` and `:466-477`.

Independent read-only counting found:

| Item | Count | Exact meaning |
|---|---:|---|
| Resolved | 1,526 | Claim revisions in `resolution.resolved`. |
| Review | 675 | `review_queue` rows with `has_resolution === false`. |
| Attempted | 2,201 | `1,526 + 675`. It also equals the complete `review_queue` length in the pinned files. |
| Open-world | 1,701 | Entries in `resolution.open_world`. No deduplication is applied. |

The complete review queue has 2,201 rows: 1,526 with `has_resolution === true` and 675 with `has_resolution === false`. All 1,526 resolved entries have a non-null claim revision identifier. Those identifiers are unique across the pinned set.

The committed totals are at `evidence/canonical-v2/stage-2y-cd-report.json:1`, JSON path `.current.totals`. The test that states the intended four-count semantics is `tests/stage-2y-cd-measurement.test.js:31-38`.

Do not add the four numbers. `attempted` already contains `resolved` and `review`. `open-world` is a separate proposal array and can coexist with an attempted claim. These are measures of different lists and states, not four parts of one total.

### Claim-to-row funnel

The script processes each resolved claim revision. It records a missing family route before projection. It then projects a card and requires an exact row match. See `scripts/stage-2y-cd-measurement.mjs:396-449`.

The exact-row matcher requires exactly one row with `matches_claim_key === true` at `scripts/stage-2y-cd-measurement.mjs:116-119`. Content means that at least one cell contains non-empty text that is not one of four exact absence phrases. See `scripts/stage-2y-cd-measurement.mjs:15` and `:80-84`. For example, `See provision` counts as content. The check does not test whether a party, exception or qualification is present.

The current funnel is:

| Stage | Count | Reconciliation |
|---|---:|---|
| Resolved input | 1,526 | Starting claim revisions. |
| No family route | 175 | `FAMILY_NOT_RENDERABLE`. |
| Route available | 1,351 | `1,526 - 175`. |
| Card projected | 1,351 | No current pre-card failures. |
| Feature row not unique | 109 | Post-card fail-closed result. |
| Projected no row | 1 | Post-card fail-closed result. |
| Exact matched row with content | 1,241 | `1,351 - 109 - 1`. |

The saved totals are at `evidence/canonical-v2/stage-2y-cd-report.json:1`, JSON path `.current.totals.rendering_funnel` and `.current.totals.render_failures`.

The script increments `row_emitted` once per successful claim, not once per physical row in the returned array. See `scripts/stage-2y-cd-measurement.mjs:410-432`. The accurate statement is therefore:

> 1,241 of 1,526 resolved claim revisions passed the current mechanical claim-to-row and content checks.

The rate is `1,241 / 1,526 = 81.3237%`, displayed as 81.3%.

Do not state that the system produced 1,241 distinct rows. The duplicate report records 1,241 claim-level outputs, 981 distinct full-output signatures and 260 excess equal signatures. Its collapse rate is `260 / 1,241 = 20.9508%`. The signature includes the complete rendered output, not only the matched row. See `scripts/stage-2y-cd-measurement.mjs:87-114` and `:259-273`. The test confirms full-output coverage at `tests/stage-2y-cd-measurement.test.js:40-47`.

### The 109 feature-lineage failures

The family split is exact:

| Family | `CLAIM_FEATURE_ROW_NOT_UNIQUE` |
|---|---:|
| MAE Definition | 100 |
| Antitrust / Regulatory | 7 |
| Employee Matters | 2 |
| Total | 109 |

The renderer requires the row to own the expected feature. It also requires either a direct matching claim revision or an exactly one-member feature-lineage list. See `lib/review-parity/rendered-row-preview.js:156-169`. It raises `CLAIM_FEATURE_ROW_NOT_UNIQUE` when the number of matching rows is not one. See `lib/review-parity/rendered-row-preview.js:509-515`.

The committed aggregate therefore proves that 109 claim revisions failed exact feature-row lineage. The error condition combines zero matches and more than one match. The Phase C/D report retains only error-code counts. It does not retain the member claim identifiers, feature keys or observed match counts.

The phrase `109 grouped feature claims` is the programme's diagnosis in `docs/core/PLAN.md:3030-3032`. It is consistent with the one-member lineage rule, but the committed machine report alone does not preserve enough detail to re-audit grouping as the cause for each of the 109 claims. The final architecture report should distinguish the measured error code from the diagnosed cause.

### The one routed claim with no row

The report records one `CLAIM_RENDERED_NO_ROW` in Termination. This error means that the configured row selector returned no rows. See `lib/review-parity/rendered-row-preview.js:432-440`.

`docs/core/PLAN.md:3037-3039` names the item as TopBuild section 6.3, claim definition `TERMINATION_RIGHT_GRANT`, concept `TERMR-NOSOL-BREACH`. The pinned manifest selects `topbuild-termination-20260809-2xk-r3-final`. Its resolution contains one matching resolved claim revision, `0259692458a71a8817779823b10936ebfce9beb047a6232d0a28113f7cc4f9d3`. The route registry sends `TERMR-NOSOL-BREACH` to the No Shop review config at `lib/review-parity/rendered-row-preview-contract.js:14-22`.

This strongly corroborates the PLAN attribution. It is not fully sealed by the aggregate report because that report does not retain the failed claim identifier. The exact statement should cite PLAN and the pinned resolution, not claim that the report's failure record names the claim.

### The 175 claims without a route

The exact family split is:

| Family | Resolved claims absent from `FAMILY_ROUTES` |
|---|---:|
| Key Defined Terms | 76 |
| Representations | 70 |
| Tax Matters | 17 |
| Appraisal / Dissenters' Rights | 5 |
| Financing Covenants | 5 |
| Dividends | 1 |
| Guaranty / Financing Party | 1 |
| Total | 175 |

The measurement creates its routed-family set from `Object.keys(FAMILY_ROUTES)` and assigns `FAMILY_NOT_RENDERABLE` to every resolved claim whose family is absent. See `scripts/stage-2y-cd-measurement.mjs:396-416`. The route registry is at `lib/review-parity/rendered-row-preview-contract.js:6-218`.

The saved evidence proves `family absent from the approved route registry`. The phrase `no approved output owner` is a programme interpretation in `docs/core/PLAN.md:3037-3041`. There is no separate owner registry or owner field in this measurement. The final report should define output owner as an approved `FAMILY_ROUTES` entry before using that phrase.

## Known-loss adjustment

The known-loss script binds itself to the pinned manifest and exact current report. It rejects drift at `scripts/stage-2y-cd-known-loss-adjustment.mjs:146-153`. It applies only four stated rules at `:157-189` and `:256-281`.

The four distinct-claim counts are:

| Rule | Identified claims | Mechanically rendered claims deducted |
|---|---:|---:|
| D&O specific mechanic not rendered | 25 | 25 |
| No Shop information loss | 75 | 75 |
| No Other Reps / Fraud party not rendered | 36 | 36 |
| MAE Definition party not rendered | 108 | 8 |
| Total | 244 | 144 |

No Shop is the union of 21 absent action-code claims and 59 Buyer-party claims. Five claims are in both sets. The union is `21 + 59 - 5 = 75`. See `scripts/stage-2y-cd-known-loss-adjustment.mjs:161-189` and the committed artefact at `evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json:1`, JSON paths `.reason_counts` and `.overlaps`.

All 100 identified claims that already did not render are MAE Definition claims. The other 144 affected claims are present in the 1,241 mechanical count. The calculation is:

```text
identified known-loss claims             244
already excluded by mechanical row gate  100
additional rendered deductions           144

mechanical claim-level successes        1,241
less rendered known-loss deductions       144
known-loss-adjusted count               1,097
```

The script calculates this at `scripts/stage-2y-cd-known-loss-adjustment.mjs:193-228`. The committed summary is at `evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json:1`, JSON path `.summary`.

`1,097 / 1,526 = 0.718872870249017`, or 71.8873%. The saved display value rounds this to 71.9%.

The adjustment is deliberately narrow:

- It deducts only the four enumerated loss rules.
- It does not adjudicate any of the remaining 1,097 claim-level outputs.
- It does not measure all secondary relationship detail. PLAN names Closing Conditions as one omission at `docs/core/PLAN.md:3024-3028`.
- It does not establish source recall.
- It does not establish legal correctness.
- It is not a human acceptance sample.

The artefact makes the last point explicit. Its label is `KNOWN_LOSS_ADJUSTED_NOT_HUMAN_ACCEPTED`; `human_acceptance` is false; `human_accepted_rows` is null; and `human_acceptance_status` is `NOT_MEASURED`. See `scripts/stage-2y-cd-known-loss-adjustment.mjs:232-293` and the committed artefact at line 1.

## Authority limits

The report authority says `model_calls: 0`, `product_writes: false`, `publication_authorisation: NONE` and `serving_activated: false`. See `scripts/stage-2y-cd-measurement.mjs:174-197` and `evidence/canonical-v2/stage-2y-cd-report.json:1`, JSON path `.authority`.

`model_calls: 0` means that the measurement process made no model call. It does not mean that the pinned extraction results were produced without models. The inputs are saved resolution files from prior runs.

Resolved is not the same as correct, rendered, accepted or published. Decision 17 explicitly separates resolution from publication at `docs/core/DECISIONS.md:1598-1606`. Its addendum makes the rendered row the unit of human judgement at `docs/core/DECISIONS.md:1658-1682`.

These measurements do not establish:

- complete agreement parsing;
- source-block recall;
- claim recall against all legal content;
- human acceptance;
- false-publication rate;
- publication eligibility;
- mission readiness.

## Discrepancies and wording corrections

No count or percentage discrepancy was found. The following evidence gaps or terminology differences remain:

1. **`1,241 exact rows` is shorthand.** The code counts 1,241 resolved claim revisions that each reach one exact matched row with content. It does not count 1,241 distinct physical rows.
2. **`1,097 rows` is also shorthand.** It is the adjusted count of claim-level successes after four deductions. It is not an enumerated human-accepted row set.
3. **The extraction counts are not disjoint.** `attempted` equals `resolved + review`. Open-world is a separate list. Never add all four.
4. **The 109 causal label is stronger than the saved report.** The report proves non-unique feature-row lineage. It does not retain enough failure detail to prove that grouping caused each failure.
5. **The one failed claim is not named in the report.** PLAN names it, and the pinned input and route registry corroborate it. A future report should retain failed claim identifiers.
6. **`No approved output owner` means no family route in this measurement.** There is no separate ownership registry.
7. **The current measurement omits its rule label.** The baseline records `EXACT_GOVERNED_ROW_V3_ROUTE_BOUND`, but `.current.measurement_rule` is absent because `measurePinnedRuns` does not add it. The current code still performs exact route-bound matching. This is a metadata omission, not a count error.
8. **The cohort is selected for high resolved count.** The 1,526 denominator is the pinned regression cohort. It is not a corpus-wide recall denominator.
9. **Mechanical content is a weak content test.** Any non-empty cell other than an exact absence phrase passes. Passing does not prove that party, control, exception, qualification or operative detail survived.
10. **Duplicate collapse is output equivalence.** It is not a measured semantic duplicate rate.

## Safe wording for the final architecture report

Use this wording:

> The fixed 130-run family-deal cohort contains 1,526 resolved claim revisions. Of those, 1,241, or 81.3%, pass the current mechanical route, card, exact-row-lineage and non-empty-cell checks. This is a claim-level reachability count, not a distinct-row count, source recall measure or human acceptance result. Four enumerated information-loss rules identify 244 affected claims. One hundred were already excluded by the row gate, so the adjustment deducts 144 from 1,241. The resulting 1,097 of 1,526 is 71.9% after rounding. It is a cautious known-loss-adjusted count, not lawyer-usable coverage or human acceptance.

Then state separately:

> The same cohort has 2,201 attempted items, 1,526 resolved claims, 675 unresolved review items and 1,701 open-world entries. Attempted equals resolved plus unresolved review. Open-world is a separate list. These numbers must not be added.

And:

> Of the 1,526 resolved claim revisions, 175 are in families absent from the approved route registry. A further 109 fail the exact feature-row-lineage check, and one routed Termination claim projects no row. The aggregate report does not retain member-level details for the 109 or the one no-row failure.
