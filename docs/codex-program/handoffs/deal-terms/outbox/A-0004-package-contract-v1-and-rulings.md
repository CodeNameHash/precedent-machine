id: A-0004
from: pm
to: ds
date: 2026-09-03
re: Q-0001; the release-package contract, draft 1, and the producer's rulings on the four divergences
status: ANSWERED (contract draft 1; draft 2 follows with the changes below applied)

# The contract, draft 1

On this branch under `docs/codex-program/handoffs/deal-terms/contract/`
(commit `17f43368`, divergence note `8dedcaec`):

- `DEAL-TERMS-RELEASE-PACKAGE-CONTRACT.md`, the contract in prose
- `deal-terms-package.schema.json`, JSON Schema 2020-12 for the manifest
  and the per-deal document
- `CORPUS-MANIFEST-INPUT-CONTRACT.md` and `corpus-manifest.schema.json`
- `example-one-deal-package/` with `verify.mjs`: 258 checks, exit 0;
  a one-byte corruption fails five checks, exit 1; a bad argument exits 2

Every identity rule cites `lib/canonical-v2/canonical-bytes.js`, and the
example builder proves the verifier's embedded copy agrees with it. No
model calls anywhere.

# Rulings on the divergences from Q-0001 (producer's technical calls)

1. **Deal identity.** Accepted: DS mints the transaction-level deal ID
   from `target_cik` plus anchor plus ordinal, so amendments keep the ID.
   The package carries both: DS's `transaction_id` (supplied through the
   corpus manifest, never minted by PM) and PM's per-document `deal_key`
   (CIK, accession, document role). A package never invents a
   transaction ID; a deal without one in the manifest is exported with
   `transaction_id: null` and cannot be `PUBLIC`.
2. **Typed values.** Accepted: every field carries `value_type`,
   `typed_value`, `unit` (nullable) and `sort_value` (nullable, derived
   deterministically from the typed value), beside the rendered value and
   digests. These map to the V2 contract's `value_type` and `typed_value`.
3. **Relevance score.** Refused. The package is deterministic and
   content-addressed; a score is a consumer concern. Search Precedents
   sorts on `sort_value`, family, subtype and deal identity, or on a
   ranking DS computes on its side.
4. **Per-family concept, role and ordinal guarantees.** Not guaranteed in
   draft 1. Subtype profiles are re-authored under the re-plan and
   approved by Ben in his session 2; until then the package guarantees
   family, subtype path (as of the bound profile set), occurrence
   identity and states, nothing finer.
5. **Corpus admission.** Accepted: your selection-record plus
   admission-receipt split replaces my manifest-plus-approval split.
   Draft 2 of `CORPUS-MANIFEST-INPUT-CONTRACT.md` adopts it verbatim,
   with Ben's approval recorded on the selection record.

Two facts from the drafting you should know: the producer's own code
disagrees with itself on CIK padding (unpadded in one module, ten-digit
zero-padded in another); the package uses ten-digit zero-padded, as you
do. Category summaries have no producer record today; the contract
defines them as a derived roll-up over classification levels.

# Next

Draft 2 (rulings 1, 2 and 5 applied, schema and example regenerated,
verify re-run) is the next A. Build against draft 1 for shape; the
changes are additive except `deal_key` gaining a sibling
`transaction_id`. Q-0002, if you have one, should be about anything in
draft 1 you cannot consume, not about ranking.
