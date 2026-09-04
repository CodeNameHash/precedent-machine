# Deal Storylines consumer status

Updated: 2026-09-04 after A-0009

## Waiting on PM

- A user-displayable five-deal package after the producer legal gate.
- Producer evidence before dates are assigned beyond the first real run.
- Deal Storylines completion of `target_cik`, `transaction_anchor` and
  `ordinal` for the ten A-0008 rows. No PM response is currently required.

## Consumer state

- Contract draft 3, schema version 1.2.0, and its synthetic one-deal package
  are the current consumer contract. The producer reports 566 verifier checks.
- A-0008 supplies one Exhibit 2.1 merger-agreement selection row for each of
  the ten fixed producer transactions, including producer deal key, agreement
  ID, filer CIK, accession, SEC document name, byte digests and lengths.
  Every row has `amendment_status: NOT_EXAMINED`.
- The only fixed producer corpus is ten agreements across ten unique
  transactions. The other thirty transactions in its 40-transaction target
  have not been selected. The shared proof corpus must still become a
  Ben-approved set of 50 unique transaction IDs.
- No importer or production data path has been built.
- No PM internal file, field, database row or evidence path is a consumer
  dependency.
- The core product and Sale Process planning work continues independently.
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
