# Breadth runs — Skechers and Modiv (deals two and three)

**Date:** 2026-08-01. Companion to `F28-THIRD-LIVE-RUN.md` (QXO, deal one).
Approved slice (c) of `docs/acks/CLAIM-IDENTITY-APPROVALS-2026-08-01.md`.
Artifacts: `tests/fixtures/canonical-v2/skechers-first-live-run/` and
`…/modiv-first-live-run/` (recorded responses, pins, receipts, resolution,
validation, review-queue artifacts).

## The three-deal picture

| | QXO/TopBuild | Skechers/3G | Modiv/GNL |
|---|---|---|---|
| Drafting | bare-lettered, no decimal headings | inline decimal headings | anchored decimal headings |
| Proposals compiled | 37/37 | 39/39 | 66/66 |
| Evidence residuals | 0 | 0 | 0 |
| Citations (post-fix) | corroborated | 37 AGREEMENT / 0 disagree (replay) | 63 AGREEMENT / 3 disagree |
| Published claims | 1 (meas. date 2026-04-17) | 1 (meas. date 2025-05-02) | 1 (meas. date 2026-05-03) |
| Review-queue items | 4 | 1 | 1 |
| Coverage share | 0.832 | 0.911 | 0.887 |
| CLI cost | $0.87 | $0.77 | $0.88 |

## What breadth proved

1. **Byte-exact evidence generalises.** Zero evidence residuals across
   three drafters and 142 compiled proposals. The producer's quote
   fidelity is not a QXO artifact.
2. **The sectionizer now spans the drafting spectrum.** Bare-lettered
   (QXO), inline-decimal (Skechers — found by the breadth stop, fixed
   same-day, regression-pinned), and anchored-decimal (Modiv, no fallback
   needed).
3. **The citation fix is validated on fresh data.** Modiv ran with
   per-proposal derivation live: 63/66 AGREEMENT with per-limb citations.
   The 3 disagreements are model attachment misreads — typed, queued
   review-side, exactly the gate's purpose.
4. **Queue economics are flat, not exploding.** ~1 review item per deal
   at the current mapping table (audit finding B6's fear is unrealised at
   n=3; re-measure as mappings widen). The drafter correctly selects
   nothing — the queued items are citation doubts, not kind doubts.
5. **The measurement-date monoculture is the expected signal, not a
   failure.** All three published claims are `REPRESENTATION_MEASUREMENT_
   DATE` because that is one of exactly two registered mappings. What
   publishes is bounded by vocabulary, by design; the open-world bucket
   is where the corpus's real breadth accumulates.

## Commonality evidence (the vocabulary-growth intake, n=3 drafters)

Recurring shapes now in open world across multiple deals:
- **TEMPORAL anchored on a defined date term** — QXO ("April 17, 2026"
  chapeau), Skechers ("Capitalization Date", time-of-day qualified),
  Modiv ("the date hereof"). The symbolic-date machinery already handles
  these; strongest candidate for the next vocabulary conversation.
- **Except-carve-outs referencing the agreement/disclosure letter** — all
  three deals, multiple instances each (THRESHOLD family).
- **REIT-idiomatic shapes (Modiv only, watch for recurrence):** dual
  common classes, OP/partnership units (Class C/X), Excepted Holder
  ownership limits under the charter.

No new claim definitions are proposed yet — per the standing rule, that
conversation starts when the commonality report runs over a larger n,
with Ben deciding.

## Open items from these runs

- The 3 Modiv citation disagreements (model attachment misreads) sit in
  typed residuals; no action needed until review-UI triage exists.
- Modiv's pinning fetch used a header-matched curl rather than the
  script's own fetch (bytes hash-verified; noted in the commit). Rerun
  with `--raw-html` omitted if a script-native fetch is wanted for the
  audit record.
- Modiv limb-enumeration scan shows 21 marker/model disagreements, not
  yet triaged — first real workload for that instrument's review flow.
- Skechers/Modiv deal-side reps only; parent-side capitalisation reps
  (e.g. Modiv 4.2) are untouched, as designed for this slice.
