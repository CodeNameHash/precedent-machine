id: A-0006
from: pm
to: ds
date: 2026-09-03
re: Q-0002 consumer blockers; contract draft 2 delivered; draft 3 with the rulings below
status: ANSWERED

# Draft 2 is on this branch

Commits `8e4a0b24` and `3e3b4b7a`, `package_schema_version 1.1.0`: A-0004's
rulings applied (`transaction_id`, typed fields with `unit` and
`sort_value` citing the V2 `FACT_VALUE_TYPES`, no relevance score, your
selection-record plus admission-receipt corpus input). Example verifies
at 293 checks, exit 0; a one-value corruption fails six checks, exit 1;
the committed example is byte-identical to a fresh build. One deviation
from your selection shape: `ben_approval_id`, a content ID of the ruling
record, so approval is verifiable rather than a name in a string.

# Rulings on Q-0002 (producer's technical calls; all accepted in substance)

1. **Semantic fact state.** Accepted. Every field gains a required
   `fact_state` in {PRESENT, ABSENT, NOT_APPLICABLE, NOT_EXAMINED, FAILED}.
   Rules: PRESENT requires a non-null `typed_value` and at least one
   evidence span (zero and false are PRESENT); ABSENT requires
   `typed_value: null` and the examined source-unit id; NOT_APPLICABLE
   requires a governed reason code from the producer's disposition
   vocabulary; NOT_EXAMINED means the occurrence's profile does not carry
   the field; FAILED means the owning claim is `REVIEW_ONLY` and carries
   the issue codes. The contract states the derivation from the V2
   disposition and issue codes.
2. **Complete provision text and locator.** Accepted. The package gains a
   shared `source_units/` set: one record per governed occurrence with
   occurrence id, heading or reference, document order, start and end
   byte, text SHA-256, the full canonical text of the authored unit, and
   its context spans (parent chain, governing chapeau, Article chapeau)
   each with bytes, hash and text. Claims reference source units by id.
   The document locator gains the SEC document name and sequence from the
   admitted-source receipt; a deal whose receipt lacks them carries
   `null` and cannot be PUBLIC. Whole-agreement text is not included;
   its SHA-256 and byte length are.
3. **APPROVED_LIMITED payload.** Accepted. Required `limitation`
   {`code` from the producer's governed limitation vocabulary, `text`
   from the ruling record, `ruling_id`} on every such claim; the verifier
   rejects an APPROVED_LIMITED claim without it.
4. **Release lineage.** Accepted. `supersedes_release_manifest_id` (null
   for the first release of a corpus) and `release_sequence` (integer,
   strictly increasing per `corpus_id`). Each package is a complete
   snapshot of its corpus; an occurrence absent from a successor is
   withdrawn, never implied. The consumer activates exactly one verified
   release per corpus at a time and rolls back by activating the exact
   predecessor id. `released_at` is informational.
5. **Transaction cardinality.** Accepted. `corpus_id` is the content ID of
   the approved transaction-selection record and is never recomputed
   from document keys; the 50-member bound counts unique
   `transaction_id`s; document-level admission records sit under their
   transaction; a transaction may carry several deal documents.
6. **Duplicate members.** Not reproducible by a JSON parse: `type` occurs
   at three object levels and `by_review_state` once as a member and
   once as a string inside `required`. A token-stream duplicate-key check
   now runs in the example builder and fails on an injected duplicate,
   so the answer is on the record.

Timing accepted: 1 to 5 bind the five-deal user-display package; they are
applied now (draft 3, `1.2.0`) so the shape does not change under you.

# Next

Draft 3 is the next lead A. Build the loader seam against draft 2 now;
the draft 3 changes are additive except `fact_state` becoming required.
