id: A-0013
from: lead
to: ext
date: 2026-09-03
re: Q-0014 and Q-0015 (ext/m7-verify-finding @ 8e09beef)
status: ANSWERED

# Q-0014: ACCEPT

The number that matters: 43 of the 47 fixed-50 ambiguities are the same
shape, a party term (mostly `Company`) defined once in the preamble and
again, exact-term, in the body. The Definitions-article rule cannot see
the preamble, so it resolves 4 of 47. Corpus-wide it resolves 683 of
5,998. Carried into the plan as: "definition resolution needs a preamble
rule, and M3's AMBIGUOUS state is honest".

# Q-0015: ACCEPT

Three facts I will put in front of Ben verbatim:

- M4 party: 1,092 of 2,101 claims carry `legacy_party`; no claim carries a
  party span; three agreements carry no M4 party at all.
- M3: 0 `BOUND_ENTITY` of 51 relationships, so the V2 party route as
  written can never fire on real text.
- M2: `Parent` and `Merger Sub` are mostly unannotated because the
  preamble uses curly quotes. That is an M2 gap in sealed bytes, and it
  is the most consequential thing in the two censuses. See Q-0017.

# Next tasks

Same branch and prefix. Deliver as Q-0016 and Q-0017.

## Q-0016: two more deterministic definition rules

On the same 5,998 AMBIGUOUS edges and the 47 fixed-50 cases, test:

- Rule 2, preamble: if exactly one candidate definition lies in the
  preamble window (AGREEMENT children before the first ARTICLE, as you
  defined it in Q-0015), select it.
- Rule 3, nearest preceding: select the candidate definition that
  precedes the use in document order and is nearest to it; report
  separately when the nearest is inline in the body versus in the
  Definitions article or preamble.
- Combined: Rule 1 (Q-0014), then Rule 2, then Rule 3, first hit wins.

Report per rule and combined: resolution rate corpus-wide and per
agreement, the 47-row table with the selected target span for each, and
every case where two rules pick different targets (those are the ones
that need Ben, so list them with both spans). Acceptance as before:
script, byte-identical re-run, spans sha-verified, no invented target.

## Q-0017: size the M2 defined-term annotation gap

Across all ten canonical texts (`source_binding.canonical_text`), find
every parenthetical definition by regex over the text, tolerating both
quote styles: straight `"`, curly `“ ”`, and single-quote variants,
patterns like `(the "Company")`, `("Parent")`, `(collectively, the
"Parties")`, `(each, a "Party")`. For each match: term string, byte span
of the term, quote style, whether M2 carries a `DEFINED_TERM_DEFINITION`
annotation at (or overlapping) that span, and the count of
`DEFINED_TERM_USE` annotations M2 carries for that exact term string.

Report per agreement: matches / annotated / unannotated, split by quote
style; the unannotated terms list; and for the unannotated ones the count
of raw occurrences of the term string in the text (so we know how many
uses M2 also missed). Then the same for the preamble window only. Cite
the M2 annotation code path you compared against
(`lib/canonical-v2/agreement-index.js`, grep for the defined-term
annotator and its quote handling; cite lines). If the annotator's quote
handling is the cause, say so with the line. Acceptance: script, counts,
sha-verified spans, code cite.

This one matters because M0–M4 bytes are sealed under the Work 1–7
authority. If M2 missed the parties, the plan has to say so and Ben has
to decide how a party is proved without re-running M2.

# What comes next from me

The re-plan is the next A. Refutation is past a third; design follows.
