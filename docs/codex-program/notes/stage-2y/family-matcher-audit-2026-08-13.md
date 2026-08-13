# The other 24 families — what heading matching is actually doing

Report-only. No matcher is changed by this note. Measured over the seven
committed M2 indexes.

Ben's rule, 2026-08-13: *"generally using title and scope will work but you need
to read the provision. And match up."* Applying that to the 24 families that are
not REPRESENTATIONS turns up two different faults, and they need separating
because one of the numbers below overstates.

## Fault 1: matchers written against headings that do not occur

The same bug class as the recovered `REPRESENTATIONS` matcher
(`/authority; binding|authorization; valid and binding/`, which bound 0 of 7).
A family reports `INPUT_NOT_AVAILABLE` while the heading sits in plain sight.

| family | unbound despite a matching heading | the heading | the matcher |
|---|---|---|---|
| `TERMINATION` | **7 of 7** | `TERMINATION, AMENDMENT AND WAIVER`, `Termination.` | `/termination of (?:the )?agreement\|termination rights?/` |
| `INTERIM_OPERATING` | 4 of 7 | `INTERIM OPERATIONS OF THE COMPANY` | `/conduct of (?:the )?business/` |
| `DNO_INDEMNIFICATION` | 4 of 7 | `Directors and Officers.` | `/indemnification\|directors? and officers? insurance/` |
| `ANTITRUST_REGULATORY` | 3 of 7 | `Regulatory Matters.` | `/antitrust\|HSR Act\|regulatory approvals?\|governmental approvals?/` |
| `TAX_MATTERS` | 1 of 7 | `Taxes.` | `/tax matters?\|tax treatment\|transfer taxes?/` |

**`TERMINATION` binds nothing in any agreement in the corpus.** Every one has a
termination article and a termination section. The matcher requires the phrase
"termination of the agreement" or "termination rights", and neither is how any
of these seven writes the heading. A family the product plainly needs is
silently absent, exactly as `REPRESENTATIONS` was.

`FINANCING_COVENANTS` also showed 4 of 7 on this probe, but the probe there
matched `SEC Documents; Financial Statements.`, which is not a financing
covenant. That row is a false positive of the probe and is excluded.

## Fault 2: heading vocabulary and body vocabulary diverge

Requiring the family's own regex to appear in the bound text as well as the
heading leaves **29 of 97 bindings unconfirmed, 30%**. Four families are 100%
unconfirmed: `CLOSING_CONDITIONS` (7/7), `GENERAL_COVENANTS` (6/6),
`KEY_DEFINED_TERMS` (6/6), `INTERIM_OPERATING` (3/3).

**That 30% is not 30% wrong bindings, and should not be quoted as such.** The
test applies a heading-shaped regex to body text. `CLOSING_CONDITIONS` binds
redhat's *"all other representations and warranties of the Company set forth in
this Agreement, other than those…"* — a bring-down condition, which is a closing
condition and a defensible binding. It fails only because the sentence does not
contain the phrase "conditions to the merger", which no operative sentence ever
would.

What the measurement does show is that for these families the heading and the
statement share no vocabulary, so heading matching cannot be checked against
content without a content-shaped pattern per family — which is what was written
by hand for the no-conflicts representation, and what the topic registry already
provides for representations generally.

## What this means for the route

Both faults are the two things `route-to-good-extraction-2026-08-10.md` already
identified as the deterministic ceiling: **regex coverage** (fault 1, a matcher
that does not match) and **placement** (fault 2, heading and content disagreeing
about what a provision is). That note measured roughly 2,700–2,800 of 3,454
non-resolved occurrences sitting in exactly those two buckets, and concluded
*"the deterministic-regex approach cannot close the last ~20%"*.

Fixing the five matchers above is worth doing and is cheap. It will not change
that conclusion. It converts a set of silent absences into bindings that can
then be judged, which is a precondition for measuring a model rung against them,
not a substitute for one.

## Not taken here

Every row in fault 1 is a semantic decision about what a family means —
`TERMINATION` matching a bare `Termination.` heading also matches
`TERMINATION, AMENDMENT AND WAIVER`, which contains amendment and waiver
provisions that are not termination rights. That is a taxonomy judgement, and
the 24 families need 24 of them.
