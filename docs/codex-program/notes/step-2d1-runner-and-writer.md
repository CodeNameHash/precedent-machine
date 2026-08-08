# Step 2D1, defects 1 and 2 — runner timeout and writer identity guard

Working notes, written incrementally. Owns:
`scripts/canonical-v2-live-extraction-run.mjs`,
`supabase/canonical-v2-foundation.sql`,
`scripts/canonical-v2-local-durable-write.js`, and tests added for both.

## Defect 1 — `--call-timeout-ms` dead past argument parsing

Confirmed exactly as described: `parseArgs` (line ~477) sets `out.timeoutMs`,
but `resolveRunConfig`'s frozen return object (line ~549) never included it.
`config.timeoutMs` read at the `runClaudeCli` call site (line ~936, inside
`makeMeasuredCliClient`) was therefore always `undefined`, and
`runClaudeCli`'s own default parameter (`timeoutMs = 10 * 60 * 1000`) silently
took over regardless of the flag.

**Fix**: added `timeoutMs: args.timeoutMs,` to the frozen config object in
`resolveRunConfig`.

**PLAN.md correction**: line ~1338 claimed commit `ae8b12de` "made the timeout
configurable". Read the commit (`git show ae8b12de`): it added
`--call-timeout-ms` parsing and validation, and separately recorded the
guaranty-zero-is-correct finding. It never touched `resolveRunConfig`'s return
object, so the flag never reached the client before this fix. Corrected in
place with a note that the "recoveries" logged against that commit predate the
real fix and are not evidence the flag worked.

**Test**: `tests/canonical-v2-live-extraction-run-call-timeout-wired.test.js`,
4 cases — real `import()` of the `.mjs` runner (no mocking, `isMainModule`
guard confirmed false on import so `main()` never runs), asserting
`parseArgs` -> `resolveRunConfig` actually carries `--call-timeout-ms` through
to `config.timeoutMs`, defaults to `null` when omitted, plus two source pins:
the frozen-object literal assigns `timeoutMs: args.timeoutMs,` and the
`runClaudeCli(...)` call site inside `makeMeasuredCliClient` threads
`config.timeoutMs` through. `runClaudeCli`/`makeMeasuredCliClient` are not
exported (they spawn a real `claude` subprocess) so the two source pins close
the gap between "config carries the value" and "the client receives it"
without widening the module's exported surface.

Command: `CI=true node --test
tests/canonical-v2-live-extraction-run-call-timeout-wired.test.js` — 4/4 pass.

### Live CAPITALISATION run on 4.2

Command:

```
node scripts/canonical-v2-live-extraction-run.mjs --deal modiv --family CAPITALISATION \
  --call-timeout-ms 1200000 \
  --out-dir evidence/canonical-v2/modiv-capitalisation-20260807-step2d1-fix-live
```

Pre-fix evidence of the failure this proves fixed:
`evidence/canonical-v2/modiv-capitalisation-fullpin-20260807-live/call-telemetry.json`
records `"error": "native producer model call failed after 1 attempt(s):
model call failed: claude -p timed out after 600000ms"` -- the hardcoded
default, despite `--call-timeout-ms` having been passed on that run too.
Section 4.2 (Definitions) had never completed.

**Result: the timeout defect is fixed and proven live, twice independently.**
`evidence/canonical-v2/modiv-capitalisation-20260807-step2d1-fix-live/call-telemetry.json`:
section 3.2's call ran 550,888ms wall-clock, section 4.2's ran **633,833ms** --
past the hardcoded 600,000ms ceiling that killed every prior attempt, and
past the exact 606,899ms point PLAN.md records as where `--call-timeout-ms
1200000` failed before this fix. Both calls succeeded and both are recorded
(`native-producer-recorded-response-3.2.json`,
`native-producer-recorded-response-4.2.json`). Watched the underlying
`claude -p` subprocess directly via `ps` through the run and confirmed it
was still alive and running -- not hung, not silently killed -- past the
600s mark before it returned successfully.

