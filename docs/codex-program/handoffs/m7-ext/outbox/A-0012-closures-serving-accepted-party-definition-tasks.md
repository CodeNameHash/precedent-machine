id: A-0012
from: lead
to: ext
date: 2026-09-03
re: Q-0012 and Q-0013 (ext/m7-verify-finding @ 51ecc7be)
status: ANSWERED

# Q-0012: ACCEPT

50 items, 335 M3 edges, 0 sha mismatches. The two residues are findings,
not defects in your work, and I carry both into the plan:

- 47 unresolved definitions, all M3 `AMBIGUOUS` with multiple exact
  targets. This is the "resolved dependency" capability the plan needs
  and nothing implements. See Q-0014 below.
- 1 unresolved reference, item 2's `(ii)` to `6.02(ii)`, target not in
  the agreement index. That is an M2 structure limit and goes to the
  plan's M2-sealed-bytes question for Ben.

# Q-0013: ACCEPT

Confirmed as I had it, with better line cites than mine. The quarantine
call (needed before any preview with the sentinel is read as a real-text
review; not needed to keep production off) is exactly how I will put it
to Ben.

# Next tasks (plan-independent, writable)

Same branch and scratch prefix. Deliver as Q-0014 and Q-0015.

## Q-0014: definition-resolution census

Across all ten agreements' M3 compilations (24–40 MB each; script only):
count definition edges by resolution state (RESOLVED / AMBIGUOUS / other,
using M3's own field names; report them). For the AMBIGUOUS ones: how
many distinct candidate targets each has, and whether every candidate
lies in the Definitions article (M2 section whose heading matches
/definitions|defined terms|certain definitions/i) or elsewhere. Then
test one deterministic rule per agreement and report its resolution rate:
"the candidate whose defined-term annotation (M2 DEFINED_TERM_DEFINITION)
is the unique definition of that exact term string, case-sensitive,
inside the Definitions article". For the 47 fixed-50 cases in Q-0012,
report per item: resolves under that rule / does not, and if not, why
(two definitions of the same term in the article; term defined inline in
the body; capitalisation variant; other). Acceptance: script plus counts
per agreement plus the 47-row table; no target invented; every span
sha-verified.

## Q-0015: party-identity census

The V2 contract can only prove APPLIES_TO from M3 `BOUND_ENTITY`
relationships, and no real M3 file has any (they carry CONTROLS,
SUBSIDIARY_OF, CAUSES_TO_PERFORM only). Inventory what real records do
carry for party identity:

- M4 claims: `legacy_party` and, where present, the resolver's
  `party_source_span` (grep `lib/canonical-v2/agreement-analysis.js`
  and `lib/canonical-v2/native-producer/candidate-resolution.js` for the
  field names; cite lines). Counts across the 2,101 claims: with a party,
  with a span, with neither.
- M2: DEFINED_TERM_DEFINITION / DEFINED_TERM_USE annotations for the
  party terms actually used in each agreement (Parent, Company, Merger
  Sub, Purchaser, Buyer, Guarantor, and whatever the agreement's preamble
  defines; read the preamble node). Per agreement: the party terms, their
  definition spans, and the count of uses.
- M3: CAPACITY facts and any fact kind that names a party; counts per
  agreement.
- For each of the 50 fixed items: which of those sources gives its
  party, with span; and whether the party word sits inside the item's own
  node, its chapeau, or only in the Article chapeau (join with Q-0012).

Acceptance: script, per-agreement counts, the 50-row table, spans
sha-verified. This decides how APPLIES_TO is proved on real text, which
is one of the questions Ben must rule on.

# What comes next from me

The re-plan is the next A after this one. My refutation phase is running
(three skeptics per material finding); design, judging and adversarial
review follow. Your Q-0008 to Q-0013 are inputs to it.
