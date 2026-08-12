# Core documents

The programme's live reference set. Everything here is actively maintained;
nothing in this folder is history (for that, see `archive/` at the repo
root). Read in this order.

1. **`OPERATING-RULES.md`.** What anyone must know before starting work:
   authority boundary, working conventions and glossary. Read it with
   `docs/CODEX-PROGRAM.md`, which carries additional governing rules.
2. **`PLAN.md`.** The sole live Stage 2Y and post-M10 product roadmap. It owns
   the open sequence and bounded work packets. `docs/CODEX-PROGRAM.md` and
   `docs/codex-program/programme-gates.yaml` retain overall architecture,
   governance, the four review milestones and merge gates.
3. **`COMPLETED.md`.** The closed work: what has been done, and the
   evidence and commit that closed it. It owns the detailed closure record.
4. **`DECISIONS.md`.** Rulings Ben has already made, with the reasoning.
   Read before proposing anything that sounds like a fresh design choice,
   in case it is already settled here.
5. **`CODEBASE-GUIDE.md`.** How the system actually works, from an EDGAR
   filing to a row a lawyer reads. The architecture and vocabulary
   reference for both pipelines (legacy and Canonical V2).
6. **`GRAVEYARD.md`.** Code that was built, works, and is not part of what
   a lawyer sees on the review page today: kept on purpose, safe to
   delete, or still live but obscure. Assumes `CODEBASE-GUIDE.md`'s
   vocabulary, so read that one first.

**Returning after time away?** Read
`docs/codex-program/notes/HANDOFF-2026-08-12.md` first. It records the iCloud
recovery, the recovered M6-M7 files, the missing M5 inputs and the exact next
task. It is a dated working note, not a seventh core document. If its date is
old, trust the six documents above over it.

Everything enumerable (registered families, product-projection modules,
review table configs, dark bridges, serving sources, live-run scripts) is
generated, not hand-maintained here: run `npm run generate:codebase-inventory`
to derive it fresh from the current code.

---

## Current work — read this before touching the branch

**Step 2X merged to `main` as `c40b7bb1` on 2026-08-08** — 207 commits, all
three blockers closed, gates re-run after the merge because `main` had moved.
`docs/codex-program/notes/HANDOFF-2026-08-08.md` records how that was reached
and where every 2X artefact lives.

**The open work is recovery of the Stage 2Y M5-M7 row-correction state.** The
architecture decision and M0 to M4 are complete. M5-M7 ran locally, but their
uncommitted working tree moved into iCloud Drive. Fourteen critical M6-M7 files
are recovered on `codex/recover-m7-20260812`. Recover the final M5 input batch,
rebuild the corrected M6-M7 output and resume lawyer review. Do not start M8.
Phase B and all model-call routes remain deferred and locked.

The current architecture evidence is
`docs/codex-program/notes/stage-2y/extraction-architecture-review-2026-08-10.md`.
The sealed migration controls, prototype, reviews and receipts are under
`evidence/canonical-v2/stage-2y-structure-migration/`. Historical Stage 2Y
diagnosis remains under `docs/codex-program/notes/stage-2y/`; it is evidence,
not a second executable plan.
