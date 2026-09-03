# The corpus manifest input contract, version 1

`schema_version: CORPUS_MANIFEST_INPUT/V1` — machine-readable form:
`corpus-manifest.schema.json`.

This is the input contract for a corpus **before** it exists: the record that
names which deals a corpus is to contain, so that Ben can approve it and
Precedent Machine can then admit them one at a time. It is the only way a deal
enters a corpus.

It is **not** the corpus manifest inside a released package. That one lives at
`corpus/corpus-manifest.json`, describes deals that are already admitted, and
has no nullable field; its schema is
`deal-terms-package.schema.json#/$defs/corpusManifest`. The two are different
records at different stages, and conflating them is the mistake this section
exists to prevent.

**No deal is named here.** Which deals go into the shared 50-deal proof corpus
is Ben's call, per `outbox/A-0002-approach-corpus-and-packages.md`. Neither
agent proposes them. This document fixes the shape so that when Ben names
them, there is nothing left to argue about.

---

## 1. The rule

> **A deal enters a corpus only through an approved corpus manifest input plus
> an admission receipt. There is no other path.**

Concretely, four things must all be true before a deal's Deal Terms may appear
in any released package:

1. The deal appears as a member of a `CORPUS_MANIFEST_INPUT/V1` record.
2. That exact record — by content ID and by the SHA-256 of its committed bytes
   — carries a `CORPUS_MANIFEST_APPROVAL/V1` record with
   `approval_state: APPROVED` and Ben's `ben_approval_id`.
3. The member's `admission_state` is `ADMITTED`.
4. The member carries an admitted-source receipt reference and the canonical
   text SHA-256 that admission produced.

Nothing bypasses this. A deal that is in the repository, in a fixture, in a
prior run, or simply convenient is not in the corpus until it is in an
approved manifest with an admission receipt.

## 2. The manifest record

| field | rule |
|---|---|
| `schema_version` | `CORPUS_MANIFEST_INPUT/V1` |
| `corpus_manifest_input_id` | `contentId('CORPUS_MANIFEST_INPUT/V1', <this record without this field>)`, per `lib/canonical-v2/canonical-bytes.js` |
| `corpus_kind` | `ONE_DEAL`, `FIVE_DEAL`, `SHARED_50_PROOF`, `PUBLIC`. `SHARED_50_PROOF` has exactly 50 members |
| `supersedes_corpus_manifest_input_id` | the manifest this replaces, or `null` for the first |
| `members[]` | ordered by `deal_key`, no duplicates |
| `counts` | `member_count` plus a tally per admission state |

**The manifest is content-addressed and therefore immutable.** Admitting a
deal changes a member's fields, which changes the content ID, which makes a
*new* manifest that names the old one in
`supersedes_corpus_manifest_input_id`. The chain of manifests is the audit
trail: the proposal Ben approved stays resolvable for ever, and cannot be
edited into looking like something else after the fact.

That immutability has a direct consequence, and it is deliberate: **approval
attaches to one manifest, and does not carry over to its successor.** A
manifest that gains a deal after approval is a different manifest and needs a
new approval. A manifest that only records admissions of already-approved
deals is a mechanical successor; PM records the approval lineage on the
admission receipt rather than asking Ben to re-approve the same deal list.

## 3. Per-deal members

Each member carries the deal's SEC identity, always, and its admission
evidence, once it exists.

| field | before admission | after admission |
|---|---|---|
| `deal_key` | `contentId('DEAL_TERMS_DEAL_KEY/V1', {source_system, issuer_cik, accession, document_role_key})` | unchanged |
| `source_system` | `SEC_EDGAR` | unchanged |
| `issuer_cik` | ten digits, zero-padded | unchanged |
| `accession` | `NNNNNNNNNN-NN-NNNNNN` | unchanged |
| `document_role_key` | upper-snake role key from PM's document role registry | unchanged |
| `admission_state` | `PROPOSED` | `ADMITTED` (or `REJECTED` / `WITHDRAWN`) |
| `admitted_source_receipt` | `null` | `{source_admission_manifest_id, admission_receipt_id, receipt_sha256}` |
| `canonical_text_sha256` | `null` | 64-hex |
| `agreement_id` | `null` | 64-hex |
| `admission_reason_code` | `null` | `null`, or a code for `REJECTED` / `WITHDRAWN` |

The deal key is computable at proposal time, because it depends only on the
three SEC identity fields. That matters: Ben's approved list is keyed by the
same identity the released package will use, so the two can be reconciled
mechanically rather than by name-matching.

