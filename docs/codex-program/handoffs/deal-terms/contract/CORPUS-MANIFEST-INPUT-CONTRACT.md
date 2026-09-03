# The corpus input contract, draft 2

Two records: `SHARED_50_DEAL_SELECTION/V1` and `CORPUS_ADMISSION_RECEIPT/V1`.
Machine-readable form: `corpus-manifest.schema.json`.

This is the input contract for a corpus **before** it exists: the record that
names which deals a corpus is to contain, so Ben can approve it and Precedent
Machine can then admit them one at a time.

**Draft 2 adopts the consumer's two-record split** from
`inbox/Q-0001-consumer-contract-requirements.md` §3, ruled accepted in
`outbox/A-0004-package-contract-v1-and-rulings.md` (ruling 5). Draft 1's
manifest-plus-approval split is gone. The difference that mattered: draft 1
recorded admission by superseding the manifest, which produced a chain of
manifests and made the approved selection one link in it. The consumer's split
keeps the approved selection **immutable and singular**, and puts admission
results in a separate record that cites it. That is better and is now what
this contract says.

Neither record is the corpus manifest inside a released package. That one
lives at `corpus/corpus-manifest.json`, describes deals already admitted, and
has its own schema at
`deal-terms-package.schema.json#/$defs/corpusManifest`.

**No deal is named here.** Which deals go into the shared 50-deal proof corpus
is Ben's call, per A-0002. Neither agent proposes them. This document fixes the
shape so that when Ben names them there is nothing left to argue about.

---

## 1. The rule

> **A deal enters a corpus only through an approved selection record plus an
> admission receipt. There is no other path.**

Four things must be true before a deal's Deal Terms may appear in a released
package:

1. The deal appears in a `SHARED_50_DEAL_SELECTION/V1` record.
2. That record carries `approved_by: "Ben"`, `approved_on` and a
   `ben_approval_id`.
3. A `CORPUS_ADMISSION_RECEIPT/V1` cites that selection by `corpus_id` and by
   the SHA-256 of its bytes, and carries an entry for the deal's required
   agreement with `admission_state: ADMITTED`.
4. That entry carries the admitted-source receipt reference, the
   canonical-text SHA-256 and the `agreement_id` admission produced.

Nothing bypasses this. A deal that is in the repository, in a fixture, in a
prior run, or simply convenient is not in the corpus until both records say so.

## 2. The selection record

Adopted from Q-0001 §3, with one addition noted below.

| field | rule |
|---|---|
| `schema_version` | `SHARED_50_DEAL_SELECTION/V1` |
| `corpus_id` | `contentId('SHARED_50_DEAL_SELECTION/V1', <this record without corpus_id>)` |
| `purpose` | `INTERNAL_PROOF` or `PUBLIC_PRODUCT` |
| `required_deal_count` | must equal `deals.length` |
| `selection_rule_version` | the governed rule ID the deals were chosen under |
| `approved_by` | `Ben` |
| `approved_on` | `YYYY-MM-DD` |
| `ben_approval_id` | content ID of Ben's approval record |
| `deals[]` | ordered by `ordinal`, `0..n-1` with no gaps, `deal_id` unique |

**The selection record is immutable and is never rewritten.** Admitting a deal
does not touch it. That is the whole point of the split, and it is why
`corpus_id` can be cited in a released package without a caveat.

**The one addition to Q-0001's shape is `ben_approval_id.`** Q-0001 has
`approved_by` and `approved_on`, which say who and when; the added field says
*which ruling*, as a content ID, so approval is verifiable rather than a name
in a string. It follows the pattern already used in
`lib/canonical-v2/deal-source-binding.js`, where
`DOCUMENT_ROLE_REGISTRY_AUTHORITY/V1` carries a `ben_approval_id`.

Approval fields sit inside the payload, so they are inputs to `corpus_id`. An
unapproved draft and the approved selection are therefore different records
with different IDs. That is intended: only an approved selection has a
`corpus_id` worth citing, and approval cannot be bolted onto a selection after
the fact without changing its identity.

**Ben's approval is non-delegable.** No agent — Precedent Machine, Deal
Storylines, or any sub-agent of either — may synthesise, infer or default a
`ben_approval_id`.

### Per-deal fields

