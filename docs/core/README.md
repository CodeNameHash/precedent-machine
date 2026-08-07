# Core documents

The programme's live reference set. Everything here is actively maintained;
nothing in this folder is history (for that, see `archive/` at the repo
root). Read in this order.

1. **`OPERATING-RULES.md`.** What anyone must know before starting work:
   authority boundary, working conventions, glossary. Self-contained, and
   meant to be read on its own before anything else here.
2. **`PLAN.md`.** The open work: what is still to do. One page, updated as
   steps close.
3. **`COMPLETED.md`.** The closed work: what has been done, and the
   evidence and commit that closed it. `PLAN.md` and this document together
   are the whole picture; nothing sits in both.
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
`docs/codex-program/notes/handoff-2026-08-07.md` first. It is a dated working
note, not a seventh core document: it records where things stood on that date
and what is waiting on a decision. If its date is old, trust the six documents
above over it.

Everything enumerable (registered families, product-projection modules,
review table configs, dark bridges, serving sources, live-run scripts) is
generated, not hand-maintained here: run `npm run generate:codebase-inventory`
to derive it fresh from the current code.
