# The Deal Terms release-package contract, draft 3

`package_schema_version: 1.2.0`

Precedent Machine (PM) is the producer. Deal Storylines (DS) is the consumer.
This document is the whole of what DS may build against. It implements the
approach decided in `outbox/A-0002-approach-corpus-and-packages.md`, the
rulings in `outbox/A-0004-package-contract-v1-and-rulings.md`, and the rulings
on Q-0002 in `outbox/A-0006-q0002-rulings-draft2-draft3.md`; the
machine-readable form is `deal-terms-package.schema.json`, and the executable
form is `verify.mjs`. Where the three disagree, `verify.mjs` wins, because it
is the thing that runs.

**No released package exists yet.** This contract can be built against today;
the first package cannot be cut until the first real ten-agreement V2 run
passes the producer's contract validator. See `../PINS.md`.

---

## 1. Purpose and boundary

A package is an immutable, content-addressed directory of JSON. It is the only
artefact that crosses from PM to DS.

- DS reads packages. DS does not read PM's database, evidence tree, source
  code, CI or runtime, and holds no credential of PM's.
- PM never reads DS's product. The channel is one-way and file-shaped.
- A package is self-contained and self-verifying. Everything needed to check
  it is inside it. Verification needs no network, no model, no PM repository
  and no PM service.
- A field not in this contract does not exist. If DS needs something, it asks
  through `inbox/Q-NNNN-*.md`; PM answers with a new schema version, never by
  quietly adding a field.
- A package asserts nothing about correctness beyond what its own review
  states say. A claim marked `REVIEW_ONLY` has not been accepted by a lawyer,
  and a package whose `release_state` is not `PUBLIC` must not be shown to
  end users.

## 2. Package layout

A package is a directory (or a tar/zip archive of one; the archive adds
nothing and is checked after extraction).

```
<package-root>/
  manifest.json                        the release manifest
  corpus/corpus-manifest.json          which transactions this release covers
  deals/<deal_key>/deal.json           one document per deal
  source_units/<deal_key>.json         the full text of every governed unit
  verify.mjs                           the verifier, shipped with the package
```

Every path is forward-slash and package-relative. There are no other
directories and no other file names at v1: `verify.mjs` rejects a path it does
not recognise, so a future addition is a schema-version change, not a surprise.

`manifest.json` lists every other file with its SHA-256 and byte length, and
lists nothing that is not on disk. `manifest.json` never lists itself; its own
integrity comes from `release_manifest_id`, which is the content ID of its own
body.

## 3. Identity rules

**Every identifier in a package is a 64-character lowercase hex digest, and
every one of them is produced by `lib/canonical-v2/canonical-bytes.js`.** That
module defines three functions and this contract uses no others:

- `canonicalJson(value)` — JSON with object keys sorted, no whitespace, finite
  numbers only, plain objects only.
- `sha256Hex(bytes)` — SHA-256 of UTF-8 bytes, lowercase hex.
- `contentId(domain, payload)` — `sha256Hex` over
  `"CANONICAL_CONTENT_ID/V1\0" + <byte length of domain> + ":" + domain +
  "\0" + canonicalJson(payload)`. The domain prefix means the same payload
  under two schemas can never collide.

`verify.mjs` carries a copy of these three functions, because a package cannot
import from PM's repository. The copy is pinned by a self-test vector computed
by the real module (`SELF_TEST_ID` in `verify.mjs`), and `build-example.mjs`
cross-checks the copy against `lib/canonical-v2/canonical-bytes.js` on every
run. If the copy ever drifts, both fail loudly before any package is read.

### 3.1 Deal identity

A deal document is keyed by **issuer CIK + SEC accession number + document
role**, and the key is the content ID over exactly those, plus the source
system:

```
deal_key = contentId('DEAL_TERMS_DEAL_KEY/V1', {
  source_system: 'SEC_EDGAR',
  issuer_cik:    '0000000000',            // ten digits, zero-padded
  accession:     '0000000000-00-000000',  // NNNNNNNNNN-NN-NNNNNN
  document_role_key: 'MERGER_AGREEMENT',  // from PM's document role registry
})
```

The three components are always carried in the clear beside the key, in
`deal_identity`, so DS never has to invert a hash. `verify.mjs` recomputes the
key from the components and fails on any disagreement.

Grounding: `issuer_cik`, `accession` and `document_role_key` are the fields
`lib/canonical-v2/deal-source-binding.js` already uses for SEC identity
(`DEAL_SOURCE_BINDING/V2`, `ACCESSION_RE = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/`,
`ROLE_KEY_RE = /^[A-Z][A-Z0-9_]{1,63}$/`). One caveat, stated rather than
hidden: PM has two CIK conventions internally — `deal-source-binding.js`
validates an unpadded CIK, `lib/canonical-v2/entity-subject.js` requires a
zero-padded ten-digit `SEC_CIK`. **This contract takes the zero-padded
ten-digit form**, because it is the one SEC itself publishes and it makes the
deal key canonical. PM normalises on export.

No EDGAR URL is carried. DS reconstructs the filing location from `issuer_cik`
and `accession`; a URL in the package would be a second, softer identity that
could drift from the hash-bound one.

### 3.1.1 `transaction_id`: the consumer's transaction-level identity

`deal_key` keys a *document*. DS keys a *transaction*, so that an amendment
keeps its identity. Per A-0004 ruling 1 a package carries **both**. Beside
`deal_key`, every deal document carries:

