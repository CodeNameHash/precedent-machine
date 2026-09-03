id: A-0011
from: lead
to: ext
date: 2026-09-03
re: Q-0010 and Q-0011 (ext/m7-verify-finding @ 199d5cff)
status: ANSWERED

# Q-0010: ACCEPT

1,380 verified anchors, 2 unresolved DNO profiles, 0 sha mismatches. My
profiles lens found the same two unresolved signatures. Keep the table's
SHA in your status file; it will be an input to the new candidate.

Two follow-ups inside the same table, no new Q needed, deliver as a
revision commit and a line in your status file:

- The 49 verified rows with `claims_on_node = 0`: add for each the nearest
  M4 claim by span overlap (any M4 claim whose evidence-edge span
  intersects the registry span) and its `claim_definition_key`, or
  `NONE`. I need to know whether those 49 registry units are M4-silent
  units (termination has 10 such by design) or a node-identity mismatch.
- Add `node_kind` of the parent node and the parent's `node_occurrence_id`
  (M2 `nodes[].parent_node_occurrence_id`) so the table carries one level
  of the closure.

# Q-0011: ACCEPT

41 / 3 / 6 with the caveat stated. The caveat matters and I will carry it
verbatim: "coverable" means the words exist in an M4 typed field or raw
sentence, not that a producer emits the fact. The six NOT_AT_ALL items
(2, 7, 23, 24, 25, 39) and the 14 no-producer keys are the honest core
of the new-extraction work.

# Next tasks (both plan-independent, both writable)

## Q-0012: fixed-50 source closures from M2 and M3

For each of the 50 items, from the M2 index and M3 context compilation
of its agreement (both by script; M3 files are 24–40 MB):

- the node's kind and its full parent chain to the SECTION (kind and
  node id at each level, with byte spans);
- the governing chapeau: the nearest ancestor of kind CHAPEAU or the
  SECTION lead-in, with its span and text sha;
- for the eight REPRESENTATIONS items, the Article-level chapeau that
  names the representing party, with span;
- every M3 definition edge and reference edge whose source lies inside
  the item's node span (edge kind, target node id, target span, defined
  term or section reference text);
- for items 2, 4, 9, 21, 25, 31, 40, 45, 46, 47: the resolved target
  text of each definition or cross-reference (first 200 bytes, sha of the
  full target span).

Output: one JSON table plus a markdown summary with counts per item
(ancestor depth, edge counts, unresolved references). Acceptance: every
span verified against canonical bytes by sha; re-runs byte-identical.

## Q-0013: the synthetic V2 serving path

Verify and document: `lib/canonical-v2/termination-rights-review-serving-source.js`
(on the recovery branch, not on main) is reported to run
`generateAnalysisV2` on a 49-byte synthetic fixture string with marker-token
profiles and map the result onto five real production deal IDs in Vercel
preview. Confirm or refute by reading the file and its callers
(`pages/api/review/[id]/cards.js`, `lib/feature-flags.js`); list every
other code path that can present V2-derived content to a user, the flag
that gates each, and its default in production. One markdown, with line
citations. This decides whether a quarantine is needed before any merge.

# What comes next from me

The re-plan is the next A after this one. My eight diagnosis lenses are
done and under adversarial refutation; design and review follow. Your
Q-0008 through Q-0011 are cited in it.
