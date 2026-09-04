# Work 5 blocked: the registered candidate cannot compile a real agreement

Date: 2026-09-03. Author: lead session. Status: finding for Ben, no
decision taken. Nothing governed was written; every run below was a
scratch read of committed inputs.

## Finding

Work 5 ("replay the fixed 50") is the first work that runs the V2 compiler
on a real agreement. A dry run of `consolidateAnalysis` under the successor
registration `9a3ccbf7…` on the first fixed-sample agreement (`06ec3016…`,
24 of the 50 items) fails before producing any rule, and the failure is not
incidental. Three independent defects, each sufficient on its own:

1. **One claim per M2 node.** The deterministic generator requires every
   native M4 claim to sit on a distinct M2 node. Real M4 analyses do not:

   | agreement | claims | nodes | nodes with 2+ claims |
   |---|---|---|---|
   | 06ec3016 | 155 | 110 | 28 (max 8) |
   | 08fd217e | 209 | 170 | 25 |
   | 1d6bba9a | 236 | 178 | 51 |
   | 3888fa76 | 352 | 241 | 73 |
   | aa72f3af | 190 | 186 | 4 |
   | b74ed1f0 | 236 | 170 | 46 |
   | f4a123d7 | 190 | 187 | 3 |
   | f783c4cd | 217 | 163 | 44 |
   | fa0fff26 | 193 | 191 | 2 |
   | fb76ef57 | 123 | 93 | 23 |

   Eleven fixed-sample items sit on multi-claim nodes: 6, 14, 22, 28, 32,
   33, 34, 35, 36, 37, 43. The contract validator separately requires the
   V2 governed-occurrence set to equal the full M4 claim set, so dropping
   claims is not a lawful workaround.

2. **The approved profiles match only synthetic marker text.** All 1,382
   Ben-approved profiles use `SOURCE_TOKEN_SEQUENCE` (1,380) or
   `SOURCE_TOKEN_ALL` (2) tests over 1,399 distinct tokens such as
   `familyfinancingcovenants` and
   `employeemattersemployeecompensationmetsera604604b6816889a46419b3`.
   None of the 1,399 tokens occurs as a word in any of the ten canonical
   agreement texts. The Work 3 match fixtures that "proved" the profiles
   carry that same marker text as their `authored_unit_source_text`. With
   claims deduplicated to one per node (scratch only), the generator fails
   on the first occurrence with `expected one unique most-specific approved
   profile match, received 0`, and it fails hard rather than routing the
   occurrence to `REVIEW_ONLY`.

3. **The generator compiles only the first-slice signature.** Outside a
   synthetic expression payload it accepts exactly
   `ALL_OF(APPLIES_TO,FAMILY_MARKER)`. No approved profile has that
   signature (each carries a per-fixture signature such as
   `EMPLOYEE_MATTERS::EMPLOYEE_COMPENSATION::METSERA_6_04_…`), and
   `consolidateAnalysis` never passes payloads. So even a matched real
   occurrence would fail at `unsupported first-slice expression`.

The governance plumbing itself is sound: the compiler accepts the six
semantic input sets, the registration-derived governance record and the
selected native M2/M3/M4 lineage for a real agreement. Everything up to
the generator's first occurrence works.

## Why the receipts did not catch it

Works 2, 3 and 4 report `semantic_runs: 0`, `v2_shadow_analysis_runs: 0`
and `v2_shadow_projection_runs: 0`. Their proofs (`repeat_determinism`,
`independent_oracle_equality`, `public_validator_pass`) ran only on
in-memory fixtures whose base analysis has one claim per node and whose
source text is the marker string. The family packet set records
`executable_matcher_present: false` for all 25 families and state
`LEGAL_EVIDENCE_ORACLE_NOT_EXECUTABLE_PROFILE_AUTHORITY`; the approved
profile set nevertheless carries `BEN_APPROVED_PROFILE_SET` with those
marker matchers. The adopted plan (§5.3) requires every profile to carry
"positive real-clause fixtures" and forbids taking a coarse or synthetic
match as proof. That requirement was not met, and no gate measured it.
This is the failure mode named in `CLAUDE.md`: a component declared done
on a comment or fixture, never run on the real input.

## What is still valid

- The Work 0 evidence root, fixed-sample identity manifest (50 members),
  repair baseline ledger and family packet set are unaffected.
- The execution-manifest chain Work 1 to Work 4, the successor
  registration, the Work 7 verifier and the Work 6 ledger recounts on
  `ext/m7-w6-audit` are internally consistent. They bind a candidate that
  cannot execute; they do not depend on it executing.
- The V2 contract validator, projector and view policy are unaffected as
  code; they have no real V2 analysis to consume.

## Consequences

- Work 5 cannot be built or run against candidate `9a3ccbf7…`.
- Any fix touches candidate-bound bytes (generator, profile set, family
  packages, tests), so it creates a new registration ID. The Work 2–4
  ordering authority forbids a candidate change after Work 4; the Work 4
  correction authority superseded that for exactly one correction and
  states that any further change needs a new authority. Ben's authority
  is required before any repair starts.
- The parent authority's `stop_conditions.affected_class` includes
  `FALSE_COMPLETE_FIXTURE`. This finding is that class for all 24 families.

## Options

A. **Real-text matcher wave, then re-register.** Under a new Ben authority:
   replace the 1,382 marker matchers with real-clause tests proved on the
   sealed seven plus additive three (positive, near-negative, wrong-family,
   wrong-subtype, per §5.3), extend the generator to (i) compile every
   claim on a shared node as a linked rule with one source closure, (ii)
   route zero-match and multi-match occurrences to `REVIEW_ONLY` instead
   of failing, (iii) compile the approved profile signatures rather than
   the first-slice one; rerun Work 3 approvals family by family for the
   changed profiles; register a new candidate; then Work 5. This is the
   plan as adopted, done properly. Weeks, not days; the Work 6 external
   deliveries rebind to the new ID.

B. **Reduced-scope Work 5 on a subset.** Same as A but limited to the
   families and profiles the fixed 50 touch (25 families, 50 items), with
   every other occurrence routed to `REVIEW_ONLY`. Reaches Ben's review
   sooner; the honest `REVIEW_ONLY` residue is expected by the plan. The
   candidate still changes, so it needs the same authority.

C. **Stop the repair on `FALSE_COMPLETE_FIXTURE`** and re-plan from the
   Work 3 seam with an independent review of what Works 2–4 actually
   proved. Cleanest record; slowest path.

Not an option: running Work 5 with a filtered or patched input, or writing
Work 5 outputs by hand. The contract rejects the former and the
authority forbids the latter.

## Recommendation

B, under one new Ben authority that (1) records this finding as the
`FALSE_COMPLETE_FIXTURE` stop for candidate `9a3ccbf7…`, (2) authorises a
single pre-Work-5 candidate replacement whose scope is the matcher and
generator changes above, proved by real-text fixtures for at least the 50
sampled occurrences and their families, and (3) keeps every committed Work
2–4 output retained and immutable as the Work 4 correction did. Work 6
external recounts continue; the Work 5 renderer stays parked until the
new candidate exists.

## Evidence

Scratch scripts and logs, not committed: `w5-dryrun.mjs` (compiler on the
committed inputs, fails at defect 1), `w5-dryrun-dedupe.mjs` (generator
with claims deduplicated per node, fails at defect 2), token scan (0 of
1,399 profile tokens present in any canonical text). Reproduce from the
committed inputs at `059c47d2` with the registration and successor manifest
named above.