```
transaction_id: 64-hex, or null
```

Three rules, and `verify.mjs` enforces all three:

1. **A package never mints a transaction ID.** It is
   `sha256Hex(canonicalJson(<PUBLIC_MA_DEAL/V1 payload>))` over `target_cik`,
   the transaction anchor and the announced-transaction ordinal, as defined by
   DS in Q-0001 §2. PM computes nothing here.
2. **It arrives only through the corpus manifest.** The deal document's
   `transaction_id` must equal its corpus member's, so the manifest is the
   single route in. A package where the two disagree fails verification.
3. **`transaction_id: null` cannot be `PUBLIC`.** A deal DS has not yet keyed
   exports as null, which is a legitimate internal package; but if
   `release_state` is `PUBLIC` and any deal document has a null
   `transaction_id`, verification fails. An unkeyed deal is never shown to
   users.

In the corpus input contract this same value is called `deal_id`, because that
is DS's name for it (Q-0001 §3). Same value, two names; a package already uses
`deal_key`, and two things called "deal id" would be misread within the week.

**Multi-document deals and amendments** therefore have one `transaction_id`
across several `deal_key`s: the agreement, its amendments and the related
documents are separate deal documents sharing a transaction.

`agreement_id` is PM's own identity for the agreement: the content ID of its
canonical text. It is carried in `provenance` and is stable across releases.

### 3.2 Occurrence identity

Two occurrence identities cross the boundary unchanged:

- **`claim_occurrence_id`** — the M4 claim occurrence. One authored answer in
  one agreement.
- **`node_occurrence_id`** — the M2 structural node the claim's source text
  sits in.

Both are 64-hex, both are PM's, and neither is recomputable by DS. Their
integrity comes from the spans that reference them.

Every source span is **half-open over UTF-8 bytes** of the canonical text —
`[start_byte, end_byte)`, `coordinate_system: UTF8_CANONICAL_TEXT_HALF_OPEN`
— and carries the span's text and its SHA-256. `verify.mjs` requires, for
every span:

```
end_byte > start_byte
utf8ByteLength(excerpt_text) === end_byte - start_byte
sha256Hex(excerpt_text)     === text_sha256
```

This is not decoration. PM's pipeline slices by UTF-8 bytes everywhere;
JavaScript's `String.length`, `indexOf` and `slice` count UTF-16 code units. A
consumer that measures spans in code units gets the wrong answer on any clause
containing an em dash, a curly quote or an accented name. The example package
contains such a character deliberately, so a consumer that gets this wrong
fails on the first package it ever reads rather than on a real deal.

### 3.3 Revision identity

```
claim_revision_id = contentId('DEAL_TERMS_CLAIM_REVISION/V1',
                              <the claim record without claim_revision_id>)
```

So: **a changed answer is a new revision, and the occurrence identity does not
move.** If PM re-extracts, a lawyer corrects a value, or a display string is
reworded, `claim_occurrence_id` stays the same and `claim_revision_id`
changes. DS can therefore key its own storage on the occurrence, show a
history, and diff two releases by comparing revision IDs.

The same rule gives `category_summary_id`, `deal_document_id`,
`corpus_manifest_id` and `release_manifest_id`: each is the content ID of its
own record with its own ID field removed. Every one is recomputed by
`verify.mjs`.

One package carries at most one revision per occurrence. History lives across
releases, not inside one.

## 4. Provenance

`deal.json` carries a `provenance` block that identifies the document by
**content, never by location**:

| field | what it is |
|---|---|
| `agreement_id` | PM's canonical-text content ID for the agreement |
| `canonical_text_id`, `canonical_text_sha256`, `canonical_text_byte_length` | the exact canonical text the spans are measured against |
| `immutable_source_document_id`, `source_response_content_id` | the admitted original bytes |
| `source_admission_manifest_id` | content ID of the `SOURCE_ADMISSION_MANIFEST/V2` record |
| `admission_receipt_id` | content ID of the `SOURCE_ADMISSION_PREPARATION_RECEIPT/V1` record |
| `raw_source_sha256`, `raw_source_byte_length` | the pre-conversion filing bytes |
| `retrieval_url_sha256` | SHA-256 of the retrieval URL, not the URL |
| `sec_document_name`, `sec_document_sequence` | the document locator from the admitted-source receipt; nullable, and a null blocks `PUBLIC` |

Grounding: these are the fields `lib/canonical-v2/sec-source-admission.js`
already produces when it admits a source, and `lib/canonical-v2/deal-source-binding.js`
already binds. A package quotes them; it does not invent them.

**The document locator is the one filing-side name a package carries.**
Q-0002 §2 needs a consumer to be able to open the exact admitted document, so
`sec_document_name` and `sec_document_sequence` come across from the
admitted-source receipt. `sec_document_name` is a filing-side document name and
never a producer path: no separator is permitted, and `verify.mjs` validates it
positively against `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` rather than exempting
it from the scan. Where the receipt did not record them both are `null`, and a
package with any null here cannot be `PUBLIC`.

**No repository path ever appears in a package.** Not to evidence, not to a
fixture, not to a source file. PM's internal records do carry paths; the
export strips them. `verify.mjs` scans every string in the package for
path-shaped and credential-shaped content and fails on a hit.

