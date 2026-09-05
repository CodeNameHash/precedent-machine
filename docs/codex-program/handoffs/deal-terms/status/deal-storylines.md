# Deal Storylines consumer status

Updated: 2026-09-05 after consuming A-0018

## Waiting on PM

- A user-displayable five-deal package after the producer legal gate.
- Producer evidence before dates are assigned beyond the first real run.

## Consumer state

- Contract draft 3, schema version 1.2.0, and its synthetic one-deal package
  are the current consumer contract. The producer reports 566 verifier checks.
- A-0018 released Shared Source Core 1.0.3 at immutable package-root commit
  `5f2ccafa277202b64231071783973135b9b0c894`. Deal Storylines pins that exact
  commit. Its 18-test package suite and the Deal Storylines offline conformance
  and hostile-fetch tests pass.
- A-0008 supplies one Exhibit 2.1 merger-agreement selection row for each of
  the ten fixed producer transactions, including producer deal key, agreement
  ID, filer CIK, accession, SEC document name, byte digests and lengths.
  Every row has `amendment_status: NOT_EXAMINED`.
- A-0017 completes `target_cik`, `transaction_anchor` and
  `announced_transaction_ordinal` for all ten A-0008 rows. These are usable as
  deterministic selection inputs after the Shared Source Core transport is
  replaced. They do not admit the rows into the shared 50-deal proof corpus.
- The only fixed producer corpus is ten agreements across ten unique
  transactions. The other thirty transactions in its 40-transaction target
  have not been selected. The shared proof corpus must still become a
  Ben-approved set of 50 unique transaction IDs.
- No importer or production data path has been built.
- Deal Storylines will consume only the pinned Shared Source Core package or
  service contract. It will not inspect PM internals or copy the PM ingest
  implementation.
- No PM internal file, field, database row or evidence path is a consumer
  dependency.
- Deal Storylines Phase 0 is accepted. Shared Source Core 1.0.3 admitted the
  real Metsera definitive proxy and one Background unit into an immutable
  completed snapshot with exact bytes and hashes, `NOT_RUN` coverage,
  `NOT_EXAMINED` fact state, zero facts and zero model calls.
- The combined roadmap treats the one-deal and first five-deal packages as
  wiring inputs only. They cannot satisfy a user-facing release gate while
  their release state is `REVIEW_ONLY_INTERNAL`.

## Current assumptions

- DS supplies the transaction-level deal ID through an approved immutable
  selection record.
- PM carries the DS deal ID, PM agreement ID and exact SEC source binding.
- Every package size uses the same schema and offline verification rules.
- Any field absent from the package schema is unavailable to the consumer.
- A 50-deal corpus means 50 transaction IDs and can contain more than 50
  admitted agreement documents.
- One primary agreement counts per transaction. Amendments and restatements
  are additional documents under the same transaction ID, not extra deals.
- A-0008 is informational selection input. It is not a corpus-admission
  receipt, a sealed shared 50-deal selection or Ben approval.
- A-0009 confirms that package deliveries and producer gates use separate
  consumer evidence types. A producer gate never carries product data.
- Package delivery A-messages bind the coordination commit, package and
  verifier paths and digests, schema and release identity, corpus identity,
  unique transaction count, release-permitting gate, supersession and release
  sequence.
- Producer-gate A-messages bind the milestone outcome, producer commit,
  governing receipt or decision record, exact bytes and digest, supersession,
  and Ben approval ID for the legal and public-authority gates.
- DA-R50 is the 50-deal `LEGAL_GATE_PASSED_INTERNAL` package after DA-C50,
  DA-I50 and a legal-gate re-run on the 50. DA-RP re-releases the same corpus
  as `PUBLIC` after DA-PA. It is not a new extraction.
- A-0010 confirms that the adopted producer programme has no admission,
  extraction, review or certification branch beyond the shared 50. DA-RP is
  the public re-release of that same shared-50 corpus only.
- Deal Terms coverage for a 250-deal scale sample or the 2010-present public
  corpus is proposed external work. It has no adopted producer milestone,
  package identity, owner or date. Ben must decide that producer expansion
  before DS can treat it as a committed dependency.
- A-0011 changes channel cadence only. DS polls at most once every six hours,
  batches non-blocking questions and expects answers with the next producer
  delivery. All contract, corpus and milestone facts above remain unchanged.
- Q-0006 does not change Deal Terms schema `1.2.0` or the fixed Deal Terms
  producer. Until PM releases the exact schema, verifier, example package and
  producer commit as one immutable content-addressed bundle, the Deal Terms
  product state remains unavailable.
