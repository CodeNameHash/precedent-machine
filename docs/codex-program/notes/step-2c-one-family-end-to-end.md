# Step 2C. TERMINATION_FEE on Modiv, end to end

2026-08-07. `TERMINATION_FEE` extracted -> validated -> written durably to
`canonical_v2_staging` -> read back -> rendered through the real review-table
config, in a permitted local runtime, against `pm-pg3` (the container Step 2B
and Step 4A left up on port 55433).

## 1. Baseline

`npm run gate:baseline` (CI=true) passed unchanged:

```
[baseline] OK: evidence/canonical-v2/baseline-manifest.json matches what the evidence directories produce
```

`evidence/canonical-v2/baseline-manifest.json`'s `TERMINATION_FEE` row
(`modiv-termination-fee-20260807-replay`, `section_references: ["7.1","7.3","8.12"]`):

| Field | Value |
|---|---|
| `resolved` | 7 |
| `review_queue` | 19 |
| `open_world` | 16 |
| `residuals` | 1 |
| `importable` | true |
| `published.excerpts` | 20 |
| `published.provisions` | 5 |
| `published.claims` | 4 |
| `published.relationships` | 0 |
| `published.components` | 0 |

**Caveat carried forward, not re-litigated.** This baseline is the
`--no-follow-citations` replay, matching the 2026-08-05 run it replays
(`run-manifest.json`: `follow_citations: false`). The stronger citation-
following run (9 resolved) is not the baseline entry. A pass here is
permissive, not evidence of parity — stated per the step's own instruction.

## 2. Write: durable, against `pm-pg3`

`pm-pg3` was already up (17+ minutes) with `modiv-capitalisation` (9 claims,
1 provision) and `modiv-interim-operating` (10 claims, 9 provisions) already
written durably — 19 claims, 10 provisions, 120 excerpts, 107 open-world
candidates, 0 conditional-fee rows, 17 write receipts, before this step ran.

```
node scripts/canonical-v2-local-durable-write.js \
  evidence/canonical-v2/modiv-termination-fee-20260807-replay \
  'postgres://postgres:pm@localhost:55433/pm'
```

Result: `status: COMMITTED`, JS and SQL receipt ids identical
(`9b38f9bf0ce6a5d2398c841dcb5313dd6d2af8f41c7462498959a009a502de7b`),
`publishable_counts` from the run's own write-set: `excerpts: 20`,
`provisions: 5`, `claims: 4`, `relationships: 0`, `components: 0` —
**matches the baseline row exactly**. The same write-set also carried
`conditional_termination_fee_values: 6` and `open_world_candidates: 16`
(plus their occurrence/evidence/disposition siblings, 16 each), confirming
Step 4A3's conditional-fee wiring and the open-world ruling both fire for
this family too, not only for the two families 4A2/4A3 originally proved
them against.

**Written-versus-database, from a fresh `psql` connection opened after the
write, not reused from the write script's own session:**

| Table | Before this step | After | Delta | Baseline says |
|---|---|---|---|---|
| `provision_instances` (TERMF/REM concept keys) | 10 total, 0 termination-fee | 15 total, **5** termination-fee | +5 | 5 |
| `excerpts` | 120 | **140** | +20 | 20 |
| `claim_revisions` | 19 | **23** | +4 | 4 |
| `conditional_termination_fee_values` | 0 | **6** | +6 | (not in `published`, see below) |
| `open_world_candidates` | 107 | **123** | +16 | (not in `published`, see below) |
| `write_receipts` | 17 | **18** | +1 | — |

Counts written match counts read, from a fresh connection. The
`conditional_termination_fee_values` and `open_world_*` deltas are not part
of `scripts/canonical-v2-baseline-manifest.mjs`'s `COUNTED_COLLECTIONS`
(it counts `excerpts/provisions/claims/relationships/components/
definition_occurrences/condition_groups` only), so they have no baseline
number to compare against by construction — not a discrepancy, a different
measure.

## 3. The wiring this step owns