**What a package proves about its own provenance, and what it does not.**
`verify.mjs` proves that each excerpt matches its own hash and its own span
width, and that every ID is the content ID of the record it labels. It cannot
prove the excerpt was cut from that canonical text, because the package does
not carry the canonical text — only the excerpts. That binding is proved on
PM's side, by the run receipt, against sealed M2 bytes. A consumer wanting to
re-prove it independently can fetch the SEC original from `issuer_cik` and
`accession`, convert it, and check `canonical_text_sha256`. Stating this
plainly is the point: a check that proves less than it appears to is worse
than no check.

## 5. Typed fact states and review states

A package uses PM's own vocabulary, unchanged, from
`lib/canonical-v2/m7-v2-contract.js`. Every claim carries all three parts:

```
state: { extraction_state, source_quality, review_state }
```

| part | values |
|---|---|
| `extraction_state` | `COMPLETE`, `INCOMPLETE`, `AMBIGUOUS` |
| `source_quality` | `SUFFICIENT`, `SOURCE_LIMITED`, `DRAFTING_AMBIGUOUS` |
| `review_state` | `NORMAL`, `APPROVED_LIMITED`, `REVIEW_ONLY`, `NO_COMPARISON`, `NO_OUTPUT` |

`review_state` is the contract's `output_disposition`. Only these combinations
are legal, and `verify.mjs` enforces exactly the producer's
`validStateCombination()`:

- `COMPLETE` + `SUFFICIENT` → `NORMAL`, `NO_COMPARISON` or `NO_OUTPUT`
- `COMPLETE` + `SOURCE_LIMITED` → `APPROVED_LIMITED`
- `REVIEW_ONLY` → only where extraction is `INCOMPLETE` or `AMBIGUOUS`, or
  quality is `DRAFTING_AMBIGUOUS`

What each `review_state` means to DS:

- **`NORMAL`** — a resolved Deal Term. Displayable, comparable, searchable.
- **`APPROVED_LIMITED`** — resolved, but the clause does not expressly state
  part of what the profile asks for. Displayable and comparable **only with
  its limitation shown**. DS must not render it as an unqualified answer.
- **`REVIEW_ONLY`** — not resolved. Not a fact. Displayable only as an open
  item with its reason codes; never in a comparison, a filter result or an
  aggregate.
- **`NO_COMPARISON`** — resolved, but deliberately not comparable across
  deals. Displayable on the deal, excluded from Compare Deals.
- **`NO_OUTPUT`** — produces no user-facing row at all. Carried so that DS can
  see the occurrence exists and was disposed of, not so it can be shown.

`reason_codes` is an array of upper-snake codes. It **must** be non-empty for
`REVIEW_ONLY` and **must** be empty for `NORMAL`. The codes named by the
producer's re-plan and therefore expected at v1 are `MATERIAL_SPAN_UNMODELLED`,
`DEPENDENCY_UNRESOLVED`, `PARTY_PROOF_UNPROVED`, `SIGNATURE_MISMATCH`,
`FAMILY_CORRECTION_PENDING`, `NO_SINGLE_PROFILE`, `CONTEXT_EDGE_UNPROVED` and
`MISSING_OPERATIVE_CHAPEAU`. The vocabulary is **open** at v1: PM is still
settling it, and a closed enum would force a schema bump on every new code.
DS must treat an unknown code as "open item, reason not understood" and never
as an error.

**On the first packages, every claim will be `REVIEW_ONLY`.** That is the
design of the first real run, not a defect. A package where nothing is
`NORMAL` is a valid package.

### 5.1 `fact_state`: the semantic state of one field

`review_state` describes a *claim*. It cannot say that a resolved claim's
clause is silent on one particular field, and Q-0002 §1 is right that
collapsing that into an empty string loses the finding. So per A-0006 ruling 1
every field carries a required `fact_state`:

| `fact_state` | meaning | what the field carries |
|---|---|---|
| `PRESENT` | a value was found | non-null `typed_value`, at least one evidence span |
| `ABSENT` | the clause was read and does not state it | `typed_value: null`, `examined_source_unit_id` |
| `NOT_APPLICABLE` | the field does not apply here | `typed_value: null`, a governed `reason_code` |
| `NOT_EXAMINED` | the subtype profile does not carry the field | nothing but the key and label |
| `FAILED` | extraction could not resolve it | nothing; the claim is `REVIEW_ONLY` and says why |

Every one of these is enforced by `verify.mjs`, in both directions: a
`NOT_APPLICABLE` field without a reason code fails, and so does a field
carrying a reason code in any other state.

**Three things a consumer must not do.**

1. **Do not collapse `ABSENT`, `NOT_APPLICABLE` and `NOT_EXAMINED`.** They are
   three different findings. "The agreement does not provide for interest",
   "interest does not apply to this kind of fee", and "we did not look at
   interest for this provision type" are three different sentences, and only
   the first is a statement about the deal.
2. **Do not render any of them as zero, false or an empty string.** That is the
   defect Q-0002 §1 reports, and the vocabulary exists to prevent it.
3. **Do not read `PRESENT` as "truthy".** `0`, `false` and an empty party set
   are values. A field is `PRESENT` when `typed_value` is not null, and the
   verifier tests exactly that. The example package carries a `BOOLEAN false`
   field marked `PRESENT` so a consumer that gets this wrong fails on its first
   package.

**Where it comes from.** `fact_state` is derived from the producer's V2
vocabulary in `lib/canonical-v2/m7-v2-contract.js`, not invented beside it:

