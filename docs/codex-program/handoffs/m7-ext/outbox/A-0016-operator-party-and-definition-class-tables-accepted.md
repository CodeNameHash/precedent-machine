id: A-0016
from: lead
to: ext
date: 2026-09-03
re: Q-0020, Q-0021 and Q-0022 (ext/m7-verify-finding @ 3d1200e9)
status: ANSWERED

# Q-0020: ACCEPT

`20-operator-table.json` is 18,014 bytes, sha256
`b964ea5acc34e572503e0c6931dc3773d81119658fb8fb4e667904012022b438` —
matches your letter exactly. `.out`: 16 operators, 15 sha-verified
example spans (matches "15 example spans"), `undefined_arity: 11` —
consistent with your letter's 5 Phase-1-defined operators (`CAPABLE`,
`BEFORE`, `ON_OR_BEFORE`, `OFFSET_AFTER`, `OFFSET_BEFORE`) plus
`EARLIER_OF` whose arity is still `UNDEFINED` even though §5.2 extends
its allowed value kinds (16 − 5 = 11).

The numbers that matter: 5 of 16 operators have arity and roles from an
authority; `CONSEQUENCE_MODIFIER` has no real-text example; precedence
is `UNDEFINED` on all 16. That is the honest state of the minimum
vocabulary — Ben rules on the other 11.

# Q-0021: ACCEPT

`21-party-tables.json` is 43,610 bytes, sha256
`d62f0f0be3baec8b6280e037e38d55e6d5fb1c6c0917614821293e454386032f` —
matches. `.out`: 10 agreements, 35 rows, 1,638 sha-verified spans, 0
mismatches — matches your letter's "35 rows" and "0" exactly.

The numbers that matter: `Parent` unannotated on 10/10 agreements; one
agreement (`aa72f3af2931…`) uses `Company` 1,191 times with no defining
span at all. Those two facts are what makes this Ben's row-by-row call,
not a script's.

# Q-0022: ACCEPT

`22-definition-classes.json` is 25,150 bytes, sha256
`c47819fc2fe41cbefc5f7e7034bde1c253fd3fc77c3bfe3e2130e0c5c7d39a0a` —
matches. Independently counted: 16 classes, 856 edges (sum of
`edge_count` across all 16, ties to Q-0016's disagreement total), and 0
of 16 classes have `byte_identical_after_whitespace_normalization:
false` — confirms "every class byte-identical" as stated.

The number that matters: all 16 disagreements are the same term defined
twice, not two different meanings colliding — this narrows what Ben is
actually being asked to rule on.

# Next

No new task from me in this message; further work items follow from the
lead. Q-0018 and Q-0019 (assigned in A-0011/A-0014) still have not
landed on `ext/m7-verify-finding` — the branch goes straight from
`d434b345` (Q-0016/17) to `3d1200e9` (Q-0020/21/22). Confirm whether
those two were folded into this delivery under different numbers, or
are still pending; I will answer either way.
