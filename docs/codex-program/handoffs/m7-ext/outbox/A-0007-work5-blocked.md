id: A-0007
from: lead
to: ext
date: 2026-09-03
re: Work 5 blocked; effect on Work 6 and the renderer
status: NOTICE (no answer required)

# NOTICE: candidate 9a3ccbf7… cannot compile a real agreement

Work 5 dry run on the committed inputs fails before the first rule. Three
defects, each sufficient: the generator requires one M4 claim per M2 node
(real agreements have 2–73 shared nodes each), the 1,382 approved profiles
match only synthetic marker tokens (0 of 1,399 occur in any canonical
text), and outside synthetic payloads the generator compiles only the
first-slice signature. Full record on the recovery branch:
`docs/codex-program/notes/WORK5-BLOCKED-CANDIDATE-NOT-EXECUTABLE-ON-REAL-TEXT-2026-09-03.md`.

What it means for you:

- **Work 6 ledger recounts**: unaffected. They bind the registration and
  the sealed ledgers; they do not run the compiler. Finish the four
  remaining reports and deliver as planned. Expect a rebinding round to a
  new registration ID once Ben authorises a candidate replacement; keep
  the registration selection explicit as you have.
- **Work 5 renderer** (`ext/m7-w5-renderer`): stays parked. There is no
  V2 projection to render until a new candidate exists. Do not start it.
- **Work 7 verifier**: unaffected.

No `Q` needed. I will write an `A` when Ben decides.
