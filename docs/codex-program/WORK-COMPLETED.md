# Work completed

This is a historical record. Nothing here is required reading to work on
the programme today. Current state lives in `ROADMAP.md`.

A note on dating: the source material recorded these findings as a single
condensed appendix, dated 2026-08-05, without an individual date or a
stated order for each entry. Rather than invent precision that was not
recorded, the entries below are grouped under that one compilation date and
ordered using whatever temporal evidence each entry itself contains: the
three findings tied explicitly to the final four-family preview integration
are the most recent and appear first; the rest follow in the source's own
original order, where no stronger evidence exists to reorder them.

---

## 2026-08-05

### The preview quietly became a complete no-op

After authorisation gates were added to all four bridges, one bridge's
integration code, written before it had a gate, never passed its caller's
environment through to it. Every explicit-environment caller, meaning every
test and every manual check, silently failed and was swallowed by an outer
safety net, so the entire four-family preview returned nothing, with no
visible error. The real production wiring happened to be unaffected only by
coincidence (it happened to pass the same object either way). It was found
immediately by a genuine end-to-end test that exercised the real,
wired-together path, which two green unit-test suites either side of the
seam had not caught between them, because neither one crossed the seam
itself. Fixed by threading the environment through consistently.

### Chaining bridges together was structurally impossible, until it wasn't

One bridge legitimately shares a single excerpt reference between two
sibling cards; every bridge's merge logic, however, reserved that reference
as if it had to be unique across the whole review deal. Merging that
bridge's output first, then any other bridge's output, always failed with
a collision error before the second bridge's cards were even inspected,
which made it impossible to ever preview all four families together. Fixed
by rebinding card identity in all three affected bridges to the provision
reference rather than the excerpt reference, following the one bridge that
already did this correctly as the model. This is what made previewing all
four areas together mechanically possible at all.

### A live production defect in the Representations table, unrelated to anything new

The rule for selecting which cards belong in the Representations and
Warranties table matched any card whose code merely started with the right
prefix, rather than checking it actually belonged to that family. On any
deal where Material Contracts also extracts as its own representation (the
code's own comment names two real deals where this happens), this produced
a second, duplicate, qualifier-less row inside the Representations table in
production, one a reader would reasonably take for a distinct
representation. It had survived because nothing had ever compared card
ownership across families in one place, until the preview work forced all
four families into a single review deal for the first time, which made the
overlap observable. Fixed by excluding concepts the family does not own,
reusing the existing, single authoritative exclusion list rather than
creating a second one. The fix deliberately breaks strict byte-for-byte
sameness with the old output for this one row, correctly: preserving the
old bytes would have preserved the bug.

### A receipt is only a receipt if it names its exact command

Re-running eight historical test-count claims against current code found
that only the two originally recorded together with their exact command
reproduced exactly; the other six, each recorded as a bare number, could
not be reconciled and their original counting basis could not be
recovered. Nothing had actually regressed, but the finding mattered enough
to become a standing rule going forward, recorded as a working convention
in the operating rules.

### A quotation trim that reversed legal meaning

Deliberate adversarial testing of the four preview bridges found that
dropping a preceding negation from a quote (for example, the words "would
not" from "would not have a Material Adverse Effect") produced an
accepted, "verbatim" quote with the opposite legal meaning. It mattered
because this is the worst class of error a product like this can produce:
confidently wrong, with no visible signal to the reader. Crude trimming is
now blocked everywhere; the negation case specifically remains open and is
tracked in the roadmap's known risks, with its fix designed as step 1b.

### A gate-ordering defect, found the same way twice

Two of the four bridges validated their input before checking whether they
were even authorised to run, so a hand-built request that never went
through the normal builder could bypass the authorisation gate entirely.
It was found by directly probing each bridge's public entry points with
the gate switched off, rather than trusting green test suites, because
each existing suite only ever exercised its own intended, gate-on path.
Both instances were fixed by asserting the gate first, before any other
check. That two independent implementations produced the identical defect
established it as a pattern rather than an accident, and a standing rule
followed: assert the gate at every public entry point, and prove it by
direct probe. (Now recorded as a working convention in the operating
rules.)

### A skeleton-key defect in the parity register itself

The logic that checks whether a required adapter has a real consumer was,
for a period, binding the wrong things together: it treated any adapter
named anywhere on a surface as fully interchangeable with any consumer
proven anywhere in the repository, rather than requiring the two to
actually belong to each other. Measured before the fix, this meant 59 of
the then-104 blockers could have been falsely cleared by citing an
unrelated, genuinely real proof elsewhere in the codebase, with no other
status changed. It was found by an adversarial review explicitly briefed
to treat a false "served" claim as the worst possible failure, rather than
to look for crashes. Fixed by binding the required proof to the specific
surface; verified afterward that none of the (by then) 100 blockers could
be flipped this way, using a real proven pair as the attack.

### Design-guarded pages counted as live routes

Pages that are guarded to answer "not found" in production were still
being treated as valid, served entry points when computing whether
something was reachable by a real user, which had let 28 modules appear
falsely reachable through routes that do not actually serve in production.
Fixed by excluding guarded pages from that computation.

### A silent, total blind spot in export detection

The check for which names a module exports did not recognise the `export
default` form, so 131 product modules were parsed as exporting nothing at
all, meaning no amount of real engineering could ever have proven them
served. Fixed by recognising both `export default` and `exports.default`.

### A false "visible" result hiding behind a dead route

One row reported as genuinely visible because its consumer really did
import the module in question, but that consumer was itself only reachable
through one of the seven search routes that are permanently stubbed to
return an unavailability response. An import proved integration, not that
a user could ever see it. Fixed by requiring the proving consumer to be
reachable, by real transitive import, from a route that is not one of the
stubbed ones.

---

## Where the full detail lives

This file is a condensed record. The original working log, 3,629 lines covering
every finding with its evidence, receipts and superseded checkpoints, is in
commit `59568f92`:

```text
git show 59568f92:docs/handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md
```

Reach for it when investigating why something was done, not to learn current
state. Current state is in `docs/codex-program/ROADMAP.md`.

One caution learned from producing this file: when that log was condensed, a
body of the owner's standing legal and taxonomy rulings was dropped as
"implementation history". It was not history, it was binding constraint, and it
has been restored to `docs/codex-program/OPERATING-RULES.md`. Anything condensed
out of a record should be checked against that failure before it is trusted as
safe to lose.