**Before this step**, `attachCanonicalTerminationFeeServing`
(`lib/canonical-v2/termination-fee-serving-source.js`) — the one function
`pages/api/review/[id]/cards.js:55` calls — had a registry
(`CANONICAL_TERMINATION_FEE_SOURCES`) hardcoded to one entry: QXO/TopBuild,
reading a committed fixture file synchronously. No entry existed for Modiv,
and no code path in this module ever opened a database connection.

**Change made, in `lib/canonical-v2/termination-fee-serving-source.js`:**

- A new registry entry, keyed by `MODIV_DEAL_ID` =
  `dfaa71fa-9723-4794-825d-bd5024aa0b5d` — the real production deal id,
  verified against `lib/generated/home-deal-directory-v1.json` and
  `lib/four-deal-local-demo.js`, both of which register this exact string
  for "Global Net Lease / Modiv Industrial", and against every committed
  `tests/fixtures/review-parity/cases/*/dfaa71fa-modiv.case.json`, which
  carries the same `document_hash` this step wrote against
  (`659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968`).
- `buildModivTerminationFeeCardsFromDatabase(dealId, { env })`: opens a `pg`
  `Client` against `env.LOCAL_CANONICAL_V2_DB_URL` (same env var name
  `scripts/canonical-v2-local-durable-write.js` and its siblings already
  use), calls `readDealFromLocalCanonicalV2Staging` (Step 2B/2B3's reader,
  unmodified) plus one additional direct query against
  `canonical_v2_staging.conditional_termination_fee_values` (that table has
  no `document_hash` or any deal-scoping column at all yet — PLAN.md Step
  2B1 item 4 — so this reads every row in the table; correct only because
  Modiv is the sole deal that has ever written to it, and the module says so
  in a comment rather than silently assuming it), and runs the real
  `projectTerminationFeeProductSurfaces`.
- **The one non-trivial design problem**: `describeCanonicalTerminationFeeSource`
  and `attachCanonicalTerminationFeeServing` previously assumed every
  builder was synchronous (`const built = build(dealId)`, never awaited). A
  database read cannot be synchronous. Rather than making both functions
  unconditionally `async` — which would have forced an `await` onto every
  existing caller across `tests/canonical-v2-termination-fee-serving-
  switch.test.js`, `tests/canonical-v2-termination-fee-both-sources.test.js`
  and others that call them synchronously today — both functions now detect
  whether the builder's return value is thenable. A synchronous builder
  (QXO, still) returns the plain `{ cards, outcome }` object, byte-identical
  to before. The new async builder (Modiv) returns a `Promise` of the same
  shape, and `cards.js` now `await`s the call (a one-line, no-risk change,
  since `await` on a non-Promise value resolves to that value unchanged on
  the next microtask — every pre-existing caller is unaffected whether or
  not it awaits).
- `pages/api/review/[id]/cards.js:55`: `attachCanonicalTerminationFeeServing`
  is now `await`ed, matching the `attachCanonicalV2Preview` call one line
  above it.

**Proof the mechanism doesn't disturb the existing QXO path**: 41/41
`canonical-v2-termination-fee-serving-switch.test.js`, 113/113 across
`canonical-v2-termination-fee-both-sources`,
`canonical-v2-parity-serving-boundary`, `canonical-v2-parity-serving-path`,
`canonical-v2-review-preview-route`, `canonical-v2-local-staging-deal-
reader`, 24/24 `programme-gates/m3-family-parity-register.spec.js` — all
unchanged, all still green, none needed editing.

## 4. Rendering, proven by test, not by eyeballing a screenshot

**Deliberately did not touch Supabase.** `fetchReviewDealCards()` (the first
call in `cards.js`) reads the `deals` table through `getServiceSupabase()`,
which in this sandbox points at a real project
(`sjumbznveyyiizhwvixj.supabase.co`) with no way from here to confirm it is a
disposable non-production database. This repo's authority for production
data access is NONE, so this step's render proof builds the same minimal
`reviewDeal` shape `fetchReviewDealCards` + `attachCanonicalV2Preview` would
hand to `attachCanonicalTerminationFeeServing` by hand and exercises that one
function — the actual, unmodified call site `cards.js` reaches — against the
real `canonical_v2_staging` container instead. Same discipline
`scripts/canonical-v2-local-staging-read-proof.js` already uses for the read
half.

