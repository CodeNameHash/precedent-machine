# Parked: the Process Intelligence programme

**Parked 2026-08-06 by Ben's ruling: "we'll rebuild process intelligence at
some point — just stick all of that stuff in a folder for later."**

This is not `archive/`. `CLAUDE.md` defines that as "historical and none of it
is current", and this is neither current nor historical — it is real,
substantially executed work, deliberately set aside, to be rebuilt. Collapsing
the two is how a live programme becomes invisible, which is this project's
documented failure mode.

## What is here

`EXECUTION-LEDGER.md` — 702 lines, last touched 2026-08-05/06. It governs
P0–P12, a programme of roughly 200 team-hours, with per-row evidence and
Ben-level approval markers.

## What was open when it was parked

**`P8-VERTICAL-SLICES` was `ACTIVE`, not closed**, and blocks P9–P12. Its
stated goal: "QXO and Metsera pass source-to-product staging runs." Its
recorded state at parking: QXO F28 rollback proof PASS; the Metsera reviewed
fixture passes inactive persistence, four views, source-reader refusal and V7
candidate import; M1 permits the final isolated-staging pilots. Next action
recorded: "Integrate and deploy once, then run the QXO control and source-only
Metsera pilot."

Anyone reviving this starts by reading P8's rows, not this summary.

## Why this folder matters to the main plan, even parked

**The P8 rows contain the only evidence that the Canonical V2 write path has
ever been executed against a real database.** `PM-METSERA-PERSISTENCE-01` used
"the existing `canonical_v2_write` entry point" and wrote a real candidate
record inside a rollback transaction — exact replay a no-op, conflicting replay
failed closed, RLS confirmed active, durable rows zero, active pointer
unchanged. `PM-P8-AGREEMENT-WRITER-STAGING-03` proved the generic writer
against isolated staging: PASS. Both COMPLETE.

`docs/core/PLAN.md` previously stated the schema had been executed **0 times**
and called Stage 4 "the largest single unknown in the programme". That was
false, and it was false because this evidence lived here rather than there.
Before this folder was created, that reconciliation was written into PLAN.md
Stage 4 and `CODEBASE-GUIDE.md` section 9, so parking does not re-bury it.

What remains genuinely unproven is a **durable, non-rolled-back** write. Every
proof in P8 ends in rollback by design.

## What was deliberately not done

The P0–P12 work was **not** given PLAN.md steps. Ben ruled it parked rather
than subsumed. `PLAN.md`'s claim to supersede this ledger was deleted rather
than kept, because a parked programme is not a superseded one — a reader who
sees "superseded" concludes the work was absorbed somewhere, and it was not.

## Reviving it

1. Read `EXECUTION-LEDGER.md`'s P8 rows first, then P9–P12.
2. Check what has changed underneath it since 2026-08-06 — particularly
   `supabase/canonical-v2-foundation.sql`, `lib/canonical-v2/serving-client.js`
   and the staging import scripts under `scripts/canonical-v2-staging-*.mjs`.
3. Check `docs/core/PLAN.md` Stage 2 and Stage 4, which have moved since. Stage
   2 now runs each family end to end through the writer, so some of what P8 was
   proving per-slice may be proven more generally by then.