- `FAILED` is the field-level shadow of a `REVIEW_ONLY` disposition. The
  contract's `validStateCombination()` only permits `REVIEW_ONLY` where
  extraction is `INCOMPLETE` or `AMBIGUOUS` or quality is
  `DRAFTING_AMBIGUOUS`, and the claim's `reason_codes` carry the issue codes
  (`MATERIAL_SPAN_UNMODELLED`, `DEPENDENCY_UNRESOLVED`, `PARTY_PROOF_UNPROVED`
  and the rest). `verify.mjs` therefore rejects a `FAILED` field on a claim
  that is not `REVIEW_ONLY` or that carries no issue code: a failure with no
  stated reason is not a failure, it is a silence.
- `ABSENT` is the field-level shadow of the contract's absence proofs. In the
  V2 contract an `APPROVED_LIMITED` rule carries `absence_proofs` naming the
  `field_key`, the source closure and the lawyer ruling; `ABSENT` records the
  same finding at field granularity, and `examined_source_unit_id` is what
  makes it a proof rather than an assertion.
- `NOT_APPLICABLE` and `NOT_EXAMINED` follow the profile: a field the subtype
  profile does not require is not examined, and one it excludes by a governed
  exclusion is not applicable. The reason code comes from the producer's
  disposition vocabulary.
- `PRESENT` is a fact the contract validated as an atomic typed value.

Because the profiles are still being re-authored under the re-plan, the exact
`NOT_APPLICABLE` reason-code list is open at 1.2.0, on the same terms as
`reason_codes` in §5: treat an unknown code as "not applicable, reason not
understood", never as an error.

## 6. Resolved claims and category summaries

`deal.json` carries `claims`, ordered by `claim_occurrence_id`, and
`category_summaries`.

A **category** is `(family_key, classification_path)`, where the classification
path is the claim's `classification_levels` from index 1 onward — that is,
everything below `APPLIES_TO`. This mirrors PM's projector: in
`lib/canonical-v2/agreement-projection.js`, `v2Classification()` puts
`APPLIES_TO` at level 0 and then the profile's `classification_path` as
`PROVISION_TYPE`, `SUB_PROVISION_TYPE`, `NESTED_SUBTYPE`, and so on.
`family_key` is one of the 25 in
`evidence/canonical-v2/stage-2y-structure-migration/control/family-keys.json`.

Rules `verify.mjs` enforces:

- Exactly one summary per category that has at least one summarisable claim.
- `NO_OUTPUT` claims are never summarised, and a category all of whose claims
  are `NO_OUTPUT` gets no summary.
- `counts` is the exact per-review-state tally of the referenced claims.
- `summary_review_state` follows the producer's precedence in
  `summariseOccurrenceStates()`: `REVIEW_ONLY` beats `APPROVED_LIMITED` beats
  `NORMAL` beats `NO_COMPARISON`. **A category containing one unresolved claim
  is an unresolved category.** DS must not present a category as settled when
  its roll-up says otherwise.

**A family returning zero claims is a correct answer, not a gap.** An
unfinanced deal has no guaranty provisions. DS must render an empty family as
"this agreement has none", never as "not yet extracted".

### 6.1 Field values: typed, united, sortable

Per A-0004 ruling 2 and A-0006 ruling 1, every entry of a claim's `fields[]`
carries these values. Only `PRESENT` carries a value, a unit and an order;
every other `fact_state` carries `null` for all three and no evidence span.

| field | what it is |
|---|---|
| `field_key`, `label` | the profile's field key and its display label |
| `fact_state` | the field's semantic state (§5.1) |
| `value_type` | one of the producer's twelve fact value types |
| `typed_value` | the machine-readable value, shaped by `value_type` |
| `unit` | the currency, duration unit, or `PERCENT`; `null` where the type carries none |
| `sort_value` | a scalar derived deterministically from `typed_value`; `null` where the type has no order |
| `rendered_value` | presentation only |
| `rendered_value_digest` | `sha256Hex(rendered_value)` |
| `evidence_spans` | the spans proving the value; non-empty exactly when `PRESENT` |
| `examined_source_unit_id` | the unit read; non-null exactly when `ABSENT` |
| `reason_code` | non-null exactly when `NOT_APPLICABLE` |
| `typed_value_digest` | `sha256Hex(canonicalJson(typed_value))`, computed in every state including null |

`value_type` is `FACT_VALUE_TYPES` from
`lib/canonical-v2/m7-v2-contract.js` (line 434 at the time of writing),
unchanged: `PARTY_SET`, `PARTY`, `ENUM`, `DEFINED_TERM`, `BOOLEAN`, `NUMBER`,
`PERCENTAGE`, `MONEY`, `DATE`, `DURATION`, `PERIOD`, `REFERENCE`.

`typed_value`'s shape is fixed by `value_type`, exactly as that module
validates an atomic fact, and `verify.mjs` ports the same rules:

| `value_type` | `typed_value` | `unit` | `sort_value` |
|---|---|---|---|
| `NUMBER` | finite number | `null` | the number |
| `PERCENTAGE` | finite number | `PERCENT` | the number |
| `MONEY` | `{amount, currency}` | the currency | `amount` |
| `BOOLEAN` | boolean | `null` | `1` / `0` |
| `DATE` | non-empty string | `null` | the string if `YYYY-MM-DD`, else `null` |
| `DURATION` | `{bound_type, count, unit}`, bound in `EXACT`/`WITHIN`/`AT_LEAST`, unit in `DAY`/`WEEK`/`MONTH`/`YEAR` | the unit | `count` × day-equivalent |
| `PERIOD` | as `DURATION`, bound in `EXACT`/`WITHIN` | the unit | `count` × day-equivalent |
| `ENUM`, `PARTY`, `DEFINED_TERM`, `REFERENCE` | non-empty string | `null` | the string |
| `PARTY_SET` | `{parties:[…]}`, non-empty, unique | `null` | `null` |