**A second, separate defect blocks the family's overall completion, found
only because this fix stopped masking it.** After both pinned-section calls
succeed, the run then fails: `model response contains 58 independent JSON
objects; expected exactly one and cannot guess which is authoritative`
(`anthropic-provider.js:3750`, `extractSingleJsonObject`/`AMBIGUOUS`).
Suspecting `--follow-citations` (the default) as the cause -- citation
follow-up calls are the one place this runner dispatches calls beyond the
two pinned sections -- reran with `--no-follow-citations`
(`evidence/canonical-v2/modiv-capitalisation-20260807-step2d1-fix-live-nofollow`).
**Same failure shape recurred**: section 4.2's call again completed
successfully as a CLI call (652,899ms wall-clock, again past the old
ceiling), but its own response body -- not a citation follow-up's --
contained 52 independent JSON objects this time (58 then 52: same failure
class, not identical, i.e. genuinely stochastic on the model's side, not a
citation-following artifact). This rules out citation-following as the
cause and narrows it to section 4.2's own response shape: something about
the dense, numeric-heavy "Parent Capitalization" content makes the model
emit many small JSON fragments instead of one JSON object, which
`anthropic-provider.js`'s single-object extractor cannot resolve.

**This is a third, separate defect, not defect 1 or defect 2, and outside
this session's ownership** (`lib/canonical-v2/native-producer/
anthropic-provider.js`, not `scripts/canonical-v2-live-extraction-run.mjs`,
`supabase/canonical-v2-foundation.sql` or
`scripts/canonical-v2-local-durable-write.js`). Recorded here rather than
worked around, per the standing convention that a family returning wrong
output is a finding to record, not a metric to force green. **Consequence
for the acceptance criterion**: defect 1 itself -- the dead `--call-timeout-ms`
flag -- is conclusively fixed and proven at the call level, twice, with
section 4.2 running to genuine completion past the old ceiling both times.
CAPITALISATION's family-level status remains `incomplete`, but for a newly
exposed, different reason than the one Step 2D1 was scoped to fix, and this
new reason needs its own step against `anthropic-provider.js`.

## Defect 2 -- the excerpt identity guard compares the wrong thing

Confirmed exactly as described. `canonical_v2_write`'s shared excerpts FOR
loop (`supabase/canonical-v2-foundation.sql`, was line 8546) compared
`canonical_payload_digest` -- a generated column hashing the ENTIRE excerpt
payload -- against `payload_digest(item)`, the whole incoming item. That
includes `source_occurrence_id`, which is not part of what defines
`excerpt_id`.

Traced `excerpt_id`'s real definition in
`lib/canonical-v2/source-structure.js`'s `buildExcerpt()`: it is
`contentId('EXCERPT/V1', identity)` where `identity` is exactly seven
fields -- `excerpt_definition_key`, `excerpt_definition_version`,
`excerpt_definition_payload_digest`, `ordered_component_assignments`,
`excerpt_purpose`, `transformation_or_redaction_version`,
`output_text_hash`. `source_occurrence_id` (and `source_content_id`,
`document_hash`, `exact_text`, etc.) are carried on the row but are NOT
inputs to `excerpt_id`. Two independent extraction runs over the same
document admit the source separately and can legitimately mint different
`source_occurrence_id`s for the identical quoted span -- confirmed live
below, this is exactly what happened between TERMINATION and
TERMINATION_FEE.

**Fix**: added `existing_payload jsonb;` and rewrote both excerpt
comparisons (pre-INSERT and post-INSERT) to extract just those seven
identity fields via `jsonb_build_object(...)` from each side and compare
`payload_digest()` of that subset, instead of the whole payload. No RAISE
EXCEPTION message text changed (`'canonical excerpt identity conflict'`
stays the message on a real conflict). Diffed the extracted function body
against the pre-edit version before repinning: the only changes are the one
new declaration and the excerpt loop's two comparisons, nothing else in the
~370k-character function body moved.

### Live proof: TERMINATION then TERMINATION_FEE coexist

Fresh container (`pm-pg-2d1`, port 55435), `supabase/canonical-v2-foundation.sql`
applied with the fix. Ran, in order:

```
node scripts/canonical-v2-local-durable-write.js evidence/canonical-v2/modiv-antitrust-20260807-replay      postgres://postgres:postgres@localhost:55435/postgres
node scripts/canonical-v2-local-durable-write.js evidence/canonical-v2/modiv-termination-20260807-replay     postgres://postgres:postgres@localhost:55435/postgres
node scripts/canonical-v2-local-durable-write.js evidence/canonical-v2/modiv-termination-fee-20260807-replay postgres://postgres:postgres@localhost:55435/postgres
```

All three: `exit 0`, `"status": "COMMITTED"`. TERMINATION wrote 12 claims,
TERMINATION_FEE wrote 4 claims, neither rolled back. Confirmed the two
families genuinely share one excerpt (not a synthetic case): comparing both
runs' bridged write-sets in memory, exactly 1 shared `excerpt_id`
(`726a395db666...`) with **different** `source_occurrence_id` on each side
(`e69092bbf0cb...` for TERMINATION vs `2f25a1ba214c...` for
TERMINATION_FEE). Queried the stored row after both writes:

```sql
SELECT excerpt_id, canonical_payload->>'source_occurrence_id'
FROM canonical_v2_staging.excerpts WHERE excerpt_id LIKE '726a395db666%';
-- 726a395db666...  |  e69092bbf0cb...   (TERMINATION's, written first; ON CONFLICT DO NOTHING kept it)
```

Pre-fix, this second write would have raised `'canonical excerpt identity
conflict'` and rolled back TERMINATION_FEE's entire write-set (or
TERMINATION's, whichever ran second) -- exactly the 12-of-211 loss the plan
describes.

### Genuine identity collision is still refused

Two proofs, both against the same live container:

1. **Ad hoc probe** (`collision-probe.js`, not committed): pre-existing
   TERMINATION/TERMINATION_FEE shared excerpt row, then a
   `FIXTURE_DEAL_EXTRACTION_RUN` write naming the same `excerpt_id` but a
   forged `output_text_hash`. Rejected: `canonical excerpt identity
   conflict`. Stored row's `output_text_hash` unchanged after.
2. **Committed regression test**:
   `tests/canonical-v2-excerpt-identity-guard.test.js`, gated on
   `LOCAL_CANONICAL_V2_DB_URL` (skips cleanly in CI, which has neither
   Docker nor Postgres). Two cases: (a) two writes of one excerpt_id
   differing only in `source_occurrence_id` both COMMIT and only one row
   exists; (b) a write claiming the same `excerpt_id` with a different
   `output_text_hash` is refused with the identity-conflict message, and
   the stored row is left untouched. Uses `FIXTURE_DEAL_EXTRACTION_RUN`
   deliberately, not `DEAL_SCOPE_RUN`: `DEAL_SCOPE_RUN` independently
   re-derives `excerpt_id` from admitted source bytes earlier in the same
   function (`'DEAL_SCOPE_RUN excerpt identity or source bytes are
   invalid'`, a different, complementary check), which makes a forged
   identity under `DEAL_SCOPE_RUN` structurally impossible to construct
   without tripping that check first instead of the one under test.
   `FIXTURE_DEAL_EXTRACTION_RUN` reaches the same shared excerpts loop
   without that pre-check, so it is the operation where this guard is the
   *only* defense.

   Command: `CI=true LOCAL_CANONICAL_V2_DB_URL=postgres://postgres:postgres@localhost:55435/postgres
   node --test tests/canonical-v2-excerpt-identity-guard.test.js` -- 2/2 pass.
   Without the env var: `CI=true node --test
   tests/canonical-v2-excerpt-identity-guard.test.js` -- 2/2 skip, exit 0.

### Secondary: the writer hangs forever on any SQL error

Confirmed: `main()` in `scripts/canonical-v2-local-durable-write.js` only
called `client.end()` at the very end of the success path. Any error
thrown by `writeOperation()` or step 3's own `BEGIN`/`COMMIT` block
propagated straight to `main().catch()`, which logs and sets
`process.exitCode` but never closes the client -- a live `pg` TCP
connection keeps Node's event loop alive, so the process never exited.

**Fix**: wrapped the body of `main()` (now `runDealScopeWrite()`) in
`try { ... } finally { await client.end(); }`.

**Proof, both against a schema-less container (`pm-pg-2d1-empty`, port
55436) so the very first `canonical_v2_write` call fails with a real SQL
error** (`function public.canonical_v2_write(...) does not exist`):

- Pre-fix (content from `git show HEAD:scripts/canonical-v2-local-durable-write.js`,
  run from a throwaway copy, never overwriting the owned file): `timeout 15`
  killed it -- **exit 124**, hung the full 15s despite the error already
  being printed.
- Post-fix: same input, no `timeout` needed to make it exit -- **exit 1**,
  ~6 seconds wall clock, error printed, process exits on its own.

### All 25 families write durably

Second, independent full-corpus proof: fresh container (`pm-pg-2d1-full25`,
port 55437), `supabase/canonical-v2-foundation.sql` applied with the fix,
`node scripts/canonical-v2-local-durable-write.js <run-dir>
postgres://postgres:postgres@localhost:55437/postgres` run once per family,
in alphabetical family order, against each family's importable evidence
run per `evidence/canonical-v2/baseline-manifest.json`:

```
OK   ANTITRUST_REGULATORY          exit=0 COMMITTED  claims=13
OK   APPRAISAL_DISSENTERS_RIGHTS   exit=0 COMMITTED  claims=0
OK   CAPITALISATION                exit=0 COMMITTED  claims=9
OK   CLOSING_CONDITIONS            exit=0 COMMITTED  claims=6
OK   CONSIDERATION                 exit=0 COMMITTED  claims=1
OK   DIVIDENDS                     exit=0 COMMITTED  claims=0
OK   DNO_INDEMNIFICATION           exit=0 COMMITTED  claims=4
OK   EMPLOYEE_MATTERS              exit=0 COMMITTED  claims=0
OK   FINANCING_COVENANTS           exit=0 COMMITTED  claims=0
OK   GENERAL_COVENANTS             exit=0 COMMITTED  claims=10
OK   GUARANTY_FINANCING_PARTY      exit=0 COMMITTED  claims=0
OK   INTERIM_OPERATING             exit=0 COMMITTED  claims=10
OK   KEY_DEFINED_TERMS             exit=0 COMMITTED  claims=0
OK   MAE_DEFINITION                exit=0 COMMITTED  claims=10
OK   MATERIAL_CONTRACTS            exit=0 COMMITTED  claims=24
OK   MERGER_STRUCTURE_CLOSING      exit=0 COMMITTED  claims=20
OK   MISC_BOILERPLATE              exit=0 COMMITTED  claims=14
OK   NO_OTHER_REPS_FRAUD           exit=0 COMMITTED  claims=3
OK   NO_SHOP                       exit=0 COMMITTED  claims=42
OK   PROXY_MEETING                 exit=0 COMMITTED  claims=2
OK   REPRESENTATIONS               exit=0 COMMITTED  claims=0
OK   SPECIFIC_PERFORMANCE_REMEDIES exit=0 COMMITTED  claims=1
OK   TAX_MATTERS                   exit=0 COMMITTED  claims=5
OK   TERMINATION                   exit=0 COMMITTED  claims=12
OK   TERMINATION_FEE               exit=0 COMMITTED  claims=4
```

**25/25 exit 0, 25/25 `status: COMMITTED`.** Zero-claim families
(APPRAISAL_DISSENTERS_RIGHTS, DIVIDENDS, EMPLOYEE_MATTERS,
FINANCING_COVENANTS, GUARANTY_FINANCING_PARTY, KEY_DEFINED_TERMS,
REPRESENTATIONS) are the same families the plan and prior notes already
recorded as correctly finding nothing on this deal (Modiv is an unfinanced
REIT merger; GUARANTY_FINANCING_PARTY's zero here is expected, not a
regression -- see `ae8b12de`'s finding, restated accurately in the PLAN.md
correction above).

Sum of `claims_in_write_set` across all 25 = 190, matching
`SELECT count(*) FROM canonical_v2_staging.claim_revisions` = 190 on the
container after all 25 ran. `SELECT count(*) FROM
canonical_v2_staging.excerpts` = 399. TERMINATION and TERMINATION_FEE's
shared excerpt (`726a395db666...`) is present exactly once, still carrying
TERMINATION's `source_occurrence_id` (written first in this run order too),
confirming the fix holds at full-corpus scale, not just for the isolated
two-family case above.

