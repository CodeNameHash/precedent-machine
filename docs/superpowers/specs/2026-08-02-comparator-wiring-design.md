# Comparator + lexical-net wiring into the live-run replays

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED (4 material folded; verdict was AMEND). **Authority:** Ben's seven MAP rulings
(`docs/acks/FAMILY-MAPPING-RULINGS-2026-08-02.md`); both nets merged
to main (PRs #471, #472).

## Why

Both nets exist as modules; nothing FEEDS them yet. HONESTY PIN (audit B-M1): `both_nets_clean` will be ZERO on every
claim in all three runs BY CONSTRUCTION this slice — every resolved
claim is REP-family, REP cards carry no Tier 2 values, so condition 1
stays `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM` under Ben's option A,
working as designed. The review-queue artifact's counts field is
therefore ABSENT (present only when > 0) and the tests pin that
absence. The deliverable is the CONDITION BREAKDOWN — both conditions
now EVALUATE and the blockers become visible, typed data — not
nonzero clean counts. The eligibility report says so in its header.

## 1. FAMILY_MAPPING_TABLE version 1 → 2 (`v1v2-comparator.js`)

Add exactly the SEVEN Ben-ratified identity rows: `REP-B-VOTE`,
`REP-T-CONTROLS`, `REP-T-NOLIAB`, `REP-B-NOLIAB`, `REP-T-PROXY`,
`REP-T-RPT`, `REP-T-SANCTIONS`. Each with the one-line rationale
citing the ruling ack. Table version bump; receipts pin the new
version. EXPLICITLY NOT ADDED (documented in the table comment):
`REP-T-CONSENT`, `REP-T-REGSTATUS`, `REP-B-ANTIRELIANCE` — held for
the v1 reclassification splits; their cards stay typed
`V1_CARD_UNMAPPED`, expected and counted.

## 2. Deal identity bridge

The Skechers/Modiv snapshots carry the documented placeholder
`governed_deal_key`. "Register" means exactly (audit B-M3): re-export
each snapshot with `--governed-deal-key` set to the deal's LITERAL
RECORDED adapter-result context key —
`deal:skechers-first-live-run:5e1d6f13ab83e3f9` and
`deal:modiv-first-live-run:32065211e4688625` — matching the
fixture-pin replay pattern; there is no registration system, and
freshly invented keys are wrong. New snapshot ids; placeholders
REPLACED. The re-export needs ONE read-only production-DB session
(prerequisite, called out); the wiring tests and eligibility script
then run fully OFFLINE from committed fixtures. Hash-stability
re-verified on export. Note: re-exported snapshots inherit
deal_max_extraction_version m2-00-corpus-backfill-v1; the
reclassification slice's label bump re-stales them by rule — one more
reason for the pinned build order below.

## 3. Replay wiring (the deliverable)

For each of the three recorded runs (F28/TopBuild, Skechers, Modiv),
a wiring test that:

1. loads the run's committed artifacts (the v1v2-comparator-wiring
   test's loader pattern);
2. builds the v1v2 comparison via `v1v2-comparator.js` from the
   deal's committed snapshot + the run's resolution output;
3. runs resolution ONCE plain, mints lexical receipts per governed
   section via the net module (two-pass flow ratified at #472), and
   runs resolution AGAIN with BOTH optional inputs;
4. asserts, per deal, the exact expected outcome counts —
   hand-derived, pinned as literals with derivation comments.
   PINNED (corrected at Fable review of the build — the audit-era
   prose below was wrong under the module's exact-string Tier-1
   citation rule and the reviewer independently re-derived the truth
   from the fixtures): Skechers Tier 1 = 0 PRESENCE_AGREEMENT + 2
   SECTION_MISMATCH (its claim cites "3.7(b)"; both v1 cards carry
   bare "3.7"/"3.8" — no exact match); Modiv = 0 + 1 (claim
   "3.2(c)" vs card "3.2"); TopBuild = 1 + 0 (corroborated "3.1(b)"
   matches its subsection-granularity card). The claim-level
   consequence stands as originally specced: mismatch-blocked claims
   with deterministic_gates_passed false — expected, not a bug.
   [Superseded original prose: Skechers 1+1 via a §3.7/§3.8 pair;
   TopBuild/Modiv "clean" — kept here struck-through for the record.] Post-seven-rows UNMAPPED
   sets: Skechers 5 (null §4.13/§4.10, CONSENT §3.4/§3.6,
   ANTIRELIANCE §4.17), Modiv 4 (null §4.16/§4.19, REGSTATUS §3.22,
   ANTIRELIANCE §4.21), TopBuild 0. All non-CAP families read
   LEXICAL_LEXICON_UNCOVERED_FAMILY (lexicon covers REP-T-CAP only).
   Sub-pins:
   - Tier 1 outcomes incl. the EXPECTED `V1_CARD_UNMAPPED` set (the
     held-back three subtypes plus the null-subtype cards — exact
     card ids);
   - lexical per-family outcomes for `REP-T-CAP` in each governed
     section;
   - per-claim conditions: which claims now carry evaluated
     conditions 1 and 2, which carry `both_nets_clean`, and that
     `SOURCE_SCOPE_CERTIFICATION_ABSENT` blocks auto-pass on ALL of
     them (routing unchanged — the M3 gate stays closed);
   - review-queue artifact `both_nets_clean` count per run.
5. Additivity guard: the plain (no-input) pass in step 3 must still
   reproduce the committed pins byte-identically.

## 4. Eligibility report for Ben

A read-only script (`scripts/nets-eligibility-report.mjs`) that runs
step 3 over the three fixtures and prints the queue-data summary Ben
was promised: per deal, claims resolved / both-nets-clean /
blocked-by (condition breakdown) / v1 recall outcomes. Output is a
dated handoff doc per run of the script, never a claim that
auto-pass "would open" (activation remains Ben + sampling).

## Acceptance

All wiring tests green; no-input pins byte-identical; the three
expected-count tables hand-verified in review (the TopBuild-snapshot-
hash precedent); full suite + build + allowlist + forbidden-patterns;
eligibility report generated once and committed as the slice's dated
handoff.

## Sequencing (audit cross-cutting, binding)

THIS SLICE BUILDS FIRST; the v1 reclassification slice builds AFTER
it and owns re-deriving this slice's expected-count tables and
re-exporting all three snapshots when the splits land. To shrink the
brittle surface, the UNMAPPED assertions derive the SET
programmatically from (snapshot subtypes − mapping table) with pinned
per-outcome totals, so the later re-export changes data, not test
logic.

## Out of scope

The three held subtypes (await reclassification); live extraction
runs; any auto-pass routing change; FAMILY value-mapping (Tier 2)
growth — REPRESENTATION cards carry no values (grounded in the
snapshot export's findings).