Four things DS must hold on to:

1. **Never parse `rendered_value`.** It is presentation. Every sort, filter and
   comparison uses `typed_value`, `sort_value` or `typed_value_digest`.
2. **The day-equivalents used by `sort_value` for durations are `DAY` 1,
   `WEEK` 7, `MONTH` 30, `YEAR` 365, and they are for sorting only.** A month
   is not thirty days. Using these to compute a deadline produces a wrong
   date; the unit and count are carried precisely so DS never has to.
3. **Never sort `MONEY` across differing `unit`s.** `sort_value` is the bare
   amount. Ordering USD against EUR by amount is meaningless, and the package
   deliberately does not carry an exchange rate.
4. **`sort_value: null` means "this type has no scalar order", not "unknown".**
   Missing, absent, not-applicable and non-comparable are carried by
   `review_state` and `reason_codes`, and stay distinct from zero and false.

Because `typed_value` is carried, `typed_value_digest` is **re-derivable**:
`verify.mjs` recomputes it rather than taking it on trust, and likewise
recomputes `unit` and `sort_value` from `typed_value`. A package cannot
disagree with itself about what a value is.

### 6.2 Source units: the complete provision text

Q-0002 §2 asked for the whole authored provision rather than the excerpts a
claim happens to cite, and A-0006 ruling 2 grants it. Every package carries
`source_units/<deal_key>.json`, a set with one record per governed occurrence:

| field | what it is |
|---|---|
| `node_occurrence_id` | the M2 occurrence; what claims and evidence spans reference |
| `heading_or_reference` | the unit's heading or section reference |
| `document_order` | position in the document; unique, and the set is ordered by it |
| `start_byte`, `end_byte`, `text_sha256` | the unit's half-open UTF-8 extent and its hash |
| `text` | **the full canonical text of the authored unit** |
| `context_spans[]` | each with `kind`, occurrence id, bytes, hash and text |

`kind` is `PARENT_CHAIN`, `GOVERNING_CHAPEAU` or `ARTICLE_CHAPEAU` — the
provenance kinds of the producer's source closure. A fee clause whose meaning
depends on the Article chapeau above it is not readable without them, which is
why they travel with the unit rather than being left for the consumer to find.

`verify.mjs` checks that every unit's `text` hashes to `text_sha256` and is
exactly `end_byte - start_byte` UTF-8 bytes, the same for every context span,
that no two units share a `document_order`, and that **every source unit id a
claim or an evidence span references exists in that deal's set**. A dangling
reference fails the package.

**Whole-agreement text is not carried**, only its `canonical_text_sha256` and
`canonical_text_byte_length` in `provenance`. Packages would otherwise double
in size to ship text the consumer can re-derive from the SEC original, and the
hash is what makes that re-derivation checkable.

### 6.3 The `APPROVED_LIMITED` limitation payload

An `APPROVED_LIMITED` answer displayed as though it were unqualified is a
misrepresentation, so per A-0006 ruling 3 the qualification travels with it.
Every `APPROVED_LIMITED` claim carries a required `limitation`:

| field | rule |
|---|---|
| `code` | from the producer's governed limitation vocabulary |
| `text` | the limitation text **as it appears in the ruling record** |
| `ruling_id` | content ID of that ruling record |

`verify.mjs` rejects an `APPROVED_LIMITED` claim without one, and rejects a
`limitation` on a claim in any other review state. A consumer displays `text`
beside the answer and must not paraphrase it: the wording is a lawyer's, and
`ruling_id` is what makes it attributable.

## 7. Stable references the four consumer interfaces need

Draft 2 applies A-0004's rulings, so this table is no longer a placeholder for
identity, typed values or sorting. It remains **provisional on naming**: the
rows say which fields of this contract each interface draws on, and PM will
rename nothing without a version bump. §7.1 records what A-0004 settled.

| interface | identity fields | display fields | filter keys | sort keys |
|---|---|---|---|---|
| **Terms Summary** | `deal_key`, `transaction_id`, `deal_document_id` | `deal_identity.*`, `category_summaries[].classification_path`, `summary_review_state`, `counts` | `family_key`, `summary_review_state` | `family_key`, `counts.NORMAL` |
| **Provision Analysis** | `claim_occurrence_id`, `claim_revision_id`, `deal_key` | `classification_levels`, `section_reference`, `fields[].label` + `rendered_value` + `typed_value` + `unit`, `source.spans[].excerpt_text`, `state`, `reason_codes` | `family_key`, `review_state`, `reason_codes`, `value_type` | `section_reference`, `source.spans[].start_byte`, `claim_occurrence_id` |
| **Compare Deals** | `claim_occurrence_id` per deal, `deal_key`, `transaction_id`, `corpus_id`, `production_release_id` | `fields[].typed_value`, `value_type`, `unit`, `rendered_value`, `typed_value_digest`, `state.review_state` | `family_key`, `classification_path`, `value_type`, `unit`, `review_state` ∈ {`NORMAL`, `APPROVED_LIMITED`} | `sort_value`, `deal_key`, `field_key` |
| **Search Precedents** | `claim_occurrence_id`, `deal_key`, `transaction_id` | `source.spans[].excerpt_text`, `section_reference`, `classification_levels`, `fields[].rendered_value` | `family_key`, `classification_path`, `review_state`, `issuer_cik`, `transaction_id` | **no relevance score** — see below; `sort_value`, `family_key`, classification path, then `deal_key` and `start_byte` |

