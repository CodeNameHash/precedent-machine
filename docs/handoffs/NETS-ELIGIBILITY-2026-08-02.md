# Nets eligibility report — comparator + lexical-net wiring (2026-08-02)

**Status:** Comparator-wiring slice, generated once by
`scripts/nets-eligibility-report.mjs` (offline, committed fixtures only —
no network, no DB, no `--deal` argument). Authority: Ben's seven MAP
rulings (`docs/acks/FAMILY-MAPPING-RULINGS-2026-08-02.md`);
`docs/superpowers/specs/2026-08-02-comparator-wiring-design.md`.

## Headline, stated up front (Ben's option A, by construction)

`both_nets_clean` is **ZERO** on every claim, in all three runs, **by
construction this slice** — not a bug, not a near-miss. Every claim v2
resolves today is REP-family (`REPRESENTATION_MEASUREMENT_DATE`), REP
cards carry no Tier 2 values (`VALUE_MAPPING_TABLE` has no real REP
entries), so condition 1 (the v1↔v2 comparator) stays
`V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM` under Ben's ruled option A
whenever it is not already blocked outright by a `SECTION_MISMATCH`.
**This report is the condition breakdown becoming visible, typed data —
not a claim that auto-pass "would open."** Activation remains Ben +
sampling; `SOURCE_SCOPE_CERTIFICATION_ABSENT` (the M3 gate) blocks
`auto_pass` on every claim below, unconditionally.

## Per-deal condition breakdown

| Deal | claims resolved | review queue | open_world | both_nets_clean | blocked_by | v1 cards (total) |
|---|---|---|---|---|---|---|
| TopBuild | 3 | 4 | 33 | 0 (absent from JSON) | `SOURCE_SCOPE_CERTIFICATION_ABSENT`×3, `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM`×3 | 43 |
| Skechers | 1 | 1 | 38 | 0 (absent from JSON) | `SOURCE_SCOPE_CERTIFICATION_ABSENT`×1 | 47 |
| Modiv | 1 | 1 | 65 | 0 (absent from JSON) | `SOURCE_SCOPE_CERTIFICATION_ABSENT`×1 | 48 |

Note on `blocked_by`: Skechers and Modiv show only
`SOURCE_SCOPE_CERTIFICATION_ABSENT` because their sole resolved claim is
already blocked by a Tier-1 `SECTION_MISMATCH` (routed into
`triage.reasons`, not `unevaluated_conditions` — the comparator DID
evaluate, it just disagreed), so `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM`
never applies to that claim. TopBuild's claim genuinely never got a Tier 2
value mapping, so it carries both blockers.

## V1 recall (Tier 1 comparator outcomes)

| Deal | PRESENCE_AGREEMENT | SECTION_MISMATCH | V1_CARD_UNMAPPED | V2_NOT_ATTEMPTED | V1_MISSING | V2_MISSING |
|---|---|---|---|---|---|---|
| TopBuild | 1 | 0 | 0 | 42 | 0 | 0 |
| Skechers | 0 | 2 | 5 | 40 | 0 | 0 |
| Modiv | 0 | 1 | 4 | 43 | 0 | 0 |

The `V1_CARD_UNMAPPED` totals (5 Skechers / 4 Modiv / 0 TopBuild) are the
three held-back subtypes (`REP-T-CONSENT`, `REP-T-REGSTATUS`,
`REP-B-ANTIRELIANCE`) plus the null-subtype `[PROPOSED]` cards, exactly
as ratified in `docs/acks/FAMILY-MAPPING-RULINGS-2026-08-02.md` — expected
and counted, not a defect. They clear once the v1 reclassification slice
lands (same ack doc, "Execution" step 2).

Skechers' and Modiv's `SECTION_MISMATCH` outcomes (2 and 1 respectively)
are the run's own real REP-T-CAP card(s) at SECTION granularity ("3.7"/
"3.8", "3.2") against the run's resolved claim's SUBSECTION-granularity
citation ("3.7(b)", "3.2(c)") — genuine, reproducible mismatches under
`v1v2-comparator.js`'s exact-string-equality Tier 1 rule, not an error in
this report. See `tests/canonical-v2-comparator-wiring-replay.test.js`'s
file header for the full derivation, including where this diverges from
the design doc's own descriptive prose.

## What this is not

- Not an auto-pass eligibility claim. `both_nets_clean` computing zero
  everywhere means condition 1 and condition 2 have not yet BOTH cleared
  for any claim this slice — the M3 gate (`SOURCE_SCOPE_CERTIFICATION_ABSENT`)
  stays closed regardless.
- Not a live-DB report. Every number above comes from committed fixtures
  (`tests/fixtures/canonical-v2/{f28-third-live-run,skechers-first-live-run,
  modiv-first-live-run}` + `tests/fixtures/canonical-v2/v1v2-comparator/`) —
  re-run `node scripts/nets-eligibility-report.mjs` any time to reproduce.
- Not the final expected-count tables. The v1 reclassification slice
  (sequenced after this one, per the comparator-wiring spec's own
  "Sequencing" section) re-derives these tables and re-exports all three
  snapshots once the held-back subtypes split.

## Reproduce

```
node scripts/nets-eligibility-report.mjs        # human-readable
node scripts/nets-eligibility-report.mjs --json # structured summary
```
