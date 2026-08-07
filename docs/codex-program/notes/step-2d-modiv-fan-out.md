# Step 2D. Fan out the families on Modiv

Written incrementally, rung by rung, so work done survives if the session
dies mid-ladder. Container: `pm-pg3` (localhost:55433, db `pm`), the same
container Step 2B/2C/4A left up. `LOCAL_CANONICAL_V2_DB_URL` used throughout
is `postgres://postgres:pm@localhost:55433/pm`.

**Cost note, recorded once.** Of the 25 registered families, 22 already had
every pinned section's response recorded from earlier sweeps (2026-08-06
originals or 2026-08-07 corrective live calls), so their full-pin runs are
zero-cost replays, not fresh model calls. Two families needed a genuinely new
full-pin evidence directory assembled by merging existing per-section
recordings across runs (`CONSIDERATION`, `KEY_DEFINED_TERMS` -- see rung 2).
Three families had no full-pin recording at all and needed live calls:
`CAPITALISATION` (missing 4.2), `CLOSING_CONDITIONS` (missing 6.3/6.4),
`MAE_DEFINITION` (never run against Modiv at all) -- all rung 3/4 work,
recorded there.

**A stale header found in passing.** `scripts/canonical-v2-live-extraction-run.mjs`'s
own `DEAL_PINS.modiv` comments for `CONSIDERATION` and `KEY_DEFINED_TERMS`
still say "NOT YET RUN... needs a live call before it produces anything" for
sections 2.6 and 8.12 respectively. Both were in fact already live-called and
recorded on 2026-08-07 (`modiv-consideration-2.6-20260807-live`,
`modiv-key-defined-terms-8.12-20260807-live`), just never assembled into one
combined run against the full corrected pin -- which is what this rung does,
at zero further model cost, by merging the existing per-section recordings.
Not fixed here (out of this step's scope), but flagged: this is the exact
stale-header failure mode `CLAUDE.md` names, just caught before anyone acted
on it.

## Method note: replay is cheaper than the plan assumed

Checking the pinned section list for all 25 families against every already-
recorded `native-producer-recorded-response-<ref>.json` fixture on disk showed
**22 of 25 families already had every pinned section recorded** (17 exactly
from their 2026-08-06 original run, 5 more -- `ANTITRUST_REGULATORY`,
`APPRAISAL_DISSENTERS_RIGHTS`, `TERMINATION_FEE`, plus 2 built this rung --
already matching via the 2026-08-07 replay directories). Only
`CAPITALISATION`, `CLOSING_CONDITIONS` and `MAE_DEFINITION` were genuinely short
a recording for at least one pinned section. `--replay-from-run` (keyed by
`section_reference`, not by order, contrary to its module header's "ordered"
framing -- see `provider-record-replay.js:179-198`) will assemble a full-pin
run from recordings that live in *different* directories, as long as every
pinned section is present *somewhere*. Used for `CONSIDERATION` and
`KEY_DEFINED_TERMS` below. This is "replay stays the default where a recorded
response exists" applied literally: a recording existing in a different
directory than the one being replayed still counts.


---

## Rung 1 -- TERMINATION_FEE (1 family)

**Already done as Step 2C, reconfirmed rather than re-run.** No code touching
extraction, the resolver, the writer or the reader has changed since 2C
landed (`0993715` and the same-day 2C commit); a change-triggered re-run
(PLAN.md's own rule) has nothing to trigger it. Reconfirmed by:

- `CI=true npm run gate:baseline` -- `OK` before any Step 2D work started.
- `pm-pg3` still holds Step 2C's write: 5 termination-fee provisions, 4
  claims, 6 conditional-fee rows, for Modiv's `document_hash`.
- `node scripts/zz-step2d-render-check.js TERMINATION_FEE <pm-pg3 url>`
  (this step's own generic render harness, see "Method note" above) --
  `attempted: true, ok: true, count: 4` cards, matching 2C's proof exactly.

**Checks:**
1. `incomplete` = 0. Yes (unchanged from Step 2A/2B's baseline).
2. `resolved` vs prior rung: no prior rung; this establishes it. `resolved=7`
   (baseline `modiv-termination-fee-20260807-replay`, `--no-follow-citations`
   caveat carried forward per Step 2B/2C -- permissive, not evidence of
   parity).
3. Still writes and serves: yes, both reconfirmed above, plus 2C's own route-level
   proof (`pages/api/review/[id]/cards.js` -> `attachCanonicalTerminationFeeServing`
   -> `termination-fees.config.js` `selectRows()`, 9 UI rows, production
   denial proven live).

**Rung 1: PASS. No regression, nothing new to report.**

---

## Rung 2 -- add CONSIDERATION, KEY_DEFINED_TERMS, APPRAISAL_DISSENTERS_RIGHTS (4 total)

### Extraction

- **CONSIDERATION**, full corrected pin `["2.1","2.2","2.3","2.6"]`: replayed
  by merging `modiv-consideration-20260806`'s recordings for 2.1/2.2/2.3 with
  `modiv-consideration-2.6-20260807-live`'s recording for 2.6 (see Method
  note). Zero model calls. New dir:
  `evidence/canonical-v2/modiv-consideration-fullpin-20260807-replay`.
  `resolved=2, review_queue=5, open_world=20, residuals=0`. Published:
  22 excerpts, 2 provisions, 2 claims.
  **This is a genuine improvement over both partial baselines** (2.1/2.2/2.3
  alone: resolved=1; 2.6 alone: resolved=1) -- the correction in Step 2A
  actually doubles what this family resolves, exactly as PLAN.md predicted:
  one of the two new claims is `APPRAISAL_RIGHTS_STATUS` from 2.6's 119-byte
  denial, landing on Consideration's own concept slot as designed.
- **KEY_DEFINED_TERMS**, full corrected pin `["8.5","8.12"]`: replayed by
  merging `modiv-key-defined-terms-20260806`'s recording for 8.5 with
  `modiv-key-defined-terms-8.12-20260807-live`'s recording for 8.12. Zero
  model calls. New dir:
  `evidence/canonical-v2/modiv-key-defined-terms-fullpin-20260807-replay`.
  `resolved=10` (identical to the 8.12-only run -- 8.5 alone still
  contributes 0 resolved, all 15 of its candidates remain the correctly-
  ungoverned construction-convention terms named in Step 2B's triage table).
  Published: 32 excerpts, 5 provisions, 10 claims.
- **APPRAISAL_DISSENTERS_RIGHTS**: already had a full-pin replay
  (`modiv-appraisal-20260807-replay`, section `["2.6"]`, matches the pin
  exactly). No new run needed. `resolved=0`, and it is still zero **for the
  documented reason**: the whole of 2.6 is the 119-byte denial sentence, and
  the appraisal producer prompt declines to assert availability from it by
  design (that responsibility sits with Consideration, confirmed above --
  its `APPRAISAL_RIGHTS_STATUS` claim landed this same rung). Not a silent
  break: same cause as Step 2B's triage recorded, re-verified against this
  rung's own run.

`npm run generate:baseline` regenerated (30/54 importable, 25 families, 225
claims, up from 213); `CI=true npm run gate:baseline` -- `OK`.

### Write: durable, against `pm-pg3`

Before this rung: `claim_revisions=23, excerpts=140, provision_instances=15,
open_world_candidates=123` (Step 2C's cumulative state: capitalisation +
interim-operating + termination-fee).

`node scripts/canonical-v2-local-durable-write.js <dir> 'postgres://postgres:pm@localhost:55433/pm'`
for each of the three new full-pin directories. All three: `status: COMMITTED`,
JS/SQL receipt ids identical. (The script's own internal "counts_match"
check compares this run's write-set claim count against the **whole table's**
cumulative claim count, so it reads `false` for any run after the first
family in a shared container -- a false negative in the script's own
sanity check, not a real problem; the real check is the delta below.)

| Table | Before rung | After rung | Delta | Sum of published (CONSIDERATION+KDT+APPRAISAL) |
|---|---|---|---|---|
| `claim_revisions` | 23 | 35 | +12 | 2+10+0=12 |
| `excerpts` | 140 | 194 | +54 | 22+32+0=54 |
| `provision_instances` | 15 | 22 | +7 | 2+5+0=7 |
| `open_world_candidates` | 123 | 160 | +37 | 20+17+0=37 |

Every delta matches the sum of the three runs' own published counts exactly,
from a fresh `psql` connection. `APPRAISAL_DISSENTERS_RIGHTS`'s write is a
genuine `COMMITTED` receipt with `publishableObjectCount: 0` -- proof that a
correct-zero family still writes a durable, empty receipt rather than being
silently skipped, which is itself part of what "still writes" needs to mean.

### Serve / render

Built a generic render-check harness this rung
(`scripts/zz-step2d-render-check.js`, **not committed** -- a verification aid
for this step, listed in "Files touched" below with instructions to delete
it) that reads a deal back through the same `readDealFromLocalCanonicalV2Staging`
termination-fee-serving-source.js already uses, then calls the real
`*-product-projection.js` function for a family with the read-back data,
exactly as a serving source would. Mapped all 25 families to their covering
projection module (or "none") by reading every module's actual exported
function and its parameter shape -- 16 modules, some taking
`{resolution, deal_id}` (which filter by family internally, confirmed against
`termination-fee-serving-source.js`'s own usage), some taking
`{resolved_entries}` directly (which do NOT filter internally and expect a
pre-filtered array -- the harness filters by `resolved_claim_definition_key`
against each module's own exported claim-key list before calling).

- **KEY_DEFINED_TERMS renders.** `projectKeyTermsMaeClaims` against the
  filtered read-back data: `ok: true, count: 10` records (plus MAE
  disproportionality rollup fields, empty here as expected -- no MAE claims
  written yet). This is the first time this family's data has been read out
  of a database and turned into product-shaped output.
- **APPRAISAL_DISSENTERS_RIGHTS**: zero resolved entries in the DB for this
  family (correct, as established above) -- not called, correct-zero case,
  consistent with `GUARANTY_FINANCING_PARTY`'s standing pattern.
- **CONSIDERATION does NOT render, and this is a real defect, not a data
  problem.** `projectConsiderationWaveAClaims` throws `PARTY_BEARING_ENTRY`:
  "A Consideration Wave A fact must not have an obligation party." Root
  cause, confirmed by printing the exact read-back entry object:
  `readGovernedClaimsForDeal` in `lib/canonical-v2/local-staging-deal-reader.js`
  **never sets a `party` key on the claim-shaped object it reconstructs** --
  grep for `party` in that file returns zero matches. The original
  `resolution.json` shape always carries `party: null` explicitly for a
  partyless fact (verified directly against
  `modiv-consideration-fullpin-20260807-replay/resolution.json`). The reader
  drops the field entirely rather than reconstructing it, so the read-back
  entry has `party: undefined`, and `consideration-wave-a-product-
  projection.js`'s own validator does a strict `entry.party !== null` check
  (deliberately, per its comment -- this is a genuine business rule: a Wave A
  "fact" claim must not carry an obligation party) that `undefined` fails
  where `null` would have passed. Two other projection modules that also read
  `entry.party` (`ioc-wave-a`, `key-terms-mae`, `termination`,
  `proxy-meeting`) use optional chaining or don't require it to equal `null`
  exactly, which is why `KEY_DEFINED_TERMS` above did not hit the same wall --
  this is specifically a shape gap between the reader and this one
  projection's strict validator, not a defect that necessarily affects every
  family with a `party` field.
  **This means CONSIDERATION writes correctly (proven above -- the delta
  matches exactly) but cannot render through its own real projection module
  from the database today.** Per Step 2D's own rule, a family with a
  projection is not passed until it renders; this rung does not pass that bar
  for CONSIDERATION. Recorded here rather than silently worked around,
  per "report what broke as prominently as what worked." Not fixed in this
  step -- fixing `local-staging-deal-reader.js`'s read shape (or relaxing the
  projection's validator) is engineering work outside a fan-out ladder's
  brief, and doing it without review would be exactly the kind of unreviewed
  serving-layer change `OPERATING-RULES.md` reserves for a diff review, not a
  verification pass.
- `TERMINATION_FEE` reconfirmed rendering (rung 1, above): unaffected by this
  rung's writes (cross-family isolation still holds, matching Step 2C
  finding 3).

### Rung 2 checks

1. **`incomplete` = 0** among the 4 families run so far. Yes -- all four are
   `importable: true` with a receipted write.
2. **No family's `resolved` fell against its own prior rung.** Only
   `TERMINATION_FEE` had a prior rung (unchanged, 7). `CONSIDERATION`,
   `KEY_DEFINED_TERMS` and `APPRAISAL_DISSENTERS_RIGHTS` are new to the
   ladder this rung -- vacuously satisfied, and for `APPRAISAL_DISSENTERS_RIGHTS`
   specifically the zero is the *same* zero as Step 2B's triage recorded, for
   the same stated reason, not a fresh unexplained one.
3. **Still writes: yes, all four, deltas verified exactly.** **Still serves:
   yes for `TERMINATION_FEE` and `KEY_DEFINED_TERMS`; correctly not-applicable
   for `APPRAISAL_DISSENTERS_RIGHTS`; NO for `CONSIDERATION`**, for the
   `PARTY_BEARING_ENTRY` reader-gap reason above.

**Rung 2: one real break found -- `CONSIDERATION` cannot render from the
database today, root-caused to a specific missing field
(`local-staging-deal-reader.js` never reconstructs `party`) in a specific
function. Understood and recorded, per the standing instruction to stop only
where a break is not understood. Continuing to rung 3 with this flagged, not
silently worked around.**

---

## Rung 3 -- add TERMINATION, SPECIFIC_PERFORMANCE_REMEDIES, MATERIAL_CONTRACTS, GENERAL_COVENANTS, REPRESENTATIONS, TAX_MATTERS, CLOSING_CONDITIONS, INTERIM_OPERATING (12 total)

### Extraction

Of the 8 new families, 7 already had full-pin recordings and were replayed at
zero model cost from their existing `modiv-*-20260807-replay` directories
(all `importable: true`, matching the pins exactly -- see the coverage table
built before this rung). Only `CLOSING_CONDITIONS` needed a live call: its
pin is `["6.1","6.2","6.3","6.4"]` and only 6.1/6.2 had ever been recorded
(6.1 from the 2026-08-06 original, 6.2 from the 2026-08-07 corrective live
run); 6.3 and 6.4 have never been attempted at all. `--replay-from-run`
cannot do a partial mix (it requires every pinned section to already have a
recording), so this needed a genuine live run over all four sections,
`--call-timeout-ms 900000` (up from the 600000 default that killed the
2026-08-06 attempt at 18.8 minutes). Dispatched to
`evidence/canonical-v2/modiv-closing-conditions-fullpin-20260807-live`.
**Result recorded in its own subsection below once it finishes** -- per the
plan, a failure here is an expected, valuable finding in itself, not a
blocker to work around.

`resolved` counts for the 7 replayed families, each matching or explained
against Step 2B's triage table: `TERMINATION=12` (up from the partial
baseline's own resolved=12, unchanged -- this pin was already complete),
`SPECIFIC_PERFORMANCE_REMEDIES=1` (the adapter defect Step 2B found and Step
3C was meant to fix -- see the projection-layer finding below, which shows
the claim reaches the database but a *different*, projection-layer bug
still drops it before it becomes a card), `MATERIAL_CONTRACTS=24`,
`GENERAL_COVENANTS=10`, `REPRESENTATIONS=0` (documented vocabulary gap,
unchanged), `TAX_MATTERS=5`, `INTERIM_OPERATING=10` (unchanged, already
durably written since Step 2C's setup).

### Write: durable, against `pm-pg3`

Before this rung: `claim_revisions=35, excerpts=194, provision_instances=22,
open_world_candidates=160`.

**BREAK 1, found and fully root-caused: `TERMINATION`'s write fails, and the
cause is a real defect in the SQL writer's identity-conflict guard, not in
the extraction or the data.**

`node scripts/canonical-v2-local-durable-write.js evidence/canonical-v2/modiv-termination-20260807-replay <pm-pg3>`
fails with `canonical excerpt identity conflict` (Postgres error code
`23505`, raised at `supabase/canonical-v2-foundation.sql:8546`/`8552`, inside
`public.canonical_v2_write`'s `DEAL_SCOPE_RUN` branch). The whole write rolls
back -- `TERMINATION` currently has zero durable rows, even though its
extraction and write-set are both clean.

**Root cause, confirmed by diffing the two families' exact excerpt payloads
for the colliding id (`726a395db666382c3a3d080837d9d8f20848c6a7e0194cef617ca3fcbfe1f236`):**
`TERMINATION` and `TERMINATION_FEE` (already durably written in Step 2C)
both cite the exact same sentence from Modiv's Article 7 as evidence -- *"the
Company Board has approved, and substantially concurrently with the
termination of this Agreement, the Company enters into, a definitive
agreement providing for the implementation of a Superior Proposal"*. Because
`excerpt_id` is a content hash of the quote text, its position and the
document (deliberately -- `OPERATING-RULES.md`'s ADR-001 says in terms "two
siblings quoting one sentence correctly share it"), both families compute the
**identical** `excerpt_id`. Every field that defines that identity is
byte-identical between the two families' payloads. The only field that
differs is `source_occurrence_id`, which is **not** one of the fields that
defines `excerpt_id` -- it records which *provision instance* cited the
excerpt as evidence (`native-producer/candidate-resolution.js:7326`,
`source_occurrence_id: citingProvision.provision_instance_id`), and each
family mints its own, different provision instance for its own claim, so
this field legitimately differs between two families that share a quote.

The guard at `canonical-v2-foundation.sql:8546` does not compare the fields
that define `excerpt_id`. It compares `canonical_payload_digest`, a hash of
the **entire** payload, against what is already stored. Since
`source_occurrence_id` is part of that whole-payload digest but not part of
the excerpt's own declared identity, two excerpts that are legitimately the
same thing by design (same `excerpt_id`) are treated as a conflict because a
field outside that identity happens to differ. **This is a defect in the
guard's comparison scope, not in either family's extraction.** It could not
surface with fewer than two families sharing a source sentence durably
written to the same deal, which is exactly what this rung is the first to
attempt -- rung 1 and 2's families (`TERMINATION_FEE`, `CONSIDERATION`,
`KEY_DEFINED_TERMS`, `APPRAISAL_DISSENTERS_RIGHTS`) never shared an evidence
sentence with each other. Not fixed here: it is a schema/writer change, the
same class of change Step 2C1 treated as needing its own reviewed diff and
digest-guard repin, not a fan-out-ladder fix.

**Secondary defect found while diagnosing this: the write script hangs on
any SQL error and never releases the container connection**, because its
`catch` block in `main()` never calls `client.end()` (only the success path
does). A backgrounded loop over multiple families therefore silently stalls
forever on the first failure rather than moving to the next family or
reporting non-zero. Worked around here by detecting and killing the hung
process externally; not fixed in the script itself (again, out of this
step's brief, and a one-line fix someone should make in review rather than
here).

Six of the seven other new-to-this-rung families wrote cleanly:

| Family | claims | excerpts | provisions | open_world | Status |
|---|---|---|---|---|---|
| `SPECIFIC_PERFORMANCE_REMEDIES` | 1 | 1 | 1 | 0 | COMMITTED |
| `MATERIAL_CONTRACTS` | 24 | 17 | 3 | 7 | COMMITTED |
| `GENERAL_COVENANTS` | 10 | 9 | 5 | 1 | COMMITTED |
| `REPRESENTATIONS` | 0 | 17 | 0 | 18 | COMMITTED (correct zero claims, open-world only) |
| `TAX_MATTERS` | 5 | 11 | 2 | 6 | COMMITTED |
| `INTERIM_OPERATING` | 10 | 55 | 9 | 46 | COMMITTED, **replayed: true** -- correctly recognised as already written from Step 2C's setup, zero new rows, idempotent replay proven live for the first time this rung |

After this rung: `claim_revisions=75, excerpts=249, provision_instances=33,
open_world_candidates=192` -- every one of these deltas equals the sum of
the six successful writes' own published counts exactly (`+40 claims = 1+24+10+0+5+0`,
etc.), verified from a fresh `psql` connection. `TERMINATION`'s 12 claims,
24 excerpts, 9 provisions and 13 open-world rows are **not** in these totals
-- its write did not commit.

### Serve / render

Ran the render-check harness (see rung 2 method) against all six newly-
written families plus a re-check of the earlier three.

- **`MATERIAL_CONTRACTS` renders**: 3 cards.
- **`GENERAL_COVENANTS` renders**: 5 cards.
- **`REPRESENTATIONS` and `TAX_MATTERS` do NOT render, and both trace to the
  SAME single root cause -- BREAK 2, more consequential than BREAK 1 because
  it is not data-dependent, it is a hardcoded string in four separate
  files.** `tax-dividends-appraisal-product-projection.js` (line 210),
  `representations-product-projection.js` (line 157),
  `financing-guaranty-product-projection.js` (line 224) and
  `ioc-wave-a-product-projection.js` (line 65) all validate a resolved
  entry's provision binding with
  `provision.schema_version !== 'PROVISION_INSTANCE/V1'`. **Every
  provision_instance actually written to `canonical_v2_staging` carries
  `schema_version: 'STRUCTURAL_PROVISION_INSTANCE/V1'`** (verified directly:
  `SELECT DISTINCT canonical_payload->>'schema_version' FROM
  canonical_v2_staging.provision_instances` returns exactly one value, and it
  is not the string these four modules check for).
  `consideration-wave-a-product-projection.js` (line 89) checks the correct,
  current string, so this is not a repo-wide convention that changed
  everywhere -- four specific modules were never updated. Concretely today:
  `TAX_MATTERS` throws `INVALID_PROVISION_BINDING` on real, correctly-written
  data (proof: `node scripts/zz-step2d-render-check.js TAX_MATTERS <pm-pg3
  url>`, `error: "The claim must bind to its governed provision instance."`).
  `FINANCING_COVENANTS`, `GUARANTY_FINANCING_PARTY`, `DIVIDENDS` and
  `APPRAISAL_DISSENTERS_RIGHTS` all resolve zero claims in the current
  baseline, so this same defect is currently masked for them -- it will fire
  the moment any of them resolves even one provision-bound claim.
  `INTERIM_OPERATING` (`ioc-wave-a`) hits a separate, prior blocker first
  (below) so this defect has not yet been directly exercised for it, but its
  own `provision.schema_version !== 'PROVISION_INSTANCE/V1'` check
  (line 65) has the identical wrong string. **Seven families' rendering is
  affected by this one defect**: `TAX_MATTERS` (proven), `REPRESENTATIONS`,
  `DIVIDENDS`, `APPRAISAL_DISSENTERS_RIGHTS`, `FINANCING_COVENANTS`,
  `GUARANTY_FINANCING_PARTY`, `INTERIM_OPERATING`. Not fixed here --
  four-file projection-layer change, needs its own review.
  (`REPRESENTATIONS`'s specific error this rung was actually a *different*,
  earlier check -- see below -- because it resolves zero governed claims and
  never reaches the schema_version line; the schema_version defect in its own
  file is real but not what blocked it today.)
- **`REPRESENTATIONS`'s actual rung-3 error is a second, separate reader gap**,
  on its *open-world* path: `"An open-world representation attribute needs
  its category, exact quote, reason and evidence."` Same shape of defect as
  `CONSIDERATION`'s `party` gap in rung 2 -- `local-staging-deal-reader.js`'s
  `readOpenWorldEvidenceForDeal` does not reconstruct every field the
  original `resolution.json` open-world entries carry, and this projection's
  open-world path validates strictly against the full original shape. Not
  investigated to the same field-level depth as the `party` bug, in the
  interest of time, but the pattern is now the same one twice, which raises
  it from "one narrow gap" to "the reader's reconstructed shape is
  incomplete in more than one place, and probably more than these two."
  This is a reader-completeness finding worth acting on before more families
  reach this path, not a one-off.
- **`SPECIFIC_PERFORMANCE_REMEDIES` writes but silently produces zero cards
  -- BREAK 3, and the most dangerous of the three because it fails
  quietly.** `remedies-misc-product-projection.js`'s `REMEDIES_DEFINITIONS`
  set contains `SPECIFIC_PERFORMANCE_AVAILABLE`. The claim definition key
  this family's resolver actually emits, and the only one
  `contract-bundle.js` governs for this concept, is
  `SPECIFIC_PERFORMANCE_REMEDY_PRESENT` (`contract-bundle.js:3649`) --
  `SPECIFIC_PERFORMANCE_AVAILABLE` does not exist anywhere as a real governed
  key. Because the module's family-membership test requires the key to be in
  that set, the claim is silently skipped (`continue`, no error, no
  residual, no log) rather than becoming a card. This is exactly the
  provision-instance-schema defect's opposite failure mode: that one throws
  loudly; this one returns `ok: true, count: 0` and looks like a family that
  legitimately has nothing to show, when it does not -- the closest thing to
  the "plausible-but-wrong" failure class `docs/CODEX-PROGRAM.md` names as
  the worst kind. This is also the family Step 2B's triage already flagged
  as having a resolver/adapter-layer defect (the
  `SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED` predicate mismatch,
  Step 3C's target) -- that defect and this one are independent and both
  real: fixing Step 3C's predicate would let more Specific Performance claims
  resolve, and every one of them would still be silently dropped by this
  separate, unrelated projection-layer bug until it is also fixed.
- **`INTERIM_OPERATING` still cannot be checked**: `projectIocWaveAClaims`
  requires `ioc_restriction_components`, which
  `readDealFromLocalCanonicalV2Staging` does not return at all (same class
  of gap Step 2C1 closed for `conditional_termination_fee_values` before it
  could bite a second family -- this is a second instance of exactly that
  pattern, not yet closed). Recorded, not exercised.
- `TERMINATION_FEE`, `CONSIDERATION`, `KEY_DEFINED_TERMS`,
  `APPRAISAL_DISSENTERS_RIGHTS` re-checked: unchanged (`4, fails on `party`
  as before, 10, correct-zero respectively) -- this rung's six new writes did
  not disturb any earlier family's cross-family isolation, matching Step 2C
  finding 3's pattern again.

### Rung 3 checks

1. **`incomplete` = 0** among families run so far. Yes for extraction (all 8
   new families are `importable: true`, including `CLOSING_CONDITIONS` once
   its live call lands -- see below). **`TERMINATION`'s write is not
   complete** (rolled back) -- flagged as BREAK 1, not silently treated as
   "ran clean."
2. **No family's `resolved` fell against its own prior rung.** All 8 new
   families are new to the ladder this rung -- vacuously satisfied, and
   `TERMINATION`'s `resolved=12` and `REPRESENTATIONS`'s `resolved=0` both
   match Step 2B's own numbers for the same reasons already on record.
3. **Still writes: 6 of 7 replayed families cleanly (`TERMINATION` did
   not, BREAK 1); `INTERIM_OPERATING` reconfirmed idempotent. Still serves:
   `MATERIAL_CONTRACTS` and `GENERAL_COVENANTS` yes; `TAX_MATTERS`,
   `REPRESENTATIONS` (open-world path), and `SPECIFIC_PERFORMANCE_REMEDIES`
   no, for three independently-diagnosed reasons (BREAK 2, a second reader
   gap, BREAK 3); `INTERIM_OPERATING` still blocked on the pre-existing
   `ioc_restriction_components` reader gap.**

**Rung 3 found three real, independently root-caused breaks plus one
previously-known reader gap recurring a second time. Per the standing
instruction, all four are understood and recorded, so the ladder continues to
rung 4 with them flagged rather than stopping -- but they are the headline of
this note, not a footnote.**

---

## Rung 4 -- all 25 families

### Extraction

12 more families beyond rung 3: `ANTITRUST_REGULATORY`, `CAPITALISATION`,
`DIVIDENDS`, `DNO_INDEMNIFICATION`, `EMPLOYEE_MATTERS`, `FINANCING_COVENANTS`,
`GUARANTY_FINANCING_PARTY`, `MAE_DEFINITION`, `MERGER_STRUCTURE_CLOSING`,
`MISC_BOILERPLATE`, `NO_OTHER_REPS_FRAUD`, `NO_SHOP`, `PROXY_MEETING` (13
names -- one, `TERMINATION`, was already added in rung 3, so this rung adds
13 new families to reach all 25). Of those, 11 already had full-pin
recordings and replayed at zero cost. Two needed live calls:

**`CAPITALISATION`**, pin `["3.2","4.2"]`. 3.2 was recorded from the
2026-08-06 original; 4.2 has never been attempted. This is the family
`PLAN.md` flags by name as having crashed at 18.8 minutes under the old
600000ms default. Dispatched with `--call-timeout-ms 1200000`.
**Result recorded below once it finishes.**

**`MAE_DEFINITION`**, Modiv pin `["8.12"]`. Never run against Modiv at all --
the only prior MAE run is TopBuild. This rung creates Modiv's first MAE
baseline rather than checking one, per the step's own framing. Queued to run
immediately after `CAPITALISATION` (sequential, not parallel, to avoid two
live model-CLI subprocesses contending for the same rate limit).
**Result recorded below.**

The 11 replayed families' `resolved` counts, each cross-checked against Step
2B's triage table where that table has an opinion: `ANTITRUST_REGULATORY=13`,
`DIVIDENDS=0` (correct zero, matches triage), `DNO_INDEMNIFICATION=4`,
`EMPLOYEE_MATTERS=0` (correct zero, matches triage),
`FINANCING_COVENANTS=0` (correct zero, matches triage),
`GUARANTY_FINANCING_PARTY=0` (**correct zero, the standing example, unchanged
for the same reason** -- Modiv is unfinanced, and the pin, family and cause
are identical to every earlier rung this family did not yet appear in),
`MERGER_STRUCTURE_CLOSING=20`, `MISC_BOILERPLATE=14`, `NO_OTHER_REPS_FRAUD=3`,
`NO_SHOP=42` (the largest single family, unchanged from its own baseline),
`PROXY_MEETING=2`.

### Write: durable, against `pm-pg3`

Before this rung (after rung 3's six successful writes): `claim_revisions=75,
excerpts=249, provision_instances=33, open_world_candidates=192`.

All 11 replayed families wrote **cleanly, zero excerpt-identity conflicts** --
none of them happened to share a source sentence with an already-written
family, so BREAK 1 (rung 3) did not recur this rung. `NO_OTHER_REPS_FRAUD`'s
write reproduced the exact receipt id (`b3332c4d...5717baf`) PLAN.md's Step
4A row already names, confirming this container's writer computes the same
deterministic receipt for the same inputs Step 4A originally proved -- and
it was a genuine new insert here (`claim_revisions` moved 126->129), not a
same-container replay, because this is a different container instance than
Step 4A's original one; the id matching is the identity function being
deterministic, not evidence of prior state in this specific container.

`CLOSING_CONDITIONS`'s full-pin live run (rung 3, finished after that rung's
note was written) wrote cleanly too: 16 claims, 21 excerpts, 10 provisions,
`claim_revisions` 173->189.

After the 11 replays plus `CLOSING_CONDITIONS`: `claim_revisions=189,
excerpts=397, provision_instances=79, open_world_candidates=235` -- every
delta checked against the sum of published counts, all exact.

### Serve / render

- **`ANTITRUST_REGULATORY` renders**: 13 cards.
- **`EMPLOYEE_MATTERS` and `DNO_INDEMNIFICATION` render** (`employee-dno-
  product-projection.js` correctly uses the current `STRUCTURAL_PROVISION_
  INSTANCE/V1` string, so these two are unaffected by BREAK 2): 2 cards each.
- **`PROXY_MEETING` renders**: 1 card (from 2 written claims -- plausibly a
  grouping design, e.g. two adjournment-reason claims folding into one
  adjournment-rights card; not investigated further, not the kind of zero
  that signals a defect).
- **`CLOSING_CONDITIONS` renders**: 6 cards from 16 claims.
- **`MISC_BOILERPLATE` writes 14 claims and silently produces zero cards --
  the SAME root cause as `SPECIFIC_PERFORMANCE_REMEDIES` in rung 3, and
  finding it a second time changes what BREAK 3 actually is.** Every one of
  the 14 written claims carries `resolved_claim_definition_key:
  "MISC_BOILERPLATE_MECHANIC_PRESENT"` and `concept_key: "MISC-BOILERPLATE"`.
  `remedies-misc-product-projection.js`'s `isMisc` test requires the key to
  be in `MISC_DEFINITIONS` (ten keys: `GOVERNING_LAW_STATE`,
  `FORUM_SELECTION_PROVISION`, `FORUM_EXCLUSIVE`,
  `ASSIGNMENT_CONSENT_RESTRICTION`, `AMENDMENT_WRITTEN_INSTRUMENT`,
  `NOTICES_PROVISION`, `ENTIRE_AGREEMENT_INTEGRATION`,
  `NO_THIRD_PARTY_BENEFICIARIES`, `SEVERABILITY_PROVISION`,
  `COUNTERPARTS_EXECUTION` -- none of them `MISC_BOILERPLATE_MECHANIC_
  PRESENT`) **and** `concept_key` to start with `ADMIN-` (actual:
  `MISC-BOILERPLATE`, fails both independently). **BREAK 3 is not "one
  family's claim key drifted" -- it is that `remedies-misc-product-
  projection.js` covers exactly two families, `SPECIFIC_PERFORMANCE_REMEDIES`
  and `MISC_BOILERPLATE`, and its membership test currently matches neither
  one's real output.** Every claim either family resolves reaches the
  database correctly and is then dropped, silently, before becoming a card.
  This is worth escalating above the other findings in this note: it is not
  a partial gap, it is total non-function for both of one module's two
  families, discovered only because this rung finally gave both families
  real data to project.
- **`NO_OTHER_REPS_FRAUD` -- fourth instance of the reader-completeness
  pattern, and a harness-methodology note.** First pass wrongly passed this
  family's checker the full 189-row cumulative `deal.resolved` array;
  `projectNoOtherRepsFraudProduct` does no family filtering of its own
  (unlike the `{resolution, deal_id}`-shaped modules) and threw on the first
  entry belonging to a different family, which was a harness bug, not a
  product one -- fixed by filtering to this family's own six governed keys
  (`contract-bundle.js:3657`) before calling, matching how the harness
  already treats the other direct-`resolved_entries` modules. After that fix,
  a real error remains: `"canonical JSON does not support undefined"`, from
  the shared `canonicalJson` utility (`lib/canonical-v2/canonical-bytes.js`)
  somewhere downstream of card-id construction. Not traced to the exact
  missing field in the interest of time, given three other instances of this
  same class (`party` root-caused fully in rung 2; the open-world-attribute
  gap in rung 3; this one) already establish the pattern past reasonable
  doubt: **`local-staging-deal-reader.js`'s reconstructed entry shape is
  missing more than one field the original `resolution.json` shape always
  carried, and every family whose projection validates strictly against the
  full original shape is at risk until the reader is completed field-by-
  field against that original shape, not gap-by-gap as each one is
  separately discovered.**
- `MATERIAL_CONTRACTS`/`GENERAL_COVENANTS`/`KEY_DEFINED_TERMS`/
  `TERMINATION_FEE` reconfirmed rendering unchanged; `CONSIDERATION`,
  `TAX_MATTERS`, `REPRESENTATIONS` reconfirmed still blocked for the same
  reasons already on record (not re-quoted here).
- Families with genuinely no covering `*-product-projection.js` module,
  confirmed by construction (not by absence of testing):
  `MERGER_STRUCTURE_CLOSING`, `NO_SHOP` (the largest resolving family in the
  whole corpus, 42 claims, with nowhere to render them), and, pending its
  live run, `CAPITALISATION`. These pass the rung at the write-and-read-back
  step per the step's own rule; the missing projection is the finding, and
  building it is Stage 5's job.
- `DIVIDENDS`, `FINANCING_COVENANTS`, `EMPLOYEE_MATTERS`-as-DNO-sharing-a-
  family all resolve zero this rung, so BREAK 2 (the `PROVISION_INSTANCE/V1`
  string) remains masked for `DIVIDENDS` and `FINANCING_COVENANTS`
  specifically (unmasked already for `TAX_MATTERS`), and confirmed NOT
  masked for `EMPLOYEE_MATTERS`/`DNO_INDEMNIFICATION` because those two
  render through a different, correctly-updated module.

### Rung 4 checks, extraction and write halves (render/serve continues below once CAPITALISATION and MAE_DEFINITION land)

1. **`incomplete` = 0** among the 23 families with a durable write so far
   (25 registered minus `TERMINATION`, blocked by BREAK 1, minus
   `CAPITALISATION`/`MAE_DEFINITION` still running).
2. **No family's `resolved` fell against its prior rung.** Every family
   newly added this rung is new to the ladder -- vacuously satisfied, and
   `GUARANTY_FINANCING_PARTY`'s zero is confirmed **for the same standing
   reason**, not a fresh unexplained one.
3. **Still writes: 11 of 11 replayed families cleanly, zero new excerpt
   conflicts.** Still serves: `ANTITRUST_REGULATORY`, `EMPLOYEE_MATTERS`,
   `DNO_INDEMNIFICATION`, `PROXY_MEETING`, `CLOSING_CONDITIONS` yes;
   `MISC_BOILERPLATE` and `NO_OTHER_REPS_FRAUD` no, for BREAK 3 and the
   fourth reader-gap instance respectively; `MERGER_STRUCTURE_CLOSING` and
   `NO_SHOP` correctly pass at the write-and-read-back bar (no projection
   module exists, named here rather than silently treated as passing the
   full bar).

### CAPITALISATION -- BREAK 4, and the most consequential defect this ladder found

**The `--call-timeout-ms` flag PLAN.md tells this step to use is dead code
past argument parsing. It has never actually reached a `claude -p`
subprocess call, for any family, ever.**

Ran `node scripts/canonical-v2-live-extraction-run.mjs --deal modiv --family
CAPITALISATION --out-dir evidence/canonical-v2/modiv-capitalisation-fullpin-20260807-live
--call-timeout-ms 1200000` (double the 600000 default, per the step's own
instruction, because this exact family is named as having been killed at
18.8 minutes before). It failed after **exactly** 606,899ms:

```
EXTRACTION FAILED after 606899ms, 0 call(s) completed: NativeProducerAnthropicError:
native producer model call failed after 1 attempt(s): model call failed: claude -p
timed out after 600000ms
```

**600000, not 1,200,000.** The flag was supplied, parsed without error
(`--call-timeout-ms` is a recognised argument, `parseArgs` stores it as
`out.timeoutMs`), and then silently discarded. Root cause, traced
end to end:

1. `parseArgs` (`canonical-v2-live-extraction-run.mjs:473-479`) parses
   `--call-timeout-ms` into `out.timeoutMs` correctly.
2. `resolveRunConfig(args)` (`:515-563`) builds the `config` object every
   other part of the run reads from -- and its `Object.freeze({...})` return
   statement (`:546-562`) copies `deal`, `dealPin`, `family`, `rawHtmlPath`,
   `sectionRefs`, `agreementDate`, `model`, `followCitations`, `dryRun`,
   `outDir`, `recordPath`, `replayPath`, `replayFromRunDir`,
   `v1SnapshotPath` -- **`timeoutMs` is not one of them.** `args.timeoutMs`
   is read nowhere in this function. The frozen object it returns has no
   `timeoutMs` key, ever, regardless of what was passed on the command line.
3. `makeMeasuredCliClient` (`:936`) does
   `runClaudeCli(prompt, { model, ...(config.timeoutMs ? { timeoutMs:
   config.timeoutMs } : {}) })` -- correctly conditional, but `config` here
   is exactly the object from step 2, so `config.timeoutMs` is always
   `undefined`, the spread always contributes nothing, and `runClaudeCli`
   (`:859`) always falls back to its own parameter default,
   `timeoutMs = 10 * 60 * 1000` = 600000.

**This directly contradicts a claim already on record.** Step 2D's own text
in `PLAN.md` says *"commit `ae8b12de` made the timeout configurable"*. The
CLI surface is configurable -- the flag exists and parses. The
configuration never reaches the subprocess it is supposed to bound. Nobody
had exercised it against a call that actually needed more than ten minutes
since that commit landed, so a dead pass-through and a working one look
identical on every call that finishes inside the default. This rung is the
first time anyone has. It is exactly the class of failure `PLAN.md` itself
names as this programme's second most expensive lesson: *"believing
something works because it has never been run."*

**Not fixed here.** A one-line fix (`timeoutMs: args.timeoutMs,` added to
`resolveRunConfig`'s return object) is obvious, but this is a runner-script
change outside a fan-out ladder's brief, and OPERATING-RULES.md's own
convention is that a defect found by verification gets reported, not
patched in the same pass that found it.

**Consequence for this rung.** `CAPITALISATION` could not be completed with
the tooling as it stands -- not because the model is slow on this section
(8,186 bytes, one of the smaller pinned sections in the whole corpus, and
zero of its two calls completed even the first one in ten minutes, which is
itself worth someone's attention separately from the timeout-plumbing bug)
but because no run of this family can currently run longer than ten minutes
regardless of what timeout is requested. `CAPITALISATION` therefore remains
**incomplete** at the close of this ladder -- reported as exactly that, not
worked around with an ad hoc bypass script whose provenance the rest of this
programme's tooling could not trace.

### MAE_DEFINITION -- first Modiv baseline, established cleanly

**No baseline existed to compare against; this creates one, per the step's
own framing.** Ran live (no `--call-timeout-ms` override needed --
`resolveRunConfig`'s omission means it would have been ignored anyway, see
BREAK 4, and this call finished inside the default regardless):
`node scripts/canonical-v2-live-extraction-run.mjs --deal modiv --family
MAE_DEFINITION --out-dir evidence/canonical-v2/modiv-mae-definition-20260807-live`.
**Succeeded in 254,677ms (~4.2 minutes), one model call, 0 rejected
candidates**: `resolved=10, review_queue=34, open_world=4, residuals=0`,
publishable claims 10. Both Modiv MAE prongs (`"Company Material Adverse
Effect" means` and `"Parent Material Adverse Effect" means`, both inside
8.12, both independently located by Step 2A's own byte-offset proof) are
covered by this single dispatch, matching the pin.

Written durably: `claim_revisions` 189->199 (+10), matching published
exactly. Receipt `bca1d999...4546f158`, `status: COMMITTED`.

**Render check hits the same reader-completeness class of defect a fifth
time, on a different path through the same module that rendered
`KEY_DEFINED_TERMS` cleanly two rungs ago.** `projectKeyTermsMaeClaims`'s
`KEY_TERM_CLAIMS` branch (what `KEY_DEFINED_TERMS` exercises) works from the
database. Its `MAE_CLAIMS` branch does not: `"canonical JSON does not
support undefined"`, from the shared `canonicalJson` utility, the same
error signature `NO_OTHER_REPS_FRAUD` hit in rung 4. Not traced to the exact
field for the same reason stated there -- five independent instances of one
pattern is past the point where finding a sixth adds information; completing
`local-staging-deal-reader.js`'s reconstructed shape against the original
`resolution.json` shape field-by-field is the actual fix, not another gap
report.

**Checks:** `incomplete` -- now resolved (was the last of the 25 families
without any run at all); `resolved` -- no prior rung to fall against, first
baseline as expected; writes -- clean; serves -- no, same reader gap as
`NO_OTHER_REPS_FRAUD` and `REPRESENTATIONS`'s open-world path.

---

## Close-out: all 25 families, final state

`npm run generate:baseline` regenerated after `MAE_DEFINITION`:
**32/56 importable, 25 families, 251 claims.** Final durable-write state in
`pm-pg3`: `claim_revisions=199, excerpts=411, provision_instances=81,
open_world_candidates=239`.

**Every registered family now has a full-pin (or, for `CAPITALISATION`, best
-available) Modiv run.** Summary, `resolved` = `published.claims` for every
row below (no family has a residual or a resolved-but-unpublished gap):

| Family | Pin | `resolved` | Written durably? | Renders? |
|---|---|---|---|---|
| `TERMINATION_FEE` | full | 7 (4 published, `--no-follow-citations`, permissive) | yes (2C) | **yes** |
| `CONSIDERATION` | full | 2 | yes | no -- BREAK: reader drops `party` |
| `KEY_DEFINED_TERMS` | full | 10 | yes | **yes** |
| `APPRAISAL_DISSENTERS_RIGHTS` | full | 0, correct by design | yes (empty receipt) | correct zero, N/A |
| `TERMINATION` | full | 12 | **NO -- BREAK 1** | N/A, unwritten |
| `SPECIFIC_PERFORMANCE_REMEDIES` | full | 1 | yes | no -- BREAK 3 |
| `MATERIAL_CONTRACTS` | full | 24 | yes | **yes** |
| `GENERAL_COVENANTS` | full | 10 | yes | **yes** |
| `REPRESENTATIONS` | full | 0 (governed); 18 open-world | yes | no -- reader gap (open-world path) |
| `TAX_MATTERS` | full | 5 | yes | no -- BREAK 2 |
| `CLOSING_CONDITIONS` | full | 16 | yes | **yes** |
| `INTERIM_OPERATING` | full | 10 | yes | not checkable -- reader missing `ioc_restriction_components` |
| `ANTITRUST_REGULATORY` | full | 13 | yes | **yes** |
| `CAPITALISATION` | **partial (3.2 only)** | 9 | yes (partial pin only) | no projection module exists |
| `DIVIDENDS` | full | 0, correct | yes (empty receipt) | correct zero, N/A |
| `DNO_INDEMNIFICATION` | full | 4 | yes | **yes** |
| `EMPLOYEE_MATTERS` | full | 0, correct | yes (empty receipt) | correct zero, N/A |
| `FINANCING_COVENANTS` | full | 0, correct | yes (empty receipt) | correct zero, N/A (BREAK 2 latent) |
| `GUARANTY_FINANCING_PARTY` | full | 0, correct (standing example) | yes (empty receipt) | correct zero, N/A (BREAK 2 latent) |
| `MAE_DEFINITION` | full, **first Modiv baseline** | 10 | yes | no -- reader gap (MAE path) |
| `MERGER_STRUCTURE_CLOSING` | full | 20 | yes | no projection module exists |
| `MISC_BOILERPLATE` | full | 14 | yes | no -- BREAK 3 |
| `NO_OTHER_REPS_FRAUD` | full | 3 | yes | no -- reader gap |
| `NO_SHOP` | full | 42 (largest in the corpus) | yes | no projection module exists |
| `PROXY_MEETING` | full | 2 | yes | **yes** |

**211 claims resolved across all 25 families' best-available Modiv runs;
199 durably in `pm-pg3`; the 12-claim gap is exactly `TERMINATION`'s
unwritten claims (BREAK 1), and nothing else.**

**No family's `resolved` count fell against its own most recent prior rung,
at any rung, for any family.** Checked explicitly at every rung above, and
re-verified here against the final baseline: every family's full-pin
`resolved` count in the table above is greater than or equal to whatever
partial or prior figure preceded it in this document, or Step 2B's own
triage table where a family predates this ladder.

### The four breaks and the reader-gap pattern, ranked by what they block

1. **BREAK 4 (`--call-timeout-ms` is dead code past argument parsing)** --
   the highest-value finding. It blocks not just `CAPITALISATION` today but
   *every* future family or document whose call genuinely needs more than
   ten minutes, silently, because the flag looks like it works (no error, no
   warning) right up until a call actually needs the extra time.
2. **BREAK 1 (excerpt identity-conflict guard checks the whole payload
   digest, not the fields that define `excerpt_id`)** -- blocks any two
   families that happen to quote the same source sentence from being durably
   written to the same deal together. Found on the first pair that shares a
   sentence (`TERMINATION`/`TERMINATION_FEE`); will recur on the next such
   pair in this corpus or the next document, and gets more likely as more
   families accumulate in one deal.
3. **BREAK 3 (`remedies-misc-product-projection.js` matches neither of its
   two covered families' real claim-definition keys)** -- total, silent
   non-function for `SPECIFIC_PERFORMANCE_REMEDIES` and `MISC_BOILERPLATE`
   specifically. Contained to one module, but that module currently produces
   zero cards no matter what data reaches it.
4. **BREAK 2 (`PROVISION_INSTANCE/V1` vs the real
   `STRUCTURAL_PROVISION_INSTANCE/V1`)** -- confirmed live on `TAX_MATTERS`,
   latent on six more families the moment they resolve a provision-bound
   claim.
5. **The reader-completeness pattern (`local-staging-deal-reader.js`'s
   reconstructed entry shape omits fields the original `resolution.json`
   shape always carried)** -- not one bug but a class, found five times
   (`CONSIDERATION`'s `party`, `REPRESENTATIONS`'s open-world attributes,
   `NO_OTHER_REPS_FRAUD`, `MAE_DEFINITION`'s MAE path, and the
   `INTERIM_OPERATING`/`ioc_restriction_components` case, which is a missing
   *collection* rather than a missing *field* but the same root failure mode:
   the reader was built and extended family-by-family, each time covering
   exactly what the family in front of the author needed, never against the
   original shape as a whole).

None of these five were visible before this rung, because none of them could
be: every one needs either two families sharing a container (BREAK 1), a
call that needs real time (BREAK 4), or a family that actually resolves data
and gets read back out (BREAK 2, BREAK 3, the reader gaps) -- and this is the
first time in the programme that every registered family has had both a
real write and a real read-back attempted against the same deal in the same
container.

Two secondary findings, smaller but worth keeping: the durable-write script
hangs forever on any SQL error rather than closing its connection and
exiting (found diagnosing BREAK 1, worked around by killing the hung
process); and the `DEAL_PINS.modiv` header comments for `CONSIDERATION` and
`KEY_DEFINED_TERMS` are stale, still claiming a live call is needed for
sections that were in fact already called and recorded.
