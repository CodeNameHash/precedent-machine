# The Deal Terms release-package contract, version 1

`package_schema_version: DEAL_TERMS_PACKAGE/V1`

Precedent Machine (PM) is the producer. Deal Storylines (DS) is the consumer.
This document is the whole of what DS may build against. It implements the
approach decided in `outbox/A-0002-approach-corpus-and-packages.md`; the
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
  manifest.json                       the release manifest
  corpus/corpus-manifest.json         which deals this release covers
  deals/<deal_key>/deal.json          one document per deal
  verify.mjs                          the verifier, shipped with the package
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

**Multi-document deals and amendments** are, at v1, separate deal keys that
share an `issuer_cik`. Q-0001 §2 answers this differently — it keys a *deal*
rather than a *document*, so an amendment keeps the deal ID — and it reserves
minting of that ID to DS. **This contract has not been reconciled with that.**
See §7.1 item 1; it is the most consequential open point in v1, and it is the
lead's call, not this draft's.

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

Grounding: these are the fields `lib/canonical-v2/sec-source-admission.js`
already produces when it admits a source, and `lib/canonical-v2/deal-source-binding.js`
already binds. A package quotes them; it does not invent them.

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

## 7. Stable references the four consumer interfaces need

**This section is a placeholder and is marked so deliberately.**

`inbox/Q-0001-consumer-contract-requirements.md` has now landed, and it states
DS's requirements per interface in full. This version of the contract was
drafted against A-0001 and A-0002 and has **not** been reconciled with it. The
table below therefore says only which of the fields already in this contract
each interface would draw on. Every row is **PROVISIONAL**. Section 7.1 lists
where v1 is known to fall short of Q-0001; those are rulings for the producer's
lead, not gaps a schema draft should close by guessing.

