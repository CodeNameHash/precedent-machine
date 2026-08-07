# Step 1A. Bind every gate to a step, mechanically

Status: in progress.

## Task
Write `tests/programme-gates/gates-bound-to-plan.test.js`, which reads
`docs/codex-program/programme-gates.yaml`, takes every gate identifier in it,
and fails unless that identifier appears in either `docs/core/PLAN.md` or
`docs/core/COMPLETED.md` next to a step label (`Step <digit><letter>`, e.g.
`Step 5C`, or `Steps 7A to 7C`) or the word "Retired".

## Scoping decision
`programme-gates.yaml` has two separate gate lists:
- `programme_gate_registry.preproduction_gates` — 25 entries, exactly what
  PLAN.md section 5 ("The old gates, disposed of") enumerates and dispositions.
  This is the list PLAN.md section 5's own verification snippet counts
  (`total 25 with criteria 5 without 20`).
- `programme_gate_registry.phase_12_security_gates.gates` — 7 entries
  (`P10_SECURITY_01`, `ROUTE_ACTION_THREE_WAY_INVENTORY`,
  `DEFAULT_DENY_FULL_PROBE_SUITE`, `EGRESS_DENY_BY_DEFAULT_CERTIFICATION`,
  `ACTION_AUTH_MATRIX_AND_WHOLE_TUPLE_REVOCATION`,
  `MALICIOUS_SOURCE_AND_SUBSTITUTION_SECURITY_SUITE`,
  `SNAPSHOT_SECURITY_ATTESTATIONS`), each already `state:
  DEFERRED_POST_CUTOVER`, `blocks_cutover: false`. Section 5 never discusses
  these; they are not part of the "25 pre-production gates" the step and its
  disposition table are about, and none of the 7 ids appear anywhere in
  PLAN.md or COMPLETED.md (confirmed by grep).

The test binds the `preproduction_gates` list only, matching section 5's own
scope exactly. Binding the phase_12 ids as well would make the test fail
permanently for gates the plan never claims to have dispositioned, which is a
different (and out of scope) problem, not the one Step 1A asks for. This is a
scoping decision, not a loosening of the matching rule: within its declared
scope, the rule is unweakened (exact identifier + exact label pattern, same
line, no partial-string or case-insensitive identifier matching).

## Matching rule implemented
For each of the 25 `preproduction_gates` ids: read `PLAN.md` and
`COMPLETED.md`, split each into lines, and require at least one line that
contains the identifier as a literal substring (word-bounded) **and** either
the literal word "Retired" (case-insensitive) or a step-label pattern
(`/\bSteps?\s+\d+[A-Z]\b/`) on that same line. This mirrors the structure of
PLAN.md section 5's disposition table, where each row is one line pairing the
gate id with its disposition.

## Result

`CI=true node --test tests/programme-gates/gates-bound-to-plan.test.js`:
**EXIT=0**, 2 tests, 2 pass, 0 fail.

- Test 1 asserts `preproduction_gates` has exactly 25 entries (a sanity check
  on the scope, matching section 5's own count).
- Test 2 checks all 25 identifiers for binding. All 25 are bound: each has a
  disposition row in PLAN.md section 5 that pairs the identifier with either
  a step label or the word "Retired" on the same line. Zero unbound.

## Deletion-makes-it-fail check (actually run, not simulated)

1. Copied `docs/core/PLAN.md` to a scratch backup
   (`/tmp/claude-0/.../scratchpad/PLAN.md.orig`).
2. Deleted line 265 of the real `docs/core/PLAN.md`, the disposition row for
   `P9_REGISTRY_DISPOSITIONS`:
   `` | `P9_REGISTRY_DISPOSITIONS` | no | **Rewritten** as Step 5C. ... | ``
   Confirmed via `grep -c P9_REGISTRY_DISPOSITIONS docs/core/PLAN.md` → `0`.
3. Ran the test: `CI=true node --test tests/programme-gates/gates-bound-to-plan.test.js`
   → **EXIT=1**. Failure output named exactly one unbound id:
   `P9_REGISTRY_DISPOSITIONS`, with `actual: ['P9_REGISTRY_DISPOSITIONS']` vs
   `expected: []`. The 25-count sanity test still passed (deleting a table
   row doesn't touch the YAML); only the binding test failed.
4. Restored `docs/core/PLAN.md` from the scratch backup and confirmed
   byte-identical via `diff` (no output) and `git status --short
   docs/core/PLAN.md` (clean, no changes).
5. Re-ran the test on the restored file: **EXIT=0**, 2 pass, 0 fail.

No git command was run at any point (plain `cp`/`sed`/`diff` on the working
tree only); PLAN.md was never left modified.

## Gate identifiers checked and their binding

All 25 `preproduction_gates` identifiers are bound, each via a row in PLAN.md
section 5's disposition table:

| Gate | Bound via |
|---|---|
| `P1_CONTRACT_BUNDLE_COMPLETE` | "Closed. `COMPLETED.md` Step 0K." |
| `P1_VERTICAL_SLICE_PASS` | "Closed. `COMPLETED.md` Step 0K." |
| `P9_SCOPE_EXACT` | "Retired." |
| `P9_REGISTRY_DISPOSITIONS` | "Rewritten as Step 5C." |
| `P9_MKT_WORK` | "Rewritten as Step 8A." |
| `P9_BEN_RUNBOOK` | "Rewritten as Step 9B." |
| `P9_NUMERIC` | "Rewritten as Step 3B." |
| `P9_RENDER_PARITY` | "New criterion: Step 5C." |
| `P9_STRUCTURED_CLAIMS` | "Rewritten as Step 2D." |
| `P9_PARTY_LINT` | "Rewritten as Step 3F." |
| `P9_SHADOW_REEXTRACTION` | "Rewritten as Step 2D." |
| `P9_IDENTITY_AND_DRIFT` | "Rewritten as Step 4C ... and Step 6C." |
| `P9_BROWSER_A11Y_PERFORMANCE` | "Retired." |
| `P9_STAGING_SMOKE_AND_ROLLBACK` | "Rewritten as Step 9A." |
| `P9_DATABASE_SOAK` | "Retired." |
| `P9_BACKUP_RESTORE` | "Rewritten as Step 4F ... and Step 9B." |
| `P9_PREIMPORT_TRACEABILITY` | "Rewritten as Step 4E." |
| `P9_SECURITY_AUTH` | "Kept, as the criterion for Steps 7A to 7C." |
| `P9_DEPLOYMENT_PARITY` | "New criterion: Step 9D." |
| `P9_IMPORT_PARITY` | "Rewritten as Step 9C." |
| `P9_PROMOTION_ELIGIBILITY` | "Retired." |
| `P9_CUTOVER_AUTHORISATION` | "Kept as a human act. Step 9D needs Ben's ..." |
| `P9_POSTCUTOVER_SMOKE` | "Rewritten as Step 9E." |
| `P9_TRACEABILITY` | "Merged into ... Step 4E." |
| `P9_PROGRAMME_COMPLETION_ATTESTATION` | "Retired as an attestation." |

Zero unbound. The matching rule was not weakened to reach this result — see
"Matching rule implemented" above; it requires the literal identifier and a
literal step-label/`Retired` token on the same line, nothing looser.

Status: **done**.