`node scripts/canonical-v2-modiv-termination-fee-serving-proof.js
'postgres://postgres:pm@localhost:55433/pm'` — all checks passed:

- Database holds 5 termination-fee provisions and 6 conditional-fee rows for
  Modiv's `document_hash`.
- `attachCanonicalTerminationFeeServing` (real registry, real deal id, no
  test double) resolves `ATTACHED`, 6 cards, concept keys `TERMF-TARGET` x3,
  `TERMF-REVERSE` x2, `TERMF-TAIL` x1.
- The served payload survives `trimReviewDealForWire` (the actual wire trim
  the route applies).
- **`components/review/table-configs/termination-fees.config.js`'s real
  `selectRows()`** — the same function the review page's table calls —
  renders **9 rows** from the served payload, including:
  - `termination-fees-serving-source`, `servingSourceState: 'CANONICAL'`
  - `termination-fees-COMPANY_TERMINATION_FEE`: *"Lesser of $10,000,000
    (§7.3(b)(iii), (ii) or (i)) or $15,000,000 (§7.3(b)(v) or (iv)) and the
    REIT Requirements cap"* — the Modiv headline number Ben's decision 3 and
    Step 4A3 were about, now reaching an actual UI-shaped row from the
    database, not a fixture.
  - `termination-fees-REVERSE_TERMINATION_FEE`: *"1.0% of deal value ·
    $15,000,000 raw amount · Payable by Parent / Buyer to Company / Target"*
  - Six `Not yet extracted` placeholder rows for the fields `FEE_DEFINITIONS`
    does not yet cover (expense reimbursement, naked-no-vote, sole remedy,
    willful-breach effect/sole, interest) — the config's designed fallback,
    not a bug.