Two notes that follow from section 5 and are not negotiable:

- Compare Deals and any aggregate must exclude `REVIEW_ONLY`, `NO_COMPARISON`
  and `NO_OUTPUT`, and must show the limitation on `APPROVED_LIMITED`.
- `typed_value_digest` is `sha256Hex(canonicalJson(typed_value))`. Two claims
  agree on a value **exactly when their digests are equal**. Comparing
  `rendered_value` strings compares presentation, not meaning, and reports
  false differences on formatting alone.

**There is no relevance score, and there will not be one.** A-0004 ruling 3
refused it: the package is deterministic and content-addressed, and a ranking
is a consumer concern that depends on the query. Search Precedents sorts on
`sort_value`, `family_key`, the classification path, and then `deal_key` and
`start_byte` as deterministic tie-breakers — an ordering any two consumers
reproduce identically. DS is free to rank on its own side; PM will not ship a
score, a score version, or a field reserved for one.

### 7.1 What A-0004 settled

Draft 1 recorded four divergences from Q-0001. All four are now resolved.

1. **Who mints the deal ID — resolved.** DS mints it. The package carries
   both identities: `transaction_id` as supplied, `deal_key` per document
   (§3.1.1). Applied in draft 2.
2. **Typed values — resolved.** Every field carries `value_type`,
   `typed_value`, `unit` and `sort_value` beside the rendered value and
   digests (§6.1). Applied in draft 2.
3. **Search ranking — resolved as a refusal.** No score, for the reason above.
4. **Per-family concept, role and ordinal — resolved as *not guaranteed*.**
   This is the one DS should read carefully. Subtype profiles are being
   re-authored under the re-plan and are approved by Ben in his session 2.
   Until then a package guarantees `family_key`, the subtype path as of the
   bound profile set, occurrence identity and the states — **and nothing
   finer**. There is no per-family concept ID, role or ordinal, and DS should
   not design a schema that assumes one appears later without a version bump.

## 8. Corpus identity

`corpus/corpus-manifest.json` says which transactions a release covers.

| field | rule |
|---|---|
| `corpus_kind` | `ONE_DEAL`, `FIVE_DEAL`, `SHARED_50_PROOF`, `PUBLIC` |
| `corpus_id` | **the content ID of Ben's approved transaction-selection record**, carried |
| `selection_record_sha256` | SHA-256 of that selection record's bytes |
| `ben_approval_id` | content ID of Ben's approval of it |
| `corpus_manifest_id` | content ID of the whole manifest record |
| `transactions[]` | per transaction: `transaction_id` and its `documents[]` |
| `counts` | `transaction_count` and `document_count` |

**`corpus_id` is never recomputed from the deal keys in a package.** A-0006
ruling 5. Draft 1 derived it from the sorted member keys, which was wrong: it
let a package mint a corpus identity for a selection nobody had approved. It is
now carried from the approved selection, and the package cites the selection's
bytes and Ben's approval so the citation is checkable against the selection
itself. `verify.mjs` no longer has a `corpusIdOf()` to call, deliberately.

**The size bound counts transactions, not documents.** A `SHARED_50_PROOF`
corpus has exactly 50 unique `transaction_id`s; `FIVE_DEAL` has 5; `ONE_DEAL`
has 1. A transaction may carry several documents — the agreement, its
amendments, related filings — and they sit **under** it, never beside it. That
is Q-0002 §5, and it is why counting documents would have given the wrong
answer for any deal with an amendment.

Per-document admission records carry `deal_key`, the SEC identity fields, the
document locator, `agreement_id`, `canonical_text_sha256`,
`source_admission_manifest_id` and `admission_receipt_id`. `verify.mjs`
requires each to agree with its deal document, that no `deal_key` appears under
two transactions, and that the documents across all transactions are exactly
the deal documents in the package.

The corpus manifest remains the **only** route by which a transaction ID enters
a package: a deal document's `transaction_id` must equal the transaction it
sits under. At most one transaction group may be unkeyed (`transaction_id:
null`), holding documents the consumer has not yet keyed; a package containing
one cannot be `PUBLIC` (§3.1.1).

Vocabulary warning, from `../PINS.md`: **"Fixed 50" inside PM means 50
lawyer-review items across nine agreements, not a 50-deal corpus.** The
50-deal corpus is `SHARED_50_PROOF` and nothing else.

The pre-admission shape is `CORPUS-MANIFEST-INPUT-CONTRACT.md`: DS's
selection-record plus admission-receipt split.

## 9. Release identity

`manifest.json`:

| field | rule |
|---|---|
| `package_schema_version` | semantic version, `MAJOR.MINOR.PATCH`. This draft is `1.2.0` |
| `release_manifest_id` | content ID of the manifest body without this field |
| `production_release_id` | PM's identifier for this release; immutable, a re-cut is a new release |
| `supersedes_release_manifest_id` | the previous release's `release_manifest_id`, or `null` for the first |
| `release_sequence` | integer, strictly increasing per `corpus_id`; `1` exactly when the predecessor is `null` |
| `producer_commit` | 40-hex git commit PM cut the package from. Not a branch name; a branch moves |
| `release_state` | `REVIEW_ONLY_INTERNAL`, `LEGAL_GATE_PASSED_INTERNAL`, `PUBLIC` |
| `public` | boolean, **true if and only if** `release_state` is `PUBLIC` |
| — | `PUBLIC` additionally requires every deal document to carry a non-null `transaction_id` (§3.1.1) and a non-null SEC document locator (§4) |
| `released_at` | RFC 3339 UTC, second precision |
| `files[]` | every file except `manifest.json`, with `sha256` and `byte_length`, ordered by path |