The nullability is enforced conditionally, not loosely: `ADMITTED` requires
all three evidence fields non-null and `admission_reason_code` null; every
other state requires all three null; `REJECTED` and `WITHDRAWN` require a
reason code.

### What the admitted-source receipt reference points at

Both IDs are content IDs of records `lib/canonical-v2/sec-source-admission.js`
already produces:

- `source_admission_manifest_id` — the `SOURCE_ADMISSION_MANIFEST/V2` record,
  which binds the immutable source document, the canonical text, the
  verification manifest and the admitted byte intervals.
- `admission_receipt_id` — the `SOURCE_ADMISSION_PREPARATION_RECEIPT/V1`
  record, whose `terminal_status` must be `PASS`.
- `receipt_sha256` — SHA-256 of the receipt's committed bytes. The content ID
  proves what the record says; the SHA-256 proves which bytes said it. Both,
  because they fail differently.

`canonical_text_sha256` is the SHA-256 of the canonical text admission
produced, and is the same value the released package will carry in
`provenance.canonical_text_sha256`. It is what ties an approved corpus member
to a shipped deal document.

## 4. Approval

Approval is a **separate record**, not a field:

| field | rule |
|---|---|
| `schema_version` | `CORPUS_MANIFEST_APPROVAL/V1` |
| `corpus_manifest_approval_id` | content ID of this record without this field |
| `corpus_manifest_input_id` | the exact manifest approved |
| `corpus_manifest_input_sha256` | SHA-256 of that manifest's committed bytes |
| `approval_state` | `APPROVED` or `REJECTED` |
| `ben_approval_id` | content ID of Ben's approval record |
| `approved_at` | RFC 3339 UTC, second precision |

It has to be separate. If the manifest carried its own approval, the approval
would be an input to the manifest's content ID and the manifest's content ID
would be an input to the approval — a cycle, and neither could be computed.
The pattern here is the one already used in
`lib/canonical-v2/deal-source-binding.js`, where
`DOCUMENT_ROLE_REGISTRY_AUTHORITY/V1` carries `document_role_registry_id`,
`ben_approval_id` and `authority_status` and sits outside the registry it
authorises.

**Ben's approval is non-delegable.** No agent — Precedent Machine, Deal
Storylines, or any sub-agent of either — may synthesise, infer or default a
`ben_approval_id`. A manifest with no approval record is a proposal, and a
proposal admits nothing.

## 5. Where this diverges from Q-0001, for the lead to rule on

`inbox/Q-0001-consumer-contract-requirements.md` landed after this draft was
written, and A-0003 asked the next A to say whether DS's two-record split is
accepted. This draft has **not** been reconciled with it. Two differences
matter:

1. **What the two records are.** DS proposes an immutable
   `SHARED_50_DEAL_SELECTION/V1` selection record plus a separate *admission
   receipt* that adds admission fields **without rewriting the selection**.
   This draft's two records are the manifest input and its *approval*, and it
   records admission by superseding the manifest (§2). Both keep the approved
   selection resolvable, but DS's split does so without producing a manifest
   chain, and is the better fit for its stated need. Adopting it is a small
   change to this document and a larger one to nothing else; PM's lead should
   simply accept it.
2. **Which deal ID keys a member.** DS's selection carries a DS-minted
   `deal_id` plus `target_cik` and a `transaction_anchor`, and lists
   `required_agreements` per deal. This draft keys members by PM's
   document-level `deal_key` and has no per-deal required-agreement list. This
   is the same unresolved question as §7.1 item 1 of
   `DEAL-TERMS-RELEASE-PACKAGE-CONTRACT.md`, and it must be settled once, in
   both documents together.

Neither is decided here. Guessing at a corpus-identity convention that Ben
then approves would bake the guess into an approval record.

## 6. What this contract does not decide

Two things are open and are named here so nobody assumes they were settled:

- **Which deals.** Ben names them. Neither agent proposes a list.
- **How typed facts are extracted for newly admitted deals.** Per A-0002, that
  is either a model-assisted extraction run, locked until M7 passes its legal
  gate and separately authorised by Ben, or parser-only extraction with a
  large review-only residue. **This manifest contract is identical under
  both.** Only the admission receipt records which route was taken, so DS can
  build against this shape today without waiting for that answer.

---

*Producer: Precedent Machine. Channel: `coord/deal-terms`. Companion
documents: `DEAL-TERMS-RELEASE-PACKAGE-CONTRACT.md`,
`deal-terms-package.schema.json`, `corpus-manifest.schema.json`.*
