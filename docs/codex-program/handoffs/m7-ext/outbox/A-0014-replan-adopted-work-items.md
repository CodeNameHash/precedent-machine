id: A-0014
from: lead
to: ext
date: 2026-09-03
re: the re-plan is adopted; your work items
status: OPEN (deliver as Q-0020 onward; Q-0018 and Q-0019 stand)

# Adopted

Ben adopted the re-plan with every recommendation (DECISIONS.md #26 on
the recovery branch; plan revision 2 at `7b0df9b7`:
`docs/codex-program/notes/M7-V2-REPLAN-TO-PUBLICATION-2026-09-03.md`).
Read sections 4, 5, 6 and 8. Two things the plan says about your
earlier findings: the 1,553 inventory dispositions are void as V2
approvals (script-applied defaults); and Q-0010's anchors are the
positive-fixture source only after Ben confirms each in his session 2.

# Work items, in priority order

Q-0018 and Q-0019 as assigned in A-0011 (the Phase 1 day-3 precondition).
Then, all on `ext/m7-verify-finding` unless told otherwise, all data and
tables, no legal judgement:

## Q-0020: operator table for Ben (plan Q5)

One row per operator: ALL_OF, ANY_OF, NOT, IF_THEN, EXCEPTION_TO,
OVERRIDES, DEEMS_AS, EARLIER_OF, LATER_OF, TO_EXTENT, CONSEQUENCE_MODIFIER,
BEFORE, ON_OR_BEFORE, OFFSET_AFTER, OFFSET_BEFORE, CAPABLE. Columns:
arity, child roles and types, precedence, scope rule, canonical
serialisation, source (repair plan §5.2 minimum vocabulary, or the
termination temporal phase-1 / phase-2 authorities: cite the record),
and one real-clause example with agreement id and byte span, from the
fixed 50 or the Termination phase-2 atoms, sha-verified. Where the
authorities define the operator, copy their definition; where they do
not, mark the cell `UNDEFINED` and leave it for Ben. Markdown table
plus JSON.

## Q-0021: party tables for Ben (plan Q3)

From Q-0015 and Q-0017: ten tables, one per agreement, rows = party
terms (Company, Parent, Merger Sub, Guarantor, Purchaser, and any other
party the preamble defines), columns = term, defining span (start, end,
sha), quote style, M2 annotated (yes/no), raw use count, first three use
spans. Every span sha-verified. This is what Ben confirms row by row; about
30 rows total is the target, so include only party terms, not every
defined term.

## Q-0022: definition disagreement classes for Ben (plan Q13)

From Q-0016: the 16 term classes where rules disagree, one row each:
term, count of edges, candidate A (span, sha, first 120 bytes, location:
preamble / Definitions article / body inline), candidate B (same), the
agreements affected, whether the two texts are byte-identical after
whitespace normalisation. Ben rules per row.

## Standing: attempt-record recomputation (Phase 1)

When the Phase 1 run lands (about two weeks), you recompute every
per-occurrence attempt record from the ten output files independently
and report disagreements. I will name the file format in a later A.

# Held

Work 6 rebind, the renderer and the fixture packs wait for the interim
registrations and session 2. PR #486 and #487 stay open as drafts.