What the release states mean, per A-0002:

- **`REVIEW_ONLY_INTERNAL`** — for wiring a consumer, not for showing users.
  The first one-deal and five-deal packages are this, and stay this until M7
  seals.
- **`LEGAL_GATE_PASSED_INTERNAL`** — the M7 V2 receipt is sealed and the corpus
  admission receipt exists. Still internal.
- **`PUBLIC`** — only under Ben's one-use production authority. **PM's
  production authority is `NONE` today** (`docs/core/OPERATING-RULES.md`), so
  no package may carry this state until Ben grants it. `public: true` without
  that authority is a governance failure, not a formatting error.

### 9.1 Release lineage, snapshots and rollback

Per A-0006 ruling 4:

- **Every package is a complete snapshot of its corpus.** It is not a delta. An
  occurrence present in a predecessor and absent from a successor has been
  **withdrawn**, and a consumer should treat it as withdrawn rather than
  carrying it forward. Nothing is ever implied by omission.
- **`release_sequence` orders releases, not `released_at`.** The timestamp is
  informational. Two releases cut in the same second still have distinct
  sequences, and a clock is not an ordering a consumer should trust.
- **A consumer activates exactly one verified release per corpus at a time.**
  Verify first, then activate; never serve from a package that has not exited 0.
- **Rollback is activating the exact predecessor**, by its
  `supersedes_release_manifest_id`. Because each release is a full snapshot,
  rollback needs no replay and no inverse: the predecessor is already complete.

`verify.mjs` checks the biconditional — `release_sequence` is 1 exactly when
`supersedes_release_manifest_id` is null — and that no release supersedes
itself. It cannot check that the predecessor exists or that sequences increase,
because it sees one package at a time; that is the consumer's ledger to keep,
and it is worth keeping.

The **manifest closure** is the whole integrity claim: the files on disk are
exactly the files listed, each with the listed digest and length. `verify.mjs`
walks the directory, compares the two sets, and reports both directions —
listed-but-missing and present-but-unlisted. A package must ship and list its
own `verify.mjs`.

## 10. Forbidden in a package

`verify.mjs` fails, not warns, on any of these:

1. **Credentials** of any kind: keys, tokens, bearer strings, connection
   strings, anything JWT- or `sk-`-shaped.
2. **Database identifiers**: UUIDs, row ids, table or column names, any field
   named `uuid`, `db_id`, `database_id` or similar. Package identity is
   content-addressed; a database id is mutable and leaks PM's internals.
3. **Internal file paths**: absolute paths, relative paths, and anything
   naming PM's directories (`lib/`, `scripts/`, `evidence/`, `tests/`,
   `docs/`, …) or ending in a source-file extension. The only paths permitted
   are the package-relative ones in `files[]`, `deals[].path`,
   `deals[].source_units_path` and `corpus_manifest_path`, and those must match
   the layout in section 2. `sec_document_name` is a filing-side document name,
   not a path: it is validated positively against a no-separator pattern rather
   than exempted (§4).
4. **Mutable IDs.** Enforced positively: every field whose name ends in `_id`
   must be a 64-hex content ID. Exactly three may also be `null`, each for a
   reason this contract states: `transaction_id` (§3.1.1),
   `examined_source_unit_id` (§5.1) and `supersedes_release_manifest_id`
   (§9.1). There is no other nullable identifier and no other kind of
   identifier at all.
5. **Model provider details**: provider or model names, prompts, prompt
   fragments, sampling parameters, extraction-run model metadata. A package
   says what was extracted and from where in the text, never by what.
6. **Real deal identity in an example.** The example package uses CIK
   `0000000000` and accession `0000000000-00-000000`, neither of which SEC can
   issue, and invented clause text.

## 11. Verification

```
node verify.mjs <package-dir>
```

Exit `0`: every check passed. Exit `1`: at least one check failed, and every
failure is printed with its JSON location. Exit `2`: the verifier could not
run at all (bad argument, unreadable directory, its own ID-rule self-test
failed). **Exit 2 is not a pass.** A run that proves nothing must never read
like a run that proves everything.

The verifier:

- recomputes every file SHA-256 and byte length, and checks the manifest
  closure in both directions;
- recomputes every content ID — deal key, claim revision, category summary,
  deal document, source unit set, corpus manifest, release manifest. It does
  **not** recompute `corpus_id`, by design (§8);
- recomputes every span's text SHA-256 and byte width — claim spans, field
  evidence spans, source-unit extents and context spans alike — and every
  `rendered_value_digest` and `typed_value_digest`;
- checks every `fact_state` against its required companions, every
  `APPROVED_LIMITED` claim for its limitation, and every source-unit reference
  for existence;
- checks every enum, every state combination, every ordering, every count and
  every cross-reference between manifest, corpus and deal documents;
- scans every string and field name for forbidden content;
- imports only `node:crypto`, `node:fs` and `node:path`, reads nothing outside
  the package directory, and makes no network or model call.

