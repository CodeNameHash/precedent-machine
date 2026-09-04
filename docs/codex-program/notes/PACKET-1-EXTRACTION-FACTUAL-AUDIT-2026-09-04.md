# Packet 1: independent factual audit of the two extraction lineages

You are establishing facts. **Do not recommend an architecture, and do not
rule on anything.** A separate packet puts the decision to the owner; this
one exists so that decision rests on checked facts rather than on anyone's
summary, including mine.

Deliberately withheld: the conclusions of three prior reviews, and the
synthesis they converged on. Supplying them would tell you what to find.
If you want them afterwards to compare, ask once you have written your
answers down.

Repository: this one. Branch `codex/recover-m7-20260812`. Read `CLAUDE.md`
first, then `docs/core/README.md` and the six documents it points at:
`OPERATING-RULES.md`, `PLAN.md`, `COMPLETED.md`, `DECISIONS.md`,
`CODEBASE-GUIDE.md`, `GRAVEYARD.md`. Also `docs/CODEX-PROGRAM.md`.

`COMPLETED.md` matters most for this task. This programme's most expensive
and most repeated failure is concluding that something does not exist, or
that a module only does what its header claims, when the code says
otherwise. Read the code, count the cases.

Change no file. Run no model call. This is a read-only audit.

## The two things being compared

**Lineage A:** `lib/canonical-v2/native-producer/` (126 modules).
**Lineage B:** the governed M0–M10 track, whose generator is
`lib/canonical-v2/m7-v2-deterministic-generator.js`.

## Questions

Answer each with file:line or receipt path. Mark each answer VERIFIED (you
read it) or INFERRED (you reasoned to it), and give your confidence.

1. What produces the claims in M4? For each claim, where does its legal
   content come from, and where do its byte coordinates come from? Are those
   the same source? Count the claims and classify them.
2. Which modules does `generateAnalysisV2` read from an M4 claim, and which
   fields? Does it consume any legal content from M4, or only identifiers?
3. Which lineage's output, if any, is served to a user today? Check the
   feature gates, not the documentation. Where the documentation and the
   gate disagree, say so and cite both.
4. Is Lineage A inside or outside the governed M0–M10 track? What
   authorises its model calls, and how does that sit with the track's
   `model_calls: 0` and with Phase B being locked? Quote the reconciling
   decision if one exists.
5. Take one served or serveable fact and walk it back to source. What is
   retained at each hop, and what is dropped? Specifically: can you get from
   a stored fact to (a) the exact source bytes, and (b) the model request
   and response that produced it? Say where each link holds and where it
   breaks, with counts.
6. The owner's 50-item review scored 19 correct, 31 incorrect. For each of
   the 31, classify: which agreement, whether Lineage A had a run for that
   agreement at all, and what the failure actually was (no row produced;
   wrong span; correct span but untyped role or qualifier; wrong legal
   characterisation; other). Give the counts per class. Do not draw a
   conclusion about which lineage is better from this; report the
   distribution.
7. What does a Lineage B profile require of a match today? Enumerate the
   required-role structure the current profiles express, and state whether
   that is sufficient to constitute a complete proposition as
   `DECISIONS.md` entry 18 defines one. Quote entry 18's requirement.
8. Where is the governed seam that a new extractor's output would have to
   enter? Name the function and its exact bound inputs. Is M4 that seam, or
   is it input data to it?
9. What in each lineage is unreferenced, superseded, or reachable only from
   a one-off script? Give paths and line counts. Distinguish a path that
   merely appears in a comment from one that is actually loaded.

## Output

A findings file. Facts and paths. No recommendation, no ranking of the two
lineages, no architecture. Where you cannot establish something, say so and
say what would establish it.