- **Production denial, proven by removing the guard and watching it actually
  fire, not merely asserting the end state.** With the exact same poisoned
  `LOCAL_CANONICAL_V2_DB_URL` (`postgres://nobody:nobody@127.0.0.1:1/nope`):
  - `VERCEL_ENV=production` -> `attachCanonicalTerminationFeeServing`
    returns the **exact same object reference**, synchronously, no field
    added, database never reached.
  - The same poisoned URL in a **permitted** runtime (`NODE_ENV=test`, no
    Vercel env) *does* get used and surfaces `FAILED` /
    `ECONNREFUSED` — proving the production result above is caused by the
    runtime gate, not by the URL happening to go unread. Reproduced again in
    the hermetic suite (`tests/canonical-v2-termination-fee-modiv-database-
    source.test.js`, "the SAME poisoned DB url DOES get used in a permitted
    runtime").

**Hermetic coverage for CI** (no live database, `tests/canonical-v2-
termination-fee-modiv-database-source.test.js`, 13/13 passing): registry
wiring, the dual sync/async return shape in both directions, fail-loud on a
missing `LOCAL_CANONICAL_V2_DB_URL`, and both production-denial paths for
this exact deal id (`NODE_ENV=production`, `VERCEL_ENV=production`), plus the
guard-fires-when-removed proof above.

## 5. What is wired versus still hardcoded

| | State |
|---|---|
| QXO/TopBuild source | Unchanged: pinned fixture, synchronous, in-memory |
| Modiv source | **New**: reads `canonical_v2_staging` over a real `pg.Client`, gated the same way (`isPermittedCanonicalV2Runtime`) |
| Registry | Still a hardcoded object literal (`CANONICAL_TERMINATION_FEE_SOURCES`) with two entries now instead of one. Adding a third deal still means editing this file — no generic "any deal with data in staging" fallback exists yet. That generalisation is fan-out (Step 2D), not this rung |
| `conditional_termination_fee_values` read | **New, and narrow.** Read directly by the Modiv builder, not folded into `local-staging-deal-reader.js`'s generic contract, because the table has no deal-scoping column — see below |
| DB connection string | New env var reused from the write-side scripts (`LOCAL_CANONICAL_V2_DB_URL`), server-only, never `NEXT_PUBLIC_` |

## 6. Found to be wrong / worth flagging

1. **`canonical_v2_staging.conditional_termination_fee_values` has no
   deal-scoping column**, confirmed directly (`\d` + `jsonb_object_keys` on a
   live row): no `document_hash`, no `deal_id`, nothing. PLAN.md Step 2B1
   item 4 already named this as a schema gap for a *second* deal with a
   formula fee; this step is the first time it was actually exercised by a
   generic reader, and confirms the gap is real, not hypothetical. Worked
   around here by reading the whole table (documented, not hidden) because
   Modiv is still the only deal with any rows in it. **This will silently
   mix two deals' conditional-fee rows the day a second deal writes to this
   table** — flagging now so it isn't rediscovered as a fresh surprise.
2. **`local-staging-deal-reader.js`'s generic contract still does not cover
   conditional-fee values.** I deliberately did not fold the new query into
   that module (it would have required threading a non-thenable-safe path
   through 13 hermetic tests that assume its fixed table set), so the
   read-side fix is local to the termination-fee source rather than generic.
   Whichever family gets read-side generalisation next should either extend
   `local-staging-deal-reader.js` properly (once the scoping column exists)
   or repeat this same narrow, documented workaround.
3. **The `pm-pg3` container's counts are cumulative across three families**
   now (capitalisation, interim-operating, termination-fee), all sharing one
   `document_hash`. `readGovernedClaimsForDeal` and `readOpenWorldEvidenceForDeal`
   correctly scope by `document_hash`, so cross-family rows are NOT visible
   to the termination-fee projection incorrectly — verified directly (the 9
   rendered rows above contain zero capitalisation/interim-operating
   content). Recorded because it was the first thing checked, not assumed.

## 7. Acceptance, checked against the step's own five points

1. **Extraction matches the baseline.** `gate:baseline` passes unchanged;
   the write-set's own `published` counts (20/5/4/0/0) equal the baseline
   row exactly. Caveat: this baseline is the `--no-follow-citations` replay,
   so this is a permissive pass, not evidence of parity — stated per the
   step's instruction, not omitted.
2. **Staging holds the rows.** Counts written = counts read, from a fresh
   `psql` connection, table by table, in section 2 above.
3. **The review surface renders the family, in a permitted runtime, proven
   by a test reading the served payload back.** Section 4: the real
   `attachCanonicalTerminationFeeServing` -> the real wire trim -> the real
   `termination-fees.config.js` `selectRows()`, producing the actual
   $10,000,000/$15,000,000 headline row a reviewer would see.
4. **Production denial unchanged, proven by a test — and proven to actually
   fire**, not merely asserted: the same poisoned DB url is reached in a
   permitted runtime and refused in a production-shaped one.
5. **Targeted tests green with exit codes; lint exits 0.** 301 tests across
   ten targeted files, `EXIT=0` each time reported here, no output piped
   into `head`/`tail` before checking `$?`.
   `bash scripts/lint/forbidden-patterns.sh .` -> `INVARIANT-4: PASS`,
   `EXIT=0`, both against the changed-file set and against a full scan.

## Files touched

- `lib/canonical-v2/termination-fee-serving-source.js` — Modiv registry
  entry, dual sync/async return shape, new exports (`MODIV_DEAL_ID`,
  `MODIV_DOCUMENT_HASH`, `CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY`,
  `buildModivTerminationFeeCardsFromDatabase`).
- `pages/api/review/[id]/cards.js` — one `await` added.
- `tests/canonical-v2-termination-fee-modiv-database-source.test.js` — new,
  13 hermetic tests.
- `scripts/canonical-v2-modiv-termination-fee-serving-proof.js` — new, the
  live-container proof this note's section 4 reports.

## Not done here, by design

- No change to `local-staging-deal-reader.js`'s generic contract (see
  finding 2 above).
- No hosted/Supabase deployment of anything — local-only, per the ground
  rules and per Step 2B2's own scope (`SECURITY DEFINER` design, not
  applied here).
- Step 2D's fan-out (four families, then twelve, then all 25) is explicitly
  out of scope for this rung.
