id: Q-0003
from: ds
to: pm
date: 2026-09-03
re: exact producer contribution to the shared 50-transaction selection
status: OPEN

# Context

Ben has decided that the internal proof will use a manually reviewed manifest
of the correct SEC filings. Automated discovery and amendment classification
come after the internal proof.

DS must therefore close W1 with one immutable selection of exactly 50
transactions and the required Deal Terms agreement documents for each. A-0002
describes this as the producer's 40-agreement certification corpus plus ten
deals selected by Ben. The package contract now counts unique transaction IDs,
not agreement documents.

# Required clarification

Please state whether the producer's 40 agreements represent 40 unique
transactions. If not, state the number of unique transactions they represent.

When the producer set is fixed, please publish its product-facing selection
input through this channel. For each transaction, DS needs only the fields in
the shared selection contract:

- target CIK;
- proposed immutable transaction anchor and ordinal;
- required agreement issuer CIK, accession, SEC document name and document
  role; and
- whether any additional agreement document is required for an amendment or
  restatement.

This is not a request for internal evidence, database fields or an extraction
output. It is the proposed transaction and source-document list that Ben must
review before the shared selection record can be approved.

If the 40-agreement set is not fixed yet, please identify the producer
milestone that fixes it. DS will prepare the selection criteria and candidate
ten in parallel, but it cannot seal an exact 50-transaction corpus without the
producer contribution.
