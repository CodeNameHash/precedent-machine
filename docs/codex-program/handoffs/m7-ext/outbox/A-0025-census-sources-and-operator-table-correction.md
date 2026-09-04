id: A-0025
from: lead
to: ext
date: 2026-09-04
re: Q-0020 operator table correction; standing rule on census sources; Q-0022 method note
status: STANDING (no answer required; T5 added after T2)

# 1. Q-0020: eleven rows are not `UNDEFINED`

The table marks arity, child roles/types and scope `UNDEFINED` for eleven
operators. Those cells are defined today, in enforcing code:

- `lib/canonical-v2/m7-v2-contract.js:420-432`, the frozen `OPERATORS` map:
  each operator carries `{ min, max, childKinds }`. Exactly eleven entries:
  `ALL_OF`, `ANY_OF`, `NOT`, `IF_THEN`, `EXCEPTION_TO`, `OVERRIDES`,
  `DEEMS_AS`, `EARLIER_OF`, `LATER_OF`, `TO_EXTENT`, `CONSEQUENCE_MODIFIER`.
- `lib/canonical-v2/m7-v2-contract.js:449-461`, the frozen `CHILD_ROLES` map:
  the same eleven, each with named, ordered child roles — for example
  `IF_THEN: ['CONDITION', 'CONSEQUENCE']`,
  `EXCEPTION_TO: ['BASE', 'EXCEPTION']`,
  `CONSEQUENCE_MODIFIER: ['BASE_EFFECT', 'MODIFIED_CONSEQUENCE']`.

Those eleven are precisely the eleven the table marks `UNDEFINED`. So the
arity, child types and child roles are not open questions: they are shipped
and enforced.

This is not a criticism of the work. A-0014 pointed the census at plan §5.2
and the phase-1 temporal overlay, and said to write `UNDEFINED` where those
records are silent. They are silent. The code is not, and nobody told you to
read it.

The consequence is what matters: had this table reached Ben as-is, he would
have been asked to rule roughly eleven rows of cells the validator already
enforces, and any answer differing from the code would have put his ruling
and the contract silently out of step. That is the failure class this
programme spends the most time on.

# 2. Standing rule: the enforcing code is a required census source

For any census that will reach Ben as a ruling table, or that states what the
system does:

1. The enforcing code is a required source, alongside the plan and the
   authority records. Where they disagree, report both and say which is
   enforced at runtime.
2. A cell is `UNDEFINED` only when neither the records nor the code define
   it. Where the code defines it, give the value and its `file:line`.
3. Where a field does not exist in the design at all, the honest cell is
   `NOT_APPLICABLE` with the reason, never `UNDEFINED`. The two ask Ben
   different questions.
4. Never state what code does from its header comment. Count the cases.

# 3. Q-0020 revision: only the genuinely open cells

Do not rerun the whole table. Deliver a revision covering only what is still
open, with `file:line` for everything you find defined:

- **Precedence.** The string `precedence` does not occur anywhere in
  `lib/canonical-v2/m7-v2-contract.js`. Before asking Ben to rule sixteen
  precedence values, establish from the code whether expressions are stored
  and serialised as explicit parenthesised trees (see the serialised form at
  `lib/canonical-v2/m7-v2-contract.js:12620`). If they are, precedence has
  nothing to disambiguate and the cell is `NOT_APPLICABLE` with that reason.
  Report what the code shows; do not assume the answer either way.
- **Scope / `result_kind`** for the eleven, if the contract carries one.
- **Serialisation** for `OVERRIDES`, `DEEMS_AS`, `TO_EXTENT` and
  `CONSEQUENCE_MODIFIER`, which the table leaves blank.
- **A real-clause example for `CONSEQUENCE_MODIFIER`**, still the one
  operator with none.
- **The five temporal operators** (`BEFORE`, `ON_OR_BEFORE`, `OFFSET_AFTER`,
  `OFFSET_BEFORE`, `CAPABLE`) are not in the `OPERATORS` map. Say where they
  are enforced, if anywhere, or that they are declared only in the overlay
  record.

# 4. This applies to T2 now

T2 asks for matchers expressed in the contract's `evaluateMatchTest`
vocabulary. Take that vocabulary from the implementation, not from the plan
or from a profile record. A matcher that satisfies a document and not the
validator costs a full round on 1,382 profiles.

# 5. Q-0022: the method, and what it changes

The class builder takes each row's two `targets` verbatim, and a target is
the quoted defined term itself (8-29 bytes, e.g. `"Affiliate"`), not the
surrounding `means` or naming clause. "Byte-identical after whitespace
normalisation" is therefore true by construction whenever the same term is
annotated twice anywhere in a document. It is a property of the extraction,
not a finding about the definitions.

Read against sealed M2 bytes with context windows, the sixteen classes look
like this on the lead's reading: all thirty-two spans are genuinely
definitional, and every underlying M2 annotation already carries
`annotation_kind: DEFINED_TERM_DEFINITION`. But thirteen of the sixteen are
not disagreements — seven are one definition restated verbatim in two
documents bundled into a single filing (merger agreement plus an attached
CVR or support agreement, each with its own Definitions Article), and six are
a cross-reference pointer paired with the substantive definition it points
to. Three carry real substantive conflict: `Parties`, `Company Options`, and
the 285-edge `Rights Agent` class, which names two different entities for one
role.

If that holds, Q13 is a much smaller question for Ben than sixteen term
classes. It is not yet established: each multi-agreement class was checked
only in its representative agreement, so a class could mix duplicate and
genuinely conflicting edges.

## T5 (after T2, before T3)

Complete the check across every agreement in each class, not the
representative only. For all 856 edges: classify each side
`DEFINING_OCCURRENCE` / `REFERENCING_OCCURRENCE` / `INDETERMINATE` from the
sealed M2 bytes with the decisive text quoted, and label each edge
`DUPLICATE_RESTATEMENT_ACROSS_BUNDLED_DOCUMENTS`,
`POINTER_AND_TARGET`, `SUBSTANTIVE_CONFLICT` or `UNDETERMINED`. Report the
per-class breakdown and name every class that mixes labels. Zero model calls;
nothing under `control/` or `receipts/`.

Also report, as its own count, how many of the ten agreements' canonical
texts are bundled filings carrying more than one agreement with its own
Definitions Article. Definition scoping per document inside one canonical
text has consequences past Q13.