| interface | identity fields | display fields | filter keys | sort keys |
|---|---|---|---|---|
| **Terms Summary** | `deal_key`, `deal_document_id` | `deal_identity.*`, `category_summaries[].classification_path`, `summary_review_state`, `counts` | `family_key`, `summary_review_state` | `family_key`, `counts.NORMAL` |
| **Provision Analysis** | `claim_occurrence_id`, `claim_revision_id` | `classification_levels`, `section_reference`, `fields[].label` + `rendered_value`, `source.spans[].excerpt_text`, `state`, `reason_codes` | `family_key`, `review_state`, `reason_codes` | `section_reference`, `claim_occurrence_id` |
| **Compare Deals** | `claim_occurrence_id` per deal, `deal_key` | `fields[].rendered_value`, `fields[].typed_value_digest`, `state.review_state` | `family_key`, `classification_path`, `review_state` ∈ {`NORMAL`, `APPROVED_LIMITED`} | `deal_key`, `field_key` |
| **Search Precedents** | `claim_occurrence_id`, `deal_key` | `source.spans[].excerpt_text`, `section_reference`, `classification_levels` | `family_key`, `classification_path`, `review_state`, `issuer_cik` | relevance (DS's own), `deal_key` |

Two notes that are **not** provisional, because they follow from section 5:

- Compare Deals and any aggregate must exclude `REVIEW_ONLY`, `NO_COMPARISON`
  and `NO_OUTPUT`, and must show the limitation on `APPROVED_LIMITED`.
- `typed_value_digest` is `sha256Hex(canonicalJson(typed value))`. Two claims
  agree on a value **exactly when their digests are equal**. Comparing
  `rendered_value` strings compares presentation, not meaning, and will report
  false differences on formatting alone.

### 7.1 Known divergences from Q-0001, for the lead to rule on

These are not oversights. Each is a point where Q-0001 asks for something this
draft does not do, and where choosing wrongly would corrupt the product rather
than merely inconvenience it. None is settled here.

1. **Who mints the deal ID.** Q-0001 §2 says DS assigns the canonical deal ID
   and PM "does not derive or remint it", from a `PUBLIC_MA_DEAL/V1` payload
   of `target_cik`, a `transaction_anchor` of issuer CIK + accession +
   document role, and `announced_transaction_ordinal`. This contract instead
   derives `deal_key` itself, from source system + issuer CIK + accession +
   document role, with no `target_cik` and no ordinal (§3.1). The two keys are
   not interchangeable, and the difference is not cosmetic: DS's key is per
   *transaction* and survives amendments, this one is per *document*.
   Reconciling probably means a package carries both — DS's `deal_id` as
   supplied, and PM's per-document key — with the SEC identity that proves the
   binding. That is a schema change and a new version.
2. **Typed values.** Q-0001 §1 requires typed value, value type, unit and a
   separate sortable value, and says "the consumer must not parse a formatted
   display string"; it also requires missing, absent, not-applicable and
   non-comparable to stay distinct from zero and false. This contract's
   `fields[]` carries `rendered_value` plus digests only (§7 note 2), which
   supports equality comparison but **not** sorting, units or arithmetic. This
   is the largest single gap in v1.
3. **Search ranking.** Q-0001 §1 asks for a producer relevance score with a
   score version as the primary sort key for Search Precedents. PM has no such
   score today, and A-0003 already flagged it as needing scoping. This
   contract exposes no score.
4. **Per-family identity guarantees.** Q-0001's common envelope assumes
   governed family ID, concept ID, role and ordinal exist at claim-occurrence
   level for every family. This contract carries `family_key`,
   `claim_definition_key` and `classification_levels`; whether that satisfies
   "concept, role and ordinal" for all 25 families is unverified and, per
   A-0003, must be stated per family rather than promised in the blanket.

Until these are ruled on, DS should treat v1 as the identity, provenance,
state and verification layer — which is settled — and not as the final field
surface for the four interfaces.

When the reconciliation lands, PM replaces this table with a settled one. Any
field change is a new `package_schema_version` under section 12.

## 8. Corpus identity

`corpus/corpus-manifest.json` says which deals a release covers.

| field | rule |
|---|---|
| `corpus_kind` | `ONE_DEAL`, `FIVE_DEAL`, `SHARED_50_PROOF`, `PUBLIC` |
| `corpus_id` | `contentId('DEAL_TERMS_CORPUS_ID/V1', {corpus_kind, member_deal_keys: sorted})` — two releases over the same deals share a `corpus_id` |
| `corpus_manifest_id` | content ID of the whole manifest record |
| `members[]` | per deal: `deal_key`, the three SEC identity fields, `agreement_id`, `canonical_text_sha256`, `source_admission_manifest_id`, `admission_receipt_id` |
| `counts.member_count` | equals `members.length` |

`verify.mjs` requires that the member set **equals** the set of deal documents
in the package: no member without a document, no document without a member.
Each member's `agreement_id`, `canonical_text_sha256`,
`source_admission_manifest_id` and `admission_receipt_id` must equal the deal
document's, so the corpus cannot describe a different deal than it ships.
`ONE_DEAL` has exactly one member; `FIVE_DEAL` exactly five.

Vocabulary warning, from `../PINS.md`: **"Fixed 50" inside PM means 50
lawyer-review items across nine agreements, not a 50-deal corpus.** The
50-deal corpus is `SHARED_50_PROOF` and nothing else.

Every member of a released corpus is already admitted, so no field here is
nullable. The pre-admission shape, where a proposed deal has nulls, is
`CORPUS-MANIFEST-INPUT-CONTRACT.md`.

## 9. Release identity

`manifest.json`:

| field | rule |
|---|---|
| `package_schema_version` | `DEAL_TERMS_PACKAGE/V1` |
| `release_manifest_id` | content ID of the manifest body without this field |
| `production_release_id` | PM's identifier for this release; immutable, a re-cut is a new release |
| `producer_commit` | 40-hex git commit PM cut the package from. Not a branch name; a branch moves |
| `release_state` | `REVIEW_ONLY_INTERNAL`, `LEGAL_GATE_PASSED_INTERNAL`, `PUBLIC` |
| `public` | boolean, **true if and only if** `release_state` is `PUBLIC` |
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
   are the package-relative ones in `files[]`, `deals[].path` and
   `corpus_manifest_path`, and those must match the layout in section 2.
4. **Mutable IDs.** Enforced positively: every field whose name ends in `_id`
   must be a 64-hex content ID. There is no other kind of identifier.
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
  deal document, corpus id, corpus manifest, release manifest;
- recomputes every span's text SHA-256 and byte width, and every
  `rendered_value_digest`;
- checks every enum, every state combination, every ordering, every count and
  every cross-reference between manifest, corpus and deal documents;
- scans every string and field name for forbidden content;
- imports only `node:crypto`, `node:fs` and `node:path`, reads nothing outside
  the package directory, and makes no network or model call.

It never throws on a malformed package: every re-derivation is guarded so a
corrupted record produces a printed failure, not a stack trace.

## 12. Versioning and supersession

- **The version is `package_schema_version`.** A consumer must refuse a
  package whose value it does not implement. `verify.mjs` at v1 accepts only
  `DEAL_TERMS_PACKAGE/V1`.
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
`REVIEW_ONLY`.

`build-example.mjs` regenerates it deterministically. Every ID in it is
computed by the real rule, `build-example.mjs --check` proves the committed
bytes equal a fresh build, and `node example-one-deal-package/verify.mjs
example-one-deal-package` exits 0. Change one character anywhere and it exits
1.

---

*Producer: Precedent Machine. Channel: `coord/deal-terms`, protocol in
`../PROTOCOL.md`. Questions to `../inbox/Q-NNNN-*.md`.*