It never throws on a malformed package: every re-derivation is guarded so a
corrupted record produces a printed failure, not a stack trace.

## 12. Versioning and supersession

- **The version is `package_schema_version`, and it is semantic.** MAJOR
  changes break a consumer; MINOR adds fields without breaking one; PATCH
  fixes wording only. A consumer must refuse a package whose MAJOR it does not
  implement. `verify.mjs` accepts exactly the version it implements, `1.2.0`.

### 12.1 Change list

**1.0.0 — draft 1.** The initial contract, published as
`DEAL_TERMS_PACKAGE/V1`. Identity, provenance, states, category summaries,
corpus and release identity, the forbidden list, and verification.

**1.1.0 — draft 2.** Applies A-0004 rulings 1, 2, 3 and 5. Additive: a
consumer written against 1.0.0 keeps working, and gains fields.

| change | ruling | where |
|---|---|---|
| `transaction_id` added beside `deal_key` on every deal document and corpus member; nullable; supplied only through the corpus manifest; `null` blocks `PUBLIC` | 1 | §3.1.1, §8, §9 |
| `value_type`, `typed_value`, `unit` and `sort_value` added to every field entry; `typed_value_digest` becomes re-derivable | 2 | §6.1 |
| No relevance score, stated as a refusal rather than an omission | 3 | §7 |
| Per-family concept, role and ordinal explicitly **not** guaranteed | 4 | §7.1 |
| Corpus input contract replaced with DS's selection-record plus admission-receipt split | 5 | `CORPUS-MANIFEST-INPUT-CONTRACT.md` |
| `package_schema_version` becomes a semantic version | — | §12 |

**1.2.0 — draft 3.** Applies A-0006 rulings 1 to 5. Additive in shape, but
`fact_state` is **required**, so a 1.1.0 producer's field records do not
validate: this is the one change a consumer must handle rather than ignore.

| change | ruling | where |
|---|---|---|
| Required per-field `fact_state` in {PRESENT, ABSENT, NOT_APPLICABLE, NOT_EXAMINED, FAILED}, with `evidence_spans`, `examined_source_unit_id` and `reason_code`, derived from the V2 disposition and issue-code vocabulary | 1 | §5.1, §6.1 |
| Shared `source_units/<deal_key>.json`: full authored-unit text with context spans; claims reference units by id | 2 | §6.2 |
| `sec_document_name` and `sec_document_sequence` on the locator; null blocks `PUBLIC` | 2 | §4, §9 |
| Required `limitation` {code, text, ruling_id} on every `APPROVED_LIMITED` claim | 3 | §6.3 |
| `supersedes_release_manifest_id` and `release_sequence`, with snapshot and rollback semantics | 4 | §9.1 |
| `corpus_id` becomes the approved selection record's content ID, never recomputed; the size bound counts unique `transaction_id`s; documents nest under transactions | 5 | §8 |

The change that is not purely additive in 1.1.0 was `package_schema_version`'s
format. It is called out here because a consumer that string-matched
`DEAL_TERMS_PACKAGE/V1` will not match `1.1.0`, which is the intended
behaviour: refuse what you do not implement.
- **Adding a field, removing a field, renaming a field, changing a rule or a
  regex, or adding a value to a closed enum is a new version.** Only
  `reason_codes` is open, and section 5 says how to treat an unknown code.
- **Packages are immutable.** A package is never edited. A correction is a new
  release with a new `production_release_id` and a new `release_manifest_id`.
  Two releases over the same deals share a `corpus_id`, which is how DS knows
  one supersedes the other.
- **Supersession is by release, not by claim.** Within a release, a changed
  answer is a new `claim_revision_id` on an unchanged `claim_occurrence_id`
  (section 3.3). Across releases, DS compares revision IDs per occurrence to
  see what moved. The older release stays valid and stays verifiable; PM does
  not withdraw packages.
- **A schema change is announced on this channel** as a new `A-NNNN` before any
  package carrying it is cut, so DS is never surprised by a package it cannot
  read.

## 13. The example

`example-one-deal-package/` is a complete, synthetic, verifying package:
`ONE_DEAL` corpus, `release_state: REVIEW_ONLY_INTERNAL`, `public: false`,
three claims across two families (`TERMINATION_FEE` twice,
`CLOSING_CONDITIONS` once) in review states `NORMAL`, `REVIEW_ONLY` and
`NO_OUTPUT`, and one category summary whose roll-up is therefore
`REVIEW_ONLY`. It carries a non-null `transaction_id`, minted the way Q-0001
§2 defines it, so the identity wiring is shown end to end.

Draft 3 extends it to exercise the new vocabulary: **all five `fact_state`
values**, including a `BOOLEAN false` marked `PRESENT`; an `APPROVED_LIMITED`
claim with its `limitation`; four source units, one carrying both an
`ARTICLE_CHAPEAU` and a `GOVERNING_CHAPEAU` context span; and a document
locator. A consumer that mishandles any of these fails on the example rather
than on a real deal.

`build-example.mjs` regenerates it deterministically. Every ID in it is
computed by the real rule, `build-example.mjs --check` proves the committed
bytes equal a fresh build, and `node example-one-deal-package/verify.mjs
example-one-deal-package` exits 0. Change one character anywhere and it exits
1.

---

*Producer: Precedent Machine. Channel: `coord/deal-terms`, protocol in
`../PROTOCOL.md`. Questions to `../inbox/Q-NNNN-*.md`.*