| field | rule |
|---|---|
| `ordinal` | position in the selection |
| `deal_id` | the consumer-minted transaction-level ID: `sha256Hex(canonicalJson(<PUBLIC_MA_DEAL/V1 payload>))` over `target_cik`, `transaction_anchor` and `announced_transaction_ordinal` |
| `target_cik` | ten digits, zero-padded |
| `transaction_anchor` | `{issuer_cik, accession_number, document_role}` — the first executed transaction document |
| `required_agreements[]` | `{agreement_role, issuer_cik, accession_number, document_name, document_role, required}` |

**`deal_id` here is `transaction_id` in a released package.** Same value, two
names, because a package already uses `deal_key` for its per-document key and
two things called "deal id" would be read wrongly within the week. Per A-0004
ruling 1, the producer never mints or reissues it: it flows selection record →
admission receipt → package, unchanged.

`document_name` is permitted in this record because this record is an input,
not a package. **A released package never carries it.** Packages identify
documents by role and by content, and `verify.mjs` rejects anything file-name
shaped (§10 of the package contract). The export strips it.

## 3. The admission receipt

A separate record, cited by the package, that adds admission results without
rewriting the selection.

| field | rule |
|---|---|
| `schema_version` | `CORPUS_ADMISSION_RECEIPT/V1` |
| `corpus_admission_receipt_id` | content ID of the record without this field |
| `corpus_id` | the selection this receipt admits against |
| `selection_record_sha256` | SHA-256 of the selection's committed bytes |
| `producer_run_id` | the run that performed the admissions |
| `admissions[]` | ordered by `deal_key`, one entry per required agreement |
| `counts` | `admission_count` plus a tally per admission state |

Each admission entry:

| field | before admission | after admission |
|---|---|---|
| `deal_id` | the selected deal | unchanged |
| `deal_key` | `contentId('DEAL_TERMS_DEAL_KEY/V1', {source_system, issuer_cik, accession, document_role_key})` for the required agreement | unchanged |
| `agreement_role` | the consumer's role label | unchanged |
| `admission_state` | `PROPOSED` | `ADMITTED`, `REJECTED` or `WITHDRAWN` |
| `agreement_id` | `null` | 64-hex |
| `admitted_source_receipt` | `null` | `{source_admission_manifest_id, admission_receipt_id, receipt_sha256}` |
| `canonical_text_sha256` | `null` | 64-hex |
| `failure_reason_code` | `null` | `null`, or a code for `REJECTED` / `WITHDRAWN` |

`deal_key` is where the two identity systems meet: the consumer keys the
*transaction*, the producer keys the *document*, and this record binds them.
Both are computable before admission, because both depend only on SEC identity.

Nullability is conditional, not loose: `ADMITTED` requires the three evidence
fields non-null and `failure_reason_code` null; every other state requires all
three null; `REJECTED` and `WITHDRAWN` require a reason code.

### What the admitted-source receipt reference points at

Both IDs are content IDs of records
`lib/canonical-v2/sec-source-admission.js` already produces:

- `source_admission_manifest_id` — the `SOURCE_ADMISSION_MANIFEST/V2` record,
  binding the immutable source document, the canonical text, the verification
  manifest and the admitted byte intervals.
- `admission_receipt_id` — the `SOURCE_ADMISSION_PREPARATION_RECEIPT/V1`
  record, whose `terminal_status` must be `PASS`.
- `receipt_sha256` — SHA-256 of the receipt's committed bytes. The content ID
  proves what the record says; the SHA-256 proves which bytes said it. Both,
  because they fail differently.

`canonical_text_sha256` is the same value the released package carries in
`provenance.canonical_text_sha256`. It is what ties an admitted corpus member
to a shipped deal document.

## 4. What this contract does not decide

- **Which deals.** Ben names them. Neither agent proposes a list.
- **How typed facts are extracted for newly admitted deals.** Per A-0002 that
  is either a model-assisted extraction run, locked until M7 passes its legal
  gate and separately authorised by Ben, or parser-only extraction with a large
  review-only residue. **Both records are identical under either.** Only
  `producer_run_id` on the admission receipt records which route was taken.

---

*Producer: Precedent Machine. Channel: `coord/deal-terms`. Companion documents:
`DEAL-TERMS-RELEASE-PACKAGE-CONTRACT.md`, `deal-terms-package.schema.json`,
`corpus-manifest.schema.json`.*
