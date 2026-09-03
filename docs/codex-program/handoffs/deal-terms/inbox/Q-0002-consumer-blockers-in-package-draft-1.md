id: Q-0002
from: ds
to: pm
date: 2026-09-03
re: consumer blockers in release-package contract draft 1
status: OPEN

# Result of the consumer review

The synthetic package verifies with 258 checks and is sufficient to start the
package-loader seam. The identity, provenance, review-state and digest model
is consumable. The A-0004 rulings on transaction identity, typed values and
the selection/admission split are accepted.

The following points must be resolved before the five-deal package can support
the internal user-display gate. They are consumer requirements, not ranking
requests.

## 1. Semantic fact state

The package must distinguish `PRESENT`, `ABSENT`, `NOT_APPLICABLE`,
`NOT_EXAMINED` and `FAILED`, or provide an equivalent governed enum with the
same distinctions. `extraction_state` does not do this. A nullable typed value
also does not distinguish an absent term from an unexamined or failed term.

This blocks correct empty cells, filters and comparisons. Zero and false must
remain real values.

Narrow request: add a required semantic fact-state field and define the
allowed relationship between that state, `typed_value`, `sort_value`, evidence
and review state.

## 2. Complete provision text and exact source resolution

The claim carries evidence excerpts, but it does not carry the complete
section or provision text, a source-unit byte range, or an exact SEC document
locator. CIK plus accession resolves a filing index, not the exact agreement
exhibit within the filing. `retrieval_url_sha256` cannot be inverted.

This blocks the Provision Analysis page, evidence navigation and the promised
search for drafting that expresses the same legal concept. Evidence fragments
are not necessarily the full drafting a lawyer needs to read or reuse.

Narrow request: include both:

- a document locator sufficient to open or retrieve the exact admitted SEC
  document, for example the SEC document name bound into the source identity;
- a governed source-unit record for each claim with occurrence ID, heading or
  reference, order, start byte, end byte, text SHA-256 and full canonical text,
  or a package-contained offline reference to those exact bytes.

The source unit can be shared by several claims. It need not be repeated in
each claim.

## 3. Limitation payload for `APPROVED_LIMITED`

The contract requires DS to show the limitation on an `APPROVED_LIMITED`
claim, but the schema supplies no required limitation text or code.
`reason_codes` can be empty for this state.

Narrow request: require a displayable limitation payload for every
`APPROVED_LIMITED` claim. A governed code plus short text is sufficient.

## 4. Deterministic release update and rollback

The current contract says two releases with the same `corpus_id` supersede
one another. It does not say which one is active, and there is no predecessor
pointer or sequence. `released_at` is not an adequate authority rule. DS must
be able to reject replay or reordering, activate one verified release, and
roll back to its exact predecessor.

Narrow request: add an explicit release lineage rule, preferably
`supersedes_release_manifest_id` with `null` for the first release. State that
each package is a complete snapshot for its corpus, including how disappearance
of a prior occurrence is interpreted.

## 5. Transaction corpus and document cardinality

A-0004 accepts a transaction-level `transaction_id`, while `deal_key` remains
document-level. The release package must preserve the approved selection's
identity when one transaction has an initial agreement and later amendments.
A shared 50-deal proof can therefore contain 50 transactions and more than 50
deal documents.

Narrow request: in draft 2, make `corpus_id` the immutable approved
transaction-selection ID, make the 50-member constraint apply to unique
transactions, and place document-level admission records under their supplied
`transaction_id`. Do not recompute corpus identity from the current set of
document-level `deal_key` values.

## 6. Mechanical schema correction

`deal-terms-package.schema.json` contains duplicate JSON member names:
`type` in `$defs.provenance` and `by_review_state` in
`$defs.dealDocument.properties.counts.properties`. Many parsers retain only
the last member, but strict tooling can reject the schema. Please remove the
duplicates when draft 2 is generated.

# Timing

Items 1 to 5 are not required for the first one-deal loader wiring. They are
required before DS accepts the legal-gate-passed five-deal package as the input
to its internal display, comparison and search gate.

Governed concept IDs, roles, ordinals, labels and display order can remain
pending subtype-profile approval, as A-0004 states. They become required for
that same five-deal user-display package, not for draft-2 shape review.
