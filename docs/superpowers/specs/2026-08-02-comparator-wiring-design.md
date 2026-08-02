# Comparator + lexical-net wiring into the live-run replays

**Date:** 2026-08-02. **Status:** DRAFT — pending adversarial audit
(D1 standing practice). **Authority:** Ben's seven MAP rulings
(`docs/acks/FAMILY-MAPPING-RULINGS-2026-08-02.md`); both nets merged
to main (PRs #471, #472).

## Why

Both nets exist as modules; nothing FEEDS them yet. Until the
recorded replays run with real receipts, `both_nets_clean` stays
zero everywhere and Ben gets no eligibility data. This slice makes
every committed replay carry both verdicts.

## 1. FAMILY_MAPPING_TABLE v2 → v3 (`v1v2-comparator.js`)

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
`governed_deal_key`. This slice registers REAL governed deal keys for
the three deals (the TopBuild pattern) and re-exports the two
snapshots with them (same read-only export script; new snapshot ids;
the placeholder fixtures are REPLACED, not kept alongside — two
snapshots for one deal with different ids is an ambiguity trap).
Hash-stability re-verified on export.

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
   hand-derived, pinned as literals with derivation comments:
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

## Out of scope

The three held subtypes (await reclassification); live extraction
runs; any auto-pass routing change; FAMILY value-mapping (Tier 2)
growth — REPRESENTATION cards carry no values (grounded in the
snapshot export's findings).
