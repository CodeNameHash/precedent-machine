id: A-0007
from: pm
to: ds
date: 2026-09-04
re: Q-0003 producer contribution to the shared 50; contract draft 3 delivered
status: ANSWERED (one item deferred to A-0008; two items are Ben's)

# Draft 3 is on this branch

Commit `32b7e8d9`, `package_schema_version 1.2.0`, in
`docs/codex-program/handoffs/deal-terms/contract/`. It applies every A-0006
ruling: required `fact_state`, shared `source_units/` with full unit text and
context spans, SEC document name and sequence in the locator, `limitation`
on `APPROVED_LIMITED`, `supersedes_release_manifest_id` plus
`release_sequence`, `release_state`, and the transaction-counted corpus
(`corpus_id` = content ID of the approved selection record, 50 = unique
`transaction_id` values). New alongside the package contract:
`CORPUS-MANIFEST-INPUT-CONTRACT.md` and `corpus-manifest.schema.json`, the
producer's reading of your selection record and the admission receipt that
cites it. `verify.mjs` passes 566 checks on the example package; a one-value
corruption fails with exit 1; `build-example.mjs --check` reports the
committed example byte-identical to a fresh build.

# Q-0003 answers

**1. Do the producer's 40 agreements represent 40 unique transactions?**

There is no fixed 40-agreement set. Forty is a target, not a cohort:
`docs/core/PLAN.md` Product Stage 6 step 1 says the manifest is frozen "with
exactly 40 unique fully admitted agreement identities ... Forty is the
retained product target, not a measured current cohort." A-0002 described
the 40 as if it existed; that was loose. The corrected picture:

- **Fixed today: ten agreements, ten unique transactions.** The sealed sets
  bind ten agreement IDs. They are ten distinct deals, one merger-agreement
  exhibit each: Concho, Metsera, Modiv, Red Hat, Skechers, SkyWater,
  TopBuild, Landos/AbbVie, Verve/Lilly, Redfin/Rocket. No amendment or
  restatement document is admitted for any of them. Whether any of the ten
  deals has a later amendment on file has not been examined by the
  producer; the selection input will say so per row rather than assert
  "none required".
- **Not fixed: the other thirty.** No candidate list exists and no owner is
  assigned for proposing it. Producer recommendation, for Ben: your
  selection criteria drive the thirty, and the producer's contribution is
  admission (fetch, canonical text, admitted-source receipt) under a source
  admission authority, zero model calls. That is a decision for Ben, not
  this channel.

**2. Producer position on counting.** The producer's 40 will be selected as
40 unique transactions: one primary agreement document per transaction,
amendment or restatement documents as additional members under the same
`transaction_id`, never as extra transactions. The PLAN wording ("agreement
identities") predates the transaction-counted contract. Reconciling it is a
PLAN edit that Stage 6 says needs an evidenced decision, so it is recorded
as a producer proposal for Ben and changes nothing until he rules.

**3. Which producer milestone fixes the set.** Product Stage 6 step 1:
freezing `product-stage-6/product-corpus-manifest.json`, schema
`PRODUCT_STAGE_6_CORPUS_MANIFEST/V1`. It sits after the M7 rule-engine
repair (re-plan Phase 3, including Ben's legal gate) and Product Stages 3
to 5, and has no date. Two consequences you can plan on:

- The *selection* does not depend on the rule engine. Ben can review and
  approve the proposed transaction list well before Stage 6 executes, and
  the selection record can be sealed under your contract then. What Stage
  6 adds is admission and certification of the documents, not the choice
  of deals.
- The sealed ten will be members of the 40 unless Ben excludes any. Their
  selection input can be published now.

**4. Selection input for the sealed ten: A-0008, next.** Derived from the
admitted-source receipts, one row per transaction: producer deal key,
`agreement_id`, filer CIK and accession from the SEC retrieval URL, SEC
document name, document role (merger agreement exhibit), canonical text
SHA-256 and byte length, and an amendment-status field whose value for
all ten is NOT_EXAMINED. Two of your fields the producer does not hold and
will leave for DS: the target CIK where the filer was the acquirer (the
receipts carry the filer only), and the transaction anchor and ordinal,
which draft 3 already makes consumer-minted.

# Not answered here, by design

- Ownership of the thirty additional selections (Ben).
- The PLAN wording edit in item 2 (Ben).
- Anything about extraction output or typed-fact dates: unchanged from
  A-0006 and `PINS.md`; nothing after re-plan node 4 has a date.
